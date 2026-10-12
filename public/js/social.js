// Social media: once a week the player can post something. What he posts, and when, decides how it lands:
// a goal celebration after a win flies, a car selfie after a defeat gets torn apart, a sponsored post keeps a brand
// happy but too many make him look like a billboard. Posting doesn't move the clock.
import { chance, clamp, pick, randint, weightedPick } from './util.js';
import { meter } from './life.js';
import { activeDeals } from './sponsors.js';
import { SOCIAL, RAMADAN, SOCIAL_BOOST } from './config.js';
import { monthOf, inRange } from './time.js';

export function ensureSocial(p) {
  p.social = p.social ?? { posts: 0, lastWeek: -99, fatigue: 0, verified: false, milestones: {}, recent: [], sponsoredMonth: 0, month: -1 };
  return p.social;
}

const lastPlayed = (state) => (state.last?.matches ?? []).find((m) => m.minutes > 0) ?? null;

// Post types that make sense this week.
export function postOptions(state, world) {
  const p = state.player;
  const s = ensureSocial(p);
  const m = lastPlayed(state);
  const ramadan = RAMADAN.some(([a, b]) => inRange(state.week, a, b));
  const out = [];
  const add = (id, icon, label, desc, extra = {}) => out.push({ id, icon, label, desc, ...extra });
  if (m && m.goals > 0) add('goal', 'ball', 'Goal celebration', `Your goal against ${m.opp}. The obvious one.`);
  else if (m) add('matchday', 'ball', 'Matchday photo', m.result === 'W' ? 'Three points. Smiles.' : m.result === 'L' ? 'After a defeat. Careful with the caption.' : 'A point. Something honest.');
  add('training', 'dumbbell', 'Training grind', 'Sweat, cones, a caption about hard work.');
  add('fans', 'megaphone', 'Thank the fans', 'A message to the people in the stands.');
  if (p.club && p.keyTeammates.length) add('teammate', 'users', 'Shout out a teammate', `Hype up ${pick(p.keyTeammates).name.split(' ')[0]}.`, { who: p.keyTeammates[0].name });
  add('family', 'home', 'Family photo', 'A picture with the people who made you.');
  if (p.partner.status !== 'none') add('partner', 'heart', `Photo with ${p.partner.name.split(' ')[0]}`, p.partner.style === 'private' ? 'She prefers to stay offline. Will she mind?' : 'She loves being in your posts.');
  if (p.wealthEUR > 5000) add('flex', 'coin', 'Lifestyle flex', 'Car, watch, holiday. Followers love it. Not everyone does.');
  add('charity', 'star', 'Charity visit', 'Show the good you do. Too often looks like PR.');
  add('trend', 'video', 'Join a dance trend', 'Big reach, especially young fans. Bad timing after a loss.');
  add('cryptic', 'message', 'Cryptic quote', 'Say something without saying it. Everyone will guess.');
  if (m && m.rating < 6.3) add('reply', 'alert', 'Reply to the critics', 'Defend yourself. High risk, high noise.');
  add('throwback', 'clock', 'Throwback photo', 'You at eight years old in a shirt three sizes too big.');
  if (ramadan || [11, 0].includes(monthOf(state.week))) add('greeting', 'moon', 'Season\'s greetings', 'A warm holiday message to everyone.');
  if (['called', 'regular'].includes(p.national.status)) add('nation', 'flag', 'National team pride', `Wearing the ${p.nationality} shirt.`);
  for (const e of activeDeals(state).filter((x) => x.duty?.posts && (x.done?.posts ?? 0) < x.duty.posts)) add('sponsor', 'briefcase', `Sponsored: ${e.brand}`, `Contract duty (${e.done?.posts ?? 0}/${e.duty.posts} this month).`, { brand: e.brand });
  return out.map((o) => ({ ...o, key: o.brand ? `sponsor:${o.brand}` : o.id }));
}

// How many followers someone of his fame can realistically have (football-mad countries go higher).
export function followerCeiling(p) {
  return Math.round(SOCIAL.ceilingBase * Math.exp(p.reputation / 9) * (SOCIAL_BOOST[p.nationality] ?? 1.5));
}

export const canPost = (state) => ensureSocial(state.player).lastWeek !== state.week && !state.ended;

// Do the post. Returns { post, fx } — the caller applies fx (with ripples) and shows the result.
export function makePost(state, world, key) {
  const p = state.player;
  const s = ensureSocial(p);
  if (!canPost(state)) return null;
  const opt = postOptions(state, world).find((o) => o.key === key);
  if (!opt) return null;
  const T = world.social ?? {};
  const m = lastPlayed(state);
  const img = p.life ? meter(p, 'image') : 55;
  const month = Math.floor(state.week / 4.33);
  if (s.month !== month) { s.month = month; s.sponsoredMonth = 0; }
  // Fatigue: posting every single week slowly wears out your audience.
  s.fatigue = clamp(state.week - s.lastWeek <= 1 ? s.fatigue + 0.08 : s.fatigue - 0.05 * (state.week - s.lastWeek - 1), 0, 0.6);
  let mult = SOCIAL.mult[opt.id] ?? 1;
  let pos = 0.65; // chance the reaction is mostly positive
  const fx = {};
  let viral = SOCIAL.viralBase;
  const lost = m?.result === 'L', won = m?.result === 'W';
  switch (opt.id) {
    case 'goal': mult *= 1 + m.goals * 0.4 + (won ? 0.3 : 0); pos = 0.9; viral += m.goals >= 2 ? 0.2 : 0.05; fx.fans = 2; break;
    case 'matchday': mult *= won ? 1.2 : lost ? 0.7 : 0.9; pos = won ? 0.85 : lost ? 0.45 : 0.65; fx.fans = won ? 1 : 0; break;
    case 'training': pos = lost ? 0.55 : 0.75; fx.trust = chance(0.3) ? 1 : 0; break;
    case 'fans': pos = 0.85; fx.fans = 3; break;
    case 'teammate': pos = 0.85; fx.dressing = 3; break;
    case 'family': pos = 0.9; fx.family = 4; fx.image = 1; break;
    case 'partner': pos = 0.8; fx.love = p.partner.style === 'private' ? -4 : 5; break;
    case 'flex': mult *= 1.3; pos = lost ? 0.2 : img < 45 ? 0.35 : 0.55; fx.image = lost ? -4 : -1; fx.fans = lost ? -4 : 0; fx.friends = 1; fx.family = -1; viral += 0.05; break;
    case 'charity': { const recent = s.recent.filter((r) => r.id === 'charity' && state.week - r.week < 10).length; pos = recent ? 0.3 : 0.85; fx.image = recent ? -2 : 3; fx.fans = recent ? 0 : 2; break; }
    case 'trend': mult *= p.followers < 1e6 ? 1.6 : 1.2; pos = lost ? 0.3 : 0.7; fx.trust = lost ? -3 : 0; fx.image = lost ? -2 : 0; viral += 0.08; break;
    case 'cryptic': mult *= 1.2; pos = 0.45; fx.press = 3; fx.trust = -3; fx.board = -2; fx.stress = 1; break;
    case 'reply': { mult *= 1.5; const respect = chance(0.45 + (p.reputation - 30) / 200); pos = respect ? 0.75 : 0.15; Object.assign(fx, respect ? { fans: 3, morale: 2 } : { image: -4, press: -4, trust: -2, stress: 3 }); viral += 0.1; break; }
    case 'throwback': pos = 0.9; fx.family = 1; break;
    case 'greeting': pos = 0.92; fx.fans = 2; fx.family = 2; fx.image = 1; break;
    case 'nation': pos = 0.9; fx.fans = 2; fx.image = 2; break;
    case 'sponsor': {
      s.sponsoredMonth++;
      mult *= s.sponsoredMonth > SOCIAL.adFatigueAfter ? 0.45 : 0.75;
      pos = s.sponsoredMonth > SOCIAL.adFatigueAfter ? 0.35 : 0.6;
      if (s.sponsoredMonth > SOCIAL.adFatigueAfter) fx.fans = -1;
      const deal = activeDeals(state).find((e) => e.brand === opt.brand);
      if (deal) { deal.done = { ...(deal.done ?? {}), posts: (deal.done?.posts ?? 0) + 1 }; deal.sat = clamp((deal.sat ?? 65) + 3, 0, 100); }
      break;
    }
    default: break;
  }
  const eng = SOCIAL.engagement * (1 - s.fatigue * 0.5) * (0.6 + img / 125);
  const isViral = chance(viral);
  const likes = Math.round((Math.max(p.followers, 300) * eng * mult * (0.6 + Math.random()) + randint(5, 60)) * (isViral ? randint(4, 12) : 1));
  // Audiences have a ceiling set by how famous you are; growth slows as you approach it.
  const room = Math.max(0.03, 1 - p.followers / followerCeiling(p));
  const gained = Math.round((likes * SOCIAL.conversion * (pos > 0.5 ? 1 : 0.4) + (isViral ? likes * 0.08 : 0)) * room);
  const positive = chance(pos);
  fx.followers = gained;
  if (!positive) { fx.stress = (fx.stress ?? 0) + 2; if (!fx.image) fx.image = -1; }
  // Comments: three voices from the crowd.
  const bank = T.comments?.[opt.id] ?? T.comments?.default ?? {};
  const list = bank[positive ? 'pos' : 'neg'] ?? ['🔥'];
  const fill = (t) => String(t).replace(/\{J\}/g, p.jerseyName).replace(/\{opp\}/g, m?.opp ?? 'them').replace(/\{club\}/g, p.club?.name ?? 'the club').replace(/\{BRAND\}/g, opt.brand ?? 'the brand').replace(/\{Pf\}/g, p.partner.name?.split(' ')[0] ?? '');
  const handles = T.handles ?? ['@footy_fan'];
  const comments = [...new Set(Array.from({ length: 3 }, () => pick(list)))].map((t) => ({ handle: pick(handles), text: fill(t) }));
  if (positive && chance(0.5) && (T.comments?.default?.pos ?? []).length) comments.push({ handle: pick(handles), text: fill(pick(T.comments.default.pos)) });
  const caption = fill(pick(T.captions?.[opt.id] ?? T.captions?.default ?? ['⚽']));
  s.lastWeek = state.week; s.posts++;
  s.recent = [...s.recent.slice(-15), { id: opt.id, week: state.week, likes, positive }];
  const post = { kind: opt.id, label: opt.label, icon: opt.icon, caption, likes, comments, gained, positive, viral: isViral, brand: opt.brand ?? null, platform: pick(['Instagram', 'TikTok', 'X']) };
  s.last = post;
  return { post, fx };
}

// Follower milestones: verified badge, fame, a story.
export function socialMilestones(state, res) {
  const p = state.player;
  const s = ensureSocial(p);
  for (const [n, label] of [[10000, '10K'], [100000, '100K'], [1000000, '1M'], [10000000, '10M'], [50000000, '50M']]) {
    if (p.followers >= n && !s.milestones[label]) {
      s.milestones[label] = state.week;
      res.milestones.push(`${label} followers`);
      res.triggers.push(n >= 1e6 ? 'followers1M' : 'followers100K');
      if (n === 100000) s.verified = true;
    }
  }
}
