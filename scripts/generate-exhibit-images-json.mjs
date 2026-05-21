import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function webPathSegmentFromFs(fsName) {
  return encodeURIComponent(fsName);
}

function sortFolderNames(names) {
  return names.slice().sort((a, b) => {
    const da = /^\d+$/.test(a);
    const db = /^\d+$/.test(b);
    if (da && db) return parseInt(a, 10) - parseInt(b, 10);
    if (da) return -1;
    if (db) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

async function listImageFilesInDir(absDir, urlPrefix) {
  const out = [];
  let dirents = [];
  try {
    dirents = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  dirents.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const ent of dirents) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!exts.has(ext)) continue;
    out.push(`${urlPrefix}/${webPathSegmentFromFs(ent.name)}`);
  }
  return out;
}

async function listImagesGrouped(relDirUnderPublic) {
  const absDir = path.join(root, 'public', relDirUnderPublic);
  const basePrefix = `/public/${relDirUnderPublic.replace(/\\/g, '/')}`;
  const folders = {};
  const flat = [];
  let dirents = [];
  try {
    dirents = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return { folders, flat };
  }

  const rootFiles = await listImageFilesInDir(absDir, basePrefix);
  if (rootFiles.length) {
    folders._root = rootFiles;
    flat.push(...rootFiles);
  }

  const subdirs = sortFolderNames(dirents.filter((d) => d.isDirectory()).map((d) => d.name));
  for (const name of subdirs) {
    const subAbs = path.join(absDir, name);
    const subPrefix = `${basePrefix}/${webPathSegmentFromFs(name)}`;
    const urls = await listImageFilesInDir(subAbs, subPrefix);
    if (urls.length) {
      folders[name] = urls;
      flat.push(...urls);
    }
  }

  return { folders, flat };
}

function pairedFolderList(leftFolders, rightFolders) {
  const rightSet = new Set(Object.keys(rightFolders));
  return sortFolderNames(Object.keys(leftFolders)).filter((k) => {
    const l = leftFolders[k];
    const r = rightFolders[k];
    return rightSet.has(k) && l?.length && r?.length;
  });
}

async function main() {
  const leftGrouped = await listImagesGrouped('exhibit-left');
  const rightGrouped = await listImagesGrouped('exhibit-right');
  const folders = pairedFolderList(leftGrouped.folders, rightGrouped.folders);
  const outPath = path.join(root, 'public', 'exhibit-images.json');
  const payload = {
    version: 2,
    folders,
    leftFolders: leftGrouped.folders,
    rightFolders: rightGrouped.folders,
    left: leftGrouped.flat,
    right: rightGrouped.flat,
  };
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, `${JSON.stringify(payload)}\n`, 'utf8');
  console.log(
    'exhibit-images.json →',
    leftGrouped.flat.length,
    'left,',
    rightGrouped.flat.length,
    'right,',
    folders.length,
    'paired folders',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
