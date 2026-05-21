# Dual pygame kiosk — final setup (`~/Sequence_IOS`)

**Architecture:** launcher starts **two Python processes** from `exhibit_dual_kiosk.py`:

| Process | Flag | Screen | Role |
|---------|------|--------|------|
| **Master** | `--pane left` | Left HDMI | Left images, **PIR serial**, folder timing, slot mode |
| **Slave** | `--pane right` | Right HDMI | Right images, follows master via sync file |

**Images:** paired subfolders `public/exhibit-left/1/` … `4/` and `public/exhibit-right/1/` … `4/`.

---

## Final setup (do in order)

### A) Mac — push latest code

Commit & push from your Mac (or skip if Pi already has latest).

### B) Pi — install

```bash
cd ~/Sequence_IOS
git pull
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
```

### C) Pi — check images & folders

```bash
ls ~/Sequence_IOS/public/exhibit-left/
ls ~/Sequence_IOS/public/exhibit-right/
ls ~/Sequence_IOS/public/exhibit-left/1/ | head
ls ~/Sequence_IOS/public/exhibit-right/1/ | head
```

You need matching numbered folders (**1**, **2**, **3**, **4**) on **both** sides, each with image files inside.

### D) Pi — check Arduino serial

```bash
ls -l /dev/ttyUSB0
sudo stty -F /dev/ttyUSB0 115200 raw -echo
sudo timeout 5 cat /dev/ttyUSB0
```

Wave at PIR → lines of **`0`** and **`1`**. Ctrl+C if needed.

### E) Pi — create `kiosk.conf`

```bash
sudo mkdir -p /etc/sequence
sudo cp ~/Sequence_IOS/deploy/raspberry-pi/kiosk.conf.example /etc/sequence/kiosk.conf
sudo nano /etc/sequence/kiosk.conf
```

Change **`/home/raspi`** if your username is different (`echo $HOME`).

**Full config (all recommended values):**

```ini
SEQUENCE_SITE_DIR=/home/raspi/Sequence_IOS
SEQUENCE_DUAL_IMAGE_DIR_LEFT=/home/raspi/Sequence_IOS/public/exhibit-left
SEQUENCE_DUAL_IMAGE_DIR_RIGHT=/home/raspi/Sequence_IOS/public/exhibit-right

SEQUENCE_WINDOW_WIDTH=3840
SEQUENCE_WINDOW_HEIGHT=1080
SEQUENCE_MONITOR_LEFT_WIDTH=1920
SEQUENCE_MONITOR_LEFT_X=0
SEQUENCE_MONITOR_RIGHT_X=1920

SEQUENCE_MS_PER_LONG_IMAGE=1000
SEQUENCE_DUAL_IMAGE_START_DELAY=12

SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_PYGAME_BORDERLESS=1
SEQUENCE_IMAGE_MAX_EDGE=960

SEQUENCE_AUTO_DETECT_DISPLAY=0

SEQUENCE_SERIAL_DEVICE=/dev/ttyUSB0
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `SEQUENCE_SITE_DIR` | repo path | Root of checkout |
| `SEQUENCE_DUAL_IMAGE_DIR_LEFT` | `.../exhibit-left` | Left image tree |
| `SEQUENCE_DUAL_IMAGE_DIR_RIGHT` | `.../exhibit-right` | Right image tree |
| `SEQUENCE_WINDOW_WIDTH` | **3840** | Total desktop width (both screens) |
| `SEQUENCE_WINDOW_HEIGHT` | **1080** | Screen height |
| `SEQUENCE_MONITOR_LEFT_WIDTH` | **1920** | Left window width |
| `SEQUENCE_MONITOR_LEFT_X` | **0** | Left window X position |
| `SEQUENCE_MONITOR_RIGHT_X` | **1920** | Right window X position |
| `SEQUENCE_MS_PER_LONG_IMAGE` | **1000** | ~1 s per image on longer side |
| `SEQUENCE_DUAL_IMAGE_START_DELAY` | **12** | Seconds after login before exhibit |
| `SEQUENCE_HIDE_DESKTOP_PANEL` | **1** | Hide top menu bar during exhibit |
| `SEQUENCE_PYGAME_BORDERLESS` | **1** | No window frame |
| `SEQUENCE_IMAGE_MAX_EDGE` | **960** | Max pixels (performance) |
| `SEQUENCE_AUTO_DETECT_DISPLAY` | **0** | Use manual geometry above |
| `SEQUENCE_SERIAL_DEVICE` | `/dev/ttyUSB0` | Arduino Nano port |

**Only if needed (leave commented out at first):**

| Variable | When |
|----------|------|
| `SEQUENCE_SDL_VIDEODRIVER=x11` | Both windows on one screen |
| `SEQUENCE_AUTO_DETECT_DISPLAY=1` | After swapping HDMI cables |
| `SEQUENCE_IMAGE_MAX_EDGE=800` | Still slow / stutter |
| `SEQUENCE_HIDE_DESKTOP_PANEL=0` | Keep menu bar visible |

If left/right are **swapped on the desk**, swap `SEQUENCE_MONITOR_LEFT_X` and `SEQUENCE_MONITOR_RIGHT_X` (e.g. `1920` and `0`).

### F) Pi — test before reboot

```bash
pkill -f exhibit_dual_kiosk.py 2>/dev/null || true
DISPLAY=:0 SEQUENCE_DUAL_IMAGE_START_DELAY=0 /usr/local/bin/dual-image-kiosk-launch.sh
```

Checklist:

- [ ] Left HDMI = left folder images  
- [ ] Right HDMI = right folder images  
- [ ] Images **fit** screen (not cropped)  
- [ ] **Space** on keyboard = 10 s slot test  
- [ ] PIR **`1`** = slot, **`0`** = baseline after slot ends  

Stop test: **Escape** on keyboard, or:

```bash
pkill -f exhibit_dual_kiosk.py
```

### G) Pi — go live

```bash
sudo reboot
```

After ~12 s both screens should start automatically.

---

## Behaviour

| Mode | What happens |
|------|----------------|
| **Baseline** | Folders **1→2→3→4**, both sides finish each folder together (~**1 s** per image on the longer side) |
| **Sensor `1`** | **10 s slot**: **7 s** fast spin → **3 s** settle bounce |
| **Sensor `0`** | Back to baseline after slot finishes |

---

## Two screens already show different content?

Good — you do **not** need an “Extended” button. Keep `SEQUENCE_AUTO_DETECT_DISPLAY=0` and the **3840 / 1920 / 0 / 1920** values above.

**180° rotation** on one monitor: set in **Preferences → Screen Configuration** — does not block the exhibit.

---

## Troubleshooting

```bash
grep SEQUENCE /etc/sequence/kiosk.conf
pgrep -af exhibit_dual_kiosk
wlr-randr 2>/dev/null | grep -E '^(HDMI|DSI|DP)|Position'
```

Missing menu bar after crash: `wf-panel-pi &` or reboot.

**Re-install after code changes:** step B, then reboot.
