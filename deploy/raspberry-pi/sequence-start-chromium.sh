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
URL="${SEQUENCE_START_URL:-http://127.0.0.1:${PORT}/index.html?kiosk=1}"
MAXWAIT="${SEQUENCE_HTTP_WAIT_SECONDS:-240}"

RUNDIR="${XDG_RUNTIME_DIR:-/tmp}"
LCK="$RUNDIR/sequence-chromium-kiosk.lock"
mkdir -p "$RUNDIR"

tcp_open() {
  bash -c "exec 88<>/dev/tcp/127.0.0.1/$PORT" >/dev/null 2>&1
}

(
  flock -n 200 || exit 0

  PROFILE="${SEQUENCE_USER_DATA_DIR:-$HOME/.local/share/sequence-chromium-kiosk}"
  mkdir -p "$PROFILE"

  for ((i = 0; i < MAXWAIT; i++)); do
    tcp_open && break
    sleep 1
  done

  CHR=""
  for c in /usr/bin/chromium-browser /usr/bin/chromium /snap/bin/chromium; do
    [[ -x "$c" ]] && CHR="$c" && break
  done
  [[ -n "$CHR" ]] || exit 1

  exec "$CHR" \
    --user-data-dir="$PROFILE" \
    --app="$URL" \
    --window-position=0,0 \
    --window-size="${W},${H}" \
    --no-first-run \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --noerrdialogs

) 200>"$LCK"
