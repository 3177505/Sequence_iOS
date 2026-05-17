#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the Raspberry Pi once, for example curl ... | sudo bash" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

REPO="${SEQUENCE_REPO_URL:-https://github.com/3177505/Sequence_iOS.git}"
BRANCH="${SEQUENCE_REPO_BRANCH:-main}"
HTTP_PORT="${SEQUENCE_HTTP_PORT:-3000}"
WIN_W="${SEQUENCE_WINDOW_WIDTH:-1600}"
WIN_H="${SEQUENCE_WINDOW_HEIGHT:-480}"

APT_GET="apt-get -o Acquire::Retries=5 -qy"

if [[ "${SEQUENCE_SKIP_APT:-0}" != 1 ]]; then
  echo "[sequence] APT update..."
  $APT_GET update

  echo "[sequence] Base packages..."
  $APT_GET install -y --no-install-recommends git ca-certificates curl util-linux

  echo "[sequence] Chromium..."
  $APT_GET install -y --no-install-recommends chromium-browser || $APT_GET install -y --no-install-recommends chromium

  NODE_OK=0
  if command -v node >/dev/null 2>&1; then
    MAJ="$(node -p "parseInt(process.versions.node.split('.')[0],10)")" || MAJ=0
    [[ "$MAJ" -ge 18 ]] && NODE_OK=1
  fi
  if [[ "$NODE_OK" -ne 1 ]]; then
    echo "[sequence] Node.js 18+..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    $APT_GET install -y nodejs
  fi
else
  echo "[sequence] SEQUENCE_SKIP_APT=1 — skipping apt (assume git, chromium, Node 18+ already installed)."
fi

PI_USER="$(awk -F: '$3==1000{print $1;exit}' /etc/passwd)"
PI_USER="${PI_USER:-pi}"
PI_HOME="$(getent passwd "$PI_USER" | cut -d: -f6)"

if [[ -z "${PI_HOME}" ]]; then
  echo "Cannot resolve home for UID 1000 (${PI_USER}). Create that user before provisioning." >&2
  exit 1
fi

DEST="${SEQUENCE_SITE_DIR:-$PI_HOME/Sequence_iOS}"

if [[ ! -d "${DEST}/.git" ]]; then
  if [[ -d "$DEST" ]]; then
    CNT="$(find "$DEST" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)"
    if [[ "$(echo "${CNT:-0}" | tr -d ' ')" != "0" ]]; then
      echo "Destination exists but is not the Sequence repo: ${DEST}. Move it away or set SEQUENCE_SITE_DIR." >&2
      exit 1
    fi
    rmdir "$DEST" 2>/dev/null || true
  fi
  PARENT="$(dirname "$DEST")"
  mkdir -p "$PARENT"
  chown "${PI_USER}:${PI_USER}" "$PARENT" || true
  echo "[sequence] git clone..."
  sudo -u "$PI_USER" git clone --depth 1 --branch "$BRANCH" "$REPO" "$DEST" || sudo -u "$PI_USER" git clone --depth 1 "$REPO" "$DEST"
fi

chmod +x "$DEST/deploy/raspberry-pi/"*.sh 2>/dev/null || true

export SEQUENCE_SITE_DIR="$DEST"
export SEQUENCE_SERVICE_USER="$PI_USER"
export SEQUENCE_HTTP_PORT="$HTTP_PORT"

bash "$DEST/deploy/raspberry-pi/install-sequence-systemd.sh"

SEQUENCE_SITE_DIR="$DEST" \
  SEQUENCE_HTTP_PORT="$HTTP_PORT" \
  SEQUENCE_WINDOW_WIDTH="$WIN_W" \
  SEQUENCE_WINDOW_HEIGHT="$WIN_H" \
  FORCE_SEQUENCE_KIOSK_CONF="${FORCE_SEQUENCE_KIOSK_CONF:-1}" \
  SEQUENCE_ENABLE_DESKTOP_AUTOLOGIN="${SEQUENCE_ENABLE_DESKTOP_AUTOLOGIN:-1}" \
  bash "$DEST/deploy/raspberry-pi/install-kiosk-autostart.sh"

echo ""
echo "Provisioning finished. Chromium autostarts via /etc/xdg/autostart/sequence-kiosk.desktop"
echo "(waits until http://127.0.0.1:${HTTP_PORT} answers, then spans ${WIN_W}x${WIN_H})."
echo "Run: reboot"
echo ""
