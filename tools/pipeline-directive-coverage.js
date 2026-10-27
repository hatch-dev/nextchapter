#!/usr/bin/env node
/* -------------------------------------------------------------
   pipeline-directive-coverage.js - does the LIVE app carry the
   17 Sep 2026 AI Innovation Pipeline directive?
   -------------------------------------------------------------
   The directive's 209 steps target the standalone dev build
   (enterprises/dev/innovation-pipeline/app.js). The Pipeline is the
   one program with no generated module: its live code IS the shell
   (js/app.js, js/steps/*, js/pages/*, js/features/*, js/dev/seed.js)
   plus js/modules/pipeline/module.js.

   So "applied" and "live" are two different questions, and this one
   answers the second: for every step, is the name it declares present
   in the live app at all, and if so in which file - so that porting is
   a list of files to edit rather than a search.

     node tools/pipeline-directive-coverage.js          # summary + holes
     node tools/pipeline-directive-coverage.js --all    # every step
   ------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'reference', 'Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md');
const ALL = process.argv.includes('--all');

/* Every file the shell loads for the Pipeline, in load order (shell.html),
   plus the Pipeline's own module seams. */
const LIVE = ['js/modules/registry.js', 'js/modules/boot.js', 'js/router.js',
  'js/screen-loader.js', 'js/insights.js', 'js/auth.js', 'js/launchpad.js', 'js/nav.js',
  'js/features/coach.js', 'js/features/chat.js', 'js/features/notes.js',
  'js/features/help.js', 'js/features/email.js', 'js/features/sidebar.js',
  'js/features/budget.js', 'js/features/charts.js', 'js/features/org-admin.js',
  'js/features/assignments.js', 'js/features/my-assignments.js', 'js/features/voice.js',
  'js/features/collab-notices.js', 'js/steps/phase1.js', 'js/steps/phase2.js',
  'js/steps/phase3.js', 'js/steps/phase4.js', 'js/pages/navigate.js', 'js/pages/reports.js',
  'js/dev/seed.js',
  'js/app.js', 'js/modules/pipeline/module.js', 'js/modules/pipeline/help.js']
  .map(f => path.join(ROOT, f));

/* Names the SHELL answers under a different spelling, so the Pipeline is
   right not to carry the directive's. Each is a deliberate SKIP in
   tools/port-pipeline-directive.js and is named there with its reason. */
const SHELL_OWNED = {
  sidebarPageShown: 'js/features/sidebar.js answers it as SIDEBAR_PAGES + sidebarShowsHere() - one list, read from both places'
};

/* The fills: a table populated after it is declared is the class that
   vanishes silently in a port ([[gov-reporting-engine-port]]), so each is
   checked by COUNTING what ended up in the table, not by finding a name. */
const FILL_TABLES = [
  { name: 'LAYER_MAPS', steps: [96, 103], least: 2, what: 'the idea and project record descriptions' },
  /* Five of the fourteen documents are in PRINT_DOCS's own initialiser and
     are not writes at all, so this counts the NINE that arrive as
     statements. tools/pipeline-accept.js counts the runtime keys, which is
     the number that matters; this one catches a dropped statement. */
  { name: 'PRINT_DOCS', steps: [136, 203, 204, 205, 206], least: 9, what: 'the printed documents registered by a statement' }
];

function declaredIn(src) {
  const skel = P.skeletonOf(src);
  const s = new Set();
  for (const m of skel.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)/gm)) s.add(m[1]);
  for (const m of skel.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) s.add(m[1]);
  return s;
}

/* What each step DECLARES: a function or var at the head of its code
   block. A step with none is a fill or an assignment - listed apart,
   because a table filled after it is declared is exactly the class that
   vanishes silently in a port. */
function parseTargets(md) {
  const parts = md.split(/^### Step /m).slice(1);
  const out = [];
  for (const p of parts) {
    const num = parseInt(p, 10);
    const title = p.split('\n')[0].trim();
    const where = (p.match(/\*\*Where:\*\*([\s\S]*?)(?:\*\*Code:\*\*|$)/) || [, ''])[1].replace(/\s+/g, ' ').trim();
    const ci = p.indexOf('**Code:**');
    if (ci < 0) {                       /* the one Delete step */
      const dn = (where.match(/function named `([\w$]+)`/) || [])[1] || null;
      out.push({ num, title, name: dn, kind: 'delete' });
      continue;
    }
    const m = p.slice(ci).match(/```[a-z]*\n([\s\S]*?)\n```/);
    if (!m) continue;
    const code = m[1];
    const d = code.match(/^\s*function\s+([A-Za-z_$][\w$]*)/m) ||
      code.match(/^\s*var\s+([A-Za-z_$][\w$]*)/m);
    out.push({ num, title, name: d ? d[1] : null, code, kind: d ? 'decl' : 'fill' });
  }
  return out;
}

function main() {
  const targets = parseTargets(fs.readFileSync(MD, 'utf8'));
  const where = new Map();              /* name -> [file, ...] */
  for (const f of LIVE) {
    if (!fs.existsSync(f)) { console.error('missing: ' + f); process.exit(1); }
    for (const n of declaredIn(fs.readFileSync(f, 'utf8'))) {
      if (!where.has(n)) where.set(n, []);
      where.get(n).push(path.relative(ROOT, f).replace(/\\/g, '/'));
    }
  }

  const present = [], holes = [], fills = [], shellOwned = [];
  for (const t of targets) {
    if (!t.name) { fills.push(t); continue; }
    if (where.has(t.name)) present.push(Object.assign(t, { at: where.get(t.name) }));
    else if (SHELL_OWNED[t.name]) shellOwned.push(t);
    else holes.push(t);
  }

  console.log('steps declaring a name : ' + targets.filter(t => t.name).length);
  console.log('  present in the live app : ' + present.length);
  console.log('  the shell answers under another name : ' + shellOwned.length);
  console.log('  ABSENT (holes)          : ' + holes.length);
  console.log('steps with no declaration (fills/assignments, counted below): ' + fills.length);

  if (shellOwned.length) {
    console.log('\n-- the shell answers these, spelled its own way --');
    for (const t of shellOwned)
      console.log('  step ' + String(t.num).padEnd(5) + t.name.padEnd(22) + SHELL_OWNED[t.name]);
  }

  /* A table filled after it is declared: count what is IN it. An empty
     one renders every page and prints a heading over nothing. */
  console.log('\n-- table fills (an empty table is a silent, page-rendering failure) --');
  const all = LIVE.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  let thin = 0;
  for (const t of FILL_TABLES) {
    const n = (all.match(new RegExp('\\b' + t.name + '\\s*(\\.[A-Za-z_$][\\w$]*|\\[[^\\]]+\\])\\s*=[^=]', 'g')) || []).length;
    const okc = n >= t.least;
    if (!okc) thin++;
    console.log('  ' + (okc ? ' ' : '!') + ' ' + t.name.padEnd(12) + String(n).padStart(3) + ' write(s), want >= ' + t.least +
      '   ' + t.what + '  (steps ' + t.steps.join(',') + ')');
  }

  /* Which live file each already-present name lives in: the port's
     worklist, because a replaced function has to be edited where it is. */
  const byFile = new Map();
  for (const t of present) for (const f of t.at) {
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push(t.num);
  }
  console.log('\n-- where the live app already declares the names this directive touches --');
  for (const [f, nums] of [...byFile].sort((a, b) => b[1].length - a[1].length))
    console.log('  ' + f.padEnd(34) + String(nums.length).padStart(3) + '  steps ' + nums.slice(0, 14).join(',') + (nums.length > 14 ? ' ...' : ''));

  if (ALL) {
    console.log('\n-- every step --');
    for (const t of targets)
      console.log('  ' + String(t.num).padStart(4) + '  ' + (t.name || '(fill)').padEnd(26) +
        (t.name && where.has(t.name) ? where.get(t.name).join(' ') : 'ABSENT'));
  }

  if (holes.length) {
    console.log('\n-- ABSENT from the live app: the directive adds these --');
    for (const t of holes)
      console.log('  step ' + String(t.num).padEnd(5) + t.name.padEnd(26) + t.title.replace(/^\d+ . /, '').slice(0, 68));
  }
  if (fills.length) {
    console.log('\n-- no declaration at the head of the block --');
    for (const t of fills)
      console.log('  step ' + String(t.num).padEnd(5) + t.title.replace(/^\d+ . /, '').slice(0, 90));
  }
  process.exit(holes.length + thin ? 1 : 0);
}
main();
