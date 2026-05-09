import fsp from 'fs/promises';
import path from 'path';
import { filePathToEncodedUrl, IMAGE_EXT } from './public-tree.mjs';
import {
  defaultResearchPairId,
  researchLabelMeta,
  researchPairPresets,
} from './sequence-notes.mjs';

const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v']);

function splitIntoLeftRight(urls) {
  const mid = Math.ceil(urls.length / 2);
  return { left: urls.slice(0, mid), right: urls.slice(mid) };
}

function normalizeResearchPair(left, right) {
  if (left.length > 0 && right.length > 0) return { left, right };
  const all = left.concat(right);
  if (all.length < 3) return { left, right };
  return splitIntoLeftRight(all);
}

function resolveResearchPairConfig() {
  const id = process.env.SEQUENCE_RESEARCH_PAIR || defaultResearchPairId;
  return researchPairPresets.find((p) => p.id === id) || researchPairPresets[0] || null;
}

export function researchPairInfoForResponse() {
  const cfg = resolveResearchPairConfig();
  if (!cfg) return null;
  const l = researchLabelMeta[cfg.left];
  const r = researchLabelMeta[cfg.right];
  const folderSlug = (label) => {
    const last = (label.split('/').pop() || label).replace(/^\d+_/, '');
    return last || label;
  };
  return {
    id: cfg.id,
    leftPath: cfg.left,
    rightPath: cfg.right,
    leftTitle: (l && String(l.displayTitle || '').trim()) || folderSlug(cfg.left),
    rightTitle: (r && String(r.displayTitle || '').trim()) || folderSlug(cfg.right),
  };
}

async function collectImageUrlsInDir(rootResolved, absDir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    out.push(filePathToEncodedUrl(rootResolved, path.join(absDir, ent.name)));
  }
  return out.sort();
}

async function collectImagesRecursiveUnder(rootResolved, absDir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectImagesRecursiveUnder(rootResolved, full)));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      out.push(filePathToEncodedUrl(rootResolved, full));
    }
  }
  return out.sort();
}

async function collectVideosRecursiveUnder(rootResolved, absDir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectVideosRecursiveUnder(rootResolved, full)));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!VIDEO_EXT.has(ext)) continue;
      out.push(filePathToEncodedUrl(rootResolved, full));
    }
  }
  return out;
}

async function collectVideosInNamedDirsUnder(rootResolved, absDir, dirName) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const full = path.join(absDir, ent.name);
    if (ent.name === dirName) {
      out.push(...(await collectVideosRecursiveUnder(rootResolved, full)));
      continue;
    }
    out.push(...(await collectVideosInNamedDirsUnder(rootResolved, full, dirName)));
  }
  return out;
}

export async function buildResearchImagesPayload(rootResolved) {
  const researchRoot = path.join(rootResolved, 'public', 'research');
  const research4 = path.join(rootResolved, 'public', '4_Research');
  let baselineLeft = await collectImageUrlsInDir(rootResolved, path.join(researchRoot, 'baseline-left'));
  let baselineRight = await collectImageUrlsInDir(rootResolved, path.join(researchRoot, 'baseline-right'));
  let triggerLeft = await collectImageUrlsInDir(rootResolved, path.join(researchRoot, 'trigger-left'));
  let triggerRight = await collectImageUrlsInDir(rootResolved, path.join(researchRoot, 'trigger-right'));
  let b = normalizeResearchPair(baselineLeft, baselineRight);
  baselineLeft = b.left;
  baselineRight = b.right;
  let bUnion = baselineLeft.length + baselineRight.length;
  if (baselineLeft.length === 0 || baselineRight.length === 0 || bUnion < 3) {
    const pairCfg = resolveResearchPairConfig();
    if (pairCfg) {
      const leftPath = path.join(research4, ...pairCfg.left.split('/').slice(1));
      const rightPath = path.join(research4, ...pairCfg.right.split('/').slice(1));
      const L = await collectImagesRecursiveUnder(rootResolved, leftPath);
      const R = await collectImagesRecursiveUnder(rootResolved, rightPath);
      if (L.length > 0 && R.length > 0 && L.length + R.length >= 3) {
        baselineLeft = L;
        baselineRight = R;
        bUnion = L.length + R.length;
      }
    }
  }
  if (baselineLeft.length === 0 || baselineRight.length === 0 || bUnion < 3) {
    const allSub = await collectImagesRecursiveUnder(rootResolved, researchRoot);
    if (allSub.length >= 3) {
      const s = splitIntoLeftRight(allSub);
      baselineLeft = s.left;
      baselineRight = s.right;
      bUnion = baselineLeft.length + baselineRight.length;
    }
  }
  if (baselineLeft.length === 0 || baselineRight.length === 0 || bUnion < 3) {
    const all4 = await collectImagesRecursiveUnder(rootResolved, research4);
    if (all4.length >= 3) {
      const s = splitIntoLeftRight(all4);
      baselineLeft = s.left;
      baselineRight = s.right;
    }
  }
  let t = normalizeResearchPair(triggerLeft, triggerRight);
  triggerLeft = t.left;
  triggerRight = t.right;
  const tUnion = triggerLeft.length + triggerRight.length;
  if (triggerLeft.length === 0 || triggerRight.length === 0 || tUnion < 3) {
    triggerLeft = baselineLeft.slice();
    triggerRight = baselineRight.slice();
  }
  return {
    baseline: { left: baselineLeft, right: baselineRight },
    trigger: { left: triggerLeft, right: triggerRight },
    pair: researchPairInfoForResponse(),
  };
}

export async function buildDataVideosPayload(rootResolved) {
  const root7 = path.join(rootResolved, 'public', '7_DataVideos');
  const urls = await collectVideosInNamedDirsUnder(rootResolved, root7, '_Video');
  urls.sort();
  const { left, right } = splitIntoLeftRight(urls);
  return { all: urls, left, right };
}
