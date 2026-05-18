#!/usr/bin/env python3
import argparse
import os
import sys
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--height", type=int, required=True)
    ap.add_argument("--x", type=int, default=0)
    ap.add_argument("--y", type=int, default=0)
    ap.add_argument("--interval", type=float, default=8.0)
    args = ap.parse_args()

    d = Path(args.dir)
    os.environ["SDL_VIDEO_WINDOW_POS"] = f"{args.x},{args.y}"

    pygame.init()
    screen = pygame.display.set_mode((args.width, args.height))
    pygame.display.set_caption("Sequence exhibit")

    paths = collect_images(d)
    cache = {}
    idx = 0
    next_ms = 0
    clock = pygame.time.Clock()
    running = True
    surf = None

    def load(path):
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

    while running:
        now = pygame.time.get_ticks()
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                running = False
            elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                running = False

        if paths:
            if now >= next_ms or surf is None:
                p = paths[idx % len(paths)]
                idx += 1
                surf = load(p)
                next_ms = now + int(max(1.0, args.interval) * 1000)

        screen.fill((20, 22, 26))
        if surf:
            screen.blit(surf, (0, 0))
        pygame.display.flip()
        clock.tick(12)

    pygame.quit()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
