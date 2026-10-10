// Beautiful Grind local server.
// - Serves the game (public/) and world data (data/) at http://localhost:3000
// - Optional: /api/narrate asks Claude to narrate a week (needs ANTHROPIC_API_KEY in .env)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';
// Claude Opus 5.5 prices per million tokens (USD), used only for the in-game cost tracker.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// ── Claude client (loaded only if the SDK is installed and a key exists) ──
let client = null, sdkError = null, Anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
    client = new Anthropic();
  } catch {
    sdkError = 'the Claude SDK is not installed — run "npm install" in the game folder (start-game.bat does this for you)';
  }
}

// Same rules the hosted (claude.ai) version uses: prompts/engine.md + prompts/hybrid-rules.md
const SYSTEM_PROMPT = fs.readFileSync(path.join(ROOT, 'prompts', 'engine.md'), 'utf8') + '\n\n'
  + fs.readFileSync(path.join(ROOT, 'prompts', 'hybrid-rules.md'), 'utf8');

function extractJson(text) {
  const t = text.replace(/```(?:json)?/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Claude did not return JSON');
  return JSON.parse(t.slice(a, b + 1));
}

async function narrate(context) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Simulate and narrate this game week. Context:\n${JSON.stringify(context)}` }],
  });
  if (response.stop_reason === 'refusal') throw new Error(`Claude declined to write this week (${response.stop_details?.category ?? 'no category'})`);
  if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of space mid-story');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const u = response.usage ?? {};
  const costUSD = ((u.input_tokens ?? 0) * PRICE.input + (u.output_tokens ?? 0) * PRICE.output + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6;
  return { data: extractJson(text), usage: u, costUSD, model: response.model };
}

function apiErrorMessage(err) {
  if (Anthropic) {
    if (err instanceof Anthropic.AuthenticationError) return 'the API key was rejected — check ANTHROPIC_API_KEY in .env';
    if (err instanceof Anthropic.PermissionDeniedError) return 'this API key has no access to that model';
    if (err instanceof Anthropic.RateLimitError) return 'rate limited — wait a minute and try again';
    if (err instanceof Anthropic.BadRequestError) return `request rejected: ${err.message}`;
    if (err instanceof Anthropic.APIConnectionError) return 'could not reach Anthropic — check your internet connection';
    if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status}`;
  }
  return err.message;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function serveFile(res, baseDir, rel) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, MIME[path.extname(file)] ?? 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/status') {
    if (client) return send(res, 200, { ai: true, model: MODEL });
    return send(res, 200, { ai: false, reason: sdkError ?? 'no API key found — add ANTHROPIC_API_KEY to the .env file and restart the game' });
  }
  if (url.pathname === '/api/narrate' && req.method === 'POST') {
    if (!client) return send(res, 503, { ok: false, error: sdkError ?? 'no API key configured' });
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 2e6) return send(res, 413, { ok: false, error: 'request too large' }); }
    try {
      const { context } = JSON.parse(raw);
      const out = await narrate(context);
      console.log(`[claude] week narrated · in ${out.usage.input_tokens} (cache read ${out.usage.cache_read_input_tokens ?? 0}) · out ${out.usage.output_tokens} · $${out.costUSD.toFixed(4)}`);
      return send(res, 200, { ok: true, ...out });
    } catch (err) {
      const msg = apiErrorMessage(err);
      console.error('[claude] error:', msg);
      return send(res, 502, { ok: false, error: msg });
    }
  }
  if (url.pathname.startsWith('/data/')) return serveFile(res, path.join(ROOT, 'data'), decodeURIComponent(url.pathname.slice(6)));
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  return serveFile(res, path.join(ROOT, 'public'), rel);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\nPort ${PORT} is busy — the game may already be running. Open http://localhost:${PORT}\n`);
  else console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n  BEAUTIFUL GRIND is running → http://localhost:${PORT}`);
  console.log(client ? `  Claude narrator: ON (${MODEL}, effort ${EFFORT})` : `  Claude narrator: OFF (${sdkError ?? 'no ANTHROPIC_API_KEY in .env'}) — offline narrator works fine`);
  console.log('  Keep this window open while you play. Close it to stop the game.\n');
});
