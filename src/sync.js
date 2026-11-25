import { createClient } from '@supabase/supabase-js';
import { DB } from './config.js';
import { VERSION, BUILT } from './version.js';
import * as planner from './plan/planView.js';
import { getSex, setSex, onSex } from './sex.js';

// Konto i synchronizacja planów między urządzeniami (Supabase: logowanie Google, tabela user_data;
// link w mailu tylko na lokalnej bazie testowej – maile w podglądzie Mailpit).
// - bez logowania aplikacja działa jak dotąd – wszystko w pamięci przeglądarki,
// - po zalogowaniu: plany i treningi zapisują się na koncie (jeden dokument JSON na użytkownika),
// - zmiany są zawsze najpierw zapisywane lokalnie; bez internetu czekają i wysyłają się po powrocie sieci,
// - pierwsze logowanie na nowym urządzeniu: dane z konta + lokalne plany o nazwach, których na koncie nie ma.

// testy (tools/smoke.html): aplikacja w ramce strony testowej korzysta z jej udawanego serwera (window.__hesFetch rodzica)
const testFetch = (() => { try { return window.parent !== window && window.parent.__hesFetch; } catch { return null; } })();
const sb = createClient(DB.url, DB.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
  ...(testFetch ? { global: { fetch: (url, opts) => testFetch(url, opts, window) } } : {}) });
const META = `hes.sync.${DB.name}`;   // { uid, at: updated_at ostatnio zgodnej wersji, sent: JSON ostatnio wysłanych danych }
const $ = (id) => document.getElementById(id);
const ui = { btn: $('auth-open'), dlg: $('auth-dialog'), close: $('auth-close'), out: $('auth-out'), inn: $('auth-in'),
  google: $('auth-google'), mailForm: $('auth-mail'), email: $('auth-email'), msg: $('auth-msg'), who: $('auth-who'),
  status: $('auth-status'), logout: $('auth-logout'), pic: $('auth-pic') };

// Start: zapisana sesja (albo powrót z logowania Google) → ekran wczytywania, aż przyjdą plany z konta;
// bez sesji → od razu tryb gościa (przykładowy plan, bez migania pustą kartką)
const AUTH_KEY = `sb-${new URL(DB.url).hostname.split('.')[0]}-auth-token`;
const loading = $('app-loading');
let waiting = true;
if (localStorage.getItem(AUTH_KEY) || /[?&]code=/.test(location.search)) setTimeout(ready, 10000);   // bez sieci nie czekamy w nieskończoność
else { planner.setGuest(true); setTimeout(ready, 50); }   // gość: plan rysuje się synchronicznie przy starcie (main.js) – zaraz po nim
function ready() {
  if (!waiting) return;
  waiting = false;
  loading.classList.add('fade');
  setTimeout(() => (loading.hidden = true), 300);
}

let user = null, state = 'off', timer = null, busy = false, again = false;
let leaving = false, conflicts = 0;   // trwa wylogowanie: żadnej wymiany z kontem (czyszczenie danych w przeglądarce nie może trafić na konto)
const done = () => { busy = false; if (again) { again = false; setTimeout(pull, 0); } };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const meta = () => { try { return JSON.parse(localStorage.getItem(META)) ?? {}; } catch { return {}; } };
const setMeta = (m) => localStorage.setItem(META, JSON.stringify(m));
// Dane konta: plany, treningi i ustawienia (sylwetka) – jedna wersja na wszystkich urządzeniach.
// Porównujemy postać kanoniczną (klucze posortowane): baza (jsonb) zmienia kolejność kluczy, a zwykły JSON.stringify
// widziałby wtedy „zmianę” i urządzenia odsyłałyby sobie dane w kółko.
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v));
const payload = () => { const { plans, workouts } = planner.getData(); return canon({ plans, workouts, settings: { sex: getSex() } }); };
const applySettings = (st) => { if (st?.sex) setSex(st.sex); };

// --- scalanie: dane z konta + lokalne plany (po nazwie) i treningi, których na koncie brak ---
function merge(remote, local) {
  const out = { plans: [...remote.plans], workouts: [...remote.workouts], settings: remote.settings ?? local.settings };
  const names = new Set(out.plans.map((p) => p.name)), wIds = new Set(out.workouts.map((w) => w.id));
  const wNames = new Set(out.workouts.map((w) => w.name));
  const used = (p) => p.variants.some((id) => local.workouts.find((w) => w.id === id)?.items.length);
  for (const p of local.plans) if (!names.has(p.name) && used(p)) {   // pusty domyślny plan gościa nie trafia na konto
    out.plans.push(p);
    for (const id of p.variants) {
      const w = local.workouts.find((x) => x.id === id);
      if (w && !wIds.has(w.id)) { out.workouts.push(w); wIds.add(w.id); }
    }
  }
  for (const w of local.workouts) if (!wIds.has(w.id) && !wNames.has(w.name) && w.items.length) out.workouts.push(w);
  return out;
}

async function pull() {
  if (!user || leaving) return;
  if (busy) { again = true; return; }   // trwa inna wymiana – sprawdzimy ponownie zaraz po niej
  busy = true; setState('sync');
  let send = false;
  try {
    const { data: row, error } = await sb.from('user_data').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const m = meta(), local = JSON.parse(payload());
    const known = m.uid === user.id;                          // to urządzenie już synchronizowało to konto
    const dirty = known && m.sent !== canon(local);           // lokalne zmiany jeszcze niewysłane
    const remoteChanged = row && (!known || row.updated_at !== m.at);
    if (!row) { setMeta({ uid: user.id, at: null, sent: m.uid === user.id ? m.sent : '' }); send = true; }   // konto puste – pierwszy zapis
    else if (!remoteChanged && dirty) send = true;            // tylko tu są zmiany – wysyłamy
    else if (remoteChanged) {
      const next = dirty || !known ? merge(row.data, local) : { ...row.data, settings: row.data.settings ?? local.settings };
      // kopia zapasowa planów z tej przeglądarki, zanim zastąpią je dane z konta (hes.backup – do ręcznego odzyskania)
      if (local.plans.length && canon({ plans: next.plans, workouts: next.workouts }) !== canon({ plans: local.plans, workouts: local.workouts })) localStorage.setItem('hes.backup', JSON.stringify({ at: new Date().toISOString(), data: local }));
      setMeta({ uid: user.id, at: row.updated_at, sent: canon(row.data) });
      planner.setData({ plans: next.plans, workouts: next.workouts });
      applySettings(next.settings);
      send = canon(next) !== canon(row.data);
    }
    if (!send) setState('ok');
  } catch (e) {
    console.warn('sync pull', e); setState('err');
  } finally { done(); }
  if (send) await push(true);
}

async function push(now = false) {
  if (!user || leaving) return;
  clearTimeout(timer);
  if (!now) { setState('wait'); timer = setTimeout(() => push(true), 1500); return; }
  if (busy) { timer = setTimeout(() => push(true), 800); return; }
  const body = payload();
  if (meta().uid === user.id && meta().sent === body) { setState('ok'); return; }
  // bezpiecznik: pusty stan nadpisałby plany na koncie – wysyłamy go tylko, gdy użytkownik sam usunął ostatni plan
  const hadPlans = (() => { try { return JSON.parse(meta().sent ?? 'null')?.plans?.length > 0; } catch { return false; } })();
  if (!JSON.parse(body).plans.length && hadPlans && !planner.emptiedByUser()) { console.warn('sync: pomijam wysłanie pustego stanu'); return; }
  // Zapis warunkowy – nigdy „na ślepo”: aktualizujemy tylko wersję konta, którą to urządzenie zna (updated_at),
  // a nowy wiersz wyłącznie wstawiamy. Jeśli na koncie jest coś innego (inne urządzenie, wyścig przy logowaniu),
  // zapis się nie uda – wtedy pobieramy konto i scalamy (pull), zamiast nadpisywać cudze plany.
  busy = true; setState('sync');
  let conflict = false;
  try {
    const m = meta(), data = JSON.parse(body);
    const q = m.uid === user.id && m.at
      ? sb.from('user_data').update({ data }).eq('user_id', user.id).eq('updated_at', m.at).select('updated_at')
      : sb.from('user_data').insert({ user_id: user.id, data }).select('updated_at');
    const { data: rows, error } = await q;
    if (error?.code === '23505' || (!error && !rows?.length)) conflict = true;   // wiersz już jest / zmienił się w międzyczasie
    else if (error) throw error;
    else { setMeta({ uid: user.id, at: rows[0].updated_at, sent: body }); setState('ok'); }
  } catch (e) {
    console.warn('sync push', e); setState('err');
  } finally { done(); }
  if (conflict && conflicts++ < 3) { console.warn('sync: konto zmieniło się w międzyczasie – pobieram i scalam'); await pull(); }
  else if (conflict) setState('err');
  else conflicts = 0;
}

// --- interfejs ---
const LABEL = { off: '', ok: 'Zapisane na koncie', wait: 'Zapisuję…', sync: 'Synchronizuję…', err: 'Brak połączenia – zmiany są w telefonie, wyślą się później' };
function setState(s) {
  state = s;
  if (s === 'ok' || s === 'err') ready();   // pierwsza wymiana z kontem zakończona
  ui.btn.dataset.state = user ? s : 'off';
  ui.btn.title = user ? `${user.email} – ${LABEL[s]}` : 'Zaloguj się, żeby mieć plany na każdym urządzeniu';
  ui.status.textContent = LABEL[s];
  ui.status.className = `auth-status ${s}`;
}
function renderUser() {
  ui.inn.hidden = !user; ui.out.hidden = !!user;
  const name = user?.user_metadata?.full_name || user?.email || '';
  const first = name.split(/[ @]/)[0], pic = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const av = pic ? `<img class="av" src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : `<span class="av">${esc(first[0]?.toUpperCase() ?? '?')}</span>`;
  ui.btn.innerHTML = user ? `${av}<span class="lbl">${esc(first)}</span>` : '<span class="lbl">Zaloguj się</span>';
  ui.pic.hidden = !pic; if (pic) ui.pic.src = pic;
  ui.who.textContent = user ? `${name}${user.email && user.email !== name ? ` (${user.email})` : ''}` : '';
  setState(user ? state : 'off');
}

ui.btn.onclick = () => { ui.dlg.hidden = !ui.dlg.hidden; ui.msg.textContent = ''; $('settings-dialog').hidden = true; };
ui.close.onclick = () => (ui.dlg.hidden = true);
// Ustawienia (⚙): funkcje poboczne – twarz na modelu, o projekcie
const set = { btn: $('settings-open'), dlg: $('settings-dialog') };
{ const [d, t] = BUILT.split(' '), [y, m, dd] = d.split('-');
  $('app-version').textContent = `wersja ${VERSION} · ${dd}.${m}.${y} ${t}${DB.name !== 'prod' ? ' · baza lokalna' : ''}`; }
set.btn.onclick = () => { set.dlg.hidden = !set.dlg.hidden; ui.dlg.hidden = true; };
// sylwetka modelu: mężczyzna / kobieta – zmienia się od razu, okienko zostaje otwarte
const sexBtns = [...$('sex-switch').children];
const showSex = () => sexBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sex === getSex())));
sexBtns.forEach((b) => (b.onclick = () => { setSex(b.dataset.sex); showSex(); }));
showSex();
$('face-open').addEventListener('click', () => (set.dlg.hidden = true));   // twarz otwiera własny panel
document.addEventListener('pointerdown', (e) => {                         // klik poza okienkiem je zamyka
  for (const m of [ui, set]) if (!m.dlg.hidden && !m.dlg.contains(e.target) && !m.btn.contains(e.target)) m.dlg.hidden = true;
});
const back = () => location.origin + location.pathname;
ui.google.onclick = async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back() } });
  if (error) ui.msg.textContent = `Nie udało się: ${error.message}`;
};
ui.mailForm.onsubmit = async (e) => {
  e.preventDefault();
  ui.msg.textContent = 'Wysyłam…';
  const { error } = await sb.auth.signInWithOtp({ email: ui.email.value.trim(), options: { emailRedirectTo: back() } });
  ui.msg.textContent = error ? `Nie udało się: ${error.message}` : 'Sprawdź skrzynkę i kliknij link w mailu.';
};
// Wylogowanie: plany zostają na koncie, a to urządzenie wraca do trybu gościa (nikt po nas ich tu nie zobaczy).
// Nie może się „zawiesić”: wysyłka zmian i wylogowanie na serwerze mają limit czasu, a sesja i dane
// w przeglądarce są czyszczone zawsze – na końcu strona wczytuje się od nowa jako gość.
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ timeout: true }), ms))]);
ui.logout.onclick = async () => {
  ui.logout.disabled = true; ui.logout.textContent = 'Wylogowuję…';
  try {
    await within(push(true), 4000);
    if (state === 'err' && !confirm('Ostatnie zmiany nie są jeszcze zapisane na koncie (brak połączenia). Wylogować mimo to? Te zmiany przepadną.')) {
      ui.logout.disabled = false; ui.logout.textContent = 'Wyloguj';
      return;
    }
    leaving = true; clearTimeout(timer);   // od tej chwili nic nie trafia na konto
    ui.dlg.hidden = true;                   // ekran wylogowania zamiast znikających pól – aż strona wczyta się od nowa
    loading.querySelector('p').textContent = 'Wylogowuję…';
    loading.classList.remove('fade'); loading.hidden = false;
    await within(sb.auth.signOut({ scope: 'local' }), 3000);
  } catch (e) { console.warn('logout', e); }
  leaving = true; clearTimeout(timer); user = null;
  forget();
  location.replace(back());
};
function forget() {
  for (const k of Object.keys(localStorage)) if (k.startsWith(AUTH_KEY)) localStorage.removeItem(k);   // sesja (i ślad logowania PKCE)
  localStorage.removeItem(META);
  planner.setData({ plans: [], workouts: [] });   // dane konta znikają z tej przeglądarki
}

// Na żywo: zmiana zapisana na innym urządzeniu przychodzi od razu (Supabase Realtime) – pobieramy ją.
// Własne zapisy też wracają jako zdarzenia, ale mają znany już znacznik czasu, więc je pomijamy.
let live = null;
function listen() {
  if (live) { sb.removeChannel(live); live = null; }
  if (!user) return;
  live = sb.channel(`user_data:${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_data', filter: `user_id=eq.${user.id}` }, (ev) => {
      if (ev.new?.updated_at && ev.new.updated_at !== meta().at) pull();
    })
    .subscribe((status) => { if (status === 'SUBSCRIBED') pull(); });   // po (ponownym) połączeniu nadrabiamy zmiany
}

sb.auth.onAuthStateChange((event, session) => {
  const was = user?.id;
  user = session?.user ?? null;
  renderUser();
  if (!user && was) { localStorage.removeItem(META); planner.setData({ plans: [], workouts: [] }); }   // wylogowano (także na innej karcie)
  if (!user) { planner.setGuest(true); ready(); }
  else planner.setGuest(false);
  if (user?.id !== was) setTimeout(listen, 0);
  if (user && user.id !== was) setTimeout(pull, 0);   // poza callbackiem (zalecenie supabase-js)
  if (user && user.id !== was && /[?&]code=/.test(location.search)) history.replaceState(null, '', back());
});
planner.onSave(() => push());
onSex(() => { showSex(); push(); });   // sylwetka to część danych konta
// gość chce coś utworzyć albo zmienić – zapraszamy do logowania
const askLogin = (text) => { $('settings-dialog').hidden = true; ui.dlg.hidden = false; ui.msg.textContent = text; };
planner.onNeedLogin(() => askLogin('Zaloguj się, żeby tworzyć kolejne plany i zapisywać je na koncie.'));
$('guest-login').onclick = () => askLogin('Plan zostanie zapisany na Twoim koncie.');
addEventListener('online', () => pull());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); else if (state === 'wait') push(true); });
if (DB.name !== 'prod') { ui.btn.classList.add('dev-db'); ui.mailForm.hidden = false; }
