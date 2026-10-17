import {
  COLS, D, R, ROW_H, FIELD_W, HIT_DIST,
  T_NORMAL, T_KITTEN, T_STONE, T_BOMB,
} from './constants.js';

let nextId = 1;

export function makeBubble(color, type = T_NORMAL, kitten = 0) {
  return { id: nextId++, color, type, kitten, r: 0, c: 0 };
}

/** Можно ли шарик собрать в группу по цвету */
export const isColored = (b) => !!b && b.color >= 0 && (b.type === T_NORMAL || b.type === T_KITTEN);

/**
 * Гексагональная сетка со смещёнными рядами.
 * Ряд считается «сдвинутым» (на R вправо, COLS-1 ячеек), если (r + shift) нечётно.
 */
export class Board {
  constructor(shift = 0) {
    this.rows = [];
    this.shift = shift;
  }

  clone() {
    const b = new Board(this.shift);
    b.rows = this.rows.map((row) => row.map((x) => (x ? { ...x } : null)));
    return b;
  }

  isShifted(r) { return ((r + this.shift) & 1) === 1; }
  colsIn(r) { return this.isShifted(r) ? COLS - 1 : COLS; }
  valid(r, c) { return r >= 0 && c >= 0 && c < this.colsIn(r); }

  get(r, c) {
    if (r < 0 || r >= this.rows.length || c < 0 || c >= COLS) return null;
    return this.rows[r][c];
  }

  ensureRows(n) {
    while (this.rows.length < n) this.rows.push(new Array(COLS).fill(null));
  }

  set(r, c, b) {
    this.ensureRows(r + 1);
    this.rows[r][c] = b;
    if (b) { b.r = r; b.c = c; }
  }

  remove(b) {
    if (b && this.rows[b.r] && this.rows[b.r][b.c] === b) this.rows[b.r][b.c] = null;
  }

  x(r, c) { return R + c * D + (this.isShifted(r) ? R : 0); }
  y(r) { return R + r * ROW_H; }

  neighbors(r, c) {
    const res = [];
    if (this.isShifted(r)) {
      this._addN(res, r, c - 1); this._addN(res, r, c + 1);
      this._addN(res, r - 1, c); this._addN(res, r - 1, c + 1);
      this._addN(res, r + 1, c); this._addN(res, r + 1, c + 1);
    } else {
      this._addN(res, r, c - 1); this._addN(res, r, c + 1);
      this._addN(res, r - 1, c - 1); this._addN(res, r - 1, c);
      this._addN(res, r + 1, c - 1); this._addN(res, r + 1, c);
    }
    return res;
  }

  _addN(res, r, c) { if (this.valid(r, c)) res.push(r, c); }

  hasNeighbor(r, c) {
    const n = this.neighbors(r, c);
    for (let i = 0; i < n.length; i += 2) if (this.get(n[i], n[i + 1])) return true;
    return false;
  }

  forEach(fn) {
    for (let r = 0; r < this.rows.length; r++) {
      const row = this.rows[r];
      for (let c = 0; c < COLS; c++) if (row[c]) fn(row[c], r, c);
    }
  }

  all() { const a = []; this.forEach((b) => a.push(b)); return a; }

  count() { let n = 0; this.forEach(() => n++); return n; }

  countWhere(pred) { let n = 0; this.forEach((b) => { if (pred(b)) n++; }); return n; }

  lowestRow() {
    for (let r = this.rows.length - 1; r >= 0; r--) {
      if (this.rows[r].some(Boolean)) return r;
    }
    return -1;
  }

  trim() {
    while (this.rows.length && !this.rows[this.rows.length - 1].some(Boolean)) this.rows.pop();
  }

  /** Цвета, которые сейчас есть на поле (для выдачи шариков в пушку) */
  colorsPresent() {
    const set = new Set();
    this.forEach((b) => { if (isColored(b)) set.add(b.color); });
    return [...set].sort((a, b) => a - b);
  }

  /** Связная группа одного цвета, начиная с (r, c) */
  cluster(r0, c0, color) {
    const start = this.get(r0, c0);
    if (!start) return [];
    const seen = new Set([r0 * COLS + c0]);
    const out = [start];
    const stack = [r0, c0];
    while (stack.length) {
      const c = stack.pop(); const r = stack.pop();
      const n = this.neighbors(r, c);
      for (let i = 0; i < n.length; i += 2) {
        const nr = n[i], nc = n[i + 1];
        const k = nr * COLS + nc;
        if (seen.has(k)) continue;
        const b = this.get(nr, nc);
        if (b && isColored(b) && b.color === color) {
          seen.add(k); out.push(b); stack.push(nr, nc);
        }
      }
    }
    return out;
  }

  /** Шарики, не связанные с потолком (ряд 0) */
  floating() {
    const seen = new Set();
    const stack = [];
    if (this.rows.length) {
      for (let c = 0; c < COLS; c++) {
        if (this.rows[0][c]) { seen.add(c); stack.push(0, c); }
      }
    }
    while (stack.length) {
      const c = stack.pop(); const r = stack.pop();
      const n = this.neighbors(r, c);
      for (let i = 0; i < n.length; i += 2) {
        const nr = n[i], nc = n[i + 1];
        const k = nr * COLS + nc;
        if (!seen.has(k) && this.get(nr, nc)) { seen.add(k); stack.push(nr, nc); }
      }
    }
    const out = [];
    this.forEach((b, r, c) => { if (!seen.has(r * COLS + c)) out.push(b); });
    return out;
  }

  /** Ближайшая свободная «прикреплённая» ячейка к точке (x, y) */
  snapCell(x, y) {
    const rEst = Math.round((y - R) / ROW_H);
    for (let rad = 1; rad <= 3; rad++) {
      let best = null, bestD = Infinity;
      for (let r = Math.max(0, rEst - rad); r <= rEst + rad; r++) {
        const cEst = Math.round((x - R - (this.isShifted(r) ? R : 0)) / D);
        for (let c = cEst - rad; c <= cEst + rad; c++) {
          if (!this.valid(r, c) || this.get(r, c)) continue;
          if (r > 0 && !this.hasNeighbor(r, c)) continue;
          const dx = this.x(r, c) - x, dy = this.y(r) - y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = [r, c]; }
        }
      }
      if (best) return best;
    }
    // Запасной вариант: любая свободная прикреплённая ячейка (на практике не нужен)
    let best = null, bestD = Infinity;
    const maxR = this.rows.length + 1;
    for (let r = 0; r <= maxR; r++) {
      for (let c = 0; c < this.colsIn(r); c++) {
        if (this.get(r, c) || (r > 0 && !this.hasNeighbor(r, c))) continue;
        const dx = this.x(r, c) - x, dy = this.y(r) - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = [r, c]; }
      }
    }
    return best || [0, 0];
  }

  /** Добавить новый ряд сверху (бесконечный режим) */
  pushRowTop(makeCell) {
    this.shift ^= 1;
    const row = new Array(COLS).fill(null);
    this.rows.unshift(row);
    for (let r = 1; r < this.rows.length; r++) {
      for (let c = 0; c < COLS; c++) { const b = this.rows[r][c]; if (b) { b.r = r; b.c = c; } }
    }
    for (let c = 0; c < this.colsIn(0); c++) {
      const b = makeCell(c);
      if (b) this.set(0, c, b);
    }
  }
}

/**
 * Трассировка выстрела. Возвращает путь (ломаную с отскоками) и ячейку, куда прилипнет шарик.
 * angle — угол от оси X против часовой стрелки (PI/2 — строго вверх).
 */
export function traceShot(board, x0, y0, angle, maxLen = 6000) {
  let x = x0, y = y0;
  let vx = Math.cos(angle), vy = -Math.sin(angle);
  const step = R * 0.45;
  const pts = [x, y];
  const thr2 = HIT_DIST * HIT_DIST;
  const maxSteps = Math.ceil(maxLen / step);
  const left = R, right = FIELD_W - R;
  for (let i = 0; i < maxSteps; i++) {
    const px = x, py = y;
    x += vx * step; y += vy * step;
    if (x < left) {
      const f = (px - left) / (px - x);
      pts.push(left, py + (y - py) * f);
      x = 2 * left - x; vx = -vx;
    } else if (x > right) {
      const f = (right - px) / (x - px);
      pts.push(right, py + (y - py) * f);
      x = 2 * right - x; vx = -vx;
    }
    if (y <= R) {
      y = R;
      pts.push(x, y);
      const cell = board.snapCell(x, y);
      return { pts, cell, hit: null, x, y };
    }
    const hit = collide(board, x, y, thr2);
    if (hit) {
      pts.push(x, y);
      const cell = board.snapCell(x, y);
      return { pts, cell, hit, x, y };
    }
  }
  pts.push(x, y);
  return { pts, cell: board.snapCell(x, y), hit: null, x, y };
}

function collide(board, x, y, thr2) {
  const rEst = Math.round((y - R) / ROW_H);
  for (let r = rEst - 1; r <= rEst + 1; r++) {
    if (r < 0 || r >= board.rows.length) continue;
    const row = board.rows[r];
    const shifted = board.isShifted(r);
    const cEst = Math.round((x - R - (shifted ? R : 0)) / D);
    for (let c = cEst - 1; c <= cEst + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      const b = row[c];
      if (!b) continue;
      const dx = R + c * D + (shifted ? R : 0) - x;
      const dy = R + r * ROW_H - y;
      if (dx * dx + dy * dy < thr2) return b;
    }
  }
  return null;
}

/**
 * Трассировка огненного шара: летит до потолка, сжигая всё на пути.
 * Возвращает путь и список сожжённых шариков в порядке касания (с длиной пути до касания).
 */
export function traceFire(board, x0, y0, angle) {
  let x = x0, y = y0;
  let vx = Math.cos(angle), vy = -Math.sin(angle);
  const step = R * 0.45;
  const pts = [x, y];
  const burned = [];
  const seen = new Set();
  const thr2 = (D * 0.92) ** 2;
  const left = R, right = FIELD_W - R;
  let dist = 0;
  for (let i = 0; i < 20000; i++) {
    const px = x, py = y;
    x += vx * step; y += vy * step; dist += step;
    if (x < left) {
      const f = (px - left) / (px - x);
      pts.push(left, py + (y - py) * f);
      x = 2 * left - x; vx = -vx;
    } else if (x > right) {
      const f = (right - px) / (x - px);
      pts.push(right, py + (y - py) * f);
      x = 2 * right - x; vx = -vx;
    }
    const rEst = Math.round((y - R) / ROW_H);
    for (let r = rEst - 1; r <= rEst + 1; r++) {
      if (r < 0 || r >= board.rows.length) continue;
      for (let c = 0; c < COLS; c++) {
        const b = board.rows[r][c];
        if (!b || seen.has(b.id)) continue;
        const dx = board.x(r, c) - x, dy = board.y(r) - y;
        if (dx * dx + dy * dy < thr2) { seen.add(b.id); burned.push({ b, dist }); }
      }
    }
    if (y < -R * 2) break;
  }
  pts.push(x, y);
  return { pts, burned };
}

/** Длина ломаной */
export function pathLength(pts) {
  let len = 0;
  for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return len;
}

/** Точка на ломаной на расстоянии dist от начала */
export function pointAt(pts, dist) {
  let acc = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const seg = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (acc + seg >= dist) {
      const t = seg > 0 ? (dist - acc) / seg : 0;
      return [pts[i - 2] + (pts[i] - pts[i - 2]) * t, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * t];
    }
    acc += seg;
  }
  return [pts[pts.length - 2], pts[pts.length - 1]];
}

export { T_NORMAL, T_KITTEN, T_STONE, T_BOMB };
