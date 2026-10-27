/* ─────────────────────────────────────────────────────────────
   _placeholder/module.js — the module that stands in for the ten
   programs that have not been built yet
   ─────────────────────────────────────────────────────────────
   Twelve modules are catalogued; two of them (the AI Innovation
   Pipeline and Executive Readiness) have code. The other ten point
   their `scripts` at THIS file rather than at ten near-identical
   copies of a coming-soon page.

   That is the whole point of it: a planned module is already a real
   route with a real URL, a real workspace key, a real entry in the
   launchpad and the header switcher, and a real slot in the server's
   allowlist. Everything about it works except its content. When a
   program is ready, its entry in config/catalogue.json gets

     "status":  "live"
     "scripts": ["js/modules/<id>/module.js", ...]

   and nothing else in the codebase changes.

   It registers under whatever module is ACTIVE — unlike a real
   module, which names itself — because one file serves all ten.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var id = Modules.activeId();
  var m = Modules.active() || {};

  function esc(s) {
    return s == null ? '' : String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* One screen, whatever page the shell asks for. A planned module has no
     phases, so every route — Home, Learn, the program, a step — resolves
     here instead of rendering an empty grid that looks broken. */
  function screen() {
    var role = Modules.activeRole() || {};
    var back = (window.Router && Router.roleUrl(role.key)) || '#';
    return '' +
      '<div class="zoom-wrap" id="zoomWrap"><div class="soon-screen reveal">' +
      '<div class="soon-card">' +
      '<div class="soon-eyebrow">' + esc(m.tag || ((role.name || '') + ' program')) + '</div>' +
      '<h1 class="soon-title">' + esc(m.name || 'This program') + '</h1>' +
      '<p class="soon-sub">' + esc(m.sub || '') + '</p>' +
      '<div class="soon-badge">In development</div>' +
      '<p class="soon-note">This program is catalogued and addressable — its URL, its ' +
      'workspace and its place in the suite are already reserved — but its 90 days of ' +
      'content are still being written. Everything shared across the suite (your ' +
      'organization, your team, notes, chat) is live here today.</p>' +
      '<a class="soon-back" href="' + esc(back) + '">&larr; Back to ' + esc(role.name || 'the programs') + '</a>' +
      '</div></div></div>';
  }

  Modules.define(id, {
    /* No phases: this is what tells the sidebar and the progress meters that
       there is nothing to walk yet, rather than showing an empty 90 days. */
    PH: [],
    MILESTONES: {},
    PHASE_WRAPUPS: {},

    /* The workspace still exists and still saves — a planned module is a real
       (empty) document, so the day its content lands there is somewhere for
       the first answer to go. */
    emptyData: function () {
      return { startDate: new Date().toISOString().split('T')[0], roster: [], answers: {} };
    },

    coachGreeting: 'This program is still in development. Ask me about the ' +
      'programs that are live, or about your organization and team.',

    /* Every page id the shell can route to, so none of them fall through to
       the Pipeline's renderers (which would read phases this module has none
       of). Adding a page id to the shell means adding it here too. */
    pages: {
      home: screen, learn: screen, insights: screen,
      pipeline: screen, phase: screen, phase5: screen,
      step: screen, outcome: screen
    }
  });
})();
