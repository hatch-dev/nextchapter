# Innovation Pipeline: nine fixes found while writing the AI Guide's knowledge base (15 October 2026)

**For:** the developers of the Innovation Pipeline module.  
**Applies to:** the Innovation Pipeline's current build, on top of every earlier directive and addendum.  
**Source:** a full read of `app.js` (md5 `5f03fefbca1e003e06e63bfcb4dcf461`) for the AI Guide's knowledge base. Each fix below was ruled by Paul on 15 October 2026. Item 1 was also confirmed on the live build.  
**Checked:** every change below was applied to that file. It passes `node --check`, and the module's behavioral harness (`harness.js`) runs 1,827 assertions, all passing, before and after the changes.

Every change is anchored on quoted code text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** Your copy may differ from the one this was checked against, and a missing anchor means the code there has already changed.

Code blocks show the source exactly as it is in the file, including its backslash escapes (`\u00b7`, `\xb7`). Copy them exactly.

Appendix A lists every new on-screen word. The checklist and the per-surface checklist are at the end.

---

## 1. Completing Step 1.1 registers as a completed step

**What users see now:** Step 1.1 is completed by finishing its five sections. The last section's save records only that section. The step itself is never recorded as complete, so Track Program (Module Management) shows 1.1 as open, the burn-up and velocity charts never count it, and no completion email is sent. The sidebar shows ✓ because it checks the five sections. Confirmed on live by Paul, 15 October 2026.

**Ruled:** When the fifth section is completed, in whichever order the sections were done, Step 1.1 is recorded as complete, its completion date is stamped, and the step-completion email is sent, exactly as for every other step. Organizations that already finished all five sections are recorded as complete when their data next loads, without a date and without an email (their real completion date is unknown).

### 1.1 In Just before `saveSection11` (the Purpose section's save). Two new functions go in front of it.

Find (occurs exactly once):

```js
function saveSection11(){
```

Replace it with:

```js
function batteryStepDone(){var co=data.completedSections||{};if(!(co['1.1']&&co['1.2']&&co['1.3']&&co['1.4']&&co['1.5']))return;if(!data.completedSteps)data.completedSteps={};if(data.completedSteps['1.1'])return;data.completedSteps['1.1']=true;stampStepDone('1.1');Store.commit('completedSteps')}
function batteryBackfill(){var co=data.completedSections||{};if(co['1.1']&&co['1.2']&&co['1.3']&&co['1.4']&&co['1.5']){if(!data.completedSteps)data.completedSteps={};if(!data.completedSteps['1.1'])data.completedSteps['1.1']=true}}
function saveSection11(){
```

### 1.2 In `saveSection11` (the save for section 1.1 of Step 1.1)

Find (occurs exactly once):

```js
data.completedSections['1.1']=true;
```

Replace it with:

```js
data.completedSections['1.1']=true;batteryStepDone();
```

### 1.3 In `saveSection12` (the save for section 1.2 of Step 1.1)

Find (occurs exactly once):

```js
data.completedSections['1.2']=true;
```

Replace it with:

```js
data.completedSections['1.2']=true;batteryStepDone();
```

### 1.4 In `saveSection13` (the save for section 1.3 of Step 1.1)

Find (occurs exactly once):

```js
data.completedSections['1.3']=true;
```

Replace it with:

```js
data.completedSections['1.3']=true;batteryStepDone();
```

### 1.5 In `saveSection14` (the save for section 1.4 of Step 1.1)

Find (occurs exactly once):

```js
data.completedSections['1.4']=true;
```

Replace it with:

```js
data.completedSections['1.4']=true;batteryStepDone();
```

### 1.6 In `saveSection15` (the save for section 1.5 of Step 1.1)

Find (occurs exactly once):

```js
data.completedSections['1.5']=true;
```

Replace it with:

```js
data.completedSections['1.5']=true;batteryStepDone();
```

### 1.7 In `loadData` (runs whenever an organization's data loads)

Find (occurs exactly once):

```js
data=s?JSON.parse(s):emptyData();ensureRaciModel();ensureCapCostModel();
```

Replace it with:

```js
data=s?JSON.parse(s):emptyData();ensureRaciModel();ensureCapCostModel();batteryBackfill();
```

**Acceptance:**
- In a fresh organization, complete the five sections of Step 1.1 in any order. On the last one, Track Program shows 1.1 as done with today's date, the burn-up counts it, and the step-completion email is sent to team members with email addresses.
- Completing the sections in a different order (for example 1.5 before 1.4) gives the same result, once, on whichever section is last.
- An organization that had finished all five sections before this change shows 1.1 as done in Track Program after reloading, with no date and no email sent.
- Completing an already-complete section again sends nothing.

---

## 2. The Pipeline page's Steps Complete counts 15 steps

**What users see now:** The Pipeline page's "Steps Complete" figure counts 16 steps, including the Pipeline Dashboard (5.1), which can never be completed. It can never reach 16/16.

**Ruled:** The figure counts the 15 program steps (1.1 to 4.4).

### 2.1 In `vizStatStrip` (the four figures on the Pipeline page)

Find (occurs exactly once):

```js
for(var i=0;i<PH.length;i++){var p=PH[i];for(var j=0;j<p.steps.length;j++){stepsTotal++;if(isStepDone(p.steps[j].id))stepsDone++}}
```

Replace it with:

```js
for(var i=0;i<PH.length;i++){var p=PH[i];if(p.id===5)continue;for(var j=0;j<p.steps.length;j++){stepsTotal++;if(isStepDone(p.steps[j].id))stepsDone++}}
```

**Acceptance:**
- With every step done, the Pipeline page shows Steps Complete 15/15.
- A fresh organization shows 0/15.

---

## 3. The dashboard's Next Quarterly Review shows the next review date

**What users see now:** The "Next Quarterly Review" card on the Pipeline Dashboard (and its printed version) always shows the free-text First review date typed at Step 4.2, even after reviews have closed.

**Ruled:** The card shows the next review date the app calculates, the same date as the dashboard's Portfolio Review line: before the first review closes, Day 90 of the program; after that, "by [date]", the end of the review period that follows the last closed review. If the app cannot calculate it, it falls back to the Step 4.2 text, then "TBD".

### 3.1 In Just before `nextReviewLine`. A new function goes in front of it.

Find (occurs exactly once):

```js
function nextReviewLine(){
```

Replace it with:

```js
function nextReviewDateText(){var n=nextReviewInfo();if(!n)return (data.governance||{}).firstReview||'TBD';return (n.first?'':'by ')+fmtDate(n.date)}
function nextReviewLine(){
```

### 3.2 In `renderNavDash` (the Pipeline Dashboard), the "Next Quarterly Review" card

Find (occurs exactly once):

```js
'+(gov.firstReview||'TBD')+'
```

Replace it with:

```js
'+esc(nextReviewDateText())+'
```

### 3.3 In `pipelineDashboardDoc` (the printed Pipeline Dashboard), the "Next Quarterly Review" card

Find (occurs exactly once):

```js
esc(gov.firstReview||'TBD')+'</div>',
```

Replace it with:

```js
esc(nextReviewDateText())+'</div>',
```

**Acceptance:**
- Before any review is closed, the card shows the date of Day 90 of the program.
- After closing a review, the card shows "by [date]", matching the date in the dashboard's Portfolio Review line.
- The printed Pipeline Dashboard shows the same date.

---

## 4. The AI Readiness axis averages all four AI Knowledge answers

**What users see now:** On the Assessment Profile chart at Step 1.1, the AI Readiness axis counts only Leadership awareness, because the other three answers are words. Its hover text says it is "The average of your AI Knowledge Base ratings." The Assessment Report's radar already counts all four.

**Ruled:** The axis averages all four answers on the 1–5 scale the Assessment Report uses (None 1, the second answer 2.3, the third 3.7, the top answer 5; awareness as rated).

### 4.1 In `vizRadar` (the Assessment Profile chart at Step 1.1)

Find (occurs exactly once):

```js
var kVals=[k.usage,k.awareness,k.resources,k.learning].filter(function(v){return typeof v==='number'});
```

Replace it with:

```js
var kVals=['usage','awareness','resources','learning'].map(function(f){var v=k[f];if(typeof v==='number')return v;var r=KNOWLEDGE_SCALE[f]&&KNOWLEDGE_SCALE[f][v];return r||0}).filter(function(v){return v>0});
```

**Acceptance:**
- With Current usage Moderate (3.7), Leadership awareness 4, Technical resources Limited (2.3), and Learning processes Systematic (5), the AI Readiness axis reads 3.8/5.
- The Knowledge axis on the Assessment Report's Readiness Profile reads the same figure.

---

## 5. The Phase 1 page's culture figure is called Culture Average

**What users see now:** The Phase 1 page shows "Culture Score" as an average out of 5. The Assessment Report shows "Culture Score" as a total out of 30. Two different numbers share one name.

**Ruled:** The Phase 1 page's figure is renamed "Culture Average". The Assessment Report's Culture Score (out of 30) is unchanged.

### 5.1 In `renderPhaseLandingPipe` (the phase pages), the Phase 1 figures

Find (occurs exactly once):

```js
{l:'Culture Score',v:cScore+'/5'
```

Replace it with:

```js
{l:'Culture Average',v:cScore+'/5'
```

**Acceptance:**
- The Phase 1 page shows Culture Average n/5. The Assessment Report still shows Culture Score n/30.

---

## 6. The Assessment Report describes Advanced AI use as advanced

**What users see now:** The Assessment Report's summary (on screen and printed) calls an organization whose Current usage is Advanced one with "moderate AI capabilities".

**Ruled:** None and Basic read "limited", Moderate reads "moderate", Advanced reads "advanced".

### 6.1 In `renderOutReport` (the Assessment Report page) and `assessmentReportDoc` (its printed version). This text occurs **exactly twice**. Replace both.

Find (occurs exactly twice):

```js
(k.usage==='none'||k.usage==='basic'?'limited':'moderate')
```

Replace both with:

```js
(k.usage==='advanced'?'advanced':k.usage==='moderate'?'moderate':'limited')
```

**Acceptance:**
- With Current usage Advanced, the summary begins "Organization with advanced AI capabilities" on screen and "An organization with advanced AI capabilities" in print.
- Moderate reads moderate, and None and Basic read limited.

---

## 7. The Capital Snapshot names the Year 1 budget field

**What users see now:** With no budget set, the Capital Snapshot (on screen and printed) says "Set your AI Projects Budget at Step 3.2." The field at Step 3.2 is labeled "Year 1 budget".

**Ruled:** It says "Set your Year 1 budget at Step 3.2."

### 7.1 In `renderOutCapplan` (the Capital Snapshot page) and `capReportBody` (its printed version). This text occurs **exactly twice**. Replace both.

Find (occurs exactly twice):

```js
Set your AI Projects Budget at Step 3.2.
```

Replace both with:

```js
Set your Year 1 budget at Step 3.2.
```

**Acceptance:**
- With no Year 1 budget, the Capital Snapshot page and its printed version both show "Set your Year 1 budget at Step 3.2."

---

## 8. Review History uses Buy, Hold, Sell

**What users see now:** Each closed review in Review History is counted as "[n] Scale · [n] Hold · [n] Kill". Everywhere else, including the Portfolio Review document, the decisions are Buy, Hold, and Sell.

**Ruled:** Review History reads "[n] Buy · [n] Hold · [n] Sell".

### 8.1 In `renderReviewSurface` (Step 4.4 and the Quarterly Portfolio Review page), the Review History lines

Find (occurs exactly once):

```js
b+' Scale \u00b7 '+ho+' Hold \u00b7 '+s+' Kill'
```

Replace it with:

```js
b+' Buy \u00b7 '+ho+' Hold \u00b7 '+s+' Sell'
```

**Acceptance:**
- After closing a review with two Buys, one Hold, and one Sell, Review History shows "2 Buy · 1 Hold · 1 Sell".

---

## 9. Next Innovation Session drops the duration

**What users see now:** The "Next Innovation Session" card on the Pipeline Dashboard (and its printed version) always shows "30 min". No field in the app sets a session length.

**Ruled:** The card shows the day and time, then the attendees, with no duration.

### 9.1 In `renderNavDash` (the Pipeline Dashboard) and `pipelineDashboardDoc` (its printed version), the "Next Innovation Session" card. This text occurs **exactly twice**. Delete both.

Find (occurs exactly twice):

```js
(rh.duration||30)+' min \xb7 '+
```

Delete both. Nothing replaces them.

**Acceptance:**
- The card reads "[day] at [time]" with the attendees beneath, and no "min", on screen and printed.

---

## Appendix A: new on-screen words

| Ref | Item | Where | Words | Status |
|---|---|---|---|---|
| I.1 | 3 | Pipeline Dashboard, Next Quarterly Review | [date] before the first review · by [date] after it (the form the dashboard's Portfolio Review line already uses) | Approved by Paul (15 Oct 2026) |
| I.2 | 5 | Phase 1 page figure | Culture Average | Approved by Paul (15 Oct 2026) |
| I.3 | 6 | Assessment Report summary | advanced (as the third description, beside limited and moderate) | Approved by Paul (15 Oct 2026) |
| I.4 | 7 | Capital Snapshot, no budget set | Set your Year 1 budget at Step 3.2. | Approved by Paul (15 Oct 2026) |
| I.5 | 8 | Review History | [n] Buy · [n] Hold · [n] Sell | Approved by Paul (15 Oct 2026) |

## Checklist

- [ ] 1 Step 1.1 recorded as complete when its fifth section is completed, and backfilled for organizations that already finished (1.1 to 1.7)
- [ ] 2 Steps Complete counts 15 (2.1)
- [ ] 3 Next Quarterly Review shows the calculated date (3.1 to 3.3)
- [ ] 4 AI Readiness averages all four answers (4.1)
- [ ] 5 Culture Average on the Phase 1 page (5.1)
- [ ] 6 Advanced reads advanced (6.1)
- [ ] 7 Year 1 budget message (7.1)
- [ ] 8 Buy · Hold · Sell in Review History (8.1)
- [ ] 9 No duration on Next Innovation Session (9.1)

## Per-surface checklist

- [ ] Step 1.1, all five section saves (item 1)
- [ ] Track Program: Assignments tab row for 1.1, figures, burn-up, velocity, signals (item 1)
- [ ] Step-completion email for Step 1.1 (item 1)
- [ ] Organization load for existing data (item 1)
- [ ] Pipeline page, the four figures (item 2)
- [ ] Pipeline Dashboard on screen and printed: Next Quarterly Review (item 3) and Next Innovation Session (item 9)
- [ ] Step 1.1, Assessment Profile chart (item 4)
- [ ] Phase 1 page figures (item 5)
- [ ] Assessment Report on screen and printed (item 6)
- [ ] Capital Snapshot on screen and printed, with no budget set (item 7)
- [ ] Step 4.4 and the Quarterly Portfolio Review page: Review History (item 8)
