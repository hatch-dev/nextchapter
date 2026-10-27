# Leadership Edge Module Guide — Comprehensive Build & Conversion Standard
**Version 2.9 · July 28, 2026 · v2.9: the DL- prefixed set IS the canonical set (Paul’s ruling, July 28) — the sole shipped form from now on; the unprefixed form is retired (§VIII-11 supersession note). v2.8 records the runnable DL- prefixed variant (§VIII-11: ER-pattern prefix seam); v2.7 records the flag rulings round (§VIII-10: the four bias links, the up-front deletion, decided-only profile gating, and the Leadership Edge name ruling closed; suite 260); v2.6 records the July 14 copy digest slot-back (§VIII-9: 75 tracked-change operations from Paul’s edited copy digest applied across app.js and home.html, two pins refined with cause, suite extended to 258); v2.5 relocates the AI state exports to the More menu (Paul's placement ruling); v2.4 adds the AI state exports and consolidates the AI layer into Part IX; v2.3 records the written-profile round (§VIII-8: one-decided-file gate, grounded full-text prompt, in-board profile states); v2.2 records the WHY WE ASK copy correction (§VIII-7); v2.1 records the challenge-context change (§VIII-6: exhibits go to the model as label + question + answer); v2.0 records the deployment file split (Part VIII): the multi-file set is now the SOLE shipped form and the single-file build is retired; v1.11 records the axis-aligned short hops and thread-contrast lift (§VII-8 addendum); v1.10 records the drawer-row fit fix (§VII-1 addendum); v1.9 adds the connector refinement and key-card truth round (§VII-8); v1.8 extends Part VII with the Assess/Dashboard typography rollout (§VII-7); v1.7 records the board typography & flow-chart round and the entry-title emphasis fix (Part VII); v1.6 records the dead-code excision (§VI-10) and the seam-inventory change; v1.5 added the true dark board round (§VI-9); v1.4 recorded the single-user auth implementation (§VI-8); v1.3 added Part VI (compact congruence round); v1.2 added Part V. Living document — append new parts and rulings at the end; supersession markers inside older parts point forward to the section that now governs.**

**Authority:** The Decision Lab (Leadership Edge Module 1) shipped build is the **deployment file set** (Part VIII) — the single-file `decision-lab-index.html` is retired (last single-file identity, for the record: 3,924 · 586,595 · `e43db41848d4b1bae8cec7f221a0a6d0`). Set identities (lines · bytes · md5), gated by `DL-module_smoke.js` at **260/260** (`node module_smoke.js <set-dir>`; requires jsdom resolvable from the invocation, e.g. run from a workspace with `npm install jsdom`):

| File | Lines | Bytes | md5 |
|---|---|---|---|
| `DL-index.html` | 52 | 2,771 | `1fd84536dde08e2fef450ce5f5ae1136` |
| `DL-styles.css` | 776 | 286,503 | `a310a158c30819c6585ef1c4e32da81c` |
| `DL-app.js` | 3,168 | 302,110 | `543b3429909d35b08bcc8e4b7596882a` |
| `DL-screen-loader.js` | 135 | 7,100 | `9b885c1defe02bb915e775943579b6e6` |
| `DL-home.html` | 1 | 5,608 | `1ffc8f9cab97b7e3aa47a9a3bc172992` |
| `DL-home.js` | 25 | 1,246 | `2f138e07ab810135c985ba21b7e4ca6e` |
| `DL-learn.html` | 1 | 7,008 | `132c779c1d518a731684ba861e932d4e` |
| `DL-learn.js` | 24 | 1,184 | `f3360407cf9ff0dceaee4e8e9fca41ba` |
| `DL-templates-local.js` | 4 | 13,349 | `b3c943a7322162298eaf801348a79005` |
| `DL-build-templates.js` | 14 | 1,097 | `555a8d05fc85070206dda2089c63ee4c` |
| `DL-module_smoke.js` | 543 | 56,378 | `208d517644a2367cf2072c971c2b1a4b` |

(`home.html`/`learn.html` are single-line captured markup — wc reports 0 newlines; recorded as 1 line.) Where any part below conflicts with a later part, **the later part governs** — Part VIII is the most recent doctrine.

**Program rename:** "Human Edge" is now **"Leadership Edge"** everywhere (Part II §0 has the sweep protocol). Part I's original title and prose predate the rename; apply the substitution when reading and converting.

**Compiled from** (source identities, verified off disk at compilation):
- Part I — `human-edge-restyle-guide.md` · 276 lines · 27,735 B · md5 `081de25bbdf272d1f1e9b91ece231ef4`
- Part II — `leadership-edge-activities-guide.md` v1.0 · 251 lines · 29,855 B · md5 `8d40a1e3904beb2ae829050790681266` **⚠ unverified — the July 12 handover records this md5 as `8d40a1e3904beb2ae829050790680266` (…0680266 vs …0681266); the source file was not on disk at v1.2 compilation to adjudicate. Verify off disk before relying on either.**
- Part III — `human-edge-aws-seam-guide.md` · 90 lines · 6,988 B · md5 `2c973f896b7aa705a96b6a6224676139`
- Part IV — `leadership-edge-reactive-addendum.md` · 59 lines · 7,195 B · md5 `390653778138b42b5d981b6a5b6e64dc`
- Part V — authored in-session (Decision Lab Assess reactive round, July 12 late evening); no separate source file — this document is the original.
- Part VI — authored in-session (Decision Lab compact congruence round, July 12 late evening); no separate source file — this document is the original.

**Contents**
- **Part I — Chrome Restyle** (global chrome, Home, Learn, Insights; tokens, fonts, theme mechanism, verification, hazard appendix H1–H11)
- **Part II — Activity Surfaces** (rename directive, rulings to obtain, board architecture, vibe tokens, cabinet, board, focus reel, Assess, Dashboard, interaction doctrine, validation stack)
- **Part III — AWS Deployment Seam** (the single CLAUDE_API_URL constant, conversion protocol, gates)
- **Part IV — Reactive Architecture** (three-tier responsive system R1–R12: tier law, container-collapse trap, serif parity, clarity doctrine, hit-rect lift, structural guards, full-title folders, drawers/nav policy, validation additions)
- **Part V — Assess Reactive Round** (V1–V8: tier wiring, compact intake and diagnostics, floor + de-italic, verbatim-copy line splits, suite growth to 182, open items)
- **Part VI — Compact Congruence Round** (VI-1–VI-6: compact cards keep the wide card grammar, geometry accommodations, cabinet CTA/header congruence, stacked-gauge centering, suite growth to 188)
- **Part VII — Board Typography & Flow-Chart Round** (VII-1–VII-8: Pipeline-basis sidebar fonts, serif board headings and card heads, orthogonal process lines, entry-title emphasis, Assess/Dashboard rollout, connector refinement + key truth, suite growth to 232)

---

# PART I — CHROME RESTYLE
*Source: human-edge-restyle-guide.md (verbatim, with supersession markers). Read "Human Edge" as "Leadership Edge" throughout.*

---

# Human Edge Module Restyle Guide — Old (black/orange) → Family Standard (90-Day Pipeline model)

**Scope:** global chrome plus the Home, Learn, and Insights pages, light and dark modes. The activity surfaces (Assess, Practice, Dashboard/diagnostics) are explicitly **out of scope** — a separate guide will cover them, because activity layout may differ per module. **Authority:** the deployed 90-Day AI Innovation Pipeline stylesheet is the ultimate reference; this guide encodes its values as verified in the completed Decision Lab migration (July 2026). Every CSS block below is extracted verbatim from the shipped Decision Lab build, not paraphrased. If drift is suspected, request the *deployed* Pipeline styles.css — uploaded copies can lag deployment (this bit us once; see Hazard H10).

**How to use this document:** work phase by phase, in order. Each phase ends with verification gates — run them; do not proceed on green-by-assumption. All edits should be count-asserted string replacements (exactly one match, abort and inspect on zero or multiple). Keep a running report with the build's measured identity (lines · bytes · md5) after every ship.

---

## Family standard vs module parameters

Fixed for every Human Edge module (do not vary): everything in this guide — tokens, fonts, nav, footer, theme mechanism, section grammar, the three page treatments.

Module parameters (require Paul's ruling per module, do not invent):
- **Accent pair** `--gold` / `--gold-light`: the module's own accent (Decision Lab: `#E8621A`/`#F07A37`). **Caution:** `--gold-text` (`#B34208`) is the *text-safe dark variant of the orange family*; a module with a non-orange accent needs its own text-safe variant ruled by Paul before migration.
- **Home video placeholder:** optional; some modules have none. Omit the video card cleanly rather than leaving an empty well.
- **Theme storage key:** one per module, pattern `<module-prefix>-theme` (Decision Lab uses `dl-theme`). The key appears in exactly two places (first-paint script + toggleTheme); change both.
- **Nav tab set and module title:** content, not styling.

Decision-Lab-specific rulings that are *not* family standards (do not port blindly): the 1280px `.wrap` (exists for its board envelope — see Phase 5 for the scoped 1200px pattern), the 56px hero-left inset, drawers/board machinery.

---

## Phase 0 — Preflight

1. Read the old module file in full off disk; record lines, bytes, md5. Never work from an assumed copy.
2. Inventory its class families (the old modules use their own names — map them to the target grammar rather than renaming markup wholesale; conform *values*, keep names).
3. Grep for **inline styles** in the render JS (`style="`) that set colors/sizes — inline beats stylesheet and has silently defeated three past fixes (H2).
4. Uploads directory is a flat namespace — last write wins on shared filenames. Confirm file identity by content, never by name.

## Phase 1 — Fonts and tokens

**Font link (verbatim; the old modules load a smaller weight set, and any `font-weight:500` silently falls back to 400 without this — H4):**
```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600&family=DM+Mono:wght@300;400;500&display=swap
```

**`:root` (Decision Lab shipped block — swap the accent pair per module ruling; everything else is family-fixed):**
```css
:root{--text-mid:#47525F;--head-blue:#076D9E;--gold-text:#B34208;--text-max:#1E2530;--bg-rgb:234,238,244;--fg-rgb:30,37,48;--ink:#EAEEF4;--paper:#1E2530;--gold:#E8621A;--gold-light:#F07A37;--gold-pale:#B34208;--navy:#0F1B2D;--stone:#303C4A;--rule:rgba(15,45,74,.32);--ph1:#1B6B5A;--ph2:#2D5A8E;--ph3:#8B5E3C;--ph4:#9B2D3F;--ph5:#6B4C8A;--ph1-t:#1B6B5A;--ph2-t:#2D5A8E;--ph3-t:#8B5E3C;--ph4-t:#9B2D3F;--ph5-t:#6B4C8A;--serif:'Cormorant Garamond',Georgia,'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2',serif;--mono:'DM Mono','Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2','Menlo','Consolas',monospace;--sans:'Helvetica Neue',Arial,'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2','Symbola',sans-serif;--surface:rgba(var(--fg-rgb),.05);--border-faint:rgba(var(--fg-rgb),.15);--border-soft:rgba(var(--fg-rgb),.10);--border-softer:rgba(var(--fg-rgb),.07);--bg-card:rgba(var(--fg-rgb),.03);--bg-card-hover:rgba(232,98,26,.05);--bg-input:rgba(var(--fg-rgb),.05);--text-muted:#58656F;--text-fade:#58656F;--text-faint:#75808C;--shadow-card:0 4px 24px rgba(var(--fg-rgb),.10);--shadow-elev:0 10px 36px rgba(var(--fg-rgb),.16);--on-gold:#FFFFFF;--faint-rgb:88,101,111;--helper:rgba(var(--faint-rgb),.75);--ghost-border:rgba(var(--fg-rgb),.25);--chip-bg:rgba(var(--fg-rgb),.03);--chip-border:rgba(var(--fg-rgb),.18);--card-solid:#FFFFFF;--modal-bg:rgba(var(--bg-rgb),.92);--shell-border:rgba(var(--fg-rgb),.18);--shell-shadow:0 10px 36px rgba(var(--fg-rgb),.14);--arrow-bg:rgba(var(--fg-rgb),.03);--arrow-border:rgba(var(--fg-rgb),.16);--dot-idle:rgba(var(--fg-rgb),.12)}
```

**Dark theme block (verbatim):**
```css
[data-theme="dark"]{--text-mid:#B9C3CF;--ink:#242E3C;--paper:#F4F6F9;--bg-rgb:36,46,60;--fg-rgb:244,246,249;--faint-rgb:142,155,170;--stone:#9DAAB9;--head-blue:#38B5EF;--gold-text:#F07A37;--text-max:#FFFFFF;--gold-pale:#F07A37;--rule:rgba(130,165,205,.32);--ph1-t:#4FB39A;--ph2-t:#6B9FE0;--ph3-t:#C8956A;--ph4-t:#E07788;--ph5-t:#A688D0;--text-muted:#9DAAB9;--text-fade:#A8B3C1;--text-faint:#8E9BAA;--card-solid:#2C3846;--shadow-card:0 4px 24px rgba(0,0,0,.18);--shadow-elev:0 8px 40px rgba(0,0,0,.4);--shell-shadow:0 10px 36px rgba(0,0,0,.4)}
```

**Companion dark rules (verbatim):**
```css
[data-theme="dark"] textarea,[data-theme="dark"] input,[data-theme="dark"] select{color-scheme:dark}
[data-theme="dark"] .hero-bg::before{background:linear-gradient(90deg,rgba(13,17,23,.9) 0%,rgba(13,17,23,.55) 30%,rgba(13,17,23,.42) 50%,rgba(13,17,23,.6) 74%,rgba(13,17,23,.86) 100%)}
[data-theme="dark"] .home-plan{background:rgba(13,17,23,.6)}
[data-theme="dark"] .home-plan-num,[data-theme="dark"] .stat-num{color:var(--gold-light);text-shadow:0 1px 4px rgba(0,0,0,.6)}
```

**Channel doctrine (mandatory for dark mode to work):** every ink-family wash in the stylesheet must be channel-driven, never literal. Convert `rgba(30,37,48,` → `rgba(var(--fg-rgb),` and `rgba(234,238,244,` → `rgba(var(--bg-rgb),` **inside the `<style>` block only** — never inside JS/SVG builder strings (H7). After conversion, `grep -c 'rgba(30,37,48,'` on the style block must be **zero**.

**Old-theme residue sweep (the invisible-text bug class):** the black/orange modules use warm light greys as text (`#C7C0B5` and relatives) plus `text-shadow` on numerals — both correct on dark, invisible/wrong on light. Enumerate **every** hex literal in the stylesheet with its owning rule and rule each one: channel/token-driven, theme-invariant by design (accent golds, category colors, `#000` video wells, kraft/manila physical palette), or defect. Residue gates: zero `#C7C0B5`, zero `text-shadow` *except* the dark-scoped numeral rule above, zero solid `#FFFFFF` as `--bg-card` (the model card is a wash, `rgba(var(--fg-rgb),.03)` — a solid-white token here makes every card wrong; H5).

## Phase 2 — Theme mechanism

**First-paint script (verbatim; place in `<head>` before `<style>`; light default is the family ruling; swap the storage key):**
```html
<script>
/* Apply saved theme before first paint (default: light, per ruling). Key: dl-theme. */
try{document.documentElement.setAttribute('data-theme',localStorage.getItem('dl-theme')==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}
</script>
```

**Theme functions (verbatim; place at top level of the app script; swap the storage key):**
```js
function getTheme(){return document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light'}
function themeNavBtn(){return '<button class="btn-ghost pad-chip-md nav-action" onclick="toggleTheme()" title="Switch theme">\u25d0 '+(getTheme()==='dark'?'Light Mode':'Dark Mode')+'</button>'}
function toggleTheme(){var t=getTheme()==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('dl-theme',t)}catch(e){}render()}
```

**Toggle placement:** in the navRight builder, between Help and Notes, by splicing `'+themeNavBtn()+'` into the HTML string. The button renders ◐ Dark Mode / Light Mode and re-renders on toggle.

**Form controls:**
```css
textarea,input,select{color-scheme:light}
[data-theme="dark"] textarea,[data-theme="dark"] input,[data-theme="dark"] select{color-scheme:dark}
```

**Physical-surface exemption (family doctrine):** SVG-drawn surfaces (boards, clipboards, instrument sheets, kraft chips) are *lit physical objects* — their internal literals are exempt from theming and remain as designed inside dark chrome. Do **not** remap SVG builder colors. A true dark skin for any physical surface is a per-module design round for Paul.
> **⟶ SUPERSEDED for the Decision Lab — see §VI-9 (July 12): the DL's design round happened; its board family now goes fully dark via the vibe swap plus the scoped SVG remap. This exemption remains the default for modules whose round hasn't happened.**

**Two script blocks warning:** the first-paint script makes the file two-`<script>`; any syntax gate must check the **largest** block, and any pipeline must gate shipping on the test runner's *real exit status*, never through a pipe (H8).

## Phase 3 — Global chrome

**Nav (verbatim rules):**
```css
nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:18px 48px 18px 52px;display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;background:rgba(var(--bg-rgb),.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--rule)}
.nav-logo{font-family:var(--serif);font-size:24px;font-weight:500;letter-spacing:.12em;color:var(--paper);text-transform:uppercase;cursor:pointer;white-space:nowrap}
.nav-logo span{color:var(--head-blue);font-style:italic}
.nav-tabs{display:flex;gap:0;list-style:none;margin-left:auto}
.nav-tabs{position:absolute;left:50%;transform:translateX(-50%);margin-left:0}   /* later rule wins: tabs absolutely centered (family ruling); a responsive variant adds overflow-x:auto;flex-shrink:0 at narrow widths */
```
> **⟶ SUPERSEDED / UPDATED — see Part IV §R11. Absolute centering is now scoped to `@media(min-width:1480px)`; below that, tabs flow inline with `margin-left:auto` and the nav wraps. Unscoped centering collides with the right-side utilities between ~1101 and ~1480px.**
```
.nav-tab{background:none;border:none;font-family:var(--mono);font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--stone);padding:8px 16px;cursor:pointer;transition:color .2s;border-bottom:2px solid transparent}
.nav-tab:hover{color:var(--paper)}
.nav-tab.active{color:var(--gold-text);border-bottom-color:var(--gold-text)}
```
Tabs are **absolutely centered** (family ruling) — which means the right cluster only pins right via `margin-left:auto` on the navRight container:
```html
<div id="navRight" style="display:flex;gap:6px;align-items:center;margin-left:auto"></div>
```
**Right-cluster actions (compact model sizing) and the More menu:**
```css
.btn-ghost.nav-action{display:inline-flex;align-items:center;gap:2px;white-space:nowrap;flex-shrink:0;height:26px;font-size:10.5px;padding:0 10px;box-sizing:border-box}
.btn-ghost.nav-action-on{border-color:var(--gold-text);color:var(--gold-text)}
.nav-more-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:170;min-width:220px;background:var(--ink);border:1px solid var(--rule);box-shadow:var(--shadow-elev);padding:6px;display:flex;flex-direction:column;gap:2px}
.nav-more-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;cursor:pointer;color:var(--paper);font-family:var(--sans);font-size:14px;padding:9px 12px;transition:background .15s,color .15s}
.nav-more-item:hover{background:rgba(var(--fg-rgb),.06);color:var(--gold-text)}
.nav-more-ic{display:inline-flex;width:18px;justify-content:center;color:var(--stone);font-size:14px}
.nav-more-item:hover .nav-more-ic{color:var(--gold-text)}
.nav-more-danger{color:var(--ph4-t)}
.nav-more-danger:hover{background:rgba(155,45,63,.12);color:var(--ph4-t)}
```

**Base links:** `a{color:var(--gold-text);text-decoration:none;transition:color .2s}a:hover{color:var(--gold-light)}`

**Section grammar (every page header):**
```css
.section-label{font-family:var(--mono);font-size:15px;letter-spacing:.25em;color:var(--head-blue);text-transform:uppercase;margin-bottom:20px;display:flex;align-items:center;gap:12px}
.section-label::before{content:'';flex:0 0 28px;height:1px;background:var(--head-blue)}
.section-title{font-family:var(--serif);font-size:clamp(36px,4vw,60px);font-weight:300;line-height:1.05;color:var(--paper);margin-bottom:16px}
.section-title em{font-style:italic;color:var(--head-blue)}
.insights-section-title{font-family:var(--serif);font-size:28px;font-weight:400;line-height:1.15;color:var(--paper);margin:0 0 18px}
```

**Site footer (markup verbatim, after the app container; CSS below — no sidebar margins in single-user modules):**
```html
<footer id="appFooter" class="app-footer"><div class="app-footer-inner"><div class="app-footer-copy">&copy; 2026 Next Chapter, LLC. All rights reserved.</div><div class="app-footer-links"><a href="https://nextchapter.org/terms.html" target="_blank" rel="noopener">Terms of Use</a><span class="app-footer-divider">|</span><a href="https://nextchapter.org/privacy.html" target="_blank" rel="noopener">Privacy Policy</a></div></div></footer>
```
```css
.app-footer{border-top:1px solid var(--rule);background:var(--ink)}
.app-footer-inner{max-width:1280px;margin:0 auto;padding:28px 48px 92px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.app-footer-copy{font-family:var(--mono);font-size:14px;letter-spacing:.04em;color:var(--stone)}
.app-footer-links{display:flex;align-items:center;gap:14px;font-family:var(--mono);font-size:14px;letter-spacing:.08em;text-transform:uppercase}
.app-footer-links a{color:var(--stone);text-decoration:none;transition:color .2s}
.app-footer-links a:hover{color:var(--gold-text)}
.app-footer-divider{color:var(--rule)}
```

**Scrollbars ride `--rule`:**
```css
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--rule);border-radius:2px}
```

## Phase 4 — Home page

**Hero asset (H1 — read this twice):** the family hero webp has the artwork on the LEFT and a **cool pale-blue ground baked into its pixels** (`rgb(205,222,239)`). The old modules embed a variant with a flat **orange** ground — no gradient, mask, or reposition can fix that; the orange is in the pixels. Replace the data URI verbatim with the family asset (copy it from `decision-lab-index.html` or the deployed Pipeline styles.css). **Verify with pixels before shipping:** decode the embedded webp, sample the right band; mean warm score R−B must be **negative**. Treatment (verbatim):
```css
.hero{min-height:885px;display:grid;grid-template-columns:1fr 1fr;position:relative;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:url('data:image/webp;base64,UklGRnRYAgBXRUJQVlA4IGhYAgCwygadASqAByQEPjEYi0… ') left center/cover no-repeat}   /* plain cover, left-pinned; NO masks or width hacks */
.hero-bg::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(var(--bg-rgb),.93) 0%,rgba(var(--bg-rgb),.68) 30%,rgba(var(--bg-rgb),.58) 50%,rgba(var(--bg-rgb),.72) 74%,rgba(var(--bg-rgb),.91) 100%)}
.hero-eyebrow{font-family:var(--mono);font-size:15px;letter-spacing:.25em;color:var(--head-blue);text-transform:uppercase;margin-bottom:32px}
.hero-headline{font-family:var(--serif);font-size:clamp(40px,5.2vw,82px);font-weight:300;line-height:.96;margin-bottom:24px;color:var(--paper)}
.hero-headline em{font-style:italic;color:var(--head-blue)}
.hero-sub{font-size:18px;line-height:1.7;color:var(--stone);max-width:520px;margin-bottom:48px}
```

**The plan box** (rows may stay clickable — that is module function): container box + model row grammar, **plus the hero-scoped upsizing trio** — the deployed model renders plan text at 38/21/16 inside the hero over base 32/18/14, via scoped rules that anchored greps miss (H3):
```css
.home-plan{margin-top:30px;background:rgba(var(--bg-rgb),.72);border:1px solid rgba(var(--fg-rgb),.07);border-radius:8px;padding:2px 22px;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.home-plan-row{display:flex;gap:24px;padding:14px 0;border-bottom:1px solid var(--rule);align-items:start;cursor:pointer;transition:border-color .3s}
.home-plan-row:hover{border-color:rgba(232,98,26,.5)}
.home-plan-num{font-family:var(--serif);font-size:32px;font-weight:300;color:var(--gold-text);line-height:1;min-width:48px}
.home-plan-label{font-size:14px;line-height:1.6;color:var(--stone)}
.home-plan-label strong{display:block;color:var(--paper);font-family:var(--serif);font-weight:500;font-size:18px;margin-bottom:4px}
.hero .home-plan-num{font-size:38px;min-width:56px;color:var(--gold-text)}
.hero .home-plan-label strong{font-size:21px;margin-bottom:5px;color:var(--paper)}
```
Note the `--text-mid` token dependency (in the token blocks above). The model also shows a "The 90-Day Plan"-style heading above its box — per-module heading text is a **content decision for Paul**, not a styling default.

**Marquee (verbatim; 30s is the family speed):**
```css
.marquee-wrap{overflow:hidden;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px 0;background:rgba(232,98,26,.02)}
.marquee-track{display:flex;gap:0;animation:marquee 30s linear infinite;width:max-content}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.marquee-item{display:flex;align-items:center;gap:12px;padding:0 28px;font-family:var(--mono);font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:var(--stone);white-space:nowrap}
.marquee-dot{width:4px;height:4px;border-radius:2px;background:var(--gold);flex-shrink:0}
```

**Pullquote and the Why This Matters section:**
```css
.pullquote{font-family:var(--serif);font-size:clamp(22px,2vw,32px);font-weight:400;line-height:1.5;color:var(--paper);border-left:2px solid var(--gold);padding-left:32px}
.pullquote cite{display:block;font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--stone);text-transform:uppercase;margin-top:16px;font-style:normal}
.value-band{border-top:1px solid var(--rule);background:var(--ink);padding:100px 0}
.value-inner{max-width:1200px;margin:0 auto;padding:0 48px;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
```

**Card grammar (one grammar, three uses — entry cards, How-It-Works, ways-in):** wash ground, soft border, 24px padding, flex column, 12px gap, 160px min-height, 16px grid gaps; mono 13px `--gold-text` labels; serif 18/500 bodies; `card-arrow` links. Verbatim:
```css
.card{background:var(--bg-card);border:1px solid var(--border-soft);padding:24px;transition:background .25s,border-color .25s;position:relative;overflow:hidden;cursor:default}
.card:hover{background:rgba(232,98,26,.04);border-color:var(--rule)}
.card-link{cursor:pointer}
.card-arrow{display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;letter-spacing:.18em;color:var(--gold-text);text-transform:uppercase;transition:gap .2s;margin-top:auto}
.card-arrow::after{content:'\2192'}
.card-link:hover .card-arrow{gap:20px}
.how-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.how-cell{background:var(--bg-card);border:1px solid var(--border-soft);padding:24px;display:flex;flex-direction:column;gap:12px;min-height:160px;transition:background .25s,border-color .25s}
.how-cell:hover{background:rgba(232,98,26,.04);border-color:var(--rule)}
.how-num{font-family:var(--serif);font-size:32px;font-weight:300;color:rgba(232,98,26,.3);line-height:1}
.how-title{font-family:var(--mono);font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text)}
.how-desc{font-family:var(--serif);font-size:18px;font-weight:500;line-height:1.3;flex:1;color:var(--paper)}
.lib-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.lib-card{padding:24px;display:flex;flex-direction:column;gap:12px;min-height:160px}
.lib-tag{font-family:var(--mono);font-size:13px;letter-spacing:.12em;color:var(--gold-text);text-transform:uppercase}
.lib-title{font-family:var(--serif);font-size:18px;font-weight:500;line-height:1.3;color:var(--paper)}
.lib-body{font-size:16px;color:var(--stone);line-height:1.6;flex:1}
```
Do **not** port the old modules' hover lift or gold top-sweep onto `.card` — the model card has neither (the insight-card family keeps its sweep; they are different grammars).

## Phase 5 — Learn page

- Content wrap at the model's **1200px**. If the module's `.wrap` is shared with activity-page machinery (Decision Lab's board envelope), do **not** narrow it globally — scope it: `.wrap--content{max-width:1200px}` applied to the Learn (and ways-in) containers only (H6).
- Page rhythm: intro `margin-bottom:48px`; books block `margin-top:80px`; books title `margin-bottom:40px`.
- The intro paragraph must read **paper**, uncapped — the model never defines `.section-body`, so it inherits body color at full width. If the module defines one: `.section-body{font-size:16px;line-height:1.75;color:var(--paper)}`
- Article/book cards use the insight-card grammar below; grids stay two columns on Learn (no container declared there — that is correct and matches the model).

## Phase 6 — Insights page

**The insight family (verbatim — note badges/dates/CTAs are 13px, and `--mono` badges are INK, never white; white-on-chip is the invisible-outlet bug):**
```css
.insight-filter{background:none;border:1px solid rgba(var(--fg-rgb),.15);color:var(--stone);font-family:var(--mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;cursor:pointer;border-radius:2px;transition:all .2s;white-space:nowrap}
.insight-filter:hover{border-color:var(--fc,var(--gold));color:var(--fc,var(--gold))}
.insight-filter.active{border-color:var(--fc,var(--gold));color:var(--fc,var(--gold));background:color-mix(in srgb,var(--fc,var(--gold)) 12%,transparent)}
.insight-card{background:rgba(var(--fg-rgb),.04);border:1px solid rgba(var(--fg-rgb),.09);padding:22px 20px 18px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:background .25s,border-color .25s,transform .2s;position:relative;overflow:hidden}
.insight-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.16,1,.3,1)}
.insight-card:hover{background:rgba(var(--fg-rgb),.07);border-color:rgba(200,104,56,.28);transform:translateY(-2px)}
.insight-card:hover::after{transform:scaleX(1)}
.insight-badge{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:13px;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:2px;border:1px solid;white-space:nowrap}
.insight-badge--mono{background:rgba(var(--fg-rgb),.07);color:var(--text-max);border-color:rgba(var(--fg-rgb),.3)}
.insight-date{font-family:var(--mono);font-size:13px;color:var(--stone);letter-spacing:.06em;white-space:nowrap}
.insight-cta{font-family:var(--mono);font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text);transition:letter-spacing .2s}
.insight-card-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:10px;border-top:1px solid rgba(var(--fg-rgb),.07)}
```

**Scaffolding values (map onto the module's own class names; Decision Lab names shown):**
```css
.ins-page{padding:var(--nav-h,100px) 0 0}
.ins-hero{padding:48px 48px 0}
.ins-hero-title{margin-bottom:8px}
.ins-hero-sub{font-size:15px;color:var(--stone);line-height:1.7;max-width:560px}
.ins-tabbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding-bottom:24px;border-bottom:1px solid var(--rule)}
.ins-note{color:var(--stone);line-height:1.6;font-size:14px;max-width:680px;margin:0 0 6px}
.ins-body{padding:0 48px 80px;container-type:inline-size}
.ins-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:8px}
```
**Container queries are dead until a container is declared (H9):** the four-across layout requires `container-type:inline-size` on the insights body — verify the *declaration* exists, not merely the `@container` breakpoints (≥980px → 4 columns, ≤539px → 1). The Latest Thoughts intro sentence is the one-line 14px stone paragraph (`.ins-note` above).

## Phase 7 — Verification protocol

1. **Syntax gate:** extract the largest `<script>` block; `node --check`.
2. **Behavioral suite (jsdom):** port the Decision Lab suite's conformance/theme assertions — tokens present; badge ink; nav wash + blue span; footer mounted; label 15px blue; 13px insight family; light hero; right-pinned nav cluster; container declared; zero residue greys; text-shadow only dark-scoped; dark token block; first-paint script; toggle present *and* a behavioral round-trip (toggle → theme+storage+label flip → toggle back); channel conversion complete; font weight set loaded; plan box + hero-scale rules; marquee 30s.
3. **Pixel protocol (screenshot disputes):** the plan numerals are a built-in ruler — identical glyphs at CSS-identical size in both apps; measure glyph heights in captures. Shared chrome (nav tabs, More menu items) measures scale differences; if chrome is equal and a region differs, hunt a scoped rule (H3). Composite the hero stack (asset + wash gradients) in PIL and *look at it* before shipping hero changes.
4. **Measured identity:** report lines · bytes · md5 measured from the shipped file — placeholders first, measurement swapped in, never predicted.
5. **Beyond-list disclosure:** close out by declaring any change made outside the approved list.

---

## Hazard appendix — the traps, generalized

- **H1 · The asset, not the CSS.** If a color persists through every gradient/mask/position fix, decode the embedded image and sample its pixels. CSS cannot remove color baked into the source.
- **H2 · Inline styles beat the stylesheet.** Grep render JS for `style="` before trusting any CSS edit.
- **H3 · Scoped overrides evade anchored greps.** `.hero .x{…}` will not match `^\.x` — always grep unanchored for every occurrence of a class before asserting its rendered value.
- **H4 · Declared weight ≠ loaded weight.** Google Fonts serves only requested weights; `font-weight:500` without `0,500` in the link renders a 400 fallback. Verify the link, not the rule.
- **H5 · Solid token vs wash token.** One token (`--bg-card`) being `#FFFFFF` instead of `rgba(var(--fg-rgb),.03)` makes every card in both themes wrong. Check token *values*, not token *presence*.
- **H6 · Shared selectors have hidden dependents.** Before changing a global (`.wrap`), enumerate its consumers; scope the change if any consumer is tuned machinery.
- **H7 · Sweeps must be bounded.** Channel conversions run on the style block slice only; JS/SVG strings carry physical-surface literals that must not retheme.
- **H8 · Exit codes through pipes lie.** `runner | tail && ship` ships on tail's status. Capture the runner's status and gate shipping on it. Join dependent shell segments with `&&`, never newlines.
- **H9 · Breakpoints without a container are dead code.** `@container` rules require a declared `container-type`; verify the declaration.
- **H10 · Uploaded ≠ deployed.** When rendered reality contradicts the reference files, re-pull the *deployed* files before theorizing. And when count-asserting, expect responsive variants: target base rules by unique prefix, preserve the `@media` collapses.
- **H11 · Rules are permanent.** Recorded per-module rulings (insets, envelopes, clickable rows) survive conformance passes; a pass that "fixes" a ruling is a defect.


---

# PART II — ACTIVITY SURFACES
*Source: leadership-edge-activities-guide.md v1.0 (verbatim, with supersession markers).*

---

# Leadership Edge — Activity Surfaces Conversion Guide

**Version 1.0 · July 12, 2026 · Authority: The Decision Lab (Leadership Edge Module 1), shipped build md5 `6800f165cc0427c0df4aa450568d1041`**

This guide specifies how to rebuild a module's three activity surfaces — **Assess**, the module's **central activity page** (the Decision Lab calls its pair "Practice" and the decision board; your module will have its own names), and the **Dashboard** — in the Decision Lab's format: the board layout, the card system, the skeuomorphic visual logic, and the interaction doctrine. It is the companion to the chrome guide (`human-edge-restyle-guide.md`), which covers Home/Learn/Insights and global chrome. Read that first; this guide assumes its tokens (`--gold`, `--gold-text`, `--head-blue`, `--ink`, `--paper`, `--stone`, `--bg-rgb`/`--fg-rgb` channels, DM Mono + Cormorant Garamond + system sans) are already in place.

Where this guide states a number, it is measured from the shipped Decision Lab, not approximated. Where your module must differ, the guide says so explicitly and lists the decision as a **ruling to obtain** before you write code.

---

## 0. Program rename directive — apply before anything else

The program has been renamed: **"Human Edge" is now "Leadership Edge"** everywhere, in every module, in every case form. This includes the chrome guide itself — when using `human-edge-restyle-guide.md`, substitute "Leadership Edge" wherever it says "Human Edge," and treat the filename as historical.

In each module, inventory before changing: `grep -in "human edge"` against the full file. The Decision Lab had five sites; expect the same shape in every sibling:

1. `<title>` tag — `<title>The [Module] — Leadership Edge Module N</title>`
2. Home hero eyebrow — `NextChapter · Leadership Edge Program`
3. Board header cards (the SVG identity line, usually appearing **twice** — once in the central activity's header card, once in the front-page/cabinet header card) — `THE [MODULE NAME] · LEADERSHIP EDGE · MODULE [RN]` (RN = Roman numeral)
4. Help modal subtitle — `Leadership Edge · Module N`

Beware: strings inside JS builders hold **literal `\u00B7` escapes** for the middle dot. Match the escape, not the character. Confirm zero remaining occurrences after the sweep (`grep -ci "human edge"` must return 0).

---

## 1. Rulings to obtain from Paul before starting

These are module parameters this guide forbids you to invent:

1. **Accent pair and text-safe variants.** The Decision Lab wears the Pipeline orange family (`--gold`, `--gold-text:#B34208`, dark-mode `--gold-text:#F07A37`). Non-orange modules need their own `--gold`/`--gold-light`/`--gold-text`/`--gold-pale` set, with the text-safe dark variant explicitly approved.
2. **Category color map** (if the module has categories). Decision Lab's ruled set: Career `#2D5A8E`, Strategy `#6B4C8A`, Investment `#1B6B5A`, Team `#8B5E3C`, Product `#076D9E`, Personal `#9B2D3F`, Other `#58656F`.
3. **Storage keys.** Follow the module's prefix pattern (Decision Lab: `dl-v9` app state, `dl-theme`, `dl-zoom`, `dl-rail-min`, `dl-lastnotif`). Never reuse another module's keys.
4. **Vocabulary.** Every module has its own object metaphor (files/decisions in DL). What is a "unit of work" called? What does the closing stamp say? DL's ruled stamp text is **DECISION CLOSED**; the status vocabulary rulings from July 12 are: stat tile **DECISIONS CLOSED**, resolved-row caption **Decision Closed**, activity phrase **Filed Decision Closed**. Get the module's equivalents ruled line by line — do not transliterate.
5. **The module's seed data** (demo content) — extract, get line-item approval, implement verbatim. The standard content-change protocol applies to every user-facing string in this guide.

---

## 2. Architecture and page skeleton

Every activity page renders inside the standard app shell (`render()` dispatch on `currentPage`, single `#app` div, one `<style>` block, two `<script>` blocks — first-paint theme + app). Activity surfaces are **SVG boards rendered into an HTML stage**:

```
<div class="board-stage [view-files]" id="boardStage">
  <div class="board-layout">
    <aside class="drawers"> …in-board nav + drawer list + board tools… </aside>   ← central activity only
    <div class="board-pane" style="flex:1;min-width:0;position:relative">
      <button class="stage-btn" id="stageBtn" onclick="toggleStage()">⛶  Full screen</button>
      <div class="board-shell" id="boardShell"></div>
      <div class="chart-hint" id="hintRow"></div>                                  ← central activity only
    </div>
  </div>
</div>
```

Key stage CSS (verbatim family standard):

- `.board-stage{margin:26px 0 60px}` · `.board-layout{display:flex;gap:22px;align-items:flex-start}`
- `.drawers{width:226px;flex-shrink:0;position:sticky;top:96px}` — the sidebar is a **standing ruling** (drawers, not a rail). `.board-stage.view-files .drawers{display:none}` hides it on the front/cabinet page.
- Breakout: `@media(min-width:1560px){.board-stage:not(.stage-full){width:calc(100% + 192px);margin-left:-96px}}` — the board escapes the 1280 wrap symmetrically at wide viewports. **The 1280 `.wrap` is the board envelope (ruling); content pages use the scoped `.wrap--content` at 1200.**
- Fullscreen: `toggleStage()` toggles `.stage-full` (fixed, `height:calc(100vh - 66px)` layout); **Escape exits**; a keydown listener on document handles it. Every activity page carries the `stage-btn`.
- Responsive: `@media(max-width:1080px){.board-layout{flex-direction:column}.drawers{width:100%;position:static;display:grid;grid-template-columns:1fr 1fr;gap:8px}}`.
> **⟶ SUPERSEDED / UPDATED — see Part IV §R4 and §R10. The column block **must** carry `align-items:stretch` and `.board-pane{width:100%}` (without them the SVG collapses to its 300px intrinsic width), and drawers are now **removed entirely** (`no-drawers` class) whenever they would stack above the board at this boundary.**


**Drawers content (central activity):** a `#bnav` block captioned `THE [MODULE NAME]` listing the six page tabs as `.bnav-it` buttons (active page gets `.on`), then `#drawerList` (the module's section drawers), then `#drawerUtils` captioned `BOARD TOOLS` with AI Guide / Help / Notes buttons that call `toggleStage()` first if fullscreen. Navigation from inside the board goes through `bnavGo(page)`, which exits fullscreen before `go(page)`.

**Zoom** (`dl-zoom` pattern) and the coach FAB, notes panel, and help modal are chrome-guide territory and unchanged here.

---

## 3. The board SVG system — the heart of the format

### 3.1 Design intent (so you don't sand it off)

The boards are **skeuomorphic physical surfaces**: a corkboard-like decision board, a filing cabinet of manila folders, a clipboard instrument, a pinned dashboard. The design began as a deliberately retro evidence-board (kraft paper, tape strips, rubber stamps, 40s–60s cream/brown) and was then contemporized for corporate/government audiences — same object structures, cooler palette, subtler jitter, rounded "rail" card treatment. The objects survived the restyle on purpose: folders have tabs and paper-edge slips, completed work gets **stamped**, cards are **pinned**, threads connect evidence. Keep the physicality; it is the product's signature.

**Physical-object doctrine (standing ruling):** SVG-drawn surfaces are lit physical objects. Their internal color literals are **exempt from dark-mode theming** — the board stays lit inside dark chrome. Do not channel-convert colors inside SVG builder strings. (A true dark board is a separate future design round.) All *CSS* washes outside the SVG must remain channel-driven (`rgba(var(--fg-rgb),…)`).

### 3.2 Coordinate system and mounting

Boards are built as strings: `'<svg viewBox="0 0 1500 H" xmlns="http://www.w3.org/2000/svg">' + boardDefs() + boardSurface(1500,H) + content + '</svg>'`, assigned to `boardShell.innerHTML`. Width is always **1500 units**; height is computed from content (a running `y` cursor; the dashboard ends `var Ht=y+30`). The central board may use a fixed H; list/stacked boards compute it.

Interactive elements are `<g id="…" class="bd-click" data-…>` groups. **Wiring happens after mount**: query the shell for the id patterns and `addEventListener('click', …)` — SVG strings carry no live handlers. Re-render locally by rebuilding `boardShell.innerHTML` and re-wiring; **never rebuild the page chrome for an in-board interaction** (see §10).

### 3.3 The vibe token object (V)

All physical styling flows through a single vibe object applied by `applyVibe()` from a `VIBES` table. The active contemporary vibe drives:

- `V.rx` — board surface corner radius; `V.rotM` — global rotation multiplier (jitter scale; the retro vibe used larger values)
- `V.rail` — boolean: contemporary "rail" treatment (rounded cards, colored top rail bars, soft strokes) vs. retro (square, ink strokes, tape)
- `V.cardRx`, `V.cardSW`, `V.cardSWH`, `V.cardStroke` — card corner radius and stroke weights (normal/heavy)
- `V.white`, `V.pull` — card white and pull-tab fills; `FMAN`/`FMAN_D` — manila folder fills
- `V.tape` — boolean; retro tape strips vs. pins on header cards
- `V.folderCols` — the category color map (null in retro = manila everything)
- `V.stamp` — `'single'` (one rounded rect) vs. double-rule stamp variant
- Pin color slots: `V.keypin`, `V.qpin`, `V.ghostPin`, `V.resPin`; semantic colors `V.p1`, `V.green`, `V.goldT`, `V.red`, `V.slate`, `V.purple`
- Ink constants: `INK` (board ink), `GOLDT`, `REDI` (stamp red), `SLATE`, `P1..P3` (part colors), `BOARD` (surface fill)

Port the whole mechanism; per-module differences should be *new vibe values*, not scattered literals.

### 3.4 Card grammar

- **Rect:** `bdCardRect(x,y,w,h,fill,heavy)` — rounded per `V.cardRx`, stroked per vibe.
- **Rail bar:** `railBar(x,y,w,col)` — the 3.5-unit colored strip inset 1px along the card top (rail vibe only). Every meaningful card carries one in its semantic color.
- **Pin:** `pin(cx,cy,color,pulse)` — the pushpin dot at the card's top center (or `tape(x,y,len,rot)` in retro vibes). Pin color communicates status.
- **Rotation jitter:** cards sit slightly off-axis. Grid items use the formula `((idx%3-1)*1.1+(idx%2?0.4:-0.3))*V.rotM` degrees about the card center; singleton cards use fixed small values (±0.2–0.9 · `V.rotM`), alternating sign between neighbors. Never render a grid perfectly straight.
- **Drop shadows — the filter-demotion rule (hard-won, do not regress):** shadows come from a shared `#cardsh` filter in `boardDefs()`. **Never place `filter="url(#cardsh)"` on a group that contains `<text>`.** Filtered groups rasterize as a layer and the text goes soft ("text fuzz"). The pattern is always: outer positioning/rotation group → inner `<g filter="url(#cardsh)">` containing **shapes only** → close it → then text siblings. The Decision Lab needed a 28-site surgery to fix this; build it right the first time.

### 3.5 Standard card fixtures

- **Header card** (top center of each board): 404×78 at x=548, rotated −0.5·rotM. Line 1: identity in DM Mono 9.5/ls2 caps (measured: the cabinet header variant carries opacity 0.7; the board header variant carries no opacity attribute) — `THE [MODULE] · LEADERSHIP EDGE · MODULE [RN]`. Line 2: the board's name in Cormorant Garamond 25/ls6 caps. Line 3: an italic 13 subtitle. Tape or key-pin on top per vibe.
- **Question/title card** beneath it: 540 wide centered, 56 tall — small caps label (`THE QUESTION`) + the live title in serif.
- **Column headers:** `columnHeader(cx,y,label,color,num)` — a part-colored roundel with a Roman numeral above a DM Mono caps label with a colored underline dash.
> **⟶ SUPERSEDED / UPDATED — see Part VII §VII-2 (July 13): the caps label is now Cormorant Garamond 20/500, letter-spacing 4; the roundel and underline are unchanged.**
- **Key/legend card** bottom-right where the board needs one.

### 3.6 Typography inside boards

- **DM Mono** for labels, badges, stamps, metadata. Working sizes after the July 12 readability pass: section headers inside cards 13/ls2; page-level section headers 15/ls2 centered at x=750; tile descriptors 11.5/ls1.8; chips 10; tiny metadata 7.5–11.
> **⟶ UPDATED — see Part VII (July 13): board column headers and exhibit-card head labels moved off DM Mono to Cormorant Garamond. DM Mono remains for badges, stamps, chips, tag pills, flags, corner letters, pull tabs, and metadata.**
- **Cormorant Garamond** for display numbers (stat tiles 64), row titles (19), quotes and captions (italic 16–18).
- **Helvetica Neue, Arial** for body text — **18** is the standard body size on all activity cards (the "Assess scale"; the dashboard was raised to match on July 12). Body line pitch 24.
- **Minimum readable floor:** nothing user-facing below ~11 except intentionally tiny folder-tab metadata (7.5).
> **⟶ SUPERSEDED / UPDATED — July 12 evening floor pass (Part IV §R5–R6, Part V §V4). Current measured wide-build values: in-card section headers 18/ls1.5–2; page-level section headers 22/ls2.5; stat-tile descriptors 18/ls1.4; category chips 15/ls1; dashboard and Assess captions/subtitles are regular serif 20–21 — italics on those surfaces were removed (the board header-card italic 13 subtitle and the board voice cards remain italic by design). The ~11 floor is superseded on Dashboard and Assess by the 18u floor; the cabinet furniture floor is ruled (Paul, July 12): **leave as is — intentional small print** (tab 10, ANALYSIS DEPTH 7.5, date 8.5, captions 12); the genuine reading-text defect was already solved by R9's full-title-on-body. Dashboard loop thumbnails stay miniatures under the same ruling.**

### 3.7 The width-aware wrap core (mandatory — no character counting)

Text fill is measured, never guessed. Port these three window-global pieces verbatim:

- `HELV_W` — a per-mille advance-width table for Helvetica glyphs (fallback 556 for unknown glyphs).
- `textW(s,size,fam,ls)` — string width in SVG units. `fam`: `0` sans (table-driven), `1` mono (flat 600‰), `2` serif (table × 0.88). `ls` adds letter-spacing × (len−1).
- `wrapText(s,budgetPx,maxLines,size,fam)` — greedy wrap against a **pixel budget**, preserving ellipsis semantics on overflow at `maxLines`.

Every text region gets a true budget (card width minus real insets). Decision Lab's ruled budgets, as calibration examples: board voice cards `c.w−26, 3 lines, 14.5, fam 2`; board body cards `c.w−26, maxL, 10.5, fam 0`; assess option blocks `w−70, maxL, 18, 0` (maxL: 3 wide, 4 mid, 6 narrow — Part V §V3); scenario `cw−80, 3, 27, 2` (wide; 24 mid / 22 narrow); guidance `588, 6, 18, 0`; narrative `384, 7, 18, 0` on a 26 pitch; profile quote `1236, 5, 22, 2` on a 28 pitch; dashboard profile cards `594, 12, 18, 0`; playbook quotes `1196, 4, 22, 2` on a 28 pitch. Card heights must be **computed from wrapped line counts** (`lines×24 + header + padding`), never fixed when content varies. Your harness should assert greedy-optimal fill using the page's own `textW` (no line exceeds budget; no next-word would have fit).

Stamp boxes are sized the same way: `textW(stampText, size, 1) + (len−1)×ls` plus margins. DECISION CLOSED at 42/ls9–10 needs a 560/576-wide box; at 12/ls3 a 200/204 box; on the R9 loop thumbnails the stamp is 8/ls0.8 in a 116×22 box.

---

## 4. The cabinet — the activity front page

The module's front activity page is a filing surface listing every unit of work (`view-files` stage, no drawers). Anatomy, top to bottom:

1. **Header card** (§3.5) titled for the collection (`THE DECISION FILES`), subtitle italic.
2. **New-item CTA:** a manila folder-with-index-card, 520 wide centered at y=138 — folder tab path, body, index-card slip, accent outline, DM Mono 11.5/ls2.5 call to action + italic serif "open a fresh file →". Clicking opens the creation modal.
3. A hairline rule at y=308, then the **grid**: 3 columns at x = 96/560/1024, row pitch 196, first row y=352. Items are **status-sorted: active, then decided, then resolved.** Six show collapsed; a kraft **pull tab** (210 wide, centered, `▾ SHOW ALL (n)` / `▴ SHOW FEWER`) expands to all, padding the last row with dashed **ghost slots** ("awaiting a decision", 0.4 opacity).
4. **Folder anatomy** (380 wide, 26 tab + 118 body): tab path with the title in DM Mono 10/ls0.8 caps truncated to 30 chars (white on category color, ink on manila); two paper-edge slips peeking above the body right of the tab; body white with a 0.07-opacity category tint; category chip (outlined, category color) and date · age top row;
> **⟶ SUPERSEDED / UPDATED — see Part IV §R9. Truncated tab titles are banned: the **category** goes on the tab, the **full question** goes on the body (sans 15.5u × 2 lines, budget w−32), the category chip is removed, and the date moves to the bottom-right corner.**
 then the status block:
   - **Active:** Analysis-style percentage in Cormorant 34 (category color), tiny caps descriptor, hairline progress bar (category color), italic "in progress".
   - **Decided:** caps `AWAITING DEBRIEF` in slate, italic "come back once you have lived with it", and the small circular **DECIDED** roundel seal (r24, rotated), stamp-red.
   - **Resolved:** the miniature closing stamp (module's ruled text; DL: **DECISION CLOSED**, 12/ls3 in a 200/204-wide rotated box).
   - Pin color: active = category color, decided = stamp red, resolved = `V.resPin`.
5. Height formula: `gy0 + rows×196 + (n>6 ? 70 : 40) + 40`.
6. Wiring: folder click → `go('detail', id)`; pull tab toggles `filesExpanded` and re-renders locally.

Above the stage, the page carries the section label and a collapsible intro-video `<details class="video-collapse" open>`.

---

## 5. The central activity board

### 5.1 Header band (July 12 spec — replaces any stacked header)

The detail page loses its multi-row header. One grid band, bottom-aligned onto the board's top edge:

```
.det-band{display:grid;grid-template-columns:224px 1fr auto 1fr;align-items:end;gap:24px}
```

- **Column 1 (224px):** the back button, left edge flush with the drawers (224 + 24 gap = the 248 pane inset; at ≥1560 the band takes `margin-left:-96px;margin-right:-96px` to ride the breakout). Lifted `padding-bottom:24px` to sit level with the tag row. **Label is dynamic:** scan `navHistory` from the top, skipping `page==='detail'` entries; first real page `'dashboard'` → `Back to Dashboard`, otherwise → `Back to [Collection Name]` (DL: `Back to Decision Files`; title case, ruled).
- **Column 2:** a stacked left group, bottom-anchored (`padding-bottom:4px`): category chip row (plus Resolved chip when relevant) **above** the mono 12 date · age line.
- **Column 3:** the title — serif `clamp(28px,3vw,42px)`, weight 300, centered, `max-width:580px` so long titles wrap to two lines. Because the band spans exactly the board pane, its center **is** the board's center; the title lands over the header card by construction. Do not center by translate offsets — that caused collisions.
- **Column 4:** the gauge (`.gauge-wrap`, right-aligned text), flush with the board's right edge.
- `.det-band + .board-stage{margin-top:8px}`; ≤1080 the 224 column becomes `auto`; ≤900 the band stacks centered.

### 5.2 Board anatomy

- **CARDS geometry table:** every exhibit card is a row in a `CARDS` array — `{key, sec, letter, label, x, y, w, h, rot, stockK, headK, …flags}`. All layout is data. Columns group by part; column headers per §3.5.
- **Threads:** evidence connections drawn from card pin-points (`pinPt = [cx+w/2, y+8]`), curved (`threadPath` with slack unless `taut`), with chevrons; animated for cards in `pendingAnim`.
> **⟶ SUPERSEDED — see Part VII §VII-4 (July 13): process lines are orthogonal flow-chart elbows built by `procLine` (the curved `threadPath` family was excised in §VI-10); solid/dashed/faint state semantics, arrowheads, and thread animation are unchanged. §VII-8 (same day) refines further: short hops ≤130 units run straight, long tracks carry mid-path direction arrows.** Threads live in a dedicated `<g id="threads" style="pointer-events:none">` and only appear on the central board (no thread on cabinet/dashboard, per design logic).
- **Exhibit card states:** empty (dashed, "to be filed — open the log", OPEN chip), filled (content wrapped per §3.7, stamped corner letter, category-appropriate paper stock via `stockK`/`headK`), plus `voice`/`ruled`/`tag` variants.
- **Completion semantics (module doctrine):** every section is freely navigable; completion is an explicit stamped act (gated Mark Complete), never a lock. Derive "current section" from the data; never render `.locked`.
- **Closing stamp:** when the whole item resolves, `loopClosedStamp()` (rename per module vocabulary) — the big rotated stamp across the board, text at 42/ls9–10 in a 560/576 box, `MMXXVI` beneath, `pointer-events:none`.

### 5.3 Start Here — first-visit affordance (July 12)

On first arrival at a **newly created** item's board: a stamp-red hand-drawn ellipse around the first card (`rx = w/2+26, ry = h/2+24`, rotate −3, stroke 3), a curved arrow with a solid arrowhead pointing at it from the corridor to its right, and `START HERE` in DM Mono 13/ls2. Gating: show only when `!item._boardIntroSeen && !item.description && first section not complete`; set and persist the flag on first render; a runtime `bdIntroShow` keeps it visible until the first card is opened (`tryOpen` clears it); it never returns, and it never retro-fires on seeds or in-progress items. Position the arrow/label inside the empty corridor between column 1 and column 2 — verify by render that nothing collides.

### 5.4 The focus reel (card working surface)

`tryOpen(sec,key)` opens the reel; `renderFocus()` composes: close button, case-file tag, part eyebrow (`Part N · Name · Step i of n`), title with an italic emphasis word, subtitle; then the media stack — **first-pass video auto-open** (per-part `_vidSeen` map, persisted; later passes collapse to a `Watch · Part N` slip), the **method carousel** (teaching content; auto-open on Q1 of uncompleted sections when no video), and the **worked-example slip** *(removed July 12 by Paul's ruling — the example doesn't work without fuller context; `SECTION_EXAMPLES`, the spec-box renderer, and `toggleSpec` are retained dormant as the one-line restore path, see §VI-10)*; then snapshots of prior answers where the section declares them; then the question: `Q# label`, textarea bound through `setField`, and the nav row.

**Progress indicators are position indicators (ruling):** the counter reads `(focusQ+1)/total` and advances on arrow click; dots keep the gold `filled` state for answered questions and mark the current question with a ring — `.flow-progress-dot.current{box-shadow:0 0 0 1.5px var(--part-c,var(--gold))}`. Typing must not mutate the counter.

The Mark Complete button is gated on all fields answered ("File the Exhibits — Pin to Board →"; the final section seals: "Close the Case — Seal the File"); completing stamps the section, pushes its cards to `pendingAnim` for thread animation, advances `currentSec`, and on the final section sets `resolved`.

Any AI seams (challenger, coach, profile) route through the single `CLAUDE_API_URL` constant — never hardcode endpoints (AWS deployment ruling).

---

## 6. The Assess instrument

Assess is a **clipboard**: an original drawn instrument, not a card grid.

- **Intro sheet:** 700×590 sheet at cx=400 in a 1500×720 board; title, wrapped subtitle (budget 560, 3, 17), and the five **dimension pairs** rendered as centered rows (2/2/1) using measured mono widths — the pairs must sit inside the sheet (assert with `textW`).
> **⟶ SUPERSEDED / UPDATED — see Part V. Subtitle budget is now `560, 3, 18`; the dimension pairs render as a single centered column of five 18u/ls1 lines on a 34 pitch (paired rows no longer fit at floor size); the scenario and captions are regular (de-italicized) with the caption at 20u; option blocks wrap at 18 with a per-tier maxL; and the whole instrument now ships three tiers.**
- **Question flow stays in place:** answering re-renders the clipboard only; **fullscreen persists across the whole sitting** and page chrome is untouched (the suite asserts video-node identity across answers). Ten questions, each an `aopt-{q}-{val}` option block (measured wrap, selection tint), `QUESTION i OF 10` progress.
- **Results:** scores per dimension (0–100 poles), archived to history on completion; a history rail (`ahist-*`) opens past sittings with a back-to-latest control; retake resets in place.
- **Radar (bdRadar) — the two-label doctrine (ruling, July 12):** the builder takes `(cx,cy,r,scores,color,fillCol,fs,lift)`. Pentagon from −90°, four grid rings, spokes, data polygon with dots (min magnitude 0.04). Labels at radial r+14, DM Mono 13×`fs`:
  - **Assess results call passes `lift=true` (the rogue):** top label above (−8), **side labels overlap the chart** (−8; forced by the sheet's size — this is intentional and unique to Assess), bottom pair dropped clear below (`+13×fs`).
  - **Everywhere else (dashboard) omits `lift` (the norm):** side labels anchor **off their vertices** — right vertex `text-anchor="start"` at vertex+12, left vertex `text-anchor="end"` at vertex−12, baseline vertex+4.5 — all five labels free of the chart, vertex-aligned.
  - Never move the five labels as a rigid frame; place per vertex.
- Results assembly: guidance card (x 430–1070, text x=456, body 18, greedy-fill asserted), narrative cards (420 wide, text x=nx+18, 18/26 pitch), past-assessments stack, reflections; results viewBox height is dynamic.
- Assess results radar scale: `fs=1.6`, r=172 (labels render at font-size 20.8 — the suite checks this exact value).

---

## 7. The Dashboard

Top to bottom, with the July 12 readability sizes:
> **⟶ SUPERSEDED / UPDATED — the sizes in the numbered items below are v1.0's, pre-dating the evening floor pass. Current measured wide-build values: §7.3 descriptors DM Mono 18/ls1.4 (no opacity); §7.4 section header 18/ls2 with a regular serif 21 subtitle (not italic 17); §7.5 WRITTEN PROFILE header 22/ls2.5, quote regular serif 22 on a 28 pitch (budget 1236, max 5), profile-card headers 18/ls1.5 (bodies 18/24 unchanged); §7.6 playbook header 22/ls2.5 with a regular 21 subtitle, entry title row mono 18/ls1, quotes regular serif 22 on 28 (budget 1196, max 4), roundel numerals 10 (furniture); §7.7 activity header 18/ls2, row titles sans 18, age mono 14 at 0.8; loop header 18/ls2, loop caption regular serif 21 (not italic 16); §7.8 header 22/ls2.5, rows on a 76 pitch (not 70), title serif 19 (truncate 34), chip 15/ls1 (width len×10.8+22), status caps 15, nudge line mono 15/ls0.8, status caption regular serif 20 at 0.85, date and counter mono 15. Structure and mechanics below remain accurate; sizes defer to this marker and Part V §V8's residue record. Header and card-head FONTS in the sizes above are further superseded by §VII-7 (July 13): section headers and card heads are now Cormorant Garamond.**

1. **Title:** `YOUR DECISION PROFILE` equivalent — Cormorant 30/ls5 centered at x=750 with an underline rule 540–960.
2. **CTA card** (only until the assessment exists): full-width 1300×80 card with accent edge-bar and a pill button (`TAKE THE ASSESSMENT`).
3. **Stat tiles:** four 300×140 cards at x = 90 + i×350, alternating jitter. Number Cormorant **64**, `text-anchor="middle"` at tile center (tx+150), baseline ty+90; descriptor DM Mono **11.5**/ls1.8 centered at ty+120, 0.6 opacity. Descriptors are ruled vocabulary (DL: DECISIONS OPENED · DECISIONS CLOSED · AVG DAYS TO CALL · AWAITING DEBRIEF — hardcoded caps). **64 units of clear space** follow the row (`y+=204` after 140-tall tiles).
4. **Radar pair:** centered section header at x=750, DM Mono **13**/ls2, with the italic serif subtitle centered beneath at **17**, full ink; then two 630×430 cards (x=100 and x=770 — combined center 750), each with a centered mini-caption in its accent, `bdRadar(cx+315, ry+235, 132, …)` **without** `lift`.
5. **Written profile:** section header centered at 750, DM Mono **15**/ls2 (this is the page-section header scale; YOUR PLAYBOOK and ALL DECISIONS match). Quote box 1300 wide, tinted paper, accent edge-bar, italic serif 18 on 26 pitch (budget 1236, max 4). Then the four profile cards, 630 wide, 2×2: header DM Mono **13** in the card's semantic color with icon, body sans **18** on 24 pitch (budget 594, max 12), **row heights computed from wrapped line counts** (`max(lines)×24+72`).
6. **Playbook:** centered header + centered italic subtitle (17, full ink). One 1300-wide card; entries are numbered roundels on a connector line, title row DM Mono 11.5 caps · date, quote italic serif **18** on 24 (budget 1196, max 3), **entry heights computed per entry** — never a fixed pitch, never ellipsize a lesson.
7. **Recent activity + Learning loop** side by side (630 each). Activity: header 13; rows on a 72 pitch — dot in category color, sans **16** title — grey phrase, mono **11** age, hairline separators; rows click through. Learning loop: header 13 (`THE LEARNING LOOP · CLOSED FILES` — concept name kept by ruling); **miniature folder thumbnails**, not bare stamps: 176×82 folders (tab path 112 wide in category color with the title at 7.5 caps, white body with tint wash, the closing stamp at 8.5/ls1 in a 132×26 rotated box, month bottom-right), one per resolved item (up to 3), clickable.
> **⟶ SUPERSEDED / UPDATED — see Part IV §R9. Thumbnails are now 186×118 with the **category** on the tab and the **full title** on the body at 13.5u × 3 lines (budget 158), stamp beneath, month in the corner.**
 Caption italic 16: DL's ruled line is **"Every closed file adds a lesson to your Playbook."** — the previous claim about feeding future debrief cards was factually false; verify any equivalent claim in your module against its actual data flow before writing it.
8. **All decisions:** centered 15 header; 1300-wide card; rows on a **70** pitch: serif **19** title (truncate 34), outlined category chip (10/ls1, width `len×7.5+18`), status caps at 10 (`RESOLVED`, `MIND CHANGED`), second line = nudge (mono 11, nudge color) or italic 13.5 status caption (ruled vocabulary), mono 11 date, 140-wide progress bar in category color, `done/total` counter. Nudged rows get a colored border + edge bar.
9. **Reminders:** the functional box is **HTML above the SVG**, gated on `Notification.permission==='default' && nudges.length`; Enable calls `requestNotifPermission()`; thereafter `checkNudgeNotifications()` fires at most one browser notification per day on app load (localStorage throttle). Note: no service worker — reminders fire only when the app opens. The Decision Lab also contains a **dead SVG twin** of this box gated on `notif:false`; do not port it.
10. **Profile generation** (`profileBtn`) re-renders the shell locally and must keep fullscreen (suite-asserted).

---

## 8. Interaction doctrine (rulings — apply everywhere)

1. **Hover must never move hit geometry.** `.bd-click:hover{filter:drop-shadow(0 10px 14px rgba(var(--fg-rgb),.22))}` — no translate, no scale. A hover lift at a card edge strobes (lift → pointer exits → drop → re-enter, indefinitely). Feedback is shadow/stroke/opacity only. Keep the `prefers-reduced-motion` block.
> **⟶ SUPERSEDED / UPDATED — see Part IV §R7. The doctrine is refined: the hover **boundary** must never move, but visuals may — each card carries a stationary invisible hit rect and a `.bd-lift` layer that rises −4px on hover. Shadow-only feedback is no longer the standard. Standing ruling: interaction/animation behavior changes require Paul's explicit approval; fixing a defect never licenses removing the feature.**

2. **Fullscreen persists through in-activity interactions.** Answering, regenerating, stepping — re-render the shell, never the page.
3. **Progress counters are position indicators**; answered-state lives on the dots.
4. **Free navigation, explicit completion** — no locks.
5. **Inline styles in render JS beat the stylesheet.** When a rendered size disagrees with CSS, grep the builders.

---

## 9. Validation stack and working protocol

- **Behavioral harness (jsdom):** boot the full file with `runScripts:'dangerously'`, stub `fetch`, `matchMedia`, media `load/play`, rAF. Assert seeds, navigation, every activity's lifecycle (cabinet expand, folder→board, focus reel round-trips including store+localStorage write-through, assess sitting under fullscreen with chrome-identity checks, dashboard counts and profile guard), plus conformance greps against the style block. The Decision Lab suite is 138 assertions; treat it as the template.
> **⟶ SUPERSEDED / UPDATED — the suite is now 182 assertions (tier matrix, drawers policy, wide-board structural guards per Part IV §R8/§R12, plus the Assess floor and tier pins per Part V §V7) and ships as an artifact: `module_smoke.js` (365 lines · 31,610 B · md5 `c1aef165ed3604d555eae5e0cf25f5a3`), invoked `node module_smoke.js <build-path>`. The suite is the ship gate — extended as behavior lands, never pruned.**

- **Syntax gate:** files have **two script blocks** — extract the **largest**, `node --check` it. Shell is `sh`: no process substitution; temp files; `&&`-join every dependent step **including the edit itself** — an edit that aborts must prevent the suite/ship steps from running.
- **Render verification:** every SVG change is rendered before shipping. Standard: strip ` filter="url(#…)"` attributes, swap fonts `Helvetica Neue,Arial→Liberation Sans`, `DM Mono→Liberation Mono`, `Cormorant Garamond→Liberation Serif`, render with `@resvg/resvg-js` (`fitTo width 1500`, system fonts). Note Liberation Serif runs wider than Cormorant — near-edge serif lines in renders usually have real margin in the browser.
- **Edits are count-asserted string replacements** (exactly the expected count or abort and inspect). Source JS holds literal `\uXXXX` escapes — match the escape. Anchors are read verbatim from disk, never reconstructed; JSON-encoded tool output shows `\"` where the file has `"` — check with a plain view before concluding.
- **Ship gate:** run the suite to a file, test the real exit code, only then copy to outputs. Measure identity (lines · bytes · md5) **from the shipped file**.
- **Content protocol:** inventory from the live build → line-item approval → verbatim implementation of affirmed lines only → beyond-list disclosure at close-out.
- **Banned word:** "quietly" never appears in any copy.

---

## 10. Decision Lab reference identity

All numbers in this guide were measured against the shipped build of July 12, 2026: `decision-lab-index.html`, 3,627 lines · 554,798 bytes · md5 `6800f165cc0427c0df4aa450568d1041`, suite 138/138.
> **⟶ SUPERSEDED / UPDATED — current reference build (July 12, late evening): 4,064 lines · 593,660 bytes · md5 `b793003c1a57cc61593517afcb6ee94e`, suite 182/182. Part IV patterns were measured against the 3,903-line predecessor (md5 `5a2724e9c34d4307ba27557c7cd97562`) and remain valid in the current build; Part V patterns are measured against the current build.**
 When rendered reality disagrees with this guide, re-pull the deployed Decision Lab and check the code before theorizing.


---

# PART III — AWS DEPLOYMENT SEAM
*Source: human-edge-aws-seam-guide.md (verbatim).*

---

# Human Edge Modules — AWS Deployment Seam Guide (Modules 2 & 3)

**Purpose:** bring a Human Edge module's API wiring into line with the family standard for AWS deployment, exactly as done for the 90-Day Innovation Pipeline (the origin of the convention) and the Decision Lab (Module 1, the Human Edge reference implementation, July 2026). Hand this document to the chat doing the work; the wiring blocks below are extracted **verbatim from the shipped Decision Lab build** and must be installed byte-identically so every module deploys the same way.

**Scope (Paul's standing ruling from the Decision Lab port):** Human Edge modules take the *infrastructure-compatibility seams only* — NOT the enterprise apparatus. Do not port multi-user, sign-in/Auth adapters, organizations, or Track Program from the enterprise standard; Human Edge modules are single-user. The physical breakdown of the single-file build into a deployed multi-file set is **Faisal's step downstream** — do not split files as part of this work.
> **⟶ SUPERSEDED / CORRECTED — see Part VI §VI-8 (Paul, July 12). The blanket auth exclusion above was a transcription artifact (“multi-user, sign-in/Auth” for “multi-user sign-in/Auth”). Leadership Edge modules DO require sign-in and a single-user Auth adapter. Still excluded: multi-user Store/Collab writes, organizations, Track Program. File-splitting remains Faisal's downstream step.**
> **⟶ SUPERSEDED — see Part VIII (Paul, July 13): file-splitting was brought in-house and is done. The deployment file set is the sole shipped form; the single-file build is retired.**

**Governing principle (from the enterprise standard, applies to all modules):** every deployment seam is a **source constant the dev team edits before deploying** — no runtime remote configuration, no environment sniffing, no settings UI for endpoints. One constant, one comment block explaining the switch, nothing else.

---

## 1. What "in line" means

Exactly one API endpoint constant, defined once near the top of the app script, with the family's documentation block. Every Claude/AI call in the module routes through it via `fetch(CLAUDE_API_URL, …)`. Zero endpoint literals anywhere else in the file. That is the entire standard for Human Edge.

## 2. The endpoint block (install verbatim)

```js
/* ═══════════════════════════════════════════════════════════════
   CLAUDE API ENDPOINT
   ─────────────────────────────────────────────────────────────
   Default: direct to Anthropic. Works inside Anthropic's hosted
   environment (Claude Artifacts), which injects the API key and
   handles CORS automatically.

   For self-hosted deployment (your own server, faisalhoque.com,
   any static host), point this at your proxy that holds the API
   key server-side. See /proxy/server.js for a minimal Express
   example, or /proxy/cloudflare-worker.js for serverless.
   A browser-held API key is unacceptable in production.

   Example for a proxied deployment:
     var CLAUDE_API_URL = '/api/claude';
     // or
     var CLAUDE_API_URL = 'https://your-proxy.example.com/claude';
   ═══════════════════════════════════════════════════════════════ */
var CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
```

Notes: the default stays pointed directly at Anthropic — correct for the hosted Artifacts environment, where the key and CORS are handled. The comment documents the one-line switch for deployed hosting (`/api/claude` relative, or a named proxy). Do not "improve" the wording; byte-identical across modules is the point.

## 3. Call-site convention (Decision Lab reference, verbatim excerpt)

Every call site follows this shape — the constant, never a literal:

```js
fetch(CLAUDE_API_URL,{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:sysPrompt}]})
}).then(function(r){return r.json()}).then(function(j){
var text='';
if(j.content){for(var i=0;i<j.content.length;i++)if(j.content[i].text)text+=j.content[i].text}
if(!text)text='I had trouble generating a challenge. Try again.';
if(!d.flow)d.flow={};
d.flow.challengeAI=text;
saveData();
tabChallenge($('tc'),d);
}).catch(function(err){
var ld=document.getElementById('challengeLoading');
if(ld)ld.innerHTML='<span style=…
```

The request body shape (model string, max_tokens, messages) stays as the module already has it — this guide governs the *endpoint seam*, not the prompt payloads.

## 4. Conversion protocol for an old module

1. **Read the module file in full off disk first** (record lines · bytes · md5). Old Human Edge modules may predate the convention entirely.
2. **Inventory every API touchpoint.** Grep, unanchored, and list each hit with surrounding context before changing anything:
   - `api.anthropic.com` — hardcoded endpoints
   - `fetch(` — every call; classify Claude calls vs. other fetches (fonts, assets)
   - `XMLHttpRequest` — legacy call patterns, convert to the fetch convention
   - `http` inside quoted strings in the script — any other absolute API URLs
3. **Install the endpoint block once**, immediately before the module's state/constants section (Decision Lab places it directly above its `SK` state-key line). If the module already has some endpoint variable, replace it — do not keep two.
4. **Route every Claude call site** through `fetch(CLAUDE_API_URL, …)`. Each edit as a count-asserted string replacement (exactly one match, abort and inspect on zero or multiple).
5. **Nothing else changes.** Coach panels, challenge/profile generators, and any other AI features keep their payloads and handlers; only the URL routing moves to the constant.

## 5. Verification gates (all must pass before delivery)

- `CLAUDE_API_URL` appears exactly **once as a definition** (`var CLAUDE_API_URL =` outside the comment's examples) and **once per call site** as `fetch(CLAUDE_API_URL`; the Decision Lab has 4 call sites — your module's count comes from your step-2 inventory, and every inventoried Claude call must be accounted for.
- `grep -c 'api.anthropic.com'` over the file returns hits **only** within the endpoint block (the active constant and its comment). Zero elsewhere.
- Zero other absolute API endpoint literals in the script.
- Syntax gate: extract the largest `<script>` block, `node --check`. (Family builds have two script blocks — first-paint theme + app; check the largest.)
- Behavioral: the module's AI features still function in the hosted environment after the change (the default constant is unchanged in behavior, so any breakage means a call site was mis-edited).
- **Beyond-list disclosure at close-out:** declare any change made outside the steps above.

## 6. What NOT to do

- No file splitting (Faisal's step). No build tooling. No `.env` files, config fetches, or URL parameters for the endpoint — the gov-cloud rule forbids runtime configuration.
- No porting of enterprise features (Auth adapter, `AUTH_ENDPOINT`, Track Program, multi-user Store/Collab writes) into Human Edge modules.
> **⟶ SUPERSEDED / CORRECTED — see Part VI §VI-8: the Auth adapter and `AUTH_ENDPOINT` come OFF this list in single-user form. Track Program, multi-user Store/Collab writes, and organizations stay excluded.**
> **⟶ SEAM INVENTORY UPDATED — see §VI-10: the legacy challenge fetch is excised; `CLAUDE_API_URL` now has three live fetch sites, not four.**
- No editing the block's comment text per-module. Consistency across the family is what makes deployment uniform.


---

# PART IV — REACTIVE ARCHITECTURE
*Source: leadership-edge-reactive-addendum.md. Most recent doctrine as of v1.1; Part V now governs on any conflict.*

---

# Leadership Edge Activities Guide — Addendum: Reactive Architecture
**Status:** supplements guide v1.0 (`leadership-edge-activities-guide.md`). Covers everything established after v1.0's cutoff (the process-lines round): the responsive-tier campaign and its associated doctrines. Hand this to any chat converting other modules to the family style; the reference implementation for every pattern below is `decision-lab-index.html` (originally md5 `5a2724e9c34d4307ba27557c7cd97562`; re-verified against the current build, md5 `b793003c1a57cc61593517afcb6ee94e`).

## R1 — Three-tier SVG surfaces, not scaled text
Every full-width SVG surface (dashboard, activity board, file cabinet) ships three layouts built by separate builder functions, never a single layout scaled down:
- **Wide** — the 1500-unit canvas, the designed desktop experience.
- **Mid** — a 900-unit canvas. Card boards and folder grids go two-column (cols at x=30/470, card width 400–420, group headers spanning centered); dashboards go single-column at 780 content width. Card titles 18u at mid.
- **Narrow** — a 440-unit canvas, single column (content 400 wide at x=20), titles 16u.
> **⟶ UPDATED — see Part VII §VII-3 (July 13): card-head titles are serif and size-compensated — `titleFs+2`, i.e. 20u at mid and 18u at narrow.**

**Legibility floor:** reading text must satisfy `units × (container_px ÷ viewBox_units) ≥ 14px` (the LinkedIn-post-body ruling). Body text is 18u standard; section headers scale up (22u), never down. Card *bodies* on glance boards are exempt miniatures by ruling, but card *titles* are reading text. Design narrow for a 390px floor.

## R2 — Tier selection: deterministic, from window.innerWidth, monotone
Never derive the tier from DOM measurement (`getBoundingClientRect`/`clientWidth`) — mid-resize measurements are unreliable and produce flash-of-wrong-tier pathologies. Compute from `window.innerWidth`, zoom-compensated:
```
lay = min((iw − 40)/z, iw ≥ 1560 ? 1472 : 1280)   // wrap cap + breakout
vis = lay × z
full-width surfaces: wide ≥ 1170 · mid ≥ 700 · else narrow
```
**Surfaces that sit beside a sidebar/drawers need pure monotone window thresholds instead** (Decision Lab detail: wide iw ≥ 1350·z, mid ≥ 716·z). Reason: when the sidebar stacks at its media boundary, the pane *widens* as the window *shrinks*; any pane-derived threshold then reverses the ladder (mid pops back to wide). Law: **the tier must be a monotone function of window width.** Verify with a sweep (1600→420px in 20px steps) asserting the tier never regresses upward.

## R3 — Fluid boundary re-render
No debounce. The resize handler evaluates the tier on every event and re-renders immediately on a boundary cross (track `__lastTier`); it also tracks the sidebar-stacking boundary (≤1080) separately, because chrome policy can change there while the tier does not. Result: layouts flip mid-drag, not after release.

## R4 — The container-collapse trap (critical)
In the ≤1080 media block that flips `.board-layout` to `flex-direction:column`, the default carried `align-items:flex-start` makes flex children shrink-to-fit — and an SVG's fallback intrinsic width is the CSS default **300px**, so the whole surface pins at 300px regardless of window (symptom: a tiny column in the corner that "becomes usable" only when the window shrinks to meet it). Mandatory:
```
@media(max-width:1080px){.board-layout{flex-direction:column;align-items:stretch}.board-pane{width:100%}}
```
Belt and braces on every compact svg root: `width="100%" preserveAspectRatio="xMidYMin meet" style="width:100%;height:auto;display:block"`.

## R5 — Serif x-height parity
Cormorant Garamond's x-height makes 18u serif read like 14u sans. All *reading* serif (quotes, playbook entries, long captions) sits at **22u on a 28-unit line pitch** to match 18u sans; subtitles 21u; short captions 20–21u. Recompute wrap budgets and card heights when applying.

## R6 — Opacity clarity doctrine
No opacity dilution on titles or body text on board surfaces — full ink. Furniture (corner letters, sample notes, ghost hints) may sit at 0.65–0.85, never below. Softness at the wide tier is partly the 1500→~936px downscale; opacity must not add to it.

## R7 — Hover: stationary hit rect + lift layer
Hover animation may move visuals, **never the hover boundary** (a moving boundary strobes at card edges). Pattern, applied per clickable card:
1. First child of the clickable `<g class="bd-click">`: an invisible stationary hit rect, padded beyond the card — `x−8, y−12, w+16, h+20`, `fill="none" pointer-events="all"`.
2. All visuals (card, pin, clips, stamps) wrapped in `<g class="bd-lift">`.
3. CSS: `.bd-lift{transition:transform .18s ease}` `.bd-click:hover>.bd-lift{transform:translateY(-4px)}`, with a `prefers-reduced-motion` block zeroing both. Keep the drop-shadow on `.bd-click:hover`.

## R8 — Wide-board structural integrity (latent port defect)
The prototype's `exhibitCard` filled/non-memo branch never closed its `filter` group, silently nesting every subsequent card inside the first (symptoms: hover shadows all cards at once; clicks resolve to the wrong card). When porting: close the shadow group immediately after the rail bar, mirroring the memo branch — and add the suite guard: **N clickable `.bd-click` elements, zero with a `.bd-click` ancestor, N hit rects, N lift layers.**

## R9 — Folder and thumbnail full-title doctrine
Truncated titles on folder tabs are banned. Category goes on the tab (always fits); the **full title/question** goes on the folder body in sans, wrapped: cabinet folders 15.5u × 2 lines in a `w−32` budget with the date moved to the bottom-right corner; dashboard loop thumbnails 186×118 with the title at 13.5u × 3 lines (158 budget), stamp beneath, month in the corner. The category chip on the body is removed (redundant with the tab).

## R10 — Sidebar/drawers chrome policy
Drawers are navigation *beside* the board only. The moment they would stack above it (the ≤1080 media boundary) they are removed entirely (`no-drawers` class, `display:none!important`). The fullscreen button is removed at the narrow tier only (`tier-narrow` class). Both classes toggled in the board render from tier + innerWidth.

## R11 — Nav centering breakpoint
Absolutely-centered nav tabs collide with right-side utilities below ~1480px (logo ~300 + tabs ~560 + utilities ~370). Center only at `min-width:1480px`; below that, tabs flow inline with `margin-left:auto` and the nav's `flex-wrap` handles the rest.

## R12 — Validation additions
- **Pin `window.innerWidth` to 1500** in every jsdom harness and render script (`beforeParse` + `Object.defineProperty`); jsdom's 1024 default silently selects the mid tier.
- Test hook `window.__forceTier` short-circuits tier selection for assertions.
- Behavioral matrix: assert the rendered `viewBox` per surface at probe widths (e.g. 1500/1370/1200/1050/900/600) plus class states; add the monotone sweep from R2.
- **Remote-diagnosis chip**: when a layout bug reproduces only on the client's machine, ship a temporary fixed-position readout (`tier · iw · zoom · shell width · svg width · vb`) updating on resize and post-render — one user screenshot then identifies the faulty link (tier logic vs container vs svg). Remove it in the fix build. This technique found R4's root cause in a single round trip.


---

# PART V — ASSESS REACTIVE ROUND
*Authored July 12 (late evening) against the then-current reference build (`decision-lab-index.html` · 4,064 lines · 593,660 bytes · md5 `b793003c1a57cc61593517afcb6ee94e`, suite 182/182); patterns re-verified in the current build. Superseded as most-recent doctrine by Part VI, which governs on conflict.*

## V1 — Assess tier wiring
Assess joins the tier system exactly like the other surfaces: `bdRenderAssess` consults `boardTier()` — wide renders `buildAssessSVG(state)`, otherwise `buildAssessCompactSVG(state, tier)` — and the resize handler gains `else if(currentPage==='assess')bdRenderAssess();` beside the dashboard/detail/lab branches. Event wiring is unchanged — handlers bind after mount by element id — so compact builders must reproduce the ids exactly: `assessBegin`, `aopt-{q}-{val}`, `assessPrev`, `assessRetake`, `assessBackLatest`, `ahist-{i}`.

## V2 — Compact intake (the clipboard at mid/narrow)
One builder, `buildAssessCompactSVG(st,t)`, with a layout table: mid `vb 900 / cx 60 / cw 780`, narrow `vb 440 / cx 20 / cw 400`, content inset 40. The clipboard chrome (backboard, offset under-sheet, sheet, clip) is parametrized from the wide geometry and the sheet height is computed from a running `y` cursor (the wide intake keeps its fixed 1500×720 board). Compact svg roots carry the R4 fill attributes.

**Step-0 order (Paul's ruling, July 12):** headline → intro copy → the **WHY WE ASK / WHERE IT GOES cards on the clipboard** (side-by-side at mid, stacked at narrow; head mono 18/ls1.5, body serif 20 wrapped to the card width, rail bar + pin) → BEGIN ASSESSMENT (280×60, label 18) → the dimension legend. At wide the two cards remain **beside** the clipboard as `bdSideCard`s; at compact tiers they appear on step 0 only — that is where the intro lives, and question screens stay clean.

**Question screens:** progress ticks 24 wide on a 32 pitch at mid (counter right-anchored on the same row) and 16 wide on a 22 pitch at narrow (counter on its own line beneath); scenario serif 27 wide / 24 mid / 22 narrow, regular; option blocks at full content width; caption regular serif 20, wrapped (2-line budget); PREVIOUS tab fs 18 below the caption.

## V3 — Option blocks never truncate
`bdOptBlock(x,y,w,qi,val,key,text,sel,maxL)` — the wrap is `w−70, maxL||3, 18, 0`. Wide keeps the default 3; mid passes 4; narrow passes 6. Option copy truncating to an ellipsis at any tier is a defect; the suite asserts its absence at narrow.

## V4 — The Assess floor and de-italic (July 12 late-evening pass)
Everything user-facing on both Assess surfaces sits at ≥18u: option bodies and intro copy 18 sans; every mono head, option key, progress counter, page tab, history row, VIEW / SHOWING NOW / COMPLETED, and the BEGIN label at 18. Serif: scenario 27 at wide, question caption 20 regular; side-card bodies regular ≈20 (heads 13×fs ≈ 18.2). Every Assess italic was removed (scenario, caption, side-card bodies). The intro dimension legend is a **single centered column** of five 18u/ls1 mono lines on a 34 pitch — the old 14u paired rows (2/2/1) do not fit at floor size. Two suite sweeps guard this permanently: a sub-18 `font-size` regex over the intake and wide diagnostics, and an italic-absence check.

## V5 — Verbatim copy may re-break across lines
Ruled strings are never edited for layout, but layout may re-break them: at narrow, the clipboard header (`DECISION STYLE · SELF-ASSESSMENT`), `WHERE YOU SIT ON EACH DIMENSION`, and the viewing banner each render across two lines, copy verbatim. The compact WHY WE ASK / WHERE IT GOES bodies re-flow the same words by measured width instead of the wide builder's fixed `|` line breaks.

## V6 — Compact diagnostics (results)
`buildAssessResultsCompactSVG(st,t)` restacks the wide results single-column at `cw 780/400`: title, viewing banner (with the BACK TO LATEST tab below it), radar card, dimension-slider card, HOW YOU DECIDE — IN WORDS narratives (two per row at mid with the odd fifth centered; stacked at narrow; card heights computed from wrapped line counts), guidance card, past-assessments card, retake footer (COMPLETED inline at mid, stacked at narrow). Radar treatments follow the dashboard tier doctrine: mid `fs 1.4, lift=false` (vertex labels), narrow `fs 1.25, lift=true` (overlap) — the narrow radar labels at 16.25u are the ruled family exception to the 18 floor, kept for cross-surface parity. History rows are variable-height at narrow (the latest row takes a second line for SHOWING NOW; VIEW buttons narrow to 110).

## V7 — Suite growth (162 → 182)
New pins: intake floor sweep and italic absence (intake and wide diagnostics); the caption-at-20 pin; legend single-column geometry and sheet-fit (the old paired-rows assertion was redirected to the new geometry, not pruned); compact canvases per tier for intake and diagnostics; the step-0 order pin (intro → cards → begin); the untruncated-options pin; an end-to-end narrow sitting (retake → answer through → compact diagnostics render in place → history view → back to latest); and a source pin on the resize branch. Current artifact: `module_smoke.js` · 365 lines · 31,610 B · md5 `c1aef165ed3604d555eae5e0cf25f5a3`.
> **⟶ SUPERSEDED / UPDATED — see Part VI §VI-5: the suite is now 188 assertions (compact-congruence pins added); current artifact identity there.**

## V8 — Open items and observed residues (recorded, not licensed)
- The Assess stage does **not** toggle `tier-narrow`, so the fullscreen button remains visible at compact tiers — matching Dashboard and Files (only the detail board hides it, per R10). Whether that asymmetry should be unified is an open question for Paul.
- Cabinet furniture floor (tab 10, ANALYSIS DEPTH 7.5, date 8.5; wide-cabinet question ≈12.7px effective) — open ruling (queue item 2).
- Observed sub-18 residues on the **wide dashboard** (a Paul-confirmed build; do not "fix" without a ruling — H11 applies): CTA card serif title 17 and pill label 15; activity age mono 14 at 0.8; the All-Decisions row family at 15 (chips, status, nudge line, date, counter) with serif row titles at 19 and the regular serif 20 status caption. These are recorded build truth as of md5 `b793003c…`.
- The diagnostic chip (`__tierDebug`) was removed after Paul's confirmation pass (July 12) — all five sites excised, suite pins its absence. R12's technique record stands for future tier work.


---

# PART VI — COMPACT CONGRUENCE ROUND
*Authored July 12 (late evening), after Part V. This part is the most recent doctrine and governs on any conflict with Parts I–V; §VI-7 was added in the same session. Current reference identities live in the front-matter authority line.*

## VI-1 — Compact cards are the same cards
Compact tiers never flatten the wide card grammar into generic white cards — Paul's ruling after the first tier build did exactly that. The compact board card renderer mirrors `exhibitCard` field for field: per-card paper stocks (`c.stock`) and heavy strokes; head labels in their `headK` colors with the separator rule beneath (`rgba(30,37,48,0.12)`); ruled writing lines (`c.ruled`); italic serif voice bodies (`c.voice`, 14.5 on a 19 pitch); tag pills in the head color (`c.tag` — FOR / AGAINST / TRANSCEND); the verdict roundel (`c.verdict`); the red memo band with white label and the `LIVE AI IN MODULE · SAMPLE` footer (`c.memo`); the hub's `UNDER REVIEW` flag; and the wide empty-state semantics (ghost labels via `c.ghostLabel`, locked vs current fills and hints, OPEN pill on the current card only, ghost/current pin colors with the current-card pulse). Only geometry compresses; the object identity survives. When porting a module, build the compact card path from the wide card path, not from scratch.

## VI-2 — Compact geometry accommodations (rulings)
- **Hub cards:** the body starts below the UNDER REVIEW flag (`bodyY = hub ? y+64 : y+52`) and the card gains 16 units of height — at compact card widths the voice text otherwise runs under the flag. (The wide board escapes this collision only by its narrower cards; its own demo05 overlap remains on the standing cleanup list.)
- **Paperclips:** the response card's paperclip is dropped at compact tiers — stacked layouts detach it from the challenge memo, leaving a clip attached to nothing (Paul's ruling, July 12). Wide keeps the clip.
- **Header cards on every compact surface carry the accent rail bar** (`railBar(…, GOLDT)`), exactly as their wide counterparts — a missing rail reads as a different object (Paul's catch, July 12).
- **Header-card subtitles** at compact match wide: italic 13 at 0.75 opacity, verbatim copy.

## VI-3 — Compact cabinet CTA and header
The new-item CTA at compact tiers is the wide manila folder at 380 wide (tab 110/126, index-card slip, body, accent outline, pin) carrying the verbatim ruled copy — `START WORKING THROUGH A NEW DECISION` at DM Mono 11.5/ls2.5 (it fits the 380 folder with margin) and the italic `open a fresh file →`. The compact header card carries the wide subtitle verbatim (`Every decision you have opened, active and resolved`). **Compact surfaces never author their own copy variants; ruled strings are tier-invariant** (Part V §V5 governs how long strings may re-break across lines).

## VI-4 — Stacked detail band
In the ≤900 stacked band, the gauge centers with everything else: `.det-band-right .gauge-wrap{text-align:center}` added inside the 900 media block.

## VI-5 — Suite growth (182 → 188)
Pins added this round: compact filled-card grammar against the fully-resolved seed (voice italics, tag pills, head rules, hub flag, memo footer); compact cabinet ruled-copy and folder-chrome pins in both directions (wide strings present, compact-authored strings absent); the stacked-gauge CSS pin; the compact header-rail pin; the compact paperclip-absence pin. Current artifact: `module_smoke.js` · 373 lines · 32,789 B · md5 `f0bb05d994d2eeebe11481df43e8dc7c`.

## VI-6 — Compact CLOSED stamp and fullscreen symmetry (ruled July 12)
Two follow-on rulings, both implemented:
- **`DECISION CLOSED` stamp placement (revised ruling, later the same evening):** compact strikes THE PROBLEM header zone between the question and the first card (box 360×84 centered at y=248, rotated −6) so the question text is never obscured; wide runs diagonally across the top-left — rotate(−14) about (385,168), lower-left tip in line with THE PROBLEM header, upper end near/overlapping the board header card, body in the top-left open space. Both render-verified; suite pins the new geometry and asserts the old absent.
- **The Full-screen control hides at the narrow tier on every surface**, not just the decision board: all four renderers (board, cabinet, Dashboard, Assess) toggle `tier-narrow` on their stage, and `.board-stage.tier-narrow .stage-btn{display:none}` does the rest. At phone widths the compact layouts already fill the screen; the fixed overlay buys nothing. Suite pins: stamp geometry (old position asserted absent), behavioral tier-narrow on the narrow cabinet, and a source count of exactly four togglers.

## VI-7 — Full-bleed decision board (Decision Lab ruling, July 12)
The detail page's board stage and its header band abandon the 1280 wrap and run edge to edge with a small gutter and an ultra-wide cap, centered beyond it:
```
.det-band,.board-stage:not(.view-files):not(.stage-full){--bw:min(calc(100vw - 40px),1960px);width:var(--bw);margin-left:calc(50% - var(--bw)/2)}
```
- **Scope (ruling):** the decision board page only — it is the surface dense enough to need it. The cabinet, Dashboard, and Assess keep the 1280 wrap; the legacy ±1560/1380 breakouts are re-scoped to `.board-stage.view-files:not(.stage-full)` and continue to serve those pages. Per-module adoption for other central boards is Paul's ruling, not a default.
- The det-band shares the variable so the back button, chips, title, and gauge align with the board edges (its old −96px ≥1560 rule is retired).
- The detail page is selected by class shape — it is the only stage without `view-files`. Fullscreen (`.stage-full`) is excluded and retained: it still hides nav and band for the immersive fixed-viewport view.
- **Tier retune:** the detail wide threshold drops 1350·z → **1320·z** — the pane at a given window is wider (iw−288 vs the wrapped geometry), and 1320 preserves the same wide-tier pane floor (≈1032 units). The mid/narrow boundary (716·z) is unchanged; monotonicity holds (single-constant change; suite behavior pins at 1047/1169/1500 all pass).
- Suite: 191 assertions — pins on the full-bleed rule with its 1960 cap, the re-scoped legacy breakout, and the retuned threshold constant (old constant asserted absent).

## VI-8 — Single-user auth required (ruling corrected, July 12)
Part III's blanket auth exclusion was a transcription artifact and is overruled. **Every Leadership Edge module requires sign-in and an Auth adapter in single-user form.** The reasoning is not enterprise apparatus but basic product safety: users put their most sensitive personal and ethical material into these modules, and per-user storage has no identity to key on without login. Still excluded, unchanged: multi-user Store/Collab writes, organizations, Track Program — the modules remain single-user by design; they get single-user security.

Implementation status: **IMPLEMENTED in the Decision Lab (July 12, this evening); open to-do for every other module.** Ported from the deployed Pipeline `app.js` (6,622 · 715,949 · md5 `2b53c87b01c2fae65ae831ece9e4ade1`, confirmed by Paul as the verbatim source). The shape, for the family:
- **Adapter:** `AUTH_ENDPOINT` source constant beside `CLAUDE_API_URL` (`''` = device-local, shipped); callback-shaped `createAccount` / `signIn` that fire synchronously in local mode (the harness depends on this) and post to `/account` and `/session` in server mode. The single account record lives in `dl-auth`; the remember flag in `dl-remember`; the session in page state (`authSignedIn`). Username match is case-insensitive; PIN minimum 4 characters.
- **Entry flow:** first boot with no account lands on Create-your-account; thereafter Sign-in. DL chrome (`.entry-*` classes on the module tokens), Enter-key submit, typed username preserved across error re-renders, Pipeline error vocabulary. **Everything gates pre-login, including the seed content** (Paul's ruling) — seeding still happens at boot; only visibility gates, so harness data assertions run unchanged.
- **Session:** remember-me checkbox (Paul's ruling: keep); boot restores a remembered session before the first render; Sign out lives in the More menu, clears the session and the remember flag, and returns the gate. Sign-out also clears the rail and notes panel so no drawer floats over the gate.
- **Storage ruling:** `dl-v9` stays as-is — one device, one user in local mode; a server build owns identity server-side.
- **Suite:** 193 → 204. Pins: adapter round-trip (weak PIN, wrong PIN, case-insensitive success), seam constant defined once, fresh boot lands on setup, weak-PIN message, account creation opens the session, the whole legacy suite runs authenticated behind the gate, sign-out/wrong-PIN/re-sign-in round-trip, remember flag set and cleared, boot-restore hook pinned at source level, More-menu sign-out pinned.

## VI-9 — True dark board (design round, July 12; Pipeline-pattern architecture)
The board and instrument SVG family now goes fully dark with the chrome, superseding the earlier "lit board in dark chrome" holding decision. Reference sources: the deployed Pipeline `styles.css` (2,430 · 352,354 · md5 `6401fad8a6cbc6db31346c931c728c67`, post light-mode design round, accent `#E8621A`) for the dark design language, and the DL's own dark token family for continuity with Home/Learn/Insights.

**Architecture — two halves, zero light-mode risk:**
1. **Vibe swap.** A `modernDark` sibling in `VIBES`; `applyVibe()` consults `getTheme()` and picks `VIBE+'Dark'` when present; `toggleTheme()` calls `applyVibe()` before `render()`. Everything flowing through `V` and the applyVibe-assigned constants (ink, board ground, stocks, part hues, folder colors, pins, threads, shadows, ghost opacity) swaps wholesale. Light values are untouched — the light vibe object is not edited.
2. **SVG theme remap (the Pipeline's documented trick).** Baked builder literals (ink-alpha washes, ghost-white fills, pill/tab text `#FFFFFF`, folder-slip papers, the dot grid, top-light gradient stops, the crisp shadow flood) retarget via CSS attribute selectors — stylesheet rules outrank presentation attributes — scoped `[data-theme="dark"] #boardShell svg […]` so hero/Learn artwork is untouched and builder strings stay byte-identical (all literal-grepping pins survive). Wash values are channel-driven (`rgba(var(--fg-rgb),…)`) per the dark round's doctrine; `text[fill="#FFFFFF"]` and `rect[fill="#FFFFFF"]` are remapped separately so the corner-screw sparkle circles stay lit.

**Palette:** ground `#1D2531` (darker than the page, as the light board is); card faces `#2C3846` with whisper-tinted stocks; ink `#E2E9F1`; hues tinted up per the Pipeline's dark tints — P1 `#6B9FE0`, P2/accent `#F07A37`, P3/green `#4FB39A`, brown `#C8956A`, slate/pre `#38B5EF`, purple `#A688D0`, red `#E07788`; manila tab `#4E3A26`; shadows black at raised opacity; tag-pill and tab text goes dark ink on the tinted-up hues.

**Suite:** 207 → 211. Dark round-trip pins (vibe swap state, dark surfaces + tinted hues + black flood in the build with the light ground asserted absent, remap block presence and scoping, light restoration). The channel-driven wash pin was refined — not weakened — to forbid value-position ink washes while exempting attribute-selector matchers, which contain the light literal by construction.

**Verification honesty:** resvg cannot apply page CSS, so dark renders are produced by applying the remap table to the SVG string — verifying the mapping itself; the cascade mechanics (specificity of attribute selectors over presentation attributes) are the Pipeline's shipped, proven pattern. Browser eyeball still owed on: focus reel and drawers alongside the dark board, dashboard instruments, Assess radar in dark.

## VI-10 — Dead-code excision (July 12; Paul's rulings recorded)
The legacy pre-board activity layer and its satellites are excised — 355 lines / ~27KB — after a full caller-graph verification (never delete on a queue note alone; two "dead" entries turned out live). Removed: `renderTab` + the eight `tab*` renderers, `sectionHead`, `flowExample`, `hexToRgba`, the legacy carousel trio (`renderCarousel`/`carouselGo`/`carouselStep`), `navButtons`, `bestArgBox`, `generateChallenge` (which held the legacy challenge fetch), the `threadPath`/`threadSVG`/`chevronAt` trio, and the SVG reminders-twin block (`if(m.notif){…}`).

**Seam inventory change (Paul's ruling):** removing the legacy challenge fetch takes `CLAUDE_API_URL` from four fetch sites to **three live sites** (coach, profile, focus-reel challenge) plus the single live definition — Part III's "four call sites" is superseded accordingly; suite pins the count at three.

**Verified live and retained:** `CAROUSEL_DATA` (the live focus carousel `renderFCar` reads it), `buildChallengePrompt` (the live challenge fetch uses it), `saveDec`/`saveFlow` and their null-guarded `refreshDoneBtn`/`navButtonsInner` pair (live-reachable inerts), and — per the worked-example ruling — `SECTION_EXAMPLES`, the spec-box renderer, and `toggleSpec` as the one-line restore path. The excision ran content-anchored on live successor functions with uniqueness asserts, followed by a residual-reference audit (zero references to any removed name) and a retained-material audit, both enforced in the edit script and pinned in the suite.

**Also in this pass:** the wide board's hub card gets the same body-drop the compact card received (`bodyY = hub ? y+63 : y+51`), closing the demo05 UNDER REVIEW overlap. And a VI-9 addendum: the dashboard's written-profile card was found passing a literal cream (`#FDF7F3`) straight to `bdCardRect` — both tiers now ride `V.stocks.s8`, light output byte-identical, pinned.


---

# PART VII — BOARD TYPOGRAPHY & FLOW-CHART ROUND
*Authored July 13, 2026, in the same session as the work it records. This part is the most recent doctrine and governs on any conflict with Parts I–VI. Reference for the sidebar mapping: the deployed Pipeline `app.js` (6,622 · 715,949 · md5 `2b53c87b01c2fae65ae831ece9e4ade1`) and `styles.css` (2,430 · 352,354 · md5 `6401fad8a6cbc6db31346c931c728c67`), both Paul-confirmed deployed. Standing instruction (Paul, July 13): **the conversion guide is updated in the same session as any change that ships — doctrine and build move together.***

## VII-1 — Sidebar fonts follow the Pipeline sidebar (ruling)
The decision-board drawers drop the all-mono treatment for the deployed Pipeline sidebar's font roles. Pipeline reference values, measured from the deployed `styles.css`: sub-steps `.sidebar-step` are plain sans 14 with no mono and no letter-spacing (this is the non-computery look the ruling targets); phase heads mono 15/700/ls.12em; the home row mono 14/ls.18em; the OUTPUTS label mono 13/ls.12em; counts mono 14.

Decision Lab application (shipped values, calibrated to the DL's 226px rail rather than copied from the Pipeline's 300px rail):
- `.dsec` sub-steps: sans 14, letter-spacing 0 (was mono 11/ls.06em).
- `.drawer-plate` drawer heads: Cormorant Garamond 14/600, letter-spacing .08em, tracked caps (was mono 10.5/ls.14em) — the four part labels share the board-heading serif per VII-2's ruling, in the drawers as on the board.
- `.bnav-it` page tabs: mono 13/ls.14em (was 11.5/ls.12em) — mono caps is the Pipeline's own nav-row treatment; only the scale moved.
- `.dutil-cap` captions (THE DECISION LAB, BOARD TOOLS): mono 11 (was 9).
- `.drawer-count` mono 11.5 (was 10); `.dcount` mono 11.5 with an explicit `font-family:var(--mono)` added, because its parent `.dsec` went sans and the counts must stay mono digits.

Left as-is pending a ruling: the BOARD TOOLS `.dutil` buttons (mono 11) — unnamed in the ruling.

**Drawer-row fit fix (Paul's eyeball + ruling, July 13, later same day):** the browser pass confirmed THE EXAMINATION wraps acceptably at serif 14/600 but exposed an overflow — `.drawer-plate` at `flex:1` has a min-content floor (≈139px for the wrapped EXAMINATION plate), and the row's fixed costs (two 10px gaps + 26px lozenge + count) exceeded the 202px inside the drawer front, so flexbox pushed the count out of the box. Fix, per Paul's approach: `.drawer-front` gap 10→6; `.drawer-plate` `flex:1` → `flex:0 1 auto` (the white box hugs its text — the "nip in tighter" — one-line drawers get snug boxes too) with side padding 9→6; `.drawer-pull` lozenge 26→18 wide with `margin-left:auto` (keeps the lozenge + count pinned right now that plates hug); `.drawer-count` gains `flex-shrink:0;white-space:nowrap` so the count can never be pushed out again. Worst-row arithmetic after: ≈139 + 6 + 18 + 6 + 24 = 193 ≤ 202. Suite pins the full rule set and the old `flex:1` absent.

## VII-2 — Board headings are serif (ruling)
The four column headers — THE PROBLEM · THE EXAMINATION · THE CALL · CLOSING THE FILE — render in **Cormorant Garamond 20, weight 500, letter-spacing 4, tracked caps**, replacing DM Mono 14/ls5. One edit in the shared `columnHeader()` builder covers both tiers by construction. The part-colored roundel (Cormorant 14 numeral) and the colored underline dash are unchanged, as is the 0.85 opacity. The treatment deliberately echoes the header card's title grammar (Cormorant tracked caps) one scale down from the board title's 25/ls6.

## VII-3 — Card heads are serif (ruling, second pass same day)
Every exhibit-card head label converts to **Cormorant Garamond, weight 500**, in both tiers — six sites, all size-compensated for serif optical parity (roughly +2u on the compact scale, +15–20% on the wide miniatures):
- Wide standard head (`exhibitCard`): 13 (small branch for cards ≤180 wide: 11.5) — was DM Mono 11/9.5. Letter-spacing unchanged (1.4/1).
- Wide memo band label (THE CHALLENGE, white on the red band): 13 — was 11.
- Wide ghost/empty-state labels: 12.5 (small branch `glSmall = c.w≤180 || label>20 chars`: 10.5) — was 10.5/9.
- Compact standard head: `titleFs+2` (20 mid / 18 narrow) — was `titleFs`.
- Compact memo band label: `titleFs−2` — was `titleFs−4`.
- Compact ghost labels: `titleFs+2` — was `titleFs`.

**Fit protocol (mandatory when resizing head text):** before choosing sizes, compute every label against its card's real budget with the page's own `textW` (serif is fam 2), including letter-spacing. This round's computation showed the 162-wide bias cards overflow at any uniform serif size — which is why the small branch scales separately. Ship only render-verified.

**Deliberately still DM Mono (rubber-stamp and furniture grammar, not headers):** tag pills (FOR/AGAINST/TRANSCEND), UNDER REVIEW flags, CARD letters, OPEN pills, the DECIDED roundel, the LIVE AI IN MODULE · SAMPLE footer, all closing stamps, the START HERE mark, key/legend card text, and the header cards' identity line. A conversion pass that sweeps these into the serif is a defect (H11 applies).

## VII-4 — Process lines are orthogonal flow-chart elbows (ruling)
`procLine()`'s three cubic Béziers (down, right, up) are replaced with orthogonal elbow routing: two right-angle turns at the midpoint of the travel axis — `M a → L (midpoint jog) → L → L b`. Collinear endpoints degenerate to a straight segment, which is correct. Unchanged: the three state treatments (solid 0.25 completed, dashed 6-4 at 0.4 with arrowhead for the next step, faint 0.10 future), the axis-aligned arrowhead polygons, the `pointer-events:none` threads group, and the thread animation mechanism. Both tiers convert through the shared builder. All boxes keep their positions — the ruling changes the lines only.

## VII-5 — Entry title emphasis (ruling)
The login screen's module title emphasizes both words: `The <em>Decision Lab</em>` — previously the middle word alone carried the em. The em rides the family `.section-title em` treatment (italic, `--head-blue`). Open item: the ruling's phrase was "the module colour"; if the module accent (`--gold` family) is wanted on the entry em instead of the family emphasis blue, that is a one-line follow-up awaiting Paul's word.

## VII-6 — Suite growth (217 → 225) and a pin refinement
New pins: serif column-header (source + rendered, old mono construction asserted absent); orthogonal threads (no curve commands inside the rendered threads group, cubic source constructions asserted absent); sidebar sans/serif CSS (old mono drawer-plate rule asserted absent); card heads serif in both tiers (source, mono head constructions asserted absent); rendered wide-board card head serif (THE SITUATION); entry-title double emphasis (old single-word form asserted absent).

**Pin refinement recorded (refined with cause, not weakened):** the narrow-tier readable-scale pin asserted the old `font-size="16"` card titles; it now asserts `font-family="Cormorant Garamond" font-size="18" font-weight="500"` on the narrow board — a strictly tighter guard binding both the new scale and the font.

**Verification notes for future rounds:** browser screenshots were unavailable this session — `cdn.playwright.dev` must be in the sandbox network allowlist for Playwright's Chromium download; without it, the fallback is the §9 resvg pipeline, upgraded this round by installing the real Cormorant Garamond and DM Mono TTFs from the google/fonts repository (raw.githubusercontent.com) into `~/.fonts`, so SVG renders are true-to-font (Helvetica still swaps to Liberation Sans). HTML chrome (the drawers, the entry screen) cannot be resvg-rendered; verify by suite pins plus an honestly-labeled typographic mock, with the browser eyeball recorded as owed.

## VII-7 — Rollout to Assess and the Dashboard (same day)
The VII-2/VII-3 typography converts on the two instrument surfaces, 33 count-asserted edits across four builders (`buildDashboardSVG`, `buildDashboardCompactSVG`, `buildAssessSVG`/`bdSideCard`, `buildAssessResultsSVG`, `buildAssessCompactSVG`, `buildAssessResultsCompactSVG`).

**Converted to Cormorant Garamond 500:**
- Wide Dashboard — section headers 18/ls2 → **21** (radar-pair header, RECENT ACTIVITY, THE LEARNING LOOP · CLOSED FILES); big centered headers 22/ls2.5 → **25** (WRITTEN PROFILE, YOUR PLAYBOOK, ALL DECISIONS); card heads 18 → **20** (radar card captions, profile-card heads, playbook entry title rows including their fused `· date`).
- Wide Assess — card heads 18/ls2.4 → **20** (SELF-PERCEIVED STYLE, WHERE YOU SIT ON EACH DIMENSION, YOUR DECISION LAB GUIDANCE, PAST ASSESSMENTS, narrative card heads); the page-section header HOW YOU DECIDE — IN WORDS 18 → **21**; intake side-card heads (`bdSideCard`) 13×fs → **15×fs** (≈21 at the intake's fs 1.4).
- Compact tiers (both surfaces) — **family-only conversion at existing sizes** (`L.lab` 20 / `L.meta` 18 / literal 18s) plus weight 500. Cause, recorded: the `textW` fit-check shows the long headers (THE LEARNING LOOP · CLOSED FILES at 32 chars, YOUR DECISION LAB GUIDANCE at 26) overflow the 400-unit narrow cards at any size bump, while equal-size serif is width-neutral (serif caps ≈580‰ vs mono 600‰ advance). Compact canvases already render headers large physically, so the optical-parity bump is waived at compact on these surfaces — a deliberate, fit-driven exception to VII-3's compensation rule.

**Deliberately still DM Mono (in addition to VII-3's list):** the intake identity eyebrow `DECISION STYLE · SELF-ASSESSMENT` (board header-card eyebrow grammar, both tiers); stat-tile descriptors (DECISIONS OPENED family — ruled vocabulary labels); the dimension legend and the slider pole labels (DECISIVE/DELIBERATE family — chart labels); radar spoke labels (exact-size suite pins); QUESTION i OF 10 counters; the VIEWING PAST ASSESSMENT banner; BEGIN ASSESSMENT / TAKE THE ASSESSMENT / VIEW buttons; SHOWING NOW / COMPLETED / LATEST statuses; history dates; kraft pull tabs; playbook roundel numerals; loop-thumbnail tabs, stamps, and months; category chips; RESOLVED/MIND CHANGED caps; nudge lines; dates and counters. The orphan `label()` helper in `buildDashboardSVG` (mono 10.5, zero call sites) is left untouched, joining `currentTab` on the known-harmless-orphan list.

**Suite 225 → 229:** source pins (serif WRITTEN PROFILE construction present, exactly five `L.lab` serif sites, `15×fs` side-card head present, zero `DM Mono 22` and zero `DM Mono 18/ls2.4` residue) and rendered pins (dashboard serif headers with the stat descriptors asserted still mono; assess results serif headers). Ordering hazard hit and fixed in-session: rendered pins that navigate (`go('dashboard')`) must sit AFTER any earlier pins that read `boardShell` from a prior navigation — a relocated block, not a weakened pin.

**Renderer artifact recorded (build-clean, verify at source):** resvg resolves an entire text run to a fallback face when the run's leading glyph is missing from the primary font — icon-led heads (`◎`, `✦`, `◉`) render in the wrong face or style in resvg PNGs while the emitted SVG carries the correct `font-family`/`font-weight`. Browsers fall back per glyph and render the letters in Cormorant. When a render looks wrong on an icon-led run, grep the extracted SVG for the emitted attributes before concluding a build defect.

## VII-8 — Connector refinement and key-card truth (rulings, July 13)
`procLine` gains a length branch, measured as the Manhattan span between connection points:

- **Short hops (\u2264 130 units) run as a single straight segment**, point to point, no elbow, no arrows — even when the cards sit slightly out of line. The ruled examples: the bias row (confirmation → sunk cost → anchoring, 58u), the conditions row (conditions of failure → pre-mortem → tripwire, 44u), provisional decision → awaiting the challenge (55u), the closing-file row (69u); the column-I stack (42u) and response → final call (106u) fall in the same class by the threshold.
- **Long tracks (> 130 units) keep the orthogonal elbow and gain a small mid-path direction arrow** (`<polygon class="t-mid">`, 8-unit triangle) placed by walking the polyline to half its total length and rotated along the local segment, riding the line's state opacity (0.3 traveled / 0.4 next / 0.12 future). The ruled examples: third option → the case for (472u), the case for → the case against (166u). The threshold sits in the measured gap between the longest short hop (106u) and the shortest ruled long track (166u).
- The dashed next-step line keeps its endpoint arrowhead and, when long, also carries the mid arrow. Both tiers convert through the shared builder; on the compact mid tier the cross-column zigzag connectors exceed the threshold and carry mid arrows, the single-column stacks run straight.

**Key-card truth (READING THE BOARD, wide board only):** the key previously sampled its lines from `V.thread`/`V.tw` (the accent orange spec) with a dotted road-ahead — none of which matched the shipped threads (ink, and the future line is solid-faint, not dotted). The samples now reflect usage: traveled = solid ink 1.3 **with the new mid arrow**, next step = dashed 6-4 ink with the endpoint arrow, road ahead = plain faint ink line (dotted pattern removed). The three italic captions are ruled copy, unchanged. `V.thread` and `V.tw` (in both vibes) are now consumer-less; they join the known-harmless-orphan list (`currentTab`, `label()`) — do not clean up without a ruling.

**Axis alignment and contrast (rulings, July 13, later same day).** Short hops never run at an angle: the source coordinate snaps to the target's connection point (`dir==='right'` → shared y at the target's edge midpoint; vertical hops → shared x at the target's top pin), so the line runs dead horizontal or vertical and lands slightly off-center on the SOURCE — the ruled example is provisional decision → awaiting the challenge, fixed to the challenge's pin and run straight up. Off-center landings are the accepted price. And the thread family lifts its ink above the board furniture: the column/closing dividers render at ink 0.13, and the old faded line sat BELOW them at 0.10 — the states now run 0.34 traveled / 0.5 next / 0.18 future (mid arrows 0.42 / 0.5 / 0.2; the compact `op` ternary matches). The key-card samples already sit above these values and are unchanged.

**Suite 229 → 232, one refinement:** the VII-4 elbow source pin was refined with cause — the rewrite renamed the midpoint expressions, and the pin now binds the full doctrine (straight branch at the 130 constant, elbow constructions, `t-mid` emission, cubics absent). New pins: rendered long-track mid arrows, at least six straight two-point paths in the threads group, and key-card truth (ink samples, mid-arrow sample present, dotted pattern and `V.thread` references absent).

---

# PART VIII — The Deployment File Set (July 13, 2026)

**Ruling:** the multi-file set is the sole source of truth; the single-file build is retired and no longer maintained. The split follows the deployed Innovation Pipeline pattern faithfully, per the dev team's convention document (`Sample_Code_Instructions.docx`, 2,257,056 B · `8c670715be815945d43cd97d00629165`): screen HTML out of `app.js` into `<name>.html`, screen wiring into `<name>.js`, no inline JS in screen templates.

## VIII-1 — What was extracted, and what deliberately was not
Home and Learn only — exactly where the Pipeline's own split landed (its dispatcher keeps insights in `app.js`; verified at their `app.js:1043`, `SCREEN_MODULES={home:…,learn:…}`). The DL's Insights page (dynamic tab bar, helper-built sections) stays in `app.js` as a possible follow-up. The entry gate and every activity surface (cabinet, board, focus reel, Assess, Dashboard — SVG built from state) stay in `app.js`, the same call the Pipeline made. `home.html`/`learn.html` were captured by executing the live renderers against the shipped build (byte-faithful markup, loops baked) and then converting `onclick="go('x')"` → `data-nav="x"` (exactly 10 conversions, count-asserted; Learn had none — its cards are plain links). `ARTICLES`/`BOOKS` remain in `app.js` as dormant data awaiting a ruling; editing the reading list now means editing `learn.html` directly and regenerating the bundle.

## VIII-2 — The set and its load order
`index.html` (thin shell: DL head verbatim with the first-paint theme script INLINE — it must run pre-render; one `styles.css` link; the DL body skeleton verbatim; script order `templates-local.js → screen-loader.js → home.js → learn.js → app.js`) · `styles.css` (the style block verbatim, hero webp included) · `app.js` (the app script minus the two extracted renderers, dispatcher adapted to the Pipeline `SCREEN_MODULES` shape with injection wrapped in `if(!screenFn){…}`) · the two screen pairs · `templates-local.js` (generated file:// fallback bundle — NOT a content layer; regenerate with `node build-templates.js` after editing any screen's `.html`) · `build-templates.js` (authored here — the Pipeline's own was not provided) · `module_smoke.js` ships in the folder like the Pipeline's `harness.js`. Faisal's MP4s sit alongside, referenced relatively, unchanged.

## VIII-3 — screen-loader.js: ported with three DL adaptations (count-asserted)
Pipeline verbatim except: (1) signed-out guard `window.getCurrentUser` → `typeof window.authSignedIn !== 'undefined' && !window.authSignedIn`; (2) zoom source `window.UI && window.UI.zoom` → `window.appZoom || 1`; (3) after the mount injects the zoom-wrap, DL modals are appended — `if (window.currentModal && typeof window.renderModal === 'function') container.insertAdjacentHTML('beforeend', window.renderModal())` — because DL modals render inside `#app` via `openModal(m){currentModal=m;render()}` (marker class `modal-bg`), unlike the Pipeline's separate `#modalRoot`. The Pipeline's shell-only helper scripts (sidebar anchoring, YouTube facade) were not ported — the DL has neither mechanism.

## VIII-4 — Harness: directory mode
`node module_smoke.js <set-dir>` assembles the set in memory (verifies all ten files present, splices `styles.css` into a `<style>`, inlines each `<script src>` in order) so every source pin keeps reading one `html` string; the jsdom fetch stub serves `*.html` from the set (exercising the loader's primary fetch path; the bundle fallback is pin-compared byte-for-byte against the `.html` sources). Single-file paths still boot for archaeology. Suite 235 → **244**: shell shape, renderers shed + dispatch present, screens pure with 10 `data-nav`, bundle-source byte match, the three loader adaptations (Pipeline auth hook asserted absent), and behavioral mounts (home hero + live `data-nav` click-through, learn's baked list, help modal over a mounted screen). Two refinements with cause: the learn wrap pin reads the screen file since the markup left `app.js` (inside the bundle it is JSON-escaped, so the literal vanishes from assembled source — a hazard worth remembering), and the shell-order pin matches full script tags because the load-order comment mentions the filenames first. Ordering note renewed: the Part VIII block navigates, so it sits at the very end of phase4. Environmental note: jsdom must be resolvable from wherever the suite is invoked (`npm install jsdom`), not from the set folder.

## VIII-5 — Post-split audit record (July 13, same day)
An adversarial audit pass ran beyond the suite, targeting what the assembled-document gate cannot see. **Losslessness proofs against the retired single file:** one style block and two script blocks accounted for, nothing between `</style>` and `</head>` or after the app script; `styles.css` md5-identical to the original style block; the `app.js` function-inventory diff is exactly {`renderHome`, `renderLearn`} and the character accounting reconciles to the byte (290,903); `home.html`'s ten `data-nav` targets match the original onclick sequence in order; `learn.html` carries all 10 cards (6 articles + 4 books) with every title present (`BOOKS` is comma-chained onto the `ARTICLES` declaration — there is no `var BOOKS`); the shell's head and body skeleton appear verbatim in `index.html`. **Deployed-shape walks** (real `index.html`, files evaluated as separate compilation units in declared order, jsdom 29 — its `ResourceLoader` export is gone, so the audit harness evaluates per-file): 15/15 over http (fetch path) and 15/15 over file:// with a trap proving the templates-local fallback is used and `fetch` never called. **Static hazard sweeps:** no `$`-pattern sequences in `styles.css` (the harness's string-replace splice would interpret them), no `</script>`/`<script` in any inlined `.js`, all `app.js` element ids either in the shell or dynamically rendered (`voiceFab`/`voiceLabel` are referenced but shell-absent in the retired build too — `updateVoiceUI` null-guards, pre-existing and harmless).

**One defect found and fixed:** the shipped `templates-local.js` was the build script's Python output (`json.dumps`: separator spaces, ASCII escapes; 13,410 B), not the shipped tool's output (`JSON.stringify`, raw UTF-8; 13,325 B) — its header claimed "Generated by build-templates.js" falsely, and the first team regeneration would have churned the file. The tool is the contract: the shipped bundle is now `build-templates.js`'s own output (identity in the table above), and the rule stands — **after any screen edit, the bundle in the set must be the tool's output, never hand- or side-generated.** All gates re-run green after the fix: suite 244/244 on the shipped set, both deploy walks 15/15.

## VIII-6 — Challenge context: label + question + answer (Paul's ruling, July 13)
> **⟶ The AI layer is consolidated in Part IX; this section remains the change record.**
`buildChallengePrompt` no longer sends bare labeled answers. Each exhibit now goes to the model as three lines — the prompt-side label, `QUESTION ASKED: "<the exact question the user answered>"`, and `THEIR ANSWER: "<their text>"` — for all thirteen exhibits (problem/context and leaning included; the decision title stays a single line). The question wording is **looked up live from `SECTIONS` at call time** (`qText(key)` walks `SECTIONS[*].qs`), so question copy edits flow into the AI context automatically with no duplicated strings — closing the drift hazard flagged when the bare-label design was explained. Preserved exactly: the fallback strings (`Not stated` for leaning, `Not answered` for flow fields, description raw), the case-for/case-against word-count NOTE, and the Decision Challenger instruction block verbatim (963 chars, extracted and re-embedded unmodified). The coach and written-profile prompts are untouched. Suite 244 → **246**: a behavioral pin generates a real context from seed demo01 and asserts the friend-test question wording, the seed answer, the NOTE line, and the instruction block; a source pin binds the live `SECTIONS` lookup. A generated context for demo01 runs ~5,090 chars.

## VIII-7 — WHY WE ASK copy correction (Paul's ruling, July 13)
The Assess intake's WHY WE ASK card claimed "Your answers tune the Challenge AI on your board \u2014 it pushes hardest where your intake says you drift." **Verified false against the build:** none of the three AI context builders (`buildChallengePrompt`, `buildCoachContext`, the profile context) reads `data.assessment`; the assessment feeds only the client-side results page, the Dashboard radar pair, and history. Paul's ruled replacement, both tiers, verbatim: **"Understanding your decision style is the starting point for recognizing patterns in your own thinking."** Two sites: the wide `bdSideCard` call (pipe-delimited lines, re-broken at 27/27/27/18 chars \u2014 within the previous 28-char proven measure, card heights stay matched) and the compact `cardsDef` string (103 chars vs the old 104, wrap count unchanged). Note the near-miss lesson repeated: the wide site's pipe-breaks split the phrase ("tune the|Challenge"), so a phrase grep found only the compact site \u2014 call-site reads, not string greps, are the inventory method for piped copy. Render-verified both tiers. Suite 246 \u2192 **248**: a source pin asserts the new copy at both sites with `tune the Challenge`/`says you drift`/`pushes hardest` residue at zero, and a rendered pin mounts the live intake (assessment temporarily cleared, then restored) and finds the corrected card. WHERE IT GOES was verified truthful and is untouched. Flag for the copy edit: sweep for other false mechanism claims \u2014 copy asserting product behavior gets checked against code, not just register.

## VIII-8 — The written-profile round (Paul's rulings, July 14)
> **⟶ The AI layer is consolidated in Part IX; this section remains the change record.**
**Gate:** the profile unlocks at **one decided file** — `decidedCount()` counts decisions whose flow carries a `finalCall`; debrief not required. The old two-opened-decisions gate is gone.

**Prompt (approved verbatim):** `generateProfile`'s system prompt opens with the Decision Profile Analyst preamble describing the module, the training goal, the full decision sequence, and the profile's place on the Dashboard, then lists **the thirteen questions the person answered**, numbered, pulled live from `SECTIONS` via the now-hoisted shared `qText(key)` (the same lookup `buildChallengePrompt` uses — one source, no duplicated question copy). The per-decision context carries **every field at full length** — all truncations (`substring(0,150)`/`(0,200)`) removed — and gains `Problem/context` and `Options check` lines the old builder omitted; the changed-mind NOTE, full debriefs, and the skipped-sections list are preserved. Length instruction 300-400 → **roughly 400-600 words**; `max_tokens` 1500 → **3000** (output headroom — a capped response amputates FOR NEXT TIME and damages `parseProfileP`). Structural headers, second-person register, and the thin-data instruction are verbatim from before, so the parser contract is intact.

**Presentation:** the WRITTEN PROFILE header and box render **always**, both tiers, in place beneath the radar pair; the HTML action strip below the stage is removed, its duties moved into the board. States: ineligible → the box carries "Reach your final call on at least one decision to generate your written profile."; eligible + no profile → the existing explainer line plus a centered GENERATE DECISION PROFILE button; generating → "Analyzing your decisions…"; profile present → panel + cards as before, then bottom-center the precision line — "Your profile sharpens with every decision you add." plus, when the profile is based on exactly one decision, "The biggest jump comes with your second." — the REGENERATE PROFILE / ↻ UPDATE PROFILE — NOW N DECISIONS button, the BASED ON N DECISIONS · GENERATED date caption, and a red "Connection error. Try again." line on failure. The button is now SVG-native (`<g id="profileBtn" onclick="generateProfile()">`, mono-caps label per the family button grammar), and `generateProfile`'s in-flight/error handling switched from HTML button mutation to flags (`profileGenerating`/`profileError`) plus `bdRefreshDash()` — the Challenge's pattern. The dashboard model gains `pstate` (decided, total, generating, error, decisionCount, stale, caption).

**Suite 248 → 253:** a source pin binds the gate, zero truncation residue, `max_tokens:3000` (old 1500 absent), and the preamble/questions/length markers; four rendered pins walk the seeded strip, the eligible-empty button box, the ineligible message (via cloned decisions with `finalCall` stripped, then restored), and the in-flight state. The pre-existing `profileBtn` pins survive unchanged — id and onclick moved intact into the SVG.

**Repair record:** the function-replacement regex ended the old `generateProfile` at the ctx loop's first `\n}\n`, orphaning the old prompt/fetch tail after the new function; caught by the syntax gate, excised with bounds safety checks (orphan had to contain `max_tokens:1500` and must not contain the new preamble). Lesson recorded: non-greedy slices over brace-nested function bodies are not count-assertions — slice between structural markers or verify the captured span's content before replacing.

---

## VIII-9 — The copy digest slot-back (Paul's tracked changes, July 14)

**Ruling:** implement every tracked change in `Decision_Lab_Copy_Digest_Original__1_.docx` (51,123 B · `15f7d7c69e02ca06e46456b83e264ac5`); all highlighting ignored (abandoned signaling experiment, per Paul). The tracked changes ARE the line-item approvals.

**Extraction:** pandoc `--track-changes=accept` / `=reject` pair (1,451 / 1,428 lines); unified diff = 45 hunks, read in full; reconciled against the raw XML (178 `w:ins` / 95 `w:del`, authors Paul Scade only). The digest is pure ASCII (`---` = em dash, `--` = en dash, straight quotes); the build is `\uXXXX`-escaped in `app.js` and literal UTF-8 in `home.html` — every string converted mechanically (dash/quote-pairing/apostrophe pipeline), never retyped. Long carousel bodies were extracted programmatically from the accept text.

**Method:** decode-compare-replace, count-asserted per operation with per-item expected counts; carousel fields replaced value-whole after verifying the extent carries no raw `\'` (it doesn't); atomic — any count surprise aborts before the write (three aborts fired during the round, all resolved by inspection, zero partial writes).

**Inventory — 75 operations:**
- `app.js` (72): Assess intake instruction (**×2 tiers**); WHERE IT GOES side card — compact single-string + wide re-piped to **five** lines (`Your style profile joins the|Dashboard, where your|self-perceived results sit|beside what your decisions|actually reveal.`, 28/21/26/26/16 — fits the fixed 150-high `bdSideCard`, render-verified both tiers); all 21 `ASSESS_QS` option/scenario edits (terminal periods throughout; Q3-A semicolon form, Q5-S "benefits.", Q6-B "the person", Q9-A em-dash form); 3 `ASSESS_NARR` edits (fast_slow "whatever feels most comfortable.", solo_social "committees", opt_prag "comparing, and refining."); 5 guidance tips **×2 variants each** (plain list + `<strong>`-marked list — markup preserved, "(Q2)"/"(Q3)" interface references removed per the tracked text); cabinet subtitle "both active and resolved" (**×2 tiers**); 13 `SECTIONS` items (problem.sub, description/leaning/options/caseFor/anchoring/earlyWarning/provisional/finalCall/debriefSurprise questions, confirmation/anchoring/debriefSurprise placeholders); 23 `CAROUSEL_DATA` fields (problem WHY head+body / HOW head+body / OUT body; thecase WHY+HOW bodies; biascheck WHY+HOW+OUT bodies; stress WHY+HOW bodies + OUT head; provisional WHY body; challenge WHY head+body + OUT body; final WHY+HOW+OUT bodies; debrief WHY+HOW+OUT bodies).
- `home.html` (3): OV-05 "videos, & podcasts"; OV-06 "Curated feed of articles, podcasts, and other materials"; OV-11 "State the decision question, your leaning," — bundle regenerated via `node build-templates.js` (the tool's own output, per the §VIII-5 bundle rule).

**Findings this round:**
- **Two-tier duplication map** (copy that lives twice and must be edited twice): the intake instruction, the five guidance tips (plain + `<strong>` variants), and the cabinet subtitle. `ASSESS_QS`/`ASSESS_NARR`/`SECTIONS`/`CAROUSEL_DATA` are single-source.
- **finalCall collision:** "has it changed? State your final call." exists in the SECTIONS question (changed to "What is your final call?") AND in the final-part carousel HOW body (kept, per the tracked text). Disambiguated by anchoring on the question literal's closing quote.
- **Join artifact, disclosed:** the tracked final-WHY body joins as "decision point.Whether" (deletion artifact); shipped with the space restored — the round's single one-character deviation from the tracked text.
- **Digest-extraction artifact:** the reject rendering drops the bias names from the biascheck HOW body (pandoc); the build already carried them in plain text — the tracked change is capitalization + wording, names kept.
- **SECTIONS copy is AI copy:** the changed questions flow live into the challenge context (`qText`), the written-profile prompt, and both AI state exports, by design (§VIII-6/§VIII-8 grounding).

**Suite:** two pins refined with cause — the compact-cabinet subtitle pin and the challenge-exhibit question pin (both asserted the pre-ruling copy) — and one check added: `copy: July 14 digest slot-back applied with residue zero` (five new strings present in `app.js`, seven old fragments at zero, three home strings present in both `home.html` and the bundle). **258/258.** Gate-invocation hazard recorded: an intermediate gate accidentally ran the workspace's stale suite copy against the set and produced two phantom failures — the ship gate is always **the set's own `module_smoke.js`** against the set.

**Open flags from the digest (need Paul's ruling):**
1. Biascheck OUTCOME now ends "A useful list is available here." — implemented verbatim, but **no link target exists**; needs a URL (and a decision on how a link renders in the carousel) or a rewording.
2. Part I WHY body carries a doubled "up front" ("An honest statement up front about how you are leaning up front…") — implemented verbatim from the tracked text; flagged for review.
3. The digest's OV-01 note repeats the standing program-name ruling request (Leadership Edge vs. Human Edge) — still open.

## VIII-10 — Flag rulings: bias links, profile gating, the name (Paul's rulings, July 14)

**Program name — RESOLVED:** the program is **Leadership Edge**, everywhere. The set already reads Leadership Edge on every surface; residue check confirmed zero "Human Edge" hits across all set files. The standing OV-01 flag and Part II §0's rename directive are closed as confirmed doctrine (Part II §0 remains the sweep protocol for converting older modules).

**Bias-check links (four, URLs per Paul's ruling, verbatim):** in the biascheck HOW body — Confirmation bias → `https://en.wikipedia.org/wiki/Confirmation_bias`, The sunk cost fallacy → `https://en.wikipedia.org/wiki/Sunk_cost#Fallacy_effect`, The anchoring effect → `https://en.wikipedia.org/wiki/Anchoring_effect`; in the biascheck OUTCOME body — "here" → `https://en.wikipedia.org/wiki/List_of_cognitive_biases`. Implementation: `<a href target="_blank" rel="noopener">` inline in the CAROUSEL_DATA strings; the focus-reel body is injected raw into innerHTML (`.fcar-body`), so anchors render, and the global `a{color:var(--gold-text)}` rule styles them in the family accent with no CSS change. New-tab + noopener were implementation judgment (same-tab would navigate out of the app), disclosed. Verified sink-level in jsdom: all four anchors parse with exact text, href, `_blank`, `noopener`. Note: these are Paul-ruled in-app reference links; the no-Wikipedia rule governs citations in written source material and is explicitly waived here by the ruling.

**Part I WHY body:** the doubled "up front" resolved per ruling — the first deleted ("An honest statement about how you are leaning up front also helps…").

**Profile gating — decided files only (Paul's ruling):** the profile prompt and Export 2 were shipping ALL files, so early-phase files appeared with "Sections skipped" lists that the model read as deliberate avoidance. Now `buildProfilePrompt()` filters to decided files (`flow.finalCall` present — the `decidedCount()` predicate; resolved files carry `finalCall` too, so decided-or-closed is one test) and the header reads `DECIDED DECISIONS: N`. Export 2 inherits the fix through the single-source builder. Aligned in the same units so the UI's claims about the profile stay true: the recorded basis `data.profile.decisionCount` now stores `decidedCount()`; staleness compares `decidedCount()` against the recorded basis (not total files); both tiers' `↻ UPDATE PROFILE — NOW N DECISIONS` labels use the decided count. The BASED ON caption reads the recorded basis and is correct by construction. The one-decided-file generation gate (§VIII-8) is unchanged.

**Suite 258 → 260:** two pins refined with cause (the Export-2 header pin to `DECIDED DECISIONS:`; the slot-back residue pin's "useful list" string to its anchored form) and two added — the four-links pin (each URL present in `app.js` with `target="_blank" rel="noopener"` adjacent) and the gating pin (fixture with one decided + one early-phase file: prompt contains the decided title and `DECIDED DECISIONS: 1`, excludes the early-phase title).

## VIII-11 — The runnable DL- prefixed set (Paul's rulings, July 28)

**AWS store-seam verification (July 28, Paul's instruction):** all persistence and network wiring audited for server pluggability. Three seams: (1) **Claude API** — single `CLAUDE_API_URL` constant, all 3 AI fetch sites routed through it, no hardcoded endpoints elsewhere; (2) **Auth** — `AUTH_ENDPOINT` source constant ('' = device-local, per the gov-cloud no-runtime-config rule) with the `Auth` adapter's server branches (`/account`, `/session`) already written and callback-shaped, so repointing needs no call-site surgery; (3) **App data** — everything flows through the `loadData()`/`saveData()` pair over the single key `SK` (`upD()` funnels all field writes; 21 `saveData()` callers). One seam bypass found and fixed this session: `resetAllData()` inlined the SK write instead of calling `saveData()` — behavior-identical locally, but a server-backed store would never have seen the reset; now routed through the seam (one line, suite 260/260). Device-preference keys (`dl-theme`, `dl-zoom`, `dl-rail-min`, `dl-remember`, `dl-lastnotif`) deliberately stay device-local, matching the ER pattern. **Known dev-team accommodation:** `loadData()` is called synchronously at boot; a server-backed load is async, so the swap touches the two store functions plus a small async boot accommodation — unlike Auth, the store pair was not callback-shaped. Legacy `dl-v8` key is a read-only fresh-install migration, boot-local, no seam implication.

> **SUPERSESSION NOTE (July 28, 2026, same day):** later the same day Paul ruled that the DL- prefixed set **is the canonical set** — the sole shipped form used every time from now on. Read this section's “variant beside the canonical set” framing historically: the prefixed set is now simply *the set*; the unprefixed form is retired (its final identities remain in the v2.7 table in this guide's history). The “open recommendation” below is resolved by the same ruling — there is no second set to harmonize; the filename-deriving tools are *the* tools. Retired-form copies were removed from the working outputs to prevent stale-file mix-ups; the seven MP4 videos remain unprefixed always.

**Purpose:** Paul stores and transports the set under `DL-` prefixed filenames (flat chat-upload namespaces clash across modules). Ruled: make the prefixed set run as-is, per the pattern already established in Executive Readiness (`window.__SCREEN_FILE_PREFIX`).

**The variant lives beside the canonical set, which is unchanged and remains the deployment truth.** Six of eleven files are byte-identical to canonical (`app.js`, `styles.css`, `home.html`, `home.js`, `learn.html`, `learn.js` — the module's substance). Five diverge, all pure name-plumbing:

| Variant file | Lines | Bytes | md5 | Delta |
|---|---|---|---|---|
| `DL-index.html` | 52 | 2,771 | `1fd84536dde08e2fef450ce5f5ae1136` | styles href + five script srcs renamed; seam line `<script>window.__SCREEN_FILE_PREFIX="DL-";</script>` before the loaders; regen comment |
| `DL-screen-loader.js` | 135 | 7,100 | `9b885c1defe02bb915e775943579b6e6` | `pfx()` helper reads the seam global (empty default); the screen fetch and both error messages honor it |
| `DL-build-templates.js` | 14 | 1,097 | `555a8d05fc85070206dda2089c63ee4c` | prefix derives from its **own filename**; reads `<PFX><name>.html`, writes `<PFX>templates-local.js` |
| `DL-templates-local.js` | 4 | 13,349 | `b3c943a7322162298eaf801348a79005` | regenerated by the variant tool (header names the actual files; **content/keys identical to canonical** — keys stay `home`/`learn`) |
| `DL-module_smoke.js` | 543 | 56,378 | `208d517644a2367cf2072c971c2b1a4b` | prefix derives from its own filename: REQUIRED list, boot reads, all per-check file reads, and the shell-shape pin's src literals are PFX-built |

**Seam design:** browser side uses ER's explicit global (family consistency); the two Node tools derive the prefix from their own filename, so the identical tool bytes serve any prefix — proven both ways at 260/260: the variant suite against the variant set, and the same bytes renamed `module_smoke.js` against the canonical set (PFX empty).

**Invariants:** bundle keys and `Screens.mount` names stay unprefixed (`home`/`learn` are keys, not filenames). The seven MP4 video files are referenced by canonical name inside `app.js`/`home.html` and are **never prefixed**. Entry-URL caveat: a bare folder URL serves `index.html` by default, so the prefixed variant must be linked as `DL-index.html` explicitly.

**Suite:** one pin refined with cause (the shell-shape load-order pin's literal srcs became PFX-built; intent unchanged). Count stays 260.

**Open recommendation (needs Paul's ruling):** harmonize the canonical set's `build-templates.js` and `module_smoke.js` to these filename-deriving versions, so both sets share identical tool bytes and future suite work happens once. Until ruled, the canonical tools remain untouched at their v2.7 identities.

## VIII-12 — The DECIDED seal moves to the bottom-right corner, inside the card (ruling, August 18)

**The complaint:** on the FINAL CALL card the verdict stamp landed at `(c.x+c.w-64, c.y+44)` at r38/r40 with `MMXXVI` beneath it — a stamp large enough, and high enough on the card, to sit squarely on top of the leader's own words. The decision-files folders had it right already: a small roundel, no Roman year, placed where nothing is written.

**Ruled:** the final call card takes the *folder* seal — no `MMXXVI` — moved to the **bottom-right corner**. **The seal stays wholly INSIDE the card.** A first pass seated it on the corner so it overhung both edges by ~8u; that was rejected on sight (August 18, same day). It is furniture printed on the card, not a sticker crossing its edge — nothing about the roundel may cross the card rect in any tier or vibe.

**Geometry:** `decidedStamp(cx,cy,r)` — `r` defaults to 24 (the folder seal, unchanged) and **everything inside scales with `k = r/24`**: both ring radii, both stroke widths, the font size, the letter-spacing, and the baseline offset. Scaling as one keeps the text's fit inside the ring proportionally identical to the folder's, which is the whole reason the folder seal reads well; changing `r` alone would burst the word out of the circle. The board cards pass **r21** at **`(edge-26, bottom-24)`** — wide `(c.x+c.w-26, c.y+c.h-24)`, compact `(xx+cw-26, yy+ch-24)` — leaving ~5u of card on the right and ~3u below, clear of the voice body's last line.

**Compact earns its room:** at `ch = max(96, c.h*0.82)` the compact final call card has only ~21u below a three-line voice body — not enough for a 42u seal to sit inside it. So `ch` gains **+28 on `c.verdict`** (beside the existing `c.hub?16`). Do not shrink the seal instead: below r21 the word DECIDED no longer fits its ring at a legible size. Column flow absorbs the extra height.

**One builder, three call sites:** `decidedStamp` is called from `exhibitCard`, the compact card path, and `folderSVG` (geometry `(x+w-58, y+tabH+74)`, default r24 — the folders were already correct and stay pixel-identical). Three hand-copied stamp pairs became one; a second inline copy is a defect.

**Consequence — the CARD letter yields the corner:** `CARD P` was drawn at the bottom-right, exactly where the roundel now lands, so on `c.verdict` cards only it moves to the bottom-left (`c.x+13` / `xx+16`, `text-anchor="start"`) in both tiers. Every other card keeps its right-aligned letter. The final call card is not a memo, so the bottom-left is free by construction — do not extend this to `c.memo` cards, whose `LIVE AI IN MODULE · SAMPLE` footer owns that slot.

**Port note:** the scaled values are plain `var`s, not an inner rounding helper. `js-port` reads a function expression in a var declarator as a free global and reported `rd` UNRESOLVED — harmless at runtime, but the UNRESOLVED list is a real error channel and must stay empty.

**Deliberately NOT changed (superseded — see VIII-13):** the DECISION CLOSED stamps (`loopClosedStamp()`, the compact board's closed stamp) still carry `MMXXVI` — the ruling was about the DECIDED seal. §V-519's description of the closing stamp stands.

## VIII-13 — `MMXXVI` comes off every stamp, in both labs (ruling, 4 September 2026)

**The complaint:** the Roman year under DECISION CLOSED on the board. VIII-12 had taken it off the FINAL CALL card's DECIDED seal and deliberately left it everywhere else; the ruling now goes the other way and removes it outright.

**Ruled:** no stamp in either lab carries a year. All ten `<text …>MMXXVI</text>` elements are gone — three in Judgment (`loopClosedStamp()`'s two variants and the compact board's closed stamp) and seven in Conscience (the same three, plus the two `decidedStamp()` variants and the two folder-seal variants).

**Geometry:** the big 42px CLOSED stamps were the only ones that needed moving. Their box is centred on `y` and the label's baseline was `y+2`, which is optically centred only while a second line sits below it at `y+32`; with that line gone the label reads about 15px high in the box. Baseline is now `y+15` — cap height at 42px is ≈29, so the caps straddle the centre. The circular DECIDED seals and the 24px compact stamp are unchanged: a 13.5px label at `cy+4` and a 24px label at `254` in a box centred on `248` were already centred, and moving them would break something that was right.

**Regression guard:** `ee-suite.js` asserted the stamp CONTAINED `MMXXVI`. It now asserts it does not, so a re-port of the reference cannot quietly put it back.

# PART IX — The AI Layer (consolidated, July 14, 2026)
Single home for everything AI in the module. §VIII-6/§VIII-8 remain the change records; this part is the operating description. Later parts govern on conflict.

## IX-1 — The seam
One constant routes every AI call: `var CLAUDE_API_URL='https://api.anthropic.com/v1/messages'` (`app.js`, ~line 20). Deployment repoints it at a proxy that holds the API key server-side and injects auth headers — the requests themselves carry **no** `x-api-key` or `anthropic-version`, so nothing works against the default URL from a browser; the AI features come alive only when the wiring step lands, and the rest of the module runs without them. No runtime configuration (gov-cloud rule). The model is hardcoded in all three request bodies: `claude-sonnet-4-20250514`. Changing model or URL is a build edit — one site for the URL, three for the model.

## IX-2 — The three calls
**The Coach (AI Guide):** the FAB panel, multi-turn (`apiMsgs` conversation history), `max_tokens:1000`. Context via `buildCoachContext` — no assessment data (verified). Not yet reworked under the §VIII-6/§VIII-8 grounding designs; its context builder still uses its original shape.

**The Challenge:** fires automatically, once per decision, when AWAITING THE CHALLENGE opens with no stored challenge (`d.flow.challengeAI` stores the result forever; reopening retries on error). `buildChallengePrompt(d)` sends a single user message (`p.sys`, which embeds the context): the Decision Challenger instruction block, then all thirteen exhibits, each as **label + `QUESTION ASKED` (live from `SECTIONS` via the shared `qText`) + `THEIR ANSWER`** (§VIII-6), with `Not answered`/`Not stated` fallbacks and the case-for/case-against word-count NOTE. `max_tokens:1000`. The user's response to the challenge is never sent back.

**The Written Profile:** button-triggered from the Dashboard's always-present WRITTEN PROFILE box; gate is **one decided file** (`decidedCount()` — a `finalCall` filed, debrief not required). `buildProfilePrompt()` (single source — `generateProfile` and Export 2 both consume it) sends: the approved Analyst preamble (module, goals, sequence, Dashboard destination), the thirteen numbered questions live from `SECTIONS`, then every **decided** decision (`flow.finalCall` present — undecided files are excluded entirely, §VIII-10) with **every field at full length** plus the changed-mind NOTE, full debriefs, and the skipped-sections list; instruction 400-600 words, `max_tokens:3000` (§VIII-8). The response is parsed by `parseProfileP` — tolerant regexes over the five required headers; text before the first header fills the identity panel, the rest feeds the four cards, whose visible titles are UI config, not model output. In-flight/error run on flags (`profileGenerating`/`profileError`) + `bdRefreshDash()`.

## IX-3 — Copy couplings (for the edit pass)
Three places where copy silently drives AI behavior: (1) the thirteen challenge exhibit labels are prompt-side vocabulary, harmless since the real questions ride along, but editable; (2) the profile prompt's five requested section headers are load-bearing — `parseProfileP` must move with any rewording or cards go empty without error; (3) the question texts in `SECTIONS` flow live into both grounded prompts via `qText` — editing them edits the AI context, by design.

## IX-4 — AI state exports (Paul's ruling, July 14)
For locally hosted deployments where the seam is not wired, the nav's **More menu** carries two entries, between Voice and Sign out (initially shipped in BOARD TOOLS; relocated same day per Paul's placement ruling). **Export AI State 1** downloads `decision-lab-ai-state-1-challenges.md`: for every decision with a provisional decision filed (the challenge stage), the exact prompt the Challenge call would send, fenced, one section per decision, with a one-line instruction to paste into Claude; an empty-state line covers no-staged-decisions. **Export AI State 2** downloads `decision-lab-ai-state-2-profile.md`: the exact `buildProfilePrompt()` output at the moment of export, with a decided-count header and, below the gate, a note that the in-app button is locked while the export still shows the prompt. Both ride `dlDownload` (Blob + object URL, authored this round — the module's first download mechanism). Builders (`buildAIState1Md`/`buildAIState2Md`) are separated from the download wrappers so the suite pins content directly.

## IX-5 — Harness and audit notes
The suite's jsdom fetch stub answers every non-`.html` fetch with `{content:[{text:'STUB CHALLENGE'}]}`, so challenge/profile/coach flows run and store stub text; `.html` fetches serve the screen templates in dir mode. Suite 253 → **257**: export source pin (single-source builders, `generateProfile` rides `buildProfilePrompt`, both drawer buttons), two content pins on the generated markdown (fenced Challenger prompt with question grounding; Export 2 containing the exact live profile prompt), and a BOARD TOOLS presence pin. One §VIII-8 pin span refined with cause (the prompt moved into `buildProfilePrompt`). Process note from this round: a sanity check false-alarmed by slicing `buildChallengePrompt` at its nested `function ex(` line — the §VIII-8 slice lesson again, resolved by direct string verification (`'+ctx+'` present; the challenge `sys` does embed its context, and `p.sys` is the complete sent message).
