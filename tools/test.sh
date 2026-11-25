#!/bin/bash
# Testy przed każdym wdrożeniem (commit/push): test fizyki ćwiczeń + testy podstawowych funkcji aplikacji.
# Wszystko równolegle w kilku przeglądarkach bez okna (tools/run_pages.py), cel: około minuty.
# Użycie: tools/test.sh   (wymaga Google Chrome i python3 z websocket-client; PARTS – liczba równoległych części)
# Fizyka liczy się raz: szkielet, ruchy i bryły kolizyjne są wspólne dla obu sylwetek (różni je tylko skóra).
# Kod wyjścia 0 = wszystko OK.
cd "$(dirname "$0")/.."
python3 -c 'import websocket' 2>/dev/null || python3 -m pip install -q --break-system-packages websocket-client
PORT=8766
python3 tools/serve.py $PORT & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html" && break; sleep 0.1; done

P=${PARTS:-6}
URL="http://127.0.0.1:$PORT"
JOBS=()
for k in $(seq 0 $((P - 1))); do JOBS+=("$URL/tools/sheet.html?check&part=$k/$P#check" "$URL/tools/smoke.html?part=$k/$P&${SMOKE_ARGS:-}#result"); done
start=$(date +%s)
out=$(TIMEOUT=${TIMEOUT:-150} python3 tools/run_pages.py "${JOBS[@]}"); status=$?
echo "$out"
# na GitHubie: każdy błąd jako adnotacja (widoczna przy przebiegu, także bez dostępu do logów)
[ -n "$GITHUB_ACTIONS" ] && echo "$out" | grep -E '^(✘|BŁĘDY|BRAK)|cm \(t=|ponad zakres|chwyt' | sed 's/^/::error title=Testy::/'
echo "czas: $(( $(date +%s) - start )) s"
[ $status = 0 ] && echo "WSZYSTKO OK" || echo "SĄ BŁĘDY – nie wdrażać"
exit $status
