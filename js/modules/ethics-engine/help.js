/* ─────────────────────────────────────────────────────────────
   ethics-engine/help.js — Conscience's "? Help" guide
   ─────────────────────────────────────────────────────────────
   Ported from the reference build's help modal (renderModal, case
   'help'), which hand-built the whole overlay in inline styles. Here
   it is content only: js/features/help.js renders it and owns the
   { shared: … } blocks that describe features every program has.

   As in the Decision Lab's guide, two shared blocks are left out:
   `track` (this program has no phases to track, and the More menu
   does not offer it) and `team` (a Leader account is an organization
   of one).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  Modules.defineHelp('ethics-engine', {
    title: 'Conscience — Ethical Reasoning',
    intro: 'Leadership Edge · Module 4 — test your instinct before you trust it. You can find a reason for almost anything, and AI will hand you a better one on demand. So the test of a decision is not whether you can defend it; it is whether it still holds up when you examine it from the angles you would rather skip.',

    sections: [
      {
        title: 'What This Is',
        body: 'A tool for working one real situation all the way through. You lay it out plainly, name your instinct in plain words — what you actually want to do — and then put that instinct through four lenses: what it does for you, who it lands on, what rule it implies, and who it makes you. Then you argue against it, give a verdict, make the call, and come back after it plays out. Everything you write is saved to your workspace as you go, so it follows you between browsers and machines.'
      },
      {
        title: 'Getting Around',
        rows: [
          { k: 'Top nav', v: 'Home · Learn · Assess · Practice · Dashboard · Insights on the left. The module switcher, your profile chip, Help, the Light/Dark toggle, Notes, and a More menu sit at the top right.' },
          { k: 'Assess', v: 'A short battery that places you on five dimensions of ethical style, and predicts which lens is most likely to be your blind spot. Retake it later and the Dashboard compares the sittings.' },
          { k: 'Practice', v: 'The filing cabinet of your situations. Open a folder to work one, or start a new one. The Drills cabinet sits alongside it.' },
          { k: 'Drills', v: 'Short scenarios run against the same four lenses. Give a verdict, then see how it reads against the lens that broke it. Faster than a full situation and useful for keeping the habit in.' },
          { k: 'Dashboard', v: 'Your profile: the revealed scores drawn from what you actually did, how often your instinct survived the lenses, and which lens usually catches it.' },
          { k: 'Insights', v: 'A curated feed — articles, podcast episodes, videos and longer reads on judgment, moral courage and thinking well.' },
          { k: 'More menu', v: 'View zoom controls, Voice, Profile, Seed sample data, Export and Import state, and Reset.' }
        ]
      },
      { shared: 'signin' },
      { shared: 'modules' },
      {
        title: 'The Three Parts',
        rows: [
          { k: 'I · The Situation', v: 'Lay out what is happening, then name your instinct in plain words: what you actually want to do. Everything after this tests that sentence, so it is worth writing honestly rather than defensibly.' },
          { k: 'II · The Four Lenses', v: '<strong class="t-paper">Your Stake</strong> — what following the instinct gets you. <strong class="t-paper">The People</strong> — the view from the other chair, and who else it lands on. <strong class="t-paper">The Principle</strong> — the instinct written as a rule that applies to everyone, including you next time. <strong class="t-paper">Who This Makes You</strong> — the respect test: could you describe the plan in the same words to the person most affected?' },
          { k: 'III · The Call', v: 'Make the strongest case against your own instinct, give the verdict — sticking with it, adjusting it, or dropping it — and write the call. Then come back after it plays out for the look back: what happened, whether the instinct deserved the trust, and which lens caught it if it did not.' }
        ]
      },
      {
        title: 'The Practice Board',
        body: 'A situation opens on a board rather than a form. Cards are laid out in the order the thinking runs, threaded together, with the section you are working on lifted to the front. The drawers down the side move you between sections; <strong class="t-paper">Full screen</strong> takes the board out to the edges of the window. Nothing is submitted — every field saves as you leave it, and a section is marked complete when you sign it off.'
      },
      { shared: 'tools' },
      { shared: 'privacy' }
    ]
  });
})();
