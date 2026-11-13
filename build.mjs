import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

let revision = process.env.VERCEL_GIT_COMMIT_SHA;
if (!revision) {
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
}
// Version affichée : fichier VERSION (vMAJEUR.MINEUR). Le hash Git ne sert plus à l'affichage.
const version = readFileSync('VERSION', 'utf8').trim();
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
for (const file of ['manifest.webmanifest', 'icon.svg', 'app.js', 'sim.js', 'brain.js', 'cortex.js', 'world.js', 'dialogue.js', 'collision-map.js', 'navigation.js', 'home.js', 'dashboard.js', 'styles.css', 'motor.js', 'social.js', 'play.js', 'french-words.js', 'play-view.js', 'toy-rails.js', 'panneaux.js', 'famille-phrases.js']) cpSync(file, 'dist/' + file);
writeFileSync('dist/index.html', readFileSync('index.html', 'utf8').replaceAll('__NÉO_VERSION__', version));
writeFileSync('dist/sw.js', readFileSync('sw.js', 'utf8').replaceAll('__NÉO_VERSION__', version));
