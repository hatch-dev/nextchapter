/* ─────────────────────────────────────────────────────────────
   home.js — Home screen module
   ─────────────────────────────────────────────────────────────
   Markup lives in home.html (no inline JS); this file holds the
   screen's logic. Shared plumbing (template fetch, data-nav /
   data-url wiring, scroll-reveal) lives in screen-loader.js.

   Public API (attached to window):
     renderHome(container)
       Fetches home.html (cached), injects it, wires events.

   Pattern to replicate for other screens:
     learn.html + learn.js → renderLearn(container)
     ...etc. Then register the screen in SCREEN_MODULES (app.js).
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function renderHome(container) {
    Screens.mount('home', container);
  }

  window.renderHome = renderHome;
})();
