// Builds the playable website into dist/ (used by GitHub Pages).
// Usage: npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });

// The game page and code
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
// Game data (only the JSON the game loads)
for (const dir of ['world', 'scenarios', 'text']) {
  const from = path.join(ROOT, 'data', dir), to = path.join(DIST, 'data', dir);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from).filter((f) => f.endsWith('.json'))) fs.copyFileSync(path.join(from, f), path.join(to, f));
}
fs.writeFileSync(path.join(DIST, '.nojekyll'), ''); // serve files exactly as they are

let files = 0, bytes = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; } } };
walk(DIST);
console.log(`Built dist/: ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
