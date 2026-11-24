import * as THREE from 'three';

// Geometria organiczna: bryły z przekrojów (loft) i mięśnie jako płaty przylegające do skóry.
//
// Loft: kolejne przekroje poprzeczne (superelipsy) na wysokościach y, interpolowane gładko (Catmull-Rom).
// Kąt θ wokół osi: 0° = na zewnątrz (+X dla lewej strony), 90° = przód (+Z), 180° = do środka, 270° = tył.
// Przekrój: w – pół-szerokość, d – pół-głębokość z przodu, db – z tyłu (domyślnie = d), x0/z0 – przesunięcie środka.

const DEG = Math.PI / 180;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export class Loft {
  // rings: [{ y, w, d, db?, x0?, z0? }] w dowolnej kolejności; exp – wykładnik superelipsy (2 = elipsa, >2 = bardziej „kanciasty”)
  constructor(rings, { exp = 2, seg = 36, steps = 48, caps = true } = {}) {   // caps: true | false | 'top' | 'bottom'
    this.caps = caps;
    this.r = rings.map((r) => ({ db: r.d, x0: 0, z0: 0, ...r })).sort((a, b) => a.y - b.y);
    this.exp = exp; this.seg = seg; this.steps = steps;
    this.y0 = this.r[0].y; this.y1 = this.r[this.r.length - 1].y;
  }
  params(y) {
    const R = this.r;
    y = Math.min(this.y1, Math.max(this.y0, y));
    let i = 0;
    while (i < R.length - 2 && y > R[i + 1].y) i++;
    const a = R[Math.max(0, i - 1)], b = R[i], c = R[i + 1], d = R[Math.min(R.length - 1, i + 2)];
    const t = (y - b.y) / (c.y - b.y || 1);
    const k = (key) => Math.max(0, catmull(a[key], b[key], c[key], d[key], t));
    const k2 = (key) => catmull(a[key], b[key], c[key], d[key], t);
    return { w: k('w'), d: k('d'), db: k('db'), x0: k2('x0'), z0: k2('z0') };
  }
  point(theta, y, out = new THREE.Vector3()) {
    const p = this.params(y);
    const c = Math.cos(theta), s = Math.sin(theta), e = 2 / this.exp;
    return out.set(p.x0 + p.w * Math.sign(c) * Math.abs(c) ** e, y, p.z0 + (s >= 0 ? p.d : p.db) * Math.sign(s) * Math.abs(s) ** e);
  }
  normal(theta, y, out = new THREE.Vector3()) {
    const h = 0.002;
    const a = this.point(theta + h, y), b = this.point(theta - h, y), c = this.point(theta, y + h), d = this.point(theta, y - h);
    const tu = a.sub(b), tv = c.sub(d);
    out.crossVectors(tv, tu).normalize();
    // zawsze na zewnątrz (od osi bryły)
    const p = this.point(theta, y), q = this.params(y);
    if (out.x * (p.x - q.x0) + out.z * (p.z - q.z0) < 0) out.negate();
    return out;
  }
  geometry(sx = 1) {
    const pos = [], idx = [], S = this.seg, N = this.steps, v = new THREE.Vector3();
    for (let j = 0; j <= N; j++) {
      const y = this.y0 + ((this.y1 - this.y0) * j) / N;
      for (let i = 0; i <= S; i++) {
        this.point((i / S) * Math.PI * 2, y, v);
        pos.push(v.x * sx, v.y, v.z);
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < S; i++) {
      const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    // zamknięte końce (bez „dziur” widocznych przy dużych kątach w stawach)
    if (!this.caps) return finish(pos, idx);
    const c0 = pos.length / 3, top = N * (S + 1);
    const p0 = this.params(this.y0), p1 = this.params(this.y1);
    pos.push(p0.x0 * sx, this.y0, p0.z0, p1.x0 * sx, this.y1, p1.z0);
    for (let i = 0; i < S; i++) {
      if (this.caps !== 'top') idx.push(c0, i, i + 1);
      if (this.caps !== 'bottom') idx.push(c0 + 1, top + i + 1, top + i);
    }
    return finish(pos, idx);
  }
}

// Bryła wzdłuż osi Z (stopa): przekroje { z, y (środek), w (pół-szerokość), h (pół-wysokość), hb? (dół) }
export function loftZ(rings, sx = 1, seg = 28, steps = 32) {
  const L = new Loft(rings.map((r) => ({ y: r.z, w: r.w, d: r.h, db: r.hb ?? r.h, z0: r.y })), { seg, steps });
  const g = L.geometry(sx);
  // zamiana osi: (x, y=z_stopy, z=wysokość) → (x, wysokość, z_stopy)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setXYZ(i, p.getX(i), z, y); }
  return orient(g);
}

function finish(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return orient(g);
}

// Ustawia kolejność wierzchołków tak, by normalne wskazywały na zewnątrz (względem środka bryły)
function orient(g) {
  g.computeVertexNormals();
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new THREE.Vector3());
  const p = g.attributes.position, n = g.attributes.normal;
  let score = 0;
  for (let i = 0; i < p.count; i += 7) score += (p.getX(i) - c.x) * n.getX(i) + (p.getZ(i) - c.z) * n.getZ(i) + (p.getY(i) - c.y) * n.getY(i) * 0.2;
  if (score < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

// Płat mięśnia na powierzchni loftu:
//   a: [θ0, θ1] (stopnie) albo { top: [θ0, θ1], bottom: [θ0, θ1] } – kształt zwężający się (wachlarz, trójkąt),
//   y: [yGórny, yDolny], T – grubość w najgrubszym miejscu, peak – gdzie wzdłuż y jest najgrubszy (0 = góra, 1 = dół),
//   round – zaokrąglenie krawędzi (wykładnik profilu poprzecznego).
export function musclePatch(loft, spec, sx = 1) {
  const { y, T = 0.015, peak = 0.5, round = 0.55 } = spec;
  const top = spec.a.top ?? spec.a, bot = spec.a.bottom ?? spec.a;
  const NU = 18, NV = 26, pos = [], fade = [], idx = [], p = new THREE.Vector3(), n = new THREE.Vector3();
  const spindle = spec.spindle ?? 0.6;   // zwężenie końców (0 = prostokąt, 1 = mocno wrzecionowaty)
  for (let j = 0; j <= NV; j++) {
    const t = j / NV;
    const yy = y[0] + (y[1] - y[0]) * t;
    let a0 = (top[0] + (bot[0] - top[0]) * t) * DEG, a1 = (top[1] + (bot[1] - top[1]) * t) * DEG;
    // wrzecionowaty zarys: szerokość maleje ku obu końcom (ścięgna)
    const wf = 1 - spindle * (1 - Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.96 + 0.02))), 0.6));
    const ac = (a0 + a1) / 2, ah = ((a1 - a0) / 2) * wf;
    a0 = ac - ah; a1 = ac + ah;
    // profil wzdłuż: brzusiec mięśnia z najgrubszym miejscem w "peak", końce przechodzą w ścięgno (prawie 0)
    const pv = t < peak ? Math.sin((Math.PI / 2) * (t / peak)) : Math.cos((Math.PI / 2) * ((t - peak) / (1 - peak)));
    for (let i = 0; i <= NU; i++) {
      const s = i / NU;
      const th = a0 + (a1 - a0) * s;
      const bump = Math.pow(Math.sin(Math.PI * s), round) * Math.pow(Math.max(pv, 0), 0.8);
      loft.point(th, yy, p);
      loft.normal(th, yy, n);
      p.addScaledVector(n, T * bump + 0.0012);
      pos.push(p.x * sx, p.y, p.z);
      // przezroczystość krawędzi: mięsień płynnie przechodzi w skórę
      fade.push(Math.min(1, Math.pow(Math.sin(Math.PI * s), 0.7) * Math.pow(Math.sin(Math.PI * t), 0.5) * 1.6));
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('fade', new THREE.Float32BufferAttribute(fade, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // płat ma tylko jedną stronę – odwracamy, jeśli normalne patrzą do środka (sprawdzamy w środku płata)
  const mid = Math.floor(NV / 2) * (NU + 1) + Math.floor(NU / 2);
  const P = g.attributes.position, N = g.attributes.normal;
  const thMid = ((top[0] + top[1] + bot[0] + bot[1]) / 4) * DEG, yMid = (y[0] + y[1]) / 2;
  loft.normal(thMid, yMid, n);
  if (N.getX(mid) * n.x * sx + N.getY(mid) * n.y + N.getZ(mid) * n.z < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
  }
  void P;
  return g;
}

// Materiał mięśnia z miękkimi krawędziami (atrybut "fade" → przezroczystość brzegów)
export function softEdges(mat) {
  if (mat.userData.soft) return mat;
  mat.userData.soft = true;
  mat.transparent = true;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float fade;\nvarying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = fade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= smoothstep(0.0, 0.5, vFade);');
  };
  mat.needsUpdate = true;
  return mat;
}
