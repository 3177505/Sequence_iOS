# Exhibit kiosk — **troubleshooting**

Happy path checklist: **[EXHIBIT_KIOSK_RUNBOOK.md](EXHIBIT_KIOSK_RUNBOOK.md)**

---

## **`git`** on Pi: **`credential-osxkeychain`**

A **`~/.gitconfig`** copied from macOS sometimes registers Apple’s credential helper (`osxkeychain`) on **`raspi`**, which does not exist on Linux:

```bash
git config --global --unset-all credential.helper
git config --global credential.helper store
```

Next **`git pull`** asks for HTTPS credentials once; **`store`** keeps them in **`~/.git-credentials`** (fine for a kiosk box; SSH deploy keys would be tighter).

---

## **`arduino-cli`**: missing package, **`curl` 400**, **`curl` 404**, **`curl` (3)**, **`PATH`**

- **APT:** On recent Debian/Raspberry Pi OS **`arduino-cli`** is often absent → use the tarball block in **[EXHIBIT_KIOSK_RUNBOOK.md](EXHIBIT_KIOSK_RUNBOOK.md)** (**Appendix — `arduino-cli` + Nano upload**) — **not** `raw.githubusercontent.com/.../install.sh` (**HTTP 400** is common).

- **`curl: (22) … 404`:** Filename must match the release asset exactly (**`arduino-cli_${VERS}_Linux_ARM64.tar.gz`** on 64‑bit Pi, **`…_Linux_ARMv7.tar.gz`** on 32‑bit). Paste the **`curl`** **`https://github.com/arduino/arduino-cli/releases/download/v…`** line into your shell **unchanged** (chat **`…`/ellipsis** placeholders break **`curl`**). If **`uname -m`** is **`arm64`**, the runbook appendix expects **`aarch64|arm64`**. Debian package fallback (**same `VERS`**) on Raspberry Pi OS: **`curl -fSLO`** **`…/arduino-cli_${VERS}-1_arm64.deb`** (64‑bit) or **`…_armhf.deb`** (32‑bit **`armv7l`**) → **`sudo apt install -y ./*.deb`** (installs **`/usr/bin/arduino-cli`**; **`PATH`** tweak optional).

- **`curl: (3) unmatched brace/`** **`bracket`:** **`URL`** or **`curl`** quoted string contains **`}`**/garbage characters —usually a pasted **`…Z}`** or summarised **`https://github.com/…`** URL. Replace with full **`releases/download`** line from runbook **`EXHIBIT_KIOSK_RUNBOOK.md`** appendix.

- **`PATH`:** Keep **`arduino-cli`** in **`~/Sequence_IOS/bin`** add:

  **`export PATH="$HOME/Sequence_IOS/bin:$PATH"`** to **`~/.bashrc`** (shown in **`EXHIBIT_KIOSK_RUNBOOK`** appendix).

- **`upload-exhibit-sensor.sh`** prepends **`$REPO_ROOT/bin`** (**`~/Sequence_IOS`** parent of **`deploy/`**) for that process so uploads can succeed before **`bashrc`** is re-loaded.

---

## Nano upload: bootloader / **`FQBN`**

Default **`export ARDUINO_FQBN="arduino:avr:nano:cpu=atmega328old"`** matches many clones (CH340). If uploads fail with bootloader/sync errors:

```bash
export ARDUINO_FQBN="arduino:avr:nano:cpu=atmega328"
```

Re-run **`upload-exhibit-sensor.sh …`**.

Still stuck: unplug other serial consumers, toggle USB cable/power, **`arduino-cli board list`**.

---

## Serial device names

Stable ID (survives some USB reorders):

- **`/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`** → **`/dev/ttyUSB0`** (**CH340** vendor **`1a86`**).

Others may see **`ttyACM0`**. Paths are **case‑sensitive** (**`ttyUSB0`**, not **`ttyusb0`**).

Inspect:

```bash
ls -l /dev/serial/by-id/ 2>/dev/null
ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

Paste the chosen **`…/by-id/…`** or **`tty…`** device into **`SEQUENCE_NATIVE_SERIAL_DEVICE`** in **`/etc/sequence/kiosk.conf`**.

**`dialout`:** kiosk user (**`raspi`**) belongs to **`dialout`** (**`sudo usermod -aG dialout raspi`**) then full GUI logout/`reboot`.

---

## Exhibit timing (sensor **`0→1`**)

Baseline: **`SEQUENCE_EXHIBIT_BASELINE_SLIDE_MS`** (**`1000`** default) pause per paired frame; **`SEQUENCE_EXHIBIT_BASELINE_WIPE_MS`** per wipe outside burst.

Burst: a **`0→1`** serial edge starts **`SEQUENCE_BURST_TOTAL_MS`** (**`15000`** ms wall clock default). Slide/wipe move from **`SEQUENCE_BURST_*_START`** toward **`*_END`** via **`exp_span`** (**`deploy/raspberry-pi/native-kiosk/exhibit_dual_strip.py`**). **`exhibit_dual_strip.py`** does not start overlapping bursts; **`0`** then **`1`** again retriggers when no burst countdown is active.

---

## Exhibit image pairing

**Dual-window `image_window`** (**`LEGACY_TWO_PROC=1`**, default when unset in launcher): numbered subfolders **`1`**, **`2`**, … **per side** behave like a **per-display** playlist (order of folders shuffled, then images inside each folder). **Loose files in the root** of **`exhibit-left` / **`exhibit-right`** are used only when **no** digit-named folder there contains images. Older **`image_window`** builds only scanned the **root**, so **`…/left/1/a.jpg`** made **that side appear black**.

**`exhibit_dual_strip`** (**`LEGACY_TWO_PROC=0`**): For each **`N`** (**`1`**, **`2`**, …**) create **`~/Sequence_IOS/public/exhibit-left/N`** and **`~/Sequence_IOS/public/exhibit-right/N`** with paired images inside; kiosk shuffles folder IDs **then zips filenames by index**.

Only loose files (**no mirrored numeric dirs**) ⇒ **`build_flat_timeline`**.

**Analog readings:** **`SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD`**. **`kiosk.conf`** may set **`SEQUENCE_NATIVE_SERIAL_ANALOG_THRESHOLD=-1`** to disable analogue handling in **`serial_reader`** (same file).

---

## Two pygame windows vs one strip; Chromium

- **Dual-image kiosk** (**`install-dual-image-kiosk.sh`**) autostarts **`dual-image-kiosk-launch.sh`** (Python). By default it **deletes** **`/etc/xdg/autostart/sequence-kiosk.desktop`** (**Chromium**). If the browser still opens, list **`ls /etc/xdg/autostart/`** and **`grep -R sequence /etc/xdg/autostart`** — remove or disable other **`chromium`/`chrome`** entries, or re-run the installer with **`SEQUENCE_DISABLE_CHROMIUM_KIOSK=1`** (default).
- **`SEQUENCE_EXHIBIT_LEGACY_TWO_PROC`** omitted or **`1`:** **two** **`image_window.py`** (**default**). **`0`:** **`exhibit_dual_strip.py`**. **[EXHIBIT_KIOSK_RUNBOOK.md](EXHIBIT_KIOSK_RUNBOOK.md)**.

## Two HDMI — only one panel fills or missing right window

Launcher sizes come from **`SEQUENCE_WINDOW_WIDTH`**, **`SEQUENCE_WINDOW_HEIGHT`**, **`SEQUENCE_MONITOR_LEFT_WIDTH`**. Missing → **`1600×480`**; right window can sit off-screen or tiny.

- **Legacy two-window mode:** left window **`x=0`**, **`width=LEFT`**; right **`x=LEFT`**, **`width=WIDTH−LEFT`**. You still need a virtual desktop at least **`WIDTH`** px wide — **Screen Configuration → extended** in one row is usual (**mirror** duplicates the same coordinates on both outputs).
- **Strip mode:** one pygame window **`WIDTH`×`HEIGHT`** at origin; same **`WIDTH`** requirement.

Check **`grep SEQUENCE_WINDOW /etc/sequence/kiosk.conf`**. After edits: **`pkill -f 'exhibit_dual_strip|image_window'`** then **`DISPLAY=:0 SEQUENCE_DUAL_IMAGE_START_DELAY=0 /usr/local/bin/dual-image-kiosk-launch.sh`** (**or reboot**).

Wayland quirks — **[PI_SIMPLE_SETUP.md](PI_SIMPLE_SETUP.md)** (**Two monitors**).

---

## Desktop top panel (Wayfire **`wf-panel-pi`** / LXDE **`lxpanel`**)

During exhibit **`SEQUENCE_HIDE_DESKTOP_PANEL=1`** (**`kiosk.conf`**) runs **`sequence-hide-desktop-panel.sh`**, which **kills** the panel. **`dual-image-kiosk-launch.sh`** starts it again when **`exhibit_dual_strip`** (**or legacy windows**) exits. **`git pull`** **then** **`sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh`** updates **`/usr/local/bin/dual-image-kiosk-launch.sh`** so that **restore** behaviour is installed.

Manual bring-back after killing exhibit (**`Wayfire`** typical):

```bash
wf-panel-pi &
```

**Never hide:** set **`SEQUENCE_HIDE_DESKTOP_PANEL=0`**, **`reboot`**.

---

## Wayfire top bar (`wf-panel-pi`)

```bash
sudo mv /etc/xdg/autostart/wf-panel-pi.desktop /etc/xdg/autostart/wf-panel-pi.desktop.off
sudo reboot
```

Revert: **`wf-panel-pi.desktop.off`** → **`wf-panel-pi.desktop`**.

---

## Site service / kiosk logging

Web stack (if systemd unit exists):

```bash
journalctl -u sequence-site.service -n 40 --no-pager
```

Pygame autostart troubleshooting: confirm **`dual-image-kiosk-launch.sh`** exits cleanly, **`/etc/xdg/autostart/sequence-dual-image.desktop`** still points at **`/usr/local/bin/dual-image-kiosk-launch.sh`**, rerun **`sudo SEQUENCE_SITE_DIR="$(pwd)" ./deploy/raspberry-pi/install-dual-image-kiosk.sh`** after **`git pull`**.

---

## Mac shows exhibit web animation, Pi stays blank / old behaviour

Pi does **not** read TS/JS/SCSS from the repo root at runtime — **`sequence-site.service`** runs **`npm run build`**, then **`serve dist`** (see **`deploy/raspberry-pi/sequence-site.sh`**).

- **`git pull` alone:** files on disk update, but **`serve`** keeps serving **the previous `dist/` tree** until the process restarts or you run **`npm run build`** again.
- **Rebuild + restart:**
  ```bash
  cd ~/Sequence_IOS   # must match SEQUENCE_SITE_DIR / unit install path
  npm run build
  sudo systemctl restart sequence-site.service
  ```
  Wait until **`journalctl -u sequence-site.service -n 30 --no-pager`** shows a fresh **`npm run build`** finishing without errors.
- **Manifest non‑empty:** `exhibit-images.json` enumerates **`public/exhibit-left`** / **`exhibit-right`**, including **subfolders** — regenerated only **`npm run build`** ( **`generate-exhibit-images-json`** ). Check:
  ```bash
  curl -sS http://127.0.0.1:3000/public/exhibit-images.json | head -c 400
  ```
  If **`"left":[]`** or **`"right":[]`**, Images are missing from **`~/Sequence_IOS/public/...`** / build failed.
- **Chromium cache:** use a **forced reload**, or **`exhibit-left.html?cachebust=`** + random number once.
- **`npm run dev` on Pi on :3000** conflicts with **`sequence-site`** → stop whichever you are not debugging:
  **`sudo systemctl stop sequence-site.service`** (dev only) vs **restart** for production.

Also confirm **kiosk **`SEQUENCE_START_URL`** / **`SEQUENCE_START_URL_RIGHT`**:** default may still **`data-images.html`**, while **full‑screen‑per‑pane** URLs are **`/exhibit-left.html`** · **`/exhibit-right.html`**.

---

## Repo folder name casing

Checkout must match **`~/Sequence_IOS`** (**`SEQUENCE_SITE_DIR=$HOME/Sequence_IOS`**) unless you symlink.

Your GitHub checkout may be spelled **`Sequence_iOS`** locally — symlink or rename so **`cd ~/Sequence_IOS`** matches **`kiosk.conf`**.
