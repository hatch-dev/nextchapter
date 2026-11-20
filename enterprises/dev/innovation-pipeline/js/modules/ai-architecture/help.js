/* ─────────────────────────────────────────────────────────────
   ai-architecture/help.js — AI-Ready Architecture's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Ported from the reference build's openHelp() (Architecture-app.js,
   "16 Oct 2026 (Paul): rebuilt to the Innovation Pipeline's standard"),
   which hand-built the whole overlay in inline styles. Here it is
   content only: js/features/help.js renders it and owns the
   { shared: … } blocks that describe features every program has.

   Replaced by the shell's shared blocks, because on the shared shell
   they describe a different thing than the reference's text did:
   Signing In & Organizations (the suite's sign-in, one account for
   every program), Track Program, the Tools list (the shell's header —
   no Demo button here), Organization & Team, and Data & Privacy (the
   workspace is server-backed and team-shared). Everything else is the
   reference's text, verbatim.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('ai-architecture', {
    title: '90 Days to an AI-Ready Architecture',
    intro: 'A step-by-step tool for building the technical architecture that enterprise AI depends on, grounded in Faisal Hoque’s published frameworks. This guide explains how the module is organized and how each of its surfaces works.',

    sections: [
      {
        title: 'What This Is',
        body: 'Four sequential phases take you from a scored assessment of your current architecture to your first full architecture review, in 90 days. A fifth phase, Manage, keeps the architecture running after that. Each phase breaks into guided steps, and every phase produces output documents you can print. Your work saves to your organization’s shared workspace as you go.'
      },
      {
        title: 'Getting Around',
        rows: [
          { k: 'Top bar', v: 'Home · Learn · Framework · Dashboard · Insights on the left. The module switcher, your profile chip, Help, the Light/Dark toggle, Team Chat and the More menu sit at the top right.' },
          { k: 'Left sidebar', v: 'Shows the five phases with their day ranges, every step, and each phase’s Outputs list. Click a phase to open or close it, and click a step or output to go to it. Minimize collapses the sidebar.' },
          { k: 'Step pages', v: 'Each step opens with a four-slide carousel, then the step’s guided work, then “Mark step complete and continue.” Every step can be assigned to a named owner. The steps build on one another, so work them in order.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Five Phases',
        phases: [
          {
            n: '01', t: 'Map — Days 1–25', col: '#3D6B6E',
            steps: 'Assessment Battery · Architecture Review Board · Map Architecture · Architectural Risk · Sovereignty Baseline',
            out: 'Architecture Readiness Report · Architecture Map · Architectural Risk Map · Review Board org chart · Sovereignty Baseline Report',
            d: 'Score the architecture you have, set up the Architecture Review Board, map the systems AI depends on across the five layers, work through the architectural risks, and set your sovereignty baseline.'
          },
          {
            n: '02', t: 'Build — Days 26–55', col: '#4A6E8A',
            steps: 'Data Governance &amp; Platform · Compute and Model Layers · Integration Modernization · Application &amp; Agent Governance · Enterprise Architecture Fit · Zero-Trust Architecture · Sovereignty Planning',
            out: 'Data Governance Model · Integration Plan · Governance Framework · Sovereignty Plan',
            d: 'Set the rules and plans for each layer: data governance, compute and model rules, integration, applications and agents, how each workflow fits the business, zero trust, and the sovereignty plan.'
          },
          {
            n: '03', t: 'Test — Days 56–75', col: '#7A6B4A',
            steps: 'End-to-End Deployment Test · Security &amp; Identity Stress Test · Cascade Failure Scenarios · Sovereignty Validation',
            out: 'Deployment Conformance Report · Security and Identity Test Report · Cascade Failure Report · Sovereignty Validation Report',
            d: 'Test what you built against the rules you set: an end-to-end deployment, security and identity attacks, cascade failures, and the sovereignty plan.'
          },
          {
            n: '04', t: 'Embed — Days 76–90', col: '#6E4A5A',
            steps: 'Skills Inventory &amp; Gap Plan · Operationalize Sovereignty · First Architecture Review',
            out: 'Skills Gap Plan · Architecture Review Report',
            d: 'Close the skills gaps, put the sovereignty program into everyday operation, and hold your first full architecture review.'
          },
          {
            n: '05', t: 'Manage — Ongoing', col: '#5A6B7A',
            steps: 'Architecture Dashboard · Architecture Map · Sovereignty Center · Testing Log · Analytics',
            out: 'Quarterly Architecture Report · Data Governance Review Report',
            d: 'Run the living architecture from the Dashboard.'
          }
        ]
      },
      {
        title: 'The Five Layers and the Architecture Map',
        body: 'Every part of the program is organized around five layers: Data &amp; Storage, Compute &amp; Acceleration, Model &amp; Algorithm, Orchestration &amp; Tooling, and Application. At step 1.3 you map your components layer by layer, each on its own card. Where a component touches a data system, you mark the direction: Reads, Writes, or both. Later steps build on the same map, which appears as the Architecture Map output and as a page on the Dashboard, with four views: System Flow Diagram, AI Tech Stack, Mind Map, and Component Explorer.'
      },
      {
        title: 'The Sovereignty Program',
        body: 'Sovereignty runs through four steps. Assess (1.5): answer 21 questions across four dimensions, list your external dependencies, and review your vendors’ AI roadmaps. Plan (2.7): choose your actions. Validate (3.4): ask each question again once the actions are in place. Operationalize (4.2): name an owner, set up monitoring, and schedule the practices that keep it running. Each dimension card shows how many questions “require further exploration” – answers other than Yes or Not applicable – and Partly is a legitimate, finished answer. The Sovereignty Center on the Dashboard keeps all of it in one place.'
      },
      {
        title: 'The Architecture Review',
        body: 'The Architecture Review Board, set up at step 1.2, holds the reviews. At step 4.3 you run the first one: cover every item on the agenda, rescore the architecture, answer the three closing questions, and log the review. The Architecture Review Report records it. After that, the Board meets at the cadence you set, and the Quarterly Architecture Report rolls the picture up for each review.'
      },
      {
        title: 'The Review Board and its RACI',
        body: 'At step 1.2 you set out the Board’s members (Name · Title · Board role · Reports to), its meeting cadence, and a RACI for its activities. R marks the person responsible, who does the work. A marks the person accountable, who owns the outcome, with exactly one A per activity. C marks the people consulted before a decision. I marks the people informed after it. The Review Board org chart is the printable record.'
      },
      { shared: 'team' },
      { shared: 'track' },
      {
        title: 'Report Manager',
        body: '☷ Report Manager, in the More menu, compiles parts of the program into one printed document under one cover: a contents page, a list of anything still missing, an introduction you write, and each piece as a numbered section.<br><br>'
          + 'Choose “+ New report,” give it a title and subtitle, and add sections from the options on the right: any of the phase outputs, the Phase 5 pages and their sections, standing pages such as Model Rules and Integration Standards, and individual components, risks, and dependencies. Many come in a Summary or a Full version. Add a text page wherever a part of the report needs its own introduction. Preview it, then “Save as PDF.” A saved report reprints with fresh data each time. Duplicate a report to start a variant, or Delete one you no longer need. Nothing in your program is edited here.'
      },
      {
        title: 'Inside a Step',
        body: 'Each field saves as soon as you leave it. Fields marked * are required. “Mark step complete and continue” unlocks once they are done. The line beneath it says what is still needed, and clicking the locked button points to the empty fields. On step 1.5, “Show what’s left to complete” lists everything outstanding and takes you to any item you click. While a colleague is editing something, it is locked for you, with their name shown, until they move on.'
      },
      {
        title: 'Dashboard',
        body: 'The Dashboard tab is where the Manage phase runs: the Architecture Dashboard, the Architecture Map, the Sovereignty Center, the Testing Log, and Analytics. The Quarterly Architecture Report and the Data Governance Review Report are its outputs.'
      },
      {
        title: 'Learn and Insights',
        body: 'Learn holds the six articles behind the program – four from Fast Company and two from I by IMD – and four books by Faisal Hoque and his co-authors. Insights gathers Faisal’s latest writing, conversations including the CONVERGENCE podcast, and work by others worth your time.'
      },
      {
        shared: 'tools',
        extra: [
          { ic: '✦ AI Guide', d: 'Bottom-right, once switched on. Answers questions about the step you are on, the five layers, and the sovereignty program. On by default; an administrator can switch it off under AI Features on the Org &amp; Team page.' },
          { ic: '☷ Report Manager', d: 'More menu. Builds printed reports from any part of the program.' },
          { ic: '▾ Save as PDF', d: 'On every output. Choose the Summary or Full version, then print or save it as a formatted document.' }
        ]
      },
      { shared: 'privacy' }
    ]
  });
})();
