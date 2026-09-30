# Apple-Grade Design System — תוכנית הטמעה

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להחליף את שכבת העיצוב של האתר במערכת אחת עקבית — טוקנים, סקאלה טיפוגרפית, ריתמוס מרווחים, זהב לפעולה בלבד — בלי לגעת בתוכן.

**Architecture:** כל הערכים יושבים כמשתני CSS ב-`:root` של `css/style.css`, וכל שאר הקובץ קורא מהם. קריטריוני הקבלה מהאפיון הופכים לסקריפט בדיקה אמיתי (`tools/check-design.mjs`) שרץ מול הדף בדפדפן ובודק **ערכים מחושבים**, לא טקסט מקור. כל משימה: קודם מוסיפים טענה לסקריפט ורואים אותה נכשלת, אחר כך מתקנים את ה-CSS, אחר כך רואים אותה עוברת.

**Tech Stack:** HTML/CSS/JS סטטי, בלי פריימוורק. `playwright-core` לבדיקות (כבר מותקן ב-`tools/`).

**Spec:** [docs/superpowers/specs/2026-09-30-apple-grade-design-system-design.md](../specs/2026-09-30-apple-grade-design-system-design.md)

## Global Constraints

- `js/content.js` לא משתנה. אף מחרוזת טקסט של הבעלים לא משתנה.
- אף קובץ ב-`assets/img/` לא נמחק ולא מוחלף בשם קיים.
- `--gold: #c9a961` מותר **רק** על רקע כהה או כמילוי כפתור. על רקע קרם משתמשים ב-`--gold-on-paper: #7d6229`.
- כל טקסט חייב 4.5:1 מול הרקע האפקטיבי שלו.
- הפרדה בין שני מקטעים סמוכים = הפרש ברקע. אף פעם לא `border`.
- צל אחד בלבד באתר: `--shadow-photo`, ורק מתחת לצילום.
- `prefers-reduced-motion: reduce` מבטל כל תנועה **וכל השמעת וידאו אוטומטית**.
- כל המספרים החדשים נכנסים כמשתני CSS ב-`:root`. אין ערך קשיח בגוף הקובץ.
- הודעות קומיט באנגלית, בסגנון הקיים במאגר, עם `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Review Focus

חמישה מצבים שהאפיון מחייב אבל אף משימה לא הייתה בודקת מעצמה. לכל אחד נוספה בדיקה במשימה שמחזיקה את הקוד:

1. **זהב על קרם.** `#c9a961` על `#f4efe7` = 1.96:1. כל קישור פעולה במקטע בהיר חייב `--gold-on-paper`. → בדיקת ניגודיות, משימה 2.
2. **שני מקטעים כהים רצופים.** היום `#videos`, `#testimonials`, `#gift-band` ו-`#contact` כולם `section--dark`. אם המפריד היחיד הוא הרקע, שניים רצופים באותו גוון = אין הפרדה בכלל. → בדיקת סמיכות, משימה 6.
3. **וידאו שההשמעה האוטומטית שלו נחסמה** (iOS במצב חיסכון, דפדפן שמסרב) — הפוסטר חייב להישאר גלוי ולא להשאיר מלבן שחור. → בדיקה במשימה 8.
4. **`prefers-reduced-motion` + וידאו.** האפיון אוסר השמעה אוטומטית במצב הזה, אבל `autoplay` ב-HTML לא מכבד את ההעדפה מעצמו. → בדיקה במשימה 8.
5. **טקסט בהגדלת נגישות.** פרקי השירותים הם תמונה לצד טקסט; ב-200% גודל טקסט העמודה נחתכת. → בדיקה במשימה 10.

---

### Task 1: מתקן הבדיקה + משקל הגוף

**Files:**
- Create: `tools/check-design.mjs`
- Modify: `css/style.css` (בלוק `base`)
- Modify: `tools/package.json` (סקריפט `check`)

**Interfaces:**
- Produces: `tools/check-design.mjs` — סקריפט עצמאי. יוצא `1` עם `check-design: FAIL` ורשימה, או `0` עם `check-design: OK`. כל משימה הבאה מוסיפה לו טענות.
- Produces: פונקציית העזר `need(cond, msg)` ומערך `problems` — אותה תבנית כמו `tools/check-page.mjs`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

צור `tools/check-design.mjs`:

```js
// Loads the page in headless Chromium and asserts the design-system acceptance
// criteria from docs/superpowers/specs/2026-09-30-apple-grade-design-system-design.md
// against COMPUTED styles, not CSS source text.
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
  const inRoot = f === root || f.startsWith(root + path.sep);
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: FAIL` עם `body font-weight must be 400, got 300`.

- [ ] **Step 3: מתקנים את ה-CSS**

ב-`css/style.css`, בשורת ה-`body`, החלף `font-weight: 300` ב-`font-weight: 400`:

```css
body { margin: 0; background: var(--black); color: var(--cream); font-family: var(--font-body); font-weight: 400; line-height: 1.7; overflow-x: hidden; }
```

- [ ] **Step 4: מריצים ורואים שהיא עוברת**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`.

- [ ] **Step 5: מחברים לסקריפט הראשי**

ב-`tools/package.json`:

```json
"check": "node check-content.mjs && node check-design.mjs && node check-page.mjs"
```

- [ ] **Step 6: קומיט**

```bash
git add tools/check-design.mjs tools/package.json css/style.css
git commit -m "test: design-system check harness; body copy moves off Light weight

The HIG rules out Ultralight/Thin/Light for body text, and Hebrew at 300 on
a near-black ground is the worst case of it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: פלטת הצבעים + ניגודיות

**Files:**
- Modify: `tools/check-design.mjs` (הוספת בדיקת ניגודיות)
- Modify: `css/style.css` (בלוק `:root`)

**Interfaces:**
- Consumes: `need`, `problems` ממשימה 1.
- Produces: משתני הצבע `--ink-0`, `--ink-1`, `--paper-0`, `--paper-1`, `--gold`, `--gold-on-paper`, `--text-on-ink`, `--text-on-ink-2`, `--text-on-paper`, `--text-on-paper-2`. המשתנים הישנים `--black`, `--black-2`, `--cream`, `--cream-2`, `--grey` נשארים כרגע כאליאסים כדי שהקובץ ימשיך לעבוד; משימה 7 מסירה אותם.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`, אחרי בדיקת משקל הגוף ולפני ה-`finally`:

```js
  // --- contrast: every visible text element against its effective background
  const lowContrast = await page.evaluate(() => {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const opaque = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return false; const p = m[1].split(","); return p.length < 4 || parseFloat(p[3]) > 0.9; };
    // walk up until a non-transparent background is found
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (opaque(b)) return rgb(b); } return [255, 255, 255]; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      // only elements that render their own text
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
      if (!el.getClientRects().length) continue;
      if (el.closest(".sr-only, .skip")) continue;
      const r = ratio(rgb(cs.color), bgOf(el));
      if (r < 4.5) out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${el.textContent.trim().slice(0, 24)}" = ${r.toFixed(2)}:1`);
    }
    return out;
  });
  need(lowContrast.length === 0, "text below 4.5:1 contrast:\n    " + lowContrast.join("\n    "));
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם רשימה. `.card__title` בזהב על `--black-2` יעבור, אבל אלמנטים עם `--grey` על קרם ועם הזהב על רקעים בהירים ייפלו. רשום את הרשימה — היא מגדירה בדיוק מה משימה 4 צריכה לתקן.

- [ ] **Step 3: מוסיפים את הפלטה החדשה**

ב-`css/style.css`, בראש בלוק `:root`, לפני המשתנים הקיימים:

```css
  /* ===== palette =====
     Two golds on purpose: #c9a961 on the cream ground is 1.96:1, which is
     unreadable. Anything that says "tap here" on a light section uses the
     darker one; the bright gold stays for dark grounds and for the fill of a
     solid button (dark text on gold = 8.8:1). */
  --ink-0: #0a0a0b;
  --ink-1: #121213;
  --paper-0: #f4efe7;
  --paper-1: #ece5d9;
  --gold: #c9a961;
  --gold-on-paper: #7d6229;
  --text-on-ink: #f5f2ed;
  --text-on-ink-2: #a8a49d;
  --text-on-paper: #1a1815;
  --text-on-paper-2: #5c564d;
```

ומיד אחריהם, החלף את חמשת המשתנים הישנים באליאסים כדי שכל הקובץ ימשיך לעבוד:

```css
  /* aliases kept until task 7 sweeps the last references */
  --black: var(--ink-0);
  --black-2: var(--ink-1);
  --cream: var(--paper-0);
  --cream-2: var(--paper-1);
  --grey: var(--text-on-ink-2);
```

- [ ] **Step 4: מתקנים את מה שנפל**

לכל שורה ברשימה משלב 2: אם האלמנט יושב על רקע בהיר והצבע שלו הוא `var(--gold)` — החלף ל-`var(--gold-on-paper)`. אם הצבע שלו הוא `var(--grey)` על קרם — החלף ל-`var(--text-on-paper-2)`.

שתי השורות שידוע מראש שייפלו:

```css
.section--light .btn--ig { color: var(--text-on-paper); background: transparent; }
.promo__text { color: var(--text-on-paper-2); font-size: .98rem; max-width: 320px; }
```

- [ ] **Step 5: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`. אם נשארו שורות — חזור לשלב 4 עד שהרשימה ריקה.

- [ ] **Step 6: קומיט**

```bash
git add css/style.css tools/check-design.mjs
git commit -m "design: palette tokens, and a second gold for light grounds

#c9a961 on the cream ground measures 1.96:1. Action text on a light section
now uses #7d6229 (5.0:1); the bright gold keeps dark grounds and button fills.
The old five colour names stay as aliases until the sweep in task 7.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: הסרת הקישוט

**Files:**
- Modify: `tools/check-design.mjs`
- Modify: `css/style.css` (בלוקים `sections`, `services`, `testimonials`, `gallery`, `about`, `hero`)

**Interfaces:**
- Consumes: `need`, `problems`.
- Produces: אין מסגרות, טבעות וצללים דקורטיביים. משתנה `--shadow-photo` חדש.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`:

```js
  // --- no decorative chrome: Apple carries exactly one shadow, under photography
  const chrome = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".card, .gallery__item, .testimonial, .about__img, .video__media, .video__placeholder")) {
      const cs = getComputedStyle(el);
      if (cs.boxShadow !== "none") out.push(`${el.className.split(" ")[0]} has box-shadow: ${cs.boxShadow}`);
      if (parseFloat(cs.borderTopWidth) > 0) out.push(`${el.className.split(" ")[0]} has a border: ${cs.borderTopWidth} ${cs.borderTopColor}`);
    }
    // the rule under every section title, and the two around the hero tagline
    for (const sel of [".section__title", ".hero__tagline"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      for (const pseudo of ["::after", "::before"]) {
        const c = getComputedStyle(el, pseudo).content;
        if (c && c !== "none") out.push(`${sel}${pseudo} still draws a divider`);
      }
    }
    return out;
  });
  need(chrome.length === 0, "decorative chrome remains:\n    " + chrome.join("\n    "));
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `.card has a border`, `.section__title::after still draws a divider`, ועוד.

- [ ] **Step 3: מסירים את הקישוט**

ב-`css/style.css`:

מחק לגמרי את שתי השורות האלה:
```css
.section__title::after { content: ""; display: block; width: 56px; height: 1px; background: var(--gold); margin: 16px auto 0; }
.hero__tagline::before, .hero__tagline::after { content: ""; display: block; width: 56px; height: 1px; background: var(--gold); margin: 14px auto; }
```

הסר את ה-`border` מהכרטיס, מההמלצה, מתמונת ה"עלינו" וממסגרת הווידאו:
```css
.card { background: var(--ink-1); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; transition: var(--hl-ease); }
.testimonial { display: block; width: 100%; break-inside: avoid; margin: 0 0 12px; padding: 0; border-radius: 12px; overflow: hidden; background: var(--ink-1); cursor: zoom-in; }
.about__img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--radius); max-width: 440px; justify-self: center; box-shadow: var(--shadow-photo); transition: var(--hl-ease); }
.video__media, .video__placeholder { width: 100%; aspect-ratio: 9 / 16; border-radius: var(--radius); overflow: hidden; background: var(--ink-1); }
```

הסר את הקו העליון של מקטע ההמלצות ואת קו הפוטר:
```css
.section--divided { border-top: 0; }
.footer { padding: 28px var(--pad); text-align: center; color: var(--text-on-ink-2); font-size: .9rem; }
```

הוסף את הצל היחיד ל-`:root`:
```css
  --shadow-photo: 0 3px 30px rgba(0, 0, 0, .22);
```

בבלוק `@media (hover: hover)`, הסר את הצל ואת הטבעת מה-hover והשאר רק את ההרמה והזום:
```css
  .gallery__item:hover { transform: translateY(var(--hl-lift)); }
  .gallery__item:hover img { transform: scale(var(--hl-zoom)); }
  .card:hover { transform: translateY(var(--hl-lift)); }
  .card:hover .card__img { transform: scale(var(--hl-zoom)); }
  .about__img:hover { transform: scale(1.02); }
  .video__placeholder:hover img { transform: scale(var(--hl-zoom)); opacity: .72; }
  .video__placeholder:hover .video__play { transform: scale(1.08); background: rgba(11, 11, 11, .5); }
```

מחק את הכלל `.gallery__item::after` (שכבת הטבעת) ואת `.gallery__item:hover::after`.

ב-`.gallery__item:focus-visible` השאר רק את ה-`outline` ואת ההרמה — מחק את `box-shadow: var(--hl-shadow)`.

- [ ] **Step 4: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`.

- [ ] **Step 5: קומיט**

```bash
git add css/style.css tools/check-design.mjs
git commit -m "design: strip decorative chrome — borders, rings, dividers, card shadows

Apple's product pages carry no borders on tiles and exactly one shadow, under
product photography. The gold rule under every section title and the two around
the hero tagline go with them; separation becomes the background change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: זהב לפעולה בלבד

**Files:**
- Modify: `tools/check-design.mjs`
- Modify: `css/style.css` (בלוקים `services`, `contact`)

**Interfaces:**
- Consumes: `need`, `problems`, `--gold`, `--gold-on-paper`.
- Produces: רשימת ההיתר `ACTION_SELECTORS` בתוך הסקריפט — כל משימה שמוסיפה אלמנט פעולה חדש מוסיפה אליה.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`:

```js
  // --- gold says "tap here" and nothing else
  const strayGold = await page.evaluate(() => {
    const GOLD = ["rgb(201, 169, 97)", "rgb(125, 98, 41)"];
    const ACTION = ".btn, .card__link, .contact__list a, .wa-fab, .skip, .hero__scroll, .lightbox__close, .lightbox__nav, .promo__close, .gift-band__eyebrow, .promo__highlight, .promo__big-num, .gift__eyebrow, .gift__closing";
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `h3.card__title uses gold as color`.

- [ ] **Step 3: מעבירים את כותרת הכרטיס לדיו**

ב-`css/style.css`:

```css
.card__title { font-size: 1.35rem; color: var(--text-on-ink); }
```

- [ ] **Step 4: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`. אם צצו שורות נוספות — או שהאלמנט הוא באמת פעולה (הוסף אותו ל-`ACTION`), או שהוא קישוט (העבר אותו לצבע טקסט).

- [ ] **Step 5: קומיט**

```bash
git add css/style.css tools/check-design.mjs
git commit -m "design: gold becomes an action colour only

Service card titles move to the ink text colour. The check now fails on any
gold that is not a button, an action link or a focus state.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: הסקאלה הטיפוגרפית + ניואנס ה-RTL

**Files:**
- Modify: `tools/check-design.mjs`
- Modify: `css/style.css` (בלוקים `tokens`, `base`, `sections`, `hero`, `about`)
- Modify: `index.html` (שורה אחת בפוטר)

**Interfaces:**
- Consumes: `need`, `problems`.
- Produces: `--step-hero`, `--step-h2`, `--step-h3`, `--step-lead`, `--step-body`, `--step-small` ו-`--track-display`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`:

```js
  // --- type scale: display type is big and tight; Hebrew body type is neither
  const type = await page.evaluate(() => {
    const out = [];
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);
    const h2 = document.querySelector(".section__title");
    if (h2) {
      if (px(h2, "fontSize") < 48) out.push(`section title is ${px(h2, "fontSize")}px at 1440 wide, want >= 48`);
      if (px(h2, "letterSpacing") >= 0) out.push("section title must carry negative tracking");
    }
    const body = document.querySelector(".about__text p");
    if (body) {
      const size = px(body, "fontSize");
      if (Math.abs(size - 17) > 0.6) out.push(`body copy is ${size}px, want 17`);
      // Hebrew at reading size gains nothing from tight tracking
      const ls = getComputedStyle(body).letterSpacing;
      if (ls !== "normal" && parseFloat(ls) !== 0) out.push(`body copy must not be tracked, got ${ls}`);
      if (px(body, "lineHeight") / size < 1.45) out.push("body line-height must stay at or above 1.47");
    }
    return out;
  });
  need(type.length === 0, "type scale:\n    " + type.join("\n    "));
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `section title is 41.6px at 1440 wide, want >= 48` ו-`section title must carry negative tracking`.

- [ ] **Step 3: מוסיפים את הסקאלה**

ב-`:root` של `css/style.css`:

```css
  /* ===== type scale =====
     Bigger is tighter, the way Apple's display type runs. The tracking applies
     to display sizes only: Hebrew at reading size gains nothing from being
     squeezed, so --step-body and --step-small stay untracked. */
  --step-hero: clamp(2.75rem, 8vw, 5.5rem);
  --step-h2: clamp(2rem, 5.5vw, 3.5rem);
  --step-h3: clamp(1.375rem, 3vw, 1.75rem);
  --step-lead: clamp(1.125rem, 2.2vw, 1.5rem);
  --step-body: 1.0625rem;
  --step-small: .9375rem;
  --track-display: -.015em;
```

ואז החל אותם:

```css
body { margin: 0; background: var(--ink-0); color: var(--text-on-ink); font-family: var(--font-body); font-weight: 400; font-size: var(--step-body); line-height: 1.5; overflow-x: hidden; }
h1, h2, h3 { font-family: var(--font-head); font-weight: 500; line-height: 1.1; letter-spacing: var(--track-display); margin: 0; }
.section__title { font-size: var(--step-h2); line-height: 1.08; text-align: center; margin-bottom: clamp(28px, 5vw, 52px); }
.card__title { font-size: var(--step-h3); line-height: 1.2; color: var(--text-on-ink); }
.card__desc { color: var(--text-on-ink-2); font-size: var(--step-body); }
.hero__tagline { font-family: var(--font-head); font-size: var(--step-lead); letter-spacing: var(--track-display); }
.hero__text { max-width: 560px; color: var(--text-on-ink-2); font-size: var(--step-body); }
.about__text { font-size: var(--step-body); max-width: var(--measure); margin-inline: auto; text-align: start; }
.video__title { text-align: center; color: var(--text-on-ink-2); font-size: var(--step-small); }
```

- [ ] **Step 4: מאזנים עברית מול לטינית בפוטר**

ה-HIG, Right to Left: *"Hebrew text can appear too small when next to uppercased Latin text, because Hebrew doesn't include uppercase letters."* בפוטר `YAM BARON` יושב ליד השנה בעברית.

ב-`index.html`, עטוף את השנה:
```html
    <p><span class="wordmark wordmark--sm" id="footer-name"></span> · <span class="footer__year" id="footer-year"></span></p>
```

וב-`css/style.css`:
```css
/* Hebrew has no capitals, so it reads small beside an uppercased Latin wordmark.
   HIG, Right to Left: balance the two by growing the Hebrew side. */
.footer__year { font-size: 1.08em; }
```

- [ ] **Step 5: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`.

- [ ] **Step 6: קומיט**

```bash
git add css/style.css index.html tools/check-design.mjs
git commit -m "design: a real type scale, with tracking reserved for display sizes

Section titles go from 41.6px to 56px at 1440 and pick up negative tracking;
body copy lands on 17px/1.5, untracked. Hebrew at reading size gains nothing
from tight tracking, so the scale applies it only above --step-h3. The footer
year grows 8% to balance the uppercased Latin wordmark beside it (HIG, RTL).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: ריתמוס המרווחים + סמיכות מקטעים

**Files:**
- Modify: `tools/check-design.mjs`
- Modify: `css/style.css` (בלוקים `tokens`, `sections`, `gallery`)
- Modify: `index.html` (מחלקות על ארבעה מקטעים)

**Interfaces:**
- Consumes: `need`, `problems`, `--ink-0`, `--ink-1`, `--paper-0`, `--paper-1`.
- Produces: `--sp-1`…`--sp-8`, `--section-y`, `--measure`, `--container`. מחלקות `section--ink-1` ו-`section--paper-1`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`:

```js
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `videos and testimonials share rgb(10, 10, 11)` ועם `section padding at 1440 wide is 110/110px` — הריפוד עובר, הסמיכות לא.

- [ ] **Step 3: מוסיפים את סולם המרווחים**

ב-`:root`:

```css
  --sp-1: 8px; --sp-2: 16px; --sp-3: 24px; --sp-4: 32px;
  --sp-5: 48px; --sp-6: 64px; --sp-7: 96px; --sp-8: 128px;
  --section-y: clamp(72px, 10vw, 120px);
  --measure: 680px;
  --container: 1240px;
```

והחל:
```css
.section { padding: var(--section-y) 0; }
.gallery { display: grid; gap: var(--sp-3); grid-template-columns: repeat(2, 1fr); }
@media (min-width: 760px) { .gallery { grid-template-columns: repeat(5, 1fr); gap: var(--sp-3); } }
```

- [ ] **Step 4: מוסיפים את הגוונים החלופיים**

ב-`css/style.css`, ליד `.section--dark` ו-`.section--light`:

```css
/* Separation is the background change, so two dark sections in a row need two
   different darks. Same for two light ones. */
.section--ink-1 { background: var(--ink-1); color: var(--text-on-ink); }
.section--paper-1 { background: var(--paper-1); color: var(--text-on-paper); }
```

ב-`index.html`, הוסף את המחלקה לשלושה מקטעים כדי לשבור את הרצפים:

```html
    <section class="section section--ink-1 reveal" id="videos">
```
```html
    <section class="section section--dark section--divided reveal" id="testimonials">
```
```html
    <section class="section section--ink-1 reveal" id="contact">
```

- [ ] **Step 5: נותנים לסרטונים את המקטע במלואו**

היום הווידאו הוא קלפון 9:16 צר במרכז שטח כהה גדול. תן לו את הרוחב:

```css
.videos { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(260px, 380px)); justify-content: center; max-width: var(--container); margin-inline: auto; }
@media (min-width: 820px) {
  /* a single clip has no grid to sit in — let it stand at a confident size */
  .videos:has(.video:only-child) { grid-template-columns: minmax(0, 460px); }
}
```

- [ ] **Step 6: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`. אם נשאר רצף — הוסף `section--ink-1` או `section--paper-1` לאחד משני המקטעים בשורה שהודפסה.

- [ ] **Step 7: קומיט**

```bash
git add css/style.css index.html tools/check-design.mjs
git commit -m "design: one spacing scale, and two darks so stacked sections separate

With the dividing rules gone, separation is the background change alone — which
silently failed where four dark sections ran together. Videos and contact move
to the second dark; the check now fails on any two touching sections that share
a background.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: טאטוא האליאסים

**Files:**
- Modify: `css/style.css` (כל הקובץ)

**Interfaces:**
- Consumes: כל המשתנים מהמשימות 2–6.
- Produces: `:root` בלי `--black`, `--black-2`, `--cream`, `--cream-2`, `--grey`.

- [ ] **Step 1: מוצאים את מה שנשאר**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron && grep -n -- "--black\b\|--black-2\|--cream\b\|--cream-2\|--grey" css/style.css
```

- [ ] **Step 2: מחליפים כל מופע**

`var(--black)` → `var(--ink-0)` · `var(--black-2)` → `var(--ink-1)` · `var(--cream)` → `var(--paper-0)` · `var(--cream-2)` → `var(--paper-1)` · `var(--grey)` → `var(--text-on-ink-2)`

שים לב: מופעים של `rgba(11, 11, 11, …)` הם ערכים קשיחים של הרקע הישן. החלף אותם ל-`rgba(10, 10, 11, …)` כדי שיתאימו ל-`--ink-0`.

- [ ] **Step 3: מוחקים את חמשת האליאסים**

מחק מ-`:root` את הבלוק `aliases kept until task 7`.

- [ ] **Step 4: מוודאים שאין שארית**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron && grep -n -- "--black\|--cream\|--grey" css/style.css
```
צפוי: אין פלט.

- [ ] **Step 5: מריצים את כל הבדיקות**

```bash
cd tools && npm run check
```
צפוי: שלושתן `OK`.

- [ ] **Step 6: קומיט**

```bash
git add css/style.css
git commit -m "refactor: drop the old colour aliases, one name per colour

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: נכסי הווידאו

**Files:**
- Create: `assets/video/hero-wide.mp4`, `assets/video/hero-tall.mp4`, `assets/video/chapter-straightening.mp4`, `assets/video/chapter-bridal.mp4`, `assets/video/chapter-events.mp4`
- Create: `assets/img/hero-video-poster.jpg` ושלוש תמונות פוסטר לפרקים
- Modify: `tools/check-design.mjs`
- Modify: `js/main.js` (בלוק `videos`)
- Modify: `README.md`

**Interfaces:**
- Consumes: ששת הקליפים שכבר הורדו ל-`<scratch>/clips/` (ראה שלב 1).
- Produces: פונקציה `mountAmbientVideo(el)` ב-`js/main.js` — מקבלת אלמנט `<video>`, מפעילה אותו רק אם מותר, ומשאירה את הפוסטר אם לא.

- [ ] **Step 1: מעתיקים לפי השיוך שנקבע אחרי הצפייה**

ששת הקליפים נבדקו פריים-פריים. השיוך **שונה** ממה שתוכנן מראש, משתי סיבות אמיתיות:
הקליפ שנועד לפתיח נכנס יותר מדי ואיבד את הקומפוזיציה, וקליפ המסרק יצא הטוב ביותר בסדרה
(אנטומיה נכונה, אחיזה טבעית) — אז הוא לוקח את פרק ההחלקות.

```bash
C="<scratch>/clips"   # the folder the six clips were downloaded to
cd /Users/avielaroosi/Claude/Projects/yam-baron/assets/video
cp "$C/3-straightening.mp4" hero-wide.mp4              # light sweep, wide, calm under a logo
cp "$C/2-hero-tall.mp4"     hero-tall.mp4              # keeps the whole composition on a phone
cp "$C/6-brush.mp4"         chapter-straightening.mp4  # the comb glide — best of the set
cp "$C/4-bridal.mp4"        chapter-bridal.mp4         # sleek low bun
cp "$C/5-events.mp4"        chapter-events.mp4         # soft waves
ls -lh *.mp4
```

`1-hero-wide.mp4` לא בשימוש — הוא התקרב לקצוות השיער ואיבד את המסגור.

- [ ] **Step 2: מכווצים את קליפ האירועים**

`chapter-events.mp4` יוצא 5.7MB, מעל התקרה של 4MB. אין ffmpeg על המחשב; הדרך המתועדת
ב-`README.md` היא סביבה זמנית:

```bash
cd /private/tmp && python3 -m venv ffenv && ./ffenv/bin/pip -q install imageio-ffmpeg
FF=$(./ffenv/bin/python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
cd /Users/avielaroosi/Claude/Projects/yam-baron/assets/video
"$FF" -y -i chapter-events.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -crf 26 -movflags +faststart -an chapter-events-720.mp4
mv chapter-events-720.mp4 chapter-events.mp4
ls -lh chapter-events.mp4
```
צפוי: מתחת ל-2MB. `-an` מסיר את רצועת השמע — הקליפים האלה מושתקים ממילא.

אם אחד מהקליפים האחרים חוצה 4MB, הרץ עליו את אותה שורה.

- [ ] **Step 3: מייצרים פוסטרים**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron/tools
node video-poster.mjs ../assets/video/hero-wide.mp4 ../assets/img/hero-video-poster.jpg 0
node video-poster.mjs ../assets/video/chapter-straightening.mp4 ../assets/img/chapter-straightening-poster.jpg 0
node video-poster.mjs ../assets/video/chapter-bridal.mp4 ../assets/img/chapter-bridal-poster.jpg 0
node video-poster.mjs ../assets/video/chapter-events.mp4 ../assets/img/chapter-events-poster.jpg 0
```

- [ ] **Step 4: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`, בסוף בלוק ה-`try`:

```js
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
```

- [ ] **Step 5: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `OK` — עדיין אין אלמנט `video.is-ambient` בדף. זה תקין: הבדיקה נדרכת ומשימה 9 היא זו שמכניסה את האלמנט. המשך לשלב 5.

- [ ] **Step 6: כותבים את המנוע**

ב-`js/main.js`, בתוך ה-IIFE, אחרי בלוק ה-`videos`:

```js
  // ---- ambient video: decorative loops behind the hero and the service chapters.
  // The poster carries the frame on its own, so a browser that refuses to autoplay
  // (iOS low power mode) and a visitor who asked for less motion both land on a
  // still image rather than a black rectangle. Never uses the autoplay attribute:
  // the decision is made here so prefers-reduced-motion can veto it.
  const calmer = matchMedia("(prefers-reduced-motion: reduce)");

  function mountAmbientVideo(el) {
    if (calmer.matches) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { el.play().catch(() => {}); } else { el.pause(); }
      }
    }, { threshold: 0.1 });
    io.observe(el);
  }

  function initAmbientVideo() {
    document.querySelectorAll("video.is-ambient").forEach(mountAmbientVideo);
  }
```

והוסף לבלוק ה-boot בסוף הקובץ, אחרי `safe("reveal", initReveal);`:

```js
  safe("ambient", initAmbientVideo);
```

- [ ] **Step 7: מתעדים ב-README**

הוסף ל-`README.md`, אחרי סעיף הסרטונים:

```markdown
**סרטוני רקע (אווירה):** חמישה קליפים קצרים ב-`assets/video/` בשמות `hero-*` ו-`chapter-*`.
הם **קישוט בלבד** — מושתקים, בלופ, בלי קול ובלי כיתוב — ולכן לכל אחד יש תמונת פוסטר שמחזיקה
את הפריים לבדה. דפדפן שמסרב להשמעה אוטומטית, או מבקרת שביקשה פחות תנועה, רואים את הפוסטר
ולא מלבן שחור. הם הונפשו מהתמונות האמיתיות של ים, רק מתמונות שבהן הפנים לא נראות.
הסרטון של הלקוחה (`yam-02.mp4`) הוא היחיד שמציג תוצאה אמיתית, והוא לא נגע.
```

- [ ] **Step 8: קומיט**

```bash
git add assets/video assets/img js/main.js tools/check-design.mjs README.md
git commit -m "feat: ambient video engine — poster-first, reduced-motion aware

Five decorative loops animated from Yam's own photographs, and only from frames
where no face is visible. The autoplay attribute is deliberately absent: the
script decides, so prefers-reduced-motion can veto it and a browser that refuses
playback lands on the poster instead of a black rectangle.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: הפתיח מחדש

**Files:**
- Modify: `index.html` (בלוק `header.hero`)
- Modify: `css/style.css` (בלוק `hero`)
- Modify: `js/main.js` (פונקציית `renderHero`)
- Modify: `tools/check-design.mjs`

**Interfaces:**
- Consumes: `mountAmbientVideo` ממשימה 8, `--step-hero`, `--section-y`.
- Produces: `#hero-video` — אלמנט `<video class="is-ambient">` שמקור ה-`src` שלו נקבע ב-`renderHero` לפי רוחב המסך.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`:

```js
  // --- the hero video is desktop-only: 15MB of loops must not reach a phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const asked = [];
  phone.on("request", (r) => { if (r.resourceType() === "media" || /\.mp4/.test(r.url())) asked.push(r.url()); });
  await phone.goto(base, { waitUntil: "load" });
  await phone.waitForTimeout(1000);
  need(!asked.some((u) => /hero-/.test(u)), `phone requested a hero video: ${asked.join(", ")}`);
  const heroPoster = await phone.evaluate(() => { const v = document.querySelector("#hero-video"); return v ? getComputedStyle(v).display : "none"; });
  need(heroPoster === "none", "the hero video element must not render below 820px");
  await phone.close();
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `the hero video element must not render below 820px` — האלמנט עוד לא קיים, אז `document.querySelector` מחזיר `null` וה-ternary מחזיר `"none"`. זה יעבור בטעות. תקן קודם את הבדיקה כך שתדרוש שהאלמנט **קיים** בדסקטופ:

```js
  const heroOnDesktop = await page.evaluate(() => !!document.querySelector("#hero-video"));
  need(heroOnDesktop, "#hero-video must exist in the markup");
```
הרץ שוב. צפוי: `FAIL` עם `#hero-video must exist in the markup`.

- [ ] **Step 3: מוסיפים את האלמנט**

ב-`index.html`, החלף את `<div class="hero__media">`:

```html
    <div class="hero__media">
      <video class="hero__video is-ambient" id="hero-video" muted loop playsinline preload="none"></video>
      <img class="hero__bg" id="hero-img" fetchpriority="high" alt="">
    </div>
```

- [ ] **Step 4: קובעים את המקור לפי רוחב**

ב-`js/main.js`, בתוך `renderHero`, אחרי קביעת `hero-img`:

```js
    // The loops are 2-4MB each; a phone gets the still photograph instead.
    const heroVideo = document.getElementById("hero-video");
    if (heroVideo && matchMedia("(min-width: 820px)").matches) {
      heroVideo.poster = "assets/img/hero-video-poster.jpg";
      heroVideo.src = "assets/video/hero-wide.mp4";
      heroVideo.preload = "metadata";
    }
```

- [ ] **Step 5: מעצבים**

ב-`css/style.css`, בבלוק `hero`:

```css
.hero__video { display: none; }
@media (min-width: 820px) {
  .hero { display: block; min-height: 100svh; }
  .hero__media { position: absolute; inset: 0; height: 100%; }
  .hero__video { display: block; position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hero__bg { display: none; }
  .hero__media::after { background: linear-gradient(180deg, rgba(10, 10, 11, .45) 0%, rgba(10, 10, 11, .15) 40%, rgba(10, 10, 11, .85) 100%); }
  .hero__inner { position: relative; z-index: 1; margin-top: 0; min-height: 100svh; align-content: center; padding: var(--section-y) var(--pad); }
}
```

- [ ] **Step 6: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs && node check-page.mjs
```
צפוי: שתיהן `OK`. פתח את `tools/shots/desktop.png` ואת `tools/shots/mobile.png` וודא שהפתיח נראה נכון בשניהם.

- [ ] **Step 7: קומיט**

```bash
git add index.html css/style.css js/main.js tools/check-design.mjs
git commit -m "design: the hero becomes a full-bleed canvas, video on desktop only

The photograph moves from a 48vw column to the whole frame. The loop is
2-4MB, so it is requested only above 820px; a phone gets the still it always
had. The check fails if a phone-sized viewport ever requests a hero video.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: השירותים הופכים לפרקים

**Files:**
- Modify: `js/main.js` (פונקציית רינדור השירותים)
- Modify: `css/style.css` (בלוק `services`)
- Modify: `tools/check-design.mjs`

**Interfaces:**
- Consumes: `SITE.services` (ללא שינוי במבנה), `mountAmbientVideo`, `--measure`, `--step-h2`.
- Produces: מחלקות `.chapter`, `.chapter__media`, `.chapter__body`, `.chapter--flip`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`:

```js
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `OK` — אין עדיין `.chapter`. הבדיקה נדרכת לשלב הבא; המשך.

- [ ] **Step 3: משנים את הרינדור**

ב-`js/main.js`, החלף את גוף פונקציית רינדור השירותים כך שתייצר פרק במקום כרטיס. שמור על אותה קריאה ל-`SITE.services` ועל אותם שדות:

```js
  // ---- services, as chapters: a photograph and a paragraph rather than a card
  function renderServices() {
    const grid = $("services-grid");
    S.services.forEach((s, i) => {
      grid.append(el("article", { class: "chapter" + (i % 2 ? " chapter--flip" : ""), id: "service-" + s.id }, [
        el("div", { class: "chapter__media" }, [
          el("img", { loading: "lazy", src: s.image, alt: s.title }),
        ]),
        el("div", { class: "chapter__body" }, [
          el("h3", { class: "chapter__title", text: s.title }),
          ...[].concat(s.desc).map((para) => el("p", { class: "chapter__text", text: para })),
          el("a", { class: "chapter__link", href: waLink(s.whatsappText), target: "_blank", rel: "noopener", text: "לתיאום בוואטסאפ ←" }),
        ]),
      ]));
    });
  }
```

שלושת העוגנים נשמרים: ה-`id` נשאר `service-<id>`, `waLink` ו-`el` הן פונקציות העזר הקיימות בראש ה-IIFE, וכיתוב הכפתור לא משתנה.

- [ ] **Step 4: מעצבים**

ב-`css/style.css`, החלף את בלוק `services`:

```css
/* ===== services as chapters =====
   No card, no frame, no shadow: a photograph and a paragraph, alternating sides.
   The body is a grid so the text can grow without the column clipping it. */
.cards { display: grid; gap: var(--sp-8); }
.chapter { display: grid; gap: var(--sp-5); align-items: center; }
.chapter__media { border-radius: var(--radius); overflow: hidden; }
.chapter__media img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; display: block; }
.chapter__body { display: grid; gap: var(--sp-3); align-content: center; }
.chapter__title { font-size: var(--step-h2); line-height: 1.08; color: var(--text-on-ink); }
.chapter__text { color: var(--text-on-ink-2); max-width: var(--measure); }
.chapter__link { color: var(--gold); font-weight: 500; justify-self: start; }
.chapter__link:hover { text-decoration: underline; }
@media (min-width: 820px) {
  .chapter { grid-template-columns: 1fr 1fr; gap: var(--sp-7); }
  .chapter--flip .chapter__media { order: 2; }
}
```

הוסף `.chapter__link` לרשימת ה-`ACTION` בבדיקת הזהב ב-`tools/check-design.mjs`.

- [ ] **Step 5: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs && node check-content.mjs && node check-page.mjs
```
צפוי: שלושתן `OK`. אם בדיקת הטקסט הגדול נכשלת — הסר גובה קבוע מ-`.chapter__body`.

- [ ] **Step 6: קומיט**

```bash
git add js/main.js css/style.css tools/check-design.mjs
git commit -m "design: services become full-width chapters instead of cards

A photograph and a paragraph, alternating sides, with no frame or shadow around
them. The check now doubles the root font size and fails if a chapter clips its
text or the page starts scrolling sideways.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: יצירת קשר — פעולה ראשית אחת

**Files:**
- Modify: `index.html` (בלוק `#contact`)
- Modify: `css/style.css` (בלוק `contact`, `buttons`)
- Modify: `tools/check-design.mjs`

**Interfaces:**
- Consumes: `--gold`, `--step-h2`, `--sp-*`.
- Produces: מחלקה `.contact__secondary`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

```js
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `#contact has 2 filled buttons, want exactly 1` (וואטסאפ ואינסטגרם).

- [ ] **Step 3: משנים את ההיררכיה**

ב-`index.html`, בבלוק `#contact`, הפוך את אינסטגרם וּוייז לקישורים משניים:

```html
            <div class="contact__actions">
              <a class="btn btn--wa btn--big" id="contact-wa" href="#" target="_blank" rel="noopener">לתיאום תור בוואטסאפ</a>
            </div>
            <div class="contact__secondary">
              <a id="contact-ig" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>אינסטגרם</span></a>
              <a id="contact-waze" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 20 20 12 16 4 20z"/></svg><span>נווט בוויז</span></a>
            </div>
```

- [ ] **Step 4: מעצבים**

```css
.contact__secondary { display: flex; flex-wrap: wrap; gap: var(--sp-4); justify-content: center; }
.contact__secondary a { display: inline-flex; align-items: center; gap: var(--sp-1); color: var(--gold); font-size: var(--step-body); }
.contact__secondary a:hover { text-decoration: underline; }
.contact__secondary a:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }
```

הוסף `.contact__secondary a` לרשימת ה-`ACTION` בבדיקת הזהב.

- [ ] **Step 5: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs && node check-page.mjs
```
צפוי: שתיהן `OK`. `check-page.mjs` מאמת שקישורי הוואטסאפ עדיין נבנים — ודא שהוא עובר, כי ה-IDs לא השתנו.

- [ ] **Step 6: קומיט**

```bash
git add index.html css/style.css tools/check-design.mjs
git commit -m "design: contact gets one primary action instead of three equal ones

WhatsApp stays a filled button; Instagram and Waze become text links. The check
fails if the section ever grows a second filled button.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: תנועה, תזמון הפתיחה, בדיקה סופית ותיעוד

**Files:**
- Modify: `css/style.css` (בלוקים `tokens`, `reveal on scroll`, `intro`, `buttons`)
- Modify: `README.md`
- Modify: `tools/check-design.mjs`

**Interfaces:**
- Consumes: כל המשימות הקודמות.
- Produces: `--ease`, `--dur-micro`, `--dur-ui`, `--dur-scene`, `--intro-total: 1800`.

- [ ] **Step 1: מוסיפים את טוקני התנועה**

ב-`:root` של `css/style.css`:

```css
  /* ===== motion =====
     --ease is Apple's own curve, read off apple.com. Three durations, because
     one duration for everything is what makes a page feel machine-made: a press
     answers instantly, a hover is quick, a section arriving is unhurried. */
  --ease: cubic-bezier(0.28, 0.11, 0.32, 1);
  --dur-micro: 180ms;
  --dur-ui: 280ms;
  --dur-scene: 600ms;
```

- [ ] **Step 2: מחליפים את התזמונים הקשיחים**

```css
.btn { display: inline-flex; align-items: center; justify-content: center; gap: .5em; padding: 14px 28px; border-radius: 999px; font-family: var(--font-body); font-weight: 500; font-size: var(--step-body); letter-spacing: .02em; border: 1px solid transparent; transition: transform var(--dur-micro) var(--ease), background var(--dur-micro) var(--ease), color var(--dur-micro) var(--ease), border-color var(--dur-micro) var(--ease); }
```

ובמשתנה ההדגשה:
```css
  --hl-ease: transform var(--dur-ui) var(--ease), box-shadow var(--dur-ui) var(--ease), border-color var(--dur-ui) var(--ease), opacity var(--dur-ui) var(--ease);
```

- [ ] **Step 3: מדרגים את החשיפה**

החלף את בלוק `reveal on scroll`:

```css
/* ===== reveal on scroll =====
   The section fades and rises as one; its direct children follow in a short
   stagger, so the eye is led down the section instead of being handed all of it
   at once. Reduced motion collapses both to nothing. */
.js .reveal { opacity: 0; transform: translateY(18px); transition: opacity var(--dur-scene) var(--ease), transform var(--dur-scene) var(--ease); }
.reveal.is-in { opacity: 1; transform: none; }
.js .reveal .container > *, .js .reveal .chapter { opacity: 0; transform: translateY(12px); transition: opacity var(--dur-scene) var(--ease), transform var(--dur-scene) var(--ease); }
.reveal.is-in .container > *, .reveal.is-in .chapter { opacity: 1; transform: none; }
.reveal.is-in .container > *:nth-child(2), .reveal.is-in .chapter:nth-child(2) { transition-delay: 60ms; }
.reveal.is-in .container > *:nth-child(3), .reveal.is-in .chapter:nth-child(3) { transition-delay: 120ms; }
.reveal.is-in .container > *:nth-child(n+4), .reveal.is-in .chapter:nth-child(n+4) { transition-delay: 180ms; }
```

ובבלוק `prefers-reduced-motion`, הוסף לצד השורה הקיימת:
```css
  .js .reveal .container > *, .js .reveal .chapter { opacity: 1; transform: none; transition: none; }
```

- [ ] **Step 4: בודקים**

```bash
cd tools && node check-design.mjs && node check-page.mjs
```
צפוי: שתיהן `OK`.

- [ ] **Step 5: כותבים את הבדיקה הנכשלת לפתיחה**

```js
  // --- the HIG warns against a launch screen used purely for branding; ours
  // earns its place only if it gets out of the way quickly
  const introMs = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "intro";
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(probe);
    const v = parseFloat(getComputedStyle(probe).getPropertyValue("--intro-total"));
    probe.remove();
    return v;
  });
  need(introMs <= 1800, `intro runs ${introMs}ms, want <= 1800`);
```

- [ ] **Step 6: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `intro runs 2550ms, want <= 1800`.

- [ ] **Step 7: מקצרים את הכוריאוגרפיה**

ב-`css/style.css`, בבלוק `.intro`, החלף את שורת התזמונים. כל שלב מתקצר באותו יחס כדי שהמקצב יישמר:

```css
  --t-y: .1s; --t-b: .3s; --t-s: .5s; --t-sweep: .72s; --t-name: .82s; --t-sub: .94s;
  --t-flip: 1.2s; --intro-total: 1800;
```

- [ ] **Step 8: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`.

- [ ] **Step 9: בודקים את הפתיחה בעין**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron && python3 -m http.server 8080
```
פתח חלון גלישה פרטית ב-`http://localhost:8080`. ודא שהמונוגרמה מתרכבת, נוחתת על לוגו הפתיח, והשחור נמוג — בלי קפיצה ובלי לוגו כפול. סגור את השרת.

- [ ] **Step 10: מריצים את הכל**

```bash
cd tools && npm run check
```
צפוי: שלוש הבדיקות `OK`. פתח את `tools/shots/desktop.png`, `mobile.png` ו-`mobile-fold.png` והשווה מול הצילומים שלפני השינוי.

- [ ] **Step 11: מעדכנים את README**

החלף את סעיף "הדגשת תמונה במעבר עכבר" בסעיף חדש:

```markdown
## מערכת העיצוב

כל הערכים יושבים כמשתני CSS בראש `css/style.css`, ושינוי שם משנה את כל האתר יחד:
`--ink-*` ו-`--paper-*` (רקעים), `--gold` ו-`--gold-on-paper` (פעולה), `--step-*` (גודלי טיפוס),
`--sp-*` ו-`--section-y` (מרווחים), `--ease` ו-`--dur-*` (תנועה).

**שני כללים שקל לשבור בטעות:**
- **הזהב הוא צבע של פעולה.** כפתור, קישור פעולה, מצב פוקוס. לא מסגרת ולא קו מפריד.
  על רקע קרם חובה `--gold-on-paper` — הזהב הבהיר נותן שם 1.96:1 ולא נקרא.
- **הפרדה בין מקטעים היא החלפת רקע.** שני מקטעים כהים רצופים חייבים שני גוונים שונים
  (`section--dark` ו-`section--ink-1`), אחרת אין ביניהם שום הפרדה.

`cd tools && node check-design.mjs` אוכף את שניהם ועוד: ניגודיות 4.5:1 לכל טקסט,
היעדר צללים ומסגרות, גודל הטיפוס, וידאו שלא מתנגן ב-`prefers-reduced-motion`,
ושהפתיח לא מבקש וידאו בנייד.
```

- [ ] **Step 12: קומיט**

```bash
git add css/style.css README.md tools/check-design.mjs
git commit -m "design: shorten the intro to 1.8s, and document the system

The HIG warns against a launch screen used purely for branding. Ours keeps its
place by getting out of the way faster — every step shortened by the same ratio
so the rhythm survives.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: גופן אחד — Assistant

**Files:**
- Modify: `index.html` (שורת ה-`<link>` של Google Fonts)
- Modify: `css/style.css` (בלוקים `tokens`, `base`)
- Modify: `tools/check-design.mjs`

**Interfaces:**
- Consumes: `--track-display`, `--step-*` ממשימה 5.
- Produces: `--font-head` ו-`--font-body` שניהם Assistant; `--track-h3: -.01em`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`, אחרי הבלוק האחרון בתוך ה-`try`:

```js
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `body renders Heebo, want Assistant`, `.section__title renders Frank Ruhl Libre`, `the font link still loads Frank+Ruhl`, ו-`Heebo 300 is downloaded but nothing renders it`.

- [ ] **Step 3: מחליפים את הטעינה**

ב-`index.html`, החלף את שורת ה-`<link href="https://fonts.googleapis.com/css2?...">` ב:

```html
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Assistant:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 4: מחליפים את הטוקנים**

ב-`:root` של `css/style.css`:

```css
  /* One text family, the way Apple runs SF: hierarchy comes from weight, not
     from switching faces. Assistant is the Hebrew companion to Source Sans —
     the nearest thing to SF that actually ships Hebrew (Inter does not).
     Playfair is the logo's voice and appears only in the wordmark. */
  --font-mark: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-head: "Assistant", "Helvetica Neue", Arial, sans-serif;
  --font-body: "Assistant", "Helvetica Neue", Arial, sans-serif;
  --track-h3: -.01em;
```
(מחק את שתי ההכרזות הישנות של `--font-head` ו-`--font-body`.)

- [ ] **Step 5: היררכיה ממשקל**

```css
h1, h2, h3 { font-family: var(--font-head); font-weight: 600; line-height: 1.1; letter-spacing: var(--track-display); margin: 0; }
h3 { letter-spacing: var(--track-h3); }
```
ובדוק שאף כלל אחר לא מחזיר את כותרות ל-500: `grep -n "font-weight: 500" css/style.css` — כפתורים, קישורי פעולה, `.wordmark` ותוויות נשארים 500; כותרות (`.section__title`, `.chapter__title`, `.gift-band__title`, `.gift__title`, `.promo__eyebrow`, `.promo__subtitle`, `.promo__big-label`, `.hero__tagline`) — אם אחד מהם מכריז משקל במפורש, העבר ל-600 או הסר את ההכרזה כדי שיירש.

- [ ] **Step 6: מריצים עד ירוק**

```bash
cd tools && node check-design.mjs
```
צפוי: `check-design: OK`. אם נשאר `X is downloaded but nothing renders it` — הסר את המשקל מה-`<link>`; אם נשאר `is not loaded — the browser is faking it` — הוסף אותו.

- [ ] **Step 7: הסוויטה המלאה + מבט**

```bash
cd tools && npm run check
```
צפוי: שלושתן `OK`. פתח `tools/shots/desktop.png` ו-`mobile.png`: כותרות עבריות ב-Assistant 600, גוף 400, הוורדמארק עדיין Playfair.

- [ ] **Step 8: קומיט**

```bash
git add index.html css/style.css tools/check-design.mjs
git commit -m "design: one text family — Assistant for headings and body

Hierarchy now comes from weight (600 / 500 / 400), the way Apple runs SF,
instead of from switching between a serif and a sans. Assistant is the Hebrew
companion to Source Sans and the nearest thing to SF that actually ships Hebrew
— Inter does not, so every Hebrew glyph would have fallen back to another face.
Playfair stays for the wordmark alone.

Two font bugs fixed on the way: Heebo 300 and Frank Ruhl 700 were downloaded on
every visit and used by nothing; h3 now carries its own, lighter tracking. The
check fails on any loaded-but-unused weight and any used-but-unloaded one.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: דף קצר יותר — מקטע הוכחה אחד, מפה, גליף וואטסאפ (מקובץ)

**Files:**
- Modify: `index.html` (מקטעי `#videos`/`#testimonials`, `#contact`, `.wa-fab`)
- Modify: `css/style.css` (בלוקים `testimonials`, `contact`, `floating WhatsApp button`)
- Modify: `js/main.js` (`renderContact`)
- Modify: `tools/check-design.mjs`, `tools/check-page.mjs` (התאמת בדיקות שמשוות למבנה הישן — סלקטורים בלבד)

**Interfaces:**
- Consumes: `S.address`, `--sp-5`, `--radius`, `--section-y`, `.videos` ממשימה 6.
- Produces: `.proof`, `.contact__map`, `#contact-map`.

- [ ] **Step 1: כותבים את הבדיקה הנכשלת**

הוסף ל-`tools/check-design.mjs`, אחרי הבלוק האחרון בתוך ה-`try`:

```js
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
```

- [ ] **Step 2: מריצים ורואים שהיא נכשלת**

```bash
cd tools && node check-design.mjs
```
צפוי: `FAIL` עם `#videos section still exists`, `#contact-map iframe missing`, ושתי שורות הגליף.

- [ ] **Step 3: ממזגים את הסרטון לתוך ההמלצות**

ב-`index.html`, מחק את כל `<section … id="videos">…</section>` והחלף את מקטע ההמלצות ב:

```html
    <section class="section section--dark reveal" id="testimonials">
      <div class="container">
        <h2 class="section__title">המלצות</h2>
        <div class="proof">
          <div class="videos" id="videos-grid"></div>
          <div class="proof__wall">
            <p class="testimonials__empty" id="testimonials-empty">המלצות של לקוחות יעלו כאן בקרוב</p>
            <div class="testimonials" id="testimonials-grid"></div>
          </div>
        </div>
      </div>
    </section>
```

ב-`css/style.css`, בבלוק `testimonials`:

```css
/* One proof section: the real before/after clip beside the client screenshots.
   Desktop puts the clip on the start side and lets the wall fill the rest. */
.proof { display: grid; gap: var(--sp-5); }
.proof .videos { max-width: none; }
@media (min-width: 820px) {
  .proof { grid-template-columns: minmax(0, var(--video-max)) 1fr; align-items: start; gap: var(--sp-6); }
  .proof .videos { grid-template-columns: 1fr; justify-content: stretch; }
  .proof .testimonials { columns: 3; }
}
```
מחק את `.section--divided { border-top: 0; }` (המחלקה כבר לא בשימוש).

- [ ] **Step 4: מחזירים את המפה**

ב-`index.html`, בתוך `#contact` אחרי `</ul>` של `.contact__list`:

```html
            <div class="contact__map">
              <iframe id="contact-map" title="מפה: הסטודיו" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
            </div>
```

ב-`js/main.js`, בתוך `renderContact`, אחרי קביעת הכתובת:

```js
    // The map follows the address in content.js, so an address change moves the pin too.
    const map = $("contact-map");
    if (map) map.src = "https://www.google.com/maps?q=" + encodeURIComponent(S.address) + "&output=embed&hl=he";
```

ב-`css/style.css`, בבלוק `contact`:

```css
.contact__map { width: min(100%, var(--measure)); margin-inline: auto; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; background: var(--ink-1); }
/* desaturated so the map sits inside the ink/gold palette instead of shouting over it */
.contact__map iframe { width: 100%; height: 100%; border: 0; display: block; filter: grayscale(1) contrast(1.05); }
```

- [ ] **Step 5: הגליף העדכני**

ב-`index.html`, החלף את ה-`<svg>` בתוך `.wa-fab` ב:

```html
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
```

ואת כפתור הוואטסאפ הראשי ב-`#contact`:

```html
              <a class="btn btn--wa btn--big" id="contact-wa" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg><span>לתיאום תור בוואטסאפ</span></a>
```
`.btn` כבר מסדר אייקון וטקסט עם `gap: .5em`. הכיתוב לא משתנה.


- [ ] **Step 5b: יצירת קשר — מבנה חדש (הבעלים: "לא נראה טוב")**

היום: כותרת ממורכזת, כפתור ירוק בודד, שני קישורים קטנים, טלפון וכתובת — שטח שחור גדול
עם פריט אחד בתוכו. הכיוון: שתי עמודות בדסקטופ כמו "עלינו" — ההזמנה מימין, המפה משמאל;
בנייד הכל נערם. אין מסגרות, אין צל (מפה אינה צילום), כל מרווח טוקן.

ב-`index.html`, החלף את כל `<div class="contact">…</div>` (בתוך `#contact`, אחרי ה-`h2`) ב:

```html
        <div class="contact">
          <div class="contact__stack">
            <a class="btn btn--wa btn--big" id="contact-wa" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="[אותו path של הגליף מ-Step 5]"/></svg><span>לתיאום תור בוואטסאפ</span></a>
            <a class="contact__tel" id="contact-tel" href="#"></a>
            <p class="contact__address" id="contact-address"></p>
            <div class="contact__secondary">
              <a id="contact-ig" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>אינסטגרם</span></a>
              <a id="contact-waze" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 20 20 12 16 4 20z"/></svg><span>נווט בוויז</span></a>
            </div>
          </div>
          <div class="contact__map">
            <iframe id="contact-map" title="מפה: הסטודיו" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
          </div>
        </div>
```
(ה-`<ul class="contact__list">` נעלם; `#contact-tel` ו-`#contact-address` נשארים כ-IDs
כי `renderContact` ממלא אותם. בדוק ב-`js/main.js` שהוא כותב `textContent`/`href` לפי ID
ולא מניח `li` — אם כן, התאם את שתי השורות האלה בלבד.)

ב-`css/style.css`, החלף את בלוק `contact` כולו:

```css
/* ===== contact =====
   Two columns, like "about": the invitation on the start side, the map on the end.
   No frame and no shadow — a map is not a photograph. Everything stacks on a phone. */
.contact { display: grid; gap: var(--sp-6); align-items: start; }
.contact__stack { display: grid; gap: var(--sp-3); justify-items: start; }
.contact__stack .btn { width: 100%; }
/* digits keep their order inside RTL text, and a phone number is a tap target, not a caption */
.contact__tel { font-size: var(--step-lead); font-weight: 500; color: var(--gold); direction: ltr; unicode-bidi: isolate; }
.contact__tel:hover { text-decoration: underline; }
.contact__address { color: var(--text-on-ink-2); font-size: var(--step-body); }
.contact__secondary { display: flex; flex-wrap: wrap; gap: var(--sp-4); }
.contact__secondary a { display: inline-flex; align-items: center; gap: var(--sp-1); color: var(--gold); font-size: var(--step-body); min-height: 44px; }
.contact__secondary a:hover { text-decoration: underline; }
.contact__secondary a:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); border-radius: var(--radius-sm); }
.contact__map { aspect-ratio: 4 / 3; border-radius: var(--radius); overflow: hidden; background: var(--ink-0); }
/* desaturated so the map sits inside the ink/gold palette instead of shouting over it */
.contact__map iframe { width: 100%; height: 100%; border: 0; display: block; filter: grayscale(1) contrast(1.05); }
#contact .section__title { text-align: center; }
@media (min-width: 820px) {
  .contact { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--sp-7); }
  .contact__stack .btn { width: auto; }
  #contact .section__title { text-align: start; }
}
```
(אם `--focus-ring`/`--focus-offset`/`--radius-sm` עדיין לא קיימים ב-`:root` בענף שלך —
משימה 12 מוסיפה אותם במקביל — הכרז אותם זמנית ב-`:root` עם אותם ערכים:
`--focus-ring: 2px solid var(--gold); --focus-offset: 3px; --radius-sm: 4px;` המיזוג ישאיר עותק אחד.)

Step 4 (המפה) מתמזג לכאן — ה-`iframe` כבר במבנה הזה; השאר את שורת ה-`map.src` ב-`renderContact` כמו ב-Step 4.

- [ ] **Step 6: מריצים עד ירוק, ואז הסוויטה**

```bash
cd tools && node check-design.mjs && npm run check
```
`check-page.mjs` מכיר את המבנה הישן (מקטע `#videos` נפרד, אולי כותרת "סרטונים"). אם הוא נופל על סלקטור שמצביע על מבנה שכבר לא קיים — תקן **סלקטור בלבד**, שמור על מה שהטענה מוודאת (הסרטון מתנגן/נעצר, ההמלצות נפתחות ב-lightbox), ותעד לפני/אחרי בדו"ח. אל תחליש שום דבר אחר. בדיקת הסמיכות (משימה 6) חייבת להישאר ירוקה: `gallery → testimonials → gift-band` = paper-0 → ink-0 → ink-1.

- [ ] **Step 7: README**

בסעיף "יצירת קשר"/"תוכן" ב-`README.md`: שורה שהמפה היא Google Maps embed שנגזר מ-`address` ב-`content.js` (שינוי כתובת מזיז את הסיכה), ושהסרטון יושב במקטע ההמלצות.

- [ ] **Step 8: קומיט**

```bash
git add index.html css/style.css js/main.js tools/check-design.mjs tools/check-page.mjs README.md
git commit -m "content: one proof section, the map back, the current WhatsApp glyph

With a single clip there is no case for a videos section of its own; the real
before/after is proof exactly like the client screenshots, so both sit under
one heading and the page loses a whole section of scroll. The map returns as a
Google Maps embed driven by the address in content.js. The floating button and
the primary button carry the current WhatsApp glyph.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
