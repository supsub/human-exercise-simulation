import { MUSCLES, MUSCLE_BY_ID, MUSCLE_GROUPS } from '../muscles.js';
import { CATALOG, CATALOG_BY_ID } from './catalog.js';

// Analiza planu treningowego offline: objętość na mięsień, ostrzeżenia, rekomendacje.
// Objętość mierzymy w "efektywnych seriach tygodniowo" (serie × udział mięśnia w ćwiczeniu).
// Progi orientacyjne (dla hipertrofii u osób trenujących rekreacyjnie):
//   < 3 – za mało, 3–8 – minimum, 8–20 – optymalnie, > 20 – bardzo dużo.

export const DAYS = [
  { id: 'mon', short: 'Pn', name: 'Poniedziałek' },
  { id: 'tue', short: 'Wt', name: 'Wtorek' },
  { id: 'wed', short: 'Śr', name: 'Środa' },
  { id: 'thu', short: 'Cz', name: 'Czwartek' },
  { id: 'fri', short: 'Pt', name: 'Piątek' },
  { id: 'sat', short: 'So', name: 'Sobota' },
  { id: 'sun', short: 'Nd', name: 'Niedziela' },
];
export const DAY_BY_ID = Object.fromEntries(DAYS.map((d) => [d.id, d]));

export const OPTIMAL_WEEKLY = 20; // skala kolorów: 20 serii = pełna czerwień

export function volumeStatus(sets) {
  if (sets < 3) return { id: 'low', label: 'za mało' };
  if (sets < 8) return { id: 'min', label: 'minimum' };
  if (sets <= 20) return { id: 'ok', label: 'optymalnie' };
  return { id: 'high', label: 'bardzo dużo' };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- Dane: treningi (warianty) i plany ----------
// Trening (wariant) = nazwa + lista ćwiczeń (serie × powtórzenia), niezależna od dni tygodnia.
// Plan = które treningi biorą udział, ile treningów w tygodniu i (opcjonalnie) ręcznie wybrane dni.
export const LETTERS = 'ABCDEFGHIJKLMNOP';
export const WORKOUT_COLORS = ['#4fb3ff', '#f2994a', '#5fd38a', '#c58cff', '#f2c94c', '#ff6b8b', '#4dd6c9', '#a3b1c6'];

export function emptyWorkout(name = 'Nowy trening') {
  return { id: newId(), name, items: [] };
}
export function emptyPlan(name = 'Nowy plan', variants = []) {
  return { id: newId(), name, variants, sessions: 3, days: null };
}
const items = (list) => list.map(([exId, sets, reps]) => ({ exId, sets, reps }));
export function exampleData() {
  const A = { id: newId(), name: 'FBW A', items: items([['squat', 4, 8], ['bench', 4, 8], ['row', 3, 10], ['plank', 3, 30]]) };
  const B = { id: newId(), name: 'FBW B', items: items([['deadlift', 3, 5], ['ohp', 3, 8], ['pullup', 3, 8], ['lunge', 3, 10]]) };
  const C = { id: newId(), name: 'FBW C', items: items([['goblet_squat', 3, 10], ['incline_db', 3, 10], ['lat_pulldown', 3, 10], ['rdl', 3, 10], ['face_pull', 3, 15]]) };
  const plan = { ...emptyPlan('FBW – 3 warianty', [A.id, B.id, C.id]), sessions: 4 };
  return { workouts: [A, B, C], plans: [plan] };
}
// Stary format (ćwiczenia przypisane do dni tygodnia) → treningi + plan z tymi samymi dniami
export function migrateV1(old) {
  const workouts = [], plans = [];
  for (const p of old.plans ?? []) {
    const ids = [], days = [];
    for (const d of DAYS) {
      const day = p.days?.[d.id];
      if (!day?.active) continue;
      const w = { id: newId(), name: `${p.name} – ${d.short}`, items: day.items ?? [] };
      workouts.push(w); ids.push(w.id); days.push(d.id);
    }
    plans.push({ id: p.id, name: p.name, variants: ids, sessions: Math.max(1, days.length), days: days.length ? days : null });
  }
  return { workouts, plans };
}

const zero = () => Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));

export function volumeOf(items) {
  const v = zero();
  for (const it of items) {
    const ex = CATALOG_BY_ID[it.exId];
    if (!ex) continue;
    for (const [id, w] of Object.entries(ex.muscles)) v[id] += (it.sets || 0) * w;
  }
  return v;
}

const mean = (ids, v) => ids.reduce((s, id) => s + v[id], 0) / ids.length;
const GROUP_MEMBERS = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, MUSCLES.filter((m) => m.group === g).map((m) => m.id)]));
const names = (ids) => ids.map((id) => MUSCLE_BY_ID[id].name).join(', ');

// ---------- Harmonogram ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function combos(n, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push([...acc]); return out; }
  for (let i = start; i < n; i++) { acc.push(i); combos(n, k, i + 1, acc, out); acc.pop(); }
  return out;
}
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}
// pokrycie mięśniowe dwóch treningów (im większe, tym gorzej robić je dzień po dniu)
function overlap(a, b) {
  let s = 0;
  for (const id in a) s += Math.min(a[id], b[id]);
  return s;
}

// Układa cykl: każdy wariant tyle samo razy; dni i kolejność dobrane tak, by treningi dzień po dniu
// jak najmniej się pokrywały, a przerwy były możliwie równe. Wynik: calendar[tydzień][dzień] = id treningu | null.
const scheduleCache = new Map();
export function buildSchedule(plan, workouts) {
  const vars = plan.variants.map((id) => workouts.find((w) => w.id === id)).filter(Boolean);
  const manual = plan.days?.length ? DAYS.map((d, i) => (plan.days.includes(d.id) ? i : -1)).filter((i) => i >= 0) : null;
  const n = manual ? manual.length : Math.min(7, Math.max(1, plan.sessions | 0));
  const k = vars.length;
  if (!k) return { weeks: 1, dayIdx: [], calendar: [Array(7).fill(null)], perVariant: 0, n, auto: !manual };
  const vols = Object.fromEntries(vars.map((w) => [w.id, volumeOf(w.items)]));
  const key = JSON.stringify([n, manual, vars.map((w) => [w.id, w.items])]);
  if (scheduleCache.has(key)) return scheduleCache.get(key);

  const W = k / gcd(n, k);
  const dayOptions = manual ? [manual] : combos(7, n);
  const orders = k <= 5 ? permutations(vars.map((w) => w.id)) : [vars.map((w) => w.id)];
  let best = null;
  for (const dayIdx of dayOptions) {
    // równomierność przerw (po kole tygodnia)
    let spread = 0;
    for (let j = 0; j < n; j++) {
      const gap = (dayIdx[(j + 1) % n] - dayIdx[j] + 7) % 7 || 7;
      spread += (gap - 7 / n) ** 2;
    }
    for (const order of orders) {
      const flat = Array(W * 7).fill(null);
      for (let s = 0; s < n * W; s++) flat[Math.floor(s / n) * 7 + dayIdx[s % n]] = order[s % k];
      let cost = spread * 1.5;
      for (let i = 0; i < flat.length; i++) {
        const a = flat[i], b = flat[(i + 1) % flat.length];
        if (a && b) cost += 3 + overlap(vols[a], vols[b]);
      }
      if (!best || cost < best.cost - 1e-9) best = { cost, dayIdx, flat };
    }
  }
  const calendar = Array.from({ length: W }, (_, w) => best.flat.slice(w * 7, w * 7 + 7));
  const out = { weeks: W, dayIdx: best.dayIdx, calendar, perVariant: (n * W) / k, n, auto: !manual };
  if (scheduleCache.size > 200) scheduleCache.clear();
  scheduleCache.set(key, out);
  return out;
}

// ---------- Analiza ----------
export function analyzePlan(plan, workouts) {
  const inPlan = plan.variants.map((id) => workouts.find((w) => w.id === id)).filter(Boolean);
  const schedule = buildSchedule(plan, workouts);
  const perWorkout = Object.fromEntries(workouts.map((w) => [w.id, volumeOf(w.items)]));
  // tygodniowa objętość = średnia z tygodni cyklu
  const weekly = zero();
  for (const week of schedule.calendar) for (const id of week) if (id) for (const m in weekly) weekly[m] += perWorkout[id][m] / schedule.weeks;

  const groups = MUSCLE_GROUPS.map((g) => {
    const sets = mean(GROUP_MEMBERS[g], weekly);
    return { group: g, sets, status: volumeStatus(sets), members: GROUP_MEMBERS[g] };
  });
  const trained = MUSCLES.filter((m) => weekly[m.id] >= 3).length;
  const optimal = MUSCLES.filter((m) => weekly[m.id] >= 8 && weekly[m.id] <= 20).length;

  const warnings = [];
  if (!inPlan.length) warnings.push({ level: 'info', text: 'Zaznacz treningi, które mają wejść do planu (lub utwórz nowy trening).' });
  if (schedule.n === 7) warnings.push({ level: 'warn', text: 'Brak dnia odpoczynku. Mięśnie rosną podczas regeneracji, zaplanuj przynajmniej 1–2 dni wolne.' });
  for (const w of inPlan) {
    if (!w.items.length) warnings.push({ level: 'info', text: `${w.name}: trening bez ćwiczeń.` });
    const sets = w.items.reduce((s, it) => s + (it.sets || 0), 0);
    if (sets > 30) warnings.push({ level: 'warn', text: `${w.name}: ${sets} serii to bardzo długi trening. Rozważ podział na więcej wariantów.` });
  }
  if (inPlan.length > schedule.n) warnings.push({ level: 'info', text: `Wariantów (${inPlan.length}) jest więcej niż treningów w tygodniu (${schedule.n}) – każdy wariant wypadnie rzadziej niż raz w tygodniu.` });

  if (inPlan.some((w) => w.items.length)) {
    const push = mean(['pec_stern', 'pec_clav', 'delt_ant', 'triceps_lat', 'triceps_long'], weekly);
    const pull = mean(['latissimus', 'trap_mid', 'delt_post', 'biceps', 'brachialis', 'trap_low'], weekly);
    if (push > 4 && push > 1.6 * pull) {
      warnings.push({ level: 'warn', text: `Przewaga ćwiczeń pchających nad przyciągającymi (${push.toFixed(0)} vs ${pull.toFixed(0)} serii średnio). Długofalowo sprzyja to wysuniętym barkom i problemom ze stawem barkowym. Dodaj wiosłowanie lub podciąganie.` });
    } else if (pull > 4 && pull > 2 * push) {
      warnings.push({ level: 'info', text: 'Przewaga ćwiczeń przyciągających. Rozważ więcej pracy na klatkę i triceps.' });
    }
    const quads = mean(['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'], weekly);
    const hams = mean(['biceps_femoris', 'semitendinosus'], weekly);
    if (quads > 4 && quads > 2 * hams) {
      warnings.push({ level: 'warn', text: `Tył uda jest dużo słabiej trenowany niż czworogłowy (${hams.toFixed(0)} vs ${quads.toFixed(0)} serii). Taka dysproporcja to czynnik ryzyka urazów kolana i naderwań mięśni kulszowo-goleniowych.` });
    }
    // regeneracja: ta sama partia mocno trenowana dzień po dniu (w którymkolwiek tygodniu cyklu)
    const flat = schedule.calendar.flat();
    const flagged = new Set();
    for (let i = 0; i < flat.length; i++) {
      const a = flat[i], b = flat[(i + 1) % flat.length];
      if (!a || !b) continue;
      for (const g of MUSCLE_GROUPS) {
        if (flagged.has(g)) continue;
        if (mean(GROUP_MEMBERS[g], perWorkout[a]) >= 4 && mean(GROUP_MEMBERS[g], perWorkout[b]) >= 4) {
          flagged.add(g);
          const d1 = DAYS[i % 7], d2 = DAYS[(i + 1) % 7];
          warnings.push({ level: 'warn', text: `${g}: mocny trening dzień po dniu (${d1.short} → ${d2.short}). Duże partie potrzebują ok. 48 h regeneracji – rozważ inne rozłożenie dni lub lżejszy wariant.` });
        }
      }
    }
    const over = MUSCLES.filter((m) => weekly[m.id] > 25);
    if (over.length) warnings.push({ level: 'info', text: `Bardzo duża objętość: ${names(over.map((m) => m.id))}. Więcej nie zawsze znaczy lepiej.` });
    if (!warnings.some((w) => w.level === 'warn') && trained >= MUSCLES.length * 0.85) {
      warnings.push({ level: 'ok', text: 'Plan jest dobrze zbalansowany. Prawie wszystkie mięśnie dostają odpowiedni bodziec.' });
    }
  }
  return { weekly, perWorkout, schedule, groups, trained, optimal, warnings, recommendations: recommend(inPlan, weekly, perWorkout) };
}

// Zachłanny dobór ćwiczeń pokrywających braki + trening (wariant), do którego najlepiej pasują
function recommend(inPlan, weekly, perWorkout) {
  if (!inPlan.length) return [];
  const used = new Set(inPlan.flatMap((w) => w.items.map((it) => it.exId)));
  const deficient = new Set(MUSCLES.filter((m) => weekly[m.id] < 3).map((m) => m.id));
  const out = [];
  while (deficient.size && out.length < 4) {
    let best = null;
    for (const ex of CATALOG) {
      if (used.has(ex.id) || out.some((r) => r.exId === ex.id)) continue;
      let score = 0;
      const fixes = [];
      for (const [id, w] of Object.entries(ex.muscles)) {
        if (deficient.has(id)) { score += w; if (w >= 0.5) fixes.push(id); }
        else if (weekly[id] > 20) score -= 0.3 * w;
      }
      score += 0.2 * fixes.length;
      if (fixes.length && (!best || score > best.score)) best = { ex, score, fixes };
    }
    if (!best) break;
    for (const id of best.fixes) deficient.delete(id);
    // wariant: najmniej obciążony tymi samymi mięśniami i najkrótszy
    let target = null;
    for (const w of inPlan) {
      let cost = w.items.reduce((s, it) => s + it.sets, 0) * 0.05;
      for (const [id, wt] of Object.entries(best.ex.muscles)) if (wt >= 0.5) cost += wt * perWorkout[w.id][id] * 0.3;
      if (!target || cost < target.cost) target = { id: w.id, cost };
    }
    out.push({ exId: best.ex.id, fixes: best.fixes, workout: target.id });
  }
  return out;
}
