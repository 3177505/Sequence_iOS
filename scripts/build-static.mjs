import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as sass from 'sass';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const PUBLIC_EXCLUDE = new Set(['11_Anotace', '10_Vitek', 'finance']);

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

async function safeCp(src, dest, filter) {
  try {
    await fsp.stat(src);
  } catch {
    return;
  }
  await fsp.cp(src, dest, { recursive: true, ...(filter ? { filter } : {}) });
}

function publicCopyFilter(srcPath) {
  const rel = path.relative(path.join(root, 'public'), srcPath);
  if (!rel || rel === '.') return true;
  return !PUBLIC_EXCLUDE.has(rel.split(path.sep)[0]);
}

async function writePageHtml(srcDir, destDir) {
  let names;
  try {
    names = await fsp.readdir(srcDir);
  } catch {
    return;
  }
  await fsp.mkdir(destDir, { recursive: true });
  for (const name of names) {
    if (!name.endsWith('.html')) continue;
    let html = await fsp.readFile(path.join(srcDir, name), 'utf8');
    html = html.replace(/href="assets\/scss\/([^"]+)\.scss"/g, 'href="assets/css/$1.css"');
    await fsp.writeFile(path.join(destDir, name), html, 'utf8');
  }
}

async function main() {
  run('node scripts/generate-public-tree-json.mjs');
  run('node scripts/generate-api-static-json.mjs');
  run('node scripts/generate-exhibit-images-json.mjs');
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
  await safeCp(path.join(root, 'public'), path.join(dist, 'public'), publicCopyFilter);
  await writePageHtml(path.join(root, 'pages'), dist);
  await safeCp(path.join(root, 'serve.json'), path.join(dist, 'serve.json'));

  console.log('build-static →', dist);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
