function absUrl(rel) {
  if (/^https?:\/\//i.test(rel)) return rel;
  const baseEl = document.querySelector('base[href]');
  const baseHref = baseEl ? baseEl.href : new URL('./', location.href).href;
  return new URL(rel, baseHref).href;
}

async function fetchText(rel) {
  const r = await fetch(absUrl(rel), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${rel}: ${r.status}`);
  return r.text();
}

function injectHTML(targetEl, html) {
  const s = html.trim();
  if (!s) return;
  targetEl.innerHTML = s;
}

function normalizeDocPath(pathname) {
  const trimmed = (pathname || '/').replace(/\/+$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0) return '/index.html';
  const last = parts[parts.length - 1];
  if (!last.includes('.')) {
    parts[parts.length - 1] = `${last}.html`;
  } else if (!/\.html?$/i.test(last)) {
    return `/${parts.join('/')}`.toLowerCase();
  }
  return `/${parts.join('/')}`.toLowerCase();
}

function markActiveNav(host) {
  host.querySelectorAll('a[href]').forEach((a) => {
    try {
      const nav = new URL(a.getAttribute('href'), document.baseURI);
      const cur = new URL(window.location.href);
      if (nav.origin !== cur.origin) return;
      if (normalizeDocPath(nav.pathname) !== normalizeDocPath(cur.pathname)) return;
      a.setAttribute('aria-current', 'page');
      a.classList.add('is-active');
    } catch (_) {}
  });
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.async = false;
    s.src = absUrl(src);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(src));
    document.body.appendChild(s);
  });
}

async function run() {
  const body = document.body;
  const template = body.dataset.template;
  if (!template) return;

  try {
    const headFrag = await fetchText('partials/head.html');
    document.head.insertAdjacentHTML('beforeend', headFrag);
  } catch (e) {
    console.warn('site-layout: head partial', e);
  }

  const navHost = document.getElementById('site-nav-host');
  if (navHost) {
    try {
      const overlay = body.hasAttribute('data-nav-overlay');
      navHost.innerHTML = await fetchText('partials/site-nav.html');
      if (overlay) navHost.setAttribute('data-nav-overlay', '');
      markActiveNav(navHost);
    } catch (e) {
      console.warn('site-layout: nav partial', e);
    }
  }

  const pageRoot = document.getElementById('page-root');
  if (!pageRoot) throw new Error('missing #page-root');

  const html = await fetchText(template);
  if (!html.trim()) throw new Error(`empty template: ${template}`);
  injectHTML(pageRoot, html);

  const kiosk = new URL(window.location.href).searchParams.get('kiosk');
  if (kiosk !== null && kiosk !== '' && kiosk !== '0' && kiosk.toLowerCase() !== 'false') {
    document.body.classList.add('site--kiosk');
  }
  if (document.body.hasAttribute('data-exhibit-fullscreen')) {
    document.body.classList.add('site--kiosk');
  }

  try {
    const footer = document.getElementById('site-footer');
    if (footer) {
      const ft = await fetchText('partials/footer.html');
      if (ft.trim()) injectHTML(footer, ft);
      else footer.replaceChildren();
    }
  } catch (e) {
    console.warn('site-layout: footer partial', e);
  }

  const modules = (body.dataset.modules || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const m of modules) {
    await import(absUrl(m));
  }

  const scripts = (body.dataset.scripts || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const s of scripts) {
    await loadClassicScript(s);
  }
}

run().catch((e) => {
  console.error('site-layout', e);
  const root = document.getElementById('page-root');
  const foot = document.getElementById('site-footer');
  const msg = String(e?.message || e);
  if (root && root.children.length === 0) {
    root.textContent = msg;
  } else if (foot) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#f44;padding:8px;font:12px/system-ui;white-space:pre-wrap;';
    pre.textContent = msg;
    foot.appendChild(pre);
  }
});
