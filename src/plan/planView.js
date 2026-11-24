import { paintMuscles, flyCamera, jumpCamera, controls, body, pickMuscle, showTooltip, cssColor, volumeColor, cssVolumeColor, updateBreathPuffs, WEEK_THRESHOLDS, DAY_THRESHOLDS } from '../scene.js';
import { MUSCLES, MUSCLE_BY_ID } from '../muscles.js';
import { standingPose, sampleExercise, computeActivations, peakActivations, roleOf, ROLES } from '../exercises/common.js';
import { EXERCISE_BY_ID } from '../exercises/index.js';
import { blendPose, smoothstep } from '../kinematics.js';
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
  pickerList: $('picker-list'), pickerClose: $('picker-close'), browse: $('picker-browse'), detail: $('picker-detail'),
};

let store = load();
let rendering = false;
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
  if (typeof renderDetail === 'function' && preview && !ui.detail.hidden && !rendering) { rendering = true; renderDetail(); rendering = false; }
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
    card.querySelector('.day-name').onclick = () => { if (preview) closePanel(); focusDay = focusDay === d.id ? null : d.id; render(); };
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
          ${ex.animated ? '<button class="icon play-ex" title="Szczegóły: animacja i pracujące mięśnie">▶</button>' : '<button class="icon play-ex static" title="Szczegóły: zaangażowane mięśnie na modelu">◉</button>'}
          <button class="icon del" title="Usuń">✕</button>`;
        const [setsIn, repsIn] = row.querySelectorAll('input');
        setsIn.onchange = () => { it.sets = clampInt(setsIn.value, 1, 10); render(); };
        repsIn.onchange = () => { it.reps = clampInt(repsIn.value, 1, 50); render(); };
        row.querySelector('.del').onclick = () => { day.items.splice(idx, 1); render(); };
        if (preview?.ex === ex) row.classList.add('previewing');
        row.querySelector('.play-ex').onclick = () => (preview?.ex === ex ? closePanel() : openDetail(ex, 'plan', d.id));
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
  ui.focus.innerHTML = preview
    ? `Podgląd: <b>${esc(preview.ex.name)}</b> <button id="focus-week" class="link">wróć do mapy planu</button>`
    : focusDay
    ? `Pokazuję: <b>${DAY_BY_ID[focusDay].name}</b> <button id="focus-week" class="link">pokaż cały tydzień</button>`
    : 'Pokazuję: <b>cały tydzień</b> <span class="muted">(kliknij nazwę dnia, aby zobaczyć jeden trening)</span>';
  ui.focus.querySelector('#focus-week')?.addEventListener('click', () => { if (preview) closePanel(); else { focusDay = null; render(); } });

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
          <div><button class="link rec-name" data-i="${i}" title="Szczegóły ćwiczenia">${ex.name}</button> <span class="muted">· ${ex.equipment}</span><br>
          <small>Uzupełnia: ${r.fixes.map((id) => MUSCLE_BY_ID[id].name).join(', ')}</small></div>
          ${r.day ? `<button data-i="${i}">+ ${DAY_BY_ID[r.day].short}</button>` : ''}
        </div>`;
      }).join('')
    : '<div class="muted">Brak – wszystkie mięśnie dostają minimum bodźca.</div>';
  ui.recs.querySelectorAll('.rec-name').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    openDetail(CATALOG_BY_ID[r.exId], 'plan', r.day);
  }));
  ui.recs.querySelectorAll('button[data-i]:not(.rec-name)').forEach((b) => (b.onclick = () => {
    const r = a.recommendations[+b.dataset.i];
    p.days[r.day].items.push({ exId: r.exId, sets: 3, reps: 10 });
    render();
  }));
}

// ---------- Panel ćwiczeń: lista wyboru i szczegóły ----------
// Panel otwiera się po prawej stronie; plan po lewej i model na środku cały czas są widoczne.
let pickerDay = null, pickerCat = null;
let pickerPreview = null;  // podgląd mięśni po najechaniu na pozycję listy
let detailFrom = null;     // 'list' | 'plan' – skąd otwarto szczegóły (decyduje o "wróć")
let detailDay = null;      // dzień, do którego domyślnie dodajemy z widoku szczegółów
let detailHover = null;    // mięsień wskazany na liście w szczegółach
let detailNote = '';       // potwierdzenie po dodaniu

function openPicker(dayId) {
  pickerDay = dayId;
  closePreview(false);
  ui.pickerSearch.value = '';
  ui.picker.hidden = false;
  showBrowse();
  ui.pickerSearch.focus();
}
function showBrowse() {
  closePreview(false);
  ui.pickerTitle.textContent = `Dodaj ćwiczenie – ${DAY_BY_ID[pickerDay].name}`;
  ui.browse.hidden = false;
  ui.detail.hidden = true;
  renderPicker();
  render();
}
function closePanel() {
  ui.picker.hidden = true;
  pickerPreview = null;
  closePreview();
}
function openDetail(ex, from, dayId = null, instantT = null) {
  detailFrom = from;
  detailDay = dayId ?? pickerDay ?? focusDay ?? DAYS.find((d) => plan().days[d.id].active)?.id ?? 'mon';
  detailNote = '';
  pickerPreview = null;
  ui.picker.hidden = false;
  ui.browse.hidden = true;
  ui.detail.hidden = false;
  ui.pickerTitle.textContent = from === 'list' ? `Dodaj ćwiczenie – ${DAY_BY_ID[pickerDay].name}` : 'Szczegóły ćwiczenia';
  openPreview(ex, instantT);
  ui.detail.scrollTop = 0;
}

ui.pickerCats.innerHTML = ['Wszystkie', ...CATEGORIES].map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join('');
ui.pickerCats.querySelectorAll('button').forEach((b) => (b.onclick = () => { pickerCat = b.dataset.c === 'Wszystkie' ? null : b.dataset.c; renderPicker(); }));
ui.pickerSearch.oninput = renderPicker;
ui.pickerClose.onclick = closePanel;
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || ui.root.hidden) return;
  if (!ui.picker.hidden && !ui.detail.hidden && detailFrom === 'list') showBrowse();
  else closePanel();
});

const helpsOf = (ex) => Object.entries(ex.muscles).filter(([id, w]) => w >= 0.5 && analysis.weekly[id] < 3).map(([id]) => id);

function renderPicker() {
  const q = ui.pickerSearch.value.toLowerCase().trim();
  ui.pickerCats.querySelectorAll('button').forEach((b) => b.classList.toggle('active', (b.dataset.c === 'Wszystkie' && !pickerCat) || b.dataset.c === pickerCat));
  const items = CATALOG.filter((ex) => (!pickerCat || ex.category === pickerCat) &&
    (!q || ex.name.toLowerCase().includes(q) || Object.keys(ex.muscles).some((id) => MUSCLE_BY_ID[id].name.toLowerCase().includes(q))));
  // ćwiczenia uzupełniające braki w planie pokazujemy na górze
  items.sort((a, b) => helpsOf(b).length - helpsOf(a).length);
  ui.pickerList.innerHTML = items.map((ex) => {
    const helps = helpsOf(ex).length;
    const tags = Object.entries(ex.muscles).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([id, w]) => `<span class="mtag" style="border-color:${cssColor(w * 0.9)}">${MUSCLE_BY_ID[id].name}</span>`).join('');
    return `<div class="pick" data-id="${ex.id}" tabindex="0">
      <div class="pick-body">
        <div class="pick-head"><b>${ex.name}</b>${ex.animated ? '<span class="anim">▶ animacja 3D</span>' : ''}${helps ? `<span class="helps">uzupełnia ${helps} ${helps === 1 ? 'brak' : 'braki'}</span>` : ''}</div>
        <div class="pick-meta">${ex.category} · ${ex.equipment}</div><div class="mtags">${tags}</div>
      </div>
      <button class="quick-add" title="Dodaj od razu (3 × 10)">+</button>
    </div>`;
  }).join('') || '<div class="muted">Brak ćwiczeń pasujących do wyszukiwania.</div>';
  ui.pickerList.querySelectorAll('.pick').forEach((el) => {
    const ex = CATALOG_BY_ID[el.dataset.id];
    el.onclick = () => openDetail(ex, 'list');
    el.onkeydown = (e) => { if (e.key === 'Enter') openDetail(ex, 'list'); };
    el.querySelector('.quick-add').onclick = (e) => {
      e.stopPropagation();
      plan().days[pickerDay].active = true;
      plan().days[pickerDay].items.push({ exId: ex.id, sets: 3, reps: 10 });
      render();
      renderPicker();
      el.classList.add('added');
    };
    el.onmouseenter = () => (pickerPreview = ex);
    el.onmouseleave = () => (pickerPreview = null);
  });
}

// Szczegóły: jak wykonać, co trenuje (role mięśni), co zmieni w planie, dodanie do wybranego dnia
function renderDetail() {
  if (!preview || ui.detail.hidden) return;
  const { ex, anim } = preview;
  const p = plan();
  const level = (id) => (anim ? preview.peak[id] : (ex.muscles[id] ?? 0) * 0.6);
  const groups = ROLES.map((r) => ({ ...r, items: MUSCLES.filter((m) => roleOf(level(m.id))?.id === r.id) })).filter((g) => g.items.length);
  const inPlan = DAYS.flatMap((d) => p.days[d.id].active ? p.days[d.id].items.filter((it) => it.exId === ex.id).map((it) => `${d.short} ${it.sets}×${it.reps}`) : []);
  const fixes = helpsOf(ex);
  // jak zmieni się pokrycie po dodaniu 3 serii do wybranego dnia
  const trial = JSON.parse(JSON.stringify(p));
  trial.days[detailDay].active = true;
  trial.days[detailDay].items.push({ exId: ex.id, sets: 3, reps: 10 });
  const after = analyzePlan(trial);
  const gain = after.trained - analysis.trained;

  ui.detail.innerHTML = `
    ${detailFrom === 'list' ? '<button class="link back">← wróć do listy</button>' : ''}
    <div class="d-title"><h2>${esc(ex.name)}</h2>
      <div class="muted small">${ex.category} · ${ex.equipment} · ${anim ? '▶ animacja na modelu' : '◉ mapa mięśni na modelu (obraca się)'}</div></div>

    <div class="d-add">
      <div class="d-add-row">
        <select class="d-day" title="Dzień">${DAYS.map((d) => `<option value="${d.id}" ${d.id === detailDay ? 'selected' : ''}>${d.name}${p.days[d.id].active ? '' : ' (odpoczynek)'}</option>`).join('')}</select>
        <input class="d-sets" type="number" min="1" max="10" value="3" title="Serie"><span class="x">×</span>
        <input class="d-reps" type="number" min="1" max="50" value="10" title="Powtórzenia">
        <button class="d-add-btn">+ Dodaj</button>
      </div>
      <div class="d-impact">${detailNote || (gain > 0
        ? `Po dodaniu: <b>${analysis.trained} → ${after.trained}</b> mięśni z wystarczającym bodźcem.`
        : fixes.length ? 'Wzmocni słabiej trenowane partie.' : 'Mięśnie z tego ćwiczenia już są trenowane w planie.')}
        ${inPlan.length ? `<br><span class="muted">Już w planie: ${inPlan.join(', ')}</span>` : ''}</div>
    </div>

    <h3>Jak wykonać</h3>
    <p class="d-text">${ex.how}</p>
    <p class="d-tip">💡 ${ex.tip}</p>

    <h3>Co trenuje</h3>
    ${groups.map((g) => `<div class="role-group"><div class="label">${g.label}</div><div class="role-items">
      ${g.items.sort((a, b) => level(b.id) - level(a.id)).map((m) => `<span class="role-item${fixes.includes(m.id) ? ' fix' : ''}" data-id="${m.id}"
        title="${fixes.includes(m.id) ? 'W Twoim planie ten mięsień dostaje za mało pracy' : ''}"><i style="background:${cssColor(anim ? level(m.id) : (ex.muscles[m.id] ?? 0) * 0.9)}"></i>${m.name}${m.deep ? ' <em>(głęboki)</em>' : ''}${fixes.includes(m.id) ? ' <b class="up">+</b>' : ''}</span>`).join('')}
    </div></div>`).join('')}
    ${fixes.length ? '<div class="muted small" style="margin-top:6px"><b class="up">+</b> mięśnie, których brakuje w Twoim planie</div>' : ''}

    ${anim ? `
      <h3>Wskazówki techniczne</h3>
      <ul class="cues">${anim.cues.map((c) => `<li>${c}</li>`).join('')}</ul>
      ${anim.mistakes.length ? `<h3>Typowe błędy</h3><ul class="cues">${anim.mistakes.map((m) => `<li>${m.name}</li>`).join('')}</ul>` : ''}
      <button class="d-sim">Pełna symulacja: fazy ruchu, oddech, błędy →</button>` : ''}
  `;
  ui.detail.querySelector('.back')?.addEventListener('click', showBrowse);
  const daySel = ui.detail.querySelector('.d-day');
  daySel.onchange = () => { detailDay = daySel.value; detailNote = ''; renderDetail(); };
  ui.detail.querySelector('.d-add-btn').onclick = () => {
    const sets = clampInt(ui.detail.querySelector('.d-sets').value, 1, 10);
    const reps = clampInt(ui.detail.querySelector('.d-reps').value, 1, 50);
    p.days[detailDay].active = true;
    p.days[detailDay].items.push({ exId: ex.id, sets, reps });
    render();
    detailNote = `✓ Dodano: ${DAY_BY_ID[detailDay].name}, ${sets} × ${reps}. Pokrycie planu: ${analysis.trained} z ${MUSCLES.length} mięśni.`;
    renderDetail();
  };
  ui.detail.querySelectorAll('.role-item').forEach((el) => {
    el.onmouseenter = () => (detailHover = el.dataset.id);
    el.onmouseleave = () => (detailHover = null);
  });
  ui.detail.querySelector('.d-sim')?.addEventListener('click', () => { const id = ex.animated; closePanel(); openInSimulation(id); });
}

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

// ---------- Podgląd ćwiczenia w planie (bez wychodzenia z widoku) ----------
// Ćwiczenia z animacją są odtwarzane na modelu z kolorami aktywacji, pozostałe pokazują mapę zaangażowania.
const PLAN_CAMERA = [[0, 1.25, 3.4], [0, 0.95, 0]];
let preview = null;         // { ex: pozycja katalogu, anim: definicja ćwiczenia | null, t, peak }
let pose = standingPose();
let poseBlend = null;       // { from, t }

// W planie panele są szersze niż w symulacji – kamera trochę dalej od celu
function previewCamera(anim) {
  const tg = anim.cameraTarget ?? [0, 0.85, 0];
  return [anim.cameraPosition.map((v, i) => tg[i] + (v - tg[i]) * 1.3), tg];
}
// instantT: (demo/testy) od razu ustaw pozę w danym punkcie cyklu, bez przejścia i animacji
function openPreview(ex, instantT = null) {
  const anim = ex.animated ? EXERCISE_BY_ID[ex.animated] : null;
  preview = { ex, anim, t: instantT ?? 0, frozen: instantT !== null, peak: anim ? peakActivations(anim) : null };
  poseBlend = instantT !== null ? null : { from: pose, t: 0 };
  controls.autoRotate = !anim; // bez animacji: obracamy model, żeby było widać też mięśnie z tyłu
  if (anim && instantT !== null) jumpCamera(...previewCamera(anim));
  else if (anim) flyCamera(...previewCamera(anim));
  else flyCamera(...PLAN_CAMERA);
  render();
}
function closePreview(rerender = true) {
  if (!preview) return;
  preview = null;
  detailHover = null;
  poseBlend = { from: pose, t: 0 };
  flyCamera(...PLAN_CAMERA);
  if (rerender) render();
}

function previewFrame(dt) {
  let target = standingPose();
  let values;
  if (preview?.anim) {
    const a = preview.anim;
    if (!preview.frozen && (!poseBlend || poseBlend.t > 0.6)) preview.t = (preview.t + dt / a.cycle) % 1;
    const s = sampleExercise(a, preview.t);
    target = a.pose(s.depth, {});
    values = computeActivations(a, s);
    body.setBreath(s.breath);
    updateBreathPuffs(dt, s.phase.breath === 'out' ? 1 : 0);
  } else {
    body.setBreath(0.4);
    updateBreathPuffs(dt, 0);
  }
  if (poseBlend) {
    poseBlend.t = Math.min(1, poseBlend.t + dt / 0.8);
    pose = blendPose(poseBlend.from, target, smoothstep(poseBlend.t));
    if (poseBlend.t >= 1) poseBlend = null;
  } else pose = target;
  body.setPose(pose);
  return values;
}

// ---------- Klatka animacji ----------
export function frame(dt) {
  if (!analysis) return;
  const animValues = previewFrame(dt);
  // Trzy tryby: podgląd ćwiczenia z listy (udział mięśni), jeden dzień, cały tydzień
  let target, colorFn, glowFn, tipEx = preview?.ex;
  if (preview?.anim) {
    target = animValues;
    colorFn = undefined; glowFn = undefined;
    mode = 'anim';
  } else if ((pickerPreview && !ui.picker.hidden) || preview) {
    const src = pickerPreview && !ui.picker.hidden ? pickerPreview : preview.ex;
    tipEx = src;
    target = Object.fromEntries(MUSCLES.map((m) => [m.id, (src.muscles[m.id] ?? 0) * 0.9]));
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
  const k = 1 - Math.exp(-dt / (mode === 'anim' ? 0.09 : 0.15));
  for (const id in display) display[id] += (target[id] - display[id]) * k;

  const hit = pickMuscle();
  hovered = hit?.id ?? detailHover ?? null;
  if (hit && (mode === 'anim' || mode === 'preview')) {
    const r = mode === 'anim' ? roleOf(preview.peak[hit.id]) : roleOf((tipEx.muscles[hit.id] ?? 0) * 0.6);
    showTooltip(hit, `${esc(tipEx.name)}: ${r ? r.one : 'prawie nie pracuje'}`);
  } else if (hit) {
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
  if (m === 'anim') {
    el.innerHTML = `<span>aktywacja mięśni:</span><div class="legend-bar"></div><span>mocno</span>`;
    return;
  }
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
  pose = standingPose();
  poseBlend = null;
  preview = null;
  ui.picker.hidden = true;
  body.setPose(pose);
  body.setBreath(0.4);
  flyCamera(...PLAN_CAMERA);
  controls.autoRotate = true;
  // parametry do demo/testów: ?focus=mon&picker=wed&preview=row
  const q = new URLSearchParams(location.search);
  if (DAY_BY_ID[q.get('focus')]) focusDay = q.get('focus');
  render();
  const instantT = q.has('t') ? parseFloat(q.get('t')) : null;
  if (CATALOG_BY_ID[q.get('show')]) openDetail(CATALOG_BY_ID[q.get('show')], 'plan', null, instantT);
  if (DAY_BY_ID[q.get('picker')]) {
    openPicker(q.get('picker'));
    if (CATALOG_BY_ID[q.get('preview')]) pickerPreview = CATALOG_BY_ID[q.get('preview')];
    if (CATALOG_BY_ID[q.get('detail')]) openDetail(CATALOG_BY_ID[q.get('detail')], 'list', null, instantT);
  }
}
export function leave() {
  controls.autoRotate = false;
  ui.picker.hidden = true;
  preview = null;
  updateBreathPuffs(0, 0);
  showTooltip(null);
}
export function setOpenInSimulation(fn) { openInSimulation = fn; }
controls.addEventListener('start', () => (controls.autoRotate = false));
