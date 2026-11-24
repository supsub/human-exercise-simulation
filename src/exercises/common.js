import { smoothstep, clamp, lerp } from '../kinematics.js';
import { DIMS } from '../dims.js';
import { MUSCLES } from '../muscles.js';

// Charakter fazy: ecc = ekscentryczna (mięsień wydłuża się pod obciążeniem),
// con = koncentryczna (skraca się), iso = izometryczna (utrzymanie pozycji).
export const PHASE_KIND = {
  ecc: { label: 'ekscentryczna', hint: 'mięśnie hamują ruch', factor: 0.65 },
  con: { label: 'koncentryczna', hint: 'mięśnie pokonują opór', factor: 1.0 },
  iso: { label: 'izometryczna', hint: 'mięśnie trzymają pozycję', factor: 0.7 },
};

// Oddech w fazie: 'in' = wdech, 'out' = wydech, 'hold' = wstrzymanie (napięcie brzucha)
export const BREATH = {
  in: { label: 'Wdech', icon: '↑' },
  out: { label: 'Wydech', icon: '↓' },
  hold: { label: 'Wstrzymanie oddechu', icon: '■' },
};

// Przygotowuje oś czasu ćwiczenia: znormalizowane początki/końce faz i przebieg oddechu.
export function defineExercise(ex) {
  const total = ex.phases.reduce((s, p) => s + p.dur, 0);
  let acc = 0;
  ex.phases = ex.phases.map((p) => {
    const start = acc / total;
    acc += p.dur;
    return { ...p, start, end: acc / total };
  });
  // Poziom powietrza w płucach na granicach faz (dwa przebiegi, by cykl się domykał)
  let b = 0.5;
  for (let pass = 0; pass < 2; pass++) {
    for (const p of ex.phases) {
      p.b0 = b;
      if (p.breath === 'in') b = 1;
      else if (p.breath === 'out') b = 0;
      p.b1 = b;
    }
  }
  ex.cycle = total;
  ex.mistakes = ex.mistakes ?? [];
  return ex;
}

// Stan ćwiczenia w chwili t ∈ [0, 1) cyklu.
// romCut: skrócenie zakresu ruchu (0 = pełny, 0.5 = połowa) – używane przy błędach.
export function sampleExercise(ex, t, romCut = 0) {
  t = ((t % 1) + 1) % 1;
  const phase = ex.phases.find((p) => t >= p.start && t < p.end) ?? ex.phases[ex.phases.length - 1];
  const u = clamp((t - phase.start) / (phase.end - phase.start), 0, 1);
  const depth = (phase.from + (phase.to - phase.from) * smoothstep(u)) * (1 - romCut);
  // "Zaangażowanie fazy": szybko narasta na początku ruchu i opada tuż przed końcem,
  // dzięki czemu np. start wypychania z dołu pompki ma pełną intensywność.
  const speed = phase.from === phase.to ? 0 : smoothstep(clamp(Math.min(u, 1 - u) / 0.15, 0, 1));
  const breath = lerp(phase.b0, phase.b1, smoothstep(u));
  return { t, phase, u, depth, speed, breath };
}

// Model aktywacji (MVP, oparty na danych EMG z literatury, wartości przybliżone):
//   a = rest + (peak − rest) · [(1 − w) + w · load] · f_fazy
//   rest  – aktywacja przy utrzymaniu pozycji wyjściowej
//   peak  – szczytowa aktywacja (ułamek MVC) w najtrudniejszym punkcie fazy koncentrycznej
//   w     – jak mocno aktywacja zależy od głębokości ruchu (ramię siły / obciążenie)
// Współczynnik fazy przechodzi płynnie od izometrii do ecc/con proporcjonalnie do prędkości,
// więc krzywe aktywacji nie mają skoków na granicach faz.
// overrides: parametry mięśni zmienione przez błąd techniki.
export function computeActivations(ex, state, overrides = null) {
  const iso = PHASE_KIND.iso.factor;
  const kindF = PHASE_KIND[state.phase.kind].factor;
  const f = iso + (kindF - iso) * state.speed;
  // Opcjonalnie: obciążenie jako funkcja głębokości (np. maksimum w połowie ruchu przy uginaniu)
  const load = ex.load ? ex.load(state.depth) : state.depth;
  const out = {};
  for (const m of MUSCLES) {
    const p = (overrides && overrides[m.id]) || ex.muscles[m.id];
    if (!p) { out[m.id] = 0.02; continue; }
    const w = p.w ?? 0.5;
    out[m.id] = clamp(p.rest + (p.peak - p.rest) * ((1 - w) + w * load) * f, 0, 1);
  }
  return out;
}

// Szczytowa aktywacja każdego mięśnia w całym cyklu – stała mapa do statycznej figury i listy ról.
// mistake: opcjonalny błąd techniki (zmienione parametry mięśni i zakres ruchu).
export function peakActivations(ex, mistake = null) {
  const romCut = mistake?.params?.rom ?? 0;
  const peak = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
  for (let i = 0; i < 80; i++) {
    const a = computeActivations(ex, sampleExercise(ex, i / 80, romCut), mistake?.muscles);
    for (const id in a) peak[id] = Math.max(peak[id], a[id]);
  }
  return peak;
}

// Rola mięśnia w ćwiczeniu na podstawie szczytowej aktywacji (bez pokazywania liczb)
export const ROLES = [
  { id: 'main', min: 0.45, label: 'Pracują najmocniej', one: 'pracuje najmocniej – to główny cel ćwiczenia' },
  { id: 'assist', min: 0.25, label: 'Pomagają', one: 'pomaga w ruchu' },
  { id: 'stab', min: 0.1, label: 'Trzymają pozycję', one: 'pracuje lekko, utrzymując stabilną pozycję' },
];
export const roleOf = (a) => ROLES.find((r) => a >= r.min) ?? null;

// Pozycja stojąca (punkt wyjścia i pozycja spoczynkowa)
export function standingPose() {
  return {
    root: { y: DIMS.hipHeight, z: 0, rx: 0 },
    joints: {},
    props: {},
  };
}
