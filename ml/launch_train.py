#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

TAG = "v0.32.0"
DIFFUSERS = f"https://raw.githubusercontent.com/huggingface/diffusers/{TAG}/examples/dreambooth"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def ml_venv_python(ml: Path) -> Path:
    if sys.platform == "win32":
        p = ml / ".venv" / "Scripts" / "python.exe"
    else:
        p = ml / ".venv" / "bin" / "python3"
        if not p.is_file():
            p = ml / ".venv" / "bin" / "python"
    return p


def normalize_base() -> str:
    v = (os.environ.get("SEQUENCE_BASE_MODEL") or "sd15").strip().lower()
    if v in ("sdxl", "xl", "sd-xl"):
        return "sdxl"
    return "sd15"


def main() -> None:
    root = repo_root()
    ml = root / "ml"
    py = ml_venv_python(ml)
    if not py.is_file():
        print("Missing ml/.venv. Create it: cd ml && python -m venv .venv && pip install -r requirements.txt", file=sys.stderr)
        sys.exit(1)
    base = normalize_base()
    vendor = ml / "vendor"
    if base == "sdxl":
        train_script = vendor / "train_dreambooth_lora_sdxl.py"
        vendor_url = f"{DIFFUSERS}/train_dreambooth_lora_sdxl.py"
    else:
        train_script = vendor / "train_dreambooth_lora.py"
        vendor_url = f"{DIFFUSERS}/train_dreambooth_lora.py"
    instance_src = Path(os.environ.get("SEQUENCE_COLLECT_SRC", str(root / "public" / "4_Research")))
    if not instance_src.is_absolute():
        instance_src = (root / instance_src).resolve()
    instance_flat = ml / "data" / "instance_flat"
    lora_out_env = os.environ.get("SEQUENCE_LORA_OUT", "").strip()
    if lora_out_env:
        out = Path(lora_out_env)
        if not out.is_absolute():
            out = (root / out).resolve()
    else:
        out = (ml / "outputs" / "lora-run").resolve()
    instance_prompt = os.environ.get(
        "INSTANCE_PROMPT",
        "a sksseq photograph from the Sequence research set",
    )
    pretrained = os.environ.get("SEQUENCE_PRETRAINED", "").strip()
    if not pretrained:
        pretrained = (
            "stabilityai/stable-diffusion-xl-base-1.0"
            if base == "sdxl"
            else "runwayml/stable-diffusion-v1-5"
        )

    vendor.mkdir(parents=True, exist_ok=True)
    if not train_script.is_file():
        name = "SDXL" if base == "sdxl" else "SD1.5"
        print(f"Downloading DreamBooth LoRA trainer ({name}, {TAG})…")
        req = urllib.request.Request(vendor_url, headers={"User-Agent": "Sequence-ml/1.0"})
        with urllib.request.urlopen(req) as r:
            train_script.write_bytes(r.read())

    def flat_ready() -> bool:
        if not instance_flat.is_dir():
            return False
        for p in instance_flat.iterdir():
            if p.is_file() and p.name != ".gitkeep":
                return True
        return False

    if os.environ.get("SEQUENCE_REBUILD_FLAT", "").strip() and instance_flat.is_dir():
        for p in instance_flat.iterdir():
            if p.is_file() and p.name != ".gitkeep":
                p.unlink()

    if not flat_ready() and instance_src.is_dir():
        print(f"Preparing flat instance folder from {instance_src}…")
        subprocess.check_call(
            [str(py), str(ml / "collect_instance_images.py"), "--src", str(instance_src), "--dst", str(instance_flat)],
            cwd=root,
        )

    mixed = "no"
    if shutil.which("nvidia-smi"):
        mixed = "fp16"

    max_steps = int(os.environ.get("MAX_TRAIN_STEPS", "1500"))
    lora_rank = int(os.environ.get("SEQUENCE_LORA_RANK", "8"))
    train_batch = int(os.environ.get("SEQUENCE_TRAIN_BATCH", "1"))
    lr = os.environ.get("SEQUENCE_LEARNING_RATE", "1e-4").strip() or "1e-4"
    res_env = os.environ.get("SEQUENCE_RESOLUTION", "").strip()
    if res_env:
        resolution = int(res_env)
    else:
        resolution = 1024 if base == "sdxl" else 512
    resume = bool(os.environ.get("RESUME", "").strip())
    out.mkdir(parents=True, exist_ok=True)
    print(f"base_model={base}  pretrained={pretrained}")
    print(f"Output directory: {out}")
    print(f"max_train_steps={max_steps} rank={lora_rank} train_batch_size={train_batch} resolution={resolution} lr={lr}")
    if resume:
        print(f"Resuming from latest checkpoint in {out}")
    acc_cmd = [str(py), "-m", "accelerate.commands.launch"]
    args: list[str] = acc_cmd + [
        str(train_script),
        f"--pretrained_model_name_or_path={pretrained}",
        f"--instance_data_dir={instance_flat}",
        f"--output_dir={out}",
        f"--instance_prompt={instance_prompt}",
        f"--resolution={resolution}",
        "--center_crop",
        f"--train_batch_size={train_batch}",
        "--gradient_accumulation_steps=1",
        "--gradient_checkpointing",
        f"--max_train_steps={max_steps}",
        f"--learning_rate={lr}",
        "--lr_scheduler=constant",
        "--lr_warmup_steps=0",
        f"--mixed_precision={mixed}",
        f"--rank={lora_rank}",
        "--checkpointing_steps=200",
        "--report_to=tensorboard",
    ]
    if base == "sdxl" and torch_cuda_and_fp16():
        args.append("--variant=fp16")
    if resume:
        args.append("--resume_from_checkpoint=latest")
    env = {**os.environ, "TOKENIZERS_PARALLELISM": "false"}
    os.chdir(root)
    subprocess.check_call(args, env=env)
    print(f"Done. LoRA weights under: {out}")


def torch_cuda_and_fp16() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


if __name__ == "__main__":
    main()
