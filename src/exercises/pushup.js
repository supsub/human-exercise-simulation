import { defineExercise } from './common.js';
import { DIMS } from '../dims.js';
import { rotX, add, neg, downAngle, twoBoneIK, bisect, lerp } from '../kinematics.js';

// Model ruchu pompki:
// Ciało = deska obracająca się wokół czubków palców stóp (kąt θ nad podłożem).
// Dłonie są nieruchomo na podłodze, a ręce dopasowuje IK (ramię + przedramię).
// Parametry błędów: sag – opadanie bioder (przeprost lędźwiowy), flare – łokcie na boki.

const TOE = { z: DIMS.footFront, y: -(DIMS.thigh + DIMS.shin + DIMS.ankleHeight) }; // punkt podparcia w układzie bioder
const WRIST_Y = 0.02;
const TOE_Z = -0.85;   // przesunięcie, żeby ciało było mniej więcej na środku sceny
const ARM = DIMS.upperArm + DIMS.forearm;

// Położenie bioder i barków dla kąta θ i opadnięcia bioder `sag`
function plank(theta, sag = 0) {
  const rxP = Math.PI / 2 - theta + sag;          // miednica + nogi (większy kąt = biodra niżej)
  const rxT = rxP - 2 * sag;                      // tułów odgięty w górę (przeprost w odcinku lędźwiowym)
  const root = add(neg(rotX(TOE, rxP)), { z: TOE_Z, y: 0 });
  const lumbar = add(root, rotX({ z: 0, y: DIMS.lumbarY }, rxP));
  const shoulder = add(lumbar, rotX({ z: 0, y: DIMS.shoulderY }, rxT));
  return { rxP, rxT, root, shoulder };
}

const thetaFor = (height, sag) => bisect((th) => plank(th, sag).shoulder.y, 0.0, 1.2, height, 40);
const TOP_H = WRIST_Y + ARM * 0.995, BOTTOM_H = WRIST_Y + 0.2;
const WRIST = { z: plank(thetaFor(TOP_H, 0)).shoulder.z + 0.02, y: WRIST_Y };

function pose(depth, p = {}) {
  const sag = p.sag ?? 0;
  const theta = thetaFor(lerp(TOP_H, BOTTOM_H, depth), sag);
  const { rxP, rxT, root, shoulder } = plank(theta, sag);

  // Łokcie wypychane w stronę stóp (−Z) – naturalne zgięcie
  const elbow = twoBoneIK(shoulder, WRIST, DIMS.upperArm, DIMS.forearm, -1);
  const upper = downAngle(shoulder, elbow);
  const fore = downAngle(elbow, WRIST);
  const hand = -Math.PI / 2;                    // dłoń płasko, palce w stronę głowy (+Z)

  // przedramię nawrócone (pron 180, dłoń wnętrzem do podłogi) – zgięcie nadgarstka liczone w obróconym układzie dłoni
  const shoulderL = upper - rxT, elbowL = fore - upper, wristL = -(hand - fore);
  const flare = (p.flare ?? 0) * (0.3 + 0.7 * depth);
  return {
    root: { y: root.y, z: root.z, rx: rxP },
    joints: {
      lumbar: rxT - rxP,
      shoulderL, shoulderR: shoulderL, elbowL, elbowR: elbowL, wristL, wristR: wristL,
      armOutL: flare, armOutR: flare,
      neck: -0.25,
      ankleL: 0.15, ankleR: 0.15,
    },
    pron: 180, grip: 0,
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
  breathingTip: 'Wdech podczas opuszczania, wydech podczas wypychania.',
  cameraTarget: [0, 0.3, 0],
  cameraPosition: [2.6, 0.75, 1.3],
  phases: [
    { name: 'Podpór przodem – ręce wyprostowane', kind: 'iso', dur: 0.35, from: 0, to: 0, breath: 'hold' },
    { name: 'Opuszczanie ciała', kind: 'ecc', dur: 1.0, from: 0, to: 1, breath: 'in' },
    { name: 'Dolna pozycja – klatka nad podłogą', kind: 'iso', dur: 0.25, from: 1, to: 1, breath: 'hold' },
    { name: 'Wypychanie w górę', kind: 'con', dur: 0.8, from: 1, to: 0, breath: 'out' },
  ],
  // rest/peak: ułamek MVC (przybliżone, na podstawie zakresów raportowanych w badaniach EMG)
  muscles: {
    pec_stern:        { rest: 0.18, peak: 0.65, w: 0.8 },
    pec_clav:         { rest: 0.15, peak: 0.52, w: 0.8 },
    triceps_lat:      { rest: 0.20, peak: 0.70, w: 0.8 },
    triceps_long:     { rest: 0.15, peak: 0.52, w: 0.8 },
    delt_ant:         { rest: 0.18, peak: 0.55, w: 0.7 },
    delt_lat:         { rest: 0.06, peak: 0.13, w: 0.5 },
    delt_post:        { rest: 0.03, peak: 0.07, w: 0.5 },
    serratus:         { rest: 0.22, peak: 0.50, w: 0.5 },
    rectus_abdominis: { rest: 0.24, peak: 0.32, w: 0.3 },
    obliques:         { rest: 0.20, peak: 0.30, w: 0.3 },
    iliopsoas:        { rest: 0.10, peak: 0.14, w: 0.3 },
    trap_upper:       { rest: 0.07, peak: 0.14, w: 0.5 },
    trap_mid:         { rest: 0.08, peak: 0.18, w: 0.5 },
    trap_low:         { rest: 0.08, peak: 0.16, w: 0.5 },
    latissimus:       { rest: 0.07, peak: 0.15, w: 0.6 },
    forearm_flex:     { rest: 0.14, peak: 0.25, w: 0.5 },
    forearm_ext:      { rest: 0.12, peak: 0.22, w: 0.5 },
    brachioradialis:  { rest: 0.05, peak: 0.12, w: 0.5 },
    biceps:           { rest: 0.04, peak: 0.10, w: 0.6 },
    brachialis:       { rest: 0.04, peak: 0.10, w: 0.6 },
    erector_spinae:   { rest: 0.05, peak: 0.09, w: 0.3 },
    glute_max:        { rest: 0.09, peak: 0.14, w: 0.3 },
    glute_med:        { rest: 0.05, peak: 0.08, w: 0.3 },
    rectus_femoris:   { rest: 0.12, peak: 0.18, w: 0.3 },
    vastus_lateralis: { rest: 0.10, peak: 0.15, w: 0.3 },
    vastus_medialis:  { rest: 0.10, peak: 0.15, w: 0.3 },
    vastus_intermedius: { rest: 0.10, peak: 0.15, w: 0.3 },
    tibialis_ant:     { rest: 0.06, peak: 0.08, w: 0.3 },
    gastroc_med:      { rest: 0.05, peak: 0.08, w: 0.3 },
    gastroc_lat:      { rest: 0.05, peak: 0.08, w: 0.3 },
  },
  mistakes: [
    {
      id: 'sag',
      name: 'Opadające biodra',
      what: 'Biodra opadają w stronę podłogi, a ciało wygina się w łuk.',
      why: 'Brzuch i pośladki przestają stabilizować miednicę, więc odcinek lędźwiowy kręgosłupa wpada w przeprost i przejmuje obciążenie, które powinny nieść mięśnie.',
      fix: 'Napnij brzuch i pośladki („podwiń” miednicę). Głowa, biodra i pięty mają tworzyć prostą linię.',
      params: { sag: 0.2 },
      muscles: {
        rectus_abdominis: { rest: 0.08, peak: 0.12, w: 0.3 },
        obliques:         { rest: 0.07, peak: 0.11, w: 0.3 },
        glute_max:        { rest: 0.03, peak: 0.05, w: 0.3 },
        erector_spinae:   { rest: 0.12, peak: 0.2, w: 0.4 },
      },
      stress: [{ joint: 'lumbar', label: 'Odcinek lędźwiowy – przeprost' }],
    },
    {
      id: 'flare',
      name: 'Łokcie szeroko na boki',
      what: 'Łokcie uciekają na boki, prawie pod kątem 90° do tułowia (ciało w kształcie litery „T”).',
      why: 'Ramię ustawia się w odwiedzeniu i rotacji, co zwęża przestrzeń podbarkową. Przedni akton naramiennego i staw barkowy przejmują więcej pracy, rośnie ryzyko bólu barku.',
      fix: 'Prowadź łokcie pod kątem ok. 45° do tułowia. Dłonie na wysokości dolnej części klatki.',
      params: { flare: 1.0 },
      camera: [0.9, 2.1, 1.9],
      muscles: {
        delt_ant:     { rest: 0.22, peak: 0.7, w: 0.7 },
        pec_stern:    { rest: 0.2, peak: 0.72, w: 0.8 },
        triceps_lat:  { rest: 0.15, peak: 0.55, w: 0.8 },
        triceps_long: { rest: 0.12, peak: 0.42, w: 0.8 },
        serratus:     { rest: 0.18, peak: 0.4, w: 0.5 },
      },
      stress: [{ joint: 'shoulder', label: 'Staw barkowy – ciasnota podbarkowa' }],
    },
    {
      id: 'partial',
      name: 'Niepełny zakres ruchu',
      what: 'Ciało schodzi tylko do połowy drogi, klatka zatrzymuje się daleko od podłogi.',
      why: 'Mięśnie nie pracują w najtrudniejszej, dolnej części ruchu, więc dostają wyraźnie słabszy bodziec. To nie jest groźne, ale ćwiczenie traci sporo skuteczności.',
      fix: 'Zmniejsz trudność (pompki na podwyższeniu lub kolanach), ale schodź w pełnym zakresie.',
      params: { rom: 0.55 },
      muscles: {},
      stress: [],
    },
  ],
  sources: ['Cogley i in. 2005', 'Calatayud i in. 2015'],
  pose,
});
