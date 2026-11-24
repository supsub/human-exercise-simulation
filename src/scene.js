import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBody } from './body.js';
import { MUSCLES, MUSCLE_BY_ID } from './muscles.js';
import { smoothstep } from './kinematics.js';

// Wspólna scena 3D: renderer, kamera, światła, manekin, kolorowanie mięśni,
// znaczniki przeciążeń i "obłoczki" wydechu. Widoki (symulacja / plan) tylko nią sterują.

const canvas = document.getElementById('scene');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f141c);
scene.fog = new THREE.Fog(0x0f141c, 6, 14);

export const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.set(2.4, 1.5, 2.6);
export const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.85, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 1;
controls.maxDistance = 8;
controls.autoRotateSpeed = 1.2;

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1f28, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(2.5, 4.5, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.008;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x7fa8ff, 0.8);
rim.position.set(-3, 2, -3);
scene.add(rim);

const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(8, 32, 0x2c3648, 0x222a38);
grid.position.y = 0.001;
scene.add(grid);

export const body = createBody();
scene.add(body.root);

// ---------- Kolory aktywacji ----------
// Wygląd organiczny (domyślny; ?look=classic – dawny ludzik): mięśnie w spoczynku w jasnym, stonowanym kolorze bliskim skórze
const ORGANIC = new URLSearchParams(location.search).get('look') !== 'classic';
const STOPS = [
  [0.0, new THREE.Color(ORGANIC ? 0xa9b3c4 : 0x4a5a78)],
  [0.2, new THREE.Color(0x3fa7d6)],
  [0.4, new THREE.Color(0xf2c94c)],
  [0.65, new THREE.Color(0xf2994a)],
  [1.0, new THREE.Color(0xeb3b3b)],
];
const tmpColor = new THREE.Color();
export function activationColor(a, target = tmpColor) {
  for (let i = 1; i < STOPS.length; i++) {
    if (a <= STOPS[i][0]) {
      const [a0, c0] = STOPS[i - 1], [a1, c1] = STOPS[i];
      return target.copy(c0).lerp(c1, (a - a0) / (a1 - a0));
    }
  }
  return target.copy(STOPS[STOPS.length - 1][1]);
}
export const cssColor = (a) => '#' + activationColor(a, new THREE.Color()).getHexString();

// Skala objętości treningowej (plan): szary = brak, żółty = minimum, zielony = optymalnie, pomarańczowy = za dużo.
// v – serie, th – progi [minimum, optimum, maks., przesada]
const VSTOPS = [new THREE.Color(ORGANIC ? 0xa9b3c4 : 0x3a4459), new THREE.Color(0xe0b83c), new THREE.Color(0x4fcf7a), new THREE.Color(0x2fae5e), new THREE.Color(0xf2994a)];
export const WEEK_THRESHOLDS = [3, 8, 20, 28];
export const DAY_THRESHOLDS = [1, 3, 8, 12];
export function volumeColor(v, th = WEEK_THRESHOLDS, target = tmpColor) {
  const xs = [0, ...th];
  for (let i = 1; i < xs.length; i++) {
    if (v <= xs[i]) return target.copy(VSTOPS[i - 1]).lerp(VSTOPS[i], (v - xs[i - 1]) / (xs[i] - xs[i - 1]));
  }
  return target.copy(VSTOPS[VSTOPS.length - 1]);
}
export const cssVolumeColor = (v, th) => '#' + volumeColor(v, th, new THREE.Color()).getHexString();

// values: { muscleId: wartość }, highlight: id podświetlonego mięśnia
// colorFn: (wartość, kolorDocelowy) → kolor; glow: jasność świecenia 0..1
export function paintMuscles(values, highlight = null, colorFn = activationColor, glowFn = (a) => a) {
  for (const m of MUSCLES) {
    const a = values[m.id] ?? 0;
    const mat = body.materials[m.id];
    colorFn(a, mat.color);
    mat.emissive.copy(mat.color).multiplyScalar(Math.min(1, glowFn(a)) * 0.45);
    if (highlight === m.id) mat.emissive.setRGB(0.5, 0.5, 0.55);
  }
}

// ---------- Znaczniki przeciążeń (błędy techniki) ----------
const markerLayer = document.getElementById('markers');
const markerGeo = new THREE.SphereGeometry(1, 24, 16);
const markers = {}; // key -> { meshes, label }
const JOINT_SIDES = { shoulder: ['shoulderL', 'shoulderR'], knee: ['kneeL', 'kneeR'], hip: ['hipL', 'hipR'],
  elbow: ['elbowL', 'elbowR'], ankle: ['ankleL', 'ankleR'], wrist: ['wristL', 'wristR'] };

function getMarker(key, label) {
  if (markers[key]) return markers[key];
  const names = JOINT_SIDES[key] ?? [key];
  const meshes = names.map((n) => {
    const mesh = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.4, depthTest: false }));
    mesh.renderOrder = 10;
    mesh.scale.setScalar(0.07);
    if (key === 'lumbar') mesh.position.set(0, 0.04, -0.06);
    body.joints[n].add(mesh);
    return mesh;
  });
  const el = document.createElement('div');
  el.className = 'stress-label';
  markerLayer.appendChild(el);
  markers[key] = { meshes, el };
  return markers[key];
}

// list: [{ joint, label }], strength 0..1, showLabels: czy pokazywać podpisy (można je wyłączyć)
const _p = new THREE.Vector3();
export function updateStressMarkers(list, strength, time, showLabels = true) {
  const active = new Set(list.map((s) => s.joint));
  for (const s of list) {
    const m = getMarker(s.joint, s.label);
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    for (const mesh of m.meshes) {
      mesh.visible = strength > 0.02;
      mesh.scale.setScalar((0.06 + 0.025 * pulse) * Math.max(strength, 0.01));
      mesh.material.opacity = 0.25 + 0.35 * pulse * strength;
    }
    // etykieta przy pierwszym znaczniku
    m.meshes[0].getWorldPosition(_p).project(camera);
    const r = canvas.getBoundingClientRect();
    m.el.style.left = r.left + ((_p.x + 1) / 2) * r.width + 'px';
    m.el.style.top = r.top + ((1 - _p.y) / 2) * r.height + 'px';
    m.el.textContent = '⚠ ' + s.label;
    m.el.style.opacity = strength;
    m.el.hidden = !showLabels || strength < 0.05 || _p.z > 1;
  }
  for (const [key, m] of Object.entries(markers)) {
    if (active.has(key)) continue;
    m.meshes.forEach((mesh) => (mesh.visible = false));
    m.el.hidden = true;
  }
}

// ---------- Oddech: obłoczki przy wydechu ----------
const puffGeo = new THREE.SphereGeometry(1, 12, 8);
const puffs = Array.from({ length: 24 }, () => {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false;
  m.userData = { life: 0, vel: new THREE.Vector3() };
  scene.add(m);
  return m;
});
let puffTimer = 0;
const _dir = new THREE.Vector3(), _q = new THREE.Quaternion();
// exhaling: czy trwa wydech (0..1 – intensywność)
export function updateBreathPuffs(dt, exhaling) {
  puffTimer -= dt;
  if (exhaling > 0.05 && puffTimer <= 0) {
    puffTimer = 0.07;
    const p = puffs.find((x) => !x.visible);
    if (p) {
      body.nose.getWorldPosition(p.position);
      body.nose.parent.getWorldQuaternion(_q);
      _dir.set((Math.random() - 0.5) * 0.25, -0.15 + (Math.random() - 0.5) * 0.2, 1).normalize().applyQuaternion(_q);
      p.userData.vel.copy(_dir).multiplyScalar(0.35 * exhaling);
      p.userData.life = 1;
      p.visible = true;
    }
  }
  for (const p of puffs) {
    if (!p.visible) continue;
    p.userData.life -= dt / 0.9;
    if (p.userData.life <= 0) { p.visible = false; continue; }
    p.position.addScaledVector(p.userData.vel, dt);
    const l = p.userData.life;
    p.scale.setScalar(0.012 + 0.03 * (1 - l));
    p.material.opacity = 0.35 * l;
  }
}

// ---------- Scenografia ćwiczenia (ławki, drążki, maszyny) ----------
// defs: [{ box: [x,y,z], size: [w,h,d], rx?, color? } | { cyl: [[x,y,z],[x,y,z]], r, color? }]
const sceneryGroup = new THREE.Group();
scene.add(sceneryGroup);
const SCENERY_COLORS = { pad: 0x343b48, frame: 0x5d6572, metal: 0x9aa1ab, wall: 0x232a36 };
const sceneryBox = new THREE.BoxGeometry(1, 1, 1);
const sceneryCyl = new THREE.CylinderGeometry(1, 1, 1, 16);
export function setScenery(defs = []) {
  sceneryGroup.clear();
  for (const d of defs) {
    const mat = new THREE.MeshStandardMaterial({ color: SCENERY_COLORS[d.color ?? (d.box ? 'pad' : 'metal')], roughness: d.box ? 0.8 : 0.35, metalness: d.box ? 0.05 : 0.7 });
    let m;
    if (d.box) {
      m = new THREE.Mesh(sceneryBox, mat);
      m.position.set(...d.box);
      m.scale.set(...d.size);
      m.rotation.x = d.rx ?? 0;
    } else {
      const a = new THREE.Vector3(...d.cyl[0]), b = new THREE.Vector3(...d.cyl[1]);
      m = new THREE.Mesh(sceneryCyl, mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.set(d.r ?? 0.02, a.distanceTo(b), d.r ?? 0.02);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    }
    m.castShadow = m.receiveShadow = true;
    sceneryGroup.add(m);
  }
}

// ---------- Kamera ----------
export const cameraGoal = new THREE.Vector3(0, 0.85, 0);
let camFly = null;
export function flyCamera(pos, target) {
  if (target) cameraGoal.set(...target);
  if (pos) camFly = { from: camera.position.clone(), to: new THREE.Vector3(...pos), t: 0 };
}
export function jumpCamera(pos, target) {
  camera.position.set(...pos);
  cameraGoal.set(...target);
  controls.target.set(...target);
  camFly = null;
}
controls.addEventListener('start', () => (camFly = null));

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Najechanie na mięsień ----------
// Mięśnie nachodzą na siebie (np. głowy czworogłowego), więc nie bierzemy po prostu pierwszego trafienia.
// Zbieramy wszystkie mięśnie, przez które przechodzi promień (w warstwie ~6 cm pod powierzchnią),
// plus kilka promieni wokół kursora, i wybieramy ten, przez którego ŚRODEK promień przechodzi najbliżej
// (odległość liczona w lokalnym układzie bryły, więc mały mięsień ma takie same szanse jak duży).
const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Ray();
const _inv = new THREE.Matrix4();
const _origin = new THREE.Vector3();
const RING = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * 9, Math.sin((i * Math.PI) / 4) * 9])];
export function pickMuscleAt(clientX, clientY, canvasEl, cam, meshes) {
  const r = canvasEl.getBoundingClientRect();
  if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
  let best = null, bestScore = Infinity;
  RING.forEach(([dx, dy], ri) => {
    _ndc.set(((clientX + dx - r.left) / r.width) * 2 - 1, -((clientY + dy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(_ndc, cam);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;
    const near = hits[0].distance;
    for (const h of hits) {
      if (h.distance > near + 0.06) break;
      _inv.copy(h.object.matrixWorld).invert();
      _ray.copy(raycaster.ray).applyMatrix4(_inv);
      // 0 = promień przez środek bryły, 1 = po jej brzegu; promienie z pierścienia mają karę
      const score = Math.sqrt(_ray.distanceSqToPoint(_origin.set(0, 0, 0))) + (ri ? 0.6 : 0);
      if (score < bestScore) { bestScore = score; best = h.object.userData.muscleId; }
    }
  });
  return best ? { id: best, x: clientX, y: clientY } : null;
}

let pointerEvent = null;
canvas.addEventListener('pointermove', (e) => (pointerEvent = e));
canvas.addEventListener('pointerleave', () => (pointerEvent = null));
// Zwraca { id, x, y } mięśnia pod kursorem na głównej scenie albo null
export function pickMuscle() {
  if (!pointerEvent) return null;
  return pickMuscleAt(pointerEvent.clientX, pointerEvent.clientY, canvas, camera, body.muscleMeshes);
}

const tooltip = document.getElementById('tooltip');
export function showTooltip(hit, extraHtml) {
  if (!hit) { tooltip.hidden = true; return; }
  const m = MUSCLE_BY_ID[hit.id];
  tooltip.hidden = false;
  tooltip.style.left = hit.x + 14 + 'px';
  tooltip.style.top = hit.y + 14 + 'px';
  tooltip.innerHTML = `<b>${m.name}</b><br><i>${m.latin}</i>${extraHtml ? '<br>' + extraHtml : ''}`;
}

// ---------- Pętla ----------
const clock = new THREE.Clock();
let onFrame = () => {};
export function setFrameHandler(fn) { onFrame = fn; }

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  onFrame(dt, clock.elapsedTime);
  if (camFly) {
    camFly.t = Math.min(1, camFly.t + dt / 1.4);
    camera.position.lerpVectors(camFly.from, camFly.to, smoothstep(camFly.t));
    if (camFly.t >= 1) camFly = null;
  }
  controls.target.lerp(cameraGoal, 1 - Math.exp(-dt * 3));
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
