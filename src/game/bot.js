import {
  FIELD_W, MIN_ANGLE, VIEW_MIN_H, LAUNCH_FROM_BOTTOM, cameraTarget, T_KITTEN, PTS_DROP, PTS_SHOT_LEFT,
} from './constants.js';
import { traceShot, isColored } from './board.js';
import { resolveShot } from './rules.js';
import { mulberry32 } from '../core/rng.js';

const ANGLES = [];
{
  const N = 72;
  for (let i = 0; i <= N; i++) ANGLES.push(MIN_ANGLE + (Math.PI - 2 * MIN_ANGLE) * (i / N));
}

/** Позиция пушки в мировых координатах для данного поля (минимальный экран) */
export function launcherPos(board, viewH = VIEW_MIN_H) {
  const cam = cameraTarget(board.lowestRow(), viewH);
  return [FIELD_W / 2, cam + viewH - LAUNCH_FROM_BOTTOM];
}

const bounces = (pts) => pts.length / 2 - 2;

/**
 * Выбор лучшего выстрела «человекоподобным» жадным ботом.
 * Возвращает { angle, swap, cell, score }.
 */
export function chooseShot(board, cur, next, goal, rnd, noise = 0.25, launch = null) {
  const [lx, ly] = launch || launcherPos(board);
  const options = [];
  const colorsToTry = next !== cur && next >= 0 ? [[cur, false], [next, true]] : [[cur, false]];
  const lowest = board.lowestRow();
  for (const [color, swap] of colorsToTry) {
    const seenCells = new Set();
    for (const a of ANGLES) {
      const tr = traceShot(board, lx, ly, a);
      if (bounces(tr.pts) > 1) continue;               // человек редко бьёт с двумя отскоками
      const key = tr.cell[0] * 100 + tr.cell[1];
      if (seenCells.has(key)) continue;
      seenCells.add(key);
      const sim = board.clone();
      const res = resolveShot(sim, tr.cell[0], tr.cell[1], color, '');
      let score = res.removedColored + res.dropped.length * 0.6 + res.exploded.length * 0.8;
      if (goal === 'kittens') score += res.kittens * 6;
      if (res.removedColored === 0 && res.exploded.length === 0) {
        // Нет совпадения: предпочитаем ставить рядом с тем же цветом и повыше
        const n = sim.neighbors(tr.cell[0], tr.cell[1]);
        let same = 0;
        for (let i = 0; i < n.length; i += 2) {
          const nb = sim.get(n[i], n[i + 1]);
          if (isColored(nb) && nb.color === color) same++;
        }
        score = same * 0.45 - Math.max(0, tr.cell[0] - lowest) * 0.35;
      }
      options.push({ angle: a, swap, cell: tr.cell, score, res });
    }
  }
  if (!options.length) return { angle: Math.PI / 2, swap: false, cell: [0, 5], score: 0 };
  options.sort((a, b) => b.score - a.score);
  // Небольшая «человечность»: иногда выбираем не самый лучший вариант
  if (rnd && rnd() < noise && options.length > 1) {
    const k = Math.min(options.length, 3);
    return options[1 + Math.floor(rnd() * (k - 1))];
  }
  return options[0];
}

function randomColor(board, rnd) {
  const cols = board.colorsPresent();
  if (!cols.length) return 0;
  return cols[Math.floor(rnd() * cols.length)];
}

const goalDone = (board, goal) =>
  goal === 'kittens' ? board.countWhere((b) => b.type === T_KITTEN) === 0 : board.count() === 0;

/** Прогоняет несколько партий бота: медиана выстрелов + сырые очки каждой партии */
export function simulateGames(board0, params, games = 7, seed = 1, maxShots = 140) {
  const shotsList = [];
  const runs = [];
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const rnd = mulberry32(seed + g * 1013);
    const board = board0.clone();
    let cur = randomColor(board, rnd);
    let next = randomColor(board, rnd);
    let shots = 0;
    let score = 0;
    let won = goalDone(board, params.goal);
    while (!won && shots < maxShots) {
      const choice = chooseShot(board, cur, next, params.goal, rnd);
      const color = choice.swap ? next : cur;
      const [lx, ly] = launcherPos(board);
      const tr = traceShot(board, lx, ly, choice.angle);
      const res = resolveShot(board, tr.cell[0], tr.cell[1], color, '');
      score += res.score;
      shots++;
      if (!choice.swap) cur = next;
      next = randomColor(board, rnd);
      const present = board.colorsPresent();
      if (present.length && !present.includes(cur)) cur = randomColor(board, rnd);
      won = goalDone(board, params.goal);
    }
    if (won) { wins++; score += board.count() * PTS_DROP; }
    shotsList.push(won ? shots : maxShots);
    runs.push({ shots, won, score });
  }
  shotsList.sort((a, b) => a - b);
  return {
    medianShots: shotsList[Math.floor(shotsList.length / 2)],
    winRate: wins / games,
    list: shotsList,
    runs,
  };
}

/** Баланс уровня по результатам симуляции: лимит выстрелов и пороги звёзд */
export function balanceFromRuns(n, params, stats) {
  const med = stats.medianShots;
  let mult, add;
  if (n <= 3) { mult = 1.8; add = 7; }
  else if (n <= 10) { mult = 1.55; add = 5; }
  else if (n <= 20) { mult = 1.4; add = 4; }
  else if (n <= 40) { mult = 1.3; add = 3; }
  else if (n <= 80) { mult = 1.22; add = 3; }
  else { mult = 1.16; add = 2; }
  if (params.breather) { mult += 0.15; add += 2; }
  if (params.spike) { mult -= 0.06; }
  const shots = Math.max(10, Math.min(70, Math.ceil(med * mult + add)));
  // Итоговые очки партий бота с учётом бонуса за оставшиеся выстрелы
  const finals = stats.runs.filter((r) => r.won && r.shots <= shots)
    .map((r) => r.score + (shots - r.shots) * PTS_SHOT_LEFT).sort((a, b) => a - b);
  const pct = (q) => finals.length ? finals[Math.min(finals.length - 1, Math.floor(q * finals.length))] : 0;
  // Ранние уровни щедрее на звёзды
  const [q2, q3] = n <= 5 ? [0.05, 0.3] : n <= 15 ? [0.2, 0.55] : n <= 40 ? [0.3, 0.7] : [0.35, 0.75];
  let s2 = Math.round(pct(q2) / 10) * 10;
  let s3 = Math.round(pct(q3) / 10) * 10;
  if (!finals.length) { s2 = 500; s3 = 1000; }
  if (s3 < s2 + 200) s3 = s2 + 200;
  return { shots, s2, s3, med };
}
