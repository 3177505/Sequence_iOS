import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

async function listImages(relDir) {
  const dir = path.join(root, 'public', relDir);
  let names = [];
  try {
    names = await fsp.readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!exts.has(ext)) continue;
    try {
      const st = await fsp.stat(path.join(dir, name));
      if (!st.isFile()) continue;
    } catch {
      continue;
    }
    out.push(`/public/${relDir}/${encodeURIComponent(name)}`);
  }
  return out;
}

async function main() {
  const left = await listImages('exhibit-left');
  const right = await listImages('exhibit-right');
  const outPath = path.join(root, 'public', 'exhibit-images.json');
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, `${JSON.stringify({ left, right })}\n`, 'utf8');
  console.log('exhibit-images.json →', left.length, 'left,', right.length, 'right');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
