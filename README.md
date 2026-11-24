# Human Exercise Simulation

Planer treningu z interaktywnym modelem 3D: pokazuje, które mięśnie trenuje plan i każde ćwiczenie, z animacją i typowymi błędami techniki.

**Opis projektu, funkcjonalności i roadmapa: [`docs/index.html`](docs/index.html)**. Ta strona jest głównym miejscem śledzenia projektu i jest aktualizowana przy każdej zmianie funkcjonalności.

## Uruchomienie

```bash
python3 -m http.server 8000     # albo: npm start
```

Następnie otwórz <http://localhost:8000>. Three.js ładuje się z CDN, więc potrzebny jest internet. Projekt nie ma kroku budowania.

Parametry URL przydatne do demo i testów:
- `?ex=pushup` otwiera wybrane ćwiczenie (id z `src/exercises/`),
- `&t=0.6` zatrzymuje animację w danym punkcie cyklu (0–1),
- `&mistake=sag` pokazuje typowy błąd (id z `mistakes` w pliku ćwiczenia),
- `index.html?focus=mon#plan` pokazuje plan z wybranym dniem, a `?picker=wed#plan` otwiera okno wyboru ćwiczeń, a `?show=squat#plan` lub `?picker=wed&detail=row#plan` otwiera szczegóły ćwiczenia z katalogu (`&t=0.5` zatrzymuje animację).

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
| `src/figure.js` | statyczna figura przód/tył z pracującymi mięśniami |
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
