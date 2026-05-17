#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE_TEMPLATE="$ROOT/deploy/raspberry-pi/sequence-site.service.template"
TARGET="/etc/systemd/system/sequence-site.service"

SEQUENCE_UID_USER="$(awk -F: '$3==1000{print $1;exit}' /etc/passwd)"
SEQUENCE_UID_USER="${SEQUENCE_UID_USER:-pi}"
SERVICE_USER="${SEQUENCE_SERVICE_USER:-$SEQUENCE_UID_USER}"

SITE_DIR_OVERRIDE="${SEQUENCE_SITE_DIR:-$ROOT}"

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
fi

if [[ ! -x "$ROOT/deploy/raspberry-pi/sequence-site.sh" ]]; then
  chmod +x "$ROOT/deploy/raspberry-pi/sequence-site.sh" || true
fi

SEQ_PORT="${SEQUENCE_HTTP_PORT:-3000}"

sed \
  -e "s|@@REPO_ROOT@@|$ROOT|g" \
  -e "s|@@SITE_DIR@@|$SITE_DIR_OVERRIDE|g" \
  -e "s|@@SERVICE_USER@@|$SERVICE_USER|g" \
  -e "s|@@SEQUENCE_HTTP_PORT@@|$SEQ_PORT|g" \
  "$SERVICE_TEMPLATE" | $SUDO tee "$TARGET" >/dev/null

$SUDO systemctl daemon-reload
$SUDO systemctl enable sequence-site.service
$SUDO systemctl restart sequence-site.service

echo ""
echo "sequence-site.service installed → $TARGET"
echo "journalctl -fu sequence-site.service"
