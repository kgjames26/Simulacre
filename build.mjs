// Construit le site statique dans dist/ : tous les scripts du dossier, les ressources, la version.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
const version = readFileSync('VERSION', 'utf8').trim();
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
const files = readdirSync('.').filter(f => /\.(js|css|svg|webmanifest)$/.test(f) && !['build.mjs', 'sw.js'].includes(f));
for (const file of files) cpSync(file, 'dist/' + file);
const shell = ['/', '/index.html', ...files.map(f => '/' + f)];
writeFileSync('dist/index.html', readFileSync('index.html', 'utf8').replaceAll('__NÉO_VERSION__', version));
writeFileSync('dist/sw.js', readFileSync('sw.js', 'utf8').replaceAll('__NÉO_VERSION__', version).replace('__SHELL__', JSON.stringify(shell)));
console.log('dist prêt · v' + version + ' · ' + files.length + ' fichiers');
