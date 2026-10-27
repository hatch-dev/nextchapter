# Governance: eleven fixes found while writing the AI Guide's knowledge base (15 October 2026)

**For:** the developers of the Governance module.  
**Applies to:** the Governance module's current build, on top of every earlier directive and addendum.  
**Source:** a full read of `Governance-app.js` (md5 `a41e381cad994907e83db81e3fddc358`) for the AI Guide's knowledge base. Each fix below was ruled by Paul on 15 October 2026.  
**Checked:** every change below was applied to that file. It passes `node --check`, and the module's smoke suite runs 967 pass, 4 fail. The 4 failing checks are the ones written for the old behavior these fixes replace (items 3, 9 and 10). They are ours to update, not yours.

Every change is anchored on quoted code text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** Where a change replaces a span, find the start text, then the end text later on the same line, and replace everything from the start of the first to the end of the second.

Code blocks show the source exactly as it is in the file, including its backslash escapes (`\u2014`, `\'`). Copy them exactly.

Appendix A lists every new on-screen word. The checklist and the per-surface checklist are at the end.

---

## 1. Recurring tests: a frequency dropdown, and every frequency can go overdue

**What users see now:** On Step 3.3 and the Testing Center, a recurring test's frequency is a free-text box ("How often (e.g., monthly)"). The overdue check only recognizes the exact lowercase words daily, weekly, biweekly and monthly. A test with "Monthly" or "quarterly" typed in never shows OVERDUE and always reads On schedule.

**Ruled:** Replace the box with a dropdown: Daily, Weekly, Every two weeks, Monthly, Quarterly. Every option counts toward OVERDUE. Frequencies already typed into existing tests are read without regard to capitals or spaces, and "every two weeks", "bi-weekly" and "fortnightly" read as Every two weeks, so existing tests keep working.

### 1.1 In The constant `MN_PERIOD` (near the monitoring-plan code)

Find (occurs exactly once):

```js
var MN_PERIOD={daily:1,weekly:7,biweekly:14,monthly:30};
```

Replace it with:

```js
var MN_PERIOD={daily:1,weekly:7,biweekly:14,monthly:30,quarterly:90};
var TT_FREQ=[{v:'daily',l:'Daily'},{v:'weekly',l:'Weekly'},{v:'biweekly',l:'Every two weeks'},{v:'monthly',l:'Monthly'},{v:'quarterly',l:'Quarterly'}];
function ttFreqKey(f){var k=String(f||'').replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'').toLowerCase();if(k==='every two weeks'||k==='bi-weekly'||k==='fortnightly')k='biweekly';return MN_PERIOD.hasOwnProperty(k)?k:''}
function ttFreqLabel(f){var k=ttFreqKey(f);var o=TT_FREQ.filter(function(x){return x.v===k})[0];return o?o.l:String(f||'')}
```

### 1.2 In `testState` (the function that decides NOT YET RUN, Run ✓, On schedule, OVERDUE)

Find (occurs exactly once):

```js
var per=MN_PERIOD[t.frequency];if(!per)return 'ok';
```

Replace it with:

```js
var per=MN_PERIOD[ttFreqKey(t.frequency)];if(!per)return 'ok';
```

### 1.3 In `ttDesignFields` (the Design the Tests form), the box shown when the test is Recurring

Find (occurs exactly once):

```js
'<input value="'+esc(t.frequency||'')+'" placeholder="How often (e.g., monthly)" onchange="ttFieldSave(\''+s.id+'\',\''+t.id+'\',\'frequency\',this.value)" style="flex:1;min-width:240px;'+WB_INP+'"/>'
```

Replace it with:

```js
'<select onchange="ttFieldSave(\''+s.id+'\',\''+t.id+'\',\'frequency\',this.value);render()" style="'+WB_SEL+'"><option value="">Select frequency...</option>'+TT_FREQ.map(function(o){return '<option value="'+o.v+'"'+(ttFreqKey(t.frequency)===o.v?' selected':'')+'>'+o.l+'</option>'}).join('')+'</select>'
```

### 1.4 In `ttEvidenceCore` (Tests & Evidence): the test header and the test's run details. This text occurs **exactly twice**. Replace both.

Find (occurs exactly twice):

```js
'Recurring'+(t.frequency?' \u00b7 '+esc(t.frequency):'')
```

Replace both with:

```js
'Recurring'+(t.frequency?' \u00b7 '+esc(ttFreqLabel(t.frequency)):'')
```

### 1.5 In `lyTestText` (how a test prints in documents)

Find (occurs exactly once):

```js
(t.frequency?' \u2014 '+t.frequency:'')
```

Replace it with:

```js
(t.frequency?' \u2014 '+ttFreqLabel(t.frequency):'')
```

**Acceptance:**
- On Design the Tests, a Recurring test shows a dropdown (Select frequency..., Daily, Weekly, Every two weeks, Monthly, Quarterly), not a text box.
- A Recurring test set to Quarterly whose last evidence is more than 90 days old shows OVERDUE. The same for every other option at its own period (1, 7, 14, 30 days).
- An existing test whose stored frequency is "Monthly" (capital M) shows Monthly in the dropdown and goes OVERDUE after 30 days.
- The test header and run details on Tests & Evidence, and the printed Testing & Evidence document, show the frequency as its label (for example "Every two weeks").

---

## 2. Analytics: the Risk Explorer column and Top Exposures line show what they are

**What users see now:** The Risk Explorer column headed "L×I" shows the composite score (Likelihood + Impact + Timeframe). Top Exposures shows the composite with an "nL × nI" line beneath it, which reads as a multiplication.

**Ruled:** Rename the Risk Explorer column to "Composite". Under each Top Exposures score, show the three scores as "L4 · I3 · T2".

### 2.1 In `anExplorer` (Risk Explorer), the column list

Find (occurs exactly once):

```js
['exp','L\u00d7I','center']
```

Replace it with:

```js
['exp','Composite','center']
```

### 2.2 In `anTopExposures` (Top Exposures), the small line under the score

Find (occurs exactly once):

```js
x.L+'L \u00d7 '+x.I+'I</div>
```

Replace it with:

```js
'L'+x.L+' \u00b7 I'+x.I+' \u00b7 T'+(x.r.litT||0)+'</div>
```

**Acceptance:**
- The Risk Explorer's eighth column is headed Composite, and sorting by it orders by composite.
- Each Top Exposures row shows the composite as the large number with a line beneath reading L[n] · I[n] · T[n].

---

## 3. Risk Register CSV: the right score names

**What users see now:** The ⬇ Risk Register CSV headers say "Importance (I)" and "Time Horizon (T)". Everywhere else the app calls these Impact and Timeframe.

**Ruled:** The headers read "Impact (I)" and "Timeframe (T)".

### 3.1 In `exportRiskCSV`, the header row

Find (occurs exactly once):

```js
'Importance (I)','Time Horizon (T)'
```

Replace it with:

```js
'Impact (I)','Timeframe (T)'
```

**Acceptance:**
- A downloaded risk_register.csv has the headers Likelihood (L), Impact (I), Timeframe (T).

---

## 4. The monitoring plan's one field is called Owner everywhere

**What users see now:** The monitoring plan has one field, labeled Owner in its editor. Printed registers call it "What is being monitored", the Management & Monitoring Plans output calls it "Monitor:", and the incomplete-plan line in printed registers asks for "a monitoring statement".

**Ruled:** Call it Owner on every surface. The incomplete-plan line reads: "The monitoring plan is incomplete: it needs an owner and at least one indicator."

### 4.1 In `LAYER_MAPS.risk`, the Monitoring plan layer's incomplete message

Find (occurs exactly once):

```js
it needs a monitoring statement and at least one indicator.
```

Replace it with:

```js
it needs an owner and at least one indicator.
```

### 4.2 In `LAYER_MAPS.risk`, the Monitoring plan layer's first field

Find (occurs exactly once):

```js
{label:'What is being monitored',
```

Replace it with:

```js
{label:'Owner',
```

### 4.3 In `renderOutExitPlans` (the Management & Monitoring Plans output)

Find (occurs exactly once):

```js
<strong>Monitor:</strong>
```

Replace it with:

```js
<strong>Owner:</strong>
```

**Acceptance:**
- The Updated Risk Register printed at Full shows the monitoring plan's first row as Owner.
- A Monitor card whose plan has an owner but no indicator prints the line ending "it needs an owner and at least one indicator."
- The Management & Monitoring Plans output shows "Owner: [name]" for each monitored risk.

---

## 5. Analytics: snapshots are described as daily

**What users see now:** Snapshots are taken every day on live. The Metric Trends subtitle and the message shown before there are two snapshots both say they are taken when Analytics is opened.

**Ruled:** The subtitle reads "Snapshots recorded automatically every day". The early message reads "Trends build over time — a snapshot of key metrics is recorded automatically every day. Come back tomorrow to see movement."

### 5.1 In `renderAnalytics` and `analyticsDoc`, the Metric Trends subtitle. This text occurs **exactly twice** (the page and its printed document). Replace both.

Find (occurs exactly twice):

```js
Daily snapshots, recorded automatically when Analytics is opened
```

Replace both with:

```js
Snapshots recorded automatically every day
```

### 5.2 In `anTrends`, the message shown before there are two snapshots

Find (occurs exactly once):

```js
recorded automatically each day you open Analytics. Come back tomorrow to see movement.
```

Replace it with:

```js
recorded automatically every day. Come back tomorrow to see movement.
```

**Acceptance:**
- The Metric Trends card on the Analytics page and in the printed Analytics document both carry the new subtitle.
- In a workspace with fewer than two snapshots, Metric Trends shows the new message.

---

## 6. Compliance Dashboard: remove the promise of a judgment column

**What users see now:** The paragraph above the NIST tables says the page records "what you have determined", the organization's own dated judgment. No row shows or records one.

**Ruled:** Cut that sentence (Paul's ruling). Two consequential edits keep the paragraph true: "Three things" becomes "Two things", and the last sentence ends at "It locates evidence."

### 6.1 In `renderComplianceDashboard`, the paragraph above the NIST tables

Find (occurs exactly once):

```js
Three things live in separate columns and are deliberately kept apart. What NIST asks, in its own words. Where work of that kind lives in this program, with a green check recording the plain fact that the work there is done. And what you have determined \u2014 your organization\'s own judgment, made by a named person on a date, revisable with its history kept. This dashboard does not assert compliance on your behalf. It locates evidence and records your judgment.
```

Replace it with:

```js
Two things live in separate columns and are deliberately kept apart. What NIST asks, in its own words. Where work of that kind lives in this program, with a green check recording the plain fact that the work there is done. This dashboard does not assert compliance on your behalf. It locates evidence.
```

**Acceptance:**
- The NIST page's opening paragraph reads exactly as the replacement text below, with no mention of your judgment.

---

## 7. Governance Framework: remove the Reassessment tile

**What users see now:** The Governance Framework document always shows "Reassessment: Not set". No step in the app sets it.

**Ruled:** Remove the Reassessment tile. The row keeps New Risk Review, Gov Meeting and Deploy Gate.

### 7.1 In `govFWBody` (the Governance Framework document), the row of status tiles

Find (occurs exactly once):

```js
,{label:'Reassessment',value:eo.reassessFrequency,icon:'\u229f'}
```

Delete it. Nothing replaces it.

**Acceptance:**
- The Governance Framework output, its printed version, the Governance Framework fold on Step 4.4 and on the Governance Review page all show three status tiles, none called Reassessment.

---

## 8. Confirm before deleting a system or a risk

**What users see now:** × Remove on the Step 1.2 systems list and × Remove on a Step 1.3 risk card delete immediately, with no prompt.

**Ruled:** Both ask first. Removing a system also tells the person how many risks are attached, and those risks are unlinked from it rather than left pointing at a system that no longer exists.

### 8.1 In `removeSystem` (× Remove on the Step 1.2 list)

Find (occurs exactly once):

```js
function removeSystem(id){if(lockBlocked('systems::'+id))return;data.systems=(data.systems||[]).filter(function(s){return s.id!==id});saveData();render()}
```

Replace it with:

```js
function removeSystem(id){if(lockBlocked('systems::'+id))return;var _rs=(data.systems||[]).filter(function(s){return s.id===id})[0];if(!_rs)return;var _ra=(data.risks||[]).filter(function(r){return r&&r.systemId===id}).length;if(!confirm('Remove \u201c'+(_rs.name||'this system')+'\u201d from the inventory?'+(_ra?' '+_ra+(_ra===1?' risk is':' risks are')+' attached to it and will no longer be linked to a system.':'')+' This cannot be undone.'))return;(data.risks||[]).forEach(function(r){if(r&&r.systemId===id)r.systemId=null});data.systems=(data.systems||[]).filter(function(s){return s.id!==id});saveData();render()}
```

### 8.2 In `removeRisk` (× Remove on a Step 1.3 card)

Find (occurs exactly once):

```js
function removeRisk(id){if(lockBlocked('risks::'+id))return;data.risks=(data.risks||[]).filter(function(r){return r.id!==id});saveData();render()}
```

Replace it with:

```js
function removeRisk(id){if(lockBlocked('risks::'+id))return;var _rr=(data.risks||[]).filter(function(r){return r.id===id})[0];if(!_rr)return;if(!confirm('Remove \u201c'+(_rr.name||'this risk')+'\u201d? The risk card is deleted, not archived. This cannot be undone.'))return;data.risks=(data.risks||[]).filter(function(r){return r.id!==id});saveData();render()}
```

**Acceptance:**
- × Remove on a system shows: Remove “[name]” from the inventory? [N] risk(s) [is/are] attached to it and will no longer be linked to a system. This cannot be undone. (The middle sentence only when N is more than 0.) Cancel changes nothing.
- Confirming removes the system and sets each attached risk's Associated system to none. Those risks then show as having no system.
- × Remove on a Step 1.3 card shows: Remove “[name]”? The risk card is deleted, not archived. This cannot be undone. Cancel changes nothing.

---

## 9. Step 4.4 completes once the review has been saved

**What users see now:** Save governance review logs the review and clears the agenda's Covered marks, but the step's completion button needs those marks. Someone who saves the review first cannot complete the step without marking every item again.

**Ruled:** Step 4.4 completes once a Governance Review has been logged. The completion button checks the review log, not the Covered marks.

### 9.1 In `dataGateOK`, the Step 4.4 line

Find (occurs exactly once):

```js
if(sid==='4.4'){var wk=((data.firstReview||{}).walk)||{};return ['planned','stuck','systems','tests','compliance','review'].every(function(k){return !!wk[k]})}
```

Replace it with:

```js
if(sid==='4.4'){return (data.reviewLog||[]).some(function(e){return e&&e.kind==='governance'})}
```

### 9.2 In `dataGateMsg`, the Step 4.4 line. Replace the whole line: from the start text up to and including the end text. There is a comment in the middle of this line, and it goes too.

Start text (occurs exactly once):

```js
if(sid==='4.4'){var wk4=((data.firstReview||{}).walk)||{};
```

End text (occurs exactly once, later on the same line):

```js
still to cover. The step completes when the review has actually been held.'}
```

Replace the whole span with:

```js
if(sid==='4.4'){if(!(data.reviewLog||[]).some(function(e){return e&&e.kind==='governance'}))return 'Hold the review first \u2014 cover every agenda item, answer the three questions, and click Save governance review. The step completes once the review is saved.'}
```

**Acceptance:**
- Cover every agenda item, answer the three questions, click Save governance review, then click ✓ Mark step complete and continue →: the step completes.
- Before any Governance Review has been logged, the completion button is disabled and the line under it reads: Hold the review first — cover every agenda item, answer the three questions, and click Save governance review. The step completes once the review is saved.

---

## 10. All seven agenda items must be covered to log a Governance Review

**What users see now:** Save governance review (Step 4.4) and ✓ Log this review (the Governance Review page) appear once items 1–5 and 7 are covered. Item 6, the RACI check, never has to be covered.

**Ruled:** Both buttons appear only when all seven items are marked covered.

### 10.1 In `renderGovReview` (the standing Governance Review page), the check that shows **✓ Log this review**

Find (occurs exactly once):

```js
var _gvAll=(function(){var wk=((data.firstReview||{}).walk)||{};return ['planned','stuck','systems','tests','compliance','review']
```

Replace it with:

```js
var _gvAll=(function(){var wk=((data.firstReview||{}).walk)||{};return ['planned','stuck','systems','tests','compliance','resp','review']
```

### 10.2 In `render44` (Step 4.4), the check that shows **Save governance review**

Find (occurs exactly once):

```js
var _wkAll=(function(){var wk=((data.firstReview||{}).walk)||{};return ['planned','stuck','systems','tests','compliance','review']
```

Replace it with:

```js
var _wkAll=(function(){var wk=((data.firstReview||{}).walk)||{};return ['planned','stuck','systems','tests','compliance','resp','review']
```

**Acceptance:**
- On Step 4.4 and on the Governance Review page, with items 1–5 and 7 covered and item 6 not, neither button shows. Marking item 6 covered shows it.

---

## 11. Program Coverage: Rhythm kept judges each indicator against its own frequency

**What users see now:** The Rhythm kept bar judges a monitored risk's latest check against the monitoring plan's frequency. New plans always store that as "at the regular review", so a weekly indicator last checked a month ago can still count as current.

**Ruled:** Each indicator on a complete monitoring plan counts separately. An indicator is current when its latest check is within one and a half times its own check frequency (Daily 1, Weekly 7, Every two weeks 14, Monthly 30 days). An indicator set to At the regular review, or with no frequency, uses the New Risk Review cycle as now. The bar's hover text says so.

### 11.1 In `anHealth` (Program Coverage), the Rhythm kept count. Replace from the start text up to and including the end text. There are comments in the middle, and they go too.

Start text (occurs exactly once):

```js
live.filter(function(r){return cardClass(r)==='monitor'&&mnPlanComplete(r)}).forEach(function(r){ck2++;
```

End text (occurs exactly once, later on the same line):

```js
if(last&&(Date.now()-last)<=d*86400000*1.5)ok2++});
```

Replace the whole span with:

```js
live.filter(function(r){return cardClass(r)==='monitor'&&mnPlanComplete(r)}).forEach(function(r){((r.monitorPlan.indicators)||[]).forEach(function(x){ck2++;var per=MN_PERIOD[x.frequency||r.monitorPlan.frequency]||cycleDays;var ck=(x.checks||[]);var last=ck.length?ck[ck.length-1].at:0;if(last&&(Date.now()-last)<=per*86400000*1.5)ok2++})});
```

### 11.2 In `anHealth`, the Rhythm kept explanation (shown when hovering the bar)

Find (occurs exactly once):

```js
'The review cadence is set, and every monitored risk\'s latest logged check is current against its own frequency.'
```

Replace it with:

```js
'The review cadence is set, and every indicator on a monitored risk has been checked within one and a half times its own check frequency.'
```

**Acceptance:**
- A Monitor card with one Weekly indicator last checked 20 days ago lowers Rhythm kept. Logging a check on it raises it.
- Hovering Rhythm kept shows: The review cadence is set, and every indicator on a monitored risk has been checked within one and a half times its own check frequency.

---

## Appendix A: new on-screen words

| Ref | Item | Where | Words | Status |
|---|---|---|---|---|
| G.1 | 1 | Design the Tests, frequency dropdown | Select frequency... · Daily · Weekly · Every two weeks · Monthly · Quarterly | Approved by Paul (15 Oct 2026) |
| G.2 | 2 | Risk Explorer column | Composite | Approved by Paul (15 Oct 2026) |
| G.3 | 2 | Top Exposures line | L4 · I3 · T2 (the risk's own scores) | Approved by Paul (15 Oct 2026) |
| G.4 | 3 | Risk Register CSV headers | Impact (I) · Timeframe (T) | Approved by Paul (15 Oct 2026) |
| G.5 | 4 | Printed registers, monitoring plan | Owner · The monitoring plan is incomplete: it needs an owner and at least one indicator. | Approved by Paul (15 Oct 2026) |
| G.6 | 4 | Management & Monitoring Plans output | Owner: | Approved by Paul (15 Oct 2026) |
| G.7 | 5 | Metric Trends subtitle | Snapshots recorded automatically every day | For Paul's approval |
| G.8 | 5 | Metric Trends, before two snapshots | Trends build over time — a snapshot of key metrics is recorded automatically every day. Come back tomorrow to see movement. | For Paul's approval |
| G.9 | 6 | Compliance Dashboard, NIST paragraph | "Two things" in place of "Three things", and the paragraph ends "It locates evidence." | For Paul's approval (consequential edits to his cut) |
| G.10 | 8 | Removing a system | Remove “[name]” from the inventory? [N] risk(s) [is/are] attached to it and will no longer be linked to a system. This cannot be undone. | For Paul's approval |
| G.11 | 8 | Removing a risk at Step 1.3 | Remove “[name]”? The risk card is deleted, not archived. This cannot be undone. | For Paul's approval |
| G.12 | 9 | Step 4.4, under the disabled button | Hold the review first — cover every agenda item, answer the three questions, and click Save governance review. The step completes once the review is saved. | For Paul's approval |
| G.13 | 11 | Rhythm kept hover text | The review cadence is set, and every indicator on a monitored risk has been checked within one and a half times its own check frequency. | For Paul's approval |

## Checklist

- [ ] 1 Recurring test frequency dropdown, every option can go overdue (1.1 to 1.5)
- [ ] 2 Risk Explorer column Composite, Top Exposures L · I · T (2.1, 2.2)
- [ ] 3 Risk Register CSV headers (3.1)
- [ ] 4 Monitoring plan field called Owner everywhere (4.1 to 4.3)
- [ ] 5 Snapshot wording (5.1, 5.2)
- [ ] 6 Compliance Dashboard paragraph (6.1)
- [ ] 7 Reassessment tile removed (7.1)
- [ ] 8 Confirmations before deleting a system or a risk (8.1, 8.2)
- [ ] 9 Step 4.4 completes once the review is saved (9.1, 9.2)
- [ ] 10 All seven agenda items required (10.1, 10.2)
- [ ] 11 Rhythm kept per indicator (11.1, 11.2)

## Per-surface checklist

- [ ] Step 3.3 and the Testing Center, Design the Tests: the frequency dropdown (item 1)
- [ ] Step 3.3, the Testing Center, and each system card's Testing tab, Tests & Evidence: frequency labels, OVERDUE for every option (item 1)
- [ ] Printed Testing & Evidence document and printed system records: frequency labels (item 1)
- [ ] Analytics page, Risk Explorer and Top Exposures (item 2)
- [ ] Analytics page, ⬇ Risk Register CSV (item 3)
- [ ] Printed Updated Risk Register and any printed risk record with a monitoring plan, Summary and Full (item 4)
- [ ] Management & Monitoring Plans output, on screen and printed (item 4)
- [ ] Analytics page and the printed Analytics document, Metric Trends (item 5)
- [ ] Compliance Dashboard, Dashboard tab, NIST page (item 6)
- [ ] Governance Framework output on screen and printed, and its fold on Step 4.4 and the Governance Review page (item 7)
- [ ] Step 1.2 systems list, × Remove (item 8)
- [ ] Step 1.3 Preliminary Risk Register, × Remove (item 8)
- [ ] Step 4.4, completion button and its message (item 9)
- [ ] Step 4.4, Save governance review (item 10)
- [ ] Governance Review page, ✓ Log this review (item 10)
- [ ] Program Coverage on the Governance Dashboard and the Analytics page, Rhythm kept bar and hover text (item 11)
