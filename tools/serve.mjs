// Временный локальный сервер для собранной игры (dist/ + мок SDK) — для браузерных тестов и промо-скриптов.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/** base передан — используем его; иначе поднимаем свой сервер для dist/ на свободном порту. */
export async function serveDist(base) {
  if (base) return { base: base.endsWith('/') ? base : base + '/', stop() {} };
  if (!fs.existsSync(path.join(here, '../dist/index.html'))) {
    console.error('Нет dist/index.html — сначала выполните: npm run build');
    process.exit(1);
  }
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(here, 'dev-server.mjs'), '--dist', '--port', String(port)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* ещё не поднялся */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  process.on('exit', () => child.kill());
  return { base: url, stop: () => child.kill() };
}
