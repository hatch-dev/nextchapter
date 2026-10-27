#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   theme-contrast.js — does every app's palette actually read?
   ─────────────────────────────────────────────────────────────
   Twelve programs, each with a light and a dark scheme, is 24 colour
   schemes nobody can hold in their head. This checks them instead of
   trusting them, straight out of assets/css/themes.css so the file it
   grades is the file that ships.

   What it measures, and why those pairs:

     accent-strong on the light ground   body/link text in light mode
     accent-soft   on the dark ground    the same in dark mode
     --on-accent   on the accent fill    the label inside .btn-gold,
                                         which is the one place the
                                         brand hue carries text itself

   WCAG 2.1 AA is 4.5:1 for body text and 3:1 for large text (≥18.66px
   bold or ≥24px). Button labels here are 13–15px semibold, i.e. NOT
   large text, so they are held to 4.5:1 — which is what decides whether
   a given accent takes white or ink as its label colour.

   Run:  node tools/theme-contrast.js          # grade every app
         node tools/theme-contrast.js --strict # exit 1 on any failure
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'assets', 'css', 'themes.css');

/* ── Colour maths (sRGB → relative luminance → contrast ratio) ── */
function hex(c) {
  const m = String(c).trim().replace(/^#/, '');
  const s = m.length === 3 ? m.split('').map(x => x + x).join('') : m;
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}
function luminance(rgb) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(hex(a)), luminance(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/* ── Read the palettes out of the stylesheet ────────────────────
   A targeted scan, not a CSS parser: every palette in that file is a
   flat block of `--token: value;` lines under a selector naming the app,
   which is a shape worth depending on because the file is written to be
   read by a person too. */
function palettes(src) {
  // Comments first: the file documents itself with `[data-app="<id>"]` in
  // prose, and a scan that cannot tell prose from a selector grades a
  // program called "<id>".
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');

  const out = new Map();
  const add = (app, mode, token, value) => {
    if (!out.has(app)) out.set(app, { light: {}, dark: {} });
    out.get(app)[mode][token] = value.trim();
  };

  const blocks = src.match(/[^{}]+\{[^{}]*\}/g) || [];
  for (const block of blocks) {
    const [prelude, body] = [block.slice(0, block.indexOf('{')), block.slice(block.indexOf('{') + 1, -1)];
    /* --ink as well as --accent: a program may move its own ground (see
       groundFor), and the block that does it need not restate an accent. */
    if (!/--accent|--ink/.test(body)) continue;

    const dark = /\[data-theme="dark"\]/.test(prelude);
    const named = [...prelude.matchAll(/\[data-app="([^"]+)"\]/g)].map(m => m[1]);
    // A block with no [data-app] is the suite default every app inherits.
    const apps = named.length ? named : ['(suite default)'];

    for (const [, token, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      for (const app of apps) add(app, dark ? 'dark' : 'light', token, value);
    }
  }
  return out;
}

/* The suite's grounds, from the shared stylesheet's own --ink — what eleven
   of the twelve programs are painted on.

   A palette MAY restate --ink for itself (Executive Readiness does, because
   its reference build shifts the page toward violet-grey under a plum
   accent). Grading that program against the suite's ground would be grading
   a pairing that never appears on screen — flattering or damning by luck —
   so groundFor() below prefers a palette's own. */
const GROUND = { light: '#EAEEF4', dark: '#242E3C' };

/** The ground a program's text is actually read against, per mode. A dark
    block that states no --ink inherits the program's light one, which is
    what the cascade does too. */
function groundFor(L, D) {
  return {
    light: L['--ink'] || GROUND.light,
    dark: D['--ink'] || L['--ink'] || GROUND.dark,
  };
}

function grade(v, floor) {
  return { v, pass: v >= floor, mark: v >= floor ? '✓' : '✗' };
}

function main() {
  const strict = process.argv.includes('--strict');
  if (!fs.existsSync(FILE)) {
    console.error('themes.css not found at ' + FILE);
    process.exit(1);
  }
  const found = palettes(fs.readFileSync(FILE, 'utf8'));

  /* The suite default carries every token; a per-app block only states what
     it changes, so fold the default underneath each one before grading. */
  const base = found.get('(suite default)') || { light: {}, dark: {} };
  const rows = [];
  let fails = 0;

  console.log('');
  console.log('  Theme contrast — WCAG 2.1 AA (4.5:1 body, 3:1 UI edges)');
  console.log('  light ground ' + GROUND.light + '   ·   dark ground ' + GROUND.dark);
  console.log('  ' + '─'.repeat(84));
  console.log('  ' + 'app'.padEnd(22) + 'text/light  text/dark   label-on-fill      fill');
  console.log('  ' + '─'.repeat(84));

  for (const [app, p] of found) {
    const L = { ...base.light, ...p.light };
    const D = { ...base.dark, ...p.dark };

    const strong = L['--accent-strong'];
    const soft = D['--accent-soft'] || L['--accent-soft'];
    const fill = L['--accent'];
    const onFill = L['--on-accent'] || '#FFFFFF';
    if (!strong || !soft || !fill) continue;

    /* This program's own grounds when it states them, the suite's otherwise —
       so a palette that moves the page is graded where it is actually read. */
    const g = groundFor(L, D);
    const own = g.light !== GROUND.light || g.dark !== GROUND.dark;

    const a = grade(ratio(strong, g.light), 4.5);
    const b = grade(ratio(soft, g.dark), 4.5);
    const c = grade(ratio(onFill, fill), 4.5);
    if (!a.pass || !b.pass || !c.pass) fails++;

    rows.push([app, a, b, c]);
    console.log(
      '  ' + app.padEnd(22) +
      (a.mark + ' ' + a.v.toFixed(2)).padEnd(12) +
      (b.mark + ' ' + b.v.toFixed(2)).padEnd(12) +
      (c.mark + ' ' + c.v.toFixed(2) + ' ' + onFill).padEnd(19) +
      fill + (own ? '   on ' + g.light + ' / ' + g.dark : '')
    );
  }

  console.log('  ' + '─'.repeat(84));
  console.log('  ' + rows.length + ' schemes graded · ' + (fails ? fails + ' FAILING' : 'all pass'));

  /* ── Coverage ────────────────────────────────────────────────
     A program with no palette does not break — it silently inherits the
     suite's orange, which looks deliberate and is not. The catalogue is
     the list of programs that exist, so it is the list this file has to
     answer; checking it here means adding a program to catalogue.json
     and forgetting its colours fails loudly instead of shipping the
     wrong accent. */
  /* ── Paper ───────────────────────────────────────────────────
     styles.css re-declares the light values for print at
     `:root, :root[data-theme="dark"]` — (0,2,0) — and states the accent
     LITERALLY, from when there was one. That outranks the (0,1,0)
     aliases in themes.css, so without a print block of its own at the
     same specificity, every program prints the PIPELINE'S ORANGE
     however it looks on screen. It is invisible until someone prints,
     which is why it is checked here rather than trusted.

     Two conditions, both required:
       · a print block re-asserting the accent aliases, and
       · every dark override scoped to @media screen, so paper never
         picks up the dark tint instead. */
  const raw = fs.readFileSync(FILE, 'utf8');
  const paperBlock = /@media\s+print\s*\{[\s\S]*?--gold-text:\s*var\(--accent-strong\)/.test(raw);

  /* Blank out every @media block's interior, so what is left is only the
     rules at top level. A brace counter rather than a regex, because
     these blocks nest one level and a lazy match stops at the first `}`. */
  const bare = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  let outside = '', i = 0;
  for (;;) {
    const at = bare.indexOf('@media', i);
    if (at < 0) { outside += bare.slice(i); break; }
    outside += bare.slice(i, at);
    let j = bare.indexOf('{', at), depth = 0;
    if (j < 0) break;
    for (; j < bare.length; j++) {
      if (bare[j] === '{') depth++;
      else if (bare[j] === '}' && --depth === 0) { j++; break; }
    }
    i = j;
  }
  // A dark override at top level is one print will inherit — the bug this checks for.
  const stray = (outside.match(/\[data-theme="dark"\]/g) || []).length;
  const darkScoped = stray === 0;

  console.log('  paper  ' + (paperBlock ? '✓' : '✗') +
    ' print re-asserts the program accent   ' + (darkScoped ? '✓' : '✗') +
    ' dark overrides scoped to @media' + (stray ? ' (' + stray + ' at top level)' : ''));

  const catalogue = path.join(__dirname, '..', 'config', 'catalogue.json');
  let missing = [];
  if (fs.existsSync(catalogue)) {
    const data = JSON.parse(fs.readFileSync(catalogue, 'utf8'));
    const ids = (data.roles || []).flatMap(r => (r.modules || []).map(m => m.id));
    missing = ids.filter(id => !found.has(id));
    console.log('  ' + (ids.length - missing.length) + '/' + ids.length + ' catalogue programs have a palette' +
      (missing.length ? ' · MISSING: ' + missing.join(', ') : ''));
  }
  console.log('');

  if (strict && (fails || missing.length || !paperBlock || !darkScoped)) process.exit(1);
}

main();
