import * as THREE from 'three';

// Test podstawowej fizyki pozy (narzędzie deweloperskie, tools/sheet.html?check):
//  1. sprzęt (drążek/sztanga, hantle, hantel oburącz) nie wchodzi w ciało – poza trzymającymi go dłońmi/przedramionami,
//  2. dłonie nie wchodzą w tułów, głowę, miednicę ani uda,
//  3. nic nie przechodzi przez podłogę (stopy, kolana, dłonie, talerze sztangi),
//  5. ciało nie wchodzi w sprzęt, 6. stawy w anatomicznym zakresie, 7. plecy na oparciu (rest).
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

// Odległość ze znakiem od prostopadłościanu sprzętu (scenery: { box, size, rx }); < 0 = w środku
const _q = new THREE.Vector3(), _e = new THREE.Euler();
function boxDist(d, p) {
  _q.set(p.x - d.box[0], p.y - d.box[1], p.z - d.box[2]).applyEuler(_e.set(-(d.rx ?? 0), 0, 0));
  const dx = Math.abs(_q.x) - d.size[0] / 2, dy = Math.abs(_q.y) - d.size[1] / 2, dz = Math.abs(_q.z) - d.size[2] / 2;
  const out = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  return out > 0 ? out : Math.max(dx, dy, dz);
}

// 5. ciało i stopy nie wchodzą w sprzęt (ławka, siedzisko, podnóżek, oparcie)
//    Bryły kolizyjne skóry mogą się wcisnąć najwyżej o `soft` (miękkie tkanki, kontakt z siedziskiem),
//    podeszwa (pięta, śródstopie, palce) nie może wejść w sprzęt głębiej niż 1 cm.
export function checkScenery(body, scenery = [], pose = null, soft = 0.03) {
  const issues = [];
  const boxes = scenery.filter((d) => d.box);
  body.root.updateWorldMatrix(true, true);
  const worst = new Map();
  const hit = (what, part, depth) => { if (!worst.has(what) || worst.get(what).depth < depth) worst.set(what, { what, part, depth }); };
  for (const c of body.colliders) {
    const pts = [];
    if (c.kind === 'ell') {
      const s = c.mesh.scale;
      pts.push([c.mesh.localToWorld(new THREE.Vector3()), Math.min(s.x, s.y, s.z)]);
    } else for (let y = -c.half; y <= c.half + 1e-6; y += Math.max(0.03, c.half / 4)) pts.push([c.mesh.localToWorld(new THREE.Vector3(0, y, 0)), c.r]);
    for (const d of boxes) for (const [p, r] of pts) {
      const depth = r - boxDist(d, p);
      // siedzenie: pośladki uginają się na siedzisku bardziej niż reszta ciała
      if (depth > soft + (c.part === 'pelvis' ? 0.015 : 0)) hit(`${partName(c.part)} wchodzi w sprzęt`, c.part, depth);
    }
  }
  // walce sprzętu (drążek do podciągania, poręcze, wałki, słupki, uchwyty): punkty co 2 cm wzdłuż osi
  // nie mogą wchodzić w ciało; trzymające je przedramiona są wyłączone (dłoń obejmuje drążek)
  for (const d of scenery.filter((x) => x.cyl)) {
    const a = new THREE.Vector3(...d.cyl[0]), b = new THREE.Vector3(...d.cyl[1]);
    const n = Math.max(2, Math.ceil(a.distanceTo(b) / 0.02));
    const pts = Array.from({ length: n + 1 }, (_, k) => a.clone().lerp(b, k / n));
    // zapas na mięśnie wystające ponad bryły kolizyjne (wygląd organiczny): tułów 1,5 cm, kończyny 1 cm;
    // d.contact – element, który ma dociskać ciało (np. wałek na kostki) – dopuszczamy kontakt do 4 cm
    const w = deepest(body, pts, (p) => holding(p), (d.r ?? 0.02) + 0.01);
    const wt = deepest(body, pts, (p) => holding(p) || !['chest', 'belly', 'pelvis'].includes(p), (d.r ?? 0.02) + 0.015);
    for (const x of [w, wt]) if (x && x.depth > (d.contact ? 0.04 : 0.005)) hit(`${partName(x.part)} wchodzi w drążek/poręcz/wałek`, x.part, x.depth);
  }
  for (const S of ['L', 'R']) {
    const toe = body.points['toe' + S].getWorldPosition(new THREE.Vector3()), heel = body.points['heel' + S].getWorldPosition(new THREE.Vector3());
    const ankle = body.joints['ankle' + S].getWorldPosition(new THREE.Vector3());
    // podeszwa (pięta → palce) i wnętrze stopy (kostka → podeszwa) – stopa nie może przejść przez sprzęt na wylot
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const sole = heel.clone().lerp(toe, k / 6);
      pts.push(sole, ankle.clone().lerp(sole, 0.4), ankle.clone().lerp(sole, 0.75));
    }
    for (const p of pts) for (const d of boxes) {
      const depth = -boxDist(d, p);
      if (depth > 0.01) hit(`stopa ${S} wchodzi w sprzęt`, 'foot' + S, depth);
    }
  }
  // dłonie: nie wchodzą w sprzęt; zaciśnięta dłoń (pięść / chwyt) bez rekwizytu musi trzymać uchwyt ze sprzętu
  const props = pose?.props ?? {};
  const holdsProp = props.bar || props.dumbbells || props.goblet;
  const g = pose?.grip ?? 0;
  for (const S of ['L', 'R']) {
    const h = body.points['hand' + S].getWorldPosition(new THREE.Vector3());
    for (const d of boxes) { const depth = -boxDist(d, h); if (depth > 0.02) hit(`dłoń ${S} wchodzi w sprzęt`, 'hand' + S, depth); }
    if (!holdsProp && g >= 0.8 && h.y > 0.12) {
      let best = Infinity;
      for (const d of scenery.filter((x) => x.cyl)) {
        const a = new THREE.Vector3(...d.cyl[0]), b = new THREE.Vector3(...d.cyl[1]);
        const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, h.clone().sub(a).dot(ab) / ab.lengthSq()));
        best = Math.min(best, a.addScaledVector(ab, t).distanceTo(h) - (d.r ?? 0.02));
      }
      if (best > 0.03) hit(`dłoń ${S} zaciśnięta w powietrzu (nic nie trzyma)`, 'hand' + S, best === Infinity ? 1 : best);
    }
  }
  return [...worst.values()];
}

export function checkPose(body, pose, tol = 0.012) {
  const issues = [];
  body.root.updateWorldMatrix(true, true);
  const props = pose.props ?? {};
  const pt = (name) => body.points[name].getWorldPosition(new THREE.Vector3());

  // 0. poduszki maszyny (odwodzenie / przywodzenie): nie wchodzą w uda (z mięśniami ok. 2 cm ponad bryłą) ani w siebie
  if (props.pads && body.padShape?.length) {
    const thighs = body.colliders.filter((c) => /^thigh/.test(c.part));
    const seg = (p, t) => p.a.clone().lerp(p.b, t);
    for (const p of body.padShape) for (let t = 0; t <= 1; t += 0.25) for (const c of thighs) {
      const d = depthIn(c, seg(p, t)) + p.r + 0.02;
      if (d > tol) issues.push({ what: 'poduszka maszyny wchodzi w udo', part: c.part, depth: d });
    }
    const [P, Q] = body.padShape;
    if (P && Q) {
      let best = Infinity;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) best = Math.min(best, seg(P, i / 8).distanceTo(seg(Q, j / 8)));
      if (P.r + Q.r - best > tol) issues.push({ what: 'poduszki maszyny wchodzą w siebie', part: 'thighL', depth: P.r + Q.r - best });
    }
  }

  // 1. drążek / sztanga: punkty co 2 cm wzdłuż pręta
  if (props.bar) {
    const front = props.bar.on === 'front';
    const L = pt(front ? 'rackL' : 'handL'), Rr = pt(front ? 'rackR' : 'handR');
    const mid = L.clone().add(Rr).multiplyScalar(0.5), u = L.clone().sub(Rr).normalize();
    const len = props.bar.len === 'fit' ? L.distanceTo(Rr) : props.bar.len ?? 1.6;
    const pts = [];
    for (let s = -len / 2; s <= len / 2; s += 0.02) pts.push(mid.clone().addScaledVector(u, s));
    // sztanga z przodu na barkach leży na mięśniach barków – dopuszczamy kontakt z ramionami
    const w = deepest(body, pts, (p) => holding(p) || (front && /^upperArm/.test(p)), 0.014 + 0.01);   // + zapas na mięśnie
    if (w && w.depth > tol) issues.push({ what: `drążek wchodzi w ${partName(w.part)}`, ...w });
    const pr = typeof props.bar.plates === 'number' ? props.bar.plates : 0.2;
    if (props.bar.plates !== false && mid.y < pr - 0.01) issues.push({ what: 'talerze sztangi w podłodze', part: 'floor', depth: pr - mid.y });
  }
  // hantel oburącz (goblet): górny talerz między dłońmi, rączka i dolny talerz pod nim – jak w body.js
  if (props.goblet && body.gobletShape?.base) {
    const { base, r } = body.gobletShape;
    const pts = [];
    for (const [dy, rr] of [[0.065, r], [0.0, r], [-0.08, 0.016], [-0.15, r], [-0.215, r]]) {
      pts.push(base.clone().add(_a.set(0, dy, 0)));
      for (let k = 0; k < 8; k++) pts.push(base.clone().add(_a.set(Math.cos(k * Math.PI / 4) * (rr - 0.01), dy, Math.sin(k * Math.PI / 4) * (rr - 0.01))));
    }
    const w = deepest(body, pts, (p) => holding(p) || /^upperArm/.test(p), 0.01);
    if (w && w.depth > tol + 0.01) issues.push({ what: `hantel wchodzi w ${partName(w.part)}`, ...w });
  }
  // płyta suwnicy: pięta, śródstopie i palce obu stóp na powierzchni płyty (±1 cm), nic nie wchodzi w płytę
  if (props.plate && body.plateShape?.c) {
    const { c, n } = body.plateShape;
    for (const S of ['L', 'R']) for (const nm of ['toe', 'heel']) {
      const d = pt(nm + S).sub(c).dot(n) - 0.002;   // > 0: punkt za powierzchnią płyty
      if (Math.abs(d) > 0.01) issues.push({ what: d > 0 ? `stopa ${S} wchodzi w płytę suwnicy` : `stopa ${S} odstaje od płyty suwnicy`, part: 'foot' + S, depth: Math.abs(d) });
    }
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

// 6. zakresy ruchu w stawach (anatomiczne maksimum dorosłego, z małym zapasem) – kąty z pozy po IK.
//    Biodro: zgięcie ≤ 135° (dalej udo wchodzi w brzuch), wyprost ≤ 35°; kolano: 0…160° (−5° przeprost);
//    odcinek lędźwiowy: zgięcie ≤ 60°, wyprost ≤ 40°.
const DEGR = 180 / Math.PI;
export function checkRanges(pose) {
  const issues = [], j = pose.joints;
  const bad = (what, part, over) => issues.push({ what, part, depth: over, deg: true });   // depth = stopnie ponad zakres
  for (const S of ['L', 'R']) {
    const h = j['hip' + S];
    const flex = -(Array.isArray(h) ? h[0] : h ?? 0) * DEGR, knee = (j['knee' + S] ?? 0) * DEGR;
    if (flex > 135) bad(`biodro ${S} zgięte ponad zakres`, 'thigh' + S, flex - 135);
    if (flex < -35) bad(`biodro ${S} odgięte ponad zakres`, 'thigh' + S, -flex - 35);
    if (knee > 160) bad(`kolano ${S} zgięte ponad zakres`, 'shin' + S, knee - 160);
    if (knee < -5) bad(`kolano ${S} w przeproście`, 'shin' + S, -knee - 5);
  }
  const lum = (j.lumbar ?? 0) * DEGR;
  if (lum > 60) bad(`kręgosłup lędźwiowy zgięty ponad zakres`, 'belly', lum - 60);
  if (lum < -40) bad(`kręgosłup lędźwiowy odgięty ponad zakres`, 'belly', -lum - 40);
  return issues;
}

// 7. oparcie (scenery box z rest: ['chest', …]) – w poprawnej technice te części leżą na oparciu (≤ 3 cm od niego)
export function checkRest(body, scenery = []) {
  const issues = [];
  body.root.updateWorldMatrix(true, true);
  for (const d of scenery.filter((x) => x.box && x.rest)) for (const part of d.rest) {
    let best = Infinity;
    for (const c of body.colliders.filter((c) => c.part === part)) {
      if (c.kind === 'ell') { const s = c.mesh.scale; best = Math.min(best, boxDist(d, c.mesh.localToWorld(new THREE.Vector3())) - Math.min(s.x, s.y, s.z)); }
      else for (let y = -c.half; y <= c.half + 1e-6; y += c.half / 4) best = Math.min(best, boxDist(d, c.mesh.localToWorld(new THREE.Vector3(0, y, 0))) - c.r);
    }
    if (best > 0.03) issues.push({ what: `${partName(part)} odrywa się od oparcia`, part, depth: best });
  }
  return issues;
}

// ---------- Chwyt: w którą stronę patrzy wnętrze dłoni i kciuk (względem tułowia) ----------
// Kierunki: 'przód', 'tył', 'głowa', 'stopy', 'środek' (do osi ciała), 'zewn' (na zewnątrz).
const _m = new THREE.Matrix4(), _tx = new THREE.Vector3(), _ty = new THREE.Vector3(), _tz = new THREE.Vector3();
export function dirLabel(body, v, sx) {
  const chest = body.colliders.find((c) => c.part === 'chest').mesh;
  _m.extractRotation(chest.matrixWorld);
  _m.extractBasis(_tx, _ty, _tz);
  const c = { zewn: v.dot(_tx.normalize()) * sx, głowa: v.dot(_ty.normalize()), przód: v.dot(_tz.normalize()) };
  const [k, val] = Object.entries(c).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const opp = { zewn: 'środek', głowa: 'stopy', przód: 'tył' };
  return { label: val >= 0 ? k : opp[k], strength: Math.abs(val) };
}
export function handOrientation(body, S) {
  const sx = S === 'L' ? 1 : -1;
  const wr = body.joints['wrist' + S];
  body.root.updateWorldMatrix(true, true);
  const e = wr.matrixWorld.elements;
  const palm = new THREE.Vector3(e[8], e[9], e[10]).normalize();
  const thumb = new THREE.Vector3(e[0], e[1], e[2]).normalize().multiplyScalar(sx);
  return { palm: dirLabel(body, palm, sx), thumb: dirLabel(body, thumb, sx) };
}
