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
- `&t=0.6` zatrzymuje animację w danym punkcie cyklu (0–1),
- `&mistake=sag` pokazuje typowy błąd (id z `mistakes` w pliku ćwiczenia),
- `index.html?focus=mon#plan` pokazuje plan z wybranym dniem, a `?picker=wed#plan` otwiera okno wyboru ćwiczeń.

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
| `src/scene.js` | wspólna scena 3D: kamera, światła, kolorowanie mięśni, znaczniki przeciążeń, oddech |
| `src/simView.js` | widok Symulacja: ćwiczenia, oś czasu, błędy techniki |
| `src/plan/catalog.js` | katalog ćwiczeń do planu (waga zaangażowania mięśni) |
| `src/plan/analysis.js` | analiza planu: objętość, ostrzeżenia, rekomendacje (bez UI) |
| `src/plan/planView.js` | widok Plan treningowy |
| `src/main.js` | przełączanie widoków (#sim / #plan) |

## Dodanie ćwiczenia

1. Utwórz `src/exercises/<nazwa>.js` z `phases` (z `breath`), `pose(depth, params)`, `muscles` (`rest`, `peak`, `w`) i opcjonalnie `mistakes`, wzorując się na `pushup.js`.
2. Dopisz je do `src/exercises/index.js`, a w `src/plan/catalog.js` ustaw `animated: "<id>"`.
3. Zaktualizuj `docs/index.html` (tabela funkcjonalności i dziennik zmian).
