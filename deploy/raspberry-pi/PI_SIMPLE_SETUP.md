# Raspberry Pi — simple Sequence kiosk

You need **Raspberry Pi OS with desktop** (not Lite). User below is **`raspi`** (or `pi`); repo folder is **`~/Sequence_IOS`** — use your real path.

---

## One-time setup (copy–paste in order)

1. **Flash** the SD with Pi Imager (Desktop 64-bit, Wi‑Fi, SSH if you want).

2. **Clone** (or keep your existing folder):

   ```bash
   cd ~
   git clone https://github.com/YOUR_USER/Sequence_IOS.git
   cd Sequence_IOS
   ```

3. **Git token** (private repo or smooth `git fetch` in the background service), file **only on the Pi**, never `git push`:

   ```bash
   nano deploy/raspberry-pi/.env
   ```

   One line:

   ```bash
   GITHUB_TOKEN=ghp_your_pat_here
   ```

   ```bash
   chmod 600 deploy/raspberry-pi/.env
   ```

4. **Install boot services + Chromium autostart + notifications:**

   ```bash
   chmod +x deploy/raspberry-pi/*.sh
   sudo ./deploy/raspberry-pi/install-boot-after-pull.sh
   ```

5. **Chromium + desktop notifications** (if not already there):

   ```bash
   sudo apt update
   sudo apt install -y chromium-browser libnotify-bin
   ```

6. **Desktop autologin** (required so Chromium can start — you found this already):

   ```bash
   sudo raspi-config nonint do_boot_behaviour B4
   ```

7. **Reboot**

   ```bash
   sudo reboot
   ```

---

## What you should see after reboot

1. Desktop logs in by itself.
2. A **notification**: *Waiting for local site (git pull / npm build can take a few minutes on first boot…)*  
3. When **http://127.0.0.1:3000** is ready, another **notification**: *Opening Sequence* (one Chromium or two, depending on **`kiosk.conf`**).  
4. **Chromium** uses **`/etc/sequence/kiosk.conf`** for size. **Two independent monitors:** set **`SEQUENCE_START_URL`** and **`SEQUENCE_START_URL_RIGHT`** (see § *Two monitors, two setups*). **Default left URL** if unset: **`data-images.html?kiosk=1`** (two-column exhibit images with wipe-from-top; matches web prototype). **`SEQUENCE_START_URL_RIGHT` unset:** one **`--app`** window (often spanning both HDMI if width/height match the desktop).

Background service: **`sequence-site.service`** — installed and enabled by **`install-boot-after-pull.sh`**, so it starts **on every boot**. Each service start runs **git sync to `origin/main`**, **`npm ci`**, **`npm run build`**, **`serve dist`** (and again after a crash once systemd restarts the unit).

---

## If something is wrong

```bash
bash ~/Sequence_IOS/deploy/raspberry-pi/check-kiosk-boot.sh
sudo journalctl -u sequence-site.service -n 60 --no-pager
tail -n 80 ~/.local/share/sequence-kiosk-chromium.log
```

If Chromium never appears after adding a second HDMI, set **`SEQUENCE_CHROMIUM_USE_X11_OZONE=1`** in **`/etc/sequence/kiosk.conf`** (helps some Wayland setups), raise **`SEQUENCE_KIOSK_START_DELAY`** (e.g. **`20`**), reinstall **`install-boot-after-pull.sh`**, reboot — then check the log path above.

---

## Web Serial trigger — no “Connect” popup (Chromium)

That dialog is normal browser security: sites cannot open USB serial until allowed. Two repo-supported approaches:

1. **Stay in Chromium:** install Chromium’s **`SerialAllowUsbDevicesForUrls`** policy for **`http://127.0.0.1:3000`** using your adapter’s **`lsusb`** IDs (hex **without** `0x`). Example — cheap USB‑UART (**CH340**) is often **`1a86:7523`**:

   ```bash
   lsusb
   cd ~/Sequence_IOS
   sudo SEQUENCE_WEB_SERIAL_VID_HEX=1a86 SEQUENCE_WEB_SERIAL_PID_HEX=7523 SEQUENCE_SITE_DIR="$HOME/Sequence_IOS" \
     ./deploy/raspberry-pi/install-boot-after-pull.sh
   ```

   (Already ran the installer once? **`sudo SEQUENCE_WEB_SERIAL_VID_HEX=… SEQUENCE_WEB_SERIAL_PID_HEX=… SEQUENCE_HTTP_PORT=3000 /usr/local/bin/install-web-serial-policy.sh`** then reboot.)

   Then put the **same two lines** (uncommented) in **`sudo nano /etc/sequence/kiosk.conf`**:

   ```
   SEQUENCE_WEB_SERIAL_VID_HEX=1a86
   SEQUENCE_WEB_SERIAL_PID_HEX=7523
   ```

   Reboot. The kiosk launcher adds **`&serialVid=…&serialPid=…`** to app URLs; **`app.js`** retries **`getPorts()`** and may call **`requestPort({filters})`** once enterprise policy allows it.

   Verify: **`bash ~/Sequence_IOS/deploy/raspberry-pi/check-kiosk-boot.sh`** (shows **`sequence-web-serial.json`**).

2. **Bypass the browser entirely:** § **Native Python kiosk** (`/dev/ttyUSB0` / **`ttyACM0`**).

---

## Exhibit pygame kiosk (dual windows + Arduino) — **work from here**

If the Pi already runs desktop + **`Sequence_IOS`** checkout, everything you tweak **next** (Nano sketch, `/etc/sequence/kiosk.conf`, serial speed, panel bar, `git pull` + refresh scripts) lives in one place — **not** repeated as another “first install” block here:

**Happy path:** [EXHIBIT_KIOSK_RUNBOOK.md](EXHIBIT_KIOSK_RUNBOOK.md) · **Problems / detail:** [EXHIBIT_KIOSK_TROUBLESHOOTING.md](EXHIBIT_KIOSK_TROUBLESHOOTING.md)

**Only if this Pi never had pygame dual-window install:** run once on the Pi:  
`sudo SEQUENCE_SITE_DIR="$HOME/Sequence_IOS" ./deploy/raspberry-pi/install-dual-image-kiosk.sh` then reboot (or use **`install-boot-after-pull.sh`** with **`SEQUENCE_BOOT_INSTALL_DUAL_IMAGE=1`** during a fresh SD bring-up — same idea as § *One-time setup* above).

---

## Native Python kiosk (two panes + auto USB serial, no Chromium)

Browsers block silent USB serial unless you installed **`SerialAllowUsbDevicesForUrls`** (§ **Web Serial trigger** above). This Python kiosk skips the browser and opens **`/dev/ttyACM0`** / **`ttyUSB0`** directly (**115200** baud); any non‑empty line triggers like **`assets/js/app.js`**.

Same dual layout: one window, half width left / half width right (**`SEQUENCE_*` dimensions** from **`/etc/sequence/kiosk.conf`**).

On the Pi (after **`git pull`** so this script exists):

```bash
cd ~/Sequence_IOS
chmod +x deploy/raspberry-pi/*.sh
sudo SEQUENCE_SITE_DIR="$(pwd)" SEQUENCE_DISABLE_CHROMIUM_KIOSK=1 \
  ./deploy/raspberry-pi/install-native-colors-kiosk.sh
```

Optional in **`sudo nano /etc/sequence/kiosk.conf`**:

```bash
SEQUENCE_SERIAL_DEVICE=/dev/ttyACM0
```

Logout or reboot.

To **also** drop the **`npm`/HTTP** stack when you truly only need colours on that SD:

```bash
sudo systemctl disable --now sequence-site.service
```

If you reinstall from this repo (`git pull` + rerun **`install-native-colors-kiosk.sh`**) the **`/opt/sequence/native-kiosk/`** `.py` is refreshed; **`systemctl enable sequence-site`** is unchanged until you undo it manually.

---

## Two monitors, two setups (recommended for “no website chrome” each screen)

Goal: **one Chromium window fills the left HDMI with its own `--app` URL**, and **a second Chromium window fills the right HDMI with a different URL** — not one tab that still feels like browsing the marketing shell.

1. Set **extended desktop** (not mirror) in **Screen Configuration**.
2. Edit **`/etc/sequence/kiosk.conf`** (example for two **1920×1080**):

   ```bash
   SEQUENCE_WINDOW_WIDTH=3840
   SEQUENCE_WINDOW_HEIGHT=1080
   SEQUENCE_MONITOR_LEFT_WIDTH=1920
   SEQUENCE_START_URL=http://127.0.0.1:3000/data-images.html?kiosk=1
   SEQUENCE_START_URL_RIGHT=http://127.0.0.1:3000/exhibit-right.html?kiosk=1
   ```

   With nothing set, the launcher defaults the **left** URL to **`data-images.html?kiosk=1`** (two-column exhibit images with wipe-from-top). Override with **`SEQUENCE_START_URL`** (e.g. **`data-videos.html?kiosk=1`**).

3. Reinstall the launcher after `git pull` so **`/usr/local/bin/sequence-start-chromium.sh`** is current, then reboot.

**One window across both monitors** (single page, two columns inside the page): leave **`SEQUENCE_START_URL_RIGHT`** unset; set **`SEQUENCE_START_URL`** to that page and **`SEQUENCE_WINDOW_WIDTH` / `HEIGHT`** to the combined desktop size.

Extended desktop (**not mirrored**): **Preferences → Screen Configuration**. **`SEQUENCE_WINDOW_WIDTH`** should equal **left + right** pixel widths; **`SEQUENCE_WINDOW_HEIGHT`** the row height.

Regenerate **`kiosk.conf`** from env (only when missing or **`FORCE_SEQUENCE_KIOSK_CONF=1`**):

```bash
cd ~/Sequence_IOS
sudo FORCE_SEQUENCE_KIOSK_CONF=1 SEQUENCE_SITE_DIR="$(pwd)" SEQUENCE_HTTP_PORT=3000 \
  SEQUENCE_WINDOW_WIDTH=YOUR_TOTAL_W SEQUENCE_WINDOW_HEIGHT=YOUR_H \
  ./deploy/raspberry-pi/install-kiosk-autostart.sh
```

One Chromium window spanning both monitors **with two columns drawn inside one HTML page** (e.g. **`data-videos.html?kiosk=1`**): omit **`SEQUENCE_START_URL_RIGHT`**, keep **`SEQUENCE_START_URL`** on that document and match **`SEQUENCE_*` WIDTH/HEIGHT** to the spanning window.

---

## No password prompts (unattended Pi)

Goal: **automatic desktop login**, no dialogs asking **`raspi`** password after power-on.

| Symptom | What to try |
|---------|--------------|
| **“Unlock keyring” / “Default Keyring” (blocks kiosk)** | **Do not put this password in `.env`.** (1) **`sequence-start-chromium.sh`** uses **`--password-store=basic`** after reinstall — Chromium usually stops touching Keyring. (2) GUI: Seahorse → Default Keyring → change password → empty. (3) SSH-only: § **Keyring reset via SSH** below (moves old `.keyring` files aside; Wi‑Fi secrets may need re-entry). |
| **Login screen each boot** | `sudo raspi-config nonint do_boot_behaviour B4` → reboot. Confirm **desktop** Pi OS image (not Lite). |
| **Screen blank then asks password** | **Screensaver**, **energy saving**, **screen lock**: turn off locking or disable blanking (or shorten test). |
| **You need SSH `sudo` without typing password** (field repair only) | Run `sudo visudo` and add **`raspi ALL=(ALL) NOPASSWD:ALL`** — only if the Pi is trusted; narrower NOPASSWD rules are safer. |

Prefer **SSH keys** for SSH (no SSH password guessing). Rotate your **Git PAT** (`GITHUB_TOKEN`) if it ever appeared in paste/log.

### Keyring reset via SSH (terminal, no Seahorse)

There is **no supported CLI** that cleanly sets “Default Keyring password = empty”. Moving old files aside forces new keyrings on next graphical login (**Wi‑Fi / saved secrets** that lived in those files may need entering once again):

```bash
U="$(awk -F: '$3==1000 {print $1; exit}' /etc/passwd)"
sudo -u "$U" bash -lc '
KB="$HOME/.local/share/keyrings/keyring-backup-$(date +%Y%m%d%H%M)"
mkdir -p "$KB"
shopt -s nullglob
for f in "$HOME/.local/share/keyrings/"*.keyring "$HOME/.local/share/keyrings/"*.keyring~; do
  mv "$f" "$KB/"
done
echo "Backed up under $KB"
'
sudo reboot
```

Combine with **`--password-store=basic`** in **`sequence-start-chromium.sh`** so Chromium stops asking Keyring for its password store.
