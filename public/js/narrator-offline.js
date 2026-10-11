// Offline narrator: turns the engine's facts into sports journalism. No API needed.
import { pick, chance, randint, ordinal, compact } from './util.js';
import { shortDate } from './time.js';
import { statLabel } from './player.js';

const ROLE_TEXT = { starter: 'a regular starter', rotation: 'in the rotation', bench: 'on the bench', outcast: 'out of the picture' };

// Phrase banks live in data/text/narration.json (world.text). Lines below are fallbacks.
let TXT = {};
const POS_GROUP = { GK: "DEF", CB: "DEF", FB: "DEF", DM: "MID", CM: "MID", AM: "MID", W: "ATT", ST: "ATT" };
function say(path, vars, fallback = "") {
  const list = path.split(".").reduce((o, k) => o?.[k], TXT);
  const line = Array.isArray(list) && list.length ? pick(list) : fallback;
  return String(line).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function ratingLine(J, m) {
  const r = m.rating;
  const band = r >= 9 ? "great" : r >= 8 ? "excellent" : r >= 7.1 ? "good" : r >= 6.5 ? "decent" : r >= 5.6 ? "poor" : "awful";
  return say(`rating.${band}`, { J }, `${J} plays.`);
}

function monologue(J, m) {
  const kind = !m || m.minutes === 0 ? "none" : m.rating >= 8 ? "great" : m.rating < 6 ? "bad" : "normal";
  return say(`monologue.${kind}`, { J }, `${J} goes home.`);
}

function matchParagraphs(state, m) {
  const p = state.player, J = p.jerseyName;
  const venue = m.home ? "at home" : "away from home";
  const score = m.home ? `${m.club} ${m.hs}-${m.as} ${m.opp}` : `${m.opp} ${m.hs}-${m.as} ${m.club}`;
  const comp = m.competition + (m.round && !m.international ? ` (${m.round})` : "");
  let intro = say(`intro.${m.result}`, { venue, score, comp, club: m.club, opp: m.opp, J }, `${score}.`);
  if (m.penalties) intro += ` Penalties decide it, and ${m.penalties === "won" ? "they hold their nerve" : "they lose the shoot-out"}.`;
  if (m.minutes === 0) {
    const why = m.reason === "injured" ? `${J} watches from the stands, his leg strapped.` : m.reason === "suspended" ? `${J} serves his suspension in a club tracksuit in the stands.` : say("unused", { J });
    return [intro + " " + why];
  }
  let p2 = m.started ? (m.minutes < 90 ? say("startSubbed", { J, min: m.minutes }) : say("start", { J })) : say("sub", { J, min: m.minutes });
  if (m.goals === 1) p2 += " " + say(`goal.${POS_GROUP[p.position]}`, { min: ordinal(m.goalMinutes[0]) }, "He scores.");
  else if (m.goals > 1) p2 += ` He scores ${m.goals === 2 ? "twice" : m.goals === 3 ? "a hat-trick" : `${m.goals} times`} (${m.goalMinutes.map((x) => x + "'").join(", ")}).`;
  if (m.assists === 1) p2 += " " + say("assist", {}, "He also sets one up.");
  else if (m.assists > 1) p2 += ` He sets up ${m.assists} goals.`;
  if (m.red) p2 += " Then the red card: a lunge he regrets mid-air.";
  else if (m.yellow) p2 += " He picks up a yellow card along the way.";
  p2 += " " + ratingLine(J, m);
  if (m.motm) p2 += " He is named man of the match.";
  return [intro, p2];
}

function headlineFor(state, res) {
  const p = state.player, J = p.jerseyName;
  if (res.careerEnd) return res.careerEnd === 'retirement' ? `${J} Hangs Up His Boots` : res.careerEnd === 'injury' ? `Injury Ends ${J}'s Career` : `The Final Whistle on ${J}'s Career`;
  if (res.moved && res.moved.to !== 'free agency') return res.moved.type === 'loan return' ? `${J} Returns to ${res.moved.to}` : `Done Deal: ${J} Joins ${res.moved.to}${res.moved.type === 'loan' ? ' on Loan' : ''}`;
  if (res.moved) return `${J} Leaves ${res.moved.from} as a Free Agent`;
  if (res.trophies.length) return `${J} Lifts the ${res.trophies[0].replace(/ \d{4}(-\d{2})?$/, '')}`;
  if (res.seasonEnd) return `Season Over: ${res.seasonEnd.movement === 'relegated' ? 'Relegation Heartbreak' : res.seasonEnd.movement === 'promoted' ? 'Promotion Party' : `${ordinal(res.seasonEnd.pos ?? 0)} Place Finish`} for ${state.player.club?.name ?? J}`;
  if (res.injury) return `${J} Suffers ${res.injury.type.replace(/\b[a-z]/g, (c) => c.toUpperCase())}`;
  if (res.milestones.some((x) => x.startsWith('Senior international debut'))) return `${J} Makes Senior Debut for ${p.nationality}`;
  const m = res.matches.find((x) => x.minutes > 0) ?? res.intl.find((x) => x.minutes > 0);
  if (m) {
    if (m.goals >= 3) return `Hat-Trick Hero ${J} Destroys ${m.opp}`;
    if (m.goals && m.result === 'W') return pick([`${J} Strikes as ${m.club} Beat ${m.opp}`, `${J} on Target in ${m.score} Win`]);
    if (m.goals) return `${J} Scores but ${m.result === 'L' ? 'Defeat' : 'Draw'} Against ${m.opp}`;
    if (m.motm) return `Man of the Match ${J} Inspires ${m.club}`;
    if (m.rating < 5.6) return `Nightmare for ${J} Against ${m.opp}`;
  }
  if (res.event) return res.event.headline;
  if (res.recovered) return `${J} Back in Training After ${res.recovered.type}`;
  if (m) return `${m.club} ${m.result === 'W' ? 'Win' : m.result === 'L' ? 'Lose' : 'Draw'} ${m.score} Against ${m.opp}`;
  if (res.matches.length) return `Another Week on the Sidelines for ${J}`;
  return pick([`A Quiet Week of Work for ${J}`, `${J} Grinds On Behind the Scenes`, `Training Ground Week for ${J}`]);
}

function eventType(res) {
  if (res.careerEnd) return 'milestone';
  if (res.moved || res.offer) return 'transfer';
  if (res.injury) return 'injury';
  if (res.recovered) return 'recovery';
  if (res.matches.length || res.intl.length) return res.intl.length && !res.matches.length ? 'international' : 'match';
  if (res.event) return res.event.type === 'press' ? 'press' : res.event.type;
  return 'training';
}

function feed(state, res) {
  const p = state.player, J = p.jerseyName;
  const posts = [];
  const likes = (base) => Math.max(3, Math.round((base + p.followers * 0.02) * (0.5 + Math.random())));
  const indo = p.club?.country === 'Indonesia';
  const clubHandle = '@' + (p.club?.name ?? 'club').replace(/[^A-Za-z0-9]/g, '');
  const m = res.matches[0];
  if (m) {
    const scorers = m.goals ? ` ⚽ ${J} ${m.goalMinutes.map((x) => x + "'").join(', ')}` : '';
    posts.push({ handle: clubHandle, displayName: p.club?.name ?? m.club, verified: true, platform: 'twitter', text: `FT | ${m.home ? `${m.club} ${m.hs}-${m.as} ${m.opp}` : `${m.opp} ${m.hs}-${m.as} ${m.club}`}${scorers}${m.motm ? ` 🌟 Man of the Match: ${J}` : ''}`, likes: likes(400) });
    if (m.minutes > 0) {
      posts.push({ handle: '@GrindStats', displayName: 'Grind Stats', verified: true, platform: 'twitter', text: `${J} vs ${m.opp}: ${m.minutes}' played, rating ${m.rating}${m.goals ? `, ${m.goals} goal${m.goals > 1 ? 's' : ''}` : ''}${m.assists ? `, ${m.assists} assist${m.assists > 1 ? 's' : ''}` : ''}. Season: ${p.season.apps} apps, ${p.season.goals} G, ${p.season.assists} A.`, likes: likes(60) });
      const good = m.rating >= 7.2, bad = m.rating < 6.2;
      if (good) posts.push({ handle: indo ? '@bobotoh_sejati99' : '@terrace_voice', displayName: indo ? 'Ultras Garis Keras' : 'Season Ticket Holder', verified: false, platform: 'twitter', text: say(`fans.good.${indo ? 'id' : 'en'}`, { J }, `${J} was brilliant.`), likes: likes(150) });
      if (bad) posts.push({ handle: indo ? '@kritikus_bola' : '@honest_fan_88', displayName: indo ? 'Kritikus Bola' : 'Honest Fan', verified: false, platform: 'twitter', text: say(`fans.bad.${indo ? 'id' : 'en'}`, { J }, `${J} was poor.`), likes: likes(120) });
    } else if (m.reason === 'unused' && p.season.apps < 3) {
      posts.push({ handle: indo ? '@suara_tribun' : '@youth_watch', displayName: indo ? 'Suara Tribun' : 'Academy Watch', verified: false, platform: 'twitter', text: say(`fans.bench.${indo ? 'id' : 'en'}`, { J }, `Give ${J} a chance.`), likes: likes(40) });
    }
  }
  for (const r of res.intl) if (r.minutes > 0) posts.push({ handle: '@NationalTeamNews', displayName: `${p.nationality} Football`, verified: true, platform: 'twitter', text: `${r.international === 'Senior' ? '' : r.international + ' · '}${p.nationality} ${r.gf}-${r.ga} ${r.opp}. ${J}: ${r.minutes}' ${r.goals ? `⚽x${r.goals} ` : ''}rating ${r.rating}`, likes: likes(500) });
  if (res.moved && res.moved.to !== 'free agency') posts.push({ handle: '@TransferWhispers', displayName: 'Transfer Whispers', verified: true, platform: 'twitter', text: `🚨 ${J} to ${res.moved.to}${res.moved.type === 'loan' ? ' on loan' : ''} — done deal.${res.moved.fee ? ` Fee around €${compact(res.moved.fee)}.` : ''} Here we go confirmed by sources close to the player.`, likes: likes(3000) });
  else if (res.offer) posts.push({ handle: '@TransferWhispers', displayName: 'Transfer Whispers', verified: true, platform: 'twitter', text: `Understand ${res.offer.club} have made contact for ${J}. ${res.offer.type === 'loan' ? 'Loan proposal' : res.offer.fee ? `Proposal around €${compact(res.offer.fee)}` : 'Free transfer talks'}. More to follow. 🔄`, likes: likes(800) });
  if (res.injury) posts.push({ handle: clubHandle, displayName: p.club?.name ?? 'Club', verified: true, platform: 'twitter', text: `Medical update: ${J} has suffered a ${res.injury.type.toLowerCase()} and is expected to be out for around ${res.injury.weeksLeft} weeks. Get well soon, ${J}! 💪`, likes: likes(300) });
  if (res.trophies.length) posts.push({ handle: clubHandle, displayName: p.club?.name ?? 'Club', verified: true, platform: 'instagram', text: `🏆 CHAMPIONS! ${res.trophies[0]}. History made. ${J} 🎉`, likes: likes(8000) });
  if (res.viral) posts.push({ handle: '@FootyClipsDaily', displayName: 'Footy Clips', verified: true, platform: 'instagram', text: `This kid ${J}... 🤯 Watch till the end`, likes: likes(res.viral) });
  if (res.event && posts.length < 3) {
    const t = res.event.type;
    if (t === 'drama') posts.push({ handle: '@pundit_unfiltered', displayName: 'Pundit Unfiltered', verified: false, platform: 'twitter', text: pick([`Hearing things about ${J} behind the scenes. Not all good. Watch this space.`, `The ${J} situation is being handled badly by everyone involved.`]), likes: likes(200) });
    if (t === 'personal' && p.partner.status !== 'none' && chance(0.5)) posts.push({ handle: '@' + p.partner.name.split(' ')[0].toLowerCase() + '.' + randint(10, 99), displayName: p.partner.name, verified: false, platform: 'instagram', text: pick(['🤍', 'proud of you. always.', 'quiet weekends are the best weekends']), likes: likes(500) });
  }
  if (!posts.length) posts.push({ handle: indo ? '@info_liga_id' : '@the_touchline_daily', displayName: indo ? 'Info Liga' : 'The Touchline Daily', verified: true, platform: 'twitter', text: say(`quietPosts.${indo ? 'id' : 'en'}`, { J, club: p.club?.name ?? 'the club' }, `Quiet week for ${J}.`), likes: likes(80) });
  return posts.slice(0, 5);
}

export function narrateOffline(state, world, res) {
  TXT = world.text ?? {};
  const p = state.player, J = p.jerseyName;
  const paras = [];
  if (res.moved && res.moved.to !== 'free agency') paras.push(res.moved.type === 'loan return' ? `The loan is over. ${J} is back at ${res.moved.to}, a little older and with something to prove.` : `${J} walks into ${res.moved.to}'s training ground for the first time. New badge, new language in the dressing room, new manager: ${p.manager.name}. Everyone is polite. Nobody owes him anything.`);
  if (res.moved && res.moved.to === 'free agency') paras.push(`The contract runs out. No farewell ceremony, no banner — just a cleared locker and a phone that has to start ringing.`);
  for (const m of res.matches) paras.push(...matchParagraphs(state, m));
  if (res.intl.length) {
    const nt = res.ntUpdate;
    paras.push(`International duty with ${nt?.team ?? p.nationality}. ${res.milestones.some((x) => x.startsWith('Senior international debut')) ? `When the anthem plays, ${J} sings every word and does not trust himself to look at the stands.` : ''}`);
    for (const r of res.intl) paras.push(...matchParagraphs(state, r).slice(0, 2));
  } else if (res.ntUpdate) paras.push(`National team news: ${res.ntUpdate.description}`);
  if (res.injury) paras.push(`The scan confirms it: a ${res.injury.type.toLowerCase()}${res.injury.repeat ? ' — the same injury again, which the doctors say will take longer' : ''}. Around ${res.injury.weeksLeft} weeks out. ${pick([`${J} sits in the physio room staring at the ceiling tiles, counting fixtures he will miss.`, `The walk from the treatment room to the car takes a long time on crutches.`])}`);
  if (res.recovered) paras.push(`${J} is back in full training after the ${res.recovered.type.toLowerCase()}. The first sprint is tentative; the second is not.`);
  if (res.event) paras.push(res.event.text);
  if (res.roleChange) paras.push(`Squad status: ${J} is now ${ROLE_TEXT[res.roleChange.to]}${res.roleChange.to > res.roleChange.from ? '' : ''}.`);
  const gains = Object.entries(res.statChanges).filter(([, v]) => v > 0);
  if (gains.length) paras.push(`Development: ${gains.map(([k, v]) => `${statLabel(k)} +${v}`).join(', ')}.`);
  if (res.growthCapped && !gains.length && res.plan.intensity === 'hard') paras.push(`The coaches say ${J} has hit a plateau for this season — more work will not show until next year.`);
  if (res.seasonEnd) {
    const s = res.seasonEnd;
    paras.push(`The ${s.label} ${s.league} season is over. ${p.club?.name ?? 'His club'} finish ${ordinal(s.pos)} of ${s.teams}${s.movement ? ` and are ${s.movement}` : ''}. ${s.champion} are champions. ${J}'s season: ${s.apps} appearances, ${s.goals} goals, ${s.assists} assists${s.avgRating ? `, average rating ${s.avgRating}` : ''}.${s.awards.length ? ` Awards: ${s.awards.join('; ')}.` : ''}`);
  }
  if (res.milestones.length) paras.push(`Milestone: ${res.milestones.join(' · ')}.`);
  const m0 = res.matches[0] ?? res.intl[0];
  if (m0 || res.event) paras.push(monologue(J, m0));
  if (!paras.length) paras.push(say('quiet', { J, M: p.manager.name }, `A quiet week of training for ${J}.`));
  if (res.money && res.money.net < 0) paras.push(`Money: this month's bills outrun the wage — the savings shrink by €${Math.abs(res.money.net).toLocaleString()}.`);
  if (res.careerEnd) paras.push(`And then it is over. ${p.career.apps} appearances, ${p.career.goals} goals, ${p.career.trophies.length} trophies. The boots go into a box in his mother's house, next to the first pair she ever bought him.`);
  return {
    headline: headlineFor(state, res),
    eventType: eventType(res),
    isMajorEvent: !!(res.moved || res.trophies.length || res.injury?.severity === 'severe' || res.careerEnd || res.milestones.length || res.seasonEnd),
    paragraphs: paras,
    socialFeed: feed(state, res),
    moodLabel: p.mood,
    source: 'offline',
    dateLabel: res.dateLabel ?? shortDate(res.week),
  };
}
