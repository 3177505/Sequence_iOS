#!/usr/bin/env python3
import argparse
from pathlib import Path

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
DEFAULT_CAP = "a sksseq research photograph, detailed"


def main() -> None:
    p = argparse.ArgumentParser(
        description="Create missing .txt captions next to images (Ostris-style sidecar).",
    )
    p.add_argument(
        "--dir",
        type=Path,
        required=True,
        help="Folder with images (flat list).",
    )
    p.add_argument(
        "--text",
        default=DEFAULT_CAP,
        help="Caption line to write in each new .txt file.",
    )
    a = p.parse_args()
    d: Path = a.dir
    if not d.is_dir():
        raise SystemExit(f"Not a directory: {d}")
    n = 0
    for f in d.iterdir():
        if not f.is_file() or f.suffix.lower() not in IMG_EXT:
            continue
        t = f.with_suffix(".txt")
        if t.is_file():
            continue
        t.write_text(a.text.strip() + "\n", encoding="utf-8")
        n += 1
    print(f"wrote {n} new .txt file(s) in {d}")


if __name__ == "__main__":
    main()
