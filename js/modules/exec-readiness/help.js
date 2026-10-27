/* ─────────────────────────────────────────────────────────────
   exec-readiness/help.js — Executive Readiness's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Ported from the reference build's openHelp(), which hand-built
   the whole overlay in inline styles. Here it is content only:
   js/features/help.js renders it and owns the { shared: … } blocks
   that describe features every program has.

   Two things were deliberately NOT carried over from the reference
   copy, because they are no longer true of this program now that it
   runs on the shared shell:
     · its Data & Privacy text said state lives in browser local
       storage only — the workspace is server-backed and team-shared
       here, so the shared block is used instead;
     · its Signing In section duplicated the shell's, which is now
       the single source for it.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('exec-readiness', {
    title: 'Executive Readiness Program',
    intro: 'A step-by-step tool for building AI-era leadership readiness, built on Faisal Hoque’s published frameworks. This guide explains how the module is organized and how each of its surfaces works.',

    sections: [
      {
        title: 'What This Is',
        body: 'A structured 90-day leadership program. Four sprint phases — Assess, Build, Develop, Embed — run across the 90 days, and a fifth, Lead, runs on after the sprint ends. Two tracks run in parallel inside each phase: shared organizational design and individual mindset development. Each phase breaks into guided steps, and every phase produces output documents you can print. Your progress, assessments, structures, and outputs are saved to your organization’s shared workspace as you work.'
      },
      {
        title: 'Getting Around',
        rows: [
          { k: 'Top nav', v: 'Home · Learn · Readiness · Lead · Insights on the left. The module switcher, your profile chip, Help, the Light/Dark toggle, Team Chat, Notes, and a More menu sit at the top right; Track Program lives under More.' },
          { k: 'More menu', v: 'View zoom controls, Track Program, Voice, Profile (your organization &amp; team), Seed sample data, Export and Import state, and Reset. App admins also see an Admin entry.' },
          { k: 'Left sidebar', v: 'Visible on Readiness and Lead pages. Shows all five phases, every step, the ◈ individual-track rows, and every output document. Click ☰ to show or hide it.' },
          { k: 'Phase landings', v: 'Click any phase from the sidebar or the Readiness overview. Each shows the phase intro video, live completion metrics, the full step sequence, and links to the phase outputs. Phase 5 lands directly on the Leadership Dashboard.' },
          { k: 'Step pages', v: 'Each step opens with a concept carousel that auto-advances (hover to pause), then guided work sections in tabs, each with its own discrete completion control. Every step carries an “Assigned to” bar so a named owner can take it. Steps build on each other; work them in order.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Five Phases',
        phases: [
          {
            n: '01', t: 'Assess — Days 1–25', col: '#1B6B5A',
            steps: 'Assessment Battery · Leadership Landscape · Risk Mapping · Mindset Foundations',
            out: 'Readiness Report · Leadership Inventory · Risk Map',
            d: 'Run the five-section Assessment Battery — Purpose &amp; Clarity, AI Fluency, Change Capacity, Structure Baseline, and Ethical Readiness. Map every senior leader onto the Leadership Landscape. Surface and rank the risks. Begin the individual mindset work.'
          },
          {
            n: '02', t: 'Build — Days 26–50', col: '#2D5A8E',
            steps: 'Leadership Structure Lab · AI Collaboration Lab · Competency Framework · Mindset Depth',
            out: 'Leadership Structure · Collaboration Principles · Competency Framework',
            d: 'Design the governance architecture across five surfaces: transformation ownership, board governance, senior leadership, middle management, and cross-functional coordination. Define the seven-competency framework and set the collaboration principles for AI-human work.'
          },
          {
            n: '03', t: 'Develop — Days 51–75', col: '#8B5E3C',
            steps: 'AI Fluency Sprint · Decision Simulations · Middle Management · Values Architecture · Mindset Application',
            out: 'Fluency Assessment · Decision Analyses · MM Principles · Values Architecture',
            d: 'Every leader uses AI personally on real work in the Fluency Sprint. Four decision simulations put judgment under pressure. Middle managers get practical workflows. The values architecture makes philosophical proficiency concrete.'
          },
          {
            n: '04', t: 'Embed — Days 76–90', col: '#9B2D3F',
            steps: 'Operating Rhythm · Evaluation &amp; Succession · First Leadership Review · Composure &amp; Resilience',
            out: 'Operating Rhythm · Evaluation Plan · Review Report',
            d: 'Install the recurring operating rhythm. Rewire evaluation and succession for AI-era capabilities. Run the first scored leadership review. Build composure and resilience practices.'
          },
          {
            n: '05', t: 'Lead — Ongoing', col: '#6B4C8A',
            steps: 'Leadership Dashboard · L&amp;D Hub · My Development',
            d: 'Manage the live leadership architecture. The Leadership Dashboard, L&amp;D Hub, and My Development persist and evolve long after the 90-day sprint ends.'
          }
        ]
      },
      {
        title: 'The Two Tracks',
        body: 'Every phase carries two kinds of work. The organizational track designs shared structures — governance, competencies, operating rhythm — and belongs to the leadership team collectively. The individual track (the ◈ rows in the sidebar) is each leader’s own mindset work: Mindset Foundations (1.4), Mindset Depth (2.4), Mindset Application (3.5), and Composure &amp; Resilience (4.4), carrying into My Development in Phase 5. The Assessment Battery serves both. Work them in parallel: organizational designs only hold if the individual capability underneath them is real. Because individual work is per leader, it never counts towards the organization-wide progress a phase reports.'
      },
      {
        title: 'The Competency Framework',
        body: 'Step 2.3 defines the seven AI-era leadership competencies the program scores against: Orchestration, Philosophical, Hybrid Teams, Change, Composure, Ecosystem, and Emotional. Leaders are scored 1–5 per competency. The scores drive the Competency Heat Map, the L&amp;D Hub’s development picture, and the First Leadership Review — hover any heat-map cell for the leader, competency, and score behind it.'
      },
      { shared: 'track' },
      {
        shared: 'tools',
        extra: [
          { ic: '◉ Voice', d: 'Executive Readiness commands: “home” · “learn” · “readiness” · “insights” · “lead” · “coach” · “help” · “stop”' },
          { ic: '✦ AI Guide', d: 'Grounded in the OPEN and CARE frameworks. Ask it about the current step, your leaders, or a decision you are weighing.' },
          { ic: '▾ Save as PDF', d: 'Covers the Readiness Report, Leadership Inventory, Leadership Structure, Competency Framework, and the rest of the phase outputs.' },
          { ic: '↕ Export / Import', d: 'In the More menu. Export downloads the organization’s state as a file; Import restores it. Useful for backups and for moving work between environments.' }
        ]
      },
      {
        title: 'The Lead Dashboard',
        body: 'Phase 5 is the module’s operations center and runs on after day 90. The Leadership Dashboard (5.1) holds the live leadership structure — an org chart of roles, boards, and occupants you can edit, zoom, view fullscreen, print, and snapshot into saved states. The L&amp;D Hub (5.2) tracks the whole team’s development practice period by period, with the competency heat map and practice health. My Development (5.3) is each leader’s personal view of the same system.'
      },
      {
        title: 'Insights',
        body: 'Curated pieces by Faisal Hoque in three tabs — Latest Thoughts (recent columns), Conversations (video conversations and talks), and Worth Your Time (recommended reading from elsewhere). Every card opens at the source in a new tab.'
      },
      { shared: 'team' },
      { shared: 'privacy' }
    ]
  });
})();
