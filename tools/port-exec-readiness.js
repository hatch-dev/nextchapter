#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   port-exec-readiness.js — lift step bodies out of the reference
   build and into the Executive Readiness module
   ─────────────────────────────────────────────────────────────
   `enterprises/dev/executive-readiness-prototype/Exec-Readiness-app.js` is a
   complete, standalone COPY of the whole application (678 KB) that
   the Executive Readiness program was built in. Everything it
   duplicates — the store, sign-in, organizations, the header, the
   sidebar, printing — is the shell's here. What we want is only the
   program: 17 step bodies, the outcome reports, the dashboard, and
   the handlers behind them.

   Two things make that a mechanical job rather than a retyping job,
   and both are why this script exists instead of a person doing it:

   1. NAMES COLLIDE. The reference defines renderStep11…renderStep44,
      and so does the Pipeline (js/steps/phase1.js), which is loaded
      for every module. 111 of the reference's top-level names are
      already taken by our shell. So a ported function cannot stay a
      global: it goes on `ER`, the one global this module owns.

   2. HANDLERS LIVE IN STRINGS. The markup is built as HTML text with
      inline onclick="saveSection('A')". Renaming the function is not
      enough — every reference to it inside an on*="…" attribute has
      to be rewritten to ER.saveSection('A') or the button goes dead
      the moment it is clicked. That is the part a human gets wrong,
      so it is done here by rule and verified by the harness.

   Usage:
     node tools/port-exec-readiness.js               # report only
     node tools/port-exec-readiness.js --emit <out>  # write the file

   Which functions get ported is the PORT list below. Extend it as
   each phase lands; the script resolves nothing automatically,
   because a wrong guess about what a step needs is worse than a
   missing name the harness will catch.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* The reference build. It lives with the other standalone review builds, one
   per program, under <role>/dev/ — served as plain files so a reviewer can
   open one cold (see .htaccess). It was `example-apps/executive-readiness/`
   until those were reorganised by role. */
const REF_DIR = path.join(ROOT, 'enterprises', 'dev', 'executive-readiness-prototype');
const REF = path.join(REF_DIR, 'Exec-Readiness-app.js');
if (!fs.existsSync(REF)) {
  console.error('the reference build is not at ' + path.relative(ROOT, REF) + '.');
  console.error('If the review builds moved again, update REF_DIR here and in tools/exec-readiness-diff.js.');
  process.exit(1);
}

/* The functions to lift, in the order they should appear. Helpers first so the
   file reads top-down. Anything named here is exposed on ER and rewritten
   inside handler strings.

   This is the ENTRY set, not the whole list: the closure below follows every
   call each of these makes — including the ones written inside onclick strings
   — and brings those across too. So naming the page-level renderers is enough;
   the several hundred helpers behind them resolve themselves. */
const PORT = [
  // ── shared helpers the reference's own shell provided ──
  'harvestFields', 'harvestOpenFields', 'taGated', 'adOtherBox', 'assessBaselineBox', 'recBox',
  'doneBtn', 'markStepComplete', 'stampStepDone', 'confirmStepDone', 'confirmSectionDone',
  /* Part S (2 Oct 2026 directive): the shell's sealSession reaches this through module.js's sealSession hook */
  'resetSessionBuffers',
  /* Field builders and completion, ported rather than borrowed. The shell's
     versions are the Pipeline's and differ where it matters: its `ta`/`sel`
     save through fldSave() on every keystroke against Pipeline-specific id
     prefixes (which would silently drop every ER field), while the reference
     harvests the open page on navigation instead; and its isStepDone() has no
     individual-track branch, so the four per-leader steps would read as done
     for the whole organization. `likert` is identical but comes across anyway —
     it writes likSet( into an onclick string, and that has to land on ER's
     harvest-first version rather than the Pipeline's. */
  'ta', 'sel', 'likert', 'likSet', 'isStepDone',
  'gateRepaint', 'mfPersistFields', 'crPersistFields',
  /* The page frames. renderStep is the step shell every step body sits in — the
     two step-nav strips, the pips, the Individual/Collective tags, the step
     carousel, the assignment bar, the milestone and the prev/next footer. */
  'renderStep', 'renderStepContent', 'renderOutcomePage',
  'vp', 'stepAssignBar', 'milestone',
  /* The step carousel's frame and its colour. Both differ from the shell's by
     one detail each, and both details are this program's:

       vpCarousel     strips /^(V|ARCH|ER)-/ off the code to get the step id;
                      the shell's strips /^V-/ only. This program's codes are
                      'ER-1.1', so under the shell's every carousel came out
                      with data-step="ER-1.1" and, because that string starts
                      with 'E', the fallback tint — gold on all seventeen steps
                      instead of the phase's teal, blue, brown and red.
       phaseColorFor  has an entry for phase 5. The shell's stops at 4 and
                      falls back, which is where the gold came from. */
  'vpCarousel', 'phaseColorFor',
  /* The Readiness tab and the four phase landings. The shell has vizTimeline
     and vizStatStrip of its own — the Pipeline's, over the Pipeline's data —
     so both come across with them. */
  'renderOverview', 'renderPhaseHome', 'vizTimeline', 'vizStatStrip',
  /* The stat strip's step denominator. The shell's mgSteps() drops phase 5 and
     counts everything else; this program's drops the four individual-track
     steps as well, because those are one leader's work and never enter an
     organization-wide count. Same name, four-step difference in the total. */
  'mgSteps',
  // ── Phase 1 · Assess ──
  'renderStep11', 'saveSection', 'renderStep12', 'renderStep13', 'renderStep14',
  // ── Phase 2 · Build ──
  'renderStep21', 'renderStep22', 'renderStep23', 'renderStep24',
  // ── Phase 3 · Develop ──
  'renderStep31', 'renderStep32', 'renderStep33', 'renderStep34_values', 'renderStep35',
  // ── Phase 4 · Embed ──
  'renderStep41', 'renderStep42', 'renderStep43', 'renderStep44',
  /* ── Phase 5 · Lead (the "Lead" tab) ──
     renderDashboard is the tab itself: the staffing stat strip, the interactive
     leadership org chart, the policies pull-outs, the L&D / My Development
     links and the program-outputs row. renderLdevHub is 5.2 and
     renderLdevDashboard is 5.3. */
  'renderDashboard', 'renderLdevHub', 'renderLdevDashboard',
  // ── The thirteen output reports ──
  'renderOutReadiness', 'renderOutInventory', 'renderOutRiskMap', 'renderOutStructure',
  'renderOutCollab', 'renderOutCompetency', 'renderOutFluency', 'renderOutDecisions',
  'renderOutMMPrinciples', 'renderOutValues', 'renderOutRhythm', 'renderOutEvalPlan',
  'renderOutReview',
  /* The sample workspace — "Aurora Windows", a 900-person window manufacturer
     early in its AI journey, with eleven named leaders, a reporting chart, a
     scored battery, competency ratings and a Phase-4 review that shows movement.
     58 KB of it, and it is this PROGRAM's sample data: the shell's seedData()
     builds the Pipeline's (ideas, projects, a capital envelope), which shares
     not one field with this document. Seeding Executive Readiness with it
     emptied the workspace and left the Pipeline's document filed under
     module='exec-readiness'. */
  'seedData',
  /* ── The 16 September 2026 directive: printed documents, the record
     tables, the org-chart pages and the Report Manager ──
     Most of it arrives on its own — the closure walks out of the output
     renderers and the Phase 5 pages and picks up printDocument, the ly*
     engine, the er* builders and the whole rc* family. These five have
     to be asked for by name, and each for a different reason.

       renderReports    the Report Manager is a PAGE, reached from the
                        More menu. Nothing the closure already has calls
                        it, so without this line the page is generated
                        for nobody and go('reports') lands on a blank
                        screen. module.js registers it in `pages`.

       printPage        SHADOWED, and this is the one shadow that now
                        matters. The shell's prints the LIVE document,
                        which is what this program wanted until 12 Sep.
                        The reference's is now four lines that route
                        through printDocument() — cover, stripped body,
                        footer on every page. Leave it to the shell and
                        every "Save as PDF" in the program quietly goes
                        back to printing the screen, with no error and a
                        plausible-looking result. That is the whole
                        directive bypassed by one name.

       renderMgmtHub    Track Program. The shell's version (the
       mgmtHubContent   Pipeline's, js/pages/navigate.js) draws its own
       printMgmtAnalytics  body and prints it through printPage. Step 65
                        makes this program's print a Module Management
                        DOCUMENT via mgmtHubDoc(), and steps 64/65 are
                        only reachable if the page and its print button
                        are this program's. Same shape as Governance,
                        which registers its own 'mgmt-hub'. */
  'renderReports', 'printPage',
  'renderMgmtHub', 'mgmtHubContent', 'printMgmtAnalytics'
];

/* Module-level `var`s the reference declares outside any function and the
   ported code reads. They are not functions, so the function extractor cannot
   see them, and an undeclared read is a ReferenceError the moment a handler
   runs — which is how the first pass produced a step that rendered perfectly
   and threw "__adoptHarvestOnly is not defined" on Save.

   Declared, deliberately unassigned. __adoptHarvestOnly narrows harvestFields
   to a single field during the reference's adoption render; nothing here
   triggers that path, and `undefined` is exactly the value that makes
   harvestFields collect every field, which is the behaviour we want. */
const STATE = ['__adoptHarvestOnly'];

/* Data blobs to lift even though the shell declares something of the same name.
   The auto-discovery below leaves a shell-owned name alone, which is right for
   `data` and `UI` and wrong for both of these — they are the two places where
   the shell's variable holds the PIPELINE's content under keys identical to this
   program's, so nothing about the wrong one looks wrong:

     CAROUSEL_CONTENT  the four Why/What/How/Outcome slides above every step
                       body, keyed '1.1', '2.3' … Left to the shell's, every
                       Executive Readiness step showed the Pipeline's slides.
     STEP_FLOW         the tick row on a phase landing, keyed 1–4. Left to the
                       shell's, Phase 1 read "Assess → Brainstorm → Filter"
                       instead of "Assess → Landscape → Risks".

   Both are reported by the SHADOWED VARS line below if this list ever loses
   them. */
const PORT_VARS = ['CAROUSEL_CONTENT', 'STEP_FLOW'];

/* Names the ported code calls that belong to the SHELL, not to ER. Listed so
   the rewriter leaves them alone — getting this wrong would send a shell call
   through ER and break it.

   Kept deliberately short. A name only belongs here when the shell's version
   IS the reference's (esc, card, val, saveData, lockBlocked, paintGates …) or
   is the shell's own chrome that the reference had a local equivalent of and
   we want the shell's (go, backBtn, render, alert). Everything else the
   reference defines comes across, even when the two look alike — see the note
   on `likert` above for why "looks alike" is not good enough. */
const SHELL_GLOBALS = new Set([
  'esc', 'card', 'btn', 'badge', 'val', 'saveData', 'render', 'go', 'goBack',
  'backBtn', 'lockBlocked', 'gatePeek', 'paintGates', 'deferRender',
  'alert', 'confirm', 'showToast', 'notifyStepComplete', 'stepCompleteLock', 'completeBlocked',
  'fmtDate', 'uid', 'assignBtn', 'toggleSidebar', 'openModal',
  'closeModal', 'getCurrentUser', 'getOrg',
  /* Reviewed and left with the shell on purpose. Each of these differs from the
     reference's, and in each case the difference is the shell's — the suite's
     avatar, its print stylesheet, its carousel frame, its assignment control,
     its session. Listed here rather than left to the SHADOWED report so that
     report stays a list of things to look at. */
  'userAv', 'printThemeTokens'
]);

/* ── The lexer ─────────────────────────────────────────────────
   Everything below reads JavaScript, and every one of these jobs — find the end
   of a function, find the end of a var initialiser, find the calls, find the
   handler strings — is wrong if it cannot tell code from a string from a comment
   from a regex.

   Five hand-rolled scanners used to do it, each tracking quotes and comments its
   own way, and all five shared the same two blind spots:

     `https://…` inside a string.  Scanning for `//` without knowing you are
     inside a string reads the rest of the line as a comment. In a generated file
     whose lines run to tens of thousands of characters, that discards whole
     functions. This is what hid periodCompare: practiceRollover calls it on a
     line the scan had already thrown away, so nothing ever asked for it, and
     the L&D Hub died on open with a clean report behind it.

     /["']/  a regex literal containing a quote. Treat it as code and the quote
     opens a string that never closes, and the scan is lost from there on.

   So: lex once, into a SKELETON — the same string, same length, with every
   comment, string body and regex body blanked to spaces. Offsets still line up
   with the original, so anything found in the skeleton can be sliced out of the
   real source. Brace scanning, semicolon scanning and call-finding all run on
   the skeleton and cannot desynchronise, and the string bodies come back
   separately for the jobs that want exactly those.

   Not a parser. It does not need to be: it needs to know which characters are
   code, and it is right about that. */
const REGEX_AFTER_CHAR = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '\n', '']);
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'instanceof']);

function lex(src) {
  const out = new Array(src.length).fill(' ');
  const strs = [];                       // [start, end) of each string BODY
  let i = 0, prevChar = '', prevWord = '';
  const keep = k => { out[k] = src[k]; };

  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i); i = e < 0 ? src.length : e + 2; continue;
    }
    /* A leading `/` is a regex only where an expression may start. Everywhere
       else it is division, and consuming `a / b … / c` as a literal would blank
       real code. */
    if (c === '/' && (REGEX_AFTER_CHAR.has(prevChar) || REGEX_AFTER_WORD.has(prevWord))) {
      let j = i + 1, esc = false, inClass = false, ok = false;
      for (; j < src.length; j++) {
        const d = src[j];
        if (esc) { esc = false; continue; }
        if (d === '\\') { esc = true; continue; }
        if (d === '[') { inClass = true; continue; }
        if (d === ']') { inClass = false; continue; }
        if (d === '\n') break;                       // unterminated → it was division
        if (d === '/' && !inClass) { ok = true; break; }
      }
      if (ok) {
        keep(i); keep(j);                            // delimiters stay, body blanked
        i = j + 1;
        while (i < src.length && /[gimsuyd]/.test(src[i])) { keep(i); i++; }
        prevChar = '/'; prevWord = ''; continue;
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, esc = false;
      for (; j < src.length; j++) {
        const d = src[j];
        if (esc) { esc = false; continue; }
        if (d === '\\') { esc = true; continue; }
        if (d === c) break;
      }
      keep(i); if (j < src.length) keep(j);
      strs.push([i + 1, Math.min(j, src.length)]);
      i = j + 1; prevChar = '"'; prevWord = ''; continue;
    }

    keep(i);
    if (!/\s/.test(c)) {
      prevChar = c;
      prevWord = /[A-Za-z0-9_$]/.test(c) ? prevWord + c : '';
    } else if (c === '\n') prevChar = '\n';
    i++;
  }
  return { skel: out.join(''), strs };
}

/* The skeleton of a chunk, and the text of its string bodies. */
function skeletonOf(code) { return lex(code).skel; }
function stringsOf(code) {
  const { strs } = lex(code);
  return strs.map(([a, b]) => code.slice(a, b)).join('\n');
}

/* ── Extraction ────────────────────────────────────────────────
   A brace scan over the skeleton, not a regex over the source: these function
   bodies are full of braces inside CSS strings and character classes, and a
   naive match truncates them silently — a file that parses and renders half a
   step. */
function extract(src, name, skel) {
  skel = skel || skeletonOf(src);
  const start = skel.search(new RegExp('^function\\s+' + name + '\\s*\\(', 'm'));
  if (start < 0) return null;
  let i = skel.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  for (; i < skel.length; i++) {
    if (skel[i] === '{') depth++;
    else if (skel[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

/* ── Data blobs ────────────────────────────────────────────────
   The step carousels, the values-architecture domain colours, the practice
   keys, the individual-track step map: content and lookup tables the reference
   declares as top-level `var`s. extract() only sees functions, so without this
   they vanish — and a missing one is not a parse error, it is a page that
   renders down to the line that reads it and then dies. That is exactly what
   the previous pass shipped: renderDashboard came across reading DOMAIN_COL
   and writing _orgTaggedValues, and neither was ever declared.

   CAROUSEL_CONTENT is the one that matters most for correctness rather than
   crashes. The shell has a variable of that name too — the Pipeline's step
   carousels — and its step ids are '1.1', '2.3' … the same keys. Left to the
   shell's, every Executive Readiness step would have quietly displayed the
   Pipeline's slides.

   Scan to the semicolon that closes the initialiser, tracking nesting, for the
   same reason extract() scans braces: these literals are full of semicolons
   inside CSS strings and prose. */
function extractVar(src, name, skel) {
  skel = skel || skeletonOf(src);
  const start = skel.search(new RegExp('^var\\s+' + name + '\\s*=', 'm'));
  if (start < 0) return null;
  let i = skel.indexOf('=', start) + 1;
  let depth = 0;
  for (; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/* Every top-level `var` a file declares, so a ported body's reads can be matched
   against a known set rather than guessed at.

   Brace depth, not column position. Anchoring to the start of a line looks
   equivalent and is not: the reference is half hand-written and half minified,
   so plenty of function-local declarations begin at column 0 too. That reading
   offered up `h`, `rows`, `sd`, `today` and thirty more as program content. */
function topLevelVars(src) {
  const skel = skeletonOf(src);
  const out = [];
  let depth = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (depth !== 0 || c !== 'v') continue;
    const m = /^var\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(skel.slice(i, i + 80));
    if (m && !/[A-Za-z0-9_$.]/.test(skel[i - 1] || ' ')) out.push(m[1]);
  }
  return out;
}

/* ── Handler rewriting ─────────────────────────────────────────
   A ported name needs the ER prefix wherever it is written as TEXT that the
   browser will later evaluate, and nowhere else.

   Scoping this to on*="…" attributes is not enough, and that is the trap: this
   codebase also passes handler expressions as STRING ARGUMENTS —
   doneBtn('saveSection(\\'A\\')', …) and btn(label, 'markStepComplete(\\'1.1\\')')
   build the onclick themselves. Miss those and the page renders perfectly and
   every button is dead.

   So the rule is "inside a string literal". That is exactly the set of places a
   name is code-to-be-evaluated-later rather than a call resolved right now:
   outside strings these functions are in scope inside the IIFE and must stay
   bare.

   The string bodies come from the lexer, so an apostrophe in prose
   ("organization's") and a quote inside a regex both land where they belong. */
function rewriteHandlers(code, names) {
  const set = new Set([...names].filter(n => !SHELL_GLOBALS.has(n)));
  const call = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  const fix = s => s.replace(call, (m, fn) => set.has(fn) ? 'ER.' + fn + '(' : m);

  // Back to front, so an earlier rewrite cannot shift a later range's offsets.
  const { strs } = lex(code);
  let out = code;
  for (let k = strs.length - 1; k >= 0; k--) {
    const [a, b] = strs[k];
    out = out.slice(0, a) + fix(out.slice(a, b)) + out.slice(b);
  }
  return out;
}

/* ── Media paths ───────────────────────────────────────────────
   The reference was a flat folder: its videos sat beside index.html, so the
   markup says src="Phase Five The Leadership System.mp4". Here the same files
   live under assets/media/exec-readiness/ and every relative URL resolves
   against <base href="/apps/">, so a bare filename 404s — a video element that
   renders as a black box with no error anywhere. Rewritten by rule for the same
   reason handler names are: it is mechanical, and a person doing it by hand
   would miss the one occurrence in a 100 KB generated file.

   Only bare names are touched. Anything already carrying a path (or a data:/
   http: URL) is left exactly as it is. */
const MEDIA_PREFIX = 'assets/media/exec-readiness/';
const MEDIA_EXT = 'mp4|jpg|jpeg|png|webm|webp|svg';
function rewriteMedia(code) {
  return code
    /* The dev build's own paths, walked back to the module's. The review copy
       is served from enterprises/dev/executive-readiness-prototype/, so its markup points
       at ../../../assets/media/exec-readiness/ — a path, which means the two
       rules below pass it through untouched. It then resolves against
       <base href="/apps/"> as /assets/... and 404s as a silent black box, the
       exact failure those rules were written to stop. Only this one folder is
       walked back; anything else carrying a path is still left alone. */
    .replace(new RegExp('(?:\\.\\./)+' + MEDIA_PREFIX.replace(/[-/]/g, '\\$&'), 'g'), MEDIA_PREFIX)
    // src="Phase Five The Leadership System.mp4" — written straight into markup
    .replace(new RegExp('(src=")([^"/:]+\\.(?:' + MEDIA_EXT + '))(")', 'g'),
      (m, a, file, b) => a + MEDIA_PREFIX + file + b)
    /* …and the ones assembled at runtime: `{src:'Phase One Assess.mp4'}` reaches
       the markup as '<source src="'+_pv.src+'"', which the rule above cannot
       see. A string literal that is NOTHING BUT a bare media filename is a path
       under the old flat folder — there is no other reason to write one — so it
       takes the prefix too. Anchored end to end so a sentence mentioning a file
       name is left alone. This is what sent the four phase-landing videos to a
       404 that renders as a black box with nothing in the console. */
    .replace(new RegExp("(['\"])([^'\"/:]+\\.(?:" + MEDIA_EXT + '))\\1', 'g'),
      (m, q, file) => q + MEDIA_PREFIX + file + q);
}

/* ── Behaviour the reference build never had ───────────────────
   The reference was a standalone copy of the app with no team model in it, so
   nothing in it knows about step assignments. Here they exist and they mean
   something: assignment names who is responsible for finishing a section, and
   only they — or an administrator — may sign it off. The shell enforces that
   for the Pipeline inside doneBtn(); Executive Readiness's doneBtn came from
   the reference and enforced nothing, so any member could mark any step
   complete.

   Grafted in by rule rather than by hand, for the same reason handler names
   and media paths are: steps.js is regenerated and a hand-edit would be lost.
   Anchored on the exact line that builds the enabled button — if the reference
   ever changes that line the patch stops matching, and applyPatches() fails
   loudly rather than silently shipping an unenforced program.

   The check is against currentStep, so every section and tab of a step follows
   that step's assignment — the same rule the shell states for step 1.1. The
   individual-track steps (1.4, 2.4, 3.5, 4.4, 5.x) are never assignable in the
   first place: renderStep leaves them out of the assignment bar, so they have
   no assignees and stepCompleteLock returns '' — one leader's own work stays
   theirs to finish. */
const PATCHES = [{
  name: 'doneBtn honours the step assignment',
  in: 'doneBtn',
  /* Anchored on the code, with no leading whitespace: this runs on the body as
     extracted, before the emitter indents it. */
  /* Re-anchored 18 Aug 2026: the reference build is space-formatted, so the
     unspaced form this used to carry stopped matching. */
  after: "var helperMsg = (typeof sectionComplete === 'string') ? sectionComplete : 'Complete required fields (*) first.';",
  insert:
    "\n  /* PORTED-IN (tools/port-exec-readiness.js): a section assigned to someone"
    + "\n     else is not this reader's to sign off. Outranks the required-fields gate"
    + "\n     — telling a member to fill in fields they are not responsible for is a"
    + "\n     dead end. Admins are never blocked. */"
    + "\n  var _lock=(typeof stepCompleteLock==='function')?stepCompleteLock(currentStep):'';"
    + "\n  if(_lock){disabled=true;helperMsg=_lock;}"
}, {
  /* Ruled 9 Sep 2026. doneBtn above only PAINTS the rule — it greys the
     button out. Every sign-off actually goes through confirmStepDone /
     confirmSectionDone (markStepComplete calls the first thing), so the
     refusal has to sit there or a member can still complete a step that
     is not theirs, and a step nobody is assigned to is the
     administrator's.

     These two guards were in the generated steps.js and NOT in the
     reference build, which means they had been put into the emitted file
     rather than into this list — and regenerating on 17 Sep 2026 silently
     dropped them. tools/exec-readiness-smoke.js caught it with three
     SIGNOFF lines. They live here now, where a refresh cannot lose them.
     See the same note in port-ai-governance.js. */
  name: 'confirmStepDone refuses a step that is not this member\'s',
  in: 'confirmStepDone',
  after: "if ((data.completedSteps || {})[sid]) return true;",
  insert: " if (typeof completeBlocked === 'function' && completeBlocked(sid)) return false;"
}, {
  name: 'confirmSectionDone refuses a section that is not this member\'s',
  in: 'confirmSectionDone',
  after: "if ((data.completedSections || {})[s]) return true;",
  /* Sections A-E belong to step 1.1; anything else is already a step id. */
  insert: " if (typeof completeBlocked === 'function' && completeBlocked(/^[A-E]$/.test(String(s)) ? '1.1' : s)) return false;"
}];

function applyPatches(bodyOf) {
  PATCHES.forEach(p => {
    const code = bodyOf.get(p.in);
    if (code === undefined) throw new Error('patch "' + p.name + '": ' + p.in + ' is not being ported');
    const at = code.indexOf(p.after);
    if (at < 0) {
      throw new Error('patch "' + p.name + '": anchor not found in ' + p.in
        + '. The reference build changed; re-read it and update the patch.');
    }
    if (code.indexOf(p.after, at + 1) >= 0) {
      throw new Error('patch "' + p.name + '": anchor is ambiguous in ' + p.in + ' (matches more than once).');
    }
    const end = at + p.after.length;
    bodyOf.set(p.in, code.slice(0, end) + p.insert + code.slice(end));
  });
}

/* ── Page ids ──────────────────────────────────────────────────
   The reference called the program-overview page 'readiness' and the phase
   landing 'phaseHome'. Our shell's route table — and the tab labels in
   config/catalogue.json — call them 'pipeline' and 'phase', the names every
   module shares. The label the reader sees is still "Readiness"; only the
   internal id differs.

   go('readiness') would sail straight through the shell's go(): it matches no
   step, no outcome and no phase pattern, so currentPage is set to a name
   render() has no branch for, and the reader gets a blank screen with nothing
   in the console. Rewritten by rule, as a whole quoted word so prose about
   "readiness" is untouched. */
const PAGE_IDS = { readiness: 'pipeline', phaseHome: 'phase' };
function rewritePages(code) {
  return code.replace(/(['"])(readiness|phaseHome)\1/g, (m, q, id) => q + PAGE_IDS[id] + q);
}

/* ── What our shell already provides ───────────────────────────
   Read, not assumed: the shell is 1600-odd functions and a stale hand-list
   would silently re-port something that already exists, shadowing the real
   one. Anything named in PORT overrides this — that is how doneBtn comes from
   the reference (its signature differs from ours) rather than from the shell. */
function shellProvides() {
  const files = ['js/app.js', 'js/auth.js', 'js/nav.js', 'js/home.js', 'js/learn.js',
    'js/insights.js', 'js/screen-loader.js', 'js/router.js', 'js/launchpad.js',
    'js/pages/navigate.js', 'js/steps/phase1.js', 'js/steps/phase2.js',
    'js/steps/phase3.js', 'js/steps/phase4.js', 'js/dev/seed.js',
    'js/features/assignments.js', 'js/features/my-assignments.js',
    'js/features/budget.js', 'js/features/charts.js',
    'js/features/chat.js', 'js/features/coach.js', 'js/features/email.js',
    'js/features/help.js', 'js/features/notes.js', 'js/features/org-admin.js',
    'js/features/sidebar.js', 'js/features/voice.js'];
  const names = new Set();
  files.forEach(f => {
    let s = '';
    try { s = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return; }
    (s.match(/^\s*function\s+([A-Za-z0-9_$]+)/gm) || []).forEach(m => names.add(m.trim().split(/\s+/)[1]));
    (s.match(/^\s*var\s+([A-Za-z0-9_$]+)\s*=\s*function/gm) || []).forEach(m => names.add(m.trim().split(/\s+/)[1]));
    /* The shell's own globals — data, UI, Store, PH, currentOrgId, USERS … The
       reference declares all of those too, and every one of them must stay the
       shell's: a second `data` inside the module's IIFE would shadow the real
       workspace and quietly collect edits nothing ever saves. */
    topLevelVars(s).forEach(v => names.add(v));
  });
  return names;
}

/* Identifiers a chunk of code calls, ignoring property access (a.foo()).
   Comments are dropped; STRING CONTENTS ARE NOT.

   That is the whole point. Half this codebase's calls are written as text —
   onclick="saveSection('A')", doneBtn('markStepComplete(\\'1.1\\')', …) — and a
   walker that strips strings is blind to every one of them. The first version
   of this script did strip them, which is why PORT carried a hand-written list
   of eighteen handler names underneath renderDashboard: someone had to read
   the markup and find them. Miss one and the page renders perfectly with a
   dead button, so the list was the bug surface, not the safety net.

   Scanning strings over-collects — prose that happens to read "…judgment (the"
   yields "judgment" — but every candidate is then checked against the
   reference with extract()/extractVar(), and a word that names nothing there
   is dropped. Over-collecting costs nothing; under-collecting ships dead
   buttons. */
/* Lookbehind, not a captured leading character. Capturing it CONSUMES it, and
   the next match then has nothing in front of the name to match against — so in
   `if(periodCompare(cur))` the scan takes `if(` and never sees periodCompare at
   all. Every nested call in the codebase was invisible: f(g(x)) yielded only f.
   That is how the L&D Hub shipped calling a function nobody had ported. */
const CALL_RE = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
function namesOf(text) {
  const out = new Set();
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(text))) out.add(m[1]);
  return out;
}
function callsIn(code) {
  const { skel, strs } = lex(code);
  const text = skel + '\n' + strs.map(([a, b]) => code.slice(a, b)).join('\n');
  return namesOf(text);
}
/* Just the calls in real code — the audit's first question. */
function callsInCode(code) { return namesOf(skeletonOf(code)); }
/* Just the calls written inside strings — the audit's second. */
function callsInStrings(code) { return namesOf(stringsOf(code)); }

/* Whole-word reads of a name anywhere in a chunk of code, strings included —
   how a data blob is spotted. `DOMAIN_COL[v.domain]` is a read, not a call, so
   callsIn() never sees it. */
function reads(code, name) {
  return new RegExp('(?<![A-Za-z0-9_$.])' + name + '(?![A-Za-z0-9_$])').test(code);
}

/* ── Run ───────────────────────────────────────────────────────── */
const src = fs.readFileSync(REF, 'utf8');
const SHELL = shellProvides();
const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return',
  'typeof', 'new', 'var', 'else', 'do', 'in', 'of', 'delete', 'void', 'case', 'throw']);

/* Transitive closure. Porting only what is asked for is how the first pass
   shipped a harvestFields that called __adoptHarvestOnly — a function nobody
   had brought across. The step rendered perfectly and the Save button threw
   the moment it was pressed, which is exactly the failure a generated port is
   supposed to make impossible. So: pull what is asked for, then keep pulling
   whatever that calls, until nothing is left dangling. */
const REF_VARS = new Set(topLevelVars(src));
const bodyOf = new Map();
const varOf = new Map();
const missing = [];
const shadowed = new Set();     // functions in BOTH the reference and the shell
const shadowedVars = new Set(); // data blobs likewise — see PORT_VARS
const queue = PORT.slice();
const requested = new Set(PORT);
const pulledIn = [];

PORT_VARS.forEach(v => {
  const blob = extractVar(src, v);
  if (blob) varOf.set(v, blob); else missing.push(v);
});

function want(dep) {
  if (bodyOf.has(dep) || varOf.has(dep)) return;
  if (queue.includes(dep)) return;
  if (JS_KEYWORDS.has(dep) || SHELL_GLOBALS.has(dep)) return;
  if (SHELL.has(dep) && !requested.has(dep)) {
    /* The shell has this name and we are letting it win. Harmless when the two
       are the same function; a silent behaviour swap when they are not — the
       Pipeline's renderStep12 answering for Executive Readiness, say. Recorded
       so the report can name every one of them rather than leaving it to
       whoever notices the wrong screen. */
    if (extract(src, dep)) shadowed.add(dep);
    return;
  }
  if (extract(src, dep)) queue.push(dep);
}

while (queue.length) {
  const name = queue.shift();
  if (bodyOf.has(name)) continue;
  const code = extract(src, name);
  if (!code) { missing.push(name); continue; }
  bodyOf.set(name, code);
  if (!requested.has(name)) pulledIn.push(name);
  callsIn(code).forEach(want);

  /* Data blobs the body reads. Checked against the reference's own top-level
     var names, so this cannot invent one, and against the shell's — a name the
     shell already declares (data, UI, carouselState, ORG_PALETTE) stays the
     shell's, which is right for state and wrong for content. Every such
     collision is reported; PORT_VARS is how one gets overridden. */
  REF_VARS.forEach(v => {
    if (varOf.has(v) || SHELL_GLOBALS.has(v) || STATE.indexOf(v) >= 0) return;
    if (!reads(code, v)) return;
    if (SHELL.has(v)) { shadowedVars.add(v); return; }
    const blob = extractVar(src, v);
    if (blob) varOf.set(v, blob);
  });
}

/* A blob can name functions of its own (a carousel slide with an onclick), and
   one blob can read another. One settling pass covers both; the reference has
   no deeper chain than that, and a second round would report nothing. */
[...varOf.values()].forEach(blob => {
  callsIn(blob).forEach(want);
  REF_VARS.forEach(v => {
    if (varOf.has(v) || SHELL_GLOBALS.has(v) || STATE.indexOf(v) >= 0) return;
    if (!reads(blob, v)) return;
    if (SHELL.has(v)) { shadowedVars.add(v); return; }
    const b = extractVar(src, v);
    if (b) varOf.set(v, b);
  });
});
while (queue.length) {
  const name = queue.shift();
  if (bodyOf.has(name)) continue;
  const code = extract(src, name);
  if (!code) { missing.push(name); continue; }
  bodyOf.set(name, code);
  if (!requested.has(name)) pulledIn.push(name);
  callsIn(code).forEach(want);
}

/* ── A table that is FILLED after it is declared ────────────────
   `var <name> = <initialiser>;` is not always the whole table. A
   declaration can be populated by a SEPARATE top-level statement, and an
   emitter that writes only the declaration drops it without a word. The
   16 September 2026 directive brought four of them:

     var LAYER_MAPS={};
     LAYER_MAPS.leader={…}  LAYER_MAPS.leaderFluency={…}  LAYER_MAPS.lrisk={…}

     var PRINT_DOCS={…};  var ER_SINGLE_DOCS={…};
     Object.keys(ER_SINGLE_DOCS).forEach(function(k){PRINT_DOCS[k]=ER_SINGLE_DOCS[k]});

   None of them throws, which is what makes this the worst shape of
   failure available. LAYER_MAPS empty IS the reporting engine: lyRender()
   opens with `var map=LAYER_MAPS[type];if(!map||!rec)return ''`, so every
   register, every record table and every single-record section of a
   compiled report prints a heading over nothing — while every page still
   renders and every handler still resolves, so the smoke passes.

   The same rule port-ai-governance.js carries, and for the same reason;
   this script keeps its own copy of the machinery on purpose (see the
   header of tools/lib/js-port.js), so it needs its own copy of this too.

   The rule: a depth-zero statement that ASSIGNS INTO a ported var —
   `V.x =`, `V[k] =`, never `==`/`===`/`=>` — belongs to that var and is
   emitted with it. A WRITE, not a mention, so a forEach that reads one
   table to fill another is attributed to the one it writes. Tested on the
   skeleton, so a match inside a string or a comment cannot count. */
const REF_SKEL = skeletonOf(src);
const topLevelStatements = (() => {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < REF_SKEL.length; i++) {
    const c = REF_SKEL[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if ((c === ';' || c === '\n') && depth === 0) {
      const text = src.slice(start, i + 1);
      if (text.trim() && text.trim() !== ';')
        out.push({ at: start, text: text.trim(), skel: REF_SKEL.slice(start, i + 1) });
      start = i + 1;
    }
  }
  return out;
})();

function fillsFor(names) {
  const out = [];
  (names || []).forEach(v => {
    const write = new RegExp('(?<![A-Za-z0-9_$.])' + v
      + '\\s*(?:\\[[^\\]]*\\]|\\.[A-Za-z_$][A-Za-z0-9_$]*)+\\s*=(?![=>])');
    topLevelStatements.forEach(s => {
      if (/^(?:\/\*|\/\/|function\s|var\s)/.test(s.text)) return;   // a declaration, not a fill
      if (!write.test(s.skel)) return;
      if (out.some(f => f.at === s.at)) return;                     // one statement, one emit
      out.push({ at: s.at, text: s.text, var: v });
    });
  });
  return out.sort((a, b) => a.at - b.at);
}

/* The fills are code, and they call things. LAYER_MAPS.leader reaches
   LEADER_COMPS, LEADER_PRACTICES and REVIEW_LABELS; ER_SINGLE_DOCS names
   readinessDoc, riskMapDoc, valuesDoc and mmPrinciplesDoc — and nothing
   else in the program names any of them. The closure starts from the
   entry set and follows calls, and a fill is in neither, so the tables
   would come across complete and the functions they name would not.

   So: re-run the closure with whatever the fills call, until it stops
   growing. The bound is there so a cycle cannot spin. */
for (let round = 0; round < 8; round++) {
  const before = bodyOf.size + varOf.size;
  /* The fills AND every table currently carried. A fill can introduce a
     whole new table (ER_SINGLE_DOCS arrives because PRINT_DOCS's fill
     reads it), and that table's own initialiser names functions nobody
     else does — readinessDoc, valuesDoc, mmPrinciplesDoc. Walking only
     the fills leaves those behind, which is a table of references to
     undeclared names: it emits, it loads, and it throws the first time a
     reader asks for that document. */
  const blobs = fillsFor([...varOf.keys()]).map(f => f.text).concat([...varOf.values()]);
  blobs.forEach(text => {
    callsIn(text).forEach(want);
    REF_VARS.forEach(v => {
      if (varOf.has(v) || SHELL_GLOBALS.has(v) || STATE.indexOf(v) >= 0) return;
      if (!reads(text, v)) return;
      if (SHELL.has(v)) { shadowedVars.add(v); return; }
      const b = extractVar(src, v);
      if (b) varOf.set(v, b);
    });
  });
  while (queue.length) {
    const name = queue.shift();
    if (bodyOf.has(name)) continue;
    const code = extract(src, name);
    if (!code) { missing.push(name); continue; }
    bodyOf.set(name, code);
    if (!requested.has(name)) pulledIn.push(name);
    callsIn(code).forEach(want);
    REF_VARS.forEach(v => {
      if (varOf.has(v) || SHELL_GLOBALS.has(v) || STATE.indexOf(v) >= 0) return;
      if (!reads(code, v)) return;
      if (SHELL.has(v)) { shadowedVars.add(v); return; }
      const b = extractVar(src, v);
      if (b) varOf.set(v, b);
    });
  }
  if (bodyOf.size + varOf.size === before) break;
}

/* Grafts that the reference build has no equivalent of — applied after the
   closure has settled, so a patch can rely on its target having been pulled.
   Throws (loudly, before anything is written) if an anchor no longer matches. */
applyPatches(bodyOf);

const found = [...bodyOf.keys()];
const bodies = found.map(n => bodyOf.get(n));
const vars = [...varOf.keys()];

console.log('reference :', path.relative(ROOT, REF));
console.log('requested :', PORT.length);
console.log('pulled in :', pulledIn.length, pulledIn.length ? '(' + pulledIn.join(', ') + ')' : '');
console.log('data vars :', vars.length, vars.length ? '(' + vars.join(', ') + ')' : '');
console.log('extracted :', found.length, '(' + bodies.reduce((a, b) => a + b.length, 0) + ' bytes)');
if (shadowed.size) {
  console.log('\nSHADOWED  : the reference defines these AND so does our shell, so the');
  console.log('            shell\'s version answers. Check each one; add it to PORT if');
  console.log('            the two differ.');
  console.log('            ' + [...shadowed].sort().join(', '));
}
if (shadowedVars.size) {
  const forced = new Set(PORT_VARS);
  const open = [...shadowedVars].filter(v => !forced.has(v)).sort();
  if (open.length) {
    console.log('\nSHADOWED VARS: read by the ported code, declared by BOTH. The shell\'s');
    console.log('            value answers. Fine for shared state (data, UI); NOT fine for');
    console.log('            content — add it to PORT_VARS if it is this program\'s.');
    console.log('            ' + open.join(', '));
  }
}
if (missing.length) console.log('\nMISSING   :', missing.join(', '));

const emitAt = process.argv.indexOf('--emit');
if (emitAt < 0) { console.log('\n(report only — pass --emit <file> to write)'); process.exit(missing.length ? 1 : 0); }

const out = process.argv[emitAt + 1];
const header = `/* ─────────────────────────────────────────────────────────────
   exec-readiness/steps.js — the program's step bodies
   ─────────────────────────────────────────────────────────────
   GENERATED by tools/port-exec-readiness.js from
   enterprises/dev/executive-readiness-prototype/Exec-Readiness-app.js.
   Re-run that script rather than editing this file by hand; the
   PORT list there is what decides which functions live here.

   Everything is on ER, the single global this module owns. It has to
   be: the reference calls these renderStep11…renderStep44, and so
   does the Pipeline, whose step bodies (js/steps/phase*.js) are in
   the shell and therefore loaded for every module. Inline handlers in
   the generated markup are rewritten to match — onclick="ER.foo()".

   Shell functions (esc, card, btn, likert, val, saveData, render, go,
   isStepDone …) are used as-is; they are the same functions the
   reference had, under the same names.

   PERSISTENCE. These write to \`data\` and call saveData(), which is the
   shell's Store — POST /workspace with module=exec-readiness, straight
   to MySQL (api/sql/workspace-modules.sql). Nothing here touches
   localStorage; that is only the offline mirror underneath Store.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var ER = window.ER = window.ER || {};

  /* Module-level state the reference declares outside any function. */
${STATE.map(v => '  var ' + v + ';').join('\n')}

`;
const footer = `
  /* Everything ported is reachable from the markup above, so all of it is
     exposed. Adding a function to the PORT list is all it takes. */
${found.map(n => '  ER.' + n + ' = ' + n + ';').join('\n')}
})();
`;

const indent = s => s.split('\n').map(l => '  ' + l).join('\n');
const pass = code => indent(rewritePages(rewriteMedia(rewriteHandlers(code, found))));

/* Emitted INTERLEAVED with the declarations, each at its own offset in the
   reference, so the top-level order is the reference's own — the order that
   already works. Sorting the declarations alone is not enough: a table
   declared after a fill may read it, and a fill reads tables of its own. */
const fills = fillsFor(vars);
if (fills.length) console.log('table fills carried:', fills.map(f => f.var).join(', '));

const varBlock = vars.length
  ? '  /* Content and lookup tables the reference declares as top-level vars,\n'
  + '     lifted verbatim in the reference\'s own top-level order. The statements\n'
  + '     that FILL a table after it is declared come across with it, at their\n'
  + '     own place in that order. See the note in the port script. */\n'
  + vars.map(v => ({ at: src.indexOf(varOf.get(v)), code: varOf.get(v) }))
    .concat(fills.map(f => ({ at: f.at, code: f.text })))
    .sort((a, b) => a.at - b.at)
    .map(x => pass(x.code)).join('\n\n') + '\n\n'
  : '';

fs.writeFileSync(out, header + varBlock + bodies.map(pass).join('\n\n') + footer, 'utf8');
console.log('\nwrote', path.relative(ROOT, out), '(' + fs.statSync(out).size + ' bytes)');

/* ── Audit ─────────────────────────────────────────────────────
   Two questions, because the generated file has two kinds of call in it and
   they fail in different ways.

   1. A call in real code to a name that is declared nowhere. That is a
      ReferenceError the moment the page renders, and it will not surface until
      someone opens that exact screen. Strings are stripped for this pass:
      inside them, `rgba(`, `repeat(` and "Board (the" are not calls.

   2. A ported name still written bare inside a string. That is the dead-button
      failure the rewriter exists to prevent — the page renders perfectly and
      the handler resolves to nothing (or, worse, to the Pipeline's function of
      the same name) when it is finally clicked.

   Nothing checks for a handler naming a function that exists in neither the
   reference nor the shell, because want() pulls every string-named function
   the reference defines. Such a name could only be one the reference itself
   had no definition for, and the reference is the specification. */
const emitted = fs.readFileSync(out, 'utf8');
const declared = new Set([...found, ...vars, ...STATE]);
const BROWSER = new Set(['Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
  'RegExp', 'Error', 'Promise', 'Set', 'Map', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent',
  'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'document', 'window', 'console', 'navigator', 'location', 'Blob', 'URL', 'FileReader', 'Image',
  'getComputedStyle', 'matchMedia', 'prompt', 'escape', 'unescape', 'Intl', 'Function', 'Symbol',
  /* `new Event('input')` — the org chart's fitted-zoom control dispatches one.
     A browser constructor, not a missing declaration. */
  'Event', 'CustomEvent']);

let failed = false;
const code = skeletonOf(emitted);   // real code only — no strings, regexes or comments

/* Everything the emitted file declares at ANY depth, plus every parameter name.
   The top-level list is not enough: the reference nests freely — dueCard,
   statusDot, progressBadge and a dozen others are declared inside the function
   that uses them, and a callback arrives as a parameter. Judging scope properly
   would need a parser; "declared somewhere in this file" is the useful
   approximation, because the failure being hunted is a name declared NOWHERE. */
const inScope = new Set(declared);
(code.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g) || [])
  .forEach(m => inScope.add(m.split(/\s+/)[1]));
(code.match(/var\s+([A-Za-z_$][A-Za-z0-9_$]*)/g) || [])
  .forEach(m => inScope.add(m.split(/\s+/)[1]));
(code.match(/function[^(]*\(([^)]*)\)/g) || []).forEach(m => {
  const inner = m.slice(m.indexOf('(') + 1, -1);
  inner.split(',').forEach(p => { p = p.trim(); if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p)) inScope.add(p); });
});

const unresolved = [...callsInCode(emitted)]
  .filter(n => !inScope.has(n) && !SHELL.has(n) && !SHELL_GLOBALS.has(n)
    && !JS_KEYWORDS.has(n) && !BROWSER.has(n))
  .sort();
if (unresolved.length) {
  failed = true;
  console.log('\nUNRESOLVED: called by the generated code, declared nowhere we can see.');
  console.log('            Each is a ReferenceError on the screen that calls it.');
  console.log('            ' + unresolved.join(', '));
}

const inStrings = callsInStrings(emitted);
const bare = found.filter(n => inStrings.has(n)).sort();
if (bare.length) {
  failed = true;
  console.log('\nBARE      : ported names left unprefixed inside a string. Each is a');
  console.log('            button that renders and does nothing when clicked.');
  console.log('            ' + bare.join(', '));
}
if (failed) process.exit(1);
