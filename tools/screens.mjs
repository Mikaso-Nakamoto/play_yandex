// Скриншоты всех экранов на разных разрешениях: node tools/screens.mjs [outdir] [baseUrl]
import fs from 'node:fs';
import { launch } from './browser.mjs';

const out = process.argv[2] || '/tmp/screens';
const BASE = process.argv[3] || 'http://localhost:8081/';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();

const VPS = {
  phone: { width: 390, height: 844, dpr: 2 },
  small: { width: 320, height: 568, dpr: 2 },
  land: { width: 844, height: 390, dpr: 2 },
  tablet: { width: 768, height: 1024, dpr: 1 },
  desk: { width: 1280, height: 720, dpr: 1 },
  fhd: { width: 1920, height: 1080, dpr: 1 },
};

async function page(vpName, query = '') {
  const vp = VPS[vpName];
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const mobile = vp.width < vp.height || vpName === 'land';
  await p.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, isMobile: mobile, hasTouch: mobile });
  p._errors = [];
  p.on('pageerror', (e) => p._errors.push(e.message));
  await p.goto(BASE + '?test=1&fastads=1' + (query ? '&' + query : ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 15000 });
  await p.addStyleTag({ content: '#mock-panel{display:none!important}' });
  p._ctx = ctx;
  return p;
}

async function snap(p, name) {
  await sleep(450);
  await p.screenshot({ path: `${out}/${name}.png` });
}

const scenarios = {
  hub: async (vp) => { const p = await page(vp); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('meow_bubbles_save_v1')); s.level = 9; for (let i = 1; i < 9; i++) s.stars[i] = 1 + (i % 3); localStorage.setItem('meow_bubbles_save_v1', JSON.stringify(s)); }); await p.reload(); await p.waitForFunction(() => window.__app && window.__app.screen === 'hub'); await p.addStyleTag({ content: '#mock-panel{display:none!important}' }); await snap(p, `${vp}-hub`); return p; },
  level: async (vp) => {
    const p = await page(vp);
    await p.evaluate(() => window.__app.startLevel(14));
    await p.waitForFunction(() => window.__app.engine.state === 'aim', { timeout: 8000 });
    await p.evaluate(() => { const e = window.__app.engine; e.aim.active = true; e.aim.valid = true; e.aim.angle = Math.PI / 2 + 0.38; });
    await snap(p, `${vp}-level`);
    return p;
  },
  win: async (vp) => {
    const p = await page(vp);
    await p.evaluate(() => window.__app.startLevel(2));
    await p.waitForFunction(() => window.__app.engine.state === 'aim', { timeout: 8000 });
    await p.evaluate(() => { const e = window.__app.engine; e.kittensFreed = e.kittensTotal; e.score = 2300; e._startWinSequence(); });
    await p.waitForFunction(() => window.__app.popups.top && window.__app.popups.top.id === 'win', { timeout: 15000 });
    await sleep(1200);
    await snap(p, `${vp}-win`);
    return p;
  },
  out: async (vp) => {
    const p = await page(vp);
    await p.evaluate(() => window.__app.startLevel(12));
    await p.waitForFunction(() => window.__app.engine.state === 'aim', { timeout: 8000 });
    await p.evaluate(() => { const e = window.__app.engine; e.shotsLeft = 0; e.state = 'settle'; e.timer = 0; });
    await p.waitForFunction(() => window.__app.popups.top && window.__app.popups.top.id === 'out', { timeout: 8000 });
    await snap(p, `${vp}-out`);
    return p;
  },
  shop: async (vp) => { const p = await page(vp); await p.evaluate(() => window.__app.openShop()); await snap(p, `${vp}-shop`); return p; },
  daily: async (vp) => { const p = await page(vp); await p.evaluate(() => window.__app.openDaily()); await snap(p, `${vp}-daily`); return p; },
  settings: async (vp) => { const p = await page(vp); await p.evaluate(() => window.__app.openSettings()); await snap(p, `${vp}-settings`); return p; },
  howto: async (vp) => { const p = await page(vp); await p.evaluate(() => window.__app.openHowTo()); await snap(p, `${vp}-howto`); return p; },
  pause: async (vp) => {
    const p = await page(vp);
    await p.evaluate(() => window.__app.startLevel(7));
    await p.waitForFunction(() => window.__app.engine.state === 'aim', { timeout: 8000 });
    await p.evaluate(() => window.__app.openPause());
    await snap(p, `${vp}-pause`);
    return p;
  },
  endless: async (vp) => {
    const p = await page(vp);
    await p.evaluate(() => window.__app.startEndless());
    await p.waitForFunction(() => window.__app.engine && window.__app.engine.state === 'aim', { timeout: 8000 });
    await p.evaluate(() => { const e = window.__app.engine; e.score = 3450; for (let i = 0; i < 3; i++) e.board.pushRowTop((c) => e._endlessCell(c)); e.aim.active = true; e.aim.valid = true; e.aim.angle = Math.PI / 2 - 0.3; window.__app.hud.update(); });
    await snap(p, `${vp}-endless`);
    return p;
  },
  booster: async (vp) => {
    const p = await page(vp);
    await p.evaluate(() => window.__app.startLevel(9));
    await p.waitForFunction(() => window.__app.engine.state === 'aim', { timeout: 8000 });
    await p.evaluate(() => window.__app.openBoosterOffer('rainbow'));
    await snap(p, `${vp}-booster`);
    return p;
  },
  lb: async (vp) => { const p = await page(vp, 'auth=1'); await p.evaluate(() => { localStorage.setItem('mock_lb_endless', '4321'); window.__app.openLeaderboard(); }); await sleep(500); await snap(p, `${vp}-lb`); return p; },
  tut: async (vp) => { const p = await page(vp); await p.evaluate(() => window.__app.startLevel(1)); await p.waitForFunction(() => window.__app.engine.state === 'aim', { timeout: 8000 }); await sleep(800); await snap(p, `${vp}-tut`); return p; },
};

const vpList = (process.env.VPS || 'phone').split(',');
for (const vp of vpList) {
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && !only.includes(name)) continue;
    try {
      const p = await fn(vp);
      if (p._errors.length) console.log('  errors in', vp, name, p._errors);
      await p._ctx.close();
      console.log('  ✓', vp, name);
    } catch (e) { console.log('  ✗', vp, name, e.message); }
  }
}
await browser.close();
