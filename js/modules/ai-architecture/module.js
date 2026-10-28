/* ─────────────────────────────────────────────────────────────
   ai-architecture/module.js — the AI-Ready Architecture module
   ─────────────────────────────────────────────────────────────
   Ported from enterprises/dev/architecture-prototype (21 Oct 2026),
   which was a whole second copy of the app. Everything that copy
   duplicated — the store, sign-in, organizations, the admin console,
   the header and its actions, the sidebar chrome, assignments, the
   email queue — is the shell's here, and this file carries only what
   makes the program itself: its phases, the shape of its workspace,
   and the seams its pages need.

   The pages themselves are NOT here. They are in program.js, generated
   from the reference build by tools/port-ai-architecture.js. So are the
   phase spine, the milestone lines and the empty document, which that
   tool hands over on ARC (ARC.PH, ARC.MILESTONES, ARC.emptyData) rather
   than this file retyping them — see the "Handed to module.js" note there.

   Unlike Governance, this program saves every field AS IT IS TYPED: its
   ta()/sel() builders carry onchange/oninput into its own fldSave(), the
   way the Pipeline's do. So it needs no harvest-on-navigate hook.

   Everything is inside this IIFE; anything an inline onclick in this
   module's markup needs hangs off the single global `ARC`.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var ARC = window.ARC = window.ARC || {};
  if (!ARC.PH) return;   /* program.js failed to load: register nothing rather than a broken program */

  /* The reference's milestone banner text per phase. Its own pages read
     PHASE_COMPLETE_MSG inside program.js; the shell's surfaces (My
     Assignments, the completion email) ask for PHASE_WRAPUPS. Same words. */
  var PHASE_WRAPUPS = ARC.PHASE_COMPLETE_MSG;

  /* ── Seams the generated pages need ─────────────────────────── */

  /* 1. Transient view state. The reference's own UI literal (Architecture-
     app.js, `var UI=`), minus the keys the shell already declares. Never
     overwrites a value the shell has restored. */
  var UI_DEFAULTS = { sec: 'A', addForm: false, editIdx: null, assignOpen: null };
  function seedUiState() {
    if (!window.UI) return;
    for (var k in UI_DEFAULTS) {
      if (UI_DEFAULTS.hasOwnProperty(k) && UI[k] === undefined) UI[k] = UI_DEFAULTS[k];
    }
    /* UI.sec is a SHARED key with a different shape here. The shell starts it at the Pipeline's '1.1';
       this program's step 1.1 reads it as its tab ('A' | 'BC' | 'TECH', or a legacy section letter), so
       '1.1' matched no tab and the tab strip showed none selected over section A's content. Only step
       1.1 reads it in this program, so anything else is put back to the first tab. */
    if (!/^(A|BC|TECH|[A-H])$/.test(String(UI.sec || ''))) UI.sec = 'A';
  }

  /* 2. The document's SHAPE, filled from emptyData() on every render path.
     Workspaces filed under 'ai-architecture' already exist for every account
     that opened the program while it was a catalogued placeholder: they carry
     the roster and the profile and none of this program's containers. Filled,
     never overwritten, nothing removed — same rule as Governance's normalize(). */
  function normalize() {
    if (!window.data) return;
    var shape = Modules.emptyData();
    for (var k in shape) {
      if (!shape.hasOwnProperty(k)) continue;
      var want = shape[k], have = data[k];
      if (Array.isArray(want)) { if (!Array.isArray(have)) data[k] = []; continue; }
      if (want && typeof want === 'object') {
        if (!have || typeof have !== 'object' || Array.isArray(have)) data[k] = {};
        continue;
      }
      if (have === undefined) data[k] = want;
    }
  }

  /* 3. What the reference's render() did before every page, that is this
     program's and not the shell's (Architecture-app.js, render()):
       · an unnamed new dependency left behind when its editor closed is dropped
         (16 Oct 2026, Paul, UAT Round 3);
       · blank inline drafts are swept (Sweep 4R item 19);
       · a closed Data Governance Review resolves (Paul, option 2). */
  function preRender() {
    try {
      if (window.data && Array.isArray(data.aiDependencies) && data.aiDependencies.some(function (d) { return d && d._new; })) {
        data.aiDependencies = data.aiDependencies.filter(function (d) {
          return !(d && d._new && !String(d.name || '').trim() && UI.sovDepEdit !== d.id);
        });
      }
    } catch (e) { }
    try { ARC.sweepBlankInline(false); } catch (e) { }
    try { ARC.dgdResolveClosed(false); } catch (e) { }
  }

  /* 4. Two load-time statements the port could not carry (see CARRY in the
     port script), each needing the shell's Store, done once on first render:
       · the Store.commit hook — the reference refused a commit while p5Read()
         had swapped in a read-only clone, and repainted the completion gates
         after every commit;
       · p5InstallPrintUnits() — registers the Phase 5 pages as printable
         units in PRINT_DOCS and in the Report Manager's page list. */
  var _installed = false;
  function installOnce() {
    if (_installed || !window.Store) return;
    _installed = true;
    if (Store.commit && !Store.__arcHooked) {
      var _commit = Store.commit;
      Store.commit = function () {
        /* Only while this program is the one on the page — and it always is:
           switching program is a full page load (js/modules/boot.js). */
        if (ARC.readOnlyDepth() > 0) return;
        var r = _commit.apply(Store, arguments);
        try { ARC.scheduleGateRefresh(); } catch (e) { }
        return r;
      };
      Store.__arcHooked = true;
    }
    try { ARC.p5InstallPrintUnits(); } catch (e) { }
  }

  function ready() { seedUiState(); normalize(); installOnce(); preRender(); }

  /* Every page also carries the fullscreen Review Board overlay, as the
     reference's render() appended it to every inline page. */
  function page(fn) {
    return function () {
      ready();
      var h = fn.apply(null, arguments);
      try { h += ARC.rbOverlay(); } catch (e) { }
      return h;
    };
  }

  /* The phase a landing was asked for. The shell keeps currentPhase as the PH
     record; the reference's renderPhaseHome() sets it to the bare NUMBER (its
     own go() did the same), so after one landing render it may be either. */
  function currentPhaseId() {
    var p = window.currentPhase;
    if (typeof p === 'number') return p;
    if (p && p.id) return p.id;
    return parseInt(window.currentStep, 10) || 1;
  }
  /* …and it is put back as the record afterwards, because everything else —
     the shell's sidebar and coach context, and this program's own renderStep —
     reads currentPhase.id / .name. Left a number, the next re-render of the
     same landing answered "Phase not found". */
  function phaseLanding() {
    var id = currentPhaseId();
    /* An address that names phase 5 (/phase/5, a bookmark or an old link) shows what the build shows for
       phase 5: the Manage page. Nothing in the build reaches a phase-5 landing. */
    if (String(id) === '5') {
      /* …and becomes that page, so the address, the tab and Back all say Manage. UI._back keeps go() from
         stacking this landing as a page to come back to (it would only bounce here again). */
      setTimeout(function () { if (window.currentPage === 'phase') { UI._back = true; go('manage'); } }, 0);
      return ARC.renderManage();
    }
    var h = ARC.renderPhaseHome(id);
    var rec = (ARC.PH || []).filter(function (x) { return x.id === id; })[0];
    if (rec) window.currentPhase = rec;
    return h;
  }

  var SIDEBAR_ON = ['step', 'reports', 'mgmt-hub', 'pipeline', 'phase5', 'manage', 'outcome', 'phase', 'archmap',
    'archreview', 'archscores', 'stdData', 'dgreview', 'stdCompute', 'stdModel', 'stdInteg', 'stdApp'];

  /* The name the Notes panel and the AI Guide give a page (19 Oct 2026, Paul, KB fix A4): the
     reference's own notesWhereFor() and its name table, handed over by program.js. Its Framework
     tab is 'readiness' there and 'pipeline' here; its phase landing came across as 'phase'. A page
     the table does not know (the shell's own: Profile, My Assignments…) answers null, and the
     shell's default stands. */
  function placeName(page, arg) {
    var t = '';
    try { t = ARC.notesWhereFor(page === 'pipeline' ? 'readiness' : page, arg || ''); } catch (e) { }
    return (t && (t !== 'Home' || page === 'home')) ? t : null;
  }
  function pageArg(page) {
    if (page === 'phase') return String(currentPhaseId());
    return window.currentStep || '';
  }
  /* A note is filed under `notes.step` (VARCHAR 20). On a step page that stays the step id, as every
     note written before this was; any other page is '@' + its id, an output '@o:' + the output's id
     and a phase landing '@p:' + the phase — the longest, '@o:out-govframework', is 19. */
  function noteKeyOf(page, arg) {
    if (page === 'step') return arg;
    if (page === 'outcome') return arg ? '@o:' + arg : '@outcome';
    if (page === 'phase') return '@p:' + arg;
    return '@' + page;
  }

  /* ── Registration ─────────────────────────────────────────── */
  Modules.define('ai-architecture', {

    /* The reference's own emptyData() (handed over by program.js), plus the
       org-level keys every program's document carries and a start date, which
       the phase landings and the deadline sweep measure from. Stored per
       organization PER MODULE (api/sql/workspace-modules.sql). */
    emptyData: function () {
      var d = ARC.emptyData();
      if (!d.startDate) d.startDate = new Date().toISOString().split('T')[0];
      if (!('roster' in d)) d.roster = null;
      if (!d.members) d.members = [];
      if (!d.enterprise) d.enterprise = {};
      if (!('orgSetup' in d)) d.orgSetup = false;
      if (!d.notes) d.notes = [];
      if (!d.assigns) d.assigns = {};
      if (!d.stepDue) d.stepDue = {};
      if (!d.completedSteps) d.completedSteps = {};
      if (!d.reportDefs) d.reportDefs = [];
      if (!d.settings) d.settings = { aiGuide: false, voice: false };
      return d;
    },

    PH: ARC.PH,
    MILESTONES: ARC.MILESTONES,
    PHASE_WRAPUPS: PHASE_WRAPUPS,

    isStepDone: function (sid) { return !!ARC.isStepDone(sid); },

    /* Which steps can be assigned: the reference's own list (phase 5 is the
       standing state, not work with an owner and a deadline). */
    /* The shell's contract is [{id, name, ph:{id, name}}] (js/features/my-assignments.js); this program's own
       mgSteps() names the phase `phase`, so My Assignments read s.ph.id off undefined and threw the moment a
       member had an assignment — the list never opened (22 Oct 2026). Handed over as a copy carrying both. */
    assignSteps: function () {
      return (ARC.mgSteps() || []).map(function (s) {
        return { id: s.id, name: s.name, icon: s.icon, ph: s.ph || s.phase, phase: s.phase || s.ph };
      });
    },

    /* The reference's go() dropped one piece of view state on every move:
       step 1.3's audit mirror ("CL9: the 1.3 mirror flag never survives
       navigation"). Fields save as typed, so there is nothing to harvest. */
    beforeNavigate: function () {
      if (window.UI) UI.auditMap = null;
    },

    /* Part S: the shell rebuilds UI on a session change; this resets the one
       piece of the program's own view state that lives in program.js. */
    sealSession: function () { try { ARC.setInsightsTab('latest'); } catch (e) { } },

    /* The lock layer's field → record map is this program's (the shell's is
       the Pipeline's, where the same prefixes name other records). */
    idToRecordKey: function (id) { return ARC.idToRecordKey(id); },

    /* ── The AI Guide ───────────────────────────────────────────
       21 Oct 2026: the Pipeline's stage-1 Guide — POST /guide, answered by
       the Pinecone assistant `architecture` (GuideController::ASSISTANTS). The
       greeting takes the same shape as the other programs'; the presets and the
       system prompt below are the reference build's record and are no longer
       used by the panel (js/features/coach.js). */
    coachGreeting: 'Welcome to 90 Days to an AI-Ready Architecture. I\'m your AI Guide. Ask me how to complete the step you\'re on, what to do next, or for ideas drawn from Faisal Hoque\'s writing on enterprise architecture for AI.',
    coachPresets: ['Where do I start?', 'Help with this step', 'What is zero-trust identity?', 'Explain the five layers', 'Shadow AI remediation?'],
    coachSystem: 'You are the AI Guide inside the 90 Days to an AI-Ready Architecture program (NextChapter 90-Day Jump-Start Program by Faisal Hoque). The 90-day program has five phases: Map (assess data estate, integrations, identity, compute, risk), Build (data governance, API modernization, zero-trust identity, model governance), Test (end-to-end deployment, security stress tests, cascade scenarios, alignment review), Embed (architecture review board, skills inventory, first review), Manage (ongoing dashboard discipline). It also teaches the five-layer AI tech stack: 1 Data & Storage, 2 Compute & Acceleration, 3 Model & Algorithm, 4 Orchestration & Tooling, 5 Application & Governance. Answer in 2-4 short sentences. Tone: smart, direct, practical. Plain text only — no markdown.',
    coachContext: function () {
      var step = window.currentStep, ph = window.currentPhase;
      if (window.currentPage === 'step' && step) {
        var name = '';
        try { name = ARC.stepNameOf(step) || ''; } catch (e) { }
        return 'Step ' + step + (name ? ' ' + name : '') + (ph ? ' (' + ph.name + ')' : '');
      }
      var page = window.currentPage || 'home';
      return placeName(page, pageArg(page)) || ('the ' + page + ' page');
    },

    /* Notes are filed against the page they were written on, by the name that page shows (KB fix A4).
       The label is worked out from the key every time the panel draws, so notes written before the
       fix read the corrected name too. */
    noteScope: function () {
      var page = window.currentPage || 'home', arg = pageArg(page);
      if (page === 'step' && !arg) return null;
      var label = placeName(page, arg);
      return label ? { key: noteKeyOf(page, arg), label: label } : null;
    },
    noteScopeLabel: function (key) {
      key = String(key || '');
      if (key.charAt(0) !== '@') return placeName('step', key);
      if (key.indexOf('@o:') === 0) return placeName('outcome', key.slice(3));
      if (key.indexOf('@p:') === 0) return placeName('phase', key.slice(3));
      return placeName(key.slice(1), '');
    },

    /* The reference's three seeds. Its More menu offered all three while it is
       tested (SEED_MENU_FOR_TESTING, "set to false before clients use it"); the
       shell's More menu lists whatever a program declares here. Each builds
       THIS program's document and keeps the organization's own roster. */
    /* The Demo tab's sample (js/app.js prepareSampleData): the reference's own sampleStart() seeds the
       FULL sample (sandboxQuietSeed('full')), whose cast gives the tab someone to be signed in as. */
    sampleSeed: function () {
      ready();
      var r = ARC.seedData('full');
      /* The demo visitor is the cast's first person (Harriet Rivers), and none of the cast is an
         administrator — harmless in the build, which had no edit rule, but under the shell's (assignee
         or administrator edits a step, js/features/assignments.js) it left most steps read-only in the
         demo. The sample tab never leaves this browser, so its visitor is made the administrator. */
      try { var first = (data.roster || [])[0]; if (first) first.admin = true; } catch (e) { }
      return r;
    },

    seeds: [
      { id: 'sample', label: 'Seed sample data', run: function () { ready(); return ARC.seedData(); } },
      { id: 'full', label: 'Seed full sample data', run: function () { ready(); return ARC.seedData('full'); } },
      { id: 'sovereignty', label: 'Seed the data sovereignty sample', run: function () { ready(); return ARC.seedData('sovereignty'); } }
    ],

    /* Pages this module owns, each the reference's own renderer. Home and
       Learn are the shell's screens with this module's markup
       (templates/modules/ai-architecture/). The reference's 'readiness' and
       'phaseHome' ids are 'pipeline' and 'phase' here (rewritten at port
       time); every other id is the reference's own and needs no routing
       change — go() leaves an unknown id alone and render() asks us first. */
    pages: {
      pipeline: page(function () { return ARC.renderOverview(); }),
      phase: page(phaseLanding),
      step: page(function () { return ARC.renderStep(); }),
      outcome: page(function () { return ARC.renderOutcomePage(); }),
      /* The Dashboard tab IS step 5.1; go() maps 5.1 here (js/app.js). */
      phase5: page(function () { return ARC.renderDashboard(); }),
      insights: page(function () { return ARC.renderInsights(); }),
      manage: page(function () { return ARC.renderManage(); }),
      'mgmt-hub': page(function () { return ARC.renderMgmtHub(); }),
      reports: page(function () { return ARC.renderReports(); }),
      archreview: page(function () { return ARC.renderArchReviewPage(); }),
      archmap: page(function () { return ARC.renderArchMapPorthole(); }),
      archscores: page(function () { return ARC.renderArchScoresPage(); }),
      stdData: page(function () { return ARC.renderDataStandardsPage(); }),
      dgreview: page(function () { return ARC.renderDgReviewPage(); }),
      stdCompute: page(function () { return ARC.renderComputePage(); }),
      stdModel: page(function () { return ARC.renderModelRulesPage(); }),
      stdInteg: page(function () { return ARC.renderIntegrationStandardsPage(); }),
      stdApp: page(function () { return ARC.renderAppGovernancePage(); }),
      jurmap: page(function () { return ARC.renderJurMap(); })
    },

    /* Which pages keep the sidebar — the reference's renderSidebar() list verbatim (5 Sep 2026, Paul's
       browser pass: "the porthole and the standing review keep the sidebar"), with its 'readiness' and
       'phaseHome' under the shell's names. Insights and the jurisdiction map do not. Asked by the shell's
       sidebarShowsHere() (js/features/sidebar.js) before its own list. */
    sidebarShowsOn: function (page) { return SIDEBAR_ON.indexOf(page) >= 0; },

    /* Phase 5 is the standing state, and the build's sidebar sends its heading to the Manage page
       (`go(ph.id===5?'manage':'phase-'+ph.id)`), never to a phase-5 landing; that page counts as
       phase 5 for the highlight (`id===5&&(currentPage==='phase5'||currentPage==='manage')`). */
    phaseHeadTarget: function (id) { return String(id) === '5' ? ['manage'] : null; },
    navPhaseOf: function (page) { return page === 'manage' ? 5 : null; },

    /* The reference's More menu carried the Report Manager; here the shell
       owns that menu and asks each program what to add. */
    moreItems: [
      { id: 'reports', icon: '☷', label: 'Report Manager', run: function () { go('reports'); } }
    ]
  });
})();
