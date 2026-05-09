const LS_KEY = 'ztk-sequence-path';
const LS_SHELL = 'ztk-shell';
const LS_TRACK = 'ztk-track';

const LABELS_SD = ['1 · Data', '2 · Venv', '3 · Train', '4 · Outputs', '5 · Extra'];
const LABELS_OSTRIS = ['1 · Data', '2 · Export', '3 · Popisky', '4 · Ostris', '5 · Běh'];

function defaultShell() {
  if (typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)) return 'win';
  return 'unix';
}

function getShell() {
  const s = localStorage.getItem(LS_SHELL);
  if (s === 'win' || s === 'unix') return s;
  return defaultShell();
}

function setShellPref(shell) {
  if (shell === 'win' || shell === 'unix') localStorage.setItem(LS_SHELL, shell);
}

function getTrack() {
  const t = localStorage.getItem(LS_TRACK);
  if (t === 'ostris') return 'ostris';
  return 'sd';
}

function setTrackPref(t) {
  if (t === 'sd' || t === 'ostris') localStorage.setItem(LS_TRACK, t);
}

function seqPath() {
  const i = document.getElementById('ztk-seq');
  let p = (i?.value || '').trim();
  if (!p) p = localStorage.getItem(LS_KEY) || '/ABS/CESTA/Sequence';
  return p.replace(/\/$/, '');
}

function bashSingleQuoted(s) {
  return `'${String(s).replace(/'/g, `'"'"'`)}'`;
}

function psSingleQuoted(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function buildOstrisMap(seq, shell) {
  const eq = bashSingleQuoted(seq);
  const wq = psSingleQuoted(seq);
  if (shell === 'win') {
    return {
      1: null,
      2: [
        'New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\ai-work\\zimage_from_research\\images"',
        `$env:SEQ = ${wq}`,
        'cd $env:SEQ',
        'python ml\\collect_instance_images.py --src "$env:SEQ\\public\\4_Research" --dst "$env:USERPROFILE\\ai-work\\zimage_from_research\\images"',
      ],
      3: [
        `$env:SEQ = ${wq}`,
        'cd $env:SEQ',
        'python ml\\zimage_sidecar_captions.py --dir "$env:USERPROFILE\\ai-work\\zimage_from_research\\images"',
      ],
      4: [
        'cd $env:USERPROFILE\\ai-work',
        'if (-not (Test-Path ai-toolkit)) { git clone https://github.com/ostris/ai-toolkit.git }',
        'cd ai-toolkit',
        'Remove-Item -Recurse -Force .venv -ErrorAction SilentlyContinue',
        'py -3.12 -m venv .venv',
        '.\\.venv\\Scripts\\Activate.ps1',
        'python -m pip install --upgrade pip',
        'python -m pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124',
        'python -m pip install -r requirements.txt',
      ],
      5: [
        `$env:SEQ = ${wq}`,
        'cd $env:SEQ',
        '.\\ostris-dataset-config.ps1 -ListTemplates',
        '.\\ostris-dataset-config.ps1 -FolderKey 36_Motherlode -TemplateFile train_lora_flex2_24gb_no_controls.yaml -Run',
      ],
    };
  }
  return {
    1: null,
    2: [
      'mkdir -p "$HOME/ai-work/zimage_from_research/images"',
      `export SEQ=${eq}`,
      'cd "$SEQ"',
      'python3 ml/collect_instance_images.py --src "$SEQ/public/4_Research" --dst "$HOME/ai-work/zimage_from_research/images"',
    ],
    3: [
      `export SEQ=${eq}`,
      'cd "$SEQ"',
      'python3 ml/zimage_sidecar_captions.py --dir "$HOME/ai-work/zimage_from_research/images"',
    ],
    4: [
      'cd "$HOME/ai-work"',
      'if [ ! -d ai-toolkit ]; then git clone https://github.com/ostris/ai-toolkit.git; fi',
      'cd ai-toolkit',
      'rm -rf .venv',
      'python3.12 -m venv .venv',
      'source .venv/bin/activate',
      'python -m pip install --upgrade pip',
      'python -m pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu',
      'python -m pip install -r requirements.txt',
    ],
    5: [
      'source "$HOME/ai-work/ai-toolkit/.venv/bin/activate"',
      'cd "$HOME/ai-work/ai-toolkit"',
      'python run.py config/sequence_ostris.yml',
    ],
  };
}

function buildSdMap(seq, shell) {
  const eq = bashSingleQuoted(seq);
  const wq = psSingleQuoted(seq);
  if (shell === 'win') {
    return {
      1: null,
      2: [
        `$env:SEQ = ${wq}`,
        'cd $env:SEQ\\ml',
        'python -m venv .venv',
        '.\\.venv\\Scripts\\Activate.ps1',
        'python -m pip install --upgrade pip',
        'python -m pip install -r requirements.txt',
      ],
      3: [
        `$env:SEQ = ${wq}`,
        'cd $env:SEQ',
        '.\\research-folder-training.ps1',
        '.\\research-folder-training.ps1 -FolderKey 36_Motherlode',
      ],
      4: [
        `$env:SEQ = ${wq}`,
        'Invoke-Item (Join-Path $env:SEQ "outputs")',
        'Invoke-Item (Join-Path $env:SEQ "ml\\outputs")',
      ],
      5: [
        `$env:SEQ = ${wq}`,
        'cd $env:SEQ',
        '.\\research-folder-training.ps1 -List',
        '.\\research-folder-training.ps1 -FolderKey 7_assemblage -SkipGenerate',
        '.\\research-folder-training.ps1 -Base sd15 -MaxTrainSteps 800 -Resolution 512',
      ],
    };
  }
  return {
    1: null,
    2: [
      `export SEQ=${eq}`,
      'cd "$SEQ/ml"',
      'python3 -m venv .venv',
      'source .venv/bin/activate',
      'python -m pip install --upgrade pip',
      'python -m pip install -r requirements.txt',
    ],
    3: [
      `export SEQ=${eq}`,
      'cd "$SEQ"',
      '# Nastav stejné proměnné jako v ml/research-folder-training.ps1 (SEQUENCE_COLLECT_SRC, INSTANCE_PROMPT, SEQUENCE_LORA_OUT, SEQUENCE_BASE_MODEL, MAX_TRAIN_STEPS, …), pak:',
      'chmod +x ml/launch_train.sh',
      './ml/launch_train.sh',
      '# Generování: python ml/generate.py --base sdxl --lora ml/outputs/DIR --prompt "…" --out-dir outputs/gen-DIR --count 8',
    ],
    4: [
      `export SEQ=${eq}`,
      'xdg-open "$SEQ/outputs" 2>/dev/null || open "$SEQ/outputs"',
      'xdg-open "$SEQ/ml/outputs" 2>/dev/null || open "$SEQ/ml/outputs"',
    ],
    5: [
      `export SEQ=${eq}`,
      'cd "$SEQ"',
      '# Linux/macOS: použij parametry z research-folder-training.ps1 jako exporty před launch_train.sh; nebo spouštěj z Windows přes PS1.',
    ],
  };
}

function renderSnippets(root, map) {
  const track = getTrack();
  root.querySelectorAll('[data-ztk-lines-step]').forEach((host) => {
    const tr = host.getAttribute('data-ztk-lines-track');
    if (tr !== track) {
      host.replaceChildren();
      return;
    }
    const k = host.getAttribute('data-ztk-lines-step');
    const lines = map[k];
    host.replaceChildren();
    if (!lines || !lines.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const pre = document.createElement('pre');
    pre.className = 'ztk__code ztk__code--snippet';
    const code = document.createElement('code');
    code.textContent = lines.join('\n');
    pre.appendChild(code);
    host.appendChild(pre);
  });
}

function refreshUi(root) {
  if (!localStorage.getItem(LS_SHELL)) setShellPref(defaultShell());
  if (!localStorage.getItem(LS_TRACK)) setTrackPref('sd');
  const shell = getShell();
  const track = getTrack();

  document.querySelectorAll('[data-ztk-track]').forEach((b) => {
    const on = b.getAttribute('data-ztk-track') === track;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-ztk-shell]').forEach((b) => {
    const on = b.getAttribute('data-ztk-shell') === shell;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  const labels = track === 'ostris' ? LABELS_OSTRIS : LABELS_SD;
  document.querySelectorAll('[data-ztk-step]').forEach((b) => {
    const id = b.getAttribute('data-ztk-step');
    const idx = parseInt(id, 10) - 1;
    if (idx >= 0 && idx < labels.length) b.textContent = labels[idx];
  });

  root.querySelectorAll('[data-ztk-content]').forEach((el) => {
    const c = el.getAttribute('data-ztk-content');
    el.toggleAttribute('hidden', c !== track);
  });

  const seq = seqPath();
  const ex = document.getElementById('ztk-p1-ex');
  const exSd = document.getElementById('ztk-p1-ex-sd');
  if (ex) ex.textContent = `${seq}/public/4_Research/12_Scapegoat`;
  if (exSd) exSd.textContent = `${seq}/public/4_Research/24_LaughingStock`;

  const map = track === 'ostris' ? buildOstrisMap(seq, shell) : buildSdMap(seq, shell);
  renderSnippets(root, map);
  root._ztkCmdMap = map;
}

async function copyText(t) {
  if (!t || !t.trim()) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function copyStepAll(root, id) {
  const map = root._ztkCmdMap;
  const lines = map && map[id];
  if (lines && lines.length) copyText(lines.join('\n'));
}

function init() {
  const root = document.querySelector('.ztk');
  if (!root) return;
  const inp = document.getElementById('ztk-seq');
  const saved = localStorage.getItem(LS_KEY);
  if (saved && inp) inp.value = saved;
  if (inp) {
    inp.addEventListener('input', () => {
      localStorage.setItem(LS_KEY, inp.value.trim());
      refreshUi(root);
    });
  }
  document.querySelectorAll('[data-ztk-track]').forEach((b) => {
    b.addEventListener('click', () => {
      const t = b.getAttribute('data-ztk-track');
      if (t === 'sd' || t === 'ostris') {
        setTrackPref(t);
        refreshUi(root);
      }
    });
  });
  document.querySelectorAll('[data-ztk-shell]').forEach((b) => {
    b.addEventListener('click', () => {
      const sh = b.getAttribute('data-ztk-shell');
      if (sh === 'win' || sh === 'unix') {
        setShellPref(sh);
        refreshUi(root);
      }
    });
  });
  refreshUi(root);
  const tabs = root.querySelectorAll('[data-ztk-step]');
  const panels = root.querySelectorAll('.ztk__panel');
  const show = (id) => {
    tabs.forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-ztk-step') === id);
    });
    panels.forEach((p) => {
      p.toggleAttribute('hidden', p.getAttribute('data-ztk-panel') !== id);
    });
  };
  tabs.forEach((b) => {
    b.addEventListener('click', () => show(b.getAttribute('data-ztk-step')));
  });
  root.querySelectorAll('.ztk__copy[data-ztk-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-ztk-copy');
      copyStepAll(root, id);
    });
  });
  show('1');
}

init();
