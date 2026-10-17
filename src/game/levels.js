import { COLS, PALETTE, T_NORMAL, T_KITTEN, T_STONE, T_BOMB, KITTEN_FURS } from './constants.js';
import { Board, makeBubble } from './board.js';
import { mulberry32, randInt, pick, shuffle, clamp } from '../core/rng.js';
import { simulateGames, balanceFromRuns } from './bot.js';
import { LEVEL_TABLE } from './level-table.js';

export const LEVELS_PER_WORLD = 15;
export const WORLD_COUNT = 8;

export const worldOf = (n) => Math.floor((n - 1) / LEVELS_PER_WORLD) % WORLD_COUNT;

// ---------- Формы уровней ----------
// u — горизонталь [0..1], v — вертикаль [0..1] (0 — верхний ряд)
const SHAPES = {
  rect: { f: () => true },
  pyramid: { f: (u, v) => Math.abs(u - 0.5) <= 0.52 - v * 0.34 },
  vshape: { f: (u, v) => v <= 0.38 + 1.35 * Math.abs(u - 0.5) },
  arch: { f: (u, v) => v <= 1.02 - 1.25 * Math.abs(u - 0.5) },
  diamond: { f: (u, v) => Math.abs(u - 0.5) * 1.9 + Math.abs(v - 0.45) * 1.5 <= 1.0, top: true },
  heart: {
    f: (u, v) => {
      const x = (u - 0.5) * 2.7, y = (0.62 - v) * 2.5;
      const a = x * x + y * y - 1;
      return a * a * a - x * x * y * y * y <= 0;
    },
    top: true,
  },
  circle: { f: (u, v) => (u - 0.5) ** 2 + ((v - 0.5) * 0.9) ** 2 <= 0.25, top: true },
  towers: { f: (u, v) => v < 0.22 || Math.floor(u * 5.5) % 2 === 0 },
  waves: { f: (u, v, p) => v <= 0.6 + 0.38 * Math.sin(u * Math.PI * 3 + p) },
  holes: { f: (u, v, p, r, c) => r === 0 || ((r * 7 + c * 3 + Math.floor(p * 10)) % 9) !== 0 },
  diag: { f: (u, v, p, r, c) => r < 1 || ((r + c + Math.floor(p * 4)) % 5) !== 4 },
  hourglass: { f: (u, v) => Math.abs(u - 0.5) <= 0.14 + 0.72 * Math.abs(v - 0.5) },
  columns: { f: (u, v, p, r, c) => r < 2 || (c % 3) !== 1 },
};

const EARLY_SHAPES = ['rect', 'pyramid', 'arch', 'vshape'];
const MID_SHAPES = ['rect', 'pyramid', 'arch', 'vshape', 'waves', 'towers', 'diamond', 'heart', 'circle', 'holes'];
const LATE_SHAPES = Object.keys(SHAPES);

/** Параметры уровня n (детерминированно) */
export function levelParams(n) {
  const rnd = mulberry32((n * 2654435761) ^ 0x5bd1e995);
  const breather = n > 5 && n % 5 === 0;
  const spike = n > 12 && n % 10 === 8;
  const tier = Math.min(n, 120);

  let colors;
  if (n <= 2) colors = 3;
  else if (n <= 7) colors = 4;
  else if (n <= 24) colors = 5;
  else if (n <= 60) colors = rnd() < 0.5 ? 5 : 6;
  else colors = rnd() < 0.3 ? 5 : 6;
  if (breather && colors > 4) colors -= 1;

  let goal;
  if (n === 1) goal = 'clear';
  else if (n === 2) goal = 'kittens';
  else if (n === 3) goal = 'clear';
  else goal = rnd() < 0.3 ? 'clear' : 'kittens';

  let rows = 4 + Math.floor(tier / 9) + randInt(rnd, 0, 1);
  if (n <= 3) rows = 4 + (n > 1 ? 1 : 0);
  if (breather) rows -= 2;
  if (spike) rows += 1;
  rows = clamp(rows, 4, goal === 'clear' ? 9 : 12);

  const shapePool = n <= 6 ? EARLY_SHAPES : n <= 30 ? MID_SHAPES : LATE_SHAPES;
  const shape = n <= 2 ? 'rect' : pick(rnd, shapePool);

  // Стратегия раскраски и размеры кластеров (чем больше кластеры — тем проще)
  let coloring = n <= 4 ? 'bands' : pick(rnd, ['clusters', 'clusters', 'clusters', 'bands', 'diag', 'columns']);
  let clMin = 2, clMax = 4;
  if (n <= 6) { clMin = 3; clMax = 5; }
  else if (n <= 25) { clMin = 2; clMax = 4; }
  else if (n <= 60) { clMin = 2; clMax = 3; }
  else { clMin = 1; clMax = 3; }
  if (breather) { clMin += 1; clMax += 1; }
  if (spike) { clMin = Math.max(1, clMin - 1); }

  const kittens = goal === 'kittens' ? clamp(2 + Math.floor(n / 9) + randInt(rnd, 0, 1), 2, 6) : 0;
  const stones = n >= 12 ? clamp(Math.floor((n - 6) / 14) + randInt(rnd, 0, 1), 0, 6) : 0;
  const bombs = n >= 7 ? (rnd() < 0.45 ? 1 : 0) + (n >= 25 && rnd() < 0.3 ? 1 : 0) : 0;

  // Набор цветов уровня — случайное подмножество палитры
  const order = shuffle(rnd, PALETTE.map((_, i) => i));
  const palette = order.slice(0, colors).sort((a, b) => a - b);

  return {
    n, rnd, colors, palette, goal, rows, shape, coloring, clMin, clMax,
    kittens, stones, bombs, breather, spike, phase: rnd() * Math.PI * 2,
  };
}

/** Строит поле уровня n */
export function buildLevelBoard(n) {
  const p = levelParams(n);
  const { rnd } = p;
  const board = new Board(0);
  const shapeDef = SHAPES[p.shape];
  const mask = [];
  for (let r = 0; r < p.rows; r++) {
    mask.push([]);
    const cols = board.colsIn(r);
    for (let c = 0; c < cols; c++) {
      const u = (c + (board.isShifted(r) ? 0.5 : 0)) / (COLS - 1);
      const v = p.rows > 1 ? r / (p.rows - 1) : 0;
      let on = shapeDef.f(u, v, p.phase, r, c);
      if (shapeDef.top && r === 0) on = true;
      mask[r][c] = on;
    }
  }
  // Заполняем «заглушками» и убираем висящие в воздухе ячейки
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < board.colsIn(r); c++) if (mask[r][c]) board.set(r, c, makeBubble(0));
  }
  for (const b of board.floating()) board.remove(b);
  board.trim();
  if (board.count() < 16) {
    // Слишком мало — запасной прямоугольник
    board.rows = [];
    for (let r = 0; r < Math.max(4, p.rows - 1); r++) {
      for (let c = 0; c < board.colsIn(r); c++) board.set(r, c, makeBubble(0));
    }
  }

  colorize(board, p);
  placeSpecials(board, p);
  return { board, params: p };
}

function colorize(board, p) {
  const { rnd, palette } = p;
  const k = palette.length;
  const cells = board.all();
  const assigned = new Set();
  const setColor = (b, ci) => { b.color = palette[ci % k]; assigned.add(b.id); };

  if (p.coloring === 'bands') {
    // Горизонтальные полосы из отрезков разной длины
    const ord = shuffle(rnd, palette.map((_, i) => i));
    let idx = randInt(rnd, 0, k - 1);
    for (let r = 0; r < board.rows.length; r++) {
      let left = 0;
      for (let c = 0; c < board.colsIn(r); c++) {
        const b = board.get(r, c);
        if (left <= 0) { idx = (idx + 1 + (rnd() < 0.3 ? 1 : 0)) % k; left = randInt(rnd, p.clMin + 1, p.clMax + 2); }
        left--;
        if (!b) continue;
        let ci = ord[idx];
        if (rnd() < 0.08) ci = randInt(rnd, 0, k - 1);
        setColor(b, ci);
      }
    }
  } else if (p.coloring === 'columns') {
    const w = randInt(rnd, 2, 3);
    const ord = shuffle(rnd, palette.map((_, i) => i));
    for (const b of cells) {
      let ci = ord[Math.floor((b.c + (board.isShifted(b.r) ? 0.5 : 0)) / w) % k];
      if (rnd() < 0.15) ci = randInt(rnd, 0, k - 1);
      setColor(b, ci);
    }
  } else if (p.coloring === 'diag') {
    // Диагональные полосы шириной w шариков
    const w = randInt(rnd, 2, 3);
    const dir = rnd() < 0.5 ? 1 : -1;
    const ord = shuffle(rnd, palette.map((_, i) => i));
    for (const b of cells) {
      const u2 = 2 * b.c + (board.isShifted(b.r) ? 1 : 0);
      const d = u2 + dir * b.r + 200;
      let ci = ord[Math.floor(d / (2 * w)) % k];
      if (rnd() < 0.1) ci = randInt(rnd, 0, k - 1);
      setColor(b, ci);
    }
  } else {
    // Кластеры: заливаем случайные связные пятна
    shuffle(rnd, cells);
    let last = -1;
    for (const start of cells) {
      if (assigned.has(start.id)) continue;
      let ci = randInt(rnd, 0, k - 1);
      if (ci === last && k > 1) ci = (ci + 1) % k;
      last = ci;
      const size = randInt(rnd, p.clMin, p.clMax);
      const queue = [start];
      let placed = 0;
      while (queue.length && placed < size) {
        const idx = Math.floor(rnd() * queue.length);
        const b = queue.splice(idx, 1)[0];
        if (assigned.has(b.id)) continue;
        setColor(b, ci);
        placed++;
        const n = board.neighbors(b.r, b.c);
        for (let i = 0; i < n.length; i += 2) {
          const nb = board.get(n[i], n[i + 1]);
          if (nb && !assigned.has(nb.id)) queue.push(nb);
        }
      }
    }
  }
}

function placeSpecials(board, p) {
  const { rnd } = p;
  const all = board.all();
  const kittenCells = [];

  if (p.kittens > 0) {
    const depth = board.lowestRow() + 1;
    const maxRow = Math.max(1, Math.floor(depth * (p.n > 20 ? 0.5 : 0.4)));
    let cand = all.filter((b) => b.r <= maxRow);
    if (cand.length < p.kittens) cand = all.slice();
    // Разносим котят по полю: «самая далёкая точка» с заметной случайностью
    const chosen = [pick(rnd, cand)];
    while (chosen.length < p.kittens && chosen.length < cand.length) {
      let best = null, bestD = -1;
      for (const b of cand) {
        if (chosen.includes(b)) continue;
        let dmin = Infinity;
        for (const c of chosen) {
          const dx = board.x(b.r, b.c) - board.x(c.r, c.c);
          const dy = board.y(b.r) - board.y(c.r);
          dmin = Math.min(dmin, Math.sqrt(dx * dx + dy * dy));
        }
        const score = Math.min(dmin, 150) + rnd() * 90;
        if (score > bestD) { bestD = score; best = b; }
      }
      if (!best) break;
      chosen.push(best);
    }
    for (const b of chosen) {
      b.type = T_KITTEN;
      b.kitten = randInt(rnd, 0, KITTEN_FURS.length - 1);
      kittenCells.push(b);
    }
  }

  const nearKitten = (b) => kittenCells.some((k) => {
    const n = board.neighbors(k.r, k.c);
    for (let i = 0; i < n.length; i += 2) if (n[i] === b.r && n[i + 1] === b.c) return true;
    return false;
  });

  const free = shuffle(rnd, all.filter((b) => b.type === T_NORMAL && b.r >= 1));
  let stones = p.stones;
  for (const b of free) {
    if (stones <= 0) break;
    if (nearKitten(b)) continue;
    // не делаем камни в последнем ряду обвала слишком часто — просто ставим
    b.type = T_STONE; b.color = -1;
    stones--;
  }
  let bombs = p.bombs;
  for (const b of free) {
    if (bombs <= 0) break;
    if (b.type !== T_NORMAL || b.r < 2) continue;
    b.type = T_BOMB; b.color = -1;
    bombs--;
  }
}

// ---------- Калибровка ходов и звёзд ----------

const cache = new Map();

/**
 * Полная информация об уровне: поле, лимит выстрелов, пороги звёзд.
 * Баланс заранее рассчитан ботом (tools/gen-level-table.mjs → level-table.js),
 * для уровней за пределами таблицы считается на лету.
 */
export function getLevel(n) {
  if (!cache.has(n)) {
    const { board, params } = buildLevelBoard(n);
    let bal;
    const row = LEVEL_TABLE[n - 1];
    if (row) bal = { shots: row[0], s2: row[1] * 10, s3: row[2] * 10, med: 0 };
    else bal = balanceFromRuns(n, params, simulateGames(board, params, 5, n * 31 + 7));
    cache.set(n, {
      n, params, shots: bal.shots, stars: [0, bal.s2, bal.s3], bubbles: board.count(), kittens: params.kittens,
      goal: params.goal, colors: params.colors, world: worldOf(n), boardJSON: serializeBoard(board),
    });
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  const info = cache.get(n);
  return { ...info, board: deserializeBoard(info.boardJSON) };
}

export function serializeBoard(board) {
  return {
    shift: board.shift,
    rows: board.rows.map((row) => row.map((b) => (b ? [b.color, b.type, b.kitten] : 0))),
  };
}

export function deserializeBoard(data) {
  const board = new Board(data.shift);
  data.rows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell) board.set(r, c, makeBubble(cell[0], cell[1], cell[2]));
  }));
  board.ensureRows(data.rows.length);
  board.trim();
  return board;
}
