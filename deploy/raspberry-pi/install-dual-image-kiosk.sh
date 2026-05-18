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
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/dual-image-kiosk-launch.sh" /usr/local/bin/dual-image-kiosk-launch.sh

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

if [[ "${SEQUENCE_DISABLE_CHROMIUM_KIOSK:-0}" == 1 ]]; then
  rm -f /etc/xdg/autostart/sequence-kiosk.desktop
  echo "[sequence] Removed Chromium kiosk autostart."
else
  echo "[sequence] WARNING: Chromium kiosk autostart is still active — disable it if you only want dual-image (SEQUENCE_DISABLE_CHROMIUM_KIOSK=1)." >&2
fi

echo "[sequence] Dual-image kiosk installed."
echo "  • Drop JPG/PNG/WebP into: $ROOT/public/exhibit-left and .../exhibit-right"
echo "  • Optional in /etc/sequence/kiosk.conf: SEQUENCE_SITE_DIR=$ROOT"
echo "  • Reboot or log out."
