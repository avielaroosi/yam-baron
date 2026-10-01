// Validates js/content.js: shape of window.SITE + every referenced asset exists.
// Run: node tools/check-content.mjs   (no dependencies)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "js/content.js");
const src = fs.readFileSync(file, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const S = sandbox.window.SITE;

const errors = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };

need(S && typeof S === "object", "window.SITE is missing");
for (const k of ["name", "sub", "tagline", "heroText", "whatsapp", "whatsappDefaultText", "instagram", "phone", "phoneDisplay", "address"]) {
  need(typeof S?.[k] === "string" && S[k].trim().length > 0, `SITE.${k} must be a non-empty string`);
}
need(/^\d{11,13}$/.test(S?.whatsapp || ""), "SITE.whatsapp must be digits only, international format, no '+'");
need(/^\d{11,13}$/.test(S?.phone || ""), "SITE.phone must be digits only, international format, no '+' (used for the tel: link)");
need(!/^@/.test(S?.instagram || ""), "SITE.instagram must be the handle without '@'");
need(S?.hero?.alt, "SITE.hero needs alt (what the hero picture shows)");
for (const k of ["wide", "tall"]) need(S?.hero?.[k]?.video && S?.hero?.[k]?.still, `SITE.hero.${k} needs {video, still} — the clip, and the still that is its first frame`);
need(Array.isArray(S?.services) && S.services.length >= 3 && S.services.length <= 4, "SITE.services must have 3 or 4 items");
for (const s of S?.services || []) {
  for (const k of ["id", "title", "desc", "image", "whatsappText"]) need(s[k], `service "${s.id || "?"}" missing ${k}`);
  const desc = [].concat(s.desc ?? []);
  need(desc.length > 0 && desc.every((t) => typeof t === "string" && t.trim()), `service "${s.id || "?"}": desc must be a non-empty string or a list of paragraphs`);
}
need(Array.isArray(S?.gallery) && S.gallery.length >= 6, "SITE.gallery must have at least 6 images");
for (const g of S?.gallery || []) need(g.src && g.alt, "each gallery item needs {src, alt}");
need(Array.isArray(S?.videos) && S.videos.length >= 1, "SITE.videos must have at least 1 item");
need(Array.isArray(S?.testimonials), "SITE.testimonials must be a list (may be empty)");
for (const t of S?.testimonials || []) need(t.src && t.alt, "each SITE.testimonials item needs {src, alt}");
for (const v of S?.videos || []) {
  need(["placeholder", "file", "youtube", "instagram"].includes(v.type), `video type invalid: ${v.type}`);
  need(v.title, "each video needs a title");
  if (v.type !== "placeholder") need(v.src, `video "${v.title}" of type ${v.type} needs src`);
  if (v.type === "placeholder" || v.type === "file") need(v.poster, `video "${v.title}" needs poster`);
}
need(S?.about?.image && S?.about?.imageAlt && S?.about?.title, "SITE.about needs {image, imageAlt, title}");
const aboutText = [].concat(S?.about?.text ?? []);
need(aboutText.length > 0 && aboutText.every((t) => typeof t === "string" && t.trim()), "SITE.about.text must be a non-empty string or a list of non-empty paragraphs");
need(S?.logo?.hero && S?.logo?.mark, "SITE.logo needs {hero, mark}");

if (S?.promo?.enabled) {
  for (const k of ["eyebrow", "big", "bigLabel", "cta", "whatsappText", "fine"]) need(typeof S.promo[k] === "string" && S.promo[k].trim(), `SITE.promo.${k} must be a non-empty string`);
  const ptext = [].concat(S.promo.text ?? []);
  need(ptext.length > 0 && ptext.every((t) => typeof t === "string" && t.trim()), "SITE.promo.text must be a non-empty string or a list of paragraphs");
  need(typeof (S.promo.image ?? "") === "string", "SITE.promo.image must be a string (empty = logo panel)");
  need(Number.isFinite(S.promo.delayMs) && S.promo.delayMs >= 0, "SITE.promo.delayMs must be a number");
  need(Number.isFinite(S.promo.hideAfterUseDays) && S.promo.hideAfterUseDays > 0, "SITE.promo.hideAfterUseDays must be a positive number");
}
need(S?.gift && typeof S.gift === "object", "SITE.gift block is missing");
if (S?.gift) {
  for (const k of ["title", "closing", "cta", "whatsappText", "image", "alt", "bandEyebrow", "bandCta"]) need(typeof S.gift[k] === "string" && S.gift[k].trim(), `SITE.gift.${k} must be a non-empty string`);
  const gtext = [].concat(S.gift.text ?? []);
  need(gtext.length > 0 && gtext.every((t) => typeof t === "string" && t.trim()), "SITE.gift.text must be a non-empty string or a list of paragraphs");
  need(S.gift.enabled === undefined || typeof S.gift.enabled === "boolean", "SITE.gift.enabled must be true/false when present");
  const giftCopy = [S.gift.title, ...gtext, S.gift.closing, S.gift.cta, S.gift.whatsappText, S.gift.bandEyebrow, S.gift.bandCta].join(" ");
  need(!/HAIR DATE/i.test(giftCopy), "gift copy must not mention HAIR DATE (owner dropped the name)");
  need(!/[,\u2013\u2014]/.test([S.gift.title, ...gtext, S.gift.closing, S.gift.cta].join(" ")), "gift page copy must contain no commas or dashes (owner request)");
}
const files = [
  S?.hero?.wide?.video, S?.hero?.wide?.still, S?.hero?.tall?.video, S?.hero?.tall?.still,
  ...(S?.services || []).map((s) => s.image),
  ...(S?.gallery || []).map((g) => g.src),
  ...(S?.testimonials || []).map((t) => t.src),
  ...(S?.videos || []).map((v) => v.poster).filter(Boolean),
  ...(S?.videos || []).filter((v) => v.type === "file").map((v) => v.src),
  S?.about?.image,
  S?.gift?.image,
  S?.promo?.enabled && S.promo.image ? S.promo.image : null,
  S?.logo?.hero, S?.logo?.mark,
].filter(Boolean);
for (const f of files) {
  need(!f.startsWith("/") && !/^https?:/.test(f), `asset path must be relative: ${f}`);
  need(fs.existsSync(path.join(root, f)), `file missing on disk: ${f}`);
}

// No video on this site makes a sound (owner, 01.10: "very important — no audio at all").
// So no video file may even carry an audio track. An MP4 declares what each track is in an
// `hdlr` box, and `soun` there means sound. Every file in assets/video is checked, used or
// not: an unused file is still published.
const hasAudioTrack = (buf) => {
  for (let i = buf.indexOf("hdlr"); i !== -1; i = buf.indexOf("hdlr", i + 4)) {
    if (buf.toString("latin1", i + 12, i + 16) === "soun") return true;
  }
  return false;
};
const videoDir = path.join(root, "assets/video");
const clips = fs.existsSync(videoDir) ? fs.readdirSync(videoDir).filter((f) => /\.(mp4|mov|m4v)$/i.test(f)) : [];
// Every clip must be H.264. The AI clips arrive as 10-bit HEVC, which plays on a Mac and an
// iPhone and nowhere else reliably — Firefox has no HEVC at all, and many Android phones
// cannot decode 10-bit — so a visitor there would get the poster and never the clip. An MP4
// names each track's codec in the first entry of its `stsd` box.
const videoCodec = (buf) => {
  for (let i = buf.indexOf("stsd"); i !== -1; i = buf.indexOf("stsd", i + 4)) {
    const fourcc = buf.toString("latin1", i + 16, i + 20);
    if (["avc1", "avc3", "hvc1", "hev1", "av01", "vp09"].includes(fourcc)) return fourcc;
  }
  return "unknown";
};
for (const f of clips) {
  const buf = fs.readFileSync(path.join(videoDir, f));
  need(!hasAudioTrack(buf), `assets/video/${f} carries an audio track — every clip on this site is silent; strip it with: ffmpeg -i in.mp4 -c:v copy -an out.mp4`);
  const codec = videoCodec(buf);
  need(codec === "avc1" || codec === "avc3", `assets/video/${f} is ${codec}, not H.264 — it will not play in Firefox or on many Android phones; re-encode with: ffmpeg -i in.mp4 -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart -an out.mp4`);
}

// The site's own address is written in four places that cannot read content.js: the CNAME
// file GitHub Pages takes the domain from, and three tags in index.html that link previews
// and search engines read without running a script. They must all name the same host, and
// the picture a shared link shows must be a file that exists.
{
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const cnameFile = path.join(root, "CNAME");
  const host = fs.existsSync(cnameFile) ? fs.readFileSync(cnameFile, "utf8").trim() : "";
  need(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host), `CNAME must hold the site's domain and nothing else, got "${host}"`);
  const home = `https://${host}/`;
  const read = (re, what) => { const m = re.exec(html); need(m, `index.html: ${what} is missing`); return m ? m[1] : ""; };
  const canonical = read(/<link rel="canonical" href="([^"]*)">/, 'link rel="canonical"');
  const ogUrl = read(/<meta property="og:url" content="([^"]*)">/, "og:url");
  const ogImage = read(/<meta property="og:image" content="([^"]*)">/, "og:image");
  need(canonical === home, `index.html: canonical is ${canonical}, but CNAME says ${home}`);
  need(ogUrl === home, `index.html: og:url is ${ogUrl}, but CNAME says ${home}`);
  need(ogImage.startsWith(home), `index.html: og:image must be an address on ${home}, got ${ogImage}`);
  if (ogImage.startsWith(home)) need(fs.existsSync(path.join(root, ogImage.slice(home.length))), `index.html: og:image points at a file that is not there: ${ogImage.slice(home.length)}`);
}

if (errors.length) {
  console.error("check-content: FAIL\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`check-content: OK (${files.length} asset files verified; ${clips.length} video files, all H.264, none with an audio track)`);
