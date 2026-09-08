#!/usr/bin/env python3
"""Static file server for local preview, with browser auto-reload.

Stdlib only — no npm, no build step. Serves the repo root exactly like
`python3 -m http.server`, but polls file mtimes in the background and tells
open tabs to reload when something under the tree changes.

Usage: python3 tools/dev-server.py [port]
"""
import http.server
import io
import os
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "rendercv_output"}
POLL_INTERVAL = 0.5

_version = 0
_lock = threading.Lock()

RELOAD_SNIPPET = b"""
<script>
(function () {
  var known = null;
  setInterval(function () {
    fetch('/__livereload__').then(function (r) { return r.text(); }).then(function (v) {
      if (known === null) { known = v; return; }
      if (v !== known) { location.reload(); }
    }).catch(function () {});
  }, 1000);
})();
</script>
"""


def _scan():
    latest = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for name in filenames:
            path = os.path.join(dirpath, name)
            try:
                latest = max(latest, os.path.getmtime(path))
            except OSError:
                pass
    return latest


def _watch():
    global _version
    last = _scan()
    while True:
        time.sleep(POLL_INTERVAL)
        current = _scan()
        if current != last:
            last = current
            with _lock:
                _version += 1


class ReloadHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path == "/__livereload__":
            with _lock:
                body = str(_version).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            for index in ("index.html", "index.htm"):
                candidate = os.path.join(path, index)
                if os.path.exists(candidate):
                    path = candidate
                    break
        if path.endswith(".html") and os.path.isfile(path):
            with open(path, "rb") as f:
                content = f.read()
            if b"</body>" in content:
                content = content.replace(b"</body>", RELOAD_SNIPPET + b"</body>", 1)
            else:
                content += RELOAD_SNIPPET
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            return io.BytesIO(content)
        return super().send_head()


class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    threading.Thread(target=_watch, daemon=True).start()
    with Server(("", port), ReloadHandler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{port}/ (auto-reload on)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
