// Soak-тест (долгая сессия): бот подряд проходит уровни и бесконечный режим.
// Между уровнями — принудительный GC и замер кучи JS / числа DOM-узлов / частиц.
// Признак утечки — рост кучи/DOM от уровня к уровню; плюс не должно быть ошибок в консоли.
//   npm run test:soak            (сам соберёт dist и поднимет сервер)
//   node tools/soak.mjs [baseUrl]
import { launch, openGame, startScene, promoSave, FRAME_MS } from './promo-lib.mjs';
import { serveDist } from './serve.mjs';

const server = await serveDist(process.argv[2]);
const browser = await launch();
const g = await openGame(browser, { base: server.base, lang: 'ru', vp: 'portrait', save: promoSave(40) });

const measure = async () => {
  await g.cdp.send('HeapProfiler.enable');
  await g.cdp.send('HeapProfiler.collectGarbage');
  const u = await g.cdp.send('Runtime.getHeapUsage');
  const st = await g.page.evaluate(() => ({
    dom: document.getElementsByTagName('*').length,
    parts: (window.__app.renderer.parts || []).length,
  }));
  return { heapMB: +(u.usedSize / 1048576).toFixed(2), ...st };
};

// Играть, пока не откроется итоговое окно (победа / проигрыш / «нет выстрелов» / конец бесконечного режима)
const playUntilEnd = (maxFrames) => g.page.evaluate((max, ms) => {
  const app = window.__app;
  for (let i = 0; i < max; i++) {
    window.__vt.step(ms);
    if (app.popups.isOpen) {
      const id = (app.popups.top && app.popups.top.id) || '';
      if (/win|fail|out|endless/i.test(id)) return { frames: i, end: id };
      app.popups.closeAll(); // обучалки и подсказки
    }
  }
  return { frames: max, end: 'cap' };
}, maxFrames, FRAME_MS);

const toHub = async () => {
  await g.page.evaluate(() => { const a = window.__app; a.popups.closeAll(); a.cleanupLevel(); a.showHub(); });
  await g.step(20);
};

const t0 = Date.now();
const rows = [{ at: 'hub (старт)', ...(await measure()) }];
let frames = 0;
for (const lv of [5, 7, 9, 12, 14, 17, 21, 26]) {
  await startScene(g.page, { level: lv, seed: lv });
  const r = await playUntilEnd(1800);
  frames += r.frames;
  await toHub();
  rows.push({ at: `уровень ${lv}`, end: r.end, frames: r.frames, ...(await measure()) });
}
await startScene(g.page, { level: 'endless', seed: 5 });
const r = await playUntilEnd(2400);
frames += r.frames;
await toHub();
rows.push({ at: 'бесконечный', end: r.end, frames: r.frames, ...(await measure()) });

console.table(rows);
console.log(`Сыграно ~${(frames * FRAME_MS / 60000).toFixed(1)} мин игрового времени за ${((Date.now() - t0) / 1000).toFixed(0)} с`);
const warm = rows.slice(1);
const growth = warm[warm.length - 1].heapMB - warm[0].heapMB;
const domSpread = Math.max(...rows.map((x) => x.dom)) - Math.min(...rows.map((x) => x.dom));
console.log(`Рост кучи после прогрева: ${growth.toFixed(2)} МБ · разброс DOM: ${domSpread} узлов`);
console.log('Ошибки в консоли:', g.errors.length ? g.errors : 'нет');
await g.close(); await browser.close(); server.stop();
const ok = !g.errors.length && growth < 1.5 && domSpread < 40;
console.log(ok ? '✓ soak-тест пройден' : '✗ soak-тест: подозрение на утечку или ошибки');
process.exit(ok ? 0 : 1);
