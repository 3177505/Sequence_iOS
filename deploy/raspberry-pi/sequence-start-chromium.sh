#!/usr/bin/env bash
set -euo pipefail

CFG=/etc/sequence/kiosk.conf
if [[ -f "$CFG" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$CFG"
  set +a
fi

PORT="${SEQUENCE_HTTP_PORT:-3000}"
W="${SEQUENCE_WINDOW_WIDTH:-1600}"
H="${SEQUENCE_WINDOW_HEIGHT:-480}"
DEFAULT_URL_LEFT="http://127.0.0.1:${PORT}/exhibit-left.html?kiosk=1"
URL_LEFT="${SEQUENCE_START_URL:-$DEFAULT_URL_LEFT}"
MAXWAIT="${SEQUENCE_HTTP_WAIT_SECONDS:-240}"
URL_RIGHT_RAW="${SEQUENCE_START_URL_RIGHT:-}"

append_serial_query() {
  local u="$1"
  [[ -z "$u" ]] && { echo ""; return; }
  [[ "$u" == *serialVid=* ]] && { echo "$u"; return; }
  [[ -z "${SEQUENCE_WEB_SERIAL_VID_HEX:-}" || -z "${SEQUENCE_WEB_SERIAL_PID_HEX:-}" ]] && { echo "$u"; return; }
  local q="serialVid=${SEQUENCE_WEB_SERIAL_VID_HEX}&serialPid=${SEQUENCE_WEB_SERIAL_PID_HEX}"
  if [[ "$u" == *\?* ]]; then echo "${u}&${q}"; else echo "${u}?${q}"; fi
}

URL_LEFT=$(append_serial_query "$URL_LEFT")
URL_RIGHT_RAW=$(append_serial_query "$URL_RIGHT_RAW")

RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
LCK="$RUNDIR/sequence-chromium-kiosk.lock"
mkdir -p "$RUNDIR"

tcp_open() {
  bash -c "exec 88<>/dev/tcp/127.0.0.1/$PORT" >/dev/null 2>&1
}

notify_seq() {
  [[ "${SEQUENCE_QUIET_NOTIFY:-0}" == 1 ]] && return 0
  command -v notify-send >/dev/null 2>&1 || return 0
  export DISPLAY="${DISPLAY:-:0}"
  notify-send -a "Sequence" -t 10000 "$1" "$2" 2>/dev/null || true
}

(
  flock -n 200 || exit 0

  export DISPLAY="${DISPLAY:-:0}"
  [[ -z "${XAUTHORITY:-}" && -f "${HOME}/.Xauthority" ]] && export XAUTHORITY="${HOME}/.Xauthority"

  LOG="${SEQUENCE_KIOSK_LOG:-$HOME/.local/share/sequence-kiosk-chromium.log}"
  mkdir -p "$(dirname "$LOG")"
  exec >>"$LOG" 2>&1
  echo "$(date -Is) sequence-start-chromium start uid=$(id -u) DISPLAY=${DISPLAY}"

  PROFILE="${SEQUENCE_USER_DATA_DIR:-$HOME/.local/share/sequence-chromium-kiosk}"
  mkdir -p "$PROFILE"

  notify_seq "Updating" "Waiting for localhost:${PORT} — git pull and npm build run in the background (first boot can take several minutes)."

  READY=0
  for ((i = 0; i < MAXWAIT; i++)); do
    if tcp_open; then READY=1; break; fi
    sleep 1
  done
  if [[ "$READY" -eq 1 ]]; then
    if [[ -n "$URL_RIGHT_RAW" ]]; then
      notify_seq "Ready" "Site is up — opening two full-screen setups (left + right HDMI)."
    else
      notify_seq "Ready" "Site is up — opening Sequence (one window)."
    fi
  else
    notify_seq "Timeout" "No response on :${PORT} after ${MAXWAIT}s — opening browser anyway. Check: journalctl -u sequence-site.service"
  fi

  sleep "${SEQUENCE_KIOSK_START_DELAY:-10}"

  CHR=""
  for c in /usr/bin/chromium-browser /usr/bin/chromium /snap/bin/chromium; do
    [[ -x "$c" ]] && CHR="$c" && break
  done
  if [[ -z "$CHR" ]] && command -v chromium-browser >/dev/null 2>&1; then
    CHR=$(command -v chromium-browser)
  fi
  if [[ -z "$CHR" ]] && command -v chromium >/dev/null 2>&1; then
    CHR=$(command -v chromium)
  fi
  if [[ -z "$CHR" ]]; then
    echo "sequence-start-chromium: no Chromium found. Install: sudo apt update && sudo apt install -y chromium-browser || sudo apt install -y chromium" >&2
    exit 1
  fi

  CHROME_KIOSK_FLAGS=(
    --password-store=basic
    --no-first-run
    --disable-infobars
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --noerrdialogs
  )
  if [[ "${SEQUENCE_CHROMIUM_USE_X11_OZONE:-0}" == 1 ]]; then
    CHROME_KIOSK_FLAGS+=(--ozone-platform=x11)
    echo "$(date -Is) chromium: SEQUENCE_CHROMIUM_USE_X11_OZONE=1 (--ozone-platform=x11)"
  fi

  spawn_one() {
    local prof="$1" x="$2" y="$3" ww="$4" hh="$5" url="$6"
    mkdir -p "$prof"
    "$CHR" \
      --user-data-dir="$prof" \
      "${CHROME_KIOSK_FLAGS[@]}" \
      --app="$url" \
      --window-position="${x},${y}" \
      --window-size="${ww},${hh}" \
      &
  }

  if [[ -n "$URL_RIGHT_RAW" ]]; then
    W_LEFT="${SEQUENCE_MONITOR_LEFT_WIDTH:-$(( W / 2 ))}"
    W_RIGHT=$(( W - W_LEFT ))
    if [[ "$W_RIGHT" -lt 1 ]]; then W_RIGHT=1; fi
    if [[ "$W_LEFT" -lt 1 ]]; then W_LEFT=1; fi
    PROF_L="${SEQUENCE_USER_DATA_DIR_LEFT:-$HOME/.local/share/sequence-chromium-kiosk-L}"
    PROF_R="${SEQUENCE_USER_DATA_DIR_RIGHT:-$HOME/.local/share/sequence-chromium-kiosk-R}"
    spawn_one "$PROF_L" 0 0 "$W_LEFT" "$H" "$URL_LEFT"
    spawn_one "$PROF_R" "$W_LEFT" 0 "$W_RIGHT" "$H" "$URL_RIGHT_RAW"
    wait
    exit 0
  fi

  exec "$CHR" \
    --user-data-dir="$PROFILE" \
    "${CHROME_KIOSK_FLAGS[@]}" \
    --app="$URL_LEFT" \
    --window-position=0,0 \
    --window-size="${W},${H}"

) 200>"$LCK"
