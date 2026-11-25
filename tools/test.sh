#!/bin/bash
# Testy przed każdym wdrożeniem (commit/push): test fizyki ćwiczeń + testy podstawowych funkcji aplikacji.
# Użycie: tools/test.sh   (wymaga Google Chrome; serwer statyczny uruchamia sam, jeśli nie działa na :8765)
# Kod wyjścia 0 = wszystko OK.
cd "$(dirname "$0")/.."
PORT=8765
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  python3 -m http.server $PORT >/dev/null 2>&1 & SERVER=$!
  trap 'kill $SERVER' EXIT
  sleep 1
fi
CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
TMP=$(mktemp -d)
run() {   # $1 = adres, $2 = id elementu z wynikiem
  timeout 900 "$CHROME" --headless=new --user-data-dir="$TMP/p$RANDOM" --disable-gpu --enable-unsafe-swiftshader \
    --virtual-time-budget=900000 --window-size=420,900 --dump-dom "http://localhost:$PORT/$1" 2>/dev/null |
    python3 -c "import sys,re,html;d=sys.stdin.read();m=re.search(r'<pre id=\"$2\">(.*?)</pre>',d,re.S);print(html.unescape(m.group(1)).strip() if m else 'BRAK WYNIKU')"
}
status=0
# na GitHubie: każdy błąd jako adnotacja (widoczna przy przebiegu, także bez logów)
note() { [ -n "$GITHUB_ACTIONS" ] && echo "$1" | grep -E '^(✘|BŁĘDY|BRAK)|naruszen|narusz' | sed "s/^/::error title=$2::/"; true; }
echo "== Fizyka (mężczyzna)"; r=$(run 'tools/sheet.html?check&sex=m' check); echo "$r" | head -20; [[ "$r" == OK* ]] || { status=1; echo "::error title=Fizyka (mężczyzna)::$(echo "$r" | head -3 | tr '\n' ' ')"; }
echo "== Fizyka (kobieta)";   r=$(run 'tools/sheet.html?check&sex=f' check); echo "$r" | head -20; [[ "$r" == OK* ]] || { status=1; echo "::error title=Fizyka (kobieta)::$(echo "$r" | head -3 | tr '\n' ' ')"; }
echo "== Funkcje aplikacji";  r=$(run "tools/smoke.html?${SMOKE_ARGS:-}" result); echo "$r"; [[ "$r" == OK* ]] || { status=1; note "$r" Funkcje; }
rm -rf "$TMP"
[ $status = 0 ] && echo "WSZYSTKO OK" || echo "SĄ BŁĘDY – nie wdrażać"
exit $status
