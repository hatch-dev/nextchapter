#!/usr/bin/env node
/* -------------------------------------------------------------
   apply-pipeline-directive.js - apply the 17 Sep 2026 AI Innovation
   Pipeline directive to the dev build, step by step
   -------------------------------------------------------------
   reference/Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md
   is 209 numbered steps against
   enterprises/dev/innovation-pipeline/app.js, plus four changes to
   enterprises/dev/innovation-pipeline/styles.css (section 5).

   Same shape as tools/apply-er-directive.js, and for the same reason:
   the directive gives no line numbers on purpose - every step names its
   place by a function name, a constant name, or the exact text of a
   line. 209 insertions into a 780 KB file by hand is a silent-corruption
   machine, and re-running is the only way to prove what was applied.

   Anchors resolve over the LEXED SKELETON (tools/lib/js-port.js), never
   a regex over the source: these bodies are full of braces and
   semicolons inside CSS strings, and a naive scan truncates a function
   without erroring.

   Usage:
     node tools/apply-pipeline-directive.js            # report: does every anchor resolve?
     node tools/apply-pipeline-directive.js --losses   # what the Replace/Delete steps overwrite
     node tools/apply-pipeline-directive.js --emit     # write the files
     node tools/apply-pipeline-directive.js --stop N f # apply 1..N, dump to f
   ------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'reference', 'Directive_DEV_Innovation_Pipeline_Complete_17Sep2026.md');
const DEV = path.join(ROOT, 'enterprises', 'dev', 'innovation-pipeline');
const APP = path.join(DEV, 'app.js');
const CSS = path.join(DEV, 'styles.css');
const N_STEPS = 209;

const EMIT = process.argv.includes('--emit');
const LOSSES = process.argv.includes('--losses');
const STOP = (() => { const i = process.argv.indexOf('--stop'); return i < 0 ? 0 : parseInt(process.argv[i + 1], 10); })();
const STOP_OUT = (() => { const i = process.argv.indexOf('--stop'); return i < 0 ? null : process.argv[i + 2]; })();

/* -- Parse the directive -------------------------------------
   A step's markdown holds up to TWO fenced blocks: an ANCHOR fence
   under *Where* ("the line reading exactly"), and the replacement after
   `**Code:**`. Split on `**Code:**` or a Replace step's own anchor
   reads as its code. */
function parseSteps(md) {
  const parts = md.split(/^### Step /m).slice(1);
  return parts.map(p => {
    const num = parseInt(p, 10);
    const title = p.split('\n')[0].trim();
    const ci = p.indexOf('**Code:**');
    const head = ci >= 0 ? p.slice(0, ci) : p;
    const kind = (head.match(/\*\*Kind:\*\*\s*(.+)/) || [, '?'])[1].trim();
    const where = (head.match(/\*\*Where:\*\*([\s\S]*)$/) || [, ''])[1].trim();
    let code = null;
    if (ci >= 0) {
      const m = p.slice(ci).match(/```[a-z]*\n([\s\S]*?)\n```/);
      if (m) code = m[1];
    }
    return { num, title, kind, where, code };
  });
}

/* -- MERGES ---------------------------------------------------
   "If you have changed that function yourself since 12 September,
   compare your function with the reference build first, and keep your
   own changes if they are unrelated to this document." (section 1.)

   Filled in once --losses has been read. Each entry keeps OUR body
   ('ours', the default) or the directive's ('theirs') as the base and
   applies the listed edits to it; every `find` must match exactly once
   or the run stops. */
const MERGES = {};

/* -- Anchor resolution ---------------------------------------
   Each returns [start, end) over the source, or an err with the reason.
   Uniqueness is asserted: a name that resolves twice means the
   directive's place is ambiguous in OUR file, and guessing is how a
   step lands in the wrong copy. */
function fnRange(src, skel, name) {
  const re = new RegExp('^function\\s+' + name + '\\s*\\(', 'gm');
  const hits = [];
  let m; while ((m = re.exec(skel))) hits.push(m.index);
  if (hits.length !== 1) return { err: hits.length + ' declarations of function ' + name };
  const start = hits[0];
  let i = skel.indexOf('{', start), depth = 0;
  if (i < 0) return { err: 'no body for function ' + name };
  for (; i < skel.length; i++) {
    if (skel[i] === '{') depth++;
    else if (skel[i] === '}') { depth--; if (depth === 0) return { start, end: i + 1 }; }
  }
  return { err: 'unterminated function ' + name };
}

function varRange(src, skel, name) {
  const re = new RegExp('^var\\s+' + name + '\\s*=', 'gm');
  const hits = [];
  let m; while ((m = re.exec(skel))) hits.push(m.index);
  if (hits.length !== 1) return { err: hits.length + ' declarations of var ' + name };
  const start = hits[0];
  let i = skel.indexOf('=', start) + 1, depth = 0;
  for (; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return { start, end: i + 1 };
  }
  return { err: 'unterminated var ' + name };
}

/* "the statement that begins with the line reading exactly: <line>" -
   find that line, then run to the end of the statement it opens. The
   line is matched with whitespace SQUASHED, because the directive
   quotes the 12 September file unspaced and ours may be re-formatted. */
const squash = s => s.replace(/\s+/g, '');
function stmtRange(src, skel, line) {
  const needle = squash(line);
  const lines = src.split('\n');
  const hits = [];
  let off = 0;
  for (const ln of lines) {
    if (squash(ln) === needle) hits.push(off + (ln.length - ln.replace(/^\s+/, '').length));
    off += ln.length + 1;
  }
  if (hits.length !== 1) return { err: hits.length + ' lines reading "' + line.slice(0, 40) + '"' };
  const start = hits[0];
  /* A statement opened by a keyword ends at the `}` that closes its
     block; an assignment of an object literal ends at the `;` after it.
     Scanning blindly to the next depth-zero `;` swallows whatever
     follows an if-block, which is how an insertion lands mid-file. */
  const kw = /^(if|for|while|switch|try|do|function)\b/.test(src.slice(start, start + 12));
  let i = start, depth = 0, seen = false;
  for (; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{' || c === '[' || c === '(') { depth++; seen = true; }
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0 && seen && c === '}') {
        let j = i + 1;
        while (j < skel.length && /\s/.test(skel[j])) j++;
        if (skel[j] === ';') return { start, end: j + 1 };
        if (kw) return { start, end: i + 1 };
      }
    }
    else if (c === ';' && depth === 0) return { start, end: i + 1 };
  }
  return { err: 'unterminated statement at "' + line.slice(0, 40) + '"' };
}

/* A declaration's closing `}` or `;` is not the end of its LINE: this
   build writes a trailing comment after many of them, and the
   directive's own code blocks do the same. Inserting immediately after
   the brace lands BETWEEN the statement and its comment, which shunts
   that comment onto the inserted line - and the next step, anchored on
   "the line reading exactly <that line>", then finds nothing.

   So skip forward over whitespace and comments (lex() blanks a comment
   to spaces, so an all-space skeleton run is exactly "nothing but
   comment and space left"). Two endings:
     - a newline first  -> insert there; the line is left intact.
     - real code first  -> some earlier insertion has already put a
       statement on this line. Insert BEFORE it and close the line, so
       the new code gets a line of its own and the next step's literal
       anchor still matches. Without this the comments of every chained
       insertion collect on one line and the chain breaks at the first
       step that anchors on a line it reads back. */
function insertPoint(src, skel, end) {
  let i = end;
  while (i < src.length && src[i] !== '\n' && /\s/.test(skel[i])) i++;
  if (i >= src.length) return { at: src.length, close: false };
  if (src[i] === '\n') return { at: i, close: false };
  return { at: i, close: true };
}
/* Where a delete should stop: the same point, plus the newline. */
function toLineEnd(src, skel, end) {
  const p = insertPoint(src, skel, end);
  return p.close ? end : p.at;
}

/* Which anchor a step's *Where* names. */
function resolve(step, src, skel) {
  const w = step.where.replace(/\s+/g, ' ');
  let m;
  if ((m = w.match(/^Replace the whole function named `([\w$]+)`\./)))
    return Object.assign({ op: 'replace', name: m[1] }, fnRange(src, skel, m[1]));
  if ((m = w.match(/^Replace the whole constant named `([\w$]+)`\./)))
    return Object.assign({ op: 'replace', name: m[1] }, varRange(src, skel, m[1]));
  if ((m = w.match(/^Delete the whole function named `([\w$]+)`\./)))
    return Object.assign({ op: 'delete', name: m[1] }, fnRange(src, skel, m[1]));
  if ((m = w.match(/^Add this immediately after the function named `([\w$]+)` ends/)))
    return Object.assign({ op: 'after', name: m[1] }, fnRange(src, skel, m[1]));
  if ((m = w.match(/^Add this immediately after the constant named `([\w$]+)` ends/)))
    return Object.assign({ op: 'after', name: m[1] }, varRange(src, skel, m[1]));
  if (/^Add this immediately after the statement that begins with the line reading exactly/.test(w)) {
    const f = step.where.match(/```[a-z]*\n([\s\S]*?)\n```/);
    if (!f) return { err: 'no anchor fence' };
    return Object.assign({ op: 'after', name: f[1].trim() }, stmtRange(src, skel, f[1]));
  }
  if (/^The last line of the file is empty\. Remove it\./.test(w))
    return { op: 'trimEnd', name: '<eof>' };
  return { err: 'unrecognised Where: ' + w.slice(0, 90) };
}

/* -- Apply -------------------------------------------------- */
function main() {
  const md = fs.readFileSync(MD, 'utf8');
  const steps = parseSteps(md);
  if (steps.length !== N_STEPS) fail('expected ' + N_STEPS + ' steps, parsed ' + steps.length);

  let src = fs.readFileSync(APP, 'utf8');
  const before = src;

  /* This is not idempotent and must not look as though it is. Step 1
     deletes renderStepContent, which step 64 puts back - so a second run
     over an applied file deletes the NEW one while every "add after"
     step inserts a second copy. Refuse instead. The Report Manager page
     is the marker: nothing else declares it. */
  if (/^function renderReports\s*\(/m.test(P.skeletonOf(src)))
    fail('this build already has renderReports - the directive looks applied.\n'
      + '      Restore ' + path.basename(APP) + ' from the pre-directive backup and run again.');

  const report = [];
  const losses = [];
  const merged = [];
  const splits = [];   /* steps whose insertion had to close a line an earlier one shared */
  const used = new Map();   /* what each step actually contributed, merges included */
  let bad = 0;

  for (const st of steps) {
    const skel = P.skeletonOf(src);
    const r = resolve(st, src, skel);
    if (r.err) {
      report.push('  STEP ' + st.num + '  UNRESOLVED  ' + r.err);
      bad++;
      continue;
    }
    if (r.op === 'trimEnd') {
      const trimmed = src.replace(/\n+$/, '');
      report.push('  STEP ' + st.num + '  ok  trimEnd  (' + (src.length - trimmed.length) + ' bytes)');
      src = trimmed;
      continue;
    }
    if (st.code === null && r.op !== 'delete') { report.push('  STEP ' + st.num + '  NO CODE'); bad++; continue; }

    if (r.op === 'replace' || r.op === 'delete')
      losses.push({ num: st.num, name: r.name, op: r.op, old: src.slice(r.start, r.end), now: st.code });

    /* A merged step keeps OUR body and applies the directive's delta to
       it, instead of taking the directive's whole function. */
    let code = st.code;
    if (MERGES[st.num]) {
      const edits = MERGES[st.num];
      if (r.op !== 'replace') fail('step ' + st.num + ' is merged but is not a Replace');
      const bases = new Set(edits.map(e => e.base || 'ours'));
      if (bases.size !== 1) fail('step ' + st.num + ' mixes merge bases');
      code = bases.has('ours') ? src.slice(r.start, r.end) : st.code;
      for (const e of edits) {
        const n = typeof e.find === 'string'
          ? code.split(e.find).length - 1
          : (code.match(new RegExp(e.find.source, e.find.flags.replace('g', '') + 'g')) || []).length;
        if (n !== 1) fail('step ' + st.num + ' merge "' + e.what + '": anchor matched ' + n + ' times');
        code = code.replace(e.find, e.replace);
      }
      merged.push(st.num + ' ' + r.name + ' [base: ' + [...bases][0] + ']\n      - ' + edits.map(e => e.what).join('\n      - '));
    }

    if (code !== null) used.set(st.num, code);
    if (r.op === 'replace') src = src.slice(0, r.start) + code + src.slice(r.end);
    else if (r.op === 'delete') {
      /* the whole line, trailing comment and newline included, so
         deleting does not leave an orphaned comment or a blank */
      let e = toLineEnd(src, skel, r.end); if (src[e] === '\n') e++;
      src = src.slice(0, r.start) + src.slice(e);
    } else /* after */ {
      const p = insertPoint(src, skel, r.end);
      src = src.slice(0, p.at) + '\n' + code + (p.close ? '\n' : '') + src.slice(p.at);
      if (p.close) splits.push(st.num);
    }
    report.push('  STEP ' + st.num + '  ok  ' + r.op + '  ' + r.name.slice(0, 48));
    if (STOP && st.num === STOP) {
      fs.writeFileSync(STOP_OUT || path.join(ROOT, 'tools', '_pl-stop.js'), src);
      console.log(report.join('\n'));
      console.log('\nstopped after step ' + STOP);
      return;
    }
  }

  if (LOSSES) {
    console.log('\n== What the Replace/Delete steps overwrite ==\n');
    const dir = path.join(ROOT, 'tools', '_pl-losses');
    fs.mkdirSync(dir, { recursive: true });
    for (const l of losses) {
      const oldN = l.old.replace(/\s+/g, ' ').length, newN = (l.now || '').replace(/\s+/g, ' ').length;
      console.log('STEP ' + String(l.num).padStart(3) + '  ' + l.op + '  ' + l.name.padEnd(30) + ' ours ' + oldN + ' ch -> theirs ' + newN + ' ch');
      fs.writeFileSync(path.join(dir, 'step' + String(l.num).padStart(3, '0') + '.' + l.name + '.ours.js'), l.old);
      if (l.now !== null) fs.writeFileSync(path.join(dir, 'step' + String(l.num).padStart(3, '0') + '.' + l.name + '.theirs.js'), l.now);
    }
    console.log('\nwritten to tools/_pl-losses/');
  }

  console.log(report.join('\n'));
  if (splits.length) console.log('\nline closed to make room (an earlier insertion shared it): steps ' + splits.join(','));
  if (merged.length) {
    console.log('\nMERGED (our body kept, the directive\'s delta applied to it):');
    for (const m of merged) console.log('  step ' + m);
  }
  console.log('\nsteps: ' + steps.length + '   unresolved: ' + bad);
  console.log('size: ' + before.length + ' -> ' + src.length + '   lines: ' +
    before.split('\n').length + ' -> ' + src.split('\n').length);

  if (bad) fail(bad + ' step(s) did not resolve - nothing written');

  /* Parse the result before writing it: a mis-anchored insertion is a
     syntax error far more often than it is silently wrong, and this is
     the cheapest place to find out. */
  try { new Function(src); }
  catch (e) { fail('the result does not parse: ' + e.message); }
  console.log('parse: ok');

  /* Baseline-relative: what matters is whether applying the directive
     ADDS a name nothing declares, not what the file already lacked. */
  const base = new Set(undeclared(before));
  const un = undeclared(src).filter(n => !base.has(n));
  if (base.size) console.log('undeclared, pre-existing (left alone): ' + [...base].join(' '));
  if (un.length) {
    console.log('\nUNDECLARED, INTRODUCED BY THIS DIRECTIVE:');
    for (const u of un) console.log('  ' + u);
    fail(un.length + ' introduced undeclared name(s)');
  }

  /* The same question for names the directive's code READS rather than
     calls, asked only of the code the directive brings in. Over the whole
     file this would drown in locals; over 209 known blocks it is precise
     enough to catch a read of a variable this build spells differently. */
  const declared = declaredIn(src);
  const reads = new Map();
  const guarded = new Map();
  for (const [num, code] of used) {
    /* A read the block itself guards with `typeof X !== 'undefined'` is
       a deliberate cross-module borrowing, not a missing name: this
       family's print helpers are shared verbatim between programs and
       each one's own lookup tables are optional. Report, do not fail. */
    const g = new Set();
    for (const m of P.skeletonOf(code).matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*$/g)) g.add(m[1]);
    for (const m of code.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*['"]undefined['"]/g)) g.add(m[1]);
    for (const n of refsIn(code)) if (!declared.has(n)) {
      const bag = g.has(n) ? guarded : reads;
      if (!bag.has(n)) bag.set(n, []);
      bag.get(n).push(num);
    }
  }
  if (guarded.size) {
    console.log('\nread behind a `typeof` guard, declared nowhere here (safe):');
    for (const [n, at] of [...guarded].sort()) console.log('  ' + n.padEnd(28) + ' step ' + at.join(','));
  }
  if (reads.size) {
    console.log('\nREAD BY THE DIRECTIVE, DECLARED NOWHERE HERE:');
    for (const [n, at] of [...reads].sort()) console.log('  ' + n.padEnd(28) + ' step ' + at.join(','));
    fail(reads.size + ' name(s) the directive expects and this build does not have');
  }
  console.log('undeclared: none introduced');

  if (EMIT) {
    const bak = APP + '.pre-17sep';
    if (!fs.existsSync(bak)) { fs.writeFileSync(bak, before); console.log('backed up the pre-directive build to ' + path.basename(bak)); }
    fs.writeFileSync(APP, src);
    console.log('wrote ' + APP);
    emitCss();
  } else {
    console.log('(dry run - pass --emit to write)');
  }
}

/* -- Section 5: the four stylesheet changes ------------------
   Each is "find the line that reads exactly as shown, confirm that it
   appears once, and add the new line immediately after it".

   Change 2 is the exception the directive itself calls out: the line
   `.main-content{margin-left:0!important}` appears TWICE, and only the
   copy that follows `body{background:#fff;color:#000}` inside the
   @media print block is meant. Anchoring on the PAIR is what makes it
   unique - the second copy has no such line above it. */
const CSS_EDITS = [
  {
    what: 'Change 1 - the outlined Save as PDF button',
    find: '.bg2{background:transparent;color:var(--stone);border:1px solid var(--border-faint)}',
    add: '.btn.bg2{white-space:nowrap;padding:7px 14px;border-radius:6px;align-self:flex-start;height:fit-content}'
  },
  {
    what: 'Change 2 - print: no controls, fields as their values, colours kept',
    find: '  body{background:#fff;color:#000}\n  .main-content{margin-left:0!important}',
    add: '  button,.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none!important}\n'
      + '  select{-webkit-appearance:none;appearance:none;border:none;background:none}\n'
      + '  textarea{border:none;background:none;resize:none}\n'
      + '  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  },
  {
    what: 'Change 3 - the title wraps in its own column so the control keeps the title line',
    find: '.flx-between-top-mb{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}',
    add: '.flx-between-top-mb>:first-child{flex:1 1 0;min-width:0}.flx-between-top-mb>:last-child{flex-shrink:0} /* 13 Sep 2026 (Paul): the heading text wraps in its own column so the Save as PDF control sits on the title line, right-justified, instead of dropping below */'
  },
  {
    what: "Change 4 - the Report Manager's 1350px block",
    find: '.main-content .content-inner{margin-left:max(0px,calc(50vw - var(--sbw) - 450px));margin-right:auto;transition:margin-left .25s cubic-bezier(.16,1,.3,1)}',
    add: ".content-inner.rc-page{max-width:1350px;margin-left:max(0px,calc(50vw - var(--sbw) - 675px))} /* 16 Sep 2026 (Paul's ruling, family): the Report Manager's 1350px block centres on the page when the sidebar is closed; the shared formula above is written for the 900px column */"
  }
].map(e => Object.assign(e, { replace: e.find + '\n' + e.add }));
function emitCss() {
  let css = fs.readFileSync(CSS, 'utf8');
  const bak = CSS + '.pre-17sep';
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, css);
  let n = 0;
  for (const e of CSS_EDITS) {
    if (e.add && css.includes(e.add)) { console.log('css: "' + e.what + '" already present'); continue; }
    const hits = css.split(e.find).length - 1;
    if (hits !== 1) fail('css anchor for "' + e.what + '" found ' + hits + ' times');
    css = css.replace(e.find, e.replace);
    n++;
  }
  fs.writeFileSync(CSS, css);
  console.log('css: applied ' + n + ' of ' + CSS_EDITS.length + ' change(s)');
}

/* -- The check that catches a step written against another build ---- */
function declaredIn(src) {
  const skel = P.skeletonOf(src);
  const declared = new Set([...P.BROWSER, 'ResizeObserver', 'MutationObserver', 'IntersectionObserver', 'arguments', 'this', 'undefined', 'null', 'true', 'false', 'NaN', 'Infinity']);
  for (const m of skel.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/function[^(]*\(([^)]*)\)/g))
    for (const p of m[1].split(',')) { const n = p.trim().split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n); }
  for (const m of skel.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  return declared;
}

function undeclared(src) {
  const skel = P.skeletonOf(src);
  const declared = declaredIn(src);
  const called = new Set();
  for (const m of skel.matchAll(/(^|[^\w.$'"])([A-Za-z_$][\w$]*)\s*\(/g))
    if (!P.JS_KEYWORDS.has(m[2])) called.add(m[2]);
  return [...called].filter(n => !declared.has(n)).sort();
}

/* js-port's keyword list is the one its own scans needed - names that
   appear before a `(`. These never do. */
const MORE_KW = new Set(['try', 'finally', 'continue', 'break', 'throw', 'case', 'default',
  'instanceof', 'const', 'let', 'yield', 'await', 'class', 'extends', 'super', 'debugger', 'with']);

/* Every identifier a block REFERENCES: not a property (`a.b`), not an
   object key (`b:`), not a declaration of its own, not inside a string. */
function refsIn(code) {
  const skel = P.skeletonOf(code);
  const own = declaredIn(code);
  const out = new Set();
  for (const m of skel.matchAll(/(^|[^\w.$])([A-Za-z_$][\w$]*)/g)) {
    const n = m[2];
    const after = skel.slice(m.index + m[0].length);
    if (/^\s*:/.test(after)) continue;              // object key
    if (P.JS_KEYWORDS.has(n) || MORE_KW.has(n) || own.has(n)) continue;
    out.add(n);
  }
  return out;
}

function fail(msg) { console.error('\nFAIL: ' + msg); process.exit(1); }
main();
