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

export function emptyPlan(name = 'Nowy plan') {
  return { id: newId(), name, days: Object.fromEntries(DAYS.map((d) => [d.id, { active: false, items: [] }])) };
}

export function examplePlan() {
  const p = emptyPlan('Przykładowy plan – 3 dni');
  const set = (day, items) => { p.days[day] = { active: true, items: items.map(([exId, sets, reps]) => ({ exId, sets, reps })) }; };
  set('mon', [['bench', 4, 8], ['pushup', 3, 15], ['pushdown', 3, 12]]);
  set('wed', [['squat', 4, 12], ['leg_ext', 3, 12], ['crunch', 3, 15]]);
  set('fri', [['ohp', 3, 8], ['incline_db', 3, 10], ['curl', 3, 12]]);
  return p;
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

export function analyzePlan(plan) {
  const activeDays = DAYS.filter((d) => plan.days[d.id].active);
  const perDay = Object.fromEntries(DAYS.map((d) => [d.id, plan.days[d.id].active ? volumeOf(plan.days[d.id].items) : zero()]));
  const weekly = zero();
  for (const d of DAYS) for (const id in weekly) weekly[id] += perDay[d.id][id];

  const groups = MUSCLE_GROUPS.map((g) => {
    const sets = mean(GROUP_MEMBERS[g], weekly);
    return { group: g, sets, status: volumeStatus(sets), members: GROUP_MEMBERS[g] };
  });

  const trained = MUSCLES.filter((m) => weekly[m.id] >= 3).length;
  const optimal = MUSCLES.filter((m) => weekly[m.id] >= 8 && weekly[m.id] <= 20).length;

  // ---------- Ostrzeżenia ----------
  const warnings = [];
  const totalItems = activeDays.reduce((s, d) => s + plan.days[d.id].items.length, 0);
  if (!activeDays.length) warnings.push({ level: 'info', text: 'Zaznacz dni treningowe i dodaj do nich ćwiczenia.' });
  if (activeDays.length === 7) warnings.push({ level: 'warn', text: 'Brak dnia odpoczynku. Mięśnie rosną podczas regeneracji, zaplanuj przynajmniej 1–2 dni wolne.' });
  for (const d of activeDays) {
    const items = plan.days[d.id].items;
    if (!items.length) warnings.push({ level: 'info', text: `${d.name}: dzień treningowy bez ćwiczeń.` });
    const sets = items.reduce((s, it) => s + (it.sets || 0), 0);
    if (sets > 30) warnings.push({ level: 'warn', text: `${d.name}: ${sets} serii to bardzo długi trening. Rozważ rozłożenie objętości na więcej dni.` });
  }

  if (totalItems) {
    // Równowaga pchanie / przyciąganie
    const push = mean(['pec_stern', 'pec_clav', 'delt_ant', 'triceps_lat', 'triceps_long'], weekly);
    const pull = mean(['latissimus', 'trap_mid', 'delt_post', 'biceps', 'brachialis', 'trap_low'], weekly);
    if (push > 4 && push > 1.6 * pull) {
      warnings.push({ level: 'warn', text: `Przewaga ćwiczeń pchających nad przyciągającymi (${push.toFixed(0)} vs ${pull.toFixed(0)} serii średnio). Długofalowo sprzyja to wysuniętym barkom i problemom ze stawem barkowym. Dodaj wiosłowanie lub podciąganie.` });
    } else if (pull > 4 && pull > 2 * push) {
      warnings.push({ level: 'info', text: 'Przewaga ćwiczeń przyciągających. Rozważ więcej pracy na klatkę i triceps.' });
    }
    // Przód vs tył uda
    const quads = mean(['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'], weekly);
    const hams = mean(['biceps_femoris', 'semitendinosus'], weekly);
    if (quads > 4 && quads > 2 * hams) {
      warnings.push({ level: 'warn', text: `Tył uda jest dużo słabiej trenowany niż czworogłowy (${hams.toFixed(0)} vs ${quads.toFixed(0)} serii). Taka dysproporcja to czynnik ryzyka urazów kolana i naderwań mięśni kulszowo-goleniowych.` });
    }
    // Regeneracja: ta sama grupa mocno trenowana dzień po dniu
    const flagged = new Set();
    for (let i = 0; i < DAYS.length; i++) {
      const a = DAYS[i], b = DAYS[(i + 1) % DAYS.length];
      if (!plan.days[a.id].active || !plan.days[b.id].active) continue;
      for (const g of MUSCLE_GROUPS) {
        if (flagged.has(g)) continue;
        if (mean(GROUP_MEMBERS[g], perDay[a.id]) >= 4 && mean(GROUP_MEMBERS[g], perDay[b.id]) >= 4) {
          flagged.add(g);
          warnings.push({ level: 'warn', text: `${g}: mocny trening dzień po dniu (${a.short} → ${b.short}). Duże partie potrzebują ok. 48 h regeneracji.` });
        }
      }
    }
    const over = MUSCLES.filter((m) => weekly[m.id] > 25);
    if (over.length) warnings.push({ level: 'info', text: `Bardzo duża objętość: ${names(over.map((m) => m.id))}. Więcej nie zawsze znaczy lepiej.` });
    if (!warnings.some((w) => w.level === 'warn') && trained >= MUSCLES.length * 0.85) {
      warnings.push({ level: 'ok', text: 'Plan jest dobrze zbalansowany. Prawie wszystkie mięśnie dostają odpowiedni bodziec.' });
    }
  }

  return { weekly, perDay, groups, trained, optimal, warnings, recommendations: recommend(plan, weekly, perDay, activeDays) };
}

// Zachłanny dobór ćwiczeń: w każdym kroku wybieramy ćwiczenie, które najlepiej pokrywa niedotrenowane mięśnie.
function recommend(plan, weekly, perDay, activeDays) {
  const inPlan = new Set(DAYS.flatMap((d) => plan.days[d.id].items.map((it) => it.exId)));
  let deficient = new Set(MUSCLES.filter((m) => weekly[m.id] < 3).map((m) => m.id));
  const out = [];
  while (deficient.size && out.length < 4) {
    let best = null;
    for (const ex of CATALOG) {
      if (inPlan.has(ex.id) || out.some((r) => r.exId === ex.id)) continue;
      let score = 0;
      const fixes = [];
      for (const [id, w] of Object.entries(ex.muscles)) {
        if (deficient.has(id)) { score += w; if (w >= 0.5) fixes.push(id); }
        else if (weekly[id] > 20) score -= 0.3 * w; // nie dokładaj tam, gdzie już jest dużo
      }
      // preferuj ćwiczenia, które celują głównie w braki (a nie przy okazji)
      score += 0.2 * fixes.length;
      if (fixes.length && (!best || score > best.score)) best = { ex, score, fixes };
    }
    if (!best) break;
    for (const id of best.fixes) deficient.delete(id);
    out.push({ exId: best.ex.id, fixes: best.fixes, day: suggestDay(plan, perDay, activeDays, best.ex) });
  }
  return out;
}

// Dzień, w którym ćwiczenie najmniej koliduje z regeneracją tych samych mięśni dzień wcześniej i dzień później
function suggestDay(plan, perDay, activeDays, ex) {
  if (!activeDays.length) return null;
  let best = null;
  for (const d of activeDays) {
    const i = DAYS.indexOf(d);
    const prev = DAYS[(i + 6) % 7].id, next = DAYS[(i + 1) % 7].id;
    let cost = plan.days[d.id].items.reduce((s, it) => s + it.sets, 0) * 0.05;
    for (const [id, w] of Object.entries(ex.muscles)) {
      if (w < 0.5) continue;
      cost += w * (perDay[prev][id] + perDay[next][id]) * 0.5 + w * perDay[d.id][id] * 0.15;
    }
    if (!best || cost < best.cost) best = { id: d.id, cost };
  }
  return best.id;
}
