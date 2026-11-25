import { animated, keyframes, makePose, momentumSwing, kipSwing } from './build.js';
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
  { box: [0, 0.2, -0.26], size: [0.32, 0.4, 1.13] },
  { box: [0, 0.05, 0.3], size: [0.5, 0.1, 0.08], color: 'frame' },
  { box: [0, 0.05, -0.7], size: [0.5, 0.1, 0.08], color: 'frame' },
];
const pullBar = (y = BAR_H) => [
  { cyl: [[-0.75, y, 0], [0.75, y, 0]], r: 0.018 },
  { cyl: [[0.75, 0, 0], [0.75, y + 0.05, 0]], r: 0.035, color: 'frame' },
  { cyl: [[-0.75, 0, 0], [-0.75, y + 0.05, 0]], r: 0.035, color: 'frame' },
];
// wysokość drążka do zwisu: stopy wiszącego ćwiczącego ~20 cm nad podłogą
const BAR_H = 2.35;
const seat = (y = 0.45, z = 0, d = 0.42) => ({ box: [0, y / 2, z], size: [0.4, y, d] });
// uchwyt maszyny przy siedzisku: pręt w dłoni (oś z, środek w punkcie chwytu) na pionowym słupku
const handles = (x, y, z) => [1, -1].flatMap((s) => [
  { cyl: [[s * x, y, z - 0.08], [s * x, y, z + 0.08]], r: 0.016, color: 'frame' },
  { cyl: [[s * x, 0, z - 0.06], [s * x, y, z - 0.06]], r: 0.014, color: 'frame' },   // słupek z przodu uchwytu, z dala od ud
]);
const column = (z, h = 2.4) => ({ box: [0, h / 2, z], size: [0.16, h, 0.16], color: 'frame' });

// ---------- Klatka ----------
const lying = { rx: -90, head: -90, root: { y: 0.55, z: 0.25 }, thigh: -75, shin: 35, foot: 0 };

const bench = animated({
  id: 'bench', camera: 'lie', scenery: flatBench,
  steps: ['Sztanga nad klatką', 'Opuszczanie sztangi', 'Sztanga przy klatce', 'Wyciskanie'],
  // stały chwyt (82 cm), sztanga pionowo nad dolną częścią klatki; łokcie liczy IK (w dół i lekko na boki)
  pose: keyframes({ ...lying, props: { bar: { len: 1.6, press: true } } },
    { hands: { w: 0.82, y: 1.12, z: -0.17, pole: [1, -0.9, 0.3] } }, { hands: { w: 0.82, y: 0.71, z: -0.08, pole: [1, -0.9, 0.3] } }),
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
const pullupKeys = keyframes({ anchor: { pt: 'handL', at: { y: BAR_H, z: 0 } }, thigh: -10, shin: 30, grip: 1 },
  { arm: 180, fore: 180, rx: 0, trunk: 0 }, { arm: 350, fore: 200, rx: -8, trunk: -14, head: -5 });   // łokcie za drążkiem, klatka tuż za nim, broda nad nim
const pullup = animated({
  id: 'pullup', type: 'lift', camera: 'hang', scenery: pullBar(), hang: true,
  steps: ['Zwis na drążku', 'Podciąganie', 'Broda nad drążkiem', 'Opuszczanie'],
  pose: (d, p = {}, m) => kipSwing(pullupKeys(d, p, m), p.kip ?? 0, p.cycleT),   // błąd „bujanie”: wahadło w czasie (build.js)
});
// Wyciąg górny: siedzisko, wałek na uda, kolumna z obciążeniem PRZED ćwiczącym, bloczek nad drążkiem
const pulldownMachine = [{ box: [0, 0.245, -0.2], size: [0.34, 0.49, 0.8] }, { cyl: [[-0.25, 0.68, 0.32], [0.25, 0.68, 0.32]], r: 0.05, color: 'pad' },
  { box: [0, 0.4, 0.33], size: [0.06, 0.56, 0.06], color: 'frame' }, column(0.72, 2.55), { box: [0, 0.65, 0.72], size: [0.3, 0.5, 0.2], color: 'wall' },
  { box: [0, 2.5, 0.42], size: [0.08, 0.07, 0.68], color: 'frame' }, { cyl: [[0, 2.47, 0.12], [0, 2.47, 0.72]], r: 0.006 }];
const seated = { root: { y: 0.56, z: 0 }, thigh: -85, shin: 8, foot: 0 };
const lat_pulldown = animated({
  id: 'lat_pulldown', type: 'lift', camera: 'seat', scenery: pulldownMachine,
  cameraPosition: [1.7, 1.75, -2.2], cameraTarget: [0, 1.15, 0.1],   // z tyłu i z boku – widać pracę pleców
  steps: ['Ręce wyprostowane w górze', 'Ściąganie drążka do klatki', 'Drążek przy klatce', 'Powrót w górę'],
  // stały chwyt (85 cm), łokcie schodzą w dół i na boki; drążek przed twarzą do górnej części klatki (ramiona liczy IK)
  pose: keyframes({ ...seated, rx: -8, trunk: -14, grip: 1, props: { bar: { len: 1.25, plates: false }, cable: { from: [[0, 2.47, 0.12]] } } },
    { hands: { w: 0.85, y: 1.6, z: -0.04, pole: [1, -0.9, -0.2] } }, { hands: { w: 0.85, y: 1.13, z: 0.14, pole: [1, -0.9, -0.2] } },
    { hands: { w: 0.85, y: 1.42, z: 0.2, pole: [1, -0.9, -0.2] } }),   // w połowie drogi drążek mija twarz z przodu
});
const lat_pulldown_wide = animated({
  id: 'lat_pulldown_wide', type: 'lift', camera: 'seat', scenery: pulldownMachine,
  cameraPosition: [1.7, 1.75, -2.2], cameraTarget: [0, 1.15, 0.1],   // z tyłu i z boku – widać pracę pleców
  steps: ['Szeroki chwyt, ręce w górze', 'Ściąganie łokciami w dół i na boki', 'Drążek przy klatce', 'Powrót w górę'],
  pose: keyframes({ ...seated, rx: -8, trunk: -14, grip: 1, props: { bar: { len: 1.55, plates: false }, cable: { from: [[0, 2.47, 0.12]] } } },
    { hands: { w: 1.0, y: 1.56, z: -0.04, pole: [1, -0.7, -0.25] } }, { hands: { w: 1.0, y: 1.15, z: 0.14, pole: [1, -0.7, -0.25] } },
    { hands: { w: 1.0, y: 1.4, z: 0.2, pole: [1, -0.7, -0.25] } }),
});
const hinge = { ...FEET, rx: 65, head: 40, thigh: -22, shin: 16 };
const row = animated({
  id: 'row', type: 'lift',
  steps: ['Pochylenie, sztanga w dół', 'Przyciąganie do brzucha', 'Ściągnięte łopatki', 'Opuszczanie sztangi'],
  pose: keyframes({ ...hinge, props: { bar: { len: 1.6 } } }, { arm: 2, fore: 0 }, { arm: 78, fore: -18 }),
});
const db_row = animated({
  id: 'db_row', type: 'lift',
  scenery: [{ box: [-0.4, 0.25, 0.55], size: [0.35, 0.5, 0.9] }],
  steps: ['Hantel w opuszczonej ręce', 'Przyciąganie do biodra', 'Łokieć z tyłu', 'Opuszczanie'],
  pose: keyframes({ ...FEET, rx: 72, trunk: 78, head: 50, thigh: [-28, -20], shin: [18, 24], props: { dumbbells: 'L' },
    handR: { at: [-0.29, 0.515, 0.8], pole: [-0.4, 0, -1] } },   // ręka podporowa stoi na ławce w jednym miejscu
    { arm: [2, -40], fore: [0, -40] }, { arm: [72, -40], fore: [-14, -40] }),
});
const cable_row = animated({
  id: 'cable_row', type: 'lift', camera: 'floor',
  scenery: [{ box: [0, 0.16, -0.26], size: [0.35, 0.32, 0.72] }, { box: [0, 0.18, 0.93], size: [0.5, 0.36, 0.05], color: 'frame' }, column(1.7, 1.2)],
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
  // tor dłoni: z przodu na wysokości barków → do uszu, łokcie wysoko na boki (ramiona liczy IK)
  pose: keyframes({ ...FEET, rx: -4, grip: 1, props: { bar: { len: 'fit', plates: false }, cable: { from: [[0, 1.58, 1.32]] } } },
    { hands: { w: 0.3, y: 1.42, z: 0.56, pole: [1, 0.2, -0.3] } }, { hands: { w: 0.52, y: 1.52, z: 0.1, pole: [1, 0.45, -0.6] } }),
});
const shrug = animated({
  id: 'shrug', type: 'lift',
  steps: ['Ręce opuszczone', 'Unoszenie barków', 'Barki przy uszach', 'Opuszczanie barków'],
  pose: keyframes({ ...FEET, abd: 9, pron: 90, props: { dumbbells: true } }, { shrug: 0 }, { shrug: 0.07, head: 3 }),
});
// podkładka pod udami, poniżej zgięcia bioder – tułów zgina się nad jej górną krawędzią
const back_ext = animated({
  id: 'back_ext', type: 'lift',
  scenery: [{ box: [0.0, 0.646, 0.065], size: [0.42, 0.24, 0.1], rx: Math.PI / 4 }, { cyl: [[-0.2, 0.3, -0.58], [0.2, 0.3, -0.58]], r: 0.045, color: 'pad', contact: true },
    { box: [0, 0.32, -0.15], size: [0.08, 0.64, 0.9], color: 'frame' }],
  steps: ['Tułów opuszczony', 'Prostowanie tułowia', 'Ciało w linii', 'Opuszczanie tułowia'],
  pose: keyframes({ anchor: { pt: 'ankleL', at: { y: 0.27, z: -0.52 } }, thigh: 45, shin: 45, foot: 120, shX: -40, abd: 12, el: -130 },
    { rx: 122, trunk: 130, head: 110 }, { rx: 45, trunk: 45, head: 30 }),
});

// ---------- Barki ----------
const ohp = animated({
  id: 'ohp', type: 'lift',
  steps: ['Sztanga na wysokości barków', 'Wyciskanie nad głowę', 'Ręce wyprostowane', 'Opuszczanie do barków'],
  pose: keyframes({ ...FEET, props: { bar: { len: 1.6, press: true } } }, { arm: -28, fore: -168, head: 0 }, { arm: -178, fore: -180, head: 4 }),
});
const db_ohp = animated({
  id: 'db_ohp', type: 'lift',
  steps: ['Hantle na wysokości barków', 'Wyciskanie nad głowę', 'Ręce wyprostowane', 'Opuszczanie do barków'],
  pose: keyframes({ ...FEET, props: { dumbbells: true } }, { shX: -10, abd: 84, rot: 90, el: -98 }, { shX: -10, abd: 168, rot: 90, el: -8 }),
});
const lateralKeys = keyframes({ ...FEET, props: { dumbbells: true } }, { shX: -8, abd: 12, el: -14 }, { shX: -12, abd: 86, el: -16 });
const lateral_raise = animated({
  id: 'lateral_raise', type: 'lift',
  steps: ['Ręce wzdłuż ciała', 'Unoszenie bokiem', 'Ręce na wysokości barków', 'Opuszczanie'],
  pose: (d, p = {}, m) => momentumSwing(lateralKeys(d, p, m), p.swing ?? 0, p.cycleT),   // „bujanie”: pęd tułowia w czasie
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
  pose: (d, p = {}) => ({ ...curlPose(d, p), pron: 90, props: { dumbbells: true } }),
  cameraPosition: [1.5, 1.45, 2.7], cameraTarget: [0, 1.0, 0],
});
const reverse_curl = animated({
  id: 'reverse_curl', type: 'lift',
  steps: ['Sztanga opuszczona, nachwyt', 'Uginanie', 'Szczytowe napięcie', 'Opuszczanie'],
  pose: (d, p = {}) => {
    const out = curlPose(d, p);
    const w = (p.wrist ?? 0) * (0.35 + 0.7 * d);   // opadające nadgarstki: ~20° na dole, ~60° na górze – wyraźnie widoczne
    const fwd = -0.3 * (1 - d);           // na dole sztanga przed udami, nie w nich
    const j = { ...out.joints, wristL: out.joints.wristL + w, wristR: out.joints.wristR + w };
    j.shoulderL = [j.shoulderL[0] + fwd, 0, 0.05]; j.shoulderR = [j.shoulderR[0] + fwd, 0, -0.05];
    return { ...out, joints: j, props: { bar: { len: 1.2, plates: 0.13, width: 0.42 } } };   // lekka sztanga, małe talerze
  },
  cameraPosition: [2.5, 1.4, 1.7], cameraTarget: [0, 1.05, 0.1],   // bardziej z boku: widać zgięcie nadgarstków
});
const triceps_oh = animated({
  id: 'triceps_oh', type: 'lower',
  steps: ['Hantel nad głową', 'Opuszczanie za głowę', 'Rozciągnięcie tricepsa', 'Prostowanie ramion'],
  pose: keyframes({ ...FEET, abd: -9, props: { goblet: true } }, { arm: 178, fore: 179 }, { arm: 170, fore: 25 }),
  cameraTarget: [0, 1.25, 0],
});
const pushdown = animated({
  id: 'pushdown', type: 'lift', scenery: [column(0.9, 2.3), { box: [0, 2.2, 0.62], size: [0.1, 0.06, 0.6], color: 'frame' }],
  steps: ['Łokcie przy bokach, przedramiona w górze', 'Prostowanie ramion w dół', 'Pełny wyprost', 'Powrót'],
  pose: keyframes({ ...FEET, rx: 4, trunk: 10, arm: -6, props: { bar: { len: 0.5, plates: false, press: true }, cable: { from: [[0, 2.18, 0.38]] } } },
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
    j.hipL = [p.joints.hipL[0] + (p.root.rx - rx), 0, p.joints.hipL[2]];
    j.hipR = [p.joints.hipR[0] + (p.root.rx - rx), 0, p.joints.hipR[2]];
    const trunk = rx + p.joints.lumbar;
    // rotacja wewnętrzna ramienia zbliża dłonie do siebie (np. hantel trzymany oburącz przy klatce)
    j.shoulderL = [arm / D - trunk, -adduct / D, 0];
    j.shoulderR = [arm / D - trunk, adduct / D, 0];
    j.elbowL = j.elbowR = (fore - arm) / D;
    j.neck = -trunk * 0.6;
    // hantel oburącz: nadgarstki odgięte, wnętrza dłoni do góry tworzą „miseczkę” pod górnym talerzem
    if (props.goblet) { j.wristL = [90 / D, -50 / D, 0]; j.wristR = [90 / D, 50 / D, 0]; }
    return { ...p, root: { ...p.root, rx }, joints: j, props };
  };
}
const front_squat = animated({
  id: 'front_squat', camera: 'stand',
  steps: ['Sztanga z przodu na barkach', 'Zejście w dół', 'Dolna pozycja', 'Wstawanie'],
  pose: squatVariant(-90, 102, 0.55, { bar: { len: 1.6, on: 'front' } }),
  cameraTarget: [0, 0.8, 0],
});
const goblet_squat = animated({
  id: 'goblet_squat', camera: 'stand',
  steps: ['Hantel przy klatce', 'Zejście w dół', 'Dolna pozycja', 'Wstawanie'],
  pose: squatVariant(-22, -158, 0.7, { goblet: true }, 55),
  cameraTarget: [0, 0.8, 0],
});
const deadlift = animated({
  id: 'deadlift', type: 'lift',
  steps: ['Sztanga przy podłodze', 'Podnoszenie – nogi i biodra', 'Pełny wyprost', 'Odkładanie sztangi'],
  pose: keyframes({ ...FEET, props: { bar: { len: 1.6, width: 0.5 } } },
    { rx: 58, trunk: 55, head: 25, thigh: -70, shin: 24, arm: -14, fore: -14 },
    { rx: 0, trunk: -2, head: 0, thigh: 0, shin: 0, arm: -12, fore: -12, abd: 6 },
    { rx: 30, trunk: 28, thigh: -30, shin: 10, arm: -16, fore: -16 }),
  cameraTarget: [0, 0.75, 0],
});
const rdl = animated({
  id: 'rdl',
  steps: ['Wyprost, sztanga przy udach', 'Cofanie bioder, pochylenie', 'Rozciągnięcie tyłu uda', 'Powrót do wyprostu'],
  pose: keyframes({ ...FEET, props: { bar: { len: 1.6, width: 0.5 } } },
    { rx: 0, head: 0, thigh: 0, shin: 0, arm: -12, fore: -12, abd: 6 },
    { rx: 78, trunk: 76, head: 45, thigh: -18, shin: 8, arm: -8, fore: -8 }),
  cameraTarget: [0, 0.75, 0],
});
const db_rdl = animated({
  id: 'db_rdl',
  steps: ['Wyprost, hantle przy udach', 'Cofanie bioder, pochylenie', 'Rozciągnięcie tyłu uda', 'Powrót do wyprostu'],
  pose: keyframes({ ...FEET, grip: 1, props: { dumbbells: true } },
    { rx: 0, head: 0, thigh: 0, shin: 0, arm: -12, fore: -12, abd: 4 },
    { rx: 78, trunk: 76, head: 45, thigh: -18, shin: 8, arm: -6, fore: -6, abd: 4 }),
  cameraTarget: [0, 0.75, 0],
});
// Wykrok w miejscu (split squat): przednia stopa płasko, tylna na palcach
function lungePose(d, prm = {}) {
  const hip = { z: 0.02 + 0.16 * (prm.forward ?? 0) * d, y: 0.92 - 0.38 * d };
  const ankleF = { z: 0.38, y: DIMS.ankleHeight };
  const ankleB = { z: -0.46, y: 0.2 };
  const kF = twoBoneIK(hip, ankleF, DIMS.thigh, DIMS.shin, +1);
  const kB = twoBoneIK(hip, ankleB, DIMS.thigh, DIMS.shin, +1);
  const g = (a, b) => downAngle(a, b) * D;
  return makePose({
    root: { y: hip.y, z: hip.z }, rx: 2, head: 0,
    thigh: [g(hip, kF), g(hip, kB)], shin: [g(kF, ankleF), g(kB, ankleB)], foot: [0, 60],
    arm: 0, fore: 0, abd: 9, pron: 90, props: { dumbbells: true },
    legIn: 16 * (prm.valgus ?? 0) * d,
  });
}
const lunge = animated({ id: 'lunge', steps: ['Rozkrok, pozycja wysoka', 'Opuszczanie tylnego kolana', 'Dolna pozycja', 'Wstawanie'], pose: lungePose, cameraTarget: [0, 0.75, 0] });
// Suwnica: platforma jeździ po prowadnicach, więc stopy (kostki) poruszają się po prostej równoległej do nich.
// Kąty uda i goleni liczy IK nogi w płaszczyźnie bocznej (biodro = root) – zamiast interpolacji kątów,
// która prowadziłaby stopy po łuku (płyta „zjeżdżałaby” z prowadnic).
// Błąd „za głęboko”: platforma schodzi o 30% niżej, a dodatkowy zakres bierze się z podwinięcia miednicy
// (miednica rx −50° → −72°, górne plecy zostają na oparciu) – udo nie wychodzi poza zakres zgięcia biodra.
const LP_ROLL = -1;   // znak kompensacji (sprawdzony testem: stopy płasko na płycie)
const LP_RAIL = [Math.SQRT1_2, Math.SQRT1_2];                   // kierunek prowadnic (y, z) – jak w scenerii
const lpKeys = keyframes({ root: { y: 0.55, z: 0 }, rx: -50, trunk: -50, head: -40, foot: -135, abd: 16, hipAbd: 8, props: { plate: true } },   // stopy na szerokość barków
  { thigh: -128, shin: -124 }, { thigh: -172, shin: -78 });
const yz = (a) => [-Math.cos(a * Math.PI / 180), -Math.sin(a * Math.PI / 180)];   // kierunek segmentu o kącie a (0 = w dół, −90 = w przód)
const ankleAt = (thigh, shin) => { const t = yz(thigh), k = yz(shin); return [DIMS.thigh * t[0] + DIMS.shin * k[0], DIMS.thigh * t[1] + DIMS.shin * k[1]]; };
const LP_A = ankleAt(-128, -124), LP_B = ankleAt(-172, -78);
const LP_TRAVEL = (LP_B[0] - LP_A[0]) * LP_RAIL[0] + (LP_B[1] - LP_A[1]) * LP_RAIL[1];
const near = (a, ref) => a + 360 * Math.round((ref - a) / 360);
function legIK2D([ty, tz], thighRef) {
  const L1 = DIMS.thigh, L2 = DIMS.shin, D = Math.min(L1 + L2 - 1e-4, Math.hypot(ty, tz));
  const at = Math.atan2(-tz, -ty) * 180 / Math.PI;
  const al = Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)) * 180 / Math.PI;
  for (const sg of [1, -1]) {
    const thigh = near(at + sg * al, thighRef), d = yz(thigh);
    const shin = near(Math.atan2(-(tz - L1 * d[1]), -(ty - L1 * d[0])) * 180 / Math.PI, thigh);
    if (shin - thigh >= -1e-6) return { thigh, shin };          // kolano zgina się w przód (nie w przeprost)
  }
  return { thigh: thighRef, shin: thighRef };
}
function legPressPose(d, params = {}, mistakes = []) {
  const p = lpKeys(d, params, mistakes);
  const deep = params.deep ?? 0, R = Math.PI / 180;
  // podwinięta miednica odjeżdża od oparcia wzdłuż prowadnic (biodra „wjeżdżają” pod platformę)
  const sh = 0.06 * deep * d;
  const s = LP_TRAVEL * d * (1 + 0.3 * deep) - sh;
  const { thigh, shin } = legIK2D([LP_A[0] + LP_RAIL[0] * s, LP_A[1] + LP_RAIL[1] * s], -128 - 44 * d);
  const root = { ...p.root, y: p.root.y + LP_RAIL[0] * sh, z: p.root.z + LP_RAIL[1] * sh };
  const rx = p.root.rx / R, j = { ...p.joints };
  for (const S of ['L', 'R']) {
    j['hip' + S] = [(thigh - rx) * R, j['hip' + S][1], j['hip' + S][2]];
    j['knee' + S] = (shin - thigh) * R;
    // stopa płasko na płycie mimo odwiedzenia uda (kolana nad stopami): kompensacja w stawie skokowym
    j['ankle' + S] = [(-135 - shin) * R, 0, LP_ROLL * (S === 'L' ? 1 : -1) * j['hip' + S][2]];
  }
  return { ...p, root, joints: j };
}
const leg_press = animated({
  id: 'leg_press', camera: 'seat',
  scenery: [{ box: [0, 0.45, 0.02], size: [0.45, 0.08, 0.4], rx: -0.3 }, { box: [0, 0.66, -0.33], size: [0.45, 0.8, 0.08], rx: -50 * Math.PI / 180, rest: ['chest'] },
    { cyl: [[0.28, 0.25, 0.3], [0.28, 1.45, 1.5]], r: 0.03, rail: true }, { cyl: [[-0.28, 0.25, 0.3], [-0.28, 1.45, 1.5]], r: 0.03 },
    { box: [0, 0.2, 0], size: [0.3, 0.4, 0.3], color: 'frame' }, ...handles(0.388, 0.482, 0.082)],
  steps: ['Nogi wyprostowane, platforma w górze', 'Opuszczanie platformy', 'Kolana przy klatce', 'Wypychanie'],
  pose: legPressPose,
  cameraPosition: [2.6, 1.6, 2.4], cameraTarget: [0, 0.8, 0.4],
});
const machineSeat = [seat(0.48, 0.02, 0.5), { box: [0, 0.85, -0.22], size: [0.38, 0.7, 0.08], rx: -0.2, rest: ['chest'] }];   // rest: plecy na oparciu (test)
const leg_ext = animated({
  id: 'leg_ext', type: 'lift', camera: 'seat', scenery: [...machineSeat, { box: [0.32, 0.28, 0.42], size: [0.06, 0.56, 0.06], color: 'frame' }, ...handles(0.215, 0.462, 0)],
  steps: ['Kolana zgięte', 'Prostowanie nóg', 'Pełny wyprost', 'Opuszczanie'],
  pose: keyframes({ root: { y: 0.55, z: 0 }, rx: -10, trunk: -12, thigh: -88, arm: 12, fore: -30, props: { rollers: ['shin'] } },
    { shin: -8 }, { shin: -84 }),
});
const leg_curl = animated({
  id: 'leg_curl', type: 'lift', camera: 'lie',
  scenery: [{ box: [0, 0.24, 0.25], size: [0.4, 0.48, 1.3] }, { box: [0, 0.2, -0.7], size: [0.08, 0.4, 0.08], color: 'frame' },
    ...handles(0.26, 0.4, 0.8)],   // uchwyty z przodu ławki
  steps: ['Nogi wyprostowane', 'Uginanie nóg', 'Pięty przy pośladkach', 'Opuszczanie'],
  pose: keyframes({ root: { y: 0.57, z: 0 }, rx: 90, head: 75, thigh: 92, arm: -40, fore: 8, props: { rollers: ['calf'] },
    handL: { at: [0.26, 0.4, 0.8], pole: [1, 0.3, -0.5] }, handR: { at: [-0.26, 0.4, 0.8], pole: [-1, 0.3, -0.5] } },
    { shin: 92 }, { shin: 205 }),
  cameraPosition: [2.2, 1.4, 1.2], cameraTarget: [0, 0.6, -0.1],
});
const adductor = animated({
  id: 'adductor', type: 'lift', camera: 'seat', scenery: [...machineSeat, ...handles(0.53, 0.559, 0.088)],
  steps: ['Nogi rozchylone', 'Ściąganie kolan do środka', 'Kolana razem', 'Rozchylanie'],
  pose: keyframes({ root: { y: 0.55, z: 0 }, rx: -6, trunk: -10, thigh: -86, shin: 0, foot: 0, arm: 10, fore: -40, abd: 30,
    handL: { at: [0.53, 0.559, 0.088], pole: [1, -0.5, -0.5] }, handR: { at: [-0.53, 0.559, 0.088], pole: [-1, -0.5, -0.5] } },   // dłonie na uchwytach
    { hipAbd: 38 }, { hipAbd: 4 }),
  cameraPosition: [0.6, 1.5, 2.6], cameraTarget: [0, 0.6, 0.2],
});
// Odwodzenie: ta sama maszyna co przywodzenie, ruch odwrotny – kolana rozpychane na boki
const abductor = animated({
  id: 'abductor', type: 'lift', camera: 'seat', scenery: [...machineSeat, ...handles(0.53, 0.559, 0.088)],
  steps: ['Kolana razem', 'Rozpychanie kolan na boki', 'Nogi rozchylone', 'Powolny powrót'],
  pose: keyframes({ root: { y: 0.55, z: 0 }, rx: -6, trunk: -10, thigh: -86, shin: 0, foot: 0, arm: 10, fore: -40, abd: 30,
    handL: { at: [0.53, 0.559, 0.088], pole: [1, -0.5, -0.5] }, handR: { at: [-0.53, 0.559, 0.088], pole: [-1, -0.5, -0.5] } },   // dłonie na uchwytach
    { hipAbd: 4 }, { hipAbd: 38 }),
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
  // palce = kostka + obrót (footFront, −ankleHeight) o kąt stopy, więc kostka = palce − ten wektor
  const ankle = { z: toe.z - (DIMS.footFront * Math.cos(fr) - DIMS.ankleHeight * Math.sin(fr)), y: toe.y + DIMS.ankleHeight * Math.cos(fr) + DIMS.footFront * Math.sin(fr) };
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
  return makePose({ root: hip, rx: T + arch, trunk: T, head: T + 45 - arch, thigh: g(hip, knee), shin: g(knee, ankle), foot: 0, el: -70, hipAbd: 8,   // stopy na szerokość barków, kolana nad stopami
    legIn: 8 * (prm.valgus ?? 0) * d, props: { bar: { len: 1.6 } } });
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
    const p = squat.pose(0.32 * (1 - 0.85 * (prm.tall ?? 0)), { valgus: 0.8 * (prm.valgus ?? 0) });
    const step = Math.sin(Math.PI * Math.min(d, 1)), follow = Math.sin(Math.PI * Math.max(0, d - 1));
    const aL = 4 + 14 * step, aR = 4 + 14 * follow;
    const j = { ...p.joints };
    j.hipL = [p.joints.hipL[0], 0, p.joints.hipL[2] + aL / D];
    j.hipR = [p.joints.hipR[0], 0, p.joints.hipR[2] - aR / D];
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
  pose: keyframes({ root: { y: 0.125, z: 0 }, rx: -90, thigh: -140, shin: -25, foot: 0 },
    { trunk: -90, head: -88 }, { trunk: -58, head: -35 }),
});
const legRaiseKeys = keyframes({ anchor: { pt: 'handL', at: { y: BAR_H, z: 0 } }, arm: 180, fore: 180, trunk: 0, grip: 1 },
  { rx: 0, thigh: 0, shin: 4 }, { rx: -16, thigh: -96, shin: -92 });
const leg_raise = animated({
  id: 'leg_raise', type: 'lift', camera: 'hang', scenery: pullBar(), hang: true,
  steps: ['Zwis na drążku', 'Unoszenie nóg', 'Nogi w poziomie', 'Opuszczanie nóg'],
  pose: (d, params = {}, mistakes) => {
    const p = legRaiseKeys(d, params, mistakes);
    // błąd „bujanie”: ciało jest wahadłem zawieszonym na dłoniach – kołysze się w rytmie powtórzeń
    // (okres ≈ cykl ćwiczenia, jak naturalne wahadło długości ciała), a nogi z opóźnieniem dają „bicz”
    const w = params.swing ?? 0;
    if (!w) return p;
    const t = params.cycleT ?? 0, R = Math.PI / 180, TAU = Math.PI * 2;
    const body = 17 * Math.sin(TAU * t + 0.9);          // + = stopy w tył, głowa w przód
    const whip = 24 * Math.sin(TAU * t + 0.2);          // nogi spóźnione względem tułowia
    const j = { ...p.joints };
    for (const S of ['L', 'R']) {
      j['hip' + S] = [j['hip' + S][0] + w * whip * R, j['hip' + S][1], j['hip' + S][2]];
      j['knee' + S] += w * Math.max(0, whip) * 0.6 * R;
    }
    j.lumbar += w * -0.35 * body * R;                    // wygięcie przy zamachu, zgięcie przy wymachu
    return { ...p, root: { ...p.root, rx: p.root.rx + w * body * R }, joints: j };
  },
});
const farmer = animated({
  id: 'farmer', type: 'walk',
  steps: ['Krok lewą nogą', 'Krok prawą nogą'],
  pose: (d, prm = {}) => {
    const h = prm.hunch ?? 0;
    const s = d <= 1 ? 1 - 2 * d : 2 * d - 3;                  // +1 → −1 → +1: lewa noga z tyłu → z przodu → z tyłu
    const lift = d <= 1 ? Math.sin(Math.PI * d) : 0, liftR = d > 1 ? Math.sin(Math.PI * (d - 1)) : 0;
    const thigh = [22 * s - 18 * lift, -22 * s - 18 * liftR], shin = [22 * s + 20 * lift, -22 * s + 20 * liftR];
    // biodro na takiej wysokości, żeby niższa stopa stała na podłodze
    const reach = (i) => DIMS.thigh * Math.cos(thigh[i] / D) + DIMS.shin * Math.cos(shin[i] / D);
    return makePose({
      root: { y: DIMS.ankleHeight + 0.015 + Math.max(reach(0), reach(1)), z: 0 },
      thigh, shin, foot: [6 * s, -6 * s], arm: 0, fore: 0, abd: 9, trunk: 18 * h, head: 38 * h, pron: 90, props: { dumbbells: true },
    });
  },
});

export const LIBRARY = [
  bench, db_bench, incline_db, dips, fly, cable_fly,
  pullup, lat_pulldown, lat_pulldown_wide, row, db_row, cable_row, incline_row, face_pull, shrug, back_ext,
  ohp, db_ohp, lateral_raise, reverse_fly,
  hammer, triceps_oh, pushdown, wrist_curl, reverse_curl,
  front_squat, goblet_squat, deadlift, rdl, db_rdl, lunge, leg_press, leg_ext, leg_curl, adductor, abductor, calf_raise, seated_calf, tib_raise,
  hip_thrust, band_walk,
  plank, side_plank, crunch, leg_raise, farmer,
];
