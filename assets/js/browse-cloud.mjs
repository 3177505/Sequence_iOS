const mode = document.body.dataset.cloud;
const root = document.getElementById('browse-cloud-root');
if (!mode || !root) {
  throw new Error('browse-cloud: chybí data-cloud nebo #browse-cloud-root');
}

const dataUrl =
  mode === 'material'
    ? '/public/api-public-tree/material-cloud.json'
    : '/public/api-public-tree/inspiration-cloud.json';

async function fetchPayload() {
  const r = await fetch(dataUrl, { cache: 'no-store' });
  if (!r.ok) {
    throw new Error(
      `${dataUrl}: ${r.status} — spusťte npm run build:public-tree nebo npm run dev`,
    );
  }
  return r.json();
}

function alphanumericFold(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

function noteBlockRedundantWithLabel(label, block) {
  const tail = label.replace(/^\d+_/, '').trim();
  const t = alphanumericFold(tail);
  const b = alphanumericFold(block);
  if (b.length < 3 || !t.length) return false;
  if (b === t) return true;
  return false;
}

function appendNoteBlocks(container, label, body) {
  if (!body) return;
  const sec = document.createElement('section');
  sec.className = 'research-gallery__section';
  const h = document.createElement('h2');
  h.className = 'research-gallery__title';
  h.textContent = label;
  sec.appendChild(h);
  for (const block of String(body).split(/\n\n+/)) {
    const t = block.trim();
    if (!t) continue;
    if (noteBlockRedundantWithLabel(label, t)) continue;
    const p = document.createElement('p');
    p.textContent = t;
    sec.appendChild(p);
  }
  container.appendChild(sec);
}

const THUMB_STEP_VH = 41;
let zDrag = 100;

function attachPieceDrag(el, openUrl) {
  let tx = 0;
  let ty = 0;
  let ptrId = null;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  let moved = false;

  function applyTransform() {
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    ptrId = e.pointerId;
    el.setPointerCapture(ptrId);
    startX = e.clientX;
    startY = e.clientY;
    startTx = tx;
    startTy = ty;
    moved = false;
    el.style.zIndex = String(++zDrag);
    el.style.cursor = 'grabbing';
  });

  el.addEventListener('pointermove', (e) => {
    if (ptrId === null || e.pointerId !== ptrId) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy > 9) moved = true;
    tx = startTx + dx;
    ty = startTy + dy;
    applyTransform();
  });

  function endPointer(e) {
    if (ptrId === null || e.pointerId !== ptrId) return;
    const shouldOpen = !moved;
    ptrId = null;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch (_) {}
    el.style.cursor = 'grab';
    el.style.removeProperty('z-index');
    if (shouldOpen) {
      window.open(openUrl, '_blank', 'noopener,noreferrer');
    }
    moved = false;
  }

  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', endPointer);

  applyTransform();
}

function layoutCloud(container, urls, meta) {
  container.replaceChildren();

  const notesWrap = document.createElement('div');
  notesWrap.className = 'browse-cloud__notes';
  if (meta?.note) {
  }
  if (meta?.notes?.pinball) {
    appendNoteBlocks(notesWrap, 'Pinball', meta.notes.pinball);
  }
  if (meta?.notes?.inspo) {
    appendNoteBlocks(notesWrap, 'Inspo', meta.notes.inspo);
  }
  if (notesWrap.childElementCount) {
    container.appendChild(notesWrap);
  }

  if (!urls.length) {
    container.classList.add('browse-cloud--empty');
    const empty = document.createElement('p');
    empty.textContent = 'Žádné obrázky ve složce.';
    container.appendChild(empty);
    return;
  }

  container.classList.remove('browse-cloud--empty');

  const stage = document.createElement('div');
  stage.className = 'browse-cloud__stage';
  const n = urls.length;
  const stageMinVh = 24 + n * THUMB_STEP_VH;
  stage.style.minHeight = `${stageMinVh}vh`;

  for (let i = 0; i < n; i++) {
    const url = urls[i];
    const piece = document.createElement('div');
    piece.className = 'browse-cloud__piece';
    piece.tabIndex = 0;
    const topVh = i * THUMB_STEP_VH;
    const leftPct = 6 + Math.random() * 52;
    piece.style.left = `${leftPct}%`;
    piece.style.top = `${topVh}vh`;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.className = 'browse-cloud__img';
    img.draggable = false;
    piece.appendChild(img);
    piece.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
    attachPieceDrag(piece, url);
    stage.appendChild(piece);
  }

  container.appendChild(stage);
}

try {
  const data = await fetchPayload();
  layoutCloud(root, data.images || [], data);
} catch (e) {
  root.textContent = String(e?.message || e);
}
