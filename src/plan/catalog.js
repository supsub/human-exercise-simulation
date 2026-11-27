// Katalog ćwiczeń do planu treningowego.
// muscles: udział mięśnia w ćwiczeniu – 1 = główny, 0.5–0.75 = pomocniczy, 0.25 = stabilizujący.
// "Efektywne serie" mięśnia = serie × udział (tak liczymy tygodniową objętość).
// animated: id ćwiczenia z animacją 3D w symulacji (jeśli jest).
// measure: jak mierzymy serię – 'reps' (powtórzenia, domyślnie) albo 'time' (sekundy, np. deska);
//   w planie pole `reps` pozycji treningu to „ilość na serię” w tej jednostce (powtórzenia albo sekundy).
// repsLabel: własna nazwa powtórzeń (np. kroki); amount: domyślna ilość na serię przy dodawaniu.

export const CATEGORIES = ['Klatka', 'Plecy', 'Barki', 'Ramiona', 'Nogi', 'Pośladki', 'Core'];

export const CATALOG = [
  // --- Klatka ---
  { id: 'pushup', name: 'Pompki', category: 'Klatka', equipment: 'masa ciała', animated: 'pushup',
    muscles: { pec_stern: 1, pec_clav: 0.75, triceps_lat: 0.75, triceps_long: 0.5, delt_ant: 0.75, serratus: 0.5, rectus_abdominis: 0.25, obliques: 0.25 } },
  { id: 'bench', name: 'Wyciskanie sztangi leżąc', category: 'Klatka', equipment: 'sztanga',
    muscles: { pec_stern: 1, pec_clav: 0.5, delt_ant: 0.75, triceps_lat: 0.75, triceps_long: 0.5, serratus: 0.25 } },
  { id: 'db_bench', name: 'Wyciskanie hantli na ławce płaskiej', category: 'Klatka', equipment: 'hantle',
    muscles: { pec_stern: 1, pec_clav: 0.5, delt_ant: 0.75, triceps_lat: 0.5, triceps_long: 0.25, serratus: 0.25 } },
  { id: 'incline_db', name: 'Wyciskanie hantli na skosie', category: 'Klatka', equipment: 'hantle',
    muscles: { pec_clav: 1, pec_stern: 0.5, delt_ant: 0.75, triceps_lat: 0.5, triceps_long: 0.25 } },
  { id: 'dips', name: 'Pompki na poręczach (dipy)', category: 'Klatka', equipment: 'poręcze',
    muscles: { triceps_lat: 1, triceps_long: 0.75, pec_stern: 0.75, delt_ant: 0.75 } },
  { id: 'fly', name: 'Rozpiętki z hantlami', category: 'Klatka', equipment: 'hantle',
    muscles: { pec_stern: 1, pec_clav: 0.75, delt_ant: 0.5, biceps: 0.25 } },
  { id: 'cable_fly', name: 'Rozpiętki na wyciągu', category: 'Klatka', equipment: 'wyciąg',
    muscles: { pec_stern: 1, pec_clav: 0.75, delt_ant: 0.5, serratus: 0.25, biceps: 0.25 } },

  // --- Plecy ---
  { id: 'pullup', name: 'Podciąganie na drążku', category: 'Plecy', equipment: 'drążek',
    muscles: { latissimus: 1, biceps: 0.75, brachialis: 0.75, brachioradialis: 0.5, trap_low: 0.5, trap_mid: 0.25, delt_post: 0.25, forearm_flex: 0.5, rectus_abdominis: 0.25 } },
  { id: 'lat_pulldown', name: 'Ściąganie drążka wyciągu', category: 'Plecy', equipment: 'wyciąg',
    muscles: { latissimus: 1, biceps: 0.5, brachialis: 0.5, trap_low: 0.5, delt_post: 0.25, forearm_flex: 0.25 } },
  { id: 'lat_pulldown_wide', name: 'Ściąganie drążka wyciągu (szeroki chwyt)', category: 'Plecy', equipment: 'wyciąg',
    muscles: { latissimus: 1, trap_low: 0.75, trap_mid: 0.5, delt_post: 0.5, brachialis: 0.5, biceps: 0.25, brachioradialis: 0.25 } },
  { id: 'row', name: 'Wiosłowanie sztangą', category: 'Plecy', equipment: 'sztanga',
    muscles: { trap_mid: 1, latissimus: 0.75, delt_post: 0.75, biceps: 0.5, brachialis: 0.5, erector_spinae: 0.5, trap_low: 0.25, brachioradialis: 0.25, forearm_flex: 0.25 } },
  { id: 'db_row', name: 'Wiosłowanie hantlem z podparciem (jednorącz)', category: 'Plecy', equipment: 'hantle',
    muscles: { latissimus: 1, trap_mid: 0.75, delt_post: 0.5, biceps: 0.5, brachialis: 0.5, obliques: 0.25 } },
  { id: 'cable_row', name: 'Wiosłowanie na wyciągu (siedząc)', category: 'Plecy', equipment: 'wyciąg',
    muscles: { latissimus: 1, trap_mid: 0.75, delt_post: 0.5, biceps: 0.5, brachialis: 0.5, brachioradialis: 0.25, erector_spinae: 0.25, trap_low: 0.25 } },
  { id: 'incline_row', name: 'Wiosłowanie hantlami na ławce skośnej', category: 'Plecy', equipment: 'hantle',
    muscles: { trap_mid: 1, latissimus: 0.75, delt_post: 0.75, trap_low: 0.5, biceps: 0.5, brachialis: 0.5 } },
  { id: 'face_pull', name: 'Face pull (przyciąganie liny do twarzy)', category: 'Plecy', equipment: 'wyciąg',
    muscles: { delt_post: 1, trap_mid: 0.75, trap_low: 0.5, delt_lat: 0.25 } },
  { id: 'shrug', name: 'Szrugsy (unoszenie barków)', category: 'Plecy', equipment: 'hantle',
    muscles: { trap_upper: 1, forearm_flex: 0.25 } },
  { id: 'back_ext', name: 'Wyprosty tułowia na ławce rzymskiej', category: 'Plecy', equipment: 'ławka',
    muscles: { erector_spinae: 1, glute_max: 0.75, biceps_femoris: 0.5, semitendinosus: 0.5 } },

  // --- Barki ---
  { id: 'ohp', name: 'Wyciskanie sztangi nad głowę', category: 'Barki', equipment: 'sztanga',
    muscles: { delt_ant: 1, delt_lat: 0.75, triceps_lat: 0.75, triceps_long: 0.5, trap_upper: 0.5, serratus: 0.5, pec_clav: 0.25, rectus_abdominis: 0.25 } },
  { id: 'db_ohp', name: 'Wyciskanie hantli nad głowę', category: 'Barki', equipment: 'hantle',
    muscles: { delt_ant: 1, delt_lat: 0.75, triceps_lat: 0.5, triceps_long: 0.5, trap_upper: 0.5, serratus: 0.25, rectus_abdominis: 0.25 } },
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
  { id: 'front_squat', name: 'Przysiad frontowy', category: 'Nogi', equipment: 'sztanga',
    muscles: { vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1, rectus_femoris: 0.5, glute_max: 0.5, adductors: 0.5, erector_spinae: 0.5, rectus_abdominis: 0.5, obliques: 0.25, trap_upper: 0.25 } },
  { id: 'goblet_squat', name: 'Goblet squat (przysiad z hantlem)', category: 'Nogi', equipment: 'hantle',
    muscles: { vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1, rectus_femoris: 0.5, glute_max: 0.75, adductors: 0.5, erector_spinae: 0.25, rectus_abdominis: 0.25, soleus: 0.25 } },
  { id: 'leg_press', name: 'Wypychanie nóg na suwnicy', category: 'Nogi', equipment: 'maszyna',
    muscles: { vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1, glute_max: 0.75, adductors: 0.5, rectus_femoris: 0.5, biceps_femoris: 0.25, semitendinosus: 0.25 } },
  { id: 'deadlift', name: 'Martwy ciąg', category: 'Nogi', equipment: 'sztanga',
    muscles: { glute_max: 1, erector_spinae: 1, biceps_femoris: 0.75, semitendinosus: 0.75, vastus_lateralis: 0.5, vastus_medialis: 0.5, vastus_intermedius: 0.5, adductors: 0.5, trap_upper: 0.5, forearm_flex: 0.75, latissimus: 0.25, trap_mid: 0.25, rectus_femoris: 0.25 } },
  { id: 'rdl', name: 'Rumuński martwy ciąg', category: 'Nogi', equipment: 'sztanga',
    muscles: { biceps_femoris: 1, semitendinosus: 1, glute_max: 0.75, erector_spinae: 0.75, adductors: 0.5, forearm_flex: 0.5 } },
  { id: 'db_rdl', name: 'Rumuński martwy ciąg z hantlami', category: 'Nogi', equipment: 'hantle',
    muscles: { biceps_femoris: 1, semitendinosus: 1, glute_max: 0.75, erector_spinae: 0.75, adductors: 0.5, forearm_flex: 0.5, trap_upper: 0.25 } },
  { id: 'lunge', name: 'Wykroki', category: 'Nogi', equipment: 'hantle',
    muscles: { vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1, glute_max: 1, rectus_femoris: 0.5, glute_med: 0.5, adductors: 0.5, biceps_femoris: 0.25, semitendinosus: 0.25 } },
  { id: 'leg_ext', name: 'Prostowanie nóg na maszynie', category: 'Nogi', equipment: 'maszyna',
    muscles: { rectus_femoris: 1, vastus_lateralis: 1, vastus_medialis: 1, vastus_intermedius: 1 } },
  { id: 'leg_curl', name: 'Uginanie nóg na maszynie leżąc', category: 'Nogi', equipment: 'maszyna',
    muscles: { biceps_femoris: 1, semitendinosus: 1, gastroc_med: 0.5, gastroc_lat: 0.5 } },
  { id: 'adductor', name: 'Przywodzenie nóg na maszynie', category: 'Nogi', equipment: 'maszyna',
    muscles: { adductors: 1 }, tags: 'przywodziciele biodro biodra hip adduction' },
  { id: 'abductor', name: 'Odwodzenie nóg na maszynie', category: 'Pośladki', equipment: 'maszyna',
    muscles: { glute_med: 1, glute_max: 0.5 }, tags: 'odwodziciele abduktory biodro biodra hip abduction' },
  { id: 'calf_raise', name: 'Wspięcia na palce stojąc', category: 'Nogi', equipment: 'masa ciała',
    muscles: { gastroc_med: 1, gastroc_lat: 1, soleus: 0.75 } },
  { id: 'seated_calf', name: 'Wspięcia na palce siedząc', category: 'Nogi', equipment: 'maszyna',
    muscles: { soleus: 1, gastroc_med: 0.25, gastroc_lat: 0.25 } },
  { id: 'tib_raise', name: 'Unoszenie palców stóp (tibialis raise)', category: 'Nogi', equipment: 'masa ciała',
    muscles: { tibialis_ant: 1 } },

  // --- Pośladki ---
  { id: 'hip_thrust', name: 'Hip thrust (wypychanie bioder)', category: 'Pośladki', equipment: 'sztanga',
    muscles: { glute_max: 1, glute_med: 0.5, biceps_femoris: 0.5, semitendinosus: 0.5, adductors: 0.25 } },
  { id: 'band_walk', name: 'Chodzenie bokiem z gumą', category: 'Pośladki', equipment: 'guma', repsLabel: 'kroków', amount: 12,
    muscles: { glute_med: 1, glute_max: 0.25 }, tags: 'odwodziciele abduktory biodro biodra hip abduction' },

  // --- Core ---
  { id: 'plank', name: 'Deska (plank)', category: 'Core', equipment: 'masa ciała', measure: 'time', amount: 30,
    muscles: { rectus_abdominis: 1, obliques: 0.75, serratus: 0.25, delt_ant: 0.25, glute_max: 0.25, rectus_femoris: 0.25, iliopsoas: 0.25 } },
  { id: 'side_plank', name: 'Deska bokiem', category: 'Core', equipment: 'masa ciała', measure: 'time', amount: 30,
    muscles: { obliques: 1, glute_med: 0.75, rectus_abdominis: 0.25, delt_lat: 0.25 } },
  { id: 'crunch', name: 'Spięcia brzucha', category: 'Core', equipment: 'masa ciała',
    muscles: { rectus_abdominis: 1, obliques: 0.5 } },
  { id: 'leg_raise', name: 'Unoszenie nóg w zwisie', category: 'Core', equipment: 'drążek',
    muscles: { iliopsoas: 1, rectus_abdominis: 1, obliques: 0.5, rectus_femoris: 0.5, forearm_flex: 0.5, latissimus: 0.25 } },
  { id: 'farmer', name: 'Spacer farmera', category: 'Core', equipment: 'hantle', measure: 'time', amount: 40,
    muscles: { forearm_flex: 1, trap_upper: 0.75, forearm_ext: 0.5, obliques: 0.5, rectus_abdominis: 0.25, glute_med: 0.25 } },
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((e) => [e.id, e]));

// Krótkie opisy dla laika: jak wykonać i na co uważać (pokazywane w szczegółach ćwiczenia).
const INFO = {
  db_rdl: ['Z hantlami przed udami cofasz biodra i pochylasz się z prostymi plecami, hantle suną wzdłuż nóg, potem wracasz do wyprostu.', 'Hantle blisko nóg przez cały ruch, kolana lekko ugięte i nieruchome.'],
  db_bench: ['Leżąc na płaskiej ławce wypychasz hantle znad klatki w górę i opuszczasz je do boków klatki.', 'Hantle pozwalają na większy zakres ruchu niż sztanga – nie opuszczaj ich jednak niżej niż linia barków.'],
  cable_fly: ['Stojąc między wyciągami prowadzisz lekko ugięte ręce łukiem od boków do przodu, przed klatkę.', 'Łokcie cały czas lekko ugięte, ruch w barkach, nie w łokciach.'],
  lat_pulldown_wide: ['Siedząc przy wyciągu ściągasz szeroko chwycony drążek do górnej części klatki, łokcie idą w dół i na boki.', 'Nie ściągaj drążka za głowę – to obciąża barki.'],
  cable_row: ['Siedząc ze stopami opartymi o platformę przyciągasz uchwyt wyciągu do brzucha.', 'Tułów nieruchomy i wyprostowany – ciągnij łopatkami i łokciami, nie bujaj się.'],
  incline_row: ['Leżąc klatką na ławce ustawionej skośnie przyciągasz hantle do boków tułowia.', 'Ławka odciąża dolny odcinek pleców – skup się na ściąganiu łopatek.'],
  db_ohp: ['Stojąc lub siedząc wypychasz hantle znad barków nad głowę.', 'Napnij brzuch, nie odchylaj się do tyłu.'],
  front_squat: ['Przysiad ze sztangą trzymaną z przodu na barkach, łokcie wysoko.', 'Tułów zostaje bardziej pionowy niż w zwykłym przysiadzie – łokcie wysoko przez cały ruch.'],
  goblet_squat: ['Przysiad z hantlem trzymanym pionowo przy klatce.', 'Ciężar z przodu pomaga utrzymać wyprostowane plecy – dobry wybór na start.'],
  leg_press: ['Siedząc na suwnicy uginasz nogi, opuszczając platformę, i wypychasz ją z powrotem.', 'Nie prostuj kolan do końca na górze i nie odrywaj bioder od oparcia na dole.'],
  pushup: ['Podpór na dłoniach, ciało proste jak deska. Opuszczasz klatkę prawie do podłogi i wypychasz się w górę.', 'Nie pozwól biodrom opadać, łokcie prowadź blisko tułowia.'],
  bench: ['Leżąc na ławce opuszczasz sztangę do dolnej części klatki i wypychasz ją w górę.', 'Łopatki ściągnięte i wciśnięte w ławkę, stopy stabilnie na podłodze.'],
  incline_db: ['Na ławce ustawionej skośnie (ok. 30°) wypychasz hantle znad klatki w górę.', 'Zbyt stromy skos przerzuca pracę na barki.'],
  dips: ['W podporze na poręczach opuszczasz ciało, zginając łokcie, i wypychasz się w górę.', 'Nie schodź za nisko, jeśli czujesz ból z przodu barku.'],
  fly: ['Leżąc na ławce rozkładasz lekko ugięte ręce z hantlami na boki i łączysz je nad klatką.', 'Ruch kontrolowany, łokcie cały czas lekko ugięte.'],
  pullup: ['Wisząc na drążku podciągasz się, aż broda znajdzie się nad drążkiem.', 'Zacznij od ściągnięcia łopatek w dół, bez bujania.'],
  lat_pulldown: ['Siedząc przy wyciągu ściągasz drążek do górnej części klatki.', 'Nie odchylaj się mocno do tyłu i nie szarp.'],
  row: ['W pochyleniu z prostymi plecami przyciągasz sztangę do brzucha.', 'Plecy proste przez cały ruch – to najczęstszy błąd.'],
  db_row: ['Opierając się jedną ręką o ławkę przyciągasz hantel do biodra.', 'Ciągnij łokciem, nie przekręcaj tułowia.'],
  face_pull: ['Przyciągasz linę wyciągu do twarzy, rozchylając ręce na boki.', 'Lekki ciężar, nacisk na ściąganie łopatek – świetne dla zdrowia barków.'],
  shrug: ['Trzymając ciężar w dłoniach unosisz barki prosto w górę, do uszu.', 'Nie kręć barkami w kółko.'],
  back_ext: ['Na ławce rzymskiej opuszczasz tułów i prostujesz go do linii ciała.', 'Nie przeprostowuj pleców w górnej pozycji.'],
  ohp: ['Stojąc wypychasz sztangę lub hantle znad barków nad głowę.', 'Napnij brzuch i pośladki, żeby nie wyginać lędźwi.'],
  lateral_raise: ['Unosisz hantle bokiem do wysokości barków.', 'Lekki ciężar, bez bujania tułowiem.'],
  reverse_fly: ['W opadzie tułowia rozkładasz ręce z hantlami na boki.', 'Prowadź ruch tylną częścią barków, nie plecami.'],
  curl: ['Stojąc uginasz ręce w łokciach, unosząc hantle do barków.', 'Łokcie przy tułowiu, bez bujania.'],
  hammer: ['Uginasz ręce z hantlami trzymanymi jak młotek (kciuki w górę).', 'Mocno angażuje przedramię i mięsień ramienny.'],
  triceps_oh: ['Trzymając ciężar za głową prostujesz ręce w łokciach nad głowę.', 'Łokcie skierowane do przodu, nie na boki.'],
  pushdown: ['Przy wyciągu prostujesz ręce w łokciach, ściągając linkę lub drążek w dół.', 'Łokcie przyklejone do boków.'],
  wrist_curl: ['Z przedramieniem opartym o udo uginasz nadgarstek z ciężarem w górę.', 'Mały zakres i lekki ciężar wystarczą.'],
  reverse_curl: ['Uginasz ręce w łokciach, trzymając sztangę nachwytem (dłonie w dół).', 'Wzmacnia przedramiona i mięsień ramienno-promieniowy.'],
  squat: ['Stojąc schodzisz w dół, zginając biodra i kolana, i wstajesz.', 'Kolana w linii stóp, pięty na podłodze, plecy proste.'],
  deadlift: ['Podnosisz sztangę z podłogi do pełnego wyprostu, pchając nogami i prostując biodra.', 'Plecy proste, sztanga blisko nóg – technika ważniejsza niż ciężar.'],
  rdl: ['Z lekko ugiętymi kolanami pochylasz się, cofając biodra, i wracasz do wyprostu.', 'Czujesz rozciąganie tyłu uda – plecy cały czas proste.'],
  lunge: ['Robisz duży krok i opuszczasz tylne kolano w stronę podłogi, potem wracasz.', 'Przednie kolano nad stopą, tułów wyprostowany.'],
  leg_ext: ['Siedząc na maszynie prostujesz nogi w kolanach.', 'Izoluje przód uda, nie szarp ciężarem.'],
  leg_curl: ['Leżąc na maszynie uginasz nogi w kolanach, przyciągając wałek do pośladków.', 'Biodra przyciśnięte do ławki.'],
  adductor: ['Siedząc na maszynie zsuwasz rozchylone nogi do środka.', 'Ruch powolny, bez odbijania.'],
  abductor: ['Siedząc na maszynie rozpychasz kolana na boki, odwodząc nogi w biodrach.', 'Plecy oparte, ruch tylko w biodrach – powoli wracaj, nie pozwól ciężarowi zbić nóg.'],
  calf_raise: ['Stojąc wspinasz się na palce i powoli opuszczasz pięty.', 'Pełny zakres: od rozciągnięcia do pełnego wspięcia.'],
  seated_calf: ['Siedząc z ciężarem na kolanach unosisz pięty.', 'Przy ugiętych kolanach pracuje głównie mięsień płaszczkowaty.'],
  tib_raise: ['Opierając plecy o ścianę unosisz palce stóp, stojąc na piętach.', 'Wzmacnia przód podudzia, pomaga kolanom i kostkom.'],
  hip_thrust: ['Oparty plecami o ławkę unosisz biodra z ciężarem do linii prostej.', 'Na górze mocno ściśnij pośladki, broda lekko w dół.'],
  band_walk: ['Z gumą nad kolanami idziesz w półprzysiadzie krokami w bok.', 'Kolana wypychaj na zewnątrz, nie pozwól im się schodzić.'],
  plank: ['Podpór na przedramionach, ciało proste od głowy do pięt – trzymasz pozycję.', 'Nie unoś bioder i nie pozwól im opadać.'],
  side_plank: ['Podpór bokiem na jednym przedramieniu, ciało w linii prostej.', 'Biodra wysoko, nie opadają do podłogi.'],
  crunch: ['Leżąc z ugiętymi nogami unosisz łopatki nad podłogę, spinając brzuch.', 'Nie ciągnij głowy rękami.'],
  leg_raise: ['Wisząc na drążku unosisz nogi przed siebie.', 'Bez bujania – trudniejsza wersja to proste nogi.'],
  farmer: ['Idziesz z ciężkimi hantlami w dłoniach, trzymając prostą sylwetkę.', 'Barki w dół, tułów nie przechyla się na boki.'],
};
for (const ex of CATALOG) [ex.how, ex.tip] = INFO[ex.id] ?? ['', ''];

// ---------- Jednostki serii ----------
export const measureOf = (ex) => ex?.measure ?? 'reps';
export const isTime = (ex) => measureOf(ex) === 'time';
export const defaultAmount = (ex) => ex?.amount ?? (isTime(ex) ? 30 : 10);
// zakres pola „ilość na serię”: sekundy co 5 do 10 min, powtórzenia 1–50 (kroki do 100)
export const amountRange = (ex) => (isTime(ex) ? { min: 5, max: 600, step: 5 } : { min: 1, max: ex?.repsLabel ? 100 : 50, step: 1 });
// „3 × 30 s”, „3 × 12 kroków”, „3 × 10”
export const fmtAmount = (ex, n) => (isTime(ex) ? `${n} s` : ex?.repsLabel ? `${n} ${ex.repsLabel}` : `${n}`);
export const fmtSets = (ex, it) => `${it.sets} × ${fmtAmount(ex, it.reps)}`;
// obciążenie (do zapisu treningu): 'kg' – ciężar zewnętrzny, 'body' – masa ciała (opcjonalnie dociążenie), 'none' – bez ciężaru
export const loadOf = (ex) => ex?.load ?? (['masa ciała', 'guma'].includes(ex?.equipment) ? 'body' : ex?.equipment === 'drążek' || ex?.equipment === 'poręcze' || ex?.equipment === 'ławka' ? 'body' : 'kg');
