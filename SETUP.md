# Setup summary

Short checklist for preparing the **Raspberry Pi 4** kiosk and hosting **Sequence** so the Pi can load the site over the internet.

---

## 1. SD card and Raspberry Pi OS

1. Install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your Mac.
2. Choose **Raspberry Pi OS (64-bit)** with **desktop** (matches the project README).
3. Open the **gear icon** before writing:
   - Set hostname, username, password, Wi‑Fi, and locale if you want a headless first boot.
   - **Enable SSH** — recommended so you can fix things from your Mac without extra peripherals.
4. Choose the correct storage device and **Write**.
5. If Imager reports an error while **zeroing the end of the card**, try another **USB reader or adapter** first; if it persists, suspect a **fake or failing SD card** (cards that lie about capacity often fail late during a full write).

---

## 2. SSH and Raspberry Pi Connect (optional)

- **SSH:** Turn it on in Imager (or enable later on the Pi). Use **SSH keys** and a strong password, especially if the Pi is not only on your home LAN.
- **Raspberry Pi Connect:** Optional. Gives **browser-based screen share and shell** via [connect.raspberrypi.com](https://connect.raspberrypi.com/) after you sign in with a **Raspberry Pi ID** on the device (**Turn On Raspberry Pi Connect** from the menu bar). Requires **Raspberry Pi OS Bookworm or newer**. Useful when you cannot physically reach the Pi; it does not replace SSH on the LAN if you prefer the terminal.

---

## 3. Pi 4 and two screens

- Use **both micro‑HDMI ports** with **two micro‑HDMI → HDMI** cables to two monitors.
- Use the **official Pi 4 power supply** (about **5.1 V / 3 A**) or equivalent stable supply; dual HDMI and video load matter.
- After boot: **Preferences → Screen Configuration** (or equivalent) to arrange displays.
- For a kiosk: enable **auto-login**, disable **screen blanking**, then autostart Chromium fullscreen to your URL (details depend on OS version; see the main README kiosk outline).
- Repo **already on the Pi**: **`deploy/raspberry-pi/DUAL_SCREEN_KIOSK_SETUP.md`** · after **`git pull`**: **`sudo ./deploy/raspberry-pi/install-boot-after-pull.sh`** then **`sudo reboot`** (then automatic on each start). **`provision-pi.sh`** stays for machines without a clone yet.

The repo includes [`netlify.toml`](netlify.toml): build **`npm ci && npm run build`**, publish directory **`dist`**.

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In [Netlify](https://www.netlify.com/), **Add new site → Import an existing project**, choose the repo, and confirm build settings (usually detected from `netlify.toml`).
3. Each deploy builds static assets: compiled CSS, generated JSON under `public/api-public-tree/`, and attempts to refresh Reddit data (falls back to committed `assets/data/reddit-videos.json` if scraping fails).

Locally you can run:

```bash
npm install
npm run build
```

Preview the output by serving the **`dist`** folder (for example `npx serve dist`).

---

## 5. Point the Pi at the live site

1. On the Pi, open Chromium (or your kiosk autostart) to your Netlify URL.
2. Open the page you need (for example `/reddit-sequence.html` or `/data-videos.html`).
3. The Pi needs **reliable internet** for this mode.

**Note:** Pages that rely on **`/api/ml`** still need the **development Node server**, not Netlify static hosting alone.

---

## 6. Where to read more

- Project behaviour, folder layout, kiosk outline: [`README.md`](README.md).
