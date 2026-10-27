# Architecture: video file names follow the family convention (26 October 2026)

**For:** the developers of the 90 Days to an AI-Ready Architecture module.  
**Applies to:** the Architecture current build, on top of every earlier directive and addendum.  
**Source:** `Architecture-app.js` (md5 `d57750dcc887534c3281fb345e52e6a9`, 13,327 lines) and `Architecture-home.html` (md5 `15b7f72cedb7d6c025e811ded4ada757`, 141 lines), as they stand once `Directive_DEV_Architecture_KBFixes_Combined_19Oct2026.md` has been applied.

**Checked:** every change below was applied to copies of those files, and each changed file passes `node --check`.
- `Architecture-app.js`: md5 `d57750dcc887534c3281fb345e52e6a9` before, `52219777afc6825705e5cd35a4655b53` after, 13,327 lines both times.
- `Architecture-home.html`: md5 `15b7f72cedb7d6c025e811ded4ada757` before, `23bd131a3a8715bccfb46e373e5614aa` after, 141 lines both times.
- `Architecture-templates-local.js` was regenerated with `Architecture-build-templates.js`, as item 3 requires. Its md5 changes with every run, because the file records the time it was generated.
- The behavioral harness (`Architecture-harness.js`, 686 assertions) and the smoke test (`Architecture-smoke.js`, 99 assertions) give the same results before and after. Two assertions fail both before and after, and neither is touched by this directive: the harness's FONTS check, because the copy I tested had no `fonts` folder, and the smoke test's "CAROUSEL 4 slides each", which still expects eight slides on Step 3.1 although the approved v14 carousels give it four. Neither suite mentions any video file name, so no test changes.

Every change is anchored on quoted text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** A missing anchor means the change needs looking at again rather than forcing in.

Code blocks show the source exactly as it is in the file. Copy them exactly.

**Video names only.** This directive changes nothing except the names of the video files the app calls. It was checked against the build with the knowledge-base directive already applied, since you have that directive. Every quoted text below is the same in the build without it, so the changes apply either way.

---

## What is ruled

Paul ruled on 26 October 2026 that every module in the family names its videos the same way: the module's code, then a standard name. The code for this module is **`arch`**. Phase videos are named by phase number only, with no phase name, so different modules' phase videos can never be confused.

Paul is renaming the video files himself. This directive changes the names the app asks for, so that it calls the renamed files. The module plays eight videos:

| Where it plays | Name the code asks for now | New name |
|---|---|---|
| Home page, program introduction | program-intro.mp4 | arch-program-intro.mp4 |
| Home page, Convergence podcast | convergence-podcast.mp4 | arch-convergence-podcast.mp4 |
| Framework page (module overview, `renderOverview`) | module-overview.mp4 | arch-module-overview.mp4 |
| Phase 1 page | phase1-map.mp4 | arch-phase1.mp4 |
| Phase 2 page | phase2-build.mp4 | arch-phase2.mp4 |
| Phase 3 page | phase3-test.mp4 | arch-phase3.mp4 |
| Phase 4 page | phase4-embed.mp4 | arch-phase4.mp4 |
| Phase 5 Manage page (`renderManage`) | phase5-manage.mp4 | arch-phase5.mp4 |

Only the names change. Every player stays where it is, with the same label, poster image, and size.

**Timing:** the code and the renamed files must go live together. A player whose file name does not match shows nothing. Paul will put the renamed files in place beside `index.html`. Coordinate the release with him.

---

## 1. `Architecture-home.html`

### 1.1

Find (occurs exactly once):

```html
<source src="program-intro.mp4"
```

Replace it with:

```html
<source src="arch-program-intro.mp4"
```

### 1.2

Find (occurs exactly once):

```html
<source src="convergence-podcast.mp4"
```

Replace it with:

```html
<source src="arch-convergence-podcast.mp4"
```

---

## 2. `Architecture-app.js`

### 2.1

Find (occurs exactly once):

```js
<source src="module-overview.mp4"
```

Replace it with:

```js
<source src="arch-module-overview.mp4"
```

### 2.2

Find (occurs exactly once):

```js
{src:'phase1-map.mp4',
```

Replace it with:

```js
{src:'arch-phase1.mp4',
```

### 2.3

Find (occurs exactly once):

```js
{src:'phase2-build.mp4',
```

Replace it with:

```js
{src:'arch-phase2.mp4',
```

### 2.4

Find (occurs exactly once):

```js
{src:'phase3-test.mp4',
```

Replace it with:

```js
{src:'arch-phase3.mp4',
```

### 2.5

Find (occurs exactly once):

```js
{src:'phase4-embed.mp4',
```

Replace it with:

```js
{src:'arch-phase4.mp4',
```

### 2.6

Find (occurs exactly once):

```js
// Phase Five · Manage overview video (drop phase5-manage.mp4 beside index.html)
```

Replace it with:

```js
// Phase Five · Manage overview video (drop arch-phase5.mp4 beside index.html)
```

### 2.7

Find (occurs exactly once):

```js
<source src="phase5-manage.mp4"
```

Replace it with:

```js
<source src="arch-phase5.mp4"
```

---

## 3. Regenerate `Architecture-templates-local.js`

The Home page's two players are in `Architecture-home.html`, and also in `Architecture-templates-local.js`, the bundled copy the app uses when it is opened directly from disk. That file says not to edit it by hand. After the changes above, regenerate it from the folder that holds the module's files:

```
node Architecture-build-templates.js
```

**Before you run it, check the file is in sync.** In the copy this was checked against, the existing `Architecture-templates-local.js` matched the Home and Learn pages exactly, apart from its "Generated:" line. So regenerating it carried only the Home page's two name changes. If your copy is out of sync, regenerating will also carry whatever else differs. To check, regenerate before making the changes and compare the result with your existing file, ignoring the "Generated:" line. **If anything else differs, stop and report it.**

---

## Acceptance

- Each of the eight players asks for its new name, as in the table under "What is ruled". With the renamed files in place, every one plays.
- No file in the module names any of the old video files. A search of the module's folder for each name in the "Name the code asks for now" column finds nothing, except that `program-intro.mp4`, `convergence-podcast.mp4`, and `module-overview.mp4` are also the ending of new names. Every match for them must be inside a new name.
- The Home page's players ask for the new names both when the app is served and when `index.html` is opened directly from disk.
- `node --check` passes on every changed file, and the module's test suite gives the same results as before the change.

## Checklist

- [ ] 1 The names in `Architecture-home.html`
- [ ] 2 The names in `Architecture-app.js`
- [ ] 3 `Architecture-templates-local.js` checked for sync, then regenerated
- [ ] A search of the folder finds none of the old names
- [ ] `node --check` passes, and the test suite gives the same results as before
- [ ] Release coordinated with Paul, so the code and the renamed files go live together

## Per-surface checklist

With the renamed files in place:

- [ ] Home page, the program introduction player plays
- [ ] Home page, the Convergence podcast player plays
- [ ] Framework page, the module overview player plays
- [ ] Phase 1, 2, 3, and 4 pages, each phase's player plays
- [ ] Phase 5 Manage page, the Phase Five player plays
- [ ] The Home page's two players also play with `index.html` opened directly from disk
