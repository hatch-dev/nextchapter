# Governance module — changes to make, step by step
## Printed documents, record tables, and the Report Manager

**What this document is.** A list of 131 changes to the Governance module's `Governance-app.js`, to be made in order. Your code descends from the file Paul gave you in September (md5 `db0200df`), but it is your own: you have deployed it and changed it since. This document therefore never gives a line number. Every place is named by a function or by the exact text of a line, which you find with your editor's search (Ctrl+F). With this document you receive the finished offline build, `Governance-app.js` (md5 `a41e381c`), as a reference. Every block of code in this document is copied from that file byte for byte, and you can open the file to see any block in its surroundings. This document replaces every earlier Governance instruction document.

## 1. How to apply this document

- Apply the steps in order, from Step 1 to Step 131. Do not skip a step. Do not change the order.
- Before each step, find the place the step describes. Confirm that it is there exactly once.
- When a step replaces a whole function, delete your whole function and put the step's code in its place. If you have changed that function yourself since September, compare your function with the reference build first, and keep your own changes if they are unrelated to this document.
- When in doubt, use the whole function from the reference build rather than editing lines inside it.
- 29 of the 131 steps have a Check: something to open in the app and see. Do the Check after each of those steps. If the Check fails, stop and report the step number. The other 102 steps end with the line "Nothing to check yet", which names the later step where the change becomes visible.
- At the end, run the test suite described in section 5.
- Load the example data (section 6) before the acceptance checks in section 7.

## 2. Glossary

Rule for this document: no metaphors and no new words. Each term below is used in the steps and the checks with exactly this meaning.

- **Output** — one of the thirteen documents the module produces at the end of its steps: Assessment Profile, Systems Inventory, Initial Risk Register, Compliance Survey, Responsible AI Principles, RACI Matrix, Governance Systems Report, Compliance Obligations, Assessed Risk Register, Testing & Evidence, Governance Framework, Management & Monitoring Plans, Updated Risk Register. Each has a page in the app, listed in the sidebar under its phase.
- **Output page** — the page in the app that shows an output.
- **Phase 5 page** — one of the four pages of Phase 5: Governance Dashboard (step 5.1), Compliance Dashboard (5.2), Testing Center (5.3), Analytics (5.4).
- **Printed document** — what appears in the new window when the user clicks ▾ Save as PDF: a first page with the title, then the content, laid out for printing or saving as a PDF.
- **First page** (of a printed document) — the page that shows, from the top: the line NEXTCHAPTER · 90-DAY RESPONSIBLE AI GOVERNANCE; the title; a subtitle; a horizontal rule; the organization's name; today's date.
- **Print window** — the new browser window that opens when the user clicks ▾ Save as PDF. The browser's print dialog opens over it.
- **Save as PDF button** — the small button reading ▾ Save as PDF. It is drawn with the HTML `<button class="btn bg2" style="font-size:12px">`. Output pages already have it.
- **Record** — one risk, one compliance regime, or one AI system, with everything the module has stored about it.
- **Record table** — how a record prints: a table whose first row is the record's name and its main facts, then one section per part of the record, each section a list of labelled rows.
- **Part of a record** — the fields a record gains at one stage of the module. A risk has parts for its first card, its assessment, its classification, its management plan, its monitoring plan, its emergency response, and its tests. In the code these are called layers.
- **Summary / Full** — a choice of how much of each record prints. Summary prints the main rows of each part. Full prints every row. On screen the choice is two small buttons reading SUMMARY and FULL.
- **Register** — a printed list of record tables, with group headings such as Urgent Risks and Other Risks.
- **Missing line** — a line at the end of a record table that begins with ▸ and names a part the record should have but does not, for example "▸ No management plan recorded."
- **Portfolio** — one of the four lists of risks on the Governance Dashboard: Identify, Assess, Manage & Monitor, Emergency Response. Each has its own page in Phase 5. Archived risks have a fifth page.
- **Report Manager** — a new page in the More menu (the ··· button at the top right) where the user assembles several outputs and pages into one printed report.
- **Report** — what the Report Manager prints: a first page, a contents page, an introduction, then each chosen item as a numbered section.
- **Section** — one item of a report: an output, a Phase 5 page, a portfolio, a review, a single record, or a text page, printed with a number and a heading.
- **Text page** — a section the user writes: a heading and a body with bold, italic, and text sizes.
- **Example data** — the sample organization the app can load, with its risks, regimes, systems, and people. In the code it is `EXAMPLE_RISKS` and `seedSampleData`.
- **Test suite** — the file `Governance-smoke.js`, which loads the app in a test browser and checks it.
- **Sidebar** — the menu at the left listing the phases, their steps, and their outputs.
- **More menu** — the menu that opens from the ··· button at the top right.
- **RACI matrix** — the table of who is Responsible, Accountable, Consulted, and Informed for each governance activity.
- **Landscape page** — a printed page turned sideways, wider than it is tall. The RACI matrix prints on one.
- **Fold** — a section of a page that is closed and opens on click, marked with a small triangle ▸ or ▾. In the code the state of these is `UI.expanded`.
- **Review page** — one of the two pages reached from the Governance Dashboard's Run the Review buttons: Responsible AI Board Review and Governance Review.
- **Module Management page** — the page reached from the More menu item Track Program. Its heading reads Module Management.

## 3. What the user will see when everything is done

**On every output page**
- The ▾ Save as PDF button opens a print window with a printed document: the first page as defined in the glossary, then the content without the page's heading and without any button.
- Each printed page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as "2 / 7" at the bottom right. Nothing prints at the top left or the top right. Colors print.
- The Initial Risk Register, Assessed Risk Register, and Updated Risk Register pages show two small buttons SUMMARY and FULL above their lists, and show each risk as a record table. Their printed documents use the same choice. The Updated Risk Register prints one record per page.
- The Systems Inventory page and document begin with the AI Systems Overview and the Deployed / In development readout from step 1.2.
- The Compliance Survey, Compliance Obligations, and Testing & Evidence pages show one line per record with a small triangle. Clicking a line opens the record table.
- The RACI Matrix prints on a landscape page after its first page. The Governance Systems Report has no RACI section. The Management & Monitoring Plans document has two group headings, Manage (n) and Monitor (n). The Governance Framework prints without the colored bars at the left of its boxes.
- There is no Risk Classification Report. Phase 1's outputs are in the order Assessment Profile, Systems Inventory, Initial Risk Register, Compliance Survey.

**In the sidebar**
- Under each phase's steps, one line reads ▸ Outputs (n). Clicking it shows the phase's outputs. It is open while one of them is being viewed.

**On the Phase 5 pages and the portfolio pages**
- Every Phase 5 page and every portfolio page has the ▾ Save as PDF button at its top right. The portfolio pages also have the SUMMARY and FULL buttons.
- The Governance Dashboard prints a document of seven pages with the example data: the first page; a page headed Governance Overview; a page headed Register of Responsible AI Principles; a page headed Risk Management; a page headed Risk Portfolio at a Glance; a landscape page headed RACI Matrix.
- The Compliance Dashboard has, on each of its three tabs, a small box at the right with PRINT DEPTH, the buttons SUMMARY and FULL, and the ▾ Save as PDF button. Each tab prints its own document. The first tab's document is titled Conformance Report, with "NIST AI RMF 1.0" (or the chosen regime's name) on the line below in the same lettering. The Export Conformance Report button is gone.
- The Testing Center prints the Testing & Evidence document followed by a page headed Testing Log.
- The Analytics page prints a document of six content pages.
- Each portfolio prints a register of its risks. The Emergency Response portfolio prints each risk with its emergency response in a box at the top of the record table.

**On the review pages and the Module Management page**
- Both review pages have the ▾ Save as PDF button at the top right and print their own documents. The Responsible AI Board Review prints one agenda item per page.
- The Module Management page prints a document with the four figures, This Week, the steps of Phases 1 to 4 with their owners and state, and a page headed Analytics.

**In the More menu**
- An item reads Report Manager. It opens a page where the user creates a report, adds outputs, pages, portfolios, reviews, single records, and text pages to it, orders them, previews the report, and prints it.

**In Organization & Team**
- Changing the organization's name in Organization Details also changes the name shown in the sign-in organization switcher.

---

## 4. The steps

### Step 1 — Add the constant that holds the module name printed at the top of the first page of every printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printRiskBlock` ends, after its closing `}`.

**Code:**

```js
var PRINT_MODULE_NAME='90-Day Responsible AI Governance';
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 2 — Add the function that prints today's date as words.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PRINT_MODULE_NAME` ends, after its closing `;`. You added that constant in Step 1.

**Code:**

```js
/* the module's title as its home page and sidebar give it */

/* PRINT BASELINE (Paul's ruling, 12 Sep 2026; family): the cover's parts and the footer's words */
function printDateLine(){return new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 3 — Add the function that prints the copyright line for the bottom of each printed page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDateLine` ends, after its closing `}`. You added that function in Step 2.

**Code:**

```js
function printFooterText(){return '\u00a9 '+new Date().getFullYear()+' Next Chapter, LLC. All rights reserved.'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 4 — Replace the function that builds the first page of every printed document.

**Kind:** Replace existing code.

**Where:** Find the function named `printDocCover`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function printDocCover(title,lead,countLine){var org=null;try{org=getOrg(currentOrgId)}catch(e){}
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* the same words as the site footer at nextchapter.org */
function printDocCover(title,lead,countLine){var org=(function(){var ent=(data&&data.enterprise&&String(data.enterprise.name||'').trim())||'';if(ent)return ent;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return (o&&o.name)||''})(); /* 13 Sep 2026 (Paul's ruling; family): the cover names the organization as Organization Details (the Organization & Team panel) records it; the sign-in organization's label is the fallback only when that name is blank */
return '<div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'
+'<div style="font-family:var(--mono,monospace);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:0 0 18px">NextChapter \u00b7 '+esc(PRINT_MODULE_NAME)+'</div>'
+'<div style="font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px">'+esc(title)+'</div>'
+(lead?'<div style="font-size:14px;color:#444;line-height:1.6;max-width:520px;margin:0 0 26px">'+esc(lead)+'</div>':'')
+'<div style="border-top:2px solid #111;padding-top:12px;color:#333">'+(org?'<div style="font-size:18px;font-weight:600;color:#111;margin:0 0 4px">'+esc(org)+'</div>':'')+'<div style="font-size:13px">'+printDateLine()+'</div></div>'
+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 5 — Replace the function that removes a page's on-screen heading before printing.

**Kind:** Replace existing code.

**Where:** Find the function named `_pdStripHeader`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function _pdStripHeader(body){var m=body.indexOf('Save as PDF</button></div>');return m>=0?body.slice(m+26):body}
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* PRINT COVER (Paul's ruling, 12 Sep 2026; family): NextChapter · module, the title, the lead, the organization a little bigger, the date alone; no phase, no count (the count argument is accepted and ignored) */
function _pdStripHeader(body){var m=body.indexOf('Save as PDF</button></div>');return m>=0?body.slice(m+26):body}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 6 — Add the empty constant that will hold the record descriptions for risks, compliance regimes, and AI systems.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDocFromScreen` ends, after its closing `}`.

**Code:**

```js
/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   REPORTING ENGINE (family; Spec Rev A, 12 Sep 2026, Paul's rulings). Layered records: each record type
   declares a layer map; every layer has a summary and a full rendering; a layer is live when it has content
   and no later superseding layer does; renderings are additive; a register prints identity plus the summary
   of every live layer up to its own phase; each record ends with a missing-layers line. Output side only —
   nothing here touches the steps or the working surfaces.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
var LAYER_MAPS={};
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 7 — Add the function that makes a printed value begin with a capital letter.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LAYER_MAPS` ends, after its closing `;`. You added that constant in Step 6.

**Code:**

```js
function lyCap(t){t=String(t);if(!t||/^(https?:\/\/|www\.)/.test(t)||t.indexOf('@')>=0||/^[a-z]+-[a-z0-9-]*\d/.test(t))return t;return t.charAt(0).toUpperCase()+t.slice(1)}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 8 — Add the function that prints a stored date as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyCap` ends, after its closing `}`. You added that function in Step 7.

**Code:**

```js
/* 13 Sep 2026 (Paul's ruling): a printed value begins with a capital, unless it is a URL, an email, or an id */
function lyDate(v){var d=(typeof v==='number')?new Date(v):new Date(String(v));return isNaN(d)?String(v||''):d.toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 9 — Add the function that prints one test as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyDate` ends, after its closing `}`. You added that function in Step 8.

**Code:**

```js
function lyTestText(t){ /* a test, one fact per line (Paul's ruling, 13 Sep 2026): kind and claim; the test; how often it runs; when; who runs it; when it is due */
  var lines=[(t.kind==='threat'?'Threat: ':'Claim: ')+(t.claim||'')];if(t.test)lines.push('Test: '+t.test);
  var when=(t.trigger==='pre-deployment')?'in the pre-deployment phase':(t.trigger||'');
  if(t.shape==='once')lines.push('Test runs once'+(when?' \u2014 '+when:''));else if(t.shape==='recurring')lines.push('Test runs on a schedule'+(t.frequency?' \u2014 '+t.frequency:'')+(when?' \u2014 '+when:''));else if(when)lines.push('Test runs '+when); /* 14 Sep 2026 (Paul's ruling): how often and when on one line */
  if(t.runner)lines.push('Test runner: '+t.runner);if(t.due)lines.push('Due: '+t.due);return lines.join('<br>')}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 10 — Add the function that prints one evidence item as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyTestText` ends, after its closing `}`. You added that function in Step 9.

**Code:**

```js
function lyEvidenceText(e,sx){ /* an evidence item, one fact per line: the test it belongs to, by name; the outcome; the date; what was found; where it is kept; who recorded it */
  var t=((sx&&sx.testingPlan&&sx.testingPlan.tests)||[]).find(function(x){return x.id===e.testId});
  var lines=['Test: '+(t?(t.claim||t.test||e.testId):(e.testId||''))];if(e.outcome)lines.push('Outcome: '+e.outcome);if(e.at)lines.push('Date: '+lyDate(e.at));if(e.result)lines.push('Found: '+e.result);if(e.where)lines.push('Kept at: '+e.where);if(e.by)lines.push('Recorded by: '+e.by);return lines.join('<br>')}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 11 — Add the function that prints a stored value as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyEvidenceText` ends, after its closing `}`. You added that function in Step 10.

**Code:**

```js
function lyText(v){ /* any value to plain text */
  if(v==null)return '';if(Array.isArray(v))return v.map(lyText).filter(Boolean).join('; ');
  if(typeof v==='object')return Object.keys(v).map(function(k){return v[k]}).map(lyText).filter(Boolean).join('; ');
  return String(v).trim()}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 12 — Add the function that decides which parts of a record have content to print.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyText` ends, after its closing `}`. You added that function in Step 11.

**Code:**

```js
function lyLive(map,rec,upto){ /* the live layers, in stage order, up to and including layer index upto (all when upto is null) */
  var present=map.layers.map(function(l){try{return !!l.present(rec)}catch(e){return false}});
  return map.layers.filter(function(l,i){if(upto!=null&&i>upto)return false;if(!present[i])return false;
    return !map.layers.some(function(m,j){return m.supersedes===l.id&&present[j]})})}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 13 — Add the function that writes the line naming what a record is missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyLive` ends, after its closing `}`. You added that function in Step 12.

**Code:**

```js
function lyMissing(map,rec,upto){ /* one sentence per required-but-absent or incomplete layer */
  var out=[];map.layers.forEach(function(l,i){if(upto!=null&&i>upto)return;if(!l.required)return;var req=false;try{req=!!l.required(rec)}catch(e){}
    if(!req)return;var pres=false;try{pres=!!l.present(rec)}catch(e){}
    if(!pres){out.push(l.missing||('No '+l.title.toLowerCase()+' recorded.'));return}
    if(l.complete){var c=null;try{c=l.complete(rec)}catch(e){}if(typeof c==='string'&&c)out.push(c)}});return out}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 14 — Add the function that prints one labelled row of a record.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyMissing` ends, after its closing `}`. You added that function in Step 13.

**Code:**

```js
function lyRow(label,value,indent){var t=lyCap(lyText(value));return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?esc(t):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 15 — Add the function that prints a list of items as labelled rows.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRow` ends, after its closing `}`. You added that function in Step 14.

**Code:**

```js
function lyList(label,items,fmt){ /* a list field: one row per item, the label on the first; a formatter may return lines separated by <br>, which print as lines */
  if(!items||!items.length)return lyRow(label,'');var h='';items.forEach(function(it,i){var v=fmt?fmt(it,i):it;h+=lyRowHtml(i===0?label:'',v,i>0)});return h}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 16 — Add the function that prints a labelled row containing HTML.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyList` ends, after its closing `}`. You added that function in Step 15.

**Code:**

```js
function lyRowHtml(label,value,indent){var t=(typeof value==='string')?value:lyText(value);var parts=t.split('<br>').map(function(x){return esc(lyCap(x))});return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?parts.join('<br>'):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 17 — Add the function that prints one whole record as a table.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRowHtml` ends, after its closing `}`. You added that function in Step 16.

**Code:**

```js
function lyRender(type,rec,depth,upto,caption,lead){ /* the record as a table: an optional caption (the group header, which the browser keeps with the table's first page), the identity in the header row (repeats when the block splits), then each live layer's fields, then the missing-layers line. A record short enough to fit a page is unsplittable; a long one starts on a fresh page, flows and splits between rows, and ends with a wider gap. */
  var map=LAYER_MAPS[type];if(!map||!rec)return '';var full=(depth==='full');
  var idr=map.identity(rec);var title=esc(idr.title||'');var meta=(idr.meta||[]).filter(Boolean).map(esc).join(' \u00b7 ');
  var body='';var rowCount=0;  var live=lyLive(map,rec,upto);
  var rowsOf=function(l,all){var rows='';l.fields.forEach(function(f){if(!all&&!f.summary)return;var v=null;try{v=f.get(rec)}catch(e){}
      if(f.list)rows+=lyList(f.label,v,f.fmt);else rows+=lyRow(f.label,f.fmt?f.fmt(v):v)});return rows};
  var leadL=lead?live.filter(function(l){return l.id===lead})[0]:null; /* 14 Sep 2026 (Paul's ruling, the Emergency Response portfolio): the named layer leads the record, every field of it, in a box; the other layers follow as context */
  if(leadL){live=live.filter(function(l){return l!==leadL});var lr=rowsOf(leadL,true);
    body+='<tr><td colspan="2" style="padding:8px 10px 12px"><div class="ly-lead" style="border:2px solid #9B2D3F;border-radius:6px;padding:8px 10px 2px"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9B2D3F;padding:0 0 6px;margin:0 0 2px;border-bottom:1px solid #9B2D3F">'+esc(leadL.title)+'</div><table style="width:100%;border-collapse:collapse">'+lr+'</table></div></td></tr>';rowCount+=1+(lr.match(/<tr>/g)||[]).length}
  live.forEach(function(l){var rows=rowsOf(l,full);
    if(rows){body+='<tr><td colspan="2" style="padding:9px 10px 3px;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+esc(l.title)+'</td></tr>'+rows;rowCount+=1+(rows.match(/<tr>/g)||[]).length}});
  var miss=lyMissing(map,rec,upto);
  if(miss.length){body+='<tr><td colspan="2" style="padding:7px 10px;font-size:12px;color:#8B3A1E">'+miss.map(function(m){return '\u25b8 '+esc(m)}).join('<br>')+'</td></tr>';rowCount++}
  var LONG=16; /* about a page of rows: beyond this the record flows and splits between rows rather than being forced to a fresh page */
  var h='<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;'+(rowCount>LONG?'break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;margin-bottom:40px':'break-inside:avoid;page-break-inside:avoid')+'">'+(caption?'<caption style="caption-side:top;text-align:left;padding:0">'+caption+'</caption>':'')+'<thead><tr><th colspan="2" style="text-align:left;padding:8px 10px;border-bottom:2px solid #111;background:#fff"><div style="font-size:14px;font-weight:700;color:#111">'+title+(idr.score?'<span style="float:right;font-weight:700">'+esc(idr.score)+'</span>':'')+'</div>'+(meta?'<div style="font-size:11px;color:#666;font-weight:400;margin-top:2px">'+meta+'</div>':'')+'</th></tr></thead><tbody>'+body;
  return h+'</tbody></table>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 18 — Add the function that prints a list of records under group headings.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRender` ends, after its closing `}`. You added that function in Step 17.

**Code:**

```js
function lyRegister(type,records,depth,upto,groups,onePerPage,lead){ /* a register document body: optional groups of records, each rendered. The group header is the largest, heaviest thing on the page, and it is the first record's table caption, so the browser keeps it with that record's first page whether the record is short or long */
  var h='';var gi=-1;(groups||[{name:'',list:records}]).filter(function(g){return g.list.length}).forEach(function(g){gi++;
    var head=g.name?'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111">'+esc(g.name)+' <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+g.list.length+'</span></div>':'';
    g.list.forEach(function(r,i){var blk=lyRender(type,r,depth,upto,(i===0&&head)?head:'',lead);h+=(onePerPage&&!(gi===0&&i===0))?'<div style="break-before:page;page-break-before:always">'+blk+'</div>':blk})});
  return h||'<div style="font-size:13px;color:#666;font-style:italic;padding:8px 0">Nothing on this register.</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 19 — Add the function that collects what a set of records is missing, for the report's What is missing list.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRegister` ends, after its closing `}`. You added that function in Step 18.

**Code:**

```js
function lyGaps(type,records,upto){var out=[];var map=LAYER_MAPS[type];if(!map)return out;records.forEach(function(r){var m=lyMissing(map,r,upto);if(m.length)out.push({title:map.identity(r).title,lines:m})});return out}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 20 — Add the description of a risk record: its first row (name and main facts) and each part of it that can print.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyGaps` ends, after its closing `}`. You added that function in Step 19.

**Code:**

```js
/* ── GOVERNANCE: the risk (Spec Rev A §11; summary marks as ruled 12 Sep 2026) ── */
LAYER_MAPS.risk={
  identity:function(r){var sy=(data.systems||[]).find(function(x){return x.id===r.systemId});var cat=(typeof POSTI!=='undefined'&&(POSTI.find(function(x){return x.key===r.category})||{}).name)||r.category||'';
    var comp=compositeOf(r);var rapid=(!comp&&(r.likelihood||r.impact||r.timeframe))?((+r.likelihood||0)+(+r.impact||0)+(+r.timeframe||0)):0;
    var chips=[];if(r.escalation)chips.push('In emergency response');if(r.dismissed)chips.push('Dismissed');if(typeof isArchivedRisk==='function'&&isArchivedRisk(r))chips.push('Archived');
    return {title:r.name||'Unnamed risk',score:(comp||rapid)?((comp||rapid)+'/15'):'',meta:[r.classification?respLabel(r.classification):'',(r.selection||{}).owner?'Owner: '+r.selection.owner:'',r.source==='external'?'External risk':(sy?'AI system: '+sy.name:''),cat,r.domain||''].concat(chips)}},
  layers:[
   {id:'prelim',title:'Preliminary risk card',stage:'1',present:function(r){return !!(r.description||r.likelihood||r.impact||r.timeframe)},fields:[
     {label:'What could happen',get:function(r){return r.description},summary:true},
     {label:'Rapid risk screen',get:function(r){var L=r.litL||r.likelihood,I=r.litI||r.impact,T=r.litT||r.timeframe;return (L||I||T)?('Likelihood '+(L||'\u2014')+' \u00b7 Impact '+(I||'\u2014')+' \u00b7 Timeframe '+(T||'\u2014')+' \u2014 '+((+L||0)+(+I||0)+(+T||0))+'/15'):''},summary:true}, /* 12 Sep 2026 (Paul's print pass): Step 1.3 writes the screen to litL/litI/litT; the old keys were a relic */
     {label:'Expertise needed',get:function(r){return (r.needs&&r.needs.expertise)||r.needsExpertise}},
     {label:'Required effort',get:function(r){var e=(r.needs&&r.needs.effort)||r.needsEffort;return ({conversation:'A conversation','half-day':'Half a day','few-days':'A few days','week-plus':'A week or more'}[e]||e)}},
     {label:'Ethical dimension',get:function(r){var e=ethStatusOf(r);return e?(e==='confirmed'?'Confirmed: crosses a Responsible AI line':'Flagged as potentially crossing a Responsible AI line')+(r.ethicalDesc?' \u2014 '+r.ethicalDesc:''):''}},
     {label:'Selection decision',get:function(r){var sl=r.selection||{};return sl.decision?(sl.decision.charAt(0).toUpperCase()+sl.decision.slice(1)+(sl.trigger?' \u2014 revisit when: '+sl.trigger:'')):''},summary:true},
     {label:'Preliminary plan',get:function(r){return r.prelimPlan}},
     {label:'Logged',get:function(r){return r.loggedAt?new Date(r.loggedAt).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'}):''}}]},
   {id:'assess',title:'Deep-dive assessment',stage:'3.2',supersedes:'prelim',present:function(r){var a=r.assess||{};return !!(a.desc||a.context||(a.rootCauses||[]).length||(a.controls||[]).length||a.noControls||a.impOps||a.impFin)},fields:[
     {label:'Expanded description',get:function(r){return (r.assess||{}).desc},summary:true},
     {label:'Context',get:function(r){return (r.assess||{}).context}},
     {label:'Root causes',get:function(r){return (r.assess||{}).rootCauses||[]},list:true,fmt:function(rc){return rc.text+(rc.level?' ('+rc.level+')':'')}},
     {label:'Current controls',get:function(r){var a=r.assess||{};return a.noControls?[{text:'None recorded'}]:(a.controls||[])},list:true,fmt:function(c){return c.text+(c.eff?' ('+c.eff+')':'')}},
     {label:'Controls in place',get:function(r){var a=r.assess||{};if(a.noControls)return 'None recorded';var c=a.controls||[];return c.length?(c.length+' control'+(c.length===1?'':'s')+(c.some(function(x){return x.eff})?' \u2014 '+c.map(function(x){return x.eff}).filter(Boolean).join(', '):'')):''},summary:true},
     {label:'Capability gaps',get:function(r){var a=r.assess||{};return a.capGapsList&&a.capGapsList.length?a.capGapsList:a.capGaps}},
     {label:'Onset speed',get:function(r){return (r.assess||{}).velOnset}},
     {label:'Response window',get:function(r){return (r.assess||{}).velWindow}},
     {label:'Velocity details',get:function(r){return (r.assess||{}).velDetail}},
     {label:'Triggers \u2014 early-warning indicators',get:function(r){var a=r.assess||{};return [].concat(a.triggers||[],a.trigDetail?[a.trigDetail]:[])},list:true},
     {label:'Likelihood basis',get:function(r){return (r.assess||{}).likelihoodBasis}},
     {label:'Interdependencies',get:function(r){var a=r.assess||{};return [a.depsInt,a.depsExt].filter(Boolean).join('; ')}},
     {label:'Stakeholders',get:function(r){return (r.assess||{}).stakeholders}},
     {label:'Operational impact',get:function(r){return (r.assess||{}).impOps},summary:true},
     {label:'Financial impact',get:function(r){return (r.assess||{}).impFin},summary:true},
     {label:'Strategic impact',get:function(r){return (r.assess||{}).impStrat}},
     {label:'Reputational consequences',get:function(r){return (r.assess||{}).repCons}},
     {label:'Cultural consequences',get:function(r){var a=r.assess||{};return [a.cultCons,a.repCultural].filter(Boolean).join('; ')}},
     {label:'Other impacts',get:function(r){var a=r.assess||{};return a.otherList&&a.otherList.length?a.otherList:a.otherImpacts}},
     {label:'Quantified impact',get:function(r){return (r.assess||{}).quant}},
     {label:'Cascade effects',get:function(r){return (r.assess||{}).cascades}},
     {label:'Marked not applicable',get:function(r){return Object.keys((r.assess||{}).na||{})}}]},
   {id:'class',title:'Scoring and classification',stage:'3.3',present:function(r){return !!(r.classification||r.assessRec||r.ethTest||r.resolution)},fields:[
     {label:'LIT score',get:function(r){return (r.litL||r.litI||r.litT)?('Likelihood '+(r.litL||'\u2014')+' \u00b7 Impact '+(r.litI||'\u2014')+' \u00b7 Timeframe '+(r.litT||'\u2014')+' \u2014 '+compositeOf(r)+'/15'):''},summary:true},
     {label:'Classification',get:function(r){return r.classification?respLabel(r.classification):''},summary:true},
     {label:'Rationale',get:function(r){return (r.assessRec||{}).rationale}},
     {label:'Plan',get:function(r){return (r.assessRec||{}).plan},summary:true},
     {label:'Responsible AI check',get:function(r){var e=ethStatusOf(r);var t=r.ethTest;return [e?('Status: '+e):'',t&&t.by?('Checked by '+t.by):''].filter(Boolean).join(' \u00b7 ')},summary:true},
     {label:'Resolution',get:function(r){var x=r.resolution;return x?[x.type,x.rationale].filter(Boolean).join(' \u2014 '):''}}]},
   {id:'mgplan',title:'Management plan',stage:'4.1',present:function(r){var p=r.mgmtPlan;return !!(p&&((p.plans||[]).length||p.notes||(p.emergencies&&(p.emergencies.na===true||(Array.isArray(p.emergencies)&&p.emergencies.length)))))},
     required:function(r){return r.classification==='manage'},missing:'No management plan recorded.',
     complete:function(r){return (typeof mgPlanComplete==='function'&&!mgPlanComplete(r))?'The management plan is incomplete: it needs at least one plan with an action, and emergency plans listed or marked not applicable.':null},fields:[
     {label:'Plans',get:function(r){return (r.mgmtPlan||{}).plans||[]},list:true,fmt:function(p){return p.name+(p.type?' ('+p.type+')':'')+(p.owner?' \u2014 owner '+p.owner:'')},summary:true},
     {label:'Actions',get:function(r){var out=[];((r.mgmtPlan||{}).plans||[]).forEach(function(p){(p.actions||[]).forEach(function(a){out.push({p:p.name,a:a})})});return out},list:true,fmt:function(x){var a=x.a;return (x.p?x.p+': ':'')+(a.action||'')+(a.owner?' \u2014 '+a.owner:'')+(a.timeframe?' \u00b7 '+a.timeframe:'')+(a.recur?' \u00b7 recurring':'')}},
     {label:'Actions in the plan',get:function(r){var n=0;((r.mgmtPlan||{}).plans||[]).forEach(function(p){n+=(p.actions||[]).length});return n?(n+' action'+(n===1?'':'s')):''},summary:true},
     {label:'Action details',get:function(r){var out=[];((r.mgmtPlan||{}).plans||[]).forEach(function(p){(p.actions||[]).forEach(function(a){if(a.description)out.push(a.action+': '+a.description)})});return out},list:true},
     {label:'Emergency plans',get:function(r){var e=(r.mgmtPlan||{}).emergencies;if(e&&e.na===true)return 'Not applicable';return (Array.isArray(e)?e:[]).map(function(x){return x.name||''}).filter(Boolean)},summary:true},
     {label:'Emergency plan details',get:function(r){var e=(r.mgmtPlan||{}).emergencies;return Array.isArray(e)?e:[]},list:true,fmt:function(x){return x.name+': triggers \u2014 '+(x.triggers||'\u2014')+'; first moves \u2014 '+(x.firstMoves||'\u2014')+'; lead \u2014 '+(x.lead||'\u2014')+'; stand-down \u2014 '+(x.standDown||'\u2014')}},
     {label:'Notes',get:function(r){return (r.mgmtPlan||{}).notes}},
     {label:'Recorded',get:function(r){var p=r.mgmtPlan||{};return p.by?(p.by+(p.at?', '+new Date(p.at).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'}):'')):''}}]},
   {id:'mnplan',title:'Monitoring plan',stage:'4.1',present:function(r){var m=r.monitorPlan;return !!(m&&(m.monitor||(m.indicators||[]).length))},
     required:function(r){return r.classification==='monitor'},missing:'No monitoring plan recorded.',
     complete:function(r){return (typeof mnPlanComplete==='function'&&!mnPlanComplete(r))?'The monitoring plan is incomplete: it needs a monitoring statement and at least one indicator.':null},fields:[
     {label:'What is being monitored',get:function(r){return (r.monitorPlan||{}).monitor},summary:true},
     {label:'Frequency',get:function(r){var f=(r.monitorPlan||{}).frequency;return f?((MN_FREQ.find(function(x){return x.v===f})||{}).l||f):''},summary:true},
     {label:'Indicators',get:function(r){return (r.monitorPlan||{}).indicators||[]},list:true,fmt:function(i){return (i.indicator||'')+(i.threshold?' \u2014 threshold '+i.threshold:'')}},
     {label:'Indicators watched',get:function(r){var n=((r.monitorPlan||{}).indicators||[]).length;return n?(n+' indicator'+(n===1?'':'s')):''},summary:true},
     {label:'Indicator details',get:function(r){return ((r.monitorPlan||{}).indicators||[]).filter(function(i){return i.owner||i.description||i.source})},list:true,fmt:function(i){return (i.indicator||'')+': '+[i.description,i.owner?'owner '+i.owner:'',i.source?'source '+i.source:''].filter(Boolean).join('; ')}},
     {label:'Emergency plans',get:function(r){var e=(r.monitorPlan||{}).emergencies;if(e&&e.na===true)return 'Not applicable';return (Array.isArray(e)?e:[]).map(function(x){return x.name||''}).filter(Boolean)},summary:true},
     {label:'Recorded',get:function(r){var p=r.monitorPlan||{};return p.by?(p.by+(p.at?', '+new Date(p.at).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'}):'')):''}}]},
   {id:'emergency',title:'Emergency response',stage:'5',present:function(r){return !!r.escalation},fields:[ /* 14 Sep 2026 (Paul's print pass): what happened and who escalated join the layer; the plan in force is resolved as the app resolves it */
     {label:'What happened',get:function(r){return (r.escalation||{}).what},summary:true},
     {label:'Escalated',get:function(r){var e=r.escalation||{};return e.by?(e.by+(e.at?', '+lyDate(e.at):'')):(e.at?lyDate(e.at):'')}},
     {label:'Emergency plan in force',get:function(r){var t=erEmTarget(r);if(t&&t.name)return t.name;return erWorkingPlan(r)?'Written at escalation':''},summary:true},
     {label:'Lead',get:function(r){var p=erWorkingPlan(r);return p?p.lead:''},summary:true},
     {label:'Triggers',get:function(r){var p=erWorkingPlan(r);return p?p.triggers:''}},
     {label:'First moves',get:function(r){var p=erWorkingPlan(r);return p?p.firstMoves:''}},
     {label:'Stand-down',get:function(r){var p=erWorkingPlan(r);return p?p.standDown:''}}]},
   {id:'testing',title:'Testing and evidence',stage:'3.3',present:function(r){return !!(((r.testingPlan||{}).tests||[]).length||(r.testEvidence&&r.testEvidence.length))},fields:[
     {label:'Tests',get:function(r){return ((r.testingPlan||{}).tests||[]).map(function(t){return (t.kind==='threat'?'Threat: ':'Claim: ')+(t.claim||t.test||'')+(t.due?' \u00b7 due '+t.due:'')})},list:true},
     {label:'Tests planned',get:function(r){var n=((r.testingPlan||{}).tests||[]).length;return n?(n+' test'+(n===1?'':'s')):''},summary:true},
     {label:'Test details',get:function(r){return ((r.testingPlan||{}).tests||[])},list:true,fmt:function(t){return (t.test||'')+[t.shape?' \u00b7 '+t.shape:'',t.trigger?' \u00b7 '+t.trigger:'',t.runner?' \u00b7 runner '+t.runner:''].join('')}},
     {label:'Evidence',get:function(r){return r.testEvidence||[]},list:true,summary:true}]}
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 21 — Add the constant that numbers the parts of a risk record.

**Kind:** Add new code.

**Where:** Add this immediately after the code block that begins with the line `LAYER_MAPS.risk={` ends, after its closing `;`.

**Code:**

```js
var RISK_LAYER_INDEX={prelim:0,assess:1,'class':2,mgplan:3,mnplan:4,emergency:5,testing:6};
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 22 — Add the description of a compliance regime record: its first row and each part of it that can print.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RISK_LAYER_INDEX` ends, after its closing `;`. You added that constant in Step 21.

**Code:**

```js
/* 14 Sep 2026 (Paul's ruling): the report as it will print, at any point in the assembly, without the print dialog */
/* ── GOVERNANCE: the compliance regime (Spec Rev A §12) ── */
LAYER_MAPS.regime={
  identity:function(g){return {title:g.name||'Unnamed regime',score:'',meta:[g.type?((REG_TYPES.find(function(t){return t.v===g.type})||{}).l||lyCap(g.type)):'',g.owner?'Owner: '+g.owner:'', /* 14 Sep 2026: the type prints as its label, not the stored token */(g.doc&&g.doc.name)?'Source: '+g.doc.name:(g.link?'Source: '+g.link:''),g.governed?'Governed':''].filter(Boolean)}},
  layers:[
   {id:'scoping',title:'Scoping',stage:'1.4',present:function(g){return !!(g.scoping||g.summary||(g.systems||[]).length)},fields:[
     {label:'Scoping',get:function(g){var sc=g.scoping;if(!sc)return '';if(typeof sc==='string')return sc;var J={applies:'Applies',na:'Does not apply',investigate:'Investigate'};return [J[sc.judgment]||sc.judgment||'',sc.reason||''].filter(Boolean).join(' \u2014 ')+(sc.by?' ('+sc.by+(sc.at?', '+lyDate(sc.at):'')+')':'')},summary:true},
     {label:'Systems in scope',get:function(g){if(g.systems==='all')return ['Every system in the inventory'];return (g.systems||[]).map(function(id){var sy=(data.systems||[]).find(function(x){return x.id===id});return sy?sy.name:id})},list:true,summary:true},
     {label:'Summary of the regime',get:function(g){return g.summary},summary:true}]},
   {id:'obligations',title:'Obligations',stage:'2.3',present:function(g){return !!((g.obligations||[]).length)},fields:[
     {label:'Obligations',get:function(g){var o=g.obligations||[];var by={met:0,progress:0,na:0,open:0};o.forEach(function(x){var k=x.status==='met'?'met':x.status==='progress'?'progress':x.status==='na'?'na':'open';by[k]++});return o.length+' obligation'+(o.length===1?'':'s')+': '+by.met+' met \u00b7 '+by.progress+' in progress \u00b7 '+by.open+' not started'+(by.na?' \u00b7 '+by.na+' not applicable':'')},summary:true},
     {label:'Statements',get:function(g){return g.obligations||[]},list:true,fmt:function(o){var st=o.status==='met'?'Met':o.status==='progress'?'In progress':o.status==='na'?'N/A':'Not started';return (o.statement||'')+' \u2014 '+st}},
     {label:'Evidence',get:function(g){return (g.obligations||[]).filter(function(o){return o.evidence})},list:true,fmt:function(o){return (o.statement||'').slice(0,60)+(o.statement&&o.statement.length>60?'\u2026':'')+': '+o.evidence}}]},
   {id:'review',title:'Review',stage:'4',present:function(g){return !!(g.revisit||(g.history||[]).length)},fields:[
     {label:'Revisit',get:function(g){return g.revisit},summary:true},
     {label:'History',get:function(g){return g.history||[]},list:true,fmt:function(h){return typeof h==='string'?h:lyText(h)}}]}
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 23 — Add the description of an AI system record: its first row and each part of it that can print.

**Kind:** Add new code.

**Where:** Add this immediately after the code block that begins with the line `LAYER_MAPS.regime={` ends, after its closing `;`.

**Code:**

```js
/* ── GOVERNANCE: the AI system (Spec Rev A §13) ── */
LAYER_MAPS.system={
  identity:function(sx){return {title:sx.name||'Unnamed system',score:'',meta:[sx.isExternal?'External':'Internal',sx.owner?'Owner: '+sx.owner:'',sx.govStatus?'Governance: '+({governed:'Formally governed',partial:'Some governance',none:'No governance'}[sx.govStatus]||lyCap(sx.govStatus)):''].filter(Boolean)}}, /* 14 Sep 2026: the status prints as words, not the stored token */
  layers:[
   {id:'inventory',title:'Inventory',stage:'1.2',present:function(sx){return !!(sx.fn||sx.dataUsed||sx.peopleAffected)},fields:[
     {label:'Function',get:function(sx){return sx.fn},summary:true},
     {label:'Data used',get:function(sx){return sx.dataUsed},summary:true},
     {label:'People affected',get:function(sx){return sx.peopleAffected},summary:true},
     {label:'Specification document',get:function(sx){return sx.specDoc?(sx.specDoc.name||sx.specDoc.url||''):''}}]},
   {id:'tests',title:'Testing plan',stage:'3.3',present:function(sx){return !!(((sx.testingPlan||{}).tests||[]).length)},fields:[
     {label:'Tests',get:function(sx){var t=(sx.testingPlan||{}).tests||[];var c=t.filter(function(x){return x.kind!=='threat'}).length,th=t.length-c;return t.length+' test'+(t.length===1?'':'s')+': '+c+' claim'+(c===1?'':'s')+', '+th+' threat'+(th===1?'':'s')},summary:true},
     {label:'Due',get:function(sx){return ((sx.testingPlan||{}).tests||[]).filter(function(t){return t.due}).map(function(t){return (t.claim||t.test||'')+' \u2014 '+t.due})},list:true,summary:true},
     {label:'Each test',get:function(sx){return (sx.testingPlan||{}).tests||[]},list:true,fmt:function(t){return lyTestText(t)}},
     {label:'Removed',get:function(sx){return (sx.testingPlan||{}).removedNames||[]},list:true}]},
   {id:'evidence',title:'Evidence',stage:'5',present:function(sx){return !!((sx.testEvidence||[]).length)},fields:[
     {label:'Evidence',get:function(sx){var e=sx.testEvidence||[];if(!e.length)return '';var last=e.slice().sort(function(a,b){return (b.at||0)-(a.at||0)})[0];return e.length+' item'+(e.length===1?'':'s')+' \u2014 latest: '+(last.outcome||'')+(last.at?', '+lyDate(last.at):'')},summary:true},
     {label:'Each item',get:function(sx){return (sx.testEvidence||[]).map(function(e){return Object.assign({},e,{_sys:sx})})},list:true,fmt:function(e){return lyEvidenceText(e,e._sys)}}]}
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 24 — Add the function that shows the same record tables on screen, in the screen's colors.

**Kind:** Add new code.

**Where:** Add this immediately after the code block that begins with the line `LAYER_MAPS.system={` ends, after its closing `;`.

**Code:**

```js
/* the register outputs' screens show the engine's record blocks beneath their own headings (the output side may change; the working surfaces do not) */
function lyScreenRegister(type,records,depth,upto,groups){var h=lyRegister(type,records,depth,upto,groups);return '<div class="ly-screen" style="font-size:13px">'+h.replace(/color:#111/g,'color:var(--paper)').replace(/color:#555/g,'color:var(--text-muted)').replace(/color:#333/g,'color:var(--text-muted)').replace(/color:#666/g,'color:var(--text-faint)').replace(/background:#fff/g,'background:transparent').replace(/border-bottom:2px solid #111/g,'border-bottom:2px solid rgba(var(--fg-rgb),.5)').replace(/border-bottom:1px solid #111/g,'border-bottom:1px solid rgba(var(--fg-rgb),.4)').replace(/border-bottom:1px solid #eee/g,'border-bottom:1px solid rgba(var(--fg-rgb),.08)')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 25 — Add the function that draws the Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyScreenRegister` ends, after its closing `}`. You added that function in Step 24.

**Code:**

```js
function lyDepthCtl(){var d=(UI.printDepth||'summary');return '<span style="display:inline-flex;gap:4px;align-items:center;margin-right:8px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint)">DEPTH</span>'+['summary','full'].map(function(k){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(d===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.printDepth=\''+k+'\';render()">'+(k==='summary'?'Summary':'Full')+'</button>'}).join('')+'</span>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 26 — Replace the function that builds a risk register document.

**Kind:** Replace existing code.

**Where:** Find the function named `printRegisterDoc`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function printRegisterDoc(title,lead,lane){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* Round 2: the depth control the outputs and the print share */

/* the register documents, under the rule: identity + the summary of every live layer up to the register's own phase */
function printRegisterDoc(title,lead,lane){
  var P=getPortfolios();var flt=pfApplyF(lane,P[lane]||[]);
  flt=flt.slice().sort(function(a,b){return compositeOf(b)-compositeOf(a)});
  var upto={identify:RISK_LAYER_INDEX.prelim,assess:RISK_LAYER_INDEX['class'],manage:RISK_LAYER_INDEX.mnplan,emergency:RISK_LAYER_INDEX.testing}[lane];
  var depth=(UI&&UI.printDepth)||'summary';
  var h=printDocCover(title,lead,'');
  var urg=flt.filter(function(r){return compositeOf(r)>=10}),rest=flt.filter(function(r){return compositeOf(r)<10});
  h+=lyRegister('risk',flt,depth,upto,[{name:'Urgent Risks',list:urg},{name:'Other Risks',list:rest}],lane==='manage'); /* 14 Sep 2026 (Paul's ruling): the updated register prints one record per page at either depth */
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 27 — Replace the list of phases, steps, and outputs. The Risk Classification Report is removed from Phase 3, and Phase 1's outputs are reordered.

**Kind:** Replace existing code.

**Where:** Find the constant named `PH`. It begins with the line below. Delete the whole constant, from that line to the closing `;` that ends it, and put the code in its place.

```js
var PH=[
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
var PH=[
{id:1,name:'Map',days:'Days 1\u201330',color:'#1E6E6E',steps:[{id:'1.1',name:'Assessment Battery',icon:'▣'},{id:'1.2',name:'AI System Inventory',icon:'◇'},{id:'1.3',name:'Identify Risks',icon:'◎'},{id:'1.4',name:'Regulatory Landscape',icon:'⊜'}],outcomes:[{id:'out-assessprofile',name:'Assessment Profile'},{id:'out-sysinv',name:'Systems Inventory'},{id:'out-riskreg',name:'Initial Risk Register'},{id:'out-reglandscape',name:'Compliance Survey'}] /* 13 Sep 2026 (Paul's ruling): the inventory before the register, the order of the steps */},
{id:2,name:'Build',days:'Days 31\u201350',color:'#8B4513',steps:[{id:'2.1',name:'Responsible AI Framework',icon:'⊞'},{id:'2.2',name:'Ownership & Structure',icon:'⊜'},{id:'2.3',name:'Risk Review Cadence',icon:'↻'},{id:'2.4',name:'Compliance Catalog',icon:'⊙'},{id:'2.5',name:'Assessment Prioritization',icon:'⊚'}],outcomes:[{id:'out-ethicsdoc',name:'Responsible AI Principles'},{id:'out-raci2',name:'RACI Matrix'},{id:'out-govsystems',name:'Governance Systems Report'},{id:'out-compliance',name:'Compliance Obligations'}]},
{id:3,name:'Assess',days:'Days 51\u201370',color:'#C8860A',steps:[{id:'3.1',name:'Responsible AI Screening',icon:'⊕'},{id:'3.2',name:'Deepen Assessment',icon:'⊡'},{id:'3.3',name:'Testing & Evidence',icon:'⊘'}],outcomes:[{id:'out-assessedreg',name:'Assessed Risk Register'},{id:'out-testing',name:'Testing & Evidence'}] /* 12 Sep 2026 (Paul's ruling): the classification report is folded into the registers, where every record's identity carries its classification */},
{id:4,name:'Embed',days:'Days 71\u201390',color:'#3D4F5C',steps:[{id:'4.1',name:'Manage and Monitor',icon:'◻'},{id:'4.2',name:'Finalize the Framework',icon:'△'},{id:'4.3',name:'Review the Systems',icon:'↗'},{id:'4.4',name:'First Governance Review',icon:'⊟'}],outcomes:[{id:'out-exitplans',name:'Management & Monitoring Plans'},{id:'out-govfw',name:'Governance Framework'},{id:'out-updatedreg',name:'Updated Risk Register'}]},
{id:5,name:'Govern',days:'Ongoing',color:'#2A5A5A',steps:[{id:'5.1',name:'Governance Dashboard',icon:'⬡'},{id:'5.2',name:'Compliance Dashboard',icon:'⊞'},{id:'5.3',name:'Testing Center',icon:'⊚'},{id:'5.4',name:'Analytics',icon:'∿'}],outcomes:[]}
];
```

**Check:** Open the sidebar. Under Phase 1, the Outputs are listed in this order: Assessment Profile, Systems Inventory, Initial Risk Register, Compliance Survey. Under Phase 3 there is no Risk Classification Report.

---

### Step 28 — Delete the function that drew the Risk Classification Report. Nothing uses it any more.

**Kind:** Delete existing code.

**Where:** Find the function named `renderOutRiskClass`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it. Put nothing in its place.

```js
function renderOutRiskClass(){
```

**Code:** none. Nothing goes in its place.

**Check:** Open the app. It loads, and its pages open without an error message. The sidebar lists no Risk Classification Report.

---

### Step 29 — Add the function that keeps a capability's bar and its priorities together in the Governance Systems Report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `apBlock` ends, after its closing `}`.

**Code:**

```js
function gsChunk(inner,last){return '<div style="break-inside:avoid;page-break-inside:avoid;padding:0 0 16px;margin:0 0 16px;'+(last?'':'border-bottom:1px solid rgba(var(--fg-rgb),.14);')+'">'+inner+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 30 — Replace the function that counts the Governance Systems Report's figures.

**Kind:** Replace existing code.

**Where:** Find the function named `gsCount`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function gsCount(){var os=data.operatingSystem||{};var is=data.incentivesSkills||{};
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// Governance Systems Report (Phase 2, ruled by Paul 21 Aug 2026 — everything Step 2.2 captures, board-presentable)
// The frame-plus-attributed-block law throughout: authored copy frames; user text is quoted, never woven.
function gsCount(){var os=data.ownership||{};var is=data.incentivesSkills||{}; /* 12 Sep 2026 (Paul's ruling): the module's own store is data.ownership, what Step 2.2 writes and reads; data.operatingSystem was written nowhere, so these seven fields always read blank */
var vals=[os.govModel,os.governanceOwner,os.ownerAuthority,os.ownerDedication,os.buLeads,os.escalation,is.leadershipSkill,is.technicalSkill,is.frontlineSkill,is.legalSkill,gsPrioArr(is,'leadershipPriorities').length,gsPrioArr(is,'technicalPriorities').length,gsPrioArr(is,'frontlinePriorities').length,gsPrioArr(is,'legalPriorities').length,is.plan90,is.planLong,os.thirdPartyPolicy];
var n=0;vals.forEach(function(v){if(typeof v==='number'?v>0:String(v==null?'':v).trim())n++});return {answered:n,total:vals.length}}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 31 — Replace the function that draws the Governance Systems Report page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutGovSystems`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutGovSystems(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderOutGovSystems(){
var os=data.ownership||{};var is=data.incentivesSkills||{};var cnt=gsCount(); /* 12 Sep 2026 (Paul's ruling): read the module's own store */
var GM={centralized:'Centralized \u2014 single team owns all governance',decentralized:'Decentralized \u2014 each unit governs independently',hybrid:'Hybrid \u2014 central standards + embedded leads',committee:'Committee \u2014 cross-functional governance committee'};
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;margin:0 0 4px">Governance Systems Report</h2><p style="color:var(--text-faint);font-size:13px;margin:0">How the organization runs AI governance, in its own words: the model, the people, the skills, and the vendor policy. '+cnt.answered+' of '+cnt.total+' fields recorded.</p></div><div><button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button></div></div>';
h+=apSection('The governance model','Who owns AI governance and how the authority runs.',
apBlock('Governance model',GM[os.govModel]||'')+apBlock('Owner',os.governanceOwner)+apBlock('What authority does this person have?',os.ownerAuthority)+apBlock('How much of their role is dedicated to AI governance?',os.ownerDedication)+apBlock('Business Unit Leads',os.buLeads)+apBlock('Escalation Path',os.escalation));
/* the RACI section left this report 13 Sep 2026 (Paul's ruling): the matrix has its own document */
h+=apSection('Skills and capability','The four capability readings, rated by the organization, with its own development priorities.',
gsChunk(apStrip('Leadership: understands AI risk well enough to govern it',is.leadershipSkill,'No capability','Strong')+gsPrio('Leadership priorities',gsPrioArr(is,'leadershipPriorities')))
+gsChunk(apStrip('Technical teams: bias detection, human-centered design, monitoring',is.technicalSkill,'No capability','Strong')+gsPrio('Technical priorities',gsPrioArr(is,'technicalPriorities')))
+gsChunk(apStrip('Frontline managers: understand how AI changes their teams\u2019 work',is.frontlineSkill,'No capability','Strong')+gsPrio('Frontline priorities',gsPrioArr(is,'frontlinePriorities')))
+gsChunk(apStrip('Legal/compliance: understand the evolving AI regulatory landscape',is.legalSkill,'No capability','Strong')+gsPrio('Legal/compliance priorities',gsPrioArr(is,'legalPriorities')),true)); /* 13 Sep 2026 (Paul's ruling): each capability's bar and its priorities stay together as one chunk, with a gap and a hairline beneath, on the page and on paper */
h+=apSection('The development plan','What the organization committed to build, in its own words.',
apBlock('First 90 days',is.plan90)+apBlock('Long-term plan',is.planLong));
h+=apSection('Third-party / Vendor AI','The policy for AI the organization buys rather than builds.',
apBlock('Your policy for AI you buy rather than build',os.thirdPartyPolicy));
var gaps=[];
if(!os.govModel)gaps.push('No governance model selected.');
if(!String(os.governanceOwner||'').trim())gaps.push('No governance owner named.');
/* the accountable-name gap left with the RACI section (13 Sep 2026): the matrix's own document carries it */
[['leadershipSkill','Leadership'],['technicalSkill','Technical teams'],['frontlineSkill','Frontline managers'],['legalSkill','Legal/compliance']].forEach(function(k){if(!is[k[0]])gaps.push(k[1]+' capability is unrated.')});
if(!String(os.thirdPartyPolicy||'').trim())gaps.push('No third-party / vendor AI policy described.');
if(gaps.length){var gh='';gaps.forEach(function(g){gh+='<div style="display:flex;gap:8px;margin:0 0 8px"><span style="color:#B34208">\u25b8</span><span style="font-size:14px;line-height:1.5">'+g+'</span></div>'});
h+=apSection('Recorded gaps','Stated absences from the record. Each one is a finding to close.',gh)}
return h}
```

**Check:** Open the Governance Systems Report (Phase 2 output). The Governance Model section shows the model and owner recorded at Step 2.2. There is no RACI section on this page.

---

### Step 32 — Replace the function that draws the row of figures at the top of the Assessment Profile.

**Kind:** Replace existing code.

**Where:** Find the function named `apStrip`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function apStrip(q,v,lo,hi){var has=(typeof v==='number'&&v>=1&&v<=5);var cells='';for(var i=1;i<=5;i++){cells+='<div class="ap-seg'+(has&&i===v?' on':'')+'" style="flex:1;height:8px;border-radius:4px;margin:0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(has&&i===v?'#1E6E6E':'rgba(138,130,120,.22)')+'"></div>'}
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* 13 Sep 2026 (Paul's ruling): a capability's bar and its priorities as one unsplittable chunk, a line break's worth of space and a hairline beneath */
function apStrip(q,v,lo,hi){var has=(typeof v==='number'&&v>=1&&v<=5);var cells='';for(var i=1;i<=5;i++){cells+='<div class="ap-seg'+(has&&i===v?' on':'')+'" style="flex:1;height:8px;border-radius:4px;margin:0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(has&&i===v?'#1E6E6E':'rgba(138,130,120,.22)')+'"></div>'}
return '<div style="margin:0 0 14px"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 6px">'+q+'</div>'+(has?'<div style="display:flex;align-items:center">'+cells+'</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:3px"><span>'+lo+'</span><span>'+hi+'</span></div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 33 — Replace the function that draws the Systems Inventory page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutSysInv`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutSysInv(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// Systems Inventory (Phase 1, item 51) \u2014 pulls the 1.2 register as a document
function renderOutSysInv(){
var systems=data.systems||[];
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;margin:0 0 4px">Systems Inventory</h2><p style="color:var(--text-faint);font-size:14px">The AI landscape inventory from Step 1.2 as a document: every system, its function, its owner, and its governance status.</p></div><div style="display:flex;align-items:center"><button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button></div>'+'</div>'; /* 12 Sep 2026 (Paul's print pass): one form only — the inventory's summary would equal its full */
if(!systems.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">No systems inventoried yet. Complete Step 1.2.</p></div>');return h}
h+=card(vizSystems()+'<div style="margin-top:18px">'+govSysTiles('estate')+'</div>'); /* 13 Sep 2026 (Paul's ruling): the output opens on the Step 1.2 overview and the Deployed / In development readout, as its document does */
h+=sysInventoryList();
return h}
```

**Check:** Open the Systems Inventory (Phase 1 output). Below the heading, the AI Systems Overview and the Deployed / In development readout appear, then the list of systems.

---

### Step 34 — Replace the function that draws the Compliance Survey page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutRegLandscape`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutRegLandscape(){var regs=data.regimes||[];
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// Updated Risk Register (Phase 4)
/* chunk 39 (O-1/O-2/O-3): the three new outcome documents \u2014 generated pages reading live data */
function renderOutRegLandscape(){var regs=data.regimes||[];
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;margin:0 0 4px">Compliance Survey</h2><p style="color:var(--text-faint);font-size:14px">The Compliance Register from Step 1.4 as a document: every regime and source of compliance obligations your organization has listed, awaiting the Step 2.4 scoping review.</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button>'+'</div>';
if(!regs.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">List potential regimes at Step 1.4.</p></div>');return h}
/* 14 Sep 2026 (Paul's ruling): the page reflects the document — one bar per regime with its name, type, scope badge, and source chip; the fold opens to the regime's scoping layer laid out as the PDF lays it out */
regs.forEach(function(g){var tl=(REG_TYPES.find(function(t){return t.v===g.type})||{}).l||'';
var key='svy_'+g.id;var open=!!UI.expanded[key];
var bar='<div class="xh" onclick="UI.expanded[\''+key+'\']='+(!open)+';render()" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer"><span style="color:var(--text-faint);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h3 style="font-size:15px;font-weight:700;margin:0;flex:1;min-width:160px">'+esc(g.name)+(tl?' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">'+esc(tl)+'</span>':'')+'</h3>'+scopeBadge(g)+regimeDocChip(g)+'</div>';
h+=card(bar+(open?'<div style="margin-top:12px" onclick="event.stopPropagation()">'+lyScreenRegister('regime',[g],'full',0)+'</div>':''),'margin-bottom:8px')});
return h}
```

**Check:** Open the Compliance Survey (Phase 1 output). Each regime is one line with a small triangle at its left. Click a line: it opens to show the regime's scoping record.

---

### Step 35 — Replace the function that draws the Compliance Obligations page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutCompliance`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutCompliance(){var regs=data.regimes||[];
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderOutCompliance(){var regs=data.regimes||[];
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;margin:0 0 4px">Compliance Obligations</h2><p style="color:var(--text-faint);font-size:14px">Itemized regimes appear as full catalogs under their headings, and light-path regimes appear as their summaries. The page does not demand itemization.</p></div>'+(regs.length?'<button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button>':'')+'</div>';
if(!regs.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">Author the register at Step 1.4; itemize at Step 2.4.</p></div>');return h}
/* 13 Sep 2026 (Paul's ruling): the page reflects the document — one bar per regime with its name, status counts, and badges; the fold opens to the regime record laid out exactly as the PDF lays it out */
regs.forEach(function(g){var obs=g.obligations||[];var by={met:0,progress:0,na:0,open:0};obs.forEach(function(o){var k=o.status==='met'?'met':o.status==='progress'?'progress':o.status==='na'?'na':'open';by[k]++});
var key='cmp_'+g.id;var open=!!UI.expanded[key];
var counts=obs.length?('<span style="font-size:12px;color:var(--text-faint);white-space:nowrap">'+obs.length+' obligation'+(obs.length===1?'':'s')+' \u00b7 <span style="color:#1B6B5A">'+by.met+' met</span> \u00b7 <span style="color:#C8860A">'+by.progress+' in progress</span> \u00b7 <span style="color:#9B2D3F">'+by.open+' not started</span>'+(by.na?' \u00b7 '+by.na+' n/a':'')+'</span>'):'<span style="font-size:12px;color:var(--text-faint)">No obligations itemized</span>';
var bar='<div class="xh" onclick="UI.expanded[\''+key+'\']='+(!open)+';render()" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer"><span style="color:var(--text-faint);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h3 style="font-size:15px;font-weight:700;margin:0;flex:1;min-width:160px">'+esc(g.name)+'</h3>'+scopeBadge(g)+regimeDocChip(g)+counts+'</div>';
h+=card(bar+(open?'<div style="margin-top:12px" onclick="event.stopPropagation()">'+lyScreenRegister('regime',[g],'full',null)+'</div>':''),'margin-bottom:10px')});
return h}
```

**Check:** Open the Compliance Obligations (Phase 2 output). Each regime is one line with its status counts. Click a line: it opens to show the regime's record.

---

### Step 36 — Replace the function that draws the Testing & Evidence page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutTesting`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutTesting(){var sys=data.systems||[];
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderOutTesting(){var sys=data.systems||[];
var withPlans=sys.filter(function(s){return ((s.testingPlan||{}).tests||[]).length});
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;margin:0 0 4px">Testing & Evidence</h2><p style="color:var(--text-faint);font-size:14px">Testing plans for each system.</p></div>'+(withPlans.length?'<button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button>':'')+'</div>';
if(!withPlans.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">Build the plans at Step 3.3.</p></div>');return h}
/* 13 Sep 2026 (Paul's ruling): the page reflects the document — one bar per system with its test and evidence counts; the fold opens to the system record laid out as the PDF lays it out */
withPlans.forEach(function(sx){var tests=(sx.testingPlan||{}).tests||[];var ev=sx.testEvidence||[];var claims=tests.filter(function(t){return t.kind!=='threat'}).length;
var key='tev_'+sx.id;var open=!!UI.expanded[key];
var counts='<span style="font-size:12px;color:var(--text-faint);white-space:nowrap">'+tests.length+' test'+(tests.length===1?'':'s')+' ('+claims+' claim'+(claims===1?'':'s')+', '+(tests.length-claims)+' threat'+(tests.length-claims===1?'':'s')+') \u00b7 '+ev.length+' evidence item'+(ev.length===1?'':'s')+'</span>';
var bar='<div class="xh" onclick="UI.expanded[\''+key+'\']='+(!open)+';render()" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer"><span style="color:var(--text-faint);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h3 style="font-size:15px;font-weight:700;margin:0;flex:1;min-width:160px">'+esc(sx.name)+'</h3>'+badge(sx.isExternal?'External':'Internal',sx.isExternal?'#7B4F8A':'#1E6E6E')+counts+'</div>';
h+=card(bar+(open?'<div style="margin-top:12px" onclick="event.stopPropagation()">'+lyScreenRegister('system',[sx],'full',null)+'</div>':''),'margin-bottom:10px')});
return h}
```

**Check:** Open Testing & Evidence (Phase 3 output). Each system is one line with its test and evidence counts. Click a line: it opens to show the system's record.

---

### Step 37 — Replace the function that draws the Initial Risk Register page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutRiskReg`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutRiskReg(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// Initial Risk Register (Phase 1)
function renderOutRiskReg(){
/* addendum 106 (13 Aug 2026): the output is a CLONE of the live Identify portfolio register (the 1.3 Preliminary Risk Register) — same shared renderer, same expandable bars; it can no longer drift */
var P=getPortfolios();var allRisks=data.risks||[];
var flt=pfApplyF('identify',P.identify||[]).sort(function(a,b){return compositeOf(b)-compositeOf(a)});
var risks=flt;
var h='<div style="display:flex;justify-content:flex-end;margin:0 0 10px"><button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button></div><h2 class="h-section">Initial Risk Register</h2><p class="t-lead">Risks identified during Phase 1 mapping, carrying their rapid scores — not yet assessed or classified.</p>';
h+=riskViz('identified',{identified:'out-riskreg',assessed:'out-assessedreg',managed:'out-updatedreg',resolved:'out-updatedreg'});
if(!risks.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">'+(allRisks.length?'All risks have progressed beyond identification. See Assessed or Updated registers.':'No risks identified yet. Complete Step 1.3.')+'</p></div>');return h}
h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>'+lyScreenRegister('risk',flt,(UI.printDepth||'summary'),RISK_LAYER_INDEX.prelim,[{name:'Urgent Risks',list:flt.filter(function(r){return compositeOf(r)>=10})},{name:'Other Risks',list:flt.filter(function(r){return compositeOf(r)<10})}]); /* Round 2 (12 Sep 2026): the output screen shows what the document prints — the engine's record blocks at the chosen depth; the live portfolio register stays on its own surface */
h+=archivePanel('identify');
return h}
```

**Check:** Open the Initial Risk Register (Phase 1 output). Above the list, two small buttons read SUMMARY and FULL. The risks show as tables with a header row per risk. Click FULL: each table shows more rows.

---

### Step 38 — Replace the function that draws the Assessed Risk Register page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutAssessedReg`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutAssessedReg(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// Assessed Risk Register (Phase 3)
function renderOutAssessedReg(){
/* addendum 106 (13 Aug 2026): CLONE of the live Assess portfolio register — shared renderer, same expandable bars */
var P=getPortfolios();var allRisks=data.risks||[];
var flt=pfApplyF('assess',P.assess||[]).sort(function(a,b){return compositeOf(b)-compositeOf(a)});
var risks=flt;
var h='<div style="display:flex;justify-content:flex-end;margin:0 0 10px"><button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button></div><h2 class="h-section">Assessed Risk Register</h2><p class="t-lead">Risks with LIT scores and Responsible AI assessments.</p>';
h+=riskViz('assessed',{identified:'out-riskreg',assessed:'out-assessedreg',managed:'out-updatedreg',resolved:'out-updatedreg'});
if(!risks.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">No risks assessed yet. Complete Phase 3 steps to score risks.</p></div>');return h}
h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>'+lyScreenRegister('risk',flt,(UI.printDepth||'summary'),RISK_LAYER_INDEX['class'],[{name:'Urgent Risks',list:flt.filter(function(r){return compositeOf(r)>=10})},{name:'Other Risks',list:flt.filter(function(r){return compositeOf(r)<10})}]); /* Round 2 (12 Sep 2026) */
h+=archivePanel('assess');
return h}
```

**Check:** Open the Assessed Risk Register (Phase 3 output). Above the list, two small buttons read SUMMARY and FULL. Click FULL: each risk's table shows more rows.

---

### Step 39 — Replace the function that draws the Updated Risk Register page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutUpdatedReg`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutUpdatedReg(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderOutUpdatedReg(){
/* addendum 106 (13 Aug 2026): CLONE of the live Manage/Monitor portfolio register — shared renderer, same tabs and expandable bars */
var P=getPortfolios();var allRisks=data.risks||[];
var flt=pfApplyF('manage',P.manage||[]);
var risks=flt;
var h='<div style="display:flex;justify-content:flex-end;margin:0 0 10px"><button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button></div><h2 class="h-section">Updated Risk Register</h2><p class="t-lead">Current state of risks after classification and management actions.</p>';
h+=riskViz('managed',{identified:'out-riskreg',assessed:'out-assessedreg',managed:'out-updatedreg',resolved:'out-updatedreg'},{identified:P.identify.length,assessed:P.assess.length,managed:P.manage.length,resolved:P.emergency.length}); /* 12 Sep 2026 (Paul's ruling, §15): the strip counts the portfolios' own lanes — it had counted every classified risk, archived ones included, and labelled the archived count Emergency Response */
if(!risks.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">'+(allRisks.length?'No risks classified yet. Complete Phase 3 to classify risks.':'No risks yet.')+'</p></div>');return h}
h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>'+lyScreenRegister('risk',flt,(UI.printDepth||'summary'),RISK_LAYER_INDEX.mnplan,[{name:'Urgent Risks',list:flt.filter(function(r){return compositeOf(r)>=10})},{name:'Other Risks',list:flt.filter(function(r){return compositeOf(r)<10})}]); /* Round 2 (12 Sep 2026) */
h+=archivePanel('manage');
return h}
```

**Check:** Open the Updated Risk Register (Phase 4 output). Above the list, two small buttons read SUMMARY and FULL. Click FULL: each risk's table shows more rows.

---

### Step 40 — Replace the function that draws the Governance Framework page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutGovFW`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutGovFW(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// Risk Classification Report (Phase 3)
/* renderOutRiskClass removed 12 Sep 2026 (Paul's ruling): the classification travels in every risk's identity in the registers */
function renderOutGovFW(){
var ef=data.ethicalFramework||{};var os=data.ownership||{};var dr=data.decisionRights||{};var gr=data.govRhythm||{};var eo=data.embedOps||{};var rc=data.reviewCadence||{};
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;color:var(--t-slate);margin:0 0 4px">Governance Framework</h2><p style="color:var(--text-faint);font-size:14px">Your complete AI governance framework from Phases 1\u20134</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button>'+'</div>';
h+=govFWBody();return h}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 41 — Replace the function that draws the Management & Monitoring Plans page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutExitPlans`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutExitPlans(){/* chunk 39 (O-4): the ruled retirement resolves \u2014 the 4.1 product replaces the dead exit-plan register */
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderOutExitPlans(){/* chunk 39 (O-4): the ruled retirement resolves \u2014 the 4.1 product replaces the dead exit-plan register */
var risks=data.risks||[];var managed=risks.filter(function(r){return cardClass(r)==='manage'});var monitored=risks.filter(function(r){return cardClass(r)==='monitor'});
var h='<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><h2 style="font-size:20px;font-weight:700;margin:0 0 4px">Management & Monitoring Plans</h2><p style="color:var(--text-faint);font-size:14px">Every managed risk carries its plan and every monitored risk has its watching conditions.</p></div>'+((managed.length||monitored.length)?'<button class="btn bg2" style="font-size:12px" onclick="printPage()">\u25be Save as PDF</button>':'')+'</div>';
if(!managed.length&&!monitored.length){h+=card('<div style="text-align:center;padding:48px"><p style="color:var(--text-faint)">Complete Step 4.1 \u2014 the plans land here as the portfolio activates.</p></div>');return h}
if(managed.length){h+='<h3 style="font-size:18px;font-weight:800;margin:0 0 10px">Manage ('+managed.length+')</h3>'; /* 14 Sep 2026 (Paul's ruling): the group is the managed risks; Manage, heavier and larger than the risk names beneath, the count in brackets */
managed.forEach(function(r){var pl=r.mgmtPlan||{};var plans=pl.plans||[];var ems=pl.emergencies||{};
h+=card('<h3 style="font-size:15px;font-weight:700;margin:0 0 8px">'+esc(r.name)+'</h3>'
+(plans.length?plans.map(function(p){var tl=(MG_TYPES.find(function(t){return t.v===p.type})||{}).l||p.type;
return '<p style="font-size:13px;margin:8px 0 4px"><strong>'+esc(p.name||'')+'</strong>'+(tl?' \u2014 '+esc(tl):'')+'</p>'
+(p.actions||[]).map(function(a){if(typeof a==='string')return '<div style="font-size:13px;color:var(--text-muted);padding:2px 0 2px 12px">\u2022 '+esc(a)+'</div>';return '<div style="font-size:13px;color:var(--text-muted);padding:2px 0 2px 12px">\u2022 '+esc(a.action||a.text||'')+(a.owner?' \u2014 '+esc(a.owner):'')+(a.timeframe?' \u00b7 '+esc(a.timeframe):'')+(a.recur?(a.doneAt?' \u00b7 last done '+fmt(a.doneAt):''):(a.done?' \u00b7 done':''))+'</div>'}).join('')}).join(''):'<p style="font-size:13px;color:var(--text-faint);font-style:italic;margin:0 0 6px">No plan on the card yet.</p>')
+((pl.notes||[]).length?'<p style="font-size:13px;margin:8px 0 4px"><strong>Progress notes:</strong></p>'+pl.notes.map(function(nn){return '<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">'+esc(nn.text||'')+' \u2014 '+esc(nn.by||'')+', '+fmt(nn.at)+'</p>'}).join(''):'')
+(ems.na?'<p style="font-size:12px;color:var(--text-faint);margin:6px 0 0">Emergency section: marked not applicable.</p>':((Array.isArray(ems)&&ems.length)?'<p style="font-size:13px;margin:8px 0 4px"><strong>Emergency plans:</strong></p>'+ems.map(function(em){return '<p style="font-size:12px;margin:4px 0 3px"><strong>'+esc(em.name||'')+'</strong></p>'+(em.triggers?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">Triggers: '+esc(em.triggers)+'</p>':'')+(em.firstMoves?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">First moves: '+esc(em.firstMoves)+'</p>':'')+(em.lead?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">Lead: '+esc(em.lead)+'</p>':'')+(em.standDown?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">Stood-down looks like: '+esc(em.standDown)+'</p>':'')}).join(''):''))
+(pl.by?'<p style="font-size:11px;color:var(--text-faint);margin:8px 0 0">'+esc(pl.by)+', '+fmt(pl.at)+'</p>':''))})}
if(monitored.length){h+='<h3 style="font-size:18px;font-weight:800;margin:18px 0 10px">Monitor ('+monitored.length+')</h3>';
monitored.forEach(function(r){var mp=r.monitorPlan||{};
h+=card('<h3 style="font-size:15px;font-weight:700;margin:0 0 8px">'+esc(r.name)+'</h3>'
+(mp.indicators?(Array.isArray(mp.indicators)?'<p style="font-size:13px;margin:0 0 4px"><strong>Indicators:</strong></p>'+mp.indicators.map(function(x){return '<div style="font-size:13px;color:var(--text-muted);padding:2px 0 2px 12px">\u2022 '+esc(x.indicator||'')+(x.owner?' \u2014 '+esc(x.owner):'')+(x.threshold?' \u00b7 <strong>Threshold:</strong> '+esc(x.threshold):'')+(x.source?' \u00b7 <strong>Data Source:</strong> '+esc(x.source):'')+'</div>'+(x.description?'<div style="font-size:12px;padding:0 0 2px 24px">'+esc(x.description)+'</div>':'')}).join(''):'<p style="font-size:13px;margin:0 0 4px"><strong>Indicators:</strong> '+esc(mp.indicators)+'</p>'):'<p style="font-size:13px;color:var(--text-faint);font-style:italic;margin:0 0 4px">No monitoring plan on the card yet.</p>')
+(mp.monitor?'<p style="font-size:13px;margin:0 0 4px"><strong>Monitor:</strong> '+esc(mp.monitor)+'</p>':'')
+(mp.frequency?'<p style="font-size:13px;margin:0 0 4px"><strong>Frequency:</strong> '+esc((MN_FREQ.find(function(f){return f.v===mp.frequency})||{}).l||mp.frequency)+'</p>':'')
+((Array.isArray(mp.emergencies)&&mp.emergencies.length)?'<p style="font-size:13px;margin:8px 0 4px"><strong>Emergency plans:</strong></p>'+mp.emergencies.map(function(em){return '<p style="font-size:12px;margin:4px 0 3px"><strong>'+esc(em.name||'')+'</strong></p>'+(em.triggers?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">Triggers: '+esc(em.triggers)+'</p>':'')+(em.firstMoves?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">First moves: '+esc(em.firstMoves)+'</p>':'')+(em.lead?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">Lead: '+esc(em.lead)+'</p>':'')+(em.standDown?'<p style="font-size:12px;color:var(--text-muted);margin:0 0 3px">Stood-down looks like: '+esc(em.standDown)+'</p>':'')}).join(''):'')
+(mp.by?'<p style="font-size:11px;color:var(--text-faint);margin:6px 0 0">'+esc(mp.by)+', '+fmt(mp.at)+'</p>':''))})}
return h}
```

**Check:** Open the Management & Monitoring Plans (Phase 4 output). The two group headings read Manage (n) and Monitor (n), large and bold.

---

### Step 42 — Replace the function that draws the RACI matrix.

**Kind:** Replace existing code.

**Where:** Find the function named `govRaciGrid`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function govRaciGrid(ro){ensureGovRaciModel();/* item 59: the donor's matrix, taken over wholesale */
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function govRaciGrid(ro){ensureGovRaciModel();/* item 59: the donor's matrix, taken over wholesale */
var cols=govRaciCols();var acts=data.raciActs||[];var raci=data.raci||{};
var colors={R:'#1B6B5A',A:'#2D5A8E',C:'#8B5E3C',I:'#6B7F8D'};/* addendum 188 (17 Aug 2026, Paul's ruling: Architecture RACI graphics port): letters ride solid chips, so Informed takes the module's slate-grey instead of a translucent token */
var h=(ro?'':'<p style="font-size:12px;color:var(--text-faint);margin:0 0 6px">Click on a blank space on the matrix to assign roles.</p>')+'<div class="u-df74e8d"><table class="u-d1d587b"><thead><tr><th class="u-cd4ed5d">Activity</th>';/* copy-pass 2.2 fixes (21 Aug 2026, ruled) */
cols.forEach(function(c){h+='<th class="u-136497d">'+esc(c.l)+'</th>'});
h+='</tr></thead><tbody>';
acts.forEach(function(a,ai){var aCount=cols.filter(function(c){return raci[a.id+':'+c.k]==='A'}).length;
h+='<tr style="background:'+(ai%2===0?'rgba(var(--fg-rgb),.04)':'rgba(var(--fg-rgb),.01)')+'"><td class="u-4a76a82">'+(ro?esc(a.name):'<div style="display:flex;align-items:flex-start;gap:6px"><input id="ran_'+a.id+'" value="'+esc(a.name)+'" onchange="saveRaciActName(\''+a.id+'\',this.value)" placeholder="Activity name" style="flex:1;min-width:120px;padding:5px 7px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:5px;font-size:13px;font-family:var(--sans);font-weight:600;background:transparent"><button onclick="removeGovRaciAct(\''+a.id+'\')" title="Remove activity" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:17px;font-weight:600;line-height:1;padding:4px 4px">\u00d7</button></div>')+(aCount!==1?'<div style="font-size:11px;color:#C8860A;font-weight:600;margin-top:2px;min-height:15px">exactly one accountable name'+(aCount>1?' \u2014 '+aCount+' now':'')+'</div>':'<div style="min-height:15px;margin-top:2px"></div>')/* copy-pass 2.2 fixes (21 Aug 2026, ruled): the warning line's space is reserved permanently, so cycling R\u2192A\u2192C\u2192I never reshapes the row */+'</td>';
cols.forEach(function(c){var key=a.id+':'+c.k;var v=raci[key]||'';
if(ro){h+='<td class="u-47b192e">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.3);font-size:13px">\u2014</span>')+'</td>'}
else{h+='<td class="u-47b192e" id="raci_'+key+'" onclick="govRaciCycle(\''+key+'\')" title="Click to cycle R \u2192 A \u2192 C \u2192 I \u2192 blank" style="cursor:pointer">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.35);font-size:13px">\u2014</span>')+'</td>'}});/* addendum 188: the select retired \u2014 the cell itself is the control, cycling on click as in the Architecture module */
h+='</tr>'});
h+='</tbody></table></div>';
h+=_raciLegend(colors);
if(!ro)h+='<div style="margin:10px 0 4px">'+btnAdd('+ Add Activity','addGovRaciAct()',null,'font-size:13px;padding:6px 14px')+'</div>';
return h}
```

**Check:** Open the RACI Matrix (Phase 2 output). The matrix shows the same rows and columns it showed before this step. No visible change until Step 46.

---

### Step 43 — Replace the constant that maps each output to the function that builds its printed document.

**Kind:** Replace existing code.

**Where:** Find the constant named `PRINT_DOCS`. It begins with the line below. Delete the whole constant, from that line to the closing `;` that ends it, and put the code in its place.

```js
var PRINT_DOCS={
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* ── Addendum 117 (14 Aug 2026, ruled): report DOCUMENT renderers ──
   The print path renders its own document from the data (cover page, sections,
   skip-empty detail rows) honoring on-screen choices (filters, sort, open folds).
   Outputs without a renderer fall back to the sanitized screen. */
var PRINT_DOCS={
'out-assessprofile':function(){var c=apCount();return printDocFromScreen(renderOutAssessProfile,'Assessment Profile','The organization\'s baseline, in its own words.',c.answered+' of '+c.total+' questions recorded')},
'out-govsystems':function(){var c=gsCount();return printDocFromScreen(renderOutGovSystems,'Governance Systems Report','How the organization runs AI governance, in its own words.',c.answered+' of '+c.total+' fields recorded')},
'out-riskreg':function(){return printRegisterDoc('Initial Risk Register','Risks identified during Phase 1 mapping, carrying their rapid scores — not yet assessed or classified.','identify')},
'out-assessedreg':function(){return printRegisterDoc('Assessed Risk Register','Risks with LIT scores and Responsible AI assessments.','assess')},
'out-updatedreg':function(){return printRegisterDoc('Updated Risk Register','Current state of risks after classification and management actions.','manage')},
'out-sysinv':function(){var sys=data.systems||[];return printDocCover('Systems Inventory','Every AI system: its function, its owner, its data, the people it affects, and its governance status.','')+'<div style="page-break-after:always;break-after:page"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:3px solid #111">AI Systems Overview</div>'+vizSystems().replace(/<button[\s\S]*?<\/button>/g,'')+'<div style="margin-top:18px">'+govSysTiles('estate').replace(/ onclick="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')+'</div></div>'+lyRegister('system',sys,'full',0)}, /* 13 Sep 2026 (Paul's ruling): the Deployed / In development readout follows the overview */ /* 13 Sep 2026 (Paul's print pass): the first page after the cover is the Step 1.2 overview */ /* Round 2: the system's inventory layer */
'out-reglandscape':function(){var regs=data.regimes||[];return printDocCover('Compliance Survey','Every regime in scope, as recorded at Step 1.4.','')+lyRegister('regime',regs,'full',0)}, /* Round 2: the regime's scoping layer */
'out-ethicsdoc':function(){var ef=data.ethicalFramework||{};var prs=ef.principles||[];var bd=ef.board||{};
var h=printDocCover('Responsible AI Principles','Your organization\'s Responsible AI principles \u2014 the register in full.',prs.length+' principle'+(prs.length===1?'':'s'));
var doms=[];prs.forEach(function(p){var d=p.domain||'General';if(doms.indexOf(d)<0)doms.push(d)});
h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:22px;font-weight:600;margin:0 0 14px">The Principles at a Glance</div>';
var n=0;doms.forEach(function(d){var list=prs.filter(function(p){return (p.domain||'General')===d});
h+='<div class="doc-sec" style="font-size:15px;font-weight:700;color:#111;margin:16px 0 4px">'+esc(d)+' ('+list.length+')</div>';
list.forEach(function(p){n++;h+='<div style="font-size:13px;line-height:1.6;margin:3px 0 0">'+n+'. '+esc(p.principle||'')+'</div>'})});
h+='</div>';
var k=0;doms.forEach(function(d){var list=prs.filter(function(p){return (p.domain||'General')===d});
h+='<div class="doc-sec" style="font-size:17px;font-weight:700;color:#111;margin:26px 0 6px;padding-bottom:6px;border-bottom:1px solid #111">'+esc(d)+' ('+list.length+')</div>';
list.forEach(function(p){k++;
h+='<div style="padding:12px 0;border-bottom:1px solid #ddd;page-break-inside:avoid">';
h+='<div style="font-size:14px;font-weight:700;color:#111">'+k+'. '+esc(p.principle||'')+'</div>';
h+=_pdRow('Details',p.details);
h+=_pdRow('What would breach the principle',p.breach);
h+='</div>'})});
if((bd.members||[]).length||bd.cadence||bd.escalation||(bd.escalationList||[]).length){
h+='<div class="doc-sec" style="font-size:17px;font-weight:700;color:#111;margin:26px 0 6px;padding-bottom:6px;border-bottom:1px solid #111">Responsible AI Board</div>';
h+=_pdRow('Members',(bd.members||[]).map(function(m){return m.name?m.name+(m.role?' ('+m.role+')':''):m}).join(', '));
h+=_pdRow('Review cadence',bd.cadence);
h+=_pdRow('Escalation',bd.escalation);
if((bd.escalationList||[]).length)h+=_pdRow('Escalation criteria',bd.escalationList.map(function(x,i){return (i+1)+'. '+(x.text||x)}).join('  '));
}
return h},
'out-raci2':function(){return printDocCover('RACI Matrix','AI Governance Responsibilities','')+'<div style="page:raci;break-before:page;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'+_pdStripHeader(renderOutRaci2())+'</div>'+'<style>@page raci{size:landscape}body{max-width:1040px!important}table{font-size:12px}th,td{padding:5px 6px}</style>'}, /* 12 Sep 2026 (Paul's print pass): the cover stays portrait; the matrix alone takes a landscape page, named, and sits centered on it */
'out-compliance':function(){var regs=data.regimes||[];return printDocCover('Compliance Obligations','Every regime with its obligations, their status, and their evidence.','')+lyRegister('regime',regs,'full',null)}, /* Round 2 (12 Sep 2026): the regime record at full depth for every regime */
'out-testing':function(){var sys=(data.systems||[]).filter(function(x){return((x.testingPlan||{}).tests||[]).length||(x.testEvidence||[]).length});return printDocCover('Testing & Evidence','Every system with a testing plan: its tests and the evidence they produced.','')+lyRegister('system',sys,'full',null)}, /* Round 2: the system record at full depth */
'out-govfw':function(){return printDocFromScreen(renderOutGovFW,'Governance Framework','Your complete AI governance framework from Phases 1–4','').replace(/border-left:4px solid [^;"']+;?/g,'')} /* 14 Sep 2026 (Paul's ruling): the boxes' left bars are a screen device; on paper, where the boxes do not print, they distract */
};
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 44 — Replace the function that shows an output page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderOutcomePage`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderOutcomePage(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// === OUTCOME PAGE ROUTER ===
function renderOutcomePage(){
  var id=currentStep;
  var h='<div style="padding-top:110px;max-width:900px;margin:0 auto;padding-left:48px;padding-right:48px;padding-bottom:80px">';
  h+='<button class="btn-ghost pad-chip-sm" style="margin-bottom:24px" onclick="go(\'phase\',\''+(currentPhase?currentPhase.id:1)+'\')">← Back</button>';
  /* Addendum 115 (14 Aug 2026, ruled): the standard report masthead — prints only. */
  var _morg=null;try{_morg=getOrg(currentOrgId)}catch(e){}
  h+='<div class="print-only" style="margin:0 0 18px;padding:0 0 10px;border-bottom:2px solid #222">'
   +'<div style="font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#444">90-Day Responsible AI Governance</div>'
   +'<div style="font-size:13px;color:#222;margin-top:3px">'+((_morg&&_morg.name)?esc(_morg.name)+' \u00b7 ':'')+fmt(Date.now())+'</div>'
   +'</div>';
  if(id==='out-assessprofile')h+=renderOutAssessProfile();
  else if(id==='out-riskreg')h+=renderOutRiskReg();
  else if(id==='out-sysinv')h+=renderOutSysInv();
  else if(id==='out-ethicsdoc')h+=renderOutEthicsDoc();
  else if(id==='out-raci2')h+=renderOutRaci2();
  else if(id==='out-govsystems')h+=renderOutGovSystems();
  else if(id==='out-assessedreg')h+=renderOutAssessedReg();
  else if(id==='out-govfw')h+=renderOutGovFW();
  else if(id==='out-exitplans')h+=renderOutExitPlans();
  else if(id==='out-reglandscape')h+=renderOutRegLandscape();
  else if(id==='out-compliance')h+=renderOutCompliance();
  else if(id==='out-testing')h+=renderOutTesting();
  else if(id==='out-updatedreg')h+=renderOutUpdatedReg();
  else h+='<p style="color:var(--stone)">Output not found.</p>';
  h+='</div>';
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 46.

---

### Step 45 — Replace the example risks. The example data now fills every field the printed documents show.

**Kind:** Replace existing code.

**Where:** Find the constant named `EXAMPLE_RISKS`. It begins with the line below. Delete the whole constant, from that line to the closing `;` that ends it, and put the code in its place.

```js
var EXAMPLE_RISKS=[
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
var EXAMPLE_RISKS=[
{id:'r-ex1',ethDimension:'If the model\u2019s location and size features proxy for protected characteristics, identifiable customer segments pay systematically more \u2014 the fairness principle breached at the pricing core, and the register\u2019s audit commitment is the test that would prove it.',ethHow:'If quote levels track proxies for protected characteristics, the fairness commitment is breached in the direct sense \u2014 segments receive systematically different prices.',ethNotes:{'pr-ex1':'The breach test is the audit itself: statistically significant divergence tracking a protected or proxy characteristic.'},systemId:'sys-1',name:'Discriminatory Pricing',description:'The quoting engine may produce systematically different prices based on location or company size in ways that correlate with protected characteristics.',category:'P',source:'internal',litL:4,litI:5,litT:4,loggedBy:'Harriet Rivers',loggedAt:exDaysAgo(58),ethicalFlag:true,ethicalDesc:'Potential unfair treatment of customer segments',domain:'Ethical & societal',domainNeeds:0,needs:{expertise:['Statistics or ML fairness expertise','Pricing process knowledge'],effort:'week-plus',special:'External bias auditor likely required'},selection:{decision:'advance',owner:'Harriet Rivers',assessors:[{name:'Tamsin Doyle'},{name:'Freya Lindqvist',covers:'pricing data'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},ethStatus:'confirmed',ethPrinciples:['pr-ex1'],ethTest:{by:'Harriet Rivers',at:EX_NOW-24*86400000},assess:{desc:'Pricing divergence could arise from the model learning location and company-size patterns that proxy for protected characteristics. It would show as systematically higher quotes for identifiable segments, visible only in aggregate.',context:'Roughly 200 quotes a month ride the engine. Pricing is Aurora\'s main competitive lever and the Northwind addendum grants audit rights over it.',rootCauses:[{text:'Training data reflects a decade of manual pricing habits',level:'Systemic'},{text:'Location features enter the model directly',level:'Direct'}],controls:[{text:'Quarterly manual spot check of 30 quotes',eff:'Partial'},{text:'Sales can override any quote before it ships',eff:'Partial'}],capGaps:'Nobody in-house can run a statistical fairness test \u2014 the audit is contracted out.',triggers:[{indicator:'Complaint alleging unfair pricing',threshold:'Any'},{indicator:'Spot-check divergence by segment',threshold:'>5% sustained'}],trigDetail:'A public complaint would move this from latent to live in a day.',velOnset:'moderate',velWindow:'weeks',velDetail:'Bias accumulates unseen in the aggregate. Exposure arrives fast once someone looks.',depsInt:[{text:'Historical quote database'}],depsExt:[{text:'Independent bias auditor (contracted)'}],likelihoodBasis:'Industry cases of pricing models learning proxy discrimination are well documented. Our training data was never screened for it.',impOps:'Re-quoting affected segments and rerunning the audit',impFin:'Refunds or settlements on affected quotes; audit and remediation cost',impStrat:'The Northwind audit right means a finding reaches our largest account directly',stakeholders:[{name:'Small-business customers',tag:'External',note:'The segment most likely to be affected'},{name:'Sales team',tag:'Internal',note:'Owns the override and carries the customer conversation'}],quant:[{measure:'Quotes at risk per quarter',estimate:'~600',confidence:'High'}],repCultural:'A discrimination finding would read as a values failure, not a technical one \u2014 inside the company as much as outside.',cascades:[{text:'Audit finding triggers the Northwind disclosure clause, which opens the account to renegotiation',tag:'External'}],ethHow:'',ethNotes:{},na:{}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Harriet Rivers',litL:4,litI:4,litT:4}],assessRec:{litL:4,litI:5,litT:4,classification:'manage',plan:'Commission the independent bias audit, then remediate on its findings.',rationale:'',by:'Harriet Rivers',at:EX_NOW-16*86400000},classification:'manage',status:'assessed',mgmtPlan:{plans:[{name:'Bias audit and remediation',type:'prevention',actions:[{action:'Select and contract the independent bias auditor',owner:'Harriet Rivers',timeframe:'2 weeks',recur:false,done:true,doneAt:EX_NOW-3*86400000,doneBy:'Harriet Rivers'},{action:'Deliver anonymized quote extract to the auditor',owner:'Freya Lindqvist',timeframe:'1 week',recur:false,done:false},{action:'Add segment-divergence check to the quarterly spot check',owner:'Shalini Mehta',timeframe:'Next quarter',recur:false,done:false}]}],emergencies:[{name:'Discrimination complaint or audit finding',triggers:'A credible discrimination complaint, or an audit finding of significant divergence',firstMoves:'Route all quoting to the manual pricing desk; convene Harriet Rivers and counsel same day',lead:'Harriet Rivers',standDown:'Audit rerun clean after remediation and the affected quotes made good'}],notes:[{at:EX_NOW-1*86400000,by:'Harriet Rivers',text:'Auditor contracted \u2014 Fairlight Analytics, kickoff Monday.'}],by:'Harriet Rivers',at:EX_NOW-2*86400000}},
{id:'r-mg2',systemId:'sys-2',name:'Tinted-Glass Defect Miss Rate',description:'The vision QC system detects defects on clear glass reliably but misses a materially higher share on tinted and specialty panels, where training data was thin.',category:'P',source:'internal',litL:4,litI:4,litT:3,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(58),domain:'Technical/model',domainNeeds:0,needs:{expertise:['ML engineering','QC process knowledge'],effort:'few-days',special:''},selection:{decision:'advance',owner:'Vincent Lau',assessors:[{name:'Sinead Corrigan',covers:'model evaluation'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},assess:{desc:'Recall on tinted and specialty glass runs well below the clear-glass baseline. A missed critical defect that reaches a customer is the concrete failure.',context:'Specialty glass is the highest-margin line and the segment where a defect does the most reputational damage.',rootCauses:[{text:'Training set is dominated by clear-glass images',level:'Direct'},{text:'Specialty runs are too infrequent to accumulate data quickly',level:'Contributing'}],controls:[{text:'Manual inspection retained on all specialty runs',eff:'Effective'},{text:'Per-glass-type recall tracked weekly',eff:'Partial'}],capGaps:'Retraining requires labeled specialty images we do not yet have in volume.',triggers:[{indicator:'Tinted-glass recall',threshold:'<90%'},{indicator:'Customer-reported defect on a specialty order',threshold:'Any'}],trigDetail:'',velOnset:'gradual',velWindow:'weeks',velDetail:'The gap is stable, not degrading \u2014 the exposure is per-shipment.',depsInt:[{text:'Manual inspection staffing on specialty shifts'}],depsExt:[{text:'Tint supplier\u2019s pigment consistency \u2014 the source of the optical variance'}],likelihoodBasis:'The weekly recall numbers already show the gap \u2014 this is a measured condition, not a hypothesis.',impOps:'Specialty runs revert to full manual inspection',impFin:'Warranty replacement on any missed defect that ships',impStrat:'Undermines the case for extending the vision system to the second line',stakeholders:[{name:'QC team',tag:'Internal',note:'Carries the manual backstop workload'}],quant:[{measure:'Recall gap, tinted vs clear',estimate:'~12 points',confidence:'High'}],repCultural:'Escaped tinted-glass defects reach installers first \u2014 the trade reputation that took a decade to build erodes job by job.',cascades:[{text:'Escapes on specialty runs push buyers toward the clear-glass-only order pattern',tag:'External'},{text:'Manual re-inspection load on specialty runs feeds the deskilling risk\u2019s rotation problem',tag:'Internal'}],ethHow:'',ethNotes:{},na:{rep:{by:'Vincent Lau',at:EX_NOW-16*86400000},casc:{by:'Vincent Lau',at:EX_NOW-16*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Vincent Lau',litL:5,litI:4,litT:3}],assessRec:{litL:4,litI:4,litT:3,classification:'manage',plan:'Retrain with a tinted and specialty sample program; manual inspection holds the line meanwhile.',rationale:'',by:'Vincent Lau',at:EX_NOW-16*86400000},classification:'manage',status:'assessed',mgmtPlan:{plans:[{name:'Close the tinted-glass recall gap',type:'prevention',actions:[{action:'Run the tinted and specialty sample collection program',owner:'Vincent Lau',timeframe:'6 weeks',recur:false,done:false},{action:'Vendor retrain and re-validate per glass type',owner:'Sinead Corrigan',timeframe:'After collection',recur:false,done:false},{action:'Hold manual inspection on specialty runs until recall clears 95%',owner:'Vincent Lau',timeframe:'Standing',recur:true,doneAt:EX_NOW-2*86400000}]}],emergencies:[{name:'Missed defect reaches a customer',triggers:'A missed critical defect reaching a customer',firstMoves:'Quarantine the last 48 hours of output; switch the line to full manual inspection',lead:'Vincent Lau',standDown:'Recall back above threshold for two consecutive weeks and the escaped defect traced'}],notes:[],by:'Vincent Lau',at:EX_NOW-2*86400000}},
{id:'r-mg3',systemId:'sys-3',name:'Confidential Data Leakage via Generative AI',description:'Employees pasting proprietary glass formulations, customer data, or financial information into public AI tools without understanding retention and training-use terms.',category:'T',source:'internal',litL:4,litI:4,litT:3,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(58),domain:'Data',domainNeeds:0,needs:{expertise:['Data protection knowledge','IT controls'],effort:'few-days',special:''},selection:{decision:'advance',owner:'Sinead Corrigan',assessors:[{name:'Duncan Fairley'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},assess:{desc:'A formulation or customer dataset pasted into a public tool is out of Aurora\'s control the moment it is submitted. The loss is silent \u2014 nothing breaks, and discovery comes later if at all.',context:'The GenAI use policy now names approved tools and forbidden content. Adoption of the policy is uneven across teams.',rootCauses:[{text:'No technical barrier between staff and public AI tools',level:'Direct'},{text:'Formulations live in ordinary documents that are easy to copy',level:'Contributing'}],controls:[{text:'GenAI use policy, acknowledged by all staff',eff:'Partial'},{text:'DLP pilot flagging formulation keywords in browser uploads',eff:'Partial'}],capGaps:'DLP coverage is browser-only \u2014 desktop apps are not yet covered.',triggers:[{indicator:'DLP flag on a forbidden-content pattern',threshold:'Any'},{indicator:'Policy acknowledgment coverage',threshold:'<100% of staff'}],trigDetail:'',velOnset:'instant',velWindow:'hours',velDetail:'The paste is the event \u2014 there is no response window on the loss itself, only on containment.',depsInt:[{text:'Document handling habits across every team'}],depsExt:[{text:'Tool vendors\' retention and training-use terms'}],likelihoodBasis:'The 1.1 battery found informal use in every department before the policy existed. Habits lag policies.',impOps:'A confirmed leak triggers customer notification, credential rotation, and a tool freeze that stalls every team using generative AI.',impFin:'Loss of trade-secret protection on a disclosed formulation',impStrat:'Formulations are the moat \u2014 disclosure hands a competitor a decade of process knowledge',stakeholders:[{name:'All staff',tag:'Internal',note:'Every employee is a potential channel'}],quant:[{measure:'Staff with generative-AI access',estimate:'All 35',confidence:'High'},{measure:'Formulation records exposed if pasted',estimate:'Any single paste can carry a full spec',confidence:'Medium'}],repCultural:'A leak traced to carelessness would corrode the trust the policy work has built.',cascades:[{text:'A leaked formulation surfaces in a competitor product, forcing legal action with thin evidence',tag:'External'}],ethHow:'',ethNotes:{},na:{quant:{by:'Sinead Corrigan',at:EX_NOW-16*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Shalini Mehta',litL:4,litI:4,litT:3}],assessRec:{litL:4,litI:4,litT:3,classification:'manage',plan:'Close the DLP gap and drive policy acknowledgment to full coverage.',rationale:'',by:'Sinead Corrigan',at:EX_NOW-16*86400000},classification:'manage',status:'assessed',mgmtPlan:{plans:[{name:'Close the leakage channels',type:'prevention',actions:[{action:'Extend DLP coverage to desktop applications',owner:'Sinead Corrigan',timeframe:'4 weeks',recur:false,done:false},{action:'Bring policy acknowledgment to 100% \u2014 chase the last holdouts',owner:'Tom Whitfield',timeframe:'2 weeks',recur:false,done:true,doneAt:EX_NOW-3*86400000,doneBy:'Tom Whitfield'},{action:'Quarterly refresher with real redacted examples',owner:'Sinead Corrigan',timeframe:'Quarterly',recur:true,doneAt:0}]}],emergencies:[{name:'Confirmed paste into a public tool',triggers:'Confirmed paste of a formulation or customer dataset into a public tool',firstMoves:'Identify what was disclosed and when; vendor deletion request the same day; counsel briefed',lead:'Sinead Corrigan',standDown:'Disclosure scoped, deletion confirmed where possible, and the affected customer or process owner informed'},{name:'Tool vendor breach or terms change',triggers:'A vendor of an approved tool discloses a breach, or changes retention or training-use terms on data already submitted',firstMoves:'Suspend the affected tool from the approved list; inventory what each team submitted to it; counsel briefed the same day',lead:'Sinead Corrigan',standDown:'Exposure scoped, the tool cleared or removed for good, and the policy updated with what changed'}],notes:[{at:EX_NOW-8*86400000,by:'Tom Whitfield',text:'Acknowledgment at 100% as of this week.'}],by:'Sinead Corrigan',at:EX_NOW-2*86400000}},
{id:'r-mg4',systemId:'sys-4',name:'Supplier Forecast Failure Disrupts Line Scheduling',description:'The key supplier\\\'s AI demand forecasting drives our delivery schedule. A bad model update or outage on their side cascades into our production planning within days.',category:'O',source:'external',litL:3,litI:4,litT:3,loggedBy:'Duncan Fairley',loggedAt:exDaysAgo(58),domain:'Third-party / vendor',domainNeeds:0,needs:{expertise:['Vendor contract knowledge','Production planning'],effort:'half-day',special:''},selection:{decision:'advance',owner:'Duncan Fairley',assessors:[{name:'Vincent Lau'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},assess:{desc:'We consume the supplier\'s forecast as fact. If it degrades, our schedule degrades with it, and we would learn why only after the fact.',context:'Single-source supplier for float glass; the relationship predates the AI forecasting.',rootCauses:[{text:'Delivery scheduling consumes the forecast with no plausibility check',level:'Direct'},{text:'No contractual notice obligation on supplier model changes',level:'Systemic'}],controls:[{text:'Weekly delivery-variance review',eff:'Partial'},{text:'Two-week buffer stock on standard glass',eff:'Effective'}],capGaps:'No independent demand signal to sanity-check the forecast against.',triggers:[{indicator:'Delivery variance vs forecast',threshold:'>10% two weeks running'}],trigDetail:'',velOnset:'rapid',velWindow:'days',velDetail:'Buffer stock buys roughly two weeks on standard lines, far less on specialty.',depsInt:[{text:'Production schedule'}],depsExt:[{text:'Supplier\'s forecasting model and its change practices'}],likelihoodBasis:'The supplier confirmed a model swap last quarter with no notice \u2014 the mechanism has already fired once, harmlessly.',impOps:'Line rescheduling and expedited orders',impFin:'Expedite premiums and idle line time',impStrat:'Chronic schedule slips undermine the delivery-reliability positioning that justifies premium pricing.',stakeholders:[{name:'Production scheduling',tag:'Internal',note:'First to re-plan on a forecast miss'},{name:'Installers',tag:'External',note:'Their crews idle when delivery slips'}],quant:[{measure:'Orders re-scheduled per forecast miss',estimate:'15\u201330',confidence:'Medium'},{measure:'Expedite premium per incident',estimate:'$8\u201315k',confidence:'Medium'}],repCultural:'Missed installer windows burn the trade relationships sales spent years building.',cascades:[{text:'Schedule slip on the Northwind account triggers its delivery SLA',tag:'External'}],ethHow:'',ethNotes:{},na:{stak:{by:'Duncan Fairley',at:EX_NOW-16*86400000},quant:{by:'Duncan Fairley',at:EX_NOW-16*86400000},rep:{by:'Duncan Fairley',at:EX_NOW-16*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Duncan Fairley',litL:3,litI:4,litT:3}],assessRec:{litL:3,litI:4,litT:3,classification:'manage',plan:'Stand ready: variance watch, buffer stock, and a rehearsed manual scheduling fallback.',rationale:'',by:'Duncan Fairley',at:EX_NOW-16*86400000},classification:'manage',status:'assessed',mgmtPlan:{plans:[{name:'Manual scheduling fallback',type:'response',actions:[{action:'Document and rehearse the manual scheduling fallback',owner:'Vincent Lau',timeframe:'3 weeks',recur:false,done:true,doneAt:EX_NOW-3*86400000,doneBy:'Vincent Lau'}]},{name:'Contract notice terms',type:'prevention',actions:[{action:'Negotiate model-change notice into the contract renewal',owner:'Duncan Fairley',timeframe:'At renewal',recur:true,doneAt:0}]}],emergencies:[{name:'Forecast-driven delivery misses',triggers:'Forecast-driven deliveries miss two consecutive weeks by more than 10%',firstMoves:'Switch scheduling to the manual fallback; call the supplier account manager; expedite the Northwind line first',lead:'Duncan Fairley',standDown:'Deliveries back inside variance for two weeks and the supplier\'s explanation on record'}],notes:[],by:'Duncan Fairley',at:EX_NOW-2*86400000}},
{id:'r-mg5',systemId:null,name:'Competitor Instant Quoting Erodes the Pipeline',description:'A regional competitor now returns AI-generated quotes in minutes; our cycle runs days. The risk attaches to no system we operate \u2014 it is the market moving under us.',category:'S',source:'external',litL:3,litI:4,litT:2,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(58),domain:'Market & commercial',domainNeeds:0,needs:{expertise:['Competitive intelligence','Sales process knowledge'],effort:'half-day',special:''},selection:{decision:'advance',owner:'Shalini Mehta',assessors:[{name:'Tamsin Doyle'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},assess:{desc:'Quote speed is becoming a selection criterion. Losses concentrate in smaller, time-sensitive jobs where minutes-versus-days decides who wins.',context:'Enterprise-level risk with no system linkage \u2014 the exposure is commercial, not operational.',rootCauses:[{text:'Our quoting flow was built for accuracy, not speed',level:'Systemic'}],controls:[{text:'Win/loss tracking with a reason code for speed',eff:'Partial'}],capGaps:'No same-day quoting capability for standard configurations.',triggers:[{indicator:'Losses coded to quote speed',threshold:'>15% of losses in a quarter'}],trigDetail:'',velOnset:'gradual',velWindow:'months',velDetail:'',depsInt:[{text:'Quote-engine coverage of complex multi-pane configurations'}],depsExt:[{text:'Competitor release cadence on their quoting product'}],likelihoodBasis:'Two named losses this quarter carried the speed reason code.',impOps:'Sales works longer cycles against instant competitor numbers; discount authority creeps upward to compensate.',impFin:'Pipeline erosion in the small-job segment',impStrat:'Cedes the fast-turnaround segment and invites the competitor upmarket',stakeholders:[{name:'Sales team',tag:'Internal',note:'Fights the speed gap deal by deal'},{name:'Price-sensitive prospects',tag:'External',note:'Anchor on the first credible number'}],quant:[{measure:'Pipeline lost to faster quotes',estimate:'~5% of opportunities',confidence:'Low'},{measure:'Competitor quote turnaround',estimate:'Minutes vs our hours on complex jobs',confidence:'Medium'}],repCultural:'Losing on speed after announcing an AI quoting program reads internally as the program failing.',cascades:[{text:'Discount creep to offset the speed gap erodes the margin the engine was built to protect',tag:'Internal'},{text:'Pressure to loosen the human-review gate on complex quotes \u2014 straight into the oversight principle',tag:'Internal'}],ethHow:'',ethNotes:{},na:{vel:{by:'Shalini Mehta',at:EX_NOW-16*86400000},deps:{by:'Shalini Mehta',at:EX_NOW-16*86400000},stak:{by:'Shalini Mehta',at:EX_NOW-16*86400000},quant:{by:'Shalini Mehta',at:EX_NOW-16*86400000},rep:{by:'Shalini Mehta',at:EX_NOW-16*86400000},casc:{by:'Shalini Mehta',at:EX_NOW-16*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Shalini Mehta',litL:2,litI:3,litT:2}],assessRec:{litL:3,litI:4,litT:2,classification:'manage',plan:'Build the same-day quoting capability for standard configurations \u2014 the gap is capability, not process.',rationale:'',by:'Shalini Mehta',at:EX_NOW-16*86400000},classification:'manage',status:'assessed',mgmtPlan:{plans:[{name:'Answer the speed gap',type:'response',actions:[{action:'Scope a same-day quote path for standard configurations on the existing engine',owner:'Shalini Mehta',timeframe:'This quarter',recur:false,done:false},{action:'Add the speed reason code to every loss review',owner:'Shalini Mehta',timeframe:'Done',recur:false,done:true,doneAt:EX_NOW-3*86400000,doneBy:'Shalini Mehta'}]}],emergencies:{na:true},notes:[],by:'Shalini Mehta',at:EX_NOW-2*86400000}},
{id:'r-mg6',systemId:'sys-1',name:'Quote Engine Drifts on Stale Cost Inputs',description:'Material cost and labor rate inputs update on a manual cadence. When they lag reality, the engine quotes confidently against stale numbers.',category:'T',source:'internal',litL:3,litI:4,litT:2,loggedBy:'Freya Lindqvist',loggedAt:exDaysAgo(58),domain:'Data',domainNeeds:0,needs:{expertise:['Finance data ownership'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Freya Lindqvist',assessors:[{name:'Harriet Rivers'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},assess:{desc:'The engine has no notion of input freshness. A missed monthly cost update flows straight into every quote until someone notices margin drift.',context:'Cost inputs are maintained by finance on a monthly close cadence.',rootCauses:[{text:'No freshness check on cost inputs at quote time',level:'Direct'}],controls:[{text:'Monthly cost update in the finance close checklist',eff:'Partial'}],capGaps:'No freshness SLA on cost inputs and no automated staleness alarm \u2014 drift is caught by reconciliation, after the fact.',triggers:[{indicator:'Days since last cost-input update',threshold:'>35'},{indicator:'Quoted vs realized margin',threshold:'>2 points divergence'}],trigDetail:'',velOnset:'gradual',velWindow:'weeks',velDetail:'',depsInt:[{text:'Finance close calendar'}],depsExt:[{text:'Material price indices'}],likelihoodBasis:'The update was missed once in the last year during close-week absence \u2014 caught in three weeks by margin review.',impOps:'Stale-cost quotes route wrong jobs to the shop floor \u2014 under-margined work crowds out better orders.',impFin:'Mispriced quotes for the drift window \u2014 the earlier miss cost roughly a point of margin for a month',impStrat:'Slow drift is the quiet version of the mispricing emergency \u2014 the same failure spread thin enough to miss.',stakeholders:[{name:'Finance',tag:'Internal',note:'Catches drift at reconciliation \u2014 too late'},{name:'Data engineering',tag:'Internal',note:'Owns the feed freshness'}],quant:[{measure:'Margin at risk per stale month',estimate:'~1 point',confidence:'Medium'}],repCultural:'Sales trust in the engine erodes with every quote finance later flags.',cascades:[{text:'Shares its failure surface with the escalated mispricing event \u2014 the board sees them together',tag:'Internal'}],ethHow:'',ethNotes:{},na:{stak:{by:'Freya Lindqvist',at:EX_NOW-16*86400000},rep:{by:'Freya Lindqvist',at:EX_NOW-16*86400000},casc:{by:'Freya Lindqvist',at:EX_NOW-16*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Freya Lindqvist',litL:3,litI:3,litT:2}],assessRec:{litL:3,litI:4,litT:2,classification:'manage',plan:'Wire a freshness check into the quote path and alarm the update lapse instead of discovering it in margin review.',rationale:'',by:'Freya Lindqvist',at:EX_NOW-16*86400000},classification:'manage',status:'assessed',mgmtPlan:{plans:[{name:'Freshness guardrails',type:'prevention',actions:[{action:'Add an input-freshness check that flags quotes on stale costs',owner:'Sinead Corrigan',timeframe:'3 weeks',recur:false,done:false},{action:'Move the cost update from checklist item to assigned task with a backup owner',owner:'Freya Lindqvist',timeframe:'Done',recur:false,done:true,doneAt:EX_NOW-3*86400000,doneBy:'Freya Lindqvist'}]}],emergencies:{na:true},notes:[],by:'Freya Lindqvist',at:EX_NOW-2*86400000}},
{id:'r-qcinc',systemId:'sys-2',name:'Vision QC Outage Stops the Inspection Line',description:'A failed update or hardware fault takes the vision system down and inspection throughput drops to manual capacity within the shift.',category:'O',source:'internal',litL:3,litI:4,litT:4,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(58),domain:'Operational/process',domainNeeds:0,needs:{expertise:['Line operations'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Vincent Lau',assessors:[{name:'Sinead Corrigan'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},assess:{desc:'The line runs at vision-system speed. When the system is down, inspection is the bottleneck and output backs up within hours.',context:'Classified Monitor at assessment \u2014 an outage was judged watchable. The firmware incident since then proved the response window shorter than assessed.',rootCauses:[{text:'Single vision rig with no warm spare',level:'Direct'},{text:'Vendor updates apply directly to production',level:'Contributing'}],controls:[{text:'Manual inspection can absorb roughly 40% of line speed',eff:'Partial'}],capGaps:'No staging environment for vendor updates.',triggers:[{indicator:'Classifier heartbeat',threshold:'Down > 15 minutes'}],trigDetail:'',velOnset:'instant',velWindow:'hours',velDetail:'Backlog forms within the shift \u2014 the response window is the gap between detection and the manual switchover.',depsInt:[{text:'QC staffing for the manual fallback'}],depsExt:[{text:'Vision vendor\'s update process'}],likelihoodBasis:'It happened: the vendor firmware update on the camera array crashed the classifier for most of a shift.',impOps:'Inspection throughput drops to manual capacity; shipping slips a day per outage day',impFin:'Overtime and expedite costs per incident',impStrat:'Outage frequency drives the make-or-buy question on the whole vision program.',stakeholders:[{name:'Production',tag:'Internal',note:'Eats the stopped line'},{name:'QC team',tag:'Internal',note:'Carries the manual fallback \u2014 see the deskilling risk'},{name:'Commercial buyers',tag:'External',note:'Delivery slips on long outages'}],quant:[{measure:'Line cost per outage hour',estimate:'~$4k',confidence:'High'},{measure:'Outages last quarter',estimate:'2, both under 3h',confidence:'High'}],repCultural:'Line stops are visible to everyone on the floor \u2014 each one recruits skeptics of the automation program.',cascades:[{text:'Manual fallback quality depends on the deskilling risk\u2019s trajectory \u2014 the two compound',tag:'Internal'}],ethHow:'',ethNotes:{},na:{stak:{by:'Vincent Lau',at:EX_NOW-3*86400000},quant:{by:'Vincent Lau',at:EX_NOW-3*86400000},rep:{by:'Vincent Lau',at:EX_NOW-3*86400000},casc:{by:'Vincent Lau',at:EX_NOW-3*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Vincent Lau',litL:3,litI:3,litT:3},{kind:'assessment',pinnedAt:EX_NOW-16*86400000,pinnedBy:'Vincent Lau',litL:3,litI:4,litT:4,classification:'monitor',plan:'Watch the heartbeat; manual fallback absorbs short outages.'},{kind:'monitor-plan',pinnedAt:EX_NOW-3*86400000,pinnedBy:'Vincent Lau',indicators:[{indicator:'Classifier heartbeat',threshold:'Down > 15 min',source:'Line dashboard'}],monitor:'Vincent Lau',frequency:'review'},{kind:'de-escalation',pinnedAt:EX_NOW-3*86400000,pinnedBy:'Vincent Lau',outcome:'Firmware rolled back, classifier stable through two full shifts, backlog cleared',what:'Vendor firmware update crashed the classifier mid-shift',lead:'Vincent Lau',plan:null}],incidentLog:[{what:'Classifier down after vendor camera-firmware update; line switched to manual inspection',did:'Manual inspection stood up; vendor support engaged',by:'Vincent Lau',at:EX_NOW-4*86400000},{what:'Vendor identified the firmware regression',did:'Rollback applied to the camera array',by:'Sinead Corrigan',at:EX_NOW-4*86400000+21600000},{what:'Classifier stable through the overnight shift; backlog cleared by morning',did:'Manual crew stood down',by:'Vincent Lau',at:EX_NOW-3*86400000}],classification:'manage',status:'assessed',assessRec:{litL:3,litI:4,litT:4,classification:'manage',plan:'Post-incident review output: treat outages as managed, not watched.',rationale:'',by:'Vincent Lau',at:EX_NOW-2*86400000},mgmtPlan:{plans:[{name:'Outage response and spare capacity',type:'response',actions:[{action:'Require vendor updates to stage on the spare rig before production',owner:'Sinead Corrigan',timeframe:'Next update cycle',recur:true,doneAt:0},{action:'Procure the warm-spare vision rig',owner:'Vincent Lau',timeframe:'8 weeks',recur:false,done:false},{action:'Write the manual-switchover runbook from the incident log',owner:'Vincent Lau',timeframe:'Done',recur:false,done:true,doneAt:EX_NOW-3*86400000,doneBy:'Vincent Lau'}]}],emergencies:[{name:'Classifier down beyond manual capacity',triggers:'Classifier down and manual fallback cannot hold line speed',firstMoves:'Switch to the manual runbook; vendor support ticket at severity one; slow the line to manual capacity',lead:'Vincent Lau',standDown:'Classifier stable through two full shifts and the backlog cleared'}],notes:[{at:EX_NOW-2*86400000,by:'Vincent Lau',text:'Plan rewritten from the incident review \u2014 the log is the source.'}],by:'Vincent Lau',at:EX_NOW-2*86400000}},
{id:'r-as2',ethDimension:'An employment decision is shaped before any human sees it: if the ranking tracks age proxies, older applicants are filtered out by a system nobody at Aurora chose or audited \u2014 fairness and oversight breached in the same motion.',/* the unlanded manage card by design \u2014 the landing form and warning triangle demo state (M-1/M-2); the batch-3 audit misread this as a gap */ethHow:'Ranking on age proxies breaches fairness directly, and pre-human screening breaches the oversight principle \u2014 an employment decision is shaped before any qualified human reviews it.',ethNotes:{'pr-ex1':'Divergence between shortlist and pool age profiles is the operable breach test.','pr-ex2':'The module acts before the human review the principle requires.'},systemId:'sys-6',name:'Age-Proxy Patterns in R\u00e9sum\u00e9 Ranking',description:'The HRIS screening module may down-rank applicants on features that proxy for age \u2014 graduation years, career length, older technology names on long r\u00e9sum\u00e9s.',category:'P',source:'internal',litL:4,litI:4,litT:2,loggedBy:'Tom Whitfield',loggedAt:exDaysAgo(20),ethicalFlag:true,ethicalDesc:'Potential discriminatory screening of applicants',domain:'Ethical & societal',domainNeeds:0,needs:{expertise:['Employment law','Vendor model documentation'],effort:'few-days',special:''},selection:{decision:'advance',owner:'Tom Whitfield',assessors:[{name:'Harriet Rivers'},{name:'Sinead Corrigan',covers:'vendor docs'}],by:'Harriet Rivers',at:EX_NOW-12*86400000},ethStatus:'confirmed',ethPrinciples:['pr-ex1','pr-ex2'],ethTest:{by:'Harriet Rivers',at:EX_NOW-10*86400000},assess:{desc:'The vendor module ranks applicants before any human sees them. If its features proxy for age, the discrimination happens upstream of every human safeguard we have.',context:'Logged from the vendor-dependency walk. The module shipped enabled by default inside the HRIS \u2014 nobody at Aurora chose it.',rootCauses:[{text:'Vendor model is a black box \u2014 features and training data undocumented',level:'Direct'},{text:'Module was enabled by default, so it never passed a deployment gate',level:'Systemic'}],controls:[{text:'HR reviews the full applicant list, not only the ranked shortlist',eff:'Partial'}],capGaps:'No access to the vendor\'s feature documentation yet.',triggers:[{indicator:'Age distribution of shortlisted vs applicant pool',threshold:'Material divergence'}],trigDetail:'',velOnset:'gradual',velWindow:'months',velDetail:'',depsInt:[{text:'The shortlist-vs-pool distribution monitoring the mitigation plan builds'}],depsExt:[{text:'HRIS vendor\'s documentation and audit cooperation'}],likelihoodBasis:'Screening tools with exactly this failure are the best-documented AI discrimination cases on record.',impOps:'HR reruns affected requisitions with manual screening while the module is constrained \u2014 slower shortlists on every open role.',impFin:'Employment-claim exposure',impStrat:'A discrimination finding would freeze AI use in HR entirely and taint the broader program\u2019s license to operate.',stakeholders:[{name:'Applicants',tag:'External',note:'The affected group has no visibility and no recourse today'}],quant:[{measure:'Requisitions screened by the module yearly',estimate:'~40',confidence:'High'},{measure:'Applicants affected if the pattern held',estimate:'~450/month screened',confidence:'High'}],repCultural:'Hiring discrimination would contradict the principle register in the most public way available.',cascades:[{text:'Shares its evidence base with the HRIS model-swap monitor \u2014 a silent swap voids this card\u2019s audit too',tag:'Internal'}],ethHow:'',ethNotes:{},na:{vel:{by:'Tom Whitfield',at:EX_NOW-1*86400000},quant:{by:'Tom Whitfield',at:EX_NOW-1*86400000},casc:{by:'Tom Whitfield',at:EX_NOW-1*86400000}}},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-20*86400000,pinnedBy:'Tom Whitfield',litL:4,litI:4,litT:2}],assessRec:{litL:4,litI:4,litT:2,classification:'manage',plan:'Demand vendor documentation, run the shortlist-vs-pool test on our own data, and disable the module if the vendor cannot support the audit.',rationale:'',by:'Harriet Rivers',at:EX_NOW-1*86400000},classification:'manage',status:'assessed'},
{id:'r-mn1',ttStage:'evidence',testingPlan:{tests:[{id:'tt-wb-mn1-seed',purpose:'monitor',kind:'claim',claim:'The maintenance model still catches seeded wear cases',test:'Monthly blind seeding: three historical wear signatures replayed through the live model; catching all three counts as holding',shape:'recurring',frequency:'monthly',runner:'Vincent Lau'}]},testEvidence:[{testId:'tt-wb-mn1-seed',outcome:'Holds within limits',at:EX_NOW-6*86400000,result:'All three seeded signatures flagged inside the wear window',where:'Maintenance QA drive / seeded-replay',by:'Vincent Lau'}],assess:{desc:'The supplier\u2019s demand-forecasting AI also drives their price book. A silent model change can move our laminate and hardware input costs mid-quarter, with no negotiation window and no notice \u2014 we find out when the invoice lands.',context:'Roughly 40% of input spend runs through this supplier, and our own quote engine assumes cost stability inside a quarter. Contract terms allow price revisions with 30 days\u2019 notice, but algorithmic repricing has arrived faster than the paper.',capGaps:'No independent view of the supplier\u2019s pricing model and no automated comparison of invoiced prices against contracted rates.',likelihoodBasis:'Two unannounced price moves in the last twelve months, both traced informally to their model updates.',velOnset:'rapid',velWindow:'weeks',velDetail:'A repriced book applies to the next order cycle, so exposure lands within two to four weeks of the change.',trigDetail:'Supplier system upgrades, their quarter-end margin pushes, and raw-material volatility all raise the odds of a model change.',impOps:'Purchasing scrambles to re-source or renegotiate mid-quarter; production schedules slip when orders are held for price review.',impFin:'Margin erosion of one to two points in any quarter with an unnotified move, before renegotiation claws anything back.',impStrat:'Sustained input-cost noise undermines the fixed-quote positioning the AI quoting strategy depends on.',repCultural:'Repeated re-quotes to customers after cost jumps read as bait-and-switch, whatever the cause.',rootCauses:[{text:'Supplier pricing and forecasting share one model we cannot see into',level:'Direct'},{text:'Contract notice terms written for human repricing cadence',level:'Contributing'}],controls:[{text:'Invoice-vs-contract rate check, monthly, manual',eff:'Partial'},{text:'Named supplier relationship owner with escalation line',eff:'Partial'}],triggers:[{indicator:'Invoiced unit cost vs contracted rate',threshold:'>3% variance'},{indicator:'Supplier platform release notes mentioning pricing',threshold:'Any'}],stakeholders:[{name:'Purchasing',tag:'Internal',note:'First to absorb the scramble'},{name:'Production planning',tag:'Internal',note:'Schedules slip when orders hold'},{name:'Quoting customers',tag:'External',note:'Bear re-quotes if costs move'}],quant:[{measure:'Input spend exposed',estimate:'~40% of materials budget',confidence:'High'},{measure:'Margin erosion per unnotified move',estimate:'1\u20132 points for the quarter',confidence:'Medium'}],cascades:[{text:'Quote engine prices on stale costs until the book is corrected',tag:'Internal'},{text:'Mid-quarter re-sourcing strains the second supplier\u2019s lead times',tag:'External'}],depsInt:[{text:'Cost-input feed into the quote engine'},{text:'Purchasing\u2019s contract-rate register'}],depsExt:[{text:'Supplier\u2019s pricing platform and release cadence'}]},systemId:'sys-4',name:'Supplier Price-Model Changes Without Notice',description:'The supplier\\\'s AI forecasting also feeds their pricing. A silent model change can move our input costs with no negotiation and no warning.',category:'S',source:'internal',litL:3,litI:3,litT:3,loggedBy:'Duncan Fairley',loggedAt:exDaysAgo(58),domain:'Third-party / vendor',domainNeeds:0,needs:{expertise:['Vendor contract knowledge'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Duncan Fairley',assessors:[{name:'Freya Lindqvist'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Duncan Fairley',litL:2,litI:3,litT:3}],assessRec:{litL:3,litI:3,litT:3,classification:'monitor',plan:'Watch delivered-price variance weekly; the contract renewal is the fix.',rationale:'',by:'Duncan Fairley',at:EX_NOW-16*86400000},classification:'monitor',status:'assessed',monitorPlan:{indicators:[{indicator:'Delivered price vs contract reference',owner:'Duncan Fairley',description:'Each delivery\u2019s invoiced price checked against the contract reference; unexplained movement is the earliest sign the supplier\u2019s pricing model has shifted.',threshold:'>3% unexplained',source:'Procurement price log',checks:[{at:EX_NOW-13*86400000+3600000,by:'Duncan Fairley',note:'Within 1% \u2014 Baseline check.'},{at:EX_NOW-9*86400000,by:'Duncan Fairley',note:'+1.8% on specialty float \u2014 Watching the specialty float number \u2014 not yet at threshold.'}]},{indicator:'Supplier release notes mention pricing model',owner:'Duncan Fairley',description:'The vendor bulletin read for any note that the pricing or forecasting model changed \u2014 the notice the contract does not yet require.',threshold:'Any',source:'Vendor bulletin',checks:[{at:EX_NOW-13*86400000+3600000,by:'Duncan Fairley',note:'Nothing published \u2014 Baseline check.'},{at:EX_NOW-9*86400000,by:'Duncan Fairley',note:'None \u2014 Watching the specialty float number \u2014 not yet at threshold.'}]}],monitor:'Duncan Fairley',frequency:'weekly',by:'Duncan Fairley',at:EX_NOW-13*86400000},em:{triggers:'Unexplained price movement past threshold on two consecutive orders',firstMoves:'Freeze new specialty orders pending a supplier call; brief Tamsin before the call',lead:'Duncan Fairley',standDown:'Movement explained on the record or reversed'}},
{id:'r-mn2',assess:{desc:'Colorado\u2019s AI Act scoping may conclude that automated quoting is a consequential decision. If it lands \u201capplies,\u201d the quoting engine becomes a regulated high-risk system in that market, with documentation, impact-assessment, and appeal obligations.',context:'Colorado is roughly 8% of revenue and the first state where our category is squarely in scope. The Act\u2019s duties attach to deployers as well as developers, so vendor paper alone does not discharge them.',capGaps:'No regulatory-watch owner for state AI law and no mapped inventory of which quoting features would meet the consequential-decision test.',likelihoodBasis:'The scoping docket\u2019s public comments trend toward inclusion of automated pricing for commercial customers; counsel puts it at better than even.',velOnset:'gradual',velWindow:'months',velDetail:'Rulemaking gives a compliance runway measured in months, but the documentation burden starts the day scope is announced.',trigDetail:'A published scoping decision, enforcement guidance naming pricing systems, or a peer company consent order would each accelerate this.',impOps:'Impact assessments, notice text, and appeal handling all land on teams that have never run them.',impFin:'Compliance build-out plus outside counsel; a first-offense penalty band that scales per affected consumer.',impStrat:'If compliance drags, the fallback is pulling automated quoting from Colorado \u2014 conceding the speed advantage in that market.',repCultural:'Being named in early enforcement would brand the quoting program as the cautionary tale.',rootCauses:[{text:'Statutory scope written broadly, resolved by rulemaking we do not control',level:'Direct'},{text:'Quoting shipped before the regulatory perimeter existed',level:'Contributing'}],controls:[{text:'Outside counsel tracking the docket, quarterly memo',eff:'Partial'}],triggers:[{indicator:'Scoping decision published',threshold:'Any'},{indicator:'Peer enforcement action in-category',threshold:'Any'}],stakeholders:[{name:'Colorado commercial customers',tag:'External',note:'Gain notice and appeal rights'},{name:'Legal',tag:'Internal',note:'Owns the compliance build'},{name:'In-state sales',tag:'Internal',note:'Lives with any quoting pullback'}],quant:[{measure:'Revenue in scope',estimate:'~8% of total',confidence:'High'},{measure:'Compliance build if it applies',estimate:'One quarter of legal + engineering time',confidence:'Low'}],cascades:[{text:'Other states copy the Colorado test, multiplying the perimeter',tag:'External'},{text:'Documentation duties pull engineering off the quoting roadmap',tag:'Internal'}],depsInt:[{text:'Quoting decision logs \u2014 the raw material of any impact assessment'}],depsExt:[{text:'Colorado AG rulemaking timetable'},{text:'Vendor\u2019s willingness to share model documentation'}]},systemId:null,name:'Colorado AI Act Scoping Lands \u201cApplies\u201d',description:'The pending scoping investigation may conclude that auto-quoting is a consequential decision for Colorado consumers, bringing the Act\\\'s obligations onto the quoting engine.',category:'S',source:'internal',litL:2,litI:4,litT:2,loggedBy:'Tamsin Doyle',loggedAt:exDaysAgo(58),domain:'Legal & regulatory',domainNeeds:0,needs:{expertise:['Regulatory counsel'],effort:'half-day',special:''},selection:{decision:'advance',owner:'Tamsin Doyle',assessors:[{name:'Harriet Rivers'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Tamsin Doyle',litL:1,litI:4,litT:2}],assessRec:{litL:2,litI:4,litT:2,classification:'monitor',plan:'Watch the rulemaking and our own scoping investigation; nothing to build until the judgment lands.',rationale:'',by:'Tamsin Doyle',at:EX_NOW-16*86400000},classification:'monitor',status:'assessed',monitorPlan:{indicators:[{indicator:'Our scoping investigation concludes',owner:'Tamsin Doyle',description:'The Step 2.4 scoping judgment on this regime lands on the register \u2014 the trigger to reassess whether this risk stays watched.',threshold:'Judgment recorded',source:'Regime register',checks:[{at:EX_NOW-11*86400000,by:'Harriet Rivers',note:'No scoping decision \u2014 Docket quiet this cycle; counsel memo unchanged.'}]},{indicator:'Colorado AG rulemaking activity',owner:'Tamsin Doyle',description:'Counsel\u2019s bulletin watched for published rules that reach quoting practices; publication starts the compliance clock.',threshold:'Rules affecting quoting published',source:'Counsel bulletin'}],monitor:'Tamsin Doyle',frequency:'review',by:'Tamsin Doyle',at:EX_NOW-13*86400000}},
{id:'r-mn3',assess:{desc:'Teams adopt AI tools faster than the approved list updates \u2014 browser extensions, meeting summarizers, code assistants. Each unlisted tool is an unassessed data path and an unowned risk, invisible to the register by definition.',context:'The approved list covers seven tools; the last informal sweep found at least eleven in active use. Policy prohibits unapproved tools but provides no fast lane for approving good ones, which drives use underground.',capGaps:'No network-level discovery of AI SaaS use and no lightweight intake that gets a tool assessed inside a week.',likelihoodBasis:'Every sweep to date has found unlisted tools; the base rate is effectively certain \u2014 the open question is which ones matter.',velOnset:'gradual',velWindow:'months',velDetail:'Adoption creeps team by team; the exposure compounds silently until an incident or an audit surfaces it.',trigDetail:'A viral new tool, a team deadline crunch, or a slow verdict on a pending approval all accelerate shadow adoption.',impOps:'An incident in an unlisted tool has no owner, no runbook, and no logs we control.',impFin:'Duplicate spend on overlapping tools; incident cost without contractual recourse.',impStrat:'The register\u2019s credibility depends on covering what people actually use \u2014 shadow adoption hollows it out.',repCultural:'Punishing discovered use teaches concealment; the culture cost of a crackdown exceeds the tool cost.',rootCauses:[{text:'Approval path slower than adoption pressure',level:'Direct'},{text:'No discovery mechanism, so the list decays silently',level:'Contributing'}],controls:[{text:'Acceptable-use policy naming the approved list',eff:'Partial'},{text:'Quarterly manager attestation of team tool use',eff:'Ineffective'}],triggers:[{indicator:'Unlisted AI domain in egress logs',threshold:'Any new domain'},{indicator:'Pending tool approvals older than two weeks',threshold:'>3'}],stakeholders:[{name:'Adopting teams',tag:'Internal',note:'Acting in good faith under deadline pressure'},{name:'IT security',tag:'Internal',note:'Owns discovery and the intake lane'},{name:'Customers',tag:'External',note:'Their data rides in unassessed tools'}],quant:[{measure:'Unlisted tools in active use',estimate:'4+ at last sweep',confidence:'Medium'},{measure:'Staff touching unapproved tools weekly',estimate:'~30%',confidence:'Low'}],cascades:[{text:'A data-handling incident in a shadow tool triggers the confidentiality risk on the register',tag:'Internal'},{text:'Vendor lock-in forms around tools nobody assessed',tag:'External'}],depsInt:[{text:'Egress logging coverage'},{text:'The intake lane\u2019s turnaround time'}],depsExt:[{text:'The pace of consumer AI tool releases'}]},systemId:'sys-3',name:'Shadow AI Tool Adoption Outside the Approved List',description:'New AI tools spread faster than the approved list updates. Teams adopt what works and the register learns about it later.',category:'O',source:'internal',litL:3,litI:2,litT:2,loggedBy:'Sinead Corrigan',loggedAt:exDaysAgo(58),domain:'Operational/process',domainNeeds:0,needs:{expertise:['IT visibility'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Sinead Corrigan',assessors:[],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Sinead Corrigan',litL:2,litI:2,litT:2}],assessRec:{litL:3,litI:2,litT:2,classification:'monitor',plan:'Watch network telemetry for unapproved tools; fold newcomers into the policy rather than chase them.',rationale:'',by:'Sinead Corrigan',at:EX_NOW-16*86400000},classification:'monitor',status:'assessed',monitorPlan:{indicators:[{indicator:'Unapproved AI domains in network logs',owner:'Sinead Corrigan',description:'IT telemetry scanned for AI-tool domains outside the approved list; a new tool crossing five users means adoption is organizing itself.',threshold:'New tool with >5 users',source:'IT telemetry',checks:[{at:EX_NOW-52*86400000,by:'Vincent Lau',note:'4 unlisted tools \u2014 Two new unlisted domains in egress logs; intake lane still slow. Check-in overdue \u2014 the gap itself is the demo.'}]}],monitor:'Sinead Corrigan',frequency:'review',by:'Sinead Corrigan',at:EX_NOW-13*86400000}},
{id:'r-mn4',assess:{desc:'Once disclosure language ships, some customers will distrust AI-generated quotes on sight \u2014 preferring a person, questioning the number, or taking the disclosure as a reason to renegotiate. The risk is a trust discount on a system that prices accurately.',context:'Disclosure is required by our own Transparency principle and, prospectively, by state law. The customer base skews toward long-relationship commercial buyers who prize the account manager.',capGaps:'No tested disclosure copy, no talk track for account managers, and no measurement of quote acceptance by channel.',likelihoodBasis:'Industry surveys put meaningful AI-pricing distrust in the 20\u201330% band for commercial buyers; our own base is untested.',velOnset:'moderate',velWindow:'weeks',velDetail:'Reaction lands with the first disclosed quote cycle and hardens within a few weeks if the first impression goes badly.',trigDetail:'A press story about AI pricing errors \u2014 ours or anyone\u2019s \u2014 would sharpen the reaction; so would clumsy disclosure copy.',impOps:'Account managers field the questions; escalated quote reviews consume the time the AI was meant to save.',impFin:'A few points of quote-acceptance drop across the disclosed channel while trust settles.',impStrat:'If distrust hardens, the disclosure that makes the program honest also makes it commercially fragile \u2014 the strategy needs the trust story ready.',repCultural:'Handled well, disclosure is a differentiator; handled badly, it reads as a confession.',rootCauses:[{text:'Disclosure arrives before the trust groundwork',level:'Direct'},{text:'No channel measurement to catch a reaction early',level:'Contributing'}],controls:[{text:'Account managers hold discretion to route any quote to human review',eff:'Effective'}],triggers:[{indicator:'Quote acceptance rate, disclosed channel',threshold:'>5% drop vs baseline'},{indicator:'Customer requests for human-only quoting',threshold:'Trend over 2 weeks'}],stakeholders:[{name:'Long-relationship customers',tag:'External',note:'The trust that is actually at stake'},{name:'Account managers',tag:'Internal',note:'Carry the conversation'},{name:'Marketing',tag:'Internal',note:'Owns the disclosure copy'}],quant:[{measure:'Quotes through the disclosed channel',estimate:'~85% of volume',confidence:'High'},{measure:'Acceptance-rate sensitivity',estimate:'2\u20135 points at risk',confidence:'Low'}],cascades:[{text:'A trust dip pressures sales to route around the AI channel, starving it of volume',tag:'Internal'}],depsInt:[{text:'Disclosure copy and the account-manager talk track'}],depsExt:[{text:'Press coverage of AI pricing failures in-category'}]},systemId:'sys-1',name:'Customer Pushback on AI Quoting',description:'Some customers may distrust AI-generated quotes once disclosure language ships, preferring a person on the price.',category:'P',source:'internal',litL:2,litI:3,litT:2,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(58),domain:'Market & commercial',domainNeeds:0,needs:{expertise:['Customer relationships'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Shalini Mehta',assessors:[],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Shalini Mehta',litL:1,litI:3,litT:2}],assessRec:{litL:2,litI:3,litT:2,classification:'monitor',plan:'Watch re-quote requests and advisory-session sentiment; the human re-quote path already exists.',rationale:'',by:'Shalini Mehta',at:EX_NOW-16*86400000},classification:'monitor',status:'assessed',monitorPlan:{indicators:[{indicator:'Human re-quote requests',owner:'Shalini Mehta',description:'Customers asking a person to redo an engine quote, read from the sales log; a rising share signals eroding trust in the automated number.',threshold:'>5% of quotes in a month',source:'Sales log',checks:[{at:EX_NOW-8*86400000,by:'Duncan Fairley',note:'Acceptance \u22121% vs baseline \u2014 Disclosure copy tested with two friendly accounts \u2014 no pushback; acceptance steady.'}]}],monitor:'Shalini Mehta',frequency:'review',by:'Shalini Mehta',at:EX_NOW-13*86400000}},
{id:'r-mn5',assess:{desc:'As the vision system carries routine inspection, the QC team\u2019s hands-on defect-reading skill atrophies. The organization keeps the headcount but loses the capability \u2014 discovered only when the system fails and the humans can no longer catch what it missed.',context:'The vision system now handles the clear-glass line end to end; human inspection persists on specialty runs only. The QC team\u2019s deep readers are within a few years of retirement.',capGaps:'No skill-retention program, no rotation schedule keeping inspectors current on the routine line, and no benchmark of human catch-rate over time.',likelihoodBasis:'Deskilling against automation is one of the best-documented patterns in safety literature; the only question is rate.',velOnset:'gradual',velWindow:'months',velDetail:'Skill decays over quarters, invisibly \u2014 the loss only manifests during a system outage or a novel defect class.',trigDetail:'Retirements in the QC team and any extension of the vision system to specialty runs would both accelerate the decay.',impOps:'During vision-system outages, manual inspection runs slower and misses more \u2014 compounding the outage risk already on the register.',impFin:'Escaped defects during fallback periods; retraining cost rises the longer decay runs.',impStrat:'The fallback story the outage plan depends on stops being true without anyone noticing.',repCultural:'Inspectors read their own deskilling as the company\u2019s message about their future \u2014 this is the workforce-impact principle in slow motion.',rootCauses:[{text:'Routine exposure is the training; automation removed it',level:'Direct'},{text:'No one owns human capability as a maintained asset',level:'Contributing'}],controls:[{text:'Human inspection retained on all specialty runs',eff:'Effective'},{text:'Annual defect-reading refresher, classroom only',eff:'Ineffective'}],triggers:[{indicator:'Human catch-rate on seeded-defect drills',threshold:'<80% of 2025 baseline'},{indicator:'QC deep-reader retirements',threshold:'Any'}],stakeholders:[{name:'QC team',tag:'Internal',note:'Their skill and their standing'},{name:'Production',tag:'Internal',note:'Depends on the fallback during outages'},{name:'Downstream buyers',tag:'External',note:'Receive escaped defects during fallbacks'}],quant:[{measure:'Deep readers on staff',estimate:'3, two near retirement',confidence:'High'},{measure:'Human catch-rate drift',estimate:'Unmeasured \u2014 the gap itself',confidence:'Low'}],cascades:[{text:'Amplifies the vision-outage risk: the fallback degrades as the primary hardens',tag:'Internal'},{text:'Ties into the workforce-impact principle \u2014 a live Responsible AI adjacency',tag:'Internal'}],depsInt:[{text:'Seeded-defect drill program \u2014 the only measurement of the decay'}],depsExt:[{text:'Labor market for experienced glass inspectors'}]},systemId:'sys-2',name:'Inspector Deskilling Against the Vision System',description:'As the vision system carries routine inspection, the QC team\\\'s defect-spotting sharpness erodes \u2014 the manual fallback the outage plan depends on gets weaker every quarter it goes unused.',category:'O',source:'internal',litL:2,litI:3,litT:1,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(58),domain:'Operational/process',domainNeeds:0,needs:{expertise:['QC training'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Vincent Lau',assessors:[{name:'Tom Whitfield'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Vincent Lau',litL:1,litI:3,litT:1}],assessRec:{litL:2,litI:3,litT:1,classification:'monitor',plan:'Watch the monthly blind-sample scores; rotate manual shifts to keep the skill warm.',rationale:'',by:'Vincent Lau',at:EX_NOW-16*86400000},classification:'monitor',status:'assessed',monitorPlan:{indicators:[{indicator:'Blind-sample manual detection score',owner:'Vincent Lau',description:'The monthly drill replays known defects past inspectors without the vision system; the score is the direct read on whether manual skill is holding.',threshold:'<85%',source:'Monthly QC drill',checks:[{at:EX_NOW-2*86400000,by:'Vincent Lau',note:'91% \u2014 Rotation holding.'}]},{indicator:'Manual-shift rotation coverage',owner:'Vincent Lau',description:'The shift roster checked so every inspector keeps regular manual time; long gaps are how the skill erodes before the drill shows it.',threshold:'Any inspector >60 days without a manual shift',source:'Shift roster',checks:[{at:EX_NOW-2*86400000,by:'Vincent Lau',note:'All inspectors current \u2014 Rotation holding.'}]}],monitor:'Vincent Lau',frequency:'biweekly',by:'Vincent Lau',at:EX_NOW-13*86400000}},
{id:'r-er1',ttStage:'design',testingPlan:{tests:[{id:'tt-wb-er1-seed',purpose:'validate',kind:'threat',claim:'The updated model can be made to misprice a segment again',test:'',shape:'once',trigger:'pre-deployment'}]},ethDimension:'The mispricing does not land evenly: segments exposed to the updated model get systematically different prices than the rest of the book \u2014 an accidental fairness breach, at emergency scale.',assess:{desc:'A model update skewed quote pricing low across the residential product family. Every quote that ships is a signed commitment, so the losses are contractual, and they compound silently until reconciliation catches the drift.',context:'The quoting engine prices roughly 85% of volume. The update passed the standard regression suite \u2014 the skew shows only against the cost book, which the suite did not check. A second underpriced batch shipped after the first patch.',capGaps:'No pre-release price-book reconciliation gate and no automated margin-floor alarm on issued quotes at the time of onset.',likelihoodBasis:'Not a likelihood question any longer \u2014 the event is live; the basis for residual likelihood is the patch\u2019s failure to hold.',velOnset:'instant',velWindow:'hours',velDetail:'Every hour of operation issues more signed commitments at the wrong price \u2014 the loss rate is the quote rate.',trigDetail:'Quote volume spikes (seasonal promotions) multiply the hourly exposure while the skew is live.',impOps:'Emergency human review of every outbound quote in the affected family; reconciliation team pulled onto forensic pricing.',impFin:'Direct margin loss on every affected quote honored; estimate below. Clawback is contractually unavailable \u2014 quotes are commitments.',impStrat:'The board-level case for AI quoting rests on pricing discipline; a second miss would freeze the expansion roadmap.',repCultural:'Customers who received corrected re-quotes now read every quote skeptically; internally, sales confidence in the engine is shaken.',rootCauses:[{text:'Regression suite validates behavior, not economics \u2014 no cost-book check',level:'Direct'},{text:'Model update shipped on the standard cadence despite touching pricing weights',level:'Contributing'},{text:'First patch addressed the symptom family, not the weight regression',level:'Contributing'}],controls:[{text:'Emergency: all affected-family quotes held for human price review',eff:'Effective'},{text:'Margin-floor alarm on issued quotes, deployed with the first patch',eff:'Partial'}],triggers:[{indicator:'Issued-quote margin vs cost book, affected family',threshold:'<floor on any quote'},{indicator:'Second reconciliation divergence post-patch',threshold:'Any'}],stakeholders:[{name:'Customers holding underpriced quotes',tag:'External',note:'Their quotes are honored \u2014 the cost is ours'},{name:'Finance',tag:'Internal',note:'Owns reconciliation and the loss estimate'},{name:'Sales',tag:'Internal',note:'Carries the re-quote conversations where quotes had not yet shipped'},{name:'Exposed customer segments',tag:'External',note:'The fairness dimension \u2014 exposure differs by segment'}],quant:[{measure:'Underpriced quotes issued before containment',estimate:'~140 across two batches',confidence:'High'},{measure:'Margin loss on honored quotes',estimate:'$180\u2013240k',confidence:'Medium'},{measure:'Quotes under emergency human review daily',estimate:'~60',confidence:'High'}],cascades:[{text:'Emergency review throughput caps quote volume \u2014 the speed advantage inverts while containment holds',tag:'Internal'},{text:'Reconciliation load delays month-end close',tag:'Internal'},{text:'A confirmed fairness breach path rides the same event \u2014 the Responsible AI screening runs in parallel',tag:'Internal'}],depsInt:[{text:'Cost-book accuracy \u2014 the reconciliation baseline'},{text:'Emergency review staffing holding until stand-down'}],depsExt:[{text:'Vendor\u2019s root-cause analysis of the weight regression'}]},ethicalFlag:true,ethicalDesc:'The mispricing is not uniform \u2014 exposure differs by product family and customer segment.',ethStatus:'confirmed',ethPrinciples:['pr-ex1'],ethTest:{by:'Harriet Rivers',at:exDaysAgo(9)},ethHow:'The skew tracks the updated model\u2019s product mix, so customer segments exposed to it get systematically different prices than the rest of the book \u2014 the fairness commitment breached in the direct sense, at emergency scale.',ethNotes:{'pr-ex1':'Divergence tracks the product mix, so exposure differs by segment \u2014 the audit test fires.'},systemId:'sys-1',name:'Quoting Engine Mispricing at Scale',description:'A model update skews quote pricing low across a whole product family \u2014 every quote that ships is a signed commitment, and the losses compound silently until someone reconciles margin.',category:'P',source:'internal',litL:4,litI:5,litT:5,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(9),domain:'Commercial/pricing',domainNeeds:0,needs:{expertise:['pricing','finance'],effort:'immediate, cross-functional',special:''},selection:{decision:'advance',owner:'Harriet Rivers',assessors:[{name:'Tom Whitfield'}],by:'Harriet Rivers',at:EX_NOW-8*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-9*86400000,pinnedBy:'Shalini Mehta',litL:3,litI:5,litT:4}],assessRec:{litL:4,litI:5,litT:5,classification:'manage',plan:'Contain the mispricing path, reconcile issued quotes, and hold the engine out of the quote flow until audited.',rationale:'',by:'Tom Whitfield',at:EX_NOW-7*86400000},classification:'manage',status:'assessed',escalation:{what:'A second batch of underpriced quotes went out after the first patch \u2014 containment is not holding.',lead:'Harriet Rivers',by:'Duncan Fairley',at:EX_NOW-2*86400000,plan:{triggers:'Any quote landing below the cost floor; any customer disputing a corrected quote.',firstMoves:'Pull the engine from the quote path; revert to the prior pricing model; reconcile every quote issued since the update.',lead:'Harriet Rivers',standDown:'Fourteen clean days of audited quotes after the fix ships.'}}},
{id:'r-mn6',ethDimension:'Hiring decisions could run on an unaudited model while our fairness evidence points at the audited one \u2014 candidates screened in that gap are owed a fairness guarantee nobody can currently give.',assess:{desc:'The HRIS vendor can update the r\u00e9sum\u00e9-screening model behind the same interface, with no version signal we receive. Our fairness audit binds a specific model; a silent swap leaves hiring running on an unaudited system while our evidence points at the old one.',context:'Screening runs inside the vendor\u2019s platform; the contract covers uptime, not model identity. The fairness audit \u2014 the control the register\u2019s bias principle depends on \u2014 assumed a stable model.',capGaps:'No model-version attestation in the contract, no output-distribution monitoring that would catch a behavioral shift from our side.',likelihoodBasis:'The vendor shipped four platform updates last year; at least one release note implied scoring changes.',velOnset:'instant',velWindow:'hours',velDetail:'A swap takes effect on the vendor\u2019s deploy \u2014 every screening decision from that hour runs on the new model.',trigDetail:'Vendor release cycles, their model-vendor changes upstream, and acquisition activity on their side all raise swap odds.',impOps:'HR keeps operating normally \u2014 the operational surface is unchanged, which is exactly the problem.',impFin:'Re-audit cost on every detected swap; exposure to hiring-discrimination claims for the unaudited window.',impStrat:'The audited-AI hiring story is a stated commitment; a silent gap converts it from control to liability.',repCultural:'Candidates screened by an unaudited model in the gap window were owed better \u2014 this is the confirmed breach path.',rootCauses:[{text:'Model identity not contractually pinned',level:'Direct'},{text:'No behavioral monitoring independent of the vendor',level:'Contributing'}],controls:[{text:'Vendor release notes reviewed by HR ops, monthly',eff:'Partial'},{text:'Annual fairness audit of the screening pipeline',eff:'Partial'}],triggers:[{indicator:'Vendor release note touching scoring or ranking',threshold:'Any'},{indicator:'Shortlist demographic distribution vs audited baseline',threshold:'>2\u03c3 shift'}],stakeholders:[{name:'Job candidates',tag:'External',note:'Screened by whatever model is live'},{name:'HR operations',tag:'Internal',note:'Runs the pipeline daily'},{name:'Legal',tag:'Internal',note:'Owns the discrimination exposure'}],quant:[{measure:'Applications screened monthly',estimate:'~450',confidence:'High'},{measure:'Unaudited window per silent swap',estimate:'Up to a full audit cycle',confidence:'Medium'}],cascades:[{text:'A detected swap voids the current audit and re-opens the age-proxy risk\u2019s evidence base',tag:'Internal'},{text:'A discrimination claim in the gap window lands on the transparency story too',tag:'External'}],depsInt:[{text:'Shortlist-vs-pool distribution monitoring \u2014 the planned early-warning control'}],depsExt:[{text:'Vendor release discipline and notice terms'}]},ethicalFlag:true,ethicalDesc:'A silent model swap would invalidate the fairness audit without anyone deciding anything.',ethStatus:'confirmed',ethPrinciples:['pr-ex1','pr-ex2'],ethTest:{by:'Harriet Rivers',at:exDaysAgo(12)},ethHow:'If the vendor swaps the screening model, the audited model and the live model diverge: hiring decisions run on an unaudited system while our fairness evidence points at the old one. Nothing in the interface changes, so the breach is silent.',ethNotes:{'pr-ex1':'The audit binds a specific model version \u2014 a swap severs that binding.','pr-ex2':'Oversight assumes we know what the system is; a silent swap removes that knowledge.'},systemId:'sys-6',name:'HRIS Vendor Swaps the Screening Model Without Notice',description:'The vendor can update the screening model behind the same interface. Our fairness findings would silently describe a model that no longer exists.',category:'T',source:'internal',litL:3,litI:3,litT:2,loggedBy:'Tom Whitfield',loggedAt:exDaysAgo(20),domain:'Third-party / vendor',domainNeeds:0,needs:{expertise:['Vendor contract knowledge'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Tom Whitfield',assessors:[],by:'Harriet Rivers',at:EX_NOW-12*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-20*86400000,pinnedBy:'Tom Whitfield',litL:2,litI:3,litT:2}],assessRec:{litL:3,litI:3,litT:2,classification:'monitor',plan:'Watch vendor release notes; tie the fairness re-test to any model change.',rationale:'',by:'Tom Whitfield',at:EX_NOW-16*86400000},classification:'monitor',status:'assessed',monitorPlan:{indicators:[{indicator:'Vendor release notes mention the screening module',owner:'Tom Whitfield',description:'The vendor bulletin read for any change to the screening model \u2014 each one restarts the validation question.',threshold:'Any model change',source:'Vendor bulletin',checks:[{at:EX_NOW-6*86400000,by:'Harriet Rivers',note:'Distribution shift 0.3\u03c3 \u2014 No vendor release this cycle; shortlist distribution inside the audited baseline.'}]}],monitor:'Tom Whitfield',frequency:'review',by:'Tom Whitfield',at:EX_NOW-11*86400000}},
{id:'r-as1',systemId:'sys-7',name:'Chatbot Commits to Unbuildable Specifications',description:'A customer-facing chatbot that answers product questions can drift into quoting configurations or timelines the shop cannot honor \u2014 a commitment made in our name by a system with no notion of capacity.',category:'P',source:'internal',litL:4,litI:4,litT:3,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(8),domain:'Technical/model',domainNeeds:0,needs:{expertise:['Product configuration knowledge','Chatbot platform evaluation'],effort:'few-days',special:''},selection:{decision:'advance',owner:'Shalini Mehta',assessors:[{name:'Vincent Lau',covers:'feasibility'}],by:'Harriet Rivers',at:EX_NOW-8*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-8*86400000,pinnedBy:'Shalini Mehta',litL:4,litI:4,litT:3}],assess:{desc:'The failure is a confident answer that reads as a commitment: a configuration we cannot fabricate, a lead time we cannot hit, a price nobody approved. It lands in writing, in the customer\'s hands.',context:'Logged when the chatbot project fired the approaching-development trigger. Vendor shortlist is in review; nothing is built yet, which is exactly when scope constraints are cheapest to set.',rootCauses:[{text:'Chatbot scope not yet bounded to information-only answers',level:'Direct'}],controls:[{text:'No controls exist yet \u2014 the system is pre-build',eff:'Ineffective'}],capGaps:'No contract-language check between the chatbot\u2019s commitments and the product configurator\u2019s buildable envelope.',noControls:false,triggers:[{indicator:'Out-of-envelope commitment in transcript sample',threshold:'>1 per 100 conversations'}],trigDetail:'Product-line changes that shrink the buildable envelope faster than the bot\u2019s knowledge updates.',velOnset:'moderate',velWindow:'weeks',velDetail:'A bad commitment surfaces when the order hits engineering review \u2014 typically two to three weeks after the conversation.',depsInt:[{text:'Configurator envelope feed into the bot knowledge base'}],depsExt:[{text:'Chatbot platform vendor\u2019s prompt-layer guardrail roadmap'}],likelihoodBasis:'Transcript sampling found the bot agreeing to out-of-envelope specs in roughly one conversation in eighty.',impOps:'Engineering triages unbuildable orders; sales renegotiates commitments the customer believed were final.',impFin:'Concession cost per walked-back commitment; occasional custom engineering to honor one.',impStrat:'Chatbot expansion to quoting-adjacent conversations is gated on fixing this.',stakeholders:[{name:'Customers holding bot commitments',tag:'External',note:'Believe the spec is agreed'},{name:'Engineering review',tag:'Internal',note:'Catches unbuildables late'}],quant:[{measure:'Bot conversations monthly',estimate:'~900',confidence:'High'},{measure:'Out-of-envelope commitment rate',estimate:'~1.2%',confidence:'Medium'}],repCultural:'A walked-back written commitment damages trust worse than a slow answer ever would.',cascades:[{text:'Adjacent to the scope-creep flag \u2014 commitments plus advice is the compound failure',tag:'Internal'}],ethHow:'',ethNotes:{},na:{quant:{by:'Shalini Mehta',at:EX_NOW-8*86400000}}},status:'identified'},
{id:'r-as3',systemId:'sys-5',name:'Maintenance Model False Negatives on the Furnace',description:'A predictive-maintenance model that misses a developing furnace fault gives false confidence exactly where the failure is most expensive \u2014 an unplanned furnace outage is measured in weeks, not shifts.',category:'O',source:'internal',litL:3,litI:5,litT:2,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(8),domain:'Technical/model',domainNeeds:0,needs:{expertise:['Reliability engineering','Sensor data quality'],effort:'week-plus',special:''},selection:{decision:'advance',owner:'Vincent Lau',assessors:[{name:'Sinead Corrigan',covers:'telemetry'}],by:'Harriet Rivers',at:EX_NOW-8*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-8*86400000,pinnedBy:'Vincent Lau',litL:3,litI:5,litT:2}],assess:{desc:'The pilot\'s value case is catching furnace faults early. Its danger case is the same sentence inverted: a model trusted and wrong delays the inspection that would have caught the fault.',context:'The furnace maintenance model predicts refractory wear from thermal telemetry. A false negative means a missed wear window \u2014 and furnace failures are the plant\u2019s most expensive single event.',rootCauses:[{text:'Training data thin on end-of-life wear signatures',level:'Direct'},{text:'Manual inspection retired too early on model-cleared windows',level:'Contributing'}],controls:[{text:'Quarterly manual refractory inspection reinstated',eff:'Effective'},{text:'Vendor recall improvement on end-of-life patterns, roadmap item',eff:'Ineffective'}],capGaps:'No independent wear inspection on model-cleared windows \u2014 the model is currently the only eyes.',triggers:[{indicator:'Model confidence on wear calls, final-quartile age',threshold:'<0.8'},{indicator:'Manual inspection disagreeing with a model clear',threshold:'Any'}],trigDetail:'Extended high-temperature campaigns age refractory faster than the training distribution assumed.',velOnset:'gradual',velWindow:'months',velDetail:'Wear accumulates over months; the miss is silent until the failure or a manual inspection catches it.',depsInt:[{text:'Thermal telemetry feed integrity'}],depsExt:[{text:'Vendor model-improvement roadmap'}],likelihoodBasis:'The model\u2019s validation set underrepresents end-of-life wear patterns; the vendor concedes recall drops in the final quartile.',impOps:'An unplanned furnace outage stops the float line for weeks, not hours.',impFin:'Rebuild plus lost production runs to seven figures \u2014 the largest single-event exposure on the register.',impStrat:'The predictive-maintenance program\u2019s credibility rests on the furnace call being right.',stakeholders:[{name:'Maintenance team',tag:'Internal',note:'Their judgment is the backstop'},{name:'Production',tag:'Internal',note:'Bears the outage'}],quant:[{measure:'Unplanned furnace outage cost',estimate:'$1.5\u20132.5M',confidence:'Medium'},{measure:'Model recall, final-quartile wear',estimate:'Vendor concedes degradation; unquantified',confidence:'Low'}],repCultural:'Maintenance veterans distrust the model\u2019s clear calls already \u2014 a miss would end cooperation.',cascades:[{text:'A furnace event would swamp every other risk on the register simultaneously',tag:'Internal'}],ethHow:'',ethNotes:{},na:{}},status:'identified'},
{id:'r-df1',systemId:'sys-4',name:'Supplier Forecast Lock-In Deepens',description:'Every planning process we wire to the supplier\\\'s forecast makes leaving them more expensive, whatever the contract says.',category:'S',source:'internal',litL:3,litI:4,litT:1,loggedBy:'Duncan Fairley',loggedAt:exDaysAgo(58),domain:'Third-party / vendor',needs:{expertise:['Procurement','Contract law'],effort:'half-day',special:''},selection:{decision:'defer',trigger:'Contract renewal window opens, or a second-source supplier becomes viable',revisit:'Next cadence review',by:'Harriet Rivers',at:EX_NOW-26*86400000}},
{id:'r-df2',systemId:'sys-3',name:'Prompt Injection Against Staff AI Use',description:'Crafted content in documents or emails could steer an employee\\\'s AI tool into leaking context or producing poisoned output.',category:'T',source:'internal',litL:2,litI:3,litT:2,loggedBy:'Sinead Corrigan',loggedAt:exDaysAgo(58),domain:'Technical/model',needs:{expertise:['IT security'],effort:'few-days',special:''},selection:{decision:'defer',trigger:'A credible injection incident in our sector, or approved tools gain broad file access',revisit:'Next cadence review',by:'Harriet Rivers',at:EX_NOW-26*86400000}},
{id:'r-df3',systemId:null,name:'State Privacy-Law Patchwork Expands',description:'More states adopting AI and privacy statutes multiplies the scoping work each year \u2014 an enterprise exposure that belongs to no single system.',category:'S',source:'external',litL:3,litI:3,litT:1,loggedBy:'Tamsin Doyle',loggedAt:exDaysAgo(58),domain:'Legal & regulatory',needs:{expertise:['Legal','Compliance'],effort:'week-plus',special:''},selection:{decision:'defer',trigger:'Any new state statute touching automated pricing or a sales-footprint change',revisit:'Next cadence review',by:'Harriet Rivers',at:EX_NOW-26*86400000}},
{id:'r-cb1',systemId:'sys-1',name:'No In-House Model Monitoring Capability',description:'Nobody at Aurora can read a model-performance dashboard critically. Every drift question routes to the vendor who built the thing being questioned.',category:'O',source:'internal',litL:3,litI:4,litT:2,loggedBy:'Harriet Rivers',loggedAt:exDaysAgo(58),domain:'Technical/model',needs:{expertise:['Model operations','Data science'],effort:'few-days',special:''},selection:{decision:null,owner:'Vincent Lau'}},
{id:'r-b1',systemId:'sys-2',name:'Camera Hardware Ages Out',description:'The vision rig\\\'s cameras reach vendor end-of-support in eighteen months; degraded optics degrade the model silently.',category:'O',source:'internal',litL:2,litI:2,litT:1,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(58),domain:'Operational/process',needs:{expertise:['Production engineering','Vendor management'],effort:'half-day',special:''},selection:{decision:null,owner:'Vincent Lau'}},
{id:'r-b2',systemId:null,name:'AI Vendor Market Consolidation',description:'Acquisitions among our AI vendors could strand a product, change terms, or fold our data into a company we never chose.',category:'S',source:'external',litL:2,litI:3,litT:1,loggedBy:'Duncan Fairley',loggedAt:exDaysAgo(58),domain:'Market & commercial',needs:{expertise:['Procurement','Legal'],effort:'conversation',special:''},selection:{decision:null,owner:'Duncan Fairley'}},
{id:'r-b3',ethicalFlag:true,ethicalDesc:'Overstated performance claims could mislead buyers \u2014 flagged to check against the societal-effects principle.',ethStatus:'cleared',ethTest:{by:'Harriet Rivers',at:exDaysAgo(20)},ethHow:'',ethNotes:{},systemId:'sys-3',name:'AI-Generated Marketing Claims Overstate Performance',description:'Marketing drafts product copy with AI tools; generated text has twice overstated thermal-performance ratings before review caught it.',category:'P',source:'internal',litL:3,litI:3,litT:2,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(58),domain:'Operational/process',needs:{expertise:['Marketing','Legal'],effort:'half-day',special:''},selection:{decision:null,owner:'Freya Lindqvist'}},
{id:'r-b4',systemId:'sys-1',name:'Quote Training Data Goes Stale',description:'The engine was trained on pre-2024 jobs. As the product mix shifts toward specialty glass, its pricing priors age.',category:'T',source:'internal',litL:2,litI:3,litT:2,loggedBy:'Freya Lindqvist',loggedAt:exDaysAgo(58),domain:'Data',needs:{expertise:['Pricing analytics','Data engineering'],effort:'few-days',special:''},selection:{decision:null,owner:'Duncan Fairley'}},
{id:'r-nw1',systemId:'sys-7',name:'Chatbot Scope Creep Into Advice',description:'Once live, a helpful chatbot gets asked questions beyond order status \u2014 structural suitability, code compliance \u2014 and answering them makes us liable for advice we never meant to give.',category:'P',source:'internal',litL:3,litI:4,litT:3,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(5),ethicalFlag:true,ethicalDesc:'Customers may rely on unqualified automated advice',domain:'Ethical & societal',needs:{expertise:['Customer service','Legal'],effort:'half-day',special:''},selection:{decision:null,owner:'Shalini Mehta'}},
{id:'r-nw2',systemId:null,name:'Deepfake Purchase-Order Fraud',description:'Trade press reports AI-voice and document fraud hitting mid-size manufacturers \u2014 a spoofed change-of-bank request is the version aimed at us.',category:'O',source:'external',litL:3,litI:3,litT:3,loggedBy:'Freya Lindqvist',loggedAt:exDaysAgo(3),domain:'Operational/process',needs:{expertise:['Finance controls','IT security'],effort:'conversation',special:''},selection:{decision:null,owner:'Freya Lindqvist'}},
{id:'r-ex11',systemId:'sys-1',name:'Generative Design Displacing the Design Team',description:'Speculation that generative tools will replace custom glass design work.',category:'S',source:'internal',litL:2,litI:2,litT:1,loggedBy:'Shalini Mehta',loggedAt:exDaysAgo(58),domain:'Market & commercial',dismissed:{by:'Harriet Rivers',at:EX_NOW-50*86400000,reason:'Too speculative to act on \u2014 no concrete pathway from today\'s tools to our design work; relog when one exists',origin:'identify'}},
{id:'r-di2',systemId:null,name:'AI Develops Unforeseen Autonomous Behavior',description:'General unease that AI systems could act outside their design.',category:'i',source:'internal',litL:1,litI:3,litT:1,loggedBy:'Tom Whitfield',loggedAt:exDaysAgo(58),domain:'Ethical & societal',dismissed:{by:'Harriet Rivers',at:EX_NOW-50*86400000,reason:'The concrete failure modes behind this unease are already logged as separate risks \u2014 this entry adds no decision anyone can take',origin:'identify'}},
{id:'r-di3',systemId:'sys-2',name:'Specialty Glass Inspection Gaps',description:'Vision system may miss defects on specialty products.',category:'P',source:'internal',litL:3,litI:3,litT:2,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(58),domain:'Technical/model',dismissed:{by:'Vincent Lau',at:EX_NOW-44*86400000,reason:'Duplicate of the tinted-glass defect miss rate card \u2014 consolidated there',origin:'identify'}},
{id:'r-ac1',assess:{desc:'Quote API response times breached the customer-facing SLA during the autumn volume peak \u2014 p95 latency roughly doubled, and the portal timed out on complex multi-pane configurations.',context:'The latency traced to an unindexed lookup introduced with the specialty-glass pricing feature; load exposed it. Resolved by the November index-and-cache release; SLA compliance has held since.',capGaps:'At the time: no load testing against seasonal peak profiles before feature releases.',likelihoodBasis:'Recurrence is bounded by the new pre-release load gate; residual likelihood low.',velOnset:'rapid',velWindow:'days',velDetail:'Latency built over days as volume climbed toward the peak.',trigDetail:'Seasonal quote-volume peaks and any feature adding per-quote lookups.',impOps:'Portal timeouts pushed complex quotes to manual handling for three weeks.',impFin:'An SLA credit issued to two portal-integrated customers; modest.',impStrat:'None lasting \u2014 resolved before renewal season.',repCultural:'Two integration partners raised it; both accepted the fix report.',rootCauses:[{text:'Unindexed lookup shipped in the specialty-pricing feature',level:'Direct'},{text:'No peak-profile load gate on releases',level:'Contributing'}],controls:[{text:'Pre-release load test against the recorded peak profile',eff:'Effective'},{text:'p95 latency alarm on the quote API',eff:'Effective'}],triggers:[{indicator:'Quote API p95 latency',threshold:'>2s sustained 1h'}],stakeholders:[{name:'Portal-integrated customers',tag:'External',note:'Bore the timeouts'},{name:'Platform engineering',tag:'Internal',note:'Owned the fix'}],quant:[{measure:'SLA breach duration',estimate:'19 days',confidence:'High'},{measure:'Credits issued',estimate:'2 customers',confidence:'High'}],cascades:[{text:'Manual quote handling loaded the same team covering the mispricing review',tag:'Internal'}],depsInt:[{text:'The load-test gate staying in the release checklist'}],depsExt:[{text:'Seasonal demand profile staying within tested bounds'}]},systemId:'sys-1',name:'Quote API Latency Breaches the Response SLA',description:'Slow model inference could push quote turnaround past the response-time expectation.',category:'O',source:'internal',litL:2,litI:2,litT:1,loggedBy:'Sinead Corrigan',loggedAt:exDaysAgo(58),domain:'Technical/model',domainNeeds:0,needs:{expertise:['None beyond existing telemetry'],effort:'conversation',special:''},selection:{decision:'advance',owner:'Sinead Corrigan',assessors:[],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Sinead Corrigan',litL:2,litI:2,litT:1}],assessRec:{litL:2,litI:2,litT:1,classification:'archive',plan:'',rationale:'Worst observed latency adds seconds to a sales cycle measured in days \u2014 no plausible path to material impact',by:'Sinead Corrigan',at:EX_NOW-16*86400000},classification:'archive',status:'assessed',resolution:{type:'accepted \u2014 no action',rationale:'Worst observed latency adds seconds to a sales cycle measured in days \u2014 no plausible path to material impact',communicated:'',by:'Sinead Corrigan',at:EX_NOW-16*86400000}},
{id:'r-ac2',assess:{desc:'The vision system\u2019s false-reject rate on clear glass ran roughly triple the specification \u2014 good panes routed to manual re-inspection, cutting effective line throughput.',context:'Traced to a lighting change on the inspection line that shifted the camera\u2019s exposure envelope. Recalibration and a lighting lock resolved it; the rate has held at spec for two quarters.',capGaps:'At the time: no environmental-change control on the inspection cell \u2014 lighting was maintained as facilities work, not as model input.',likelihoodBasis:'Residual likelihood low with the environment under change control; the failure mode is understood.',velOnset:'moderate',velWindow:'weeks',velDetail:'The rate drifted up over two weeks following the lighting work.',trigDetail:'Any physical change to the inspection cell \u2014 lighting, camera position, backdrop \u2014 can move the exposure envelope.',impOps:'Manual re-inspection queue consumed QC hours and slowed the clear-glass line by roughly a tenth.',impFin:'Overtime in QC for the drift period; no escaped-defect cost \u2014 the failure direction was conservative.',impStrat:'None \u2014 the conservative failure direction validated the design choice.',repCultural:'QC frustration at re-inspecting good panes; resolved with the fix and the drill program.',rootCauses:[{text:'Lighting change moved the exposure envelope',level:'Direct'},{text:'Inspection cell environment outside change control',level:'Contributing'}],controls:[{text:'Environmental change control on the inspection cell',eff:'Effective'},{text:'Weekly false-reject rate check against spec',eff:'Effective'}],triggers:[{indicator:'Clear-glass false-reject rate',threshold:'>1.5\u00d7 spec, weekly'}],stakeholders:[{name:'QC team',tag:'Internal',note:'Absorbed the re-inspection load'},{name:'Production',tag:'Internal',note:'Lost line throughput'}],quant:[{measure:'False-reject rate at peak',estimate:'~3\u00d7 spec',confidence:'High'},{measure:'Throughput loss during drift',estimate:'~10%',confidence:'Medium'}],cascades:[{text:'Re-inspection load pulled QC hours from the specialty line',tag:'Internal'}],depsInt:[{text:'Change-control discipline on the inspection cell'}],depsExt:[]},systemId:'sys-2',name:'Clear-Glass False-Reject Rate',description:'The vision system may reject good clear panels at a rate that costs real yield.',category:'P',source:'internal',litL:3,litI:3,litT:2,loggedBy:'Vincent Lau',loggedAt:exDaysAgo(58),domain:'Technical/model',domainNeeds:0,needs:{expertise:['QC data'],effort:'half-day',special:''},selection:{decision:'advance',owner:'Vincent Lau',assessors:[],by:'Harriet Rivers',at:EX_NOW-26*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Vincent Lau',litL:3,litI:3,litT:2}],assessRec:{litL:1,litI:2,litT:1,classification:'archive',plan:'',rationale:'The pre-deployment yield test came back clean \u2014 false rejects at 0.4%, inside manual baseline. Evidence log entry on the vision system, eight days ago. Retired on the result.',by:'Vincent Lau',at:EX_NOW-8*86400000},classification:'archive',status:'assessed',resolution:{type:'accepted \u2014 no action',rationale:'The pre-deployment yield test came back clean \u2014 false rejects at 0.4%, inside manual baseline. Evidence log entry on the vision system, eight days ago. Retired on the result.',communicated:'QC team, at the weekly stand-up',by:'Vincent Lau',at:EX_NOW-8*86400000}},
{id:'r-ac3',ethDimension:'Customers\u2019 private correspondence would be baked into model weights without their knowledge \u2014 data given for service, consumed for training, with no deletion possible and no disclosure made.',assess:{desc:'A proposal to fine-tune a drafting model on customer correspondence was dismissed at assessment: correspondence contains personal data and commercial confidences, and fine-tuning bakes both into model weights that outlive any deletion request.',context:'The proposal promised faster first-draft responses. Assessment found the privacy and confidentiality exposure structural \u2014 not mitigable by filtering \u2014 and the transparency principle unsatisfiable at the training stage. Dismissed with a documented rationale; retrieval-based drafting adopted instead.',capGaps:'None outstanding \u2014 the dismissal is the control.',likelihoodBasis:'Not applicable to a dismissed proposal; the record exists for the archive rationale.',velOnset:'gradual',velWindow:'months',velDetail:'Had it shipped, exposure would have accreted with every fine-tuning cycle.',trigDetail:'Pressure to revisit rises if retrieval-based drafting underperforms.',impOps:'Avoided: an unremovable data liability inside a production model.',impFin:'Avoided: breach-notification and deletion-request exposure without a deletion mechanism.',impStrat:'The dismissal set the precedent: training-data provenance is a gate, not a preference.',repCultural:'The rationale is cited internally as the standard for data-use proposals.',rootCauses:[{text:'Fine-tuning permanently embeds training data in weights',level:'Direct'}],controls:[{text:'Dismissal with documented rationale; retrieval-based alternative adopted',eff:'Effective'}],triggers:[{indicator:'New proposal to train on customer content',threshold:'Any'}],stakeholders:[{name:'Customers whose correspondence was proposed as training data',tag:'External',note:'Never informed \u2014 the transparency failure the screening confirmed'},{name:'Support team',tag:'Internal',note:'Wanted the drafting speed; got the retrieval alternative'}],quant:[{measure:'Correspondence volume proposed for training',estimate:'~3 years of tickets',confidence:'High'}],cascades:[{text:'Approval would have set the precedent for training on customer data anywhere',tag:'Internal'}],depsInt:[{text:'Retrieval-based drafting performing well enough to keep the pressure off'}],depsExt:[]},ethHow:'Customer correspondence contains personal data and commercial confidences; fine-tuning bakes both into model weights that outlive any deletion request.',ethNotes:{'pr-ex5':'Customers were never told their correspondence trains models \u2014 the disclosure principle fails at the training stage, not the quoting stage.'},systemId:'sys-3',name:'Fine-Tuning a Drafting Model on Customer Correspondence',description:'A proposal to fine-tune an internal drafting model on customer emails to improve tone-matching.',category:'T',source:'internal',litL:3,litI:4,litT:2,loggedBy:'Sinead Corrigan',loggedAt:exDaysAgo(58),ethicalFlag:true,ethicalDesc:'Customer correspondence used as training data without consent',domain:'Ethical & societal',domainNeeds:0,needs:{expertise:['Data protection knowledge'],effort:'half-day',special:''},selection:{decision:'advance',owner:'Sinead Corrigan',assessors:[{name:'Harriet Rivers'}],by:'Harriet Rivers',at:EX_NOW-26*86400000},ethStatus:'confirmed',ethPrinciples:['pr-ex5'],ethTest:{by:'Harriet Rivers',at:EX_NOW-24*86400000},history:[{kind:'rapid-screen',pinnedAt:EX_NOW-58*86400000,pinnedBy:'Sinead Corrigan',litL:3,litI:4,litT:2}],assessRec:{litL:2,litI:4,litT:1,classification:'archive',plan:'',rationale:'The proposal is dropped, which retires the risk: training on customer correspondence without consent breaches the transparency commitment, and no consent mechanism is worth the gain. On the board\'s table at its next review as a confirmed-Responsible AI archive.',by:'Harriet Rivers',at:EX_NOW-16*86400000},classification:'archive',status:'assessed',resolution:{type:'accepted \u2014 no action',rationale:'The proposal is dropped, which retires the risk: training on customer correspondence without consent breaches the transparency commitment, and no consent mechanism is worth the gain. On the board\'s table at its next review as a confirmed-Responsible AI archive.',communicated:'Proposal owner and the Responsible AI board agenda',by:'Harriet Rivers',at:EX_NOW-16*86400000}}
];
```

**Check:** Load the example data (see section 6). Open the Initial Risk Register and click FULL. No risk shows Not recorded against Expertise needed or Effort.

---

### Step 46 — Replace the function that opens the print window and writes the document into it.

**Kind:** Replace existing code.

**Where:** Find the function named `printPage`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function printPage(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function printPage(optTitle,optContent,opts){ /* 12 Sep 2026: a title and a ready document may be passed in, for the Phase 5 pages; 14 Sep 2026: opts.preview opens the document without the print dialog */
var titleEl=document.querySelector('#app h2');
var title=optTitle||(titleEl?titleEl.textContent:'Report');
var app=document.getElementById('app');if(!app)return;
var _pd=(typeof PRINT_DOCS!=='undefined')&&PRINT_DOCS[currentStep];
var leadEl=titleEl&&titleEl.parentNode?titleEl.parentNode.querySelector('p'):null;var lead=leadEl?leadEl.textContent:'';
var content=optContent||(_pd?_pd():(printDocCover(title,lead,'')+_pdStripHeader(printSanitize(app))));/* addendum 117: document renderers lead; the sanitized screen is the fallback — 12 Sep 2026: the fallback gets the cover and loses its heading too */
content=content.replace(/<button[^>]*>.*?<\/button>/gi,'');
content=content.replace(/onclick="[^"]*"/gi,'');
content=content.replace(/cursor:pointer/gi,'cursor:default');
var w=window.open('');
if(!w){alert('The print view was blocked by the browser. Allow pop-ups for this site and try again.');return}/* domsweep finding, 16 Aug 2026: a popup blocker returns null here — the crash becomes a plain message */
w.document.write('<html><head><title>'+(title||'Report')+'</title>'+
'<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">'+
'<style>'+printThemeTokens()+'</style>'+
'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--sans,Helvetica Neue,sans-serif);max-width:800px;margin:40px auto;padding:0 40px;color:#1a1a1a;line-height:1.7;font-size:14px;background:#fff}'+
'h1,h2,h3,h4{color:#1a1a1a}svg{max-width:100%}'+
'.cd{background:none;border:none;border-radius:0;padding:8px 0;margin-bottom:14px;page-break-inside:avoid}'+/* addendum 116: the popup pipeline is its own document — the report flattening must live HERE, not only in the app stylesheet's print block */
'h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}.u-47b192e,.u-136497d{text-align:center}'+
'table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;vertical-align:top;border-bottom:1px solid #e0e0e0;text-align:left}'+/* addendum 120: the RACI activity rows separate on hairlines */
'.bg{display:inline-block;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700}'+
'.tag{font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:4px 10px;border:1px solid;display:inline-block}'+
'*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+ /* 12 Sep 2026 (Paul's print pass): without this the browser drops every background fill, and the RACI chips print as bare letters */
'[style*="color:var(--paper)"],[style*="color:#F5F2EC"],[style*="color: var(--paper)"]{color:#1a1a1a !important}'+
'[style*="color:var(--stone)"],[style*="color:var(--text-muted)"],[style*="color:var(--text-faint)"]{color:#555 !important}'+
'[style*="color:rgba(138,130,120"]{color:#777 !important}'+
'[style*="background:rgba(245,242,236"]{background:#f5f5f4 !important}'+
'[style*="background:rgba(30,110,110"]{background:#e8f5f0 !important}'+
'[style*="background:rgba(27,107,90"]{background:#e8f5f0 !important}'+
'[style*="border:1px solid rgba(245,242,236"]{border-color:#ddd !important}'+
'[style*="border:2px solid"]{border-color:inherit !important}'+
'[style*="border-bottom:1px solid rgba(245,242,236"]{border-color:#eee !important}'+
'p{color:#333}strong{color:#1a1a1a}'+
'svg [stroke="rgba(245,242,236,.08)"]{stroke:#b8b8b8 !important}svg text[fill="#8A8278"]{fill:#444 !important}'+
'.doc-sec{font-size:17px !important;font-weight:700 !important;color:#111 !important}'+ /* the Responsible AI Principles document's section headings (Paul's ruling, 13 Sep 2026): bold, two points above the largest text beneath, below the title */ /* 12 Sep 2026 (Paul's print pass): the radar grid was drawn for the dark theme and vanished on paper */
'@media print{body{margin:0 auto;padding:0}}'+
'@page{margin:16mm 14mm 20mm 14mm;@top-left{content:""}@top-center{content:""}@top-right{content:""}@bottom-center{content:""}@bottom-left{content:"'+printFooterText()+'";font:9px "DM Mono",monospace;color:#666}@bottom-right{content:counter(page) " / " counter(pages);font:9px "DM Mono",monospace;color:#666}}'+ /* PRINT MARGINS (Paul's ruling, 12 Sep 2026; family): the document owns all six page corners — the top three empty, the copyright line bottom left, the page number bottom right — so the browser's own date, title, address, and count never print, whatever the user's Headers and footers setting */
'.print-footer{display:none}@media screen{.print-footer{display:block;margin-top:40px;padding-top:10px;border-top:1px solid #ddd;font-family:"DM Mono",monospace;font-size:9px;letter-spacing:.06em;color:#666}}'+ /* on screen, before printing, the copyright line ends the document */
'<\/style></head><body>'+((opts&&opts.preview)?'<div class="preview-note" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:12px/1.5 var(--sans,sans-serif);color:#333;background:#FBF6EC;border:1px solid #E8D9B8;padding:8px 12px;margin:0 0 24px"><button onclick="window.print()" style="font:12px var(--sans,sans-serif);font-weight:600;padding:6px 14px;border:1px solid #333;border-radius:6px;background:#fff;color:#111;cursor:pointer;white-space:nowrap">Show as pages</button><span style="flex:1;min-width:240px">Preview. Dashed rules below mark where the document forces a page break; where the printer breaks a long section in the middle is set when it prints. Show as pages opens your browser\u2019s print preview, where the pages are exact, and Cancel returns here.</span></div>'+'<style>@media print{.preview-note{display:none}}@media screen{html{background:#e6e6e6}body{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 32px rgba(0,0,0,.08);padding:56px 64px !important;margin:24px auto !important}[style*="break-before:page"]::before,[style*="page-break-after:always"]:not([style*="display:flex"])::after,[style*="min-height:85vh"]+*::before{content:"page break";display:block;text-align:center;font:10px "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#999;border-top:1px dashed #bbb;padding-top:6px;margin:28px 0 24px}[style*="page-break-after:always"]+[style*="break-before:page"]::before{display:none}}</style>' /* 14 Sep 2026 (Paul's ruling): the preview reads as a sheet, marks every forced page break, and offers the browser\'s exact paged preview one click away */:'')+content+
'<div class="print-footer">'+printFooterText()+'</div>'+
'</body></html>'); /* 12 Sep 2026 (Paul's ruling): the copyright footer on every page; the old centered module line is gone */
w.document.close();
if(!(opts&&opts.preview))setTimeout(function(){w.print()},600);
}
```

**Check:** Open any output, for example the Assessment Profile, and click ▾ Save as PDF. A new window opens. Its first page shows, from the top: the line NEXTCHAPTER · 90-DAY RESPONSIBLE AI GOVERNANCE, the title Assessment Profile, a subtitle, a rule, the organization's name, and today's date. The print dialog opens. In its preview, each page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as 1 / 3 at the bottom right. Nothing shows in the top corners.

---

### Step 47 — Rename the function that draws a step's page. Its content does not change.

**Kind:** Change a line inside existing code.

**Where:** Inside the function named `renderStepContent`, find its first line, shown below. Change it to the line in the Code block. Nothing else in the function changes.

```js
function renderStepContent(id){
```

**Code:**

```js
function renderStepContentBody(id){
```

**Nothing to check yet.** This change becomes visible at Step 52.

---

### Step 48 — Add the new function of the old name. It draws the step's page and puts the Save as PDF button above it on Phase 5 pages.

**Kind:** Add new code.

**Where:** Add this at the end of the file, after the comment line below, which is the last line of the file.

```js
/* ═══ END GLOBAL INPUT LENGTH CAP ═══ */
```

**Code:**

```js
function renderStepContent(id){var h=renderStepContentBody(id);return (isPhase5Step(id)&&id!=='5.2')?printBar()+h:h}
```

**Nothing to check yet.** This change becomes visible at Step 52.

---

### Step 49 — Add the function that draws the Save as PDF button above a Phase 5 page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderStepContent` ends, after its closing `}`. You added that function in Step 48.

**Code:**

```js
/* 14 Sep 2026: the Compliance Dashboard's tabs carry their own control */ /* 12 Sep 2026 (Paul's ruling): the print option on every Phase 5 page */

/* PRINT OPTION on every Phase 5 page and every dashboard (Paul's ruling, 12 Sep 2026; family): a Save as PDF control at the top of each such page prints it as a document — cover, body without controls, the copyright footer */
function printBar(){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px"><button class="btn bg2" style="font-size:12px" onclick="printCurrentPage()">\u25be Save as PDF</button></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 52.

---

### Step 50 — Add the function that says whether a step belongs to Phase 5.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printBar` ends, after its closing `}`. You added that function in Step 49.

**Code:**

```js
/* 14 Sep 2026 (Paul's ruling): the same quiet control the outputs carry */
function isPhase5Step(id){var p=null;PH.forEach(function(x){if(x.id===5)p=x});return !!(p&&p.steps.some(function(s){return s.id===id}))}
```

**Nothing to check yet.** This change becomes visible at Step 52.

---

### Step 51 — Add the function that gives a step's name.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `isPhase5Step` ends, after its closing `}`. You added that function in Step 50.

**Code:**

```js
function stepNameOf(id){var nm=id;PH.forEach(function(p){p.steps.forEach(function(s){if(s.id===id)nm=s.name})});return nm}
```

**Nothing to check yet.** This change becomes visible at Step 52.

---

### Step 52 — Add the function that removes buttons and click handlers before printing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `stepNameOf` ends, after its closing `}`. You added that function in Step 51.

**Code:**

```js
function _pbStrip(body){return String(body).replace(/<div class="print-bar"[\s\S]*?<\/div>/,'').replace(/<button[\s\S]*?<\/button>/g,'')}
```

**Check:** Open Phase 5, step 5.1 (Governance Dashboard). At the top right, above the page, a small button reads ▾ Save as PDF. Open Phase 1, step 1.1: there is no such button.

---

### Step 53 — Add the function that shows every collapsible section expanded while a page is drawn for printing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pbStrip` ends, after its closing `}`. You added that function in Step 52.

**Code:**

```js
/* FOLDS OPEN ON PAPER (13 Sep 2026, Paul's ruling; family technique for modules whose folds read state objects directly): while a page is being rendered for print, UI.expanded and UI.wbOpen are replaced by objects that answer true to every key, then restored. The surfaces' own code is untouched. */
function withFoldsOpen(fn){var _e=UI.expanded,_w=UI.wbOpen;var all=(typeof Proxy==='function')?new Proxy({},{get:function(){return true},has:function(){return true}}):{};UI.expanded=all;UI.wbOpen=all;try{return fn()}finally{UI.expanded=_e;UI.wbOpen=_w}}
```

**Nothing to check yet.** This change becomes visible at Step 90.

---

### Step 54 — Add the function that opens and closes the Outputs line in the sidebar.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pbStrip` ends, after its closing `}`. You added that function in Step 52.

**Code:**

```js
/* SIDEBAR OUTPUTS FOLD (Paul's ruling, 12 Sep 2026; family): a phase's outputs sit behind one folded line beneath its steps, so the sidebar stays uncramped and the list of outputs can grow. The fold opens when the user clicks it, and opens itself while one of its outputs is the page being viewed. */
function toggleNavOutputs(phId){UI.navOutOpen=UI.navOutOpen||{};UI.navOutOpen[phId]=!UI.navOutOpen[phId];render()}
```

**Nothing to check yet.** This change becomes visible at Step 57.

---

### Step 55 — Add the function that says whether a phase's Outputs line is open.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `toggleNavOutputs` ends, after its closing `}`. You added that function in Step 54.

**Code:**

```js
function navOutputsOpen(ph){UI.navOutOpen=UI.navOutOpen||{};if(UI.navOutOpen[ph.id])return true;return (ph.outcomes||[]).some(function(o){return (currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id})}
```

**Nothing to check yet.** This change becomes visible at Step 57.

---

### Step 56 — Replace the function that decides what the sidebar shows.

**Kind:** Replace existing code.

**Where:** Find the function named `updateSidebarState`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function updateSidebarState(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function updateSidebarState(){
  var sb=document.getElementById('pipSidebar');
  var mc=document.getElementById('mainContent');
  var showSidebar=(currentPage==='step'||currentPage==='reports'||currentPage==='phase'||currentPage==='phase5'||currentPage==='outcome'||currentPage==='pipeline'||currentPage==='overview'||currentPage==='portfolio'||currentPage==='ethicsov'||currentPage==='govreview'||currentPage==='system');/* addendum 149 (15 Aug 2026, ruled): the three standing pages keep the sidebar and its toggle */
  if(sb){
    sb.className='sidebar'+(sidebarOpen?'':' collapsed')+(sidebarMinimized?' mini':'');
    sb.style.display=showSidebar?'flex':'none';
  }
  if(mc){
    mc.style.marginLeft='';                       // layout is class-driven (innovation pattern)
    mc.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){mc.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){mc.classList.add('sidebar-mini');}
  }
  var ftr=document.getElementById('appFooter');
  if(ftr){
    ftr.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){ftr.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){ftr.classList.add('sidebar-mini');}
  }
  var btn=document.getElementById('sidebarToggle');
  if(btn){
    btn.style.display=showSidebar?'block':'none';
    btn.style.left='16px';                        // pinned, innovation-style
  }
}
```

**Nothing to check yet.** This change becomes visible at Step 57.

---

### Step 57 — Replace the function that draws the sidebar. Each phase's outputs now sit behind one line that opens on click.

**Kind:** Replace existing code.

**Where:** Find the function named `renderSidebar`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderSidebar(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// === SIDEBAR ===
function renderSidebar(){
  var sb=document.getElementById('pipSidebar');
  if(!sb)return;
  var showSidebar=(currentPage==='step'||currentPage==='reports'||currentPage==='phase'||currentPage==='phase5'||currentPage==='outcome'||currentPage==='pipeline'||currentPage==='overview'||currentPage==='portfolio'||currentPage==='ethicsov'||currentPage==='govreview'||currentPage==='system');/* addendum 149 (15 Aug 2026, ruled): the three standing pages keep the sidebar and its toggle */
  // All show/hide/layout state lives in updateSidebarState (class-driven).
  updateSidebarState();
  if(!showSidebar)return;

  // Header with min/max toggle (innovation pattern)
  var togContent = sidebarMinimized ? '\u00bb' : '\u00ab&nbsp;&nbsp;Minimize';
  var togTitle = sidebarMinimized ? 'Maximize sidebar' : 'Minimize sidebar';
  var headerHtml = '<div class="sidebar-header">'
    + (sidebarMinimized ? '<div class="sidebar-logo-mini" title="AI Governance">AI</div>' : '<div class="sidebar-logo">AI <span>Governance</span></div>')
    + '<button class="sidebar-size-tog" onclick="toggleSidebarSize()" title="' + togTitle + '" aria-label="' + togTitle + '">' + togContent + '</button>'
    + '</div>';

  // Minimized body: phase circles only
  if(sidebarMinimized){
    var h='<div class="sidebar-inner">';
    h += headerHtml;
    h += '<div class="sidebar-scroll">';
    h += '<div class="sidebar-mini-row' + (currentPage==='overview'?' active':'') + '" onclick="go(\'overview\')" title="Overview">'
      + '<span class="sidebar-mini-icon">\u25a6</span></div>';
    for(var i=0;i<PH.length;i++){
      var ph=PH[i];
      var isPhaseActive=(currentPage==='phase'&&currentStep===String(ph.id));
      var hasActiveStep=(currentPage==='step'&&currentStep&&String(currentStep).charAt(0)===String(ph.id));
      h += '<div class="sidebar-mini-row' + (isPhaseActive||hasActiveStep?' active':'') + '" '
        + 'onclick="go(\'phase\',\''+ph.id+'\')" '
        + 'title="Phase '+ph.id+': '+ph.name+' ('+ph.days+')">'
        + '<span class="sidebar-mini-dot" style="background:'+ph.color+'">'+ph.id+'</span>'
        + '</div>';
    }
    h += '</div>';
    h += '<button class="sidebar-mini-max" onclick="maximizeSidebar()" title="Maximize sidebar" aria-label="Maximize sidebar">\u00bb</button>';
    h += '</div>';
    sb.innerHTML = h;
    updateSidebarState();
    return;
  }

  // Maximized (full) view — multi-open phase sections (innovation pattern):
  // navigation opens the selected phase; the chevron opens/collapses in place.
  var actId = activeNavPhaseId();
  var pageKey = currentPage + ':' + currentStep;
  if(!UI.navOpenSet){ UI.navOpenSet = {}; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  if(UI._navPageKey !== pageKey){ UI._navPageKey = pageKey; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  var h='<div class="sidebar-inner">';
  h += headerHtml;
  h+='<div class="sidebar-scroll">';
  h+='<div class="sidebar-home'+(currentPage==='overview'?' active':'')+'" onclick="go(\'overview\')">Overview</div>';
  for(var i=0;i<PH.length;i++){
    var ph=PH[i];
    var isPhaseActive=(currentPage==='phase'&&currentStep===String(ph.id));
    var navOpenThis=!!(UI.navOpenSet&&UI.navOpenSet[String(ph.id)]);
    h+='<div class="sidebar-phase-group">';
    h+='<div class="sidebar-phase-head" onclick="goPhase('+ph.id+')">';
    h+='<div class="sidebar-phase-dot" style="background:'+ph.color+'"></div>';
    h+='<span class="sidebar-phase-name" style="color:'+(isPhaseActive?'var(--paper)':'color-mix(in srgb, '+ph.color+' 58%, var(--paper))')+'">'+ph.id+'. '+ph.name+'</span>';
    h+='<span class="sidebar-phase-days">'+ph.days+'</span>';
    h+='<span class="sidebar-phase-tog" onclick="event.stopPropagation();toggleNavPhase('+ph.id+')" title="'+(navOpenThis?'Collapse':'Expand')+'" style="cursor:pointer;color:color-mix(in srgb, '+ph.color+' 58%, var(--paper));font-family:var(--mono);font-size:13px;opacity:.9;padding:2px 6px;margin-left:2px;user-select:none">'+(navOpenThis?'\u25BE':'\u25B8')+'</span>';
    h+='</div>';
    if(navOpenThis){
      for(var j=0;j<ph.steps.length;j++){
        var s=ph.steps[j];
        var isActive=(currentPage==='step'&&currentStep===s.id)||(s.id==='5.1'&&currentPage==='phase5');
        var isDone=isStepDone(s.id);
        var cls='sidebar-step'+(isActive?' active':'')+(isDone?' done':'');
        h+='<div class="'+cls+'" onclick="go(\'step\',\''+s.id+'\')">'+(isDone?'':s.icon+' ')+s.id+' '+s.name+'</div>';
      }
      if(ph.outcomes&&ph.outcomes.length>0){
        var outOpen=navOutputsOpen(ph);
        h+='<div class="sidebar-outcomes-label sidebar-outcomes-fold" onclick="event.stopPropagation();toggleNavOutputs('+ph.id+')" style="cursor:pointer;user-select:none" title="'+(outOpen?'Hide the outputs':'Show the outputs')+'">'+(outOpen?'\u25BE':'\u25B8')+' Outputs <span style="opacity:.7">('+ph.outcomes.length+')</span></div>'; /* 12 Sep 2026 (Paul's ruling): the outputs sit behind a fold */
        if(outOpen){
        for(var k=0;k<ph.outcomes.length;k++){
          var o=ph.outcomes[k];
          var isOActive=(currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id;
          h+='<div class="sidebar-outcome'+(isOActive?' active':'')+'" onclick="'+(o.id.indexOf('out-')===0?'go(\'outcome\',\''+o.id+'\')':'go(\''+o.id+'\')')+'">\u2192 '+o.name+'</div>';
        }
        }
      }
    }
    h+='</div>';
  }
  h+='</div>';
  h+='</div>';
  sb.innerHTML=h;
  updateSidebarState();
}
```

**Check:** Open the sidebar. Under each phase's steps there is one line reading ▸ Outputs (n). Click it: the outputs appear below it and the triangle points down. Click again: they hide.

---

### Step 58 — Replace the code block that limits how much text a field accepts. Fields marked data-uncapped="1" are no longer limited.

**Kind:** Replace existing code.

**Where:** Find the code block that begins with the comment line below and ends with the line `})();`. Delete the whole block, from the comment line to `})();`, and put the code in its place.

```js
/* ═══ GLOBAL INPUT LENGTH CAP (family drop-in — 10,000 characters; ruled 17 Aug 2026) ═══
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* ═══ GLOBAL INPUT LENGTH CAP (family drop-in — 10,000 characters; ruled 17 Aug 2026) ═══
   One rule for the whole app: no text field may hold more than 10,000 characters.
   This single document-level listener covers every existing field, every page and
   modal, and every field created later. Do not add per-field maxlength attributes;
   this block is the whole mechanism. */
(function(){
  var INPUT_CHAR_CAP=10000;
  var CAPPED_INPUT_TYPES=['text','search','email','url','tel','password'];
  document.addEventListener('input',function(e){
    var el=e.target;
    if(!el||!el.tagName)return;
    if(el.getAttribute&&el.getAttribute('data-uncapped')==='1')return; /* 14 Sep 2026 (Paul's ruling): the Report Manager's authored text — the introduction, section notes, text pages — has no cap */
    var isTextArea=(el.tagName==='TEXTAREA');
    var isTextInput=(el.tagName==='INPUT'&&CAPPED_INPUT_TYPES.indexOf(el.type)>=0);
    if(!isTextArea&&!isTextInput)return;
    if(typeof el.value==='string'&&el.value.length>INPUT_CHAR_CAP){
      el.value=el.value.slice(0,INPUT_CHAR_CAP); /* keep the first 10,000 characters; drop the rest */
    }
  },true); /* true = capture phase: the cap runs even if other code stops the event */
})();
```

**Nothing to check yet.** This change becomes visible at Step 110.

---

### Step 59 — Add the constant that says how much of a risk record each portfolio prints.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `navOutputsOpen` ends, after its closing `}`. You added that function in Step 55.

**Code:**

```js
/* PORTFOLIO DOCUMENTS (13 Sep 2026, Paul's ruling): the four portfolio pages and the archive print through the engine, like the register outputs */
var PF_LANE_UPTO={identify:0,assess:2,manage:4,emergency:null,archived:null};
```

**Nothing to check yet.** This change becomes visible at Step 62.

---

### Step 60 — Add the function that builds a portfolio's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `withFoldsOpen` ends, after its closing `}`. You added that function in Step 53.

**Code:**

```js
/* the layer index a lane's register runs up to: prelim, class, mnplan; emergency and the archive print every live layer */
function portfolioDoc(key){var M=PF_META[key]||PF_META.identify;var P=getPortfolios();var list=(P[key]||[]).slice().sort(function(a,b){return compositeOf(b)-compositeOf(a)});
  var upto=PF_LANE_UPTO[key];var depth=(UI.printDepth||'summary');
  var groups=(key==='emergency'||key==='archived')?[{name:'',list:list}]:[{name:'Urgent Risks',list:list.filter(function(r){return compositeOf(r)>=10})},{name:'Other Risks',list:list.filter(function(r){return compositeOf(r)<10})}];
  var lead=key==='manage'?'The risks the organization has committed to, in one list. Manage means risks being actively worked, each with a plan of actions and named owners. Monitor means risks being watched against written conditions.':(M.lead||''); /* 14 Sep 2026 (Paul's ruling): the Manage portfolio's cover carries three sentences of its page lead; the page keeps the whole paragraph */
  return printDocCover(M.t+' Portfolio',lead,'')+lyRegister('risk',list,depth,upto===undefined?null:upto,groups,false,key==='emergency'?'emergency':null)}
```

**Nothing to check yet.** This change becomes visible at Step 62.

---

### Step 61 — Add the function that prints a portfolio.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `portfolioDoc` ends, after its closing `}`. You added that function in Step 60.

**Code:**

```js
/* 14 Sep 2026 (Paul's ruling): the emergency plan first, boxed, at either depth */
function printPortfolioDoc(){var key=currentStep||'identify';var M=PF_META[key]||PF_META.identify;printPage(M.t+' Portfolio',portfolioDoc(key))}
```

**Nothing to check yet.** This change becomes visible at Step 62.

---

### Step 62 — Replace the function that draws a portfolio page. It gains the Summary / Full choice and the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Find the function named `renderPortfolioPage`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderPortfolioPage(){var key=currentStep||'identify';var M=PF_META[key]||PF_META.identify;var P=getPortfolios();
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderPortfolioPage(){var key=currentStep||'identify';var M=PF_META[key]||PF_META.identify;var P=getPortfolios();
var h='<div class="content-area pt-110"><div class="content-inner">'+(UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:0 0 10px">'+lyDepthCtl()+'<button class="btn bg2" style="font-size:12px" onclick="printPortfolioDoc()">\u25be Save as PDF</button></div>'); /* 13 Sep 2026 (Paul's ruling): every Phase 5 surface prints; a portfolio prints as the engine's register for its lane, at the chosen depth */
var _bb=pfBackBtn();if(_bb)h+='<div class="mb-5">'+_bb+'</div>';
h+='<h2 class="h-section">'+M.t+' Portfolio</h2><p class="t-lead">'+M.lead+'</p>';
h+=riskViz(M.k,PF_NAV);
if(key==='emergency'){
var elist=P.emergency||[];
if(!elist.length){
h+=card('<div style="text-align:center;padding:24px 16px"><p style="font-size:15px;font-weight:700;margin:0 0 8px">Empty \u2014 as designed.</p><p style="font-size:13px;color:var(--text-muted);line-height:1.6;max-width:560px;margin:0 auto">Escalation is a decision with a name on it. Everything else in this program exists to keep this page looking exactly like this.</p><p style="font-size:12px;color:var(--text-faint);margin:10px 0 0">What sends a risk here: model behavior drift \u00b7 a security breach \u00b7 an ethical violation \u00b7 a dependency failure \u00b7 a systemic cascade.</p></div>');
return h+'</div></div>'}
h+=pfEmergencyRegister(elist);
return h+'</div></div>'}
var list=P[key]||[];var flt=pfApplyF(key,list).sort(function(a,b){return compositeOf(b)-compositeOf(a)});
if(!flt.length)h+=card('<p style="color:var(--text-faint);font-style:italic">Nothing here'+(list.length?' under the current filters':'')+'.</p>');
else if(key==='identify'){
if(UI.riskReviewHdr){var _rrc=data.reviewCadence||{};var _rn=Object.keys(_rrc.scanSources||{}).length+((_rrc.scanCustom||[]).length);
var _srcNames=SCAN_SOURCES.filter(function(x){return (_rrc.scanSources||{})[x.k]}).map(function(x){return x.l}).concat((_rrc.scanCustom||[]).map(esc));
h+=card('<h3 style="font-size:16px;font-weight:700;margin:0 0 6px;color:#1E6E6E">New Risk Review</h3><p style="font-size:13px;color:var(--text-muted);margin:0 0 6px">The committee re-scans the configured sources for new risks.</p>'+(_srcNames.length?'<p style="font-size:12.5px;color:var(--text-muted);margin:0 0 6px"><span style="font-weight:600">Sources:</span> '+_srcNames.join(', ')+'</p>':'')+(_rrc.rescanOwner?'<p style="font-size:12.5px;color:var(--text-muted);margin:0 0 6px"><span style="font-weight:600">Named re-scan owner:</span> '+esc(_rrc.rescanOwner)+'</p>':'')+'<p style="font-size:13px;color:var(--text-muted);margin:0 0 2px">1. Log anything new the re-scan finds, with the Log Internal Risk and Log External Risk buttons below.</p><p style="font-size:13px;color:var(--text-muted);margin:0 0 2px">2. Open each newly logged risk on the register below and add its details.</p><p style="font-size:13px;color:var(--text-muted);margin:0 0 8px">3. Score it, then advance it under a named owner or defer it with its monitoring trigger and revisit horizon.</p><div style="display:flex;gap:8px;flex-wrap:wrap">'+btn('\u2713 Review complete','govLogReview(\'risk\')','#1E6E6E','font-size:12px;padding:6px 14px')+btnG('Close without logging','UI.riskReviewHdr=false;render()','font-size:12px;padding:6px 14px')+'</div>','border-left:4px solid #1E6E6E;margin-bottom:14px')}
h+='<div style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap">'+btnS('+ Log Internal Risk','showRiskForm(\'internal\')','#1E6E6E','font-size:13px;padding:6px 14px')+btnS('+ Log External Risk','showRiskForm(\'external\')','#8B4513','font-size:13px;padding:6px 14px')+'</div>';
if(UI.showRiskForm)h+=renderRiskForm();
if(!flt.length)h+=card('<p style="color:var(--text-faint);font-style:italic;font-size:13px">Nothing here \u2014 log a risk above; it lands on this register and at Step 1.3 alike.</p>');
else{h+=pfIdentifyRegister(flt)}/* round 29 (10 Aug 2026): mirrored from 2.5 per the default-mirror ruling */
}
else if(key==='assess'){h+=pfAssessRegister(flt)}
else if(key==='manage'){h+=pfManageRegister(flt,list)}
if(key!=='emergency')h+=archivePanel(key);
return h+'</div></div>'}
```

**Check:** Open Phase 5, then the Identify portfolio. At the top right there are two small buttons SUMMARY and FULL and the button ▾ Save as PDF.

---

### Step 63 — Replace the function that draws the System Exposure Map. Its labels no longer overlap.

**Kind:** Replace existing code.

**Where:** Find the function named `anBubble`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function anBubble(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
// ── System exposure bubble map ──
function anBubble(){
var systems=data.systems||[];var risks=(data.risks||[]).filter(function(r){return isLiveRisk(r)});
if(!systems.length)return anEmpty('No systems inventoried. Complete','1.2','AI System Inventory');
var pts=systems.map(function(s){
var rs=risks.filter(function(r){return r.systemId===s.id});
var exps=rs.map(function(r){return compositeOf(r)||0}).filter(function(e){return e>0});
var avg=exps.length?exps.reduce(function(a,b){return a+b},0)/exps.length:0;
var hi=rs.filter(function(r){var b=sevBand(r);return b==='critical'||b==='high'}).length;
return{s:s,n:rs.length,avg:avg,hi:hi}});
var maxN=Math.max.apply(null,pts.map(function(p){return p.n}).concat([3]));
var W=520,H=240,PX=44,PY=14,PW=W-PX-24,PHt=H-PY-44;
function X(n){return PX+n/maxN*PW}function Y(e){return PY+PHt-(Math.min(e,15)/15)*PHt}
var gc={none:AN.high,partial:AN.med,governed:AN.green};
var h='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">';
[0,8,15,25].forEach(function(e){var y=Y(e);h+='<line x1="'+PX+'" y1="'+y+'" x2="'+(PX+PW)+'" y2="'+y+'" stroke="'+AN.grid+'" stroke-dasharray="2 4"/><text x="'+(PX-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="12" font-family="monospace" fill="'+AN.ink+'">'+e+'</text>'});
h+='<rect x="'+PX+'" y="'+PY+'" width="'+PW+'" height="'+(Y(15)-PY)+'" fill="'+AN.high+'" fill-opacity=".05"/>';
/* 13 Sep 2026 (Paul's ruling): labels must not overlap. Each label tries, in order, below its circle, above it, then further below and further above, and takes the first position whose box clears every label already placed and every circle; a placed label is remembered as a box. Circles are drawn first so every label sits on top. */
var placed=[];var CW=6.4,LH=13;function boxOf(x,y,txt){var w=txt.length*CW;return {x1:x-w/2,y1:y-LH+2,x2:x+w/2,y2:y+3}}function clear(b){return placed.every(function(q){return b.x2<q.x1||b.x1>q.x2||b.y2<q.y1||b.y1>q.y2})&&pts.every(function(q){var qx=X(q.n),qy=Y(q.avg),qr=9+q.hi*5;var nx=Math.max(b.x1,Math.min(qx,b.x2)),ny=Math.max(b.y1,Math.min(qy,b.y2));return (nx-qx)*(nx-qx)+(ny-qy)*(ny-qy)>=qr*qr})}
pts.forEach(function(p){var r=9+p.hi*5,cx=X(p.n),cy=Y(p.avg);var col=gc[p.s.govStatus||'none'];
h+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+col+'" fill-opacity=".38" stroke="'+col+'" stroke-width="1.5"><title>'+esc(p.s.name)+'\n'+p.n+' live risks \u00b7 avg exposure '+p.avg.toFixed(1)+' \u00b7 '+p.hi+' high-severity</title></circle>'});
pts.slice().sort(function(a,b){return X(a.n)-X(b.n)}).forEach(function(p){var r=9+p.hi*5,cx=X(p.n),cy=Y(p.avg);
var nm=p.s.name.length>16?p.s.name.slice(0,15)+'\u2026':p.s.name;
var cands=[cy+r+11,cy-r-5,cy+r+11+LH,cy-r-5-LH,cy+r+11+2*LH,cy-r-5-2*LH];var y=null;
for(var ci=0;ci<cands.length;ci++){var b=boxOf(cx,cands[ci],nm);if(b.y1<0||b.y2>H-14)continue;if(clear(b)){y=cands[ci];placed.push(b);break}}
if(y===null){y=cy+r+11;placed.push(boxOf(cx,y,nm))}
h+='<text x="'+cx+'" y="'+y+'" text-anchor="middle" font-size="12" fill="'+AN.txt+'">'+esc(nm)+'</text>'});
h+='<text x="'+(PX+PW/2)+'" y="'+(H-6)+'" text-anchor="middle" font-size="12" fill="'+AN.txt+'">LIVE RISKS ATTACHED \u2192</text>';
h+='<text x="12" y="'+(PY+PHt/2)+'" text-anchor="middle" font-size="12" fill="'+AN.txt+'" transform="rotate(-90 12 '+(PY+PHt/2)+')">AVG EXPOSURE \u2192</text>';
h+='</svg>';
var orphan=risks.filter(function(r){return!r.systemId}).length;
h+='<div style="display:flex;flex-wrap:wrap;row-gap:4px;gap:12px;justify-content:center;margin-top:4px;font-size:13px;color:'+AN.ink+'"><span style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:'+AN.high+';opacity:.6;margin-right:4px"></span>No governance</span><span style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:'+AN.med+';opacity:.6;margin-right:4px"></span>Partial</span><span style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:'+AN.green+';opacity:.6;margin-right:4px"></span>Governed</span><span style="white-space:nowrap">\u00b7 size = high-severity load</span></div>';
if(orphan)h+='<div style="text-align:center;font-size:12px;color:'+AN.med+';margin-top:4px">'+orphan+' risk'+(orphan>1?'s':'')+' not linked to any system</div>';
return h}
```

**Check:** Open Phase 5, step 5.4 (Analytics). In the System Exposure Map, no two labels overlap.

---

### Step 64 — Add the function that builds the Analytics page's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printPortfolioDoc` ends, after its closing `}`. You added that function in Step 61.

**Code:**

```js
/* ANALYTICS DOCUMENT (13 Sep 2026, Paul's print pass): the page's sections re-laid for paper. Page 1: the title, the lead, Program Coverage, the six figures, and the Analytical Signals. Page 2: the Heatmap beside the Pipeline. Then the remaining sections two to a page where they pair; Governance Velocity beside Team Load, made legible; the Risk Explorer is not printed. The print window has no stylesheet, so the grid, card, and team-load rules the page relies on are declared here. */
function analyticsDoc(){
  var risks=data.risks||[];var live=risks.filter(function(r){return isLiveRisk(r)});var systems=data.systems||[];
  var hi=live.filter(function(r){var b=sevBand(r);return b==='critical'||b==='high'}).length;var eth=live.filter(isEthDesignated).length;
  var exposure=0,scoredN=0;live.forEach(function(r){var c=compositeOf(r);if(c){exposure+=c;scoredN++}});var avgExp=scoredN?(exposure/scoredN).toFixed(1):'\u2014';
  var ach=NIST_SUBCATS.filter(function(sc){return nistSubStatus(sc).s==='achieved'}).length;
  var css='<style>.an2{display:flex;gap:12px;align-items:stretch}.an2>*{flex:1;min-width:0}.an2{break-inside:avoid;page-break-inside:avoid;margin:0 0 12px}.an-page{break-inside:avoid;page-break-inside:avoid}.an-page3 table{table-layout:fixed;width:100%;font-size:10px}.an-page3 table td,.an-page3 table th{padding:3px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cd{padding:12px 14px !important;margin:0 0 12px;border:1px solid #ddd;border-radius:6px;break-inside:avoid;page-break-inside:avoid}.an-kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:0 0 12px}.an-kpi .cd{padding:8px 6px !important;text-align:center;margin:0}.an-kpi .cd div:first-child{font-size:18px !important}.an-kpi .cd div:last-child{font-size:8.5px !important}.an-doc p.t-lead{font-size:12px;line-height:1.5;color:#333;margin:0 0 10px}.an-doc h2.analytics-title{font-size:22px;margin:0 0 8px;color:#111}.an-doc svg{max-width:100%;height:auto}.chart-card{border:1px solid #ddd;border-radius:6px;padding:12px 14px;break-inside:avoid}.chart-title{font-family:var(--mono,monospace);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#7A6B4A;margin:0 0 10px}.chart-subtitle{font-family:inherit;font-size:11px;letter-spacing:0;text-transform:none;color:#666;margin-left:8px}.owner-rows{display:block}.owner-row{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:11.5px}.owner-row-av{width:26px;flex:none}.owner-row-av *{font-size:9px !important}.owner-row-name{width:150px;flex:none;color:#111}.owner-row-bar{flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden}.owner-row-fill{height:100%;display:block}.owner-row-n{width:26px;text-align:right;font-family:var(--mono,monospace);font-size:11px;color:#333}</style>';
  var kpi='<div class="an-kpi">'+[['Systems',systems.length,'#3FA88E'],['Live Risks',live.length,'#4A7FBF'],['Critical / High',hi,AN.high],['Responsible AI Flags',eth,'#B5547A'],['Avg Composite',avgExp,AN.gold],['NIST Areas Addressed',ach+'/72','#2A9D8F']].map(function(k){return '<div class="cd"><div style="font-weight:700;color:'+k[2]+'">'+k[1]+'</div><div style="font-family:var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:#555;margin-top:2px">'+k[0]+'</div></div>'}).join('')+'</div>';
  var h=printDocCover('Analytics','Governance analytics: where risk concentrates, how the portfolios flow, the top exposures, testing evidence, exit readiness, and the gaps that still need an owner.','');
  h+=css+'<div class="an-doc">';
  /* page one: the title, the lead, Program Coverage, the six figures, the Analytical Signals — sized to one page */
  h+='<div class="an-page1" style="break-after:page;page-break-after:always;zoom:.92">';
  h+='<h2 class="analytics-title">Governance Analytics</h2><p class="t-lead">Every chart here is drawn from the same records the portfolios run on; there is no second set of records to maintain. LIT, wherever it appears, is the Rapid Risk Screen\u2019s three scores: Likelihood, Impact, Timeframe. The trend lines are drawn from a daily snapshot the system takes of itself.</p>';
  h+=govCoverageCard()+kpi+anCard('Analytical Signals','Computed findings from the current state of your registers',anSignals())+'</div>';
  /* page two: the Heatmap beside the Pipeline, then NIST Areas beside the Category Profile */
  h+='<div class="an-page" style="break-after:page;page-break-after:always;zoom:.9">';
  h+='<div class="an2">'+anCard('Risk Heatmap','Likelihood \u00d7 impact from detailed scores \u00b7 MANAGE 1.2',anHeatmap())+anCard('Risk Pipeline','Register flow from identification to resolution \u00b7 MEASURE 3.1',anFunnel())+'</div>';
  h+='<div class="an2">'+anCard('NIST Areas Addressed','Areas addressed per function \u00b7 the four RMF functions',anRadar())+anCard('Risk Category Profile','Live risks by category, stacked by composite band',anPosti())+'</div></div>';
  /* page three: the TEVV matrix, then Exit & Emergency Readiness beside Composition */
  h+='<div class="an-page an-page3" style="break-after:page;page-break-after:always;zoom:.86">'; /* 13 Sep 2026 (Paul's print pass): headroom — a physical printer's paper and hardware margins differ from the PDF printer's, the matrix wraps a little taller, and the pair beneath it must still fit */
  h+=anCard('TEVV Evidence Matrix','Measurement evidence per system \u00d7 trustworthiness characteristic \u00b7 MEASURE 2',anTevvMatrix());
  h+='<div class="an2">'+anCard('Exit & Emergency Readiness','Emergency coverage on managed risks, watches on monitored, systems in shutdown, standing exit plans written \u00b7 GOVERN 1.7 / MANAGE 2.4',anExitReadiness())+anCard('Composition','Risk origin and portfolio governance coverage',anComposition())+'</div></div>';
  /* page four: the Burnup beside the Gaps, then Top Exposures */
  h+='<div class="an-page" style="break-after:page;page-break-after:always;zoom:.9">';
  h+='<div class="an2">'+anCard('90-Day Burnup','Cumulative step completion against the ideal 90-day pace',anBurnup())+anCard('Gaps','Fully derived \u2014 each row links to where the gap is fixed',anGaps())+'</div>';
  h+=anCard('Top Exposures','Highest-scored live risks \u00b7 composite ranking',anTopExposures())+'</div>';
  /* page five: the System Exposure Map at its size, with Governance Velocity beside Team Load beneath it (Paul, 13 Sep 2026: option two) */
  h+='<div class="an-page" style="break-after:page;page-break-after:always;zoom:.92">';
  h+=anCard('System Exposure Map','Risk count \u00d7 average composite \u00b7 bubble size = Critical/High load',anBubble());
  h+='<div class="an2">'+anCard('Governance Velocity','Steps completed per program week \u00b7 from completion dates',anVelocity())+govTeamLoad()+'</div></div>';
  /* page six: Metric Trends, last */
  h+=anCard('Metric Trends','Daily snapshots, recorded automatically when Analytics is opened',anTrends());
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 90.

---

### Step 65 — Add the function that builds the Governance Dashboard's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `analyticsDoc` ends, after its closing `}`. You added that function in Step 64.

**Code:**

```js
/* GOVERNANCE DASHBOARD DOCUMENT (14 Sep 2026, Paul's print pass): the dashboard re-laid for paper. Page one: Governance Overview — Program Coverage, the three review cadences, the standing AI Systems list. Then the Register of Responsible AI Principles at a glance (a domain head over numbered one-line principles, as the Responsible AI Principles document's glance page has it), flowing into Risk Management — the escalation notice, the portfolio strip, each lane as a full-width block with its items in two columns (Manage & Monitor split into Managed and Monitored sublists), the Risk Portfolio at a Glance charts on a page of their own, and the RACI matrix alone on a landscape page. Not printed: the Testing Center card, the RACI team editor, the Data Bank, and every control, fold, and screen instruction. The print window has no stylesheet, so the strip, grid, card, and chart rules the page relies on are declared here. */
function dashboardDoc(){
  var systems=data.systems||[];var gr=data.govRhythm||{};var rc=data.reviewCadence||{};var _eb=((data.ethicalFramework||{}).board)||{};var prs=((data.ethicalFramework||{}).principles)||[];
  var P5=getPortfolios();
  var managed=P5.manage.filter(function(r){return cardClass(r)==='manage'});
  var monAll=P5.manage.filter(function(r){return cardClass(r)==='monitor'});
  var pipeCounts={identified:P5.identify.length,assessed:P5.assess.length,managed:P5.manage.length,resolved:P5.emergency.length};
  var css='<style>.gd-doc .gd-sec{font-size:22px;font-weight:800;color:#111;margin:0 0 14px}.gd-doc .gd-sec+.gd-sec{margin-top:26px}.gd-doc .gd-sub{font-size:17px;font-weight:700;color:#111;margin:18px 0 10px;break-after:avoid;page-break-after:avoid}.gd-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:180px;height:117px}.gd-doc .t-faint-sm{font-size:12px;color:#555}.gd-rev3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:0 0 14px}.gd-rev{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;break-inside:avoid}.gd-rev-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;line-height:1.35;min-height:32px}.gd-rev-v{font-size:19px;font-weight:800;margin-top:4px}.gd-rev-d{font-size:12px;color:#555;margin-top:2px}.gd-doc table.gd-sys{width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 6px}.gd-doc table.gd-sys th{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111;padding:6px 8px;text-align:left}.gd-doc table.gd-sys td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}.gd-doc .gd-sys .bg{margin-right:4px;font-size:11px;padding:2px 8px}.gd-arch{font-size:12px;color:#555;margin:4px 0 0}.gd-dom{font-size:16px;font-weight:700;color:#111;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.gd-dom span{font-weight:400;color:#666;font-size:12px}.gd-none{font-size:12.5px;color:#666;font-style:italic;padding:4px 0}.gd-alert{border:2px solid #9B2D3F;color:#9B2D3F;font-weight:700;font-size:14px;padding:8px 12px;border-radius:6px;margin:0 0 14px}.gd-doc .u-778010b{display:flex;align-items:center;gap:0;margin:0 0 18px}.gd-doc .phase-flex{flex:1;opacity:var(--op)}.gd-doc .u-0cc49e2{width:100%;height:70px}.gd-lane{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;margin:0 0 12px;break-inside:avoid;page-break-inside:avoid}.gd-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.gd-subh{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:8px 0 2px}.gd-gl{break-inside:avoid;page-break-inside:avoid;margin:0 0 6px}.gd-gl .gd-dom{font-size:15px;margin:10px 0 2px}.gd-gl-p{font-size:13px;line-height:1.6;margin:2px 0 0;color:#111}.gd-lane-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px}.gd-lane-h h3{font-size:15px;font-weight:700;margin:0}.gd-lane .bg{font-size:11px;padding:2px 8px;margin-left:4px}.gd-warn{font-size:11px;font-weight:600;color:#C8860A;margin:0 0 4px}.gd-item{font-size:12.5px;color:#222;padding:3px 0;border-bottom:1px solid #eee}.gd-doc .analytics-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 12px}.gd-doc .chart-card{border:1px solid #ddd;border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}.gd-doc .chart-title{font-family:var(--mono,monospace);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#111;margin:0 0 12px}.gd-doc .chart-empty{padding:24px 0;text-align:center;font-size:12px;color:#666;font-style:italic}.gd-doc .chart-donut-wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.gd-doc .chart-donut-svg{width:150px;height:150px;flex-shrink:0}.gd-doc .chart-legend{flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px}.gd-doc .chart-legend-row{display:grid;grid-template-columns:12px 1fr auto auto;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee;font-size:12px}.gd-doc .chart-legend-dot{width:10px;height:10px;border-radius:50%}.gd-doc .chart-legend-name{color:#111}.gd-doc .chart-legend-val{font-family:var(--mono,monospace);font-weight:700;font-size:13px}.gd-doc .chart-legend-pct{font-family:var(--mono,monospace);font-size:11px;color:#555;min-width:34px;text-align:right}.gd-doc svg{max-width:100%}</style>';
  var h=printDocCover('Governance Dashboard','Program coverage, the review cadences, the systems list, the Register of Responsible AI Principles, and the risk portfolios as they stand today.','');
  h+=css+'<div class="gd-doc">';
  /* page one: Governance Overview */
  h+='<div style="break-after:page;page-break-after:always">';
  h+='<div class="gd-sec">Governance Overview</div>';
  var _ri=UI.expanded.rcInfo;UI.expanded.rcInfo=false;try{h+=govCoverageCard()}finally{UI.expanded.rcInfo=_ri} /* the coverage card without its How-is-this-scored fold */
  var capF=function(v){return v?v.charAt(0).toUpperCase()+v.slice(1):''};
  var rev=function(lab,col,freq,date){return '<div class="gd-rev" style="border-top-color:'+col+'"><div class="gd-rev-l" style="color:'+col+'">'+lab+'</div><div class="gd-rev-v" style="color:'+col+'">'+esc(freq)+'</div><div class="gd-rev-d">'+esc(/^\d{4}-\d{2}-\d{2}/.test(String(date))?lyDate(date):date)+'</div></div>'}; /* a stored date prints as words */
  h+='<div class="gd-rev3">'+rev('Next New Risk Review','#1E6E6E',rc.reviewFrequency?capF(rc.reviewFrequency):'Not scheduled',rc.firstReviewDate||'Date not set')
    +rev('Next Responsible AI Board Review','#7B4F8A',_eb.cadence?capF(_eb.cadence):'Not scheduled',_eb.nextReview||'Date not set')
    +rev('Next Governance Review','#9B2D3F',gr.govFrequency?(gr.govFrequency==='biannual'?'Twice a year':capF(gr.govFrequency)):'Not scheduled',gr.firstMeeting||'Date not set')+'</div>';
  if(systems.length){
    var live=systems.filter(function(s){return s&&!s.archived});var arch=systems.filter(function(s){return s&&s.archived});
    var rows=live.map(function(s){var lr=(data.risks||[]).filter(function(r){return r&&r.systemId===s.id&&!isArchivedRisk(r)});return {s:s,score:lr.reduce(function(a,r){return a+(compositeOf(r)||0)},0)}}).sort(function(a,b){return b.score-a.score}); /* the screen's order */
    h+='<div class="gd-sub">AI Systems <span style="font-weight:400;color:#666;font-size:12px">('+live.length+')</span></div>';
    h+='<table class="gd-sys"><thead><tr><th style="width:34%">System</th><th>Function</th><th style="width:26%">Status</th></tr></thead><tbody>';
    rows.forEach(function(x){var s=x.s;var st=sysExitState(s);var b=(s.deployStatus?badge(s.deployStatus==='dev'?'In development':'Deployed',s.deployStatus==='dev'?'#C8860A':'#1E6E6E'):'')+(s.isExternal?badge('External vendor','#3D4F5C'):'')+(st?badge('Retired','#6B7F8D'):'');
      h+='<tr><td style="font-weight:600;color:#111">'+esc(s.name||'Unnamed system')+'</td><td>'+(s.fn?esc(s.fn):'<span style="color:#999">Not recorded</span>')+'</td><td>'+(b||'<span style="color:#999">Not recorded</span>')+'</td></tr>'});
    h+='</tbody></table>';
    if(arch.length)h+='<div class="gd-arch">Retirement archive ('+arch.length+'): '+arch.map(function(s){return esc(s.name||'Unnamed system')}).join(' \u00b7 ')+'</div>';
  }else h+='<div class="gd-sub">AI Systems <span style="font-weight:400;color:#666;font-size:12px">(0)</span></div><div class="gd-none">No systems recorded.</div>';
  h+='</div>';
  /* the Register of Responsible AI Principles at a glance (14 Sep 2026, Paul's ruling): the Responsible AI Principles document's glance form — a domain head over numbered one-line principles — on a page of its own */
  h+='<div style="break-before:page;page-break-before:always;break-after:page;page-break-after:always">'; /* 14 Sep 2026 (Paul's ruling): the register on a page of its own; Risk Management starts on a new page */
  h+='<div class="gd-sec" style="margin-top:0">Register of Responsible AI Principles <span style="font-weight:400;color:#666;font-size:14px">('+prs.length+')</span></div>';
  var pn=0;ethDomains().forEach(function(dom){var list=prs.filter(function(p){return String(p.domain||'')===dom});
    h+='<div class="gd-gl"><div class="gd-dom">'+esc(dom)+' <span>('+list.length+')</span></div>';
    if(!list.length)h+='<div class="gd-none">No principles recorded.</div>';
    list.forEach(function(pr){pn++;h+='<div class="gd-gl-p">'+pn+'. '+esc(pr.principle||'')+'</div>'});h+='</div>'});
  h+='</div>';
  /* Risk Management: the notice, the strip, the four lanes; then the glance on a page of its own */
  h+='<div class="gd-sec">Risk Management</div>';
  if(pipeCounts.resolved>0)h+='<div class="gd-alert">\u26a0 '+pipeCounts.resolved+' escalated \u2014 Emergency Response is live</div>';
  h+=riskViz(null,null,pipeCounts);
  var _needsAtt=managed.filter(needsLanding).length;
  var cols=function(items){var half=Math.ceil(items.length/2);var col=function(list){return '<div>'+list.map(function(r){return '<div class="gd-item">'+esc(r.name||'Unnamed risk')+'</div>'}).join('')+'</div>'};return '<div class="gd-cols">'+col(items.slice(0,half))+col(items.slice(half))+'</div>'}; /* 14 Sep 2026 (Paul's ruling): every lane full width, its items in two columns, the first half down the left and the rest down the right */
  var lane=function(t,c,bad,warn,inner){return '<div class="gd-lane" style="border-top-color:'+c+'"><div class="gd-lane-h"><h3 style="color:'+c+'">'+t+'</h3><span>'+bad+'</span></div>'+warn+inner+'</div>'};
  var byScore=function(a,b){return compositeOf(b)-compositeOf(a)};
  var idn=P5.identify.slice().sort(byScore),asn=P5.assess.slice().sort(byScore),mgd=managed.slice().sort(byScore),mnd=monAll.slice().sort(byScore);
  h+=lane('Identify','#1E6E6E',badge(idn.length+(idn.length===1?' item':' items'),'#1E6E6E'),'',idn.length?cols(idn):'<div class="gd-none">No items yet.</div>');
  h+=lane('Assess','#C8860A',badge(asn.length+(asn.length===1?' item':' items'),'#C8860A'),'',asn.length?cols(asn):'<div class="gd-none">No items yet.</div>');
  h+=lane('Manage &amp; Monitor','#9B2D3F',badge(mgd.length+' managed','#9B2D3F')+badge(mnd.length+' monitored','#3A8B8B'),_needsAtt?('<div class="gd-warn">\u26a0 '+_needsAtt+' need attention</div>'):'',
    (mgd.length||mnd.length)?('<div class="gd-subh" style="color:#9B2D3F">Managed ('+mgd.length+')</div>'+(mgd.length?cols(mgd):'<div class="gd-none">None.</div>')+'<div class="gd-subh" style="color:#3A8B8B">Monitored ('+mnd.length+')</div>'+(mnd.length?cols(mnd):'<div class="gd-none">None.</div>')):'<div class="gd-none">No items yet.</div>'); /* 14 Sep 2026 (Paul's ruling): managed and monitored as two sublists under their own headings, so the distinction survives a black-and-white print */
  h+=lane('Emergency Response','#B03030',badge(P5.emergency.length+(P5.emergency.length===1?' escalation':' escalations'),'#B03030'),'',P5.emergency.length?cols(P5.emergency):'<div class="gd-none">No items yet.</div>');
  var _regm={};var _reg=[];(data.risks||[]).forEach(function(r){var c=cardClass(r);if(inIdentifyBucket(r)||inAssessBucket(r)||c==='manage'||c==='monitor'){_regm[r.id]=1;_reg.push(r)}});(P5.emergency||[]).forEach(function(r){if(!_regm[r.id]){_regm[r.id]=1;_reg.push(r)}});
  h+='<div class="gd-sub" style="break-before:page;page-break-before:always;margin-top:0">Risk Portfolio at a Glance</div>'; /* 14 Sep 2026 (Paul's ruling): on a page of its own */
  h+='<div class="analytics-grid-2">'+govStageDonut(P5,monAll,managed)+govCategoryCard(_reg)+'</div>';
  h+=vizHeatMap(_reg,'Risk Register Heat Map'); /* returns its own card */
  h+='<div style="display:flex;gap:18px;margin:12px 0 0;font-size:13px;color:#555"><span><strong style="font-size:16px;color:#111">'+(data.risks||[]).length+'</strong> '+((data.risks||[]).length===1?'total risk identified':'total risks identified')+'</span><span><strong style="font-size:16px;color:#111">'+_reg.length+'</strong> on the register</span><span><strong style="font-size:16px;color:#111">'+((data.risks||[]).length-_reg.length)+'</strong> archived</span></div>';
  /* the RACI matrix on a landscape page of its own (14 Sep 2026, Paul's ruling): the matrix alone, read-only; the team editor does not print */
  if(typeof ensureGovRaciModel==='function')ensureGovRaciModel(); /* the matrix's model is built on first use, as the RACI output builds it */
  if((data.raciActs||[]).length)h+='<div class="gd-raci" style="page:gdraci;break-before:page;page-break-before:always"><div class="gd-sec">RACI Matrix</div>'+govRaciGrid(true)+'</div><style>@page gdraci{size:landscape}.gd-raci{width:940px;margin-left:calc(50% - 470px)}.gd-raci table{font-size:12px}.gd-raci th,.gd-raci td{padding:5px 6px}</style>';
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 90.

---

### Step 66 — Replace the function that draws the Governance Dashboard page.

**Kind:** Replace existing code.

**Where:** Find the function named `renderDashboardContent`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderDashboardContent(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* addendum 207 correction: the pair relocated to top level — vizHealthGauge had been a nested definition inside renderDashboardContent, so the hoisted card threw on the Analytics page */
function renderDashboardContent(){
var risks=data.risks||[];var systems=data.systems||[];var gr=data.govRhythm||{};var rc=data.reviewCadence||{};
var P5=getPortfolios();
var managed=P5.manage.filter(function(r){return cardClass(r)==='manage'});
var monAll=P5.manage.filter(function(r){var c=cardClass(r);return c==='monitor'});
/* dead enhN local deleted 16 Aug 2026 (orphan of the retired Monitor Enh. lane) */
var ethical=risks.filter(function(r){return isLiveRisk(r)&&isEthDesignated(r)});
var arch=P5.archived;
var archDismissed=arch.filter(function(r){return !!r.dismissed});
var archAccepted=arch.filter(function(r){return r.resolution&&r.resolution.type==='accepted \u2014 no action'});
var archResolved=arch.filter(function(r){return r.resolution&&r.resolution.type!=='accepted \u2014 no action'});
var archEth=arch.filter(function(r){return ethStatusOf(r)==='confirmed'});
var pipeCounts={identified:P5.identify.length,assessed:P5.assess.length,managed:P5.manage.length,resolved:P5.emergency.length};

// If activeView is set, show filtered risk list
if(UI.activeView){
var viewTitle={manage:'Manage Classification',monitor:'Monitor Classification',ethical:'Responsible AI Risks','arch-dismissed':'Archive \u2014 Dismissed','arch-accepted':'Archive \u2014 Accepted, no action','arch-resolved':'Archive \u2014 Resolved','arch-ethical':'Archive \u2014 Ethical exits'};
var filtered=[];
if(UI.activeView==='manage')filtered=managed;
else if(UI.activeView==='monitor')filtered=monAll;
else if(UI.activeView==='ethical')filtered=ethical;
else if(UI.activeView==='arch-dismissed')filtered=archDismissed;
else if(UI.activeView==='arch-accepted')filtered=archAccepted;
else if(UI.activeView==='arch-resolved')filtered=archResolved;
else if(UI.activeView==='arch-ethical')filtered=archEth;
var h='<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">'+btnG('\u2190 Dashboard','UI.activeView=null;render()','color:var(--t-teal2);font-weight:600')+'<h2 class="h-section">'+(viewTitle[UI.activeView]||UI.activeView)+'</h2>'+badge(filtered.length+' risk'+(filtered.length!==1?'s':''),'#2A5A5A')+btnAdd('+ Add Risk','showRiskForm(\'internal\')',null,'font-size:13px;padding:6px 14px;margin-left:auto')+'</div>';
if(UI.showRiskForm&&!UI.editRisk)h+=renderRiskForm();
if(!filtered.length)h+=card('<p style="text-align:center;color:var(--text-body);font-size:14px">No risks in this view.</p>','background:rgba(var(--fg-rgb),.03)');
filtered.sort(function(a,b){return compositeOf(b)-compositeOf(a)}).forEach(function(r){var cat=POSTI.find(function(p){return p.key===r.category})||{color:'var(--text-faint)',name:r.category||''};
if(String(UI.activeView).indexOf('arch-')===0){
var line=r.dismissed?('Dismissed \u2014 '+esc(r.dismissed.reason||'')+' <span style="color:var(--text-faint)">('+esc(r.dismissed.by||'')+', '+fmt(r.dismissed.at)+')</span>'):(r.resolution?(esc(r.resolution.type||'resolved')+(r.resolution.rationale?' \u2014 '+esc(r.resolution.rationale):'')+' <span style="color:var(--text-faint)">('+esc(r.resolution.by||'')+', '+fmt(r.resolution.at)+')</span>'):'Archived');
var _k='dsha'+r.id;var _o=!!UI.expanded[_k];var _bl=r.dismissed?'Dismissed':(r.resolution?(String(r.resolution.type||'').indexOf('accepted')===0?'Accepted':'Resolved'):'Archived');
var _hd='<div class="xh" onclick="event.stopPropagation();UI.expanded[\''+_k+'\']='+(!_o)+';render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--text-faint);font-size:15px">'+(_o?'\u25be':'\u25b8')+'</span><div style="flex:1;min-width:0"><h4 class="h-card" style="margin:0">'+esc(r.name)+'</h4>'+pfSysLine(r)+'</div>'+pfEthFlag(r)+badge(_bl,'#6B7F8D')+pfScoreCell(r)+'</div>';
var _bd='';
if(_o){_bd='<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)" onclick="event.stopPropagation()"><p style="font-size:12px;color:var(--text-muted);margin:0 0 10px">'+line+'</p>'+riskCardFold(r,'dshrc')+riskTestFold(r,'dshtf')+'<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+btnS('Revive','reviveRisk(\''+r.id+'\')','#3A8B8B','font-size:12px;padding:4px 10px')+'</div></div>'}
h+=card(_hd+_bd,'border-left:4px solid #6B7F8D;margin-bottom:10px'+(_o?'':';cursor:pointer'),xpandAttr(_k,_o));
}else{
h+=idCardRow(r,'dash');
if(UI.wbOpen===r.id)h+=workbench(r);
}});
return h}

// Main dashboard view
var h='<div class="mb-6">'+badge('Govern \xb7 Ongoing','#2A5A5A')+'<h1 class="section-title u-967e19d">Governance <em>Dashboard</em></h1><p class="u-98b80d8">Your operational governance hub. Click any lane, tile, or card to manage it in place.</p></div>';/* item 63: donor hero grammar; the var(--paper) light-on-light lead dies with it */

h+=govCoverageCard();/* addendum 207: hoisted — one definition on the dashboard and the Analytics page */
h+='<h2 style="font-size:22px;font-weight:800;margin:26px 0 16px">Governance Overview</h2>';/* addendum 205 (17 Aug 2026 morning, Paul's ruling): the dashboard restructure \u2014 Program Coverage stays on top; Governance Overview carries the review cards, the AI Systems and Responsible AI Principles folds, and the Testing Center; Risk Management carries the emergency alert, the chevrons, the portfolios, and the glance block; Team Load closes the page */
// Meeting cards
h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:24px">';
h+=card('<div class="u-49c8739" style="color:#1E6E6E;line-height:1.35;min-height:38px">Next New Risk Review</div><div class="u-ac07cd3" style="color:#1E6E6E">'+(rc.reviewFrequency?rc.reviewFrequency.charAt(0).toUpperCase()+rc.reviewFrequency.slice(1):'Not scheduled')+'</div><div style="font-size:13px;color:var(--text-faint);margin-top:4px">'+(rc.firstReviewDate||'Date not set')+'</div>'/* round 29: attendees line retired by ruling; the duration line was cross-wired to gr.meetingDuration and is retired with it */+'<div style="margin-top:8px">'+btn('\u25b6 Run the review','UI.riskReviewHdr=true;goModule(\'pf-identify\')','#1E6E6E','font-size:12px;padding:6px 14px')+'</div>'+'<div style="margin-top:auto;padding-top:12px;text-align:center"><button class="btn-ghost pad-chip-sm" style="font-size:11px;padding:3px 10px" onclick="UI.dashManage=UI.dashManage===\'cadence\'?null:\'cadence\';render()">'+(UI.dashManage==='cadence'?'\u25be Close':'\u25b8 Settings')+'</button></div>'+'','background:rgba(30,110,110,.06);border:1px solid rgba(30,110,110,.3);display:flex;flex-direction:column');/* R-8 (Paul, 21 July): time, length, people \u2014 no action; the risk review runs through the portfolios. Round-19 theme: teal through every element. */
var _eb=((data.ethicalFramework||{}).board)||{};
h+=card('<div class="u-49c8739" style="color:#7B4F8A;line-height:1.35;min-height:38px">Next Responsible AI Board Review</div><div class="u-ac07cd3" style="color:#7B4F8A">'+(_eb.cadence?esc(_eb.cadence.charAt(0).toUpperCase()+_eb.cadence.slice(1)):'Not scheduled')+'</div><div style="font-size:13px;color:var(--text-faint);margin-top:4px">'+(_eb.nextReview||'Date not set')+'</div><div style="margin-top:8px">'+btn('\u25b6 Run the review','UI.ethReviewHdr=true;UI.ethRevTicks=null;UI.ethRevLogged=false;UI.ethRevNotes=null;go(\'ethicsov\')','#7B4F8A','font-size:12px;padding:6px 14px')+'</div>'+'<div style="margin-top:auto;padding-top:12px;text-align:center"><button class="btn-ghost pad-chip-sm" style="font-size:11px;padding:3px 10px" onclick="UI.dashManage=UI.dashManage===\'ethboard\'?null:\'ethboard\';render()">'+(UI.dashManage==='ethboard'?'\u25be Close':'\u25b8 Settings')+'</button></div>','background:rgba(123,79,138,.06);border:1px solid rgba(123,79,138,.3);display:flex;flex-direction:column');/* R-8: routes to the Responsible AI Overview section below, where the date is set. Round-19 theme: Responsible-AI purple through every element. */
h+=card('<div class="u-49c8739" style="color:#9B2D3F;line-height:1.35;min-height:38px">Next Governance Review</div><div class="u-ac07cd3" style="color:#9B2D3F">'+(gr.govFrequency?(gr.govFrequency==='biannual'?'Twice a year':gr.govFrequency.charAt(0).toUpperCase()+gr.govFrequency.slice(1)):'Not scheduled')+'</div><div style="font-size:13px;color:var(--text-faint);margin-top:4px">'+(gr.firstMeeting||'Date not set')+'</div><div style="margin-top:8px">'+btn('\u25b6 Run the review','go(\'govreview\')','#9B2D3F','font-size:12px;padding:6px 14px')+'</div>'+'<div style="margin-top:auto;padding-top:12px;text-align:center"><button class="btn-ghost pad-chip-sm" style="font-size:11px;padding:3px 10px" onclick="UI.dashManage=UI.dashManage===\'rhythm\'?null:\'rhythm\';render()">'+(UI.dashManage==='rhythm'?'\u25be Close':'\u25b8 Settings')+'</button></div>'+'','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3);display:flex;flex-direction:column');/* R-8: the donor form \u2014 the pipeline\'s Run Quarterly Review routes to its 4.4. Round-16 donor tint + filled button. */
h+='</div>';


if(UI.dashManage==='cadence')h+=card('<h3 class="h-sub-lg" style="color:#1E6E6E;margin-top:0">New Risk Review Settings</h3>'+cadenceFields()+'<div style="margin-top:8px">'+btn('Save','saveRC()','#1E6E6E','font-size:13px;padding:8px 18px')+'</div>','border:1px solid rgba(30,110,110,.3);margin-bottom:16px');
if(UI.dashManage==='rhythm')h+=card('<h3 class="h-sub-lg" style="color:#9B2D3F;margin-top:0">Governance Review Settings</h3>'+rhythmFields(true)+'<div style="margin-top:8px">'+btn('Save','saveGR()','#9B2D3F','font-size:13px;padding:8px 18px')+'</div>','border:1px solid rgba(155,45,63,.3);margin-bottom:16px');
if(UI.dashManage==='ethboard'){(function(){var ef=data.ethicalFramework||{};var bd=ef.board||{};var mems=bd.members||[];
h+=card('<h3 class="h-sub-lg" style="color:#7B4F8A;margin-top:0">Responsible AI Review Board Settings</h3>'
+card('<h3 style="font-size:16px;font-weight:700;margin:0 0 12px">Meeting & Review Cadence</h3>'+sel('Cadence','bd_cadence',bd.cadence,[{v:'',l:'Select...'},{v:'biweekly',l:'Every two weeks'},{v:'monthly',l:'Monthly'},{v:'quarterly',l:'Quarterly'},{v:'custom',l:'Custom rhythm'}])+inp('Cadence detail (optional)','bd_cadenceDetail',bd.cadenceDetail,'e.g., checked at the monthly review; a standalone deep review each quarter'))
+card('<h3 style="font-size:16px;font-weight:700;margin:0 0 12px">Board Members</h3>'
+mems.map(function(m,i){return '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><input id="bm_'+i+'_name" value="'+esc(m.name||'')+'" placeholder="Name" style="flex:1;padding:8px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:13px;font-family:inherit"/><input id="bm_'+i+'_role" value="'+esc(m.role||'')+'" placeholder="Role" style="flex:2;padding:8px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:13px;font-family:inherit"/><select id="bm_'+i+'_ext" style="padding:6px 8px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg-elev);color:var(--paper)"><option value="internal"'+(m.external?'':' selected')+'>Internal</option><option value="external"'+(m.external?' selected':'')+'>External</option></select><button onclick="removeBoardMember('+i+')" style="background:none;border:none;cursor:pointer;color:var(--text-faint)">\u00d7</button></div>'}).join('')
+'<div style="margin:4px 0 12px">'+btnAdd('+ Add Member','addBoardMember()',null,'font-size:13px;padding:6px 14px')+'</div>'
+'<div style="display:flex;gap:8px;align-items:center;margin:8px 0 2px;flex-wrap:wrap"><label style="font-size:12px;color:var(--text-faint)">Next review date</label><input type="date" id="eb_nextReview" value="'+esc(bd.nextReview||'')+'" style="padding:4px 8px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:12px;font-family:inherit;background:rgba(var(--fg-rgb),.02)"/></div>')
+card('<h3 style="font-size:16px;font-weight:700;margin:0 0 8px">Extraordinary Meeting Criteria</h3><p style="font-size:12px;color:var(--text-faint);margin:0 0 10px">What brings the board together outside its regular cadence?</p>'+escCriteriaRows(bd))/* round 43: its own card, by ruling */
+'<div style="margin-top:8px">'+btn('Save','harvestEF();saveEF();saveEthBoardDate()','#7B4F8A','font-size:13px;padding:8px 18px')+'</div>','border:1px solid rgba(123,79,138,.3);margin-bottom:16px')})()}

if(systems.length){var _sOpen=!!UI.expanded.dashSys;/* addendum 144 (15 Aug 2026, ruled): the standing systems list \u2014 above the glance, prominent, a direct mirror of the 4.3 review list (Rollout item 65 corollary) */
h+=card('<div id="dashSysCard" onclick="UI.expanded.dashSys=!UI.expanded.dashSys;render()" style="display:flex;align-items:center;gap:12px;cursor:pointer"><span style="color:var(--text-faint);font-size:16px">'+(_sOpen?'\u25be':'\u25b8')+'</span><div style="flex:1;min-width:0"><h3 style="font-size:18px;font-weight:800;margin:0">AI Systems</h3><p style="font-size:13px;color:var(--text-muted);margin:2px 0 0">The standing systems list \u2014 every record, its risks, its plans, and its lifecycle.</p></div>'+badge(systems.filter(function(s){return s&&!s.archived}).length+(systems.filter(function(s){return s&&!s.archived}).length===1?' system':' systems'),'#1E6E6E')+'</div>'+(_sOpen?'<div style="margin-top:14px" onclick="event.stopPropagation()">'+eoSysRows()+'<div style="margin-top:10px">'+btnAdd('+ Add System','UI.showSysForm=true;UI.editSys=null;render()',null,'font-size:13px;padding:6px 14px')+'</div>'+(UI.showSysForm&&!UI.editSys?'<div style="margin-top:10px">'+renderSystemForm()+'</div>':'')+'</div>':''),'border-top:4px solid #1E6E6E;margin-bottom:24px'+(_sOpen?'':';cursor:pointer'))}
var _rOpen=!!UI.expanded.dashEthReg;
h+=card('<div onclick="UI.expanded.dashEthReg=!UI.expanded.dashEthReg;render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--text-faint);font-size:15px">'+(_rOpen?'\u25be':'\u25b8')+'</span><h3 class="h-sub-lg" style="margin:0;color:#7B4F8A">Register of Responsible AI Principles ('+(((data.ethicalFramework||{}).principles)||[]).length+')</h3></div>'+(_rOpen?'<div style="margin-top:10px" onclick="event.stopPropagation()">'+principleRegisterBody()+'</div>':''),'margin-bottom:24px'+(_rOpen?'':';cursor:pointer'));/* round 45 (Paul's ruling): the register's dashboard home \u2014 the glance bar, expanding in place like the systems bar */
// round 64: the Testing Center square \u2014 summary state, one click to the standing page
var _tcL=(systems||[]).filter(function(s){return !sysExitState(s)});var _tcT=0,_tcD=0,_tcE=0,_tcO=0;_tcL.forEach(function(s){var ts=((s.testingPlan||{}).tests)||[];_tcT+=ts.length;_tcD+=ts.filter(function(t){return (t.test||'').trim()}).length;_tcE+=(s.testEvidence||[]).length;_tcO+=ts.filter(function(t){return testState(s,t)==='overdue'}).length});
h+=card('<h3 class="h-sub-lg" style="margin:0 0 6px">Testing Center</h3><p style="font-size:13px;color:var(--text-muted);margin:0 0 10px">The standing home of system compliance testing and risk testing.</p>'+btnG('Open the Testing Center','go(\'step\',\'5.3\')','font-size:12px;padding:5px 14px'));
h+='<h2 style="font-size:22px;font-weight:800;margin:26px 0 16px">Risk Management</h2>';
// Escalated counter lights the dashboard (E-0 / A-1)
if(pipeCounts.resolved>0)h+=card('<div onclick="goModule(\'pf-emergency\')" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="font-size:18px">\u26a0</span><strong style="font-size:15px;color:#9B2D3F">'+pipeCounts.resolved+' escalated \u2014 Emergency Response is live</strong><span style="margin-left:auto;font-size:13px;color:var(--text-faint)">open \u2192</span></div>','border:2px solid #9B2D3F;margin-bottom:16px');
// Risk pipeline (clickable)
h+='<div style="margin-bottom:24px">'+riskViz(null,{identified:'pf-identify',assessed:'pf-assess',managed:'pf-manage',resolved:'pf-emergency'},pipeCounts)+'</div>';


/* Round 22 (Paul's rulings): the middle rebuilt to the donor model. Lanes, Systems View, Archive band,
   Active Management Required, Compliance card, Quick Stats, and Systems Health retired from this surface;
   their live signals ride the stage cards, the glance card, and the Systems card. */
var _mm=managed.concat(monAll).sort(function(a,b){return compositeOf(b)-compositeOf(a)});
var _needsAtt=managed.filter(needsLanding).length;/* _chkDue retired 16 Aug 2026 night, Paul's ruling */
var _warnMM=(_needsAtt)?('<div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 8px">'+'<span style="font-size:11px;font-weight:600;color:#C8860A">\u26a0 '+_needsAtt+' need attention</span>'+'</div>'):'';
h+='<div class="u-03ed01f">';
[{t:'Identify',c:'#1E6E6E',nav:'pf-identify',items:P5.identify.slice().sort(function(a,b){return compositeOf(b)-compositeOf(a)}),bad:badge(P5.identify.length+(P5.identify.length===1?' item':' items'),'#1E6E6E'),warn:''},
{t:'Assess',c:'#C8860A',nav:'pf-assess',items:P5.assess.slice().sort(function(a,b){return compositeOf(b)-compositeOf(a)}),bad:badge(P5.assess.length+(P5.assess.length===1?' item':' items'),'#C8860A'),warn:''},
{t:'Manage &amp; Monitor',c:'#9B2D3F',nav:'pf-manage',items:_mm,bad:badge(managed.length+' managed','#9B2D3F')+badge(monAll.length+' monitored','#3A8B8B'),warn:_warnMM},
{t:'Emergency Response',c:'#B03030',nav:'pf-emergency',items:P5.emergency,bad:badge(P5.emergency.length+(P5.emergency.length===1?' escalation':' escalations'),'#B03030'),warn:''}
].forEach(function(s){h+=card('<div class="flx-row-mb-12"><h3 style="font-size:15px;font-weight:700;color:'+s.c+';margin:0">'+s.t+'</h3><span>'+s.bad+'</span></div>'+s.warn+
s.items.slice(0,3).map(function(r){return '<div class="u-cfcd2a9"><span>'+esc(r.name)+'</span></div>'}).join('')+
(s.items.length>3?'<div class="u-b9a11b1">+'+(s.items.length-3)+' more</div>':'')+
(s.items.length===0?'<p class="u-c54d0ef">No items yet.</p>':'')+
'<div style="margin-top:auto;padding-top:12px">'+btnG('View Portfolio \u2192','goModule(\''+s.nav+'\')','font-size:11px;padding:6px 12px;width:100%')+'</div>','border-top:4px solid '+s.c+';display:flex;flex-direction:column')});
h+='</div>';
var _regm={};var _reg=[];(data.risks||[]).forEach(function(r){var c=cardClass(r);if(inIdentifyBucket(r)||inAssessBucket(r)||c==='manage'||c==='monitor'){_regm[r.id]=1;_reg.push(r)}});(getPortfolios().emergency||[]).forEach(function(r){if(!_regm[r.id]){_regm[r.id]=1;_reg.push(r)}});
h+='<div class="analytics-block">';
h+='<div class="analytics-header"><div class="analytics-eyebrow">Govern &amp; Scale \u00b7 Live</div><h2 class="analytics-title">Risk Portfolio <em>at a Glance</em></h2></div>';
h+='<div class="analytics-grid-2">'+govStageDonut(P5,monAll,managed)+govCategoryCard(_reg)+'</div>';
h+='<div class="chart-card">'+vizHeatMap(_reg,'Risk Register Heat Map')+'</div>';
h+='<div style="display:flex;gap:18px;margin:12px 0 0;font-size:13px;color:var(--text-muted)"><span><strong style="font-size:16px;color:var(--text-max)">'+(data.risks||[]).length+'</strong> '+((data.risks||[]).length===1?'total risk identified':'total risks identified')+'</span><span><strong style="font-size:16px;color:var(--text-max)">'+_reg.length+'</strong> on the register</span><span><strong style="font-size:16px;color:var(--text-max)">'+((data.risks||[]).length-_reg.length)+'</strong> archived</span></div>';
h+='</div>';

/* Team Load moved to the Analytics page, Paul's ruling 17 Aug 2026 morning (addendum 207) */

h+=card('<h3 class="h-sub-lg" id="dashRaciCard">RACI Matrix</h3><p style="font-size:13px;color:var(--text-muted);margin:0 0 10px">Who is Responsible, Accountable, Consulted, and Informed for each governance activity. Changes made here update the matrix everywhere it appears.</p>'+raciTeamEditor()+govRaciGrid(false));/* ruled by Paul 22 Aug 2026: the matrix is maintainable from the operating surface */
// Data Bank with icons
var reports=[{id:'out-raci2',name:'RACI Matrix',phase:'Phase 2',color:'#8B4513',icon:'\u25a1'},{id:'out-ethicsdoc',name:'Responsible AI Framework',phase:'Phase 2',color:'#8B4513',icon:'\u25a4'},{id:'out-govfw',name:'Governance Framework',phase:'Phase 4',color:'#3D4F5C',icon:'\u25b3'},{id:'out-reglandscape',name:'Compliance Survey',phase:'Phase 1',color:'#1E6E6E',icon:'\u229c'}];
// Manage in place (Rollout 34): full step surfaces embedded; saves ride the canonical savers
/* Manage Governance section absorbed into the review boxes 31 Jul 2026 by ruling \u2014 cadence under Next Risk Review, rhythm under Next Governance Review; both save through the canonical savers. */
h+=card('<h3 class="h-sub-lg">Data Bank</h3><div class="gr-3-sm">'+reports.map(function(r){return'<button onclick="goModule(\''+r.id+'\')" class="u-355061e"><div style="font-size:22px;line-height:1;margin-bottom:8px;color:'+r.color+'">'+r.icon+'</div><div style="font-size:13px;font-weight:600;color:'+r.color+'">'+esc(r.name)+'</div></button>'}).join('')+'</div>','background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.12)');
/* Responsible AI Overview moved to its own page 31 Jul 2026 by ruling (go('ethicsov')); the review agenda keeps its embedded read. */
return h}
```

**Check:** Open Phase 5, step 5.1. The page shows the same cards it showed before this step.

---

### Step 67 — Add the function that lists every logged test result.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ttSurface` ends, after its closing `}`.

**Code:**

```js
/* round 64: one surface, two hosts \u2014 the step and the Testing Center (D-4) */
function tcLogEntries(){var _tl=[];(data.systems||[]).concat((data.risks||[]).filter(function(r){return r.testEvidence})).forEach(function(hst){((hst.testEvidence)||[]).forEach(function(e){var t=((hst.testingPlan||{}).tests||[]).find(function(x){return x.id===e.testId});_tl.push({at:e.at||0,host:hst.name||'',claim:(t&&t.claim)||'',result:e.result||'',outcome:e.outcome||'',by:e.by||''})})});_tl.sort(function(a,b){return b.at-a.at});return _tl}
```

**Nothing to check yet.** This change becomes visible at Step 90.

---

### Step 68 — Replace the function that draws the Testing Center page. It now reads the log from tcLogEntries.

**Kind:** Replace existing code.

**Where:** Find the function named `renderTestCenter`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderTestCenter(){var live=(data.systems||[]).filter(function(s){return !sysExitState(s)}).concat((data.risks||[]).filter(function(r){return r.ttStage}));
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* round 73: both hosts \u2014 the compliance track and the workbench risks; hoisted 14 Sep 2026 */
function renderTestCenter(){var live=(data.systems||[]).filter(function(s){return !sysExitState(s)}).concat((data.risks||[]).filter(function(r){return r.ttStage}));
var _tl=tcLogEntries(); /* 14 Sep 2026: the log's computation hoisted to tcLogEntries, one definition the page and its printout both read */var T=0,D=0,E=0,O=0;live.forEach(function(s){var ts=((s.testingPlan||{}).tests)||[];T+=ts.length;D+=ts.filter(function(t){return (t.test||'').trim()}).length;E+=(s.testEvidence||[]).length;O+=ts.filter(function(t){return testState(s,t)==='overdue'}).length});
var h='<h2 class="h-section">Testing Center</h2><p class="t-lead">The standing home of everything Step 3.3 sets up \u2014 both tracks, always available. New systems get their compliance testing here, risks can be brought into risk testing here, and every result is logged here.</p>';
if(_tl.length){h+=card('<div onclick="UI.expanded.tcLog=!UI.expanded.tcLog;render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="font-size:13px;color:var(--text-faint)">'+(UI.expanded.tcLog?'\u25be':'\u25b8')+'</span><h3 style="font-size:15px;font-weight:700;margin:0;flex:1">Testing log ('+_tl.length+')</h3><span style="font-size:12px;color:var(--text-faint)">Every logged test result, newest first</span></div>'+(UI.expanded.tcLog?'<div style="margin-top:10px">'+_tl.map(function(e){return '<div style="padding:7px 0;border-top:1px solid rgba(var(--fg-rgb),.05);font-size:13px"><span style="color:var(--text-faint)">'+(e.at?new Date(e.at).toISOString().split('T')[0]:'')+'</span> \u00b7 <strong>'+esc(e.host)+'</strong> \u00b7 '+esc(e.claim)+(e.result?' \u00b7 '+esc(e.result):'')+(e.outcome?' \u00b7 <strong>'+esc(e.outcome)+'</strong>':'')+(e.by?' <span style="color:var(--text-faint)">\u00b7 '+esc(e.by)+'</span>':'')+'</div>'}).join('')+'</div>':''),'margin-bottom:16px');}/* addendum 138 (15 Aug 2026, ruled): the testing log \u2014 the reference for review agenda item 4 *//* round 80 (Paul's ruling): no summary numbers */
h+=ttSurface();return h}
```

**Check:** Open Phase 5, step 5.3 (Testing Center). The Testing log line at the bottom of the page opens on click and lists the same results it listed before this step.

---

### Step 69 — Add the function that builds the Testing Center's printed document, ending with the testing log.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `dashboardDoc` ends, after its closing `}`. You added that function in Step 65.

**Code:**

```js
/* TESTING CENTER DOCUMENT (14 Sep 2026, Paul's ruling): the Testing & Evidence document, then the testing log on a page of its own — every logged result, newest first, as a table */
function testingCenterDoc(){var log=tcLogEntries();
  var h=PRINT_DOCS['out-testing']();
  h+='<div style="break-before:page;page-break-before:always"><div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111">Testing Log <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+log.length+'</span></div>';
  if(!log.length)h+='<div style="font-size:13px;color:#666;font-style:italic;padding:8px 0">No test results logged yet.</div>';
  else{h+='<table style="width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.45"><thead><tr>'+['Date','System or risk','Test','Outcome','Found','Recorded by'].map(function(t,i){return '<th style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;text-align:left;padding:4px 6px;border-bottom:1px solid #111;'+(i===0?'width:13%':i===1?'width:18%':i===3?'width:11%':i===5?'width:13%':'')+'">'+t+'</th>'}).join('')+'</tr></thead><tbody>';
    log.forEach(function(e){h+='<tr style="break-inside:avoid;page-break-inside:avoid">'+[e.at?lyDate(e.at):'',e.host,e.claim,e.outcome,e.result,e.by].map(function(v){var t=lyCap(String(v||''));return '<td style="padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top">'+(t?esc(t):'<span style="color:#999">Not recorded</span>')+'</td>'}).join('')+'</tr>'});
    h+='</tbody></table>'}
  return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 90.

---

### Step 70 — Add the function that reads the Summary / Full choice for a Compliance Dashboard tab.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `testingCenterDoc` ends, after its closing `}`. You added that function in Step 69.

**Code:**

```js
/* COMPLIANCE DASHBOARD DOCUMENTS (14 Sep 2026, Paul's ruling): each tab prints its own document through one Save as PDF control, and a Summary / Full choice sitting immediately above that control sets the printout's depth without changing anything on the page. Tab one prints the conformance report (or, when another regime is selected, that regime's record); tab two the Compliance Register on the Compliance Survey's pattern; tab three the Compliance Obligations on the Phase 2 output's pattern. The old Export Conformance Report button is gone; everything prints through Save as PDF. */
function cdPrintDepth(tab){var d=UI.cdPrintDepth||{};return d[tab]||'summary'}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 71 — Add the function that sets the Summary / Full choice for a Compliance Dashboard tab.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `cdPrintDepth` ends, after its closing `}`. You added that function in Step 70.

**Code:**

```js
function cdSetPrintDepth(tab,v){UI.cdPrintDepth=UI.cdPrintDepth||{};UI.cdPrintDepth[tab]=v;render()}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 72 — Add the function that draws the print controls on a Compliance Dashboard tab.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `cdSetPrintDepth` ends, after its closing `}`. You added that function in Step 71.

**Code:**

```js
function cdPrintBlock(){if(UI._printing)return '';var tab=UI.cdTab||'dash';var d=cdPrintDepth(tab);
  return '<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 14px"><div style="display:inline-flex;flex-direction:column;align-items:flex-end;gap:6px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:8px"><span style="display:inline-flex;gap:4px;align-items:center"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">PRINT DEPTH</span>'+['summary','full'].map(function(k){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(d===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="cdSetPrintDepth(\''+tab+'\',\''+k+'\')">'+(k==='summary'?'Summary':'Full')+'</button>'}).join('')+'</span><button class="btn bg2" style="font-size:12px" onclick="printComplianceTab()">\u25be Save as PDF</button></div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 73 — Add the function that builds the two-line title page of a conformance report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `cdPrintBlock` ends, after its closing `}`. You added that function in Step 72.

**Code:**

```js
function cdConformanceCover(forName,lead){ /* 14 Sep 2026 (Paul's ruling): every conformance report's cover reads Conformance Report on one line and, in the same face and weight, what it is for on the next — NIST AI RMF 1.0, or the regime's name */
  var T='font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px';var one='<div style="'+T+'">Conformance Report</div>';
  var c=printDocCover('Conformance Report',lead,'');if(c.indexOf(one)<0)return c;
  return c.replace(one,'<div style="'+T.replace('margin:0 0 14px','margin:0')+'">Conformance Report</div><div style="'+T+'">'+esc(forName)+'</div>')}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 74 — Add the function that prints the Compliance Dashboard tab that is showing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `cdConformanceCover` ends, after its closing `}`. You added that function in Step 73.

**Code:**

```js
function printComplianceTab(){var tab=UI.cdTab||'dash';var t={dash:'Conformance Report',reg:'Compliance Register',obl:'Compliance Obligations'}[tab]||'Compliance Dashboard';
  if(tab==='dash'){var cur=UI.cdRegime||'reg-nist';var g=(data.regimes||[]).find(function(x){return x.id===cur});t='Conformance Report \u2014 '+((g&&g.name)||'NIST AI RMF 1.0')}
  printPage(t,complianceTabDoc(tab,cdPrintDepth(tab)))}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 75 — Add the function that builds the printed document for a Compliance Dashboard tab.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printComplianceTab` ends, after its closing `}`. You added that function in Step 74.

**Code:**

```js
function complianceTabDoc(tab,depth){var regs=data.regimes||[];var full=(depth==='full');
  var applies=function(g){return !!(g.scoping&&g.scoping.judgment==='applies')};
  if(tab==='reg'){var comp=regs.filter(applies),pend=regs.filter(function(g){return !applies(g)});
    return printDocCover('Compliance Register','Every regime scoped in, with its scoping judgment; the regimes still awaiting a judgment follow.','')+lyRegister('regime',regs,full?'full':'summary',full?null:0,[{name:'Compliance Register',list:comp},{name:'Awaiting scoping',list:pend}])} /* summary: the scoping layer, as the Compliance Survey prints; full: every live layer of every regime */
  if(tab==='obl'){return printDocCover('Compliance Obligations','Every regime on the Compliance Register with its obligations, their status, and their evidence.','')+lyRegister('regime',regs.filter(applies),depth,null)}
  var cur=UI.cdRegime||'reg-nist';
  if(cur!=='reg-nist'){var g=regs.find(function(x){return x.id===cur});if(g)return cdConformanceCover(g.name||'Regime','The regime as the Compliance Dashboard shows it: its scoping, its obligations, and its review.')+lyRegister('regime',[g],depth,null)}
  return conformanceDoc(depth)}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 76 — Add the function that builds the NIST conformance report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `complianceTabDoc` ends, after its closing `}`. You added that function in Step 75.

**Code:**

```js
function conformanceDoc(depth){ /* the NIST AI RMF conformance view as a document. Summary: the four function cards and, per function, the subcategories listed by status. Full: the four cards and, per function, every subcategory with what NIST asks, where the work lives, and its status. */
  var full=(depth==='full');var fns=['GOVERN','MAP','MEASURE','MANAGE'];
  var css='<style>.cf-fn4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}.cf-fn{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;break-inside:avoid;page-break-inside:avoid}.cf-fn-k{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.15em;text-transform:uppercase}.cf-fn-n{font-size:22px;font-weight:700;color:#111}.cf-fn-n span{font-size:12px;color:#666;font-weight:400}.cf-fn-p{font-size:11px;color:#C8860A;min-height:14px}.cf-bar{height:4px;background:#eee;border-radius:2px;margin-top:8px;overflow:hidden}.cf-bar div{height:100%}.cf-sec{font-family:var(--mono,monospace);font-size:12px;letter-spacing:.15em;text-transform:uppercase;font-weight:600;margin:18px 0 8px;padding-bottom:6px;border-bottom:2px solid;break-after:avoid;page-break-after:avoid}.cf-sec span{font-family:var(--sans,sans-serif);font-size:11px;letter-spacing:0;text-transform:none;font-weight:400;color:#666;margin-left:8px}.cf-tbl{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px;line-height:1.4}.cf-tbl th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;text-align:left;padding:4px 6px;border-bottom:1px solid #111}.cf-tbl td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}.cf-tbl tr{break-inside:avoid;page-break-inside:avoid}.cf-id{font-family:var(--mono,monospace);font-size:10px;white-space:nowrap}.cf-st{font-family:var(--mono,monospace);font-size:9.5px;font-weight:600}.cf-ev{font-size:9.5px;color:#555;font-weight:400;margin-top:2px}.cf-sum{font-size:12px;line-height:1.6;margin:0 0 6px}.cf-sum b{font-family:var(--mono,monospace);font-size:10.5px;font-weight:600;margin-right:6px}.cf-note{font-size:10.5px;color:#555;line-height:1.55;margin:18px 0 0}.cf-note em{display:block;margin-top:6px}</style>';
  var nist=(data.regimes||[]).find(function(x){return x.id==='reg-nist'});
  var h=cdConformanceCover((nist&&nist.name)||'NIST AI RMF 1.0','What each subcategory asks, where work of that kind lives in this program, and whether it is addressed.')+css+'<div class="cf-doc">';
  var STL={achieved:['Addressed','#1B6B5A'],progress:['In progress','#C8860A'],open:['Open','#666']};
  var cards='',sections='';
  fns.forEach(function(fn){var subs=NIST_SUBCATS.filter(function(sc){return sc.indexOf(fn+' ')===0});var st={};subs.forEach(function(sc){st[sc]=nistSubStatus(sc)});
    var ach=subs.filter(function(sc){return st[sc].s==='achieved'}),prog=subs.filter(function(sc){return st[sc].s==='progress'}),open=subs.filter(function(sc){return st[sc].s!=='achieved'&&st[sc].s!=='progress'});
    var pct=subs.length?Math.round(ach.length/subs.length*100):0;var c=NIST_FN_COLORS[fn];
    cards+='<div class="cf-fn" style="border-top-color:'+c+'"><div class="cf-fn-k" style="color:'+c+'">'+fn+'</div><div class="cf-fn-n">'+ach.length+'<span> / '+subs.length+' addressed</span></div><div class="cf-fn-p">'+(prog.length?prog.length+' in progress':'')+'</div><div class="cf-bar"><div style="width:'+pct+'%;background:'+c+'"></div></div></div>';
    sections+='<div class="cf-sec" style="color:'+c+';border-color:'+c+'">'+fn+'<span>'+subs.length+' subcategories \u00b7 '+ach.length+' addressed \u00b7 '+prog.length+' in progress \u00b7 '+open.length+' open</span></div>';
    if(!full){var ids=function(list){return list.length?list.map(function(sc){return esc(sc.replace(fn+' ',''))}).join(', '):'None'};
      sections+='<div class="cf-sum"><b style="color:#1B6B5A">ADDRESSED</b>'+ids(ach)+'</div><div class="cf-sum"><b style="color:#C8860A">IN PROGRESS</b>'+ids(prog)+'</div><div class="cf-sum"><b style="color:#666">OPEN</b>'+ids(open)+'</div>'}
    else{sections+='<table class="cf-tbl"><thead><tr><th style="width:13%">Subcategory</th><th style="width:38%">What NIST asks</th><th style="width:35%">Where the work lives</th><th style="width:14%">Status</th></tr></thead><tbody>';
      subs.forEach(function(sc){var x=st[sc];var sg=NIST_SIGN[sc]||{};var L=STL[x.s]||STL.open;
        sections+='<tr><td class="cf-id" style="color:'+c+'">'+esc(sc)+'</td><td>'+esc(NIST_DESC[sc]||'')+'</td><td>'+esc(sg.s||'')+(sg.o?' <span style="color:#666">\u2014 outside: '+esc(sg.o)+'</span>':'')+(x.steps&&x.steps.length?'<div class="cf-ev">Steps '+x.steps.map(esc).join(', ')+'</div>':'')+'</td><td class="cf-st" style="color:'+L[1]+'">'+L[0]+(x.ev?'<div class="cf-ev">'+esc(lyCap(x.ev))+'</div>':'')+'</td></tr>'});
      sections+='</tbody></table>'}});
  h+='<div class="cf-fn4">'+cards+'</div>'+sections;
  h+='<div class="cf-note">Reference: NIST AI 100-1, Artificial Intelligence Risk Management Framework (AI RMF 1.0), January 2023, and the NIST AI RMF Playbook. The AI RMF is voluntary and this mapping is a self-assessment aid, not a certification. The framework is under revision \u2014 re-validate against AI RMF 2.0 upon release. This program holds plans, records, and decisions; the work itself happens in the organization, and each row names where that work lives.<em>This report signposts and records. It does not assert compliance with any framework or regulation, and nothing here is legal advice.</em></div></div>';
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 77.

---

### Step 77 — Replace the function that draws the Compliance Dashboard page. Each tab gains its own print controls; the Export Conformance Report button is removed.

**Kind:** Replace existing code.

**Where:** Find the function named `renderComplianceDashboard`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderComplianceDashboard(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function renderComplianceDashboard(){
var h='';
if(!data.nistCert)data.nistCert={};
var itemized=[{id:'reg-nist',name:'NIST AI RMF (72 rows)'}].concat((data.regimes||[]).filter(function(g){return g.id!=='reg-nist'&&(g.obligations||[]).length>0}).map(function(g){return {id:g.id,name:g.name}}));
var cur=UI.cdRegime||'reg-nist';if(!itemized.some(function(x){return x.id===cur}))cur='reg-nist';
h+='<h2 class="h-section">Compliance Dashboard</h2>';
if(!UI.cdTab)UI.cdTab='dash';/* addendum 139 (15 Aug 2026, ruled): 5.2 is the standing home of the compliance registers \u2014 the phase-5 surfaces run the program after the 90 days; the register tabs are the same bodies 2.4 renders, one store */
h+='<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+[['dash','Dashboard'],['reg','Compliance Register'],['obl','Compliance Obligations']].map(function(t){return '<button class="btn '+(UI.cdTab===t[0]?'bp':'bs')+'" onclick="harvestOpenFields();UI.cdTab=\''+t[0]+'\';UI.regOpen=null;render()">'+t[1]+'</button>'}).join('')+'</div>';
h+=cdPrintBlock(); /* 14 Sep 2026 (Paul's ruling): one Save as PDF per tab, with the printout's Summary / Full choice above it */
if(UI.cdTab==='reg'){h+=regimeRegisterBody();return h}
if(UI.cdTab==='obl'){h+=renderOblTab();return h}
if(itemized.length>1){h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
itemized.forEach(function(x){h+='<button onclick="UI.cdRegime=\''+x.id+'\';render()" style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border:'+(cur===x.id?'2px solid #2A5A5A':'1px solid rgba(var(--fg-rgb),.12)')+';background:rgba(var(--fg-rgb),.03);color:'+(cur===x.id?'#2A5A5A':'var(--text-body)')+'">'+esc(x.name)+'</button>'});
h+='</div>'}
if(cur!=='reg-nist'){var g=(data.regimes||[]).find(function(x){return x.id===cur});if(g){h+=regimePage(g);return h}}
h+='<p class="t-lead">NIST AI RMF 1.0, the worked example of full itemization: one regime\'s detail page. Three things live in separate columns and are deliberately kept apart. What NIST asks, in its own words. Where work of that kind lives in this program, with a green check recording the plain fact that the work there is done. And what you have determined \u2014 your organization\'s own judgment, made by a named person on a date, revisable with its history kept. This dashboard does not assert compliance on your behalf. It locates evidence and records your judgment.</p>';

// Summary bars
var fns=['GOVERN','MAP','MEASURE','MANAGE'];
h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">';
fns.forEach(function(fn){
var subs=NIST_SUBCATS.filter(function(sc){return sc.indexOf(fn+' ')===0});
var ach=subs.filter(function(sc){return nistSubStatus(sc).s==='achieved'}).length;
var prog=subs.filter(function(sc){return nistSubStatus(sc).s==='progress'}).length;
var pct=subs.length?Math.round(ach/subs.length*100):0;
var c=NIST_FN_COLORS[fn];
h+='<div class="cd" style="padding:16px"><div style="font-family:var(--mono);font-size:12px;letter-spacing:.15em;color:'+c+';text-transform:uppercase;margin-bottom:6px">'+fn+'</div>'
+'<div style="font-size:24px;font-weight:700">'+ach+'<span style="font-size:14px;color:var(--text-faint);font-weight:400"> / '+subs.length+'</span></div>'
+(prog?'<div style="font-size:12px;color:var(--t-warn);margin-top:2px">'+prog+' in progress</div>':'<div style="font-size:12px;color:transparent;margin-top:2px">.</div>')
+'<div style="height:4px;background:rgba(var(--fg-rgb),.08);border-radius:2px;margin-top:10px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+c+'"></div></div></div>'});
h+='</div>';
// Detail tables
fns.forEach(function(fn){
var subs=NIST_SUBCATS.filter(function(sc){return sc.indexOf(fn+' ')===0});
var c=NIST_FN_COLORS[fn];
var open=UI.expanded['nist_'+fn]!==false; // default open
h+='<div class="cd" '+xpandAttr('nist_'+fn,open)+' style="margin-bottom:14px;padding:0;overflow:hidden'+(open?'':';cursor:pointer')+'">';
h+='<div class="xh xh-flush" onclick="event.stopPropagation();xpandClick(event,\'nist_'+fn+'\','+(!open)+')" style="display:flex;align-items:center;gap:10px;padding:14px 20px;cursor:pointer;border-left:3px solid '+c+'">'
+'<span style="font-size:13px;color:var(--stone)">'+(open?'\u25be':'\u25b8')+'</span>'
+'<span style="font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:'+c+';text-transform:uppercase;font-weight:600">'+fn+'</span>'
+'<span style="font-size:12px;color:var(--text-faint)">'+subs.length+' subcategories</span></div>';
if(open){
h+='<div style="padding:0 20px 16px">';
subs.forEach(function(sc){
var st=nistSubStatus(sc);
var chip=st.s==='achieved'?'<span style="font-family:var(--mono);font-size:12px;padding:3px 8px;border-radius:10px;background:rgba(27,107,90,.15);color:var(--t-good)">ADDRESSED</span>':
st.s==='progress'?'<span style="font-family:var(--mono);font-size:12px;padding:3px 8px;border-radius:10px;background:rgba(200,134,10,.15);color:var(--t-warn)">IN PROGRESS</span>':
'<span style="font-family:var(--mono);font-size:12px;padding:3px 8px;border-radius:10px;background:rgba(var(--fg-rgb),.06);color:var(--text-faint)">OPEN</span>';
var stepLinks=st.steps.map(function(sid){return'<a href="#" onclick="go(\'step\',\''+sid+'\');return false" style="color:var(--gold-text);text-decoration:none;font-family:var(--mono);font-size:12px">'+sid+'</a>'}).join(' \u00b7 ');
var sg=NIST_SIGN[sc]||{};
var cert=(data.nistCert||{})[sc];
var certLbl=cert?(cert.status==='satisfied'?'Satisfied':cert.status==='partially'?'Partially':cert.status==='na'?'N/A':'Not yet'):'\u2014';
h+='<div style="display:grid;grid-template-columns:110px 1.1fr 1fr 100px'+';gap:12px;align-items:center;padding:9px 0;border-top:1px solid rgba(var(--fg-rgb),.05)">'
+'<div style="font-family:var(--mono);font-size:12px;color:'+c+'">'+sc+'</div>'
+'<div style="font-size:13px;color:var(--text-body);line-height:1.4">'+esc(NIST_DESC[sc])+(st.ev?' <span style="font-size:11px;color:var(--text-faint)">('+st.ev+')</span>':'')+(function(){var _ck=TEVV_SC_CHAR[sc];if(!_ck)return'';var cv=charCoverage(_ck);if(!cv.total)return'';return '<div style="font-size:11px;color:'+(cv.done===cv.total?'var(--t-good)':'var(--text-faint)')+';margin-top:2px">Testing evidence: '+cv.done+' of '+cv.total+' live systems</div>'})()+'</div>'
+'<div style="font-size:13px;color:var(--text-body);line-height:1.4">'+esc(sg.s||'')+(sg.o?' <span style="color:var(--text-faint)">\u2014 outside: '+esc(sg.o)+'</span>':'')+(stepLinks?' \u00b7 '+stepLinks:'')+'</div>'
+'<div style="text-align:right">'+chip+'</div>'

+'</div>';
});
h+='</div>'}
h+='</div>'});
h+='<div style="display:flex;gap:12px;margin-top:8px">'+btnG('About the NIST AI RMF','window.open(\'https://www.nist.gov/itl/ai-risk-management-framework\',\'_blank\')')+'</div>';
h+='<p style="font-size:12px;color:var(--text-faint);margin-top:16px;line-height:1.6">Reference: NIST AI 100-1, Artificial Intelligence Risk Management Framework (AI RMF 1.0), January 2023, and the NIST AI RMF Playbook. The AI RMF is voluntary and this mapping is a self-assessment aid, not a certification. The framework is under revision \u2014 re-validate against AI RMF 2.0 upon release.</p>';
h+='<p style="font-size:12px;color:var(--text-faint);margin-top:12px;line-height:1.6">This program holds plans, records, and decisions. The work itself happens in the organization, and each row names where that work lives.</p>';
h+='<p style="font-size:12px;color:var(--text-faint);line-height:1.6"><em>This dashboard signposts and records. It does not assert compliance with any framework or regulation, and nothing here is legal advice.</em></p>';
// TEVV evidence manageable in place (Rollout 34)
var _tvOpen=!!UI.expanded.tevvRef;/* addendum 146 (15 Aug 2026, ruled): the reference folds closed; the Save button called the retired saveTEVV \u2014 a dead relic, removed */
h+='<div class="cd" style="margin-top:24px;padding:16px 20px'+(_tvOpen?'':';cursor:pointer')+'"><div onclick="UI.expanded.tevvRef=!UI.expanded.tevvRef;render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--text-faint);font-size:15px">'+(_tvOpen?'\u25be':'\u25b8')+'</span><h2 class="h-section" style="margin:0">NIST TEVV Reference</h2></div>'+(_tvOpen?'<div style="margin-top:12px">'+tevvFields()+'</div>':'')+'</div>';
return h}
```

**Check:** Open Phase 5, step 5.2 (Compliance Dashboard). Under the three tab buttons, at the right, a small box shows PRINT DEPTH with two buttons SUMMARY and FULL, and below them the button ▾ Save as PDF. There is no Export Conformance Report button at the bottom of the page. The About the NIST AI RMF button is still there.

---

### Step 78 — Add the constant that holds the Governance Review's seven agenda items.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `dashRaciJump` ends, after its closing `}`.

**Code:**

```js
var GR_AGENDA=[
{k:'planned',t:'1. Check that the New Risk Review and the Responsible AI Board Review are running as planned.'},
{k:'stuck',t:'2. Sweep the portfolios for stuck work \u2014 assessments in progress and plans needing attention.'},
{k:'systems',t:'3. Sweep the AI system records to ensure that they are current.'},
{k:'tests',t:'4. Check every decisive test result since the last review.'},
{k:'compliance',t:'5. Check the compliance register: Are there any new regimes or obligations to add? Do any existing regimes or obligations require further action?'},
{k:'resp',t:'6. Review responsibilities: confirm that the RACI Matrix still reflects who is Responsible, Accountable, Consulted, and Informed.'},
{k:'review',t:'7. Assess how governance is running'}
];
```

**Nothing to check yet.** This change becomes visible at Step 79.

---

### Step 79 — Replace the function that draws the Governance Review page. It reads its agenda from GR_AGENDA and gains the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Find the function named `renderGovReview`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderGovReview(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* the Governance Review's agenda, one definition (hoisted 14 Sep 2026 from renderGovReview) */
function renderGovReview(){
var log=(data.reviewLog||[]).slice().sort(function(a,b){return b.at-a.at});
var _t=function(label,key){return '<p class="form-label">'+label+'</p><textarea id="'+key+'" rows="2" onchange="UI.'+key+'=this.value" style="width:100%;padding:8px;border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:13px;font-family:inherit;background:rgba(var(--fg-rgb),.02);resize:vertical">'+esc(UI[key]||'')+'</textarea>'};
var h='<div class="content-area pt-110"><div class="content-inner">';
h+='<div class="mb-3">'+(pfBackBtn()||'<button class="btn-ghost pad-chip-sm" onclick="go(\'phase5\')">\u2190 Back</button>')+'</div>';
h+=rvControlBar('printGovReview'); /* 14 Sep 2026 (Paul's ruling): the review prints as a document */
h+='<h2 class="h-section">Governance Review</h2><p class="t-lead">The review of the machinery itself: whether the reviews are running as planned, whether anything is stuck in the portfolios, whether test results have been acted on, whether the compliance register needs attention, and how governance is running. The first one runs at Step 4.4; this is its standing home.</p>';
h+=fwBar();
var _grDefs=GR_AGENDA; /* 14 Sep 2026: the seven items hoisted to GR_AGENDA, one definition the page and its printed document both read *//* addendum 195 (17 Aug 2026 morning, Paul’s ruling): the standing page takes the 4.4 opener — strip, then stepper; one definition feeds the stepper and the item cards */
h+=govStateStrip();
h+=frStepper(_grDefs);
h+=frItem(_grDefs[0].k,_grDefs[0].t,govReviewsPlannedBody());
h+=frItem(_grDefs[1].k,_grDefs[1].t,govHygieneBody());
h+=frItem(_grDefs[2].k,_grDefs[2].t,govSystemsSweepBody());
h+=frItem(_grDefs[3].k,_grDefs[3].t,govTestReconBody());
h+=frItem(_grDefs[4].k,_grDefs[4].t,complianceCheckBody());
h+=frItem(_grDefs[5].k,_grDefs[5].t,govRespRevBody());
h+=frItem(_grDefs[6].k,_grDefs[6].t,_t('What is working?','gvWorking')+_t('Where do things get stuck?','gvBottlenecks')+_t('What changes for the next review?','gvNext'));
h+=grAddlAgendaBlock(8);/* ruled 22 Aug 2026: the added items reach every agenda surface */
var _gvAll=(function(){var wk=((data.firstReview||{}).walk)||{};return ['planned','stuck','systems','tests','compliance','review'].every(function(k){return !!wk[k]})})();
if(_gvAll)h+='<div style="margin:0 0 14px">'+btn('\u2713 Log this review','saveGovReview()','#9B2D3F','font-size:13px;padding:8px 18px')+'</div>';/* addendum 148 (15 Aug 2026, ruled): the standing review walks the same covered mechanism as 4.4; the log arms only when every item is covered */
h+=govReviewLogCard();
return h+'</div></div>'}
```

**Check:** Open the Governance Review page (from the Governance Dashboard's Run the Review). At the top right there is a small button ▾ Save as PDF. The seven agenda items read as they did.

---

### Step 80 — Add the constant that holds the styles for the two review documents.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `conformanceDoc` ends, after its closing `}`. You added that function in Step 76.

**Code:**

```js
/* REVIEW DOCUMENTS (14 Sep 2026, Paul's ruling): the two Run-the-Review pages print as documents from a Save as PDF control at the top of each. The Responsible AI Board Review prints its agenda with the material each item reviews — the screening decisions since the board last met with their breach analyses, each confirmed risk's record led by its plan, the emergency responses led by their plans, the archive rationales with their records, the register of principles in full — one agenda item per page, then the board's notes on a page of their own when any are written. The Governance Review prints the governance-state rings, its seven-item agenda with the facts each item presents and any items added to it, and the three closing questions with their answers. A mark of coverage prints where one has been made. Routes, buttons, folds, the stepper, and the Governance Framework fold (its own document) do not print. */
var RV_CSS='<style>.rv-doc .rv-meta{font-size:12.5px;color:#555;margin:0 0 16px}.rv-doc .rv-sec{font-size:20px;font-weight:800;color:#111;margin:0 0 12px;break-after:avoid;page-break-after:avoid}.rv-doc .rv-ag{border:1px solid #ddd;border-left:4px solid;border-radius:6px;padding:12px 14px;margin:0 0 14px}.rv-doc .rv-agh{display:flex;gap:12px;align-items:flex-start;margin:0 0 10px;break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid}.rv-doc .rv-n{display:inline-block;width:24px;height:24px;border-radius:50%;color:#fff;text-align:center;line-height:24px;font-size:12px;font-weight:700;flex-shrink:0}.rv-doc .rv-t{font-size:15px;font-weight:700;margin:0 0 3px}.rv-doc .rv-t span{font-weight:400;color:#666;font-size:12px}.rv-doc .rv-t .bg{margin-left:8px;font-size:11px;padding:2px 8px;vertical-align:middle}.rv-doc .rv-d{font-size:12.5px;color:#555;line-height:1.55}.rv-doc .rv-rec{margin:8px 0 0}.rv-doc .rv-dec{border:1px solid #e5e5e5;border-radius:6px;padding:10px 12px;margin:0 0 10px}.rv-doc .rv-dec-h{font-size:13.5px;font-weight:700;color:#111;margin:0 0 6px;break-after:avoid;page-break-after:avoid}.rv-doc .rv-dec>div{break-inside:avoid;page-break-inside:avoid}.rv-doc .rv-dec-h .bg{margin-left:6px;font-size:11px;padding:2px 8px;vertical-align:middle}.rv-doc .rv-dec-h em{font-style:normal;font-weight:400;color:#666;font-size:12px;margin-left:6px}.rv-doc .u-b25d981{font-size:12px;font-weight:700;color:#333;margin:6px 0 2px}.rv-doc .fs-13{font-size:12.5px;color:#222;line-height:1.55}.rv-doc .rv-none{font-size:12.5px;color:#666;font-style:italic;padding:2px 0}.rv-doc .rv-pend{font-size:12.5px;color:#222;margin:4px 0 0}.rv-doc .rv-pend span{color:#666}.rv-doc .rv-dom{font-size:15px;font-weight:700;color:#111;margin:12px 0 4px;break-after:avoid;page-break-after:avoid}.rv-doc .rv-dom span{font-weight:400;color:#666;font-size:12px}.rv-doc .rv-pr{padding:8px 0 10px;border-bottom:1px solid #eee;break-inside:avoid;page-break-inside:avoid}.rv-doc .rv-pr-s{font-size:14px;font-weight:600;color:#111;line-height:1.5}.rv-doc .rv-pr-l{font-size:11.5px;color:#555;margin:6px 0 1px}.rv-doc .rv-pr-t{font-size:13px;color:#222;line-height:1.55}.rv-doc .rv-q{font-size:12.5px;font-weight:700;color:#333;margin:8px 0 2px}.rv-doc .rv-a{font-size:13px;color:#222;line-height:1.6;white-space:pre-wrap}.rv-doc .rv-log{padding:8px 0;border-bottom:1px solid #eee;font-size:13px;break-inside:avoid;page-break-inside:avoid}.rv-doc .rv-log em{font-style:normal;color:#666}.rv-doc .rv-log p{font-size:12.5px;color:#333;margin:3px 0 0;line-height:1.55}.rv-doc .rv-log p strong{color:#555;font-weight:600}.rv-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 14px;background:none;break-inside:avoid;page-break-inside:avoid}.rv-doc .cd h3{font-size:16px;font-weight:700;margin:0 0 12px}.rv-doc .cd div[style*="gap:36px"]{gap:14px !important}.rv-doc table.ly-rec{margin-bottom:12px}</style>';
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 81 — Add the function that capitalizes a word in the review documents.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RV_CSS` ends, after its closing `;`. You added that constant in Step 80.

**Code:**

```js
function rvCap(v){return v?String(v).charAt(0).toUpperCase()+String(v).slice(1):''}
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 82 — Add the function that draws the Save as PDF button on the review pages.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rvCap` ends, after its closing `}`. You added that function in Step 81.

**Code:**

```js
function rvControlBar(fn){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px"><button class="btn bg2" style="font-size:12px" onclick="'+fn+'()">\u25be Save as PDF</button></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 83 — Add the function that builds the Responsible AI Board Review's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rvControlBar` ends, after its closing `}`. You added that function in Step 82.

**Code:**

```js
function ethicsReviewDoc(){var ef=data.ethicalFramework||{};var bd=ef.board||{};var risks=data.risks||[];var prsA=ef.principles||[];var C='#7B4F8A';
  var lastEth=0;(data.reviewLog||[]).forEach(function(e){if(e.kind==='ethics'&&e.at>lastEth)lastEth=e.at});
  var dec=risks.filter(function(r){var s=ethStatusOf(r);return (s==='confirmed'||s==='cleared')&&r.ethTest&&r.ethTest.at}).sort(function(a,b){return b.ethTest.at-a.ethTest.at});
  var decSince=lastEth?dec.filter(function(r){return r.ethTest.at>lastEth}):dec;
  var awaiting=risks.filter(function(r){return isLiveRisk(r)&&ethStatusOf(r)==='potential'});
  var liveConf=risks.filter(function(r){return isLiveRisk(r)&&ethStatusOf(r)==='confirmed'});
  var escEth=liveConf.filter(function(r){return r.escalation});
  var queue=risks.filter(function(r){return ethStatusOf(r)==='confirmed'&&isArchivedRisk(r)});
  var ticks=UI.ethRevTicks||{};
  var head=function(n,title,desc,count){return '<div class="rv-agh"><span class="rv-n" style="background:'+C+'">'+n+'</span><div><div class="rv-t" style="color:'+C+'">'+title+(count!=null?' <span>('+count+')</span>':'')+(ticks[n]?badge('Reviewed','#2E7D4F'):'')+'</div><div class="rv-d">'+desc+'</div></div></div>'};
  var item=function(n,title,desc,count,body){return '<div class="rv-ag" style="border-left-color:'+C+(n>1?';break-before:page;page-break-before:always':'')+'">'+head(n,title,desc,count)+body+'</div>'}; /* 14 Sep 2026 (Paul's ruling): one agenda item per page */
  var flow=function(b){var i=b.indexOf('<table class="ly-rec"');if(i<0)return b;var j=b.indexOf('>',i);return b.slice(0,j).replace('break-before:page;page-break-before:always;','')+b.slice(j)}; /* 14 Sep 2026 (Paul's ruling): the first record under an agenda item follows its description on the item's own page, whatever its length; the records after it keep the fresh-page rule */
  var linkage=function(r){return (r.ethPrinciples||[]).map(function(pid){var pp=prsA.filter(function(x){return x.id===pid})[0];return pp?(pp.domain||pp.principle):''}).filter(Boolean).join(' \u00b7 ')};
  var h=printDocCover('Responsible AI Board Review','The board\u2019s agenda: the screening decisions since it last met, the plans for every confirmed Responsible AI risk, the emergency responses, the archive rationales, and the register of principles, as they stand today.','')+RV_CSS+'<div class="rv-doc">';
  h+='<div class="rv-meta">Board cadence: '+esc(bd.cadence?rvCap(bd.cadence):'Not scheduled')+' \u00b7 Next review: '+esc(bd.nextReview?lyDate(bd.nextReview):'Date not set')+' \u00b7 '+(lastEth?'Last review completed '+lyDate(lastEth):'No review completed yet')+'</div>';
  /* 1. screening decisions since the last review, each with the breach analysis behind it */
  var b1='';
  if(decSince.length)decSince.forEach(function(r){var s=ethStatusOf(r);var lk=linkage(r);b1+='<div class="rv-dec"><div class="rv-dec-h">'+esc(r.name||'Unnamed risk')+(s==='confirmed'?badge('Confirmed',C):badge('Cleared','#6B7F8D'))+(lk?'<em>'+esc(lk)+'</em>':'')+'<em>\u2014 '+esc((r.ethTest||{}).by||'')+', '+lyDate((r.ethTest||{}).at)+'</em></div>'+ethPageRO(r,true)+'</div>'});
  else b1='<div class="rv-none">No decisions'+(lastEth?' since the last review':'')+'.</div>';
  if(awaiting.length)b1+=awaiting.map(function(r){return '<div class="rv-pend"><span>Pending screening \u2014 </span>'+esc(r.name||'Unnamed risk')+'</div>'}).join('');
  h+=item(1,'Review Responsible AI Risk Screening Decisions','Every risk flagged as a potential Responsible AI issue is screened against the register: the screening either confirms that the risk threatens one or more named principles, or clears the flag. These are the decisions made since the board last met, each with who decided it, the principles it was linked to, and the breach analysis behind a confirmation.',decSince.length,b1);
  /* 2. the plans for every live confirmed risk: the record, led by its plan */
  var b2=liveConf.length?flow(liveConf.map(function(r){return '<div class="rv-rec">'+lyRender('risk',r,'summary',null,'',cardClass(r)==='monitor'?'mnplan':'mgplan')+'</div>'}).join('')):'<div class="rv-none">None live.</div>';
  h+=item(2,'Review the Manage &amp; Monitor Plans','How each confirmed Responsible AI risk is being handled \u2014 in the Manage, Monitor, or Emergency portfolios: its management or monitoring plan first, then the assessment and classification around it. The board oversees these decisions. It does not make them.',liveConf.length,b2);
  /* 3. the emergency responses: the record, led by the emergency plan */
  var b3=escEth.length?flow(escEth.map(function(r){return '<div class="rv-rec">'+lyRender('risk',r,'summary',null,'','emergency')+'</div>'}).join('')):'<div class="rv-none">No Responsible AI escalations \u2014 nothing stands at emergency level.</div>';
  h+=item(3,'Review Emergency Responses','Any confirmed Responsible AI risk that has been escalated to emergency level, with its emergency response plan \u2014 the triggers, the first moves, the named lead, and the stand-down condition.',escEth.length,b3);
  /* 4. the archive rationales */
  var b4=queue.length?flow(queue.map(function(r){var rat=(r.dismissed&&r.dismissed.reason)||(r.resolution&&r.resolution.rationale)||r.responsePlan||'';return '<div class="rv-rec">'+(rat?'<div class="fs-13" style="margin:0 0 6px"><span class="u-b25d981" style="display:inline;margin:0 6px 0 0">Rationale for closing:</span>'+esc(rat)+'</div>':'<div class="rv-none">No rationale recorded.</div>')+lyRender('risk',r,'summary',null)+'</div>'}).join('')):'<div class="rv-none">None yet.</div>';
  h+=item(4,'Review the Rationales for Archiving Responsible AI Risks','When a confirmed Responsible AI risk is resolved or dismissed, the rationale for closing it is recorded. Each rationale, with the record it closed, for the board to check that the reasoning still holds.',queue.length,b4);
  /* 5. the register of principles, in full: the board reads it end to end */
  var b5='';ethDomains().forEach(function(dom){var list=prsA.filter(function(p){return String(p.domain||'')===dom});b5+='<div class="rv-dom">'+esc(dom)+' <span>('+list.length+')</span></div>';if(!list.length){b5+='<div class="rv-none">No principles recorded.</div>';return}
    list.forEach(function(pr){b5+='<div class="rv-pr"><div class="rv-pr-s">'+esc(pr.principle||'')+'</div>'+(pr.details?'<div class="rv-pr-l">Details</div><div class="rv-pr-t">'+esc(pr.details)+'</div>':'')+(pr.breach?'<div class="rv-pr-l">What would breach the principle</div><div class="rv-pr-t">'+esc(pr.breach)+'</div>':'')+'</div>'})});
  h+=item(5,'Review the Register of Responsible AI Principles','The register is the board\u2019s own instrument: the named principles every Responsible AI decision screens against. Read end to end for consistency and sufficiency \u2014 principles should not contradict one another, and nothing the last period exposed should be missing.',prsA.length,b5);
  /* 6. the board's notes for this review */
  var notes=String(UI.ethRevNotes||'').trim(); /* 14 Sep 2026 (Paul's ruling): the notes print only when written, on a page of their own; the completed reviews do not print */
  if(notes)h+=item(6,'Additional Notes','Anything the board wants on the record for this review \u2014 concerns raised, actions agreed, follow-ups assigned.',null,'<div class="rv-a">'+esc(notes)+'</div>');
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<a [^>]*>([\s\S]*?)<\/a>/g,'$1').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 84 — Add the function that prints the Responsible AI Board Review.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ethicsReviewDoc` ends, after its closing `}`. You added that function in Step 83.

**Code:**

```js
function printEthicsReview(){printPage('Responsible AI Board Review',ethicsReviewDoc())}
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 85 — Add the function that builds the Governance Review's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printEthicsReview` ends, after its closing `}`. You added that function in Step 84.

**Code:**

```js
function govReviewDoc(){var wk=((data.firstReview||{}).walk)||{};var log=(data.reviewLog||[]).slice().sort(function(a,b){return b.at-a.at});var C='#9B2D3F';
  var head=function(n,title,k){return '<div class="rv-agh"><span class="rv-n" style="background:'+C+'">'+n+'</span><div><div class="rv-t" style="color:#111">'+title+(k&&wk[k]?badge('Covered','#1B6B5A'):'')+'</div></div></div>'};
  var item=function(n,title,k,body){return '<div class="rv-ag" style="border-left-color:'+C+'">'+head(n,title,k)+body+'</div>'};
  var h=printDocCover('Governance Review','The review of the machinery itself: whether the reviews are running as planned, whether anything is stuck in the portfolios, whether test results have been acted on, whether the compliance register needs attention, and how governance is running.','')+RV_CSS+'<div class="rv-doc">';
  var lastGov=0;log.forEach(function(e){if(e.kind==='governance'&&e.at>lastGov)lastGov=e.at});
  h+='<div class="rv-meta">'+(lastGov?'Last review logged '+lyDate(lastGov):'No governance review logged yet')+'</div>';
  var strip=govStateStrip();if(strip)h+=strip;
  /* the seven items, in the page's words; the routes beneath them are screen navigation and do not print */
  var qa=function(q,v){v=String(v||'').trim();return '<div class="rv-q">'+q+'</div>'+(v?'<div class="rv-a">'+esc(v)+'</div>':'<div class="rv-none">Not yet recorded.</div>')};
  var bodies={planned:govReviewsPlannedBody,stuck:govHygieneBody,systems:govSystemsSweepBody,tests:govTestReconBody,compliance:function(){return ''},resp:function(){return ''},review:function(){return qa('What is working?',UI.gvWorking)+qa('Where do things get stuck?',UI.gvBottlenecks)+qa('What changes for the next review?',UI.gvNext)}};
  GR_AGENDA.forEach(function(it,i){h+=item(i+1,it.t.replace(/^\d+\.\s*/,''),it.k,(bodies[it.k]||function(){return ''})())}); /* the page's own agenda, one definition; items 5 and 6 print their titles alone (the bodies beneath them on screen are routes) */
  var addl=grAddlAgendaBlock(8);if(addl)h+='<div class="rv-ag" style="border-left-color:'+C+'">'+addl+'</div>';
  h+='</div>'; /* 14 Sep 2026 (Paul's ruling): the review log does not print */
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<div style="margin-top:(8|10)px"><\/div>/g,'').replace(/<div><\/div>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 86 — Add the function that prints the Governance Review.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `govReviewDoc` ends, after its closing `}`. You added that function in Step 85.

**Code:**

```js
function printGovReview(){printPage('Governance Review',govReviewDoc())}
```

**Nothing to check yet.** This change becomes visible at Step 87.

---

### Step 87 — Replace the function that draws the Responsible AI Board Review page. It gains the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Find the function named `renderEthicsOverviewPage`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function renderEthicsOverviewPage(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* round 45: the ethregister page retired \u2014 the register's dashboard home is the glance bar (Paul's ruling). */
function renderEthicsOverviewPage(){
var h='<div class="content-area pt-110"><div class="content-inner">';
h+='<div class="mb-3">'+(pfBackBtn()||'<button class="btn-ghost pad-chip-sm" onclick="go(\'phase5\')">\u2190 Back</button>')+'</div>';
h+=rvControlBar('printEthicsReview'); /* 14 Sep 2026 (Paul's ruling): the review prints as a document */
h+=card('<h3 class="h-section" style="font-size:20px;margin:0 0 8px;color:#7B4F8A">Responsible AI Board Review</h3><p style="font-size:13px;color:var(--text-muted);margin:0 0 8px">Work down the agenda with the board convened. Mark each item reviewed as the board completes it, then mark the review complete \u2014 it joins the archive of completed reviews below.</p><div style="display:flex;gap:8px;flex-wrap:wrap">'+(UI.ethRevLogged?'<span style="display:inline-block;padding:5px 12px;border-radius:8px;background:#2E7D4F;color:#fff;font-size:11px;font-weight:600">\u2713 Review Complete</span>':btn('Mark Review Complete','govLogReview(\'ethics\')','#7B4F8A','font-size:13px;padding:8px 18px;border-radius:8px'))+'</div>','border-left:4px solid #7B4F8A;margin-bottom:14px');/* round 44 (Paul's ruling): the review stays open after logging; the control turns green in place */
h+=renderEthicalSpine();
return h+'</div></div>'}
```

**Check:** Open the Responsible AI Board Review page (from the Governance Dashboard's Run the Review). At the top right there is a small button ▾ Save as PDF.

---

### Step 88 — Add the function that builds the Module Management page's printed document.

**Kind:** Add new code.

**Where:** Add this at the end of the file.

**Code:**

```js
/* MODULE MANAGEMENT DOCUMENT (14 Sep 2026, Paul's ruling): the Track Program page prints as its own document rather than a snapshot of the tab showing. Page one: the four figures; This Week; every step by phase with its owners, its due date, and its state. Page two: the burn-up beside the velocity chart; the workload by member; the signals. The tab buttons, the due-date fields, and the assignment controls do not print. The print window has no stylesheet, so the rules the page relies on are declared here. */
function mgmtHubDoc(){var st=mgStats(),co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{};
  var today=new Date().toISOString().split('T')[0];var week=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  var owners=function(id){return getAssigns(id).map(function(uid){var u=(USERS||[]).find(function(x){return x.id===uid});return u?u.name:''}).filter(Boolean).join(', ')};
  var state=function(id){var d2=due[id]||'';if(co[id])return 'Done'+(dts[id]?' \u00b7 '+lyDate(dts[id]):'')+(d2?' \u00b7 was due '+lyDate(d2):'');if(d2&&d2<today)return 'Overdue \u00b7 was due '+lyDate(d2);if(d2)return 'Due '+lyDate(d2);return 'Open'};
  var css='<style>.mh-doc{--ok-t:#1B6B5A}.mh-doc .mh-sec{font-size:20px;font-weight:800;color:#111;margin:0 0 10px;break-after:avoid;page-break-after:avoid}.mh-doc .mh-sec+.mh-sec{margin-top:18px}.mh-fig{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 18px}.mh-fig div{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center}.mh-fig b{display:block;font-size:22px;font-weight:700;color:#111}.mh-fig span{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.08em}.mh-tbl{width:100%;border-collapse:collapse;font-size:12px;margin:0 0 12px}.mh-tbl th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;text-align:left;padding:4px 6px;border-bottom:1px solid #111}.mh-tbl td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}.mh-tbl tr{break-inside:avoid;page-break-inside:avoid}.mh-id{font-family:var(--mono,monospace);font-size:11px;color:#555}.mh-ph{font-size:15px;font-weight:700;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.mh-ph span{font-weight:400;color:#666;font-size:12px}.mh-lead{font-size:12px;color:#555;margin:0 0 6px}.mh2{display:flex;gap:12px;align-items:stretch;break-inside:avoid;page-break-inside:avoid}.mh2>*{flex:1;min-width:0}.mh-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.mh-doc .cd h3{font-size:14px;font-weight:700;margin:0 0 4px;color:#111}.mh-doc .t-faint-sm{font-size:11.5px;color:#555}.mh-doc .fs-13{font-size:12.5px}.mh-doc .fs-14{font-size:13px}.mh-doc svg{max-width:100%}</style>';
  var h=printDocCover('Module Management','Every step of the module in one place \u2013 who owns it, when it is due, and how completion is pacing against the 90 days.','')+css+'<div class="mh-doc">';
  var fig=function(v,l){return '<div><b>'+v+'</b><span>'+l+'</span></div>'};
  h+='<div class="mh-fig">'+fig(st.done+' / '+st.total,'steps complete')+fig('Day '+Math.min(st.elapsed,90)+(st.elapsed>90?' (+'+(st.elapsed-90)+' over)':''),'of the 90')+fig((st.delta>=0?'+':'\u2212')+Math.abs(st.delta).toFixed(1),'steps vs ideal pace')+fig(String(st.overdue),'overdue')+'</div>';
  var steps=mgSteps();var wk=steps.filter(function(s2){return !co[s2.id]&&due[s2.id]&&due[s2.id]<=week}); /* overdue, or due within seven days */
  var tbl=function(list){var t='<table class="mh-tbl"><thead><tr><th style="width:8%">Step</th><th>Name</th><th style="width:28%">Owners</th><th style="width:30%">State</th></tr></thead><tbody>';
    list.forEach(function(s2){var o=owners(s2.id);t+='<tr><td class="mh-id">'+esc(s2.id)+'</td><td>'+esc(s2.name)+'</td><td>'+(o?esc(o):'<span style="color:#999">Not assigned</span>')+'</td><td>'+esc(state(s2.id))+'</td></tr>'});return t+'</tbody></table>'};
  h+='<div class="mh-sec">This Week</div><div class="mh-lead">Steps overdue or due within seven days.</div>'+(wk.length?tbl(wk):'<div class="t-faint-sm" style="font-style:italic;margin:0 0 12px">Nothing due in the next seven days and nothing overdue.</div>');
  h+='<div class="mh-sec">Assignments</div>';
  PH.forEach(function(p){if(p.id===5)return;h+='<div class="mh-ph" style="color:'+p.color+'">Phase '+p.id+' \u2013 '+esc(p.name)+' <span>('+p.days+')</span></div>'+tbl(p.steps.map(function(stp){return {id:stp.id,name:stp.name}}))});
  /* page two: the analytics */
  h+='<div style="break-before:page;page-break-before:always"><div class="mh-sec">Analytics</div>';
  h+='<div class="mh2">'+card('<h3>90-Day Burn-up</h3><p class="t-faint-sm" style="margin:0 0 8px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all '+st.total+' steps by day 90.</p>'+mgBurnup())+card('<h3>Module Velocity</h3><p class="t-faint-sm" style="margin:0 0 8px">Steps completed per program week, from completion dates.</p>'+mgVelocity())+'</div>';
  h+=card('<h3>Workload by Member</h3><p class="t-faint-sm" style="margin:0 0 8px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>'+mgWorkload());
  h+=card('<h3>Signals</h3>'+mgSignals())+'</div>';
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<input[^>]*>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 89.

---

### Step 89 — Replace the function behind the Module Management page's Save as PDF button. It now prints the document.

**Kind:** Replace existing code.

**Where:** Find the function named `printMgmtAnalytics`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function printMgmtAnalytics(){printPage()} /* gov's printPage snapshots the current view */
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function printMgmtAnalytics(){printPage('Module Management',mgmtHubDoc())}
```

**Check:** Open the More menu and choose Track Program. Click ▾ Save as PDF. A new window opens with a first page titled Module Management, then a page with four figures, a section This Week, and a section Assignments listing every step of Phases 1 to 4 with its owners and its state, then a page headed Analytics.

---

### Step 90 — Add the function behind the Save as PDF button on Phase 5 pages. It prints each page's own document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pbStrip` ends, after its closing `}`. You added that function in Step 52.

**Code:**

```js
function printCurrentPage(){
  var id=currentStep;var title=stepNameOf(id);
  if(id==='5.4'){printPage('Analytics',analyticsDoc());return} /* 13 Sep 2026 (Paul's print pass): the Analytics page prints as its own document */
  if(id==='5.1'){printPage('Governance Dashboard',dashboardDoc());return} /* 14 Sep 2026 (Paul's print pass): the Governance Dashboard prints as its own document */
  if(id==='5.3'){printPage('Testing Center',testingCenterDoc());return} /* 13 Sep 2026 (Paul's ruling): the Testing Center is the systems' testing and evidence layers; it prints as that document — 14 Sep 2026: with the testing log on a page of its own at the end */
  if(id==='5.2'){printComplianceTab();return} /* 14 Sep 2026 (Paul's ruling): the Compliance Dashboard prints the tab that is showing, at its chosen print depth */
  UI._printing=1;UI._docAll=1;var body='';try{body=withFoldsOpen(function(){return renderStepContentBody(id)})}finally{UI._printing=0;UI._docAll=0} /* 13 Sep 2026: folds open on paper */
  printPage(title,printDocCover(title,'','')+_pbStrip(body));
}
```

**Check:** Open Phase 5, step 5.1 and click ▾ Save as PDF. The document's first page is titled Governance Dashboard. Open step 5.3 and click ▾ Save as PDF: the document is titled Testing Center and its last page is headed Testing Log.

---

### Step 91 — Add the function that lists everything a report can contain.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RISK_LAYER_INDEX` ends, after its closing `;`. You added that constant in Step 21.

**Code:**

```js
/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   REPORT COMPILER (family; Spec Rev A §9, Paul's rulings 12 Sep 2026). A named report definition on the
   organization: units from the module's catalogue (outputs at a depth, Phase 5 pages, single records), in
   order, with an authored introduction and section notes. Compiling prints one document: the family cover,
   a contents page of numbered sections, the gaps list, the introduction, then each unit as a numbered
   section on its own page. Facts are never edited. The door is the More menu.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
function rcCatalogue(){ /* the module's printable units */
  var out=[];
  var DEPTHED={'out-riskreg':1,'out-assessedreg':1,'out-updatedreg':1}; /* depth is offered only where summary and full differ (Paul, 12 Sep 2026) */
  PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(PRINT_DOCS[o.id])out.push({kind:'output',id:o.id,name:o.name,group:'Outputs \u00b7 Phase '+p.id,depths:DEPTHED[o.id]?['summary','full']:null})})});
  [['5.1','Governance Dashboard'],['5.3','Testing Center'],['5.4','Analytics']].forEach(function(x){out.push({kind:'page',id:x[0],name:x[1],group:'Phase 5 pages'})});
  [['dash','Compliance Dashboard \u00b7 Conformance Report'],['reg','Compliance Dashboard \u00b7 Compliance Register'],['obl','Compliance Dashboard \u00b7 Compliance Obligations']].forEach(function(x){out.push({kind:'cdtab',id:x[0],name:x[1],group:'Phase 5 pages',depths:['summary','full']})}); /* 14 Sep 2026 (Paul's ruling): the Compliance Dashboard's three tabs, each at a depth */
  [['ethics','Responsible AI Board Review'],['governance','Governance Review']].forEach(function(x){out.push({kind:'review',id:x[0],name:x[1],group:'Reviews'})}); /* 14 Sep 2026: the two Run-the-Review pages, as they stand */
  out.push({kind:'page',id:'mgmt-hub',name:'Module Management',group:'Program management'}); /* 14 Sep 2026 (Paul's ruling): the Track Program page */
  [['identify','Identify portfolio'],['assess','Assess portfolio'],['manage','Manage and Monitor portfolio'],['emergency','Emergency Response portfolio']].forEach(function(x){out.push({kind:'portfolio',id:x[0],name:x[1],group:'Portfolios',depths:['summary','full']})}); /* four portfolios (Paul, 12 Sep 2026); the archive is not one */
  out.push({kind:'portfolio',id:'archived',name:'Archived risks',group:'Archive',depths:['summary','full']});
  (data.systems||[]).forEach(function(sx){out.push({kind:'record',type:'system',id:sx.id,name:sx.name||'Unnamed system',group:'Individual AI Systems'})}); /* 14 Sep 2026 (Paul's ruling): systems, then regimes, then risks; the groups named in full */
  (data.regimes||[]).forEach(function(g){out.push({kind:'record',type:'regime',id:g.id,name:g.name||'Unnamed regime',group:'Individual Compliance Regimes'})});
  (data.risks||[]).forEach(function(r){out.push({kind:'record',type:'risk',id:r.id,name:r.name||'Unnamed risk',group:'Individual Risks',rec:r,sub:rcRiskSub(r)})});
  return out}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 92 — Add the function that reads the saved reports.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcCatalogue` ends, after its closing `}`. You added that function in Step 91.

**Code:**

```js
function rcDefs(){if(!data.reportDefs)data.reportDefs=[];return data.reportDefs}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 93 — Add the function that creates a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDefs` ends, after its closing `}`. You added that function in Step 92.

**Code:**

```js
function rcNew(){var d={id:'rpt-'+Math.random().toString(36).slice(2,9),name:'New report',subtitle:'',intro:'',units:[],createdAt:Date.now()};rcDefs().push(d);UI.rcEdit=d.id;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 94 — Add the function that finds a saved report by its id.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcNew` ends, after its closing `}`. You added that function in Step 93.

**Code:**

```js
function rcFind(id){return rcDefs().find(function(d){return d.id===id})||null}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 95 — Add the function that saves a report's title, subtitle, or introduction.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFind` ends, after its closing `}`. You added that function in Step 94.

**Code:**

```js
function rcSet(id,k,v){var d=rcFind(id);if(!d)return;d[k]=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 96 — Add the function that saves a section's note.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSet` ends, after its closing `}`. You added that function in Step 95.

**Code:**

```js
function rcSetNote(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].note=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 97 — Add the function that saves a section's Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetNote` ends, after its closing `}`. You added that function in Step 96.

**Code:**

```js
function rcSetDepth(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].depth=v;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 98 — Add the function that adds a piece of content to a report or removes it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetDepth` ends, after its closing `}`. You added that function in Step 97.

**Code:**

```js
function rcToggle(id,key,depth){var d=rcFind(id);if(!d)return;var i=d.units.findIndex(function(u){return u.key===key});if(i>=0)d.units.splice(i,1);else{var c=rcCatalogue().find(function(u){return rcKey(u)===key});if(c)d.units.push({key:key,kind:c.kind,id:c.id,type:c.type||'',name:c.name,depth:c.depths?(depth==='full'?'full':'summary'):'',note:''})}saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 99 — Add the function that moves a section up or down.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcToggle` ends, after its closing `}`. You added that function in Step 98.

**Code:**

```js
/* 14 Sep 2026: an option with a depth is added at the depth chosen */
function rcMove(id,i,dir){var d=rcFind(id);if(!d)return;var j=i+dir;if(j<0||j>=d.units.length)return;var t=d.units[i];d.units[i]=d.units[j];d.units[j]=t;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 100 — Add the function that deletes a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcMove` ends, after its closing `}`. You added that function in Step 99.

**Code:**

```js
function rcDelete(id){if(!confirm('Delete this report definition? The record it prints is untouched.'))return;data.reportDefs=rcDefs().filter(function(d){return d.id!==id});if(UI.rcEdit===id)UI.rcEdit=null;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 101 — Add the function that copies a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDelete` ends, after its closing `}`. You added that function in Step 100.

**Code:**

```js
function rcDuplicate(id){var d=rcFind(id);if(!d)return;var c=JSON.parse(JSON.stringify(d));c.id='rpt-'+Math.random().toString(36).slice(2,9);c.name=d.name+' (copy)';c.createdAt=Date.now();rcDefs().push(c);UI.rcEdit=c.id;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 102 — Add the function that gives a piece of content its key.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDuplicate` ends, after its closing `}`. You added that function in Step 101.

**Code:**

```js
function rcKey(u){return u.kind+':'+(u.type?u.type+':':'')+u.id}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 103 — Add the function that removes a document's first page when it becomes a section of a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcKey` ends, after its closing `}`. You added that function in Step 102.

**Code:**

```js
function _rcStripCover(doc){var i=doc.indexOf('min-height:85vh');if(i<0)return doc;var end=doc.indexOf('</div></div>',i);return end>0?doc.slice(end+12):doc}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 104 — Add the function that builds one section's content.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_rcStripCover` ends, after its closing `}`. You added that function in Step 103.

**Code:**

```js
/* an output's own cover comes off inside a compiled report */
function rcUnitBody(u){ /* the unit's content, no cover, no controls */
  var body='';var wasDepth=UI.printDepth;
  try{
    if(u.kind==='output'){UI.printDepth=u.depth||'summary';var fn=PRINT_DOCS[u.id];body=fn?_rcStripCover(fn()):''}
    else if(u.kind==='page'&&u.id==='5.4'){body=_rcStripCover(analyticsDoc())}
    else if(u.kind==='page'&&u.id==='5.1'){body=_rcStripCover(dashboardDoc())} /* 14 Sep 2026: the same document the dashboard prints */
    else if(u.kind==='page'&&u.id==='5.3'){body=_rcStripCover(testingCenterDoc())} /* 14 Sep 2026: the same document the Testing Center prints */
    else if(u.kind==='page'&&u.id==='mgmt-hub'){body=_rcStripCover(mgmtHubDoc())} /* 14 Sep 2026: the same document the Track Program page prints */
    else if(u.kind==='cdtab'){body=_rcStripCover(complianceTabDoc(u.id,u.depth||'summary'))} /* 14 Sep 2026: a Compliance Dashboard tab at its depth */
    else if(u.kind==='review'){body=_rcStripCover(u.id==='ethics'?ethicsReviewDoc():govReviewDoc())} /* 14 Sep 2026: a review, as it stands */
    else if(u.kind==='text'){body='<div class="rc-text" style="font-size:14px;line-height:1.7;color:#222">'+rcSanitize(u.html||'')+'</div>'} /* 14 Sep 2026 (Paul's ruling): an authored text page, its heading the section title */
    else if(u.kind==='page'){UI._printing=1;UI._docAll=1;try{body=withFoldsOpen(function(){return renderStepContentBody(u.id)})}finally{UI._printing=0;UI._docAll=0};body=_pbStrip(body)} /* 13 Sep 2026: folds open on paper */
    else if(u.kind==='portfolio'){UI.printDepth=u.depth||'summary';body=_rcStripCover(portfolioDoc(u.id))} /* 13 Sep 2026: the same document the portfolio page prints */
    else if(u.kind==='record'){var recs={risk:data.risks,regime:data.regimes,system:data.systems}[u.type]||[];var rec=recs.find(function(x){return x.id===u.id});body=rec?lyRender(u.type,rec,'full',null):'<div style="color:#666;font-style:italic">This record no longer exists.</div>'}
  }finally{UI.printDepth=wasDepth}
  body=rcFirstRecordStays(body); /* 14 Sep 2026: a section opens on a fresh page already, so its first record does not force another (a long record elsewhere still starts a fresh page) */
  return body.replace(/<button[\s\S]*?<\/button>/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 105 — Add the function that keeps a section's first record on the same page as the section heading.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitBody` ends, after its closing `}`. You added that function in Step 104.

**Code:**

```js
function rcFirstRecordStays(body){var a=body.indexOf('<table class="ly-rec"');if(a<0)return body;var b=body.indexOf('<table class="ly-rec"',a+10);var first=b>0?body.slice(a,b):body.slice(a);var fixed=first.replace('break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;','break-inside:auto;page-break-inside:auto;');return body.slice(0,a)+fixed+(b>0?body.slice(b):'')}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 106 — Add the function that collects what a section's records are missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFirstRecordStays` ends, after its closing `}`. You added that function in Step 105.

**Code:**

```js
function rcUnitGaps(u){ /* the missing-layers lines a unit would print, for the gaps list */
  if(u.kind==='portfolio'){var P=getPortfolios();var upto={identify:RISK_LAYER_INDEX.prelim,assess:RISK_LAYER_INDEX['class'],manage:RISK_LAYER_INDEX.mnplan}[u.id];return lyGaps('risk',P[u.id]||[],upto===undefined?null:upto)}
  if(u.kind==='output'){var lane={'out-riskreg':'identify','out-assessedreg':'assess','out-updatedreg':'manage'}[u.id];if(lane){var P2=getPortfolios();var up={identify:RISK_LAYER_INDEX.prelim,assess:RISK_LAYER_INDEX['class'],manage:RISK_LAYER_INDEX.mnplan}[lane];return lyGaps('risk',P2[lane]||[],up)}}
  if(u.kind==='record'){var recs={risk:data.risks,regime:data.regimes,system:data.systems}[u.type]||[];var rec=recs.find(function(x){return x.id===u.id});return rec?lyGaps(u.type,[rec],null):[]}
  return []}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 107 — Add the function that builds the whole printed report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitGaps` ends, after its closing `}`. You added that function in Step 106.

**Code:**

```js
function rcCompile(id){ /* the whole document */
  var d=rcFind(id);if(!d)return '';
  var h=printDocCover(d.name||'Report',d.subtitle||'','');
  h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Contents</div>';
  d.units.forEach(function(u,i){h+='<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #eee;font-size:13px"><span style="font-family:var(--mono,monospace);color:#666;min-width:28px">'+(i+1)+'.</span><span>'+esc(u.name||(u.kind==='text'?'Untitled page':''))+(u.depth?' <span style="color:#888;font-size:11px">('+u.depth+')</span>':'')+'</span></div>'});
  var gaps=[];d.units.forEach(function(u,i){rcUnitGaps(u).forEach(function(g){gaps.push({sec:i+1,title:g.title,lines:g.lines})})});
  if(gaps.length){h+='<div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B3A1E;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #8B3A1E">What is missing ('+gaps.length+')</div>';
    gaps.forEach(function(g){h+='<div style="font-size:12.5px;padding:4px 0;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);color:#666">'+g.sec+'.</span> <strong>'+esc(g.title)+'</strong> \u2014 '+g.lines.map(esc).join(' ')+'</div>'})}
  h+='</div>';
  if(d.intro&&d.intro.trim())h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Introduction</div><div style="font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap">'+esc(d.intro)+'</div></div>';
  d.units.forEach(function(u,i){h+=rcSection(u,i)});
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 108 — Add the function that builds one numbered section of the report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcCompile` ends, after its closing `}`. You added that function in Step 107.

**Code:**

```js
function rcSection(u,i){ /* one numbered section as the report carries it: the number at the title's size (Paul's ruling, 14 Sep 2026), the heading, the note, the body — one definition for the compiled report and for the section preview */
  var h='<div style="page-break-before:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111"><span style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#888;margin-right:12px">'+(i+1)+'</span>'+esc(u.name||(u.kind==='text'?'Untitled page':''))+'</div>';
  if(u.note&&u.note.trim())h+='<div style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;padding:10px 14px;border-left:3px solid #999;white-space:pre-wrap">'+esc(u.note)+'</div>';
  return h+rcUnitBody(u)+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 109 — Add the function that prints a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSection` ends, after its closing `}`. You added that function in Step 108.

**Code:**

```js
function rcPrint(id){var d=rcFind(id);if(!d)return;var doc=rcCompile(id);printPage(d.name||'Report',doc)}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 110 — Add the function that draws the Report Manager page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPrint` ends, after its closing `}`. You added that function in Step 109.

**Code:**

```js
function renderReports(){ /* the Report Manager page (More menu). 14 Sep 2026 (Paul's ruling): a report is assembled from Report Content Options on the right into Sections on the left; every option that has a depth is added at Summary or Full; individual risks can be filtered; text pages with a heading and a formatted body can be added anywhere; the report can be previewed at any point; the introduction and notes are uncapped */
  var defs=rcDefs();var ed=UI.rcEdit?rcFind(UI.rcEdit):null;
  var h='<div class="content-area"><div class="content-inner" style="max-width:1350px"><h2 class="h-section">Report Manager</h2><p class="t-lead">Compile the outputs, the Phase 5 pages, the reviews, the portfolios, and individual records into one printed document under one cover: a contents page, a list of what is missing, an introduction you write, and each piece as a numbered section. Add your own text pages wherever a part of the report needs an introduction. A saved report reprints with fresh data. The record itself is never edited here.</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 18px">'+btn('+ New report','rcNew()','bp')+'</div>';
  if(!defs.length)h+=card('<p style="color:var(--text-faint);text-align:center;padding:28px 0">No reports yet. Start one, choose what it contains, and print it.</p>');
  defs.forEach(function(d){var open=ed&&ed.id===d.id;
    h+='<div class="cd" style="margin-bottom:10px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(d.name||'Untitled')+'</div><div style="font-size:12px;color:var(--text-faint)">'+d.units.length+' section'+(d.units.length===1?'':'s')+(d.subtitle?' \u00b7 '+esc(d.subtitle):'')+'</div></div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+btnG('Preview','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+btnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+btnG(open?'Close':'Edit','UI.rcEdit='+(open?'null':'\''+d.id+'\'')+';render()','font-size:12px')+btnG('Duplicate','rcDuplicate(\''+d.id+'\')','font-size:12px')+btnG('Delete','rcDelete(\''+d.id+'\')','font-size:12px')+'</span></div>';
    if(open)h+=rcEditor(d);
    h+='</div>'});
  return h+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 111 — Add the function that names a piece of content's kind.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderReports` ends, after its closing `}`. You added that function in Step 110.

**Code:**

```js
function rcKindLabel(u){return {output:'Output',page:'Phase 5 page',cdtab:'Compliance Dashboard tab',review:'Review',portfolio:'Portfolio',record:'Individual '+({risk:'risk',regime:'compliance regime',system:'AI system'}[u.type]||u.type),text:'Text page'}[u.kind]||u.kind}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 112 — Add the function that draws the report editor.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcKindLabel` ends, after its closing `}`. You added that function in Step 111.

**Code:**

```js
function rcEditor(d){ /* 14 Sep 2026 (Paul's ruling): the Order column is the report's contents being built — one compact row per section with its number, name, kind, a fact about its size, its depth, and a mark where a note is written; one row selected at a time opens the inspector beneath the list, which holds what the section prints, the depth, the note, a preview of that section alone, and for a text page its editor. The Content Options list keeps its size; Add a text page is its first row. */
  var cat=rcCatalogue();var chosen={};d.units.forEach(function(u){chosen[u.key]=1});
  var seg=function(active,label,fn,extra){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(active?'background:rgba(var(--fg-rgb),.10);color:var(--paper);':'')+(extra||'')+'" onclick="'+fn+'">'+label+'</button>'};
  var ico=function(glyph,fn,title,dim){return '<button class="btn-ghost" title="'+esc(title)+'" style="font-size:12px;padding:2px 7px;line-height:1.2;min-width:0;'+(dim?'opacity:.35;pointer-events:none;':'')+'" onclick="event.stopPropagation();'+fn+'">'+glyph+'</button>'};
  var h='<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(var(--fg-rgb),.10)">';
  /* the report's own words: title, subtitle, introduction */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+inp('Title','rc_name_'+d.id,d.name,'e.g. Board pack, September')+inp('Subtitle','rc_sub_'+d.id,d.subtitle,'One line under the title on the cover')+'</div>';
  h+='<script>document.getElementById(\'rc_name_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'name\',this.value);render()};document.getElementById(\'rc_sub_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'subtitle\',this.value)};</script>';
  h+='<div class="mb-4"><label class="form-label">Introduction</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed after the contents page.</p><textarea rows="6" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSet(\''+d.id+'\',\'intro\',this.value)">'+esc(d.intro||'')+'</textarea></div>';
  /* the toolbar: preview and print; the Save as PDF here matches its neighbours (Paul's ruling, 14 Sep 2026: an exception to the quiet form, because it sits in a block of buttons) */
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 16px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+btnG('Preview the report','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+btnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+'<span style="font-size:12px;color:var(--text-faint);margin-left:6px">'+d.units.length+' section'+(d.units.length===1?'':'s')+'</span></div>';
  /* two panes: the sections in order (twice the width) and the content options (its own width) */
  h+='<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:24px;align-items:start">';
  /* left: the contents being built */
  var sel=UI.rcSel!=null?d.units.findIndex(function(u){return u.key===UI.rcSel}):-1;
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Sections, in order</h4>';
  if(!d.units.length)h+='<p class="t-faint-sm" style="padding:14px;border:1px dashed rgba(var(--fg-rgb),.18);border-radius:8px">Nothing chosen yet. Add content from the options on the right. Each section you add appears here as a line of the contents.</p>';
  else{h+='<div style="border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;overflow:hidden">';
    var inspector=function(u,sel){var fact=rcUnitFact(u); /* 14 Sep 2026 (Paul's ruling): the inspector opens directly beneath the selected row, inside the list, so it is never off the page */
      h+='<div style="padding:14px 16px 16px 50px;border-top:1px solid rgba(var(--fg-rgb),.14);background:var(--bg-elev)">';
      h+='<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 6px"><span style="font-family:var(--serif);font-size:22px;line-height:1;color:var(--text-faint)">'+(sel+1)+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(u.kind==='text'?(u.name||'Untitled text page'):u.name)+'</span><span style="font-size:12px;color:var(--text-faint)">'+rcKindLabel(u)+'</span><span style="flex:1"></span>'+(u.kind!=='text'?btnG('Preview this section','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px'):'')+btnG('Close','UI.rcSel=null;render()','font-size:12px')+'</div>';
      if(u.kind==='text'){
        h+='<p class="t-faint-sm" style="margin:0 0 10px">A page you write, printed as its own numbered section. Use it to open a part of the report or to add a page of your own between sections.</p>';
        h+='<input type="text" id="rc_head_'+u.id+'" data-uncapped="1" value="'+esc(u.name||'')+'" placeholder="Heading for this text page" style="width:100%;font-size:15px;font-weight:600;margin:0 0 8px" onchange="rcSetUnit(\''+d.id+'\','+sel+',\'name\',this.value)">';
        h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">'+seg(false,'<b>B</b>','rcFmt(\''+u.id+'\',\'bold\')')+seg(false,'<i>I</i>','rcFmt(\''+u.id+'\',\'italic\')')+'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);align-self:center;margin:0 4px 0 8px">SIZE</span>'+seg(false,'Small','rcFmt(\''+u.id+'\',\'size\',\'small\')')+seg(false,'Normal','rcFmt(\''+u.id+'\',\'size\',\'normal\')')+seg(false,'Large','rcFmt(\''+u.id+'\',\'size\',\'large\')')+seg(false,'Heading','rcFmt(\''+u.id+'\',\'size\',\'heading\')')+'</div>';
        h+='<div id="rc_txt_'+u.id+'" contenteditable="true" class="rc-text-edit" style="min-height:260px;padding:14px 16px;border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;font-size:14px;line-height:1.7;background:rgba(var(--fg-rgb),.02);color:var(--paper);outline:none" oninput="rcSetTextHtml(\''+d.id+'\','+sel+',this.innerHTML)">'+rcSanitize(u.html||'')+'</div>';
        h+='<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0">'+btnS('Save','rcSaveText(\''+d.id+'\','+sel+')','#2A5A5A','font-size:12px')+btnG('Preview this page','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px')+'<span style="font-size:12px;color:var(--text-faint)">Select text, then Bold, Italic, or a size.</span></div>';
      }else{
        h+='<p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 10px">'+esc(rcUnitDesc(u))+(fact?' <span style="color:var(--text-faint)">('+esc(fact)+')</span>':'')+'</p>';
        if(u.depth!==undefined&&u.depth!=='')h+='<div style="margin:0 0 10px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:6px">DEPTH</span>'+seg(u.depth==='summary','Summary','rcSetDepth(\''+d.id+'\','+sel+',\'summary\')')+seg(u.depth==='full','Full','rcSetDepth(\''+d.id+'\','+sel+',\'full\')')+'</div>';
        h+='<label class="form-label">Note for this section</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed at the head of the section.</p><textarea rows="4" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSetNote(\''+d.id+'\','+sel+',this.value);render()">'+esc(u.note||'')+'</textarea>';
      }
      h+='</div>'};
    d.units.forEach(function(u,i){var on=(i===sel);var fact=rcUnitFact(u);var noted=(u.kind==='text')?!!(u.html&&u.html.replace(/<[^>]*>/g,'').trim()):!!(u.note&&u.note.trim());
      h+='<div onclick="UI.rcSel='+(on?'null':'\''+u.key+'\'')+';render()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:'+(i?'1px solid rgba(var(--fg-rgb),.06)':'none')+';'+(on?'background:rgba(var(--fg-rgb),.06)':'')+'">'
        +'<span style="font-family:var(--serif);font-size:17px;line-height:1;color:var(--text-faint);min-width:28px;text-align:right">'+(i+1)+'</span>'
        +'<span style="flex:1;min-width:0;font-size:13.5px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.kind==='text'?'<em style="font-style:normal;font-weight:600">'+esc(u.name||'Untitled text page')+'</em>':'<span style="font-weight:600">'+esc(u.name)+'</span>')+'</span>'
        +'<span style="font-size:11px;color:var(--text-faint);white-space:nowrap">'+rcKindLabel(u)+'</span>'
        +(fact?'<span style="font-size:11px;color:var(--text-muted);white-space:nowrap">'+esc(fact)+'</span>':'')
        +(u.depth?'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap">'+u.depth+'</span>':'')
        +'<span title="'+(noted?'A note is written':'No note')+'" style="width:7px;height:7px;border-radius:50%;background:'+(noted?'var(--gold-text)':'rgba(var(--fg-rgb),.15)')+';flex-shrink:0"></span>'
        +'<span style="display:inline-flex;gap:2px;margin-left:4px">'+ico('\u2191','rcMove(\''+d.id+'\','+i+',-1)','Move up',i===0)+ico('\u2193','rcMove(\''+d.id+'\','+i+',1)','Move down',i===d.units.length-1)+ico('\u00d7','rcRemoveAt(\''+d.id+'\','+i+')','Remove this section')+'</span></div>';
      if(i===sel)inspector(u,i)});
    h+='</div>';
  }
  h+='</div>';
  /* right: report content options */
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Report Content Options</h4>';
  var groups=[];var byG={};cat.forEach(function(u){if(!byG[u.group]){byG[u.group]=[];groups.push(u.group)}byG[u.group].push(u)});
  var row=function(u){var k=rcKey(u);var on=!!chosen[k];
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px"><span style="flex:1;min-width:0;color:'+(on?'var(--text-faint)':'var(--paper)')+'">'+(on?'\u2713 ':'')+esc(u.name)+(u.sub?' <span style="font-size:11px;color:var(--text-faint)">'+esc(u.sub)+'</span>':'')+'</span>'
      +(on?seg(false,'Remove','rcToggle(\''+d.id+'\',\''+k+'\')'):(u.depths?(seg(false,'Summary','rcToggle(\''+d.id+'\',\''+k+'\',\'summary\')')+seg(false,'Full','rcToggle(\''+d.id+'\',\''+k+'\',\'full\')')):seg(false,'Add','rcToggle(\''+d.id+'\',\''+k+'\')')))+'</div>'};
  /* the first option: a text page */
  h+='<div style="margin:0 0 14px"><div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(var(--fg-rgb),.14);border-radius:8px;font-size:13px"><span style="flex:1;min-width:0"><span style="font-weight:600;color:var(--paper)">Text page</span> <span style="font-size:11px;color:var(--text-faint)">A heading and a body you write, added after the selected section or at the end</span></span>'+seg(false,'Add','rcAddText(\''+d.id+'\','+(sel>=0?(sel+1):'null')+')')+'</div></div>';
  groups.forEach(function(g){var list=byG[g];
    h+='<div style="margin:0 0 14px"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:0 0 4px;border-bottom:1px solid rgba(var(--fg-rgb),.18);margin:0 0 2px;display:flex;align-items:baseline;gap:8px">'+esc(g)+'<span style="font-family:var(--sans);letter-spacing:0;text-transform:none;font-size:11px;color:var(--text-faint)">'+list.length+'</span></div>';
    if(g==='Individual Risks'){var F=rcRiskFilter();var P=getPortfolios();var systems=data.systems||[];
      h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px"><input type="search" placeholder="Search risks by name" value="'+esc(F.q)+'" style="flex:1;min-width:160px;font-size:12px;padding:4px 8px" oninput="rcSetFilter(\'q\',this.value)"><select style="font-size:12px;padding:4px 6px" onchange="rcSetFilter(\'sys\',this.value)"><option value=""'+(F.sys?'':' selected')+'>Every AI system</option>'+systems.map(function(sx){return '<option value="'+esc(sx.id)+'"'+(F.sys===sx.id?' selected':'')+'>'+esc(sx.name||'Unnamed system')+'</option>'}).join('')+'<option value="external"'+(F.sys==='external'?' selected':'')+'>External risks</option></select></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:0 0 6px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">PORTFOLIO</span>'+[['all','All'],['identify','Identify'],['assess','Assess'],['manage','Manage &amp; Monitor'],['emergency','Emergency Response'],['archived','Archived']].map(function(x){return seg(F.pf===x[0],x[1],'rcSetFilter(\'pf\',\''+x[0]+'\')')}).join('')+'<span style="width:8px"></span>'+seg(F.urg,'Urgent (10+)','rcSetFilter(\'urg\','+(!F.urg)+')')+seg(F.eth,'Responsible AI','rcSetFilter(\'eth\','+(!F.eth)+')')+'</div>';
      var shown=list.filter(function(u){return rcRiskPasses(u.rec,F,P)});
      h+='<div style="font-size:11px;color:var(--text-faint);margin:0 0 2px">'+shown.length+' of '+list.length+' risk'+(list.length===1?'':'s')+(shown.length!==list.length?' shown':'')+'</div>';
      if(!shown.length)h+='<p class="t-faint-sm" style="padding:8px 0">No risk matches these filters.</p>';
      shown.forEach(function(u){h+=row(u)});
    }else list.forEach(function(u){h+=row(u)});
    h+='</div>'});
  h+='</div></div>';
  return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 113 — Add the function behind a text page's Save button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcEditor` ends, after its closing `}`. You added that function in Step 112.

**Code:**

```js
function rcSaveText(id,i){var el=document.getElementById('rc_txt_'+(rcFind(id).units[i]||{}).id);if(el)rcSetTextHtml(id,i,el.innerHTML);var hd=document.getElementById('rc_head_'+(rcFind(id).units[i]||{}).id);if(hd)rcSetUnit(id,i,'name',hd.value);UI.rcSel=null;render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 114 — Add the function behind a section's Preview this section button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSaveText` ends, after its closing `}`. You added that function in Step 113.

**Code:**

```js
/* Save keeps the text and the heading and closes the inspector */
function rcPreviewUnit(id,i){var d=rcFind(id);if(!d||!d.units[i])return;var u=d.units[i];var title=(d.name||'Report')+' \u2014 section '+(i+1);printPage(title,rcSection(u,i).replace('page-break-before:always','page-break-before:auto'),{preview:true})}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 115 — Add the function that states a section's size, such as "14 records".

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPreviewUnit` ends, after its closing `}`. You added that function in Step 114.

**Code:**

```js
/* 14 Sep 2026 (Paul's ruling): the section as the report carries it — its number, heading, note, and body — with no cover of its own */
function rcUnitFact(u){ /* a fact about the section's size, read from the record */
  var n=function(c,w,pl){return c+' '+(c===1?w:(pl||w+'s'))};var P=null;try{P=getPortfolios()}catch(e){}
  if(u.kind==='output'){var regs=data.regimes||[];var applies=regs.filter(function(g){return g.scoping&&g.scoping.judgment==='applies'});
    return ({'out-riskreg':P?n(P.identify.length,'record'):'','out-assessedreg':P?n(P.assess.length,'record'):'','out-updatedreg':P?n(P.manage.length,'record'):'','out-sysinv':n((data.systems||[]).length,'system'),'out-reglandscape':n(regs.length,'regime'),'out-compliance':n(applies.length,'regime'),'out-ethicsdoc':n((((data.ethicalFramework||{}).principles)||[]).length,'principle'),'out-raci2':n(((typeof ensureGovRaciModel==='function'&&ensureGovRaciModel()),(data.raciActs||[])).length,'activity','activities'),'out-testing':n((data.systems||[]).filter(function(x){return ((x.testingPlan||{}).tests||[]).length||(x.testEvidence||[]).length}).length,'system')})[u.id]||''}
  if(u.kind==='page'){if(u.id==='5.3')return n((typeof tcLogEntries==='function'?tcLogEntries():[]).length,'logged result');if(u.id==='mgmt-hub'){var ms=mgStats();return ms.done+' of '+ms.total+' steps done'}return ''}
  if(u.kind==='cdtab'){var regs2=data.regimes||[];return u.id==='dash'?n(NIST_SUBCATS.length,'subcategory','subcategories'):u.id==='reg'?n(regs2.length,'regime'):n(regs2.filter(function(g){return g.scoping&&g.scoping.judgment==='applies'}).length,'regime')}
  if(u.kind==='portfolio')return P?n((P[u.id]||[]).length,'risk'):'';
  if(u.kind==='record'){var recs={risk:data.risks,regime:data.regimes,system:data.systems}[u.type]||[];var r=recs.find(function(x){return x.id===u.id});if(!r)return 'No longer exists';
    if(u.type==='risk'){var c=compositeOf(r);return (c?c+'/15':'')+(r.classification?(c?' \u00b7 ':'')+respLabel(r.classification):'')}
    if(u.type==='regime')return n((r.obligations||[]).length,'obligation');
    return n(((r.testingPlan||{}).tests||[]).length,'test')}
  if(u.kind==='text'){var words=String(u.html||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').trim().split(/\s+/).filter(Boolean).length;return words?n(words,'word'):'Nothing written yet'}
  return ''}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 116 — Add the function that describes what a section prints, in one sentence.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitFact` ends, after its closing `}`. You added that function in Step 115.

**Code:**

```js
function rcUnitDesc(u){ /* one plain sentence on what the section prints */
  var D={
   'out-assessprofile':'The organization\u2019s baseline in its own words: where AI operates, the appetite for risk, the controls in place, and who decides.',
   'out-sysinv':'Every AI system the organization runs or is building: what it does, the data it uses, the people it affects, and how it is governed, after an overview of the estate.',
   'out-riskreg':'Every risk logged and not yet assessed: what could happen, the rapid screen\u2019s scores, and the selection decision, urgent risks first.',
   'out-reglandscape':'Every regime that might bind the organization, with the scoping judgment on whether it applies and which systems it reaches.',
   'out-ethicsdoc':'The principles the organization holds itself to, by domain, each with its details and what would breach it, and the board that reviews them.',
   'out-raci2':'Who is responsible, accountable, consulted, and informed for each governance activity, as a matrix on a landscape page.',
   'out-govsystems':'How governance is set up: the model, the owner, the review cadences, the escalation path, and the capability the organization has to run it.',
   'out-compliance':'Every regime the organization has scoped in, with its obligations, their status, and the evidence for each.',
   'out-assessedreg':'Every risk that has been assessed: the assessment, the score, and the classification, urgent risks first.',
   'out-testing':'Every system with a testing plan: its tests and the results they have produced.',
   'out-govfw':'The governance framework as a whole: the principles, the structure, the cadences, the registers, and the plans.',
   'out-updatedreg':'Every risk being managed or monitored: the assessment, the classification, and the plan the classification calls for, with anything missing named, one record per page.',
   'page:5.1':'The state of governance today: program coverage, the review cadences, the systems list, the principles, the risk portfolios, and the RACI matrix.',
   'page:5.3':'Every system\u2019s tests and the results they have produced, with the log of every result on a page of its own.',
   'page:mgmt-hub':'Every step of the program with its owners, its due date, and its state; the week ahead; and how completion paces against the 90 days.',
   'page:5.4':'Charts of the register: where risk concentrates, how the portfolios flow, the top exposures, testing evidence, exit readiness, and the gaps.',
   'cdtab:dash':'The NIST AI RMF subcategories: what each asks, where work of that kind lives in the program, and whether it is addressed.',
   'cdtab:reg':'Every regime scoped in, with its scoping judgment, and then the regimes still awaiting one.',
   'cdtab:obl':'Every regime on the register with its obligations, their status, and their evidence.',
   'review:ethics':'The board\u2019s agenda with what each item reviews: the screening decisions, the plans, the emergency responses, the archive rationales, and the register, one item per page.',
   'review:governance':'The governance review\u2019s agenda with the facts each item presents and the three closing questions.',
   'portfolio:identify':'The risks logged and not yet assessed, urgent risks first.',
   'portfolio:assess':'The risks advanced to assessment, urgent risks first.',
   'portfolio:manage':'The risks the organization has committed to, managed or monitored, urgent risks first.',
   'portfolio:emergency':'The escalated risks, each opening with its emergency plan.',
   'portfolio:archived':'The risks closed as dismissed, accepted, or resolved, with the rationale for each.',
   'record:risk':'This risk\u2019s full record: every layer it has reached, from its first card to its plans.',
   'record:regime':'This regime\u2019s full record: its scoping, its obligations, and its review.',
   'record:system':'This system\u2019s full record: its inventory entry, its tests, and its evidence.',
   'text':'A page you write, printed as its own numbered section.'};
  return D[u.kind==='output'?u.id:(u.kind==='record'?'record:'+u.type:(u.kind==='text'?'text':u.kind+':'+u.id))]||''}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 117 — Add the function that reads the Individual Risks filters.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitDesc` ends, after its closing `}`. You added that function in Step 116.

**Code:**

```js
function rcRiskFilter(){if(!UI.rcF)UI.rcF={q:'',pf:'all',urg:false,eth:false,sys:''};return UI.rcF}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 118 — Add the function that changes an Individual Risks filter.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcRiskFilter` ends, after its closing `}`. You added that function in Step 117.

**Code:**

```js
function rcSetFilter(k,v){var F=rcRiskFilter();F[k]=v;render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 119 — Add the function that decides whether a risk passes the filters.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetFilter` ends, after its closing `}`. You added that function in Step 118.

**Code:**

```js
function rcRiskPasses(r,F,P){if(!r)return false;
  if(F.q&&String(r.name||'').toLowerCase().indexOf(String(F.q).toLowerCase())<0)return false;
  if(F.pf&&F.pf!=='all'){var lane=(P[F.pf]||[]);if(!lane.some(function(x){return x.id===r.id}))return false}
  if(F.urg&&!(compositeOf(r)>=10))return false;
  if(F.eth&&!isEthDesignated(r))return false;
  if(F.sys){if(F.sys==='external'){if(r.source!=='external')return false}else if(r.systemId!==F.sys)return false}
  return true}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 120 — Add the function that writes the small text under a risk in the options list.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcRiskPasses` ends, after its closing `}`. You added that function in Step 119.

**Code:**

```js
function rcRiskSub(r){var P=getPortfolios();var lane=['identify','assess','manage','emergency','archived'].filter(function(k){return (P[k]||[]).some(function(x){return x.id===r.id})})[0];var L={identify:'Identify',assess:'Assess',manage:'Manage & Monitor',emergency:'Emergency Response',archived:'Archived'}[lane]||'';var c=compositeOf(r);return [L,c?c+'/15':'',c>=10?'Urgent':'',isEthDesignated(r)?'Responsible AI':''].filter(Boolean).join(' \u00b7 ')}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 121 — Add the function that adds a text page to a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcRiskSub` ends, after its closing `}`. You added that function in Step 120.

**Code:**

```js
function rcAddText(id,at){var d=rcFind(id);if(!d)return;var u={key:'text:'+Math.random().toString(36).slice(2,9),kind:'text',id:'',type:'',name:'',html:'',depth:'',note:''};u.id=u.key.slice(5);if(at==null||at>=d.units.length)d.units.push(u);else d.units.splice(at,0,u);UI.rcSel=u.key;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 122 — Add the function that saves a field of a section.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcAddText` ends, after its closing `}`. You added that function in Step 121.

**Code:**

```js
/* the new page opens in the inspector */
function rcSetUnit(id,i,k,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i][k]=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 123 — Add the function that removes a section by its position.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetUnit` ends, after its closing `}`. You added that function in Step 122.

**Code:**

```js
function rcRemoveAt(id,i){var d=rcFind(id);if(!d||!d.units[i])return;d.units.splice(i,1);saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 124 — Add the function that saves a text page's body.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcRemoveAt` ends, after its closing `}`. You added that function in Step 123.

**Code:**

```js
function rcSetTextHtml(id,i,html){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].html=rcSanitize(html);saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 125 — Add the function behind the Bold, Italic, and size buttons.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetTextHtml` ends, after its closing `}`. You added that function in Step 124.

**Code:**

```js
function rcFmt(uid,cmd,val){var el=document.getElementById('rc_txt_'+uid);if(!el)return;el.focus();
  if(cmd==='bold'||cmd==='italic'){document.execCommand(cmd,false,null)}
  else if(cmd==='size'){document.execCommand('fontSize',false,{small:'2',normal:'3',large:'5',heading:'6'}[val]||'3')}
  el.dispatchEvent(new Event('input'))}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 126 — Add the function that keeps only bold, italics, sizes, paragraphs, and line breaks in a text page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFmt` ends, after its closing `}`. You added that function in Step 125.

**Code:**

```js
function rcSanitize(html){ /* authored text keeps only its shape: paragraphs, breaks, bold, italics, and a size; everything else is dropped */
  var root=document.createElement('div');root.innerHTML=String(html||'');
  var SIZE={'1':'11px','2':'12px','3':'14px','4':'16px','5':'18px','6':'22px','7':'26px'};
  var walk=function(node){var out='';for(var i=0;i<node.childNodes.length;i++){var n=node.childNodes[i];
    if(n.nodeType===3){out+=esc(n.nodeValue);continue}
    if(n.nodeType!==1)continue;var tag=n.tagName.toLowerCase();if(tag==='script'||tag==='style'||tag==='iframe'||tag==='object'||tag==='embed')continue;var inner=walk(n);
    if(tag==='br'){out+='<br>';continue}
    if(tag==='b'||tag==='strong'){out+='<b>'+inner+'</b>';continue}
    if(tag==='i'||tag==='em'){out+='<i>'+inner+'</i>';continue}
    if(tag==='p'||tag==='div'||tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4'||tag==='li'||tag==='ul'||tag==='ol'){var st='';if(tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4')st=' style="font-size:22px;font-weight:700"';var fs=n.style&&n.style.fontSize;if(fs&&/^\d+(\.\d+)?px$/.test(fs))st=' style="font-size:'+fs+'"';out+='<div'+st+'>'+inner+'</div>';continue}
    if(tag==='font'&&n.getAttribute('size')&&SIZE[n.getAttribute('size')]){out+='<span style="font-size:'+SIZE[n.getAttribute('size')]+(n.getAttribute('size')==='6'||n.getAttribute('size')==='7'?';font-weight:700':'')+'">'+inner+'</span>';continue}
    if(tag==='span'){var fs2=n.style&&n.style.fontSize;var fw=n.style&&n.style.fontWeight;var st2=[];if(fs2&&/^\d+(\.\d+)?px$/.test(fs2))st2.push('font-size:'+fs2);if(fw==='700'||fw==='bold')st2.push('font-weight:700');out+=st2.length?'<span style="'+st2.join(';')+'">'+inner+'</span>':inner;continue}
    out+=inner}return out};
  return walk(root)}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 127 — Add the function behind the Preview the report button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSanitize` ends, after its closing `}`. You added that function in Step 126.

**Code:**

```js
function rcPreview(id){var d=rcFind(id);if(!d)return;printPage(d.name||'Report',rcCompile(id),{preview:true})}
```

**Nothing to check yet.** This change becomes visible at Step 129.

---

### Step 128 — Replace the function that draws the More menu. It gains the Report Manager item.

**Kind:** Replace existing code.

**Where:** Find the function named `_navMoreHtml`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function _navMoreHtml(){var _zz=UI.zoom||1,_zp=Math.round(_zz*100);return (
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function _navMoreHtml(){var _zz=UI.zoom||1,_zp=Math.round(_zz*100);return (
      '<div class="nav-more-backdrop" onclick="closeNavMore()"></div>'+
      '<div class="nav-more-menu" role="menu">'+
        '<div class="nav-more-zoom">'+
          '<div class="nmz-head"><span class="nmz-lbl">View</span><span class="nmz-val">'+_zp+'%</span></div>'+
          '<div class="nmz-row">'+
            '<button class="nmz-btn" onclick="zoomOut()" title="Zoom out"'+(_zz<=0.5?' disabled':'')+'>\u2212</button>'+
            '<button class="nmz-btn" onclick="zoomIn()" title="Zoom in"'+(_zz>=2?' disabled':'')+'>+</button>'+
            '<button class="nmz-chip" onclick="zoomFit()" title="Fit page to screen">Fit</button>'+
            '<button class="nmz-chip" onclick="zoomReset()" title="Reset to 100%">Reset</button>'+
          '</div>'+
        '</div>'+
        '<div class="nav-more-sep"></div>'+
        
        '<button class="nav-more-item'+(currentPage==='mgmt-hub'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'mgmt-hub\')"><span class="nav-more-ic">\u25a6</span> Track Program</button>'+ '<button class="nav-more-item'+(currentPage==='reports'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'reports\')"><span class="nav-more-ic">\u2637</span> Report Manager</button>'+ /* 12 Sep 2026 (Paul's ruling): the report compiler's door */
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleVoice()"><span class="nav-more-ic">&#9673;</span> Voice</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openOrg()"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Profile</button>'+
        (isAppAdmin?'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openAdmin()"><span class="nav-more-ic">&#9638;</span> Admin</button>':'')+
        '<div class="nav-more-sep"></div>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedSampleData()"><span class="nav-more-ic">&#8635;</span> Load the seeded example</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();exportState()"><span class="nav-more-ic">&#8595;</span> Export state</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();importState()"><span class="nav-more-ic">&#8593;</span> Import state</button>'+
        '<button class="nav-more-item nav-more-danger" role="menuitem" onclick="closeNavMore();clearData()"><span class="nav-more-ic">&#10005;</span> Reset all data</button>'+
      '</div>')}
```

**Check:** Open the More menu (the ··· button at the top right). It lists an item reading Report Manager.

---

### Step 129 — Replace the function that draws the current page. It now knows the Report Manager page.

**Kind:** Replace existing code.

**Where:** Find the function named `render`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function render(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* getRiskStages and getLitScore deleted 16 Aug 2026 (ruled: dead code, zero consumers) */




/* isStepDone replaced by module version below */

function render(){
  try{syncNavHeight()}catch(e){}
  try{notifySweepDeadlines()}catch(e){}
  var _fEl=document.activeElement,_fid=_fEl&&_fEl.id,_fsel=(_fEl&&typeof _fEl.selectionStart==='number')?_fEl.selectionStart:null;
  try{
    // Preserve unsaved form values before re-render
    var _fc={};
    var _fields=document.querySelectorAll('input[id],textarea[id],select[id]');
    for(var fi=0;fi<_fields.length;fi++){var f=_fields[fi];if(f.id){var _ew=(f.closest?f.closest('[data-ent]'):null);_fc[f.id+'::'+(_ew?_ew.getAttribute('data-ent'):'')]=f.value}}/* field-bleed class closed (21 Aug 2026, ruled by Paul): drafts are keyed by field AND entity */

    var app=$('app'),nt=$('navTabs'),nr=$('navRight');
    var navEl=document.querySelector('nav'),ftEl=$('appFooter');
    if(!currentOrgId || !currentUserId || !getCurrentUser()){
      if(nt) nt.innerHTML=''; if(nr) nr.innerHTML='';
      if(navEl) navEl.style.display='none'; if(ftEl) ftEl.style.display='none';
      var _esb=$('pipSidebar'); if(_esb) _esb.style.display='none';
      var _cf=$('coachFab'); if(_cf) _cf.style.display='none';
      var _vf=$('voiceFab'); if(_vf) _vf.style.display='none';
      var _cp=$('coachPanel'); if(_cp) _cp.className='coach-panel';
      var _mcE=$('mainContent'); if(_mcE) _mcE.classList.add('sidebar-collapsed');
      app.innerHTML = renderEntry();
      var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !(UI.entry&&UI.entry.err)) ef.focus();
      if(typeof updateAdminBar==='function') updateAdminBar();
      return;
    }
    if(navEl) navEl.style.display=''; if(ftEl) ftEl.style.display='';
    var _vsb=$('pipSidebar'); if(_vsb) _vsb.style.display='';
    var _cf2=$('coachFab'); if(_cf2) _cf2.style.display='';
    var _vf2=$('voiceFab'); if(_vf2) _vf2.style.display='';
    var _mcV=$('mainContent'); if(_mcV) _mcV.classList.remove('sidebar-collapsed');
    var pages=[{id:'home',l:'Home'},{id:'learn',l:'Learn'},{id:'overview',l:'Framework'},{id:'phase5',l:'Governance Dashboard'},{id:'insights',l:'Insights'}];
    var th='';for(var i=0;i<pages.length;i++){var p=pages[i];var act=currentPage===p.id||(currentPage==='step'&&p.id==='overview')||(currentPage==='outcome'&&p.id==='overview')||(currentPage==='phase'&&p.id==='overview');th+='<button class="nav-tab'+(act?' active':'')+'" onclick="go(\''+p.id+'\')">'+p.l+'</button>'}
    nt.innerHTML=th;
    var _zz=UI.zoom||1,_zp=Math.round(_zz*100);
    var navMoreHtml=UI.navMore?_navMoreHtml():'';
    var _cu=getCurrentUser();
    var userMenuHtml=UI.userMenu?_userMenuHtml():'';
    nr.innerHTML=(_cu?'<span class="nav-more-wrap"><div class="nav-user-chip'+(UI.userMenu?' nav-action-on':'')+'" onclick="toggleUserMenu(event)" title="Account menu" aria-haspopup="true" aria-expanded="'+(UI.userMenu?'true':'false')+'">'+userAv(_cu,26)+'<div class="nav-user-name">'+esc(_cu.name.split(' ')[0])+' \u25BE</div></div>'+userMenuHtml+'</span>':'')+'<button class="btn-ghost pad-chip-md nav-action" onclick="openHelp()" title="Help">? Help</button>'+
      '<button class="btn-ghost pad-chip-md nav-action" onclick="toggleTheme()" title="Switch theme">\u25d0 '+(UI.theme==='dark'?'Light Mode':'Dark Mode')+'</button>'+
      
      '<button id="gchatNavBtn" class="btn-ghost pad-chip-md nav-action'+(gchatOpen?' nav-action-on':'')+'" onclick="toggleGChat()">\u2261 Team Chat<span id="gchatUnread" class="gchat-unread" style="display:'+(gchatUnreadCount>0?'':'none')+'">'+gchatUnreadCount+'</span></button>'+
      '<button id="notesNavBtn" class="btn-ghost pad-chip-md nav-action'+(notesOpen?' nav-action-on':'')+'" onclick="toggleNotes()">&#9998; Notes<span id="notesCount" class="notes-count" style="display:'+(((data.notes||[]).length)?'':'none')+'">'+((data.notes||[]).length)+'</span></button>'+
      '<span class="nav-more-wrap"><button class="btn-ghost pad-chip-md nav-action'+(UI.navMore?' nav-action-on':'')+'" onclick="toggleNavMore(event)" aria-haspopup="true" aria-expanded="'+(UI.navMore?'true':'false')+'" title="More">\u22ef More</button>'+navMoreHtml+'</span>';
    renderSidebar();
    var h='';
    // Screens migrated to <name>.html + <name>.js (see Governance-screen-loader.js).
    var SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn};
    var screenFn=SCREEN_MODULES[currentPage];
    if(screenFn){screenFn(app);}
    else if(currentPage==='mgmt-hub')h=renderMgmtHub();
    else if(currentPage==='reports')h=renderReports(); /* 12 Sep 2026: the report compiler */
    else if(currentPage==='step')h=renderStep();
    else if(currentPage==='phase5')h=renderPhase5();
    else if(currentPage==='ethicsov')h=renderEthicsOverviewPage();
    else if(currentPage==='govreview')h=renderGovReview();
    else if(currentPage==='insights')h=renderInsights();
    else if(currentPage==='outcome')h=renderOutcomePage();
    else if(currentPage==='phase')h=renderPhaseLandingPage();
    else if(currentPage==='overview')h=renderModuleOverview();
    else if(currentPage==='pipeline')h=renderModuleOverview();/* fix batch 1 item 5 (R-9): the donor route lands on the overview, never a blank */
    else if(currentPage==='portfolio')h=renderPortfolioPage();
    else if(currentPage==='system')h=renderSystemView();
    if(!screenFn){
      if(h.indexOf('id="zoomWrap"')<0){ var _zs=(UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):''; h='<div class="zoom-wrap" id="zoomWrap"'+_zs+'>'+h+'</div>'; }
      app.innerHTML=h;try{var _nv=document.querySelector('nav');if(_nv&&_nv.offsetHeight){var _pt=(_nv.offsetHeight+24)+'px';document.querySelectorAll('.content-area').forEach(function(_ca){_ca.style.paddingTop=_pt})}}catch(e){}
    }
    if(_fid){setTimeout(function(){try{var _fe2=document.getElementById(_fid);if(_fe2&&typeof _fe2.focus==='function'){_fe2.focus();if(_fsel!=null&&typeof _fe2.setSelectionRange==='function')_fe2.setSelectionRange(_fsel,_fsel)}}catch(_e){}},0)}

    // Restore form values after re-render
    /* Re-inject preserved values into fields the fresh paint left empty (draft
       preservation across repaints) — EXCEPT on adoption repaints, where a field
       of a record this user does NOT hold must show the adopted state: re-injecting
       there resurrects a stale local value into a field a teammate may have just
       cleared, and the next harvest would commit it (addendum 97; §F-13a). Unmapped
       fields (rk null: panel inputs, draft forms) have no shared model value to
       resurrect and always re-inject. */
    for(var fk in _fc){var _sp=fk.lastIndexOf('::');var _fid=_sp<0?fk:fk.slice(0,_sp);var _fent=_sp<0?'':fk.slice(_sp+2);var fe=document.getElementById(_fid);if(fe&&!fe.value){var _nw=(fe.closest?fe.closest('[data-ent]'):null);if(((_nw?_nw.getAttribute('data-ent'):''))!==_fent)continue;var _ark=null;try{_ark=idToRecordKey(_fid)}catch(e2){}if(!_adoptPaint||_ark===null||_ark===_heldLock)fe.value=_fc[fk]}}

    carouselInit();

    setTimeout(function(){var els=document.querySelectorAll('.reveal');for(var i=0;i<els.length;i++){(function(el,d){setTimeout(function(){el.classList.add('visible')},d)})(els[i],i*60)}},50);
    repaintOpenPanels();
    updateNotesCount();
  if(UI.scrollTo){(function(_sid){setTimeout(function(){try{var _el=document.getElementById(_sid);if(_el&&typeof _el.scrollIntoView==='function')_el.scrollIntoView({behavior:'smooth',block:'center'});}catch(_e){}},30);})(UI.scrollTo);UI.scrollTo=null;}
    var _gk=currentStep+'/'+(UI.abSec||'');if(_gk!==_lastGateStep){gateArmed=false;_lastGateStep=_gk;}if(gateArmed)paintGates();try{refreshGates()}catch(e){}try{applyLockUI(true)}catch(e){}
  }catch(e){$('app').innerHTML='<div style="padding:120px 40px;color:var(--t-crit);font-family:monospace"><h2>Error</h2><pre>'+e.message+'</pre></div>';console.error(e)}
}
```

**Check:** Open the More menu and choose Report Manager. A page headed Report Manager opens with a button + New report.

---

### Step 130 — Replace the function behind the AI Guide button.

**Kind:** Replace existing code.

**Where:** Find the function named `toggleCoach`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function toggleCoach(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
/* 14 Sep 2026 (Paul's ruling): the Track Program page prints as its own document */

// === COACH ===
function toggleCoach(){
coachOpen=!coachOpen;
$('coachFab').className='coach-fab'+(coachOpen?' open':'');
$('fabReview').style.display=coachOpen?'none':'block';
$('coachPanel').className='coach-panel'+(coachOpen?' open':'');
if(coachOpen)renderCoachPanel();
}
```

**Check:** Click the AI Guide button at the bottom right. The guide panel opens on the first click and closes on the second.

---

### Step 131 — Replace the function that saves Organization Details. Saving a new name now also renames the organization in the sign-in list.

**Kind:** Replace existing code.

**Where:** Find the function named `saveEnterprise`. It begins with the line below. Delete the whole function, from that line to the closing `}` that ends it, and put the code in its place.

```js
function saveEnterprise(){
```

If you have changed this code since September, compare it with the reference build before replacing it, and keep your changes if they are unrelated.

**Code:**

```js
function saveEnterprise(){
  if(lockBlocked('enterprise'))return;/* O-4 CLOSED (25 Aug 2026, Paul's ruling at R2/R3 triage, on the R-4 precedent): the one-line guard lands rather than ratifying an exclusion class — R3's OBS-1 showed the modal never paints field-disable, so the focusin blur plus this guard are the whole protection */
  if(!data.enterprise)data.enterprise={};
  ['name','industry','size','region','website','maturity','sponsor','objective'].forEach(function(f){
    var el=$('ent_'+f);if(el)data.enterprise[f]=el.value;
  });
  saveData();
  /* 13 Sep 2026 (Paul's ruling): an organization has one name. Saving Organization Details writes the sign-in organization's label too, as the admin console's rename already writes Organization Details — whichever door the name changes through, both stores agree. Only when the name is non-blank and differs. */
  try{var nm=String((data.enterprise&&data.enterprise.name)||'').trim();var o=currentOrgId?getOrg(currentOrgId):null;if(nm&&o&&o.name!==nm){saveOrgs(getOrgs().map(function(x){return x.id===currentOrgId?Object.assign({},x,{name:nm}):x}))}}catch(e){}
}
```

**Check:** Open Organization & Team, change the organization's name in Organization Details, and save. Open the sign-in organization switcher: it shows the new name.

---

## 5. The test suite

Take the file `Governance-smoke.js` (md5 `a214fa53`) that comes with this document, whole. Do not edit it. It needs these eight files in the same folder: `Governance-index.html`, `Governance-app.js`, `Governance-templates-local.js`, `Governance-screen-loader.js`, `Governance-home.js`, `Governance-learn.js`, `Governance-styles.css`, and the two screen templates `Governance-home.html` and `Governance-learn.html` (these two are generated from `Governance-templates-local.js` by `node Governance-build-templates.js`, or you can take them from the reference folder). Run `node Governance-smoke.js` with the jsdom package installed. The expected last line is **Smoke: 971 pass, 0 fail**. If the result differs, stop and report every line that begins with `x` to Paul. Because your code has changes of its own, a small number of failures may come from those changes. Report them; do not edit the suite.

## 6. The example data

Steps 45 and 27 change the example data and the list of outputs. The acceptance checks below assume the example data is loaded. To load it: sign in, open the More menu (the ··· button at the top right), and choose Load sample data. Confirm when asked. The organization's records are replaced by the example organization, Aurora Windows.

## 7. Acceptance checks

1. Open the Assessment Profile (Phase 1 output) and click ▾ Save as PDF. A new window opens. Its first page shows, from the top: the line NEXTCHAPTER · 90-DAY RESPONSIBLE AI GOVERNANCE; the title Assessment Profile; a subtitle; a horizontal rule; the organization's name; today's date as words. In the print dialog's preview, every page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as 1 / 3 at the bottom right, and nothing at the top left or the top right.
2. Open the Initial Risk Register. Above the list are two small buttons SUMMARY and FULL. Click FULL: each risk's table shows more rows. Click ▾ Save as PDF: the printed document shows the same rows as the screen. Every risk table ends either with nothing or with a line beginning ▸ that names what is missing.
3. Open the Updated Risk Register and click ▾ Save as PDF. In the print preview, each risk begins on a new page.
4. Open the Systems Inventory. Below the heading, the AI Systems Overview and the Deployed / In development readout appear, then the systems. Click ▾ Save as PDF: the document's second page shows the same overview and readout, then the systems.
5. Open the Compliance Survey. Each regime is one line with a small triangle. Click a line: it opens to show the regime's scoping record. Do the same on Compliance Obligations and on Testing & Evidence.
6. Open the RACI Matrix and click ▾ Save as PDF. In the print preview, the first page is upright and the second page is turned sideways and shows the whole matrix.
7. Open the Governance Systems Report. There is no section headed RACI. Open the Management & Monitoring Plans and click ▾ Save as PDF: the two group headings read Manage (n) and Monitor (n).
8. Open the sidebar. Under Phase 1 the outputs read, in order: Assessment Profile, Systems Inventory, Initial Risk Register, Compliance Survey. Under Phase 3 there is no Risk Classification Report. Under each phase the outputs sit behind one line reading ▸ Outputs (n), which opens on click.
9. Open Phase 5, step 5.1 (Governance Dashboard). At the top right is ▾ Save as PDF. Click it. In the print preview there are seven pages: the first page; Governance Overview; Register of Responsible AI Principles; Risk Management (with the four portfolios in full-width blocks, each list in two columns); Risk Portfolio at a Glance; and a sideways page headed RACI Matrix.
10. Open Phase 5, step 5.2 (Compliance Dashboard). Under the tab buttons, at the right, a box shows PRINT DEPTH, SUMMARY, FULL, and ▾ Save as PDF. There is no Export Conformance Report button. Click ▾ Save as PDF: the first page reads Conformance Report and, below it in the same lettering, NIST AI RMF 1.0. Click the Compliance Register tab, then ▾ Save as PDF: the first page reads Compliance Register. Click FULL, then ▾ Save as PDF again: the document is longer.
11. Open Phase 5, step 5.3 (Testing Center) and click ▾ Save as PDF. The last page is headed Testing Log and lists the results as a table with dates written as words.
12. Open Phase 5, step 5.4 (Analytics) and click ▾ Save as PDF. The document has six content pages. In the System Exposure Map, no two labels overlap.
13. Open the Emergency Response portfolio (from the Governance Dashboard) and click ▾ Save as PDF. Each risk's table begins with a box headed EMERGENCY RESPONSE holding What happened, Escalated, Emergency plan in force, Lead, Triggers, First moves, Stand-down. Open the Manage portfolio and click ▾ Save as PDF: the first page's subtitle is three sentences beginning "The risks the organization has committed to".
14. Open the Governance Dashboard and click Run the Review under Responsible AI Board Review. At the top right is ▾ Save as PDF. Click it: each agenda item starts on a new page. Go back and click Run the Review under Governance Review, then ▾ Save as PDF: the document shows the seven agenda items and ends without a Review Log.
15. Open the More menu and choose Track Program. Click ▾ Save as PDF: the document's first page is titled Module Management; the next page shows four figures, This Week, and the steps of Phases 1 to 4 with their owners and state; the page after is headed Analytics.
16. Open the More menu and choose Report Manager. Click + New report. Type a title. In the list Report Content Options at the right, the first row reads Text page; click its Add button. A heading field and a text area appear at the left; type a heading and some text, click B and type a word in bold, and click Save. The section appears in the list Sections, in order with its word count. Add the Initial Risk Register with its SUMMARY button and the Governance Dashboard with its ADD button. Click Preview the report: a new window opens without a print dialog; at its top is a button Show as pages; dashed lines reading PAGE BREAK mark where pages will break. Click ▾ Save as PDF on the Report Manager: the print dialog opens, the first page shows the title, the second page is headed Contents with three numbered entries, and the sections follow, each headed with its number in the same size as its name.
17. In the Report Manager, click a section in Sections, in order. A panel opens directly under that section with a one-sentence description, a note field, and a button Preview this section. Click Preview this section: the window shows that section with its number and heading and no first page.
18. In the Report Manager's introduction field, paste more than 10,000 characters. All of it stays. In any ordinary field of the app, paste more than 10,000 characters: it is cut at 10,000.
19. Open Organization & Team, change the organization's name in Organization Details, and save. The next printed document's first page shows the new name, and the sign-in organization switcher shows it.
20. Run the test suite (section 5). The last line reads Smoke: 971 pass, 0 fail.

## 8. Checklist


- [ ] Acceptance check 1
- [ ] Acceptance check 2
- [ ] Acceptance check 3
- [ ] Acceptance check 4
- [ ] Acceptance check 5
- [ ] Acceptance check 6
- [ ] Acceptance check 7
- [ ] Acceptance check 8
- [ ] Acceptance check 9
- [ ] Acceptance check 10
- [ ] Acceptance check 11
- [ ] Acceptance check 12
- [ ] Acceptance check 13
- [ ] Acceptance check 14
- [ ] Acceptance check 15
- [ ] Acceptance check 16
- [ ] Acceptance check 17
- [ ] Acceptance check 18
- [ ] Acceptance check 19
- [ ] Acceptance check 20
