// Definicje mięśni (z podziałem na głowy/części): nazwa, grupa i umiejscowienie na manekinie.
//
// bone: część szkieletu, do której przyczepiony jest mięsień
//   'pelvis' | 'torso' | 'upperArm' | 'forearm' | 'thigh' | 'shin'
// pos / r / rot: położenie, promienie i obrót kształtu w lokalnym układzie kości
//   (dla kończyn podajemy stronę LEWĄ: x > 0 = na zewnątrz, x < 0 = do środka ciała)
// parts: zamiast pos/r można podać kilka brył (np. "kaloryfer" mięśnia prostego brzucha)
// shape: 'ellipsoid' (domyślnie) | 'spindle' (wrzecionowaty) | 'tear' (łza – brzusiec u dołu) | 'tearUp' (brzusiec u góry)
// mirror: kopia po prawej stronie
// deep: mięsień głęboki – niewidoczny na powierzchni, pokazywany tylko na liście
// Układ: Y w górę, +Z = przód ciała, +X = lewa strona postaci.

export const MUSCLE_GROUPS = [
  'Klatka piersiowa', 'Barki', 'Plecy', 'Przód ramienia', 'Tył ramienia', 'Przedramiona',
  'Core', 'Dolny grzbiet', 'Pośladki', 'Przód uda', 'Tył uda', 'Przywodziciele', 'Podudzie',
];

export const MUSCLES = [
  // --- Klatka piersiowa ---
  { id: 'pec_clav', name: 'Piersiowy większy – część obojczykowa', latin: 'pectoralis major, pars clavicularis', group: 'Klatka piersiowa',
    bone: 'torso', pos: [0.085, 0.4, 0.078], r: [0.075, 0.034, 0.03], rot: [0, 0.25, -0.22], mirror: true },
  { id: 'pec_stern', name: 'Piersiowy większy – część mostkowa', latin: 'pectoralis major, pars sternocostalis', group: 'Klatka piersiowa',
    bone: 'torso', pos: [0.08, 0.335, 0.088], r: [0.083, 0.052, 0.035], rot: [0, 0.25, 0.12], mirror: true },
  { id: 'serratus', name: 'Zębaty przedni', latin: 'serratus anterior', group: 'Klatka piersiowa', bone: 'torso', mirror: true,
    parts: [
      { pos: [0.152, 0.285, 0.05], r: [0.022, 0.016, 0.035], rot: [0, 0, -0.45] },
      { pos: [0.155, 0.25, 0.05], r: [0.022, 0.016, 0.035], rot: [0, 0, -0.45] },
      { pos: [0.152, 0.215, 0.045], r: [0.022, 0.016, 0.033], rot: [0, 0, -0.45] },
    ] },

  // --- Barki ---
  { id: 'delt_ant', name: 'Naramienny – akton przedni', latin: 'deltoideus, pars clavicularis', group: 'Barki',
    bone: 'upperArm', pos: [0.012, -0.045, 0.04], r: [0.033, 0.08, 0.028], shape: 'tearUp', mirror: true },
  { id: 'delt_lat', name: 'Naramienny – akton boczny', latin: 'deltoideus, pars acromialis', group: 'Barki',
    bone: 'upperArm', pos: [0.048, -0.05, 0], r: [0.028, 0.085, 0.04], shape: 'tearUp', mirror: true },
  { id: 'delt_post', name: 'Naramienny – akton tylny', latin: 'deltoideus, pars spinalis', group: 'Barki',
    bone: 'upperArm', pos: [0.012, -0.045, -0.04], r: [0.033, 0.08, 0.028], shape: 'tearUp', mirror: true },

  // --- Plecy ---
  { id: 'trap_upper', name: 'Czworoboczny – część zstępująca (górna)', latin: 'trapezius, pars descendens', group: 'Plecy',
    bone: 'torso', pos: [0.075, 0.435, -0.025], r: [0.075, 0.03, 0.035], rot: [0, 0, -0.38], mirror: true },
  { id: 'trap_mid', name: 'Czworoboczny – część poprzeczna (środkowa)', latin: 'trapezius, pars transversa', group: 'Plecy',
    bone: 'torso', pos: [0.06, 0.365, -0.1], r: [0.062, 0.035, 0.025], mirror: true },
  { id: 'trap_low', name: 'Czworoboczny – część wstępująca (dolna)', latin: 'trapezius, pars ascendens', group: 'Plecy',
    bone: 'torso', pos: [0.042, 0.28, -0.103], r: [0.03, 0.06, 0.022], rot: [0, 0, 0.35], mirror: true },
  { id: 'latissimus', name: 'Najszerszy grzbietu', latin: 'latissimus dorsi', group: 'Plecy',
    bone: 'torso', pos: [0.105, 0.225, -0.072], r: [0.068, 0.13, 0.038], rot: [0, -0.25, 0.25], mirror: true },

  // --- Ramię ---
  { id: 'biceps', name: 'Dwugłowy ramienia (biceps)', latin: 'biceps brachii', group: 'Przód ramienia',
    bone: 'upperArm', pos: [0, -0.17, 0.04], r: [0.035, 0.095, 0.032], shape: 'spindle', mirror: true },
  { id: 'brachialis', name: 'Ramienny', latin: 'brachialis', group: 'Przód ramienia',
    bone: 'upperArm', pos: [0.033, -0.215, 0.018], r: [0.022, 0.07, 0.024], shape: 'spindle', mirror: true },
  { id: 'triceps_long', name: 'Trójgłowy – głowa długa', latin: 'triceps brachii, caput longum', group: 'Tył ramienia',
    bone: 'upperArm', pos: [-0.016, -0.15, -0.042], r: [0.03, 0.115, 0.03], shape: 'spindle', mirror: true },
  { id: 'triceps_lat', name: 'Trójgłowy – głowa boczna', latin: 'triceps brachii, caput laterale', group: 'Tył ramienia',
    bone: 'upperArm', pos: [0.026, -0.125, -0.034], r: [0.027, 0.09, 0.028], shape: 'spindle', mirror: true },

  // --- Przedramię ---
  { id: 'brachioradialis', name: 'Ramienno-promieniowy', latin: 'brachioradialis', group: 'Przedramiona',
    bone: 'forearm', pos: [0.03, -0.065, 0.018], r: [0.024, 0.085, 0.024], shape: 'tearUp', mirror: true },
  { id: 'forearm_flex', name: 'Zginacze nadgarstka', latin: 'flexor carpi radialis / ulnaris', group: 'Przedramiona',
    bone: 'forearm', pos: [-0.012, -0.1, 0.027], r: [0.027, 0.095, 0.022], shape: 'tearUp', mirror: true },
  { id: 'forearm_ext', name: 'Prostowniki nadgarstka', latin: 'extensor carpi radialis / ulnaris', group: 'Przedramiona',
    bone: 'forearm', pos: [0.005, -0.1, -0.028], r: [0.027, 0.095, 0.022], shape: 'tearUp', mirror: true },

  // --- Core ---
  { id: 'rectus_abdominis', name: 'Prosty brzucha', latin: 'rectus abdominis', group: 'Core', bone: 'torso', mirror: true,
    parts: [
      { pos: [0.034, 0.245, 0.086], r: [0.03, 0.03, 0.02] },
      { pos: [0.034, 0.18, 0.093], r: [0.03, 0.03, 0.02] },
      { pos: [0.034, 0.115, 0.097], r: [0.031, 0.031, 0.02] },
      { pos: [0.032, 0.04, 0.088], r: [0.028, 0.042, 0.02] },
    ] },
  { id: 'obliques', name: 'Skośny zewnętrzny brzucha', latin: 'obliquus externus abdominis', group: 'Core',
    bone: 'torso', pos: [0.112, 0.12, 0.048], r: [0.034, 0.095, 0.06], rot: [0, 0.4, 0.15], mirror: true },
  { id: 'iliopsoas', name: 'Biodrowo-lędźwiowy', latin: 'iliopsoas', group: 'Core', deep: true },

  // --- Dolny grzbiet ---
  { id: 'erector_spinae', name: 'Prostownik grzbietu', latin: 'erector spinae', group: 'Dolny grzbiet',
    bone: 'torso', pos: [0.04, 0.13, -0.088], r: [0.028, 0.16, 0.026], shape: 'spindle', mirror: true },

  // --- Pośladki ---
  { id: 'glute_max', name: 'Pośladkowy wielki', latin: 'gluteus maximus', group: 'Pośladki',
    bone: 'pelvis', pos: [0.078, -0.03, -0.088], r: [0.085, 0.095, 0.06], mirror: true },
  { id: 'glute_med', name: 'Pośladkowy średni', latin: 'gluteus medius', group: 'Pośladki',
    bone: 'pelvis', pos: [0.128, 0.05, -0.03], r: [0.045, 0.055, 0.05], rot: [0, 0, -0.3], mirror: true },

  // --- Przód uda (czworogłowy) ---
  { id: 'rectus_femoris', name: 'Czworogłowy – mięsień prosty uda', latin: 'rectus femoris', group: 'Przód uda',
    bone: 'thigh', pos: [0.006, -0.2, 0.062], r: [0.032, 0.17, 0.028], shape: 'spindle', mirror: true },
  { id: 'vastus_lateralis', name: 'Czworogłowy – obszerny boczny', latin: 'vastus lateralis', group: 'Przód uda',
    bone: 'thigh', pos: [0.05, -0.22, 0.022], r: [0.034, 0.175, 0.04], shape: 'spindle', mirror: true },
  { id: 'vastus_medialis', name: 'Czworogłowy – obszerny przyśrodkowy', latin: 'vastus medialis', group: 'Przód uda',
    bone: 'thigh', pos: [-0.036, -0.31, 0.042], r: [0.034, 0.09, 0.034], shape: 'tear', mirror: true },
  { id: 'vastus_intermedius', name: 'Czworogłowy – obszerny pośredni', latin: 'vastus intermedius', group: 'Przód uda', deep: true },

  // --- Tył uda ---
  { id: 'biceps_femoris', name: 'Dwugłowy uda', latin: 'biceps femoris', group: 'Tył uda',
    bone: 'thigh', pos: [0.03, -0.22, -0.05], r: [0.032, 0.17, 0.034], shape: 'spindle', mirror: true },
  { id: 'semitendinosus', name: 'Półścięgnisty i półbłoniasty', latin: 'semitendinosus, semimembranosus', group: 'Tył uda',
    bone: 'thigh', pos: [-0.03, -0.23, -0.05], r: [0.032, 0.17, 0.034], shape: 'spindle', mirror: true },

  // --- Przywodziciele ---
  { id: 'adductors', name: 'Przywodziciele uda', latin: 'adductor magnus, longus, brevis', group: 'Przywodziciele',
    bone: 'thigh', pos: [-0.05, -0.12, 0.005], r: [0.028, 0.12, 0.045], shape: 'tearUp', mirror: true },

  // --- Podudzie ---
  { id: 'gastroc_med', name: 'Brzuchaty łydki – głowa przyśrodkowa', latin: 'gastrocnemius, caput mediale', group: 'Podudzie',
    bone: 'shin', pos: [-0.022, -0.11, -0.043], r: [0.027, 0.095, 0.03], shape: 'tearUp', mirror: true },
  { id: 'gastroc_lat', name: 'Brzuchaty łydki – głowa boczna', latin: 'gastrocnemius, caput laterale', group: 'Podudzie',
    bone: 'shin', pos: [0.023, -0.1, -0.04], r: [0.024, 0.085, 0.028], shape: 'tearUp', mirror: true },
  { id: 'soleus', name: 'Płaszczkowaty', latin: 'soleus', group: 'Podudzie',
    bone: 'shin', pos: [0, -0.25, -0.03], r: [0.042, 0.09, 0.03], shape: 'spindle', mirror: true },
  { id: 'tibialis_ant', name: 'Piszczelowy przedni', latin: 'tibialis anterior', group: 'Podudzie',
    bone: 'shin', pos: [0.02, -0.16, 0.042], r: [0.021, 0.125, 0.02], shape: 'tearUp', mirror: true },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
