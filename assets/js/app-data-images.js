const MS_PER_LONG_IMAGE = 1000;
const SLIDE_MS = 2500;
const SLOT_MS = 10000;
const SLOT_SPIN_MS = 7000;
const SLOT_SETTLE_MS = 3000;
const SLOT_SETTLE_ANIM_MS = 3000;
const SLOT_SETTLE_FROM_Y = '-132%';
const SLOT_SETTLE_LAND_Y = '14%';
const SLOT_SPIN_GAP_START_MS = 420;
const SLOT_SPIN_GAP_END_MS = 38;
const SLOT_SPIN_WIPE_MS = 42;
const EXHIBIT_MANIFEST = '/public/exhibit-images.json';

const WIPE_MS_BASELINE = 420;
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
let leftFolders = null;
let rightFolders = null;
let folderMode = false;
let folderKeys = [];

let seqLeft = [];
let seqRight = [];
let idxLeft = 0;
let idxRight = 0;
let tickId = null;
let triggerEndId = null;
let triggerRemainingId = null;
let inTrigger = false;
let sensorBoost = false;
let folderPlayback = null;
let slotSpinTimer = null;
let slotStartedAt = 0;

function folderPhaseOptions() {
  return {
    mode: 'equal',
    msPerLongImage: MS_PER_LONG_IMAGE,
    holdFinalMs: 0,
  };
}

function slideIntervalMs() {
  return SLIDE_MS;
}

function wipeDurationMs() {
  return WIPE_MS_BASELINE;
}

function stopFolderPlayback() {
  if (folderPlayback) {
    folderPlayback.stop();
    folderPlayback = null;
  }
}

function restartSlideInterval() {
  if (tickId !== null) {
    window.clearInterval(tickId);
    tickId = null;
  }
  if (folderMode || !(poolLeft.length && poolRight.length)) return;
  tickId = window.setInterval(tick, slideIntervalMs());
}

function formatFolderStatus(ctx) {
  const sec = Math.round(ctx.timing.durationMs / 1000);
  const li = ctx.folderIndex + 1;
  const lc = ctx.folderCount;
  return `Složka ${ctx.key} (${li}/${lc}) · L ${ctx.timing.leftCount} · R ${ctx.timing.rightCount} · ~${sec} s`;
}

function refreshBaselineStatus(ctx) {
  if (!statusEl || inTrigger) return;
  if (ctx) {
    statusEl.textContent = formatFolderStatus(ctx);
    return;
  }
  if (folderMode && folderKeys.length) {
    statusEl.textContent = `Složky ${folderKeys.join(', ')} — synchronní přehrávání (~${MS_PER_LONG_IMAGE / 1000} s / obr. na delší straně).`;
    return;
  }
  if (!poolLeft.length || !poolRight.length) return;
  statusEl.textContent = 'Základní režim: synchronní složky exhibit-left · exhibit-right.';
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

function cancelSlotAnimations(slot) {
  if (!slot) return;
  if (slot.anim) {
    slot.anim.cancel();
    slot.anim = null;
  }
  for (const layer of slot.layers) {
    for (const anim of layer.getAnimations()) anim.cancel();
  }
}

function resetSlotPane(slot) {
  if (!slot) return;
  cancelSlotAnimations(slot);
  slot.active = 0;
  slot.layers[0].style.transform = 'translateY(0%)';
  slot.layers[1].style.transform = OFFSCREEN_Y;
  slot.img[0]?.classList.remove('is-hidden');
  slot.img[1]?.classList.add('is-hidden');
}

function slotSetInstantImage(slot, url) {
  if (!slot) return;
  cancelSlotAnimations(slot);
  const curLayer = slot.layers[slot.active];
  const offLayer = slot.layers[slot.active ^ 1];
  const curImg = slot.img[slot.active];
  applyImgSrc(curImg, url);
  curImg?.classList.remove('is-hidden');
  slot.img[slot.active ^ 1]?.classList.add('is-hidden');
  slot.img[slot.active ^ 1]?.removeAttribute('src');
  curLayer.style.transform = 'translateY(0%)';
  offLayer.style.transform = OFFSCREEN_Y;
}

function slotSpinGapMs(elapsedMs) {
  const t = Math.min(1, Math.max(0, elapsedMs / SLOT_SPIN_MS));
  const ratio = SLOT_SPIN_GAP_END_MS / SLOT_SPIN_GAP_START_MS;
  return SLOT_SPIN_GAP_START_MS * ratio ** t;
}

function slotSpinWipe(slot, url) {
  slotWipeFromTopImage(slot, url, SLOT_SPIN_WIPE_MS);
}

function slotSettleImage(slot, url) {
  if (!slot) return;
  cancelSlotAnimations(slot);

  const curLayer = slot.layers[slot.active];
  const nxtLayer = slot.layers[slot.active ^ 1];
  const curImg = slot.img[slot.active];
  const nxtImg = slot.img[slot.active ^ 1];

  applyImgSrc(nxtImg, url);
  nxtImg?.classList.remove('is-hidden');
  curImg?.classList.add('is-hidden');

  curLayer.style.transform = 'translateY(0%)';
  nxtLayer.style.transform = `translateY(${SLOT_SETTLE_FROM_Y})`;

  curLayer.animate([{ transform: 'translateY(0%)' }, { transform: OFFSCREEN_Y }], {
    duration: Math.min(720, SLOT_SETTLE_ANIM_MS * 0.22),
    easing: 'ease-in',
    fill: 'forwards',
  });

  const settle = nxtLayer.animate(
    [
      { transform: `translateY(${SLOT_SETTLE_FROM_Y})`, offset: 0 },
      { transform: `translateY(${SLOT_SETTLE_LAND_Y})`, offset: 0.58 },
      { transform: 'translateY(-7%)', offset: 0.74 },
      { transform: 'translateY(4%)', offset: 0.84 },
      { transform: 'translateY(-2%)', offset: 0.91 },
      { transform: 'translateY(1%)', offset: 0.96 },
      { transform: 'translateY(0%)', offset: 1 },
    ],
    {
      duration: SLOT_SETTLE_ANIM_MS,
      easing: 'cubic-bezier(0.14, 1.18, 0.22, 1)',
      fill: 'forwards',
    },
  );

  slot.anim = settle;
  settle.onfinish = () => {
    slot.active ^= 1;
    slot.anim = null;
    slot.layers[slot.active].style.transform = 'translateY(0%)';
    slot.layers[slot.active ^ 1].style.transform = OFFSCREEN_Y;
    slot.img[slot.active]?.classList.remove('is-hidden');
    slot.img[slot.active ^ 1]?.classList.add('is-hidden');
  };
  settle.oncancel = () => {
    slot.anim = null;
  };
}

function pickRandom(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSlotFolderUrls() {
  if (folderMode && folderKeys.length) {
    const key = folderPlayback?.currentKey || folderKeys[0];
    const left = leftFolders[key] || [];
    const right = rightFolders[key] || [];
    if (left.length && right.length) return { key, left, right };
  }
  return { key: null, left: poolLeft, right: poolRight };
}

function stopSlotSpin() {
  if (slotSpinTimer !== null) {
    window.clearTimeout(slotSpinTimer);
    slotSpinTimer = null;
  }
}

function slotWipeFromTopImage(slot, url, durationMs) {
  if (!slot) return;
  cancelSlotAnimations(slot);

  const curLayer = slot.layers[slot.active];
  const nxtLayer = slot.layers[slot.active ^ 1];
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
    slot.layers[slot.active].style.transform = 'translateY(0%)';
    slot.layers[slot.active ^ 1].style.transform = OFFSCREEN_Y;
    slot.img[slot.active]?.classList.remove('is-hidden');
    slot.img[slot.active ^ 1]?.classList.add('is-hidden');
    slot.img[slot.active ^ 1]?.removeAttribute('src');
  };
  b.oncancel = () => {
    slot.anim = null;
  };
}

function showSideImage(slot, url, animate) {
  if (!url) return;
  if (animate) slotWipeFromTopImage(slot, url, wipeDurationMs());
  else slotSetInstantImage(slot, url);
}

function applyPanes(animate) {
  const lu = seqLeft[idxLeft % seqLeft.length];
  const ru = seqRight[idxRight % seqRight.length];
  showSideImage(slotL, lu, animate);
  showSideImage(slotR, ru, animate);
}

function tick() {
  idxLeft++;
  idxRight++;
  applyPanes(true);
}

function stopTimers() {
  stopFolderPlayback();
  stopSlotSpin();
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

function startFolderBaseline() {
  stopFolderPlayback();
  folderPlayback = createFolderSyncPlayback({
    leftFolders,
    rightFolders,
    getPhaseOptions: folderPhaseOptions,
    onFolderStart(ctx) {
      refreshBaselineStatus(ctx);
    },
    onLeftImage(url, _idx, _urls, meta) {
      showSideImage(slotL, url, !!meta?.animate);
    },
    onRightImage(url, _idx, _urls, meta) {
      showSideImage(slotR, url, !!meta?.animate);
    },
    onFolderEnd() {},
    onCycleEnd() {},
  });
  folderPlayback.start();
}

function startFlatBaseline() {
  seqLeft = shuffle(poolLeft);
  seqRight = shuffle(poolRight);
  idxLeft = 0;
  idxRight = 0;
  applyPanes(false);
  restartSlideInterval();
}

function startBaseline() {
  stopTimers();
  inTrigger = false;
  setMode(true);
  const ok = poolLeft.length && poolRight.length;
  if (triggerBtn) triggerBtn.disabled = !ok;
  if (!ok) return;
  if (folderMode) {
    refreshBaselineStatus();
    startFolderBaseline();
    return;
  }
  refreshBaselineStatus();
  startFlatBaseline();
}

function restartBaselineTiming() {
  if (inTrigger || !poolLeft.length || !poolRight.length) return;
  if (folderMode) startFolderBaseline();
  else restartSlideInterval();
}

function updateSlotStatus(phase, remainingSec) {
  if (!statusEl) return;
  if (phase === 'spin') {
    statusEl.textContent = `Automat — točí (${remainingSec} s) · pak finální výsledek`;
    return;
  }
  statusEl.textContent = `Automat — finální výsledek (${remainingSec} s)`;
}

function scheduleSlotSpin(leftUrls, rightUrls) {
  stopSlotSpin();
  const tick = () => {
    if (!inTrigger) return;
    const elapsed = performance.now() - slotStartedAt;
    if (elapsed >= SLOT_SPIN_MS) return;
    slotSpinWipe(slotL, pickRandom(leftUrls));
    slotSpinWipe(slotR, pickRandom(rightUrls));
    slotSpinTimer = window.setTimeout(tick, slotSpinGapMs(elapsed));
  };
  slotSpinTimer = window.setTimeout(tick, slotSpinGapMs(0));
}

function beginSlotSettle(finalLeft, finalRight) {
  stopSlotSpin();
  if (appEl) appEl.classList.add('app--slot-settle');
  cancelSlotAnimations(slotL);
  cancelSlotAnimations(slotR);
  slotSettleImage(slotL, finalLeft);
  slotSettleImage(slotR, finalRight);
}

function finishSlotMachine() {
  inTrigger = false;
  if (appEl) appEl.classList.remove('app--slot-settle');
  resetSlotPane(slotL);
  resetSlotPane(slotR);
  startBaseline();
}

function startSlotMachine() {
  if (!poolLeft.length || !poolRight.length || inTrigger) return;
  const { left, right } = getSlotFolderUrls();
  if (!left.length || !right.length) return;

  stopTimers();
  resetSlotPane(slotL);
  resetSlotPane(slotR);
  inTrigger = true;
  setMode(false);
  if (triggerBtn) triggerBtn.disabled = true;

  const finalLeft = pickRandom(left);
  const finalRight = pickRandom(right);
  slotStartedAt = performance.now();

  slotSpinWipe(slotL, pickRandom(left));
  slotSpinWipe(slotR, pickRandom(right));
  scheduleSlotSpin(left, right);

  let remaining = Math.ceil(SLOT_MS / 1000);
  updateSlotStatus('spin', remaining);
  triggerRemainingId = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) return;
    const elapsed = performance.now() - slotStartedAt;
    updateSlotStatus(elapsed < SLOT_SPIN_MS ? 'spin' : 'settle', remaining);
  }, 1000);

  window.setTimeout(() => {
    beginSlotSettle(finalLeft, finalRight);
    updateSlotStatus('settle', Math.ceil(SLOT_SETTLE_MS / 1000));
  }, SLOT_SPIN_MS);

  triggerEndId = window.setTimeout(finishSlotMachine, SLOT_MS);
}

triggerBtn?.addEventListener('click', () => {
  if (inTrigger) return;
  startSlotMachine();
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
          if (parsed && !sensorBoost && !inTrigger) {
            sensorBoost = true;
            startSlotMachine();
          } else if (!parsed && sensorBoost) {
            sensorBoost = false;
          }
        } else if (line.length > 0 && !inTrigger) {
          startSlotMachine();
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
        'Sériový port otevřen — 1 = automat (10 s), 0 = základní režim.';
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

function loadManifestPools(json) {
  leftFolders =
    json.leftFolders && typeof json.leftFolders === 'object' && !Array.isArray(json.leftFolders)
      ? json.leftFolders
      : null;
  rightFolders =
    json.rightFolders && typeof json.rightFolders === 'object' && !Array.isArray(json.rightFolders)
      ? json.rightFolders
      : null;
  folderKeys =
    Array.isArray(json.folders) && json.folders.length
      ? json.folders.filter(Boolean)
      : pairedFolderKeys(leftFolders, rightFolders);
  folderMode = !!(leftFolders && rightFolders && folderKeys.length);
  poolLeft = folderMode ? flattenExhibitFolders(leftFolders) : Array.isArray(json.left) ? json.left.filter(Boolean) : [];
  poolRight = folderMode
    ? flattenExhibitFolders(rightFolders)
    : Array.isArray(json.right)
      ? json.right.filter(Boolean)
      : [];
}

async function init() {
  if (!statusEl) return;
  statusEl.textContent = 'Načítání manifestu obrázků…';

  const res = await fetch(EXHIBIT_MANIFEST, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${EXHIBIT_MANIFEST} nedostupné — spusťte npm run build na Pi`);
  const json = await res.json();
  loadManifestPools(json);

  if (!poolLeft.length || !poolRight.length) {
    statusEl.textContent =
      'Přidejte JPG/PNG do public/exhibit-left/N a public/exhibit-right/N, pak node scripts/generate-exhibit-images-json.mjs (nebo npm run build).';
    if (triggerBtn) triggerBtn.disabled = true;
    return;
  }

  if (folderMode && !folderKeys.length) {
    statusEl.textContent = 'Manifest nemá spárované složky left/right — zkontrolujte public/exhibit-left/N a exhibit-right/N.';
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
