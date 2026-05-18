#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo SEQUENCE_WEB_SERIAL_VID_HEX=1a86 SEQUENCE_WEB_SERIAL_PID_HEX=7523 $0" >&2
  exit 1
fi

VH="${SEQUENCE_WEB_SERIAL_VID_HEX:? set SEQUENCE_WEB_SERIAL_VID_HEX and SEQUENCE_WEB_SERIAL_PID_HEX from lsusb (hex without 0x), e.g. 1a86 and 7523}"
PH="${SEQUENCE_WEB_SERIAL_PID_HEX:?}"

VID=$((16#$VH))
PID=$((16#$PH))

HTTP_PORT="${SEQUENCE_HTTP_PORT:-3000}"

managed=/etc/chromium/policies/managed
install -d "$managed"

install -Dm644 /dev/stdin "$managed/sequence-web-serial.json" <<JSON
{
  "SerialAllowUsbDevicesForUrls": [
    {
      "urls": [
        "http://127.0.0.1:${HTTP_PORT}",
        "http://localhost:${HTTP_PORT}"
      ],
      "devices": [
        { "vendor_id": ${VID}, "product_id": ${PID} }
      ]
    }
  ]
}
JSON

echo "[sequence] Wrote $managed/sequence-web-serial.json (vendor ${VID} / product ${PID})."
echo "           Pair from lsusb: ${VH}:${PH}"
echo "           Reboot or restart Chromium."
