# Raspberry Pi · Sequence kiosk (hands-off)

Upstream: https://github.com/3177505/Sequence_iOS  
Scripts: `deploy/raspberry-pi/`.

---

## 1. What “fully automatic” covers

After the SD card exists and the Pi joins the network:

- **Git checkout** refreshed on every **`sequence-site.service`** start, static **`npm run build`**, **`serve dist`** listens on **`SEQUENCE_HTTP_PORT`** (defaults **3000**).
- **Desktop auto-login** (UID 1000, usually **`pi`**).
- **Chromium opens by itself**: **`/etc/xdg/autostart/sequence-kiosk.desktop`** runs **`sequence-start-chromium.sh`**, which waits until **TCP :3000** answers, then either **one Chromium** **`--app`** at **`window-size`** from **`/etc/sequence/kiosk.conf`**, or **two Chromium windows** (left + right HDMI) when **`SEQUENCE_START_URL_RIGHT`** is set (**`SEQUENCE_MONITOR_LEFT_WIDTH`** splits **`SEQUENCE_WINDOW_WIDTH`**). Default left URL **`data-images.html?kiosk=1`** (two-column exhibit images); override with **`SEQUENCE_START_URL`**.

You still take care of flashing the OS via **Pi Imager** once (keyboardless later if SSH or Imager’s first‑boot commands are configured).

Hardware layout (**extended** twin HDMI, PSU, cabling) stays physical—you cannot automate cable quality.

---

## 2. Repo already on disk (Pi Imager + Node + git + clone)

Use this when **`Sequence_iOS` is already cloned** on the Pi and you only need the **latest deploy scripts** (`git pull`) and **one install** so every **subsequent boot is automatic**.

```bash
cd ~/Sequence_iOS
git pull origin main
chmod +x deploy/raspberry-pi/*.sh
sudo ./deploy/raspberry-pi/install-boot-after-pull.sh
sudo reboot
```

This writes **`sequence-site.service`**, **`/usr/local/bin/sequence-start-chromium.sh`**, **`/etc/xdg/autostart/sequence-kiosk.desktop`**, and **`/etc/sequence/kiosk.conf`** (created if missing). It also runs **`raspi-config nonint do_boot_behaviour B4`** when available (desktop autologin).

- **Updates to the site** after you push Git: every restart of **`sequence-site.service`** (including each boot) resets the working tree to **`origin/main`**, runs **`npm ci`**, **`npm run build`**, and serves **`dist`**.
- **Private repo / PAT:** **`GITHUB_TOKEN`** (or **`GIT_USERNAME`** + PAT in **`GIT_PASSWORD`**) → either **`Sequence_iOS/.env`** (gitignored — never **`git push`**) **`chmod 600`**, OR machine-only **`/etc/sequence/git.env`** (same keys — **`chmod 640`**, **`sudo chown root:pi`** so user **`pi`** can read). See **`deploy/raspberry-pi/.env.example`** and **`deploy/raspberry-pi/git-env.on-pi.example`**. Copy from your laptop once: **`scp git-env.local pi:/tmp/git.env`** then **`sudo mv /tmp/git.env /etc/sequence/git.env`**. Prefer **`/etc/…`** if resets clone often and you hate recreating **`~/*.env`**.
- **`/etc/sequence/kiosk.conf`**: if it already exists, it is **not** overwritten (keeps your tweaks). To reset it from defaults:
  `sudo FORCE_SEQUENCE_KIOSK_CONF=1 ./deploy/raspberry-pi/install-boot-after-pull.sh`

---

## 3. Clean slate from the network only (`provision-pi.sh`)

**Must run as root:**

```bash
curl -fsSL https://raw.githubusercontent.com/3177505/Sequence_iOS/main/deploy/raspberry-pi/provision-pi.sh | sudo bash
```

Typical invocation from laptop (replace host):

```bash
ssh pi@raspberrypi.local 'curl -fsSL https://raw.githubusercontent.com/3177505/Sequence_iOS/main/deploy/raspberry-pi/provision-pi.sh | sudo bash'
```

Pi Imager “Run script after flash” can paste the **`curl … | sudo bash`** line when you have no clone yet.

Provisioning installs **Git, Chromium**, **Node 20 via NodeSource** when needed, clones **`~/Sequence_iOS`** (unless **`SEQUENCE_SITE_DIR`** points elsewhere), installs the same systemd + Chromium autostart as **`install-boot-after-pull.sh`**.

**Skip `apt` entirely** if everything is already installed:  
`sudo SEQUENCE_SKIP_APT=1 bash …/provision-pi.sh` (still clones if `SEQUENCE_SITE_DIR` has no `.git`).

Finish with **`sudo reboot`**. From the next boot onward behaviour matches **§2**.

### Environment knobs (`provision-pi.sh`; also use with `curl | sudo env … bash`)


| Variable | Default |
|-----------|---------|
| **`SEQUENCE_REPO_URL`** | `https://github.com/3177505/Sequence_iOS.git` |
| **`SEQUENCE_REPO_BRANCH`** | `main` |
| **`SEQUENCE_SITE_DIR`** | `/home/<uid1000>/Sequence_iOS` |
| **`SEQUENCE_HTTP_PORT`** | `3000` (wired into systemd + kiosk.conf) |
| **`SEQUENCE_WINDOW_WIDTH` / `_HEIGHT`** | `1600` / `480` |
| **`SEQUENCE_SKIP_APT`** | `0` · set **`1`** to skip all `apt` steps (machine already has git, chromium, Node 18+). |

Example alternate port:

```bash
sudo env SEQUENCE_HTTP_PORT=8080 bash -s < <(curl -fsSL https://raw.githubusercontent.com/3177505/Sequence_iOS/main/deploy/raspberry-pi/provision-pi.sh)
```

(`provision-pi.sh` forwards **`SEQUENCE_HTTP_PORT`** before calling **`install-sequence-systemd.sh`**.)

**`install-boot-after-pull.sh`** honours **`SEQUENCE_SITE_DIR`** (defaults to this repo checkout), **`SEQUENCE_SERVICE_USER`** (UID 1000 login), **`SEQUENCE_HTTP_PORT`**, **`SEQUENCE_WINDOW_WIDTH` / `_HEIGHT`**, **`FORCE_SEQUENCE_KIOSK_CONF=1`** (rewrite **`/etc/sequence/kiosk.conf`**), **`SEQUENCE_ENABLE_DESKTOP_AUTOLOGIN=0`** (skip **`raspi-config` B4**).


---

## 4. Architecture reminder

| Piece | Role |
|--------|------|
| **Extended desktop** | Horizontal span (not mirror)—Sequence’s **left/right DOM panes** line up one physical TFT each. |
| **Single Chromium** | Web Serial (**Nano**) stays usable; two browsers ⇒ two unrelated sessions / confusion. |

---

## 5. Tweaks later

### Window size / URL

```bash
sudo nano /etc/sequence/kiosk.conf
```

Logout from desktop or reboot Chromium.

### systemd site service

```bash
journalctl -fu sequence-site.service
sudo systemctl restart sequence-site.service
```

Each start **wiped working tree ⇒ `origin/<branch>`**. Do not edit kiosk content only on-device long term.

### Manual reinstall (advanced)

```bash
cd ~/Sequence_iOS
git pull
sudo ./deploy/raspberry-pi/install-boot-after-pull.sh
```

Prefer **`install-boot-after-pull.sh`** (`git pull`, then script, then **`reboot`**) — see **§2** of this file.

---

## 6. Web Serial caveat

Browsers disallow silent first-time Serial consent. **`?kiosk=1`** **`getPorts()`** path only works once Chromium pairing already stored in the kiosk profile (**`sequence-chromium-kiosk`** under **`~/.local/share/`**).  
For completely zero-touch Nano pairing without ever touching Pi UI you would need Chromium policies / a seeded profile—which is not scripted here yet; say so if you want that added.

---

## 7. Troubleshooting

| Symptom | What to inspect |
|---------|----------------|
| Blank Chromium | **`journalctl -u sequence-site`**, **`/etc/sequence/kiosk.conf`**, network time (TLS). |
| Only one TFT lit | PSU / cables / **`Screen Configuration`**. Automation cannot fix wiring. |
| Chromium only fills one monitor | Wayland quirks—raise **`SEQUENCE_WINDOW_WIDTH`** to matched **`xrandr` / GUI** totals; kiosk uses **`--app`**, not fullscreen on one output. |

---

### Appendix · low-level systemd only

Rarely useful; prefer **`sudo ./deploy/raspberry-pi/install-boot-after-pull.sh`** after `git pull` so Chromium autostart stays in sync.

```bash
cd ~/Sequence_iOS && git pull
sudo SEQUENCE_SITE_DIR="$PWD" ./deploy/raspberry-pi/install-sequence-systemd.sh
```
