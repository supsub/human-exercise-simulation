// Katalog ćwiczeń do planu treningowego.
// muscles: udział mięśnia w ćwiczeniu – 1 = główny, 0.5–0.75 = pomocniczy, 0.25 = stabilizujący.
// "Efektywne serie" mięśnia = serie × udział (tak liczymy tygodniową objętość).
// animated: id ćwiczenia z animacją 3D w symulacji (jeśli jest).

export const CATEGORIES = ['Klatka', 'Plecy', 'Barki', 'Ramiona', 'Nogi', 'Pośladki', 'Core'];

export const CATALOG = [
  // --- Klatka ---
  { id: 'pushup', name: 'Pompki', category: 'Klatka', equipment: 'masa ciała', animated: 'pushup',
    muscles: { pec_stern: 1, pec_clav: 0.75, triceps_lat: 0.75, triceps_long: 0.5, delt_ant: 0.75, serratus: 0.5, rectus_abdominis: 0.25, obliques: 0.25 } },
  { id: 'bench', name: 'Wyciskanie sztangi leżąc', category: 'Klatka', equipment: 'sztanga',
    muscles: { pec_stern: 1, pec_clav: 0.5, delt_ant: 0.75, triceps_lat: 0.75, triceps_long: 0.5, serratus: 0.25 } },
  { id: 'incline_db', name: 'Wyciskanie hantli na skosie', category: 'Klatka', equipment: 'hantle',
    muscles: { pec_clav: 1, pec_stern: 0.5, delt_ant: 0.75, triceps_lat: 0.5, triceps_long: 0.25 } },
  { id: 'dips', name: 'Pompki na poręczach (dipy)', category: 'Klatka', equipment: 'poręcze',
    muscles: { triceps_lat: 1, triceps_long: 0.75, pec_stern: 0.75, delt_ant: 0.75 } },
  { id: 'fly', name: 'Rozpiętki z hantlami', category: 'Klatka', equipment: 'hantle',
    muscles: { pec_stern: 1, pec_clav: 0.75, delt_ant: 0.5, biceps: 0.25 } },

  // --- Plecy ---
  { id: 'pullup', name: 'Podciąganie na drążku', category: 'Plecy', equipment: 'drążek',
    muscles: { latissimus: 1, biceps: 0.75, brachialis: 0.75, brachioradialis: 0.5, trap_low: 0.5, trap_mid: 0.25, delt_post: 0.25, forearm_flex: 0.5, rectus_abdominis: 0.25 } },
  { id: 'lat_pulldown', name: 'Ściąganie drążka wyciągu', category: 'Plecy', equipment: 'wyciąg',
    muscles: { latissimus: 1, biceps: 0.5, brachialis: 0.5, trap_low: 0.5, delt_post: 0.25, forearm_flex: 0.25 } },
  { id: 'row', name: 'Wiosłowanie sztangą', category: 'Plecy', equipment: 'sztanga',
    muscles: { trap_mid: 1, latissimus: 0.75, delt_post: 0.75, biceps: 0.5, brachialis: 0.5, erector_spinae: 0.5, trap_low: 0.25, brachioradialis: 0.25, forearm_flex: 0.25 } },
  { id: 'db_row', name: 'Wiosłowanie hantlem jednorącz', category: 'Plecy', equipment: 'hantle',
    muscles: { latissimus: 1, trap_mid: 0.75, delt_post: 0.5, biceps: 0.5, brachialis: 0.5, obliques: 0.25 } },
  { id: 'face_pull', name: 'Face pull (przyciąganie liny do twarzy)', category: 'Plecy', equipment: 'wyciąg',
    muscles: { delt_post: 1, trap_mid: 0.75, trap_low: 0.5, delt_lat: 0.25 } },
  { id: 'shrug', name: 'Szrugsy (unoszenie barków)', category: 'Plecy', equipment: 'hantle',
    muscles: { trap_upper: 1, forearm_flex: 0.25 } },
  { id: 'back_ext', name: 'Wyprosty tułowia na ławce rzymskiej', category: 'Plecy', equipment: 'ławka',
    muscles: { erector_spinae: 1, glute_max: 0.75, biceps_femoris: 0.5, semitendinosus: 0.5 } },

  // --- Barki ---
  { id: 'ohp', name: 'Wyciskanie nad głowę', category: 'Barki', equipment: 'sztanga',
    muscles: { delt_ant: 1, delt_lat: 0.75, triceps_lat: 0.75, triceps_long: 0.5, trap_upper: 0.5, serratus: 0.5, pec_clav: 0.25, rectus_abdominis: 0.25 } },
  { id: 'lateral_raise', name: 'Unoszenie hantli bokiem', category: 'Barki', equipment: 'hantle',
    muscles: { delt_lat: 1, trap_upper: 0.5, delt_ant: 0.25 } },
  { id: 'reverse_fly', name: 'Odwrotne rozpiętki w opadzie', category: 'Barki', equipment: 'hantle',
    muscles: { delt_post: 1, trap_mid: 0.75, trap_low: 0.25 } },

  // --- Ramiona ---
  { id: 'curl', name: 'Uginanie przedramion z hantlami', category: 'Ramiona', equipment: 'hantle', animated: 'curl',
    muscles: { biceps: 1, brachialis: 0.75, brachioradialis: 0.5, forearm_flex: 0.5, delt_ant: 0.1 } },
  { id: 'hammer', name: 'Uginanie młotkowe', category: 'Ramiona', equipment: 'hantle',
    muscles: { brachioradialis: 1, brachialis: 1, biceps: 0.5, forearm_ext: 0.25 } },
  { id: 'triceps_oh', name: 'Prostowanie ramion nad głową', category: 'Ramiona', equipment: 'hantle',
    muscles: { triceps_long: 1, triceps_lat: 0.5 } },
  { id: 'pushdown', name: 'Prostowanie ramion na wyciągu', category: 'Ramiona', equipment: 'wyciąg',
    muscles: { triceps_lat: 1, triceps_long: 0.5, forearm_ext: 0.25 } },
  { id: 'wrist_curl', name: 'Uginanie nadgarstków', category: 'Ramiona', equipment: 'hantle',
    muscles: { forearm_flex: 1 } },
  { id: 'reverse_curl', name: 'Uginanie nachwytem (odwrotne)', category: 'Ramiona', equipment: 'sztanga',
    muscles: { brachioradialis: 1, forearm_ext: 1, brachialis: 0.75, biceps: 0.25 } },

  // --- Nogi ---
  { id: 'squat', name: 'Przysiad', category: 'Nogi', equipment: 'masa ciała', animated: 'squat',
    muscles: { vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1, rectus_femoris: 0.75, glute_max: 0.75, adductors: 0.5, erector_spinae: 0.25, soleus: 0.25, biceps_femoris: 0.25, semitendinosus: 0.25 } },
  { id: 'deadlift', name: 'Martwy ciąg', category: 'Nogi', equipment: 'sztanga',
    muscles: { glute_max: 1, erector_spinae: 1, biceps_femoris: 0.75, semitendinosus: 0.75, vastus_lateralis: 0.5, vastus_medialis: 0.5, vastus_intermedius: 0.5, adductors: 0.5, trap_upper: 0.5, forearm_flex: 0.75, latissimus: 0.25, trap_mid: 0.25, rectus_femoris: 0.25 } },
  { id: 'rdl', name: 'Rumuński martwy ciąg', category: 'Nogi', equipment: 'sztanga',
    muscles: { biceps_femoris: 1, semitendinosus: 1, glute_max: 0.75, erector_spinae: 0.75, adductors: 0.5, forearm_flex: 0.5 } },
  { id: 'lunge', name: 'Wykroki', category: 'Nogi', equipment: 'hantle',
    muscles: { vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1, glute_max: 1, rectus_femoris: 0.5, glute_med: 0.5, adductors: 0.5, biceps_femoris: 0.25, semitendinosus: 0.25 } },
  { id: 'leg_ext', name: 'Prostowanie nóg na maszynie', category: 'Nogi', equipment: 'maszyna',
    muscles: { rectus_femoris: 1, vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1 } },
  { id: 'leg_curl', name: 'Uginanie nóg leżąc', category: 'Nogi', equipment: 'maszyna',
    muscles: { biceps_femoris: 1, semitendinosus: 1, gastroc_med: 0.5, gastroc_lat: 0.5 } },
  { id: 'adductor', name: 'Przywodzenie nóg na maszynie', category: 'Nogi', equipment: 'maszyna',
    muscles: { adductors: 1 } },
  { id: 'calf_raise', name: 'Wspięcia na palce stojąc', category: 'Nogi', equipment: 'masa ciała',
    muscles: { gastroc_med: 1, gastroc_lat: 1, soleus: 0.75 } },
  { id: 'seated_calf', name: 'Wspięcia na palce siedząc', category: 'Nogi', equipment: 'maszyna',
    muscles: { soleus: 1, gastroc_med: 0.25, gastroc_lat: 0.25 } },
  { id: 'tib_raise', name: 'Unoszenie palców stóp (tibialis raise)', category: 'Nogi', equipment: 'masa ciała',
    muscles: { tibialis_ant: 1 } },

  // --- Pośladki ---
  { id: 'hip_thrust', name: 'Hip thrust (wypychanie bioder)', category: 'Pośladki', equipment: 'sztanga',
    muscles: { glute_max: 1, glute_med: 0.5, biceps_femoris: 0.5, semitendinosus: 0.5, adductors: 0.25 } },
  { id: 'band_walk', name: 'Chodzenie bokiem z gumą', category: 'Pośladki', equipment: 'guma',
    muscles: { glute_med: 1, glute_max: 0.25 } },

  // --- Core ---
  { id: 'plank', name: 'Deska (plank)', category: 'Core', equipment: 'masa ciała',
    muscles: { rectus_abdominis: 1, obliques: 0.75, serratus: 0.25, delt_ant: 0.25, glute_max: 0.25, rectus_femoris: 0.25, iliopsoas: 0.25 } },
  { id: 'side_plank', name: 'Deska bokiem', category: 'Core', equipment: 'masa ciała',
    muscles: { obliques: 1, glute_med: 0.75, rectus_abdominis: 0.25, delt_lat: 0.25 } },
  { id: 'crunch', name: 'Spięcia brzucha', category: 'Core', equipment: 'masa ciała',
    muscles: { rectus_abdominis: 1, obliques: 0.5 } },
  { id: 'leg_raise', name: 'Unoszenie nóg w zwisie', category: 'Core', equipment: 'drążek',
    muscles: { iliopsoas: 1, rectus_abdominis: 1, obliques: 0.5, rectus_femoris: 0.5, forearm_flex: 0.5, latissimus: 0.25 } },
  { id: 'farmer', name: 'Spacer farmera', category: 'Core', equipment: 'hantle',
    muscles: { forearm_flex: 1, trap_upper: 0.75, forearm_ext: 0.5, obliques: 0.5, rectus_abdominis: 0.25, glute_med: 0.25 } },
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((e) => [e.id, e]));
