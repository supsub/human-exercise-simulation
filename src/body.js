import * as THREE from 'three';
import { DIMS } from './dims.js';
import { MUSCLES } from './muscles.js';
import { buildOrganic } from './bodyOrganic.js';
import { getSex } from './sex.js';

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

// punkt chwytu dłoni (odległość od nadgarstka): zwykły chwyt – w zgiętych palcach, wyciskanie – w nasadzie dłoni
const HAND_GRIP = 0.058, HAND_PRESS = 0.038;
const skinMat = new THREE.MeshStandardMaterial({ color: 0xc3c9d4, roughness: 0.6, metalness: 0.05 });
const jointMat = new THREE.MeshStandardMaterial({ color: 0xaab1be, roughness: 0.6, metalness: 0.05 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.5 });
const organicSkin = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.55, metalness: 0.0 });
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
  g.position.set(0, -0.058, 0.01);   // w punkcie chwytu dłoni
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

// look: 'organic' (domyślny – realistyczna sylwetka) albo 'classic' (dawny ludzik z brył; w przeglądarce ?look=classic)
// sex: 'm' | 'f' – sylwetka na start (wygląd organiczny); zmiana w locie: body.setSex
export function createBody({ look = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('look')) || 'organic', sex = getSex() } = {}) {
  const organic = look === 'organic';
  const joints = {};
  const points = {};
  // Bryły kolizyjne skóry (do testu fizyki: sprzęt i dłonie nie mogą wchodzić w ciało)
  const colliders = [];
  // bryły kolizyjne są niewidoczne i niezależne od wyglądu (te same w obu wariantach)
  const collideEll = (parent, part, r, pos) => {
    const o = new THREE.Object3D(); o.scale.set(...r); o.position.set(...pos); parent.add(o);
    colliders.push({ mesh: o, part, kind: 'ell', r: 0, half: 0 });
  };
  const collideCap = (parent, part, r, len, y = -len / 2) => {
    const o = new THREE.Object3D(); o.position.y = y; parent.add(o);
    colliders.push({ mesh: o, part, kind: 'cap', r, half: len / 2 });
  };
  const marker = (name, parent, pos) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    parent.add(g);
    points[name] = g;
  };
  const bones = { L: {}, R: {}, pelvis: null, torso: null };

  const root = new THREE.Group();
  root.name = 'root';
  bones.pelvis = root;
  collideEll(root, 'pelvis', [0.165, 0.11, 0.11], [0, 0.02, 0]);
  if (!organic) root.add(ellipsoid([0.165, 0.11, 0.11], skinMat, [0, 0.02, 0]));

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
  collideEll(belly, 'belly', [0.14, 0.15, 0.1], [0, 0.12 - BELLY_PIVOT, 0]);
  collideEll(ribcage, 'chest', [0.17, 0.155, 0.11], [0, 0.33 - RIB_PIVOT, 0]);
  if (!organic) {
    belly.add(ellipsoid([0.14, 0.15, 0.1], skinMat, [0, 0.12 - BELLY_PIVOT, 0]));
    ribcage.add(ellipsoid([0.17, 0.155, 0.11], skinMat, [0, 0.33 - RIB_PIVOT, 0]));
  }

  // Szyja i głowa
  const neck = joint('neck', torso, [0, DIMS.neckY, 0], joints);
  collideCap(neck, 'neck', 0.045, 0.06, 0.04);
  collideEll(neck, 'head', [0.095, 0.115, 0.105], [0, 0.17, 0.01]);
  let nose = null, faceParts = null, mouth = null;
  if (!organic) {
    const neckMesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.06, 4, 12), jointMat));
    neckMesh.position.y = 0.04;
    neck.add(neckMesh);
    neck.add(ellipsoid([0.095, 0.115, 0.105], skinMat, [0, 0.17, 0.01]));
    nose = ellipsoid([0.018, 0.028, 0.02], faceMat, [0, 0.16, 0.112]);   // nos – pokazuje kierunek twarzy
    neck.add(nose);
    neck.add(ellipsoid([0.06, 0.012, 0.01], faceMat, [0, 0.19, 0.1]).rotateX(-0.2));
  }

  const props = { dumbbells: [] };
  let fingers = [];
  const sides = {};

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = joint('shoulder' + side, torso, [sx * DIMS.shoulderX, DIMS.shoulderY, 0], joints);
    collideCap(sh, 'upperArm' + side, 0.046, DIMS.upperArm);
    const el = joint('elbow' + side, sh, [0, -DIMS.upperArm, 0], joints);
    collideCap(el, 'forearm' + side, 0.038, DIMS.forearm);
    const wr = joint('wrist' + side, el, [0, -DIMS.forearm, 0], joints);
    if (!organic) {
    sh.add(ellipsoid([0.055, 0.055, 0.055], jointMat));
    sh.add(limb(0.046, DIMS.upperArm));
    el.add(limb(0.038, DIMS.forearm));
    // Dłoń: śródręcze + dwuczłonowe palce + kciuk. Palce zaciskają się na trzymanym przedmiocie
    // (uchwyt jest w punkcie 'hand', ok. 7 cm pod nadgarstkiem, tuż przed wnętrzem dłoni).
    const palm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.07, 0.026), jointMat));
    palm.position.set(0, -0.038, -0.013);
    wr.add(palm);
    const f1 = new THREE.Group();
    f1.position.set(0, -0.073, -0.013);
    wr.add(f1);
    const seg1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.032, 0.022), jointMat));
    seg1.position.y = -0.016;
    f1.add(seg1);
    const f2 = new THREE.Group();
    f2.position.y = -0.032;
    f1.add(f2);
    const seg2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.026, 0.02), jointMat));
    seg2.position.y = -0.013;
    f2.add(seg2);
    const thumb = new THREE.Group();
    thumb.position.set(sx * 0.036, -0.03, -0.012);
    wr.add(thumb);
    const tm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.02), jointMat));
    tm.position.y = -0.022;
    thumb.add(tm);
    fingers.push({ f1, f2, thumb, sx });
    }
    const db = dumbbell();
    wr.add(db);
    props.dumbbells.push(db);

    const hip = joint('hip' + side, root, [sx * DIMS.hipX, 0, 0], joints);
    collideCap(hip, 'thigh' + side, 0.07, DIMS.thigh);
    const kn = joint('knee' + side, hip, [0, -DIMS.thigh, 0], joints);
    collideCap(kn, 'shin' + side, 0.052, DIMS.shin);
    const an = joint('ankle' + side, kn, [0, -DIMS.shin, 0], joints);
    if (!organic) {
      hip.add(limb(0.07, DIMS.thigh));
      kn.add(limb(0.052, DIMS.shin));
      const footLen = DIMS.footFront - DIMS.footBack;
      const foot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, footLen), jointMat));
      foot.position.set(0, -DIMS.ankleHeight + 0.03, (DIMS.footFront + DIMS.footBack) / 2);
      an.add(foot);
    }
    sides[side] = { sh, el, wr, hip, kn, an, sx };

    bones[side] = { upperArm: sh, forearm: el, thigh: hip, shin: kn };
    // bark i biodro: zgięcie (X), potem odwiedzenie (Z), na końcu rotacja wzdłuż kości (Y)
    sh.rotation.order = 'XZY';
    wr.rotation.order = 'YXZ';
    hip.rotation.order = 'XZY';
    // punkty pomocnicze: chwyt dłoni, palce i pięta stopy, przód/tył goleni (wałki maszyn)
    marker('hand' + side, wr, [0, -HAND_GRIP, 0.01]);   // punkt chwytu: między śródręczem a zgiętymi palcami (przy wyciskaniu: HAND_PRESS)
    marker('toe' + side, an, [0, -DIMS.ankleHeight, DIMS.footFront]);
    marker('heel' + side, an, [0, -DIMS.ankleHeight, DIMS.footBack]);
    marker('shinFront' + side, kn, [0, -DIMS.shin + 0.08, 0.075]);
    marker('calfBack' + side, kn, [0, -DIMS.shin + 0.1, -0.075]);
    marker('kneeOut' + side, kn, [0, -0.04, 0]);
  }
  marker('chest', torso, [0, 0.3, 0.13]);
  // pozycja sztangi w przysiadzie frontowym: na przednich aktonach barków, przed szyją
  marker('rackL', torso, [0.2, 0.455, 0.115]);
  marker('rackR', torso, [-0.2, 0.455, 0.115]);
  marker('backTop', torso, [0, 0.38, -0.12]);
  marker('headTop', neck, [0, 0.29, 0.01]);

  // Mięśnie – jeden materiał na mięsień (lewa i prawa strona świecą razem)
  let muscleMeshes = [], variants = null, currentSex = 'm';
  const materials = {};
  for (const m of MUSCLES) materials[m.id] = new THREE.MeshStandardMaterial({ color: 0x4a5a78, roughness: 0.5, metalness: 0.0, emissive: 0x000000 });
  if (organic) {
    const o = buildOrganic({ root, ribcage, belly, RIB_PIVOT, BELLY_PIVOT, neck, sides, skinMat: organicSkin, jointMat: organicSkin, faceMat, materials, MUSCLES, shadowed });
    fingers = o.fingers; nose = o.nose; faceParts = o.faceParts; mouth = o.mouth;
    variants = o.variants;
  }
  for (const m of organic ? [] : MUSCLES) {
    const mat = materials[m.id];
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

  const SHOULDER_Y = DIMS.shoulderY;
  // Ustawia kąty stawów. Wartość stawu: liczba (obrót X) albo [x, y, z].
  function applyAngles(pose) {
    root.position.set(pose.root.x ?? 0, pose.root.y, pose.root.z);
    root.rotation.set(pose.root.rx, pose.root.ry ?? 0, pose.root.rz ?? 0);
    for (const [name, g] of Object.entries(joints)) {
      const v = pose.joints[name] ?? 0;
      if (Array.isArray(v)) g.rotation.set(v[0], v[1], v[2]);
      else g.rotation.set(v, 0, 0);
    }
    // obrót przedramienia (nawrócenie): 0 = podchwyt, 90 = młotkowy, 180 = nachwyt; liczba albo [lewa, prawa]
    if (pose.pron !== undefined) for (const [i, S] of ['L', 'R'].entries()) {
      const pr = Array.isArray(pose.pron) ? pose.pron[i] : pose.pron;
      joints['wrist' + S].rotation.y += -(S === 'L' ? 1 : -1) * pr * Math.PI / 180;
    }
    // chwyt do wyciskania (props.bar.press): drążek leży w nasadzie dłoni, nad przedramieniem, a nie w palcach
    const press = !!pose.props?.bar?.press;
    for (const S of ['L', 'R']) points['hand' + S].position.set(0, press ? -HAND_PRESS : -HAND_GRIP, press ? 0.002 : 0.01);
    // unoszenie barków (szrugsy)
    joints.shoulderL.position.y = joints.shoulderR.position.y = SHOULDER_Y + (pose.shrug ?? 0);
    // błędy techniki: łokcie na zewnątrz / kolana do środka
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      twistChain(joints['shoulder' + side], joints['elbow' + side], joints['wrist' + side], pose.joints['armOut' + side] ?? 0, sx);
      twistChain(joints['hip' + side], joints['knee' + side], joints['ankle' + side], pose.joints['legIn' + side] ?? 0, -sx);
    }
    root.updateWorldMatrix(true, true);
  }

  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const pointWorld = (name, out) => (points[name] ?? joints[name]).getWorldPosition(out);

  // Kotwice: przesuwa całe ciało tak, by wskazany punkt (np. dłoń na drążku, palce na podłodze)
  // był w zadanym miejscu. anchor2 (opcjonalnie) dobiera dodatkowo pochylenie ciała (root.rx),
  // żeby drugi punkt miał zadaną wysokość (np. palce w desce). Zwraca pozę z policzonym root.
  // ---------- Fizyka: drążek nie może wchodzić w ciało ----------
  const _inv = new THREE.Matrix4(), _q2 = new THREE.Vector3(), _hl = new THREE.Vector3(), _hr = new THREE.Vector3(), _m = new THREE.Vector3(), _ud = new THREE.Vector3();
  const TRUNK_PARTS = new Set(['head', 'neck', 'chest', 'belly', 'pelvis', 'thighL', 'thighR']);
  function depthIn(c, world) {
    _inv.copy(c.mesh.matrixWorld).invert();
    _q2.copy(world).applyMatrix4(_inv);
    if (c.kind === 'ell') return (1 - _q2.length()) * Math.min(c.mesh.scale.x, c.mesh.scale.y, c.mesh.scale.z);
    const y = Math.max(-c.half, Math.min(c.half, _q2.y));
    return c.r - Math.hypot(_q2.x, _q2.y - y, _q2.z);
  }
  // największe wniknięcie drążka (między dłońmi, długość len) w tułów, głowę, szyję, miednicę lub uda
  function barDepth(len) {
    alignHandsToBar();   // punkt chwytu zależy od obrotu dłoni na drążku
    pointWorld('handL', _hl); pointWorld('handR', _hr);
    _m.addVectors(_hl, _hr).multiplyScalar(0.5);
    _ud.subVectors(_hl, _hr).normalize();
    let worst = -1;
    for (const c of colliders) {
      if (!TRUNK_PARTS.has(c.part)) continue;
      _inv.copy(c.mesh.matrixWorld).invert();          // raz na bryłę, nie na każdy punkt
      const sc = c.kind === 'ell' ? Math.min(c.mesh.scale.x, c.mesh.scale.y, c.mesh.scale.z) : 0;
      for (let s = -len / 2; s <= len / 2; s += 0.04) {
        _q2.copy(_m).addScaledVector(_ud, s).applyMatrix4(_inv);
        let d;
        if (c.kind === 'ell') d = (1 - _q2.length()) * sc;
        else { const y = Math.max(-c.half, Math.min(c.half, _q2.y)); d = c.r - Math.hypot(_q2.x, _q2.y - y, _q2.z); }
        if (d + 0.02 > worst) worst = d + 0.02;
      }
    }
    return worst;
  }
  // Odsuwa drążek od ciała: w każdym kroku próbuje małych zmian (zgięcie w barkach, ugięcie łokci,
  // odchylenie tułowia w tył – jak robi to ćwiczący) i wybiera tę, która najbardziej zmniejsza wniknięcie.
  function avoidBar(out) {
    const len = out.props.bar.len === 'fit' ? 0.3 : out.props.bar.len ?? 1.6;
    const add = (k, dx) => {
      const v = out.joints[k];
      out.joints[k] = Array.isArray(v) ? [v[0] + dx, v[1], v[2]] : (v ?? 0) + dx;
    };
    const lumbar0 = typeof out.joints.lumbar === 'number' ? out.joints.lumbar : 0;
    const moves = [
      (s) => { add('shoulderL', s * 0.03); add('shoulderR', s * 0.03); },
      (s) => { add('elbowL', s * 0.035); add('elbowR', s * 0.035); },
      (s) => { add('lumbar', -s * 0.025); add('shoulderL', s * 0.025); add('shoulderR', s * 0.025); add('neck', s * 0.025); },
    ];
    out.joints = { ...out.joints };
    applyAngles(out);
    let d = barDepth(len);
    for (let i = 0; i < 40 && d > 0; i++) {
      let best = null;
      for (const [mi, mv] of moves.entries()) {
        for (const sgn of [1, -1, 3, -3]) {             // mały i duży krok w obie strony
          if (mi === 2 && sgn < 0) continue;                       // tułów tylko odchylamy w tył
          if (mi === 2 && lumbar0 - (out.joints.lumbar ?? 0) > 0.35) continue;
          const saved = { ...out.joints };
          mv(sgn);
          applyAngles(out);
          const nd = barDepth(len);
          if (!best || nd < best.d) best = { d: nd, joints: { ...out.joints } };
          out.joints = saved;
        }
      }
      if (!best || best.d >= d) break;
      out.joints = best.joints;
      d = best.d;
    }
    applyAngles(out);
  }

  // ---------- IK ramion: dłonie w zadanych punktach (stały chwyt na drążku) ----------
  // ik: { L: { target: [x,y,z], pole: [x,y,z] }, R: {...} } – punkt chwytu dłoni w świecie, pole = kierunek łokcia.
  // Wynik zapisujemy z powrotem jako kąty stawów (bark [x,y,z] w kolejności XZY, łokieć), więc pozy dalej płynnie się mieszają.
  const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3(), _E = new THREE.Vector3(), _kd = new THREE.Vector3();
  const _ua = new THREE.Vector3(), _fv = new THREE.Vector3(), _xa = new THREE.Vector3(), _ya = new THREE.Vector3(), _za = new THREE.Vector3();
  const _mb = new THREE.Matrix4(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _eu = new THREE.Euler();
  function solveArm(S, ik, out) {
    const sh = joints['shoulder' + S], el = joints['elbow' + S], wr = joints['wrist' + S];
    sh.getWorldPosition(_S);
    _T.set(...ik.target);
    const a = DIMS.upperArm, b = DIMS.forearm - points['hand' + S].position.y;   // nadgarstek → punkt chwytu
    _kd.subVectors(_T, _S);
    // cel poza zasięgiem: przybliżamy go tylko w poprzek drążka (y, z) – położenie dłoni wzdłuż drążka (x) zostaje,
    // więc chwyt nigdy nie „ślizga się” po drążku
    const reach = a + b - 2e-3;
    if (_kd.length() > reach && Math.abs(_kd.x) < reach) {
      const k = Math.sqrt(reach * reach - _kd.x * _kd.x) / Math.hypot(_kd.y, _kd.z);
      _kd.y *= k; _kd.z *= k;
    }
    const dist = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, _kd.length()));
    _kd.normalize();
    _P.set(...ik.pole).addScaledVector(_kd, -_P.dot(_kd)).normalize();
    const cosA = (a * a + dist * dist - b * b) / (2 * a * dist), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    _E.copy(_S).addScaledVector(_kd, a * cosA).addScaledVector(_P, a * sinA);
    _T.copy(_S).addScaledVector(_kd, dist);
    _ua.subVectors(_E, _S).normalize();
    _fv.subVectors(_T, _E).normalize();
    const theta = Math.acos(Math.max(-1, Math.min(1, _ua.dot(_fv))));
    // układ ramienia: −Y wzdłuż kości, +Z w stronę, w którą zgina się przedramię
    _za.copy(_fv).addScaledVector(_ua, -_fv.dot(_ua));
    if (_za.lengthSq() < 1e-6) _za.copy(_P); else _za.normalize();
    _ya.copy(_ua).negate();
    _xa.crossVectors(_ya, _za);
    _mb.makeBasis(_xa, _ya, _za);
    _qw.setFromRotationMatrix(_mb);
    sh.parent.getWorldQuaternion(_qp);
    sh.quaternion.copy(_qp.invert().multiply(_qw));
    _eu.setFromQuaternion(sh.quaternion, 'XZY');
    out.joints['shoulder' + S] = [_eu.x, _eu.y, _eu.z];
    out.joints['elbow' + S] = -theta;
    out.joints['wrist' + S] = 0;
    el.rotation.set(-theta, 0, 0);
    wr.rotation.set(0, 0, 0);
    root.updateWorldMatrix(true, true);
  }

  function resolvePose(pose) {
    const needsAvoid = pose.props?.bar && pose.props.bar.on !== 'front' && !pose.ik;
    if (!pose.anchor && !needsAvoid && !pose.ik) return pose;
    const out = { ...pose, root: { ...pose.root }, joints: { ...pose.joints } };
    const finishIK = () => {
      if (!out.ik) return;
      applyAngles(out);
      if (out.ik.L) solveArm('L', out.ik.L, out);
      if (out.ik.R) solveArm('R', out.ik.R, out);
      delete out.ik;
    };
    // stały rozstaw dłoni na sztandze (props.bar.width): po ułożeniu pozy dłonie wracają na swoje miejsca na drążku
    const fixWidth = () => {
      const w = pose.props?.bar?.width;
      if (!w) return;
      applyAngles(out);
      pointWorld('handL', _a); pointWorld('handR', _b);
      const mid = _a.clone().add(_b).multiplyScalar(0.5);
      const ik = {};
      for (const [S, sx, h] of [['L', 1, _a], ['R', -1, _b]]) {
        const sh = pointWorld('shoulder' + S, new THREE.Vector3()), el = pointWorld('elbow' + S, new THREE.Vector3());
        const pole = el.sub(sh.add(h).multiplyScalar(0.5));
        ik[S] = { target: [mid.x + sx * w / 2, mid.y, mid.z], pole: pole.toArray() };
      }
      solveArm('L', ik.L, out); solveArm('R', ik.R, out);
    };
    if (!pose.anchor) {
      finishIK();
      if (needsAvoid) avoidBar(out);
      fixWidth();
      return out;
    }
    const place = () => {
      out.root.x = out.root.y = out.root.z = 0;
      applyAngles(out);
      pointWorld(pose.anchor.pt, _a);
      const at = pose.anchor.at;
      out.root.x = at.x !== undefined ? at.x - _a.x : (pose.root.x ?? 0);
      out.root.y = at.y !== undefined ? at.y - _a.y : pose.root.y;
      out.root.z = at.z !== undefined ? at.z - _a.z : pose.root.z;
    };
    if (pose.anchor2) {
      const f = (rx) => { out.root.rx = rx; place(); applyAngles(out); return pointWorld(pose.anchor2.pt, _b).y - pose.anchor2.y; };
      let lo = pose.root.rx - 0.6, hi = pose.root.rx + 0.6;
      const flo = f(lo);
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === Math.sign(flo)) lo = mid; else hi = mid;
      }
      out.root.rx = (lo + hi) / 2;
    }
    place();
    finishIK();
    if (needsAvoid) { avoidBar(out); place(); }
    fixWidth();
    delete out.anchor; delete out.anchor2;
    return out;
  }

  // ---------- Rekwizyty zależne od pozy (sztanga, wyciąg, płyta suwnicy, guma, wałki) ----------
  const worldProps = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a919c, roughness: 0.35, metalness: 0.8 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.6, metalness: 0.3 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.8 });
  const machinePadMat = new THREE.MeshStandardMaterial({ color: 0x8d6b4a, roughness: 0.75 });   // poduszki maszyny – wyraźne na tle ciała
  const cableMat = new THREE.MeshBasicMaterial({ color: 0xc8ccd4 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x6fbf73, roughness: 0.7 });
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
  const pool = [];
  let used = 0;
  function cyl(a, b, r, mat) {
    let m = pool[used];
    if (!m) { m = shadowed(new THREE.Mesh(CYL, mat)); pool.push(m); worldProps.add(m); }
    used++;
    m.material = mat;
    m.visible = true;
    const len = a.distanceTo(b);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(r, len, r);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _dir.subVectors(b, a).normalize());
    return m;
  }
  const _dir = new THREE.Vector3(), _c = new THREE.Vector3(), _l = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
  // pręt o długości len wycentrowany między punktami pL i pR
  function centeredBar(pL, pR, len, r, mat) {
    _c.addVectors(pL, pR).multiplyScalar(0.5);
    _u.subVectors(pL, pR).normalize();
    if (_u.lengthSq() < 0.5) _u.set(1, 0, 0);
    return cyl(_l.copy(_c).addScaledVector(_u, len / 2), _r.copy(_c).addScaledVector(_u, -len / 2), r, mat);
  }
  const gobletShape = { base: null, r: 0 }, plateShape = { c: null, n: null }, padShape = [];   // padShape: poduszki maszyny [{ a, b, r }] – test fizyki
  function updateWorldProps(props = {}) {
    if (!worldProps.parent && root.parent) root.parent.add(worldProps);
    used = 0;
    const hL = pointWorld('handL', new THREE.Vector3()), hR = pointWorld('handR', new THREE.Vector3());
    const mid = new THREE.Vector3().addVectors(hL, hR).multiplyScalar(0.5);
    if (props.bar?.on === 'front') {
      // sztanga oparta na barkach – rekwizyt liczony od barków, nie od dłoni
      pointWorld('rackL', hL); pointWorld('rackR', hR);
      mid.addVectors(hL, hR).multiplyScalar(0.5);
    }
    if (props.bar) {
      const { plates = true } = props.bar;
      // lina (fit) rozkłada się razem z dłońmi; drążek/sztanga ma stałą długość
      const len = props.bar.len === 'fit' ? hL.distanceTo(hR) + 0.04 : props.bar.len ?? 1.6;
      centeredBar(hL, hR, len, props.bar.len === 'fit' ? 0.01 : 0.014, props.bar.len === 'fit' ? cableMat : metal);
      if (plates) {
        _u.subVectors(hL, hR).normalize();
        if (_u.lengthSq() < 0.5) _u.set(1, 0, 0);
        for (const s of [1, -1]) {
          const c = mid.clone().addScaledVector(_u, s * (len / 2 - 0.12));
          cyl(c.clone().addScaledVector(_u, -0.03), c.clone().addScaledVector(_u, 0.03), typeof plates === 'number' ? plates : 0.2, plateMat);   // plates: liczba = promień talerza
        }
      }
    }
    if (props.goblet) {
      // jeden hantel trzymany pionowo oburącz
      // górny talerz leży na wnętrzach obu dłoni (ciężar oparty o dłonie, palce obejmują brzeg talerza),
      // rączka i dolny talerz zwisają pod nim. Geometria zapisana w gobletShape – korzysta z niej test fizyki.
      const pL = joints.wristL.localToWorld(new THREE.Vector3(0, -0.04, 0.004));
      const pR = joints.wristR.localToWorld(new THREE.Vector3(0, -0.04, 0.004));
      const base = pL.clone().add(pR).multiplyScalar(0.5);
      base.y = Math.max(pL.y, pR.y) + 0.006;
      // talerz wysunięty lekko przed dłonie (od klatki) – nie wchodzi w klatkę, dalej leży na dłoniach
      const away = base.clone().sub(pointWorld('chest', new THREE.Vector3())); away.y = 0; away.normalize();
      base.addScaledVector(away, 0.05);
      const at = (dy) => base.clone().add(new THREE.Vector3(0, dy, 0));
      gobletShape.base = base; gobletShape.r = 0.1;
      cyl(at(0), at(0.065), 0.1, plateMat);
      cyl(at(0.01), at(-0.17), 0.016, metal);
      cyl(at(-0.15), at(-0.215), 0.1, plateMat);
    }
    if (props.cable) {
      // linka od bloczka do uchwytu (do środka między dłońmi albo do każdej dłoni osobno)
      for (const [i, a] of props.cable.from.entries()) {
        const to = props.cable.from.length === 2 ? (i === 0 ? hL : hR) : mid;
        cyl(new THREE.Vector3(...a), to, 0.005, cableMat);
      }
    }
    if (props.band) {
      const kL = pointWorld('kneeOutL', new THREE.Vector3()), kR = pointWorld('kneeOutR', new THREE.Vector3());
      cyl(kL, kR, 0.012, bandMat);
    }
    if (props.plate) {
      // płyta suwnicy pod stopami, prostopadła do kierunku nóg
      const tL = pointWorld('toeL', new THREE.Vector3()), tR = pointWorld('toeR', new THREE.Vector3());
      const eL = pointWorld('heelL', new THREE.Vector3()), eR = pointWorld('heelR', new THREE.Vector3());
      const c = new THREE.Vector3().add(tL).add(tR).add(eL).add(eR).multiplyScalar(0.25);
      // płyta leży płasko pod podeszwami: jej normalna = kierunek „w dół stopy” (oś −Y kostki), nie linia kolano→stopa
      const e = joints.ankleL.matrixWorld.elements;
      const n = new THREE.Vector3(-e[4], -e[5], -e[6]).normalize();
      plateShape.c = c.clone(); plateShape.n = n.clone();
      cyl(c.clone().addScaledVector(n, 0.002), c.clone().addScaledVector(n, 0.042), 0.32, plateMat);
    }
    if (props.pads) {
      // Maszyna do odwodzenia / przywodzenia: poduszki na dźwigniach przy kolanach (side 'out' – po zewnętrznej,
      // 'in' – po wewnętrznej stronie ud), nogi rozpychają / ściągają je wbrew ciężarowi ze stosu obok maszyny.
      // Poduszka 13,5 cm od osi uda: poza skórą i mięśniami (udo z mięśniami ok. 9 cm), bez przenikania.
      const { side, rest, full } = props.pads, k = side === 'out' ? 1 : -1;
      padShape.length = 0;
      for (const S of ['L', 'R']) {
        const sx = S === 'L' ? 1 : -1, hip = joints['hip' + S];
        const a = hip.localToWorld(new THREE.Vector3(sx * k * 0.135, -0.26, 0)), b = hip.localToWorld(new THREE.Vector3(sx * k * 0.135, -0.42, 0));
        cyl(a, b, 0.035, machinePadMat);
        padShape.push({ a: a.clone(), b: b.clone(), r: 0.035 });
        const m = a.clone().add(b).multiplyScalar(0.5);
        cyl(m, new THREE.Vector3(m.x, 0.3, m.z), 0.012, metal);            // dźwignia w dół, do osi obrotu przy podstawie
      }
      // stos ciężarów: część górnych płyt unosi się tym wyżej, im dalej poduszki od pozycji spoczynku
      const abd = Math.abs(joints.hipL.rotation.z) * 180 / Math.PI;
      const lift = Math.max(0, Math.min(1, (abd - rest) / (full - rest))) * 0.22;
      const SX = -0.78, SZ = -0.3, up = (y) => new THREE.Vector3(SX, y, SZ);
      for (const dx of [-0.13, 0.13]) cyl(new THREE.Vector3(SX + dx, 0, SZ), new THREE.Vector3(SX + dx, 1.45, SZ), 0.01, metal);   // prowadnice
      for (let i = 0; i < 10; i++) {
        const y = 0.03 + i * 0.028 + (i >= 5 ? lift : 0);
        cyl(up(y), up(y + 0.024), 0.11, plateMat);
      }
      cyl(up(0.03 + 10 * 0.028 + lift), up(1.42), 0.004, cableMat);              // linka do bloczka
      cyl(new THREE.Vector3(SX - 0.16, 1.45, SZ), new THREE.Vector3(SX + 0.16, 1.45, SZ), 0.02, metal);   // belka z bloczkiem
    }
    for (const pad of props.rollers ?? []) {
      // wałki maszyn: 'shin' (przód goleni) albo 'calf' (tył goleni)
      const key = pad === 'shin' ? 'shinFront' : 'calfBack';
      centeredBar(pointWorld(key + 'L', new THREE.Vector3()), pointWorld(key + 'R', new THREE.Vector3()), 0.45, 0.045, padMat);
    }
    for (let i = used; i < pool.length; i++) pool[i].visible = false;
  }

  // grip: 0 = dłoń otwarta, 1 = pełny chwyt. Domyślnie z rekwizytów (hantle, sztanga, uchwyt wyciągu).
  function setGrip(pose) {
    const p = pose.props ?? {};
    const g = pose.grip ?? (p.dumbbells || p.bar ? 1 : p.goblet ? 0.75 : 0.12);
    for (const f of fingers) {
      if (f.chains) {
        // palce owijają się wokół uchwytu (kąty dobrane do drążka ~3 cm średnicy)
        for (const [i, c] of f.chains.entries()) {
          const spread = (i - 1.5) * 0.05 * (1 - g);
          c[0].rotation.set(-(0.12 + 1.12 * g), 0, f.sx * spread);
          c[1].rotation.x = -(0.1 + 0.95 * g);
          c[2].rotation.x = -(0.06 + 0.72 * g);
        }
        f.thumb.rotation.set(-0.35 - 0.75 * g, 0, -f.sx * (0.35 + 0.35 * g));
        f.tj.rotation.x = -0.15 - 0.6 * g;
        continue;
      }
      f.f1.rotation.x = -1.45 * g;
      f.f2.rotation.x = -1.5 * g;
      f.thumb.rotation.set(-0.9 * g, 0, -f.sx * (0.25 + 0.5 * g));
    }
  }

  // Dłonie na drążku: obracamy przedramię (oś Y nadgarstka) tak, żeby drążek leżał w poprzek zgiętych palców.
  // Z dwóch możliwych ustawień wybieramy to, które daje zadany typ chwytu – stały przez cały ruch:
  //   'over'  (nachwyt) – kciuki skierowane do środka drążka, 'under' (podchwyt) – kciuki na zewnątrz.
  const _f = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3(), _bar = new THREE.Vector3(), _th = new THREE.Vector3();
  function alignHandsToBar(type = 'over') {
    pointWorld('handL', _a); pointWorld('handR', _b);
    for (const S of ['L', 'R']) {
      const wr = joints['wrist' + S], sx = S === 'L' ? 1 : -1;
      const e = wr.parent.matrixWorld.elements;   // układ przedramienia (obrót Y nadgarstka = wokół jego osi)
      _x.set(e[0], e[1], e[2]).normalize();
      _f.set(e[4], e[5], e[6]).normalize();
      _z.set(e[8], e[9], e[10]).normalize();
      _bar.subVectors(_a, _b);
      _bar.addScaledVector(_f, -_bar.dot(_f));
      if (_bar.lengthSq() < 1e-8) continue;
      _bar.normalize();
      let th = Math.atan2(-_bar.dot(_z), _bar.dot(_x));
      // kciuk = +sx·X dłoni; po obrocie o th: X' = cos·X − sin·Z
      _th.copy(_x).multiplyScalar(Math.cos(th)).addScaledVector(_z, -Math.sin(th)).multiplyScalar(sx);
      const inward = _th.dot(_bar) * -sx > 0;          // _bar wskazuje od prawej dłoni do lewej
      if (inward !== (type === 'over')) th += Math.PI;
      if (th > Math.PI) th -= 2 * Math.PI;
      wr.rotation.y = th;
    }
    root.updateWorldMatrix(true, true);
  }

  function setPose(pose) {
    applyAngles(pose);
    if (pose.props?.bar && pose.props.bar.on !== 'front') {
      alignHandsToBar(pose.props.bar.grip);
      // wyciskanie: nadgarstek lekko odgięty, drążek nad kośćmi przedramienia
      if (pose.props.bar.press) for (const S of ['L', 'R']) joints['wrist' + S].rotation.x = 0.3;
    }
    setGrip(pose);
    const db = pose.props?.dumbbells;
    props.dumbbells.forEach((d, i) => {
      d.visible = db === true || db === (i === 0 ? 'L' : 'R');
    });
    updateWorldProps(pose.props);
  }

  // b: 0 = pełny wydech, 1 = pełny wdech
  // usta przy wydechu: 0 = zamknięte (kreska), 1 = lekko otwarte w „o” (wydmuchiwanie powietrza)
  const MOUTH_SHUT = new THREE.Color(0x8a93a3), MOUTH_OPEN = new THREE.Color(0x2a2f38);
  let mouthHome = null, onFace = null;   // onFace: usta na twarzy ze zdjęcia (src/face.js) – { pos, color }
  function setMouth(v) {
    if (!mouth) return;
    if (onFace) {
      // na zdjęciu widać prawdziwe wargi – rysujemy tylko otwór między nimi, który pojawia się przy wydechu
      mouth.visible = v > 0.03;
      mouth.material.opacity = Math.min(1, v * 1.3);
      mouth.scale.set(0.006 + 0.008 * v, 0.0015 + 0.0055 * v, 0.003);
      return;
    }
    mouth.scale.set(0.022 - 0.008 * v, 0.004 + 0.0055 * v, 0.004 + 0.002 * v);
    mouth.material.color.lerpColors(MOUTH_SHUT, MOUTH_OPEN, v);
  }
  // punkt, z którego wylatuje powietrze przy wydechu: środek ust (także ust z twarzy ze zdjęcia), lekko przed wargami
  function mouthWorld(out = new THREE.Vector3()) {
    if (mouth) return mouth.localToWorld(out.set(0, 0, 1.5));   // skala ust: z = głębokość → 1,5× przed środkiem
    return joints.neck.localToWorld(out.set(0, 0.118, 0.11));    // wygląd klasyczny (bez ust)
  }
  function setMouthOnFace(pos, color) {
    if (!mouth) return;
    mouthHome ??= mouth.position.clone();
    onFace = pos ? { pos, color } : null;
    if (onFace) {
      mouth.position.set(pos[0], pos[1], pos[2] + 0.0015);
      mouth.material.color.set(color);
      Object.assign(mouth.material, { transparent: true, depthWrite: false });
      mouth.renderOrder = 3;   // nad płatem twarzy
      mouth.castShadow = false;
    } else {
      mouth.position.copy(mouthHome);
      Object.assign(mouth.material, { transparent: false, depthWrite: true, opacity: 1 });
      mouth.renderOrder = 0; mouth.visible = true;
    }
    mouth.material.needsUpdate = true;
    setMouth(0);
  }
  function setBreath(b) {
    ribcage.scale.set(1 + 0.03 * b, 1 + 0.015 * b, 1 + 0.07 * b);
    belly.scale.set(1 + 0.015 * b, 1, 1 + 0.1 * b);
  }

  // Sylwetka: przełącza widoczną skórę i mięśnie (szkielet, ruch i bryły kolizyjne są wspólne)
  function setSex(s) {
    if (!variants || !variants[s]) return;
    currentSex = s;
    for (const [k, v] of Object.entries(variants)) for (const m of v.skin) m.visible = k === s;
    muscleMeshes = variants[s].muscleMeshes;
  }
  setSex(sex);

  return { root, joints, points, colliders, dumbbells: props.dumbbells, gobletShape, plateShape, padShape, materials,
    get muscleMeshes() { return muscleMeshes; }, get sex() { return currentSex; }, setSex, nose, faceParts, setPose, setBreath, setMouth, setMouthOnFace, mouthWorld, resolvePose };
}
