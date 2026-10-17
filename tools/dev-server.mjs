// Локальный сервер: отдаёт игру и мок SDK по адресу /sdk.js.
// node tools/dev-server.mjs [--src|--dist] [--port 8080] [--nosdk]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const useDist = args.includes('--dist');
const noSdk = args.includes('--nosdk');
const portIdx = args.indexOf('--port');
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : Number(process.env.PORT || 8080);
const base = path.join(root, useDist ? 'dist' : 'src');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/sdk.js') {
    if (noSdk) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(__dirname, 'mock-sdk.js')).pipe(res);
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(base, p));
  if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Сервер: http://0.0.0.0:${port}/  (${useDist ? 'dist — собранная версия' : 'src — исходники'}${noSdk ? ', без SDK' : ', мок SDK'})`);
});
