// Szybki test bez przeglądarki: pozy (kąty stawów) i aktywacje w wybranych chwilach cyklu.
import { EXERCISES } from '../src/exercises/index.js';
import { sampleExercise, computeActivations } from '../src/exercises/common.js';
for (const ex of EXERCISES) {
  console.log('==', ex.id, 'cycle', ex.cycle.toFixed(2));
  for (const d of [0, 0.5, 1]) {
    const p = ex.pose(d);
    const j = Object.fromEntries(Object.entries(p.joints).filter(([k])=>!k.endsWith('R')).map(([k,v])=>[k,(v*180/Math.PI).toFixed(0)]));
    console.log(' d', d, 'root', p.root.y.toFixed(3), p.root.z.toFixed(3), (p.root.rx*180/Math.PI).toFixed(1), JSON.stringify(j));
  }
  for (const t of [0.05, 0.3, 0.55, 0.62, 0.8, 0.98]) {
    const s = sampleExercise(ex, t); const a = computeActivations(ex, s);
    const top = Object.entries(a).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,v])=>k+':'+(v*100).toFixed(0)).join(' ');
    console.log(' t', t, s.phase.kind, 'depth', s.depth.toFixed(2), top);
  }
}
