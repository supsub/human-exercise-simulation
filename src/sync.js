import { createClient } from '@supabase/supabase-js';
import { DB } from './config.js';
import * as planner from './plan/planView.js';

// Konto i synchronizacja planów między urządzeniami (Supabase: logowanie Google / link w mailu, tabela user_data).
// - bez logowania aplikacja działa jak dotąd – wszystko w pamięci przeglądarki,
// - po zalogowaniu: plany i treningi zapisują się na koncie (jeden dokument JSON na użytkownika),
// - zmiany są zawsze najpierw zapisywane lokalnie; bez internetu czekają i wysyłają się po powrocie sieci,
// - pierwsze logowanie na nowym urządzeniu: dane z konta + lokalne plany o nazwach, których na koncie nie ma.

const sb = createClient(DB.url, DB.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
const META = `hes.sync.${DB.name}`;   // { uid, at: updated_at ostatnio zgodnej wersji, sent: JSON ostatnio wysłanych danych }
const $ = (id) => document.getElementById(id);
const ui = { btn: $('auth-open'), dlg: $('auth-dialog'), close: $('auth-close'), out: $('auth-out'), inn: $('auth-in'),
  google: $('auth-google'), mailForm: $('auth-mail'), email: $('auth-email'), msg: $('auth-msg'), who: $('auth-who'),
  status: $('auth-status'), logout: $('auth-logout') };

let user = null, state = 'off', timer = null, busy = false;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const meta = () => { try { return JSON.parse(localStorage.getItem(META)) ?? {}; } catch { return {}; } };
const setMeta = (m) => localStorage.setItem(META, JSON.stringify(m));
const payload = () => { const { plans, workouts } = planner.getData(); return JSON.stringify({ plans, workouts }); };

// --- scalanie: dane z konta + lokalne plany (po nazwie) i treningi, których na koncie brak ---
function merge(remote, local) {
  const out = { plans: [...remote.plans], workouts: [...remote.workouts] };
  const names = new Set(out.plans.map((p) => p.name)), wIds = new Set(out.workouts.map((w) => w.id));
  const wNames = new Set(out.workouts.map((w) => w.name));
  for (const p of local.plans) if (!names.has(p.name)) {
    out.plans.push(p);
    for (const id of p.variants) {
      const w = local.workouts.find((x) => x.id === id);
      if (w && !wIds.has(w.id)) { out.workouts.push(w); wIds.add(w.id); }
    }
  }
  for (const w of local.workouts) if (!wIds.has(w.id) && !wNames.has(w.name)) out.workouts.push(w);
  return out;
}

async function pull() {
  if (!user || busy) return;
  busy = true; setState('sync');
  let send = false;
  try {
    const { data: row, error } = await sb.from('user_data').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const m = meta(), local = JSON.parse(payload());
    const known = m.uid === user.id;                          // to urządzenie już synchronizowało to konto
    const dirty = known && m.sent !== JSON.stringify(local);  // lokalne zmiany jeszcze niewysłane
    const remoteChanged = row && (!known || row.updated_at !== m.at);
    if (!row || (!remoteChanged && dirty)) send = true;       // konto puste albo tylko tu są zmiany – wysyłamy
    else if (remoteChanged) {
      const next = dirty || !known ? merge(row.data, local) : row.data;
      setMeta({ uid: user.id, at: row.updated_at, sent: JSON.stringify(row.data) });
      planner.setData(next);
      send = JSON.stringify(next) !== JSON.stringify(row.data);
    }
    if (!send) setState('ok');
  } catch (e) {
    console.warn('sync pull', e); setState('err');
  } finally { busy = false; }
  if (send) await push(true);
}

async function push(now = false) {
  if (!user) return;
  clearTimeout(timer);
  if (!now) { setState('wait'); timer = setTimeout(() => push(true), 1500); return; }
  if (busy) { timer = setTimeout(() => push(true), 800); return; }
  const body = payload();
  if (meta().uid === user.id && meta().sent === body) { setState('ok'); return; }
  busy = true; setState('sync');
  try {
    const { data: row, error } = await sb.from('user_data').upsert({ user_id: user.id, data: JSON.parse(body) }).select('updated_at').single();
    if (error) throw error;
    setMeta({ uid: user.id, at: row.updated_at, sent: body });
    setState('ok');
  } catch (e) {
    console.warn('sync push', e); setState('err');
  } finally { busy = false; }
}

// --- interfejs ---
const LABEL = { off: '', ok: 'Zapisane na koncie', wait: 'Zapisuję…', sync: 'Synchronizuję…', err: 'Brak połączenia – zmiany są w telefonie, wyślą się później' };
function setState(s) {
  state = s;
  ui.btn.dataset.state = user ? s : 'off';
  ui.btn.title = user ? `${user.email} – ${LABEL[s]}` : 'Zaloguj się, żeby mieć plany na każdym urządzeniu';
  ui.status.textContent = LABEL[s];
  ui.status.className = `auth-status ${s}`;
}
function renderUser() {
  ui.inn.hidden = !user; ui.out.hidden = !!user;
  const name = user?.user_metadata?.full_name || user?.email || '';
  const first = name.split(/[ @]/)[0];
  ui.btn.innerHTML = user ? `<span class="av">${esc(first[0]?.toUpperCase() ?? '?')}</span><span class="lbl">${esc(first)}</span>` : '<span class="lbl">Zaloguj się</span>';
  ui.who.textContent = user ? `${name}${user.email && user.email !== name ? ` (${user.email})` : ''}` : '';
  setState(user ? state : 'off');
}

ui.btn.onclick = () => { ui.dlg.hidden = !ui.dlg.hidden; ui.msg.textContent = ''; $('settings-dialog').hidden = true; };
ui.close.onclick = () => (ui.dlg.hidden = true);
// Ustawienia (⚙): funkcje poboczne – twarz na modelu, o projekcie
const set = { btn: $('settings-open'), dlg: $('settings-dialog') };
set.btn.onclick = () => { set.dlg.hidden = !set.dlg.hidden; ui.dlg.hidden = true; };
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
ui.logout.onclick = async () => {
  await push(true);
  await sb.auth.signOut();
  ui.dlg.hidden = true;
};

sb.auth.onAuthStateChange((event, session) => {
  const was = user?.id;
  user = session?.user ?? null;
  renderUser();
  if (user && user.id !== was) setTimeout(pull, 0);   // poza callbackiem (zalecenie supabase-js)
  if (user && user.id !== was && /[?&]code=/.test(location.search)) history.replaceState(null, '', back());
});
planner.onSave(() => push());
addEventListener('online', () => pull());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); else if (state === 'wait') push(true); });
if (DB.name !== 'prod') ui.btn.classList.add('dev-db');
