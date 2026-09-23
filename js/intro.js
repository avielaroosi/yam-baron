// Opening animation: the monogram's three letters slide into each other, the wordmark
// settles under them, and the whole lock-up then travels to the hero logo's exact rect
// while the black lifts — so the site looks like it grows out of the brand mark.
//
// The gate that decides whether this runs at all lives inline in index.html (it has to
// paint the black before first paint, and it must be the same code that can un-paint it
// if this file never loads). By the time we get here the decision is already made:
// html.intro-armed present means go, absent means stay out of the way.
(function () {
  "use strict";

  const html = document.documentElement;
  if (!html.classList.contains("intro-armed")) return;

  const disarm = () => html.classList.remove("intro-armed");

  // A restored scroll position (reload partway down the page) would send the logo flying
  // to a hero that isn't on screen. Nothing to open into, so don't open.
  if (window.scrollY > 4) { disarm(); return; }

  const heroLogo = document.getElementById("hero-logo");
  if (!heroLogo) { disarm(); return; }

  const LOGO = "assets/brand/logo-full-light.svg";
  const PATIENCE = 600; // ms we will hold a black screen waiting for the logo

  // ---- fetch the mark as markup: the hero shows the same file as an <img>, so this is
  // one source of truth for both, and the second read comes off the cache.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), PATIENCE));
  const load = fetch(LOGO)
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null);

  Promise.race([load, timeout]).then((markup) => {
    if (!markup || !markup.includes("mg-y")) { disarm(); return; } // slow or broken: just show the site
    start(markup);
  });

  // ---- helpers
  const ms = (el, prop) => {
    const v = getComputedStyle(el).getPropertyValue(prop).trim();
    if (v.endsWith("ms")) return parseFloat(v);
    if (v.endsWith("s")) return parseFloat(v) * 1000;
    return parseFloat(v) || 0;
  };

  function start(markup) {
    const intro = document.createElement("div");
    intro.className = "intro";
    intro.id = "intro";
    intro.setAttribute("aria-hidden", "true");
    const stage = document.createElement("div");
    stage.className = "intro__stage";
    stage.innerHTML = markup;
    const svg = stage.querySelector("svg");
    if (!svg) { disarm(); return; }
    svg.setAttribute("class", "intro__logo");
    svg.removeAttribute("role");
    svg.removeAttribute("aria-label");
    stage.append(Object.assign(document.createElement("span"), { className: "intro__sweep" }));
    intro.append(stage);
    document.body.append(intro);

    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    html.classList.add("intro-running"); // keeps the resting hero logo out of sight until we land on it
    // The overlay is opaque and already on top, so dropping the pre-paint black
    // underneath it is invisible.
    disarm();

    const timers = [];
    const at = (delay, fn) => timers.push(setTimeout(fn, delay));
    let finished = false;

    function cleanup() {
      timers.forEach(clearTimeout);
      html.style.overflow = prevOverflow;
      html.classList.remove("intro-running");
      intro.remove();
      document.removeEventListener("keydown", skip);
    }

    function skip() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      // Put the page right immediately; the half-built logo just fades off the top of it.
      html.classList.remove("intro-running");
      intro.classList.add("is-done");
      setTimeout(cleanup, 260);
    }

    document.addEventListener("keydown", skip);
    intro.addEventListener("click", skip);

    // ---- the hand-off. Both the stage and the hero show the same artwork, so matching
    // the rects makes the swap invisible; we only need the centre delta and the scale.
    function land() {
      const from = stage.getBoundingClientRect();
      const to = heroLogo.getBoundingClientRect();
      if (!from.width || !to.width) { skip(); return; }
      intro.style.setProperty("--flip-s", String(to.width / from.width));
      intro.style.setProperty("--flip-x", `${(to.left + to.right - from.left - from.right) / 2}px`);
      intro.style.setProperty("--flip-y", `${(to.top + to.bottom - from.top - from.bottom) / 2}px`);
      intro.classList.add("is-landing");
    }

    // Let the start state paint before the transitions are armed, or the browser
    // collapses both into one frame and nothing animates.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      intro.classList.add("is-running");
      const flipAt = ms(intro, "--t-flip");
      const total = ms(intro, "--intro-total");

      at(flipAt, () => {
        if (finished) return;
        // Don't uncover a hero logo that hasn't painted yet.
        const ready = heroLogo.decode ? heroLogo.decode().catch(() => {}) : Promise.resolve();
        ready.then(() => { if (!finished) land(); });
      });
      at(total, () => {
        if (finished) return;
        finished = true;
        // The flight has landed on the hero logo's rect: uncover it, then fade this off.
        html.classList.remove("intro-running");
        intro.classList.add("is-done");
        at(260, cleanup);
      });
    }));
  }
})();
