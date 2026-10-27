/* ─────────────────────────────────────────────────────────────
   decision-lab/help.js — The Decision Lab's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Ported from the reference build's help modal (renderModal, case
   'help'), which hand-built the whole overlay in inline styles. Here
   it is content only: js/features/help.js renders it and owns the
   { shared: … } blocks that describe features every program has.

   Three shared blocks are used and two are deliberately left out:
     · `track` is the Enterprise programs' phase-by-phase progress
       board, and this program has no phases — the More menu does not
       offer it here either (js/nav.js);
     · `team` describes managing a roster, and a Leader account is an
       organization of one.
   The `tools` list is the shell's with this program's own two
   exports appended, because those are the only entries in that menu
   no other program has.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('decision-lab', {
    title: 'Judgment — Critical Thinking',
    intro: 'Leadership Edge · Module 1. AI makes producing effortless. The skill that matters now is deciding. This guide explains how the module is organized and how each of its surfaces works.',

    sections: [
      {
        title: 'What This Is',
        body: 'A judgment-training tool, not a decision engine. It guides you through a structured sequence that deliberately slows you down: frame the problem, argue both sides, check for biases, run a pre-mortem, make a provisional decision, face an AI-generated challenge, then make your final call. When you have lived with the decision you come back to debrief — and the lesson becomes part of your Playbook. Every decision you log is saved to your workspace as you work, so it follows you between browsers and machines.'
      },
      {
        title: 'Getting Around',
        rows: [
          { k: 'Top nav', v: 'Home · Learn · Assess · Practice · Dashboard · Insights on the left. The module switcher, your profile chip, Help, the Light/Dark toggle, Notes, and a More menu sit at the top right.' },
          { k: 'Assess', v: 'Ten scenarios that place you on five dimensions of decision style. Take it once to get a baseline; retake it later and the Dashboard compares the sittings.' },
          { k: 'Practice', v: 'The filing cabinet of your decisions. Open a folder to work one, or start a new one. This is where the eight-section flow lives.' },
          { k: 'Dashboard', v: 'Your decision profile: the revealed scores drawn from what you actually did, the patterns behind them, and the Playbook of lessons from every debrief.' },
          { k: 'Insights', v: 'A curated feed — articles, podcast episodes, videos and longer reads on judgment, bias and thinking well.' },
          { k: 'More menu', v: 'View zoom controls, Voice, Profile, Seed sample data, the two AI State exports, Export and Import state, and Reset.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Eight Sections',
        rows: [
          { k: '01 · The Problem', v: 'Frame what you are deciding, state your leaning, and check whether you have considered enough options.' },
          { k: '02 · The Case', v: 'Build the strongest argument for and against your leaning. Then take the friend test: what would you tell someone else in this position?' },
          { k: '03 · Bias Check', v: 'Three targeted checks — confirmation bias, sunk cost, and anchoring.' },
          { k: '04 · Stress Test', v: 'Name what would have to be true for you to be wrong, imagine the failure in detail, and identify the earliest warning sign you would actually notice.' },
          { k: '05 · Provisional Decision', v: 'Commit to a call, on paper, before anything challenges it.' },
          { k: '06 · The Challenge', v: 'An AI-generated challenge built from everything you have written, and your answer to it.' },
          { k: '07 · Final Call', v: 'Confirm the provisional decision or change it. Either is a result; changing your mind here is the tool working.' },
          { k: '08 · Debrief', v: 'Come back after you have lived with the decision. What you knew, what surprised you, what you would do differently. This closes the loop and writes your Playbook.' }
        ]
      },
      {
        title: 'The Practice Board',
        body: 'A decision opens on a board rather than a form. Cards are laid out in the order the thinking runs, threaded together, with the section you are working on lifted to the front. The drawers down the side move you between sections; <strong class="t-paper">Full screen</strong> takes the board out to the edges of the window. Nothing is submitted — every field saves as you leave it, and a section is marked complete when you sign it off.'
      },
      {
        shared: 'tools',
        extra: [
          { ic: '1 Export AI State 1', d: 'In the More menu. Writes your open decisions and their unanswered challenges out as a markdown file, shaped for pasting into a chat with an AI assistant.' },
          { ic: '2 Export AI State 2', d: 'In the More menu. The same for your decision profile and the patterns behind it.' }
        ]
      },
      { shared: 'privacy' }
    ]
  });
})();
