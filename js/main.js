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
    const logo = $("hero-logo");
    logo.src = S.logo.hero;
    logo.alt = S.name + " " + S.sub;
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
    const fl = $("footer-logo");
    fl.loading = "lazy";
    fl.alt = S.name;
    fl.src = S.logo.mark;
    $("footer-name").textContent = S.name;
    $("footer-year").textContent = String(new Date().getFullYear());
  }

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

  // ---- boot (later tasks add their init calls here)
  renderHero();
  renderServices();
  renderGallery();
  initLightbox();
  renderVideos();
  renderAbout();
  renderContact();
  renderFooter();
})();
