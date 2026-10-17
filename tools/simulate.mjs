// Прогон генератора уровней и бота: проверка проходимости и баланса.
// Запуск: node tools/simulate.mjs [from] [to]
import { getLevel } from '../src/game/levels.js';
import { simulateGames } from '../src/game/bot.js';

const from = Number(process.argv[2] || 1);
const to = Number(process.argv[3] || 40);

function renderBoard(board) {
  const sym = (b) => {
    if (!b) return '.';
    if (b.type === 1) return 'K';
    if (b.type === 2) return '#';
    if (b.type === 3) return '*';
    return 'rygbpcm'[b.color];
  };
  return board.rows.map((row, r) => (board.isShifted(r) ? ' ' : '') + row.slice(0, board.colsIn(r)).map(sym).join(' ')).join('\n');
}

let totalMs = 0;
const rows = [];
for (let n = from; n <= to; n++) {
  const t0 = performance.now();
  const lvl = getLevel(n);
  const ms = performance.now() - t0;
  totalMs += ms;
  // Независимая проверка: «игрок» с другим сидом и более сильным шумом, с лимитом выстрелов
  const check = simulateGames(lvl.board, lvl.params, 20, 99991 + n * 7, lvl.shots);
  rows.push({
    n, goal: lvl.goal, colors: lvl.colors, shape: lvl.params.shape, col: lvl.params.coloring,
    bubbles: lvl.bubbles, kittens: lvl.kittens, botMed: lvl.botMedian, shots: lvl.shots,
    winWithLimit: Math.round(check.winRate * 100) + '%', ms: Math.round(ms),
  });
  if (process.env.SHOW) { console.log(`\n#${n} ${lvl.goal} shots=${lvl.shots}`); console.log(renderBoard(lvl.board)); }
}
console.table(rows);
console.log('avg gen ms', (totalMs / (to - from + 1)).toFixed(1));
