# Dual pygame kiosk — two HDMI (`~/Sequence_IOS`)

**Pictures:** `public/exhibit-left/` and `public/exhibit-right/` (files in those folders, not subfolders).  
**Runs:** two **Python/pygame** windows (left + right). **No Chromium.**

---

### 1) Install once

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
```

### 2) Screen layout (extended desktop — two monitors in a row)

```bash
sudo mkdir -p /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

**Ctrl+O**, Enter, **Ctrl+X** — save.

Two **1920×1080** side by side:

```ini
SEQUENCE_SITE_DIR=$HOME/Sequence_IOS

SEQUENCE_DUAL_IMAGE_DIR_LEFT=$SEQUENCE_SITE_DIR/public/exhibit-left
SEQUENCE_DUAL_IMAGE_DIR_RIGHT=$SEQUENCE_SITE_DIR/public/exhibit-right

SEQUENCE_WINDOW_WIDTH=3840
SEQUENCE_WINDOW_HEIGHT=1080
SEQUENCE_MONITOR_LEFT_WIDTH=1920
SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS=8
SEQUENCE_DUAL_IMAGE_START_DELAY=12
SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_PYGAME_BORDERLESS=1
```

### 3) Reboot

```bash
sudo reboot
```
