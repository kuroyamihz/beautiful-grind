// Checks every scenario file for mistakes. Usage: npm run validate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'scenarios');
const CATS = ['milestone', 'training', 'dressing', 'manager', 'moment', 'media', 'family', 'love', 'money', 'culture', 'national', 'body', 'veteran', 'friends', 'politics', 'lifestyle', 'interlude'];
const LIFE_TRIGGERS = ['partnerCrisis', 'familyRift', 'friendsDrift', 'dressingRevolt', 'boardAngry', 'fansTurn', 'pressWar', 'scandal', 'lowMorale', 'burnout', 'fanFavourite', 'pressDarling', 'deepLove', 'leader', 'roleModel'];
const LIFE_METERS = ['board', 'dressing', 'fans', 'press', 'image', 'love', 'friends', 'morale', 'stress', 'family'];
const WORDS = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'text', 'life.json'), 'utf8')).words);
const TRIGGERS = ['start', 'seasonStart', 'seasonEnd', 'champion', 'trophy', 'promoted', 'relegated', 'debut', 'firstGoal', 'goalStreak', 'hatTrick', 'nightmare', 'redCard', 'badRun', 'benchStreak', 'moved', 'loanStart', 'loanReturn', 'freeAgent', 'injured', 'longInjury', 'recovered', 'returnLong', 'callup', 'ntWatch', 'ntDropped', 'ntDebut', 'roleStarter', 'roleOutcast', 'roleChange', 'birthday18', 'birthday21', 'birthday25', 'birthday30', 'birthday33', 'debt', ...LIFE_TRIGGERS];
const RANGE = ['age', 'trust', 'form', 'rep', 'wealth', 'followers', 'leagueQ', 'tier', 'caps', 'apps', 'seasonApps', 'contractYears', 'parental', 'lastRating', 'trophies', 'ovr', 'pfm', 'goalsSeason', 'tacticalFit', ...LIFE_METERS];
const LIST = ['role', 'partner', 'phase', 'nt', 'lastResult', 'country', 'notCountry', 'nationality', 'notNationality', 'pos', 'months', 'flags', 'notFlags', 'partnerStyle'];
const BOOL = ['injured', 'abroad', 'ramadan', 'agent', 'listed', 'played', 'matchWeek', 'freeAgent', 'hasAlly', 'hasRival', 'loan', 'debt'];
const FX = ['newManager', 'trust', 'rep', 'followers', 'wealth', 'pfm', 'form', 'tacticalFit', 'parental', 'monthlySupport', 'growth', 'stat', 'mood', 'teammate', 'partner', 'agent', 'endorsement', 'injury', 'suspension', 'listed', 'lifestyle', 'flag', 'unflag', 'chain', 'matchMod', 'newPartner', ...LIFE_METERS];
const MOODS = ['Confident', 'Motivated', 'Anxious', 'Frustrated', 'Determined', 'Broken', 'On Fire', 'Lost', 'Focused', 'Numb', 'Homesick', 'Angry', 'Relieved'];
const STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'mental', 'goalkeeping', 'rel'];
const TOKENS = ['J', 'first', 'name', 'M', 'Mf', 'club', 'league', 'nation', 'pos', 'age', 'num', 'T', 'T2', 'Tl', 'T2l', 'F', 'Ff', 'P', 'A', 'Al', 'K', 'Kl', 'R', 'opp', 'MUM', 'DAD', 'SIB', 'SIBr', 'BF', 'BFf', 'BFjob', 'JR', 'JRl', 'OUT', 'CAP', 'CAPl', 'PRES', 'PRESl', 'Pf', ...WORDS];
const KEYS = ['id', 'cat', 'w', 'when', 'cd', 'once', 'trigger', 'moment', 'chainOnly', 'uses', 'vars', 'title', 'text', 'prompt', 'fx', 'choices', 'dtype', 'ui', 'time'];

const errors = [];
const all = [];
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
for (const file of index.files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); } catch (e) { errors.push(`${file}: invalid JSON — ${e.message}`); continue; }
  for (const s of data.scenarios) all.push({ s, file });
}
const ids = new Map();
const checkTextLater = [];
const chainTargets = new Set();
for (const { s, file } of all) {
  const where = `${file} › ${s.id ?? '(no id)'}`;
  const err = (m) => errors.push(`${where}: ${m}`);
  if (!s.id) err('missing id');
  if (ids.has(s.id)) err(`duplicate id (also in ${ids.get(s.id)})`); ids.set(s.id, file);
  for (const k of Object.keys(s)) if (!KEYS.includes(k)) err(`unknown key "${k}"`);
  if (!CATS.includes(s.cat)) err(`unknown cat "${s.cat}"`);
  if (s.trigger && !TRIGGERS.includes(s.trigger)) err(`unknown trigger "${s.trigger}"`);
  if (!s.title) err('missing title');
  if (!s.text) err('missing text');
  if (s.moment && !s.choices?.length) err('moment without choices');
  if (s.cat === 'interlude' && (s.trigger || s.moment || s.chainOnly)) err('interludes cannot have trigger, moment or chainOnly');
  if (s.ui && !['phone', 'press', 'social', 'letter', 'boardroom'].includes(s.ui)) err(`unknown ui "${s.ui}"`);
  if (s.time) checkTextLater.push([s.time, 'time']);
  for (const [k, v] of Object.entries(s.when ?? {})) {
    if (RANGE.includes(k)) { if (!Array.isArray(v) || v.length !== 2) err(`when.${k} must be [min, max]`); }
    else if (LIST.includes(k)) { if (!Array.isArray(v)) err(`when.${k} must be a list`); }
    else if (BOOL.includes(k)) { if (typeof v !== 'boolean') err(`when.${k} must be true/false`); }
    else err(`unknown condition "${k}"`);
  }
  const vars = Object.keys(Object.assign({}, ...(s.choices ?? []).map((c) => c.vars ?? {}), s.vars ?? {}));
  const checkText = (t, label) => {
    for (const m of String(t).matchAll(/\{(\w+)\}/g)) if (!TOKENS.includes(m[1]) && !vars.includes(m[1])) err(`${label}: unknown token {${m[1]}}`);
    if (/"/.test(String(t).replace(/\\"/g, ''))) {} // fine
  };
  checkText(s.title, 'title');
  for (const [t, l] of checkTextLater.splice(0)) checkText(t, l);
  for (const t of [].concat(s.text ?? [])) checkText(t, 'text');
  if (s.prompt) checkText(s.prompt, 'prompt');
  const checkFx = (fx, label) => {
    for (const [k, v] of Object.entries(fx ?? {})) {
      if (!FX.includes(k)) err(`${label}: unknown effect "${k}"`);
      if (k === 'mood' && !MOODS.includes(v)) err(`${label}: unknown mood "${v}"`);
      if (k === 'growth') for (const g of v) if (!STATS.includes(g)) err(`${label}: unknown growth stat "${g}"`);
      if (k === 'stat') for (const g of Object.keys(v)) if (!STATS.includes(g)) err(`${label}: unknown stat "${g}"`);
      if (k === 'chain') chainTargets.add(v.id);
      if (typeof v === 'string' && ['wealth', 'monthlySupport', 'followers'].includes(k) && !vars.includes(v.replace(/^-/, '').replace(/\*.*/, ''))) err(`${label}: ${k} refers to unknown var "${v}"`);
      if (k === 'matchMod' && !s.moment) err(`${label}: matchMod only works in moment scenarios`);
    }
  };
  checkFx(s.fx, 'fx');
  (s.choices ?? []).forEach((c, i) => {
    const L = `choice ${i + 1}`;
    if (!c.label) err(`${L}: missing label`);
    checkText(c.label, L); if (c.desc) checkText(c.desc, L); if (c.hint) checkText(c.hint, L);
    const outs = c.check ? [c.ok, c.bad] : c.out ? c.out : [c];
    if (c.check && (!c.ok || !c.bad)) err(`${L}: check needs ok and bad`);
    for (const o of outs) { if (!o) continue; if (!o.text) err(`${L}: outcome missing text`); checkText(o.text ?? '', L); checkFx(o.fx, L); }
  });
}
for (const id of chainTargets) if (!ids.has(id)) errors.push(`chain target "${id}" does not exist`);
for (const { s, file } of all) if (s.chainOnly && !chainTargets.has(s.id)) errors.push(`${file} › ${s.id}: chainOnly but nothing chains to it`);

// Life web text (data/text/life.json): free-time actions and ripple lines
const life = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'text', 'life.json'), 'utf8'));
const LIFE_TOKENS = ['J', 'M', 'Mf', 'P', 'club', 'NEWCLUB', 'COUNTRY', 'MUM', 'DAD', 'SIB', 'SIBr', 'BF', 'BFf', 'BFjob', 'JR', 'JRl', 'OUT', 'CAP', 'CAPl', 'PRES', 'PRESl', 'Pf', ...WORDS];
const lifeText = (t, where) => { for (const m of String(t).matchAll(/\{(\w+)\}/g)) if (!LIFE_TOKENS.includes(m[1])) errors.push(`life.json ${where}: unknown token {${m[1]}}`); };
for (const [id, lines] of Object.entries(life.ripples)) for (const l of lines) lifeText(l, 'ripples.' + id);
const actIds = new Set();
for (const a of life.actions) {
  if (actIds.has(a.id)) errors.push(`life.json action ${a.id}: duplicate id`); actIds.add(a.id);
  lifeText(a.label, a.id); lifeText(a.desc, a.id);
  for (const k of Object.keys(a.when ?? {})) if (![...RANGE, ...LIST, ...BOOL].includes(k)) errors.push(`life.json action ${a.id}: unknown condition ${k}`);
  for (const o of a.out) {
    for (const t of [].concat(o.text)) lifeText(t, a.id);
    for (const k of Object.keys(o.fx ?? {})) if (![...FX, 'wealthWeeks'].includes(k)) errors.push(`life.json action ${a.id}: unknown effect ${k}`);
  }
}

const byCat = {};
for (const { s } of all) byCat[s.cat] = (byCat[s.cat] ?? 0) + 1;
console.log(`${all.length} scenarios in ${index.files.length} files`);
console.log(Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(' · '));
if (errors.length) { console.log(`\n${errors.length} problem(s):`); for (const e of errors) console.log(' - ' + e); process.exit(1); }
console.log('No problems found.');
