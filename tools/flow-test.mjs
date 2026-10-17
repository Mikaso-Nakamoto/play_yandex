// Сценарные тесты в браузере (против мок SDK): npm run build && node tools/flow-test.mjs [baseUrl]
// Без baseUrl поднимается временный сервер для dist/.
import { serveDist } from './serve.mjs';
import { launch } from './browser.mjs';

const server = await serveDist(process.argv[2]);
const BASE = server.base;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
let failed = 0, passed = 0;
const allErrors = [];

async function newPage(query = '', vp = { width: 390, height: 844 }, ctx = null) {
  const context = ctx || await browser.createBrowserContext();
  const page = await context.newPage();
  const mobile = vp.width < vp.height;
  await page.setViewport({ ...vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  page._errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page._errors.push(m.text()); });
  page.on('pageerror', (e) => page._errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '?test=1&fastads=1' + (query ? '&' + query : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 15000 });
  page._ctx = context;
  return page;
}

const mlog = (page) => page.evaluate(() => (window.__mockLog || []).map((x) => x.type));
const app = (page, fn, arg) => page.evaluate(fn, arg);

async function clickText(page, text, scope = '#popups') {
  const pos = await page.evaluate((txt, sc) => {
    const btns = [...document.querySelectorAll(sc + ' button')].filter((b) => b.offsetParent && !b.disabled && b.textContent.includes(txt));
    if (!btns.length) return null;
    const r = btns[btns.length - 1].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, text, scope);
  if (!pos) throw new Error(`кнопка «${text}» не найдена`);
  await page.mouse.click(pos[0], pos[1]);
  await sleep(150);
}

async function clickSel(page, sel) {
  const el = await page.$(sel);
  if (!el) throw new Error('нет элемента ' + sel);
  const b = await el.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(150);
}

const waitState = (page, st, timeout = 8000) => page.waitForFunction((s) => window.__app.engine && window.__app.engine.state === s, { timeout }, st);
const waitPopup = (page, id, timeout = 8000) => page.waitForFunction((i) => window.__app.popups.top && window.__app.popups.top.id === i, { timeout }, id);

async function forceWin(page) {
  await app(page, () => {
    const e = window.__app.engine;
    if (e.goal === 'kittens') e.kittensFreed = e.kittensTotal; else { for (const b of e.board.all()) e.board.remove(b); e.board.trim(); }
    e._startWinSequence();
  });
  await waitPopup(page, 'win', 15000);
}

async function forceOut(page) {
  await waitState(page, 'aim');
  await app(page, () => { const e = window.__app.engine; e.shotsLeft = 0; e.state = 'settle'; e.timer = 0; });
  await waitPopup(page, 'out');
}

async function test(name, fn) {
  let page = null;
  try {
    page = await fn();
    if (page && page._errors && page._errors.length) throw new Error('ошибки консоли: ' + page._errors.join(' | '));
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.log('  ✗', name, '—', e.message);
  } finally {
    if (page && page._ctx) await page._ctx.close().catch(() => {});
  }
}

console.log('Сценарные тесты:', BASE);

await test('запуск: LoadingAPI.ready один раз, баннер, нет ошибок', async () => {
  const p = await newPage();
  const log = await mlog(p);
  if (log.filter((x) => x === 'LoadingAPI.ready').length !== 1) throw new Error('ready: ' + log.join(','));
  if (!log.includes('banner:show')) throw new Error('нет баннера');
  if (log.some((x) => x.includes('DUPLICATE'))) throw new Error('дубли');
  const cm = await p.evaluate(() => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.getElementById('cv').dispatchEvent(ev); return ev.defaultPrevented; });
  if (!cm) throw new Error('контекстное меню не заблокировано');
  const scroll = await p.evaluate(() => [document.documentElement.scrollHeight <= innerHeight + 1, getComputedStyle(document.body).overflow]);
  if (!scroll[0] || scroll[1] !== 'hidden') throw new Error('прокрутка страницы возможна');
  return p;
});

await test('пауза при скрытии вкладки и по событиям платформы: звук и геймплей', async () => {
  const p = await newPage();
  await clickSel(p, '.play-btn');
  await waitState(p, 'aim');
  const hide = (v) => p.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);
  await hide(true);
  await sleep(200);
  let st = await app(p, () => ({ paused: [...window.__app.pause], gp: window.__mockState.gameplay }));
  if (!st.paused.includes('hidden') || st.gp) throw new Error('не встала на паузу: ' + JSON.stringify(st));
  await hide(false);
  await sleep(300);
  st = await app(p, () => ({ paused: [...window.__app.pause], gp: window.__mockState.gameplay }));
  if (st.paused.length || !st.gp) throw new Error('не возобновилась: ' + JSON.stringify(st));
  await app(p, () => window.__mockEmit('game_api_pause'));
  await sleep(100);
  st = await app(p, () => ({ paused: [...window.__app.pause], gp: window.__mockState.gameplay, frozen: window.__app.inputAllowed }));
  if (!st.paused.includes('sdk') || st.gp || st.frozen) throw new Error('game_api_pause не обработан');
  await app(p, () => window.__mockEmit('game_api_resume'));
  await sleep(100);
  st = await app(p, () => ({ gp: window.__mockState.gameplay }));
  if (!st.gp) throw new Error('game_api_resume не обработан');
  // меню паузы → stop, закрытие → start
  await clickSel(p, '#hud .round');
  await sleep(200);
  if (await app(p, () => window.__mockState.gameplay)) throw new Error('меню паузы не остановило геймплей');
  await p.keyboard.press('Escape');
  await sleep(300);
  if (!(await app(p, () => window.__mockState.gameplay))) throw new Error('после меню паузы геймплей не возобновлён');
  return p;
});

await test('межстраничная реклама по кнопке «Далее»: пауза и звук на время показа', async () => {
  const p = await newPage();
  await app(p, () => { window.__app.lastAd = 0; window.__app.startLevel(3); });
  await waitState(p, 'aim');
  await forceWin(p);
  await app(p, () => { window.__app.lastAd = 0; });
  await clickText(p, 'Далее');
  await sleep(120);
  const during = await app(p, () => ({ ad: window.__app.pause.has('ad'), susp: window.__app.pause.size > 0, gp: window.__mockState.gameplay }));
  if (!during.ad || during.gp) throw new Error('во время рекламы игра не на паузе: ' + JSON.stringify(during));
  await waitState(p, 'aim', 10000);
  const log = await mlog(p);
  if (!log.includes('fullscreen:open') || !log.includes('fullscreen:close')) throw new Error('реклама не показана');
  const lvl = await app(p, () => window.__app.levelNum);
  if (lvl !== 4) throw new Error('не перешли на следующий уровень: ' + lvl);
  return p;
});

await test('видео за награду: +5 выстрелов, и без награды при досрочном закрытии', async () => {
  let p = await newPage();
  await app(p, () => window.__app.startLevel(5));
  await forceOut(p);
  await clickText(p, '+5');
  await waitState(p, 'aim', 8000);
  const shots = await app(p, () => window.__app.engine.shotsLeft);
  if (shots !== 5) throw new Error('выстрелов: ' + shots);
  await p._ctx.close();
  p = await newPage('rv=close');
  await app(p, () => window.__app.startLevel(5));
  await forceOut(p);
  await clickText(p, 'рекламы');
  await sleep(1200);
  const st = await app(p, () => ({ state: window.__app.engine.state, popup: window.__app.popups.top && window.__app.popups.top.id }));
  if (st.state !== 'out' || st.popup !== 'out') throw new Error('награда выдана без досмотра: ' + JSON.stringify(st));
  return p;
});

await test('продолжение за монеты и проигрыш → «Ещё раз»', async () => {
  const p = await newPage();
  await app(p, () => { window.__app.startLevel(5); });
  await forceOut(p);
  const before = await app(p, () => window.__store_coins = window.__app && JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  await clickText(p, '150');
  await waitState(p, 'aim');
  const after = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  if (before - after !== 150) throw new Error(`монеты ${before} → ${after}`);
  await forceOut(p);
  await clickText(p, 'Сдаться');
  await waitPopup(p, 'fail');
  await clickText(p, 'Ещё раз');
  await waitState(p, 'aim', 10000);
  return p;
});

await test('x2 монет после победы и сохранение прогресса после перезагрузки', async () => {
  const p = await newPage();
  await app(p, () => window.__app.startLevel(1));
  await waitState(p, 'aim');
  await forceWin(p);
  const c1 = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  await clickText(p, 'Удвоить');
  await sleep(1200);
  const c2 = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  if (c2 <= c1) throw new Error(`x2 не начислен: ${c1} → ${c2}`);
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 15000 });
  const d = await app(p, () => { const s = JSON.parse(localStorage.getItem('meow_bubbles_save_v1')); return { level: s.level, stars: s.stars[1], coins: s.coins }; });
  if (d.level !== 2 || !d.stars || d.coins !== c2) throw new Error('после перезагрузки: ' + JSON.stringify(d));
  const cloud = await app(p, () => JSON.parse(localStorage.getItem('mock_cloud_guest') || '{}'));
  if (cloud.level !== 2) throw new Error('облачное сохранение не записано');
  return p;
});

await test('бустер: предложение → видео → активация → выстрел без траты хода', async () => {
  const p = await newPage();
  await app(p, () => window.__app.startLevel(8));
  await waitState(p, 'aim');
  await app(p, () => { window.__app.onBoosterTap('bomb'); });
  await waitPopup(p, 'booster');
  await clickText(p, 'рекламы');
  await p.waitForFunction(() => !window.__app.popups.isOpen, { timeout: 8000 });
  let st = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).boosters.bomb);
  if (st !== 1) throw new Error('бомба не выдана');
  await waitState(p, 'aim');
  await app(p, () => window.__app.onBoosterTap('bomb'));
  const sp = await app(p, () => ({ sp: window.__app.engine.special, shots: window.__app.engine.shotsLeft }));
  if (sp.sp !== 'bomb') throw new Error('не активирован');
  await app(p, () => { const e = window.__app.engine; const low = e.board.all().sort((a, b) => b.r - a.r)[0]; const [lx, ly] = e.launcher(); e.shoot(Math.atan2(ly - e.board.y(low.r), e.board.x(low.r, low.c) - lx)); });
  await sleep(1500);
  st = await app(p, () => ({ sp: window.__app.engine.special, shots: window.__app.engine.shotsLeft, inv: JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).boosters.bomb }));
  if (st.sp || st.shots !== sp.shots || st.inv !== 0) throw new Error(JSON.stringify(st));
  return p;
});

await test('магазин: цены из каталога, покупка монет с consume, «без рекламы» скрывает баннер', async () => {
  const p = await newPage();
  await clickSel(p, '.coins-pill');
  await waitPopup(p, 'shop');
  const items = await p.evaluate(() => [...document.querySelectorAll('.shop-item')].map((x) => x.textContent));
  if (!items.some((t) => t.includes('99')) || !items.some((t) => t.includes('500 монет'))) throw new Error('каталог не показан: ' + items.join(' | '));
  const hasCur = await p.evaluate(() => !!document.querySelector('.shop-item .price img'));
  if (!hasCur) throw new Error('нет значка валюты из SDK');
  const c1 = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  await p.evaluate(() => { const b = [...document.querySelectorAll('.shop-item')].find((x) => x.textContent.includes('500 монет')).querySelector('button'); b.click(); });
  await sleep(300);
  await p.click('.mock-pay-ok');
  await sleep(800);
  const st = await app(p, () => ({ coins: JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins, pend: JSON.parse(localStorage.getItem('mock_purchases') || '[]').length }));
  if (st.coins !== c1 + 500 || st.pend !== 0) throw new Error('покупка: ' + JSON.stringify({ c1, ...st }));
  await p.evaluate(() => { const b = [...document.querySelectorAll('.shop-item')].find((x) => x.textContent.includes('Без рекламы')).querySelector('button'); b.click(); });
  await sleep(300);
  await p.click('.mock-pay-ok');
  await sleep(800);
  const st2 = await app(p, () => ({ noAds: JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).noAds, banner: window.__mockState.banner }));
  if (!st2.noAds || st2.banner) throw new Error('без рекламы: ' + JSON.stringify(st2));
  // после «без рекламы» межстраничная реклама не показывается
  await app(p, () => { window.__app.lastAd = 0; });
  const shown = await app(p, () => window.__app.interstitial(true));
  if (shown) throw new Error('реклама показана после отключения');
  return p;
});

await test('незавершённая покупка при запуске начисляется и потребляется', async () => {
  const ctx = await browser.createBrowserContext();
  const p0 = await ctx.newPage();
  await p0.goto(BASE + '?test=1', { waitUntil: 'load' });
  await p0.evaluate(() => { localStorage.setItem('mock_purchases', JSON.stringify([{ productID: 'coins1500', purchaseToken: 'tok_pending_1' }])); });
  await p0.close();
  const p = await newPage('', undefined, ctx);
  const st = await app(p, () => ({ coins: JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins, pend: JSON.parse(localStorage.getItem('mock_purchases') || '[]').length }));
  if (st.coins < 1500 || st.pend !== 0) throw new Error(JSON.stringify(st));
  return p;
});

await test('ежедневный подарок: забрать сегодня, завтра — следующий день', async () => {
  const ctx = await browser.createBrowserContext();
  let p = await newPage('', undefined, ctx);
  await clickText(p, 'Подарок', '#hub');
  await waitPopup(p, 'daily');
  const c1 = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  await clickText(p, 'Забрать');
  await sleep(300);
  const c2 = await app(p, () => JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).coins);
  if (c2 - c1 !== 50) throw new Error(`день 1: ${c1} → ${c2}`);
  const avail = await app(p, () => window.__app.dailyState().available);
  if (avail) throw new Error('можно забрать повторно');
  await p.close();
  p = await newPage('dayshift=1', undefined, ctx);
  const st = await app(p, () => window.__app.dailyState());
  if (!st.available || st.day !== 2) throw new Error('завтра: ' + JSON.stringify(st));
  return p;
});

await test('бесконечный режим: проигрыш → продолжение за видео → рекорд в лидерборде', async () => {
  const p = await newPage('auth=1');
  await app(p, () => window.__app.startEndless());
  await waitState(p, 'aim', 10000);
  await app(p, () => {
    const e = window.__app.engine;
    e.score = 1234;
    for (let i = 0; i < 8; i++) e.board.pushRowTop((c) => e._endlessCell(c));
    e.state = 'settle'; e.timer = 0;
  });
  await waitPopup(p, 'over', 8000);
  await clickText(p, 'Продолжить');
  await waitState(p, 'aim', 8000);
  const low = await app(p, () => window.__app.engine.board.lowestRow());
  if (low >= 12) throw new Error('ряды не убраны');
  const st = await app(p, () => ({ best: JSON.parse(localStorage.getItem('meow_bubbles_save_v1')).endlessBest, lb: localStorage.getItem('mock_lb_endless') }));
  if (st.best !== 1234 || st.lb !== '1234') throw new Error(JSON.stringify(st));
  return p;
});

await test('лидерборд и вход: кнопка входа с пояснением, после входа — «Вы» в таблице', async () => {
  const p = await newPage();
  await app(p, () => { const s = JSON.parse(localStorage.getItem('meow_bubbles_save_v1')); s.endlessBest = 777; localStorage.setItem('meow_bubbles_save_v1', JSON.stringify(s)); localStorage.setItem('mock_lb_endless', '777'); });
  await clickText(p, 'Рекорды', '#hub');
  await waitPopup(p, 'lb');
  await sleep(300);
  const txt = await p.evaluate(() => document.querySelector('#popups').textContent);
  if (!txt.includes('Войдите')) throw new Error('нет пояснения для входа');
  await clickText(p, 'Войти');
  await sleep(800);
  const rows = await p.evaluate(() => [...document.querySelectorAll('.lb-row')].map((r) => r.textContent));
  if (!rows.some((r) => r.includes('Вы'))) throw new Error('нет строки игрока: ' + rows.join('|'));
  return p;
});

for (const [lang, word] of [['en', 'Play'], ['tr', 'Oyna'], ['kk', 'Играть'], ['de', 'Play'], ['ru', 'Играть']]) {
  await test(`язык ${lang} → «${word}»`, async () => {
    const p = await newPage('lang=' + lang);
    const txt = await p.evaluate(() => document.querySelector('.play-btn').textContent);
    if (!txt.includes(word)) throw new Error(txt);
    return p;
  });
}

await test('поворот экрана во время уровня: раскладка пересчитана, без ошибок', async () => {
  const p = await newPage();
  await app(p, () => window.__app.startLevel(10));
  await waitState(p, 'aim');
  await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(400);
  const L1 = await app(p, () => ({ ...window.__app.L, can: window.__app.engine.state }));
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(400);
  const L2 = await app(p, () => window.__app.L);
  if (!(L1.W === 844 && L2.W === 390)) throw new Error('раскладка не обновилась');
  const fit = await p.evaluate(() => [...document.querySelectorAll('#hud .pill, #hud .round, .boost')].every((el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }));
  if (!fit) throw new Error('элементы интерфейса выходят за экран');
  return p;
});

console.log(`\nИтого: ${passed} ✓, ${failed} ✗`);
await browser.close();
server.stop();
process.exit(failed ? 1 : 0);
