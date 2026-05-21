# Dual pygame kiosk — two HDMI (`~/Sequence_IOS`)

**Pictures:** `public/exhibit-left/1/` … `public/exhibit-right/4/` (paired numbered subfolders).  
**Runs:** **two pygame windows** (left HDMI + right HDMI), synced. **No Chromium.**

---

### 1) Install once (on Pi, after `git pull`)

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
```

### 2) Screen layout (extended desktop — two monitors in a row)

Menu → **Preferences → Screen Configuration** → **Extended** (not mirror).  
Drag monitors: **left HDMI left**, **right HDMI right**.

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
SEQUENCE_MONITOR_LEFT_X=0
SEQUENCE_MONITOR_RIGHT_X=1920

SEQUENCE_DUAL_IMAGE_START_DELAY=12
SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_PYGAME_BORDERLESS=1

SEQUENCE_SERIAL_DEVICE=/dev/ttyUSB0

SEQUENCE_IMAGE_MAX_EDGE=960
```

If left/right are swapped on the desk, swap **`SEQUENCE_MONITOR_LEFT_X`** and **`SEQUENCE_MONITOR_RIGHT_X`**, or swap HDMI cables in Screen Configuration.

Check sizes on the Pi:

```bash
xrandr | grep connected
```

If your monitors are **not** 1920×1080, set **`SEQUENCE_WINDOW_HEIGHT`** and each half width to match (e.g. 1280×720 → `WIDTH=2560`, `LEFT_WIDTH=1280`).

### 3) Reboot

```bash
sudo reboot
```

---

**Behaviour (same as web):**

| Mode | What happens |
|------|----------------|
| **Baseline** | Folders **1→2→3→4**, left/right finish each folder together (~**1 s** per image on the longer side) |
| **Sensor `1`** | **10 s slot**: **7 s** fast spin → **3 s** settle bounce |
| **Sensor `0`** | Back to baseline after slot finishes |

**Dev test without sensor:** **Space** on keyboard (left window).

**Re-install after code changes:** run step 1 again, then reboot.

Images use **fit-to-screen** (whole image visible, letterboxed). If still slow, try `SEQUENCE_IMAGE_MAX_EDGE=800` in `kiosk.conf`.

**Pygame vs web:** Pygame is usually **lighter on the Pi** than Chromium (less RAM, no browser). For a 24/7 exhibit, use **mains power** — either path is heavy on a battery pack.
