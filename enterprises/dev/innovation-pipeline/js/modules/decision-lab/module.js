/* ─────────────────────────────────────────────────────────────
   decision-lab/module.js — The Decision Lab module
   ─────────────────────────────────────────────────────────────
   Ported from leaders/dev/judgment-critical-thinking, which was a whole second
   copy of the application. Everything that copy duplicated — the
   store, sign-in, organizations, the header and its theme / zoom /
   Notes / AI Guide / voice actions, the modal plumbing, printing —
   is the shell's here, and this file carries only what makes the
   program itself: the shape of its workspace and the seams its
   screens need.

   The screens themselves are NOT here. They are in program.js,
   generated from the reference build by tools/port-leader-module.js
   — the Practice board, the decision detail, the Assess battery, the
   Dashboard and the Insights shelf, lifted function for function.
   This file is the registration and the handful of seams the
   generated code cannot supply for itself.

   WHY THIS PROGRAM LOOKS DIFFERENT FROM THE ENTERPRISE ONES. The
   four Enterprise programs are a 90-day spine: five phases, numbered
   steps, a left sidebar, one shared organizational workspace. This
   one is a leader's own practice. There are no phases and no steps —
   there is a list of DECISIONS, and each is worked through eight
   sections on a board. So it declares no PH, registers pages of its
   own (Assess / Practice / Dashboard) instead of the shell's
   pipeline/step/phase, and the shell's sidebar stays hidden
   throughout (js/features/sidebar.js).

   Everything is inside this IIFE. Two programs' code is never on the
   page at once (see js/modules/boot.js), but keeping the module's
   internals private means a shell global and a module helper can
   never quietly shadow each other. Anything an inline onclick in
   this module's markup needs is hung off the single global `DL`.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  /* The single global this module owns, for inline handlers in its markup.
     program.js creates it and hangs every ported function off it; nothing is
     added here. Named so the seams below can reach them without depending on
     which of the two files the browser happened to reach first. */
  var DL = window.DL = window.DL || {};

  /* program.js assigns the program's variables on first use rather than at
     load — boot.js loads a module's code in the <head>, before app.js, so
     `Store`, `UI` and `data` do not exist yet at that point. Every seam below
     goes through here first, because a seam can be the first thing this module
     is asked for (beforeNavigate runs before the first render). */
  function ready() { if (DL.initVars) DL.initVars(); ensureFocusLayer(); normalize(); }

  /* The focus layer — the card that flips open when you press OPEN → on the
     board, and the thing you actually write in.

     It is not part of any page's markup. renderFocus() writes into #focusInner
     and flipOpen() animates #focusCard from the board card's own rectangle, so
     the three elements have to already exist, OUTSIDE #app — the shell replaces
     #app's contents on every render, and an overlay living inside it would be
     destroyed mid-animation.

     The reference build declared them in its index.html. shell.html does not,
     because they are this program's furniture rather than the suite's, and
     nine other modules would be carrying an empty overlay for no reason. So
     the module puts up its own, once. Without it flipOpen() reaches for
     `null.classList` and every OPEN → on the board is dead: the click throws
     before anything can render, with no visible effect at all.

     The backdrop click comes with it. In the reference that is a top-level
     IIFE (DL-app.js, just after closeFocus) — boot code, not a function, so
     the port cannot lift it. */
  function ensureFocusLayer() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('focusBg')) return;
    var bg = document.createElement('div');
    bg.className = 'focus-bg';
    bg.id = 'focusBg';
    bg.innerHTML = '<div class="focus-card" id="focusCard"><div id="focusInner"></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === this) DL.closeFocus(); });
  }

  /* Take the overlay down when the reader leaves the board. The reference
     never had to: its focus card covers the whole window, including the tabs,
     so there was no way to navigate while one was open. Here there is — the
     address bar, the browser's Back button, a pasted link — and an overlay
     that survived any of those would sit on top of the next screen with no
     way to close it. */
  function closeFocusLayer() {
    window.focusSec = null;
    var bg = (typeof document !== 'undefined') && document.getElementById('focusBg');
    if (bg && bg.classList) bg.classList.remove('open');
  }

  function page(fn) {
    return function () { ready(); return fn.apply(null, arguments); };
  }

  /* Make the document this program's shape before anything reads it.

     This is not defensive tidying — there are real documents in the database
     that need it. While this module was catalogued but not built, every
     Leader account that opened it got the shared placeholder, and the
     placeholder saves the PIPELINE's empty document under module
     'decision-lab': `decisions` an id-keyed OBJECT, not the array this program
     works in. The first thing such an account would do here is press "New
     Decision", and data.decisions.unshift is not a function.

     A remote document can also arrive at any moment — Store polls every five
     seconds and adopts a newer one (adoptDoc, js/app.js) — so the check
     belongs on the path every render and every seam already takes, not on
     boot alone. It is a few type tests; running it per page costs nothing.

     Records are carried across rather than dropped: an object of them becomes
     an array of the same records. Nothing in the placeholder's document has
     any, but discarding work to fix a shape is never the right trade. */
  function normalize() {
    if (!window.data) return;
    if (!Array.isArray(data.decisions)) {
      var was = data.decisions;
      data.decisions = (was && typeof was === 'object')
        ? Object.keys(was).map(function (k) { return was[k]; })
        : [];
    }
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

  /* The decision currently open, or null. `activeId` is the program's own
     global (program.js); the shell tracks the same thing as `currentStep`,
     which is what the URL carries. */
  function openDecision() {
    var list = (window.data && data.decisions) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === window.activeId) return list[i];
    return null;
  }
  function decisionById(id) {
    var list = (window.data && data.decisions) || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  /* The eight sections of the flow, by id — for labelling the AI Guide's
     context line. FLOW_SECTIONS is program.js's. */
  function sectionLabel(id) {
    var secs = window.FLOW_SECTIONS || [];
    for (var i = 0; i < secs.length; i++) if (secs[i].id === id) return secs[i].label;
    return '';
  }

  /* ── Registration ─────────────────────────────────────────── */
  Modules.define('decision-lab', {

    /* The workspace document — this program's own shape. Stored per
       organization per module, so a Leader account's Decision Lab sits
       alongside anything else that account runs, under the same sign-in
       (api/sql/workspace-modules.sql).

       `decisions` is an ARRAY of records keyed by .id, not an id-keyed object
       like the Enterprise programs' collections. Store.commit('decisions', id)
       handles both — see mergeDirtyInto in js/app.js, which had to learn the
       array shape before this program could survive a concurrent save.

       notes/assigns/roster/members are the shell's, not the program's: they
       are what the shared chrome reads when the API is unreachable. */
    emptyData: function () {
      return {
        decisions: [], assessment: { answers: {}, scores: {}, completedAt: null },
        assessmentHistory: [], profile: null,
        notes: [], assigns: {}, roster: null, members: []
      };
    },

    /* No phases. This program is not a 90-day plan, and every shell surface
       that walks PH — the sidebar, the phase landings, Track Program — is
       hidden or withheld for it rather than shown empty. */
    PH: [],
    MILESTONES: {},

    /* Pages this module owns, every one of them the reference build's own
       renderer (program.js). Home and Learn are not here: they are the shell's
       screens, and this module simply ships its own markup for them
       (templates/modules/decision-lab/). */
    pages: {
      assess: page(function () { return DL.renderAssess(); }),
      lab: page(function () { return DL.renderLab(); }),
      detail: page(function () { return DL.renderDetail(); }),
      dashboard: page(function () { return DL.renderDash(); }),
      insights: page(function () { return DL.renderInsights(); })
    },

    /* This program builds its modals into the page rather than into
       #modalRoot, the way its reference build did; render() asks for them
       here (js/app.js).

       'help' is the exception and is deliberately left to the shell. The ?
       Help button opens the shared overlay, which renders this module's
       document (help.js) together with the blocks that describe features every
       program has. Answering here as well would paint two overlays at once. */
    renderModal: function () {
      if (!window.currentModal || currentModal === 'help') return '';
      ready();
      return DL.renderModal();
    },

    /* Every navigation resets the program's view state, exactly as the
       reference's own go() did: a decision opens on its first section, with no
       modal, and the Assess battery starts from its first question rather than
       wherever the last visit left it.

       The shell's go() owns currentPage/currentStep and the back stack; this
       is the rest of what the reference's go() did. `step` is the decision id
       on the detail page, which is also what the URL carries, so a refresh or
       a pasted link lands on the right decision. */
    beforeNavigate: function (page, step) {
      ready();
      closeFocusLayer();
      if (step) window.activeId = step;
      window.currentTab = 'problem';
      window.currentModal = null;
      window.assessStep = 0;
      window.assessHistIdx = null;
    },

    /* Which header tab lights up. The detail page is a decision opened out of
       Practice, so it belongs to that tab. */
    tabFor: function (page) {
      return page === 'detail' ? 'lab' : page;
    },

    /* Notes are filed against the decision they were written on, not against a
       step — this program has no steps. The key is the decision id and the
       label is its title, so the panel reads "Accept the VP offer · Mar 3"
       rather than "Step dq8f31k2 · Mar 3" (js/features/notes.js). */
    noteScope: function () {
      var d = (window.currentPage === 'detail') ? openDecision() : null;
      return d ? { key: d.id, label: d.title } : { key: '', label: '' };
    },
    noteScopeLabel: function (key) {
      var d = decisionById(key);
      return d ? d.title : '';
    },

    /* ── The AI Guide ─────────────────────────────────────────
       Its own coach, because it is coaching one decision rather than
       explaining a framework: the chips change with how far the reader has got
       and the prompt carries what they have actually written. Both are
       functions for that reason (js/modules/registry.js). Away from a decision
       the shell's defaults would be the Pipeline's, so this answers there too
       — with the questions this program can usefully take. */
    coachGreeting: 'Welcome to the Judgment — Critical Thinking app. Open a decision and I can pressure-test your case, hunt for the bias you have not named, and tell you honestly whether you are ready to call it.',

    coachPresets: function () {
      ready();
      var d = openDecision();
      if (!d) {
        return [
          'How should I choose which decision to work on?',
          'What makes a decision worth this much analysis?',
          'What is a pre-mortem?',
          'How do I know if I am rationalising?'
        ];
      }
      /* buildPresets is the reference's own, and returns {l, q}: a short chip
         and the paragraph it actually sends. */
      return DL.buildPresets(d).map(function (p) { return { label: p.l, text: p.q }; });
    },

    coachSystem: function () {
      ready();
      var d = openDecision();
      var role = 'You are a Decision Coach inside the Judgment — Critical Thinking app, a decision-training tool.'
        + '\n\nYour role:'
        + '\n- Help them think more clearly, not think for them'
        + '\n- Ask sharp questions that expose blind spots'
        + '\n- Challenge assumptions with warmth but directness'
        + '\n- Reference their specific answers'
        + '\n- Keep responses to 2-3 short paragraphs'
        + '\n- Be honest. If they are avoiding something, name it.'
        + '\n- Never make the decision for them. Build their judgment muscle.'
        + '\n- Write in a direct, warm, slightly provocative tone';
      if (!d) return role;
      return 'You are a Decision Coach inside the Judgment — Critical Thinking app, a decision-training tool. '
        + 'You have access to the user’s full decision analysis.\n\nHere is their current state:\n'
        + DL.buildCoachContext(d) + '\n' + role.slice(role.indexOf('\n\nYour role:'));
    },

    coachContext: function () {
      ready();
      var d = (window.currentPage === 'detail') ? openDecision() : null;
      if (d) {
        var sec = sectionLabel(window.currentTab);
        return d.title + (sec ? ' · ' + sec : '');
      }
      return { assess: 'Assessment', lab: 'Practice', dashboard: 'Dashboard', insights: 'Insights' }[window.currentPage]
        || 'Judgment';
    },

    /* This program's sample workspace — a leader mid-career with six decisions
       in play, three of them resolved and debriefed, a scored self-assessment
       and two earlier sittings to compare it against. The reference build's own
       seed, ported with the rest (program.js). One, not two: the Pipeline's
       second seed is a Year 2 portfolio and this program has no portfolio and
       no year two. */
    seeds: [
      { id: 'sample', label: 'Seed sample data', run: function () { ready(); return DL.seedSampleData(); } }
    ],

    /* Two exports only this program has: the working document written out as
       markdown, shaped for pasting into a chat. State 1 is the open decisions
       with their unanswered challenges; state 2 is the decision profile and the
       patterns behind it. They sit under the header's More menu beside the
       shell's own Export state, which writes the workspace as JSON for import
       back into the app (js/nav.js). */
    moreItems: [
      { id: 'ai-state-1', icon: '1', label: 'Export AI State 1', run: function () { ready(); DL.exportAIState1(); } },
      { id: 'ai-state-2', icon: '2', label: 'Export AI State 2', run: function () { ready(); DL.exportAIState2(); } }
    ]
  });
})();
