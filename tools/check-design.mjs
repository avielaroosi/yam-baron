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
    const ACTION = ".btn, .card__link, .chapter__link, .contact__tel, .contact__secondary a, .wa-fab, .skip, .hero__scroll, .lightbox__close, .lightbox__nav, .video__play, .promo__close, .gift-band__eyebrow, .promo__highlight, .promo__big-num, .gift__eyebrow, .gift__closing";
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
  // --- separation is a background change, so two touching sections must differ
  const adjacency = await page.evaluate(() => {
    const out = [];
    const secs = [...document.querySelectorAll("main > section, header.hero, footer")].filter((s) => s.getClientRects().length);
    for (let i = 1; i < secs.length; i++) {
      const a = getComputedStyle(secs[i - 1]).backgroundColor;
      const b = getComputedStyle(secs[i]).backgroundColor;
      // a section whose own background is transparent sits on an image; skip it
      if (a === "rgba(0, 0, 0, 0)" || b === "rgba(0, 0, 0, 0)") continue;
      if (a === b) out.push(`${secs[i - 1].id || "hero"} and ${secs[i].id || "footer"} share ${a} — no visible separation`);
    }
    return out;
  });
  need(adjacency.length === 0, "adjacent sections:\n    " + adjacency.join("\n    "));

  // --- section rhythm
  const pad = await page.evaluate(() => {
    const s = document.querySelector("#services");
    return s ? [parseFloat(getComputedStyle(s).paddingTop), parseFloat(getComputedStyle(s).paddingBottom)] : [0, 0];
  });
  need(pad[0] >= 96 && pad[1] >= 96, `section padding at 1440 wide is ${pad.join("/")}px, want >= 96 each`);
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
  // --- the hero video must still exist in the markup (desktop uses it)
  const heroOnDesktop = await page.evaluate(() => !!document.querySelector("#hero-video"));
  need(heroOnDesktop, "#hero-video must exist in the markup");

  // --- the phone gets the tall clip, exactly one request, and never the wide one;
  // a visitor who asked to save data gets the poster and no video at all
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const asked = [];
  phone.on("request", (r) => { if (/\.mp4/.test(r.url())) asked.push(r.url().split("/").pop()); });
  await phone.goto(base, { waitUntil: "load" });
  await phone.waitForTimeout(1200);
  need(asked.includes("hero-tall.mp4"), `phone must request hero-tall.mp4, requested: ${asked.join(", ") || "nothing"}`);
  need(!asked.includes("hero-wide.mp4"), "phone must never request hero-wide.mp4");
  const phoneHero = await phone.evaluate(() => {
    const v = document.querySelector("#hero-video"), logo = document.querySelector("#hero-logo"), r = logo.getBoundingClientRect();
    return { display: getComputedStyle(v).display, src: (v.currentSrc || v.src).split("/").pop(), poster: (v.poster || "").split("/").pop(),
             logoInView: r.top >= 0 && r.bottom <= innerHeight, heroH: document.querySelector(".hero").getBoundingClientRect().height, vh: innerHeight };
  });
  need(phoneHero.display === "block", "the hero video must render on the phone");
  need(phoneHero.poster === "hero-video-poster-tall.jpg", `phone poster is ${phoneHero.poster}, want hero-video-poster-tall.jpg`);
  need(phoneHero.logoInView, "the hero logo must sit fully inside the first phone screen");
  need(phoneHero.heroH >= phoneHero.vh * 0.9, `phone hero is ${phoneHero.heroH}px tall for a ${phoneHero.vh}px screen`);
  // the hero carries its own call to action (spec: "לוגו מעליו, CTA אחד"), so the
  // floating button is redundant there and must stay hidden until the hero scrolls away
  const heroCta = await phone.evaluate(() => {
    const a = document.querySelector(".hero__inner #hero-wa");
    return a ? { btn: a.classList.contains("btn"), wa: /^https:\/\/wa\.me\//.test(a.href), inView: a.getBoundingClientRect().bottom <= innerHeight } : null;
  });
  need(heroCta && heroCta.btn && heroCta.wa, "#hero-wa must be a .btn inside .hero__inner linking to wa.me");
  need(heroCta && heroCta.inView, "the hero CTA must fit inside the first phone screen");
  need(await phone.evaluate(() => !document.querySelector(".wa-fab").classList.contains("is-visible")), "the WhatsApp FAB must stay hidden while the hero (which has its own CTA) is on screen");

  // --- no sideways scroll and no tap target under 44px, anywhere on the phone
  const phoneLayout = await phone.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${innerWidth}`);
    for (const el of document.querySelectorAll(".btn, .wa-fab, .contact__secondary a, .contact__tel, .chapter__link, .lightbox__close, .lightbox__nav, .promo__close")) {
      if (!el.getClientRects().length) continue;
      const h = el.getBoundingClientRect().height;
      if (h < 44) out.push(`${el.className.toString().split(" ")[0]} is ${Math.round(h)}px tall, want >= 44`);
    }
    return out;
  });
  need(phoneLayout.length === 0, "phone layout:\n    " + phoneLayout.join("\n    "));

  // --- the floating button must not sit on the contact section's own button
  // (an instant jump, not smooth: html carries scroll-behavior:smooth site-wide, and
  // on a page this long a fixed wait would sample the animation mid-flight instead
  // of the settled position — every other scrollIntoView in these tools uses the
  // same override for the same reason)
  await phone.evaluate(() => {
    const html = document.documentElement, prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    document.querySelector("#contact").scrollIntoView({ block: "center" });
    html.style.scrollBehavior = prev;
  });
  await phone.waitForTimeout(700);
  need(await phone.evaluate(() => !document.querySelector(".wa-fab").classList.contains("is-visible")), "the WhatsApp FAB must hide while #contact is on screen");
  await phone.close();

  // --- data saver: poster only, nothing downloaded
  const saver = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await saver.addInitScript(() => { Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true }); });
  const savedAsked = [];
  saver.on("request", (r) => { if (/\.mp4/.test(r.url())) savedAsked.push(r.url().split("/").pop()); });
  await saver.goto(base, { waitUntil: "load" });
  await saver.waitForTimeout(1200);
  need(savedAsked.length === 0, `with saveData on, no video may load; requested: ${savedAsked.join(", ")}`);
  await saver.close();
  // --- chapters must survive a visitor who doubled their text size
  const big = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await big.goto(base, { waitUntil: "load" });
  await big.addStyleTag({ content: "html { font-size: 32px !important; }" });
  await big.waitForTimeout(300);
  const clipped = await big.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".chapter__body")) {
      if (el.scrollHeight > el.clientHeight + 2) out.push(`${el.closest(".chapter").id || "chapter"} clips its text at 2x`);
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push("the page scrolls sideways at 2x text");
    return out;
  });
  need(clipped.length === 0, "large text:\n    " + clipped.join("\n    "));
  await big.close();
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
  // --- the HIG warns against a launch screen used purely for branding; ours
  // earns its place only if it gets out of the way quickly
  const { introMs, tFlipMs } = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "intro";
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(probe);
    const cs = getComputedStyle(probe);
    const toMs = (v) => (v.endsWith("ms") ? parseFloat(v) : v.endsWith("s") ? parseFloat(v) * 1000 : parseFloat(v) || 0);
    const introMs = parseFloat(cs.getPropertyValue("--intro-total"));
    const tFlipMs = toMs(cs.getPropertyValue("--t-flip").trim());
    probe.remove();
    return { introMs, tFlipMs };
  });
  need(introMs <= 1800, `intro runs ${introMs}ms, want <= 1800`);

  // --- the flying logo must land no later than the moment the black lifts and
  // un-hides the resting hero logo underneath, or the two show at once
  const flipMs = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "intro is-landing";
    probe.style.cssText = "position:absolute;visibility:hidden";
    const stage = document.createElement("div");
    stage.className = "intro__stage";
    stage.style.cssText = "position:absolute;visibility:hidden";
    probe.append(stage);
    document.body.append(probe);
    const raw = getComputedStyle(stage).transitionDuration.split(",")[0].trim();
    probe.remove();
    return raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  });
  need(tFlipMs + flipMs <= introMs, `the flight lands at ${tFlipMs + flipMs}ms but the black lifts at ${introMs}ms — the hero logo would show under the flying one`);

  // --- one text family, and no weight downloaded that nothing uses.
  // A weight used in CSS but absent from the <link> makes the browser fake it
  // (faux bold); a weight in the <link> that no rule uses is a download for nothing.
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => {
    const out = [];
    const fam = (el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
    for (const [sel, want] of [["body", "Assistant"], [".section__title", "Assistant"], [".chapter__title", "Assistant"], [".wordmark", "Playfair Display"]]) {
      const el = document.querySelector(sel);
      if (!el) { out.push(`${sel} missing`); continue; }
      const got = fam(el);
      if (got !== want) out.push(`${sel} renders ${got}, want ${want}`);
      if (!document.fonts.check(`${getComputedStyle(el).fontWeight} 16px "${want}"`)) out.push(`${sel}: ${want} ${getComputedStyle(el).fontWeight} is not loaded — the browser is faking it`);
    }
    const link = [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].map((l) => l.href).join(" ");
    for (const dead of ["Frank+Ruhl", "Heebo"]) if (link.includes(dead)) out.push(`the font link still loads ${dead}`);
    const loaded = {};
    for (const m of link.matchAll(/family=([^:&]+):wght@([\d;]+)/g)) loaded[decodeURIComponent(m[1]).replace(/\+/g, " ")] = m[2].split(";");
    const used = new Set([...document.querySelectorAll("body *")].filter((e) => e.getClientRects().length).map((e) => `${fam(e)}|${getComputedStyle(e).fontWeight}`));
    for (const [f, ws] of Object.entries(loaded)) for (const w of ws) if (!used.has(`${f}|${w}`)) out.push(`${f} ${w} is downloaded but nothing renders it`);
    return out;
  });
  need(fonts.length === 0, "fonts:\n    " + fonts.join("\n    "));

  // --- one proof section: the single clip and the testimonials share a heading,
  // the map is back under the address, and the WhatsApp glyph is the current one
  const shorter = await page.evaluate(() => {
    const out = [];
    if (document.querySelector("#videos")) out.push("#videos section still exists — the clip belongs inside #testimonials");
    const t = document.querySelector("#testimonials");
    if (!t) out.push("#testimonials missing");
    else {
      if (!t.querySelector("#videos-grid")) out.push("#videos-grid must live inside #testimonials");
      if (!t.querySelector("#testimonials-grid")) out.push("#testimonials-grid must live inside #testimonials");
      if (t.querySelector(".section__title")?.textContent.trim() !== "המלצות") out.push("the merged section keeps the heading המלצות");
    }
    const map = document.querySelector("#contact-map");
    if (!map) out.push("#contact-map iframe missing");
    else {
      if (!/google\.com\/maps/.test(map.src) || !map.src.includes("output=embed")) out.push(`map src is not a Google Maps embed: ${map.src}`);
      if (map.getAttribute("loading") !== "lazy") out.push("map must be loading=lazy");
      if (!map.title) out.push("map iframe needs a title");
    }
    if (!document.querySelector("#contact .contact__stack #contact-wa")) out.push("#contact-wa must sit inside .contact__stack");
    if (!document.querySelector("#contact .contact__tel#contact-tel")) out.push("#contact-tel is a .contact__tel link, not a list item");
    if (document.querySelector("#contact .contact__list")) out.push(".contact__list is gone — the stack replaces it");
    for (const sel of [".wa-fab svg path", "#contact-wa svg path"]) {
      const d = document.querySelector(sel)?.getAttribute("d") || "";
      if (!d.startsWith("M17.472 14.382")) out.push(`${sel} is not the current WhatsApp glyph`);
    }
    return out;
  });
  need(shorter.length === 0, "shorter page:\n    " + shorter.join("\n    "));
} finally {
  await browser.close();
  server.close();
}

if (problems.length) { console.error("check-design: FAIL\n- " + problems.join("\n- ")); process.exit(1); }
console.log("check-design: OK");
