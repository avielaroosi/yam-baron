// Renders the page from window.SITE (js/content.js). No dependencies.
(function () {
  "use strict";
  const S = window.SITE;
  // The reveal animation hides sections with `.js .reveal { opacity: 0 }`. We add that class only
  // once we know the content file loaded, so a broken js/content.js leaves the page visible
  // instead of black.
  if (S) document.documentElement.classList.add("js");
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
    logo.src = S.logo.hero; // alt stays "" on purpose: decorative, #hero-name carries the name
    $("hero-sub").textContent = S.sub;
    $("hero-name").textContent = S.name;
    $("hero-tagline").textContent = S.tagline;
    $("hero-text").textContent = S.heroText;
  }

  // ---- services
  function renderServices() {
    const grid = $("services-grid");
    for (const s of S.services) {
      grid.append(el("article", { class: "card", id: "service-" + s.id }, [
        el("img", { class: "card__img", loading: "lazy", src: s.image, alt: s.title }),
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
    img.src = S.about.image; img.alt = S.about.imageAlt;
    $("about-title").textContent = S.about.title;
    const body = $("about-text");
    body.replaceChildren();
    for (const para of [].concat(S.about.text)) body.append(el("p", { text: para }));
  }

  // ---- contact
  function renderContact() {
    $("contact-wa").href = waLink();
    $("contact-ig").href = igUrl();
    $("contact-tel").href = "tel:+" + S.phone;
    $("contact-tel").textContent = S.phoneDisplay;
    $("contact-address").textContent = S.address;
    const hours = $("contact-hours");
    for (const h of S.hours) hours.append(el("li", {}, [el("span", { text: h.days }), el("span", { text: h.time })]));
    $("contact-map").src = "https://embed.waze.com/iframe?zoom=16&lat=" + S.geo.lat + "&lon=" + S.geo.lon + "&pin=1";
    $("contact-waze").href = "https://waze.com/ul?q=" + encodeURIComponent(S.address) + "&navigate=yes";
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
  let lbOpened = 0;
  let lbScrollY = 0;
  const lbFocusable = () => [$("lightbox-close"), $("lightbox-prev"), $("lightbox-next")];
  function renderGallery() {
    const grid = $("gallery-grid");
    S.gallery.forEach((g, i) => {
      const btn = el("button", { class: "gallery__item", type: "button", "aria-label": g.alt, "data-index": String(i) }, [
        el("img", { loading: "lazy", src: g.src, alt: g.alt }),
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
    lbOpened = i;
    showLightbox(i);
    $("lightbox").hidden = false;
    // iOS ignores overflow:hidden on <body>, so pin the body at the current offset instead.
    lbScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = -lbScrollY + "px";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    $("lightbox-close").focus();
  }
  function closeLightbox() {
    $("lightbox").hidden = true;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto"; // jump back, never animate the restore
    window.scrollTo(0, lbScrollY);
    html.style.scrollBehavior = prevBehavior;
    const item = document.querySelector(`.gallery__item[data-index="${lbOpened}"]`);
    if (item) item.focus({ preventScroll: true });
  }
  function initLightbox() {
    const lb = $("lightbox");
    $("lightbox-close").addEventListener("click", closeLightbox);
    $("lightbox-prev").addEventListener("click", () => showLightbox(lbIndex - 1));
    $("lightbox-next").addEventListener("click", () => showLightbox(lbIndex + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") showLightbox(lbIndex + 1);
      else if (e.key === "ArrowRight") showLightbox(lbIndex - 1);
      else if (e.key === "Tab") { // keep focus inside the dialog, wrapping in both directions
        const items = lbFocusable();
        const at = items.indexOf(document.activeElement);
        const to = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at === -1 || at === items.length - 1 ? 0 : at + 1);
        e.preventDefault();
        items[to].focus();
      }
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
  function placeholderFrame(v) {
    return el("div", { class: "video__placeholder" }, [
      v.poster ? el("img", { loading: "lazy", src: v.poster, alt: v.title }) : null,
      el("span", { class: "video__play", "aria-hidden": "true" }),
      el("span", { class: "video__soon", text: "סרטון בקרוב" }),
    ]);
  }
  function renderVideos() {
    const grid = $("videos-grid");
    let needInstagram = false;
    for (const v of S.videos) {
      let media;
      const id = v.type === "youtube" ? youtubeId(v.src) : null;
      if (v.type === "file") {
        // poster + the gold play ring until the visitor taps; native controls appear only while playing
        const video = el("video", { class: "video__media", src: v.src, poster: v.poster, playsinline: true, preload: "none" });
        const play = el("button", { class: "video__play video__play--btn", type: "button", "aria-label": "נגן: " + v.title });
        media = el("div", { class: "video__player" }, [video, play]);
        const showRing = () => { media.classList.remove("is-playing"); video.controls = false; };
        play.addEventListener("click", () => {
          media.classList.add("is-playing");
          video.controls = true;
          const p = video.play();
          if (p && p.catch) p.catch(showRing);
        });
        video.addEventListener("ended", showRing);
        video.addEventListener("error", showRing);
      } else if (v.type === "youtube" && !id) {
        console.warn("video: unrecognized YouTube URL", v.src);
        media = placeholderFrame(v);
      } else if (v.type === "youtube") {
        media = el("iframe", { class: "video__media", src: `https://www.youtube-nocookie.com/embed/${id}`, title: v.title, loading: "lazy", allow: "accelerometer; encrypted-media; picture-in-picture", allowfullscreen: true });
      } else if (v.type === "instagram") {
        needInstagram = true;
        media = el("blockquote", { class: "instagram-media video__media", "data-instgrm-permalink": v.src, "data-instgrm-version": "14" }, [
          el("a", { href: v.src, target: "_blank", rel: "noopener", text: v.title }),
        ]);
      } else {
        media = placeholderFrame(v);
      }
      grid.append(el("figure", { class: "video", "data-type": v.type }, [media, el("figcaption", { class: "video__title", text: v.title })]));
    }
    if (needInstagram && !document.querySelector('script[src*="instagram.com/embed.js"]')) {
      document.body.append(el("script", { src: "https://www.instagram.com/embed.js", async: true }));
    }
  }

  // ---- floating WhatsApp button: hidden while the hero is on screen
  function initFab() {
    const fab = $("wa-fab");
    fab.href = waLink();
    fab.classList.add("is-visible"); // the hero has no contact buttons, so the floating button shows from the start
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

  // ---- boot (later tasks add their init calls here)
  const safe = (name, fn) => { try { fn(); } catch (e) { console.error("render failed: " + name, e); } };
  safe("hero", renderHero);
  safe("services", renderServices);
  safe("gallery", renderGallery);
  safe("lightbox", initLightbox);
  safe("videos", renderVideos);
  safe("about", renderAbout);
  safe("contact", renderContact);
  safe("footer", renderFooter);
  safe("fab", initFab);
  safe("reveal", initReveal);
})();
