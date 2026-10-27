/* ─────────────────────────────────────────────────────────────
   Governance-home.js — Home screen module (governance app)
   ─────────────────────────────────────────────────────────────
   Markup lives in Governance-home.html (no inline JS); shared plumbing lives
   in Governance-screen-loader.js. Same pattern as the innovation app.

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
