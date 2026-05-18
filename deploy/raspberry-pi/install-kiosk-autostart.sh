#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

ROOT="${SEQUENCE_SITE_DIR:? SEQUENCE_SITE_DIR must point to Sequence_iOS checkout root}"

HTTP="${SEQUENCE_HTTP_PORT:-3000}"
W="${SEQUENCE_WINDOW_WIDTH:-1600}"
H="${SEQUENCE_WINDOW_HEIGHT:-480}"

install -Dm755 "$ROOT/deploy/raspberry-pi/sequence-start-chromium.sh" /usr/local/bin/sequence-start-chromium.sh

command -v apt-get >/dev/null 2>&1 && apt-get -qy install libnotify-bin 2>/dev/null || true

mkdir -p /etc/sequence
if [[ "${FORCE_SEQUENCE_KIOSK_CONF:-}" == 1 ]] || [[ ! -f /etc/sequence/kiosk.conf ]]; then
  umask 022
  install -Dm644 /dev/stdin /etc/sequence/kiosk.conf <<CFG
SEQUENCE_HTTP_PORT=${HTTP}
SEQUENCE_WINDOW_WIDTH=${W}
SEQUENCE_WINDOW_HEIGHT=${H}
SEQUENCE_HTTP_WAIT_SECONDS=300
# SEQUENCE_START_URL=http://127.0.0.1:${HTTP}/exhibit-left.html?kiosk=1
# SEQUENCE_START_URL_RIGHT=http://127.0.0.1:${HTTP}/exhibit-right.html?kiosk=1
# SEQUENCE_MONITOR_LEFT_WIDTH=1920
CFG
fi

install -Dm644 /dev/stdin /etc/xdg/autostart/sequence-kiosk.desktop <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Sequence Chromium kiosk
StartupNotify=false
Terminal=false
X-GNOME-Autostart-enabled=true
Exec=/usr/local/bin/sequence-start-chromium.sh
DESKTOP

if [[ "${SEQUENCE_ENABLE_DESKTOP_AUTOLOGIN:-1}" != 0 ]] && command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_boot_behaviour B4 || true
fi
