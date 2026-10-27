# Executive Readiness: video file names follow the family convention (26 October 2026)

**For:** the developers of the Executive Readiness module.  
**Applies to:** the Executive Readiness current build, on top of every earlier directive and addendum.  
**Source:** `Exec-Readiness-app.js` (md5 `99f541bd0e4936977cb52e7c4b873ac4`, 7,730 lines) and `Exec-Readiness-home.html` (md5 `fd4022cb43bc696dcba5e04863a5b1e5`, 139 lines), from the copies Paul holds, dated 15 October 2026.

**Checked:** every change below was applied to copies of those files, and each changed file passes `node --check`.
- `Exec-Readiness-app.js`: md5 `99f541bd0e4936977cb52e7c4b873ac4` before, `0debf440f77f25e16b90f26132c85070` after, 7,730 lines both times.
- `Exec-Readiness-home.html`: md5 `fd4022cb43bc696dcba5e04863a5b1e5` before, `f457b3eb7cdfa8aebbd67d49c0fca64c` after, 139 lines both times.
- `Exec-Readiness-templates-local.js` was regenerated with `Exec-Readiness-build-templates.js`, as item 3 requires. Its md5 changes with every run, because the file records the time it was generated.
- The behavioral harness (`Exec-Readiness-harness.js`, 335 assertions) and the boot smoke test (`Exec-Readiness-boot-smoke.js`, 287 assertions) both pass in full before and after, with 0 failures. Neither mentions any video file name, so no test changes.

**Your copy is newer than the one this was checked against.** The developers have changed the live module since these copies were taken. The video names are unlikely to have changed, but the anchors below are quoted from the older copy.

Every change is anchored on quoted text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** A missing anchor means the change needs looking at again rather than forcing in.

Code blocks show the source exactly as it is in the file. Copy them exactly.
---

## What is ruled

Paul ruled on 26 October 2026 that every module in the family names its videos the same way: the module's code, then a standard name. The code for this module is **`exec`**. Phase videos are named by phase number only, with no phase name, so different modules' phase videos can never be confused.

Paul is renaming the video files himself. This directive changes the names the app asks for, so that it calls the renamed files. The module plays eight videos:

| Where it plays | Name the code asks for now | New name |
|---|---|---|
| Home page, program introduction | program-overview.mp4 | exec-program-intro.mp4 |
| Home page, Convergence podcast | convergence-ep18.mp4 | exec-convergence-podcast.mp4 |
| Module overview page (`renderOverview`) | Module Overview Executive Readiness.mp4 | exec-module-overview.mp4 |
| Phase 1 page | Phase One Assess.mp4 | exec-phase1.mp4 |
| Phase 2 page | Phase Two Build.mp4 | exec-phase2.mp4 |
| Phase 3 page | Phase Three Develop.mp4 | exec-phase3.mp4 |
| Phase 4 page | Phase Four Embed.mp4 | exec-phase4.mp4 |
| Phase 5 Lead, the dashboard (`renderDashboardBody`) | Phase Five The Leadership System.mp4 | exec-phase5.mp4 |

Only the names change. Every player stays where it is, with the same label, poster image, and size.

**Timing:** the code and the renamed files must go live together. A player whose file name does not match shows nothing. Paul will put the renamed files in place beside `index.html`. Coordinate the release with him.

---

## 1. `Exec-Readiness-home.html`

### 1.1

Find (occurs exactly once):

```html
<source src="program-overview.mp4"
```

Replace it with:

```html
<source src="exec-program-intro.mp4"
```

### 1.2

Find (occurs exactly once):

```html
<source src="convergence-ep18.mp4"
```

Replace it with:

```html
<source src="exec-convergence-podcast.mp4"
```

---

## 2. `Exec-Readiness-app.js`

### 2.1

Find (occurs exactly once):

```js
// Module overview video (Module Overview Executive Readiness.mp4 beside index.html)
```

Replace it with:

```js
// Module overview video (exec-module-overview.mp4 beside index.html)
```

### 2.2

Find (occurs exactly once):

```js
<source src="Module Overview Executive Readiness.mp4"
```

Replace it with:

```js
<source src="exec-module-overview.mp4"
```

### 2.3

Find (occurs exactly once):

```js
1:{src:'Phase One Assess.mp4',
```

Replace it with:

```js
1:{src:'exec-phase1.mp4',
```

### 2.4

Find (occurs exactly once):

```js
2:{src:'Phase Two Build.mp4',
```

Replace it with:

```js
2:{src:'exec-phase2.mp4',
```

### 2.5

Find (occurs exactly once):

```js
3:{src:'Phase Three Develop.mp4',
```

Replace it with:

```js
3:{src:'exec-phase3.mp4',
```

### 2.6

Find (occurs exactly once):

```js
4:{src:'Phase Four Embed.mp4',
```

Replace it with:

```js
4:{src:'exec-phase4.mp4',
```

### 2.7

Find (occurs exactly once):

```js
// Phase Five Lead overview video (Phase Five The Leadership System.mp4 beside index.html)
```

Replace it with:

```js
// Phase Five Lead overview video (exec-phase5.mp4 beside index.html)
```

### 2.8

Find (occurs exactly once):

```js
<source src="Phase Five The Leadership System.mp4"
```

Replace it with:

```js
<source src="exec-phase5.mp4"
```

---

## 3. Regenerate `Exec-Readiness-templates-local.js`

The Home page's two players are in `Exec-Readiness-home.html`, and also in `Exec-Readiness-templates-local.js`, the bundled copy the app uses when it is opened directly from disk. That file says not to edit it by hand. After the changes above, regenerate it from the folder that holds the module's files:

```
node Exec-Readiness-build-templates.js
```

**Before you run it, check the file is in sync.** In the copy this was checked against, the existing `Exec-Readiness-templates-local.js` matched the Home and Learn pages exactly, apart from its "Generated:" line. So regenerating it carried only the Home page's two name changes. If your copy is out of sync, regenerating will also carry whatever else differs. To check, regenerate before making the changes and compare the result with your existing file, ignoring the "Generated:" line. **If anything else differs, stop and report it.**

---

## Acceptance

- Each of the eight players asks for its new name, as in the table under "What is ruled". With the renamed files in place, every one plays.
- No file in the module names any of the old video files. A search of the module's folder for each name in the "Name the code asks for now" column finds nothing.
- The Home page's players ask for the new names both when the app is served and when `index.html` is opened directly from disk.
- `node --check` passes on every changed file, and the module's test suite gives the same results as before the change.

## Checklist

- [ ] 1 The names in `Exec-Readiness-home.html`
- [ ] 2 The names in `Exec-Readiness-app.js`
- [ ] 3 `Exec-Readiness-templates-local.js` checked for sync, then regenerated
- [ ] A search of the folder finds none of the old names
- [ ] `node --check` passes, and the test suite gives the same results as before
- [ ] Release coordinated with Paul, so the code and the renamed files go live together

## Per-surface checklist

With the renamed files in place:

- [ ] Home page, the program introduction player plays
- [ ] Home page, the Convergence podcast player plays
- [ ] Module overview page, the module overview player plays
- [ ] Phase 1, 2, 3, and 4 pages, each phase's player plays
- [ ] Phase 5 Lead dashboard, the Phase Five player plays
- [ ] The Home page's two players also play with `index.html` opened directly from disk
