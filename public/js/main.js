// App controller: setup screen, game loop, saving, settings.
import { loadWorld, playableLeagues, leagueClubs, clubStrength } from './world.js';
import { newCareer, advanceWeek, chooseDecision, pendingUnanswered, ageNow } from './engine.js';
import { narrateOffline } from './narrator-offline.js';
import { renderPlayer, renderWeek, renderDecisions, renderPlanner, renderFeed, renderWorld, renderRetirement } from './ui.js';
import { POSITIONS } from './config.js';
import { dateLabel } from './time.js';
import { escapeHtml } from './util.js';

const SAVE_KEY = 'beautifulGrind.save.v1';
const $ = (id) => document.getElementById(id);

let world, state = null, story = null, plan = { intensity: 'balanced', focus: 'auto' }, busy = false;

// ── Saving (browser storage can be unavailable — never crash on it) ──
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, story, plan })); } catch (err) { console.warn('Save failed', err); } }
function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }

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
    story = { headline: state.intro.headline, paragraphs: [state.intro.text], socialFeed: [{ handle: '@' + state.player.club.name.replace(/[^A-Za-z0-9]/g, ''), displayName: state.player.club.name, verified: true, platform: 'instagram', text: `Welcome to the first team, ${state.player.jerseyName}! 🔥 #${state.player.number}`, likes: 1200 }], eventType: 'milestone', isMajorEvent: true, source: 'offline' };
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
  renderPlayer(state, world, story);
  renderWeek(state, world, story);
  renderFeed(story);
  renderWorld(state, world);
  $('top-date').textContent = `${dateLabel(state.week)} · ${state.player.jerseyName}, ${ageNow(state)}`;
  if (state.ended) { renderRetirement(state); $('btn-new-career').addEventListener('click', newCareerFlow); return; }
  renderDecisions(state, onChoose);
  renderPlannerNow();
}

function onChoose(id, choice) {
  chooseDecision(state, id, choice);
  save();
  renderDecisions(state, onChoose);
  renderPlannerNow();
}

function renderPlannerNow() {
  renderPlanner(state, plan, (np) => { plan = np; save(); renderPlannerNow(); }, playWeek);
}

function playWeek() {
  if (busy) return;
  if (pendingUnanswered(state).length) { $('decisions').classList.add('shake'); setTimeout(() => $('decisions').classList.remove('shake'), 400); return; }
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
      ({ state, story } = d); plan = d.plan ?? plan;
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
  $('btn-continue').addEventListener('click', () => { const d = loadSave(); ({ state, story } = d); plan = d.plan ?? plan; showGame(); });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-export').addEventListener('click', exportSave);
  $('file-import').addEventListener('change', (ev) => ev.target.files[0] && importSave(ev.target.files[0]));
  $('btn-new').addEventListener('click', newCareerFlow);
  const saved = loadSave();
  if (saved?.state && !saved.state.ended) { ({ state, story } = saved); plan = saved.plan ?? plan; showGame(); }
  else showSetup();
})();
