/* ─────────────────────────────────────────────────────────────
   ai-culture/help.js — AI-Ready Culture's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Ported from the reference build's renderModal() help branch
   (Culture-app.js, "4 Nov 2026 (Paul): rebuilt on the family model"),
   which hand-built the overlay. Here it is content only:
   js/features/help.js renders it and owns the { shared: … } blocks
   that describe features every program has.

   Replaced by the shell's shared blocks, because on the shared shell
   they describe a different thing than the reference's text did:
   Signing In & Organizations, Track Program, the Tools list,
   Organization & Team, and Data & Privacy. Everything else is the
   reference's text, verbatim; the phase cards are its PH and
   PHASE_DESCS as of the 6 Nov 2026 port.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('ai-culture', {
    title: '90-Day AI-Ready Culture',
    intro: 'A step-by-step tool for building a culture that is ready for AI, built on Faisal Hoque’s published frameworks. This guide explains how the module is organized and how each of its surfaces works.',

    sections: [
      {
        title: 'What This Is',
        body: 'Four timed phases take you through the first 90 days, from a baseline of the culture you have to the first Culture Review. A fifth phase, Regenerate, keeps the work going after Day 90. Each phase breaks into guided steps, and the first four phases produce output documents you can print. Your progress, records, and outputs are saved to your organization’s shared workspace as you work.'
      },
      {
        title: 'Getting Around',
        rows: [
          { k: 'Top bar', v: 'Home · Learn · Framework · Culture Dashboard · Insights on the left. The module switcher, your profile chip, Help, the Light/Dark toggle, Team Chat and the More menu sit at the top right.' },
          { k: 'Left sidebar', v: 'Shows the overview, all five phases with their steps, and each phase’s outputs. Click a phase to open or close its list. « Minimize narrows the sidebar to a rail of phase numbers, » widens it again, and ☰ hides it.' },
          { k: 'Phase pages', v: 'Open a phase from the sidebar or the Framework page. Each shows the 90-day timeline, what the phase does, its video, four figures for your organization, progress through its steps, the steps themselves, and links to its outputs.' },
          { k: 'Step pages', v: 'Each step opens with a four-slide carousel: why the step matters, what you record, how to do it, and what you leave with. The “Assigned to” bar names the members who own the step. The work sits in the step’s tabs. Mark each part complete as you finish it, and the step is complete when every part is. Steps build on each other, so work them in order.' },
          { k: 'Back', v: '← Back returns you to the page you came from.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Five Phases',
        phases: [
          { n: '01', t: 'Diagnose — Days 1–30', col: '#33667E',
            steps: 'Assessment Battery · The Questionnaire · Lived Culture · AI Fears and Trust',
            out: 'Baseline Report · AI Use Inventory',
            d: 'Find out where the organization starts. You record what leaders say about culture and about AI, then what employees say and do. The result is the Baseline Report.' },
          { n: '02', t: 'Rewire — Days 31–55', col: '#8E4E6E',
            steps: 'Target Culture · Informal Power Map · Rewards and Protections · Meetings and Collaboration · Workforce Communication · The Rewiring Charter',
            out: 'Target Culture · Power Map · Rewiring Plan · Workforce Communication Plan · Rewiring Charter',
            d: 'Design the culture you want and change the rewards, protections, meetings, and messages that shape daily behavior toward it. The result is the Rewiring Charter, plus a Target Culture document and a Power Map.' },
          { n: '03', t: 'Embed — Days 56–75', col: '#47795A',
            steps: 'Recognition · Blockers · Culture Metrics · AI Deployment Reviews',
            out: 'Culture Report · Leaders and Managers · AI Deployment Review',
            d: 'Act on the rewired culture now and make the change visible. You recognize people, address blockers, take first readings, and review AI deployments. The results are the Culture Report and the Leaders and Managers document.' },
          { n: '04', t: 'Sustain — Days 76–90', col: '#5E5F8C',
            steps: 'Ownership and Cadence · Change Pacing · First Culture Review',
            out: 'Sustainment Plan · Day-90 Report',
            d: 'Decide what continues after the 90 days and set it up. You name who owns the culture system and how often each part of it runs, pace the change landing on teams, and hold the first Culture Review. The results are the Sustainment Plan and the Day-90 Report.' },
          { n: '05', t: 'Regenerate — Ongoing', col: '#8A4E63',
            steps: 'Culture Dashboard · Culture Tracker · Communication Planning Hub · Analytics',
            out: '',
            d: 'The standing part of the app, used after Day 90. It shows how lived culture compares with the target, and it supports the reviews that keep the culture current.' }
        ]
      },
      {
        title: 'Culture Dashboard',
        body: 'Culture Dashboard in the top nav opens the first page of Regenerate. The culture map shows each dimension with its baseline, latest reading, and target, and every initiative the program has put in place, agreed, or proposed. Select a type to see where it lands, hover over a square to see the initiative, and click a dimension’s box to open its records as cards. Below the map sit Target Culture, the next quarterly Culture Review, Culture at a Glance, the Team View, the Power Map, the Communication Planning Hub, Pulse rounds, the Data Bank of every output, and the Review log. Choose Summary or Full, then ▾ Save as PDF to print the culture map.'
      },
      {
        title: 'Standing Pages',
        body: 'After Day 90 the work continues on standing pages. They have no done button. Their records stay open to change.',
        rows: [
          { k: '5.2 Culture Tracker', v: 'Each dimension’s latest reading against its baseline and target, with its practice counts and status, and the culture radar. Run a pulse round from here, or start a targeted re-check of one dimension.' },
          { k: '5.3 Hub', v: 'The Communication Planning Hub: everything employees will be told about AI and their work, in date order, on one board grouped as Direction, Changes, Roles, Trust, Stories, and Progress. Add a communication, a story, or what a leader said.' },
          { k: '5.4 Analytics', v: 'Analytical signals, each linked to the page that needs attention, the culture radar over time, and how leaders and employees score each dimension, round by round.' },
          { k: 'Target Culture', v: 'Opened from the Culture Dashboard. Its tabs hold the targets and culture statement, the values and commitments, and their history.' },
          { k: 'People', v: 'People in the Program, opened from the Culture Dashboard. Its tabs cover the Power Map, Blockers, Curious Managers, Signals, Listening and Observation, Plans for Fear and Trust, Owner and Cadence, Change Load, and Teams and Roles.' },
          { k: 'AI Register', v: 'The AI Deployment Register, opened from the Culture Dashboard: every AI use and where it stands, which uses need a review, and the AI goals.' },
          { k: 'Team View', v: 'Opened from the Culture Dashboard. One team’s results, or every team at a glance.' },
          { k: 'Pulse Round', v: 'Start a round with + New round on the Culture Dashboard’s Pulse rounds card, and enter its results on the Pulse Round page, which lists every round so far.' }
        ]
      },
      {
        title: 'Culture Reviews',
        body: 'The first Culture Review is step 4.3, at Day 90. After that, the Culture Dashboard shows the next quarterly review, and ▶ Run the review opens it. The review page shows where the culture stands, then a fixed agenda. Work through each item and mark it complete, record the review’s own assessment, and Log this review. Once a year the review is annual, and its agenda adds the Drift Review and Standing Practices. Logged reviews are listed in the Review log on the Culture Dashboard.'
      },
      { shared: 'team' },
      { shared: 'track' },
      {
        title: 'Outputs & the Report Manager',
        body: 'Each of the first four phases produces output documents. They are listed under the phase in the sidebar and on the phase page, and gathered in the Data Bank on the Culture Dashboard. Every output has ▾ Save as PDF, and some offer Summary or Full. The Report Manager, in the More menu, builds a report of your own. Choose + New report, pick what it contains, and print it.'
      },
      {
        title: 'Learn and Insights',
        body: 'Learn holds the articles and books behind the program. Insights gathers Faisal Hoque’s latest writing and conversations, in three tabs: Latest Thoughts, Conversations, and Worth Your Time. Each item links to the original.'
      },
      {
        shared: 'tools',
        extra: [
          { ic: '✦ AI Guide', d: 'Bottom-right, once switched on. It knows which step you are on. Ask it about the step, the research behind it, or what to do next. On by default; an administrator can switch it off under AI Features on the Org &amp; Team page.' },
          { ic: '▧ Report Manager', d: 'More menu. Builds and prints a report of your own.' },
          { ic: '▾ Save as PDF', d: 'On every output and on the Culture Dashboard, Tracker, Hub, and Analytics pages. Prints or saves a formatted copy.' }
        ]
      },
      { shared: 'privacy' }
    ]
  });
})();
