import { paintMuscles, flyCamera, controls, body, pickMuscle, showTooltip, cssColor, volumeColor, cssVolumeColor, WEEK_THRESHOLDS, DAY_THRESHOLDS } from '../scene.js';
import { MUSCLES, MUSCLE_BY_ID } from '../muscles.js';
import { standingPose } from '../exercises/common.js';
import { CATALOG, CATALOG_BY_ID, CATEGORIES } from './catalog.js';
import { DAYS, DAY_BY_ID, analyzePlan, emptyPlan, examplePlan, volumeStatus, OPTIMAL_WEEKLY, newId } from './analysis.js';

// Widok "Plan treningowy": tydzień Pn–Nd, ćwiczenia na każdy dzień,
// mapa obciążenia mięśni na modelu 3D i rekomendacje liczone lokalnie (offline).

const STORAGE_KEY = 'hes.plans.v1';
const $ = (id) => document.getElementById(id);
const ui = {
  root: $('plan-view'), select: $('plan-select'), days: $('plan-days'),
  newBtn: $('plan-new'), renameBtn: $('plan-rename'), deleteBtn: $('plan-delete'), exampleBtn: $('plan-example'),
  focus: $('plan-focus'), score: $('plan-score'), groups: $('plan-groups'), warnings: $('plan-warnings'), recs: $('plan-recs'),
  picker: $('picker'), pickerTitle: $('picker-title'), pickerSearch: $('picker-search'), pickerCats: $('picker-cats'),
  pickerList: $('picker-list'), pickerClose: $('picker-close'),
};

let store = load();
let focusDay = null;       // null = cały tydzień, inaczej id dnia
let analysis = null;
let display = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])); // wygładzone wartości na modelu
let hovered = null;
let openInSimulation = () => {};

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

// ---------- Render ----------
function render() {
  const p = plan();
  ui.select.innerHTML = store.plans.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  analysis = analyzePlan(p);
  renderDays(p);
  renderAnalysis(p);
  save();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayTotal = (p, id) => p.days[id].items.reduce((s, it) => s + (it.sets || 0), 0);

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
        <button class="day-name" title="Pokaż mięśnie z tego dnia na modelu">${d.name}</button>
        <span class="day-meta">${day.active ? (total ? `${day.items.length} ćw. · ${total} serii` : 'trening') : 'odpoczynek'}</span>
      </div>
      <div class="day-items"></div>`;
    card.querySelector('input').onchange = (e) => { day.active = e.target.checked; if (!day.active && focusDay === d.id) focusDay = null; render(); };
    card.querySelector('.day-name').onclick = () => { focusDay = focusDay === d.id ? null : d.id; render(); };
    const list = card.querySelector('.day-items');
    if (day.active) {
      day.items.forEach((it, idx) => {
        const ex = CATALOG_BY_ID[it.exId];
        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = `
          <span class="item-name" title="${esc(primaryText(ex))}">${esc(ex.name)}</span>
          <input type="number" min="1" max="10" value="${it.sets}" title="Serie"> <span class="x">×</span>
          <input type="number" min="1" max="50" value="${it.reps}" title="Powtórzenia">
          ${ex.animated ? '<button class="icon play-ex" title="Zobacz animację i aktywację mięśni">▶</button>' : '<span class="icon-spacer"></span>'}
          <button class="icon del" title="Usuń">✕</button>`;
        const [setsIn, repsIn] = row.querySelectorAll('input');
        setsIn.onchange = () => { it.sets = clampInt(setsIn.value, 1, 10); render(); };
        repsIn.onchange = () => { it.reps = clampInt(repsIn.value, 1, 50); render(); };
        row.querySelector('.del').onclick = () => { day.items.splice(idx, 1); render(); };
        row.querySelector('.play-ex')?.addEventListener('click', () => openInSimulation(ex.animated, it.reps));
        list.appendChild(row);
      });
      const add = document.createElement('button');
      add.className = 'add-ex';
      add.textContent = '+ Dodaj ćwiczenie';
      add.onclick = () => openPicker(d.id);
      list.appendChild(add);
    }
    ui.days.appendChild(card);
  }
}

const clampInt = (v, a, b) => Math.min(b, Math.max(a, parseInt(v, 10) || a));
function primaryText(ex) {
  return Object.entries(ex.muscles).filter(([, w]) => w >= 0.75).map(([id]) => MUSCLE_BY_ID[id].name).join(', ');
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
    return `<div class="g-row" data-group="${esc(g.group)}">
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
          <div><b>${ex.name}</b> <span class="muted">· ${ex.equipment}</span><br>
          <small>Uzupełnia: ${r.fixes.map((id) => MUSCLE_BY_ID[id].name).join(', ')}</small></div>
          ${r.day ? `<button data-i="${i}">+ ${DAY_BY_ID[r.day].short}</button>` : ''}
        </div>`;
      }).join('')
    : '<div class="muted">Brak – wszystkie mięśnie dostają minimum bodźca.</div>';
  ui.recs.querySelectorAll('button[data-i]').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    p.days[r.day].items.push({ exId: r.exId, sets: 3, reps: 10 });
    render();
  }));
}

// ---------- Wybór ćwiczeń ----------
let pickerDay = null, pickerCat = null;
function openPicker(dayId) {
  pickerDay = dayId;
  ui.pickerTitle.textContent = `Dodaj ćwiczenie – ${DAY_BY_ID[dayId].name}`;
  ui.pickerSearch.value = '';
  ui.picker.hidden = false;
  ui.pickerSearch.focus();
  renderPicker();
}
ui.pickerCats.innerHTML = ['Wszystkie', ...CATEGORIES].map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join('');
ui.pickerCats.querySelectorAll('button').forEach((b) => (b.onclick = () => { pickerCat = b.dataset.c === 'Wszystkie' ? null : b.dataset.c; renderPicker(); }));
ui.pickerSearch.oninput = renderPicker;
ui.pickerClose.onclick = () => (ui.picker.hidden = true);
ui.picker.onclick = (e) => { if (e.target === ui.picker) ui.picker.hidden = true; };
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.picker.hidden = true; });

function renderPicker() {
  const q = ui.pickerSearch.value.toLowerCase().trim();
  ui.pickerCats.querySelectorAll('button').forEach((b) => b.classList.toggle('active', (b.dataset.c === 'Wszystkie' && !pickerCat) || b.dataset.c === pickerCat));
  const weekly = analysis.weekly;
  const items = CATALOG.filter((ex) => (!pickerCat || ex.category === pickerCat) &&
    (!q || ex.name.toLowerCase().includes(q) || Object.keys(ex.muscles).some((id) => MUSCLE_BY_ID[id].name.toLowerCase().includes(q))));
  // ile "braków" w planie uzupełnia ćwiczenie – te najbardziej przydatne pokazujemy na górze
  const helpsOf = (ex) => Object.entries(ex.muscles).filter(([id, w]) => w >= 0.5 && weekly[id] < 3).length;
  items.sort((a, b) => helpsOf(b) - helpsOf(a));
  ui.pickerList.innerHTML = items.map((ex) => {
    const helps = helpsOf(ex);
    const tags = Object.entries(ex.muscles).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([id, w]) => `<span class="mtag" style="border-color:${cssColor(w * 0.9)}">${MUSCLE_BY_ID[id].name}</span>`).join('');
    return `<button class="pick" data-id="${ex.id}">
      <div class="pick-head"><b>${ex.name}</b>${ex.animated ? '<span class="anim">▶ animacja 3D</span>' : ''}${helps ? `<span class="helps">uzupełnia ${helps} ${helps === 1 ? 'brak' : 'braki'}</span>` : ''}</div>
      <div class="pick-meta">${ex.category} · ${ex.equipment}</div><div class="mtags">${tags}</div></button>`;
  }).join('') || '<div class="muted">Brak ćwiczeń pasujących do wyszukiwania.</div>';
  ui.pickerList.querySelectorAll('.pick').forEach((b) => {
    b.onclick = () => { plan().days[pickerDay].items.push({ exId: b.dataset.id, sets: 3, reps: 10 }); ui.picker.hidden = true; render(); };
    b.onmouseenter = () => (pickerPreview = CATALOG_BY_ID[b.dataset.id]);
    b.onmouseleave = () => (pickerPreview = null);
  });
}
let pickerPreview = null; // podgląd mięśni ćwiczenia po najechaniu w wyborze

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
export function frame(dt) {
  if (!analysis) return;
  // Trzy tryby: podgląd ćwiczenia z listy (udział mięśni), jeden dzień, cały tydzień
  let target, colorFn, glowFn;
  if (pickerPreview && !ui.picker.hidden) {
    target = Object.fromEntries(MUSCLES.map((m) => [m.id, (pickerPreview.muscles[m.id] ?? 0) * 0.9]));
    colorFn = undefined; glowFn = undefined;
    mode = 'preview';
  } else if (focusDay) {
    target = { ...analysis.perDay[focusDay] };
    colorFn = (v, c) => volumeColor(v, DAY_THRESHOLDS, c); glowFn = (v) => v / 8;
    mode = 'day';
  } else {
    target = { ...analysis.weekly };
    colorFn = (v, c) => volumeColor(v, WEEK_THRESHOLDS, c); glowFn = (v) => v / 20;
    mode = 'week';
  }
  if (mode !== lastMode) { lastMode = mode; renderLegend(mode); }
  const k = 1 - Math.exp(-dt / 0.15);
  for (const id in display) display[id] += (target[id] - display[id]) * k;

  const hit = pickMuscle();
  hovered = hit?.id ?? null;
  if (hit) {
    const w = analysis.weekly[hit.id];
    const st = volumeStatus(w);
    const dayTxt = focusDay ? `<br>${DAY_BY_ID[focusDay].name}: ${analysis.perDay[focusDay][hit.id].toFixed(1)} serii` : '';
    showTooltip(hit, `Tydzień: <b>${w.toFixed(1)}</b> efektywnych serii – ${st.label}${dayTxt}`);
  } else showTooltip(null);
  paintMuscles(display, hovered, colorFn, glowFn);
}

let mode = null, lastMode = null;
function renderLegend(m) {
  const el = document.getElementById('plan-legend');
  if (m === 'preview') {
    el.innerHTML = `<span>udział mięśnia:</span><div class="legend-bar"></div><span>główny</span>`;
    return;
  }
  const th = m === 'day' ? DAY_THRESHOLDS : WEEK_THRESHOLDS;
  const box = (v, t) => `<span class="lg"><i style="background:${cssVolumeColor(v, th)}"></i>${t}</span>`;
  el.innerHTML = (m === 'day' ? '<b>Serie w tym dniu:</b> ' : '<b>Serie tygodniowo:</b> ') +
    box(0, '0') + box(th[0] * 0.8, `&lt; ${th[0]}`) + box((th[0] + th[1]) / 2, `${th[0]}–${th[1]}`) + box(th[2] * 0.75, `${th[1]}–${th[2]}`) + box(th[3] + 2, `&gt; ${th[2]}`);
}

export function enter() {
  body.setPose(standingPose());
  body.setBreath(0.4);
  flyCamera([0, 1.25, 3.4], [0, 0.95, 0]);
  controls.autoRotate = true;
  // parametry do demo/testów: ?focus=mon&picker=wed&preview=row
  const q = new URLSearchParams(location.search);
  if (DAY_BY_ID[q.get('focus')]) focusDay = q.get('focus');
  render();
  if (DAY_BY_ID[q.get('picker')]) {
    openPicker(q.get('picker'));
    if (CATALOG_BY_ID[q.get('preview')]) pickerPreview = CATALOG_BY_ID[q.get('preview')];
  }
}
export function leave() {
  controls.autoRotate = false;
  ui.picker.hidden = true;
  showTooltip(null);
}
export function setOpenInSimulation(fn) { openInSimulation = fn; }
controls.addEventListener('start', () => (controls.autoRotate = false));
