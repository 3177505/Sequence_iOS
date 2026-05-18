# Exhibit pygame kiosk + Arduino Nano — **from here on**

**This runbook uses:** login **`raspi`**, repo **`~/Sequence_IOS`** (same as **`cd Sequence_IOS`** immediately after **`cd ~`**), Nano USB serial **`/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`** (CH340 **`1a86`**, node **`/dev/ttyUSB0`**).

**Assumes:** Raspberry Pi OS desktop; **`Sequence_IOS`** cloned into **`~/Sequence_IOS`**; **`install-dual-image-kiosk.sh`** deployed **`dual-image-kiosk-launch.sh`** → **`exhibit_dual_strip.py`**. Write **`/etc/sequence/kiosk.conf`** exactly as section **3** (**`dual-image-kiosk-launch.sh`** reads **`SEQUENCE_NATIVE_SERIAL_*`**, pacing env vars, **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=0`** each boot).

Once **`origin/main`** contains updates, execute section **5** on this Pi: **`git pull`**, **`install-dual-image-kiosk.sh`**, **`reboot`**.

---

## 0 — First-time kiosk install on this Pi

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/*.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

---

## 1 — Arduino Nano (prefab sketch, upload on Pi)

Sketch path:

`~/Sequence_IOS/deploy/raspberry-pi/arduino/exhibit_sensor/exhibit_sensor.ino`

Wiring: IR **OUT1 → Nano D2**, IR **5V → Nano 5V**, IR **GND → Nano GND**. Sketch emits **`digitalRead(2)`** as **`0`** / **`1`** lines at **115200** baud (**`SEQUENCE_NATIVE_SERIAL_BAUD`** in **`/etc/sequence/kiosk.conf`** is **115200**).

Before upload: stop dual-image kiosk if it holds the serial port; plug Nano USB into Pi.

Arduino CLI:

```bash
sudo apt-get update
sudo apt-get install -y arduino-cli
```

Upload:

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh
export ARDUINO_FQBN="arduino:avr:nano:cpu=atmega328old"
./deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
```

Prefab **`exhibit_sensor.ino`** already uses **`Serial.println(digitalRead(2))`** and **`delay(20)`**.

---

## 2 — Image layout (`exhibit_dual_strip`)

Default roots:

`~/Sequence_IOS/public/exhibit-left`

`~/Sequence_IOS/public/exhibit-right`

Numbered mounts (shuffle order each cycle):

`~/Sequence_IOS/public/exhibit-left/1`  
`~/Sequence_IOS/public/exhibit-right/1`  
`~/Sequence_IOS/public/exhibit-left/2`  
`~/Sequence_IOS/public/exhibit-right/2`  
`~/Sequence_IOS/public/exhibit-left/3`  
`~/Sequence_IOS/public/exhibit-right/3`  
`~/Sequence_IOS/public/exhibit-left/4`  
`~/Sequence_IOS/public/exhibit-right/4`  
`~/Sequence_IOS/public/exhibit-left/5`  
`~/Sequence_IOS/public/exhibit-right/5`

Each next numeric folder **`N`** gets **`~/Sequence_IOS/public/exhibit-left/N`** and **`~/Sequence_IOS/public/exhibit-right/N`** with matching photos paired index-wise inside every folder bucket.

Flat mode JPG/PNG/WebP live strictly under **`~/Sequence_IOS/public/exhibit-left`** and **`~/Sequence_IOS/public/exhibit-right`** with **zero** mirrored numeric directories on **both** sides.

---

## 3 — `/etc/sequence/kiosk.conf`

```bash
sudo install -dm755 /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

Inside **`nano`**, clear leftovers, paste the block below only, **`Ctrl+O`**, **`Enter`**, **`Ctrl+X`**.

```bash
SEQUENCE_SITE_DIR=~/Sequence_IOS

SEQUENCE_NATIVE_SERIAL_DEVICE=/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
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

Baseline hold **1000** ms per pair; **`0→1`** on **`digitalRead(2)`** starts **`SEQUENCE_BURST_TOTAL_MS`** **`15000`**, **`exp_span`** ramps slide+wipe from **`SEQUENCE_BURST_*_START`** to **`SEQUENCE_BURST_*_END`** during **`15000`** ms; **`exhibit_dual_strip.py`** starts the next burst solely after **`digitalRead(2)`** reads **`0`** then **`1`** again.

---

## 4 — `dialout` for `raspi`

```bash
sudo usermod -aG dialout raspi
groups raspi
```

Log out GUI session completely and back in, or **`sudo reboot`**.

---

## 5 — Repo pull, refresh kiosk scripts, reboot

```bash
cd ~/Sequence_IOS
git pull origin main
sudo SEQUENCE_SITE_DIR=~/Sequence_IOS ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

---

## 6 — Top bar (`wf-panel-pi`)

```bash
sudo mv /etc/xdg/autostart/wf-panel-pi.desktop /etc/xdg/autostart/wf-panel-pi.desktop.off
sudo reboot
```

Restore: rename **`wf-panel-pi.desktop.off`** back to **`wf-panel-pi.desktop`**.

---

## 7 — Checks

```bash
journalctl -u sequence-site.service -n 20 --no-pager
groups raspi | grep dialout
ls -l /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0 /dev/ttyUSB0
```

