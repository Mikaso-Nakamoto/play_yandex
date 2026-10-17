// Автотест в браузере: бот играет уровни через настоящие касания по canvas.
// node tools/play-test.mjs [levels=2] [w=390] [h=844] [outdir=/tmp/pt]
import fs from 'node:fs';
import { launch } from './browser.mjs';

const levels = Number(process.argv[2] || 2);
const W = Number(process.argv[3] || 390), H = Number(process.argv[4] || 844);
const outdir = process.argv[5] || '/tmp/pt';
const base = process.env.URL || 'http://localhost:8080/';
fs.mkdirSync(outdir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const stamp = (m) => { if (process.env.VERBOSE) console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', m); };

const browser = await launch();
const page = await browser.newPage();
const mobile = W < H;
await page.setViewport({ width: W, height: H, deviceScaleFactor: Number(process.env.DPR || 1), isMobile: mobile, hasTouch: mobile });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(base + '?lang=' + (process.env.LANG_Q || 'ru') + '&test=1&fastads=1' + (process.env.EXTRA || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 15000 });
await sleep(700);
stamp('hub ready');
await page.screenshot({ path: `${outdir}/01-hub.png` });
stamp('hub shot');

async function tap(x, y) {
  if (mobile) await page.touchscreen.tap(x, y);
  else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); }
}

async function clickSel(sel) {
  const el = await page.$(sel);
  if (!el) throw new Error('no element ' + sel);
  const box = await el.boundingBox();
  await tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function clickText(text) {
  const ok = await page.evaluate((txt) => {
    const btns = [...document.querySelectorAll('#popups button, #hub button')].filter((b) => b.offsetParent && b.textContent.includes(txt));
    if (!btns.length) return null;
    const r = btns[btns.length - 1].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, text);
  if (!ok) throw new Error('no button with text ' + text);
  await tap(ok[0], ok[1]);
}

async function playLevel(idx) {
  // ждём готовности
  await page.waitForFunction(() => window.__app.engine && window.__app.engine.state === 'aim', { timeout: 15000 });
  await sleep(300);
  stamp('level ' + idx + ' aim');
  await page.screenshot({ path: `${outdir}/${idx}-a-start.png` });
  stamp('level shot');
  let shots = 0, shotShot = false;
  for (let guard = 0; guard < 400; guard++) {
    const st = await page.evaluate(() => {
      const a = window.__app, e = a.engine;
      if (!e) return { state: 'none' };
      return { state: e.state, can: e.canShoot, popup: a.popups.isOpen, popupId: a.popups.top && a.popups.top.id };
    });
    if (st.popup) {
      if (st.popupId === 'out') { await clickText('+5'); await sleep(2200); continue; }
      return st.popupId;
    }
    if (st.state === 'won' || st.state === 'win-seq') { await sleep(400); continue; }
    if (!st.can) { await sleep(60); continue; }
    const target = await page.evaluate(() => {
      const a = window.__app, e = a.engine, L = a.L;
      const [lx, ly] = e.launcher();
      const ch = window.__bot.chooseShot(e.board, e.cur, e.next, e.goal, Math.random, 0.15, [lx, ly]);
      if (ch.swap) e.swap();
      const tx = lx + Math.cos(ch.angle) * 160, ty = ly - Math.sin(ch.angle) * 160;
      return [L.fx + tx * L.scale, L.fy + (ty - e.camY) * L.scale, ch.swap];
    });
    if (target[2]) await sleep(200);
    if (mobile) {
      await page.touchscreen.touchStart(target[0], target[1] + 30);
      await page.touchscreen.touchMove(target[0], target[1]);
      if (!shotShot && shots === 2) { await sleep(50); await page.screenshot({ path: `${outdir}/${idx}-b-aim.png` }); shotShot = true; }
      await page.touchscreen.touchEnd();
    } else {
      await page.mouse.move(target[0], target[1]);
      if (!shotShot && shots === 2) { await sleep(50); await page.screenshot({ path: `${outdir}/${idx}-b-aim.png` }); shotShot = true; }
      await page.mouse.down(); await page.mouse.up();
    }
    shots++;
    stamp('shot ' + shots);
    if (shots === 4) { await sleep(120); await page.screenshot({ path: `${outdir}/${idx}-c-pop.png` }); }
    await sleep(80);
  }
  return 'timeout';
}

const results = [];
stamp('start');
await clickSel('.play-btn');
for (let i = 1; i <= levels; i++) {
  const res = await playLevel(i);
  await sleep(1300);
  await page.screenshot({ path: `${outdir}/${i}-d-end.png` });
  results.push(res);
  if (res === 'win' && i < levels) { await clickText(process.env.LANG_Q === 'en' ? 'Next' : 'Далее'); await sleep(1500); }
  else break;
}
const log = await page.evaluate(() => (window.__mockLog || []).map((x) => x.type));
const gp = log.filter((x) => x.startsWith('GameplayAPI'));
console.log('results:', results.join(','));
console.log('gameplay events:', gp.join(' '));
console.log('dupes:', log.filter((x) => x.includes('DUPLICATE')).length, 'setData calls:', log.filter((x) => x === 'player:setData').length);
console.log('ads:', log.filter((x) => x.startsWith('fullscreen') || x.startsWith('rewarded')).join(' '));
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
