import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as sass from 'sass';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

async function safeCp(src, dest) {
  try {
    await fsp.stat(src);
  } catch {
    return;
  }
  await fsp.cp(src, dest, { recursive: true });
}

async function main() {
  run('node scripts/generate-public-tree-json.mjs');
  run('node scripts/generate-api-static-json.mjs');
  try {
    run('node scripts/scrape-reddit-videos.mjs');
  } catch {
    console.warn('scrape-reddit-videos failed or skipped; using committed reddit JSON if present');
  }

  await fsp.rm(dist, { recursive: true, force: true });

  const scssDir = path.join(root, 'assets', 'scss');
  const entries = await fsp.readdir(scssDir);
  const cssOut = path.join(dist, 'assets', 'css');
  await fsp.mkdir(cssOut, { recursive: true });
  for (const name of entries) {
    if (!name.endsWith('.scss') || name.startsWith('_')) continue;
    const inFile = path.join(scssDir, name);
    const outName = name.replace(/\.scss$/i, '.css');
    const outFile = path.join(cssOut, outName);
    const result = sass.compile(inFile, {
      style: 'compressed',
      loadPaths: [scssDir],
      sourceMap: false,
    });
    await fsp.writeFile(outFile, result.css, 'utf8');
  }

  await safeCp(path.join(root, 'assets', 'js'), path.join(dist, 'assets', 'js'));
  await safeCp(path.join(root, 'assets', 'data'), path.join(dist, 'assets', 'data'));
  await safeCp(path.join(root, 'templates'), path.join(dist, 'templates'));
  await safeCp(path.join(root, 'partials'), path.join(dist, 'partials'));
  await safeCp(path.join(root, 'public'), path.join(dist, 'public'));

  const rootFiles = await fsp.readdir(root);
  for (const name of rootFiles) {
    if (!name.endsWith('.html')) continue;
    let html = await fsp.readFile(path.join(root, name), 'utf8');
    html = html.replace(/href="assets\/scss\/([^"]+)\.scss"/g, 'href="assets/css/$1.css"');
    await fsp.writeFile(path.join(dist, name), html, 'utf8');
  }

  console.log('build-static →', dist);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
