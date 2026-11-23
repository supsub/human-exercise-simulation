// Kinematyka w płaszczyźnie strzałkowej (z = przód, y = góra).
// Wszystkie stawy obracają się wokół osi X, więc kąty po prostu się sumują:
// kąt lokalny = kąt globalny segmentu − kąt globalny rodzica.

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);

// Obrót punktu (z, y) wokół osi X o kąt a (tak samo jak THREE.Object3D.rotation.x).
export function rotX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { z: p.y * s + p.z * c, y: p.y * c - p.z * s };
}

export const add = (p, q) => ({ z: p.z + q.z, y: p.y + q.y });
export const neg = (p) => ({ z: -p.z, y: -p.y });

// Kąt globalny segmentu, który w pozycji spoczynkowej wskazuje w dół (−Y),
// tak aby wskazywał od punktu `from` do `to`.
export function downAngle(from, to) {
  return Math.atan2(-(to.z - from.z), -(to.y - from.y));
}

// IK dwóch segmentów (ramię–przedramię, udo–goleń).
// Zwraca położenie stawu środkowego (łokieć / kolano).
// bend: +1 → staw wysunięty w stronę +Z, −1 → w stronę −Z.
export function twoBoneIK(root, target, a, b, bend) {
  const dz = target.z - root.z, dy = target.y - root.y;
  const dist = Math.hypot(dz, dy) || 1e-6;
  const d = clamp(dist, Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const uz = dz / dist, uy = dy / dist;
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const c = Math.cos(A), s = Math.sin(A);
  const j1 = { z: root.z + a * (uz * c - uy * s), y: root.y + a * (uz * s + uy * c) };
  const j2 = { z: root.z + a * (uz * c + uy * s), y: root.y + a * (-uz * s + uy * c) };
  if (bend > 0) return j1.z > j2.z ? j1 : j2;
  return j1.z < j2.z ? j1 : j2;
}

// Bisekcja dla funkcji rosnącej: znajdź x z [lo, hi] takie, że f(x) = target.
export function bisect(f, lo, hi, target, iterations = 60) {
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Liniowe mieszanie dwóch póz (płynne przejścia między ćwiczeniami).
export function blendPose(a, b, t) {
  const joints = {};
  const keys = new Set([...Object.keys(a.joints), ...Object.keys(b.joints)]);
  for (const k of keys) joints[k] = lerp(a.joints[k] ?? 0, b.joints[k] ?? 0, t);
  return {
    root: { y: lerp(a.root.y, b.root.y, t), z: lerp(a.root.z, b.root.z, t), rx: lerp(a.root.rx, b.root.rx, t) },
    joints,
    props: t < 0.5 ? a.props : b.props,
  };
}
