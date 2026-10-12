// App controller: setup screen, game loop, interludes, free time, saving, settings.
import { loadWorld, playableLeagues, leagueClubs, clubStrength } from './world.js';
import {
  newCareer, advanceWeek, chooseDecision, pendingUnanswered, migrate, maybeInterlude, answerInterlude, freeTime, freeTimeList, freeTimeSlots,
  socialOptions, socialCanPost, socialPost,
} from './engine.js';
import { narrateOffline } from './narrator-offline.js';
import {
  renderPlayer, renderTopbar, renderWeek, renderDecisions, renderFreeTime, renderPlanner, renderFeed, renderWorld, renderRetirement,
  renderInterlude, renderInterludeResult, renderSocial,
} from './ui.js';
import { POSITIONS } from './config.js';
import { dateLabel } from './time.js';
import { escapeHtml } from './util.js';

// The key stays the same across versions: old saves are upgraded by migrate() when they load.
const SAVE_KEY = 'beautifulGrind.save.v1';
const $ = (id) => document.getElementById(id);

let world, state = null, story = null, plan = { intensity: 'balanced', focus: 'auto' }, busy = false;
let tab = 'circle';
try { tab = localStorage.getItem('beautifulGrind.tab') || 'circle'; } catch {}

// ── Saving (browser storage can be unavailable — never crash on it) ──
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, story, plan })); } catch (err) { console.warn('Save failed', err); } }
function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function useSave(d) {
  state = migrate(d.state, world);
  story = d.story;
  plan = d.plan ?? plan;
}

// ── Setup screen ──
function fillSetup() {
  const posSel = $('sel-position');
  posSel.innerHTML = Object.entries(POSITIONS).map(([k, v]) => `<option value="${k}" ${k === 'W' ? 'selected' : ''}>${v.name}</option>`).join('');
  const nations = [...world.countries].sort((a, b) => a.country.localeCompare(b.country));
  $('sel-nationality').innerHTML = nations.map((c) => `<option value="${escapeHtml(c.country)}" ${c.country === 'Indonesia' ? 'selected' : ''}>${c.flag} ${escapeHtml(c.country)}</option>`).join('');
  const countries = [...new Set(playableLeagues(world).map((l) => l.country))].sort();
  $('sel-country').innerHTML = countries.map((c) => `<option ${c === 'Indonesia' ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  const fillLeagues = () => {
    const ls = playableLeagues(world, $('sel-country').value);
    $('sel-league').innerHTML = ls.map((l) => `<option value="${escapeHtml(l.key)}">${escapeHtml(l.name)} (tier ${l.tier})</option>`).join('');
    fillClubs();
  };
  const fillClubs = () => {
    const key = $('sel-league').value;
    const clubs = leagueClubs({ leagueClubs: {} }, world, key).slice().sort();
    $('sel-club').innerHTML = clubs.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
    hint();
  };
  const hint = () => {
    const s = clubStrength($('sel-club').value, $('sel-league').value);
    $('club-hint').textContent = s >= 78 ? 'Elite club: you will start far from the first team. Expect loans.' : s >= 68 ? 'Big club: breaking into the first team will be a fight.' : s >= 58 ? 'Solid club: a realistic place for a 16-year-old to get early minutes.' : 'Smaller club: more chances to play — and to be noticed.';
  };
  $('sel-country').addEventListener('change', fillLeagues);
  $('sel-league').addEventListener('change', fillClubs);
  $('sel-club').addEventListener('change', hint);
  $('btn-random-club').addEventListener('click', () => { const opts = $('sel-club').options; opts.selectedIndex = Math.floor(Math.random() * opts.length); hint(); });
  fillLeagues();
  $('setup-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    state = newCareer(world, {
      name: f.get('name').trim(), jerseyName: f.get('jerseyName').trim(), nickname: f.get('nickname').trim(), number: f.get('number'),
      position: f.get('position'), nationality: f.get('nationality'), leagueKey: $('sel-league').value, club: $('sel-club').value,
    });
    const p = state.player, c = p.circle;
    const intro = [
      // The opening scene is already on its decision card; don't print it twice.
      state.pending.some((d) => d.scene) ? `${p.jerseyName} is sixteen, and today ${p.club.name} hand him a first-team training kit.` : state.intro.text,
      `Your world, for now: ${p.manager.name} is the manager. ${c.captain} wears the armband. ${c.president} is the club president. At home, ${c.mum} and ${c.dad} have told everyone they know, and your little ${c.sibling.kind} ${c.sibling.name} has told everyone else. Your best friend ${c.bestFriend.name}, ${c.bestFriend.job}, has already asked for tickets.`,
      'Every week brings decisions from different parts of your life. What you choose in one place ripples into the others: what you tell the press reaches your partner, how you treat your friends reaches the papers, how the fans feel reaches the boardroom. Make time for people, or they drift away.',
    ];
    story = {
      headline: state.intro.headline, dek: 'Day one. Everything starts here.',
      sections: [{ id: 'opening', icon: 'calendar', title: '', paras: intro }], paragraphs: intro,
      socialFeed: [{ handle: '@' + p.club.name.replace(/[^A-Za-z0-9]/g, ''), displayName: p.club.name, verified: true, platform: 'instagram', text: `Welcome to the first team, ${p.jerseyName}! 🔥 #${p.number}`, likes: 1200 }],
      eventType: 'milestone', isMajorEvent: true, source: 'offline',
    };
    plan = { intensity: 'balanced', focus: 'auto' };
    save();
    showGame();
  });
}

function showSetup() {
  $('game').classList.add('hidden');
  $('setup').classList.remove('hidden');
  const saved = loadSave();
  if (saved?.state && !saved.state.ended) {
    const p = saved.state.player;
    $('continue-text').textContent = `${p.name} · ${p.club?.name ?? 'Free agent'} · ${dateLabel(saved.state.week)}`;
    $('continue-box').classList.remove('hidden');
  } else $('continue-box').classList.add('hidden');
}

// ── Game screen ──
function render() {
  renderTopbar(state);
  renderPlayer(state, world);
  renderWeek(state, world, story);
  renderFeed(story);
  renderWorldNow();
  if (state.ended) { renderRetirement(state, world); $('btn-new-career').addEventListener('click', newCareerFlow); return; }
  renderDecisions(state, onChoose);
  renderFreeTimeNow();
  renderSocialNow();
  renderPlannerNow();
  if (state.interlude) openInterlude(state.interlude);
}

function renderWorldNow() {
  renderWorld(state, world, tab, (t) => { tab = t; try { localStorage.setItem('beautifulGrind.tab', t); } catch {} renderWorldNow(); });
}

function onChoose(id, choice) {
  chooseDecision(state, id, choice);
  save();
  renderDecisions(state, onChoose);
  renderPlannerNow();
}

function renderPlannerNow() {
  renderPlanner(state, plan, (np) => { plan = np; save(); renderPlannerNow(); }, onPlay);
}

function renderSocialNow() {
  renderSocial(state, socialOptions(state, world), socialCanPost(state), onPost);
}

// A social post: instant result, no time passes.
function onPost(key) {
  if (busy) return;
  if (!socialPost(state, world, key)) return;
  save();
  renderTopbar(state);
  renderPlayer(state, world);
  renderWeek(state, world, story);
  renderWorldNow();
  renderSocialNow();
  renderFreeTimeNow();
  $('week-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFreeTimeNow() {
  renderFreeTime(state, freeTimeList(state, world), freeTimeSlots(state), onFreeTime);
}

// Free time: an immediate result that doesn't move the clock.
function onFreeTime(id) {
  if (busy) return;
  const r = freeTime(state, world, id);
  if (!r) return;
  save();
  renderTopbar(state);
  renderPlayer(state, world);
  renderWeek(state, world, story);
  renderWorldNow();
  renderFreeTimeNow();
  $('week-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// "Play week": sometimes life interrupts first (an interlude). Time only moves when no interlude comes.
function onPlay() {
  if (busy) return;
  if (pendingUnanswered(state).length) { $('decisions').classList.add('shake'); setTimeout(() => $('decisions').classList.remove('shake'), 400); return; }
  const it = maybeInterlude(state, world);
  if (it) { save(); openInterlude(it); return; }
  playWeek();
}

function openInterlude(it) {
  const dlg = $('interlude');
  renderInterlude(state, it, (choiceId) => {
    const r = answerInterlude(state, world, choiceId);
    save();
    renderTopbar(state);
    renderPlayer(state, world);
    renderWeek(state, world, story);
    renderWorldNow();
    renderInterludeResult(state, r, () => { dlg.close(); playWeek(); }, () => dlg.close());
  });
  if (!dlg.open) dlg.showModal();
}

function playWeek() {
  if (busy) return;
  busy = true;
  try {
    const res = advanceWeek(state, world, plan);
    const next = narrateOffline(state, world, res);
    if (!state.log.length || state.log.at(-1).week !== res.week) state.log.push({ week: res.week, headline: next.headline, type: next.eventType });
    story = next;
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    $('planner').insertAdjacentHTML('afterbegin', `<p class="box box-bad">Something went wrong playing this week (${escapeHtml(err.message)}). Your last save is safe — refresh the page and try again.</p>`);
  } finally {
    busy = false; // never leave the Play button locked
  }
}

function showGame() {
  $('setup').classList.add('hidden');
  $('game').classList.remove('hidden');
  render();
}

// Replacing a live career needs a second click (no pop-up dialogs).
let newCareerArmed = null;
function newCareerFlow() {
  const btn = $('btn-new');
  if (state && !state.ended && !newCareerArmed) {
    btn.textContent = 'Click again to replace this career';
    newCareerArmed = setTimeout(() => { newCareerArmed = null; btn.textContent = 'New career'; }, 5000);
    return;
  }
  clearTimeout(newCareerArmed); newCareerArmed = null; btn.textContent = 'New career';
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  state = null; story = null;
  $('settings').close?.();
  showSetup();
}

// ── Settings ──
function openSettings() {
  $('settings-msg').textContent = '';
  $('settings').showModal();
}

function exportSave() {
  const data = JSON.stringify({ state, story, plan });
  const filename = `beautiful-grind-${state.player.jerseyName.toLowerCase()}-week${state.week + 1}.json`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importSave(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.state?.player) throw new Error('not a Beautiful Grind save');
      useSave(d);
      save(); $('settings').close(); showGame();
    } catch (err) { $('settings-msg').textContent = `Could not import that file: ${err.message}. Choose a .json file exported from Beautiful Grind.`; }
  };
  r.readAsText(file);
}

// ── Boot ──
(async function boot() {
  try {
    world = await loadWorld((path) => fetch(path).then((r) => { if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`); return r.json(); }));
  } catch (err) {
    $('loading').innerHTML = `<div class="brand-big">BEAUTIFUL GRIND</div><p>Could not load the game data (${escapeHtml(err.message)}).<br>Refresh the page. If you're playing on your own computer, start the game with <b>start-game.bat</b> instead of opening the HTML file directly.</p>`;
    return;
  }
  $('loading').classList.add('hidden');
  fillSetup();
  $('btn-continue').addEventListener('click', () => { useSave(loadSave()); showGame(); });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-export').addEventListener('click', exportSave);
  $('file-import').addEventListener('change', (ev) => ev.target.files[0] && importSave(ev.target.files[0]));
  $('btn-new').addEventListener('click', newCareerFlow);
  // Closing the interlude with Esc keeps it pending; it reopens next time you press Play.
  $('interlude').addEventListener('cancel', () => {});
  const saved = loadSave();
  if (saved?.state && !saved.state.ended) { useSave(saved); showGame(); }
  else showSetup();
})();
