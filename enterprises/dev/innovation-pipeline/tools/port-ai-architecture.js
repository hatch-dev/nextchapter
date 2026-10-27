#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   port-ai-architecture.js — lift the AI-Ready Architecture program
   out of its reference build and into a module
   ─────────────────────────────────────────────────────────────
   `enterprises/dev/architecture-prototype/Architecture-app.js` is a
   complete, standalone COPY of the whole application (2.0 MB, 1302
   top-level functions) that the program was built in. Everything it
   duplicates — the store, sign-in, organizations, the admin console,
   the header, the sidebar, chat, notes, the AI Guide, voice, email
   notifications, assignments — is the shell's here. What we want out
   of it is only the program: the Framework overview, the five phase
   landings, the step bodies, the output reports, the Architecture
   Dashboard, the standards pages, the reviews, the map, the scores,
   the jurisdiction map, the Report Manager and the handlers behind them.

   Cloned from tools/port-ai-architecture.js (21 Oct 2026), which is the
   third port of this kind; the machinery is tools/lib/js-port.js and
   the rules below the configuration are that tool's, unchanged. Read
   that file's notes for why each rule is a rule.

   Usage:
     node tools/port-ai-architecture.js                # report only
     node tools/port-ai-architecture.js --emit         # to its real path
     node tools/port-ai-architecture.js --emit <file>
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const ID = 'ai-architecture';
const NS = 'ARC';
const REF_DIR = path.join(ROOT, '..', 'architecture-prototype');
const REF = path.join(REF_DIR, 'Architecture-app.js');
const OUT = path.join(ROOT, 'js', 'modules', ID, 'program.js');
const MEDIA = 'assets/media/' + ID + '/';

if (!fs.existsSync(REF)) {
  console.error('the reference build is not at ' + path.relative(ROOT, REF) + '.');
  console.error('If the review build moved, update REF_DIR here and in tools/ai-architecture-smoke.js.');
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
   Everything the module registers or is asked for by name, and nothing else:
   the closure finds the rest. Adding a name here is only ever necessary when
   NOTHING already ported calls it — which is true of exactly two kinds of

/* ── The entry set ─────────────────────────────────────────────
   Everything the module registers or is asked for by name; the closure finds
   the rest. Only the pages the shell routes to and the seams module.js calls
   need naming. */
const PORT = [
  /* ── The pages the module registers (js/modules/ai-architecture/module.js) ── */
  'renderOverview',                 // pipeline   — the Framework tab ('readiness' in the reference)
  'renderPhaseHome',                // phase      — the five phase landings ('phaseHome')
  'renderStep',                     // step
  'renderOutcomePage',              // outcome
  'renderDashboard',                // phase5     — the Architecture Dashboard
  'renderInsights',                 // insights   — this program's own shelf
  'renderManage',                   // manage
  'renderMgmtHub',                  // mgmt-hub   — Track Program
  'renderReports',                  // reports    — the Report Manager
  'renderArchReviewPage',           // archreview — the standing Architecture Review
  'renderArchMapPorthole',          // archmap    — the map porthole
  'renderArchScoresPage',           // archscores — the scores and their archive
  'renderDataStandardsPage',        // stdData
  'renderDgReviewPage',             // dgreview   — the Data Governance Review
  'renderComputePage',              // stdCompute
  'renderModelRulesPage',           // stdModel
  'renderIntegrationStandardsPage', // stdInteg
  'renderAppGovernancePage',        // stdApp
  'renderJurMap',                   // jurmap     — the jurisdiction map
  /* The reference's render() appends the fullscreen Review Board overlay to
     every inline page; module.js does the same through the page wrapper. */
  'rbOverlay',
  /* ── Seams module.js calls directly ───────────────────────── */
  'isStepDone', 'mgSteps', 'idToRecordKey', 'seedData', 'backBtn',
  /* The page names the Notes panel and the AI Guide show (19 Oct 2026, KB fix A4): module.js answers the
     shell's noteScope / noteScopeLabel / coachContext with the reference's own table, not a retyped one. */
  'notesWhereFor',
  /* ── Named because the SHELL has one too, and the two differ ──
     Same reasoning as the Governance port: left off, the shell's answers and the
     page renders in the Pipeline's shape with no error. fldSave is the big one —
     this program's fields save per keystroke through its OWN prefix table; the
     shell's is the Pipeline's and would drop every field silently. */
  'fldSave', 'btn', 'badge', 'vp', 'vpCarousel', 'renderStepContent', 'ta', 'sel',
  'likert', 'likSet', 'milestone', 'phaseColorFor', 'stepAssignBar', 'doneBtn',
  'confirmStepDone', 'confirmSectionDone', 'printPage', 'printThemeTokens',
  /* The first report run's SHADOWED line, read and every one of them this
     program's. Most are the reporting engine (§22 of the family spec): the
     shell gained the Pipeline's copy of it in the 17 Sep directive port, and
     that copy reads the PIPELINE's LAYER_MAPS/PRINT_DOCS — so left to the
     shell, every Architecture register and report would print the Pipeline's
     layers. Executive Readiness and Governance carry their own for the same
     reason. The rest — isPhase5Step, renderStepContentBody, stampStepDone,
     the viz* charts, setInsightsTab, the management hub — are the program's
     own data behind a shared name. */
  '_pbStrip', '_pdFormsToText', 'apBlock', 'apStrip', 'erBarBlock', 'erBlock',
  'erFigRow', 'erHead', 'erHeadLg', 'erStatement', 'isPhase5Step', 'lyCap',
  'lyDate', 'lyDepthCtl', 'lyGaps', 'lyRegister', 'lyRender', 'lyText',
  'mgmtHubContent', 'mgmtHubDoc', 'printBar', 'printDocCover', 'printDocument',
  'renderStepContentBody', 'setInsightsTab', 'stampStepDone', 'vizHealthGauge',
  'vizStatStrip', 'vizTimeline',
  /* The second run's SHADOWED line — reached only once the engine above came
     across. The step renderers the shell names after the Pipeline's steps,
     the management hub's charts and rows, and the rest of the print helpers. */
  '_pdStrip', 'lyList', 'lyLive', 'lyMissing', 'lyRow', 'mgBurnup', 'mgRowHtml',
  'mgSignals', 'mgStats', 'mgVelocity', 'mgWeek', 'mgWorkload', 'printCurrentPage',
  'printDateLine', 'printFooterText', 'renderStep11', 'renderStep21', 'renderStep22',
  'renderStep23', 'renderStep24', 'renderStep31', 'renderStep41', 'renderStep43',
  'renderStep44',
  /* Third run's SHADOWED line, same verdict. */
  'lyRowHtml', 'mgDueSave', 'saveSection11', 'stepNameOf',
  /* Called by module.js on the first render / every render — see CARRY. */
  'scheduleGateRefresh', 'p5InstallPrintUnits', 'dgdResolveClosed'
];

/* Content tables to lift even though the shell declares the same name —
   keyed identically to the Pipeline's, so the wrong one looks right. */
const PORT_VARS = ['CAROUSEL_CONTENT', 'STEP_FLOW', 'PHASE_VIDEOS', 'MILESTONES',
  /* The reporting engine's tables — see the note on the ly- and er- names above.
     Shell-declared too, with the Pipeline's layers in them. */
  'LAYER_MAPS', 'DEPTHED_OUTPUTS', 'PRINT_DOCS',
  /* The program name every printed page carries; the shell's says the Pipeline. */
  'PRINT_MODULE_NAME'];
/* Left to the shell on purpose (SHADOWED VARS): Collab, TAB_ID, carouselState,
   ORG_PALETTE and SAMPLE_LOCAL_ID are session/chrome state, one per page. */

/* Declared by the reference, owned by the shell. PH is registered through
   Modules.define() in module.js. */
const SKIP_VARS = ['PH', 'data', 'UI', 'SK', 'currentPage', 'currentStep', 'currentPhase', 'PHASES'];

const ALIASES = { PHASES: 'PH' };
function rewriteAliases(code) {
  return Object.keys(ALIASES).reduce((out, from) => out.replace(
    new RegExp('(?<![A-Za-z0-9_$.])' + from + '(?![A-Za-z0-9_$])', 'g'), ALIASES[from]), code);
}

/* ── Page ids ──────────────────────────────────────────────────
   The reference calls the overview 'readiness' and a phase landing
   'phaseHome', as Executive Readiness did; the shell calls them 'pipeline' and
   'phase'. Unlike ER, 'readiness' is ALSO a data key in this program — the
   compute layer's score `{"compute":{"readiness":2,…}}` and its question row
   `[['readiness','Infrastructure readiness…']]` — so the rewrite skips a quoted
   word that opens an array or object (`[` or `{` before it). Every page-id use
   follows `===`, `!==`, `go(`, `id:` or `=`. */
const PAGE_IDS = { readiness: 'pipeline', phaseHome: 'phase' };
function rewritePages(code) {
  return code.replace(/(?<![\[{]\s*)(\\?['"])(readiness|phaseHome)\1/g, (m, q, id) => q + PAGE_IDS[id] + q);
}

const HOPS = new RegExp('(?:\\.\\./)+' + MEDIA.replace(/[-/]/g, '\\$&'), 'g');
function rewriteMedia(code) {
  return P.rewriteMedia(code.replace(HOPS, MEDIA), MEDIA);
}

/* ── Behaviour the reference build never had ───────────────────
   See tools/port-ai-architecture.js: the shell's team model means a step
   assigned to someone is theirs (or an administrator's) to sign off. */
const PATCHES = [{
  /* The button. Its signature is the shell's (onclick, disabled, label,
     complete, helper) plus `level`, so the graft is the shell's own doneBtn
     rule, one line: a step assigned to someone else is not this reader's to
     sign off, and that outranks the required-fields helper. Admins are never
     blocked; stepCompleteLock is the shell's and reads the MODULE-scoped
     assignment (js/features/assignments.js). The reference prints `helper`
     unescaped, so the reason (which carries member names) is escaped here. */
  name: 'doneBtn honours the step assignment',
  in: 'doneBtn',
  after: "var _sec=level==='section';",
  insert: "\n  /* PORTED-IN (tools/port-ai-architecture.js): the shell's assignment rule. */"
    + "\n  var _lock=(!complete&&typeof stepCompleteLock==='function')?stepCompleteLock(currentStep):'';"
    + "\n  if(_lock){disabled=true;helper=esc(_lock);}"
}, {
  /* …and ENFORCED, not only painted: every completion path goes through
     these two (markStepDone, the section savers, any handler that calls them). */
  name: 'confirmStepDone enforces the step assignment',
  in: 'confirmStepDone',
  replace: "if((data.completedSteps||{})[sid])return true;",
  with: "if((data.completedSteps||{})[sid])return true;if(typeof completeBlocked==='function'&&completeBlocked(sid))return false;"
}, {
  /* A section here is a LETTER inside the open step ('A'…'E' are the five
     tabs of 1.1), so the assignment asked about is the open step's. */
  name: 'confirmSectionDone enforces the step assignment',
  in: 'confirmSectionDone',
  replace: "if((data.completedSections||{})[s])return true;",
  with: "if((data.completedSections||{})[s])return true;if(typeof completeBlocked==='function'&&completeBlocked(currentStep))return false;"
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
    // Already at the start of a line? Then there is nothing to do.
    let j = i - 1;
    while (j >= 0 && (skel[j] === ' ' || skel[j] === '\t')) j--;
    if (j < 0 || skel[j] === '\n') continue;
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

const splitDeps = [...new Set([...splitNames, ...paramHandlers.names, ...valueNames])]
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
const declAt = name => {
  const i = REF_SKEL.search(new RegExp('^var\\s+' + name + '\\s*=', 'm'));
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
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
      const text = src.slice(start, i + 1);
      if (text.trim() && text.trim() !== ';') out.push({ at: start, text: text.trim(), skel: REF_SKEL.slice(start, i + 1) });
      start = i + 1;
    }
  }
  return out;
})();

/* The statements that FILL one of the given tables after it is declared, in
   the reference's own order. A WRITE into the table — `V.prop =`, `V[k] =` —
   and never `==`, `===` or `=>`; tested on the skeleton, so a match inside a
   string or a comment cannot count. Requiring a write rather than a mention is
   what attributes `TEVV_CHARS.forEach(function(c){TEVV_SC_CHAR[c.sc]=c.k})` to
   TEVV_SC_CHAR, which it fills, instead of to TEVV_CHARS, which it reads. */
function fillsFor(names) {
  const out = [];
  (names || []).forEach(v => {
    const write = new RegExp('(?<![A-Za-z0-9_$.])' + v
      + '\\s*(?:\\[[^\\]]*\\]|\\.[A-Za-z_$][A-Za-z0-9_$]*)+\\s*=(?![=>])');
    topLevelStatements.forEach(s => {
      if (/^(?:\/\*|\/\/|function\s|var\s)/.test(s.text)) return;  // a declaration, not a fill
      if (!write.test(s.skel)) return;
      if (out.some(f => f.at === s.at)) return;                    // one statement, one emit
      out.push({ at: s.at, text: s.text, var: v });
    });
  });
  return out.sort((a, b) => a.at - b.at);
}

/* ── Load-time statements this program cannot lose ─────────────
   The table-fill rule below carries a statement that WRITES into a table
   (`V.x =`, `V[k] =`). This build has load-time code that is neither a
   declaration nor that shape, and is still the program's:

     · Object.keys(LAYER_SCHEMAS).forEach(… groups.push({id:'jurisdiction'…}))
       — adds the Jurisdiction group to every layer schema. A `.push`, so the
       fill rule cannot see it; without it no layer register shows a
       jurisdiction and the jurisdiction map has nothing to draw from.
     · the diagram's drag-and-drop (`_dd`) mousemove/mouseup listeners, the
       jurisdiction map's pan listeners, and the full-bleed diagram's resize
       listener — the reference wires each once, at load, onto document/window.

   Each anchor must match exactly ONE depth-zero statement, or the run stops:
   a reference edit that moves one is caught rather than shipped. They are
   emitted inside the IIFE (they read _dd and jurPan, which live there), after
   every declaration. Listeners on document/window are safe in <head>.

   NOT carried, and done by module.js on the first render instead, because
   each needs the shell's Store or the document at run time: the Store.commit
   hook that repaints the gates and p5InstallPrintUnits(). */
const CARRY = [
  "Object.keys(LAYER_SCHEMAS).forEach(function(_jk){",
  "if(typeof window!=='undefined'&&window.addEventListener){window.addEventListener('resize',function(){sizeDiagFullBleed()});}",
  "document.addEventListener('mousemove',jurPanMove)",
  "document.addEventListener('mouseup',jurPanEnd)",
  "window.addEventListener('mousemove',function(evt){",
  "window.addEventListener('mouseup',function(evt){"
];
const squash = t => t.replace(/\s+/g, '');
const carried = CARRY.map(a => {
  const hits = topLevelStatements.filter(st => squash(st.text).startsWith(squash(a)));
  if (hits.length !== 1) { console.error('CARRY anchor matched ' + hits.length + ' statements: ' + a); process.exit(1); }
  return hits[0];
});

const cfg = {
  PORT: PORT.concat(splitDeps), PORT_VARS, SKIP_VARS, SHELL_GLOBALS,
  ASSIGN_FNS: overridden
};
/* ── The closure has to walk the table fills too ────────────────
   The fills carried below (see "A table that is FILLED after it is declared")
   are code, and they call things: LAYER_MAPS.risk reaches lyTestText and
   lyEvidenceText, and nothing else in the program names either. The closure
   starts from the entry set and follows calls, and a fill is in neither — so
   the tables came across complete and the two functions they call did not,
   which is a ReferenceError the first time a risk record prints its tests.

   Rather than list them by hand, run the closure again with whatever the fills
   call added to the entry set, until it stops growing. Two passes in practice;
   the bound is there so a cycle cannot spin. */
let res = P.closure(src, cfg, SHELL);
for (let round = 0; round < 4; round++) {
  const extra = new Set();
  fillsFor(res.vars).concat(carried).forEach(f => {
    P.identsInCode(f.text).forEach(n => {
      if (topLevelFuncs.has(n) && !res.found.includes(n)
        && !SHELL_GLOBALS.has(n) && !cfg.PORT.includes(n)) extra.add(n);
    });
  });
  if (!extra.size) break;
  console.log('table-fill dependencies pulled in:', [...extra].sort().join(', '));
  cfg.PORT = cfg.PORT.concat([...extra]);
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
   ${ID}/program.js — AI-Ready Architecture, the program itself
   ─────────────────────────────────────────────────────────────
   GENERATED by tools/port-ai-architecture.js from
   ${rel(REF)}.
   Re-run that script rather than editing this file by hand; the PORT
   list there is what decides which functions live here.

   Everything is on RG, the single global this module owns. It has to
   be: the reference calls these renderStep, renderInsights, doneBtn,
   ta and sel, and so do js/app.js, js/insights.js and
   js/steps/phase*.js — the Pipeline's code, which the shell loads for
   every module. Inline handlers in the generated markup are rewritten
   to match: onclick="RG.saveWB('x')".

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
const refEmpty = P.extract(src, 'emptyData');
if (!refEmpty) { console.error('the reference declares no emptyData()'); process.exit(1); }
const refInits = P.topLevelVarInits(src);
['PH', 'MILESTONES', 'PHASE_COMPLETE_MSG'].forEach(v => {
  if (!refInits.has(v)) { console.error('the reference declares no ' + v); process.exit(1); }
});
const handOver = [
  '',
  '  /* Handed to module.js (see the port script): the reference\'s own tables. */',
  '  ' + NS + '.PH = ' + refInits.get('PH') + ';',
  '  ' + NS + '.MILESTONES = MILESTONES;',
  '  ' + NS + '.PHASE_COMPLETE_MSG = PHASE_COMPLETE_MSG;',
  '  ' + NS + '.emptyData = ' + refEmpty.replace(/^function emptyData/, 'function') + ';',
  '  /* p5Read() swaps the global data for a clone while it renders a read-only',
  '     view, and the reference\'s Store.commit refused writes for that long. The',
  '     shell\'s commit cannot see the counter in here, so module.js asks. */',
  '  ' + NS + '.readOnlyDepth = function () { return _readOnlyRender || 0; };'
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
const pass = code => indent(rewriteAliases(rewritePages(rewriteMedia(rewriteValueHandlers(rewriteParamHandlers(
  rewriteSplitHandlers(P.rewriteHandlers(code, found, NS, SHELL_GLOBALS), found), found), found)))));

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

const fills = fillsFor(vars);
if (fills.length) console.log('table fills carried:', fills.map(f => f.var).join(', '));

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
const refVarNames = new Set(P.topLevelVars(src));
const carryVars = [...new Set(carried.flatMap(c => [...P.identsInCode(c.text)]))]
  .filter(n => refVarNames.has(n) && !vars.includes(n) && !SHELL.has(n) && !SKIP_VARS.includes(n));
if (carryVars.length) { console.error('CARRY reads tables that were not ported: ' + carryVars.join(', ')); process.exit(1); }
const carryBlock = '\n\n  /* Load-time statements carried from the reference — see CARRY in the port script. */\n'
  + carried.slice().sort((a, b) => a.at - b.at).map(c => pass(c.text)).join('\n');
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
const KNOWN_LOCALS = new Set(['countNote', 'get', 'ptB', 'ptL', 'ptT']);
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

const stray = (emitted.match(/(?:\.\.\/)+assets\/media\//g) || []).length;
if (stray) {
  failed = true;
  console.log('\nMEDIA     : ' + stray + ' path(s) still carry the review build\'s ../ hops.');
}
if (failed) process.exit(1);
console.log('\n✓ every call resolves, every handler is prefixed, every media path is absolute');
