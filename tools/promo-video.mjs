// Видео геймплея для черновика Яндекс Игр (MP4, H.264, 30 кадров/с, до 28 секунд).
//   npm run build && node tools/promo-video.mjs [baseUrl]
// Без baseUrl скрипт сам поднимает локальный сервер для dist/ (tools/serve.mjs).
// Env: LANGS=ru,en,tr  VPS=landscape,portrait  CRF=21
// Выход: promo/video/horizontal-<lang>.mp4 (1920×1080, обязательное поле «Горизонтальное видео»)
//        promo/video/vertical-<lang>.mp4   (1080×1920, необязательное поле «Вертикальное видео»)
// Кадры снимаются в виртуальном времени (tools/vtime.js), поэтому видео плавное
// независимо от скорости машины. Играет бот, всё в кадре — настоящий геймплей.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openGame, startScene, promoSave, sceneSummary } from './promo-lib.mjs';
import { serveDist } from './serve.mjs';
import { ffmpeg } from './ffmpeg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await serveDist(process.argv[2]);
const BASE = server.base;
const LANGS = (process.env.LANGS || 'ru,en,tr').split(',');
const VPS = (process.env.VPS || 'landscape,portrait').split(',');
const CRF = process.env.CRF || '21';
const FPS = 30;
const MAX_SEC = 27.5; // лимит поля — 28 с
const OUT = { landscape: 'horizontal', portrait: 'vertical' };

// Два уровня целиком: интро → выстрелы с прицелом → комбо → победа → окно со звёздами
const SEGMENTS = [
  { level: 22, seed: 2, hold: 2.0 },  // Конфетная страна: 4 выстрела, «Супер!», «Невероятно!»
  { level: 32, seed: 3, hold: 2.6 },  // Морской берег: бомба на поле, серия «Супер!»
];

const outDir = path.join(root, 'promo/video');
fs.mkdirSync(outDir, { recursive: true });
const browser = await launch();

for (const lang of LANGS) {
  for (const vp of VPS) {
    const frames = path.join(root, '.tmp/video', `${vp}-${lang}`);
    fs.rmSync(frames, { recursive: true, force: true });
    fs.mkdirSync(frames, { recursive: true });
    const g = await openGame(browser, { base: BASE, lang, vp, save: promoSave(22) });
    const budget = Math.floor(MAX_SEC * FPS);
    let idx = 0;
    const t0 = Date.now();
    for (let s = 0; s < SEGMENTS.length; s++) {
      const seg = SEGMENTS[s];
      await startScene(g.page, { level: seg.level, seed: seg.seed });
      let popupAt = -1;
      const segStart = idx;
      while (idx < budget) {
        await g.snap(path.join(frames, String(idx).padStart(5, '0') + '.jpg'), 93);
        idx++;
        await g.step(1);
        if (popupAt < 0) {
          const won = await g.page.evaluate(() => { const p = window.__app.popups.top; return !!(p && p.id === 'win'); });
          if (won) popupAt = idx;
        } else if (idx - popupAt >= seg.hold * FPS) break;
      }
      const sum = await sceneSummary(g.page);
      console.log(`  ${lang} ${vp} сегмент ${s + 1}: уровень ${seg.level}, ${((idx - segStart) / FPS).toFixed(1)} с, ${JSON.stringify(sum)}`);
    }
    if (g.errors.length) console.log('  ошибки на странице:', g.errors.slice(0, 5));
    await g.close();
    const file = path.join(outDir, `${OUT[vp]}-${lang}.mp4`);
    ffmpeg(['-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'),
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', CRF, '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-r', String(FPS), file]);
    const mb = (fs.statSync(file).size / 1048576).toFixed(1);
    console.log(`✓ ${path.relative(root, file)} — ${(idx / FPS).toFixed(1)} с, ${mb} МБ (съёмка ${((Date.now() - t0) / 1000).toFixed(0)} с)`);
    fs.rmSync(frames, { recursive: true, force: true });
  }
}
await browser.close();
server.stop();
