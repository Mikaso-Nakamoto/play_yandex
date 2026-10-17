// Сборка: src → dist (один минифицированный game.js) → release/meow-bubbles-yandex.zip
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const release = path.join(root, 'release');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'fonts'), { recursive: true });
fs.mkdirSync(release, { recursive: true });

// 1. JS — один файл, ES2015 для старых браузеров
await esbuild.build({
  entryPoints: [path.join(src, 'main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2015', 'safari11', 'chrome58', 'firefox57'],
  outfile: path.join(dist, 'game.js'),
  legalComments: 'none',
  logLevel: 'warning',
});

// 2. CSS
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const cssMin = await esbuild.transform(css, { loader: 'css', minify: true, target: ['safari11', 'chrome58'] });
fs.writeFileSync(path.join(dist, 'style.css'), cssMin.code);

// 3. HTML — подключаем собранный скрипт
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<!--GAME_SCRIPT-->[\s\S]*?<!--\/GAME_SCRIPT-->/, '<script src="game.js"></script>');
fs.writeFileSync(path.join(dist, 'index.html'), html);

// 4. Шрифты
for (const f of fs.readdirSync(path.join(src, 'fonts'))) fs.copyFileSync(path.join(src, 'fonts', f), path.join(dist, 'fonts', f));

// 4б. Картинки (рисованные фоны и т. п.)
if (fs.existsSync(path.join(src, 'assets'))) fs.cpSync(path.join(src, 'assets'), path.join(dist, 'assets'), { recursive: true });

// 5. Проверки требований к архиву
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(path.relative(dist, p));
  }
})(dist);
const bad = files.filter((f) => !/^[A-Za-z0-9._\/-]+$/.test(f));
if (bad.length) throw new Error('Имена файлов должны быть латиницей: ' + bad.join(', '));
const bundle = fs.readFileSync(path.join(dist, 'game.js'), 'utf8');
if (/s3\.yandex\.net|yastatic\.net/.test(bundle + html)) throw new Error('Найдена абсолютная ссылка на S3 Яндекса');
if (!html.includes('<script src="/sdk.js"></script>')) throw new Error('Нет подключения /sdk.js');

// 6. Архив (index.html в корне)
const zipName = `meow-bubbles-yandex-v${pkg.version}.zip`;
const zipPath = path.join(release, zipName);
for (const f of fs.readdirSync(release)) if (f.endsWith('.zip')) fs.rmSync(path.join(release, f));
execSync(`cd "${dist}" && zip -q -r -X "${zipPath}" .`);

const size = (p) => (fs.statSync(p).size / 1024).toFixed(1) + ' КБ';
console.log('Собрано:');
for (const f of files) console.log('  ' + f.padEnd(40) + size(path.join(dist, f)));
console.log(`Архив: release/${zipName} (${size(zipPath)})`);
