#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKETCH_DIR="$SCRIPT_DIR/exhibit_sensor"
FQBN="${ARDUINO_FQBN:-arduino:avr:nano:cpu=atmega328}"

say() {
  printf '%s\n' "$*" >&2
}

die() {
  say "$*"
  exit 1
}

ensure_arduino_cli() {
  if command -v arduino-cli >/dev/null 2>&1; then
    return 0
  fi
  die "arduino-cli missing. Examples:
  • macOS: brew install arduino-cli
  • Linux Pi: sudo apt-get update && sudo apt-get install -y arduino-cli || curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh"
}

ensure_avr_core() {
  ensure_arduino_cli
  arduino-cli config init >/dev/null 2>&1 || true
  local out=""
  out="$(arduino-cli core list 2>/dev/null || true)"
  if grep -qF arduino:avr <<<"$out"; then
    return 0
  fi
  arduino-cli core update-index
  arduino-cli core install arduino:avr
}

usage() {
  say "Prefab sketch (D2 OUT, 5V, GND, 115200): $SKETCH_DIR"
  say "FQBN=${FQBN}  |  Older Nano bootloader: export ARDUINO_FQBN=arduino:avr:nano:cpu=atmega328old"
  say ""
  say "Usage:"
  say "  $0                  This help (+ board list if arduino-cli is installed)"
  say "  $0 list             arduino-cli board list"
  say "  $0 compile-only     Compile only"
  say "  $0 SERIAL_PORT       Compile + upload (e.g. /dev/ttyUSB0 or /dev/cu.usbserial-*)"
}

if [[ ! -f "$SKETCH_DIR/exhibit_sensor.ino" ]]; then
  die "Missing $SKETCH_DIR/exhibit_sensor.ino"
fi

CMD="${1:-}"

if [[ -z "$CMD" ]] || [[ "$CMD" == "-h" ]] || [[ "$CMD" == "--help" ]]; then
  usage
  if command -v arduino-cli >/dev/null 2>&1; then
    say ""
    arduino-cli board list || true
  fi
  exit 0
fi

if [[ "$CMD" == "list" ]]; then
  ensure_avr_core
  arduino-cli board list
  exit 0
fi

if [[ "$CMD" == "compile-only" ]]; then
  ensure_avr_core
  arduino-cli compile --fqbn "$FQBN" "$SKETCH_DIR"
  say "compiled ok"
  exit 0
fi

PORT="$CMD"
[[ -e "$PORT" ]] || die "Serial port does not exist: $PORT"

ensure_avr_core
arduino-cli compile --fqbn "$FQBN" "$SKETCH_DIR"
arduino-cli upload -p "$PORT" --fqbn "$FQBN" "$SKETCH_DIR"

say "upload ok — on the Pi set SEQUENCE_NATIVE_SERIAL_DEVICE if the tty name changed."
