import { defineExercise } from './common.js';
import { DIMS } from '../dims.js';
import { downAngle, twoBoneIK, lerp } from '../kinematics.js';

// Model ruchu przysiadu: stopy stoją płasko, biodra zjeżdżają w dół i w tył,
// tułów pochyla się do przodu, a nogi (udo + goleń) dopasowuje IK z kolanami do przodu.

const ANKLE = { z: 0, y: DIMS.ankleHeight };

function pose(depth) {
  const hip = { z: -0.24 * depth, y: DIMS.hipHeight - 0.43 * depth };
  const lean = 0.04 + 0.62 * depth;                 // pochylenie tułowia (rad)
  const knee = twoBoneIK(hip, ANKLE, DIMS.thigh, DIMS.shin, +1);
  const thigh = downAngle(hip, knee);
  const shin = downAngle(knee, ANKLE);
  const arm = -(0.25 + 1.3 * depth);                // ręce unoszą się w przód dla równowagi

  const hipL = thigh - lean, kneeL = shin - thigh, ankleL = -shin;
  const shoulderL = arm - lean;
  return {
    root: { y: hip.y, z: hip.z, rx: lean },
    joints: {
      hipL, hipR: hipL, kneeL, kneeR: kneeL, ankleL, ankleR: ankleL,
      shoulderL, shoulderR: shoulderL, elbowL: -0.1, elbowR: -0.1,
      neck: -lean * 0.75,
    },
    props: {},
  };
}

export default defineExercise({
  id: 'squat',
  name: 'Przysiad',
  aliases: ['przysiad', 'squat', 'kucni', 'kucn'],
  description:
    'Przysiad bez obciążenia. Ruch zachodzi jednocześnie w biodrach, kolanach i stawach skokowych; tułów pochyla się, aby środek ciężkości pozostał nad stopami.',
  cues: [
    'Stopy na szerokość bioder, ciężar na całej stopie.',
    'Biodra cofają się w tył, kolana podążają nad palcami.',
    'Plecy proste, klatka piersiowa uniesiona.',
    'Schodź, aż uda znajdą się mniej więcej równolegle do podłogi.',
  ],
  cameraTarget: [0, 0.75, 0],
  cameraPosition: [2.6, 1.4, 2.2],
  phases: [
    { name: 'Pozycja stojąca', kind: 'iso', dur: 0.35, from: 0, to: 0 },
    { name: 'Zejście w dół', kind: 'ecc', dur: 1.2, from: 0, to: 1 },
    { name: 'Dolna pozycja przysiadu', kind: 'iso', dur: 0.3, from: 1, to: 1 },
    { name: 'Wstawanie', kind: 'con', dur: 1.0, from: 1, to: 0 },
  ],
  muscles: {
    quadriceps:       { rest: 0.08, peak: 0.60, w: 0.9 },
    gluteus:          { rest: 0.04, peak: 0.38, w: 0.9 },
    adductors:        { rest: 0.04, peak: 0.32, w: 0.9 },
    hamstrings:       { rest: 0.05, peak: 0.20, w: 0.7 },
    erector_spinae:   { rest: 0.10, peak: 0.35, w: 0.7 },
    gastrocnemius:    { rest: 0.08, peak: 0.20, w: 0.5 },
    rectus_abdominis: { rest: 0.05, peak: 0.12, w: 0.5 },
    obliques:         { rest: 0.06, peak: 0.14, w: 0.5 },
    deltoid_ant:      { rest: 0.04, peak: 0.22, w: 0.9 },
    trapezius:        { rest: 0.06, peak: 0.14, w: 0.6 },
  },
  sources: ['Escamilla 2001', 'Caterisano i in. 2002'],
  pose,
});
