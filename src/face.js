import * as THREE from 'three';
import { Loft } from './anatomy.js';
import { HEAD } from './bodyOrganic.js';

// Twarz ze zdjęcia na głowie modelu (tylko wygląd organiczny).
// Zdjęcie dopasowujemy punktami (prawe i lewe oko, środek ust, czubek nosa – tak jak widać je na zdjęciu):
// oczy dają przechył i skalę, nos – obrót głowy w bok, który „odkręcamy” (szczegóły: faceCanvas).
// Wynik to płat przylegający do przodu głowy (jak maska) z teksturą o miękkich, przezroczystych brzegach.
// Zdjęcie nigdzie nie jest wysyłane – przetwarzamy je lokalnie w przeglądarce.

// Położenie rysów na głowie modelu (układ szyi, metry) – jak w bodyOrganic.js
const EYE_L = [0.031, 0.172];   // oczy w ±0.031, usta ok. 0.118
// Obszar twarzy (płaszczyzna x–y patrząc z przodu) pokryty teksturą
const X0 = -0.085, X1 = 0.085, Y0 = 0.05, Y1 = 0.255;
const N = 512;   // rozdzielczość tekstury

const HEAD_LOFT = new Loft(HEAD, { seg: 40, steps: 40 });
// nos: wydłużona wypukłość wzdłuż osi twarzy (ta sama w geometrii płata i przy dopasowaniu zdjęcia)
const noseBump = (x, y) => 0.014 * Math.exp(-((x / 0.011) ** 2) - (((y - 0.15) / 0.022) ** 2));
// Głębokość (z) przedniej powierzchni głowy w punkcie (x, y) – przekrój głowy to elipsa
function surfaceZ(x, y) {
  const q = HEAD_LOFT.params(y), t = Math.min(0.999, Math.abs((x - q.x0) / q.w));
  return q.z0 + q.d * Math.sqrt(1 - t * t) + noseBump(x, y);
}

// Dopasowanie zdjęcia bez przekosu: oczy wyznaczają obrót (przechył głowy) i skalę – jednakową w poziomie i w pionie.
// Obrót głowy w bok (yaw) szacujemy z przesunięcia czubka nosa (albo ust) względem środka między oczami:
// u dorosłego czubek nosa jest ok. 3,5 cm, a usta ok. 2 cm przed linią oczu. Następnie „odkręcamy” twarz:
// punkt głowy modelu (x, y, z) widziany na zdjęciu obróconym o yaw ma współrzędną x·cos(yaw) + z·sin(yaw).
export function faceCanvas(img, marks, tone = 'photo') {
  const [R, L, M, Ns] = marks;
  const ex = [L[0] - R[0], L[1] - R[1]], dpx = Math.hypot(...ex);
  const ux = [ex[0] / dpx, ex[1] / dpx], uy = [-ux[1], ux[0]];          // wzdłuż oczu, w dół twarzy
  const mid = [(R[0] + L[0]) / 2, (R[1] + L[1]) / 2];
  const along = (P) => ((P[0] - mid[0]) * ux[0] + (P[1] - mid[1]) * ux[1]) / dpx;
  const tanYaw = Ns ? along(Ns) * 0.062 / 0.035 : along(M) * 0.062 / 0.02;
  const yaw = Math.max(-0.6, Math.min(0.6, Math.atan(tanYaw)));
  const k = dpx / (0.062 * Math.cos(yaw)), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ze = surfaceZ(EYE_L[0], EYE_L[1]) - noseBump(EYE_L[0], EYE_L[1]);

  // fragment zdjęcia wokół twarzy (żeby nie czytać pikseli całego zdjęcia)
  const r = Math.ceil(dpx * 2.4), bx = Math.round(mid[0] - r), by = Math.round(mid[1] - r);
  const sc = document.createElement('canvas'); sc.width = sc.height = 2 * r;
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, -bx, -by);
  const src = sctx.getImageData(0, 0, 2 * r, 2 * r).data, W = 2 * r;

  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(N, N), o = out.data;
  for (let j = 0; j < N; j++) {
    const y = Y1 - ((j + 0.5) / N) * (Y1 - Y0);
    for (let i = 0; i < N; i++) {
      const x = X0 + ((i + 0.5) / N) * (X1 - X0);
      const xr = x * cy + (surfaceZ(x, y) - ze) * sy, yr = EYE_L[1] - y;
      const px = mid[0] + k * (xr * ux[0] + yr * uy[0]) - bx, py = mid[1] + k * (xr * ux[1] + yr * uy[1]) - by;
      // próbkowanie dwuliniowe
      const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0, q = (j * N + i) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= W - 1) continue;
      for (let c = 0; c < 3; c++) {
        const i00 = (y0 * W + x0) * 4 + c;
        o[q + c] = (src[i00] * (1 - fx) + src[i00 + 4] * fx) * (1 - fy) + (src[i00 + W * 4] * (1 - fx) + src[i00 + W * 4 + 4] * fx) * fy;
      }
      o[q + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  if (tone === 'model') {
    const im = ctx.getImageData(0, 0, N, N), p = im.data;
    for (let i = 0; i < p.length; i += 4) {
      const l = (0.3 * p[i] + 0.55 * p[i + 1] + 0.15 * p[i + 2]) / 255;
      // jasność zdjęcia → odcień skóry modelu (0xc9ced6), lekko podbity kontrast
      const kk = Math.min(1.15, Math.max(0, 0.15 + l * 1.05));
      p[i] = 0xc9 * kk; p[i + 1] = 0xce * kk; p[i + 2] = 0xd6 * kk;
    }
    ctx.putImageData(im, 0, 0);
  }
  // owalna maska z miękkim brzegiem (twarz od linii włosów po brodę, bez uszu i tła)
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.save();
  const sx = N / (X1 - X0), syy = N / (Y1 - Y0);
  ctx.translate((0 - X0) * sx, (Y1 - 0.152) * syy); ctx.scale(0.066 * sx, 0.098 * syy);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  cv.yawDeg = (yaw * 180) / Math.PI;
  // gdzie na głowie modelu wypadają usta ze zdjęcia (odwrotność mapowania powyżej) – tam otwierają się przy wydechu
  const mAlong = ((M[0] - mid[0]) * ux[0] + (M[1] - mid[1]) * ux[1]) / k, mPerp = ((M[0] - mid[0]) * uy[0] + (M[1] - mid[1]) * uy[1]) / k;
  const my = EYE_L[1] - mPerp;
  let lo = -0.06, hi = 0.06;
  for (let it = 0; it < 30; it++) {
    const x = (lo + hi) / 2;
    if (x * cy + (surfaceZ(x, my) - ze) * sy < mAlong) lo = x; else hi = x;
  }
  const mx = (lo + hi) / 2;
  cv.mouth = [mx, my, surfaceZ(mx, my)];
  return cv;
}

// Płat na przodzie głowy: próbkujemy powierzchnię głowy (Loft HEAD) i odsuwamy minimalnie na zewnątrz;
// współrzędne tekstury z rzutu prostokątnego na płaszczyznę twarzy. Delikatny nos z wypukłości.
function faceGeometry() {
  const loft = HEAD_LOFT;
  const NU = 48, NV = 56, pos = [], uv = [], idx = [], p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let j = 0; j <= NV; j++) {
    const y = Y0 + ((Y1 - Y0) * j) / NV;
    for (let i = 0; i <= NU; i++) {
      const th = (12 + (156 * i) / NU) * Math.PI / 180;   // 12°…168° – przód głowy (90° = na wprost)
      loft.point(th, y, p); loft.normal(th, y, n);
      p.addScaledVector(n, 0.0012).z += noseBump(p.x, y);
      pos.push(p.x, p.y, p.z);
      uv.push((p.x - X0) / (X1 - X0), (y - Y0) / (Y1 - Y0));
    }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);   // na zewnątrz głowy
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let current = null;
// img: HTMLImageElement / ImageBitmap / canvas; marks: [[x,y] prawe oko, [x,y] lewe oko, [x,y] usta, ([x,y] czubek nosa)] w pikselach zdjęcia
export function applyFace(body, img, marks, tone = 'photo') {
  const cv = faceCanvas(img, marks, tone);
  return applyFaceTexture(body, cv, cv.mouth, tone);
}
// Gotowa tekstura twarzy (płótno z faceCanvas albo obrazek wczytany z pamięci przeglądarki) + położenie ust
export function applyFaceTexture(body, source, mouth, tone = 'model') {
  removeFace(body);
  if (!body.faceParts) return null;   // wygląd klasyczny – bez twarzy
  const tex = new THREE.Texture(source);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // emissiveMap: zdjęcie ma już własne światło i cienie – część jasności niezależna od oświetlenia sceny
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, transparent: true, roughness: 0.75, depthWrite: false, 
    polygonOffset: true, polygonOffsetFactor: -2 });
  current = new THREE.Mesh(faceGeometry(), mat);
  current.renderOrder = 2;
  body.joints.neck.add(current);
  for (const m of body.faceParts) m.visible = false;
  // usta: przy wydechu w miejscu ust ze zdjęcia pojawia się lekko otwarte, ciemne „o” (body.setMouth)
  body.setMouthOnFace?.(mouth, tone === 'model' ? 0x2a2f38 : 0x3a1c1f);
  return current;
}
export function removeFace(body) {
  if (current) { current.parent?.remove(current); current.geometry.dispose(); current.material.map.dispose(); current.material.dispose(); current = null; }
  for (const m of body.faceParts ?? []) m.visible = true;
  body.setMouthOnFace?.(null);
}
