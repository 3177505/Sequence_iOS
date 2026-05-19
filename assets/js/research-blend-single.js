const SLIDE_MS = 2500;
const TRIGGER_SLIDE_MS = 220;
const TRIGGER_MS = 15000;

function researchStaticHref() {
  try {
    const baseEl = document.querySelector('base[href]');
    const base = baseEl?.href || new URL('./', window.location.href).href;
    return new URL('public/api-public-tree/research-images.json', base).href;
  } catch (_) {
    return '/public/api-public-tree/research-images.json';
  }
}

function researchApiHref() {
  try {
    const baseEl = document.querySelector('base[href]');
    const base = baseEl?.href || new URL('./', window.location.href).href;
    return new URL('api/research-images', base).href;
  } catch (_) {
    return '/api/research-images';
  }
}

const WIPE_MS_BASELINE = 420;
const WIPE_MS_TRIGGER = 140;

const JITTER_MS_BASELINE = 380;
const JITTER_MS_TRIGGER = 60;

const sideRaw = (document.body.dataset.researchBlendPane || 'left').trim().toLowerCase();
const SIDE_LABEL = sideRaw === 'right' ? 'vpravo' : 'vlevo';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let paneMain = null;

function paneDims() {
  if (!paneMain) return { w: 640, h: 480 };
  const w = Math.max(32, Math.floor(paneMain.clientWidth));
  const h = Math.max(32, Math.floor(paneMain.clientHeight));
  return { w, h };
}

const BC = () => window.BlendCore;

const ui = { trigger: null, status: null };

function setStatus(text) {
  if (ui.status) ui.status.textContent = text;
}

function captureUi() {
  ui.trigger = document.getElementById('trigger');
  ui.status = document.getElementById('status');
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

let displayCanvasA = null;
let displayCtxA = null;
let displayCanvasB = null;
let displayCtxB = null;
let blurCanvas = null;
let blurCtx = null;
let active = 0;
let animMain = null;

let resizeScheduled = false;
let canvasW = 0;
let canvasH = 0;

let queue = [];
let queueLoading = false;
let shown = null;
let wipeDelayId = null;

function ensureVerticalBlurFilters() {
  if (document.getElementById('vblur-defs-single')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'vblur-defs-single');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.style.left = '-9999px';
  svg.style.top = '-9999px';

  svg.innerHTML = `
    <defs>
      <filter id="vblur-base-single" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0 6" />
      </filter>
      <filter id="vblur-trigger-single" x="-25%" y="-25%" width="150%" height="150%">
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
  el.style.filter = inTrigger ? 'url(#vblur-trigger-single)' : 'url(#vblur-base-single)';
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
  paneMain = document.getElementById('pane-blend');
  if (!paneMain) return;
  displayCanvasA = document.createElement('canvas');
  displayCanvasB = document.createElement('canvas');
  blurCanvas = document.createElement('canvas');

  displayCanvasA.className = 'pane-layer';
  displayCanvasB.className = 'pane-layer';
  blurCanvas.className = 'pane-layer';

  displayCtxA = displayCanvasA.getContext('2d', { alpha: false });
  displayCtxB = displayCanvasB.getContext('2d', { alpha: false });
  blurCtx = blurCanvas.getContext('2d', { alpha: false });

  active = 0;
  displayCanvasA.style.transform = 'translateY(0%)';
  displayCanvasB.style.transform = 'translateY(100%)';
  blurCanvas.style.transform = 'translateY(100%)';
  blurCanvas.style.opacity = '0';
  setWipeBlur(blurCanvas, true);

  paneMain.replaceChildren(displayCanvasA, displayCanvasB, blurCanvas);
  const ro = new ResizeObserver(() => scheduleResizeFrame());
  ro.observe(paneMain);
}

function syncCanvasSize() {
  if (!displayCanvasA || !displayCanvasB || !blurCanvas) return;
  const { w, h } = paneDims();
  if (w < 32 || h < 32) return;
  if (w === canvasW && h === canvasH) return;
  canvasW = w;
  canvasH = h;

  displayCanvasA.width = w;
  displayCanvasA.height = h;
  displayCanvasB.width = w;
  displayCanvasB.height = h;
  blurCanvas.width = w;
  blurCanvas.height = h;

  if (shown) {
    const ctx = active === 0 ? displayCtxA : displayCtxB;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(shown, 0, 0, w, h);
  }
}

function wipeFromTop(durationMs) {
  const cur = active === 0 ? displayCanvasA : displayCanvasB;
  const nxt = active === 0 ? displayCanvasB : displayCanvasA;
  if (animMain) animMain.cancel();
  if (blurCanvas) {
    setWipeBlur(blurCanvas, true);
    blurCanvas.style.transform = 'translateY(-100%)';
    blurCanvas.style.opacity = '0';
  }
  cur.style.transform = 'translateY(0%)';
  nxt.style.transform = 'translateY(-100%)';
  cur.animate(
    [{ transform: 'translateY(0%)' }, { transform: 'translateY(100%)' }],
    { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' },
  );
  animMain = nxt.animate(
    [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
    { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' },
  );
  if (blurCanvas) {
    blurCanvas.animate(
      [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
      { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' },
    );
    blurCanvas.animate(blurFadeKeyframes(), { duration: durationMs, easing: 'linear', fill: 'forwards' });
  }
  animMain.onfinish = () => {
    active ^= 1;
    animMain = null;
    const off = active === 0 ? displayCanvasB : displayCanvasA;
    off.style.transform = 'translateY(100%)';
    if (blurCanvas) {
      blurCanvas.style.opacity = '0';
      blurCanvas.style.transform = 'translateY(100%)';
    }
  };
  animMain.oncancel = () => {
    animMain = null;
    if (blurCanvas) {
      blurCanvas.style.opacity = '0';
      blurCanvas.style.transform = 'translateY(100%)';
    }
  };
}

async function generateNextBlend() {
  if (busy || !displayCtxA || !displayCtxB || !displayCanvasA || !displayCanvasB) return null;
  const bc = BC();
  if (!bc) return null;
  const urls = pickTriplet();
  if (!urls) return null;
  syncCanvasSize();
  const w = canvasW || paneDims().w;
  const h = canvasH || paneDims().h;
  if (w < 32 || h < 32) return null;
  busy = true;
  try {
    const flat = await bc.loadImagesForUrls(urls);
    for (const im of flat) {
      if (!bc.imageLoadOk(im)) {
        throw new Error('Obrázek se nepodařilo načíst (zkontrolujte URL).');
      }
    }
    const out = bc.blendLikeProcessing(flat[0], flat[1], flat[2], w, h);
    if (!out?.width) {
      throw new Error('Výstup blendu je prázdný.');
    }
    return { out };
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
      const item = await generateNextBlend();
      if (!item) break;
      queue.push(item);
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
  shown = pair.out;
  const ctx = active === 0 ? displayCtxA : displayCtxB;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(pair.out, 0, 0, w, h);
}

function advanceIfReady() {
  if (!queue.length) return;
  syncCanvasSize();
  const w = canvasW || paneDims().w;
  const h = canvasH || paneDims().h;
  if (w < 32 || h < 32) return;
  const pair = queue.shift();
  if (!pair) return;
  shown = pair.out;

  const dur = inTrigger ? WIPE_MS_TRIGGER : WIPE_MS_BASELINE;
  const ctxIn = active === 0 ? displayCtxB : displayCtxA;
  ctxIn.clearRect(0, 0, w, h);
  ctxIn.drawImage(pair.out, 0, 0, w, h);
  if (blurCtx && blurCanvas) {
    blurCtx.clearRect(0, 0, w, h);
    blurCtx.drawImage(pair.out, 0, 0, w, h);
  }
  if (wipeDelayId !== null) {
    window.clearTimeout(wipeDelayId);
    wipeDelayId = null;
  }
  wipeDelayId = window.setTimeout(() => {
    wipeDelayId = null;
    wipeFromTop(dur);
  }, jitterDelayMs());
  fillQueue();
}

function primePlayback() {
  queue = [];
  shown = null;
  fillQueue().then(() => {
    if (!queue.length) return;
    const first = queue.shift();
    showInstant(first);
    fillQueue();
  });
}

function stopTimers() {
  if (tickId !== null) {
    window.clearInterval(tickId);
    tickId = null;
  }
  if (wipeDelayId !== null) {
    window.clearTimeout(wipeDelayId);
    wipeDelayId = null;
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
  if (ui.trigger) ui.trigger.disabled = !poolsReady();
  setStatus(
    poolsReady()
      ? `Blend celá obrazovka (${SIDE_LABEL}) — jako jedna polovina research-blend.`
      : 'Potřebujete baseline left+right obrázky (viz research-blend); na Raspberry po git pull také npm run build.',
  );
  tickId = poolsReady() ? window.setInterval(advanceIfReady, slideMs) : null;
  if (poolsReady()) primePlayback();
}

function updateTriggerStatus(remainingSec) {
  setStatus(`Spouštěč (zbývá ${remainingSec} s).`);
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

async function loadResearchPayload() {
  const staticHref = researchStaticHref();
  const apiHref = researchApiHref();
  let res = await fetch(staticHref, { cache: 'no-store' });
  if (!res.ok) res = await fetch(apiHref, { cache: 'no-store' });
  if (!res.ok)
    throw new Error(
      `research obrázky ${res.status} — na Raspberry npm run build (public/api-public-tree/) nebo npm run dev.`,
    );
  return res.json();
}

function bindUiHandlers() {
  ui.trigger?.addEventListener('click', () => {
    if (inTrigger) return;
    startTrigger();
  });
}

async function init() {
  captureUi();
  bindUiHandlers();
  mountDisplayCanvas();
  ensureVerticalBlurFilters();
  try {
    const json = await loadResearchPayload();
    poolBaselineL = Array.isArray(json?.baseline?.left) ? json.baseline.left : [];
    poolBaselineR = Array.isArray(json?.baseline?.right) ? json.baseline.right : [];
    poolTriggerL = Array.isArray(json?.trigger?.left) ? json.trigger.left : [];
    poolTriggerR = Array.isArray(json?.trigger?.right) ? json.trigger.right : [];
    startBaseline();
  } catch (e) {
    setStatus(String(e?.message || e));
    if (ui.trigger) ui.trigger.disabled = true;
  }
}

init();
