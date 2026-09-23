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

// Google Maps embed only paints while it is the page's actual current scroll target (confirmed:
// content it already painted does NOT survive scrolling away before a fullPage screenshot), so
// this scrolls it into view and gives it a bounded window to render before we capture it. Call
// this right before a fullPage screenshot, after anything else (like the hero fold shot) that
// needs the page scrolled elsewhere.
async function waitForMap(page, maxMs = 5000) {
  const hasMap = await page.evaluate(() => !!document.getElementById("contact-map"));
  if (!hasMap) return;
  await page.evaluate(() => document.getElementById("contact-map").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(maxMs);
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

let wa = [];
try {
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

  // --- brand logo (Task 8)
  need((await mobile.getAttribute("#hero-logo", "src") || "").endsWith(S.logo.hero), "hero: logo image src");
  need(await mobile.evaluate(() => { const r = document.getElementById("hero-logo").getBoundingClientRect(); return r.width >= 220 && r.top >= 0 && r.bottom <= window.innerHeight; }), "hero: logo visible above the fold on mobile");
  need(await mobile.evaluate(() => { const r = document.getElementById("hero-name").getBoundingClientRect(); return r.width <= 1 && r.height <= 1; }), "hero: text wordmark must be visually hidden (sr-only) when the logo is shown");
  need((await mobile.getAttribute("#footer-logo", "src") || "").endsWith(S.logo.mark), "footer: monogram src");
  need((await mobile.getAttribute('link[rel="icon"]', "href")) === "assets/favicon.png", "favicon must be assets/favicon.png");

  // --- WhatsApp links
  wa = await mobile.$$eval('a[href^="https://wa.me/"]', (as) => as.map((a) => a.href));
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
  need(await mobile.evaluate(() => ["contact-ig", "hero-ig"].every((id) => getComputedStyle(document.getElementById(id)).direction === "ltr")), "instagram handles must be laid out LTR");
  need(await mobile.$$eval("#contact-hours li span:last-child", (s) => s.every((x) => getComputedStyle(x).direction === "ltr")), "hours time values must be laid out LTR");
  need((await mobile.getAttribute("#contact-map", "src") || "").startsWith("https://www.google.com/maps?q="), "contact: map embed src");

  // --- gallery + lightbox (Task 3)
  need((await mobile.$$("#gallery-grid .gallery__item")).length === S.gallery.length, "gallery: item count");
  need(await mobile.isHidden("#lightbox"), "lightbox: must start hidden");
  await mobile.click("#gallery-grid .gallery__item:nth-child(2)");
  need(await mobile.isVisible("#lightbox"), "lightbox: opens on click");
  need((await mobile.getAttribute("#lightbox-img", "src") || "").endsWith(S.gallery[1].src), "lightbox: shows the clicked image");
  need(await mobile.evaluate(() => document.body.style.overflow === "hidden"), "lightbox: page scroll must be locked while open");
  await mobile.keyboard.press("ArrowLeft");
  need((await mobile.getAttribute("#lightbox-img", "src") || "").endsWith(S.gallery[2].src), "lightbox: ArrowLeft goes to next (RTL)");
  await mobile.keyboard.press("ArrowRight");
  need((await mobile.getAttribute("#lightbox-img", "src") || "").endsWith(S.gallery[1].src), "lightbox: ArrowRight goes back");
  need((await mobile.textContent("#lightbox-count")).replace(/\s/g, "") === `2/${S.gallery.length}`, "lightbox: counter text");
  await mobile.keyboard.press("Escape");
  need(await mobile.isHidden("#lightbox"), "lightbox: Escape closes");
  need(await mobile.evaluate(() => document.body.style.overflow === ""), "lightbox: scroll lock released");

  // --- videos (Task 4)
  need((await mobile.$$("#videos-grid .video")).length === S.videos.length, "videos: item count");
  need((await mobile.$$eval("#videos-grid .video", (v) => v.map((x) => x.dataset.type).join(","))) === S.videos.map((v) => v.type).join(","), "videos: data-type per item");
  need((await mobile.$$("#videos-grid .video__placeholder .video__play")).length === S.videos.filter((v) => v.type === "placeholder").length, "videos: placeholder items show a play mark");
  need((await mobile.$$("#videos-grid figcaption")).length === S.videos.length, "videos: every item has a caption");

  // --- screenshots (full page also forces lazy images to load)
  await mobile.screenshot({ path: path.join(shots, "mobile-fold.png") });
  await waitForMap(mobile);
  await mobile.screenshot({ path: path.join(shots, "mobile.png"), fullPage: true });
  await waitForMap(desktop);
  await desktop.screenshot({ path: path.join(shots, "desktop.png"), fullPage: true });
  await mobile.waitForTimeout(500);
  need(await mobile.evaluate(() => [...document.images].filter((i) => i.src).every((i) => i.complete && i.naturalWidth > 0)), "some <img> failed to load");
} finally {
  await browser.close();
  server.close();
}

if (problems.length) { console.error("check-page: FAIL\n- " + problems.join("\n- ")); process.exit(1); }
console.log(`check-page: OK (${wa.length} WhatsApp links verified; screenshots in tools/shots/)`);
