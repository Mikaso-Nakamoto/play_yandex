// Модульные тесты игровой логики (без браузера). Запуск: node tools/test-logic.mjs
import assert from 'node:assert/strict';
import { Board, makeBubble, traceShot } from '../src/game/board.js';
import { resolveShot } from '../src/game/rules.js';
import { Engine } from '../src/game/engine.js';
import { getLevel, buildLevelBoard } from '../src/game/levels.js';
import { chooseShot } from '../src/game/bot.js';
import { COLS, R, D, ROW_H, FIELD_W, T_KITTEN, T_STONE, T_BOMB, S_BOMB, S_RAINBOW, S_FIRE, VIEW_MIN_H } from '../src/game/constants.js';
import { mulberry32 } from '../src/core/rng.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name); throw e; }
}

function boardFrom(lines) {
  // 'r'=0 'y'=1 'g'=2 'b'=3 'p'=4, K=котёнок (цвет 0), #=камень, *=бомба
  const b = new Board(0);
  lines.forEach((line, r) => {
    const cells = line.trim().split(/\s+/);
    cells.forEach((ch, c) => {
      if (ch === '.') return;
      if (ch === '#') b.set(r, c, makeBubble(-1, T_STONE));
      else if (ch === '*') b.set(r, c, makeBubble(-1, T_BOMB));
      else if (ch === 'K') b.set(r, c, makeBubble(0, T_KITTEN));
      else b.set(r, c, makeBubble('rygbp'.indexOf(ch)));
    });
  });
  return b;
}

console.log('Board');
test('соседи несдвинутого и сдвинутого ряда', () => {
  const b = new Board(0);
  b.ensureRows(3);
  const n = b.neighbors(1, 0); // ряд 1 сдвинут
  const pairs = []; for (let i = 0; i < n.length; i += 2) pairs.push(`${n[i]},${n[i + 1]}`);
  assert.deepEqual(pairs.sort(), ['0,0', '0,1', '1,1', '2,0', '2,1'].sort());
  const n2 = b.neighbors(2, 0);
  const p2 = []; for (let i = 0; i < n2.length; i += 2) p2.push(`${n2[i]},${n2[i + 1]}`);
  assert.deepEqual(p2.sort(), ['1,0', '2,1', '3,0'].sort());
  assert.equal(b.colsIn(0), COLS);
  assert.equal(b.colsIn(1), COLS - 1);
});

test('геометрия: соседние центры на расстоянии D', () => {
  const b = new Board(0);
  const d1 = Math.hypot(b.x(0, 3) - b.x(1, 3), b.y(0) - b.y(1));
  const d2 = Math.hypot(b.x(0, 4) - b.x(1, 3), b.y(0) - b.y(1));
  assert.ok(Math.abs(d1 - D) < 1e-9 && Math.abs(d2 - D) < 1e-9);
  assert.equal(b.x(0, 10) + R, FIELD_W);
});

test('кластер и висящие шарики', () => {
  const b = boardFrom([
    'r r . . . y y y y y y',
    'r g . . . . . . . .',
    'g g',
  ]);
  const cl = b.cluster(0, 0, 0);
  assert.equal(cl.length, 3);
  // Лопаем красные — зелёные повиснут
  for (const x of cl) b.remove(x);
  const fl = b.floating();
  assert.equal(fl.length, 3);
});

test('resolveShot: тройка лопается, висящие падают, котёнок освобождается', () => {
  const b = boardFrom([
    'y y y y y y y y y y y',
    'r r . . . . . . . .',
    'K b',
  ]);
  // стреляем красным в (2,?) рядом с r r: ячейка (2,2)? ряд 2 несдвинут: соседи (1,1),(1,2)
  const res = resolveShot(b, 2, 2, 0, '');
  assert.equal(res.popped.length, 4); // r r + котёнок(красный) + выстрел
  assert.equal(res.kittens, 1);
  assert.equal(res.dropped.length, 1); // синий повис
  assert.equal(b.count(), 11);
});

test('resolveShot: камень падает только обвалом', () => {
  const b = boardFrom([
    'r r . . . . . . . . .',
    '# . . . . . . . . .',
  ]);
  const res = resolveShot(b, 0, 2, 0, '');
  assert.equal(res.popped.length, 3);
  assert.equal(res.dropped.length, 1);
  assert.equal(b.count(), 0);
});

test('бомба-бустер и бомба на поле', () => {
  const b = boardFrom([
    'r y g b p r y g b p r',
    'y g b p r y g b p r',
    'g b p * y g b p r y g',
  ]);
  const before = b.count();
  const res = resolveShot(b, 3, 3, 0, S_BOMB);
  assert.ok(res.exploded.length >= 7, 'бомба должна взорвать соседей');
  assert.ok(b.count() < before);
  const b2 = boardFrom([
    'r y g b p r y g b p r',
    'y g b p r y g b p r',
    'g b p * y g b p r y g',
  ]);
  const r2 = resolveShot(b2, 3, 3, 1, ''); // жёлтый рядом с бомбой — бомба срабатывает
  assert.ok(r2.exploded.length >= 6);
});

test('радуга лопает все касающиеся группы', () => {
  const b = boardFrom([
    'r r y y g g b b p p r',
    '. . . . . . . . . .',
  ]);
  const res = resolveShot(b, 1, 1, -1, S_RAINBOW); // касается (0,1)r и (0,2)y
  assert.equal(res.popped.length, 4);
});

test('traceShot: прямой выстрел вверх прилипает к потолку по центру', () => {
  const b = new Board(0);
  const tr = traceShot(b, FIELD_W / 2, 560, Math.PI / 2);
  assert.deepEqual(tr.cell, [0, 5]);
});

test('traceShot: отскок от стены', () => {
  const b = new Board(0);
  const tr = traceShot(b, FIELD_W / 2, 560, Math.PI / 2 - 0.5);
  assert.ok(tr.pts.length >= 6, 'должна быть точка отскока');
  assert.equal(tr.cell[0], 0);
});

test('snapCell всегда возвращает свободную прикреплённую ячейку', () => {
  const rnd = mulberry32(5);
  for (let n = 1; n <= 30; n++) {
    const { board } = buildLevelBoard(n);
    for (let i = 0; i < 40; i++) {
      const a = 0.2 + rnd() * (Math.PI - 0.4);
      const tr = traceShot(board, FIELD_W / 2, 700, a);
      const [r, c] = tr.cell;
      assert.ok(board.valid(r, c), `valid ${r},${c}`);
      assert.equal(board.get(r, c), null, `empty ${r},${c} lvl ${n}`);
      assert.ok(r === 0 || board.hasNeighbor(r, c), 'attached');
    }
  }
});

console.log('Levels');
test('уровни детерминированы и связаны с потолком', () => {
  for (let n = 1; n <= 60; n++) {
    const a = buildLevelBoard(n).board;
    const b2 = buildLevelBoard(n).board;
    assert.equal(JSON.stringify(a.rows.map((r) => r.map((x) => x && [x.color, x.type]))),
      JSON.stringify(b2.rows.map((r) => r.map((x) => x && [x.color, x.type]))));
    assert.equal(a.floating().length, 0, `level ${n} has floating`);
    assert.ok(a.count() >= 16);
    // камней нет в верхнем ряду
    for (let c = 0; c < COLS; c++) { const x = a.get(0, c); assert.ok(!x || x.type !== T_STONE); }
  }
});

test('у уровня с котятами есть котята', () => {
  for (let n = 2; n <= 40; n++) {
    const L = getLevel(n);
    if (L.goal === 'kittens') assert.ok(L.board.countWhere((b) => b.type === T_KITTEN) >= 2, `lvl ${n}`);
    assert.ok(L.shots >= 10 && L.shots <= 70);
    assert.ok(L.stars[1] < L.stars[2]);
  }
});

console.log('Engine');
function playLevel(n, useBot = true) {
  const L = getLevel(n);
  const events = [];
  const eng = new Engine({ mode: 'level', level: L, onEvent: (t) => events.push(t), random: mulberry32(n) });
  eng.setViewH(VIEW_MIN_H + 100);
  let guard = 0;
  const rnd = mulberry32(n + 100);
  while (guard++ < 20000) {
    eng.update(1 / 60);
    if (eng.state === 'aim' && eng.canShoot) {
      const [lx, ly] = eng.launcher();
      const ch = chooseShot(eng.board, eng.cur, eng.next, eng.goal, rnd, 0.1, [lx, ly]);
      if (ch.swap) eng.swap();
      // Имитация пальца: нажали в точке по направлению выстрела и отпустили
      const tx = lx + Math.cos(ch.angle) * 200, ty = ly - Math.sin(ch.angle) * 200;
      eng.pointerDown(tx, ty);
      eng.pointerUp(tx, ty);
    }
    if (eng.state === 'out') eng.addShots(5);
    if (eng.state === 'won') break;
  }
  return { eng, events };
}

test('уровень 1 проходится через ввод, порядок событий корректен', () => {
  const { eng, events } = playLevel(1);
  assert.equal(eng.state, 'won');
  assert.ok(events.includes('ready'));
  assert.ok(events.includes('shoot'));
  assert.ok(events.includes('pop'));
  assert.ok(events.includes('complete'));
  assert.ok(events.indexOf('goalReached') < events.indexOf('complete'));
});

test('уровни 2..12 проходятся ботом через движок', () => {
  for (let n = 2; n <= 12; n++) {
    const { eng } = playLevel(n);
    assert.equal(eng.state, 'won', `level ${n}`);
    assert.ok(eng.score > 0);
  }
});

test('бустеры: бомба/радуга/огонь не тратят выстрел', () => {
  const L = getLevel(6);
  const eng = new Engine({ mode: 'level', level: L, random: mulberry32(1) });
  eng.setViewH(VIEW_MIN_H);
  for (let i = 0; i < 200 && eng.state !== 'aim'; i++) eng.update(1 / 60);
  for (const sp of [S_BOMB, S_RAINBOW, S_FIRE]) {
    while (!eng.canShoot) eng.update(1 / 60);
    if (eng.state !== 'aim') break;
    const shots = eng.shotsLeft;
    assert.ok(eng.activateSpecial(sp));
    const before = eng.board.count();
    // целимся в самый нижний шарик
    const low = eng.board.all().sort((a, b) => b.r - a.r)[0];
    const [lx, ly] = eng.launcher();
    const ang = Math.atan2(ly - eng.board.y(low.r), eng.board.x(low.r, low.c) - lx);
    assert.ok(eng.shoot(ang));
    for (let i = 0; i < 300 && eng.state !== 'aim' && eng.state !== 'win-seq'; i++) eng.update(1 / 60);
    assert.equal(eng.shotsLeft, shots);
    assert.ok(eng.board.count() < before, `${sp} должен убрать шарики`);
  }
});

test('выстрелы заканчиваются → состояние out, продолжение добавляет выстрелы', () => {
  const L = getLevel(20);
  L.shots = 2;
  const eng = new Engine({ mode: 'level', level: L, random: mulberry32(3) });
  eng.shotsLeft = 2;
  eng.setViewH(VIEW_MIN_H);
  let outSeen = false;
  for (let i = 0; i < 3000; i++) {
    eng.update(1 / 60);
    if (eng.canShoot) eng.shoot(Math.PI / 2 + 0.3);
    if (eng.state === 'out') { outSeen = true; break; }
  }
  assert.ok(outSeen);
  eng.addShots(5);
  assert.equal(eng.state, 'aim');
  assert.equal(eng.shotsLeft, 5);
});

test('бесконечный режим: ряды добавляются, есть проигрыш и спасение', () => {
  const eng = new Engine({ mode: 'endless', random: mulberry32(9) });
  eng.setViewH(VIEW_MIN_H);
  let pushes = 0, over = false;
  eng.onEvent = (t) => { if (t === 'push') pushes++; if (t === 'gameOver') over = true; };
  for (let i = 0; i < 40000 && !over; i++) {
    eng.update(1 / 60);
    if (eng.canShoot) eng.shoot(Math.PI / 2 + ((i * 37) % 100 - 50) / 120); // «плохой игрок»
  }
  assert.ok(pushes > 0);
  assert.ok(over);
  const low = eng.board.lowestRow();
  eng.endlessRescue(5);
  assert.equal(eng.state, 'aim');
  assert.ok(eng.board.lowestRow() < low);
});

test('кнопка-«свап» по тапу на пушку', () => {
  const L = getLevel(3);
  const eng = new Engine({ mode: 'level', level: L, random: mulberry32(4) });
  eng.setViewH(VIEW_MIN_H);
  for (let i = 0; i < 200 && eng.state !== 'aim'; i++) eng.update(1 / 60);
  eng.cur = 0; eng.next = 1;
  const [lx, ly] = eng.launcher();
  eng.pointerDown(lx, ly);
  eng.pointerUp(lx, ly);
  assert.equal(eng.cur, 1);
  assert.equal(eng.next, 0);
});


console.log('Level table');
import { LEVEL_TABLE } from '../src/game/level-table.js';
import { simulateGames, balanceFromRuns } from '../src/game/bot.js';
{
  let ok = 0;
  for (const n of [1, 2, 7, 33, 120, 487, 999]) {
    const { board, params } = buildLevelBoard(n);
    const b = balanceFromRuns(n, params, simulateGames(board, params, 9, n * 31 + 7));
    const row = LEVEL_TABLE[n - 1];
    assert.deepEqual(row, [b.shots, Math.round(b.s2 / 10), Math.round(b.s3 / 10)], `таблица устарела для уровня ${n} — запустите node tools/gen-level-table.mjs`);
    ok++;
  }
  assert.equal(LEVEL_TABLE.length, 1000);
  console.log('  ✓ таблица баланса совпадает с генератором (' + ok + ' проверок)');
}

console.log(`\nВсе тесты пройдены: ${passed + 1}`);
