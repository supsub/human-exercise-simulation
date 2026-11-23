// Prosty parser poleceń w języku polskim (MVP, bez LLM).
// Przykłady: "zrób pompkę", "zrób 5 pompek", "trzy przysiady", "stop", "wolniej".
import { EXERCISES } from './exercises/index.js';

const NUMBERS = {
  jeden: 1, jedna: 1, jedną: 1, raz: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5, szesc: 6,
  siedem: 7, osiem: 8, dziewiec: 9, dziesiec: 10, jedenascie: 11, dwanascie: 12, pietnascie: 15, dwadziescia: 20,
};

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

// Zwraca obiekt akcji: { type: 'exercise', exercise, reps } | { type: 'stop' } | ... | { type: 'unknown' }
export function parseCommand(text) {
  const t = normalize(text);
  if (!t) return { type: 'empty' };
  const words = t.split(/\s+/);

  if (/\b(stop|zatrzymaj|przestan|koniec|pauza|wstrzymaj)/.test(t)) return { type: 'stop' };
  if (/\b(wolniej|zwolnij)/.test(t)) return { type: 'speed', factor: 0.5 };
  if (/\b(szybciej|przyspiesz)/.test(t)) return { type: 'speed', factor: 2 };
  if (/\b(odpocznij|stan|wyprostuj|spocznij)/.test(t)) return { type: 'rest' };

  const exercise = EXERCISES.find((ex) => ex.aliases.some((a) => words.some((w) => w.startsWith(a))));
  if (!exercise) {
    if (/\b(wznow|start|graj|dalej|kontynuuj)/.test(t)) return { type: 'play' };
    return { type: 'unknown' };
  }

  let reps = null;
  for (const w of words) {
    if (/^\d+$/.test(w)) { reps = parseInt(w, 10); break; }
    if (NUMBERS[w] !== undefined) { reps = NUMBERS[w]; break; }
  }
  if (/\b(ciagle|w kolko|bez konca|non stop)/.test(t)) reps = null;
  else if (reps === null && /\b(jedn|pojedyncz)/.test(t)) reps = 1;
  return { type: 'exercise', exercise, reps: reps ? Math.min(reps, 100) : null };
}
