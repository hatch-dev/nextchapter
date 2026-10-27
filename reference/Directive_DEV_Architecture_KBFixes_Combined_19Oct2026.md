# Architecture: eight fixes found while writing the AI Guide's knowledge base (19 October 2026)

**For:** the developers of the 90 Days to an AI-Ready Architecture module.  
**Applies to:** the Architecture current build, on top of every earlier directive and addendum. This directive replaces `Directive_DEV_Architecture_KBFixes_19Oct2026.md` and `Directive_DEV_Architecture_KBFixes_Part2_19Oct2026.md`. It holds everything in both, so apply this one only.  
**Source:** a read of `Architecture-app_1.js` (md5 `e40beb611381807d182ca623e255c3d2`, 13,325 lines) and `Architecture-home.html` (md5 `9209337f9df19a633c20e34087ec407a`, 141 lines) for the AI Guide's knowledge base. Each fix below was ruled by Paul on 19 October 2026. The bug numbers (A1, A2, …) are the ones in the knowledge-base bug list.  
**Checked:** every change below was applied to fresh copies of those files, with the app renamed `Architecture-app.js` so the test suite finds it.
- The changed app passes `node --check`: md5 `d57750dcc887534c3281fb345e52e6a9`, 13,327 lines.
- `Architecture-home.html`: md5 `15b7f72cedb7d6c025e811ded4ada757` after the change, 141 lines.
- Three harness assertions had to be updated with the changes, in items 3, 5, and 9. `Architecture-harness.js` goes from md5 `9d2b05c1549c30b3613af8b62016ab42` to `32d5d93ec62f449689612017c52cc33f`.
- `Architecture-templates-local.js` was regenerated with its own build script, as item 8 requires. Its md5 changes with every run, because the file records the time it was generated.
- The behavioral harness (686 assertions) and the smoke test (`Architecture-smoke.js`, md5 `39aaa3db0dc1875da997568def424fee`, 99 assertions) give the same results before and after the changes. The two that fail, fail both before and after, and neither is touched by this directive. See "Assertions that already fail", at the end.
- The nine checks in Appendix B all pass on the changed build.

Every change is anchored on quoted text, never on line numbers. Each change says how many times its text occurs in the file. **If a quoted text is not found exactly that many times in your copy, stop and report it.** Your copy may differ from the one this was checked against, and a missing anchor means the change needs looking at again rather than forcing in.

Code blocks show the source exactly as it is in the file, including its backslash escapes (`\u00b7`) and HTML entities (`&rsquo;`). Copy them exactly.

The items, in order:
1. The Step 4.3 milestone loses its stray words (A1)
2. The Phase 2 page spells "Cataloged" the American way in the singular (A2)
3. The Analytics trend for open remediation says what it counts (A3)
4. Notes and the AI Guide name the page by its real name (A4)
5. The "Connected (unspecified)" explanation points to where the fix is made (A8)
6. Step 2.5 numbers the person's decision as the map does (A10)
7. The application card's "AI type" has one help text (A15)
8. The Home page's phase summaries match the program (A14)
9. The harness's carousel pin follows the corrected milestone

Appendix A lists the on-screen words that change. Appendix B gives checks you can run to confirm each fix. The checklist and the per-surface checklist are at the end.

---

## 1. The Step 4.3 milestone loses its stray words (A1)

**What users see now:** Step 4.3's milestone, at the foot of the step page, ends with the words "Architecture carousels · revision 2 · page 1". They are the header of the carousel copy document and were pasted in with the milestone.

**Ruled:** the milestone ends at "…with the Board's next meeting set." Nothing else in it changes.


### 1.1 In `MILESTONES` (the milestone at the foot of each step page), the Step 4.3 entry

Find (occurs exactly once):

```js
'4.3':'First review complete \u2014 architecture rescored, progress documented, and the next quarter planned with the Board\u2019s next meeting set. Architecture carousels \u00b7 revision 2 \u00b7 page 1'
```

Replace it with:

```js
'4.3':'First review complete \u2014 architecture rescored, progress documented, and the next quarter planned with the Board\u2019s next meeting set.'
```


**Acceptance:**
- Step 4.3's milestone reads, in full: "First review complete — architecture rescored, progress documented, and the next quarter planned with the Board's next meeting set."
- The words "Architecture carousels", "revision 2", and "page 1" appear nowhere on the Step 4.3 page.
- The harness's carousel pin is updated with this change (item 9).

---

## 2. The Phase 2 page spells "Cataloged" the American way in the singular (A2)

**What users see now:** with exactly one API on the map, the Phase 2 page's figure reads "API Catalogued" (British spelling). With any other number it reads "APIs Cataloged".

**Ruled:** American spelling in both forms: "API Cataloged" and "APIs Cataloged".


### 2.1 In `renderPhaseHome` (the phase pages), the Phase 2 figures

Find (occurs exactly once):

```js
length===1?'API Catalogued':'APIs Cataloged'
```

Replace it with:

```js
length===1?'API Cataloged':'APIs Cataloged'
```


**Acceptance:**
- With exactly one integration of type API, the Phase 2 page's figure reads "API Cataloged".
- With none, or two or more, it reads "APIs Cataloged", as now.
- The word "Catalogued" no longer appears anywhere on screen.

---

## 3. The Analytics trend for open remediation says what it counts (A3)

**What users see now:** in Analytics (5.5), Metric Trends, one line is labeled "Open remediation + sovereignty actions". The daily snapshot behind it (`anSnapshot`) counts only the remediation items that are not done, and leaves out the sovereignty rows (`r.src!=='Sovereignty'`). So the label promises sovereignty actions the line does not count.

**Ruled:** the label says what the line counts: "Open remediation". The count itself does not change. It already matches every other open-remediation count in the app: the Analytics KPI row, the Architecture Review's "Open remediation" ring ("Sovereignty actions are counted on the Sovereignty Center."), and the Testing Log. Sovereignty already has its own trend line, "Sov. questions open".

**Supersedes:** the label pinned by the harness assertion P5R4-6 (23 September 2026, "the trend names what it counts"). That assertion is retargeted in 3.2 with a dated note.


### 3.1 In `anTrends` (Analytics, Metric Trends), the list of trend lines

Find (occurs exactly once):

```js
{n:'Open remediation + sovereignty actions',k:'open',c:ANA.med,good:-1}
```

Replace it with:

```js
{n:'Open remediation',k:'open',c:ANA.med,good:-1}
```

### 3.2 In `Architecture-harness.js`, assertion P5R4-6

Find (occurs exactly once):

```js
ok(src.indexOf("{n:'Open remediation + sovereignty actions',k:'open',")>=0,'P5R4-6 (23 Sep 2026, Paul): the trend names what it counts');
```

Replace it with:

```js
ok(src.indexOf("{n:'Open remediation',k:'open',")>=0 /* RETARGETED 19 Oct 2026 (Paul, KB fix A3): the snapshot counts open remediation without the sovereignty rows, as every other open-remediation count does, so the label says Open remediation */,'P5R4-6 (23 Sep 2026, Paul): the trend names what it counts');
```


**Acceptance:**
- Analytics, Metric Trends: the line reads "Open remediation", on screen and in the printed Analytics.
- Its values are unchanged. Snapshots already recorded keep their values, because only the label changes.
- The words "sovereignty actions" no longer appear in Metric Trends.
- Harness assertion P5R4-6 passes against the new label.

---

## 4. Notes and the AI Guide name the page by its real name (A4)

**What users see now:** each note records where it was written, and the Notes panel shows that place. The AI Guide's "Context:" line and the context it sends with a question use the same function (`notesWhere`). The names it gives are wrong for most pages that are not steps:
- The dashboard is called "Tech Stack".
- The Framework page is called "Architecture".
- Every output page is called just "Outcome".
- Every other page is called "Home". That includes the Phase 5 Manage page, the Architecture Review, the Data Governance Review, the five standards pages, Architecture Scores, the map page, the Jurisdiction Map, Track Program, and the Report Manager.

Steps and phase pages are already named correctly ("Step 2.5 · Enterprise Architecture Fit", "Phase 3 · Test").

**Ruled:** every page is named by the name it shows. The full list:

| Page (`currentPage`) | Name shown |
|---|---|
| `home` | Home |
| `learn` | Learn |
| `readiness` | Framework |
| `insights` | Insights |
| `phase5` (the dashboard) | Step 5.1 · Architecture Dashboard |
| `manage` | Phase 5 · Manage |
| `archreview` | Architecture Review |
| `archmap` | Architecture Map |
| `archscores` | Architecture Scores |
| `stdData` | Data Domains and Standards |
| `dgreview` | Data Governance Review |
| `stdCompute` | Compute Goals and Strategy |
| `stdModel` | Model Rules |
| `stdInteg` | Integration Standards |
| `stdApp` | Application and Agent Governance |
| `jurmap` | Jurisdiction Map |
| `mgmt-hub` | Track Program |
| `reports` | Report Manager |
| `outcome` (any output) | Output · [the output's name, as in the sidebar], for example "Output · Architecture Readiness Report" |
| `step` (unchanged) | Step [id] · [step name] |
| `phaseHome` (unchanged) | Phase [id] · [phase name] |

The dashboard reads "Step 5.1 · Architecture Dashboard" because the sidebar lists it as step 5.1, beside "Step 5.2 · Architecture Map" and the other Phase 5 pages.

Notes already written keep their stored page and step, so the Notes panel works out the name from those each time it draws, rather than showing the name stored when the note was written. Existing notes therefore show the corrected name too. The stored `where` field is still written with each new note.


### 4.1 Replace `notesWhere` (the place name for notes and the AI Guide) with a name list and a function that names any page. Find the whole function

The new `notesWhere()` keeps its name and returns the same kind of string, so its two callers in the AI Guide (the "Context:" line and the question context) need no change.

Find (occurs exactly once):

```js
function notesWhere(){
  if(currentPage==='step'&&currentStep){
    for(var i=0;i<PH.length;i++)for(var j=0;j<PH[i].steps.length;j++)
      if(PH[i].steps[j].id===currentStep)return'Step '+currentStep+' \u00B7 '+PH[i].steps[j].name;
    return'Step '+currentStep;
  }
  if(currentPage==='phaseHome'&&currentStep){var ph=PH.find(function(p){return String(p.id)===String(currentStep)});return ph?'Phase '+ph.id+' \u00B7 '+ph.name:'Phase '+currentStep}
  var map={home:'Home',learn:'Learn',readiness:'Architecture',phase5:'Tech Stack',insights:'Insights',outcome:'Outcome'};
  return map[currentPage]||'Home';
}
```

Replace it with:

```js
var NOTE_PAGE_NAMES={home:'Home',learn:'Learn',readiness:'Framework',insights:'Insights',phase5:'Step 5.1 \u00B7 Architecture Dashboard',manage:'Phase 5 \u00B7 Manage',archreview:'Architecture Review',archmap:'Architecture Map',archscores:'Architecture Scores',stdData:'Data Domains and Standards',dgreview:'Data Governance Review',stdCompute:'Compute Goals and Strategy',stdModel:'Model Rules',stdInteg:'Integration Standards',stdApp:'Application and Agent Governance',jurmap:'Jurisdiction Map','mgmt-hub':'Track Program',reports:'Report Manager'}; /* 19 Oct 2026 (Paul, A4): every page a note can be written on, by the name the page shows */
function notesWhereFor(page,step){
  if(page==='step'&&step){
    for(var i=0;i<PH.length;i++)for(var j=0;j<PH[i].steps.length;j++)
      if(PH[i].steps[j].id===step)return'Step '+step+' \u00B7 '+PH[i].steps[j].name;
    return'Step '+step;
  }
  if(page==='phaseHome'&&step){var ph=PH.find(function(p){return String(p.id)===String(step)});return ph?'Phase '+ph.id+' \u00B7 '+ph.name:'Phase '+step}
  if(page==='outcome'&&step){var on='';PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id===step)on=o.name})});return on?'Output \u00B7 '+on:'Output'}
  return NOTE_PAGE_NAMES[page]||'Home';
}
function notesWhere(){return notesWhereFor(currentPage,currentStep)}
```

### 4.2 In `renderNotesPanel` (the Notes panel), the place shown under each note

Find (occurs exactly once):

```js
'<div class="note-item-meta"><span class="note-where"'+navAttr+'>'+esc(n.where||'')+'</span>'
```

Replace it with:

```js
'<div class="note-item-meta"><span class="note-where"'+navAttr+'>'+esc(notesWhereFor(n.page,n.step))+'</span>'
```


**Acceptance:**
- A note written on each page in the table shows the name in the table, and clicking the name still opens that page.
- A note written before this change on the dashboard (stored as "Tech Stack") now shows "Step 5.1 · Architecture Dashboard".
- A note written on an output page shows "Output · " and the output's name.
- The AI Guide's "Context:" line shows the same names on those pages. On step pages it still shows "Step [id]", as now.

---

## 5. The "Connected (unspecified)" explanation points to where the fix is made (A8)

**What users see now:** on the Architecture Map, hovering "Connected (unspecified)" in the connection legend says: "A declared connection whose type has not been chosen yet. Open the component's Advanced connections manager to choose the type." That sends people to the wrong place, for two reasons:
- Most unspecified lines are links between a model or integration and a data system where neither Reads nor Writes has been chosen. They are fixed with the Direction chips beside the link on the model's or integration's card.
- The Advanced connections manager can't change the type of an existing line. Its list of existing connections only offers "Remove this connection". The rest of the unspecified lines are connections someone added in the manager with the type "Connected (unspecified)". Those are fixed by removing them there and adding them again with a type.

**Ruled:** the explanation reads: "A connection whose type has not been recorded yet. For a link between a model or integration and a data system, choose Reads or Writes beside the link on that component's card. For a connection added in the Advanced connections manager, remove it there and add it again with its type."


### 5.1 In the connection kinds' explanations (the legend's hover text on the map), the `connects` entry

The text is the `connects` entry of the list of hover explanations, one per connection kind. Only this entry changes.

Find (occurs exactly once):

```js
connects:'A declared connection whose type has not been chosen yet. Open the component\u2019s Advanced connections manager to choose the type.',
```

Replace it with:

```js
connects:'A connection whose type has not been recorded yet. For a link between a model or integration and a data system, choose Reads or Writes beside the link on that component\u2019s card. For a connection added in the Advanced connections manager, remove it there and add it again with its type.', /* 19 Oct 2026 (Paul, KB fix A8): the manager cannot retype a line, and most unspecified lines are data links with no direction */
```

### 5.2 In `Architecture-harness.js`, assertion H5 ("every kind chip explains what its kind MEANS")

Find (occurs exactly once):

```js
ok(pan.indexOf('Open the component\u2019s Advanced connections manager to choose the type')>=0,
```

Replace it with:

```js
ok(pan.indexOf('choose Reads or Writes beside the link on that component\u2019s card')>=0 /* RETARGETED 19 Oct 2026 (Paul, KB fix A8): the unspecified kind now points to the Direction chips and the manager\u2019s remove-and-re-add */,
```


**Acceptance:**
- On the Architecture Map (the dashboard's diagram, the Architecture Map page, and the map opened from a step), hovering "Connected (unspecified)" in the connection legend shows the ruled text in full.
- The words "Advanced connections manager to choose the type" appear nowhere in the app.
- Harness assertion H5 passes against the new text.

---

## 6. Step 2.5 numbers the person's decision as the map does (A10)

**What users see now:** at Step 2.5, under a workflow's bar, the findings can include "The card has not yet said whether a person is in the loop. The map shows a person deciding at step n." That n counts the person's decision by its position in the step list. The map numbers steps differently once a decision branches (2A, 2B, and so on). In a branched flow the line names the wrong step. For example, it says "step 3" for the step the map numbers "2B". The neighboring finding, the one used when the card says no person is in the loop, already uses the map's number.

**Ruled:** the line uses the step number the map shows.


### 6.1 In `eafDerive` (Step 2.5's findings), the number of the first step where a person decides

`firstP` is used only in the "card has not yet said" line, so nothing else changes.

Find (occurs exactly once):

```js
var hl=a.humanLoop;var firstP=personDec.length?st.indexOf(personDec[0])+1:0;
```

Replace it with:

```js
var hl=a.humanLoop;var firstP=personDec.length?stxM.info[st.indexOf(personDec[0])].no:'';
```


**Acceptance:**
- In a workflow whose first step is a decision with two answers, each leading to its own step, a person's decision on the second answer's path is numbered "2B" in the line, matching the map. Before this change the line said "step 3".
- In a workflow with no decisions, the number is unchanged ("step 3" stays "step 3").
- With no person deciding, the line still reads "…The map shows no person deciding."

---

## 7. The application card's "AI type" has one help text (A15)

**What users see now:** the "AI type" field on an application card is defined with two help texts. The second overrides the first, so users see only the second: "How the AI in this application behaves: analysis and prediction, fixed rules, content generation, or autonomous action." The first, "The kind of AI doing the work. Agentic means it can take actions on its own rather than only producing output for a person.", never shows.

**Ruled:** one help text. The one kept is the one users see today. It describes all four choices in order, and the knowledge base documents it. The unused one is removed. What users see does not change.


### 7.1 In `LAYER_SCHEMAS` (the component cards), the application card's "AI type" field. Delete the first help text, the one before `options`

Find (occurs exactly once):

```js
{id:'aiType',label:'AI type',kind:'optmulti',gloss:'The kind of AI doing the work. Agentic means it can take actions on its own rather than only producing output for a person.',options:
```

Replace it with:

```js
{id:'aiType',label:'AI type',kind:'optmulti',options:
```


**Acceptance:**
- The "AI type" field's definition has one `gloss`.
- On an application card, the "AI type" help text reads: "How the AI in this application behaves: analysis and prediction, fixed rules, content generation, or autonomous action."

---

## 8. The Home page's phase summaries match the program (A14)

**What users see now:** on the Home page, under "The 90-Day Plan", the summaries for four of the five phases describe an earlier version of the program:
- Map lists identity, which is now Step 2.6, in Build.
- Build mentions only APIs, integrations, and identity.
- Test lists "Load testing", which no step does.
- Manage lists "portfolio gate", which doesn't exist, and the Review Board, which is set up at Step 1.2.

The Embed summary is current and does not change.

**Ruled:** the four summaries read, word for word:
- 01 Map: "Score the architecture you have, set up the Review Board, map the systems AI depends on, assess the risks, and record your sovereignty baseline."
- 02 Build: "Govern data, compute, models, integrations, applications, and agents, map how each workflow fits the business, and plan zero trust and sovereignty."
- 03 Test: "Test an application flow end to end, stress-test security and identity, run cascade failure scenarios, and validate the sovereignty plan."
- 05 Manage: "Ongoing: the Review Board's architecture reviews, the data governance reviews, and the sovereignty program, all run from the dashboard."

The four changes are in `Architecture-home.html`. After making them, regenerate `Architecture-templates-local.js`, the bundled copy of the Home and Learn pages that the app uses when opened from disk. Its own header says not to edit it by hand.


### 8.1 In `Architecture-home.html`, "The 90-Day Plan", 01 Map

Find (occurs exactly once):

```html
<div class="t-stone-13">Assess every layer: data estate, integrations, identity, compute, risk.</div>
```

Replace it with:

```html
<div class="t-stone-13">Score the architecture you have, set up the Review Board, map the systems AI depends on, assess the risks, and record your sovereignty baseline.</div>
```

### 8.2 In `Architecture-home.html`, "The 90-Day Plan", 02 Build

Find (occurs exactly once):

```html
<div class="t-stone-13">Modernize APIs, retire brittle integrations, architect zero-trust identity.</div>
```

Replace it with:

```html
<div class="t-stone-13">Govern data, compute, models, integrations, applications, and agents, map how each workflow fits the business, and plan zero trust and sovereignty.</div>
```

### 8.3 In `Architecture-home.html`, "The 90-Day Plan", 03 Test

Find (occurs exactly once):

```html
<div class="t-stone-13">Load testing, identity penetration, cascade simulation, security validation.</div>
```

Replace it with:

```html
<div class="t-stone-13">Test an application flow end to end, stress-test security and identity, run cascade failure scenarios, and validate the sovereignty plan.</div>
```

### 8.4 In `Architecture-home.html`, "The 90-Day Plan", 05 Manage

Find (occurs exactly once):

```html
<div class="t-stone-13">Ongoing: Architecture Review Board, portfolio gate, living dashboard discipline.</div>
```

Replace it with:

```html
<div class="t-stone-13">Ongoing: the Review Board&rsquo;s architecture reviews, the data governance reviews, and the sovereignty program, all run from the dashboard.</div>
```

### 8.5 Regenerate `Architecture-templates-local.js`

From the folder that holds the module's files, run:

```
node Architecture-build-templates.js
```

It prints "bundled Architecture-home.html", "bundled Architecture-learn.html", and "wrote Architecture-templates-local.js".

**Before you run it, check the file is in sync.** In the copy this was checked against, the existing `Architecture-templates-local.js` matched `Architecture-home.html` and `Architecture-learn.html` exactly, apart from its "Generated:" line. So regenerating it carried only these four changes. If your copy is out of sync, regenerating will also carry whatever else differs. To check, regenerate before making changes 8.1 to 8.4 and compare the result with your existing file, ignoring the "Generated:" line. **If anything else differs, stop and report it.**

**Acceptance:**
- The Home page's "The 90-Day Plan" shows the four ruled summaries, with Embed unchanged.
- This holds when the app is served, which reads `Architecture-home.html`, and when it is opened from disk, which reads `Architecture-templates-local.js`.
- The words "Load testing", "portfolio gate", "Assess every layer", and "Modernize APIs" appear in neither file.

---

## 9. The harness's carousel pin follows the corrected milestone

**Why:** the harness assertion CAROUSELV14 (16 October 2026) hashes every step's four carousel slides and milestone, to pin the approved v14 copy word for word. The hash was taken from a build whose Step 4.3 milestone carried the stray words removed in item 1. So item 1 changes the hash, and nothing else in this directive does. I confirmed this by running the harness with every change except item 1: CAROUSELV14 passes. The slides themselves are untouched.


### 9.1 In `Architecture-harness.js`, assertion CAROUSELV14

Find (occurs exactly once):

```js
r.hash==='ebfc63c7d699f44296bff29d74c109e9'
```

Replace it with:

```js
r.hash==='63df9a1da82f940e05c37a5238216d5d' /* RE-PINNED 19 Oct 2026 (Paul, KB fix A1): the 4.3 milestone loses the stray words "Architecture carousels \u00b7 revision 2 \u00b7 page 1"; was ebfc63c7d699f44296bff29d74c109e9 */
```


**Acceptance:**
- CAROUSELV14 passes against the build with item 1 applied.

---

## Appendix A: on-screen words that change

- Step 4.3, milestone: ends "…with the Board's next meeting set." (item 1)
- Phase 2 page, figure label with one API: "API Cataloged" (item 2)
- Analytics, Metric Trends, line label: "Open remediation" (item 3)
- Notes panel and AI Guide context, page names: as in the table in item 4 (item 4)
- Architecture Map, connection legend, hover text for "Connected (unspecified)": as ruled in item 5 (item 5)
- Step 2.5, the "card has not yet said" finding: the step number now matches the map, for example "step 2B" (item 6)
- Home page, "The 90-Day Plan", the Map, Build, Test, and Manage summaries: as ruled in item 8 (item 8)

Items 7 and 9 change nothing on screen.

## Appendix B: checks I ran

These were added to a copy of `Architecture-smoke.js`, just before its closing `g("data=emptyData()");`, and run against the unchanged and the changed build. All nine pass on the changed build. On the unchanged build, eight fail. The A15 check passes on both, because the visible help text was already the one kept.

```js
T('VERIFY A1 milestone 4.3 ends at "next meeting set."', ()=>{const m=g("MILESTONES['4.3']");return /next meeting set\.$/.test(m)&&m.indexOf('Architecture carousels')<0});
T('VERIFY A2 one API reads "API Cataloged"', ()=>{g("data=emptyData();data.integrations=[{id:'v1',name:'A',type:'API'}]");const h=g("renderPhaseHome(2)");return h.indexOf('API Cataloged')>=0&&h.indexOf('Catalogued')<0});
T('VERIFY A3 trend label is "Open remediation"', ()=>{g("data=emptyData();data.anSnapshots=[{d:'2026-07-01',ari:1,sov:1,att:1,open:2,pass:1,cov:1},{d:'2026-07-02',ari:2,sov:2,att:1,open:3,pass:1,cov:1}]");const h=g("anTrends()");return h.indexOf('>Open remediation<')>=0&&h.indexOf('sovereignty actions')<0});
T('VERIFY A4 page labels', ()=>{const r=g("[notesWhereFor('phase5'),notesWhereFor('readiness'),notesWhereFor('archreview'),notesWhereFor('stdModel'),notesWhereFor('mgmt-hub'),notesWhereFor('reports'),notesWhereFor('manage'),notesWhereFor('outcome','out-readiness'),notesWhereFor('step','2.5'),notesWhereFor('phaseHome','3')].join(' | ')");console.log('   ',r);return r==='Step 5.1 \u00B7 Architecture Dashboard | Framework | Architecture Review | Model Rules | Track Program | Report Manager | Phase 5 \u00B7 Manage | Output \u00B7 Architecture Readiness Report | Step 2.5 \u00B7 Enterprise Architecture Fit | Phase 3 \u00B7 Test'});
T('VERIFY A4 an existing note shows the corrected label', ()=>{g("data=emptyData();data.notes=[{id:'n1',text:'x',page:'phase5',step:null,where:'Tech Stack',ts:Date.now()}];renderNotesPanel()");const h=g("document.getElementById('notesPanel').innerHTML");return h.indexOf('Architecture Dashboard')>=0&&h.indexOf('Tech Stack')<0});
T('VERIFY A10 map number in the "not yet said" line', ()=>{g("data=emptyData();var _a={id:'ag1',name:'T',appId:'app1',humanLoop:'',flow:{trigger:{kind:'event',text:'x',source:{lane:'people',ref:'A'}},steps:[{id:'s1',kind:'decides',actor:{lane:'agent',ref:''},target:{lane:'people',ref:''},text:'Q?',decision:{right:'rule',accountable:'X',basis:'',branches:[{id:'b1',label:'yes',next:'s2'},{id:'b2',label:'no',next:'s3'}]}},{id:'s2',kind:'acts',actor:{lane:'agent',ref:''},target:{lane:'people',ref:''},text:'Does it',path:{dec:'s1',bi:0,br:'b1'},decision:{branches:[]}},{id:'s3',kind:'decides',actor:{lane:'people',ref:'Boss'},target:{lane:'people',ref:''},text:'Approve?',path:{dec:'s1',bi:1,br:'b2'},decision:{right:'person',accountable:'Boss',basis:'',branches:[{id:'b3',label:'ok',next:'__stop'},{id:'b4',label:'no',next:'__stop'}]}}]}};data.agentRegistry=[_a]");const l=g("eafDerive(data.agentRegistry[0]).lines.join(' || ')");console.log('   ',l);return l.indexOf('a person deciding at step 2B.')>=0});
T('VERIFY A15 AI type help text', ()=>{const t=g("(function(){var f=null;LAYER_SCHEMAS.aiApplications.groups.forEach(function(gr){gr.fields.forEach(function(x){if(x.id==='aiType')f=x})});return f.gloss})()");console.log('   ',t);return t==='How the AI in this application behaves: analysis and prediction, fixed rules, content generation, or autonomous action.'});
T('VERIFY A8 legend explains the unspecified kind', ()=>{const h=g("renderArchDiagram('dashboard')");return h.indexOf('choose Reads or Writes beside the link on that component\u2019s card')>=0&&h.indexOf('Advanced connections manager to choose the type')<0});
T('VERIFY A14 Home summaries', ()=>{const t=require('fs').readFileSync(__dirname+'/Architecture-templates-local.js','utf8');const h=require('fs').readFileSync(__dirname+'/Architecture-home.html','utf8');const ok=s=>t.indexOf(s)>=0&&h.indexOf(s)>=0;return ok('Score the architecture you have, set up the Review Board')&&ok('Govern data, compute, models, integrations, applications, and agents')&&ok('Test an application flow end to end')&&ok('all run from the dashboard')&&t.indexOf('portfolio gate')<0&&t.indexOf('Load testing')<0&&h.indexOf('Assess every layer')<0});
```

## Assertions that already fail

Both of these fail on the unchanged build as well. This directive does not touch them. They are reported here so the results above can be compared.
- **Harness, FONTS (2 October 2026):** it looks for the site's own `fonts.css` and its 30 font files. The copy I tested had no `fonts` folder, so it found none. It should pass in your full checkout.
- **Smoke, "CAROUSEL 4 slides each":** it expects Step 3.1's carousel to have eight slides. The approved v14 carousels give Step 3.1 four, and the harness's CAROUSELV14 pin confirms four. The smoke assertion is out of date. It is reported to Paul with this directive, and nothing in this directive changes it.

## Checklist

- [ ] 1 Step 4.3 milestone without the stray words (1.1)
- [ ] 2 "API Cataloged" in the singular on the Phase 2 page (2.1)
- [ ] 3 Analytics trend labeled "Open remediation", with harness P5R4-6 retargeted (3.1, 3.2)
- [ ] 4 Notes panel and AI Guide context name every page correctly, including notes already written (4.1, 4.2)
- [ ] 5 "Connected (unspecified)" hover text as ruled, with harness H5 retargeted (5.1, 5.2)
- [ ] 6 Step 2.5's "card has not yet said" finding uses the map's step number (6.1)
- [ ] 7 One help text on the "AI type" field (7.1)
- [ ] 8 Home page summaries for Map, Build, Test, and Manage as ruled (8.1 to 8.4)
- [ ] 8 `Architecture-templates-local.js` checked for sync, then regenerated (8.5)
- [ ] 9 Harness CAROUSELV14 re-pinned (9.1)
- [ ] `node --check` passes. The harness and smoke results match "Assertions that already fail": no new failures.

## Per-surface checklist

- [ ] Step 4.3 page, milestone (item 1)
- [ ] Phase 2 page, figures, with one API and with two (item 2)
- [ ] Analytics (5.5), Metric Trends, on screen and in the printed Analytics (item 3)
- [ ] Notes panel: notes written on the dashboard, Framework, an output, the Manage page, each standing page, Track Program, and Report Manager, and one written before the change (item 4)
- [ ] AI Guide panel, the "Context:" line on the same pages (item 4)
- [ ] Architecture Map, the connection legend's hover text, on the dashboard's diagram, the Architecture Map page (5.2), and the map opened from a step (item 5)
- [ ] Step 2.5, the bar of a branched workflow whose card has not answered "Is a person in the loop?" (item 6)
- [ ] An application card, the "AI type" help text (item 7)
- [ ] Home page, "The 90-Day Plan", served from a web server (item 8)
- [ ] Home page, "The 90-Day Plan", with `index.html` opened directly from disk (item 8)
- [ ] Test suite: harness and smoke (items 3, 5, 9)
