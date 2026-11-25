import * as THREE from 'three';
import { createBody } from './body.js';
import { onSex } from './sex.js';
import { MUSCLES } from './muscles.js';
import { standingPose } from './exercises/common.js';
import { activationColor, pickMuscleAt } from './scene.js';

// Statyczna figura (przód + tył) w panelu: pokazuje, które mięśnie pracują w ćwiczeniu,
// bez animacji i bez skaczących liczb. Osobny mały renderer z kamerą ortograficzną.

export function createFigure(canvasEl) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x202633, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.5, 2, 4);
  scene.add(key);

  // Dwa manekiny: z przodu (lewy) i od tyłu (prawy), lekko odwiedzione ręce, żeby było widać boki tułowia
  const SPACING = 0.47;
  const bodies = [-1, 1].map((side) => {
    const b = createBody();
    b.setPose(standingPose());
    b.setBreath(0.3);
    b.joints.shoulderL.rotation.z = 0.28;
    b.joints.shoulderR.rotation.z = -0.28;
    b.joints.hipL.rotation.z = 0.05;
    b.joints.hipR.rotation.z = -0.05;
    const holder = new THREE.Group();
    holder.position.x = side * SPACING;
    if (side > 0) holder.rotation.y = Math.PI;
    holder.add(b.root);
    scene.add(holder);
    return b;
  });
  const meshes = () => bodies.flatMap((b) => b.muscleMeshes);
  onSex((s) => { for (const b of bodies) b.setSex(s); dirty = true; });

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(0, 0.9, 5);
  camera.lookAt(0, 0.9, 0);

  function resize() {
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    // dopasuj obie sylwetki (szer. ~1.75 m, wys. ~1.85 m) do płótna
    const halfH = Math.max(0.95, (0.9 * h) / w) * 1.0;
    const halfW = (halfH * w) / h;
    Object.assign(camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(canvasEl);

  let dirty = true;
  let values = {};
  let highlight = null;

  function paint() {
    for (const b of bodies) {
      for (const m of MUSCLES) {
        const a = values[m.id] ?? 0;
        const mat = b.materials[m.id];
        activationColor(a, mat.color);
        mat.emissive.copy(mat.color).multiplyScalar(a * 0.35);
        if (highlight === m.id) mat.emissive.setRGB(0.55, 0.55, 0.6);
      }
    }
  }

  let pointer = null;
  canvasEl.addEventListener('pointermove', (e) => (pointer = e));
  canvasEl.addEventListener('pointerleave', () => (pointer = null));

  return {
    // values: { muscleId: 0..1 } – stała mapa (np. szczytowa aktywacja w ćwiczeniu)
    set(v, hl = null) {
      let changed = hl !== highlight;
      for (const m of MUSCLES) if (Math.abs((v[m.id] ?? 0) - (values[m.id] ?? 0)) > 0.002) changed = true;
      if (!changed) return;
      values = { ...v };
      highlight = hl;
      dirty = true;
    },
    pick() {
      return pointer ? pickMuscleAt(pointer.clientX, pointer.clientY, canvasEl, camera, meshes()) : null;
    },
    render() {
      if (!dirty || canvasEl.offsetParent === null) return;
      dirty = false;
      paint();
      renderer.render(scene, camera);
    },
  };
}
