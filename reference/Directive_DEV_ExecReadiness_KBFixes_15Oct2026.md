# Executive Readiness: eight fixes found while writing the AI Guide's knowledge base (15 October 2026)

**For:** the developers of the Executive Readiness module.  
**Applies to:** the Executive Readiness current build, on top of every earlier directive and addendum.  
**Source:** a read of `Exec-Readiness-app.js` (md5 `99f541bd0e4936977cb52e7c4b873ac4`) for the AI Guide's knowledge base. Each fix below was ruled by Paul on 15 October 2026.  
**Checked:** every change below was applied to that file. It passes `node --check`. The module's behavioral harness (`Exec-Readiness-harness.js`, 335 assertions) and boot smoke test (`Exec-Readiness-boot-smoke.js`, 287 assertions) both pass in full, before and after the changes.

Every change is anchored on quoted code text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** Your copy may differ from the one this was checked against, and a missing anchor means the code there has already changed.

Code blocks show the source exactly as it is in the file, including its backslash escapes (`\u25A4`). Copy them exactly.

Appendix A lists the on-screen words that appear in new places. The checklist and the per-surface checklist are at the end.

---

## 1. The Phase 2 page's Collab Model reads Step 2.2

**What users see now:** The Phase 2 page's "Collab Model" figure reads a store (`collabPrinciples`) that only the sample data fills. Step 2.2 saves elsewhere (`collabLab`), so for a real organization the figure always reads "No".

**Ruled:** "Yes" once Step 2.2's Collaboration Models section is marked complete, otherwise "No".

### 1.1 In `renderPhaseHome` (the phase pages), the Phase 2 figures

Find (occurs exactly once):

```js
var collabDone=data.collabPrinciples&&(data.collabPrinciples.aiVoice||data.collabPrinciples.touchpoints)?'Yes':'No';
```

Replace it with:

```js
var collabDone=(data.collabLab||{}).models_done?'Yes':'No';
```

**Acceptance:**
- In a fresh organization, the Phase 2 page shows Collab Model: No.
- After marking Step 2.2's Collaboration Models section complete, it shows Yes.
- The sample organization still shows Yes.

---

## 2. The Phase 4 page's Rhythm Set and Eval Rewired read Steps 4.1 and 4.2

**What users see now:** "Rhythm Set" reads `rhythm.cadence` and "Eval Rewired" reads `evaluation.criteria`. Only the sample data writes either. Steps 4.1 and 4.2 save to `opRhythm` and `evalSuccession`, so for a real organization both figures always read "No".

**Ruled:** Rhythm Set reads "Yes" once Step 4.1 is complete, and Eval Rewired once Step 4.2 is complete, as Review Done already does for Step 4.3.

### 2.1 In `renderPhaseHome` (the phase pages), the Phase 4 figures: Rhythm Set

Find (occurs exactly once):

```js
var rhythmSet=data.rhythm&&data.rhythm.cadence?'Yes':'No';
```

Replace it with:

```js
var rhythmSet=isStepDone('4.1')?'Yes':'No';
```

### 2.2 In `renderPhaseHome` (the phase pages), the Phase 4 figures: Eval Rewired

Find (occurs exactly once):

```js
var evalSet=data.evaluation&&data.evaluation.criteria?'Yes':'No';
```

Replace it with:

```js
var evalSet=isStepDone('4.2')?'Yes':'No';
```

**Acceptance:**
- In a fresh organization, Rhythm Set and Eval Rewired show No.
- After completing Step 4.1, Rhythm Set shows Yes. After completing Step 4.2, Eval Rewired shows Yes.

---

## 3. The Operating Rhythm output drops the Cadence figure

**What users see now:** The Operating Rhythm page's "Cadence" figure and the printed document's "Cadence" section ("Leadership meeting cadence") read `rhythm.cadence`, which only the sample data writes. Step 4.1 has no cadence field, so a real organization always sees "Not set" on screen and an empty Cadence section in print.

**Ruled:** Remove the Cadence figure from the page and the Cadence section from the printed document. The page's band keeps Simulations, Peer Learning, and Board Ed, in three columns.

### 3.1 In `renderOutRhythm` (the Operating Rhythm page), the figures band. The band goes from four columns to three, and the Cadence figure is removed.

Find (occurs exactly once):

```js
grid-template-columns:1fr 1fr 1fr 1fr;gap:1px;margin-bottom:24px;background:rgba(155,45,63,.25)">';
  [{icon:'\u25A4',l:'Cadence',v:cadLabels[rh.cadence]||'Not set'},
```

Replace it with:

```js
grid-template-columns:1fr 1fr 1fr;gap:1px;margin-bottom:24px;background:rgba(155,45,63,.25)">';
  [
```

### 3.2 In `PRINT_DOCS['out-rhythm']` (the printed Operating Rhythm document), the Cadence section. Delete the whole line, including its leading spaces and its line break.

Find (occurs exactly once):

```js
   h+=erSection('Cadence',lyRow('Leadership meeting cadence',cad[rh.cadence]||(rh.cadence?lyCap(rh.cadence):'')));
```

Delete it. Nothing replaces it.

**Acceptance:**
- The Operating Rhythm page shows three figures, Simulations, Peer Learning, and Board Ed, filling the band's width.
- The printed Operating Rhythm document has no Cadence section and starts with the Step 4.1 groups.

---

## 4. The org chart shows the occupant's own commitments

**What users see now:** The role detail panel's "Individual Commitments ([occupant's name])" shows the signed-in user's own Step 3.5 commitments statement, not the occupant's. The same panel prints in the Full Leadership Structure document.

**Ruled:** Show the occupant's own Step 3.5 commitments statement. If the occupant has none, the block does not appear.

### 4.1 In `renderOrgDetail` (the org chart's role detail panel, on screen and in the Full Leadership Structure document). `leader` is the role's occupant, set on the line above.

Find (occurs exactly once):

```js
var cf=data.competencyFramework||{};var rv=data.leadershipReview||{};var ma=myIndivRead('mindsetApp');
```

Replace it with:

```js
var cf=data.competencyFramework||{};var rv=data.leadershipReview||{};var ma=leader?((data.mindsetApp||{})[leader.id]||{}):{};
```

**Acceptance:**
- Signed in as one leader, open the role of another leader who has written Step 3.5 commitments: the panel shows that leader's statement under their name.
- Open the role of a leader with no Step 3.5 statement: no Individual Commitments block appears, even if you have written your own.
- The Full Leadership Structure document shows each occupant's own statement.

---

## 5. Track Program leaves out the individual-track steps

**What users see now:** Track Program's Assignments tab lists every step in each phase, including the individual-track steps 1.4, 2.4, 3.5, and 4.4. Those never write the organization's completion record, so in a real organization they show "open" forever and take assignees and due dates. The Signals line for each phase counts them too, so Phase 1, for example, can never read more than "3 / 4 complete". The figures, burn-up, and velocity already leave them out.

**Ruled:** The Assignments tab and the Signals phase lines cover the 13 shared steps only.

### 5.1 In `mgmtHubContent` (Track Program, the Assignments tab), the per-phase step rows

Find (occurs exactly once):

```js
p.steps.forEach(function(stp){var id2=stp.id;
```

Replace it with:

```js
p.steps.forEach(function(stp){var id2=stp.id;if(INDIVIDUAL_TRACK_STEPS[id2])return;
```

### 5.2 In `mgSignals` (Track Program, the Analytics tab, Signals), the per-phase line: the steps it reads

Find (occurs exactly once):

```js
var meds=PH.filter(function(p){return p.id!==5}).map(function(p){var ds=p.steps.filter(function(st){return co[st.id]&&dts[st.id]})
```

Replace it with:

```js
var meds=PH.filter(function(p){return p.id!==5}).map(function(p){var shared=p.steps.filter(function(st){return !INDIVIDUAL_TRACK_STEPS[st.id]});var ds=shared.filter(function(st){return co[st.id]&&dts[st.id]})
```

### 5.3 In `mgSignals`, the same per-phase line: the counts it shows

Find (occurs exactly once):

```js
var doneN=p.steps.filter(function(st){return co[st.id]}).length;return{p:p,med:med,doneN:doneN,n:p.steps.length}
```

Replace it with:

```js
var doneN=shared.filter(function(st){return co[st.id]}).length;return{p:p,med:med,doneN:doneN,n:shared.length}
```

**Acceptance:**
- The Assignments tab's Phase 1 card lists 1.1, 1.2, and 1.3, with no 1.4. Phases 2 to 4 likewise list no 2.4, 3.5, or 4.4.
- With every shared step done, each Signals phase line reads complete (for example "3 / 3 complete" for Phase 1).
- The step-completion email's analytics show the same.

---

## 6. Step 3.1 is tagged Individual and Collective

**What users see now:** Step 3.1's header tag reads "Individual". It is a shared step: completed once for the organization, assignable, and counted in progress.

**Ruled:** Tag it "Individual" and "Collective", as Step 1.1 is.

### 6.1 In `renderStep` (the step page header tag)

Find (occurs exactly once):

```js
var indiv={'1.4':1,'2.4':1,'3.1':1,'3.5':1,'4.4':1,'5.3':1},both={'1.1':1};
```

Replace it with:

```js
var indiv={'1.4':1,'2.4':1,'3.5':1,'4.4':1,'5.3':1},both={'1.1':1,'3.1':1};
```

**Acceptance:**
- Step 3.1's header shows both the Individual and the Collective tags, as Step 1.1's does.

---

## 7. Leaders' titles come from the role they occupy

**What users see now:** The app's rule is that a leader's title is the name of the role they occupy, or "Unassigned". Several places still read the old `l.role` field, which the leader form no longer writes, so for a real organization the title is blank: the leader folds at Steps 3.1 and 4.3, every leader record (Leadership Inventory, Competency Framework, Review Report, My Development, and the Report Manager), the Report Manager's leader options, and its leader search. The "Add from your leaders" chips for the board and the council fall back to the name.

**Ruled:** Show the occupied role's name, or "Unassigned", everywhere a leader's title is shown, and search by it. Label the chips with the leader's name.

### 7.1 In `renderStep31` (Step 3.1's leader folds) and `renderStep43` (Step 4.3's leader folds). This text occurs **exactly twice**. Replace both.

Find (occurs exactly twice):

```js
esc(l.role||'')
```

Replace both with:

```js
esc(leaderRoleName(l))
```

### 7.2 In `LAYER_MAPS.leader` (every leader record, on screen and in print), the record's title line

Find (occurs exactly once):

```js
meta:[l.role||'',scope,
```

Replace it with:

```js
meta:[leaderRoleName(l),scope,
```

### 7.3 In `rcCatalogue` (the Report Manager's Individual Leaders options)

Find (occurs exactly once):

```js
sub:l.role||''
```

Replace it with:

```js
sub:leaderRoleName(l)
```

### 7.4 In `rcLeaderPasses` (the Report Manager's leader search)

Find (occurs exactly once):

```js
((l.name||'')+' '+(l.role||''))
```

Replace it with:

```js
((l.name||'')+' '+leaderRoleName(l))
```

### 7.5 In `memberStaffingBlock` (Step 2.1, the board's and the council's "Add from your leaders" chips)

Find (occurs exactly once):

```js
esc(l.role||l.name)+'</button>'
```

Replace it with:

```js
esc(l.name||'Leader')+'</button>'
```

**Acceptance:**
- Add a leader with the role "VP Customer Success" (created from the leader form). Steps 3.1 and 4.3 show "VP Customer Success" under the leader's name.
- The Leadership Inventory output and its printout show the same title in the leader's record.
- The Report Manager lists the leader under Individual Leaders with that title, and searching "Customer" finds them.
- A leader left Unassigned shows "Unassigned" in those places.
- Step 2.1's board and council chips show each leader's name.

---

## 8. Leader records use the form's scope words

**What users see now:** Leader records map scope `org`, `function`, `team`, but the leader form saves `org`, `dept`, `team`. A Departmental leader's record reads "Dept", and a team-level leader's reads "Team".

**Ruled:** Use the form's words: Organization-wide, Departmental, Team-level.

### 8.1 In `LAYER_MAPS.leader`, the same line as 7.2: the scope words

Find (occurs exactly once):

```js
var scope={org:'Organization-wide',function:'Function',team:'Team'}[l.scope]
```

Replace it with:

```js
var scope={org:'Organization-wide',dept:'Departmental',function:'Function',team:'Team-level'}[l.scope]
```

**Acceptance:**
- A leader with Scope of impact "Departmental" shows "Departmental" in their record on screen and in print.
- Team-level and Organization-wide leaders show "Team-level" and "Organization-wide".

---

## Appendix A: on-screen words in new places

No new wording is introduced. These existing words appear somewhere they did not before.

| Ref | Item | Where | Words | Status |
|---|---|---|---|---|
| E.1 | 6 | Step 3.1 header | Individual · Collective (the tags Step 1.1 already shows) | Approved by Paul (15 Oct 2026) |
| E.2 | 7 | Leader titles at Steps 3.1 and 4.3, leader records, Report Manager | The occupied role's name, or "Unassigned" (the app's existing rule) | Approved by Paul (15 Oct 2026) |
| E.3 | 8 | Leader records | Organization-wide · Departmental · Team-level (the leader form's own words) | Approved by Paul (15 Oct 2026) |

## Checklist

- [ ] 1 Collab Model reads Step 2.2's Collaboration Models section (1.1)
- [ ] 2 Rhythm Set and Eval Rewired read Steps 4.1 and 4.2 (2.1, 2.2)
- [ ] 3 Cadence removed from the Operating Rhythm page and document (3.1, 3.2)
- [ ] 4 Occupant's own commitments on the role panel (4.1)
- [ ] 5 Individual-track steps out of Track Program's rows and Signals (5.1 to 5.3)
- [ ] 6 Step 3.1 tagged Individual and Collective (6.1)
- [ ] 7 Leader titles from the occupied role (7.1 to 7.5)
- [ ] 8 Scope words in leader records (8.1)

## Per-surface checklist

- [ ] Phase 2 and Phase 4 pages, the figures (items 1, 2)
- [ ] Operating Rhythm output, on screen and printed (item 3)
- [ ] Leadership Dashboard, the role detail panel, and the Full Leadership Structure document (item 4)
- [ ] Track Program, both tabs, and the step-completion email's analytics (item 5)
- [ ] Step 3.1 header (item 6)
- [ ] Steps 3.1 and 4.3 leader folds (item 7)
- [ ] Leader records in the Leadership Inventory, Competency Framework, Review Report, and My Development outputs and their printouts (items 7, 8)
- [ ] Report Manager, Individual Leaders options and search (item 7)
- [ ] Step 2.1, board and council chips (item 7)
