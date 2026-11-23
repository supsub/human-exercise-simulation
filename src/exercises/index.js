import pushup from './pushup.js';
import squat from './squat.js';
import curl from './curl.js';

// Rejestr ćwiczeń – nowe ćwiczenie = nowy plik + wpis tutaj.
export const EXERCISES = [pushup, squat, curl];
export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
