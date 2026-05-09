#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAX_ST="${MAX_TRAIN_STEPS:-1500}"
export MAX_TRAIN_STEPS="${MAX_ST}"
echo "max_train_steps=${MAX_ST} (e.g. MAX_TRAIN_STEPS=200 $0)"
if [[ -n "${RESUME:-}" ]]; then
  echo "Resuming: RESUME=1"
  export RESUME=1
else
  unset RESUME
fi
export TOKENIZERS_PARALLELISM=false
cd "${ROOT}"
python3 "${ROOT}/ml/launch_train.py"
echo "Done. LoRA weights: ${ROOT}/ml/outputs/lora-run"
