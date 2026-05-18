#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo SEQUENCE_SITE_DIR=/path/to/Sequence_IOS ./deploy/raspberry-pi/install-native-colors-kiosk.sh" >&2
  exit 1
fi

REPODIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="${SEQUENCE_SITE_DIR:-$REPODIR}"

if [[ ! -f "$ROOT/deploy/raspberry-pi/native-kiosk/sequence_colors_kiosk.py" ]]; then
  echo "Missing native-kiosk in $ROOT/deploy/raspberry-pi/native-kiosk" >&2
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get install -qy python3-pygame python3-serial || true
fi

U="$(awk -F: '$3==1000 {print $1; exit}' /etc/passwd)"
if [[ -n "${U:-}" ]]; then
  usermod -aG dialout,video,input "$U" 2>/dev/null || usermod -aG dialout "$U"
fi

install -dm755 /opt/sequence/native-kiosk
install -Dm644 "$ROOT/deploy/raspberry-pi/native-kiosk/sequence_colors_kiosk.py" \
  /opt/sequence/native-kiosk/sequence_colors_kiosk.py
install -Dm755 "$ROOT/deploy/raspberry-pi/native-kiosk/sequence-colors-kiosk-launch.sh" \
  /usr/local/bin/sequence-colors-kiosk-launch.sh

install -Dm644 /dev/stdin /etc/xdg/autostart/sequence-colors-kiosk.desktop <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Sequence native colors kiosk
StartupNotify=false
Terminal=false
X-GNOME-Autostart-enabled=true
Exec=/usr/local/bin/sequence-colors-kiosk-launch.sh
DESKTOP

if [[ "${SEQUENCE_DISABLE_CHROMIUM_KIOSK:-0}" == 1 ]]; then
  rm -f /etc/xdg/autostart/sequence-kiosk.desktop
  echo "[sequence] Removed Chromium kiosk autostart (sequence-kiosk.desktop)."
fi

echo "[sequence] Native colors kiosk installed."
echo "  • /opt/sequence/native-kiosk/sequence_colors_kiosk.py"
echo "  • autostart: sequence-colors-kiosk.desktop"
echo "  • optional: SEQUENCE_SERIAL_DEVICE=/dev/ttyACM0 in /etc/sequence/kiosk.conf (or first of ttyACM0/ttyUSB0)"
echo "  • Reboot or log out. Reinstall with SEQUENCE_DISABLE_CHROMIUM_KIOSK=1 to drop browser autostart."
