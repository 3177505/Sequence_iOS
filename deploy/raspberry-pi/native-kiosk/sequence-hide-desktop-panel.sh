#!/usr/bin/env bash
set -euo pipefail

[[ "${SEQUENCE_HIDE_DESKTOP_PANEL:-1}" != 1 ]] && exit 0

ROUNDS="${SEQUENCE_HIDE_DESKTOP_PANEL_ROUNDS:-18}"
STEP="${SEQUENCE_HIDE_DESKTOP_PANEL_INTERVAL:-0.25}"

kill_panel_round() {
  pkill -x lwrespawn 2>/dev/null || true
  local n
  for n in lxpanel lxpanel-pi lxpanel-bin lxqt-panel plank tint2 mate-panel xfce4-panel wf-panel wf-panel-pi wf-shell wf-panel-wrapper; do
    pkill -x "$n" 2>/dev/null || true
  done
  lxpanelctl exit 2>/dev/null || true
  if [[ "${SEQUENCE_HIDE_DESKTOP_PANEL_DEBUG:-0}" == 1 ]]; then
    echo "sequence-hide-desktop-panel: pgrep panel-ish" >&2
    pgrep -af 'lxpanel|wf-panel|panel|pcmanfm' 2>/dev/null || true
  fi
}

for ((_i = 0; _i < ROUNDS; _i++)); do
  kill_panel_round
  sleep "$STEP"
done
