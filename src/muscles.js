// Definicje mięśni: nazwa, grupa i umiejscowienie na manekinie.
// bone: do której części szkieletu przyczepiony jest mięsień
//   'pelvis' | 'torso' | 'upperArm' | 'forearm' | 'thigh' | 'shin'
// pos / r: pozycja i promienie elipsoidy w lokalnym układzie kości
//   (dla kończyn: współrzędne strony LEWEJ, x > 0 = na zewnątrz)
// mirror: tworzymy też kopię po prawej stronie
// Układ: Y w górę, +Z = przód ciała, +X = lewa strona postaci.

export const MUSCLES = [
  // --- Górna część ciała ---
  { id: 'pectoralis', name: 'Piersiowy większy', latin: 'pectoralis major', group: 'Klatka i barki',
    bone: 'torso', pos: [0.085, 0.355, 0.088], r: [0.085, 0.07, 0.04], rot: [0, 0.25, -0.15], mirror: true },
  { id: 'deltoid_ant', name: 'Naramienny – część przednia', latin: 'deltoideus (pars clavicularis)', group: 'Klatka i barki',
    bone: 'upperArm', pos: [0.01, -0.045, 0.035], r: [0.05, 0.085, 0.035], mirror: true },
  { id: 'deltoid_post', name: 'Naramienny – część tylna', latin: 'deltoideus (pars spinalis)', group: 'Plecy',
    bone: 'upperArm', pos: [0.01, -0.045, -0.035], r: [0.05, 0.085, 0.035], mirror: true },
  { id: 'serratus', name: 'Zębaty przedni', latin: 'serratus anterior', group: 'Klatka i barki',
    bone: 'torso', pos: [0.145, 0.25, 0.045], r: [0.032, 0.075, 0.05], mirror: true },
  { id: 'trapezius', name: 'Czworoboczny (kaptur)', latin: 'trapezius', group: 'Plecy',
    bone: 'torso', pos: [0, 0.39, -0.07], r: [0.16, 0.085, 0.04], mirror: false },
  { id: 'latissimus', name: 'Najszerszy grzbietu', latin: 'latissimus dorsi', group: 'Plecy',
    bone: 'torso', pos: [0.105, 0.24, -0.072], r: [0.075, 0.13, 0.04], rot: [0, 0, 0.2], mirror: true },

  // --- Ramiona ---
  { id: 'biceps', name: 'Dwugłowy ramienia (biceps)', latin: 'biceps brachii', group: 'Ramiona',
    bone: 'upperArm', pos: [0, -0.175, 0.038], r: [0.038, 0.09, 0.035], mirror: true },
  { id: 'triceps', name: 'Trójgłowy ramienia (triceps)', latin: 'triceps brachii', group: 'Ramiona',
    bone: 'upperArm', pos: [0, -0.16, -0.04], r: [0.042, 0.11, 0.035], mirror: true },
  { id: 'forearm_flex', name: 'Zginacze przedramienia', latin: 'brachioradialis, flexores', group: 'Ramiona',
    bone: 'forearm', pos: [0, -0.085, 0.022], r: [0.038, 0.09, 0.03], mirror: true },

  // --- Core ---
  { id: 'rectus_abdominis', name: 'Prosty brzucha', latin: 'rectus abdominis', group: 'Core',
    bone: 'torso', pos: [0, 0.15, 0.085], r: [0.07, 0.15, 0.035], mirror: false },
  { id: 'obliques', name: 'Skośne brzucha', latin: 'obliquus externus abdominis', group: 'Core',
    bone: 'torso', pos: [0.115, 0.12, 0.04], r: [0.04, 0.1, 0.065], mirror: true },
  { id: 'erector_spinae', name: 'Prostownik grzbietu', latin: 'erector spinae', group: 'Core',
    bone: 'torso', pos: [0.04, 0.12, -0.085], r: [0.034, 0.16, 0.03], mirror: true },

  // --- Nogi ---
  { id: 'gluteus', name: 'Pośladkowy wielki', latin: 'gluteus maximus', group: 'Nogi',
    bone: 'pelvis', pos: [0.08, -0.02, -0.085], r: [0.088, 0.1, 0.06], mirror: true },
  { id: 'quadriceps', name: 'Czworogłowy uda', latin: 'quadriceps femoris', group: 'Nogi',
    bone: 'thigh', pos: [0.005, -0.2, 0.045], r: [0.068, 0.19, 0.05], mirror: true },
  { id: 'hamstrings', name: 'Kulszowo-goleniowe', latin: 'biceps femoris, semitendinosus', group: 'Nogi',
    bone: 'thigh', pos: [0, -0.22, -0.045], r: [0.058, 0.18, 0.045], mirror: true },
  { id: 'adductors', name: 'Przywodziciele uda', latin: 'adductor magnus, longus', group: 'Nogi',
    bone: 'thigh', pos: [-0.042, -0.12, 0], r: [0.035, 0.12, 0.05], mirror: true },
  { id: 'gastrocnemius', name: 'Brzuchaty łydki', latin: 'gastrocnemius', group: 'Nogi',
    bone: 'shin', pos: [0, -0.12, -0.038], r: [0.048, 0.11, 0.042], mirror: true },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
