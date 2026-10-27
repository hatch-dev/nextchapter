#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   port-leader-module.js — lift a Leaders program out of its
   reference build and into a module
   ─────────────────────────────────────────────────────────────
   `leaders/dev/<program>/` is a complete, standalone COPY of the
   whole application (330–390 KB) that the program was built in.
   Everything it duplicates — the store, sign-in, the header, the
   theme toggle, the zoom control, notes, the AI Guide, voice — is the
   shell's here. What we want out of it is only the program: its
   Practice board, its Assess battery, its Dashboard, its Insights
   shelf, its rail, and the several hundred handlers behind them.

   The machinery is tools/lib/js-port.js; read its header for why
   each rule is a rule. This file is the two CONFIGURATIONS — which
   functions to lift, which names stay the shell's, where the media
   went — and the emitter.

   Usage:
     node tools/port-leader-module.js decision-lab
     node tools/port-leader-module.js decision-lab --emit js/modules/decision-lab/program.js
     node tools/port-leader-module.js all --emit          # both, to their real paths

   Which functions get ported is the PORT list in each config. It is
   the ENTRY set, not the whole list: the closure follows every call
   each of these makes — including the ones written inside onclick
   strings — and brings those across too. So naming the page-level
   renderers is enough; the several hundred helpers behind them
   resolve themselves.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');

/* ── Names that stay the SHELL's ───────────────────────────────
   A name belongs here when the shell's version IS the reference's, or is the
   shell's own chrome that the reference had a local equivalent of and we want
   the shell's. Everything else the reference defines comes across, even when
   the two look alike.

   These two programs were built as single-user copies of the app, so they
   carry a whole second store, a second identity system, a second header and a
   second set of floating panels. Most of that is listed here — that is the
   point of the port. What survives is the program.

   The list is a set of PROMISES, and run() below keeps it honest: it
   intersects this with what the shell actually defines, so a name that has
   moved or that lives inside an IIFE gets ported rather than silently
   resolving to nothing. Add freely; a wrong entry costs a few extra lines in
   the output, not a dead screen. */
const SHELL_GLOBALS = new Set([
  /* Core helpers the shell defines identically — fmt is character-for-
     character the reference's. */
  'esc', 'uid', '$', 'fmt', 'render', 'go', 'showToast', 'alert', 'confirm',
  /* Persistence and identity. Store is THE point of this exercise: the
     reference's Store is a localStorage adapter carrying a comment that calls
     itself "the one place to repoint data to a server", and the shell's IS
     that server — POST /workspace, MySQL, one document per organization per
     module. */
  'Store', 'Auth', 'data', 'UI', 'loadData', 'saveData', 'currentUserId',
  'currentOrgId', 'currentPage', 'currentStep', 'currentPhase', 'currentModal',
  'getCurrentUser', 'getOrg', 'actorId', 'API_BASE', 'postJSON', 'getJSON',
  /* Sign-in, sign-up and the entry gate — one identity for all twelve
     programs (js/auth.js, api/controllers/AuthController.php). Most of the
     reference's own are private to its entry screen and are simply never
     reached from any ported page. */
  'signIn', 'signOut', 'setSession', 'clearSession', 'renderEntry',
  'AUTH_ENDPOINT',
  /* The header and the page chrome. `appZoom` and `navMoreOpen` are NOT here:
     the shell keeps both on UI, and the one place the board reads the zoom is
     grafted onto it below (BOARD_USES_SHELL_ZOOM). */
  'orgInitials', 'userAv', 'toggleTheme',
  'setZoom', 'zoomIn', 'zoomOut', 'zoomReset', 'zoomFit', 'syncNavHeight',
  'toggleNavMore', 'closeNavMore', 'toggleSidebar',
  /* The floating panels. All three are the shell's, and all three are
     server-backed or shell-wide: notes are rows in MySQL (js/features/notes.js),
     the AI Guide takes its presets and its system prompt from the module
     (js/features/coach.js), voice is one recogniser for the whole suite. */
  'toggleNotes', 'renderNotesPanel', 'updateNotesCount', 'addNote', 'deleteNote',
  'notesOpen', 'toggleCoach', 'renderCoachPanel', 'sendCoach', 'coachOpen', 'coachMsgs',
  'toggleVoice', 'updateVoiceUI', 'showVoiceToast', 'processVoice',
  'voiceActive', 'recognition', 'voiceTimeout',
  /* The endpoint constant: the shell's, so one change moves every program off
     the direct-to-Anthropic default and onto a proxy. */
  'CLAUDE_API_URL'
]);

/* ── Grafts ────────────────────────────────────────────────────
   Differences the shell forces, applied by rule rather than by hand: the
   generated file is regenerated and a hand-edit would be lost. Each is
   anchored on an exact, unambiguous slice of the reference, so if that
   reference changes the port fails loudly instead of shipping the graft
   silently unapplied.

   Four of them, and every one is the same kind of thing: a place where the
   reference was a standalone single-user build and the shell is not.

   The first is the seed's return value. js/dev/seed.js reads `run() === false`
   as "the operator declined the confirm" and skips the render and the
   authoritative save that follow. The reference returns a bare `undefined`
   there, because in a standalone build nothing was listening — which here
   means declining "Load sample data?" still pushed the untouched document to
   the server. */
function declineFalse(confirmLine) {
  return {
    name: 'seedSampleData reports a declined confirm',
    in: 'seedSampleData',
    replace: confirmLine + 'return;',
    with: confirmLine + 'return false;'
  };
}

/* The seed replaces the PROGRAM's content, not the account.

   The reference was a single-user build and kept identity outside the document,
   so "Seed sample data" could swap `data` wholesale — it only bothered to carry
   `rev` across, because that is a write-ordering token rather than content.
   Here the ROSTER lives in the workspace document, and applyTeamRoster()
   rebuilds USERS from it (js/features/org-admin.js). Swap the document and
   USERS falls back to the demo team, getCurrentUser() answers with nobody, and
   render() drops the reader on the SIGN-IN SCREEN — mid-seed, with the sample
   data written and the session apparently gone. It comes back on the next
   five-second poll, which is worse than failing outright: it reads as the app
   randomly logging you out.

   So the account's own keys ride across with the rev. Everything else — the
   decisions, the assessment, the history, the profile — is what the seed is
   for and is replaced. */
const SEED_KEEPS_ACCOUNT = {
  name: 'seedSampleData keeps the account\'s own keys',
  in: 'seedSampleData',
  replace: 'data={decisions:[],rev:(data&&data.rev)||0};',
  with: '/* PORTED-IN (tools/port-leader-module.js): the roster lives in the'
    + '\n   workspace here, and applyTeamRoster() rebuilds USERS from it — so a'
    + '\n   wholesale swap signs the reader out. Only program content is replaced. */'
    + '\nvar _acct=data||{};'
    + '\ndata={decisions:[],rev:_acct.rev||0,roster:_acct.roster||null,members:_acct.members||[],'
    + 'enterprise:_acct.enterprise||{},notes:_acct.notes||[],assigns:_acct.assigns||{},'
    + 'orgSetup:_acct.orgSetup||false,startDate:_acct.startDate||null};'
};

/* The board sizes itself against the page zoom, and the zoom is the shell's.
   The reference kept its own `appZoom` (localStorage 'dl-zoom' / 'ee-zoom')
   because it had its own zoom control; here the More menu's View row writes
   UI.zoom, so a reader who zooms out would get a board laid out for 100% —
   cards clipped at the edge with nothing to say why. Read live rather than
   copied into a variable: UI.zoom changes without this file being re-entered. */
const BOARD_USES_SHELL_ZOOM = {
  name: 'boardTier measures against the shell\'s zoom',
  in: 'boardTier',
  replace: 'var z=appZoom||1;',
  with: 'var z=(window.UI&&UI.zoom)||1;   /* PORTED-IN: the shell owns the zoom. */'
};

/* Back has to move the address bar. The reference sets currentPage itself and
   re-renders — it had no URLs to keep in step — but here every screen has an
   address (/apps/leaders/<program>/<page>[/<id>], js/router.js), and a Back
   that leaves the old one showing makes refresh, bookmark and copy-link all
   point at the screen the reader just left. */
const BACK_SYNCS_URL = {
  name: 'goBack keeps the address bar on the screen it restored',
  in: 'goBack',
  after: 'currentPage=prev.page;currentTab=prev.tab;if(prev.id)activeId=prev.id;currentModal=null;',
  insert: "\n/* PORTED-IN (tools/port-leader-module.js): the shell routes by URL. */"
    + "\nif(window.Router)Router.sync(currentPage,currentPage==='detail'?activeId:undefined);"
};

/* ── The programs ──────────────────────────────────────────────
   PORT is the entry set: the pages the module registers, the panels the shell
   asks it for, and the handful of entry points the module's own seams call.

   The two programs are the same build lineage — the Ethics Engine was grown
   from the Decision Lab — so the two lists differ only where the programs do:
   the Ethics Engine adds the Drills cabinet and its four-lens board. */
const COMMON_PORT = [
  /* The five pages the module registers (js/modules/<id>/module.js). */
  'renderLab', 'renderDetail', 'renderAssess', 'renderDash', 'renderInsights',
  /* The left rail is NOT here. Both reference builds retired it —
     railVisible() returns false in each, with a note saying the board's own
     drawers replaced it — so porting it would generate several thousand lines
     of markup for an element (#prail) the shell does not even have. The
     shell's own sidebar is hidden on every one of this program's pages
     (js/features/sidebar.js), which is the same result the reference reaches.

     The program's own modals: the part videos, the confirmations, the help
     sheet. The shell paints them for this module — render() asks for
     Modules.hook('renderModal') — rather than through #modalRoot, because
     that is how the reference built them: as part of the page. open/close come
     across with them. The shell has a closeModal() of its own and it is NOT
     this one; it empties #modalRoot, which for this program holds nothing.
     `currentModal` is deliberately left to the shell, so its backdrop-click
     listener and this program's Close buttons name the same open dialog. */
  'renderModal', 'openModal', 'closeModal',
  /* This program's own back stack. It is not the shell's: the shell records
     {page, step} and replays it through go(), and that is lossy here — the
     open SECTION of a decision is `currentTab`, which go() resets on every
     move. So the reference's three-field snapshot comes across with the
     functions that read it. */
  'navSnapshot', 'goBack', 'backBtn',
  /* The Insights shelf's filter row. The shell has a setInsightsTab, but it is
     private to js/insights.js (never exposed on window), so an inline
     onclick="setInsightsTab('videos')" in this program's markup would resolve
     to nothing at all. */
  'setInsightsTab',
  /* Entry points the module's seams call directly. */
  'createDec', 'migrateDecision', 'calcPct', 'sectionDone', 'applyVibe',
  /* The sample workspace. Its twin, resetAllData, is NOT ported: the shell's
     More menu already has "Reset all data" (clearData, js/app.js), which
     rebuilds the document from this module's emptyData() and saves it through
     Store. The reference's version ends in location.reload(), which under a
     600 ms debounced save would drop the write it had just queued and bring
     the cleared decisions straight back on the next fetch. */
  'seedSampleData', 'buildPresets',
  /* The section a decision is open at — the rail and the tab strip both move
     through it, and go() is the shell's, so the module drives it by hand. */
  'goSection'
];

const MODULES = {
  'decision-lab': {
    id: 'decision-lab',
    ns: 'DL',
    name: 'Judgment',
    refDir: path.join('leaders', 'dev', 'judgment-critical-thinking'),
    ref: 'DL-app.js',
    out: path.join('js', 'modules', 'decision-lab', 'program.js'),
    media: 'assets/media/decision-lab/',
    SHELL_GLOBALS,
    PORT: COMMON_PORT.concat([
      /* The AI features: a generated decision profile, and the two AI-state
         exports the More menu offers. */
      'generateProfile', 'exportAIState1', 'exportAIState2', 'buildCoachContext'
    ]),
    /* Content and lookup tables to lift even though the shell declares
       something of the same name. Nothing yet — the shell has no `PARTS`,
       `CARDS` or `FLOW_SECTIONS`, and the auto-discovery brings all three
       across. Anything that turns up on the SHADOWED VARS line and is this
       program's content belongs here. */
    PORT_VARS: [],
    /* The demo workspace. The reference declares `var applyDemoSeed = null` at
       the top and assigns the real thing inside its INIT block, so it has to be
       lifted as a function and kept off the variable list — otherwise the
       module ships with the placeholder and "Seed sample data" reloads the page
       instead of seeding it. */
    ASSIGN_FNS: ['applyDemoSeed'],
    /* appZoom is the reference's own zoom control, replaced by the shell's
       (see BOARD_USES_SHELL_ZOOM). Nothing reads it after the graft. */
    SKIP_VARS: ['applyDemoSeed'],
    /* The reference runs this once at load, after its content tables are
       declared: it stamps each part's colour and paper stock onto the board's
       cards. Skip it and every card on the Practice board renders in the
       fallback tint. */
    BOOT_CALLS: ['applyVibe'],
    PATCHES: [declineFalse("if(!confirm('Load sample data?\\n\\nThis replaces the current decisions with the demo set.'))"), BACK_SYNCS_URL, BOARD_USES_SHELL_ZOOM, SEED_KEEPS_ACCOUNT]
  },
  'ethics-engine': {
    id: 'ethics-engine',
    ns: 'EE',
    name: 'Conscience',
    refDir: path.join('leaders', 'dev', 'conscience-ethical-reasoning'),
    ref: 'ee-app.js',
    out: path.join('js', 'modules', 'ethics-engine', 'program.js'),
    media: 'assets/media/ethics-engine/',
    SHELL_GLOBALS,
    PORT: COMMON_PORT.concat([
      /* The Drills cabinet — this program's second practice surface: short
         scenarios with a verdict, opened out of a filing cabinet on the board.
         The Decision Lab has no equivalent. */
      'renderDrillsCabinet', 'bdRenderDrills', 'renderDrillBoard', 'bdRenderDrillBoard',
      'renderDrillPage', 'renderDrillFocus', 'openDrillEd', 'openDrillRead',
      'generateProfile',
      /* What the AI Guide is told about the situation being worked: the
         answers so far, plus the reader's own assessed style and the lens that
         has historically broken their instinct. The module's coachSystem seam
         calls it (js/modules/ethics-engine/module.js). */
      'situationContext',
      /* Fills THREAD_ROUTES — the lane and offset of every thread drawn between
         cards on the board. The reference calls it once at load; here that is a
         boot call (below), and it has to be ported for the call to resolve. */
      'buildThreadRoutes'
    ]),
    PORT_VARS: [],
    /* applyDemoSeed is a plain top-level declaration in this build, so there is
       nothing to lift out of an assignment. */
    ASSIGN_FNS: [],
    SKIP_VARS: [],
    BOOT_CALLS: ['buildThreadRoutes', 'applyVibe'],
    PATCHES: [declineFalse("if(!confirm('Load sample data?\\n\\nThis replaces your current situations with a demo set.'))"), BACK_SYNCS_URL, BOARD_USES_SHELL_ZOOM, SEED_KEEPS_ACCOUNT]
  }
};

/* ── Emitter ───────────────────────────────────────────────────
   Two decisions here, and each is the answer to a way the first pass broke.

   FUNCTIONS go inside the IIFE and are exposed on the module's one global
   (`DL` / `EE`). They have to be: the reference calls them renderDetail,
   renderRail, renderModal, and so do a dozen other files the shell loads for
   every module. Inline handlers in the generated markup are rewritten to
   match — onclick="DL.goSection('thecase')".

   VARIABLES go on `window`, bare. Not inside the IIFE and not on the
   namespace, and both alternatives are wrong for the same reason: inline
   handlers ASSIGN to them. `onclick="specOpen=!specOpen;render()"` is written
   into the markup as text and evaluated later against the global scope. Keep
   the variable inside the IIFE and that assignment silently creates a second,
   unrelated global; move it onto the namespace and the handler updates
   DL.specOpen while every renderer keeps reading `specOpen`. Either way the
   panel never opens and nothing appears in the console. As globals, the
   handler and the module's own code share one binding — which is exactly the
   arrangement the reference build ran under.

   Every name emitted this way is one the SHELL does not declare: a collision
   is reported as SHADOWED and the shell's keeps the name.

   ASSIGNMENT IS DEFERRED. js/modules/boot.js loads a module's scripts in the
   <head>, before app.js — so at the moment this file is evaluated there is no
   Store, no UI and no data. Several of these initialisers read them
   (`Store.getPref('vidcollapse')`). So the initialisers live in initVars(),
   and every exported function runs it first. Cheap after the first call, and
   it removes load-order from the set of things anyone has to think about. */
function emit(cfg, res, src) {
  const { found, vars, varOf, bodyOf } = res;
  const NS = cfg.ns;
  const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

  const pass = code => P.rewriteMedia(
    P.rewriteHandlers(code, found, NS, cfg.SHELL_GLOBALS), cfg.media);
  const indent = s => s.split('\n').map(l => (l.trim() ? '  ' + l : l)).join('\n');

  const header = `/* ─────────────────────────────────────────────────────────────
   ${cfg.id}/program.js — ${cfg.name}, the program itself
   ─────────────────────────────────────────────────────────────
   GENERATED by tools/port-leader-module.js from
   ${rel(path.join(ROOT, cfg.refDir, cfg.ref))}.
   Re-run that script rather than editing this file by hand; the
   PORT list there is what decides which functions live here.

   Everything is on ${NS}, the single global this module owns, and the
   inline handlers in the generated markup are rewritten to match —
   onclick="${NS}.goSection('thecase')". The program's own variables are
   globals instead, because those same handlers assign to them; see
   the emitter's note in the port script.

   Shell functions (esc, uid, $, render, go, saveData, Store, the
   notes / AI Guide / voice panels, the theme and zoom controls) are
   used as-is. They are the same functions the reference had a private
   copy of, under the same names.

   PERSISTENCE. These write to \`data\` and call saveData() and
   Store.commit(), which is the SHELL's Store — POST /workspace with
   module=${cfg.id}, straight to MySQL (api/sql/workspace-modules.sql).
   The reference's own Store was a localStorage adapter carrying a
   note that said "the one place to repoint data to a server"; this is
   that repointing. Nothing here touches localStorage — that is only
   the offline mirror underneath Store.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.Modules) return;

  var ${NS} = window.${NS} = window.${NS} || {};

`;

  /* Declaration order is the reference's, so an initialiser that reads an
     earlier one still sees it. */
  const order = P.topLevelVars(src);
  const orderedVars = vars.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));

  /* Work the reference does once at load, after its content tables exist —
     stamping each part's colour onto the board's cards, laying out the thread
     routes between them. It runs here for the same reason and at the same
     point: last, after every variable above has its value. */
  const bootCalls = (cfg.BOOT_CALLS || []).map(n => '    ' + n + '();').join('\n');

  const varBlock = orderedVars.length ? `  /* The program's content, lookup tables and view state — the
     reference's own top-level vars, in its own order. Assigned on first
     use rather than at load: this file is evaluated in the <head>,
     before app.js, and several of these read Store or UI. */
  var _varsReady = false;
  function initVars() {
    if (_varsReady) return;
    _varsReady = true;
${orderedVars.map(v => '    window.' + v + ' = ' + varOf.get(v) + ';')
        .map(l => pass(l)).join('\n')}
${bootCalls}
  }
  ${NS}.initVars = initVars;

` : '  function initVars() { }\n\n';

  const bodies = found.map(n => pass(indent(bodyOf.get(n)))).join('\n\n');

  const footer = `

  /* Everything ported is reachable from the markup above, so all of it is
     exposed. Each export seeds the program's variables first — see initVars. */
${found.map(n => '  ' + NS + '.' + n + ' = function () { initVars(); return ' + n + '.apply(this, arguments); };').join('\n')}
})();
`;

  return header + varBlock + bodies + footer;
}

/* ── Audit ─────────────────────────────────────────────────────
   Two questions, because the generated file has two kinds of call in it and
   they fail in different ways.

   1. A call in real code to a name declared nowhere. That is a ReferenceError
      the moment the screen renders, and it will not surface until someone
      opens that exact screen. Strings are stripped for this pass: inside them,
      `rgba(`, `repeat(` and "Board (the" are not calls.

   2. A ported name still written bare inside a string. That is the
      dead-button failure the rewriter exists to prevent — the page renders
      perfectly and the handler resolves to nothing (or, worse, to another
      program's function of the same name) when it is finally clicked. */
function audit(cfg, res, emitted, shell) {
  const declared = new Set([...res.found, ...res.vars]);
  let failed = false;
  const code = P.skeletonOf(emitted);

  /* Everything the emitted file declares at ANY depth, plus every parameter
     name. The top-level list is not enough: these builds nest freely, and a
     callback arrives as a parameter. Judging scope properly would need a
     parser; "declared somewhere in this file" is the useful approximation,
     because the failure being hunted is a name declared NOWHERE. */
  const inScope = new Set(declared);
  (code.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g) || [])
    .forEach(m => inScope.add(m.split(/\s+/)[1]));
  (code.match(/var\s+([A-Za-z_$][A-Za-z0-9_$]*)/g) || [])
    .forEach(m => inScope.add(m.split(/\s+/)[1]));
  (code.match(/function[^(]*\(([^)]*)\)/g) || []).forEach(m => {
    m.slice(m.indexOf('(') + 1, -1).split(',').forEach(p => {
      p = p.trim(); if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p)) inScope.add(p);
    });
  });

  const unresolved = [...P.callsInCode(emitted)]
    .filter(n => !inScope.has(n) && !shell.has(n) && !cfg.SHELL_GLOBALS.has(n)
      && !P.JS_KEYWORDS.has(n) && !P.BROWSER.has(n))
    .sort();
  if (unresolved.length) {
    failed = true;
    console.log('\nUNRESOLVED: called by the generated code, declared nowhere we can see.');
    console.log('            Each is a ReferenceError on the screen that calls it.');
    console.log('            ' + unresolved.join(', '));
  }

  const inStrings = P.callsInStrings(emitted);
  const bare = res.found.filter(n => inStrings.has(n)).sort();
  if (bare.length) {
    failed = true;
    console.log('\nBARE      : ported names left unprefixed inside a string. Each is a');
    console.log('            button that renders and does nothing when clicked.');
    console.log('            ' + bare.join(', '));
  }
  return !failed;
}

/* ── Run ───────────────────────────────────────────────────────── */
function run(cfg, emitTo) {
  const refPath = path.join(ROOT, cfg.refDir, cfg.ref);
  if (!fs.existsSync(refPath)) {
    console.error('the reference build is not at ' + path.relative(ROOT, refPath) + '.');
    console.error('If the review builds moved again, update refDir in the config above.');
    return false;
  }
  const src = fs.readFileSync(refPath, 'utf8');
  const shell = P.shellProvides(ROOT);

  /* SHELL_GLOBALS is a list of PROMISES that the shell has one of these, and
     an unkept promise is the worst thing this script can do: it leaves the
     reference's call alone and, because the audit trusts the same list, says
     nothing — so the name resolves to nothing and the screen dies at the line
     that reads it. Two got through on the first pass this way (`navMoreOpen`
     and `appZoom`, which the shell keeps as UI.navMore and UI.zoom), and
     neither surfaced until the seed and the profile generator were run.

     So the list is INTERSECTED with what the shell actually defines. A name
     the shell does not have is ported like any other, and if the reference has
     no definition either it lands in the audit's UNRESOLVED list where it
     belongs. Read, not trusted. */
  cfg = Object.assign({}, cfg, {
    SHELL_GLOBALS: new Set([...cfg.SHELL_GLOBALS].filter(n => shell.has(n) || P.BROWSER.has(n)))
  });

  const res = P.closure(src, cfg, shell);
  P.applyPatches(res.bodyOf, cfg.PATCHES);

  console.log('\n══ ' + cfg.name + ' (' + cfg.id + ') ══');

  /* Every name in SHELL_GLOBALS is a promise that the shell has one. Break it
     and the porter does the worst possible thing: it leaves the reference's
     call alone AND stops the audit complaining, so the name resolves to
     nothing and the screen dies at the line that reads it. Two got through on
     the first pass this way — `navMoreOpen` and `appZoom`, which the shell
     keeps as UI.navMore and UI.zoom — and neither surfaced until the seed and
     the profile generator were actually run. */
  const unbacked = [...cfg.SHELL_GLOBALS]
    .filter(n => !shell.has(n) && !P.BROWSER.has(n))
    .sort();
  if (unbacked.length && process.env.PORT_VERBOSE) {
    console.log('\nUNBACKED  : listed as the shell\'s, but the shell defines no such');
    console.log('            name — most of them are private to an IIFE (js/auth.js).');
    console.log('            Ported instead of trusted; anything the reference does not');
    console.log('            define either will surface below as UNRESOLVED.');
    console.log('            ' + unbacked.join(', '));
  }
  console.log('reference :', path.relative(ROOT, refPath).replace(/\\/g, '/'));
  console.log('requested :', cfg.PORT.length);
  console.log('pulled in :', res.pulledIn.length);
  console.log('data vars :', res.vars.length, res.vars.length ? '(' + res.vars.join(', ') + ')' : '');
  console.log('extracted :', res.found.length,
    '(' + res.found.reduce((a, n) => a + res.bodyOf.get(n).length, 0) + ' bytes)');
  if (res.shadowed.size) {
    console.log('\nSHADOWED  : the reference defines these AND so does our shell, so the');
    console.log('            shell\'s version answers. Check each one; add it to PORT if');
    console.log('            the two differ.');
    console.log('            ' + [...res.shadowed].sort().join(', '));
  }
  const openVars = [...res.shadowedVars].filter(v => !(cfg.PORT_VARS || []).includes(v)).sort();
  if (openVars.length) {
    console.log('\nSHADOWED VARS: read by the ported code, declared by BOTH. The shell\'s');
    console.log('            value answers. Fine for shared state (data, UI); NOT fine for');
    console.log('            content — add it to PORT_VARS if it is this program\'s.');
    console.log('            ' + openVars.join(', '));
  }
  if (res.missing.length) console.log('\nMISSING   :', res.missing.join(', '));

  if (!emitTo) { console.log('\n(report only — pass --emit to write)'); return !res.missing.length; }

  const outPath = path.isAbsolute(emitTo) ? emitTo : path.join(ROOT, emitTo);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const text = emit(cfg, res, src);
  fs.writeFileSync(outPath, text, 'utf8');
  console.log('\nwrote', path.relative(ROOT, outPath).replace(/\\/g, '/'),
    '(' + fs.statSync(outPath).size + ' bytes)');
  return audit(cfg, res, text, shell) && !res.missing.length;
}

const which = process.argv[2];
const emitAt = process.argv.indexOf('--emit');
if (!which || !(which === 'all' || MODULES[which])) {
  console.error('usage: node tools/port-leader-module.js <' + Object.keys(MODULES).join('|') + '|all> [--emit [file]]');
  process.exit(2);
}
const targets = which === 'all' ? Object.keys(MODULES) : [which];
let ok = true;
targets.forEach(k => {
  const cfg = MODULES[k];
  let out = null;
  if (emitAt >= 0) {
    const next = process.argv[emitAt + 1];
    out = (next && !next.startsWith('--') && which !== 'all') ? next : cfg.out;
  }
  if (!run(cfg, out)) ok = false;
});
process.exit(ok ? 0 : 1);
