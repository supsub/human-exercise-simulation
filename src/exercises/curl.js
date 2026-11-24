import { defineExercise } from './common.js';
import { DIMS } from '../dims.js';
import { momentumSwing } from './build.js';

// Uginanie przedramion z hantlami: ruch tylko w stawie łokciowym,
// ramię nieruchomo przy tułowiu (lekko przesuwa się w przód na górze).
// Parametry błędów: swing – bujanie tułowiem, elbowsFwd – łokcie wędrują w przód.

function pose(depth, p = {}) {
  const elbow = -(0.12 + 2.25 * depth);
  const shoulder = -(0.12 + (p.elbowsFwd ?? 0)) * depth;
  // Bujanie: ruch z pędem w czasie (przysiad tułowiem, wyrzut z odchyleniem, odbicie) – build.js momentumSwing.
  // p.swing: 0.35 w definicji błędu = pełna siła; inne ćwiczenia (młotkowe, nachwytem) podają wagę 0..1.
  return momentumSwing({
    root: { y: DIMS.hipHeight, z: 0, rx: 0 },
    joints: {
      shoulderL: [shoulder, 0, 0.16], shoulderR: [shoulder, 0, -0.16], elbowL: elbow, elbowR: elbow,   // ręce lekko od ud – hantle ich nie dotykają
      wristL: -0.15 * depth, wristR: -0.15 * depth,
    },
    props: { dumbbells: true },
  }, Math.min(1, (p.swing ?? 0) / 0.35), p.cycleT ?? 0);
}

export default defineExercise({
  id: 'curl',
  name: 'Uginanie przedramion z hantlami',
  aliases: ['ugin', 'biceps', 'bicek', 'curl', 'hantl'],
  description:
    'Izolowane ćwiczenie na zginacze stawu łokciowego. Ramiona pozostają przy tułowiu, a hantle unoszone są ruchem przedramion.',
  cues: [
    'Łokcie przy tułowiu – nie wychylaj ich w przód.',
    'Nie bujaj tułowiem, ruch tylko w łokciach.',
    'Opuszczaj ciężar wolniej, niż go unosisz.',
  ],
  breathingTip: 'Wydech podczas unoszenia hantli, wdech podczas opuszczania.',
  cameraTarget: [0, 1.0, 0],
  cameraPosition: [1.5, 1.45, 2.7],
  phases: [
    { name: 'Ręce opuszczone, hantle w dłoniach', kind: 'iso', dur: 0.35, from: 0, to: 0, breath: 'hold' },
    { name: 'Uginanie – unoszenie hantli', kind: 'con', dur: 0.8, from: 0, to: 1, breath: 'out' },
    { name: 'Szczytowe napięcie', kind: 'iso', dur: 0.3, from: 1, to: 1, breath: 'hold' },
    { name: 'Opuszczanie hantli', kind: 'ecc', dur: 1.2, from: 1, to: 0, breath: 'in' },
  ],
  // Dla uginania największy moment siły jest w połowie ruchu (przedramię poziomo),
  // dlatego aktywację modelujemy przez "obciążenie" zależne od głębokości (patrz load).
  load: (d) => Math.sin(Math.min(1, d * 1.15) * Math.PI * 0.9),
  muscles: {
    biceps:          { rest: 0.08, peak: 0.75, w: 0.85 },
    brachialis:      { rest: 0.10, peak: 0.70, w: 0.85 },
    brachioradialis: { rest: 0.08, peak: 0.55, w: 0.8 },
    forearm_flex:    { rest: 0.12, peak: 0.45, w: 0.8 },
    forearm_ext:     { rest: 0.08, peak: 0.20, w: 0.6 },
    delt_ant:        { rest: 0.04, peak: 0.18, w: 0.7 },
    trap_upper:      { rest: 0.10, peak: 0.20, w: 0.4 },
    triceps_long:    { rest: 0.04, peak: 0.10, w: 0.5 },
    triceps_lat:     { rest: 0.03, peak: 0.08, w: 0.5 },
    erector_spinae:  { rest: 0.08, peak: 0.14, w: 0.4 },
    rectus_abdominis: { rest: 0.05, peak: 0.08, w: 0.4 },
  },
  mistakes: [
    {
      id: 'swing',
      name: 'Bujanie tułowiem',
      what: 'Hantle są „wyrzucane” w górę odchyleniem tułowia w tył i pchnięciem bioder.',
      why: 'Pęd ciała wykonuje część pracy za biceps, więc ten dostaje słabszy bodziec. Odcinek lędźwiowy odgina się pod obciążeniem, a rośnie ryzyko jego przeciążenia.',
      fix: 'Zmniejsz ciężar, stań przy ścianie lub usiądź z oparciem. Unoś hantle tylko ruchem w łokciach.',
      params: { swing: 0.35 },
      muscles: {
        biceps:         { rest: 0.06, peak: 0.55, w: 0.85 },
        brachialis:     { rest: 0.08, peak: 0.52, w: 0.85 },
        erector_spinae: { rest: 0.15, peak: 0.42, w: 0.8 },
        delt_ant:       { rest: 0.05, peak: 0.3, w: 0.7 },
        glute_max:      { rest: 0.05, peak: 0.25, w: 0.8 },
      },
      stress: [{ joint: 'lumbar', label: 'Odcinek lędźwiowy – odgięcie z pędem' }],
    },
    {
      id: 'elbowsFwd',
      name: 'Łokcie wędrują do przodu',
      what: 'Na górze ruchu łokcie unoszą się w przód, a ramię odchodzi od tułowia.',
      why: 'Do ruchu włącza się zgięcie w barku, więc przedni akton naramiennego przejmuje część pracy. Biceps traci napięcie w górnej fazie ruchu.',
      fix: 'Trzymaj łokcie przy bokach tułowia przez cały ruch. Kończ uginanie, zanim przedramię dojdzie do pionu.',
      params: { elbowsFwd: 0.7 },
      muscles: {
        delt_ant: { rest: 0.05, peak: 0.45, w: 0.8 },
        biceps:   { rest: 0.08, peak: 0.62, w: 0.85 },
        trap_upper: { rest: 0.1, peak: 0.28, w: 0.5 },
      },
      stress: [{ joint: 'shoulder', label: 'Bark przejmuje pracę bicepsa' }],
    },
  ],
  sources: [],
  pose,
});
