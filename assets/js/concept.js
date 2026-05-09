(() => {
  const $ = (sel) => document.querySelector(sel);

  const btnEdit = $('#concept-edit');
  const btnSave = $('#concept-save');
  const btnCancel = $('#concept-cancel');
  const btnLangCs = $('#concept-lang-cs');
  const btnLangEn = $('#concept-lang-en');
  const statusEl = $('#concept-status');
  const titleEl = $('#concept-title');

  const summaryEl = $('#concept-summary');
  const voicesEl = $('#concept-voices');
  const axesEl = $('#concept-axes');
  const paradigmsEl = $('#concept-paradigms');

  const editorWrap = $('#concept-editor-wrap');
  const fieldTitle = $('#concept-field-title');
  const fieldSummary = $('#concept-field-summary');
  const fieldVoices = $('#concept-field-voices');
  const fieldAxesIntro = $('#concept-field-axes-intro');
  const fieldVertical = $('#concept-field-vertical');
  const fieldHorizontal = $('#concept-field-horizontal');
  const fieldCommon = $('#concept-field-common');
  const fieldParadigms = $('#concept-field-paradigms');

  if (
    !btnEdit ||
    !btnSave ||
    !btnCancel ||
    !btnLangCs ||
    !btnLangEn ||
    !statusEl ||
    !titleEl ||
    !summaryEl ||
    !voicesEl ||
    !axesEl ||
    !paradigmsEl ||
    !editorWrap ||
    !fieldTitle ||
    !fieldSummary ||
    !fieldVoices ||
    !fieldAxesIntro ||
    !fieldVertical ||
    !fieldHorizontal ||
    !fieldCommon ||
    !fieldParadigms
  )
    return;

  const endpoint = '/api/concept';
  let lastLoadedDoc = null;
  let mode = 'view';
  let lang = 'cs';

  try {
    const savedLang = localStorage.getItem('sequence:concept:lang');
    if (savedLang === 'en' || savedLang === 'cs') lang = savedLang;
  } catch (_) {}

  const setStatus = (s) => {
    statusEl.textContent = s || '';
  };

  const setLangUi = () => {
    btnLangCs.setAttribute('aria-pressed', lang === 'cs' ? 'true' : 'false');
    btnLangEn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
  };

  const setMode = (next) => {
    mode = next;
    const isEdit = mode === 'edit';
    btnEdit.hidden = isEdit;
    btnSave.hidden = !isEdit;
    btnCancel.hidden = !isEdit;
    editorWrap.hidden = !isEdit;
    summaryEl.closest('section')?.toggleAttribute?.('hidden', false);
    const renderSection = summaryEl.closest('section');
    if (renderSection) renderSection.hidden = isEdit;
  };

  const safeString = (v) => (typeof v === 'string' ? v : '');
  const safeArray = (v) => (Array.isArray(v) ? v : []);

  const escapeHtml = (s) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const linesToArray = (s) =>
    safeString(s)
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

  const arrayToLines = (arr) => safeArray(arr).map((x) => safeString(x)).join('\n');

  const parseParadigmsLines = (s) => {
    const out = [];
    const lines = linesToArray(s);
    for (const line of lines) {
      const parts = line.split('⟡');
      if (parts.length < 2) continue;
      const left = parts[0].trim();
      const right = parts.slice(1).join('⟡').trim();
      if (!left || !right) continue;
      out.push([left, right]);
    }
    return out;
  };

  const paradigmsToLines = (pairs) =>
    safeArray(pairs)
      .map((p) => {
        if (!Array.isArray(p)) return '';
        const left = safeString(p[0]).trim();
        const right = safeString(p[1]).trim();
        if (!left || !right) return '';
        return `${left} ⟡ ${right}`;
      })
      .filter(Boolean)
      .join('\n');

  const normalizePayload = (raw) => {
    if (raw && typeof raw === 'object' && typeof raw.html === 'string' && !('title' in raw)) {
      return {
        title: 'Koncept',
        summary: safeString(raw.html),
        voices: '',
        axes: {
          intro: '',
          verticalTitle: 'Vertikála',
          verticalItems: [],
          horizontalTitle: 'Horizontála',
          horizontalItems: [],
          commonTitle: 'Společná půda',
          common: '',
        },
        paradigmsTitle: 'Paradigmata vedle sebe',
        paradigms: [],
      };
    }

    const axes = raw?.axes && typeof raw.axes === 'object' ? raw.axes : {};
    return {
      title: safeString(raw?.title) || 'Koncept',
      summary: safeString(raw?.summary),
      voices: safeString(raw?.voices),
      axes: {
        intro: safeString(axes?.intro),
        verticalTitle: safeString(axes?.verticalTitle) || 'Vertikála',
        verticalItems: safeArray(axes?.verticalItems),
        horizontalTitle: safeString(axes?.horizontalTitle) || 'Horizontála',
        horizontalItems: safeArray(axes?.horizontalItems),
        commonTitle: safeString(axes?.commonTitle) || 'Společná půda',
        common: safeString(axes?.common),
      },
      paradigmsTitle: safeString(raw?.paradigmsTitle) || 'Paradigmata vedle sebe',
      paradigms: safeArray(raw?.paradigms),
    };
  };

  const normalizeDoc = (raw) => {
    if (raw && typeof raw === 'object' && raw.cs && raw.en) {
      return {
        defaultLang: raw.defaultLang === 'en' ? 'en' : 'cs',
        cs: normalizePayload(raw.cs),
        en: normalizePayload(raw.en),
      };
    }

    const base = normalizePayload(raw);
    return {
      defaultLang: 'cs',
      cs: base,
      en: {
        title: 'Concept',
        summary: '',
        voices: '',
        axes: {
          intro: '',
          verticalTitle: 'Vertical',
          verticalItems: [],
          horizontalTitle: 'Horizontal',
          horizontalItems: [],
          commonTitle: 'Common ground',
          common: '',
        },
        paradigmsTitle: 'Paradigms side by side',
        paradigms: [],
      },
    };
  };

  const getActive = () => {
    const doc = normalizeDoc(lastLoadedDoc || {});
    return lang === 'en' ? doc.en : doc.cs;
  };

  const render = () => {
    const d = getActive();
    titleEl.textContent = d.title || 'Koncept';

    summaryEl.innerHTML = `<p>${escapeHtml(d.summary).replaceAll('\n', '<br>')}</p>`;

    voicesEl.innerHTML = `
      <h2>${lang === 'en' ? 'Dual voice' : 'Dvojhlas'}</h2>
      <p>${escapeHtml(d.voices).replaceAll('\n', '<br>')}</p>
    `;

    axesEl.innerHTML = `
      <h2>${lang === 'en' ? 'Vertical · horizontal' : 'Vertikála · horizontála'}</h2>
      <p>${escapeHtml(d.axes.intro).replaceAll('\n', '<br>')}</p>
      <div class="concept__grid2" aria-label="Osy">
        <div class="concept__card">
          <h3>${escapeHtml(d.axes.verticalTitle)}</h3>
          <ul>${d.axes.verticalItems.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </div>
        <div class="concept__card">
          <h3>${escapeHtml(d.axes.horizontalTitle)}</h3>
          <ul>${d.axes.horizontalItems.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </div>
      </div>
      <h3>${escapeHtml(d.axes.commonTitle)}</h3>
      <p>${escapeHtml(d.axes.common).replaceAll('\n', '<br>')}</p>
    `;

    const rows = safeArray(d.paradigms)
      .map((p) => (Array.isArray(p) ? [safeString(p[0]), safeString(p[1])] : ['', '']))
      .filter(([a, b]) => a.trim() && b.trim());

    paradigmsEl.innerHTML = `
      <h2>${escapeHtml(d.paradigmsTitle)}</h2>
      <table class="concept__table" aria-label="Paradigmata">
        <thead>
          <tr>
            <th>${lang === 'en' ? 'Left' : 'Levá strana'}</th>
            <th>${lang === 'en' ? 'Right' : 'Pravá strana'}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([a, b]) => `
            <tr>
              <td>${escapeHtml(a)}</td>
              <td>${escapeHtml(b)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  };

  const fillEditor = () => {
    const d = getActive();
    fieldTitle.value = d.title || '';
    fieldSummary.value = d.summary || '';
    fieldVoices.value = d.voices || '';
    fieldAxesIntro.value = d.axes.intro || '';
    fieldVertical.value = arrayToLines(d.axes.verticalItems);
    fieldHorizontal.value = arrayToLines(d.axes.horizontalItems);
    fieldCommon.value = d.axes.common || '';
    fieldParadigms.value = paradigmsToLines(d.paradigms);
  };

  const readEditor = () => {
    const title = safeString(fieldTitle.value).trim() || 'Koncept';
    const summary = safeString(fieldSummary.value).trim();
    const voices = safeString(fieldVoices.value).trim();
    const axesIntro = safeString(fieldAxesIntro.value).trim();
    const verticalItems = linesToArray(fieldVertical.value);
    const horizontalItems = linesToArray(fieldHorizontal.value);
    const common = safeString(fieldCommon.value).trim();
    const paradigms = parseParadigmsLines(fieldParadigms.value);

    return {
      title,
      summary,
      voices,
      axes: {
        intro: axesIntro,
        verticalTitle:
          lang === 'en'
            ? 'Vertical (order · meta-control · teleology)'
            : 'Vertikála (řád · nad-řízení · teleologie)',
        verticalItems,
        horizontalTitle:
          lang === 'en'
            ? 'Horizontal (operations · body · everydayness)'
            : 'Horizontála (provoz · tělo · každodennost)',
        horizontalItems,
        commonTitle: lang === 'en' ? 'Common ground' : 'Společná půda',
        common,
      },
      paradigmsTitle: lang === 'en' ? 'Paradigms side by side' : 'Paradigmata vedle sebe',
      paradigms,
    };
  };

  const load = async () => {
    setStatus('Načítám…');
    let r = await fetch('/public/api-public-tree/concept.json', { cache: 'no-store' });
    if (!r.ok) r = await fetch(endpoint, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${endpoint}: ${r.status}`);
    const data = await r.json();
    lastLoadedDoc = normalizeDoc(data);
    if (!lang) lang = lastLoadedDoc.defaultLang || 'cs';
    setLangUi();
    render();
    fillEditor();
    setStatus('');
  };

  const save = async () => {
    setStatus('Ukládám…');
    const payload = readEditor();
    const doc = normalizeDoc(lastLoadedDoc || {});
    const out = {
      defaultLang: doc.defaultLang,
      cs: lang === 'cs' ? payload : doc.cs,
      en: lang === 'en' ? payload : doc.en,
    };
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(out),
    });
    if (!r.ok) throw new Error(`${endpoint}: ${r.status}`);
    const data = normalizeDoc(await r.json());
    lastLoadedDoc = data;
    setLangUi();
    render();
    fillEditor();
    setMode('view');
    setStatus('Uloženo');
    setTimeout(() => setStatus(''), 800);
  };

  const switchLang = (next) => {
    if (next !== 'cs' && next !== 'en') return;
    lang = next;
    try {
      localStorage.setItem('sequence:concept:lang', lang);
    } catch (_) {}
    setLangUi();
    render();
    if (mode === 'edit') fillEditor();
  };

  btnLangCs.addEventListener('click', () => switchLang('cs'));
  btnLangEn.addEventListener('click', () => switchLang('en'));

  btnEdit.addEventListener('click', () => {
    fillEditor();
    setMode('edit');
    setStatus('');
    fieldSummary.focus();
  });

  btnCancel.addEventListener('click', () => {
    fillEditor();
    setMode('view');
    setStatus('');
  });

  btnSave.addEventListener('click', () => {
    save().catch((e) => setStatus(String(e?.message || e)));
  });

  load().catch((e) => setStatus(String(e?.message || e)));
})();

