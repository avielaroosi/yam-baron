# YAM BARON Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page, Hebrew (RTL), mobile-first landing site for "YAM BARON | Hair Studio" where every call to action opens WhatsApp, hosted free on GitHub Pages.

**Architecture:** One static `index.html` whose sections are populated at load time from a single content file (`js/content.js`, `window.SITE`) by `js/main.js`. No framework, no build step, no runtime dependencies. Placeholder photos live in `assets/img`; swapping in real content means replacing files and editing `content.js` only. Dev-only tooling (`tools/`) uses `playwright-core` with the already-cached Chromium to screenshot and assert on the rendered page.

**Tech Stack:** HTML5, CSS3 (custom properties, grid), vanilla ES2020 JS, Google Fonts (Cormorant Garamond / Frank Ruhl Libre / Heebo), Node 26 + playwright-core 1.61.1 (dev only), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-23-yam-baron-landing-design.md`

## Global Constraints

- Language/direction: `<html lang="he" dir="rtl">`. All UI copy in Hebrew except the wordmark `YAM BARON` / `Hair Studio`.
- Colors (exact): black `#0b0b0b`, cream `#f3ede4`, gold `#c9a961`, warm grey `#a89f91`.
- Fonts: `Cormorant Garamond` (wordmark), `Frank Ruhl Libre` (Hebrew headings), `Heebo` (body). Each with a system fallback.
- No framework, no build step, no npm dependencies for the site itself. `tools/` may have dev dependencies; `tools/node_modules` and `tools/shots` are git-ignored.
- All asset paths are **relative** (no leading `/`) so the site works under `/yam-baron/` on GitHub Pages and under a custom domain later.
- WhatsApp links: `https://wa.me/<SITE.whatsapp>?text=<encodeURIComponent(text)>`; `SITE.whatsapp` is digits only, international, no `+`. Placeholder number `972000000000` until the owner provides the real one.
- No testimonials, no makeup service, no forms, no payments, no analytics.
- Respect `prefers-reduced-motion: reduce` (no scroll animations when set).
- Every `<img>` has an `alt`. Non-hero images use `loading="lazy"`.
- Commit after every task. Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CEdGpGuRfqWhByg2LCxawJ
  ```
- Project root: `/Users/avielaroosi/Claude/Projects/yam-baron` (git already initialized, spec committed).

## File Structure

| Path | Responsibility |
|---|---|
| `index.html` | Page skeleton: all sections with empty containers carrying stable `id`s; meta/SEO; loads fonts, CSS, `content.js`, `main.js`. |
| `css/style.css` | All styling: tokens, layout, sections, cards, gallery, lightbox, videos, FAB, reveal animation, responsive rules. |
| `js/content.js` | The only file with business content: `window.SITE` object (texts, WhatsApp, Instagram, address, hours, image/video lists). |
| `js/main.js` | Reads `window.SITE`, renders sections, builds WhatsApp links, lightbox, floating button, reveal-on-scroll, video embeds. |
| `assets/img/*.jpg` | Photos (placeholders now). |
| `assets/video/.gitkeep` | Reserved for real mp4 files later. |
| `assets/favicon.svg` | Gold "YB" monogram. |
| `tools/package.json` | Dev-only: `playwright-core`. |
| `tools/check-content.mjs` | Node (no deps): validates `content.js` contract and that every referenced file exists. |
| `tools/check-page.mjs` | Node + playwright-core: serves the folder, loads page at mobile+desktop, asserts DOM/links/no errors, saves full-page screenshots to `tools/shots/`. |
| `tools/fetch-placeholders.sh` | Downloads free Unsplash photos into `assets/img` (with Chrome-rendered fallback). |
| `README.md` | Hebrew instructions for swapping content and deploying. |
| `.gitignore` | `tools/node_modules/`, `tools/shots/`, `.DS_Store`. |

---

### Task 1: Content contract, content validator, placeholder images, favicon

**Files:**
- Create: `js/content.js`
- Create: `tools/check-content.mjs`
- Create: `tools/fetch-placeholders.sh`
- Create: `assets/favicon.svg`, `assets/video/.gitkeep`
- Create: `.gitignore`

**Interfaces:**
- Produces: `window.SITE` with the exact shape below. Later tasks read these property names verbatim: `name, sub, tagline, heroText, whatsapp, whatsappDefaultText, instagram, phoneDisplay, address, hours[{days,time}], hero{image,alt}, services[{id,title,desc,image,whatsappText}], gallery[{src,alt}], videos[{type,src?,poster?,title}], about{image,title,text}`.
- Produces: `node tools/check-content.mjs` exits 0 when the contract holds and every referenced file exists.

- [ ] **Step 1: Write the content validator (the failing test)**

Create `tools/check-content.mjs`:

```js
// Validates js/content.js: shape of window.SITE + every referenced asset exists.
// Run: node tools/check-content.mjs   (no dependencies)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const file = path.join(root, "js/content.js");
const src = fs.readFileSync(file, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const S = sandbox.window.SITE;

const errors = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };

need(S && typeof S === "object", "window.SITE is missing");
for (const k of ["name", "sub", "tagline", "heroText", "whatsapp", "whatsappDefaultText", "instagram", "phoneDisplay", "address"]) {
  need(typeof S?.[k] === "string" && S[k].trim().length > 0, `SITE.${k} must be a non-empty string`);
}
need(/^\d{11,13}$/.test(S?.whatsapp || ""), "SITE.whatsapp must be digits only, international format, no '+'");
need(!/^@/.test(S?.instagram || ""), "SITE.instagram must be the handle without '@'");
need(Array.isArray(S?.hours) && S.hours.length > 0, "SITE.hours must be a non-empty array");
for (const h of S?.hours || []) need(h.days && h.time, "each SITE.hours item needs {days, time}");
need(S?.hero?.image && S?.hero?.alt, "SITE.hero needs {image, alt}");
need(Array.isArray(S?.services) && S.services.length === 4, "SITE.services must have exactly 4 items");
for (const s of S?.services || []) {
  for (const k of ["id", "title", "desc", "image", "whatsappText"]) need(s[k], `service "${s.id || "?"}" missing ${k}`);
}
need(Array.isArray(S?.gallery) && S.gallery.length >= 6, "SITE.gallery must have at least 6 images");
for (const g of S?.gallery || []) need(g.src && g.alt, "each gallery item needs {src, alt}");
need(Array.isArray(S?.videos) && S.videos.length >= 2, "SITE.videos must have at least 2 items");
for (const v of S?.videos || []) {
  need(["placeholder", "file", "youtube", "instagram"].includes(v.type), `video type invalid: ${v.type}`);
  need(v.title, "each video needs a title");
  if (v.type !== "placeholder") need(v.src, `video "${v.title}" of type ${v.type} needs src`);
  if (v.type === "placeholder" || v.type === "file") need(v.poster, `video "${v.title}" needs poster`);
}
need(S?.about?.image && S?.about?.title && S?.about?.text, "SITE.about needs {image, title, text}");

const files = [
  S?.hero?.image,
  ...(S?.services || []).map((s) => s.image),
  ...(S?.gallery || []).map((g) => g.src),
  ...(S?.videos || []).map((v) => v.poster).filter(Boolean),
  ...(S?.videos || []).filter((v) => v.type === "file").map((v) => v.src),
  S?.about?.image,
].filter(Boolean);
for (const f of files) {
  need(!f.startsWith("/") && !/^https?:/.test(f), `asset path must be relative: ${f}`);
  need(fs.existsSync(path.join(root, f)), `file missing on disk: ${f}`);
}

if (errors.length) {
  console.error("check-content: FAIL\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`check-content: OK (${files.length} asset files verified)`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron && node tools/check-content.mjs`
Expected: crash with `ENOENT ... js/content.js` (file does not exist yet).

- [ ] **Step 3: Write `js/content.js` with placeholder content**

```js
// כל התוכן של האתר במקום אחד. כדי להחליף טקסט/תמונה/מספר: עורכים כאן בלבד.
// נתיבי תמונות יחסיים לתיקיית הפרויקט (ללא / בהתחלה).
window.SITE = {
  name: "YAM BARON",
  sub: "Hair Studio",
  tagline: "עיצוב שיער · כלות · החלקות",
  heroText: "סטודיו בוטיק לעיצוב שיער. כלות, החלקות, צבע ותספורות, עם יחס אישי ותוצאה שנראית מושלם גם בתמונות וגם בחיים.",

  // מספר וואטסאפ בפורמט בינלאומי, ספרות בלבד, בלי + (למשל 9725XXXXXXXX). 972000000000 = מספר דמה.
  whatsapp: "972000000000",
  whatsappDefaultText: "היי ים, אשמח לשמוע פרטים ולתאם תור",
  instagram: "yambaron.hair", // בלי @
  phoneDisplay: "000-0000000",
  address: "רחוב הדוגמה 1, עיר", // כתובת דמה עד שתתקבל כתובת אמיתית
  hours: [
    { days: "ראשון–חמישי", time: "09:00–20:00" },
    { days: "שישי", time: "08:00–14:00" },
    { days: "שבת", time: "סגור" },
  ],

  hero: { image: "assets/img/hero.jpg", alt: "סטודיו YAM BARON לעיצוב שיער" },

  services: [
    {
      id: "bridal",
      title: "עיצוב כלות",
      desc: "תסרוקת כלה שמחזיקה מהבוקר ועד הריקוד האחרון. כולל פגישת ניסיון ותיאום מלא ליום החתונה.",
      image: "assets/img/service-bridal.jpg",
      whatsappText: "היי ים, אשמח לתאם עיצוב שיער לכלה",
    },
    {
      id: "straightening",
      title: "החלקות",
      desc: "החלקות מקצועיות לכל סוג שיער: חלק, בריא ומבריק לחודשים, בלי לפגוע בשיער.",
      image: "assets/img/service-straightening.jpg",
      whatsappText: "היי ים, אשמח לשמוע על החלקה ולתאם תור",
    },
    {
      id: "cut-color",
      title: "תספורות וצבע",
      desc: "תספורת שמתאימה למבנה הפנים, וצבע שנראה טבעי ומדויק. ייעוץ אישי לפני כל שינוי.",
      image: "assets/img/service-cut-color.jpg",
      whatsappText: "היי ים, אשמח לתאם תספורת / צבע",
    },
    {
      id: "events",
      title: "תסרוקות לאירועים",
      desc: "תסרוקת מעוצבת לאירוע, לצילומים או לערב מיוחד. מגיעות, יושבות, יוצאות מוכנות.",
      image: "assets/img/service-events.jpg",
      whatsappText: "היי ים, אשמח לתאם תסרוקת לאירוע",
    },
  ],

  gallery: [
    { src: "assets/img/gallery-01.jpg", alt: "עבודה מהסטודיו 1" },
    { src: "assets/img/gallery-02.jpg", alt: "עבודה מהסטודיו 2" },
    { src: "assets/img/gallery-03.jpg", alt: "עבודה מהסטודיו 3" },
    { src: "assets/img/gallery-04.jpg", alt: "עבודה מהסטודיו 4" },
    { src: "assets/img/gallery-05.jpg", alt: "עבודה מהסטודיו 5" },
    { src: "assets/img/gallery-06.jpg", alt: "עבודה מהסטודיו 6" },
    { src: "assets/img/gallery-07.jpg", alt: "עבודה מהסטודיו 7" },
    { src: "assets/img/gallery-08.jpg", alt: "עבודה מהסטודיו 8" },
  ],

  // type: "placeholder" (מסגרת עד שיגיע סרטון) | "file" (src = assets/video/x.mp4) | "youtube" (src = קישור Shorts/וידאו) | "instagram" (src = קישור לפוסט/ריל)
  videos: [
    { type: "placeholder", poster: "assets/img/video-01.jpg", title: "החלקה: לפני ואחרי" },
    { type: "placeholder", poster: "assets/img/video-02.jpg", title: "תסרוקת כלה" },
    { type: "placeholder", poster: "assets/img/video-03.jpg", title: "מאחורי הקלעים בסטודיו" },
  ],

  about: {
    image: "assets/img/about.jpg",
    title: "נעים להכיר, ים",
    text: "מעצבת שיער עם אהבה גדולה לפרטים הקטנים. בסטודיו שלי כל לקוחה מקבלת זמן, הקשבה ותוצאה שמרגישה שלה. מתמחה בכלות, החלקות וצבע, ומאמינה ששיער טוב הוא כזה שנראה טוב גם בלי פילטר.",
  },
};
```

- [ ] **Step 4: Run the validator again**

Run: `node tools/check-content.mjs`
Expected: `check-content: FAIL` listing `file missing on disk: assets/img/hero.jpg` and the other 16 images (contract itself passes).

- [ ] **Step 5: Write the placeholder fetch script**

Create `tools/fetch-placeholders.sh` (make executable with `chmod +x`):

```bash
#!/usr/bin/env bash
# Downloads free-license placeholder photos (Unsplash) into assets/img.
# Skips files that already exist. Falls back to a Chrome-rendered dark/gold card if Unsplash fails.
# Run: tools/fetch-placeholders.sh
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/img
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

urlenc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }

fallback() { # name label width height
  local name=$1 label=$2 w=$3 h=$4
  local html="<html><body style='margin:0;width:${w}px;height:${h}px;background:#151515;display:flex;align-items:center;justify-content:center;font:$((w/20))px Georgia,serif;color:#c9a961'>${label}</body></html>"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="${w},${h}" \
    --screenshot="assets/img/${name}.png" "data:text/html;charset=utf-8,$(urlenc "$html")" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 80 "assets/img/${name}.png" --out "assets/img/${name}.jpg" >/dev/null && rm -f "assets/img/${name}.png"
  echo "fallback $name"
}

fetch() { # name query index orientation width height
  local name=$1 query=$2 idx=$3 orient=$4 w=$5 h=$6
  local out="assets/img/${name}.jpg"
  if [ -s "$out" ]; then echo "skip $name"; return; fi
  local url
  url=$(curl -sf "https://unsplash.com/napi/search/photos?query=$(urlenc "$query")&per_page=$((idx+1))&orientation=${orient}" \
        | jq -r ".results[$idx].urls.raw // empty")
  if [ -n "$url" ] && curl -sfL "${url}&w=${w}&q=80&fm=jpg&fit=max" -o "$out" && [ -s "$out" ]; then
    echo "ok $name"
  else
    rm -f "$out"; fallback "$name" "$name" "$w" "$h"
  fi
}

fetch hero                  "hair salon interior dark elegant" 0 landscape 1920 1280
fetch service-bridal        "bridal hairstyle updo"            0 portrait  1200 1500
fetch service-straightening "sleek straight hair woman"        0 portrait  1200 1500
fetch service-cut-color     "hair color salon woman"           0 portrait  1200 1500
fetch service-events        "elegant hairstyle evening"        0 portrait  1200 1500
fetch gallery-01 "hairstyle woman"        0 portrait 1200 1500
fetch gallery-02 "bride hair"             0 portrait 1200 1500
fetch gallery-03 "long blonde hair"       0 portrait 1200 1500
fetch gallery-04 "hair stylist working"   0 portrait 1200 1500
fetch gallery-05 "braided hairstyle"      0 portrait 1200 1500
fetch gallery-06 "wavy hair woman"        0 portrait 1200 1500
fetch gallery-07 "hair updo elegant"      0 portrait 1200 1500
fetch gallery-08 "hair styling salon"     0 portrait 1200 1500
fetch video-01 "hair salon"        0 portrait 900 1600
fetch video-02 "bridal hair"       1 portrait 900 1600
fetch video-03 "hairdresser"       0 portrait 900 1600
fetch about    "hairstylist portrait woman" 0 portrait 1200 1500
echo "done: $(ls assets/img/*.jpg | wc -l | tr -d ' ') images"
```

- [ ] **Step 6: Run the fetch script**

Run: `chmod +x tools/fetch-placeholders.sh && tools/fetch-placeholders.sh`
Expected: 17 lines of `ok <name>` (or `fallback <name>` for any Unsplash miss) and `done: 17 images`. Then `ls -la assets/img | head` shows JPEGs, each under ~600 KB. If any file is > 800 KB, re-encode: `sips -s format jpeg -s formatOptions 75 assets/img/X.jpg --out assets/img/X.jpg`.

- [ ] **Step 7: Favicon, video folder, .gitignore**

Create `assets/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b0b0b"/>
  <text x="32" y="43" text-anchor="middle" font-family="Cormorant Garamond, Georgia, 'Times New Roman', serif" font-size="30" font-weight="600" fill="#c9a961" letter-spacing="1">YB</text>
</svg>
```

Run: `mkdir -p assets/video && touch assets/video/.gitkeep`

Create `.gitignore`:

```
.DS_Store
tools/node_modules/
tools/shots/
```

- [ ] **Step 8: Run the validator, expect pass**

Run: `node tools/check-content.mjs`
Expected: `check-content: OK (17 asset files verified)`

- [ ] **Step 9: Commit**

```bash
git add .gitignore js/content.js tools/check-content.mjs tools/fetch-placeholders.sh assets/
git commit -m "feat: content contract, validator, placeholder images, favicon"
```
(append the Co-Authored-By / Claude-Session trailer lines from Global Constraints.)

---

### Task 2: Page skeleton, base styles, core rendering (hero, services, about, contact, footer), browser check harness

**Files:**
- Create: `tools/package.json`, `tools/check-page.mjs`
- Create: `index.html`, `css/style.css`, `js/main.js`

**Interfaces:**
- Consumes: `window.SITE` from Task 1 (exact property names listed there).
- Produces: `index.html` containers with stable ids that later tasks fill: `#gallery-grid`, `#videos-grid`, `#lightbox` (+ `#lightbox-img/-prev/-next/-close/-count`), `#wa-fab`, and `.reveal` sections.
- Produces in `js/main.js` (inside one IIFE; later tasks add functions to the same IIFE and call them from the bottom): `$(id)`, `el(tag, attrs, children)`, `waLink(text)`, `igUrl()`.
- Produces: `cd tools && node check-page.mjs` — exits 0 when the page renders without errors; writes `tools/shots/{mobile,desktop,mobile-fold}.png`. Later tasks append assertion blocks to this file.

- [ ] **Step 1: Dev tooling + the failing browser test**

Create `tools/package.json`:

```json
{
  "name": "yam-baron-tools",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "node check-content.mjs && node check-page.mjs"
  },
  "devDependencies": {
    "playwright-core": "1.61.1"
  }
}
```

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && npm install`
Expected: installs `playwright-core` only (no browser download; the cached Chromium 1228 in `~/Library/Caches/ms-playwright` matches 1.61.x).

Create `tools/check-page.mjs`:

```js
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

async function open(name, viewport) {
  const page = await browser.newPage({ viewport, locale: "he-IL" });
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${name}] console error: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`[${name}] page error: ${e.message}`));
  page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`[${name}] ${r.status()} ${r.url().slice(base.length)}`); });
  await page.goto(base, { waitUntil: "load" });
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: fails (404 for `index.html`, then a Playwright timeout on `#hero-name`). Any failure is fine here; it proves the harness runs.

- [ ] **Step 3: Write `index.html`**

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YAM BARON | Hair Studio — עיצוב שיער, כלות והחלקות</title>
  <meta name="description" content="YAM BARON Hair Studio: סטודיו בוטיק לעיצוב שיער. עיצוב כלות, החלקות, תספורות וצבע. לתיאום תור בוואטסאפ.">
  <meta name="theme-color" content="#0b0b0b">
  <meta property="og:type" content="website">
  <meta property="og:title" content="YAM BARON | Hair Studio">
  <meta property="og:description" content="עיצוב שיער · כלות · החלקות. לתיאום תור בוואטסאפ.">
  <meta property="og:image" content="assets/img/hero.jpg">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Frank+Ruhl+Libre:wght@400;500;700&family=Heebo:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <a class="skip" href="#services">דלג לתוכן</a>

  <header class="hero" id="top">
    <img class="hero__bg" id="hero-img" alt="">
    <div class="hero__inner">
      <p class="hero__eyebrow" id="hero-sub"></p>
      <h1 class="wordmark" id="hero-name"></h1>
      <p class="hero__tagline" id="hero-tagline"></p>
      <p class="hero__text" id="hero-text"></p>
      <div class="hero__actions">
        <a class="btn btn--wa" id="hero-wa" href="#" target="_blank" rel="noopener">לתיאום תור בוואטסאפ</a>
        <a class="link-ig" id="hero-ig" href="#" target="_blank" rel="noopener"></a>
      </div>
    </div>
    <a class="hero__scroll" href="#services" aria-label="גלילה למטה">↓</a>
  </header>

  <main>
    <section class="section section--dark reveal" id="services">
      <div class="container">
        <h2 class="section__title">השירותים</h2>
        <div class="cards" id="services-grid"></div>
      </div>
    </section>

    <section class="section section--light reveal" id="gallery">
      <div class="container">
        <h2 class="section__title">עבודות</h2>
        <div class="gallery" id="gallery-grid"></div>
      </div>
    </section>

    <section class="section section--dark reveal" id="videos">
      <div class="container">
        <h2 class="section__title">סרטונים</h2>
        <div class="videos" id="videos-grid"></div>
      </div>
    </section>

    <section class="section section--light reveal" id="about">
      <div class="container about">
        <img class="about__img" id="about-img" alt="" loading="lazy">
        <div class="about__body">
          <h2 class="section__title" id="about-title"></h2>
          <p class="about__text" id="about-text"></p>
          <a class="btn btn--outline" id="about-wa" href="#" target="_blank" rel="noopener">דברו איתי בוואטסאפ</a>
        </div>
      </div>
    </section>

    <section class="section section--dark reveal" id="contact">
      <div class="container">
        <h2 class="section__title">יצירת קשר</h2>
        <div class="contact">
          <div class="contact__info">
            <a class="btn btn--wa btn--big" id="contact-wa" href="#" target="_blank" rel="noopener">לתיאום תור בוואטסאפ</a>
            <ul class="contact__list">
              <li><a id="contact-ig" href="#" target="_blank" rel="noopener"></a></li>
              <li><a id="contact-tel" href="#"></a></li>
              <li id="contact-address"></li>
            </ul>
            <h3 class="contact__sub">שעות פעילות</h3>
            <ul class="hours" id="contact-hours"></ul>
          </div>
          <div class="contact__map">
            <iframe id="contact-map" loading="lazy" title="מפה" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <p><span class="wordmark wordmark--sm" id="footer-name"></span> · <span id="footer-year"></span></p>
  </footer>

  <a class="wa-fab" id="wa-fab" href="#" target="_blank" rel="noopener" aria-label="וואטסאפ">
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M16 3C9.4 3 4 8.3 4 14.9c0 2.3.7 4.5 1.9 6.4L4 29l7.9-2.1c1.8 1 3.9 1.5 6.1 1.5 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.7c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.7 1.2 1.3-4.5-.3-.4A9.7 9.7 0 0 1 6.2 15c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.7-9.8 9.7zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-1 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.5.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"/></svg>
  </a>

  <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="תצוגת תמונה">
    <button class="lightbox__close" id="lightbox-close" type="button" aria-label="סגירה">×</button>
    <button class="lightbox__nav lightbox__nav--prev" id="lightbox-prev" type="button" aria-label="הקודמת">‹</button>
    <img class="lightbox__img" id="lightbox-img" alt="">
    <button class="lightbox__nav lightbox__nav--next" id="lightbox-next" type="button" aria-label="הבאה">›</button>
    <p class="lightbox__count" id="lightbox-count"></p>
  </div>

  <script src="js/content.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `css/style.css` (base + hero + services + about + contact + footer)**

Later tasks append gallery/lightbox, videos, FAB and reveal rules to the end of this file.

```css
/* ===== tokens ===== */
:root {
  --black: #0b0b0b;
  --black-2: #151515;
  --cream: #f3ede4;
  --cream-2: #e9e1d4;
  --gold: #c9a961;
  --gold-soft: rgba(201, 169, 97, .35);
  --gold-line: rgba(201, 169, 97, .18);
  --grey: #a89f91;
  --wa: #25d366;
  --font-mark: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-head: "Frank Ruhl Libre", "Times New Roman", serif;
  --font-body: "Heebo", "Helvetica Neue", Arial, sans-serif;
  --container: 1100px;
  --pad: clamp(16px, 5vw, 40px);
  --radius: 18px;
}

/* ===== base ===== */
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--black); color: var(--cream); font-family: var(--font-body); font-weight: 300; line-height: 1.7; overflow-x: hidden; }
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
h1, h2, h3 { font-family: var(--font-head); font-weight: 500; line-height: 1.2; margin: 0; }
p { margin: 0; }
.skip { position: absolute; top: -48px; right: 8px; background: var(--gold); color: var(--black); padding: 8px 12px; z-index: 100; border-radius: 6px; }
.skip:focus { top: 8px; }
.container { width: min(100% - 2 * var(--pad), var(--container)); margin-inline: auto; }
.wordmark { font-family: var(--font-mark); font-weight: 500; letter-spacing: .18em; text-transform: uppercase; direction: ltr; unicode-bidi: isolate; }
.wordmark--sm { font-size: 1rem; letter-spacing: .2em; }

/* ===== buttons ===== */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: .5em; padding: 14px 28px; border-radius: 999px; font-family: var(--font-body); font-weight: 500; font-size: 1rem; letter-spacing: .02em; border: 1px solid transparent; transition: transform .2s ease, background .2s ease, color .2s ease, border-color .2s ease; }
.btn:hover { transform: translateY(-2px); }
.btn--wa { background: var(--wa); color: #062b16; }
.btn--wa:hover { background: #2ee07a; }
.btn--big { padding: 18px 40px; font-size: 1.1rem; }
.btn--outline { border-color: var(--gold); color: inherit; }
.btn--outline:hover { background: var(--gold); color: var(--black); }
.link-ig { color: var(--gold); letter-spacing: .05em; direction: ltr; unicode-bidi: isolate; }
.link-ig:hover { text-decoration: underline; }

/* ===== hero ===== */
.hero { position: relative; min-height: 100svh; display: grid; place-items: center; text-align: center; isolation: isolate; padding: calc(var(--pad) * 2) var(--pad); }
.hero__bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
.hero::after { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(11, 11, 11, .55) 0%, rgba(11, 11, 11, .35) 40%, rgba(11, 11, 11, .92) 100%); }
.hero__inner { max-width: 720px; display: grid; gap: 18px; justify-items: center; }
.hero__eyebrow { font-family: var(--font-mark); letter-spacing: .35em; text-transform: uppercase; color: var(--gold); font-size: .9rem; direction: ltr; }
.hero .wordmark { font-size: clamp(2.4rem, 10vw, 5.5rem); line-height: 1; }
.hero__tagline { font-family: var(--font-head); font-size: clamp(1.1rem, 3.5vw, 1.5rem); }
.hero__tagline::before, .hero__tagline::after { content: ""; display: block; width: 56px; height: 1px; background: var(--gold); margin: 14px auto; }
.hero__text { max-width: 560px; color: var(--cream-2); font-size: 1.02rem; }
.hero__actions { display: grid; gap: 14px; justify-items: center; margin-top: 8px; }
.hero__scroll { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); color: var(--gold); font-size: 1.4rem; opacity: .8; }

/* ===== sections ===== */
.section { padding: clamp(56px, 10vw, 110px) 0; }
.section--dark { background: var(--black); color: var(--cream); }
.section--light { background: var(--cream); color: var(--black); }
.section__title { font-size: clamp(1.8rem, 5vw, 2.6rem); text-align: center; margin-bottom: clamp(28px, 5vw, 52px); }
.section__title::after { content: ""; display: block; width: 56px; height: 1px; background: var(--gold); margin: 16px auto 0; }

/* ===== services ===== */
.cards { display: grid; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card { background: var(--black-2); border: 1px solid var(--gold-line); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; transition: transform .25s ease, border-color .25s ease; }
.card:hover { transform: translateY(-4px); border-color: var(--gold-soft); }
.card__img { aspect-ratio: 4 / 5; width: 100%; object-fit: cover; }
.card__body { padding: 22px 22px 26px; display: grid; gap: 10px; flex: 1; align-content: start; }
.card__title { font-size: 1.35rem; color: var(--gold); }
.card__desc { color: var(--cream-2); font-size: .98rem; }
.card__link { margin-top: auto; padding-top: 8px; color: var(--gold); font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.card__link:hover { text-decoration: underline; }

/* ===== about ===== */
.about { display: grid; gap: 32px; align-items: center; grid-template-columns: 1fr; }
.about__img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--radius); max-width: 440px; justify-self: center; border: 1px solid var(--gold-soft); }
.about__body { display: grid; gap: 18px; text-align: center; }
.about .section__title { margin-bottom: 0; }
.about__text { font-size: 1.05rem; max-width: 560px; margin-inline: auto; }
.about__body .btn { justify-self: center; }
@media (min-width: 820px) {
  .about { grid-template-columns: 5fr 7fr; gap: 56px; }
  .about__body { text-align: start; }
  .about .section__title { text-align: start; }
  .about .section__title::after { margin-inline: 0; }
  .about__text { margin-inline: 0; }
  .about__body .btn { justify-self: start; }
}

/* ===== contact ===== */
.contact { display: grid; gap: 36px; grid-template-columns: 1fr; }
.contact__info { display: grid; gap: 20px; justify-items: center; text-align: center; }
.contact__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 1.05rem; }
.contact__list a { color: var(--gold); }
.contact__list a:hover { text-decoration: underline; }
.contact__sub { font-size: 1.2rem; color: var(--gold); margin-top: 8px; }
.hours { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; min-width: 260px; }
.hours li { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--gold-line); padding-bottom: 6px; }
.hours span:last-child { color: var(--grey); }
.contact__map iframe { width: 100%; height: 320px; border: 0; border-radius: var(--radius); filter: grayscale(1) contrast(1.05); opacity: .9; }
@media (min-width: 820px) {
  .contact { grid-template-columns: 1fr 1fr; align-items: start; }
  .contact__info { justify-items: start; text-align: start; }
  .contact__map iframe { height: 420px; }
}

/* ===== footer ===== */
.footer { padding: 28px var(--pad); text-align: center; color: var(--grey); font-size: .9rem; border-top: 1px solid var(--gold-line); }
```

- [ ] **Step 5: Write `js/main.js` (helpers + core renderers)**

```js
// Renders the page from window.SITE (js/content.js). No dependencies.
(function () {
  "use strict";
  const S = window.SITE;
  if (!S) { console.error("window.SITE is missing: js/content.js did not load"); return; }

  // ---- helpers (used by every render function; later tasks add functions inside this IIFE)
  const $ = (id) => document.getElementById(id);
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of [].concat(children)) if (c) n.append(c);
    return n;
  }
  const waLink = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text || S.whatsappDefaultText)}`;
  const igUrl = () => `https://instagram.com/${S.instagram}`;

  // ---- hero
  function renderHero() {
    const img = $("hero-img");
    img.src = S.hero.image; img.alt = S.hero.alt;
    $("hero-sub").textContent = S.sub;
    $("hero-name").textContent = S.name;
    $("hero-tagline").textContent = S.tagline;
    $("hero-text").textContent = S.heroText;
    $("hero-wa").href = waLink();
    $("hero-ig").href = igUrl();
    $("hero-ig").textContent = "@" + S.instagram;
  }

  // ---- services
  function renderServices() {
    const grid = $("services-grid");
    for (const s of S.services) {
      grid.append(el("article", { class: "card", id: "service-" + s.id }, [
        el("img", { class: "card__img", src: s.image, alt: s.title, loading: "lazy" }),
        el("div", { class: "card__body" }, [
          el("h3", { class: "card__title", text: s.title }),
          el("p", { class: "card__desc", text: s.desc }),
          el("a", { class: "card__link", href: waLink(s.whatsappText), target: "_blank", rel: "noopener", text: "לתיאום בוואטסאפ ←" }),
        ]),
      ]));
    }
  }

  // ---- about
  function renderAbout() {
    const img = $("about-img");
    img.src = S.about.image; img.alt = S.about.title;
    $("about-title").textContent = S.about.title;
    $("about-text").textContent = S.about.text;
    $("about-wa").href = waLink();
  }

  // ---- contact
  function renderContact() {
    $("contact-wa").href = waLink();
    $("contact-ig").href = igUrl();
    $("contact-ig").textContent = "@" + S.instagram;
    $("contact-tel").href = "tel:+" + S.whatsapp;
    $("contact-tel").textContent = S.phoneDisplay;
    $("contact-address").textContent = S.address;
    const hours = $("contact-hours");
    for (const h of S.hours) hours.append(el("li", {}, [el("span", { text: h.days }), el("span", { text: h.time })]));
    $("contact-map").src = "https://www.google.com/maps?q=" + encodeURIComponent(S.address) + "&output=embed&hl=he";
  }

  // ---- footer
  function renderFooter() {
    $("footer-name").textContent = S.name;
    $("footer-year").textContent = String(new Date().getFullYear());
  }

  // ---- boot (later tasks add their init calls here)
  renderHero();
  renderServices();
  renderAbout();
  renderContact();
  renderFooter();
})();
```

- [ ] **Step 6: Run both checks, expect pass, look at the screenshots**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-content.mjs && node check-page.mjs`
Expected: `check-content: OK (17 asset files verified)` and `check-page: OK (7 WhatsApp links verified; ...)`.

Then open `tools/shots/mobile-fold.png` and `tools/shots/desktop.png` with the Read tool and confirm: hero image fills the screen with the gold wordmark centered, 4 service cards, about block, contact block with map, footer. Gallery and videos sections are still empty (expected until Tasks 3–4). Fix any visible layout defect before committing.

- [ ] **Step 7: Commit**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron
git add index.html css/style.css js/main.js tools/package.json tools/package-lock.json tools/check-page.mjs
git commit -m "feat: page skeleton, base styles, core sections, browser check harness"
```
(append the Co-Authored-By / Claude-Session trailer lines from Global Constraints.)

---

### Task 3: Gallery grid + lightbox

**Files:**
- Modify: `tools/check-page.mjs` (insert a block before the `// --- screenshots` comment)
- Modify: `css/style.css` (append)
- Modify: `js/main.js` (add functions inside the IIFE, add calls in the boot block)

**Interfaces:**
- Consumes: `S.gallery[{src,alt}]`, helpers `$`, `el` from Task 2, containers `#gallery-grid`, `#lightbox*` from Task 2.
- Produces: `.gallery__item` buttons with `data-index`; `openLightbox(i)`, `closeLightbox()`, `showLightbox(i)`; keyboard: `Escape` closes, `ArrowLeft` = next, `ArrowRight` = previous (RTL reading order); swipe left = next.

- [ ] **Step 1: Add the failing assertions**

Insert into `tools/check-page.mjs` immediately before the line `// --- screenshots (full page also forces lazy images to load)`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: FAIL` with `gallery: item count` (and a Playwright timeout on the click, which is also acceptable).

- [ ] **Step 3: Append gallery + lightbox styles to `css/style.css`**

```css
/* ===== gallery ===== */
.gallery { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
.gallery__item { padding: 0; border: 0; background: none; cursor: zoom-in; border-radius: 12px; overflow: hidden; aspect-ratio: 4 / 5; }
.gallery__item img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; }
.gallery__item:hover img { transform: scale(1.04); }
.gallery__item:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
@media (min-width: 640px) { .gallery { grid-template-columns: repeat(3, 1fr); gap: 14px; } }
@media (min-width: 1000px) { .gallery { grid-template-columns: repeat(4, 1fr); } }

/* ===== lightbox ===== */
.lightbox { position: fixed; inset: 0; z-index: 200; background: rgba(11, 11, 11, .94); display: grid; place-items: center; padding: 56px 16px; }
.lightbox[hidden] { display: none; }
.lightbox__img { max-width: 100%; max-height: calc(100vh - 112px); object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0, 0, 0, .6); }
.lightbox__close, .lightbox__nav { position: absolute; background: none; border: 1px solid var(--gold-soft); color: var(--cream); width: 44px; height: 44px; border-radius: 50%; font-size: 1.6rem; line-height: 1; cursor: pointer; display: grid; place-items: center; font-family: var(--font-body); }
.lightbox__close { top: 14px; left: 14px; }
.lightbox__nav { top: 50%; transform: translateY(-50%); }
.lightbox__nav--prev { right: 10px; }
.lightbox__nav--next { left: 10px; }
.lightbox__count { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); color: var(--grey); font-size: .9rem; direction: ltr; }
```

- [ ] **Step 4: Add gallery + lightbox code to `js/main.js`**

Insert inside the IIFE, after `renderFooter()`'s definition and before the `// ---- boot` comment:

```js
  // ---- gallery + lightbox
  let lbIndex = 0;
  function renderGallery() {
    const grid = $("gallery-grid");
    S.gallery.forEach((g, i) => {
      const btn = el("button", { class: "gallery__item", type: "button", "aria-label": g.alt, "data-index": String(i) }, [
        el("img", { src: g.src, alt: g.alt, loading: "lazy" }),
      ]);
      btn.addEventListener("click", () => openLightbox(i));
      grid.append(btn);
    });
  }
  function showLightbox(i) {
    lbIndex = (i + S.gallery.length) % S.gallery.length;
    const g = S.gallery[lbIndex];
    const img = $("lightbox-img");
    img.src = g.src; img.alt = g.alt;
    $("lightbox-count").textContent = `${lbIndex + 1} / ${S.gallery.length}`;
  }
  function openLightbox(i) {
    showLightbox(i);
    $("lightbox").hidden = false;
    document.body.style.overflow = "hidden";
    $("lightbox-close").focus();
  }
  function closeLightbox() {
    $("lightbox").hidden = true;
    document.body.style.overflow = "";
    const item = document.querySelector(`.gallery__item[data-index="${lbIndex}"]`);
    if (item) item.focus();
  }
  function initLightbox() {
    const lb = $("lightbox");
    $("lightbox-prev").textContent = "›"; // RTL: "previous" sits on the right and points right
    $("lightbox-next").textContent = "‹";
    $("lightbox-close").addEventListener("click", closeLightbox);
    $("lightbox-prev").addEventListener("click", () => showLightbox(lbIndex - 1));
    $("lightbox-next").addEventListener("click", () => showLightbox(lbIndex + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") showLightbox(lbIndex + 1);
      else if (e.key === "ArrowRight") showLightbox(lbIndex - 1);
    });
    let touchX = null;
    lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 40) return;
      showLightbox(dx < 0 ? lbIndex + 1 : lbIndex - 1); // swipe left = next (RTL)
    });
  }
```

Then in the boot block, after `renderServices();` add:

```js
  renderGallery();
  initLightbox();
```

- [ ] **Step 5: Run checks, expect pass, eyeball the gallery**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: OK`. Open `tools/shots/mobile.png`: the gallery shows a 2-column grid of 8 photos on cream background; `tools/shots/desktop.png` shows 4 columns.

- [ ] **Step 6: Commit**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron
git add css/style.css js/main.js tools/check-page.mjs
git commit -m "feat: gallery grid with lightbox (keyboard, swipe, scroll lock)"
```
(append the Co-Authored-By / Claude-Session trailer lines from Global Constraints.)

---

### Task 4: Videos section (placeholder / file / YouTube / Instagram)

**Files:**
- Modify: `tools/check-page.mjs` (insert before `// --- screenshots`)
- Modify: `css/style.css` (append)
- Modify: `js/main.js` (add `renderVideos`, `youtubeId`; call in boot)

**Interfaces:**
- Consumes: `S.videos[{type,src?,poster?,title}]`, helpers `$`, `el`, container `#videos-grid`.
- Produces: one `<figure class="video" data-type="...">` per item. `youtubeId(url)` accepts `https://youtube.com/shorts/ID`, `https://www.youtube.com/watch?v=ID`, `https://youtu.be/ID`, `https://www.youtube.com/embed/ID`.

- [ ] **Step 1: Add the failing assertions**

Insert into `tools/check-page.mjs` immediately before `// --- screenshots (full page also forces lazy images to load)`:

```js
// --- videos (Task 4)
need((await mobile.$$("#videos-grid .video")).length === S.videos.length, "videos: item count");
need((await mobile.$$eval("#videos-grid .video", (v) => v.map((x) => x.dataset.type).join(","))) === S.videos.map((v) => v.type).join(","), "videos: data-type per item");
need((await mobile.$$("#videos-grid .video__placeholder .video__play")).length === S.videos.filter((v) => v.type === "placeholder").length, "videos: placeholder items show a play mark");
need((await mobile.$$("#videos-grid figcaption")).length === S.videos.length, "videos: every item has a caption");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: FAIL` with `videos: item count`.

- [ ] **Step 3: Append video styles to `css/style.css`**

```css
/* ===== videos ===== */
.videos { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); max-width: 900px; margin-inline: auto; }
.video { margin: 0; display: grid; gap: 10px; }
.video__media, .video__placeholder { width: 100%; aspect-ratio: 9 / 16; border-radius: var(--radius); overflow: hidden; background: var(--black-2); border: 1px solid var(--gold-line); }
.video__media { object-fit: cover; display: block; }
iframe.video__media { border: 0; }
.video__placeholder { position: relative; display: grid; place-items: center; }
.video__placeholder img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .55; }
.video__play { position: relative; width: 64px; height: 64px; border-radius: 50%; border: 1px solid var(--gold); display: grid; place-items: center; background: rgba(11, 11, 11, .35); }
.video__play::after { content: ""; border-style: solid; border-width: 11px 0 11px 18px; border-color: transparent transparent transparent var(--gold); margin-left: 4px; }
.video__soon { position: absolute; bottom: 16px; color: var(--cream); font-size: .9rem; letter-spacing: .05em; }
.video__title { text-align: center; color: var(--cream-2); font-size: .95rem; }
```

- [ ] **Step 4: Add video rendering to `js/main.js`**

Insert inside the IIFE before the `// ---- boot` comment:

```js
  // ---- videos
  function youtubeId(url) {
    const m = String(url).match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  function renderVideos() {
    const grid = $("videos-grid");
    let needInstagram = false;
    for (const v of S.videos) {
      let media;
      if (v.type === "file") {
        media = el("video", { class: "video__media", src: v.src, poster: v.poster, controls: true, playsinline: true, preload: "none" });
      } else if (v.type === "youtube") {
        media = el("iframe", { class: "video__media", src: `https://www.youtube-nocookie.com/embed/${youtubeId(v.src)}`, title: v.title, loading: "lazy", allow: "accelerometer; encrypted-media; picture-in-picture", allowfullscreen: true });
      } else if (v.type === "instagram") {
        needInstagram = true;
        media = el("blockquote", { class: "instagram-media video__media", "data-instgrm-permalink": v.src, "data-instgrm-version": "14" }, [
          el("a", { href: v.src, target: "_blank", rel: "noopener", text: v.title }),
        ]);
      } else {
        media = el("div", { class: "video__placeholder" }, [
          el("img", { src: v.poster, alt: v.title, loading: "lazy" }),
          el("span", { class: "video__play", "aria-hidden": "true" }),
          el("span", { class: "video__soon", text: "סרטון בקרוב" }),
        ]);
      }
      grid.append(el("figure", { class: "video", "data-type": v.type }, [media, el("figcaption", { class: "video__title", text: v.title })]));
    }
    if (needInstagram && !document.querySelector('script[src*="instagram.com/embed.js"]')) {
      document.body.append(el("script", { src: "https://www.instagram.com/embed.js", async: true }));
    }
  }
```

In the boot block, after `initLightbox();` add:

```js
  renderVideos();
```

- [ ] **Step 5: Run checks, expect pass**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: OK`. In `tools/shots/mobile.png` the videos section shows three tall dark frames with a gold play ring and "סרטון בקרוב".

- [ ] **Step 6: Commit**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron
git add css/style.css js/main.js tools/check-page.mjs
git commit -m "feat: videos section with placeholder/file/youtube/instagram support"
```
(append the Co-Authored-By / Claude-Session trailer lines from Global Constraints.)

---

### Task 5: Floating WhatsApp button + reveal-on-scroll (reduced-motion aware)

**Files:**
- Modify: `tools/check-page.mjs` (two edits: `open()` gets `reducedMotion`, and a new block before `// --- screenshots`)
- Modify: `css/style.css` (append)
- Modify: `js/main.js` (add `initFab`, `initReveal`; call in boot)

**Interfaces:**
- Consumes: `#wa-fab`, `#top` (hero), `.reveal` sections from Task 2, `waLink()`.
- Produces: `.wa-fab.is-visible` when the hero is scrolled out; `.reveal.is-in` when a section enters the viewport (immediately for everything when reduced motion is preferred).

- [ ] **Step 1: Make the harness deterministic and add the failing assertions**

In `tools/check-page.mjs`, change the `newPage` line inside `open()` to:

```js
  const page = await browser.newPage({ viewport, locale: "he-IL", reducedMotion: "reduce" });
```

Insert immediately before `// --- screenshots (full page also forces lazy images to load)`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-page.mjs`
Expected: `check-page: FAIL` with `fab: whatsapp href`, `fab: visible after scrolling past the hero`, `reveal: ...`.

- [ ] **Step 3: Append FAB + reveal styles to `css/style.css`**

```css
/* ===== floating WhatsApp button ===== */
.wa-fab { position: fixed; left: 18px; bottom: 18px; z-index: 150; width: 58px; height: 58px; border-radius: 50%; background: var(--wa); color: #062b16; display: grid; place-items: center; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); opacity: 0; transform: translateY(16px) scale(.9); pointer-events: none; transition: opacity .3s ease, transform .3s ease; }
.wa-fab.is-visible { opacity: 1; transform: none; pointer-events: auto; }
.wa-fab.is-visible:hover { transform: translateY(-2px); }

/* ===== reveal on scroll ===== */
.reveal { opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .7s ease; }
.reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn, .card, .gallery__item img, .wa-fab { transition: none; }
}
```

- [ ] **Step 4: Add FAB + reveal code to `js/main.js`**

Insert inside the IIFE before `// ---- boot`:

```js
  // ---- floating WhatsApp button: hidden while the hero is on screen
  function initFab() {
    const fab = $("wa-fab");
    fab.href = waLink();
    if (!("IntersectionObserver" in window)) { fab.classList.add("is-visible"); return; }
    new IntersectionObserver(([entry]) => {
      fab.classList.toggle("is-visible", !entry.isIntersecting);
    }, { threshold: 0.15 }).observe($("top"));
  }

  // ---- reveal sections on scroll; skipped entirely when the user prefers reduced motion
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) { items.forEach((n) => n.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px" });
    items.forEach((n) => io.observe(n));
  }
```

In the boot block, after `renderFooter();` add:

```js
  initFab();
  initReveal();
```

- [ ] **Step 5: Run checks, expect pass**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-content.mjs && node check-page.mjs`
Expected: both OK; the WhatsApp link count is now 8.

- [ ] **Step 6: Commit**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron
git add css/style.css js/main.js tools/check-page.mjs
git commit -m "feat: floating WhatsApp button and reveal-on-scroll with reduced-motion support"
```
(append the Co-Authored-By / Claude-Session trailer lines from Global Constraints.)

---

### Task 6: Hebrew README + full verification pass

**Files:**
- Create: `README.md`
- Verify: everything

**Interfaces:**
- Consumes: the finished site from Tasks 1–5.
- Produces: `README.md` the owner can follow to swap content; verified screenshots.

- [ ] **Step 1: Write `README.md`**

```markdown
# YAM BARON | Hair Studio — דף נחיתה

דף אחד, בלי מערכת ניהול. כל התוכן יושב בקובץ אחד: `js/content.js`.

## איך מחליפים תוכן

**טקסטים, מספר וואטסאפ, אינסטגרם, כתובת, שעות:** פותחים את `js/content.js` ועורכים את הערכים.
- `whatsapp`: מספר בפורמט בינלאומי, ספרות בלבד, בלי + (למשל `972501234567`).
- `instagram`: שם המשתמש בלי @.
- `address`: כתובת מלאה בעברית; המפה בדף מתעדכנת לבד לפי הכתובת.

**תמונות:** שמים את הקובץ החדש בתיקייה `assets/img/` ומעדכנים את הנתיב ב-`content.js`.
- מומלץ JPEG עד 1600 פיקסל רוחב, עד ~500KB לתמונה.
- פתיח (`hero`): תמונה רוחבית. שירותים/גלריה/עלינו: תמונות לגובה (4:5).

**סרטונים:** ברשימה `videos`, כל פריט הוא אחד מ:
- `{ type: "file", src: "assets/video/x.mp4", poster: "assets/img/x.jpg", title: "..." }` — קובץ וידאו אנכי (9:16), מומלץ עד 20MB.
- `{ type: "youtube", src: "https://youtube.com/shorts/XXXX", title: "..." }` — קישור ליוטיוב (גם Shorts).
- `{ type: "instagram", src: "https://www.instagram.com/reel/XXXX/", title: "..." }` — קישור לריל/פוסט.
- `{ type: "placeholder", poster: "assets/img/x.jpg", title: "..." }` — מסגרת זמנית עד שיגיע סרטון.

## איך רואים את הדף במחשב

```bash
cd yam-baron
python3 -m http.server 8080
```
ואז פותחים בדפדפן: http://localhost:8080

## בדיקות אוטומטיות (פעם ראשונה: `cd tools && npm install`)

```bash
cd tools
node check-content.mjs   # בודק שהתוכן תקין ושכל התמונות קיימות
node check-page.mjs      # פותח את הדף בדפדפן סמוי, בודק קישורים, ושומר צילומי מסך ב-tools/shots
```

## העלאה לאוויר

האתר מתארח ב-GitHub Pages מהענף `main`. כל `git push` מעדכן את האתר תוך כדקה.

## חיבור דומיין (כשיהיה)

1. יוצרים בשורש הפרויקט קובץ בשם `CNAME` שמכיל שורה אחת: `www.yambaron.co.il` (הדומיין שנקנה).
2. אצל ספק הדומיין: רשומת `CNAME` עבור `www` אל `avielaroosi.github.io`, ורשומות `A` עבור השורש אל
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. בהגדרות המאגר ב-GitHub → Pages → מסמנים "Enforce HTTPS" אחרי שהדומיין מאומת.
```

- [ ] **Step 2: Full check run**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && node check-content.mjs && node check-page.mjs`
Expected: both OK.

- [ ] **Step 3: Visual review of all three screenshots**

Open with the Read tool: `tools/shots/mobile-fold.png`, `tools/shots/mobile.png`, `tools/shots/desktop.png`. Confirm each of these, and fix CSS if any fails (then re-run Step 2):
- Hero: photo covers the viewport, wordmark legible over the gradient, WhatsApp button + Instagram handle visible without scrolling on mobile.
- Hebrew text right-aligned; the English wordmark and Instagram handle render left-to-right and are not split.
- No horizontal scrollbar; nothing clipped at the right edge.
- Services: 1 column on mobile, 4 on desktop; card titles in gold.
- Gallery: 2 columns mobile / 4 desktop; lightbox not visible.
- Videos: 3 frames with play rings.
- About: photo above text on mobile, side by side on desktop.
- Contact: map renders (grey-scaled); hours list aligned.
- Footer visible.

- [ ] **Step 4: Page weight**

Run: `cd /Users/avielaroosi/Claude/Projects/yam-baron && du -sh assets/img && ls -S -l assets/img | head -3`
Expected: total under ~6 MB and no single file over 800 KB. If any is larger: `sips -s format jpeg -s formatOptions 72 assets/img/<file> --out assets/img/<file>` and re-run Step 2.

- [ ] **Step 5: Commit**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron
git add README.md css/style.css assets/img
git commit -m "docs: Hebrew README for content swaps, deploy and domain"
```
(append the Co-Authored-By / Claude-Session trailer lines from Global Constraints.)

---

### Task 7: Publish on GitHub Pages and verify the live URL

**Files:**
- Modify: `tools/check-page.mjs` (honor `BASE_URL`)
- Remote: GitHub repo `avielaroosi/yam-baron` (public), Pages from `main` / root.

**Interfaces:**
- Produces: live site at `https://avielaroosi.github.io/yam-baron/`.

- [ ] **Step 1: Let the harness test a remote URL**

In `tools/check-page.mjs`, replace the line

```js
const base = `http://127.0.0.1:${server.address().port}/`;
```

with

```js
const base = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}/`;
```

Run: `cd tools && node check-page.mjs` → still `check-page: OK` (local path unchanged).

- [ ] **Step 2: Create the repo and push**

```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron
git branch -M main
git add tools/check-page.mjs
git commit -m "chore: allow check-page to target a remote URL via BASE_URL"
gh repo create yam-baron --public --source=. --remote=origin --description "YAM BARON | Hair Studio - landing page" --push
```
Expected: repo URL printed, `main` pushed. (Commit trailer lines as in Global Constraints.)

- [ ] **Step 3: Enable GitHub Pages**

```bash
gh api -X POST repos/avielaroosi/yam-baron/pages --input - <<'JSON'
{"source":{"branch":"main","path":"/"}}
JSON
```
Expected: JSON with `"html_url": "https://avielaroosi.github.io/yam-baron/"`. If it returns 409 (already exists) that is fine.

- [ ] **Step 4: Wait for the build and verify**

Poll (up to ~3 minutes):
```bash
for i in $(seq 1 18); do
  s=$(gh api repos/avielaroosi/yam-baron/pages/builds/latest --jq .status 2>/dev/null)
  code=$(curl -s -o /dev/null -w '%{http_code}' https://avielaroosi.github.io/yam-baron/)
  echo "build=$s http=$code"; [ "$code" = "200" ] && break; sleep 10
done
```
Expected: ends with `http=200`.

Then run the browser checks against the live site:
```bash
cd /Users/avielaroosi/Claude/Projects/yam-baron/tools && BASE_URL=https://avielaroosi.github.io/yam-baron/ node check-page.mjs
```
Expected: `check-page: OK` — this proves relative asset paths work under the `/yam-baron/` sub-path. Open `tools/shots/mobile-fold.png` once more (it is now the live page).

- [ ] **Step 5: Final state**

Run: `git status --short` → empty. `git log --oneline | head -8` shows the task commits. Report the live URL.

---

## Self-review notes

- Spec §4 (sections 1–8) → Tasks 2, 3, 4, 5. §5 file structure → Tasks 1–2. §6 placeholders → Task 1. §7 SEO/favicon → Tasks 1–2. §8 hosting → Task 7. §9 tests → harness in Task 2, extended in 3–5, full pass in Task 6. §10 steps → same order.
- Names used consistently: `waLink`, `igUrl`, `el`, `$`, `showLightbox/openLightbox/closeLightbox`, `renderVideos`, `youtubeId`, `initFab`, `initReveal`; ids `#services-grid`, `#gallery-grid`, `#videos-grid`, `#wa-fab`, `#lightbox*`, `#contact-*`, `#hero-*`, `#about-*`, `#footer-*`.
- Open items from spec §11 (real number, Instagram, address, hours, media, domain) stay as placeholder values in `content.js` and are documented in README; not blocking.
