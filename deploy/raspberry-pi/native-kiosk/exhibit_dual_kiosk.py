#!/usr/bin/env python3
import os
import random
import sys
import threading
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
SLOT_SETTLE_MS = 3000
SLOT_SETTLE_ANIM_MS = 3000
SLOT_SPIN_GAP_START_MS = 420
SLOT_SPIN_GAP_END_MS = 38
SLOT_SPIN_WIPE_MS = 42
WIPE_MS_BASELINE = 420

BASELINE_COVER_SCALE = 1.28
BASELINE_MUTE_ALPHA = 150
TRIGGER_LOWER_BIAS = 0.58
SETTLE_LOWER_BIAS = 0.66

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


def env_float(key, default):
    try:
        return float(os.environ.get(key, str(default)))
    except ValueError:
        return default


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


class ImageCache:
    def __init__(self):
        self._cache = {}

    def get(self, path, size, mode, lower_bias):
        key = (str(path), size, mode, round(lower_bias, 3))
        if key in self._cache:
            return self._cache[key]
        try:
            raw = pygame.image.load(str(path)).convert()
        except pygame.error:
            self._cache[key] = None
            return None
        surf = render_image(raw, size[0], size[1], mode, lower_bias=lower_bias)
        self._cache[key] = surf
        return surf


def render_image(raw, w, h, mode, lower_bias=0.5, y_offset_ratio=0.0):
    iw, ih = raw.get_size()
    if iw < 1 or ih < 1:
        return None
    out = pygame.Surface((w, h))
    out.fill((20, 22, 26))
    if mode == "baseline":
        scale = max(w / iw, h / ih) * BASELINE_COVER_SCALE
        sw, sh = max(1, int(iw * scale)), max(1, int(ih * scale))
        scaled = pygame.transform.smoothscale(raw, (sw, sh))
        x = (w - sw) // 2
        y = (h - sh) // 2 + int(y_offset_ratio * h)
        out.blit(scaled, (x, y))
        mute = pygame.Surface((w, h), pygame.SRCALPHA)
        mute.fill((40, 42, 48, BASELINE_MUTE_ALPHA))
        out.blit(mute, (0, 0))
        return out
    scale = min(w / iw, h / ih)
    sw, sh = max(1, int(iw * scale)), max(1, int(ih * scale))
    scaled = pygame.transform.smoothscale(raw, (sw, sh))
    x = (w - sw) // 2
    if sh <= h:
        y = (h - sh) // 2 + int(y_offset_ratio * h)
        src = scaled
        out.blit(src, (x, y))
    else:
        src_y = int((sh - h) * lower_bias)
        y = int(y_offset_ratio * h)
        out.blit(scaled, (x, y), (0, src_y, sw, h))
    return out


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
            "new": next_surf,
            "path": path,
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
            self._blit_surf(screen, s["new"], y_ratio)
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
            h = self.rect.h
            if w["old"] is not None:
                self._blit_surf(screen, w["old"], eased)
            self._blit_surf(screen, w["new"], -1.0 + eased)
            return
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


class ExhibitDualKiosk:
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
        self.w = env_int("SEQUENCE_WINDOW_WIDTH", 3840)
        self.h = env_int("SEQUENCE_WINDOW_HEIGHT", 1080)
        self.w_left = env_int("SEQUENCE_MONITOR_LEFT_WIDTH", self.w // 2)
        self.w_right = max(1, self.w - self.w_left)
        self.ms_per_long = env_int("SEQUENCE_MS_PER_LONG_IMAGE", MS_PER_LONG)

        self.left_map = collect_folder_map(self.left_root)
        self.right_map = collect_folder_map(self.right_root)
        self.folder_keys = paired_folder_keys(self.left_map, self.right_map)
        if not self.folder_keys:
            raise SystemExit(f"No paired exhibit folders in {self.left_root} and {self.right_root}")

        os.environ["SDL_VIDEO_WINDOW_POS"] = "0,0"
        pygame.init()
        borderless = env_int("SEQUENCE_PYGAME_BORDERLESS", 1)
        flags = pygame.NOFRAME if borderless else 0
        self.screen = pygame.display.set_mode((self.w, self.h), flags)
        pygame.display.set_caption("" if borderless else "Sequence exhibit")

        self.left_rect = pygame.Rect(0, 0, self.w_left, self.h)
        self.right_rect = pygame.Rect(self.w_left, 0, self.w_right, self.h)
        self.cache = ImageCache()
        self.left = Pane(self.left_rect, self.cache)
        self.right = Pane(self.right_rect, self.cache)

        self.mode = "baseline"
        self.folder_idx = 0
        self.phase_start = 0
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
        return self.folder_keys[self.folder_idx % len(self.folder_keys)]

    def _folder_urls(self, key):
        return self.left_map[key], self.right_map[key]

    def _start_baseline_folder(self, now):
        self.mode = "baseline"
        key = self._current_folder_key()
        left_urls, right_urls = self._folder_urls(key)
        timing = folder_phase_equal(len(left_urls), len(right_urls), self.ms_per_long)
        if not timing:
            self.folder_idx += 1
            self._start_baseline_folder(now)
            return
        self.phase_start = now
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
        if now >= self.left_next_at and self.left_idx + 1 < len(left_urls):
            self.left_idx += 1
            self.left.start_wipe(left_urls[self.left_idx], WIPE_MS_BASELINE, "baseline")
            timing = folder_phase_equal(len(left_urls), len(right_urls), self.ms_per_long)
            self.left_next_at = now + timing["left_interval_ms"]
        if now >= self.right_next_at and self.right_idx + 1 < len(right_urls):
            self.right_idx += 1
            self.right.start_wipe(right_urls[self.right_idx], WIPE_MS_BASELINE, "baseline")
            timing = folder_phase_equal(len(left_urls), len(right_urls), self.ms_per_long)
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
        self.slot_started_at = now
        self.slot_spin_next_at = now + slot_spin_gap_ms(0)
        self.left.start_wipe(random.choice(left_urls), SLOT_SPIN_WIPE_MS, "trigger", TRIGGER_LOWER_BIAS)
        self.right.start_wipe(random.choice(right_urls), SLOT_SPIN_WIPE_MS, "trigger", TRIGGER_LOWER_BIAS)

    def _advance_slot(self, now):
        elapsed = now - self.slot_started_at
        if elapsed >= SLOT_MS:
            self._start_baseline_folder(now)
            return
        if elapsed >= SLOT_SPIN_MS:
            if self.mode == "slot":
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
                elif ev.type == pygame.KEYDOWN:
                    if ev.key == pygame.K_ESCAPE:
                        running = False
                    elif ev.key == pygame.K_SPACE and self.mode == "baseline":
                        self._start_slot(now)
            self._poll_sensor()
            if self.mode == "baseline":
                self._advance_baseline(now)
            else:
                self._advance_slot(now)
            self.screen.fill((20, 22, 26))
            self.left.tick(self.screen)
            self.right.tick(self.screen)
            pygame.display.flip()
            clock.tick(60)
        self.stop_ev.set()
        pygame.quit()


def main():
    try:
        ExhibitDualKiosk().run()
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
