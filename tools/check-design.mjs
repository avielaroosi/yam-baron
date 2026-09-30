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

  // --- contrast: every visible text element against its effective background.
  // Run over three states, not just the page at rest: the promo and the gift card
  // are the two places cream backgrounds meet gold text, and both are `hidden` on
  // load — a walk over the resting page would skip exactly the risky surfaces.
  const contrastWalk = () => {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const alpha = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(","); return p.length < 4 ? 1 : parseFloat(p[3]); };
    // Collect every background from the element up to the root, then composite them
    // bottom-up. Treating a translucent layer as absent reports cream-on-cream for a
    // cream glyph sitting on a 55%-black scrim, which is the opposite of the truth.
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const b = getComputedStyle(n).backgroundColor;
        const a = alpha(b);
        if (a > 0) layers.push([rgb(b), a]);
        if (a >= 1) break;
      }
      let out = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) {
        const [c, a] = layers[i];
        out = out.map((v, k) => c[k] * a + v * (1 - a));
      }
      return out;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    // WCAG AA: large text clears at 3:1. 24px, or 18.66px once it is bold.
    const floorFor = (cs) => { const s = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400; return s >= 24 || (s >= 18.66 && w >= 700) ? 3 : 4.5; };

    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      // only elements that render their own text
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
      if (!el.getClientRects().length) continue;
      if (el.closest(".sr-only, .skip")) continue;
      // text sitting on a photograph has no measurable background; its legibility
      // comes from the scrim gradient, which this walk cannot see
      if (el.closest(".gift-band, .hero__inner")) continue;
      const floor = floorFor(cs);
      const r = ratio(rgb(cs.color), bgOf(el));
      if (r < floor) out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${el.textContent.trim().slice(0, 24)}" = ${r.toFixed(2)}:1 (needs ${floor})`);
    }
    return out;
  };

  for (const [label, url] of [["home", base], ["gift card", base + "?gift"], ["promo", base + "?promo"]]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(url, { waitUntil: "load" });
    await p.waitForTimeout(url.endsWith("?promo") ? 3600 : 600); // the promo opens on a timer set in content.js
    const low = await p.evaluate(contrastWalk);
    need(low.length === 0, `${label}: text below 4.5:1 contrast:\n    ` + low.join("\n    "));
    await p.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) { console.error("check-design: FAIL\n- " + problems.join("\n- ")); process.exit(1); }
console.log("check-design: OK");
