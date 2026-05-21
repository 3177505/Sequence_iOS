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

if command -v apt-get >/dev/null 2>&1; then
  apt-get install -qy python3-pygame || true
fi

U="$(awk -F: '$3==1000 {print $1; exit}' /etc/passwd)"
if [[ -n "${U:-}" ]]; then
  usermod -aG video,input "$U" 2>/dev/null || true
fi

install -dm755 /opt/sequence/native-kiosk
install -Dm644 "$ROOT/deploy/raspberry-pi/native-kiosk/image_window.py" /opt/sequence/native-kiosk/image_window.py
rm -f /opt/sequence/native-kiosk/exhibit_dual_strip.py
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/dual-image-kiosk-launch.sh" /usr/local/bin/dual-image-kiosk-launch.sh
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/sequence-hide-desktop-panel.sh" /usr/local/bin/sequence-hide-desktop-panel.sh

mkdir -p "$ROOT/public/exhibit-left" "$ROOT/public/exhibit-right"

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

echo "[sequence] Dual-image kiosk installed."
echo "  • Put JPG/PNG/WebP/GIF in $ROOT/public/exhibit-left and .../exhibit-right (single folder depth; no subfolders for pygame)."
echo "  • Slide interval (seconds): SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS in kiosk.conf (default 8; pass --interval from launcher)."
echo "  • Borderless pygame: SEQUENCE_PYGAME_BORDERLESS=1 default; SEQUENCE_HIDE_DESKTOP_PANEL=1 hides lxpanel/wf-panel before run."
echo "  • kiosk.conf SEQUENCE_SITE_DIR=$ROOT"
echo "  • Reboot or log out."
