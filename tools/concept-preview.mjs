// Концепт-превью нового фона БЕЗ изменения исходников игры:
// в тестовом стенде подменяется renderer.ensureBg, и один и тот же детерминированный кадр
// снимается с текущим (процедурным) и с рисованным фоном. Результат — сравнение «до/после».
//   BG=.tmp/art/bg-0-meadow.jpg LEVEL=11 SEED=3 node tools/concept-preview.mjs [baseUrl]
// Выход: docs/concept/compare-game.jpg и compare-map.jpg (или OUT=<папка>).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openGame, startScene, stepUntil, promoSave } from './promo-lib.mjs';
import { serveDist } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = process.env.BG || path.join(root, 'docs/concept/bg-meadow-concept.jpg');
const LEVEL = Number(process.env.LEVEL || 11);
const SEED = Number(process.env.SEED || 3);
const OUT = path.resolve(root, process.env.OUT || 'docs/concept');
fs.mkdirSync(OUT, { recursive: true });
const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const bgUrl = dataUrl(BG, /\.png$/i.test(BG) ? 'image/png' : 'image/jpeg');

const server = await serveDist(process.argv[2]);
const browser = await launch();
const g = await openGame(browser, { base: server.base, lang: 'ru', vp: 'portrait', save: promoSave(LEVEL + 1) });
await g.page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const r = window.__app.renderer;
  const orig = r.ensureBg;
  window.__paintBg = (on) => {
    r.ensureBg = on ? function () {
      const key = `P|${this.w}x${this.h}|${this.dpr}`;
      if (key === this.bgKey) return;
      this.bgKey = key;
      const s = Math.min(this.dpr, 1.5);
      const c = document.createElement('canvas');
      c.width = Math.round(this.w * s); c.height = Math.round(this.h * s);
      const x = c.getContext('2d');
      const k = Math.max(c.width / img.width, c.height / img.height); // cover
      x.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k);
      this.bg = c;
    } : orig;
    r.bgKey = ''; r.ensureBg();
  };
}, bgUrl);

const tmp = path.join(root, '.tmp/concept');
fs.mkdirSync(tmp, { recursive: true });
const capture = async (name) => {
  await startScene(g.page, { level: LEVEL, seed: SEED });
  await stepUntil(g.page, "dir.shots === 2 && dir.phase === 'aim' && dir.t >= dir.dur", 1500);
  await g.snap(path.join(tmp, `${name}-game.png`));
  await g.page.evaluate(() => { const a = window.__app; a.popups.closeAll(); a.cleanupLevel(); a.showHub(); });
  await g.step(45);
  await g.snap(path.join(tmp, `${name}-map.png`));
};
await capture('before');
await g.page.evaluate(() => window.__paintBg(true));
await capture('after');
if (g.errors.length) console.log('Ошибки в консоли:', g.errors);
await g.close();

// Сборка сравнения в браузере (шрифт игры Nunito)
const fontFile = (sub) => dataUrl(path.join(root, `node_modules/@fontsource/nunito/files/nunito-${sub}-900-normal.woff2`), 'font/woff2');
const fontL = fontFile('latin');
const fontC = fontFile('cyrillic');
const page = await browser.newPage();
await page.setViewport({ width: 1110, height: 1030, deviceScaleFactor: 1 });
for (const [kind, title] of [['game', `Уровень ${LEVEL}`], ['map', 'Карта уровней']]) {
  const a = dataUrl(path.join(tmp, `before-${kind}.png`), 'image/png');
  const b = dataUrl(path.join(tmp, `after-${kind}.png`), 'image/png');
  await page.setContent(`<style>@font-face{font-family:NL;src:url(${fontL})}@font-face{font-family:NC;src:url(${fontC})}
    body{margin:0;background:#241a40;font:900 30px NL,NC,sans-serif;color:#fff;display:flex;gap:30px}
    figure{margin:0;width:540px;text-align:center} figcaption{height:70px;line-height:70px}
    img{width:540px;height:960px;display:block}</style>
    <figure><figcaption>${title}: сейчас (MVP)</figcaption><img src="${a}"></figure>
    <figure><figcaption>${title}: концепт</figcaption><img src="${b}"></figure>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(OUT, `compare-${kind}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
  console.log('→', path.relative(root, file));
}
await browser.close(); server.stop();
