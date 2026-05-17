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

resolve_github_https_auth_remote() {
  local raw="$1"
  local path host_path
  if [[ "$raw" == git@github.com:* ]] || [[ "$raw" == git@github.com:/* ]]; then
    path="${raw#git@github.com:}"
    path="${path#/}"
  elif [[ "$raw" =~ ^https://github\.com/ ]]; then
    path="${raw#https://github.com/}"
    path="${path#/}"
  else
    echo ""
    return
  fi
  path="${path%.git}"
  if [[ -z "$path" ]]; then
    echo ""
    return
  fi

  host_path="github.com/${path}"

  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "https://${GITHUB_TOKEN}@${host_path}.git"
    return
  fi
  if [[ -z "${GIT_USERNAME:-}" ]] || { [[ -z "${GIT_PASSWORD:-}" ]] && [[ -z "${GIT_TOKEN:-}" ]]; }; then
    echo ""
    return
  fi
  local gp="${GIT_PASSWORD:-${GIT_TOKEN:-}}"
  if command -v python3 >/dev/null 2>&1; then
    printf 'https://%s:%s@%s.git\n' \
      "$(GIT_USERNAME="$GIT_USERNAME" GIT_PASS="$gp" python3 -c 'import os,urllib.parse; print(urllib.parse.quote(os.environ["GIT_USERNAME"], safe=""))')" \
      "$(GIT_USERNAME="$GIT_USERNAME" GIT_PASS="$gp" python3 -c 'import os,urllib.parse; print(urllib.parse.quote(os.environ["GIT_PASS"], safe=""))')" \
      "$host_path"
  else
    echo "Missing python3 — cannot safely URL-encode git credentials." >&2
    echo ""
  fi
}

if [[ ! -d "$SITE_DIR/.git" ]]; then
  if [[ "$(find "$SITE_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')" != "0" ]]; then
    echo "'$SITE_DIR' must be empty (or omit SEQUENCE_SITE_DIR to use repo copy at $REPO_ROOT)." >&2
    exit 1
  fi
  git clone "$REPO_URL" "$SITE_DIR"
fi

cd "$SITE_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=1091
  source ./.env
  set +a
fi

if [[ -f deploy/raspberry-pi/.env ]]; then
  set -a
  # shellcheck disable=1091
  source ./deploy/raspberry-pi/.env
  set +a
fi

if [[ -f /etc/sequence/git.env ]]; then
  set -a
  # shellcheck disable=1091
  source /etc/sequence/git.env
  set +a
fi

export GIT_TERMINAL_PROMPT=0

ORIG_REMOTE="$(git remote get-url origin 2>/dev/null || true)"
AUTH_REMOTE="$(resolve_github_https_auth_remote "$ORIG_REMOTE")"
TRAP_RESTORE=0

if [[ -n "${AUTH_REMOTE}" && "$AUTH_REMOTE" != "$ORIG_REMOTE" ]] && git rev-parse --git-dir >/dev/null 2>&1; then
  restore_origin_remote() {
    if [[ "$(git remote get-url origin 2>/dev/null || true)" != "$ORIG_REMOTE" ]]; then
      git remote set-url origin "$ORIG_REMOTE" 2>/dev/null || true
    fi
  }
  trap 'restore_origin_remote' EXIT INT TERM
  TRAP_RESTORE=1
  git remote set-url origin "$AUTH_REMOTE"
fi

git fetch origin "$BRANCH" 2>/dev/null || git fetch origin

if [[ "${TRAP_RESTORE:-0}" == 1 ]]; then
  restore_origin_remote || true
  trap - EXIT INT TERM || true
fi

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
