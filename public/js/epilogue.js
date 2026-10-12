// End of career: a "life legacy" next to the football legacy, and an epilogue that tells what became of
// everyone, decided by the meters, flags and people the career left behind. Text lives in data/text/epilogue.json.
import { pick, compact } from './util.js';
import { meter, lifeTokens, castAges } from './life.js';

const has = (state, f) => !!state.flags.story?.[f];

export function lifeLegacy(state) {
  const p = state.player;
  if (!p.life) return { score: 50, label: 'Unknown' };
  const love = p.partner.status === 'none' ? 45 : meter(p, 'love');
  let score = meter(p, 'family') * 0.25 + meter(p, 'friends') * 0.2 + love * 0.15 + meter(p, 'image') * 0.25 + meter(p, 'fans') * 0.15;
  const bonus = { foundation: 12, mentor_kid: 8, mentee_star: 10, captain: 6, promise_kept: 10, union_rep: 4, coaching_badges: 3, hometown_hero: 6, rival_friend: 4 };
  const malus = { promise_broken: -15, party_regular: -6, gambling: -8, loan_shark: -6, secret_exposed: -8, agent_lawsuit: -4, rival_enemy: -3 };
  for (const [f, v] of Object.entries({ ...bonus, ...malus })) if (has(state, f)) score += v;
  if (p.wealthEUR < 0) score -= 10;
  score = Math.round(Math.max(0, Math.min(120, score)));
  const label = score >= 85 ? 'Beloved' : score >= 70 ? 'Respected' : score >= 55 ? 'Well liked' : score >= 40 ? 'Complicated' : 'Lonely at the top';
  return { score, label };
}

export function epilogue(state, world) {
  const p = state.player;
  const E = world.epilogue ?? {};
  const t = { ...lifeTokens(state), J: p.jerseyName, club: p.club?.name ?? p.career.clubHistory.at(-1)?.club ?? 'his last club', FIRSTCLUB: p.career.clubHistory[0]?.club ?? 'his first club',
    RIVAL: p.cast?.rival ?? '', MENTEE: p.cast?.mentee ?? '', OLDBOSS: p.cast?.oldboss ?? 'his first manager', WEALTH: `€${compact(Math.abs(p.wealthEUR))}`, KIDS: (p.kids ?? []).map((k) => k.name).join(' and ') };
  const say = (key) => {
    const list = key.split('.').reduce((o, k) => o?.[k], E);
    return Array.isArray(list) && list.length ? pick(list).replace(/\{(\w+)\}/g, (m, k) => t[k] ?? m) : '';
  };
  if (!p.life) return [];
  const out = [];
  const ages = castAges(state);
  // What he does next
  const press = meter(p, 'press'), fans = meter(p, 'fans'), img = meter(p, 'image');
  const next = p.wealthEUR < 0 ? 'broke' : has(state, 'coaching_badges') || (has(state, 'captain') && p.manager.trust > 60) ? 'coach'
    : press >= 60 && p.reputation >= 40 ? 'pundit' : has(state, 'foundation') ? 'foundation' : has(state, 'friend_business') || p.wealthEUR > 1e6 ? 'business' : img < 30 ? 'shadow' : 'quiet';
  out.push({ icon: 'briefcase', title: 'After football', text: say(`next.${next}`) });
  // Family
  const fam = meter(p, 'family');
  out.push({ icon: 'home', title: 'Family', text: `${say(`family.${fam >= 65 ? 'high' : fam >= 35 ? 'mid' : 'low'}`)} ${has(state, 'dad_passed') ? say('family.lostDad') : ages.dadAge >= 70 ? say('family.oldParents') : ''}`.trim() });
  // Love and children
  const ls = p.partner.status;
  let love = ls === 'married' ? say(meter(p, 'love') >= 50 ? 'love.marriedHappy' : 'love.marriedStrained') : ls !== 'none' ? say('love.together') : say(has(state, 'father') ? 'love.singleParent' : 'love.single');
  if ((p.kids ?? []).length) love += ' ' + say('love.kids');
  out.push({ icon: 'heart', title: 'Love', text: love });
  // Friends
  out.push({ icon: 'friends', title: 'Friends', text: say(`friends.${meter(p, 'friends') >= 55 ? 'high' : 'low'}`) });
  // The people the story remembered
  if (p.cast?.rival) out.push({ icon: 'users', title: 'The rival', text: say(has(state, 'rival_friend') ? 'rival.friend' : has(state, 'rival_enemy') ? 'rival.enemy' : 'rival.neutral') });
  if (has(state, 'mentor_kid') || has(state, 'mentee_star') || p.cast?.mentee) out.push({ icon: 'star', title: 'The kid he helped', text: say(has(state, 'mentee_star') ? 'mentee.star' : 'mentee.normal') });
  // Promises and the fans
  if (has(state, 'promise_kept')) out.push({ icon: 'megaphone', title: 'The promise', text: say('promise.kept') });
  else if (has(state, 'promise_broken')) out.push({ icon: 'megaphone', title: 'The promise', text: say('promise.broken') });
  else out.push({ icon: 'megaphone', title: 'The fans', text: say(`fans.${fans >= 70 ? 'high' : fans >= 40 ? 'mid' : 'low'}`) });
  // Money and image
  out.push({ icon: 'coin', title: 'Money', text: say(`money.${p.wealthEUR < 0 ? 'debt' : p.wealthEUR > 2e6 ? 'rich' : p.wealthEUR > 100000 ? 'comfortable' : 'modest'}`) });
  out.push({ icon: 'newspaper', title: 'How he is remembered', text: say(`image.${img >= 70 ? 'high' : img >= 40 ? 'mid' : 'low'}`) });
  return out.filter((x) => x.text);
}
