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

**Configure screens before the kiosk runs.** The top menu bar only appears on the **primary** monitor — if it is on the right, the left screen looks “empty” and Screen Configuration is awkward to drag.

```bash
sudo mv /etc/xdg/autostart/sequence-dual-image.desktop /etc/xdg/autostart/sequence-dual-image.desktop.off
sudo reboot
```

After reboot:

1. Menu → **Preferences → Screen Configuration**
2. **Extended** (not mirror) — both HDMI outputs must show as connected
3. **Right-click the physical left monitor → Make primary** (menu bar moves there)
4. Drag monitors into one row: **left HDMI on the left**, **right HDMI on the right**
5. **Apply**, then reboot once more

Check what the Pi actually uses (copy into `kiosk.conf` if needed):

```bash
/usr/local/bin/sequence-detect-dual-display.sh
```

Re-enable kiosk autostart when layout is correct:

```bash
sudo mv /etc/xdg/autostart/sequence-dual-image.desktop.off /etc/xdg/autostart/sequence-dual-image.desktop
```

```bash
sudo mkdir -p /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

Two **1920×1080** side by side (or paste values from the detect script above):

```ini
SEQUENCE_SITE_DIR=$HOME/Sequence_IOS

SEQUENCE_DUAL_IMAGE_DIR_LEFT=$SEQUENCE_SITE_DIR/public/exhibit-left
SEQUENCE_DUAL_IMAGE_DIR_RIGHT=$SEQUENCE_SITE_DIR/public/exhibit-right

SEQUENCE_WINDOW_WIDTH=3840
SEQUENCE_WINDOW_HEIGHT=1080
SEQUENCE_MONITOR_LEFT_WIDTH=1920
SEQUENCE_MONITOR_LEFT_X=0
SEQUENCE_MONITOR_RIGHT_X=1920

SEQUENCE_AUTO_DETECT_DISPLAY=1

SEQUENCE_DUAL_IMAGE_START_DELAY=12
SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_PYGAME_BORDERLESS=1

SEQUENCE_SERIAL_DEVICE=/dev/ttyUSB0

SEQUENCE_IMAGE_MAX_EDGE=960
```

`SEQUENCE_AUTO_DETECT_DISPLAY=1` reads **live** positions from `wlr-randr` / `xrandr` on each boot (helps when Screen Configuration and manual numbers disagree).

If left/right are swapped on the desk, swap **`SEQUENCE_MONITOR_LEFT_X`** and **`SEQUENCE_MONITOR_RIGHT_X`**, or swap HDMI cables in Screen Configuration.

Manual check:

```bash
wlr-randr 2>/dev/null | grep -E '^(HDMI|DSI|DP)|Position'
xrandr | grep connected
```

If your monitors are **not** 1920×1080, set **`SEQUENCE_WINDOW_HEIGHT`** and each half width to match (e.g. 1280×720 → `WIDTH=2560`, `LEFT_WIDTH=1280`).

### Only one screen shows the exhibit?

- Right window is at **`SEQUENCE_MONITOR_RIGHT_X`** — if the desktop is still **1920 px wide** (mirror or one output disabled), it draws **off-screen**.
- Run **`sequence-detect-dual-display.sh`** — total width should be **left + right** (e.g. **3840**).
- If the menu bar is missing after a crash: **`wf-panel-pi &`** (Wayfire) or reboot.

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
