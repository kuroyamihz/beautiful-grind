// The game engine: owns every number. One call to advanceWeek() = one game week.
import {
  START_DATE_UTC, GROWTH, PFM, INJURY, INJURY_TYPES, GOAL_SHARE, ASSIST_SHARE, TAX, DEFAULT_TAX, SOCIAL_BOOST, RAMADAN, DEBT,
} from './config.js';
import { chance, clamp, gauss, pick, randint, round1, uid, weightedPick, shuffle } from './util.js';
import { weekDate, weekOfDate, monthOf, yearOf, dateLabel, isFifaWeek, nthMondayWeek, ageAt, inRange } from './time.js';
import {
  leagueKey, splitKey, leagueDef, leagueQuality, leagueClubs, clubStrength, playableLeagues, isPlayable, clubsOf,
  seasonYearFor, seasonBounds, windowOpen, nationRank, countryFlag, seasonMonths,
} from './world.js';
import { buildSeason, catchUp, roundsInWeek, simScore, recordResult, simulateMatch, isComplete, standings } from './season.js';
import {
  overall, generateStats, weeklyWage, marketValue, trustRole, abilityRole, minRole, personName, managerName, moodFrom, relevantStats,
} from './player.js';
import {
  scenarioContext, pickScenario, markUsed, instantiate, resolveFx, resolveChoice, decisionFor, textOf, fill, conditionsMet,
} from './scenarios.js';
import {
  METER_KEYS, meter, addMeter, createCircle, clubCast, ripple, lifeWeek, lifeRatingMod, lifeInjuryMod, lifeAfterMatch, lifeMove,
  freeTimeLeft, freeTimeOptions, doFreeTime, migrateLife,
} from './life.js';
import { LIFE } from './config.js';

const DAY = 86400000;
const CUP_ROUND_NAMES = ['First round', 'Second round', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];

// ═══════════════════════════ NEW CAREER ═══════════════════════════
export function newCareer(world, o) {
  const key = o.leagueKey;
  const { country } = splitKey(key);
  const cs = clubStrength(o.club, key);
  const target = Math.round(clamp(Math.min(cs - 9, 60) + gauss() * 2, 40, 62));
  const p = {
    name: o.name, nickname: o.nickname || '', jerseyName: (o.jerseyName || o.name.split(' ').slice(-1)[0]).toUpperCase(),
    number: Number(o.number) || 24, position: o.position, nationality: o.nationality, flag: countryFlag(world, o.nationality),
    dob: START_DATE_UTC - Math.round(16 * 365.25 * DAY) - randint(0, 330) * DAY,
    stats: generateStats(o.position, target),
    pfm: 90, pfmCeiling: 100, form: 6.5, reputation: 1,
    followers: Math.round(randint(200, 900) * (SOCIAL_BOOST[o.nationality] ?? 1)),
    wealthEUR: 300, marketValue: 0, pendingBonus: 0,
    club: null,
    manager: { name: managerName(country), trust: 50, tacticalFit: 50 },
    squadRole: 'bench', transferListed: false,
    agent: null, partner: { name: '', status: 'none' }, family: { parentalSupport: 70, monthlySupport: 0 },
    keyTeammates: [{ name: personName(country), relationship: 'ally' }, { name: personName(country), relationship: 'neutral' }],
    national: { team: 'none', status: 'none', caps: 0, goals: 0, youthCaps: 0, youthGoals: 0, callUps: 0 },
    career: { apps: 0, goals: 0, assists: 0, motms: 0, trophies: [], awards: [], peakOverall: 0, peakMarketValue: 0, clubHistory: [], seasons: [] },
    season: { apps: 0, goals: 0, assists: 0, motms: 0, ratings: [], growthUsed: 0 },
    injury: null, injuryHistory: [], fragileWeeks: 0, suspension: 0, yellowCards: 0, endorsements: [], mood: 'Motivated',
    lifestyle: 1,
  };
  const state = {
    version: SAVE_VERSION, week: 0, player: p,
    seasons: {}, leagueClubs: {}, cup: null, pending: [], threads: [], log: [], history: [], flags: {},
    lastEventType: null, lastCats: [], last: null, ended: null, interlude: null,
  };
  joinClub(state, world, { club: o.club, key, wageWeekly: weeklyWage(overall(p), key), years: randint(2, 3), type: 'youth' });
  createCircle(state, world);
  p.squadRole = minRole(trustRole(p.manager.trust), abilityRole(overall(p), cs));
  p.career.peakOverall = overall(p);
  updateMarketValue(state);
  // Day one: an opening scene and first decision.
  const res = { matches: [], statChanges: {}, milestones: [], trophies: [], awards: [], notes: [], outcomes: [], intl: [], triggers: ['start'], events: [], ripples: [], life: {} };
  const s = pickScenario(state, world, scenarioContext(state, world, res), { triggers: ['start'] });
  if (s) { fireScenario(state, world, s, res); state.intro = { headline: res.event.headline, text: res.event.text }; }
  else state.intro = { headline: `${p.jerseyName}, 16, Joins ${p.club.name}'s First Team`, text: `Pre-season starts today at ${p.club.name}.` };
  state.lastEventType = null;
  return state;
}

// ═══════════════════════════ SAVES ═══════════════════════════
// Bump SAVE_VERSION whenever the state shape changes, and teach migrate() how to upgrade older saves.
export const SAVE_VERSION = 3;
export function migrate(state, world) {
  if (!state?.player) return state;
  if ((state.version ?? 1) < 3) {
    migrateLife(state, world);
    delete state.player.stats.rel; // left behind by an old bug in growth: ['rel']
    state.lastCats = state.lastCats ?? [];
    state.interlude = null;
  }
  state.version = SAVE_VERSION;
  return state;
}

// ═══════════════════════════ HELPERS ═══════════════════════════
export const ageNow = (s) => ageAt(s.player.dob, s.week);

// A snapshot of every number a decision can move, to show the player exactly what changed.
const SNAP_EXTRA = ['followers', 'reputation', 'wealthEUR', 'pfm', 'form'];
function snap(state) {
  const p = state.player, o = {};
  for (const k of METER_KEYS) o[k] = meter(p, k);
  for (const k of SNAP_EXTRA) o[k] = p[k];
  return o;
}
function diff(a, b) {
  const o = {};
  for (const k of Object.keys(b)) {
    if (a[k] === null || b[k] === null || a[k] === undefined) continue;
    const d = b[k] - a[k];
    if (Math.abs(d) >= (k === 'form' || k === 'reputation' ? 0.1 : 1)) o[k] = k === 'form' || k === 'reputation' ? round1(d) : Math.round(d);
  }
  return o;
}
const emptyRes = (state) => ({ week: state.week, statChanges: {}, notes: [], triggers: [], milestones: [], outcomes: [], matches: [], intl: [], trophies: [], awards: [] });
export const currentSeason = (s) => (s.player.club ? s.seasons[s.player.club.key] : null);

function contractEndWeekFor(world, key, startWeek, years) {
  const { startMonth, endMonth } = seasonMonths(world, key);
  const y = yearOf(startWeek) + years - (monthOf(startWeek) < startMonth - 1 ? 1 : 0);
  return endMonth < startMonth ? weekOfDate(Date.UTC(y, 5, 30)) : weekOfDate(Date.UTC(y, 11, 31));
}
export const contractYearsLeft = (s) => (s.player.club ? Math.max(0, (s.player.club.contractEndWeek - s.week) / 52) : 0);

function joinClub(state, world, { club, key, wageWeekly, years, type, loan = null }) {
  const p = state.player;
  const { country, tier } = splitKey(key);
  if (p.club) closeClubHistory(state);
  p.club = {
    name: club, key, country, tier, wageWeekly, joinedWeek: state.week, loan,
    contractEndWeek: loan ? loan.untilWeek : contractEndWeekFor(world, key, state.week, years),
    releaseClause: Math.round(marketValue(p, ageNow(state), key, years) * (2 + Math.random() * 2) / 1000) * 1000,
  };
  p.career.clubHistory.push({ club, key, from: state.week, to: null, apps: 0, goals: 0, type });
  p.manager = { name: managerName(country), trust: 50, tacticalFit: 50 };
  p.keyTeammates = [{ name: personName(country), relationship: 'neutral' }, ...p.keyTeammates.filter((t) => t.relationship === 'ally').slice(0, 1)];
  p.transferListed = false;
  p.renewalOffered = false;
  state.cup = null;
  clubCast(state, world);
  ensureSeason(state, world);
  updateRole(state);
}

function closeClubHistory(state) {
  const h = state.player.career.clubHistory.at(-1);
  if (h && h.to === null) h.to = state.week;
}

export function ensureSeason(state, world) {
  const p = state.player;
  if (!p.club) return null;
  const key = p.club.key;
  const year = Math.max(seasonYearFor(world, key, state.week, yearOf(state.week)), state.nextSeasonMinYear ?? 0);
  const cur = state.seasons[key];
  if (cur && cur.year === year) return cur;
  if (cur && !cur.finished && cur.year > year) return cur;
  const s = buildSeason(state, world, key, year);
  catchUp(s, state.week);
  state.seasons = { [key]: s };
  return s;
}

function updateRole(state, res = null) {
  const p = state.player;
  if (!p.club) { p.squadRole = 'outcast'; return; }
  const before = p.squadRole;
  let role = minRole(trustRole(p.manager.trust), abilityRole(overall(p), clubStrength(p.club.name, p.club.key)));
  if (p.transferListed && role === 'starter') role = 'rotation';
  p.squadRole = role;
  if (res && before !== role) res.roleChange = { from: before, to: role };
}

function updateMarketValue(state) {
  const p = state.player;
  if (!p.club) { p.marketValue = Math.round(p.marketValue * 0.9); return; }
  p.marketValue = marketValue(p, ageNow(state), p.club.key, contractYearsLeft(state));
  p.career.peakMarketValue = Math.max(p.career.peakMarketValue, p.marketValue);
}

function socialBoost(state) { return SOCIAL_BOOST[state.player.nationality] ?? 1.5; }

function addFollowers(state, n) { state.player.followers = Math.max(0, Math.round(state.player.followers + n)); }

function grow(state, stat, res) {
  const p = state.player;
  const age = ageNow(state);
  if (stat === 'rel') stat = pick(relevantStats(p.position).slice(0, 3)); // 'rel' = one of his position's key stats
  if (!stat || p.stats[stat] >= 99) return false;
  if (age >= 29 && stat !== 'mental') return false;
  if (p.season.growthUsed >= GROWTH.seasonCapByAge(age)) { res.growthCapped = true; return false; }
  if ((res.growthThisWeek ?? 0) >= GROWTH.maxPerWeek) return false;
  p.stats[stat] += 1;
  p.season.growthUsed += 1;
  res.growthThisWeek = (res.growthThisWeek ?? 0) + 1;
  res.statChanges[stat] = (res.statChanges[stat] ?? 0) + 1;
  return true;
}

function changeStat(state, stat, delta, res) {
  const p = state.player;
  p.stats[stat] = clamp(p.stats[stat] + delta, 1, 99);
  res.statChanges[stat] = (res.statChanges[stat] ?? 0) + delta;
}

function addTrust(state, n, res) {
  const m = state.player.manager;
  m.trust = clamp(Math.round(m.trust + n), 0, 100);
  res.trustDelta = (res.trustDelta ?? 0) + n;
}

function addRep(state, n, res) {
  const p = state.player;
  if (n > 0) n *= 1 - p.reputation / 115; // fame gets harder to add the more you have
  p.reputation = clamp(round1(p.reputation + n), 0, 100);
  res.repDelta = round1((res.repDelta ?? 0) + n);
}

function log(state, headline, type) {
  state.log.push({ week: state.week, headline, type });
  if (state.log.length > 80) state.log.shift();
}

function addMilestone(res, text) { res.milestones.push(text); }

// ═══════════════════════════ EFFECTS ═══════════════════════════
// Every decision's effects go through here. After the direct effects, ripple() works out what
// they do to the rest of the player's life (partner, family, dressing room, press, board…).
export function applyEffects(state, world, eff, res, opts = {}) {
  if (!eff) return;
  const p = state.player;
  const before = snap(state);
  const lifestyleBefore = p.lifestyle;
  directEffects(state, world, eff, res);
  if (opts.ripple === false) return;
  const d = diff(before, snap(state));
  d.wealth = d.wealthEUR ?? 0; d.rep = d.reputation ?? 0;
  d.lifestyle = round1(p.lifestyle - lifestyleBefore);
  d.mood = eff.mood ?? null;
  ripple(state, world, d, res, opts.source ?? 'decision');
}

const PARTNER_RANK = { none: 0, dating: 1, serious: 2, engaged: 3, married: 4 };

function directEffects(state, world, eff, res) {
  const p = state.player;
  for (const k of ['board', 'dressing', 'fans', 'press', 'image', 'love', 'friends', 'morale', 'stress', 'family']) if (eff[k]) addMeter(state, k, eff[k], res);
  if (eff.newManager && p.club) { p.manager = { name: managerName(p.club.country), trust: 50, tacticalFit: 50 }; res.newManager = p.manager.name; }
  if (eff.trust) addTrust(state, eff.trust, res);
  if (eff.rep) addRep(state, eff.rep, res);
  if (eff.followers) addFollowers(state, eff.followers);
  if (eff.wealth) { p.wealthEUR = Math.round(p.wealthEUR + eff.wealth); res.wealthDelta = (res.wealthDelta ?? 0) + eff.wealth; }
  if (eff.pfm) p.pfm = clamp(p.pfm + eff.pfm, 0, p.pfmCeiling);
  if (eff.tacticalFit) p.manager.tacticalFit = clamp(p.manager.tacticalFit + eff.tacticalFit, 0, 100);
  if (eff.parental) addMeter(state, 'family', eff.parental, res);
  if (eff.monthlySupport) p.family.monthlySupport += eff.monthlySupport;
  for (const s of eff.growth ?? []) grow(state, s, res);
  for (const [k, v] of Object.entries(eff.stat ?? {})) changeStat(state, k, v, res);
  if (eff.teammate) {
    const t = p.keyTeammates.find((x) => x.name === eff.teammate.name);
    if (t) t.relationship = eff.teammate.rel; else p.keyTeammates.push({ name: eff.teammate.name, relationship: eff.teammate.rel });
    if (p.keyTeammates.length > 5) p.keyTeammates.shift();
    addMeter(state, 'dressing', { ally: 2, neutral: 0, rival: -1, enemy: -3 }[eff.teammate.rel] ?? 0, res);
  }
  if (eff.newPartner && p.partner.status === 'none') eff = { ...eff, partner: { name: personName(p.club?.country ?? p.nationality, true), status: 'dating' } };
  if (eff.partner) {
    const old = { ...p.partner };
    p.partner = { ...p.partner, ...eff.partner };
    if (p.partner.status === 'none') p.partner.aff = 0;
    else if (old.status === 'none' || (eff.partner.name && eff.partner.name !== old.name)) {
      p.partner.aff = 62; p.partner.style = pick(['private', 'public']); p.contact.love = state.week;
    } else if ((PARTNER_RANK[p.partner.status] ?? 0) > (PARTNER_RANK[old.status] ?? 0)) addMeter(state, 'love', 8, res);
  }
  if (eff.agent) p.agent = eff.agent;
  if (eff.endorsement) p.endorsements.push({ brand: eff.endorsement.brand, type: eff.endorsement.type, annualValue: eff.endorsement.annualValue, expiryWeek: state.week + 52 * eff.endorsement.years });
  if (eff.transferListed || eff.listed === true) p.transferListed = true;
  if (eff.listed === false) p.transferListed = false;
  if (eff.form) p.form = clamp(round1(p.form + eff.form), 4, 9.5);
  if (eff.suspension) p.suspension = Math.max(0, p.suspension + eff.suspension);
  if (eff.lifestyle) p.lifestyle = clamp(round1(p.lifestyle + eff.lifestyle), 0.6, 3);
  if (eff.flag || eff.unflag) {
    const story = { ...(state.flags.story ?? {}) };
    for (const f of [].concat(eff.flag ?? [])) story[f] = state.week;
    for (const f of [].concat(eff.unflag ?? [])) delete story[f];
    state.flags.story = story;
  }
  if (eff.matchMod) state.matchMod = { ...eff.matchMod };
  if (eff.mood) res.mood = eff.mood;
  if (eff.injury) createInjury(state, world, res, eff.injury);
  if (eff.thread) state.threads.push({ id: eff.thread.id, dueWeek: state.week + eff.thread.inWeeks, data: JSON.parse(JSON.stringify(eff.thread.data)) });
}

// ═══════════════════════════ DECISIONS ═══════════════════════════
function pushDecision(state, d) {
  state.pending.push({ id: uid(), chosen: null, ...d });
}

export function chooseDecision(state, decisionId, choiceId) {
  const d = state.pending.find((x) => x.id === decisionId);
  if (d) d.chosen = choiceId;
}

export const pendingUnanswered = (state) => state.pending.filter((d) => !d.chosen);

function resolveDecisions(state, world, res) {
  const decided = state.pending;
  state.pending = [];
  for (const d of decided) {
    const choice = d.choices.find((c) => c.id === d.chosen) ?? d.choices[0];
    state.history.push(`Wk ${state.week}: "${d.prompt}" → ${choice.label}`);
    if (state.history.length > 15) state.history.shift();
    const out = { prompt: d.prompt, label: choice.label, kind: d.kind, cat: d.cat ?? d.type, text: '' };
    const before = snap(state), r0 = res.ripples?.length ?? 0;
    if (d.kind === 'scenario') {
      const s = world.scenarioById[d.sid];
      if (s) { const r = resolveChoice(state, s, d.data, choice.id); out.text = r.text; out.moment = !!s.moment; applyEffects(state, world, r.fx, res, { source: s.cat }); }
    } else if (d.kind === 'offer') {
      out.text = resolveOffer(state, world, d.data, choice.id, res);
    } else if (d.kind === 'renewal') {
      out.text = resolveRenewal(state, world, d.data, choice.id, res);
    } else if (d.kind === 'rehab') {
      out.text = resolveRehab(state, world, d.data, choice.id, res);
    } else if (d.kind === 'retire') {
      if (choice.id === 'a') { state.ended = { reason: 'retirement', week: state.week }; out.text = `${state.player.jerseyName} calls time on his career.`; }
      else out.text = 'One more season. The body protests; the heart insists.';
    }
    out.changes = diff(before, snap(state));
    out.ripples = (res.ripples ?? []).slice(r0);
    res.outcomes.push(out);
  }
}

// ═══════════════════════════ MATCHES ═══════════════════════════
function participation(state, isCup) {
  const p = state.player;
  if (p.injury) return { minutes: 0, reason: 'injured' };
  if (p.suspension > 0) return { minutes: 0, reason: 'suspended' };
  if (state.matchMod && !state.matchMod.used) return { minutes: chance(0.75) ? 90 : randint(65, 85), started: true }; // a key moment was played
  const role = p.squadRole;
  let startP = (isCup ? { starter: 0.6, rotation: 0.75, bench: 0.5, outcast: 0.15 } : { starter: 0.93, rotation: 0.5, bench: 0.1, outcast: 0 })[role];
  if (p.pfm < 35) startP *= 0.5;
  if (chance(startP)) return { minutes: chance(0.22) ? randint(60, 85) : 90, started: true };
  const subP = { starter: 0.8, rotation: 0.65, bench: 0.35, outcast: 0.03 }[role];
  if (chance(subP)) return { minutes: randint(8, 35), started: false };
  return { minutes: 0, reason: 'unused' };
}

const MOOD_MOD = { 'On Fire': 0.25, Confident: 0.15, Determined: 0.1, Motivated: 0.05, Anxious: -0.15, Frustrated: -0.1, Broken: -0.3, Lost: -0.2, Homesick: -0.15, Angry: -0.05, Numb: -0.1 };

function playerMatchCore(state, { myStr, oppStr, home, part, competition, opp, club, isCup = false, round = null }) {
  const p = state.player;
  let rating = null, goals = 0, assists = 0, motm = false, yellow = false, red = false, adj = 0;
  if (part.minutes > 0) {
    rating = 6.6 + (overall(p) - myStr) * 0.03 + (p.form - 6.5) * 0.25 + gauss() * 0.65
      + (p.pfm < 50 ? -0.4 : p.pfm < 70 ? -0.15 : 0) + (MOOD_MOD[p.mood] ?? 0) + lifeRatingMod(p, home);
    adj = (rating - 6.4) * 2.2 * (part.minutes / 90);
  }
  const mod = part.minutes > 0 && state.matchMod && !state.matchMod.used ? state.matchMod : null;
  if (mod) { mod.used = true; adj += (mod.rating ?? 0) * 2; }
  let [hs, as] = home ? simScore(myStr + adj, oppStr) : simScore(oppStr, myStr + adj);
  // A key-moment goal/assist really happens: make sure the scoreline has room for it.
  const forced = mod ? (mod.goals ?? 0) + (mod.assists ?? 0) : 0;
  if (forced) { if (home && hs < forced) hs = forced; if (!home && as < forced) as = forced; }
  if (mod?.concede) { if (home) as += mod.concede; else hs += mod.concede; }
  const gf = home ? hs : as, ga = home ? as : hs;
  if (part.minutes > 0) {
    const share = part.minutes / 90, perf = (1 + (rating - 6.4) * 0.35) * clamp(1 + (overall(p) - myStr) * 0.03, 0.5, 1.5);
    const pg = clamp(GOAL_SHARE[p.position] * (0.55 + p.stats.shooting / 110) * share * perf, 0, 0.85);
    const pa = clamp(ASSIST_SHARE[p.position] * (0.55 + p.stats.passing / 110) * share * perf, 0, 0.6);
    goals = mod?.goals ?? 0; assists = mod?.assists ?? 0;
    for (let i = goals + assists; i < gf; i++) { const r = Math.random(); if (r < pg) goals++; else if (r < pg + pa) assists++; }
    rating += (mod?.rating ?? 0);
    rating += goals * 0.7 + assists * 0.4 + (gf > ga ? 0.2 : gf < ga ? -0.2 : 0);
    if (ga === 0 && part.minutes >= 60 && ['GK', 'CB', 'FB', 'DM'].includes(p.position)) rating += 0.4;
    if (ga >= 3 && ['GK', 'CB'].includes(p.position)) rating -= 0.4;
    rating = round1(clamp(rating, 3.8, 10));
    yellow = mod?.card === 'yellow' || chance((['CB', 'DM'].includes(p.position) ? 0.18 : 0.1) * share);
    red = mod?.card === 'red' || chance(0.012 * share);
    if (mod?.card === 'red') rating = round1(clamp(rating - 1, 3.8, 10));
    motm = part.minutes >= 45 && (rating >= 8.8 || (rating >= 8.0 && chance(0.55)));
  }
  const minuteList = Array.from({ length: goals }, () => randint(3, 90)).sort((a, b) => a - b);
  return {
    competition, round, isCup, home, club, opp, hs, as, gf, ga, score: `${hs}-${as}`,
    result: gf > ga ? 'W' : gf < ga ? 'L' : 'D', minutes: part.minutes, started: !!part.started, reason: part.reason ?? null,
    rating, goals, assists, motm, yellow, red, goalMinutes: minuteList, modInjury: mod?.injury ?? null, keyMoment: !!mod,
  };
}

function afterClubMatch(state, world, m, res) {
  const p = state.player;
  // Streaks used by story triggers
  p.teamLossStreak = m.result === 'L' ? (p.teamLossStreak ?? 0) + 1 : 0;
  if (p.teamLossStreak === 3) res.triggers.push('badRun');
  if (m.minutes <= 0) {
    if (m.reason === 'unused' || m.reason === null) { p.benchStreak = (p.benchStreak ?? 0) + 1; if (p.benchStreak === 4) res.triggers.push('benchStreak'); }
    return;
  }
  p.benchStreak = 0;
  p.scoreStreak = m.goals > 0 ? (p.scoreStreak ?? 0) + 1 : 0;
  if (p.scoreStreak === 3) res.triggers.push('goalStreak');
  if (m.goals >= 3) res.triggers.push('hatTrick');
  if (m.red) res.triggers.push('redCard');
  if (m.rating < 5.5) res.triggers.push('nightmare');
  if (m.modInjury) createInjury(state, world, res, m.modInjury);
  p.lastMatch = { result: m.result, rating: m.rating, opp: m.opp, goals: m.goals, competition: m.competition };
  const q = leagueQuality(p.club.key);
  p.career.apps++; p.season.apps++;
  p.career.goals += m.goals; p.season.goals += m.goals;
  p.career.assists += m.assists; p.season.assists += m.assists;
  if (m.motm) { p.career.motms++; p.season.motms++; }
  p.season.ratings.push(m.rating);
  const h = p.career.clubHistory.at(-1); if (h) { h.apps++; h.goals += m.goals; }
  p.form = round1(p.form * 0.7 + m.rating * 0.3);
  p.pfm = clamp(p.pfm + PFM.matchFull * (m.minutes / 90), 0, p.pfmCeiling);
  p.pendingBonus += Math.round(p.club.wageWeekly * (0.1 + 0.25 * m.goals));
  lifeAfterMatch(state, m, res);
  // Manager trust (original rules)
  if (m.rating >= 7.5) addTrust(state, 3, res);
  else if (m.rating > 7.0) addTrust(state, 1, res);
  if (m.motm) addTrust(state, 5, res);
  if (m.rating < 6.0) addTrust(state, -5, res);
  if (m.goals > 0 && m.gf - m.ga === 1) addTrust(state, 5, res);
  if (m.isCup && m.result === 'W') addTrust(state, 3, res);
  // Reputation & followers
  addRep(state, Math.max(-0.3, (m.rating - 6.5) * 0.12 * (q / 70)) + m.goals * 0.2 * (q / 70) + (m.motm ? 0.3 : 0), res);
  addFollowers(state, (m.goals * 400 + (m.motm ? 600 : 0) + Math.max(0, m.rating - 7) * 300) * socialBoost(state));
  if (m.rating >= 9 || m.goals >= 3) { const viral = Math.round(randint(50000, 200000) * socialBoost(state) / 4); addFollowers(state, viral); res.viral = viral; }
  // Growth from matches (rare)
  const rel = relevantStats(p.position).slice(0, 3);
  if (m.rating >= 8.0 && chance(0.4)) grow(state, pick(rel), res);
  if (m.rating >= 8.8 && chance(0.3)) grow(state, pick(rel), res);
  else if (m.rating >= 7.3 && m.rating < 8.0 && chance(0.12)) grow(state, pick(rel), res);
  // Discipline
  if (m.red) { p.suspension = randint(1, 3); res.suspended = p.suspension; }
  else if (m.yellow) { p.yellowCards++; if (p.yellowCards >= 5) { p.yellowCards = 0; p.suspension = 1; res.suspended = 1; } }
  // Milestones
  if (p.career.apps === 1) { addMilestone(res, 'First professional appearance'); res.triggers.push('debut'); }
  if (m.goals > 0 && p.career.goals === m.goals) { addMilestone(res, 'First professional goal'); res.triggers.push('firstGoal'); }
  if (m.motm && p.career.motms === 1) addMilestone(res, 'First Man of the Match award');
  for (const n of [50, 100, 200, 300, 400, 500]) if (p.career.apps === n) addMilestone(res, `${n}th career appearance`);
  for (const n of [25, 50, 100, 150, 200]) if (p.career.goals >= n && p.career.goals - m.goals < n) addMilestone(res, `${n} career goals`);
}

function playLeagueRounds(state, world, res) {
  const p = state.player;
  const season = ensureSeason(state, world);
  if (!season) return;
  for (const round of roundsInWeek(season, state.week)) {
    for (const m of round.matches) {
      if (m.hs !== null) continue;
      if (m.h === p.club.name || m.a === p.club.name) {
        const home = m.h === p.club.name;
        const r = playerMatchCore(state, {
          myStr: clubStrength(p.club.name, p.club.key), oppStr: clubStrength(home ? m.a : m.h, p.club.key), home,
          part: participation(state, false), competition: season.name, opp: home ? m.a : m.h, club: p.club.name, round: `Matchday ${round.no}`,
        });
        recordResult(season, m, r.hs, r.as);
        res.matches.push(r);
        afterClubMatch(state, world, r, res);
        if (r.minutes === 0 && p.suspension > 0 && r.reason === 'suspended') p.suspension--;
      } else simulateMatch(season, m);
    }
  }
}

// ═══════════════════════════ DOMESTIC CUP ═══════════════════════════
function cupNameFor(world, country) {
  const c = world.byName[country];
  return (c?.cups ?? []).find((n) => !/irregular|pre-season|invitational|Leagues Cup|Trophy \(tiers|Super Cup|Campeón/i.test(n)) ?? null;
}

function ensureCup(state, world) {
  const p = state.player;
  if (!p.club || p.club.tier > 3) return;
  const season = currentSeason(state);
  if (!season) return;
  if (state.cup && state.cup.year === season.year && state.cup.club === p.club.name) return;
  const name = cupNameFor(world, p.club.country);
  if (!name) { state.cup = null; return; }
  const { startMonth, endMonth } = seasonMonths(world, p.club.key);
  const spans = endMonth < startMonth;
  const plan = spans ? [[season.year, 9, 4], [season.year, 10, 4], [season.year + 1, 0, 3], [season.year + 1, 1, 3], [season.year + 1, 3, 2], [season.year + 1, 4, 3]]
    : [[season.year, 3, 3], [season.year, 4, 3], [season.year, 6, 4], [season.year, 7, 3], [season.year, 9, 4], [season.year, 10, 4]];
  const startIdx = p.club.tier === 1 ? 1 : 0;
  state.cup = {
    name, year: season.year, club: p.club.name, alive: true, results: [],
    rounds: plan.slice(startIdx).map(([y, mo, n], i) => {
      let w = nthMondayWeek(y, mo, n); if (isFifaWeek(w)) w++;
      return { week: w, name: CUP_ROUND_NAMES[startIdx + i] };
    }),
  };
}

function cupOpponent(state, world, roundIdx) {
  const p = state.player;
  const pool = [];
  for (const l of world.byName[p.club.country]?.leagues ?? []) {
    if (l.tier > 3) continue;
    const key = leagueKey(p.club.country, l.tier);
    for (const c of (state.leagueClubs[key] ?? clubsOf(l))) if (c !== p.club.name) pool.push({ club: c, key, str: clubStrength(c, key) });
  }
  if (!pool.length) return null;
  const late = roundIdx >= 3;
  return weightedPick(pool, (x) => (late ? Math.exp((x.str - 55) / 8) : 1));
}

function playCupRound(state, world, res) {
  const cup = state.cup;
  if (!cup || !cup.alive) return;
  const idx = cup.rounds.findIndex((r) => r.week === state.week);
  if (idx < 0) return;
  const p = state.player;
  const opp = cupOpponent(state, world, idx);
  if (!opp) return;
  const home = cup.rounds[idx].name === 'Final' ? false : chance(0.5);
  const r = playerMatchCore(state, {
    myStr: clubStrength(p.club.name, p.club.key), oppStr: opp.str, home, part: participation(state, true),
    competition: cup.name, opp: opp.club, club: p.club.name, isCup: true, round: cup.rounds[idx].name,
  });
  if (r.gf === r.ga) { // penalties
    r.penalties = chance(0.5 + (clubStrength(p.club.name, p.club.key) - opp.str) / 100) ? 'won' : 'lost';
    r.result = r.penalties === 'won' ? 'W' : 'L';
  }
  res.matches.push(r);
  afterClubMatch(state, world, r, res);
  if (r.reason === 'suspended') p.suspension--;
  cup.results.push({ round: cup.rounds[idx].name, opp: opp.club, score: r.score, result: r.result });
  if (r.result === 'L') cup.alive = false;
  else if (cup.rounds[idx].name === 'Final') {
    cup.alive = false;
    const trophy = `${cup.name} ${cup.year}`;
    p.career.trophies.push(trophy);
    res.trophies.push(trophy);
    addRep(state, 2 + leagueQuality(p.club.key) / 25, res);
    addFollowers(state, 20000 * socialBoost(state));
    if (p.career.trophies.length === 1) addMilestone(res, 'First senior trophy');
  }
}

// ═══════════════════════════ NATIONAL TEAM ═══════════════════════════
export function nationThresholds(world, nation) {
  const rank = nationRank(world, nation);
  const senior = rank <= 12 ? 86 : rank <= 30 ? 78 : rank <= 70 ? 71 : rank <= 125 ? 64 : 58;
  return { rank, senior, strength: clamp(88 - rank * 0.25, 45, 88) };
}

function nationalTeamWeek(state, world, res) {
  const p = state.player;
  if (!isFifaWeek(state.week)) return;
  const age = ageNow(state);
  const t = nationThresholds(world, p.nationality);
  const score = overall(p) + p.reputation * 0.3;
  let team = null;
  if (age >= 17 && score >= t.senior - (p.national.status === 'regular' ? 3 : 0)) team = 'Senior';
  else if (age <= 17 && score >= t.senior - 16) team = 'U17';
  else if (age <= 19 && age >= 17 && score >= t.senior - 11) team = 'U20';
  else if (age <= 22 && age >= 20 && score >= t.senior - 6) team = 'U23';
  if (!team) {
    const status = score >= t.senior - 5 && age >= 17 ? 'monitoring' : p.national.status === 'regular' ? 'dropped' : 'none';
    if (status !== p.national.status && status !== 'none') res.ntUpdate = { team: `${p.nationality} ${age >= 20 ? 'senior team' : 'youth teams'}`, status, description: status === 'monitoring' ? 'National team staff are watching your matches.' : 'You have been left out of the latest squad.' };
    p.national.status = status === 'dropped' ? 'none' : status;
    p.national.team = 'none';
    return;
  }
  if (p.injury) { res.ntUpdate = { team: `${p.nationality} ${team}`, status: 'called', description: 'Called up — but injured and unable to travel.' }; return; }
  const firstSenior = team === 'Senior' && p.national.caps === 0;
  p.national.team = team;
  p.national.callUps++;
  p.national.status = team === 'Senior' && p.national.callUps >= 4 ? 'regular' : 'called';
  const label = team === 'Senior' ? p.nationality : `${p.nationality} ${team.replace('U', 'U-')}`;
  res.ntUpdate = { team: label, status: 'called', description: firstSenior ? 'First senior call-up.' : `Called up to the ${label} squad.` };
  const region = world.byName[p.nationality]?.region;
  const opps = world.countries.filter((c) => c.region === region && c.country !== p.nationality && c.country.length < 30);
  const games = randint(1, 2);
  for (let i = 0; i < games; i++) {
    const oppC = pick(opps);
    if (!oppC) break;
    const oppStr = nationThresholds(world, oppC.country).strength - (team === 'Senior' ? 0 : 8);
    const myStr = t.strength - (team === 'Senior' ? 0 : 8);
    const gap = score - (team === 'Senior' ? t.senior : t.senior - 10);
    const role = gap >= 6 ? 'starter' : gap >= 2 ? 'rotation' : 'bench';
    const saved = p.squadRole; p.squadRole = role;
    const part = participation(state, false);
    p.squadRole = saved;
    const comp = team === 'Senior' ? pick(['International friendly', `${{ asia: 'AFC', europe: 'UEFA', 'south-america': 'CONMEBOL', africa: 'CAF', 'north-central-america': 'Concacaf', oceania: 'OFC' }[region] ?? 'FIFA'} qualifier`]) : `${team.replace('U', 'U-')} international tournament`;
    const r = playerMatchCore(state, { myStr, oppStr, home: chance(0.5), part, competition: comp, opp: oppC.country, club: label });
    r.international = team;
    res.intl.push(r);
    if (r.minutes > 0) {
      if (team === 'Senior') {
        p.national.caps++; p.national.goals += r.goals;
        if (p.national.caps === 1) { addMilestone(res, `Senior international debut for ${p.nationality}`); addFollowers(state, randint(200000, 500000) * socialBoost(state) / 4); addRep(state, 4, res); }
        addRep(state, 0.6 + r.goals * 0.5, res);
      } else { p.national.youthCaps++; p.national.youthGoals += r.goals; addRep(state, 0.4 + r.goals * 0.3, res); }
      if (r.goals && p.national.goals === r.goals && team === 'Senior') addMilestone(res, 'First senior international goal');
      p.form = round1(p.form * 0.8 + r.rating * 0.2);
      p.pfm = clamp(p.pfm - 3 * (r.minutes / 90), 0, p.pfmCeiling);
    }
  }
  if (team === 'Senior' && chance(0.04)) { createInjury(state, world, res, 'minor'); addTrust(state, -5, res); res.intlInjury = true; }
}

// ═══════════════════════════ INJURIES ═══════════════════════════
function createInjury(state, world, res, forceSeverity = null) {
  const p = state.player;
  if (p.injury) return;
  const age = ageNow(state);
  let pool = INJURY_TYPES;
  if (forceSeverity) pool = INJURY_TYPES.filter((t) => t.severity === forceSeverity);
  const t = weightedPick(pool, (x) => x.w * (x.severity !== 'minor' && age >= 30 ? 1.4 : 1));
  let weeks = randint(t.weeks[0], t.weeks[1]);
  const repeat = p.injuryHistory.includes(t.type);
  if (repeat) weeks = Math.round(weeks * 1.5);
  p.injury = { type: t.type, severity: t.severity, weeksLeft: weeks, total: weeks, stat: t.stat, approach: 'normal', repeat };
  p.injuryHistory.push(t.type);
  res.injury = { ...p.injury };
  if (t.severity === 'career-threatening' && age >= 31 && chance(0.06)) { state.ended = { reason: 'injury', week: state.week }; res.careerEnding = true; return; }
  if (weeks >= 3) {
    pushDecision(state, {
      kind: 'rehab', type: 'tactical', data: { weeks },
      prompt: `${t.type}: ${weeks} weeks out. How do you approach rehab?`,
      choices: [
        { id: 'a', label: 'Rush back', description: 'Aggressive protocol, back ~30% sooner.', risk: 'high', consequence: 'Faster return; real risk of breaking down again.' },
        { id: 'b', label: 'Normal protocol', description: 'Follow the medical team.', risk: 'low', consequence: 'Standard recovery.' },
        { id: 'c', label: 'Extra cautious', description: 'Longer, thorough rebuild.', risk: 'medium', consequence: 'Out longer; return stronger, less chance of lasting damage.' },
      ],
    });
  }
}

function resolveRehab(state, world, data, choiceId, res) {
  const inj = state.player.injury;
  if (inj) applyEffects(state, world, { a: { stress: 4, family: -2 }, b: { stress: 1 }, c: { stress: -3, board: -2 } }[choiceId] ?? {}, res, { source: "rehab" });
  if (!inj) return 'He was back before the plan mattered.';
  if (choiceId === 'a') { inj.weeksLeft = Math.max(1, Math.round(inj.weeksLeft * 0.7)); inj.approach = 'rush'; return `The medical team sigh and write a faster plan. ${inj.weeksLeft} weeks — if the body agrees.`; }
  if (choiceId === 'c') { inj.weeksLeft = Math.round(inj.weeksLeft * 1.25); inj.approach = 'cautious'; return `Slow and thorough. ${inj.weeksLeft} weeks of rebuilding, every muscle accounted for.`; }
  return `The standard protocol: ${inj.weeksLeft} weeks of rehab, scans, and patience.`;
}

function injuryWeek(state, world, res, matchesPlayed, plan) {
  const p = state.player;
  const age = ageNow(state);
  if (p.injury) {
    p.injury.weeksLeft--;
    if (p.injury.weeksLeft <= 0) {
      const inj = p.injury;
      p.injury = null;
      res.recovered = inj;
      if (inj.total > 8) changeStat(state, 'mental', -1, res);
      if (inj.total > 20) { changeStat(state, 'mental', -1, res); p.pfm = clamp(p.pfm - 5, 0, p.pfmCeiling); }
      if (['severe', 'career-threatening'].includes(inj.severity) && inj.approach !== 'cautious' && chance(0.5)) changeStat(state, inj.stat, -randint(1, 3), res);
      if (inj.approach === 'rush') p.fragileWeeks = 6;
    }
    return;
  }
  let risk = matchesPlayed >= 2 ? INJURY.heavy : INJURY.base;
  if (matchesPlayed === 0) risk *= 0.5;
  if (age >= 30) risk += INJURY.age30;
  if (p.pfm < 50) risk += INJURY.lowPfm;
  if (plan.intensity === 'hard') risk += INJURY.hardPlan;
  if (p.fragileWeeks > 0) { risk += 0.15; p.fragileWeeks--; }
  risk += lifeInjuryMod(p);
  if (chance(risk)) createInjury(state, world, res);
}

// ═══════════════════════════ TRANSFERS & CONTRACTS ═══════════════════════════
function transferWeek(state, world, res) {
  const p = state.player;
  const month = monthOf(state.week);
  const age = ageNow(state);
  if (state.pending.some((d) => d.kind === 'offer') || age >= 37) return;
  const free = !p.club;
  if (!free && !windowOpen(world, p.club.key, month)) return;
  if (!free && state.week - p.club.joinedWeek < 20) return; // settle in first
  const ovr = overall(p);
  const myStr = free ? ovr : clubStrength(p.club.name, p.club.key);
  let prob = free ? 0.45 : 0.05 + Math.max(0, ovr - myStr + 3) * 0.02 + p.reputation * 0.002 + (p.transferListed ? 0.15 : 0)
    + (['bench', 'outcast'].includes(p.squadRole) && age <= 21 ? 0.1 : 0);
  if (!chance(clamp(prob, 0, 0.6))) return;
  const offer = makeOffer(state, world, { free, ovr, myStr, age, month });
  if (!offer) return;
  res.offer = offer;
  const typeLabel = offer.type === 'loan' ? 'loan' : offer.fee > 0 ? `€${offer.fee.toLocaleString()} transfer` : 'free transfer';
  const blocking = offer.sellingClubResponse === 'blocking';
  pushDecision(state, {
    kind: 'offer', type: 'transfer', data: offer,
    prompt: `${offer.club} (${offer.leagueName}, ${offer.country}) offer a ${typeLabel}: €${offer.wageWeekly.toLocaleString()}/week${offer.type === 'loan' ? ' until the end of the season' : `, ${offer.years} years`}.${blocking ? ' Your club is blocking the move.' : ''}`,
    choices: blocking ? [
      { id: 'push', label: 'Push for the move', description: 'Tell the club you want to go.', risk: 'high', consequence: 'Agitating costs trust. The club may still refuse.' },
      { id: 'stay', label: 'Stay and commit', description: 'Turn your back on the offer.', risk: 'low', consequence: 'Manager appreciates loyalty.' },
    ] : [
      { id: 'accept', label: offer.type === 'loan' ? 'Accept the loan' : 'Accept', description: `Join ${offer.club}.`, risk: offer.qualityDelta > 4 ? 'high' : 'medium', consequence: offer.qualityDelta > 3 ? 'A big step up — harder to get minutes.' : offer.qualityDelta < -3 ? 'Easier level; more minutes, less spotlight.' : 'A sideways move with a fresh start.' },
      { id: 'reject', label: 'Reject', description: 'Stay where you are.', risk: 'low', consequence: 'Nothing changes — unless this was your best chance.' },
    ],
  });
}

function makeOffer(state, world, { free, ovr, myStr, age, month }) {
  const p = state.player;
  const loan = !free && age <= 21 && ['bench', 'outcast'].includes(p.squadRole) && chance(0.6);
  const target = loan ? Math.min(myStr - 3, ovr + 4) : ovr + randint(-3, 4);
  const abroadP = clamp((p.reputation - 12) / 60, 0.03, 0.6);
  const homeCountry = p.club?.country ?? p.nationality;
  const goAbroad = chance(abroadP);
  const leagues = playableLeagues(world).filter((l) => windowOpen(world, l.key, month) && (goAbroad ? l.country !== homeCountry : l.country === homeCountry) && Math.abs(leagueQuality(l.key) - target) <= 12);
  const cands = [];
  for (const l of leagues) for (const c of leagueClubs(state, world, l.key)) {
    if (c === p.club?.name) continue;
    const s = clubStrength(c, l.key);
    if (Math.abs(s - target) <= 5) cands.push({ club: c, key: l.key, country: l.country, leagueName: l.name, str: s });
  }
  if (!cands.length) return null;
  const c = pick(cands);
  const years = age >= 31 ? randint(1, 2) : randint(2, 4);
  const yearsLeft = contractYearsLeft(state);
  const fee = loan || free || yearsLeft <= 0.5 ? 0 : Math.round(p.marketValue * (0.7 + Math.random() * 0.6) / 1000) * 1000;
  const wageWeekly = Math.round(Math.max(p.club?.wageWeekly ?? 0, weeklyWage(ovr, c.key) * (1.05 + Math.random() * 0.35)) / 10) * 10;
  let response = 'accepting';
  if (!loan && !free && fee > 0 && fee < (p.club?.releaseClause ?? Infinity) && p.squadRole === 'starter' && yearsLeft >= 1.5 && !p.transferListed && chance(0.6)) response = 'blocking';
  const untilWeek = loan ? seasonBounds(world, c.key, seasonYearFor(world, c.key, state.week, yearOf(state.week))).endWeek + 1 : null;
  return { ...c, type: loan ? 'loan' : free ? 'free' : 'permanent', fee, wageWeekly, years, sellingClubResponse: response, untilWeek, qualityDelta: round1(c.str - myStr) };
}

function executeMove(state, world, offer, res) {
  const p = state.player;
  const from = p.club?.name ?? 'free agency';
  let loan = null;
  if (offer.type === 'loan') loan = { parent: { ...p.club }, untilWeek: offer.untilWeek };
  lifeMove(state, world, offer, res);
  joinClub(state, world, { club: offer.club, key: offer.key, wageWeekly: offer.wageWeekly, years: offer.years, type: offer.type, loan });
  if (offer.fee > 0) p.career.transferFees = (p.career.transferFees ?? 0) + offer.fee;
  addFollowers(state, (offer.fee > 1e6 ? 50000 : 5000) * socialBoost(state));
  addRep(state, Math.max(0, (leagueQuality(offer.key) - 55) / 10), res);
  updateMarketValue(state);
  res.moved = { from, to: offer.club, type: offer.type, fee: offer.fee, league: offer.leagueName, country: offer.country };
  log(state, `${p.jerseyName} joins ${offer.club}${offer.type === 'loan' ? ' on loan' : ''}`, 'transfer');
}

function resolveOffer(state, world, offer, choiceId, res) {
  const p = state.player;
  const J = p.jerseyName;
  const fx = (e) => applyEffects(state, world, e, res, { source: 'transfer' });
  if (choiceId === 'reject') { if (p.club) { addTrust(state, 2, res); fx({ board: 2, fans: 2 }); } return `${J} turns down ${offer.club}.`; }
  if (choiceId === 'stay') { addTrust(state, 3, res); fx({ fans: 4, board: 3, dressing: 1 }); return `${J} tells his agent to close the door on ${offer.club}. The club notices the loyalty.`; }
  if (choiceId === 'push') {
    addTrust(state, -10, res);
    fx({ board: -6, fans: -5, press: 2, stress: 4 });
    if (!chance(0.55)) { p.transferListed = false; return `${J} pushes. The club refuses to sell, and now everybody knows he wanted out.`; }
    executeMove(state, world, offer, res);
    return `After a tense week the clubs agree. ${J} is on his way to ${offer.club}.`;
  }
  executeMove(state, world, offer, res);
  return offer.type === 'loan' ? `${J} packs a bag and joins ${offer.club} on loan.` : `${J} signs for ${offer.club}.`;
}

function contractWeek(state, world, res) {
  const p = state.player;
  if (!p.club) return;
  // Loan return
  if (p.club.loan && state.week >= p.club.loan.untilWeek) {
    const parent = p.club.loan.parent;
    const from = p.club.name;
    joinClub(state, world, { club: parent.name, key: findClubKey(state, world, parent) ?? parent.key, wageWeekly: parent.wageWeekly, years: 1, type: 'return' });
    p.club.contractEndWeek = parent.contractEndWeek;
    res.moved = { from, to: parent.name, type: 'loan return' };
    log(state, `${p.jerseyName} returns to ${parent.name} after loan`, 'transfer');
    return;
  }
  const weeksLeft = p.club.contractEndWeek - state.week;
  if (!p.club.loan && !p.renewalOffered && weeksLeft <= 30 && weeksLeft > 4 && p.manager.trust >= 35 && p.squadRole !== 'outcast') {
    p.renewalOffered = true;
    const ovr = overall(p);
    const wage = Math.round(Math.max(p.club.wageWeekly * 1.15, weeklyWage(ovr, p.club.key) * 1.1) / 10) * 10;
    const years = ageNow(state) >= 31 ? 1 : randint(2, 4);
    pushDecision(state, {
      kind: 'renewal', type: 'transfer', data: { wage, years },
      prompt: `${p.club.name} offer a new ${years}-year contract at €${wage.toLocaleString()}/week (now €${p.club.wageWeekly.toLocaleString()}).`,
      choices: [
        { id: 'a', label: 'Sign it', description: 'Security and a raise.', risk: 'low', consequence: 'Settled future; your value stays protected.' },
        { id: 'b', label: 'Negotiate', description: p.agent ? `Let ${p.agent.name} push for more.` : 'Negotiate yourself (no agent).', risk: 'medium', consequence: 'Better terms — or the club cools.' },
        { id: 'c', label: 'Run it down', description: 'Leave on a free when it expires.', risk: 'high', consequence: 'Freedom and leverage. The club may freeze you out.' },
      ],
    });
  }
  if (weeksLeft <= 0) {
    if (ageNow(state) >= 34 && chance(0.3)) { state.ended = { reason: 'retirement', week: state.week }; res.notes.push('No contract, no offers worth taking: the decision makes itself.'); return; }
    closeClubHistory(state);
    res.moved = { from: p.club.name, to: 'free agency', type: 'contract expired' };
    log(state, `${p.jerseyName} leaves ${p.club.name} as a free agent`, 'transfer');
    p.club = null;
    p.squadRole = 'outcast';
    state.cup = null;
    state.seasons = {};
  }
}

function findClubKey(state, world, club) {
  const { country } = splitKey(club.key);
  for (const l of playableLeagues(world, country)) if (leagueClubs(state, world, l.key).includes(club.name)) return l.key;
  return null;
}

function resolveRenewal(state, world, data, choiceId, res) {
  const p = state.player;
  const J = p.jerseyName;
  const fx = (e) => applyEffects(state, world, e, res, { source: 'contract' });
  if (choiceId === 'a') { signRenewal(state, world, data.wage, data.years); addTrust(state, 3, res); fx({ board: 5, fans: 3, stress: -3 }); return `${J} signs. €${data.wage.toLocaleString()} a week until ${yearOf(p.club.contractEndWeek)}.`; }
  if (choiceId === 'b') {
    const q = p.agent?.quality ?? 30;
    if (chance(0.35 + q / 200)) { const w = Math.round(data.wage * (1.1 + q / 500) / 10) * 10; signRenewal(state, world, w, data.years); return `The negotiation works: €${w.toLocaleString()} a week, signed and sealed.`; }
    if (chance(0.5)) { signRenewal(state, world, data.wage, data.years); addTrust(state, -2, res); return `The club will not move. ${J} signs the original offer, slightly embarrassed.`; }
    addTrust(state, -6, res); fx({ board: -5, stress: 3 }); return `Talks collapse. The board withdraws the offer. ${J}'s contract is now running down.`;
  }
  addTrust(state, -8, res);
  fx({ board: -8, fans: -5, press: 2, stress: 3 });
  return `${J} refuses to sign. The club's statement is polite. The manager's face is not.`;
}

function signRenewal(state, world, wage, years) {
  const p = state.player;
  p.club.wageWeekly = wage;
  p.club.contractEndWeek = contractEndWeekFor(world, p.club.key, state.week, years);
  p.club.releaseClause = Math.round(p.marketValue * 3 / 1000) * 1000;
  p.renewalOffered = false;
  updateMarketValue(state);
}

// ═══════════════════════════ MONEY ═══════════════════════════
function moneyMonth(state, res) {
  const p = state.player;
  if (state.week > 0 && monthOf(state.week) === monthOf(state.week - 1)) return;
  const wage = (p.club?.wageWeekly ?? 0) * 4.33;
  const endorse = p.endorsements.filter((e) => e.expiryWeek > state.week).reduce((a, e) => a + e.annualValue / 12, 0);
  p.endorsements = p.endorsements.filter((e) => e.expiryWeek > state.week);
  const gross = wage + p.pendingBonus + endorse;
  p.pendingBonus = 0;
  const agentFee = p.agent ? gross * (p.agent.cut / 100) : 0;
  let taxRate = TAX[p.club?.country ?? p.nationality] ?? DEFAULT_TAX;
  if (gross < 2000) taxRate *= 0.5;
  const tax = gross * taxRate;
  const q = p.club ? leagueQuality(p.club.key) : 50;
  const living = Math.max(80 + Math.max(0, q - 50) * 30, gross * 0.18) * p.lifestyle;
  const family = p.family.monthlySupport;
  const net = Math.round(gross - agentFee - tax - living - family);
  p.wealthEUR += net;
  res.money = { gross: Math.round(gross), agentFee: Math.round(agentFee), tax: Math.round(tax), living: Math.round(living), family, net };
  // Debt is real: it costs interest every month and keeps coming back as a story until it's paid off.
  if (p.wealthEUR < 0) {
    const interest = Math.round(-p.wealthEUR * DEBT.monthlyInterest);
    p.wealthEUR -= interest;
    res.money.interest = interest;
    p.debtMonths = (p.debtMonths ?? 0) + 1;
    if (p.debtMonths === 1 || p.debtMonths % DEBT.storyEveryMonths === 0) res.triggers.push('debt');
    if (p.debtMonths >= 2 && !res.mood) res.mood = 'Anxious';
  } else p.debtMonths = 0;
}

// ═══════════════════════════ SEASON END ═══════════════════════════
function seasonEnd(state, world, season, res) {
  const p = state.player;
  season.finished = true;
  state.nextSeasonMinYear = season.year + 1; // never replay a season after promotion/relegation
  const table = standings(season);
  const def = leagueDef(world, season.key);
  const { country, tier } = splitKey(season.key);
  const row = table.find((r) => r.club === p.club.name);
  const relN = Number(String(def?.relegation ?? '').match(/Bottom (\d)/)?.[1] ?? 3);
  const recap = {
    league: season.name, label: season.label, pos: row?.pos ?? null, teams: table.length, champion: table[0].club,
    apps: p.season.apps, goals: p.season.goals, assists: p.season.assists, motms: p.season.motms,
    avgRating: p.season.ratings.length ? round1(p.season.ratings.reduce((a, b) => a + b, 0) / p.season.ratings.length) : null,
    trophies: [], awards: [], movement: null,
  };
  if (row?.pos === 1) {
    const trophy = `${season.name} ${season.label}`;
    p.career.trophies.push(trophy); recap.trophies.push(trophy); res.trophies.push(trophy);
    addRep(state, 3 + leagueQuality(season.key) / 20, res);
    addFollowers(state, 50000 * socialBoost(state));
    if (p.career.trophies.length === 1) addMilestone(res, 'First senior trophy');
  }
  if (recap.apps >= 15 && recap.avgRating >= 7.3) recap.awards.push(`${p.club.name} Player of the Season ${season.label}`);
  if (ageNow(state) <= 21 && recap.apps >= 10 && recap.avgRating >= 6.9) recap.awards.push(`${p.club.name} Young Player of the Season ${season.label}`);
  if (recap.goals >= Math.max(12, 30 - (leagueQuality(season.key) - 55) / 3)) recap.awards.push(`${season.name} Top Scorer contender (${recap.goals} goals)`);
  for (const a of recap.awards) { p.career.awards.push(a); addRep(state, 1.5, res); }
  res.awards.push(...recap.awards);
  // Promotion / relegation (only between consecutive playable tiers)
  const lowerKey = leagueKey(country, tier + 1), upperKey = leagueKey(country, tier - 1);
  const lowerDef = leagueDef(world, lowerKey), upperDef = tier > 1 ? leagueDef(world, upperKey) : null;
  const clubs = table.map((r) => r.club);
  if (lowerDef && isPlayable(lowerDef)) {
    const down = clubs.slice(-relN);
    const lowerClubs = leagueClubs(state, world, lowerKey);
    const up = shuffle(lowerClubs).sort((a, b) => clubStrength(b, lowerKey) + gauss() * 4 - clubStrength(a, lowerKey)).slice(0, relN);
    state.leagueClubs[season.key] = clubs.filter((c) => !down.includes(c)).concat(up);
    state.leagueClubs[lowerKey] = lowerClubs.filter((c) => !up.includes(c)).concat(down);
    if (down.includes(p.club.name)) recap.movement = 'relegated';
  }
  if (upperDef && isPlayable(upperDef)) {
    const up = clubs.slice(0, relN);
    const upperClubs = leagueClubs(state, world, upperKey);
    const down = [...upperClubs].sort((a, b) => clubStrength(a, upperKey) + gauss() * 4 - clubStrength(b, upperKey)).slice(0, relN);
    state.leagueClubs[upperKey] = upperClubs.filter((c) => !down.includes(c)).concat(up);
    state.leagueClubs[season.key] = (state.leagueClubs[season.key] ?? clubs).filter((c) => !up.includes(c)).concat(down);
    if (up.includes(p.club.name)) recap.movement = 'promoted';
  }
  if (recap.movement && !p.club.loan) {
    const newKey = leagueKey(country, recap.movement === 'promoted' ? tier - 1 : tier + 1);
    p.club.key = newKey; p.club.tier = splitKey(newKey).tier;
    if (recap.movement === 'promoted') { p.career.trophies.push(`Promotion ${season.label}`); addRep(state, 2, res); }
    else p.marketValue = Math.round(p.marketValue * 0.8 / 1000) * 1000;
  }
  p.career.seasons.push({ ...recap, club: p.club.name, age: ageNow(state) });
  res.seasonEnd = recap;
  log(state, `Season ${season.label} ends: ${p.club.name} finish ${row?.pos ?? '?'}/${table.length}`, 'season');
  // Ageing and season reset
  const age = ageNow(state);
  if (age >= 29 && age <= 32) { changeStat(state, 'pace', -1, res); changeStat(state, 'physical', -1, res); if (chance(0.5)) changeStat(state, 'mental', 1, res); }
  if (age >= 33) { changeStat(state, 'pace', -randint(2, 3), res); changeStat(state, 'physical', -randint(2, 3), res); changeStat(state, 'dribbling', -1, res); if (p.position === 'GK') changeStat(state, 'goalkeeping', -randint(1, 2), res); }
  p.season = { apps: 0, goals: 0, assists: 0, motms: 0, ratings: [], growthUsed: 0 };
  p.yellowCards = 0;
  if (age >= 33 && !state.ended) {
    pushDecision(state, {
      kind: 'retire', type: 'personal', data: {},
      prompt: `Age ${age}. Do you retire now or play on?`,
      choices: [
        { id: 'a', label: 'Retire', description: 'Go out on your own terms.', risk: 'extreme', consequence: 'Career ends. Legacy is final.' },
        { id: 'b', label: 'One more season', description: 'The body can do it. Probably.', risk: 'medium', consequence: 'More memories — or a sad ending.' },
      ],
    });
  }
}

// ═══════════════════════════ EVENTS ═══════════════════════════
// Arenas = the parts of his life a week's decisions come from. Each week draws decisions from
// several different arenas, so one week is football + love + media, the next is family + politics.
export const ARENAS = {
  football: { cats: ['training', 'manager', 'dressing', 'body', 'national', 'milestone', 'veteran'], w: 3 },
  media: { cats: ['media'], w: 2 },
  love: { cats: ['love'], w: 1.3 },
  friends: { cats: ['friends'], w: 1.4 },
  family: { cats: ['family', 'culture'], w: 1.3 },
  lifestyle: { cats: ['money', 'lifestyle'], w: 1.2 },
  politics: { cats: ['politics'], w: 1 },
};
export const CAT_ARENA = Object.fromEntries(Object.entries(ARENAS).flatMap(([a, v]) => v.cats.map((c) => [c, a])));

function fireScenario(state, world, s, res, carried = null) {
  markUsed(state, s);
  const inst = instantiate(s, state, world, carried);
  const ev = { sid: s.id, type: s.cat, arena: CAT_ARENA[s.cat] ?? 'football', ui: s.ui ?? null, headline: fill(s.title, inst, state), text: textOf(s, inst, state), moment: !!s.moment, hasChoices: !!s.choices?.length };
  if (s.moment) res.moment = ev;
  else { if (!res.event) res.event = ev; res.events.push(ev); state.lastEventType = s.cat; }
  if (s.fx) applyEffects(state, world, resolveFx(s.fx, inst, state), res, { source: s.cat });
  if (s.choices?.length) pushDecision(state, { ...decisionFor(s, inst, state), scene: ev.text, headline: ev.headline, arena: ev.arena });
}

function eventWeek(state, world, res) {
  const p = state.player;
  if (state.ended) return;
  const ctx = scenarioContext(state, world, res);
  const room = () => LIFE.maxPending - state.pending.length;
  const used = new Set(state.pending.map((d) => d.cat).filter(Boolean));
  // 1. Storylines that come back weeks later go first.
  for (const due of state.threads.filter((t) => t.dueWeek <= state.week)) {
    if (room() <= 0) break;
    state.threads = state.threads.filter((t) => t !== due);
    const s = world.scenarioById[due.id];
    if (s && (p.club || s.when?.freeAgent) && conditionsMet(s.when, ctx)) { fireScenario(state, world, s, res, due.data); used.add(s.cat); }
    else if (s && (due.tries ?? 0) < 4) state.threads.push({ ...due, dueWeek: state.week + 2, tries: (due.tries ?? 0) + 1 });
  }
  // 2. Things that just happened (a debut, a red card, a relationship hitting the red line…)
  const triggers = [...new Set(res.triggers)];
  for (let i = 0; i < 2 && triggers.length && room() > 0; i++) {
    const s = pickScenario(state, world, ctx, { triggers, excludeCats: used });
    if (!s) break;
    fireScenario(state, world, s, res);
    used.add(s.cat);
    const ti = triggers.indexOf(s.trigger); if (ti >= 0) triggers.splice(ti, 1);
  }
  // 3. The rest of life: 1-4 decisions from different arenas.
  const target = Number(weightedPick(Object.entries(LIFE.weeklyDecisions), ([, w]) => w)[0]);
  let arenas = Object.keys(ARENAS);
  while (res.events.length < target && room() > 0 && arenas.length) {
    const arena = weightedPick(arenas, (a) => ARENAS[a].w);
    arenas = arenas.filter((a) => a !== arena);
    const cats = ARENAS[arena].cats.filter((c) => !used.has(c));
    const s = cats.length ? pickScenario(state, world, ctx, { cats }) : null;
    if (s) { fireScenario(state, world, s, res); used.add(s.cat); }
  }
}

// ═══════════════════════════ INTERLUDES ═══════════════════════════
// A mid-week scene that does NOT advance time. main.js asks for one when "Play week" is pressed;
// if one comes back, the player answers it and sees the result immediately, then plays on.
export function maybeInterlude(state, world, force = false) {
  if (state.ended || state.interlude) return state.interlude ?? null;
  const n = state.interludeWeek === state.week ? state.interludeCount ?? 0 : 0;
  if (!force && (n >= 2 || !chance(n === 0 ? LIFE.interludeChance : LIFE.interludeChance * 0.35))) return null;
  const s = pickScenario(state, world, scenarioContext(state, world, null), { interlude: true });
  if (!s) return null;
  markUsed(state, s);
  const inst = instantiate(s, state, world);
  state.interludeWeek = state.week;
  state.interludeCount = n + 1;
  const d = s.choices?.length ? decisionFor(s, inst, state) : null;
  state.interlude = {
    sid: s.id, data: inst, time: fill(s.time ?? pick(world.life?.words?.TIME ?? ['Midweek']), inst, state),
    headline: fill(s.title, inst, state), text: textOf(s, inst, state), ui: s.ui ?? null,
    choices: d ? d.choices : [{ id: 'ok', label: 'Carry on', description: '', risk: 'low', consequence: '' }],
  };
  return state.interlude;
}

export function answerInterlude(state, world, choiceId) {
  const it = state.interlude;
  if (!it) return null;
  const s = world.scenarioById[it.sid];
  const res = emptyRes(state);
  const before = snap(state);
  let text = '', label = it.choices.find((c) => c.id === choiceId)?.label ?? '';
  if (s?.fx) applyEffects(state, world, resolveFx(s.fx, it.data, state), res, { source: 'interlude' });
  if (s?.choices?.length) {
    const r = resolveChoice(state, s, it.data, choiceId);
    text = r.text;
    applyEffects(state, world, r.fx, res, { source: 'interlude' });
  }
  if (res.mood) state.player.mood = res.mood;
  state.interlude = null;
  state.lastAside = { kind: 'interlude', time: it.time, headline: it.headline, label, text, changes: diff(before, snap(state)), ripples: res.ripples ?? [], stats: res.statChanges };
  return state.lastAside;
}

// ═══════════════════════════ FREE TIME ═══════════════════════════
export const freeTimeSlots = (state) => freeTimeLeft(state);
export const freeTimeList = (state, world) => freeTimeOptions(state, world, scenarioContext(state, world, null), conditionsMet);
export function freeTime(state, world, id) {
  const before = snap(state);
  const r = doFreeTime(state, world, id, applyEffects);
  if (!r) return null;
  if (r.res.mood) state.player.mood = r.res.mood;
  state.lastAside = { kind: 'free', icon: r.action.icon, headline: r.action.label, text: r.text, changes: diff(before, snap(state)), ripples: r.res.ripples ?? [], stats: r.res.statChanges };
  return state.lastAside;
}

// Key moments: a split-second decision before next week's match, which changes that match.
function momentWeek(state, world, res) {
  const p = state.player;
  if (!p.club || p.injury || p.suspension > 0 || state.pending.length >= LIFE.maxPending || state.ended) return;
  if (!['starter', 'rotation'].includes(p.squadRole) && !chance(0.3)) return;
  const season = currentSeason(state);
  const next = state.week + 1;
  const hasMatch = (season && roundsInWeek(season, next).some((r) => r.matches.some((m) => m.h === p.club.name || m.a === p.club.name)))
    || (state.cup?.alive && state.cup.rounds.some((r) => r.week === next));
  if (!hasMatch || !chance(0.3)) return;
  const s = pickScenario(state, world, scenarioContext(state, world, res), { moment: true });
  if (s) fireScenario(state, world, s, res);
}

// ═══════════════════════════ ADVANCE WEEK ═══════════════════════════
export function advanceWeek(state, world, plan = { intensity: 'balanced', focus: 'auto' }) {
  const p = state.player;
  const res = {
    week: state.week, dateLabel: dateLabel(state.week), age: ageNow(state), clubBefore: p.club?.name ?? null,
    matches: [], intl: [], outcomes: [], milestones: [], trophies: [], awards: [], notes: [], statChanges: {}, event: null, events: [], plan, triggers: [], ripples: [], life: {},
  };
  const roleBefore = p.squadRole, ntBefore = p.national.status, preseason = (() => { const s = currentSeason(state); return s && state.week === s.preStartWeek; })();
  if (preseason) res.triggers.push('seasonStart');
  // 1. Consequences of last week's decisions
  resolveDecisions(state, world, res);
  if (state.ended) return finish(state, world, res);
  // 2. Training plan
  if (p.injury) p.pfm = clamp(p.pfm + 4, 0, p.pfmCeiling);
  else {
    p.pfm = clamp(p.pfm + PFM.plan[plan.intensity], 0, p.pfmCeiling);
    const gp = { hard: 0.22, balanced: 0.1, light: 0.04, rest: 0 }[plan.intensity];
    if (chance(gp)) grow(state, plan.focus && plan.focus !== 'auto' ? plan.focus : pick(relevantStats(p.position).slice(0, 3)), res);
    // Hard work on the training ground slowly wins a manager back.
    if (p.club && p.manager.trust < 45 && plan.intensity !== 'rest' && chance(plan.intensity === 'hard' ? 0.6 : 0.35)) addTrust(state, 1, res);
  }
  // 3. Football
  if (p.club) { ensureSeason(state, world); ensureCup(state, world); }
  nationalTeamWeek(state, world, res);
  if (p.club) { playLeagueRounds(state, world, res); playCupRound(state, world, res); }
  // 4. Body
  injuryWeek(state, world, res, res.matches.filter((m) => m.minutes > 0).length, plan);
  p.pfm = clamp(p.pfm + PFM.naturalRecovery, 0, p.pfmCeiling);
  p.pfmCeiling = round1(Math.max(0, p.pfmCeiling - PFM.ageDecay(ageNow(state))));
  // 4b. Life: relationships drift, stress and morale move, red lines trigger stories
  lifeWeek(state, world, res, plan);
  // 5. Club life
  updateRole(state, res);
  if (state.week % 4 === 0) updateMarketValue(state);
  moneyMonth(state, res);
  contractWeek(state, world, res);
  if (!state.ended) transferWeek(state, world, res);
  // 6. Season end
  const season = currentSeason(state);
  if (season && !season.finished && isComplete(season)) seasonEnd(state, world, season, res);
  // 7. Story triggers, event and next week's key moment
  collectTriggers(state, res, roleBefore, ntBefore);
  eventWeek(state, world, res);
  momentWeek(state, world, res);
  state.lastCats = res.events.map((e) => e.type);
  state.interlude = null;
  state.lastAside = null;
  state.matchMod = null; // a key moment only ever applies to the week it was chosen for
  return finish(state, world, res);
}

function collectTriggers(state, res, roleBefore, ntBefore) {
  const p = state.player, t = res.triggers;
  const nextAge = ageAt(p.dob, state.week + 1);
  if (nextAge !== res.age) res.birthday = nextAge;
  if (res.moved) t.push({ loan: 'loanStart', 'loan return': 'loanReturn', 'contract expired': 'freeAgent' }[res.moved.type] ?? 'moved');
  if (res.injury) t.push(res.injury.weeksLeft >= 6 ? 'longInjury' : 'injured');
  if (res.recovered) t.push(res.recovered.total >= 6 ? 'returnLong' : 'recovered');
  if (res.seasonEnd) t.push(res.seasonEnd.movement ?? (res.seasonEnd.pos === 1 ? 'champion' : 'seasonEnd'));
  if (res.trophies.some((x) => !x.startsWith('Promotion')) && !t.includes('champion')) t.push('trophy');
  if (res.birthday && [18, 21, 25, 30, 33].includes(res.birthday)) t.push(`birthday${res.birthday}`);
  if (p.national.status !== ntBefore) t.push(p.national.status === 'none' ? 'ntDropped' : p.national.status === 'monitoring' ? 'ntWatch' : 'callup');
  if (res.milestones.some((x) => x.startsWith('Senior international debut'))) t.push('ntDebut');
  if (roleBefore !== p.squadRole) t.push(p.squadRole === 'starter' ? 'roleStarter' : p.squadRole === 'outcast' ? 'roleOutcast' : 'roleChange');
}

function finish(state, world, res) {
  const p = state.player;
  const age = ageNow(state);
  if (age !== res.age) res.birthday = age;
  if (!state.ended && age >= 40) state.ended = { reason: 'age', week: state.week };
  if (!state.ended && p.pfmCeiling <= 0) state.ended = { reason: 'pfm', week: state.week };
  p.career.peakOverall = Math.max(p.career.peakOverall, overall(p));
  p.mood = moodFrom(p, res.mood);
  res.mood = p.mood;
  res.ovr = overall(p);
  if (state.ended) { res.careerEnd = state.ended.reason; closeClubHistory(state); }
  state.last = res;
  state.week++;
  if (p.club && !state.ended) { ensureSeason(state, world); ensureCup(state, world); }
  return res;
}

// ═══════════════════════════ LEGACY ═══════════════════════════
export function legacy(state) {
  const c = state.player.career, n = state.player.national;
  const titles = c.trophies.filter((t) => !t.startsWith('Promotion')).length;
  const score = titles * 6 + c.trophies.length * 1.5 + n.caps * 0.4 + n.goals * 0.6 + Math.max(0, c.peakOverall - 55) * 1.6
    + Math.log10(Math.max(1, c.peakMarketValue)) * 3 + c.awards.length * 3 + c.apps * 0.02 + c.goals * 0.025;
  const LABELS = ['Forgotten', 'Decent Career', 'Club Legend', 'National Hero', 'Legend', 'Icon'];
  let i = score < 30 ? 0 : score < 50 ? 1 : score < 70 ? 2 : score < 95 ? 3 : score < 125 ? 4 : 5;
  // World-class ceilings: you can't be an Icon without being genuinely elite.
  const peakCap = c.peakOverall < 70 ? 3 : c.peakOverall < 80 ? 4 : 5;
  i = Math.min(i, peakCap);
  if (i === 3 && n.caps < 30) i = 2;
  return { score: Math.round(score), label: LABELS[i] };
}
