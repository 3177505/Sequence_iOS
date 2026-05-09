#!/usr/bin/env python3
import argparse
import os
import shutil
from pathlib import Path

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


def main() -> None:
    p = argparse.ArgumentParser(
        description="Copy all images from a tree into one folder for DreamBooth LoRA (flat list of files).",
    )
    p.add_argument(
        "--src",
        type=Path,
        default=None,
        help="Root folder to walk (e.g. public/4_Research). Default: repository public/4_Research.",
    )
    p.add_argument(
        "--dst",
        type=Path,
        default=None,
        help="Output folder (only image files; overwritten on name clash with numeric suffix).",
    )
    a = p.parse_args()
    here = Path(__file__).resolve().parent
    root = here.parent
    src = a.src or (root / "public" / "4_Research")
    dst = a.dst or (here / "data" / "instance_flat")
    if not src.is_dir():
        raise SystemExit(f"Missing source folder: {src}")
    dst.mkdir(parents=True, exist_ok=True)
    n = 0
    for dirpath, _, files in os.walk(src):
        rel = os.path.relpath(dirpath, src)
        prefix = "" if rel == "." else rel.replace(os.sep, "__") + "__"
        for name in files:
            ext = Path(name).suffix.lower()
            if ext not in IMG_EXT:
                continue
            sfile = Path(dirpath) / name
            base = f"{prefix}{name}"
            out = dst / base
            i = 0
            while out.exists():
                i += 1
                stem = Path(base).stem
                suf = Path(base).suffix
                out = dst / f"{stem}_{i}{suf}"
            shutil.copy2(sfile, out)
            n += 1
    print(f"Copied {n} images to {dst}")


if __name__ == "__main__":
    main()
