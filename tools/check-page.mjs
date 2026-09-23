// Serves the project folder, loads the page in headless Chromium at mobile + desktop sizes,
// asserts structure / links / no errors, and saves full-page screenshots to tools/shots/.
// Run: cd tools && node check-page.mjs
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };
const shots = path.join(root, "tools/shots");
fs.mkdirSync(shots, { recursive: true });

// scroll through the whole page so native lazy-loading fires, then return to top
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

async function open(name, viewport) {
  const page = await browser.newPage({ viewport, locale: "he-IL" });
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${name}] console error: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`[${name}] page error: ${e.message}`));
  page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`[${name}] ${r.status()} ${r.url().slice(base.length)}`); });
  await page.goto(base, { waitUntil: "load" });
  await scrollThrough(page);
  await page.waitForTimeout(800);
  return page;
}

const mobile = await open("mobile", { width: 390, height: 844 });
const desktop = await open("desktop", { width: 1440, height: 900 });
const S = await mobile.evaluate(() => window.SITE);

// --- document basics
need(await mobile.evaluate(() => document.documentElement.dir === "rtl" && document.documentElement.lang === "he"), "html must have dir=rtl lang=he");
need(await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "mobile: horizontal overflow");
need(await mobile.evaluate(() => [...document.images].every((i) => i.getAttribute("alt") !== null)), "every <img> needs an alt attribute");

// --- hero
need((await mobile.textContent("#hero-name")).trim() === S.name, "hero: name not rendered");
need((await mobile.textContent("#hero-tagline")).trim() === S.tagline, "hero: tagline not rendered");

// --- WhatsApp links
const wa = await mobile.$$eval('a[href^="https://wa.me/"]', (as) => as.map((a) => a.href));
need(wa.length >= 7, `expected >= 7 wa.me links (hero, 4 services, about, contact), got ${wa.length}`);
for (const h of wa) {
  need(h.startsWith(`https://wa.me/${S.whatsapp}?text=`), `wa link has wrong number: ${h}`);
  need(/text=%[0-9A-F]{2}/.test(h), `wa link text is not URL-encoded: ${h}`);
}
need(await mobile.$$eval('a[href^="https://wa.me/"]', (as) => as.every((a) => a.target === "_blank")), "wa links must open in a new tab");

// --- services
need((await mobile.$$("#services-grid .card")).length === 4, "services: expected 4 cards");
need((await mobile.$$eval("#services-grid .card__title", (h) => h.map((x) => x.textContent).join("|"))) === S.services.map((s) => s.title).join("|"), "services: titles mismatch");

// --- about + contact
need((await mobile.textContent("#about-title")).trim() === S.about.title, "about: title not rendered");
need((await mobile.getAttribute("#contact-ig", "href")) === `https://instagram.com/${S.instagram}`, "contact: instagram link");
need((await mobile.$$("#contact-hours li")).length === S.hours.length, "contact: hours rows");
need((await mobile.getAttribute("#contact-map", "src") || "").startsWith("https://www.google.com/maps?q="), "contact: map embed src");

// --- screenshots (full page also forces lazy images to load)
await mobile.screenshot({ path: path.join(shots, "mobile-fold.png") });
await mobile.screenshot({ path: path.join(shots, "mobile.png"), fullPage: true });
await desktop.screenshot({ path: path.join(shots, "desktop.png"), fullPage: true });
await mobile.waitForTimeout(500);
need(await mobile.evaluate(() => [...document.images].filter((i) => i.src).every((i) => i.complete && i.naturalWidth > 0)), "some <img> failed to load");

await browser.close();
server.close();

if (problems.length) { console.error("check-page: FAIL\n- " + problems.join("\n- ")); process.exit(1); }
console.log(`check-page: OK (${wa.length} WhatsApp links verified; screenshots in tools/shots/)`);
