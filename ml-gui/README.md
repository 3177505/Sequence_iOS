# Sequence ml-gui (Gradio)

Local-only UI (default `http://127.0.0.1:7860`) for **Train LoRA** and **Generate**. Needs a working **`ml/.venv`** with PyTorch; see `../ml/README.md` (NVIDIA setup first on the GPU box).

**One venv (simplest):** install `gradio` into `ml/.venv` and run:

```bash
cd /path/to/Sequence
./ml/.venv/bin/python ml-gui/app.py
```

Windows: `ml\.venv\Scripts\python.exe ml-gui\app.py` from the repo root.

**Two venvs:** create `ml-gui/.venv` with `pip install -r requirements.txt` (Gradio only), and keep heavy deps in `ml/.venv` — the app still invokes `ml/.venv` for training and generation.

Override port: `SEQUENCE_ML_GUI_PORT=8080`.

Binds to **localhost** only; do not expose to the internet without auth.

Trains by running `ml/launch_train.py` (log tail: `ml/outputs/training-gui.log`). Generate writes under `ml/outputs/gen/`.
