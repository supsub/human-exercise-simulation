// Trening (zapis dnia): kopia szablonu z planu, potem żyje własnym życiem – w tym dniu można usuwać i dodawać
// ćwiczenia, zmieniać liczbę serii, ilość (powtórzenia / sekundy) i ciężar, odhaczać wykonane serie.
// Plan jest tylko podpowiedzią; zapis to to, co się naprawdę wydarzyło.
// Sesja: { id, date: 'RRRR-MM-DD', planId, workoutId, name, items: [{ exId, sets: [{ reps, kg, done }] }], finished, upd }
import { parseDate } from './analysis.js';
import { CATALOG_BY_ID, isTime, loadOf, defaultAmount, amountRange, fmtAmount } from './catalog.js';

const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const dateLabel = (iso) => { const d = parseDate(iso); return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };

const newId = () => Math.random().toString(36).slice(2, 10);
// ostatnio użyty ciężar ćwiczenia (najnowszy wcześniejszy trening z kg > 0)
export function lastKg(sessions, exId, beforeIso = '9999') {
  const prev = sessions.filter((s) => s.date < beforeIso || beforeIso === '9999').sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const s of prev) {
    const kg = s.items.find((it) => it.exId === exId)?.sets.map((x) => x.kg).filter((k) => k > 0).at(-1);
    if (kg) return kg;
  }
  return null;
}
export const newSet = (ex, sessions, iso, reps) => ({ reps: reps ?? defaultAmount(ex), kg: loadOf(ex) === 'kg' ? lastKg(sessions, ex.id, iso) : null, done: false });
export function sessionFromWorkout(w, plan, iso, sessions) {
  return {
    id: newId(), date: iso, planId: plan?.id ?? null, workoutId: w?.id ?? null, name: w?.name ?? 'Trening', finished: false, upd: Date.now(),
    items: (w?.items ?? []).filter((it) => CATALOG_BY_ID[it.exId]).map((it) => ({
      exId: it.exId, sets: Array.from({ length: it.sets }, () => newSet(CATALOG_BY_ID[it.exId], sessions, iso, it.reps)) })),
  };
}
export const sessionStats = (s) => { const all = s.items.flatMap((it) => it.sets); return { done: all.filter((x) => x.done).length, total: all.length }; };

// ctx: { s, badge(workoutId), onChange(), onClose(), onAdd(), onOpenExercise(ex), onDelete() }
export function renderSession(el, ctx) {
  const { s } = ctx, st = sessionStats(s);
  el.innerHTML = `
    <div class="ses-head"><button class="link ses-back">← Kalendarz</button><span class="muted">${esc(dateLabel(s.date))}</span></div>
    <div class="ses-title">${s.workoutId ? ctx.badge(s.workoutId) : ''} <b>${esc(s.name)}</b>
      <span class="ses-state ${s.finished ? 'done' : ''}">${s.finished ? '✓ zakończony' : 'w trakcie'} · ${st.done}/${st.total} serii</span></div>
    ${s.items.map((it, i) => {
      const ex = CATALOG_BY_ID[it.exId]; if (!ex) return '';
      const load = loadOf(ex), r = amountRange(ex), d = it.sets.filter((x) => x.done).length;
      return `<div class="ses-ex" data-i="${i}">
        <div class="ses-ex-head"><button class="link ses-open" title="Pokaż ćwiczenie">${esc(ex.name)}</button>
          <span class="muted">${d}/${it.sets.length}</span><button class="icon ses-del" title="Usuń z tego treningu">✕</button></div>
        ${it.sets.map((x, j) => `<div class="ses-set${x.done ? ' done' : ''}" data-j="${j}">
          <span class="ses-n">${j + 1}</span>
          <input class="ses-amt" type="number" inputmode="numeric" min="${r.min}" max="${r.max}" step="${r.step}" value="${x.reps ?? ''}" title="${isTime(ex) ? 'Sekundy' : 'Powtórzenia'}">
          <span class="ses-u">${isTime(ex) ? 's' : ex.repsLabel ?? 'powt.'}</span>
          ${load === 'none' ? '<span></span><span></span>' : `<input class="ses-kg" type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${x.kg ?? ''}" placeholder="${load === 'body' ? '+kg' : 'kg'}" title="${load === 'body' ? 'Dodatkowy ciężar (opcjonalnie)' : 'Ciężar'}"><span class="ses-u">kg</span>`}
          <button class="ses-done" title="${x.done ? 'Zrobione – kliknij, aby cofnąć' : 'Oznacz serię jako zrobioną'}" aria-pressed="${x.done}">✓</button>
        </div>`).join('')}
        <div class="ses-ex-foot"><button class="link small ses-addset">+ seria</button>${it.sets.length > 1 ? '<button class="link small ses-rmset">− seria</button>' : ''}
          <span class="muted small">${fmtAmount(ex, it.sets[0]?.reps ?? defaultAmount(ex))}${it.sets.some((x) => x.kg) ? ` · ${it.sets.filter((x) => x.kg).at(-1).kg} kg` : ''}</span></div>
      </div>`;
    }).join('') || '<div class="muted">Brak ćwiczeń – dodaj, co dziś robisz.</div>'}
    <button class="add-ex ses-add">+ Dodaj ćwiczenie</button>
    <div class="ses-foot"><button class="primary ses-finish">${s.finished ? 'Wznów trening' : 'Zakończ trening'}</button>
      <button class="link ses-remove">Usuń zapis</button></div>`;

  const change = () => { s.upd = Date.now(); ctx.onChange(); };
  el.querySelector('.ses-back').onclick = ctx.onClose;
  el.querySelector('.ses-add').onclick = ctx.onAdd;
  el.querySelector('.ses-finish').onclick = () => { s.finished = !s.finished; change(); };
  el.querySelector('.ses-remove').onclick = () => { if (confirm(`Usunąć zapis treningu z dnia ${dateLabel(s.date)}?`)) ctx.onDelete(); };
  el.querySelectorAll('.ses-ex').forEach((box) => {
    const it = s.items[+box.dataset.i], ex = CATALOG_BY_ID[it.exId];
    box.querySelector('.ses-open').onclick = () => ctx.onOpenExercise(ex);
    box.querySelector('.ses-del').onclick = () => { s.items.splice(+box.dataset.i, 1); change(); };
    box.querySelector('.ses-addset').onclick = () => { const last = it.sets.at(-1); it.sets.push({ reps: last?.reps ?? defaultAmount(ex), kg: last?.kg ?? null, done: false }); change(); };
    box.querySelector('.ses-rmset')?.addEventListener('click', () => { it.sets.pop(); change(); });
    box.querySelectorAll('.ses-set').forEach((row) => {
      const x = it.sets[+row.dataset.j], r = amountRange(ex);
      row.querySelector('.ses-amt').onchange = (e) => { const v = Math.round(+e.target.value); x.reps = v ? Math.min(r.max, Math.max(r.min, v)) : null; change(); };
      row.querySelector('.ses-kg')?.addEventListener('change', (e) => { const v = +e.target.value; x.kg = v > 0 ? Math.min(500, Math.round(v * 2) / 2) : null; change(); });
      row.querySelector('.ses-done').onclick = () => { x.done = !x.done; change(); };
    });
  });
}
