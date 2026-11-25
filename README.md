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
- `?focus=A` zaznacza trening (litera wariantu), `?picker=B` otwiera listę ćwiczeń dla treningu, `&preview=row` podświetla mięśnie ćwiczenia z listy.

`node tools/check.mjs` wypisuje kąty stawów i aktywacje bez przeglądarki (szybki test sanity).

## Konto i baza danych (Supabase)

Logowanie (Google; link w mailu tylko na lokalnej bazie) i synchronizacja planów: `src/sync.js`, wybór bazy: `src/config.js`, schemat: `supabase/migrations/`.

- **localhost** → lokalny Supabase w Dockerze, **GitHub Pages i telefon w sieci domowej** → produkcja. Ręcznie: `?db=local` / `?db=prod` / `?db=auto`. Lokalna baza: przerywana żółta obwódka wokół przycisku konta.
- Lokalnie: zainstaluj [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), potem w katalogu projektu `supabase start` (pierwszy raz pobiera obrazy Dockera; migracje wgrywa sam). Maile z linkami logowania: http://127.0.0.1:54324. Reset danych: `supabase db reset`. Stop: `supabase stop`.
- Nowa zmiana schematu: `supabase migration new nazwa` → SQL w nowym pliku → lokalnie `supabase migration up`. Na produkcję trafia sama po pushu na main (integracja Supabase z GitHubem: Project Settings → Integrations → GitHub, „Deploy to production”). Migracje tylko dopisujemy – wgranego pliku się nie zmienia.
- Klucz publishable w `src/config.js` jest jawny z założenia – dane chronią reguły RLS. Kluczy `secret`/`service_role` ani Google client secret nie trzymamy w repozytorium.

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
| `src/plan/analysis.js` | treningi i plany, automatyczny harmonogram cyklu, analiza: objętość, ostrzeżenia, rekomendacje (bez UI) |
| `src/plan/planView.js` | jedyny widok: plan, panel ćwiczeń (lista i szczegóły), pasek odtwarzania |
| `src/main.js` | start aplikacji |

## Dodanie ćwiczenia

1. Dopisz ćwiczenie do `src/plan/catalog.js` (wagi mięśni) i jego opis do `INFO` w tym samym pliku.
2. Dodaj animację w `src/exercises/library.js`: zwykle wystarczą dwie pozy kluczowe (`keyframes(base, A, B)`), kotwica (np. stopy na podłodze) i rekwizyty. Gdy dłonie trzymają drążek, podaj tor drążka i szerokość chwytu (`hands: { w, y, z, pole }`) – ramiona policzy kinematyka odwrotna, a chwyt się nie przesuwa. Konwencje kątów są opisane w `src/exercises/build.js`. Aktywacje mięśni liczą się automatycznie z wag w katalogu.
3. Sprawdź wszystkie animacje naraz: <http://localhost:8000/tools/sheet.html> (pozycja A i B każdego ćwiczenia; `?only=bench,row` zawęża listę, `?mistakes` pokazuje wszystkie typowe błędy, `?check` uruchamia test fizyki z `src/physics.js` – musi zwrócić „OK” przed każdym commitem zmieniającym animacje, `&cam=x,y,z&target=x,y,z` ustawia kamerę).
4. Chwyt: dopisz ćwiczenie do `src/exercises/grips.js` – w którą stronę patrzy wnętrze dłoni i kciuk w pozycji wyjściowej (np. `'stopy/środek'` dla wyciskania leżąc) oraz obrót przedramienia `pron` (0 = podchwyt, 90 = młotkowy, 180 = nachwyt). Sztanga/drążek: typ chwytu `props.bar.grip` (`'over'` domyślnie / `'under'`), stały rozstaw `props.bar.width` (albo `hands`), chwyt do wyciskania `props.bar.press`. Dłoń oparta o sprzęt: `handL` / `handR: { at, pole }`.
5. Typowe błędy dopisz w `src/exercises/mistakes.js` (zmiana pozy, mięśni, przeciążenia i opis).
6. Przejdź checklistę poniżej i zaktualizuj `docs/index.html` (tabela funkcjonalności i dziennik zmian).

## Checklista jakości ćwiczenia (przed każdym commitem zmieniającym animacje)

Automatycznie – `tools/sheet.html?check` musi zwrócić „OK – brak naruszeń fizyki” (sprawdza 60 chwil cyklu, poprawną technikę i każdy błąd):

- [ ] sprzęt (sztanga, hantle, hantel oburącz) nie wchodzi w ciało, dłonie nie wchodzą w tułów, głowę ani uda
- [ ] nogi nie nachodzą na siebie, nic nie przechodzi przez podłogę
- [ ] podeszwy leżą płasko na płycie suwnicy (pięta i palce ±1 cm); w zwisie (`hang: true`) stopy cały czas ≥ 10 cm nad podłogą
- [ ] ciało, dłonie i stopy (cała podeszwa i śródstopie) nie wchodzą w sprzęt: ławki, siedziska, podnóżki, oparcia
- [ ] ciało nie wchodzi w drążki, poręcze, wałki i słupki sprzętu (z zapasem na mięśnie wyglądu organicznego); elementy, które mają dociskać ciało (wałek na kostki), oznaczamy `contact: true`
- [ ] chwyt zgodny ze specyfikacją z `grips.js` (wnętrze dłoni i kciuk we właściwą stronę)
- [ ] chwyt nie zmienia się w trakcie ruchu (nachwyt ↔ podchwyt), dłonie nie przesuwają się po drążku
- [ ] zaciśnięta dłoń zawsze coś trzyma (drążek, poręcz, uchwyt maszyny) – nie zaciska się w powietrzu
- [ ] stawy w anatomicznym zakresie: biodro zgięte ≤ 135° (dalej udo wchodzi w brzuch), odgięte ≤ 35°, kolano 0–160° (bez przeprostu), lędźwia zgięte ≤ 60°, odgięte ≤ 40° – **kąty w pozach są bezwzględne**: zmiana `rx` (miednica) bez `trunk` przechyla cały tułów
- [ ] w poprawnej technice plecy leżą na oparciu – oparcie oznaczamy `rest: ['chest']`
- [ ] platforma suwnicy jedzie po prowadnicach (`rail: true`) – stopy poruszają się po prostej, nie po łuku (IK nogi zamiast interpolacji kątów)
- [ ] każdy błąd jest **widoczny**: ciało (punkty i stawy) różni się od poprawnej techniki o ≥ 4 cm; błąd opisany samym tekstem i zmianą mięśni to za mało

Wzrokowo – arkusze zbliżeń (`tools/sheet.html?ts=0.01,0.5&focus=handL&dist=0.5`, `&focus=feet`, `?mistakes`):

- [ ] ciężar leży tam, gdzie w rzeczywistości: sztanga przy wyciskaniu w nasadzie dłoni nad przedramieniem, hantel w goblecie oparty na dłoniach, przy podciąganiu palce zahaczone o drążek
- [ ] dłonie bez rekwizytu wyglądają naturalnie (zwisają wnętrzem do ud, leżą płasko na udach, pięści w desce)
- [ ] stopy stoją płasko tam, gdzie powinny (podłoga, platforma, podnóżek), sprzęt ma sensowne wymiary
- [ ] przy przełączeniu na błąd technika różni się tylko tym błędem (kamera zostaje w miejscu – porównanie 1:1)
- [ ] błędy „bujanie” robimy wspólnymi funkcjami z `build.js`: `momentumSwing` (tułów stojąc: przysiad → wyrzut z odchyleniem → odbicie) i `kipSwing` (wahadło w zwisie z wyrzutem nóg) – spójnie we wszystkich ćwiczeniach
- [ ] błędy „dynamiczne” (bujanie, szarpanie) naprawdę się ruszają w czasie – poza dostaje `params.cycleT` (czas w cyklu 0–1); podgląd: `tools/sheet.html?only=leg_raise&mistake=swing&ts=0,0.125,…`

Twarz ze zdjęcia: przycisk 🙂 w aplikacji (`src/faceUI.js`, dopasowanie w `src/face.js`) – zdjęcie przetwarzane i zapisywane wyłącznie w przeglądarce (localStorage, sama tekstura 512 px), nigdy w repozytorium. Prywatne pliki do testów trzymamy w `local/` (ignorowany przez git); podgląd: `?faceimg=local/x.jpg&lm=…&facetone=model`.

Narzędzia: `tools/points.html?ex=db_row&t=0,0.5&pts=handR,toeL` – pozycje punktów ciała (do ustawiania sprzętu i podparć), `tools/sheet.html?grips` – tabela chwytu wszystkich ćwiczeń, `tools/phone.html?u=?ex=squat` – podgląd w rozmiarze telefonu, `tools/look.html` – porównanie wyglądów (domyślny: realistyczny, `?look=classic` – dawny ludzik z brył).
