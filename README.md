# Human Exercise Simulation

Interaktywny model 3D człowieka, który wykonuje ćwiczenia na polecenie i w czasie rzeczywistym pokazuje aktywację mięśni.

**Opis projektu, funkcjonalności i roadmapa: [`docs/index.html`](docs/index.html)**. Ta strona jest głównym miejscem śledzenia projektu i jest aktualizowana przy każdej zmianie funkcjonalności.

## Uruchomienie

```bash
python3 -m http.server 8000     # albo: npm start
```

Następnie otwórz <http://localhost:8000>. Three.js ładuje się z CDN, więc potrzebny jest internet. Projekt nie ma kroku budowania.

Parametry URL przydatne do demo i testów:
- `?cmd=zrób 5 pompek` uruchamia polecenie od razu,
- `&t=0.6` zatrzymuje animację w danym punkcie cyklu (0–1).

`node tools/check.mjs` wypisuje kąty stawów i aktywacje bez przeglądarki (szybki test sanity).

## Struktura

| Plik | Rola |
|---|---|
| `src/dims.js` | wymiary manekina |
| `src/body.js` | model 3D: szkielet (grupy Three.js), segmenty ciała, mięśnie |
| `src/muscles.js` | lista mięśni: nazwy PL/łac., położenie na modelu |
| `src/kinematics.js` | IK dwóch segmentów, obroty w płaszczyźnie strzałkowej |
| `src/exercises/*.js` | definicje ćwiczeń: fazy, poza(głębokość), parametry aktywacji |
| `src/exercises/common.js` | oś czasu faz i model aktywacji |
| `src/commands.js` | parser poleceń po polsku |
| `src/main.js` | scena, UI, pętla animacji |

## Dodanie ćwiczenia

1. Utwórz `src/exercises/<nazwa>.js` z `phases`, `pose(depth)` i `muscles` (`rest`, `peak`, `w`), wzorując się na `pushup.js`.
2. Dopisz je do `src/exercises/index.js`.
3. Zaktualizuj `docs/index.html` (tabela funkcjonalności i dziennik zmian).
