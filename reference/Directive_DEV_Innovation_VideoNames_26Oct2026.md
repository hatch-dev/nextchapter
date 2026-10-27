# Innovation Pipeline: video file names follow the family convention (26 October 2026)

**For:** the developers of the 90-Day AI Innovation Pipeline module.  
**Applies to:** the Innovation Pipeline current build, on top of every earlier directive and addendum.  
**Source:** `app.js` (md5 `5f03fefbca1e003e06e63bfcb4dcf461`, 7,521 lines) and `home.html` (md5 `42e6fc159b171814ec6ecff41f0b23d0`, 141 lines), from the copies Paul holds, dated 15 October 2026.

**Checked:** every change below was applied to copies of those files, and each changed file passes `node --check`.
- `app.js`: md5 `5f03fefbca1e003e06e63bfcb4dcf461` before, `69b26fe6adecfc7095d99651b2be442b` after, 7,521 lines both times.
- `home.html`: md5 `42e6fc159b171814ec6ecff41f0b23d0` before, `38022624e7f3085708d67c86a52360af` after, 141 lines both times.
- `templates-local.js` was regenerated with `build-templates.js`, as item 3 requires. Its md5 changes with every run, because the file records the time it was generated.
- The behavioral harness (`harness.js`) passes in full before and after: 1,829 assertions, 0 failures. It does not mention any video file name, so no test changes.

**Your copy is newer than the one this was checked against.** The developers have changed the live module since these copies were taken. The video names are unlikely to have changed, but the anchors below are quoted from the older copy.

Every change is anchored on quoted text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** A missing anchor means the change needs looking at again rather than forcing in.

Code blocks show the source exactly as it is in the file. Copy them exactly.
---

## What is ruled

Paul ruled on 26 October 2026 that every module in the family names its videos the same way: the module's code, then a standard name. The code for this module is **`innov`**. Phase videos are named by phase number only, with no phase name, so different modules' phase videos can never be confused.

Paul is renaming the video files himself. This directive changes the names the app asks for, so that it calls the renamed files. The module plays eight videos:

| Where it plays | Name the code asks for now | New name |
|---|---|---|
| Home page, program introduction | pipeline-intro.mp4 | innov-program-intro.mp4 |
| Home page, Convergence podcast | convergence-podcast.mp4 | innov-convergence-podcast.mp4 |
| Overview page (module overview, `renderPipelineOverview`) | program-intro.mp4 | innov-module-overview.mp4 |
| Phase 1 page | phase1-diagnose.mp4 | innov-phase1.mp4 |
| Phase 2 page | phase2-organize.mp4 | innov-phase2.mp4 |
| Phase 3 page | phase3-prepare.mp4 | innov-phase3.mp4 |
| Phase 4 page | phase4-ignite.mp4 | innov-phase4.mp4 |
| Phase 5 page | Navigate-Innovation Pipeline.mp4 | innov-phase5.mp4 |

Only the names change. Every player stays where it is, with the same label, poster image, and size.

**Timing:** the code and the renamed files must go live together. A player whose file name does not match shows nothing. Paul will put the renamed files in place beside `index.html`. Coordinate the release with him.

---

## 1. `home.html`

### 1.1

Find (occurs exactly once):

```html
<source src="pipeline-intro.mp4"
```

Replace it with:

```html
<source src="innov-program-intro.mp4"
```

### 1.2

Find (occurs exactly once):

```html
<source src="convergence-podcast.mp4"
```

Replace it with:

```html
<source src="innov-convergence-podcast.mp4"
```

---

## 2. `app.js`

### 2.1

Find (occurs exactly once):

```js
<source src="program-intro.mp4"
```

Replace it with:

```js
<source src="innov-module-overview.mp4"
```

### 2.2

Find (occurs exactly once):

```js
1:{src:'phase1-diagnose.mp4',
```

Replace it with:

```js
1:{src:'innov-phase1.mp4',
```

### 2.3

Find (occurs exactly once):

```js
2:{src:'phase2-organize.mp4',
```

Replace it with:

```js
2:{src:'innov-phase2.mp4',
```

### 2.4

Find (occurs exactly once):

```js
3:{src:'phase3-prepare.mp4',
```

Replace it with:

```js
3:{src:'innov-phase3.mp4',
```

### 2.5

Find (occurs exactly once):

```js
4:{src:'phase4-ignite.mp4',
```

Replace it with:

```js
4:{src:'innov-phase4.mp4',
```

### 2.6

Find (occurs exactly once):

```js
5:{src:'Navigate-Innovation Pipeline.mp4',
```

Replace it with:

```js
5:{src:'innov-phase5.mp4',
```

---

## 3. Regenerate `templates-local.js`

The Home page's two players are in `home.html`, and also in `templates-local.js`, the bundled copy the app uses when it is opened directly from disk. That file says not to edit it by hand. After the changes above, regenerate it from the folder that holds the module's files:

```
node build-templates.js
```

**Before you run it, check the file is in sync.** In the copy this was checked against, the existing `templates-local.js` matched the Home and Learn pages exactly, apart from its "Generated:" line. So regenerating it carried only the Home page's two name changes. If your copy is out of sync, regenerating will also carry whatever else differs. To check, regenerate before making the changes and compare the result with your existing file, ignoring the "Generated:" line. **If anything else differs, stop and report it.**

---

## Acceptance

- Each of the eight players asks for its new name, as in the table under "What is ruled". With the renamed files in place, every one plays.
- No file in the module names any of the old video files. A search of the module's folder for each name in the "Name the code asks for now" column finds nothing, except that `convergence-podcast.mp4` and `program-intro.mp4` are also the ending of new names. Every match for them must be inside a new name.
- The Home page's players ask for the new names both when the app is served and when `index.html` is opened directly from disk.
- `node --check` passes on every changed file, and the module's test suite gives the same results as before the change.

## Checklist

- [ ] 1 The names in `home.html`
- [ ] 2 The names in `app.js`
- [ ] 3 `templates-local.js` checked for sync, then regenerated
- [ ] A search of the folder finds none of the old names
- [ ] `node --check` passes, and the test suite gives the same results as before
- [ ] Release coordinated with Paul, so the code and the renamed files go live together

## Per-surface checklist

With the renamed files in place:

- [ ] Home page, the program introduction player plays
- [ ] Home page, the Convergence podcast player plays
- [ ] Overview page, the module overview player plays
- [ ] Phase 1, 2, 3, 4, and 5 pages (opened from the sidebar), each phase's player plays
- [ ] The Home page's two players also play with `index.html` opened directly from disk
