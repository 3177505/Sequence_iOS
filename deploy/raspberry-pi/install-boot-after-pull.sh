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
chmod +x "$REPODIR/deploy/raspberry-pi/sequence-kiosk-session.sh" 2>/dev/null || true
chmod +x "$REPODIR/deploy/raspberry-pi/install-web-serial-policy.sh" 2>/dev/null || true

echo "[sequence] Writing systemd unit (repo: $SEQUENCE_SITE_DIR, user: $SEQUENCE_SERVICE_USER, port $SEQUENCE_HTTP_PORT) ..."
bash "$REPODIR/deploy/raspberry-pi/install-sequence-systemd.sh"

echo "[sequence] Chromium autostart + kiosk.conf ..."
SEQUENCE_SITE_DIR="$SEQUENCE_SITE_DIR" \
  SEQUENCE_HTTP_PORT="$SEQUENCE_HTTP_PORT" \
  SEQUENCE_WINDOW_WIDTH="$SEQUENCE_WINDOW_WIDTH" \
  SEQUENCE_WINDOW_HEIGHT="$SEQUENCE_WINDOW_HEIGHT" \
  SEQUENCE_WEB_SERIAL_VID_HEX="${SEQUENCE_WEB_SERIAL_VID_HEX:-}" \
  SEQUENCE_WEB_SERIAL_PID_HEX="${SEQUENCE_WEB_SERIAL_PID_HEX:-}" \
  bash "$REPODIR/deploy/raspberry-pi/install-kiosk-autostart.sh"

if [[ "${SEQUENCE_BOOT_INSTALL_DUAL_IMAGE:-0}" == 1 ]]; then
  echo "[sequence] Dual-image kiosk (two pygame windows, images from repo public/exhibit-*) ..."
  SEQUENCE_SITE_DIR="$SEQUENCE_SITE_DIR" SEQUENCE_DISABLE_CHROMIUM_KIOSK=1 \
    bash "$REPODIR/deploy/raspberry-pi/install-dual-image-kiosk.sh"
fi

echo ""
echo "Ready. Enable on every boot:"
echo "  • sequence-site.service (git refresh, npm run build, serve dist)"
echo "  • Chromium via /etc/xdg/autostart/sequence-kiosk.desktop"
echo ""
echo "Optional Web Serial without picker (IDs from lsusb, CH340 USB-serial often 1a86:7523):"
echo "  sudo SEQUENCE_WEB_SERIAL_VID_HEX=1a86 SEQUENCE_WEB_SERIAL_PID_HEX=7523 SEQUENCE_SITE_DIR=$SEQUENCE_SITE_DIR \\"
echo "    ./deploy/raspberry-pi/install-boot-after-pull.sh"
echo "Then add the same two hex lines to /etc/sequence/kiosk.conf and reboot."
echo ""
echo "Optional dual-screen image kiosk (no Chromium):"
echo "  sudo SEQUENCE_BOOT_INSTALL_DUAL_IMAGE=1 SEQUENCE_SITE_DIR=$SEQUENCE_SITE_DIR \\"
echo "    ./deploy/raspberry-pi/install-boot-after-pull.sh"
echo ""
echo "Chromium troubleshooting log (uid 1000): ~/.local/share/sequence-kiosk-chromium.log"
echo ""
echo "Reboot: sudo reboot"
