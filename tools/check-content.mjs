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
need(typeof S?.geo?.lat === "number" && typeof S?.geo?.lon === "number" && Math.abs(S.geo.lat) <= 90 && Math.abs(S.geo.lon) <= 180, "SITE.geo needs numeric {lat, lon}");
need(S?.about?.image && S?.about?.imageAlt && S?.about?.title, "SITE.about needs {image, imageAlt, title}");
const aboutText = [].concat(S?.about?.text ?? []);
need(aboutText.length > 0 && aboutText.every((t) => typeof t === "string" && t.trim()), "SITE.about.text must be a non-empty string or a list of non-empty paragraphs");
need(S?.logo?.hero && S?.logo?.mark, "SITE.logo needs {hero, mark}");

const files = [
  S?.hero?.image,
  ...(S?.services || []).map((s) => s.image),
  ...(S?.gallery || []).map((g) => g.src),
  ...(S?.videos || []).map((v) => v.poster).filter(Boolean),
  ...(S?.videos || []).filter((v) => v.type === "file").map((v) => v.src),
  S?.about?.image,
  S?.logo?.hero, S?.logo?.mark,
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
