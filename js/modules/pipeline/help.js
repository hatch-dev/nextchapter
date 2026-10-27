/* ─────────────────────────────────────────────────────────────
   pipeline/help.js — the AI Innovation Pipeline's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Content only. js/features/help.js renders it and owns the shared
   blocks referenced by { shared: '<id>' } — signing in, switching
   modules, Track Program, the toolbar, the team, data and privacy —
   so anything true of every program is written once, there.

   Section kinds: { title, body } · { title, rows } · { title, phases }
   · { title, funnel } · { shared, extra }. See help.js.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('pipeline', {
    title: '90-Day AI Innovation Pipeline',
    intro: 'A step-by-step tool for building an AI innovation pipeline, built on Faisal Hoque’s published frameworks. This guide explains how the module is organized and how each of its surfaces works.',

    sections: [
      {
        title: 'What This Is',
        body: 'Five sequential phases take you from a readiness assessment to a live portfolio under quarterly review. Each phase breaks into guided steps, and every phase produces output documents you can print. Your progress, ideas, assessments, and outputs are saved to your organization’s shared workspace as you work.'
      },
      {
        title: 'Getting Around',
        rows: [
          { k: 'Top nav', v: 'Home · Learn · Pipeline · Navigate · Insights on the left. The module switcher, your profile chip, Help, the theme toggle, Team Chat, Notes, and a More menu sit at the top right; Track Program lives under More.' },
          { k: 'More menu', v: 'View zoom controls, Light/Dark mode toggle, Voice, Profile (your organization &amp; team), two sample-data seeds (a day-70 program and a year-two portfolio), and Reset. App admins also see an Admin entry that opens the management panel.' },
          { k: 'Left sidebar', v: 'Visible on Pipeline and Navigate pages. Shows all five phases, every step, and every output document. Click ☰ to collapse.' },
          { k: 'Phase landings', v: 'Click any phase number in the sidebar or Pipeline overview. Shows completion %, live metrics, an intro video, the full step sequence, and links to all phase outputs.' },
          { k: 'Step pages', v: 'Each step opens with a concept carousel that auto-advances (hover to pause), guided work sections, further reading, and completion tracking. Every step carries an “Assigned to” bar so a named owner can take it. Steps build on each other. Work them in order.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Five Phases',
        phases: [
          {
            n: '01', t: 'Diagnose – Days 1–30', col: '#1B6B5A',
            steps: 'Assessment Battery · Brainstorm Use Cases · Filter &amp; Rank',
            out: 'Assessment Report · Blue Sky Portfolio',
            d: 'Run a full organizational AI readiness assessment. Surface potential use cases into a Blue Sky Portfolio. Score and rank those ideas to build a ranked shortlist.'
          },
          {
            n: '02', t: 'Organize – Days 31–50', col: '#2D5A8E',
            steps: 'Ownership &amp; Structure · Realign Incentives · Innovation Rhythm · Deepen Assessment',
            out: 'Org Readiness · RACI Matrix · Exploration Portfolio',
            d: 'Assign named owners with explicit decision authority. Align incentives to innovation behavior. Establish a weekly cadence. Run SWOT and gap analysis on selected ideas to build the Exploration Portfolio.'
          },
          {
            n: '03', t: 'Prepare – Days 51–70', col: '#8B5E3C',
            steps: 'Structure Portfolio · Plan Capacity · Allocate Capital · Map Development Track',
            out: 'Capital Snapshot · Development Portfolio',
            d: 'Sort projects by time horizon (quick win / medium / strategic). Size the multi-year capacity plan, then commit capital against it. Map each advancing project’s development track: phases with budgets, owners, success metrics, and exit gate criteria.'
          },
          {
            n: '04', t: 'Ignite – Days 71–90', col: '#9B2D3F',
            steps: 'Run Development Track · Establish Governance · Stress-Test Org Design · Portfolio Review',
            out: 'Governance Framework · Org Design Review · Updated Dev Portfolio',
            d: 'Run the development tracks and take the gate decisions as phases end. Lock in three governance mechanisms: a standing leadership agenda, portfolio ownership of all AI projects above a certain cost threshold, and a quarterly review cycle. Stress-test decision rights, ownership, and incentives. Run the first Buy / Hold / Sell review.'
          },
          {
            n: '05', t: 'Navigate – Ongoing', col: '#6B4C8A',
            steps: 'Pipeline Dashboard',
            out: 'Operational Portfolio · Capital Planning Hub',
            d: 'Manage the live pipeline. View all four stages in real time. Run the quarterly review and make Buy, Hold, or Sell decisions on every project. The engine runs continuously.'
          }
        ]
      },
      {
        title: 'The Pipeline Funnel',
        body: 'Ideas flow through four stages as they progress. Counts update in real time across the entire app.',
        funnel: [
          { n: 'Blue Sky', c: '#1B6B5A', d: 'All ideas – unscored' },
          { n: 'Exploration', c: '#2D5A8E', d: 'Selected &amp; scored' },
          { n: 'Development', c: '#8B5E3C', d: 'Funded development phases' },
          { n: 'Operational', c: '#9B2D3F', d: 'Live &amp; scaling' }
        ]
      },
      {
        title: 'How the Money Works',
        rows: [
          { k: 'Commitments', v: 'Money commits when a project advances into the Development stage. Advancing commits the project’s whole budget plan, month by month: development steps, rollout steps, and sustainment. You never type a committed total by hand. Every money surface in the app, from the ledger to the charts to the gates, reads that same monthly table.' },
          { k: 'Annual budgets', v: 'Each year of the planning period has its own budget. A breach means that at least one year’s committed plan exceeds that year’s budget. The advance gates, the chart warning, and the per-year strip all report that one test. When a breach appears, the funding plan shows how to resolve it.' },
          { k: 'Whole months', v: 'Development and rollout steps spread their cost evenly across the months they cover. If you want more granularity and variance across months, add more steps. Sustainment counts at one twelfth of its annual rate per month, starting the month after rollout ends or at the later start the budget plan sets.' },
          { k: 'Kill, pause, revive', v: 'Killing a project releases the in-window money for development phases that have not begun, along with its rollout and sustainment months. Phases already begun stay committed. Any wind-down costs you enter go to the kill &amp; phase-out pot. Pausing a project holds its full commitment in place. Reviving a killed project puts its commitment back.' },
          { k: 'Locked cost fields', v: 'While a section of a budget plan holds money, the matching simple cost field locks and reads “Derived from budget plan.” Clear that section’s money and the field is freed again.' },
          { k: 'Quarters &amp; fiscal years', v: 'Quarters count from the planning period start you set at Plan Capacity (Step 3.2). If your fiscal year begins in a different month, the selector on the review page aligns the review labels to it. That selector changes the display only. The money math never reads it.' }
        ]
      },
      {
        title: 'The Quarterly Review',
        body: 'The review runs in two places. Step 4.4 hosts the first review with teaching material around it. After that, the Portfolio Review card on the Navigate dashboard hosts it under “Run the review.” It is one surface with one state, so a decision recorded on either page is the same decision.',
        rows: [
          { k: 'What you see', v: 'The next review date, the fiscal-year selector, a Review Snapshot (Start Date Drift, Launch Variance, Overrides, Sustainment Cap, Intake Reserve), the Portfolio Balance cards, and a Portfolio Learnings card with five boxes for capturing what the cycle taught you.' },
          { k: 'Decision rows', v: 'Every project in development, every operational project, and every viable exploration project gets a row with Buy, Hold, and Sell buttons. Click the row head to expand it. The expansion is the full live portfolio card, the same one the portfolio pages use, so edits you make during the review are real.' },
          { k: 'Buy', v: 'Buy on a development project launches it when you close the review. Buy on an exploration project advances it into the Development stage at close, under the same grade and capital checks as the Advance button on its card.' },
          { k: 'Sell', v: 'Sell on a development project opens the kill confirm panel inside the expanded card. The panel shows what killing releases, what stays committed, and takes any wind-down costs for the kill &amp; phase-out pot. Sell on an exploration project kills it at once, because nothing is committed yet. Clicking an active decision again removes it. Click the green Revive button that replaces Sell to revive a killed project.' },
          { k: 'Closing', v: '“Close Review &amp; Start New Cycle” applies the Buy decisions, moves the closed review into history, and starts the next cycle.' }
        ]
      },
      {
        title: 'RACI Matrix',
        body: 'You fill in the RACI Matrix at Step 2.1 (Ownership &amp; Structure). R marks the person responsible, who does the work. A marks the person accountable, who owns the outcome, with exactly one A per activity. C marks people consulted before decisions. I marks people informed after decisions. The printable record lives under Phase 2 outputs, where an ✎ Edit toggle lets you revise the matrix in place and ▾ Save as PDF prints it.'
      },
      { shared: 'track' },
      {
        shared: 'tools',
        extra: [
          { ic: '◉ Voice', d: 'Pipeline commands: “home” · “learn” · “pipeline” · “navigate” · “help” · “open guide” · “open notes” · “close”' },
          { ic: '▾ Save as PDF', d: 'Covers the Assessment Report, Org Readiness, the four portfolios, the Capital Snapshot, the Governance Framework, and the two hubs.' },
          { ic: '↻ Sample data', d: 'Two seeds: a day-70 program mid-flight, and a year-two portfolio already under quarterly review.' }
        ]
      },
      {
        title: 'Navigate Dashboard',
        body: 'The Navigate tab is the live operations center. It shows real-time pipeline stage counts, per-portfolio views (Blue Sky, Exploration, Development, Operational, No-Go), the Capital Planning Hub, and a Data Bank linking to every phase output document. The quarterly review also runs here, inside the Portfolio Review card under “Run the review.”'
      },
      {
        title: 'Insights',
        body: 'Curated articles, essays, and podcast episodes by Faisal Hoque – sourced from Fast Company, Psychology Today, Harvard Business Review, MIT Sloan Management Review, IMD, LinkedIn, and the CONVERGENCE podcast. Use the Refresh button to pull the latest content.'
      },
      { shared: 'team' },
      { shared: 'privacy' }
    ]
  });
})();
