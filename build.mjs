import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

let revision = process.env.VERCEL_GIT_COMMIT_SHA;
if (!revision) {
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
}
const version = /^[0-9a-f]{7,64}$/i.test(revision || '') ? revision.slice(0, 8) : 'local';
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
for (const file of ['manifest.webmanifest', 'icon.svg', 'app.js', 'sim.js', 'dialogue.js', 'styles.css']) cpSync(file, 'dist/' + file);
writeFileSync('dist/index.html', readFileSync('index.html', 'utf8').replaceAll('__ALEX_VERSION__', version));
writeFileSync('dist/sw.js', readFileSync('sw.js', 'utf8').replaceAll('__ALEX_VERSION__', version));
