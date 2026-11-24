import { body, camera, controls, flyCamera } from './scene.js';
import { faceCanvas, applyFaceTexture, removeFace } from './face.js';

// „Twoja twarz”: wybierasz zdjęcie, dotykasz oczu, nosa i ust – twarz nakłada się na model.
// Zdjęcie nie opuszcza urządzenia: w pamięci przeglądarki zapisujemy tylko gotową teksturę twarzy (512 px).
const KEY = 'hes.face.v1';
const TONE = 'model';   // twarz w odcieniu skóry modelu
const STEPS = ['Dotknij oka po lewej stronie zdjęcia', 'Dotknij oka po prawej stronie zdjęcia', 'Dotknij czubka nosa', 'Dotknij środka ust'];
const $ = (id) => document.getElementById(id);
const ui = { open: $('face-open'), dialog: $('face-dialog'), close: $('face-close'), file: $('face-file'), undo: $('face-undo'),
  remove: $('face-remove'), step: $('face-step'), canvas: $('face-photo'), zoomIn: $('face-zoom-in'), zoomOut: $('face-zoom-out') };

let photo = null;      // zdjęcie pomniejszone do max 1600 px (płótno)
let pts = [];          // punkty w pikselach zdjęcia: oko lewe (na zdjęciu), oko prawe, nos, usta
let view = null;       // przybliżenie: { cx, cy, size } – kwadrat zdjęcia widoczny na płótnie (null = całe zdjęcie)
let savedCam = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s) return;
    const im = new Image();
    im.onload = () => applyFaceTexture(body, im, s.mouth, TONE);
    im.src = s.tex;
  } catch {}
}

function draw() {
  const c = ui.canvas, ctx = c.getContext('2d');
  if (!photo) { c.width = c.height = 0; return; }
  const box = c.parentElement.getBoundingClientRect();
  const v = view ?? { x0: 0, y0: 0, w: photo.width, h: photo.height };
  if (view) Object.assign(v, { x0: view.cx - view.size / 2, y0: view.cy - view.size / 2, w: view.size, h: view.size });
  const s = Math.min(box.width / v.w, (box.height || 400) / v.h);
  c.width = Math.round(v.w * s); c.height = Math.round(v.h * s);
  Object.assign(c.dataset, { scale: s, x0: v.x0, y0: v.y0 });
  ctx.fillStyle = '#0b1017'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(photo, v.x0, v.y0, v.w, v.h, 0, 0, c.width, c.height);
  pts.forEach(([x, y], i) => {
    ctx.beginPath(); ctx.arc((x - v.x0) * s, (y - v.y0) * s, 6, 0, Math.PI * 2);
    ctx.fillStyle = ['#4fb3ff', '#4fb3ff', '#f2c94c', '#eb3b3b'][i]; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  });
  ui.step.textContent = !view ? 'Dotknij twarzy na zdjęciu – przybliżymy ją.'
    : pts.length < 4 ? `${pts.length + 1}/4: ${STEPS[pts.length]}` : 'Gotowe – twarz jest na modelu. Źle trafiony punkt? „Cofnij”.';
  ui.undo.disabled = !view;
  ui.zoomIn.disabled = ui.zoomOut.disabled = !view;
}

function finish() {
  // kolejność dla faceCanvas: oko lewe na zdjęciu, oko prawe, usta, nos
  const cv = faceCanvas(photo, [pts[0], pts[1], pts[3], pts[2]], TONE);
  applyFaceTexture(body, cv, cv.mouth, TONE);
  let tex = cv.toDataURL('image/webp', 0.9);
  if (!tex.startsWith('data:image/webp')) tex = cv.toDataURL('image/png');
  try { localStorage.setItem(KEY, JSON.stringify({ tex, mouth: cv.mouth })); } catch { ui.step.textContent = 'Nie udało się zapisać twarzy w pamięci przeglądarki.'; }
}

ui.canvas.addEventListener('pointerdown', (e) => {
  if (!photo || pts.length >= 4) return;
  const r = ui.canvas.getBoundingClientRect(), d = ui.canvas.dataset, s = +d.scale;
  const p = [+d.x0 + (e.clientX - r.left) / s, +d.y0 + (e.clientY - r.top) / s];
  // pierwsze dotknięcie: przybliżenie wokół twarzy (kwadrat ~30% krótszego boku zdjęcia)
  if (!view) { view = { cx: p[0], cy: p[1], size: 0.3 * Math.min(photo.width, photo.height) }; draw(); return; }
  pts.push(p);
  if (pts.length === 4) finish();
  draw();
});
ui.undo.onclick = () => { if (pts.length) pts.pop(); else view = null; draw(); };
const zoom = (k) => { if (!view) return; view.size = Math.max(60, Math.min(Math.max(photo.width, photo.height), view.size * k)); draw(); };
ui.zoomIn.onclick = () => zoom(1 / 1.4);
ui.zoomOut.onclick = () => zoom(1.4);
ui.file.onchange = async () => {
  const f = ui.file.files[0];
  if (!f) return;
  const im = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
  if (!im) { ui.step.textContent = 'Nie udało się otworzyć zdjęcia.'; return; }
  const k = Math.min(1, 1600 / Math.max(im.width, im.height));
  photo = document.createElement('canvas');
  photo.width = Math.round(im.width * k); photo.height = Math.round(im.height * k);
  photo.getContext('2d').drawImage(im, 0, 0, photo.width, photo.height);
  pts = []; view = null;
  draw();
  ui.file.value = '';
};
ui.remove.onclick = () => { removeFace(body); localStorage.removeItem(KEY); photo = null; pts = []; view = null; draw(); ui.step.textContent = 'Twarz usunięta.'; };

// Okno: kamera podjeżdża do głowy, żeby od razu było widać efekt; po zamknięciu wraca
function headCamera() {
  const h = body.joints.neck.getWorldPosition(camera.position.clone());
  flyCamera([h.x + 0.2, h.y + 0.25, h.z + 1.0], [h.x, h.y + 0.15, h.z]);   // ~1 m – minimalna odległość kamery
}
ui.open.onclick = () => {
  if (!ui.dialog.hidden) { ui.close.onclick(); return; }
  savedCam = [camera.position.toArray(), controls.target.toArray()];
  controls.autoRotate = false;
  ui.dialog.hidden = false;
  headCamera();
  draw();
};
ui.close.onclick = () => {
  ui.dialog.hidden = true;
  if (savedCam) flyCamera(...savedCam);
};
if (!body.faceParts) ui.open.hidden = true;   // wygląd klasyczny – bez twarzy
load();
