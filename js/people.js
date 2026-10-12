// People: the player doesn't just react, he acts. Every person in his life (partner, a new love interest,
// an ex, parents, sibling, best friend, each teammate, the captain, the manager, the president, the journalist,
// the agent, his child) has actions he can start himself: plan a date, propose, confess, send money home,
// mentor a kid, confront a rival, leak to the press... Each one uses a free-time slot and has real effects.
// The actions live in data/text/interactions.json (same choice format as scenarios).
import { pick } from './util.js';
import { meter, meterWord, lifeTokens, castAges } from './life.js';
import { memberByName, ageOf, TRAITS } from './squad.js';
import { POSITIONS } from './config.js';

// Everyone he can act towards right now, with how close they are (0-100).
export function peopleList(state) {
  const p = state.player, c = p.circle ?? {}, t = p.circle ? lifeTokens(state) : {};
  const ages = p.circle ? castAges(state) : {};
  const out = [];
  const add = (key, name, role, value, icon, extra = {}) => out.push({ key, name, role, value, word: value === null ? '' : meterWord('family', value), icon, ...extra });
  if (p.partner.status !== 'none') add('partner', p.partner.name, `Partner · ${p.partner.status}${p.partner.near === false ? ' · long distance' : ''}${p.partner.job ? ` · ${p.partner.job}` : ''}`, meter(p, 'love'), 'heart');
  if (p.crush) add('crush', p.crush.name, p.partner.status !== 'none' ? 'Someone who is not your partner' : 'Someone you like', Math.round(p.crush.heat ?? 30), 'spark');
  if (p.cast?.exflame && p.cast.exflame !== p.partner.name) add('ex', p.cast.exflame, 'Your ex', p.exBond ?? 35, 'heart');
  if (p.circle) {
    add('parents', `${t.MUM} & ${t.DAD}`, `Parents · ${ages.mumAge ?? '?'} and ${ages.dadAge ?? '?'}${state.flags.story?.dad_passed ? ' (Dad has passed)' : ''}`, meter(p, 'family'), 'home');
    add('sibling', t.SIB, `${t.SIBr[0].toUpperCase()}${t.SIBr.slice(1)} · ${t.SIBage}`, p.sibBond ?? meter(p, 'family'), 'home');
    add('bestfriend', c.bestFriend?.name, `Best friend · ${c.bestFriend?.job}`, meter(p, 'friends'), 'friends');
  }
  for (const k of p.kids ?? []) add('kid', k.name, `Your child · ${Math.max(0, Math.floor((state.week - k.born) / 52))}`, meter(p, 'family'), 'home');
  if (p.club) {
    add('manager', p.manager.name, 'Manager', p.manager.trust, 'whistle');
    if (c.president) add('president', c.president, 'Club president', meter(p, 'board'), 'building');
    if (c.journalist) add('journalist', c.journalist.name, `Journalist · ${c.journalist.outlet}`, meter(p, 'press'), 'newspaper');
  }
  if (p.agent) add('agent', p.agent.name, `Agent · ${p.agent.cut}% · quality ${p.agent.quality}`, p.agentBond ?? 55, 'briefcase');
  return out;
}

// The squad as people: one row each, with traits and how he gets on with them.
export function teammateRows(state) {
  const sq = state.squad;
  if (!sq) return [];
  return [...sq.members].sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr).map((m) => ({
    id: m.id, name: m.name, pos: m.pos, num: m.num, age: ageOf(m, state.week), nat: m.nat, ovr: m.ovr, bond: m.bond, rel: m.rel,
    captain: m.id === sq.captainId, inj: m.inj, apps: m.apps, goals: m.goals, traits: m.traits.map((x) => TRAITS[x] ?? x), competitor: !!m.competitor && m.pos === state.player.position,
  }));
}
const POS_ORDER = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];

const cdKey = (a, target) => `${a.id}:${target ?? ''}`;

// Actions for one person (`who` = partner, crush, teammate…; `memberId` picks the teammate).
export function actionsFor(state, world, ctx, conditionsMet, fill, who, memberId = null) {
  const p = state.player;
  const acts = (world.interactions?.actions ?? []).filter((a) => a.who === who || (who === 'captain' && a.who === 'teammate'));
  const member = memberId ? state.squad?.members.find((m) => m.id === memberId) : null;
  const used = state.flags.actWeek ?? {};
  const inst = instFor(state, world, who, member);
  const extra = { ...ctx, bond: member?.bond ?? null, isCaptain: member ? member.id === state.squad?.captainId : false, trait: member?.traits ?? [] };
  const myAge = ctx.age ?? 20;
  return acts.filter((a) => conditionsMet(a.when, extra) && (!a.trait || (member && member.traits.includes(a.trait))) && (!a.bond || (member && member.bond >= a.bond[0] && member.bond <= a.bond[1]))
    && (!a.rel || (member && a.rel.includes(member.rel))) && (!a.ageRel || (member && (a.ageRel === 'older' ? ageOf(member, state.week) >= myAge + 4 : ageOf(member, state.week) <= myAge - 2)))
    && (!a.competitor || (member && member.pos === p.position)))
    .map((a) => {
      const last = used[cdKey(a, memberId ?? who)];
      const cooling = last !== undefined && state.week - last < (a.cd ?? 3);
      return { id: a.id, icon: a.icon ?? 'spark', label: fill(a.label, inst, state), desc: fill(a.desc ?? '', inst, state), risk: a.risk ?? 'low', hint: fill(a.hint ?? '', inst, state), cooling, weeksLeft: cooling ? (a.cd ?? 3) - (state.week - last) : 0, cost: a.cost ?? 1, big: !!a.big };
    });
}

function instFor(state, world, who, member) {
  const p = state.player;
  const words = Object.fromEntries(Object.entries(world.life?.words ?? {}).map(([k, l]) => [k, pick(l)]));
  return {
    sid: 'people', names: { T: member?.name ?? p.circle?.captain ?? 'a teammate', T2: null, F: (who === 'ex' ? p.cast?.exflame : p.crush?.name) ?? p.cast?.exflame ?? 'her', A: p.agent?.name ?? 'the agent', K: p.kids?.[0]?.name ?? 'the kid' }, vars: {}, words,
  };
}

// Do it. Returns { action, text, fx, label } — the engine applies fx (with ripples) and shows the result.
export function resolveAction(state, world, actionId, memberId, resolveChoiceFn) {
  const a = (world.interactions?.actions ?? []).find((x) => x.id === actionId);
  if (!a) return null;
  const member = memberId ? state.squad?.members.find((m) => m.id === memberId) : null;
  const inst = instFor(state, world, a.who, member);
  // Interactions use the scenario choice format: one "choice" with text/fx, out[], or check/ok/bad.
  const fake = { id: a.id, choices: [a] };
  const r = resolveChoiceFn(state, fake, inst, '0', { bond: member?.bond ?? null });
  const fx = { ...(r.fx ?? {}) };
  if (fx.wealthWeeks) { fx.wealth = (fx.wealth ?? 0) - Math.round((state.player.club?.wageWeekly ?? 100) * fx.wealthWeeks); delete fx.wealthWeeks; }
  if (member && fx.bond) fx.bondWho = member.name;
  state.flags.actWeek = { ...(state.flags.actWeek ?? {}), [cdKey(a, memberId ?? a.who)]: state.week };
  return { action: a, text: r.text, fx, label: r.label, member };
}

export const personWord = (v) => (v === null || v === undefined ? '' : v >= 85 ? 'Very close' : v >= 65 ? 'Close' : v >= 45 ? 'Fine' : v >= 25 ? 'Strained' : 'Broken');
export { memberByName };
