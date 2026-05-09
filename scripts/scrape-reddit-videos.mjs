import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchRedditVideosPayload, REDDIT_VIDEO_WRAPPERS } from './lib/reddit-videos-fetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const payload = await fetchRedditVideosPayload();
  for (const { key } of REDDIT_VIDEO_WRAPPERS) {
    console.log(`${key}: ${payload[key]?.length ?? 0} posts with video`);
  }
  const outFile = path.join(ROOT, 'assets', 'data', 'reddit-videos.json');
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log('Wrote', outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
