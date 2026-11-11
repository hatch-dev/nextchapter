#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   port-ai-culture.js — lift the AI-Ready Culture program out of its
   reference build and into a module
   ─────────────────────────────────────────────────────────────
   `enterprises/dev/culture-prototype/Culture-app.js` is a complete,
   standalone COPY of the whole application (2.2 MB, 2213 top-level
   functions) that the program was built in. Everything it duplicates
   — the store, sign-in, organizations, the admin console, the header,
   the sidebar, chat, notes, the AI Guide, voice, email notifications,
   assignments — is the shell's here. What we want out of it is only
   the program: the overview, the four phase landings, the seventeen
   step bodies, the outputs, the Phase 5 (Regenerate) pages, the Pulse
   Round and questionnaire, the culture review pages, the Report
   Manager, the management hub and the handlers behind them.

   Cloned from tools/port-ai-architecture.js (6 Nov 2026), the fourth
   port of this kind; the machinery is tools/lib/js-port.js and the
   rules below the configuration are that tool's. Two of them are
   widened for this build — see "Load-time statements" (CARRY) and
   fillsFor(): Culture fills its tables with `.push(…)`, with whole-
   table reassignments and with IIFEs, not only with `V.x = …`.

   Usage:
     node tools/port-ai-culture.js                # report only
     node tools/port-ai-culture.js --emit         # to its real path
     node tools/port-ai-culture.js --emit <file>
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const ID = 'ai-culture';
const NS = 'CUL';
const REF_DIR = path.join(ROOT, 'enterprises', 'dev', 'culture-prototype');
const REF = path.join(REF_DIR, 'Culture-app.js');
const OUT = path.join(ROOT, 'js', 'modules', ID, 'program.js');
const MEDIA = 'assets/media/' + ID + '/';

if (!fs.existsSync(REF)) {
  console.error('the reference build is not at ' + path.relative(ROOT, REF) + '.');
  console.error('If the review build moved, update REF_DIR here and in tools/ai-culture-smoke.js.');
  process.exit(1);
}

/* ── Names that stay the SHELL's ───────────────────────────────
   The same list, and the same reasons, as tools/port-ai-architecture.js: this
   build is a standalone copy of the app too, so it carries a second store, a
   second identity system, a second header, a second set of floating panels and
   a second assignments model. Store / saveData, getAssigns / toggleAssign and
   clearData are the MODULE-ISOLATION boundary — see that file. */
const SHELL_GLOBALS = new Set([
  /* Core helpers the shell defines identically — read side by side, not
     assumed. `card` and the two xpand helpers are character-for-character the
     reference's; `badge` and `btn` are NOT and are ported (see PORT). */
  'esc', 'uid', '$', 'fmt', 'val', 'render', 'go', 'showToast',
  'alert', 'confirm', 'fmtDate', 'deferRender', 'syncNavHeight',
  'card', 'xpandAttr', 'xpandClick', 'hexToRgba', 'richInline', 'vpSlideIcon',
  /* Persistence and identity — the module boundary. See the note above. */
  'Store', 'Auth', 'data', 'UI', 'loadData', 'saveData', 'clearData',
  'currentUserId', 'currentOrgId', 'currentPage', 'currentStep', 'currentPhase',
  'currentModal', 'getCurrentUser', 'getOrg', 'getOrgs', 'saveOrgs',
  'setCurrentOrg', 'actorId', 'USERS', 'AUTH_ENDPOINT', 'CLAUDE_API_URL',
  'applyTeamRoster', 'orgInitials', 'userAv', 'migrateLegacyData',
  /* Export and import. Both stamp the active module and the import refuses a
     document from another one — the reference's did neither, because in a
     standalone build there was only ever one program to export. */
  'exportState', 'importState', 'applyImportedState',
  /* Sign-in, sign-up, the entry gate and the admin console: one identity for
     all twelve programs (js/auth.js, api/controllers/AuthController.php). */
  'signOut', 'doLogin', 'doSetup', 'gotoLogin', 'gotoSetup', 'gotoAdminLogin',
  'doAdminLogin', 'adminKey', 'adminCreds', 'setAdminCreds', 'findUserByLogin',
  'userExists', 'loginKey', 'renderEntry', 'renderLoginScreen', 'renderSetupScreen',
  'renderAdminLogin', 'renderAdminConsole', 'enterAppAsAdmin', 'exitAdmin',
  'adminConsoleOpen', 'adminConsoleDelete', 'adminConsoleNewOrg', 'adminChangePasscode',
  'updateAdminBar', 'orgRosterPreview', 'openOrg', 'finishOrgSetup', 'persistRoster',
  'openAdmin', 'createOrg', 'switchToOrg', 'deleteOrgById', 'bootApp',
  'adminRenameOrg', 'adminOpenOrg', 'adminDeleteOrg', 'adminEditUser', 'adminAddUser',
  'adminSaveUser', 'adminCancelUser', 'adminDeleteUser', 'adminUserEditorHtml',
  'renderAdminModal', 'editProfile', 'cancelEditProfile', 'saveProfile', 'addProfile',
  'removeProfile', 'saveEnterprise', 'renderOrgModal', 'scrollEditorIntoView',
  /* Record locks and the gate paint. The shell's are the reference's, over the
     same UI keys, and they are wired to the shell's five-second change poll. */
  'lockBlocked', 'applyLockUI', 'gatePeek', 'paintGates',
  /* The header, the sidebar rail and the page chrome. */
  'toggleSidebar', 'minimizeSidebar', 'maximizeSidebar', 'toggleSidebarSize',
  'updateSidebarState', 'renderSidebar', 'activeNavPhaseId', 'toggleNavPhase', 'goPhase',
  'toggleNavMore', 'closeNavMore', 'toggleUserMenu', 'closeUserMenu',
  'setTheme', 'toggleTheme', 'setZoom', 'zoomIn', 'zoomOut', 'zoomReset', 'zoomFit',
  'openModal', 'closeModal', 'openHelp',
  /* The app's own Back stack. The shell pushes {p, s, ph} in go() and pops it
     in goBack(); the reference pushed {page, step} in its own go(), which is
     not this shape. Its go() does not come across (the module's beforeNavigate
     seam carries the parts that are the program's), so its goBack() must not
     either — it would read .page off a record that has none and go nowhere. */
  'goBack',
  /* …and the Back BUTTON with it (6 Nov 2026). The reference's backBtn() asks
     its own navHistory, which only its own go() filled; ported, that list is
     always empty and every Back button vanished. The shell's asks UI.navStack. */
  'backBtn',
  /* The floating panels: notes are rows in MySQL, the AI Guide takes its
     presets and prompt from the module, Team Chat is one channel per
     organization, voice is one recogniser for the suite. */
  'toggleNotes', 'renderNotesPanel', 'updateNotesCount', 'addNote', 'deleteNote',
  'goToNote', 'notesWhere', 'repaintOpenPanels',
  'toggleCoach', 'renderCoachPanel', 'sendCoach', 'sendCoachPreset',
  'toggleGChat', 'renderGChatPanel', 'sendGChat', 'chatArr', 'gchatInitials',
  'gchatMembers', 'gchatColor',
  'toggleVoice', '_voiceUI', '_voiceToast',
  /* Assignments and the email queue — both module-scoped server-side. See the
     note above; these are the isolation boundary, not a convenience. */
  'getAssigns', 'toggleAssign', 'assignBtn', 'stepCompleteLock', 'completeBlocked', 'canAssign',
  'openAssignments', 'renderAssignmentsModal', 'asgnOpenTasks', 'asgnGo',
  'asgnRowHtml', 'asgnListHtml', 'asgnOverviewCard',
  'notifyMemberEmails', 'notifyAdmins', 'notifyStepName', 'notifyQueue',
  'notifyEmailHtml', 'notifyDispatch', 'notifyStepComplete', 'notifySweepDeadlines',
  'notifyOutboxCard', 'asgnDoneTasks', 'asgnSteps', 'asgnTasks', 'nameList',
  /* Reviewed and left with the shell on purpose: the shared carousel wiring,
     which the reference's markup already matches (the frame itself,
     vpCarousel, IS ported — see PORT).

     printThemeTokens is NOT here, and that is the correction of an earlier
     reading. The shell's copy carries a note saying nothing in the shell calls
     it any more — true of the shell, and false here: this program's printPage
     came across from the reference, and the reference's printPage opens a BARE
     popup and writes the tokens into it as the only stylesheet the PDF gets.
     See PORT. */
  'carouselInit', 'carouselGo', 'carouselTick', 'carouselReset'
]);

/* ── The entry set ─────────────────────────────────────────────
   Everything the module registers or is asked for by name; the closure finds
   the rest. Only the pages the shell routes to and the seams module.js calls
   need naming. Every page id below is the reference's own render() branch
   (Culture-app.js, render()). */
const PORT = [
  /* ── The pages the module registers (js/modules/ai-culture/module.js) ── */
  'renderPipeline',        // pipeline / overview — the Program tab
  'renderPhaseHome',       // phase   — the phase landings
  'renderStep',            // step
  'renderOutcomePage',     // outcome
  'renderPhase5',          // phase5  — the Sustain tab (the dashboard; 5.1 maps here)
  'renderPhase5Shell',     // every CUL_P5_PAGES key
  'renderTargetCulture', 'renderRegister', 'renderTeamView', 'renderPeopleSignals',
  'renderInsights', 'renderMgmtHub', 'renderReports',
  'renderNextCycle', 'renderDriftReview', 'renderReadingData', 'renderReviewMap',
  'renderReviewPractices', 'renderPracticeCounts', 'renderCultureReview',
  'renderPulseRound', 'renderQuestionnaire',
  /* What the reference's render() appended to every inline page. */
  'culMapToastHtml', 'culLostDraftHtml',
  /* ── Seams module.js calls directly ───────────────────────── */
  'isStepDone', 'mgSteps', 'idToRecordKey', 'culEmptyData', 'seedSampleData',
  'sweepBlankInline', 'discardTypedDrafts', 'culBackBtn', 'setInsightsTab',
  /* ── Named because the SHELL has one too, and the two differ ──
     The rest of that list is found, not typed: see AUTO_SHADOWED below. */
  'fldSave', 'doneBtn', 'confirmStepDone', 'confirmSectionDone', 'stepAssignBar'
];

/* ── Names both builds declare, decided by rule ────────────────
   The three earlier ports read their SHADOWED lists by hand, and every verdict
   on every line was the same: the program's own (its reporting engine, its
   step renderers, its management hub, its print helpers behind a shared name).
   So here the rule is applied instead of re-read: a top-level function the
   reference declares that the shell ALSO declares is ported, unless
   SHELL_GLOBALS says the shell's is the one to keep. The names are printed on
   every run, so the decision stays visible. */
const AUTO_SHADOWED = true;

/* Content tables to lift even though the shell declares the same name —
   keyed identically to the Pipeline's, so the wrong one looks right. */
const PORT_VARS = ['CAROUSEL_CONTENT', 'STEP_FLOW', 'STEP_MILES', 'PHASE_COMPLETE_MSG',
  'PHASE_DESCS', 'PHASE_WRAPUPS',
  'DEPTHED_OUTPUTS', 'PRINT_DOCS', 'PRINT_MODULE_NAME',
  /* The page tables module.js routes with. */
  'CUL_P5_PAGES', 'CUL_RETIRED_ROUTES', 'CUL_SCHEMA'];
/* Left to the shell on purpose (SHADOWED VARS): session/chrome state, one per page. */

/* Declared by the reference, owned by the shell. PH is registered through
   Modules.define() in module.js. */
const SKIP_VARS = ['PH', 'data', 'UI', 'SK', 'currentPage', 'currentStep', 'currentPhase', 'PHASES'];

const ALIASES = { PHASES: 'PH' };
function rewriteAliases(code) {
  return Object.keys(ALIASES).reduce((out, from) => out.replace(
    new RegExp('(?<![A-Za-z0-9_$.])' + from + '(?![A-Za-z0-9_$])', 'g'), ALIASES[from]), code);
}

/* ── Page ids ──────────────────────────────────────────────────
   This build already uses the shell's ids — 'pipeline' for the overview and
   'phase' for a landing — so nothing is rewritten. Kept as a no-op so the
   pipeline of passes below reads the same as the other ports'. */
function rewritePages(code) { return code; }

const HOPS = new RegExp('(?:\\.\\./)+' + MEDIA.replace(/[-/]/g, '\\$&'), 'g');
function rewriteMedia(code) {
  return P.rewriteMedia(code.replace(HOPS, MEDIA), MEDIA);
}

/* ── Behaviour the reference build never had ───────────────────
   See tools/port-ai-architecture.js: the shell's team model means a step
   assigned to someone is theirs (or an administrator's) to sign off. */
const PATCHES = [{
  /* The button. This build's signature is (onclick, disabled, label, taskId,
     sectionComplete) — a string sectionComplete is the helper line — so the
     graft sets those two: a step assigned to someone else is not this reader's
     to sign off, and that outranks the required-fields helper. Admins are never
     blocked; stepCompleteLock is the shell's and reads the MODULE-scoped
     assignment (js/features/assignments.js). The reason carries member names,
     so it is escaped. */
  name: 'doneBtn honours the step assignment',
  in: 'doneBtn',
  after: "var isComplete=byTask||byFlag;",
  insert: "\n  /* PORTED-IN (tools/port-ai-culture.js): the shell's assignment rule. */"
    + "\n  var _lock=(!isComplete&&typeof stepCompleteLock==='function')?stepCompleteLock(currentStep):'';"
    + "\n  if(_lock){disabled=true;sectionComplete=esc(_lock);}"
}, {
  name: 'confirmStepDone enforces the step assignment',
  in: 'confirmStepDone',
  replace: "if((data.completedSteps||{})[sid])return true;",
  with: "if((data.completedSteps||{})[sid])return true;if(typeof completeBlocked==='function'&&completeBlocked(sid))return false;"
}, {
  name: 'confirmSectionDone enforces the step assignment',
  in: 'confirmSectionDone',
  replace: "if((data.completedSections||{})[s])return true;",
  with: "if((data.completedSections||{})[s])return true;if(typeof completeBlocked==='function'&&completeBlocked(currentStep))return false;"
}, {
  /* The history the Back button reads is the shell's (see 'backBtn' in
     SHELL_GLOBALS): with none, the reference sends the reader Home. */
  name: 'culBackBtn reads the shell\'s history',
  in: 'culBackBtn',
  replace: "return navHistory.length?backBtn():",
  with: "return (UI.navStack&&UI.navStack.length)?backBtn():"
}, {
  /* The reference's functions were globals, so its dispatchers called them off
     `window`; here they are the module's and live on NS (see LOOKUP_KEYS).
     `window` stays as the fallback for a shell function passed by name. */
  name: 'culRecAdd calls the program\'s own add function',
  in: 'culRecAdd',
  replace: "var f=window[addFn];",
  with: "var f=" + NS + "[addFn]||window[addFn];"
}, {
  name: 'culDbAddType calls the program\'s own add function',
  in: 'culDbAddType',
  replace: "if(!T||typeof window[T.fn]!=='function')return;var before=(data[T.data]||[]).map(function(r){return r&&r.id});window[T.fn]();",
  with: "var _f=T&&(" + NS + "[T.fn]||window[T.fn]);if(typeof _f!=='function')return;var before=(data[T.data]||[]).map(function(r){return r&&r.id});_f();"
}, {
  /* Its name arrives as o.open, which rewritePropHandlers has already made
     'CUL.culMapBoard' (the same value also feeds an onclick string), so the
     prefix comes off before the lookup. */
  name: 'culMapBandClick calls the program\'s own handler',
  in: 'culMapBandClick',
  replace: "if(typeof window[fn]==='function')window[fn](id)",
  with: "var _n=String(fn).replace(/^" + NS + "\\./,''),_f=" + NS + "[_n]||window[_n];if(typeof _f==='function')_f(id)"
}];

/* ── A declaration the extractor cannot see ────────────────────
   js-port's extract() anchors on `^function <name>(` — the start of a LINE —
   and this reference has one top-level function that does not start one:

       var EX_NOW=Date.now();function exDaysAgo(n){…}

   exDaysAgo dates every record in the sample workspace, so the closure asked
   for it, could not find it, and emitted a file in which five hundred lines of
   seed data call a function declared nowhere. That is a ReferenceError the
   moment the seed runs, and nothing before this pass said so.

   Fixed here rather than by loosening extract(), which would then have to
   judge whether a `function foo(` it finds mid-line is top-level or nested —
   and the two other ports share that function. A newline before each
   DEPTH-ZERO declaration is the same file with the same semantics, and it puts
   every top-level function where the extractor already looks. Depth is read
   off the skeleton, so a `{` inside a string or a comment cannot move it. */
function unwrapTopLevelFunctions(code) {
  const skel = P.skeletonOf(code);
  const cuts = [];
  let depth = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (depth !== 0 || c !== 'f') continue;
    if (/[A-Za-z0-9_$.]/.test(skel[i - 1] || ' ')) continue;
    if (!/^function\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(skel.slice(i, i + 80))) continue;
    // Already at the start of a line? Then there is nothing to do. Read on the
    // SOURCE, not the skeleton: a comment before the declaration is blank in the
    // skeleton but still sits between the line start and `function` in the
    // source, which is what extract() anchors on (culMetricsPart, culS42a).
    // Indentation counts as "not at the start" too: ` function culUrStart(` is
    // depth zero with one space before it, and extract() wants column 0.
    if (i === 0 || code[i - 1] === '\n') continue;
    cuts.push(i);
  }
  if (!cuts.length) return code;
  let out = code;
  for (let k = cuts.length - 1; k >= 0; k--) out = out.slice(0, cuts[k]) + '\n' + out.slice(cuts[k]);
  return out;
}

/* ── Handler names written as bare strings ─────────────────────
   rewriteHandlers() prefixes a name written inside a string as `name(`, which
   is every handler in this codebase except two, where the reference picks the
   function first and appends the call afterwards:

       (_mt==='manage'?'openMgLanding':'openMnLanding')+'(\''+r.id+'\')'

   There is no `(` in either string, so the rewriter cannot see them, and all
   four names reach the markup unprefixed — four buttons that render and do
   nothing. The BARE audit at the bottom of this file caught them, which is
   what it is for; this is the rule that fixes them.

   Scoped by the `+'('` on the RIGHT, not by the string on the left: a string
   that happens to equal a function name is ordinary data ('render', 'card'),
   and prefixing those would corrupt content. Being concatenated onto an opening
   parenthesis is the thing that makes it code. From that `+`, walk back across
   ONE balanced expression — a parenthesised group or a plain identifier/string
   — and prefix any string inside it that is exactly a ported name.

   Found through the LEXER's string list, not by matching `+'(` in the
   skeleton: the skeleton blanks string BODIES, so the `(` this rule keys on is
   one of the characters that is not there. Matching the raw source instead
   would key on a `+'(` inside a comment. The balanced walk still runs on the
   skeleton, where a parenthesis inside a string cannot throw the count off. */
function rewriteSplitHandlers(code, names) {
  const fns = new Set([...names].filter(n => !SHELL_GLOBALS.has(n)));
  const { skel, strs } = P.lex(code);
  const edits = [];
  strs.forEach(([a]) => {
    if (code[a] !== '(') return;              // the string must OPEN a call
    let j = a - 2;                            // step over the opening quote
    while (j >= 0 && /\s/.test(skel[j])) j--;
    if (j < 0 || skel[j] !== '+') return;     // …and be concatenated onto something
    const plus = j;
    j--;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    if (j < 0) return;
    let start;
    if (skel[j] === ')') {
      let d = 0;
      for (; j >= 0; j--) {
        if (skel[j] === ')') d++;
        else if (skel[j] === '(') { d--; if (d === 0) break; }
      }
      if (j < 0) return;
      start = j;
    } else {
      // a bare identifier or string literal; back up over it
      let k = j;
      while (k >= 0 && /[A-Za-z0-9_$.'"]/.test(skel[k] === ' ' && code[k] !== ' ' ? code[k] : skel[k])) k--;
      start = k + 1;
    }
    edits.push([start, plus]);
  });
  if (!edits.length) return code;
  let out = code;
  for (let k = edits.length - 1; k >= 0; k--) {
    const [a, b] = edits[k];
    out = out.slice(0, a) + out.slice(a, b).replace(
      /(['"])([A-Za-z_$][A-Za-z0-9_$]*)\1/g,
      (t, q, n) => fns.has(n) ? q + NS + '.' + n + q : t) + out.slice(b);
  }
  return out;
}

/* ── Run ───────────────────────────────────────────────────────── */
const src = unwrapTopLevelFunctions(fs.readFileSync(REF, 'utf8'));
const SHELL = P.shellProvides(ROOT);

/* ── Which SHADOWED entries are worth reading ──────────────────
   shellProvides() matches `function <name>` at ANY indent, and both this
   reference and the shell declare helpers INSIDE other functions — `chip`,
   `mark`, `tile`, `X`, `Y`, `P`, `push`. So a nested name in the shell can
   report as a collision with a nested name in the reference, and neither is a
   global at all: the enclosing function carries its own copy either way and
   there is nothing to decide.

   Judged on the REFERENCE side, at brace depth 0, because that is the side
   that decides whether skipping the name loses anything. Six such names were
   on the list when this port started, and reading them one by one to reach
   "nothing to do" is exactly the work this split removes. */
const topLevelFuncs = (() => {
  const skel = P.skeletonOf(src);
  const out = new Set();
  let depth = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (depth !== 0 || c !== 'f') continue;
    const m = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(skel.slice(i, i + 80));
    if (m && !/[A-Za-z0-9_$.]/.test(skel[i - 1] || ' ')) out.add(m[1]);
  }
  return out;
})();


/* ── Split handlers are dependencies too ───────────────────────
   The closure follows a call, and a call is a name with a `(` after it. The
   two split handlers above have neither: the reference picks the function as a
   bare string and appends the call afterwards, so nothing in the closure ever
   asks for them.

   For openMgLanding, openMnLanding and pfAddMgEm that was invisible, because
   each is also called normally somewhere else and came across on that path.
   pfAddMnEm is not — "+ Emergency plan" on the Monitor lane is the only place
   it is ever named — so it was left behind, the rewrite above turned its
   sibling into RG.pfAddMgEm and left it bare, and the button rendered and did
   nothing. That is precisely the failure the whole rewrite exists to prevent,
   arriving through the one door it did not watch.

   So the same rule that rewrites them also DECLARES them: scan the reference
   for the pattern, keep the names that are top-level functions in it, and add
   them to the entry set. Self-maintaining — a third one written tomorrow is
   found on the next run rather than shipped dead. */
const splitNames = (() => {
  const { skel, strs } = P.lex(src);
  const out = new Set();
  strs.forEach(([a]) => {
    if (src[a] !== '(') return;
    let j = a - 2;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    if (j < 0 || skel[j] !== '+') return;
    j--;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    let start;
    if (skel[j] === ')') {
      let d = 0;
      for (; j >= 0; j--) {
        if (skel[j] === ')') d++;
        else if (skel[j] === '(') { d--; if (d === 0) break; }
      }
      if (j < 0) return;
      start = j;
    } else {
      let k = j;
      while (k >= 0 && /[A-Za-z0-9_$.'"]/.test(src[k])) k--;
      start = k + 1;
    }
    const m = src.slice(start, a - 1).match(/(['"])([A-Za-z_$][A-Za-z0-9_$]*)\1/g) || [];
    m.forEach(t => out.add(t.slice(1, -1)));
  });
  return out;
})();

/* ── A split handler whose name arrives as an ARGUMENT ──────────
   The scan above reads backwards from the `(` for a QUOTED name, which is the
   shape the four handlers above have. The review pages have a fifth shape:

       function rvControlBar(fn){ … onclick="'+fn+'()"> … }
       rvControlBar('printEthicsReview')

   The name is a string literal, but it is a literal at the CALL SITE and a
   parameter where the markup is built, so backwards from the `(` there is only
   `fn` and the scan finds nothing. Both printEthicsReview and printGovReview
   are named nowhere else — like pfAddMnEm before them — so they were left
   behind entirely and the two review pages rendered a Save as PDF button that
   threw a ReferenceError.

   Resolved the same way, one level further out: work out which PARAMETER of
   which function reaches the markup, then collect the string literals every
   call passes at that position. Self-maintaining in the same sense — a sixth
   control bar built on the same pattern is found on the next run. */
const paramHandlers = (() => {
  const { skel, strs } = P.lex(src);
  const out = new Set();

  /* Every top-level declaration, with its parameter list and its extent, so a
     site can be attributed to the function it sits in. */
  const decls = [];
  const dre = /(^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  for (let m; (m = dre.exec(skel));) {
    decls.push({
      name: m[2],
      params: m[3].split(',').map(s => s.trim()).filter(Boolean),
      at: m.index
    });
  }
  const enclosing = i => {
    let lo = 0, hi = decls.length - 1, best = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (decls[mid].at <= i) { best = decls[mid]; lo = mid + 1; } else hi = mid - 1; }
    return best;
  };

  /* The sites: a string literal opening with `(` that a bare identifier was
     concatenated onto — the same anchor the scan above uses, taking the branch
     it discards. */
  const wanted = new Map();          // function name → set of parameter indexes
  strs.forEach(([a]) => {
    if (src[a] !== '(') return;
    let j = a - 2;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    if (j < 0 || skel[j] !== '+') return;
    j--;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(skel[k])) k--;
    const ident = src.slice(k + 1, j + 1);
    if (!/^[A-Za-z_$][\w$]*$/.test(ident)) return;
    const fn = enclosing(k);
    if (!fn) return;
    const pi = fn.params.indexOf(ident);
    if (pi < 0) return;              // a local or a global, not a parameter
    if (!wanted.has(fn.name)) wanted.set(fn.name, new Set());
    wanted.get(fn.name).add(pi);
  });

  /* The calls: read the argument sitting at that position, and keep it when it
     is a plain string literal naming an identifier. */
  wanted.forEach((idxs, fname) => {
    const cre = new RegExp('(?<![A-Za-z0-9_$.])' + fname + '\\s*\\(', 'g');
    for (let m; (m = cre.exec(skel));) {
      let i = m.index + m[0].length, depth = 0, argStart = i, argN = 0;
      for (; i < skel.length; i++) {
        const c = skel[i];
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' && depth === 0) break;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) {
          if (idxs.has(argN)) {
            const t = src.slice(argStart, i).trim();
            const q = /^(['"])([A-Za-z_$][\w$]*)\1$/.exec(t); if (q) out.add(q[2]);
          }
          argN++; argStart = i + 1;
        }
      }
      if (idxs.has(argN)) {
        const t = src.slice(argStart, i).trim();
        const q = /^(['"])([A-Za-z_$][\w$]*)\1$/.exec(t); if (q) out.add(q[2]);
      }
    }
  });
  return { names: out, wanted };
})();

/* The other half of the rule. Knowing the name is not enough: it still reaches
   the markup bare, and an onclick is evaluated in GLOBAL scope while the ported
   function lives inside the module's closure. rewriteSplitHandlers cannot do it
   — there is no quoted name beside the `+'('` to prefix — so the prefix goes on
   at the call site instead, which is the one place the name is written down. */
function rewriteParamHandlers(code, names) {
  const fns = new Set([...names].filter(n => !SHELL_GLOBALS.has(n)));
  if (!fns.size || !paramHandlers.wanted.size) return code;
  const { skel } = P.lex(code);
  const edits = [];
  paramHandlers.wanted.forEach((idxs, fname) => {
    const cre = new RegExp('(?<![A-Za-z0-9_$.])' + fname + '\\s*\\(', 'g');
    for (let m; (m = cre.exec(skel));) {
      let i = m.index + m[0].length, depth = 0, argStart = i, argN = 0;
      const take = (s, e) => {
        if (!idxs.has(argN)) return;
        const raw = code.slice(s, e), t = raw.trim();
        const q = /^(['"])([A-Za-z_$][\w$]*)\1$/.exec(t);
        if (q && fns.has(q[2])) edits.push([s + raw.indexOf(t), s + raw.indexOf(t) + t.length, q[1] + NS + '.' + q[2] + q[1]]);
      };
      for (; i < skel.length; i++) {
        const c = skel[i];
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' && depth === 0) break;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) { take(argStart, i); argN++; argStart = i + 1; }
      }
      take(argStart, i);
    }
  });
  if (!edits.length) return code;
  edits.sort((a, b) => a[0] - b[0]);
  let out = code;
  for (let k = edits.length - 1; k >= 0; k--) out = out.slice(0, edits[k][0]) + edits[k][2] + out.slice(edits[k][1]);
  return out;
}

/* ── …and a function handed over as a VALUE is a dependency too ──
   The closure follows calls (`name(`) and bare identifiers in real code; a
   name written as an ARGUMENT inside a handler string — markStepDone('1.2',
   saveRbData) — is neither, so saveRbData was never ported and the click threw.
   Same scan as rewriteValueHandlers below, over the reference: every top-level
   function it finds in that position joins the entry set. */
const valueNames = (() => {
  const out = new Set();
  P.lex(src).strs.forEach(([a, b]) => {
    (src.slice(a, b).match(/(?<=[(,]\s*)(?<![.\w$])[A-Za-z_$][\w$]*(?=\s*[),])/g) || [])
      .forEach(n => { if (topLevelFuncs.has(n)) out.add(n); });
  });
  return out;
})();

/* ── A handler whose name travels as an OBJECT PROPERTY ─────────
   The fourth shape, new in this build (6 Nov 2026):

       culMapBands(dims, items, {sel:sel, open:'culMapBoard'})
       …  onclick="'+o.open+'(\''+d.id+'\')"

   The name is a string literal in an object, and the markup is built from a
   PROPERTY of that object somewhere else entirely, so none of the three scans
   above can see it — and it shipped as eleven dead buttons on the culture map,
   found only when the smoke decoded &#39; properly. Resolved by the same
   self-maintaining method: collect every property that is concatenated onto an
   opening parenthesis (`X.prop+'('`), then every `prop:'name'` in the reference
   where `name` is a top-level function. */
const propHandlerKeys = (() => {
  const { skel, strs } = P.lex(src);
  const out = new Set();
  strs.forEach(([a]) => {
    if (src[a] !== '(') return;
    let j = a - 2;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    if (j < 0 || skel[j] !== '+') return;
    j--;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$.]/.test(skel[k])) k--;
    const m = /\.([A-Za-z_$][\w$]*)$/.exec(src.slice(k + 1, j + 1));
    if (m) out.add(m[1]);
  });
  return out;
})();
const propRe = () => new RegExp('(?<![\\w$])(' + [...propHandlerKeys].join('|') + ')\\s*:\\s*([\'"])([A-Za-z_$][\\w$]*)\\2', 'g');
const propNames = (() => {
  const out = new Set();
  if (!propHandlerKeys.size) return out;
  for (const m of src.matchAll(propRe())) if (topLevelFuncs.has(m[3])) out.add(m[3]);
  return out;
})();
if (propHandlerKeys.size) console.log('property handlers: ' + [...propHandlerKeys].join(', ') + ' → ' + ([...propNames].join(', ') || 'none'));
function rewritePropHandlers(code, names) {
  if (!propHandlerKeys.size) return code;
  const fns = new Set([...names].filter(n => !SHELL_GLOBALS.has(n)));
  return code.replace(propRe(), (m, key, q, n) => fns.has(n) ? key + ':' + q + NS + '.' + n + q : m);
}

/* ── A handler whose name is LOOKED UP by string ───────────────
   The fifth shape (11 Nov 2026): the name is a property value that is never
   concatenated into markup at all — it is handed to a dispatcher that calls
   it by name.

       culRecList({coll:'aiMessages', …, addFn:'culMsgAdd'})
         → onclick="CUL.culRecAdd('aiMessages','culMsgAdd')"
         → function culRecAdd(coll,addFn){var f=window[addFn]; …}
       CUL_DB_ADD = [{l:'A value', …, fn:'culVcAddValue'}, …]
         → culDbAddType(i){ … window[T.fn]() … }

   Two things went wrong. The functions named only this way (culAdLocAdd,
   culMsgAdd, culXmAdd) were never ported, because nothing names them in
   code; and the dispatchers looked on `window`, where no ported function
   lives, so every "+ Add …" button on a step and every entry in the
   Dashboard's Add menu did nothing at all, with no error to see. The names
   are carried here as dependencies (not rewritten: the dispatcher wants the
   bare name), and the PATCHES below point the three dispatchers at NS. */
const LOOKUP_KEYS = ['addFn'];   /* CUL_DB_ADD's fn names are all reached in code already; 'fn' also keys a handler→record table (66 entries) that would drag in dead code */
const lookupNames = (() => {
  const out = new Set();
  const re = new RegExp('(?<![\\w$])(?:' + LOOKUP_KEYS.join('|') + ')\\s*:\\s*([\'"])([A-Za-z_$][\\w$]*)\\1', 'g');
  for (const m of src.matchAll(re)) if (topLevelFuncs.has(m[2])) out.add(m[2]);
  return out;
})();

const splitDeps = [...new Set([...splitNames, ...paramHandlers.names, ...valueNames, ...propNames, ...lookupNames])]
  .filter(n => topLevelFuncs.has(n) && !PORT.includes(n) && !SHELL_GLOBALS.has(n)).sort();
if (splitDeps.length) console.log('split-handler entry points found:', splitDeps.join(', '));

/* ── A declaration the reference later OVERRIDES ───────────────
   `extract()` lifts the `function foo(…){…}` declaration, which is the right
   answer right up until the file assigns over it further down:

       function likSet(path,n){ …handles 1 and 2 segments… }   // line 2800
       …
       likSet=function(path,n){ …handles 3, and risk ids… }    // line 6577
       // the reference's own comment: "Likert setter override for nested paths"

   The browser runs the LAST one. The port lifted the first, so seventeen of
   this program's twenty-five Likert scales — every `a.b.c` path, which is most
   of the Assessment Battery — silently wrote nothing: the handler resolved,
   the function ran, both branches missed, and saveData()/render() still fired.
   No error, no console line, no failing test. Just a row of buttons that do
   not respond, which is exactly how it was reported.

   Found rather than listed, because a hand-list is the bug surface: any
   top-level `name = function (…)` that comes AFTER a declaration of the same
   name is the version that wins, so it is the version to port.
   `extractAssignFn` (tools/lib/js-port.js) turns it back into a declaration.

   DEPTH ZERO on both sides. `var inp = function(k){…}` inside another function
   is a local and overrides nothing — it was the one false positive when this
   was first written without the depth check. */
const overridden = (() => {
  const skel = P.skeletonOf(src);
  const declAtDepth0 = new Map();
  const assignAtDepth0 = new Map();
  let depth = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (depth !== 0) continue;
    if (/[A-Za-z0-9_$.]/.test(skel[i - 1] || ' ')) continue;
    const d = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(skel.slice(i, i + 80));
    if (d && !declAtDepth0.has(d[1])) { declAtDepth0.set(d[1], i); continue; }
    const a = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*function\s*\(/.exec(skel.slice(i, i + 80));
    if (a && !assignAtDepth0.has(a[1])) assignAtDepth0.set(a[1], i);
  }
  return [...assignAtDepth0.keys()]
    .filter(n => declAtDepth0.has(n) && assignAtDepth0.get(n) > declAtDepth0.get(n))
    .sort();
})();
if (overridden.length) {
  console.log('overridden declarations (taking the later assignment):', overridden.join(', '));
}

const REF_SKEL = P.skeletonOf(src);
/* Where a table is declared, so it is emitted at the reference's own place.
   NOT `^var NAME =` alone: this build declares tables after a comment on the
   same line (`/* … *\/ var CUL_AGENDA_Q_STEPS={…}`), and a miss here sent the
   table to the END of the file, after the carried statement that reads it — a
   TypeError at load. Read off the skeleton (comments blanked), where such a
   declaration is just indented; anything still unplaced stops the run below. */
const declAt = name => {
  const i = REF_SKEL.search(new RegExp('(?:^|[;}])[ \\t]*var\\s+' + name + '\\s*=', 'm'));
  if (i >= 0) return REF_SKEL.indexOf('var', i);
  /* A later declarator of a comma list (`var _discardChangeUntil=0, _lastResetSeen=null`):
     the depth-zero `var` statement that names it. */
  const re = new RegExp('(?:^var\\s+|,\\s*)' + name + '\\s*=');
  const st = topLevelStatements.find(t => { const k = t.skel.trim(); return /^var\s/.test(k) && re.test(k); });
  return st ? st.at + st.skel.search(/\S/) : Number.MAX_SAFE_INTEGER;
};

/* Every depth-zero statement of the reference, so the fills can be found among
   them. Split on a `;` or newline seen at depth zero — the same reading
   unwrapTopLevelFunctions() takes of the same skeleton. */
const topLevelStatements = (() => {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < REF_SKEL.length; i++) {
    const c = REF_SKEL[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if ((c === ';' || c === '\n') && depth === 0) {
      /* A newline after a trailing comma CONTINUES the statement: this build
         writes `var A=[…], /* note *\/\nCUL_RV_NEXT=[…];`, and splitting there
         made the second declarator look like a bare load-time assignment. */
      if (c === '\n') { let k = i - 1; while (k >= start && /\s/.test(REF_SKEL[k])) k--; if (k >= start && REF_SKEL[k] === ',') continue; }
      const text = src.slice(start, i + 1);
      if (text.trim() && text.trim() !== ';') out.push({ at: start, text: text.trim(), skel: REF_SKEL.slice(start, i + 1) });
      start = i + 1;
    }
  }
  return out;
})();

/* ── Load-time statements: carried by RULE, the shell's named ───
   The Architecture port carried a statement that WRITES into a ported table
   (`V.x =`, `V[k] =`) and named the handful of other load-time statements it
   could not lose. This build has ninety-odd load-time statements and most of
   them are the program's in shapes that rule cannot see:

     CUL_BASELINE_PARTS.push({key:'stated',html:culStatedPart});   — a .push
     CUL_HANDLER_LOCKS.push({fn:'culCrDel',coll:'criteria'},…);    — a .push
     CUL_RV_NEXT=[…];                                              — a reassignment
     CUL_CL_CAP.forEach(function(o){o.dm=o.def;o.def=''});          — element writes
     (function(){…CUL_AGENDA_Q.splice(…)…})();                     — an IIFE
     _culSeed0=seedSampleData; seedSampleData=function(){…};        — a wrapper

   Missing any one of them does not throw: a baseline report section, a review
   rule, a lock on a delete handler, a reworded label simply is not there. So
   the rule is inverted. EVERY depth-zero statement that is not a declaration
   is the program's and is carried, at its own offset in the reference, unless
   it is listed here as the shell's. Each anchor must match exactly one
   statement, so a reference edit that moves one stops the run. */
const SHELL_STATEMENTS = [
  /* the field-lock focusin listener: the shell's lock layer (js/app.js) */
  "if(typeof document!=='undefined'){document.addEventListener('focusin',function(e){",
  /* typed-field watch and the pointer-deferred redraw: both serve the
     reference's own render(), which does not come across */
  "(function(){if(typeof document==='undefined'||!document.addEventListener||window._typedWatch)return;",
  "try{document.addEventListener('keydown',function(e){if(e&&e.key==='Tab')_tabAt=Date.now()},true)}",
  /* the header-height watcher: the shell's header */
  "if(typeof window!=='undefined'){window.addEventListener('resize',function(){syncNavHeight();});",
  /* theme and zoom preferences: the shell's Store.getPref */
  "(function initPrefs(){",
  /* boot, the loading note, textarea auto-height and the 10,000-character
     cap: all the shell's (js/app.js) */
  "Store.ready(function(){bootApp();render();});",
  "if(!_bootDone){",
  "document.addEventListener('input',function(e){if(e.target.tagName==='TEXTAREA'){",
  "(function(){var INPUT_CHAR_CAP=10000;"
];
/* Functions the reference reassigns in a CARRIED statement that keeps the
   original (`_culSeed0=seedSampleData; seedSampleData=function(){…_culSeed0…}`).
   Taking the later assignment as the declaration would make the wrapper call
   itself; the declaration comes across and the carried statement wraps it. */
const WRAPPED_BY_CARRY = new Set(['seedSampleData']);

const squash = t => t.replace(/\s+/g, '');
const loadTime = topLevelStatements.map(st => {
  const k = st.skel.search(/\S/);
  if (k < 0) return null;
  const head = st.skel.slice(k);
  if (/^(?:function\s|var\s)/.test(head)) return null;          // a declaration
  const text = src.slice(st.at + k, st.at + st.skel.length).trim();
  return { at: st.at + k, text, skel: head };
}).filter(Boolean);
const denied = new Set();
SHELL_STATEMENTS.forEach(a => {
  const hits = loadTime.filter(st => squash(st.text).startsWith(squash(a)));
  if (hits.length !== 1) { console.error('SHELL_STATEMENTS anchor matched ' + hits.length + ' statements: ' + a); process.exit(1); }
  denied.add(hits[0].at);
});
const carried = loadTime.filter(st => !denied.has(st.at));
console.log('load-time statements: ' + loadTime.length + ' (' + carried.length + ' carried, ' + denied.size + ' left to the shell)');

/* Kept for the emitter below, which interleaves "fills" with the declarations:
   here every carried statement is one. */
function fillsFor() { return carried; }

const refVarNames = new Set(P.topLevelVars(src));
const cfg = {
  PORT: PORT.concat(splitDeps), PORT_VARS: PORT_VARS.slice(), SKIP_VARS, SHELL_GLOBALS,
  ASSIGN_FNS: overridden.filter(n => !WRAPPED_BY_CARRY.has(n))
};
/* ── The closure has to walk the carried statements too ────────
   They are code: they call functions and read tables nothing else names.
   Whatever they reach joins the entry set (functions) or the forced tables
   (vars), and the closure runs again until nothing grows. Then the same for
   names BOTH builds declare (AUTO_SHADOWED). */
let res = P.closure(src, cfg, SHELL);
for (let round = 0; round < 12; round++) {
  const fx = new Set(), vx = new Set();
  carried.forEach(f => {
    P.identsInCode(f.text).forEach(n => {
      if (topLevelFuncs.has(n) && !res.found.includes(n) && !SHELL_GLOBALS.has(n) && !cfg.PORT.includes(n)) fx.add(n);
      else if (refVarNames.has(n) && !res.vars.includes(n) && !SHELL_GLOBALS.has(n) && !SKIP_VARS.includes(n) && !cfg.PORT_VARS.includes(n)) vx.add(n);
    });
  });
  if (AUTO_SHADOWED) {
    [...res.shadowed].forEach(n => { if (topLevelFuncs.has(n) && !SHELL_GLOBALS.has(n) && !cfg.PORT.includes(n)) fx.add(n); });
    [...res.shadowedVars].forEach(v => { if (!SKIP_VARS.includes(v) && !SHELL_GLOBALS.has(v) && !cfg.PORT_VARS.includes(v) && carried.some(c => P.reads(c.text, v))) vx.add(v); });
  }
  if (!fx.size && !vx.size) break;
  if (fx.size) console.log('round ' + (round + 1) + ' functions pulled in:', [...fx].sort().join(', '));
  if (vx.size) console.log('round ' + (round + 1) + ' tables pulled in:', [...vx].sort().join(', '));
  cfg.PORT = cfg.PORT.concat([...fx]);
  cfg.PORT_VARS = cfg.PORT_VARS.concat([...vx]);
  res = P.closure(src, cfg, SHELL);
}
P.applyPatches(res.bodyOf, PATCHES);

/* Keep SHELL_GLOBALS honest. A promise that the shell defines a name is only
   worth anything if it does: a name that has moved, or that lives inside an
   IIFE and is therefore invisible to shellProvides(), is skipped by the
   closure and then resolves to nothing at run time — which the UNRESOLVED
   audit below cannot catch, because it trusts this same list.

   Reported only where it MATTERS: a name the ported code actually calls. The
   list deliberately also names the reference's entry screens, admin console
   and sign-in — a whole second identity system that no ported page reaches —
   and flagging those every run would bury the one entry that is a bug. */
const calledByPort = new Set();
[...res.bodyOf.values(), ...res.varOf.values()].forEach(c =>
  P.callsIn(c).forEach(n => calledByPort.add(n)));
const brokenPromises = [...SHELL_GLOBALS]
  .filter(n => !SHELL.has(n) && !P.BROWSER.has(n) && calledByPort.has(n)).sort();

const { found, vars, bodyOf, varOf } = res;
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

console.log('reference :', rel(REF));
console.log('requested :', PORT.length);
console.log('pulled in :', res.pulledIn.length);
console.log('data vars :', vars.length, vars.length ? '(' + vars.join(', ') + ')' : '');
console.log('extracted :', found.length,
  '(' + found.reduce((a, n) => a + bodyOf.get(n).length, 0) + ' bytes)');

if (brokenPromises.length) {
  console.log('\nNOT IN THE SHELL: listed in SHELL_GLOBALS but the shell defines no such');
  console.log('            name, so the closure skipped it and nothing answers the call.');
  console.log('            ' + brokenPromises.join(', '));
}

if (res.shadowed.size) {
  const all = [...res.shadowed].sort();
  const real = all.filter(n => topLevelFuncs.has(n));
  const nested = all.filter(n => !topLevelFuncs.has(n));
  if (real.length) {
    console.log('\nSHADOWED  : the reference defines these AND so does our shell, so the');
    console.log('            shell\'s version answers. Check each one; add it to PORT if');
    console.log('            the two differ, or to SHELL_GLOBALS once you have decided');
    console.log('            the shell\'s is the one to keep.');
    console.log('            ' + real.join(', '));
  }
  if (nested.length) {
    console.log('\n(shadowed but NESTED in the reference, so nothing is lost by skipping');
    console.log(' them — the enclosing function carries its own: ' + nested.join(', ') + ')');
  }
}
if (res.shadowedVars.size) {
  const open = [...res.shadowedVars].filter(v => !PORT_VARS.includes(v) && !SKIP_VARS.includes(v)).sort();
  if (open.length) {
    console.log('\nSHADOWED VARS: read by the ported code, declared by BOTH. The shell\'s');
    console.log('            value answers. Fine for shared state (data, UI); NOT fine for');
    console.log('            content — add it to PORT_VARS if it is this program\'s.');
    console.log('            ' + open.join(', '));
  }
}
if (res.missing.length) console.log('\nMISSING   :', res.missing.join(', '));

const emitAt = process.argv.indexOf('--emit');
if (emitAt < 0) {
  console.log('\n(report only — pass --emit [file] to write)');
  process.exit(res.missing.length ? 1 : 0);
}
const out = (process.argv[emitAt + 1] && !process.argv[emitAt + 1].startsWith('--'))
  ? path.resolve(process.argv[emitAt + 1]) : OUT;
fs.mkdirSync(path.dirname(out), { recursive: true });

/* ── Emitter ───────────────────────────────────────────────────
   Everything goes inside one IIFE and is exposed on `RG`, the single global
   this module owns. It has to be: the reference calls these renderStep,
   renderInsights, doneBtn, ta, sel — and so do js/app.js, js/insights.js and
   js/steps/phase*.js, which the shell loads for every module. Inline handlers
   in the generated markup are rewritten to match: onclick="RG.saveWB('x')".

   Variables go inside the IIFE too, unlike the Leaders ports, and that is safe
   HERE for one checked reason: nothing in this reference's markup ASSIGNS to a
   top-level variable from an inline handler. (Every `insightsTab=`,
   `gchatOpen=`, `currentModal=` in the file is in real code.) A handler that
   assigned to one would need it on `window` instead — see the note in
   tools/port-leader-module.js — so re-check that before adding one.

   NOTHING RUNS AT LOAD. js/modules/boot.js loads a module's scripts in the
   <head>, before app.js, so at the moment this file is evaluated there is no
   Store, no UI and no data. Declarations only; module.js drives the rest. */
const header = `/* ─────────────────────────────────────────────────────────────
   ${ID}/program.js — AI-Ready Culture, the program itself
   ─────────────────────────────────────────────────────────────
   GENERATED by tools/port-ai-culture.js from
   ${rel(REF)}.
   Re-run that script rather than editing this file by hand; the PORT
   list there is what decides which functions live here.

   Everything is on RG, the single global this module owns. It has to
   be: the reference calls these renderStep, renderInsights, doneBtn,
   ta and sel, and so do js/app.js, js/insights.js and
   js/steps/phase*.js — the Pipeline's code, which the shell loads for
   every module. Inline handlers in the generated markup are rewritten
   to match: onclick="CUL.culCrDel('x')".

   Shell functions (esc, card, val, go, render, saveData, goBack,
   getAssigns, notifyStepComplete …) are used as-is; they are the same
   functions the reference had, under the same names, and three of them
   are what keeps this program's data to itself — see the note on
   MODULE ISOLATION in the port script.

   PERSISTENCE. These write to \`data\` and call saveData(), which is
   the shell's Store — POST /workspace with module=${ID},
   straight to MySQL (api/sql/workspace-modules.sql). Nothing here
   touches localStorage; that is only the offline mirror underneath
   Store, and it is namespaced per module too.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var ${NS} = window.${NS} = window.${NS} || {};

`;

/* ── Handed to module.js, not retyped there ────────────────────
   module.js registers the phase spine, the milestone lines, the phase-complete
   messages and the document's empty shape with the shell. Each is the
   reference's own text, lifted here at port time, so a reference edit reaches
   the registration on the next --emit instead of drifting from a pasted copy.
   PH is the INITIALISER only — the ported code reads the shell's PH, which is
   Modules.PH(), which is this one: one registry, as the spec asks. */
const refEmpty = P.extract(src, 'culEmptyData');
if (!refEmpty) { console.error('the reference declares no culEmptyData()'); process.exit(1); }
const refInits = P.topLevelVarInits(src);
['PH', 'STEP_MILES', 'PHASE_COMPLETE_MSG'].forEach(v => {
  if (!refInits.has(v)) { console.error('the reference declares no ' + v); process.exit(1); }
});
const handOver = [
  '',
  '  /* Handed to module.js (see the port script): the reference\'s own tables. */',
  '  ' + NS + '.PH = ' + refInits.get('PH') + ';',
  '  ' + NS + '.MILESTONES = STEP_MILES;',
  '  ' + NS + '.PHASE_COMPLETE_MSG = PHASE_COMPLETE_MSG;',
  '  ' + NS + '.PHASE_WRAPUPS = PHASE_WRAPUPS;',
  '  ' + NS + '.emptyData = culEmptyData;',
  '  ' + NS + '.P5_PAGES = CUL_P5_PAGES;',
  '  ' + NS + '.RETIRED_ROUTES = CUL_RETIRED_ROUTES;'
].join('\n');

const footer = `
  /* Everything ported is reachable from the markup above, so all of it is
     exposed. Adding a function to the PORT list is all it takes. */
${found.map(n => '  ' + NS + '.' + n + ' = ' + n + ';').join('\n')}
${handOver}
})();
`;

/* ── A function handed over as a VALUE inside a handler ─────────
   rewriteHandlers() prefixes a ported name written as a CALL inside a string.
   This build also hands a function over as an ARGUMENT, inside the string:

       doneBtn('markStepDone(\'1.2\',saveRbData)', …)

   markStepDone is prefixed (it is a call); saveRbData is not, so the click ran
   ARC.markStepDone('1.2', saveRbData) in GLOBAL scope, where saveRbData does
   not exist — a ReferenceError on "Mark step complete" on five steps (1.2, 1.4,
   1.5, 2.1, 2.7). Found by tools/ai-architecture-smoke.js.

   The rule: inside a string, a ported function name standing alone as an
   argument — after `(` or `,`, before `)` or `,` — is prefixed. Data
   that happens to read the same is not shaped like that. */
function rewriteValueHandlers(code, names) {
  const fns = new Set([...names].filter(n => !SHELL_GLOBALS.has(n)));
  const { strs } = P.lex(code);
  if (!strs.length) return code;
  let out = '', at = 0;
  strs.forEach(([a, b]) => {
    out += code.slice(at, a);
    out += code.slice(a, b).replace(/(?<=[(,]\s*)([A-Za-z_$][\w$]*)(?=\s*[),])/g,
      (m, n, off, whole) => (fns.has(n) && whole[off - 1] !== '.') ? NS + '.' + n : m);
    at = b;
  });
  return out + code.slice(at);
}

const indent = s => s.split('\n').map(l => (l.trim() ? '  ' + l : l)).join('\n');
const pass = code => indent(rewriteAliases(rewritePages(rewriteMedia(rewriteValueHandlers(rewritePropHandlers(rewriteParamHandlers(
  rewriteSplitHandlers(P.rewriteHandlers(code, found, NS, SHELL_GLOBALS), found), found), found), found)))));

/* ── The data vars go out in the REFERENCE's order ─────────────
   The closure discovers them in the order the pages happen to read them, and
   emitting that order is emitting an order nobody checked. One of these
   initialisers reads another — `var NIST_SUBCATS = Object.keys(NIST_DESC);` —
   and a `var` is hoisted but its VALUE is not, so NIST_DESC was `undefined`
   at the moment NIST_SUBCATS asked for its keys. That throws at parse-eval
   time, before the IIFE has defined a single function, and the failure reads
   as the whole module being missing rather than as one table being early.

   The reference build is itself valid JavaScript, so its own declaration order
   is a working one. Sorting by the offset of each declaration reuses it, and
   keeps working for whatever the next dependency between two tables turns out
   to be.

   ── A table that is FILLED after it is declared ──────────────
   `var <name> = <initialiser>;` is not always the whole table. A declaration
   can be populated by a SEPARATE top-level statement, and an emitter that
   writes only the declaration drops that statement without a word. The
   reference has five, and every one of them was emitted empty:

     var NIST_REV={};
     (function(){for(var sid in NIST_MAP){…NIST_REV[sc].push(sid)…}})();

     var TEVV_SC_CHAR={};TEVV_CHARS.forEach(function(c){TEVV_SC_CHAR[c.sc]=c.k});

     var LAYER_MAPS={};
     LAYER_MAPS.risk={…}  LAYER_MAPS.regime={…}  LAYER_MAPS.system={…}

   None of them throws, which is what makes this the worst shape of failure
   here. NIST_REV empty makes every row of the Compliance Dashboard read
   'open', so all four function cards show 0 however much of the program is
   complete. TEVV_SC_CHAR empty makes the eight characteristic rows take the
   step-completion path they are explicitly meant never to take. And
   LAYER_MAPS empty is the whole reporting engine: lyRender() opens with
   `var map=LAYER_MAPS[type];if(!map||!rec)return ''`, so every register, every
   record table and every single-record section of a compiled report printed a
   heading over nothing, and each page still rendered, still resolved every
   handler, and still passed a smoke that only asked whether it threw.

   The first two were repaired BY HAND in the generated file and this note used
   to say so. That is not a repair, it is a countdown: the next --emit drops
   them again. They are carried by RULE now.

   The rule: a depth-zero statement that ASSIGNS INTO a ported var — `V.x = `,
   `V[k] = ` — belongs to that var and is emitted with it. A write, not a
   mention, so `TEVV_CHARS.forEach(…)` is attributed to TEVV_SC_CHAR (which it
   writes) and not to TEVV_CHARS (which it only reads). Everything else at
   depth zero stays behind, which is right: the other ten statements here are
   bootApp(), render() and the document-level listeners, all of them the
   shell's job now.

   Emitted INTERLEAVED with the declarations, each at its own offset in the
   reference, so the top-level order is the reference's own — the order that
   already works. Sorting the declarations alone was not enough: a table
   declared after a fill may read it (RISK_LAYER_INDEX sits below
   LAYER_MAPS.risk), and a fill reads tables of its own. */

const unplaced = vars.filter(v => declAt(v) === Number.MAX_SAFE_INTEGER);
if (unplaced.length) { console.error('cannot place these tables in the reference\'s order: ' + unplaced.join(', ')); process.exit(1); }
const fills = fillsFor(vars);
if (fills.length) console.log('load-time statements carried in place:', fills.length);

const varBlock = vars.length
  ? '  /* Content and lookup tables the reference declares as top-level vars,\n'
  + '     lifted verbatim in the reference\'s own top-level order — one of them\n'
  + '     reads another at load time. The statements that FILL a table after it\n'
  + '     is declared come across with it, at their own place in that order.\n'
  + '     See the note in the port script. */\n'
  + vars.map(v => ({ at: declAt(v), code: 'var ' + v + ' = ' + varOf.get(v) + ';' }))
    .concat(fills.map(f => ({ at: f.at, code: f.text })))
    .sort((a, b) => a.at - b.at)
    .map(x => pass(x.code)).join('\n\n') + '\n\n'
  : '';

/* The carried load-time statements (see CARRY), in the reference's order. A
   table one of them reads that did not come across is a load-time
   ReferenceError, so it stops the run. */
const carryVars = [...new Set(carried.flatMap(c => [...P.identsInCode(c.text)]))]
  .filter(n => refVarNames.has(n) && !vars.includes(n) && !SHELL.has(n) && !SKIP_VARS.includes(n));
if (carryVars.length) { console.error('CARRY reads tables that were not ported: ' + carryVars.join(', ')); process.exit(1); }
/* Every carried statement went out with the declarations, at its own offset
   (see fillsFor above), so nothing is appended after the functions. */
const carryBlock = '';
fs.writeFileSync(out, header + varBlock + found.map(n => pass(bodyOf.get(n))).join('\n\n') + carryBlock + footer, 'utf8');
console.log('\nwrote', rel(out), '(' + fs.statSync(out).size + ' bytes)');

/* ── Audit ─────────────────────────────────────────────────────
   Two questions, because the generated file has two kinds of call in it and
   they fail in different ways.

   1. UNRESOLVED — a call in real code to a name declared nowhere. That is a
      ReferenceError the moment the page renders, and it will not surface until
      someone opens that exact screen, of which there are eleven plus every
      step and every report. Strings are stripped for this pass: inside them,
      `rgba(`, `repeat(` and "Board (the" are not calls.

   2. BARE — a ported name still written unprefixed inside a string. That is
      the dead-button failure the rewriter exists to prevent: the page renders
      perfectly and the handler resolves to nothing (or, worse, to the
      Pipeline's function of the same name) when it is finally clicked. */
const emitted = fs.readFileSync(out, 'utf8');
const code = P.skeletonOf(emitted);

/* Everything the emitted file declares at ANY depth, plus every parameter
   name. The top-level list is not enough: the reference nests freely, and a
   callback arrives as a parameter. Judging scope properly would need a parser;
   "declared somewhere in this file" is the useful approximation, because the
   failure being hunted is a name declared NOWHERE. */
const inScope = new Set([...found, ...vars]);
(code.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g) || [])
  .forEach(m => inScope.add(m.split(/\s+/)[1]));
(code.match(/var\s+([A-Za-z_$][A-Za-z0-9_$]*)/g) || [])
  .forEach(m => inScope.add(m.split(/\s+/)[1]));
(code.match(/function[^(]*\(([^)]*)\)/g) || []).forEach(m => {
  m.slice(m.indexOf('(') + 1, -1).split(',').forEach(p => {
    p = p.trim(); if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p)) inScope.add(p);
  });
});

let failed = false;
/* Locals the scope scan above cannot see: each is a LATER declarator of a
   comma list (`var f=…,num=function…,countNote=function…`, the diagram's
   `var ptR=function…,ptL=…,ptT=…,ptB=…`, the test report's
   `var sec=…,get=sec?secRec:casRec`). Read in the reference one by one, all
   five declared in the function that calls them. Named, not pattern-matched,
   so a genuinely missing name of the same shape is still reported. */
/* Read in the reference one by one (6 Nov 2026): every name below is a LATER
   declarator of a comma list inside the function that calls it (`var a=…,
   kv=function…`), or ResizeObserver, a browser API the code guards with typeof. */
const KNOWN_LOCALS = new Set(['ResizeObserver', 'Role', '_aud', '_has', '_rl', '_say', '_un', '_val',
  'about', 'avg', 'df', 'f1', 'hasCh', 'itemOf', 'kv', 'mean', 'nl', 'nw', 'pm', 'prac', 'rank', 'rk',
  'rowOf', 'same', 'short', 'stL', 'two', 'ul', 'vr', 'vw', 'workTable']);
const unresolved = [...P.callsInCode(emitted)]
  .filter(n => !inScope.has(n) && !SHELL.has(n) && !SHELL_GLOBALS.has(n)
    && !P.JS_KEYWORDS.has(n) && !P.BROWSER.has(n) && !KNOWN_LOCALS.has(n))
  .sort();
if (unresolved.length) {
  failed = true;
  console.log('\nUNRESOLVED: called by the generated code, declared nowhere we can see.');
  console.log('            Each is a ReferenceError on the screen that calls it.');
  console.log('            ' + unresolved.join(', '));
}

const inStrings = P.callsInStrings(emitted);
const bare = found.filter(n => inStrings.has(n)).sort();
if (bare.length) {
  failed = true;
  console.log('\nBARE      : ported names left unprefixed inside a string. Each is a');
  console.log('            button that renders and does nothing when clicked.');
  console.log('            ' + bare.join(', '));
}

/* A media reference the rewriter did not catch: a bare filename, or a path
   still carrying the review build's ../ hops. Either one is a black box on the
   page with nothing in the console, which is exactly the failure class this
   port has already shipped once (see port-exec-readiness.js). */
/* BARE VALUES — a ported function still handed over unprefixed as an argument
   inside a string (see rewriteValueHandlers). */
const bareValues = new Set();
P.lex(emitted).strs.forEach(([a, b]) => {
  (emitted.slice(a, b).match(/(?<=[(,]\s*)(?<![.\w$])[A-Za-z_$][\w$]*(?=\s*[),])/g) || [])
    .forEach(n => { if (found.includes(n) && !SHELL_GLOBALS.has(n)) bareValues.add(n); });
});
if (bareValues.size) {
  failed = true;
  console.log('\nBARE VALUE: ported functions handed over unprefixed inside a handler string.');
  console.log('            ' + [...bareValues].sort().join(', '));
}

/* BARE PROPERTY — a ported function still named bare in a `prop:'name'` that
   becomes a handler (see rewritePropHandlers). */
const bareProps = new Set();
if (propHandlerKeys.size) for (const m of emitted.matchAll(propRe())) if (found.includes(m[3]) && !SHELL_GLOBALS.has(m[3])) bareProps.add(m[3]);
if (bareProps.size) {
  failed = true;
  console.log('\nBARE PROP : ported functions handed over unprefixed as a handler property.');
  console.log('            ' + [...bareProps].sort().join(', '));
}

const stray = (emitted.match(/(?:\.\.\/)+assets\/media\//g) || []).length;
if (stray) {
  failed = true;
  console.log('\nMEDIA     : ' + stray + ' path(s) still carry the review build\'s ../ hops.');
}
if (failed) process.exit(1);
console.log('\n✓ every call resolves, every handler is prefixed, every media path is absolute');
