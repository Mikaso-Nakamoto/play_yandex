// Иконка и обложки для черновика Яндекс Игр из ключевого арта.
//   node tools/promo-art.mjs
// Вход:  promo/src/keyart.png (1280×720, сгенерированный арт), promo/src/icon-raw.png (квадрат).
// Выход: promo/icon/icon-512.png, promo/cover/cover-800x470.png (без текста),
//        promo/cover/cover-800x470-{ru,en,tr}.png (с локализованным названием).
// Требует ffmpeg (см. tools/ffmpeg.mjs) и headless Chromium (tools/browser.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';
import { toRgbPng } from './ffmpeg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(root, ...a);
const SRC = P('promo/src');
const TMP = P('.tmp/promo');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(P('promo/icon'), { recursive: true });
fs.mkdirSync(P('promo/cover'), { recursive: true });

// Ключевой арт пришёл со скруглёнными белыми углами (радиус ≈ 78 px) — кадрируем так,
// чтобы углы гарантированно ушли за край (п. 8.3.3: без рамок и скруглённых углов).
// 1171×688 ≈ 800:470, отступы 54/16 px.
const CROP = { w: 1171, h: 688, x: 54, y: 16 };
const coverBase = P('promo/cover/cover-800x470.png');
toRgbPng(path.join(SRC, 'keyart.png'), coverBase, `crop=${CROP.w}:${CROP.h}:${CROP.x}:${CROP.y},scale=800:470:flags=lanczos`);
toRgbPng(path.join(SRC, 'icon-raw.png'), P('promo/icon/icon-512.png'), 'scale=512:512:flags=lanczos');
console.log('✓ icon-512.png, cover-800x470.png');

// ---------- Обложки с названием ----------
const TITLES = {
  ru: ['Мяу-', 'шарики'],
  en: ['Meow', 'Bubbles'],
  tr: ['Miyav', 'Baloncukları'],
};
const font = (f) => fs.readFileSync(P('src/fonts', f)).toString('base64');
const css = fs.readFileSync(P('src/style.css'), 'utf8')
  .split('\n').filter((l) => l.startsWith('@font-face') && l.includes('900'))
  .map((l) => l.replace(/url\(fonts\/([^)]+)\)/, (m, f) => `url(data:font/woff2;base64,${font(f)})`))
  .join('\n');
const bg = fs.readFileSync(coverBase).toString('base64');

// Область для логотипа: небо над котом (координаты обложки 800×470)
const BOX = { x: 14, y: 8, w: 430, h: 146 };

function html(lines) {
  const [a, b] = lines;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
html,body{margin:0;width:800px;height:470px;overflow:hidden;background:#000}
img{position:absolute;left:0;top:0;width:800px;height:470px}
svg{position:absolute;left:0;top:0;overflow:visible}
text{font-family:'Nunito';font-weight:900;text-anchor:middle;paint-order:stroke fill;stroke-linejoin:round;stroke-linecap:round}
.back{fill:#4a2696;stroke:#4a2696;stroke-width:22px}
.front{stroke:#6c3fc5;stroke-width:15px}
.l1.front{fill:url(#g1)}
.l2.front{fill:url(#g2)}
.shine{fill:none;stroke:rgba(255,255,255,.55);stroke-width:2px;paint-order:normal}
</style></head><body>
<img src="data:image/png;base64,${bg}">
<svg width="800" height="470" viewBox="0 0 800 470">
<defs>
  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".55" stop-color="#ffc233"/><stop offset="1" stop-color="#ff8a1f"/></linearGradient>
  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe3f1"/></linearGradient>
  <filter id="sh" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#2a1060" flood-opacity=".38"/></filter>
</defs>
<g id="place"><g id="logo" filter="url(#sh)">
  <g transform="translate(0,9)"><text class="back l1" x="0" y="0" font-size="66">${a}</text><text class="back l2" x="0" y="78" font-size="84">${b}</text></g>
  <text class="front l1" x="0" y="0" font-size="66">${a}</text>
  <text class="front l2" x="0" y="78" font-size="84">${b}</text>
</g></g>
</svg>
<script>
window.layout = async () => {
  await document.fonts.ready;
  const g = document.getElementById('logo'), place = document.getElementById('place');
  const b0 = g.getBBox(), pad = 11; // половина толщины обводки
  const bb = { x: b0.x - pad, y: b0.y - pad, width: b0.width + 2 * pad, height: b0.height + 2 * pad };
  const box = ${JSON.stringify(BOX)};
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const apply = (k) => place.setAttribute('transform', 'translate(' + cx + ',' + cy + ') rotate(-4) scale(' + k + ') translate(' + (-(bb.x + bb.width / 2)) + ',' + (-(bb.y + bb.height / 2)) + ')');
  let s = Math.min(box.w / bb.width, box.h / bb.height);
  for (let i = 0; i < 4; i++) { // поворот увеличивает габарит — подгоняем масштаб
    apply(s);
    const q = place.getBoundingClientRect(), mm = pad * s;
    const k = Math.min(box.w / (q.width + 2 * mm), box.h / (q.height + 2 * mm));
    if (k >= 0.999) break;
    s *= k;
  }
  const r = place.getBoundingClientRect(), m = pad * s;
  return { s, left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m, fonts: [...document.fonts].filter(f => f.status === 'loaded').length };
};
</script>
</body></html>`;
}

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 470, deviceScaleFactor: 1 });
for (const [lang, lines] of Object.entries(TITLES)) {
  await page.setContent(html(lines), { waitUntil: 'load' });
  const info = await page.evaluate(() => window.layout());
  if (!info.fonts) throw new Error('шрифт Nunito не загрузился');
  if (info.left < 2 || info.top < 2 || info.right > 798 || info.bottom > 468) throw new Error('логотип выходит за край: ' + JSON.stringify(info));
  const tmp = path.join(TMP, `cover-${lang}.png`);
  await page.screenshot({ path: tmp });
  toRgbPng(tmp, P(`promo/cover/cover-800x470-${lang}.png`));
  console.log(`✓ cover-800x470-${lang}.png`, JSON.stringify({ s: +info.s.toFixed(2), box: [Math.round(info.left), Math.round(info.top), Math.round(info.right), Math.round(info.bottom)] }));
}
await browser.close();
