#!/usr/bin/env bash
echo "=== sequence-site.service (needs sudo) ==="
if command -v sudo >/dev/null 2>&1; then
  sudo systemctl is-enabled sequence-site.service 2>/dev/null || echo "(not enabled or missing)"
  echo ""
  sudo systemctl status sequence-site.service --no-pager -l 2>/dev/null || true
  echo ""
  echo "Recent logs:"
  sudo journalctl -u sequence-site.service -b -n 50 --no-pager 2>/dev/null || true
fi

echo ""
echo "=== Listening on SEQUENCE_HTTP_PORT (default 3000) ==="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | grep -E ':3000\b' || echo "(nothing on :3000 — site service may still be building or failed)"
else
  netstat -tlnp 2>/dev/null | grep 3000 || echo "(install iproute2)"
fi

echo ""
echo "=== Chromium autostart (desktop session) ==="
if [[ -f /etc/xdg/autostart/sequence-kiosk.desktop ]]; then
  echo "OK: /etc/xdg/autostart/sequence-kiosk.desktop exists"
  cat /etc/xdg/autostart/sequence-kiosk.desktop
else
  echo "MISSING: install-boot-after-pull.sh was not run, or kiosk install failed."
fi

echo ""
echo "=== Quick HTTP test ==="
if command -v curl >/dev/null 2>&1; then
  curl -sf -o /dev/null -w "HTTP %{http_code}\n" --connect-timeout 2 http://127.0.0.1:3000/ || echo "curl: no response"
else
  echo "(no curl)"
fi

echo ""
echo "=== Autostart expectations ==="
echo "Chromium ONLY starts AFTER the graphical desktop loads for user pi."
echo "If you see login screen each boot: sudo raspi-config → System Options → Auto Login → Desktop Autologin"
echo "Or: sudo raspi-config nonint do_boot_behaviour B4"
