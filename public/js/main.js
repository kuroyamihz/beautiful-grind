// App controller: setup screen, game loop (a week or a whole month), interludes, free time, people, social,
// assets, saving and settings.
import { loadWorld, playableLeagues, leagueClubs, clubStrength } from './world.js';
import {
  newCareer, advanceWeek, chooseDecision, pendingUnanswered, migrate, maybeInterlude, answerInterlude, freeTime, freeTimeList, freeTimeSlots,
  socialOptions, socialPost, socialPostsLeft, peopleAction, buyItem, sellItem, journalWeek, autoAnswer,
} from './engine.js';
import { narrateOffline } from './narrator-offline.js';
import {
  renderPlayer, renderTopbar, renderWeek, renderDecisions, renderActions, renderPlanner, renderMedia, renderWorld, renderRetirement,
  renderInterlude, renderInterludeResult, renderPerson, renderAvatarEditor, toast, toastError, initFolds,
} from './ui.js';
import { POSITIONS } from './config.js';
import { dateLabel, shortDate } from './time.js';
import { escapeHtml } from './util.js';
import { peopleList, teammateRows, actionsFor } from './people.js';
import { scenarioContext, conditionsMet, fill } from './scenarios.js';
import { digest, monthStory, monthKeyOf } from './journal.js';
import { defaultAvatar } from './avatar.js';
import { TRAITS } from './squad.js';
import { castAges } from './life.js';

// The key stays the same across versions: old saves are upgraded by migrate() when they load.
const SAVE_KEY = 'beautifulGrind.save.v1';
const $ = (id) => document.getElementById(id);

let world, state = null, story = null, plan = { intensity: 'balanced', focus: 'auto' }, busy = false;
const ui = { tab: 'circle', act: 'free', mediaFilter: 'all', mediaAll: false, shopCat: null, reportView: 'week', reportMonth: null, person: null };
try { ui.tab = localStorage.getItem('beautifulGrind.tab') || 'circle'; } catch {}
let setupAvatar = null;

// ── Saving (browser storage can be unavailable — never crash on it) ──
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, story, plan })); }
  catch (err) {
    // Storage full: drop the oldest media and journal weeks and try again.
    try {
      if (state.media) state.media.items = state.media.items.slice(0, 60);
      if (state.journal) state.journal.weeks = state.journal.weeks.slice(-30);
      localStorage.setItem(SAVE_KEY, JSON.stringify({ state, story, plan }));
    } catch { console.warn('Save failed', err); }
  }
}
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
    $('club-hint').textContent = s >= 78 ? 'Elite club: you will start far from the first team. Expect loans.' : s >= 68 ? 'Big club: breaking into the first team will be a fight.' : s >= 58 ? 'Solid club: a realistic place for a 16-year-old to get early minutes.' : 'Smaller club: more chances to play, and to be noticed.';
  };
  const drawAvatar = () => renderAvatarEditor($('setup-avatar'), setupAvatar, (av) => { setupAvatar = { ...av, touched: true }; drawAvatar(); });
  setupAvatar = defaultAvatar($('sel-nationality').value);
  drawAvatar();
  $('sel-nationality').addEventListener('change', () => { if (!setupAvatar?.touched) { setupAvatar = defaultAvatar($('sel-nationality').value); drawAvatar(); } });
  $('sel-country').addEventListener('change', fillLeagues);
  $('sel-league').addEventListener('change', fillClubs);
  $('sel-club').addEventListener('change', hint);
  $('btn-random-club').addEventListener('click', () => { const opts = $('sel-club').options; opts.selectedIndex = Math.floor(Math.random() * opts.length); hint(); });
  fillLeagues();
  $('setup-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const { touched, ...look } = setupAvatar ?? {};
    state = newCareer(world, {
      name: f.get('name').trim(), jerseyName: f.get('jerseyName').trim(), nickname: f.get('nickname').trim(), number: f.get('number'),
      position: f.get('position'), nationality: f.get('nationality'), leagueKey: $('sel-league').value, club: $('sel-club').value, avatar: look,
    });
    const p = state.player, c = p.circle;
    const ally = state.squad?.members.find((m) => m.rel === 'ally');
    const intro = [
      // The opening scene is already on its decision card; don't print it twice.
      state.pending.some((d) => d.scene) ? `${p.jerseyName} is sixteen, and today ${p.club.name} hand him a first-team training kit.` : state.intro.text,
      `Your world, for now: ${p.manager.name} is the manager. ${c.captain} wears the armband${ally ? `, and ${ally.name} is the first one to shake your hand` : ''}. ${c.president} is the club president. At home, ${c.mum} and ${c.dad} have told everyone they know, and your little ${c.sibling.kind} ${c.sibling.name} has told everyone else. Your best friend ${c.bestFriend.name}, ${c.bestFriend.job}, has already asked for tickets.`,
      'Every week brings decisions from different parts of your life, and you can start things yourself too: open People to plan a date, call home, back a teammate or confront one. What you choose in one place ripples into the others. Make time for people, or they drift away.',
    ];
    story = {
      headline: state.intro.headline, dek: 'Day one. Everything starts here.',
      sections: [{ id: 'opening', icon: 'calendar', title: '', paras: intro }], paragraphs: intro,
      socialFeed: [], eventType: 'milestone', isMajorEvent: true, source: 'offline',
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
  renderPlayerNow();
  renderWeek(state, world, story);
  renderMediaNow();
  renderWorldNow();
  if (state.ended) { renderRetirement(state, world); $('btn-new-career').addEventListener('click', newCareerFlow); return; }
  renderDecisions(state, onChoose);
  renderActionsNow();
  renderPlannerNow();
  if (state.interlude) openInterlude(state.interlude);
}

// After anything that doesn't move time: refresh the side panels, not the story.
function refreshSides() {
  renderTopbar(state);
  renderPlayerNow();
  renderWorldNow();
  renderActionsNow();
  renderMediaNow();
}

const renderPlayerNow = () => renderPlayer(state, world, { onAvatar: openAvatar });
const renderMediaNow = () => renderMedia(state, ui.mediaFilter, (f) => { ui.mediaFilter = f; ui.mediaAll = false; renderMediaNow(); }, ui.mediaAll, () => { ui.mediaAll = true; renderMediaNow(); });

function renderWorldNow() {
  renderWorld(state, world, ui.tab, (t) => { ui.tab = t; try { localStorage.setItem('beautifulGrind.tab', t); } catch {} renderWorldNow(); }, {
    people: peopleList(state), squad: teammateRows(state), shopCat: ui.shopCat, reportView: ui.reportView, reportMonth: ui.reportMonth,
    onPerson: (who) => (who === 'teammate-list' ? switchTab('squad') : openPerson(who)), onTeammate: (id) => openPerson('teammate', id),
    onShopCat: (c) => { ui.shopCat = c; renderWorldNow(); },
    onBuy: onBuy, onSell: onSell,
    onReportView: (v) => { ui.reportView = v; renderWorldNow(); }, onReportMonth: (m) => { ui.reportMonth = m; renderWorldNow(); },
  });
}
function switchTab(t) { ui.tab = t; try { localStorage.setItem('beautifulGrind.tab', t); } catch {} renderWorldNow(); $('col-world').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function renderActionsNow() {
  renderActions(state, {
    tab: ui.act, free: freeTimeList(state, world), slots: freeTimeSlots(state), posts: socialOptions(state, world), postsLeft: socialPostsLeft(state), people: peopleList(state),
  }, {
    onTab: (t) => { ui.act = t; renderActionsNow(); },
    onFree: onFreeTime, onPost: onPost, onPerson: (who) => (who === 'teammate-list' ? switchTab('squad') : openPerson(who)),
  });
}

function onChoose(id, choice) {
  chooseDecision(state, id, choice);
  save();
  renderDecisions(state, onChoose);
  renderPlannerNow();
}

function renderPlannerNow() {
  renderPlanner(state, plan, (np) => { plan = np; save(); renderPlannerNow(); }, onPlay, onPlayMonth);
}

// Things that don't move time: a pop-up for 10 seconds, the page stays where it is.
function afterAside(r) {
  if (!r) return;
  if (r.error) { toastError(r.error); return; }
  save();
  toast(state, r);
  refreshSides();
  renderWeekAsides();
}
function renderWeekAsides() {
  // Keep the "Earlier this week" list in the week card up to date without re-rendering the story.
  const card = $('week-card');
  const open = card.querySelector('details[data-fold="asides"]');
  if (open || (state.weekAsides ?? []).length === 1) renderWeek(state, world, story);
}

function onPost(key) { if (!busy) afterAside(socialPost(state, world, key)); }
function onFreeTime(id) { if (!busy) afterAside(freeTime(state, world, id)); }
function onBuy(id, opts) { if (!busy) afterAside(buyItem(state, world, id, opts)); }
function onSell(uid) { if (!busy) afterAside(sellItem(state, world, uid)); }

// ── People ──
function personFor(who, memberId) {
  const p = state.player;
  if (who === 'teammate') {
    const m = state.squad?.members.find((x) => x.id === memberId);
    if (!m) return null;
    const row = teammateRows(state).find((x) => x.id === memberId);
    return { key: m.id === state.squad.captainId ? 'captain' : 'teammate', memberId, name: m.name, role: `${POSITIONS[m.pos].name} · #${m.num}${m.id === state.squad.captainId ? ' · captain' : ''}`, value: m.bond,
      facts: [`${row.age} years old, from ${m.nat}`, `Overall ${m.ovr} · ${m.apps} apps, ${m.goals} goals this season`, ...m.traits.map((t) => TRAITS[t] ?? t), m.rel !== 'neutral' ? `Between you: ${m.rel}` : 'Between you: nothing much yet', row.competitor ? 'He plays your position. One of you starts.' : ''].filter(Boolean) };
  }
  const base = peopleList(state).find((x) => x.key === who);
  if (!base) return null;
  const ages = castAges(state);
  const facts = {
    partner: [p.partner.job ? `Works as ${p.partner.job}` : '', `Together ${Math.max(0, Math.floor((state.week - (p.partner.since ?? state.week)) / 52))} year(s)`, p.partner.style === 'private' ? 'Hates the spotlight' : 'Enjoys the spotlight', p.partner.near === false ? `Lives in ${p.partner.country ?? 'another country'}: long distance` : 'Lives with you or nearby'],
    crush: [p.partner.status !== 'none' ? 'You are not single. Careful.' : 'You are single.', p.crush?.met ? `You met ${p.crush.met}` : ''],
    parents: [`${p.circle.mum} is ${ages.mumAge}, ${p.circle.dad} is ${ages.dadAge}`, p.club && p.club.country !== p.nationality && !state.flags.story?.family_moved_in ? 'They live back home' : 'They live nearby', p.family.monthlySupport ? `You send €${p.family.monthlySupport.toLocaleString('en')} a month` : 'You don\'t send money home yet'],
    sibling: [`${ages.sibAge} years old`],
    bestfriend: [`Works as ${p.circle.bestFriend?.job}`, 'Knew you before any of this'],
    manager: [`Tactical fit ${p.manager.tacticalFit}`, `Your role: ${p.squadRole}`],
    journalist: [`Writes for ${p.circle.journalist?.outlet}`],
    agent: p.agent ? [`Takes ${p.agent.cut}%`, `Quality ${p.agent.quality}/100`] : [],
  }[who] ?? [];
  return { ...base, facts: facts.filter(Boolean) };
}

function openPerson(who, memberId = null) {
  ui.person = { who, memberId };
  drawPerson();
  const dlg = $('person');
  if (!dlg.open) dlg.showModal();
}
function drawPerson() {
  const { who, memberId } = ui.person ?? {};
  const person = personFor(who, memberId);
  if (!person) { $('person').close(); return; }
  const actKey = who === 'teammate' ? (person.key === 'captain' ? 'captain' : 'teammate') : who;
  const actions = actionsFor(state, world, scenarioContext(state, world, null), conditionsMet, fill, actKey === 'captain' ? 'captain' : actKey, memberId);
  renderPerson(state, person, actions, freeTimeSlots(state), (id) => {
    const r = peopleAction(state, world, id, memberId);
    if (!r) { toastError('No free time left this week.'); return; }
    save();
    toast(state, r);
    refreshSides();
    renderWeekAsides();
    drawPerson();
  }, () => $('person').close());
}

// ── Avatar ──
let editAvatar = null;
function openAvatar() {
  editAvatar = { ...state.player.avatar };
  const draw = () => renderAvatarEditor($('avatar-body'), editAvatar, (av) => { editAvatar = av; draw(); });
  draw();
  $('avatar-dlg').showModal();
}
function saveAvatar() {
  state.player.avatar = editAvatar;
  save();
  renderPlayerNow();
  $('avatar-dlg').close();
}

// ── Playing time ──
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
    refreshSides();
    renderInterludeResult(state, r, () => { dlg.close(); playWeek(); }, () => { dlg.close(); renderWeekAsides(); });
  });
  if (!dlg.open) dlg.showModal();
}

function playOne() {
  const res = advanceWeek(state, world, plan);
  const next = narrateOffline(state, world, res);
  journalWeek(state, res, next);
  if (!state.log.length || state.log.at(-1).week !== res.week) state.log.push({ week: res.week, headline: next.headline, type: next.eventType });
  if (state.log.length > 80) state.log.shift();
  return { res, story: next };
}

function playWeek() {
  if (busy) return;
  busy = true;
  try {
    story = playOne().story;
    ui.mediaAll = false;
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    $('planner').insertAdjacentHTML('afterbegin', `<p class="box box-bad">Something went wrong playing this week (${escapeHtml(err.message)}). Your last save is safe: refresh the page and try again.</p>`);
  } finally {
    busy = false; // never leave the Play button locked
  }
}

// "Play month": weeks go by until the month ends. Small decisions are left to instinct (the lowest-risk
// choice); anything big (a transfer, a contract, a sponsor, rehab, a life moment) stops the clock for you.
function onPlayMonth() {
  if (busy) return;
  autoAnswer(state);
  if (pendingUnanswered(state).length) { toastError('A big decision needs you first.'); renderDecisions(state, onChoose); return; }
  busy = true;
  try {
    const month = monthKeyOf(state.week);
    const weeks = [];
    let last = null, stopped = null;
    for (let i = 0; i < 6; i++) {
      last = playOne();
      weeks.push({ date: shortDate(last.res.week), headline: last.story.headline });
      if (state.ended) break;
      if (monthKeyOf(state.week) !== month) break;
      autoAnswer(state);
      const big = state.pending.find((d) => !d.chosen);
      if (big) { stopped = big.headline ?? big.prompt; break; }
    }
    const d = digest(state, month);
    const ms = monthStory(state, d, state.player.jerseyName);
    story = state.ended ? last.story : { ...ms, weeks, dek: stopped ? `${ms.dek} Stopped early: “${stopped}” needs you.` : ms.dek, socialFeed: [], clippings: [], messages: [] };
    ui.mediaAll = false;
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    $('planner').insertAdjacentHTML('afterbegin', `<p class="box box-bad">Something went wrong playing this month (${escapeHtml(err.message)}). Your last save is safe: refresh the page and try again.</p>`);
  } finally {
    busy = false;
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
  initFolds();
  fillSetup();
  $('btn-continue').addEventListener('click', () => { useSave(loadSave()); showGame(); });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-export').addEventListener('click', exportSave);
  $('file-import').addEventListener('change', (ev) => ev.target.files[0] && importSave(ev.target.files[0]));
  $('btn-new').addEventListener('click', newCareerFlow);
  $('btn-edit-look').addEventListener('click', () => { $('settings').close(); openAvatar(); });
  $('avatar-save').addEventListener('click', saveAvatar);
  $('avatar-cancel').addEventListener('click', () => $('avatar-dlg').close());
  // Closing the interlude with Esc keeps it pending; it reopens next time you press Play.
  $('interlude').addEventListener('cancel', () => {});
  const saved = loadSave();
  if (saved?.state && !saved.state.ended) {
    try { useSave(saved); showGame(); } catch (err) { console.error(err); showSetup(); }
  } else showSetup();
})();

