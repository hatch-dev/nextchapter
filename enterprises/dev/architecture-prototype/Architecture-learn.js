/* ─────────────────────────────────────────────────────────────
   learn.js — Learn screen module
   ─────────────────────────────────────────────────────────────
   Markup lives in learn.html (no inline JS); this file holds the
   screen's logic. Shared plumbing lives in screen-loader.js.

   The Learn screen is fully static — article, book, video, and
   podcast cards are plain <a target="_blank"> links — so no extra
   wiring is needed beyond the standard mount. To edit the reading
   list, edit learn.html directly (then re-run build-templates.js).

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
