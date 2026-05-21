# Exhibit kiosk — **short path**

If something breaks, use **[EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)** (Git, dual-screen sizing, Wayfire bar).

---

**Minimal setup:** Raspberry Pi desktop, user **`raspi`**, checkout **`~/Sequence_IOS`**. The dual-image installer runs **`/usr/local/bin/dual-image-kiosk-launch.sh`**, which starts **two** Python processes (**`/opt/sequence/native-kiosk/image_window.py`**) side by side. **`exhibit_dual_strip.py`** has been removed from this repo; there is **no** single-window “strip” pairing mode anymore.

Installer **drops `sequence-kiosk.desktop`** (**Chromium** autostart) unless you pass **`SEQUENCE_DISABLE_CHROMIUM_KIOSK=0`**.

Images must live directly in **`public/exhibit-left/`** and **`public/exhibit-right/`** (**no numbered subfolders** for the pygame kiosk; subfolders are ignored).

---

### 1 — Installer (once per fresh Pi)

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/*.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

---

### 2 — **`kiosk.conf`** (**geometry + timing`)

```bash
sudo install -dm755 /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

```bash
SEQUENCE_SITE_DIR=$HOME/Sequence_IOS

SEQUENCE_WINDOW_WIDTH=3840
SEQUENCE_WINDOW_HEIGHT=1080
SEQUENCE_MONITOR_LEFT_WIDTH=1920

SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS=8

SEQUENCE_DUAL_IMAGE_START_DELAY=12
SEQUENCE_KIOSK_START_DELAY=12

SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_PYGAME_BORDERLESS=1
```

**Geometry:** **`SEQUENCE_WINDOW_WIDTH`** = logical desktop width (**left + right**). **`SEQUENCE_MONITOR_LEFT_WIDTH`** = width of **left** window and **x** offset of **right**. Right width = **`WIDTH − LEFT`**. Raspberry Pi OS **Screen Configuration → extended desktop** gives separate HDMI positions.

Missing values → **`1600×480`** split in half.

Optional delay before pygame starts **`SEQUENCE_DUAL_IMAGE_START_DELAY`** (fallback **`SEQUENCE_KIOSK_START_DELAY`**).

Chromium / **`SEQUENCE_START_URL`** path: **[PI_SIMPLE_SETUP.md](PI_SIMPLE_SETUP.md)**.

---

### 3 — **`git pull`** (refresh launcher + scripts)

```bash
cd ~/Sequence_IOS
git pull origin main
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

**(Pull prompts / **`credential-osxkeychain`** → troubleshooting.)**

---

### 4 — Quick checks

```bash
ls -la "$HOME/Sequence_IOS/public/exhibit-left" "$HOME/Sequence_IOS/public/exhibit-right"
head -20 /etc/sequence/kiosk.conf
test -x /usr/local/bin/dual-image-kiosk-launch.sh && echo launcher ok
```

**Manual foreground test** (**Escape** quits that window):

```bash
cd ~/Sequence_IOS
set -a
# shellcheck disable=SC1091
[[ -r /etc/sequence/kiosk.conf ]] && . /etc/sequence/kiosk.conf
set +a
REP="${SEQUENCE_SITE_DIR:-$HOME/Sequence_IOS}"
W="${SEQUENCE_WINDOW_WIDTH:-1600}"
H="${SEQUENCE_WINDOW_HEIGHT:-480}"
LW="${SEQUENCE_MONITOR_LEFT_WIDTH:-$((W / 2))}"
RW=$((W - LW))
export DISPLAY="${DISPLAY:-:0}"
INT="${SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS:-8}"
python3 /opt/sequence/native-kiosk/image_window.py --dir "$REP/public/exhibit-left" --width "$LW" --height "$H" --x 0 --y 0 --interval "$INT" &
python3 /opt/sequence/native-kiosk/image_window.py --dir "$REP/public/exhibit-right" --width "$RW" --height "$H" --x "$LW" --y 0 --interval "$INT" &
wait
```

---

### Appendix — **`arduino-cli` + Nano**

Only needed if you work with **standalone** uploads to the sensor sketch; the **pygame kiosk launcher here does not read serial** anymore. **[EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)** still has **`arduino-cli`**, **`FQBN`**, and **`PATH`** hints.

```bash
cd ~/Sequence_IOS
mkdir -p bin
VERS=1.4.1
case "$(uname -m)" in
  aarch64|arm64) ARSUF=Linux_ARM64 ;;
  armv7l)  ARSUF=Linux_ARMv7 ;;
  armv6l)  ARSUF=Linux_ARMv6 ;;
  *) echo "unsupported cpu $(uname -m) — troubleshooting" >&2; exit 1 ;;
esac
TGZ="arduino-cli_${VERS}_${ARSUF}.tar.gz"
curl -fSL "https://github.com/arduino/arduino-cli/releases/download/v${VERS}/${TGZ}" -o "/tmp/${TGZ}"
tar xzf "/tmp/${TGZ}" -C "$(pwd)/bin"
rm -f "/tmp/${TGZ}"
chmod +x "$(pwd)/bin/arduino-cli"
grep -qxF 'export PATH="$HOME/Sequence_IOS/bin:$PATH"' ~/.bashrc 2>/dev/null || printf '\nexport PATH="$HOME/Sequence_IOS/bin:$PATH"\n' >> ~/.bashrc
```

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh
export ARDUINO_FQBN="arduino:avr:nano:cpu=atmega328old"
./deploy/raspberry-pi/arduino/upload-exhibit-sensor.sh /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
```
