#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Usage: cd into your Sequence_iOS repo, then: sudo ./deploy/raspberry-pi/install-boot-after-pull.sh" >&2
  exit 1
fi

REPODIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export SEQUENCE_SITE_DIR="${SEQUENCE_SITE_DIR:-$REPODIR}"
export SEQUENCE_SERVICE_USER="${SEQUENCE_SERVICE_USER:-$(awk -F: '$3==1000{print $1;exit}' /etc/passwd)}"
SEQUENCE_SERVICE_USER="${SEQUENCE_SERVICE_USER:-pi}"
export SEQUENCE_HTTP_PORT="${SEQUENCE_HTTP_PORT:-3000}"
export SEQUENCE_WINDOW_WIDTH="${SEQUENCE_WINDOW_WIDTH:-1600}"
export SEQUENCE_WINDOW_HEIGHT="${SEQUENCE_WINDOW_HEIGHT:-480}"

chmod +x "$REPODIR/deploy/raspberry-pi/sequence-site.sh" 2>/dev/null || true
chmod +x "$REPODIR/deploy/raspberry-pi/sequence-start-chromium.sh" 2>/dev/null || true

echo "[sequence] Writing systemd unit (repo: $SEQUENCE_SITE_DIR, user: $SEQUENCE_SERVICE_USER, port $SEQUENCE_HTTP_PORT) ..."
bash "$REPODIR/deploy/raspberry-pi/install-sequence-systemd.sh"

echo "[sequence] Chromium autostart + kiosk.conf ..."
SEQUENCE_SITE_DIR="$SEQUENCE_SITE_DIR" \
  SEQUENCE_HTTP_PORT="$SEQUENCE_HTTP_PORT" \
  SEQUENCE_WINDOW_WIDTH="$SEQUENCE_WINDOW_WIDTH" \
  SEQUENCE_WINDOW_HEIGHT="$SEQUENCE_WINDOW_HEIGHT" \
  bash "$REPODIR/deploy/raspberry-pi/install-kiosk-autostart.sh"

echo ""
echo "Ready. Enable on every boot:"
echo "  • sequence-site.service (git refresh, npm run build, serve dist)"
echo "  • Chromium via /etc/xdg/autostart/sequence-kiosk.desktop"
echo ""
echo "Reboot: sudo reboot"
