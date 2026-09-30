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

  for (const [label, url, dialog] of [["home", base, null], ["gift card", base + "?gift", "#gift"], ["promo", base + "?promo", "#promo"]]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(url, { waitUntil: "load" });
    // A fixed wait raced the dialog's fade: sampled before opacity crossed .5 the
    // walk skipped every element inside and passed vacuously; sampled after, it
    // failed. Wait for the dialog to be open and fully opaque, deterministically.
    if (dialog) await p.waitForFunction((sel) => { const d = document.querySelector(sel); return !!d && !d.hidden && d.classList.contains("is-open") && getComputedStyle(d).opacity === "1"; }, dialog, { timeout: 10000 });
    else await p.waitForTimeout(400);
    const low = await p.evaluate(contrastWalk);
    need(low.length === 0, `${label}: text below 4.5:1 contrast:\n    ` + low.join("\n    "));
    await p.close();
  }

  // --- no decorative chrome. Apple's tiles carry no borders, and the whole site
  // carries exactly one shadow — under photography. So this rejects every border
  // on these surfaces, and every shadow that is not the one approved photo shadow.
  const chrome = await page.evaluate(() => {
    const out = [];
    const allowed = getComputedStyle(document.documentElement).getPropertyValue("--shadow-photo").trim();
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    for (const el of document.querySelectorAll(".card, .gallery__item, .testimonial, .about__img, .video__media, .video__placeholder, .chapter__media")) {
      const cs = getComputedStyle(el);
      const name = el.className.toString().split(" ")[0];
      // the computed shadow puts the colour first, so compare on the offsets/blur
      if (cs.boxShadow !== "none" && !allowed.split(" ").every((t) => norm(cs.boxShadow).includes(t))) {
        out.push(`${name} has a shadow that is not --shadow-photo: ${cs.boxShadow}`);
      }
      if (parseFloat(cs.borderTopWidth) > 0) out.push(`${name} has a border: ${cs.borderTopWidth} ${cs.borderTopColor}`);
    }
    // the gold rule under every section title, and the two around the hero tagline
    for (const sel of [".section__title", ".hero__tagline"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      for (const pseudo of ["::after", "::before"]) {
        const c = getComputedStyle(el, pseudo).content;
        if (c && c !== "none") out.push(`${sel}${pseudo} still draws a divider`);
      }
    }
    if (parseFloat(getComputedStyle(document.querySelector(".section--divided") || document.body).borderTopWidth) > 0) {
      out.push(".section--divided still draws a rule between sections");
    }
    return out;
  });
  need(chrome.length === 0, "decorative chrome remains:\n    " + chrome.join("\n    "));

  // --- gold says "tap here" and nothing else. Anything outside ACTION that paints
  // itself gold is decoration, and decoration in the action colour is what drains
  // a call to action of its meaning.
  const strayGold = await page.evaluate(() => {
    const GOLD = ["rgb(201, 169, 97)", "rgb(125, 98, 41)"];
    const ACTION = ".btn, .card__link, .chapter__link, .contact__list a, .contact__secondary a, .wa-fab, .skip, .hero__scroll, .lightbox__close, .lightbox__nav, .video__play, .promo__close, .gift-band__eyebrow, .promo__highlight, .promo__big-num, .gift__eyebrow, .gift__closing";
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!el.getClientRects().length) continue;
      if (el.closest(ACTION)) continue;
      const cs = getComputedStyle(el);
      for (const [prop, val] of [["color", cs.color], ["background-color", cs.backgroundColor], ["border-top-color", parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : ""]]) {
        if (GOLD.includes(val)) out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} uses gold as ${prop}`);
      }
    }
    return out;
  });
  need(strayGold.length === 0, "gold used outside an action:\n    " + strayGold.join("\n    "));

  // --- type scale: display type is big and tight; Hebrew body type is neither.
  // Negative tracking is what gives Apple's headlines their grip, but Hebrew has
  // no capitals and no ascender rhythm to tighten against — squeezing it at
  // reading size only crowds it. So the scale tracks display sizes and nothing else.
  const type = await page.evaluate(() => {
    const out = [];
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);
    const h2 = document.querySelector(".section__title");
    if (h2) {
      if (px(h2, "fontSize") < 48) out.push(`section title is ${px(h2, "fontSize")}px at 1440 wide, want >= 48`);
      // an untracked heading computes to "normal", whose parseFloat is NaN — and
      // every comparison against NaN is false, so this must test the string too
      const hls = getComputedStyle(h2).letterSpacing;
      if (hls === "normal" || parseFloat(hls) >= 0) out.push(`section title must carry negative tracking, got ${hls}`);
    }
    const body = document.querySelector(".about__text p");
    if (body) {
      const size = px(body, "fontSize");
      if (Math.abs(size - 17) > 0.6) out.push(`body copy is ${size}px, want 17`);
      const ls = getComputedStyle(body).letterSpacing;
      if (ls !== "normal" && parseFloat(ls) !== 0) out.push(`body copy must not be tracked, got ${ls}`);
      if (px(body, "lineHeight") / size < 1.45) out.push("body line-height must stay at or above 1.47");
    }
    // HIG, Right to Left: Hebrew reads small beside an uppercased Latin wordmark,
    // because it has no capitals. The footer sets the two side by side.
    const year = document.querySelector(".footer__year");
    if (!year) out.push(".footer__year must exist so the Hebrew can be balanced against the wordmark");
    else if (px(year, "fontSize") <= px(year.parentElement, "fontSize")) out.push("the footer's Hebrew must be larger than the surrounding size");
    return out;
  });
  need(type.length === 0, "type scale:\n    " + type.join("\n    "));
  // [slot:task6] — the task's own assertions replace this line
  // --- ambient video must never be the only thing standing between the viewer
  // and a black rectangle: poster always set, autoplay refused under reduced motion
  const video = await page.evaluate(() => {
    const out = [];
    for (const v of document.querySelectorAll("video.is-ambient")) {
      if (!v.getAttribute("poster")) out.push(`${v.className} has no poster`);
      if (!v.muted) out.push(`${v.className} is not muted`);
      if (!v.hasAttribute("playsinline")) out.push(`${v.className} is missing playsinline`);
      if (v.hasAttribute("autoplay")) out.push(`${v.className} uses the autoplay attribute; the script must decide`);
    }
    return out;
  });
  need(video.length === 0, "ambient video:\n    " + video.join("\n    "));

  // the same page with reduced motion on must not start any video
  const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await rm.goto(base, { waitUntil: "load" });
  await rm.waitForTimeout(1200);
  const playing = await rm.evaluate(() => [...document.querySelectorAll("video.is-ambient")].filter((v) => !v.paused).map((v) => v.className));
  need(playing.length === 0, `reduced motion must not autoplay: ${playing.join(", ")}`);
  await rm.close();
  // [slot:task9] — the task's own assertions replace this line
  // [slot:task10] — the task's own assertions replace this line
  // --- one primary action per section: three buttons of equal weight is none
  const primaries = await page.evaluate(() => {
    const c = document.querySelector("#contact");
    if (!c) return -1;
    return [...c.querySelectorAll(".btn")].filter((b) => {
      const bg = getComputedStyle(b).backgroundColor;
      return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    }).length;
  });
  need(primaries === 1, `#contact has ${primaries} filled buttons, want exactly 1`);
  // [slot:task12] — the task's own assertions replace this line
} finally {
  await browser.close();
  server.close();
}

if (problems.length) { console.error("check-design: FAIL\n- " + problems.join("\n- ")); process.exit(1); }
console.log("check-design: OK");
