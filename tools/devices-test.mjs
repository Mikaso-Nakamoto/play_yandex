// Вёрстка и управление на телефонах разных размеров — от iPhone SE до Galaxy S25 Ultra.
// На каждом устройстве:
//   • все экраны и окна → автоматические проверки: элемент за краем экрана (или в вырезе), текст обрезан
//     контейнером / вылез за кнопку / съеден многоточием, наложение элементов, кнопка перекрыта другим
//     элементом (elementFromPoint в 5 точках), размер кнопок и шрифта; на поле — пушка и следующий шарик
//     не закрыты интерфейсом, панель уровня не залезает на поле, поле открыто для касаний;
//   • настоящие касания (CDP): свайп карты, кнопки карты и окон, прокрутка магазина, «Играть», прицел за
//     пальцем, выстрел, смена шарика, бустеры, пауза;
//   • скриншоты и сводные листы по экранам для проверки глазами (.tmp/devices/).
//   node tools/devices-test.mjs [baseUrl]   (без url — поднимает сервер для dist/)
//   npm run test:devices                     (сборка + проверка)
//   ONLY=se1,s25 node tools/devices-test.mjs — только выбранные устройства;  SHOTS=0 — без скриншотов
//   LANG_UI=tr|en — язык интерфейса (турецкие тексты длиннее русских — проверять узкие экраны)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
import { serveDist } from './serve.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
let BASE = args.find((a) => !a.startsWith('--'));
let srv = null;
if (!BASE) { srv = await serveDist(); BASE = srv.base; }
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SHOTS = process.env.SHOTS !== '0';
const LANG = process.env.LANG_UI || process.env.LANG_GAME || (/^(ru|en|tr)$/.test(process.env.LANG || '') ? process.env.LANG : '');
const OUT = path.resolve(process.env.OUT || ('.tmp/devices' + (LANG ? '-' + LANG : '')));

// Размеры — CSS-пиксели окна браузера (то, что видит игра). «+ баннер»: минус панели браузера и
// sticky-баннер Яндекса (по правилам РСЯ — от 50 px до 15% высоты экрана; берём ~50–60 px).
export const DEVICES = [
  { id: 'se1', name: 'iPhone SE (1-е пок.)', w: 320, h: 568, dpr: 2 },
  { id: 'se1-bar', name: 'iPhone SE 1 в Safari + баннер', w: 320, h: 410, dpr: 2 },
  { id: 'se2', name: 'iPhone SE (2–3-е пок.)', w: 375, h: 667, dpr: 2 },
  { id: 'se2-bar', name: 'iPhone SE 2/3 в Safari + баннер', w: 375, h: 500, dpr: 2 },
  { id: 'and640', name: 'Android 360×640 (бюджетный)', w: 360, h: 640, dpr: 3 },
  { id: 'fold', name: 'Galaxy Z Fold, внешний экран', w: 344, h: 882, dpr: 2.625 },
  { id: 'mini', name: 'iPhone 13 mini', w: 375, h: 812, dpr: 3 },
  { id: 's25', name: 'Galaxy S25', w: 360, h: 780, dpr: 3 },
  { id: 's25-bar', name: 'Galaxy S25 в Chrome + баннер', w: 360, h: 610, dpr: 3 },
  { id: 'xperia', name: 'Sony Xperia 10 (21:9)', w: 360, h: 840, dpr: 3 },
  { id: 'ip15', name: 'iPhone 15', w: 393, h: 852, dpr: 3 },
  { id: 'redmi', name: 'Redmi Note', w: 393, h: 873, dpr: 2.75 },
  { id: 'a54', name: 'Galaxy A54 / S25 Ultra (FHD+)', w: 384, h: 832, dpr: 2.8125 },
  { id: 'pixel', name: 'Pixel 8', w: 412, h: 915, dpr: 2.625 },
  { id: 's25u', name: 'Galaxy S25 Ultra (QHD+)', w: 412, h: 891, dpr: 3.5 },
  { id: 'promax', name: 'iPhone 16 Pro Max', w: 440, h: 956, dpr: 3 },
  { id: 's25u-zoom', name: 'S25 Ultra, мелкий масштаб экрана', w: 480, h: 1040, dpr: 3 },
  { id: 'ip15-notch', name: 'iPhone 15 во весь экран (вырез)', w: 393, h: 852, dpr: 3, insets: { top: 59, bottom: 34 } },
];

const STATES = ['hub', 'settings', 'shop', 'daily', 'howto', 'game', 'booster', 'pause', 'out', 'win', 'endless', 'lb', 'tut'];
const STATE_NAMES = {
  hub: 'карта', settings: 'настройки', shop: 'магазин', daily: 'подарок', howto: 'как играть', game: 'уровень',
  booster: 'окно бустера', pause: 'пауза', out: 'ходы кончились', win: 'победа', endless: 'бесконечный', lb: 'рекорды', tut: 'обучение',
};

// ---------- проверка вёрстки в странице ----------
function pageAudit(o) {
  const W = innerWidth, H = innerHeight;
  const sTop = o.safeTop || 0, sBot = H - (o.safeBottom || 0);
  const res = { issues: [], warns: [], minTap: null, minFont: null };
  const desc = (el) => {
    if (!el || el.nodeType !== 1) return '—';
    let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
    const c = [...el.classList].slice(0, 2);
    if (c.length) s += '.' + c.join('.');
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (t) s += ' «' + (t.length > 24 ? t.slice(0, 23) + '…' : t) + '»';
    return s;
  };
  const shown = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const shrink = (a, d) => ({ l: a.l + d, t: a.t + d, r: a.r - d, b: a.b - d });
  const textBox = (el) => {
    let r = null;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const cr of rg.getClientRects()) {
        if (cr.width < 0.5 || cr.height < 0.5) continue;
        r = r ? { l: Math.min(r.l, cr.left), t: Math.min(r.t, cr.top), r: Math.max(r.r, cr.right), b: Math.max(r.b, cr.bottom) }
          : { l: cr.left, t: cr.top, r: cr.right, b: cr.bottom };
      }
    }
    return r;
  };
  const px = (v) => Math.round(v * 10) / 10;
  const roots = o.roots.map((s) => document.querySelector(s)).filter((e) => e && shown(e));
  if (!roots.length) { res.issues.push('экран не найден: ' + o.roots.join(', ')); return res; }
  const all = [];
  for (const r of roots) all.push(r, ...r.querySelectorAll('*'));
  const skip = (el) => !!(o.skip && el.closest(o.skip));
  const live = all.filter((el) => !skip(el) && shown(el));
  // кликабельные: <button> и cursor:pointer, только внешние (дети кнопки — её часть)
  const cand = new Set(live.filter((el) => el.tagName === 'BUTTON' || getComputedStyle(el).cursor === 'pointer'));
  const clickable = [...cand].filter((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (cand.has(p)) return false; return true; });
  const scroller = (el) => el.closest('.card-body');
  const scrollable = (sc) => { const c = sc.firstElementChild; return !!c && c.offsetHeight > sc.clientHeight + 1; };
  // за краем экрана/в вырезе; вертикальный выход внутри прокручиваемого окна допустим
  const outside = (b, el) => {
    const sc = scroller(el);
    if (sc) {
      const s = box(sc.getBoundingClientRect());
      const horiz = b.l < s.l - 1 || b.r > s.r + 1;
      const vert = b.t < s.t - 1 || b.b > s.b + 1;
      if (horiz) return 'выходит за окно по ширине';
      if (vert && !scrollable(sc)) return 'обрезан краем окна (прокрутки нет)';
      if (vert) return null;
    }
    const parts = [];
    if (b.l < -1) parts.push(`слева на ${px(-b.l)} px`);
    if (b.r > W + 1) parts.push(`справа на ${px(b.r - W)} px`);
    if (b.t < sTop - 1) parts.push(sTop ? `в вырезе сверху на ${px(sTop - b.t)} px` : `сверху на ${px(-b.t)} px`);
    if (b.b > sBot + 1) parts.push(sBot < H ? `в зоне жеста снизу на ${px(b.b - sBot)} px` : `снизу на ${px(b.b - H)} px`);
    return parts.length ? 'за краем экрана: ' + parts.join(', ') : null;
  };
  const atoms = [];
  // кнопки
  for (const el of clickable) {
    const b = box(el.getBoundingClientRect());
    const w = b.r - b.l, hh = b.b - b.t;
    const m = Math.min(w, hh);
    if (!res.minTap || m < res.minTap.v) res.minTap = { v: px(m), el: desc(el) };
    if (m < 32) res.issues.push(`кнопка мелкая для пальца: ${px(w)}×${px(hh)} px — ${desc(el)}`);
    else if (m < 40) res.warns.push(`кнопка ${px(w)}×${px(hh)} px — ${desc(el)}`);
    const out = outside(b, el);
    if (out) res.issues.push(`${out} — ${desc(el)}`);
    // перекрытие: центр и 4 точки внутри; в прокручиваемом окне — только видимая часть кнопки
    const pts = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];
    let bad = 0, cover = null, centerBad = false;
    let vb = b;
    const scr = scroller(el);
    if (scr) {
      const s = box(scr.getBoundingClientRect());
      vb = { l: Math.max(b.l, s.l), t: Math.max(b.t, s.t), r: Math.min(b.r, s.r), b: Math.min(b.b, s.b) };
      if (vb.b - vb.t < hh * 0.4) vb = null; // почти уехала за край списка — до неё докручивают
    }
    if (vb) pts.forEach(([fx, fy], i) => {
      const x = vb.l + (vb.r - vb.l) * fx, y = vb.t + (vb.b - vb.t) * fy;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) { bad++; cover = cover || hit; if (i === 0) centerBad = true; }
    });
    if (centerBad) res.issues.push(`кнопка перекрыта (${desc(cover)}) — ${desc(el)}`);
    else if (bad >= 2) res.warns.push(`кнопка частично перекрыта (${desc(cover)}) — ${desc(el)}`);
    atoms.push({ el, b, kind: 'кнопка' });
  }
  // тексты
  const boxSel = 'button, .pill, .btn, .round, .shop-item, .daily-cell, .lb-row, .toggle-row, .card-title, .world-banner, .badge, #tip';
  for (const el of live) {
    const tb = textBox(el);
    if (!tb) continue;
    const cs = getComputedStyle(el);
    const fsz = parseFloat(cs.fontSize);
    if (!res.minFont || fsz < res.minFont.v) res.minFont = { v: px(fsz), el: desc(el) };
    if (fsz < 10) res.issues.push(`мелкий текст ${px(fsz)} px — ${desc(el)}`);
    else if (fsz < 11) res.warns.push(`текст ${px(fsz)} px — ${desc(el)}`);
    const out = outside(tb, el);
    if (out) res.issues.push(`текст ${out} — ${desc(el)}`);
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
      (o.ellipsisOk && el.closest(o.ellipsisOk) ? res.warns : res.issues).push(`текст обрезан многоточием — ${desc(el)}`);
    }
    // обрезан предком с overflow (кроме прокручиваемого окна по вертикали)
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === 'visible' && acs.overflowY === 'visible') continue;
      if (a === el && cs.textOverflow === 'ellipsis') continue;
      const ab = box(a.getBoundingClientRect());
      const sc = a.matches('.card-body');
      const horiz = tb.l < ab.l - 1 || tb.r > ab.r + 1;
      const vert = tb.t < ab.t - 1 || tb.b > ab.b + 1;
      if (horiz || (vert && !(sc && scrollable(a)))) { res.issues.push(`текст обрезан контейнером ${desc(a)} — ${desc(el)}`); break; }
      if (sc) break; // текст в прокручиваемом окне: до него можно докрутить, внешние контейнеры не в счёт
    }
    // текст вылез за свою кнопку/плашку
    const own = el.closest(boxSel);
    if (own) {
      const ob = box(own.getBoundingClientRect());
      if (tb.l < ob.l - 1.5 || tb.r > ob.r + 1.5 || tb.t < ob.t - 1.5 || tb.b > ob.b + 1.5) {
        res.issues.push(`текст вылезает за ${desc(own)} на ${px(Math.max(ob.l - tb.l, tb.r - ob.r, ob.t - tb.t, tb.b - ob.b))} px`);
      }
    }
    // для наложений берём «чернильную» часть строки: без пустых полей шрифта над и под буквами
    const ink = { l: tb.l, r: tb.r, t: tb.t + fsz * 0.16, b: tb.b - fsz * 0.12 };
    if (![...cand].some((c) => c.contains(el))) atoms.push({ el, b: ink, kind: 'текст' });
  }
  // наложения (кроме родитель/потомок)
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const A = atoms[i], B = atoms[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const s = inter(shrink(A.b, 1), shrink(B.b, 1));
      if (s > 4) res.issues.push(`наложение: ${desc(A.el)} ↔ ${desc(B.el)} (${px(s)} px²)`);
    }
  }
  // поле: пушка, следующий шарик, свободное для касаний поле, панель уровня не залезает на поле
  if (o.field) {
    const a = window.__app, e = a.engine, L = a.L;
    const cv = document.getElementById('cv');
    const [lx, ly] = e.launcher();
    const sx = L.fx + lx * L.scale, sy = L.fy + (ly - e.camY) * L.scale;
    const chk = (x, y, what) => {
      const hit = document.elementFromPoint(x, y);
      if (hit !== cv) res.issues.push(`${what} закрыт(а) элементом ${desc(hit)}`);
    };
    chk(sx, sy, 'пушка');
    chk(sx - 64 * L.scale, sy + 12 * L.scale, 'следующий шарик');
    if (sy + 20 * L.scale > sBot + 1) res.issues.push(`пушка ниже безопасной зоны на ${px(sy + 20 * L.scale - sBot)} px`);
    let blocked = 0, total = 0;
    const covers = new Set();
    const y0 = L.fy + 6, y1 = sy - 44 * L.scale;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 9; j++) {
        const x = L.fx + 12 + (L.fw - 24) * i / 6, y = y0 + (y1 - y0) * j / 8;
        total++;
        const hit = document.elementFromPoint(x, y);
        if (hit !== cv) { blocked++; covers.add(desc(hit)); }
      }
    }
    if (blocked) res.issues.push(`поле закрыто для касаний в ${blocked} из ${total} точек: ${[...covers].slice(0, 3).join('; ')}`);
    const hud = document.getElementById('hud');
    let over = 0;
    for (const c of hud.querySelectorAll('*')) { if (shown(c)) over = Math.max(over, c.getBoundingClientRect().bottom - L.fy); }
    if (over > 1) res.issues.push(`панель уровня залезает на поле на ${px(over)} px`);
    // бустеры не наезжают на пушку
    for (const btn of document.querySelectorAll('#boosters .boost')) {
      if (!shown(btn)) continue;
      const r = btn.getBoundingClientRect();
      const dx = Math.max(r.left - sx, 0, sx - r.right), dy = Math.max(r.top - sy, 0, sy - r.bottom);
      if (Math.hypot(dx, dy) < 22 * L.scale) res.issues.push(`бустер наезжает на пушку — ${desc(btn)}`);
    }
  }
  return res;
}

// ---------- окружение ----------
const browser = await launch();
fs.mkdirSync(OUT, { recursive: true });
const report = [];
const SAVE = { level: 40, coins: 1250, boosters: { bomb: 2, rainbow: 0, fire: 1 } };

async function openPage(dev, { save = SAVE, query = '' } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, isMobile: true, hasTouch: true });
  const cdp = await page.target().createCDPSession();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (dev.insets) {
    const { top = 0, bottom = 0 } = dev.insets;
    try {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, topMax: top, bottom, bottomMax: bottom, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
    } catch (e) { dev.insetsUnsupported = e.message; }
  }
  if (save) {
    await page.evaluateOnNewDocument((s) => {
      if (localStorage.getItem('__dev_seeded')) return;
      const d = new Date();
      const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; // подарок уже получен — окно не всплывает само
      localStorage.setItem('meow_bubbles_save_v1', JSON.stringify(Object.assign({ daily: { streak: 1, last: today } }, s)));
      localStorage.setItem('__dev_seeded', '1');
    }, save);
  }
  await page.goto(BASE + '?test=1&fastads=1' + (LANG ? '&lang=' + LANG : '') + (query ? '&' + query : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 20000 });
  await page.addStyleTag({ content: '#mock-panel{display:none!important}' });
  await page.evaluate(async () => { await document.fonts.ready; if (window.__app.assets && window.__app.assets.idle) await window.__app.assets.idle(); });
  await sleep(700); // загрузочный экран растворяется
  return { ctx, page, cdp, errors };
}

const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: pts.map(([x, y, id = 1]) => ({ x, y, id, radiusX: 6, radiusY: 6, force: 1 })),
});
async function tap(cdp, p) { await touch(cdp, 'touchStart', [[p.x, p.y]]); await sleep(40); await touch(cdp, 'touchEnd', []); }
const centerOf = (page, sel) => page.evaluate((s) => {
  const el = typeof s === 'string' ? document.querySelector(s) : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);
const topPopup = (page) => page.evaluate(() => { const t = window.__app.popups.top; return t ? t.id || 'popup' : null; });
async function waitPopup(page, id, ms = 4000) {
  try { await page.waitForFunction((i) => { const t = window.__app.popups.top; return t && (!i || t.id === i); }, { timeout: ms }, id); await sleep(420); return true; } catch { return false; }
}
async function waitNoPopup(page, ms = 3000) {
  try { await page.waitForFunction(() => !window.__app.popups.isOpen, { timeout: ms }); await sleep(250); return true; } catch { return false; }
}
const waitAim = (page, ms = 10000) => page.waitForFunction(() => { const e = window.__app.engine; return e && e.state === 'aim' && e.canShoot; }, { timeout: ms, polling: 50 });

async function shot(page, dev, state) {
  if (!SHOTS) return;
  const dir = path.join(OUT, dev.id);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, state + '.jpg'), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: dev.w, height: dev.h, scale: 1 / dev.dpr } });
}

async function audit(page, dev, rec, state, opts) {
  const res = await page.evaluate(pageAudit, { safeTop: dev.insetsUnsupported ? 0 : dev.insets?.top || 0, safeBottom: dev.insetsUnsupported ? 0 : dev.insets?.bottom || 0, ...opts });
  rec.states[state] = res;
  await shot(page, dev, state);
}

function step(rec, name, ok, info = '') { rec.steps.push({ name, ok, info }); }

// ---------- сценарий на устройстве ----------
async function runDevice(dev) {
  const rec = { dev, states: {}, steps: [], errors: [] };
  const popupOpts = { roots: ['#popups .overlay:last-child'], ellipsisOk: '.lb-row .nm' };
  // A. карта, окна карты, уровень, окна уровня
  {
    const { ctx, page, cdp, errors } = await openPage(dev);
    await audit(page, dev, rec, 'hub', { roots: ['#hub'], skip: '#map' });

    // свайп карты
    const band = await page.evaluate(() => {
      const t = document.querySelector('#hub-top').getBoundingClientRect(), b = document.querySelector('#hub-bottom').getBoundingClientRect();
      return { top: t.bottom, bottom: b.top, y: window.__app.hub.scroller.y };
    });
    const free = band.bottom - band.top;
    const sy0 = band.top + free * 0.45;
    const dy = (band.y < -150 ? 1 : -1) * Math.round(Math.min(120, Math.max(60, free * 0.6)));
    await touch(cdp, 'touchStart', [[dev.w * 0.5, sy0]]);
    for (let i = 1; i <= 8; i++) { await touch(cdp, 'touchMove', [[dev.w * 0.5, sy0 + dy * i / 8]]); await sleep(16); }
    const yMid = await page.evaluate(() => window.__app.hub.scroller.y);
    await sleep(200);
    await touch(cdp, 'touchEnd', []);
    await sleep(500);
    const moved = yMid - band.y;
    step(rec, 'свайп карты', Math.abs(moved - dy) < 3 && !(await topPopup(page)), `${Math.round(moved)} из ${dy} px, свободная полоса карты ${Math.round(free)} px`);

    // шестерёнка → настройки → закрыть
    await tap(cdp, await centerOf(page, '#hub-top button.round'));
    let ok = await waitPopup(page, null);
    if (ok) await audit(page, dev, rec, 'settings', popupOpts);
    const close1 = ok && await centerOf(page, '#popups .overlay:last-child .card-close');
    if (close1) await tap(cdp, close1);
    step(rec, 'шестерёнка → окно → «×»', ok && !!close1 && await waitNoPopup(page), ok ? '' : 'окно не открылось');

    // магазин (кнопка в нижнем ряду) → прокрутка → закрыть
    await tap(cdp, await centerOf(page, '#hub-bottom .hub-row .hub-btn'));
    ok = await waitPopup(page, null);
    if (ok) await audit(page, dev, rec, 'shop', popupOpts);
    let scrollInfo = 'окно не открылось';
    if (ok) {
      const sc = await page.evaluate(() => {
        const b = document.querySelector('#popups .overlay:last-child .card-body'), c = b && b.firstElementChild;
        if (!b || !c) return null;
        const r = b.getBoundingClientRect();
        // предел прокрутки — как в makeScroller (padBottom 8)
        return { need: c.offsetHeight > b.clientHeight + 1, lim: Math.min(0, b.clientHeight - c.scrollHeight - 8), x: r.left + r.width / 2, y: r.top + r.height * 0.7, h: r.height };
      });
      if (sc && sc.need) {
        const t0 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#popups .overlay:last-child .card-scroll')).transform).m42);
        const d = Math.max(sc.lim - t0, -Math.round(Math.min(90, sc.h * 0.4))); // упираемся в конец списка — это нормально
        await touch(cdp, 'touchStart', [[sc.x, sc.y]]);
        for (let i = 1; i <= 6; i++) { await touch(cdp, 'touchMove', [[sc.x, sc.y + d * i / 6]]); await sleep(16); }
        const t1 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('#popups .overlay:last-child .card-scroll')).transform).m42);
        await sleep(150);
        await touch(cdp, 'touchEnd', []);
        await sleep(500);
        const okScroll = Math.abs((t1 - t0) - d) < 3 && (await topPopup(page)) === 'shop';
        scrollInfo = `прокрутка ${Math.round(t1 - t0)} из ${d} px`;
        if (!okScroll) ok = false;
      } else scrollInfo = 'всё помещается без прокрутки';
      const c2 = await centerOf(page, '#popups .overlay:last-child .card-close');
      if (c2) await tap(cdp, c2);
      if (!c2 || !await waitNoPopup(page)) { ok = false; scrollInfo += '; «×» не закрыл окно'; await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page); }
    }
    step(rec, 'магазин: открыть, прокрутить, закрыть', ok, scrollInfo);

    // подарок и «как играть» — только вёрстка
    await page.evaluate(() => window.__app.openDaily());
    if (await waitPopup(page, null)) await audit(page, dev, rec, 'daily', popupOpts);
    await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page);
    await page.evaluate(() => window.__app.openHowTo());
    if (await waitPopup(page, null)) await audit(page, dev, rec, 'howto', popupOpts);
    await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page);

    // «Играть» → уровень
    await tap(cdp, await centerOf(page, '#hub-bottom .play-btn'));
    let inGame = false;
    try { await page.waitForFunction(() => window.__app.screen === 'game' && window.__app.engine, { timeout: 6000 }); inGame = true; } catch { /* нет */ }
    step(rec, '«Играть» → уровень', inGame);
    if (inGame) {
      await waitAim(page);
      await page.evaluate(() => { const e = window.__app.engine; e.aim.active = true; e.aim.valid = true; e.aim.angle = Math.PI / 2 + 0.38; });
      await sleep(250);
      await audit(page, dev, rec, 'game', { roots: ['#game-ui'], field: true });
      await page.evaluate(() => { window.__app.engine.aim.active = false; });

      // прицел за пальцем и выстрел
      const geo = await page.evaluate(() => {
        const a = window.__app, e = a.engine, L = a.L;
        const [lx, ly] = e.launcher();
        return { x: L.fx + lx * L.scale, y: L.fy + (ly - e.camY) * L.scale, top: L.fy, fw: L.fw, scale: L.scale };
      });
      const rad = Math.min(geo.fw * 0.42, (geo.y - geo.top) * 0.55);
      const P = (deg) => [geo.x + Math.cos(deg * Math.PI / 180) * rad, geo.y - Math.sin(deg * Math.PI / 180) * rad];
      const before = await page.evaluate(() => window.__app.engine.shotsLeft);
      let misses = 0;
      await touch(cdp, 'touchStart', [P(150)]);
      for (let i = 1; i <= 8; i++) {
        const [x, y] = P(150 - i * 13);
        await touch(cdp, 'touchMove', [[x, y]]);
        const d = await page.evaluate((cx, cy) => {
          const a = window.__app, e = a.engine;
          const [wx, wy] = a.toWorld({ clientX: cx, clientY: cy });
          const exp = e._angleTo(wx, wy);
          return { ok: e.aim.active && exp !== null && Math.abs(e.aim.angle - exp) < 1e-6 };
        }, x, y);
        if (!d.ok) misses++;
      }
      await touch(cdp, 'touchEnd', []);
      await sleep(60);
      const after = await page.evaluate(() => window.__app.engine.shotsLeft);
      step(rec, 'прицел за пальцем', misses === 0, `промахов ${misses} из 8`);
      step(rec, 'выстрел отпусканием', after === before - 1, `ходов ${before} → ${after}`);

      // смена шарика тапом по пушке
      await waitAim(page);
      await page.evaluate(() => { const e = window.__app.engine, sw = e.swap.bind(e); window.__swaps = 0; e.swap = (...x) => { window.__swaps++; return sw(...x); }; });
      await tap(cdp, { x: geo.x, y: (await page.evaluate(() => { const a = window.__app, e = a.engine; return a.L.fy + (e.launcher()[1] - e.camY) * a.L.scale; })) });
      await sleep(300);
      const swaps = await page.evaluate(() => window.__swaps);
      step(rec, 'смена шарика тапом по пушке', swaps === 1, `вызовов смены: ${swaps}`);

      // бустер с запасом → включается; без запаса → окно предложения
      await waitAim(page);
      await tap(cdp, await centerOf(page, '#boosters .boost[aria-label="bomb"]'));
      await sleep(250);
      const sp = await page.evaluate(() => window.__app.engine.special);
      step(rec, 'бустер «бомба» включается', !!sp, `особый шарик: ${sp || 'нет'}`);
      await tap(cdp, await centerOf(page, '#boosters .boost[aria-label="rainbow"]'));
      ok = await waitPopup(page, null);
      if (ok) await audit(page, dev, rec, 'booster', popupOpts);
      const c3 = ok && await centerOf(page, '#popups .overlay:last-child .card-close');
      if (c3) await tap(cdp, c3);
      step(rec, 'бустер без запаса → окно → «×»', ok && !!c3 && await waitNoPopup(page), ok ? '' : 'окно не открылось');
      if (await topPopup(page)) { await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page); }

      // пауза → «Продолжить»
      await tap(cdp, await centerOf(page, '#hud > button.round'));
      ok = await waitPopup(page, 'pause');
      if (ok) await audit(page, dev, rec, 'pause', popupOpts);
      const resume = ok && await centerOf(page, '#popups .overlay:last-child .btn-green');
      if (resume) await tap(cdp, resume);
      step(rec, 'пауза → «Продолжить»', ok && !!resume && await waitNoPopup(page), ok ? '' : 'пауза не открылась');
      if (await topPopup(page)) { await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page); }

      // ходы кончились
      await page.evaluate(() => { const e = window.__app.engine; e.shotsLeft = 0; e.state = 'settle'; e.timer = 0; });
      if (await waitPopup(page, 'out', 8000)) await audit(page, dev, rec, 'out', popupOpts);
      await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page);
    }
    // победа
    await page.evaluate(() => window.__app.startLevel(2));
    try {
      await waitAim(page);
      await page.evaluate(() => { const e = window.__app.engine; e.kittensFreed = e.kittensTotal; e.score = 2300; e._startWinSequence(); });
      if (await waitPopup(page, 'win', 15000)) { await sleep(900); await audit(page, dev, rec, 'win', popupOpts); }
    } catch { /* не дождались */ }
    await page.evaluate(() => window.__app.popups.closeAll()); await waitNoPopup(page);
    // бесконечный режим
    await page.evaluate(() => window.__app.startEndless());
    try {
      await page.waitForFunction(() => window.__app.engine && window.__app.engine.mode === 'endless' && window.__app.engine.state === 'aim', { timeout: 10000 });
      await sleep(300);
      await audit(page, dev, rec, 'endless', { roots: ['#game-ui'], field: true });
    } catch { /* не дождались */ }
    rec.errors.push(...errors);
    await ctx.close();
  }
  // B. рекорды (вход выполнен)
  {
    const { ctx, page, errors } = await openPage(dev, { query: 'auth=1' });
    await page.evaluate(() => { localStorage.setItem('mock_lb_endless', '4321'); window.__app.openLeaderboard(); });
    if (await waitPopup(page, null)) { await sleep(500); await audit(page, dev, rec, 'lb', popupOpts); }
    rec.errors.push(...errors);
    await ctx.close();
  }
  // C. обучение на 1-м уровне (новый игрок)
  {
    const { ctx, page, errors } = await openPage(dev, { save: null });
    await page.evaluate(() => { window.__app.popups.closeAll(); window.__app.startLevel(1); });
    try {
      await waitAim(page);
      // подсказка появляется после баннера уровня — снимаем, когда она видна
      await page.waitForFunction(() => { const t = document.getElementById('tip'); return t && !t.classList.contains('off') && parseFloat(getComputedStyle(t).opacity) > 0.95; }, { timeout: 6000 });
      await audit(page, dev, rec, 'tut', { roots: ['#game-ui'], field: true });
    } catch { /* нет */ }
    rec.errors.push(...errors);
    await ctx.close();
  }
  return rec;
}

// ---------- запуск ----------
const list = DEVICES.filter((d) => !ONLY || ONLY.includes(d.id));
if (LANG) console.log(`Язык интерфейса: ${LANG}`);
let failed = 0;
for (const dev of list) {
  const t0 = Date.now();
  let rec;
  try { rec = await runDevice(dev); } catch (e) { rec = { dev, states: {}, steps: [{ name: 'сценарий', ok: false, info: e.message.split('\n')[0] }], errors: [] }; }
  report.push(rec);
  const issues = Object.entries(rec.states).flatMap(([s, r]) => r.issues.map((x) => `[${STATE_NAMES[s]}] ${x}`));
  const missing = STATES.filter((s) => !rec.states[s]);
  const badSteps = rec.steps.filter((s) => !s.ok);
  const bad = issues.length + badSteps.length + missing.length + rec.errors.length;
  if (bad) failed++;
  const minTap = Math.min(...Object.values(rec.states).map((r) => (r.minTap ? r.minTap.v : 99)));
  const minFont = Math.min(...Object.values(rec.states).map((r) => (r.minFont ? r.minFont.v : 99)));
  console.log(`${bad ? '✗' : '✓'} ${dev.name} — ${dev.w}×${dev.h} ×${dev.dpr}${dev.insets ? ` (вырез ${dev.insets.top}/${dev.insets.bottom})` : ''}  [${((Date.now() - t0) / 1000).toFixed(0)} с]` +
    `  кнопки ≥ ${minTap} px, шрифт ≥ ${minFont} px`);
  if (dev.insetsUnsupported) console.log(`    ! эмуляция выреза недоступна: ${dev.insetsUnsupported}`);
  console.log('    касания: ' + rec.steps.map((s) => `${s.ok ? '✓' : '✗'} ${s.name}${s.info ? ' (' + s.info + ')' : ''}`).join(' · '));
  if (missing.length) console.log('    ✗ не проверены экраны: ' + missing.map((s) => STATE_NAMES[s]).join(', '));
  for (const x of issues) console.log('    ✗ ' + x);
  for (const x of rec.errors.slice(0, 3)) console.log('    ✗ ошибка в консоли: ' + x);
  const warns = Object.entries(rec.states).flatMap(([s, r]) => r.warns.map((x) => `[${STATE_NAMES[s]}] ${x}`));
  if (warns.length && process.env.WARN) for (const x of warns) console.log('    · ' + x);
  else if (warns.length) console.log(`    · замечаний без ошибки: ${warns.length} (WARN=1 — показать)`);
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));

// сводные листы: каждый экран на всех устройствах в масштабе 1 CSS px = 1 px
if (SHOTS) {
  const sheetPage = await browser.newPage();
  await sheetPage.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  for (const st of STATES) {
    const items = list.filter((d) => fs.existsSync(path.join(OUT, d.id, st + '.jpg')));
    if (!items.length) continue;
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#2b2230;font:600 15px sans-serif;color:#fff">
<div style="padding:14px 18px;font-size:22px">${STATE_NAMES[st]}</div>
<div style="display:flex;flex-wrap:wrap;gap:18px;padding:0 18px 18px;align-items:flex-start">${items.map((d) => `
<figure style="margin:0"><img src="${pathToFileURL(path.join(OUT, d.id, st + '.jpg')).href}" width="${d.w}" height="${d.h}" style="display:block;outline:1px solid #776"><figcaption style="padding-top:6px;max-width:${d.w}px">${d.name}<br><span style="opacity:.7">${d.w}×${d.h}</span></figcaption></figure>`).join('')}
</div></body>`;
    const f = path.join(OUT, `sheet-${st}.html`);
    fs.writeFileSync(f, html);
    await sheetPage.setViewport({ width: 3400, height: 900, deviceScaleFactor: 1 });
    await sheetPage.goto(pathToFileURL(f).href, { waitUntil: 'load' });
    await sheetPage.screenshot({ path: path.join(OUT, `sheet-${st}.jpg`), type: 'jpeg', quality: 82, fullPage: true });
  }
  await sheetPage.close();
  console.log(`Скриншоты и сводные листы: ${path.relative(process.cwd(), OUT)}/ (sheet-<экран>.jpg)`);
}

await browser.close();
if (srv) srv.stop();
console.log(failed ? `Итого: проблемы на ${failed} из ${list.length} устройств` : `Итого: все ${list.length} устройств ✓`);
process.exit(failed ? 1 : 0);
