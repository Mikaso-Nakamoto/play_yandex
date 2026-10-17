// Общие функции для съёмки промо: запуск игры в headless Chromium с виртуальным временем,
// «режиссёр», который играет ботом с плавным прицеливанием, и снятие кадров.
import fs from 'node:fs';
import { launch } from './browser.mjs';
import { installVirtualTime } from './vtime.js';

export const SAVE_KEY = 'meow_bubbles_save_v1';
export const FRAME_MS = 1000 / 30;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { launch };

export const VIEWPORTS = {
  // 9:16 → 1080×1920 (мобильные скриншоты, портрет)
  portrait: { width: 540, height: 960, dpr: 2, mobile: true },
  // 16:9 → 1920×1080 (десктопные скриншоты и горизонтальное видео)
  landscape: { width: 1280, height: 720, dpr: 1.5, mobile: false },
};

/** Сохранение «продвинутого игрока» для промо: без обучалок, со звёздами и бустерами, звук выключен */
export function promoSave(level = 24, extra = {}) {
  const stars = {}, best = {};
  for (let i = 1; i < level; i++) stars[i] = i % 4 === 0 ? 2 : 3;
  return {
    v: 1, ts: 1, level, stars, best, coins: 1240,
    boosters: { bomb: 3, rainbow: 2, fire: 2 },
    noAds: false, sound: false, music: false, vibro: false,
    daily: { streak: 0, last: '' }, endlessBest: 0,
    tut: { aim: 1, kittens: 1, swap: 1, boosters: 1, bank: 1 },
    stats: { played: level + 5, won: level - 1, kittens: 60, shots: 900 },
    processed: [], ...extra,
  };
}

/**
 * Открывает игру. Возвращает { page, ctx, cdp, step(n), snap(path) }.
 * После загрузки время переводится в ручной режим с зерном seed.
 */
export async function openGame(browser, { base, lang = 'ru', vp = 'portrait', save = promoSave(), seed = 1, query = '' }) {
  const V = typeof vp === 'string' ? VIEWPORTS[vp] : vp;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: V.width, height: V.height, deviceScaleFactor: V.dpr, isMobile: V.mobile, hasTouch: V.mobile });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument(installVirtualTime);
  if (save) {
    await page.evaluateOnNewDocument((key, s) => {
      try { if (!sessionStorage.getItem('promo_save_set')) { localStorage.setItem(key, s); sessionStorage.setItem('promo_save_set', '1'); } } catch (e) { /* ignore */ }
    }, SAVE_KEY, JSON.stringify(save));
  }
  await page.goto(`${base}?lang=${lang}&test=1&fastads=1${query ? '&' + query : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__app && window.__app.screen === 'hub' && window.__vt, { timeout: 20000 });
  await page.evaluate(() => window.__app.assets && window.__app.assets.idle()); // рисованные фоны загружены
  await page.addStyleTag({ content: '#mock-panel{display:none!important}' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await sleep(200);
  await page.evaluate((s) => {
    window.__vt.manual(true, s);
    const app = window.__app;
    app.interstitial = async () => false; // в промо-сценах реклама не нужна
    app.popups.closeAll();
  }, seed);
  const cdp = await page.createCDPSession();
  const api = {
    page, ctx, cdp, errors, V,
    /** n кадров по FRAME_MS */
    step: (n = 1, ms = FRAME_MS) => page.evaluate((n, ms) => { for (let i = 0; i < n; i++) window.__vt.step(ms); }, n, ms),
    /** Снимок экрана (PNG или JPEG по расширению) */
    async snap(path, quality = 92) {
      const jpeg = /\.jpe?g$/i.test(path);
      // clip.scale = DPR — иначе CDP отдаёт картинку в CSS-пикселях
      const clip = { x: 0, y: 0, width: V.width, height: V.height, scale: V.dpr };
      const r = await cdp.send('Page.captureScreenshot', jpeg ? { format: 'jpeg', quality, clip } : { format: 'png', clip });
      fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    },
    close: () => ctx.close(),
  };
  return api;
}

/**
 * Запустить сцену: уровень n (или бесконечный режим при n === 'endless') и «режиссёра»,
 * который играет ботом с плавным прицеливанием. Геймплей детерминирован зерном seed:
 * движок и бот получают собственные генераторы, визуальные эффекты на результат не влияют.
 * Журнал событий движка — window.__dir.events.
 */
export async function startScene(page, { level, seed = 1, plan = null, noise = 0, auto = true }) {
  await page.evaluate(async (level, seed, plan, noise, auto) => {
    const app = window.__app;
    const mulberry32 = (a) => () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    window.__vt.seed(seed * 31 + 7); // стартовое поле бесконечного режима строится через Math.random
    if (level === 'endless') await app.startEndless(); else app.startLevel(level);
    if (app.assets) await app.assets.idle(); // фон мира уровня загружен до первого кадра
    const e = app.engine;
    e.random = mulberry32(seed * 7919 + 17);
    e.cur = e._randColor(); e.next = e._randColor();
    const rnd = mulberry32(seed * 104729 + 3);
    const D = window.__dir = {
      opts: { auto, noise, aimMin: 520, aimMax: 760, hold: 170, think: 230, plan },
      phase: 'idle', t: 0, events: [], shots: 0, lastAngle: Math.PI / 2, rnd,
    };
    if (!app.__dirWrapped) {
      app.__dirWrapped = true;
      const orig = app.onEngine.bind(app);
      app.onEngine = (tp, d) => {
        window.__dir.events.push({ type: tp, t: window.__vt.now(), n: d && d.list ? d.list.length : 0, level: d && d.level });
        return orig(tp, d);
      };
    }
    window.__vt.clearHooks();
    window.__vt.onStep((ms) => {
      const e = app.engine;
      if (!D.opts.auto || !e || app.screen !== 'game' || app.popups.isOpen) return;
      if (D.phase === 'idle') {
        if (!e.canShoot) { D.t = 0; return; }
        D.t += ms;
        if (D.t < D.opts.think) return;
        const [lx, ly] = e.launcher();
        let ch = D.opts.plan && D.opts.plan[D.shots];
        if (ch && ch.booster) app.onBoosterTap(ch.booster);
        if (!ch || ch.angle === undefined) {
          const pick = window.__bot.chooseShot(e.board, e.cur, e.next, e.goal, D.rnd, D.opts.noise, [lx, ly]);
          ch = Object.assign({}, ch || {}, { angle: pick.angle, swap: pick.swap && !e.special });
        }
        if (ch.swap) e.swap();
        D.target = ch.angle;
        D.from = D.lastAngle;
        if (Math.abs(D.target - D.from) < 0.12) D.from = D.target + (D.target > Math.PI / 2 ? -0.28 : 0.28);
        D.dur = D.opts.aimMin + D.rnd() * (D.opts.aimMax - D.opts.aimMin);
        D.phase = 'aim'; D.t = 0;
      }
      if (D.phase === 'aim') {
        if (e.state !== 'aim') { D.phase = 'idle'; D.t = 0; return; }
        D.t += ms;
        const k = Math.min(1, D.t / D.dur);
        const s = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        e.aim.active = true; e.aim.valid = true;
        e.aim.angle = D.from + (D.target - D.from) * s;
        if (D.t >= D.dur + D.opts.hold) {
          if (e.shoot(D.target)) { D.shots++; D.lastAngle = D.target; }
          D.phase = 'idle'; D.t = 0;
        }
      }
    });
  }, level, seed, plan, noise, auto);
}

/** Сводка по журналу событий сцены */
export function sceneSummary(page) {
  return page.evaluate(() => {
    const ev = window.__dir.events;
    const c = (t) => ev.filter((x) => x.type === t).length;
    const pops = ev.filter((x) => x.type === 'pop').map((x) => x.n);
    const t0 = ev.length ? ev[0].t : 0;
    const at = (t) => { const x = ev.find((y) => y.type === t); return x ? +((x.t - t0) / 1000).toFixed(1) : null; };
    return { shots: c('shoot'), praise: ev.filter((x) => x.type === 'praise').map((x) => x.level).join(''), kittens: c('kittens'), explode: c('explode'), maxPop: Math.max(0, ...pops), goalAt: at('goalReached'), popup: window.__app.popups.top && window.__app.popups.top.id };
  });
}

/** Шагать кадрами, пока predicate (выполняется в странице) не станет истинным; возвращает число кадров или -1 */
export async function stepUntil(page, predicateSrc, maxFrames = 900, chunk = 1) {
  return page.evaluate((src, maxFrames, chunk, ms) => {
    const fn = new Function('app', 'e', 'dir', 'vt', 'return (' + src + ');');
    for (let i = 0; i < maxFrames; i += chunk) {
      const app = window.__app;
      if (fn(app, app.engine, window.__dir, window.__vt)) return i;
      for (let j = 0; j < chunk; j++) window.__vt.step(ms);
    }
    return -1;
  }, predicateSrc, maxFrames, chunk, FRAME_MS);
}
