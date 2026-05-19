const TRIGGER_SLIDE_MS = 52;
const TRIGGER_MS = 15000;

function exhibitManifestHref() {
  try {
    const baseEl = document.querySelector('base[href]');
    const base = baseEl?.href || new URL('./', window.location.href).href;
    return new URL('public/exhibit-images.json', base).href;
  } catch (_) {
    return '/public/exhibit-images.json';
  }
}

const SLIDE_GAP_START = 2600;
const SLIDE_GAP_FLOOR = 1000;
const SLIDE_GAP_MUL = 0.992;

const WIPE_MS_TRIGGER = 48;
const WIPE_MS_GAP_RATIO = 0.36;
const WIPE_MS_CAP = 480;
const WIPE_MS_FLOOR = 220;

const SERIAL_ANALOG_THRESHOLD = 400;
const OFFSCREEN_Y = 'translateY(110%)';

function parseSensorBoostFromSerialLine(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  const lo = s.toLowerCase();
  if (['high', 'on', 'yes', 'true', 'trigger', 'trip'].includes(lo)) return true;
  if (['low', 'off', 'no', 'false'].includes(lo)) return false;
  if (/^[01]$/.test(s)) return s === '1';
  const tokens = s.split(/[,;\t\s]+/).filter(Boolean);
  if (tokens.length >= 1 && tokens.length <= 5 && tokens.every((t) => /^[01]$/.test(t))) {
    return tokens.some((t) => t === '1');
  }
  if (/^[01]+$/.test(s)) {
    return [...s.slice(0, 5)].some((c) => c === '1');
  }
  if (/^\d+$/.test(s)) {
    const v = parseInt(s, 10);
    return v >= SERIAL_ANALOG_THRESHOLD;
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

const sideAttr = (document.body.dataset.exhibitSide || 'L').trim().toUpperCase();
const IS_RIGHT = sideAttr === 'R';
const poolKey = IS_RIGHT ? 'right' : 'left';

const appEl = document.getElementById('app');
const triggerBtn = document.getElementById('trigger');
const serialConnectBtn = document.getElementById('serial-connect');
const statusEl = document.getElementById('status');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function sortExhibitFolderKeys(keys) {
  return keys.slice().sort((a, b) => {
    if (a === '_root' && b === '_root') return 0;
    if (a === '_root') return -1;
    if (b === '_root') return 1;
    const da = /^\d+$/.test(a);
    const db = /^\d+$/.test(b);
    if (da && db) return parseInt(a, 10) - parseInt(b, 10);
    if (da) return -1;
    if (db) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function sortUrlsByPath(paths) {
  return paths.slice().sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
}

function buildFolderGroupedSequence(urls, sideKey) {
  const prefix = `/public/exhibit-${sideKey}/`;
  const buckets = new Map();
  for (const u of urls) {
    if (!u || typeof u !== 'string') continue;
    const slice = u.startsWith(prefix) ? u.slice(prefix.length) : '';
    const parts = slice.split('/').filter(Boolean);
    const top = parts.length >= 2 ? parts[0] : '_root';
    if (!buckets.has(top)) buckets.set(top, []);
    buckets.get(top).push(u);
  }
  const order = sortExhibitFolderKeys([...buckets.keys()]);
  const out = [];
  for (const k of order) {
    out.push(...sortUrlsByPath(buckets.get(k) || []));
  }
  return out.length ? out : sortUrlsByPath(urls.filter(Boolean));
}

function qImg(layer) {
  return document.querySelector(`#pane-single img.pane__media[data-layer="${layer}"]`);
}

function mountSingleSlot() {
  const pane = document.getElementById('pane-single');
  if (!pane) return null;
  const layers = Array.from(pane.querySelectorAll('.pane-layer'));
  if (layers.length < 2) return null;
  layers[0].style.transform = 'translateY(0%)';
  layers[1].style.transform = OFFSCREEN_Y;
  return { pane, layers, img: [qImg(0), qImg(1)], active: 0, anim: null };
}

const slot = mountSingleSlot();

let pool = [];
let seq = [];
let idx = 0;
let advanceTimerId = null;
let slideGapMs = SLIDE_GAP_START;
let triggerEndId = null;
let triggerRemainingId = null;
let inTrigger = false;
let sensorBoost = false;

function wipeDurationMs() {
  if (inTrigger || sensorBoost) return WIPE_MS_TRIGGER;
  return Math.max(
    WIPE_MS_FLOOR,
    Math.min(WIPE_MS_CAP, Math.round(slideGapMs * WIPE_MS_GAP_RATIO)),
  );
}

function stopAdvanceTimer() {
  if (advanceTimerId !== null) {
    window.clearTimeout(advanceTimerId);
    advanceTimerId = null;
  }
}

function restartAdvanceTimer() {
  stopAdvanceTimer();
  if (!seq.length) return;
  const gap = inTrigger || sensorBoost ? TRIGGER_SLIDE_MS : slideGapMs;
  advanceTimerId = window.setTimeout(() => {
    advanceTimerId = null;
    tick();
    restartAdvanceTimer();
  }, gap);
}

function stopTimers() {
  stopAdvanceTimer();
  if (triggerEndId !== null) {
    window.clearTimeout(triggerEndId);
    triggerEndId = null;
  }
  if (triggerRemainingId !== null) {
    window.clearInterval(triggerRemainingId);
    triggerRemainingId = null;
  }
}

function refreshBaselineStatus() {
  if (!pool.length) return;
  if (inTrigger) return;
  const label = IS_RIGHT ? 'vpravo' : 'vlevo';
  setStatus(
    sensorBoost
      ? 'Sériový vstup: rychlý posuv (kanály 1–5; některý je 1).'
      : `Základní režim: public/exhibit-${poolKey} (${label}); pořadí složky → soubor (1,2… pak A→Z); zrychlování stupňovitě.`,
  );
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

function slotSetInstantImage(url) {
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

function slotWipeFromTopImage(url, durationMs) {
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

function applyPane(animate) {
  const ln = seq.length;
  const u = seq[idx % ln];
  const dur = wipeDurationMs();
  if (!animate) {
    slotSetInstantImage(u);
    return;
  }
  slotWipeFromTopImage(u, dur);
}

function tick() {
  if (!seq.length) return;
  idx++;
  applyPane(true);
  if (!inTrigger && !sensorBoost) {
    slideGapMs = Math.max(SLIDE_GAP_FLOOR, slideGapMs * SLIDE_GAP_MUL);
  }
  if (seq.length > 1 && idx > 0 && idx % seq.length === 0) {
    seq = buildFolderGroupedSequence(pool, poolKey);
    slideGapMs = SLIDE_GAP_START;
  }
}

function startBaseline() {
  stopTimers();
  inTrigger = false;
  setMode(true);
  seq = buildFolderGroupedSequence(pool, poolKey);
  idx = 0;
  slideGapMs = SLIDE_GAP_START;
  applyPane(false);
  const ok = pool.length > 0;
  if (triggerBtn) triggerBtn.disabled = !ok;
  if (ok) refreshBaselineStatus();
  if (ok) restartAdvanceTimer();
}

function updateTriggerStatus(remainingSec) {
  setStatus(`Spouštěč (zbývá ${remainingSec} s) — rychlejší střih.`);
}

function startTrigger() {
  if (!pool.length) return;
  stopTimers();
  inTrigger = true;
  setMode(false);
  if (triggerBtn) triggerBtn.disabled = true;
  seq = shuffle(pool.slice());
  idx = 0;
  applyPane(false);
  let remaining = Math.ceil(TRIGGER_MS / 1000);
  updateTriggerStatus(remaining);
  triggerRemainingId = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) updateTriggerStatus(remaining);
  }, 1000);
  restartAdvanceTimer();
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
            stopAdvanceTimer();
            restartAdvanceTimer();
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
    setStatus('Web Serial vyžaduje Chromium. Použijte http://localhost nebo HTTPS.');
    return;
  }
  if (serialPort) {
    setStatus('Sériový port je otevřený — obnovte stránku pro znovupřipojení.');
    return;
  }
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: SERIAL_BAUD });
    setStatus(
      'Sériový port otevřen — řádek 0/1 nebo až pět hodnot 0/1; jiný neprázdný řádek = 15 s trigger.',
    );
    readSerialLines(serialPort);
  } catch (e) {
    serialPort = null;
    if (e?.name !== 'NotFoundError') setStatus(String(e.message || e));
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
      setStatus('');
      readSerialLines(serialPort);
      return;
    } catch (_) {
      serialPort = null;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function init() {
  const manifestHref = exhibitManifestHref();
  setStatus('Načítání manifestu obrázků…');

  const res = await fetch(manifestHref, { cache: 'no-store' });
  if (!res.ok)
    throw new Error(
      `${manifestHref.split('/').slice(-2).join('/')} (${res.status}) — na Raspberry spusťte v kořeni webu npm run build; soubor exhibit-images.json není verzován (.gitignore).`,
    );
  const json = await res.json();
  pool = Array.isArray(json[poolKey]) ? json[poolKey].filter(Boolean) : [];

  if (!pool.length) {
    setStatus(
      `Žádné JPG/PNG v public/exhibit-${poolKey}/ (ani v podsložkách). npm run build vytvoří exhibit-images.json.`,
    );
    if (triggerBtn) triggerBtn.disabled = true;
    return;
  }

  startBaseline();
  await maybeAutoSerialKiosk();
}

init().catch((e) => {
  setStatus(String(e?.message || e));
  if (triggerBtn) triggerBtn.disabled = true;
});
