/* ─────────────────────────────────────────────────────────────
   ai-governance/help.js — Responsible AI Governance's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Ported from the reference build's help modal (Governance-app.js,
   renderModal → currentModal === 'help'), which hand-built the whole
   overlay in inline styles. Here it is content only:
   js/features/help.js renders it and owns the { shared: … } blocks
   that describe features every program has.

   Three things were deliberately NOT carried over from the reference
   copy, because they are no longer true of this program now that it
   runs on the shared shell:

     · "All data is saved locally in your browser" — the workspace is
       server-backed and team-shared here (POST /workspace, one row
       per organization per module). The sentence is corrected below
       and the shell's `privacy` block carries the full statement.
     · its Reset line said the reset "removes all team members except
       administrators" — that was the reference's own clearData(), an
       organization-wide edit made from inside one program. The shell's
       reset clears THIS program's work and keeps the team, which is
       what the shared block says.
     · its Signing In section is absent from the reference entirely;
       the shell's shared block supplies it, so the guide covers the
       sign-in this program actually has.

   Everything else is the reference's text, verbatim.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('ai-governance', {
    title: '90-Day Responsible AI Governance',
    intro: 'The gap between AI deployment and AI governance is where organizations get hurt. This framework closes that gap.',

    sections: [
      {
        title: 'What This App Does',
        body: 'A guided implementation of the 90-Day Responsible AI Governance framework from Faisal Hoque. Five phases take you from AI risk mapping through to a living governance discipline — structured forms, research-backed context panels, eighteen output documents, a live governance dashboard, and a step-aware AI Guide. Your work is saved to your organization’s shared workspace as you go.'
      },
      {
        title: 'Navigation',
        rows: [
          { k: 'Top nav', v: 'Home · Learn · Framework · Governance Dashboard · Insights (always visible). The module switcher, your profile chip, Help, the Light/Dark toggle, Team Chat, Notes and a More menu sit at the top right.' },
          { k: 'Left sidebar', v: 'Visible on Framework and Dashboard pages only. Jump directly to any phase, step, or output. Click ☰ to collapse.' },
          { k: 'Phase landings', v: 'Click a phase in the sidebar or Framework overview for progress metrics, step flow, and output links.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Five Phases',
        phases: [
          {
            n: '01', t: 'Map — Days 1–30', col: '#1E6E6E',
            steps: 'Assessment Battery · AI System Inventory · Identify Risks · Regulatory Landscape',
            out: 'Assessment Profile · Systems Inventory · Initial Risk Register · Compliance Survey',
            d: 'Run the five-section Assessment Battery. Inventory every AI system. Log risks across the risk categories, then close discovery with the rapid screen: Likelihood, Impact, and Timeframe, 1–5 each. Map the regulatory landscape.'
          },
          {
            n: '02', t: 'Build — Days 31–50', col: '#8B4513',
            steps: 'Responsible AI Framework · Ownership &amp; Structure · Risk Review Cadence · Compliance Catalog · Assessment Prioritization',
            out: 'Responsible AI Principles · RACI Matrix · Governance Systems Report · Compliance Obligations',
            d: 'Stand up the Responsible AI Review Board and author the register of Responsible AI principles. Assign governance ownership via the RACI matrix. Set the New Risk Review cadence with its rescan. Itemize obligations for the regimes that need it. Then make the selection: every considered risk gets a decision — advance under a named owner, or defer with its trigger and horizon.'
          },
          {
            n: '03', t: 'Assess — Days 51–70', col: '#C8860A',
            steps: 'Responsible AI Screening · Deepen Assessment · Testing &amp; Evidence',
            out: 'Assessed Risk Register · Testing &amp; Evidence',
            d: 'Run the Responsible AI screening on flagged cards. Deepen the assessment of every selected risk and score each afresh on Likelihood, Impact, and Timeframe (LIT 1–5). End each assessment with a classification decision: Manage, Monitor, or Archive. Build each system’s testing plan and evidence log.'
          },
          {
            n: '04', t: 'Embed — Days 71–90', col: '#3D4F5C',
            steps: 'Manage and Monitor · Finalize the Framework · Review the Systems · First Governance Review',
            out: 'Management &amp; Monitoring Plans · Governance Framework · Updated Risk Register',
            d: 'Activate the Manage portfolio: a management or monitoring plan on every arriving card. Turn the review schedule into a real meeting. Wire deployment gates into operations and review every system, writing a standing exit plan on each. Close by holding the first Governance Review.'
          },
          {
            n: '05', t: 'Govern — Ongoing', col: '#2A5A5A',
            steps: 'Governance Dashboard · Compliance Dashboard · Testing Center · Analytics',
            d: 'The standing state. The portfolios and the Governance Dashboard carry the work from here: the classification lanes, the monitoring checks, escalations, the archive, and the review rhythm. The 90 days build the foundation. The discipline continues for as long as you run AI.'
          }
        ]
      },
      {
        title: 'Risk Categories',
        body: 'The categories used to classify AI risk throughout the framework:',
        funnel: [
          { n: 'Product', c: '#C4553A', d: 'Risks to what your organization makes and delivers' },
          { n: 'Operational', c: '#3A8B8B', d: 'Risks to how your organization runs' },
          { n: 'Strategic', c: '#8B6BAE', d: 'Risks to your competitive position and market' },
          { n: 'Technological', c: '#D4963A', d: 'Risks from the technology itself' },
          { n: 'Intersectional', c: '#6B7F8D', d: 'Compound risks spanning multiple categories' },
          { n: 'Other', c: '#3D4F5C', d: 'Risks that fit none of the other categories' }
        ]
      },
      {
        title: 'LIT Scoring',
        body: 'Each risk is scored 1–5 on three dimensions in Phase 3:<br>'
          + '<strong class="t-paper">L</strong> — Likelihood (how probable)<br>'
          + '<strong class="t-paper">I</strong> — Impact (how severe)<br>'
          + '<strong class="t-paper">T</strong> — Timeframe (how imminent)<br>'
          + 'Composite = L + I + T (max 15)'
      },
      {
        title: 'The Risk Portfolios',
        body: 'Every risk moves through four portfolios. Identify holds new arrivals, each with its risk card and an advance-or-defer decision. Assess is where selected risks get their full assessment and their classification. Manage &amp; Monitor carries the working plans, one tab for managed risks and one for monitored risks. Emergency Response is the alarm lane: a risk escalates there by human decision, runs its emergency plan, and de-escalates when things are stable again. A finished risk archives from wherever it stands.'
      },
      {
        title: 'The Standing Reviews',
        body: 'Three reviews keep the discipline honest, each run from its own box on the Governance Dashboard. The New Risk Review re-scans your configured sources and decides every new arrival on the register. The Responsible AI Review Board review works the waiting screenings and reviews the principle register. The Governance Review looks at the machine itself: whether the reviews are running as planned, portfolio hygiene, and a short look back. Every run stamps the shared review log.'
      },
      {
        title: 'Systems &amp; Compliance',
        body: 'Every AI system carries its own card: description, its risks, its testing record, and a standing exit plan, with the deployment gate log and the retirement route on the card. The Compliance Dashboard tracks every regime you catalog, with NIST pre-loaded as a worked example, and the Testing Center collects the testing work in one place.'
      },
      {
        title: 'Phase Outputs',
        body: 'Each phase produces output documents accessible from the sidebar or phase landing page.',
        rows: [
          { k: 'Phase 1 — Map', v: 'Assessment Profile · Systems Inventory · Initial Risk Register · Compliance Survey' },
          { k: 'Phase 2 — Build', v: 'Responsible AI Principles · RACI Matrix · Governance Systems Report · Compliance Obligations' },
          { k: 'Phase 3 — Assess', v: 'Assessed Risk Register · Testing &amp; Evidence' },
          { k: 'Phase 4 — Embed', v: 'Management &amp; Monitoring Plans · Governance Framework · Updated Risk Register' }
        ]
      },
      {
        title: 'Phase Landing Pages',
        body: 'Click any phase header in the sidebar or the Framework overview to open its landing page. Each shows the phase description, a live progress bar with its completion percentage, metrics that link to their source step, a horizontal step flow with completion indicators, and every phase output link. The Framework tab shows the five-phase timeline grid with day ranges and step counts.'
      },
      {
        title: 'Phase 5 — Govern',
        body: 'Phase 5 is the standing state, carried by four pages. The Governance Dashboard shows the risk pipeline, the portfolios, the standing reviews, and the Data Bank of output documents. The Compliance Dashboard tracks the regimes. The Testing Center holds the testing log. Analytics charts the register, team load, and program coverage.'
      },
      { shared: 'team' },
      { shared: 'track' },
      {
        /* The shell's tool list, plus the two entries that are this program's:
           what its AI Guide knows, and the vocabulary its Voice command set
           actually ships with (Governance's own, carried over unchanged from
           the reference — item 40, family law). */
        shared: 'tools',
        extra: [
          { ic: '✦ AI Guide', d: 'Context-aware for your current step. Ask about the POSTi risk categories (Product, Operational, Strategic, Technological, Intersectional), LIT scoring, exit plans, or anything in the governance model.' },
          { ic: '◉ Voice', d: 'Hands-free navigation. Say: “learn” · “framework” · “dashboard” · “open coach” · “open notes” · “close”.' },
          { ic: '▾ Printing', d: 'Output documents and the dashboards print through their Save as PDF and Export Report controls.' }
        ]
      },
      { shared: 'privacy' }
    ]
  });
})();
