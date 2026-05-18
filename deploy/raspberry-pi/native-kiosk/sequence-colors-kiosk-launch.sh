#!/usr/bin/env bash
set -euo pipefail

CFG=/etc/sequence/kiosk.conf
if [[ -f "$CFG" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$CFG"
  set +a
fi

RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
LCK="$RUNDIR/sequence-colors-kiosk.lock"
mkdir -p "$RUNDIR"
export SEQUENCE_WINDOW_WIDTH="${SEQUENCE_WINDOW_WIDTH:-1600}"
export SEQUENCE_WINDOW_HEIGHT="${SEQUENCE_WINDOW_HEIGHT:-480}"

export DISPLAY="${DISPLAY:-:0}"

(
  flock -n 203 || exit 0
  exec python3 "/opt/sequence/native-kiosk/sequence_colors_kiosk.py"
) 203>"$LCK"
