const SLIDE_MS = 2500;
const TRIGGER_SLIDE_MS = 400;
const TRIGGER_MS = 15000;

const folder1 = ['#c94c4c', '#4c8cc9', '#6bc94c', '#c9a64c'];
const folder2 = ['#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
const folderTriggerLeft = ['#ff6b6b', '#4ecdc4', '#ffe66d'];
const folderTriggerRight = ['#a29bfe', '#fd79a8', '#00b894'];

const WIPE_MS_BASELINE = 420;
const WIPE_MS_TRIGGER = 220;

const JITTER_MS_BASELINE = 380;
const JITTER_MS_TRIGGER = 90;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const leftPane = document.getElementById('pane-left');
const rightPane = document.getElementById('pane-right');
const triggerBtn = document.getElementById('trigger');
const serialConnectBtn = document.getElementById('serial-connect');
const statusEl = document.getElementById('status');

let seqLeft = shuffle(folder1);
let seqRight = shuffle(folder2);
let idxLeft = 0;
let idxRight = 0;
let tickLeftId = null;
let tickRightId = null;
let triggerEndId = null;
let triggerRemainingId = null;
let inTrigger = false;

function mountSlotLayers(pane) {
  if (!pane) return null;
  const a = document.createElement('div');
  const b = document.createElement('div');
  a.className = 'pane-layer';
  b.className = 'pane-layer';
  a.style.transform = 'translateY(0%)';
  b.style.transform = 'translateY(100%)';
  pane.replaceChildren(a, b);
  return { pane, layers: [a, b], active: 0, anim: null };
}

const slotL = mountSlotLayers(leftPane);
const slotR = mountSlotLayers(rightPane);

function slotSetInstant(slot, color) {
  if (!slot) return;
  const cur = slot.layers[slot.active];
  const other = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();
  cur.style.backgroundColor = color;
  cur.style.transform = 'translateY(0%)';
  other.style.transform = 'translateY(100%)';
}

function slotWipeFromTop(slot, nextColor, durationMs) {
  if (!slot) return;
  const cur = slot.layers[slot.active];
  const nxt = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();

  nxt.style.backgroundColor = nextColor;
  cur.style.transform = 'translateY(0%)';
  nxt.style.transform = 'translateY(-100%)';

  const a = cur.animate(
    [{ transform: 'translateY(0%)' }, { transform: 'translateY(100%)' }],
    { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
  );
  const b = nxt.animate(
    [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }],
    { duration: durationMs, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)', fill: 'forwards' }
  );

  slot.anim = b;
  b.onfinish = () => {
    slot.active ^= 1;
    slot.anim = null;
    const off = slot.layers[slot.active ^ 1];
    off.style.transform = 'translateY(100%)';
  };
  b.oncancel = () => {
    slot.anim = null;
  };
}

function applyPaneL(animate) {
  const colL = seqLeft[idxLeft % seqLeft.length];
  const dur = inTrigger ? WIPE_MS_TRIGGER : WIPE_MS_BASELINE;
  if (!animate) slotSetInstant(slotL, colL);
  else slotWipeFromTop(slotL, colL, dur);
}

function applyPaneR(animate) {
  const colR = seqRight[idxRight % seqRight.length];
  const dur = inTrigger ? WIPE_MS_TRIGGER : WIPE_MS_BASELINE;
  if (!animate) slotSetInstant(slotR, colR);
  else slotWipeFromTop(slotR, colR, dur);
}

function jitterMs() {
  const span = inTrigger ? JITTER_MS_TRIGGER : JITTER_MS_BASELINE;
  return (Math.random() * 2 - 1) * span;
}

function scheduleNextL() {
  const base = inTrigger ? TRIGGER_SLIDE_MS : SLIDE_MS;
  const ms = Math.max(30, Math.round(base + jitterMs()));
  tickLeftId = window.setTimeout(() => {
    idxLeft++;
    applyPaneL(true);
    scheduleNextL();
  }, ms);
}

function scheduleNextR() {
  const base = inTrigger ? TRIGGER_SLIDE_MS : SLIDE_MS;
  const ms = Math.max(30, Math.round(base + jitterMs()));
  tickRightId = window.setTimeout(() => {
    idxRight++;
    applyPaneR(true);
    scheduleNextR();
  }, ms);
}

function startBaseline() {
  stopTimers();
  inTrigger = false;
  seqLeft = shuffle(folder1);
  seqRight = shuffle(folder2);
  idxLeft = 0;
  idxRight = 0;
  applyPaneL(false);
  applyPaneR(false);
  triggerBtn.disabled = false;
  statusEl.textContent = 'Základní režim: dva sloupce (složka 1 / složka 2).';
  scheduleNextL();
  scheduleNextR();
}

function stopTimers() {
  if (tickLeftId !== null) {
    window.clearTimeout(tickLeftId);
    tickLeftId = null;
  }
  if (tickRightId !== null) {
    window.clearTimeout(tickRightId);
    tickRightId = null;
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

function updateTriggerStatus(remainingSec) {
  statusEl.textContent = `Spouštěcí sekvence (zbývá ${remainingSec} s) — skupiny C / D.`;
}

function startTrigger() {
  stopTimers();
  inTrigger = true;
  triggerBtn.disabled = true;
  seqLeft = shuffle(folderTriggerLeft);
  seqRight = shuffle(folderTriggerRight);
  idxLeft = 0;
  idxRight = 0;
  applyPaneL(false);
  applyPaneR(false);
  let remaining = Math.ceil(TRIGGER_MS / 1000);
  updateTriggerStatus(remaining);
  triggerRemainingId = window.setInterval(() => {
    remaining -= 1;
    if (remaining > 0) updateTriggerStatus(remaining);
  }, 1000);
  scheduleNextL();
  scheduleNextR();
  triggerEndId = window.setTimeout(() => {
    startBaseline();
  }, TRIGGER_MS);
}

triggerBtn.addEventListener('click', () => {
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
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.length > 0 && !inTrigger) startTrigger();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

serialConnectBtn?.addEventListener('click', async () => {
  if (!('serial' in navigator)) {
    statusEl.textContent = 'Web Serial vyžaduje Chromium. Použijte http://localhost nebo HTTPS.';
    return;
  }
  if (serialPort) {
    statusEl.textContent = 'Sériový port je otevřený — obnovte stránku pro znovupřipojení.';
    return;
  }
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: SERIAL_BAUD });
    statusEl.textContent = 'Sériový port otevřen — spusťte sekvenci z Arduina Nano.';
    readSerialLines(serialPort);
  } catch (e) {
    serialPort = null;
    if (e?.name !== 'NotFoundError') statusEl.textContent = String(e.message || e);
  }
});

startBaseline();
