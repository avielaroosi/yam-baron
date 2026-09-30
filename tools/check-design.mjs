// Loads the page in headless Chromium and asserts the design-system acceptance
// criteria from docs/superpowers/specs/2026-09-30-apple-grade-design-system-design.md
// against COMPUTED styles, not CSS source text. Reading the source would pass a
// rule the cascade later overrides; reading the computed value is the only way to
// know what a visitor actually gets.
// Run: cd tools && node check-design.mjs
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  const inRoot = f === root || f.startsWith(root + path.sep); // plain startsWith would also accept a sibling "…/yam-baron-old"
  if (!inRoot || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(400);

  // --- body weight: the HIG rules out Light weights for body copy
  const bodyWeight = await page.evaluate(() => getComputedStyle(document.body).fontWeight);
  need(bodyWeight === "400", `body font-weight must be 400, got ${bodyWeight}`);
} finally {
  await browser.close();
  server.close();
}

if (problems.length) { console.error("check-design: FAIL\n- " + problems.join("\n- ")); process.exit(1); }
console.log("check-design: OK");
