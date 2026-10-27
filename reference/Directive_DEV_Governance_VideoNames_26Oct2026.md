# Governance: video file names follow the family convention (26 October 2026)

**For:** the developers of the 90-Day Responsible AI Governance module.  
**Applies to:** the Governance current build, on top of every earlier directive and addendum.  
**Source:** `Governance-app.js` (md5 `a41e381cad994907e83db81e3fddc358`, 8,767 lines), `Governance-home.html` (md5 `7da4387952e32b56f43a2cdaba5e66f9`, 147 lines), and `Governance-smoke.js` (md5 `a214fa53cbd00389593a7dba85abe9bc`, 2,224 lines), from the copies Paul holds, dated 15 October 2026.

**Checked:** every change below was applied to copies of those files, and each changed file passes `node --check`.
- `Governance-app.js`: md5 `a41e381cad994907e83db81e3fddc358` before, `9b53fac71e42399d12aeef7fd9190523` after, 8,767 lines both times.
- `Governance-home.html`: md5 `7da4387952e32b56f43a2cdaba5e66f9` before, `1c840a34d2930280589d023dedf5e125` after, 147 lines both times.
- `Governance-smoke.js`: md5 `a214fa53cbd00389593a7dba85abe9bc` before, `bb7978a532853191f889189f5030d222` after, 2,224 lines both times.
- `Governance-templates-local.js` was regenerated with `Governance-build-templates.js`, as item 4 requires. Its md5 changes with every run, because the file records the time it was generated.
- The smoke test (`Governance-smoke.js`) passes in full before and after: 971 assertions, 0 failures. Two of its assertions name video files and are updated in this directive (item 3): addendum 175 checks the Phase 5 hub's video, and addendum 176 checks the Home page's intro player. Without the update, addendum 175 would fail. Addendum 176 would still pass, but it would no longer find the intro player and so would check nothing.

**Your copy is newer than the one this was checked against.** The developers have changed the live module since these copies were taken. The video names are unlikely to have changed, but the anchors below are quoted from the older copy.

Every change is anchored on quoted text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** A missing anchor means the change needs looking at again rather than forcing in.

Code blocks show the source exactly as it is in the file. Copy them exactly.

**Supersedes:** the Home intro's name, `governance-intro.mp4`, ruled on 16 August 2026. The comment in `PHASE_VIDEOS` that records that ruling is updated to the new name (in item 2), so a search for the file name finds the current one.

---

## What is ruled

Paul ruled on 26 October 2026 that every module in the family names its videos the same way: the module's code, then a standard name. The code for this module is **`gov`**. Phase videos are named by phase number only, with no phase name, so different modules' phase videos can never be confused.

Paul is renaming the video files himself. This directive changes the names the app asks for, so that it calls the renamed files. The module plays eight videos:

| Where it plays | Name the code asks for now | New name |
|---|---|---|
| Home page, program introduction | governance-intro.mp4 | gov-program-intro.mp4 |
| Home page, Convergence podcast | convergence-podcast.mp4 | gov-convergence-podcast.mp4 |
| Module overview page (`renderModuleOverview`) | module-overview.mp4 | gov-module-overview.mp4 |
| Phase 1 page | phase1-map.mp4 | gov-phase1.mp4 |
| Phase 2 page | phase2-build.mp4 | gov-phase2.mp4 |
| Phase 3 page | phase3-assess.mp4 | gov-phase3.mp4 |
| Phase 4 page | phase4-embed.mp4 | gov-phase4.mp4 |
| Phase 5 hub (`renderPhase5`) | phase5-govern.mp4 | gov-phase5.mp4 |

Only the names change. Every player stays where it is, with the same label, poster image, and size.

**Timing:** the code and the renamed files must go live together. A player whose file name does not match shows nothing. Paul will put the renamed files in place beside `index.html`. Coordinate the release with him.

---

## 1. `Governance-home.html`

### 1.1

Find (occurs exactly once):

```html
<source src="governance-intro.mp4"
```

Replace it with:

```html
<source src="gov-program-intro.mp4"
```

### 1.2

Find (occurs exactly once):

```html
<source src="convergence-podcast.mp4"
```

Replace it with:

```html
<source src="gov-convergence-podcast.mp4"
```

---

## 2. `Governance-app.js`

### 2.1

Find (occurs exactly once):

```js
0:{src:'module-overview.mp4',
```

Replace it with:

```js
0:{src:'gov-module-overview.mp4',
```

### 2.2

Find (occurs exactly once):

```js
the program introduction plays on home (governance-intro.mp4)
```

Replace it with:

```js
the program introduction plays on home (gov-program-intro.mp4, renamed 26 Oct 2026)
```

### 2.3

Find (occurs exactly once):

```js
1:{src:'phase1-map.mp4',
```

Replace it with:

```js
1:{src:'gov-phase1.mp4',
```

### 2.4

Find (occurs exactly once):

```js
2:{src:'phase2-build.mp4',
```

Replace it with:

```js
2:{src:'gov-phase2.mp4',
```

### 2.5

Find (occurs exactly once):

```js
3:{src:'phase3-assess.mp4',
```

Replace it with:

```js
3:{src:'gov-phase3.mp4',
```

### 2.6

Find (occurs exactly once):

```js
4:{src:'phase4-embed.mp4',
```

Replace it with:

```js
4:{src:'gov-phase4.mp4',
```

### 2.7

Find (occurs exactly once):

```js
5:{src:'phase5-govern.mp4',
```

Replace it with:

```js
5:{src:'gov-phase5.mp4',
```

---

## 3. `Governance-smoke.js`: the two assertions that name video files

Addendum 175 checks that the Phase 5 hub plays its video. Addendum 176 checks the Home page's intro player. Both now look for the new names.

### 3.1

Find (occurs exactly once):

```js
h.indexOf('phase5-govern.mp4')>=0
```

Replace it with:

```js
h.indexOf('gov-phase5.mp4')>=0
```

### 3.2

Find (occurs exactly once):

```js
var intro=h.indexOf('governance-intro.mp4');
```

Replace it with:

```js
var intro=h.indexOf('gov-program-intro.mp4');
```

---

## 4. Regenerate `Governance-templates-local.js`

The Home page's two players are in `Governance-home.html`, and also in `Governance-templates-local.js`, the bundled copy the app uses when it is opened directly from disk. That file says not to edit it by hand. After the changes above, regenerate it from the folder that holds the module's files:

```
node Governance-build-templates.js
```

**Before you run it, check the file is in sync.** In the copy this was checked against, the existing `Governance-templates-local.js` matched the Home and Learn pages exactly, apart from its "Generated:" line. So regenerating it carried only the Home page's two name changes. If your copy is out of sync, regenerating will also carry whatever else differs. To check, regenerate before making the changes and compare the result with your existing file, ignoring the "Generated:" line. **If anything else differs, stop and report it.**

---

## Acceptance

- Each of the eight players asks for its new name, as in the table under "What is ruled". With the renamed files in place, every one plays.
- No file in the module names any of the old video files. A search of the module's folder for each name in the "Name the code asks for now" column finds nothing, except that `convergence-podcast.mp4` and `module-overview.mp4` are also the ending of new names. Every match for them must be inside a new name.
- The Home page's players ask for the new names both when the app is served and when `index.html` is opened directly from disk.
- `node --check` passes on every changed file, and the module's test suite gives the same results as before the change.

## Checklist

- [ ] 1 The names in `Governance-home.html`
- [ ] 2 The names in `Governance-app.js`
- [ ] 3 The two smoke-test assertions
- [ ] 4 `Governance-templates-local.js` checked for sync, then regenerated
- [ ] A search of the folder finds none of the old names
- [ ] `node --check` passes, and the test suite gives the same results as before
- [ ] Release coordinated with Paul, so the code and the renamed files go live together

## Per-surface checklist

With the renamed files in place:

- [ ] Home page, the program introduction player plays
- [ ] Home page, the Convergence podcast player plays
- [ ] Module overview page, the module overview player plays
- [ ] Phase 1, 2, 3, and 4 pages, each phase's player plays
- [ ] Phase 5 hub, the Phase Five player at the top plays
- [ ] The Home page's two players also play with `index.html` opened directly from disk
