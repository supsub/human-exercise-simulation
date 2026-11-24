// Chwyt w każdym ćwiczeniu – SPECYFIKACJA (sprawdzana automatycznie w tools/sheet.html?check).
//
// expect: 'wnętrze dłoni → kierunek / kciuk → kierunek' w pozycji wyjściowej (A), względem tułowia:
//   przód, tył, głowa, stopy, środek (do osi ciała), zewn (na zewnątrz). '*' = dowolny.
// pron:   obrót przedramienia, który to daje (0 = podchwyt, 90 = młotkowy, 180 = nachwyt); ćwiczenia ze sztangą
//         i drążkiem ustawiają dłonie same (body.js alignHandsToBar, typ chwytu props.bar.grip, domyślnie nachwyt).
// grip:   zaciśnięcie dłoni (0 = otwarta, 1 = pięść / pełny chwyt), gdy inne niż domyślne dla rekwizytu.
//
// Zasada: chwyt jest STAŁY przez cały ruch – nie zmienia się między nachwytem/podchwytem, a dłoń nie
// przesuwa się po drążku (test sprawdza też to). Wolne dłonie zwisają naturalnie: wnętrzem do ud.
export const GRIPS = {
  pushup: { expect: 'przód/środek' },                            // dłonie płasko na podłodze, palce do przodu
  squat: { expect: 'środek/przód', pron: 90 },                   // bez sztangi: ręce w przód dla równowagi
  curl: { expect: 'przód/zewn' },                                // podchwyt
  bench: { expect: 'stopy/środek' },
  db_bench: { expect: 'stopy/środek', pron: 180 },
  incline_db: { expect: 'stopy/środek', pron: 180 },
  dips: { expect: 'środek/przód', pron: 90 },                    // poręcze: chwyt neutralny
  fly: { expect: 'środek/głowa', pron: 90 },                     // hantle równolegle
  cable_fly: { expect: 'przód/*' },
  pullup: { expect: 'przód/środek', pron: 180 },                 // nachwyt
  lat_pulldown: { expect: 'przód/środek' },
  lat_pulldown_wide: { expect: 'przód/środek' },
  row: { expect: 'stopy/środek' },
  db_row: { expect: 'środek/głowa', pron: 90 },
  cable_row: { expect: 'stopy/środek' },
  incline_row: { expect: 'środek/głowa', pron: 90 },
  face_pull: { expect: 'stopy/środek' },
  shrug: { expect: 'środek/przód' },
  back_ext: { expect: '*', grip: 0.4 },
  ohp: { expect: 'przód/środek' },
  db_ohp: { expect: 'przód/środek', pron: 90 },
  lateral_raise: { expect: 'środek/przód', pron: 90 },
  reverse_fly: { expect: 'środek/głowa', pron: 90 },
  hammer: { expect: 'środek/przód' },
  triceps_oh: { expect: '*' },
  pushdown: { expect: 'stopy/środek' },
  wrist_curl: { expect: 'głowa/zewn' },                          // przedramiona na udach, wnętrza dłoni do góry
  reverse_curl: { expect: 'tył/środek' },
  front_squat: { expect: '*' },
  goblet_squat: { expect: 'głowa/*' },                           // wnętrza dłoni do góry pod talerzem
  deadlift: { expect: 'stopy/środek' },
  rdl: { expect: 'tył/środek' },
  db_rdl: { expect: 'tył/środek', pron: 180 },                   // hantle przed udami, wnętrza dłoni do ud
  lunge: { expect: 'środek/przód' },
  leg_press: { expect: 'środek/przód', pron: 90, grip: 1 },      // uchwyty przy siedzisku
  leg_ext: { expect: 'środek/przód', pron: 90, grip: 1 },
  leg_curl: { expect: '*', grip: 1 },                            // uchwyty z przodu ławki
  adductor: { expect: 'środek/przód', pron: 0, grip: 1 },
  calf_raise: { expect: 'środek/przód', pron: 90 },
  seated_calf: { expect: 'stopy/*', pron: 180 },                // dłonie oparte płasko na udach
  tib_raise: { expect: 'środek/przód', pron: 90 },
  hip_thrust: { expect: '*' },
  band_walk: { expect: '*' },
  plank: { expect: 'środek/tył', pron: 90, grip: 1 },            // przedramiona na podłodze, pięści małym palcem w dół
  side_plank: { expect: '*', grip: 0.5 },                        // dolna ręka na przedramieniu, górna na biodrze
  crunch: { expect: '*' },
  leg_raise: { expect: 'przód/środek', pron: 180 },              // zwis nachwytem
  farmer: { expect: 'środek/przód' },
};

// Porównanie z wynikiem physics.handOrientation
export function gripMismatch(id, L) {
  const g = GRIPS[id];
  if (!g) return 'brak specyfikacji chwytu w grips.js';
  const [palm, thumb = '*'] = g.expect.split('/');
  const bad = [];
  if (palm !== '*' && L.palm.label !== palm) bad.push(`wnętrze dłoni → ${L.palm.label} (powinno: ${palm})`);
  if (thumb !== '*' && L.thumb.label !== thumb) bad.push(`kciuk → ${L.thumb.label} (powinien: ${thumb})`);
  return bad.join(', ');
}
