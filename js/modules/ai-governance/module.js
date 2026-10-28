/* ─────────────────────────────────────────────────────────────
   ai-governance/module.js — the Responsible AI Governance module
   ─────────────────────────────────────────────────────────────
   Ported from enterprises/dev/responsible-ai-governance, which was a
   whole second copy of the app. Everything that copy duplicated — the
   store, sign-in, organizations, the admin console, the header and
   its Learn / Insights / theme / Team Chat / Notes / AI Guide
   actions, the sidebar chrome, assignments, the email queue,
   printing — is the shell's here, and this file carries only what
   makes the program itself: its phases, the shape of its workspace,
   and the seams its pages need.

   The pages themselves are NOT here. They are in program.js,
   generated from the reference build by tools/port-ai-governance.js —
   the Framework overview, the five phase landings, all seventeen step
   bodies, the eighteen output reports, the five portfolios, the
   system view, the Responsible AI spine, the governance review, the
   Governance Dashboard, the Insights shelf and the management hub,
   lifted function for function. This file is the registration and the
   handful of seams the generated code cannot supply for itself.

   Everything is inside this IIFE. Two programs' code is never on the
   page at once (see js/modules/boot.js), but keeping the module's
   internals private means a shell global and a module helper can
   never quietly shadow each other. Anything an inline onclick in this
   module's markup needs is hung off the single global `RG`.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  /* The single global this module owns, for inline handlers in its markup.
     program.js creates it and hangs all 574 ported functions off it; nothing
     is added here. Named so the seams below can reach them without depending
     on which of the two files the browser happened to reach first. */
  var RG = window.RG = window.RG || {};

  /* ── Phases ───────────────────────────────────────────────────
     Verbatim from the reference build (Governance-app.js, `var PH`). It is
     registered here rather than ported so that the sidebar, the router, the
     step-nav and My Assignments all read the same spine as the program's own
     pages — a second copy inside program.js could drift from this one with
     nothing to notice it. */
  var PH = [
    { id: 1, name: 'Map', days: 'Days 1–30', color: '#1E6E6E', steps: [{ id: '1.1', name: 'Assessment Battery', icon: '▣' }, { id: '1.2', name: 'AI System Inventory', icon: '◇' }, { id: '1.3', name: 'Identify Risks', icon: '◎' }, { id: '1.4', name: 'Regulatory Landscape', icon: '⊜' }], outcomes: [{ id: 'out-assessprofile', name: 'Assessment Profile' }, { id: 'out-sysinv', name: 'Systems Inventory' }, { id: 'out-riskreg', name: 'Initial Risk Register' }, { id: 'out-reglandscape', name: 'Compliance Survey' }] /* 13 Sep 2026 (Paul's ruling): the inventory before the register, the order of the steps */ },
    { id: 2, name: 'Build', days: 'Days 31–50', color: '#8B4513', steps: [{ id: '2.1', name: 'Responsible AI Framework', icon: '⊞' }, { id: '2.2', name: 'Ownership & Structure', icon: '⊜' }, { id: '2.3', name: 'Risk Review Cadence', icon: '↻' }, { id: '2.4', name: 'Compliance Catalog', icon: '⊙' }, { id: '2.5', name: 'Assessment Prioritization', icon: '⊚' }], outcomes: [{ id: 'out-ethicsdoc', name: 'Responsible AI Principles' }, { id: 'out-raci2', name: 'RACI Matrix' }, { id: 'out-govsystems', name: 'Governance Systems Report' }, { id: 'out-compliance', name: 'Compliance Obligations' }] },
    { id: 3, name: 'Assess', days: 'Days 51–70', color: '#C8860A', steps: [{ id: '3.1', name: 'Responsible AI Screening', icon: '⊕' }, { id: '3.2', name: 'Deepen Assessment', icon: '⊡' }, { id: '3.3', name: 'Testing & Evidence', icon: '⊘' }], outcomes: [{ id: 'out-assessedreg', name: 'Assessed Risk Register' }, { id: 'out-testing', name: 'Testing & Evidence' }] /* 12 Sep 2026 (Paul's ruling): the classification report is folded into the registers, where every record's identity carries its classification */ },
    { id: 4, name: 'Embed', days: 'Days 71–90', color: '#3D4F5C', steps: [{ id: '4.1', name: 'Manage and Monitor', icon: '◻' }, { id: '4.2', name: 'Finalize the Framework', icon: '△' }, { id: '4.3', name: 'Review the Systems', icon: '↗' }, { id: '4.4', name: 'First Governance Review', icon: '⊟' }], outcomes: [{ id: 'out-exitplans', name: 'Management & Monitoring Plans' }, { id: 'out-govfw', name: 'Governance Framework' }, { id: 'out-updatedreg', name: 'Updated Risk Register' }] },
    { id: 5, name: 'Govern', days: 'Ongoing', color: '#2A5A5A', steps: [{ id: '5.1', name: 'Governance Dashboard', icon: '⬡' }, { id: '5.2', name: 'Compliance Dashboard', icon: '⊞' }, { id: '5.3', name: 'Testing Center', icon: '⊚' }, { id: '5.4', name: 'Analytics', icon: '∿' }], outcomes: [] }
  ];

  /* The milestone line under a completed step. The program's own pages read
     STEP_MILES (program.js, its own copy) through the reference's milestone();
     this is the same content under the name the SHELL asks for, so the surfaces
     that are not this program's — My Assignments, the completion email — say
     the same thing the step page does. Keep the two in step. */
  var MILESTONES = {
    '1.1': 'Baseline established — an honest, recorded picture of your AI exposure, risk tolerance, existing controls, decision rights, and existing Responsible AI oversight.',
    '1.2': 'AI landscape mapped — the systems register holds what is running, who owns it, and what it depends on.',
    '1.3': 'Risks surfaced — what could go wrong is on the register, scored in the moment and ranked by rapid score.',
    '1.4': 'Regulatory landscape mapped — everything that could plausibly govern you is on the survey, awaiting the Step 2.4 scoping review.',
    '2.1': 'Principles written and owned — commitments with breach lines on the register, and the review board named.',
    '2.2': 'Ownership assigned — every governance activity has one accountable name, and the culture and feedback commitments are on the record.',
    '2.3': 'Rhythm set — the New Risk Review is scheduled, the re-scan is owned, and the event triggers are armed to catch risk that arrives between reviews.',
    '2.4': 'Obligations cataloged — every regime that applies carries its summary or its itemized list.',
    '2.5': 'Selection made — every score reviewed against the full register, and every Urgent risk advancing under a named owner or deferred with its trigger and horizon.',
    '3.1': 'Responsible AI screening complete — every flagged risk screened: confirmed with its linkage or cleared, both on the record.',
    '3.2': 'Risks classified — fresh Likelihood, Impact, and Timeframe scores on every selected risk, and each one moved by decision: Manage, Monitor, or Archive.',
    '3.3': 'Testing planned and logged — each system\'s testing needs are listed, each test has its design, and the evidence log records what has run.',
    '4.1': 'Plans on the cards — every managed risk carries its plan and every monitored risk has its watching conditions.',
    '4.2': 'Framework finalized — the standing meeting is scheduled, its agenda set, and the deployment and integration commitments written.',
    '4.3': 'Systems reviewed — every system\'s record confirmed current and a standing exit plan written on each.',
    '4.4': 'First review held — the whole agenda covered on the live pages, the reflection on the record.'
  };

  var PHASE_WRAPUPS = {
    1: 'Phase 1 is complete. You know where you stand, what is running, what could go wrong, and what could govern you. The Identify portfolio is populated and ranked, and every potential compliance regime is on the register awaiting its scoping review. Phase 2 builds the machinery that decides what happens to those risks.',
    2: 'Phase 2 is complete. Your principles are written and owned, every governance activity has an accountable name, the review clock is set with its triggers armed, and every risk that matters carries a decision. The Assess portfolio holds exactly the risks you chose. Phase 3 is where the deep work happens.',
    3: 'Phase 3 is complete. Every selected risk is understood, scored on evidence, and classified by decision — the Manage portfolio is filling, archived risks carry their rationales, and every system is working through the compliance testing stages. Phase 4 turns those judgments into working plans.',
    4: 'Phase 4 is complete, and so is the program. Plans are on the cards, the Governance Review is a real meeting that has now been held once, and governance is wired into how your organization already runs. From here, the portfolios and the reviews carry the work.'
  };

  /* ── Seams the generated pages need ───────────────────────────
     Each is here rather than in program.js for the same reason: that file is
     generated from the reference build, so a hand-edit to it is lost on the
     next port. */

  /* 1. Transient view state this program's pages read. The shell's UI object is
     the PIPELINE's set of keys, so the ones only this program uses are absent —
     and `UI.acEdit[r.id]` on a missing object is a TypeError that takes the
     whole page down, not a quiet undefined.

     Only the keys the generated code indexes WITHOUT a guard of its own are
     seeded, plus the reference's own UI literal. Two are deliberately LEFT
     OUT, because for them `undefined` is a value the program reads:

       UI.mnScalar     `if(!UI.mnScalar)return;` — seeding {} would make an
                       early return stop happening.
       UI.ethRevTicks  go() sets it to null when the reader leaves the
                       Responsible AI spine, which is how a logged review's
                       ticks reset. Every read guards with `&&`.

     Existing values are never overwritten — the shell may have restored a real
     one already. */
  var UI_DEFAULTS = {
    /* The reference's own literal (Governance-app.js, `var UI=…`), minus the
       keys the shell already declares. */
    editSys: null, editRisk: null, showSysForm: false, showRiskForm: false,
    activeRisk: null, activeView: null, triageActive: null, abSec: '1.1a',
    /* id → value maps the pages index into. Every guard the reference does
       write for these is `if(!UI.x)UI.x={}`, so an empty object is exactly the
       state they expect. */
    acEdit: {}, acTab: {}, ethDraft: {}, rapidDraft: {}, prEdit: {},
    mgStash: {}, mnStash: {}, wbStash: {}, rescoreConfirmed: {}
  };
  function seedUiState() {
    if (!window.UI) return;
    for (var k in UI_DEFAULTS) {
      if (!UI_DEFAULTS.hasOwnProperty(k)) continue;
      if (UI[k] === undefined) UI[k] = UI_DEFAULTS[k];
    }
  }

  /* 2. The two document repairs the reference ran from its own go(): capacity
     decisions that were deleted wherever found, the NIST summary shape, and
     the renamed test outcome. They belong on the path every render takes
     rather than on boot alone, for the same reason the Leaders modules'
     normalize() does: Store adopts a newer remote document at any moment
     (adoptDoc, js/app.js), and a colleague on an older client can put an
     unrepaired shape back under a page that is already open.

     NOT in beforeNavigate, which is where the reference had them. The shell
     guards that hook with a document snapshot and rolls it back when the
     reader only looked at the page (go(), js/app.js) — correct for a field
     harvest, and it would quietly undo a migration every time. */
  function normalize() {
    if (!window.data) return;
    /* Give the document this program's SHAPE before anything reads it.
       There are documents in the database already, filed under module
       'ai-governance' and written by the shared placeholder while this program
       was catalogued but not built (js/modules/_placeholder/module.js). They
       carry the roster, the organization profile and the placeholder's own
       `answers`/`bf*` keys, and not one of this program's containers — so the
       first page to reach `data.risks.length` rather than `(data.risks||[])`
       dies on a workspace that looks perfectly healthy in the switcher.

       Filled from emptyData(), never overwritten, and nothing is removed: a
       key this program does not use costs a few bytes, and deleting from a
       document another version of the app might still be writing is how a
       repair becomes a data loss. On the render path rather than at boot,
       because Store adopts a newer remote document at any moment (adoptDoc,
       js/app.js) and a colleague on an older client can put an unrepaired
       shape back under a page that is already open. */
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
    try { RG.migrateCapacityDecisions(); } catch (e) { }
    try { RG.migrateNistSummary(); } catch (e) { }
    /* Addendum 153 (15 Aug 2026, ruled): stored worlds carry the renamed
       threat outcome. Verbatim from the reference's go(). */
    try {
      (data.systems || []).concat(data.risks || []).forEach(function (x) {
        ((x && x.testEvidence) || []).forEach(function (e) {
          if (e.outcome === 'Not found by these means') e.outcome = 'No threat found';
        });
      });
    } catch (e) { }
  }

  /* 3. The daily analytics snapshot. The reference ticked it from its boot
     block, which is code the port cannot lift: that block runs at load, and at
     load this file has no Store, no UI and no data. Moved to the first render
     instead. It writes at most one snapshot a day — anCaptureSnapshot checks
     the date first — so the only thing that changes is when the first one
     lands. */
  var _ticked = false;
  function dailyTick() {
    if (_ticked || !window.data) return;
    _ticked = true;
    try { RG.govDailyTick(); } catch (e) { }
  }

  /* 4. Wraps every page below. NOT called at load: boot.js loads a module's
     code in the head, before app.js, so `UI` and `data` do not exist yet at
     that point — a module's script has to be inert until it renders (see
     js/modules/boot.js). */
  function ready() { seedUiState(); normalize(); dailyTick(); }
  function page(fn) {
    return function () { ready(); return fn.apply(null, arguments); };
  }

  /* The phase a landing was asked for. The shell's go() stores it as a STRING
     ('3') and the reference's renderPhaseLandingPage reads currentPhase, which
     go() has already resolved — so this only has to cover the case where it
     could not (a phase id arriving with no matching entry in PH). */
  function currentPhaseId() {
    if (window.currentPhase) return currentPhase.id;
    return parseInt(window.currentStep, 10) || 1;
  }

  /* ── Registration ─────────────────────────────────────────── */
  Modules.define('ai-governance', {

    /* The workspace document — this program's own shape, verbatim from the
       reference's govEmptyData(). Stored per organization PER MODULE, so it
       sits alongside the Pipeline's and Executive Readiness's under the same
       team and sign-in and can never be read or written by either
       (api/sql/workspace-modules.sql, api/config/modules.php).

       startDate is minted here rather than left null because the phase
       landings, the burn-up and the deadline sweep all measure from it. */
    emptyData: function () {
      return {
        assessmentBattery: {}, systems: [], risks: [], regimes: [], nistCert: {},
        triage: {}, decisionRights: {}, ethicalFramework: {}, ownership: {},
        raciMatrix: [], reviewCadence: {}, incentivesSkills: {}, govRhythm: {},
        embedOps: {}, firstReview: {}, govCulture: {}, stakeholder: {},
        completedSteps: {}, completed: {}, notes: [], stepDue: {}, assigns: {},
        /* The Report Manager's saved reports. rcDefs() creates this lazily in
           the reference build; declared here so the container is part of the
           document's shape like every other one — the sync merge and the
           workspace history both work a section at a time. */
        reportDefs: [],
        startDate: new Date().toISOString().split('T')[0],
        roster: null, members: [], enterprise: {}, orgSetup: false,
        settings: { aiGuide: false, voice: false }   /* Part 2 (7 Oct 2026): the AI Guide and Voice, off until an administrator switches them on */
      };
    },

    PH: PH,
    MILESTONES: MILESTONES,
    PHASE_WRAPUPS: PHASE_WRAPUPS,

    /* Completion for this program is not a plain lookup in
       data.completedSteps: a step counts as done when its own data gate is
       satisfied as well as when it is signed off, and 5.x has no completion at
       all. The shell's isStepDone() delegates here when a module offers it
       (js/app.js), so the sidebar, the step-nav and My Assignments all agree
       with the step page. */
    isStepDone: function (sid) { return !!RG.isStepDone(sid); },

    /* Which steps can be ASSIGNED to a member. Phase 5 is the standing state —
       four dashboards, not work with an owner and a deadline — so it is not in
       the list, and My Assignments asks here rather than walking PH itself,
       whose spine includes it (js/features/my-assignments.js). */
    assignSteps: function () { return RG.mgSteps(); },

    /* This program's textareas do not save per keystroke: not one of its field
       builders carries an onchange, because the reference harvests whatever is
       on screen at the moment of navigation instead. The shell's go() calls
       this first so that stays true — leave it out and every textarea in the
       program loses what was typed the moment the reader clicks anything. */
    beforeNavigate: function () {
      ready();
      RG.harvestOpenFields();
      /* Two pieces of view state the reference's own go() reset on every move.
         The first closes the add-regime form so it is never open on arrival
         (item 60); the second drops a logged Responsible AI review's ticks
         when the reader leaves that page, which is what makes the review a
         meeting held in the room rather than a saved form (round 45). */
      if (!window.UI) return;
      UI.regAdd = false;
      if (window.currentPage === 'ethicsov' && UI.ethRevLogged) {
        UI.ethRevTicks = null; UI.ethRevLogged = false; UI.ethReviewHdr = false;
        UI.ethRevNotes = null;
      }
    },

    /* Part S (directive 2 Oct 2026): the shell's sealSession resets the shell's
       session state, UI included; this resets the program's own, which is the
       Insights tab (program.js keeps its own insightsTab, and the shell's
       insightsTabReset only reaches the shell's). The reference's draft stashes,
       which its resetVolatileUI cleared, are UI keys, so the shell's rebuild of
       UI clears them, and the page wrappers' ready() seeds UI_DEFAULTS again on
       the next render. */
    sealSession: function () { if (RG.insightsTabReset) RG.insightsTabReset(); },

    /* Which shared record a given input belongs to — the map behind the record
       locks and the "someone else is editing this" banner. THE SHELL asks for
       this one (idToRecordKey, js/app.js) rather than the module calling it,
       which is why it has to be handed over explicitly: nothing in program.js
       calls it, so nothing pulled it in on its own.

       Its table is this program's. `exp_departments` is the Assessment
       Battery's AI-exposure block here — one shared record, `assessmentBattery`
       — where the Pipeline's table reads `exp_` as an experiment and returns
       `experiments::departments`. Under the shell's, this program claimed every
       lock beside the name its own lockBlocked('assessmentBattery') checks, so
       the two never met and two members editing the same field did not lock
       each other. */
    idToRecordKey: function (id) { return RG.idToRecordKey(id); },

    /* ── The same question, one level finer ──────────────────────
       idToRecordKey above says which RECORD a field belongs to, which is what a
       lock needs. This says which LEAF it is, which is what a change note
       needs: the shell puts "X changed this — yours / now stored" under the box
       it happened in, and it can only find the box if a reported collision
       (`.assessmentBattery.aiExposure.departments`) resolves back to a field id.

       Without it this program falls back to the shell's table, which is the
       PIPELINE's: `exp_departments` reads there as an experiment, and a note
       would be placed under the wrong field or against a path that does not
       exist. Same lesson as idToRecordKey, one level down.

       ONLY the families that write `store[field] = val(prefix_field)` straight
       through, verified against program.js. Anything that translates the
       suffix, embeds a row id (`pt_0_name`, `ru_<id>_x`), or is written by a
       harvest with its own shape returns null — and a field with no path simply
       gets no note, which is the right answer where the path cannot be known.
       A note under the wrong box would be worse than none. */
    idToDocPath: function (id) {
      if (!id) return null;
      var i = id.indexOf('_');
      if (i < 0) return null;
      var pre = id.slice(0, i), f = id.slice(i + 1);
      if (!f || f.indexOf('_') >= 0) return null;   // a row id in the middle: not this shape

      /* saveABFields(prefix, base, fields) — data.assessmentBattery[base][f]. */
      var battery = { exp: 'aiExposure', ctrl: 'existingControls', eg: 'ethicalGovernance' };
      if (battery[pre]) return ['assessmentBattery', battery[pre], f];

      /* data.<store>[f] = val('<pre>_' + f). */
      var singles = {
        dr: 'decisionRights', os: 'ownership', gc: 'govCulture', sk: 'stakeholder',
        eo: 'embedOps', is: 'incentivesSkills', gr: 'govRhythm'
      };
      return singles[pre] ? [singles[pre], f] : null;
    },

    /* The same harvest, asked for where nobody is navigating: the shell banks
       the open page before it merges in another member's save, so what is on
       screen is compared as this browser's work instead of being repainted
       away (bankOpenPage, js/app.js). It is only ever a read of the page into
       the document — no view state moves — which is why beforeNavigate, which
       does move view state, cannot be used for it. */
    harvestOpenPage: function () { ready(); RG.harvestOpenFields(); },

    /* ── The AI Guide ─────────────────────────────────────────
       All three verbatim from the reference build's coach panel. The shell
       supplies the panel, the transport and the history; what the guide KNOWS
       is the program's. */
    /* AI Guide (16 Oct 2026): the Pipeline's stage-1 Guide (Pinecone), so the greeting takes the same shape. The
       presets and system prompt below are no longer used by the panel; they stay as the reference build's record. */
    coachGreeting: 'Welcome to Responsible AI Governance. I\'m your AI Guide. Ask me how to complete the step you\'re on, what to do next, or for ideas drawn from Faisal Hoque\'s writing on AI risk and accountability.',
    coachPresets: ['Where do I start?', 'Help with this step', 'What is CARE?', 'Explain LIT scoring', 'How does NIST map to this?'],
    coachSystem: 'You are the AI Guide for Faisal Hoque\'s 90-Day Responsible AI Governance Program — grounded in the CARE framework (Catastrophize, Assess, Regulate, Exit) and published in Fast Company, HBR, and MIT Sloan Management Review. You help leaders build working AI governance through five phases: Map, Build, Assess, Embed, Govern — an execution path aligned to the NIST AI Risk Management Framework (GOVERN, MAP, MEASURE, MANAGE). Be direct, insightful, and strategic. Maximum 150 words per response. No bullets unless absolutely essential.',
    /* What the reader is looking at right now. A hook rather than a value
       because it is always a reading of live state. */
    coachContext: function () {
      var step = window.currentStep;
      if (!step) return 'the framework overview';
      var label = RG.ctxLabel(step);
      var ph = window.currentPhase;
      return ph ? (label + ' (' + ph.name + ')') : label;
    },

    /* This program's sample workspace — the reference build's own seed,
       ported with the rest (program.js). There is one, not two: the Pipeline's
       second seed is a Year 2 portfolio, and this program has no portfolio and
       no year two. The More menu lists whatever a program declares here.

       It builds THIS program's document — systems, risks, regimes, a RACI
       matrix, a testing log — and none of the Pipeline's ideas and projects,
       which is what tools/ai-governance-smoke.js asserts. */
    seeds: [
      { id: 'sample', label: 'Seed sample data', run: function () { ready(); return RG.seedSampleData(); } }
    ],

    /* Pages this module owns, every one of them the reference build's own
       renderer (program.js). Home and Learn are not here: they are the shell's
       screens, and this module simply ships its own markup for them
       (templates/modules/ai-governance/). Insights IS here, because unlike the
       other Enterprise programs this one built its own shelf.

       Six ids the shell has never heard of come with the program — portfolio,
       system, ethicsov, govreview, mgmt-hub and reports — and they need no
       routing change: go() leaves an unrecognised page id alone, render() asks
       the module first, and js/router.js addresses whatever currentPage says. */
    pages: {
      pipeline: page(function () { return RG.renderModuleOverview(); }),
      phase: page(function () { return RG.renderPhaseLandingPage(currentPhaseId()); }),
      step: page(function () { return RG.renderStep(); }),
      outcome: page(function () { return RG.renderOutcomePage(); }),
      /* The Govern tab IS step 5.1, the Governance Dashboard — the risk
         pipeline, the portfolios, the standing reviews and the Data Bank. It
         is a page rather than a step because that is what the reference build
         made it: go() maps step 5.1 to this page (js/app.js), and the sidebar
         and the step-nav both point here. */
      phase5: page(function () { return RG.renderPhase5(); }),
      insights: page(function () { return RG.renderInsights(); }),
      portfolio: page(function () { return RG.renderPortfolioPage(); }),
      system: page(function () { return RG.renderSystemView(); }),
      ethicsov: page(function () { return RG.renderEthicsOverviewPage(); }),
      govreview: page(function () { return RG.renderGovReview(); }),
      'mgmt-hub': page(function () { return RG.renderMgmtHub(); }),
      /* The Report Manager (Paul's ruling, 14 Sep 2026): outputs, Phase 5
         pages, reviews, portfolios, single records and the user's own text
         pages compiled into one printed document under one cover. Reached
         from the More menu — see moreItems below. */
      reports: page(function () { return RG.renderReports(); })
    },

    /* The reference build puts the Report Manager in its own More menu
       (_navMoreHtml). Here the shell owns that menu and asks each program
       what to add to it, so the item is declared rather than drawn. */
    moreItems: [
      { id: 'reports', icon: '☷', label: 'Report Manager', run: function () { go('reports'); } }
    ]
  });
})();
