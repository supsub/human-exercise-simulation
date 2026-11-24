import { body, paintMuscles, updateStressMarkers, updateBreathPuffs, flyCamera, jumpCamera,
  pickMuscle, showTooltip, cssColor } from './scene.js';
import { MUSCLES } from './muscles.js';
import { EXERCISES, EXERCISE_BY_ID } from './exercises/index.js';
import { sampleExercise, computeActivations, peakActivations, roleOf, ROLES, standingPose, PHASE_KIND, BREATH } from './exercises/common.js';
import { blendPose, smoothstep, lerp } from './kinematics.js';
import { createFigure } from './figure.js';

// Widok "Symulacja": animacja ćwiczenia z kolorowaniem mięśni, oddech, typowe błędy,
// a w panelu statyczna figura (przód/tył) z mięśniami, które pracują w ćwiczeniu.

const state = {
  exercise: null,
  t: 0,               // pozycja w cyklu [0,1)
  playing: false,
  speed: 1,
  repsDone: 0,
  blend: null,        // { from: pose, t } – płynne przejście do nowego ćwiczenia
  mistake: null,      // wybrany błąd techniki (obiekt) albo null
  pendingMistake: null,
  mistakeMix: 0,      // 0 = poprawnie, 1 = pełny błąd (animowane przejście)
  smoothed: Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02])),
  peakGood: {},       // szczytowe aktywacje – poprawna technika
  peakBad: null,      // szczytowe aktywacje – z wybranym błędem
  hovered: null,
  scrubbing: false,
  showNotes: localStorage.getItem('hes.mistakeNotes') !== '0',
};
let currentPose = standingPose();

const $ = (id) => document.getElementById(id);
const ui = {
  root: $('sim-view'), chips: $('ex-chips'),
  exName: $('ex-name'), exDesc: $('ex-desc'), exCues: $('ex-cues'),
  phaseName: $('phase-name'), phaseKind: $('phase-kind'), reps: $('reps'),
  timeline: $('timeline'), playhead: $('playhead'), play: $('play'), speed: $('speed'),
  breathFill: $('breath-fill'), breathLabel: $('breath-label'), breathTip: $('breath-tip'),
  mistakes: $('mistakes'), mistakeInfo: $('mistake-info'), notes: $('mistake-notes'),
  roles: $('roles'),
};
const figure = createFigure($('figure'));

// ---------- Budowa UI ----------
for (const ex of EXERCISES) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.id = ex.id;
  b.textContent = ex.name;
  b.onclick = () => startExercise(ex);
  ui.chips.appendChild(b);
}

function buildTimeline(ex) {
  ui.timeline.querySelectorAll('.seg').forEach((s) => s.remove());
  for (const p of ex.phases) {
    const seg = document.createElement('div');
    seg.className = 'seg ' + p.kind;
    seg.style.left = p.start * 100 + '%';
    seg.style.width = (p.end - p.start) * 100 + '%';
    seg.title = `${p.name} (${PHASE_KIND[p.kind].label}, ${BREATH[p.breath].label.toLowerCase()})`;
    seg.innerHTML = `<span>${p.name}</span><b class="seg-breath">${BREATH[p.breath].icon}</b>`;
    ui.timeline.appendChild(seg);
  }
}

function buildMistakes(ex) {
  ui.mistakes.innerHTML = '';
  if (!ex || !ex.mistakes.length) { ui.mistakes.parentElement.hidden = true; return; }
  ui.mistakes.parentElement.hidden = false;
  const mk = (label, mistake, cls) => {
    const b = document.createElement('button');
    b.className = 'mistake-btn ' + cls;
    b.textContent = label;
    b.onclick = () => setMistake(mistake);
    b.dataset.id = mistake ? mistake.id : '';
    ui.mistakes.appendChild(b);
  };
  mk('✓ Poprawna technika', null, 'good');
  for (const m of ex.mistakes) mk('✗ ' + m.name, m, 'bad');
  setMistake(null);
}

function setMistake(m) {
  // przy zmianie z jednego błędu na inny najpierw wracamy do poprawnej pozy (mix maleje), potem idziemy w nowy
  state.pendingMistake = m;
  if (!state.mistake) state.mistake = m;
  state.peakBad = m && state.exercise ? peakActivations(state.exercise, m) : null;
  ui.mistakes.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.id === (m ? m.id : '')));
  if (m) {
    ui.mistakeInfo.innerHTML = `<p>${m.what}</p>
      <p><b>Dlaczego to problem:</b> ${m.why}</p>
      <p class="fix"><b>Jak poprawić:</b> ${m.fix}</p>`;
    if (!state.playing && state.exercise) state.playing = true;
    flyCamera(m.camera ?? state.exercise?.cameraPosition);
  } else if (state.exercise) {
    flyCamera(state.exercise.cameraPosition);
  }
  ui.mistakeInfo.hidden = !m || !state.showNotes;
  ui.exDesc.hidden = !!m && state.showNotes; // przy opisie błędu chowamy opis ćwiczenia, żeby panel nie był za długi
  renderRoles();
}

ui.notes.checked = state.showNotes;
ui.notes.onchange = () => {
  state.showNotes = ui.notes.checked;
  localStorage.setItem('hes.mistakeNotes', state.showNotes ? '1' : '0');
  ui.mistakeInfo.hidden = !state.pendingMistake || !state.showNotes;
  ui.exDesc.hidden = !!state.pendingMistake && state.showNotes;
};

// Lista ról mięśni (główne / pomocnicze / stabilizujące) – stała dla ćwiczenia, bez procentów.
// Przy błędzie strzałki pokazują, co pracuje mocniej (↑) lub słabiej (↓) niż przy poprawnej technice.
function renderRoles() {
  const ex = state.exercise;
  if (!ex) { ui.roles.innerHTML = ''; return; }
  const peak = state.peakBad ?? state.peakGood;
  const groups = ROLES.map((r) => ({ ...r, items: [] }));
  for (const m of MUSCLES) {
    const role = roleOf(peak[m.id]);
    if (role) groups.find((g) => g.id === role.id).items.push(m);
  }
  ui.roles.innerHTML = groups.filter((g) => g.items.length).map((g) => `
    <div class="role-group"><div class="label">${g.label}</div><div class="role-items">
      ${g.items.sort((a, b) => peak[b.id] - peak[a.id]).map((m) => {
        const diff = state.peakBad ? state.peakBad[m.id] - state.peakGood[m.id] : 0;
        const arrow = diff > 0.07 ? '<b class="up" title="pracuje mocniej niż przy poprawnej technice">↑</b>'
          : diff < -0.07 ? '<b class="down" title="pracuje słabiej niż przy poprawnej technice">↓</b>' : '';
        return `<span class="role-item" data-id="${m.id}"><i style="background:${cssColor(peak[m.id])}"></i>${m.name}${m.deep ? ' <em>(głęboki)</em>' : ''}${arrow}</span>`;
      }).join('')}
    </div></div>`).join('');
  ui.roles.querySelectorAll('.role-item').forEach((el) => {
    el.onmouseenter = () => (state.listHover = el.dataset.id);
    el.onmouseleave = () => (state.listHover = null);
  });
}

export function startExercise(ex, mistakeId = null) {
  const changed = state.exercise !== ex;
  if (changed) state.blend = { from: currentPose, t: 0 };
  state.exercise = ex;
  state.t = 0;
  state.repsDone = 0;
  state.playing = true;
  ui.exName.textContent = ex.name;
  ui.exDesc.textContent = ex.description;
  ui.exCues.innerHTML = ex.cues.map((c) => `<li>${c}</li>`).join('');
  ui.breathTip.textContent = ex.breathingTip ?? '';
  ui.chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.id === ex.id));
  if (changed) {
    state.peakGood = peakActivations(ex);
    buildTimeline(ex);
    state.mistake = null;
    state.mistakeMix = 0;
    buildMistakes(ex);
    flyCamera(ex.cameraPosition, ex.cameraTarget);
  }
  if (mistakeId) {
    const m = ex.mistakes.find((x) => x.id === mistakeId);
    if (m) { setMistake(m); state.mistake = m; state.mistakeMix = 1; if (m.camera) state.jumpTo = m.camera; }
  }
}

ui.speed.onchange = () => (state.speed = parseFloat(ui.speed.value));
ui.play.onclick = () => {
  if (!state.exercise) return startExercise(EXERCISES[0]);
  state.playing = !state.playing;
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !ui.root.hidden && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    ui.play.click();
  }
});

function scrubAt(clientX) {
  const r = ui.timeline.getBoundingClientRect();
  state.t = Math.min(0.9999, Math.max(0, (clientX - r.left) / r.width));
  state.playing = false;
}
ui.timeline.addEventListener('pointerdown', (e) => {
  if (!state.exercise) return;
  state.scrubbing = true;
  ui.timeline.setPointerCapture(e.pointerId);
  scrubAt(e.clientX);
});
ui.timeline.addEventListener('pointermove', (e) => state.scrubbing && scrubAt(e.clientX));
ui.timeline.addEventListener('pointerup', () => (state.scrubbing = false));

function roleText(id) {
  const peak = state.peakBad ?? state.peakGood;
  const r = roleOf(peak[id] ?? 0);
  return r ? `W tym ćwiczeniu ${r.one}` : 'W tym ćwiczeniu prawie nie pracuje';
}

// ---------- Klatka animacji ----------
export function frame(dt, time) {
  const ex = state.exercise;

  if (ex && state.playing && (!state.blend || state.blend.t > 0.6)) {
    state.t += (dt * state.speed) / ex.cycle;
    if (state.t >= 1) { state.t -= 1; state.repsDone++; }
  }

  // Przejście poprawna technika ↔ błąd
  const wantMix = state.pendingMistake && state.pendingMistake === state.mistake ? 1 : 0;
  state.mistakeMix += Math.sign(wantMix - state.mistakeMix) * Math.min(Math.abs(wantMix - state.mistakeMix), dt / 0.7);
  if (state.mistakeMix === 0 && state.pendingMistake !== state.mistake) state.mistake = state.pendingMistake ?? null;
  const mix = smoothstep(state.mistakeMix);
  const mistake = state.mistake;

  let target = standingPose();
  let raw = Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02]));
  let sample = null;
  if (ex) {
    const params = {};
    if (mistake) for (const [k, v] of Object.entries(mistake.params)) params[k] = v * mix;
    sample = sampleExercise(ex, state.t, params.rom ?? 0);
    target = ex.pose(sample.depth, params);
    raw = computeActivations(ex, sample);
    if (mistake && mix > 0) {
      const bad = computeActivations(ex, sample, mistake.muscles);
      for (const id in raw) raw[id] = lerp(raw[id], bad[id], mix);
    }
  }
  if (state.blend) {
    state.blend.t = Math.min(1, state.blend.t + dt / 0.9);
    currentPose = blendPose(state.blend.from, target, smoothstep(state.blend.t));
    if (state.blend.t >= 1) state.blend = null;
  } else {
    currentPose = target;
  }
  body.setPose(currentPose);
  body.setBreath(sample ? sample.breath : 0.4);

  // Oddech: wskaźnik + obłoczki przy wydechu
  if (sample) {
    const kind = sample.phase.breath;
    ui.breathFill.style.height = sample.breath * 100 + '%';
    ui.breathLabel.textContent = `${BREATH[kind].icon} ${BREATH[kind].label}`;
    ui.breathLabel.className = 'breath-label ' + kind;
    updateBreathPuffs(dt, kind === 'out' && state.playing ? 1 : 0);
  }

  // Wygładzenie aktywacji (mięśnie nie reagują natychmiastowo – opóźnienie elektromechaniczne)
  const k = state.scrubbing || !state.playing ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.09);
  for (const m of MUSCLES) state.smoothed[m.id] += (raw[m.id] - state.smoothed[m.id]) * k;

  // Najechanie: na model, na figurę albo na nazwę na liście
  const hit = pickMuscle() ?? figure.pick();
  const hovered = hit?.id ?? state.listHover ?? null;
  showTooltip(hit, hit ? roleText(hit.id) : '');
  paintMuscles(state.smoothed, hovered);
  ui.roles.querySelectorAll('.role-item').forEach((el) => el.classList.toggle('hover', el.dataset.id === hovered));

  // Figura statyczna: szczytowe zaangażowanie (przy błędzie płynnie przechodzi w mapę z błędem)
  if (ex) {
    const fig = {};
    for (const m of MUSCLES) fig[m.id] = state.peakBad && mistake === state.pendingMistake ? lerp(state.peakGood[m.id], state.peakBad[m.id], mix) : state.peakGood[m.id];
    figure.set(fig, hovered);
  }
  figure.render();

  updateStressMarkers(mistake && ex ? mistake.stress : [], mix, time, state.showNotes);

  if (sample) {
    ui.phaseName.textContent = sample.phase.name;
    ui.phaseKind.textContent = PHASE_KIND[sample.phase.kind].hint;
    ui.phaseKind.title = 'Faza ' + PHASE_KIND[sample.phase.kind].label;
    ui.phaseKind.className = 'phase-kind ' + sample.phase.kind;
    ui.playhead.style.left = state.t * 100 + '%';
    ui.playhead.hidden = false;
    ui.reps.textContent = `Powtórzenie ${state.repsDone + 1}`;
  }
  ui.play.textContent = state.playing ? '❚❚' : '▶';
}

export function enter() {
  if (!state.exercise) startExercise(EXERCISES[0]);
  else flyCamera(state.exercise.cameraPosition, state.exercise.cameraTarget);
}
export function leave() {
  state.playing = false;
  updateStressMarkers([], 0, 0);
  showTooltip(null);
}

// Ułatwienie do testów/demo: ?ex=pushup&t=0.6&mistake=sag
export function applyUrlParams(params) {
  const ex = EXERCISE_BY_ID[params.get('ex')];
  if (ex) startExercise(ex);
  const mistake = params.get('mistake');
  if (mistake && state.exercise) startExercise(state.exercise, mistake);
  const fixedT = params.get('t');
  if (fixedT !== null && state.exercise) {
    state.t = parseFloat(fixedT);
    state.playing = false;
    state.blend = null;
    jumpCamera(state.jumpTo ?? state.exercise.cameraPosition, state.exercise.cameraTarget);
  }
}
