// League seasons: fixtures, simulated results, tables.
import { clamp, poisson, shuffle } from './util.js';
import { clubStrength, leagueClubs, leagueDef, seasonBounds, availableMatchWeeks } from './world.js';

export function roundRobin(clubs) {
  const list = [...clubs];
  if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

export function buildSeason(state, world, key, year) {
  const clubs = leagueClubs(state, world, key);
  const def = leagueDef(world, key);
  const b = seasonBounds(world, key, year);
  let rounds = roundRobin(shuffle(clubs));
  if (clubs.length <= 24) rounds = rounds.concat(rounds.map((r) => r.map(([h, a]) => [a, h])));
  const weeks = availableMatchWeeks(b.startWeek, b.endWeek);
  const season = {
    key, year, name: def?.name ?? key, clubs: [...clubs],
    startWeek: b.startWeek, endWeek: b.endWeek, preStartWeek: b.preStartWeek,
    label: b.spans ? `${year}-${String(year + 1).slice(2)}` : String(year),
    rounds: rounds.map((pairs, i) => ({
      no: i + 1,
      week: weeks[Math.min(weeks.length - 1, Math.floor((i * weeks.length) / rounds.length))],
      matches: pairs.map(([h, a]) => ({ h, a, hs: null, as: null })),
    })),
    table: Object.fromEntries(clubs.map((c) => [c, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])),
    finished: false,
  };
  return season;
}

// Expected-goals style simulation from two strengths.
export function simScore(hStr, aStr) {
  const diff = (hStr - aStr) / 22;
  const hl = clamp(1.35 * Math.exp(diff + 0.1), 0.15, 4.5);
  const al = clamp(1.1 * Math.exp(-diff), 0.15, 4.5);
  return [poisson(hl), poisson(al)];
}

export function recordResult(season, m, hs, as) {
  m.hs = hs; m.as = as;
  const H = season.table[m.h], A = season.table[m.a];
  if (!H || !A) return;
  H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
  if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
}

export function simulateMatch(season, m) {
  const [hs, as] = simScore(clubStrength(m.h, season.key), clubStrength(m.a, season.key));
  recordResult(season, m, hs, as);
}

export function standings(season) {
  return Object.entries(season.table)
    .map(([club, r]) => ({ club, ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.club.localeCompare(y.club))
    .map((r, i) => ({ pos: i + 1, ...r }));
}

export const roundsInWeek = (season, w) => season.rounds.filter((r) => r.week === w);

// Simulate everything scheduled before week w (used when joining a league mid-season).
export function catchUp(season, w) {
  for (const r of season.rounds) if (r.week < w) for (const m of r.matches) if (m.hs === null) simulateMatch(season, m);
}

export function isComplete(season) {
  return season.rounds.every((r) => r.matches.every((m) => m.hs !== null));
}

export function nextFixtures(season, club, fromWeek, n = 3) {
  const out = [];
  for (const r of season.rounds) {
    if (r.week < fromWeek) continue;
    const m = r.matches.find((x) => x.h === club || x.a === club);
    if (m && m.hs === null) out.push({ week: r.week, home: m.h === club, opp: m.h === club ? m.a : m.h });
    if (out.length >= n) break;
  }
  return out;
}
