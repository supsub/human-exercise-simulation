import * as THREE from 'three';

// Test podstawowej fizyki pozy (narzędzie deweloperskie, tools/sheet.html?check):
//  1. sprzęt (drążek/sztanga, hantle, hantel oburącz) nie wchodzi w ciało – poza trzymającymi go dłońmi/przedramionami,
//  2. dłonie nie wchodzą w tułów, głowę, miednicę ani uda,
//  3. nic nie przechodzi przez podłogę (stopy, kolana, dłonie, talerze sztangi).
// Ciało = bryły kolizyjne skóry z body.js (elipsoidy i kapsuły). Zwraca listę naruszeń { what, part, depth }.

const _inv = new THREE.Matrix4(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

// Głębokość wniknięcia punktu w bryłę (> 0 = w środku), w metrach (dla elipsoidy – przybliżenie)
function depthIn(c, world) {
  _inv.copy(c.mesh.matrixWorld).invert();
  _p.copy(world).applyMatrix4(_inv);
  if (c.kind === 'ell') {
    const s = c.mesh.scale;
    const n = _p.length();                      // w lokalnym układzie bryła to kula o promieniu 1
    return (1 - n) * Math.min(s.x, s.y, s.z);
  }
  const y = Math.max(-c.half, Math.min(c.half, _p.y));
  return c.r - Math.hypot(_p.x, _p.y - y, _p.z);
}

function deepest(body, pts, exclude, radius) {
  let worst = null;
  for (const c of body.colliders) {
    if (exclude(c.part)) continue;
    for (const p of pts) {
      const d = depthIn(c, p) + radius;
      if (d > 0 && (!worst || d > worst.depth)) worst = { part: c.part, depth: d };
    }
  }
  return worst;
}

const holding = (part) => /^forearm/.test(part);
const PART_PL = { head: 'głowę', neck: 'szyję', chest: 'klatkę', belly: 'brzuch', pelvis: 'miednicę' };
const partName = (p) => PART_PL[p] ?? p;

// Nachodzenie dwóch kapsuł (odległość osi < suma promieni), próbkowanie odcinków
function capsuleOverlap(body, pa, pb) {
  const A = body.colliders.find((c) => c.part === pa), B = body.colliders.find((c) => c.part === pb);
  const seg = (c, t) => c.mesh.localToWorld(new THREE.Vector3(0, -c.half + 2 * c.half * t, 0));
  let best = Infinity;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) best = Math.min(best, seg(A, i / 10).distanceTo(seg(B, j / 10)));
  return A.r + B.r + 0.03 - best;   // + mięśnie wystające ponad skórę nóg (ok. 1,5 cm z każdej strony)
}

export function checkPose(body, pose, tol = 0.012) {
  const issues = [];
  body.root.updateWorldMatrix(true, true);
  const props = pose.props ?? {};
  const pt = (name) => body.points[name].getWorldPosition(new THREE.Vector3());

  // 1. drążek / sztanga: punkty co 2 cm wzdłuż pręta
  if (props.bar) {
    const front = props.bar.on === 'front';
    const L = pt(front ? 'rackL' : 'handL'), Rr = pt(front ? 'rackR' : 'handR');
    const mid = L.clone().add(Rr).multiplyScalar(0.5), u = L.clone().sub(Rr).normalize();
    const len = props.bar.len === 'fit' ? L.distanceTo(Rr) : props.bar.len ?? 1.6;
    const pts = [];
    for (let s = -len / 2; s <= len / 2; s += 0.02) pts.push(mid.clone().addScaledVector(u, s));
    // sztanga z przodu na barkach leży na mięśniach barków – dopuszczamy kontakt z ramionami
    const w = deepest(body, pts, (p) => holding(p) || (front && /^upperArm/.test(p)), 0.014);
    if (w && w.depth > tol) issues.push({ what: `drążek wchodzi w ${partName(w.part)}`, ...w });
    if (props.bar.plates !== false && mid.y < 0.2 - 0.01) issues.push({ what: 'talerze sztangi w podłodze', part: 'floor', depth: 0.2 - mid.y });
  }
  // hantel oburącz (goblet): górny talerz między dłońmi, rączka i dolny talerz pod nim – jak w body.js
  if (props.goblet) {
    const mid = pt('handL').add(pt('handR')).multiplyScalar(0.5);
    const pts = [];
    for (const [dy, r] of [[0.01, 0.062], [-0.045, 0.062], [-0.1, 0.016], [-0.16, 0.062], [-0.215, 0.062]]) {
      pts.push(mid.clone().add(_a.set(0, dy, 0)));
      for (let k = 0; k < 8; k++) pts.push(mid.clone().add(_a.set(Math.cos(k * Math.PI / 4) * (r - 0.01), dy, Math.sin(k * Math.PI / 4) * (r - 0.01))));
    }
    const w = deepest(body, pts, (p) => holding(p) || /^upperArm/.test(p), 0.01);
    if (w && w.depth > tol + 0.01) issues.push({ what: `hantel wchodzi w ${partName(w.part)}`, ...w });
  }
  // hantle: uchwyt i oba talerze
  for (const [i, d] of body.dumbbells.entries()) {
    if (!d.visible) continue;
    const pts = [-0.085, 0, 0.085].map((x) => d.localToWorld(new THREE.Vector3(x, 0, 0)));
    const side = i === 0 ? 'L' : 'R';
    const w = deepest(body, pts, (p) => p === 'forearm' + side, 0.03);
    if (w && w.depth > tol + 0.01) issues.push({ what: `hantel wchodzi w ${partName(w.part)}`, ...w });
    for (const p of pts) if (p.y < 0.05 - 0.01) { issues.push({ what: 'hantel w podłodze', part: 'floor', depth: 0.05 - p.y }); break; }
  }
  // 2. dłonie w tułowiu / głowie / udach
  for (const side of ['L', 'R']) {
    const w = deepest(body, [pt('hand' + side)], (p) => !['head', 'neck', 'chest', 'belly', 'pelvis', 'thighL', 'thighR'].includes(p), 0.02);
    if (w && w.depth > tol + 0.01) issues.push({ what: `dłoń wchodzi w ${partName(w.part)}`, ...w });
  }
  // 3. nogi nie mogą wchodzić jedna w drugą (uda, golenie)
  for (const [a, b, label] of [['thighL', 'thighR', 'uda'], ['shinL', 'shinR', 'golenie'], ['thighL', 'shinR', 'udo i goleń'], ['shinL', 'thighR', 'goleń i udo']]) {
    const d = capsuleOverlap(body, a, b);
    if (d > tol) issues.push({ what: `${label} nachodzą na siebie`, part: a, depth: d });
  }
  // 4. podłoga
  for (const name of ['toeL', 'toeR', 'heelL', 'heelR', 'handL', 'handR', 'kneeOutL', 'kneeOutR', 'headTop']) {
    const y = pt(name).y;
    if (y < -0.02) { issues.push({ what: `${name} pod podłogą`, part: 'floor', depth: -y }); break; }
  }
  return issues;
}
