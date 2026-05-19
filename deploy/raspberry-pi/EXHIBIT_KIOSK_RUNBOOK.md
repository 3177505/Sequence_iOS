# Exhibit kiosk — **short path**

If something breaks, use **[EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)** (Git, dual-screen sizing, Wayfire bar, optional Arduino / **`arduino-cli`** / serial).

---

**Minimal setup:** Raspberry Pi desktop, user **`raspi`**, checkout **`~/Sequence_IOS`**. The dual-image installer runs **Python** (**`/usr/local/bin/dual-image-kiosk-launch.sh`** → **`/opt/sequence/native-kiosk/*.py`**), **not** Chromium — it removes **`sequence-kiosk.desktop`** unless you installed with **`SEQUENCE_DISABLE_CHROMIUM_KIOSK=0`**.

**Two ways to show left + right content:**

| **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC`** | What runs |
| --- | --- |
| **`1`** | **Two separate pygame windows** (**`image_window.py`** each): left at **`x=0`**, right at **`x=SEQUENCE_MONITOR_LEFT_WIDTH`**. Each side **shuffles its own folder** (flat files only under **`exhibit-left`** / **`exhibit-right`**). |
| **`0`** | **One window** (**`exhibit_dual_strip.py`**): paired left/right **in one frame**, numbered folders **`1`**, **`2`**, … on both sides; timing **`SEQUENCE_EXHIBIT_BASELINE_*`** / **`SEQUENCE_BURST_*`**. |

Placing the right window beside the left still needs a desktop wide enough (**`SEQUENCE_WINDOW_WIDTH`** = sum of outputs) — Raspberry Pi OS **Screen Configuration → extended** row is the usual way to get **`x = 0`** and **`x = 1920`** (etc.) on different HDMI heads. **Mirrored** duplicate shows both windows stacked on the same logical area.

**Arduino + IR sensor** — optional (see **[Optional](#optional--arduino-serial-sensor)** + **Appendix**): serial **`0→1`** shortens transitions where the Python reader supports it.

---

### 1 — Kiosk installers (once per fresh Pi)

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/*.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

---

### 2 — Environment (**`kiosk.conf`**) — **dual images, no Arduino**

```bash
sudo install -dm755 /etc/sequence
sudo nano /etc/sequence/kiosk.conf
```

Overwrite with values that match **your** geometry. **Two HDMI + two pygame windows** → **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=1`** (below). **Single window, paired wipes** → set it to **`0`**.

```bash
SEQUENCE_SITE_DIR=$HOME/Sequence_IOS

SEQUENCE_WINDOW_WIDTH=3840
SEQUENCE_WINDOW_HEIGHT=1080
SEQUENCE_MONITOR_LEFT_WIDTH=1920

SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=1

SEQUENCE_EXHIBIT_SLIDE_MS=1000
SEQUENCE_EXHIBIT_WIPE_MS_BASELINE=380
SEQUENCE_EXHIBIT_WIPE_MS_TRIGGER=55
SEQUENCE_EXHIBIT_TRIGGER_SLIDE_MS=70

SEQUENCE_EXHIBIT_BASELINE_SLIDE_MS=1000
SEQUENCE_EXHIBIT_BASELINE_WIPE_MS=380
SEQUENCE_BURST_TOTAL_MS=15000
SEQUENCE_BURST_SLIDE_START_MS=140
SEQUENCE_BURST_SLIDE_END_MS=5200
SEQUENCE_BURST_WIPE_START_MS=55
SEQUENCE_BURST_WIPE_END_MS=950

SEQUENCE_EXHIBIT_RNG_SEED=
SEQUENCE_EXHIBIT_RESHUFFLE_EACH_CYCLE=1

SEQUENCE_HIDE_DESKTOP_PANEL=1
SEQUENCE_HIDE_DESKTOP_PANEL_ROUNDS=30
SEQUENCE_HIDE_DESKTOP_PANEL_INTERVAL=0.2
SEQUENCE_PYGAME_OVERFLOW_TOP_PIXELS=44
SEQUENCE_PYGAME_BORDERLESS=1
```

**Geometry:** **`SEQUENCE_WINDOW_WIDTH`** should be **left + right** widths (virtual desktop spanning both outputs). **`SEQUENCE_MONITOR_LEFT_WIDTH`** is the left window width **and** the **X** position of the right window (**right width** = **`WIDTH − LEFT`**). Replace **`3840`**, **`1920`**, **`1080`** with **Screen Configuration** numbers. Missing values → **`1600×480`** fallback (**`install-dual-image-kiosk.sh`** hint).

**Strip-only timing:** **`SEQUENCE_EXHIBIT_BASELINE_*`** and **`SEQUENCE_BURST_*`** apply when **`LEGACY_TWO_PROC=0`** (**`exhibit_dual_strip`**). **`SEQUENCE_EXHIBIT_SLIDE_MS`** and **`SEQUENCE_EXHIBIT_WIPE_MS_*`** apply when **`LEGACY_TWO_PROC=1`** (**`image_window`**). Optional fixed interval (legacy): **`SEQUENCE_DUAL_IMAGE_INTERVAL_SECONDS=8`**.

Chromium / multi-URL setup (different path): **[PI_SIMPLE_SETUP.md](PI_SIMPLE_SETUP.md)**.

---

### 3 — Image folders

- **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=1`:** put image files **directly** under **`~/Sequence_IOS/public/exhibit-left`** and **`…/exhibit-right`** (each side shuffles **independently**).
- **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC=0`** (**`exhibit_dual_strip`**): use **matching numbered folders** on both sides (**`1`**, **`2`**, …) for paired sets, or **flat** files only in both roots for flat pairing (see troubleshooting).

---

### Optional — Arduino / serial sensor

When you eventually wire **Nano USB + sketch** (**`/dev/ttyUSB0`** etc.), add **`dialout`**, **`SEQUENCE_NATIVE_SERIAL_*`**, and **`arduino-cli`** + upload (**Appendix** at end of this file). **`FQBN`** / bootloader / **`by-id`** paths → **[EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)**.

**`dialout`** (only needed for Arduino upload or reading **`/dev/ttyUSB*`**):

```bash
sudo usermod -aG dialout raspi
```

Log out (or **`sudo reboot`**) after **`usermod`**.

Minimal **`kiosk.conf`** additions when hardware exists:

```bash
SEQUENCE_NATIVE_SERIAL_DEVICE=/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
SEQUENCE_NATIVE_SERIAL_BAUD=115200
SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD=250
SEQUENCE_NATIVE_SERIAL_LINE_IDLE_MS=0.05
```

---

### 4 — After **`git pull`**

```bash
cd ~/Sequence_IOS
git pull origin main
sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh
sudo reboot
```

**(Pull prompts / **`credential-osxkeychain`** → troubleshooting.)**

---

### 5 — Quick checks (**no Arduino required**)

```bash
ls -la "$HOME/Sequence_IOS/public/exhibit-left" "$HOME/Sequence_IOS/public/exhibit-right"
head -20 /etc/sequence/kiosk.conf
test -x /usr/local/bin/dual-image-kiosk-launch.sh && echo "launcher installed"
```

**Manual foreground test** (**Escape** quits both): source **`kiosk.conf`**, then either match autostart **`LEGACY`** or run one mode by hand.

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
if [[ "${SEQUENCE_EXHIBIT_LEGACY_TWO_PROC:-0}" == "1" ]]; then
  python3 /opt/sequence/native-kiosk/image_window.py --dir "$REP/public/exhibit-left" --width "$LW" --height "$H" --x 0 --y 0 &
  python3 /opt/sequence/native-kiosk/image_window.py --dir "$REP/public/exhibit-right" --width "$RW" --height "$H" --x "$LW" --y 0 &
  wait
else
  python3 /opt/sequence/native-kiosk/exhibit_dual_strip.py \
    --left-root "$REP/public/exhibit-left" \
    --right-root "$REP/public/exhibit-right" \
    --width "$W" --height "$H" --left-width "$LW" --x 0 --y 0
fi
```

---

### Appendix — **`arduino-cli` + Nano upload**

Pause or quit the dual-image kiosk if it holds the Nano’s USB serial device. Sketch: **`deploy/raspberry-pi/arduino/exhibit_sensor/`** (**`digitalRead(2)`**, **`115200`**).

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
