# The Pipeline — How It Works (Code Reference)

This document explains the **Pipeline** section of the 90‑Day AI Innovation
Pipeline app: the five‑phase workflow, its steps and sections, the gate /
completion machinery, the outputs, and how all of it maps to the code.

It reflects the code as it stands after the modular refactor — the core
pipeline logic lives in `js/app.js`; supporting features (sidebar, charts,
budget/calendar engine) have been split into `js/features/`.

> **Line numbers** drift as the file changes. Search by the **function name**
> in `js/app.js` (or the noted feature file) — those are stable.

---

## 1. The mental model

A user works through **5 phases** over 90 days. Each phase has a handful of
**steps**; some steps split into **sections**. Finishing the work in a step
unlocks a **milestone**, and finishing certain steps produces **outputs**
(the "Outcomes" documents). Ideas entered early flow through a **portfolio
pipeline** (Blue Sky → Exploration → Development → Operational) that the later
phases manage.

```
Phase 1 Diagnose   Days 1–30   1.1 1.2 1.3            → Assessment Report, Blue Sky Portfolio
Phase 2 Organize   Days 31–50  2.1 2.2 2.3 2.4        → Org Readiness, RACI, Exploration Portfolio
Phase 3 Prepare    Days 51–70  3.1 3.2 3.3 3.4        → Capital Snapshot, Development Portfolio
Phase 4 Ignite     Days 71–90  4.1 4.2 4.3 4.4        → Governance, Org Design Review, Updated Portfolio
Phase 5 Navigate   Ongoing     5.1 Pipeline Dashboard → Operational Portfolio, Capital Planning Hub
```

---

## 2. The data model

### 2.1 `PH` — the structure of the whole pipeline (`js/app.js`)

`PH` is the single source of truth for phases, steps, and outputs. Everything —
the sidebar, the step navigation, the routing, progress % — is derived from it.

```js
var PH = [
  { id: 1, name: 'Diagnose', days: 'Days 1–30', color: '#1B6B5A',
    steps:    [ { id: '1.1', name: 'Assessment Battery', icon: '■' }, … ],
    outcomes: [ { id: 'out-report',  name: 'Assessment Report', icon: '□' }, … ] },
  … phases 2–5 …
];
```

| Field | Meaning |
|---|---|
| `id` | phase number 1–5 |
| `name`, `days`, `color` | display + the phase's accent colour |
| `steps[]` | `{ id: '1.1', name, icon }` — the working steps |
| `outcomes[]` | `{ id: 'out-…', name, icon }` — the output documents (and hubs like `cap-hub`) |

Companion tables, also in `js/app.js`:

| Table | Purpose |
|---|---|
| `PHASE_DESCS` | long narrative shown on a phase landing page + linked articles |
| `MILESTONES` | one‑line "you achieved X" text shown when a step is completed |
| `PHASE_WRAPUPS` | phase‑complete summary shown on a phase's **final** step once all its steps are done |
| `STEP_FLOW` | compact step chips (icon + short label) for phase landings |
| `CAROUSEL_CONTENT` | the concept‑carousel slides for each step (see §5) |

### 2.2 `data` — the workspace document

All of a user's answers live in one object, `data`, persisted per organization
(see §10). Each step reads/writes its own keys:

| Step | Primary `data` keys |
|---|---|
| 1.1 Assessment Battery | `purpose`, `knowledge`, `culture`, `audit[]`, `decisions` |
| 1.2 Brainstorm | `ideas[]` |
| 1.3 Filter & Rank | `assessments`, `selected[]` |
| 2.1–2.3 | `ownership`, `incentives`, `rhythm` |
| 2.4 Deepen | `projects{}` (`viable`, `objectives`, `swot`, `gap`, …) |
| 3.1 Structure | `portfolio{}` (`horizon`/`risk`/`reward` bands) |
| 3.2 Capacity | `capital` (`aiBudget`, `periodStart`, `envYears`, …) |
| 3.3 Allocate | `projects` stage membership, `budgetPlans{}` |
| 3.4 / 4.1 Track | `experiments`, `tracking{}` (per‑project status/gates) |
| 4.2–4.4 | `governance`, `stress`, `review` (Buy/Sell/Hold decisions) |

Two special keys drive **completion**:

| Key | Shape | Set by |
|---|---|---|
| `data.completedSections` | `{ '1.1': true, … }` | section Done buttons (only step 1.1 has sub‑sections) |
| `data.completedSteps` | `{ '2.1': true, … }` | step Done buttons |

---

## 3. Navigation & routing — `go()`

Everything is a single page; `go(page, step)` (`js/app.js`) sets three globals
and re‑renders:

- `currentPage` — `'pipeline'` (overview), `'phase'`, `'step'`, `'outcome'`, `'phase5'`, `'cap-hub'`, …
- `currentStep` — e.g. `'1.1'`, a phase id, or an `out-…` id
- `currentPhase` — the resolved `PH` entry

`go()` includes a **bridge** so single‑argument calls from the content work:

```js
go('1.2')        → page 'step',    step '1.2'      (matches /^\d+\.\d/)
go('out-report') → page 'outcome', step 'out-report'
go('phase-2')    → page 'phase',   step '2'
go('5.1')        → page 'phase5'   (the Navigate dashboard is its own page)
```

A **back stack** (`UI.navStack`) is pushed on every real navigation (capped at
25) and popped by `goBack()` / `backBtn()`.

---

## 4. Render flow

`render()` (`js/app.js`) is the master. After the sign‑in gate and the top nav
(`Nav.render()`), it dispatches on `currentPage`:

| `currentPage` | Renderer |
|---|---|
| `pipeline` | `renderPipelineOverview()` |
| `phase` | `renderPhaseLandingPipe(phaseId)` |
| `step` | `renderStep()` |
| `outcome` | `renderOutcome()` |
| `phase5` | `renderPhase5()` (Navigate dashboard) |
| `cap-hub` / `mgmt-hub` | `renderCapHub()` / `renderMgmtHub()` |

The returned HTML string is injected into `#app` (wrapped in a zoom container).
`render()` then paints the sidebar (`renderSidebar()` in `js/features/sidebar.js`),
re‑arms gates, and runs post‑render passes (reveal animation, carousel init).

### 4.1 The step shell — `renderStep()`

For a `step` page, `renderStep()` builds the frame around the actual content:

1. **Breadcrumb** — Back / "← Pipeline", and `Phase N · Name / Step name`
2. **Step nav** — a button per step in the phase; `✓` + `done` class when
   `isStepDone(id)` is true, `active` for the current one
3. **Progress pips** — one dot per step (`active` / `done`)
4. **Header** — eyebrow (`Step id · days · phase`) + title
5. **Assign bar** — `stepAssignBar(currentStep)` → "Assigned to" + owner picker
6. **Content** — `renderStepContent(currentStep)` (see §5)
7. **Milestone card** — `MILESTONES[currentStep]` if the step is done; plus the
   `PHASE_WRAPUPS` card if this is the phase's last step and every step is done
8. **Prev / next** step buttons (computed from a flattened `PH` step list)

### 4.2 `renderStepContent(id)` — the router to step bodies

A straight switch from step id to the per‑step renderer:

```js
'1.1' → renderStep11()   '2.4' → renderStep24()   '4.1' → renderStep41()
'1.2' → renderStep12()   '3.1' → renderStep31()   '4.2' → renderStep42()
'1.3' → renderStep13()   '3.2' → renderStepCap()  '4.3' → renderStep43()
'2.1' → renderStep21()   '3.3' → renderStepAlloc() '4.4' → renderStep44()
'2.2' → renderStep22()   '3.4' → renderStepExp()
'2.3' → renderStep23()   '5.1' → renderPhase5Content()
```

Each `renderStepNN()` returns the HTML for that step's work.

---

## 5. Anatomy of a step body

Using **Step 1.1 (`renderStep11`)** — the screenshot example — as the model.

### 5.1 Concept carousel
Every step opens with `vp('V-1.1.1', title, dur)` → `vpCarousel(...)`, which
pulls that step's slides from `CAROUSEL_CONTENT[stepId]`. It auto‑advances
(hover to pause) and is initialised by `carouselInit()` after render.

### 5.2 Sections (step 1.1 only)
Step 1.1 has **five sections** of two kinds — three *Questionnaire* and two
*Investigative*. The active section is held in `UI.sec`; the tab buttons just
do `UI.sec='1.3'; render()`. A tab shows `✓` when its section is complete
(`data.completedSections[id]`), `○` otherwise.

```
Questionnaire:  1.1 Purpose · 1.2 AI Knowledge · 1.3 Risk & Culture
Investigative:  1.4 AI Innovation Audit · 1.5 Decision Rights
```

Only the active section's `card(...)` is rendered. Other steps are single‑body
(no `UI.sec`).

### 5.3 Fields
Fields are built by shared helpers in `js/app.js`:

| Helper | Renders |
|---|---|
| `ta(label, id, val, ph, rows)` | labelled textarea |
| `sel(label, id, val, opts, help)` | labelled select |
| `likert(label, id, val, lo, hi, help)` | 1–5 rating row |
| `card(inner, style)` / `btn(...)` / `badge(...)` | layout primitives |

Any label containing `*` marks the field **required** — the helper adds the
`gate-field` class, which the gate system keys off (§6).

### 5.4 Saving a field — `fldSave(id, value, live)`
Inputs call `onchange="fldSave(this.id, this.value)"`. `fldSave` parses the id's
**prefix** (`p_` purpose, `k_` knowledge, `cap_` capital, `port_` portfolio,
`exp_`, `trk_`, `bp*` budget plans, …) and writes into the matching `data`
key, then `Store.commit(key)` (see §10). Where a live keystroke shouldn't cause
a full re‑render, it calls `refreshSecDone()` instead (§6). Some prefixes are
**drafts** (`ic_`, `bsic_`) held only in `UI` state until an explicit Add/Save.

---

## 6. Gates & completion

This is the rule engine that decides when a section/step can be marked done and
gives the "complete required fields first" feedback.

### 6.1 The Done button — `doneBtn(onclick, disabled, label, complete, helper)`
- If already **complete** → a static "✓ Complete" button.
- Otherwise → "✓ Mark Complete & Continue →", `disabled` when required fields
  are empty, wrapped in `<div class="done-wrap" onclick="gatePeek(event)">`
  with a helper line.

The `disabled` flag is computed **inline in each `renderStepNN`** from that
step's required fields, e.g. step 1.1 §1.1:
`!(p.mission && p.goals && p.frictions)`.

### 6.2 Highlighting empty required fields — `gatePeek` → `paintGates`
Clicking a *disabled* Done button fires `gatePeek(event)`, which sets
`gateArmed = true` and calls `paintGates()`. `paintGates()` adds `gate-empty`
to every empty `.gate-field` on the page (red outline). `gateArmed` persists
per step so the highlight stays until the fields are filled.

### 6.3 Live re‑evaluation — `refreshSecDone()`
As fields change, `fldSave`/save helpers call `refreshSecDone()`. It finds the
current `.done-btn`, recomputes `ok` for the current step/section using the same
required‑field rules, and toggles the button's `disabled` + the helper's
visibility — **without a full re‑render**, so typing stays smooth. This function
is the canonical list of every step's completion criteria.

### 6.4 Marking complete
Each section/step has a `saveSectionNN()` / step handler that:
1. `confirmSectionDone(id)` / `confirmStepDone(id)` — a `confirm()` (idempotent:
   re‑clicking an already‑complete item is silent, never re‑notifies)
2. writes its `data` values, then sets
   `data.completedSections[id] = true` or `data.completedSteps[id] = true`
3. advances (`UI.sec` to the next section, or leaves the step)
4. `saveData()` + `render()`

Step completion also triggers `notifyStepComplete(id)`
(`js/features/email.js`) — a team email + analytics report (inert until the
AWS endpoint is wired).

### 6.5 Is a step done? — `isStepDone(sid)`
Reads `data.completedSteps` (and, for 1.1, that all five
`completedSections` are set). Used everywhere progress is shown: step‑nav ticks,
pips, sidebar %, milestone cards, and the phase‑complete wrap‑up.

---

## 7. Outputs ("Outcomes")

The `outcomes[]` in each `PH` phase are the documents the work produces
(`out-report`, `out-bluesky`, `out-explore`, `out-capplan`, …). They are
rendered by `renderOutcome()` when `currentPage === 'outcome'`, and are reachable
from the sidebar's **Outputs** list and from links inside steps (e.g. the "✓
Assessment Report available under Outcomes" note on completing step 1.1). An
outcome page reads the same `data` the steps wrote and typically renders a
print‑ready report (there are PDF‑export helpers) plus the relevant charts from
`js/features/charts.js`.

---

## 8. The portfolio / stage engine — `getStages()`

Ideas don't just sit in a list — they move through stages, and Phases 3–5 manage
that flow. `getStages()` (`js/app.js`) derives, from `data`, which item indices
are currently in each stage:

```js
getStages() → { bluesky, explore, experiment, operational, noGo }
```

- **bluesky** — brainstormed ideas not yet selected
- **explore** — selected, being graded (`portfolio` bands)
- **experiment** — advanced into the Development track
- **operational** — launched / in operation
- **noGo** — assessed as not viable

The funnel visual (`pipeViz()`) and the balance analytics
(`balancePanel`, `vizBalanceMap` in `js/app.js`; donut/bar charts in
`js/features/charts.js`) all read from `getStages()`. Capital commitments are
**derived** from stage membership by the engine in `js/features/budget.js`
(nothing is debited; advancing/killing/archiving a project changes the numbers
because the state changed).

---

## 9. Progress display

| Surface | Source |
|---|---|
| Step‑nav `✓` + `done` styling | `isStepDone(id)` |
| Progress pips | `isStepDone(id)` |
| Sidebar phase % (`js/features/sidebar.js`) | share of the phase's steps that are done |
| Milestone card | `MILESTONES[currentStep]` when the step is done |
| Phase‑complete card | `PHASE_WRAPUPS[phase]` when the phase's last step is done and all steps are done |

---

## 10. Persistence

- **`data` is the whole workspace.** `saveData()` → `Store.writeOrg(currentOrgId, data)`.
  Granular writes use `Store.commit(key[, subKey])`.
- **`Store` is a seam.** It points at the PHP + MySQL API under `api/`
  (org data is stored server‑side); device‑local preferences (theme, zoom,
  sidebar, current‑org pointer, remember‑me) stay in `localStorage`.
- **Notes** are private per‑user and MySQL‑backed (`js/features/notes.js`).
- **Collaboration locks** — `Collab.lockedByOther(recordKey)` guards edits so two
  users don't clobber the same record; `fldSave` and the save helpers check it.

---

## 11. Where the code lives (after the refactor)

| Concern | Location |
|---|---|
| `PH`, `MILESTONES`, `PHASE_*`, `STEP_FLOW` | `js/app.js` |
| `go()`, `render()`, `renderStep()`, `renderStepContent()` | `js/app.js` |
| `renderPipelineOverview`, `renderPhaseLandingPipe` | `js/app.js` |
| Per‑step bodies `renderStep11 … renderStep44` + their save helpers | `js/app.js` |
| Gate/field helpers (`ta`, `sel`, `likert`, `doneBtn`, `fldSave`, `paintGates`, `refreshSecDone`, `isStepDone`, `getStages`) | `js/app.js` |
| Left sidebar (phases · steps · outputs) | `js/features/sidebar.js` |
| Analytics charts / balance visuals | `js/features/charts.js` |
| Capital / budget / calendar model | `js/features/budget.js` |
| Step‑completion emails | `js/features/email.js` |

> The per‑step bodies (`renderStep11 … renderStep44`) are the next planned
> extraction into `js/steps/phaseN.js`; when that happens, update the "Per‑step
> bodies" row above. Everything else here stays put.

---

## 12. End‑to‑end example: completing section 1.1

1. User is on `go('step','1.1')` → `renderStep()` → `renderStep11()`; `UI.sec` defaults so the **Purpose** card shows.
2. User types Mission → `fldSave('p_mission', …)` writes `data.purpose.mission`, `Store.commit('purpose')`, `refreshSecDone()` enables the Done button once Mission + Key goals + Friction points are all filled.
3. User clicks **✓ Mark Complete & Continue →** → `saveSection11()`:
   `confirmSectionDone('1.1')` → save fields → `data.completedSections['1.1']=true` → `UI.sec='1.2'` → `saveData()` → `render()`.
4. The Purpose tab now shows `✓`; when all five sections are complete the
   **Assessment Report** unlocks under Outcomes and `renderStep11` appends the radar viz.
