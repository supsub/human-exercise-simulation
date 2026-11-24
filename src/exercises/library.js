import { animated, keyframes, makePose } from './build.js';
import { DIMS } from '../dims.js';
import { twoBoneIK, downAngle } from '../kinematics.js';
import squat from './squat.js';
import curl from './curl.js';

// Animacje wszystkich ćwiczeń katalogu poza pompką, przysiadem i uginaniem (te mają własne pliki z typowymi błędami).
// Konwencje kątów: patrz build.js.

const D = 180 / Math.PI;
const FEET = { anchor: { pt: 'ankleL', at: { y: DIMS.ankleHeight, z: 0 } }, foot: 0 };

// ---------- Scenografia ----------
const flatBench = [
  { box: [0, 0.2, -0.2], size: [0.32, 0.4, 1.25] },
  { box: [0, 0.05, 0.3], size: [0.5, 0.1, 0.08], color: 'frame' },
  { box: [0, 0.05, -0.7], size: [0.5, 0.1, 0.08], color: 'frame' },
];
const pullBar = (y = 2.12) => [
  { cyl: [[-0.75, y, 0], [0.75, y, 0]], r: 0.018 },
  { cyl: [[0.75, 0, 0], [0.75, y + 0.05, 0]], r: 0.035, color: 'frame' },
  { cyl: [[-0.75, 0, 0], [-0.75, y + 0.05, 0]], r: 0.035, color: 'frame' },
];
const seat = (y = 0.45, z = 0, d = 0.42) => ({ box: [0, y / 2, z], size: [0.4, y, d] });
const column = (z, h = 2.4) => ({ box: [0, h / 2, z], size: [0.16, h, 0.16], color: 'frame' });

// ---------- Klatka ----------
const lying = { rx: -90, head: -90, root: { y: 0.55, z: 0.25 }, thigh: -75, shin: 35, foot: 0 };

const bench = animated({
  id: 'bench', camera: 'lie', scenery: flatBench,
  steps: ['Sztanga nad klatką', 'Opuszczanie sztangi', 'Sztanga przy klatce', 'Wyciskanie'],
  pose: keyframes({ ...lying, props: { bar: { len: 1.6 } } }, { shX: -88, abd: 14, el: -6 }, { shX: -14, abd: 66, el: -100 }),
});
const db_bench = animated({
  id: 'db_bench', camera: 'lie', scenery: flatBench,
  steps: ['Hantle nad klatką', 'Opuszczanie hantli', 'Hantle przy klatce', 'Wyciskanie'],
  pose: keyframes({ ...lying, props: { dumbbells: true } }, { shX: -88, abd: 10, el: -6 }, { shX: -12, abd: 58, el: -98 }),
});
const inclineSetup = {
  rx: -55, head: -45, root: { y: 0.56, z: 0.2 }, thigh: -85, shin: 15, foot: 0,
};
const inclineBench = [
  { box: [0, 0.22, 0.25], size: [0.32, 0.44, 0.38] },
  { box: [0, 0.59, -0.15], size: [0.32, 0.8, 0.08], rx: -55 * Math.PI / 180 },
  { box: [0, 0.2, -0.25], size: [0.08, 0.4, 0.08], color: 'frame' },
];
const incline_db = animated({
  id: 'incline_db', camera: 'lie', scenery: inclineBench,
  steps: ['Hantle nad barkami', 'Opuszczanie hantli', 'Hantle przy klatce', 'Wyciskanie skośnie w górę'],
  pose: keyframes({ ...inclineSetup, props: { dumbbells: true } }, { shX: -118, abd: 10, el: -6 }, { shX: -22, abd: 58, el: -100 }),
});
const dips = animated({
  id: 'dips', camera: 'hang',
  scenery: [
    { cyl: [[0.24, 1.12, -0.4], [0.24, 1.12, 0.35]], r: 0.02 }, { cyl: [[-0.24, 1.12, -0.4], [-0.24, 1.12, 0.35]], r: 0.02 },
    { cyl: [[0.24, 0, 0.3], [0.24, 1.12, 0.3]], r: 0.03, color: 'frame' }, { cyl: [[-0.24, 0, 0.3], [-0.24, 1.12, 0.3]], r: 0.03, color: 'frame' },
  ],
  steps: ['Podpór na poręczach', 'Opuszczanie ciała', 'Dolna pozycja', 'Wypychanie w górę'],
  pose: keyframes({ thigh: -20, shin: 70, grip: 1, anchor: { pt: 'handL', at: { y: 1.12, z: 0 } } },
    { rx: 10, arm: 0, fore: 0 }, { rx: 25, arm: 72, fore: -6 }),
});
const fly = animated({
  id: 'fly', camera: 'lie', scenery: flatBench,
  steps: ['Hantle nad klatką', 'Rozkładanie ramion', 'Rozciągnięcie klatki', 'Łączenie ramion nad klatką'],
  pose: keyframes({ ...lying, props: { dumbbells: true } }, { shX: -88, abd: 6, el: -14 }, { shX: -6, abd: 84, el: -28 }),
});
const cableTowers = [
  { box: [0.98, 1.05, -0.15], size: [0.14, 2.1, 0.14], color: 'frame' },
  { box: [-0.98, 1.05, -0.15], size: [0.14, 2.1, 0.14], color: 'frame' },
];
const cable_fly = animated({
  id: 'cable_fly', type: 'lift', scenery: cableTowers,
  steps: ['Ręce rozłożone', 'Prowadzenie rąk łukiem do przodu', 'Dłonie przed klatką', 'Powrót do rozłożenia'],
  pose: keyframes({ ...FEET, rx: 8, trunk: 15, head: 5, props: { cable: { from: [[0.92, 1.95, -0.15], [-0.92, 1.95, -0.15]] } } },
    { shX: -25, abd: 78, el: -22 }, { shX: -82, abd: 10, el: -16 }),
});

// ---------- Plecy ----------
const pullup = animated({
  id: 'pullup', type: 'lift', camera: 'hang', scenery: pullBar(),
  steps: ['Zwis na drążku', 'Podciąganie', 'Broda nad drążkiem', 'Opuszczanie'],
  pose: keyframes({ anchor: { pt: 'handL', at: { y: 2.12, z: 0 } }, thigh: -10, shin: 30, grip: 1 },
    { arm: 180, fore: 180, rx: 0, trunk: 0 }, { arm: 348, fore: 176, rx: -8, trunk: -14, head: -5 }),
});
const pulldownMachine = [seat(0.44), { cyl: [[-0.25, 0.68, 0.3], [0.25, 0.68, 0.3]], r: 0.05, color: 'pad' }, column(-0.45, 2.5),
  { box: [0, 2.47, -0.2], size: [0.1, 0.06, 0.55], color: 'frame' }];
const seated = { root: { y: 0.52, z: 0 }, thigh: -85, shin: 5, foot: 0 };
const lat_pulldown = animated({
  id: 'lat_pulldown', type: 'lift', camera: 'seat', scenery: pulldownMachine,
  steps: ['Ręce wyprostowane w górze', 'Ściąganie drążka do klatki', 'Drążek przy klatce', 'Powrót w górę'],
  pose: keyframes({ ...seated, rx: -8, trunk: -12, props: { bar: { len: 1.1, plates: false }, cable: { from: [[0, 2.45, 0.05]] } } },
    { arm: 175, fore: 180 }, { arm: 340, fore: 186 }),
});
const lat_pulldown_wide = animated({
  id: 'lat_pulldown_wide', type: 'lift', camera: 'seat', scenery: pulldownMachine,
  steps: ['Szeroki chwyt, ręce w górze', 'Ściąganie łokciami w dół i na boki', 'Drążek przy klatce', 'Powrót w górę'],
  pose: keyframes({ ...seated, rx: -8, trunk: -14, props: { bar: { len: 1.5, plates: false }, cable: { from: [[0, 2.45, 0.05]] } } },
    { shX: 0, abd: 158, rot: 90, el: -8 }, { shX: 0, abd: 62, rot: 90, el: -105 }),
});
const hinge = { ...FEET, rx: 65, head: 40, thigh: -22, shin: 16 };
const row = animated({
  id: 'row', type: 'lift',
  steps: ['Pochylenie, sztanga w dół', 'Przyciąganie do brzucha', 'Ściągnięte łopatki', 'Opuszczanie sztangi'],
  pose: keyframes({ ...hinge, props: { bar: { len: 1.6 } } }, { arm: 2, fore: 0 }, { arm: 78, fore: -18 }),
});
const db_row = animated({
  id: 'db_row', type: 'lift',
  scenery: [{ box: [-0.22, 0.25, 0.55], size: [0.35, 0.5, 0.9] }],
  steps: ['Hantel w opuszczonej ręce', 'Przyciąganie do biodra', 'Łokieć z tyłu', 'Opuszczanie'],
  pose: keyframes({ ...FEET, rx: 72, trunk: 78, head: 50, thigh: [-28, -14], shin: [18, 8], props: { dumbbells: 'L' } },
    { arm: [2, -40], fore: [0, -40] }, { arm: [72, -40], fore: [-14, -40] }),
});
const cable_row = animated({
  id: 'cable_row', type: 'lift', camera: 'floor',
  scenery: [{ box: [0, 0.16, -0.1], size: [0.35, 0.32, 1.0] }, { box: [0, 0.18, 0.86], size: [0.5, 0.36, 0.05], color: 'frame' }, column(1.7, 1.2)],
  steps: ['Ręce wyciągnięte do przodu', 'Przyciąganie uchwytu do brzucha', 'Ściągnięte łopatki', 'Powrót do przodu'],
  pose: keyframes({ root: { y: 0.42, z: 0 }, thigh: -80, shin: -62, foot: -95, head: 0,
    props: { bar: { len: 0.28, plates: false }, cable: { from: [[0, 0.52, 1.62]] } } },
  { rx: 5, trunk: 18, arm: -82, fore: -86 }, { rx: -6, trunk: -6, arm: 42, fore: -98 }),
  cameraPosition: [2.4, 1.2, 2.0], cameraTarget: [0, 0.55, 0.3],
});
const incline_row = animated({
  id: 'incline_row', type: 'lift',
  scenery: [{ box: [0, 1.04, 0.47], size: [0.34, 0.85, 0.08], rx: 52 * Math.PI / 180 }, { box: [0, 0.45, 0.62], size: [0.08, 0.9, 0.08], color: 'frame' }],
  steps: ['Klatka na ławce, ręce w dół', 'Przyciąganie hantli', 'Ściągnięte łopatki', 'Opuszczanie'],
  pose: keyframes({ ...FEET, rx: 50, trunk: 52, head: 35, thigh: -8, shin: 14, props: { dumbbells: true } },
    { arm: 0, fore: 0 }, { arm: 74, fore: -12 }),
});
const face_pull = animated({
  id: 'face_pull', type: 'lift', scenery: [column(1.4, 2.0)],
  steps: ['Ręce wyciągnięte do wyciągu', 'Przyciąganie liny do twarzy', 'Łokcie wysoko i na boki', 'Powrót'],
  pose: keyframes({ ...FEET, rx: -4, props: { bar: { len: 0.32, plates: false }, cable: { from: [[0, 1.58, 1.32]] } } },
    { shX: -86, abd: 8, el: -4 }, { shX: -28, abd: 82, rot: 90, el: -105 }),
});
const shrug = animated({
  id: 'shrug', type: 'lift',
  steps: ['Ręce opuszczone', 'Unoszenie barków', 'Barki przy uszach', 'Opuszczanie barków'],
  pose: keyframes({ ...FEET, props: { dumbbells: true } }, { shrug: 0 }, { shrug: 0.07, head: 3 }),
});
const back_ext = animated({
  id: 'back_ext', type: 'lift',
  scenery: [{ box: [0.0, 0.72, 0.14], size: [0.42, 0.3, 0.1], rx: Math.PI / 4 }, { cyl: [[-0.2, 0.3, -0.58], [0.2, 0.3, -0.58]], r: 0.045, color: 'pad' },
    { box: [0, 0.32, -0.15], size: [0.08, 0.64, 0.9], color: 'frame' }],
  steps: ['Tułów opuszczony', 'Prostowanie tułowia', 'Ciało w linii', 'Opuszczanie tułowia'],
  pose: keyframes({ anchor: { pt: 'ankleL', at: { y: 0.27, z: -0.52 } }, thigh: 45, shin: 45, foot: 120, shX: -40, abd: 12, el: -130 },
    { rx: 140, trunk: 150, head: 120 }, { rx: 45, trunk: 45, head: 30 }),
});

// ---------- Barki ----------
const ohp = animated({
  id: 'ohp', type: 'lift',
  steps: ['Sztanga na wysokości barków', 'Wyciskanie nad głowę', 'Ręce wyprostowane', 'Opuszczanie do barków'],
  pose: keyframes({ ...FEET, props: { bar: { len: 1.6 } } }, { arm: -28, fore: -168, head: 0 }, { arm: -178, fore: -180, head: 4 }),
});
const db_ohp = animated({
  id: 'db_ohp', type: 'lift',
  steps: ['Hantle na wysokości barków', 'Wyciskanie nad głowę', 'Ręce wyprostowane', 'Opuszczanie do barków'],
  pose: keyframes({ ...FEET, props: { dumbbells: true } }, { shX: -10, abd: 84, rot: 90, el: -98 }, { shX: -10, abd: 168, rot: 90, el: -8 }),
});
const lateral_raise = animated({
  id: 'lateral_raise', type: 'lift',
  steps: ['Ręce wzdłuż ciała', 'Unoszenie bokiem', 'Ręce na wysokości barków', 'Opuszczanie'],
  pose: keyframes({ ...FEET, props: { dumbbells: true } }, { shX: -8, abd: 12, el: -14 }, { shX: -12, abd: 86, el: -16 }),
  cameraPosition: [0.9, 1.4, 2.8],
});
const reverse_fly = animated({
  id: 'reverse_fly', type: 'lift',
  steps: ['Pochylenie, ręce w dół', 'Unoszenie rąk na boki', 'Ściągnięte łopatki', 'Opuszczanie'],
  pose: keyframes({ ...hinge, rx: 72, head: 45, props: { dumbbells: true } }, { shX: -72, abd: 8, el: -14 }, { shX: -72, abd: 80, el: -18 }),
  cameraPosition: [1.2, 1.7, 2.6],
});

// ---------- Ramiona ----------
const curlPose = (d, p) => curl.pose(d, p);
const hammer = animated({
  id: 'hammer', type: 'lift',
  steps: ['Ręce opuszczone, chwyt młotkowy', 'Uginanie', 'Szczytowe napięcie', 'Opuszczanie'],
  pose: (d, p = {}) => ({ ...curlPose(d, p), props: { dumbbells: true, neutralGrip: true } }),
  cameraPosition: [1.5, 1.45, 2.7], cameraTarget: [0, 1.0, 0],
});
const reverse_curl = animated({
  id: 'reverse_curl', type: 'lift',
  steps: ['Sztanga opuszczona, nachwyt', 'Uginanie', 'Szczytowe napięcie', 'Opuszczanie'],
  pose: (d, p = {}) => {
    const out = curlPose(d, p);
    const w = (p.wrist ?? 0) * d * 0.6;   // opadające nadgarstki
    return { ...out, joints: { ...out.joints, wristL: out.joints.wristL + w, wristR: out.joints.wristR + w }, props: { bar: { len: 1.2, plates: true } } };
  },
  cameraPosition: [1.5, 1.45, 2.7], cameraTarget: [0, 1.0, 0],
});
const triceps_oh = animated({
  id: 'triceps_oh', type: 'lower',
  steps: ['Hantel nad głową', 'Opuszczanie za głowę', 'Rozciągnięcie tricepsa', 'Prostowanie ramion'],
  pose: keyframes({ ...FEET, abd: -9, props: { goblet: true } }, { arm: 178, fore: 179 }, { arm: 170, fore: 25 }),
  cameraTarget: [0, 1.25, 0],
});
const pushdown = animated({
  id: 'pushdown', type: 'lift', scenery: [column(0.55, 2.3), { box: [0, 2.2, 0.42], size: [0.1, 0.06, 0.3], color: 'frame' }],
  steps: ['Łokcie przy bokach, przedramiona w górze', 'Prostowanie ramion w dół', 'Pełny wyprost', 'Powrót'],
  pose: keyframes({ ...FEET, rx: 4, trunk: 10, arm: -6, props: { bar: { len: 0.5, plates: false }, cable: { from: [[0, 2.18, 0.38]] } } },
    { fore: -100 }, { fore: -4 }),
});
const wrist_curl = animated({
  id: 'wrist_curl', type: 'lift', camera: 'seat', scenery: [seat(0.42, -0.05, 0.5)],
  steps: ['Nadgarstki opuszczone', 'Uginanie nadgarstków', 'Szczytowe napięcie', 'Opuszczanie'],
  pose: keyframes({ root: { y: 0.5, z: 0 }, thigh: -90, shin: 0, foot: 0, trunk: 35, head: 50, arm: 17, fore: -88, props: { dumbbells: true } },
    { hand: -40 }, { hand: -150 }),
});

// ---------- Nogi ----------
// Przysiad frontowy i goblet: ruch nóg jak w przysiadzie, tułów bardziej pionowy, ręce z przodu
function squatVariant(armGlobal, foreGlobal, uprightness, props, adduct = 0) {
  return (d, prm = {}) => {
    const p = squat.pose(d, { valgus: 0.32 * (prm.valgus ?? 0), heels: 0.3 * (prm.heels ?? 0) });
    const drop = (prm.elbows ?? 0) * d;    // opadające łokcie w przysiadzie frontowym
    const arm = armGlobal + 55 * drop, fore = foreGlobal + 25 * drop;
    const rx = p.root.rx * (uprightness + 0.6 * drop);
    const j = { ...p.joints };
    j.hipL = j.hipR = p.joints.hipL + (p.root.rx - rx);
    const trunk = rx + p.joints.lumbar;
    // rotacja wewnętrzna ramienia zbliża dłonie do siebie (np. hantel trzymany oburącz przy klatce)
    j.shoulderL = [arm / D - trunk, -adduct / D, 0];
    j.shoulderR = [arm / D - trunk, adduct / D, 0];
    j.elbowL = j.elbowR = (fore - arm) / D;
    j.neck = -trunk * 0.6;
    return { ...p, root: { ...p.root, rx }, joints: j, props };
  };
}
const front_squat = animated({
  id: 'front_squat', camera: 'stand',
  steps: ['Sztanga z przodu na barkach', 'Zejście w dół', 'Dolna pozycja', 'Wstawanie'],
  pose: squatVariant(-80, 138, 0.55, { bar: { len: 1.6 } }),
  cameraTarget: [0, 0.8, 0],
});
const goblet_squat = animated({
  id: 'goblet_squat', camera: 'stand',
  steps: ['Hantel przy klatce', 'Zejście w dół', 'Dolna pozycja', 'Wstawanie'],
  pose: squatVariant(-22, -158, 0.7, { goblet: true }, 45),
  cameraTarget: [0, 0.8, 0],
});
const deadlift = animated({
  id: 'deadlift', type: 'lift',
  steps: ['Sztanga przy podłodze', 'Podnoszenie – nogi i biodra', 'Pełny wyprost', 'Odkładanie sztangi'],
  pose: keyframes({ ...FEET, props: { bar: { len: 1.6 } } },
    { rx: 58, trunk: 55, head: 25, thigh: -70, shin: 24, arm: 0, fore: 0 },
    { rx: 0, trunk: -2, head: 0, thigh: 0, shin: 0, arm: 0, fore: 0 }),
  cameraTarget: [0, 0.75, 0],
});
const rdl = animated({
  id: 'rdl',
  steps: ['Wyprost, sztanga przy udach', 'Cofanie bioder, pochylenie', 'Rozciągnięcie tyłu uda', 'Powrót do wyprostu'],
  pose: keyframes({ ...FEET, props: { bar: { len: 1.6 } } },
    { rx: 0, head: 0, thigh: 0, shin: 0, arm: 0, fore: 0 },
    { rx: 78, trunk: 76, head: 45, thigh: -18, shin: 8, arm: 0, fore: 0 }),
  cameraTarget: [0, 0.75, 0],
});
// Wykrok w miejscu (split squat): przednia stopa płasko, tylna na palcach
function lungePose(d, prm = {}) {
  const hip = { z: 0.02 + 0.16 * (prm.forward ?? 0) * d, y: 0.92 - 0.38 * d };
  const ankleF = { z: 0.38, y: DIMS.ankleHeight };
  const ankleB = { z: -0.46, y: 0.15 };
  const kF = twoBoneIK(hip, ankleF, DIMS.thigh, DIMS.shin, +1);
  const kB = twoBoneIK(hip, ankleB, DIMS.thigh, DIMS.shin, +1);
  const g = (a, b) => downAngle(a, b) * D;
  return makePose({
    root: { y: hip.y, z: hip.z }, rx: 2, head: 0,
    thigh: [g(hip, kF), g(hip, kB)], shin: [g(kF, ankleF), g(kB, ankleB)], foot: [0, 60],
    arm: 0, fore: 0, props: { dumbbells: true },
    legIn: 16 * (prm.valgus ?? 0) * d,
  });
}
const lunge = animated({ id: 'lunge', steps: ['Rozkrok, pozycja wysoka', 'Opuszczanie tylnego kolana', 'Dolna pozycja', 'Wstawanie'], pose: lungePose, cameraTarget: [0, 0.75, 0] });
const leg_press = animated({
  id: 'leg_press', camera: 'seat',
  scenery: [{ box: [0, 0.45, 0.02], size: [0.45, 0.08, 0.4], rx: -0.3 }, { box: [0, 0.66, -0.33], size: [0.45, 0.8, 0.08], rx: -50 * Math.PI / 180 },
    { cyl: [[0.28, 0.25, 0.3], [0.28, 1.45, 1.5]], r: 0.03 }, { cyl: [[-0.28, 0.25, 0.3], [-0.28, 1.45, 1.5]], r: 0.03 },
    { box: [0, 0.2, 0], size: [0.3, 0.4, 0.3], color: 'frame' }],
  steps: ['Nogi wyprostowane, platforma w górze', 'Opuszczanie platformy', 'Kolana przy klatce', 'Wypychanie'],
  pose: keyframes({ root: { y: 0.55, z: 0 }, rx: -50, head: -40, foot: -135, props: { plate: true } },
    { thigh: -128, shin: -138 }, { thigh: -172, shin: -78 }),
  cameraPosition: [2.6, 1.6, 2.4], cameraTarget: [0, 0.8, 0.4],
});
const machineSeat = [seat(0.48, 0.02, 0.5), { box: [0, 0.85, -0.27], size: [0.45, 0.7, 0.08], rx: -0.2 }];
const leg_ext = animated({
  id: 'leg_ext', type: 'lift', camera: 'seat', scenery: [...machineSeat, { box: [0.32, 0.28, 0.42], size: [0.06, 0.56, 0.06], color: 'frame' }],
  steps: ['Kolana zgięte', 'Prostowanie nóg', 'Pełny wyprost', 'Opuszczanie'],
  pose: keyframes({ root: { y: 0.55, z: 0 }, rx: -10, trunk: -12, thigh: -88, arm: 12, fore: -30, props: { rollers: ['shin'] } },
    { shin: -8 }, { shin: -84 }),
});
const leg_curl = animated({
  id: 'leg_curl', type: 'lift', camera: 'lie',
  scenery: [{ box: [0, 0.24, 0.25], size: [0.4, 0.48, 1.3] }, { box: [0, 0.2, -0.7], size: [0.08, 0.4, 0.08], color: 'frame' }],
  steps: ['Nogi wyprostowane', 'Uginanie nóg', 'Pięty przy pośladkach', 'Opuszczanie'],
  pose: keyframes({ root: { y: 0.57, z: 0 }, rx: 90, head: 75, thigh: 92, arm: -40, fore: 8, props: { rollers: ['calf'] } },
    { shin: 92 }, { shin: 205 }),
  cameraPosition: [2.2, 1.4, 1.2], cameraTarget: [0, 0.6, -0.1],
});
const adductor = animated({
  id: 'adductor', type: 'lift', camera: 'seat', scenery: machineSeat,
  steps: ['Nogi rozchylone', 'Ściąganie kolan do środka', 'Kolana razem', 'Rozchylanie'],
  pose: keyframes({ root: { y: 0.55, z: 0 }, rx: -6, trunk: -10, thigh: -86, shin: 0, foot: 0, arm: 10, fore: -40 },
    { hipAbd: 38 }, { hipAbd: 4 }),
  cameraPosition: [0.6, 1.5, 2.6], cameraTarget: [0, 0.6, 0.2],
});
const calf_raise = animated({
  id: 'calf_raise', type: 'lift',
  steps: ['Stopy płasko', 'Wspięcie na palce', 'Szczytowe napięcie', 'Opuszczanie pięt'],
  pose: keyframes({ anchor: { pt: 'toeL', at: { y: 0, z: DIMS.footFront } } }, { foot: 0 }, { foot: 38 }),
  cameraTarget: [0, 0.7, 0],
});
// Wspięcia siedząc: biodra na siedzisku, palce na podłodze – kolano unosi się razem z piętą
function seatedCalfPose(d) {
  const hip = { z: 0, y: 0.5 };
  const foot = 36 * d;
  const toe = { z: 0.5, y: 0.0 };
  const fr = foot / D;
  const ankle = { z: toe.z - DIMS.footFront * Math.cos(fr) - DIMS.ankleHeight * Math.sin(fr), y: toe.y + DIMS.ankleHeight * Math.cos(fr) - DIMS.footFront * Math.sin(fr) };
  const knee = twoBoneIK(hip, ankle, DIMS.thigh, DIMS.shin, +1);
  const g = (a, b) => downAngle(a, b) * D;
  return makePose({ root: hip, rx: 0, trunk: 5, thigh: g(hip, knee), shin: g(knee, ankle), foot, arm: -20, fore: -70 });
}
const seated_calf = animated({ id: 'seated_calf', type: 'lift', camera: 'seat', scenery: [seat(0.43, -0.05)], steps: ['Pięty nisko', 'Unoszenie pięt', 'Szczytowe napięcie', 'Opuszczanie'], pose: seatedCalfPose });
const tib_raise = animated({
  id: 'tib_raise', type: 'lift', scenery: [{ box: [0, 1.1, -0.28], size: [1.2, 2.2, 0.1], color: 'wall' }],
  steps: ['Plecy przy ścianie, stopy płasko', 'Unoszenie palców stóp', 'Szczytowe napięcie', 'Opuszczanie'],
  pose: keyframes({ anchor: { pt: 'heelL', at: { y: 0, z: 0.3 } }, rx: -14, thigh: -14, shin: -14 }, { foot: 0 }, { foot: -30 }),
});

// ---------- Pośladki ----------
function hipThrustPose(d, prm = {}) {
  const T = -55 - (38 + 14 * (prm.arch ?? 0)) * d;                 // nachylenie tułowia (plecy oparte o ławkę)
  const sh = { z: -0.34, y: 0.56 };
  const t = T / D;
  const hip = { z: sh.z - 0.5 * Math.sin(t), y: sh.y - 0.5 * Math.cos(t) };
  const ankle = { z: 0.5, y: DIMS.ankleHeight };
  const knee = twoBoneIK(hip, ankle, DIMS.thigh, DIMS.shin, +1);
  const g = (a, b) => downAngle(a, b) * D;
  const arch = 22 * (prm.arch ?? 0) * d;  // przeprost: tułów odgina się względem miednicy
  return makePose({ root: hip, rx: T + arch, trunk: T, head: T + 45 - arch, thigh: g(hip, knee), shin: g(knee, ankle), foot: 0, el: -25,
    legIn: 16 * (prm.valgus ?? 0) * d, props: { bar: { len: 1.6 } } });
}
const hip_thrust = animated({
  id: 'hip_thrust', type: 'lift', camera: 'floor', scenery: [{ box: [0, 0.21, -0.46], size: [1.1, 0.42, 0.35] }],
  steps: ['Biodra nisko', 'Wypychanie bioder w górę', 'Ściśnięte pośladki', 'Opuszczanie bioder'],
  pose: hipThrustPose,
  cameraPosition: [2.4, 1.2, 1.6], cameraTarget: [0, 0.4, 0],
});
const band_walk = animated({
  id: 'band_walk', type: 'walk',
  steps: ['Krok w bok', 'Dostawienie nogi'],
  pose: (d, prm = {}) => {
    const p = squat.pose(0.32 * (1 - 0.85 * (prm.tall ?? 0)), { valgus: 0.35 * (prm.valgus ?? 0) });
    const step = Math.sin(Math.PI * Math.min(d, 1)), follow = Math.sin(Math.PI * Math.max(0, d - 1));
    const aL = 4 + 14 * step, aR = 4 + 14 * follow;
    const j = { ...p.joints };
    j.hipL = [p.joints.hipL, 0, aL / D];
    j.hipR = [p.joints.hipR, 0, -aR / D];
    return { ...p, root: { ...p.root, y: p.root.y + 0.02 * (step + follow) }, joints: j, props: { band: true } };
  },
  cameraPosition: [0.8, 1.2, 2.8], cameraTarget: [0, 0.6, 0],
});

// ---------- Core ----------
const plank = animated({
  id: 'plank', type: 'hold', camera: 'floor', steps: ['Utrzymanie deski – wdech', 'Utrzymanie deski – wydech'],
  pose: keyframes({ rx: 78, head: 70, arm: 0, fore: -90, hand: -90, foot: 84,
    anchor: { pt: 'elbowL', at: { y: 0.06, z: 0.3 } }, anchor2: { pt: 'toeL', y: 0.01 } }, {}, {}),
});
const side_plank = animated({
  id: 'side_plank', type: 'hold', camera: 'floor', steps: ['Utrzymanie – wdech', 'Utrzymanie – wydech'],
  pose: keyframes({ rx: 78, ry: 90, head: 78, abd: [0, 90], el: [0, -90], arm: [78, undefined],
    anchor: { pt: 'elbowR', at: { y: 0.06, z: 0.3 } }, anchor2: { pt: 'ankleR', y: 0.06 } }, {}, {}),
  cameraPosition: [2.6, 1.1, 0.8], cameraTarget: [0, 0.3, -0.2],
});
const crunch = animated({
  id: 'crunch', type: 'lift', camera: 'floor',
  steps: ['Leżenie, kolana ugięte', 'Unoszenie łopatek', 'Napięty brzuch', 'Powrót'],
  pose: keyframes({ root: { y: 0.11, z: 0 }, rx: -90, thigh: -135, shin: -25, foot: 0 },
    { trunk: -90, head: -88 }, { trunk: -58, head: -35 }),
});
const leg_raise = animated({
  id: 'leg_raise', type: 'lift', camera: 'hang', scenery: pullBar(),
  steps: ['Zwis na drążku', 'Unoszenie nóg', 'Nogi w poziomie', 'Opuszczanie nóg'],
  pose: keyframes({ anchor: { pt: 'handL', at: { y: 2.12, z: 0 } }, arm: 180, fore: 180, trunk: 0, grip: 1 },
    { rx: 0, thigh: 0, shin: 4 }, { rx: -16, thigh: -96, shin: -92 }),
});
const farmer = animated({
  id: 'farmer', type: 'walk',
  steps: ['Krok lewą nogą', 'Krok prawą nogą'],
  pose: (d, prm = {}) => {
    const h = prm.hunch ?? 0;
    const s = d <= 1 ? 1 - 2 * d : 2 * d - 3;                  // +1 → −1 → +1: lewa noga z tyłu → z przodu → z tyłu
    const lift = d <= 1 ? Math.sin(Math.PI * d) : 0, liftR = d > 1 ? Math.sin(Math.PI * (d - 1)) : 0;
    return makePose({
      root: { y: DIMS.hipHeight - 0.03, z: 0 },
      thigh: [22 * s - 18 * lift, -22 * s - 18 * liftR], shin: [22 * s + 20 * lift, -22 * s + 20 * liftR],
      foot: [6 * s, -6 * s], arm: 0, fore: 0, trunk: 18 * h, head: 38 * h, props: { dumbbells: true },
    });
  },
});

export const LIBRARY = [
  bench, db_bench, incline_db, dips, fly, cable_fly,
  pullup, lat_pulldown, lat_pulldown_wide, row, db_row, cable_row, incline_row, face_pull, shrug, back_ext,
  ohp, db_ohp, lateral_raise, reverse_fly,
  hammer, triceps_oh, pushdown, wrist_curl, reverse_curl,
  front_squat, goblet_squat, deadlift, rdl, lunge, leg_press, leg_ext, leg_curl, adductor, calf_raise, seated_calf, tib_raise,
  hip_thrust, band_walk,
  plank, side_plank, crunch, leg_raise, farmer,
];
