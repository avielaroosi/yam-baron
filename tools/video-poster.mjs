// Prints duration/size of a video file and saves a poster frame (JPEG) at a given second, using the installed Chrome
// (Playwright's own Chromium has no H.264). Run: cd tools && node video-poster.mjs ../assets/video/x.mp4 ../assets/img/video-x.jpg 1.5
import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const [,, file, posterOut, atSec] = process.argv;
const dir = path.dirname(file), name = path.basename(file);
const srv = http.createServer((q, r) => {
  if (q.url === "/") { r.writeHead(200, { "content-type": "text/html" }); r.end(`<video id=v src="/${encodeURIComponent(name)}" muted playsinline preload="auto"></video>`); return; } // same origin as the video, or the canvas is "tainted" and cannot export
  const f = path.join(dir, decodeURIComponent(q.url.slice(1)));
  if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  const size = fs.statSync(f).size, range = q.headers.range;
  if (range) { const [s, e] = range.replace("bytes=", "").split("-").map(Number); const end = e || size - 1;
    r.writeHead(206, { "content-type": "video/mp4", "content-range": `bytes ${s}-${end}/${size}`, "content-length": end - s + 1, "accept-ranges": "bytes" }); fs.createReadStream(f, { start: s, end }).pipe(r); return; }
  r.writeHead(200, { "content-type": "video/mp4", "content-length": size, "accept-ranges": "bytes" }); fs.createReadStream(f).pipe(r);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage();
await p.goto(url);
const info = await p.evaluate(async (t) => {
  const v = document.getElementById("v");
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms (readyState=${v.readyState} networkState=${v.networkState} error=${v.error && v.error.code})`)), ms));
  if (v.readyState < 1) await Promise.race([new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; }), timeout(20000)]); // may already have fired before we listened
  v.currentTime = Math.min(Number(t) || 1, v.duration - 0.1);
  await Promise.race([new Promise((res) => { v.onseeked = res; }), timeout(20000)]);
  const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, jpg: c.toDataURL("image/jpeg", 0.85) };
}, atSec);
if (posterOut) fs.writeFileSync(posterOut, Buffer.from(info.jpg.split(",")[1], "base64"));
console.log(JSON.stringify({ duration: info.duration, w: info.w, h: info.h, sizeMB: (fs.statSync(file).size / 1e6).toFixed(1) }));
await b.close(); srv.close();
