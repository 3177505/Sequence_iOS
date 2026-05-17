#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SITE_DIR="${SEQUENCE_SITE_DIR:-$REPO_ROOT}"
REPO_URL="${SEQUENCE_REPO_URL:-https://github.com/3177505/Sequence_iOS.git}"
BRANCH="${SEQUENCE_BRANCH:-main}"
PORT="${SEQUENCE_HTTP_PORT:-3000}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found — install Node.js (e.g. from NodeSource) before starting sequence-site." >&2
  exit 1
fi

mkdir -p "$SITE_DIR"

if [[ ! -d "$SITE_DIR/.git" ]]; then
  if [[ "$(find "$SITE_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')" != "0" ]]; then
    echo "'$SITE_DIR' must be empty (or omit SEQUENCE_SITE_DIR to use repo copy at $REPO_ROOT)." >&2
    exit 1
  fi
  git clone "$REPO_URL" "$SITE_DIR"
fi

cd "$SITE_DIR"

git fetch origin "$BRANCH" || git fetch origin

if git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
  git checkout -B "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
  git pull --ff-only origin "$BRANCH" || git pull --ff-only
fi

npm ci
npm run build

exec ./node_modules/.bin/serve dist -l "$PORT"
