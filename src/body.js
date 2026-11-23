import * as THREE from 'three';
import { DIMS } from './dims.js';
import { MUSCLES } from './muscles.js';

// Stylizowany manekin: hierarchia grup = szkielet (stawy obracają się wokół osi X),
// segmenty ciała to kapsuły/elipsoidy, a mięśnie to osobne elipsoidy na powierzchni,
// których kolor odpowiada aktywacji.

const SPHERE = new THREE.SphereGeometry(1, 32, 20);

const skinMat = new THREE.MeshStandardMaterial({ color: 0xc3c9d4, roughness: 0.6, metalness: 0.05 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0xaab1be, roughness: 0.6, metalness: 0.05 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.5 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.35, metalness: 0.8 });

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ellipsoid(r, mat, pos = [0, 0, 0]) {
  const m = shadowed(new THREE.Mesh(SPHERE, mat));
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

export function createBody() {
  const joints = {};
  const bones = { L: {}, R: {}, pelvis: null, torso: null };

  const root = new THREE.Group();
  root.name = 'root';
  bones.pelvis = root;
  root.add(ellipsoid([0.165, 0.11, 0.11], skinMat, [0, 0.02, 0]));

  // Tułów
  const torso = joint('lumbar', root, [0, DIMS.lumbarY, 0], joints);
  bones.torso = torso;
  torso.add(ellipsoid([0.14, 0.15, 0.1], skinMat, [0, 0.12, 0]));
  torso.add(ellipsoid([0.17, 0.155, 0.11], skinMat, [0, 0.33, 0]));

  // Szyja i głowa
  const neck = joint('neck', torso, [0, DIMS.neckY, 0], joints);
  const neckMesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.06, 4, 12), jointMat));
  neckMesh.position.y = 0.04;
  neck.add(neckMesh);
  neck.add(ellipsoid([0.095, 0.115, 0.105], skinMat, [0, 0.17, 0.01]));
  neck.add(ellipsoid([0.018, 0.028, 0.02], faceMat, [0, 0.16, 0.112]));          // nos – pokazuje kierunek twarzy
  neck.add(ellipsoid([0.06, 0.012, 0.01], faceMat, [0, 0.19, 0.1]).rotateX(-0.2)); // "oczy" / brwi

  const props = { dumbbells: [] };

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    // Ręka
    const sh = joint('shoulder' + side, torso, [sx * DIMS.shoulderX, DIMS.shoulderY, 0], joints);
    sh.add(ellipsoid([0.055, 0.055, 0.055], jointMat));
    sh.add(limb(0.048, DIMS.upperArm));
    const el = joint('elbow' + side, sh, [0, -DIMS.upperArm, 0], joints);
    el.add(limb(0.04, DIMS.forearm));
    const wr = joint('wrist' + side, el, [0, -DIMS.forearm, 0], joints);
    const hand = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), jointMat));
    hand.position.y = -0.055;
    wr.add(hand);
    const db = dumbbell();
    wr.add(db);
    props.dumbbells.push(db);

    // Noga
    const hip = joint('hip' + side, root, [sx * DIMS.hipX, 0, 0], joints);
    hip.add(limb(0.072, DIMS.thigh));
    const kn = joint('knee' + side, hip, [0, -DIMS.thigh, 0], joints);
    kn.add(limb(0.055, DIMS.shin));
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
    const targets = [];
    if (m.bone === 'torso' || m.bone === 'pelvis') {
      targets.push([bones[m.bone], 1]);
      if (m.mirror) targets.push([bones[m.bone], -1]);
    } else {
      targets.push([bones.L[m.bone], 1]);
      if (m.mirror) targets.push([bones.R[m.bone], -1]);
    }
    for (const [bone, sx] of targets) {
      const mesh = ellipsoid(m.r, mat, [sx * m.pos[0], m.pos[1], m.pos[2]]);
      if (m.rot) mesh.rotation.set(m.rot[0], sx * m.rot[1], sx * m.rot[2]);
      mesh.userData.muscleId = m.id;
      bone.add(mesh);
      muscleMeshes.push(mesh);
    }
  }

  function setPose(pose) {
    root.position.set(0, pose.root.y, pose.root.z);
    root.rotation.x = pose.root.rx;
    for (const [name, g] of Object.entries(joints)) g.rotation.x = pose.joints[name] ?? 0;
    for (const d of props.dumbbells) d.visible = !!pose.props?.dumbbells;
  }

  return { root, joints, materials, muscleMeshes, setPose };
}
