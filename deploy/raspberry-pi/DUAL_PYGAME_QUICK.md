# Dual pygame kiosk — two HDMI (`~/Sequence_IOS`)

**Pictures:** `public/exhibit-left/1/` … `public/exhibit-right/4/` (paired numbered subfolders).  
**Runs:** one **wide pygame** window (left + right panes). **No Chromium.** Matches web `data-images.html`.

---

### 1) Install once (on Pi, after `git pull`)

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
```

### 2) Screen layout + serial (extended desktop — two monitors in a row)

```bash
sudo mkdir -p /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

Two **1920×1080** side by side:

```ini
SEQUENCE_SITE_DIR=$HOME/Sequence_IOS

SEQUENCE_DUAL_IMAGE_DIR_LEFT=$SEQUENCE_SITE_DIR/public/exhibit-left
SEQUENCE_DUAL_IMAGE_DIR_RIGHT=$SEQUENCE_SITE_DIR/public/exhibit-right

SEQUENCE_WINDOW_WIDTH=3840
SEQUENCE_WINDOW_HEIGHT=1080
SEQUENCE_MONITOR_LEFT_WIDTH=1920

SEQUENCE_DUAL_IMAGE_START_DELAY=12
SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_PYGAME_BORDERLESS=1

SEQUENCE_SERIAL_DEVICE=/dev/ttyUSB0
```

Use `ls -l /dev/serial/by-id/` if `ttyUSB0` differs. Nano must send `0` / `1` at **115200** baud.

### 3) Reboot

```bash
sudo reboot
```

---

**Behaviour (same as web):**

| Mode | What happens |
|------|----------------|
| **Baseline** | Folders **1→2→3→4**, left/right finish each folder together (~**1 s** per image on the longer side) |
| **Sensor `1`** | **10 s slot**: **7 s** fast spin (speeds up) → **3 s** final image settles with bounce |
| **Sensor `0`** | Back to baseline after slot finishes |

**Dev test without sensor:** press **Space** on a keyboard plugged into the Pi.

**Re-install after code changes:** run step 1 again, then reboot.
