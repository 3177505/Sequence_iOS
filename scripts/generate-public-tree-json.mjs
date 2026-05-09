import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPublicFolderTree } from './lib/public-tree.mjs';
import { buildResearchGalleryPayload } from './lib/research-gallery.mjs';
import {
  buildInspirationCloudPayload,
  buildMaterialCloudPayload,
} from './lib/browse-cloud-payload.mjs';
import { buildGlossaryPayload } from './lib/sequence-notes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'api-public-tree');

async function writeJson(name, data) {
  await fsp.mkdir(outDir, { recursive: true });
  const fp = path.join(outDir, `${name}.json`);
  await fsp.writeFile(fp, JSON.stringify(data, null, 0), 'utf8');
  console.log('wrote', path.relative(root, fp));
}

async function main() {
  const pinRoot = path.join(root, 'public', '2_Pinball');
  const inspoRoot = path.join(root, 'public', '1_Inspo');
  await writeJson('inspiration', {
    sources: [
      { key: '2_Pinball', label: 'Pinball', node: await buildPublicFolderTree(root, pinRoot) },
      { key: '1_Inspo', label: 'Inspo', node: await buildPublicFolderTree(root, inspoRoot) },
    ],
  });
  await writeJson('research', {
    node: await buildPublicFolderTree(root, path.join(root, 'public', 'research')),
  });
  await writeJson('material', {
    node: await buildPublicFolderTree(root, path.join(root, 'public', '3_Material')),
  });
  await writeJson('research-gallery', await buildResearchGalleryPayload(root));
  await writeJson('inspiration-cloud', await buildInspirationCloudPayload(root));
  await writeJson('material-cloud', await buildMaterialCloudPayload(root));
  await writeJson('glossary', buildGlossaryPayload());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
