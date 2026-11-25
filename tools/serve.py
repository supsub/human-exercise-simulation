#!/usr/bin/env python3
"""Serwer plików dla testów (tools/test.sh): jak `python -m http.server`, ale z dużą kolejką połączeń –
kilka przeglądarek naraz pobiera dziesiątki modułów, a domyślna kolejka (5) gubi połączenia."""
import functools, http.server, sys

class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
Server(('127.0.0.1', port), functools.partial(Quiet, directory='.')).serve_forever()
