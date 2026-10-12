// Plays whole careers automatically to catch engine bugs and check balance.
// Usage: npm run simtest            (5 careers)
//        node tools/sim-test.mjs 20 (20 careers)
//        node tools/sim-test.mjs 5 --never   (also list scenarios that never fired)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld, leagueClubs } from '../public/js/world.js';
import {
  newCareer, advanceWeek, chooseDecision, legacy, ageNow, maybeInterlude, answerInterlude, freeTimeList, freeTime, freeTimeSlots, socialOptions, socialPost,
  peopleAction, buyItem, sellItem, journalWeek, autoAnswer, netWorth,
} from '../public/js/engine.js';
import { lifeLegacy, epilogue } from '../public/js/epilogue.js';
import { meter } from '../public/js/life.js';
import { overall } from '../public/js/player.js';
import { narrateOffline } from '../public/js/narrator-offline.js';
import { peopleList, actionsFor, teammateRows } from '../public/js/people.js';
import { scenarioContext, conditionsMet, fill } from '../public/js/scenarios.js';
import { shopItems, ownedAssets, giftTargets } from '../public/js/assets.js';
import { monthStory } from '../public/js/journal.js';
import { followerCeiling } from '../public/js/social.js';
import { pick } from '../public/js/util.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = await loadWorld(async (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')));
const runs = Number(process.argv[2] ?? 5);
const positions = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];

const starts = [{ key: 'Indonesia|1' }, { key: 'Indonesia|1' }, { key: 'England|2' }, { key: 'Brazil|1' }, { key: 'Japan|1' }];
let errors = 0;
const fired = new Map(); let decisions = 0, weeksTotal = 0, asides = 0, clicks = 0, words = 0, posts = 0, deals = 0, acts = 0, buys = 0, mediaItems = 0, months = 0;
const actsFired = new Map();
const PH = /\{\w+\}/;
const checkText = (where, texts) => { const bad = texts.find((t) => PH.test(t ?? '')); if (bad) throw new Error(`Unfilled placeholder in ${where}: "${String(bad).slice(0, 160)}"`); };
for (let i = 0; i < runs; i++) {
  const start = starts[i % starts.length];
  const state = newCareer(world, {
    name: 'Test Player', jerseyName: 'TESTER', number: 10, position: pick(positions), nationality: start.key.startsWith('Indonesia') ? 'Indonesia' : pick(['Indonesia', 'Brazil', 'Japan', 'England']),
    leagueKey: start.key, club: pick(leagueClubs({ leagueClubs: {} }, world, start.key)),
  });
  const p = state.player;
  console.log(`\n=== Career ${i + 1}: ${p.position} ${p.nationality} at ${p.club.name} (${start.key}) start OVR ${overall(p)} · squad ${state.squad.members.length} · captain ${p.circle.captain} ===`);
  let weeks = 0;
  const monthMode = i % 2 === 1; // every other career plays some months at once
  try {
    while (!state.ended && weeks < 1400) {
      // Month mode: let instinct answer the small things, stop for the big ones.
      if (monthMode && Math.random() < 0.5) autoAnswer(state);
      for (const d of state.pending) if (!d.chosen) chooseDecision(state, d.id, pick(d.choices).id);
      // People: start something with someone.
      if (Math.random() < 0.45 && freeTimeSlots(state) > 0) {
        const ctx = scenarioContext(state, world, null);
        const people = peopleList(state);
        const tm = teammateRows(state);
        const target = Math.random() < 0.3 && tm.length ? { key: 'teammate', id: pick(tm).id } : people.length ? { key: pick(people).key, id: null } : null;
        if (target) {
          const list = actionsFor(state, world, ctx, conditionsMet, fill, target.key, target.id).filter((a) => !a.cooling && a.cost <= freeTimeSlots(state));
          if (list.length) {
            const a = pick(list);
            checkText('action label ' + a.id, [a.label, a.desc, a.hint]);
            const r = peopleAction(state, world, a.id, target.id);
            if (r) { acts++; actsFired.set(a.id, (actsFired.get(a.id) ?? 0) + 1); checkText('action ' + a.id, [r.headline, r.text, r.label, ...r.ripples.map((x) => x.text)]); }
          }
        }
      }
      // Free time
      if (Math.random() < 0.5) for (const a of freeTimeList(state, world).filter((x) => !x.done).slice(0, freeTimeSlots(state))) { if (Math.random() < 0.5) { const r = freeTime(state, world, a.id); if (r) { asides++; checkText('free time ' + a.id, [a.label, a.desc, r.text, ...r.ripples.map((x) => x.text)]); } } }
      // Shopping: now and then buy something affordable, a gift, an investment; sometimes sell.
      if (Math.random() < 0.06 && p.wealthEUR > 2000) {
        const items = shopItems(state, world).filter((x) => x.affordable && !x.locked && (x.invest || x.price < p.wealthEUR * 0.5));
        if (items.length) {
          const x = pick(items);
          const to = !x.invest && x.gift && Math.random() < 0.4 ? pick(giftTargets(state))[0] : 'self';
          const r = buyItem(state, world, x.id, { amount: x.invest ? Math.round(p.wealthEUR * 0.2) : null, to });
          if (r && !r.error) { buys++; checkText('buy ' + x.id, [r.headline, r.text]); }
        }
      }
      if (Math.random() < 0.02 && ownedAssets(state).length) sellItem(state, world, pick(ownedAssets(state)).uid);
      // Up to three posts
      for (let k = 0; k < 3; k++) {
        const opts = socialOptions(state, world);
        if (opts.length && Math.random() < 0.45) { const r = socialPost(state, world, pick(opts).key); posts++; checkText('post', [r.post.caption, ...r.post.comments.map((c) => c.text), ...r.ripples.map((x) => x.text)]); }
      }
      clicks++;
      if (!monthMode) { let it; while ((it = maybeInterlude(state, world))) { clicks++; asides++; checkText('interlude ' + it.sid, [it.headline, it.text, it.time, ...it.choices.flatMap((c) => [c.label, c.description, c.consequence])]); const r = answerInterlude(state, world, pick(it.choices).id); checkText('interlude result ' + it.sid, [r.text, ...r.ripples.map((x) => x.text)]); fired.set(it.sid, (fired.get(it.sid) ?? 0) + 1); } }
      const res = advanceWeek(state, world, { intensity: pick(['hard', 'balanced', 'balanced', 'light', 'rest']), focus: 'auto' });
      const story = narrateOffline(state, world, res);
      const monthsBefore = state.journal.months.length;
      journalWeek(state, res, story);
      if (state.journal.months.length > monthsBefore) {
        const ms = monthStory(state, state.journal.months.at(-1), p.jerseyName); months++;
        checkText('month story', [ms.headline, ...ms.paragraphs]);
      }
      weeksTotal++; for (const ev of [...res.events, res.moment]) if (ev?.sid) fired.set(ev.sid, (fired.get(ev.sid) ?? 0) + 1);
      words += story.paragraphs.join(' ').split(/\s+/).length;
      mediaItems += res.media?.count ?? 0;
      checkText('media', (res.media?.items ?? []).flatMap((x) => [x.title, x.text, x.source?.name]));
      checkText('week ' + res.week, [story.dek, ...story.clippings.map((c) => c.headline), ...story.messages.map((m) => m.text), ...res.outcomes.flatMap((o) => (o.ripples ?? []).map((r) => r.text)), ...story.sections.map((x) => x.title)]);
      decisions += state.pending.length;
      if (!story.headline || !story.paragraphs.length) throw new Error(`Empty story in week ${res.week}`);
      const visible = [story.headline, ...story.paragraphs, ...story.socialFeed.map((x) => x.text), ...res.outcomes.map((o) => o.text),
        ...state.pending.flatMap((d) => [d.prompt, d.scene ?? '', d.headline ?? '', ...(d.sheet ?? []).flat(), ...d.choices.flatMap((c) => [c.label, c.description, c.consequence])])];
      checkText(`week ${res.week}`, visible);
      // Consistency checks
      for (const m of [...res.matches, ...res.intl]) {
        if (!m.detail) throw new Error(`Match without detail in week ${res.week}`);
        const myGoals = m.detail.events.filter((e) => e.type === 'goal' && e.side === 'my').length, oppGoals = m.detail.events.filter((e) => e.type === 'goal' && e.side === 'opp').length;
        if (myGoals !== m.gf || oppGoals !== m.ga) throw new Error(`Goal events (${myGoals}-${oppGoals}) don't match the score (${m.gf}-${m.ga}) in week ${res.week}`);
        if (m.minutes > 0 && !m.detail.lineups.my.xi.some((x) => x.me) && !m.detail.lineups.my.bench.some((x) => x.me)) throw new Error(`He played but is not in the line-up, week ${res.week}`);
        if (m.goals && m.detail.events.filter((e) => e.type === 'goal' && e.scorerId === 'me').length !== m.goals) throw new Error(`His goals don't match the events, week ${res.week}`);
      }
      if (state.squad && p.circle.captain && !state.squad.members.some((m) => m.name === p.circle.captain)) throw new Error(`Captain ${p.circle.captain} is not in the squad (week ${res.week})`);
      if (p.followers > (state.__lastFol ?? 0) && p.followers > followerCeiling(p) * 2 + 20000 && p.followers - (state.__lastFol ?? 0) > 1000) throw new Error(`Followers ${p.followers} far above the fame ceiling ${followerCeiling(p)} (week ${res.week}, fame ${p.reputation})`);
      if (!Number.isFinite(p.wealthEUR)) throw new Error('Wealth is not a number');
      state.__lastFol = p.followers;
      if (res.seasonEnd) {
        const s = res.seasonEnd;
        console.log(`  ${s.label.padEnd(8)} age ${String(ageNow(state)).padEnd(2)} ${String(p.club?.name ?? 'FREE').padEnd(28)} OVR ${overall(p)} pos ${s.pos}/${s.teams} apps ${s.apps} g ${s.goals} a ${s.assists} avg ${s.avgRating} role ${p.squadRole} trust ${p.manager.trust} €${p.wealthEUR} worth €${netWorth(state)} MV €${p.marketValue} rep ${p.reputation} caps ${p.national.caps} fol ${p.followers}${s.movement ? ' ' + s.movement : ''}`);
        console.log(`           life: ${['board', 'dressing', 'fans', 'press', 'image', 'family', 'love', 'friends', 'morale', 'stress'].map((k) => k + ' ' + (meter(p, k) ?? '-')).join(' · ')} · partner ${p.partner.status}${p.partner.near === false ? ' (far)' : ''} · assets ${ownedAssets(state).length}`);
      }
      if (res.moved) console.log(`  -> wk ${res.week}: ${res.moved.from} → ${res.moved.to} (${res.moved.type})`);
      weeks++;
    }
    const L = legacy(state), LL = lifeLegacy(state);
    const ep = epilogue(state, world);
    checkText('epilogue', ep.map((x) => x.text));
    deals += p.endorsements.length;
    console.log(`  LIFE: ${LL.label} (${LL.score}) · sponsors ${p.endorsements.length} · followers ${p.followers} · potential ${p.potential} · assets ${ownedAssets(state).length} · journal months ${state.journal.months.length}`);
    console.log(`  END: ${state.ended?.reason ?? 'timeout'} at age ${ageNow(state)} after ${weeks} weeks. Apps ${p.career.apps}, goals ${p.career.goals}, trophies ${p.career.trophies.length}, caps ${p.national.caps}, peak OVR ${p.career.peakOverall}, legacy ${L.label} (${L.score})`);
  } catch (e) {
    errors++;
    console.error(`  ERROR at week ${state.week}:`, e);
  }
}
const byCat = {}; for (const [id, n] of fired) { const c = world.scenarioById[id].cat; byCat[c] = (byCat[c] ?? 0) + n; }
console.log(`
Scenarios: ${fired.size}/${world.scenarios.length} different ones fired, ${[...fired.values()].reduce((a, b) => a + b, 0)} total over ${weeksTotal} weeks (${(decisions / weeksTotal).toFixed(2)} decisions/week)
Social: ${posts} posts · sponsor deals ${deals} · Story: ${Math.round(words / weeksTotal)} words/week · ${asides} free-time/interlude moments · ${Math.round(100 * (1 - weeksTotal / clicks))}% of Play clicks did not advance time
People: ${acts} actions (${actsFired.size}/${(world.interactions?.actions ?? []).length} kinds) · purchases ${buys} · media ${(mediaItems / weeksTotal).toFixed(1)} items/week · ${months} monthly reports`);
console.log('By category: ' + Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(' · '));
const never = world.scenarios.filter((x) => !fired.has(x.id) && !x.chainOnly && x.trigger !== 'start').map((x) => x.id);
if (process.argv.includes('--never')) console.log(`Never fired (${never.length}): ${never.join(', ')}`);
if (process.argv.includes('--acts')) console.log(`Actions never used: ${(world.interactions?.actions ?? []).filter((a) => !actsFired.has(a.id)).map((a) => a.id).join(', ')}`);
console.log(errors ? `\n${errors} career(s) crashed` : '\nAll careers completed without errors');
process.exit(errors ? 1 : 0);
