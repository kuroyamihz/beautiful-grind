// The squad: everyone the player shares a dressing room with. Created when he joins a club and kept while he
// stays: teammates age, improve, decline, get injured, are sold or released, retire, and new players arrive in
// every transfer window. Story scenarios pick their teammates ({T}) from this list, so names stay consistent.
// Also builds match details: line-ups, substitutions, goal events, team stats (xG, shots, possession) and the
// player's own position-specific match stats.
import { chance, clamp, gauss, pick, randint, round1, seeded, shuffle, weightedPick, uid, poisson } from './util.js';
import { personName, foreignCountry, overall, attrValue } from './player.js';
import { GOAL_SHARE, ASSIST_SHARE } from './config.js';

export const SHAPE = { GK: 3, CB: 4, FB: 4, DM: 2, CM: 3, AM: 2, W: 3, ST: 3 };
export const FORMATIONS = {
  '4-3-3': ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'CM', 'W', 'ST', 'W'],
  '4-2-3-1': ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'W', 'AM', 'W', 'ST'],
  '4-4-2': ['GK', 'FB', 'CB', 'CB', 'FB', 'W', 'CM', 'CM', 'W', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'FB', 'ST', 'ST'],
};
const NEAR = { GK: ['GK'], CB: ['CB', 'DM', 'FB'], FB: ['FB', 'CB', 'W'], DM: ['DM', 'CM', 'CB'], CM: ['CM', 'DM', 'AM'], AM: ['AM', 'CM', 'W'], W: ['W', 'AM', 'FB', 'ST'], ST: ['ST', 'W', 'AM'] };
export const TRAITS = {
  joker: 'The dressing-room joker', leader: 'A natural leader', quiet: 'Quiet, keeps to himself', hothead: 'Short fuse',
  mentor: 'Looks after the young ones', partyboy: 'Never misses a night out', devout: 'Deeply religious', gamer: 'Lives on his console',
  professional: 'Model professional', fashion: 'Dresses for the tunnel cameras', family: 'Family man', gossip: 'Knows everyone\'s business',
};
const TRAIT_KEYS = Object.keys(TRAITS);
// Share of home-grown players in a typical squad (the rest are foreign signings).
const LOCAL_SHARE = { England: 0.38, Spain: 0.6, Germany: 0.5, Italy: 0.42, France: 0.55, Portugal: 0.45, Netherlands: 0.6, Belgium: 0.42, Turkey: 0.55, Scotland: 0.6, 'Saudi Arabia': 0.62, Qatar: 0.55, 'United Arab Emirates': 0.6, 'United States': 0.62, Japan: 0.88, 'South Korea': 0.85, Indonesia: 0.78, Thailand: 0.78, Malaysia: 0.7 };
const NUMBERS = { GK: [1, 13, 31, 40], CB: [4, 5, 6, 15, 3, 34], FB: [2, 3, 12, 22, 27], DM: [6, 16, 18, 21], CM: [8, 14, 17, 20, 28], AM: [10, 19, 23, 26], W: [7, 11, 77, 29, 30], ST: [9, 19, 33, 99, 39] };

export const ageOf = (m, week) => Math.floor((week - m.born) / 52.18);
const relFromBond = (b) => (b >= 68 ? 'ally' : b <= 14 ? 'enemy' : b <= 30 ? 'rival' : 'neutral');

function newMember(state, country, pos, str, { age = null, rng = Math.random, foreignP = null, joined = null } = {}) {
  const local = rng() < (foreignP !== null ? 1 - foreignP : LOCAL_SHARE[country] ?? 0.78);
  const nat = local ? country : foreignCountry(rng, country);
  const a = age ?? Math.round(clamp(18 + rng() * 15 + (rng() - 0.5) * 2, 17, 36));
  const youthPenalty = a <= 19 ? 6 : a <= 21 ? 3 : a >= 33 ? 2 : 0;
  return {
    id: uid(), name: personName(nat, false, rng), pos, nat, born: (state?.week ?? 0) - a * 52 - Math.floor(rng() * 52),
    ovr: Math.round(clamp(str - youthPenalty + gauss() * 3.5 + (local ? 0 : 1.5), 30, 94)), num: 0,
    bond: Math.round(clamp(46 + gauss() * 8, 25, 66)), rel: 'neutral', traits: [TRAIT_KEYS[Math.floor(rng() * TRAIT_KEYS.length)]],
    joined: joined ?? state?.week ?? 0, inj: 0, apps: 0, goals: 0,
  };
}

function assignNumbers(squad, playerNum) {
  const used = new Set([playerNum]);
  for (const m of squad.members) if (m.num && !used.has(m.num)) used.add(m.num); else m.num = 0;
  for (const m of squad.members.filter((x) => !x.num)) {
    const pref = (NUMBERS[m.pos] ?? []).find((n) => !used.has(n));
    let n = pref ?? randint(2, 45);
    while (used.has(n)) n = randint(2, 99);
    m.num = n; used.add(n);
  }
}

// A fresh squad for the player's new club. `str` = club strength (comparable to OVR).
export function createSquad(state, club, country, str, ageYears = 16) {
  const p = state.player;
  const formation = Object.keys(FORMATIONS)[Math.floor(seeded(club)() * 4)];
  const members = [];
  for (const [pos, n] of Object.entries(SHAPE)) {
    const count = pos === p.position ? n - 1 : n;
    for (let i = 0; i < count; i++) {
      const m = newMember(state, country, pos, str + 2 - i * 3);
      members.push(m);
    }
  }
  const squad = { club, country, str, formation, members, captainId: null, news: [], since: state.week };
  // Day one: one teammate takes him under his wing; the man in his position sizes him up.
  const age = ageYears;
  const friend = pick(members.filter((m) => m.pos !== p.position && Math.abs(ageOf(m, state.week) - age) <= 6)) ?? pick(members);
  friend.bond = 70; friend.rel = 'ally';
  const comp = members.filter((m) => m.pos === p.position).sort((a, b) => Math.abs(a.ovr - overall(p)) - Math.abs(b.ovr - overall(p)))[0];
  if (comp) { comp.bond = 38; comp.competitor = true; }
  pickCaptain(state, squad);
  assignNumbers(squad, p.number);
  return squad;
}

function pickCaptain(state, squad) {
  const pool = squad.members.filter((m) => ageOf(m, state.week) >= 25);
  const best = (pool.length ? pool : squad.members).sort((a, b) => (b.ovr + ageOf(b, state.week) * 0.8 + (b.traits.includes('leader') ? 6 : 0)) - (a.ovr + ageOf(a, state.week) * 0.8 + (a.traits.includes('leader') ? 6 : 0)))[0];
  squad.captainId = best?.id ?? null;
  if (state.player.circle && best) state.player.circle.captain = best.name;
}

export const captainOf = (state) => state.squad?.members.find((m) => m.id === state.squad.captainId) ?? null;
export const memberByName = (state, name) => state.squad?.members.find((m) => m.name === name) ?? null;

// keyTeammates (the people the story knows) = everyone he isn't neutral with, plus his rival for the shirt.
export function syncKeyTeammates(state) {
  const p = state.player;
  const sq = state.squad;
  const outside = (p.keyTeammates ?? []).filter((t) => t.outside);
  const inside = sq ? sq.members.filter((m) => m.rel !== 'neutral').map((m) => ({ name: m.name, relationship: m.rel })) : [];
  p.keyTeammates = [...inside, ...outside.slice(-2)].slice(-8);
}

export function setBond(state, m, delta) {
  m.bond = clamp(Math.round(m.bond + delta), 0, 100);
  m.rel = relFromBond(m.bond);
  syncKeyTeammates(state);
}

// A scenario said "{T} is now an ally/rival/…". Keep the squad in line with the story.
export function setRelationship(state, name, rel) {
  const m = memberByName(state, name);
  if (!m) {
    const p = state.player;
    const t = p.keyTeammates.find((x) => x.name === name);
    if (t) t.relationship = rel; else p.keyTeammates.push({ name, relationship: rel, outside: true });
    return;
  }
  m.bond = { ally: Math.max(m.bond, 72), neutral: 50, rival: Math.min(m.bond, 28), enemy: Math.min(m.bond, 12) }[rel] ?? m.bond;
  m.rel = rel;
  syncKeyTeammates(state);
}

// Teammates for story text. Modes: ally, rival, any, new (someone he isn't close to yet), peer (same position,
// similar age), signing (a brand-new arrival in his position, added to the squad), outsider (not at the club).
export function teammateFor(state, mode, exclude = [], ageYears = 18) {
  const sq = state.squad;
  const p = state.player;
  if (!sq || mode === 'outsider') return null;
  const pool = sq.members.filter((m) => !exclude.includes(m.name));
  if (mode === 'ally') return pick(pool.filter((m) => m.rel === 'ally'))?.name ?? null;
  if (mode === 'rival') return pick(pool.filter((m) => ['rival', 'enemy'].includes(m.rel)))?.name ?? null;
  if (mode === 'any') return pick(pool)?.name ?? null;
  if (mode === 'peer') {
    const age = ageYears;
    return (pool.filter((m) => m.pos === p.position).sort((a, b) => Math.abs(ageOf(a, state.week) - age) - Math.abs(ageOf(b, state.week) - age))[0])?.name ?? pick(pool)?.name ?? null;
  }
  if (mode === 'signing') {
    const m = newMember(state, sq.country, p.position, Math.max(sq.str, overall(p) + 2), { age: randint(24, 30), foreignP: 0.5 });
    sq.members.push(m); assignNumbers(sq, p.number);
    sq.news = [...sq.news, { week: state.week, type: 'in', name: m.name, pos: m.pos, text: `${m.name} signs` }].slice(-30);
    return m.name;
  }
  return pick(pool.filter((m) => m.rel === 'neutral'))?.name ?? pick(pool)?.name ?? null;
}

// ── Weekly and seasonal life of the squad ──
export function squadWeek(state, world, res, { windowOpen, monthStart }) {
  const sq = state.squad;
  if (!sq) return;
  for (const m of sq.members) {
    if (m.inj > 0) m.inj--;
    else if (chance(0.018)) m.inj = randint(1, 7);
  }
  if (!(windowOpen && monthStart)) return;
  // Transfer window: some leave, some arrive.
  const news = [];
  const out = [];
  for (const m of shuffle(sq.members)) {
    if (out.length >= 3) break;
    const age = ageOf(m, state.week);
    let pr = 0.05;
    if (age >= 32) pr += 0.12;
    if (m.ovr < sq.str - 8) pr += 0.12;
    if (m.ovr >= sq.str + 6) pr += 0.08;
    if (m.id === sq.captainId) pr *= 0.4;
    if (chance(pr)) out.push(m);
  }
  for (const m of out) {
    const bigger = m.ovr >= sq.str + 4;
    const dest = bigger ? 'a bigger club abroad' : ageOf(m, state.week) >= 33 ? 'a club in the lower leagues' : 'a rival in the league';
    news.push({ week: state.week, type: 'out', name: m.name, pos: m.pos, rel: m.rel, text: `${m.name} leaves for ${dest}` });
    sq.members = sq.members.filter((x) => x !== m);
    if (m.rel === 'ally') res.triggers?.push('allyLeft');
  }
  // Fill holes in the shape, plus the odd extra signing.
  const need = Object.entries(SHAPE).flatMap(([pos, n]) => Array.from({ length: Math.max(0, n - (pos === state.player.position ? 1 : 0) - sq.members.filter((m) => m.pos === pos).length) }, () => pos));
  if (chance(0.4)) need.push(pick(Object.keys(SHAPE)));
  for (const pos of need.slice(0, 4)) {
    const m = newMember(state, sq.country, pos, sq.str + 1, { age: randint(20, 30), foreignP: 0.45 });
    sq.members.push(m);
    news.push({ week: state.week, type: 'in', name: m.name, pos: m.pos, text: `${m.name} (${m.pos}, ${m.nat}) signs` });
  }
  assignNumbers(sq, state.player.number);
  if (!sq.members.some((m) => m.id === sq.captainId)) { pickCaptain(state, sq); news.push({ week: state.week, type: 'captain', name: state.player.circle?.captain, text: `${state.player.circle?.captain} is the new captain` }); }
  syncKeyTeammates(state);
  if (news.length) { sq.news = [...sq.news, ...news].slice(-30); res.squadNews = news; }
}

// Once a season: everyone gets a year older, better or worse; veterans retire, academy kids come up.
export function squadSeason(state, res) {
  const sq = state.squad;
  if (!sq) return;
  const news = [];
  for (const m of [...sq.members]) {
    const age = ageOf(m, state.week);
    m.ovr = Math.round(clamp(m.ovr + (age <= 22 ? randint(1, 4) : age <= 28 ? randint(-1, 2) : age <= 31 ? randint(-2, 1) : randint(-4, 0)), 30, 94));
    if (age >= 37 || (age >= 34 && chance(0.4))) {
      sq.members = sq.members.filter((x) => x !== m);
      news.push({ week: state.week, type: 'retire', name: m.name, pos: m.pos, rel: m.rel, text: `${m.name} retires at ${age}` });
    }
    m.apps = 0; m.goals = 0;
  }
  for (let i = 0; i < randint(1, 2); i++) {
    const m = newMember(state, sq.country, pick(Object.keys(SHAPE)), sq.str - 4, { age: 17, foreignP: 0 });
    sq.members.push(m);
    news.push({ week: state.week, type: 'youth', name: m.name, pos: m.pos, text: `Academy graduate ${m.name} joins the first team` });
  }
  assignNumbers(sq, state.player.number);
  if (!sq.members.some((m) => m.id === sq.captainId)) pickCaptain(state, sq);
  syncKeyTeammates(state);
  if (news.length) { sq.news = [...sq.news, ...news].slice(-30); res.squadNews = [...(res.squadNews ?? []), ...news]; }
}

// ── Match day ──
const opponentSquadCache = new Map();
// The other team's players are the same every time you meet them this season (seeded by club + year).
export function opponentSquad(club, country, str, year, localShare = null) {
  const key = `${club}|${year}`;
  if (opponentSquadCache.has(key)) return opponentSquadCache.get(key);
  const rng = seeded(key);
  const members = [];
  for (const [pos, n] of Object.entries({ GK: 2, CB: 3, FB: 3, DM: 2, CM: 2, AM: 2, W: 3, ST: 2 })) {
    for (let i = 0; i < n; i++) {
      const local = rng() < (localShare ?? LOCAL_SHARE[country] ?? 0.78);
      const nat = local ? country : foreignCountry(rng, country);
      members.push({ id: `${club}-${pos}-${i}`, name: personName(nat, false, rng), pos, nat, ovr: Math.round(str + 2 - i * 4 + (rng() - 0.5) * 6), num: 0 });
    }
  }
  const used = new Set();
  for (const m of members) { let n = (NUMBERS[m.pos] ?? [])[members.filter((x) => x.pos === m.pos).indexOf(m)] ?? Math.floor(rng() * 40) + 2; while (used.has(n)) n++; m.num = n; used.add(n); }
  const s = { club, formation: Object.keys(FORMATIONS)[Math.floor(seeded(club)() * 4)], members };
  if (opponentSquadCache.size > 200) opponentSquadCache.clear();
  opponentSquadCache.set(key, s);
  return s;
}

function chooseXI(members, formation, reserved = null) {
  const slots = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  const avail = members.filter((m) => !(m.inj > 0));
  const xi = [];
  const taken = new Set();
  slots.forEach((slot, i) => {
    if (reserved && reserved.slot === i) { xi.push({ ...reserved.m, slot }); return; }
    const cands = avail.filter((m) => !taken.has(m.id) && NEAR[slot].includes(m.pos));
    const best = cands.sort((a, b) => (b.ovr + (b.pos === slot ? 4 : 0) + gauss() * 2) - (a.ovr + (a.pos === slot ? 4 : 0) + gauss() * 2))[0]
      ?? avail.find((m) => !taken.has(m.id));
    if (best) { taken.add(best.id); xi.push({ ...best, slot }); }
  });
  const bench = avail.filter((m) => !taken.has(m.id) && (!reserved || m.id !== reserved.m.id)).sort((a, b) => b.ovr - a.ovr);
  const gk = bench.find((m) => m.pos === 'GK');
  const subs = [gk, ...bench.filter((m) => m !== gk)].filter(Boolean).slice(0, 7);
  return { xi, subs };
}

const fmtXg = (x) => Math.round(x * 100) / 100;

// Everything about one of his matches: line-ups, events, stats. `m` comes from the engine's match core.
export function buildMatchDetail(state, m, { myStr, oppStr, oppCountry, year, mySquad = null }) {
  const p = state.player;
  const me = { id: 'me', name: p.name, short: p.jerseyName, pos: p.position, num: p.number, ovr: overall(p), me: true };
  const own = mySquad ?? state.squad ?? { members: [], formation: '4-3-3' };
  const formation = own.formation ?? '4-3-3';
  const slots = FORMATIONS[formation];
  const mySlot = Math.max(0, slots.findIndex((s) => s === p.position) >= 0 ? slots.findIndex((s) => s === p.position) : slots.findIndex((s) => NEAR[s].includes(p.position)));
  const home = chooseXI(own.members, formation, m.started ? { slot: mySlot, m: me } : null);
  const opp = opponentSquad(m.opp, oppCountry, oppStr, year);
  const away = chooseXI(opp.members, opp.formation);
  if (!m.started && m.minutes > 0) home.subs = [me, ...home.subs.slice(0, 6)];
  // Substitutions
  const subsFor = (side, playerOff = null, playerOn = null) => {
    const events = [];
    const n = randint(3, 5);
    const offPool = side.xi.filter((x) => x.slot !== 'GK' && !x.me);
    const onPool = side.subs.filter((x) => x.pos !== 'GK' && !x.me);
    if (playerOff) { const on = onPool.shift(); if (on) events.push({ min: playerOff, type: 'sub', off: me.short, on: on.name, onId: on.id, offId: 'me' }); }
    if (playerOn) { const off = offPool.sort((a, b) => a.ovr - b.ovr).find((x) => NEAR[x.slot].includes(p.position)) ?? offPool[0]; if (off) { events.push({ min: playerOn, type: 'sub', off: off.name, on: me.short, onId: 'me', offId: off.id }); offPool.splice(offPool.indexOf(off), 1); } }
    while (events.length < n && offPool.length && onPool.length) {
      const off = offPool.splice(randint(0, offPool.length - 1), 1)[0];
      const on = onPool.shift();
      events.push({ min: randint(55, 88), type: 'sub', off: off.name, on: on.name, onId: on.id, offId: off.id });
    }
    return events;
  };
  const enterMin = m.started ? 0 : m.minutes > 0 ? 90 - m.minutes : null;
  const leaveMin = m.started && m.minutes < 90 ? m.minutes : null;
  const mySubs = subsFor(home, leaveMin, !m.started && m.minutes > 0 ? enterMin : null);
  const oppSubs = subsFor(away);
  const onPitch = (side, subs, minute) => {
    const off = new Set(subs.filter((s) => s.min <= minute).map((s) => s.offId));
    const on = subs.filter((s) => s.min <= minute).map((s) => s.onId === 'me' ? me : side.subs.find((x) => x.id === s.onId)).filter(Boolean);
    return [...side.xi.filter((x) => !off.has(x.id)), ...on];
  };
  // Goals: his own first (inside the minutes he was on the pitch), then the rest.
  const window = [enterMin ?? 0, leaveMin ?? 90];
  const myGoalMins = Array.from({ length: m.goals }, () => randint(Math.max(1, window[0] + 1), Math.max(window[0] + 1, window[1]))).sort((a, b) => a - b);
  m.goalMinutes = myGoalMins;
  const events = [];
  const scorerPick = (pool, excludeId) => weightedPick(pool.filter((x) => x.id !== excludeId && x.pos !== 'GK'), (x) => (GOAL_SHARE[x.pos] + 0.02) * Math.exp((x.ovr - 60) / 20)) ?? pool[0];
  const assistPick = (pool, excludeId) => weightedPick(pool.filter((x) => x.id !== excludeId), (x) => (ASSIST_SHARE[x.pos] + 0.02) * Math.exp((x.ovr - 60) / 20));
  for (const min of myGoalMins) {
    const pool = onPitch(home, mySubs, min);
    const a = chance(0.75) ? assistPick(pool, 'me') : null;
    events.push({ min, type: 'goal', side: 'my', scorer: me.short, scorerId: 'me', assist: a?.name ?? null, assistId: a?.id ?? null });
  }
  let myAssists = m.assists;
  for (let g = m.goals; g < m.gf; g++) {
    const lo = myAssists > 0 ? window[0] + 1 : 1, hi = myAssists > 0 ? window[1] : 90;
    const min = randint(Math.max(1, lo), Math.max(lo, hi));
    const pool = onPitch(home, mySubs, min).filter((x) => !x.me);
    const sc = scorerPick(pool.length ? pool : home.xi.filter((x) => !x.me), null);
    let assist = null, assistId = null;
    if (myAssists > 0) { assist = me.short; assistId = 'me'; myAssists--; }
    else if (chance(0.72)) { const a = assistPick(pool, sc?.id); assist = a?.name ?? null; assistId = a?.id ?? null; }
    const pen = assistId !== 'me' && chance(0.08);
    events.push({ min, type: 'goal', side: 'my', scorer: sc?.name ?? 'Own goal', scorerId: sc?.id, assist: pen ? null : assist, assistId: pen ? null : assistId, pen });
  }
  for (let g = 0; g < m.ga; g++) {
    const min = randint(1, 90);
    const pool = onPitch(away, oppSubs, min);
    const sc = scorerPick(pool, null);
    const a = chance(0.7) ? assistPick(pool, sc?.id) : null;
    events.push({ min, type: 'goal', side: 'opp', scorer: sc?.name ?? 'Own goal', scorerId: sc?.id, assist: a?.name ?? null, assistId: a?.id ?? null });
  }
  // Cards
  const cards = [];
  if (m.yellow && m.minutes > 0) cards.push({ min: randint(window[0] + 1, window[1]), type: 'yellow', side: 'my', name: me.short, id: 'me' });
  if (m.red && m.minutes > 0) cards.push({ min: randint(Math.max(window[0] + 20, 30), Math.max(window[0] + 21, window[1])), type: 'red', side: 'my', name: me.short, id: 'me' });
  for (const [side, team, subs] of [['my', home, mySubs], ['opp', away, oppSubs]]) {
    for (let i = 0; i < poisson(side === 'my' ? 1.4 : 1.8); i++) { const min = randint(5, 90); const pl = pick(onPitch(team, subs, min).filter((x) => !x.me)); if (pl) cards.push({ min, type: chance(0.03) ? 'red' : 'yellow', side, name: pl.name, id: pl.id }); }
  }
  events.push(...cards, ...mySubs.map((s) => ({ ...s, side: 'my' })), ...oppSubs.map((s) => ({ ...s, side: 'opp' })));
  events.sort((a, b) => a.min - b.min);
  // Team stats, consistent with the score: xG mixes the goals with how good the chances "should" have been.
  const diff = ((m.home ? myStr : oppStr) - (m.home ? oppStr : myStr)) / 22;
  const lamH = clamp(1.35 * Math.exp(diff + 0.1), 0.15, 4.5), lamA = clamp(1.1 * Math.exp(-diff), 0.15, 4.5);
  const lamMy = m.home ? lamH : lamA, lamOpp = m.home ? lamA : lamH;
  const xgMy = fmtXg(clamp(0.55 * m.gf + 0.45 * lamMy + gauss() * 0.25, 0.08, 6));
  const xgOpp = fmtXg(clamp(0.55 * m.ga + 0.45 * lamOpp + gauss() * 0.25, 0.08, 6));
  const poss = Math.round(clamp(50 + (myStr - oppStr) * 0.7 + (m.home ? 2 : -2) + gauss() * 4, 27, 75));
  const teamStats = (xg, goals, possession, str) => {
    const shots = Math.max(goals + 1, Math.round(xg / 0.105 + gauss() * 2));
    const onT = Math.min(shots, goals + Math.round((shots - goals) * (0.22 + Math.random() * 0.2)));
    const passes = Math.max(150, Math.round(possession * 9.4 + gauss() * 30));
    return { xg, shots, onTarget: onT, possession, passes, passAcc: Math.round(clamp(72 + (str - 55) * 0.35 + (possession - 50) * 0.25 + gauss() * 3, 58, 93)), corners: poisson(1.5 + shots * 0.25), fouls: poisson(11), offsides: poisson(1.7), bigChances: Math.max(goals > 0 ? 1 : 0, Math.round(xg / 0.38 + gauss() * 0.6)) };
  };
  const st = { my: teamStats(xgMy, m.gf, poss, myStr), opp: teamStats(xgOpp, m.ga, 100 - poss, oppStr) };
  st.my.saves = Math.max(0, st.opp.onTarget - m.ga); st.opp.saves = Math.max(0, st.my.onTarget - m.gf);
  st.my.yellows = cards.filter((c) => c.side === 'my' && c.type === 'yellow').length; st.opp.yellows = cards.filter((c) => c.side === 'opp' && c.type === 'yellow').length;
  // Ratings for everyone (his own comes from the engine)
  const rate = (pl, side) => {
    if (pl.me) return m.rating;
    const res = side === 'my' ? m.result : m.result === 'W' ? 'L' : m.result === 'L' ? 'W' : 'D';
    let r = 6.5 + (res === 'W' ? 0.3 : res === 'L' ? -0.3 : 0) + gauss() * 0.45 + (pl.ovr - 60) * 0.01;
    r += events.filter((e) => e.type === 'goal' && e.scorerId === pl.id).length * 0.8 + events.filter((e) => e.type === 'goal' && e.assistId === pl.id).length * 0.4;
    if (pl.pos === 'GK') r += (side === 'my' ? m.ga : m.gf) === 0 ? 0.5 : -0.2 * Math.max(0, (side === 'my' ? m.ga : m.gf) - 1);
    if (cards.some((c) => c.id === pl.id && c.type === 'red')) r -= 1.2;
    return round1(clamp(r, 4.5, 9.8));
  };
  const lineup = (side, team) => team.xi.map((x) => ({ id: x.id, name: x.me ? x.short : x.name, pos: x.slot, num: x.num, me: !!x.me, rating: rate(x, side) }));
  const bench = (side, team, subs) => team.subs.map((x) => { const came = subs.find((s) => s.onId === x.id); return { id: x.id, name: x.me ? x.short : x.name, pos: x.pos, num: x.num, me: !!x.me, on: came?.min ?? null, rating: came ? rate(x, side) : null }; });
  const lineups = { my: { formation, xi: lineup('my', home), bench: bench('my', home, mySubs) }, opp: { formation: opp.formation, xi: lineup('opp', away), bench: bench('opp', away, oppSubs) } };
  // MOTM consistency: if he got it, nobody else beats him; if not, someone else is top.
  const everyone = [...lineups.my.xi, ...lineups.my.bench.filter((x) => x.rating), ...lineups.opp.xi, ...lineups.opp.bench.filter((x) => x.rating)];
  if (m.motm) for (const x of everyone) if (!x.me && x.rating >= m.rating) x.rating = round1(m.rating - 0.1 - Math.random() * 0.4);
  const top = everyone.filter((x) => !x.me).sort((a, b) => b.rating - a.rating)[0];
  if (!m.motm && m.minutes > 0 && top && top.rating <= m.rating) top.rating = round1(Math.min(9.8, m.rating + 0.2 + Math.random() * 0.3));
  const motm = m.motm ? me.short : top?.name ?? null;
  // Credit squad members with apps and goals (the squad list shows them).
  if (state.squad && !mySquad) for (const x of [...lineups.my.xi, ...lineups.my.bench.filter((b) => b.on !== null)]) {
    const sm = state.squad.members.find((y) => y.id === x.id);
    if (sm) { sm.apps++; sm.goals += events.filter((e) => e.type === 'goal' && e.side === 'my' && e.scorerId === sm.id).length; }
  }
  return { formation, lineups, events, stats: st, motm, personal: personalStats(p, m, st) };
}

// His own numbers, chosen for his position: a goalkeeper gets saves, a centre-back clearances and aerial duels,
// a winger dribbles and crosses, a striker shots and xG.
function personalStats(p, m, st) {
  if (!m.minutes) return null;
  const f = m.minutes / 90;
  const good = (m.rating - 6.5);
  const n = (base) => Math.max(0, Math.round((base + good * base * 0.25) * f + gauss() * Math.sqrt(Math.max(base, 0.5)) * 0.6));
  const acc = (key, base) => Math.round(clamp(base + (attrValue(p, key) - 60) * 0.25 + good * 2 + gauss() * 3, 45, 98));
  const out = [];
  const add = (label, value, key = null) => out.push({ label, value, key });
  const shotsOf = (base) => {
    const shots = Math.max(m.goals, n(base));
    const onT = Math.min(shots, m.goals + Math.round((shots - m.goals) * (0.3 + Math.random() * 0.25)));
    const xg = fmtXg(clamp(m.goals * 0.32 + (shots - m.goals) * 0.08 + Math.random() * 0.1, 0, st.my.xg));
    return { shots, onT, xg };
  };
  switch (p.position) {
    case 'GK': {
      const saves = Math.max(0, Math.round(st.my.saves * f));
      add('Saves', saves); add('Goals conceded', m.ga); add('Save %', saves + m.ga ? `${Math.round(100 * saves / (saves + m.ga))}%` : '—');
      add('Clean sheet', m.ga === 0 && m.minutes >= 60 ? 'Yes' : 'No'); add('Claims & punches', n(2.2));
      const passes = n(32); add('Passes', `${Math.round(passes * acc('distribution', 74) / 100)}/${passes}`); add('Long balls won', `${n(4)}/${n(8) + 2}`); add('Sweeper actions', n(1));
      break;
    }
    case 'CB': {
      const passes = n(58); add('Passes', `${Math.round(passes * acc('ballPlaying', 86) / 100)}/${passes}`); add('Tackles', n(1.8)); add('Interceptions', n(1.6));
      add('Clearances', n(4.5)); const air = n(5) + 1; add('Aerial duels won', `${Math.min(air, n(3.2))}/${air}`); add('Blocks', n(0.7)); add('Progressive passes', n(4));
      if (m.goals) add('Goals', m.goals);
      break;
    }
    case 'FB': {
      const passes = n(44); add('Passes', `${Math.round(passes * acc('crossing', 81) / 100)}/${passes}`); add('Tackles', n(2)); add('Interceptions', n(1.3));
      const cr = n(4) + (m.assists ? 1 : 0); add('Crosses (accurate)', `${Math.min(cr, Math.round(cr * acc('crossing', 32) / 100) + m.assists)}/${cr}`); add('Key passes', n(1) + m.assists);
      add('Dribbles', `${n(1)}/${n(1.6) + 1}`); add('Duels won', n(5));
      break;
    }
    case 'DM': {
      const passes = n(66); add('Passes', `${Math.round(passes * acc('passing', 87) / 100)}/${passes}`); add('Tackles', n(2.6)); add('Interceptions', n(2));
      add('Ball recoveries', n(6.5)); add('Progressive passes', n(6)); add('Duels won', n(6)); add('Fouls', n(1.3));
      break;
    }
    case 'CM': {
      const passes = n(58); add('Passes', `${Math.round(passes * acc('passing', 85) / 100)}/${passes}`); add('Key passes', n(1.5) + m.assists); add('Chances created', n(1.8) + m.assists);
      const s = shotsOf(1.2); add('Shots (on target)', `${s.shots} (${s.onT})`); add('Dribbles', `${n(1.2)}/${n(2) + 1}`); add('Tackles', n(1.6));
      break;
    }
    case 'AM': {
      add('Key passes', n(2.4) + m.assists); add('Chances created', n(2.8) + m.assists); add('xA', fmtXg(clamp(m.assists * 0.35 + n(2.4) * 0.07, 0, 3)));
      const s = shotsOf(2.2); add('Shots (on target)', `${s.shots} (${s.onT})`); add('xG', s.xg); add('Dribbles', `${n(2)}/${n(3) + 1}`);
      const passes = n(42); add('Passes', `${Math.round(passes * acc('passing', 82) / 100)}/${passes}`);
      break;
    }
    case 'W': {
      const s = shotsOf(2.4); add('Shots (on target)', `${s.shots} (${s.onT})`); add('xG', s.xg); const dr = n(4.5) + 1; add('Dribbles', `${Math.min(dr, Math.round(dr * acc('dribbling', 52) / 100))}/${dr}`);
      const cr = n(4); add('Crosses (accurate)', `${Math.round(cr * acc('crossing', 30) / 100)}/${cr}`); add('Key passes', n(1.6) + m.assists); add('Touches in the box', n(5));
      break;
    }
    case 'ST': default: {
      const s = shotsOf(3.1); add('Shots (on target)', `${s.shots} (${s.onT})`); add('xG', s.xg); add('Touches in the box', n(7));
      const air = n(4) + 1; add('Aerial duels won', `${Math.min(air, n(2))}/${air}`); add('Key passes', n(1) + m.assists); add('Offsides', n(1.2)); add('Hold-up duels won', n(3));
      break;
    }
  }
  return out;
}

// A national team's squad (names seeded by nation and year, with the player in it).
export function nationalSquad(nation, str, year, label = nation) {
  return opponentSquad(`${label} national team`, nation, str, year, 1);
}
