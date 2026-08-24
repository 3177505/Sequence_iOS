const SLIDE_MS = 2500;
const TRIGGER_SLIDE_MS = 220;
const TRIGGER_MS = 15000;
const RESEARCH_STATIC = '/public/api-public-tree/research-images.json';
const RESEARCH_API = '/api/research-images';

const WIPE_MS_BASELINE = 420;
const WIPE_MS_TRIGGER = 140;

const JITTER_MS_BASELINE = 380;
const JITTER_MS_TRIGGER = 60;

let paneL = null;
let paneR = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function paneDims() {
  if (!paneL) return { w: 640, h: 480 };
  const w = Math.max(32, Math.floor(paneL.clientWidth));
  const h = Math.max(32, Math.floor(paneL.clientHeight));
  return { w, h };
}

const BC = () => window.BlendCore;

const ui = { trigger: null, serial: null, status: null, loading: null };
let initialLoad = true;

function captureUi() {
  ui.trigger = document.getElementById('trigger');
  ui.serial = document.getElementById('serial-connect');
  ui.status = document.getElementById('status');
  ui.loading = document.getElementById('blend-loading');
}

function setStatus(text) {
  if (ui.status) ui.status.textContent = text;
}

function setLoading(text) {
  if (ui.loading) {
    ui.loading.hidden = false;
    ui.loading.textContent = text;
  }
  setStatus(text);
}

function clearLoading() {
  if (ui.loading) ui.loading.hidden = true;
}

let poolBaselineL = [];
let poolBaselineR = [];
let poolTriggerL = [];
let poolTriggerR = [];
let useLeft = [];
let useRight = [];
let tickId = null;
let triggerEndId = null;
let triggerRemainingId = null;
let inTrigger = false;
let slideMs = SLIDE_MS;
let busy = false;

let displayCanvasL = null;
let displayCtxL = null;
let displayCanvasL2 = null;
let displayCtxL2 = null;
let blurCanvasL = null;
let blurCtxL = null;
let activeL = 0;
let animL = null;

let displayCanvasR = null;
let displayCtxR = null;
let displayCanvasR2 = null;
let displayCtxR2 = null;
let blurCanvasR = null;
let blurCtxR = null;
let activeR = 0;
let animR = null;

let resizeScheduled = false;
let canvasW = 0;
let canvasH = 0;

let queue = [];
let queueLoading = false;
let shownL = null;
let shownR = null;
let wipeDelayLId = null;
let wipeDelayRId = null;

function ensureVerticalBlurFilters() {
  if (document.getElementById('vblur-defs')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'vblur-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.style.left = '-9999px';
  svg.style.top = '-9999px';

  svg.innerHTML = `
    <defs>
      <filter id="vblur-base" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0 6" />
      </filter>
      <filter id="vblur-trigger" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="0 10" />
      </filter>
    </defs>
  `;

  document.body.appendChild(svg);
}

function setWipeBlur(el, on) {
  if (!el) return;
  if (!on) {
    el.style.filter = '';
    return;
  }
  el.style.filter = inTrigger ? 'url(#vblur-trigger)' : 'url(#vblur-base)';
}

function blurFadeKeyframes() {
  return [
    { opacity: 0, offset: 0 },
    { opacity: inTrigger ? 0.95 : 0.75, offset: 0.35 },
    { opacity: 0, offset: 1 },
  ];
}

function jitterDelayMs() {
  const span = inTrigger ? JITTER_MS_TRIGGER : JITTER_MS_BASELINE;
  const raw = (Math.random() * 2 - 1) * span;
  return Math.max(0, Math.round(raw));
}

function pickTriplet() {
  const union = useLeft.concat(useRight);
  if (useLeft.length === 0 || useRight.length === 0 || union.length < 3) return null;
  const u0 = useLeft[Math.floor(Math.random() * useLeft.length)];
  const u1 = useRight[Math.floor(Math.random() * useRight.length)];
  const u2 = union[Math.floor(Math.random() * union.length)];
  return [u0, u1, u2];
}

function scheduleResizeFrame() {
  if (resizeScheduled) return;
  resizeScheduled = true;
  requestAnimationFrame(() => {
    resizeScheduled = false;
    syncCanvasSize();
  });
}

function mountDisplayCanvas() {
  paneL = document.getElementById('pane-left');
  paneR = document.getElementById('pane-right');
  if (!paneL || !paneR) return;
  displayCanvasL = document.createElement('canvas');
  displayCanvasL2 = document.createElement('canvas');
  blurCanvasL = document.createElement('canvas');
  displayCanvasR = document.createElement('canvas');
  displayCanvasR2 = document.createElement('canvas');
  blurCanvasR = document.createElement('canvas');

  displayCanvasL.className = 'pane-layer';
  displayCanvasL2.className = 'pane-layer';
  blurCanvasL.className = 'pane-layer';
  displayCanvasR.className = 'pane-layer';
  displayCanvasR2.className = 'pane-layer';
  blurCanvasR.className = 'pane-layer';

  displayCtxL = displayCanvasL.getContext('2d', { alpha: false });
  displayCtxL2 = displayCanvasL2.getContext('2d', { alpha: false });
  blurCtxL = blurCanvasL.getContext('2d', { alpha: false });
  displayCtxR = displayCanvasR.getContext('2d', { alpha: false });
  displayCtxR2 = displayCanvasR2.getContext('2d', { alpha: false });
  blurCtxR = blurCanvasR.getContext('2d', { alpha: false });

  activeL = 0;
  activeR = 0;
  displayCanvasL.style.transform = 'translateY(0%)';
  displayCanvasL2.style.transform = 'translateY(100%)';
  blurCanvasL.style.transform = 'translateY(100%)';
  blurCanvasL.style.opacity = '0';
  setWipeBlur(blurCanvasL, true);
  displayCanvasR.style.transform = 'translateY(0%)';
  displayCanvasR2.style.transform = 'translateY(100%)';
  blurCanvasR.style.transform = 'translateY(100%)';
  blurCanvasR.style.opacity = '0';
  setWipeBlur(blurCanvasR, true);

  paneL.replaceChildren(displayCanvasL, displayCanvasL2, blurCanvasL);
  paneR.replaceChildren(displayCanvasR, displayCanvasR2, blurCanvasR);
  const ro = new ResizeObserver(() => scheduleResizeFrame());
  ro.observe(paneL);
  ro.observe(paneR);
}

function syncCanvasSize() {
  if (!displayCanvasL || !displayCanvasL2 || !displayCanvasR || !displayCanvasR2 || !blurCanvasL || !blurCanvasR) return;
  const { w, h } = paneDims();
  if (w < 32 || h < 32) return;
  if (w === canvasW && h === canvasH) return;
  canvasW = w;
  canvasH = h;

  displayCanvasL.width = w;
  displayCanvasL.height = h;
  displayCanvasL2.width = w;
  displayCanvasL2.height = h;
  displayCanvasR.width = w;
  displayCanvasR.height = h;
  displayCanvasR2.width = w;
  displayCanvasR2.height = h;
  blurCanvasL.width = w;
  blurCanvasL.height = h;
  blurCanvasR.width = w;
  blurCanvasR.height = h;

  if (shownL) {
    const ctx = activeL === 0 ? displayCtxL : displayCtxL2;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(shownL, 0, 0, w, h);
  }
  if (shownR) {
    const ctx = activeR === 0 ? displayCtxR : displayCtxR2;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(shownR, 0, 0, w, h);
  }
}

function wipeFromTop(side, durationMs) {
  if (side === 'L') {
    const cur = activeL === 0 ? displayCanvasL : displayCanvasL2;
    const nxt = activeL === 0 ? displayCanvasL2 : displayCanvasL;
    if (animL) animL.cancel();
    if (blurCanvasL) {
      setWipeBlur(blurCanvasL, true);
      blurCanvasL.style.transform = 'translateY(-100%)';
      blurCanvasL.style.opacity = '0';
    }
    cur.style.transform = 'translateY(0%)';
    nxt.style.transform = 'translateY(-100%)';
    cur.animate(
      [{ transform: 'translateY(0%)' }, { transform: 'translateY(100%)' }],
      { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
    );
    animL = nxt.animate(
      [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
      { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
    );
    if (blurCanvasL) {
      blurCanvasL.animate(
        [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
        { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
      );
      blurCanvasL.animate(blurFadeKeyframes(), { duration: durationMs, easing: 'linear', fill: 'forwards' });
    }
    animL.onfinish = () => {
      activeL ^= 1;
      animL = null;
      const off = activeL === 0 ? displayCanvasL2 : displayCanvasL;
      off.style.transform = 'translateY(100%)';
      if (blurCanvasL) {
        blurCanvasL.style.opacity = '0';
        blurCanvasL.style.transform = 'translateY(100%)';
      }
    };
    animL.oncancel = () => {
      animL = null;
      if (blurCanvasL) {
        blurCanvasL.style.opacity = '0';
        blurCanvasL.style.transform = 'translateY(100%)';
      }
    };
  } else {
    const cur = activeR === 0 ? displayCanvasR : displayCanvasR2;
    const nxt = activeR === 0 ? displayCanvasR2 : displayCanvasR;
    if (animR) animR.cancel();
    if (blurCanvasR) {
      setWipeBlur(blurCanvasR, true);
      blurCanvasR.style.transform = 'translateY(-100%)';
      blurCanvasR.style.opacity = '0';
    }
    cur.style.transform = 'translateY(0%)';
    nxt.style.transform = 'translateY(-100%)';
    cur.animate(
      [{ transform: 'translateY(0%)' }, { transform: 'translateY(100%)' }],
      { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
    );
    animR = nxt.animate(
      [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
      { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
    );
    if (blurCanvasR) {
      blurCanvasR.animate(
        [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
        { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
      );
      blurCanvasR.animate(blurFadeKeyframes(), { duration: durationMs, easing: 'linear', fill: 'forwards' });
    }
    animR.onfinish = () => {
      activeR ^= 1;
      animR = null;
      const off = activeR === 0 ? displayCanvasR2 : displayCanvasR;
      off.style.transform = 'translateY(100%)';
      if (blurCanvasR) {
        blurCanvasR.style.opacity = '0';
        blurCanvasR.style.transform = 'translateY(100%)';
      }
    };
    animR.oncancel = () => {
      animR = null;
      if (blurCanvasR) {
        blurCanvasR.style.opacity = '0';
        blurCanvasR.style.transform = 'translateY(100%)';
      }
    };
  }
}

async function generateNextPair() {
  if (
    busy ||
    !displayCtxL ||
    !displayCtxL2 ||
    !displayCtxR ||
    !displayCtxR2 ||
    !displayCanvasL ||
    !displayCanvasL2 ||
    !displayCanvasR ||
    !displayCanvasR2
  )
    return null;
  const bc = BC();
  if (!bc) return null;
  const urlsL = pickTriplet();
  const urlsR = pickTriplet();
  if (!urlsL || !urlsR) return null;
  syncCanvasSize();
  const w = canvasW || paneDims().w;
  const h = canvasH || paneDims().h;
  if (w < 32 || h < 32) return null;
  busy = true;
  try {
    const allUrls = [...urlsL, ...urlsR];
    const flat = await bc.loadImagesForUrls(allUrls);
    const imgsL = flat.slice(0, 3);
    const imgsR = flat.slice(3, 6);
    for (const im of flat) {
      if (!bc.imageLoadOk(im)) {
        throw new Error('Obrázek se nepodařilo načíst (zkontrolujte URL).');
      }
    }
    const outL = bc.blendLikeProcessing(imgsL[0], imgsL[1], imgsL[2], w, h);
    const outR = bc.blendLikeProcessing(imgsR[0], imgsR[1], imgsR[2], w, h);
    if (!outL?.width || !outR?.width) {
      throw new Error('Výstup blendu je prázdný.');
    }
    return { outL, outR };
  } catch (e) {
    setStatus(String(e?.message || e));
    return null;
  } finally {
    busy = false;
  }
}

async function fillQueue() {
  if (queueLoading) return;
  queueLoading = true;
  try {
    while (queue.length < 2) {
      const pair = await generateNextPair();
      if (!pair) break;
      queue.push(pair);
    }
  } finally {
    queueLoading = false;
  }
}

function showInstant(pair) {
  syncCanvasSize();
  const w = canvasW || paneDims().w;
  const h = canvasH || paneDims().h;
  if (w < 32 || h < 32) return;
  shownL = pair.outL;
  shownR = pair.outR;
  const ctxL = activeL === 0 ? displayCtxL : displayCtxL2;
  const ctxR = activeR === 0 ? displayCtxR : displayCtxR2;
  ctxL.clearRect(0, 0, w, h);
  ctxR.clearRect(0, 0, w, h);
  ctxL.drawImage(pair.outL, 0, 0, w, h);
  ctxR.drawImage(pair.outR, 0, 0, w, h);
}

function advanceIfReady() {
  if (!queue.length) return;
  syncCanvasSize();
  const w = canvasW || paneDims().w;
  const h = canvasH || paneDims().h;
  if (w < 32 || h < 32) return;
  const pair = queue.shift();
  if (!pair) return;
  shownL = pair.outL;
  shownR = pair.outR;

  const dur = inTrigger ? WIPE_MS_TRIGGER : WIPE_MS_BASELINE;
  const ctxInL = activeL === 0 ? displayCtxL2 : displayCtxL;
  const ctxInR = activeR === 0 ? displayCtxR2 : displayCtxR;
  ctxInL.clearRect(0, 0, w, h);
  ctxInR.clearRect(0, 0, w, h);
  ctxInL.drawImage(pair.outL, 0, 0, w, h);
  ctxInR.drawImage(pair.outR, 0, 0, w, h);
  if (blurCtxL && blurCanvasL) {
    blurCtxL.clearRect(0, 0, w, h);
    blurCtxL.drawImage(pair.outL, 0, 0, w, h);
  }
  if (blurCtxR && blurCanvasR) {
    blurCtxR.clearRect(0, 0, w, h);
    blurCtxR.drawImage(pair.outR, 0, 0, w, h);
  }
  if (wipeDelayLId !== null) {
    window.clearTimeout(wipeDelayLId);
    wipeDelayLId = null;
  }
  if (wipeDelayRId !== null) {
    window.clearTimeout(wipeDelayRId);
    wipeDelayRId = null;
  }
  wipeDelayLId = window.setTimeout(() => {
    wipeDelayLId = null;
    wipeFromTop('L', dur);
  }, jitterDelayMs());
  wipeDelayRId = window.setTimeout(() => {
    wipeDelayRId = null;
    wipeFromTop('R', dur);
  }, jitterDelayMs());
  fillQueue();
}

function finishInitialLoad(ok) {
  if (!initialLoad) return;
  initialLoad = false;
  clearLoading();
  if (ui.trigger) ui.trigger.disabled = !ok;
}

function primePlayback() {
  queue = [];
  shownL = null;
  shownR = null;
  if (initialLoad) setLoading('Skládám první blend…');
  fillQueue().then(() => {
    if (!queue.length) {
      finishInitialLoad(false);
      return;
    }
    const first = queue.shift();
    showInstant(first);
    finishInitialLoad(true);
    if (!inTrigger) {
      setStatus(
        'Základní režim — public/research (libovolné podsložky) nebo public/4_Research. Běží npm run dev.',
      );
    }
    fillQueue();
  });
}

function stopTimers() {
  if (tickId !== null) {
    window.clearInterval(tickId);
    tickId = null;
  }
  if (wipeDelayLId !== null) {
    window.clearTimeout(wipeDelayLId);
    wipeDelayLId = null;
  }
  if (wipeDelayRId !== null) {
    window.clearTimeout(wipeDelayRId);
    wipeDelayRId = null;
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

function poolsReady() {
  const u = useLeft.concat(useRight);
  return useLeft.length > 0 && useRight.length > 0 && u.length >= 3;
}

function startBaseline() {
  stopTimers();
  inTrigger = false;
  slideMs = SLIDE_MS;
  useLeft = shuffle(poolBaselineL);
  useRight = shuffle(poolBaselineR);
  if (!poolsReady()) {
    finishInitialLoad(false);
    if (ui.trigger) ui.trigger.disabled = true;
    setStatus(
      'Potřebujete ≥3 obrázky (jpg/png/webp/gif) kdekoliv pod public/research, v public/4_Research, nebo v baseline-left a baseline-right. Spusťte npm run dev (serve nemá /api).',
    );
    return;
  }
  if (ui.trigger) ui.trigger.disabled = initialLoad;
  if (!initialLoad) {
    setStatus(
      'Základní režim — public/research (libovolné podsložky) nebo public/4_Research. Běží npm run dev.',
    );
  }
  tickId = window.setInterval(advanceIfReady, slideMs);
  primePlayback();
}

function updateTriggerStatus(remainingSec) {
  setStatus(`Spouštěč (zbývá ${remainingSec} s) — fondy pro spouštěč nebo 4_Research.`);
}

function startTrigger() {
  if (!poolsReady()) return;
  stopTimers();
  inTrigger = true;
  slideMs = TRIGGER_SLIDE_MS;
  if (ui.trigger) ui.trigger.disabled = true;
  useLeft = shuffle(poolTriggerL.length ? poolTriggerL : poolBaselineL);
  useRight = shuffle(poolTriggerR.length ? poolTriggerR : poolBaselineR);
  let remaining = Math.ceil(TRIGGER_MS / 1000);
  updateTriggerStatus(remaining);
  triggerRemainingId = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) updateTriggerStatus(remaining);
  }, 1000);
  tickId = window.setInterval(advanceIfReady, slideMs);
  triggerEndId = window.setTimeout(() => {
    startBaseline();
  }, TRIGGER_MS);
  primePlayback();
}

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
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.length > 0 && !inTrigger) startTrigger();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function loadResearchPayload() {
  let res = await fetch(RESEARCH_STATIC, { cache: 'no-store' });
  if (!res.ok) res = await fetch(RESEARCH_API, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${RESEARCH_API} ${res.status} (spusťte npm run dev)`);
  return res.json();
}

function bindUiHandlers() {
  ui.trigger?.addEventListener('click', () => {
    if (inTrigger) return;
    startTrigger();
  });
  ui.serial?.addEventListener('click', async () => {
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
      setStatus('Sériový port otevřen — spusťte sekvenci z Arduina Nano.');
      readSerialLines(serialPort);
    } catch (e) {
      serialPort = null;
      if (e?.name !== 'NotFoundError') setStatus(String(e.message || e));
    }
  });
}

async function init() {
  captureUi();
  bindUiHandlers();
  mountDisplayCanvas();
  ensureVerticalBlurFilters();
  setLoading('Načítám — skenuji výzkumné obrázky…');
  if (ui.trigger) ui.trigger.disabled = true;
  try {
    const json = await loadResearchPayload();
    poolBaselineL = Array.isArray(json?.baseline?.left) ? json.baseline.left : [];
    poolBaselineR = Array.isArray(json?.baseline?.right) ? json.baseline.right : [];
    poolTriggerL = Array.isArray(json?.trigger?.left) ? json.trigger.left : [];
    poolTriggerR = Array.isArray(json?.trigger?.right) ? json.trigger.right : [];
    startBaseline();
  } catch (e) {
    finishInitialLoad(false);
    setStatus(String(e?.message || e));
    if (ui.trigger) ui.trigger.disabled = true;
  }
}

init();
