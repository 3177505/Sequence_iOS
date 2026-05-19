import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function encodePathSegmentFromFs(fsName) {
  let s = fsName;
  for (let n = 0; n < 8; n++) {
    try {
      const decoded = decodeURIComponent(s);
      if (decoded === s) break;
      s = decoded;
    } catch {
      break;
    }
  }
  return encodeURIComponent(s);
}

async function walkCollectImages(absDir, relSegments, relDirWebSeg) {
  const out = [];
  let dirents = [];
  try {
    dirents = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  dirents.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of dirents) {
    const name = ent.name;
    const nextAbs = path.join(absDir, name);
    const segsNext = [...relSegments, name];
    if (ent.isDirectory()) {
      out.push(...(await walkCollectImages(nextAbs, segsNext, relDirWebSeg)));
    } else if (ent.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (!exts.has(ext)) continue;
      const url =
        '/public/' +
        relDirWebSeg +
        '/' +
        segsNext.map((seg) => encodePathSegmentFromFs(seg)).join('/');
      out.push(url);
    }
  }
  return out;
}

async function listImagesRecursive(relDirUnderPublic) {
  const absDir = path.join(root, 'public', relDirUnderPublic);
  return walkCollectImages(absDir, [], relDirUnderPublic.replace(/\\/g, '/'));
}

async function main() {
  const left = await listImagesRecursive('exhibit-left');
  const right = await listImagesRecursive('exhibit-right');
  const outPath = path.join(root, 'public', 'exhibit-images.json');
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, `${JSON.stringify({ left, right })}\n`, 'utf8');
  console.log('exhibit-images.json →', left.length, 'left,', right.length, 'right');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
