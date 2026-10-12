// Scenario engine: reads hand-written scenarios from data/scenarios/*.json,
// decides which ones fit the player's life right now, and resolves choices.
// Scenario format: see data/scenarios/README.md
import { chance, clamp, gauss, pick, randint, weightedPick } from './util.js';
import { EUR_IDR, RAMADAN, POSITIONS, LEGACY_STATS, ATTRS } from './config.js';
import { personName, overall, attrValue, careerLevel } from './player.js';
import { teammateFor } from './squad.js';
import { ownedCar, netWorth } from './assets.js';
import { leagueQuality, leagueClubs } from './world.js';
import { monthOf, ageAt, inRange } from './time.js';
import { meter, lifeTokens, LIFE_FX, castAges } from './life.js';
import { LIFE } from './config.js';
import { flavourBrand, eligibleBrands } from './sponsors.js';

const POS_GROUP = { GK: 'GK', CB: 'DEF', FB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', W: 'ATT', ST: 'ATT' };
export const DEFAULT_COOLDOWN = 60;
export const LIFE_RANGES = ['board', 'dressing', 'fans', 'press', 'image', 'love', 'friends', 'morale', 'stress', 'family'];

export async function loadScenarios(fetchJson) {
  const index = await fetchJson('data/scenarios/index.json');
  const all = [];
  for (const file of index.files) {
    const data = await fetchJson(`data/scenarios/${file}`);
    for (const s of data.scenarios) all.push({ ...s, file });
  }
  return all;
}

// ── Snapshot of everything conditions can test ──
export function scenarioContext(state, world, res = null) {
  const p = state.player;
  const w = state.week;
  const club = p.club;
  const season = club ? state.seasons[club.key] : null;
  // Off-season = from the final whistle until the first day of next pre-season.
  const phase = !season ? 'off' : season.finished || w > season.endWeek || w < season.preStartWeek ? 'off' : w < season.startWeek ? 'pre' : 'in';
  // Season stats are reset at the final whistle; end-of-season scenarios still need to see them.
  const seasonStats = res?.seasonEnd ?? { apps: p.season.apps, goals: p.season.goals };
  const allies = p.keyTeammates.filter((t) => t.relationship === 'ally');
  const rivals = p.keyTeammates.filter((t) => ['rival', 'enemy'].includes(t.relationship));
  const played = res ? res.matches.find((m) => m.minutes > 0) : null;
  return {
    age: ageAt(p.dob, w), role: p.squadRole, injured: !!p.injury, trust: p.manager.trust, form: p.form, rep: p.reputation,
    wealth: p.wealthEUR, followers: p.followers, country: club?.country ?? null, nationality: p.nationality,
    abroad: !!club && club.country !== p.nationality, pos: p.position, posGroup: POS_GROUP[p.position],
    partner: p.partner.status, leagueQ: club ? leagueQuality(club.key) : 0, tier: club?.tier ?? 0, phase,
    month: monthOf(w) + 1, flags: new Set(Object.keys(state.flags.story ?? {})), ramadan: RAMADAN.some(([a, b]) => inRange(w, a, b)),
    agent: !!p.agent, nt: p.national.status, caps: p.national.caps, apps: p.career.apps, seasonApps: seasonStats.apps,
    contractYears: club ? Math.max(0, (club.contractEndWeek - w) / 52) : 0, listed: p.transferListed, parental: p.family.parentalSupport,
    lastResult: (played ?? p.lastMatch)?.result ?? null, lastRating: (played ?? p.lastMatch)?.rating ?? null,
    played: !!played, matchWeek: !!res?.matches.length, freeAgent: !club, hasAlly: allies.length > 0, hasRival: rivals.length > 0,
    trophies: p.career.trophies.length, ovr: overall(p), tacticalFit: p.manager.tacticalFit, pfm: p.pfm, loan: !!club?.loan, goalsSeason: seasonStats.goals,
    partnerStyle: p.partner.status === 'none' ? null : p.partner.style, debt: p.wealthEUR < 0,
    ...(p.circle ? castAges(state) : {}), sibKind: p.circle?.sibling?.kind ?? null, week: w, flagWeeks: state.flags.story ?? {},
    partnerYears: p.partner.status === 'none' ? null : (w - (p.partner.since ?? w)) / 52, potential: p.potential ?? null, wantsAbroad: !!p.wantsAbroad,
    sponsors: (p.endorsements ?? []).length, followersM: p.followers / 1e6,
    level: careerLevel(p, ageAt(p.dob, w)),
    // Where the people are: a partner back home can't come to dinner; parents abroad can't drop by.
    partnerNear: p.partner.status !== 'none' && (p.partner.near !== false || p.partner.visitWeek === w),
    longDistance: p.partner.status !== 'none' && p.partner.near === false,
    familyNear: !(!!club && club.country !== p.nationality) || !!state.flags.story?.family_moved_in,
    crush: !!p.crush, crushHeat: p.crush?.heat ?? null, hasKid: (p.kids ?? []).length > 0, worth: p.assets ? netWorth(state) : p.wealthEUR,
    isCaptain: !!state.squad?.captainIsMe, ownsCar: !!ownedCar(state), lifestyle: p.lifestyle ?? 1,
    ...Object.fromEntries(LIFE_RANGES.map((k) => [k, p.life ? meter(p, k) : 50])),
  };
}

const inRangeOf = (v, r) => v !== null && v !== undefined && v >= (r[0] ?? -Infinity) && v <= (r[1] ?? Infinity);

export function conditionsMet(when = {}, c) {
  for (const [k, v] of Object.entries(when)) {
    switch (k) {
      case 'age': case 'trust': case 'form': case 'rep': case 'wealth': case 'followers': case 'leagueQ': case 'tier':
      case 'caps': case 'apps': case 'seasonApps': case 'contractYears': case 'parental': case 'lastRating': case 'trophies':
      case 'ovr': case 'pfm': case 'goalsSeason': case 'tacticalFit':
      case 'board': case 'dressing': case 'fans': case 'press': case 'image': case 'love': case 'friends': case 'morale': case 'stress': case 'family':
      case 'sibAge': case 'mumAge': case 'dadAge': case 'kidAge': case 'partnerYears': case 'potential': case 'sponsors':
      case 'level': case 'crushHeat': case 'worth': case 'bond': case 'lifestyle':
        if (!inRangeOf(c[k], v)) return false; break;
      case 'role': case 'partner': case 'phase': case 'nt': case 'lastResult': case 'partnerStyle': case 'sibKind':
        if (!v.includes(c[k])) return false; break;
      case 'country': if (!v.includes(c.country)) return false; break;
      case 'notCountry': if (v.includes(c.country)) return false; break;
      case 'nationality': if (!v.includes(c.nationality)) return false; break;
      case 'notNationality': if (v.includes(c.nationality)) return false; break;
      case 'pos': if (!v.includes(c.pos) && !v.includes(c.posGroup)) return false; break;
      case 'months': if (!v.includes(c.month)) return false; break;
      case 'flags': if (!v.every((f) => c.flags.has(f))) return false; break;
      case 'notFlags': if (v.some((f) => c.flags.has(f))) return false; break;
      case 'injured': case 'abroad': case 'ramadan': case 'agent': case 'listed': case 'played': case 'matchWeek':
      case 'freeAgent': case 'hasAlly': case 'hasRival': case 'loan': case 'debt': case 'wantsAbroad':
      case 'partnerNear': case 'longDistance': case 'familyNear': case 'crush': case 'hasKid': case 'isCaptain': case 'ownsCar':
        if (!!c[k] !== v) return false; break;
      // Weeks since a story flag was set: { "since": { "promised_ultras": [100, 9999] } }
      case 'since':
        for (const [f, r] of Object.entries(v)) { const at = c.flagWeeks?.[f]; if (at === undefined || !inRangeOf(c.week - at, r)) return false; }
        break;
      default: break; // unknown keys are caught by tools/validate-scenarios.mjs
    }
  }
  return true;
}

// ── Picking a scenario for this week ──
export function pickScenario(state, world, ctx, { triggers = [], moment = false, interlude = false, cats = null, excludeCats = null } = {}) {
  const seen = state.flags.scenWeek ?? {};
  const once = state.flags.scenOnce ?? {};
  const count = state.flags.scenCount ?? {};
  const groupSeen = state.flags.groupWeek ?? {};
  const lastCats = state.lastCats ?? [];
  const pool = world.scenarios.filter((s) => {
    if (s.chainOnly) return false;
    if (!!s.moment !== moment) return false;
    if ((s.cat === 'interlude') !== interlude) return false;
    if (cats && !cats.includes(s.cat)) return false;
    if (excludeCats?.has(s.cat)) return false;
    if (s.once && once[s.id]) return false;
    if (seen[s.id] !== undefined && state.week - seen[s.id] < (s.cd ?? DEFAULT_COOLDOWN)) return false;
    // Stories about the same thing (a group) share one cooldown, so the same situation never comes back too soon.
    if (s.group && groupSeen[s.group] !== undefined && state.week - groupSeen[s.group] < (s.groupCd ?? s.cd ?? DEFAULT_COOLDOWN)) return false;
    if (s.group && s.groupOnce && groupSeen[s.group] !== undefined) return false;
    if (s.trigger ? !triggers.includes(s.trigger) : triggers.length > 0) return false;
    if (!s.when?.freeAgent && ctx.freeAgent) return false;
    if (!s.when || !('injured' in s.when)) { if (ctx.injured && ['training', 'moment'].includes(s.cat)) return false; }
    return conditionsMet(s.when, ctx);
  });
  // Fresh stories first: anything that has fired before, or shares a category with last week, is less likely.
  return weightedPick(pool, (s) => (s.w ?? 5) / (1 + LIFE.repeatPenalty * (count[s.id] ?? 0)) * (!s.trigger && lastCats.includes(s.cat) ? 0.35 : 1));
}

export function markUsed(state, s) {
  state.flags.scenWeek = { ...(state.flags.scenWeek ?? {}), [s.id]: state.week };
  if (s.group) state.flags.groupWeek = { ...(state.flags.groupWeek ?? {}), [s.group]: state.week };
  state.flags.scenCount = { ...(state.flags.scenCount ?? {}), [s.id]: (state.flags.scenCount?.[s.id] ?? 0) + 1 };
  if (s.once) state.flags.scenOnce = { ...(state.flags.scenOnce ?? {}), [s.id]: true };
}

// Real brand names for {BRAND} and {BRAND_industry} (e.g. {BRAND_boots}), picked from brands that would want him.
function brandWords(state, world) {
  if (!world.brands) return {};
  const out = flavourBrand(state, world);
  const elig = eligibleBrands(state, world, { ignoreCat: true });
  for (const ind of Object.keys(world.brands.industries)) {
    const list = elig.filter((b) => b.ind === ind);
    const any = world.brands.brands.filter((b) => b.ind === ind);
    out['BRAND_' + ind] = pick(list.length ? list : any)?.name ?? out.BRAND;
  }
  return out;
}

// ── Instances: names and amounts fixed when the scenario fires ──
function nameFor(kind, mode, state, taken = []) {
  const p = state.player;
  const country = p.club?.country ?? p.nationality;
  // Teammates come from the real squad, so the same names keep turning up (and leave when they're sold).
  if ((kind === 'T' || kind === 'T2') && state.squad && mode !== 'outsider') {
    const n = teammateFor(state, mode, taken, ageAt(p.dob, state.week));
    if (n) return n;
  }
  if (kind === 'T' && mode === 'ally') return pick(p.keyTeammates.filter((t) => t.relationship === 'ally'))?.name;
  if (kind === 'T' && mode === 'rival') return pick(p.keyTeammates.filter((t) => ['rival', 'enemy'].includes(t.relationship)))?.name;
  if (kind === 'T' && mode === 'any' && p.keyTeammates.length) return pick(p.keyTeammates).name;
  if (kind === 'F' && mode === 'crush' && p.crush) return p.crush.name;
  if (kind === 'F' && mode === 'ex' && p.cast?.exflame) return p.cast.exflame;
  if (kind === 'F') return mode === 'partner' && p.partner.name ? p.partner.name : personName(country, true);
  if (kind === 'A') return mode === 'agent' && p.agent ? p.agent.name : personName(pick([p.nationality, 'England', 'Netherlands']));
  return personName(country);
}

function computeVar([kind, a = 0, b = 0], state) {
  const p = state.player;
  const wage = p.club?.wageWeekly ?? 100;
  let v = 0;
  if (kind === 'wealthPct') v = Math.max(b || 100, Math.abs(p.wealthEUR) * a / 100);
  else if (kind === 'wageWeeks') v = Math.max(b || 50, wage * a);
  else if (kind === 'fixed') v = a;
  else if (kind === 'endorse') v = (a || 800) + p.reputation * p.reputation * 60;
  else if (kind === 'range') v = randint(a, b);
  return Math.round(v / 10) * 10;
}

export function instantiate(s, state, world, carried = null) {
  const p = state.player;
  const inst = carried ? { ...carried, sid: s.id } : { sid: s.id, names: {}, vars: {} };
  // Random words ({PLACE}, {FOOD}, {DAY}…) are picked once, so the scene and its outcome agree.
  inst.words = { ...Object.fromEntries(Object.entries(world.life?.words ?? {}).map(([k, list]) => [k, pick(list)])), ...brandWords(state, world), ...(carried?.words ?? {}) };
  // His own car, if he has one, is the car in the story.
  const car = ownedCar(state);
  if (car && !carried?.words?.CAR) inst.words.CAR = `his ${car.brand} ${car.name}`;
  for (const k of ['T', 'T2', 'F', 'A', 'K']) {
    if (inst.names[k]) continue;
    const mode = s.uses?.[k] ?? 'new';
    inst.names[k] = nameFor(k, mode, state, Object.values(inst.names)) ?? personName(p.club?.country ?? p.nationality);
  }
  if (!inst.names.R && p.club) inst.names.R = pick(leagueClubs(state, world, p.club.key).filter((c) => c !== p.club.name)) ?? 'their rivals';
  const defs = Object.assign({}, ...(s.choices ?? []).map((c) => c.vars ?? {}), s.vars ?? {});
  for (const [k, def] of Object.entries(defs)) if (inst.vars[k] === undefined) inst.vars[k] = computeVar(def, state);
  return inst;
}

export function fmtMoney(state, eur) {
  if (state.player.nationality === 'Indonesia') {
    const idr = Math.abs(eur) * EUR_IDR;
    const s = idr >= 1e9 ? `${(idr / 1e9).toFixed(1)} miliar` : idr >= 1e6 ? `${Math.round(idr / 1e6)} juta` : `${Math.round(idr / 1e3)} ribu`;
    return `Rp ${s}`;
  }
  return `€${Math.abs(Math.round(eur)).toLocaleString('en')}`;
}

export function fill(str, inst, state) {
  const p = state.player;
  const first = p.name.split(' ')[0];
  const map = {
    J: p.jerseyName, first, name: p.name, M: p.manager.name, club: p.club?.name ?? 'his old club', nation: p.nationality,
    league: state.seasons[p.club?.key]?.name ?? 'the league', pos: POSITIONS[p.position].name.toLowerCase(), age: String(ageAt(p.dob, state.week)),
    T: inst.names.T, T2: inst.names.T2, F: inst.names.F, P: p.partner.name || inst.names.F, A: inst.names.A, K: inst.names.K, R: inst.names.R,
    Tl: inst.names.T?.split(' ').slice(-1)[0], T2l: inst.names.T2?.split(' ').slice(-1)[0], Ff: inst.names.F?.split(' ')[0], Al: inst.names.A?.split(' ').slice(-1)[0],
    Kl: inst.names.K?.split(' ').slice(-1)[0], Mf: p.manager.name.split(' ').slice(-1)[0], opp: p.lastMatch?.opp ?? inst.names.R, num: String(p.number),
    ...(p.circle ? lifeTokens(state) : {}), ...(inst.words ?? {}),
    // People the story remembers across years (set with fx cast): {RIVAL} {MENTEE} {EXFLAME} {FIXER} {OLDBOSS}
    RIVAL: p.cast?.rival ?? inst.names.T, MENTEE: p.cast?.mentee ?? inst.names.K, EXFLAME: p.cast?.exflame ?? inst.names.F, FIXER: p.cast?.fixer ?? inst.names.A, OLDBOSS: p.cast?.oldboss ?? p.manager.name,
    CRUSH: p.crush?.name ?? inst.names.F, CRUSHf: (p.crush?.name ?? inst.names.F)?.split(' ')[0], FORMER: p.formerTeammates?.at(-1)?.name ?? inst.names.T, FORMERCLUB: p.formerTeammates?.at(-1)?.club ?? 'his old club',
  };
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : k in inst.vars ? fmtMoney(state, inst.vars[k]) : m));
}

// Effects may refer to vars: "-cost", "cost", "cost*1.5"
function num(v, inst) {
  if (typeof v === 'number') return v;
  const m = String(v).match(/^(-)?(\w+)(?:\*([\d.]+))?$/);
  if (!m) return 0;
  const base = inst.vars[m[2]] ?? 0;
  return (m[1] ? -1 : 1) * base * (m[3] ? Number(m[3]) : 1);
}

// Turn scenario fx into engine effects (names resolved, numbers computed).
export function resolveFx(fx, inst, state) {
  if (!fx) return null;
  const out = {};
  for (const [k, v] of Object.entries(fx)) {
    if (['trust', 'rep', 'followers', 'wealth', 'pfm', 'form', 'tacticalFit', 'parental', 'monthlySupport', 'suspension', 'lifestyle', 'potential', 'crushHeat', 'sibBond', 'exBond', 'agentBond', 'wealthWeeks', 'wageRaise', 'supportWeeks', 'agentCut', ...LIFE_FX].includes(k)) out[k] = num(v, inst);
    else if (k === 'bond') { out.bond = num(v, inst); out.bondWho = out.bondWho ?? inst.names.T; }
    else if (k === 'crush') out.crush = v === null ? null : { name: inst.names[v.who ?? 'F'], heat: v.heat ?? 30, where: v.where ?? null };
    else if (k === 'newManager') out.newManager = !!v;
    else if (k === 'teammate') out.teammate = { name: inst.names[v.who ?? 'T'], rel: v.rel };
    else if (k === 'partner') out.partner = v.status === 'none' ? { name: '', status: 'none' } : { name: v.who ? inst.names[v.who] : state.player.partner.name, status: v.status };
    else if (k === 'agent' && v === null) out.agent = null; // fire the agent
    else if (k === 'agent') out.agent = { name: inst.names[v.who ?? 'A'], quality: randint(v.quality?.[0] ?? 40, v.quality?.[1] ?? 70), cut: v.cut ?? 10 };
    else if (k === 'endorsement') out.endorsement = { brand: fill(v.brand, inst, state), type: v.type ?? 'regional', annualValue: num(v.value, inst), years: v.years ?? 2 };
    else if (k === 'cast') out.cast = Object.fromEntries(Object.entries(v).map(([key, who]) => [key, inst.names[who] ?? who]));
    else if (k === 'chain') out.thread = { id: v.id, inWeeks: randint(v.in[0], v.in[1]), data: inst };
    else out[k] = v; // growth, stat, mood, injury, listed, flag, unflag, matchMod
  }
  return out;
}

function rollCheck(check, state, extra = {}) {
  const p = state.player;
  const k = check.stat;
  const value = ATTRS[k] || LEGACY_STATS[k] ? attrValue(p, k)
    : k === 'trust' ? p.manager.trust : k === 'rep' ? p.reputation : k === 'parental' ? p.family.parentalSupport
      : k === 'pfm' ? p.pfm : k === 'agent' ? (p.agent?.quality ?? 20) : k === 'tacticalFit' ? p.manager.tacticalFit
        : k === 'bond' ? (extra.bond ?? 50) : k === 'crushHeat' ? (p.crush?.heat ?? 30) : LIFE_RANGES.includes(k) ? (meter(p, k) ?? 40) : overall(p);
  return value + gauss() * 10 >= check.dc;
}

export function resolveChoice(state, s, inst, choiceId, extra = {}) {
  const idx = Math.max(0, Number(choiceId));
  const c = s.choices[idx] ?? s.choices[0];
  let out;
  if (c.check) out = rollCheck(c.check, state, extra) ? c.ok : c.bad;
  else if (c.out) out = weightedPick(c.out, (o) => o.w ?? 1);
  else out = c;
  return { text: fill(pickText(out.text ?? '', state), inst, state), fx: resolveFx(out.fx, inst, state), label: fill(c.label, inst, state) };
}

// Which parts of life a choice can touch (shown as icons on the choice button).
const FX_ASPECT = {
  trust: 'trust', tacticalFit: 'trust', newManager: 'trust', board: 'board', listed: 'board', dressing: 'dressing', teammate: 'dressing', fans: 'fans',
  press: 'press', image: 'image', rep: 'image', followers: 'social', wealth: 'money', lifestyle: 'money', monthlySupport: 'money', endorsement: 'money', agent: 'money',
  parental: 'family', family: 'family', love: 'love', partner: 'love', friends: 'friends', morale: 'morale', mood: 'morale', stress: 'stress',
  pfm: 'body', injury: 'body', suspension: 'body', growth: 'skills', stat: 'skills', form: 'form', matchMod: 'match',
  bond: 'dressing', crush: 'love', crushHeat: 'love', partnerNear: 'love', partnerVisit: 'love', partnerFromCrush: 'love', kid: 'family', sibBond: 'family', exBond: 'love', agentBond: 'money', wealthWeeks: 'money', assetLoss: 'money',
};
export function aspectsOf(c) {
  const outs = c.check ? [c.ok, c.bad] : c.out ? c.out : [c];
  const set = new Set();
  for (const o of outs) for (const k of Object.keys(o?.fx ?? {})) if (FX_ASPECT[k]) set.add(FX_ASPECT[k]);
  return [...set];
}

export function decisionFor(s, inst, state) {
  const ctx = s.choices.some((c) => c.when) ? scenarioContext(state, null) : null;
  const choices = s.choices.map((c, i) => [c, i]).filter(([c]) => !c.when || conditionsMet(c.when, ctx));
  return {
    kind: 'scenario', sid: s.id, data: inst, cat: s.cat, ui: s.ui ?? null, type: s.dtype ?? (s.moment ? 'in-match' : s.cat),
    prompt: fill(s.prompt ?? s.title, inst, state),
    choices: (choices.length ? choices : [[s.choices[0], 0]]).map(([c, i]) => ({ id: String(i), label: fill(c.label, inst, state), description: fill(c.desc ?? '', inst, state), risk: c.risk ?? 'medium', consequence: fill(c.hint ?? '', inst, state), aspects: aspectsOf(c) })),
  };
}

// Text variants can be plain strings or { when, t } objects that only appear when their conditions hold
// (so a scene can read differently after a win, abroad, when married…). Matching conditional variants are favoured.
export function pickText(t, state, world = null) {
  if (!Array.isArray(t)) return typeof t === 'object' && t ? t.t : t;
  if (!t.some((x) => typeof x === 'object')) return pick(t);
  const ctx = scenarioContext(state, world ?? { scenarios: [] });
  const ok = t.filter((x) => typeof x === 'string' || conditionsMet(x.when, ctx));
  const chosen = weightedPick(ok, (x) => (typeof x === 'string' ? 1 : 2.5)) ?? t.find((x) => typeof x === 'string') ?? t[0];
  return typeof chosen === 'string' ? chosen : chosen.t;
}

export function textOf(s, inst, state) {
  return fill(pickText(s.text, state), inst, state);
}

export const clampFx = clamp;
