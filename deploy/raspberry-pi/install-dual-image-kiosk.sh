#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo SEQUENCE_SITE_DIR=/path/to/repo ./deploy/raspberry-pi/install-dual-image-kiosk.sh" >&2
  exit 1
fi

ROOT="${SEQUENCE_SITE_DIR:? SEQUENCE_SITE_DIR must point to Sequence_iOS checkout root}"

if [[ ! -f "$ROOT/deploy/raspberry-pi/native-kiosk/image_window.py" ]]; then
  echo "Missing native-kiosk scripts in $ROOT" >&2
  exit 1
fi

if [[ ! -f "$ROOT/deploy/raspberry-pi/native-kiosk/exhibit_dual_strip.py" ]]; then
  echo "Missing exhibit_dual_strip.py in $ROOT" >&2
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get install -qy python3-pygame python3-serial || true
fi

U="$(awk -F: '$3==1000 {print $1; exit}' /etc/passwd)"
if [[ -n "${U:-}" ]]; then
  usermod -aG video,input,dialout "$U" 2>/dev/null || true
fi

install -dm755 /opt/sequence/native-kiosk
install -Dm644 "$ROOT/deploy/raspberry-pi/native-kiosk/image_window.py" /opt/sequence/native-kiosk/image_window.py
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/exhibit_dual_strip.py" /opt/sequence/native-kiosk/exhibit_dual_strip.py
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/dual-image-kiosk-launch.sh" /usr/local/bin/dual-image-kiosk-launch.sh
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/sequence-hide-desktop-panel.sh" /usr/local/bin/sequence-hide-desktop-panel.sh

mkdir -p "$ROOT/public/exhibit-left" "$ROOT/public/exhibit-right"
mkdir -p "$ROOT/public/exhibit-left/1" "$ROOT/public/exhibit-right/1"

install -Dm644 /dev/stdin /etc/xdg/autostart/sequence-dual-image.desktop <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Sequence dual-image kiosk
StartupNotify=false
Terminal=false
X-GNOME-Autostart-enabled=true
Exec=/usr/local/bin/dual-image-kiosk-launch.sh
DESKTOP

DISABLE_CHROME="${SEQUENCE_DISABLE_CHROMIUM_KIOSK:-1}"
if [[ "$DISABLE_CHROME" == 1 ]]; then
  rm -f /etc/xdg/autostart/sequence-kiosk.desktop
  echo "[sequence] Chromium kiosk autostart removed (pygame dual-image only). To keep Chromium too: SEQUENCE_DISABLE_CHROMIUM_KIOSK=0 when running this script."
else
  echo "[sequence] Chromium kiosk autostart left enabled (SEQUENCE_DISABLE_CHROMIUM_KIOSK=0)."
fi

echo "[sequence] Dual-image kiosk installed (Python pygame — Chromium autostart removed unless SEQUENCE_DISABLE_CHROMIUM_KIOSK=0)."
echo "  • SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=1 → two pygame windows (image_window.py left+right). =0 → one window exhibit_dual_strip.py (paired panes)."
echo "  • Set SEQUENCE_EXHIBIT_LEGACY_TWO_PROC (and SEQUENCE_WINDOW_* / SEQUENCE_MONITOR_LEFT_WIDTH) in /etc/sequence/kiosk.conf — see EXHIBIT_KIOSK_RUNBOOK.md."
echo "  • exhibit_dual_strip (LEGACY_TWO_PROC=0): paired frames; numbered dirs on both sides or flat pair lists — see runbook."
echo "  • image_window ×2 (LEGACY_TWO_PROC=1): two windows; put images flat under exhibit-left / exhibit-right (independent shuffles)."
echo "  • Timing strip: SEQUENCE_EXHIBIT_BASELINE_* / SEQUENCE_BURST_*. Timing legacy windows: SEQUENCE_EXHIBIT_SLIDE_MS / SEQUENCE_EXHIBIT_WIPE_MS_*."
echo "  • Legacy optional: SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS. Panel hide: /usr/local/bin/sequence-hide-desktop-panel.sh."
echo "  • Panel bar visible? PI_SIMPLE_SETUP (Panel)."
echo "  • kiosk.conf: SEQUENCE_SITE_DIR=$ROOT, SEQUENCE_HIDE_DESKTOP_PANEL=0 to keep Pi menu bar"
echo "  • Reboot or log out."
