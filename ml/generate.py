#!/usr/bin/env python3
import argparse
import os
import random
import sys
from pathlib import Path

import torch
from diffusers import DPMSolverMultistepScheduler, StableDiffusionPipeline, StableDiffusionXLPipeline


def pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def base_from_env() -> str:
    v = (os.environ.get("SEQUENCE_BASE_MODEL") or "sd15").strip().lower()
    if v in ("sdxl", "xl", "sd-xl"):
        return "sdxl"
    return "sd15"


def main() -> None:
    p = argparse.ArgumentParser(description="Text-to-image: SD 1.5 or SDXL + optional LoRA.")
    p.add_argument(
        "--base",
        choices=["sd15", "sdxl"],
        default=base_from_env(),
        help="Model family. SDXL needs LoRA trained with SEQUENCE_BASE_MODEL=sdxl. Or set env SEQUENCE_BASE_MODEL.",
    )
    p.add_argument(
        "--pretrained",
        type=str,
        default=None,
        help="Base model id (default: SD1.5 or SDXL base per --base).",
    )
    p.add_argument(
        "--lora",
        type=str,
        default=None,
        help="Path to LoRA folder or .safetensors from training.",
    )
    p.add_argument("--prompt", type=str, required=True)
    p.add_argument(
        "--negative",
        type=str,
        default="",
        help="Optional negative prompt.",
    )
    p.add_argument("--out-dir", type=Path, default=Path("outputs/gen"))
    p.add_argument("--count", type=int, default=1, help="How many images to sample.")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument(
        "--steps",
        type=int,
        default=None,
        help="Inference steps. Default: 32 (sdxl) or 30 (sd15).",
    )
    p.add_argument(
        "--width",
        type=int,
        default=None,
        help="Image width. Default: 1024 (sdxl) or 512 (sd15).",
    )
    p.add_argument(
        "--height",
        type=int,
        default=None,
        help="Image height. Default: 1024 (sdxl) or 512 (sd15).",
    )
    p.add_argument(
        "--guidance",
        type=float,
        default=None,
        help="CFG scale. Default: 7.0 (sdxl) or 7.5 (sd15).",
    )
    a = p.parse_args()
    if a.pretrained is None:
        a.pretrained = (
            "stabilityai/stable-diffusion-xl-base-1.0"
            if a.base == "sdxl"
            else "runwayml/stable-diffusion-v1-5"
        )
    steps = a.steps
    if steps is None:
        steps = 32 if a.base == "sdxl" else 30
    guidance = a.guidance
    if guidance is None:
        guidance = 7.0 if a.base == "sdxl" else 7.5
    w = a.width
    h = a.height
    if w is None:
        w = 1024 if a.base == "sdxl" else 512
    if h is None:
        h = 1024 if a.base == "sdxl" else 512
    dev = pick_device()
    dtype = torch.float16 if dev in ("cuda", "mps") else torch.float32
    if a.base == "sdxl":
        load_kw = {"torch_dtype": dtype, "use_safetensors": True}
        if dev == "cuda":
            load_kw["variant"] = "fp16"
        pipe = StableDiffusionXLPipeline.from_pretrained(a.pretrained, **load_kw)
    else:
        pipe = StableDiffusionPipeline.from_pretrained(
            a.pretrained,
            torch_dtype=dtype,
            safety_checker=None,
        )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    if a.lora:
        pipe.load_lora_weights(a.lora)
    pipe = pipe.to(dev)
    if a.base == "sdxl" and dev == "cuda":
        try:
            pipe.enable_vae_slicing()
        except Exception:
            pass
    a.out_dir.mkdir(parents=True, exist_ok=True)
    seed = a.seed
    for i in range(a.count):
        g = torch.Generator(device=dev)
        if seed is None:
            s = random.randint(0, 2**31 - 1)
        else:
            s = seed + i
        g.manual_seed(s)
        kwargs = {
            "prompt": a.prompt,
            "num_inference_steps": steps,
            "guidance_scale": guidance,
            "generator": g,
            "width": w,
            "height": h,
        }
        if a.negative:
            kwargs["negative_prompt"] = a.negative
        try:
            out = pipe(**kwargs)
        except Exception as e:
            print("Inference failed:", e, file=sys.stderr)
            if dev == "mps":
                print(
                    "On some macOS / MPS builds, long prompts or memory spikes can fail; try --steps 20 or a smaller resolution pipeline.",
                    file=sys.stderr,
                )
            raise
        im = out.images[0]
        path = a.out_dir / f"out_{i:02d}.png"
        im.save(path)
        print(path)


if __name__ == "__main__":
    main()
