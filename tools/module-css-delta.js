#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   module-css-delta.js — a module stylesheet is the DIFFERENCE
   ─────────────────────────────────────────────────────────────
   Each program was built as a standalone copy of the app, and each
   carries a full copy of the stylesheet to match — 290 KB of it, of
   which the overwhelming majority is the shared design system that
   assets/css/styles.css already serves to every module.

   A module's stylesheet loads AFTER the shared one, so anything it
   repeats it also overrides. Shipping the whole fork would hand one
   program's copy of `nav`, `.btn-gold` and `.card` to the shell — and
   those forks differ, usually by a rounding (`rgba(30, 37, 48, .08)`
   against `rgba(var(--fg-rgb),.10)`), occasionally by more. So what
   gets written is only what the shared sheet does not already have:

     · a rule whose selector appears nowhere in the shared sheet →
       kept whole. This is the program's own furniture — the board,
       the rail, the focus card, the filing cabinet.
     · a rule whose selector the shared sheet also has → DROPPED. The
       shared one wins, which is the point.
     · the custom-property carriers (:root and the dark-theme roots)
       are the one exception, and only additively: a token the shared
       sheet has no value for is kept, a token it does have is left
       alone. That is how --card-solid and --shell-shadow arrive
       without --text-muted being redefined underneath the shell.

   Usage:
     node tools/module-css-delta.js <shared.css> <module.css> <out.css> [--title "Name"]
     node tools/module-css-delta.js --report <shared.css> <module.css>
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

/* ── Parsing ───────────────────────────────────────────────────
   A block splitter, not a full CSS parser: it needs to know where each rule
   starts and ends and what its prelude is, and it is right about that.
   Comments and strings are skipped so a `{`, `}` or `;` inside `content: "}"`
   or a data: URL cannot desynchronise the scan. */
function parse(src) {
  const nodes = [];
  let i = 0;

  function skipWs() {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '/' && src[i + 1] === '*') {
        const e = src.indexOf('*/', i);
        i = e < 0 ? src.length : e + 2;
        continue;
      }
      return;
    }
  }
  /* Advance past one character's worth of source, treating a comment or a
     quoted string as a single unit. Returns the text consumed. */
  function step() {
    if (src[i] === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i);
      const t = src.slice(i, e < 0 ? src.length : e + 2);
      i += t.length; return t;
    }
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i]; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      const t = src.slice(i, Math.min(j + 1, src.length));
      i += t.length; return t;
    }
    return src[i++];
  }

  function block() {
    // consumes from '{' to its matching '}', returns the inner text
    let depth = 0, out = '';
    for (;;) {
      if (i >= src.length) return out;
      if (src[i] === '{') { depth++; i++; if (depth === 1) continue; out += '{'; continue; }
      if (src[i] === '}') { depth--; i++; if (depth === 0) return out; out += '}'; continue; }
      out += step();
    }
  }

  while (i < src.length) {
    skipWs();
    if (i >= src.length) break;
    let prelude = '';
    while (i < src.length && src[i] !== '{' && src[i] !== ';') prelude += step();
    if (src[i] === ';') { i++; continue; }          // @import / @charset — dropped
    if (i >= src.length) break;
    const body = block();
    prelude = prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    if (!prelude) continue;
    if (/^@(media|supports|layer|container|document)/i.test(prelude)) {
      nodes.push({ type: 'at', prelude, children: parse(body) });
    } else {
      nodes.push({ type: 'rule', prelude, body });
    }
  }
  return nodes;
}

/* Declarations of a rule body, as a property → value map. Nested blocks (a
   @keyframes' 0%/100% steps) are not declarations and are ignored here; those
   rules are compared whole instead. */
function declMap(body) {
  const out = new Map();
  let depth = 0, cur = '', i = 0;
  const push = t => {
    const d = t.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const c = d.indexOf(':');
    if (c > 0) out.set(d.slice(0, c).trim(), d.slice(c + 1).trim().replace(/\s+/g, ' '));
  };
  while (i < body.length) {
    const ch = body[i];
    if (ch === '/' && body[i + 1] === '*') { const e = body.indexOf('*/', i); i = e < 0 ? body.length : e + 2; continue; }
    if (ch === '"' || ch === "'") {
      const q = ch; let j = i + 1;
      while (j < body.length && body[j] !== q) { if (body[j] === '\\') j++; j++; }
      cur += body.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ';' && depth === 0) { push(cur); cur = ''; i++; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) push(cur);
  return out;
}

const norm = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '').replace(/;$/, '');
/** One selector list → its parts, so `.a,.b{}` and `.b{}` are comparable. */
/* Split on the TOP-LEVEL commas only (21 Oct 2026). A plain split(',') cut
   `svg [fill="rgba(138,130,120,.08)"]` inside its quoted value, and the emitted
   `svg [fill="rgba(138,130,120 {` opened a string that never closed: the browser
   dropped every rule after it — 207 of AI-Ready Architecture's 209. Commas inside
   quotes, [] and () belong to the selector. */
const parts = sel => {
  const out = []; let cur = '', depth = 0, q = '';
  for (const ch of sel) {
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

/* Selectors that carry design tokens. Additive merging is applied to these and
   nowhere else: everywhere else, "the shared sheet already has this selector"
   means the shared sheet wins outright. */
const TOKEN_CARRIERS = new Set([':root', 'html', '[data-theme="dark"]', ':root[data-theme="dark"]']);

/** Index a stylesheet: "at-prelude ▸ selector-part" → declaration map. */
function index(nodes, at, into) {
  into = into || new Map();
  for (const n of nodes) {
    if (n.type === 'at') { index(n.children, (at ? at + ' ▸ ' : '') + n.prelude, into); continue; }
    const decls = declMap(n.body);
    for (const p of parts(n.prelude)) {
      const key = (at ? at + ' ▸ ' : '') + p;
      if (!into.has(key)) into.set(key, decls);
      else for (const [k, v] of decls) into.get(key).set(k, v);   // later wins
    }
  }
  return into;
}

/* ── The difference ────────────────────────────────────────────── */
function diff(modNodes, shellIdx, at, stats) {
  const out = [];
  for (const n of modNodes) {
    if (n.type === 'at') {
      const kids = diff(n.children, shellIdx, (at ? at + ' ▸ ' : '') + n.prelude, stats);
      if (kids.length) out.push({ type: 'at', prelude: n.prelude, children: kids });
      continue;
    }
    const sels = parts(n.prelude);
    const keyed = sels.map(p => (at ? at + ' ▸ ' : '') + p);
    const known = keyed.filter(k => shellIdx.has(k));

    if (!known.length) { stats.kept++; out.push(n); continue; }   // wholly new

    if (sels.every(s => TOKEN_CARRIERS.has(s))) {
      // Additive: only the properties the shared sheet has no value for.
      const have = new Map();
      keyed.forEach(k => { const m = shellIdx.get(k); if (m) for (const p of m.keys()) have.set(p, 1); });
      const add = [...declMap(n.body)].filter(([p]) => !have.has(p));
      if (add.length) {
        stats.tokens += add.length;
        out.push({ type: 'rule', prelude: n.prelude, body: add.map(([p, v]) => '\n  ' + p + ': ' + v + ';').join('') + '\n' });
      } else stats.dropped++;
      continue;
    }

    if (known.length === sels.length) { stats.dropped++; continue; }
    /* A selector list that is partly new — keep only the new parts, so the
       shared sheet's version of the rest is not quietly re-declared. */
    const fresh = sels.filter((s, k) => !shellIdx.has(keyed[k]));
    stats.kept++;
    out.push({ type: 'rule', prelude: fresh.join(','), body: n.body });
  }
  return out;
}

function write(nodes, ind) {
  ind = ind || '';
  return nodes.map(n => n.type === 'at'
    ? ind + n.prelude + ' {\n' + write(n.children, ind + '  ') + ind + '}\n'
    : ind + n.prelude + ' {' + n.body.replace(/\s+$/, '') + (n.body.trim() ? '\n' + ind : '') + '}\n'
  ).join('');
}

/* ── Run ───────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const report = argv[0] === '--report';
const args = report ? argv.slice(1) : argv;
const titleAt = args.indexOf('--title');
const title = titleAt >= 0 ? args[titleAt + 1] : '';
const files = args.filter((a, k) => !a.startsWith('--') && args[k - 1] !== '--title');

if (files.length < (report ? 2 : 3)) {
  console.error('usage: node tools/module-css-delta.js [--report] <shared.css> <module.css> [<out.css>] [--title Name]');
  process.exit(2);
}
const shellSrc = fs.readFileSync(files[0], 'utf8');
const modSrc = fs.readFileSync(files[1], 'utf8');
const shellIdx = index(parse(shellSrc));
const modNodes = parse(modSrc);
const stats = { kept: 0, dropped: 0, tokens: 0 };
const delta = diff(modNodes, shellIdx, '', stats);

console.log('shared rules :', shellIdx.size);
console.log('kept         :', stats.kept, 'rules the shared sheet does not have');
console.log('dropped      :', stats.dropped, 'rules it already has');
console.log('tokens added :', stats.tokens, 'custom properties');

if (report) process.exit(0);

const header = `/* ============================================================
   ${title || path.basename(files[2], '.css')} — module stylesheet
   ============================================================
   GENERATED by tools/module-css-delta.js from
   ${files[1].replace(/\\\\/g, '/')}
   against ${files[0].replace(/\\\\/g, '/')}.
   Re-run that script rather than editing this file by hand.

   Loaded after assets/css/styles.css, and only when this module is
   the active one (config/catalogue.json → styles).

   This is the DIFFERENCE, not the fork. The two stylesheets were
   built from the same design system and agree on almost everything;
   what is here is what this program's screens use and the shared
   sheet has no rule for — the board, the rail, the focus card, the
   filing cabinet, the assessment dials — plus the handful of design
   tokens it introduces.

   Nothing here overrides a shared rule; it only adds. Anything that
   belongs to every module belongs in styles.css instead.

   Accent colours are TOKENISED on the way out (see tokeniseAccent in
   the generator): every fork hard-codes the Pipeline's orange, and a
   module stylesheet that keeps those literals paints one program's
   accent into another's screens whatever assets/css/themes.css says.
   ============================================================ */

`;

/* ── Accent tokenisation ───────────────────────────────────────
   Each program was forked from the Pipeline, so each fork's stylesheet
   is full of literal accent colours — the washes, borders and hovers it
   inherited, written as rgba(232, 98, 26, …) and #B34208 because that is
   what the file was copied from. The Ethics Engine then re-pointed its
   own accent to green and left a further scatter of #2E7D46 behind.

   themes.css gives every program its accent by re-pointing --gold and
   friends, which reaches a var() and cannot reach a literal. A module
   sheet that keeps the literals paints one program's accent into
   another's screens whatever the theme layer says.

   So the literals are rewritten HERE, as the module sheet is generated,
   rather than patched afterwards in a file whose own header says not to
   edit it: re-run the port and the fix comes back on its own.

   WHICH hexes are accent hexes is read from the FORK, not hard-coded —
   its :root and dark root name them (--gold, --mod and their -light /
   -text variants), so this stays true for a program whose accent nobody
   here has seen yet.

   Two things are deliberately left alone:
     · comments — prose about a colour is prose.
     · selectors — `svg [fill="#B34208"]` MATCHES a presentation attribute
       in the SVG source. Rewrite it and the rule stops matching anything.
       Only declaration bodies are transformed. */
function accentMap(forkCss) {
  const root = forkCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const read = (name) => {
    const m = root.match(new RegExp('--' + name + '\\s*:\\s*(#[0-9A-Fa-f]{3,8})'));
    return m ? m[1].toUpperCase() : null;
  };
  /* Order matters only in that every hex maps to exactly one token; the
     -light / -text variants are listed first so a fork that gives two
     names the same value tokenises to the more specific one. */
  const pairs = [
    ['gold-light', '--gold-light'], ['gold-text', '--gold-text'], ['gold', '--gold'],
    ['mod-light', '--mod-light'], ['mod-text', '--mod-text'], ['mod', '--mod'],
  ];
  const map = new Map();
  for (const [name, token] of pairs) {
    const hex = read(name);
    if (hex && !map.has(hex)) map.set(hex, token);
  }
  return map;
}

function tokeniseAccent(css, map) {
  let n = 0;

  const swapBody = (body) => body
    .replace(/rgba\(\s*232\s*,\s*98\s*,\s*26\s*,\s*([^)]+)\)/gi,
      (m, alpha) => { n++; return 'rgba(var(--gold-rgb), ' + alpha.trim() + ')'; })
    .replace(/#[0-9A-Fa-f]{6}\b/g, (hex) => {
      const token = map.get(hex.toUpperCase());
      if (!token) return hex;
      n++;
      return 'var(' + token + ')';
    });

  // Bodies only: everything between { and } that contains no nested brace.
  const swap = (s) => s.replace(/\{([^{}]*)\}/g, (m, body) => '{' + swapBody(body) + '}');

  let out = '', i = 0;
  for (;;) {
    const start = css.indexOf('/*', i);
    if (start < 0) { out += swap(css.slice(i)); break; }
    out += swap(css.slice(i, start));
    const end = css.indexOf('*/', start + 2);
    if (end < 0) { out += css.slice(start); break; }
    out += css.slice(start, end + 2);
    i = end + 2;
  }
  return { css: out, count: n };
}

const tokenised = tokeniseAccent(write(delta), accentMap(fs.readFileSync(files[1], 'utf8')));
fs.writeFileSync(files[2], header + tokenised.css, 'utf8');
console.log('wrote', files[2], '(' + fs.statSync(files[2]).size + ' bytes)');
console.log('  accent literals tokenised:', tokenised.count);
