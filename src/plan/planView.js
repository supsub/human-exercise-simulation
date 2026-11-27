import { paintMuscles, flyCamera, jumpCamera, controls, body, pickMuscle, showTooltip, cssColor, volumeColor, cssVolumeColor,
  updateBreathPuffs, updateStressMarkers, onMuscleTap, setScenery, WEEK_THRESHOLDS, DAY_THRESHOLDS } from '../scene.js';
import { MUSCLES, MUSCLE_BY_ID } from '../muscles.js';
import { roleOf } from '../exercises/common.js';
import { EXERCISE_BY_ID } from '../exercises/index.js';
import { createPlayer } from '../player.js';
import { createFigure } from '../figure.js';
import { CATALOG, CATALOG_BY_ID, CATEGORIES, isTime, defaultAmount, amountRange, fmtSets } from './catalog.js';
import { renderCalendar } from './calendarView.js';
import { renderSession, sessionFromWorkout, newSet, dateLabel } from './sessionView.js';
import { DAYS, isoDate, mondayOf, worse, analyzePlan, emptyPlan, emptyWorkout, exampleData, migrateV1, volumeStatus, OPTIMAL_WEEKLY, LETTERS, WORKOUT_COLORS } from './analysis.js';

// Jedyny widok aplikacji: plan treningowy z modelem 3D.
// - treningi (warianty, np. „FBW A”) to bloki ćwiczeń niezależne od dni tygodnia,
// - plan: ile treningów w tygodniu i które warianty – harmonogram układa się sam (każdy wariant tyle samo razy),
// - bez wybranego ćwiczenia model pokazuje mapę obciążenia tygodnia albo jednego treningu,
// - wybrane ćwiczenie otwiera szczegóły po prawej: animacja, typowe błędy, figura, dodanie do wybranego treningu.

const STORAGE_KEY = 'hes.data.v2';       // plany i treningi (wspólne dla kart tej przeglądarki)
const CURRENT_KEY = 'hes.currentId';     // wybrany plan – osobno, żeby zmiana wyboru nie była „zmianą danych”
const STORAGE_V1 = 'hes.plans.v1';
const PLAN_CAMERA = [[0, 1.25, 3.4], [0, 0.95, 0]];
const $ = (id) => document.getElementById(id);
const ui = {
  select: $('plan-select'), days: $('plan-days'), schedule: $('plan-schedule'), workoutNew: $('workout-new'),
  newBtn: $('plan-new'), renameBtn: $('plan-rename'), deleteBtn: $('plan-delete'), createBtn: $('plan-create'),
  calendar: $('calendar-view'), leftSwitch: $('left-switch'),
  focus: $('plan-focus'), legend: $('plan-legend'), score: $('plan-score'), groups: $('plan-groups'), warnings: $('plan-warnings'), recs: $('plan-recs'),
  panel: $('picker'), panelTitle: $('picker-title'), panelClose: $('picker-close'),
  browse: $('picker-browse'), search: $('picker-search'), cats: $('picker-cats'), list: $('picker-list'),
  detail: $('picker-detail'), dTop: $('d-top'), dInfo: $('d-info'), dTech: $('d-technique'), dMuscles: $('d-muscles'),
  exAction: $('ex-action'), bar: $('player-bar'), play: $('play'), speed: $('speed'), pbName: $('pb-name'), pbClose: $('pb-close'),
};
// Telefon: wybór ćwiczenia z planu nie zasłania planu – model ćwiczy, a opis / błędy / mięśnie
// otwierają się przyciskami na pasku pod modelem (arkusz z jedną sekcją, bez długiego przewijania)
const phone = () => matchMedia('(max-width: 760px)').matches;

const player = createPlayer(body.resolvePose);
const figure = createFigure($('figure'));

let store = load();
let analysis = null;
let focusId = null;         // wybrany trening (mapa jego mięśni na modelu, cel przycisku "Dodaj do")
let selected = null;        // { ex: pozycja katalogu, anim: definicja animacji | null, from: 'plan' | 'list' }
let browseId = null;        // trening, dla którego otwarto listę ćwiczeń (cel szybkiego dodawania)
let browseMuscle = null;    // lista „ćwiczenia na mięsień” (kliknięty mięsień na modelu)
let browseCat = null;
let browseSession = null;   // lista ćwiczeń otwarta z zapisu treningu (dodawanie do tego dnia, nie do planu)
let openSessionId = null;   // otwarty zapis treningu (w widoku kalendarza)
const openSession = () => (openSessionId && store.sessions?.find((x) => x.id === openSessionId)) || null;
let listHover = null;       // ćwiczenie wskazane na liście (podgląd mięśni)
let muscleHover = null;     // mięsień wskazany w panelu
let showNotes = localStorage.getItem('hes.mistakeNotes') !== '0';
let display = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const cur = localStorage.getItem(CURRENT_KEY) ?? s?.currentId;
    if (s && s.plans?.length) return { plans: s.plans, workouts: s.workouts, sessions: s.sessions ?? [], currentId: s.plans.some((p) => p.id === cur) ? cur : s.plans[0].id };
  } catch {}
  // dane w starym formacie (ćwiczenia przypisane do dni) – przenosimy jako treningi
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_V1));
    if (old?.plans?.length) {
      const m = migrateV1(old);
      if (m.workouts.length) return { ...m, currentId: m.plans[0].id };
    }
  } catch {}
  // czysty start: bez planów i treningów (przykładowe tylko do testów: ?examples)
  if (new URLSearchParams(location.search).has('examples')) { const d = exampleData(); return { ...d, currentId: d.plans[0].id }; }
  return { plans: [], workouts: [], sessions: [], currentId: null };
}
const saveListeners = [];
// Tryb gościa (niezalogowany): domyślny plan „Mój plan” z pustym treningiem – można go od razu wypełniać
// (zapis w tej przeglądarce, po zalogowaniu trafia na konto). Kolejne plany i usuwanie planu – po zalogowaniu (onNeedLogin, src/sync.js).
let guest = false;
const needLogin = [];
export const onNeedLogin = (fn) => needLogin.push(fn);
export const isGuest = () => guest;
function guestBlock() {
  if (!guest) return false;
  for (const fn of needLogin) fn();
  return true;
}
export function setGuest(on) {
  if (guest === on && (!on || store.plans.length)) return;
  guest = on;
  if (on && !store.plans.length) {
    const w = emptyWorkout('Trening A'), p = emptyPlan('Mój plan', [w.id]);
    store = { plans: [p], workouts: [w], sessions: store.sessions ?? [], currentId: p.id };
    focusId = null;
  }
  if (started) render();
}
const contentJSON = () => JSON.stringify({ plans: store.plans, workouts: store.workouts, sessions: store.sessions ?? [] });
function save() {
  if (store.currentId) localStorage.setItem(CURRENT_KEY, store.currentId);
  const json = contentJSON();
  if (json === localStorage.getItem(STORAGE_KEY)) return;
  localStorage.setItem(STORAGE_KEY, json);
  for (const fn of saveListeners) fn(store);
}
// Zmiana z innej karty tej przeglądarki (zdarzenie storage): przejmujemy plany bez ponownego zapisu –
// inaczej karta ze starym stanem uznałaby go za „niewysłane zmiany” i nadpisała nowszą zmianę na koncie.
export function applyExternal(data) {
  if (!data?.plans) return;
  const cur = store.currentId;
  store = { plans: data.plans, workouts: data.workouts, sessions: data.sessions ?? [], currentId: data.plans.some((p) => p.id === cur) ? cur : data.plans[0]?.id ?? null };
  if (focusId && !workout(focusId)) focusId = null;
  if (started) render();
}
// Synchronizacja z kontem (src/sync.js): odczyt, podmiana danych i powiadomienie o każdej zmianie
export const getData = () => store;
// Czy użytkownik sam usunął ostatni plan (src/sync.js nie wysyła na konto pustego stanu w żadnym innym przypadku)
let userEmptied = false;
export const emptiedByUser = () => userEmptied;
export function setData(data) {
  userEmptied = false;
  const cur = store.currentId;
  store = { plans: data.plans, workouts: data.workouts, sessions: data.sessions ?? [], currentId: data.plans.some((p) => p.id === cur) ? cur : data.plans[0]?.id ?? null };
  localStorage.setItem(STORAGE_KEY, contentJSON());
  if (focusId && !workout(focusId)) focusId = null;
  render();
}
export const onSave = (fn) => saveListeners.push(fn);
const plan = () => store.plans.find((p) => p.id === store.currentId) ?? store.plans[0];
const workout = (id) => store.workouts.find((w) => w.id === id);
const wIndex = (id) => store.workouts.findIndex((w) => w.id === id);
const letter = (id) => LETTERS[wIndex(id)] ?? '?';
const color = (id) => WORKOUT_COLORS[wIndex(id) % WORKOUT_COLORS.length];
const badge = (id) => `<i class="wbadge" style="--c:${color(id)}">${letter(id)}</i>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clampInt = (v, a, b) => Math.min(b, Math.max(a, parseInt(v, 10) || a));
const setsOf = (w) => w.items.reduce((s, it) => s + (it.sets || 0), 0);
// mięśnie, które ćwiczenie mocno angażuje, a w planie dostają za mało pracy
const helpsOf = (ex) => Object.entries(ex.muscles).filter(([id, w]) => w >= 0.5 && analysis.weekly[id] < 3).map(([id]) => id);

// Telefon: zakładki Plan/Analiza tylko wtedy, gdy plan jest widoczny. Panel (lista ćwiczeń, ćwiczenie z listy,
// rozwinięta sekcja Opis/Błędy/Mięśnie) zasłania plan – wtedy zakładki nic by nie zmieniły, więc znikają
// (przy ćwiczeniu z listy ich miejsce zajmuje pasek „Dodaj do”).
function syncTabs() {
  document.body.classList.toggle('ex-open', !ui.panel.hidden);
  document.body.classList.toggle('ex-add', selected?.from === 'list' && !!addTarget());
}

// ---------- Render ----------
function render() {
  const p = plan();
  document.body.classList.toggle('no-plan', !p);
  document.body.classList.toggle('guest', guest);
  if (!p) {                       // brak planu: tylko zachęta „Utwórz plan”, model bez mapy obciążenia
    focusId = null;
    ui.select.innerHTML = '';
    analysis = analyzePlan(emptyPlan(), []);
    save();
    return;
  }
  ui.select.innerHTML = store.plans.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  if (focusId && !workout(focusId)) focusId = null;
  analysis = analyzePlan(p, store.workouts);
  renderSchedule(p);
  renderWorkouts(p);
  if (view === 'calendar') {
    if (!p.start) p.start = isoDate(mondayOf(new Date()));   // początek cyklu planu: ten tydzień (zapisze się z planem)
    const ses = openSession();
    if (ses) renderSession(ui.calendar, { s: ses, badge,
      onChange: render,
      onClose: () => { openSessionId = null; render(); },
      onAdd: () => openBrowseSession(ses),
      onOpenExercise: (ex) => selectExercise(ex, 'plan'),
      onDelete: () => { store.sessions = store.sessions.filter((x) => x !== ses); openSessionId = null; render(); } });
    else renderCalendar(ui.calendar, { plan: p, schedule: analysis.schedule, workout, color, letter,
      sessionOn: (iso) => (store.sessions ?? []).find((x) => x.date === iso),
      onPick: (iso, wid) => {
        focusId = wid ?? null; render();
        if (phone()) setTimeout(() => ui.calendar.querySelector('.cal-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);   // szczegóły dnia pod kalendarzem
      },
      onStart: (iso, wid) => {   // trening dnia: kopia szablonu z planu (z ostatnio użytymi ciężarami)
        const sesNew = sessionFromWorkout(workout(wid), p, iso, store.sessions ?? []);
        (store.sessions ??= []).push(sesNew);
        openSessionId = sesNew.id; focusId = wid ?? null; render();
      },
      onOpen: (id) => { openSessionId = id; focusId = store.sessions.find((x) => x.id === id)?.workoutId ?? null; if (focusId && !workout(focusId)) focusId = null; render(); } });
  }
  renderAnalysis(p);
  if (selected) renderDetailTop();
  // telefon: przy otwartym ćwiczeniu zakładki Plan/Analiza znikają (pasek dodawania albo nic)
  syncTabs();
  if (!ui.browse.hidden && !ui.panel.hidden) renderList();
  save();
}

// ---------- Harmonogram: treningów w tygodniu, warianty, kalendarz cyklu ----------
function renderSchedule(p) {
  const sch = analysis.schedule;
  const inPlan = p.variants.filter((id) => workout(id));
  const cell = (id) => id
    ? `<button class="cal-cell on${focusId === id ? ' focused' : ''}" data-id="${id}" style="--c:${color(id)}" title="${esc(workout(id).name)}">${letter(id)}</button>`
    : '<span class="cal-cell"></span>';
  ui.schedule.innerHTML = `
    <div class="sch-row">
      <span>Treningów w tygodniu</span>
      <div class="stepper"><button data-d="-1" title="Mniej">−</button><b>${sch.n}</b><button data-d="1" title="Więcej">+</button></div>
    </div>
    <div class="cal">
      <span></span>${DAYS.map((d, i) => `<button class="cal-day${sch.dayIdx.includes(i) ? ' train' : ''}" data-day="${d.id}" title="Kliknij, aby ręcznie włączyć/wyłączyć ten dzień">${d.short}</button>`).join('')}
      ${sch.calendar.map((week, w) => `<span class="cal-week">${sch.weeks > 1 ? `Tydz. ${w + 1}` : 'Tydzień'}</span>${week.map(cell).join('')}`).join('')}
    </div>
    <div class="sch-info">${inPlan.length
      ? `${sch.weeks > 1 ? `Cykl ${sch.weeks} tyg. – ` : ''}każdy wariant ${sch.perVariant}× ${sch.weeks > 1 ? 'w cyklu' : 'w tygodniu'} · dni ${sch.auto ? 'dobrane automatycznie' : 'wybrane ręcznie <button class="link small" id="sch-auto">↺ dobierz automatycznie</button>'}`
      : 'Zaznacz poniżej treningi, które mają wejść do planu.'}</div>`;
  ui.schedule.querySelectorAll('.stepper button').forEach((b) => (b.onclick = () => {
    p.sessions = Math.min(7, Math.max(1, sch.n + +b.dataset.d));
    p.days = null;                 // zmiana liczby treningów = nowy dobór dni
    render();
  }));
  ui.schedule.querySelectorAll('.cal-day').forEach((b) => (b.onclick = () => {
    const days = new Set(p.days ?? sch.dayIdx.map((i) => DAYS[i].id));
    if (days.has(b.dataset.day)) { if (days.size > 1) days.delete(b.dataset.day); } else days.add(b.dataset.day);
    p.days = DAYS.map((d) => d.id).filter((id) => days.has(id));
    p.sessions = p.days.length;
    render();
  }));
  ui.schedule.querySelector('#sch-auto')?.addEventListener('click', () => { p.days = null; render(); });
  ui.schedule.querySelectorAll('.cal-cell.on').forEach((b) => (b.onclick = () => toggleFocus(b.dataset.id)));
}

function toggleFocus(id) {
  focusId = selected ? id : focusId === id ? null : id;
  if (!selected && !ui.panel.hidden && !ui.browse.hidden) closePanel(); else render();
}

// ---------- Treningi (warianty) ----------
function renderWorkouts(p) {
  ui.days.innerHTML = '';
  for (const w of store.workouts) {
    const on = p.variants.includes(w.id);
    const card = document.createElement('div');
    card.className = 'day-card' + (on ? ' active' : '') + (focusId === w.id ? ' focused' : '');
    const total = setsOf(w);
    card.innerHTML = `
      <div class="day-head">
        <label class="switch" title="${on ? 'W planie – kliknij, aby wyłączyć' : 'Poza planem – kliknij, aby dodać do planu'}"><input type="checkbox" ${on ? 'checked' : ''}><span></span></label>
        ${badge(w.id)}
        <button class="day-name">${esc(w.name)}</button>
        <span class="day-meta">${w.items.length ? `${w.items.length} ćw. · ${total} serii` : 'pusty'}</span>
        <button class="icon w-rename" title="Zmień nazwę">✎</button>
        <button class="icon w-del" title="Usuń trening">🗑</button>
      </div>
      <div class="day-items"></div>`;
    card.querySelector('input').onchange = (e) => {
      p.variants = e.target.checked ? [...p.variants, w.id] : p.variants.filter((id) => id !== w.id);
      render();
    };
    card.querySelector('.switch').addEventListener('click', (e) => e.stopPropagation());
    card.querySelector('.w-rename').onclick = (e) => {
      e.stopPropagation();
      const name = prompt('Nazwa treningu:', w.name);
      if (name?.trim()) { w.name = name.trim(); render(); }
    };
    card.querySelector('.w-del').onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Usunąć trening „${w.name}”? Zniknie ze wszystkich planów.`)) return;
      store.workouts = store.workouts.filter((x) => x !== w);
      for (const pl of store.plans) pl.variants = pl.variants.filter((id) => id !== w.id);
      render();
    };
    card.title = selected ? `Wybierz „${w.name}” – potem „Dodaj do”` : `Pokaż na modelu mięśnie z treningu „${w.name}”`;
    card.onclick = () => toggleFocus(w.id);
    const list = card.querySelector('.day-items');
    w.items.forEach((it, idx) => {
      const ex = CATALOG_BY_ID[it.exId];
      if (!ex) return;
      const row = document.createElement('div');
      row.className = 'item' + (selected?.ex === ex ? ' selected' : '');
      row.dataset.ex = ex.id;
      row.title = 'Kliknij, aby zobaczyć ćwiczenie';
      row.innerHTML = `
        <span class="item-name">${esc(ex.name)}</span>
        <input type="number" min="1" max="10" value="${it.sets}" title="Serie"> <span class="x">×</span>
        <input type="number" min="${amountRange(ex).min}" max="${amountRange(ex).max}" step="${amountRange(ex).step}" value="${it.reps}" title="${isTime(ex) ? 'Sekundy na serię' : ex.repsLabel ? `Ilość (${ex.repsLabel})` : 'Powtórzenia'}"><span class="x unit">${isTime(ex) ? 's' : ''}</span>
        <button class="icon del" title="Usuń z treningu">✕</button>`;
      const [setsIn, repsIn] = row.querySelectorAll('input');
      setsIn.onchange = () => { it.sets = clampInt(setsIn.value, 1, 10); render(); };
      repsIn.onchange = () => { it.reps = clampInt(repsIn.value, amountRange(ex).min, amountRange(ex).max); render(); };
      row.querySelectorAll('input, .del').forEach((el) => el.addEventListener('click', (e) => e.stopPropagation()));
      row.querySelector('.del').onclick = (e) => { e.stopPropagation(); w.items.splice(idx, 1); render(); };
      row.onclick = (e) => { e.stopPropagation(); selected?.ex === ex ? closePanel() : selectExercise(ex, 'plan'); };
      list.appendChild(row);
    });
    const add = document.createElement('button');
    add.className = 'add-ex';
    add.textContent = '+ Dodaj ćwiczenie';
    add.onclick = (e) => { e.stopPropagation(); openBrowse(w.id); };
    list.appendChild(add);
    ui.days.appendChild(card);
  }
  if (!store.workouts.length) ui.days.innerHTML = '<div class="muted small">Brak treningów. Utwórz pierwszy: „+ Nowy trening”.</div>';
}

function renderAnalysis(p) {
  const a = analysis;
  ui.focus.innerHTML = focusId
    ? `Pokazuję: ${badge(focusId)} <b>${esc(workout(focusId).name)}</b> <button id="focus-week" class="link">pokaż cały tydzień</button>`
    : `Pokazuję: <b>cały tydzień</b>${analysis.schedule.weeks > 1 ? ' (średnio w cyklu)' : ''} <span class="muted">– kliknij trening, aby zobaczyć jego mięśnie</span>`;
  ui.focus.querySelector('#focus-week')?.addEventListener('click', () => { focusId = null; if (!ui.panel.hidden) closePanel(); else render(); });

  // Wybrany trening: liczymy tylko ten jeden trening (serie w jednej sesji), a nie cały tydzień
  const per = focusId ? a.perWorkout[focusId] : null;
  const worked = per ? MUSCLES.filter((m) => per[m.id] >= 1).length : a.trained;
  const pct = Math.round((worked / MUSCLES.length) * 100);
  ui.score.innerHTML = per
    ? `<div class="score-ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div><b>${worked} z ${MUSCLES.length}</b> mięśni pracuje w tym treningu<br>
    <span class="muted">${MUSCLES.filter((m) => per[m.id] >= 3).length} dostaje solidną dawkę (≥ 3 serie)</span></div>`
    : `<div class="score-ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div><b>${a.trained} z ${MUSCLES.length}</b> mięśni dostaje bodziec (≥ 3 serie/tydz.)<br>
    <span class="muted">${a.optimal} w zakresie optymalnym (8–20 serii)</span></div>`;

  // partie: tydzień (strefa 8–20 serii) albo jeden trening (strefa 2–6 serii w sesji)
  const SESSION_MAX = 8;
  const sessionStatus = (x) => (x < 1 ? { id: 'low', label: 'prawie nic' } : x < 2 ? { id: 'min', label: 'lekko' }
    : x <= 6 ? { id: 'ok', label: 'solidnie' } : { id: 'high', label: 'bardzo dużo' });
  const groups = per
    ? a.groups.map((g) => {
        const sets = g.members.reduce((t, id) => t + per[id], 0) / g.members.length;
        const weakId = g.members.reduce((x, y) => (per[y] < per[x] ? y : x));
        const avg = sessionStatus(sets);
        return { ...g, sets, avg, status: worse(sessionStatus(per[weakId]), avg), weak: { id: weakId, sets: per[weakId] } };
      })
    : a.groups;
  document.getElementById('groups-title').innerHTML = per
    ? 'Partie w tym treningu <span class="muted small">(efektywne serie)</span>'
    : 'Tygodniowa objętość wg partii <span class="muted small">(efektywne serie)</span>';
  ui.groups.innerHTML = groups.map((g) => {
    const w = Math.min(100, (g.sets / (per ? SESSION_MAX : OPTIMAL_WEEKLY)) * 100);
    return `<div class="g-row">
      <span class="g-name">${g.group}</span>
      <div class="g-bar"><div class="g-zone"${per ? ' style="left:25%;width:50%"' : ''}></div><div class="g-fill" style="width:${w}%;background:${cssVolumeColor(per ? g.sets * 2.5 : g.sets)}"></div></div>
      <span class="g-val">${g.sets.toFixed(1)}</span>
      <span class="g-status ${g.status.id}">${g.status.label}</span>
      ${g.status.id !== g.avg.id
        ? `<span class="g-weak">najsłabiej: ${MUSCLE_BY_ID[g.weak.id].name} – ${g.weak.sets.toFixed(1)}</span>` : ''}
    </div>`;
  }).join('');

  ui.warnings.innerHTML = a.warnings.length ? a.warnings.map((w, i) => `<div class="warn ${w.level}">${w.level === 'warn' ? '⚠' : w.level === 'ok' ? '✓' : 'ℹ'} ${w.text}
      ${w.fix?.length ? `<div class="fixes">${w.fix.map((f, j) => `<button class="fix" data-w="${i}" data-f="${j}">${fixLabel(f)}</button>`).join('')}</div>` : ''}</div>`).join('')
    : '<div class="warn info">ℹ Brak poważnych uwag. Sprawdź partie oznaczone jako „za mało” i rekomendacje poniżej.</div>';
  ui.warnings.querySelectorAll('.fix').forEach((b) => (b.onclick = () => applyFix(a.warnings[+b.dataset.w].fix[+b.dataset.f], p)));

  ui.recs.innerHTML = a.recommendations.length
    ? a.recommendations.map((r, i) => {
        const ex = CATALOG_BY_ID[r.exId];
        return `<div class="rec">
          <div><button class="link rec-name" data-i="${i}" title="Zobacz ćwiczenie">${ex.name}</button> <span class="muted">· ${ex.equipment}</span><br>
          <small>${r.tier === 'opt' ? 'Do optimum (8+ serii/tydz.)' : 'Uzupełnia'}: ${r.fixes.map((id) => MUSCLE_BY_ID[id].name).join(', ')}</small></div>
          ${r.workout ? `<button class="rec-add" data-i="${i}" title="Dodaj do: ${esc(workout(r.workout).name)}">+ ${badge(r.workout)}</button>` : ''}
        </div>`;
      }).join('')
    : '<div class="muted">Brak – wszystkie mięśnie są w zakresie optymalnym (8+ serii tygodniowo).</div>';
  ui.recs.querySelectorAll('.rec-name').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    if (r.workout) focusId = r.workout;
    selectExercise(CATALOG_BY_ID[r.exId], 'plan');
  }));
  ui.recs.querySelectorAll('.rec-add').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    addToWorkout(CATALOG_BY_ID[r.exId], r.workout);
  }));
}

// ---------- Propozycje do uwag (analysis.js: fix) – jedno kliknięcie naprawia uwagę ----------
const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
function fixLabel(f) {
  if (f.kind === 'add') return `+ ${esc(CATALOG_BY_ID[f.exId].name)} → ${badge(f.workout)}`;
  if (f.kind === 'sessions') return `Ustaw ${f.value} ${plural(f.value, 'trening', 'treningi', 'treningów')} w tygodniu`;
  if (f.kind === 'autoDays') return '↺ Dobierz dni z przerwami';
  if (f.kind === 'sets') return `− ${esc(f.label)}`;
  if (f.kind === 'browse') return '+ Dodaj ćwiczenia';
  if (f.kind === 'newWorkout') return '+ Nowy trening';
  return '';
}
function applyFix(f, p) {
  if (f.kind === 'add') return addToWorkout(CATALOG_BY_ID[f.exId], f.workout);
  if (f.kind === 'sessions') { p.sessions = f.value; p.days = null; }
  else if (f.kind === 'autoDays') p.days = null;
  else if (f.kind === 'sets') {
    for (const [wId, exId] of f.items) { const it = workout(wId)?.items.find((x) => x.exId === exId); if (it && it.sets > 2) it.sets -= 1; }
  } else if (f.kind === 'browse') return openBrowse(f.workout);
  else if (f.kind === 'newWorkout') return ui.workoutNew.onclick();
  render();
}

// ---------- Panel: lista ćwiczeń ----------
const listTitle = () => (browseMuscle ? `Ćwiczenia na: ${MUSCLE_BY_ID[browseMuscle].name}` : browseSession ? `Dodaj do treningu – ${dateLabel(browseSession.date)}`
  : `Dodaj ćwiczenie – ${workout(browseId).name}`);
function openBrowseSession(ses) {
  browseMuscle = null; browseId = null; browseSession = ses;
  deselect();
  ui.search.value = '';
  ui.panel.hidden = false; ui.browse.hidden = false; ui.detail.hidden = true;
  ui.panelTitle.textContent = listTitle();
  render();
  ui.search.focus();
}
function addToSession(ex) {
  const ses = browseSession;
  if (!ses || ses.items.some((it) => it.exId === ex.id)) return;
  ses.items.push({ exId: ex.id, sets: Array.from({ length: 3 }, () => newSet(ex, store.sessions, ses.date)) });
  ses.upd = Date.now();
  closePanel();   // z powrotem do treningu
}
// Kliknięty mięsień: ćwiczenia od najmocniej go angażujących; szybkie dodawanie do wybranego treningu (albo pierwszego w planie)
function openMuscle(id) {
  browseMuscle = id; browseSession = null;
  browseId = (focusId && workout(focusId) ? focusId : plan()?.variants.find((w) => workout(w))) ?? null;
  deselect();
  ui.search.value = '';
  browseCat = null;
  ui.panel.hidden = false;
  ui.browse.hidden = false;
  ui.detail.hidden = true;
  ui.panelTitle.textContent = listTitle();
  render();
}
onMuscleTap((id) => { if (!selected) openMuscle(id); });
function openBrowse(id) {
  browseMuscle = null; browseSession = null;
  browseId = id;
  focusId = id;
  deselect();
  ui.search.value = '';
  ui.panel.hidden = false;
  ui.browse.hidden = false;
  ui.detail.hidden = true;
  ui.panelTitle.textContent = `Dodaj ćwiczenie – ${workout(id).name}`;
  flyCamera(...PLAN_CAMERA);
  render();
  ui.search.focus();
}
function backToList() {
  deselect();
  ui.browse.hidden = false;
  ui.detail.hidden = true;
  ui.panelTitle.textContent = listTitle();
  flyCamera(...PLAN_CAMERA);
  render();
}
function closePanel() {
  ui.panel.hidden = true;
  browseSession = null;
  listHover = null;
  deselect();
  flyCamera(...PLAN_CAMERA);
  render();
}

ui.cats.innerHTML = ['Wszystkie', ...CATEGORIES].map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join('');
ui.cats.querySelectorAll('button').forEach((b) => (b.onclick = () => { browseCat = b.dataset.c === 'Wszystkie' ? null : b.dataset.c; renderList(); }));
ui.search.oninput = renderList;
ui.panelClose.onclick = () => (phone() && selected?.from === 'plan' ? closeSheet() : closePanel());

function renderList() {
  const q = ui.search.value.toLowerCase().trim();
  ui.cats.querySelectorAll('button').forEach((b) => b.classList.toggle('active', (b.dataset.c === 'Wszystkie' && !browseCat) || b.dataset.c === browseCat));
  const mw = (ex) => (browseMuscle ? ex.muscles[browseMuscle] ?? 0 : 0);
  const items = CATALOG.filter((ex) => (!browseMuscle || mw(ex) >= 0.25) && (!browseCat || ex.category === browseCat) &&
    (!q || ex.name.toLowerCase().includes(q) || ex.tags?.includes(q) || Object.keys(ex.muscles).some((id) => MUSCLE_BY_ID[id].name.toLowerCase().includes(q))));
  // uzupełniające braki na górze, ćwiczenia już obecne w tym dniu na końcu (bez możliwości dodania)
  // lista na mięsień: od najmocniej go angażujących; zwykła: uzupełniające braki na górze, obecne w treningu na końcu
  items.sort((a, b) => mw(b) - mw(a) || !!inWorkout(a.id, browseId) - !!inWorkout(b.id, browseId) || helpsOf(b).length - helpsOf(a).length);
  ui.list.innerHTML = items.map((ex) => {
    const helps = helpsOf(ex).length;
    const tags = Object.entries(ex.muscles).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, w]) => `<span class="mtag" style="border-color:${cssColor(w * 0.9)}">${MUSCLE_BY_ID[id].name}</span>`).join('');
    const here = browseSession ? browseSession.items.find((it) => it.exId === ex.id) : inWorkout(ex.id, browseId);
    return `<div class="pick${here ? ' present' : ''}" data-id="${ex.id}" tabindex="0">
      <div class="pick-body">
        <div class="pick-head"><b>${ex.name}</b></div>
        <div class="pick-meta">${browseMuscle ? `<span class="mrole" style="--c:${cssColor(mw(ex) * 0.9)}">${mw(ex) >= 0.75 ? 'główny' : mw(ex) >= 0.5 ? 'pomocniczy' : 'lekko'}</span> ` : ''}${ex.category} · ${ex.equipment}${helps ? ` <span class="helps">uzupełnia ${helps} ${helps === 1 ? 'brak' : 'braki'}</span>` : ''}</div><div class="mtags">${tags}</div>
      </div>
      ${here ? `<span class="present-tag">już w tym treningu${browseSession ? '' : `<br>${fmtSets(ex, here)}`}</span>`
        : browseSession ? `<button class="quick-add" title="Dodaj do treningu z dnia ${dateLabel(browseSession.date)} (3 serie)">+</button>`
        : !browseId ? ''
        : `<button class="quick-add" title="Dodaj od razu do: ${esc(workout(browseId).name)} (${fmtSets(ex, { sets: 3, reps: defaultAmount(ex) })})">+</button>`}
    </div>`;
  }).join('') || '<div class="muted">Brak ćwiczeń pasujących do wyszukiwania.</div>';
  ui.list.querySelectorAll('.pick').forEach((el) => {
    const ex = CATALOG_BY_ID[el.dataset.id];
    el.onclick = () => selectExercise(ex, 'list');
    el.onkeydown = (e) => { if (e.key === 'Enter') selectExercise(ex, 'list'); };
    el.querySelector('.quick-add')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (browseSession) addToSession(ex); else addToWorkout(ex, browseId);
    });
    el.onmouseenter = () => (listHover = ex);
    el.onmouseleave = () => (listHover = null);
  });
}

// Jedno ćwiczenie raz w danym treningu – więcej pracy = więcej serii, nie drugi wpis
const inWorkout = (exId, id) => workout(id)?.items.find((it) => it.exId === exId);
function addToWorkout(ex, id) {
  const w = workout(id);
  if (!w || inWorkout(ex.id, id)) return;
  w.items.push({ exId: ex.id, sets: 3, reps: defaultAmount(ex) });
  const p = plan();
  if (!p.variants.includes(id)) p.variants.push(id);
  render();
}

// ---------- Panel: szczegóły wybranego ćwiczenia ----------
// Panele planu są szerokie – kamera trochę dalej od celu niż w definicji ćwiczenia
function cameraFor(anim, pos = anim.cameraPosition) {
  const tg = anim.cameraTarget ?? [0, 0.85, 0];
  return [pos.map((v, i) => tg[i] + (v - tg[i]) * 1.3), tg];
}

function selectExercise(ex, from, { t = null, mistake = null } = {}) {
  const anim = ex.animated ? EXERCISE_BY_ID[ex.animated] : null;
  updateStressMarkers([], 0, 0);
  selected = { ex, anim, from };
  listHover = null;
  muscleHover = null;
  player.state.frozen = t !== null;
  player.setExercise(anim, t);
  // telefon + plan: plan zostaje na ekranie, szczegóły dopiero po kliknięciu przycisku na pasku
  ui.panel.hidden = phone() && from === 'plan';
  ui.browse.hidden = true;
  ui.detail.hidden = false;
  ui.detail.classList.toggle('from-plan', from === 'plan');
  showSection('info');
  ui.panelTitle.textContent = from === 'list' ? listTitle() : phone() ? ex.name : 'Ćwiczenie';
  ui.pbName.textContent = ex.name;
  controls.autoRotate = !anim; // bez animacji model się obraca, żeby było widać też mięśnie z tyłu
  if (anim) (t !== null ? jumpCamera : flyCamera)(...cameraFor(anim));
  else flyCamera(...PLAN_CAMERA);
  ui.bar.hidden = !anim && !phone();
  ui.bar.classList.toggle('static', !anim);
  setScenery(anim?.scenery);
  renderTechnique();
  if (mistake && anim) {
    const m = anim.mistakes.find((x) => x.id === mistake);
    if (m) setMistake(m, true);
  }
  render();
}
function deselect() {
  if (!selected) return;
  selected = null;
  player.state.frozen = false;
  player.setExercise(null);
  ui.bar.hidden = true;
  ui.detail.hidden = true;
  setScenery([]);
  updateStressMarkers([], 0, 0);
}

const addTarget = () => (browseSession ? null : focusId ?? (selected?.from === 'list' ? browseId : null));   // przy treningu dnia: tylko „+” na liście
function renderDetailTop() {
  const { ex, from } = selected;
  const p = plan();
  // trening docelowy: wybrany w planie, a przy liście „ćwiczenia na mięsień” – ten, do którego dodaje lista
  const focusId = addTarget();
  const inPlan = store.workouts.flatMap((w) => w.items.filter((it) => it.exId === ex.id).map((it) => `${badge(w.id)} ${esc(w.name)} ${fmtSets(ex, it)}`));
  let impact = '';
  if (focusId) {
    const trialW = store.workouts.map((w) => (w.id === focusId ? { ...w, items: [...w.items, { exId: ex.id, sets: 3, reps: defaultAmount(ex) }] } : w));
    const trialP = p.variants.includes(focusId) ? p : { ...p, variants: [...p.variants, focusId] };
    const after = analyzePlan(trialP, trialW);
    impact = after.trained > analysis.trained
      ? `Po dodaniu: <b>${analysis.trained} → ${after.trained}</b> mięśni z wystarczającym bodźcem.`
      : helpsOf(ex).length ? 'Wzmocni słabiej trenowane partie.' : 'Te mięśnie już są trenowane w planie.';
  }
  ui.dTop.innerHTML = `
    ${from === 'list' ? '<button class="link back">← wróć do listy</button>' : ''}
    <div class="d-title"><h2>${esc(ex.name)}</h2>
      <div class="muted small">${ex.category} · ${ex.equipment}${selected.anim ? '' : ' · bez animacji – model pokazuje mapę mięśni'}</div></div>
    <div class="d-add">
      ${focusId
        ? inWorkout(ex.id, focusId)
          ? `<div class="d-impact">✓ Już jest w: <b>${esc(workout(focusId).name)}</b> (${fmtSets(ex, inWorkout(ex.id, focusId))}). Chcesz więcej pracy? Zwiększ liczbę serii.</div>`
          : `<button class="d-add-btn">+ Dodaj do: ${esc(workout(focusId).name)}</button><div class="d-impact">${impact}</div>`
        : '<div class="d-impact">Aby dodać, kliknij trening w planie.</div>'}
      ${inPlan.length ? `<div class="d-impact muted">Już w treningach: ${inPlan.join(', ')}</div>` : ''}
    </div>`;
  // telefon: dodawanie na stałym pasku na dole (zamiast powtarzać je nad każdą sekcją)
  const here = focusId && inWorkout(ex.id, focusId);
  ui.exAction.innerHTML = !focusId ? ''
    : here ? `<div class="ex-done">✓ W treningu <b>${esc(workout(focusId).name)}</b> · ${fmtSets(ex, here)}</div>`
    : `<div class="ex-impact">${impact}</div><button class="d-add-btn">+ Dodaj do: ${esc(workout(focusId).name)}</button>`;
  ui.dInfo.innerHTML = `<p class="d-text">${ex.how}</p><p class="d-tip">💡 ${ex.tip}</p>`;
  ui.dTop.querySelector('.back')?.addEventListener('click', backToList);
  for (const b of [ui.dTop, ui.exAction]) b.querySelector('.d-add-btn')?.addEventListener('click', () => addToWorkout(ex, focusId));
  renderMuscleSummary();
}

// Krótkie podsumowanie pod figurą zamiast długiej listy wszystkich mięśni
function renderMuscleSummary() {
  const { ex, anim } = selected;
  const peak = anim ? (player.state.peakBad ?? player.state.peakGood) : null;
  const level = (id) => (anim ? peak[id] : (ex.muscles[id] ?? 0) * 0.6);
  const main = MUSCLES.filter((m) => roleOf(level(m.id))?.id === 'main').sort((a, b) => level(b.id) - level(a.id));
  const fixes = helpsOf(ex);
  const chip = (m, cls = '') => `<span class="role-item ${cls}" data-id="${m.id}"><i style="background:${cssColor(anim ? level(m.id) : (ex.muscles[m.id] ?? 0) * 0.9)}"></i>${m.name}</span>`;
  ui.dMuscles.innerHTML = `
    <div class="label">Pracują najmocniej</div><div class="role-items">${main.map((m) => chip(m)).join('')}</div>
    ${fixes.length ? `<div class="label" style="margin-top:10px">Uzupełnia braki w Twoim planie</div>
      <div class="role-items">${fixes.map((id) => chip(MUSCLE_BY_ID[id], 'fix')).join('')}</div>` : ''}`;
  ui.dMuscles.querySelectorAll('.role-item').forEach((el) => {
    el.onmouseenter = () => (muscleHover = el.dataset.id);
    el.onmouseleave = () => (muscleHover = null);
  });
}

// Typowe błędy techniki (tylko ćwiczenia z animacją): klik przełącza animację na błędną technikę
function renderTechnique() {
  const anim = selected.anim;
  const cur = anim ? player.state.pending : null;
  // przyciski „Błędy”: ukryte bez animacji/błędów, czerwone, gdy model pokazuje błędną technikę
  document.querySelectorAll('[data-sec="tech"]').forEach((b) => {
    if (b.tagName === 'BUTTON') { b.hidden = !anim?.mistakes.length; b.classList.toggle('bad-on', !!cur); }
  });
  if (!anim) { ui.dTech.innerHTML = ''; return; }
  const hasMistakes = anim.mistakes.length > 0;
  ui.dTech.innerHTML = !hasMistakes ? '' : `
    <div class="mistakes-head">
      <h3>Technika – porównaj</h3>
      <label class="mini-toggle" title="Pokazuj opis błędu i etykiety przeciążeń na modelu"><input type="checkbox" ${showNotes ? 'checked' : ''}> opisy</label>
    </div>
    <div class="mistakes">
      <button class="mistake-btn good ${cur ? '' : 'active'}" data-id="">✓ Poprawna technika</button>
      ${anim.mistakes.map((m) => `<button class="mistake-btn bad ${cur === m ? 'active' : ''}" data-id="${m.id}">✗ ${m.name}</button>`).join('')}
    </div>
    ${cur && showNotes ? `<div class="mistake-info"><p>${cur.what}</p><p><b>Dlaczego to problem:</b> ${cur.why}</p><p class="fix"><b>Jak poprawić:</b> ${cur.fix}</p></div>` : ''}`;
  ui.dTech.querySelectorAll('.mistake-btn').forEach((b) => (b.onclick = () => setMistake(anim.mistakes.find((m) => m.id === b.dataset.id) ?? null)));
  ui.dTech.querySelector('.mini-toggle input')?.addEventListener('change', (e) => {
    showNotes = e.target.checked;
    localStorage.setItem('hes.mistakeNotes', showNotes ? '1' : '0');
    renderTechnique();
  });
}
function setMistake(m, instant = false) {
  player.setMistake(m, instant);
  // kamera zostaje tam, gdzie była – poprawną i błędną technikę porównujemy z tego samego ujęcia
  renderTechnique();
  renderMuscleSummary();
}

// ---------- Telefon: zakładki Plan / Analiza ----------
// Widok lewego panelu: plan albo kalendarz (komputer – przełącznik w panelu, telefon – zakładki na dole)
let view = 'plan';
function setView(v) {
  if (v === view) return;
  view = v;
  document.body.classList.toggle('view-calendar', v === 'calendar');
  ui.leftSwitch.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === v)));
  render();
}
ui.leftSwitch.querySelectorAll('button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document.querySelectorAll('#mobile-tabs button').forEach((b) => (b.onclick = () => {
  if (b.dataset.tab !== 'analysis') setView(b.dataset.tab);
  document.body.classList.toggle('tab-analysis', b.dataset.tab === 'analysis');
  document.querySelectorAll('#mobile-tabs button').forEach((x) => x.classList.toggle('active', x === b));
}));

// ---------- Sekcje szczegółów (telefon: jedna naraz) ----------
function showSection(sec) {
  ui.detail.dataset.sec = sec;
  ui.detail.scrollTop = 0;
  document.querySelectorAll('#pb-chips button').forEach((b) =>
    b.classList.toggle('active', b.dataset.sec === sec && !ui.panel.hidden));
}
// Przycisk na pasku: otwiera arkusz z tą sekcją; drugi klik w ten sam – zamyka arkusz (ćwiczenie dalej trwa)
function toggleSheet(sec) {
  if (!ui.panel.hidden && ui.detail.dataset.sec === sec && !ui.detail.hidden) { closeSheet(); return; }
  ui.panel.hidden = false;
  ui.browse.hidden = true;
  ui.detail.hidden = false;
  showSection(sec);
  syncTabs();
}
function closeSheet() {
  ui.panel.hidden = true;
  showSection(ui.detail.dataset.sec);
  syncTabs();
}
document.querySelectorAll('#pb-chips button').forEach((b) => (b.onclick = () => toggleSheet(b.dataset.sec)));
ui.pbClose.onclick = closePanel;

// ---------- Pasek odtwarzania: pauza i tempo ----------
ui.play.onclick = () => { player.state.frozen = false; player.state.playing = !player.state.playing; };
ui.speed.onchange = () => (player.state.speed = parseFloat(ui.speed.value));

window.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (selected?.from === 'list') backToList();
    else if (phone() && selected && !ui.panel.hidden) closeSheet();
    else if (!ui.panel.hidden || selected) closePanel();
  } else if (e.code === 'Space' && selected?.anim && !typing) {
    e.preventDefault();
    ui.play.click();
  }
});

// ---------- Zarządzanie planami i treningami ----------
ui.select.onchange = () => { store.currentId = ui.select.value; focusId = null; render(); };
ui.newBtn.onclick = () => {
  if (guestBlock()) return;
  const name = prompt('Nazwa nowego planu:', 'Mój plan');
  if (!name) return;
  const p = emptyPlan(name.trim());
  store.plans.push(p);
  store.currentId = p.id;
  focusId = null;
  render();
};
ui.renameBtn.onclick = () => {
  const name = prompt('Nowa nazwa planu:', plan().name);
  if (name) { plan().name = name.trim(); render(); }
};
ui.deleteBtn.onclick = () => {
  if (guestBlock()) return;
  if (!confirm(`Usunąć plan „${plan().name}”? Treningi zostaną (można ich użyć w innych planach).`)) return;
  store.plans = store.plans.filter((p) => p.id !== store.currentId);
  store.currentId = store.plans[0]?.id ?? null;
  if (!store.plans.length) userEmptied = true;   // świadome usunięcie ostatniego planu – wolno to wysłać na konto
  render();
};
ui.createBtn.onclick = () => ui.newBtn.onclick();
ui.workoutNew.onclick = () => {
  const name = prompt('Nazwa treningu (np. „FBW A”, „Push”, „Nogi”):', `Trening ${LETTERS[store.workouts.length] ?? ''}`.trim());
  if (!name?.trim()) return;
  const w = emptyWorkout(name.trim());
  store.workouts.push(w);
  plan().variants.push(w.id);
  focusId = w.id;
  render();
};

// ---------- Klatka animacji ----------
let mode = null, lastMode = null, mouthOpen = 0;
export function frame(dt, time) {
  if (!analysis) return;
  const out = player.frame(dt, false);
  body.setPose(out.pose);
  body.setBreath(out.sample ? out.sample.breath : 0.4);
  const exhale = out.sample?.phase.breath === 'out' && player.state.playing ? 1 : 0;
  updateBreathPuffs(dt, exhale);
  mouthOpen += (exhale - mouthOpen) * (1 - Math.exp(-dt / 0.12));   // usta otwierają się i zamykają płynnie
  body.setMouth(mouthOpen);
  updateStressMarkers(out.mistake ? out.mistake.stress : [], out.mix, time, showNotes);

  // Co pokazuje model: animację, udział mięśni w ćwiczeniu, jeden dzień albo cały tydzień
  let target, colorFn, glowFn;
  const staticEx = listHover ?? (selected && !selected.anim ? selected.ex : null);
  if (selected?.anim && !listHover) {
    target = out.activations ?? display;
    mode = 'anim';
  } else if (staticEx) {
    target = Object.fromEntries(MUSCLES.map((m) => [m.id, (staticEx.muscles[m.id] ?? 0) * 0.9]));
    mode = 'preview';
  } else if (focusId) {
    target = analysis.perWorkout[focusId];
    colorFn = (v, c) => volumeColor(v, DAY_THRESHOLDS, c); glowFn = (v) => v / 8;
    mode = 'day';
  } else {
    target = analysis.weekly;
    colorFn = (v, c) => volumeColor(v, WEEK_THRESHOLDS, c); glowFn = (v) => v / 20;
    mode = 'week';
  }
  if (mode !== lastMode) { lastMode = mode; renderLegend(mode); }
  const k = mode === 'anim' ? 1 : 1 - Math.exp(-dt / 0.15);
  for (const id in display) display[id] += (target[id] - display[id]) * k;

  // Najechanie: model, figura w panelu albo nazwa mięśnia w panelu
  const hit = pickMuscle() ?? (selected ? figure.pick() : null);
  const hovered = hit?.id ?? muscleHover ?? null;
  if (hit && selected && !listHover) {
    const lvl = selected.anim ? player.peakMap()[hit.id] : (selected.ex.muscles[hit.id] ?? 0) * 0.6;
    const r = roleOf(lvl);
    showTooltip(hit, `W tym ćwiczeniu ${r ? r.one : 'prawie nie pracuje'}`);
  } else if (hit && listHover) {
    const r = roleOf((listHover.muscles[hit.id] ?? 0) * 0.6);
    showTooltip(hit, `${esc(listHover.name)}: ${r ? r.one : 'prawie nie pracuje'}`);
  } else if (hit) {
    const w = analysis.weekly[hit.id];
    const dayTxt = focusId ? `<br>${esc(workout(focusId).name)}: ${analysis.perWorkout[focusId][hit.id].toFixed(1)} serii` : '';
    showTooltip(hit, `Tydzień: <b>${w.toFixed(1)}</b> efektywnych serii – ${volumeStatus(w).label}${dayTxt}`);
  } else showTooltip(null);
  paintMuscles(display, hovered, colorFn, glowFn);
  highlightPlan(hovered);

  // Figura w panelu szczegółów i pasek odtwarzania
  if (selected) {
    const map = selected.anim ? player.peakMap()
      : Object.fromEntries(MUSCLES.map((m) => [m.id, (selected.ex.muscles[m.id] ?? 0) * 0.7]));
    figure.set(map, hovered);
    figure.render();
    ui.dMuscles.querySelectorAll('.role-item').forEach((el) => el.classList.toggle('hover', el.dataset.id === hovered));
  }
  if (out.sample) ui.play.textContent = player.state.playing ? '❚❚' : '▶';
}

// Wskazany mięsień (model / panel) → ćwiczenia w planie podświetlone wg tego, jak mocno go angażują:
// kolor paska i tła jak na modelu (główny – ciepły, pomocniczy – chłodny), ćwiczenia bez udziału przygaszone.
let lastHi;
function highlightPlan(id) {
  const rows = ui.days.querySelectorAll('.item');
  const key = `${id}|${rows.length}|${rows[0]?.isConnected}`;
  if (key === lastHi) return;
  lastHi = key;
  ui.days.classList.toggle('hl-on', !!id);
  rows.forEach((el) => {
    const w = id ? CATALOG_BY_ID[el.dataset.ex]?.muscles[id] ?? 0 : 0;
    el.classList.toggle('hl', w > 0);
    el.style.setProperty('--hl', w > 0 ? cssColor(w * 0.9) : 'transparent');
    el.style.setProperty('--hla', String(0.08 + 0.22 * w));
  });
}

function renderLegend(m) {
  if (m === 'anim') {
    ui.legend.innerHTML = `<span>praca mięśni teraz:</span><div class="legend-bar"></div><span>mocno</span>`;
    return;
  }
  if (m === 'preview') {
    ui.legend.innerHTML = `<span>udział mięśnia:</span><div class="legend-bar"></div><span>główny</span>`;
    return;
  }
  const th = m === 'day' ? DAY_THRESHOLDS : WEEK_THRESHOLDS;
  const box = (v, t) => `<span class="lg"><i style="background:${cssVolumeColor(v, th)}"></i>${t}</span>`;
  ui.legend.innerHTML = (m === 'day' ? '<b>Serie w tym treningu:</b> ' : '<b>Serie tygodniowo:</b> ') +
    box(0, '0') + box(th[0] * 0.8, `&lt; ${th[0]}`) + box((th[0] + th[1]) / 2, `${th[0]}–${th[1]}`) + box(th[2] * 0.75, `${th[1]}–${th[2]}`) + box(th[3] + 2, `&gt; ${th[2]}`);
}

// Start. Parametry do demo/testów:
//   ?focus=A – wybrany trening (litera), ?picker=B – lista ćwiczeń dla treningu, &preview=row – podgląd z listy,
//   ?ex=squat – szczegóły ćwiczenia, &t=0.5 – zatrzymanie animacji, &mistake=valgus – typowy błąd,
//   &sec=info|tech|muscles – otwarta sekcja (telefon: arkusz pod modelem)
let started = false;
export function start() {
  started = true;
  flyCamera(...PLAN_CAMERA);
  controls.autoRotate = true;
  const q = new URLSearchParams(location.search);
  const byLetter = (l) => store.workouts[LETTERS.indexOf(l ?? '-')]?.id;
  if (byLetter(q.get('focus'))) focusId = byLetter(q.get('focus'));
  render();
  if (byLetter(q.get('picker'))) {
    openBrowse(byLetter(q.get('picker')));
    if (CATALOG_BY_ID[q.get('preview')]) listHover = CATALOG_BY_ID[q.get('preview')];
  }
  const ex = CATALOG_BY_ID[q.get('ex')];
  if (ex) {
    if (byLetter(q.get('focus'))) focusId = byLetter(q.get('focus'));
    selectExercise(ex, q.get('picker') ? 'list' : 'plan', { t: q.has('t') ? parseFloat(q.get('t')) : null, mistake: q.get('mistake') });
    if (q.get('sec')) toggleSheet(q.get('sec'));
  }
}
controls.addEventListener('start', () => (controls.autoRotate = false));
