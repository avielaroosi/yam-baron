#!/usr/bin/env python3
"""Local preview server.

`python3 -m http.server` with the two things a preview of this site needs and that one lacks:

- it tells the browser never to cache, so a refresh — on the desktop or on a phone on the
  same Wi-Fi — always shows the files as they are now (without it a browser keeps a file it
  fetched yesterday for hours, and "I don't see the change" is the result);
- it answers byte-range requests, without which Safari on an iPhone refuses to play video.

Usage: python3 tools/serve.py [port] [bind]      (defaults: 8140, 127.0.0.1; bind 0.0.0.0 for the phone)
"""
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        self._remaining = None
        header = self.headers.get("Range")
        path = self.translate_path(self.path)
        match = re.match(r"bytes=(\d*)-(\d*)$", header.strip()) if header else None
        if not match or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        first, last = match.group(1), match.group(2)
        if first == "" and last == "":
            return super().send_head()
        if first == "":                      # "bytes=-500": the last 500 bytes
            start, end = max(0, size - int(last)), size - 1
        else:
            start, end = int(first), min(int(last), size - 1) if last else size - 1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self._remaining = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self._remaining))
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        try:
            if self._remaining is None:
                return super().copyfile(source, outputfile)
            left = self._remaining
            while left > 0:
                chunk = source.read(min(64 * 1024, left))
                if not chunk:
                    break
                outputfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # a video player drops the connection every time it seeks; that is not an error


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8140))
    bind = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    print(f"serving {ROOT} on http://{bind}:{port}")
    http.server.ThreadingHTTPServer((bind, port), Handler).serve_forever()
