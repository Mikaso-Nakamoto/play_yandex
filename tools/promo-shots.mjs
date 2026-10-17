// Скриншоты реального геймплея для черновика Яндекс Игр.
//   npm run build && node tools/promo-shots.mjs [baseUrl]
// Без baseUrl скрипт сам поднимает локальный сервер для dist/ (tools/serve.mjs).
// Env: LANGS=ru,en,tr  VPS=portrait,landscape  ONLY=01-aim,02-combo,...
// Выход: promo/screenshots/<lang>/mobile-NN-*.jpg (1080×1920) и desktop-NN-*.jpg (1920×1080).
// Сцены детерминированы (зерно), в кадре только игра — без панели мок-SDK и рекламы.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openGame, startScene, stepUntil, promoSave, sceneSummary } from './promo-lib.mjs';
import { serveDist } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await serveDist(process.argv[2]);
const BASE = server.base;
const LANGS = (process.env.LANGS || 'ru,en,tr').split(',');
const VPS = (process.env.VPS || 'portrait,landscape').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const NAME = { portrait: 'mobile', landscape: 'desktop' };

// until — условие в странице (app, e, dir, vt); кадр снимается в момент его выполнения
const SCENES = [
  // прицел с отскоком от стенки, котята в шариках
  { id: '01-aim', level: 11, seed: 3, until: "dir.shots === 2 && dir.phase === 'aim' && dir.t >= dir.dur" },
  // комбо: «Супер!», падающие шарики, следующий прицел уже виден
  { id: '02-combo', level: 22, seed: 2, until: "dir.events.some((x) => x.type === 'praise' && vt.now() - x.t >= 380)" },
  // бустер «огонь» прожигает шарики
  { id: '03-booster', level: 32, seed: 3, plan: [{ booster: 'fire' }], until: "dir.events.filter((x) => x.type === 'burn').length >= 9" },
  // бесконечный режим (ночной мир)
  { id: '04-endless', level: 'endless', seed: 8, until: "dir.shots === 4 && dir.phase === 'aim' && dir.t >= dir.dur" },
  // карта уровней (не геймплей — загружать по желанию, см. README)
  { id: '05-map', hub: true },
];

const browser = await launch();
let count = 0;
for (const lang of LANGS) {
  const outDir = path.join(root, 'promo/screenshots', lang);
  fs.mkdirSync(outDir, { recursive: true });
  for (const vp of VPS) {
    const g = await openGame(browser, { base: BASE, lang, vp, save: promoSave(40, { endlessBest: 4320 }) });
    for (const sc of SCENES) {
      if (ONLY && !ONLY.includes(sc.id)) continue;
      const file = path.join(outDir, `${NAME[vp]}-${sc.id}.jpg`);
      if (sc.hub) {
        await g.page.evaluate(() => { const a = window.__app; a.popups.closeAll(); a.showHub(); });
        await g.step(40);
        await g.page.evaluate(() => window.__app.popups.closeAll());
        await g.step(15);
        await g.snap(file, 90);
      } else {
        await startScene(g.page, { level: sc.level, seed: sc.seed, plan: sc.plan || null });
        const fr = await stepUntil(g.page, sc.until, 2400);
        if (fr < 0) { console.log(`  ✗ ${lang} ${vp} ${sc.id}: условие не выполнено`, JSON.stringify(await sceneSummary(g.page))); continue; }
        await g.snap(file, 90);
      }
      count++;
      console.log(`  ✓ ${lang}/${path.basename(file)}`);
    }
    if (g.errors.length) console.log('  ошибки на странице:', g.errors.slice(0, 5));
    await g.close();
  }
}
await browser.close();
server.stop();
console.log(`Готово, скриншотов: ${count} (promo/screenshots/)`);
