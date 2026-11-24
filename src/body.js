import * as THREE from 'three';
import { DIMS } from './dims.js';
import { MUSCLES } from './muscles.js';

// Stylizowany manekin: hierarchia grup = szkielet (stawy obracają się wokół osi X),
// segmenty ciała to kapsuły/elipsoidy, a mięśnie to osobne bryły na powierzchni,
// których kolor odpowiada aktywacji.

const SPHERE = new THREE.SphereGeometry(1, 32, 20);

// Bryła obrotowa o profilu brzuśca mięśnia; peak = położenie najgrubszego miejsca (0 = góra, 1 = dół)
const latheCache = {};
function muscleGeometry(shape) {
  const peak = { spindle: 0.5, tear: 0.68, tearUp: 0.32 }[shape];
  if (peak === undefined) return SPHERE;
  if (!latheCache[shape]) {
    const pts = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const r = t < peak ? Math.sin((Math.PI / 2) * (t / peak)) : Math.cos((Math.PI / 2) * ((t - peak) / (1 - peak)));
      pts.push(new THREE.Vector2(Math.max(0.001, Math.pow(Math.max(r, 0), 0.7)), 1 - 2 * t));
    }
    // LatheGeometry wymaga punktów od dołu do góry – inaczej ściany są odwrócone (widać tylko tylną połowę bryły)
    latheCache[shape] = new THREE.LatheGeometry(pts.reverse(), 24);
  }
  return latheCache[shape];
}

const skinMat = new THREE.MeshStandardMaterial({ color: 0xc3c9d4, roughness: 0.6, metalness: 0.05 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0xaab1be, roughness: 0.6, metalness: 0.05 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.5 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.35, metalness: 0.8 });

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ellipsoid(r, mat, pos = [0, 0, 0], geo = SPHERE) {
  const m = shadowed(new THREE.Mesh(geo, mat));
  m.scale.set(...r);
  m.position.set(...pos);
  return m;
}

// Kapsuła od stawu (0,0,0) w dół na długość `length`
function limb(radius, length, mat = skinMat) {
  const m = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 18), mat));
  m.position.y = -length / 2;
  return m;
}

function joint(name, parent, pos, registry) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...pos);
  parent.add(g);
  registry[name] = g;
  return g;
}

function dumbbell() {
  const g = new THREE.Group();
  const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 12), metalMat));
  handle.rotation.z = Math.PI / 2;
  g.add(handle);
  for (const x of [-0.085, 0.085]) {
    const plate = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 24), metalMat));
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x;
    g.add(plate);
  }
  g.position.set(0, -0.06, 0);
  g.visible = false;
  return g;
}

// Obrót całego łańcucha (np. bark→łokieć→nadgarstek) wokół osi łączącej jego początek z końcem.
// Koniec łańcucha zostaje w miejscu, a staw środkowy wychyla się na bok:
// używamy tego do pokazania błędów (łokcie na boki w pompce, kolana do środka w przysiadzie).
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function twistChain(rootG, midG, endG, angle, lateralSign) {
  if (!angle) return;
  const parent = rootG.parent;
  parent.updateWorldMatrix(true, true);
  const end = parent.worldToLocal(endG.getWorldPosition(_v1)).sub(rootG.position).normalize();
  const midBefore = parent.worldToLocal(midG.getWorldPosition(_v2)).x;
  _q.setFromAxisAngle(end, angle);
  rootG.quaternion.premultiply(_q);
  parent.updateWorldMatrix(true, true);
  const midAfter = parent.worldToLocal(midG.getWorldPosition(_v2)).x;
  // jeśli staw poszedł w złą stronę – obróć w przeciwną
  if (Math.sign(midAfter - midBefore) !== Math.sign(lateralSign)) {
    _q.setFromAxisAngle(end, -2 * angle);
    rootG.quaternion.premultiply(_q);
  }
}

export function createBody() {
  const joints = {};
  const bones = { L: {}, R: {}, pelvis: null, torso: null };

  const root = new THREE.Group();
  root.name = 'root';
  bones.pelvis = root;
  root.add(ellipsoid([0.165, 0.11, 0.11], skinMat, [0, 0.02, 0]));

  // Tułów: klatka piersiowa i brzuch to osobne grupy, które "oddychają" (skalują się)
  const torso = joint('lumbar', root, [0, DIMS.lumbarY, 0], joints);
  bones.torso = torso;
  const RIB_PIVOT = 0.2, BELLY_PIVOT = 0.1;
  const ribcage = new THREE.Group();
  ribcage.position.y = RIB_PIVOT;
  torso.add(ribcage);
  const belly = new THREE.Group();
  belly.position.y = BELLY_PIVOT;
  torso.add(belly);
  belly.add(ellipsoid([0.14, 0.15, 0.1], skinMat, [0, 0.12 - BELLY_PIVOT, 0]));
  ribcage.add(ellipsoid([0.17, 0.155, 0.11], skinMat, [0, 0.33 - RIB_PIVOT, 0]));

  // Szyja i głowa
  const neck = joint('neck', torso, [0, DIMS.neckY, 0], joints);
  const neckMesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.06, 4, 12), jointMat));
  neckMesh.position.y = 0.04;
  neck.add(neckMesh);
  neck.add(ellipsoid([0.095, 0.115, 0.105], skinMat, [0, 0.17, 0.01]));
  const nose = ellipsoid([0.018, 0.028, 0.02], faceMat, [0, 0.16, 0.112]);   // nos – pokazuje kierunek twarzy
  neck.add(nose);
  neck.add(ellipsoid([0.06, 0.012, 0.01], faceMat, [0, 0.19, 0.1]).rotateX(-0.2));

  const props = { dumbbells: [] };

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = joint('shoulder' + side, torso, [sx * DIMS.shoulderX, DIMS.shoulderY, 0], joints);
    sh.add(ellipsoid([0.055, 0.055, 0.055], jointMat));
    sh.add(limb(0.046, DIMS.upperArm));
    const el = joint('elbow' + side, sh, [0, -DIMS.upperArm, 0], joints);
    el.add(limb(0.038, DIMS.forearm));
    const wr = joint('wrist' + side, el, [0, -DIMS.forearm, 0], joints);
    const hand = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), jointMat));
    hand.position.y = -0.055;
    wr.add(hand);
    const db = dumbbell();
    wr.add(db);
    props.dumbbells.push(db);

    const hip = joint('hip' + side, root, [sx * DIMS.hipX, 0, 0], joints);
    hip.add(limb(0.07, DIMS.thigh));
    const kn = joint('knee' + side, hip, [0, -DIMS.thigh, 0], joints);
    kn.add(limb(0.052, DIMS.shin));
    const an = joint('ankle' + side, kn, [0, -DIMS.shin, 0], joints);
    const footLen = DIMS.footFront - DIMS.footBack;
    const foot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, footLen), jointMat));
    foot.position.set(0, -DIMS.ankleHeight + 0.03, (DIMS.footFront + DIMS.footBack) / 2);
    an.add(foot);

    bones[side] = { upperArm: sh, forearm: el, thigh: hip, shin: kn };
  }

  // Mięśnie – jeden materiał na mięsień (lewa i prawa strona świecą razem)
  const muscleMeshes = [];
  const materials = {};
  for (const m of MUSCLES) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a78, roughness: 0.45, metalness: 0.0, emissive: 0x000000 });
    materials[m.id] = mat;
    if (m.deep) continue;
    const parts = m.parts ?? [{ pos: m.pos, r: m.r, rot: m.rot }];
    const sides = m.mirror ? [1, -1] : [1];
    for (const sx of sides) {
      for (const p of parts) {
        let bone, offsetY = 0;
        if (m.bone === 'torso') {
          // mięśnie tułowia trafiają do klatki lub brzucha, żeby poruszały się z oddechem
          if (p.pos[1] >= 0.2) { bone = ribcage; offsetY = RIB_PIVOT; } else { bone = belly; offsetY = BELLY_PIVOT; }
        } else if (m.bone === 'pelvis') bone = bones.pelvis;
        else bone = bones[sx > 0 ? 'L' : 'R'][m.bone];
        const mesh = ellipsoid(p.r, mat, [sx * p.pos[0], p.pos[1] - offsetY, p.pos[2]], muscleGeometry(m.shape));
        if (p.rot) mesh.rotation.set(p.rot[0], sx * p.rot[1], sx * p.rot[2]);
        mesh.userData.muscleId = m.id;
        bone.add(mesh);
        muscleMeshes.push(mesh);
      }
    }
  }

  function setPose(pose) {
    root.position.set(0, pose.root.y, pose.root.z);
    root.rotation.set(pose.root.rx, 0, 0);
    for (const [name, g] of Object.entries(joints)) g.rotation.set(pose.joints[name] ?? 0, 0, 0);
    for (const d of props.dumbbells) d.visible = !!pose.props?.dumbbells;
    // błędy techniki: łokcie na zewnątrz / kolana do środka
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      twistChain(joints['shoulder' + side], joints['elbow' + side], joints['wrist' + side], pose.joints['armOut' + side] ?? 0, sx);
      twistChain(joints['hip' + side], joints['knee' + side], joints['ankle' + side], pose.joints['legIn' + side] ?? 0, -sx);
    }
  }

  // b: 0 = pełny wydech, 1 = pełny wdech
  function setBreath(b) {
    ribcage.scale.set(1 + 0.03 * b, 1 + 0.015 * b, 1 + 0.07 * b);
    belly.scale.set(1 + 0.015 * b, 1, 1 + 0.1 * b);
  }

  return { root, joints, materials, muscleMeshes, nose, setPose, setBreath };
}
