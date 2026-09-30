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
    // The loops are 2-4MB each; a phone gets the still photograph instead.
    const heroVideo = document.getElementById("hero-video");
    if (heroVideo && matchMedia("(min-width: 820px)").matches) {
      heroVideo.poster = "assets/img/hero-video-poster.jpg";
      heroVideo.src = "assets/video/hero-wide.mp4";
      heroVideo.preload = "metadata";
    }
    const logo = $("hero-logo");
    logo.src = S.logo.hero; // alt stays "" on purpose: decorative, #hero-name carries the name
    $("hero-sub").textContent = S.sub;
    $("hero-name").textContent = S.name;
    $("hero-tagline").textContent = S.tagline;
    $("hero-text").textContent = S.heroText;
  }

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

  // ---- about
  function renderAbout() {
    const img = $("about-img");
    img.src = S.about.image; img.alt = S.about.imageAlt;
    $("about-title").textContent = S.about.title;
    const body = $("about-text");
    body.replaceChildren();
    for (const para of [].concat(S.about.text)) body.append(el("p", { text: para }));
  }

  // ---- gift card: photo banner on the home page + popup with the full text (same manners as the promo popup).
  // Shows only when content.js has an enabled gift block (an old cached content.js has none). ?gift = share link: opens the popup on load.
  function renderGift() {
    const band = $("gift-band"), root = $("gift");
    const G = S.gift;
    if (!G || G.enabled === false) { band.hidden = true; if (root) root.remove(); return; }
    const bimg = $("gift-band-img");
    bimg.src = G.image; bimg.alt = G.alt;
    $("gift-band-eyebrow").textContent = G.bandEyebrow;
    $("gift-band-title").textContent = G.title;
    $("gift-band-cta").textContent = G.bandCta;
    band.hidden = false;

    const img = $("gift-img"); img.alt = G.alt; // src is set only when the popup opens
    $("gift-eyebrow").textContent = G.bandEyebrow;
    $("gift-title").textContent = G.title;
    const body = $("gift-text"); body.replaceChildren();
    for (const para of [].concat(G.text)) body.append(el("p", { text: para }));
    $("gift-closing").textContent = G.closing;
    const cta = $("gift-cta");
    cta.textContent = G.cta; cta.href = waLink(G.whatsappText);

    let lastFocus = null;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close() {
      root.classList.remove("is-open");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => { root.hidden = true; }, 320);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function open() {
      const h = document.documentElement;
      if (h.classList.contains("intro-armed") || h.classList.contains("intro-running")) { setTimeout(open, 800); return; }
      lastFocus = document.activeElement;
      if (!img.getAttribute("src")) img.src = G.image;
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add("is-open"));
      $("gift-close").focus();
      document.addEventListener("keydown", onKey);
    }
    $("gift-band-cta").addEventListener("click", open);
    $("gift-close").addEventListener("click", close);
    $("gift-cta").addEventListener("click", close);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    if (/[?&]gift\b/.test(location.search)) setTimeout(open, 400);
  }

  // ---- contact
  function renderContact() {
    $("contact-wa").href = waLink();
    $("contact-ig").href = igUrl();
    $("contact-tel").href = "tel:+" + S.phone;
    $("contact-tel").textContent = S.phoneDisplay;
    $("contact-address").textContent = S.address;
    $("contact-waze").href = "https://waze.com/ul?q=" + encodeURIComponent(S.address) + "&navigate=yes";
    // The map follows the address in content.js, so an address change moves the pin too.
    const map = $("contact-map");
    if (map) map.src = "https://www.google.com/maps?q=" + encodeURIComponent(S.address) + "&output=embed&hl=he";
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

  // ---- gallery + lightbox (the lightbox serves any list of {src, alt}: gallery, testimonials)
  let lbItems = [];
  let lbIndex = 0;
  let lbOpenedEl = null;
  let lbScrollY = 0;
  const lbFocusable = () => [$("lightbox-close"), $("lightbox-prev"), $("lightbox-next")];
  function renderGallery() {
    const grid = $("gallery-grid");
    S.gallery.forEach((g, i) => {
      const btn = el("button", { class: "gallery__item", type: "button", "aria-label": g.alt, "data-index": String(i) }, [
        el("img", { loading: "lazy", src: g.src, alt: g.alt }),
      ]);
      btn.addEventListener("click", () => openLightbox(S.gallery, i, btn));
      grid.append(btn);
    });
  }
  function showLightbox(i) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    const g = lbItems[lbIndex];
    const img = $("lightbox-img");
    img.src = g.src; img.alt = g.alt;
    $("lightbox-count").textContent = `${lbIndex + 1} / ${lbItems.length}`;
  }
  function openLightbox(items, i, sourceEl) {
    lbItems = items;
    lbOpenedEl = sourceEl || null;
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
    if (lbOpenedEl) lbOpenedEl.focus({ preventScroll: true });
  }

  // ---- testimonials: screenshots the owner adds to content.js; empty list = "coming soon" note
  function renderTestimonials() {
    const grid = $("testimonials-grid");
    const items = S.testimonials || [];
    $("testimonials-empty").hidden = items.length > 0;
    items.forEach((t, i) => {
      const btn = el("button", { class: "testimonial", type: "button", "aria-label": t.alt }, [
        el("img", { loading: "lazy", src: t.src, alt: t.alt }),
      ]);
      btn.addEventListener("click", () => openLightbox(items, i, btn));
      grid.append(btn);
    });
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
        // scrolling away pauses it (owner: a video must not keep playing off screen); the ring returns, a tap resumes where it stopped
        if ("IntersectionObserver" in window) {
          new IntersectionObserver((entries) => {
            for (const e of entries) if (!e.isIntersecting && media.classList.contains("is-playing")) { video.pause(); showRing(); }
          }, { threshold: 0.35 }).observe(video);
        }
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

  // ---- promo popup: first-visit discount, once per rememberDays, never during the opening animation
  function initPromo() {
    const P = S.promo;
    const root = $("promo");
    if (!P || !P.enabled) { if (root) root.remove(); return; }
    const img = $("promo-img"); img.alt = ""; // src is set only when the popup opens (no download for visitors who never see it)
    const visualSrc = P.image || S.logo.hero;
    $("promo-visual").classList.add(P.image ? "promo__visual--photo" : "promo__visual--logo");
    $("promo-eyebrow").textContent = P.eyebrow;
    $("promo-big").textContent = P.big;
    $("promo-big-label").textContent = P.bigLabel;
    $("promo-subtitle").textContent = P.subtitle || "";
    $("promo-subtitle").hidden = !P.subtitle;
    const body = $("promo-text"); body.replaceChildren();
    for (const para of [].concat(P.text || [])) body.append(el("p", { text: para }));
    $("promo-highlight").textContent = P.highlight || "";
    $("promo-highlight").hidden = !P.highlight;
    $("promo-cta").textContent = P.cta;
    $("promo-cta").href = waLink(P.whatsappText);
    $("promo-fine").textContent = P.fine;

    // shows on every visit until the CTA is clicked; closing only hides it for the current browser session
    const USED = "yb-promo-used", DISMISSED = "yb-promo-dismissed";
    const preview = /[?&]promo\b/.test(location.search); // ?promo → always show, right away (owner preview)
    let used = 0, dismissed = false;
    try { used = Number(localStorage.getItem(USED)) || 0; } catch (e) { /* no storage: show every time */ }
    try { dismissed = sessionStorage.getItem(DISMISSED) === "1"; } catch (e) { /* ignore */ }
    if (preview) { try { localStorage.removeItem(USED); sessionStorage.removeItem(DISMISSED); } catch (e) { /* ignore */ } } // ?promo also resets this browser
    const giftShare = /[?&]gift\b/.test(location.search); // ?gift opens the gift popup instead; two popups at once would fight
    if (!preview && (giftShare || dismissed || Date.now() - used < (P.hideAfterUseDays || 365) * 864e5)) return;

    let lastFocus = null;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close() {
      if (!preview) { try { sessionStorage.setItem(DISMISSED, "1"); } catch (e) { /* ignore */ } }
      root.classList.remove("is-open");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => { root.hidden = true; }, 320);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function open() {
      const h = document.documentElement;
      if (h.classList.contains("intro-armed") || h.classList.contains("intro-running")) { setTimeout(open, 800); return; }
      lastFocus = document.activeElement;
      if (!img.getAttribute("src")) img.src = visualSrc;
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add("is-open"));
      $("promo-close").focus();
      document.addEventListener("keydown", onKey);
    }
    $("promo-close").addEventListener("click", close);
    $("promo-cta").addEventListener("click", () => {
      try { localStorage.setItem(USED, String(Date.now())); } catch (e) { /* ignore */ }
      close();
    });
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    setTimeout(open, preview ? 800 : (P.delayMs || 6000));
  }

  // ---- boot (later tasks add their init calls here)
  const safe = (name, fn) => { try { fn(); } catch (e) { console.error("render failed: " + name, e); } };
  safe("hero", renderHero);
  safe("services", renderServices);
  safe("gallery", renderGallery);
  safe("lightbox", initLightbox);
  safe("videos", renderVideos);
  safe("testimonials", renderTestimonials);
  safe("gift", renderGift);
  safe("about", renderAbout);
  safe("contact", renderContact);
  safe("footer", renderFooter);
  safe("fab", initFab);
  safe("reveal", initReveal);
  safe("ambient", initAmbientVideo);
  safe("promo", initPromo);
})();
