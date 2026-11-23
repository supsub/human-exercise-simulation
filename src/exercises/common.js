import { smoothstep, clamp } from '../kinematics.js';
import { DIMS } from '../dims.js';
import { MUSCLES } from '../muscles.js';

// Charakter fazy: ecc = ekscentryczna (mięsień wydłuża się pod obciążeniem),
// con = koncentryczna (skraca się), iso = izometryczna (utrzymanie pozycji).
export const PHASE_KIND = {
  ecc: { label: 'ekscentryczna', factor: 0.65 },
  con: { label: 'koncentryczna', factor: 1.0 },
  iso: { label: 'izometryczna', factor: 0.7 },
};

// Przygotowuje oś czasu ćwiczenia: znormalizowane początki/końce faz.
export function defineExercise(ex) {
  const total = ex.phases.reduce((s, p) => s + p.dur, 0);
  let acc = 0;
  ex.phases = ex.phases.map((p) => {
    const start = acc / total;
    acc += p.dur;
    return { ...p, start, end: acc / total };
  });
  ex.cycle = total;
  return ex;
}

// Stan ćwiczenia w chwili t ∈ [0, 1) cyklu.
export function sampleExercise(ex, t) {
  t = ((t % 1) + 1) % 1;
  const phase = ex.phases.find((p) => t >= p.start && t < p.end) ?? ex.phases[ex.phases.length - 1];
  const u = clamp((t - phase.start) / (phase.end - phase.start), 0, 1);
  const depth = phase.from + (phase.to - phase.from) * smoothstep(u);
  // "Zaangażowanie fazy": szybko narasta na początku ruchu i opada tuż przed końcem,
  // dzięki czemu np. start wypychania z dołu pompki ma pełną intensywność.
  const speed = phase.from === phase.to ? 0 : smoothstep(clamp(Math.min(u, 1 - u) / 0.15, 0, 1));
  return { t, phase, u, depth, speed };
}

// Model aktywacji (MVP, oparty na danych EMG z literatury, wartości przybliżone):
//   a = rest + (peak − rest) · [(1 − w) + w · depth] · f_fazy
//   rest  – aktywacja przy utrzymaniu pozycji wyjściowej
//   peak  – szczytowa aktywacja (ułamek MVC) w najtrudniejszym punkcie fazy koncentrycznej
//   w     – jak mocno aktywacja zależy od głębokości ruchu (ramię siły / obciążenie)
// Współczynnik fazy przechodzi płynnie od izometrii do ecc/con proporcjonalnie do prędkości,
// więc krzywe aktywacji nie mają skoków na granicach faz.
export function computeActivations(ex, state) {
  const iso = PHASE_KIND.iso.factor;
  const kindF = PHASE_KIND[state.phase.kind].factor;
  const f = iso + (kindF - iso) * state.speed;
  // Opcjonalnie: obciążenie jako funkcja głębokości (np. maksimum w połowie ruchu przy uginaniu)
  const load = ex.load ? ex.load(state.depth) : state.depth;
  const out = {};
  for (const m of MUSCLES) {
    const p = ex.muscles[m.id];
    if (!p) { out[m.id] = 0.02; continue; }
    const w = p.w ?? 0.5;
    out[m.id] = clamp(p.rest + (p.peak - p.rest) * ((1 - w) + w * load) * f, 0, 1);
  }
  return out;
}

// Pozycja stojąca (punkt wyjścia i pozycja spoczynkowa)
export function standingPose() {
  return {
    root: { y: DIMS.hipHeight, z: 0, rx: 0 },
    joints: {},
    props: {},
  };
}
