# Exhibit kiosk — **short path**

If something breaks, use **[EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)** (Git, **`arduino-cli`**, serial ports, bootloader, burst timing, Wayfire bar).

---

**This copy assumes:** Raspberry Pi desktop, user **`raspi`**, checkout **`~/Sequence_IOS`**, Arduino Nano USB at **`/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`** ( **`/dev/ttyUSB0`** ), IR module **OUT1 → Nano D2**, **5 V**, **GND**.

---

### 1 — Kiosk installers (once per fresh Pi)

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/*.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

---

### 2 — Serial + environment (`kiosk.conf`)

```bash
sudo install -dm755 /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

Overwrite the file with **`Ctrl+O`**, **`Enter`**, **`Ctrl+X`**:

```bash
SEQUENCE_SITE_DIR=$HOME/Sequence_IOS

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

---

### 3 — Serial permissions

```bash
sudo usermod -aG dialout raspi
```

Log out of the graphical session entirely (or **`sudo reboot`**) so **`dialout`** applies.

---

### 4 — Image folders (`exhibit_dual_strip`)

Use **`~/Sequence_IOS/public/exhibit-left`** and **`~/Sequence_IOS/public/exhibit-right`** with the **same numbered subfolders on both sides** (**`1`**, **`2`**, … pairs of JPG/PNG). Add **`~/…/left/N`** and **`~/…/right/N`** together when you add sets.

(No numbered folders **on both** sides → kiosk pairs **flat** lists in those dirs; behaviour detail → troubleshooting.)

---

### 5 — Arduino **`arduino-cli` + Nano sketch** (pause dual-image kiosk if it grabs the USB serial node)

Extract CLI into **`~/Sequence_IOS/bin`** and extend **`PATH`**:

```bash
cd ~/Sequence_IOS
mkdir -p bin
VERS=1.4.1
case "$(uname -m)" in
  aarch64) ARSUF=Linux_ARM64 ;;
  armv7l)  ARSUF=Linux_ARMv7 ;;
  armv6l)  ARSUF=Linux_ARMv6 ;;
  *) echo "unsupported cpu $(uname -m) — pick a tar.gz from troubleshooting" >&2; exit 1 ;;
esac
curl -fsSL "https://github.com/arduino/arduino-cli/releases/download/v${VERS}/arduino-cli_${VERS}_${ARSUF}.tar.gz" | tar xzf - -C "$(pwd)/bin"
chmod +x "$(pwd)/bin/arduino-cli"
printf '\nexport PATH="$HOME/Sequence_IOS/bin:$PATH"\n' >> ~/.bashrc
```

Sketch path: **`deploy/raspberry-pi/arduino/exhibit_sensor/`** (**`digitalRead(2)`**, **`115200`**).

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh
export ARDUINO_FQBN="arduino:avr:nano:cpu=atmega328old"
./deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
```

**Bootloader issue?** See **[EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)** (**`FQBN`**).

---

### 6 — After **`git pull`**

```bash
cd ~/Sequence_IOS
git pull origin main
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

**(Pull prompts / **`credential-osxkeychain`** → troubleshooting.)**

---

### 7 — Quick checks

```bash
"$HOME/Sequence_IOS/bin/arduino-cli" version
groups raspi | grep dialout
ls -l /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0 /dev/ttyUSB0
```
