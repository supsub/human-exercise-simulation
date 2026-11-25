// Która baza: produkcyjny Supabase albo lokalny (supabase start, Docker).
// localhost → lokalna baza; GitHub Pages i telefon w sieci domowej → produkcja.
// Ręcznie: ?db=local / ?db=prod (zapamiętywane w tej przeglądarce, ?db=auto przywraca domyślne).
// Klucz publishable/anon jest jawny z założenia – dane chronią reguły RLS w bazie (supabase/migrations).
const PROD = { name: 'prod', url: 'https://itfuaoptseyxztqncbvd.supabase.co', key: 'sb_publishable_6cxy0F0zwmLkslVCcLMwew_eDE5ypqI' };
const LOCAL = {
  name: 'local',
  url: 'http://127.0.0.1:54321',
  // domyślny klucz anon lokalnego Supabase CLI (taki sam u wszystkich); inny → localStorage 'hes.db.localKey'
  key: localStorage.getItem('hes.db.localKey') ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
};
const q = new URLSearchParams(location.search).get('db');
if (q === 'auto') localStorage.removeItem('hes.db');
else if (q === 'local' || q === 'prod') localStorage.setItem('hes.db', q);
const forced = localStorage.getItem('hes.db');
const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
export const DB = forced === 'local' ? LOCAL : forced === 'prod' ? PROD : isLocalhost ? LOCAL : PROD;
