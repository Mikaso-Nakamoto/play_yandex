// Предрасчёт баланса уровней ботом: лимит выстрелов и пороги звёзд.
// node tools/gen-level-table.mjs [count=1000]
import fs from 'node:fs';
import { buildLevelBoard } from '../src/game/levels.js';
import { simulateGames, balanceFromRuns } from '../src/game/bot.js';

const count = Number(process.argv[2] || 1000);
const rows = [];
const t0 = Date.now();
for (let n = 1; n <= count; n++) {
  const { board, params } = buildLevelBoard(n);
  const stats = simulateGames(board, params, 9, n * 31 + 7);
  const b = balanceFromRuns(n, params, stats);
  rows.push([b.shots, Math.round(b.s2 / 10), Math.round(b.s3 / 10)]);
  if (n % 50 === 0) console.log(`${n}/${count}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const out = '// Сгенерировано tools/gen-level-table.mjs — не редактировать вручную.\n' +
  '// [лимит выстрелов, порог 2★ / 10, порог 3★ / 10] для уровней 1..' + count + '\n' +
  'export const LEVEL_TABLE = ' + JSON.stringify(rows) + ';\n';
fs.writeFileSync(new URL('../src/game/level-table.js', import.meta.url), out);
console.log('done', rows.length, 'levels,', out.length, 'bytes');
