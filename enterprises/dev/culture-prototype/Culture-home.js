/* ─────────────────────────────────────────────────────────────
   Culture-home.js — Home screen module (governance app)
   ─────────────────────────────────────────────────────────────
   Markup lives in Culture-home.html (no inline JS); shared plumbing lives
   in Culture-screen-loader.js. Same pattern as the innovation app.

   Public API (attached to window):
     renderHome(container)
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function renderHome(container) {
    Screens.mount('home', container);
  }

  window.renderHome = renderHome;
})();
