#!/usr/bin/env python3
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Tuple

import gradio as gr

SEQUENCE_ROOT = Path(__file__).resolve().parent.parent
ML = SEQUENCE_ROOT / "ml"
LOG_PATH = ML / "outputs" / "training-gui.log"


def ml_venv_python() -> Path:
    if sys.platform == "win32":
        return ML / ".venv" / "Scripts" / "python.exe"
    p = ML / ".venv" / "bin" / "python3"
    if p.is_file():
        return p
    return ML / ".venv" / "bin" / "python"


def tail_log(max_lines: int = 80) -> str:
    if not LOG_PATH.is_file():
        return "No log yet. Start training or check ml/outputs/training-gui.log."
    try:
        lines = LOG_PATH.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(lines[-max_lines:])
    except OSError as e:
        return f"Could not read log: {e}"


_train_proc = None


def start_training(max_steps: int, resume: bool) -> Tuple[str, str]:
    global _train_proc
    py = ml_venv_python()
    if not py.is_file():
        m = "Error: ml/.venv not found. On Windows: cd ml && py -3 -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt"
        return m, m
    if _train_proc is not None and _train_proc.poll() is None:
        m = "Training already running. Stop it from the terminal or wait until it finishes."
        return m, tail_log()

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "MAX_TRAIN_STEPS": str(int(max_steps))}
    if resume:
        env["RESUME"] = "1"
    else:
        env.pop("RESUME", None)
    logf = open(LOG_PATH, "a", encoding="utf-8")
    logf.write(f"\n--- start {time.strftime('%Y-%m-%d %H:%M:%S')} steps={max_steps} resume={resume} ---\n")
    logf.flush()
    _train_proc = subprocess.Popen(
        [str(py), str(ML / "launch_train.py")],
        cwd=str(SEQUENCE_ROOT),
        env=env,
        stdout=logf,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
    )

    def wait_done() -> None:
        global _train_proc
        code = _train_proc.wait()
        logf.write(f"\n--- exit code {code} ---\n")
        logf.close()
        _train_proc = None

    threading.Thread(target=wait_done, daemon=True).start()
    msg = f"Started training (PID {_train_proc.pid}). Log: {LOG_PATH}. Log refreshes every 5s below."
    return msg, tail_log()


def run_generate(prompt: str, negative: str, count: int, use_lora: bool) -> tuple:
    py = ml_venv_python()
    if not py.is_file():
        return None, "ml/.venv missing — create the environment in the ml folder first."
    out_dir = ML / "outputs" / "gen"
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(py),
        str(ML / "generate.py"),
        "--prompt",
        prompt.strip() or "a sksseq photograph",
        "--out-dir",
        str(out_dir),
        "--count",
        str(int(count)),
    ]
    if negative.strip():
        cmd.extend(["--negative", negative.strip()])
    lora_dir = ML / "outputs" / "lora-run"
    if use_lora and lora_dir.is_dir() and any(p.is_file() for p in lora_dir.rglob("*")):
        cmd.extend(["--lora", str(lora_dir)])
    elif use_lora:
        return None, "LoRA folder is empty — train first or uncheck Use LoRA."
    r = subprocess.run(cmd, cwd=str(SEQUENCE_ROOT), capture_output=True, text=True)
    if r.returncode != 0:
        return None, (r.stderr or r.stdout or "generate failed")[-4000:]
    imgs = sorted(out_dir.glob("out_*.png"))
    paths = [str(p) for p in imgs[-int(count) :]]
    if not paths:
        return None, r.stdout or "No PNGs written."
    return paths, r.stdout or "Done."


def build_ui() -> gr.Blocks:
    with gr.Blocks(title="Sequence ML") as demo:
        gr.Markdown(
            "## Sequence — local ML (browser UI)\n"
            "Uses the **same** `ml/` venv and scripts as the terminal. "
            "Training is slow on **CPU**; use an **NVIDIA GPU** on Windows for realistic speed."
        )
        with gr.Tab("Train LoRA"):
            steps = gr.Number(value=200, minimum=10, maximum=5000, step=10, label="max_train_steps (use 200–400 on slow CPU)")
            resume = gr.Checkbox(label="Resume from latest checkpoint (if any)", value=False)
            start = gr.Button("Start training", variant="primary")
            train_status = gr.Textbox(label="Status", lines=2)
            log = gr.Textbox(label="Log (tail)", lines=24, max_lines=30)
            start.click(start_training, [steps, resume], [train_status, log])

            def refresh_log() -> str:
                return tail_log()

            gr.Button("Refresh log").click(refresh_log, outputs=log)
        with gr.Tab("Generate images"):
            prompt = gr.Textbox(label="Prompt", lines=2, value="a sksseq photograph, research mood, detailed")
            neg = gr.Textbox(label="Negative prompt (optional)", lines=1)
            count = gr.Number(value=2, minimum=1, maximum=8, step=1, label="How many images")
            use_lora = gr.Checkbox(label="Use LoRA (ml/outputs/lora-run)", value=True)
            go = gr.Button("Generate", variant="primary")
            out_im = gr.Image(label="First image", type="filepath")
            out_gal = gr.Gallery(label="All", columns=2, height=400)
            status = gr.Textbox(label="Output / errors")

            def _gen(p, n, c, u):
                paths, msg = run_generate(p, n, c, u)
                if not paths:
                    return None, None, msg or "Error"
                return paths[0], paths, msg

            go.click(_gen, [prompt, neg, count, use_lora], [out_im, out_gal, status])

        gr.Markdown(
            f"Repository root: `{SEQUENCE_ROOT}` · "
            f"Read `ml-gui/README.md` for Windows setup."
        )
        demo.load(tail_log, None, log, every=5)
    return demo


if __name__ == "__main__":
    port = int(os.environ.get("SEQUENCE_ML_GUI_PORT", "7860"))
    build_ui().launch(server_name="127.0.0.1", server_port=port, inbrowser=True)
