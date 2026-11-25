// Sylwetka modelu: 'm' – mężczyzna, 'f' – kobieta. Zapamiętana w przeglądarce; zmiana działa od razu
// (główny model i figurki w panelu ćwiczenia słuchają onSex). W przeglądarce można też wymusić ?sex=f.
const KEY = 'hes.sex';
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sex') : null;
let sex = q === 'f' || q === 'm' ? q : (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) === 'f' ? 'f' : 'm';
const listeners = [];
export const getSex = () => sex;
export const onSex = (fn) => listeners.push(fn);
export function setSex(s) {
  if (s !== 'f' && s !== 'm') return;
  try { localStorage.setItem(KEY, s); } catch { /* tryb prywatny */ }
  if (s === sex) return;
  sex = s;
  for (const fn of listeners) fn(s);
}
