// Kalendarz planu: miesiąc z treningami z harmonogramu (litera i kolor wariantu). Kliknięty dzień pokazuje
// swój trening pod kalendarzem, a model – jego mięśnie. Dane i akcje dostaje z planView (ctx), sam nic nie zapisuje.
import { DAYS, isoDate, parseDate, mondayOf, plannedOn } from './analysis.js';
import { CATALOG_BY_ID, fmtSets } from './catalog.js';

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let month = null;   // pierwszy dzień pokazywanego miesiąca
let day = null;     // wybrany dzień (RRRR-MM-DD)

export const calendarDay = () => day;
export function resetCalendar() { month = null; day = null; }

// ctx: { plan, schedule, workout(id), color(id), letter(id), onPick(iso, workoutId) }
export function renderCalendar(el, ctx) {
  const today = new Date(), todayIso = isoDate(today);
  day ??= todayIso;
  month ??= new Date(parseDate(day).getFullYear(), parseDate(day).getMonth(), 1);
  const first = mondayOf(month), last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells = [];
  for (let d = new Date(first); d <= last || cells.length % 7; d.setDate(d.getDate() + 1)) {
    const iso = isoDate(d), id = plannedOn(ctx.plan, ctx.schedule, d), w = id && ctx.workout(id);
    const cls = ['cal-d', d.getMonth() !== month.getMonth() && 'other', iso === todayIso && 'today', iso === day && 'picked', iso < todayIso && 'past'].filter(Boolean).join(' ');
    cells.push(`<button class="${cls}" data-iso="${iso}" title="${esc(w ? w.name : 'odpoczynek')}"><span class="n">${d.getDate()}</span>${w ? `<i class="wbadge" style="--c:${ctx.color(id)}">${ctx.letter(id)}</i>` : ''}</button>`);
  }
  const picked = parseDate(day), pid = plannedOn(ctx.plan, ctx.schedule, picked), pw = pid && ctx.workout(pid);
  const label = `${day === todayIso ? 'Dziś · ' : ''}${WEEKDAYS[(picked.getDay() + 6) % 7]}, ${picked.getDate()} ${MONTHS_GEN[picked.getMonth()]}`;
  el.innerHTML = `
    <div class="cal-head">
      <button class="icon cal-prev" title="Poprzedni miesiąc">‹</button>
      <b>${MONTHS[month.getMonth()]} ${month.getFullYear()}</b>
      <button class="icon cal-next" title="Następny miesiąc">›</button>
      ${day !== todayIso || month.getMonth() !== today.getMonth() ? '<button class="link small cal-today">dziś</button>' : ''}
    </div>
    <div class="cal-grid">${DAYS.map((d) => `<span class="cal-wd">${d.short}</span>`).join('')}${cells.join('')}</div>
    <div class="cal-detail">
      <div class="cal-date">${label}</div>
      ${pw ? `<div class="cal-w"><i class="wbadge" style="--c:${ctx.color(pid)}">${ctx.letter(pid)}</i> <b>${esc(pw.name)}</b>
        <span class="muted">${pw.items.length ? `${pw.items.length} ćw.` : 'pusty'}</span></div>
        <ul class="cal-items">${pw.items.map((it) => { const ex = CATALOG_BY_ID[it.exId]; return ex ? `<li>${esc(ex.name)} <span class="muted">${fmtSets(ex, it)}</span></li>` : ''; }).join('')}</ul>`
      : '<div class="muted">Dzień odpoczynku</div>'}
    </div>`;
  const go = (m) => { month = new Date(month.getFullYear(), month.getMonth() + m, 1); renderCalendar(el, ctx); };
  el.querySelector('.cal-prev').onclick = () => go(-1);
  el.querySelector('.cal-next').onclick = () => go(1);
  el.querySelector('.cal-today')?.addEventListener('click', () => { day = todayIso; month = null; pick(); });
  const pick = () => ctx.onPick(day, plannedOn(ctx.plan, ctx.schedule, parseDate(day)));
  el.querySelectorAll('.cal-d').forEach((b) => (b.onclick = () => {
    day = b.dataset.iso;
    if (b.classList.contains('other')) month = new Date(parseDate(day).getFullYear(), parseDate(day).getMonth(), 1);
    pick();
  }));
}
