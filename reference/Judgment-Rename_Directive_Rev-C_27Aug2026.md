# Module Rename — The Decision Lab → Judgment

## 1. Rulings in force

**The name.** Full lockup `Judgment — Critical Thinking`. Short form `Judgment`. Which one goes where is specified per site in §4 — do not choose.

**Spelling is American: `Judgment`, never `Judgement`.** No exceptions, on any surface, in any file.

**The dash is a spaced em dash (U+2014), one space either side:** `Judgment — Critical Thinking`.

**No formatting changes.** Accent colours, italics, font sizes, and wrapper elements stay exactly as they are. Where the old title sat inside a `<span>` or `<em>`, the new subtitle takes that same wrapper. This includes the fact that `.nav-logo span` and `.prail-logo span` resolve to different colours — that difference is pre-existing and is not to be normalised as part of this work.

**Video filenames do not change.** All seven `.mp4` references keep the old title verbatim. See §6.

**Storage keys, the `DL-` file prefix, internal function names, the AI persona names, and code comments do not change.** See §6.

**Files in scope are the eleven listed in §2.** `DL-module-guide.md` was supplied in error and is excluded; do not open it.

---

## 2. Files in scope

If your copies do not match these checksums, stop and re-sync — the line numbers below will not hold.

| File | Lines | Bytes | md5 |
|---|---:|---:|---|
| DL-app.js | 3,525 | 335,971 | `993842a84f96202659308786e1111b5e` |
| DL-build-templates.js | 14 | 1,097 | `555a8d05fc85070206dda2089c63ee4c` |
| DL-home.html | 1 | 5,677 | `ec7f7cc13cc07078ce48c2215d458fc8` |
| DL-home.js | 25 | 1,246 | `2f138e07ab810135c985ba21b7e4ca6e` |
| DL-index.html | 52 | 2,754 | `3d02f3ec06df89eda75e494c7b6ccbcc` |
| DL-learn.html | 1 | 7,008 | `132c779c1d518a731684ba861e932d4e` |
| DL-learn.js | 24 | 1,184 | `f3360407cf9ff0dceaee4e8e9fca41ba` |
| DL-module_smoke.js | 753 | 84,013 | `a5d129202335de7afcd098883d84ad60` |
| DL-screen-loader.js | 135 | 7,100 | `9b885c1defe02bb915e775943579b6e6` |
| DL-styles.css | 803 | 289,834 | `d7c53dae305e29eb04c382b3beb34736` |
| DL-templates-local.js | 4 | 13,418 | `e99d297e63b7271d07e44a0614ac2e51` |

`DL-styles.css`, `DL-build-templates.js`, and `DL-learn.html` need no edits.

`DL-home.html` and `DL-learn.html` are single-line files, so line numbers there are meaningless — use the FIND string.

---

## 3. Before you start

**Do not run a global find-and-replace on "The Decision Lab."** Six of the thirty occurrences in `DL-app.js` are video asset paths that must survive untouched. A blanket replace will silently break playback on the home screen, the flow intro, all three board parts, Assess, and Dashboard. Apply only the anchored edits in §4.

**Em dashes are stored in two different forms depending on the file.** `DL-app.js` holds 26 literal U+2014 characters and 134 `\u2014` escapes; `DL-module_smoke.js` holds 9 of each; `DL-index.html`, `DL-home.html`, and `DL-learn.html` hold literal characters only. **In `DL-app.js` and `DL-module_smoke.js`, write new em dashes as `\u2014`.** **In the HTML files, write the literal character.** The same split applies to the curly apostrophe: `DL-home.html` stores the literal U+2019, `DL-module_smoke.js` stores `\u2019`.

Each edit below gives a FIND string and a REPLACE string. Match the FIND exactly. Where an edit covers more than one site, the number of sites is stated.

---

## 4. The edits

### 4.1 DL-index.html

**Edit 1 — browser tab title, line 6.** Short form. The full lockup was rejected here because it would put three em dashes in one line doing two different jobs.

```
FIND:    <title>The Decision Lab — Leadership Edge Module 1</title>
REPLACE: <title>Judgment — Leadership Edge Module 1</title>
```

**Edit 2 — nav logo, line 16.** Full lockup.

```
FIND:    >The <span>Decision Lab</span></div>
REPLACE: >Judgment — <span>Critical Thinking</span></div>
```

The `<span>` must survive — `DL-styles.css:19` colours and italicises it. On screen the whole string is uppercased and cannot wrap (`white-space:nowrap`, styles.css:18), so it renders `JUDGMENT — CRITICAL THINKING` with the second half in blue italic. **This is the widest new string on any surface — see §9.**

### 4.2 DL-home.html

**Edit 3 — hero headline.** Full lockup.

```
FIND:    <h1 class="hero-headline">The <em>Decision Lab</em></h1>
REPLACE: <h1 class="hero-headline">Judgment — <em>Critical Thinking</em></h1>
```

**Edit 4 — home plan row 01.** Curly apostrophe, no closing full stop.

```
FIND:    <strong>Learn</strong>Articles, books, and research underlying the Lab’s approach to decision-making</div>
REPLACE: <strong>Learn</strong>Articles, books, and research underlying the app’s approach to decision-making</div>
```

**Edit 5 — Learn card body.** Same sentence, but this one has a closing full stop.

```
FIND:    <div class="lib-body">Articles, books, and research underlying the Lab’s approach to decision-making.</div>
REPLACE: <div class="lib-body">Articles, books, and research underlying the app’s approach to decision-making.</div>
```

**Edit 6 — Practice card CTA.**

```
FIND:    <div class="card-arrow">Open the Lab</div>
REPLACE: <div class="card-arrow">Start Practicing</div>
```

After this edit the phrase appears twice on the home screen — once on the hero button, once on this card. Both go to the same place. That is intended.

### 4.3 DL-app.js

**Edit 7 — sign-in / entry screen title, line 447.** Full lockup.

```
FIND:    margin-bottom:10px">The <em>Decision Lab</em></div>
REPLACE: margin-bottom:10px">Judgment \u2014 <em>Critical Thinking</em></div>
```

**Edit 8 — board sidebar caption, line 602.** Short form. This is the group heading over the six nav buttons in the decision board's left rail; the `BOARD TOOLS` caption below it is unchanged.

```
FIND:    <div class="dutil-cap">THE DECISION LAB</div>
REPLACE: <div class="dutil-cap">JUDGMENT</div>
```

**Edit 9 — minimised rail mark and tooltip, line 686.** Both change in one edit.

```
FIND:    title="The Decision Lab">DL</div>
REPLACE: title="Judgment \u2014 Critical Thinking">JCT</div>
```

**Edit 10 — expanded rail logo, line 686.** Full lockup. The `<span>` here resolves to gold rather than blue; that is correct and stays.

```
FIND:    <div class="prail-logo">The <span>Decision Lab</span></div>
REPLACE: <div class="prail-logo">Judgment \u2014 <span>Critical Thinking</span></div>
```

**Edit 11 — Challenger system prompt, line 873.**

```
FIND:    You are a Decision Challenger inside The Decision Lab, a judgment-training tool.
REPLACE: You are a Decision Challenger inside the Judgment \u2014 Critical Thinking app, a decision-training tool.
```

**Edit 12 — Coach system prompt, line 1015.**

```
FIND:    You are a Decision Coach inside The Decision Lab, a judgment-training tool.
REPLACE: You are a Decision Coach inside the Judgment \u2014 Critical Thinking app, a decision-training tool.
```

The later line in the same prompt — `Never make the decision for them. Build their judgment muscle.` — is unchanged.

**Edit 13 — Profile Analyst system prompt, line 1126, first reference.** Note this one says **module**, not tool.

```
FIND:    You are the Decision Profile Analyst inside The Decision Lab, a judgment-training module in NextChapter
REPLACE: You are the Decision Profile Analyst inside the Judgment \u2014 Critical Thinking app, a decision-training module in NextChapter
```

The later phrase in the same prompt — `where their judgment is strong` — is unchanged.

**Edit 14 — Profile Analyst system prompt, line 1126, second reference.**

```
FIND:    The Lab trains one skill:
REPLACE: The app trains one skill:
```

**Edit 15 — AI State Export 1 heading, line 1163.** Short form.

```
FIND:    '# The Decision Lab \u2014 AI State Export 1: Challenge Prompts
REPLACE: '# Judgment \u2014 AI State Export 1: Challenge Prompts
```

**Edit 16 — AI State Export 1 prose, line 1165.**

```
FIND:    the exact prompt The Decision Lab sends to the AI to compose the Challenge
REPLACE: the exact prompt the Judgment \u2014 Critical Thinking app sends to the AI to compose the Challenge
```

**Edit 17 — AI State Export 1 download filename, line 1175.**

```
FIND:    'decision-lab-ai-state-1-challenges.md'
REPLACE: 'judgment-ai-state-1-challenges.md'
```

**Edit 18 — AI State Export 2 heading, line 1177.** Short form.

```
FIND:    '# The Decision Lab \u2014 AI State Export 2: Written Profile Prompt
REPLACE: '# Judgment \u2014 AI State Export 2: Written Profile Prompt
```

**Edit 19 — AI State Export 2 prose, line 1179.**

```
FIND:    the exact prompt The Decision Lab sends to the AI when the written profile
REPLACE: the exact prompt the Judgment \u2014 Critical Thinking app sends to the AI when the written profile
```

**Edit 20 — AI State Export 2 download filename, line 1184.**

```
FIND:    'decision-lab-ai-state-2-profile.md'
REPLACE: 'judgment-ai-state-2-profile.md'
```

**Edit 21 — SVG export footer bands. 4 sites — lines 1304, 1469, 1556, 2652.** All four are byte-identical and all four change. Short form.

```
FIND:    THE DECISION LAB \u00B7 LEADERSHIP EDGE \u00B7 MODULE I
REPLACE: JUDGMENT \u00B7 LEADERSHIP EDGE \u00B7 MODULE I
```

These sit in width-budgeted SVG text at mono 8 and 9.5 with letter-spacing 1.1 and 2. The replacement is shorter than the original, so overflow risk goes down. Do not use the full lockup here.

**Edit 22 — SVG assessment guidance headings. 2 sites — lines 1890, 2060.** Short form.

```
FIND:    YOUR DECISION LAB GUIDANCE
REPLACE: YOUR JUDGMENT GUIDANCE
```

**Edit 23 — assessment tip copy. 2 sites — lines 1685 and 2807.** The FIND string is identical at both; the surrounding sentence differs only in that 2807 wraps `<strong>Case For</strong>`. The capitalised `YOUR` is deliberate emphasis and stays.

```
FIND:    The Decision Lab is about building YOUR judgment muscle, not collecting opinions.
REPLACE: This app is about building YOUR judgment muscle, not collecting opinions.
```

**Edit 24 — HTML assessment guidance card heading, line 2812.** Short form.

```
FIND:    <div class="assess-guidance-title">Your Decision Lab Guidance</div>
REPLACE: <div class="assess-guidance-title">Your Judgment Guidance</div>
```

**Edit 25 — Help modal heading, line 3131.** Full lockup. This heading is plain text with no inner markup, so it carries no accent today and gains none. The `Leadership Edge \u00B7 Module 1` subtitle immediately beneath it is unchanged.

```
FIND:    <h3>The Decision Lab</h3>
REPLACE: <h3>Judgment \u2014 Critical Thinking</h3>
```

**Edit 26 — Help modal body, line 3131.** Sentence-initial, so capital T. The rest of the paragraph and the 01–06 walkthrough beneath it are unchanged.

```
FIND:    margin-bottom:12px">The Decision Lab guides you through
REPLACE: margin-bottom:12px">The Judgment \u2014 Critical Thinking app guides you through
```

### 4.4 DL-module_smoke.js

The suite will fail on Edits 7, 22, 24, 4 and 5. That is expected. Retarget these five pins; keep the superseded versions with a dated note rather than deleting them.

**Edit 27 — guidance heading pins. 3 sites — lines 313, 445, 564.**

```
FIND:    YOUR DECISION LAB GUIDANCE
REPLACE: YOUR JUDGMENT GUIDANCE
```

**Edit 28 — entry title pin, line 542.** This is a retarget, not a string swap. The rule being pinned is that the emphasis wraps the whole emphasised element rather than splitting it; that rule now applies to the two words of the subtitle. Also update the check's description from `'design: entry title emphasizes both words'` to `'design: entry title subtitle emphasizes both words'`.

```
FIND:    html.indexOf('The <em>Decision Lab</em>')>=0&&html.indexOf('The <em>Decision</em> Lab')===-1
REPLACE: html.indexOf('Judgment \u2014 <em>Critical Thinking</em>')>=0&&html.indexOf('Judgment \u2014 <em>Critical</em> Thinking')===-1
```

**Edit 29 — home copy fragment pin, line 639.** Note the escaped apostrophe.

```
FIND:    'research underlying the Lab\u2019s approach'
REPLACE: 'research underlying the app\u2019s approach'
```

Line 257 needs no change. It pins `.nav-logo span{color:var(--head-blue)` in the stylesheet, which is exactly the wrapper Edit 2 preserves.

---

## 5. Regenerate the template bundle

`DL-templates-local.js` is generated, not authored. It holds a JSON-escaped copy of `DL-home.html`, which is why the hero headline and the three "the Lab" strings appear there a second time. Do not hand-edit it — the next regeneration will overwrite your changes.

After Edits 3–6, run from the directory holding the files:

```
node DL-build-templates.js
```

Confirm the console prints `DL-templates-local.js written for: home, learn`, then ship `DL-home.html` and `DL-templates-local.js` together. A stale bundle makes the app render the old title from disk (`file://`) and the new one over HTTP, which is easy to miss if you only test one.

---

## 6. Do not change

**The seven video filenames.** These keep the old title verbatim:

| Referenced in | Line | Filename |
|---|---|---|
| DL-app.js | 578 | `The Decision Lab - INTRO TO THE FLOW.mp4` |
| DL-app.js | 2408 | `The Decision Lab - Part I The Frame.mp4` |
| DL-app.js | 2408 | `The Decision Lab - Part II - THE EXAMINATION.mp4` |
| DL-app.js | 2408 | `The Decision Lab - PART III THE CALL.mp4` |
| DL-app.js | 2846 | `The Decision Lab - Assess.mp4` |
| DL-app.js | 3020 | `The Decision Lab - DASHBOARD.mp4` |
| DL-home.html | video `src` | `The Decision Lab - Module Overview.mp4` |

**Surfaces named on "Decision" that are not the module title.** These are ruled to stay. Decisions are the module's unit of work, so these describe their contents rather than echoing the old name. Leave all of them:

- `THE DECISION BOARD` — 2 sites, lines 1305 and 1470, SVG export headers
- `THE DECISION FILES` — 2 sites, lines 1557 and 2653, SVG export headers
- `Back to Decision Files` — line 597, back-navigation label
- `YOUR DECISION STYLE` — 2 sites, lines 1855 and 1992
- `YOUR DECISION PROFILE` — 2 sites, lines 2096 and 2252
- `PROVISIONAL DECISION`, `DECIDED DECISIONS`, `ALL DECISIONS`, `GENERATE DECISION PROFILE`, `START WORKING THROUGH A NEW DECISION`, and all other body copy using "decision" as an ordinary word

Note that line 1304 changes under Edit 21 while line 1305 directly beneath it does not. Both are on the same SVG export. This is correct.

**All eleven localStorage keys** — `dl-v9`, `dl-v8`, `dl-accounts`, `dl-auth`, `dl-remember`, `dl-theme`, `dl-zoom`, `dl-vidseen`, `dl-vidcollapse`, `dl-lastnotif`, `dl-rev::smoke`. Renaming `dl-v9` alone would orphan every user's saved decisions.

**The `DL-` filename prefix** and the `__SCREEN_FILE_PREFIX` seam at `DL-index.html:44`.

**Internal function names** — `dlDownload`, `exportAIState1`, `exportAIState2`, `buildChallengePrompt`, `buildCoachContext`, `buildProfilePrompt`.

**The AI persona names** — `Decision Challenger`, `Decision Coach`, `Decision Profile Analyst`, and the `✦ Decision Coach` sender labels in the chat panel. These name roles, not the module.

**`DL` in code comments** — 8 sites in `DL-app.js`, 1 in `DL-screen-loader.js`, 1 in `DL-styles.css`, 2 in `DL-module_smoke.js`.

---

## 7. Awaiting a decision — do not edit yet

Three files carry the old title in their opening comment block. Not user-visible. No edit until this is settled.

| File | Line | Text |
|---|---:|---|
| DL-home.js | 2 | `home.js — Home screen module (Decision Lab)` |
| DL-learn.js | 2 | `learn.js — Learn screen module (Decision Lab)` |
| DL-screen-loader.js | 2 | `screen-loader.js — shared infrastructure for per-screen modules (Decision Lab port of the Pipeline original; three DL adaptations…)` |

---

## 8. Sequence

1. Confirm your file hashes against §2.
2. Edits 1–2 → `DL-index.html`.
3. Edits 3–6 → `DL-home.html`.
4. `node DL-build-templates.js`; confirm the console line.
5. Edits 7–26 → `DL-app.js`.
6. Edits 27–29 → `DL-module_smoke.js`.
7. `node --check DL-app.js` and `node --check DL-module_smoke.js`.
8. Run the smoke suite. Do not ship on red.
9. Run the checks in §9.
10. Browser pass.

---

## 9. Acceptance criteria

**Textual.**

- `grep -c "Decision Lab" DL-app.js` returns exactly **6** — the six video filenames and nothing else.
- `grep -c "Decision Lab" DL-home.html` returns exactly **1** — the video filename.
- `DL-index.html`, `DL-module_smoke.js`, and `DL-templates-local.js` return **0**.
- `DL-home.js`, `DL-learn.js`, `DL-screen-loader.js` return **1** each until §7 is settled.
- `Judgement` (British form) appears nowhere in the file set.
- `judgment-training` appears nowhere in `DL-app.js`.
- `Open the Lab` appears nowhere in the file set.
- `DL-templates-local.js` contains `Judgment — <em>Critical Thinking</em>` in JSON-escaped form, confirming the regeneration ran.

Bare `grep -c` exits non-zero on zero matches and will break an `&&` chain — append `|| true` or count in Python.

**Suite.** `node --check` clean on both edited JS files, and the smoke suite at zero failures with the five retargeted pins passing.

**Browser.** Green suites confirm internal consistency, not that it looks right. Check every surface below in both light and dark themes:

1. **Nav logo, every screen, narrow and wide viewports.** Highest risk: `JUDGMENT — CRITICAL THINKING` is 28 uppercase characters at 24px with 0.12em tracking and `white-space:nowrap`, against 16 characters previously. It cannot wrap, so it will push the nav tabs. **If it collides, report back rather than improvising a fix.**
2. Home hero headline — full lockup, "Critical Thinking" in blue italic.
3. Home plan row 01, Learn card body, Practice card CTA reading `Start Practicing`.
4. Sign-in / entry screen title.
5. Expanded rail logo — "Critical Thinking" in **gold** italic, not blue. Confirm it fits the 226px rail.
6. Minimised rail mark reading `JCT`, tooltip reading the full lockup.
7. Board sidebar caption reading `JUDGMENT`, with `BOARD TOOLS` unchanged below it.
8. Help modal — heading in full lockup, body opening `The Judgment — Critical Thinking app guides you…`.
9. Assessment guidance card heading and both tip variants.
10. All four SVG export variants — footer bands and both guidance headings — text fitting inside its box.
11. All seven videos play.

---

## 10. Checklist

| ✓ | Surface | File | Edit |
|---|---|---|---|
| ☐ | Browser tab title | DL-index.html | 1 |
| ☐ | Nav logo | DL-index.html | 2 |
| ☐ | Home hero headline | DL-home.html | 3 |
| ☐ | Home plan row 01 | DL-home.html | 4 |
| ☐ | Learn card body | DL-home.html | 5 |
| ☐ | Practice card CTA | DL-home.html | 6 |
| ☐ | Template bundle regenerated | DL-templates-local.js | §5 |
| ☐ | Sign-in / entry title | DL-app.js | 7 |
| ☐ | Board sidebar caption | DL-app.js | 8 |
| ☐ | Minimised rail mark + tooltip | DL-app.js | 9 |
| ☐ | Expanded rail logo | DL-app.js | 10 |
| ☐ | Challenger prompt | DL-app.js | 11 |
| ☐ | Coach prompt | DL-app.js | 12 |
| ☐ | Profile Analyst prompt (title) | DL-app.js | 13 |
| ☐ | Profile Analyst prompt ("The Lab") | DL-app.js | 14 |
| ☐ | Export 1 heading | DL-app.js | 15 |
| ☐ | Export 1 prose | DL-app.js | 16 |
| ☐ | Export 1 filename | DL-app.js | 17 |
| ☐ | Export 2 heading | DL-app.js | 18 |
| ☐ | Export 2 prose | DL-app.js | 19 |
| ☐ | Export 2 filename | DL-app.js | 20 |
| ☐ | SVG footer bands ×4 | DL-app.js | 21 |
| ☐ | SVG guidance headings ×2 | DL-app.js | 22 |
| ☐ | Assessment tip ×2 | DL-app.js | 23 |
| ☐ | Guidance card heading | DL-app.js | 24 |
| ☐ | Help modal heading | DL-app.js | 25 |
| ☐ | Help modal body | DL-app.js | 26 |
| ☐ | Suite guidance pins ×3 | DL-module_smoke.js | 27 |
| ☐ | Suite entry title pin | DL-module_smoke.js | 28 |
| ☐ | Suite home copy pin | DL-module_smoke.js | 29 |
| ☐ | Textual checks | — | §9 |
| ☐ | Suite at zero failures | — | §9 |
| ☐ | Browser pass, both themes | — | §9 |

---

## 11. Out of scope

- `DL-module-guide.md` — supplied in error.
- Deployed AWS asset paths and CDN-cached filenames.
- The seven `.mp4` files themselves.
- Any copy, marketing, or documentation outside the eleven files in §2.
- The phrase "Leadership Edge Module 1" / "Leadership Edge · Module 1", which this rename does not touch.
