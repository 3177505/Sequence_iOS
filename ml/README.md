# Sequence / ml — LoRA (DreamBooth) + SD 1.5 / SDXL

Command-line training next to the static site. **Not** used by the web server. **Python 3.10+**; use a **NVIDIA GPU** for practical training. CPU and Apple MPS are possible but training will be very slow on CPU.

## 1) NVIDIA machine (recommended path)

1. Install a current **NVIDIA driver** (Windows or Linux) from the vendor site.
2. Create a venv in `ml/`, then install **PyTorch with CUDA** using the [official install commands](https://pytorch.org/get-started/locally/) for your OS (match CUDA / cu1xx to your driver).
3. Install the rest of the stack (same venv):
   ```bash
   cd ml
   # After torch/torchvision from pytorch.org, e.g.:
   pip install -r requirements.txt
   accelerate config
   ```
4. `accelerate config` — one GPU, mixed precision is fine; answer for a normal single-GPU workstation.
5. Quick check:
   ```bash
   python -c "import torch; print('cuda', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"
   ```

## Data

- Training images: tree under `public/4_Research/`.
- `launch_train` flattens that into `ml/data/instance_flat/` (via `collect_instance_images.py`) when needed.
- Optional: per-image `*.txt` sidecars in the flat folder; `zimage_sidecar_captions.py` can create defaults for Ostris / Z-Image (see `zimage-toolkit.html`).

## Train

From the **repository root** (so paths resolve the same on every OS):

| Platform | Command |
|----------|---------|
| macOS / Linux | `./ml/launch_train.sh` (optional: `MAX_TRAIN_STEPS=2000`, `RESUME=1`) |
| Windows (cmd) | `ml\launch_train.bat` (optional: `set MAX_TRAIN_STEPS=2000`, `set RESUME=1`) |
| Any | `ml/.venv` Python: `python ml/launch_train.py` |

- Per-folder Windows path: `research-folder-training.ps1` from repo root (defaults: SDXL, 2000 steps, rank 16, 1024 when using SDXL).
- First run downloads the DreamBooth LoRA script (pinned diffusers tag) into `ml/vendor/`.
- Weights: `ml/outputs/…` (e.g. `lora-run/` or a per-folder slug from the script).
- `RESUME=1` (Unix) or `set RESUME=1` (Windows cmd) continues from the latest checkpoint in that folder.

## Generate

With `ml/.venv` active and `cd ml`:

```bash
python generate.py --base sdxl --lora outputs/lora-run --prompt "a sksseq photograph, …" --out-dir outputs/gen --count 2
```

Omit `--lora` for base model only. Use `--base sd15` for SD 1.5. Defaults: SDXL 1024² ~32 steps CFG ~7; SD1.5 512² ~30 steps.

## Gradio (buttons)

`ml-gui/app.py` — see `../ml-gui/README.md`. Uses the **same** `ml/.venv`.

## Not this pipeline

`public/251205_cc8_gpu_accelator.py` is feature visualization in a classifier, not DreamBooth / LoRA on `4_Research`.

Site: `../ml-manual.html` (jediná textová příručka), `../RUN.md`.
