import { defineExercise } from './common.js';
import { DIMS } from '../dims.js';

// Uginanie przedramion z hantlami: ruch tylko w stawie łokciowym,
// ramię nieruchomo przy tułowiu (lekko przesuwa się w przód na górze).

function pose(depth) {
  const elbow = -(0.12 + 2.25 * depth);
  const shoulder = -0.12 * depth;
  return {
    root: { y: DIMS.hipHeight, z: 0, rx: 0 },
    joints: {
      shoulderL: shoulder, shoulderR: shoulder, elbowL: elbow, elbowR: elbow,
      wristL: -0.15 * depth, wristR: -0.15 * depth,
    },
    props: { dumbbells: true },
  };
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
  cameraTarget: [0, 1.0, 0],
  cameraPosition: [1.5, 1.45, 2.7],
  phases: [
    { name: 'Ręce opuszczone, hantle w dłoniach', kind: 'iso', dur: 0.35, from: 0, to: 0 },
    { name: 'Uginanie – unoszenie hantli', kind: 'con', dur: 0.8, from: 0, to: 1 },
    { name: 'Szczytowe napięcie', kind: 'iso', dur: 0.3, from: 1, to: 1 },
    { name: 'Opuszczanie hantli', kind: 'ecc', dur: 1.2, from: 1, to: 0 },
  ],
  // Dla uginania największy moment siły jest w połowie ruchu (przedramię poziomo),
  // dlatego aktywację modelujemy przez "obciążenie" zależne od głębokości (patrz load).
  load: (d) => Math.sin(Math.min(1, d * 1.15) * Math.PI * 0.9),
  muscles: {
    biceps:           { rest: 0.08, peak: 0.75, w: 0.85 },
    forearm_flex:     { rest: 0.10, peak: 0.50, w: 0.8 },
    deltoid_ant:      { rest: 0.04, peak: 0.18, w: 0.7 },
    trapezius:        { rest: 0.10, peak: 0.18, w: 0.4 },
    triceps:          { rest: 0.04, peak: 0.10, w: 0.5 },
    erector_spinae:   { rest: 0.08, peak: 0.14, w: 0.4 },
    rectus_abdominis: { rest: 0.05, peak: 0.08, w: 0.4 },
  },
  sources: [],
  pose,
});
