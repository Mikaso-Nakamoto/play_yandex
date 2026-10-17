import { D, T_KITTEN, T_BOMB, S_BOMB, S_RAINBOW, PTS_POP, PTS_DROP, PTS_KITTEN } from './constants.js';
import { makeBubble, isColored } from './board.js';

/**
 * Применяет результат выстрела к полю (мутирует board).
 * Возвращает подробный результат для анимаций и подсчёта очков.
 */
export function resolveShot(board, r, c, color, special) {
  const res = {
    origin: [r, c], placed: null, popped: [], exploded: [], dropped: [],
    kittens: 0, score: 0, special: special || '', removedColored: 0,
  };
  const cx = board.x(r, c), cy = board.y(r);
  const removed = new Set();
  const bombQueue = [];

  const take = (b, list) => {
    if (!b || removed.has(b.id)) return;
    removed.add(b.id);
    list.push(b);
    if (b.type === T_BOMB) bombQueue.push(b);
  };

  if (special === S_BOMB) {
    // Взрыв бустера-бомбы: два кольца вокруг точки попадания
    const lim = (D * 2.05) ** 2;
    const hits = [];
    board.forEach((b, br, bc) => {
      const dx = board.x(br, bc) - cx, dy = board.y(br) - cy;
      const d = dx * dx + dy * dy;
      if (d <= lim) hits.push({ b, d });
    });
    hits.sort((a, b) => a.d - b.d);
    for (const h of hits) take(h.b, res.exploded);
  } else if (special === S_RAINBOW) {
    // Радуга: лопает все цветные группы, которых касается
    const n = board.neighbors(r, c);
    for (let i = 0; i < n.length; i += 2) {
      const nb = board.get(n[i], n[i + 1]);
      if (!isColored(nb) || removed.has(nb.id)) continue;
      const cl = board.cluster(n[i], n[i + 1], nb.color);
      sortByDist(board, cl, cx, cy);
      for (const b of cl) take(b, res.popped);
    }
    // соседние бомбы тоже срабатывают
    for (let i = 0; i < n.length; i += 2) {
      const nb = board.get(n[i], n[i + 1]);
      if (nb && nb.type === T_BOMB) take(nb, res.exploded);
    }
  } else {
    const b = makeBubble(color);
    board.set(r, c, b);
    res.placed = b;
    const cl = board.cluster(r, c, color);
    if (cl.length >= 3) {
      sortByDist(board, cl, cx, cy);
      for (const x of cl) take(x, res.popped);
    }
    // Бомба на поле срабатывает, если рядом прилип шарик
    const n = board.neighbors(r, c);
    for (let i = 0; i < n.length; i += 2) {
      const nb = board.get(n[i], n[i + 1]);
      if (nb && nb.type === T_BOMB) take(nb, res.exploded);
    }
    // ...или если лопнула соседняя группа
    if (res.popped.length) {
      for (const p of res.popped) {
        const pn = board.neighbors(p.r, p.c);
        for (let i = 0; i < pn.length; i += 2) {
          const nb = board.get(pn[i], pn[i + 1]);
          if (nb && nb.type === T_BOMB) take(nb, res.exploded);
        }
      }
    }
  }

  // Цепочка взрывов бомб на поле (радиус — одно кольцо)
  chainBombs(board, bombQueue, removed, res.exploded, take);

  for (const b of res.popped) board.remove(b);
  for (const b of res.exploded) board.remove(b);

  res.dropped = board.floating();
  for (const b of res.dropped) board.remove(b);
  board.trim();

  finalizeScore(res);
  return res;
}

/** Огненный шар: сжигает список шариков (в порядке касания) */
export function resolveFire(board, burnedList) {
  const res = {
    origin: null, placed: null, popped: [], exploded: [], dropped: [],
    kittens: 0, score: 0, special: 'fire', removedColored: 0, burnDist: new Map(),
  };
  const removed = new Set();
  const bombQueue = [];
  const take = (b, list) => {
    if (!b || removed.has(b.id)) return;
    removed.add(b.id);
    list.push(b);
    if (b.type === T_BOMB) bombQueue.push(b);
  };
  for (const { b, dist } of burnedList) { take(b, res.exploded); res.burnDist.set(b.id, dist); }
  chainBombs(board, bombQueue, removed, res.exploded, take);
  for (const b of res.exploded) board.remove(b);
  res.dropped = board.floating();
  for (const b of res.dropped) board.remove(b);
  board.trim();
  finalizeScore(res);
  return res;
}

function chainBombs(board, queue, removed, list, take) {
  const lim = (D * 1.05) ** 2;
  while (queue.length) {
    const bomb = queue.shift();
    const bx = board.x(bomb.r, bomb.c), by = board.y(bomb.r);
    const hits = [];
    board.forEach((b, br, bc) => {
      if (removed.has(b.id)) return;
      const dx = board.x(br, bc) - bx, dy = board.y(br) - by;
      if (dx * dx + dy * dy <= lim) hits.push(b);
    });
    for (const h of hits) take(h, list);
  }
}

function sortByDist(board, list, cx, cy) {
  list.sort((a, b) => {
    const da = (board.x(a.r, a.c) - cx) ** 2 + (board.y(a.r) - cy) ** 2;
    const db = (board.x(b.r, b.c) - cx) ** 2 + (board.y(b.r) - cy) ** 2;
    return da - db;
  });
}

function finalizeScore(res) {
  let k = 0, colored = 0;
  for (const b of res.popped) { if (b.type === T_KITTEN) k++; if (isColored(b)) colored++; }
  for (const b of res.exploded) { if (b.type === T_KITTEN) k++; if (isColored(b)) colored++; }
  for (const b of res.dropped) { if (b.type === T_KITTEN) k++; if (isColored(b)) colored++; }
  res.kittens = k;
  res.removedColored = colored;
  const nPop = res.popped.length + res.exploded.length;
  const nDrop = res.dropped.length;
  // Бонус за крупные группы и обвалы
  const popBonus = nPop >= 6 ? (nPop - 5) * 5 : 0;
  const dropBonus = nDrop >= 4 ? (nDrop - 3) * 10 : 0;
  res.score = nPop * PTS_POP + popBonus + nDrop * PTS_DROP + dropBonus + k * PTS_KITTEN;
}

/** Сколько всего шариков удалено */
export const removedCount = (res) => res.popped.length + res.exploded.length + res.dropped.length;
