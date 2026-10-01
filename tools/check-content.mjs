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
need(S?.hero?.image && S?.hero?.alt, "SITE.hero needs {image, alt}");
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
  S?.hero?.image,
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
for (const f of clips) {
  need(!hasAudioTrack(fs.readFileSync(path.join(videoDir, f))), `assets/video/${f} carries an audio track — every clip on this site is silent; strip it with: ffmpeg -i in.mp4 -c:v copy -an out.mp4`);
}

if (errors.length) {
  console.error("check-content: FAIL\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`check-content: OK (${files.length} asset files verified; ${clips.length} video files, none with an audio track)`);
