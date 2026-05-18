#!/usr/bin/env python3

import argparse
import os
import random
import re
import sys
import threading
import time
from pathlib import Path

import pygame


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


def collect_flat_images(dirpath):
    root = Path(dirpath)
    if not root.is_dir():
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
    out = []
    for p in sorted(root.iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            out.append(p)
    return out


def numbered_folder_ids(left_root: Path, right_root: Path):
    def ids(r):
        s = set()
        if not r.is_dir():
            return s
        for p in r.iterdir():
            if p.is_dir() and p.name.isdigit():
                s.add(int(p.name))
        return s

    return sorted(ids(left_root) & ids(right_root))


def build_multi_timeline(left_root: Path, right_root: Path, rng: random.Random):
    ids_ = numbered_folder_ids(left_root, right_root)
    rng.shuffle(ids_)
    tl = []
    for n in ids_:
        Ls = collect_flat_images(left_root / str(n))
        Rs = collect_flat_images(right_root / str(n))
        rng.shuffle(Ls)
        rng.shuffle(Rs)
        if not Ls or not Rs:
            continue
        m = min(len(Ls), len(Rs))
        for i in range(m):
            tl.append((Ls[i], Rs[i]))
    return tl


def build_flat_timeline(left_root: Path, right_root: Path, rng: random.Random):
    Ls = collect_flat_images(left_root)
    Rs = collect_flat_images(right_root)
    rng.shuffle(Ls)
    rng.shuffle(Rs)
    if not Ls or not Rs:
        return []
    m = min(len(Ls), len(Rs))
    return [(Ls[i], Rs[i]) for i in range(m)]


def parse_sensor_boost_line(line, analog_threshold, analog_enabled):
    s = (line or "").strip()
    if not s:
        return None
    lo = s.lower()
    if lo in ("high", "on", "yes", "true", "trigger", "trip"):
        return True
    if lo in ("low", "off", "no", "false"):
        return False
    if re.fullmatch(r"[01]", s):
        return s == "1"
    tokens = [t for t in re.split(r"[,;\t\s]+", s) if t]
    if 1 <= len(tokens) <= 5 and all(t in ("0", "1") for t in tokens):
        return any(t == "1" for t in tokens)
    if re.fullmatch(r"[01]+", s):
        return any(c == "1" for c in s[:5])
    if analog_enabled and re.fullmatch(r"\d+", s):
        v = int(s, 10)
        if analog_threshold <= 0:
            return v > 0
        return v >= analog_threshold
    return None


def ease_out_cubic(t):
    t = max(0.0, min(1.0, float(t)))
    return 1.0 - (1.0 - t) ** 3


try:
    import serial
except ImportError:
    serial = None


class SensorShare:
    def __init__(self):
        self._lock = threading.Lock()
        self._boost = False

    def set_boost(self, v):
        with self._lock:
            self._boost = bool(v)

    def read_boost(self):
        with self._lock:
            return self._boost


def apply_serial_payload(raw_bytes, analog_threshold, analog_enabled, share: SensorShare):
    text = raw_bytes.decode("utf-8", errors="ignore").strip()
    parsed = parse_sensor_boost_line(text, analog_threshold, analog_enabled)
    if parsed is not None:
        share.set_boost(parsed)


def serial_reader(device, baud, share: SensorShare):
    if serial is None or not device:
        return
    idle_flush_s = env_float("SEQUENCE_NATIVE_SERIAL_LINE_IDLE_MS", 0.05)
    analog_thr = env_int("SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD", 400)
    analog_off = os.environ.get("SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD", "").strip() == "-1"
    analog_enabled = not analog_off
    dbg = os.environ.get("SEQUENCE_NATIVE_SERIAL_DEBUG", "").strip() not in ("", "0", "false")
    while True:
        try:
            ser = serial.Serial(device, baud, timeout=0.08)
            if dbg:
                print(f"exhibit-dual-strip: serial open {device}", file=sys.stderr)
            buf = b""
            last_rx = time.monotonic()
            while True:
                chunk = ser.read(4096)
                now = time.monotonic()
                if chunk:
                    buf += chunk
                    last_rx = now
                buf = buf.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    apply_serial_payload(line, analog_thr, analog_enabled, share)
                if buf.strip() and (now - last_rx) >= idle_flush_s:
                    apply_serial_payload(buf, analog_thr, analog_enabled, share)
                    buf = b""
                    last_rx = now
                time.sleep(0.004)
        except Exception:
            time.sleep(1.0)


def exp_span(elapsed_ms, total_ms, vmin, vmax):
    if total_ms <= 0:
        return int(vmax)
    t = max(0.0, min(1.0, float(elapsed_ms) / float(total_ms)))
    if vmin <= 0:
        vmin = 1
    return int(round(vmin * ((vmax / float(vmin)) ** t)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--left-root", required=True)
    ap.add_argument("--right-root", required=True)
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--height", type=int, required=True)
    ap.add_argument("--left-width", type=int, required=True)
    ap.add_argument("--x", type=int, default=0)
    ap.add_argument("--y", type=int, default=0)
    ap.add_argument("--serial-device", default=None)
    args = ap.parse_args()

    left_root = Path(args.left_root).resolve()
    right_root = Path(args.right_root).resolve()
    w_left = int(args.left_width)
    w_right = max(1, args.width - w_left)
    H = args.height

    overflow_top = env_int("SEQUENCE_PYGAME_OVERFLOW_TOP_PIXELS", 0)
    oy = args.y
    win_h = args.height
    if overflow_top > 0:
        oy -= overflow_top
        win_h += overflow_top

    os.environ["SDL_VIDEO_WINDOW_POS"] = f"{args.x},{oy}"

    baseline_slide_ms = env_int("SEQUENCE_EXHIBIT_BASELINE_SLIDE_MS", 1000)
    baseline_wipe_ms = env_int("SEQUENCE_EXHIBIT_BASELINE_WIPE_MS", 380)
    burst_total_ms = env_int("SEQUENCE_BURST_TOTAL_MS", 15000)
    burst_slide_min = env_int("SEQUENCE_BURST_SLIDE_START_MS", 140)
    burst_slide_max = env_int("SEQUENCE_BURST_SLIDE_END_MS", 5200)
    burst_wipe_min = env_int("SEQUENCE_BURST_WIPE_START_MS", 55)
    burst_wipe_max = env_int("SEQUENCE_BURST_WIPE_END_MS", 950)
    serial_baud = env_int("SEQUENCE_NATIVE_SERIAL_BAUD", 115200)

    seed_opt = os.environ.get("SEQUENCE_EXHIBIT_RNG_SEED", "").strip()
    seed = int(seed_opt) if seed_opt.isdigit() else int(time.time() * 1000) % (2**31)
    rng = random.Random(seed)

    share = SensorShare()
    dev = args.serial_device or os.environ.get("SEQUENCE_NATIVE_SERIAL_DEVICE", "").strip()
    if dev and not serial:
        print("exhibit-dual-strip: python3-serial missing", file=sys.stderr)
        dev = ""
    if dev:
        threading.Thread(target=serial_reader, args=(dev, serial_baud, share), daemon=True).start()

    pygame.init()
    borderless = env_int("SEQUENCE_PYGAME_BORDERLESS", 1)
    flags = pygame.NOFRAME if borderless else 0
    screen = pygame.display.set_mode((args.width, win_h), flags)
    pygame.display.set_caption("" if borderless else "Sequence exhibit dual")

    def rebuild_timeline():
        if numbered_folder_ids(left_root, right_root):
            tl = build_multi_timeline(left_root, right_root, rng)
            if tl:
                return tl
        return build_flat_timeline(left_root, right_root, rng)

    timeline = rebuild_timeline()
    idx_tl = 0

    pane_L = pygame.Rect(0, 0, w_left, H)
    pane_R = pygame.Rect(w_left, 0, w_right, H)

    cache = {}
    clock = pygame.time.Clock()

    def load_scaled(path: Path, w, h):
        key = (str(path), w, h)
        if key in cache:
            return cache[key]
        try:
            img = pygame.image.load(str(path)).convert()
            img = pygame.transform.smoothscale(img, (w, h))
            cache[key] = img
            return img
        except pygame.error:
            cache[key] = None
            return None

    curL = curR = None
    incL = incR = None
    wiping = False
    wipe_start = 0
    wipe_ms = baseline_wipe_ms
    idle = True
    next_slide_at = 0

    burst_start_tick = None
    prev_boost = False

    def burst_active(now_ts):
        if burst_start_tick is None:
            return False
        return (now_ts - burst_start_tick) < burst_total_ms

    def maybe_end_burst(now_ts):
        nonlocal burst_start_tick
        if burst_start_tick is not None and (now_ts - burst_start_tick) >= burst_total_ms:
            burst_start_tick = None

    def spacing_and_wipe_now(now_ts):
        if burst_active(now_ts):
            elapsed = now_ts - burst_start_tick
            sm = exp_span(elapsed, burst_total_ms, burst_slide_min, burst_slide_max)
            wm = exp_span(elapsed, burst_total_ms, burst_wipe_min, burst_wipe_max)
            return max(40, sm), max(30, wm)
        return baseline_slide_ms, baseline_wipe_ms

    def advance_timeline_paths():
        nonlocal idx_tl, timeline
        if not timeline:
            return None, None
        a, b = timeline[idx_tl]
        idx_tl += 1
        if idx_tl >= len(timeline):
            idx_tl = 0
            if env_int("SEQUENCE_EXHIBIT_RESHUFFLE_EACH_CYCLE", 1):
                timeline = rebuild_timeline()
                if not timeline:
                    return None, None
        return a, b

    def start_pair_wipe(now_ts, pl, pr, wm):
        nonlocal wiping, wipe_start, wipe_ms, incL, incR, idle
        if pl is None or pr is None:
            return False
        sL = load_scaled(pl, pane_L.width, pane_L.height)
        sR = load_scaled(pr, pane_R.width, pane_R.height)
        if not sL or not sR:
            return False
        incL, incR = sL, sR
        wipe_ms = max(40, int(wm))
        wiping = True
        idle = False
        wipe_start = now_ts
        return True

    running = True
    while running:
        now = pygame.time.get_ticks()

        maybe_end_burst(now)

        boost_now = share.read_boost()
        if boost_now and not prev_boost and not burst_active(now):
            burst_start_tick = now
            next_slide_at = now
        prev_boost = boost_now

        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                running = False
            elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                running = False

        if not timeline:
            screen.fill((20, 22, 26))
            pygame.display.flip()
            clock.tick(20)
            continue

        def draw_vertical_wipe_inside_pane(rect, cur, inc, frac_e):
            Hp = rect.height
            old_y = int(Hp * 1.1 * frac_e)
            new_y = int(-Hp + Hp * frac_e)
            clip = screen.get_clip()
            screen.set_clip(rect)
            screen.fill((20, 22, 26), rect)
            if cur:
                screen.blit(cur, (rect.x, rect.y + old_y))
            if inc:
                screen.blit(inc, (rect.x, rect.y + new_y))
            screen.set_clip(clip)

        if curL is None or curR is None:
            pL, pR = advance_timeline_paths()
            if pL is None:
                pygame.display.flip()
                clock.tick(10)
                continue
            curL = load_scaled(pL, pane_L.width, pane_L.height)
            curR = load_scaled(pR, pane_R.width, pane_R.height)
            idle = True
            if curL and curR:
                slide_ms_eff, wipe_ms_eff = spacing_and_wipe_now(now)
                next_slide_at = now + slide_ms_eff

        if wiping and curL and curR and incL and incR:
            elapsed_w = now - wipe_start
            tw = ease_out_cubic(min(1.0, elapsed_w / float(max(1, wipe_ms))))
            draw_vertical_wipe_inside_pane(pane_L, curL, incL, tw)
            draw_vertical_wipe_inside_pane(pane_R, curR, incR, tw)
            if elapsed_w >= wipe_ms:
                curL, curR = incL, incR
                incL = incR = None
                wiping = False
                idle = True
                slide_ms_eff, wipe_ms_eff = spacing_and_wipe_now(now)
                next_slide_at = now + slide_ms_eff
        elif idle and curL and curR:
            screen.fill((20, 22, 26))
            screen.blit(curL, pane_L.topleft)
            screen.blit(curR, pane_R.topleft)
            slide_ms_eff, wipe_ms_eff = spacing_and_wipe_now(now)
            if now >= next_slide_at:
                pL, pR = advance_timeline_paths()
                if not pL or not pR:
                    next_slide_at = now + slide_ms_eff
                elif not start_pair_wipe(now, pL, pR, wipe_ms_eff):
                    next_slide_at = now + slide_ms_eff

        pygame.display.flip()
        clock.tick(60 if wiping else 12)

    pygame.quit()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
