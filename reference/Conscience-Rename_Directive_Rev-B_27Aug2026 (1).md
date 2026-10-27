# Rename Directive — The Ethics Engine to Conscience

## 1. Rulings in force

These are the product decisions this directive implements. Everything in §4 follows from them.

1. **The lockup is `Conscience — Ethical Reasoning`.** The separator is a spaced em dash (U+2014). "Ethical Reasoning" carries the italics and the accent color; "Conscience" and the dash sit outside the styled element, exactly as "The " sat outside it before.
2. **The name is bare `Conscience`, never `The Conscience`.**
3. **Full lockup** on the nav logo, the home hero headline, the entry-screen title, the expanded practice-rail logo, and the about-modal H3.
4. **Short form `Conscience`** on constrained surfaces: the browser tab title, the board sidebar caption, the five SVG identity bands, and the two screen-module file headers.
5. **The minimized rail monogram becomes `CER`** (Conscience / Ethical Reasoning), replacing `EE`. Constructed as the Judgment module's `JCT` was.
6. **Video filenames do not change.** All seven `.mp4` strings stay byte-identical, including the missing space in `-PART II`. See §3 — this is now the primary hazard in the job.
7. **Sentence-level references become "this app."** Two sites. A third drops the product name altogether.
8. **Storage keys are unchanged.** All sixteen `ee-` keys stay. No migration, no edit.
9. **The `ee-` filename prefix is unchanged.** All eleven filenames, the six `<script>`/`<link>` paths, and `window.__SCREEN_FILE_PREFIX="ee-"` stay as they are.
10. **File-header comments:** the two plain screen-module identification headers update; the screen-loader header stays intact because it records the file's provenance.
11. **Accent colors are not touched.** Words only. Existing formatting stands wherever it stands, including the fact that the nav logo's accent and the rail logo's accent resolve to different tokens.

---

## 2. File set identity

Confirm your working copies match before you start. If they do not, stop and re-sync — the line numbers and occurrence counts below will not hold against different bytes.

| File | Lines | Bytes | md5 |
|---|---:|---:|---|
| ee-app.js | 4,195 | 388,023 | `d91b3ceceaa396d01d0967bca647e987` |
| ee-styles.css | 839 | 292,450 | `3721bf0416f958d97be1608fa534ee42` |
| ee-suite.js | 788 | 86,111 | `e2bab67bb38d0b29bc606e2bd23fdeed` |
| ee-screen-loader.js | 135 | 7,245 | `615181dfa47468120a94c5ebf468dd7b` |
| ee-index.html | 50 | 2,805 | `679b9f4f423659457f447bff7a0ab873` |
| ee-home.js | 25 | 1,247 | `005c8fe128b0736ceb58b03589713947` |
| ee-learn.js | 24 | 1,185 | `74cba2fca1f3b4b883b2ddd81e77e7dd` |
| ee-build-templates.js | 14 | 1,051 | `0eda0271135f57e52d46ab1c8e91cb7f` |
| ee-templates-local.js | 4 | 14,235 | `f9229e6373cbdfb32e39b5c3f1fe7101` |
| ee-home.html | 1 | 6,012 | `7f83033db8d9bf7cc542c01ac03dea4c` |
| ee-learn.html | 1 | 7,482 | `dbf7b7fe4f217c9a4f72b261c7aa8077` |

The old title occurs **34 times** across eight files, in exactly two casings — `Ethics Engine` (28) and `ETHICS ENGINE` (6). There are no hyphenated, camelCase, or underscore variants. Of those 34, **19 change** and **15 stay**: 13 inside video filenames, one in the ruled-intact screen-loader header, and one that disappears when the template bundle is regenerated rather than by direct edit.

---

## 3. The hazard — read before opening an editor

**A blanket find-and-replace on "Ethics Engine" will break video playback across the module.** Because ruling 6 freezes the filenames, 13 of the 34 occurrences must survive untouched: six in `ee-app.js`, one in `ee-home.html`, one in its generated mirror, and five in suite assertions that pin those filenames. A global substitution would kill the module overview video on home, the practice intro, all three board part videos, the Assess video, and the Dashboard video, and would simultaneously turn five green suite pins red for the wrong reason.

Every edit below is therefore given as a **literal FIND block and a literal REPLACE block with an expected occurrence count.** Assert the count before writing. Abort on any mismatch rather than writing.

Two further mechanical traps:

- **Em dash storage form differs by file.** `ee-index.html`, `ee-home.html`, `ee-home.js`, and `ee-learn.js` store the literal character `—`. `ee-app.js` stores it as the escape sequence `\u2014` (152 times, against 19 literals), and every new string in `ee-app.js` below uses the escape form to match its neighbourhood. `ee-suite.js` matches app.js source text through a JS string literal, so its anchor needs `\\u2014` — two backslashes — to evaluate to the one-backslash form stored in app.js. The blocks below are written in the exact stored form; copy them as they appear.
- **The middot in the SVG bands is also stored escaped** as `\u00B7`, not as the character. Same rule: copy as written.

---

## 4. The edits — 19 blocks across six files

### 4.1 `ee-index.html` — 2 edits

**Edit 1 of 19 — browser tab title (line 6). Short form.**

FIND (expect exactly 1):
```
<title>The Ethics Engine — Leadership Edge Module 4</title>
```
REPLACE:
```
<title>Conscience — Leadership Edge Module 4</title>
```

**Edit 2 of 19 — global nav logo (line 16). Full lockup.**

FIND (expect exactly 1):
```
<div class="nav-logo" onclick="go('home')">The <span>Ethics Engine</span></div>
```
REPLACE:
```
<div class="nav-logo" onclick="go('home')">Conscience — <span>Ethical Reasoning</span></div>
```

The `<span>` must survive — `.nav-logo span` (ee-styles.css line 19) is what italicizes and colors the second half. `.nav-logo` is `font-size:24px; letter-spacing:.12em; text-transform:uppercase; white-space:nowrap`, so this renders as `CONSCIENCE — ETHICAL REASONING`: 30 uppercase characters where the old title was 17, forbidden to wrap, sitting left of the nav tabs on every screen. **If it collides with the tabs at any width, report back rather than improvising a fix.** Do not change the font size, the tracking, or the wrap rule on your own initiative.

### 4.2 `ee-home.html` — 1 edit

**Edit 3 of 19 — home hero headline (line 1; single-line file). Full lockup.**

FIND (expect exactly 1):
```
<h1 class="hero-headline">The <em>Ethics Engine</em></h1>
```
REPLACE:
```
<h1 class="hero-headline">Conscience — <em>Ethical Reasoning</em></h1>
```

The `<em>` must survive — `.hero-headline em` (ee-styles.css line 60) carries the italics and accent.

**This file is a screen template. Editing it obliges the regeneration in §5.** The `.mp4` reference elsewhere on this line does not change.

### 4.3 `ee-app.js` — 13 edits

**Edit 4 of 19 — entry / sign-in screen title (line 102). Full lockup.**

FIND (expect exactly 1):
```
<div class="section-title" style="margin-bottom:10px">The <em>Ethics Engine</em></div>
```
REPLACE:
```
<div class="section-title" style="margin-bottom:10px">Conscience \u2014 <em>Ethical Reasoning</em></div>
```

**Edit 5 of 19 — SVG identity bands, five sites (lines 684, 1699, 1869, 2143, 3968). Short form.**

FIND (expect exactly 5 — all five are byte-identical, so a scoped replace-all is correct here):
```
THE ETHICS ENGINE \u00B7 LEADERSHIP EDGE \u00B7 MODULE IV
```
REPLACE:
```
CONSCIENCE \u00B7 LEADERSHIP EDGE \u00B7 MODULE IV
```

These sit in centered `<text>` elements at font-size 9.5 / letter-spacing 2 (lines 684, 1699, 3968) and font-size 8 / letter-spacing 1.1 (lines 1869, 2143), inside header cards 404, 340/420, and 380 units wide. The new string is seven characters shorter than the old one, so no overflow is introduced. The change in visual weight is for Paul's eye, not for adjustment here.

**Edit 6 of 19 — board sidebar drawer caption (line 2183). Short form.**

FIND (expect exactly 1 — anchor on the full wrapper; the bare string `THE ETHICS ENGINE` occurs 6 times in this file and five of them are Edit 5's bands):
```
<div class="dutil-cap">THE ETHICS ENGINE</div>
```
REPLACE:
```
<div class="dutil-cap">CONSCIENCE</div>
```

The paired caption below it in the same drawer group is unchanged.

**Edit 7 of 19 — minimized practice-rail logo and tooltip (line 2277). Monogram plus full lockup.**

FIND (expect exactly 1):
```
<div class="prail-logo-mini" title="The Ethics Engine">EE</div>
```
REPLACE:
```
<div class="prail-logo-mini" title="Conscience \u2014 Ethical Reasoning">CER</div>
```

`.prail-logo-mini` is 14px serif, `letter-spacing:.12em`, `text-align:center`. `CER` is three characters where `EE` was two, so the column sits slightly heavier. That is expected, not a defect. **The tooltip taking the full lockup is a derivation, not a direct ruling — see §8.**

**Edit 8 of 19 — expanded practice-rail logo (line 2277). Full lockup.**

FIND (expect exactly 1):
```
<div class="prail-logo">The <span>Ethics Engine</span></div>
```
REPLACE:
```
<div class="prail-logo">Conscience \u2014 <span>Ethical Reasoning</span></div>
```

The `<span>` must survive — `.prail-logo span` (ee-styles.css line 539) carries this surface's accent, which resolves to a different token from the nav logo's. That difference is pre-existing and is explicitly not being corrected here (ruling 11). `.prail-logo` is 14px serif in a 260px rail. **If the lockup clips or wraps in the rail, report back rather than adjusting the type.**

**Edit 9 of 19 — nudge body copy (line 2476). "this app."**

FIND (expect exactly 1):
```
the core skill that the Ethics Engine trains
```
REPLACE:
```
the core skill that this app trains
```

Full resulting sentence, for your check that it reads right: "Arguing against your own instinct is the core skill that this app trains, and it is the skill that an AI tuned to agree with you erodes."

**Edit 10 of 19 — AI assessment prompt (line 3077, inside `buildAssessPrompt()`). Name dropped.**

FIND (expect exactly 1):
```
You are the assessment engine inside the Ethics Engine, a reflective practice tool.
```
REPLACE:
```
You are the assessment engine inside a reflective practice tool for ethical decision-making.
```

The product name is deliberately absent rather than substituted. This matches the sibling prompt at line 3037, which already reads "You are The Examiner: a Socratic coach inside a reflection tool for ethical decisions" without naming the product. The two prompts are now consistent with each other.

**Edit 11 of 19 — about-modal heading (line 3490). Full lockup.**

FIND (expect exactly 1):
```
<h3>The Ethics Engine</h3>
```
REPLACE:
```
<h3>Conscience \u2014 Ethical Reasoning</h3>
```

Verified plain — no inner markup — so it renders unaccented exactly as it does today. The subtitle line immediately below it (`Leadership Edge \u00B7 Module 4 \u2014 Test Your Instinct Before You Trust It`) contains no instance of the title and **does not change.**

**Edit 12 of 19 — about-modal body copy (line 3490). "This app."**

FIND (expect exactly 1):
```
The Ethics Engine walks you through one real situation
```
REPLACE:
```
This app walks you through one real situation
```

Sentence-initial, so the capital is correct as written.

**Edits 13 to 18 of 19 — the six `.mp4` references in this file. NO EDIT.**

Listed explicitly so they are not missed by omission and not caught by accident. Every one of these must be byte-identical after your work:

| Line | String that must survive untouched |
|---:|---|
| 1625 | `"p1": "The Ethics Engine - PART I THE SITUATION.mp4"` |
| 1625 | `"p2": "The Ethics Engine -PART II THE FOUR LENSES.mp4"` |
| 1625 | `"p3": "The Ethics Engine - PART III THE CALL.mp4"` |
| 2215 | `src="Ethics Engine - PRACTICE INTRO TO THE FLOW.mp4"` |
| 3361 | `src="Ethics Engine - ASSESS.mp4"` |
| 3442 | `src="The Ethics Engine - DASHBOARD.mp4"` |

The missing space in `-PART II` and the inconsistent article across these six names are **known and deliberately preserved** under ruling 6. They are not defects to fix in this pass.

### 4.4 `ee-suite.js` — 1 edit

**Edit 19 of 19 — the entry-brand pin (line 503). Retarget with dated supersession.**

FIND (expect exactly 1):
```
T('entry heading carries module brand', src.includes('The <em>Ethics Engine</em>') && !src.includes('The <em>Decision</em> Lab'));
```
REPLACE:
```
T('entry heading carries module brand', src.includes('Conscience \\u2014 <em>Ethical Reasoning</em>') && !src.includes('Conscience \\u2014 <em>Ethical</em> Reasoning') && !src.includes('The <em>Decision</em> Lab')); /* retargeted 27 Aug 2026 (module rename); supersedes the pre-rename brand pin */
```

Three things about this block. The double backslashes are correct as written — `src` is the inlined bundle read as raw text, so the assertion must match app.js's stored `\u2014` escape, which requires `\\u2014` inside the suite's own string literal. The original negative assertion guarding against the Decision Lab string is **retained, not replaced** — it still guards the port. And a second negative is added mirroring the Judgment module's equivalent pin: it asserts that the emphasis wraps both words of the subtitle rather than splitting them.

**This is the only suite pin that fails.** The four other title-bearing assertions — lines 114, 163, and 567 — all pin video filenames, which ruling 6 freezes, so they stay green and must not be touched. The two accent-token pins at lines 36 and 37 are also untouched under ruling 11.

### 4.5 `ee-home.js` and `ee-learn.js` — 2 edits

Short form in both, because the surrounding header line already uses an em dash and a second one inside the parenthetical would put two of them in one short line.

**Edit A — `ee-home.js` line 2.** FIND (expect exactly 1):
```
home.js — Home screen module (Ethics Engine)
```
REPLACE:
```
home.js — Home screen module (Conscience)
```

**Edit B — `ee-learn.js` line 2.** FIND (expect exactly 1):
```
learn.js — Learn screen module (Ethics Engine)
```
REPLACE:
```
learn.js — Learn screen module (Conscience)
```

### 4.6 `ee-screen-loader.js` — NO EDIT

Line 2 reads `screen-loader.js — shared infrastructure for per-screen modules (Ethics Engine port of the Pipeline original, via the Decision Lab; three DL adaptations: authSignedIn guard, appZoom, modal append)`.

**Ruled intact.** It records where this file came from, and it names both the Pipeline original and the Decision Lab intermediary. Rewriting it to the new name would destroy a lineage note that is not recoverable from anywhere else. It stays exactly as it is.

### 4.7 `ee-styles.css`, `ee-learn.html`, `ee-build-templates.js` — NO EDITS

`ee-styles.css` contains zero occurrences of the title. `ee-learn.html` contains zero. `ee-build-templates.js` contains zero, but must be **run** — see §5.

---

## 5. Regeneration — mandatory

`ee-templates-local.js` is generated, not authored. Its own first line says so. It holds a JSON-escaped copy of both screen templates, which is why the hero headline appears in it a second time.

Because Edit 3 changes `ee-home.html`, run from the directory containing the files:

```
node ee-build-templates.js
```

Confirm the console prints `ee-templates-local.js written for: home, learn`, then ship `ee-home.html` and `ee-templates-local.js` **together**. Shipping one without the other gives a build that renders the new title over HTTP and the old one from disk, or the reverse — a divergence a single-protocol spot check will not catch.

**Do not hand-edit `ee-templates-local.js`.** Any manual change is overwritten on the next regeneration.

---

## 6. Acceptance criteria

Check all eight before handing the work back.

1. `node --check` passes on `ee-app.js`, `ee-suite.js`, `ee-home.js`, `ee-learn.js`, and `ee-screen-loader.js`. *(Confirmed passing in the dry run.)*
2. **A case-insensitive search for `ethics[ _-]*engine` returns exactly 14 occurrences, distributed as follows.** Zero is a failure, not a success — it means the video filenames were destroyed.

| File | Expected residual | What they are |
|---|---:|---|
| ee-app.js | 6 | the six `.mp4` references in §4.3 |
| ee-suite.js | 5 | the five `.mp4` pins at lines 114, 163, 567 |
| ee-home.html | 1 | the module overview `.mp4` |
| ee-templates-local.js | 1 | the same, mirrored, post-regeneration |
| ee-screen-loader.js | 1 | the ruled-intact provenance header |
| all other files | 0 | — |

3. All seven `.mp4` strings resolve to files that exist on the drive, and all seven videos play.
4. `ee-suite.js` runs to **0 fail**. Only the line 503 pin was retargeted; if any other pin has gone red, something outside this directive was changed.
5. A search for `The Conscience` returns **0** occurrences.
6. `node ee-build-templates.js` was run after the last `.html` edit, and `ee-templates-local.js` contains `Conscience — <em>Ethical Reasoning</em>` in escaped form. Verify by searching the generated file; do not assume.
7. The pre-existing *Code & Conscience* citations survive untouched. A case-sensitive search for `onscience` goes from 21 before to **33** after — 21 pre-existing plus 12 new mixed-case insertions. The six new all-caps `CONSCIENCE` strings are additional to that count. **Searching for the new name will not verify your work**, because 21 of the hits predate it; verify against the residual counts in criterion 2 instead.
8. Paul's browser pass, in both light and dark themes at desktop and mobile widths, covering: browser tab title, nav logo, home hero, entry screen, about modal, practice rail expanded *and* minimized, board sidebar caption, all five SVG identity bands, and all seven videos playing.

**Criterion 8 is the banking event.** Criteria 1 to 7 confirm the code is internally consistent. Only the browser pass confirms it looks right, and the nav logo in particular cannot be signed off any other way.

---

## 7. Explicitly out of scope

Listed so nobody adds them on their own initiative or reports them later as misses.

- **The sixteen `ee-` storage keys.** Ruling 8. The module is pre-release with no shipped users — `ee-app.js` lines 24–25 and 28 record this — so there is no migration risk either way, but they are not changing in this pass.
- **The `ee-` filename prefix**, the six `<script>`/`<link>` paths in `ee-index.html`, and `window.__SCREEN_FILE_PREFIX="ee-"`. Ruling 9.
- **The accent tokens and every CSS rule.** Ruling 11. Words only.
- **The 40 `EE` shorthand references** in code comments and suite pin descriptions, and every other dated build comment. They are an audit trail of rulings made under the old name; rewriting them retroactively makes the history harder to read. New comments written after today use the new name.
- **The branded "Ethics" and "Ethical" surfaces**, all of which stay: `THE ETHICS FILES`, `THE ETHICS BOARD`, `Back to Ethics Files`, `ETHICS CASES OPENED`, `YOUR ETHICAL STYLE`, `YOUR ETHICAL PROFILE`, `ETHICAL EXERCISES`. With "Ethical Reasoning" in the lockup these read as a family with the new name rather than as leftovers from the old one.
- **The 64 ordinary uses of "ethical" and "ethics"** in body copy, and the line at `ee-app.js` 2783 that uses "conscience" as a common noun ("Sometimes a queasy feeling is not your conscience warning you off"). Reviewed and ruled fine.

---

## 8. Derivations flagged

One string below was not directly ruled and is derived. It is called out here rather than buried, so it can be overturned in one line.

**The minimized rail tooltip (Edit 7) takes the full lockup**, giving `title="Conscience \u2014 Ethical Reasoning"`. The ruling covers the visible monogram (`CER`) and the expanded state of the same surface (full lockup); the tooltip is the accessible label for the collapsed state of that surface, so the full lockup follows. If it should be the short form instead, that is a one-word change to this one string and nothing else in the directive moves.

---

## 9. Sequence and per-file checklist

Work in this order. The regeneration must follow the last `.html` edit, and the suite must run after everything.

| Step | File | Edits | Notes |
|---:|---|---|---|
| 1 | `ee-index.html` | Edits 1–2 | Literal em dashes. Leave the six `ee-` paths alone. |
| 2 | `ee-home.html` | Edit 3 | Literal em dash. The `.mp4` on the same line does not change. |
| 3 | `ee-app.js` | Edits 4–12 | Escaped `\u2014` and `\u00B7` throughout. Edit 5 is a five-count replace-all; Edit 6 must anchor on its `dutil-cap` wrapper. Edits 13–18 are the six `.mp4` strings that must not be touched. |
| 4 | `ee-home.js`, `ee-learn.js` | Edits A–B | Literal em dashes. Short form. |
| 5 | `ee-screen-loader.js` | none | Header ruled intact. |
| 6 | — | run `node ee-build-templates.js` | Confirm the console line. |
| 7 | `ee-suite.js` | Edit 19 | Double-backslash escapes. Retarget only line 503; leave 114, 163, 567, 36, 37 alone. |
| 8 | — | `node --check`, then the suite | Do not ship on red. |
| 9 | — | acceptance criteria §6 | Residual must be 14, not 0. |
| 10 | — | Paul's browser pass | The banking event. Report nav-logo collision rather than fixing it. |

Ship `ee-home.html` and `ee-templates-local.js` together. Ship `ee-app.js` and `ee-suite.js` together, since the line 503 pin and the Edit 4 string are a matched pair.
