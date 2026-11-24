import { defineExercise } from './common.js';
import { DIMS } from '../dims.js';
import { CATALOG_BY_ID } from '../plan/catalog.js';
import { MISTAKES } from './mistakes.js';

// Budowanie animacji z dwóch póz kluczowych (A = głębokość 0, B = głębokość 1).
//
// Kąty w STOPNIACH. Kąty "globalne" mierzymy w płaszczyźnie strzałkowej względem świata:
//   kończyny (thigh, shin, foot, arm, fore, hand): 0 = segment w dół, −90 = w przód (+Z), 90 = w tył, 180 = w górę
//   tułów i głowa (rx = miednica, trunk, head):     0 = pionowo w górę, 90 = pochylony w przód, −90 = odchylony w tył
// Lokalne (bez przeliczania): shX/el = zgięcie barku/łokcia względem rodzica, abd = odwiedzenie barku,
//   rot = rotacja ramienia wzdłuż kości, hipAbd = odwiedzenie biodra.
// Wartość może być liczbą (obie strony) albo [lewa, prawa].
// anchor: { pt: 'ankleL' | 'toeL' | 'handL' | 'elbowR' | ..., at: { y, z } } – ten punkt ciała trafia w podane miejsce,
// anchor2: { pt, y } – dodatkowo dobierz pochylenie całego ciała, żeby drugi punkt miał wysokość y.

const R = Math.PI / 180;
const side = (v, i) => (Array.isArray(v) ? v[i] : v);

export function makePose(s) {
  const rx = s.rx ?? 0;
  const trunk = s.trunk ?? rx;
  const head = s.head ?? trunk;
  const j = { lumbar: (trunk - rx) * R, neck: (head - trunk) * R };
  ['L', 'R'].forEach((S, i) => {
    const sgn = i === 0 ? 1 : -1;
    const thigh = side(s.thigh, i) ?? rx;
    const shin = side(s.shin, i) ?? thigh;
    const foot = side(s.foot, i) ?? shin;
    const arm = side(s.arm, i) ?? trunk;
    const fore = side(s.fore, i) ?? arm;
    const hand = side(s.hand, i) ?? fore;
    const shX = side(s.shX, i) ?? arm - trunk;
    const el = side(s.el, i);
    const elbow = el ?? fore - arm;
    j['hip' + S] = [(thigh - rx) * R, sgn * (side(s.hipRot, i) ?? 0) * R, sgn * (side(s.hipAbd, i) ?? 0) * R];
    j['knee' + S] = (shin - thigh) * R;
    j['ankle' + S] = (foot - shin) * R;
    j['shoulder' + S] = [shX * R, sgn * (side(s.rot, i) ?? 0) * R, sgn * (side(s.abd, i) ?? 0) * R];
    j['elbow' + S] = elbow * R;
    j['wrist' + S] = (el !== undefined ? side(s.wr, i) ?? 0 : hand - fore) * R;
  });
  // błędy techniki: kolana do środka / łokcie na zewnątrz (skręt całego łańcucha, patrz body.js)
  if (s.legIn !== undefined) j.legInL = j.legInR = s.legIn * R;
  if (s.armOut !== undefined) j.armOutL = j.armOutR = s.armOut * R;
  const pose = {
    root: { x: s.root?.x ?? 0, y: s.root?.y ?? DIMS.hipHeight, z: s.root?.z ?? 0, rx: rx * R, ry: (s.ry ?? 0) * R, rz: (s.rz ?? 0) * R },
    joints: j,
    shrug: s.shrug ?? 0,
    grip: s.grip,
    props: s.props ?? {},
  };
  if (s.anchor) pose.anchor = s.anchor;
  if (s.anchor2) pose.anchor2 = s.anchor2;
  return pose;
}

// Mieszanie specyfikacji: liczby (i liczby w tablicach/obiektach) interpolujemy, resztę bierzemy z A
function mix(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mix(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = k in a && k in b ? mix(a[k], b[k], t) : a[k] ?? b[k];
    return out;
  }
  return a ?? b;
}
// Typowy błąd w pozach kluczowych: { A, B, both, M } – nadpisania specyfikacji; params[id] = 0..1 (płynne przejście).
// M (opcjonalnie) – poza pośrednia w połowie ruchu (np. drążek musi minąć twarz z przodu).
function spec3(A, B, M, d) {
  if (!M) return mix(A, B, d);
  const mid = { ...mix(A, B, 0.5), ...M };
  return d < 0.5 ? mix(A, mid, d * 2) : mix(mid, B, (d - 0.5) * 2);
}
export const keyframes = (base, A, B, M = null) => (d, params = {}, mistakes = []) => {
  let spec = spec3({ ...base, ...A }, { ...base, ...B }, M, d);
  for (const m of mistakes) {
    const w = params[m.id] ?? 0;
    if (w <= 0 || !(m.A || m.B || m.both)) continue;
    const bad = spec3({ ...base, ...A, ...m.both, ...m.A }, { ...base, ...B, ...m.both, ...m.B }, (M || m.M) && { ...M, ...m.both, ...m.M }, d);
    spec = mix(spec, bad, w);
  }
  return makePose(spec);
};

// Szablony faz. 'lower' – najpierw opuszczanie (głębokość 0→1), 'lift' – najpierw unoszenie/przyciąganie,
// 'hold' – utrzymanie pozycji, 'walk' – dwa kroki (głębokość 0→1→2).
function phasesFor(type, st) {
  if (type === 'hold') return [
    { name: st[0], kind: 'iso', dur: 1.8, from: 0, to: 0, breath: 'in' },
    { name: st[1] ?? st[0], kind: 'iso', dur: 2.2, from: 0, to: 0, breath: 'out' },
  ];
  if (type === 'walk') return [
    { name: st[0], kind: 'con', dur: 0.7, from: 0, to: 1, breath: 'in' },
    { name: st[1], kind: 'con', dur: 0.7, from: 1, to: 2, breath: 'out' },
  ];
  if (type === 'lift') return [
    { name: st[0], kind: 'iso', dur: 0.35, from: 0, to: 0, breath: 'in' },
    { name: st[1], kind: 'con', dur: 0.9, from: 0, to: 1, breath: 'out' },
    { name: st[2], kind: 'iso', dur: 0.3, from: 1, to: 1, breath: 'hold' },
    { name: st[3], kind: 'ecc', dur: 1.2, from: 1, to: 0, breath: 'in' },
  ];
  return [
    { name: st[0], kind: 'iso', dur: 0.35, from: 0, to: 0, breath: 'hold' },
    { name: st[1], kind: 'ecc', dur: 1.1, from: 0, to: 1, breath: 'in' },
    { name: st[2], kind: 'iso', dur: 0.25, from: 1, to: 1, breath: 'hold' },
    { name: st[3], kind: 'con', dur: 0.9, from: 1, to: 0, breath: 'out' },
  ];
}

const BREATHING = {
  lower: 'Wdech podczas opuszczania, wydech podczas wysiłku (powrotu).',
  lift: 'Wydech podczas wysiłku (unoszenia, przyciągania), wdech podczas powrotu.',
  hold: 'Oddychaj spokojnie i równo – nie wstrzymuj oddechu, brzuch napięty.',
  walk: 'Oddychaj rytmicznie, krótkie wdechy i wydechy, brzuch napięty.',
};

export const CAMERAS = {
  stand: { cameraPosition: [2.3, 1.35, 2.3], cameraTarget: [0, 0.95, 0] },
  lie: { cameraPosition: [2.5, 1.85, 1.9], cameraTarget: [0, 0.6, -0.1] },
  hang: { cameraPosition: [2.6, 1.8, 2.6], cameraTarget: [0, 1.4, 0] },
  floor: { cameraPosition: [2.3, 1.05, 1.9], cameraTarget: [0, 0.3, 0.1] },
  seat: { cameraPosition: [2.3, 1.3, 2.2], cameraTarget: [0, 0.8, 0.1] },
};

// Aktywacje z wag katalogu: udział 1 → szczyt ok. 70% MVC, 0,25 → ok. 27%
export function musclesFrom(weights) {
  const out = {};
  for (const [id, w] of Object.entries(weights)) out[id] = { rest: 0.03 + 0.08 * w, peak: 0.12 + 0.58 * w, w: 0.75 };
  return out;
}

// Błąd z mistakes.js → format silnika: parametry pozy, zmienione aktywacje (shift = zmiana udziału mięśnia), przeciążenia
function engineMistake(m, weights) {
  const muscles = {};
  for (const [mid, dw] of Object.entries(m.shift ?? {})) {
    const w = Math.max(0, Math.min(1.1, (weights[mid] ?? 0) + dw));
    muscles[mid] = { rest: 0.02 + 0.08 * w, peak: 0.06 + 0.58 * w, w: 0.75 };
  }
  return { ...m, params: m.rom ? { rom: m.rom } : { [m.id]: 1 }, muscles, stress: m.stress ?? [] };
}

export function animated({ id, type = 'lower', steps, pose, camera = 'stand', scenery = [], cues = [], ...rest }) {
  const cat = CATALOG_BY_ID[id];
  const mistakes = (MISTAKES[id] ?? []).map((m) => engineMistake(m, cat.muscles));
  return defineExercise({
    id,
    name: cat.name,
    description: cat.how,
    cues: [cat.tip, ...cues],
    breathingTip: BREATHING[type],
    phases: phasesFor(type, steps ?? ['Pozycja wyjściowa', 'Ruch', 'Pozycja końcowa', 'Powrót']),
    muscles: musclesFrom(cat.muscles),
    load: type === 'hold' || type === 'walk' ? () => 1 : undefined,
    scenery,
    pose: (d, params) => pose(d, params, mistakes),
    mistakes,
    ...CAMERAS[camera],
    ...rest,
  });
}
