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

// Third-party embeds (the Waze live map) log their own errors inside headless Chromium
// (visitor-id 400s, storage-access denials, GeoRSS 403s). Those are not this site's bugs.
const THIRD_PARTY = /waze\.com|google\.com|gstatic\.com|googleapis\.com/;
// "compute-pressure" = Chromium logging its own Permissions-Policy default for the <video> fixture, intermittently; not this site.
const NOISE = /Missing user and visitor id|requestStorageAccess|GeoRSS|Failed to load resource|report-only Content Security Policy|compute-pressure/;
function watchErrors(page, label, sink) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = (m.location && m.location().url) || "";
    if (THIRD_PARTY.test(url) || NOISE.test(m.text())) return;
    sink.push(`[${label}] console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => { if (!NOISE.test(e.message)) sink.push(`[${label}] page error: ${e.message}`); });
}

async function open(name, viewport) {
  const page = await browser.newPage({ viewport, locale: "he-IL", reducedMotion: "reduce" });
  watchErrors(page, name, problems);
  // the promo popup has its own test page; keep it out of the general pages and screenshots
  await page.addInitScript(() => { try { localStorage.setItem("yb-promo-used", String(Date.now())); } catch (e) {} });
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
  need(wa.length >= S.services.length + 2, `expected >= ${S.services.length + 2} wa.me links (services, contact, floating button), got ${wa.length}`);
  for (const h of wa) {
    need(h.startsWith(`https://wa.me/${S.whatsapp}?text=`), `wa link has wrong number: ${h}`);
    need(/text=%[0-9A-F]{2}/.test(h), `wa link text is not URL-encoded: ${h}`);
  }
  need(await mobile.$$eval('a[href^="https://wa.me/"]', (as) => as.every((a) => a.target === "_blank")), "wa links must open in a new tab");

  // --- services
  need((await mobile.$$("#services-grid .card")).length === S.services.length, "services: one card per service");
  need((await mobile.$$eval("#services-grid .card__title", (h) => h.map((x) => x.textContent).join("|"))) === S.services.map((s) => s.title).join("|"), "services: titles mismatch");

  // --- about + contact
  need((await mobile.textContent("#about-title")).trim() === S.about.title, "about: title not rendered");
  need((await mobile.getAttribute("#contact-ig", "href")) === `https://instagram.com/${S.instagram}`, "contact: instagram link");
  need((await mobile.$$("#contact-hours li")).length === S.hours.length, "contact: hours rows");
  need(await mobile.$$eval("#contact-ig", (as) => as.length === 1 && as.every((a) => a.classList.contains("btn") && !!a.querySelector("svg") && a.href.startsWith("https://instagram.com/"))), "instagram: contact link is a styled button with an icon pointing at instagram");
  need((await mobile.$$("#hero-wa, #hero-ig, .hero__actions")).length === 0, "hero: no contact buttons (owner choice)");
  need(await mobile.$$eval("#contact-hours li span:last-child", (s) => s.every((x) => getComputedStyle(x).direction === "ltr" && getComputedStyle(x).unicodeBidi === "isolate")), "hours time values must be laid out LTR and bidi-isolated");
  need(await mobile.$$eval(".wordmark", (s) => s.length > 0 && s.every((x) => getComputedStyle(x).direction === "ltr" && getComputedStyle(x).unicodeBidi === "isolate")), "the English wordmark must be laid out LTR and bidi-isolated");
  need((await mobile.getAttribute("#contact-map", "src") || "").startsWith("https://embed.waze.com/iframe?"), "contact: Waze map embed src");
  need(((await mobile.getAttribute("#contact-waze", "href")) || "").startsWith("https://waze.com/ul?q=") && (await mobile.getAttribute("#contact-waze", "href")).endsWith("&navigate=yes"), "contact: Waze navigation link");

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

  // --- testimonials
  need((await mobile.textContent("#testimonials .section__title")).trim() === "המלצות", "testimonials: section title");
  need((await mobile.$$("#testimonials-grid .testimonial")).length === (S.testimonials || []).length, "testimonials: one card per screenshot");
  need((await mobile.isVisible("#testimonials-empty")) === ((S.testimonials || []).length === 0), "testimonials: 'coming soon' note only when the list is empty");

  // --- videos (Task 4)
  need((await mobile.$$("#videos-grid .video")).length === S.videos.length, "videos: item count");
  need((await mobile.$$eval("#videos-grid .video", (v) => v.map((x) => x.dataset.type).join(","))) === S.videos.map((v) => v.type).join(","), "videos: data-type per item");
  need((await mobile.$$("#videos-grid .video__placeholder .video__play")).length === S.videos.filter((v) => v.type === "placeholder").length, "videos: placeholder items show a play mark");
  need((await mobile.$$("#videos-grid figcaption")).length === S.videos.length, "videos: every item has a caption");

  // --- videos: non-placeholder branches on a fixture page (Task 4 fix)
  {
    const fx = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
    const fxProblems = [];
    watchErrors(fx, "fixture", fxProblems);
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
    need(await fx.$eval("#videos-grid .video:nth-child(2) video", (v) => !v.hasAttribute("controls") && v.hasAttribute("playsinline")), "videos: file branch starts without native controls (gold ring instead) and has playsinline");
    need((await fx.$$("#videos-grid .video:nth-child(2) .video__player button.video__play")).length === 1, "videos: file branch shows the gold play ring");
    need(await fx.$eval("#videos-grid .video:nth-child(2) button.video__play", (b) => { b.click(); const v = b.parentElement.querySelector("video"); return v.controls && b.parentElement.classList.contains("is-playing"); }), "videos: tapping the ring enables native controls and hides the ring");
    await fx.waitForTimeout(800); // the fixture's media cannot play here → the ring must come back
    need(await fx.$eval("#videos-grid .video:nth-child(2) .video__player", (w) => !w.classList.contains("is-playing") && !w.querySelector("video").controls), "videos: when playback fails the gold ring returns");
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
  need(await mobile.evaluate(() => document.getElementById("wa-fab").classList.contains("is-visible")), "fab: visible from the start (hero has no contact buttons)");
  need((await mobile.getAttribute("#wa-fab", "href") || "").startsWith(`https://wa.me/${S.whatsapp}?text=`), "fab: whatsapp href");
  await mobile.evaluate(() => document.getElementById("contact").scrollIntoView());
  await mobile.waitForTimeout(400);
  need(await mobile.evaluate(() => document.getElementById("wa-fab").classList.contains("is-visible")), "fab: still visible after scrolling past the hero");
  need(await mobile.evaluate(() => [...document.querySelectorAll(".reveal")].every((n) => n.classList.contains("is-in"))), "reveal: with reduced motion every section is marked is-in");
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.waitForTimeout(400);

  // --- reveal with motion allowed: exercises the IntersectionObserver branch, not the shortcut
  {
    const motion = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL" });
    watchErrors(motion, "motion", problems);
    await motion.goto(base, { waitUntil: "load" });
    need(await motion.evaluate(() => [...document.querySelectorAll(".reveal")].some((n) => !n.classList.contains("is-in"))), "reveal: default-motion path starts hidden below the fold");
    await scrollThrough(motion);
    need(await motion.evaluate(() => [...document.querySelectorAll(".reveal")].every((n) => n.classList.contains("is-in"))), "reveal: default-motion path marks every section after scrolling");
    await motion.close();
  }

  // --- opening animation (Task 9). Every page above runs with reducedMotion: "reduce",
  // which is exactly when the intro must stay out of the way — so it needs its own pages.
  // The failure that matters most here is a visitor left staring at a black screen, so the
  // teardown paths are checked as hard as the happy one.
  need(await mobile.evaluate(() => !document.getElementById("intro") && !document.documentElement.classList.contains("intro-armed")), "intro: must not run under reduced motion");
  need(await mobile.evaluate(() => getComputedStyle(document.getElementById("hero-logo")).visibility === "visible"), "intro: hero logo stays visible under reduced motion");
  {
    const intro = await browser.newPage({ viewport: { width: 900, height: 700 }, locale: "he-IL" });
    watchErrors(intro, "intro", problems);
    await intro.goto(base, { waitUntil: "commit" });

    // The overlay fades out over the hero logo it just landed on. If the logo were still
    // hidden at that moment there would be a quarter-second with no logo at all, so catch
    // the exact frame the fade starts. (Checking after teardown proves nothing: cleanup
    // unhides the logo regardless, which would mask the flash.)
    const handoff = intro.evaluate(() => new Promise((resolve) => {
      const giveUp = setTimeout(() => resolve("timeout"), 8000);
      const poll = setInterval(() => {
        const el = document.getElementById("intro");
        if (!el) return;
        clearInterval(poll);
        new MutationObserver((_, obs) => {
          if (!el.classList.contains("is-done")) return;
          obs.disconnect();
          clearTimeout(giveUp);
          resolve(getComputedStyle(document.getElementById("hero-logo")).visibility);
        }).observe(el, { attributes: true, attributeFilter: ["class"] });
      }, 16);
    }));

    // The hand-off is only invisible if the flight ends on the hero logo's exact box.
    const land = await intro.evaluate(() => new Promise((resolve) => {
      const giveUp = setTimeout(() => resolve(null), 6000);
      const poll = setInterval(() => {
        const s = document.querySelector(".intro__stage");
        if (!s) return;
        clearInterval(poll);
        // the letters' own transitions bubble through the stage, so match the stage's own
        s.addEventListener("transitionend", (e) => {
          if (e.target !== s || e.propertyName !== "transform") return;
          clearTimeout(giveUp);
          const a = s.getBoundingClientRect(), b = document.getElementById("hero-logo").getBoundingClientRect();
          resolve({ dx: a.left - b.left, dy: a.top - b.top, dw: a.width - b.width, dh: a.height - b.height });
        });
      }, 16);
    }));
    need(land && Math.abs(land.dx) < 1 && Math.abs(land.dy) < 1 && Math.abs(land.dw) < 1 && Math.abs(land.dh) < 1,
      `intro: the flight must land on the hero logo's rect, got ${JSON.stringify(land)}`);
    need(await handoff === "visible", "intro: the hero logo must be uncovered before the overlay starts fading, or the logo blinks out");
    await intro.waitForTimeout(1200);
    need(await intro.evaluate(() => !document.getElementById("intro")), "intro: overlay must remove itself");
    need(await intro.evaluate(() => document.documentElement.style.overflow !== "hidden"), "intro: scroll lock must be released");
    need(await intro.evaluate(() => !document.documentElement.classList.contains("intro-running")), "intro: must not leave the hero logo hidden");

    // same session, second load: the visitor has already seen it
    await intro.goto(base, { waitUntil: "commit" });
    await intro.waitForTimeout(250);
    need(await intro.evaluate(() => !document.documentElement.classList.contains("intro-armed") && !document.getElementById("intro")), "intro: must not replay on a second load in the same session");
    await intro.close();
  }
  {
    // js/intro.js never arrives: the inline failsafe in index.html owns the black screen
    const stuck = await browser.newPage({ viewport: { width: 900, height: 700 }, locale: "he-IL" });
    await stuck.route("**/js/intro.js", (route) => route.abort());
    await stuck.goto(base, { waitUntil: "commit" });
    await stuck.waitForTimeout(3400);
    need(await stuck.evaluate(() => !document.documentElement.classList.contains("intro-armed")), "intro: a missing intro.js must not leave the page black");
    await stuck.close();
  }
  {
    // any key gets the visitor straight to the site
    const skip = await browser.newPage({ viewport: { width: 900, height: 700 }, locale: "he-IL" });
    await skip.goto(base, { waitUntil: "commit" });
    await skip.waitForTimeout(700);
    await skip.keyboard.press("Escape");
    await skip.waitForTimeout(500);
    need(await skip.evaluate(() => !document.getElementById("intro") && document.documentElement.style.overflow !== "hidden"
      && getComputedStyle(document.getElementById("hero-logo")).visibility === "visible"), "intro: a key press must skip to the finished page");
    await skip.close();
  }

  // --- pointing at an image (Task 10). The regression this guards is the touch one: a
  // touch browser applies :hover on tap and leaves it there, so an ungated rule would
  // leave a gallery tile lifted and zoomed after the visitor closed the lightbox.
  {
    // Scroll instantly and let reveal-on-scroll settle — that transition shifts the
    // section 18px, which would slide the tile out from under the cursor mid-measure.
    const settle = async (page, id) => {
      await page.evaluate((i) => {
        const h = document.documentElement, prev = h.style.scrollBehavior;
        h.style.scrollBehavior = "auto";
        document.getElementById(i).scrollIntoView({ block: "center" });
        h.style.scrollBehavior = prev;
      }, id);
      await page.waitForFunction((i) => document.getElementById(i).classList.contains("is-in"), id, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
    };
    const moved = (t) => !!t && t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)";
    const styles = (page) => page.evaluate(() => {
      const tile = document.querySelector(".gallery__item");
      return {
        held: tile.matches(":hover"),
        tile: getComputedStyle(tile).transform,
        img: getComputedStyle(tile.querySelector("img")).transform,
        ring: getComputedStyle(tile, "::after").borderColor,
      };
    });

    const mouse = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "he-IL" });
    await mouse.goto(base, { waitUntil: "load" });
    await mouse.keyboard.press("Escape"); // past the opening animation
    await mouse.waitForTimeout(400);
    await settle(mouse, "gallery");
    await mouse.hover(".gallery__item");
    await mouse.waitForTimeout(600);
    const on = await styles(mouse);
    need(on.held, "hover: the cursor slipped off the tile, so the rest of this block proves nothing");
    need(moved(on.tile), "hover: the gallery tile must lift");
    need(moved(on.img), "hover: the photo must grow inside its frame");
    need(/rgba\(201,\s*169,\s*97,\s*0?\.5/.test(on.ring), `hover: the gold ring must appear, got ${on.ring}`);
    // keyboard gets the same highlight, and keeps the outline that marks focus itself
    await mouse.evaluate(() => document.querySelector(".gallery__item:nth-child(3)").focus());
    await mouse.waitForTimeout(500);
    need(await mouse.evaluate(() => {
      const t = document.querySelector(".gallery__item:nth-child(3)");
      const c = getComputedStyle(t);
      return c.transform !== "none" && c.outlineWidth !== "0px";
    }), "hover: a keyboard-focused tile gets the same highlight, outline included");
    await mouse.close();

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", hasTouch: true, isMobile: true });
    await touch.goto(base, { waitUntil: "load" });
    await touch.keyboard.press("Escape");
    await touch.waitForTimeout(400);
    await settle(touch, "gallery");
    need(await touch.evaluate(() => !matchMedia("(hover: hover) and (pointer: fine)").matches), "hover: the touch fixture must actually report a coarse pointer");
    // Headless Chromium does NOT reproduce the sticky :hover that real iOS Safari leaves
    // behind after a tap, so tapping here would prove nothing. Test the gate itself
    // instead: send a hover to a coarse pointer and require that nothing responds.
    await touch.hover(".gallery__item");
    await touch.waitForTimeout(600);
    const stuck = await styles(touch);
    need(!moved(stuck.tile) && !moved(stuck.img), "hover: a coarse pointer must never get the highlight — on a real phone it would stick after a tap");
    await touch.close();

    const calm = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "he-IL", reducedMotion: "reduce" });
    await calm.goto(base, { waitUntil: "load" });
    await settle(calm, "gallery");
    await calm.hover(".gallery__item");
    await calm.waitForTimeout(400);
    const quiet = await styles(calm);
    need(!moved(quiet.tile) && !moved(quiet.img), "hover: reduced motion must drop the lift and the zoom");
    need(/rgba\(201,\s*169,\s*97,\s*0?\.5/.test(quiet.ring), "hover: reduced motion must keep the gold ring as feedback");
    await calm.close();
  }

  // --- promo popup: opens after the delay, closes, stays closed for rememberDays
  if (S.promo && S.promo.enabled) {
    const pr = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
    watchErrors(pr, "promo", problems);
    await pr.addInitScript(() => { try { sessionStorage.setItem("yb-intro", "seen"); } catch (e) {} });
    await pr.goto(base, { waitUntil: "load" });
    need(await pr.isHidden("#promo"), "promo: hidden on load");
    await pr.waitForTimeout(S.promo.delayMs + 1500);
    need(await pr.isVisible("#promo"), "promo: opens after the delay");
    need(((await pr.getAttribute("#promo-cta", "href")) || "").startsWith(`https://wa.me/${S.whatsapp}?text=`), "promo: CTA is a WhatsApp link");
    need((await pr.textContent("#promo-big")).trim() === S.promo.big && (await pr.textContent("#promo-eyebrow")).trim() === S.promo.eyebrow, "promo: copy rendered from content.js");
    need(await pr.evaluate(() => document.activeElement && document.activeElement.id === "promo-close"), "promo: focus moves to the close button");
    await pr.keyboard.press("Escape");
    await pr.waitForTimeout(500);
    need(await pr.isHidden("#promo"), "promo: Escape closes");
    await pr.reload({ waitUntil: "load" });
    await pr.waitForTimeout(S.promo.delayMs + 1500);
    need(await pr.isHidden("#promo"), "promo: closing hides it for the rest of the browser session");
    await pr.evaluate(() => sessionStorage.removeItem("yb-promo-dismissed")); // = a new visit
    await pr.reload({ waitUntil: "load" });
    await pr.waitForTimeout(S.promo.delayMs + 1500);
    need(await pr.isVisible("#promo"), "promo: comes back on the next visit while the offer is unused");
    // using the offer (CTA click) hides it for good; block the WhatsApp navigation in the test
    await pr.evaluate(() => { const a = document.getElementById("promo-cta"); a.addEventListener("click", (e) => e.preventDefault(), { capture: true }); a.click(); });
    await pr.waitForTimeout(500);
    need(await pr.isHidden("#promo"), "promo: CTA click closes it");
    await pr.evaluate(() => sessionStorage.removeItem("yb-promo-dismissed"));
    await pr.reload({ waitUntil: "load" });
    await pr.waitForTimeout(S.promo.delayMs + 1500);
    need(await pr.isHidden("#promo"), "promo: after using the offer it stays hidden on later visits");
    await pr.goto(base + "?promo", { waitUntil: "load" });
    await pr.waitForTimeout(1800);
    need(await pr.isVisible("#promo"), "promo: ?promo previews it immediately even after use");
    await pr.close();
  }

  // --- gift card: home band (spec docs/superpowers/specs/2026-09-30-gift-card-page-design.md)
  if (S.gift && S.gift.enabled !== false) {
    need(await mobile.isVisible("#gift-band"), "home: gift band must be visible");
    need((await mobile.getAttribute("#gift-band-cta", "href")) === "gift.html", "home: gift band button must lead to gift.html");
    need((await mobile.textContent("#gift-band-title")).trim() === S.gift.title, "home: gift band title comes from content.js");
    need((await mobile.textContent("#gift-band-eyebrow")).trim() === S.gift.bandEyebrow && (await mobile.textContent("#gift-band-cta")).trim() === S.gift.bandCta, "home: gift band eyebrow and button label come from content.js");
    need(await mobile.evaluate(() => {
      const ids = [...document.querySelectorAll("main > section")].map((s) => s.id);
      return ids.indexOf("testimonials") + 1 === ids.indexOf("gift-band") && ids.indexOf("gift-band") + 1 === ids.indexOf("about");
    }), "home: gift band must sit between testimonials and about");
  }
  {
    // the owner switches the gift off (or a phone still holds a cached content.js without the block): band hidden, nothing logged
    const off = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
    const offProblems = [];
    watchErrors(off, "gift-off", offProblems);
    await off.route("**/js/content.js", async (route) => {
      const body = fs.readFileSync(path.join(root, "js/content.js"), "utf8") + `\n        delete window.SITE.gift;`;
      await route.fulfill({ status: 200, contentType: "text/javascript", body });
    });
    await off.goto(base, { waitUntil: "load" });
    need(await off.isHidden("#gift-band"), "home: without SITE.gift the band must be hidden");
    need(offProblems.length === 0, "home: a missing SITE.gift must not log errors: " + offProblems.join("; "));
    await off.close();
  }

  // --- gift card: the page itself
  if (S.gift && S.gift.enabled !== false) {
    const giftLink = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(S.gift.whatsappText)}`;
    for (const [name, viewport] of [["gift-mobile", { width: 390, height: 844 }], ["gift-desktop", { width: 1440, height: 900 }]]) {
      const g = await browser.newPage({ viewport, locale: "he-IL", reducedMotion: "reduce" });
      watchErrors(g, name, problems);
      g.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`[${name}] ${r.status()} ${r.url().slice(base.length)}`); });
      await g.goto(base + "gift.html", { waitUntil: "load" });
      await g.waitForTimeout(500);
      need(await g.evaluate(() => document.documentElement.dir === "rtl" && document.documentElement.lang === "he"), `${name}: html must have dir=rtl lang=he`);
      need((await g.title()) === "גיפט קארד | YAM BARON", `${name}: <title> is exactly the spec's`);
      need(!/[,\-־–—]/.test((await g.getAttribute('meta[name="description"]', "content")) || "-"), `${name}: meta description must contain no commas or dashes (owner rule)`);
      // gift.html is new, but content.js/style.css may sit in a visitor's cache for ~10 min after a deploy (GitHub Pages);
      // a versioned URL forces a fresh copy so the page never renders with a content.js that has no gift block
      need(await g.evaluate(() => /js\/content\.js\?v=/.test(document.querySelector('script[src*="content.js"]').getAttribute("src")) && /css\/style\.css\?v=/.test(document.querySelector('link[href*="style.css"]').getAttribute("href"))), `${name}: content.js and style.css must be loaded with a cache-busting ?v= query`);
      need((await g.$$("h1")).length === 1 && (await g.textContent("h1")).trim() === S.gift.title, `${name}: exactly one h1 = the gift title`);
      need((await g.$$eval("#gift-text p", (ps) => ps.map((p) => p.textContent).join("|"))) === [].concat(S.gift.text).join("|"), `${name}: paragraphs come from content.js`);
      need((await g.textContent("#gift-closing")).trim() === S.gift.closing, `${name}: closing line`);
      need((await g.getAttribute("#gift-cta", "href")) === giftLink && (await g.textContent("#gift-cta")).trim() === S.gift.cta, `${name}: CTA is the gift WhatsApp link with the gift label`);
      need((await g.getAttribute("#wa-fab", "href")) === giftLink, `${name}: the floating button carries the gift message`);
      need(await g.evaluate(() => document.getElementById("wa-fab").classList.contains("is-visible")), `${name}: floating button visible`);
      need(await g.$$eval('a[href^="https://wa.me/"]', (as) => as.length === 2 && as.every((a) => a.target === "_blank" && a.rel.includes("noopener"))), `${name}: exactly two wa links (CTA + floating), both in a new tab`);
      need((await g.$$('a[href="#"]')).length === 0, `${name}: no href='#' left`);
      need((await g.$$('a[href="index.html"]')).length === 2, `${name}: top bar and footer both link back home`);
      need(await g.evaluate(() => [...document.images].every((i) => i.getAttribute("alt") !== null)), `${name}: every <img> needs alt`);
      need((await g.getAttribute("#gift-img", "src") || "").endsWith(S.gift.image) && (await g.getAttribute("#gift-img", "alt")) === S.gift.alt, `${name}: gift photo src/alt from content.js`);
      need(await g.evaluate(() => !document.getElementById("gift-img").hasAttribute("loading")), `${name}: the gift photo must not be lazy-loaded`);
      need((await g.getAttribute("#footer-logo", "loading")) === "lazy", `${name}: footer monogram lazy`);
      need(await g.evaluate(() => !document.getElementById("promo") && !document.getElementById("intro") && !document.documentElement.classList.contains("intro-armed") && !document.querySelector('script[src$="main.js"], script[src$="intro.js"]')), `${name}: no promo popup, no intro, no main.js/intro.js on the gift page`);
      need(await g.evaluate(() => !document.body.innerHTML.includes("HAIR DATE")), `${name}: HAIR DATE must not appear`);
      need(await g.evaluate(() => [...document.querySelectorAll("body *")].every((n) => { const r = n.getBoundingClientRect(); return r.width === 0 || (r.right <= window.innerWidth + 1 && r.left >= -1); })), `${name}: an element extends past a viewport edge`);
      need(await g.evaluate(() => { const r = document.getElementById("gift-cta").getBoundingClientRect(); return r.height >= 44; }), `${name}: CTA tap target at least 44px tall`);
      need(await g.evaluate(() => [...document.images].filter((i) => i.src).every((i) => i.complete && i.naturalWidth > 0)), `${name}: some <img> failed to load`);
      // owner (30.09): the text sits ON the photo, hero style — the photo fills the first screen and every text element lies inside its box
      need(await g.evaluate(() => { const r = document.getElementById("gift-img").getBoundingClientRect(); return r.top <= 1 && r.width >= window.innerWidth - 1 && r.height >= window.innerHeight * 0.9; }), `${name}: the photo must fill the first screen`);
      need(await g.evaluate(() => { const a = document.getElementById("gift-img").getBoundingClientRect(); return ["gift-title", "gift-text", "gift-closing", "gift-cta"].every((id) => { const b = document.getElementById(id).getBoundingClientRect(); return b.top >= a.top && b.bottom <= a.bottom + 1 && b.left >= a.left - 1 && b.right <= a.right + 1; }); }), `${name}: title, text, closing line and button must lie on the photo`);
      need(await g.evaluate(() => { const r = document.getElementById("gift-cta").getBoundingClientRect(); return r.bottom <= window.innerHeight; }), `${name}: the button must be visible without scrolling`);
      await g.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
      await g.close();
    }
    {
      // content.js broken on the gift page: the visitor must still see a way home, not a black page
      const broken = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
      await broken.route("**/js/content.js*", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "window.SITE = {" })); // the * covers gift.html's ?v= query
      await broken.goto(base + "gift.html", { waitUntil: "load" });
      need(await broken.evaluate(() => !window.SITE), "gift: broken content.js fixture did not actually break window.SITE");
      need(await broken.isVisible("#footer-home") && await broken.isVisible(".topbar__home"), "gift: with broken content.js the home links must stay visible");
      await broken.close();
    }
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
