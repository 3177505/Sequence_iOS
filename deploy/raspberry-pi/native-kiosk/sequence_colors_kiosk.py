#!/usr/bin/env python3
import os
import queue
import random
import sys
import threading
import time

import pygame

try:
    import serial
except ImportError:
    serial = None

SLIDE_MS = 2500
TRIGGER_SLIDE_MS = 400
TRIGGER_MS = 15000

FOLDER1 = ["#c94c4c", "#4c8cc9", "#6bc94c", "#c9a64c"]
FOLDER2 = ["#9b59b6", "#1abc9c", "#e67e22", "#34495e"]
FOLDER_TRIGGER_L = ["#ff6b6b", "#4ecdc4", "#ffe66d"]
FOLDER_TRIGGER_R = ["#a29bfe", "#fd79a8", "#00b894"]

WIPE_MS_BASELINE = 420
WIPE_MS_TRIGGER = 220
JITTER_MS_BASELINE = 380
JITTER_MS_TRIGGER = 90

SERIAL_BAUD = 115200


def shuffle(arr):
    a = list(arr)
    for i in range(len(a) - 1, 0, -1):
        j = random.randint(0, i)
        a[i], a[j] = a[j], a[i]
    return a


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def ease_bezierish(t):
    return 1 - (1 - t) ** 2


class WipePane:
    def __init__(self, initial_hex):
        c = hex_to_rgb(initial_hex)
        self.show = c
        self.under = c
        self.anim_start = None
        self.anim_dur = None

    def set_instant(self, rgb):
        self.show = rgb
        self.under = rgb
        self.anim_start = None

    def start_wipe(self, new_rgb, dur_ms):
        self.under = new_rgb
        self.anim_start = pygame.time.get_ticks()
        self.anim_dur = dur_ms

    def tick_draw(self, surface, rect):
        if self.anim_start is None:
            surface.fill(self.show, rect)
            return
        now = pygame.time.get_ticks()
        raw = (now - self.anim_start) / max(1, self.anim_dur)
        t = min(1.0, raw)
        t = ease_bezierish(t)
        surface.fill(self.under, rect)
        y_cover = max(1, int(rect.height * (1 - t)))
        overlay = pygame.Rect(rect.x, rect.y, rect.w, y_cover)
        surface.fill(self.show, overlay)
        if t >= 1.0:
            self.show = self.under
            self.anim_start = None


def pick_serial_path():
    env = os.environ.get("SEQUENCE_SERIAL_DEVICE", "").strip()
    if env and os.path.exists(env):
        return env
    for p in ("/dev/ttyACM0", "/dev/ttyUSB0"):
        if os.path.exists(p):
            return p
    return None


def serial_reader_thread(trigger_q, stop_ev):
    if serial is None:
        while not stop_ev.is_set():
            time.sleep(30)
        return
    buf = b""
    while not stop_ev.is_set():
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
            while not stop_ev.is_set():
                chunk = ser.read(512) or b""
                if not chunk:
                    continue
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    if line.strip():
                        trigger_q.put(1)
        except OSError:
            pass
        finally:
            try:
                ser.close()
            except Exception:
                pass
            time.sleep(1)


def main():
    w = int(os.environ.get("SEQUENCE_WINDOW_WIDTH", "1600"))
    h = int(os.environ.get("SEQUENCE_WINDOW_HEIGHT", "480"))
    os.environ.setdefault("SDL_VIDEO_WINDOW_POS", "0,0")

    pygame.init()
    screen = pygame.display.set_mode((w, h))
    pygame.display.set_caption("Sequence colors")

    mw = w // 2
    left_rect = pygame.Rect(0, 0, mw, h)
    right_rect = pygame.Rect(mw, 0, w - mw, h)

    pane_l = WipePane(FOLDER1[0])
    pane_r = WipePane(FOLDER2[0])

    seq_l = shuffle(FOLDER1)
    seq_r = shuffle(FOLDER2)
    idx_l = idx_r = 0
    in_trigger = False
    next_l = 0
    next_r = 0
    trigger_end_at = None

    trigger_q = queue.Queue()
    stop_ev = threading.Event()

    def jitter_ms():
        span = JITTER_MS_TRIGGER if in_trigger else JITTER_MS_BASELINE
        return (random.random() * 2 - 1) * span

    th = threading.Thread(target=serial_reader_thread, args=(trigger_q, stop_ev), daemon=True)
    th.start()

    def apply_l(animate):
        nonlocal idx_l
        col = seq_l[idx_l % len(seq_l)]
        rgb = hex_to_rgb(col)
        dur = WIPE_MS_TRIGGER if in_trigger else WIPE_MS_BASELINE
        if animate:
            pane_l.start_wipe(rgb, dur)
        else:
            pane_l.set_instant(rgb)

    def apply_r(animate):
        nonlocal idx_r
        col = seq_r[idx_r % len(seq_r)]
        rgb = hex_to_rgb(col)
        dur = WIPE_MS_TRIGGER if in_trigger else WIPE_MS_BASELINE
        if animate:
            pane_r.start_wipe(rgb, dur)
        else:
            pane_r.set_instant(rgb)

    def start_baseline():
        nonlocal seq_l, seq_r, idx_l, idx_r, in_trigger, trigger_end_at, next_l, next_r
        in_trigger = False
        trigger_end_at = None
        seq_l = shuffle(FOLDER1)
        seq_r = shuffle(FOLDER2)
        idx_l = idx_r = 0
        apply_l(False)
        apply_r(False)
        n = pygame.time.get_ticks()
        b = SLIDE_MS
        next_l = n + max(30, int(b + jitter_ms()))
        next_r = n + max(30, int(b + jitter_ms()))

    def start_trigger():
        nonlocal seq_l, seq_r, idx_l, idx_r, in_trigger, trigger_end_at, next_l, next_r
        if in_trigger:
            return
        in_trigger = True
        seq_l = shuffle(FOLDER_TRIGGER_L)
        seq_r = shuffle(FOLDER_TRIGGER_R)
        idx_l = idx_r = 0
        apply_l(False)
        apply_r(False)
        trigger_end_at = pygame.time.get_ticks() + TRIGGER_MS
        n = pygame.time.get_ticks()
        b = TRIGGER_SLIDE_MS
        next_l = n + max(30, int(b + jitter_ms()))
        next_r = n + max(30, int(b + jitter_ms()))

    start_baseline()
    clock = pygame.time.Clock()
    running = True

    while running:
        now = pygame.time.get_ticks()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                running = False

        try:
            while True:
                trigger_q.get_nowait()
                if not in_trigger:
                    start_trigger()
        except queue.Empty:
            pass

        if in_trigger and trigger_end_at is not None and now >= trigger_end_at:
            start_baseline()

        if now >= next_l:
            idx_l += 1
            apply_l(True)
            base = TRIGGER_SLIDE_MS if in_trigger else SLIDE_MS
            next_l = now + max(30, int(base + jitter_ms()))
        if now >= next_r:
            idx_r += 1
            apply_r(True)
            base = TRIGGER_SLIDE_MS if in_trigger else SLIDE_MS
            next_r = now + max(30, int(base + jitter_ms()))

        pane_l.tick_draw(screen, left_rect)
        pane_r.tick_draw(screen, right_rect)
        pygame.display.flip()
        clock.tick(60)

    stop_ev.set()
    pygame.quit()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
