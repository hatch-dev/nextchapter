/* ─────────────────────────────────────────────────────────────
   ethics-engine/module.js — Conscience module
   ─────────────────────────────────────────────────────────────
   Ported from leaders/dev/conscience-ethical-reasoning, which was a whole second
   copy of the application. Everything that copy duplicated — the
   store, sign-in, the header and its theme / zoom / Notes / AI Guide
   / voice actions, printing — is the shell's here, and this file
   carries only what makes the program itself: the shape of its
   workspace and the seams its screens need.

   The screens are in program.js, generated from the reference build
   by tools/port-leader-module.js — the Practice board and its four
   lenses, the situation detail, the Drills cabinet, the Assess
   battery, the Dashboard and the Insights shelf, lifted function for
   function. This file is the registration.

   It is the Decision Lab's sibling and reads almost the same, which
   is honest: the two were built from one lineage. Where they differ
   is what the flow is FOR. The Decision Lab tests a judgment call
   for soundness; this one tests an instinct against four lenses —
   your stake, the people, the principle, and who it makes you — and
   then asks you to say the answer out loud. It also carries a second
   practice surface the Decision Lab has no equivalent of: the Drills
   cabinet, short scenarios run against the same four lenses.

   Anything an inline onclick in this module's markup needs is hung
   off the single global `EE`.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var EE = window.EE = window.EE || {};

  /* program.js assigns the program's variables on first use rather than at
     load — boot.js loads a module's code in the <head>, before app.js, so
     `Store`, `UI` and `data` do not exist yet at that point. Every seam goes
     through here first, because a seam can be the first thing this module is
     asked for (beforeNavigate runs before the first render). */
  function ready() { if (EE.initVars) EE.initVars(); ensureFocusLayer(); normalize(); }

  /* The focus layer — the card that flips open when you press OPEN → on the
     board, and on a drill. See the Decision Lab's module.js for the full note;
     the short version is that renderFocus() writes into #focusInner and
     flipOpen() animates #focusCard, both of which have to exist OUTSIDE #app
     (the shell replaces #app's contents on every render). The reference
     declared them in its index.html; shell.html does not, because they are
     this program's furniture rather than the suite's.

     The backdrop click comes with it — in the reference that is a top-level
     IIFE, boot code the port cannot lift. */
  function ensureFocusLayer() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('focusBg')) return;
    var bg = document.createElement('div');
    bg.className = 'focus-bg';
    bg.id = 'focusBg';
    bg.innerHTML = '<div class="focus-card" id="focusCard"><div id="focusInner"></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === this) EE.closeFocus(); });
  }

  /* Take the overlay down when the reader leaves the board — the shell has
     navigation paths (the address bar, Back, a pasted link) the reference's
     full-window overlay could never be open during. */
  function closeFocusLayer() {
    window.focusSec = null;
    var bg = (typeof document !== 'undefined') && document.getElementById('focusBg');
    if (bg && bg.classList) bg.classList.remove('open');
  }
  function page(fn) {
    return function () { ready(); return fn.apply(null, arguments); };
  }

  /* Make the document this program's shape before anything reads it. See the
     Decision Lab's module.js for the full reasoning — the short version is
     that there are documents already in the database, written by the shared
     placeholder while this module was catalogued but not built, in which
     `decisions` is the Pipeline's id-keyed OBJECT rather than the array this
     program works in. And Store adopts a newer remote document at any moment
     (adoptDoc, js/app.js), so the check belongs on the path every render
     takes rather than on boot alone. */
  function normalize() {
    if (!window.data) return;
    if (!Array.isArray(data.decisions)) {
      var was = data.decisions;
      data.decisions = (was && typeof was === 'object')
        ? Object.keys(was).map(function (k) { return was[k]; })
        : [];
    }
    if (!data.drills || typeof data.drills !== 'object' || Array.isArray(data.drills)) data.drills = {};
    if (!data.assessment || typeof data.assessment !== 'object' || Array.isArray(data.assessment)) data.assessment = {};
    /* The full shape, not just the container. program.js only ever guards with
       `if(!data.assessment)`, so an assessment normalized to a bare {} passes
       that guard and then dies on `data.assessment.answers['q0']=` at the first
       answer clicked — which is every document this normalizer has ever touched,
       and every document emptyData() below created. Fill the two maps here,
       where every render path already passes. */
    if (!data.assessment.answers || typeof data.assessment.answers !== 'object') data.assessment.answers = {};
    if (!data.assessment.scores || typeof data.assessment.scores !== 'object') data.assessment.scores = {};
    if (data.assessment.completedAt === undefined) data.assessment.completedAt = null;
    if (!Array.isArray(data.assessmentHistory)) data.assessmentHistory = [];
  }

  /* The situation currently open, or null. `activeId` is the program's own
     global (program.js); the shell tracks the same thing as `currentStep`,
     which is what the URL carries. */
  function openSituation() {
    var list = (window.data && data.decisions) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === window.activeId) return list[i];
    return null;
  }
  function situationById(id) {
    var list = (window.data && data.decisions) || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function sectionLabel(id) {
    var secs = window.FLOW_SECTIONS || [];
    for (var i = 0; i < secs.length; i++) if (secs[i].id === id) return secs[i].label;
    return '';
  }

  /* ── Registration ─────────────────────────────────────────── */
  Modules.define('ethics-engine', {

    /* The workspace document. `decisions` holds the situations — the field
       kept the Decision Lab's name through the fork, and renaming it now would
       orphan every record already saved under it.

       `drills` is this program's own: the short scenarios, keyed by drill id,
       each with the verdict given and which lens broke the instinct.

       notes/assigns/roster/members are the shell's, not the program's: they
       are what the shared chrome reads when the API is unreachable. */
    emptyData: function () {
      return {
        decisions: [], drills: {}, assessment: { answers: {}, scores: {}, completedAt: null },
        assessmentHistory: [], profile: null,
        notes: [], assigns: {}, roster: null, members: []
      };
    },

    /* No phases — see the Decision Lab's module.js for why the Leaders
       programs declare none. */
    PH: [],
    MILESTONES: {},

    pages: {
      assess: page(function () { return EE.renderAssess(); }),
      lab: page(function () { return EE.renderLab(); }),
      detail: page(function () { return EE.renderDetail(); }),
      /* The two Drills surfaces: the cabinet they are filed in, and one drill
         opened out onto the board. */
      drills: page(function () { return EE.renderDrillsCabinet(); }),
      drill: page(function () { return EE.renderDrillBoard(); }),
      dashboard: page(function () { return EE.renderDash(); }),
      insights: page(function () { return EE.renderInsights(); })
    },

    /* This program builds its modals into the page rather than into
       #modalRoot; render() asks for them here (js/app.js). 'help' is left to
       the shell's shared overlay — see the Decision Lab's note. */
    renderModal: function () {
      if (!window.currentModal || currentModal === 'help') return '';
      ready();
      return EE.renderModal();
    },

    beforeNavigate: function (page, step) {
      ready();
      closeFocusLayer();
      if (step) window.activeId = step;
      window.currentTab = 'situation';
      window.currentModal = null;
      window.assessStep = 0;
      window.assessHistIdx = null;
    },

    /* Which header tab lights up. A situation opened out of Practice, and both
       Drills surfaces, all belong to that tab. */
    tabFor: function (page) {
      return (page === 'detail' || page === 'drill' || page === 'drills') ? 'lab' : page;
    },

    /* Notes are filed against the situation they were written on — this
       program has no steps (js/features/notes.js). */
    noteScope: function () {
      var d = (window.currentPage === 'detail') ? openSituation() : null;
      return d ? { key: d.id, label: d.title } : { key: '', label: '' };
    },
    noteScopeLabel: function (key) {
      var d = situationById(key);
      return d ? d.title : '';
    },

    /* ── The AI Guide ─────────────────────────────────────────
       The Examiner: a Socratic coach over the situation being worked. The
       chips follow how far the reader has got — "Help me name my stake" only
       while the stake is blank — and the prompt carries their answers, their
       assessed style, and the lens their look-backs say usually breaks their
       instinct (situationContext, program.js). Both are functions for that
       reason (js/modules/registry.js). */
    coachGreeting: 'Welcome to Conscience. Open a situation and I will press on it — your stake in it, the people it lands on, the rule you would be setting, and who the call makes you.',

    coachPresets: function () {
      ready();
      var d = openSituation();
      if (!d) {
        return [
          'What makes a situation an ethical one rather than just difficult?',
          'What are the four lenses?',
          'How do I tell a principle from a preference?',
          'Why does saying it out loud matter?'
        ];
      }
      /* buildPresets is the reference's own and returns {l, q}, where q is a
         key into its offline reply library. The label is already a question,
         and it is the question the reader is choosing to ask, so it is what
         gets sent — the shell's AI Guide has no offline library to look q up
         in (js/features/coach.js). */
      return EE.buildPresets(d).map(function (p) { return { label: p.l, text: p.l }; });
    },

    coachSystem: function () {
      ready();
      var role = 'You are The Examiner: a Socratic coach inside a reflection tool for ethical decisions.'
        + '\n\nYour role:'
        + '\n- Press on the thinking; never hand down a verdict'
        + '\n- Ask one sharp question at a time'
        + '\n- Name what is being avoided, plainly and without moralising'
        + '\n- Reference their own words back to them'
        + '\n- Keep responses to 2-3 short paragraphs'
        + '\n- The call is theirs. Your job is to make it an honest one.';
      var d = openSituation();
      if (!d) return role;
      return role + '\n\nHere is the situation they are working:\n' + EE.situationContext(d);
    },

    coachContext: function () {
      ready();
      var d = (window.currentPage === 'detail') ? openSituation() : null;
      if (d) {
        var sec = sectionLabel(window.currentTab);
        return d.title + (sec ? ' · ' + sec : '');
      }
      return {
        assess: 'Assessment', lab: 'Practice', drills: 'Drills', drill: 'Drill',
        dashboard: 'Dashboard', insights: 'Insights'
      }[window.currentPage] || 'Conscience';
    },

    /* This program's sample workspace — a set of worked situations with their
       verdicts and look-backs, a run of drills, and a scored self-assessment
       with earlier sittings to compare against. The reference build's own seed,
       ported with the rest (program.js). */
    seeds: [
      { id: 'sample', label: 'Seed sample data', run: function () { ready(); return EE.seedSampleData(); } }
    ]
  });
})();
