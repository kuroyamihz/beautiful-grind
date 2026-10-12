// The media world: every week, newspapers, blogs, X, Instagram, TikTok, YouTube, podcasts, magazines, TV
// pundits and fan forums talk about what happened. How much they talk depends on how famous he is: a 16-year-old
// nobody gets the club account and a fan blog; a star gets the whole internet. Templates live in
// data/text/media.json. Everyone with an opinion is fictional (outlets, pundits, gossip pages); real brands only
// ever appear as his own sponsors, saying neutral things.
import { pick, chance, randint, hash, compact, clamp, shuffle } from './util.js';
import { meter } from './life.js';
import { careerLevel } from './player.js';

// Voice → where it appears and who can see him. `rep` = fame needed before this voice notices him.
export const VOICES = {
  x_club: { platform: 'x', rep: 0 }, ig_club: { platform: 'instagram', rep: 0 }, x_fan: { platform: 'x', rep: 0 }, forum: { platform: 'forum', rep: 0 },
  x_stats: { platform: 'x', rep: 2 }, blog: { platform: 'blog', rep: 3 }, news: { platform: 'news', rep: 0 }, tiktok: { platform: 'tiktok', rep: 8 },
  x_itk: { platform: 'x', rep: 6 }, x_pundit: { platform: 'x', rep: 12 }, youtube: { platform: 'youtube', rep: 10 }, ig_partner: { platform: 'instagram', rep: 0 },
  ig_teammate: { platform: 'instagram', rep: 0 }, ig_gossip: { platform: 'instagram', rep: 18 }, podcast: { platform: 'podcast', rep: 20 }, tv: { platform: 'tv', rep: 18 },
  ig_brand: { platform: 'instagram', rep: 0 }, ig_influencer: { platform: 'instagram', rep: 30 }, magazine: { platform: 'magazine', rep: 38 },
};
export const PLATFORMS = {
  news: { label: 'News', icon: 'newspaper' }, x: { label: 'X', icon: 'message' }, instagram: { label: 'Instagram', icon: 'camera' }, tiktok: { label: 'TikTok', icon: 'video' },
  youtube: { label: 'YouTube', icon: 'play' }, blog: { label: 'Blogs', icon: 'book' }, podcast: { label: 'Podcasts', icon: 'mic' }, magazine: { label: 'Magazines', icon: 'star' },
  tv: { label: 'TV', icon: 'video' }, forum: { label: 'Forums', icon: 'users' },
};

let M = {};
let OUT = {};
let recent = [];

function line(topic, voice) {
  const list = M.topics?.[topic]?.[voice];
  if (!Array.isArray(list) || !list.length) return null;
  const fresh = list.filter((l) => !recent.includes(hash(l)));
  const l = pick(fresh.length ? fresh : list);
  recent.push(hash(l)); if (recent.length > 400) recent.shift();
  return l;
}

function fillT(str, t) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in t ? t[k] : m));
}

function sourceFor(voice, state, tok) {
  const p = state.player;
  const S = M.sources ?? {};
  const indo = (p.club?.country ?? p.nationality) === 'Indonesia';
  const clubHandle = '@' + (p.club?.name ?? 'club').replace(/[^A-Za-z0-9]/g, '');
  switch (voice) {
    case 'x_club': case 'ig_club': return { name: p.club?.name ?? 'Club', handle: clubHandle, verified: true };
    case 'x_fan': { const h = pick(indo ? S.fansId ?? ['@bobotoh_99'] : S.fansEn ?? ['@terrace_voice']); return { name: h.replace('@', '').replace(/[_\d]+/g, ' ').trim(), handle: h }; }
    case 'forum': return { name: `${p.club?.name ?? 'Football'} ${pick(S.forums ?? ['Fans Forum'])}`, handle: pick(S.forumUsers ?? ['user']) };
    case 'x_stats': { const s = pick(S.stats ?? [{ name: 'Grind Stats', handle: '@GrindStats' }]); return { ...s, verified: true }; }
    case 'x_itk': { const s = pick(S.itk ?? [{ name: 'Transfer Whispers', handle: '@TransferWhispers' }]); return { ...s, verified: p.reputation > 20 }; }
    case 'x_pundit': case 'tv': { const s = pick(S.pundits ?? [{ name: 'A pundit', handle: '@pundit', tag: 'Former pro' }]); return { ...s, verified: true, show: voice === 'tv' ? pick(S.tvShows ?? ['Matchday Live']) : null }; }
    case 'blog': { const s = pick(S.blogs ?? ['The Faithful']); return { name: fillT(s, tok) }; }
    case 'tiktok': { const h = pick(S.tiktok ?? ['@footy.edits']); return { name: h, handle: h }; }
    case 'youtube': { const s = pick(S.youtube ?? [{ name: 'Football Channel' }]); return { ...s, verified: true }; }
    case 'podcast': { const s = pick(S.podcasts ?? ['The Pod']); return { name: s }; }
    case 'magazine': { const s = pick(S.magazines ?? ['Kick Culture']); return { name: s }; }
    case 'ig_gossip': { const s = pick(indo ? S.gossipId ?? ['Lambe Bola'] : S.gossipEn ?? ['Pitchside Tea']); return { name: s, handle: '@' + s.toLowerCase().replace(/[^a-z0-9]/g, '') }; }
    case 'ig_influencer': { const s = pick(S.influencers ?? [{ name: 'Influencer', handle: '@influencer' }]); return { ...s, verified: true }; }
    case 'ig_partner': return { name: p.partner.name, handle: '@' + p.partner.name.split(' ')[0].toLowerCase() + '.' + (Math.abs(hash(p.partner.name) * 90 | 0) + 10), verified: p.followers > 200000 };
    case 'ig_teammate': { const n = tok.T; return { name: n, handle: '@' + n.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14) + (Math.abs(hash(n) * 99 | 0)), verified: p.reputation > 25 }; }
    case 'ig_brand': return { name: tok.BRAND, handle: '@' + tok.BRAND.toLowerCase().replace(/[^a-z0-9]/g, ''), verified: true };
    case 'news': default: {
      const country = p.club?.country ?? p.nationality;
      const local = M.sources?.outlets?.[country] ?? OUT[country] ?? OUT.default ?? ['The Touchline'];
      const pool = p.reputation >= 40 && chance(0.4) ? S.global ?? local : local;
      return { name: pick(pool) };
    }
  }
}

function engagement(voice, state, tone) {
  const p = state.player;
  const fame = 1 + p.reputation / 12;
  const f = Math.max(300, p.followers);
  const base = {
    x_club: f * 0.02 + 400, ig_club: f * 0.05 + 1200, x_fan: 20 + f * 0.0015, forum: 5, x_stats: 80 * fame, blog: 0, news: 0, tiktok: f * 0.08 + 2000, x_itk: f * 0.01 + 900,
    x_pundit: 400 * fame, youtube: 0, ig_partner: f * 0.03, ig_teammate: f * 0.02 + 500, ig_gossip: f * 0.04 + 3000, podcast: 0, tv: 0, ig_brand: f * 0.03 + 2000, ig_influencer: f * 0.05 + 8000, magazine: 0,
  }[voice] ?? 50;
  const likes = Math.round(base * (0.5 + Math.random()) * (tone === 'neg' ? 0.8 : 1));
  const views = voice === 'youtube' ? Math.round((2000 + f * 0.4) * fame * (0.5 + Math.random())) : voice === 'tiktok' ? Math.round(likes * randint(6, 14)) : voice === 'podcast' ? Math.round(800 * fame * (0.6 + Math.random())) : voice === 'tv' ? Math.round(30000 * fame) : 0;
  const replies = voice === 'forum' ? randint(4, 40) * Math.ceil(fame) : Math.round(likes * (0.02 + Math.random() * 0.05));
  return { likes, views, replies };
}

// ── Which stories the media cover this week ──
function topicsFor(state, res, extra) {
  const p = state.player;
  const T = [];
  const add = (topic, weight = 1, tok = {}) => T.push({ topic, weight, tok });
  const m = res.matches.find((x) => x.minutes > 0) ?? null;
  const any = res.matches[0] ?? null;
  const lvl = careerLevel(p, res.age ?? 20);
  if (any) {
    add('result', 1.2, { score: any.home ? `${any.club} ${any.hs}-${any.as} ${any.opp}` : `${any.opp} ${any.hs}-${any.as} ${any.club}`, opp: any.opp });
    if (m) {
      const tok = { opp: m.opp, rating: m.rating.toFixed(1), mins: m.minutes, goals: m.goals, xg: m.detail?.stats?.my?.xg ?? '?' };
      if (m.goals >= 3) add('hatTrick', 4, tok); else if (m.goals === 2) add('brace', 3, tok); else if (m.goals === 1) add(m.result === 'W' ? 'goalWin' : 'goal', 2.5, tok);
      if (m.assists) add('assist', 1.2, tok);
      if (m.motm) add('motm', 2, tok);
      if (m.red) add('redCard', 3, tok);
      if (m.ga === 0 && ['GK', 'CB', 'FB'].includes(p.position) && m.minutes >= 60) add('cleanSheet', 1.6, tok);
      if (m.rating >= 7.8 && !m.goals) add('matchGreat', 2, tok);
      else if (m.rating >= 7) add('matchGood', 1.2, tok);
      else if (m.rating < 5.6) add('matchAwful', 2.5, tok);
      else if (m.rating < 6.3) add('matchBad', 1.6, tok);
      if (lvl <= 2 && m.rating >= 7.3) add('prospectHype', 1.8, tok);
      if ((res.age ?? 20) >= 32 && m.rating < 6.3) add('veteranDecline', 1.5, tok);
    } else if (any.reason === 'unused') add('benched', 1.4, { opp: any.opp });
  }
  for (const r of res.intl ?? []) if (r.minutes > 0) add(r.goals ? 'nationalGoal' : 'nationalMatch', 2.2, { opp: r.opp, rating: r.rating?.toFixed(1) });
  if (res.milestones?.some((x) => x.startsWith('First professional appearance'))) add('debut', 4);
  if (res.milestones?.some((x) => x.startsWith('First professional goal'))) add('firstGoal', 4);
  if (res.milestones?.some((x) => x.startsWith('Senior international debut'))) add('nationalDebut', 4);
  if (res.ntUpdate?.status === 'called') add('nationalCall', 2);
  if (res.moved && res.moved.to !== 'free agency') add(res.moved.type === 'loan' ? 'loanMove' : 'transferDone', 5, { NEWCLUB: res.moved.to, fee: res.moved.fee ? `€${compact(res.moved.fee)}` : 'a free transfer' });
  else if (res.moved) add('freeAgent', 3);
  else if (res.offer) add('transferRumour', 3, { NEWCLUB: res.offer.club });
  if (res.injury) add('injured', 3, { INJ: res.injury.type.toLowerCase(), weeks: res.injury.weeksLeft });
  if (res.recovered) add('recovered', 1.5);
  if (res.trophies?.length) add('trophy', 5, { TROPHY: res.trophies[0] });
  if (res.seasonEnd) add('seasonEnd', 2, { pos: res.seasonEnd.pos, goals: res.seasonEnd.goals, apps: res.seasonEnd.apps });
  if (res.birthday) add('birthday', 1.5, { age: res.birthday });
  if (res.signedContract) add('contractRenewal', 3);
  if (res.sponsorSigned) add('sponsorDeal', 2.5, { BRAND: res.sponsorSigned });
  for (const n of res.squadNews ?? []) add(n.type === 'out' ? 'squadDeparture' : 'squadArrival', n.rel === 'ally' ? 2 : 0.8, { T: n.name });
  for (const e of extra ?? []) add(e.topic, e.weight ?? 2, e.tok ?? {});
  // The mood around him
  if (p.life) {
    if (meter(p, 'image') < 30) add('scandal', 2);
    if (meter(p, 'fans') > 82) add('fansLove', 1.2);
    if (meter(p, 'fans') < 25) add('fansAngry', 1.8);
    if (meter(p, 'press') < 25) add('pressWar', 1.4);
    if (meter(p, 'image') > 82 && p.reputation > 20) add('roleModel', 1);
    if (p.manager.trust < 25 && p.club) add('managerRift', 1.3);
  }
  if (p.partner.status !== 'none' && chance(0.25)) add(p.partner.near === false ? 'longDistance' : 'couple', 0.8);
  if (p.crush && p.partner.status !== 'none' && chance(0.12 + (p.crush.heat ?? 0) / 300) && p.reputation > 15) add('affairRumour', 1.5);
  if (!T.length || chance(0.5)) add('quiet', 0.6);
  if (chance(0.35)) add('culture', 0.5);
  return T;
}

// Build this week's media items. `extra` = topics from decisions/posts/purchases (e.g. { topic: 'assetCar', tok }).
export function buildMedia(state, world, res, extra = []) {
  M = world.media ?? {};
  const p = state.player;
  state.media = state.media ?? { items: [], recent: [] };
  recent = state.media.recent;
  OUT = world.life?.outlets ?? {};
  const lvl = careerLevel(p, res.age ?? 20);
  const target = clamp(3 + lvl * 2 + Math.round(p.reputation / 12) + (res.moved || res.trophies?.length ? 3 : 0), 4, 24);
  const topics = topicsFor(state, res, extra).filter((t) => M.topics?.[t.topic]);
  const tokBase = {
    J: p.jerseyName, name: p.name, first: p.name.split(' ')[0], club: p.club?.name ?? 'his old club', league: state.seasons?.[p.club?.key]?.name ?? 'the league', nation: p.nationality,
    num: p.number, pos: { GK: 'keeper', CB: 'centre-back', FB: 'full-back', DM: 'holding midfielder', CM: 'midfielder', AM: 'playmaker', W: 'winger', ST: 'striker' }[p.position], age: res.age ?? '',
    M: p.manager.name, Mf: p.manager.name.split(' ').slice(-1)[0], Pf: p.partner.name?.split(' ')[0] || 'his partner', P: p.partner.name || 'his partner',
    followers: compact(p.followers), apps: p.season.apps, seasonGoals: p.season.goals, T: p.keyTeammates.find((t) => t.relationship === 'ally')?.name ?? p.circle?.captain ?? 'a teammate',
    BRAND: (p.endorsements ?? []).find((e) => e.expiryWeek > state.week)?.brand ?? 'his sponsor', CAP: p.circle?.captain ?? 'the captain',
    hashtag: '#' + p.jerseyName.replace(/[^A-Za-z]/g, ''), clubtag: '#' + (p.club?.name ?? 'Football').replace(/[^A-Za-z]/g, ''),
  };
  const items = [];
  const usedVoices = new Map();
  // Weighted round-robin over topics until we reach the target.
  let guard = 0;
  while (items.length < target && guard++ < target * 6 && topics.length) {
    const t = pickWeighted(topics);
    const voices = shuffle(Object.keys(M.topics[t.topic])).filter((v) => VOICES[v] && p.reputation >= VOICES[v].rep
      && (v !== 'ig_partner' || (p.partner.status !== 'none' && p.partner.style === 'public'))
      && (v !== 'ig_brand' || (p.endorsements ?? []).some((e) => e.expiryWeek > state.week))
      && ((usedVoices.get(v) ?? 0) < (v.startsWith('x_fan') || v === 'news' ? 3 : 2)));
    if (!voices.length) { t.weight *= 0.3; if (t.weight < 0.05) topics.splice(topics.indexOf(t), 1); continue; }
    const v = voices[0];
    const l = line(t.topic, v);
    if (!l) continue;
    const tok = { ...tokBase, ...t.tok };
    const src = sourceFor(v, state, tok);
    const [a, b] = fillT(l, tok).split('||').map((x) => x.trim());
    const tone = NEG.has(t.topic) || /\[neg\]/.test(a) ? 'neg' : POS.has(t.topic) ? 'pos' : 'neutral';
    items.push({ id: `${state.week}-${items.length}`, week: res.week ?? state.week, voice: v, platform: VOICES[v].platform, topic: t.topic, source: src, title: b ? a.replace('[neg]', '').trim() : null, text: (b ?? a).replace('[neg]', '').trim(), tone, ...engagement(v, state, tone) });
    usedVoices.set(v, (usedVoices.get(v) ?? 0) + 1);
    t.weight *= 0.55;
  }
  state.media.items = [...items, ...state.media.items].slice(0, 160);
  state.media.recent = recent;
  const buzz = items.reduce((a, x) => a + (x.tone === 'pos' ? 1 : x.tone === 'neg' ? -1 : 0), 0);
  return { items, buzz, count: items.length };
}

function pickWeighted(list) {
  const total = list.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[list.length - 1];
}

const NEG = new Set(['matchBad', 'matchAwful', 'redCard', 'scandal', 'fansAngry', 'pressWar', 'managerRift', 'veteranDecline', 'affairRumour', 'affairExposed', 'breakup', 'socialFlop', 'assetBacklash', 'benched', 'injured', 'freeAgent']);
const POS = new Set(['goal', 'goalWin', 'brace', 'hatTrick', 'motm', 'matchGreat', 'matchGood', 'cleanSheet', 'debut', 'firstGoal', 'nationalDebut', 'nationalGoal', 'trophy', 'fansLove', 'roleModel', 'prospectHype', 'engaged', 'married', 'charity', 'viralPost', 'contractRenewal', 'sponsorDeal', 'birthday', 'recovered']);
