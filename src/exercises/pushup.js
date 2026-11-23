import { defineExercise } from './common.js';
import { DIMS, SHOULDER_IN_ROOT } from '../dims.js';
import { rotX, add, neg, downAngle, twoBoneIK, bisect, lerp } from '../kinematics.js';

// Model ruchu pompki:
// Ciało = sztywna deska obracająca się wokół czubków palców stóp (kąt θ nad podłożem).
// Dłonie są nieruchomo na podłodze, a ręce dopasowuje IK (ramię + przedramię).

const TOE = { z: DIMS.footFront, y: -(DIMS.thigh + DIMS.shin + DIMS.ankleHeight) }; // punkt podparcia w układzie bioder
const WRIST_Y = 0.02;
const TOE_Z = -0.85;   // przesunięcie, żeby ciało było mniej więcej na środku sceny
const ARM = DIMS.upperArm + DIMS.forearm;

// Położenie bioder i barków dla kąta θ
function plank(theta) {
  const rx = Math.PI / 2 - theta;               // obrót ciała: twarzą do podłogi
  const root = add(neg(rotX(TOE, rx)), { z: TOE_Z, y: 0 }); // palce dotykają podłogi w (TOE_Z, 0)
  const shoulder = add(root, rotX(SHOULDER_IN_ROOT, rx));
  return { rx, root, shoulder };
}

const shoulderHeight = (th) => plank(th).shoulder.y;
const THETA_TOP = bisect(shoulderHeight, 0.05, 1.2, WRIST_Y + ARM * 0.995);
const THETA_BOTTOM = bisect(shoulderHeight, 0.0, 1.2, WRIST_Y + 0.2);
const WRIST = { z: plank(THETA_TOP).shoulder.z + 0.02, y: WRIST_Y };

function pose(depth) {
  const theta = lerp(THETA_TOP, THETA_BOTTOM, depth);
  const { rx, root, shoulder } = plank(theta);

  // Łokcie wypychane w stronę stóp (−Z) – naturalne zgięcie
  const elbow = twoBoneIK(shoulder, WRIST, DIMS.upperArm, DIMS.forearm, -1);
  const upper = downAngle(shoulder, elbow);
  const fore = downAngle(elbow, WRIST);
  const hand = -Math.PI / 2;                    // dłoń płasko, palce w stronę głowy (+Z)

  const shoulderL = upper - rx, elbowL = fore - upper, wristL = hand - fore;
  return {
    root: { y: root.y, z: root.z, rx },
    joints: {
      shoulderL, shoulderR: shoulderL, elbowL, elbowR: elbowL, wristL, wristR: wristL,
      neck: -0.25,                              // głowa w przedłużeniu tułowia, wzrok lekko przed dłonie
      ankleL: 0.15, ankleR: 0.15,
    },
    props: {},
  };
}

export default defineExercise({
  id: 'pushup',
  name: 'Pompka',
  aliases: ['pomp', 'push'],
  description:
    'Klasyczna pompka na dłoniach. Ciało tworzy sztywną deskę od głowy do pięt, a ruch odbywa się w stawach barkowych i łokciowych.',
  cues: [
    'Dłonie pod barkami, nieco szerzej niż ich szerokość.',
    'Napięty brzuch i pośladki, biodra nie opadają.',
    'Łokcie skierowane lekko w tył (ok. 45° od tułowia).',
    'Opuszczaj się, aż klatka znajdzie się tuż nad podłogą.',
  ],
  cameraTarget: [0, 0.3, 0],
  cameraPosition: [2.6, 0.75, 1.3],
  phases: [
    { name: 'Podpór przodem – ręce wyprostowane', kind: 'iso', dur: 0.35, from: 0, to: 0 },
    { name: 'Opuszczanie ciała', kind: 'ecc', dur: 1.0, from: 0, to: 1 },
    { name: 'Dolna pozycja – klatka nad podłogą', kind: 'iso', dur: 0.25, from: 1, to: 1 },
    { name: 'Wypychanie w górę', kind: 'con', dur: 0.8, from: 1, to: 0 },
  ],
  // rest/peak: ułamek MVC (przybliżone, na podstawie zakresów raportowanych w badaniach EMG)
  muscles: {
    pectoralis:       { rest: 0.18, peak: 0.65, w: 0.8 },
    triceps:          { rest: 0.20, peak: 0.70, w: 0.8 },
    deltoid_ant:      { rest: 0.18, peak: 0.55, w: 0.7 },
    serratus:         { rest: 0.22, peak: 0.50, w: 0.5 },
    rectus_abdominis: { rest: 0.24, peak: 0.32, w: 0.3 },
    obliques:         { rest: 0.20, peak: 0.30, w: 0.3 },
    trapezius:        { rest: 0.10, peak: 0.22, w: 0.5 },
    latissimus:       { rest: 0.07, peak: 0.15, w: 0.6 },
    forearm_flex:     { rest: 0.14, peak: 0.25, w: 0.5 },
    biceps:           { rest: 0.04, peak: 0.10, w: 0.6 },
    deltoid_post:     { rest: 0.04, peak: 0.09, w: 0.5 },
    erector_spinae:   { rest: 0.05, peak: 0.09, w: 0.3 },
    gluteus:          { rest: 0.09, peak: 0.14, w: 0.3 },
    quadriceps:       { rest: 0.12, peak: 0.18, w: 0.3 },
    hamstrings:       { rest: 0.03, peak: 0.05, w: 0.3 },
    gastrocnemius:    { rest: 0.05, peak: 0.08, w: 0.3 },
  },
  sources: ['Cogley i in. 2005', 'Calatayud i in. 2015'],
  pose,
});
