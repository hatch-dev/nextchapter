/* ─────────────────────────────────────────────────────────────
   pipeline/module.js — the AI Innovation Pipeline module
   ─────────────────────────────────────────────────────────────
   The runtime half of this program's definition (the static half —
   name, wordmark, which scripts to load — is in js/modules/registry.js).

   What a module owns:
     emptyData()     the shape of its workspace document
     PH              its phases, steps and outputs; drives the sidebar,
                     the router, progress and the management hub
     MILESTONES      the line shown when a step is marked complete
     PHASE_WRAPUPS   the closing note on a phase's last step
     coachGreeting   the AI Guide's opening message
     pages           page id → renderer, for anything the shell's own
                     route table doesn't already cover

   What it does NOT own: sign-in, organizations, the team, the header
   and its actions, the sidebar chrome, notes, chat, help, printing,
   theme and zoom. Those are the shell's, shared by every module.

   Historical note: the Pipeline's page renderers still live in
   js/app.js and js/steps/*.js, where they were before the app grew a
   second program. `pages` is left empty so the shell keeps routing
   them exactly as it always has; moving that content in here is the
   next step and changes nothing about this contract.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.define('pipeline', {

    /* The workspace document. Every key the program ever writes starts
       here, so a fresh organization and a restored export have the same
       shape and no screen has to guard against a missing collection. */
    emptyData: function () {
      return {
        ideas: [], selected: [], assessments: {}, projects: {}, completedSteps: {}, completedSections: {},
        ownership: {}, incentives: {}, rhythm: {}, portfolio: {}, capAlloc: {}, capital: {}, experiments: {},
        expSelected: [], tracking: {}, review: {}, governance: {}, stress: {}, launched: [], opsData: {},
        budgetPlans: {}, notes: [], raci: {}, purpose: {}, knowledge: {}, culture: {}, decisions: {}, audit: [],
        assigns: {}, roster: null, enterprise: {}, members: [], orgSetup: false, settings: { aiGuide: false, voice: false },
        reportDefs: [] /* 17 Sep 2026: the Report Manager's saved reports */
      };
    },

    PH: [
      { id: 1, name: 'Diagnose', days: 'Days 1–30', color: '#1B6B5A', steps: [{ id: '1.1', name: 'Assessment Battery', icon: '■' }, { id: '1.2', name: 'Brainstorm Use Cases', icon: '◇' }, { id: '1.3', name: 'Filter & Rank', icon: '▽' }], outcomes: [{ id: 'out-report', name: 'Assessment Report', icon: '□' }, { id: 'out-bluesky', name: 'Blue Sky Portfolio', icon: '▒' }] },
      { id: 2, name: 'Organize', days: 'Days 31–50', color: '#2D5A8E', steps: [{ id: '2.1', name: 'Ownership & Structure', icon: '+' }, { id: '2.2', name: 'Realign Incentives', icon: '⇄' }, { id: '2.3', name: 'Innovation Rhythm', icon: '↻' }, { id: '2.4', name: 'Deepen Assessment', icon: '↧' }], outcomes: [{ id: 'out-orgready', name: 'Org Readiness', icon: '■' }, { id: 'out-raci', name: 'RACI Matrix', icon: '⊕' }, { id: 'out-explore', name: 'Exploration Portfolio', icon: '▪' }] },
      { id: 3, name: 'Prepare', days: 'Days 51–70', color: '#8B5E3C', steps: [{ id: '3.1', name: 'Structure Portfolio', icon: '▒' }, { id: '3.2', name: 'Plan Capacity', icon: '▦' }, { id: '3.3', name: 'Allocate Capital', icon: '◻' }, { id: '3.4', name: 'Map Development Track', icon: '△' }], outcomes: [{ id: 'out-capplan', name: 'Capital Snapshot', icon: '◻' }, { id: 'out-expbriefs', name: 'Development Portfolio', icon: '△' }] },
      { id: 4, name: 'Ignite', days: 'Days 71–90', color: '#9B2D3F', steps: [{ id: '4.1', name: 'Run Development Track', icon: '▷' }, { id: '4.2', name: 'Establish Governance', icon: '—' }, { id: '4.3', name: 'Stress-Test Org Design', icon: '✕' }, { id: '4.4', name: 'Portfolio Review', icon: '↗' }], outcomes: [{ id: 'out-govfw', name: 'Governance Framework', icon: '—' }, { id: 'out-orgrev', name: 'Org Design Review', icon: '✕' }, { id: 'out-finalport', name: 'Portfolio Review', icon: '↗' } /* 17 Sep 2026 (Paul's ruling): Ignite's third output is the review distilled from Step 4.4, not a second Development Portfolio */] },
      { id: 5, name: 'Navigate', days: 'Ongoing', color: '#6B4C8A', steps: [{ id: '5.1', name: 'Pipeline Dashboard', icon: '▒' }], outcomes: [{ id: 'out-oper', name: 'Operational Portfolio', icon: '✕' }, { id: 'cap-hub', name: 'Capital Planning Hub', icon: '◻' }] }
    ],

    MILESTONES: {
      '1.1': 'Baseline established — you now have a quantified picture of your organization\'s AI readiness.',
      '1.2': 'Your blue sky portfolio now contains at least three ideas.',
      '1.3': 'Portfolio filtered — your ideas are ranked by priority, value, cost, risk, and ease, with your selections carried forward.',
      '2.1': 'Ownership assigned — the pipeline has a named owner with explicit authority, backed by embedded leads and engaged seniors.',
      '2.2': 'Incentives realigned — innovation metrics are tied to the behaviors that matter.',
      '2.3': 'Innovation rhythm set — standing meetings and portfolio reviews are calendared.',
      '2.4': 'Projects deepened — SWOT analysis, gap analysis, and partnerships mapped.',
      '3.1': 'Portfolio structured — projects organized by time horizon with strategic balance assessed.',
      '3.2': 'Capacity planned — the budget envelope is sized across the horizon.',
      '3.3': 'Capital committed — the first cohort advanced with stage gates and a budget that holds.',
      '3.4': 'Development tracks mapped — every advanced project has phases with budgets, owners, success metrics, and exit gate criteria.',
      '4.1': 'Development running — every live program’s next gate is set, and gate decisions are being taken as phases end.',
      '4.2': 'Governance established — the framework that will sustain your portfolio beyond 90 days.',
      '4.3': 'Organization stress-tested — structural readiness confirmed for sustained innovation.',
      '4.4': 'First review complete — Buy/Sell/Hold decisions made. Your innovation portfolio is operational.'
    },

    // Shown on a phase's final step once every step in the phase is done (July 10)
    PHASE_WRAPUPS: {
      1: 'Phase 1 complete. You’ve mapped the ground: your purpose, an honest read of your culture, an audit of what you already run, and a clear picture of who decides what. You’ve turned a wide field of ideas into a ranked shortlist worth pursuing. You diagnosed before you built — and that’s what keeps everything that follows from resting on untested assumptions. Next, you build the machinery to move these ideas forward.',
      2: 'Phase 2 complete. The machinery now exists. One person owns the pipeline with real authority; incentives reward pipeline health, not just quarterly delivery; a standing weekly rhythm protects the time to look forward. And you’ve taken your shortlist through a deeper assessment, turning promising ideas into defined projects with a clear verdict on each. The structure is built. Next, you give it something to run.',
      3: 'Phase 3 complete. You have a real portfolio now — a balanced mix of quick wins, medium-term projects, and longer bets, rather than a scattered list. You’ve set your capital and selected a first cohort of projects that fits within it. And your first development phases are designed — each with an owner, a budget, a timeline, and a measure of success, and each ending at a rigorously defined gate that progress must pass through. Everything is loaded. Next, you light the fuse.',
      4: 'You’ve launched your first experiments, established governance that outlasts these ninety days, stress-tested your organization, and made your first buy-sell-hold decisions. You have a working pipeline, a real portfolio, live experiments, and the discipline to sustain all of it. When day ninety arrives, the pipeline doesn’t switch off — it becomes your engine, taking in new ideas, advancing the strong ones, and retiring the rest. The ninety days were only ever the key to the ignition. After that, the road is yours.'
    },

    coachGreeting: 'Welcome to the AI Innovation Pipeline. I\u2019m Danni, your AI guide. Ask me how to complete any step, or for ideas drawn from our research and publications.',   /* AI Guide stage 1 brief, 12 Oct 2026, section 6 item 1 */
    coachName: 'Danni',   /* Directive AskDanni, 28 Oct 2026: the button and panel read Ask Danni, replies Danni */

    /* This program's sample workspaces. Both build the Pipeline's own document —
       ideas, projects, a capital envelope, a portfolio — so they belong to the
       program, not to the shell that offers them in the More menu. Saving the
       result to the database is runSeed()'s job (js/dev/seed.js). */
    seeds: [
      { id: 'sample', label: 'Seed sample data', run: function () { return seedData(); } },
      { id: 'year2', label: 'Seed Year 2 sample', run: function () { return seedDataY2(); } }
    ],

    /* Actions only this program has. js/nav.js draws them from
       Modules.moreItems(); the page itself is routed by render().
       `run` is required — the registry filters out an item without one. */
    moreItems: [
      { id: 'reports', icon: '☷', label: 'Report Manager', run: function () { go('reports'); } } /* 17 Sep 2026: the Report Manager's door */
    ],

    // Empty: the shell's built-in route table still renders every Pipeline page.
    pages: {}
  });
})();
