import { body, paintMuscles, cssColor, updateStressMarkers, updateBreathPuffs, flyCamera, jumpCamera,
  pickMuscle, showTooltip } from './scene.js';
import { MUSCLES, MUSCLE_GROUPS } from './muscles.js';
import { EXERCISES } from './exercises/index.js';
import { sampleExercise, computeActivations, standingPose, PHASE_KIND, BREATH } from './exercises/common.js';
import { blendPose, smoothstep, lerp } from './kinematics.js';
import { parseCommand } from './commands.js';

// Widok "Symulacja": wykonywanie ćwiczeń, aktywacja mięśni na żywo, oddech, typowe błędy.

const state = {
  exercise: null,
  t: 0,               // pozycja w cyklu [0,1)
  playing: false,
  speed: 1,
  repsTarget: null,   // null = bez końca
  repsDone: 0,
  blend: null,        // { from: pose, t } – płynne przejście do nowego ćwiczenia
  mistake: null,      // wybrany błąd techniki (obiekt) albo null
  mistakeMix: 0,      // 0 = poprawnie, 1 = pełny błąd (animowane przejście)
  smoothed: Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02])),
  hovered: null,
  scrubbing: false,
  idleBreath: 0,
};
let currentPose = standingPose();

const $ = (id) => document.getElementById(id);
const ui = {
  root: $('sim-view'),
  input: $('cmd'), form: $('cmd-form'), feedback: $('feedback'), chips: $('chips'),
  exName: $('ex-name'), exDesc: $('ex-desc'), exCues: $('ex-cues'),
  phaseName: $('phase-name'), phaseKind: $('phase-kind'), reps: $('reps'),
  timeline: $('timeline'), playhead: $('playhead'), play: $('play'), speed: $('speed'),
  muscleList: $('muscle-list'), sortMode: $('sort-mode'),
  breathFill: $('breath-fill'), breathLabel: $('breath-label'), breathTip: $('breath-tip'),
  mistakes: $('mistakes'), mistakeCard: $('mistake-card'),
};

// ---------- Budowa UI ----------
for (const ex of EXERCISES) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.id = ex.id;
  b.textContent = ex.name;
  b.onclick = () => startExercise(ex, null);
  ui.chips.appendChild(b);
}

// Lista mięśni: nagłówki grup + wiersze
const rows = {};
const groupHeaders = {};
MUSCLE_GROUPS.forEach((g, gi) => {
  const h = document.createElement('div');
  h.className = 'group-head';
  h.textContent = g;
  h.style.order = gi * 100;
  ui.muscleList.appendChild(h);
  groupHeaders[g] = h;
});
MUSCLES.forEach((m, i) => {
  const row = document.createElement('div');
  row.className = 'muscle-row';
  row.innerHTML = `<div class="m-name"><span>${m.name}${m.deep ? ' <em>(głęboki)</em>' : ''}</span><small>${m.latin}</small></div>
    <div class="m-bar"><div class="m-fill"></div></div><div class="m-val">0%</div>`;
  row.onmouseenter = () => (state.hovered = m.id);
  row.onmouseleave = () => (state.hovered = null);
  ui.muscleList.appendChild(row);
  rows[m.id] = { row, fill: row.querySelector('.m-fill'), val: row.querySelector('.m-val'), groupIndex: MUSCLE_GROUPS.indexOf(m.group), i };
});

function say(msg, kind = 'ok') {
  ui.feedback.textContent = msg;
  ui.feedback.className = 'feedback ' + kind;
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
  if (!state.mistake) { state.mistake = m; }
  ui.mistakes.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.id === (m ? m.id : '')));
  if (m) {
    ui.mistakeCard.hidden = false;
    ui.mistakeCard.innerHTML = `<h3>✗ ${m.name}</h3>
      <p><b>Co się dzieje:</b> ${m.what}</p>
      <p><b>Dlaczego to problem:</b> ${m.why}</p>
      <p class="fix"><b>Jak poprawić:</b> ${m.fix}</p>`;
    if (!state.playing && state.exercise) state.playing = true;
    flyCamera(m.camera ?? state.exercise?.cameraPosition);
  } else {
    ui.mistakeCard.hidden = true;
    if (state.exercise) flyCamera(state.exercise.cameraPosition);
  }
}

export function startExercise(ex, reps, mistakeId = null) {
  const changed = state.exercise !== ex;
  if (changed) state.blend = { from: currentPose, t: 0 };
  state.exercise = ex;
  state.t = 0;
  state.repsTarget = reps;
  state.repsDone = 0;
  state.playing = true;
  ui.exName.textContent = ex.name;
  ui.exDesc.textContent = ex.description;
  ui.exCues.innerHTML = ex.cues.map((c) => `<li>${c}</li>`).join('');
  ui.breathTip.textContent = ex.breathingTip ?? '';
  ui.chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.id === ex.id));
  if (changed) {
    buildTimeline(ex);
    buildMistakes(ex);
    state.mistake = null;
    state.mistakeMix = 0;
    flyCamera(ex.cameraPosition, ex.cameraTarget);
  }
  if (mistakeId) {
    const m = ex.mistakes.find((x) => x.id === mistakeId);
    if (m) { setMistake(m); state.mistake = m; state.mistakeMix = 1; if (m.camera) state.jumpTo = m.camera; }
  }
  say(`Wykonuję: ${ex.name}${reps ? ` × ${reps}` : ' (w pętli)'}`);
}

function goRest() {
  state.blend = { from: currentPose, t: 0 };
  state.exercise = null;
  state.playing = false;
  state.mistake = null;
  state.mistakeMix = 0;
  ui.timeline.querySelectorAll('.seg').forEach((s) => s.remove());
  ui.exName.textContent = 'Pozycja stojąca';
  ui.exDesc.textContent = 'Wydaj polecenie, aby rozpocząć ćwiczenie.';
  ui.exCues.innerHTML = '';
  ui.breathTip.textContent = 'Spokojny oddech przeponowy: brzuch unosi się przy wdechu.';
  buildMistakes(null);
  ui.mistakeCard.hidden = true;
  ui.chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  flyCamera([2.4, 1.5, 2.6], [0, 0.85, 0]);
  say('Odpoczynek – pozycja stojąca');
}

ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const cmd = parseCommand(ui.input.value);
  switch (cmd.type) {
    case 'exercise': startExercise(cmd.exercise, cmd.reps); break;
    case 'stop': state.playing = false; say('Zatrzymano'); break;
    case 'play': if (state.exercise) { state.playing = true; say('Wznawiam'); } break;
    case 'rest': goRest(); break;
    case 'speed':
      setSpeed(Math.min(2, Math.max(0.25, state.speed * cmd.factor)));
      say(`Tempo: ${state.speed}×`);
      break;
    case 'empty': return;
    default:
      say('Nie rozumiem polecenia. Spróbuj np. „zrób 5 pompek”, „przysiad”, „uginanie”, „stop”.', 'err');
  }
  ui.input.value = '';
});

function setSpeed(v) {
  state.speed = v;
  ui.speed.value = String(v);
}
ui.speed.onchange = () => (state.speed = parseFloat(ui.speed.value));
ui.play.onclick = () => {
  if (!state.exercise) return startExercise(EXERCISES[0], null);
  state.playing = !state.playing;
  if (state.playing && state.repsTarget && state.repsDone >= state.repsTarget) state.repsDone = 0;
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

// ---------- Klatka animacji ----------
let lastSort = 0;
export function frame(dt, time) {
  const ex = state.exercise;

  if (ex && state.playing && (!state.blend || state.blend.t > 0.6)) {
    state.t += (dt * state.speed) / ex.cycle;
    if (state.t >= 1) {
      state.t -= 1;
      state.repsDone++;
      if (state.repsTarget && state.repsDone >= state.repsTarget) {
        state.t = 0;
        state.playing = false;
        say(`Gotowe: ${ex.name} × ${state.repsDone}`);
      }
    }
  }

  // Przejście poprawna technika ↔ błąd
  const wantMix = state.pendingMistake && state.pendingMistake === state.mistake ? 1 : 0;
  state.mistakeMix += Math.sign(wantMix - state.mistakeMix) * Math.min(Math.abs(wantMix - state.mistakeMix), dt / 0.7);
  if (state.mistakeMix === 0 && state.pendingMistake !== state.mistake) state.mistake = state.pendingMistake ?? null;
  const mix = smoothstep(state.mistakeMix);
  const mistake = state.mistake;

  let target = standingPose();
  let raw = Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02]));
  let sample = null, breath;
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
    breath = sample.breath;
  } else {
    // spokojny oddech w spoczynku (~4 s cykl)
    state.idleBreath += dt;
    breath = 0.5 - 0.5 * Math.cos((state.idleBreath * 2 * Math.PI) / 4);
  }
  if (state.blend) {
    state.blend.t = Math.min(1, state.blend.t + dt / 0.9);
    currentPose = blendPose(state.blend.from, target, smoothstep(state.blend.t));
    if (state.blend.t >= 1) state.blend = null;
  } else {
    currentPose = target;
  }
  body.setPose(currentPose);
  body.setBreath(breath);

  // Oddech: wskaźnik + obłoczki przy wydechu
  const breathKind = sample ? sample.phase.breath : (Math.sin((state.idleBreath * 2 * Math.PI) / 4) >= 0 ? 'in' : 'out');
  const moving = sample ? state.playing : true;
  ui.breathFill.style.height = breath * 100 + '%';
  ui.breathLabel.textContent = `${BREATH[breathKind].icon} ${BREATH[breathKind].label}`;
  ui.breathLabel.className = 'breath-label ' + breathKind;
  updateBreathPuffs(dt, breathKind === 'out' && moving ? 1 : 0);

  // Wygładzenie aktywacji (mięśnie nie reagują natychmiastowo – opóźnienie elektromechaniczne)
  const k = state.scrubbing || !state.playing ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.09);
  for (const m of MUSCLES) {
    state.smoothed[m.id] += (raw[m.id] - state.smoothed[m.id]) * k;
    const a = state.smoothed[m.id];
    const r = rows[m.id];
    r.fill.style.width = a * 100 + '%';
    r.fill.style.background = cssColor(a);
    r.val.textContent = Math.round(a * 100) + '%';
    r.row.classList.toggle('hover', state.hovered === m.id);
  }
  // najechanie na mięsień w 3D
  const hit = pickMuscle();
  if (hit) state.hovered = hit.id;
  else if (state.hoverFrom3d) state.hovered = null;
  state.hoverFrom3d = !!hit;
  showTooltip(hit, hit ? `Aktywacja: ${Math.round(state.smoothed[hit.id] * 100)}%` : '');
  paintMuscles(state.smoothed, state.hovered);

  updateStressMarkers(mistake && ex ? mistake.stress : [], mix, time);

  // Sortowanie listy (co 300 ms, żeby nie skakała)
  const now = performance.now();
  if (now - lastSort > 300) {
    lastSort = now;
    const byAct = ui.sortMode.value === 'activation';
    ui.muscleList.classList.toggle('grouped', !byAct);
    if (byAct) {
      [...MUSCLES].sort((a, b) => state.smoothed[b.id] - state.smoothed[a.id]).forEach((m, i) => (rows[m.id].row.style.order = i));
    } else {
      MUSCLES.forEach((m) => (rows[m.id].row.style.order = rows[m.id].groupIndex * 100 + 1 + rows[m.id].i));
    }
  }

  if (sample) {
    ui.phaseName.textContent = sample.phase.name;
    ui.phaseKind.textContent = 'Faza ' + PHASE_KIND[sample.phase.kind].label;
    ui.phaseKind.className = 'phase-kind ' + sample.phase.kind;
    ui.playhead.style.left = state.t * 100 + '%';
    ui.playhead.hidden = false;
    const repNow = state.repsTarget ? Math.min(state.repsDone + 1, state.repsTarget) : state.repsDone + 1;
    ui.reps.textContent = `Powtórzenie ${repNow}${state.repsTarget ? ' / ' + state.repsTarget : ''}`;
  } else {
    ui.phaseName.textContent = '—';
    ui.phaseKind.textContent = '';
    ui.playhead.hidden = true;
    ui.reps.textContent = '';
  }
  ui.play.textContent = state.playing ? '❚❚' : '▶';
}

export function enter() {
  if (state.exercise) flyCamera(state.exercise.cameraPosition, state.exercise.cameraTarget);
  else flyCamera([2.4, 1.5, 2.6], [0, 0.85, 0]);
}
export function leave() {
  state.playing = false;
  updateStressMarkers([], 0, 0);
  showTooltip(null);
}

// Ułatwienie do testów/demo: ?cmd=zrób%20pompkę&t=0.6&mistake=sag
export function applyUrlParams(params) {
  const cmd = params.get('cmd');
  if (cmd) {
    ui.input.value = cmd;
    ui.form.requestSubmit();
  }
  const mistake = params.get('mistake');
  if (mistake && state.exercise) startExercise(state.exercise, null, mistake);
  const fixedT = params.get('t');
  if (fixedT !== null && state.exercise) {
    state.t = parseFloat(fixedT);
    state.playing = false;
    state.blend = null;
    jumpCamera(state.jumpTo ?? state.exercise.cameraPosition, state.exercise.cameraTarget);
  }
}

buildMistakes(null);
say('Wpisz polecenie, np. „zrób 5 pompek”, albo wybierz ćwiczenie poniżej.', 'info');
ui.breathTip.textContent = 'Spokojny oddech przeponowy: brzuch unosi się przy wdechu.';
