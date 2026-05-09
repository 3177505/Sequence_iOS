const SLIDE_MS = 5800;
const TRIGGER_SLIDE_MS = 400;
const TRIGGER_MS = 15000;
const RESEARCH_STATIC = '/public/api-public-tree/research-images.json';
const RESEARCH_API = '/api/research-images';

const WIPE_MS_BASELINE = 420;
const WIPE_MS_TRIGGER = 220;

const CYCLE_MS_L = 34000;
const CYCLE_MS_R = 29500;
const PHASE_OFFSET_MS_R = 70000;
const RAMP_MAIN_END = 0.58;
const BEYOND_GAIN = 0.62;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fract01(x) {
  return x - Math.floor(x);
}

function tri01(u) {
  return u < 0.5 ? u * 2 : 2 - u * 2;
}

function monotoneStretch(u) {
  if (u <= RAMP_MAIN_END) return u / RAMP_MAIN_END;
  const tail = (u - RAMP_MAIN_END) / (1 - RAMP_MAIN_END);
  return 1 + tail * BEYOND_GAIN;
}

function sidePhase01(nowMs, side, lagMs) {
  const lag = lagMs != null ? lagMs : 0;
  const cycle = side === 'L' ? CYCLE_MS_L : CYCLE_MS_R;
  const off = side === 'L' ? 0 : PHASE_OFFSET_MS_R;
  return fract01((nowMs + off + lag) / cycle);
}

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

function BC() {
  return window.BlendCore;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

const ui = { trigger: null, serial: null, status: null };

function captureUi() {
  ui.trigger = document.getElementById('trigger');
  ui.serial = document.getElementById('serial-connect');
  ui.status = document.getElementById('status');
}

let poolBaselineL = [];
let poolBaselineR = [];
let poolTriggerL = [];
let poolTriggerR = [];
let useLeft = [];
let useRight = [];
let triggerEndId = null;
let triggerRemainingId = null;
let triggerTickId = null;
let imageTickId = null;
let inTrigger = false;

let displayCanvasL = null;
let displayCtxL = null;
let displayCanvasL2 = null;
let displayCtxL2 = null;
let activeL = 0;
let animL = null;
let displayCanvasR = null;
let displayCtxR = null;
let displayCanvasR2 = null;
let displayCtxR2 = null;
let activeR = 0;
let animR = null;
let resizeScheduled = false;

let rafId = null;
let cacheL = null;
let cacheR = null;
let cacheLoading = false;
let triggerBusy = false;

const paramRanges = {
  overlayGate: [44, 212],
  blurRadius: [9, 34],
};

function buildOpts(side, nowMs) {
  const blurLag = side === 'L' ? 33500 : 49500;
  const cyc = side === 'L' ? CYCLE_MS_L : CYCLE_MS_R;
  const u = sidePhase01(nowMs, side, 0);
  const uBlur = sidePhase01(nowMs, side, blurLag);
  const kBlur = monotoneStretch(uBlur);
  const norm = 1 + BEYOND_GAIN;
  const knBlur = kBlur / norm;
  const [gLo, gHi] = paramRanges.overlayGate;
  const [bLo, bHi] = paramRanges.blurRadius;
  const gSpan = gHi - gLo;
  const bSpan = bHi - bLo;
  const overlayHi = gHi + gSpan * BEYOND_GAIN;
  let overlayGate = clamp(lerp(gLo, overlayHi, u), 32, 252);
  const offE = side === 'L' ? 0 : PHASE_OFFSET_MS_R * 0.29;
  const uExpand = fract01(nowMs / (cyc * 0.72) + offE);
  const overlayFeather = lerp(14, 118, tri01(uExpand));
  const offI = side === 'L' ? 0.11 : 0.56;
  const uInvert = fract01(nowMs / (cyc * 1.08) + offI + (side === 'R' ? PHASE_OFFSET_MS_R / (cyc * 4) : 0));
  const overlayInvert = tri01(uInvert);
  const offB = side === 'L' ? 0 : PHASE_OFFSET_MS_R * 0.07;
  const uBreathe = fract01(nowMs / (cyc * 1.35) + offB);
  const gateNudge = lerp(-22, 22, tri01(uBreathe));
  overlayGate = clamp(overlayGate + gateNudge, 32, 252);
  const blurRadius = clamp(lerp(bLo, bHi + bSpan * BEYOND_GAIN, knBlur), 4, 40);
  return {
    useEarthyEdge: false,
    overlayGate,
    overlayFeather,
    overlayInvert,
    blurRadius,
  };
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
    if (inTrigger) return;
    drawAnimatedStep();
  });
}

function mountDisplayCanvas() {
  paneL = document.getElementById('pane-left');
  paneR = document.getElementById('pane-right');
  if (!paneL || !paneR) return;
  displayCanvasL = document.createElement('canvas');
  displayCanvasL2 = document.createElement('canvas');
  displayCtxL = displayCanvasL.getContext('2d', { alpha: false });
  displayCtxL2 = displayCanvasL2.getContext('2d', { alpha: false });
  displayCanvasR = document.createElement('canvas');
  displayCanvasR2 = document.createElement('canvas');
  displayCtxR = displayCanvasR.getContext('2d', { alpha: false });
  displayCtxR2 = displayCanvasR2.getContext('2d', { alpha: false });

  displayCanvasL.className = 'pane-layer';
  displayCanvasL2.className = 'pane-layer';
  displayCanvasR.className = 'pane-layer';
  displayCanvasR2.className = 'pane-layer';

  activeL = 0;
  activeR = 0;
  displayCanvasL.style.transform = 'translateY(0%)';
  displayCanvasL2.style.transform = 'translateY(100%)';
  displayCanvasR.style.transform = 'translateY(0%)';
  displayCanvasR2.style.transform = 'translateY(100%)';

  paneL.replaceChildren(displayCanvasL, displayCanvasL2);
  paneR.replaceChildren(displayCanvasR, displayCanvasR2);
  const ro = new ResizeObserver(() => scheduleResizeFrame());
  ro.observe(paneL);
  ro.observe(paneR);
}

function wipeFromTop(side, durationMs) {
  if (side === 'L') {
    const cur = activeL === 0 ? displayCanvasL : displayCanvasL2;
    const nxt = activeL === 0 ? displayCanvasL2 : displayCanvasL;
    if (animL) animL.cancel();
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
    animL.onfinish = () => {
      activeL ^= 1;
      animL = null;
      const off = activeL === 0 ? displayCanvasL2 : displayCanvasL;
      off.style.transform = 'translateY(100%)';
    };
    animL.oncancel = () => {
      animL = null;
    };
  } else {
    const cur = activeR === 0 ? displayCanvasR : displayCanvasR2;
    const nxt = activeR === 0 ? displayCanvasR2 : displayCanvasR;
    if (animR) animR.cancel();
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
    animR.onfinish = () => {
      activeR ^= 1;
      animR = null;
      const off = activeR === 0 ? displayCanvasR2 : displayCanvasR;
      off.style.transform = 'translateY(100%)';
    };
    animR.oncancel = () => {
      animR = null;
    };
  }
}

function stopRaf() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function rafLoop() {
  rafId = requestAnimationFrame(rafLoop);
  drawAnimatedStep();
}

function startRaf() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(rafLoop);
}

function stopImageTick() {
  if (imageTickId !== null) {
    window.clearInterval(imageTickId);
    imageTickId = null;
  }
}

function stopTriggerTimers() {
  if (triggerTickId !== null) {
    window.clearInterval(triggerTickId);
    triggerTickId = null;
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

async function refreshImageCache() {
  if (inTrigger || cacheLoading) return;
  const bc = BC();
  if (!bc) return;
  const urlsL = pickTriplet();
  const urlsR = pickTriplet();
  if (!urlsL || !urlsR) return;
  const { w, h } = paneDims();
  if (w < 32 || h < 32) return;
  cacheLoading = true;
  try {
    const flat = await bc.loadImagesForUrls([...urlsL, ...urlsR]);
    for (const im of flat) {
      if (!bc.imageLoadOk(im)) return;
    }
    cacheL = flat.slice(0, 3);
    cacheR = flat.slice(3, 6);

    if (displayCtxL && displayCtxL2 && displayCtxR && displayCtxR2) {
      const now = performance.now();
      const pL = buildOpts('L', now);
      const pR = buildOpts('R', now);
      const outL = bc.blendLikeProcessing(cacheL[0], cacheL[1], cacheL[2], w, h, pL);
      const outR = bc.blendLikeProcessing(cacheR[0], cacheR[1], cacheR[2], w, h, pR);
      if (outL?.width && outR?.width) {
        const ctxInL = activeL === 0 ? displayCtxL2 : displayCtxL;
        const ctxInR = activeR === 0 ? displayCtxR2 : displayCtxR;
        ctxInL.drawImage(outL, 0, 0, w, h);
        ctxInR.drawImage(outR, 0, 0, w, h);
        wipeFromTop('L', WIPE_MS_BASELINE);
        wipeFromTop('R', WIPE_MS_BASELINE);
      }
    }
  } catch (e) {
    if (ui.status) ui.status.textContent = String(e?.message || e);
  } finally {
    cacheLoading = false;
  }
}

function drawAnimatedStep() {
  if (inTrigger) return;
  const bc = BC();
  if (
    !bc ||
    !displayCtxL ||
    !displayCtxL2 ||
    !displayCtxR ||
    !displayCtxR2 ||
    !cacheL ||
    !cacheR ||
    cacheLoading
  )
    return;
  const { w, h } = paneDims();
  if (w < 32 || h < 32) return;
  const now = performance.now();

  displayCanvasL.width = w;
  displayCanvasL.height = h;
  displayCanvasL2.width = w;
  displayCanvasL2.height = h;
  displayCanvasR.width = w;
  displayCanvasR.height = h;
  displayCanvasR2.width = w;
  displayCanvasR2.height = h;

  try {
    const pL = buildOpts('L', now);
    const pR = buildOpts('R', now);
    const outL = bc.blendLikeProcessing(cacheL[0], cacheL[1], cacheL[2], w, h, pL);
    const outR = bc.blendLikeProcessing(cacheR[0], cacheR[1], cacheR[2], w, h, pR);
    if (outL?.width && outR?.width) {
      const ctxOutL = activeL === 0 ? displayCtxL : displayCtxL2;
      const ctxOutR = activeR === 0 ? displayCtxR : displayCtxR2;
      ctxOutL.drawImage(outL, 0, 0, w, h);
      ctxOutR.drawImage(outR, 0, 0, w, h);
    }
  } catch (e) {
    if (ui.status) ui.status.textContent = String(e?.message || e);
  }
}

async function runTriggerFrame() {
  if (triggerBusy || !displayCtxL || !displayCtxL2 || !displayCtxR || !displayCtxR2) return;
  const bc = BC();
  if (!bc) return;
  const urlsL = pickTriplet();
  const urlsR = pickTriplet();
  if (!urlsL || !urlsR) return;
  const { w, h } = paneDims();
  if (w < 32 || h < 32) return;
  triggerBusy = true;
  try {
    displayCanvasL.width = w;
    displayCanvasL.height = h;
    displayCanvasL2.width = w;
    displayCanvasL2.height = h;
    displayCanvasR.width = w;
    displayCanvasR.height = h;
    displayCanvasR2.width = w;
    displayCanvasR2.height = h;
    const flat = await bc.loadImagesForUrls([...urlsL, ...urlsR]);
    const imgsL = flat.slice(0, 3);
    const imgsR = flat.slice(3, 6);
    for (const im of flat) {
      if (!bc.imageLoadOk(im)) {
        throw new Error('Obrázek se nepodařilo načíst (zkontrolujte URL).');
      }
    }
    const nowT = performance.now();
    const pL = buildOpts('L', nowT);
    const pR = buildOpts('R', nowT);
    const outL = bc.blendLikeProcessing(imgsL[0], imgsL[1], imgsL[2], w, h, pL);
    const outR = bc.blendLikeProcessing(imgsR[0], imgsR[1], imgsR[2], w, h, pR);
    if (!outL?.width || !outR?.width) {
      throw new Error('Výstup blendu je prázdný.');
    }
    const ctxInL = activeL === 0 ? displayCtxL2 : displayCtxL;
    const ctxInR = activeR === 0 ? displayCtxR2 : displayCtxR;
    ctxInL.drawImage(outL, 0, 0, w, h);
    ctxInR.drawImage(outR, 0, 0, w, h);
    wipeFromTop('L', WIPE_MS_TRIGGER);
    wipeFromTop('R', WIPE_MS_TRIGGER);
  } catch (e) {
    if (ui.status) ui.status.textContent = String(e?.message || e);
  } finally {
    triggerBusy = false;
  }
}

function poolsReady() {
  const u = useLeft.concat(useRight);
  return useLeft.length > 0 && useRight.length > 0 && u.length >= 3;
}

function startBaseline() {
  stopTriggerTimers();
  stopImageTick();
  stopRaf();
  inTrigger = false;
  useLeft = shuffle(poolBaselineL);
  useRight = shuffle(poolBaselineR);
  if (ui.trigger) ui.trigger.disabled = !poolsReady();
  if (ui.status) ui.status.textContent = poolsReady() ? '' : 'npm run dev • stejné fondy jako Prototyp blend';
  if (poolsReady()) {
    imageTickId = window.setInterval(refreshImageCache, SLIDE_MS);
    refreshImageCache();
    startRaf();
  }
}

function updateTriggerStatus(remainingSec) {
  if (ui.status) ui.status.textContent = `Spouštěč ${remainingSec} s`;
}

function startTrigger() {
  if (!poolsReady()) return;
  stopRaf();
  stopImageTick();
  stopTriggerTimers();
  inTrigger = true;
  cacheL = null;
  cacheR = null;
  if (ui.trigger) ui.trigger.disabled = true;
  useLeft = shuffle(poolTriggerL.length ? poolTriggerL : poolBaselineL);
  useRight = shuffle(poolTriggerR.length ? poolTriggerR : poolBaselineR);
  let remaining = Math.ceil(TRIGGER_MS / 1000);
  updateTriggerStatus(remaining);
  triggerRemainingId = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) updateTriggerStatus(remaining);
  }, 1000);
  triggerTickId = window.setInterval(runTriggerFrame, TRIGGER_SLIDE_MS);
  triggerEndId = window.setTimeout(() => {
    startBaseline();
  }, TRIGGER_MS);
  runTriggerFrame();
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
      if (ui.status) ui.status.textContent = 'Web Serial vyžaduje Chromium. Použijte http://localhost nebo HTTPS.';
      return;
    }
    if (serialPort) {
      if (ui.status) ui.status.textContent = 'Sériový port je otevřený — obnovte stránku pro znovupřipojení.';
      return;
    }
    try {
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: SERIAL_BAUD });
      if (ui.status) ui.status.textContent = 'Sériový port otevřen — spusťte sekvenci z Arduina Nano.';
      readSerialLines(serialPort);
    } catch (e) {
      serialPort = null;
      if (e?.name !== 'NotFoundError' && ui.status) ui.status.textContent = String(e.message || e);
    }
  });
}

async function init() {
  captureUi();
  bindUiHandlers();
  mountDisplayCanvas();
  try {
    const json = await loadResearchPayload();
    poolBaselineL = Array.isArray(json?.baseline?.left) ? json.baseline.left : [];
    poolBaselineR = Array.isArray(json?.baseline?.right) ? json.baseline.right : [];
    poolTriggerL = Array.isArray(json?.trigger?.left) ? json.trigger.left : [];
    poolTriggerR = Array.isArray(json?.trigger?.right) ? json.trigger.right : [];
    startBaseline();
  } catch (e) {
    if (ui.status) ui.status.textContent = String(e?.message || e);
    if (ui.trigger) ui.trigger.disabled = true;
  }
}

init();
