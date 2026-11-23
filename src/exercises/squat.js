import { defineExercise } from './common.js';
import { DIMS } from '../dims.js';
import { downAngle, twoBoneIK, rotX } from '../kinematics.js';

// Model ruchu przysiadu: stopy stoją na podłodze, biodra zjeżdżają w dół i w tył,
// tułów pochyla się do przodu, a nogi (udo + goleń) dopasowuje IK z kolanami do przodu.
// Parametry błędów: valgus – kolana do środka, round – zaokrąglenie lędźwi, heels – odrywanie pięt.

function pose(depth, p = {}) {
  const heels = (p.heels ?? 0) * depth;
  // Pięta unosi się: stopa obraca się wokół czubków palców (footFront, 0)
  const a = rotX({ z: -DIMS.footFront, y: DIMS.ankleHeight }, heels);
  const ankle = { z: DIMS.footFront + a.z, y: a.y };

  const hipBack = Math.max(0.05, 0.24 - 0.55 * (p.heels ?? 0));
  const hip = { z: -hipBack * depth, y: DIMS.hipHeight - 0.43 * depth };
  const round = (p.round ?? 0) * depth;
  const lean = 0.04 + (0.62 - 0.7 * (p.heels ?? 0)) * depth - 0.55 * round;
  const knee = twoBoneIK(hip, ankle, DIMS.thigh, DIMS.shin, +1);
  const thigh = downAngle(hip, knee);
  const shin = downAngle(knee, ankle);
  const arm = -(0.25 + 1.3 * depth);                // ręce unoszą się w przód dla równowagi

  const hipL = thigh - lean, kneeL = shin - thigh, ankleL = heels - shin;
  const shoulderL = arm - lean - round;
  const valgus = (p.valgus ?? 0) * depth;
  return {
    root: { y: hip.y, z: hip.z, rx: lean },
    joints: {
      lumbar: round,
      hipL, hipR: hipL, kneeL, kneeR: kneeL, ankleL, ankleR: ankleL,
      legInL: valgus, legInR: valgus,
      shoulderL, shoulderR: shoulderL, elbowL: -0.1, elbowR: -0.1,
      neck: -(lean + round) * 0.75,
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
  breathingTip: 'Wdech przed zejściem, krótkie wstrzymanie w dole (napięcie brzucha stabilizuje kręgosłup), wydech podczas wstawania.',
  cameraTarget: [0, 0.75, 0],
  cameraPosition: [2.6, 1.4, 2.2],
  phases: [
    { name: 'Pozycja stojąca', kind: 'iso', dur: 0.35, from: 0, to: 0, breath: 'in' },
    { name: 'Zejście w dół', kind: 'ecc', dur: 1.2, from: 0, to: 1, breath: 'hold' },
    { name: 'Dolna pozycja przysiadu', kind: 'iso', dur: 0.3, from: 1, to: 1, breath: 'hold' },
    { name: 'Wstawanie', kind: 'con', dur: 1.0, from: 1, to: 0, breath: 'out' },
  ],
  muscles: {
    vastus_lateralis:   { rest: 0.08, peak: 0.65, w: 0.9 },
    vastus_medialis:    { rest: 0.08, peak: 0.70, w: 0.9 },
    vastus_intermedius: { rest: 0.08, peak: 0.60, w: 0.9 },
    rectus_femoris:     { rest: 0.06, peak: 0.40, w: 0.8 },
    glute_max:          { rest: 0.04, peak: 0.38, w: 0.9 },
    glute_med:          { rest: 0.05, peak: 0.20, w: 0.7 },
    adductors:          { rest: 0.04, peak: 0.32, w: 0.9 },
    biceps_femoris:     { rest: 0.05, peak: 0.20, w: 0.7 },
    semitendinosus:     { rest: 0.05, peak: 0.18, w: 0.7 },
    erector_spinae:     { rest: 0.10, peak: 0.35, w: 0.7 },
    gastroc_med:        { rest: 0.08, peak: 0.18, w: 0.5 },
    gastroc_lat:        { rest: 0.07, peak: 0.16, w: 0.5 },
    soleus:             { rest: 0.10, peak: 0.25, w: 0.6 },
    tibialis_ant:       { rest: 0.10, peak: 0.25, w: 0.6 },
    rectus_abdominis:   { rest: 0.05, peak: 0.12, w: 0.5 },
    obliques:           { rest: 0.06, peak: 0.14, w: 0.5 },
    iliopsoas:          { rest: 0.05, peak: 0.15, w: 0.6 },
    delt_ant:           { rest: 0.04, peak: 0.22, w: 0.9 },
    delt_lat:           { rest: 0.03, peak: 0.10, w: 0.9 },
    trap_upper:         { rest: 0.06, peak: 0.14, w: 0.6 },
    trap_mid:           { rest: 0.05, peak: 0.12, w: 0.6 },
  },
  mistakes: [
    {
      id: 'valgus',
      name: 'Kolana uciekają do środka',
      what: 'Podczas wstawania i w dole kolana zapadają się do środka, w stronę siebie (koślawienie).',
      why: 'Słabe mięśnie odwodzące biodro (pośladkowy średni) nie utrzymują osi nogi. Więzadła kolana, zwłaszcza przyśrodkowe i krzyżowe przednie, dostają obciążenie skrętne.',
      fix: '„Rozpychaj podłogę” stopami na zewnątrz, kolana prowadź nad drugim–trzecim palcem. Pomaga wzmacnianie pośladka średniego (np. chodzenie z gumą).',
      params: { valgus: 0.32 },
      camera: [0.5, 1.0, 2.6],
      muscles: {
        glute_med:  { rest: 0.03, peak: 0.07, w: 0.5 },
        glute_max:  { rest: 0.03, peak: 0.28, w: 0.9 },
        adductors:  { rest: 0.06, peak: 0.45, w: 0.9 },
        vastus_medialis: { rest: 0.06, peak: 0.55, w: 0.9 },
      },
      stress: [{ joint: 'knee', label: 'Więzadła kolana – koślawienie' }],
    },
    {
      id: 'round',
      name: 'Zaokrąglone plecy',
      what: 'W dolnej fazie miednica podwija się, a odcinek lędźwiowy zaokrągla (tzw. „butt wink” i dalej).',
      why: 'Kręgosłup traci neutralne ustawienie i pracuje w zgięciu pod obciążeniem. Krążki międzykręgowe są wtedy ściskane nierównomiernie, a pośladki pracują słabiej.',
      fix: 'Schodź tylko tak nisko, jak pozwala neutralny kręgosłup. Napnij brzuch przed zejściem i popracuj nad mobilnością bioder i kostek.',
      params: { round: 0.55 },
      muscles: {
        erector_spinae: { rest: 0.12, peak: 0.52, w: 0.8 },
        glute_max:      { rest: 0.03, peak: 0.25, w: 0.9 },
        rectus_abdominis: { rest: 0.03, peak: 0.06, w: 0.5 },
      },
      stress: [{ joint: 'lumbar', label: 'Krążki międzykręgowe – zgięcie pod obciążeniem' }],
    },
    {
      id: 'heels',
      name: 'Pięty odrywają się od podłogi',
      what: 'Ciężar przenosi się na palce, pięty unoszą się, a kolana wysuwają daleko przed stopy.',
      why: 'Biodra prawie nie cofają się w tył, więc niemal cała praca spada na czworogłowy i staw kolanowy. Ścięgno rzepki jest mocno przeciążone, a stabilność spada.',
      fix: 'Trzymaj ciężar na środku stopy i piętach, siadaj biodrami w tył. Przy ograniczonej mobilności kostek pomaga lekkie podwyższenie pod piętami.',
      params: { heels: 0.3 },
      muscles: {
        rectus_femoris:   { rest: 0.08, peak: 0.55, w: 0.8 },
        vastus_lateralis: { rest: 0.1, peak: 0.78, w: 0.9 },
        vastus_medialis:  { rest: 0.1, peak: 0.8, w: 0.9 },
        vastus_intermedius: { rest: 0.1, peak: 0.72, w: 0.9 },
        glute_max:        { rest: 0.03, peak: 0.18, w: 0.9 },
        biceps_femoris:   { rest: 0.03, peak: 0.1, w: 0.7 },
        semitendinosus:   { rest: 0.03, peak: 0.1, w: 0.7 },
        gastroc_med:      { rest: 0.15, peak: 0.35, w: 0.6 },
        gastroc_lat:      { rest: 0.14, peak: 0.32, w: 0.6 },
        tibialis_ant:     { rest: 0.04, peak: 0.08, w: 0.5 },
      },
      stress: [{ joint: 'knee', label: 'Ścięgno rzepki – przeciążenie kolan' }],
    },
  ],
  sources: ['Escamilla 2001', 'Caterisano i in. 2002'],
  pose,
});
