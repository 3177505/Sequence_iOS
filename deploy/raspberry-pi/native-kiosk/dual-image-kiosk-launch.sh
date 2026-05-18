#!/usr/bin/env bash
set -euo pipefail

CFG=/etc/sequence/kiosk.conf
if [[ -f "$CFG" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$CFG"
  set +a
fi

REP="${SEQUENCE_SITE_DIR:-$HOME/Sequence_IOS}"
LEFT="${SEQUENCE_DUAL_IMAGE_DIR_LEFT:-$REP/public/exhibit-left}"
RIGHT="${SEQUENCE_DUAL_IMAGE_DIR_RIGHT:-$REP/public/exhibit-right}"

W="${SEQUENCE_WINDOW_WIDTH:-1600}"
H="${SEQUENCE_WINDOW_HEIGHT:-480}"
W_LEFT="${SEQUENCE_MONITOR_LEFT_WIDTH:-$(( W / 2 ))}"
W_RIGHT=$(( W - W_LEFT ))
[[ "$W_RIGHT" -lt 1 ]] && W_RIGHT=1
[[ "$W_LEFT" -lt 1 ]] && W_LEFT=1

INT="${SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS:-8}"

export DISPLAY="${DISPLAY:-:0}"

RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
LCK="$RUNDIR/sequence-dual-image-kiosk.lock"
mkdir -p "$RUNDIR"

PY=/opt/sequence/native-kiosk/image_window.py

(
  flock -n 205 || exit 0

  sleep "${SEQUENCE_DUAL_IMAGE_START_DELAY:-${SEQUENCE_KIOSK_START_DELAY:-12}}"

  mkdir -p "$LEFT" "$RIGHT"

  python3 "$PY" --dir "$LEFT" --width "$W_LEFT" --height "$H" --x 0 --y 0 --interval "$INT" &
  python3 "$PY" --dir "$RIGHT" --width "$W_RIGHT" --height "$H" --x "$W_LEFT" --y 0 --interval "$INT" &
  wait
) 205>"$LCK"
