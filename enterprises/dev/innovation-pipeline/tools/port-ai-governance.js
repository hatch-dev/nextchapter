#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   port-ai-governance.js — lift the Responsible AI Governance
   program out of its reference build and into a module
   ─────────────────────────────────────────────────────────────
   `enterprises/dev/responsible-ai-governance-prototype/Governance-app.js` is a
   complete, standalone COPY of the whole application (1.0 MB, 793
   top-level functions) that the program was built in. Everything it
   duplicates — the store, sign-in, organizations, the admin console,
   the header, the sidebar, chat, notes, the AI Guide, voice, email
   notifications, assignments, printing — is the shell's here. What we
   want out of it is only the program: eleven screens, seventeen step
   bodies, eighteen output reports, the five portfolios, the system
   view, the testing centre, the compliance dashboard, the analytics
   shelf, and the several thousand handlers behind them.

   The machinery is tools/lib/js-port.js; read its header for why each
   rule is a rule. This file is the CONFIGURATION — which functions to
   lift, which names stay the shell's, where the media went — and the
   emitter.

   Usage:
     node tools/port-ai-governance.js                # report only
     node tools/port-ai-governance.js --emit         # to its real path
     node tools/port-ai-governance.js --emit <file>

   Which functions get ported is the PORT list below. It is the ENTRY
   set, not the whole list: the closure follows every call each of
   these makes — including the ones written inside onclick strings —
   and brings those across too. So naming the page-level renderers is
   enough; the several hundred helpers behind them resolve themselves.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const ID = 'ai-governance';
const NS = 'RG';
const REF_DIR = path.join(ROOT, 'enterprises', 'dev', 'responsible-ai-governance-prototype');
const REF = path.join(REF_DIR, 'Governance-app.js');
const OUT = path.join(ROOT, 'js', 'modules', ID, 'program.js');
const MEDIA = 'assets/media/' + ID + '/';

if (!fs.existsSync(REF)) {
  console.error('the reference build is not at ' + path.relative(ROOT, REF) + '.');
  console.error('If the review builds moved again, update REF_DIR here and in tools/ai-governance-smoke.js.');
  process.exit(1);
}

/* ── Names that stay the SHELL's ───────────────────────────────
   A name belongs here when the shell's version IS the reference's, or is the
   shell's own chrome that the reference had a local equivalent of and we want
   the shell's. Everything else the reference defines comes across, even when
   the two look alike — see the note on `likert` in port-exec-readiness.js for
   why "looks alike" is not good enough.

   This build was a standalone copy of the app, so it carries a second store, a
   second identity system, a second header, a second set of floating panels, a
   second email queue and a second assignments model. All of that is listed
   here; that is the point of the port. What survives is the program.

   Three entries in here are load-bearing for MODULE ISOLATION, which is the
   one thing this port must not get wrong — the program's work has to stay in
   its own workspace row and touch no other program's:

     Store / saveData / loadData   the shell's Store is the server. Every write
                                   is POST /workspace with module=ai-governance
                                   (api/sql/workspace-modules.sql), so a save
                                   here can only ever land in this program's
                                   row. The reference's Store is a localStorage
                                   adapter with no module in it at all.
     getAssigns / toggleAssign     assignments are keyed (org, module, step,
                                   member) server-side. The reference's are
                                   keyed by step alone, so assigning 1.1 here
                                   would have claimed 1.1 in every program.
     clearData                     the shell's resets THIS program's document
                                   and keeps the ORG-level keys (the roster,
                                   the enterprise profile, the members). The
                                   reference's prunes the roster down to
                                   administrators — an organization-wide edit,
                                   made from inside one program, that the other
                                   eleven would have inherited.

   The list is a set of promises, and run() below keeps it honest: it
   intersects this with what the shell actually defines, so a name that has
   moved or lives inside an IIFE gets ported rather than silently resolving to
   nothing. */
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
   thing, the pages the shell routes to and the seams module.js calls. */
const PORT = [
  /* ── The eleven pages the module registers ──────────────────
     Named for the shell's page ids in js/modules/ai-governance/module.js; these
     are the reference's own renderer names. The reference called its overview
     page 'overview' and the shell calls it 'pipeline' — rewritten below, see
     PAGE_IDS. */
  'renderModuleOverview',    // pipeline  — the Framework tab
  'renderPhaseLandingPage',  // phase     — the five phase landings
  'renderStep',              // step      — the step frame every body sits in
  'renderOutcomePage',       // outcome   — the eighteen output reports
  'renderPhase5',            // phase5    — the Governance Dashboard tab
  'renderInsights',          // insights  — this program's own live feed shelf
  'renderPortfolioPage',     // portfolio — Identify / Assess / Manage / Emergency / Archive
  'renderSystemView',        // system    — one AI system, its risks and its testing
  'renderEthicsOverviewPage',// ethicsov  — the Responsible AI spine
  'renderGovReview',         // govreview — the standing governance review
  'renderMgmtHub',           // mgmt-hub  — the team/management hub
  /* reports — the Report Manager (Paul's ruling, 14 Sep 2026). In the
     reference build its only door is that build's own More menu
     (_navMoreHtml), which is the SHELL's menu here, so nothing ported reaches
     this renderer and the closure would never ask for it. module.js declares
     the page and the More item; this line is what puts the code in the file. */
  'renderReports',
  /* ── Seams module.js calls directly ─────────────────────────
     harvestOpenFields is the whole reason this program needs a beforeNavigate
     hook: its textareas carry no per-keystroke save (none of its field
     builders has an onchange), so the open page is harvested at the moment of
     navigation instead. isStepDone and mgSteps are the completion and
     assignable-step definitions the shell asks the module for. */
  'harvestOpenFields', 'isStepDone', 'mgSteps', 'ctxLabel',
  /* The lock layer's field→record map. The SHELL calls this one (js/app.js),
     which is why it never appeared in a SHADOWED report: nothing ported calls
     it, so the closure never asked. Its table is this program's — 'exp_' is
     the Assessment Battery's exposure block here and an experiment in the
     Pipeline — and module.js hands it to the shell through the idToRecordKey
     hook. Left to the shell's, every lock this program took was filed under a
     Pipeline-shaped key that its own lockBlocked() calls could never match. */
  'idToRecordKey',
  'migrateCapacityDecisions', 'migrateNistSummary',
  /* The sample workspace — this program's own, and the reason the More menu
     offers a seed at all. The shell's seedData() builds the PIPELINE's
     document (ideas, projects, a capital envelope), which shares not one field
     with this one. */
  'seedSampleData',
  /* The reference's own Back button. Unlike goBack() above this is not a
     navStack reader — it is a fixed "← Back" to Home — so it is the program's
     and comes across. pfBackBtn, which IS a navStack reader, calls the shell's
     goBack() from inside a handler string and so keeps working unchanged. */
  'backBtn',
  /* ── Named because the SHELL has one too, and the two differ ──
     Every one of these was reported on the SHADOWED line of a report run,
     read side by side, and found to be this program's rather than the
     shell's. Left off the list the shell's answers, which is the failure
     mode with no symptom: the page renders, in the Pipeline's shape.

       btn            3rd argument is a COLOUR here and a CLASS in the shell,
                      so every ported button would have rendered classless
                      with `var(--gold)` written into its class attribute.
       badge          inline tint (#RRGGBB + '18') vs the shell's --c custom
                      property. Same pill, different mechanism.
       vp             identical text — and it must still be ported, because
                      it reads CAROUSEL_CONTENT, which lives inside this
                      module's IIFE. The shell's copy cannot see it and would
                      hand every step the PIPELINE's slides.
       vpCarousel     the frame that vp() draws into.
       renderStepContent  the body of every step, and the shell's is the
                      Pipeline's seventeen steps under the same name.
       ta / sel       the shell's save through fldSave() on every keystroke
                      against Pipeline-specific id prefixes, which would drop
                      every field in this program silently; this build
                      harvests the open page on navigation instead.
       milestone      reads STEP_MILES (this program's) rather than
                      MILESTONES, and draws the reference's card markup.
       phaseColorFor  has an entry for phase 5. The shell's stops at 4 and
                      falls back to the accent, which would put one tint on
                      every Govern-phase surface.
       stepAssignBar  the reference's own bar. Its buttons call the SHELL's
                      getAssigns/toggleAssign (above), which are the
                      module-scoped ones — so this is markup only, and the
                      assignment it shows is still per (org, module, step).
       archivePanel, mgmtHubContent, printMgmtAnalytics, renderOutGovFW,
       setInsightsTab, vizHealthGauge, vizRadar, vizStatStrip, vizTimeline
                      same name in the shell, the Pipeline's data behind it. */
  'btn', 'badge', 'vp', 'vpCarousel', 'renderStepContent', 'ta', 'sel',
  'milestone', 'phaseColorFor', 'stepAssignBar', 'archivePanel',
  'mgmtHubContent', 'printMgmtAnalytics', 'renderOutGovFW', 'setInsightsTab',
  'vizHealthGauge', 'vizRadar', 'vizStatStrip', 'vizTimeline',
  /* doneBtn takes (onclick, disabled, label, taskId, sectionComplete) here and
     (onclick, disabled, label, complete, helper) in the shell. Call one with
     the other's arguments and you get the 'already complete' button, which
     looks unlocked rather than broken. likert writes likSet( into an onclick
     string, and that has to land on this program's harvest-first version.
     The mg* seven are the management hub's own charts and rows. */
  'doneBtn', 'likert', 'likSet', 'mgStats', 'mgRowHtml', 'mgWorkload',
  'mgBurnup', 'mgVelocity', 'mgSignals', 'mgWeek', 'mgDueSave',
  /* Completion. The shell's confirmStepDone/completeStep are the Pipeline's,
     over the Pipeline's gates; this program gates on its own data (dataGateOK)
     and stamps who completed a step as well as when. */
  'confirmStepDone', 'confirmSectionDone', 'completeStepGated', 'completeStep',
  'refreshGates', 'stampStepDone', 'nextStepAfter',
  /* The printable documents. The shell has no equivalent: these are register
     and report documents assembled out of this program's own data.

     printThemeTokens comes with them, and it has to. The shell's printPage
     prints the LIVE document, so it inherits styles.css, themes.css and the
     module sheet and needs no tokens; the shell's own copy of this function
     says as much and is dead code there. This program's printPage is the
     reference's — it opens a BARE window and document.writes a self-contained
     page into it, so whatever this function returns is the ONLY stylesheet the
     PDF has. The reference's version emits the base tokens, then the nine
     --t-* status colours the module sheet adds, then overrides the accent set
     to governance teal. The shell's emits the suite block alone: the Pipeline's
     ORANGE, and not one of the nine. Left to the shell's, every exported PDF
     came out with an orange accent and every --t-* coloured element lost its
     colour entirely. */
  'printPage', 'printDocFromScreen', 'printRegisterDoc', 'printThemeTokens',
  /* The daily analytics snapshot. The reference ticks it from its boot block,
     which the port cannot lift; module.js calls it from ready() instead. */
  'govDailyTick', 'computeGovSnapshot',
  /* The AI Guide's quick questions and what it is told about the open screen.
     module.js hands both to the shell (coachPresets / coachContext). */
  'ctxLabel'
];

/* Content and lookup tables to lift even though the shell declares something
   of the same name. The closure leaves a shell-owned name alone, which is
   right for `data` and `UI` and wrong for these two: they are the places where
   the shell's variable holds the PIPELINE's content under keys identical to
   this program's, so nothing about the wrong one looks wrong.

     CAROUSEL_CONTENT  the Why/What/How/Outcome slides above every step body,
                       keyed '1.1', '2.3' … Left to the shell's, every
                       Governance step would show the Pipeline's slides.
     STEP_FLOW         the tick row on a phase landing, keyed 1–5. Left to the
                       shell's, Phase 1 would read the Pipeline's flow.
     PHASE_WRAPUPS     the milestone banner's closing paragraph per phase.
                       Also read through Modules.PHASE_WRAPUPS(), but the
                       reference's own phaseWrapCard() reads the global.
     PHASE_DESCS       the paragraph under each phase landing's title.
     PHASE_VIDEOS      THE MEDIA MAP — {0..5} → assets/media/ai-governance/*.mp4
                       and its label. Left to the shell's, all six players on
                       the phase landings would have played the Pipeline's
                       videos, which is a wrong film rather than a missing one.

   Anything that turns up on the SHADOWED VARS line and is this program's
   content belongs here too. */
const PORT_VARS = ['CAROUSEL_CONTENT', 'STEP_FLOW', 'PHASE_WRAPUPS',
  'PHASE_DESCS', 'PHASE_VIDEOS'];

/* Names the reference declares at top level that must NOT come across: the
   shell owns the same thing and the ported code should read the shell's. `PH`
   is the phase spine, and it is registered through Modules.define() in
   module.js so that the sidebar, the router and My Assignments see the same
   one; a second copy inside this file would drift from it silently. */
const SKIP_VARS = ['PH', 'data', 'UI', 'SK', 'currentPage', 'currentStep', 'currentPhase',
  /* An ALIAS over a shell global, not content — see ALIASES below. */
  'PHASES'];

/* ── Aliases the reference declares over a shell global ────────
   `var PHASES=PH;` — "single phase/step registry (Spec §3.3), legacy literal
   collapsed onto PH". Ported verbatim it is a LOAD-TIME read of PH, and at
   load there is no PH: js/modules/boot.js writes a module's scripts into the
   <head>, and the shell declares `var PH = Modules.PH()` further down the
   page. So the emitted file threw "PH is not defined" before a single line
   of it ran, which takes the whole program down with it — every page, not
   one screen.

   Deferring the read would work and is more machinery than this needs. The
   two names are the same array by the reference's own definition, so the
   alias is resolved at PORT time instead: the declaration is skipped, and
   every read of PHASES becomes a read of PH — which the shell keeps pointed
   at this module's phase spine (js/modules/ai-governance/module.js), so the
   one registry the spec asks for is still one registry.

   Whole-word and outside property access, so `x.PHASES` and a sentence about
   phases are both left alone. */
const ALIASES = { PHASES: 'PH' };
function rewriteAliases(code) {
  return Object.keys(ALIASES).reduce((out, from) => out.replace(
    new RegExp('(?<![A-Za-z0-9_$.])' + from + '(?![A-Za-z0-9_$])', 'g'), ALIASES[from]), code);
}

/* ── Page ids ──────────────────────────────────────────────────
   The reference called the program-overview page 'overview'. Our shell's route
   table — and the tab labels in config/catalogue.json — call it 'pipeline',
   the name every module shares. The label the reader sees is still
   "Framework"; only the internal id differs.

   go('overview') would sail through the shell's go(): it matches no step, no
   outcome and no phase pattern, so currentPage is set to a name render() has
   no branch for and the reader gets a blank screen with nothing in the
   console. Rewritten as a whole quoted word, so prose about "overview" is
   untouched.

   The reference already routes 'pipeline' to the same renderer ("the donor
   route lands on the overview, never a blank", R-9), so the two agree. */
const PAGE_IDS = { overview: 'pipeline' };
function rewritePages(code) {
  return code.replace(/(['"])(overview)\1/g, (m, q, id) => q + PAGE_IDS[id] + q);
}

/* ── Media paths ───────────────────────────────────────────────
   The reference used to be a flat folder with its videos beside index.html.
   Since 2026-09-01 the eight media files live once, under assets/media/
   ai-governance/, and the review build points at them with ../../../ — correct
   from where that build is served, and wrong here, because everything in a
   module resolves against <base href="/apps/">. So the hops are walked off for
   THAT ONE FOLDER before the shared rules run; anything else carrying a path
   is still passed through untouched.

   Same rule, and the same reason, as tools/port-exec-readiness.js. Leave it
   out and every video in the program renders as a black box with nothing in
   the console. */
const HOPS = new RegExp('(?:\\.\\./)+' + MEDIA.replace(/[-/]/g, '\\$&'), 'g');
function rewriteMedia(code) {
  return P.rewriteMedia(code.replace(HOPS, MEDIA), MEDIA);
}

/* ── Behaviour the reference build never had ───────────────────
   The reference was a standalone copy with no team model in it, so nothing in
   it knows about step assignments. Here they exist and they mean something:
   assignment names who is responsible for finishing a step, and only they — or
   an administrator — may sign it off. The shell enforces that for the Pipeline
   inside doneBtn(); this program's doneBtn came from the reference and
   enforced nothing, so any member could mark any step complete.

   Grafted in by rule rather than by hand, for the same reason handler names
   and media paths are: program.js is regenerated and a hand-edit would be
   lost. Anchored on an exact, unambiguous slice — if the reference changes it
   the patch stops matching and applyPatches() throws before anything is
   written, rather than silently shipping an unenforced program. */
const PATCHES = [{
  /* ── "+ Add" must not throw away what is typed beside it ─────
     This program has no per-keystroke save: not one of its field builders
     carries an onchange, because the reference harvests the open page on
     navigation instead. A value therefore sits in the DOM and nowhere else
     until something harvests it, and anything calling render() before that
     repaints the field from `data` and the typing is gone.

     Every sibling add/remove handler on a card knows this and harvests first:
     addPartner calls harvestPartners(), removeBoardMember calls harvestEF(),
     addRcItem calls harvestRcLists(), addPrioItem calls harvestPrio().
     addGrAgendaItem is the one that does not, and it sits on step 4.2's
     Standing Governance Meeting card beside "First meeting date" — which the
     4.2 completion gate requires. Typing the date and then adding an agenda
     item wiped the date, and the step then refused to complete, reporting that
     same date as still needed. Both halves of the reported bug, from one
     missing harvest.

     Anchored on the push, so the harvest lands after the new item has been
     read out of its own input and before anything touches `data`. */
  name: 'addGrAgendaItem banks the card before it re-renders',
  in: 'addGrAgendaItem',
  replace: "if(!v)return;var gr2=data.govRhythm||(data.govRhythm={});",
  with: [
    'if(!v)return;',
    '  /* PORTED-IN (tools/port-ai-governance.js): bank what is on the card',
    '     before mutating it. This handler re-renders, and the fields beside it',
    '     — the first meeting date above all — live only in the DOM until',
    '     something harvests them. Same first move as addPartner,',
    '     removeBoardMember, addRcItem and addPrioItem. */',
    "  harvestGrLists();",
    "  ['meetingDuration','firstMeeting','govFrequency'].forEach(function(_f){",
    "    var _el=document.getElementById('gr_'+_f);",
    "    if(_el)data.govRhythm[_f]=_el.value;",
    '  });',
    '  var gr2=data.govRhythm||(data.govRhythm={});'
  ].join('\n')
}, {
  /* ── Step 4.2's fields have to survive navigation too ────────
     harvestOpenFields() is what the module's beforeNavigate seam calls, and it
     is the reason a half-filled page is not lost when the reader clicks away.
     It covers nine blocks — the Assessment Battery, decision rights,
     ownership, incentives, stakeholders, culture — and neither of the two on
     step 4.2, so the Standing Governance Meeting and Deployment & Integration
     fields reached `data` through their own Save buttons and no other way.
     Type the first meeting date, click any other step, and it was gone, with
     the same end result as the bug above: a step that will not complete
     because the date it asks for was thrown away.

     The three blocks follow the shape of the nine already there: guarded on
     one id so nothing runs while the page is off screen, the field lists their
     own savers use (saveGR, saveEO, saveFR), and `hit` so the harvest still
     ends in the single saveData() every other branch shares. */
  name: 'harvestOpenFields banks steps 4.2 and 4.4',
  in: 'harvestOpenFields',
  after: "if(document.getElementById('gc_raiseChannel')){if(!data.govCulture)data.govCulture={};['raiseChannel','raiseResponse','riskSharing'].forEach(function(f){var v=val('gc_'+f);if(v)data.govCulture[f]=v});hit=true}",
  insert: [
    '',
    "/* PORTED-IN (tools/port-ai-governance.js): the blocks on steps 4.2 and 4.4.",
    '   Without them the Standing Governance Meeting, the Deployment & Integration',
    "   fields and the First Governance Review's three written answers were banked",
    '   by their Save buttons alone, so navigating away lost them — the first',
    '   meeting date the 4.2 gate requires and the starred answers the 4.4 gate',
    '   requires included. */',
    "if(document.getElementById('gr_firstMeeting')){if(!data.govRhythm)data.govRhythm={};harvestGrLists();['meetingDuration','firstMeeting','govFrequency'].forEach(function(f){var v=val('gr_'+f);if(v)data.govRhythm[f]=v});hit=true}",
    "if(document.getElementById('eo_deploymentGate')){if(!data.embedOps)data.embedOps={};['deploymentGate','lightGate','projectMgmt','hr','procurement'].forEach(function(f){var v=val('eo_'+f);if(v)data.embedOps[f]=v});hit=true}",
    "if(document.getElementById('fr_working')){if(!data.firstReview)data.firstReview={};['working','bottlenecks','nextIteration'].forEach(function(f){var v=val('fr_'+f);if(v)data.firstReview[f]=v});hit=true}"
  ].join('\n')
}, {
  /* ── Ticking an agenda item must not erase the answers ───────
     Exactly the addGrAgendaItem bug, one step along. walkFR marks an item of
     the First Governance Review covered, then saveData() and render() — and
     step 4.4's three written answers (What is working / Where do things get
     stuck / What will you change, all starred and all required by the gate)
     live only in the DOM until something harvests them.

     So the step could not be finished at all. The gate wants six agenda items
     covered AND the three answers filled; ticking an item wiped the answers,
     writing the answers did not tick the items, and one click of "Mark
     covered" undid however much prose had just been typed. The reader gets one
     or the other and never both. */
  name: 'walkFR banks the review before it re-renders',
  in: 'walkFR',
  replace: "var wk=data.firstReview.walk;",
  with: [
    '/* PORTED-IN (tools/port-ai-governance.js): bank the written answers before',
    '   toggling the tick — this handler re-renders, and they live only in the',
    '   DOM until harvested. Same first move as addPartner and addRcItem. */',
    "  ['working','bottlenecks','nextIteration'].forEach(function(_f){",
    "    var _el=document.getElementById('fr_'+_f);",
    '    if(_el&&_el.value)data.firstReview[_f]=_el.value;',
    '  });',
    '  var wk=data.firstReview.walk;'
  ].join('\n')
}, {
  name: 'the print document declares utf-8',
  in: 'printPage',
  replace: "w.document.write('<html><head><title>'",
  with: "w.document.write('<html><head><meta charset=\"utf-8\"><title>'"
}, {
  name: 'doneBtn honours the step assignment',
  in: 'doneBtn',
  /* Anchored on the code, with no leading whitespace: this runs on the body as
     extracted, before the emitter indents it. The line is the one that decides
     the helper text under an ENABLED button, so the graft lands after both
     `disabled` and `helperMsg` exist and before either is read. */
  after: "var helperMsg=(typeof sectionComplete==='string')?sectionComplete:'Complete required fields (*) first.';",
  insert:
    "\n  /* PORTED-IN (tools/port-ai-governance.js): a step assigned to someone"
    + "\n     else is not this reader's to sign off. Outranks the required-fields"
    + "\n     gate — telling a member to fill in fields they are not responsible"
    + "\n     for is a dead end. Admins are never blocked, and an unassigned step"
    + "\n     stays open to anyone, so this is inert until somebody is named."
    + "\n     Checked against currentStep, so every tab and section of a step"
    + "\n     follows that step's assignment; stepCompleteLock is the shell's and"
    + "\n     reads the module-scoped assignment (js/features/assignments.js). */"
    + "\n  var _lock=(typeof stepCompleteLock==='function')?stepCompleteLock(currentStep):'';"
    + "\n  if(_lock){disabled=true;helperMsg=_lock;}"
}, {
  /* …and the line that PRINTS the helper has to honour it too.
     The graft above sets helperMsg, and the reference then threw it away: the
     return re-decides the text from the step's own data gate, so a member
     blocked by assignment on a step whose gate is also unmet was told to "mark
     all four tabs complete first" — work they are not allowed to do, which is
     the exact dead end the comment above says the rule outranks. The rule was
     right and only half of it reached the page.

     Caught by tools/assignment-rules-check.js, which asks each program for the
     block it shows and reads what it says. */
  name: 'the assignment block outranks the data gate in the helper line',
  in: 'doneBtn',
  replace: "((typeof taskId==='string'&&!dataGateOK(taskId))?dataGateMsg(taskId):helperMsg)",
  with: "((!_lock&&typeof taskId==='string'&&!dataGateOK(taskId))?dataGateMsg(taskId):helperMsg)"
}, {
  /* ── …and the rule has to be ENFORCED, not only painted ──────
     The two patches above decide what the button LOOKS like. A disabled button
     is not a permission check: completeStepGated() is reachable from the step
     nav, from a section's own control and from any handler that calls it, and
     every one of those paths goes through confirmStepDone. Ruled 9 Sep 2026 —
     a member may complete only what is assigned to them, and an unassigned
     step is the administrator's.

     These grafts lived in the reference build until it was refreshed on
     15 Sep 2026, which dropped them; nothing in the reporting-engine directive
     touches either function, so they were lost rather than superseded. Moved
     here so a future refresh cannot lose them again — which is the whole
     reason the patch list exists.

     completeBlocked is the SHELL's (js/features/assignments.js) and reads the
     module-scoped assignment, so it answers for this program's steps and not
     another's. Guarded with typeof, because the reference build runs this file
     standalone where the shell's helper is not there at all. */
  name: 'confirmStepDone enforces the step assignment',
  in: 'confirmStepDone',
  replace: "if((data.completedSteps||{})[sid])return true;",
  with: "if((data.completedSteps||{})[sid])return true;if(typeof completeBlocked==='function'&&completeBlocked(sid))return false;"
}, {
  /* The same rule one level down. A section key is the step's id with a letter
     after it — '4.2a' is a tab of step 4.2 — so the key is reduced to the step
     before it is asked about: the assignment is held against the STEP, and a
     lookup on the raw key would find nobody and wave every tab through. */
  name: 'confirmSectionDone enforces the step assignment',
  in: 'confirmSectionDone',
  replace: "if((data.completed||{})[k])return true;",
  with: "if((data.completed||{})[k])return true;if(typeof completeBlocked==='function'&&completeBlocked(String(k==null?'':k).replace(/^(\\d+\\.\\d+)[a-z]$/,'$1')))return false;"
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

const splitDeps = [...new Set([...splitNames, ...paramHandlers.names])]
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
  fillsFor(res.vars).forEach(f => {
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
   ${ID}/program.js — Responsible AI Governance, the program itself
   ─────────────────────────────────────────────────────────────
   GENERATED by tools/port-ai-governance.js from
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

const footer = `
  /* Everything ported is reachable from the markup above, so all of it is
     exposed. Adding a function to the PORT list is all it takes. */
${found.map(n => '  ' + NS + '.' + n + ' = ' + n + ';').join('\n')}
})();
`;

const indent = s => s.split('\n').map(l => (l.trim() ? '  ' + l : l)).join('\n');
const pass = code => indent(rewriteAliases(rewritePages(rewriteMedia(rewriteParamHandlers(
  rewriteSplitHandlers(P.rewriteHandlers(code, found, NS, SHELL_GLOBALS), found), found)))));

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

fs.writeFileSync(out, header + varBlock + found.map(n => pass(bodyOf.get(n))).join('\n\n') + footer, 'utf8');
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
const unresolved = [...P.callsInCode(emitted)]
  .filter(n => !inScope.has(n) && !SHELL.has(n) && !SHELL_GLOBALS.has(n)
    && !P.JS_KEYWORDS.has(n) && !P.BROWSER.has(n))
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
const stray = (emitted.match(/(?:\.\.\/)+assets\/media\//g) || []).length;
if (stray) {
  failed = true;
  console.log('\nMEDIA     : ' + stray + ' path(s) still carry the review build\'s ../ hops.');
}
if (failed) process.exit(1);
console.log('\n✓ every call resolves, every handler is prefixed, every media path is absolute');
