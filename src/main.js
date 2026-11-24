import { setFrameHandler } from './scene.js';
import * as sim from './simView.js';
import * as planner from './plan/planView.js';
import { EXERCISE_BY_ID } from './exercises/index.js';

// Router między widokami: #sim (symulacja ćwiczeń) i #plan (plan treningowy).

const views = { sim, plan: planner };
const roots = { sim: document.getElementById('sim-view'), plan: document.getElementById('plan-view') };
let current = null;

function show(name) {
  if (!views[name]) name = 'sim';
  if (current === name) return;
  if (current) views[current].leave();
  current = name;
  for (const [k, el] of Object.entries(roots)) el.hidden = k !== name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  views[name].enter();
  setFrameHandler((dt, time) => views[name].frame(dt, time));
}

window.addEventListener('hashchange', () => show(location.hash.slice(1)));

// Z podglądu w planie: "Otwórz w symulacji" (plan zostaje zapisany, można do niego wrócić zakładką)
planner.setOpenInSimulation((exerciseId) => {
  location.hash = 'sim';
  show('sim');
  sim.startExercise(EXERCISE_BY_ID[exerciseId]);
});

show(location.hash.slice(1) || 'sim');
sim.applyUrlParams(new URLSearchParams(location.search));
