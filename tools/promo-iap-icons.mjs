// Иконки инап-покупок (PNG 256×256 с прозрачным фоном) из встроенных SVG-иконок игры.
//   node tools/promo-iap-icons.mjs
// Выход: promo/iap/icon-<id>.png для noads, coins500, coins1500, coins5000, boosters3.
// Иконка загружается в консоли: Инап-покупки → Инапы → покупка → «Иконка».
// Если покупки в игре будут другими (например, coins2500), допишите их в PRODUCTS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';
import { ICONS } from '../src/ui/icons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'promo/iap');
fs.mkdirSync(out, { recursive: true });

const font = (f) => fs.readFileSync(path.join(root, 'src/fonts', f)).toString('base64');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8')
  .split('\n').filter((l) => l.startsWith('@font-face') && l.includes('900') && l.includes('latin-900'))
  .map((l) => l.replace(/url\(fonts\/([^)]+)\)/, (m, f) => `url(data:font/woff2;base64,${font(f)})`)).join('\n');

const at = (name, x, y, s, rot = 0) => `<div class="i" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;transform:rotate(${rot}deg)">${ICONS[name]}</div>`;
const coins = (n) => {
  // 1, 3 или 6 монет горкой
  const pos = { 1: [[48, 30, 160]], 3: [[20, 70, 120, -12], [116, 70, 120, 12], [68, 24, 120]], 6: [[6, 104, 92, -14], [82, 110, 92], [158, 104, 92, 14], [44, 50, 92, -8], [120, 50, 92, 8], [82, 2, 92]] }[n];
  return pos.map(([x, y, s, r]) => at('coin', x, y, s, r || 0)).join('');
};
const PRODUCTS = {
  noads: { body: at('noads', 28, 28, 200), label: '' },
  coins500: { body: coins(1), label: '500' },
  coins1500: { body: coins(3), label: '1500' },
  coins5000: { body: coins(6), label: '5000' },
  boosters3: { body: at('bomb', 8, 40, 116, -10) + at('fire', 132, 40, 116, 10) + at('rainbow', 70, 8, 116), label: '×3' },
};

const html = (p) => `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
html,body{margin:0;width:256px;height:256px;background:transparent;overflow:hidden}
.i{position:absolute;filter:drop-shadow(0 6px 6px rgba(58,36,99,.35))}
.i svg{width:100%;height:100%;display:block}
.l{position:absolute;left:0;right:0;bottom:6px;text-align:center;font:900 54px/1 'Nunito',sans-serif;color:#fff;
  -webkit-text-stroke:10px #6c3fc5;paint-order:stroke fill;text-shadow:0 5px 0 #4a2696}
</style></head><body>${p.body}${p.label ? `<div class="l">${p.label}</div>` : ''}</body></html>`;

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 256, height: 256, deviceScaleFactor: 1 });
for (const [id, p] of Object.entries(PRODUCTS)) {
  await page.setContent(html(p), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `icon-${id}.png`), omitBackground: true });
  console.log(`✓ promo/iap/icon-${id}.png`);
}
await browser.close();
