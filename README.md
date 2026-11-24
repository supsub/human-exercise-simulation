# Human Exercise Simulation

Planer treningu z interaktywnym modelem 3D: pokazuje, które mięśnie trenuje plan i każde ćwiczenie, z animacją i typowymi błędami techniki.

**Opis projektu, funkcjonalności i roadmapa: [`docs/index.html`](docs/index.html)**. Ta strona jest głównym miejscem śledzenia projektu i jest aktualizowana przy każdej zmianie funkcjonalności.

## Uruchomienie

```bash
python3 -m http.server 8000     # albo: npm start
```

Następnie otwórz <http://localhost:8000>. Three.js ładuje się z CDN, więc potrzebny jest internet. Projekt nie ma kroku budowania.

Parametry URL przydatne do demo i testów:
- `?ex=squat` otwiera szczegóły ćwiczenia z katalogu (id z `src/plan/catalog.js`),
- `&t=0.6` zatrzymuje animację w danym punkcie cyklu (0–1),
- `&mistake=valgus` pokazuje typowy błąd (id z `mistakes` w pliku ćwiczenia),
- `?focus=tue` zaznacza dzień, `?picker=wed` otwiera listę ćwiczeń dla dnia, `&preview=row` podświetla mięśnie ćwiczenia z listy.

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
| `src/exercises/build.js`, `library.js` | silnik póz kluczowych i animacje ćwiczeń katalogu |
| `src/player.js` | odtwarzanie ćwiczenia: oś czasu, przejścia, błędy techniki, wygładzone aktywacje |
| `src/plan/catalog.js` | katalog ćwiczeń do planu (waga zaangażowania mięśni) |
| `src/plan/analysis.js` | analiza planu: objętość, ostrzeżenia, rekomendacje (bez UI) |
| `src/plan/planView.js` | jedyny widok: plan, panel ćwiczeń (lista i szczegóły), pasek odtwarzania |
| `src/main.js` | start aplikacji |

## Dodanie ćwiczenia

1. Dopisz ćwiczenie do `src/plan/catalog.js` (wagi mięśni) i jego opis do `INFO` w tym samym pliku.
2. Dodaj animację w `src/exercises/library.js`: zwykle wystarczą dwie pozy kluczowe (`keyframes(base, A, B)`), kotwica (np. stopy na podłodze) i rekwizyty. Konwencje kątów są opisane w `src/exercises/build.js`. Aktywacje mięśni liczą się automatycznie z wag w katalogu.
3. Sprawdź wszystkie animacje naraz: <http://localhost:8000/tools/sheet.html> (pozycja A i B każdego ćwiczenia; `?only=bench,row` zawęża listę).
4. Ćwiczenie z typowymi błędami techniki: osobny plik jak `src/exercises/pushup.js`, dopisany w `src/exercises/index.js`.
5. Zaktualizuj `docs/index.html` (tabela funkcjonalności i dziennik zmian).
