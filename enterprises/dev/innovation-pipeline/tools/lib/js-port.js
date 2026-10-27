/* ─────────────────────────────────────────────────────────────
   js-port.js — the machinery for lifting a program out of a
   standalone reference build and into a module
   ─────────────────────────────────────────────────────────────
   Each program in this suite was BUILT as a whole second copy of the
   application — its own store, its own sign-in, its own header — and
   then ported onto the shared shell. Everything that copy duplicates
   is the shell's here; what we want out of it is only the program:
   its screens, its handlers, its content tables.

   tools/port-exec-readiness.js did that job first and still owns its
   own copy of this code, deliberately: its output (js/modules/
   exec-readiness/steps.js) is byte-diffed against the reference by
   tools/exec-readiness-diff.js, and a shared library that drifted
   would move those bytes for reasons nothing in that program asked
   for. This file is the same machinery, generalised, for the ports
   that came after — read that script's header comments for the full
   reasoning behind each rule below; they are not repeated here.

   The three rules that make this mechanical rather than manual:

   1. NAMES COLLIDE. A reference build defines renderStep, go, esc,
      render — and so does our shell, for every module. So a ported
      function cannot stay a global: it goes on the one namespace the
      module owns (`DL`, `EE`, …).

   2. HANDLERS LIVE IN STRINGS. The markup is built as HTML text with
      inline onclick="saveFlow('x')", and handler expressions are also
      passed as string ARGUMENTS. Renaming the function is not enough:
      every occurrence inside a string has to be rewritten too, or the
      button renders and does nothing.

   3. CALLS ARE FOUND, NOT LISTED. Naming the page-level renderers is
      enough; the closure follows every call each of them makes —
      including the ones written inside strings — and brings those
      across too.

   Exports: lex/skeletonOf/stringsOf, extract/extractVar/topLevelVars,
   callsIn/callsInCode/callsInStrings/reads, rewriteHandlers,
   rewriteMedia, and closure(), which runs 1–3 above and hands back
   everything the emitter needs.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

/* ── The lexer ─────────────────────────────────────────────────
   Everything here reads JavaScript, and every one of these jobs — find the end
   of a function, find the end of a var initialiser, find the calls, find the
   handler strings — is wrong if it cannot tell code from a string from a
   comment from a regex. Two blind spots a naive scan always has:

     `https://…` inside a string.  Scanning for `//` without knowing you are
     inside a string reads the rest of the line as a comment, and in a
     generated file whose lines run to tens of thousands of characters that
     discards whole functions.

     /["']/  a regex literal containing a quote. Treat it as code and the quote
     opens a string that never closes, and the scan is lost from there on.

   So: lex once into a SKELETON — the same string, same length, with every
   comment, string body and regex body blanked to spaces. Offsets still line
   up, so anything found in the skeleton can be sliced out of the real source.

   Not a parser. It does not need to be: it needs to know which characters are
   code, and it is right about that. */
const REGEX_AFTER_CHAR = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '\n', '']);
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'instanceof']);

function lex(src) {
  const out = new Array(src.length).fill(' ');
  const strs = [];                       // [start, end) of each string BODY
  let i = 0, prevChar = '', prevWord = '';
  const keep = k => { out[k] = src[k]; };

  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i); i = e < 0 ? src.length : e + 2; continue;
    }
    /* A leading `/` is a regex only where an expression may start. Everywhere
       else it is division, and consuming `a / b … / c` as a literal would
       blank real code. */
    if (c === '/' && (REGEX_AFTER_CHAR.has(prevChar) || REGEX_AFTER_WORD.has(prevWord))) {
      let j = i + 1, esc = false, inClass = false, ok = false;
      for (; j < src.length; j++) {
        const d = src[j];
        if (esc) { esc = false; continue; }
        if (d === '\\') { esc = true; continue; }
        if (d === '[') { inClass = true; continue; }
        if (d === ']') { inClass = false; continue; }
        if (d === '\n') break;                       // unterminated → it was division
        if (d === '/' && !inClass) { ok = true; break; }
      }
      if (ok) {
        keep(i); keep(j);                            // delimiters stay, body blanked
        i = j + 1;
        while (i < src.length && /[gimsuyd]/.test(src[i])) { keep(i); i++; }
        prevChar = '/'; prevWord = ''; continue;
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, esc = false;
      for (; j < src.length; j++) {
        const d = src[j];
        if (esc) { esc = false; continue; }
        if (d === '\\') { esc = true; continue; }
        if (d === c) break;
      }
      keep(i); if (j < src.length) keep(j);
      strs.push([i + 1, Math.min(j, src.length)]);
      i = j + 1; prevChar = '"'; prevWord = ''; continue;
    }

    keep(i);
    if (!/\s/.test(c)) {
      prevChar = c;
      prevWord = /[A-Za-z0-9_$]/.test(c) ? prevWord + c : '';
    } else if (c === '\n') prevChar = '\n';
    i++;
  }
  return { skel: out.join(''), strs };
}

/* Small memo (21 Oct 2026). extract() is handed the whole reference and, with
   no skeleton passed, lexed all of it again on every lookup — thousands of
   lookups per closure, interleaved with lexes of single bodies (so a one-entry
   cache misses every time). Harmless at 1 MB, minutes at the 2 MB Architecture
   build. Same input, same output; only the repeat is skipped. A Map keyed by
   the string: V8 keeps a string's hash on the string, so the big one hashes once. */
const _skelMemo = new Map();
function skeletonOf(code) {
  let s = _skelMemo.get(code);
  if (s === undefined) {
    s = lex(code).skel;
    if (_skelMemo.size >= 16) _skelMemo.delete(_skelMemo.keys().next().value);
    _skelMemo.set(code, s);
  }
  return s;
}
function stringsOf(code) {
  const { strs } = lex(code);
  return strs.map(([a, b]) => code.slice(a, b)).join('\n');
}

/* ── Extraction ────────────────────────────────────────────────
   A brace scan over the skeleton, not a regex over the source: these function
   bodies are full of braces inside CSS strings and character classes, and a
   naive match truncates them silently — a file that parses and renders half a
   screen. */
function extract(src, name, skel) {
  skel = skel || skeletonOf(src);
  const start = skel.search(new RegExp('^function\\s+' + name + '\\s*\\(', 'm'));
  if (start < 0) return null;
  let i = skel.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  for (; i < skel.length; i++) {
    if (skel[i] === '{') depth++;
    else if (skel[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

/* A function the reference assigns rather than declares:

     var applyDemoSeed = null;          // declared up here so callers can see it
     …
     try { applyDemoSeed = function () { … } }   // assigned down in the INIT block

   extract() cannot see it — there is no `function applyDemoSeed(`— and the var
   scanner captures only the `null`. Ported as the two halves it is, the module
   gets a program whose "Seed sample data" hits its own safety fallback and
   reloads the page forever. So it is turned back into a declaration, which is
   what it would have been if the reference had not needed it hoisted past its
   own boot block. Named in each config (ASSIGN_FNS) rather than discovered,
   because an assignment to a name is a much weaker signal than a declaration
   of it and a wrong guess here lifts a local. */
function extractAssignFn(src, name, skel) {
  skel = skel || skeletonOf(src);
  const re = new RegExp('(?<![A-Za-z0-9_$.])' + name + '\\s*=\\s*function\\s*\\(');
  const m = re.exec(skel);
  if (!m) return null;
  const argOpen = skel.indexOf('(', m.index + name.length);
  const argClose = skel.indexOf(')', argOpen);
  let i = skel.indexOf('{', argClose);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < skel.length; j++) {
    if (skel[j] === '{') depth++;
    else if (skel[j] === '}') {
      depth--;
      if (depth === 0) {
        return 'function ' + name + '(' + src.slice(argOpen + 1, argClose) + ') '
          + src.slice(i, j + 1);
      }
    }
  }
  return null;
}

/* Content tables, lookup maps and module state the reference declares as
   top-level `var`s. extract() only sees functions, so without this they
   vanish — and a missing one is not a parse error, it is a screen that renders
   down to the line that reads it and then dies.

   One pass finds every top-level declarator AND its initialiser text, because
   these builds use both shapes and the second is the common one:

     var NAME = <initialiser>;                  — its own statement
     var A = 1, NAME = <initialiser>, B = 2;    — one declarator of many

   which is why what comes back is the INITIALISER, not the statement: the
   emitter writes its own declaration around it, so one declarator can be
   lifted out of a list without dragging its neighbours along. A declarator
   with no initialiser (`var focusPanel;`) yields 'undefined' — declared, and
   deliberately unassigned, exactly as the reference has it.

   Brace depth, not column position. Anchoring to the start of a line looks
   equivalent and is not: these builds are half hand-written and half
   generated, so plenty of function-local declarations begin at column 0 too.
   That reading offers up `h`, `rows`, `sd` and thirty more as program
   content. Nesting is tracked while scanning a declarator for the same reason
   extract() scans braces: these literals are full of commas and semicolons
   inside CSS strings and prose. */
function topLevelVarInits(src) {
  const skel = skeletonOf(src);
  const out = new Map();
  let depth = 0, paren = 0;
  for (let i = 0; i < skel.length; i++) {
    const c = skel[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (c === '(') { paren++; continue; }
    if (c === ')') { paren--; continue; }
    if (depth !== 0 || paren !== 0 || c !== 'v') continue;
    if (/[A-Za-z0-9_$.]/.test(skel[i - 1] || ' ')) continue;
    if (!/^var\s/.test(skel.slice(i, i + 4))) continue;

    let j = i + 3, d = 0;
    while (j < skel.length) {
      while (j < skel.length && /\s/.test(skel[j])) j++;
      const nameStart = j;
      while (j < skel.length && /[A-Za-z0-9_$]/.test(skel[j])) j++;
      const name = skel.slice(nameStart, j);
      if (!name) break;
      while (j < skel.length && /\s/.test(skel[j])) j++;
      if (skel[j] === '=') {
        j++;
        const initStart = j;
        for (; j < skel.length; j++) {
          const ch = skel[j];
          if (ch === '{' || ch === '[' || ch === '(') d++;
          else if (ch === '}' || ch === ']' || ch === ')') d--;
          else if (d === 0 && (ch === ',' || ch === ';')) break;
        }
        if (!out.has(name)) out.set(name, src.slice(initStart, j).trim());
      } else if (!out.has(name)) {
        out.set(name, 'undefined');
      }
      if (skel[j] === ',') { j++; continue; }
      break;
    }
    i = j;
  }
  return out;
}
/** Just the names — what a ported body's reads are matched against. */
function topLevelVars(src) { return [...topLevelVarInits(src).keys()]; }

/* ── Handler rewriting ─────────────────────────────────────────
   A ported name needs the namespace prefix wherever it is written as TEXT the
   browser will later evaluate, and nowhere else.

   Scoping this to on*="…" attributes is not enough, and that is the trap:
   this codebase also passes handler expressions as STRING ARGUMENTS —
   btn(label, 'saveFlow(\\'x\\')') builds the onclick itself. Miss those and the
   page renders perfectly and every button is dead.

   So the rule is "inside a string literal": exactly the set of places a name
   is code-to-be-evaluated-later rather than a call resolved right now.
   Outside strings these functions are in scope inside the IIFE and stay bare.

   FUNCTIONS ONLY. The ported VARIABLES are not rewritten and do not need to
   be: they are emitted as globals (see the emitter's note), precisely because
   inline handlers assign to them — `onclick="specOpen=!specOpen;render()"` —
   and a handler and the module's own code have to be reading and writing the
   same binding. Prefix the handler's copy and the two silently drift: the
   panel opens in `DL.specOpen` and the renderer keeps consulting `specOpen`,
   so the button does nothing that anyone can see. */
function rewriteHandlers(code, names, ns, shellGlobals) {
  const fns = new Set([...names].filter(n => !shellGlobals.has(n)));
  const call = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  const fix = s => s.replace(call, (m, fn) => fns.has(fn) ? ns + '.' + fn + '(' : m);

  // Back to front, so an earlier rewrite cannot shift a later range's offsets.
  const { strs } = lex(code);
  let out = code;
  for (let k = strs.length - 1; k >= 0; k--) {
    const [a, b] = strs[k];
    out = out.slice(0, a) + fix(out.slice(a, b)) + out.slice(b);
  }
  return out;
}

/* ── Media paths ───────────────────────────────────────────────
   A reference build is a flat folder: its videos sit beside index.html, so the
   markup says src="The Decision Lab - Assess.mp4". Here the same files live
   under assets/media/<module>/ and every relative URL resolves against
   <base href="/apps/">, so a bare filename 404s — a video element that renders
   as a black box with no error anywhere.

   Only bare names are touched. Anything already carrying a path (or a data:/
   http: URL) is left exactly as it is. */
const MEDIA_EXT = 'mp4|jpg|jpeg|png|webm|webp|svg';
function rewriteMedia(code, prefix) {
  return code
    // src="Part One The Frame.mp4" — written straight into markup
    .replace(new RegExp('(src=")([^"/:]+\\.(?:' + MEDIA_EXT + '))(")', 'g'),
      (m, a, file, b) => a + prefix + file + b)
    /* …and the ones assembled at runtime: `{src:'Assess.mp4'}` reaches the
       markup as '<source src="'+v.src+'"', which the rule above cannot see. A
       string literal that is NOTHING BUT a bare media filename is a path under
       the old flat folder — there is no other reason to write one — so it
       takes the prefix too. Anchored end to end so a sentence mentioning a
       file name is left alone. */
    .replace(new RegExp("(['\"])([^'\"/:]+\\.(?:" + MEDIA_EXT + '))\\1', 'g'),
      (m, q, file) => q + prefix + file + q);
}

/* ── What the shell already provides ───────────────────────────
   Read, not assumed: the shell is 1600-odd functions and a stale hand-list
   would silently re-port something that already exists, shadowing the real
   one. Anything named in a config's PORT list overrides this. */
const SHELL_FILES = ['js/app.js', 'js/auth.js', 'js/nav.js', 'js/home.js', 'js/learn.js',
  'js/insights.js', 'js/screen-loader.js', 'js/router.js', 'js/launchpad.js',
  'js/pages/navigate.js', 'js/steps/phase1.js', 'js/steps/phase2.js',
  'js/steps/phase3.js', 'js/steps/phase4.js', 'js/dev/seed.js',
  /* my-assignments.js was missing from this list until 2026-09-01. Everything
     it defines — openAssignments, renderAssignmentsModal, the asgn* row
     builders — was therefore invisible here, so a reference that defines the
     same names had them ported instead of deferring to the shell's. It cost
     nothing for the two Leaders programs (neither calls one) and was found
     porting Responsible AI Governance, which calls four. */
  'js/features/assignments.js', 'js/features/my-assignments.js',
  'js/features/budget.js', 'js/features/charts.js',
  'js/features/chat.js', 'js/features/coach.js', 'js/features/email.js',
  'js/features/help.js', 'js/features/notes.js', 'js/features/org-admin.js',
  'js/features/sidebar.js', 'js/features/voice.js'];

function shellProvides(root) {
  const names = new Set();
  SHELL_FILES.forEach(f => {
    let s = '';
    try { s = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { return; }
    (s.match(/^\s*function\s+([A-Za-z0-9_$]+)/gm) || []).forEach(m => names.add(m.trim().split(/\s+/)[1]));
    (s.match(/^\s*var\s+([A-Za-z0-9_$]+)\s*=\s*function/gm) || []).forEach(m => names.add(m.trim().split(/\s+/)[1]));
    /* The shell's own globals — data, UI, Store, PH, currentOrgId … A second
       `data` inside the module's IIFE would shadow the real workspace and
       quietly collect edits nothing ever saves. */
    topLevelVars(s).forEach(v => names.add(v));
  });
  return names;
}

/* ── Finding calls ─────────────────────────────────────────────
   Identifiers a chunk of code calls, ignoring property access (a.foo()).
   Comments are dropped; STRING CONTENTS ARE NOT — half this codebase's calls
   are written as text, and a walker that strips strings is blind to every one
   of them.

   Scanning strings over-collects (prose that reads "…judgment (the" yields
   "judgment"), but every candidate is checked against the reference with
   extract()/extractVarInit() and a word that names nothing there is dropped.
   Over-collecting costs nothing; under-collecting ships dead buttons.

   Lookbehind, not a captured leading character: capturing it CONSUMES it, so
   in `if(periodCompare(cur))` the scan would take `if(` and never see
   periodCompare — every nested call invisible, f(g(x)) yielding only f. */
const CALL_RE = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
function namesOf(text) {
  const out = new Set();
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(text))) out.add(m[1]);
  return out;
}
function callsIn(code) {
  const { skel, strs } = lex(code);
  return namesOf(skel + '\n' + strs.map(([a, b]) => code.slice(a, b)).join('\n'));
}
/** Just the calls in real code — the audit's first question. */
function callsInCode(code) { return namesOf(skeletonOf(code)); }

/* Every identifier written in real code, call or not. A dependency does not
   have to look like `foo(`: these builds pass functions as VALUES —
   `setTimeout(bdRenderAssess, 0)`, `.forEach(drawerToggle)`, `on('click',
   flipOpen)` — and a scan that only recognises a call misses every one of
   them. It missed twenty-three, and the failure is quiet in the worst way:
   renderAssess ported perfectly and painted an empty board, because the
   function it hands to setTimeout was never brought across.

   Read against the reference's OWN function names, so this cannot invent a
   dependency; anything else it collects is dropped for naming nothing. Real
   code only — prose in a string that happens to use the word is not a
   reference. */
const IDENT_RE = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)/g;
function identsInCode(code) {
  const out = new Set();
  const skel = skeletonOf(code);
  IDENT_RE.lastIndex = 0;
  let m;
  while ((m = IDENT_RE.exec(skel))) out.add(m[1]);
  return out;
}
/** Just the calls written inside strings — the audit's second. */
function callsInStrings(code) { return namesOf(stringsOf(code)); }

/** Whole-word reads of a name anywhere in a chunk, strings included — how a
    data blob is spotted. `PARTS[i].color` is a read, not a call. */
function reads(code, name) {
  return new RegExp('(?<![A-Za-z0-9_$.])' + name + '(?![A-Za-z0-9_$])').test(code);
}

const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return',
  'typeof', 'new', 'var', 'else', 'do', 'in', 'of', 'delete', 'void', 'case', 'throw']);

/* ── The closure ───────────────────────────────────────────────
   Pull what the config asks for, then keep pulling whatever that calls and
   reads until nothing is left dangling. Porting only what is asked for is how
   a first pass ships a function that calls one nobody brought across: the
   screen renders perfectly and the Save button throws the moment it is
   pressed, which is exactly the failure a generated port is supposed to make
   impossible. */
function closure(src, cfg, shell) {
  const REF_INITS = topLevelVarInits(src);
  const REF_VARS = [...REF_INITS.keys()];
  /* The reference's own function names, so a bare identifier can be checked
     against something real rather than guessed at — see identsInCode. */
  const REF_FUNCS = new Set((src.match(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm) || [])
    .map(m => m.split(/\s+/)[1]));
  const bodyOf = new Map();
  const varOf = new Map();          // name → initialiser text
  const missing = [];
  const shadowed = new Set();       // functions in BOTH the reference and the shell
  const shadowedVars = new Set();   // data blobs and state likewise
  const queue = cfg.PORT.slice();
  const requested = new Set(cfg.PORT);
  const forcedVars = new Set(cfg.PORT_VARS || []);
  const skipVars = new Set(cfg.SKIP_VARS || []);
  const assignFns = new Set(cfg.ASSIGN_FNS || []);
  const pulledIn = [];
  const grab = n => assignFns.has(n) ? extractAssignFn(src, n) : extract(src, n);

  forcedVars.forEach(v => {
    if (REF_INITS.has(v)) varOf.set(v, REF_INITS.get(v)); else missing.push(v);
  });

  function want(dep) {
    if (bodyOf.has(dep) || varOf.has(dep)) return;
    if (queue.includes(dep)) return;
    if (JS_KEYWORDS.has(dep) || cfg.SHELL_GLOBALS.has(dep)) return;
    if (shell.has(dep) && !requested.has(dep)) {
      /* The shell has this name and we are letting it win. Harmless when the
         two are the same function; a silent behaviour swap when they are not.
         Recorded so the report can name every one rather than leaving it to
         whoever notices the wrong screen. */
      if (grab(dep)) shadowed.add(dep);
      return;
    }
    if (grab(dep)) queue.push(dep);
  }

  function wantVarsIn(code) {
    REF_VARS.forEach(v => {
      if (varOf.has(v) || cfg.SHELL_GLOBALS.has(v) || skipVars.has(v)) return;
      if (!reads(code, v)) return;
      if (shell.has(v) && !forcedVars.has(v)) { shadowedVars.add(v); return; }
      varOf.set(v, REF_INITS.get(v));
    });
  }

  function drain() {
    while (queue.length) {
      const name = queue.shift();
      if (bodyOf.has(name)) continue;
      const code = grab(name);
      if (!code) { missing.push(name); continue; }
      bodyOf.set(name, code);
      if (!requested.has(name)) pulledIn.push(name);
      callsIn(code).forEach(want);
      identsInCode(code).forEach(n => { if (REF_FUNCS.has(n)) want(n); });
      wantVarsIn(code);
    }
  }

  drain();
  /* A blob can name functions of its own (a slide with an onclick), and one
     blob can read another. Settle both, then drain whatever that queued. */
  let seen = 0;
  while (varOf.size !== seen) {
    seen = varOf.size;
    [...varOf.values()].forEach(blob => {
      callsIn(blob).forEach(want);
      identsInCode(blob).forEach(n => { if (REF_FUNCS.has(n)) want(n); });
      wantVarsIn(blob);
    });
    drain();
  }

  return {
    bodyOf, varOf, missing, shadowed, shadowedVars, pulledIn,
    found: [...bodyOf.keys()], vars: [...varOf.keys()]
  };
}

/* ── Grafts ────────────────────────────────────────────────────
   Behaviour the reference build never had, inserted by rule rather than by
   hand — the generated file is regenerated and a hand-edit would be lost.
   Anchored on an exact line: if the reference changes it the patch stops
   matching and this throws, loudly, before anything is written. */
function applyPatches(bodyOf, patches) {
  (patches || []).forEach(p => {
    const code = bodyOf.get(p.in);
    if (code === undefined) throw new Error('patch "' + p.name + '": ' + p.in + ' is not being ported');
    const anchor = p.after !== undefined ? p.after : p.replace;
    const at = code.indexOf(anchor);
    if (at < 0) {
      throw new Error('patch "' + p.name + '": anchor not found in ' + p.in
        + '. The reference build changed; re-read it and update the patch.');
    }
    if (code.indexOf(anchor, at + 1) >= 0) {
      throw new Error('patch "' + p.name + '": anchor is ambiguous in ' + p.in + ' (matches more than once).');
    }
    // `after` inserts; `replace` substitutes. Both anchored on one exact,
    // unambiguous slice of the reference, so a change there fails loudly here.
    bodyOf.set(p.in, p.after !== undefined
      ? code.slice(0, at + anchor.length) + p.insert + code.slice(at + anchor.length)
      : code.slice(0, at) + p.with + code.slice(at + anchor.length));
  });
}

/* Names a browser supplies, so the audit does not report them as unresolved. */
const BROWSER = new Set(['Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
  'RegExp', 'Error', 'Promise', 'Set', 'Map', 'WeakMap', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'document', 'window', 'console', 'navigator', 'location', 'Blob', 'URL', 'FileReader', 'Image',
  'getComputedStyle', 'matchMedia', 'prompt', 'escape', 'unescape', 'Intl', 'Function', 'Symbol',
  'fetch', 'atob', 'btoa', 'structuredClone', 'AbortController', 'CustomEvent', 'Event',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Float32Array', 'ArrayBuffer',
  'getSelection', 'DOMParser', 'TextEncoder', 'TextDecoder',
  'alert', 'confirm', 'print', 'open', 'scrollTo',
  'SpeechSynthesisUtterance', 'webkitSpeechRecognition', 'SpeechRecognition']);

module.exports = {
  lex, skeletonOf, stringsOf,
  extract, extractAssignFn, topLevelVars, topLevelVarInits,
  rewriteHandlers, rewriteMedia,
  shellProvides, callsIn, callsInCode, callsInStrings, identsInCode, reads,
  closure, applyPatches,
  JS_KEYWORDS, BROWSER, SHELL_FILES
};
