// Serves the project folder, loads the page in headless Chromium at mobile + desktop sizes,
// asserts structure / links / no errors, and saves full-page screenshots to tools/shots/.
// Run: cd tools && node check-page.mjs
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
const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };
const shots = path.join(root, "tools/shots");
fs.mkdirSync(shots, { recursive: true });

// scroll through the whole page so native lazy-loading fires, then return to top
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo({ top: 0, behavior: "instant" });
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
  const page = await browser.newPage({ viewport, locale: "he-IL", reducedMotion: "reduce" });
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
  // `body { overflow-x: hidden }` makes a scrollWidth check always pass, so measure the boxes.
  // The deliberately off-screen bits pass on their own: .skip is offset vertically only, the
  // hidden lightbox has width 0, and .sr-only is a 1px box inside the viewport.
  need(await mobile.evaluate(() => [...document.querySelectorAll("body *")].every((n) => {
    const r = n.getBoundingClientRect();
    return r.width === 0 || r.right <= window.innerWidth + 1;
  })), "mobile: an element extends past the right edge");
  // RTL mirror of the same idea: overflowing content in an RTL document escapes on the left.
  need(await mobile.evaluate(() => [...document.querySelectorAll("body *")].every((n) => {
    const r = n.getBoundingClientRect();
    return r.width === 0 || r.left >= -1;
  })), "mobile: an element extends past the left edge");
  need(await mobile.evaluate(() => [...document.images].every((i) => i.getAttribute("alt") !== null)), "every <img> needs an alt attribute");
  need((await mobile.$$('a[href="#"]')).length === 0, "no link may be left with href='#' (JS wiring)");

  // --- hero
  need((await mobile.textContent("#hero-name")).trim() === S.name, "hero: name not rendered");
  need((await mobile.textContent("#hero-tagline")).trim() === S.tagline, "hero: tagline not rendered");

  // --- brand logo (Task 8)
  need((await mobile.getAttribute("#hero-logo", "src") || "").endsWith(S.logo.hero), "hero: logo image src");
  need(await mobile.evaluate(() => { const r = document.getElementById("hero-logo").getBoundingClientRect(); return r.width >= 220 && r.top >= 0 && r.bottom <= window.innerHeight; }), "hero: logo visible above the fold on mobile");
  need(await mobile.evaluate(() => { const r = document.getElementById("hero-name").getBoundingClientRect(); return r.width <= 1 && r.height <= 1; }), "hero: text wordmark must be visually hidden (sr-only) when the logo is shown");
  need((await mobile.getAttribute("#footer-logo", "src") || "").endsWith(S.logo.mark), "footer: monogram src");
  need((await mobile.getAttribute('link[rel="icon"]', "href")) === "assets/favicon.png", "favicon must be assets/favicon.png");
  need(await mobile.evaluate(() => !document.getElementById("hero-logo").hasAttribute("loading")), "hero: logo must not be lazy-loaded");
  need((await mobile.getAttribute("#footer-logo", "loading")) === "lazy", "footer: monogram must be lazy-loaded");
  need(await mobile.evaluate(() => [...document.querySelectorAll("main img, footer img")].every((i) => i.getAttribute("loading") === "lazy")), "every image below the hero must be lazy-loaded");

  // --- WhatsApp links
  wa = await mobile.$$eval('a[href^="https://wa.me/"]', (as) => as.map((a) => a.href));
  need(wa.length >= 7, `expected >= 7 wa.me links (hero, 4 services, contact, floating button), got ${wa.length}`);
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
  need(await mobile.$$eval("#hero-ig, #contact-ig", (as) => as.length === 2 && as.every((a) => a.classList.contains("btn") && !!a.querySelector("svg") && a.href.startsWith("https://instagram.com/"))), "instagram: both links are styled buttons with an icon pointing at instagram");
  need(await mobile.$$eval("#contact-hours li span:last-child", (s) => s.every((x) => getComputedStyle(x).direction === "ltr" && getComputedStyle(x).unicodeBidi === "isolate")), "hours time values must be laid out LTR and bidi-isolated");
  need(await mobile.$$eval(".wordmark", (s) => s.length > 0 && s.every((x) => getComputedStyle(x).direction === "ltr" && getComputedStyle(x).unicodeBidi === "isolate")), "the English wordmark must be laid out LTR and bidi-isolated");
  need((await mobile.getAttribute("#contact-map", "src") || "").startsWith("https://www.google.com/maps?q="), "contact: map embed src");

  // --- gallery + lightbox (Task 3)
  need((await mobile.$$("#gallery-grid .gallery__item")).length === S.gallery.length, "gallery: item count");
  need(await mobile.isHidden("#lightbox"), "lightbox: must start hidden");
  await mobile.evaluate(() => document.getElementById("gallery").scrollIntoView());
  await mobile.waitForTimeout(300);
  const yBeforeLightbox = await mobile.evaluate(() => window.scrollY);
  need(yBeforeLightbox > 0, "lightbox: the gallery must be scrolled into view so the scroll-restore check means something");
  await mobile.click("#gallery-grid .gallery__item:nth-child(2)");
  need(await mobile.isVisible("#lightbox"), "lightbox: opens on click");
  need((await mobile.getAttribute("#lightbox-img", "src") || "").endsWith(S.gallery[1].src), "lightbox: shows the clicked image");
  need(await mobile.evaluate(() => document.body.style.overflow === "hidden"), "lightbox: page scroll must be locked while open");
  await mobile.keyboard.press("Tab");
  await mobile.keyboard.press("Tab");
  await mobile.keyboard.press("Tab");
  need(await mobile.evaluate(() => !!document.activeElement && document.getElementById("lightbox").contains(document.activeElement)), "lightbox: Tab must not escape the dialog");
  await mobile.keyboard.press("ArrowLeft");
  need((await mobile.getAttribute("#lightbox-img", "src") || "").endsWith(S.gallery[2].src), "lightbox: ArrowLeft goes to next (RTL)");
  await mobile.keyboard.press("ArrowRight");
  need((await mobile.getAttribute("#lightbox-img", "src") || "").endsWith(S.gallery[1].src), "lightbox: ArrowRight goes back");
  need((await mobile.textContent("#lightbox-count")).replace(/\s/g, "") === `2/${S.gallery.length}`, "lightbox: counter text");
  await mobile.keyboard.press("Escape");
  need(await mobile.isHidden("#lightbox"), "lightbox: Escape closes");
  need(await mobile.evaluate(() => document.body.style.overflow === ""), "lightbox: scroll lock released");
  need(await mobile.evaluate((y) => window.scrollY === y, yBeforeLightbox), "lightbox: the page must come back to the same scroll offset after closing");
  await mobile.click("#gallery-grid .gallery__item:nth-child(2)");
  await mobile.keyboard.press("ArrowLeft");
  await mobile.keyboard.press("ArrowLeft");
  await mobile.keyboard.press("Escape");
  need(await mobile.evaluate(() => document.activeElement && document.activeElement.dataset.index === "1"), "lightbox: focus returns to the originally opened item, not the last viewed one");

  // --- videos (Task 4)
  need((await mobile.$$("#videos-grid .video")).length === S.videos.length, "videos: item count");
  need((await mobile.$$eval("#videos-grid .video", (v) => v.map((x) => x.dataset.type).join(","))) === S.videos.map((v) => v.type).join(","), "videos: data-type per item");
  need((await mobile.$$("#videos-grid .video__placeholder .video__play")).length === S.videos.filter((v) => v.type === "placeholder").length, "videos: placeholder items show a play mark");
  need((await mobile.$$("#videos-grid figcaption")).length === S.videos.length, "videos: every item has a caption");

  // --- videos: non-placeholder branches on a fixture page (Task 4 fix)
  {
    const fx = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
    const fxProblems = [];
    fx.on("pageerror", (e) => fxProblems.push(`[fixture] page error: ${e.message}`));
    await fx.route("**/js/content.js", async (route) => {
      const body = fs.readFileSync(path.join(root, "js/content.js"), "utf8") + `
        window.SITE.videos = [
          { type: "youtube", src: "https://youtube.com/shorts/dQw4w9WgXcQ", title: "yt" },
          { type: "file", src: "assets/video/none.mp4", poster: "assets/img/video-01.jpg", title: "file" },
          { type: "youtube", src: "https://example.com/not-a-video", title: "bad" },
          { type: "placeholder", poster: "assets/img/video-02.jpg", title: "ph" },
        ];`;
      await route.fulfill({ status: 200, contentType: "text/javascript", body });
    });
    await fx.route("**/youtube-nocookie.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }));
    await fx.goto(base, { waitUntil: "load" });
    need((await fx.getAttribute("#videos-grid .video:nth-child(1) iframe", "src")) === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "videos: youtube branch builds nocookie embed url");
    need((await fx.getAttribute("#videos-grid .video:nth-child(1) iframe", "loading")) === "lazy", "videos: youtube iframe is lazy");
    need((await fx.getAttribute("#videos-grid .video:nth-child(2) video", "preload")) === "none", "videos: file branch preload=none");
    need(await fx.$eval("#videos-grid .video:nth-child(2) video", (v) => v.hasAttribute("controls") && v.hasAttribute("playsinline")), "videos: file branch controls+playsinline");
    need((await fx.$$("#videos-grid .video:nth-child(3) .video__placeholder .video__play")).length === 1, "videos: unrecognized youtube url falls back to placeholder");
    need((await fx.$$("#videos-grid .video:nth-child(3) iframe")).length === 0, "videos: unrecognized youtube url renders no iframe");
    need(fxProblems.length === 0, fxProblems.join("; "));
    await fx.close();
  }

  // --- a content.js that fails to parse must still leave a readable page (no .js class -> no hidden reveal)
  {
    // deliberately no console/pageerror listeners: this fixture is *expected* to log the failure
    const broken = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
    await broken.route("**/js/content.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "window.SITE = {" }));
    await broken.goto(base, { waitUntil: "load" });
    need(await broken.evaluate(() => !window.SITE), "broken content.js fixture did not actually break window.SITE");
    need(await broken.evaluate(() => [...document.querySelectorAll(".reveal")].every((n) => getComputedStyle(n).opacity === "1")), "broken content.js must not hide the page");
    need(await broken.evaluate(() => {
      const hero = document.getElementById("top");
      const heroOk = !!hero && getComputedStyle(hero).opacity === "1" && hero.getBoundingClientRect().height > 100;
      const titles = [...document.querySelectorAll(".section__title")];
      const titlesOk = titles.length >= 4
        && titles.every((t) => getComputedStyle(t).opacity === "1" && getComputedStyle(t).visibility === "visible")
        && titles.filter((t) => t.textContent.trim() && t.getBoundingClientRect().height > 0).length >= 4;
      return heroOk && titlesOk;
    }), "broken content.js must keep the hero and the section headings visible");
    await broken.close();
  }

  // --- floating button + reveal (Task 5)
  await mobile.evaluate(() => window.scrollTo(0, 0)); // earlier blocks scrolled the page (gallery click)
  await mobile.waitForTimeout(400);
  need(await mobile.evaluate(() => !document.getElementById("wa-fab").classList.contains("is-visible")), "fab: hidden while the hero is on screen");
  need((await mobile.getAttribute("#wa-fab", "href") || "").startsWith(`https://wa.me/${S.whatsapp}?text=`), "fab: whatsapp href");
  await mobile.evaluate(() => document.getElementById("contact").scrollIntoView());
  await mobile.waitForTimeout(400);
  need(await mobile.evaluate(() => document.getElementById("wa-fab").classList.contains("is-visible")), "fab: visible after scrolling past the hero");
  need(await mobile.evaluate(() => [...document.querySelectorAll(".reveal")].every((n) => n.classList.contains("is-in"))), "reveal: with reduced motion every section is marked is-in");
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.waitForTimeout(400);

  // --- reveal with motion allowed: exercises the IntersectionObserver branch, not the shortcut
  {
    const motion = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL" });
    motion.on("console", (m) => { if (m.type() === "error") problems.push(`[motion] console error: ${m.text()}`); });
    motion.on("pageerror", (e) => problems.push(`[motion] page error: ${e.message}`));
    await motion.goto(base, { waitUntil: "load" });
    need(await motion.evaluate(() => [...document.querySelectorAll(".reveal")].some((n) => !n.classList.contains("is-in"))), "reveal: default-motion path starts hidden below the fold");
    await scrollThrough(motion);
    need(await motion.evaluate(() => [...document.querySelectorAll(".reveal")].every((n) => n.classList.contains("is-in"))), "reveal: default-motion path marks every section after scrolling");
    await motion.close();
  }

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
