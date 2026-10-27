#!/usr/bin/env node
/* -------------------------------------------------------------
   pipeline-directive-verify.js - is every one of the 209 steps
   actually IN the dev build?
   -------------------------------------------------------------
   The cheap check - does the file contain each step's code block as a
   string - gives two false negatives, and both are the applier's own
   doing rather than missing work:

     step 125  `var RV_COLORS={...};var RV_WORDS={...};` is ONE line
               holding TWO declarations. Step 126 anchors on RV_COLORS,
               whose range ends at the first `;`, so its insertion lands
               between the two and closes the line. Both declarations are
               there; the block is no longer one string.
     step 204  the same shape: five PRINT_DOCS registrations on one line,
               split by step 205's insertion after the first.

   So compare STATEMENTS, not bytes. Each step's block is cut into its
   top-level statements, whitespace-stripped, and each must appear in the
   file - which is the question "was this step applied" actually asks.

   With --live it asks the same of the LIVE app instead, where the answer
   is not simply yes: nine steps are deliberately skipped because the
   shell already carries them, and the rest were rewritten to the live
   app's spelling on the way in. So the block is put through the port's
   OWN tables - imported, not copied - before it is looked for.

     node tools/pipeline-directive-verify.js
     node tools/pipeline-directive-verify.js --live
     node tools/pipeline-directive-verify.js --all   # print every step
   ------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'reference', 'Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md');
const APP = path.join(ROOT, 'enterprises', 'dev', 'innovation-pipeline', 'app.js');
const ALL = process.argv.includes('--all');
const LIVE = process.argv.includes('--live');
const PORT = require('./port-pipeline-directive.js');

/* Comments out, strings intact - on BOTH sides, or nothing matches.
   lex() blanks a comment AND a string's body to spaces and hands back
   where the string bodies were, so a space in the skeleton that is not
   whitespace in the source and not inside a string is a comment
   character. A regex cannot do this: `/*` inside a string literal, and
   `https://` inside one, both read as comment openers. */
function stripComments(src) {
  const { skel, strs } = P.lex(src);
  const inStr = new Uint8Array(src.length);
  for (const [a, b] of strs) for (let i = a; i < b && i < src.length; i++) inStr[i] = 1;
  let out = '';
  for (let i = 0; i < src.length; i++) {
    if (skel[i] === ' ' && !inStr[i] && !/\s/.test(src[i])) continue;   // comment
    out += src[i];
  }
  return out;
}

/* Depth-zero statements of a block: a declaration ends at its closing
   brace, an assignment at its `;`. */
function statements(source) {
  const skel = P.skeletonOf(source);
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0 && c === '}') {
        let j = i + 1; while (j < skel.length && /\s/.test(skel[j])) j++;
        if (skel[j] !== ';') { out.push(source.slice(start, i + 1)); start = i + 1; }
      }
    } else if (c === ';' && depth === 0) { out.push(source.slice(start, i + 1)); start = i + 1; }
  }
  if (start < source.length) out.push(source.slice(start));
  return out.map(s => stripComments(s).replace(/\s+/g, '')).filter(s => s.length > 12);
}

function main() {
  const md = fs.readFileSync(MD, 'utf8');
  /* The dev build is one file; the live app is a dozen that share one
     global scope, so "is it in the build" is asked of all of them at once. */
  const src = LIVE
    ? PORT.FILES.concat(Object.keys(PORT.NEW_FILES))
      .filter(f => /\.js$/.test(f) && fs.existsSync(path.join(ROOT, f)))
      .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
    : fs.readFileSync(APP, 'utf8');
  const flat = stripComments(src).replace(/\s+/g, '');

  const parts = md.split(/^### Step /m).slice(1);
  if (parts.length !== 209) { console.error('expected 209 steps, parsed ' + parts.length); process.exit(1); }

  const rows = [], missing = [], skipped = [], adapted = [];
  for (const p of parts) {
    const num = parseInt(p, 10);
    const title = p.split('\n')[0].trim();
    const ci = p.indexOf('**Code:**');

    /* Deliberately not applied live, because the shell already answers it.
       Reported as its own outcome - not as applied, and not as a hole. */
    if (LIVE && PORT.SKIP[num]) {
      skipped.push({ num, title, why: PORT.SKIP[num] });
      rows.push([num, true, 'SKIPPED live: ' + PORT.SKIP[num].slice(0, 60)]);
      continue;
    }

    /* The one Delete step: the question is the opposite one. */
    if (ci < 0) {
      const name = (p.match(/Delete the whole function named `([\w$]+)`/) || [])[1];
      /* Step 1 deletes renderStepContent; step 64 adds it back, changed.
         So what must be true at the end is that there is exactly ONE, and
         it is the new one - which calls renderStepContentBody. */
      const n = (P.skeletonOf(src).match(new RegExp('^function\\s+' + name + '\\s*\\(', 'gm')) || []).length;
      const isNew = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{[^}]*renderStepContentBody').test(src.replace(/\s+/g, ' '));
      const okc = n === 1 && isNew;
      rows.push([num, okc, 'delete+readd ' + name + ': ' + n + ' declaration(s), ' + (isNew ? 'the new one' : 'NOT the new one')]);
      if (!okc) missing.push({ num, title, why: name + ' is declared ' + n + ' time(s)' });
      continue;
    }

    const m = p.slice(ci).match(/```[a-z]*\n([\s\S]*?)\n```/);
    if (!m) { rows.push([num, false, 'no code fence']); missing.push({ num, title, why: 'no code fence parsed' }); continue; }

    /* Live, the block went in wearing this app's spelling. Apply the same
       rules here - the port's own, imported - before looking for it. */
    let code = m[1];
    let posted = false;
    if (LIVE) {
      for (const s of PORT.LIVE_SPELLINGS) code = code.replace(s.find, (...a) => s.to(...a));
      /* and the edits made to the ported code afterwards - step 30's
         printDocument gained a <meta charset>, which is a POST_EDIT and
         not a difference from the directive that anyone should hunt. */
      for (const e of PORT.POST_EDITS) if (code.indexOf(e.find) >= 0) { code = code.split(e.find).join(e.replace); posted = true; }
    }

    const sts = statements(code);
    let gone = sts.filter(s => flat.indexOf(s) < 0);

    /* A merged step's body is the live one with the directive's delta
       applied, so the directive's whole statement is not there to find.
       The question becomes: is every EDIT the merge makes in the build? */
    if (LIVE && gone.length && PORT.MERGES[num]) {
      const edits = PORT.MERGES[num];
      const land = edits.filter(e => flat.indexOf(stripComments(e.replace).replace(/\s+/g, '')) >= 0);
      adapted.push({ num, title, edits: edits.length, landed: land.length, base: edits[0].base || 'theirs' });
      rows.push([num, land.length === edits.length,
        'MERGED live (' + land.length + '/' + edits.length + ' edits in the build)']);
      if (land.length !== edits.length)
        missing.push({ num, title, why: 'merged, but ' + (edits.length - land.length) + ' edit(s) not found' });
      continue;
    }

    rows.push([num, gone.length === 0, sts.length + ' statement(s)' + (posted ? ', +post-edit' : '') + (gone.length ? ', ' + gone.length + ' MISSING' : '')]);
    if (gone.length) missing.push({ num, title, why: gone.length + ' of ' + sts.length + ' statements absent', sample: gone[0].slice(0, 110) });
  }

  if (ALL) for (const [n, okc, what] of rows)
    console.log('  ' + String(n).padStart(4) + '  ' + (okc ? 'ok  ' : 'MISS') + '  ' + what);

  const bad = rows.filter(r => !r[1]).length;
  console.log('\n== ' + (LIVE ? 'THE LIVE APP' : 'the dev build (' + path.basename(APP) + ')') + ' ==');
  console.log('steps checked          : ' + rows.length);
  console.log('applied as written     : ' + (rows.length - bad - skipped.length - adapted.length));
  if (adapted.length) console.log('applied, merged live   : ' + adapted.length);
  if (skipped.length) console.log('skipped (shell has it) : ' + skipped.length);
  console.log('NOT applied            : ' + bad);

  if (adapted.length) {
    console.log('\n-- applied as a merge: the live body kept, the step\'s delta put into it --');
    for (const a of adapted)
      console.log('  step ' + String(a.num).padEnd(5) + a.landed + '/' + a.edits + ' edits present, base ' + a.base +
        '   ' + a.title.replace(/^\d+ . /, '').slice(0, 60));
  }
  if (skipped.length) {
    console.log('\n-- NOT applied live, on purpose: the shell already answers it --');
    for (const s of skipped) {
      console.log('  step ' + String(s.num).padEnd(5) + s.title.replace(/^\d+ . /, '').slice(0, 84));
      console.log('        ' + s.why.slice(0, 150));
    }
  }
  if (missing.length) {
    console.log('\n-- steps whose code is not in the build --');
    for (const x of missing) {
      console.log('  step ' + x.num + '  ' + x.why);
      console.log('      ' + x.title.slice(0, 96));
      if (x.sample) console.log('      first missing: ' + x.sample);
    }
  }
  process.exit(bad ? 1 : 0);
}
main();
