import path from 'path';
import { collectImagesRecursiveUnder } from './research-gallery.mjs';
import {
  inspirationCloudNotes,
  materialCloudNote,
} from './sequence-notes.mjs';

function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function buildInspirationCloudPayload(repoRoot) {
  const pinPath = path.join(repoRoot, 'public', '2_Pinball');
  const inspoPath = path.join(repoRoot, 'public', '1_Inspo');
  const fromPin = await collectImagesRecursiveUnder(repoRoot, pinPath);
  const fromInspo = await collectImagesRecursiveUnder(repoRoot, inspoPath);
  const images = shuffleInPlace([...fromPin, ...fromInspo]);
  return { images, notes: inspirationCloudNotes };
}

export async function buildMaterialCloudPayload(repoRoot) {
  const matPath = path.join(repoRoot, 'public', '3_Material');
  const images = shuffleInPlace([
    ...(await collectImagesRecursiveUnder(repoRoot, matPath)),
  ]);
  return { images, note: materialCloudNote };
}
