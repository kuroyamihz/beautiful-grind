// Beautiful Grind local server: serves the game (public/) and its data (data/) at http://localhost:3000
// The game itself needs no server logic. This only exists because browsers block loading
// data files from a page opened directly from disk.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveFile(res, baseDir, rel) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => (err ? send(res, 404, 'Not found') : send(res, 200, buf, MIME[path.extname(file)] ?? 'application/octet-stream')));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/data/')) return serveFile(res, path.join(ROOT, 'data'), decodeURIComponent(url.pathname.slice(6)));
  serveFile(res, path.join(ROOT, 'public'), url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\nPort ${PORT} is busy — the game may already be running. Open http://localhost:${PORT}\n`);
  else console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n  BEAUTIFUL GRIND is running → http://localhost:${PORT}`);
  console.log('  Keep this window open while you play. Close it to stop the game.\n');
});
