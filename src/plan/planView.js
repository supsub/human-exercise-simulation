import { paintMuscles, flyCamera, jumpCamera, controls, body, pickMuscle, showTooltip, cssColor, volumeColor, cssVolumeColor,
  updateBreathPuffs, updateStressMarkers, setScenery, WEEK_THRESHOLDS, DAY_THRESHOLDS } from '../scene.js';
import { MUSCLES, MUSCLE_BY_ID } from '../muscles.js';
import { roleOf, PHASE_KIND, BREATH } from '../exercises/common.js';
import { EXERCISE_BY_ID } from '../exercises/index.js';
import { createPlayer } from '../player.js';
import { createFigure } from '../figure.js';
import { CATALOG, CATALOG_BY_ID, CATEGORIES } from './catalog.js';
import { DAYS, DAY_BY_ID, analyzePlan, emptyPlan, examplePlan, volumeStatus, OPTIMAL_WEEKLY, newId } from './analysis.js';

// Jedyny widok aplikacji: plan treningowy (tydzień Pn–Nd) z modelem 3D.
// - bez wybranego ćwiczenia model pokazuje mapę obciążenia tygodnia lub dnia,
// - wybrane ćwiczenie (z planu, listy lub rekomendacji) otwiera szczegóły po prawej:
//   animacja na modelu, typowe błędy, figura z pracującymi mięśniami, dodanie do wybranego dnia.

const STORAGE_KEY = 'hes.plans.v1';
const PLAN_CAMERA = [[0, 1.25, 3.4], [0, 0.95, 0]];
const $ = (id) => document.getElementById(id);
const ui = {
  select: $('plan-select'), days: $('plan-days'),
  newBtn: $('plan-new'), renameBtn: $('plan-rename'), deleteBtn: $('plan-delete'), exampleBtn: $('plan-example'),
  focus: $('plan-focus'), legend: $('plan-legend'), score: $('plan-score'), groups: $('plan-groups'), warnings: $('plan-warnings'), recs: $('plan-recs'),
  panel: $('picker'), panelTitle: $('picker-title'), panelClose: $('picker-close'),
  browse: $('picker-browse'), search: $('picker-search'), cats: $('picker-cats'), list: $('picker-list'),
  detail: $('picker-detail'), dTop: $('d-top'), dTech: $('d-technique'), dMuscles: $('d-muscles'),
  bar: $('player-bar'), play: $('play'), timeline: $('timeline'), playhead: $('playhead'), speed: $('speed'),
  breathLabel: $('breath-label'), phaseKind: $('phase-kind'),
};

const player = createPlayer(body.resolvePose);
const figure = createFigure($('figure'));

let store = load();
let analysis = null;
let focusDay = null;        // wybrany dzień (mapa dnia na modelu, cel przycisku "Dodaj")
let selected = null;        // { ex: pozycja katalogu, anim: definicja animacji | null, from: 'plan' | 'list' }
let browseDay = null;       // dzień, dla którego otwarto listę ćwiczeń
let browseCat = null;
let listHover = null;       // ćwiczenie wskazane na liście (podgląd mięśni)
let muscleHover = null;     // mięsień wskazany w panelu
let showNotes = localStorage.getItem('hes.mistakeNotes') !== '0';
let scrubbing = false;
let display = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && s.plans?.length) return s;
  } catch {}
  const p = examplePlan();
  return { plans: [p], currentId: p.id };
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
const plan = () => store.plans.find((p) => p.id === store.currentId) ?? store.plans[0];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clampInt = (v, a, b) => Math.min(b, Math.max(a, parseInt(v, 10) || a));
const dayTotal = (p, id) => p.days[id].items.reduce((s, it) => s + (it.sets || 0), 0);
// mięśnie, które ćwiczenie mocno angażuje, a w planie dostają za mało pracy
const helpsOf = (ex) => Object.entries(ex.muscles).filter(([id, w]) => w >= 0.5 && analysis.weekly[id] < 3).map(([id]) => id);

// ---------- Render ----------
function render() {
  const p = plan();
  ui.select.innerHTML = store.plans.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  analysis = analyzePlan(p);
  renderDays(p);
  renderAnalysis(p);
  if (selected) renderDetailTop();
  if (!ui.browse.hidden && !ui.panel.hidden) renderList();
  save();
}

function renderDays(p) {
  ui.days.innerHTML = '';
  for (const d of DAYS) {
    const day = p.days[d.id];
    const card = document.createElement('div');
    card.className = 'day-card' + (day.active ? ' active' : '') + (focusDay === d.id ? ' focused' : '');
    const total = dayTotal(p, d.id);
    card.innerHTML = `
      <div class="day-head">
        <label class="switch" title="Dzień treningowy"><input type="checkbox" ${day.active ? 'checked' : ''}><span></span></label>
        <button class="day-name" title="Wybierz dzień – pokaż jego mięśnie na modelu">${d.name}</button>
        <span class="day-meta">${day.active ? (total ? `${day.items.length} ćw. · ${total} serii` : 'trening') : 'odpoczynek'}</span>
      </div>
      <div class="day-items"></div>`;
    card.querySelector('input').onchange = (e) => { day.active = e.target.checked; render(); };
    card.querySelector('.switch').addEventListener('click', (e) => e.stopPropagation());
    // cała karta dnia jest klikalna (wiersze ćwiczeń, pola i przyciski mają własne akcje)
    card.onclick = () => {
      // przy wybranym ćwiczeniu klik w dzień tylko go zaznacza (cel "Dodaj"), bez odznaczania
      focusDay = selected ? d.id : focusDay === d.id ? null : d.id;
      render();
    };
    const list = card.querySelector('.day-items');
    if (day.active) {
      day.items.forEach((it, idx) => {
        const ex = CATALOG_BY_ID[it.exId];
        const row = document.createElement('div');
        row.className = 'item' + (selected?.ex === ex ? ' selected' : '');
        row.title = 'Kliknij, aby zobaczyć ćwiczenie';
        row.innerHTML = `
          <span class="item-name">${esc(ex.name)}${ex.animated ? ' <i class="anim-dot" title="ma animację">▶</i>' : ''}</span>
          <input type="number" min="1" max="10" value="${it.sets}" title="Serie"> <span class="x">×</span>
          <input type="number" min="1" max="50" value="${it.reps}" title="Powtórzenia">
          <button class="icon del" title="Usuń z planu">✕</button>`;
        const [setsIn, repsIn] = row.querySelectorAll('input');
        setsIn.onchange = () => { it.sets = clampInt(setsIn.value, 1, 10); render(); };
        repsIn.onchange = () => { it.reps = clampInt(repsIn.value, 1, 50); render(); };
        row.querySelectorAll('input, .del').forEach((el) => el.addEventListener('click', (e) => e.stopPropagation()));
        row.querySelector('.del').onclick = (e) => { e.stopPropagation(); day.items.splice(idx, 1); render(); };
        row.onclick = (e) => { e.stopPropagation(); selected?.ex === ex ? closePanel() : selectExercise(ex, 'plan'); };
        list.appendChild(row);
      });
      const add = document.createElement('button');
      add.className = 'add-ex';
      add.textContent = '+ Dodaj ćwiczenie';
      add.onclick = (e) => { e.stopPropagation(); openBrowse(d.id); };
      list.appendChild(add);
    }
    ui.days.appendChild(card);
  }
}

function renderAnalysis(p) {
  const a = analysis;
  ui.focus.innerHTML = focusDay
    ? `Pokazuję: <b>${DAY_BY_ID[focusDay].name}</b> <button id="focus-week" class="link">pokaż cały tydzień</button>`
    : 'Pokazuję: <b>cały tydzień</b> <span class="muted">(kliknij nazwę dnia, aby zobaczyć jeden trening)</span>';
  ui.focus.querySelector('#focus-week')?.addEventListener('click', () => { focusDay = null; render(); });

  const pct = Math.round((a.trained / MUSCLES.length) * 100);
  ui.score.innerHTML = `
    <div class="score-ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div><b>${a.trained} z ${MUSCLES.length}</b> mięśni dostaje bodziec (≥ 3 serie/tydz.)<br>
    <span class="muted">${a.optimal} w zakresie optymalnym (8–20 serii)</span></div>`;

  ui.groups.innerHTML = a.groups.map((g) => {
    const w = Math.min(100, (g.sets / OPTIMAL_WEEKLY) * 100);
    return `<div class="g-row">
      <span class="g-name">${g.group}</span>
      <div class="g-bar"><div class="g-zone"></div><div class="g-fill" style="width:${w}%;background:${cssVolumeColor(g.sets)}"></div></div>
      <span class="g-val">${g.sets.toFixed(1)}</span>
      <span class="g-status ${g.status.id}">${g.status.label}</span>
    </div>`;
  }).join('');

  ui.warnings.innerHTML = a.warnings.map((w) => `<div class="warn ${w.level}">${w.level === 'warn' ? '⚠' : w.level === 'ok' ? '✓' : 'ℹ'} ${w.text}</div>`).join('');

  ui.recs.innerHTML = a.recommendations.length
    ? a.recommendations.map((r, i) => {
        const ex = CATALOG_BY_ID[r.exId];
        return `<div class="rec">
          <div><button class="link rec-name" data-i="${i}" title="Zobacz ćwiczenie">${ex.name}</button> <span class="muted">· ${ex.equipment}</span><br>
          <small>Uzupełnia: ${r.fixes.map((id) => MUSCLE_BY_ID[id].name).join(', ')}</small></div>
          ${r.day ? `<button class="rec-add" data-i="${i}">+ ${DAY_BY_ID[r.day].short}</button>` : ''}
        </div>`;
      }).join('')
    : '<div class="muted">Brak – wszystkie mięśnie dostają minimum bodźca.</div>';
  ui.recs.querySelectorAll('.rec-name').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    if (r.day) focusDay = r.day;
    selectExercise(CATALOG_BY_ID[r.exId], 'plan');
  }));
  ui.recs.querySelectorAll('.rec-add').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    p.days[r.day].items.push({ exId: r.exId, sets: 3, reps: 10 });
    render();
  }));
}

// ---------- Panel: lista ćwiczeń ----------
function openBrowse(dayId) {
  browseDay = dayId;
  focusDay = dayId;
  deselect();
  ui.search.value = '';
  ui.panel.hidden = false;
  ui.browse.hidden = false;
  ui.detail.hidden = true;
  ui.panelTitle.textContent = `Dodaj ćwiczenie – ${DAY_BY_ID[dayId].name}`;
  flyCamera(...PLAN_CAMERA);
  render();
  ui.search.focus();
}
function backToList() {
  deselect();
  ui.browse.hidden = false;
  ui.detail.hidden = true;
  ui.panelTitle.textContent = `Dodaj ćwiczenie – ${DAY_BY_ID[browseDay].name}`;
  flyCamera(...PLAN_CAMERA);
  render();
}
function closePanel() {
  ui.panel.hidden = true;
  listHover = null;
  deselect();
  flyCamera(...PLAN_CAMERA);
  render();
}

ui.cats.innerHTML = ['Wszystkie', ...CATEGORIES].map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join('');
ui.cats.querySelectorAll('button').forEach((b) => (b.onclick = () => { browseCat = b.dataset.c === 'Wszystkie' ? null : b.dataset.c; renderList(); }));
ui.search.oninput = renderList;
ui.panelClose.onclick = closePanel;

function renderList() {
  const q = ui.search.value.toLowerCase().trim();
  ui.cats.querySelectorAll('button').forEach((b) => b.classList.toggle('active', (b.dataset.c === 'Wszystkie' && !browseCat) || b.dataset.c === browseCat));
  const items = CATALOG.filter((ex) => (!browseCat || ex.category === browseCat) &&
    (!q || ex.name.toLowerCase().includes(q) || Object.keys(ex.muscles).some((id) => MUSCLE_BY_ID[id].name.toLowerCase().includes(q))));
  items.sort((a, b) => helpsOf(b).length - helpsOf(a).length); // uzupełniające braki na górze
  ui.list.innerHTML = items.map((ex) => {
    const helps = helpsOf(ex).length;
    const tags = Object.entries(ex.muscles).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, w]) => `<span class="mtag" style="border-color:${cssColor(w * 0.9)}">${MUSCLE_BY_ID[id].name}</span>`).join('');
    return `<div class="pick" data-id="${ex.id}" tabindex="0">
      <div class="pick-body">
        <div class="pick-head"><b>${ex.name}</b>${ex.animated ? '<span class="anim">▶ animacja</span>' : ''}${helps ? `<span class="helps">uzupełnia ${helps} ${helps === 1 ? 'brak' : 'braki'}</span>` : ''}</div>
        <div class="pick-meta">${ex.category} · ${ex.equipment}</div><div class="mtags">${tags}</div>
      </div>
      <button class="quick-add" title="Dodaj od razu do: ${DAY_BY_ID[browseDay].name} (3 × 10)">+</button>
    </div>`;
  }).join('') || '<div class="muted">Brak ćwiczeń pasujących do wyszukiwania.</div>';
  ui.list.querySelectorAll('.pick').forEach((el) => {
    const ex = CATALOG_BY_ID[el.dataset.id];
    el.onclick = () => selectExercise(ex, 'list');
    el.onkeydown = (e) => { if (e.key === 'Enter') selectExercise(ex, 'list'); };
    el.querySelector('.quick-add').onclick = (e) => {
      e.stopPropagation();
      addToDay(ex, browseDay);
      ui.list.querySelector(`.pick[data-id="${ex.id}"]`)?.classList.add('added');
    };
    el.onmouseenter = () => (listHover = ex);
    el.onmouseleave = () => (listHover = null);
  });
}

function addToDay(ex, dayId) {
  const day = plan().days[dayId];
  day.active = true;
  day.items.push({ exId: ex.id, sets: 3, reps: 10 });
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
  ui.panel.hidden = false;
  ui.browse.hidden = true;
  ui.detail.hidden = false;
  ui.detail.scrollTop = 0;
  ui.panelTitle.textContent = from === 'list' ? `Dodaj ćwiczenie – ${DAY_BY_ID[browseDay].name}` : 'Ćwiczenie';
  controls.autoRotate = !anim; // bez animacji model się obraca, żeby było widać też mięśnie z tyłu
  if (anim) (t !== null ? jumpCamera : flyCamera)(...cameraFor(anim));
  else flyCamera(...PLAN_CAMERA);
  ui.bar.hidden = !anim;
  setScenery(anim?.scenery);
  if (anim) buildTimeline(anim);
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

function renderDetailTop() {
  const { ex, from } = selected;
  const p = plan();
  const inPlan = DAYS.flatMap((d) => p.days[d.id].active ? p.days[d.id].items.filter((it) => it.exId === ex.id).map((it) => `${d.short} ${it.sets}×${it.reps}`) : []);
  let impact = '';
  if (focusDay) {
    const trial = JSON.parse(JSON.stringify(p));
    trial.days[focusDay].active = true;
    trial.days[focusDay].items.push({ exId: ex.id, sets: 3, reps: 10 });
    const after = analyzePlan(trial);
    impact = after.trained > analysis.trained
      ? `Po dodaniu: <b>${analysis.trained} → ${after.trained}</b> mięśni z wystarczającym bodźcem.`
      : helpsOf(ex).length ? 'Wzmocni słabiej trenowane partie.' : 'Te mięśnie już są trenowane w planie.';
  }
  ui.dTop.innerHTML = `
    ${from === 'list' ? '<button class="link back">← wróć do listy</button>' : ''}
    <div class="d-title"><h2>${esc(ex.name)}</h2>
      <div class="muted small">${ex.category} · ${ex.equipment}${selected.anim ? '' : ' · bez animacji – model pokazuje mapę mięśni'}</div></div>
    <div class="d-add">
      ${focusDay
        ? `<button class="d-add-btn">+ Dodaj do: ${DAY_BY_ID[focusDay].name}</button><div class="d-impact">${impact}</div>`
        : '<div class="d-impact">Aby dodać, kliknij nazwę dnia w planie po lewej.</div>'}
      ${inPlan.length ? `<div class="d-impact muted">Już w planie: ${inPlan.join(', ')}</div>` : ''}
    </div>
    <p class="d-text">${ex.how}</p>
    <p class="d-tip">💡 ${ex.tip}</p>`;
  ui.dTop.querySelector('.back')?.addEventListener('click', backToList);
  ui.dTop.querySelector('.d-add-btn')?.addEventListener('click', () => addToDay(ex, focusDay));
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
      <div class="role-items">${fixes.map((id) => chip(MUSCLE_BY_ID[id], 'fix')).join('')}</div>` : ''}
    <div class="muted small" style="margin-top:8px">Najedź na figurę lub model, aby zobaczyć rolę każdego mięśnia.</div>`;
  ui.dMuscles.querySelectorAll('.role-item').forEach((el) => {
    el.onmouseenter = () => (muscleHover = el.dataset.id);
    el.onmouseleave = () => (muscleHover = null);
  });
}

// Typowe błędy techniki (tylko ćwiczenia z animacją): klik przełącza animację na błędną technikę
function renderTechnique() {
  const anim = selected.anim;
  if (!anim) { ui.dTech.innerHTML = ''; return; }
  const cur = player.state.pending;
  const hasMistakes = anim.mistakes.length > 0;
  ui.dTech.innerHTML = !hasMistakes ? `
    <details class="cues-box"><summary>Wskazówki techniczne i oddech</summary>
      <ul class="cues">${anim.cues.map((c) => `<li>${c}</li>`).join('')}</ul>
      ${anim.breathingTip ? `<p class="breath-tip">🫁 ${anim.breathingTip}</p>` : ''}</details>` : `
    <div class="mistakes-head">
      <h3>Technika – porównaj</h3>
      <label class="mini-toggle" title="Pokazuj opis błędu i etykiety przeciążeń na modelu"><input type="checkbox" ${showNotes ? 'checked' : ''}> opisy</label>
    </div>
    <div class="mistakes">
      <button class="mistake-btn good ${cur ? '' : 'active'}" data-id="">✓ Poprawna technika</button>
      ${anim.mistakes.map((m) => `<button class="mistake-btn bad ${cur === m ? 'active' : ''}" data-id="${m.id}">✗ ${m.name}</button>`).join('')}
    </div>
    ${cur && showNotes ? `<div class="mistake-info"><p>${cur.what}</p><p><b>Dlaczego to problem:</b> ${cur.why}</p><p class="fix"><b>Jak poprawić:</b> ${cur.fix}</p></div>` : ''}
    <details class="cues-box"><summary>Wskazówki techniczne i oddech</summary>
      <ul class="cues">${anim.cues.map((c) => `<li>${c}</li>`).join('')}</ul>
      ${anim.breathingTip ? `<p class="breath-tip">🫁 ${anim.breathingTip}</p>` : ''}</details>`;
  ui.dTech.querySelectorAll('.mistake-btn').forEach((b) => (b.onclick = () => setMistake(anim.mistakes.find((m) => m.id === b.dataset.id) ?? null)));
  ui.dTech.querySelector('.mini-toggle input')?.addEventListener('change', (e) => {
    showNotes = e.target.checked;
    localStorage.setItem('hes.mistakeNotes', showNotes ? '1' : '0');
    renderTechnique();
  });
}
function setMistake(m, instant = false) {
  const anim = selected.anim;
  player.setMistake(m, instant);
  const pos = m?.camera ?? anim.cameraPosition;
  (instant ? jumpCamera : flyCamera)(...cameraFor(anim, pos));
  renderTechnique();
  renderMuscleSummary();
}

// ---------- Pasek odtwarzania ----------
function buildTimeline(ex) {
  ui.timeline.querySelectorAll('.seg').forEach((s) => s.remove());
  for (const p of ex.phases) {
    const seg = document.createElement('div');
    seg.className = 'seg ' + p.kind;
    seg.style.left = p.start * 100 + '%';
    seg.style.width = (p.end - p.start) * 100 + '%';
    seg.title = `${p.name} – ${PHASE_KIND[p.kind].hint}, ${BREATH[p.breath].label.toLowerCase()}`;
    seg.innerHTML = `<span>${p.name}</span><b class="seg-breath">${BREATH[p.breath].icon}</b>`;
    ui.timeline.appendChild(seg);
  }
}
ui.play.onclick = () => { player.state.frozen = false; player.state.playing = !player.state.playing; };
ui.speed.onchange = () => (player.state.speed = parseFloat(ui.speed.value));
function scrubAt(clientX) {
  const r = ui.timeline.getBoundingClientRect();
  player.seek((clientX - r.left) / r.width);
}
ui.timeline.addEventListener('pointerdown', (e) => { scrubbing = true; ui.timeline.setPointerCapture(e.pointerId); scrubAt(e.clientX); });
ui.timeline.addEventListener('pointermove', (e) => scrubbing && scrubAt(e.clientX));
ui.timeline.addEventListener('pointerup', () => (scrubbing = false));

window.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (selected?.from === 'list') backToList();
    else if (!ui.panel.hidden) closePanel();
  } else if (e.code === 'Space' && selected?.anim && !typing) {
    e.preventDefault();
    ui.play.click();
  }
});

// ---------- Zarządzanie planami ----------
ui.select.onchange = () => { store.currentId = ui.select.value; focusDay = null; render(); };
ui.newBtn.onclick = () => {
  const name = prompt('Nazwa nowego planu:', 'Mój plan');
  if (!name) return;
  const p = emptyPlan(name.trim());
  store.plans.push(p);
  store.currentId = p.id;
  focusDay = null;
  render();
};
ui.renameBtn.onclick = () => {
  const name = prompt('Nowa nazwa planu:', plan().name);
  if (name) { plan().name = name.trim(); render(); }
};
ui.deleteBtn.onclick = () => {
  if (!confirm(`Usunąć plan „${plan().name}”?`)) return;
  store.plans = store.plans.filter((p) => p.id !== store.currentId);
  if (!store.plans.length) store.plans.push(emptyPlan('Mój plan'));
  store.currentId = store.plans[0].id;
  render();
};
ui.exampleBtn.onclick = () => {
  const p = examplePlan();
  p.id = newId();
  store.plans.push(p);
  store.currentId = p.id;
  render();
};

// ---------- Klatka animacji ----------
let mode = null, lastMode = null;
export function frame(dt, time) {
  if (!analysis) return;
  const out = player.frame(dt, scrubbing);
  body.setPose(out.pose);
  body.setBreath(out.sample ? out.sample.breath : 0.4);
  updateBreathPuffs(dt, out.sample?.phase.breath === 'out' && player.state.playing ? 1 : 0);
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
  } else if (focusDay) {
    target = analysis.perDay[focusDay];
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
    const dayTxt = focusDay ? `<br>${DAY_BY_ID[focusDay].name}: ${analysis.perDay[focusDay][hit.id].toFixed(1)} serii` : '';
    showTooltip(hit, `Tydzień: <b>${w.toFixed(1)}</b> efektywnych serii – ${volumeStatus(w).label}${dayTxt}`);
  } else showTooltip(null);
  paintMuscles(display, hovered, colorFn, glowFn);

  // Figura w panelu szczegółów i pasek odtwarzania
  if (selected) {
    const map = selected.anim ? player.peakMap()
      : Object.fromEntries(MUSCLES.map((m) => [m.id, (selected.ex.muscles[m.id] ?? 0) * 0.7]));
    figure.set(map, hovered);
    figure.render();
    ui.dMuscles.querySelectorAll('.role-item').forEach((el) => el.classList.toggle('hover', el.dataset.id === hovered));
  }
  if (out.sample) {
    const ph = out.sample.phase;
    ui.playhead.style.left = player.state.t * 100 + '%';
    ui.timeline.querySelectorAll('.seg').forEach((s, i) => s.classList.toggle('current', selected.anim.phases[i] === ph));
    ui.breathLabel.textContent = `${BREATH[ph.breath].icon} ${BREATH[ph.breath].label}`;
    ui.breathLabel.className = 'breath-label ' + ph.breath;
    ui.phaseKind.innerHTML = `<b>${ph.name}</b> – ${PHASE_KIND[ph.kind].hint}`;
    ui.play.textContent = player.state.playing ? '❚❚' : '▶';
  }
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
  ui.legend.innerHTML = (m === 'day' ? '<b>Serie w tym dniu:</b> ' : '<b>Serie tygodniowo:</b> ') +
    box(0, '0') + box(th[0] * 0.8, `&lt; ${th[0]}`) + box((th[0] + th[1]) / 2, `${th[0]}–${th[1]}`) + box(th[2] * 0.75, `${th[1]}–${th[2]}`) + box(th[3] + 2, `&gt; ${th[2]}`);
}

// Start. Parametry do demo/testów:
//   ?focus=tue – wybrany dzień, ?picker=wed – lista ćwiczeń dla dnia, &preview=row – podgląd z listy,
//   ?ex=squat – szczegóły ćwiczenia, &t=0.5 – zatrzymanie animacji, &mistake=valgus – typowy błąd
export function start() {
  flyCamera(...PLAN_CAMERA);
  controls.autoRotate = true;
  const q = new URLSearchParams(location.search);
  if (DAY_BY_ID[q.get('focus')]) focusDay = q.get('focus');
  render();
  if (DAY_BY_ID[q.get('picker')]) {
    openBrowse(q.get('picker'));
    if (CATALOG_BY_ID[q.get('preview')]) listHover = CATALOG_BY_ID[q.get('preview')];
  }
  const ex = CATALOG_BY_ID[q.get('ex')];
  if (ex) {
    if (DAY_BY_ID[q.get('focus')]) focusDay = q.get('focus');
    selectExercise(ex, q.get('picker') ? 'list' : 'plan', { t: q.has('t') ? parseFloat(q.get('t')) : null, mistake: q.get('mistake') });
  }
}
controls.addEventListener('start', () => (controls.autoRotate = false));
