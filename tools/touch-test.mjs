// Проверка управления на телефоне: настоящие касания через Chrome DevTools (Input.dispatchTouchEvent),
// телефон 390×844 ×3 с тач-экраном. Сценарии: прицел за пальцем без пропусков, быстрый взмах,
// палец уходит на кнопки, касание во время полёта, быстрые повторные тапы, второй палец, отмена жеста,
// смена шарика, свайп карты с инерцией и без «рывка» после остановки (в т.ч. с кнопки уровня),
// нагрузка на кадр при слабом процессоре.
//   node tools/touch-test.mjs [baseUrl]     (без url — поднимает сервер для dist/)
//   npm run test:touch                      (сборка + проверка)
//   node tools/touch-test.mjs --shim        (как на старом iOS без Pointer Events — через полифил; или SHIM=1)
import { launch } from './browser.mjs';
import { serveDist } from './serve.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const SHIM = !!process.env.SHIM || args.includes('--shim');
let srv = null;
let BASE = args.find((a) => !a.startsWith('--'));
if (!BASE) { srv = await serveDist(); BASE = srv.base; }
const browser = await launch();
console.log(SHIM ? 'Режим: полифил касаний (старый iOS без Pointer Events)' : 'Режим: родные Pointer Events (Android, iOS 13+, ПК)');
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${info ? ' — ' + info : ''}`);
};

async function open({ throttle = 1, save = null } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const cdp = await page.target().createCDPSession();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (SHIM) {
    // старый iOS (Safari < 13): нет Pointer Events — игра работает через полифил из main.js
    await page.evaluateOnNewDocument(() => {
      delete window.PointerEvent;
      for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout',
        'pointerenter', 'pointerleave', 'gotpointercapture', 'lostpointercapture']) {
        window.addEventListener(t, (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
      }
    });
  }
  if (save) {
    await page.evaluateOnNewDocument((s) => {
      if (!localStorage.getItem('__touch_seeded')) {
        const cur = JSON.parse(localStorage.getItem('meow_bubbles_save_v1') || 'null');
        localStorage.setItem('meow_bubbles_save_v1', JSON.stringify(Object.assign(cur || {}, s)));
        localStorage.setItem('__touch_seeded', '1');
      }
    }, save);
  }
  await page.goto(BASE + '?test=1&fastads=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__app && window.__app.screen === 'hub', { timeout: 20000 });
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  return { page, cdp, ctx, errors };
}

async function startLevel(page, n) {
  await page.evaluate((lv) => { const a = window.__app; a.popups.closeAll(); a.startLevel(lv); }, n);
  await waitReady(page);
}
const waitReady = (page, timeout = 15000) => page.waitForFunction(() => {
  const a = window.__app, e = a.engine;
  return e && e.state === 'aim' && e.canShoot && a.inputAllowed;
}, { timeout, polling: 'raf' });

// касания: pts — активные пальцы [[x, y, id], ...]
const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: pts.map(([x, y, id = 0]) => ({ x, y, id, radiusX: 6, radiusY: 6, force: 1 })),
});

// экранные координаты пушки и точка на луче под углом deg (градусы, 90 — вверх)
async function launcherInfo(page) {
  return page.evaluate(() => {
    const a = window.__app, e = a.engine, L = a.L;
    const [lx, ly] = e.launcher();
    return { x: L.fx + lx * L.scale, y: L.fy + (ly - e.camY) * L.scale, scale: L.scale };
  });
}
// точка на луче, не выходящая за экран (касания за краем браузер не доставляет)
const ray = (li, deg, r = 240) => {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  let rr = r;
  if (c < 0) rr = Math.min(rr, (li.x - 14) / -c);
  if (c > 0) rr = Math.min(rr, (390 - 14 - li.x) / c);
  rr = Math.min(rr, (li.y - 90) / Math.max(0.01, s));
  return [li.x + c * rr, li.y - s * rr];
};
const state = (page) => page.evaluate(() => {
  const e = window.__app.engine;
  return { state: e.state, shots: e.shotsLeft, angle: e.aim.angle, active: e.aim.active, special: e.special, cur: e.cur, next: e.next };
});
const expectedAngle = (page, x, y) => page.evaluate((cx, cy) => {
  const a = window.__app; const [wx, wy] = a.toWorld({ clientX: cx, clientY: cy });
  return a.engine._angleTo(wx, wy);
}, x, y);

const level = 9;
const save = { level: 40 }; // уровень 9 — без обучения (оно на 1–4 и 6)

// ---------- 1–8: поле ----------
{
  const { page, cdp, errors } = await open({ save });
  console.log('Поле (уровень ' + level + '):');

  // 1. прицел следует за пальцем на каждом движении
  await startLevel(page, level);
  let li = await launcherInfo(page);
  let [x, y] = ray(li, 160);
  await touch(cdp, 'touchStart', [[x, y, 1]]);
  let misses = 0, maxErr = 0;
  const missAt = [];
  for (let i = 1; i <= 40; i++) {
    [x, y] = ray(li, 160 - i * 3.5);
    await touch(cdp, 'touchMove', [[x, y, 1]]);
    const st = await state(page);
    const exp = await expectedAngle(page, x, y);
    const err = Math.abs(st.angle - exp);
    maxErr = Math.max(maxErr, err);
    // в режиме полифила Chrome не присылает touchmove в пределах 15 px от касания (Safari присылает) — шаг 1 не считаем
    if (SHIM && i === 1) continue;
    if (!st.active || err > 1e-6) { misses++; missAt.push(i); }
  }
  const before = (await state(page)).shots;
  await touch(cdp, 'touchEnd', []);
  await sleep(50);
  const after = await state(page);
  check('прицел следует за пальцем на каждом из 40 движений', misses === 0, `пропусков ${misses}${missAt.length ? ' (шаги ' + missAt.join(', ') + ')' : ''}${SHIM ? ' (шаг 1 < 15 px не считается: Chrome не шлёт такой touchmove)' : ', макс. отклонение ' + maxErr.toFixed(6) + ' рад'}`);
  check('отпускание пальца — выстрел', after.shots === before - 1, `ходов ${before} → ${after.shots}`);

  // 2. быстрый взмах: 3 движения и отпускание — выстрел туда, где палец был в конце
  await waitReady(page);
  li = await launcherInfo(page);
  const b2 = (await state(page)).shots;
  await touch(cdp, 'touchStart', [ray(li, 60).concat(1)]);
  await touch(cdp, 'touchMove', [ray(li, 75).concat(1)]);
  await touch(cdp, 'touchMove', [ray(li, 95).concat(1)]);
  const fin = ray(li, 120);
  await touch(cdp, 'touchMove', [fin.concat(1)]);
  await touch(cdp, 'touchEnd', []);
  const s2 = await state(page);
  const e2 = await expectedAngle(page, fin[0], fin[1]);
  check('быстрый взмах — выстрел в конечную точку', s2.shots === b2 - 1 && Math.abs(s2.angle - e2) < 1e-6, `угол ${(s2.angle * 180 / Math.PI).toFixed(1)}° (ожидалось ${(e2 * 180 / Math.PI).toFixed(1)}°)`);

  // 3. палец уходит на HUD и кнопки бустеров и возвращается — прицел не обрывается, бустер не включается
  await waitReady(page);
  li = await launcherInfo(page);
  const boost = await page.evaluate(() => { const r = document.querySelector('.boost').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const hud = await page.evaluate(() => { const r = document.querySelector('#hud .pill').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const b3 = (await state(page)).shots;
  await touch(cdp, 'touchStart', [ray(li, 70).concat(1)]);
  await touch(cdp, 'touchMove', [[hud[0], hud[1], 1]]);
  const midHud = await state(page);
  await touch(cdp, 'touchMove', [[boost[0], boost[1], 1]]);
  const back = ray(li, 110);
  await touch(cdp, 'touchMove', [back.concat(1)]);
  await touch(cdp, 'touchEnd', []);
  await sleep(80);
  const s3 = await state(page);
  check('палец проходит над HUD и кнопками — прицел не обрывается', midHud.active, midHud.active ? 'прицел активен над HUD' : 'прицел пропал');
  check('палец вернулся на поле и отпущен — выстрел, бустер не включён', s3.shots === b3 - 1 && !s3.special, `ходов ${b3} → ${s3.shots}, бустер: ${s3.special || 'нет'}`);

  // 3б. отпускание ниже пушки (над кнопкой бустера) — отмена выстрела, бустер не включается
  await waitReady(page);
  li = await launcherInfo(page);
  const b3b = (await state(page)).shots;
  await touch(cdp, 'touchStart', [ray(li, 100).concat(1)]);
  await touch(cdp, 'touchMove', [[boost[0], boost[1], 1]]);
  await touch(cdp, 'touchEnd', []);
  await sleep(80);
  const s3b = await state(page);
  check('отпускание ниже пушки — отмена выстрела (жест «передумал»)', s3b.shots === b3b && !s3b.special && !s3b.active, `ходов ${b3b} → ${s3b.shots}, бустер: ${s3b.special || 'нет'}`);

  // 4. касание во время полёта шарика: палец держат и ведут, отпускают, когда игра готова
  await waitReady(page);
  li = await launcherInfo(page);
  await touch(cdp, 'touchStart', [ray(li, 100).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  const b4 = (await state(page)).shots;
  await touch(cdp, 'touchStart', [ray(li, 80).concat(1)]); // шарик ещё летит
  const during = await state(page);
  await waitReady(page);
  await touch(cdp, 'touchMove', [ray(li, 70).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  await sleep(50);
  const s4 = await state(page);
  check('палец коснулся во время полёта, повёл и отпустил после — выстрел', s4.shots === b4 - 1, `в момент касания: ${during.state}; ходов ${b4} → ${s4.shots}`);

  // 4б. то же без движения
  await waitReady(page);
  li = await launcherInfo(page);
  await touch(cdp, 'touchStart', [ray(li, 100).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  const b4b = (await state(page)).shots;
  const p4b = ray(li, 85);
  await touch(cdp, 'touchStart', [p4b.concat(1)]);
  const during4b = (await state(page)).state;
  await waitReady(page);
  await sleep(80);
  const h4b = await state(page);
  const e4b = await expectedAngle(page, p4b[0], p4b[1]);
  check('палец держат с полёта неподвижно — прицел появляется, как только пушка готова', during4b !== 'aim' && h4b.active && Math.abs(h4b.angle - e4b) < 1e-6,
    `касание в «${during4b}»; прицел ${h4b.active ? 'есть' : 'нет'}, угол ${(h4b.angle * 180 / Math.PI).toFixed(1)}° (ожидалось ${(e4b * 180 / Math.PI).toFixed(1)}°)`);
  await touch(cdp, 'touchEnd', []);
  await sleep(50);
  const s4b = await state(page);
  check('палец коснулся во время полёта и отпустил после (без движения) — выстрел', s4b.shots === b4b - 1, `ходов ${b4b} → ${s4b.shots}`);

  // 5. тап, пока пушка перезаряжается (≈0,17 с после выстрела) — выстрел не теряется, а выполняется, когда готово
  await waitReady(page);
  li = await launcherInfo(page);
  const b5 = (await state(page)).shots;
  await page.evaluate(() => { window.__app.engine.reloadT = 1; }); // как сразу после выстрела
  await touch(cdp, 'touchStart', [ray(li, 85).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  await sleep(600);
  const s5 = await state(page);
  check('тап во время перезарядки пушки — выстрел не теряется', s5.shots === b5 - 1, `ходов ${b5} → ${s5.shots}`);

  // 6. второй палец не перехватывает прицел
  await waitReady(page);
  li = await launcherInfo(page);
  const A = ray(li, 140), B = ray(li, 40);
  await touch(cdp, 'touchStart', [A.concat(1)]);
  await touch(cdp, 'touchMove', [ray(li, 135).concat(1)]);
  const aimA = (await state(page)).angle;
  await touch(cdp, 'touchStart', [ray(li, 135).concat(1), B.concat(2)]);
  await touch(cdp, 'touchMove', [ray(li, 135).concat(1), ray(li, 45).concat(2)]);
  const withB = (await state(page)).angle;
  const b6 = (await state(page)).shots;
  // в CDP touchEnd с перечисленными точками отпускает именно их: здесь отпускаем второй палец
  await touch(cdp, 'touchEnd', [ray(li, 45).concat(2)]);
  await sleep(50);
  const s6 = await state(page);
  await touch(cdp, 'touchEnd', []); // теперь первый
  await sleep(50);
  const s6b = await state(page);
  check('второй палец не перехватывает прицел', Math.abs(withB - aimA) < 1e-6, `прицел ${(aimA * 180 / Math.PI).toFixed(0)}° → ${(withB * 180 / Math.PI).toFixed(0)}° при втором пальце`);
  check('второй палец отпущен — выстрела нет, прицел первого на месте', s6.shots === b6 && s6.active && Math.abs(s6.angle - aimA) < 1e-6, `ходов ${b6} → ${s6.shots}, прицел ${(s6.angle * 180 / Math.PI).toFixed(0)}°`);
  check('первый палец отпущен — выстрел по его прицелу', s6b.shots === b6 - 1 && Math.abs(s6b.angle - aimA) < 1e-6, `ходов ${b6} → ${s6b.shots}, угол ${(s6b.angle * 180 / Math.PI).toFixed(0)}°`);

  // 7. отмена жеста системой (touchcancel) — без выстрела, прицел убран
  await waitReady(page);
  li = await launcherInfo(page);
  const b7 = (await state(page)).shots;
  await touch(cdp, 'touchStart', [ray(li, 100).concat(1)]);
  await touch(cdp, 'touchMove', [ray(li, 90).concat(1)]);
  await touch(cdp, 'touchCancel', []);
  await sleep(50);
  const s7 = await state(page);
  check('отмена жеста системой — без выстрела, прицел убран', s7.shots === b7 && !s7.active, `ходов ${b7} → ${s7.shots}, прицел ${s7.active ? 'остался' : 'убран'}`);

  // 8. тап по пушке — смена шарика
  await waitReady(page);
  li = await launcherInfo(page);
  const c8 = await state(page);
  // считаем вызовы swap(): «совместимые» события мыши после тапа не должны менять шарик второй раз
  await page.evaluate(() => {
    const e = window.__app.engine, sw = e.swap.bind(e);
    window.__swaps = 0; e.swap = (...a) => { window.__swaps++; return sw(...a); };
  });
  await touch(cdp, 'touchStart', [[li.x, li.y, 1]]);
  await touch(cdp, 'touchEnd', []);
  await sleep(400);
  const s8 = await state(page);
  const swaps = await page.evaluate(() => window.__swaps);
  const swapped = c8.cur === c8.next || (s8.cur === c8.next && s8.next === c8.cur);
  check('тап по пушке — смена шарика ровно один раз', swaps === 1 && swapped && s8.shots === c8.shots, `${c8.cur}/${c8.next} → ${s8.cur}/${s8.next}, вызовов смены: ${swaps}`);

  // 8b. короткий тап целиком во время полёта — после полёта «призрачного» выстрела нет
  await waitReady(page);
  li = await launcherInfo(page);
  const b8b = (await state(page)).shots;
  await touch(cdp, 'touchStart', [ray(li, 95).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  const tapState = (await state(page)).state;
  await touch(cdp, 'touchStart', [ray(li, 60).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  await waitReady(page);
  await sleep(400);
  const s8b = await state(page);
  check('короткий тап во время полёта — лишнего выстрела потом нет', tapState !== 'aim' && s8b.shots === b8b - 1, `тап пришёлся на «${tapState}»; ходов ${b8b} → ${s8b.shots}`);

  // 8c. отложенный выстрел (тап во время перезарядки) не срабатывает, если сразу открыли паузу
  await waitReady(page);
  li = await launcherInfo(page);
  const b8c = (await state(page)).shots;
  await page.evaluate(() => { window.__app.engine.reloadT = 1; });
  await touch(cdp, 'touchStart', [ray(li, 80).concat(1)]);
  await touch(cdp, 'touchEnd', []);
  await page.evaluate(() => window.__app.openPause());
  await sleep(300);
  await page.evaluate(() => window.__app.popups.closeById('pause'));
  await sleep(500);
  const s8c = await state(page);
  check('пауза сразу после тапа — отложенный выстрел отменён', s8c.shots === b8c, `ходов ${b8c} → ${s8c.shots}`);
  if (errors.length) console.log('  ошибки на странице:', errors.slice(0, 3));
  check('без ошибок в консоли (поле)', errors.length === 0);
}

// ---------- 9: карта ----------
{
  const { page, cdp, errors } = await open({ save });
  console.log('Карта:');
  // окно ежедневной награды всплывает само через 0,6 с после показа карты — дождёмся и закроем
  await page.waitForFunction(() => window.__app.popups.isOpen, { timeout: 2000 }).catch(() => {});
  await page.evaluate(() => window.__app.popups.closeAll());
  await sleep(400);
  const Y = () => page.evaluate(() => window.__app.hub.scroller.y);
  const swipe = async (fromY, dy, steps, holdMs) => {
    await touch(cdp, 'touchStart', [[195, fromY, 1]]);
    for (let i = 1; i <= steps; i++) { await touch(cdp, 'touchMove', [[195, fromY + dy * i / steps, 1]]); await sleep(16); }
    if (holdMs) await sleep(holdMs);
    const atRelease = await Y();
    await touch(cdp, 'touchEnd', []);
    return atRelease;
  };
  const y0 = await Y();
  const rel = await swipe(250, 260, 10, 0);
  await sleep(700);
  const y1 = await Y();
  check('свайп прокручивает карту за пальцем', Math.abs(rel - y0 - 260) < 3, `сдвиг за пальцем ${(rel - y0).toFixed(0)} px из 260`);
  check('после быстрого свайпа — инерция', y1 - rel > 20, `докрутка после отпускания ${(y1 - rel).toFixed(0)} px`);
  await sleep(300);
  const yb2 = await Y();
  const rel2 = await swipe(250, -220, 10, 250);
  await sleep(700);
  const y2 = await Y();
  check('палец остановился и отпущен — карта не «уезжает»', Math.abs(rel2 - yb2 + 220) < 3 && Math.abs(y2 - rel2) < 3, `сдвиг за пальцем ${(rel2 - yb2).toFixed(0)} px из -220, после отпускания ${(y2 - rel2).toFixed(0)} px`);
  // свайп, начатый прямо на кружке уровня (кнопке), — карта едет, уровень не открывается
  await sleep(300);
  const node = await page.evaluate(() => {
    const vh = window.innerHeight;
    const els = [...document.querySelectorAll('.map-node')].map((el) => el.getBoundingClientRect())
      .filter((r) => r.top > vh * 0.3 && r.bottom < vh * 0.7 && r.width > 0);
    const r = els[0]; return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  });
  if (!node) check('свайп с кнопки уровня прокручивает карту', false, 'не нашёл кружок уровня в середине экрана');
  else {
    const ys = await Y();
    const dir = ys < -200 ? 1 : -1;
    await touch(cdp, 'touchStart', [[node.x, node.y, 1]]);
    for (let i = 1; i <= 10; i++) { await touch(cdp, 'touchMove', [[node.x, node.y + dir * 15 * i, 1]]); await sleep(16); }
    const yr = await Y();
    await sleep(250);
    await touch(cdp, 'touchEnd', []);
    await sleep(300);
    const opened = await page.evaluate(() => window.__app.popups.isOpen || window.__app.screen !== 'hub');
    check('свайп с кнопки уровня прокручивает карту, уровень не открывается', Math.abs(yr - ys - dir * 150) < 3 && !opened, `сдвиг ${(yr - ys).toFixed(0)} px из ${dir * 150}; ${opened ? 'открылось окно/уровень' : 'окно не открылось'}`);
  }
  if (errors.length) console.log('  ошибки на странице:', errors.slice(0, 3));
}

// ---------- 10: нагрузка при слабом процессоре ----------
// Главный критерий — время JavaScript на кадр (логика + команды отрисовки) при прицеливании.
// Интервал кадров в безголовом Chrome — справочно: там нет видеокарты, холст растрируется программно,
// на телефоне это делает GPU.
for (const rate of [4]) {
  const { page, cdp } = await open({ save, throttle: rate });
  console.log(`Нагрузка при процессоре, замедленном в ${rate} раза (≈ недорогой телефон):`);
  await startLevel(page, level);
  const li = await launcherInfo(page);
  await page.evaluate(() => {
    const a = window.__app, e = a.engine, r = a.renderer;
    window.__m = { frames: [], js: [], handler: [] };
    let last = performance.now(), upd = 0;
    const f = (t) => { window.__m.frames.push(t - last); last = t; if (window.__m.frames.length < 400) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const u = e.update.bind(e); e.update = (dt) => { const t = performance.now(); u(dt); upd = performance.now() - t; };
    const fr = r.frame.bind(r); r.frame = (dt) => { const t = performance.now(); fr(dt); window.__m.js.push(upd + performance.now() - t); upd = 0; };
    const pm = e.pointerMove.bind(e); e.pointerMove = (...x) => { const t = performance.now(); pm(...x); window.__m.handler.push(performance.now() - t); };
  });
  await touch(cdp, 'touchStart', [ray(li, 150).concat(1)]);
  const t0 = Date.now();
  for (let i = 0; i < 120; i++) {
    const deg = 150 - (i % 60) * 2;
    await touch(cdp, 'touchMove', [ray(li, deg).concat(1)]);
    const wait = t0 + (i + 1) * 16 - Date.now();
    if (wait > 0) await sleep(wait);
  }
  await touch(cdp, 'touchCancel', []);
  const m = await page.evaluate(() => {
    const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0; };
    const M = window.__m, fr = M.frames.slice(5);
    return { js50: q(M.js, 0.5), js95: q(M.js, 0.95), jsMax: Math.max(...M.js), f50: q(fr, 0.5), f95: q(fr, 0.95), h50: q(M.handler, 0.5), h95: q(M.handler, 0.95) };
  });
  // Пороги ловят регрессию в коде, а не колебания песочницы: на 2 ядрах с программной отрисовкой часть растеризации
  // холста попадает в замер JS. Сравнение «до/после» на одной машине (18.10.2026): прежняя версия — 95% 9,6–10,3 мс,
  // текущая — 6,6–9,4 мс. 12 мс при замедлении ×4 — всё ещё меньше бюджета кадра 16,7 мс.
  check(`прицеливание при замедлении ×${rate}: JS на кадр — медиана ≤ 4 мс, 95% ≤ 12 мс`, m.js50 <= 4 && m.js95 <= 12,
    `JS на кадр: медиана ${m.js50.toFixed(2)} мс, 95% ${m.js95.toFixed(2)} мс, макс ${m.jsMax.toFixed(1)} мс (бюджет кадра 16,7); обработка движения пальца: 95% ${m.h95.toFixed(2)} мс; ` +
    `справочно, интервал кадров без GPU: медиана ${m.f50.toFixed(1)} мс, 95% ${m.f95.toFixed(1)} мс`);
}

await browser.close();
if (srv) srv.stop();
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `Итого: ${results.length - bad} ✓, ${bad} ✗` : `Итого: все ${results.length} проверок ✓`);
process.exit(bad ? 1 : 0);
