const SLIDE_MS = 2500;
const TRIGGER_SLIDE_MS = 400;
const TRIGGER_MS = 15000;
const DATA_VIDEOS_STATIC = '/public/api-public-tree/data-videos.json';
const DATA_VIDEOS_API = '/api/data-videos';
const REDDIT_VIDEOS_API = '/api/reddit-videos';
const REDDIT_VIDEOS_FALLBACK = 'assets/data/reddit-videos.json';
const REDDIT_RIGHT_LIMIT = 15;

const WIPE_MS_BASELINE = 420;
const WIPE_MS_TRIGGER = 220;
const OFFSCREEN_Y = 'translateY(110%)';

function youtubeEmbedNoChrome(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    const id = m?.[1];
    if (!id) return url;
    const q = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      controls: '0',
      modestbranding: '1',
      rel: '0',
      fs: '0',
      disablekb: '1',
      iv_load_policy: '3',
      playsinline: '1',
    });
    return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
  } catch {
    return url;
  }
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

function qVideo(side, layer) {
  return document.querySelector(`video.pane__media[data-side="${side}"][data-layer="${layer}"]`);
}

function qMedia(side, layer) {
  const v = document.querySelector(`video.pane__media[data-side="${side}"][data-layer="${layer}"]`);
  const f = document.querySelector(`iframe.pane__media[data-side="${side}"][data-layer="${layer}"]`);
  return { video: v, frame: f };
}

function mountSlotVideo(paneId, side) {
  const pane = document.getElementById(paneId);
  if (!pane) return null;
  const layers = Array.from(pane.querySelectorAll('.pane-layer'));
  if (layers.length < 2) return null;
  layers[0].style.transform = 'translateY(0%)';
  layers[1].style.transform = OFFSCREEN_Y;
  return { pane, layers, video: [qVideo(side, 0), qVideo(side, 1)], active: 0, anim: null, side };
}

function mountSlotMedia(paneId, side) {
  const pane = document.getElementById(paneId);
  if (!pane) return null;
  const layers = Array.from(pane.querySelectorAll('.pane-layer'));
  if (layers.length < 2) return null;
  layers[0].style.transform = 'translateY(0%)';
  layers[1].style.transform = OFFSCREEN_Y;
  return { pane, layers, media: [qMedia(side, 0), qMedia(side, 1)], active: 0, anim: null, side };
}

const slotL = mountSlotVideo('pane-left', 'L');
const slotR = mountSlotMedia('pane-right', 'R');

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

function setMode(baseline) {
  if (!appEl) return;
  appEl.classList.toggle('app--baseline', baseline);
  appEl.classList.toggle('app--trigger', !baseline);
}

function applyVideoUrl(videoEl, url) {
  if (!videoEl || !url) return;
  if (videoEl.src !== url) {
    videoEl.src = url;
    videoEl.play().catch(() => {});
  }
}

function slotSetInstantVideo(slot, url) {
  if (!slot) return;
  const curLayer = slot.layers[slot.active];
  const offLayer = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();
  const curVid = slot.video[slot.active];
  applyVideoUrl(curVid, url);
  curVid?.classList.remove('is-hidden');
  slot.video[slot.active ^ 1]?.classList.add('is-hidden');
  curLayer.style.transform = 'translateY(0%)';
  offLayer.style.transform = OFFSCREEN_Y;
}

function slotWipeFromTopVideo(slot, url, durationMs) {
  if (!slot) return;
  const curLayer = slot.layers[slot.active];
  const nxtLayer = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();

  const curVid = slot.video[slot.active];
  const nxtVid = slot.video[slot.active ^ 1];
  applyVideoUrl(nxtVid, url);
  nxtVid?.classList.remove('is-hidden');
  curVid?.classList.add('is-hidden');

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
    const old = slot.video[slot.active ^ 1];
    if (old?.src) {
      old.pause();
      old.removeAttribute('src');
      old.load();
    }
  };
  b.oncancel = () => {
    slot.anim = null;
  };
}

function applyMediaItem(videoEl, iframeEl, item) {
  if (!item || !videoEl || !iframeEl) return;
  if (item.redditVideoUrl) {
    iframeEl.classList.add('is-hidden');
    videoEl.classList.remove('is-hidden');
    if (videoEl.src !== item.redditVideoUrl) {
      videoEl.src = item.redditVideoUrl;
      videoEl.play().catch(() => {});
    }
  } else if (item.youtubeEmbedUrl) {
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    videoEl.classList.add('is-hidden');
    iframeEl.classList.remove('is-hidden');
    const embed = youtubeEmbedNoChrome(item.youtubeEmbedUrl);
    if (iframeEl.src !== embed) iframeEl.src = embed;
  }
}

function slotSetInstantMedia(slot, item) {
  if (!slot) return;
  const curLayer = slot.layers[slot.active];
  const offLayer = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();
  const cur = slot.media[slot.active];
  applyMediaItem(cur.video, cur.frame, item);
  curLayer.style.transform = 'translateY(0%)';
  offLayer.style.transform = OFFSCREEN_Y;
}

function slotWipeFromTopMedia(slot, item, durationMs) {
  if (!slot) return;
  const curLayer = slot.layers[slot.active];
  const nxtLayer = slot.layers[slot.active ^ 1];
  if (slot.anim) slot.anim.cancel();

  const cur = slot.media[slot.active];
  const nxt = slot.media[slot.active ^ 1];
  applyMediaItem(nxt.video, nxt.frame, item);

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
    const old = cur;
    if (old?.video?.src) {
      old.video.pause();
      old.video.removeAttribute('src');
      old.video.load();
    }
  };
  b.oncancel = () => {
    slot.anim = null;
  };
}

function applyPanes(animate) {
  const lu = seqLeft[idxLeft % seqLeft.length];
  const ru = seqRight[idxRight % seqRight.length];
  const dur = inTrigger ? WIPE_MS_TRIGGER : WIPE_MS_BASELINE;
  if (!animate) {
    slotSetInstantVideo(slotL, lu);
    slotSetInstantMedia(slotR, ru);
    return;
  }
  slotWipeFromTopVideo(slotL, lu, dur);
  slotWipeFromTopMedia(slotR, ru, dur);
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
  if (ok && statusEl) statusEl.textContent = 'Základní režim: náhodná videa z public/7_DataVideos/**/_Video.';
  tickId = ok ? window.setInterval(tick, SLIDE_MS) : null;
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
  tickId = window.setInterval(tick, TRIGGER_SLIDE_MS);
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
    if (statusEl) statusEl.textContent = 'Sériový port otevřen — pošlete znak pro spuštění.';
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
  statusEl.textContent = 'Načítání: vlevo local _Video, vpravo Reddit (ObscureMedia)…';

  let dataRes = await fetch(DATA_VIDEOS_STATIC, { cache: 'no-store' });
  if (!dataRes.ok) dataRes = await fetch(DATA_VIDEOS_API, { cache: 'no-store' });
  if (!dataRes.ok) throw new Error(`${DATA_VIDEOS_API} nedostupné`);
  const dataJson = await dataRes.json();
  const all = Array.isArray(dataJson.all) ? dataJson.all : [];
  if (!all.length) {
    statusEl.textContent = all.length
      ? 'Mám videa, ale nelze vytvořit levý pool.'
      : 'Nenalezena žádná videa v public/7_DataVideos/**/_Video.';
    if (triggerBtn) triggerBtn.disabled = true;
    return;
  }

  let redditRes = await fetch(REDDIT_VIDEOS_API, { cache: 'no-store' });
  if (!redditRes.ok) redditRes = await fetch(REDDIT_VIDEOS_FALLBACK, { cache: 'no-store' });
  if (!redditRes.ok) throw new Error(`${REDDIT_VIDEOS_API} nedostupné, chybí záložní JSON`);
  const redditJson = await redditRes.json();
  const rightAll = Array.isArray(redditJson.ObscureMedia) ? redditJson.ObscureMedia : [];
  const right = rightAll.slice(0, REDDIT_RIGHT_LIMIT);
  if (!right.length) {
    statusEl.textContent = 'Reddit pool ObscureMedia je prázdný.';
    if (triggerBtn) triggerBtn.disabled = true;
    return;
  }

  poolLeft = all;
  poolRight = right;
  startBaseline();
  await maybeAutoSerialKiosk();
}

init().catch((e) => {
  if (statusEl) statusEl.textContent = String(e?.message || e);
  if (triggerBtn) triggerBtn.disabled = true;
});

