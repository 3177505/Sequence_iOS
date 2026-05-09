import http from 'http';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sass from 'sass';
import { fetchRedditVideosPayload } from './lib/reddit-videos-fetch.mjs';
import { buildPublicFolderTree } from './lib/public-tree.mjs';
import { buildResearchImagesPayload, buildDataVideosPayload } from './lib/api-payloads.mjs';
import { buildResearchGalleryPayload } from './lib/research-gallery.mjs';
import { buildGlossaryPayload } from './lib/sequence-notes.mjs';
import {
  buildInspirationCloudPayload,
  buildMaterialCloudPayload,
} from './lib/browse-cloud-payload.mjs';
import { handleMlApi } from './lib/ml-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const rootResolved = path.resolve(root);
const PORT = Number(process.env.PORT) || 3000;
const scssRoot = path.join(root, 'assets', 'scss');

const clients = new Set();
let reloadTimer = null;

const REDDIT_VIDEOS_TTL_MS = Number(process.env.REDDIT_VIDEOS_TTL_MS) || 10 * 60 * 1000;
let redditVideosCache = { at: 0, payload: null, inflight: null };

async function getRedditVideosCached() {
  const now = Date.now();
  const fresh = redditVideosCache.payload && now - redditVideosCache.at < REDDIT_VIDEOS_TTL_MS;
  if (fresh) return { payload: redditVideosCache.payload, cache: 'hit' };
  if (redditVideosCache.inflight) {
    try {
      const payload = await redditVideosCache.inflight;
      return { payload, cache: 'coalesced' };
    } catch (_) {}
  }
  redditVideosCache.inflight = (async () => {
    const payload = await fetchRedditVideosPayload();
    redditVideosCache.payload = payload;
    redditVideosCache.at = Date.now();
    return payload;
  })();
  try {
    const payload = await redditVideosCache.inflight;
    return { payload, cache: 'miss' };
  } catch (e) {
    if (redditVideosCache.payload) return { payload: redditVideosCache.payload, cache: 'stale' };
    throw e;
  } finally {
    redditVideosCache.inflight = null;
  }
}

function notifyReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const res of clients) {
      try {
        res.write(`data: reload\n\n`);
      } catch (_) {}
    }
  }, 80);
}

function urlToFsPath(urlPath) {
  const raw = decodeURIComponent(urlPath.split('?')[0]);
  const rel = raw.replace(/^\//, '').split('/').join(path.sep);
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(rootResolved, normalized);
  if (!full.startsWith(rootResolved)) return null;
  return full;
}

function publicTreeJsonHandler(absRoot) {
  return async (_req, res) => {
    try {
      const node = await buildPublicFolderTree(rootResolved, absRoot);
      const body = JSON.stringify({ node });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function handle(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
  urlPath = urlPath.replace(/\/+$/, '') || '/';
  if (urlPath === '/') urlPath = '/index.html';

  if (handleMlApi(req, res, rootResolved)) {
    return;
  }

  if (urlPath === '/api/concept' && req.method === 'GET') {
    try {
      const jsonPath = path.join(rootResolved, 'public', 'api-public-tree', 'concept.json');
      let body;
      try {
        body = await fsp.readFile(jsonPath, 'utf8');
      } catch {
        body = JSON.stringify({ html: '' });
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (urlPath === '/api/concept' && req.method === 'POST') {
    const jsonPath = path.join(rootResolved, 'public', 'api-public-tree', 'concept.json');
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      const body = JSON.stringify(parsed && typeof parsed === 'object' ? parsed : {}, null, 2) + '\n';
      await fsp.writeFile(jsonPath, body, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (urlPath === '/api/data-videos' && req.method === 'GET') {
    try {
      const body = JSON.stringify(await buildDataVideosPayload(rootResolved));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (urlPath === '/api/research-images' && req.method === 'GET') {
    try {
      const body = JSON.stringify(await buildResearchImagesPayload(rootResolved));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (
    (urlPath === '/api/research-gallery' ||
      urlPath === '/public/api-public-tree/research-gallery.json') &&
    req.method === 'GET'
  ) {
    try {
      const jsonPath = path.join(
        rootResolved,
        'public',
        'api-public-tree',
        'research-gallery.json',
      );
      let body;
      try {
        body = await fsp.readFile(jsonPath, 'utf8');
      } catch {
        body = JSON.stringify(await buildResearchGalleryPayload(rootResolved));
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (
    urlPath === '/public/api-public-tree/glossary.json' &&
    req.method === 'GET'
  ) {
    try {
      const body = JSON.stringify(buildGlossaryPayload());
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (
    (urlPath === '/api/public-tree/research' ||
      urlPath === '/public/api-public-tree/research.json') &&
    req.method === 'GET'
  ) {
    await publicTreeJsonHandler(path.join(rootResolved, 'public', 'research'))(req, res);
    return;
  }

  if (
    (urlPath === '/api/public-tree/material' ||
      urlPath === '/public/api-public-tree/material.json') &&
    req.method === 'GET'
  ) {
    await publicTreeJsonHandler(path.join(rootResolved, 'public', '3_Material'))(req, res);
    return;
  }

  if (urlPath === '/public/api-public-tree/inspiration-cloud.json' && req.method === 'GET') {
    try {
      const body = JSON.stringify(await buildInspirationCloudPayload(rootResolved));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (urlPath === '/public/api-public-tree/material-cloud.json' && req.method === 'GET') {
    try {
      const body = JSON.stringify(await buildMaterialCloudPayload(rootResolved));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (
    (urlPath === '/api/public-tree/inspiration' ||
      urlPath === '/public/api-public-tree/inspiration.json') &&
    req.method === 'GET'
  ) {
    try {
      const pinRoot = path.join(rootResolved, 'public', '2_Pinball');
      const inspoRoot = path.join(rootResolved, 'public', '1_Inspo');
      const sources = [
        { key: '2_Pinball', label: 'Pinball', node: await buildPublicFolderTree(rootResolved, pinRoot) },
        { key: '1_Inspo', label: 'Inspo', node: await buildPublicFolderTree(rootResolved, inspoRoot) },
      ];
      const body = JSON.stringify({ sources });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (urlPath === '/api/reddit-videos' && req.method === 'GET') {
    try {
      const { payload, cache } = await getRedditVideosCached();
      const body = JSON.stringify(payload);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Sequence-Cache': cache,
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  if (urlPath === '/__livereload') {
    const accept = req.headers.accept || '';
    if (!accept.includes('text/event-stream')) {
      res.writeHead(400);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    clients.add(res);
    res.write(': ok\n\n');
    req.on('close', () => clients.delete(res));
    return;
  }

  if (urlPath.endsWith('.scss')) {
    const filePath = urlToFsPath(urlPath);
    if (!filePath) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const result = sass.compile(filePath, {
        style: 'expanded',
        loadPaths: [scssRoot],
        sourceMap: false,
      });
      res.writeHead(200, {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(result.css);
    } catch (e) {
      const msg = e?.message || String(e);
      res.writeHead(500, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(`/* SCSS error */\nbody::before{content:${JSON.stringify(msg)};white-space:pre;display:block;font:12px monospace;padding:12px;color:#f44}`);
    }
    return;
  }

  const pathTrim = urlPath;
  const segments = pathTrim.split('/').filter(Boolean);
  const lastSeg = segments.length ? segments[segments.length - 1] : '';
  const lastHasDot = lastSeg.includes('.');

  const attempts = [];
  if (lastSeg && !lastHasDot) {
    attempts.push(urlToFsPath(`${pathTrim}.html`));
  }
  attempts.push(urlToFsPath(pathTrim));

  for (const fp of attempts) {
    if (!fp) continue;
    try {
      const stat = await fsp.stat(fp);
      if (stat.isDirectory()) {
        const idx = path.join(fp, 'index.html');
        try {
          const html = await fsp.readFile(idx);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        } catch {
          continue;
        }
      }
      if (stat.isFile()) {
        const ext = path.extname(fp).toLowerCase();
        const type = MIME[ext] || 'application/octet-stream';
        const body = await fsp.readFile(fp);
        res.writeHead(200, { 'Content-Type': type });
        res.end(body);
        return;
      }
    } catch {
      continue;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(err?.message || err));
  });
});

server.listen(PORT, () => {
  console.log(`Dev http://localhost:${PORT} — SCSS on-demand, extensionless → .html, live reload`);
});

try {
  const watcher = fs.watch(scssRoot, { recursive: true }, () => notifyReload());
  watcher.on('error', (err) => {
    console.warn('SCSS watch:', err.message || err);
  });
} catch (e) {
  console.warn('SCSS watch disabled:', e.message || e);
}

try {
  const publicDir = path.join(root, 'public');
  if (fs.existsSync(publicDir)) {
    const pubWatch = fs.watch(publicDir, { recursive: true }, () => notifyReload());
    pubWatch.on('error', (err) => {
      console.warn('public/ watch:', err.message || err);
    });
  }
} catch (e) {
  console.warn('public/ watch disabled:', e.message || e);
}
