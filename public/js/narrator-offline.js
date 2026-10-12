// Offline narrator: turns the engine's facts into a long, sectioned weekly story. No API needed.
// Every line comes from phrase banks in data/text/narration.json and data/text/story.json.
// Lines used recently are avoided, so the same sentence rarely shows up twice in a season.
import { pick, chance, randint, ordinal, compact, hash } from './util.js';
import { shortDate, MONTHS, weekDate } from './time.js';
import { statLabel } from './player.js';
import { lifeTokens, meter } from './life.js';

const ROLE_TEXT = { starter: 'a regular starter', rotation: 'in the rotation', bench: 'on the bench', outcast: 'out of the picture' };
const POS_GROUP = { GK: 'GK', CB: 'DEF', FB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', W: 'ATT', ST: 'ATT' };
const RECENT_MAX = 500;

let TXT = {};
let WORDS = {};
let STATE = null;
let BASE = {};

// Pick a line from a bank, avoiding lines used recently, and fill its {tokens}.
function say(path, vars = {}, fallback = '') {
  const list = path.split('.').reduce((o, k) => o?.[k], TXT);
  let line = fallback;
  if (Array.isArray(list) && list.length) {
    const recent = STATE?.narr?.recent ?? [];
    const fresh = list.filter((l) => !recent.includes(hash(l)));
    line = pick(fresh.length ? fresh : list);
    if (STATE) {
      STATE.narr = STATE.narr ?? { recent: [] };
      STATE.narr.recent.push(hash(line));
      if (STATE.narr.recent.length > RECENT_MAX) STATE.narr.recent.shift();
    }
  }
  const words = Object.fromEntries(Object.entries(WORDS).map(([k, l]) => [k, pick(l)]));
  const all = { ...words, ...BASE, ...vars };
  return String(line).replace(/\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m)).trim();
}
const has = (path) => Array.isArray(path.split('.').reduce((o, k) => o?.[k], TXT));
const band = (v, hi = 65, lo = 35) => (v === null ? null : v >= hi ? 'high' : v < lo ? 'low' : 'mid');

function ratingLine(J, m) {
  const r = m.rating;
  const b = r >= 9 ? 'great' : r >= 8 ? 'excellent' : r >= 7.1 ? 'good' : r >= 6.5 ? 'decent' : r >= 5.6 ? 'poor' : 'awful';
  return say(`rating.${b}`, { J }, `${J} plays.`);
}

function monologue(J, m) {
  const kind = !m || m.minutes === 0 ? 'none' : m.rating >= 8 ? 'great' : m.rating < 6 ? 'bad' : 'normal';
  return say(`monologue.${kind}`, { J }, `${J} goes home.`);
}

// ── Match report: build-up, flow, his game, the manager's verdict ──
function matchSection(state, m, title) {
  const p = state.player, J = p.jerseyName;
  const venue = m.home ? 'at home' : 'away from home';
  const score = m.home ? `${m.club} ${m.hs}-${m.as} ${m.opp}` : `${m.opp} ${m.hs}-${m.as} ${m.club}`;
  const comp = m.competition + (m.round && !m.international ? ` (${m.round})` : '');
  const v = { venue, score, comp, club: m.club, opp: m.opp, J };
  const paras = [];
  paras.push(say(`prematch.${m.home ? 'home' : 'away'}`, v, '') + ' ' + say(`intro.${m.result}`, v, `${score}.`));
  if (m.penalties) paras[0] += ` Penalties decide it, and ${m.penalties === 'won' ? 'they hold their nerve' : 'they lose the shoot-out'}.`;
  const margin = Math.abs(m.gf - m.ga);
  const flowKey = m.result === 'D' ? (m.gf === 0 ? 'D0' : 'Dgoals') : `${m.result}${margin >= 3 ? 'big' : 'close'}`;
  if (has(`flow.${flowKey}`)) paras.push(say(`flow.${flowKey}`, v));
  if (m.minutes === 0) {
    paras.push(m.reason === 'injured' ? say('sideline.injured', v, `${J} watches from the stands, his leg strapped.`)
      : m.reason === 'suspended' ? say('sideline.suspended', v, `${J} serves his suspension in a club tracksuit in the stands.`)
        : say('unused', v));
  } else {
    let p2 = m.started ? (m.minutes < 90 ? say('startSubbed', { J, min: m.minutes }) : say('start', { J })) : say('sub', { J, min: m.minutes });
    if (m.goals === 1) p2 += ' ' + say(`goal.${POS_GROUP[p.position] === 'GK' ? 'DEF' : POS_GROUP[p.position]}`, { min: ordinal(m.goalMinutes[0]) }, 'He scores.');
    else if (m.goals > 1) p2 += ` He scores ${m.goals === 2 ? 'twice' : m.goals === 3 ? 'a hat-trick' : `${m.goals} times`} (${m.goalMinutes.map((x) => x + "'").join(', ')}).`;
    if (m.assists === 1) p2 += ' ' + say('assist', {}, 'He also sets one up.');
    else if (m.assists > 1) p2 += ` He sets up ${m.assists} goals.`;
    if (m.red) p2 += ' ' + say('card.red', v, 'Then the red card: a lunge he regrets mid-air.');
    else if (m.yellow) p2 += ' ' + say('card.yellow', v, 'He picks up a yellow card along the way.');
    paras.push(p2);
    const good = m.rating >= 7.1;
    paras.push(say(`action.${POS_GROUP[p.position]}.${good ? 'good' : 'bad'}`, v) + ' ' + ratingLine(J, m) + (m.motm ? ' ' + say('motm', v, 'He is named man of the match.') : ''));
  }
  if (!m.international) {
    const q = m.minutes === 0 ? 'none' : m.rating >= 7.1 ? 'good' : m.rating < 6.2 ? 'bad' : 'mid';
    if (has(`mgrQuote.${m.result}.${q}`)) paras.push(say(`mgrQuote.${m.result}.${q}`, v));
    if (has(`after.${m.result}`)) paras.push(say(`after.${m.result}`, v));
  }
  return { id: 'match', icon: m.international ? 'flag' : 'ball', title, paras: paras.filter(Boolean) };
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
    if (m.goals >= 3) return say('headline.hattrick', { J, opp: m.opp, club: m.club }, `Hat-Trick Hero ${J} Destroys ${m.opp}`);
    if (m.goals && m.result === 'W') return say('headline.goalWin', { J, opp: m.opp, club: m.club, score: m.score }, `${J} Strikes as ${m.club} Beat ${m.opp}`);
    if (m.goals) return `${J} Scores but ${m.result === 'L' ? 'Defeat' : 'Draw'} Against ${m.opp}`;
    if (m.motm) return say('headline.motm', { J, opp: m.opp, club: m.club }, `Man of the Match ${J} Inspires ${m.club}`);
    if (m.rating < 5.6) return say('headline.nightmare', { J, opp: m.opp, club: m.club }, `Nightmare for ${J} Against ${m.opp}`);
  }
  if (res.event) return res.event.headline;
  if (res.recovered) return `${J} Back in Training After ${res.recovered.type}`;
  if (m) return `${m.club} ${m.result === 'W' ? 'Win' : m.result === 'L' ? 'Lose' : 'Draw'} ${m.score} Against ${m.opp}`;
  if (res.matches.length) return say('headline.sidelines', { J }, `Another Week on the Sidelines for ${J}`);
  return say('headline.quiet', { J }, `A Quiet Week of Work for ${J}`);
}

function eventType(res) {
  if (res.careerEnd) return 'milestone';
  if (res.moved || res.offer) return 'transfer';
  if (res.injury) return 'injury';
  if (res.recovered) return 'recovery';
  if (res.matches.length || res.intl.length) return res.intl.length && !res.matches.length ? 'international' : 'match';
  if (res.event) return res.event.type;
  return 'training';
}

// ── The social feed ──
function feed(state, res) {
  const p = state.player, J = p.jerseyName;
  const posts = [];
  const likes = (base) => Math.max(3, Math.round((base + p.followers * 0.02) * (0.5 + Math.random())));
  const indo = (p.club?.country ?? p.nationality) === 'Indonesia';
  const lang = indo ? 'id' : 'en';
  const clubHandle = '@' + (p.club?.name ?? 'club').replace(/[^A-Za-z0-9]/g, '');
  const m = res.matches[0];
  if (m) {
    const scorers = m.goals ? ` ⚽ ${J} ${m.goalMinutes.map((x) => x + "'").join(', ')}` : '';
    posts.push({ handle: clubHandle, displayName: p.club?.name ?? m.club, verified: true, platform: 'twitter', text: `FT | ${m.home ? `${m.club} ${m.hs}-${m.as} ${m.opp}` : `${m.opp} ${m.hs}-${m.as} ${m.club}`}${scorers}${m.motm ? ` 🌟 Man of the Match: ${J}` : ''}`, likes: likes(400) });
    if (m.minutes > 0) {
      posts.push({ handle: '@GrindStats', displayName: 'Grind Stats', verified: true, platform: 'twitter', text: `${J} vs ${m.opp}: ${m.minutes}' played, rating ${m.rating}${m.goals ? `, ${m.goals} goal${m.goals > 1 ? 's' : ''}` : ''}${m.assists ? `, ${m.assists} assist${m.assists > 1 ? 's' : ''}` : ''}. Season: ${p.season.apps} apps, ${p.season.goals} G, ${p.season.assists} A.`, likes: likes(60) });
      const good = m.rating >= 7.2, bad = m.rating < 6.2;
      if (good) posts.push({ handle: pick(indo ? ['@bobotoh_sejati99', '@jakmania_garis', '@ultras_nusantara'] : ['@terrace_voice', '@north_stand_ned', '@ultra_kev']), displayName: indo ? 'Ultras Garis Keras' : 'Season Ticket Holder', verified: false, platform: 'twitter', text: say(`fans.good.${lang}`, { J }, `${J} was brilliant.`), likes: likes(150) });
      if (bad) posts.push({ handle: pick(indo ? ['@kritikus_bola', '@netizen_bola'] : ['@honest_fan_88', '@moaning_martin']), displayName: indo ? 'Kritikus Bola' : 'Honest Fan', verified: false, platform: 'twitter', text: say(`fans.bad.${lang}`, { J }, `${J} was poor.`), likes: likes(120) });
    } else if (m.reason === 'unused' && p.season.apps < 3) {
      posts.push({ handle: indo ? '@suara_tribun' : '@youth_watch', displayName: indo ? 'Suara Tribun' : 'Academy Watch', verified: false, platform: 'twitter', text: say(`fans.bench.${lang}`, { J }, `Give ${J} a chance.`), likes: likes(40) });
    }
  }
  for (const r of res.intl) if (r.minutes > 0) posts.push({ handle: '@NationalTeamNews', displayName: `${p.nationality} Football`, verified: true, platform: 'twitter', text: `${r.international === 'Senior' ? '' : r.international + ' · '}${p.nationality} ${r.gf}-${r.ga} ${r.opp}. ${J}: ${r.minutes}' ${r.goals ? `⚽x${r.goals} ` : ''}rating ${r.rating}`, likes: likes(500) });
  if (res.moved && res.moved.to !== 'free agency') posts.push({ handle: '@TransferWhispers', displayName: 'Transfer Whispers', verified: true, platform: 'twitter', text: `🚨 ${J} to ${res.moved.to}${res.moved.type === 'loan' ? ' on loan' : ''} — done deal.${res.moved.fee ? ` Fee around €${compact(res.moved.fee)}.` : ''} Here we go confirmed by sources close to the player.`, likes: likes(3000) });
  else if (res.offer) posts.push({ handle: '@TransferWhispers', displayName: 'Transfer Whispers', verified: true, platform: 'twitter', text: `Understand ${res.offer.club} have made contact for ${J}. ${res.offer.type === 'loan' ? 'Loan proposal' : res.offer.fee ? `Proposal around €${compact(res.offer.fee)}` : 'Free transfer talks'}. More to follow. 🔄`, likes: likes(800) });
  if (res.injury) posts.push({ handle: clubHandle, displayName: p.club?.name ?? 'Club', verified: true, platform: 'twitter', text: `Medical update: ${J} has suffered a ${res.injury.type.toLowerCase()} and is expected to be out for around ${res.injury.weeksLeft} weeks. Get well soon, ${J}! 💪`, likes: likes(300) });
  if (res.trophies.length) posts.push({ handle: clubHandle, displayName: p.club?.name ?? 'Club', verified: true, platform: 'instagram', text: `🏆 CHAMPIONS! ${res.trophies[0]}. History made. ${J} 🎉`, likes: likes(8000) });
  if (res.viral) posts.push({ handle: '@FootyClipsDaily', displayName: 'Footy Clips', verified: true, platform: 'instagram', text: `This kid ${J}... 🤯 Watch till the end`, likes: likes(res.viral) });
  // Life web on the timeline: the partner, the gossip accounts, the fan mood
  if (p.partner.status !== 'none' && p.partner.style === 'public' && chance(0.35)) posts.push({ handle: '@' + p.partner.name.split(' ')[0].toLowerCase() + '.' + (Math.abs(hash(p.partner.name) * 90 | 0) + 10), displayName: p.partner.name, verified: p.followers > 200000, platform: 'instagram', text: say(`posts.partner.${band(meter(p, 'love'))}`, { J }, '🤍'), likes: likes(500) });
  if (p.life && meter(p, 'image') < 35 && chance(0.5)) posts.push({ handle: indo ? '@lambe_bola' : '@pitchside_tea', displayName: indo ? 'Lambe Bola' : 'Pitchside Tea ☕', verified: false, platform: 'instagram', text: say(`posts.gossip.${lang}`, { J }, `Something's going on with ${J}...`), likes: likes(900) });
  if (p.life && p.club && meter(p, 'fans') > 80 && chance(0.4)) posts.push({ handle: indo ? '@curva_utara' : '@the_end_ultras', displayName: indo ? 'Curva Utara' : 'The End Ultras', verified: false, platform: 'twitter', text: say(`posts.ultrasLove.${lang}`, { J }, `${J} is one of us.`), likes: likes(700) });
  if (p.life && p.club && meter(p, 'fans') < 25 && chance(0.5)) posts.push({ handle: indo ? '@suporter_kecewa' : '@fed_up_fan', displayName: indo ? 'Suporter Kecewa' : 'Fed Up Fan', verified: false, platform: 'twitter', text: say(`posts.fansAngry.${lang}`, { J }, `${J} out.`), likes: likes(600) });
  if (res.event && posts.length < 4 && res.event.type === 'media') posts.push({ handle: '@pundit_unfiltered', displayName: 'Pundit Unfiltered', verified: false, platform: 'twitter', text: say('posts.pundit', { J }, `Everyone is talking about ${J}.`), likes: likes(200) });
  if (!posts.length) posts.push({ handle: indo ? '@info_liga_id' : '@the_touchline_daily', displayName: indo ? 'Info Liga' : 'The Touchline Daily', verified: true, platform: 'twitter', text: say(`quietPosts.${lang}`, { J, club: p.club?.name ?? 'the club' }, `Quiet week for ${J}.`), likes: likes(80) });
  return posts.slice(0, 6);
}

// ── Press clippings: how the papers write about him this week ──
function clippings(state, res) {
  const p = state.player, J = p.jerseyName;
  const outlets = (STATE_WORLD?.life?.outlets?.[p.club?.country ?? p.nationality]) ?? STATE_WORLD?.life?.outlets?.default ?? ['The Touchline'];
  const tone = !p.life ? 'mid' : band(meter(p, 'press'), 62, 38);
  const m = res.matches.find((x) => x.minutes > 0);
  const topics = [];
  if (res.moved && res.moved.to !== 'free agency') topics.push('transfer');
  else if (res.offer) topics.push('rumour');
  if (m) topics.push(m.rating >= 7.3 ? 'matchGood' : m.rating < 6.2 ? 'matchBad' : 'matchMid');
  if (res.injury) topics.push('injury');
  if (p.partner.status !== 'none' && chance(0.3)) topics.push('love');
  if (p.life && meter(p, 'image') < 35) topics.push('scandal');
  if (p.life && meter(p, 'fans') > 80) topics.push('idol');
  if (p.squadRole === 'bench' || p.squadRole === 'outcast') topics.push('bench');
  if (!topics.length) topics.push('quiet');
  const out = [];
  for (const t of topics.slice(0, 3)) {
    if (!has(`clip.${t}.${tone}`)) continue;
    out.push({ outlet: pick(outlets), headline: say(`clip.${t}.${tone}`, { J, opp: m?.opp ?? 'the opposition', NEWCLUB: res.moved?.to ?? res.offer?.club ?? 'a new club' }), tone });
  }
  return out;
}

// ── The phone: short messages from the people in his life ──
function messages(state, res) {
  const p = state.player;
  if (!p.circle) return [];
  const m = res.matches.find((x) => x.minutes > 0);
  const ctx = res.injury ? 'injury' : res.moved ? 'moved' : m ? (m.goals > 0 || m.rating >= 7.6 ? 'great' : m.rating < 6.2 ? 'bad' : 'normal') : 'quiet';
  const t = lifeTokens(state);
  const senders = [
    { key: 'mum', name: t.MUM, icon: 'home', p: 0.6 },
    { key: 'dad', name: t.DAD, icon: 'home', p: 0.25 },
    { key: 'sib', name: t.SIB, icon: 'home', p: 0.3 },
    { key: 'bf', name: t.BFf, icon: 'friends', p: meter(p, 'friends') >= 35 ? 0.4 : 0.1 },
    { key: 'partner', name: t.Pf, icon: 'heart', p: p.partner.status !== 'none' ? 0.6 : 0 },
    { key: 'agent', name: p.agent?.name?.split(' ')[0] ?? '', icon: 'briefcase', p: p.agent ? 0.25 : 0 },
    { key: 'captain', name: t.CAPl, icon: 'users', p: p.club ? 0.2 : 0 },
  ];
  const out = [];
  for (const s of senders) {
    if (out.length >= 3 || !chance(s.p)) continue;
    let mood = ctx;
    if (s.key === 'partner') mood = band(meter(p, 'love')) === 'low' ? 'cold' : ctx;
    if (s.key === 'bf' && meter(p, 'friends') < 35) mood = 'distant';
    if ((s.key === 'mum' || s.key === 'dad') && meter(p, 'family') < 30) mood = 'cold';
    const path = has(`msg.${s.key}.${mood}`) ? `msg.${s.key}.${mood}` : `msg.${s.key}.normal`;
    if (!has(path)) continue;
    out.push({ from: s.name, icon: s.icon, text: say(path, {}) });
  }
  return out;
}

// ── Sections that read the life web ──
function lifeSections(state, res) {
  const p = state.player;
  const out = [];
  if (!p.life) return out;
  // Dressing room
  if (p.club && chance(res.matches.length ? 0.75 : 0.9)) {
    const ally = p.keyTeammates.find((t) => t.relationship === 'ally')?.name;
    const rival = p.keyTeammates.find((t) => ['rival', 'enemy'].includes(t.relationship))?.name;
    const paras = [say(`dressing.${band(meter(p, 'dressing'))}`, { T: ally ?? p.circle.captain, R: rival ?? 'one of the senior players' })];
    if (ally && chance(0.6)) paras.push(say('dressing.ally', { T: ally }));
    if (rival && chance(0.6)) paras.push(say('dressing.rival', { R: rival }));
    out.push({ id: 'dressing', icon: 'users', title: 'Dressing room', paras: paras.filter(Boolean) });
  }
  // Home life
  const home = [];
  home.push(say(`home.family.${band(meter(p, 'family'))}`));
  if (p.partner.status !== 'none') home.push(say(`home.love.${band(meter(p, 'love'))}`));
  else if (chance(0.5)) home.push(say('home.single'));
  home.push(say(`home.friends.${band(meter(p, 'friends'))}`));
  if (p.club && p.club.country !== p.nationality && chance(0.5)) home.push(say('home.abroad'));
  out.push({ id: 'home', icon: 'home', title: 'Away from the pitch', paras: home.filter(Boolean) });
  return out;
}

function mindSection(state, res) {
  const p = state.player, J = p.jerseyName;
  const m0 = res.matches[0] ?? res.intl[0];
  const paras = [];
  const stress = p.life ? meter(p, 'stress') : 30, morale = p.life ? meter(p, 'morale') : 60;
  const key = stress >= 75 ? 'stressHigh' : morale <= 30 ? 'moraleLow' : morale >= 75 ? 'moraleHigh' : 'neutral';
  paras.push(say(`mind.${key}`));
  if (m0 || res.event) paras.push(monologue(J, m0));
  return { id: 'mind', icon: 'moon', title: 'Late at night', paras: paras.filter(Boolean) };
}

let STATE_WORLD = null;

export function narrateOffline(state, world, res) {
  TXT = world.text ?? {};
  WORDS = world.life?.words ?? {};
  STATE = state;
  STATE_WORLD = world;
  const p = state.player, J = p.jerseyName;
  BASE = { J, M: p.manager.name, Mf: p.manager.name.split(' ').slice(-1)[0], club: p.club?.name ?? 'his old club', age: String(res.age ?? ''), month: MONTHS[weekDate(res.week).getUTCMonth()], ...(p.circle ? lifeTokens(state) : {}) };
  const sections = [];

  // 1. Opening: the week's mood, weather and situation
  const open = [];
  if (res.moved && res.moved.to !== 'free agency') open.push(res.moved.type === 'loan return' ? `The loan is over. ${J} is back at ${res.moved.to}, a little older and with something to prove.` : say('moved.arrive', { NEWCLUB: res.moved.to }, `${J} walks into ${res.moved.to}'s training ground for the first time. New badge, new manager: ${p.manager.name}. Nobody owes him anything.`));
  else if (res.moved) open.push(say('moved.free', {}, 'The contract runs out. No farewell ceremony, no banner — just a cleared locker and a phone that has to start ringing.'));
  else open.push(say(`opening.${res.matches.length ? 'match' : 'quiet'}`));
  open.push(say(`moodLine.${(p.mood ?? 'Focused').replace(/\s/g, '')}`, {}, ''));
  if (p.club && chance(0.6)) open.push(say(`role.${p.squadRole}`, {}, `${J} is ${ROLE_TEXT[p.squadRole]}.`));
  sections.push({ id: 'opening', icon: 'calendar', title: res.dateLabel ?? '', paras: open.filter(Boolean) });

  // 2. Training ground
  const plan = res.plan ?? { intensity: 'balanced' };
  const tr = [say(p.injury || res.injury ? 'training.injured' : `training.${plan.intensity}`)];
  const gains = Object.entries(res.statChanges).filter(([, v]) => v > 0);
  if (gains.length) tr.push(say('training.gain', { STATS: gains.map(([k, v]) => `${statLabel(k).toLowerCase()} +${v}`).join(', ') }, `Development: ${gains.map(([k, v]) => `${statLabel(k)} +${v}`).join(', ')}.`));
  if (res.growthCapped && !gains.length && plan.intensity === 'hard') tr.push(`The coaches say ${J} has hit a plateau for this season — more work will not show until next year.`);
  if (!p.injury && chance(0.5)) tr.push(say('coachNote'));
  if (res.injury) tr.push(`The scan confirms it: a ${res.injury.type.toLowerCase()}${res.injury.repeat ? ' — the same injury again, which the doctors say will take longer' : ''}. Around ${res.injury.weeksLeft} weeks out. ` + say('injuryLine', {}, `${J} sits in the physio room staring at the ceiling tiles.`));
  if (res.recovered) tr.push(say('recovered', { INJ: res.recovered.type.toLowerCase() }, `${J} is back in full training after the ${res.recovered.type.toLowerCase()}.`));
  if (res.roleChange) tr.push(say(`roleChange.${res.roleChange.to}`, {}, `Squad status: ${J} is now ${ROLE_TEXT[res.roleChange.to]}.`));
  sections.push({ id: 'training', icon: p.injury ? 'bandage' : 'dumbbell', title: p.injury ? 'Treatment room' : 'Training ground', paras: tr.filter(Boolean) });

  // 3. Matches
  for (const m of res.matches) sections.push(matchSection(state, m, m.competition));
  if (res.intl.length) {
    const nt = res.ntUpdate;
    const s = { id: 'intl', icon: 'flag', title: `International duty · ${nt?.team ?? p.nationality}`, paras: [] };
    if (res.milestones.some((x) => x.startsWith('Senior international debut'))) s.paras.push(say('ntDebut', {}, `When the anthem plays, ${J} sings every word and does not trust himself to look at the stands.`));
    for (const r of res.intl) s.paras.push(...matchSection(state, r, '').paras.slice(0, 3));
    sections.push(s);
  } else if (res.ntUpdate) sections.push({ id: 'intl', icon: 'flag', title: 'National team', paras: [`${res.ntUpdate.description}`, say(`ntNews.${res.ntUpdate.status}`, {}, '')].filter(Boolean) });

  // 4. This week's stories (the scenes behind the decisions)
  const evs = (res.events ?? (res.event ? [res.event] : []));
  if (evs.some((e) => !e.hasChoices)) sections.push({ id: 'story', icon: 'spark', title: evs.length > 1 ? 'Also this week' : 'Behind the scenes', paras: evs.filter((e) => !e.hasChoices).map((e) => e.text) });

  // 5-6. Dressing room, home life
  sections.push(...lifeSections(state, res));

  // 7. Season, milestones, money
  const extra = [];
  if (res.seasonEnd) {
    const s = res.seasonEnd;
    extra.push(`The ${s.label} ${s.league} season is over. ${p.club?.name ?? 'His club'} finish ${ordinal(s.pos)} of ${s.teams}${s.movement ? ` and are ${s.movement}` : ''}. ${s.champion} are champions. ${J}'s season: ${s.apps} appearances, ${s.goals} goals, ${s.assists} assists${s.avgRating ? `, average rating ${s.avgRating}` : ''}.${s.awards.length ? ` Awards: ${s.awards.join('; ')}.` : ''}`);
    extra.push(say('seasonReflect', {}, ''));
  }
  if (res.milestones.length) extra.push(`Milestone: ${res.milestones.join(' · ')}. ` + say('milestoneLine', {}, ''));
  if (res.money && res.money.net < 0) extra.push(`Money: this month's bills outrun the wage — the savings shrink by €${Math.abs(res.money.net).toLocaleString()}${res.money.interest ? `, including €${res.money.interest.toLocaleString()} of interest on the debt` : ''}.`);
  for (const n of res.notes ?? []) extra.push(n);
  if (extra.length) sections.push({ id: 'ledger', icon: 'trophy', title: res.seasonEnd ? 'Season review' : 'The ledger', paras: extra.filter(Boolean) });

  // 8. Late at night
  if (!res.careerEnd) sections.push(mindSection(state, res));
  else sections.push({ id: 'end', icon: 'trophy', title: 'The end', paras: [`And then it is over. ${p.career.apps} appearances, ${p.career.goals} goals, ${p.career.trophies.length} trophies. The boots go into a box in his mother's house, next to the first pair she ever bought him.`] });

  for (const s of sections) s.paras = s.paras.filter((x) => x && x.trim());
  const live = sections.filter((s) => s.paras.length);
  return {
    headline: headlineFor(state, res),
    dek: say(`dek.${eventType(res)}`, {}, ''),
    eventType: eventType(res),
    isMajorEvent: !!(res.moved || res.trophies.length || res.injury?.severity === 'severe' || res.careerEnd || res.milestones.length || res.seasonEnd),
    sections: live,
    paragraphs: live.flatMap((s) => s.paras),
    socialFeed: feed(state, res),
    clippings: clippings(state, res),
    messages: messages(state, res),
    moodLabel: p.mood,
    source: 'offline',
    dateLabel: res.dateLabel ?? shortDate(res.week),
  };
}
