// The journal: a compact record of every week, and a report for every month that sums its weeks up
// (results, numbers, decisions, relationships, money, media). Also writes the "Month in review" story
// shown after playing a whole month at once.
import { weekDate, MONTHS, shortDate } from './time.js';
import { meter, METERS, METER_KEYS } from './life.js';
import { netWorth } from './assets.js';
import { round1, pick } from './util.js';
import { statLabel } from './player.js';

const KEEP_WEEKS = 80;
export const monthKeyOf = (w) => { const d = weekDate(w); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
export const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

export function ensureJournal(state) {
  state.journal = state.journal ?? { weeks: [], months: [] };
  return state.journal;
}

// Free time, posts, purchases and conversations done during the week (they don't advance time).
export function noteAside(state, a) {
  state.weekAsides = [...(state.weekAsides ?? []), { kind: a.kind, headline: a.headline, label: a.label ?? null, text: a.text ?? '', changes: a.changes ?? {} }].slice(-12);
}

export function recordWeek(state, res, story, media) {
  const p = state.player;
  const j = ensureJournal(state);
  const rec = {
    week: res.week, month: monthKeyOf(res.week), date: shortDate(res.week), headline: story.headline, age: res.age, club: res.clubBefore ?? p.club?.name ?? null,
    matches: [...res.matches, ...(res.intl ?? [])].map((m) => ({
      comp: m.competition, round: m.round ?? null, opp: m.opp, home: m.home, club: m.club, hs: m.hs, as: m.as, result: m.result, minutes: m.minutes, started: m.started,
      rating: m.rating, goals: m.goals, assists: m.assists, motm: m.motm, red: m.red, yellow: m.yellow, reason: m.reason, intl: !!m.international, pens: m.penalties ?? null,
      xg: m.detail?.stats?.my?.xg ?? null, xga: m.detail?.stats?.opp?.xg ?? null, pxg: m.detail?.personal?.find((x) => x.label === 'xG')?.value ?? null,
    })),
    decisions: (res.outcomes ?? []).map((o) => ({ prompt: o.prompt, label: o.label, cat: o.cat, auto: !!o.auto, text: o.text?.slice(0, 220) ?? '' })),
    asides: state.weekAsides ?? [],
    life: res.life ?? {},
    meters: p.life ? Object.fromEntries(METER_KEYS.map((k) => [k, meter(p, k)])) : {},
    money: res.money ? { gross: res.money.gross, net: res.money.net, upkeep: res.money.upkeep ?? 0, assetIncome: res.money.assetIncome ?? 0 } : null,
    wealth: Math.round(p.wealthEUR), worth: netWorth(state), followers: p.followers, rep: p.reputation, ovr: res.ovr, stats: res.statChanges ?? {},
    events: (res.events ?? []).map((e) => e.headline), milestones: res.milestones ?? [], trophies: res.trophies ?? [], awards: res.awards ?? [],
    injury: res.injury?.type ?? null, moved: res.moved ? `${res.moved.from} → ${res.moved.to}` : null, squad: (res.squadNews ?? []).map((n) => n.text),
    media: media ? { count: media.count, buzz: media.buzz, top: media.items.slice(0, 3).map((x) => x.title ?? x.text) } : null,
  };
  state.weekAsides = [];
  j.weeks.push(rec);
  if (j.weeks.length > KEEP_WEEKS) j.weeks.shift();
  // When the next week belongs to a new month, this month is complete: file its report.
  if (monthKeyOf(res.week + 1) !== rec.month) {
    const d = digest(state, rec.month);
    if (d) { j.months = j.months.filter((x) => x.key !== d.key); j.months.push(d); }
  }
  return rec;
}

// Sum up the weeks of one month (also works for the month in progress).
export function digest(state, key, weeksOverride = null) {
  const j = ensureJournal(state);
  const weeks = weeksOverride ?? j.weeks.filter((w) => w.month === key);
  if (!weeks.length) return j.months.find((m) => m.key === key) ?? null;
  const ms = weeks.flatMap((w) => w.matches);
  const played = ms.filter((m) => m.minutes > 0);
  const club = ms.filter((m) => !m.intl);
  const ratings = played.map((m) => m.rating).filter((x) => typeof x === 'number');
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) ?? 0), 0);
  const life = {};
  for (const w of weeks) for (const [k, v] of Object.entries(w.life ?? {})) life[k] = (life[k] ?? 0) + v;
  const first = weeks[0], last = weeks.at(-1);
  const prevWeek = j.weeks[j.weeks.indexOf(first) - 1];
  const stats = {};
  for (const w of weeks) for (const [k, v] of Object.entries(w.stats ?? {})) stats[k] = (stats[k] ?? 0) + v;
  const best = [...played].sort((a, b) => b.rating - a.rating)[0] ?? null;
  return {
    key, label: monthLabel(key), weeks: weeks.length, from: first.date, to: last.date, club: last.club,
    played: club.length, apps: played.filter((m) => !m.intl).length, intlApps: played.filter((m) => m.intl).length,
    w: club.filter((m) => m.result === 'W').length, d: club.filter((m) => m.result === 'D').length, l: club.filter((m) => m.result === 'L').length,
    gf: sum(club, (m) => (m.home ? m.hs : m.as)), ga: sum(club, (m) => (m.home ? m.as : m.hs)),
    minutes: sum(played, (m) => m.minutes), goals: sum(played, (m) => m.goals), assists: sum(played, (m) => m.assists), motms: played.filter((m) => m.motm).length,
    reds: played.filter((m) => m.red).length, yellows: played.filter((m) => m.yellow).length,
    avg: ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
    xg: round1(sum(club, (m) => m.xg ?? 0)), xga: round1(sum(club, (m) => m.xga ?? 0)), pxg: round1(sum(played, (m) => Number(m.pxg) || 0)),
    best: best ? { opp: best.opp, rating: best.rating, goals: best.goals, assists: best.assists } : null,
    results: club.map((m) => ({ opp: m.opp, home: m.home, score: `${m.hs}-${m.as}`, result: m.result, rating: m.rating, goals: m.goals, assists: m.assists, comp: m.comp })),
    decisions: weeks.flatMap((w) => w.decisions), asides: weeks.flatMap((w) => w.asides ?? []), events: weeks.flatMap((w) => w.events),
    life, meters: last.meters, money: sum(weeks, (w) => w.money?.net ?? 0), income: sum(weeks, (w) => w.money?.gross ?? 0),
    wealth: last.wealth, worth: last.worth, wealthChange: last.wealth - (prevWeek?.wealth ?? first.wealth),
    followers: last.followers, followersChange: last.followers - (prevWeek?.followers ?? first.followers), rep: last.rep, repChange: round1(last.rep - (prevWeek?.rep ?? first.rep)),
    ovr: last.ovr, ovrChange: (last.ovr ?? 0) - (prevWeek?.ovr ?? first.ovr ?? 0), stats,
    milestones: weeks.flatMap((w) => w.milestones), trophies: weeks.flatMap((w) => w.trophies), awards: weeks.flatMap((w) => w.awards ?? []),
    injuries: weeks.map((w) => w.injury).filter(Boolean), moves: weeks.map((w) => w.moved).filter(Boolean), squad: weeks.flatMap((w) => w.squad ?? []),
    mediaCount: sum(weeks, (w) => w.media?.count ?? 0), buzz: sum(weeks, (w) => w.media?.buzz ?? 0), headlines: weeks.map((w) => ({ date: w.date, headline: w.headline })),
  };
}

export function monthsAvailable(state) {
  const j = ensureJournal(state);
  const keys = new Set([...j.months.map((m) => m.key), ...j.weeks.map((w) => w.month)]);
  return [...keys].sort().reverse();
}

// The story of a month, from its report. Used by "Play month" and the Reports tab.
export function monthStory(state, d, J) {
  if (!d) return null;
  const head = d.trophies.length ? `${d.label}: ${J} Lifts the ${d.trophies[0].replace(/ \d{4}(-\d{2})?$/, '')}`
    : d.moves.length ? `${d.label}: A New Chapter at ${d.moves.at(-1).split(' → ')[1]}`
      : d.injuries.length ? `${d.label}: Injury Puts ${J} on the Sidelines`
        : d.goals >= 3 ? `${d.label}: ${d.goals} Goals in ${d.apps} Games for ${J}`
          : d.avg !== null && d.avg >= 7.5 ? `${d.label}: ${J} at His Best`
            : d.avg !== null && d.avg < 6.2 ? `${d.label}: A Month to Forget for ${J}`
              : d.apps === 0 && d.played ? `${d.label}: Waiting for a Chance`
                : `${d.label}: ${d.w}W ${d.d}D ${d.l}L`;
  const sections = [];
  const res = [];
  if (d.played) {
    res.push(`${d.club ?? 'His club'} played ${d.played} time${d.played > 1 ? 's' : ''} in ${d.label.split(' ')[0]}: ${d.w} won, ${d.d} drawn, ${d.l} lost (${d.gf} scored, ${d.ga} conceded; xG ${d.xg} against ${d.xga}).`);
    if (d.apps) res.push(`${J} played ${d.apps} of them (${d.minutes} minutes)${d.avg !== null ? `, averaging a ${d.avg} rating` : ''}: ${d.goals} goal${d.goals === 1 ? '' : 's'}, ${d.assists} assist${d.assists === 1 ? '' : 's'}${d.pxg ? `, ${d.pxg} xG` : ''}${d.motms ? `, ${d.motms} man-of-the-match award${d.motms > 1 ? 's' : ''}` : ''}${d.reds ? `, and ${d.reds} red card${d.reds > 1 ? 's' : ''}` : ''}.`);
    else res.push(`${J} did not get on the pitch.`);
    if (d.best && d.apps > 1) res.push(`Best game: against ${d.best.opp} (${d.best.rating}${d.best.goals ? `, ${d.best.goals} goal${d.best.goals > 1 ? 's' : ''}` : ''}).`);
  } else res.push(pick(['No league football this month. Training, recovery, and a lot of waiting.', 'A month without matches: the body rests, the mind doesn\'t.']));
  if (d.intlApps) res.push(`He also played ${d.intlApps} international match${d.intlApps > 1 ? 'es' : ''}.`);
  sections.push({ id: 'month-results', icon: 'ball', title: 'On the pitch', paras: res });
  const growth = Object.entries(d.stats).filter(([, v]) => v > 0);
  const dev = [];
  if (growth.length || d.ovrChange) dev.push(`Development: ${growth.map(([k, v]) => `${statLabel(k).toLowerCase()} +${v}`).join(', ') || 'no attribute gains'}${d.ovrChange ? ` (overall ${d.ovrChange > 0 ? '+' : ''}${d.ovrChange}, now ${d.ovr})` : ''}.`);
  if (d.injuries.length) dev.push(`Injuries: ${d.injuries.join(', ')}.`);
  if (dev.length) sections.push({ id: 'month-dev', icon: 'dumbbell', title: 'Training and body', paras: dev });
  const off = [];
  const made = d.decisions.filter((x) => !x.auto), auto = d.decisions.filter((x) => x.auto);
  if (made.length) off.push(`Decisions: ${made.slice(0, 6).map((x) => `"${x.prompt.replace(/\.$/, '')}" → ${x.label}`).join('; ')}${made.length > 6 ? `; and ${made.length - 6} more` : ''}.`);
  if (auto.length) off.push(`Left to instinct (played as a month): ${auto.slice(0, 6).map((x) => `${x.prompt.replace(/\.$/, '')} → ${x.label}`).join('; ')}${auto.length > 6 ? `; and ${auto.length - 6} more` : ''}.`);
  if (d.asides.length) off.push(`Away from the clock: ${d.asides.slice(0, 6).map((a) => a.headline).join(', ')}.`);
  if (d.events.length) off.push(`The month's stories: ${[...new Set(d.events)].slice(0, 5).join(' · ')}.`);
  if (off.length) sections.push({ id: 'month-life', icon: 'spark', title: 'Off the pitch', paras: off });
  const moved = Object.entries(d.life).filter(([, v]) => Math.abs(v) >= 3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (moved.length) sections.push({ id: 'month-people', icon: 'users', title: 'The people around him', paras: [moved.slice(0, 6).map(([k, v]) => `${METERS[k]?.label ?? k} ${v > 0 ? '+' : ''}${v}`).join(' · ') + '.'] });
  const money = [`Money: ${d.money >= 0 ? '+' : '−'}€${Math.abs(Math.round(d.money)).toLocaleString('en')} after tax, fees and bills (savings now €${Math.round(d.wealth).toLocaleString('en')}, net worth €${Math.round(d.worth).toLocaleString('en')}).`];
  money.push(`Followers ${d.followersChange >= 0 ? '+' : ''}${d.followersChange.toLocaleString('en')} · fame ${d.repChange >= 0 ? '+' : ''}${d.repChange}.`);
  if (d.mediaCount) money.push(`${d.mediaCount} media stories this month, ${d.buzz > 2 ? 'mostly positive' : d.buzz < -2 ? 'mostly negative' : 'a mixed bag'}.`);
  sections.push({ id: 'month-money', icon: 'wallet', title: 'Money and fame', paras: money });
  if (d.squad.length) sections.push({ id: 'month-squad', icon: 'users', title: 'Squad news', paras: [d.squad.slice(0, 8).join(' · ') + '.'] });
  if (d.milestones.length || d.trophies.length || d.awards.length) sections.push({ id: 'month-honours', icon: 'trophy', title: 'Milestones', paras: [[...d.trophies, ...d.awards, ...d.milestones].join(' · ') + '.'] });
  return { headline: head, dek: `${d.weeks} week${d.weeks > 1 ? 's' : ''}, ${d.from} – ${d.to}.`, sections, paragraphs: sections.flatMap((s) => s.paras), eventType: 'month', monthly: true };
}
