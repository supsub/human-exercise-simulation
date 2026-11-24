import pushup from './pushup.js';
import squat from './squat.js';
import curl from './curl.js';
import { LIBRARY } from './library.js';
import { CATALOG_BY_ID } from '../plan/catalog.js';

// Rejestr ćwiczeń z animacją. Pompka, przysiad i uginanie mają własne pliki (z typowymi błędami),
// pozostałe są zdefiniowane w library.js. Każde ćwiczenie katalogu ma animację o tym samym id.
export const EXERCISES = [pushup, squat, curl, ...LIBRARY];
export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
for (const e of EXERCISES) if (CATALOG_BY_ID[e.id]) CATALOG_BY_ID[e.id].animated = e.id;
