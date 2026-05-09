@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
if not defined MAX_TRAIN_STEPS set MAX_TRAIN_STEPS=1500
set TOKENIZERS_PARALLELISM=false
if not exist "ml\.venv\Scripts\python.exe" (
  echo Missing ml\.venv — create it and install requirements. See ml\README.md
  exit /b 1
)
call "ml\.venv\Scripts\python.exe" "ml\launch_train.py"
if errorlevel 1 exit /b 1
echo Done. LoRA weights: %CD%\ml\outputs\lora-run
endlocal
