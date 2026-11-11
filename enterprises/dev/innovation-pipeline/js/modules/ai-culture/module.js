/* ─────────────────────────────────────────────────────────────
   ai-culture/module.js — the AI-Ready Culture module
   ─────────────────────────────────────────────────────────────
   Ported from enterprises/dev/culture-prototype (6 Nov 2026), which
   was a whole second copy of the app. Everything that copy duplicated
   — the store, sign-in, organizations, the admin console, the header
   and its actions, the sidebar chrome, assignments, the email queue —
   is the shell's here, and this file carries only what makes the
   program itself: its phases, the shape of its workspace, and the
   seams its pages need.

   The pages themselves are NOT here. They are in program.js, generated
   from the reference build by tools/port-ai-culture.js. So are the
   phase spine, the milestone lines, the phase wrap-ups and the empty
   document, which that tool hands over on CUL (CUL.PH, CUL.MILESTONES,
   CUL.PHASE_WRAPUPS, CUL.emptyData) rather than this file retyping them.

   Like Architecture, this program saves every field AS IT IS TYPED
   through its own fldSave(), so it needs no harvest-on-navigate hook.

   Everything is inside this IIFE; anything an inline onclick in this
   module's markup needs hangs off the single global `CUL`.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var CUL = window.CUL = window.CUL || {};
  if (!CUL.PH) return;   /* program.js failed to load: register nothing rather than a broken program */

  /* ── Seams the generated pages need ─────────────────────────── */

  /* 1. Transient view state. The reference's own UI literal (Culture-app.js,
     `var UI=`), minus the keys the shell already declares. Never overwrites a
     value the shell has restored. */
  var UI_DEFAULTS = {
    ctxOpen: {}, showEx: {}, expanded: {}, editSys: null, editRisk: null, showSysForm: false,
    showRiskForm: false, activeRisk: null, activeView: null, triageActive: null, culAddUse: null,
    pulseRoundId: null, qGroup: 'leaders', qScope: 'full', qNote: '',
    s11Tab: '1.1a', s12Tab: '1.2a', s13Tab: '1.3a', s14Tab: '1.4a', s21Tab: '2.1a', s22Tab: '2.2a',
    s23Tab: '2.3a', s24Tab: '2.4a', s25Tab: '2.5a', s31Tab: '3.1a', s33Tab: '3.3a', s34Tab: '3.4a',
    s41Tab: '4.1a', s42Tab: '4.2a', s43Tab: '4.3a',
    rvId: '', rvType: '', rvNote: '', rvPick: '', urPick: '', bcNameErr: '', bcLedErr: '', chNote: '',
    tkPriOnly: false, dbTeam: '', tvTeam: '', mapKind: null, mapPanel: null, mapMenu: null,
    mapBoard: null, mapCol: 'in', mapOpenKinds: {}, mapNew: null, mapToast: null, mtSel: null,
    assignOpen: null
  };
  function seedUiState() {
    if (!window.UI) return;
    for (var k in UI_DEFAULTS) {
      if (!UI_DEFAULTS.hasOwnProperty(k) || UI[k] !== undefined) continue;
      var v = UI_DEFAULTS[k];
      UI[k] = (v && typeof v === 'object') ? {} : v;
    }
  }

  /* 2. The document's SHAPE, filled from emptyData() on every render path.
     Workspaces filed under 'ai-culture' already exist for every account that
     opened the program while it was a catalogued placeholder: they carry the
     roster and the profile and none of this program's containers. Filled,
     never overwritten, nothing removed — the rule Governance and Architecture
     use. */
  function normalize() {
    if (!window.data) return;
    var shape = Modules.emptyData();
    for (var k in shape) {
      if (!shape.hasOwnProperty(k)) continue;
      var want = shape[k], have = data[k];
      if (Array.isArray(want)) { if (!Array.isArray(have)) data[k] = []; continue; }
      if (want && typeof want === 'object') {
        if (!have || typeof have !== 'object' || Array.isArray(have)) data[k] = JSON.parse(JSON.stringify(want));
        continue;
      }
      if (have === undefined) data[k] = want;
    }
  }

  /* 3. What the reference's render() did before every page that is this
     program's and not the shell's (Culture-app.js, render()):
       · a reset adopted from another tab discards this tab's typed drafts
         (Sweep 3 item 1) — the reference kept the last stamp it saw;
       · blank inline drafts are swept (Sweep 4R item 19, §26.3). */
  var _lastReset = null, _lastResetOrg = null;
  function preRender() {
    try {
      if (window.data && data.resetAt && data.resetAt !== _lastReset) {
        if (_lastReset !== null && _lastResetOrg === window.currentOrgId) CUL.discardTypedDrafts();
        _lastReset = data.resetAt;
      }
      _lastResetOrg = window.currentOrgId;
    } catch (e) { }
    try { CUL.sweepBlankInline(false); } catch (e) { }
  }

  function ready() { seedUiState(); normalize(); preRender(); }

  /* Every inline page also carries the program's short notices, as the
     reference's render() appended them (the map toast, the lost-draft note). */
  function page(fn) {
    return function () {
      ready();
      var h = fn.apply(null, arguments) || '';
      try { if (h.indexOf('id="cmapToast"') < 0) h += CUL.culMapToastHtml(); } catch (e) { }
      try { if (UI.lostDraft && h.indexOf('id="culLostDraft"') < 0) h += CUL.culLostDraftHtml(); } catch (e) { }
      return h;
    };
  }

  /* A page the reference has retired (CUL_RETIRED_ROUTES): a stored note,
     bookmark or old link that names one goes where its work lives now. The
     reference's go() redirected before rendering; the shell's go() has already
     arrived, so the page forwards once, without stacking itself for Back. */
  function retired(id) {
    return function () {
      var to = (CUL.RETIRED_ROUTES || {})[id] || ['phase5'];
      setTimeout(function () { if (window.currentPage === id) { UI._back = true; go(to[0], to[1]); } }, 0);
      return '';
    };
  }

  /* The phase a landing was asked for: the shell keeps currentPhase as the PH
     record; a bookmark may arrive with only currentStep set. */
  function currentPhaseId() {
    var p = window.currentPhase;
    if (typeof p === 'number') return p;
    if (p && p.id) return p.id;
    return parseInt(window.currentStep, 10) || 1;
  }
  function phaseLanding() {
    var id = currentPhaseId();
    /* Phase 5 (Regenerate) is the standing state; its heading opens the
       Culture Dashboard, as step 5.1 does everywhere in the build. */
    if (String(id) === '5') {
      setTimeout(function () { if (window.currentPage === 'phase') { UI._back = true; go('phase5'); } }, 0);
      return CUL.renderPhase5();
    }
    var h = CUL.renderPhaseHome(id);
    var rec = (CUL.PH || []).filter(function (x) { return x.id === id; })[0];
    if (rec) window.currentPhase = rec;
    return h;
  }

  /* The reference's sidebarPageShown(), verbatim in substance: these pages
     keep the rail, as does every Phase 5 page in CUL_P5_PAGES. */
  var SIDEBAR_ON = ['step', 'pipeline', 'overview', 'phase5', 'outcome', 'phase', 'reports', 'pulseRound',
    'questionnaire', 'cultureReview', 'practiceCounts', 'readingData', 'reviewMap', 'reviewPractices',
    'openItems', 'driftReview', 'nextCycle'];

  /* The name the Notes panel and the AI Guide give a page: the reference's own
     notesWhere() table (Culture-app.js), with the step / phase / output forms. */
  var PAGE_NAMES = {
    home: 'Home', learn: 'Learn', insights: 'Insights', 'mgmt-hub': 'Track Program', phase5: 'Culture Dashboard',
    register: 'AI Deployment Register', teamView: 'Team View', targetCulture: 'Target Culture',
    peopleSignals: 'People in the Program', runSystem: 'Owner, Cadence and Change Load', pipeline: 'Framework',
    overview: 'Framework', pulseRound: 'Pulse Round', questionnaire: 'Questionnaire', cultureReview: 'Culture Review',
    practiceCounts: 'Practice Counts', readingData: 'Reading the Data', openItems: 'Open Items',
    driftReview: 'Drift Review', nextCycle: 'Next Cycle', reviewMap: 'Review Map',
    reviewPractices: 'Standing Practices', reports: 'Report Manager'
  };
  function placeName(page, arg) {
    var PH = CUL.PH || [];
    if (page === 'step' && arg) {
      for (var i = 0; i < PH.length; i++) for (var j = 0; j < PH[i].steps.length; j++)
        if (PH[i].steps[j].id === arg) return 'Step ' + arg + ' · ' + PH[i].steps[j].name;
      return 'Step ' + arg;
    }
    if (page === 'phase' && arg) {
      var ph = PH.filter(function (p) { return String(p.id) === String(arg); })[0];
      if (ph) return 'Phase ' + ph.id + ' · ' + ph.name;
    }
    if (page === 'outcome' && arg) {
      for (var k = 0; k < PH.length; k++) {
        var o = (PH[k].outcomes || []).filter(function (x) { return x.id === arg; })[0];
        if (o) return o.name;
      }
    }
    return PAGE_NAMES[page] || null;
  }
  function pageArg(page) {
    if (page === 'phase') return String(currentPhaseId());
    return window.currentStep || '';
  }
  /* A note is filed under `notes.step` (VARCHAR 20): a step page keeps the step
     id; any other page is '@' + its id, an output '@o:' + its id, a landing
     '@p:' + the phase. The longest, '@o:out-culturereport', is 20. */
  function noteKeyOf(page, arg) {
    if (page === 'step') return arg;
    if (page === 'outcome') return arg ? '@o:' + arg : '@outcome';
    if (page === 'phase') return '@p:' + arg;
    return '@' + page;
  }

  /* The reference's seed asks confirm() first; the shell's seeds and the demo
     tab run it quietly, as the reference's own sandboxQuietSeed() did. */
  function quietSeed() {
    ready();
    var _c = window.confirm;
    window.confirm = function () { return true; };
    try { return CUL.seedSampleData(); } finally { window.confirm = _c; }
  }

  /* ── Registration ─────────────────────────────────────────── */
  var pages = {
    pipeline: page(function () { return CUL.renderPipeline(); }),
    overview: page(function () { return CUL.renderPipeline(); }),   /* one overview (item 24) */
    phase: page(phaseLanding),
    step: page(function () { return CUL.renderStep(); }),
    outcome: page(function () { return CUL.renderOutcomePage(); }),
    /* The Culture Dashboard tab IS step 5.1; the shell's go() maps 5.1 here. */
    phase5: page(function () { return CUL.renderPhase5(); }),
    insights: page(function () { return CUL.renderInsights(); }),
    'mgmt-hub': page(function () { return CUL.renderMgmtHub(); }),
    reports: page(function () { return CUL.renderReports(); }),
    targetCulture: page(function () { return CUL.renderTargetCulture(); }),
    register: page(function () { return CUL.renderRegister(); }),
    teamView: page(function () { return CUL.renderTeamView(); }),
    peopleSignals: page(function () { return CUL.renderPeopleSignals(); }),
    /* The old Run the System page opens its tab on People in the Program
       (Paul, 28 Oct 2026) — the reference's render() branch, here. */
    runSystem: page(function () {
      window.currentPage = 'peopleSignals';
      if (['owner', 'load'].indexOf(UI.psTab) < 0) UI.psTab = 'owner';
      return CUL.renderPeopleSignals();
    }),
    nextCycle: page(function () { return CUL.renderNextCycle(); }),
    driftReview: page(function () { return CUL.renderDriftReview(); }),
    readingData: page(function () { return CUL.renderReadingData(); }),
    reviewMap: page(function () { return CUL.renderReviewMap(); }),
    reviewPractices: page(function () { return CUL.renderReviewPractices(); }),
    practiceCounts: page(function () { return CUL.renderPracticeCounts(); }),
    cultureReview: page(function () { return CUL.renderCultureReview(); }),
    pulseRound: page(function () { return CUL.renderPulseRound(); }),
    questionnaire: page(function () { return CUL.renderQuestionnaire(); })
  };
  /* Every other Phase 5 page the build declares, through its shared shell. */
  Object.keys(CUL.P5_PAGES || {}).forEach(function (key) {
    if (!pages[key]) pages[key] = page(function () { return CUL.renderPhase5Shell(key); });
  });
  Object.keys(CUL.RETIRED_ROUTES || {}).forEach(function (key) { pages[key] = retired(key); });

  Modules.define('ai-culture', {

    /* The reference's own culEmptyData() (CUL_SCHEMA: every key the program
       stores, declared once), plus the org-level keys every program's document
       carries. Stored per organization PER MODULE (api/sql/workspace-modules.sql). */
    emptyData: function () {
      var d = CUL.emptyData();
      if (!d.startDate) d.startDate = new Date().toISOString().split('T')[0];
      if (!('roster' in d)) d.roster = null;
      if (!d.members) d.members = [];
      if (!d.enterprise) d.enterprise = {};
      if (!('orgSetup' in d)) d.orgSetup = false;
      if (!d.notes) d.notes = [];
      if (!d.assigns) d.assigns = {};
      if (!d.stepDue) d.stepDue = {};
      if (!d.completedSteps) d.completedSteps = {};
      if (!d.completedSections) d.completedSections = {};
      if (!d.reportDefs) d.reportDefs = [];
      if (!d.settings) d.settings = { aiGuide: true, voice: true };   /* 29 Oct 2026 (live): the AI features start on for a new organization */
      return d;
    },

    PH: CUL.PH,
    MILESTONES: CUL.MILESTONES,
    PHASE_WRAPUPS: CUL.PHASE_WRAPUPS || CUL.PHASE_COMPLETE_MSG,

    isStepDone: function (sid) { return !!CUL.isStepDone(sid); },

    /* Which steps can be assigned: the reference's own mgSteps() (Regenerate
       is the standing state and is left out). The shell's contract is
       [{id, name, ph:{id, name}}]; carried under both names, as Architecture does. */
    assignSteps: function () {
      return (CUL.mgSteps() || []).map(function (s) {
        return { id: s.id, name: s.name, icon: s.icon, ph: s.ph || s.phase, phase: s.phase || s.ph };
      });
    },

    /* The reference's go() dropped this view state on every move. */
    beforeNavigate: function (page, step) {
      if (!window.UI) return;
      if (page !== window.currentPage) UI.assignOpen = null;      /* item 10, Sweep 2 */
      UI.mapPanel = null; UI.mapMenu = null;                        /* the culture map's panel never follows */
      if (page !== window.currentPage || String(step) !== String(window.currentStep)) { UI.cmSel = null; UI.mtSel = null; }
      UI.rgGateRef = null;                                          /* R16 */
    },

    /* The shell rebuilds UI on a session change; this resets the program's own
       view state that lives in program.js. */
    sealSession: function () { try { CUL.setInsightsTab('latest'); } catch (e) { } },

    /* The lock layer's field → record map is this program's. */
    idToRecordKey: function (id) { return CUL.idToRecordKey(id); },

    /* ── The AI Guide ───────────────────────────────────────────
       The Pipeline's stage-1 Guide (POST /guide), as the other four programs:
       10 Nov 2026, 'ai-culture' is in coach.js GUIDE_MODULES and
       GuideController::ASSISTANTS (Pinecone assistant `culture`, or
       PINECONE_ASSISTANT_NAME_CULTURE in .env). The Guide's prompt lives in
       the backend, so this program sends none. */
    coachGreeting: 'Welcome to AI-Ready Culture. I’m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.',
    coachName: 'Danni',
    coachPresets: ['Where do I start?', 'Help with this step', 'How do I run the questionnaire?', 'Explain the four phases', 'What is the culture map?'],
    coachContext: function () {
      var page = window.currentPage || 'home';
      return placeName(page, pageArg(page)) || ('the ' + page + ' page');
    },

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

    /* The Demo tab's sample (js/app.js prepareSampleData): the reference's
       sampleStart() seeds the full sample quietly. Its cast has no
       administrator, which under the shell's edit rule (assignee or
       administrator edits a step) leaves most steps read-only in the demo; the
       sample tab never leaves this browser, so its visitor is made one. */
    sampleSeed: function () {
      var r = quietSeed();
      try { var first = (data.roster || [])[0]; if (first) first.admin = true; } catch (e) { }
      return r;
    },

    /* The reference's More menu offered "Seed sample data" (Harbor Ridge
       Mutual, day 85 of the program). It asks before replacing anything. */
    seeds: [
      { id: 'sample', label: 'Seed sample data', run: function () { ready(); return CUL.seedSampleData(); } }
    ],

    pages: pages,

    sidebarShowsOn: function (page) {
      return SIDEBAR_ON.indexOf(page) >= 0 || !!(CUL.P5_PAGES && CUL.P5_PAGES[page]);
    },

    /* Regenerate's heading opens the Culture Dashboard, never a phase-5
       landing; every Phase 5 page counts as phase 5 for the highlight. */
    phaseHeadTarget: function (id) { return String(id) === '5' ? ['phase5'] : null; },
    navPhaseOf: function (page) {
      if (page === 'phase5' || (CUL.P5_PAGES && CUL.P5_PAGES[page])) return 5;
      return null;
    },

    /* The reference's More menu carried the Report Manager. */
    moreItems: [
      { id: 'reports', icon: '▧', label: 'Report Manager', run: function () { go('reports'); } }
    ]
  });
})();
