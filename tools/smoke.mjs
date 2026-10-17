// Быстрый смоук-тест в браузере: загрузка, ошибки консоли, скриншот.
import { launch } from './browser.mjs';
const url = process.argv[2] || 'http://localhost:8080/?lang=ru&test=1';
const out = process.argv[3] || '/tmp/shot.png';
const w = Number(process.argv[4] || 390), hgt = Number(process.argv[5] || 844);
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: w, height: hgt, deviceScaleFactor: 2, isMobile: w < hgt, hasTouch: w < hgt });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: out });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
const log = await page.evaluate(() => (window.__mockLog || []).map((x) => x.type).join(', '));
console.log('mock log:', log);
await browser.close();
