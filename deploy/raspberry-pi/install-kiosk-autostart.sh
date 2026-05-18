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
install -Dm755 "$ROOT/deploy/raspberry-pi/sequence-kiosk-session.sh" /usr/local/bin/sequence-kiosk-session.sh
install -Dm755 "$ROOT/deploy/raspberry-pi/install-web-serial-policy.sh" /usr/local/bin/install-web-serial-policy.sh

command -v apt-get >/dev/null 2>&1 && apt-get -qy install libnotify-bin 2>/dev/null || true

if [[ -n "${SEQUENCE_WEB_SERIAL_VID_HEX:-}" && -n "${SEQUENCE_WEB_SERIAL_PID_HEX:-}" ]]; then
  SEQUENCE_HTTP_PORT="$HTTP" \
    SEQUENCE_WEB_SERIAL_VID_HEX="$SEQUENCE_WEB_SERIAL_VID_HEX" \
    SEQUENCE_WEB_SERIAL_PID_HEX="$SEQUENCE_WEB_SERIAL_PID_HEX" \
    bash "$ROOT/deploy/raspberry-pi/install-web-serial-policy.sh"
fi

mkdir -p /etc/sequence
if [[ "${FORCE_SEQUENCE_KIOSK_CONF:-}" == 1 ]] || [[ ! -f /etc/sequence/kiosk.conf ]]; then
  umask 022
  install -Dm644 /dev/stdin /etc/sequence/kiosk.conf <<CFG
SEQUENCE_HTTP_PORT=${HTTP}
SEQUENCE_WINDOW_WIDTH=${W}
SEQUENCE_WINDOW_HEIGHT=${H}
SEQUENCE_HTTP_WAIT_SECONDS=300
# SEQUENCE_SITE_DIR=/home/pi/Sequence_IOS
# SEQUENCE_KIOSK_START_DELAY=12
# SEQUENCE_CHROMIUM_USE_X11_OZONE=1
# SEQUENCE_KIOSK_LOG default: ~/.local/share/sequence-kiosk-chromium.log
# SEQUENCE_START_URL=http://127.0.0.1:${HTTP}/data-images.html?kiosk=1
# SEQUENCE_START_URL_RIGHT=http://127.0.0.1:${HTTP}/exhibit-right.html?kiosk=1
# SEQUENCE_MONITOR_LEFT_WIDTH=1920
# Web Serial auto (USB adapter on ttyUSB0): lsusb → idVendor:idProduct hex, then run:
#   sudo SEQUENCE_WEB_SERIAL_VID_HEX=1a86 SEQUENCE_WEB_SERIAL_PID_HEX=7523 /usr/local/bin/install-web-serial-policy.sh
# And set same pair in kiosk.conf so ?kiosk=1 URLs get &serialVid=&serialPid= (Chromium launcher appends):
# SEQUENCE_WEB_SERIAL_VID_HEX=1a86
# SEQUENCE_WEB_SERIAL_PID_HEX=7523
#
# Pygame dual-image kiosk (/usr/local/bin/dual-image-kiosk-launch.sh):
# SEQUENCE_HIDE_DESKTOP_PANEL=1
# SEQUENCE_PYGAME_BORDERLESS=1
# SEQUENCE_NATIVE_SERIAL_DEVICE=/dev/ttyUSB0
# SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD=400   (-1 = ignore numeric-only lines)
# SEQUENCE_NATIVE_SERIAL_LINE_IDLE_MS=0.05
# SEQUENCE_EXHIBIT_TRIGGER_SLIDE_MS=70
# SEQUENCE_EXHIBIT_WIPE_MS_TRIGGER=55
# SEQUENCE_HIDE_DESKTOP_PANEL_ROUNDS=24
# SEQUENCE_HIDE_DESKTOP_PANEL_INTERVAL=0.2
# SEQUENCE_PYGAME_OVERFLOW_TOP_PIXELS=44
# SEQUENCE_NATIVE_SERIAL_DEBUG=1
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
Exec=/usr/local/bin/sequence-kiosk-session.sh
DESKTOP

if [[ "${SEQUENCE_ENABLE_DESKTOP_AUTOLOGIN:-1}" != 0 ]] && command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_boot_behaviour B4 || true
fi
