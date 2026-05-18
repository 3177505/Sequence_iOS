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

export DISPLAY="${DISPLAY:-:0}"

RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
LCK="$RUNDIR/sequence-dual-image-kiosk.lock"
mkdir -p "$RUNDIR"

PY=/opt/sequence/native-kiosk/image_window.py

hide_desktop_panel() {
  [[ "${SEQUENCE_HIDE_DESKTOP_PANEL:-1}" != 1 ]] && return 0
  pkill lxpanel 2>/dev/null || true
  pkill wf-panel-pi 2>/dev/null || true
  pkill lxqt-panel 2>/dev/null || true
}

SENSOR_STATE="${SEQUENCE_NATIVE_SENSOR_STATE:-/tmp/sequence-exhibit-sensor-boost}"
SERIAL="${SEQUENCE_NATIVE_SERIAL_DEVICE:-}"

OPTS_L=( )
OPTS_R=( )
if [[ -n "${SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS:-}" ]]; then
  OPTS_L+=(--interval "${SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS}")
  OPTS_R+=(--interval "${SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS}")
fi
if [[ -n "$SERIAL" ]]; then
  rm -f "$SENSOR_STATE"
  OPTS_L+=(--serial-device "$SERIAL" --sensor-state-out "$SENSOR_STATE")
  OPTS_R+=(--sensor-state-in "$SENSOR_STATE")
fi

(
  flock -n 205 || exit 0

  sleep "${SEQUENCE_DUAL_IMAGE_START_DELAY:-${SEQUENCE_KIOSK_START_DELAY:-12}}"

  mkdir -p "$LEFT" "$RIGHT"

  hide_desktop_panel

  python3 "$PY" --dir "$LEFT" --width "$W_LEFT" --height "$H" --x 0 --y 0 "${OPTS_L[@]}" &
  python3 "$PY" --dir "$RIGHT" --width "$W_RIGHT" --height "$H" --x "$W_LEFT" --y 0 "${OPTS_R[@]}" &
  wait
) 205>"$LCK"
