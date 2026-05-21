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

W="${SEQUENCE_WINDOW_WIDTH:-3840}"
H="${SEQUENCE_WINDOW_HEIGHT:-1080}"
W_LEFT="${SEQUENCE_MONITOR_LEFT_WIDTH:-$(( W / 2 ))}"
W_RIGHT=$(( W - W_LEFT ))
[[ "$W_RIGHT" -lt 1 ]] && W_RIGHT=1
[[ "$W_LEFT" -lt 1 ]] && W_LEFT=1
X_LEFT="${SEQUENCE_MONITOR_LEFT_X:-0}"
X_RIGHT="${SEQUENCE_MONITOR_RIGHT_X:-$W_LEFT}"

export DISPLAY="${DISPLAY:-:0}"

RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
LCK="$RUNDIR/sequence-dual-image-kiosk.lock"
mkdir -p "$RUNDIR"

PY=/opt/sequence/native-kiosk/exhibit_dual_kiosk.py
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

  DETECT="${SEQUENCE_DETECT_DISPLAY_SCRIPT:-/usr/local/bin/sequence-detect-dual-display.sh}"
  if [[ "${SEQUENCE_AUTO_DETECT_DISPLAY:-1}" == 1 && -x "$DETECT" ]]; then
    if detected="$("$DETECT" --export 2>/dev/null)"; then
      eval "$detected"
      W="${SEQUENCE_WINDOW_WIDTH:-$W}"
      H="${SEQUENCE_WINDOW_HEIGHT:-$H}"
      W_LEFT="${SEQUENCE_MONITOR_LEFT_WIDTH:-$W_LEFT}"
      X_LEFT="${SEQUENCE_MONITOR_LEFT_X:-$X_LEFT}"
      X_RIGHT="${SEQUENCE_MONITOR_RIGHT_X:-$X_RIGHT}"
      W_RIGHT=$(( W - W_LEFT ))
      [[ "$W_RIGHT" -lt 1 ]] && W_RIGHT=1
    fi
  fi

  export SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-x11}"

  hide_desktop_panel

  export SEQUENCE_WINDOW_WIDTH="$W"
  export SEQUENCE_WINDOW_HEIGHT="$H"
  export SEQUENCE_MONITOR_LEFT_WIDTH="$W_LEFT"
  export SEQUENCE_MONITOR_LEFT_X="$X_LEFT"
  export SEQUENCE_MONITOR_RIGHT_X="$X_RIGHT"
  export SEQUENCE_DUAL_IMAGE_DIR_LEFT="$LEFT"
  export SEQUENCE_DUAL_IMAGE_DIR_RIGHT="$RIGHT"
  export SEQUENCE_SITE_DIR="$REP"

  rm -f "$RUNDIR/sequence-exhibit-sync.json"

  python3 "$PY" --pane left &
  LPID=$!
  sleep 0.5
  python3 "$PY" --pane right &
  RPID=$!
  wait "$LPID" "$RPID" || true

  restore_desktop_panel
) 205>"$LCK"
