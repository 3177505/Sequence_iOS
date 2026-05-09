import path from 'path';
import fsp from 'fs/promises';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

export function filePathToEncodedUrl(repoRoot, absFilePath) {
  const rel = path.relative(repoRoot, absFilePath).split(path.sep).join('/');
  return `/${rel.split('/').filter(Boolean).map((seg) => encodeURIComponent(seg)).join('/')}`;
}

export async function buildPublicFolderTree(repoRoot, absDir) {
  const relPath = path.relative(repoRoot, absDir).split(path.sep).join('/');
  const baseName = path.basename(absDir);
  let stat;
  try {
    stat = await fsp.stat(absDir);
  } catch {
    return { name: baseName, relPath, files: [], children: [], missing: true };
  }
  if (!stat.isDirectory()) {
    return { name: baseName, relPath, files: [], children: [], missing: true };
  }
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return { name: baseName, relPath, files: [], children: [], missing: true };
  }
  const files = [];
  const childDirs = [];
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const full = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      childDirs.push(ent);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      files.push({ name: ent.name, url: filePathToEncodedUrl(repoRoot, full) });
    }
  }
  const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  childDirs.sort(cmp);
  files.sort(cmp);
  const children = [];
  for (const ent of childDirs) {
    children.push(await buildPublicFolderTree(repoRoot, path.join(absDir, ent.name)));
  }
  return { name: baseName, relPath, files, children };
}

export { IMAGE_EXT };
