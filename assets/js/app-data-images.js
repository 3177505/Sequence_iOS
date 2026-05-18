const SLIDE_MS = 2500;
const TRIGGER_SLIDE_MS = 400;
const TRIGGER_MS = 15000;
const EXHIBIT_MANIFEST = '/public/exhibit-images.json';

const WIPE_MS_BASELINE = 420;
const WIPE_MS_TRIGGER = 220;
const OFFSCREEN_Y = 'translateY(110%)';

function parseSensorBoostFromSerialLine(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  if (/^[01]$/.test(s)) return s === '1';
  const tokens = s.split(/[,;\t\s]+/).filter(Boolean);
  if (tokens.length >= 1 && tokens.length <= 5 && tokens.every((t) => /^[01]$/.test(t))) {
    return tokens.some((t) => t === '1');
  }
  if (/^[01]+$/.test(s)) {
    return [...s.slice(0, 5)].some((c) => c === '1');
  }
  return null;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const appEl = document.getElementById('app');
const triggerBtn = document.getElementById('trigger');
const serialConnectBtn = document.getElementById('serial-connect');
const statusEl = document.getElementById('status');

function qImg(side, layer) {
  return document.querySelector(`img.pane__media[data-side="${side}"][data-layer="${layer}"]`);
}

function mountSlotImage(paneId, side) {
  const pane = document.getElementById(paneId);
  if (!pane) return null;
  const layers = Array.from(pane.querySelectorAll('.pane-layer'));
  if (layers.length < 2) return null;
  layers[0].style.transform = 'translateY(0%)';
  layers[1].style.transform = OFFSCREEN_Y;
  return { pane, layers, img: [qImg(side, 0), qImg(side, 1)], active: 0, anim: null, side };
}

const slotL = mountSlotImage('pane-left', 'L');
const slotR = mountSlotImage('pane-right', 'R');

let poolLeft = [];
let poolRight = [];
let seqLeft = [];
let seqRight = [];
let idxLeft = 0;
let idxRight = 0;
let tickId = null;
let triggerEndId = null;
let triggerRemainingId = null;
let inTrigger = false;
let sensorBoost = false;

function slideIntervalMs() {
  return inTrigger || sensorBoost ? TRIGGER_SLIDE_MS : SLIDE_MS;
}

function wipeDurationMs() {
  return inTrigger || sensorBoost ? WIPE_MS_TRIGGER : WIPE_MS_BASELINE;
}

function restartSlideInterval() {
  if (tickId !== null) {
    window.clearInterval(tickId);
    tickId = null;
  }
  if (!(poolLeft.length && poolRight.length)) return;
  tickId = window.setInterval(tick, slideIntervalMs());
}

function refreshBaselineStatus() {
  if (!statusEl || !poolLeft.length || !poolRight.length) return;
  if (inTrigger) return;
  statusEl.textContent = sensorBoost
    ? 'Sériový vstup: rychlý posuv (kanály 1–5; některý je 1).'
    : 'Základní režim: obrázky public/exhibit-left · public/exhibit-right.';
}

function setMode(baseline) {
  if (!appEl) return;
  appEl.classList.toggle('app--baseline', baseline);
  appEl.classList.toggle('app--trigger', !baseline);
}

function applyImgSrc(imgEl, url) {
  if (!imgEl || !url) return;
  if (imgEl.getAttribute('src') === url) return;
  imgEl.src = url;
}

function slotSetInstantImage(slot, url) {
  if (!slot) return;
  const curLayer = slot.layers[slot.active];
  const offLayer = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();
  const curImg = slot.img[slot.active];
  applyImgSrc(curImg, url);
  curImg?.classList.remove('is-hidden');
  slot.img[slot.active ^ 1]?.classList.add('is-hidden');
  slot.img[slot.active ^ 1]?.removeAttribute('src');
  curLayer.style.transform = 'translateY(0%)';
  offLayer.style.transform = OFFSCREEN_Y;
}

function slotWipeFromTopImage(slot, url, durationMs) {
  if (!slot) return;
  const curLayer = slot.layers[slot.active];
  const nxtLayer = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();

  const curImg = slot.img[slot.active];
  const nxtImg = slot.img[slot.active ^ 1];
  applyImgSrc(nxtImg, url);
  nxtImg?.classList.remove('is-hidden');
  curImg?.classList.add('is-hidden');

  curLayer.style.transform = 'translateY(0%)';
  nxtLayer.style.transform = 'translateY(-100%)';

  curLayer.animate([{ transform: 'translateY(0%)' }, { transform: OFFSCREEN_Y }], {
    duration: durationMs,
    easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
    fill: 'forwards',
  });
  const b = nxtLayer.animate([{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }], {
    duration: durationMs,
    easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
    fill: 'forwards',
  });

  slot.anim = b;
  b.onfinish = () => {
    slot.active ^= 1;
    slot.anim = null;
    const off = slot.layers[slot.active ^ 1];
    off.style.transform = OFFSCREEN_Y;
    const oldImg = slot.img[slot.active ^ 1];
    oldImg?.removeAttribute('src');
  };
  b.oncancel = () => {
    slot.anim = null;
  };
}

function applyPanes(animate) {
  const lu = seqLeft[idxLeft % seqLeft.length];
  const ru = seqRight[idxRight % seqRight.length];
  const dur = wipeDurationMs();
  if (!animate) {
    slotSetInstantImage(slotL, lu);
    slotSetInstantImage(slotR, ru);
    return;
  }
  slotWipeFromTopImage(slotL, lu, dur);
  slotWipeFromTopImage(slotR, ru, dur);
}

function tick() {
  idxLeft++;
  idxRight++;
  applyPanes(true);
}

function stopTimers() {
  if (tickId !== null) {
    window.clearInterval(tickId);
    tickId = null;
  }
  if (triggerEndId !== null) {
    window.clearTimeout(triggerEndId);
    triggerEndId = null;
  }
  if (triggerRemainingId !== null) {
    window.clearInterval(triggerRemainingId);
    triggerRemainingId = null;
  }
}

function startBaseline() {
  stopTimers();
  inTrigger = false;
  setMode(true);
  seqLeft = shuffle(poolLeft);
  seqRight = shuffle(poolRight);
  idxLeft = 0;
  idxRight = 0;
  applyPanes(false);
  const ok = poolLeft.length && poolRight.length;
  if (triggerBtn) triggerBtn.disabled = !ok;
  if (ok) refreshBaselineStatus();
  if (ok) restartSlideInterval();
}

function updateTriggerStatus(remainingSec) {
  if (statusEl) statusEl.textContent = `Spouštěč (zbývá ${remainingSec} s) — rychlejší střih.`;
}

function startTrigger() {
  if (!poolLeft.length || !poolRight.length) return;
  stopTimers();
  inTrigger = true;
  setMode(false);
  if (triggerBtn) triggerBtn.disabled = true;
  seqLeft = shuffle(poolLeft);
  seqRight = shuffle(poolRight);
  idxLeft = 0;
  idxRight = 0;
  applyPanes(false);
  let remaining = Math.ceil(TRIGGER_MS / 1000);
  updateTriggerStatus(remaining);
  triggerRemainingId = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) updateTriggerStatus(remaining);
  }, 1000);
  restartSlideInterval();
  triggerEndId = window.setTimeout(() => {
    startBaseline();
  }, TRIGGER_MS);
}

triggerBtn?.addEventListener('click', () => {
  if (inTrigger) return;
  startTrigger();
});

const SERIAL_BAUD = 115200;
let serialPort = null;

async function readSerialLines(port) {
  const reader = port.readable.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '').trim();
        buf = buf.slice(i + 1);
        const parsed = parseSensorBoostFromSerialLine(line);
        if (parsed !== null) {
          if (parsed !== sensorBoost) {
            sensorBoost = parsed;
            restartSlideInterval();
            refreshBaselineStatus();
          }
        } else if (line.length > 0 && !inTrigger) {
          startTrigger();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

serialConnectBtn?.addEventListener('click', async () => {
  if (!('serial' in navigator)) {
    if (statusEl) statusEl.textContent = 'Web Serial vyžaduje Chromium. Použijte http://localhost nebo HTTPS.';
    return;
  }
  if (serialPort) {
    if (statusEl) statusEl.textContent = 'Sériový port je otevřený — obnovte stránku pro znovupřipojení.';
    return;
  }
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: SERIAL_BAUD });
    if (statusEl)
      statusEl.textContent =
        'Sériový port otevřen — rychlost: řádek 0/1 nebo až pět hodnot 0/1 oddělených čárkou či mezerou (kanály 1–5); jiný neprázdný řádek = 15 s trigger jako dříve.';
    readSerialLines(serialPort);
  } catch (e) {
    serialPort = null;
    if (e?.name !== 'NotFoundError' && statusEl) statusEl.textContent = String(e.message || e);
  }
});

async function maybeAutoSerialKiosk() {
  if (!document.body.classList.contains('site--kiosk')) return;
  if (!('serial' in navigator) || serialPort) return;
  const params = new URL(window.location.href).searchParams;
  const vidHex = params.get('serialVid');
  const pidHex = params.get('serialPid');
  const maxAttempts = 40;
  const delayMs = 500;
  for (let attempt = 0; attempt < maxAttempts && !serialPort; attempt++) {
    try {
      let port = null;
      const ports = await navigator.serial.getPorts();
      if (ports.length > 0) port = ports[0];
      else if (
        attempt >= 15 &&
        vidHex &&
        pidHex &&
        /^[0-9a-fA-F]{1,5}$/.test(vidHex) &&
        /^[0-9a-fA-F]{1,5}$/.test(pidHex)
      ) {
        try {
          port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: parseInt(vidHex, 16), usbProductId: parseInt(pidHex, 16) }],
          });
        } catch (_) {
          port = null;
        }
      }
      if (!port) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      serialPort = port;
      await serialPort.open({ baudRate: SERIAL_BAUD });
      if (statusEl) statusEl.textContent = '';
      readSerialLines(serialPort);
      return;
    } catch (_) {
      serialPort = null;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function init() {
  if (!statusEl) return;
  statusEl.textContent = 'Načítání manifestu obrázků…';

  const res = await fetch(EXHIBIT_MANIFEST, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${EXHIBIT_MANIFEST} nedostupné — spusťte npm run build na Pi`);
  const json = await res.json();
  poolLeft = Array.isArray(json.left) ? json.left.filter(Boolean) : [];
  poolRight = Array.isArray(json.right) ? json.right.filter(Boolean) : [];

  if (!poolLeft.length || !poolRight.length) {
    statusEl.textContent =
      'Přidejte JPG/PNG do public/exhibit-left a public/exhibit-right, pak npm run build (generuje exhibit-images.json).';
    if (triggerBtn) triggerBtn.disabled = true;
    return;
  }

  startBaseline();
  await maybeAutoSerialKiosk();
}

init().catch((e) => {
  if (statusEl) statusEl.textContent = String(e?.message || e);
  if (triggerBtn) triggerBtn.disabled = true;
});
