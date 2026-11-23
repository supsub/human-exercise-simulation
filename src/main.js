import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBody } from './body.js';
import { MUSCLES, MUSCLE_BY_ID } from './muscles.js';
import { EXERCISES } from './exercises/index.js';
import { sampleExercise, computeActivations, standingPose, PHASE_KIND } from './exercises/common.js';
import { blendPose, smoothstep } from './kinematics.js';
import { parseCommand } from './commands.js';

// ---------- Scena ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f141c);
scene.fog = new THREE.Fog(0x0f141c, 6, 14);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.set(2.4, 1.5, 2.6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.8, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 1;
controls.maxDistance = 8;

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1f28, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(2.5, 4.5, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 });
sun.shadow.bias = -0.0005;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x7fa8ff, 0.8);
rim.position.set(-3, 2, -3);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4, 64),
  new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.95 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(8, 32, 0x2c3648, 0x222a38);
grid.position.y = 0.001;
scene.add(grid);

const body = createBody();
scene.add(body.root);

// ---------- Kolory aktywacji ----------
const STOPS = [
  [0.0, new THREE.Color(0x4a5a78)],
  [0.2, new THREE.Color(0x3fa7d6)],
  [0.4, new THREE.Color(0xf2c94c)],
  [0.65, new THREE.Color(0xf2994a)],
  [1.0, new THREE.Color(0xeb3b3b)],
];
const tmpColor = new THREE.Color();
function activationColor(a, target = tmpColor) {
  for (let i = 1; i < STOPS.length; i++) {
    if (a <= STOPS[i][0]) {
      const [a0, c0] = STOPS[i - 1], [a1, c1] = STOPS[i];
      return target.copy(c0).lerp(c1, (a - a0) / (a1 - a0));
    }
  }
  return target.copy(STOPS[STOPS.length - 1][1]);
}
const cssColor = (a) => '#' + activationColor(a, new THREE.Color()).getHexString();

// ---------- Stan symulacji ----------
const state = {
  exercise: null,
  t: 0,               // pozycja w cyklu [0,1)
  playing: false,
  speed: 1,
  repsTarget: null,   // null = bez końca
  repsDone: 0,
  blend: null,        // { from: pose, t: 0..1 } – płynne przejście do nowego ćwiczenia
  smoothed: Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02])),
  hovered: null,
  scrubbing: false,
};
let currentPose = standingPose();

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = {
  input: $('cmd'), form: $('cmd-form'), feedback: $('feedback'), chips: $('chips'),
  exName: $('ex-name'), exDesc: $('ex-desc'), exCues: $('ex-cues'),
  phaseName: $('phase-name'), phaseKind: $('phase-kind'), reps: $('reps'),
  timeline: $('timeline'), playhead: $('playhead'), play: $('play'), speed: $('speed'),
  muscleList: $('muscle-list'), tooltip: $('tooltip'), sortMode: $('sort-mode'),
};

for (const ex of EXERCISES) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = ex.name;
  b.onclick = () => startExercise(ex, null);
  ui.chips.appendChild(b);
}

// Lista mięśni z paskami
const rows = {};
for (const m of MUSCLES) {
  const row = document.createElement('div');
  row.className = 'muscle-row';
  row.innerHTML = `<div class="m-name"><span>${m.name}</span><small>${m.latin}</small></div>
    <div class="m-bar"><div class="m-fill"></div></div><div class="m-val">0%</div>`;
  row.onmouseenter = () => (state.hovered = m.id);
  row.onmouseleave = () => (state.hovered = null);
  ui.muscleList.appendChild(row);
  rows[m.id] = { row, fill: row.querySelector('.m-fill'), val: row.querySelector('.m-val') };
}

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
    seg.title = `${p.name} (${PHASE_KIND[p.kind].label})`;
    seg.innerHTML = `<span>${p.name}</span>`;
    ui.timeline.appendChild(seg);
  }
}

function startExercise(ex, reps) {
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
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.textContent === ex.name));
  if (changed) {
    buildTimeline(ex);
    cameraGoal.set(...ex.cameraTarget);
    if (ex.cameraPosition) flyCamera(ex.cameraPosition);
  }
  say(`Wykonuję: ${ex.name}${reps ? ` × ${reps}` : ' (w pętli)'}`);
}

function goRest() {
  state.blend = { from: currentPose, t: 0 };
  state.exercise = null;
  state.playing = false;
  ui.timeline.querySelectorAll('.seg').forEach((s) => s.remove());
  ui.exName.textContent = 'Pozycja stojąca';
  ui.exDesc.textContent = 'Wydaj polecenie, aby rozpocząć ćwiczenie.';
  ui.exCues.innerHTML = '';
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  cameraGoal.set(0, 0.85, 0);
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
  if (e.code === 'Space' && document.activeElement !== ui.input) {
    e.preventDefault();
    ui.play.click();
  }
});

// Przewijanie osi czasu
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

// Najechanie na mięsień w 3D
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerEvent = null;
canvas.addEventListener('pointermove', (e) => (pointerEvent = e));
canvas.addEventListener('pointerleave', () => { pointerEvent = null; state.hovered = null; ui.tooltip.hidden = true; });

function updateHover() {
  if (!pointerEvent) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((pointerEvent.clientX - r.left) / r.width) * 2 - 1, -((pointerEvent.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(body.muscleMeshes, false)[0];
  if (hit) {
    const id = hit.object.userData.muscleId;
    state.hovered = id;
    ui.tooltip.hidden = false;
    ui.tooltip.style.left = pointerEvent.clientX + 14 + 'px';
    ui.tooltip.style.top = pointerEvent.clientY + 14 + 'px';
    ui.tooltip.innerHTML = `<b>${MUSCLE_BY_ID[id].name}</b><br><i>${MUSCLE_BY_ID[id].latin}</i><br>Aktywacja: ${Math.round(state.smoothed[id] * 100)}%`;
  } else {
    state.hovered = null;
    ui.tooltip.hidden = true;
  }
}

// ---------- Kamera ----------
const cameraGoal = new THREE.Vector3(0, 0.85, 0);
let camFly = null; // płynny przelot kamery do widoku dobranego do ćwiczenia
function flyCamera(pos) {
  camFly = { from: camera.position.clone(), to: new THREE.Vector3(...pos), t: 0 };
}
controls.addEventListener('start', () => (camFly = null)); // użytkownik przejmuje kamerę
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- Pętla ----------
const clock = new THREE.Clock();
let lastSort = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const ex = state.exercise;

  // Czas ćwiczenia
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

  // Poza + aktywacje
  let target = standingPose();
  let raw = Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02]));
  let sample = null;
  if (ex) {
    sample = sampleExercise(ex, state.t);
    target = ex.pose(sample.depth);
    raw = computeActivations(ex, sample);
  }
  if (state.blend) {
    state.blend.t = Math.min(1, state.blend.t + dt / 0.9);
    currentPose = blendPose(state.blend.from, target, smoothstep(state.blend.t));
    if (state.blend.t >= 1) state.blend = null;
  } else {
    currentPose = target;
  }
  body.setPose(currentPose);

  // Wygładzenie aktywacji (mięśnie nie reagują natychmiastowo – opóźnienie elektromechaniczne)
  const k = state.scrubbing || !state.playing ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.09);
  for (const m of MUSCLES) {
    state.smoothed[m.id] += (raw[m.id] - state.smoothed[m.id]) * k;
    const a = state.smoothed[m.id];
    const mat = body.materials[m.id];
    activationColor(a, mat.color);
    mat.emissive.copy(mat.color).multiplyScalar(a * 0.45);
    if (state.hovered === m.id) mat.emissive.setRGB(0.5, 0.5, 0.55);
    const r = rows[m.id];
    r.fill.style.width = a * 100 + '%';
    r.fill.style.background = cssColor(a);
    r.val.textContent = Math.round(a * 100) + '%';
    r.row.classList.toggle('hover', state.hovered === m.id);
  }

  // Sortowanie listy (co 300 ms, żeby nie skakała)
  const now = performance.now();
  if (now - lastSort > 300) {
    lastSort = now;
    const order = [...MUSCLES];
    if (ui.sortMode.value === 'activation') order.sort((a, b) => state.smoothed[b.id] - state.smoothed[a.id]);
    order.forEach((m, i) => (rows[m.id].row.style.order = i));
  }

  // Panel fazy / oś czasu
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

  if (camFly) {
    camFly.t = Math.min(1, camFly.t + dt / 1.4);
    camera.position.lerpVectors(camFly.from, camFly.to, smoothstep(camFly.t));
    if (camFly.t >= 1) camFly = null;
  }
  controls.target.lerp(cameraGoal, 1 - Math.exp(-dt * 3));
  controls.update();
  updateHover();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
body.setPose(currentPose);
say('Wpisz polecenie, np. „zrób 5 pompek”, albo wybierz ćwiczenie poniżej.', 'info');
requestAnimationFrame(frame);

// Ułatwienie do testów/demo: ?cmd=zrób%20pompkę uruchamia polecenie od razu
const autoCmd = new URLSearchParams(location.search).get('cmd');
if (autoCmd) {
  ui.input.value = autoCmd;
  ui.form.requestSubmit();
}
const fixedT = new URLSearchParams(location.search).get('t');
if (fixedT !== null && state.exercise) {
  if (state.exercise.cameraPosition) camera.position.set(...state.exercise.cameraPosition);
  camFly = null;
  state.t = parseFloat(fixedT);
  state.playing = false;
  state.blend = null;
}
