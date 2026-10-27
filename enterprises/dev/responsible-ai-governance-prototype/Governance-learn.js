/* ─────────────────────────────────────────────────────────────
   Governance-learn.js — Learn screen module (governance app)
   ─────────────────────────────────────────────────────────────
   Markup lives in Governance-learn.html (no inline JS); shared plumbing lives
   in Governance-screen-loader.js. Same pattern as the innovation app.

   Public API (attached to window):
     renderLearn(container)
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function renderLearn(container) {
    Screens.mount('learn', container);
  }

  window.renderLearn = renderLearn;
})();
