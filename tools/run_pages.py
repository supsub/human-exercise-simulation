#!/usr/bin/env python3
"""Uruchamia strony testowe równolegle w Chrome bez okna i czeka na ich wynik (tools/test.sh).

Każde zadanie: osobny Chrome z własnym profilem (osobna pamięć przeglądarki), sterowany przez protokół DevTools.
Czekamy w prawdziwym czasie, aż w elemencie <pre id="…"> pojawi się wynik (nie „trwa…”), i go wypisujemy.

Użycie: run_pages.py URL#id_elementu [URL#id_elementu …]   (zmienne: CHROME, TIMEOUT – sekundy na stronę)
Kod wyjścia 0, gdy każdy wynik zaczyna się od „OK”.
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

import websocket  # pip install websocket-client

CHROME = os.environ.get('CHROME') or shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
TIMEOUT = float(os.environ.get('TIMEOUT', '90'))


def run(job):
    url, elem = job.rsplit('#', 1)
    prof = tempfile.mkdtemp(prefix='hes-test-')
    proc = subprocess.Popen([CHROME, '--headless=new', f'--user-data-dir={prof}', '--remote-debugging-port=0', '--remote-allow-origins=*',
                             '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
                             '--window-size=420,1400', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    try:
        port_file = os.path.join(prof, 'DevToolsActivePort')
        while not os.path.exists(port_file) or not open(port_file).read().strip():
            if time.time() - t0 > 20: return url, 'BRAK WYNIKU – Chrome nie wystartował'
            time.sleep(0.05)
        port = open(port_file).read().split()[0]
        targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list'))
        ws = websocket.create_connection(next(t for t in targets if t['type'] == 'page')['webSocketDebuggerUrl'], timeout=60)   # strona liczy synchronicznie – odpowiedź może chwilę poczekać
        n = 0
        logs, reqs = [], {}   # wyjątki i błędy z konsoli strony – do opisu, gdy wynik nie nadejdzie

        def call(method, **params):
            nonlocal n
            n += 1
            ws.send(json.dumps({'id': n, 'method': method, 'params': params}))
            while True:
                msg = json.loads(ws.recv())
                if msg.get('id') == n: return msg.get('result', {})
                if msg.get('method') == 'Runtime.exceptionThrown':
                    d = msg['params']['exceptionDetails']; logs.append(d.get('exception', {}).get('description', d.get('text', ''))[:200])
                elif msg.get('method') == 'Network.requestWillBeSent':
                    reqs[msg['params']['requestId']] = msg['params']['request']['url']
                elif msg.get('method') == 'Network.loadingFailed':
                    logs.append(f"pobranie nieudane: {reqs.get(msg['params']['requestId'], '?')[-70:]} ({msg['params'].get('errorText')})")
                elif msg.get('method') == 'Log.entryAdded' and msg['params']['entry']['level'] == 'error':
                    logs.append(msg['params']['entry']['text'][:200] + ' ' + msg['params']['entry'].get('url', '')[-60:])

        call('Runtime.enable'); call('Log.enable'); call('Network.enable')
        call('Page.navigate', url=url)
        expr = f"(() => {{ const e = document.getElementById({json.dumps(elem)}); return e && !/^trwa/.test(e.textContent) ? e.textContent : null; }})()"
        while time.time() - t0 < TIMEOUT:
            val = call('Runtime.evaluate', expression=expr, returnByValue=True).get('result', {}).get('value')
            if val: return url, val.strip()
            time.sleep(0.25)
        state = call('Runtime.evaluate', expression='document.readyState', returnByValue=True).get('result', {}).get('value')
        return url, f'BRAK WYNIKU – przekroczono {TIMEOUT:.0f} s (strona: {state}; błędy: {" | ".join(logs[-5:]) or "brak"})'
    except Exception as e:  # noqa: BLE001 – każdy problem z przeglądarką to błąd testu
        return url, f'BRAK WYNIKU – {e}'
    finally:
        proc.kill(); proc.wait()
        shutil.rmtree(prof, ignore_errors=True)


if __name__ == '__main__':
    jobs = sys.argv[1:]
    ok = True
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        for url, out in pool.map(run, jobs):
            print(f'== {url.split("/")[-1]}')
            print(out)
            ok &= out.startswith('OK')
    sys.exit(0 if ok else 1)
