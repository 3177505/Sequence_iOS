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


def collect_images(dirpath):
    root = Path(dirpath)
    if not root.is_dir():
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
    out = []
    for p in sorted(root.iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            out.append(p)
    return out


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


def apply_serial_payload(raw_bytes, analog_threshold, analog_enabled, share):
    text = raw_bytes.decode("utf-8", errors="ignore").strip()
    parsed = parse_sensor_boost_line(text, analog_threshold, analog_enabled)
    if parsed is not None:
        share.set_boost(parsed)


def ease_out_cubic(t):
    t = max(0.0, min(1.0, float(t)))
    return 1.0 - (1.0 - t) ** 3


try:
    import serial
except ImportError:
    serial = None


class SensorShare:
    def __init__(self, out_path=None, in_path=None):
        self.out_path = Path(out_path) if out_path else None
        self.in_path = Path(in_path) if in_path else None
        self._lock = threading.Lock()
        self._local_boost = False

    def set_boost(self, v):
        with self._lock:
            self._local_boost = bool(v)
            if self.out_path:
                try:
                    self.out_path.parent.mkdir(parents=True, exist_ok=True)
                    self.out_path.write_text("1" if v else "0", encoding="utf-8")
                except OSError:
                    pass

    def read_boost(self):
        if self.in_path:
            try:
                raw = self.in_path.read_text(encoding="utf-8").strip()
                return raw == "1"
            except OSError:
                pass
        with self._lock:
            return self._local_boost


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
                print(f"native-kiosk: serial open {device}", file=sys.stderr)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--height", type=int, required=True)
    ap.add_argument("--x", type=int, default=0)
    ap.add_argument("--y", type=int, default=0)
    ap.add_argument("--interval", type=float, default=None, help="legacy seconds between slides (if set, overrides ms envs to match old 8s default scale)")
    ap.add_argument("--serial-device", default=None)
    ap.add_argument("--sensor-state-out", default=None)
    ap.add_argument("--sensor-state-in", default=None)
    args = ap.parse_args()

    overflow_top = env_int("SEQUENCE_PYGAME_OVERFLOW_TOP_PIXELS", 0)
    if overflow_top > 0:
        args.y -= overflow_top
        args.height += overflow_top

    d = Path(args.dir)
    os.environ["SDL_VIDEO_WINDOW_POS"] = f"{args.x},{args.y}"

    slide_ms = env_int("SEQUENCE_EXHIBIT_SLIDE_MS", 2500)
    trigger_slide_ms = env_int("SEQUENCE_EXHIBIT_TRIGGER_SLIDE_MS", 70)
    wipe_base_ms = env_int("SEQUENCE_EXHIBIT_WIPE_MS_BASELINE", 420)
    wipe_trig_ms = env_int("SEQUENCE_EXHIBIT_WIPE_MS_TRIGGER", 55)
    serial_baud = env_int("SEQUENCE_NATIVE_SERIAL_BAUD", 115200)

    if args.interval is not None:
        slide_ms = int(max(1.0, args.interval) * 1000)

    share = SensorShare(out_path=args.sensor_state_out, in_path=args.sensor_state_in)
    dev = args.serial_device or os.environ.get("SEQUENCE_NATIVE_SERIAL_DEVICE", "").strip()
    if dev and args.sensor_state_in:
        dev = ""
    if dev and not serial:
        print("native-kiosk: install python3-serial for SEQUENCE_NATIVE_SERIAL_DEVICE", file=sys.stderr)
        dev = ""
    if dev:
        threading.Thread(target=serial_reader, args=(dev, serial_baud, share), daemon=True).start()

    pygame.init()
    borderless = env_int("SEQUENCE_PYGAME_BORDERLESS", 1)
    flags = pygame.NOFRAME if borderless else 0
    screen = pygame.display.set_mode((args.width, args.height), flags)
    pygame.display.set_caption("" if borderless else "Sequence exhibit")

    paths = collect_images(d)
    random.shuffle(paths)
    idx = 0

    clock = pygame.time.Clock()
    running = True
    cache = {}

    current_surf = None
    incoming_surf = None
    wiping = False
    wipe_start = 0
    wipe_duration_ms = wipe_base_ms
    next_slide_at = 0
    idle = True

    def timing():
        boost = share.read_boost()
        sm = trigger_slide_ms if boost else slide_ms
        wm = wipe_trig_ms if boost else wipe_base_ms
        return sm, wm

    def load_surf(path):
        if path in cache:
            return cache[path]
        try:
            img = pygame.image.load(str(path)).convert()
            img = pygame.transform.smoothscale(img, (args.width, args.height))
            cache[path] = img
            return img
        except pygame.error:
            cache[path] = None
            return None

    def next_path():
        nonlocal idx
        if not paths:
            return None
        p = paths[idx % len(paths)]
        idx += 1
        return p

    def start_wipe(now, new_surf, w_ms):
        nonlocal wiping, wipe_start, wipe_duration_ms, incoming_surf, idle
        if new_surf is None:
            return
        incoming_surf = new_surf
        wiping = True
        idle = False
        wipe_start = now
        wipe_duration_ms = max(40, int(w_ms))

    H = args.height
    W = args.width

    while running:
        now = pygame.time.get_ticks()
        slide_ms_eff, wipe_ms_eff = timing()

        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                running = False
            elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                running = False

        if not paths:
            screen.fill((20, 22, 26))
            pygame.display.flip()
            clock.tick(30)
            continue

        if current_surf is None:
            current_surf = load_surf(next_path())
            if current_surf:
                next_slide_at = now + slide_ms_eff

        if wiping and current_surf and incoming_surf:
            elapsed = now - wipe_start
            t = min(1.0, elapsed / float(wipe_duration_ms))
            e = ease_out_cubic(t)
            old_y = int(H * 1.1 * e)
            new_y = int(-H + H * e)
            screen.fill((20, 22, 26))
            screen.blit(current_surf, (0, old_y))
            screen.blit(incoming_surf, (0, new_y))
            if t >= 1.0:
                current_surf = incoming_surf
                incoming_surf = None
                wiping = False
                idle = True
                next_slide_at = now + slide_ms_eff
        elif idle and current_surf:
            screen.fill((20, 22, 26))
            screen.blit(current_surf, (0, 0))
            if now >= next_slide_at:
                nxt = load_surf(next_path())
                _, wms = timing()
                if nxt:
                    start_wipe(now, nxt, wms)
                else:
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
