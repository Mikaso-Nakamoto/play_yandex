// Воспроизведение замечания аудита (docs/yandex-audit.md, М1):
// SDK открывает полноэкранную рекламу позже, чем через 6 с после запроса (медленная сеть).
// Ожидаемое поведение: пока реклама на экране, игра на паузе (app.pause содержит причину 'ad').
//   node tools/repro-late-ad.mjs [baseUrl]   (без baseUrl — сам поднимет сервер для dist/)
// Код выхода 1, если во время рекламы игра НЕ на паузе (замечание воспроизводится).
import { launch } from './browser.mjs';
import { serveDist } from './serve.mjs';

const server = await serveDist(process.argv[2]);
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 720 });
await page.goto(server.base + '?lang=ru&test=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 20000 });
await page.evaluate(async () => {
  const y = await window.YaGames.init(); // мок-SDK возвращает тот же объект, что получила игра
  window.__adLog = [];
  y.adv.showFullscreenAdv = (o) => {
    setTimeout(() => { window.__adLog.push('onOpen@7s'); o.callbacks.onOpen && o.callbacks.onOpen(); }, 7000);
    setTimeout(() => { window.__adLog.push('onClose@10s'); o.callbacks.onClose && o.callbacks.onClose(true); }, 10000);
  };
  const app = window.__app;
  app.popups.closeAll();
  app.startLevel(5);
  app.lastAd = -1e9; // снять ограничение «не чаще раза в 65 с» для эксперимента
  window.__t0 = performance.now();
  app.interstitial(true).then((r) => window.__adLog.push('resolved:' + r));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sample = async (label) => {
  const s = await page.evaluate(() => ({ t: +((performance.now() - window.__t0) / 1000).toFixed(1), pause: [...window.__app.pause], log: window.__adLog.slice() }));
  console.log(label.padEnd(30), JSON.stringify(s));
  return s;
};
await wait(1000); await sample('1 с: реклама запрошена');
await wait(5600); await sample('6.6 с: сработал таймаут');
await wait(1200); const during = await sample('7.8 с: РЕКЛАМА НА ЭКРАНЕ');
await wait(3000); await sample('10.8 с: реклама закрыта');
await browser.close(); server.stop();
const paused = during.pause.includes('ad');
console.log(paused ? '✓ во время рекламы игра на паузе' : '✗ во время рекламы игра и звук НЕ на паузе — см. аудит, М1');
process.exit(paused ? 0 : 1);
