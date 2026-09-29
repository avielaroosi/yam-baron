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
