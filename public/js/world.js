// Loads data/world and answers questions about leagues and clubs.
import { LEAGUE_QUALITY, DEFAULT_TIER_QUALITY, CLUB_BONUS, SEASON_OVERRIDE } from './config.js';
import { hash, round1 } from './util.js';
import { nthMondayWeek, isFifaWeek } from './time.js';

export const REGION_FILES = ['europe', 'asia', 'south-america', 'north-central-america', 'africa', 'oceania'];

export async function loadWorld(fetchJson) {
  const countries = [];
  for (const region of REGION_FILES) {
    const data = await fetchJson(`data/world/${region}.json`);
    for (const c of data.countries) if (c.code) countries.push({ ...c, region });
  }
  const nationalTeams = (await fetchJson('data/world/national-teams.json')).teams;
  // Hand-written story scenarios (data/scenarios) and narration phrase banks (data/text)
  const scenarios = [];
  for (const file of (await fetchJson('data/scenarios/index.json')).files) {
    for (const s of (await fetchJson(`data/scenarios/${file}`)).scenarios) scenarios.push({ ...s, file });
  }
  const text = { ...(await fetchJson('data/text/narration.json')), ...(await fetchJson('data/text/story.json')) };
  const life = await fetchJson('data/text/life.json');
  return {
    countries, nationalTeams, scenarios, text, life,
    byName: Object.fromEntries(countries.map((c) => [c.country, c])),
    scenarioById: Object.fromEntries(scenarios.map((s) => [s.id, s])),
  };
}

export const leagueKey = (country, tier) => `${country}|${tier}`;
export const splitKey = (key) => { const [country, tier] = key.split('|'); return { country, tier: Number(tier) }; };

export function clubsOf(league) {
  if (league.clubs?.length) return league.clubs;
  if (league.conferences) return Object.values(league.conferences).flat();
  return [];
}
export const isPlayable = (league) => league.complete !== false && clubsOf(league).length >= 8;

export function leagueDef(world, key) {
  const { country, tier } = splitKey(key);
  return world.byName[country]?.leagues?.find((l) => l.tier === tier) ?? null;
}

export function playableLeagues(world, country = null) {
  const out = [];
  for (const c of world.countries) {
    if (country && c.country !== country) continue;
    for (const l of c.leagues ?? []) if (isPlayable(l)) out.push({ key: leagueKey(c.country, l.tier), country: c.country, tier: l.tier, name: l.name, region: c.region });
  }
  return out;
}

export function leagueQuality(key) {
  const { tier } = splitKey(key);
  return LEAGUE_QUALITY[key] ?? DEFAULT_TIER_QUALITY[Math.min(tier, 4)] ?? 38;
}

// Current club list for a league (promotion/relegation stored in state overrides the data files).
export function leagueClubs(state, world, key) {
  if (state.leagueClubs[key]) return state.leagueClubs[key];
  const def = leagueDef(world, key);
  return def ? [...clubsOf(def)] : [];
}

export function clubStrength(club, key) {
  return round1(leagueQuality(key) + (CLUB_BONUS[club] ?? 0) + (hash(club) - 0.5) * 9);
}

const MONTH_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/g;
const MONTH_IDX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// {startMonth, endMonth} for a league's season.
export function seasonMonths(world, key) {
  if (SEASON_OVERRIDE[key]) return { startMonth: SEASON_OVERRIDE[key][0], endMonth: SEASON_OVERRIDE[key][1] };
  const tokens = [...String(leagueDef(world, key)?.season ?? '').matchAll(MONTH_RE)].map((m) => MONTH_IDX[m[1]]);
  if (tokens.length >= 2) return { startMonth: tokens[0], endMonth: tokens[1] };
  return { startMonth: 7, endMonth: 4 };
}

// Week bounds of the season that starts in `year`.
export function seasonBounds(world, key, year) {
  const { startMonth, endMonth } = seasonMonths(world, key);
  const spans = endMonth < startMonth;
  const startWeek = nthMondayWeek(year, startMonth, 2);
  const endWeek = nthMondayWeek(spans ? year + 1 : year, endMonth, 3);
  return { startWeek, endWeek, preStartWeek: startWeek - 5, spans };
}

// Which season (start year) is running or next up at week w.
export function seasonYearFor(world, key, w, yearNow) {
  for (const y of [yearNow - 1, yearNow]) {
    const b = seasonBounds(world, key, y);
    if (w >= b.preStartWeek && w <= b.endWeek) return y;
  }
  for (const y of [yearNow, yearNow + 1]) if (seasonBounds(world, key, y).preStartWeek > w) return y;
  return yearNow + 1;
}

export function availableMatchWeeks(startWeek, endWeek) {
  const weeks = [];
  for (let w = startWeek; w <= endWeek; w++) if (!isFifaWeek(w)) weeks.push(w);
  return weeks;
}

// Transfer window: summer + winter windows relative to the league's season style.
export function windowOpen(world, key, month) {
  const { startMonth, endMonth } = seasonMonths(world, key);
  if (endMonth < startMonth) return month === 6 || month === 7 || month === 0; // Aug-May style: Jul, Aug, Jan
  return month <= 2 || month === 6; // calendar style: Jan-Mar, Jul
}

export function nationalTeamInfo(world, nation) {
  return world.nationalTeams.find((t) => t.nation === nation || (nation === 'United States' && t.nation === 'USA') || (nation === 'United Arab Emirates' && t.nation === 'UAE')) ?? null;
}

export function nationRank(world, nation) {
  const band = nationalTeamInfo(world, nation)?.rankingBand;
  const m = band && String(band).match(/\d+/);
  return m ? Number(m[0]) : 150;
}

export const countryFlag = (world, name) => world.byName[name]?.flag ?? '🏳️';
