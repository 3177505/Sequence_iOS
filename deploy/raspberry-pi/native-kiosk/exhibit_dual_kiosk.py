#!/usr/bin/env python3
import argparse
import json
import os
import random
import subprocess
import sys
import threading
import tempfile
import time
from pathlib import Path

import pygame

try:
    import serial
except ImportError:
    serial = None

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
SERIAL_BAUD = 115200

MS_PER_LONG = 1000
SLOT_MS = 10000
SLOT_SPIN_MS = 7000
SLOT_SETTLE_ANIM_MS = 3000
SLOT_SPIN_GAP_START_MS = 420
SLOT_SPIN_GAP_END_MS = 38
SLOT_SPIN_WIPE_MS = 90
WIPE_MS_BASELINE = 320

BASELINE_MUTE_ALPHA = 120
TRIGGER_LOWER_BIAS = 0.5
SETTLE_LOWER_BIAS = 0.58
FPS_BASELINE = 20
FPS_SLOT = 30

SETTLE_KEYFRAMES = [
    (0.0, -1.32),
    (0.58, 0.14),
    (0.74, -0.07),
    (0.84, 0.04),
    (0.91, -0.02),
    (0.96, 0.01),
    (1.0, 0.0),
]


def env_int(key, default):
    try:
        return int(os.environ.get(key, str(default)))
    except ValueError:
        return default


def windowed_mode():
    if env_int("SEQUENCE_PYGAME_WINDOWED", 0):
        return True
    if env_int("SEQUENCE_PYGAME_SETUP", 0):
        return True
    return env_int("SEQUENCE_PYGAME_BORDERLESS", 1) == 0


def apply_window_pos(pane, cfg):
    if windowed_mode():
        key = "SEQUENCE_PYGAME_SETUP_LEFT_POS" if pane == "left" else "SEQUENCE_PYGAME_SETUP_RIGHT_POS"
        default = "40,40" if pane == "left" else "80,80"
        os.environ["SDL_VIDEO_WINDOW_POS"] = os.environ.get(key, default)
        return
    swap = env_int("SEQUENCE_MONITOR_SWAP", 0)
    if pane == "left":
        x = cfg.x_right if swap else cfg.x_left
    else:
        x = cfg.x_left if swap else cfg.x_right
    y = env_int("SEQUENCE_PYGAME_WINDOW_Y", 0)
    os.environ["SDL_VIDEO_WINDOW_POS"] = f"{x},{y}"


def display_flags():
    flags = pygame.DOUBLEBUF
    if windowed_mode():
        return flags | pygame.RESIZABLE
    if env_int("SEQUENCE_PYGAME_FULLSCREEN", 0):
        flags |= pygame.FULLSCREEN
    elif env_int("SEQUENCE_PYGAME_BORDERLESS", 1):
        flags |= pygame.NOFRAME
    return flags


def window_caption(pane):
    if windowed_mode():
        return "Sequence left" if pane == "left" else "Sequence right"
    return ""


def initial_window_size(cfg, pane):
    if windowed_mode():
        w = env_int("SEQUENCE_PYGAME_WINDOWED_WIDTH", cfg.w_left if pane == "left" else cfg.w_right)
        h = env_int("SEQUENCE_PYGAME_WINDOWED_HEIGHT", cfg.h)
        return max(320, w), max(240, h)
    if pane == "left":
        return cfg.w_left, cfg.h
    return cfg.w_right, cfg.h


def hide_desktop_panel():
    if env_int("SEQUENCE_HIDE_DESKTOP_PANEL", 1) != 1:
        return
    script = os.environ.get(
        "SEQUENCE_HIDE_DESKTOP_PANEL_SCRIPT",
        "/usr/local/bin/sequence-hide-desktop-panel.sh",
    )
    if os.path.isfile(script):
        subprocess.run(["bash", script], check=False)


def show_desktop_panel():
    export = os.environ.get("DISPLAY", ":0")
    os.environ["DISPLAY"] = export
    for cmd in (["wf-panel-pi"], ["lxqt-panel"], ["lxpanel"]):
        try:
            subprocess.run(["pgrep", "-x", cmd[0]], check=True, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def exhibit_mode_from_env():
    return not windowed_mode()


def chrome_window_size(cfg, pane, exhibit):
    if exhibit:
        if pane == "left":
            return cfg.w_left, cfg.h
        return cfg.w_right, cfg.h
    w = env_int("SEQUENCE_PYGAME_WINDOWED_WIDTH", cfg.w_left if pane == "left" else cfg.w_right)
    h = env_int("SEQUENCE_PYGAME_WINDOWED_HEIGHT", cfg.h)
    return max(320, w), max(240, h)


def apply_exhibit_chrome(app, cfg, pane, exhibit):
    os.environ["SEQUENCE_PYGAME_WINDOWED"] = "0" if exhibit else "1"
    os.environ["SEQUENCE_PYGAME_BORDERLESS"] = "1" if exhibit else "0"
    w, h = chrome_window_size(cfg, pane, exhibit)
    app.screen = pygame.display.set_mode((w, h), display_flags())
    app.rect = pygame.Rect(0, 0, w, h)
    pygame.display.set_caption(window_caption(pane))
    if pane == "left":
        app.left.resize_to(w, h)
        app.right.resize_to(cfg.w_right, h)
    else:
        app.pane.resize_to(w, h)
    if exhibit:
        hide_desktop_panel()
    else:
        show_desktop_panel()


def sync_path():
    run = os.environ.get("XDG_RUNTIME_DIR") or "/tmp"
    return os.path.join(run, "sequence-exhibit-sync.json")


def write_sync(payload):
    dest = sync_path()
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="seq-sync-", dir=os.path.dirname(dest) or ".")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
        os.replace(tmp, dest)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def read_sync():
    try:
        with open(sync_path(), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None


def sort_folder_keys(keys):
    def key_fn(k):
        if k == "_root":
            return (-1, "")
        if k.isdigit():
            return (0, int(k))
        return (1, k)

    return sorted(keys, key=key_fn)


def list_images_in_dir(dirpath):
    root = Path(dirpath)
    if not root.is_dir():
        return []
    out = []
    for p in sorted(root.iterdir(), key=lambda x: x.name.lower()):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            out.append(p)
    return out


def collect_folder_map(root_dir):
    root = Path(root_dir)
    folders = {}
    if not root.is_dir():
        return folders
    root_files = list_images_in_dir(root)
    if root_files:
        folders["_root"] = root_files
    for ent in sorted(root.iterdir(), key=lambda x: x.name.lower()):
        if ent.is_dir():
            files = list_images_in_dir(ent)
            if files:
                folders[ent.name] = files
    return folders


def paired_folder_keys(left_map, right_map):
    right_set = set(right_map.keys())
    return [k for k in sort_folder_keys(left_map.keys()) if k in right_set and left_map[k] and right_map[k]]


def folder_phase_equal(left_count, right_count, ms_per_long=MS_PER_LONG):
    if left_count <= 0 or right_count <= 0:
        return None
    active_ms = max(left_count, right_count) * ms_per_long
    return {
        "active_ms": active_ms,
        "duration_ms": active_ms,
        "left_interval_ms": active_ms / left_count,
        "right_interval_ms": active_ms / right_count,
    }


def slot_spin_gap_ms(elapsed_ms):
    t = min(1.0, max(0.0, elapsed_ms / SLOT_SPIN_MS))
    ratio = SLOT_SPIN_GAP_END_MS / SLOT_SPIN_GAP_START_MS
    return SLOT_SPIN_GAP_START_MS * (ratio**t)


def parse_sensor_line(line):
    s = (line or "").strip()
    if not s:
        return None
    lo = s.lower()
    if lo in ("high", "on", "yes", "true", "trigger", "trip", "1"):
        return True
    if lo in ("low", "off", "no", "false", "0"):
        return False
    return None


def pick_serial_path():
    env = os.environ.get("SEQUENCE_SERIAL_DEVICE", "").strip()
    if env and os.path.exists(env):
        return env
    by_id = Path("/dev/serial/by-id")
    if by_id.is_dir():
        for name in sorted(os.listdir(by_id)):
            link = by_id / name
            if link.exists():
                return str(link.resolve())
    for p in ("/dev/ttyUSB0", "/dev/ttyACM0"):
        if os.path.exists(p):
            return p
    return None


def settle_offset_ratio(t):
    t = min(1.0, max(0.0, t))
    for i in range(len(SETTLE_KEYFRAMES) - 1):
        t0, y0 = SETTLE_KEYFRAMES[i]
        t1, y1 = SETTLE_KEYFRAMES[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-9, t1 - t0)
            return y0 + (y1 - y0) * u
    return 0.0


def image_fit_mode():
    mode = os.environ.get("SEQUENCE_IMAGE_FIT", "contain").strip().lower()
    if mode in ("stretch", "fill", "exact"):
        return "stretch"
    if mode in ("cover", "crop"):
        return "cover"
    return "contain"


def fit_dimensions(iw, ih, w, h):
    if iw < 1 or ih < 1 or w < 1 or h < 1:
        return 1, 1
    fit = image_fit_mode()
    if fit == "stretch":
        return w, h
    if fit == "cover":
        scale = max(w / iw, h / ih)
    else:
        scale = min(w / iw, h / ih)
    return max(1, int(iw * scale)), max(1, int(ih * scale))


def load_image_raw(path, target_w, target_h, max_edge):
    try:
        raw = pygame.image.load(str(path)).convert()
    except pygame.error:
        return None
    iw, ih = raw.get_size()
    need = max(target_w, target_h, 1)
    cap = need
    if max_edge > 0:
        cap = max(need, max_edge)
    if max(iw, ih) > cap:
        if iw >= ih:
            nw = cap
            nh = max(1, int(ih * cap / iw))
        else:
            nh = cap
            nw = max(1, int(iw * cap / ih))
        raw = pygame.transform.scale(raw, (nw, nh))
    return raw


def resize_image(raw, sw, sh):
    if sw < 1 or sh < 1:
        return None
    return pygame.transform.scale(raw, (sw, sh))


class ImageCache:
    def __init__(self, max_edge=1920):
        self._cache = {}
        self.max_edge = max_edge

    def get(self, path, size, mode, lower_bias):
        key = (str(path), size, mode, round(lower_bias, 3), image_fit_mode())
        if key in self._cache:
            return self._cache[key]
        tw, th = size[0], size[1]
        raw = load_image_raw(path, tw, th, self.max_edge)
        if raw is None:
            self._cache[key] = None
            return None
        surf = render_image(raw, tw, th, mode, lower_bias=lower_bias)
        if len(self._cache) > 64:
            self._cache.clear()
        self._cache[key] = surf
        return surf

    def preload(self, paths, size, mode, lower_bias):
        for p in paths:
            self.get(p, size, mode, lower_bias)


def render_image(raw, w, h, mode, lower_bias=0.5, y_offset_ratio=0.0):
    iw, ih = raw.get_size()
    if iw < 1 or ih < 1:
        return None
    sw, sh = fit_dimensions(iw, ih, w, h)
    scaled = resize_image(raw, sw, sh)
    if scaled is None:
        return None
    out = pygame.Surface((w, h))
    out.fill((20, 22, 26))
    x = (w - sw) // 2
    y = (h - sh) // 2 + int(y_offset_ratio * h)
    out.blit(scaled, (x, y))
    if mode == "baseline":
        mute = pygame.Surface((w, h), pygame.SRCALPHA)
        mute.fill((40, 42, 48, BASELINE_MUTE_ALPHA))
        out.blit(mute, (0, 0))
    return out


def pane_to_sync(pane):
    data = {
        "path": str(pane.show_path) if pane.show_path else "",
        "mode": pane.mode,
        "lower_bias": pane.lower_bias,
        "w": pane.rect.w,
        "h": pane.rect.h,
        "anim": None,
    }
    if pane.wipe:
        data["anim"] = {
            "kind": "wipe",
            "start": pane.wipe["start"],
            "dur": pane.wipe["dur"],
            "old_path": str(pane.wipe.get("old_path") or ""),
            "new_path": str(pane.wipe["path"]),
        }
    elif pane.settle:
        data["anim"] = {
            "kind": "settle",
            "start": pane.settle["start"],
            "dur": pane.settle["dur"],
            "old_path": str(pane.settle.get("old_path") or ""),
            "new_path": str(pane.settle["path"]),
        }
    return data


class Pane:
    def __init__(self, rect, cache):
        self.rect = rect
        self.cache = cache
        self.mode = "baseline"
        self.lower_bias = TRIGGER_LOWER_BIAS
        self.show_path = None
        self.show_surf = None
        self.wipe = None
        self.settle = None

    def _size(self):
        return self.rect.w, self.rect.h

    def set_instant(self, path, mode=None, lower_bias=None):
        if mode is not None:
            self.mode = mode
        if lower_bias is not None:
            self.lower_bias = lower_bias
        self.wipe = None
        self.settle = None
        self.show_path = path
        self.show_surf = self.cache.get(path, self._size(), self.mode, self.lower_bias)

    def start_wipe(self, path, dur_ms, mode=None, lower_bias=None):
        if mode is not None:
            self.mode = mode
        if lower_bias is not None:
            self.lower_bias = lower_bias
        next_surf = self.cache.get(path, self._size(), self.mode, self.lower_bias)
        if next_surf is None:
            return
        now = pygame.time.get_ticks()
        self.wipe = {
            "start": now,
            "dur": max(1, int(dur_ms)),
            "old": self.show_surf,
            "old_path": self.show_path,
            "new": next_surf,
            "path": path,
        }
        self.settle = None

    def start_settle(self, path, mode="trigger", lower_bias=SETTLE_LOWER_BIAS):
        self.mode = mode
        self.lower_bias = lower_bias
        next_surf = self.cache.get(path, self._size(), self.mode, self.lower_bias)
        if next_surf is None:
            return
        now = pygame.time.get_ticks()
        self.settle = {
            "start": now,
            "dur": SLOT_SETTLE_ANIM_MS,
            "old": self.show_surf,
            "old_path": self.show_path,
            "new": next_surf,
            "path": path,
        }
        self.wipe = None

    def apply_sync(self, data):
        pw = int(data.get("w") or 0)
        ph = int(data.get("h") or 0)
        if pw > 0 and ph > 0 and (pw, ph) != self._size():
            self.resize_to(pw, ph)
        path = data.get("path") or None
        if path:
            path = Path(path)
        mode = data.get("mode") or "baseline"
        lower_bias = float(data.get("lower_bias") or TRIGGER_LOWER_BIAS)
        anim = data.get("anim")
        if not anim:
            if path:
                self.set_instant(path, mode, lower_bias)
            return
        kind = anim.get("kind")
        new_path = Path(anim.get("new_path") or path or "")
        old_path = anim.get("old_path") or ""
        start = int(anim.get("start") or 0)
        dur = int(anim.get("dur") or 1)
        if kind == "wipe":
            new_surf = self.cache.get(new_path, self._size(), mode, lower_bias)
            old_surf = self.show_surf
            if old_path:
                loaded = self.cache.get(Path(old_path), self._size(), self.mode, self.lower_bias)
                if loaded is not None:
                    old_surf = loaded
            if new_surf is None:
                if path:
                    self.set_instant(path, mode, lower_bias)
                return
            self.mode = mode
            self.lower_bias = lower_bias
            self.wipe = {
                "start": start,
                "dur": dur,
                "old": old_surf,
                "old_path": Path(old_path) if old_path else self.show_path,
                "new": new_surf,
                "path": new_path,
            }
            self.settle = None
            self.show_path = self.wipe["old_path"]
        elif kind == "settle":
            new_surf = self.cache.get(new_path, self._size(), mode, lower_bias)
            old_surf = self.cache.get(Path(old_path), self._size(), self.mode, self.lower_bias) if old_path else self.show_surf
            if new_surf is None:
                return
            self.mode = mode
            self.lower_bias = lower_bias
            self.settle = {
                "start": start,
                "dur": dur,
                "old": old_surf,
                "old_path": Path(old_path) if old_path else self.show_path,
                "new": new_surf,
                "path": new_path,
            }
            self.wipe = None

    def tick(self, screen):
        now = pygame.time.get_ticks()
        if self.settle:
            s = self.settle
            t = (now - s["start"]) / max(1, s["dur"])
            if t >= 1.0:
                self.show_path = s["path"]
                self.show_surf = s["new"]
                self.settle = None
                self._blit_surf(screen, self.show_surf, 0.0)
                return
            y_ratio = settle_offset_ratio(t)
            if s["old"] is not None and t < 0.22:
                old_y = int(t / 0.22 * self.rect.h * 1.1)
                self._blit_surf(screen, s["old"], old_y)
            if s["new"] is not None:
                self._blit_surf(screen, s["new"], y_ratio)
            elif s["old"] is not None:
                self._blit_surf(screen, s["old"], 0.0)
            return
        if self.wipe:
            w = self.wipe
            t = (now - w["start"]) / max(1, w["dur"])
            if t >= 1.0:
                self.show_path = w["path"]
                self.show_surf = w["new"]
                self.wipe = None
                self._blit_surf(screen, self.show_surf, 0.0)
                return
            eased = 1 - (1 - min(1.0, t)) ** 2
            if w["old"] is not None:
                self._blit_surf(screen, w["old"], eased)
            if w["new"] is not None:
                self._blit_surf(screen, w["new"], -1.0 + eased)
            elif w["old"] is None and self.show_surf is not None:
                self._blit_surf(screen, self.show_surf, 0.0)
            return
        if self.show_surf is None and self.show_path:
            self.show_surf = self.cache.get(self.show_path, self._size(), self.mode, self.lower_bias)
        self._blit_surf(screen, self.show_surf, 0.0)

    def _blit_surf(self, screen, surf, y_offset_ratio):
        if surf is None:
            pygame.draw.rect(screen, (20, 22, 26), self.rect)
            return
        if abs(y_offset_ratio) < 1e-6:
            screen.blit(surf, self.rect.topleft)
            return
        y = self.rect.y + int(y_offset_ratio * self.rect.h)
        screen.blit(surf, (self.rect.x, y))

    def resize_to(self, w, h):
        self.rect = pygame.Rect(0, 0, w, h)
        self.cache._cache.clear()
        path = self.show_path
        mode = self.mode
        bias = self.lower_bias
        self.wipe = None
        self.settle = None
        if path:
            self.set_instant(path, mode, bias)


def resize_app_screen(app, pane_attr, w, h):
    app.screen = pygame.display.set_mode((w, h), display_flags())
    app.rect = pygame.Rect(0, 0, w, h)
    pane = getattr(app, pane_attr)
    pane.resize_to(w, h)


def handle_resize_event(app, pane_attr, ev):
    resize_app_screen(app, pane_attr, max(320, ev.w), max(240, ev.h))


class ExhibitConfig:
    def __init__(self):
        self.site_dir = os.environ.get("SEQUENCE_SITE_DIR", str(Path.home() / "Sequence_IOS"))
        self.left_root = os.environ.get(
            "SEQUENCE_DUAL_IMAGE_DIR_LEFT",
            os.path.join(self.site_dir, "public", "exhibit-left"),
        )
        self.right_root = os.environ.get(
            "SEQUENCE_DUAL_IMAGE_DIR_RIGHT",
            os.path.join(self.site_dir, "public", "exhibit-right"),
        )
        self.w_total = env_int("SEQUENCE_WINDOW_WIDTH", 3840)
        self.h = env_int("SEQUENCE_WINDOW_HEIGHT", 1080)
        self.w_left = env_int("SEQUENCE_MONITOR_LEFT_WIDTH", self.w_total // 2)
        self.w_right = max(1, self.w_total - self.w_left)
        self.x_left = env_int("SEQUENCE_MONITOR_LEFT_X", 0)
        self.x_right = env_int("SEQUENCE_MONITOR_RIGHT_X", self.w_left)
        self.ms_per_long = env_int("SEQUENCE_MS_PER_LONG_IMAGE", MS_PER_LONG)
        self.image_max_edge = env_int("SEQUENCE_IMAGE_MAX_EDGE", 1920)
        self.left_map = collect_folder_map(self.left_root)
        self.right_map = collect_folder_map(self.right_root)
        self.folder_keys = paired_folder_keys(self.left_map, self.right_map)
        if not self.folder_keys:
            raise SystemExit(f"No paired exhibit folders in {self.left_root} and {self.right_root}")


class ExhibitMaster:
    def __init__(self, cfg):
        self.cfg = cfg
        apply_window_pos("left", cfg)
        pygame.init()
        ww, wh = initial_window_size(cfg, "left")
        self.screen = pygame.display.set_mode((ww, wh), display_flags())
        pygame.display.set_caption(window_caption("left"))
        self.rect = pygame.Rect(0, 0, ww, wh)
        self.cache = ImageCache(max_edge=cfg.image_max_edge)
        self.left = Pane(self.rect, self.cache)
        self.right = Pane(pygame.Rect(0, 0, cfg.w_right, wh), ImageCache(max_edge=cfg.image_max_edge))

        self.exhibit_mode = exhibit_mode_from_env()

        self.mode = "baseline"
        self.folder_idx = 0
        self.left_idx = 0
        self.right_idx = 0
        self.left_next_at = 0
        self.right_next_at = 0
        self.phase_end_at = 0
        self.slot_started_at = 0
        self.slot_spin_next_at = 0
        self.slot_final_left = None
        self.slot_final_right = None
        self.slot_urls_left = []
        self.slot_urls_right = []
        self.sensor_high = False
        self.sensor_q = []
        self.sensor_lock = threading.Lock()
        self.stop_ev = threading.Event()
        self.serial_thread = threading.Thread(target=self._serial_loop, daemon=True)

    def _current_folder_key(self):
        return self.cfg.folder_keys[self.folder_idx % len(self.cfg.folder_keys)]

    def _folder_urls(self, key):
        return self.cfg.left_map[key], self.cfg.right_map[key]

    def _preload_folder(self, key):
        left_urls, right_urls = self._folder_urls(key)
        size_l = (self.left.rect.w, self.left.rect.h)
        size_r = (self.right.rect.w, self.right.rect.h)
        self.cache.preload(left_urls[:3], size_l, "baseline", TRIGGER_LOWER_BIAS)
        self.right.cache.preload(right_urls[:3], size_r, "baseline", TRIGGER_LOWER_BIAS)
        self.right.cache.preload(right_urls[:3], size_r, "trigger", TRIGGER_LOWER_BIAS)

    def _start_baseline_folder(self, now):
        self.mode = "baseline"
        key = self._current_folder_key()
        left_urls, right_urls = self._folder_urls(key)
        timing = folder_phase_equal(len(left_urls), len(right_urls), self.cfg.ms_per_long)
        if not timing:
            self.folder_idx += 1
            self._start_baseline_folder(now)
            return
        self._preload_folder(key)
        self.left_idx = 0
        self.right_idx = 0
        self.left_next_at = now + timing["left_interval_ms"] if len(left_urls) > 1 else now + 10**9
        self.right_next_at = now + timing["right_interval_ms"] if len(right_urls) > 1 else now + 10**9
        self.phase_end_at = now + timing["duration_ms"]
        self.left.set_instant(left_urls[0], "baseline")
        self.right.set_instant(right_urls[0], "baseline")

    def _advance_baseline(self, now):
        key = self._current_folder_key()
        left_urls, right_urls = self._folder_urls(key)
        timing = folder_phase_equal(len(left_urls), len(right_urls), self.cfg.ms_per_long)
        if now >= self.left_next_at and self.left_idx + 1 < len(left_urls):
            self.left_idx += 1
            self.left.start_wipe(left_urls[self.left_idx], WIPE_MS_BASELINE, "baseline")
            self.left_next_at = now + timing["left_interval_ms"]
        if now >= self.right_next_at and self.right_idx + 1 < len(right_urls):
            self.right_idx += 1
            self.right.start_wipe(right_urls[self.right_idx], WIPE_MS_BASELINE, "baseline")
            self.right_next_at = now + timing["right_interval_ms"]
        if now >= self.phase_end_at:
            self.folder_idx += 1
            self._start_baseline_folder(now)

    def _start_slot(self, now):
        self.mode = "slot"
        key = self._current_folder_key()
        left_urls, right_urls = self._folder_urls(key)
        self.slot_urls_left = left_urls
        self.slot_urls_right = right_urls
        self.slot_final_left = random.choice(left_urls)
        self.slot_final_right = random.choice(right_urls)
        pick_l = random.choice(left_urls)
        pick_r = random.choice(right_urls)
        self.left.set_instant(pick_l, "trigger", TRIGGER_LOWER_BIAS)
        self.right.set_instant(pick_r, "trigger", TRIGGER_LOWER_BIAS)
        self.slot_started_at = now
        self.slot_spin_next_at = now + slot_spin_gap_ms(0) + SLOT_SPIN_WIPE_MS

    def _advance_slot(self, now):
        elapsed = now - self.slot_started_at
        if elapsed >= SLOT_MS:
            self._start_baseline_folder(now)
            return
        if self.mode == "slot_settle":
            return
        if elapsed >= SLOT_SPIN_MS:
            self.mode = "slot_settle"
            self.left.start_settle(self.slot_final_left, "trigger", SETTLE_LOWER_BIAS)
            self.right.start_settle(self.slot_final_right, "trigger", SETTLE_LOWER_BIAS)
            return
        if now >= self.slot_spin_next_at:
            self.left.start_wipe(random.choice(self.slot_urls_left), SLOT_SPIN_WIPE_MS, "trigger", TRIGGER_LOWER_BIAS)
            self.right.start_wipe(random.choice(self.slot_urls_right), SLOT_SPIN_WIPE_MS, "trigger", TRIGGER_LOWER_BIAS)
            self.slot_spin_next_at = now + slot_spin_gap_ms(elapsed)

    def _serial_loop(self):
        if serial is None:
            return
        buf = b""
        while not self.stop_ev.is_set():
            path = pick_serial_path()
            if not path:
                time.sleep(2)
                continue
            try:
                ser = serial.Serial(path, SERIAL_BAUD, timeout=0.12)
            except OSError:
                time.sleep(2)
                continue
            try:
                while not self.stop_ev.is_set():
                    chunk = ser.read(512) or b""
                    if not chunk:
                        continue
                    buf += chunk
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        text = line.decode("utf-8", errors="ignore")
                        parsed = parse_sensor_line(text)
                        if parsed is None:
                            continue
                        with self.sensor_lock:
                            self.sensor_q.append(parsed)
            except OSError:
                pass
            finally:
                try:
                    ser.close()
                except Exception:
                    pass
                time.sleep(1)

    def _poll_sensor(self):
        events = []
        with self.sensor_lock:
            events = self.sensor_q[:]
            self.sensor_q.clear()
        for val in events:
            if val and not self.sensor_high:
                self.sensor_high = True
                if self.mode == "baseline":
                    self._start_slot(pygame.time.get_ticks())
            elif not val and self.sensor_high:
                self.sensor_high = False

    def _publish_sync(self, now):
        write_sync(
            {
                "tick": now,
                "exhibit": 1 if self.exhibit_mode else 0,
                "right": pane_to_sync(self.right),
            }
        )

    def _toggle_exhibit_chrome(self):
        self.exhibit_mode = not self.exhibit_mode
        apply_exhibit_chrome(self, self.cfg, "left", self.exhibit_mode)

    def run(self):
        self.serial_thread.start()
        now = pygame.time.get_ticks()
        self._start_baseline_folder(now)
        clock = pygame.time.Clock()
        running = True
        while running:
            now = pygame.time.get_ticks()
            for ev in pygame.event.get():
                if ev.type == pygame.QUIT:
                    running = False
                elif ev.type == pygame.VIDEORESIZE:
                    handle_resize_event(self, "left", ev)
                elif ev.type == pygame.KEYDOWN:
                    if ev.key == pygame.K_ESCAPE:
                        running = False
                    elif ev.key == pygame.K_f and (ev.mod & pygame.KMOD_ALT):
                        self._toggle_exhibit_chrome()
                    elif ev.key == pygame.K_SPACE and self.mode == "baseline":
                        self._start_slot(now)
            self._poll_sensor()
            if self.mode == "baseline":
                self._advance_baseline(now)
                fps = FPS_BASELINE
            else:
                self._advance_slot(now)
                fps = FPS_SLOT
            self._publish_sync(now)
            self.screen.fill((20, 22, 26))
            self.left.tick(self.screen)
            pygame.display.flip()
            clock.tick(fps)
        self.stop_ev.set()
        pygame.quit()


class ExhibitSlave:
    def __init__(self, cfg):
        self.cfg = cfg
        apply_window_pos("right", cfg)
        pygame.init()
        ww, wh = initial_window_size(cfg, "right")
        self.screen = pygame.display.set_mode((ww, wh), display_flags())
        pygame.display.set_caption(window_caption("right"))
        self.rect = pygame.Rect(0, 0, ww, wh)
        self.cache = ImageCache(max_edge=cfg.image_max_edge)
        self.pane = Pane(self.rect, self.cache)
        self.last_anim_key = None
        self.exhibit_mode = exhibit_mode_from_env()

    def _sync_key(self, right):
        anim = right.get("anim")
        if anim:
            return (
                anim.get("kind"),
                anim.get("start"),
                anim.get("dur"),
                anim.get("new_path"),
                anim.get("old_path"),
                right.get("w"),
                right.get("h"),
            )
        return (
            "still",
            right.get("path"),
            right.get("mode"),
            right.get("lower_bias"),
            right.get("w"),
            right.get("h"),
        )

    def _apply_remote(self, data):
        if not data:
            return
        exhibit = data.get("exhibit")
        if exhibit is not None:
            want = bool(int(exhibit))
            if want != self.exhibit_mode:
                self.exhibit_mode = want
                apply_exhibit_chrome(self, self.cfg, "right", self.exhibit_mode)
        right = data.get("right") or {}
        key = self._sync_key(right)
        if key == self.last_anim_key:
            return
        self.last_anim_key = key
        self.pane.apply_sync(right)

    def run(self):
        clock = pygame.time.Clock()
        running = True
        while running:
            for ev in pygame.event.get():
                if ev.type == pygame.QUIT:
                    running = False
                elif ev.type == pygame.VIDEORESIZE:
                    handle_resize_event(self, "pane", ev)
                elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                    running = False
            self._apply_remote(read_sync())
            self.screen.fill((20, 22, 26))
            self.pane.tick(self.screen)
            pygame.display.flip()
            clock.tick(FPS_SLOT)
        pygame.quit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pane", choices=("left", "right"), required=True)
    args = ap.parse_args()
    cfg = ExhibitConfig()
    try:
        if args.pane == "left":
            ExhibitMaster(cfg).run()
        else:
            time.sleep(0.8)
            ExhibitSlave(cfg).run()
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
