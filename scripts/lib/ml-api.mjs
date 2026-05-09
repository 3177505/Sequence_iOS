import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

let mlTrainChild = null;

async function resolveMlPython(repoRoot) {
  if (process.platform === 'win32') {
    const w = path.join(repoRoot, 'ml', '.venv', 'Scripts', 'python.exe');
    return (await pathExists(w)) ? w : null;
  }
  const cands = [path.join(repoRoot, 'ml', '.venv', 'bin', 'python3'), path.join(repoRoot, 'ml', '.venv', 'bin', 'python')];
  for (const c of cands) {
    if (await pathExists(c)) return c;
  }
  return null;
}

async function pathExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loraHasFiles(repoRoot) {
  const dir = path.join(repoRoot, 'ml', 'outputs', 'lora-run');
  async function anyWeight(d) {
    let items;
    try {
      items = await fsp.readdir(d, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of items) {
      const f = path.join(d, e.name);
      if (e.isFile() && (e.name.endsWith('.safetensors') || e.name.endsWith('.pt'))) return true;
      if (e.isDirectory() && (await anyWeight(f))) return true;
    }
    return false;
  }
  return anyWeight(dir);
}

function tailFileSync(abs, maxBytes = 12000) {
  try {
    const st = fs.statSync(abs);
    const fd = fs.openSync(abs, 'r');
    const n = Math.min(st.size, maxBytes);
    const start = st.size - n;
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, start);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch {
    return '';
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function handleMlApi(req, res, repoRoot) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;
  if (!p.startsWith('/api/ml/')) return false;
  if (process.env.SEQUENCE_ML_API === '0') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ML API vypnuto (SEQUENCE_ML_API=0).' }));
    return true;
  }

  if (p === '/api/ml/status' && req.method === 'GET') {
    (async () => {
      const py = await resolveMlPython(repoRoot);
      const venvOk = Boolean(py);
      const lora = venvOk ? await loraHasFiles(repoRoot) : false;
      const logPath = path.join(repoRoot, 'ml', 'outputs', 'node-ml-train.log');
      const logGui = path.join(repoRoot, 'ml', 'outputs', 'training-gui.log');
      const tail = [logPath, logGui]
        .map((f) => tailFileSync(f, 4000))
        .filter(Boolean)
        .join('\n---\n')
        .slice(-12000);
      const body = JSON.stringify({
        venvPython: venvOk,
        loraReady: lora,
        trainingRunning: Boolean(mlTrainChild),
        logTail: tail,
        platform: process.platform,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
    })().catch((e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    });
    return true;
  }

  if (p === '/api/ml/train' && req.method === 'POST') {
    (async () => {
      if (mlTrainChild) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Trénink už běží.' }));
        return;
      }
      const py = await resolveMlPython(repoRoot);
      if (!py) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Chybí ml/.venv a Python. Dokončete instalaci v ml/ (viz ML trénink).' }));
        return;
      }
      const body = await readJsonBody(req);
      const maxSteps = Math.max(5, Math.min(5000, Number(body.maxSteps) || 200));
      const resume = Boolean(body.resume);
      const logPath = path.join(repoRoot, 'ml', 'outputs', 'node-ml-train.log');
      await fsp.mkdir(path.dirname(logPath), { recursive: true });
      const t = new Date().toISOString();
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      logStream.write(`\n--- [${t}] start maxSteps=${maxSteps} resume=${resume} ---\n`);
      const env = {
        ...process.env,
        MAX_TRAIN_STEPS: String(maxSteps),
        TOKENIZERS_PARALLELISM: 'false',
      };
      if (resume) env.RESUME = '1';
      else delete env.RESUME;
      const script = path.join(repoRoot, 'ml', 'launch_train.py');
      const child = spawn(py, [script], {
        env,
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      mlTrainChild = child;
      const pipe = (buf, src) => {
        logStream.write(`[${src}] ${buf}`);
      };
      child.stdout?.on('data', (b) => pipe(b, 'out'));
      child.stderr?.on('data', (b) => pipe(b, 'err'));
      child.on('close', (code) => {
        mlTrainChild = null;
        logStream.write(`\n--- exit code ${code} ---\n`);
        logStream.end();
      });
      res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, message: 'Trénink spuštěn na pozadí. Obnovuj stav / log dole.' }));
    })().catch((e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    });
    return true;
  }

  if (p === '/api/ml/generate' && req.method === 'POST') {
    (async () => {
      const py = await resolveMlPython(repoRoot);
      if (!py) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Chybí ml/.venv' }));
        return;
      }
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || 'a sksseq photograph').trim() || 'a sksseq photograph';
      const count = Math.max(1, Math.min(8, Number(body.count) || 2));
      const useLora = body.useLora !== false;
      const lora = await loraHasFiles(repoRoot);
      if (useLora && !lora) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Složka LoRA je prázdná. Dokonči trénink nebo vypni „použít LoRA“.' }),
        );
        return;
      }
      const outDir = path.join(repoRoot, 'ml', 'outputs', 'gen');
      await fsp.mkdir(outDir, { recursive: true });
      const args = [path.join(repoRoot, 'ml', 'generate.py'), '--prompt', prompt, '--out-dir', outDir, '--count', String(count)];
      if (useLora && lora) {
        args.push('--lora', path.join(repoRoot, 'ml', 'outputs', 'lora-run'));
      }
      const r = await new Promise((resolve) => {
        const c = spawn(py, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        c.stdout.on('data', (b) => {
          out += b;
        });
        c.stderr.on('data', (b) => {
          err += b;
        });
        c.on('close', (code) => resolve({ code, out, err }));
      });
      if (r.code !== 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: (r.err + r.out).slice(-6000) || 'generate skončil chybou', code: r.code }),
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          message: (r.out || r.err || 'hotovo').trim().slice(-2000),
          outDir: '/ml/outputs/gen',
        }),
      );
    })().catch((e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    });
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Neznámý ML endpoint' }));
  return true;
}
