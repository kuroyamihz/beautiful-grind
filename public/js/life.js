// The life web: the people around the player, the meters that describe those relationships,
// and the ripples that make one decision spill into other parts of his life.
//
// Meters (all 0-100):
//   club    → trust (manager), board, dressing (dressing room), fans
//   public  → press (media relations), image (public image)
//   private → family, love (partner), friends
//   self    → morale, stress (high stress is bad)
// Ripple rules and their text live in data/text/life.json, so the wording can be edited without code.
import { chance, clamp, pick, randint, round1, weightedPick } from './util.js';
import { personName } from './player.js';
import { LIFE } from './config.js';

export const METERS = {
  trust: { label: 'Manager', icon: 'whistle', group: 'club', tip: 'How much the manager trusts you. Decides your minutes.' },
  board: { label: 'Board', icon: 'building', group: 'club', tip: 'How the president and directors see you. Low = they may sell you.' },
  dressing: { label: 'Dressing room', icon: 'users', group: 'club', tip: 'Your standing with teammates.' },
  fans: { label: 'Fans', icon: 'megaphone', group: 'club', tip: "The club's supporters. Loud either way." },
  press: { label: 'Press', icon: 'newspaper', group: 'public', tip: 'Your relationship with journalists. Decides how stories about you are written.' },
  image: { label: 'Public image', icon: 'star', group: 'public', tip: 'Clean role model (high) or controversial (low). Sponsors and the board care.' },
  family: { label: 'Family', icon: 'home', group: 'private', tip: 'Support and closeness at home.' },
  love: { label: 'Partner', icon: 'heart', group: 'private', tip: 'How strong your relationship is.' },
  friends: { label: 'Friends', icon: 'friends', group: 'private', tip: 'Your circle outside football. They keep you grounded.' },
  morale: { label: 'Morale', icon: 'smile', group: 'self', tip: 'Happiness. High morale lifts your match ratings.' },
  stress: { label: 'Stress', icon: 'zap', group: 'self', tip: 'Pressure. High stress hurts ratings, raises injury risk, strains relationships.', inverse: true },
};
export const METER_KEYS = Object.keys(METERS);
// Meters that a scenario's fx can change directly (trust and family already had their own keys).
export const LIFE_FX = ['board', 'dressing', 'fans', 'press', 'image', 'love', 'friends', 'morale', 'stress', 'family'];

const MUM = { Indonesia: 'Ibu', Malaysia: 'Ibu', Brazil: 'Mãe', Portugal: 'Mãe', Spain: 'Mamá', Argentina: 'Mamá', Mexico: 'Mamá', Colombia: 'Mamá', Uruguay: 'Mamá', Chile: 'Mamá', Japan: 'Okaasan', 'South Korea': 'Eomma', Italy: 'Mamma', France: 'Maman', Germany: 'Mama', Netherlands: 'Mama' };
const DAD = { Indonesia: 'Bapak', Malaysia: 'Ayah', Brazil: 'Pai', Portugal: 'Pai', Spain: 'Papá', Argentina: 'Papá', Mexico: 'Papá', Colombia: 'Papá', Uruguay: 'Papá', Chile: 'Papá', Japan: 'Otousan', 'South Korea': 'Appa', Italy: 'Papà', France: 'Papa', Germany: 'Papa', Netherlands: 'Papa' };
const FRIEND_JOBS = ['a mechanic', 'a university student', 'a barista', 'a motorbike-taxi driver', 'a junior accountant', 'a primary-school teacher', 'a street-food seller', 'an aspiring rapper', 'a nurse', 'a delivery rider', 'a gym instructor', 'a phone-shop salesman'];

// ── Getting and setting meters ──
export function meter(p, k) {
  if (k === 'trust') return p.manager.trust;
  if (k === 'family') return p.family.parentalSupport;
  if (k === 'love') return p.partner.status === 'none' ? null : (p.partner.aff ?? 60);
  return p.life?.[k] ?? 50;
}

function setMeter(p, k, v) {
  v = Math.round(clamp(v, 0, 100));
  if (k === 'trust') p.manager.trust = v;
  else if (k === 'family') p.family.parentalSupport = v;
  else if (k === 'love') { if (p.partner.status !== 'none') p.partner.aff = v; }
  else p.life[k] = v;
}

// Change a meter and remember the change for this week's report. Returns the real change.
export function addMeter(state, k, delta, res) {
  const p = state.player;
  const before = meter(p, k);
  if (before === null || !delta) return 0;
  setMeter(p, k, before + delta);
  const d = meter(p, k) - before;
  if (d && res) {
    res.life = res.life ?? {};
    res.life[k] = (res.life[k] ?? 0) + d;
  }
  // Positive contact with someone resets the "you've been neglecting me" clock.
  if (d > 0 && ['family', 'love', 'friends'].includes(k)) p.contact[k] = state.week;
  return d;
}

// ── The cast ──
export function createCircle(state, world) {
  const p = state.player;
  const home = p.nationality;
  p.life = { board: 50, dressing: 50, fans: 45, press: 50, image: 55, friends: 70, morale: 62, stress: 25 };
  p.contact = { family: 0, love: 0, friends: 0 };
  p.partner.aff = p.partner.status === 'none' ? 0 : 60;
  p.partner.style = p.partner.style ?? pick(['private', 'public']);
  const sibKind = chance(0.5) ? 'brother' : 'sister';
  p.circle = {
    mum: MUM[home] ?? 'Mum', dad: DAD[home] ?? 'Dad',
    sibling: { name: personName(home, sibKind === 'sister').split(' ')[0], kind: sibKind },
    bestFriend: { name: personName(home), job: pick(FRIEND_JOBS) },
    journalist: null, captain: null, president: null,
  };
  clubCast(state, world);
  p.zones = {};
}

// New club = new captain, new president, new local journalist.
export function clubCast(state, world) {
  const p = state.player;
  if (!p.circle) return;
  const country = p.club?.country ?? p.nationality;
  p.circle.captain = personName(country);
  p.circle.president = personName(country);
  p.circle.journalist = { name: personName(country), outlet: outletFor(world, country) };
  if (p.life) {
    p.life.board = 50; p.life.dressing = 45;
    p.life.fans = clamp(Math.round(35 + p.reputation * 0.3), 35, 70);
  }
}

function outletFor(world, country) {
  const outlets = world?.life?.outlets ?? null;
  const list = outlets?.[country] ?? outlets?.default ?? ['The Touchline'];
  return pick(list);
}

// Fill life tokens in a piece of text. Used by scenarios, ripples, actions and the narrator.
export function lifeTokens(state) {
  const p = state.player, c = p.circle ?? {};
  const pf = (n) => (n ?? '').split(' ')[0];
  const pl = (n) => (n ?? '').split(' ').slice(-1)[0];
  return {
    MUM: c.mum ?? 'Mum', DAD: c.dad ?? 'Dad', SIB: c.sibling?.name ?? 'his sister', SIBr: c.sibling?.kind ?? 'sister',
    BF: c.bestFriend?.name ?? 'his best friend', BFf: pf(c.bestFriend?.name) || 'his best friend', BFjob: c.bestFriend?.job ?? 'a mechanic',
    JR: c.journalist?.name ?? 'a journalist', JRl: pl(c.journalist?.name) || 'the journalist', OUT: c.journalist?.outlet ?? 'the local paper',
    CAP: c.captain ?? 'the captain', CAPl: pl(c.captain) || 'the captain', PRES: c.president ?? 'the president', PRESl: pl(c.president) || 'the president',
    Pf: pf(p.partner.name) || 'his partner',
  };
}

export function fillLife(str, state, extra = {}) {
  const map = { ...lifeTokens(state), J: state.player.jerseyName, M: state.player.manager.name, Mf: state.player.manager.name.split(' ').slice(-1)[0], P: state.player.partner.name || 'his partner', club: state.player.club?.name ?? 'the club', ...extra };
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

// ── Ripples: secondary consequences of a change ──
// `d` = what just changed (meters, followers, rep, wealth, pfm, lifestyle, mood).
// Every ripple has a text line from data/text/life.json → ripples.<id>.
export function ripple(state, world, d, res, source = 'decision') {
  const p = state.player;
  const L = world.life?.ripples ?? {};
  const wage = p.club?.wageWeekly ?? 100;
  const hasPartner = p.partner.status !== 'none';
  const out = [];
  const add = (id, changes, prob = 1) => { if (chance(prob)) out.push({ id, changes }); };
  const v = (k) => d[k] ?? 0;

  // Media exposure lands at home.
  if (hasPartner && (v('followers') >= 4000 || Math.abs(v('press')) >= 4 || Math.abs(v('rep')) >= 1)) {
    if (p.partner.style === 'private') add('splashPrivatePartner', { love: -3 }, 0.7);
    else add('splashPublicPartner', { love: 2 }, 0.6);
  }
  if (v('followers') >= 15000) add('viralFamily', { family: 2 }, 0.5);
  // Public image ↔ family, board, fans
  if (v('image') <= -3) { add('badImageFamily', { family: -2, stress: 2 }, 0.8); add('imageBoard', { board: -2, fans: -1 }, 0.7); }
  if (v('image') >= 3) { add('goodImageFamily', { family: 2 }, 0.6); add('imageBoardUp', { board: 2 }, 0.5); }
  // Manager clashes split the dressing room and feed the press.
  if (v('trust') <= -5) {
    if (meter(p, 'dressing') >= 60) add('clashBacked', { dressing: 2, press: 1 });
    else add('clashIsolated', { dressing: -2, press: 1 });
    add('clashFans', meter(p, 'fans') >= 60 ? { fans: 2 } : { fans: -2 }, 0.5);
  }
  if (v('trust') >= 5) add('teachersPet', { dressing: -1 }, 0.25);
  // Money moves
  if (v('wealth') <= -2 * wage || v('lifestyle') > 0) add('splurge', { friends: 2, stress: -1, ...(meter(p, 'family') < 60 ? { family: -1 } : {}) }, 0.6);
  if (v('wealth') >= 4 * wage) add('windfall', { stress: -2 }, 0.5);
  // Private life feeds morale and stress — and leaks.
  if (v('family') >= 3) add('familyUp', { morale: 3, stress: -2 });
  if (v('family') <= -3) add('familyDown', { morale: -3, stress: 3 });
  if (hasPartner && v('love') >= 3) { add('loveUp', { morale: 3, stress: -2 }); if (p.followers > 5000 && p.partner.style === 'public') add('powerCouplePost', { followers: Math.round(p.followers * 0.02) + 500, image: 1 }, 0.35); }
  if (hasPartner && v('love') <= -3) add('loveDown', { morale: -3, stress: 3 });
  if (v('friends') >= 3) add('friendsUp', { morale: 2, stress: -2 });
  if (v('friends') <= -3) { add('friendsDown', { morale: -2 }); if (meter(p, 'friends') < 40) add('friendLeak', { press: -2, image: -2 }, 0.3); }
  // Club politics chain
  if (v('fans') >= 3) add('fansUp', { board: 1, followers: 300 + Math.round(p.followers * 0.005) }, 0.7);
  if (v('fans') <= -3) add('fansDown', { board: -1, morale: -2 });
  if (v('dressing') <= -3) add('dressingTalk', { trust: -1 }, 0.7);
  if (v('dressing') >= 3) add('dressingRespect', { trust: 1 }, 0.5);
  if (v('press') >= 3) add('pressUp', { image: 1 }, 0.7);
  if (v('press') <= -3) add('pressHit', { image: -2, family: -1 }, 0.8);
  if (v('board') <= -4) add('boardPressure', { trust: -1 }, 0.6);
  if (v('board') >= 4) add('boardHappy', { trust: 1 }, 0.4);
  // Body and mind
  if (v('pfm') >= 5) add('restStress', { stress: -3 });
  if (v('pfm') <= -6) add('tiredStress', { stress: 2 });
  if (v('stress') >= 6 && hasPartner) add('stressSpill', { love: -2 }, 0.6);
  if (['Angry', 'Broken', 'Frustrated', 'Lost', 'Numb'].includes(d.mood)) add('badMoodHome', hasPartner ? { love: -1, stress: 2 } : { stress: 2 }, 0.6);
  if (['Relieved', 'Confident', 'On Fire', 'Motivated'].includes(d.mood)) add('goodMood', { morale: 3 }, 0.6);

  // Keep it readable: at most LIFE.maxRipples lines per decision, the biggest first.
  const size = (r) => Object.values(r.changes).reduce((a, x) => a + (Math.abs(x) > 100 ? 2 : Math.abs(x)), 0);
  const chosen = out.sort((a, b) => size(b) - size(a)).slice(0, LIFE.maxRipples);
  for (const r of chosen) {
    const applied = {};
    for (const [k, x] of Object.entries(r.changes)) {
      if (k === 'followers') { p.followers = Math.max(0, Math.round(p.followers + x)); applied.followers = x; continue; }
      const real = addMeter(state, k, x, res);
      if (real) applied[k] = real;
    }
    if (!Object.keys(applied).length) continue;
    const text = fillLife(pick(L[r.id] ?? [`Ripple: ${r.id}`]), state);
    res.ripples = res.ripples ?? [];
    res.ripples.push({ id: r.id, text, changes: applied, source });
  }
}

// ── Weekly life: neglect, stress, morale, drift, thresholds ──
export function lifeWeek(state, world, res, plan) {
  const p = state.player;
  const w = state.week;
  const abroad = p.club && p.club.country !== p.nationality;
  const hasPartner = p.partner.status !== 'none';
  // Neglect: people you don't make time for drift away.
  if (w - (p.contact.family ?? 0) > LIFE.neglect.family) addMeter(state, 'family', abroad ? -2 : -1, res);
  if (hasPartner && w - (p.contact.love ?? 0) > LIFE.neglect.love) addMeter(state, 'love', p.partner.status === 'married' ? -1 : -2, res);
  if (w - (p.contact.friends ?? 0) > LIFE.neglect.friends) addMeter(state, 'friends', -1, res);
  // Stress
  const played = res.matches.filter((m) => m.minutes > 0).length + res.intl.filter((m) => m.minutes > 0).length;
  let ds = played * 2 + ({ hard: 3, balanced: 0, light: -2, rest: -4 }[plan.intensity] ?? 0);
  if (p.debtMonths > 0) ds += 2;
  if (meter(p, 'press') < 30) ds += 1;
  if (p.injury && p.injury.weeksLeft > 6) ds += 2;
  if (hasPartner && meter(p, 'love') >= 70) ds -= 2;
  if (meter(p, 'friends') >= 70) ds -= 1;
  if (meter(p, 'family') >= 70) ds -= 1;
  ds += (22 - meter(p, 'stress')) * 0.08; // drifts back towards calm
  addMeter(state, 'stress', Math.round(ds), res);
  // Morale moves towards what his life currently deserves.
  const roleM = { starter: 12, rotation: 4, bench: -6, outcast: -16 }[p.squadRole] ?? 0;
  const priv = [meter(p, 'family'), meter(p, 'friends'), hasPartner ? meter(p, 'love') : null].filter((x) => x !== null);
  const target = 50 + roleM + (p.form - 6.5) * 10 + (priv.reduce((a, b) => a + b, 0) / priv.length - 50) * 0.3
    - Math.max(0, meter(p, 'stress') - 40) * 0.35 + (meter(p, 'fans') - 50) * 0.1 + (p.injury ? -8 : 0);
  addMeter(state, 'morale', Math.round((clamp(target, 5, 95) - meter(p, 'morale')) * 0.25), res);
  // Slow drift of public and club meters
  const drift = (k, to, rate) => addMeter(state, k, Math.round((to - meter(p, k)) * rate), res);
  drift('press', 50, 0.04);
  drift('image', 55, 0.03);
  const allies = p.keyTeammates.filter((t) => t.relationship === 'ally').length, rivals = p.keyTeammates.filter((t) => ['rival', 'enemy'].includes(t.relationship)).length;
  drift('dressing', 45 + allies * 8 - rivals * 8, 0.04);
  if (p.club) drift('board', (meter(p, 'trust') + meter(p, 'fans') + meter(p, 'image')) / 3, 0.04);
  // Consequences that keep biting while a meter is in the red
  if (p.club && meter(p, 'dressing') < 20 && chance(0.3)) addMeter(state, 'trust', -1, res);
  if (p.club && meter(p, 'board') < 15 && !p.transferListed && chance(0.08)) { p.transferListed = true; res.notes.push(fillLife('The board has quietly told {A} that offers for {J} will now be considered.', state, { A: p.agent?.name ?? 'his representatives' })); }
  thresholds(state, res);
}

// When a meter crosses into the red (or the gold), a story trigger fires once until it recovers.
const ZONES = [
  ['love', 'low', 25, 'partnerCrisis'], ['family', 'low', 25, 'familyRift'], ['friends', 'low', 25, 'friendsDrift'],
  ['dressing', 'low', 25, 'dressingRevolt'], ['board', 'low', 25, 'boardAngry'], ['fans', 'low', 22, 'fansTurn'],
  ['press', 'low', 25, 'pressWar'], ['image', 'low', 25, 'scandal'], ['morale', 'low', 22, 'lowMorale'],
  ['stress', 'high', 80, 'burnout'], ['fans', 'high', 85, 'fanFavourite'], ['press', 'high', 82, 'pressDarling'],
  ['love', 'high', 88, 'deepLove'], ['dressing', 'high', 85, 'leader'], ['image', 'high', 85, 'roleModel'],
];
export const LIFE_TRIGGERS = [...new Set(ZONES.map((z) => z[3]))];

function thresholds(state, res) {
  const p = state.player;
  p.zones = p.zones ?? {};
  for (const [k, kind, at, trig] of ZONES) {
    const v = meter(p, k);
    if (v === null) continue;
    const id = `${k}_${kind}`;
    const inZone = kind === 'low' ? v < at : v > at;
    // A little hysteresis so a meter hovering on the line doesn't fire every week.
    const outZone = kind === 'low' ? v >= at + 10 : v <= at - 10;
    if (inZone && !p.zones[id]) { p.zones[id] = true; res.triggers.push(trig); }
    else if (outZone && p.zones[id]) p.zones[id] = false;
  }
}

// ── How the life web changes performance on the pitch ──
export function lifeRatingMod(p, home) {
  if (!p.life) return 0;
  let m = (meter(p, 'morale') - 50) * 0.006;
  if (meter(p, 'stress') > 65) m -= (meter(p, 'stress') - 65) * 0.012;
  if (home && meter(p, 'fans') < 20) m -= 0.15;
  if (home && meter(p, 'fans') > 85) m += 0.1;
  return round1(m * 10) / 10;
}
export const lifeInjuryMod = (p) => (p.life && meter(p, 'stress') > 75 ? LIFE.stressInjury : 0);

// A match changes how the fans and the dressing room see you.
export function lifeAfterMatch(state, m, res) {
  if (!m.minutes) return;
  const fansD = Math.round((m.rating - 6.6) * 2.5 + m.goals * 2 + (m.motm ? 2 : 0) + (m.red ? -4 : 0));
  addMeter(state, 'fans', fansD, res);
  if (m.result === 'W' && m.rating >= 7) addMeter(state, 'dressing', 1, res);
  if (m.red) addMeter(state, 'dressing', -2, res);
}

// ── Transfers ripple through everyone's lives ──
export function lifeMove(state, world, offer, res) {
  const p = state.player;
  const abroad = offer.country !== (p.club?.country ?? p.nationality) && offer.country !== p.nationality;
  const d = {};
  if (abroad) { d.family = -4; d.friends = -5; d.stress = 6; if (p.partner.status !== 'none') d.love = p.partner.status === 'married' ? -2 : -6; }
  else { d.friends = -2; d.stress = 3; }
  if (offer.fee > 1e6 || offer.qualityDelta > 4) { d.press = 3; d.morale = 4; }
  const lines = world.life?.ripples ?? {};
  for (const [k, x] of Object.entries(d)) addMeter(state, k, x, res);
  const id = abroad ? (p.partner.status !== 'none' ? 'moveAbroadPartner' : 'moveAbroad') : 'moveDomestic';
  res.ripples = res.ripples ?? [];
  res.ripples.push({ id, text: fillLife(pick(lines[id] ?? ['The move changes everything at home.']), state, { NEWCLUB: offer.club, COUNTRY: offer.country }), changes: d, source: 'transfer' });
}

// ── Free time: things you choose to do that don't move the clock ──
export function freeTimeLeft(state) {
  const p = state.player;
  if (p.freeTime?.week !== state.week) p.freeTime = { week: state.week, used: 0, done: [], words: {} };
  return Math.max(0, (p.injury ? LIFE.freeTimePerWeek + 1 : LIFE.freeTimePerWeek) - p.freeTime.used);
}

export function freeTimeOptions(state, world, ctx, conditionsMet) {
  const acts = world.life?.actions ?? [];
  freeTimeLeft(state);
  const ft = state.player.freeTime;
  // Each action's random words ({PLACE}, {HOBBY}…) are fixed for the week so the label and the result match.
  const words = (id) => (ft.words[id] = ft.words[id] ?? Object.fromEntries(Object.entries(world.life?.words ?? {}).map(([k, l]) => [k, pick(l)])));
  return acts.filter((a) => conditionsMet(a.when, ctx)).map((a) => ({ ...a, label: fillLife(a.label, state, words(a.id)), desc: fillLife(a.desc, state, words(a.id)), done: ft.done.includes(a.id) }));
}

export function doFreeTime(state, world, id, applyEffects) {
  const p = state.player;
  const a = (world.life?.actions ?? []).find((x) => x.id === id);
  if (!a || freeTimeLeft(state) <= 0 || p.freeTime.done.includes(id)) return null;
  p.freeTime.used++;
  p.freeTime.done.push(id);
  const o = weightedPick(a.out, (x) => x.w ?? 1);
  const res = { statChanges: {}, notes: [], triggers: [], milestones: [], outcomes: [], matches: [], intl: [] };
  const fx = { ...(o.fx ?? {}) };
  if (fx.wealthWeeks) { fx.wealth = -Math.round((p.club?.wageWeekly ?? 100) * fx.wealthWeeks); delete fx.wealthWeeks; }
  applyEffects(state, world, fx, res, { source: 'free time' });
  const text = fillLife(pick([].concat(o.text)), state, p.freeTime.words?.[id] ?? {});
  return { action: { ...a, label: fillLife(a.label, state, p.freeTime.words?.[id] ?? {}) }, text, res };
}

// ── Saves from before v0.3 get a cast and meters ──
export function migrateLife(state, world) {
  const p = state.player;
  if (!p.life) createCircle(state, world);
  p.partner.aff = p.partner.aff ?? (p.partner.status === 'none' ? 0 : 60);
  p.partner.style = p.partner.style ?? pick(['private', 'public']);
  p.contact = p.contact ?? { family: state.week, love: state.week, friends: state.week };
  p.zones = p.zones ?? {};
}

// Short human word for a meter value (used in the UI).
export function meterWord(k, v) {
  if (v === null) return '';
  if (k === 'stress') return v >= 80 ? 'Breaking point' : v >= 60 ? 'Under pressure' : v >= 35 ? 'Manageable' : 'Calm';
  if (k === 'image') return v >= 80 ? 'Role model' : v >= 60 ? 'Clean' : v >= 40 ? 'Mixed' : v >= 25 ? 'Controversial' : 'Toxic';
  return v >= 85 ? 'Excellent' : v >= 65 ? 'Good' : v >= 45 ? 'OK' : v >= 25 ? 'Strained' : 'Broken';
}

