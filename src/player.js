import { MUSCLES } from './muscles.js';
import { sampleExercise, computeActivations, peakActivations, standingPose } from './exercises/common.js';
import { blendPose, smoothstep, lerp } from './kinematics.js';

// Odtwarzacz ćwiczenia: oś czasu cyklu, płynne przejścia między pozami,
// przełączanie poprawna technika ↔ typowy błąd i wygładzone aktywacje mięśni.
// Nie dotyka DOM ani sceny – zwraca stan, który widok rysuje.

// resolve: funkcja dopasowująca pozę do kotwic (body.resolvePose)
export function createPlayer(resolve = (p) => p) {
  const s = {
    exercise: null,   // definicja ćwiczenia z animacją albo null (pozycja stojąca)
    t: 0,
    playing: true,
    speed: 1,
    reps: 0,
    pose: standingPose(),
    blend: null,      // { from, t }
    mistake: null, pending: null, mix: 0,
    smoothed: Object.fromEntries(MUSCLES.map((m) => [m.id, 0.02])),
    peakGood: null, peakBad: null,
    frozen: false,    // zatrzymane w punkcie (parametr t w URL, przewijanie)
  };

  return {
    state: s,
    setExercise(ex, t = null) {
      if (s.exercise !== ex) s.blend = t === null ? { from: s.pose, t: 0 } : null;
      s.exercise = ex;
      s.t = t ?? 0;
      s.reps = 0;
      s.playing = t === null;
      s.mistake = s.pending = null;
      s.mix = 0;
      s.peakGood = ex ? peakActivations(ex) : null;
      s.peakBad = null;
    },
    setMistake(m, instant = false) {
      // przy zmianie błędu na inny najpierw wracamy do poprawnej techniki, potem idziemy w nowy
      s.pending = m;
      if (!s.mistake || instant) s.mistake = m;
      if (instant) s.mix = m ? 1 : 0;
      s.peakBad = m && s.exercise ? peakActivations(s.exercise, m) : null;
      if (m && s.exercise && !s.frozen) s.playing = true;
    },
    seek(t) { s.t = Math.min(0.9999, Math.max(0, t)); s.playing = false; },
    // Mapa do statycznej figury: szczytowe zaangażowanie (z płynnym przejściem do mapy z błędem)
    peakMap() {
      if (!s.peakGood) return null;
      if (!s.peakBad || s.mistake !== s.pending) return s.peakGood;
      const k = smoothstep(s.mix), out = {};
      for (const id in s.peakGood) out[id] = lerp(s.peakGood[id], s.peakBad[id], k);
      return out;
    },
    frame(dt, scrubbing = false) {
      const ex = s.exercise;
      if (ex && s.playing && (!s.blend || s.blend.t > 0.6)) {
        s.t += (dt * s.speed) / ex.cycle;
        if (s.t >= 1) { s.t -= 1; s.reps++; }
      }
      const want = s.pending && s.pending === s.mistake ? 1 : 0;
      s.mix += Math.sign(want - s.mix) * Math.min(Math.abs(want - s.mix), dt / 0.7);
      if (s.mix === 0 && s.pending !== s.mistake) s.mistake = s.pending ?? null;
      const mix = smoothstep(s.mix);

      let target = standingPose(), raw = null, sample = null;
      if (ex) {
        const params = {};
        if (s.mistake) for (const [k, v] of Object.entries(s.mistake.params)) params[k] = v * mix;
        sample = sampleExercise(ex, s.t, params.rom ?? 0);
        target = resolve(ex.pose(sample.depth, params));
        raw = computeActivations(ex, sample);
        if (s.mistake && mix > 0) {
          const bad = computeActivations(ex, sample, s.mistake.muscles);
          for (const id in raw) raw[id] = lerp(raw[id], bad[id], mix);
        }
      }
      if (s.blend) {
        s.blend.t = Math.min(1, s.blend.t + dt / 0.8);
        s.pose = blendPose(s.blend.from, target, smoothstep(s.blend.t));
        if (s.blend.t >= 1) s.blend = null;
      } else s.pose = target;

      if (raw) {
        // opóźnienie reakcji mięśnia (szybciej przy pauzie i przewijaniu)
        const k = scrubbing || !s.playing ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.09);
        for (const m of MUSCLES) s.smoothed[m.id] += (raw[m.id] - s.smoothed[m.id]) * k;
      }
      return { pose: s.pose, sample, mix, mistake: s.mistake, activations: raw ? s.smoothed : null };
    },
  };
}
