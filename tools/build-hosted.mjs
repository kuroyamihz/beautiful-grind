// Packages the game into dist/ for publishing as a claude.ai Artifact.
// Usage: npm run build:hosted
// The hosted page has no <html>/<head>/<body> of its own (claude.ai adds them),
// so this strips them from public/index.html and copies everything the page loads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(DIST, to)), { recursive: true }); fs.copyFileSync(path.join(ROOT, from), path.join(DIST, to)); return to; };
const files = [];

// Page: <title> + stylesheet link + the body content only.
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].trim();
fs.writeFileSync(path.join(DIST, 'index.html'), `${title}\n<link rel="stylesheet" href="style.css">\n${body}\n`);

files.push(copy('public/style.css', 'style.css'));
for (const f of fs.readdirSync(path.join(ROOT, 'public', 'js'))) files.push(copy(`public/js/${f}`, `js/${f}`));
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'world')).filter((f) => f.endsWith('.json'))) files.push(copy(`data/world/${f}`, `data/world/${f}`));
// Claude's rules, read by the page when the Claude narrator is on (served as plain text).
files.push(copy('prompts/engine.md', 'prompts/engine.txt'));
files.push(copy('prompts/hybrid-rules.md', 'prompts/hybrid-rules.txt'));

fs.writeFileSync(path.join(DIST, 'files.json'), JSON.stringify(files, null, 1));
const size = files.reduce((a, f) => a + fs.statSync(path.join(DIST, f)).size, 0) + fs.statSync(path.join(DIST, 'index.html')).size;
console.log(`Built dist/: index.html + ${files.length} files, ${(size / 1024).toFixed(0)} KB total`);
