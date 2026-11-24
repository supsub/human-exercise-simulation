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
  const points = {};
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
  const fingers = [];

  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = joint('shoulder' + side, torso, [sx * DIMS.shoulderX, DIMS.shoulderY, 0], joints);
    sh.add(ellipsoid([0.055, 0.055, 0.055], jointMat));
    sh.add(limb(0.046, DIMS.upperArm));
    const el = joint('elbow' + side, sh, [0, -DIMS.upperArm, 0], joints);
    el.add(limb(0.038, DIMS.forearm));
    const wr = joint('wrist' + side, el, [0, -DIMS.forearm, 0], joints);
    // Dłoń: śródręcze + dwuczłonowe palce + kciuk. Palce zaciskają się na trzymanym przedmiocie
    // (uchwyt jest w punkcie 'hand', ok. 7 cm pod nadgarstkiem, tuż przed wnętrzem dłoni).
    const palm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.07, 0.026), jointMat));
    palm.position.set(0, -0.038, -0.02);
    wr.add(palm);
    const f1 = new THREE.Group();
    f1.position.set(0, -0.073, -0.02);
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
    thumb.position.set(-sx * 0.036, -0.03, -0.012);
    wr.add(thumb);
    const tm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.02), jointMat));
    tm.position.y = -0.022;
    thumb.add(tm);
    fingers.push({ f1, f2, thumb, sx });
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
    // bark i biodro: zgięcie (X), potem odwiedzenie (Z), na końcu rotacja wzdłuż kości (Y)
    sh.rotation.order = 'XZY';
    hip.rotation.order = 'XZY';
    // punkty pomocnicze: chwyt dłoni, palce i pięta stopy, przód/tył goleni (wałki maszyn)
    marker('hand' + side, wr, [0, -0.07, 0]);
    marker('toe' + side, an, [0, -DIMS.ankleHeight, DIMS.footFront]);
    marker('heel' + side, an, [0, -DIMS.ankleHeight, DIMS.footBack]);
    marker('shinFront' + side, kn, [0, -DIMS.shin + 0.08, 0.075]);
    marker('calfBack' + side, kn, [0, -DIMS.shin + 0.1, -0.075]);
    marker('kneeOut' + side, kn, [0, -0.04, 0]);
  }
  marker('chest', torso, [0, 0.3, 0.13]);
  marker('backTop', torso, [0, 0.38, -0.12]);
  marker('headTop', neck, [0, 0.29, 0.01]);

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
  function resolvePose(pose) {
    if (!pose.anchor) return pose;
    const out = { ...pose, root: { ...pose.root } };
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
    delete out.anchor; delete out.anchor2;
    return out;
  }

  // ---------- Rekwizyty zależne od pozy (sztanga, wyciąg, płyta suwnicy, guma, wałki) ----------
  const worldProps = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a919c, roughness: 0.35, metalness: 0.8 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.6, metalness: 0.3 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.8 });
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
  function updateWorldProps(props = {}) {
    if (!worldProps.parent && root.parent) root.parent.add(worldProps);
    used = 0;
    const hL = pointWorld('handL', new THREE.Vector3()), hR = pointWorld('handR', new THREE.Vector3());
    const mid = new THREE.Vector3().addVectors(hL, hR).multiplyScalar(0.5);
    if (props.bar) {
      const { len = 1.6, plates = true } = props.bar;
      centeredBar(hL, hR, len, 0.014, metal);
      if (plates) {
        _u.subVectors(hL, hR).normalize();
        if (_u.lengthSq() < 0.5) _u.set(1, 0, 0);
        for (const s of [1, -1]) {
          const c = mid.clone().addScaledVector(_u, s * (len / 2 - 0.12));
          cyl(c.clone().addScaledVector(_u, -0.03), c.clone().addScaledVector(_u, 0.03), 0.2, plateMat);
        }
      }
    }
    if (props.goblet) {
      // jeden hantel trzymany pionowo oburącz
      const top = mid.clone().add(new THREE.Vector3(0, 0.1, 0)), bot = mid.clone().add(new THREE.Vector3(0, -0.08, 0));
      cyl(top, bot, 0.016, metal);
      cyl(top.clone().add(new THREE.Vector3(0, 0.02, 0)), top.clone().add(new THREE.Vector3(0, -0.03, 0)), 0.065, plateMat);
      cyl(bot.clone().add(new THREE.Vector3(0, 0.03, 0)), bot.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.065, plateMat);
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
      const n = new THREE.Vector3().subVectors(c, pointWorld('kneeL', new THREE.Vector3())).normalize();
      cyl(c.clone().addScaledVector(n, 0.01), c.clone().addScaledVector(n, 0.05), 0.32, plateMat);
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
    const g = pose.grip ?? (p.dumbbells || p.bar ? 1 : p.goblet ? 0.55 : 0.12);
    for (const f of fingers) {
      f.f1.rotation.x = -1.45 * g;
      f.f2.rotation.x = -1.5 * g;
      f.thumb.rotation.set(-0.9 * g, 0, f.sx * (0.25 + 0.5 * g));
    }
  }

  function setPose(pose) {
    applyAngles(pose);
    setGrip(pose);
    const db = pose.props?.dumbbells;
    props.dumbbells.forEach((d, i) => {
      d.visible = db === true || db === (i === 0 ? 'L' : 'R');
      d.rotation.y = pose.props?.neutralGrip ? Math.PI / 2 : 0; // chwyt młotkowy
    });
    updateWorldProps(pose.props);
  }

  // b: 0 = pełny wydech, 1 = pełny wdech
  function setBreath(b) {
    ribcage.scale.set(1 + 0.03 * b, 1 + 0.015 * b, 1 + 0.07 * b);
    belly.scale.set(1 + 0.015 * b, 1, 1 + 0.1 * b);
  }

  return { root, joints, points, materials, muscleMeshes, nose, setPose, setBreath, resolvePose };
}
