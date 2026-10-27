#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   build-empty-docs.js — writes api/config/empty-docs.json

   The server sometimes has to write a program's workspace document itself:
   "Reset data" in the admin console (Directive 2 Oct 2026, Part 4) replaces an
   organization's AI Innovation Pipeline document with a fresh one. Only the
   program knows its document's shape — js/modules/<id>/module.js, emptyData() —
   and the shell's loadData() reads a stored document as it is (it does not fill
   in missing keys), so a partial document would leave screens reading
   collections that are not there.

   So the shape is taken from the program itself, here, and written out as JSON
   for the API. The harness (tools/_unused/harness.js, "EMPTY DOCS") compares this
   file with the live emptyData() and fails when they drift: change a program's
   emptyData(), run this again.

       node tools/build-empty-docs.js
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'api', 'config', 'empty-docs.json');
const PROGRAMS = ['pipeline', 'exec-readiness', 'ai-governance', 'ai-architecture'];   // the programs whose document the server may write (Part 4: the Pipeline, 6 Oct 2026; Executive Readiness and Responsible AI Governance, 7 Oct 2026; AI-Ready Architecture, 21 Oct 2026)
/* AI-Ready Architecture's module.js takes its empty document from program.js (ARC.emptyData, handed over at
   port time — tools/port-ai-architecture.js), so that file runs first. It wires a few listeners at load, hence
   the inert document/window methods below. */
const BEFORE = { 'ai-architecture': ['program.js'] };

const defs = {};
const inert = { addEventListener() { }, removeEventListener() { } };
const sandbox = { Modules: { define: (id, def) => { defs[id] = def; } }, console, document: inert };
sandbox.window = sandbox;
sandbox.addEventListener = inert.addEventListener;
sandbox.removeEventListener = inert.removeEventListener;
vm.createContext(sandbox);

const out = {};
PROGRAMS.forEach((id) => {
  (BEFORE[id] || []).forEach((name) => {
    const pre = path.join(ROOT, 'js', 'modules', id, name);
    vm.runInContext(fs.readFileSync(pre, 'utf8'), sandbox, { filename: pre });
  });
  const file = path.join(ROOT, 'js', 'modules', id, 'module.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  const def = defs[id];
  if (!def || typeof def.emptyData !== 'function') throw new Error(id + ': module.js defines no emptyData()');
  out[id] = def.emptyData();
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('wrote ' + path.relative(ROOT, OUT) + ' — ' + Object.keys(out).map((k) => k + ' (' + Object.keys(out[k]).length + ' keys)').join(', '));
