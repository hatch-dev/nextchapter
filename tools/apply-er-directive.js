#!/usr/bin/env node
/* -------------------------------------------------------------
   apply-er-directive.js - apply the 16 Sep 2026 Executive
   Readiness directive to the dev build, step by step
   -------------------------------------------------------------
   reference/Directive_DEV_Executive_Readiness_Complete_16Sep2026.md
   is 184 numbered steps against
   enterprises/dev/executive-readiness-prototype/Exec-Readiness-app.js, plus one
   line for Exec-Readiness-styles.css.

   The directive gives no line numbers on purpose: every step names its
   place by a function name, a constant name, or the exact text of a
   line. That is mechanical, so it is applied mechanically - by hand,
   184 insertions into a 720 KB file is a silent-corruption machine,
   and re-running is the only way to prove what was applied.

   Anchors are resolved over the LEXED SKELETON (tools/lib/js-port.js),
   never a regex over the source: these bodies are full of braces and
   semicolons inside CSS strings, and a naive scan truncates a function
   without erroring - a file that still parses and renders half a step.

   Usage:
     node tools/apply-er-directive.js            # report: does every anchor resolve?
     node tools/apply-er-directive.js --losses   # what the Replace/Delete steps overwrite
     node tools/apply-er-directive.js --emit     # write the file
   ------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./lib/js-port.js');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'reference', 'Directive_DEV_Executive_Readiness_Complete_16Sep2026.md');
const APP = path.join(ROOT, 'enterprises', 'dev', 'executive-readiness-prototype', 'Exec-Readiness-app.js');
const CSS = path.join(ROOT, 'enterprises', 'dev', 'executive-readiness-prototype', 'Exec-Readiness-styles.css');

const EMIT = process.argv.includes('--emit');
const LOSSES = process.argv.includes('--losses');
/* --stop N: apply steps 1..N and dump the result to a scratch file, for
   working out why step N+1's anchor does not resolve. */
const STOP = (() => { const i = process.argv.indexOf('--stop'); return i < 0 ? 0 : parseInt(process.argv[i + 1], 10); })();
const STOP_OUT = (() => { const i = process.argv.indexOf('--stop'); return i < 0 ? null : process.argv[i + 2]; })();

/* -- Parse the directive -------------------------------------
   A step's markdown holds up to TWO fenced blocks: an ANCHOR fence
   under *Where* ("the line reading exactly"), and the replacement
   after `**Code:**`. Split on `**Code:**` or a Replace step's own
   anchor reads as its code. */
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

   Three of the 29 Replace steps are that case. Our build carries
   family-wide rulings Paul's line never had, and for these three the
   directive's ACTUAL change is one or two lines - everything else in
   its block is the same code spelled unspaced. So rather than replace
   the function and try to put our rulings back, we keep OUR function
   and apply the directive's delta to it. Each edit must match exactly
   once or the run stops: a reworded anchor must be looked at, never
   skipped.

   What each one preserves, and why it is unrelated to printing:
     3  render      - the AI Guide FAB suppressed on the signed-out gate
                      (28 Jul, family-wide); repaintOpenPanels() on both
                      render paths (27 July, F-3/F-11/F-15); and the
                      unsaved-field capture and re-injection, whose
                      adoption guard (idToRecordKey/_adoptPaint/
                      _heldLock) is the record-lock layer. Dropping the
                      last one resurrects a stale local value into a
                      field a teammate has just cleared.
     4  renderNav   - Item-2 (Fix Batch 1): a 5.x step lights the Lead
                      tab. And the directive reads `gchatUnreadCount`,
                      a variable this build does not have (ours is the
                      function gchatUnread()) - left in, it throws
                      inside the first function render() calls and the
                      whole app goes blank.
     51 renderOrg
        ChartInter  - Item-11 (F-10, 27 July): a chart holding only the
                      auto-injected board placeholder counts as empty,
                      so the guidance card shows.

   Step 44 (seedData) is the fourth, and the other way round: most of
   what it changes IS this document's business, so it is the base and
   our rulings are put back into it. `base:'theirs'` says so. Taking it
   whole cost 23 harness assertions:

     - the enterprise profile and five Step 1.1 answers (size, maturity,
       fluency.engagement, structure.ownership/boardOversight/crossFunc,
       ethical.workforce) are rendered by sel() dropdowns here. The
       directive seeds prose into them; a <select> whose value is not
       one of its options renders with nothing chosen, which is what
       FB1-9's "zero out-of-vocabulary seed values" audits. None of the
       new documents read these fields - they read the per-LEADER
       engagement, a different field - so putting the vocabulary back
       changes nothing this directive asked for.
     - the practice archive (FB1-6, Item-6/F-4): ours derives the
       population from data.leaders, so all 13 grid leaders are archived
       in the archiver's own shape and a leader with no login reads
       not-done, since they can never log a practice. The directive
       hard-codes ten names.
     - "quietly" twice: banned module-wide by FB1-4 (item 4).

   What is NOT put back, because the directive means to change it:
   functionModels moves to the {name,model} shape step 2.2 now writes;
   mmActivation's ai/human become aiRole/humanRole, which is what this
   build's readers already expected (the old seed was writing keys
   nothing read); and the Step 4.3 assessments take the four values
   (developed/progressing/support/hard) with two leaders deliberately
   unassessed - so FB1-9's four count assertions, which were ALREADY
   failing 0-of-4 before this directive, now read 4/1/3/2 against an
   expectation the 15 September ruling supersedes.

   Everything else is taken as written, including step 59's
   printOrgChart, which loses a Safari fix of ours but is unreachable
   after this directive (the Print Org Chart button goes) - the only
   remaining mention of the name in the emitted file is its own
   declaration.

   A `find` may be a string or a RegExp; either must match exactly
   once. */
const MERGES = {
  3: [{
    what: 'the Report Manager route',
    find: "  else if (currentPage === 'mgmt-hub') h = renderMgmtHub();\n",
    replace: "  else if (currentPage === 'mgmt-hub') h = renderMgmtHub();\n" +
      "  else if (currentPage === 'reports') h = renderReports(); /* 14 Sep 2026: the Report Manager page */\n"
  }],
  4: [{
    what: "the Report Manager's door in the More menu",
    find: "onclick=\"closeNavMore();go(\\'mgmt-hub\\')\"><span class=\"nav-more-ic\">\\u25a6</span> Track Program</button>' +\n",
    replace: "onclick=\"closeNavMore();go(\\'mgmt-hub\\')\"><span class=\"nav-more-ic\">\\u25a6</span> Track Program</button>' +\n" +
      "    '<button class=\"nav-more-item' + (currentPage === 'reports' ? ' nav-action-on' : '') + '\" role=\"menuitem\" onclick=\"closeNavMore();go(\\'reports\\')\"><span class=\"nav-more-ic\">\\u25a7</span> Report Manager</button>' + /* 14 Sep 2026 (Paul's ruling): the Report Manager's door */\n"
  }],
  51: [{
    what: 'the fitted screen layout, so Fit-to-window measures the right width',
    find: 'var layout = layoutOrgTree(roles);',
    replace: 'var layout = layoutOrgTreeScreen(roles); /* 16 Sep 2026: the fitted layout the chart draws, so Fit-to-window measures the right width */'
  }],
  44: [
    { base: 'theirs', what: 'FB1-9: the size the org modal can select', find: /size:'~900 employees[^']*',/, replace: "size:'201\\u20131,000'," },
    { base: 'theirs', what: 'FB1-9: the maturity the org modal can select', find: /maturity:'Early -- strong operators[^']*',/, replace: "maturity:'Piloting'," },
    { base: 'theirs', what: 'FB1-9: fluency.engagement vocabulary', find: /engagement:'Mixed\.[^']*',/, replace: "engagement:'occasional'," },
    { base: 'theirs', what: 'FB1-9: structure.ownership vocabulary', find: /ownership:'Ambiguous\.[^']*',/, replace: "ownership:'cao'," },
    { base: 'theirs', what: 'FB1-9: structure.boardOversight vocabulary', find: /boardOversight:'Light\.[^']*',/, replace: "boardOversight:'none'," },
    { base: 'theirs', what: 'FB1-9: structure.crossFunc vocabulary', find: /crossFunc:'Weak\.[^']*',/, replace: "crossFunc:'none'," },
    { base: 'theirs', what: 'FB1-9: ethical.workforce vocabulary', find: /workforce:'Roughly[^']*',/, replace: "workforce:'undecided'," },
    { base: 'theirs', what: 'FB1-4: the banned word, in seed_coo', find: "selfAudit:'I ask whose judgment the tool is quietly replacing.'", replace: "selfAudit:'I ask whose judgment the tool is replacing unnoticed.'" },
    { base: 'theirs', what: 'FB1-4: the banned word, in the ethical scenario', find: 'or a quietly unfair pricing pattern)', replace: 'or a subtly unfair pricing pattern)' },
    {
      base: 'theirs', what: 'FB1-6 (Item-6/F-4): the archive covers all 13 grid leaders',
      find: /var _pUsers=\[\{id:'u6'[^\]]*\];/,
      replace: "/* Item-6 (F-4 ruling): the seeded history regenerates in the archiver's shape - all 13 grid leaders, keyed as the archiver keys them. */\n    var _pUsers=(data.leaders||[]).map(function(l){return {id:(l.userId||l.id),name:l.name}});\n    var _pNoLogin={};(data.leaders||[]).forEach(function(l){if(!l.userId)_pNoLogin[l.id]=true});"
    },
    {
      base: 'theirs', what: 'FB1-6 (Item-6): a leader with no login reads not-done',
      find: "var s = v<7?'green':'red';",
      replace: "var s = (_pNoLogin[u.id] || v>=7) ? 'red' : 'green'; /* Item-6: no-login leaders can never log practices - history rows read not-done */"
    }
  ]
};

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
   find that line, then run to the end of the statement it opens.

   The line is matched with whitespace SQUASHED. The directive quotes the
   12 September file, which is written unspaced (`if(!_bootDone){`); our
   build has since been re-formatted with spaces around operators
   (`if (!_bootDone) {`), so an exact match finds nothing and the step
   reads as inapplicable when it is only spelled differently. Only the
   ONE pre-existing anchor is affected - steps 95/97/101 anchor on lines
   this directive itself inserted, which arrive unspaced either way. */
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
   build writes a trailing `/* ... *\/` explanation after most of them, and
   the directive's own code blocks do the same. Inserting immediately
   after the brace therefore lands BETWEEN the statement and its comment,
   which shunts that comment onto the end of the inserted line - and the
   next step, which anchors on "the line reading exactly <that line>",
   then finds nothing. Seen as a chain of five comments collecting on one
   line at the end of the file.

   So: if everything from the closing brace to the newline is whitespace
   or comment, the insertion point is the newline. Comments are blanked
   to spaces by lex(), and strings keep their delimiters, so an all-space
   skeleton tail is exactly "nothing but comment left on this line". */
function toLineEnd(src, skel, end) {
  let nl = src.indexOf('\n', end);
  if (nl < 0) nl = src.length;
  return /^\s*$/.test(skel.slice(end, nl)) ? nl : end;
}

/* Which anchor a step's *Where* names. */
function resolve(step, src, skel) {
  const w = step.where.replace(/\s+/g, ' ');
  let m;
  if ((m = w.match(/^Replace the whole function named `([\w$]+)`\./)))
    return Object.assign({ op: 'replace', name: m[1] }, fnRange(src, skel, m[1]));
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
  if (steps.length !== 184) fail('expected 184 steps, parsed ' + steps.length);

  let src = fs.readFileSync(APP, 'utf8');
  const before = src;

  /* This is not idempotent and must not look as though it is. Step 1
     deletes renderStepContent, which step 68 puts back - so a second
     run over an applied file deletes the NEW one and re-adds it while
     every "add after" step inserts a second copy. Refuse instead. The
     Report Manager page is the marker: nothing else declares it. */
  if (/^function renderReports\s*\(/m.test(P.skeletonOf(src)))
    fail('this build already has renderReports - the directive looks applied.\n'
      + '      Restore ' + path.basename(APP) + ' from the pre-directive backup and run again.');
  const report = [];
  const losses = [];
  const merged = [];
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

    if (r.op === 'replace' || r.op === 'delete') {
      losses.push({ num: st.num, name: r.name, op: r.op, old: src.slice(r.start, r.end), now: st.code });
    }

    /* A merged step keeps OUR body and applies the directive's delta to
       it, instead of taking the directive's whole function. */
    let code = st.code;
    if (MERGES[st.num]) {
      const edits = MERGES[st.num];
      if (r.op !== 'replace') fail('step ' + st.num + ' is merged but is not a Replace');
      /* 'ours' edits the body already in the file; 'theirs' edits the
         directive's block. One step uses one base - mixing them would
         make the order of the edits matter. */
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
      /* the whole line, trailing comment and newline included, so deleting
         does not leave an orphaned comment or a blank */
      let e = toLineEnd(src, skel, r.end); if (src[e] === '\n') e++;
      src = src.slice(0, r.start) + src.slice(e);
    } else /* after */ {
      const at = toLineEnd(src, skel, r.end);
      src = src.slice(0, at) + '\n' + st.code + src.slice(at);
    }
    report.push('  STEP ' + st.num + '  ok  ' + r.op + '  ' + r.name.slice(0, 48));
    if (STOP && st.num === STOP) {
      fs.writeFileSync(STOP_OUT || path.join(ROOT, 'tools', '_er-stop.js'), src);
      console.log(report.join('\n'));
      console.log('\nstopped after step ' + STOP);
      return;
    }
  }

  if (LOSSES) {
    console.log('\n== What the Replace/Delete steps overwrite ==\n');
    const dir = path.join(ROOT, 'tools', '_er-losses');
    fs.mkdirSync(dir, { recursive: true });
    for (const l of losses) {
      const oldN = l.old.replace(/\s+/g, ' ').length, newN = (l.now || '').replace(/\s+/g, ' ').length;
      console.log('STEP ' + l.num + '  ' + l.op + '  ' + l.name + '   ours ' + oldN + ' ch -> theirs ' + newN + ' ch');
      fs.writeFileSync(path.join(dir, 'step' + String(l.num).padStart(3, '0') + '.' + l.name + '.ours.js'), l.old);
      if (l.now !== null) fs.writeFileSync(path.join(dir, 'step' + String(l.num).padStart(3, '0') + '.' + l.name + '.theirs.js'), l.now);
    }
    console.log('\nwritten to tools/_er-losses/');
  }

  console.log(report.join('\n'));
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

  /* Baseline-relative: this file already calls two names it never
     declares (asgnOverviewCard, and ResizeObserver which is simply not
     in js-port's browser list). Those are pre-existing and not this
     directive's business - what matters is whether applying it ADDS
     any. */
  const base = new Set(undeclared(before));
  const un = undeclared(src).filter(n => !base.has(n));
  if (base.size) console.log('undeclared, pre-existing (left alone): ' + [...base].join(' '));
  if (un.length) {
    console.log('\nUNDECLARED, INTRODUCED BY THIS DIRECTIVE:');
    for (const u of un) console.log('  ' + u);
    fail(un.length + ' introduced undeclared name(s)');
  }

  /* The same question for names the directive's code READS rather than
     calls, asked only of the code the directive brings in. Over the
     whole file this would drown in locals; over 184 known blocks it is
     precise enough to have caught renderNav's `gchatUnreadCount`. */
  const declared = declaredIn(src);
  const reads = new Map();
  for (const [num, code] of used) {
    for (const n of refsIn(code)) if (!declared.has(n)) {
      if (!reads.has(n)) reads.set(n, []);
      reads.get(n).push(num);
    }
  }
  if (reads.size) {
    console.log('\nREAD BY THE DIRECTIVE, DECLARED NOWHERE HERE:');
    for (const [n, at] of [...reads].sort()) console.log('  ' + n.padEnd(28) + ' step ' + at.join(','));
    fail(reads.size + ' name(s) the directive expects and this build does not have');
  }
  console.log('undeclared: none introduced');

  if (EMIT) {
    const bak = APP + '.pre-16sep';
    if (!fs.existsSync(bak)) { fs.writeFileSync(bak, before); console.log('backed up the pre-directive build to ' + path.basename(bak)); }
    fs.writeFileSync(APP, src);
    console.log('wrote ' + APP);
    emitCss();
  } else {
    console.log('(dry run - pass --emit to write)');
  }
}

/* -- Section 5: the one stylesheet line ---------------------- */
const CSS_ANCHOR = '.main-content .content-inner.board-page{margin-left:max(0px,calc(50vw - var(--sbw)/2 - 450px))}';
const CSS_ADD = ".content-inner.rc-page{max-width:1350px;margin-left:max(0px,calc(50vw - var(--sbw) - 675px))} /* 16 Sep 2026 (Paul's ruling): the Report Manager's 1350px block centres on the page when the sidebar is closed; the shared formula above is written for the 900px column */";
function emitCss() {
  let css = fs.readFileSync(CSS, 'utf8');
  if (css.includes(CSS_ADD)) { console.log('css: already present'); return; }
  const n = css.split(CSS_ANCHOR).length - 1;
  if (n !== 1) fail('css anchor found ' + n + ' times');
  css = css.replace(CSS_ANCHOR, CSS_ANCHOR + '\n' + CSS_ADD);
  fs.writeFileSync(CSS, css);
  console.log('css: added rc-page rule');
}

/* -- The check that catches a step written against another build ----
   The directive descends from Paul's 12 September line; our build has
   family-wide work his never had, and has lost nothing he added. Where
   the two disagree about a NAME, a whole-function replace can bring in
   a call to something that does not exist here - renderNav's
   `gchatUnreadCount` (ours is the function `gchatUnread()`), which
   throws inside the function render() calls first and takes the whole
   app down. A parse check cannot see it; this can.

   Deliberately crude: every called name, minus everything the file
   declares at any depth, minus the browser. Local parameters and inner
   declarations are collected too, so this over-forgives rather than
   crying wolf - it is a floor, not a type checker. */
function declaredIn(src) {
  const skel = P.skeletonOf(src);
  const declared = new Set([...P.BROWSER, 'ResizeObserver', 'MutationObserver', 'IntersectionObserver', 'arguments', 'this', 'undefined', 'null', 'true', 'false', 'NaN', 'Infinity']);
  for (const m of skel.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of skel.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  /* parameter lists, and `var a=1,b=2` continuations */
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
   appear before a `(`. These never do, so without them every try /
   finally / continue in a step's code reads as an undeclared name. */
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
