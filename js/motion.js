// The motion layer. Everything in here is decoration: the page reads the same with this
// file missing, and it does nothing at all for a visitor who asked for less motion.
// Content motion (fades, small rises, an unveil) guides attention; the one piece of
// graphical motion is the gallery, whose two rows drift on their own and are geared to
// the page scroll — faster when it is scrolled hard, turning round when it turns round.
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const html = document.documentElement;
  const mm = gsap.matchMedia();

  // The gallery is tuned here, in one place.
  const DRIFT = 80;        // px per second a row moves at rest
  const SCROLL_GAIN = 420; // every 420 px/s of page scroll adds one more DRIFT of speed
  const BOOST_MAX = 7;     // the most a hard scroll can add
  const DRAG_SLOP = 6;     // px a pointer must travel before a press becomes a drag
  const FOCUS_INSET = 8;   // px a keyboard-focused tile is kept clear of the row's edge
  const MAX_SETS = 6;      // ghost copies of a row's photographs, at most

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    html.classList.add("is-motion");
    const ac = new AbortController();
    const on = { signal: ac.signal };
    const observers = [];

    // ScrollTrigger measures by jumping the page to the top and back. With
    // `scroll-behavior: smooth` on <html> it switches the property off first — but the
    // browser has not recomputed the style by the time the jump is made, so the jump is
    // a smooth one, which is to say it has not happened yet, and every position is
    // measured from wherever the page happened to be. A resize half-way down the page
    // put every trigger 3,800px out. Reading the computed value forces the recompute.
    const settle = () => { html.style.scrollBehavior = "auto"; void getComputedStyle(html).scrollBehavior; };
    ScrollTrigger.addEventListener("refreshInit", settle);

    // ---- hero: the content drifts up and thins out as the canvas scrolls away
    const heroInner = document.querySelector(".hero__inner");
    if (heroInner) {
      gsap.to(heroInner, { yPercent: -18, opacity: 0, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 35%", scrub: true } });
    }

    // ---- chapters: the photograph is unveiled from its own side, then drifts a little
    // slower than the page; the words follow it in, one after another
    document.querySelectorAll(".chapter").forEach((ch) => {
      const flipped = ch.classList.contains("chapter--flip");
      const media = ch.querySelector(".chapter__media");
      const img = media && media.querySelector("img");
      const body = ch.querySelector(".chapter__body");
      if (media) {
        gsap.fromTo(media, { clipPath: flipped ? "inset(0% 100% 0% 0%)" : "inset(0% 0% 0% 100%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power3.out", clearProps: "clipPath",
            scrollTrigger: { trigger: ch, start: "top 78%", once: true } });
      }
      if (img) {
        // scaled so the frame stays full while the photograph travels inside it
        gsap.fromTo(img, { yPercent: -4, scale: 1.1 }, { yPercent: 4, scale: 1.1, ease: "none",
          scrollTrigger: { trigger: ch, start: "top bottom", end: "bottom top", scrub: true } });
      }
      if (body) {
        gsap.from(body.children, { y: 24, opacity: 0, duration: 0.7, stagger: 0.1, ease: "power2.out",
          scrollTrigger: { trigger: ch, start: "top 70%", once: true } });
      }
    });

    // ---- proof: the cards arrive one after another, slightly smaller, and settle
    const cards = document.querySelectorAll(".proof .videos, .proof .testimonial");
    if (cards.length) {
      gsap.from(cards, { y: 28, scale: 0.94, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power2.out",
        scrollTrigger: { trigger: ".proof", start: "top 80%", once: true } });
    }

    // ---- contact: the map band is unveiled from the top
    const map = document.querySelector(".contact__map");
    if (map) {
      gsap.fromTo(map, { clipPath: "inset(0% 0% 100% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power3.out", clearProps: "clipPath",
          scrollTrigger: { trigger: map, start: "top 85%", once: true } });
    }

    // ---- gallery: two rows that loop.
    // A row's track holds its photographs followed by as many ghost copies as it takes to
    // fill the row, so sliding the track by one "period" (the width of one set) and
    // starting over cannot be seen. The position is a plain number advanced once a frame:
    // a steady drift, plus the page's scroll speed, in the direction the page last moved.
    // The tiles are never rotated or skewed — they only travel. A row rests under a mouse
    // pointer (unless the page is being scrolled), stops for keyboard focus, and can be
    // dragged; a drag is not a click, so it does not open the lightbox.
    const wrap = (v, p) => ((v % p) + p) % p;
    const ghostOf = (btn) => {
      const g = btn.cloneNode(true);
      g.className = "gallery__ghost";
      g.removeAttribute("aria-label");
      g.removeAttribute("data-index");
      g.setAttribute("aria-hidden", "true");
      g.tabIndex = -1;
      const img = g.querySelector("img");
      if (img) img.alt = "";
      g.addEventListener("click", () => btn.click()); // a ghost opens its original's place in the lightbox
      return g;
    };

    const byRow = new Map();
    const rows = [...document.querySelectorAll(".gallery__row")].map((row, i) => {
      const track = row.querySelector(".gallery__track");
      if (!track || !track.children.length) return null;
      const r = {
        row, track, originals: [...track.children], ghosts: [],
        dir: i % 2 ? -1 : 1,                                         // neighbouring rows run opposite ways
        sign: getComputedStyle(row).direction === "rtl" ? 1 : -1,    // an RTL track overflows to the left, so it loops rightwards
        o: 0, x: null, period: 0, first: true,
        idle: 1, fling: 0, shown: false, hover: false, focus: false, drag: null, swallow: false,
        setX: gsap.quickSetter(track, "x", "px"),
      };
      byRow.set(row, r);
      return r;
    }).filter(Boolean);

    const layout = (r) => {
      r.ghosts.forEach((g) => g.remove());
      r.ghosts = [];
      const gap = parseFloat(getComputedStyle(r.track).columnGap) || 0;
      const one = r.track.getBoundingClientRect().width;
      if (!one) { r.period = 0; return; }
      r.period = one + gap;
      // enough ghost sets to fill the row, and never a runaway: a row that reports a
      // width of many periods is a layout fault, not a reason to clone a thousand tiles
      const sets = Math.min(MAX_SETS, Math.ceil((r.row.clientWidth + gap) / r.period));
      for (let s = 0; s < sets; s++) {
        for (const b of r.originals) { const g = ghostOf(b); r.track.append(g); r.ghosts.push(g); }
      }
      if (r.first) { r.o = r.dir < 0 ? r.period / 2 : 0; r.first = false; } // the second row starts half a turn in, so the two never line up
      r.o = wrap(r.o, r.period);
      r.x = null;
    };

    if (rows.length) {
      const sized = new ResizeObserver((entries) => { for (const e of entries) { const r = byRow.get(e.target); if (r) layout(r); } });
      const seen = new IntersectionObserver((entries) => { for (const e of entries) { const r = byRow.get(e.target); if (r) r.shown = e.isIntersecting; } }, { rootMargin: "120px 0px" });
      observers.push(sized, seen);

      // Tiles waiting off to the side are clipped, and a clipped lazy image does not load
      // until it is already on screen — it would arrive blank. Load the lot as the
      // gallery comes near instead.
      const grid = rows[0].row.parentElement;
      const near = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        grid.querySelectorAll("img").forEach((img) => { img.loading = "eager"; });
        near.disconnect();
      }, { rootMargin: "900px 0px" });
      near.observe(grid);
      observers.push(near);

      rows.forEach((r) => {
        const { row } = r;
        sized.observe(row);
        seen.observe(row);

        row.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") r.hover = true; }, on);
        row.addEventListener("pointerleave", () => { r.hover = false; }, on);

        row.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          r.swallow = false;
          r.fling = 0;
          r.drag = { id: e.pointerId, x: e.clientX, o: r.o, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
        }, on);
        row.addEventListener("pointermove", (e) => {
          const d = r.drag;
          if (!d || e.pointerId !== d.id) return;
          const dx = e.clientX - d.x;
          if (!d.moved) {
            if (Math.abs(dx) < DRAG_SLOP) return;
            d.moved = true;
            row.classList.add("is-dragging");
            try { row.setPointerCapture(e.pointerId); } catch (_) { /* the pointer is already gone */ }
          }
          r.o = wrap(d.o + dx, r.period); // the track follows the finger whichever way the row loops
          const now = performance.now();
          d.v = ((e.clientX - d.lastX) / Math.max(1, now - d.lastT)) * 1000;
          d.lastX = e.clientX;
          d.lastT = now;
        }, on);
        const release = (e) => {
          const d = r.drag;
          if (!d || e.pointerId !== d.id) return;
          r.drag = null;
          row.classList.remove("is-dragging");
          if (d.moved) {
            r.swallow = true;                                         // the click that follows a drag is not a click
            if (performance.now() - d.lastT < 80) r.fling = d.v;      // let go while moving: carry on, then settle
          }
        };
        // on the window, not the row: a press that ends outside the row must still end
        window.addEventListener("pointerup", release, on);
        window.addEventListener("pointercancel", release, on);
        row.addEventListener("click", (e) => {
          if (!r.swallow) return;
          r.swallow = false;
          e.preventDefault();
          e.stopPropagation();
        }, { capture: true, signal: ac.signal });

        // keyboard focus: stop, and bring the focused tile fully into the row
        row.addEventListener("focusin", (e) => {
          const tile = e.target.closest(".gallery__item");
          if (!tile || !tile.matches(":focus-visible") || !r.period) return;
          r.focus = true;
          r.fling = 0;
          // Not wrapped: wrapping here could park a ghost where the focused tile should be
          // and leave the real one, with its focus ring, a whole period off screen. The
          // next frame of movement wraps it again, and that jump cannot be seen.
          const t = tile.getBoundingClientRect(), w = row.getBoundingClientRect();
          if (t.left < w.left + FOCUS_INSET) r.o += w.left + FOCUS_INSET - t.left;
          else if (t.right > w.right - FOCUS_INSET) r.o -= t.right - (w.right - FOCUS_INSET);
        }, on);
        row.addEventListener("focusout", () => { r.focus = false; }, on);
        // belt to the `overflow: clip` braces in the stylesheet: never let the row itself scroll
        row.addEventListener("scroll", () => { if (row.scrollLeft) row.scrollLeft = 0; }, on);
      });
    }

    // A row held for keyboard focus stays held only while the keyboard is what is being
    // used. Closing the lightbox with Escape hands focus back to its tile, and without
    // this the row would then sit frozen until something else took focus.
    if (rows.length) {
      const letGo = () => { for (const r of rows) r.focus = false; };
      let px = -1, py = -1;
      window.addEventListener("wheel", letGo, { passive: true, signal: ac.signal });
      window.addEventListener("pointerdown", letGo, on);
      // only a pointer that actually moved: browsers also fire moves when content slides under a still one
      window.addEventListener("pointermove", (e) => { if (e.clientX !== px || e.clientY !== py) { px = e.clientX; py = e.clientY; letGo(); } }, on);
    }

    // `o` is how far the track sits to the right of its resting place, 0 <= o < period.
    // For an RTL row that is exactly the seamless range; an LTR row loops leftwards, so
    // its position is the same number below zero.
    const place = (r) => {
      if (r.o === r.x) return;
      r.x = r.o;
      r.setX(r.sign > 0 ? r.o : r.o - r.period);
    };

    let lastY = window.scrollY, boost = 0, turn = 1, flow = 1;
    const ease = (cur, to, dt, rate) => { const v = cur + (to - cur) * (1 - Math.exp(-dt * rate)); return Math.abs(to - v) < 0.001 ? to : v; };
    const tick = (time, delta) => {
      const dt = Math.min(delta, 64) / 1000;
      if (!dt) return;
      const y = window.scrollY, v = (y - lastY) / dt;
      lastY = y;
      boost = ease(boost, Math.min(Math.abs(v) / SCROLL_GAIN, BOOST_MAX), dt, 7);
      if (Math.abs(v) > 30) turn = v > 0 ? 1 : -1;
      flow = ease(flow, turn, dt, 5);
      for (const r of rows) {
        if (!r.shown || !r.period) continue;
        if (!(r.drag && r.drag.moved)) {
          r.idle = ease(r.idle, r.hover || r.focus || r.drag ? 0 : 1, dt, 10);
          const speed = r.focus ? 0 : r.dir * flow * DRIFT * (r.idle + boost) + r.fling;
          if (speed) r.o = wrap(r.o + speed * dt, r.period);
          r.fling = Math.abs(r.fling) < 4 ? 0 : r.fling * Math.exp(-dt * 4);
        }
        place(r);
      }
    };
    if (rows.length) gsap.ticker.add(tick);

    // Web fonts land after the first measure and nudge every section below them (text
    // wraps differently, most of all on a phone). `fonts.ready` alone is not enough: it
    // is already resolved if the font requests have not started yet.
    if (document.fonts) {
      const remeasure = () => { if (!ac.signal.aborted) ScrollTrigger.refresh(true); };
      document.fonts.addEventListener("loadingdone", remeasure, on);
      if (document.fonts.ready) document.fonts.ready.then(remeasure);
    }

    return () => {
      ScrollTrigger.removeEventListener("refreshInit", settle);
      gsap.ticker.remove(tick);
      ac.abort();
      observers.forEach((o) => o.disconnect());
      rows.forEach((r) => {
        r.ghosts.forEach((g) => g.remove());
        r.row.classList.remove("is-dragging");
        gsap.set(r.track, { clearProps: "transform" });
      });
      html.classList.remove("is-motion");
    };
  });
})();
