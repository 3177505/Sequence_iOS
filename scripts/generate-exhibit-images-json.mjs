import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function webPathSegmentFromFs(fsName) {
  return encodeURIComponent(fsName);
}

async function listImagesFlat(relDirUnderPublic) {
  const absDir = path.join(root, 'public', relDirUnderPublic);
  const out = [];
  let dirents = [];
  try {
    dirents = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  dirents.sort((a, b) => a.name.localeCompare(b.name));
  const basePrefix = `/public/${relDirUnderPublic.replace(/\\/g, '/')}`;
  for (const ent of dirents) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    out.push(`${basePrefix}/${webPathSegmentFromFs(ent.name)}`);
  }
  return out;
}

async function main() {
  const left = await listImagesFlat('exhibit-left');
  const right = await listImagesFlat('exhibit-right');
  const outPath = path.join(root, 'public', 'exhibit-images.json');
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, `${JSON.stringify({ left, right })}\n`, 'utf8');
  console.log('exhibit-images.json →', left.length, 'left,', right.length, 'right');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
