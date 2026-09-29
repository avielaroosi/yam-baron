# Gift Card Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone gift-card page (`gift.html`) with the owner's copy and one WhatsApp button, plus a short band on the home page that links to it.

**Architecture:** Static site, no build step. All copy lives in `js/content.js` (`window.SITE.gift`). A new small renderer `js/gift.js` fills `gift.html`; `js/main.js` gets one extra render function for the home band. Styles are appended to the single `css/style.css`. Both harness scripts in `tools/` learn about the new block and the new page.

**Tech Stack:** HTML + vanilla JS + CSS, playwright-core harness (`tools/check-page.mjs`), node content validator (`tools/check-content.mjs`). GitHub Pages hosting (push to `main` = deploy).

**Spec:** `docs/superpowers/specs/2026-09-30-gift-card-page-design.md`

## Global Constraints

- Copy is verbatim from the spec: **no commas, no dashes** in any gift text (owner request). Titles, paragraphs, closing line, button labels and the WhatsApp message are copied exactly from the spec's "הטקסט" section.
- Page name is "גיפט קארד". The string "HAIR DATE" must not appear anywhere in shipped files.
- `<html lang="he" dir="rtl">` on every page. Fonts: Playfair Display / Frank Ruhl Libre / Heebo via the existing Google Fonts link. Colors via existing CSS tokens only (`--black`, `--cream`, `--gold`, ...).
- New image file only: `assets/img/gift-01.jpg` (copy of `assets/img/gallery-b-07.jpg`). Never delete or rename existing images in this work.
- No payments, no prices, no packages, no redemption code, no dedication form.
- `gift.html` loads `js/content.js` then `js/gift.js` only. It must NOT load `js/main.js` or `js/intro.js`, and must NOT contain the promo popup markup or the intro inline gate.
- Two sessions may edit this repo at once: run `git status` before every commit and `git add` only the paths named in the task.
- Dev checks: `cd tools && node check-content.mjs && node check-page.mjs` must print `check-content: OK` and `check-page: OK` before every commit that touches `js/`, `css/`, `*.html` or `tools/`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. **`SITE.gift.enabled = false` (owner turns the gift off)** → the home band must disappear with no console error, and the home page must otherwise render as before. Pinned by the fixture test in Task 2.
2. **`js/content.js` fails to load or parse on `gift.html`** → the page must not be a black screen: the top bar and footer links back to the home page must still be visible. Pinned by the fixture test in Task 3.
3. **Old cached `js/content.js` on phones (GitHub Pages caches ~10 min)** → a visitor can load new `index.html` with an old `content.js` that has no `gift` block. `renderGiftBand` must then hide the band, not throw. Same code path as item 1; pinned by the Task 2 fixture.
4. **Narrow phone (390px) with the long title** → nothing may extend past the viewport edge on `gift.html`. Pinned by the edge-overflow check in Task 3.
5. **The floating WhatsApp button on `gift.html`** → must open WhatsApp with the *gift* message, not the site default, so Yam knows what the conversation is about. Pinned in Task 3 (`#wa-fab` href equals the gift link).

---

### Task 1: Content block + image + content validator

**Files:**
- Create: `assets/img/gift-01.jpg` (copy of `assets/img/gallery-b-07.jpg`)
- Modify: `js/content.js` (add `gift` block after `promo`, before `services`)
- Modify: `tools/check-content.mjs` (validate `SITE.gift` and its image)

**Interfaces:**
- Produces: `window.SITE.gift = { enabled, title, text[], closing, cta, whatsappText, image, alt, bandEyebrow, bandCta }` used by Tasks 2 and 3.

- [ ] **Step 1: Add the validator rules (the failing test)**

In `tools/check-content.mjs`, right after the `if (S?.promo?.enabled) { ... }` block and before `const files = [`, add:

```js
need(S?.gift && typeof S.gift === "object", "SITE.gift block is missing");
if (S?.gift) {
  for (const k of ["title", "closing", "cta", "whatsappText", "image", "alt", "bandEyebrow", "bandCta"]) need(typeof S.gift[k] === "string" && S.gift[k].trim(), `SITE.gift.${k} must be a non-empty string`);
  const gtext = [].concat(S.gift.text ?? []);
  need(gtext.length > 0 && gtext.every((t) => typeof t === "string" && t.trim()), "SITE.gift.text must be a non-empty string or a list of paragraphs");
  need(S.gift.enabled === undefined || typeof S.gift.enabled === "boolean", "SITE.gift.enabled must be true/false when present");
  const giftCopy = [S.gift.title, ...gtext, S.gift.closing, S.gift.cta, S.gift.whatsappText, S.gift.bandEyebrow, S.gift.bandCta].join(" ");
  need(!/HAIR DATE/i.test(giftCopy), "gift copy must not mention HAIR DATE (owner dropped the name)");
  need(!/[,–—]/.test([S.gift.title, ...gtext, S.gift.closing, S.gift.cta].join(" ")), "gift page copy must contain no commas or dashes (owner request)");
}
```

Then add `S?.gift?.image,` to the `files` array (any position, e.g. after `S?.about?.image,`).

- [ ] **Step 2: Run the validator to see it fail**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-content.mjs`
Expected: `check-content: FAIL` with `- SITE.gift block is missing`.

- [ ] **Step 3: Copy the image**

Run: `cd ~/Claude/Projects/yam-baron && cp assets/img/gallery-b-07.jpg assets/img/gift-01.jpg && ls -la assets/img/gift-01.jpg`

- [ ] **Step 4: Add the content block**

In `js/content.js`, after the closing `},` of the `promo: { ... }` block and before `services: [`, insert:

```js
  // גיפט קארד: עמוד נפרד (gift.html) + פס בדף הבית שמוביל אליו. enabled: false מסתיר את הפס בדף הבית.
  // הטקסט בכוונה בלי פסיקים ובלי מקפים (בקשת הבעלים). הנתיב של image מופיע גם ב-<link rel="preload"> ב-gift.html.
  gift: {
    enabled: true,
    title: "המתנה שהיא תרגיש בה הכי יפה",
    // כל פריט ברשימה = פסקה נפרדת בדף
    text: [
      "רוצה להפתיע מישהי שאת אוהבת?",
      "עם גיפט קארד אישי היא תוכל להתפנק במה שהכי מתאים לה. החלקה. תסרוקת לאירוע. או פן.",
      "כל שיער וכל בקשה הם שונים. לכן נתאים יחד את המתנה המושלמת. נדבר ונבין מה היא אוהבת ומה מתאים לה. את פרטי החבילה והמחיר נסגור באופן אישי.",
    ],
    closing: "הפתעה יפה מתחילה בשיחה אחת.",
    cta: "בואו נתאים לה מתנה",
    whatsappText: "היי ים, אשמח לתאם גיפט קארד למישהי שאני אוהבת",
    image: "assets/img/gift-01.jpg",
    alt: "תסרוקת אסופה מעוצבת מהגב",
    bandEyebrow: "גיפט קארד",
    bandCta: "לפרטים על המתנה",
  },

```

- [ ] **Step 5: Run the validator to see it pass**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-content.mjs`
Expected: `check-content: OK (N asset files verified)` where N is one more than before.

- [ ] **Step 6: Run the page harness to confirm nothing on the home page broke**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: OK`.

- [ ] **Step 7: Commit**

```bash
cd ~/Claude/Projects/yam-baron && git status --short
git add js/content.js assets/img/gift-01.jpg tools/check-content.mjs
git commit -m "content: gift card block (SITE.gift) + gift-01.jpg + validator rules

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Home-page band between testimonials and about

**Files:**
- Modify: `index.html` (new section after `#testimonials`, before `#about`)
- Modify: `js/main.js` (add `renderGiftBand()` + boot call)
- Modify: `css/style.css` (append `.gift-band*` rules)
- Modify: `tools/check-page.mjs` (band assertions + `enabled:false` fixture)

**Interfaces:**
- Consumes: `window.SITE.gift` from Task 1.
- Produces: `#gift-band`, `#gift-band-eyebrow`, `#gift-band-title`, `#gift-band-cta` (href `gift.html`).

- [ ] **Step 1: Write the failing harness assertions**

In `tools/check-page.mjs`, insert this block right before the line `// --- screenshots (full page also forces lazy images to load)`:

```js
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
```

- [ ] **Step 2: Run the harness to see it fail**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: FAIL` with `home: gift band must be visible` (and the other band lines).

- [ ] **Step 3: Add the section markup**

In `index.html`, after the closing `</section>` of `#testimonials` and before `<section class="section section--light reveal" id="about">`, insert:

```html
    <section class="section section--dark section--divided reveal gift-band" id="gift-band" hidden>
      <div class="container gift-band__inner">
        <p class="gift-band__eyebrow" id="gift-band-eyebrow"></p>
        <h2 class="gift-band__title" id="gift-band-title"></h2>
        <a class="btn btn--gold btn--big" id="gift-band-cta" href="gift.html"></a>
      </div>
    </section>

```

- [ ] **Step 4: Add the renderer**

In `js/main.js`, after `renderAbout()` and before `// ---- contact`, add:

```js
  // ---- gift card band: shows only when content.js has an enabled gift block (old cached content.js has none)
  function renderGiftBand() {
    const band = $("gift-band");
    const G = S.gift;
    if (!G || G.enabled === false) { band.hidden = true; return; }
    $("gift-band-eyebrow").textContent = G.bandEyebrow;
    $("gift-band-title").textContent = G.title;
    $("gift-band-cta").textContent = G.bandCta;
    band.hidden = false;
  }
```

In the boot list, after `safe("testimonials", renderTestimonials);` add:

```js
  safe("giftBand", renderGiftBand);
```

- [ ] **Step 5: Add the styles**

Append to the end of `css/style.css`:

```css
/* ===== gift card: home band ===== */
.gift-band[hidden] { display: none; }
.gift-band__inner { display: grid; gap: 14px; justify-items: center; text-align: center; }
.gift-band__eyebrow { margin: 0; color: var(--gold); letter-spacing: .14em; font-size: .95rem; font-weight: 500; }
.gift-band__title { font-size: clamp(1.7rem, 5vw, 2.4rem); max-width: 640px; }
.gift-band .btn { margin-top: 8px; }
```

- [ ] **Step 6: Run both checks to see them pass**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-content.mjs && node check-page.mjs`
Expected: `check-content: OK` and `check-page: OK`.

- [ ] **Step 7: Look at the band**

Open `tools/shots/mobile.png` and `tools/shots/desktop.png` (Read tool). The band must show eyebrow, title, gold button, centered, with a thin gold line above, between the testimonials grid and the About photo.

- [ ] **Step 8: Commit**

```bash
cd ~/Claude/Projects/yam-baron && git status --short
git add index.html js/main.js css/style.css tools/check-page.mjs
git commit -m "feat: gift card band on the home page (links to gift.html, hidden when SITE.gift is off)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The gift page `gift.html` + `js/gift.js`

**Files:**
- Create: `gift.html`
- Create: `js/gift.js`
- Modify: `css/style.css` (append `.topbar*`, `.gift*` rules)
- Modify: `tools/check-page.mjs` (open gift.html mobile + desktop; broken-content fixture; screenshots)

**Interfaces:**
- Consumes: `window.SITE` (`whatsapp`, `whatsappDefaultText`, `name`, `logo.mark`, `gift.*`) from Task 1.
- Produces: `gift.html` with ids `topbar-logo`, `gift-img`, `gift-title`, `gift-text`, `gift-closing`, `gift-cta`, `wa-fab`, `footer-logo`, `footer-name`, `footer-year`, `footer-home`.

- [ ] **Step 1: Write the failing harness block**

In `tools/check-page.mjs`, insert right after the gift-band block from Task 2 (still before `// --- screenshots`):

```js
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
      need((await g.title()).includes("גיפט קארד"), `${name}: <title> names the page`);
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
      if (name === "gift-desktop") need(await g.evaluate(() => { const a = document.getElementById("gift-img").getBoundingClientRect(), b = document.getElementById("gift-title").getBoundingClientRect(); return a.bottom > b.top && b.bottom > a.top; }), "gift-desktop: photo and text sit side by side");
      if (name === "gift-mobile") need(await g.evaluate(() => document.getElementById("gift-img").getBoundingClientRect().bottom <= document.getElementById("gift-title").getBoundingClientRect().top), "gift-mobile: photo sits above the text");
      await g.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
      await g.close();
    }
    {
      // content.js broken on the gift page: the visitor must still see a way home, not a black page
      const broken = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "he-IL", reducedMotion: "reduce" });
      await broken.route("**/js/content.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "window.SITE = {" }));
      await broken.goto(base + "gift.html", { waitUntil: "load" });
      need(await broken.evaluate(() => !window.SITE), "gift: broken content.js fixture did not actually break window.SITE");
      need(await broken.isVisible("#footer-home") && await broken.isVisible(".topbar__home"), "gift: with broken content.js the home links must stay visible");
      await broken.close();
    }
  }
```

- [ ] **Step 2: Run the harness to see it fail**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: FAIL` with `[gift-mobile] 404 gift.html` and page-structure failures.

- [ ] **Step 3: Create `gift.html`**

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- הנתיב כפול: אם משנים gift.image ב-js/content.js צריך לעדכן גם כאן -->
  <link rel="preload" as="image" href="assets/img/gift-01.jpg" fetchpriority="high">
  <title>גיפט קארד | YAM BARON Hair Studio</title>
  <meta name="description" content="גיפט קארד אישי מ-YAM BARON Hair Studio. המתנה שהיא תרגיש בה הכי יפה. החלקה או תסרוקת לאירוע או פן. נתאים יחד בשיחה אחת בוואטסאפ.">
  <meta name="theme-color" content="#0b0b0b">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="he_IL">
  <meta property="og:site_name" content="YAM BARON | Hair Studio">
  <meta property="og:title" content="גיפט קארד | YAM BARON">
  <meta property="og:description" content="המתנה שהיא תרגיש בה הכי יפה. נתאים יחד בשיחה אחת בוואטסאפ.">
  <meta property="og:image" content="https://avielaroosi.github.io/yam-baron/assets/img/gift-01.jpg">
  <meta property="og:url" content="https://avielaroosi.github.io/yam-baron/gift.html">
  <link rel="icon" href="assets/favicon.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="assets/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <a class="skip" href="#gift">דלג לתוכן</a>

  <header class="topbar">
    <a class="topbar__home" href="index.html" aria-label="לדף הבית">
      <img class="topbar__logo" id="topbar-logo" alt="">
      <span class="wordmark wordmark--sm">YAM BARON</span>
    </a>
  </header>

  <main>
    <section class="section section--dark gift" id="gift">
      <div class="container gift__inner">
        <img class="gift__img" id="gift-img" fetchpriority="high" alt="">
        <div class="gift__body">
          <h1 class="gift__title" id="gift-title"></h1>
          <div class="gift__text" id="gift-text"></div>
          <p class="gift__closing" id="gift-closing"></p>
          <a class="btn btn--gold btn--big" id="gift-cta" href="https://wa.me/" target="_blank" rel="noopener"></a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <img class="footer__logo" id="footer-logo" alt="" loading="lazy">
    <p><span class="wordmark wordmark--sm" id="footer-name"></span> · <span id="footer-year"></span></p>
    <p><a class="footer__home" id="footer-home" href="index.html">חזרה לדף הבית</a></p>
  </footer>

  <a class="wa-fab" id="wa-fab" href="https://wa.me/" target="_blank" rel="noopener" aria-label="וואטסאפ">
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M16 3C9.4 3 4 8.3 4 14.9c0 2.3.7 4.5 1.9 6.4L4 29l7.9-2.1c1.8 1 3.9 1.5 6.1 1.5 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.7c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.7 1.2 1.3-4.5-.3-.4A9.7 9.7 0 0 1 6.2 15c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.7-9.8 9.7zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-1 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.5.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"/></svg>
  </a>

  <script src="js/content.js"></script>
  <script src="js/gift.js"></script>
</body>
</html>
```

Note: the two `wa.me` anchors start with `href="https://wa.me/"` (not `#`) so a broken `content.js` still leaves a working WhatsApp number-less link rather than a dead `#`; `gift.js` overwrites both.

- [ ] **Step 4: Create `js/gift.js`**

```js
// Renders gift.html from window.SITE.gift (js/content.js). No dependencies, no main.js.
(function () {
  "use strict";
  const S = window.SITE;
  const G = S && S.gift;
  if (!G) { console.error("window.SITE.gift is missing: js/content.js did not load or has no gift block"); return; }

  const $ = (id) => document.getElementById(id);
  const waLink = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text || S.whatsappDefaultText)}`;
  const link = waLink(G.whatsappText);

  const img = $("gift-img");
  img.src = G.image; img.alt = G.alt;
  $("gift-title").textContent = G.title;
  const text = $("gift-text");
  text.replaceChildren();
  for (const para of [].concat(G.text)) { const p = document.createElement("p"); p.textContent = para; text.append(p); }
  $("gift-closing").textContent = G.closing;
  const cta = $("gift-cta");
  cta.href = link; cta.textContent = G.cta;

  const fab = $("wa-fab");
  fab.href = link;
  fab.classList.add("is-visible");

  const top = $("topbar-logo");
  top.src = S.logo.mark; top.alt = S.name;
  const fl = $("footer-logo");
  fl.src = S.logo.mark; fl.alt = S.name;
  $("footer-name").textContent = S.name;
  $("footer-year").textContent = String(new Date().getFullYear());
})();
```

- [ ] **Step 5: Append the styles**

Append to the end of `css/style.css`:

```css
/* ===== gift card page (gift.html) ===== */
.topbar { display: flex; justify-content: center; padding: 14px var(--pad); border-bottom: 1px solid var(--gold-line); background: var(--black); }
.topbar__home { display: inline-flex; align-items: center; gap: 12px; color: var(--cream); }
.topbar__home:hover .wordmark { color: var(--gold); }
.topbar__logo { width: 40px; height: auto; display: block; }
.gift { min-height: calc(100vh - 70px); display: grid; align-items: center; }
.gift__inner { display: grid; gap: 30px; align-items: center; }
.gift__img { width: 100%; max-width: 440px; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--gold-soft); justify-self: center; }
.gift__body { display: grid; gap: 20px; justify-items: center; text-align: center; }
.gift__title { font-size: clamp(1.9rem, 6vw, 2.8rem); max-width: 560px; }
.gift__title::after { content: ""; display: block; width: 56px; height: 1px; background: var(--gold); margin: 16px auto 0; }
.gift__text { max-width: 560px; font-size: 1.05rem; color: var(--cream-2); }
.gift__text p { margin: 0 0 14px; }
.gift__text p:last-child { margin-bottom: 0; }
.gift__closing { margin: 0; font-family: var(--font-head); font-size: 1.35rem; color: var(--gold); }
.gift .btn { margin-top: 6px; }
.footer__home { color: var(--gold); }
.footer__home:hover { text-decoration: underline; }
@media (min-width: 820px) {
  .gift__inner { grid-template-columns: 5fr 7fr; gap: 64px; }
  .gift__img { max-width: none; }
  .gift__body { text-align: start; justify-items: start; }
  .gift__title::after { margin-inline: 0; }
}
```

- [ ] **Step 6: Run both checks to see them pass**

Run: `cd ~/Claude/Projects/yam-baron/tools && node check-content.mjs && node check-page.mjs`
Expected: `check-content: OK` and `check-page: OK`, and new files `tools/shots/gift-mobile.png`, `tools/shots/gift-desktop.png`.

- [ ] **Step 7: Look at the two screenshots**

Read `tools/shots/gift-mobile.png` and `tools/shots/gift-desktop.png`. Check: photo shows the white-top updo (b-07), title in the serif heading font, three paragraphs, gold closing line, gold pill button, floating green button bottom-left, top bar with monogram, footer with "חזרה לדף הבית". Desktop: photo right column (RTL: first grid column is on the right), text left. Fix spacing in CSS if anything looks cramped, re-run Step 6.

- [ ] **Step 8: Commit**

```bash
cd ~/Claude/Projects/yam-baron && git status --short
git add gift.html js/gift.js css/style.css tools/check-page.mjs
git commit -m "feat: gift card page (gift.html + js/gift.js), WhatsApp-only CTA, harness covers it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Owner review, deploy, verify live

**Files:**
- Modify: `README.md` (one line: `gift.html` exists, content in `SITE.gift`)
- Modify: `docs/superpowers/specs/2026-09-30-hair-date-gift-card-idea.md` (status line: superseded)

- [ ] **Step 1: Show the owner the screenshots and wait for approval**

Send the owner (in Hebrew) the two gift screenshots plus the home band crop, and ask for a yes before pushing. Do not push without it (rule: verify locally + owner OK first).

- [ ] **Step 2: Docs touch-up**

In `README.md` add under the existing structure/contents notes:

```
- `gift.html` + `js/gift.js`: עמוד גיפט קארד. הטקסט ב-`js/content.js` תחת `gift`. `enabled: false` מסתיר את הפס בדף הבית (העמוד עצמו נשאר נגיש בקישור ישיר).
```

In `docs/superpowers/specs/2026-09-30-hair-date-gift-card-idea.md`, change the first status line to:

```
סטטוס: **הוחלף** ב-`2026-09-30-gift-card-page-design.md` (הבעלים ביטל חבילות/מחירים/HAIR DATE). נשמר כהיסטוריה.
```

- [ ] **Step 3: Commit the docs**

```bash
cd ~/Claude/Projects/yam-baron && git status --short
git add README.md docs/superpowers/specs/2026-09-30-hair-date-gift-card-idea.md
git commit -m "docs: README mentions gift.html; HAIR DATE idea marked superseded

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push (deploy)**

Run: `cd ~/Claude/Projects/yam-baron && git push origin main`

- [ ] **Step 5: Verify live**

Wait ~2 minutes, then:

```bash
curl -sI https://avielaroosi.github.io/yam-baron/gift.html | head -1
curl -s https://avielaroosi.github.io/yam-baron/js/content.js | grep -c "gift:"
curl -s https://avielaroosi.github.io/yam-baron/ | grep -c 'id="gift-band"'
```

Expected: `HTTP/2 200`, `1`, `1`. If `content.js` still shows `0`, GitHub Pages cache (~10 min): retry later, do not re-push.

Then run the harness against production once: `cd ~/Claude/Projects/yam-baron/tools && BASE_URL=https://avielaroosi.github.io/yam-baron/ node check-page.mjs` → `check-page: OK`.

- [ ] **Step 6: Report to the owner**

Tell the owner: the page is live at `https://avielaroosi.github.io/yam-baron/gift.html`, the band is on the home page, phones may show the old home page for up to 10 minutes. Remind: to switch the gift off later, set `enabled: false` in `js/content.js`.
