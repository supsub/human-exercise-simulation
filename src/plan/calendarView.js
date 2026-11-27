// Kalendarz: osobny od edytora planów. Pokazuje treningi zaplanowane z planu realizowanego w danym okresie
// („Plan X od 1 stycznia”, potem „Plan Y od 1 lipca”) i wykonane treningi (historia – zostają po zmianie planu).
// Każdy plan ma swój kolor: kafelki jego okresu są nim zabarwione, dzień startu planu ma znacznik ▸,
// więc od razu widać, który plan obowiązywał / obowiązuje w danym dniu.
// Kliknięty dzień pokazuje swój trening, a model – jego mięśnie. Dane i akcje dostaje z planView (ctx).
import { DAYS, isoDate, parseDate, mondayOf } from './analysis.js';
import { CATALOG_BY_ID, fmtSets } from './catalog.js';
import { sessionStats } from './sessionView.js';

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let month = null;     // pierwszy dzień pokazywanego miesiąca
let day = null;       // wybrany dzień (RRRR-MM-DD)
let editing = false;  // otwarty formularz „zmień plan od…”
let lastLayout = '';  // animacja „wypełniania” kafelków tylko przy zmianie miesiąca albo planów, nie przy każdym kliknięciu

export const calendarDay = () => day;
export function resetCalendar() { month = null; day = null; }

// ctx: { plannedFor(date) → id treningu | null, activeOn(iso) → { plan, from, to } | null, periods: [{ plan, from, to }], plans: [plan],
//        planColor(planId), workout(id), allWorkouts, color(id), letter(id), sessionOn(iso),
//        onPick(iso, workoutId), onStart(iso, workoutId), onQuickDone(iso, workoutId), onSkip(iso, workoutId), onUndo(sessionId), onOpen(sessionId), onSetActive(planId, fromIso) }
export function renderCalendar(el, ctx) {
  const today = new Date(), todayIso = isoDate(today);
  day ??= todayIso;
  month ??= new Date(parseDate(day).getFullYear(), parseDate(day).getMonth(), 1);
  const short = (iso) => { const d = parseDate(iso); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`; };
  const first = mondayOf(month), last = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  // kafelki dni
  const cells = [], inMonth = new Map();   // plany widoczne w tym miesiącu (legenda)
  for (let d = new Date(first), i = 0; d <= last || cells.length % 7; d.setDate(d.getDate() + 1), i++) {
    const iso = isoDate(d), ses = ctx.sessionOn(iso), act = ctx.activeOn(iso);
    const id = ses ? ses.workoutId : ctx.plannedFor(d), w = id && ctx.workout(id);
    const pc = act ? ctx.planColor(act.plan.id) : null;
    if (act && d.getMonth() === month.getMonth()) inMonth.set(act.plan.id, act);
    const start = act && act.from === iso;
    const cls = ['cal-d', d.getMonth() !== month.getMonth() && 'other', iso === todayIso && 'today', iso === day && 'picked', iso < todayIso && 'past',
      act && 'in-plan', start && 'p-start', ses && (ses.skipped ? 'skipped' : ses.finished ? 'done' : 'live')].filter(Boolean).join(' ');
    const title = [act ? `Plan: ${act.plan.name}` : 'bez planu', ses ? `${ses.name} – ${ses.skipped ? 'pominięty' : ses.finished ? 'wykonany' : 'w trakcie'}` : w ? w.name : 'odpoczynek'].join(' · ');
    cells.push(`<button class="${cls}" data-iso="${iso}" style="--i:${i};${pc ? `--pc:${pc}` : ''}" title="${esc(title)}">
      ${start ? '<i class="cal-flag">▸</i>' : ''}<span class="n">${d.getDate()}</span>
      ${w ? `<i class="wbadge" style="--c:${ctx.color(id)}">${ctx.letter(id)}</i>` : ses ? '<i class="wbadge" style="--c:#8d98aa">•</i>' : '<i class="cal-rest"></i>'}
      ${ses ? (ses.skipped ? '<i class="cal-mark skip">✕</i>' : ses.finished ? '<i class="cal-mark">✓</i>' : '<i class="cal-mark live">●</i>') : ''}</button>`);
  }

  // realizowany plan (karta) albo formularz zmiany
  const now = ctx.activeOn(todayIso), past = ctx.periods.filter((x) => x.from !== now?.from && x.from <= todayIso).reverse(), next = ctx.periods.filter((x) => x.from > todayIso);
  const defFrom = day >= todayIso ? day : todayIso;
  const dot = (p) => `<i class="pdot" style="--pc:${ctx.planColor(p.id)}"></i>`;
  const planBox = editing || !ctx.periods.length
    ? `<div class="cal-plan edit">
        <div class="cal-plan-label">${ctx.periods.length ? 'Zmień realizowany plan' : 'Który plan realizujesz?'}</div>
        <div class="cal-plan-row">
          <select class="cal-plan-sel">${ctx.plans.map((p) => `<option value="${p.id}" ${p.id === (now?.plan.id ?? ctx.plans[0]?.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        </div>
        <div class="cal-plan-row"><span class="muted">od dnia</span><input class="cal-plan-from" type="date" value="${ctx.periods.length ? defFrom : isoDate(mondayOf(today))}">
          <button class="primary small cal-plan-set">Ustaw</button>${ctx.periods.length ? '<button class="link small cal-plan-cancel">anuluj</button>' : ''}</div>
        <div class="muted small">Wcześniejsze dni zostaną przy dotychczasowym planie, wykonane treningi – w historii.</div>
      </div>`
    : `<div class="cal-plan" style="--pc:${now ? ctx.planColor(now.plan.id) : 'var(--muted)'}">
        <div class="cal-plan-label">Realizowany plan</div>
        <div class="cal-plan-now">${now ? `${dot(now.plan)}<b>${esc(now.plan.name)}</b><span class="muted">od ${short(now.from)}</span>` : '<span class="muted">— brak na dziś</span>'}
          <button class="chip cal-plan-edit">Zmień plan</button></div>
        ${next.length || past.length ? `<div class="cal-timeline">
          ${past.length ? `<span class="muted">Wcześniej:</span> ${past.map((x) => `<span class="seg-t">${dot(x.plan)}${esc(x.plan.name)} <span class="muted">${short(x.from)} – ${x.to ? short(x.to) : '…'}</span></span>`).join('')}` : ''}
          ${next.length ? `<span class="muted">Potem:</span> ${next.map((x) => `<span class="seg-t">${dot(x.plan)}${esc(x.plan.name)} <span class="muted">od ${short(x.from)}</span></span>`).join('')}` : ''}
        </div>` : ''}
      </div>`;

  // wybrany dzień
  const picked = parseDate(day), pid = ctx.plannedFor(picked), pw = pid && ctx.workout(pid), act = ctx.activeOn(day);
  const label = `${day === todayIso ? 'Dziś · ' : ''}${WEEKDAYS[(picked.getDay() + 6) % 7]}, ${picked.getDate()} ${MONTHS_GEN[picked.getMonth()]}`;
  const ses = ctx.sessionOn(day), canLog = day <= todayIso;
  const others = (act?.plan.variants ?? []).map((id) => ctx.workout(id)).filter((w) => w && w.id !== pid);
  const isToday = day === todayIso;
  const chip = (w, cls) => `<button class="chip ${cls}" data-w="${w.id}"><i class="wbadge" style="--c:${ctx.color(w.id)}">${ctx.letter(w.id)}</i> ${esc(w.name)}</button>`;
  // warianty do wyboru: z planu tego dnia; dzień bez planu (np. przed pierwszym okresem) – z obecnego planu, inaczej wszystkie treningi
  const all = (act ?? ctx.activeOn(todayIso))?.plan.variants.map((id) => ctx.workout(id)).filter(Boolean) ?? ctx.allWorkouts;
  const actions = ses?.skipped
    ? `<div class="cal-ses skipped">✕ Pominięty: <b>${esc(ses.name)}</b> <button class="link small cal-undo" title="Usuń oznaczenie">cofnij</button></div>`
    : ses
    ? (() => { const st = sessionStats(ses); return `<div class="cal-ses ${ses.finished ? 'done' : ''}">${ses.finished ? '✓ Wykonany' : '● W trakcie'}: <b>${esc(ses.name)}</b> · ${st.done}/${st.total} serii
          <button class="link small cal-undo" title="Usuń zapis tego dnia">cofnij</button></div>
        <button class="primary cal-open">${ses.finished ? 'Pokaż trening' : 'Wróć do treningu'}</button>`; })()
    : !canLog ? ''
    : pw
      // dzień z treningiem w planie: dziś – start (szybkie odhaczenie obok), wcześniej – szybkie odhaczenie (szczegóły obok)
      ? `${isToday ? `<button class="primary cal-start" data-w="${pid}">▶ Zacznij trening</button>
           <button class="chip done-chip cal-quick" data-w="${pid}">✓ Oznacz jako wykonany</button>`
         : `<button class="primary done-btn cal-quick" data-w="${pid}">✓ Oznacz jako wykonany</button>
           <button class="link small cal-start" data-w="${pid}">zapisz ze szczegółami (serie, ciężary)</button>`}
         <button class="chip skip-chip cal-skip" data-w="${pid}" title="Oznacz, że w tym dniu nie było treningu">✕ Nie trenowałem</button>
         ${others.length ? `<div class="cal-other">inny trening: ${others.map((w) => chip(w, isToday ? 'cal-start' : 'cal-quick')).join(' ')}</div>` : ''}`
      // dzień bez treningu w planie (np. dodatkowy trening w niedzielę)
      : all.length ? `<div class="cal-other">${isToday ? 'Zacznij trening:' : 'Oznacz jako wykonany:'} ${all.map((w) => chip(w, isToday ? 'cal-start' : 'cal-quick')).join(' ')}</div>
          ${isToday ? `<div class="cal-other">albo szybko oznacz jako wykonany: ${all.map((w) => chip(w, 'cal-quick')).join(' ')}</div>` : ''}` : '';

  const layout = `${month.getTime()}|${JSON.stringify(ctx.periods.map((x) => [x.plan.id, x.from]))}`;
  const animate = layout !== lastLayout;
  lastLayout = layout;
  el.innerHTML = `
    ${planBox}
    <div class="cal-head">
      <button class="cal-nav cal-prev" title="Poprzedni miesiąc">‹</button>
      <div class="cal-month">${MONTHS[month.getMonth()]} <span>${month.getFullYear()}</span></div>
      <button class="cal-nav cal-next" title="Następny miesiąc">›</button>
      ${day !== todayIso || month.getMonth() !== today.getMonth() ? '<button class="chip cal-today">Dziś</button>' : ''}
    </div>
    ${inMonth.size ? `<div class="cal-legend">${[...inMonth.values()].map((x) => `<span>${dot(x.plan)}${esc(x.plan.name)}</span>`).join('')}</div>` : ''}
    <div class="cal-grid${animate ? ' anim' : ''}">${DAYS.map((d) => `<span class="cal-wd">${d.short}</span>`).join('')}${cells.join('')}</div>
    <div class="cal-detail" style="${act ? `--pc:${ctx.planColor(act.plan.id)}` : ''}">
      <div class="cal-date">${label}${act && !ses ? ` <span class="cal-dplan">${dot(act.plan)}${esc(act.plan.name)}</span>` : ''}</div>
      ${pw ? `<div class="cal-w"><i class="wbadge" style="--c:${ctx.color(pid)}">${ctx.letter(pid)}</i> <b>${esc(pw.name)}</b>
        <span class="muted">${pw.items.length ? `${pw.items.length} ćw.` : 'pusty'}</span></div>
        <ul class="cal-items">${pw.items.map((it) => { const ex = CATALOG_BY_ID[it.exId]; return ex ? `<li>${esc(ex.name)} <span class="muted">${fmtSets(ex, it)}</span></li>` : ''; }).join('')}</ul>`
      : `<div class="muted">${act ? 'Dzień odpoczynku' : 'Bez planu w tym dniu'}</div>`}
      <div class="cal-actions">${actions}</div>
    </div>`;

  const go = (m) => { month = new Date(month.getFullYear(), month.getMonth() + m, 1); renderCalendar(el, ctx); };
  el.querySelector('.cal-prev').onclick = () => go(-1);
  el.querySelector('.cal-next').onclick = () => go(1);
  const pick = () => ctx.onPick(day, ctx.plannedFor(parseDate(day)));
  el.querySelector('.cal-today')?.addEventListener('click', () => { day = todayIso; month = null; pick(); });
  el.querySelectorAll('.cal-start').forEach((b) => (b.onclick = () => ctx.onStart(day, b.dataset.w)));
  el.querySelectorAll('.cal-quick').forEach((b) => (b.onclick = () => ctx.onQuickDone(day, b.dataset.w)));
  el.querySelector('.cal-skip')?.addEventListener('click', (e) => ctx.onSkip(day, e.currentTarget.dataset.w));
  el.querySelector('.cal-undo')?.addEventListener('click', () => ctx.onUndo(ses.id));
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
