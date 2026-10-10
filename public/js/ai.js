// Claude narrator (optional). The engine decides the facts; Claude writes the story.
// Everything Claude suggests that touches numbers is clamped here before it is applied.
import { clamp, round1 } from './util.js';
import { overall } from './player.js';
import { standings } from './season.js';
import { leagueDef } from './world.js';
import { ageNow, currentSeason, applyEffects } from './engine.js';
import { monthOf, dateLabel } from './time.js';
import { windowOpen, nationalTeamInfo } from './world.js';

const MOODS = ['Confident', 'Motivated', 'Anxious', 'Frustrated', 'Determined', 'Broken', 'On Fire', 'Lost', 'Focused', 'Numb', 'Homesick', 'Angry', 'Relieved'];
const AI_DECISION_TYPES = ['in-match', 'tactical', 'personal', 'media', 'financial'];

// Two ways to reach Claude:
//  - hosted on claude.ai: the page's built-in `sample` capability (no API key, viewer's own Claude account)
//  - local (start-game.bat): our server.js, which uses the API key in .env
let statusPromise = null, sampleFn = null, rulesPromise = null;
export const isHosted = () => typeof window !== 'undefined' && !!window.claude?.use;

export function aiStatus() {
  statusPromise ??= (async () => {
    if (isHosted()) {
      sampleFn = await window.claude.use('sample').catch(() => null);
      return sampleFn
        ? { ai: true, backend: 'claude.ai', model: 'your Claude account' }
        : { ai: false, reason: 'Claude is not available in this view. Open the game on claude.ai while signed in.' };
    }
    try { const r = await fetch('/api/status'); return { backend: 'server', ...(await r.json()) }; }
    catch { return { ai: false, reason: 'the local server is not running (open the game with start-game.bat).' }; }
  })();
  return statusPromise;
}

const SAMPLE_ERRORS = {
  not_granted: 'you did not allow this page to use Claude', sampling_disabled: 'Claude is not available for this account',
  rate_limited: 'Claude usage limit reached for now; try again later', session_expired: 'sign in to claude.ai again',
  refused: 'Claude declined to write this week', invalid_json: 'Claude replied in the wrong format', prompt_too_large: 'the week was too long to send',
};

function hostedRules() {
  rulesPromise ??= Promise.all(['prompts/engine.txt', 'prompts/hybrid-rules.txt'].map((p) => fetch(p).then((r) => r.text()))).then((t) => t.join('\n\n'));
  return rulesPromise;
}

function compactPlayer(state) {
  const p = state.player;
  return {
    identity: { name: p.name, nickname: p.nickname, jerseyName: p.jerseyName, number: p.number, position: p.position, nationality: p.nationality, age: ageNow(state) },
    club: p.club ? { clubName: p.club.name, league: currentSeason(state)?.name, country: p.club.country, tier: p.club.tier, wageWeeklyEUR: p.club.wageWeekly, contractEnds: dateLabel(p.club.contractEndWeek), onLoan: !!p.club.loan } : null,
    manager: { name: p.manager.name, trust: p.manager.trust, tacticalFit: p.manager.tacticalFit }, squadRole: p.squadRole,
    stats: { ...p.stats, overall: overall(p), pfm: Math.round(p.pfm), pfmCeiling: p.pfmCeiling, form: p.form },
    offField: { marketValueEUR: p.marketValue, followers: p.followers, wealthEUR: p.wealthEUR, reputation: p.reputation, endorsements: p.endorsements.map((x) => x.brand) },
    career: { apps: p.career.apps, goals: p.career.goals, assists: p.career.assists, motms: p.career.motms, trophies: p.career.trophies, awards: p.career.awards, clubs: p.career.clubHistory.map((h) => h.club) },
    season: { apps: p.season.apps, goals: p.season.goals, assists: p.season.assists },
    status: { injured: !!p.injury, injury: p.injury, suspended: p.suspension > 0, transferListed: p.transferListed },
    relationships: { keyTeammates: p.keyTeammates, agent: p.agent, partner: p.partner, family: p.family },
    nationalTeam: p.national, mood: p.mood,
  };
}

export function buildContext(state, world, res) {
  const p = state.player;
  const season = currentSeason(state);
  let table = null;
  if (season) {
    const rows = standings(season);
    const me = rows.findIndex((r) => r.club === p.club?.name);
    table = rows.filter((r, i) => i < 4 || Math.abs(i - me) <= 2).map(({ pos, club, p: played, gd, pts }) => ({ pos, club, played, gd, pts }));
  }
  const def = season ? leagueDef(world, season.key) : null;
  const country = p.club ? world.byName[p.club.country] : null;
  const nt = nationalTeamInfo(world, p.nationality);
  return {
    player: compactPlayer(state),
    previousDecisions: res.aiPreviousDecisions ?? [],
    codeDecisionOutcomes: res.outcomes.filter((o) => o.kind !== 'ai').map(({ prompt, label, text }) => ({ prompt, choice: label, outcome: text })),
    recentLog: state.log.slice(-4).map((l) => l.headline),
    storyThreads: state.history.slice(-8),
    currentStandings: table,
    transferWindow: p.club ? windowOpen(world, p.club.key, monthOf(state.week)) : true,
    resolvedWeek: {
      dateLabel: res.dateLabel, age: res.age, matches: res.matches, international: res.intl, nationalTeamUpdate: res.ntUpdate ?? null,
      injury: res.injury ?? null, recovered: res.recovered ?? null, careerEnding: !!res.careerEnding, moved: res.moved ?? null,
      offerReceived: res.offer ? { club: res.offer.club, league: res.offer.leagueName, country: res.offer.country, type: res.offer.type, feeEUR: res.offer.fee, wageWeeklyEUR: res.offer.wageWeekly } : null,
      seasonEnd: res.seasonEnd ?? null, trophies: res.trophies, awards: res.awards, milestones: res.milestones,
      statChanges: res.statChanges, roleChange: res.roleChange ?? null, money: res.money ?? null,
      offlineEvent: res.event ? { headline: res.event.headline, text: res.event.text } : null,
      trainingPlan: res.plan, careerEnd: res.careerEnd ?? null,
    },
    codeDecisions: state.pending.map((d) => ({ prompt: d.prompt, choices: d.choices.map((c) => c.label) })),
    world: {
      league: def ? { name: def.name, teams: season.clubs.length, notes: def.notes ?? null } : null,
      country: country ? { name: country.country, cups: country.cups, supporters: country.supporters, rivalries: country.rivalries, stadiums: country.stadiums } : null,
      nationalTeam: nt ? { coach: nt.coach, context: nt.context, keyPlayers: nt.keyPlayers?.slice(0, 10) } : null,
    },
  };
}

export async function requestNarration(context) {
  const st = await aiStatus();
  if (st.backend === 'claude.ai') {
    if (!sampleFn) throw new Error(st.reason);
    const prompt = `${await hostedRules()}\n\nSimulate and narrate this game week. Reply with only the JSON object described in OUTPUT FORMAT. Context:\n${JSON.stringify(context)}`;
    try {
      const data = await sampleFn.json(prompt, { modelTier: 'default', cache: false });
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw { code: 'invalid_json' };
      return { ok: true, data, usage: null, costUSD: 0 };
    } catch (e) {
      throw new Error(SAMPLE_ERRORS[e?.code] ?? e?.message ?? 'Claude is unavailable right now');
    }
  }
  const r = await fetch('/api/narrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) });
  const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!data.ok) throw new Error(data.error ?? 'unknown error');
  return data;
}

// Merge Claude's JSON into the story and apply its (clamped) consequences.
export function mergeAI(state, world, res, offline, ai) {
  const p = state.player;
  const paragraphs = String(ai.narrative ?? '').split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean);
  const story = {
    ...offline,
    headline: typeof ai.headline === 'string' && ai.headline.trim() ? ai.headline.trim() : offline.headline,
    eventType: typeof ai.eventType === 'string' ? ai.eventType : offline.eventType,
    isMajorEvent: typeof ai.isMajorEvent === 'boolean' ? ai.isMajorEvent : offline.isMajorEvent,
    paragraphs: paragraphs.length ? paragraphs : offline.paragraphs,
    socialFeed: Array.isArray(ai.socialFeed) && ai.socialFeed.length
      ? ai.socialFeed.slice(0, 5).map((x) => ({ handle: String(x.handle ?? '@fan'), displayName: String(x.displayName ?? 'Fan'), verified: !!x.verified, platform: x.platform === 'instagram' ? 'instagram' : 'twitter', text: String(x.text ?? '').slice(0, 280), likes: Number(x.likes) || 0 }))
      : offline.socialFeed,
    moodLabel: MOODS.includes(ai.moodLabel) ? ai.moodLabel : offline.moodLabel,
    source: 'claude',
  };
  // Consequences (small, clamped, routed through the engine's normal rules).
  const eff = { growth: [], stat: {} };
  for (const [k, v] of Object.entries(ai.statDeltas ?? {})) {
    const n = Math.round(Number(v) || 0);
    if (k === 'pfm') eff.pfm = clamp(n, -10, 10);
    else if (k in p.stats && n > 0) eff.growth.push(k);
    else if (k in p.stats && n < 0) eff.stat[k] = -1;
  }
  eff.trust = clamp(Math.round(Number(ai.managerTrustDelta) || 0), -12, 8);
  const od = ai.offFieldDeltas ?? {};
  eff.rep = clamp(round1(Number(od.reputation) || 0), -2, 2);
  eff.followers = clamp(Math.round(Number(od.socialFollowers) || 0), -Math.round(p.followers * 0.05), Math.min(200000, Math.round(p.followers * 0.3) + 2000));
  eff.wealth = clamp(Math.round(Number(od.wealth) || 0), -Math.round(Math.abs(p.wealthEUR) * 0.1 + 200), Math.round(Math.abs(p.wealthEUR) * 0.05 + 200));
  if (MOODS.includes(ai.moodLabel)) eff.mood = ai.moodLabel;
  applyEffects(state, world, eff, res);
  p.mood = story.moodLabel;
  // Claude's own decisions (never transfers or contracts — those belong to the engine).
  const decisions = Array.isArray(ai.decisions) ? ai.decisions : [];
  for (const d of decisions.filter((x) => AI_DECISION_TYPES.includes(x?.type)).slice(0, 2)) {
    const choices = (Array.isArray(d.choices) ? d.choices : []).slice(0, 4).map((c, i) => ({
      id: String.fromCharCode(97 + i), label: String(c.label ?? `Option ${i + 1}`).slice(0, 60), description: String(c.description ?? '').slice(0, 200),
      risk: ['low', 'medium', 'high', 'extreme'].includes(c.risk) ? c.risk : 'medium', consequence: String(c.consequence ?? '').slice(0, 200),
    }));
    if (choices.length >= 2 && d.prompt) state.pending.push({ id: Math.random().toString(36).slice(2, 10), kind: 'ai', type: d.type, prompt: String(d.prompt).slice(0, 240), choices, chosen: null });
  }
  return story;
}
