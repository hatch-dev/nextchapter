#!/usr/bin/env node
/* -------------------------------------------------------------
   er-directive-coverage.js - does the LIVE module carry the
   16 Sep 2026 directive?
   -------------------------------------------------------------
   The directive's 184 steps target the standalone dev build
   (enterprises/dev/executive-readiness-prototype/Exec-Readiness-app.js). The
   live app runs js/modules/exec-readiness/steps.js, which is
   GENERATED from that build by tools/port-exec-readiness.js.

   So "applied" and "live" are two different questions, and this one
   answers the second: for every step, is the thing it declares
   reachable in the live app - as ported module code, or because the
   SHELL already owns that name and the module is right not to carry
   it (renderSidebar, toggleNavOutputs, renderMgmtHub ...)?

   A name in neither place is a hole: the step is applied to the dev
   build and absent from what users run.

     node tools/er-directive-coverage.js
   ------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'reference', 'Directive_DEV_Executive_Readiness_Complete_16Sep2026.md');
const STEPS = path.join(ROOT, 'js', 'modules', 'exec-readiness', 'steps.js');
const MODULE = path.join(ROOT, 'js', 'modules', 'exec-readiness', 'module.js');
const SHELL = ['js/app.js', 'js/nav.js', 'js/router.js', 'js/features/sidebar.js',
  'js/features/collab-notices.js', 'js/features/charts.js']
  .map(f => path.join(ROOT, f)).filter(fs.existsSync);

/* Names the SHELL owns for every program, so the module deliberately
   does not carry them. Each is here because the shell's version is the
   one that must answer - not because the step was skipped. */
const SHELL_OWNED = {
  render: 'the shell routes every module; module.js declares the pages',
  renderNav: 'the shell draws the nav; module.js declares moreItems',
  renderSidebar: 'js/features/sidebar.js, family-wide',
  updateSidebarState: 'js/features/sidebar.js, family-wide',
  sidebarPageShown: 'js/features/sidebar.js (SIDEBAR_PAGES)',
  toggleNavOutputs: 'js/features/sidebar.js, the Outputs fold',
  navOutputsOpen: 'js/features/sidebar.js, the Outputs fold',
  renderMgmtHub: 'the shell owns Track Program (js/app.js)',
  notesWhere: 'the shell owns the notes panel',
  printThemeTokens: 'the shell print stylesheet (SHELL_GLOBALS)'
};

/* Declared by the directive and called by nothing - in the REFERENCE
   BUILD, not just here. The port carries what is reachable, so these are
   correctly absent. Verified by counting calls in code and in handler
   strings over the reference's lexed skeleton, not by eye. */
const DEAD_IN_REFERENCE = {
  erScaleSvg: 'step 55 declares it; nothing in the reference calls it',
  printOrgChart: 'step 59 rewrites it, but the Print Org Chart button goes at step 69 - nothing calls it any more',
  _pbStrip: 'step 73 declares it; printCurrentPage() ended up not needing it'
};

function declaredNames(src) {
  const skel = P.skeletonOf(src);
  const s = new Set();
  for (const m of skel.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)) s.add(m[1]);
  for (const m of skel.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)/gm)) s.add(m[1]);
  for (const m of skel.matchAll(/\bvar\s+([A-Za-z_$][\w$]*)\s*=/g)) s.add(m[1]);
  /* the generated module hangs everything on its namespace */
  for (const m of skel.matchAll(/\bER\.([A-Za-z_$][\w$]*)\s*=/g)) s.add(m[1]);
  return s;
}

function main() {
  const md = fs.readFileSync(MD, 'utf8');
  const parts = md.split(/^### Step /m).slice(1);

  const targets = [];
  for (const p of parts) {
    const num = parseInt(p, 10);
    const title = p.split('\n')[0].trim();
    const ci = p.indexOf('**Code:**');
    if (ci < 0) continue;
    const m = p.slice(ci).match(/```[a-z]*\n([\s\S]*?)\n```/);
    if (!m) continue;
    const code = m[1];
    const d = code.match(/^\s*function\s+([A-Za-z_$][\w$]*)/m) ||
      code.match(/^\s*var\s+([A-Za-z_$][\w$]*)/m);
    if (d) targets.push({ num, title, name: d[1] });
    else targets.push({ num, title, name: null, code });
  }

  if (!fs.existsSync(STEPS)) { console.error('no generated module at ' + STEPS); process.exit(1); }
  const stepsSrc = fs.readFileSync(STEPS, 'utf8');
  const moduleSrc = fs.readFileSync(MODULE, 'utf8');
  const inModule = declaredNames(stepsSrc + '\n' + moduleSrc);
  const shellSrc = SHELL.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const inShell = declaredNames(shellSrc);

  const ported = [], shellOwned = [], holes = [], noDecl = [], dead = [];
  for (const t of targets) {
    if (!t.name) { noDecl.push(t); continue; }
    if (inModule.has(t.name)) ported.push(t);
    else if (DEAD_IN_REFERENCE[t.name]) dead.push(t);
    else if (SHELL_OWNED[t.name] || inShell.has(t.name)) shellOwned.push(t);
    else holes.push(t);
  }

  console.log('steps declaring a name : ' + targets.filter(t => t.name).length);
  console.log('  in the ported module : ' + ported.length);
  console.log('  owned by the shell   : ' + shellOwned.length);
  console.log('  dead in the reference : ' + dead.length);
  console.log('  NOT REACHABLE (holes): ' + holes.length);
  console.log('steps with no declaration (assignments/fills, checked by hand): ' + noDecl.length);

  if (shellOwned.length) {
    console.log('\n-- shell-owned, deliberately not in the module --');
    for (const t of shellOwned)
      console.log('  step ' + String(t.num).padEnd(4) + t.name.padEnd(22) +
        (SHELL_OWNED[t.name] || 'declared in the shell'));
  }
  if (dead.length) {
    console.log('\n-- declared by the directive, called by nothing (in the reference too) --');
    for (const t of dead) console.log('  step ' + String(t.num).padEnd(4) + t.name.padEnd(22) + DEAD_IN_REFERENCE[t.name]);
  }
  if (holes.length) {
    console.log('\n-- HOLES: applied to the dev build, absent from the live app --');
    for (const t of holes)
      console.log('  step ' + String(t.num).padEnd(4) + t.name.padEnd(24) + t.title.slice(0, 74));
  }

  /* The statements that FILL a table are the class that vanishes
     silently in a port - an empty LAYER_MAPS renders every register as a
     heading over nothing. Check the ones this directive adds. */
  console.log('\n-- table fills (an empty table is a silent, page-rendering failure) --');
  for (const [tbl, want] of [['LAYER_MAPS', 4], ['PRINT_DOCS', 2], ['ER_SINGLE_DOCS', 1]]) {
    const n = (stepsSrc.match(new RegExp(tbl + '\\.[A-Za-z]+\\s*=|' + tbl + '\\[', 'g')) || []).length;
    console.log('  ' + tbl.padEnd(18) + n + ' write(s)' + (n >= want ? '' : '   <-- expected at least ' + want));
  }

  process.exit(holes.length ? 1 : 0);
}
main();
