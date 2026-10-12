// Plays whole careers automatically to catch engine bugs and check balance.
// Usage: npm run simtest            (5 careers)
//        node tools/sim-test.mjs 20 (20 careers)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld, playableLeagues, leagueClubs } from '../public/js/world.js';
import { newCareer, advanceWeek, chooseDecision, legacy, ageNow, maybeInterlude, answerInterlude, freeTimeList, freeTime, freeTimeSlots, socialOptions, socialPost } from '../public/js/engine.js';
import { lifeLegacy, epilogue } from '../public/js/epilogue.js';
import { activeDeals } from '../public/js/sponsors.js';
import { meter } from '../public/js/life.js';
import { overall } from '../public/js/player.js';
import { narrateOffline } from '../public/js/narrator-offline.js';
import { pick } from '../public/js/util.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = await loadWorld(async (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')));
const runs = Number(process.argv[2] ?? 5);
const positions = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];

const starts = [{ key: 'Indonesia|1' }, { key: 'Indonesia|1' }, { key: 'England|2' }, { key: 'Brazil|1' }, { key: 'Japan|1' }];
let errors = 0;
const fired = new Map(); let decisions = 0, weeksTotal = 0, asides = 0, clicks = 0, words = 0, posts = 0, deals = 0;
const checkText = (where, texts) => { const bad = texts.find((t) => /\{\w+\}/.test(t ?? '')); if (bad) throw new Error(`Unfilled placeholder in ${where}: "${bad.slice(0, 140)}"`); };
for (let i = 0; i < runs; i++) {
  const start = starts[i % starts.length];
  const state = newCareer(world, {
    name: 'Test Player', jerseyName: 'TESTER', number: 10, position: pick(positions), nationality: start.key.startsWith('Indonesia') ? 'Indonesia' : pick(['Indonesia', 'Brazil', 'Japan', 'England']),
    leagueKey: start.key, club: pick(leagueClubs({ leagueClubs: {} }, world, start.key)),
  });
  const p = state.player;
  console.log(`\n=== Career ${i + 1}: ${p.position} ${p.nationality} at ${p.club.name} (${start.key}) start OVR ${overall(p)} ===`);
  let weeks = 0;
  try {
    while (!state.ended && weeks < 1400) {
      for (const d of state.pending) if (!d.chosen) chooseDecision(state, d.id, pick(d.choices).id);
      // Free time and mid-week interludes: they never move the clock.
      if (Math.random() < 0.5) for (const a of freeTimeList(state, world).filter((x) => !x.done).slice(0, freeTimeSlots(state))) { if (Math.random() < 0.5) { const r = freeTime(state, world, a.id); asides++; checkText('free time ' + a.id, [a.label, a.desc, r.text, ...r.ripples.map((x) => x.text)]); } }
      // A social post most weeks
      const opts = socialOptions(state, world);
      if (opts.length && Math.random() < 0.6) { const r = socialPost(state, world, pick(opts).key); posts++; checkText('post', [r.post.caption, ...r.post.comments.map((c) => c.text), ...r.ripples.map((x) => x.text)]); }
      clicks++;
      let it; while ((it = maybeInterlude(state, world))) { clicks++; asides++; checkText('interlude ' + it.sid, [it.headline, it.text, it.time, ...it.choices.flatMap((c) => [c.label, c.description, c.consequence])]); const r = answerInterlude(state, world, pick(it.choices).id); checkText('interlude result ' + it.sid, [r.text, ...r.ripples.map((x) => x.text)]); fired.set(it.sid, (fired.get(it.sid) ?? 0) + 1); }
      const res = advanceWeek(state, world, { intensity: pick(['hard', 'balanced', 'balanced', 'light', 'rest']), focus: 'auto' });
      const story = narrateOffline(state, world, res);
      weeksTotal++; for (const ev of [...res.events, res.moment]) if (ev?.sid) fired.set(ev.sid, (fired.get(ev.sid) ?? 0) + 1);
      words += story.paragraphs.join(' ').split(/\s+/).length;
      checkText('week ' + res.week, [story.dek, ...story.clippings.map((c) => c.headline), ...story.messages.map((m) => m.text), ...res.outcomes.flatMap((o) => (o.ripples ?? []).map((r) => r.text)), ...story.sections.map((x) => x.title)]);
      decisions += state.pending.length;
      if (!story.headline || !story.paragraphs.length) throw new Error(`Empty story in week ${res.week}`);
      // Every visible text must have its {placeholders} filled in.
      const visible = [story.headline, ...story.paragraphs, ...story.socialFeed.map((x) => x.text), ...res.outcomes.map((o) => o.text),
        ...state.pending.flatMap((d) => [d.prompt, d.scene ?? '', ...d.choices.flatMap((c) => [c.label, c.description, c.consequence])])];
      const leftover = visible.find((t) => /\{\w+\}/.test(t ?? ''));
      if (leftover) throw new Error(`Unfilled placeholder in week ${res.week}: "${leftover.slice(0, 120)}"`);
      if (res.seasonEnd) {
        const s = res.seasonEnd;
        console.log(`  ${s.label.padEnd(8)} age ${String(ageNow(state)).padEnd(2)} ${String(p.club?.name ?? 'FREE').padEnd(28)} OVR ${overall(p)} pos ${s.pos}/${s.teams} apps ${s.apps} g ${s.goals} a ${s.assists} avg ${s.avgRating} role ${p.squadRole} trust ${p.manager.trust} €${p.wealthEUR} MV €${p.marketValue} rep ${p.reputation} caps ${p.national.caps}${s.movement ? ' ' + s.movement : ''}`);
        console.log(`           life: ${['board', 'dressing', 'fans', 'press', 'image', 'family', 'love', 'friends', 'morale', 'stress'].map((k) => k + ' ' + (meter(p, k) ?? '-')).join(' · ')}`);
      }
      if (res.moved) console.log(`  -> wk ${res.week}: ${res.moved.from} → ${res.moved.to} (${res.moved.type})`);
      weeks++;
    }
    const L = legacy(state), LL = lifeLegacy(state);
    const ep = epilogue(state, world);
    checkText('epilogue', ep.map((x) => x.text));
    deals += p.endorsements.length;
    console.log(`  LIFE: ${LL.label} (${LL.score}) · sponsors over career ${p.endorsements.length} (${[...new Set(p.endorsements.map((x) => x.brand))].slice(0, 6).join(', ')}) · followers ${p.followers} · potential ${p.potential}`);
    console.log(`  END: ${state.ended?.reason ?? 'timeout'} at age ${ageNow(state)} after ${weeks} weeks. Apps ${p.career.apps}, goals ${p.career.goals}, trophies ${p.career.trophies.length}, caps ${p.national.caps}, peak OVR ${p.career.peakOverall}, legacy ${L.label} (${L.score})`);
  } catch (e) {
    errors++;
    console.error(`  ERROR at week ${state.week}:`, e);
  }
}
const byCat = {}; for (const [id, n] of fired) { const c = world.scenarioById[id].cat; byCat[c] = (byCat[c] ?? 0) + n; }
console.log(`
Scenarios: ${fired.size}/${world.scenarios.length} different ones fired, ${[...fired.values()].reduce((a, b) => a + b, 0)} total over ${weeksTotal} weeks (${(decisions / weeksTotal).toFixed(2)} decisions/week)
Social: ${posts} posts · sponsor deals ${deals} · Story: ${Math.round(words / weeksTotal)} words/week · ${asides} free-time/interlude moments · ${Math.round(100 * (1 - weeksTotal / clicks))}% of Play clicks did not advance time`);
console.log("By category: " + Object.entries(byCat).map(([k, v]) => `${k} ${v}`).join(" · "));
const never = world.scenarios.filter((x) => !fired.has(x.id) && !x.chainOnly && x.trigger !== "start").map((x) => x.id);
if (process.argv.includes("--never")) console.log(`Never fired (${never.length}): ${never.join(", ")}`);
console.log(errors ? `\n${errors} career(s) crashed` : '\nAll careers completed without errors');
process.exit(errors ? 1 : 0);
