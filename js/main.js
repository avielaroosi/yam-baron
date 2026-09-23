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
