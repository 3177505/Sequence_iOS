const API = '/api/ml';

const API_FAIL_HINT =
  'Nespustil se Node dev server. Ve složce Sequence v terminálu (Windows: PowerShell nebo cmd) spusť: npm run dev — pak znovu otevři tuto stránku. Otevíráš soubor přímo z disku? Musí být http://localhost:3000/…';

function getEl(id) {
  return document.getElementById(id);
}

async function fetchStatus() {
  const r = await fetch(`${API}/status`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

function platformLabel(p) {
  if (p === 'win32') return 'Node běží na Windows (server + API v pořádku).';
  if (p === 'darwin') return 'Node běží na macOS.';
  if (p === 'linux') return 'Node běží na Linuxu.';
  return p ? `Node platforma: ${p}` : '';
}

function setStepState(step2Enabled, step3Enabled) {
  const s2 = getEl('ml-step-train');
  const s3 = getEl('ml-step-gen');
  if (s2) {
    s2.classList.toggle('ml-step--locked', !step2Enabled);
    s2.querySelectorAll('button, input, select, textarea').forEach((x) => {
      if (x.dataset.mlAlways === '1') return;
      x.disabled = !step2Enabled;
    });
  }
  if (s3) {
    s3.classList.toggle('ml-step--locked', !step3Enabled);
    s3.querySelectorAll('button, input, select, textarea').forEach((x) => {
      if (x.dataset.mlAlways === '1') return;
      x.disabled = !step3Enabled;
    });
  }
}

function scrollLogToEnd(logBox) {
  if (!logBox) return;
  requestAnimationFrame(() => {
    logBox.scrollTop = logBox.scrollHeight;
  });
}

let pollId = null;

function schedulePoll(fn, ms) {
  if (pollId) clearInterval(pollId);
  pollId = setInterval(fn, ms);
}

function setupVisibilityRefresh(refreshFn) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (pollId) clearInterval(pollId);
      pollId = null;
    } else {
      refreshFn();
      schedulePoll(refreshFn, 5000);
    }
  });
}

async function refresh() {
  const logBox = getEl('ml-log');
  const stVenv = getEl('ml-st-venv');
  const stLora = getEl('ml-st-lora');
  const stRun = getEl('ml-st-run');
  const stPlat = getEl('ml-st-platform');
  const allowNoLora = getEl('ml-allow-no-lora');
  const trainBtn = getEl('ml-train-btn');
  const genBtn = getEl('ml-gen-btn');

  let data;
  try {
    data = await fetchStatus();
  } catch (e) {
    if (stVenv) stVenv.textContent = 'API nedostupné';
    if (stLora) stLora.textContent = '—';
    if (stRun) stRun.textContent = '—';
    if (stPlat) stPlat.textContent = '';
    if (logBox) {
      logBox.textContent = `${API_FAIL_HINT}\n\n(${String(e?.message || e)})`;
    }
    setStepState(false, false);
    if (trainBtn) trainBtn.disabled = true;
    if (genBtn) genBtn.disabled = true;
    return;
  }

  if (stVenv) {
    stVenv.textContent = data.venvPython
      ? 'ml/.venv nalezen (Python pro trénink a generování je připraven).'
      : 'Chybí ml/.venv — v terminálu dokonči kroky v sekci „Nejdřív v terminálu (Windows)“.';
  }
  if (stLora) {
    stLora.textContent = data.loraReady
      ? 'LoRA váhy: ano (složka outputs/lora-run obsahuje soubory).'
      : 'LoRA váhy: zatím ne — dokonči trénink v kroku 2, nebo zaškrtni generování bez LoRA výše.';
  }
  if (stRun) {
    stRun.textContent = data.trainingRunning
      ? 'Trénink právě běží na pozadí (tlačítko tréninku je vypnuté, dokud neskončí).'
      : 'Trénink teď neběží (můžeš spustit znovu v kroku 2).';
  }
  if (stPlat) {
    stPlat.textContent = platformLabel(data.platform) || '';
  }
  if (logBox) {
    if (data.logTail && data.logTail.trim()) {
      logBox.textContent = data.logTail;
      scrollLogToEnd(logBox);
    } else if (data.trainingRunning) {
      logBox.textContent =
        'Trénink běží. Log uvidíš po prvním výpisu do node-ml-train.log; může trvat. Stiskem „Obnovit stav“ načteš konec logu dřív.';
    } else {
      logBox.textContent =
        'Zatím žádný log. Po spuštění tréninku se tu objeví výstup z node-ml-train.log / training-gui.log.';
    }
  }

  const venvOk = data.venvPython;
  const loraOk = data.loraReady;
  const noLora = allowNoLora && allowNoLora.checked;
  const training = data.trainingRunning;
  setStepState(Boolean(venvOk), Boolean(venvOk && (loraOk || noLora)));

  if (trainBtn) {
    trainBtn.disabled = !venvOk || training;
    trainBtn.setAttribute('aria-busy', training ? 'true' : 'false');
  }
}

async function startTrain() {
  const maxSteps = Number(getEl('ml-max-steps')?.value) || 200;
  const resume = getEl('ml-resume')?.checked;
  const status = getEl('ml-train-msg');
  const trainBtn = getEl('ml-train-btn');
  if (trainBtn) trainBtn.disabled = true;
  try {
    const r = await fetch(`${API}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSteps, resume }),
    });
    const j = await r.json().catch(() => ({}));
    if (status) {
      status.textContent = j.error || j.message || (r.ok ? 'Spuštěno. Log se bude doplňovat níže.' : `Chyba ${r.status}`);
    }
  } catch (e) {
    if (status) status.textContent = String(e?.message || e);
  } finally {
    await refresh();
  }
}

async function doGenerate() {
  const prompt = getEl('ml-prompt')?.value || '';
  const count = Number(getEl('ml-count')?.value) || 2;
  const allowNoLora = getEl('ml-allow-no-lora')?.checked;
  const useLora = allowNoLora ? false : getEl('ml-use-lora')?.checked !== false;
  const status = getEl('ml-gen-msg');
  const genBtn = getEl('ml-gen-btn');
  if (genBtn) genBtn.disabled = true;
  try {
    const r = await fetch(`${API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, count, useLora }),
    });
    const j = await r.json().catch(() => ({}));
    if (status) {
      status.textContent =
        j.error ||
        j.message ||
        (j.ok
          ? 'Hotovo. Obrázky: složka ml/outputs/gen/ (out_00.png, …).'
          : `Chyba ${r.status}`);
    }
  } catch (e) {
    if (status) status.textContent = String(e?.message || e);
  } finally {
    await refresh();
  }
}

function init() {
  getEl('ml-train-btn')?.addEventListener('click', () => startTrain().catch((e) => console.error(e)));
  getEl('ml-gen-btn')?.addEventListener('click', () => doGenerate().catch((e) => console.error(e)));
  getEl('ml-refresh')?.addEventListener('click', () => refresh());
  getEl('ml-allow-no-lora')?.addEventListener('change', () => refresh());
  refresh();
  schedulePoll(() => {
    if (!document.hidden) refresh();
  }, 5000);
  setupVisibilityRefresh(refresh);
}

init();
