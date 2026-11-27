// Kalendarz: osobny od edytora planów. Pokazuje treningi zaplanowane z planu realizowanego w danym okresie
// („Plan X od 1 stycznia”, potem „Plan Y od 1 lipca”) i wykonane treningi (historia – zostają po zmianie planu).
// Kliknięty dzień pokazuje swój trening, a model – jego mięśnie. Dane i akcje dostaje z planView (ctx).
import { DAYS, isoDate, parseDate, mondayOf } from './analysis.js';
import { CATALOG_BY_ID, fmtSets } from './catalog.js';
import { sessionStats } from './sessionView.js';

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let month = null;   // pierwszy dzień pokazywanego miesiąca
let day = null;     // wybrany dzień (RRRR-MM-DD)

export const calendarDay = () => day;
export function resetCalendar() { month = null; day = null; }

// ctx: { plannedFor(date) → id treningu | null, activeOn(iso) → { plan, from, to } | null, periods: [{ plan, from, to }], plans: [plan],
//        workout(id), color(id), letter(id), sessionOn(iso), onPick(iso, workoutId), onStart(iso, workoutId), onOpen(sessionId), onSetActive(planId, fromIso) }
let editing = false;   // otwarty formularz „zmień plan od…”
export function renderCalendar(el, ctx) {
  const today = new Date(), todayIso = isoDate(today);
  day ??= todayIso;
  month ??= new Date(parseDate(day).getFullYear(), parseDate(day).getMonth(), 1);
  const first = mondayOf(month), last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells = [];
  for (let d = new Date(first); d <= last || cells.length % 7; d.setDate(d.getDate() + 1)) {
    const iso = isoDate(d), ses = ctx.sessionOn(iso);
    const id = ses ? ses.workoutId : ctx.plannedFor(d), w = id && ctx.workout(id);
    const cls = ['cal-d', d.getMonth() !== month.getMonth() && 'other', iso === todayIso && 'today', iso === day && 'picked', iso < todayIso && 'past',
      ses && (ses.finished ? 'done' : 'live')].filter(Boolean).join(' ');
    const mark = ses ? (ses.finished ? '<i class="cal-mark">✓</i>' : '<i class="cal-mark live">●</i>') : '';
    cells.push(`<button class="${cls}" data-iso="${iso}" title="${esc(ses ? `${ses.name} – ${ses.finished ? 'wykonany' : 'w trakcie'}` : w ? w.name : 'odpoczynek')}"><span class="n">${d.getDate()}</span>${w ? `<i class="wbadge" style="--c:${ctx.color(id)}">${ctx.letter(id)}</i>` : ses ? '<i class="wbadge" style="--c:#8d98aa">•</i>' : ''}${mark}</button>`);
  }
  const picked = parseDate(day), pid = ctx.plannedFor(picked), pw = pid && ctx.workout(pid), act = ctx.activeOn(day);
  const label = `${day === todayIso ? 'Dziś · ' : ''}${WEEKDAYS[(picked.getDay() + 6) % 7]}, ${picked.getDate()} ${MONTHS_GEN[picked.getMonth()]}`;
  const ses = ctx.sessionOn(day), canLog = day <= todayIso;
  const others = (act?.plan.variants ?? []).map((id) => ctx.workout(id)).filter((w) => w && w.id !== pid);
  const actions = ses
    ? (() => { const st = sessionStats(ses); return `<div class="cal-ses ${ses.finished ? 'done' : ''}">${ses.finished ? '✓ Wykonany' : '● W trakcie'}: <b>${esc(ses.name)}</b> · ${st.done}/${st.total} serii</div>
        <button class="primary cal-open">${ses.finished ? 'Pokaż trening' : 'Wróć do treningu'}</button>`; })()
    : !canLog ? ''
    : `${pw ? `<button class="primary cal-start" data-w="${pid}">▶ ${day === todayIso ? 'Zacznij trening' : 'Zapisz wykonany trening'}</button>` : ''}
       ${others.length ? `<div class="cal-other">${pw ? 'albo inny:' : `${day === todayIso ? 'Zacznij' : 'Zapisz'} trening:`} ${others.map((w) => `<button class="chip cal-start" data-w="${w.id}"><i class="wbadge" style="--c:${ctx.color(w.id)}">${ctx.letter(w.id)}</i> ${esc(w.name)}</button>`).join(' ')}</div>` : ''}`;  const short = (iso) => { const d = parseDate(iso); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`; };
  const now = ctx.activeOn(todayIso), past = ctx.periods.filter((x) => x.from !== now?.from && x.from <= todayIso).reverse(), next = ctx.periods.filter((x) => x.from > todayIso);
  const defFrom = day >= todayIso ? day : todayIso;
  const planBox = editing || !ctx.periods.length
    ? `<div class="cal-plan edit"><span>${ctx.periods.length ? 'Realizuj plan' : 'Który plan realizujesz?'}</span>
        <select class="cal-plan-sel">${ctx.plans.map((p) => `<option value="${p.id}" ${p.id === (now?.plan.id ?? ctx.plans[0]?.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <span>od</span><input class="cal-plan-from" type="date" value="${ctx.periods.length ? defFrom : isoDate(mondayOf(today))}">
        <button class="primary small cal-plan-set">Ustaw</button>${ctx.periods.length ? '<button class="link small cal-plan-cancel">anuluj</button>' : ''}</div>`
    : `<div class="cal-plan"><span class="muted">Realizowany plan:</span> <b>${now ? esc(now.plan.name) : '—'}</b>${now ? ` <span class="muted">od ${short(now.from)}</span>` : ''}
        <button class="link small cal-plan-edit">zmień</button>
        ${next.length ? `<div class="muted small">Potem: ${next.map((x) => `${esc(x.plan.name)} od ${short(x.from)}`).join(', ')}</div>` : ''}
        ${past.length ? `<div class="muted small">Wcześniej: ${past.map((x) => `${esc(x.plan.name)} (${short(x.from)} – ${x.to ? short(x.to) : '…'})`).join(', ')}</div>` : ''}</div>`;
  el.innerHTML = `
    ${planBox}
    <div class="cal-head">
      <button class="icon cal-prev" title="Poprzedni miesiąc">‹</button>
      <b>${MONTHS[month.getMonth()]} ${month.getFullYear()}</b>
      <button class="icon cal-next" title="Następny miesiąc">›</button>
      ${day !== todayIso || month.getMonth() !== today.getMonth() ? '<button class="link small cal-today">dziś</button>' : ''}
    </div>
    <div class="cal-grid">${DAYS.map((d) => `<span class="cal-wd">${d.short}</span>`).join('')}${cells.join('')}</div>
    <div class="cal-detail">
      <div class="cal-date">${label}${act && !ses ? ` <span class="muted">· ${esc(act.plan.name)}</span>` : ''}</div>
      ${pw ? `<div class="cal-w"><i class="wbadge" style="--c:${ctx.color(pid)}">${ctx.letter(pid)}</i> <b>${esc(pw.name)}</b>
        <span class="muted">${pw.items.length ? `${pw.items.length} ćw.` : 'pusty'}</span></div>
        <ul class="cal-items">${pw.items.map((it) => { const ex = CATALOG_BY_ID[it.exId]; return ex ? `<li>${esc(ex.name)} <span class="muted">${fmtSets(ex, it)}</span></li>` : ''; }).join('')}</ul>`
      : '<div class="muted">Dzień odpoczynku</div>'}
      <div class="cal-actions">${actions}</div>
    </div>`;
  const go = (m) => { month = new Date(month.getFullYear(), month.getMonth() + m, 1); renderCalendar(el, ctx); };
  el.querySelector('.cal-prev').onclick = () => go(-1);
  el.querySelector('.cal-next').onclick = () => go(1);
  el.querySelector('.cal-today')?.addEventListener('click', () => { day = todayIso; month = null; pick(); });
  const pick = () => ctx.onPick(day, ctx.plannedFor(parseDate(day)));
  el.querySelectorAll('.cal-start').forEach((b) => (b.onclick = () => ctx.onStart(day, b.dataset.w)));
  el.querySelector('.cal-plan-edit')?.addEventListener('click', () => { editing = true; renderCalendar(el, ctx); });
  el.querySelector('.cal-plan-cancel')?.addEventListener('click', () => { editing = false; renderCalendar(el, ctx); });
  el.querySelector('.cal-plan-set')?.addEventListener('click', () => {
    const from = el.querySelector('.cal-plan-from').value;
    if (!from) return;
    editing = false;
    ctx.onSetActive(el.querySelector('.cal-plan-sel').value, from);
  });
  el.querySelector('.cal-open')?.addEventListener('click', () => ctx.onOpen(ses.id));
  el.querySelectorAll('.cal-d').forEach((b) => (b.onclick = () => {
    day = b.dataset.iso;
    if (b.classList.contains('other')) month = new Date(parseDate(day).getFullYear(), parseDate(day).getMonth(), 1);
    pick();
  }));
}
