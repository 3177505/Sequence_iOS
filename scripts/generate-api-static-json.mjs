import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildResearchImagesPayload, buildDataVideosPayload } from './lib/api-payloads.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'api-public-tree');

async function writeJson(name, data) {
  await fsp.mkdir(outDir, { recursive: true });
  const fp = path.join(outDir, `${name}.json`);
  await fsp.writeFile(fp, `${JSON.stringify(data)}\n`, 'utf8');
  console.log('wrote', path.relative(root, fp));
}

async function main() {
  await writeJson('research-images', await buildResearchImagesPayload(root));
  await writeJson('data-videos', await buildDataVideosPayload(root));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
