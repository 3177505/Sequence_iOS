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
HID="${SEQUENCE_HIDE_DESKTOP_PANEL_SCRIPT:-/usr/local/bin/sequence-hide-desktop-panel.sh}"

hide_desktop_panel() {
  [[ "${SEQUENCE_HIDE_DESKTOP_PANEL:-1}" != 1 ]] && return 0
  if [[ -x "$HID" ]]; then
    bash "$HID"
    return 0
  fi
  pkill lxpanel 2>/dev/null || true
  pkill wf-panel-pi 2>/dev/null || true
  pkill lxqt-panel 2>/dev/null || true
}

restore_desktop_panel() {
  [[ "${SEQUENCE_HIDE_DESKTOP_PANEL:-1}" != 1 ]] && return 0
  export DISPLAY="${DISPLAY:-:0}"
  if command -v wf-panel-pi >/dev/null 2>&1 && ! pgrep -x wf-panel-pi >/dev/null 2>&1; then
    nohup wf-panel-pi >/dev/null 2>&1 &
  fi
  if command -v lxqt-panel >/dev/null 2>&1 && ! pgrep -x lxqt-panel >/dev/null 2>&1; then
    nohup lxqt-panel >/dev/null 2>&1 &
  fi
  if command -v lxpanel >/dev/null 2>&1 && ! pgrep -x lxpanel >/dev/null 2>&1; then
    nohup lxpanel >/dev/null 2>&1 &
  fi
}

(
  flock -n 205 || exit 0

  sleep "${SEQUENCE_DUAL_IMAGE_START_DELAY:-${SEQUENCE_KIOSK_START_DELAY:-12}}"

  mkdir -p "$LEFT" "$RIGHT"

  hide_desktop_panel

  python3 "$PY" --dir "$LEFT" --width "$W_LEFT" --height "$H" --x 0 --y 0 --interval "$INT" &
  python3 "$PY" --dir "$RIGHT" --width "$W_RIGHT" --height "$H" --x "$W_LEFT" --y 0 --interval "$INT" &
  wait

  restore_desktop_panel
) 205>"$LCK"
