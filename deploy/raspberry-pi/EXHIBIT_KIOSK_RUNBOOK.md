# Exhibit pygame kiosk + Arduino Nano — **from here on**

**Assumes you already have:** Raspberry Pi OS with desktop, **`Sequence_IOS`** cloned on the Pi, and **`install-dual-image-kiosk.sh`** run so autostart installs **`dual-image-kiosk-launch.sh`** (default: **one** pygame window driven by **`exhibit_dual_strip.py`** with left/right panes). Two separate windows (**`image_window.py` × 2**) remain available via **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=1`**.

**This file is the checklist you keep editing.** When you finish a batch of changes, push from your Mac, then on the Pi follow **section 6** (repo pull, install refresh, reboot).

---

## 0 — First-time kiosk install on this Pi

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/*.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

To **keep Chromium autostart as well**, use **`SEQUENCE_DISABLE_CHROMIUM_KIOSK=0`** with that command. Else Chromium autostart is removed by default.

---

## 1 — Arduino Nano (prefab sketch + terminal upload)

The repo ships a sketch you **never hand-edit unless you change the pin**:

- Sketch: **`Sequence_IOS/deploy/raspberry-pi/arduino/exhibit_sensor/exhibit_sensor.ino`**
- Default wiring: sensor **OUT → D2**, **5V → 5V**, **GND → GND**
- Baud **`115200`** (must match **`SEQUENCE_NATIVE_SERIAL_BAUD`** in **`kiosk.conf`**)

Upload from the machine where the Nano is plugged in (usually your laptop). **Arduino IDE optional.**

### One-time tool install

```bash
brew install arduino-cli
```

**(Linux Raspberry Pi)**

```bash
sudo apt-get update && sudo apt-get install -y arduino-cli || true
```

If **`apt`** has no **`arduino-cli`**, use Arduino’s installer: **[arduino-cli installation](https://arduino.github.io/arduino-cli/latest/installation/)**.

### Every upload (terminal only)

From your repo root:

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh
./deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh
```

That prints **`arduino-cli board list`**. Pick the Nano’s **`Port`** (macOS **`/dev/cu.…`**; Linux **`/dev/ttyACM0`** or **`/dev/ttyUSB0`**).

```bash
./deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh /dev/cu.YOUR_PORT_HERE
```

**Upload fails (“device not syncing”)**: many clones need the older bootloader **`FQBN`**:

```bash
export ARDUINO_FQBN="arduino:avr:nano:cpu=atmega328old"
./deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh /dev/cu.YOUR_PORT_HERE
```

**Analog sensor on `A0`** (Pi uses **`SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD`**): edit **`exhibit_sensor.ino`** and replace the **`loop()` body** with **`Serial.println(analogRead(A0));`** (same **`delay(20)`**), then run the **`upload`** line again.

**Custom pin:** change **`#define SENSOR_PIN 2`** in **`exhibit_sensor.ino`** to match **`OUT`** ( **`3`** for **D3** ), re-run upload.

The Pi exhibit app reads **full lines** from serial — keep **`Serial.println`** (one reading per line).

---

## 2 — Raspberry Pi — which serial device?

(CH340 clones often **`/dev/ttyUSB0`**; others **`/dev/ttyACM0`**.)

```bash
ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

Put that path in **`SEQUENCE_NATIVE_SERIAL_DEVICE`** below.

---

## 3 — Image layout (`exhibit_dual_strip`)

Under **`Sequence_IOS/public/`** by default (**`SEQUENCE_DUAL_IMAGE_DIR_LEFT`** / **`_RIGHT`** can override roots):

- **Numbered folders (recommended):** `exhibit-left/1`, `exhibit-right/1`, **`2`**, **`3`**, … The same numeric id must exist on **both** sides. Folder order is shuffled each cycle; image lists inside each folder are shuffled. Pairs zip by index within each folder **`min(left_count, right_count)`**.
- **Flat layout:** JPG/PNG/WebP directly under `exhibit-left` / `exhibit-right`. Matching **`1`** / **`2`** / **`3`** subtrees must exist **on both left and right** to use numbered mode; otherwise the player pairs **top‑level files** only (no crossing numbered + flat mixes in one mode).

---

## 4 — `/etc/sequence/kiosk.conf`

```bash
sudo nano /etc/sequence/kiosk.conf
```

Example (edit **`YOUR_USER`**, device path, thresholds):

```bash
SEQUENCE_SITE_DIR=/home/YOUR_USER/Sequence_IOS

SEQUENCE_NATIVE_SERIAL_DEVICE=/dev/ttyUSB0
SEQUENCE_NATIVE_SERIAL_BAUD=115200
SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD=250
SEQUENCE_NATIVE_SERIAL_LINE_IDLE_MS=0.05

SEQUENCE_EXHIBIT_BASELINE_SLIDE_MS=1000
SEQUENCE_EXHIBIT_BASELINE_WIPE_MS=380
SEQUENCE_BURST_TOTAL_MS=15000
SEQUENCE_BURST_SLIDE_START_MS=140
SEQUENCE_BURST_SLIDE_END_MS=5200
SEQUENCE_BURST_WIPE_START_MS=55
SEQUENCE_BURST_WIPE_END_MS=950

SEQUENCE_EXHIBIT_RNG_SEED=
SEQUENCE_EXHIBIT_RESHUFFLE_EACH_CYCLE=1

SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=0

SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_HIDE_DESKTOP_PANEL_ROUNDS=30
SEQUENCE_HIDE_DESKTOP_PANEL_INTERVAL=0.2
SEQUENCE_PYGAME_OVERFLOW_TOP_PIXELS=44
SEQUENCE_PYGAME_BORDERLESS=1
```

**Sensor burst:** A rising edge on the serial stream (**`0→1`** or analog crossing **`SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD`**) starts a **`SEQUENCE_BURST_TOTAL_MS`** window where slide time and wipe time grow from **`_START_*`** toward **`_END_*`** (exponential-ish curve via **`exp_span`**); after that wall‑clock interval, timing returns to baseline. While a burst is already active, repeated edges do not restart the curve — the line should go **`0`**/`low enough` again before the next **`1`**/trigger if you want another burst.

Legacy two windows (**`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=1`**): optional **`SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS`** is passed to **`image_window.py`**. The env vars in this block apply to the default **`exhibit_dual_strip.py`** path.

---

## 5 — `dialout` (if opening serial fails / permission denied)

```bash
sudo usermod -aG dialout "$USER"
groups
```

Then **log out of the desktop session and back in**, or reboot.

---

## 6 — Apply repo, refresh kiosk scripts, reboot (after every push or `kiosk.conf` batch)

```bash
cd ~/Sequence_IOS
git pull origin main
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

Use your real branch if it is not **`main`**.

---

## 7 — Top bar still visible (Wayfire)

```bash
sudo mv /etc/xdg/autostart/wf-panel-pi.desktop /etc/xdg/autostart/wf-panel-pi.desktop.off
sudo reboot
```

Undo: rename **`.off`** back to **`.desktop`**.

---

## Optional checks

```bash
journalctl -u sequence-site.service -n 20 --no-pager
groups | grep dialout
```

---

## Scratch / extra notes

(Drafts for your next batch — wiring, pin numbers, thresholds you tried, etc.)
