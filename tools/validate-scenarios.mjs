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
const TRIGGERS = ['start', 'seasonStart', 'seasonEnd', 'champion', 'trophy', 'promoted', 'relegated', 'debut', 'firstGoal', 'goalStreak', 'hatTrick', 'nightmare', 'redCard', 'badRun', 'benchStreak', 'moved', 'loanStart', 'loanReturn', 'freeAgent', 'injured', 'longInjury', 'recovered', 'returnLong', 'callup', 'ntWatch', 'ntDropped', 'ntDebut', 'roleStarter', 'roleOutcast', 'roleChange', 'birthday18', 'birthday21', 'birthday25', 'birthday30', 'birthday33', 'debt', 'followers100K', 'followers1M', 'moved_promise', 'leftAbroad', 'affairExposed', 'longDistanceStrain', 'allyLeft', ...LIFE_TRIGGERS];
const RANGE = ['age', 'trust', 'form', 'rep', 'wealth', 'followers', 'leagueQ', 'tier', 'caps', 'apps', 'seasonApps', 'contractYears', 'parental', 'lastRating', 'trophies', 'ovr', 'pfm', 'goalsSeason', 'tacticalFit', ...LIFE_METERS, 'sibAge', 'mumAge', 'dadAge', 'kidAge', 'partnerYears', 'potential', 'sponsors', 'level', 'crushHeat', 'worth', 'bond', 'lifestyle'];
const LIST = ['role', 'partner', 'phase', 'nt', 'lastResult', 'country', 'notCountry', 'nationality', 'notNationality', 'pos', 'months', 'flags', 'notFlags', 'partnerStyle', 'sibKind'];
const BOOL = ['injured', 'abroad', 'ramadan', 'agent', 'listed', 'played', 'matchWeek', 'freeAgent', 'hasAlly', 'hasRival', 'loan', 'debt', 'wantsAbroad', 'partnerNear', 'longDistance', 'familyNear', 'crush', 'hasKid', 'isCaptain', 'ownsCar'];
const FX = ['newManager', 'trust', 'rep', 'followers', 'wealth', 'pfm', 'form', 'tacticalFit', 'parental', 'monthlySupport', 'growth', 'stat', 'mood', 'teammate', 'partner', 'agent', 'endorsement', 'injury', 'suspension', 'listed', 'lifestyle', 'flag', 'unflag', 'chain', 'matchMod', 'newPartner', 'potential', 'kid', 'brand', 'abroadWish', 'offerAbroad', 'offerHome', 'cast', 'bond', 'crush', 'crushHeat', 'crushClear', 'partnerNear', 'partnerVisit', 'partnerFromCrush', 'assetLoss', 'sibBond', 'exBond', 'agentBond', 'wealthWeeks', 'wageRaise', 'supportWeeks', 'agentCut', 'renewalPush', 'sponsorPitch', ...LIFE_METERS];
const MOODS = ['Confident', 'Motivated', 'Anxious', 'Frustrated', 'Determined', 'Broken', 'On Fire', 'Lost', 'Focused', 'Numb', 'Homesick', 'Angry', 'Relieved'];
const STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'mental', 'goalkeeping', 'rel', 'finishing', 'longShots', 'vision', 'crossing', 'offBall', 'aerial', 'tackling', 'marking', 'ballPlaying', 'reflexes', 'handling', 'gkPositioning', 'command', 'distribution'];
const TOKENS = ['J', 'first', 'name', 'M', 'Mf', 'club', 'league', 'nation', 'pos', 'age', 'num', 'T', 'T2', 'Tl', 'T2l', 'F', 'Ff', 'P', 'A', 'Al', 'K', 'Kl', 'R', 'opp', 'MUM', 'DAD', 'SIB', 'SIBr', 'BF', 'BFf', 'BFjob', 'JR', 'JRl', 'OUT', 'CAP', 'CAPl', 'PRES', 'PRESl', 'Pf', 'SIBage', 'SIBlil', 'SIBplace', 'SIBhe', 'SIBhis', 'MUMage', 'DADage', 'KID', 'KIDage', 'BRAND', 'BRANDind', 'RIVAL', 'MENTEE', 'EXFLAME', 'FIXER', 'OLDBOSS', 'SIBhim', 'FIRSTCLUB', 'Pjob', 'CRUSH', 'CRUSHf', 'FORMER', 'FORMERCLUB', ...WORDS];
const KEYS = ['id', 'cat', 'w', 'when', 'cd', 'once', 'trigger', 'moment', 'chainOnly', 'uses', 'vars', 'title', 'text', 'prompt', 'fx', 'choices', 'dtype', 'ui', 'time', 'group', 'groupCd', 'groupOnce', 'critical', 'system'];

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
    else if (k === 'since') { if (typeof v !== 'object' || Array.isArray(v)) err('when.since must be { flag: [min, max] }'); }
    else err(`unknown condition "${k}"`);
  }
  const vars = Object.keys(Object.assign({}, ...(s.choices ?? []).map((c) => c.vars ?? {}), s.vars ?? {}));
  const checkText = (t, label) => {
    for (const m of String(t).matchAll(/\{(\w+)\}/g)) if (!TOKENS.includes(m[1]) && !vars.includes(m[1]) && !/^BRAND_\w+$/.test(m[1])) err(`${label}: unknown token {${m[1]}}`);
    if (/"/.test(String(t).replace(/\\"/g, ''))) {} // fine
  };
  checkText(s.title, 'title');
  for (const [t, l] of checkTextLater.splice(0)) checkText(t, l);
  for (const t of [].concat(s.text ?? [])) checkText(typeof t === 'object' ? t.t : t, 'text');
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
    for (const k of Object.keys(c)) if (!['label', 'desc', 'risk', 'hint', 'text', 'fx', 'out', 'check', 'ok', 'bad', 'vars', 'when'].includes(k)) err(`${L}: unknown key "${k}"`);
    for (const k of Object.keys(c.when ?? {})) if (![...RANGE, ...LIST, ...BOOL, 'since'].includes(k)) err(`${L}: unknown condition "${k}"`);
    checkText(c.label, L); if (c.desc) checkText(c.desc, L); if (c.hint) checkText(c.hint, L);
    const outs = c.check ? [c.ok, c.bad] : c.out ? c.out : [c];
    if (c.check && (!c.ok || !c.bad)) err(`${L}: check needs ok and bad`);
    for (const o of outs) { if (!o) continue; if (!o.text) err(`${L}: outcome missing text`); for (const t of [].concat(o.text ?? '')) checkText(typeof t === 'object' ? t.t : t, L); checkFx(o.fx, L); }
  });
}
// People actions (data/text/interactions.json): same choice format as scenarios
const inter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'text', 'interactions.json'), 'utf8'));
const WHO = ['partner', 'crush', 'ex', 'parents', 'sibling', 'bestfriend', 'kid', 'teammate', 'captain', 'manager', 'president', 'journalist', 'agent'];
const actSeen = new Set();
for (const a of inter.actions) {
  const where = `interactions.json › ${a.id}`;
  const err = (m) => errors.push(`${where}: ${m}`);
  if (actSeen.has(a.id)) err('duplicate id'); actSeen.add(a.id);
  if (!WHO.includes(a.who)) err(`unknown who "${a.who}"`);
  if (!a.label) err('missing label');
  for (const k of Object.keys(a.when ?? {})) if (![...RANGE, ...LIST, ...BOOL, 'since'].includes(k)) err(`unknown condition "${k}"`);
  const tok = (t) => { for (const m of String(t ?? '').matchAll(/\{(\w+)\}/g)) if (!TOKENS.includes(m[1]) && !/^BRAND_\w+$/.test(m[1])) err(`unknown token {${m[1]}}`); };
  tok(a.label); tok(a.desc); tok(a.hint);
  const outs = a.check ? [a.ok, a.bad] : a.out ? a.out : [a];
  if (a.check && (!a.ok || !a.bad)) err('check needs ok and bad');
  for (const o of outs) {
    if (!o) continue;
    if (!o.text) err('outcome missing text');
    for (const t of [].concat(o.text ?? '')) tok(typeof t === 'object' ? t.t : t);
    for (const [k, v] of Object.entries(o.fx ?? {})) {
      if (!FX.includes(k)) err(`unknown effect "${k}"`);
      if (k === 'mood' && !MOODS.includes(v)) err(`unknown mood "${v}"`);
      if (k === 'chain') chainTargets.add(v.id);
    }
  }
}
console.log(`${inter.actions.length} people actions`);

for (const id of chainTargets) if (!ids.has(id)) errors.push(`chain target "${id}" does not exist`);
for (const { s, file } of all) if (s.chainOnly && !s.system && !chainTargets.has(s.id)) errors.push(`${file} › ${s.id}: chainOnly but nothing chains to it`);

// Life web text (data/text/life.json): free-time actions and ripple lines
const life = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'text', 'life.json'), 'utf8'));
const LIFE_TOKENS = ['J', 'M', 'Mf', 'P', 'club', 'Pjob', 'CRUSH', 'CRUSHf', 'NEWCLUB', 'COUNTRY', 'SIBage', 'SIBlil', 'SIBplace', 'SIBhe', 'SIBhis', 'MUMage', 'DADage', 'KID', 'KIDage', 'BRAND', 'BRANDind', 'MUM', 'DAD', 'SIB', 'SIBr', 'BF', 'BFf', 'BFjob', 'JR', 'JRl', 'OUT', 'CAP', 'CAPl', 'PRES', 'PRESl', 'Pf', ...WORDS];
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
