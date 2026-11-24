import * as THREE from 'three';
import { Loft, loftZ, musclePatch, softEdges } from './anatomy.js';

// Wygląd „organiczny” (DEMO): gładka skóra z przekrojów, wyraźne stawy (rzepka, łokieć, kostki),
// dłonie z palcami, stopy z piętą i palcami, mięśnie jako płaty przylegające do skóry.
// Szkielet, kotwice, punkty pomocnicze i bryły kolizyjne są wspólne z wyglądem klasycznym (body.js).

// ---------- Kształty (metry, lokalne układy stawów; dla lewej strony, x > 0 = na zewnątrz) ----------
const TORSO = [
  { y: -0.04, w: 0.15, d: 0.095, db: 0.105 }, { y: 0.03, w: 0.145, d: 0.095, db: 0.098 },
  { y: 0.10, w: 0.137, d: 0.092, db: 0.092 }, { y: 0.17, w: 0.148, d: 0.098, db: 0.095 },
  { y: 0.24, w: 0.163, d: 0.106, db: 0.1 }, { y: 0.31, w: 0.176, d: 0.113, db: 0.104 },
  { y: 0.37, w: 0.183, d: 0.11, db: 0.104 }, { y: 0.42, w: 0.18, d: 0.094, db: 0.1 },
  { y: 0.465, w: 0.14, d: 0.07, db: 0.08 }, { y: 0.5, w: 0.07, d: 0.05, db: 0.06 }, { y: 0.53, w: 0.055, d: 0.045, db: 0.05 },
];
const PELVIS = [
  { y: -0.125, w: 0.03, d: 0.03 }, { y: -0.11, w: 0.1, d: 0.07, db: 0.08 }, { y: -0.06, w: 0.15, d: 0.09, db: 0.112 },
  { y: 0.0, w: 0.164, d: 0.095, db: 0.113 }, { y: 0.06, w: 0.157, d: 0.095, db: 0.104 }, { y: 0.12, w: 0.15, d: 0.095, db: 0.1 },
];
const NECK = [{ y: -0.02, w: 0.06, d: 0.055 }, { y: 0.05, w: 0.052, d: 0.05 }, { y: 0.11, w: 0.05, d: 0.048 }];
const HEAD = [
  { y: 0.06, w: 0.02, d: 0.02, z0: 0.03 }, { y: 0.075, w: 0.045, d: 0.05, z0: 0.035 }, { y: 0.1, w: 0.065, d: 0.07, z0: 0.025 },
  { y: 0.14, w: 0.078, d: 0.09, z0: 0.01 }, { y: 0.19, w: 0.087, d: 0.098, z0: 0.005 }, { y: 0.24, w: 0.085, d: 0.095 },
  { y: 0.272, w: 0.07, d: 0.078 }, { y: 0.288, w: 0.053, d: 0.059 }, { y: 0.298, w: 0.031, d: 0.035 }, { y: 0.3035, w: 0.008, d: 0.009 },
];
const UPPER_ARM = [
  { y: 0.045, w: 0.04, d: 0.04 }, { y: 0.0, w: 0.058, d: 0.055 }, { y: -0.05, w: 0.056, d: 0.052 }, { y: -0.12, w: 0.05, d: 0.048 },
  { y: -0.2, w: 0.045, d: 0.044 }, { y: -0.27, w: 0.042, d: 0.04 }, { y: -0.31, w: 0.036, d: 0.034 }, { y: -0.33, w: 0.008, d: 0.008 },
];
const FOREARM = [
  { y: 0.03, w: 0.03, d: 0.03 }, { y: 0.0, w: 0.042, d: 0.04 }, { y: -0.06, w: 0.045, d: 0.042 }, { y: -0.14, w: 0.037, d: 0.033 },
  { y: -0.22, w: 0.029, d: 0.022 }, { y: -0.27, w: 0.027, d: 0.019 }, { y: -0.285, w: 0.012, d: 0.01 },
];
const PALM = [{ y: 0.0, w: 0.03, d: 0.016, z0: -0.013 }, { y: -0.03, w: 0.038, d: 0.015, z0: -0.013 }, { y: -0.07, w: 0.041, d: 0.013, z0: -0.013 }, { y: -0.08, w: 0.03, d: 0.01, z0: -0.013 }];
const THIGH = [
  { y: 0.06, w: 0.07, d: 0.07 }, { y: 0.0, w: 0.088, d: 0.086, db: 0.09 }, { y: -0.08, w: 0.085, d: 0.082 }, { y: -0.2, w: 0.074, d: 0.07 },
  { y: -0.32, w: 0.062, d: 0.058 }, { y: -0.41, w: 0.053, d: 0.05 }, { y: -0.47, w: 0.045, d: 0.045 }, { y: -0.49, w: 0.01, d: 0.01 },
];
const SHIN = [
  { y: 0.03, w: 0.05, d: 0.05 }, { y: -0.03, w: 0.052, d: 0.05, db: 0.056 }, { y: -0.1, w: 0.05, d: 0.048, db: 0.066 },
  { y: -0.2, w: 0.044, d: 0.04, db: 0.052 }, { y: -0.3, w: 0.034, d: 0.032, db: 0.036 }, { y: -0.39, w: 0.027, d: 0.026 },
  { y: -0.43, w: 0.026, d: 0.026 }, { y: -0.45, w: 0.008, d: 0.008 },
];
const FOOT = [
  { z: -0.066, y: -0.05, w: 0.012, h: 0.012 }, { z: -0.05, y: -0.05, w: 0.03, h: 0.03 }, { z: -0.02, y: -0.045, w: 0.035, h: 0.036 },
  { z: 0.03, y: -0.05, w: 0.04, h: 0.03 }, { z: 0.08, y: -0.06, w: 0.046, h: 0.02 }, { z: 0.13, y: -0.068, w: 0.047, h: 0.012 },
  { z: 0.165, y: -0.071, w: 0.038, h: 0.0085 }, { z: 0.176, y: -0.072, w: 0.014, h: 0.004 },
];

const SHAPES = {
  torso: new Loft(TORSO, { exp: 2.4 }), pelvis: new Loft(PELVIS, { exp: 2.2 }),
  upperArm: new Loft(UPPER_ARM), forearm: new Loft(FOREARM), thigh: new Loft(THIGH), shin: new Loft(SHIN),
};

// ---------- Mięśnie: płaty na powierzchni (a = kąty, y = zakres wzdłuż segmentu, T = grubość, peak = najgrubsze miejsce) ----------
export const ORGANIC_MUSCLES = {
  pec_clav: [{ seg: 'torso', a: { top: [42, 87], bottom: [36, 87] }, y: [0.44, 0.385], T: 0.012, peak: 0.5 }],
  pec_stern: [{ seg: 'torso', a: { top: [34, 87], bottom: [52, 87] }, y: [0.385, 0.27], T: 0.022, peak: 0.55 }],
  serratus: [
    { seg: 'torso', a: [6, 28], y: [0.315, 0.285], T: 0.008 }, { seg: 'torso', a: [4, 30], y: [0.275, 0.245], T: 0.008 },
    { seg: 'torso', a: [4, 32], y: [0.235, 0.205], T: 0.008 },
  ],
  delt_ant: [{ seg: 'upperArm', a: { top: [58, 115], bottom: [78, 98] }, y: [0.035, -0.14], T: 0.02, peak: 0.3 }],
  delt_lat: [{ seg: 'upperArm', a: { top: [-22, 62], bottom: [8, 38] }, y: [0.045, -0.15], T: 0.022, peak: 0.3 }],
  delt_post: [{ seg: 'upperArm', a: { top: [-115, -20], bottom: [-85, -48] }, y: [0.035, -0.14], T: 0.018, peak: 0.3 }],
  trap_upper: [{ seg: 'torso', a: { top: [-80, 5], bottom: [-75, 25] }, y: [0.51, 0.44], T: 0.018, peak: 0.45 }],
  trap_mid: [{ seg: 'torso', a: { top: [-89, -38], bottom: [-89, -55] }, y: [0.435, 0.33], T: 0.011, peak: 0.4 }],
  trap_low: [{ seg: 'torso', a: { top: [-89, -56], bottom: [-89, -82] }, y: [0.33, 0.2], T: 0.01, peak: 0.3 }],
  latissimus: [{ seg: 'torso', a: { top: [-38, -4], bottom: [-82, -40] }, y: [0.36, 0.08], T: 0.016, peak: 0.3 }],
  biceps: [{ seg: 'upperArm', a: [66, 122], y: [-0.08, -0.275], T: 0.021, peak: 0.55 }],
  brachialis: [{ seg: 'upperArm', a: [18, 62], y: [-0.17, -0.285], T: 0.009, peak: 0.5 }],
  triceps_long: [{ seg: 'upperArm', a: [-150, -98], y: [-0.06, -0.275], T: 0.016, peak: 0.45 }],
  triceps_lat: [{ seg: 'upperArm', a: [-98, -38], y: [-0.06, -0.225], T: 0.016, peak: 0.45 }],
  brachioradialis: [{ seg: 'forearm', a: [18, 76], y: [0.02, -0.17], T: 0.013, peak: 0.3 }],
  forearm_flex: [{ seg: 'forearm', a: [92, 168], y: [-0.01, -0.19], T: 0.011, peak: 0.3 }],
  forearm_ext: [{ seg: 'forearm', a: [-112, -8], y: [-0.01, -0.19], T: 0.01, peak: 0.3 }],
  rectus_abdominis: [
    { seg: 'torso', a: [74, 88], y: [0.275, 0.21], T: 0.012, spindle: 0.15 }, { seg: 'torso', a: [74, 88.5], y: [0.205, 0.145], T: 0.013, spindle: 0.15 },
    { seg: 'torso', a: [74, 89], y: [0.14, 0.08], T: 0.013, spindle: 0.15 }, { seg: 'torso', a: [75, 89], y: [0.075, -0.01], T: 0.011, spindle: 0.2 },
  ],
  obliques: [{ seg: 'torso', a: { top: [8, 52], bottom: [14, 72] }, y: [0.23, 0.0], T: 0.012, peak: 0.45 }],
  erector_spinae: [{ seg: 'torso', a: [-87, -70], y: [0.3, -0.03], T: 0.016, peak: 0.72 }],
  glute_max: [{ seg: 'pelvis', a: { top: [-86, -30], bottom: [-86, -22] }, y: [0.06, -0.115], T: 0.03, peak: 0.55 }],
  glute_med: [{ seg: 'pelvis', a: [-32, 4], y: [0.075, -0.03], T: 0.015, peak: 0.45 }],
  rectus_femoris: [{ seg: 'thigh', a: [74, 108], y: [-0.05, -0.41], T: 0.016, peak: 0.5 }],
  vastus_lateralis: [{ seg: 'thigh', a: [4, 74], y: [-0.06, -0.43], T: 0.019, peak: 0.55 }],
  vastus_medialis: [{ seg: 'thigh', a: [106, 162], y: [-0.25, -0.44], T: 0.021, peak: 0.68 }],
  biceps_femoris: [{ seg: 'thigh', a: [-82, -18], y: [-0.08, -0.41], T: 0.014, peak: 0.5 }],
  semitendinosus: [{ seg: 'thigh', a: [-152, -86], y: [-0.08, -0.41], T: 0.014, peak: 0.5 }],
  adductors: [{ seg: 'thigh', a: { top: [140, 205], bottom: [160, 186] }, y: [-0.01, -0.26], T: 0.016, peak: 0.3 }],
  gastroc_med: [{ seg: 'shin', a: [-152, -90], y: [-0.03, -0.2], T: 0.018, peak: 0.35 }],
  gastroc_lat: [{ seg: 'shin', a: [-96, -40], y: [-0.03, -0.18], T: 0.015, peak: 0.35 }],
  soleus: [{ seg: 'shin', a: [-152, -30], y: [-0.17, -0.33], T: 0.009, peak: 0.3 }],
  tibialis_ant: [{ seg: 'shin', a: [38, 84], y: [-0.03, -0.3], T: 0.009, peak: 0.3 }],
};

// ctx: grupy szkieletu z body.js; zwraca { muscleMeshes, fingers, nose }
export function buildOrganic(ctx) {
  const { root, ribcage, belly, RIB_PIVOT, BELLY_PIVOT, neck, sides, skinMat, jointMat, faceMat, materials, MUSCLES, shadowed } = ctx;
  const mesh = (geo, mat) => shadowed(new THREE.Mesh(geo, mat));
  const ell = (r, pos, mat = jointMat) => { const m = mesh(new THREE.SphereGeometry(1, 20, 14), mat); m.scale.set(...r); m.position.set(...pos); return m; };

  // Tułów: dolna część oddycha z brzuchem, górna z klatką
  const lower = new Loft(TORSO.filter((r) => r.y <= 0.24), { exp: 2.4 });
  const upper = new Loft(TORSO.filter((r) => r.y >= 0.17), { exp: 2.4 });
  const lg = lower.geometry(); lg.translate(0, -BELLY_PIVOT, 0); belly.add(mesh(lg, skinMat));
  const ug = upper.geometry(); ug.translate(0, -RIB_PIVOT, 0); ribcage.add(mesh(ug, skinMat));
  root.add(mesh(SHAPES.pelvis.geometry(), skinMat));
  // obojczyki – delikatny zarys
  for (const sx of [1, -1]) {
    const c = mesh(new THREE.CapsuleGeometry(0.0055, 0.11, 4, 8), skinMat);
    c.rotation.z = Math.PI / 2 - sx * 0.12; c.position.set(sx * 0.1, 0.442 - RIB_PIVOT, 0.068);
    ribcage.add(c);
  }
  // Szyja i głowa
  neck.add(mesh(new Loft(NECK).geometry(), skinMat));
  neck.add(mesh(new Loft(HEAD, { seg: 40, steps: 40 }).geometry(), skinMat));
  const nose = ell([0.014, 0.024, 0.018], [0, 0.155, 0.103], skinMat);
  neck.add(nose);
  for (const sx of [1, -1]) {
    neck.add(ell([0.01, 0.028, 0.018], [sx * 0.087, 0.17, -0.005], skinMat));            // uszy
    neck.add(ell([0.016, 0.006, 0.006], [sx * 0.03, 0.188, 0.094], faceMat));             // brwi
    neck.add(ell([0.011, 0.007, 0.004], [sx * 0.031, 0.172, 0.094], faceMat));            // oczy
  }
  neck.add(ell([0.022, 0.004, 0.004], [0, 0.118, 0.098], faceMat));                        // usta

  const fingers = [];
  for (const S of ['L', 'R']) {
    const { sh, el, wr, hip, kn, an, sx } = sides[S];
    sh.add(mesh(SHAPES.upperArm.geometry(sx), skinMat));
    el.add(mesh(SHAPES.forearm.geometry(sx), skinMat));
    el.add(ell([0.016, 0.02, 0.014], [0, 0.0, -0.036], skinMat));                         // wyrostek łokciowy – kierunek łokcia
    // dłoń: śródręcze + 4 palce (2 człony) + kciuk; palce zginają się razem (setGrip w body.js)
    wr.add(mesh(new Loft(PALM).geometry(sx), skinMat));
    const f1 = new THREE.Group(); f1.position.set(0, -0.073, -0.013); wr.add(f1);
    const f2 = new THREE.Group(); f2.position.y = -0.03; f1.add(f2);
    for (const fx of [-0.027, -0.009, 0.009, 0.027]) {
      const len = fx === -0.027 * sx ? 0.022 : 0.028;
      const p1 = mesh(new THREE.CapsuleGeometry(0.0088, len, 4, 8), skinMat); p1.position.set(fx, -len / 2, 0); f1.add(p1);
      const p2 = mesh(new THREE.CapsuleGeometry(0.008, 0.02, 4, 8), skinMat); p2.position.set(fx, -0.012, 0); f2.add(p2);
    }
    const thumb = new THREE.Group(); thumb.position.set(-sx * 0.036, -0.03, -0.012); wr.add(thumb);
    const tm = mesh(new THREE.CapsuleGeometry(0.0105, 0.032, 4, 8), skinMat); tm.position.y = -0.022; thumb.add(tm);
    fingers.push({ f1, f2, thumb, sx });

    hip.add(mesh(SHAPES.thigh.geometry(sx), skinMat));
    hip.add(ell([0.021, 0.025, 0.01], [0, -0.448, 0.043], skinMat));                       // rzepka – kierunek kolana
    kn.add(mesh(SHAPES.shin.geometry(sx), skinMat));
    for (const mx of [0.03, -0.028]) an.add(ell([0.011, 0.014, 0.012], [mx * sx, 0, 0], skinMat)); // kostki
    an.add(mesh(loftZ(FOOT, sx), skinMat));
  }

  // Mięśnie
  const muscleMeshes = [];
  for (const m of MUSCLES) {
    const patches = ORGANIC_MUSCLES[m.id];
    if (!patches || m.deep) continue;
    const mat = materials[m.id];
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    softEdges(mat);
    for (const S of ['L', 'R']) {
      const sx = S === 'L' ? 1 : -1;
      for (const p of patches) {
        const geo = musclePatch(SHAPES[p.seg], p, sx);
        let parent;
        if (p.seg === 'torso') {
          const yc = (p.y[0] + p.y[1]) / 2;
          if (yc >= 0.2) { parent = ribcage; geo.translate(0, -RIB_PIVOT, 0); } else { parent = belly; geo.translate(0, -BELLY_PIVOT, 0); }
        } else if (p.seg === 'pelvis') parent = root;
        else parent = { upperArm: sides[S].sh, forearm: sides[S].el, thigh: sides[S].hip, shin: sides[S].kn }[p.seg];
        const me = mesh(geo, mat);
        me.userData.muscleId = m.id;
        parent.add(me);
        muscleMeshes.push(me);
      }
    }
  }
  return { muscleMeshes, fingers, nose };
}
