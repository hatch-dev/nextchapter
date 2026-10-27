# AI Innovation Pipeline module — changes to make, step by step
## Printed documents, project cards, the RACI matrix, the Portfolio Review, the live Phase 5 pages, and the Report Manager

**What this document is.** A list of 209 changes to the AI Innovation Pipeline module's `app.js`, to be made in order, followed by four changes to `styles.css`. Your code descends from the files Paul gave you on 12 September (`app.js` md5 `2b53c87b`, 6,622 lines; `styles.css` md5 `6401fad8`, 2,430 lines), but it is your own: you have deployed it and may have changed it since. This document therefore never gives a line number. Each step names the function or constant it changes, or the function or constant next to which new code is added, and gives the whole new code. Applied in order to the 12 September `app.js`, the 209 steps produce a file identical to the reference build that comes with this document (`app.js` md5 `5f03fefb`, 7,521 lines); applied to the 12 September `styles.css`, the four stylesheet changes produce the reference `styles.css` (md5 `6723ab64`, 2,437 lines). Where your file differs from the 12 September file, the reference build is the authority for what each function should read at the end. This document covers `app.js` and `styles.css` only; it does not touch `index.html`, the screen templates, or the other scripts.

## 1. How to apply this document

- Apply the steps in order, from Step 1 to Step 209, then the four stylesheet changes in section 5. Do not skip a step. Do not change the order.
- Before each step, find the place the step describes. Confirm that it is there exactly once.
- When a step replaces a whole function or constant, delete your whole function or constant and put the step's code in its place. If you have changed that function yourself since 12 September, compare your function with the reference build first, and keep your own changes if they are unrelated to this document.
- When in doubt, use the whole function from the reference build rather than editing lines inside it.
- Load the example data (section 7) before you begin, so that the Checks have something to show. Load it again after Step 63, which changes the example data.
- 12 of the 209 steps have a Check: something to open in the app and see. Do the Check after each of those steps. If the Check fails, stop and report the step number. The other 197 steps end with the line "Nothing to check yet", which names the later step where the change becomes visible. Where one step carries several Checks, do each.
- At the end, run the test suite described in section 6.
- Then do the acceptance checks in section 8.

## 2. Glossary

Rule for this document: no metaphors and no new words. Each term below is used in the steps and the checks with exactly this meaning.

- **Output** — one of the twelve documents the module produces at the end of its steps: Assessment Report, Blue Sky Portfolio (Phase 1); Org Readiness, RACI Matrix, Exploration Portfolio (Phase 2); Capital Snapshot, Development Portfolio (Phase 3); Governance Framework, Org Design Review, Portfolio Review (Phase 4); Operational Portfolio, Capital Planning Hub (Phase 5). Each has a page in the app, reached from the sidebar. Before this document the third output of Phase 4 was called Updated Dev Portfolio and repeated the Development Portfolio; it is now the Portfolio Review.
- **Output page** — the page in the app that shows an output.
- **Phase 5 page** — one of the pages of Phase 5: the Pipeline Dashboard (step 5.1), the Capital Planning Hub, the Quarterly Review page, and the four live portfolio pages (see below).
- **Printed document** — what appears in the new window when the user clicks ▾ Save as PDF: a first page with the title, then the content, laid out for printing or saving as a PDF.
- **First page** (of a printed document) — the page that shows, from the top: the line NEXTCHAPTER · 90-DAY AI INNOVATION PIPELINE; the title; a subtitle; a horizontal rule; the organization's name; today's date as words.
- **Print window** — the new browser window that opens when the user clicks ▾ Save as PDF. The browser's print dialog opens over it.
- **Save as PDF button** — the small button reading ▾ Save as PDF. It is drawn with the HTML `<button class="btn bg2" style="font-size:12px">`. Before this document the module's print buttons read ↓ PDF or ↓ Download as PDF; every one of them becomes this button.
- **Idea** — one entry in the pipeline, from the moment it is written down at step 1.2. In the code an idea is one item of `data.ideas`, referred to by its position number.
- **Project** — an idea after it is selected at step 1.3 and assessed at step 2.4. The same item of `data.ideas`, with a project record (`data.projects`) beside it.
- **Program** — a project in development, from step 3.4 on. The same item, with a development plan (`data.budgetPlans`) and a track (`data.tracking`) beside it.
- **Live initiative** — anything the quarterly review decides on: a program in development, an operational project, or a project in exploration with a Go verdict.
- **Card** — on paper, a bordered box with a grey name bar at its top: the name and department at the left, and at the right the verdict and score (Overview card), the development status (Development card), or the health (Operations card). The Overview card carries the project's budget figures under the bar and its eight Overview fields in two columns. The Analyses card carries the gap analysis and the SWOT. The Development card carries the program's objectives, deliverables, budget, phases, and track. The Operations card carries owner, launch date, rollout costs, and annual sustainment cost in its four corners, then success metrics, performance, and notes.
- **Summary / Full** — a choice of how much prints. For the Exploration Portfolio, Summary prints each project's Overview card and Full prints each project's Overview card, Analyses card, and Portfolio Position on one page, then its Budget page; for the Development and Operational Portfolios likewise, with the stage card first; for the Assessment Report, Full adds every scored answer; for the Blue Sky Portfolio, Full prints every row of each idea. On screen the choice is two small buttons reading SUMMARY and FULL.
- **Register** — a printed list of records or cards, with group headings where the records are grouped (for example Go, Not yet decided, No-Go in the Exploration Portfolio).
- **Record table** — how an idea prints in the Blue Sky Portfolio and in a report's Individual Ideas: a table whose first row is the idea's name and its main facts, then one section per part of the record, each section a list of labelled rows.
- **Section heading** — in a printed document, a heading in the serif face with a rule beneath it; when it has a sub-line, the sub-line sits on its own line under the title in the monospace face.
- **Quoted block** — in a printed document, a question in small uppercase letters with the organization's written answer beneath it in a tinted box with a blue rule at its left.
- **Chip** — in the RACI matrix, a letter R, A, C, or I on a round coloured disc: green for R, blue for A, brown for C, slate grey for I.
- **Live portfolio page** — a page reached from the Pipeline Dashboard's View Portfolio → buttons or its chevrons, showing the Blue Sky, Exploration, Development, or Operational Portfolio over the same record as the output page of the same name. A change on either is the same change. In the sidebar it belongs to Phase 5.
- **Quarterly Review page** — the page reached from the Pipeline Dashboard's ▶ Run Quarterly Review button. It shows the same review surface as step 4.4 over the same record, without the step's introduction, and prints the Portfolio Review.
- **Sandbox** — the first tab of the Exploration Portfolio's Allocate Capital tab, where the user ticks candidates to stage a batch on the committed calendar. Nothing there commits anything.
- **Staged batch** — the candidates ticked in the Sandbox at the moment.
- **Report Manager** — a page in the More menu (the ··· button at the top right) where the user assembles several outputs and pages into one printed report.
- **Report** — what the Report Manager prints: a first page, a contents page, an introduction, then each chosen item as a numbered section.
- **Section** — one item of a report: an output, a Phase 5 page, a single idea, or a text page, printed with a number and a heading.
- **Text page** — a section the user writes: a heading and a body.
- **Module Management page** — the page reached from the More menu item Track Program. Its heading reads Module Management.
- **Example data** — the sample organization the app can load from the More menu item Seed sample data. In the code it is `seedData`, built by `buildSeedBase`.
- **Test suite** — the file `harness.js`, which loads the app in a test sandbox and checks its behaviour.
- **Sidebar** — the menu at the left listing the phases, their steps, and their outputs.
- **More menu** — the menu that opens from the ··· button at the top right.
- **Fold** — a line of a page that is closed and opens on click, marked with a small triangle ▸ or ▾.

## 3. What the user will see when everything is done

**On every output page**
- The ▾ Save as PDF button opens a print window with a printed document: the first page as defined in the glossary, then the content laid out for paper, with no control.
- Each printed page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as "2 / 7" at the bottom right. Nothing prints at the top left or the top right. Colours print where the document uses them.
- The Assessment Report, Blue Sky Portfolio, Exploration Portfolio, Development Portfolio, and Operational Portfolio pages show two small buttons SUMMARY and FULL beside ▾ Save as PDF; their printed documents use the same choice.
- The Assessment Report prints an executive summary, At a Glance, the Readiness Profile as bars with the radar chart beneath, and at Full every scored answer in quoted blocks and five-cell strips. The Blue Sky Portfolio prints At a Glance, the Portfolio Balance, then the ideas as record tables under Now and For the Future, starting on a new page.
- The Org Readiness page shows a summary, three figures, the readiness checklist with the record behind each check, and every field of steps 2.1, 2.2, and 2.3; it prints the same, with the checklist as ticks and the fields as quoted blocks. The RACI Matrix page shows the matrix with chips and a legend and prints it alone on a landscape page. The Exploration Portfolio prints its projects as cards under Go, Not yet decided, and No-Go, each heading on the same page as its first card.
- The Capital Snapshot prints one section per budget year, then the total. The Development Portfolio prints At a Glance, the Portfolio Balance, then each program's Development card starting on a new page with no heading above; at Full each program gets its Development card, its project page, and its Budget page. The Operational Portfolio prints likewise with the Operations card first.
- The Governance Framework prints on one page as the page's own cards. The Org Design Review prints its four stress-test boxes in two rows with coloured score chips. The Portfolio Review prints At a Glance, Capital After the Decisions, the decisions grouped Buy, Hold, and Sell with each initiative's reason, the Portfolio Balance, the Portfolio Learnings, and the Review History.

**In the sidebar**
- Under each phase's steps, one line reads ▸ Outputs (n). Clicking it shows the phase's outputs. It is open while one of them is being viewed.
- Phase 4's third output reads Portfolio Review.
- The sidebar also shows on the Report Manager page, the Quarterly Review page, and the live portfolio pages, where Phase 5 is the open phase.

**On the Phase 5 pages**
- The Pipeline Dashboard's header carries ▾ Save as PDF. It prints: Pipeline Overview with the maturity gauge and its four phase bars, the two cards Next Innovation Session and Next Quarterly Review, and Operational Projects with each project's status in colour; then, on a new page, the four chevrons and a box per portfolio in its colour listing its items under sub-groups, followed at once by Portfolio at a Glance with every chart in a box.
- The dashboard's ▶ Run Quarterly Review opens the Quarterly Review page, not step 4.4. Its View Portfolio → buttons, its chevrons, and the items on its charts open the live portfolio pages, not the outputs of earlier phases. The Data Bank still opens its reference documents.
- The Capital Planning Hub carries ▾ Save as PDF and prints the tab showing, its form fields as their values. The Sandbox card of the Exploration Portfolio's Allocate Capital tab carries its own ▾ Save as PDF and prints the staged batch as a Capital Sandbox document; when the batch crosses capacity the document ends with the Capacity Breach Funding Plan.
- On step 2.1 and the RACI output page the matrix shows chips; an empty cell cycles R, A, C, I, blank on click; a legend sits beneath; every embedded lead and every engaged senior leader has a column.
- Step 4.4's Review Snapshot card shows only the sections that have content.

**In the More menu**
- Track Program prints a document titled Module Management: four figures, This Week, the steps of Phases 1 to 4 with their owners and state, and a page headed Analytics.
- An item reads Report Manager. It opens a page where the user creates a report, adds outputs, Phase 5 pages, single ideas, and text pages to it, orders them, previews the report, and prints it.

**The example data**
- Steps 4.2, 4.3, and 4.4 are complete. The first quarterly review is recorded: a decision with its reason on each of the nine live initiatives, and the five learnings. Each program's experiment record keeps only its budget.

---

## 4. The steps

### Step 1 — Delete the function named `renderStepContent` from its old place; it returns, changed, at Step 64.

**Kind:** Delete existing code.

**Where:** Delete the whole function named `renderStepContent`. It is added again, in its new place, at Step 64.

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 2 — Replace the constant describing the five phases, their steps, and their outputs, so that Phase 4's third output is named Portfolio Review.

**Kind:** Replace existing code.

**Where:** Replace the whole constant named `PH`.

**Code:**

```js

var PH=[
{id:1,name:'Diagnose',days:'Days 1\u201330',color:'#1B6B5A',steps:[{id:'1.1',name:'Assessment Battery',icon:'■'},{id:'1.2',name:'Brainstorm Use Cases',icon:'◇'},{id:'1.3',name:'Filter & Rank',icon:'◉'}],outcomes:[{id:'out-report',name:'Assessment Report',icon:'□'},{id:'out-bluesky',name:'Blue Sky Portfolio',icon:'▒'}]},
{id:2,name:'Organize',days:'Days 31\u201350',color:'#2D5A8E',steps:[{id:'2.1',name:'Ownership & Structure',icon:'+'},{id:'2.2',name:'Realign Incentives',icon:'◉'},{id:'2.3',name:'Innovation Rhythm',icon:'↻'},{id:'2.4',name:'Deepen Assessment',icon:'◉'}],outcomes:[{id:'out-orgready',name:'Org Readiness',icon:'■'},{id:'out-raci',name:'RACI Matrix',icon:'⊕'},{id:'out-explore',name:'Exploration Portfolio',icon:'▪'}]},
{id:3,name:'Prepare',days:'Days 51\u201370',color:'#8B5E3C',steps:[{id:'3.1',name:'Structure Portfolio',icon:'▒'},{id:'3.2',name:'Plan Capacity',icon:'▦'},{id:'3.3',name:'Allocate Capital',icon:'◻'},{id:'3.4',name:'Map Development Track',icon:'△'}],outcomes:[{id:'out-capplan',name:'Capital Snapshot',icon:'◻'},{id:'out-expbriefs',name:'Development Portfolio',icon:'△'}]},
{id:4,name:'Ignite',days:'Days 71\u201390',color:'#9B2D3F',steps:[{id:'4.1',name:'Run Development Track',icon:'▷'},{id:'4.2',name:'Establish Governance',icon:'—'},{id:'4.3',name:'Stress-Test Org Design',icon:'✕'},{id:'4.4',name:'Portfolio Review',icon:'↗'}],outcomes:[{id:'out-govfw',name:'Governance Framework',icon:'—'},{id:'out-orgrev',name:'Org Design Review',icon:'✕'},{id:'out-finalport',name:'Portfolio Review',icon:'↗'} /* 17 Sep 2026 (Paul's ruling): Ignite's third output is the review distilled from Step 4.4, not a second Development Portfolio */]},
{id:5,name:'Navigate',days:'Ongoing',color:'#6B4C8A',steps:[{id:'5.1',name:'Pipeline Dashboard',icon:'▒'}],outcomes:[{id:'out-oper',name:'Operational Portfolio',icon:'✕'},{id:'cap-hub',name:'Capital Planning Hub',icon:'◻'}]}
];
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 3 — Replace the function that draws the current page, so that the More menu lists the Report Manager and the app knows the Report Manager page, the Quarterly Review page, and the live portfolio pages.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `render`.

**Code:**

```js

function render(){
    try{notifySweepDeadlines()}catch(e){}
    var _fEl=document.activeElement,_fid=_fEl&&_fEl.id,_fsel=(_fEl&&typeof _fEl.selectionStart==='number')?_fEl.selectionStart:null;
  try{
    var _ssEl=document.querySelector('.sidebar-scroll'),_mcEl=document.querySelector('.main-content');
    var _ssTop=_ssEl?_ssEl.scrollTop:0,_mcTop=_mcEl?_mcEl.scrollTop:0;
    var app=$('app'),nt=$('navTabs'),nr=$('navRight');
    var navEl=document.querySelector('nav'), ftEl=$('appFooter');
    // Entry gate: organization → user → passcode
    if(!currentOrgId || !currentUserId || !getCurrentUser()){
      if(nt) nt.innerHTML='';
      if(nr) nr.innerHTML='';
      if(navEl) navEl.style.display='none';
      if(ftEl) ftEl.style.display='none';
      var _sb=$('pipSidebar'); if(_sb) _sb.style.display='none';
      app.classList.remove('sidebar-mini'); app.classList.add('sidebar-collapsed');
      app.innerHTML = renderEntry();
      var ef=document.querySelector('.login-screen input'); if(ef && document.activeElement!==ef && !UI.entry.err) ef.focus();
      if(typeof updateAdminBar==='function') updateAdminBar();
      return;
    }
    if(navEl) navEl.style.display='';
    if(ftEl) ftEl.style.display='';
    var pages=[{id:'home',l:'Home'},{id:'learn',l:'Learn'},{id:'pipeline',l:'Pipeline'},{id:'phase5',l:'Navigate'},{id:'insights',l:'Insights'}];
    var th='';for(var i=0;i<pages.length;i++){var p=pages[i];var act=currentPage===p.id||(currentPage==='step'&&p.id==='pipeline')||(currentPage==='outcome'&&p.id==='pipeline')||(['cap-hub'].indexOf(currentPage)>=0&&p.id==='phase5');th+='<button class="nav-tab'+(act?' active':'')+'" onclick="go(\''+p.id+'\')">'+p.l+'</button>'}
    nt.innerHTML=th;
    var _cu=getCurrentUser();
    var _zz = UI.zoom || 1; var _zp = Math.round(_zz * 100);
    var navMoreHtml = UI.navMore ? (
      '<div class="nav-more-backdrop" onclick="closeNavMore()"></div>'+
      '<div class="nav-more-menu" role="menu">'+
        '<div class="nav-more-zoom">'+
          '<div class="nmz-head"><span class="nmz-lbl">View</span><span class="nmz-val">'+_zp+'%</span></div>'+
          '<div class="nmz-row">'+
            '<button class="nmz-btn" onclick="zoomOut()" title="Zoom out" aria-label="Zoom out"'+(_zz<=0.5?' disabled':'')+'>\u2212</button>'+
            '<button class="nmz-btn" onclick="zoomIn()" title="Zoom in" aria-label="Zoom in"'+(_zz>=2?' disabled':'')+'>+</button>'+
            '<button class="nmz-chip" onclick="zoomFit()" title="Fit page to screen">Fit</button>'+
            '<button class="nmz-chip" onclick="zoomReset()" title="Reset to 100%">Reset</button>'+
          '</div>'+
        '</div>'+
        '<div class="nav-more-sep"></div>'+
        '<button class="nav-more-item'+(currentPage==='mgmt-hub'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'mgmt-hub\')"><span class="nav-more-ic">\u25a6</span> Track Program</button>'+'<button class="nav-more-item'+(currentPage==='reports'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'reports\')"><span class="nav-more-ic">\u2637</span> Report Manager</button>' /* 16 Sep 2026: the Report Manager in the More menu */+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleVoice()"><span class="nav-more-ic">&#9673;</span> Voice</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openOrg()"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Profile</button>'+
        (isAppAdmin?'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openAdmin()"><span class="nav-more-ic">&#9638;</span> Admin</button>':'')+
        '<div class="nav-more-sep"></div>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedData()"><span class="nav-more-ic">&#8635;</span> Seed sample data</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedDataY2()"><span class="nav-more-ic">&#8635;</span> Seed Year 2 sample</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();exportState()"><span class="nav-more-ic">&#8595;</span> Export state</button>'+
        '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();importState()"><span class="nav-more-ic">&#8593;</span> Import state</button>'+
        '<button class="nav-more-item nav-more-danger" role="menuitem" onclick="closeNavMore();clearData()"><span class="nav-more-ic">&#10005;</span> Reset all data</button>'+
      '</div>'
    ) : '';
    nr.innerHTML=(_cu?'<div class="nav-user-chip" onclick="signOut()" title="Click to sign out">'+userAv(_cu,26)+'<div class="nav-user-name">'+esc(_cu.name.split(" ")[0])+'</div></div>':'')+'<button class="btn-ghost pad-chip-md nav-action" onclick="openHelp()" title="Help">? Help</button><button class="btn-ghost pad-chip-md nav-action" onclick="toggleTheme()" title="Switch theme">\u25d0 '+(UI.theme==='dark'?'Light Mode':'Dark Mode')+'</button><button id="gchatNavBtn" class="btn-ghost pad-chip-md nav-action'+(gchatOpen?' nav-action-on':'')+'" onclick="toggleGChat()">≡ Team Chat<span id="gchatUnread" class="gchat-unread" style="display:'+(gchatUnreadCount>0?'':'none')+'">'+gchatUnreadCount+'</span></button><button id="notesNavBtn" class="btn-ghost pad-chip-md nav-action'+(notesOpen?' nav-action-on':'')+'" onclick="toggleNotes()">&#9998; Notes<span id="notesCount" class="notes-count" style="display:'+(((data.notes||[]).length)?'':'none')+'">'+((data.notes||[]).length)+'</span></button><span class="nav-more-wrap"><button class="btn-ghost pad-chip-md nav-action'+(UI.navMore?' nav-action-on':'')+'" onclick="toggleNavMore(event)" aria-haspopup="true" aria-expanded="'+(UI.navMore?'true':'false')+'" title="More">&#8943; More</button>'+navMoreHtml+'</span>';
    var h='';
    // Screens migrated to <name>.html + <name>.js (see screen-loader.js).
    // Each entry maps a page id to its container-based render function.
    var SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn};
    var screenFn=SCREEN_MODULES[currentPage];
    if(screenFn){screenFn(app);}
    else if(currentPage==='insights')h=renderInsights();
    else if(currentPage==='pipeline')h=renderPipelineOverview();
    else if(currentPage==='step')h=renderStep();
    else if(currentPage==='phase')h=renderPhaseLandingPipe(currentPhase?currentPhase.id:1);
    else if(currentPage==='outcome')h=renderOutcome();
    else if(currentPage==='phase5')h=renderPhase5();
    else if(currentPage==='cap-hub')h=renderCapHub();
else if(currentPage==='reports')h=renderReports();
else if(currentPage==='review')h=renderReviewPage(); /* 17 Sep 2026: the Quarterly Review page */
else if(currentPage==='portfolio')h=renderPortfolioPage(); /* 17 Sep 2026: a live portfolio page */ /* 16 Sep 2026: the Report Manager page */
    else if(currentPage==='mgmt-hub')h=renderMgmtHub();
    if(!screenFn){
      if(h.indexOf('id="zoomWrap"')<0){ var _zs=(UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):''; h='<div class="zoom-wrap" id="zoomWrap"'+_zs+'>'+h+'</div>'; }
      app.innerHTML=h+chartZoomOverlay();
    }
    if(_fid){setTimeout(function(){try{var _fe2=document.getElementById(_fid);if(_fe2&&typeof _fe2.focus==='function'){_fe2.focus();if(_fsel!=null&&typeof _fe2.setSelectionRange==='function')_fe2.setSelectionRange(_fsel,_fsel)}}catch(_e){}},0)}
    renderSidebar();
    syncNavHeight();
    setTimeout(function(){var els=document.querySelectorAll('.reveal');for(var i=0;i<els.length;i++){(function(el,d){setTimeout(function(){el.classList.add('visible')},d)})(els[i],i*60)}},50);
    carouselInit();
    if(coachOpen)renderCoachPanel();
    if(notesOpen)renderNotesPanel();
    initBalancePops();
    updateNotesCount();
    updateAdminBar();
    var _ss2=document.querySelector('.sidebar-scroll');if(_ss2&&_ssTop)_ss2.scrollTop=_ssTop;
    var _mc2=document.querySelector('.main-content');if(_mc2&&_mcTop)_mc2.scrollTop=_mcTop;
    var _gk=currentStep+'/'+(UI.sec||'');if(_gk!==_lastGateStep){gateArmed=false;_lastGateStep=_gk;}if(gateArmed)paintGates();applyLockUI(true);
  }catch(e){$('app').innerHTML='<div class="u-d829b04"><h2>Error</h2><pre>'+e.message+'</pre></div>';console.error(e)}
}
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 4 — Add the function that draws the body of a step's page (the part of the old renderStepContent that draws; the print control is added around it by a later step).

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderStep` ends, after its closing `}`.

**Code:**

```js

// === PIPELINE STEP FUNCTIONS ===
// Step content is rendered by re-skinned pipeline module functions.
// The master's renderStep() provides the shell (breadcrumb, step nav, progress pips, header, context, nav buttons).
// renderStepContent() routes to the pipeline's step renderers.

function renderStepContentBody(id){
  if(id==='1.1')return renderStep11();
  if(id==='1.2')return renderStep12();
  if(id==='1.3')return renderStep13();
  if(id==='2.1')return renderStep21();
  if(id==='2.2')return renderStep22();
  if(id==='2.3')return renderStep23();
  if(id==='2.4')return renderStep24();
  if(id==='3.1')return renderStep31();
  if(id==='3.2')return renderStepCap();
  if(id==='3.3')return renderStepAlloc();
  if(id==='3.4')return renderStepExp();
  if(id==='4.1')return renderStep41();
  if(id==='4.2')return renderStep42();
  if(id==='4.3')return renderStep43();
  if(id==='4.4')return renderStep44();
  if(id==='5.1')return renderPhase5Content();
  return '<p class="inline-stone">Coming soon.</p>';
}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 5 — Replace the function that draws the four stage chevrons, so that on the dashboard they open the live portfolio pages.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `pipeViz`.

**Code:**

```js
function pipeViz(activeStage,navMap,live){var st=getStages(); /* live (17 Sep 2026): on the dashboard the chevrons open the live portfolio pages */var nm=navMap||{bluesky:'out-bluesky',explore:'out-explore',experiment:'out-expbriefs',operate:'out-oper'};var stages=[{k:'bluesky',n:'Blue Sky',c:'#1B6B5A',cnt:bsNowList(st).length,nav:nm.bluesky},{k:'explore',n:'Exploration',c:'#2D5A8E',cnt:st.explore.length,nav:nm.explore},{k:'experiment',n:'Development',c:'#8B5E3C',cnt:st.experiment.length,nav:nm.experiment},{k:'operate',n:'Operational',c:'#9B2D3F',cnt:(st.operational||[]).length,nav:nm.operate}];var h='<div class="u-778010b">';var _dk=(typeof UI!=='undefined'&&UI.theme==='dark');stages.forEach(function(s,i){var lit=s.cnt>0||s.k===activeStage;
/* Fill opacity is theme-aware: translucent fills read rich on the dark ground but
   wash to pastel over the light one, killing the white labels (Faisal, July 10).
   Light mode therefore renders near-solid fills so white text keeps contrast. */
var _op=s.k===activeStage?1:(activeStage?(_dk?.32:.35):(_dk?.55:.95));
var _dim=activeStage&&s.k!==activeStage;
var _nameFill=_dim?(_dk?'rgba(244,246,249,.6)':'rgba(36,46,60,.8)'):'#fff';
var _cntFill=_dim?(_dk?'rgba(244,246,249,.5)':'rgba(36,46,60,.65)'):'rgba(255,255,255,.92)';
h+='<div class="phase-flex" style="--op:'+(lit?1:.4)+'" onclick="'+(live?'go(\'portfolio\',\''+s.nav+'\')':'go(\''+s.nav+'\')')+'"><svg viewBox="0 0 200 80" class="u-0cc49e2"><path d="'+(i===0?'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 Z':'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 L 30 40 Z')+'" fill="'+s.c+'" opacity="'+_op+'"'+(s.k===activeStage?' stroke="#000" stroke-width="1.5"':'')+'/><text x="'+(i===0?85:100)+'" y="34" text-anchor="middle" fill="'+_nameFill+'" font-size="13" font-weight="700" font-family="Helvetica Neue,Arial,sans-serif">'+s.n+'</text><text x="'+(i===0?85:100)+'" y="56" text-anchor="middle" fill="'+_cntFill+'" font-size="12" font-weight="600" font-family="Helvetica Neue,Arial,sans-serif">'+s.cnt+' item'+(s.cnt!==1?'s':'')+'</text></svg></div>'});return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 6 — Replace the function that draws the Allocate Capital tab of the Exploration Portfolio, so that the Sandbox card carries its own Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `allocCore`.

**Code:**

```js
function allocCore(){
var cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},port=data.portfolio||{},ca=data.capAlloc||{};
var goP=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
var av=capAvailable();
if(UI.capTab==null||UI.capTab>2)UI.capTab=1;if(!UI.capSim)UI.capSim={};
var h='';
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'1 \u00b7 Sandbox'},{t:2,l:'2 \u00b7 Commit & Advance'}].map(function(tb){return'<button onclick="UI.capTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.capTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.capTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.capTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
if(UI.capTab===1){
if(!goP.length)h+=card('<div class="empty-state"><p class="t-faint">No candidates to model \u2013 Go projects from Exploration appear here with their costs.</p></div>');
else{var selIdx=goP.filter(function(i){return UI.capSim[i]});
var toExp=0,fyOp=0;selIdx.forEach(function(i){toExp+=devCost(i);fyOp+=devCost(i)+opsRolloutCost(i)});
h+=card('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 class="h-sub-lg" style="margin:0">Sandbox</h3>'+btn('\u25BE Save as PDF','printCapSandbox()','bg2','font-size:12px')+'</div><p class="t-faint-sm" style="margin:6px 0 10px">Tick any combination to stack the batch onto the standing baseline \u2013 the charts redraw as the portfolio would look. This view is a sandbox: nothing here commits anything, nothing is saved.</p>'+goP.map(function(i){var pb=port[i]||{};return'<div class="row-line"><input type="checkbox"'+(UI.capSim[i]?' checked':'')+' onchange="UI.capSim['+i+']=this.checked;render()"/><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+hzWarn(i,true)+'<input type="date" value="'+esc((proj[i]||{}).startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484" style="width:132px;font-size:11px" title="Assumed start date \u2013 blank means next month"/>'+'<span class="t-faint-sm" style="min-width:150px;text-align:right">dev '+fmtMoney(devCost(i))+' \u00b7 rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span>'+badge(getScore(i)+'/50','#1B6B5A')+'</div>'}).join(''),'margin-bottom:16px');
if(!orgMonthly())h+=card('<p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to draw the batch on the program calendar.</p>','margin-bottom:16px');
else{var pmNow=progMonthOf(new Date());var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
var extras=selIdx.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}});
var brS=capBreaches(extras);
var _dated=selIdx.filter(function(i){return(proj[i]||{}).startDate}).length;
h+=card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">'+(selIdx.length?'Staged batch ('+selIdx.length+')':'The standing baseline')+'</h3>'+zoomBtn('ac_wf')+'</div>'
+(selIdx.length?'<p class="t-faint-sm" style="margin-bottom:8px">Unless otherwise specified, the assumed start for every ticked candidate is next month (program Month '+aAss+'). Committed on advancing: <strong>'+fmtMoney(toExp)+'</strong> \u2013 the full plans, reflected across the years they touch in the cells on the Commit & Advance tab.</p>':'<p class="t-faint-sm" style="margin-bottom:8px">Committed and legacy promises as they already sit on the program calendar \u2013 tick candidates above to stage the batch on top.</p>')
+orgWaterfallChart(extras)+(selIdx.length?(brS.overCapMonth?'<p class="fs-13" style="margin:14px 0 6px;color:var(--warn-text)">\u26a0 With this batch, cumulative commitments cross capacity in Month '+brS.overCapMonth+'. A funding plan will be required at Commit & Advance.</p>':'<p class="t-faint-sm" style="margin:14px 0 6px">Cumulative commitments stay under cumulative capacity across the horizon.</p>'):'')+'<div style="margin-top:6px"><div style="display:flex;justify-content:flex-end;margin-bottom:2px">'+zoomBtn('ac_cum')+'</div>'+orgCumChart(extras)+'</div><div style="margin-top:12px"><div style="display:flex;justify-content:flex-end;margin-bottom:2px">'+zoomBtn('ac_swim')+'</div>'+orgSwimlanes(extras)+'</div>','margin-bottom:16px')}}}
if(UI.capTab===2){
var br=capBreaches();var breached=br.overCapMonth>0;var ctOnly=!breached&&br.ctOverCapMonth>0;var ovs=(cap.overrides||[]);
var pmNow2=progMonthOf(new Date());var aAss2=Math.max(1,(pmNow2==null?0:pmNow2)+1);
var selIdx2=goP.filter(function(i){return UI.capSim[i]});
// 1. slim capital strip — staged batch included when ticked
var _sx2=selIdx2.map(function(i){return capAssumedExtra(i)});var _sxTot=0;_sx2.forEach(function(e){_sxTot+=capProjectWindow(e.i,e.anchor).inW});
h+=card(capCells(false,_sx2.length?_sx2:null)+(selIdx2.length?'<p class="t-faint-sm" style="margin:8px 0 0">Including the staged batch \u2013 '+selIdx2.length+' candidate'+(selIdx2.length>1?'s':'')+', +'+fmtMoney(_sxTot)+' of full plans committed on advancing, spread across the years they touch.</p>':''),'margin-bottom:16px');
// 2. advance queue — staged first, ticks live
if(!goP.length)h+=card('<div class="empty-state"><p class="t-faint">Nothing to advance \u2013 Go projects appear here from Exploration. On a first pass, advance 3\u20135, led by the quick wins.</p></div>','margin-bottom:16px');
else{h+='<h3 class="h-sub-md">Advance queue</h3><p class="t-faint-sm" style="margin-bottom:10px">Ticked candidates are the staged batch \u2013 change the mix freely here or in the sandbox, and the calendar below redraws. Unless otherwise specified, the assumed start for a ticked candidate is program Month '+aAss2+' (next month).</p>';
goP.slice().sort(function(a,b){return(UI.capSim[b]?1:0)-(UI.capSim[a]?1:0)}).forEach(function(i){var c=projCosts(i),pb=port[i]||{},graded=!!(pb.horizon&&pb.risk&&pb.reward);
var live=graded;var _brF=capBreaches([capAssumedExtra(i)]);var fits=!_brF.overCapMonth;var planOk=!!(String(cap.reallocation||'').trim()||String(cap.gapPlan||'').trim());
var costRow=function(l,v){return'<div style="display:flex;justify-content:space-between;gap:14px;margin-bottom:5px"><span class="t-faint-sm">'+l+'</span><span class="fs-14" style="font-weight:700;color:var(--paper)">'+v+'</span></div>'};
h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap"><div style="flex:1;min-width:260px"><div class="flx-row-mb"><input type="checkbox"'+(UI.capSim[i]?' checked':'')+' onchange="UI.capSim['+i+']=this.checked;render()" style="margin-right:2px"/><h4 class="h-card">'+esc((ideas[i]||{}).name)+'</h4>'+hzWarn(i,true)+(UI.capSim[i]?badge('Staged','#8B5E3C'):'')+badge(getScore(i)+'/50','#1B6B5A')+'</div><div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end"><div><div class="t-faint-sm">ASSUMED START DATE</div><input type="date" id="prj_'+i+'_startDate" value="'+esc((proj[i]||{}).startDate||'')+'" onchange="capStartSave('+i+',this.value)" onblur="deferRender()" class="u-6293484"/></div><div class="t-faint-sm" style="flex:1;min-width:150px;max-width:280px;padding-bottom:6px;line-height:1.45">'+capLandingLine(i)+'</div></div><div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+(live&&(fits||planOk)?btn('Advance to Development Portfolio \u2192','advanceWithGates('+i+')','bp','font-size:13px'):(!graded?'<span><button class="btn-ghost" disabled style="font-size:13px;opacity:.35;cursor:not-allowed">Advance to Development Portfolio \u2192</button><div class="t-faint-sm" style="margin-top:6px">Grade Horizon, Risk, and Reward at Step 3.1 first.</div></span>':'<span class="t-faint-sm">Exceeds available budget \u2013 complete the funding plan below.</span>'))+'</div></div><div style="flex:0 0 230px;padding:10px 12px;border-left:1px solid rgba(var(--fg-rgb),.08)">'+costRow('Development costs',fmtMoney(devCost(i)))+costRow('Rollout costs',fmtMoney(opsRolloutCost(i)))+costRow('Sustainment costs',fmtMoney(opsSustainCost(i))+'/yr')+'</div></div>','margin-bottom:12px')})}
// 3. one batch-aware chart card — waterfall and cumulative, both open (Paul, July 7)
if(!orgMonthly())h+=card('<h3 class="h-sub-md">On the calendar</h3><p class="t-faint-sm">Set the period start date at Step 3.2 (Plan Capacity) to draw the source-of-truth charts.</p>','margin-bottom:16px');
else{var extras2=selIdx2.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return{i:i,anchor:(a2!=null&&a2>=1)?a2:aAss2}});
h+=card('<div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">On the calendar'+(selIdx2.length?' \u2013 staged batch included':'')+'</h3>'+zoomBtn('ac_wf')+'</div><p class="t-faint-sm" style="margin-bottom:10px">'+(selIdx2.length?'The standing baseline with the staged batch stacked on top \u2013 the same picture as the sandbox.':'Every committed promise at its month on the program calendar, against the capacity line.')+'</p>'+orgWaterfallChart(extras2)
+'<div style="margin-top:16px"><div style="display:flex;align-items:center;gap:8px"><h3 class="h-sub-md" style="flex:1;margin:0">Cumulative commitments vs capacity</h3>'+zoomBtn('ac_cum')+'</div>'+(function(){var _bx=capBreaches(extras2);return _bx.overCapMonth?'<p class="fs-13" style="margin:6px 0 6px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+_bx.overCapMonth+'.</p>':'<p class="t-faint-sm" style="margin:6px 0 6px">Cumulative commitments stay under cumulative capacity across the horizon.</p>'})()+orgCumChart(extras2)+'</div>','margin-bottom:16px')}
// 4. funding plan — open and bordered when breached, folded otherwise
var fpBody=(breached?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-text)">\u26a0 Cumulative commitments cross capacity in Month '+br.overCapMonth+'. Reallocate, revise costs, drop candidates \u2013 or proceed with a recorded override (shown at the quarterly review).</p>':(function(){var L=capLens();var anyDef=false;
var strip=L.years.map(function(r){if(r.available<0)anyDef=true;return'Year '+r.y+' <strong style="color:'+(r.available<0?'#C25B73':'var(--ph1-t)')+'">'+(r.available<0?'\u2212'+fmtMoney(Math.abs(r.available)):fmtMoney(r.available))+'</strong>'}).join(' \u00b7 ');
return'<p class="t-faint-sm" style="margin-bottom:8px">Available by year: '+strip+' \u00b7 whole window <strong>'+fmtMoney(L.tot.available)+'</strong>. '+(anyDef?'Complete the funding plan below to close the gap before advancing further projects into the years in the red.':'If advancing a project pushes a year into the red, complete the funding plan below before it moves.')+'</p>'})())
+(ctOnly?'<p class="fs-13" style="margin:0 0 8px;color:var(--warn-pale)">\u26a0 Within capacity as committed, but stated contingencies would cross it in Month '+br.ctOverCapMonth+'.</p>':'')+fundPlanLines();
if(breached)fpBody+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(var(--fg-rgb),.08)"><div class="t-faint-sm" style="margin-bottom:4px">PROCEED ANYWAY \u2013 RECORDED OVERRIDE</div><div class="flx-g3" style="align-items:center"><input id="cap_overrideReason" placeholder="Why this is acceptable \u2013 shown at the quarterly review" class="row-input" style="flex:3"/>'+btn('Record override','capOverrideRecord()','bg2','font-size:12px;padding:6px 12px')+'</div></div>';
if(ovs.length)fpBody+='<div class="t-faint-sm" style="margin:10px 0 4px">OVERRIDES ON RECORD</div>'+ovs.map(function(o){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc(o.reason||'')+'</span><span class="t-faint-sm">month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+(o.by?' \u00b7 '+esc(o.by):'')+'</span></div>'}).join('');
if(breached||ctOnly)h+=card('<h3 class="h-sub-md">Capacity Breach Funding Plan</h3>'+fpBody,'margin-bottom:16px'+(breached?';border:1px solid rgba(212,160,23,.5)':';border:1px solid rgba(232,212,139,.35)'));
else{var _fpo=!!UI.expanded['fpA'];
h+=card('<div class="xh" style="cursor:pointer" onclick="UI.expanded[\'fpA\']=!UI.expanded[\'fpA\'];render()"><h3 class="h-sub-md" style="margin:0">'+(_fpo?'\u25be':'\u25b8')+' Capacity Breach Funding Plan</h3></div>'+(_fpo?'<div style="margin-top:10px">'+fpBody+'</div>':''),'margin-bottom:16px')}
// 4b. the committed calendar — own expandable card (Paul, July 7)
if(orgMonthly()){var _swm=!!UI.expanded['acSwim'];
h+=card('<div class="xh" style="cursor:pointer;display:flex;align-items:center;gap:8px" onclick="UI.expanded[\'acSwim\']=!UI.expanded[\'acSwim\'];render()"><h3 class="h-sub-md" style="flex:1;margin:0">'+(_swm?'\u25be':'\u25b8')+' The committed calendar (swimlanes)</h3>'+(_swm?'<span onclick="event.stopPropagation()">'+zoomBtn('ac_swim')+'</span>':'')+'</div>'+(_swm?'<div style="margin-top:10px">'+orgSwimlanes(extras2)+'</div>':''),'margin-bottom:16px')}
// 5. folded ledger detail: itemized committed sums and the kill & phase-out pot
var _ref=!!UI.expanded['acRef'];
h+='<div style="margin-bottom:16px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'acRef\']=!UI.expanded[\'acRef\'];render()">'+(_ref?'\u25be':'\u25b8')+' Committed Sums & Kill Pot</button></div>';
if(_ref){h+=capReadout()}
// 6. advanced — the undo list stays last
var adv=stages.experiment;
if(adv.length){h+='<h3 class="h-sub-md" style="margin-top:10px">Advanced to Development ('+adv.length+')</h3>';
adv.forEach(function(i){h+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">Development Costs '+fmtMoney(devCost(i))+'</span><button onclick="toggleExpSel('+i+')" class="btn-ghost pad-chip-sm">\u21a9 Return to Exploration</button></div>'})}}
return h}
```

**Nothing to check yet.** This change becomes visible at Step 155.

---

### Step 7 — Replace the function that draws a program's card on the Development Portfolio page, so that it shows the program's objectives and deliverables above its status and results.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `devPortBody`.

**Code:**

```js

function devPortBody(i){ /* the Development Portfolio card body, extracted July 7 so the review rows can embed the FULL live card (Paul) */
var ideas=data.ideas||[],exp=data.experiments||{},trk=data.tracking||{};
var e=exp[i]||{},idea=ideas[i],tr=trk[i]||{},killed=tr.status==='killed',pb=(data.portfolio||{})[i]||{},p=(data.projects||{})[i]||{};
return '<div style="margin-top:12px">'+ideaCardFold(i,'icoe')+'<div style="margin:0 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pcoe'+i+'\']=!UI.expanded[\'pcoe'+i+'\'];render()">'+(UI.expanded['pcoe'+i]?'\u25be':'\u25b8')+' Project card</button>'+(UI.expanded['pcoe'+i]?projCardRO(i):'')+'</div>'
+'<div class="gr-2" style="margin-bottom:10px">'+[['Objectives',p.objectives],['Deliverables',p.deliverables]].map(function(f){return '<div><div class="u-b25d981" style="margin-bottom:3px">'+f[0]+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55">'+(f[1]?esc(f[1]):'<span class="t-faint">Not yet written at Step 3.4</span>')+'</div></div>'}).join('')+'</div>' /* 17 Sep 2026 (Paul's ruling): the program\u2019s objectives and deliverables from Step 3.4 on the card, read-only */
+'<div class="gr-2">'+devStatusSel(i,tr)+ta('Results to date','trk_'+i+'_results',tr.results,'',2)+'</div>'+pausedNote(tr)
+bpHeadlineBudget(i,e)
+progDash(i,killed)
+(UI.expanded['kp'+i]===true?progKillPanel(i):'')
+'<h4 class="h-mini">Portfolio Position</h4><div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',pb.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',pb.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+sel('Reward *','port_'+i+'_w',pb.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+'</div>'
+'<div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+(tr.status==='complete'?(UI.expanded['lp'+i]?'<span class="t-faint-sm">Confirm below \u2193</span>':btn('Launch to Operational Portfolio \u2192','doLaunch('+i+')','bp','font-size:13px')):'<span class="t-faint-sm">'+(killed?'Killed \u2013 change the status to revive it.':'Complete the terminal gate, or set status to Complete, to launch.')+'</span>')+archBtn(i)+'</div>'+(tr.status==='complete'&&UI.expanded['lp'+i]?capLaunchPanel(i):'')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 8 — Replace the function that draws a project's card on the Operational Portfolio page, so that its success metrics come from the project record and its owner from the first development phase when none is recorded.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `opPortBody`.

**Code:**

```js
function opPortBody(i){ /* the Operational Portfolio card body, extracted July 7 – nested idea/project/development folds included */
var ideas=data.ideas||[],exp=data.experiments||{},trk=data.tracking||{};
var idea=ideas[i],e=exp[i]||{},tr=trk[i]||{},ops=((data.opsData||{})[i])||{},pb=(data.portfolio||{})[i]||{},opKilled=tr.status==='killed';
return '<p class="u-c3246db">'+esc(idea?idea.desc:'')+'</p>'
+ideaCardFold(i,'icoo')
+'<div style="margin:0 0 10px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'pcoo'+i+'\']=!UI.expanded[\'pcoo'+i+'\'];render()">'+(UI.expanded['pcoo'+i]?'\u25be':'\u25b8')+' Project card</button>'+(UI.expanded['pcoo'+i]?projCardRO(i):'')+'</div>'
+'<div style="margin:0 0 12px"><button class="btn-ghost pad-chip-sm" onclick="UI.expanded[\'xcoo'+i+'\']=!UI.expanded[\'xcoo'+i+'\'];render()">'+(UI.expanded['xcoo'+i]?'\u25be':'\u25b8')+' Development card</button>'+(UI.expanded['xcoo'+i]?'<div style="margin-top:8px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+devCardRO(i)+'</div>':'')+'</div>'
+'<div style="max-width:360px"><div class="soft-block" style="margin-bottom:10px"><div class="h-card-lg">OWNER</div><div class="u-e4e660d">'+esc(ops.owner||((progOrdered(i)[0]||{}).powner)||'\u2014')+'</div></div><div class="soft-block" style="margin-bottom:10px"><div class="h-card-lg">LAUNCH DATE</div><input type="date" id="ops_'+i+'_ld" value="'+esc(ops.launchDate||'')+'" onchange="updNested(\'opsData\','+i+',\'launchDate\',this.value,true)" onblur="deferRender()" class="u-6293484"/></div>'+bpHeadlineOps(i,ops)+'</div>'
+'<div class="soft-block" style="margin:2px 0 10px"><div class="h-card-lg">SUCCESS METRICS</div><div class="fs-13">'+esc(((data.projects||{})[i]||{}).metrics||'\u2014')+'</div></div>' /* 17 Sep 2026 (Paul's ruling): the project\u2019s own success metrics; the experiment field it read had no writer */+ta('Performance vs. success metric','ops_'+i+'_perf',ops.performance,'e.g. Quote turnaround averaging 3.5 hours (target: <4 hours) \u2713',2)+ta('Ongoing notes','ops_'+i+'_notes',ops.notes,'e.g. Week 3: Added 2 new product categories...',3)+'<h4 class="h-mini">Portfolio Position</h4><div class="gr-3-sm">'+sel('Time horizon *','port_'+i+'_h',pb.horizon,[{v:'',l:'Select...'},{v:'quick',l:'Quick win (weeks)'},{v:'medium',l:'Medium-term bet (months)'},{v:'long',l:'Long-term bet (6+ months)'}])+sel('Risk *','port_'+i+'_r',pb.risk,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+sel('Reward *','port_'+i+'_w',pb.reward,[{v:'',l:'Select...'},{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}])+'</div>'+'<p class="t-faint-sm" style="margin:6px 0 0">'+(opKilled?'Commitment released \u2013 wind-down costs belong in the kill & phase-out pot (Step 3.3).':(opFirstYear(i)?'Committed: development '+fmtMoney(devCost(i))+' + rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 sustainment '+fmtMoney(opsSustainCost(i))+'/yr from rollout\u2019s end':'Sustainment '+fmtMoney(opsSustainCost(i))+'/yr'))+'</p><div class="u-b95a4ce">'+(opKilled?'<button onclick="event.stopPropagation();reviveProject('+i+')" class="btn-ghost pad-chip-sm">\u21a9 Revive</button>':'')+archBtn(i,'Sunset')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 9 — Replace the function that draws the Review Snapshot card, so that only the sections with content print.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `reviewSnapshotCard`.

**Code:**

```js
function reviewSnapshotCard(){var srs=orgMonthly();if(!srs)return'';
var ideas=data.ideas||[],proj=data.projects||{},cap=data.capital||{};
var sd='',lv='',ov='',sc='',ir='';
orgCommittedSet().forEach(function(e){if(e.sunk)return;var i=e.i;var sn=(proj[i]||{}).committedSnap;if(!sn||!sn.startDate)return;var cur=(proj[i]||{}).startDate||'';if(cur&&cur!==sn.startDate)sd+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="t-faint-sm">start date: committed at '+esc(sn.startDate)+', now says '+esc(cur)+'</span></div>'});
(data.launched||[]).forEach(function(i){var lc=((data.opsData||{})[i]||{}).launchConfirm;if(!lc)return;
if(lc.expectedFo&&lc.actualPm&&lc.expectedFo!==lc.actualPm){var d=lc.actualPm-lc.expectedFo;lv+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="t-faint-sm">launch: expected plan Month '+lc.expectedFo+', launched at '+lc.actualPm+' ('+Math.abs(d)+' month'+(Math.abs(d)>1?'s':'')+(d>0?' late':' early')+')</span></div>'}
else if(lc.note&&lc.note.indexOf('review decision')>=0)lv+='<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="t-faint-sm">'+esc(lc.note)+'</span></div>'});
var lastClose=0;(data.reviewCycles||[]).forEach(function(c){if(c&&c.at>lastClose)lastClose=c.at});
(cap.overrides||[]).forEach(function(o){ov+='<div class="row-line"><span class="fs-14" style="flex:1;color:var(--warn-text)">\u26a0 Override'+(o.at>lastClose?' (since last review)':'')+': '+esc(o.reason||'')+'</span><span class="t-faint-sm">month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+'</span></div>'});
var yt=orgYearTotals()||[];
yt.forEach(function(r){if(r.capPct>1)sc+='<div class="row-line"><span class="fs-14" style="flex:1;color:var(--warn-text)">\u26a0 Year '+r.y+' sustainment takes '+(r.budget?Math.round(r.sus/r.budget*100):0)+'% of the year\u2019s budget \u2013 over the '+r.scpY+'% cap.</span></div>';
if(r.reserve)ir+='<div class="row-line"><span class="fs-14">Year '+r.y+' intake reserve '+fmtMoney(r.reserve)+' <span class="t-faint-sm">\u00b7 Development committed in Year '+r.y+': '+fmtMoney(r.dev)+' \u2013 is intake keeping pace?</span></span></div>'});
var sec=function(t,rows){return rows?'<div class="h-card-lg" style="margin:10px 0 4px">'+t+'</div>'+rows:''}; /* 17 Sep 2026 (Paul's ruling): only the sections with content print */
var body=sec('Start Date Drift',sd)+sec('Launch Variance',lv)+sec('Overrides',ov)+sec('Sustainment Cap',sc)+sec('Intake Reserve',ir);
return card('<h3 class="h-sub-lg">Review Snapshot</h3>'+(body||'<p class="t-faint-sm" style="margin:2px 0 6px">Nothing to report since the last commitment.</p>'),'margin-bottom:16px')}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 10 — Replace the function that formats an amount of money, so that a negative amount reads as a minus sign and the figure.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `fmtMoney`.

**Code:**

```js
function fmtMoney(n){if(!n)return'$0';if(n<0)return'\u2212'+fmtMoney(-n); /* 17 Sep 2026 (found on the sandbox printout): a negative amount reads as a minus and the formatted figure, not the raw number */
return n>=1000000?'$'+(n/1000000).toFixed(n%1000000?1:0)+'M':n>=1000?'$'+Math.round(n/1000)+'K':'$'+Math.round(n)}
```

**Nothing to check yet.** This change becomes visible at Step 155.

---

### Step 11 — Replace the function that draws the Capital Planning figures on screen, so that they come from the same derivation as the Capital Snapshot document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `capKpiStrip`.

**Code:**

```js
function capKpiStrip(){var K=capKpiData(UI.capYear);if(!K)return''; /* 13 Sep 2026: the figures come from capKpiData, shared with the Capital Snapshot report */
var arc=function(f,col){var R=26,C2=2*Math.PI*R;return'<svg viewBox="0 0 64 64" style="width:54px;height:54px;flex-shrink:0"><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="rgba(245,242,236,.08)" stroke-width="7"/><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-dasharray="'+(C2*f).toFixed(1)+' '+C2.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#F5F2EC">'+Math.round(f*100)+'%</text></svg>'};
var tile=function(inner,label,sub){return'<div style="flex:1;min-width:150px;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.08);border-radius:10px;background:rgba(var(--fg-rgb),.02)">'+inner+'<div style="min-width:0"><div class="fs-13" style="font-weight:600">'+label+'</div><div class="t-faint-sm">'+sub+'</div></div></div>'};
var h='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">';
h+=tile(arc(K.t1.f,K.t1.c),K.t1.label,K.t1.sub);
h+=tile('<div class="score-num-md" style="color:'+(K.t2.neg?'#C25B73':'var(--ph1-t)')+'">'+K.t2.v+'</div>',K.t2.label,K.t2.sub);
h+=tile(arc(K.t3.f,K.t3.c),K.t3.label,K.t3.sub);
return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 12 — Replace the function that draws the Module Management page, so that it carries the Save as PDF control.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderMgmtHub`.

**Code:**

```js

function renderMgmtHub(){var _w='<div class="content-area pt-110"><div class="content-inner">';
return _w+backBtn()+'<div style="display:flex;justify-content:flex-end;margin:0 0 10px">'+'<button class="btn bg2" style="font-size:12px" onclick="printMgmtAnalytics()">\u25be Save as PDF</button>'+'</div>'+mgmtHubContent()+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 157.

---

### Step 13 — Replace the function that prints the Module Management page, so that it prints the Module Management document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printMgmtAnalytics`.

**Code:**

```js
function printMgmtAnalytics(){printDocument('Module Management',mgmtHubDoc(),'')} /* 14 Sep 2026 (Governance, Paul's ruling), ported 16 Sep 2026: the Track Program page prints as its own document */
```

**Nothing to check yet.** This change becomes visible at Step 157.

---

### Step 14 — Replace the function that draws the Capital Planning Hub page, so that it carries the Save as PDF control and prints the tab showing.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderCapHub`.

**Code:**

```js

function renderCapHub(){
var _w='<div class="content-area pt-110"><div class="content-inner">';
var ideas=data.ideas||[],stages=getStages(),cap=data.capital||{},trk=data.tracking||{},arch=data.archivedItems||{},port=data.portfolio||{};
var av=capAvailable();
var h=_w+backBtn()+'<div class="mb-6">'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Capital Planning <em>Hub</em></h1><p class="u-98b80d8">The portfolio\u2019s committed costs and remaining budget in one place. Every figure here is calculated from the projects themselves \u2013 their stages, their plans, and their dates \u2013 so the page always shows the portfolio as it currently stands.</p></div>';
if(!UI._printing)h+='<div style="display:flex;justify-content:flex-end;margin:0 0 12px">'+btn('\u25BE Save as PDF','printCapHub()','bg2','font-size:12px')+'</div>'; /* 16 Sep 2026: the family print control; the tab showing prints */
if(data.capStale)h+=card('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fs-13" style="flex:1">The portfolio changed since allocations were last reviewed \u2013 projects moved stage, were archived, or were killed.</span>'+btn('\u2713 Mark Reviewed','data.capStale=false;saveData();render()','bs','font-size:12px')+'</div>','border:1px solid rgba(212,160,23,.5);background:rgba(212,160,23,.08);margin-bottom:16px');
h+=card(capCells(true)+'<div style="margin-top:10px">'+btn('\u2913 Export CSV','dlAuditCSV()','bg2','font-size:11px;padding:4px 12px')+' </div>','margin-bottom:16px');
var _ht=UI.hubTab||0;
var _htb=function(n,lbl){return'<button class="btn-ghost pad-chip-sm" style="font-size:12px;padding:5px 14px;'+(_ht===n?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.hubTab='+n+';render()">'+lbl+'</button>'};
h+='<div style="display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap">'+_htb(0,'Dashboard')+_htb(1,'Commitments')+_htb(2,'Plan & Funding')+'</div>';
if(_ht===0){
h+=renderCapAnalytics();
h+='<h3 class="h-sub-lg" style="margin:20px 0 4px">The Quarterly Review</h3><p class="t-faint-sm" style="margin:0 0 10px">All costs in this module are counted month by month. The two cards below add those same monthly figures into three-month blocks, because the portfolio is reviewed once a quarter (Step 4.4). Nothing here caps what a quarter may spend \u2013 the blocks are a way of reading the plan, not budgets.</p>';
var tq=thisQuarterConsumption();
var _tqc=card('<h3 class="h-sub-md">This Quarter \u2013 '+fmtQuarter(tq.qi)+'</h3>'+(tq.p.rows.length?tq.p.rows.map(function(r){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc(r.name)+'</span><span class="t-faint-sm">'+r.label+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(r.amt)+'</strong></div>'}).join('')+'<div class="row-line" style="border-top:1px solid rgba(var(--fg-rgb),.12)"><span class="fs-14" style="flex:1"><strong>Total this quarter</strong></span><strong style="min-width:70px;text-align:right">'+fmtMoney(tq.p.total)+'</strong></div>':'<p class="t-faint-sm">No consumption lands in this quarter yet.</p>')+'<p class="t-faint-sm" style="margin-top:8px">For comparison: one quarter of the annual budget is '+fmtMoney(capAvailable().budget/4)+'. Running above or below that figure is not a problem in itself \u2013 it only shows whether this quarter is heavier or lighter than an even spread.</p>','margin-bottom:16px');
var _qs=orgQuarterStrip();
h+='<div class="gr-2" style="align-items:start">'+_tqc+(_qs?card('<h3 class="h-sub-md">Quarter Runway</h3>'+_qs,'margin-bottom:16px'):'')+'</div>';
}else if(_ht===1){
h+=capReadout();
var expl=stages.explore.filter(function(i){return((data.projects||{})[i]||{}).viable===true});
h+=card('<h3 class="h-sub-md" style="color:#2D5A8E">Exploration (potential projects, no financial commitments yet) ('+expl.length+')</h3>'+(expl.length?expl.map(function(i){var c=projCosts(i);return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+(progContracted(i)?badge('Program contracted','#1B6B5A'):'')+'<span class="t-faint-sm">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'}).join(''):'<p class="t-faint-sm">No Go projects waiting in Exploration.</p>'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-md" style="color:#8B5E3C">Development (Development Costs committed) ('+stages.experiment.length+')</h3>'+(stages.experiment.length?stages.experiment.map(function(i){var cS=devCost(i);var s=(trk[i]||{}).status||'';var killed=s==='killed';return'<div class="row-line"><span class="fs-14" style="flex:1'+(killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc((ideas[i]||{}).name)+'</span>'+(s?badge(killed?'killed (released)':s==='paused'?'paused (held)':s,killed?'#9B2D3F':s==='complete'?'#1B6B5A':s==='paused'?'#D4A017':'#2D5A8E'):'')+'<strong style="min-width:70px;text-align:right">'+fmtMoney(killed?0:cS)+'</strong></div>'}).join(''):'<p class="t-faint-sm">Nothing in Development.</p>'),'margin-bottom:16px');
var ops=stages.operational||[];
h+=card('<h3 class="h-sub-md" style="color:#9B2D3F">Operational (all costs committed) ('+ops.length+')</h3>'+(ops.length?ops.map(function(i){var fy=opFirstYear(i);var killed=(trk[i]||{}).status==='killed';var amt=fy?(devCost(i)+opsRolloutCost(i)):opsSustainCost(i);return'<div class="row-line"><span class="fs-14" style="flex:1'+(killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">'+(killed?'killed (released)':fy?('Development + Rollout committed'+(opsSustainCost(i)?' \u00b7 Sustainment '+fmtMoney(Math.round(opsSustainCost(i)))+'/yr from rollout\u2019s end':'')):'annual Sustainment')+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(killed?0:amt)+'</strong></div>'}).join(''):'<p class="t-faint-sm">Nothing operational yet.</p>'),'margin-bottom:16px');
var freed=Object.keys(arch).filter(function(k){return devCost(k)>0});
if(freed.length)h+=card('<h3 class="h-sub-md">Archived \u2013 costs no longer committed</h3>'+freed.map(function(k){return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[k]||{}).name||('Item '+k))+'</span><span class="t-faint-sm">archived from '+arch[k].stage+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(devCost(k))+'</strong></div>'}).join(''),'margin-bottom:16px');
}else{
h+=card('<h3 class="h-sub-lg">Budget Envelope</h3>'+budgetEnvelopeRow()+fundNote()+'<p class="t-faint-sm" style="margin:10px 0 0">Single source with Step 3.2 (Plan Capacity) \u2013 these are the same fields.</p>','margin-bottom:16px');
h+=card('<h3 class="h-sub-md">Funding Plan</h3>'+fundPlanLines(),'margin-bottom:16px');
}
return h+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 153.

---

### Step 15 — Replace the function that draws the Pipeline Dashboard, so that it carries a Save as PDF button in its header, its Run Quarterly Review button opens the Quarterly Review page, and its stage cards and chart items open the live portfolio pages.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderNavDash`.

**Code:**

```js
function renderNavDash(embedded){
var h = embedded ? '' : '<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
var ideas=data.ideas||[],stages=getStages(),rh=data.rhythm||{},gov=data.governance||{},trk=data.tracking||{};
var nm={bluesky:'out-bluesky',explore:'out-explore',experiment:'out-expbriefs',operate:'out-oper'};
// Standalone page shows the hero; when embedded in the step view the step header already supplies the title.
if(!embedded) h+='<div class="mb-6" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div>'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Pipeline <em>Dashboard</em></h1><p class="u-98b80d8">Your operational pipeline. Click any stage to manage it.</p></div>'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px;margin-top:8px')+'</div>'; /* 17 Sep 2026 (Paul's ruling): the dashboard prints from its own header, as Governance\u2019s does; printCurrentPage dispatches the dashboard document */
var maturity=getPipelineMaturity();h+='<div class="viz-dash-row">'+vizHealthGauge(maturity)+vizDimBars()+'</div>';
h+='<div class="gr-2-mb">';
h+=card('<div class="u-49c8739">Next Innovation Session</div><div class="u-ac07cd3">'+(rh.day||'\u2014')+' at '+(rh.time||'TBD')+'</div><div class="u-a4cb65d">'+(rh.duration||30)+' min \xb7 '+(rhAttNames().length?rhAttNames().map(esc).join(', '):'TBD')+'</div>','background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3)');
h+=card('<div class="u-efdcc60">Next Quarterly Review</div><div class="u-e48f6d6">'+(gov.firstReview||'TBD')+'</div><div class="u-d431697">'+btn('\u25b6 Run Quarterly Review','go(\'review\')','bp','font-size:12px;padding:6px 14px;background:#9B2D3F')+'</div>','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3)');
h+='</div>';
if(data.capStale)h+=card('<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fs-13" style="flex:1">\u26a0 Capital allocations need to be reviewed \u2013 the portfolio has changed since the last update.</span>'+btn('Open Capital Hub \u2192','go(\'cap-hub\')','bs','font-size:12px')+'</div>','border:1px solid rgba(212,160,23,.5);background:rgba(212,160,23,.08);margin-bottom:16px');
h+=pipeViz('',nm,true);
// Stage cards
h+='<div class="u-03ed01f">';
[{k:'bluesky',t:'Blue Sky',c:'#1B6B5A',nav:'out-bluesky',items:bsNowList(stages)},{k:'explore',t:'Exploration',c:'#2D5A8E',nav:'out-explore',items:stages.explore},{k:'experiment',t:'Development',c:'#8B5E3C',nav:'out-expbriefs',items:stages.experiment},{k:'operate',t:'Operational',c:'#9B2D3F',nav:'out-oper',items:stages.operational||[]}].forEach(function(s){
h+=card('<div class="flx-row-mb-12"><h3 style="font-size:15px;font-weight:700;color:'+s.c+';margin:0">'+s.t+'</h3>'+badge(s.items.length+(s.k==='operate'?' live':' items'),s.c)+'</div>'+
s.items.slice(0,3).map(function(i){var idea=ideas[i];return'<div class="u-cfcd2a9"><span>'+esc(idea?idea.name:'Item '+(i+1))+'</span></div>'}).join('')+
(s.items.length>3?'<div class="u-b9a11b1">+'+(s.items.length-3)+' more</div>':'')+
(s.items.length===0?'<p class="u-c54d0ef">No items yet.</p>':'')+
'<div class="mt-3">'+btn('View Portfolio \u2192','go(\'portfolio\',\''+s.nav+'\')','bs','font-size:11px;padding:6px 12px;width:100%')+'</div>','border-top:4px solid '+s.c)});
h+='</div>';
// Data bank
h+=renderPortfolioAnalytics().replace(/onclick="go\('(out-[a-z]+)'\)"/g,"onclick=\"go('portfolio','$1')\"") /* 17 Sep 2026 (Paul's ruling): the charts\u2019 own links open the live portfolio pages, never an earlier phase\u2019s output */;
h+=vizBalanceMap();
var _nr=nextReviewLine();if(_nr)h+=card('<div class="flx-row-mb"><h3 class="h-sub-lg" style="margin:0">Portfolio Review</h3><button class="btn-ghost pad-chip-sm" onclick="UI.expanded.navRev=!UI.expanded.navRev;render()">'+(UI.expanded.navRev?'\u25be Close':'\u25b8 Run the review')+'</button></div>'+(UI.expanded.navRev?'<div style="margin-top:10px">'+renderReviewSurface()+'</div>':'<p class="fs-14" style="margin:6px 0 0">'+_nr+'</p>'),'margin-bottom:16px');
h+=card('<h3 class="h-sub-lg">Data Bank</h3><div class="gr-3-sm">'+[{id:'out-report',l:'Assessment Report',ic:'□',c:'var(--ph1-t)'},{id:'out-orgready',l:'Org Readiness',ic:'■',c:'var(--ph2-t)'},{id:'out-raci',l:'RACI Matrix',ic:'⊕',c:'var(--ph2-t)'},{id:'out-capplan',l:'Capital Snapshot',ic:'◆',c:'var(--ph3-t)'},{id:'out-govfw',l:'Governance',ic:'—',c:'var(--ph4-t)'},{id:'out-orgrev',l:'Org Review',ic:'✕',c:'var(--ph4-t)'}].map(function(r){return'<button onclick="go(\''+r.id+'\')" class="u-355061e"><div style="font-size:22px;line-height:1;margin-bottom:8px;color:'+r.c+'">'+r.ic+'</div><div style="font-size:13px;font-weight:600;color:'+r.c+'">'+r.l+'</div></button>'}).join('')+'</div>','background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.12)');
return h + (embedded ? '' : '</div></div></div>')}
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 16 — Replace the function that draws the Assessment Report page, so that it carries the Summary / Full choice and the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutReport`.

**Code:**

```js

// === OUTCOME PAGES (simplified but functional) ===
function renderOutReport(){
var co=data.completedSections||{};if(!co['1.1']||!co['1.2']||!co['1.3']||!co['1.4']||!co['1.5'])return'<h2 class="h-section-tight">Assessment Report</h2>'+card('<div class="empty-state"><p class="t-faint">Complete all 5 assessment sections first.</p></div>');
var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},de=data.decisions||{};
var cultureKeys=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'];var cs=cultureKeys.map(function(k){return typeof cu[k]==='number'?cu[k]:0}).reduce(function(a,b){return a+b},0);
var gaps=Object.values(de).filter(function(d){return d&&d.gap}).length;
return'<div class="flx-row-mb-20"><div><h2 class="h-section">Assessment Report</h2><p class="t-fade-fs13">From your Assessment Battery</p></div>'+'<div style="display:flex;align-items:center;gap:10px">'+lyDepthCtl()+'<button class="btn bg2" style="font-size:12px" onclick="printReport()">\u25be Save as PDF</button>'+'</div></div>'+
card('<div class="u-e572595">Executive Summary</div><p class="t-body-paper">Organization with '+(k.usage==='none'||k.usage==='basic'?'limited':'moderate')+' AI capabilities, '+(cs<=12?'low':cs<=20?'moderate':'strong')+' cultural readiness ('+cs+'/30). '+gaps+' decision rights gap(s).</p>','background:rgba(27,107,90,.06);border:2px solid #1B6B5A;margin-bottom:20px')+
'<div class="u-8c6263e">'+card('<div class="t-center"><div class="score-num-go">'+cs+'/30</div><div class="t-fade-md">Culture Score</div></div>','padding:16px')+card('<div class="t-center"><div class="u-9aa6bb3">'+((cu.uncertainty||0)<=2?'Averse':(cu.uncertainty||0)<=3?'Moderate':'Tolerant')+'</div><div class="t-fade-md">Risk Appetite</div></div>','padding:16px')+card('<div class="t-center"><div style="font-size:24px;font-weight:800;color:'+(gaps?'#9B2D3F':'#1B6B5A')+'">'+gaps+'</div><div class="t-fade-md">Decision Gaps</div></div>','padding:16px')+'</div>'+
card('<h3 class="h-sub-md">Purpose & Direction</h3><div class="u-2b217c4"><strong>Mission:</strong> '+esc(p.mission)+'<br/><br/><strong>Friction Points:</strong><br/><span class="u-d07753c">'+esc(p.frictions)+'</span></div>','margin-bottom:12px')+
card('<h3 class="h-sub-md">Decision Rights</h3>'+[{k:'q1',l:'Approve experiments'},{k:'q2',l:'Advance projects'},{k:'q3',l:'Reallocate budget'},{k:'q4',l:'Kill projects'},{k:'q5',l:'Cross-functional resources'}].map(function(q){return'<div class="u-d92c727"><strong>'+q.l+':</strong> '+esc((de[q.k]||{}).who||'\u2014')+((de[q.k]||{}).gap?'<span class="u-61bd6e7"> ‼ '+esc(de[q.k].gap)+'</span>':'')+'</div>'}).join(''))+card('<h3 class="h-sub">Readiness Profile</h3><p class="t-fade-fs13">Scored across the five Phase 1 dimensions.</p>'+vizRadarLarge(getAssessmentScores()),'margin-top:20px;padding:24px;background:rgba(var(--fg-rgb),.02)')}
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 17 — Replace the function that draws the Blue Sky Portfolio page, so that it carries the Summary / Full choice and the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutBluesky`.

**Code:**

```js
function renderOutBluesky(){
var ideas=data.ideas||[],as=data.assessments||{};
var bsAll=getStages().bluesky;
var bsNow=bsAll.filter(function(i){return(ideas[i]||{}).when!=='future'});
var bsFut=bsAll.filter(function(i){return(ideas[i]||{}).when==='future'});
var rows=bsNow.map(function(i){var idea=ideas[i]||{},a=as[i]||{};var allG=a.techCapable!==undefined&&a.resourcesAvailable!==undefined&&a.culturalFit!==undefined&&a.purposeAligned!==undefined&&a.affordable!==undefined;var feasible=a.techCapable&&a.resourcesAvailable&&a.culturalFit&&a.purposeAligned&&a.affordable;var disq=allG&&!feasible;var score=feasible?triageScore(i):null;return{i:i,idea:idea,a:a,score:score,disq:disq,feasible:feasible,g:disq?2:(score!==null?0:1)}}).sort(function(x,y){return x.g!==y.g?x.g-y.g:(y.score||0)-(x.score||0)});
var h='<h2 class="h-section">Blue Sky Portfolio</h2><p class="t-lead">Ideas ranked by Filter &amp; Rank score. Expand a card to qualify, score, and select ideas for Exploration.</p>'+pipeViz('bluesky');
h+=outputPrintRow('out-bluesky'); /* 16 Sep 2026: the print control */
h+='<div class="mb-5">'+btn(UI.addForm?'Cancel':'+ Add New Idea','UI.addForm=!UI.addForm;UI.ec=null;UI.icDraft=null;render()','bs','font-size:13px')+'</div>';
if(UI.addForm)h+=renderIdeaForm();
h+=bsLegend();
var divDone=false;
rows.forEach(function(r){var idea=r.idea;var open=!!UI.expanded['bs'+r.i];
var col=r.disq?'#9B2D3F':'#1B6B5A';
if(r.disq&&!divDone){h+='<div class="t-faint-sm" style="margin:14px 0 8px;letter-spacing:.06em">DID NOT PASS QUALIFICATION</div>';divDone=true}
var head='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'bs'+r.i+'\']=!UI.expanded[\'bs'+r.i+'\'];render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="flex:1;margin:0">'+esc(idea.name||'')+'</h4>'+(r.disq?badge('Disqualified','#9B2D3F'):badge('Now','#1B6B5A'))+'<span id="scoreOut_'+r.i+'" data-sflav="bs">'+(r.score!==null?'<span style="font-weight:700;font-size:14px;color:'+col+'">'+r.score+'<span style="font-size:11px;color:var(--text-faint)">/50</span></span>':r.disq?'':'<span class="t-faint-sm">unscored</span>')+'</span></div>';
var body='';
if(open){body='<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardEdit(r.i)
+'<div class="pill-row">'+[{k:'techCapable',l:'Tech?'},{k:'resourcesAvailable',l:'Resources?'},{k:'culturalFit',l:'Culture?'},{k:'purposeAligned',l:'Purpose?'},{k:'affordable',l:'Affordable?'}].map(function(g){var v=r.a[g.k];return'<button onclick="toggleGate('+r.i+',\''+g.k+'\')" class="gate-btn'+(v===true?' pass':v===false?' fail':'')+'">'+(v===true?'\u2713':v===false?'\u2717':'\u25cb')+' '+g.l+'</button>'}).join('')+'</div>'
+(r.feasible?'<div class="u-46b97fa">'+[{k:'priority',l:'Priority'},{k:'risk',l:'Risk(10=low)'},{k:'value',l:'Value'},{k:'costScore',l:'Cost(10=low)'},{k:'difficulty',l:'Ease(10=easy)'}].map(function(d){return'<div><label class="t-faint-sm">'+d.l+'</label><input type="number" min="0" max="10" id="score_'+r.i+'_'+d.k+'" value="'+(r.a[d.k]!=null?r.a[d.k]:'')+'" onchange="saveScore('+r.i+',\''+d.k+'\')" class="score-mini"/></div>'}).join('')+'</div>':'')
+(r.feasible?'<div style="margin-top:6px">'+'<button onclick="askAdvanceIdea('+r.i+')" style="padding:4px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--text-faint)">Advance to Exploration Portfolio</button>'+'</div>':'')
+(r.disq?'<p class="t-faint-sm" style="margin-top:8px">Failed one or more feasibility gates. Change a gate above to requalify, or archive it.</p>':'')
+'<div style="margin-top:10px">'+archBtn(r.i)+'</div></div>'}
h+=card(head+body,'border-left:4px solid '+col+';margin-bottom:10px'+(r.disq?';background:rgba(155,45,63,.04)':'')+(open?'':';cursor:pointer'),xpandAttr('bs'+r.i,open))});
if(!ideas.length)h+=card('<div class="empty-state"><p class="t-faint">No ideas in the Blue Sky portfolio yet. Click + Add New Idea to capture your first use case.</p></div>');
else if(!rows.length)h+=card('<div class="empty-state"><p class="t-faint">'+(bsFut.length?'All remaining ideas are parked as Future \u2013 expand the Ideas for the Future section below, or move one to Now to work on it here.':'All current ideas have advanced to Exploration \u2013 add a new idea to keep the intake full.')+'</p></div>');
if(bsFut.length){var fOpen=!!UI.expanded.bsFold;
h+='<div class="u-3ae1f62"><button class="btn-ghost pad-chip-sm" style="color:#2D5A8E;border-color:rgba(45,90,142,.4)" onclick="UI.expanded.bsFold=!UI.expanded.bsFold;render()">'+(fOpen?'\u25be':'\u25b8')+' Ideas for the Future ('+bsFut.length+')</button>';
if(fOpen){bsFut.forEach(function(i){var idea=ideas[i]||{};var fo=!!UI.expanded['bsf'+i];
var fhead='<div class="xh" onclick="event.stopPropagation();UI.expanded[\'bsf'+i+'\']=!UI.expanded[\'bsf'+i+'\'];render()" style="display:flex;align-items:center;gap:10px;cursor:pointer"><span style="color:var(--stone);font-size:15px">'+(fo?'\u25be':'\u25b8')+'</span><h4 class="h-card" style="flex:1;margin:0">'+esc(idea.name||'')+'</h4>'+badge('Future','#2D5A8E')+'</div>';
var fbody=fo?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.08)">'+ideaCardEdit(i)+'<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'+btn('\u2192 Move to Now','moveIdeaToNow('+i+')','bs','font-size:12px')+archBtn(i)+'</div><p class="t-faint-sm" style="margin-top:8px">Moving to Now returns this idea to the ranked list above, where it can be qualified, scored, and selected.</p></div>':'';
h+=card(fhead+fbody,'border-left:4px solid #2D5A8E;margin-bottom:10px'+(fo?'':';cursor:pointer'),xpandAttr('bsf'+i,fo))})}
h+='</div>'}
h+=balancePanel(bsNow,'bluesky');
if(bsFut.length)h+='<p class="t-faint-sm" style="margin-top:-10px;margin-bottom:16px">Counts and balance cover Now ideas only \u2013 Future ideas join when moved to Now.</p>';
h+=archivePanel(['bluesky'],'obs');
return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 18 — Replace the function that draws the Org Readiness page: the summary, the figures, the readiness checklist with the record behind each check, and every field of the three Phase 2 steps.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutOrgReady`.

**Code:**

```js
function renderOutOrgReady(){
var co=data.completedSteps||{};if(!(co['2.1']&&co['2.2']&&co['2.3']))return'<h2 class="h-section-tight">Org Readiness</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Steps 1\u20133 first.</p></div>');
var M=orgReadinessModel(),ow=M.ow,inc=M.inc,full=true; /* 17 Sep 2026 (Paul's ruling): one definitive version; the page shows everything */
var fig=function(v,l){return '<div class="t-center" style="flex:1;min-width:120px"><div class="score-num-md" style="font-size:26px">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div></div>'};
var h='<div class="flx-row-mb-20"><div><h2 class="h-section">Org Readiness Summary</h2><p class="t-fade-fs13">From Phase 2, Steps 1\u20133</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printOrgReady()">\u25be Save as PDF</button>'+'</div>';
h+=card('<div class="u-7d1bdc0">Summary</div><p class="t-body-paper">'+esc(M.summary)+'</p>','background:rgba(45,90,142,.06);border:2px solid #2D5A8E;margin-bottom:20px');
h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(M.leads.length,'Embedded leads')+fig(M.metrics.length,'Innovation metrics')+fig(M.done+' / '+M.chk.length,'Readiness checks')+'</div>','margin-bottom:16px'); /* the figures the document opens with */
h+=card('<h3 class="h-sub-lg">Organizational Readiness Checklist</h3>'+M.chk.map(function(c,i){return'<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:'+(i<M.chk.length-1?'1px solid rgba(var(--fg-rgb),.04)':'none')+'"><div style="width:20px;height:20px;border-radius:10px;background:'+(c.d?'#1B6B5A':'rgba(var(--fg-rgb),.06)')+';color:'+(c.d?'#fff':'#ccc')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">'+(c.d?'\u2713':'\u25cb')+'</div><div style="flex:1"><span style="font-size:13px;color:'+(c.d?'var(--paper)':'var(--text-faint)')+'">'+c.l+'</span>'+(full?'<div class="t-faint-sm" style="margin-top:3px">'+esc(c.ev)+'</div>':'')+'</div></div>'}).join('')+'<p class="t-faint-sm" style="margin-top:12px">'+M.done+' of '+M.chk.length+' complete ('+M.pct+'%)</p>','margin-bottom:20px');
h+='<div class="gr-2-mb-5">'+card('<h3 class="h-sub-md">Pipeline Owner</h3><p class="fs-13"><strong>'+esc(ow.ownerName)+'</strong> ('+esc(ow.ownerRole)+')<br/>'+esc(ow.authority)+'</p>')+card('<h3 class="h-sub-md">Innovation Rhythm</h3><p class="fs-13">Every <strong>'+esc(M.rh.day)+'</strong> at '+esc(M.rh.time||'TBD')+'<br/>'+esc(M.att.join(', '))+(full&&M.agenda.length?'<br/><strong>Agenda:</strong> '+esc(M.agenda.join('; ')):'')+'</p>')+'</div>';
h+='<div class="gr-2-mb-5">'+card('<h3 class="h-sub-md">Embedded Leads</h3><p class="fs-13">'+(M.leads.length?M.leads.map(function(l){return esc(l.name||'Unnamed')+(full&&l.dept?' <span class="t-faint-sm">\u2014 '+esc(l.dept)+'</span>':'')}).join('<br/>'):'<span class="t-faint">None yet</span>')+'</p>')+(full?card('<h3 class="h-sub-md">Engaged Senior Leaders</h3><p class="fs-13">'+(M.seniors.length?M.seniors.map(function(l){return esc(l.name||'Unnamed')+(l.role?' <span class="t-faint-sm">\u2014 '+esc(l.role)+'</span>':'')}).join('<br/>'):'<span class="t-faint">None yet</span>')+'</p>'):'')+'</div>';
h+=card('<h3 class="h-sub-md">Incentive Changes</h3><p class="fs-13"><strong>From:</strong> '+esc(inc.current)+'<br/><strong>To:</strong> '+esc(inc.changes)+'<br/><strong>Metrics:</strong> '+esc(M.metrics.join(', ')||'None selected')+'</p>');
return h} /* 17 Sep 2026 (Paul's ruling): the figures and the checklist under the summary; Summary / Full — Full adds the senior leaders, the leads' departments, the agenda, and the evidence beneath each check */
```

**Nothing to check yet.** This change becomes visible at Step 144.

---

### Step 19 — Replace the function that draws the Governance Framework page, so that it carries the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutGovFW`.

**Code:**

```js
function renderOutGovFW(){
var co=data.completedSteps||{};if(!co['4.2'])return'<h2 class="h-section-tight">Governance Framework</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Phase 4 Step 2 first.</p></div>');
var gov=data.governance||{};
var h='<div class="flx-between-top-mb"><div>'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-big">Governance Framework</h2><p class="t-stone-sm">Three mechanisms for sustainable innovation</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printGovFW()">\u25be Save as PDF</button>'+'</div>';
h+=card('<div class="u-dcfde71">Executive Summary</div><p class="u-ef1e93b">Governance embedded across three mechanisms: standing agenda in <strong>'+esc(gov.meeting||'leadership meetings')+'</strong>, gate reviews above <strong>'+esc(gov.threshold||'threshold')+'</strong>, quarterly reviews from <strong>'+esc(gov.firstReview||'TBD')+'</strong>.</p>','background:rgba(155,45,63,.04);border:1px solid rgba(155,45,63,.2);margin-bottom:20px');
var pillars=[{ic:'—',t:'Standing Leadership Agenda',c:'#1B6B5A',items:[{l:'Embedded in',v:gov.meeting},{l:'Metrics',v:gov.metrics||'\u2014'},{l:'Format',v:gov.format||'\u2014'}]},{ic:'◉',t:'Pipeline Intake Rule',c:'#2D5A8E',items:[{l:'Threshold',v:gov.threshold},{l:'Review process',v:gov.gateProcess||'\u2014'},{l:'Outside-pipeline audit',v:gov.outsideAudit||'\u2014'}]},{ic:'■',t:'Quarterly Review',c:'#8B5E3C',items:[{l:'Attendees',v:gov.reviewAttendees},{l:'Agenda',v:gov.reviewAgenda||'\u2014'},{l:'First review',v:gov.firstReview||'\u2014'}]}];
pillars.forEach(function(p){h+=card('<div class="u-9cd32e3"><span class="u-fcc53cb">'+p.ic+'</span><h3 class="u-534d57b">'+p.t+'</h3></div>'+p.items.map(function(it){return'<div class="u-a67e826"><div style="font-family:var(--mono);font-size:10px;font-weight:700;color:'+p.c+';text-transform:uppercase;letter-spacing:.1em;min-width:110px;padding-top:2px">'+it.l+'</div><div class="u-2131614">'+esc(it.v)+'</div></div>'}).join(''),'border-left:3px solid '+p.c+';margin-bottom:12px')});
h+='</div>';
return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 20 — Replace the function that draws the Org Design Review page, so that it carries the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutOrgRev`.

**Code:**

```js
function renderOutOrgRev(){
var co=data.completedSteps||{};if(!co['4.3'])return'<h2 class="h-section-tight">Org Design Review</h2>'+card('<div class="empty-state"><p class="t-faint">Complete Phase 4 Step 3 first.</p></div>');
var stress=data.stress||{};
return'<h2 class="h-section-loose">Organizational Design Review</h2>'+outputPrintRow('out-orgrev')+'<div class="gr-2-mb-5">'+
[{k:'decisions',l:'Decision Rights',ic:'◉'},{k:'ownership',l:'Ownership Model',ic:'+'},{k:'incentives',l:'Incentive Changes',ic:'▒'},{k:'culture',l:'Culture Shift',ic:'◉'}].map(function(q){var sc=stress[q.k+'Score']||0;return card('<div class="flx-center gap-2 mb-2"><span>'+q.ic+'</span><div class="u-2e5190f">'+q.l+'</div><div style="margin-left:auto;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;background:'+(sc>=4?'rgba(27,107,90,.08)':sc>=3?'rgba(139,94,60,.06)':'rgba(155,45,63,.06)')+';color:'+(sc>=4?'#1B6B5A':sc>=3?'#8B5E3C':'#9B2D3F')+'">'+sc+'/5</div></div><p class="t-soft-13">'+esc(stress[q.k]||'\u2014')+'</p>')}).join('')+'</div>'+
card('<h3 class="h-sub-md">Adjustment Plan</h3>'+(stress.tuningList||[]).filter(function(t){return t}).map(function(t,i){return'<div class="u-ebfe612"><strong class="u-d6ff56e">'+(i+1)+'.</strong> '+esc(t)+'</div>'}).join(''),'border:2px solid #9B2D3F')}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 21 — Replace the function that draws the Capital Snapshot page, so that its figures come from the shared derivation and it carries the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutCapplan`.

**Code:**

```js
function renderOutCapplan(){var cap=data.capital||{};
if(!cap.aiBudget)return'<h2 class="h-section-tight">Capital Snapshot</h2>'+card('<div class="empty-state"><p class="t-faint">Set your AI Projects Budget at Step 3.2.</p></div>');
var av=capAvailable(),ideas=data.ideas||[],stages=getStages(),proj=data.projects||{},trk=data.tracking||{};
var h='<div class="flx-between-top-mb"><div>'+badge('Phase 3 Output','#8B5E3C')+'<h2 class="h-big">Capital Snapshot</h2><p class="t-stone-sm">'+capSnapLead()+'</p></div>'+'<button class="btn bg2" style="font-size:12px" onclick="printCapPlan()">\u25be Save as PDF</button>'+'</div>';
h+=card('<div class="u-64e97f0">Financial Summary</div>'+capCells(false)+((cap.reallocation||cap.gapPlan||cap.killNotes||killPotRows().length)?'<div class="gr-2" style="margin-top:12px">'+((cap.killNotes||killPotRows().length)?'<div><div class="t-faint-sm">KILL & PHASE-OUT POT \u2013 '+fmtMoney(killPotTotal())+'</div>'+killPotRows().map(function(r){return'<p class="fs-14" style="margin:4px 0 0">'+esc(r.d||'')+(r.a?' \u2013 '+esc(r.a):'')+' <span class="t-faint-sm">(Year '+killPotYearOf(r)+')</span></p>'}).join('')+(cap.killNotes?'<p class="fs-14" style="margin:4px 0 0">'+esc(cap.killNotes)+'</p>':'')+'</div>':'')+(cap.reallocation?'<div><div class="t-faint-sm">REALLOCATION SOURCES</div><p class="fs-14" style="margin:4px 0 0">'+esc(cap.reallocation)+'</p></div>':'')+(cap.gapPlan?'<div><div class="t-faint-sm">FUNDING GAP & PLAN</div><p class="fs-14" style="margin:4px 0 0">'+esc(cap.gapPlan)+'</p></div>':'')+'</div>':''),'background:rgba(139,94,60,.04);border:1px solid rgba(139,94,60,.2);margin-bottom:16px');
var devRows=stages.experiment.filter(function(i){return(trk[i]||{}).status!=='killed'});
if(orgMonthly()){h+=capKpiStrip();h+=card('<h3 class="h-sub-md">The Committed Calendar</h3>'+orgSwimlanes(),'margin-bottom:16px');h+=card('<h3 class="h-sub-md">Capacity Waterfall</h3>'+orgWaterfallChart(),'margin-bottom:16px')}
h+=card('<h3 class="h-sub-md" style="color:#8B5E3C">Committed \u2013 Development ('+devRows.length+')</h3>'+(devRows.length?devRows.map(function(i){var cS=devCost(i),c=projCosts(i);return'<div style="padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div class="flx-row-mb"><h4 class="h-card" style="flex:1">'+esc((ideas[i]||{}).name)+'</h4><span class="t-faint-sm">Development '+fmtMoney(cS)+' \u00b7 est. rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 est. sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'+progSnapRO(i)+'</div>'}).join(''):'<p class="t-faint-sm">Nothing in Development at this snapshot.</p>'),'margin-bottom:16px');
var ops=stages.operational||[];
h+=card('<h3 class="h-sub-md" style="color:#9B2D3F">Committed \u2013 Operational ('+ops.length+')</h3>'+(ops.length?(function(){var _cr=capCommitments().rows;return ops.filter(function(i){return(trk[i]||{}).status!=='killed'}).map(function(i){var r=null;for(var k=0;k<_cr.length;k++)if(_cr[k].i===i&&_cr[k].stage==='Operational'){r=_cr[k];break}var amt=r?r.amt:0,lbl=r?r.label:'Full plan';return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span><span class="t-faint-sm">'+lbl+'</span><strong style="min-width:70px;text-align:right">'+fmtMoney(amt)+'</strong></div>'}).join('')})():'<p class="t-faint-sm">Nothing operational at this snapshot.</p>'),'margin-bottom:16px');
var opts=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
h+=card('<h3 class="h-sub-md" style="color:#2D5A8E">Exploration (potential future projects, no financial commitments yet) ('+opts.length+')</h3>'+(opts.length?opts.map(function(i){var c=projCosts(i);return'<div class="row-line"><span class="fs-14" style="flex:1">'+esc((ideas[i]||{}).name)+'</span>'+(progContracted(i)?badge('Program contracted','#1B6B5A'):'')+badge(getScore(i)+'/50','#2D5A8E')+'<span class="t-faint-sm">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'}).join(''):'<p class="t-faint-sm">No Go projects waiting in Exploration.</p>'));
return h}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 22 — Replace the function that writes the colour and font tokens the print window uses, so that it carries the --gold-rgb token the printed documents need.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printThemeTokens`.

**Code:**

```js
// === MAIN RENDER ===

// === PDF EXPORT FUNCTIONS ===
function printThemeTokens(){
// Print windows are bare (no styles.css), so the swept var() references need
// definitions. Print is always the light theme. Shadows are suppressed for paper;
// font tokens are included so mono/serif stamps keep their faces in print.
return ':root{--ink:#F4F6F9;--paper:#1E2530;--bg-rgb:244,246,249;--fg-rgb:30,37,48;'+
'--stone:#4E5A68;--text-muted:#4E5A68;--text-fade:#64707E;--text-faint:#7E8B99;'+
'--faint-rgb:126,139,153;--ref-accent:#0A7FB5;'+
'--text-body:#39434F;--text-mid:#47525F;--text-hint:#2A3542;--text-bright:#273240;--text-soft:#3F4A58;--text-max:#1E2530;'+
'--bg-elev:#FFFFFF;--menu-bg:#FFFFFF;--menu-fg:#1E2530;--warn-text:#8F6A00;--warn-pale:#7E6A00;'+
'--ph1-t:#1B6B5A;--ph2-t:#2D5A8E;--ph3-t:#8B5E3C;--ph4-t:#9B2D3F;--ph5-t:#6B4C8A;'+
'--gold:#E8621A;--gold-rgb:232,98,26;--gold-light:#F07A37;--gold-pale:#FDE8D8;--navy:#1E2530;--rule:rgba(15,45,74,.32);--rule-rgb:15,45,74;--head-blue:#076D9E;--gold-text:#B34208;'+
'--ph1:#1B6B5A;--ph2:#2D5A8E;--ph3:#8B5E3C;--ph4:#9B2D3F;--ph5:#6B4C8A;'+
'--surface:rgba(var(--fg-rgb),.06);--border-faint:rgba(var(--fg-rgb),.12);--border-soft:rgba(var(--fg-rgb),.08);'+
'--border-softer:rgba(var(--fg-rgb),.06);--bg-card:rgba(var(--fg-rgb),.03);--bg-card-hover:rgba(232,98,26,.04);'+
'--bg-input:rgba(var(--fg-rgb),.06);--shadow-card:none;--shadow-elev:none;'+
"--serif:'Cormorant Garamond',Georgia,serif;--mono:'DM Mono',Menlo,Consolas,monospace;--sans:'Helvetica Neue',Arial,sans-serif}";
}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 23 — Add the constant holding the module name printed at the top of the first page of every printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printThemeTokens` ends, after its closing `}`.

**Code:**

```js

var PRINT_MODULE_NAME='90-Day AI Innovation Pipeline'; /* 16 Sep 2026 (Paul's ruling, family): the cover's kicker takes the Governance form — 90-Day and the module's name; the home page reads 90 Days to an AI Innovation Pipeline */
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 24 — Add the function that prints today's date as words for the first page of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PRINT_MODULE_NAME` ends.

**Code:**

```js

/* PRINT BASELINE (Paul's ruling, 12 Sep 2026; family): the cover's parts and the footer's words */
function printDateLine(){return new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 25 — Add the function that writes the copyright line printed at the bottom left of every page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDateLine` ends, after its closing `}`.

**Code:**

```js
function printFooterText(){return '\u00a9 '+new Date().getFullYear()+' Next Chapter, LLC. All rights reserved.'} /* the same words as the site footer at nextchapter.org */
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 26 — Add the function that draws the first page of a printed document: the module line, the title, the subtitle, the organization's name, the date.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printFooterText` ends, after its closing `}`.

**Code:**

```js
function printDocCover(title,lead,countLine){var org=(function(){var ent=(data&&data.enterprise&&String(data.enterprise.name||'').trim())||'';if(ent)return ent;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return (o&&o.name)||''})(); /* 13 Sep 2026 (Paul's ruling; family): the cover names the organization as Organization Details (the Organization & Team panel) records it; the sign-in organization's label is the fallback only when that name is blank — ported to the Innovation Pipeline 16 Sep 2026 (Paul's ruling: the cover as Governance has it) */
return '<div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'
+'<div style="font-family:var(--mono,monospace);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:0 0 18px">NextChapter \u00b7 '+esc(PRINT_MODULE_NAME)+'</div>'
+'<div style="font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px">'+esc(title)+'</div>'
+(lead?'<div style="font-size:14px;color:#444;line-height:1.6;max-width:520px;margin:0 0 26px">'+esc(lead)+'</div>':'')
+'<div style="border-top:2px solid #111;padding-top:12px;color:#333">'+(org?'<div style="font-size:18px;font-weight:600;color:#111;margin:0 0 4px">'+esc(org)+'</div>':'')+'<div style="font-size:13px">'+printDateLine()+'</div></div>'
+'</div>'} /* PRINT COVER (Paul's ruling, 12 Sep 2026; family): NextChapter · module, the title, the lead, the organization a little bigger, the date alone; no phase, no count (the count argument is accepted and ignored) */
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 27 — Add the function that removes the screen heading block and every control from a page's markup before it prints.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDocCover` ends, after its closing `}`.

**Code:**

```js
function _pdStrip(body){ /* the screen's heading block (title, lead, print control) comes off so the title lives on the cover only; every button goes */
  var m=body.indexOf('PDF</button></div>');if(m>=0)body=body.slice(m+18);
  return body.replace(/<button[\s\S]*?<\/button>/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 28 — Add the function that reads a page's lead sentence from its markup for the printed document's first page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pdStrip` ends, after its closing `}`.

**Code:**

```js
function _pdLead(body){var m=body.indexOf('PDF</button></div>');if(m<0)return '';var head=body.slice(0,m);var p=head.match(/<p[^>]*>([\s\S]*?)<\/p>/);return p?p[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim():''} /* the lead is the screen's own sub-line */
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 29 — Replace the function that prints a page as a document with a first page, so that it uses the shared first page and the shared print window.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printPage`.

**Code:**

```js
function printPage(title,contentFn){var raw=contentFn();printDocument(title,printDocCover(title,_pdLead(raw),'')+_pdStrip(raw),'')} /* 12 Sep 2026 (Paul's ruling): a cover, then the body without its heading */
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 30 — Add the function that opens the print window and lays the document out for paper. It can also show a document as a preview without opening the print dialog.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printPage` ends, after its closing `}`.

**Code:**

```js
function printDocument(title,content,extraCss,opts){ /* 14 Sep 2026: opts.preview shows the document as a sheet with its forced page breaks marked and a Show as pages button, and does not open the print dialog */ /* 13 Sep 2026: the shared print window – the family styles, an optional stylesheet for bespoke report documents, the content, the footer */
var w=window.open('');if(!w){alert('The print view was blocked by the browser. Allow pop-ups for this site and try again.');return}
w.document.write('<html><head><title>'+title+'</title>'+
'<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:wght@400;600&display=swap" rel="stylesheet">'+
'<style>'+printThemeTokens()+'*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Helvetica Neue",Arial,sans-serif;max-width:750px;margin:40px auto;padding:0 40px;line-height:1.7;font-size:14px;color:#1e2530;background:#fff}'+
'h1,h2,h3,h4{color:#1a1612;break-after:avoid;page-break-after:avoid}a{color:#2D5A8E}'+
'.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none !important}button{display:none !important}'+
'.cd{background:none;border:none;border-radius:0;padding:8px 0;margin-bottom:14px;page-break-inside:avoid}'+
'select{-webkit-appearance:none;appearance:none;border:none;background:none;font-weight:600;font-size:13px;color:#1a1612}textarea{border:none;background:none;font-size:13px;color:#1e2530;resize:none}'+
'table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;vertical-align:top;border-bottom:1px solid #e0e0e0;text-align:left}'+
'*{-webkit-print-color-adjust:exact;print-color-adjust:exact}[style*="#F5F2EC"],[style*="#8A8278"],[style*="rgba(245,242,236"],[style*="rgba(138,130,120"],[style*="color:var(--paper)"]{color:#1e2530 !important}[style*="color:var(--stone)"],[style*="color:var(--text-muted)"],[style*="color:var(--text-faint)"]{color:#555 !important}@media print{body{margin:0;padding:0}}'+
'@page{margin:16mm 14mm 20mm 14mm;@top-left{content:""}@top-center{content:""}@top-right{content:""}@bottom-center{content:""}@bottom-left{content:"'+printFooterText()+'";font:9px "DM Mono",monospace;color:#666}@bottom-right{content:counter(page) " / " counter(pages);font:9px "DM Mono",monospace;color:#666}}'+ /* PRINT MARGINS (Paul's ruling, 12 Sep 2026; family): the document owns all six page corners — the top three empty, the copyright line bottom left, the page number bottom right — so the browser's own date, title, address, and count never print, whatever the user's Headers and footers setting */
'.print-footer{display:none}@media screen{.print-footer{display:block;margin-top:40px;padding-top:10px;border-top:1px solid #ddd;font-family:"DM Mono",monospace;font-size:9px;letter-spacing:.06em;color:#666}}'+ /* on screen, before printing, the copyright line ends the document */
(extraCss||'')+'</style></head><body>'+((opts&&opts.preview)?'<div class="preview-note" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:12px/1.5 var(--sans,sans-serif);color:#333;background:#FBF6EC;border:1px solid #E8D9B8;padding:8px 12px;margin:0 0 24px"><button onclick="window.print()" style="font:12px var(--sans,sans-serif);font-weight:600;padding:6px 14px;border:1px solid #333;border-radius:6px;background:#fff;color:#111;cursor:pointer;white-space:nowrap">Show as pages</button><span style="flex:1;min-width:240px">Preview. Dashed rules below mark where the document forces a page break; where the printer breaks a long section in the middle is set when it prints. Show as pages opens your browser\u2019s print preview, where the pages are exact, and Cancel returns here.</span></div>'+'<style>@media print{.preview-note{display:none}}@media screen{html{background:#e6e6e6}body{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 32px rgba(0,0,0,.08);padding:56px 64px !important;margin:24px auto !important}[style*="break-before:page"]::before,[style*="page-break-after:always"]:not([style*="display:flex"])::after,[style*="min-height:85vh"]+*::before{content:"page break";display:block;text-align:center;font:10px "DM Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#999;border-top:1px dashed #bbb;padding-top:6px;margin:28px 0 24px}[style*="page-break-after:always"]+[style*="break-before:page"]::before{display:none}}</style>':'')+content+'<div class="print-footer">'+printFooterText()+'</div></body></html>');
w.document.close();if(!(opts&&opts.preview))setTimeout(function(){w.print()},500)}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 31 — Replace the function behind the Assessment Report's Save as PDF button, so that it prints the Assessment Report document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printReport`.

**Code:**

```js

function printReport(){printDocument('Assessment Report',assessmentReportDoc(),'')} /* 16 Sep 2026: the composed document, not the page */
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 32 — Replace the function behind the Org Readiness page's Save as PDF button, so that it prints the Org Readiness document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printOrgReady`.

**Code:**

```js

function printOrgReady(){printDocument('Org Readiness',orgReadinessDoc(),'')} /* 16 Sep 2026: the composed document, not the page */
```

**Nothing to check yet.** This change becomes visible at Step 144.

---

### Step 33 — Replace the function behind the Capital Snapshot's Save as PDF button, so that it prints the Capital Snapshot document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printCapPlan`.

**Code:**

```js

function printCapPlan(){printDocument('Capital Snapshot',printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody(),CAP_REPORT_CSS)} /* CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026): its own document – every budget year, then the total */
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 34 — Add the function that writes the Capital Snapshot document's subtitle: a point-in-time picture, with today's date and quarter.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCapPlan` ends, after its closing `}`.

**Code:**

```js
/* ── CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026) ──────────────────────────────
   The printed snapshot is its own document rendered from the data, never the screen cleaned up.
   One section per budget year, then a Budget Total section. Each section opens with its
   Financial Summary, the three KPI tiles, that year's committed calendar, and its capacity
   waterfall (the last thing on the section's first page); the committed lists begin on a
   new page. Year sections show what lands in that year; the Total section shows the whole
   plan, the program phases, and the Exploration pipeline. */
function capSnapLead(){return'A point-in-time picture of a fluid state, taken '+fmtDate(new Date())+' ('+fmtQuarter(fyQuarterOf(new Date()))+'). Commitments move as the portfolio moves \u2013 this page is a snapshot, not an end-of-task deliverable.'}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 35 — Add the constant holding the style rules of the printed Capital Snapshot document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capSnapLead` ends, after its closing `}`.

**Code:**

```js
var CAP_REPORT_CSS='.cr-sec{page-break-before:always}.cr-hk{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8B5E3C;margin:0 0 6px}.cr-h{font-family:var(--serif,Georgia,serif);font-size:30px;font-weight:600;color:#111;margin:0 0 8px;line-height:1.15}.cr-rule{border-top:2px solid #111;margin:0 0 18px}'
+'.cr-fin{border:1px solid rgba(139,94,60,.35);background:rgba(139,94,60,.05);border-radius:8px;padding:16px 18px;margin:0 0 14px;page-break-inside:avoid}.cr-fin-k{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8B5E3C;margin:0 0 12px}'
+'.cr-cells{display:flex;gap:14px}.cr-cell{flex:1;text-align:center}.cr-num{font-size:26px;font-weight:800;color:#2D5A8E;line-height:1.1}.cr-lbl{font-size:12px;color:#4E5A68;margin-top:4px}'
+'.cr-note{font-size:12px;color:#39434F;margin:12px 0 0;line-height:1.5}.cr-note2{font-size:11.5px;color:#64707E;margin:4px 0 0;line-height:1.5}.cr-fin-x{display:flex;gap:18px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(139,94,60,.25)}.cr-fin-x>div{flex:1}.cr-fin-xk{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64707E;margin:0 0 3px}.cr-fin-x p{font-size:12px;margin:2px 0 0;color:#1E2530}'
+'.cr-kpis{display:flex;gap:10px;margin:0 0 14px;page-break-inside:avoid}.cr-kpi{flex:1;display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(30,37,48,.16);border-radius:10px;background:#fff}.cr-kpi-l{font-size:13px;font-weight:700;color:#1E2530}.cr-kpi-s{font-size:11.5px;color:#4E5A68}.cr-kpi-n{font-size:22px;font-weight:800;line-height:1;flex-shrink:0}'
+'.cr-card{border:1px solid rgba(30,37,48,.14);border-radius:8px;padding:12px 14px;margin:0 0 14px;page-break-inside:avoid}.cr-card h3{font-size:15px;font-weight:700;color:#1E2530;margin:0 0 8px}.cr-cap{font-size:11px;color:#4E5A68;margin-top:6px;line-height:1.5}.cr-sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 10px;vertical-align:middle}'
+'.cr-lists{page-break-before:always}.cr-list{margin:0 0 18px}.cr-list h3{font-size:16px;font-weight:700;margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(30,37,48,.15)}.cr-item{padding:8px 0;border-bottom:1px solid rgba(30,37,48,.08);page-break-inside:avoid}.cr-item-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.cr-item-h h4{font-size:14px;font-weight:700;margin:0;color:#1E2530}.cr-item-m{font-size:12px;color:#4E5A68;white-space:nowrap}.cr-item-y{font-size:12.5px;color:#1E2530;margin:3px 0 0}.cr-item-y strong{color:#8B5E3C}'
+'table.cr-t{width:100%;border-collapse:collapse;margin:8px 0 2px;font-size:12px}table.cr-t th{text-align:left;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#64707E;font-weight:500;padding:4px 8px 4px 0;border-bottom:1px solid rgba(30,37,48,.15)}table.cr-t td{padding:5px 8px 5px 0;border-bottom:1px solid rgba(30,37,48,.07);vertical-align:top;color:#1E2530}table.cr-t td.r,table.cr-t th.r{text-align:right;padding-right:0}'
+'.cr-row{display:flex;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid rgba(30,37,48,.08);page-break-inside:avoid}.cr-row .n{flex:1;font-size:13.5px;color:#1E2530}.cr-row .m{font-size:12px;color:#4E5A68}.cr-row .a{min-width:70px;text-align:right;font-weight:700;color:#1E2530}.cr-badge{display:inline-block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.08em;padding:2px 7px;border-radius:10px;color:#fff;margin-right:6px;vertical-align:middle}.cr-empty{font-size:12.5px;color:#64707E}';
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 36 — Add the function that derives the capital figures for one budget year or the total, shared by the screen and the Capital Snapshot document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `CAP_REPORT_CSS` ends.

**Code:**

```js
/* the shared KPI derivation: the same figures the screen's capKpiStrip shows, for one lens (a year number or 'T') */
function capKpiData(sel){var yt=orgYearTotals();if(!yt||!yt.length)return null;var cap=data.capital||{};var Y=envYearsOf();
if(sel==null)sel=1;var isT=sel==='T';if(!isT&&!(sel>=1&&sel<=Y))sel=1;
var r;if(isT){var _b=0,_t=0,_rs=0,_su=0;yt.forEach(function(x){_b+=x.budget;_t+=x.total;_rs+=(x.reserve||0);_su+=x.sus});r={budget:_b,total:_t,headroom:_b-_t,reserve:_rs,sus:_su,susShare:_t?_su/_t:0,capPct:0}}else r=yt[sel-1];
var lblY=isT?'all years':'Year '+sel;var pctC=r.budget?Math.min(1,r.total/r.budget):0;var scp=parseFloat(cap.susCap);
return{sel:sel,isT:isT,r:r,lblY:lblY,
t1:{f:pctC,c:pctC>.85?'#D4A017':'#45A188',label:'Committed, '+lblY,sub:fmtMoney(r.total)+' of '+fmtMoney(r.budget)},
t2:{v:fmtMoney(r.headroom),neg:r.headroom<0,label:'Headroom, '+lblY,sub:(r.reserve?fmtMoney(r.headroom-r.reserve)+' net of the intake reserve':'available for new projects')},
t3:{f:(!isT&&scp>0)?Math.min(1,r.capPct):r.susShare,c:(!isT&&scp>0&&r.capPct>1)?'#D4A017':'#C25B73',label:isT?'Sustainment share':'Sustainment vs cap',sub:(isT?Math.round(r.susShare*100)+'% of all committed':(scp>0?Math.round(r.susShare*100)+'% of Year '+sel+' \u00b7 cap '+scp+'%':Math.round(r.susShare*100)+'% of Year '+sel))}}}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 37 — Add the function that works out the money one committed item spends in a span of program months.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capKpiData` ends, after its closing `}`.

**Code:**

```js
/* per-item money landing in program months a..b (inclusive), from the same monthly series the charts use */
function capReportItemYear(e,a,b){var M=envYearsOf()*12;var s=orgProjectMonthly(e.i,e.op,M,null,e.sunk);var o={dev:0,roll:0,sus:0};for(var m=a;m<=b&&m<=M;m++){o.dev+=s[m-1].dev;o.roll+=s[m-1].roll;o.sus+=s[m-1].sus}o.dev=Math.round(o.dev);o.roll=Math.round(o.roll);o.sus=Math.round(o.sus);o.total=o.dev+o.roll+o.sus;return o}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 38 — Add the function that draws a small ring showing a fraction, for the Capital Snapshot document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capReportItemYear` ends, after its closing `}`.

**Code:**

```js
function capReportArc(f,col){var R=26,C2=2*Math.PI*R;return'<svg viewBox="0 0 64 64" style="width:54px;height:54px;flex-shrink:0"><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="rgba(30,37,48,.10)" stroke-width="7"/><circle cx="32" cy="32" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="7" stroke-dasharray="'+(C2*f).toFixed(1)+' '+C2.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="13" font-weight="700" fill="#1E2530">'+Math.round(f*100)+'%</text></svg>'}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 39 — Add the function that draws the committed calendar for a span of program months: one lane per committed item.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capReportArc` ends, after its closing `}`.

**Code:**

```js
/* the committed calendar for program months a..b: one lane per committed item active in the window, segments clipped to it */
function capReportLanes(a,b){var M=envYearsOf()*12,ideas=data.ideas||[];var n=b-a+1;var C={dev:'#45A188',roll:'#5B8DD9',sus:'#C25B73'};
var lanes=[];orgCommittedSet().filter(function(e){return !e.sunk}).forEach(function(e){var s2=orgProjectMonthly(e.i,e.op,M,null);var segs=[];['dev','roll','sus'].forEach(function(k){var st=0;for(var m=a;m<=b+1;m++){var on=m<=b&&m<=M&&s2[m-1][k]>0.5;if(on&&!st)st=m;if(!on&&st){segs.push({k:k,a:st,b:m-1});st=0}}});
if(segs.length)lanes.push({name:(ideas[e.i]||{}).name||('Item '+e.i),legacy:!!((((data.projects||{})[e.i])||{}).legacy),segs:segs})});
if(!lanes.length)return'<p class="cr-empty">Nothing committed lands in these months.</p>';
var shown=lanes.slice(0,12);var W=720,LH=22,pad=170,Hh=shown.length*LH+30,cw=(W-pad-16)/n;
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
for(var g=0;g<=n;g++){var gx=pad+g*cw;h+='<line x1="'+gx.toFixed(1)+'" y1="2" x2="'+gx.toFixed(1)+'" y2="'+(Hh-18)+'" stroke="rgba(30,37,48,'+((g%(n>12?6:3))===0?'.14':'.05')+')"/>'}
shown.forEach(function(L,ix){var y=4+ix*LH;
h+='<text x="'+(pad-8)+'" y="'+(y+12)+'" text-anchor="end" font-size="10" fill="#39434F">'+esc(L.name.length>26?L.name.slice(0,25)+'\u2026':L.name)+(L.legacy?' \u25c6':'')+'</text>';
L.segs.forEach(function(sg){var x=pad+(sg.a-a)*cw,w=Math.max(2,(sg.b-sg.a+1)*cw);h+='<rect x="'+x.toFixed(1)+'" y="'+(y+2)+'" width="'+w.toFixed(1)+'" height="13" rx="3" fill="'+C[sg.k]+'"/>'})});
var step=n>12?6:1;for(var t=a;t<=b;t++){if(step===1||t%6===0)h+='<text x="'+(pad+(t-a+.5)*cw).toFixed(1)+'" y="'+(Hh-6)+'" text-anchor="middle" font-size="9" fill="#4E5A68">'+t+'</text>'}
h+='</svg>';
if(lanes.length>shown.length)h+='<div class="cr-cap">+'+(lanes.length-shown.length)+' more committed items not shown</div>';
h+='<div class="cr-cap">One lane per committed item \u00b7 program months '+a+'\u2013'+b+' \u00b7 <span class="cr-sw" style="background:#45A188;margin-left:0"></span>development <span class="cr-sw" style="background:#5B8DD9"></span>rollout <span class="cr-sw" style="background:#C25B73"></span>sustainment'+(shown.some(function(L2){return L2.legacy})?' \u00b7 \u25c6 legacy':'')+'</div>';
return h}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 40 — Add the function that draws the capacity waterfall for a span of program months, on a scale shared by every section.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capReportLanes` ends, after its closing `}`.

**Code:**

```js
/* the capacity waterfall for program months a..b, on a scale shared by every section (mx) so the years read against each other */
function capReportWaterfall(a,b,mx){var srs=orgMonthly();if(!srs)return'';var CD='#45A188',CR='#5B8DD9',CS='#C25B73';var n=b-a+1;
if(!mx)return'<p class="cr-empty">Nothing committed yet \u2013 the first batch draws the first bars.</p>';
var W=720,Hh=190,pad=28,bw=(W-pad*2)/n,base=Hh-24;var sy=function(v){return (Hh-52)*(v/mx)};
var h='<svg viewBox="0 0 '+W+' '+Hh+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';
h+='<line x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'" stroke="rgba(30,37,48,.25)"/>';
for(var m=a;m<=b;m++){var r=srs[m-1];if(!r)continue;var ix=m-a;var x=pad+ix*bw+bw*.15,w=Math.max(1,bw*.7);var yy=base;
if(r.sus>0){var yS=sy(r.sus);yy-=yS;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yS.toFixed(1)+'" fill="'+CS+'"/>'}
if(r.roll>0){var yR=sy(r.roll);yy-=yR;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yR.toFixed(1)+'" fill="'+CR+'"/>'}
if(r.dev>0){var yD=sy(r.dev);yy-=yD;h+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+yD.toFixed(1)+'" fill="'+CD+'"/>'}}
var pts='';for(var m2=a;m2<=b;m2++){var sc=capSusCapLine(m2);if(sc>0){var x1=pad+(m2-a)*bw,x2=pad+(m2-a+1)*bw,cy=base-sy(sc);pts+=(pts===''?'M':'L')+x1.toFixed(1)+' '+cy.toFixed(1)+'L'+x2.toFixed(1)+' '+cy.toFixed(1)}}
if(pts)h+='<path d="'+pts+'" fill="none" stroke="#B8860B" stroke-width="1.5" stroke-dasharray="4,3"/>';
var step=n>12?6:1;for(var t=a;t<=b;t++){if(step===1||t%6===0)h+='<text x="'+(pad+(t-a+.5)*bw).toFixed(1)+'" y="'+(Hh-10)+'" text-anchor="middle" font-size="9" fill="#4E5A68">'+t+'</text>'}
h+='</svg>';
h+='<div class="cr-cap"><span class="cr-sw" style="background:'+CD+';margin-left:0"></span>Development <span class="cr-sw" style="background:'+CR+'"></span>Rollout <span class="cr-sw" style="background:'+CS+'"></span>Sustainment \u00b7 program months '+a+'\u2013'+b+(pts?'<br/><span style="display:inline-block;width:18px;border-top:2px dashed #B8860B;margin:0 4px 0 0;vertical-align:middle"></span> The dashed line is the sustainment cap \u2013 the run-cost ceiling for the year, at its monthly rate':'')+'</div>';
return h}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 41 — Add the function that draws one section of the Capital Snapshot document: a budget year, or the total.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capReportWaterfall` ends, after its closing `}`.

**Code:**

```js
/* one section: a budget year (y = 1..Y) or the total (y = 'T') */
function capReportSection(y,L,mx,idx,count){var Y=envYearsOf(),cap=data.capital||{},ideas=data.ideas||[],stages=getStages(),trk=data.tracking||{},proj=data.projects||{};
var isT=y==='T';var a=isT?1:(y-1)*12+1,b=isT?Y*12:y*12;var d=isT?L.tot:L.years[y-1];
var h='<div class="'+(idx?'cr-sec':'')+'">';
h+='<div class="cr-hk">Capital Snapshot \u00b7 section '+(idx+1)+' of '+count+'</div><div class="cr-h">'+(isT?'Budget Total \u2013 '+Y+' years':'Budget Year '+y)+'</div><div class="cr-rule"></div>';
/* Financial Summary */
var cells=[{v:fmtMoney(d.budget),l:isT?'Budget \u2013 '+Y+' years':'Budget, Year '+y},{v:'\u2212 '+fmtMoney(d.committed),l:'Committed'}];
if(d.killPot)cells.push({v:'\u2212 '+fmtMoney(d.killPot),l:'Kill & phase-out'});
cells.push({v:fmtMoney(d.available),l:'Available',c:d.available<0?'#9B2D3F':'#1B6B5A'});
h+='<div class="cr-fin"><div class="cr-fin-k">Financial Summary</div><div class="cr-cells">'+cells.map(function(x){return'<div class="cr-cell"><div class="cr-num"'+(x.c?' style="color:'+x.c+'"':'')+'>'+x.v+'</div><div class="cr-lbl">'+x.l+'</div></div>'}).join('')+'</div>';
if(L.beyond)h+='<p class="cr-note">Committed funds falling beyond the planning window: '+fmtMoney(L.beyond)+' across '+L.beyondN+' project'+(L.beyondN>1?'s':'')+' \u2013 these months lie outside the '+Y+'-year period and are not counted above.</p>';
h+='<p class="cr-note2" style="margin-top:'+(L.beyond?4:12)+'px">Committed is the full cost of every live plan \u2013 all development, rollout, and sustainment months landing in '+(isT?'the '+Y+'-year window':'Year '+y)+'. This figure provides planning estimates. It does not track live spend.</p>';
var kr=killPotRows().filter(function(r){return isT||killPotYearOf(r)===y});var xs=[];
if(kr.length||(isT&&cap.killNotes))xs.push('<div><div class="cr-fin-xk">Kill & phase-out pot'+(isT?' \u2013 '+fmtMoney(killPotTotal()):'')+'</div>'+kr.map(function(r){return'<p>'+esc(r.d||'')+(r.a?' \u2013 '+esc(r.a):'')+(isT?' <span style="color:#64707E">(Year '+killPotYearOf(r)+')</span>':'')+'</p>'}).join('')+(isT&&cap.killNotes?'<p>'+esc(cap.killNotes)+'</p>':'')+'</div>');
if(isT&&cap.reallocation)xs.push('<div><div class="cr-fin-xk">Reallocation sources</div><p>'+esc(cap.reallocation)+'</p></div>');
if(isT&&cap.gapPlan)xs.push('<div><div class="cr-fin-xk">Funding gap & plan</div><p>'+esc(cap.gapPlan)+'</p></div>');
if(xs.length)h+='<div class="cr-fin-x">'+xs.join('')+'</div>';
h+='</div>';
/* KPI tiles */
var K=capKpiData(isT?'T':y);
if(K){var tile=function(inner,label,sub){return'<div class="cr-kpi">'+inner+'<div style="min-width:0"><div class="cr-kpi-l">'+label+'</div><div class="cr-kpi-s">'+sub+'</div></div></div>'};
h+='<div class="cr-kpis">'+tile(capReportArc(K.t1.f,K.t1.c),K.t1.label,K.t1.sub)+tile('<div class="cr-kpi-n" style="color:'+(K.t2.neg?'#C25B73':'#1B6B5A')+'">'+K.t2.v+'</div>',K.t2.label,K.t2.sub)+tile(capReportArc(K.t3.f,K.t3.c),K.t3.label,K.t3.sub)+'</div>'}
/* the year's calendar, then its waterfall \u2013 the last thing on the section's first page */
if(orgMonthly()){h+='<div class="cr-card"><h3>The Committed Calendar</h3>'+capReportLanes(a,b)+'</div>';h+='<div class="cr-card"><h3>Capacity Waterfall</h3>'+capReportWaterfall(a,b,mx)+'</div>'}
/* the committed lists, on a new page */
h+='<div class="cr-lists">';
var devRows=stages.experiment.filter(function(i){return(trk[i]||{}).status!=='killed'});
var landing=isT?'Within the planning window':'Landing in Year '+y;
h+='<div class="cr-list"><h3 style="color:#8B5E3C">Committed \u2013 Development ('+devRows.length+')</h3>';
if(devRows.length)devRows.forEach(function(i){var yr=capReportItemYear({i:i,op:false},a,b);
h+='<div class="cr-item"><div class="cr-item-h"><h4>'+esc((ideas[i]||{}).name||('Item '+i))+'</h4><span class="cr-item-m">Development '+fmtMoney(devCost(i))+' \u00b7 est. rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 est. sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>';
h+='<div class="cr-item-y">'+landing+': <strong>'+fmtMoney(yr.total)+'</strong> \u2013 development '+fmtMoney(yr.dev)+' \u00b7 rollout '+fmtMoney(yr.roll)+' \u00b7 sustainment '+fmtMoney(yr.sus)+'</div>';
if(isT){var rows=progOrdered(i);if(rows.length)h+='<table class="cr-t"><thead><tr><th>Program phase</th><th>Owner</th><th class="r">Months</th><th class="r">Cost</th><th class="r">Gate decision</th></tr></thead><tbody>'+rows.map(function(r){var sp=bpStepSpan(r);return'<tr><td>'+esc(r.name||'\u2014')+'</td><td>'+esc(r.powner||'\u2014')+'</td><td class="r">'+(sp?'m'+sp[0]+'\u2013'+sp[1]:'\u2014')+'</td><td class="r"><strong>'+fmtMoney(bpStepMoney(r))+'</strong></td><td class="r">'+esc(r.gateDec||'\u2014')+'</td></tr>'}).join('')+'</tbody></table>';else h+='<p class="cr-empty" style="margin-top:4px">No development phases recorded.</p>'}
h+='</div>'});
else h+='<p class="cr-empty">Nothing in Development at this snapshot.</p>';
var held=orgCommittedSet().filter(function(e){return e.sunk});
if(held.length){h+='<div class="cr-item"><div class="cr-item-h"><h4 style="font-weight:600">Development costs held from killed items</h4></div>'+held.map(function(e){var yr=capReportItemYear(e,a,b);return'<div class="cr-row"><span class="n">'+esc((ideas[e.i]||{}).name||('Item '+e.i))+'</span><span class="m">entered phases held</span><span class="a">'+fmtMoney(yr.total)+'</span></div>'}).join('')+'</div>'}
h+='</div>';
var ops=(stages.operational||[]).filter(function(i){return(trk[i]||{}).status!=='killed'});var _cr=capCommitments().rows;
h+='<div class="cr-list"><h3 style="color:#9B2D3F">Committed \u2013 Operational ('+ops.length+')</h3>';
if(ops.length)ops.forEach(function(i){var r=null;for(var k=0;k<_cr.length;k++)if(_cr[k].i===i&&_cr[k].stage==='Operational'){r=_cr[k];break}var yr=capReportItemYear({i:i,op:true},a,b);
h+='<div class="cr-row"><span class="n">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span class="m">'+(isT?(r?r.label:'Full plan'):(yr.dev?'development '+fmtMoney(yr.dev)+' \u00b7 ':'')+'rollout '+fmtMoney(yr.roll)+' \u00b7 sustainment '+fmtMoney(yr.sus))+'</span><span class="a">'+fmtMoney(isT?(r?r.amt:0):yr.total)+'</span></div>'});
else h+='<p class="cr-empty">Nothing operational at this snapshot.</p>';
h+='</div>';
if(isT){var opts=stages.explore.filter(function(i){return(proj[i]||{}).viable===true});
h+='<div class="cr-list"><h3 style="color:#2D5A8E">Exploration (potential future projects, no financial commitments yet) ('+opts.length+')</h3>';
if(opts.length)opts.forEach(function(i){h+='<div class="cr-row"><span class="n">'+esc((ideas[i]||{}).name||('Item '+i))+'</span><span>'+(progContracted(i)?'<span class="cr-badge" style="background:#1B6B5A">Program contracted</span>':'')+'<span class="cr-badge" style="background:#2D5A8E">'+getScore(i)+'/50</span></span><span class="m">Potential: Development '+fmtMoney(devCost(i))+' \u00b7 Rollout '+fmtMoney(opsRolloutCost(i))+' \u00b7 Sustainment '+fmtMoney(opsSustainCost(i))+'/yr</span></div>'});
else h+='<p class="cr-empty">No Go projects waiting in Exploration.</p>';
h+='</div>'}
h+='</div></div>';
return h}
```

**Nothing to check yet.** This change becomes visible at Step 42.

---

### Step 42 — Add the function that draws the whole body of the Capital Snapshot document: every budget year, then the total.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capReportSection` ends, after its closing `}`.

**Code:**

```js
/* the whole body: every budget year, then the total */
function capReportBody(){var cap=data.capital||{};
if(!cap.aiBudget)return'<p class="cr-empty">Set your AI Projects Budget at Step 3.2.</p>';
var Y=envYearsOf(),L=capLens();var srs=orgMonthly();var mx=0;if(srs)srs.forEach(function(r){mx=Math.max(mx,r.dev+r.roll+r.sus,capSusCapLine(r.m))});
var h='';for(var y=1;y<=Y;y++)h+=capReportSection(y,L,mx,y-1,Y+1);h+=capReportSection('T',L,mx,Y,Y+1);return h}
```

**Check:** Open Phase 3's Capital Snapshot output and click ▾ Save as PDF. After the first page, one section per budget year — Year 1, Year 2, Year 3 — each starting on a new page with its figures, its committed calendar, and its capacity waterfall, then a final section for the total.

---

### Step 43 — Replace the function behind the Governance Framework's Save as PDF button, so that it prints the Governance Framework document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printGovFW`.

**Code:**

```js

function printGovFW(){printDocument('Governance Framework',govFrameworkDoc(),'')} /* 16 Sep 2026: the composed document, not the page */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 44 — Replace the function that lists the people in the RACI matrix's columns, so that every embedded lead and every engaged senior leader appears, with no cap of four.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `raciCols`.

**Code:**

```js

// === ENHANCED OUTCOME PAGES (replacing skeletons) ===

/* RACI columns are keyed by stable person identity, never by position: 'owner' and 'finance'
   are fixed keys; leads and seniors carry generated ids. Cell keys are '<activity>:<personKey>',
   so letters follow the person when the lists change. ensureRaciModel() backfills missing ids
   and migrates legacy '<activity>-<columnIndex>' cells onto whoever holds that column now. */
function raciCols(){ /* 17 Sep 2026 (Paul's ruling): no cap on leads or seniors — the matrix takes as many people as the organization names, as Governance's does */
var ow=data.ownership||{};var cols=[{k:'owner',l:ow.ownerName||'Pipeline Owner'}];
(ow.leads||[]).filter(function(l){return l&&(l.name||l.dept)}).forEach(function(l){cols.push({k:l.id,l:l.name||l.dept})});
(ow.seniors||[]).filter(function(sl){return sl&&(sl.name||sl.role)}).forEach(function(sl){cols.push({k:sl.id,l:sl.name||sl.role})});
cols.push({k:'finance',l:'Finance'});return cols}
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 45 — Add the function that draws one letter of the RACI matrix as a coloured chip.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `purgeRaciFor` ends, after its closing `}`.

**Code:**

```js
/* addendum 188 (17 Aug 2026, Paul's ruling): the Architecture module's RACI graphics, ported onto the governance data model, and from there onto the Innovation Pipeline's 17 Sep 2026 (Paul's ruling: the matrix looks as Governance's does wherever it appears) \u2014 colored letter chips, click-to-cycle cells, and the legend row. The activity inputs, the accountable-count warning, and the team rows above the matrix are unchanged. saveGovRaci stays in place pending a dead-code ruling. */
function _raciChip(v,colors){return '<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:'+colors[v]+';color:#fff;font-size:13px;font-weight:700">'+v+'</span>'}
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 46 — Add the function that draws the RACI matrix's legend: what R, A, C, and I mean.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_raciChip` ends, after its closing `}`.

**Code:**

```js
function _raciLegend(colors){var h='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--text-faint)">';
[['R','Responsible \u2014 does the work'],['A','Accountable \u2014 owns the decision, exactly one per activity'],['C','Consulted \u2014 input before'],['I','Informed \u2014 told after']].forEach(function(l){h+='<span><span style="display:inline-block;width:16px;height:16px;line-height:16px;border-radius:8px;background:'+colors[l[0]]+';color:#fff;font-size:10px;font-weight:700;text-align:center;margin-right:4px">'+l[0]+'</span>'+l[1]+'</span>'});
return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 47 — Add the constant holding the four colours of the RACI chips.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_raciLegend` ends, after its closing `}`.

**Code:**

```js
var RACI_COLORS={R:'#1B6B5A',A:'#2D5A8E',C:'#8B5E3C',I:'#6B7F8D'}; /* letters ride solid chips; Informed takes the slate-grey (Governance addendum 188) */
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 48 — Add the function behind a click on a RACI cell: it cycles the cell through R, A, C, I, and blank.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RACI_COLORS` ends.

**Code:**

```js
function raciCycle(key){if(Collab.lockedByOther('raci::'+key))return;ensureRaciModel();if(!data.raci)data.raci={};var order=['','R','A','C','I'];var cur=data.raci[key]||'';data.raci[key]=order[(order.indexOf(cur)+1)%order.length];Store.commit('raci',key);render()} /* the cell itself is the control, cycling R → A → C → I → blank */
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 49 — Replace the function that draws the RACI matrix on step 2.1 and on the RACI output page, so that the letters ride coloured chips, a cell cycles on click, and a legend sits beneath.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `raciMatrix`.

**Code:**

```js
function raciMatrix(ro){ensureRaciModel();
var raci=data.raci||{};var cols=raciCols();var colors=RACI_COLORS;
var acts=['Approve experiments','Advance projects','Allocate budget','Kill projects','Pipeline reporting','Weekly session','Quarterly review'];
var h=(ro?'':'<p style="font-size:12px;color:var(--text-faint);margin:0 0 6px">Click on a blank space on the matrix to assign roles.</p>')+'<div class="u-df74e8d"><table class="u-d1d587b"><thead><tr><th class="u-cd4ed5d">Activity</th>';
cols.forEach(function(c){h+='<th class="u-136497d">'+esc(c.l)+'</th>'});
h+='</tr></thead><tbody>';
acts.forEach(function(a,ai){var aCount=cols.filter(function(c){return raci[ai+':'+c.k]==='A'}).length;
h+='<tr style="background:'+(ai%2===0?'rgba(var(--fg-rgb),.04)':'rgba(var(--fg-rgb),.01)')+'"><td class="u-4a76a82">'+a+(ro||aCount===1?'':'<div style="font-size:11px;color:#C8860A;font-weight:600;margin-top:2px;min-height:15px">exactly one accountable name'+(aCount>1?' \u2014 '+aCount+' marked A':'')+'</div>')+'</td>';
cols.forEach(function(c){var key=ai+':'+c.k;var v=raci[key]||'';
if(ro){h+='<td class="u-47b192e">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.3);font-size:13px">\u2014</span>')+'</td>'}
else{h+='<td class="u-47b192e" id="raci_'+key+'" onclick="raciCycle(\''+key+'\')" title="Click to cycle R \u2192 A \u2192 C \u2192 I \u2192 blank" style="cursor:pointer">'+(v?_raciChip(v,colors):'<span style="color:rgba(var(--faint-rgb),.35);font-size:13px">\u2014</span>')+'</td>'}});
h+='</tr>'});
h+='</tbody></table></div>'+_raciLegend(colors);
return h} /* 17 Sep 2026 (Paul's ruling): Governance's matrix — coloured letter chips, click-to-cycle cells in place of the selects, the accountable-count note, the legend — on the 2.1 step and the output page alike */
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 50 — Replace the function that draws the RACI Matrix output page, so that it carries the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutRaciFull`.

**Code:**

```js
function renderOutRaciFull(){
return'<div class="flx-between-top-mb"><div>'+badge('Phase 2 Output','#2D5A8E')+'<h2 class="h-big">RACI Matrix</h2><p class="t-stone-sm">R=Responsible A=Accountable C=Consulted I=Informed \u2013 filled out at Step 2.1 (Ownership &amp; Structure); this page is the printable record.</p></div>'+'<div style="display:flex;gap:8px">'+btn(UI.expanded.raciEdit?'\u2713 Done':'\u270E Edit','UI.expanded.raciEdit=!UI.expanded.raciEdit;render()','bs','font-size:13px')+'<button class="btn bg2" style="font-size:12px" onclick="printRaci()">\u25be Save as PDF</button>'+'</div>'+'</div>'+raciMatrix(!UI.expanded.raciEdit)}
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 51 — Replace the function behind the RACI Matrix page's Save as PDF button, so that it prints the RACI Matrix document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printRaci`.

**Code:**

```js
function printRaci(){printDocument('RACI Matrix',raciDoc(),'')} /* 16 Sep 2026: the matrix on its landscape page */
```

**Nothing to check yet.** This change becomes visible at Step 147.

---

### Step 52 — Replace the function that draws a program's development track for reading, so that it shows the infrastructure learnings the step actually records.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `devCardRO`.

**Code:**

```js
function devCardRO(i){var tr=((data.tracking||{})[i])||{};var f=function(l,v){return v?'<div><div class="u-b25d981">'+l+'</div><div class="u-2ad7718">'+esc(v)+'</div></div>':''};
var g=f('Results to date',tr.results)+f('Infrastructure learnings',tr.infraLearnings||tr.learnings) /* 16 Sep 2026 (seed check): the step and the seed write infraLearnings; the card read a key nothing wrote */+f('What\u2019s breaking / working',tr.breakWork);
return progSnapRO(i)+(g?'<div class="gr-2" style="margin-top:10px">'+g+'</div>':'')}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 53 — Replace the function that draws the Development Portfolio page, so that it carries the Summary / Full choice and the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutExpbriefsFull`.

**Code:**

```js
function renderOutExpbriefsFull(){
var ideas=data.ideas||[],exp=data.experiments||{},exSel=data.expSelected||[],trk=data.tracking||{},stages=getStages();
var h='<h2 class="h-section">Development Portfolio</h2><p class="t-lead">Programs in progress. Track phase status, take gate decisions as phases end, and launch completed projects to Operational \u2013 all from this page.</p>';
h+=outputPrintRow(currentStep); /* 16 Sep 2026: the print control */
h+=pipeViz('experiment');
if(stages.experiment.length===0){h+=card('<div class="empty-state"><p class="t-faint">'+(exSel.length>0?'All programs have been launched to Operational.':'No projects in Development. Advance Go, graded projects from the Exploration portfolio.')+'</p></div>');return h+archivePanel(['experiment'],'oeb')}
stages.experiment.forEach(function(i,rank){var e=exp[i]||{},idea=ideas[i],tr=trk[i]||{};
var open=!!UI.expanded['oe'+i];var killed=tr.status==='killed';var pb=(data.portfolio||{})[i]||{};
var head='<div class="flx-row-mb-12-clean xh" style="cursor:pointer" onclick="event.stopPropagation();UI.expanded[\'oe'+i+'\']=!UI.expanded[\'oe'+i+'\'];render()"><div class="u-5d029f6">'+hzWarn(i,true)+'<span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><span class="u-0447ee5">#'+(rank+1)+'</span><h4 class="u-3a484c9"'+(killed?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+(tr.status?badge(tr.status,tr.status==='complete'?'#1B6B5A':tr.status==='running'?'#2D5A8E':killed?'#9B2D3F':'rgba(var(--faint-rgb),.5)'):'')+progStrip(i)+'</div>'+badge('Development','#8B5E3C')+((((data.projects||{})[i])||{}).legacy?badge('Legacy','#D4A017'):'')+'</div>';
var body='';
if(open){body=devPortBody(i)}h+=card(head+body,'margin-bottom:16px;border-left:4px solid '+(killed?'#9B2D3F':'#8B5E3C')+(open?'':';cursor:pointer'),xpandAttr('oe'+i,open))});
h+=balancePanel(stages.experiment,'experiment');
h+=archivePanel(['experiment'],'oeb');
return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 54 — Replace the function that draws Phase 4's third output, so that it shows the Portfolio Review instead of a second Development Portfolio.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutFinalportFull`.

**Code:**

```js

function renderOutFinalportFull(){return renderOutPortfolioReview()} /* 17 Sep 2026 (Paul's ruling): the Portfolio Review page \u2014 the Development Portfolio\u2019s second appearance is gone */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 55 — Replace the function that draws the Exploration Portfolio page, so that it carries the Summary / Full choice and the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutExploreEnhanced`.

**Code:**

```js
function renderOutExploreEnhanced(){
var ideas=data.ideas||[],proj=data.projects||{},port=data.portfolio||{},as=data.assessments||{},stages=getStages();
var h='<h2 class="h-section">Exploration Portfolio</h2><p class="t-lead">Run the deepened assessment and re-score, issue the Go / No-Go verdict, grade horizon, risk, and reward, then advance Go projects to Development \u2013 all from this page.</p>';
h+=outputPrintRow('out-explore'); /* 16 Sep 2026: the print control */
h+=pipeViz('explore');
if(!UI.oxTab)UI.oxTab=1;
h+='<div class="flx-g2-wrap mb-5">'+[{t:1,l:'Structured Portfolio'},{t:2,l:'Allocate Capital'}].map(function(tb){return'<button onclick="UI.oxTab='+tb.t+';render()" style="padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans,Helvetica Neue,sans-serif);border:'+(UI.oxTab===tb.t?'2px solid #8B5E3C':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(UI.oxTab===tb.t?'rgba(139,94,60,.12)':'rgba(var(--fg-rgb),.02)')+';color:'+(UI.oxTab===tb.t?'var(--paper)':'var(--text-faint)')+'">'+tb.l+'</button>'}).join('')+'</div>';
if(UI.oxTab===2)return h+allocCore();
if(stages.explore.length===0&&stages.noGo.length===0){h+=card('<div class="empty-state"><p class="t-faint">No projects in Exploration yet. Select ideas from the Blue Sky portfolio to begin.</p></div>');return h+archivePanel(['explore','noGo'],'oxp')}
if(stages.explore.length>0){
var _srt=stages.explore.slice().sort(function(a,b){return getScore(b)-getScore(a)});
var _grd=[],_awt=[],_inc=[];
_srt.forEach(function(i){var _pj=proj[i]||{},_pb=port[i]||{};if(_pj.viable===true&&_pb.horizon&&_pb.risk&&_pb.reward)_grd.push(i);else if(_pj.viable===true)_awt.push(i);else _inc.push(i)});
var _sec=function(t){return'<div class="flx-row-mb-12" style="margin-top:8px"><h3 class="u-ce641a4">'+t+'</h3></div>'};
var _cardFor=function(i){var idea=ideas[i],p=proj[i]||{},pb=port[i]||{},a1=as[i]||{},rs=p.rescore||{};var _kd=(((data.tracking||{})[i])||{}).status==='killed';var open=!!UI.expanded['ox'+i];
var graded=!!(pb.horizon&&pb.risk&&pb.reward);
var vBadge=p.viable===true?badge('Go','#1B6B5A'):'';
var head='<div class="flx-between xh" onclick="event.stopPropagation();UI.expanded[\'ox'+i+'\']=!UI.expanded[\'ox'+i+'\'];render()" style="cursor:pointer"><div style="display:flex;gap:8px"><span style="color:var(--stone);font-size:15px;padding-top:1px">'+(open?'\u25be':'\u25b8')+'</span><div><h4 class="h-card"'+(_kd?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+' '+(_kd?badge('Killed','#9B2D3F')+' ':'')+vBadge+(p.viable===true&&graded?' '+badge('Portfolio assessment complete','#8B5E3C'):'')+'</h4><p class="t-stone-snug">'+esc(p.objectives||(idea?idea.desc:''))+'</p></div></div><div class="w-min-50"><div class="score-num-md">'+getScore(i)+'</div><div class="t-faint-sm">/50</div></div></div>';
var body='';
if(open){body=expPortBody(i)}h+=card(head+body,'margin-bottom:10px;border-left:4px solid '+(p.viable===true?'#1B6B5A':'#2D5A8E')+(open?'':';cursor:pointer'),xpandAttr('ox'+i,open))};
h+=_sec('Structured Portfolio ('+_grd.length+')');
if(!_grd.length)h+='<p class="t-faint-sm" style="margin:0 0 14px">Nothing graded yet \u2013 the structured portfolio is the graded set.</p>';
_grd.forEach(_cardFor);
if(_awt.length){h+=_sec('Not Yet Positioned ('+_awt.length+')');_awt.forEach(_cardFor)}
if(_inc.length){h+=_sec('Incomplete ('+_inc.length+')');_inc.forEach(_cardFor)}}
h+=notAdvPanel('oxp');
h+=balancePanel(stages.explore,'explore');
h+=archivePanel(['explore','noGo'],'oxp');
return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 56 — Replace the function that draws the Operational Portfolio page, so that it carries the Summary / Full choice and the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutOperFull`.

**Code:**

```js
function renderOutOperFull(){
var ideas=data.ideas||[],stages=getStages(),trk=data.tracking||{},exp=data.experiments||{},opsData=data.opsData||{};
var operational=stages.operational||[];
var h='<h2 class="h-section">Operational Portfolio</h2><p class="t-lead">Live projects deployed in your business. Monitor performance and manage operations.</p>';
h+=outputPrintRow('out-oper'); /* 16 Sep 2026: the print control */
h+=pipeViz('operate');
if(!operational.length){h+=card('<div class="empty-state"><div class="u-947fc58">✕</div><p class="u-27e8e2c">No operational projects yet.</p><p class="u-97af957">Projects move here when launched from Development or given a "Buy/Scale" decision.</p></div>');return h+archivePanel(['operational'],'oop')}
operational.forEach(function(i){var idea=ideas[i],e=exp[i]||{},tr=trk[i]||{},ops=opsData[i]||{},pb=(data.portfolio||{})[i]||{};
var hColor=ops.health==='green'?'#1B6B5A':ops.health==='amber'?'#D4A017':ops.health==='red'?'#9B2D3F':'#2D5A8E';var opKilled=tr.status==='killed';if(opKilled)hColor='#9B2D3F';
var open=!!UI.expanded['oo'+i];
var head='<div class="u-c3626c3 xh" onclick="event.stopPropagation();UI.expanded[\'oo'+i+'\']=!UI.expanded[\'oo'+i+'\'];render()" style="cursor:pointer"><div class="flx-center gap-2 mb-1"><span style="color:var(--stone);font-size:15px">'+(open?'\u25be':'\u25b8')+'</span><h4 class="u-6e57e18"'+(opKilled?' style="text-decoration:line-through;color:#9B2D3F"':'')+'>'+esc(idea?idea.name:'')+'</h4>'+(opKilled?badge('Killed','#9B2D3F'):badge('Operational','#1B6B5A'))+((((data.projects||{})[i])||{}).legacy?badge('Legacy','#D4A017'):'')+'</div><div class="u-7fc1635">'+['green','amber','red'].map(function(hh){return'<button title="'+(hh==='green'?'Health: on track':hh==='amber'?'Health: watch':'Health: at risk')+'" onclick="event.stopPropagation();setOpsHealth('+i+',\''+hh+'\')" style="width:28px;height:28px;border-radius:14px;border:'+(ops.health===hh?'2px solid #333':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(hh==='green'?'#1B6B5A':hh==='amber'?'#D4A017':'#9B2D3F')+';opacity:'+(ops.health===hh?1:.3)+';cursor:pointer"></button>'}).join('')+'</div></div>';
var body=!open?'':opPortBody(i);h+=card(head+body,'margin-bottom:16px;border-left:4px solid '+hColor+(open?'':';cursor:pointer'),xpandAttr('oo'+i,open))});
h+=balancePanel(stages.operational||[],'operational');
h+=archivePanel(['operational'],'oop');
return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 57 — Replace the function that computes the five Assessment Report scores, so that the Knowledge score averages all four knowledge answers on the shared four-rung scale.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `getAssessmentScores`.

**Code:**

```js

/* Compute the 5-axis Assessment scores from the Phase 1 data. */
function getAssessmentScores(){
  var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},au=data.audit||[],de=data.decisions||{};
  // Purpose Clarity: % of the collected purpose fields filled
  var pFilled=['mission','values','goals','frictions','shortTerm','mediumTerm','longTerm'].filter(function(f){return p[f]&&String(p[f]).trim()}).length;
  var purposeScore=pFilled/7*5;
  // AI Knowledge: the average of the four answers. Awareness is a 1\u20135 rating; usage, resources, and learning are words, each on a four-rung scale (17 Sep 2026, Paul's ruling): None 1, the second rung 2.3, the third 3.7, the fourth 5
  var kVals=['usage','awareness','resources','learning'].map(function(f){var v=k[f];if(typeof v==='number')return v;var r=KNOWLEDGE_SCALE[f]&&KNOWLEDGE_SCALE[f][v];return r||0}).filter(function(v){return v>0});
  var knowledgeScore=kVals.length?(kVals.reduce(function(a,b){return a+b},0)/kVals.length):0;
  // Culture: average of 6 Likerts
  var cuKeys=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'];
  var cuVals=cuKeys.map(function(f){return typeof cu[f]==='number'?cu[f]:0}).filter(function(v){return v>0});
  var cultureScore=cuVals.length?(cuVals.reduce(function(a,b){return a+b},0)/cuVals.length):0;
  // Innovation Audit: scale by # entries (0-3 OK, 4+ = 5/5)
  var auditScore=Math.min(5,(au.length||0)*1.25);
  // Decisions: # of 5 decision rights answered
  var qs=['q1','q2','q3','q4','q5'];
  var answered=qs.filter(function(q){return de[q]&&de[q].who}).length;
  var decisionScore=answered;
  return [
    {name:'Purpose',score:purposeScore},
    {name:'Knowledge',score:knowledgeScore},
    {name:'Culture',score:cultureScore},
    {name:'Audit',score:auditScore},
    {name:'Decisions',score:decisionScore}
  ];
}
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 58 — Add the constant mapping the knowledge step's word answers onto the 1 to 5 scale.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `getAssessmentScores` ends, after its closing `}`.

**Code:**

```js
var KNOWLEDGE_SCALE={usage:{none:1,basic:2.3,moderate:3.7,advanced:5},resources:{none:1,limited:2.3,moderate:3.7,strong:5},learning:{none:1,informal:2.3,some:3.7,systematic:5}}; /* 17 Sep 2026 (Paul's ruling): the knowledge step's word answers on the 1\u20135 scale, four rungs each, so the Knowledge dimension averages all four questions */
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 59 — Replace the function that draws the sidebar, so that each phase's outputs sit behind one folded line and the sidebar reads the shared list of pages that show it.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderSidebar`.

**Code:**

```js

// === SIDEBAR ===
function renderSidebar(){
  var sb=document.getElementById('pipSidebar');
  if(!sb)return;
  var showSidebar=sidebarPageShown();
  sb.style.display=showSidebar?'flex':'none';
  // Apply min/max class
  sb.className = 'sidebar' + (sidebarOpen ? '' : ' collapsed') + (sidebarMinimized ? ' mini' : '');
  var app=document.getElementById('app');
  if(app){
    app.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){app.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){app.classList.add('sidebar-mini');}
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
    // Keep the toggle pinned in the nav's top-left corner in every state.
    // It sits in the fixed nav band (top:16px) alongside the logo; pushing it
    // rightward (e.g. 270px) dropped the icon onto the "PIPELINE" logo text.
    btn.style.left = '16px';
  }
  if(!showSidebar)return;

  // Build header with min/max toggle button
  var togContent = sidebarMinimized ? '»' : '«&nbsp;&nbsp;Minimize';
  var togTitle = sidebarMinimized ? 'Maximize sidebar' : 'Minimize sidebar';
  var headerHtml = '<div class="sidebar-header">'
    + (sidebarMinimized ? '<div class="sidebar-logo-mini" title="AI Pipeline">AI</div>' : '<div class="sidebar-logo">AI <span>Pipeline</span></div>')
    + '<button class="sidebar-size-tog" onclick="toggleSidebarSize()" title="' + togTitle + '" aria-label="' + togTitle + '">' + togContent + '</button>'
    + '</div>';

  // Build minimized body: phase circles only
  if(sidebarMinimized){
    var h='<div class="sidebar-inner">';
    h += headerHtml;
    h += '<div class="sidebar-scroll">';
    h += '<div class="sidebar-mini-row' + (currentPage==='pipeline'?' active':'') + '" onclick="go(\'pipeline\')" title="Overview">'
      + '<span class="sidebar-mini-icon">▦</span></div>';
    for(var i=0;i<PH.length;i++){
      var ph=PH[i];
      var isPhaseActive=(currentPage==='phase'&&currentStep===String(ph.id));
      var hasActiveStep = (currentPage==='step' && currentStep && String(currentStep).charAt(0)===String(ph.id));
      var hasActiveOutcome = currentPage==='outcome';
      h += '<div class="sidebar-mini-row' + (isPhaseActive||hasActiveStep?' active':'') + '" '
        + 'onclick="go(\'phase\',\''+ph.id+'\')" '
        + 'title="Phase '+ph.id+': '+ph.name+' ('+ph.days+')">'
        + '<span class="sidebar-mini-dot" style="background:'+ph.color+'">'+ph.id+'</span>'
        + '</div>';
    }
    h += '</div>';
    // Sticky footer: explicit Maximize button — impossible to miss
    h += '<button class="sidebar-mini-max" onclick="maximizeSidebar()" title="Maximize sidebar" aria-label="Maximize sidebar">»</button>';
    h += '</div>';
    sb.innerHTML = h;
    updateSidebarState();
    return;
  }

  // Maximized (full) view
  // Multi-open sections: any number of phases can show their steps + outputs
  // at once. Selecting a phase (or any step within it) opens that phase and
  // does not collapse the others.
  // - On navigation (page/step change) the open phase follows the selection.
  // - The chevron opens/collapses a phase in place without navigating; that
  //   choice holds until the next navigation.
  var actId = activeNavPhaseId();
  var pageKey = currentPage + ':' + currentStep;
  if(!UI.navOpenSet){ UI.navOpenSet = {}; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  if(UI._navPageKey !== pageKey){ UI._navPageKey = pageKey; if(actId!=null) UI.navOpenSet[String(actId)] = true; }
  var h='<div class="sidebar-inner">';
  h += headerHtml;
  h+='<div class="sidebar-scroll">';
  h+='<div class="sidebar-home'+(currentPage==='pipeline'?' active':'')+'" onclick="go(\'pipeline\')">Overview</div>';
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
        var cls='sidebar-step'+(isActive?' active':isDone?' done':'');
        h+='<div class="'+cls+'" onclick="go(\'step\',\''+s.id+'\')">'+(isDone&&!isActive?'':s.icon+' ')+s.id+' '+s.name+'</div>';
      }
      if(ph.outcomes&&ph.outcomes.length>0){
        var outOpen=navOutputsOpen(ph);
        h+='<div class="sidebar-outcomes-label sidebar-outcomes-fold" onclick="event.stopPropagation();toggleNavOutputs('+ph.id+')" style="cursor:pointer;user-select:none" title="'+(outOpen?'Hide the outputs':'Show the outputs')+'">'+(outOpen?'\u25BE':'\u25B8')+' Outputs <span style="opacity:.7">('+ph.outcomes.length+')</span></div>'; /* 12 Sep 2026 (Paul's ruling): the outputs sit behind a fold */
        if(outOpen){
        for(var k=0;k<ph.outcomes.length;k++){
          var o=ph.outcomes[k];
          var isOActive=(currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id;
          h+='<div class="sidebar-outcome'+(isOActive?' active':'')+'" onclick="'+(o.id.indexOf('out-')===0?'go(\'outcome\',\''+o.id+'\')':'go(\''+o.id+'\')')+'">→ '+o.name+'</div>';
        }
        }
      }
    }
    h+='</div>';
  }
  // duplicate Pipeline Dashboard removed

  h+='</div>';
  h+='</div>';
  sb.innerHTML=h;
  updateSidebarState();
}
```

**Nothing to check yet.** This change becomes visible at Step 209.

---

### Step 60 — Replace the function that says which phase the sidebar should open for the current page, so that the live portfolio and review pages belong to Phase 5.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `activeNavPhaseId`.

**Code:**

```js

// Which phase contains the current page/selection (or null on Overview etc.)
function activeNavPhaseId(){
  if(currentPage==='phase5'||currentPage==='portfolio'||currentPage==='review')return 5; /* 17 Sep 2026 (Paul's ruling): the live portfolio and review pages are Navigate's, not the earlier phases' outputs */
  if(currentPhase)return currentPhase.id;
  if(currentPage==='phase'&&currentStep)return parseInt(currentStep,10);
  // outcome-style pages routed via go('<id>') (e.g. cap-hub) set currentPage to the id
  for(var i=0;i<PH.length;i++){
    var os=PH[i].outcomes||[];
    for(var k=0;k<os.length;k++){ if(os[k].id===currentPage||os[k].id===currentStep) return PH[i].id; }
  }
  return null;
}
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 61 — Replace the function that shows or hides the sidebar for the current page, so that it reads the shared list of pages that show it.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `updateSidebarState`.

**Code:**

```js

function updateSidebarState(){
  var sb=document.getElementById('pipSidebar');
  var app=document.getElementById('app');
  var showSidebar=sidebarPageShown();
  if(sb){
    sb.className='sidebar'+(sidebarOpen?'':' collapsed')+(sidebarMinimized?' mini':'');
    sb.style.display=showSidebar?'flex':'none';
  }
  if(app){
    app.classList.remove('sidebar-collapsed','sidebar-mini');
    if(!showSidebar || !sidebarOpen){app.classList.add('sidebar-collapsed');}
    else if(sidebarMinimized){app.classList.add('sidebar-mini');}
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
    // Pinned to the nav's top-left corner; see note in renderSidebar().
    btn.style.left = '16px';
  }
}
```

**Nothing to check yet.** This change becomes visible at Step 209.

---

### Step 62 — Replace the function that draws the app's dialogs, so that the Help text names the ▾ Save as PDF button in place of the old ↓ PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderModal`.

**Code:**

```js

function renderModal(){
var mr=$('modalRoot');if(!mr)return;
if(!currentModal){mr.innerHTML='';return;}

var h='<div class="modal-bg" onclick="if(event.target===this)closeModal()">';
h+='<div class="modal">';
h+='<h3>90-Day AI Innovation Pipeline</h3>';

h+='<div class="u-e6b5a04">A step-by-step tool for building an AI innovation pipeline, built on Faisal Hoque\u2019s published frameworks. This guide explains how the module is organized and how each of its surfaces works.</div>';

h+='<div class="mb-6"><div class="section-label mb-3">What This Is</div>';
h+='<p class="t-stone-md">Five sequential phases take you from a readiness assessment to a live portfolio under quarterly review. Each phase breaks into guided steps, and every phase produces output documents you can print. Your progress, ideas, assessments, and outputs are saved to your organization\u2019s shared workspace as you work.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Getting Around</div>';
h+='<div class="u-b1b744e">';
var navRows=[
  {k:'Top nav',v:'Home \xb7 Learn \xb7 Pipeline \xb7 Navigate \xb7 Insights on the left. Your profile chip, Help, the theme toggle, Team Chat, Notes, and a More menu sit at the top right; Track Program lives under More.'},
  {k:'More menu',v:'View zoom controls, Light/Dark mode toggle, Voice, Profile (your organization &amp; team), two sample-data seeds (a day-70 program and a year-two portfolio), and Reset. App admins also see an Admin entry that opens the management panel.'},
  {k:'Left sidebar',v:'Visible on Pipeline and Navigate pages. Shows all five phases, every step, and every output document. Click \u2630 to collapse.'},
  {k:'Phase landings',v:'Click any phase number in the sidebar or Pipeline overview. Shows completion %, live metrics, an intro video, the full step sequence, and links to all phase outputs.'},
  {k:'Step pages',v:'Each step opens with a concept carousel that auto-advances (hover to pause), guided work sections, further reading, and completion tracking. Every step carries an \u201cAssigned to\u201d bar so a named owner can take it. Steps build on each other. Work them in order.'}
];
for(var i=0;i<navRows.length;i++){var nr=navRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+nr.k+'</div><div class="u-13544a9">'+nr.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Signing In &amp; Organizations</div>';
h+='<div class="u-b1b744e">';
var accessRows=[
  {k:'Sign in',v:'Enter your username and PIN on the launch screen to go straight into your organization\u2019s workspace. Tick \u201cRemember me\u201d to skip sign-in next time on this device.'},
  {k:'New organization',v:'Use \u201cSet up a new organization\u201d on the login screen to create a workspace and your own account, then add the rest of your team.'},
  {k:'Multiple organizations',v:'Each organization is a fully isolated workspace with its own profile, team, and pipeline data. Nothing is shared between them.'},
  {k:'Profiles &amp; PINs',v:'Every member has a username and PIN, editable under Profile (More menu). These identities sign work, drive step assignments, and appear in Team Chat.'},
  {k:'Admin',v:'Choose \u201cAdmin\u201d on the login screen and enter the admin passcode, which you set on first use. Admins land in the app with an admin bar across the top. The Admin panel, opened from that bar or from the More menu, lists every organization and user and lets you add, edit, or remove them. \u201cChange passcode\u201d lives on the administrator console on the sign-in side.'}
];
for(var i=0;i<accessRows.length;i++){var ar=accessRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+ar.k+'</div><div class="u-13544a9">'+ar.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">The Five Phases</div>';
h+='<div class="u-dbaf33c">';
var helpPhases=[
  {n:'01',t:'Diagnose \u2013 Days 1\u201330',col:'#1B6B5A',
   steps:'Assessment Battery \xb7 Brainstorm Use Cases \xb7 Filter & Rank',
   out:'Assessment Report \xb7 Blue Sky Portfolio',
   d:'Run a full organizational AI readiness assessment. Surface potential use cases into a Blue Sky Portfolio. Score and rank those ideas to build a ranked shortlist.'},
  {n:'02',t:'Organize \u2013 Days 31\u201350',col:'#2D5A8E',
   steps:'Ownership & Structure \xb7 Realign Incentives \xb7 Innovation Rhythm \xb7 Deepen Assessment',
   out:'Org Readiness \xb7 RACI Matrix \xb7 Exploration Portfolio',
   d:'Assign named owners with explicit decision authority. Align incentives to innovation behavior. Establish a weekly cadence. Run SWOT and gap analysis on selected ideas to build the Exploration Portfolio.'},
  {n:'03',t:'Prepare \u2013 Days 51\u201370',col:'#8B5E3C',
   steps:'Structure Portfolio \xb7 Plan Capacity \xb7 Allocate Capital \xb7 Map Development Track',
   out:'Capital Snapshot \xb7 Development Portfolio',
   d:'Sort projects by time horizon (quick win / medium / strategic). Size the multi-year capacity plan, then commit capital against it. Map each advancing project\u2019s development track: phases with budgets, owners, success metrics, and exit gate criteria.'},
  {n:'04',t:'Ignite \u2013 Days 71\u201390',col:'#9B2D3F',
   steps:'Run Development Track \xb7 Establish Governance \xb7 Stress-Test Org Design \xb7 Portfolio Review',
   out:'Governance Framework \xb7 Org Design Review \xb7 Updated Dev Portfolio',
   d:'Run the development tracks and take the gate decisions as phases end. Lock in three governance mechanisms: a standing leadership agenda, portfolio ownership of all AI projects above a certain cost threshold, and a quarterly review cycle. Stress-test decision rights, ownership, and incentives. Run the first Buy / Hold / Sell review.'},
  {n:'05',t:'Navigate \u2013 Ongoing',col:'#6B4C8A',
   steps:'Pipeline Dashboard',
   out:'Operational Portfolio \xb7 Capital Planning Hub',
   d:'Manage the live pipeline. View all four stages in real time. Run the quarterly review and make Buy, Hold, or Sell decisions on every project. The engine runs continuously.'}
];
for(var i=0;i<helpPhases.length;i++){
  var hp=helpPhases[i];
  h+='<div class="u-edbd16f">';
  h+='<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:'+hp.col+';padding-top:2px">'+hp.n+'</div>';
  h+='<div>';
  h+='<div class="u-c4172bc">'+hp.t+'</div>';
  h+='<p class="u-061830a">'+hp.d+'</p>';
  h+='<div class="u-4c03721">';
  h+='<div class="t-fade-sm"><span class="hp-tag" style="--c:'+hp.col+'">Steps</span>'+hp.steps+'</div>';
  h+='<div class="t-fade-sm"><span class="hp-tag" style="--c:'+hp.col+'">Outputs</span>'+hp.out+'</div>';
  h+='</div></div></div>';
}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">The Pipeline Funnel</div>';
h+='<p class="u-cf9c823">Ideas flow through four stages as they progress. Counts update in real time across the entire app.</p>';
h+='<div class="u-5421535">';
var funnelStages=[{n:'Blue Sky',c:'#1B6B5A',d:'All ideas \u2013 unscored'},{n:'Exploration',c:'#2D5A8E',d:'Selected & scored'},{n:'Development',c:'#8B5E3C',d:'Funded development phases'},{n:'Operational',c:'#9B2D3F',d:'Live & scaling'}];
for(var i=0;i<funnelStages.length;i++){var fs=funnelStages[i];h+='<div style="flex:1;padding:12px 14px;border-right:1px solid rgba(var(--fg-rgb),.08);background:'+fs.c+'10"><div style="font-family:var(--mono);font-size:9px;font-weight:700;color:'+fs.c+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">'+fs.n+'</div><div class="u-79e87b9">'+fs.d+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">How the Money Works</div>';
h+='<div class="u-b1b744e">';
var moneyRows=[
  {k:'Commitments',v:'Money commits when a project advances into the Development stage. Advancing commits the project\u2019s whole budget plan, month by month: development steps, rollout steps, and sustainment. You never type a committed total by hand. Every money surface in the app, from the ledger to the charts to the gates, reads that same monthly table.'},
  {k:'Annual budgets',v:'Each year of the planning period has its own budget. A breach means that at least one year\u2019s committed plan exceeds that year\u2019s budget. The advance gates, the chart warning, and the per-year strip all report that one test. When a breach appears, the funding plan shows how to resolve it.'},
  {k:'Whole months',v:'Development and rollout steps spread their cost evenly across the months they cover. If you want more granularity and variance across months, add more steps. Sustainment counts at one twelfth of its annual rate per month, starting the month after rollout ends or at the later start the budget plan sets.'},
  {k:'Kill, pause, revive',v:'Killing a project releases the in-window money for development phases that have not begun, along with its rollout and sustainment months. Phases already begun stay committed. Any wind-down costs you enter go to the kill &amp; phase-out pot. Pausing a project holds its full commitment in place. Reviving a killed project puts its commitment back.'},
  {k:'Locked cost fields',v:'While a section of a budget plan holds money, the matching simple cost field locks and reads \u201cDerived from budget plan.\u201d Clear that section\u2019s money and the field is freed again.'},
  {k:'Quarters &amp; fiscal years',v:'Quarters count from the planning period start you set at Plan Capacity (Step 3.2). If your fiscal year begins in a different month, the selector on the review page aligns the review labels to it. That selector changes the display only. The money math never reads it.'}
];
for(var i=0;i<moneyRows.length;i++){var mo=moneyRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+mo.k+'</div><div class="u-13544a9">'+mo.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">The Quarterly Review</div>';
h+='<p class="t-stone-md" style="margin-bottom:10px">The review runs in two places. Step 4.4 hosts the first review with teaching material around it. After that, the Portfolio Review card on the Navigate dashboard hosts it under \u201cRun the review.\u201d It is one surface with one state, so a decision recorded on either page is the same decision.</p>';
h+='<div class="u-b1b744e">';
var reviewRows=[
  {k:'What you see',v:'The next review date, the fiscal-year selector, a Review Snapshot (Start Date Drift, Launch Variance, Overrides, Sustainment Cap, Intake Reserve), the Portfolio Balance cards, and a Portfolio Learnings card with five boxes for capturing what the cycle taught you.'},
  {k:'Decision rows',v:'Every project in development, every operational project, and every viable exploration project gets a row with Buy, Hold, and Sell buttons. Click the row head to expand it. The expansion is the full live portfolio card, the same one the portfolio pages use, so edits you make during the review are real.'},
  {k:'Buy',v:'Buy on a development project launches it when you close the review. Buy on an exploration project advances it into the Development stage at close, under the same grade and capital checks as the Advance button on its card.'},
  {k:'Sell',v:'Sell on a development project opens the kill confirm panel inside the expanded card. The panel shows what killing releases, what stays committed, and takes any wind-down costs for the kill &amp; phase-out pot. Sell on an exploration project kills it at once, because nothing is committed yet. Clicking an active decision again removes it. Click the green Revive button that replaces Sell to revive a killed project.'},
  {k:'Closing',v:'\u201cClose Review &amp; Start New Cycle\u201d applies the Buy decisions, moves the closed review into history, and starts the next cycle.'}
];
for(var i=0;i<reviewRows.length;i++){var rv=reviewRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+rv.k+'</div><div class="u-13544a9">'+rv.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Track Program</div>';
h+='<p class="t-stone-md" style="margin-bottom:10px">The \u25a6 Track Program item under the \u2026 More menu opens Module Management. It puts every step of the module in one place: who owns it, when it is due, and how completion is pacing against the 90 days.</p>';
h+='<div class="u-b1b744e">';
var hubRows=[
  {k:'Assignments',v:'Every step, grouped by phase, with a status badge, an optional deadline, and an assignment button. \u201cThis Week\u201d lists the steps that are overdue or due within seven days. You can also assign a step from the \u201cAssigned to\u201d bar on the step page itself.'},
  {k:'Analytics',v:'A 90-Day Burn-up against the ideal pace, Module Velocity per program week, Workload by Member, and Signals. \u201cSave as PDF\u201d prints the analytics as a formatted report.'},
  {k:'Email notifications',v:'When a step is completed for the first time, the app emails a completion report to every team member with an email address, with the analytics attached as a PDF. When an assigned step comes within seven days of its deadline, the app emails one reminder to the assignees and to the organization\u2019s administrator account \u2013 the owner account created when the organization was set up.'}
];
for(var i=0;i<hubRows.length;i++){var hb=hubRows[i];h+='<div class="u-64f1789"><div class="u-57ca10d">'+hb.k+'</div><div class="u-13544a9">'+hb.v+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">RACI Matrix</div>';
h+='<p class="t-stone-md">You fill in the RACI Matrix at Step 2.1 (Ownership &amp; Structure). R marks the person responsible, who does the work. A marks the person accountable, who owns the outcome, with exactly one A per activity. C marks people consulted before decisions. I marks people informed after decisions. The printable record lives under Phase 2 outputs, where an \u270e Edit toggle lets you revise the matrix in place and \u25be Save as PDF prints it.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Tools</div>';
h+='<div class="u-b1b744e">';
var tools=[
  {ic:'? Help',d:'Top-right nav. Opens this guide at any time.'},
  {ic:'\u25a6 Track Program',d:'Under the \u2026 More menu. Opens the Track Program hub for step assignments, deadlines, analytics, and email notifications.'},
  {ic:'\u2726 AI Guide',d:'Orange button, bottom-right corner. Context-aware for whichever step you are on. Ask it anything about the current step, your data, or portfolio decisions.'},
  {ic:'\u2261 Team Chat',d:'Top-right nav. Log decisions and messages with your team. Separate from the AI Guide conversation.'},
  {ic:'\u270e Notes',d:'Top-right nav. Capture thoughts as you work through each step. Notes are tagged to the step you are on when you write them.'},
  {ic:'\u25c7 Profile',d:'In the More menu. Set your organization details and manage the team roster. You can add, edit, or remove members inline.'},
  {ic:'\u25c9 Voice',d:'In the More menu. Navigate hands-free. Say: \u201chome\u201d \xb7 \u201clearn\u201d \xb7 \u201cpipeline\u201d \xb7 \u201cnavigate\u201d \xb7 \u201chelp\u201d \xb7 \u201copen guide\u201d \xb7 \u201copen notes\u201d \xb7 \u201cclose\u201d'},
  {ic:'\u2295 View',d:'In the More menu. Zoom the whole app in or out, fit the page to your screen, or reset to 100%. Useful for presentations and smaller displays.'},
  {ic:'\u25be Save as PDF',d:'Every output document has a \u25be Save as PDF button to print or save a formatted copy. That includes the Assessment Report, Org Readiness, the Capital Snapshot, the Governance Framework, and the rest.'},
  {ic:'\u21bb Sample data',d:'In the More menu. Seeds the workspace with a realistic example portfolio so you can explore every screen before entering your own data. Reset clears it.'}
];
for(var i=0;i<tools.length;i++){var tl=tools[i];h+='<div class="u-6dc0f40"><div class="u-57ca10d">'+tl.ic+'</div><div class="u-13544a9">'+tl.d+'</div></div>';}
h+='</div></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Navigate Dashboard</div>';
h+='<p class="t-stone-md">The Navigate tab is the live operations center. It shows real-time pipeline stage counts, per-portfolio views (Blue Sky, Exploration, Development, Operational, No-Go), the Capital Planning Hub, and a Data Bank linking to every phase output document. The quarterly review also runs here, inside the Portfolio Review card under \u201cRun the review.\u201d</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Insights</div>';
h+='<p class="t-stone-md">Curated articles, essays, and podcast episodes by Faisal Hoque \u2013 sourced from Fast Company, Psychology Today, Harvard Business Review, MIT Sloan Management Review, IMD, LinkedIn, and the CONVERGENCE podcast. Use the Refresh button to pull the latest content.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Organization &amp; Team</div>';
h+='<p class="t-stone-md">Open <strong class="t-paper">Profile</strong> from the More menu to manage the team and record your organization details. The page leads with Team Members and keeps Organization Details below it. Every member can be edited or removed inline, and each carries a username and PIN for sign-in. These profiles flow through sign-in, step assignments, and Team Chat. The details cover the organization name, website, industry, company size, region, AI maturity level, executive sponsor, and the primary objective. Creating a new organization walks you through this setup once.</p></div>';

h+='<div class="mb-6"><div class="section-label mb-3">Data &amp; Privacy</div>';
h+='<p class="t-stone-md">Your organization\u2019s workspace is stored centrally on the program\u2019s servers and is isolated from every other organization. Everyone on your team signs into the same workspace, so the work you save is the work your colleagues see, whichever device they sign in from. The AI Guide sends only your question and the current step context to the Anthropic API, routed through the program\u2019s server rather than directly from your browser. Email notifications go out through the program\u2019s email service to the addresses on the team roster. <strong class="t-paper">Reset</strong> (More menu) clears the current organization\u2019s data for the whole team, so use it with care. You can sign out at any time from your profile chip.</p></div>';

h+='<div class="u-ea28b89"><button class="btn-gold" onclick="closeModal()">Got It</button></div>';
h+='</div></div>';
mr.innerHTML=h;
}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 63 — Replace the function that builds the example data, so that it records a first quarterly review with a decision and reason on every live initiative, marks steps 4.2, 4.3, and 4.4 complete, and keeps only the budget on each program's experiment record.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `buildSeedBase`.

**Code:**

```js

/* ═══════════════════════════════════════════════════════════════
   SEED SAMPLE DATA — for testing the visualizations and multi-user
   features without manually filling forms. Triggered by the "Seed"
   button in the navbar (next to Reset).
   ═══════════════════════════════════════════════════════════════ */
function buildSeedBase(sd){ /* pure builder – fills `data` from the anchor date; no confirm, no persistence. Split from seedData for the Year 2 seed (Paul, July 8) */
  data.startDate = sd.toISOString().split('T')[0];
  data.bf12 = true;

  // ─── Phase 1: Assessment (all sections complete) ───
  data.purpose = {
    mission: 'Enable global businesses to operate at the intersection of human judgment and AI capability.',
    values: 'Trust \u00b7 Rigor \u00b7 Courage',
    shortTerm: 'Three enterprise AI pilots launched in Q1.',
    mediumTerm: 'Five operational AI pipelines by year-end.',
    longTerm: 'Industry-standard AI innovation framework adopted across 50 organizations.',
    goals: '1. Three AI pilots live\n2. Two AI case studies published\n3. Co-Delivery Partner agreement signed',
    frictions: '1. Slow capital cycles\n2. Mid-management AI literacy gaps\n3. Legacy procurement processes'
  };
  data.knowledge = { usage:'moderate', awareness:4, resources:'moderate', learning:'systematic' };
  data.culture = { uncertainty:3, aiLegitimacy:4, newProposals:4, incentives:3, frontline:3, overall:4 };
  data.audit = [
    {name:'AI-assisted customer triage', status:'alive', assigned:'yes', projIdx:0},
    {name:'Forecast model rebuild', status:'alive', assigned:'yes', projIdx:1},
    {name:'Document classification', status:'dormant', assigned:'no'},
    {name:'Knowledge graph PoC', status:'dead', assigned:'no'},
    {name:'Predictive maintenance', status:'alive', assigned:'yes', projIdx:4}
  ];
  data.decisions = {
    q1: { who:'Innovation Council',  gap:'' },
    q2: { who:'Phase Owner + CIO',   gap:'' },
    q3: { who:'CFO + COO',           gap:'Bottleneck in Q2 budget reallocation' },
    q4: { who:'Phase Owner',         gap:'' },
    q5: { who:'Resource Council',    gap:'Cross-functional staffing still slow' }
  };

  // ─── Ideas (1.2) — live idea-card schema ───
  data.ideas = [
    {name:'AI-Assisted Customer Triage', desc:'Route incoming inquiries by intent and urgency using LLM classification.', strategic:'Friction: support queue response times', cost:'Medium ($15-60K)', outcome:'Best: two-thirds of inquiries routed without human touch. Worst: misrouted urgent cases erode trust in the queue.', capabilities:'LLM classification, help-desk integration, labeled inquiry history.', risk:'Misrouting urgent complaints. Model drift as product mix changes.', dept:'Customer Ops', when:'now', timeframe:'1-3 months'},
    {name:'Forecast Demand Model', desc:'Rebuild SKU-level demand forecasting with foundation models.', strategic:'Friction: inventory write-offs', cost:'High ($60K+)', outcome:'Best: write-offs cut by a third and stockouts halved. Worst: forecasts no better than the current spreadsheet.', capabilities:'Data science capacity, clean SKU sales history, ERP integration.', risk:'Sparse history on new SKUs. Planner trust if early forecasts miss.', dept:'Supply Chain', when:'now', timeframe:'12+ months'},
    {name:'Sales Knowledge Graph', desc:'Connect CRM, contracts, and product data for a unified rep view.', strategic:'Friction: fragmented account context', cost:'High ($60K+)', outcome:'Best: reps see full account context in one view and win rates rise. Worst: an expensive integration nobody opens.', capabilities:'Graph modeling, CRM and contract system APIs, data stewardship.', risk:'Stale data undermining trust. Integration scope creep.', dept:'Sales', when:'now', timeframe:'6-12 months'},
    {name:'Document Intelligence', desc:'Extract structured data from supplier contracts and invoices.', strategic:'Friction: manual contract review', cost:'Medium ($15-60K)', outcome:'Best: contract review hours cut by half with better accuracy. Worst: extraction errors propagate into payments.', capabilities:'OCR and extraction models, finance process knowledge, sample corpus.', risk:'Extraction errors on non-standard layouts. Supplier format drift.', dept:'Finance', when:'now', timeframe:'3-6 months'},
    {name:'Predictive Maintenance', desc:'Anomaly detection on plant sensor streams.', strategic:'Friction: unplanned line stoppages', cost:'High ($60K+)', outcome:'Best: unplanned stoppages down 40% with parts ordered ahead of failure. Worst: false alarms stop healthy lines.', capabilities:'Sensor infrastructure, anomaly models, maintenance engineering time.', risk:'False positives eroding operator trust. Sensor coverage gaps.', dept:'Manufacturing', when:'now', timeframe:'3-6 months'},
    {name:'Marketing Brief Generator', desc:'Draft campaign briefs from brand and product context.', strategic:'Friction: slow campaign turnaround', cost:'Low ($0-15K)', outcome:'Best: campaign briefs in hours instead of weeks. Worst: generic briefs that still need full rewrites.', capabilities:'Prompted LLM workflow, brand guideline corpus.', risk:'Off-brand output. Overreliance replacing strategic thinking.', dept:'Marketing', when:'future', timeframe:'1-3 months'},
    {name:'HR Skills Matcher', desc:'Match internal talent to open requisitions via a skill graph.', strategic:'Friction: slow internal mobility', cost:'Medium ($15-60K)', outcome:'Best: internal fills rise and time-to-fill drops. Worst: matches ignored by hiring managers.', capabilities:'Skills taxonomy, HRIS data access, matching model.', risk:'Stale skills data. Perceived unfairness in match rankings.', dept:'HR', when:'future', timeframe:'3-6 months'},
    {name:'Sustainability Reporting', desc:'Automate ESG metric collection from systems of record.', strategic:'Friction: manual ESG assembly', cost:'Low ($0-15K)', outcome:'Best: ESG pack assembled automatically each quarter. Worst: numbers still hand-checked line by line.', capabilities:'System-of-record connectors, ESG metric definitions.', risk:'Source-data quality. Framework changes outdating the mappings.', dept:'Operations', when:'future', timeframe:'6-12 months'},
    {name:'Meeting Minutes Automator', desc:'Draft structured minutes and action items from recorded meetings.', strategic:'Friction: untracked decisions and follow-ups', cost:'Low ($0-15K)', outcome:'Best: every decision and action captured and tracked. Worst: transcripts nobody reads and actions nobody owns.', capabilities:'Speech-to-text, summarization, calendar integration.', risk:'Sensitive discussions recorded. Attribution errors in minutes.', dept:'Corporate', when:'future', timeframe:'1-3 months'},
    {name:'Supplier Risk Radar', desc:'Monitor supplier news, filings, and delivery data for early risk signals.', strategic:'Friction: reactive supplier management', cost:'Medium ($15-60K)', outcome:'Best: supplier failures flagged a quarter before they bite. Worst: alert noise that procurement tunes out.', capabilities:'News and filings feeds, entity matching, procurement workflow hooks.', risk:'False alarms damaging supplier relationships. Feed coverage gaps.', dept:'Procurement', when:'future', timeframe:'6-12 months'},
    {name:'Energy Optimization', desc:'Optimize plant energy consumption against production schedules and tariffs.', strategic:'Friction: rising energy cost per unit', cost:'High ($60K+)', outcome:'Best: energy cost per unit down 15% with no schedule impact. Worst: savings too small to justify the metering spend.', capabilities:'Sub-metering, optimization models, production schedule access.', risk:'Tariff volatility swamping gains. Production constraints limiting flexibility.', dept:'Facilities', when:'future', timeframe:'12+ months'},
    {name:'Procurement Copilot', desc:'Draft RFQs and compare supplier bids against historical pricing.', strategic:'Friction: slow sourcing cycles', cost:'Medium ($15-60K)', outcome:'Best: sourcing cycles halved and quote quality up. Worst: buyers bypass it and keep their spreadsheets.', capabilities:'LLM drafting, historical pricing data, e-sourcing integration.', risk:'Price-comparison errors. Supplier gaming of standardized RFQs.', dept:'Procurement', when:'now', timeframe:'3-6 months'},
    {name:'Invoice Coding Copilot', desc:'Auto-suggest GL codes and cost centers on inbound invoices.', strategic:'Friction: month-end close delays', cost:'Low ($0-15K)', outcome:'Best: coding accuracy up and close shortened by two days. Worst: miscodes surface at audit.', capabilities:'AP system integration, GL history for training.', risk:'Silent miscoding. Exceptions still routing to the same bottleneck.', dept:'Finance', when:'now', timeframe:'1-3 months'},
    {name:'Quality Inspection Vision', desc:'Camera-based defect detection on the final assembly line.', strategic:'Friction: escaped defects reaching customers', cost:'High ($60K+)', outcome:'Best: escaped defects near zero at line speed. Worst: false rejects slow the line and the cameras get switched off.', capabilities:'Camera and edge infrastructure, CV models, labeled defect imagery.', risk:'Lighting and product-variant sensitivity. Labeled-image volume needed.', dept:'Manufacturing', when:'now', timeframe:'12+ months'},
    {name:'Churn Early-Warning Model', desc:'Score accounts weekly on churn risk from usage and support signals.', strategic:'Friction: surprise cancellations', cost:'Medium ($15-60K)', outcome:'Best: a third of at-risk accounts saved by earlier outreach. Worst: scores nobody acts on.', capabilities:'Usage and support data pipeline, scoring model, CRM alerting.', risk:'Acting capacity in account teams. Signal quality on low-touch accounts.', dept:'Customer Ops', when:'now', timeframe:'3-6 months'},
    {name:'Logistics Route Optimizer', desc:'Re-plan delivery routes daily against traffic, load, and fuel data.', strategic:'Friction: rising cost per delivery', cost:'Medium ($15-60K)', outcome:'Best: cost per delivery down 12% with better on-time rates. Worst: drivers ignore the routes and revert.', capabilities:'Routing engine, telematics data, dispatch process change.', risk:'Driver adoption. Local knowledge the model lacks.', dept:'Supply Chain', when:'now', timeframe:'6-12 months'},
    {name:'Field Service Assistant', desc:'On-site troubleshooting answers from manuals and repair history.', strategic:'Friction: repeat service visits', cost:'Medium ($15-60K)', outcome:'Best: first-visit fix rate up ten points. Worst: wrong answers in the field damage equipment or trust.', capabilities:'Manual and repair-history corpus, retrieval pipeline, mobile delivery.', risk:'Wrong guidance on safety-critical steps. Coverage of legacy equipment.', dept:'Service', when:'now', timeframe:'3-6 months'},
    {name:'Compliance Q&A Bot', desc:'Policy and regulation answers for frontline staff, with citations.', strategic:'Friction: compliance bottleneck on routine questions', cost:'High ($60K+)', outcome:'Best: routine questions answered instantly with citations, legal freed for real issues. Worst: a confident wrong answer creates the exposure it was meant to prevent.', capabilities:'Curated policy corpus, retrieval with citations, legal review loop.', risk:'Hallucinated or outdated answers. Jurisdictional nuance.', dept:'Legal', when:'now', timeframe:'12+ months'},
    {name:'Sales Proposal Drafter', desc:'Assemble first-draft proposals from CRM context and past wins.', strategic:'Friction: slow proposal turnaround', cost:'Low ($0-15K)', outcome:'Best: proposal turnaround from days to hours with higher hit rates. Worst: templated proposals that read templated.', capabilities:'CRM context access, past-win corpus, LLM drafting.', risk:'Stale pricing in drafts. Confidential terms leaking between accounts.', dept:'Sales', when:'now', timeframe:'1-3 months'},
    {name:'Support Ticket Summarizer', desc:'Summarize long ticket threads and suggest next actions for agents.', strategic:'Friction: slow handoffs between support tiers', cost:'Low ($0-15K)', outcome:'Best: handoffs lose nothing and resolution times drop. Worst: summaries drop the one detail that mattered.', capabilities:'Ticket system integration, summarization models.', risk:'Omission of critical details. Agent overreliance on the summary.', dept:'Customer Ops', when:'now', timeframe:'1-3 months'}
  ];
  data.selected = [0,1,2,3,4,11,12,13,14,15,16,17];

  // ─── 1.3: per-dimension gates + triage scores (live schema) ───
  data.assessments = {
    0: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:8, value:9, costScore:9, difficulty:8 },
    1: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:7, value:8, costScore:7, difficulty:8 },
    2: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:6, value:7, costScore:5, difficulty:6 },
    3: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:5, value:6, costScore:5, difficulty:5 },
    4: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:8, value:8, costScore:8, difficulty:8 },
    11: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:6, value:7, costScore:6, difficulty:6 },
    12: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:7, value:6, costScore:8, difficulty:7 },
    13: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:4, value:8, costScore:4, difficulty:4 },
    14: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:7, value:8, costScore:6, difficulty:6 },
    15: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:4, value:6, costScore:5, difficulty:5 },
    16: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:7, risk:7, value:7, costScore:6, difficulty:6 },
    17: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:8, risk:3, value:9, costScore:4, difficulty:5 },
    18: { techCapable:true, resourcesAvailable:true, culturalFit:true, purposeAligned:true, affordable:true, priority:6, risk:7, value:6, costScore:8, difficulty:7 } /* 16 Sep 2026 (Paul's ruling): one unselected idea fully qualified and scored (34 / 50), so the Blue Sky portfolio shows a ranked idea awaiting selection */
  };

  // ─── 2.4: deepened projects (shared assessment block schema) ───
  data.projects = {
    0: { startupCost:'$170K', rolloutCost:'$50K', runningCost:'$60K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Cut median inquiry handle time 30% across two service queues within 60 days.',
      deliverables:'Triage classifier in production; routing rules; QA dashboard.',
      timeline:'Prototype 3 weeks, pilot 4 weeks, rollout 2 weeks.',
      resources:'1 ML engineer, 1 ops analyst, $220K.',
      risks:'Misrouting edge cases; agent trust in early weeks.',
      metrics:'Median handle time; misroute rate < 4%.',
      gap:{ skillsH:'Strong support ops team', skillsN:'Prompt engineering depth', resourcesH:'Queue data, labeled history', resourcesN:'Eval tooling', technologyH:'CRM APIs in place', technologyN:'LLM gateway' },
      swot:{ strengths:'Clean historical data; strong sponsor.', weaknesses:'No in-house eval harness.', opportunities:'Pattern reusable across three queues.', threats:'Vendor pricing shifts.' },
      partInt:'IT platform team for gateway.', partExt:'LLM vendor solutions engineer.',
      rescore:{ priority:9, risk:9, value:9, costScore:9, difficulty:8 }, rescoreDone:true },
    1: { startupCost:'$680K', rolloutCost:'$170K', runningCost:'$180K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Cut inventory write-offs 15% via foundation-model demand forecasting.',
      deliverables:'SKU-level forecast service; planner workbench integration.',
      timeline:'Data prep 4 weeks, model 4 weeks, pilot 4 weeks.',
      resources:'1 data scientist, 1 data engineer, $850K.',
      risks:'Data quality in long-tail SKUs; planner adoption.',
      metrics:'Write-off rate (4-week moving average).',
      gap:{ skillsH:'Forecasting team in place', skillsN:'Foundation-model fine-tuning', resourcesH:'3 years sales history', resourcesN:'Feature store', technologyH:'Warehouse on BigQuery', technologyN:'Model serving infra' },
      swot:{ strengths:'Rich history; clear baseline.', weaknesses:'Long time-to-value.', opportunities:'Extends to procurement planning.', threats:'Demand shocks invalidate training data.' },
      partInt:'Supply chain planning leads.', partExt:'Cloud provider ML specialists.',
      rescore:{ priority:8, risk:7, value:9, costScore:7, difficulty:9 }, rescoreDone:true },
    2: { startupCost:'$250K', rolloutCost:'$60K', runningCost:'$90K', viable:true, assessed:true,
      objectives:'Unify CRM, contract, and product data into a rep-facing account graph.',
      deliverables:'Knowledge graph; rep sidebar; refresh pipeline.',
      timeline:'Schema 3 weeks, ingest 5 weeks, UI 4 weeks.',
      resources:'1 data engineer, 0.5 PM, $310K.',
      risks:'Entity resolution quality; CRM data hygiene.',
      metrics:'Rep prep time per account; data coverage %.',
      gap:{ skillsH:'CRM admin expertise', skillsN:'Graph modeling', resourcesH:'Contract repository', resourcesN:'Entity-resolution tooling', technologyH:'CRM + CLM APIs', technologyN:'Graph database' },
      swot:{ strengths:'High strategic pull from sales.', weaknesses:'Ambiguous near-term ROI.', opportunities:'Foundation for assistant features.', threats:'Scope creep across data owners.' },
      partInt:'Sales ops; legal for contract access.', partExt:'Graph DB vendor.' },
    3: { viable:false, noGoReason:'Document Intelligence overlaps the dormant classification project; revisit after vendor consolidation in Q3.' },
    4: { startupCost:'$150K', rolloutCost:'$270K', runningCost:'$110K', advancedAt: sd.getTime()+86400000*35, viable:true, assessed:true,
      objectives:'Catch 80% of line failures 48 hours before production impact.',
      deliverables:'Anomaly models on sensor streams; alerting into maintenance workflow.',
      timeline:'Sensor audit 2 weeks, models 4 weeks, pilot 4 weeks.',
      resources:'1 ML engineer, plant liaison, $420K.',
      risks:'Sensor coverage gaps on older lines.',
      metrics:'Detection lead time; false-positive rate.',
      gap:{ skillsH:'Reliability engineering team', skillsN:'Streaming ML ops', resourcesH:'High-quality sensor data', resourcesN:'Edge compute budget', technologyH:'Historian database', technologyN:'Streaming pipeline' },
      swot:{ strengths:'Sensor data quality high.', weaknesses:'Edge deployment unproven.', opportunities:'Insurance premium reduction.', threats:'Plant network constraints.' },
      partInt:'Plant operations leads.', partExt:'Sensor platform vendor.',
      rescore:{ priority:8, risk:8, value:8, costScore:8, difficulty:9 }, rescoreDone:true },
    11: { startupCost:'$205K', rolloutCost:'$55K', runningCost:'$70K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Cut sourcing cycle time 25% on indirect spend within one quarter.',
      deliverables:'RFQ drafting assistant; bid comparison view; pricing history index.',
      timeline:'Pricing index 3 weeks, assistant 4 weeks, pilot 4 weeks.',
      resources:'1 engineer, procurement analyst, $260K.',
      risks:'Supplier data quality; buyer adoption.',
      metrics:'Sourcing cycle time; assisted-RFQ share.',
      gap:{ skillsH:'Category expertise', skillsN:'Retrieval tuning', resourcesH:'5 years PO history', resourcesN:'Clean supplier master', technologyH:'ERP APIs', technologyN:'Document pipeline' },
      swot:{ strengths:'Clear baseline metrics.', weaknesses:'Fragmented supplier data.', opportunities:'Extends to contract renewals.', threats:'Supplier pushback on comparisons.' },
      partInt:'Procurement category leads.', partExt:'ERP vendor services.',
      rescore:{ priority:8, risk:6, value:8, costScore:6, difficulty:7 }, rescoreDone:true },
    12: { startupCost:'$80K', rolloutCost:'$10K', runningCost:'$25K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Cut invoice coding effort 50% and shorten month-end close by one day.',
      deliverables:'GL-code suggestion service inside the AP workflow; exception queue.',
      timeline:'Data prep 2 weeks, model 3 weeks, pilot 3 weeks.',
      resources:'1 engineer part-time, AP lead, $90K.',
      risks:'Edge-case codings; auditor acceptance.',
      metrics:'Auto-coding acceptance rate; close duration.',
      gap:{ skillsH:'AP process knowledge', skillsN:'ML ops basics', resourcesH:'3 years coded invoices', resourcesN:'Eval set', technologyH:'AP workflow APIs', technologyN:'None significant' },
      swot:{ strengths:'Cheap, fast, measurable.', weaknesses:'Limited strategic upside.', opportunities:'Pattern reusable in expenses.', threats:'ERP upgrade mid-project.' },
      partInt:'Controller and AP team.', partExt:'None.',
      rescore:{ priority:6, risk:8, value:6, costScore:8, difficulty:7 }, rescoreDone:true },
    13: { startupCost:'$200K', rolloutCost:'$310K', runningCost:'$140K', advancedAt: sd.getTime()+86400000*50, viable:true, assessed:true,
      objectives:'Catch 90% of visual defects at final assembly before packaging.',
      deliverables:'Camera stations on two lines; defect models; operator review screen.',
      timeline:'Camera install 4 weeks, models 6 weeks, pilot 6 weeks.',
      resources:'1 ML engineer, quality engineer, $510K.',
      risks:'Lighting variance; defect-class long tail.',
      metrics:'Escaped-defect rate; false-reject rate.',
      gap:{ skillsH:'Quality engineering', skillsN:'Computer vision', resourcesH:'Defect photo archive', resourcesN:'Labeling budget', technologyH:'Line PLC integration', technologyN:'Camera infrastructure' },
      swot:{ strengths:'Strong cost-of-quality case.', weaknesses:'Long setup before signal.', opportunities:'Extends to incoming inspection.', threats:'Line-speed constraints.' },
      partInt:'Plant quality leads.', partExt:'Vision platform vendor.',
      rescore:{ priority:8, risk:4, value:9, costScore:4, difficulty:5 }, rescoreDone:true },
    14: { startupCost:'$180K', runningCost:'$55K', viable:true, assessed:true,
      objectives:'Flag 70% of churning accounts at least 30 days before cancellation.',
      deliverables:'Weekly churn-risk scores in the CRM; playbook triggers for CS team.',
      timeline:'Feature build 3 weeks, model 3 weeks, CS pilot 4 weeks.',
      resources:'1 data scientist, CS ops lead, $180K.',
      risks:'Label leakage; alert fatigue in CS.',
      metrics:'30-day detection rate; save rate on flagged accounts.',
      gap:{ skillsH:'CS process maturity', skillsN:'Feature engineering depth', resourcesH:'Usage telemetry', resourcesN:'Outcome labels pre-2024', technologyH:'CRM integration', technologyN:'Scoring pipeline' },
      swot:{ strengths:'Direct revenue protection.', weaknesses:'History shallow on outcomes.', opportunities:'Feeds expansion-signal models.', threats:'CS staffing for follow-up.' },
      partInt:'Customer success leadership.', partExt:'CRM vendor data services.',
      rescore:{ priority:7, risk:7, value:8, costScore:6, difficulty:7 }, rescoreDone:true },
    15: { startupCost:'$240K', runningCost:'$65K', viable:true, assessed:true,
      objectives:'Cut cost per delivery 8% across the regional fleet within two quarters.',
      deliverables:'Daily route plans into dispatch; driver-app turn list; savings dashboard.',
      timeline:'Data integration 4 weeks, optimizer 4 weeks, depot pilot 5 weeks.',
      resources:'1 engineer, dispatch lead, $240K.',
      risks:'Driver acceptance; address-data quality.',
      metrics:'Cost per delivery; planned-vs-actual route adherence.',
      gap:{ skillsH:'Dispatch expertise', skillsN:'Optimization modeling', resourcesH:'Telematics feed', resourcesN:'Clean address base', technologyH:'Dispatch system APIs', technologyN:'Routing engine' },
      swot:{ strengths:'Hard-dollar savings.', weaknesses:'Change management with drivers.', opportunities:'Extends to fleet sizing.', threats:'Fuel-price volatility masks signal.' },
      partInt:'Regional dispatch managers.', partExt:'Telematics provider.' },
    16: { objectives:'Pilot an on-site troubleshooting assistant that answers from installation manuals and service history, cutting repeat visits on the top five fault categories. Target: resolve 40% of field issues on the first visit with guided troubleshooting.',
      deliverables:'Retrieval index over manuals and service tickets; assistant in the technician mobile app; a 12-technician ride-along pilot; an accuracy evaluation set with sign-off thresholds.',
      timeline:'Index and prototype months 1\u20132; technician pilot Months 3\u20134; evaluation and rollout decision Month 5.',
      resources:'Service ops lead at 25%, two engineers, retrieval-stack vendor; roughly $140K development.',
      risks:'Manual coverage gaps on legacy product lines; wrong torque or spec answers in the field; technician adoption.',
      metrics:'First-visit fix rate +8 points; average handle time \u221215%; assistant answer acceptance above 70% in the pilot.',
      gap:{ skillsH:'Strong service-ops knowledge; two engineers with API experience.', skillsN:'Retrieval evaluation and prompt-safety experience.',
            resourcesH:'Manuals digitized for current lines; service tickets in the CRM.', resourcesN:'Legacy-line manuals need scanning; field devices for the pilot cohort.',
            technologyH:'CRM with full ticket history; shared document store.', technologyN:'Retrieval stack, mobile front end, evaluation harness.' },
      swot:{ strengths:'Rich ticket history; motivated service team; the cost of repeat visits is measured and visible.',
             weaknesses:'Legacy documentation is patchy; field connectivity varies by site.',
             opportunities:'Extends naturally to dealer-network support; feeds the warranty analytics roadmap.',
             threats:'Wrong answers in the field damage technician trust quickly; vendor lock-in on the retrieval stack.' },
      partInt:'IT for CRM and document-store integration; Service Ops for the pilot cohort and playbooks.',
      partExt:'Retrieval-stack vendor; documentation scanning service for legacy manuals.' }
  };

  // ─── Phase 2: Organize ───
  var _ld1=uid(),_ld2=uid(),_sr1=uid(),_sr2=uid();
  data.ownership = {
    ownerName: 'Shalini Mehta', ownerRole: 'VP Innovation',
    authority: 'Full budget authority for AI portfolio under $2M per initiative.',
    leads: [ { id:_ld1, name:'Vincent Lau', dept:'Engineering' }, { id:_ld2, name:'Harriet Rivers', dept:'Product' } ],
    seniors: [ { id:_sr1, name:'Imogen Whitfield', role:'CEO' }, { id:_sr2, name:'Daniel Reyes', role:'CFO' } ]
  };
  data.incentives = {
    current: 'Annual targets, individual MBOs, no innovation metric.',
    changes: 'Quarterly OKRs with explicit experimentation budget; team-based learning targets.',
    metrics: ['Active experiments','Kill speed','Support for experimentation','Time-to-value']
  };
  data.rhythm = { day:'Tue', time:'9:00 AM', attendees:['Shalini Mehta','Vincent Lau','Harriet Rivers'], agendaList:['Development gate reviews','Blocker triage','Experiment outcomes'] };
  data.raci = {};
  (function(){var _pp=['owner',_ld1,_ld2,_sr1,_sr2,'finance'];
  [['A','R','C','I','I','C'],   // Approve experiments – Shalini owns the call, Vincent runs the assessment
   ['A','R','C','I','C','C'],   // Advance projects
   ['R','C','I','I','A','C'],   // Allocate budget – the CFO owns the outcome
   ['A','R','C','I','C','I'],   // Kill projects
   ['A','C','R','I','I','I'],   // Pipeline reporting – Harriet assembles it
   ['A','R','R','I','I','C'],   // Weekly session
   ['A','C','C','C','R','R']    // Quarterly review – finance runs the numbers
  ].forEach(function(row,ai){row.forEach(function(v,ci){if(v)data.raci[ai+':'+_pp[ci]]=v})})})();

  // ─── Phase 3: Prepare (post-rework bands) ───
  data.portfolio = {
    0: { horizon:'quick',  risk:'low',    reward:'medium', notes:'Fast proof point; funds learning for the bigger bets.' },
    1: { horizon:'long',   risk:'high',   reward:'high',   notes:'Anchor bet; longest time-to-value in the portfolio.' },
    2: { horizon:'medium', risk:'medium', reward:'medium', notes:'Platform play; value compounds with later projects.' },
    4: { horizon:'quick',  risk:'medium', reward:'high',   notes:'Operational risk reduction with measurable downtime impact.' },
    11: { horizon:'medium', risk:'medium', reward:'high',  notes:'Solid sourcing economics; balances the vision bet.' },
    12: { horizon:'quick',  risk:'low',    reward:'medium', notes:'Cheap quick win; keeps near-term value flowing.' },
    13: { horizon:'long',   risk:'high',   reward:'high',  notes:'Second anchor bet; quality economics justify the horizon.' }
  };
  var _psd=new Date(sd);_psd.setDate(1);var _psISO=_psd.toISOString().split('T')[0];
  data.capital = {
    aiBudget: '$2.4M',
    envYears: '3',
    budgetY2: '$2.6M',
    budgetY3: '$2.8M',
    periodStart: _psISO,
    susCap: '40',
    reserveY2: '$700K',
    reserveY3: '$700K',
    reallocation: '',
    gapPlan: '',
    fundLines: [
      {id:'fl1', d:'Reallocation \u2013 dormant document-classification project', a:'$250K', y:'1', proj:'', st:'planned'},
      {id:'fl2', d:'Reallocation \u2013 Q1 marketing reserve', a:'$150K', y:'1', proj:'', st:'planned'},
      {id:'fl3', d:'Additional budget request at the month-2 gate review \u2013 contingent on triage pilot results', a:'$300K', y:'1', proj:'AI-Assisted Customer Triage', st:'planned'}
    ]
  };
  data.capAlloc = {}; /* gateRows retired (July 5): gate criteria live on the
    program phases as exit criteria; release amounts had no engine effect. */

  // ─── 3.3: experiment briefs (live schema) ───
  data.budgetPlans = {
    0: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp0a',name:'Triage model & routing rules',desc:'Intent model and routing rules on ticket history',from:'1',to:'2',cost:'$110K',powner:'Vincent Lau',pmetric:'Shadow-mode routing accuracy',pexit:'Pilot routing accuracy \u2265 90% in shadow mode'},
               {id:'bp0b',name:'Agent-assist integration',desc:'Desk integration and agent-assist surfaces',from:'2',to:'3',cost:'$60K',powner:'Vincent Lau',pmetric:'Misroute rate on live queues',pexit:'Two queues live with misroute rate < 4%'} ],
         roll:[ {id:'bp0c',name:'Support-team rollout',desc:'Rollout across support teams',from:'3',to:'8',cost:'$50K'} ],
         sus:[ {id:'bp0d',name:'Ongoing operation',from:'9',to:'ongoing',items:[ {id:'bpi0a',name:'Model hosting & monitoring',cost:'$35K'}, {id:'bpi0b',name:'Content & routing upkeep',cost:'$25K'} ]} ] },
    11:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp11a',name:'Observation & design',desc:'Shadow two buyers through complete sourcing cycles on indirect categories. Capture where time is lost between RFQ request and award, document the pricing references buyers actually consult, and specify the copilot workflows against those failure points.',from:'1',to:'1',cost:'$15K',powner:'Harriet Rivers',pmetric:'A documented map of the current sourcing cycle with measured stage times for at least ten live RFQs, and a signed-off specification for the three copilot workflows.',pexit:'The procurement lead signs off the specification and the baseline cycle-time measurements that later phases will be judged against.'},
               {id:'bp11b',name:'Paper prototype',desc:'Mock the RFQ drafting flow and the bid comparison view on paper. Walk four buyers through real historical RFQs using the mocks, with no code built, and revise until the workflow matches how buyers actually evaluate bids.',from:'1',to:'2',cost:'$20K',powner:'Harriet Rivers',pmetric:'Four buyers complete a full mock sourcing cycle. Task-completion notes and a revision log are captured for every session.',pexit:'Buyers can complete the mock cycle without facilitator help, and no open workflow objections remain from the prototype group.'},
               {id:'bp11c',name:'Experiment',desc:'Build the working copilot on the ingested catalog and policy data. Run it in shadow mode against live RFQs, with the copilot drafting in parallel while buyers work normally, and compare its drafts and price references against what the buyers produced.',from:'2',to:'3',cost:'$95K',powner:'Arvind Nair',pmetric:'Draft acceptance rate and pricing-index coverage across at least 30 shadow RFQs. Target coverage of 80% of indirect spend, with drafts rated usable in two thirds of cases.',pexit:'Shadow results meet the coverage and usability targets, and the buyer panel agrees the drafts are safe to put in front of suppliers.'},
               {id:'bp11d',name:'Pilot',desc:'Run the copilot live in two indirect categories with the pilot buyer group. Measure sourcing cycle time against the phase-one baseline and track every case where a buyer overrides or corrects the copilot output.',from:'3',to:'4',cost:'$55K',powner:'Harriet Rivers',pmetric:'Cycle time on pilot categories versus baseline, override rate, and buyer satisfaction from structured debriefs. Target a 15% cycle-time reduction with overrides falling week on week.',pexit:'Assisted RFQs live in two categories with the cycle-time target met, and no unresolved data or policy incidents in the pilot log.'},
               {id:'bp11e',name:'Rollout preparation',desc:'Harden the service for the whole procurement team. Finish access controls and audit logging, write the training materials from real pilot cases, and agree the support handover with the platform team.',from:'4',to:'4',cost:'$20K',powner:'Tom\u00e1s Vega',pmetric:'A training pack tested with two buyers from outside the pilot, audit logging verified on every copilot action, and a signed support runbook.',pexit:'The operations review accepts the runbook and the rollout plan, clearing the project to enter the rollout step.'} ],
         roll:[ {id:'bp11c',name:'Procurement-team rollout',desc:'Rollout to the procurement team, including first-year running',from:'5',to:'18',cost:'$55K'} ],
         sus:[ {id:'bp11d',name:'Ongoing operation',from:'19',to:'ongoing',items:[ {id:'bpi11a',name:'Hosting & vendor-data upkeep',cost:'$40K'}, {id:'bpi11b',name:'Policy maintenance',cost:'$30K'} ]} ] },
    12:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp12a',name:'Coding model build',desc:'Coding model trained on historical invoices',from:'1',to:'2',cost:'$80K',powner:'Vincent Lau',pmetric:'Suggestion acceptance rate in shadow mode',pexit:'Suggestion acceptance \u2265 85% in shadow mode'} ],
         roll:[ {id:'bp12b',name:'Finance-team rollout',desc:'Finance-team rollout, including first-year running',from:'3',to:'15',cost:'$10K'} ],
         sus:[ {id:'bp12c',name:'Ongoing operation',from:'16',to:'ongoing',items:[ {id:'bpi12a',name:'Hosting & rules upkeep',cost:'$25K'} ]} ] },
    2: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'skg1',name:'Schema & graph model',from:'1',to:'1',cost:'$60K'},
               {id:'skg2',name:'Ingest & entity resolution',from:'2',to:'3',cost:'$120K'},
               {id:'skg3',name:'Rep sidebar UI',from:'3',to:'4',cost:'$70K'} ],
         roll:[ {id:'skg4',name:'Rollout to the sales team',from:'5',to:'7',cost:'$60K'} ],
         sus:[ {id:'skg5',name:'Run & refresh',from:'8',to:'ongoing',items:[ {id:'skg5a',name:'Graph DB & hosting',cost:'$50K'}, {id:'skg5b',name:'Refresh pipeline & data stewardship',cost:'$40K'} ]} ] },
    14:{ horizon:'3', contingency:'15', notes:{},
         dev:[ {id:'chn1',name:'Features & outcome labels',from:'1',to:'2',cost:'$70K'},
               {id:'chn2',name:'Model build & validation',from:'2',to:'3',cost:'$60K'},
               {id:'chn3',name:'CS pilot',from:'3',to:'4',cost:'$50K'} ],
         roll:[],
         sus:[ {id:'chn4',name:'Run & retrain',from:'5',to:'ongoing',items:[ {id:'chn4a',name:'Scoring pipeline & monitoring',cost:'$35K'}, {id:'chn4b',name:'Model retraining',cost:'$20K'} ]} ] },
    15:{ horizon:'3', contingency:'', notes:{},
         dev:[ {id:'lro1',name:'Data integration',from:'1',to:'2',cost:'$80K'},
               {id:'lro2',name:'Optimizer build',from:'2',to:'3',cost:'$90K'},
               {id:'lro3',name:'Depot pilot',from:'4',to:'5',cost:'$70K'} ],
         roll:[],
         sus:[ {id:'lro4',name:'Run & tune',from:'6',to:'ongoing',items:[ {id:'lro4a',name:'Solver hosting & tuning',cost:'$40K'}, {id:'lro4b',name:'Address-data upkeep',cost:'$25K'} ]} ] },
    16:{ horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'fs1',name:'Retrieval index & prototype',from:'1',to:'2',cost:'$60K'},
               {id:'fs2',name:'Technician pilot build',from:'3',to:'4',cost:'$50K'},
               {id:'fs3',name:'Evaluation & hardening',from:'5',to:'5',cost:'$30K'} ],
         roll:[ {id:'fs4',name:'Field rollout \u2013 wave 1',from:'6',to:'8',cost:'$45K'},
                {id:'fs5',name:'Dealer network extension',from:'9',to:'11',cost:'$30K'} ],
         sus:[ {id:'fs6',name:'Run & refresh',from:'12',to:'ongoing',items:[ {id:'fs6a',name:'Hosting & retrieval stack',cost:'$18K'}, {id:'fs6b',name:'Manual refresh & evaluation',cost:'$12K'} ]} ] },
    1: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp1a',name:'Data audit & feasibility',desc:'Historical sales data quality, sources, and feasibility review',from:'1',to:'3',cost:'$120K',powner:'Harriet Rivers',pmetric:'Source-data coverage of the SKU range',pexit:'Data audit signed off \u2013 sources complete and usable'},
               {id:'bp1b',name:'Model build & validation',desc:'Forecast model development, backtesting, and accuracy validation',from:'3',to:'12',cost:'$460K',powner:'Harriet Rivers',pmetric:'Forecast lift on the 200 highest-variance SKUs',pexit:'Holdout evaluation shows forecast lift over baseline'},
               {id:'bp1c',name:'Extended backtesting',desc:'Second-season validation across the full product range',from:'13',to:'14',cost:'$100K',powner:'Harriet Rivers',pmetric:'Accuracy across the full product range',pexit:'Second-season backtest \u2265 baseline accuracy portfolio-wide'} ],
         roll:[ {id:'bp1d',name:'Planning integration & training',desc:'ERP integration and planner training',from:'15',to:'18',cost:'$170K'} ],
         sus:[ {id:'bp1e',name:'Ongoing operation',from:'19',to:'ongoing',items:[
               {id:'bpi1a',name:'Model & API usage',cost:'$90K'},{id:'bpi1b',name:'Data platform & pipelines',cost:'$60K'},{id:'bpi1c',name:'Forecast ops support',cost:'$30K'}]} ] },
    4: { horizon:'3', contingency:'10', notes:{},
         dev:[ {id:'bp4a',name:'Site survey & sensor pilot',desc:'Line 1 sensor pilot and data capture',from:'1',to:'2',cost:'$40K'},
               {id:'bp4b',name:'Model build & validation',desc:'Failure-prediction models on pilot data',from:'2',to:'5',cost:'$110K'} ],
         roll:[ {id:'bp4c',name:'Line 1 instrumentation & launch',desc:'Sensors, gateways, and alerting on line 1',from:'5',to:'10',cost:'$180K'},
                {id:'bp4d',name:'Remaining lines rollout',desc:'Sensor coverage across all remaining production lines',from:'11',to:'14',cost:'$90K'} ],
         sus:[ {id:'bp4e',name:'Ongoing operation',from:'15',to:'ongoing',items:[
               {id:'bpi4a',name:'Sensor & gateway upkeep',cost:'$45K'},{id:'bpi4b',name:'Platform & alerting',cost:'$40K'},{id:'bpi4c',name:'Model tuning',cost:'$25K'}]} ] },
    13:{ horizon:'3', contingency:'15', notes:{},
         dev:[ {id:'bp13a',name:'Camera trials & data collection',desc:'Rig trials and a defect image library on line A',from:'1',to:'3',cost:'$50K',powner:'Harriet Rivers',pmetric:'Labeled defect-set completeness',pexit:'Camera install and labeled defect set complete'},
               {id:'bp13b',name:'Vision model development',desc:'Defect-detection model training and validation',from:'3',to:'9',cost:'$150K',powner:'Harriet Rivers',pmetric:'Defect detection rate on the pilot line',pexit:'Pilot detection \u2265 90% on line 2'} ],
         roll:[ {id:'bp13c',name:'Line A cameras & rigs',desc:'Production install and launch on line A',from:'10',to:'12',cost:'$120K'},
                {id:'bp13d',name:'Full line coverage',desc:'Cameras and rigs across the remaining assembly lines',from:'13',to:'16',cost:'$190K'} ],
         sus:[ {id:'bp13e',name:'Ongoing operation',from:'17',to:'ongoing',items:[
               {id:'bpi13a',name:'Camera & rig maintenance',cost:'$50K'},{id:'bpi13b',name:'Vision platform licenses',cost:'$55K'},{id:'bpi13c',name:'Model retraining',cost:'$35K'}]} ] }
  };
  data.experiments = {
    0: { budget:'$170K' },
    1: { budget:'$680K' },
    4: { budget:'$150K' },
    11: { budget:'$205K' },
    12: { budget:'$80K' },
    13: { budget:'$200K' }
  };
  data.expSelected = [0,1,4,11,12,13];

  // ─── Phase 4: Ignite — two launched, one running ───
  data.tracking = {
    0: { status:'complete', results:'Week 5: median handle time down 34% in both pilot queues; misroute rate 2.8%.', infraLearnings:'Budget release at Gate 1 took two days \u2013 gate process working.', breakWork:'Working: ownership model, weekly rhythm. Breaking: QA review queue at volume.' },
    1: { status:'complete', results:'Holdout forecast beat baseline by 19%; planner pilot adopted in two regions.', infraLearnings:'Feature-store gap cost three weeks; now budgeted as shared infrastructure.', breakWork:'Working: data partnership with supply chain. Breaking: cross-region change management.' },
    4: { status:'complete', results:'Week 7: 82% of failures detected at 48h lead; false-positive rate 6%. Fleet rollout approved.', infraLearnings:'Edge compute procurement slower than cloud \u2013 flag for governance.', breakWork:'Working: plant liaison model. Breaking: sensor coverage on line 4.' },
    11: { status:'running', results:'Week 4: pricing index covering 84% of indirect spend; assisted RFQs in first category.', infraLearnings:'Supplier master cleanup was the hidden cost \u2013 two weeks of analyst time.', breakWork:'Working: category-lead partnership. Breaking: legal review loop on RFQ templates.' },
    12: { status:'running', results:'Week 3: shadow-mode acceptance at 81% and climbing as the eval set grows.', infraLearnings:'Smallest experiment in the portfolio \u2013 proof that the pipeline handles low-cost bets.', breakWork:'Working: AP team engagement. Breaking: nothing significant.' },
    13: { status:'running', results:'Week 5: cameras live on the pilot line; labeling at 60% with two defect classes ahead of plan.', infraLearnings:'Camera procurement hit the same governance lag as edge compute \u2013 pattern for the review.', breakWork:'Working: plant quality partnership. Breaking: labeling vendor throughput.' }
  };
  data.launched = [0,1,4];
  data.opsData = {
    0: { health:'green', launchDate:new Date(sd.getTime()+86400000*52).toISOString().split('T')[0], performance:'Handle time steady at 65% of baseline; misroute rate 2.5% and falling.', notes:'Week 2 operational: added third queue; agent satisfaction up.' },
    1: { health:'amber', launchDate:new Date(sd.getTime()+86400000*63).toISOString().split('T')[0], performance:'Write-offs tracking \u221212% vs target \u221215%; two regions live.', notes:'Region 3 rollout paused pending data-quality fix on legacy SKUs.' },
    4: { health:'green', launchDate:new Date(sd.getTime()+86400000*66).toISOString().split('T')[0], performance:'Fleet rollout underway; detection holding at 80%+ across three lines.', notes:'Maintenance scheduling now consuming alerts directly; insurance review booked.' }
  };

  // ─── 4.2 / 4.3 ───
  data.governance = {
    meeting:'Monthly executive review', threshold:'$500k',
    metrics:'Learning velocity, capital efficiency, customer impact',
    format:'30-min gate review per active project',
    gateProcess:'Buy / Hold / Sell decision with sponsor sign-off',
    outsideAudit:'Quarterly \u2013 pipeline owner sweeps departmental spend and vendor contracts for AI work outside the pipeline', firstReview:'End of week 12',
    reviewAttendees:'CEO, CFO, CIO, Phase Owner, Innovation Council',
    reviewAgenda:'Portfolio health \u00b7 Capital \u00b7 Lessons \u00b7 Next bets'
  };
  data.stress = {
    decisions:'Mostly working; budget reallocation still a multi-week loop.', decisionsScore:4,
    ownership:'Central owner working well; one embedded lead overwhelmed.', ownershipScore:3,
    incentives:'Early signs in sales; manufacturing still on old metrics.', incentivesScore:3,
    culture:'Weekly rhythm helping; some "not my job" still showing up.', cultureScore:3,
    tuningList:['Add backup phase owner','Shorten budget loop to 1 week','Manufacturing OKR refresh','','']
  };

  // ─── Review (4.4) left open — the demo ends mid-first-review ───
  data.review = { /* 17 Sep 2026 (Paul's ruling): the first quarterly review, seeded \u2014 a decision with its reason on each of the nine live initiatives, and the five learnings */
    items:{
      0:{decision:'buy',rationale:'Handle time is down a third with agent adoption at 94%. Scale to the remaining queues and the outsourced desk.'},
      1:{decision:'hold',rationale:'The write-off rate is moving, but the forecast still overshoots on new products. Hold the footprint until the retrain lands and the amber clears.'},
      4:{decision:'buy',rationale:'Two of three lines covered and downtime avoided is ahead of plan. Extend to the third line and the finishing cells.'},
      11:{decision:'hold',rationale:'The paper prototype landed well, but the live experiment has not started. Hold at the current budget until phase 3 reports.'},
      12:{decision:'hold',rationale:'Acceptance at 88% against a target of 85% after four weeks. Hold at the current plan and complete the rollout phase before scaling.'},
      13:{decision:'hold',rationale:'Detection is ahead of target on the pilot line. Hold until the phase-2 gate next month; the case for scaling is already made.'},
      2:{decision:'hold',rationale:'The Go verdict stands, but the data-stewardship gap is not closed. Hold until the CRM owner is named.'},
      14:{decision:'buy',rationale:'The highest score in exploration and a quick win. Advance in the next batch.'},
      15:{decision:'sell',rationale:'The lowest score in the set, and the carrier data cannot be obtained this year. Release the slot.'}
    },
    newOpportunities:'1. AI-assisted inventory forecasting, raised by Operations after the demand model\u2019s write-off results.\n2. Contract-clause extraction for Legal, a natural extension of the document-classification work.',
    balance:'Heavy on quick wins in operation and medium-term bets in development; no long-term bet is live. The next batch should carry one.',
    worked:'The weekly rhythm survived the quarter. Gate reviews were taken on the day in five cases out of six.',
    didnt:'Budget reallocation between projects took three weeks each time. The Finance column on the RACI did not translate into a fast path.',
    nextCycle:'A mid-quarter reallocation window. A deputy for gate reviews when the owner travels. The Legal opportunity scoped before the next review.'
  };
  if(!data.tracking[15])data.tracking[15]={};data.tracking[15].status='killed'; /* the Sell kills it, as the step does */
  data.reviewCycles = []; // seed order-independence: the Y2 seed writes cycle history; base must clear it (July 8)
  data.notifications = []; data.remind7 = {}; data.archivedItems = {}; data.chatMsgs = []; // "overwrites any existing entries" made literally true (Paul's ruling, July 8): runtime keys the builder never assigned used to survive a re-seed

  // ─── Completion state ───
  data.completedSections = { '1.1':true,'1.2':true,'1.3':true,'1.4':true,'1.5':true };
  data.completedSteps = { '1.1':true,'1.2':true,'1.3':true,'2.1':true,'2.2':true,'2.3':true,'2.4':true,'3.1':true,'3.2':true,'3.3':true,'3.4':true,'4.1':true,'4.2':true,'4.3':true,'4.4':true } /* 17 Sep 2026 (Paul's ruling): Phase 4 complete in the seed */;
  // ─── Module Management seed: completion history, roster, assignments, deadlines (July 5) ───
  var _dISO=function(dd){var t=new Date(sd);t.setDate(t.getDate()+dd);return t.toISOString().split('T')[0]};
  data.stepDoneAt = { '1.1':_dISO(8),'1.2':_dISO(13),'1.3':_dISO(18),'2.1':_dISO(26),'2.2':_dISO(31),'2.3':_dISO(34),'2.4':_dISO(39),'3.1':_dISO(47),'3.2':_dISO(53),'3.3':_dISO(59),'3.4':_dISO(64),'4.1':_dISO(68) };
  data.stepDue = { '4.2':_dISO(76), '4.3':_dISO(80), '4.4':_dISO(88) };
  var _seedRoster=[
    {id:'su1',name:'Vincent Lau',username:'vlau',role:'Head of Customer Operations',initials:'VL',color:'#1B6B5A',scope:'All',passcode:'1234'},
    {id:'su2',name:'Harriet Rivers',username:'hrivers',role:'Operational Excellence Lead',initials:'HR',color:'#2D5A8E',scope:'All',passcode:'1234'},
    {id:'su3',name:'Arvind Nair',username:'anair',role:'Chief Technology Officer',initials:'AN',color:'#8B5E3C',scope:'All',passcode:'1234'},
    {id:'su4',name:'Tom\u00e1s Vega',username:'tvega',role:'Finance Director',initials:'TV',color:'#9B2D3F',scope:'All',passcode:'1234'},
    {id:'su5',name:'Ray Caruso',username:'rcaruso',role:'Plant Manager',initials:'RC',color:'#6B4C8A',scope:'All',passcode:'1234'},
    {id:'su6',name:'Anders Lindqvist',username:'alindqvist',role:'Head of Sales',initials:'AL',color:'#C25B73',scope:'All',passcode:'1234'},
    {id:'su7',name:'Glen Hodges',username:'ghodges',role:'Data & Analytics Lead',initials:'GH',color:'#4FB39A',scope:'All',passcode:'1234'},
    {id:'su8',name:'Duncan Fairley',username:'dfairley',role:'HR Director',initials:'DF',color:'#D4A017',scope:'All',passcode:'1234'}
  ];
  data.chatMsgs=[
    {who:'VL',name:'Vincent Lau',ts:'8:52 AM',text:'Morning all. Phase 4 is underway and the tracker is current. Governance setup is the next milestone, due on the 11th.'},
    {who:'AN',name:'Arvind Nair',ts:'9:03 AM',text:'Shadow-mode numbers for the sourcing copilot land tomorrow. Coverage of indirect spend looks strong and draft acceptance is tracking just under the two-thirds target.'},
    {who:'TV',name:'Tom\u00e1s Vega',ts:'9:10 AM',text:'Reminder that the $300K request for AI-Assisted Customer Triage is still a planned funding line. I need the gate evidence before it goes to the capital group.'},
    {who:'GH',name:'Glen Hodges',ts:'9:18 AM',text:'Draft decision-rights matrix for the governance step is with Arvind for review. I will bring the data-access sections to the working session.'},
    {who:'RC',name:'Ray Caruso',ts:'9:26 AM',text:'Floor walk for the stress-test is booked for next week. I will have the line supervisors join the org design session.'},
    {who:'DF',name:'Duncan Fairley',ts:'9:34 AM',text:'Portfolio review is on the calendar for day 88. Send me kill and continue recommendations a week ahead so the panel has time to read them.'}
  ];
  /* seed reset rule (July 9, extends the July 8 literal-overwrite ruling): F3 returns the roster to
     the org's admin account(s) plus a fresh su1-su8. Renames, extra members, and email edits from a
     testing session do not survive a reseed. Admin accounts survive because the signed-in user is one. */
  var _keepAdmins=(Array.isArray(data.roster)?data.roster:[]).filter(function(x){return x&&x.admin===true});
  data.roster=_keepAdmins.concat(JSON.parse(JSON.stringify(_seedRoster)));
  data.assigns = { '1.1':['su3','su8'],'1.2':['su1','su7'],'1.3':['su1'],'2.1':['su8'],'2.2':['su8','su4'],'2.3':['su2'],'2.4':['su3'],'3.1':['su1','su2'],'3.2':['su4'],'3.3':['su4','su3'],'3.4':['su1','su2'],'4.1':['su2'],'4.2':['su3','su7'],'4.3':['su8'],'4.4':['su4','su1'] };
  applyTeamRoster();

  // ─── Notes (live schema: id / createdAt / step) ───
  data.notes = [
    { id:'sn1', createdAt:Date.now()-172800000, step:'4.1', text:'Arvind to circulate the shadow-mode results before the experiment gate on the sourcing copilot.' },
    { id:'sn2', createdAt:Date.now()-86400000, step:'3.3', text:'Tom\u00e1s needs month-two gate evidence before the $300K triage funding line goes to the capital group.' },
    { id:'sn3', createdAt:Date.now()-3600000, step:'4.4', text:'Book the portfolio review for the week of day 88 and circulate the agenda in advance.' }
  ];

  // ─── Assignments seeded above (su1–su8 live in the roster); keep only real roster ids, never ghosts ───
  var rIds=(data.roster||[]).map(function(u){return u.id});
  Object.keys(data.assigns||{}).forEach(function(sk){ data.assigns[sk]=(data.assigns[sk]||[]).filter(function(x){return rIds.indexOf(x)>=0}); });
}
```

**Check:** Open the More menu and choose Seed sample data; confirm. In the sidebar, Phase 4's steps 4.2, 4.3, and 4.4 show as done. Open Phase 4, step 4.4 (Quarterly Portfolio Review): every one of the nine initiatives carries a Buy, Hold, or Sell with a written reason, and the Logistics Route Optimizer is struck through as killed. Under Portfolio Learnings the five boxes are filled in.

---

### Step 64 — Add the function that draws a step's page: its body, and the Save as PDF control above it on the Phase 5 pages.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
if(!_bootDone){
```

**Code:**

```js

function renderStepContent(id){var h=renderStepContentBody(id);return isPhase5Step(id)?printBar()+h:h} /* 12 Sep 2026 (Paul's ruling): the print option on every Phase 5 page */
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 65 — Add the function that draws the Save as PDF control at the top of a Phase 5 page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderStepContent` ends, after its closing `}`.

**Code:**

```js

/* PRINT OPTION on every Phase 5 page and every dashboard (Paul's ruling, 12 Sep 2026; family): a Save as PDF control at the top of each such page prints it as a document — cover, body without controls, the copyright footer */
function printBar(){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px">'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 66 — Add the function that says whether a step identifier belongs to Phase 5.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printBar` ends, after its closing `}`.

**Code:**

```js
function isPhase5Step(id){var p=null;PH.forEach(function(x){if(x.id===5)p=x});return !!(p&&p.steps.some(function(s){return s.id===id}))}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 67 — Add the function that gives a step's name from its identifier.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `isPhase5Step` ends, after its closing `}`.

**Code:**

```js
function stepNameOf(id){var nm=id;PH.forEach(function(p){p.steps.forEach(function(s){if(s.id===id)nm=s.name})});return nm}
```

**Nothing to check yet.** This change becomes visible at Step 68.

---

### Step 68 — Add the function that removes the Save as PDF control and every button from a page's markup before it prints.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `stepNameOf` ends, after its closing `}`.

**Code:**

```js
function _pbStrip(body){return String(body).replace(/<div class="print-bar"[\s\S]*?<\/div>/,'').replace(/<button[\s\S]*?<\/button>/g,'')}
```

**Check:** Open Phase 4's Governance Framework output and click ▾ Save as PDF. A new window opens whose first page shows, from the top: the line NEXTCHAPTER · 90-DAY AI INNOVATION PIPELINE; the title Governance Framework; a subtitle; a horizontal rule; the organization's name; today's date as words. In the print dialog's preview every page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as "2 / 2" at the bottom right.

---

### Step 69 — Add the empty constant that will hold the record descriptions for ideas and projects.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pbStrip` ends, after its closing `}`.

**Code:**

```js
/* ══ THE REPORTING ENGINE AND THE PAPER HELPERS — byte-exact from Executive Readiness (the family form; Governance's engine as ER carries it), ported to the Innovation Pipeline 16 Sep 2026 on Paul's ruling ══ */
/* ═══ REPORTING ENGINE (family code, copied from the Governance build 14 Sep 2026; Spec Rev A). Layered records: each record type declares a layer map; every layer has a summary and a full rendering; a layer is live when it has content and no later superseding layer does; renderings are additive; a register prints identity plus the summary of every live layer up to its own phase; each record ends with a missing-layers line. Output side only. ═══ */
var LAYER_MAPS={};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 70 — Add the function that makes a printed value begin with a capital letter.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LAYER_MAPS` ends.

**Code:**

```js
function lyCap(t){t=String(t);if(!t||/^(https?:\/\/|www\.)/.test(t)||t.indexOf('@')>=0||/^[a-z]+-[a-z0-9-]*\d/.test(t))return t;return t.charAt(0).toUpperCase()+t.slice(1)} /* 13 Sep 2026 (Paul's ruling): a printed value begins with a capital, unless it is a URL, an email, or an id */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 71 — Add the function that prints a stored date as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyCap` ends, after its closing `}`.

**Code:**

```js
function lyDate(v){var d=(typeof v==='number')?new Date(v):new Date(String(v));return isNaN(d)?String(v||''):d.toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 72 — Add the function that prints a stored value as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyDate` ends, after its closing `}`.

**Code:**

```js
function lyText(v){ /* any value to plain text */
  if(v==null)return '';if(Array.isArray(v))return v.map(lyText).filter(Boolean).join('; ');
  if(typeof v==='object')return Object.keys(v).map(function(k){return v[k]}).map(lyText).filter(Boolean).join('; ');
  return String(v).trim()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 73 — Add the function that decides which parts of a record have content to print.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyText` ends, after its closing `}`.

**Code:**

```js
function lyLive(map,rec,upto){ /* the live layers, in stage order, up to and including layer index upto (all when upto is null) */
  var present=map.layers.map(function(l){try{return !!l.present(rec)}catch(e){return false}});
  return map.layers.filter(function(l,i){if(upto!=null&&i>upto)return false;if(!present[i])return false;
    return !map.layers.some(function(m,j){return m.supersedes===l.id&&present[j]})})}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 74 — Add the function that writes the line naming what a record is missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyLive` ends, after its closing `}`.

**Code:**

```js
function lyMissing(map,rec,upto){ /* one sentence per required-but-absent or incomplete layer */
  var out=[];map.layers.forEach(function(l,i){if(upto!=null&&i>upto)return;if(!l.required)return;var req=false;try{req=!!l.required(rec)}catch(e){}
    if(!req)return;var pres=false;try{pres=!!l.present(rec)}catch(e){}
    if(!pres){out.push(l.missing||('No '+l.title.toLowerCase()+' recorded.'));return}
    if(l.complete){var c=null;try{c=l.complete(rec)}catch(e){}if(typeof c==='string'&&c)out.push(c)}});return out}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 75 — Add the function that prints one labelled row of a record.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyMissing` ends, after its closing `}`.

**Code:**

```js
function lyRow(label,value,indent){var t=lyCap(lyText(value));return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?esc(t):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 76 — Add the function that prints a list of items as labelled rows.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRow` ends, after its closing `}`.

**Code:**

```js
function lyList(label,items,fmt){ /* a list field: one row per item, the label on the first; a formatter may return lines separated by <br>, which print as lines */
  if(!items||!items.length)return lyRow(label,'');var h='';items.forEach(function(it,i){var v=fmt?fmt(it,i):it;h+=lyRowHtml(i===0?label:'',v,i>0)});return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 77 — Add the function that prints a labelled row containing HTML.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyList` ends, after its closing `}`.

**Code:**

```js
function lyRowHtml(label,value,indent){var t=(typeof value==='string')?value:lyText(value);var parts=t.split('<br>').map(function(x){return esc(lyCap(x))});return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?parts.join('<br>'):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 78 — Add the function that prints one whole record as a table.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRowHtml` ends, after its closing `}`.

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

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 79 — Add the function that prints a list of records under group headings.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRender` ends, after its closing `}`.

**Code:**

```js
function lyRegister(type,records,depth,upto,groups,onePerPage,lead){ /* a register document body: optional groups of records, each rendered. The group header is the largest, heaviest thing on the page, and it is the first record's table caption, so the browser keeps it with that record's first page whether the record is short or long */
  var h='';var gi=-1;(groups||[{name:'',list:records}]).filter(function(g){return g.list.length}).forEach(function(g){gi++;
    var head=g.name?'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111">'+esc(g.name)+' <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+g.list.length+'</span></div>':'';
    g.list.forEach(function(r,i){var blk=lyRender(type,r,depth,upto,(i===0&&head)?head:'',lead);h+=(onePerPage&&!(gi===0&&i===0))?'<div style="break-before:page;page-break-before:always">'+blk+'</div>':blk})});
  return h||'<div style="font-size:13px;color:#666;font-style:italic;padding:8px 0">Nothing on this register.</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 80 — Add the function that collects what a set of records is missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRegister` ends, after its closing `}`.

**Code:**

```js
function lyGaps(type,records,upto){var out=[];var map=LAYER_MAPS[type];if(!map)return out;records.forEach(function(r){var m=lyMissing(map,r,upto);if(m.length)out.push({title:map.identity(r).title,lines:m})});return out}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 81 — Add the function that shows the same record tables on screen, in the screen's colours.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyGaps` ends, after its closing `}`.

**Code:**

```js
function lyScreenRegister(type,records,depth,upto,groups){var h=lyRegister(type,records,depth,upto,groups);return '<div class="ly-screen" style="font-size:13px">'+h.replace(/color:#111/g,'color:var(--paper)').replace(/color:#555/g,'color:var(--text-muted)').replace(/color:#333/g,'color:var(--text-muted)').replace(/color:#666/g,'color:var(--text-faint)').replace(/background:#fff/g,'background:transparent').replace(/border-bottom:2px solid #111/g,'border-bottom:2px solid rgba(var(--fg-rgb),.5)').replace(/border-bottom:1px solid #111/g,'border-bottom:1px solid rgba(var(--fg-rgb),.4)').replace(/border-bottom:1px solid #eee/g,'border-bottom:1px solid rgba(var(--fg-rgb),.08)')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 82 — Add the function that draws the Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyScreenRegister` ends, after its closing `}`.

**Code:**

```js
function lyDepthCtl(){var d=(UI.printDepth||'summary');return '<span style="display:inline-flex;gap:4px;align-items:center;margin-right:8px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint)">DEPTH</span>'+['summary','full'].map(function(k){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(d===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.printDepth=\''+k+'\';render()">'+(k==='summary'?'Summary':'Full')+'</button>'}).join('')+'</span>'} /* Round 2: the depth control the outputs and the print share */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 83 — Add the function that draws a section heading of a printed document, with its sub-line on its own line beneath the title.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyDepthCtl` ends, after its closing `}`.

**Code:**

```js
/* ── documents composed for paper (15 Sep 2026, Paul's ruling): a document is designed from the page's content and laid out for the page; it is never the page's markup passed through ── */
function erHead(title,sub){return '<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* a section heading alone, for sections that are not a table of rows. 16 Sep 2026 (Paul's ruling, from the Values Architecture printout): the sub-line sits on its own line beneath the title, in its mono face, not inline with it */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 84 — Add the function that draws a larger section heading (28px) for documents whose register groups already carry the standard heading.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erHead` ends, after its closing `}`.

**Code:**

```js
function erHeadLg(title,sub){return erHead(title,sub).replace('font-size:24px','font-size:28px')} /* 16 Sep 2026 (Paul's ruling): a section heading a step above the register's group headings (24px), for documents whose groups carry their own */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 85 — Add the function that draws an appendix heading: the word Appendix as the page's heading, with the section's own title beneath it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erHeadLg` ends, after its closing `}`.

**Code:**

```js
function erAppendix(title,sub){return erHeadLg('Appendix','')+'<div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111;margin:0 0 12px;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* 16 Sep 2026 (Paul's ruling): an appendix is headed Appendix, with the section's own title beneath — never labelled beside the title; its sub-line beneath the title likewise */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 86 — Add the function that draws a row of figures in boxes at the head of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erAppendix` ends, after its closing `}`.

**Code:**

```js
function erFigRow(figs){return '<div class="er-figs" style="display:grid;grid-template-columns:repeat('+figs.length+',1fr);gap:10px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid">'+figs.map(function(f){return '<div style="border:1px solid #ddd;border-top:3px solid '+(f.col||'#111')+';border-radius:6px;padding:10px 8px;text-align:center"><b style="display:block;font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;line-height:1.1;color:'+(f.vcol||'#111')+'">'+esc(String(f.v))+'</b><span style="display:block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-top:4px">'+esc(f.l)+'</span>'+(f.sub?'<span style="display:block;font-size:10.5px;color:#777;margin-top:2px">'+esc(f.sub)+'</span>':'')+'</div>'}).join('')+'</div>'} /* a row of figures in boxes: the value, its label, an optional line beneath, a coloured rule above */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 87 — Add the function that draws a headed block of bars (label, bar, score) in a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erFigRow` ends, after its closing `}`.

**Code:**

```js
function erBarBlock(title,sub,rows){var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+rows.map(function(r){var v=+r.v||0,m=r.max||5;return '<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(r.l)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+Math.round(v/m*100)+'%;background:'+(v?tone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:64px;padding:4px 0 4px 8px;text-align:right;white-space:nowrap;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v.toFixed(1)+' / '+m:'\u2014')+'</td></tr>'}).join('')+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling): a headed block of bars — label · bar · score, the Readiness Report's row form — unsplittable under the block rule */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 88 — Add the function that wraps a piece of a printed document so that it is never split across pages.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erBarBlock` ends, after its closing `}`.

**Code:**

```js
function erBlock(inner){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+inner+'</div>'} /* 16 Sep 2026: the block rule as a wrapper — a unit that is never split across pages */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 89 — Add the function that draws one headed section of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erBlock` ends, after its closing `}`.

**Code:**

```js
/* ── the single-record documents (14 Sep 2026): a heading per section over labelled rows, in the screen's own words; one form each ── */
function erSection(title,rowsHtml,sub){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub) /* 16 Sep 2026 (Paul's ruling): the section heading is erHead's — the sub-line beneath the title; one heading form */+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px;break-inside:auto;page-break-inside:auto"><tbody>'+rowsHtml+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling; family): a block — a heading with its rows — is never split across pages; if it would be, it starts a new page. The block is unsplittable; the table inside stays splittable between rows so a block taller than a page still breaks between rows, never inside one */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 90 — Add the function that draws a section's labelled rows.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erSection` ends, after its closing `}`.

**Code:**

```js
function erRows(obj,fields){return fields.map(function(f){if(f.rows)return f.rows(obj).map(function(r){return lyRow(r.l,r.v)}).join(''); /* 16 Sep 2026: a field may supply its own rows (a list stored on the record) */var v=obj[f.k];var L=(typeof STRUCTURE_LABELS!=='undefined')&&STRUCTURE_LABELS[f.k];if(L&&L[v])v=L[v];return lyRow(f.l,v)}).join('')} /* a stored choice prints as its label */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 91 — Add the constant naming the three time horizons of a portfolio position.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erRows` ends, after its closing `}`.

**Code:**

```js

/* ══ THE IDEA RECORD (16 Sep 2026): the record that runs the module — an idea, gaining a layer at each stage; the five portfolio outputs are its registers at successive stages. Labels are the app's own read-only cards' labels (expCardRO, projCardRO, devCardRO, opPortBody) ══ */
var IDEA_HORIZON_LABELS={quick:'Quick win',medium:'Medium-term bet',long:'Long-term bet'}; /* the words Step 3.1 gives the horizon values */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 92 — Add the constant naming the five qualification gates of step 1.3.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `IDEA_HORIZON_LABELS` ends.

**Code:**

```js
var IDEA_GATES=[{k:'techCapable',l:'Technology'},{k:'resourcesAvailable',l:'Resources'},{k:'culturalFit',l:'Culture'},{k:'purposeAligned',l:'Purpose'},{k:'affordable',l:'Affordability'}]; /* the five qualification gates of Step 1.3 */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 93 — Add the function that turns a list of idea numbers into the records a register prints.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `IDEA_GATES` ends.

**Code:**

```js
function ideaRecs(list){return (list||[]).map(function(i){return {i:i}})} /* a register's records are indices into data.ideas, carried as {i} */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 94 — Add the function that says whether an idea passed its five qualification gates.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ideaRecs` ends, after its closing `}`.

**Code:**

```js
function ideaQual(i){var a=(data.assessments||{})[i]||{};var def=IDEA_GATES.filter(function(g){return a[g.k]!==undefined});if(!def.length)return {state:'none',text:''};var failed=IDEA_GATES.filter(function(g){return a[g.k]===false});if(def.length<IDEA_GATES.length)return {state:'partial',text:'Partly qualified ('+def.length+' of 5 gates answered)'};return failed.length?{state:'disq',text:'Did not pass: '+failed.map(function(g){return g.l}).join(', ')}:{state:'pass',text:'Passed all five gates'}}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 95 — Add the function that draws a portfolio's balance card on paper: three rows of three bands with counts.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ideaQual` ends, after its closing `}`.

**Code:**

```js
function ideaBalanceBlock(items,stage,title){if(!items||!items.length)return '';var res=items.map(function(i){return resolveBands(i,stage)});var tot=res.length;
  var rows=[['Time horizon','h',[['quick','Quick'],['medium','Medium'],['long','Long']]],['Risk','r',[['low','Low'],['medium','Medium'],['high','High']]],['Reward','w',[['low','Low'],['medium','Medium'],['high','High']]]];
  var bars=rows.map(function(row){return '<tr><td style="width:24%;padding:8px 8px 8px 0;vertical-align:top;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#555;border-bottom:1px solid #eee">'+row[0]+'</td>'+row[2].map(function(b){var c=res.filter(function(x){return x.conf&&x[row[1]]===b[0]}).length,p=res.filter(function(x){return !x.conf&&x[row[1]]===b[0]}).length;var cw=Math.round(c/tot*100),pw=Math.round(p/tot*100);return '<td style="padding:8px 6px;vertical-align:top;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-bottom:3px"><span>'+b[1]+'</span><span style="font-family:var(--mono,monospace)">'+c+(p?' (+'+p+')':'')+'</span></div><div style="height:7px;border-radius:4px;background:#eee;overflow:hidden;display:flex"><div style="width:'+cw+'%;background:#555"></div><div style="width:'+pw+'%;background:#bbb"></div></div></td>'}).join('')+'</tr>'}).join('');
  var fl=balanceFlags(res);var sub=stage==='bluesky'?'From intake estimates \u2014 timeframe, triage risk and value':stage==='explore'?'Graded projects only':'Solid = positioned; lighter = provisional, suggested from the assessments';
  return erBlock(erHead(title||'Portfolio Balance',sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 '+(fl.length?'8px':'22px')+'"><tbody>'+bars+'</tbody></table>'+(fl.length?'<p style="font-size:12px;color:#333;margin:0 0 22px">'+fl.map(function(t){return '\u26A0 '+esc(t)}).join('<br>')+'</p>':''))} /* 17 Sep 2026 (Paul's ruling): the page's Portfolio Balance card on paper \u2014 three rows of three bands with counts, the flags beneath; greys, as the document's figures are */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 96 — Add the description of the idea record: its identity, and its layers from the idea card through ranking, exploration, portfolio placement, capital, the development track, the review, and operations.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ideaBalanceBlock` ends, after its closing `}`.

**Code:**

```js
LAYER_MAPS.idea={
  identity:function(r){var d=(data.ideas||[])[r.i]||{};return {title:d.name||'Unnamed idea',score:'',meta:[d.dept||'',d.cost||'',d.timeframe||'',d.when==='future'?'Parked for the future':''].filter(Boolean)}},
  layers:[
   {id:'idea',title:'The idea',stage:'1.2',present:function(r){var d=(data.ideas||[])[r.i]||{};return !!(d.desc||d.strategic||d.outcome||d.capabilities||d.risk)},fields:[
     {label:'Description',get:function(r){return ((data.ideas||[])[r.i]||{}).desc},summary:true},
     {label:'Strategic anchor',get:function(r){return ((data.ideas||[])[r.i]||{}).strategic},summary:true},
     {label:'Best and worst outcome',get:function(r){return ((data.ideas||[])[r.i]||{}).outcome}},
     {label:'Capabilities needed',get:function(r){return ((data.ideas||[])[r.i]||{}).capabilities}},
     {label:'Risk',get:function(r){return ((data.ideas||[])[r.i]||{}).risk}}]},
   {id:'rank',title:'Filter and rank',stage:'1.3',present:function(r){var a=(data.assessments||{})[r.i];return !!(a&&(IDEA_GATES.some(function(g){return a[g.k]!==undefined})||a.priority||a.value))},fields:[
     {label:'Qualification',get:function(r){return ideaQual(r.i).text},summary:true},
     {label:'Score',get:function(r){return ideaQual(r.i).state==='pass'?triageScore(r.i)+' / 50':''},summary:true},
     {label:'Priority',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.priority?a.priority+' / 10':''}},
     {label:'Risk (10 = low)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.risk?a.risk+' / 10':''}},
     {label:'Value',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.value?a.value+' / 10':''}},
     {label:'Cost (10 = low)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.costScore?a.costScore+' / 10':''}},
     {label:'Ease (10 = easy)',get:function(r){var a=(data.assessments||{})[r.i]||{};return a.difficulty?a.difficulty+' / 10':''}}]},
   {id:'exploration',title:'Exploration',stage:'2.4',present:function(r){var p=(data.projects||{})[r.i]||{};return !!(p.viable===true||p.viable===false||p.objectives||p.deliverables||p.noGoR)},fields:[
     {label:'Verdict',get:function(r){var p=(data.projects||{})[r.i]||{};return p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided'},summary:true},
     {label:'No-Go reason',get:function(r){return ((data.projects||{})[r.i]||{}).noGoR},summary:true},
     {label:'Objectives',get:function(r){return ((data.projects||{})[r.i]||{}).objectives},summary:true},
     {label:'Deliverables',get:function(r){return ((data.projects||{})[r.i]||{}).deliverables}},
     {label:'Timeline',get:function(r){return ((data.projects||{})[r.i]||{}).timeline}},
     {label:'Resources',get:function(r){return ((data.projects||{})[r.i]||{}).resources}},
     {label:'Key risks',get:function(r){return ((data.projects||{})[r.i]||{}).risks}},
     {label:'Success metrics',get:function(r){return ((data.projects||{})[r.i]||{}).metrics}},
     {label:'Internal partners',get:function(r){return ((data.projects||{})[r.i]||{}).partInt}},
     {label:'External partners',get:function(r){return ((data.projects||{})[r.i]||{}).partExt}}]},
   {id:'portfolio',title:'Portfolio placement',stage:'3.1',present:function(r){var p=(data.portfolio||{})[r.i]||{};return !!(p.horizon||p.risk||p.reward||p.notes)},fields:[
     {label:'Horizon',get:function(r){var p=(data.portfolio||{})[r.i]||{};return IDEA_HORIZON_LABELS[p.horizon]||(p.horizon?lyCap(p.horizon):'')},summary:true},
     {label:'Risk',get:function(r){var p=(data.portfolio||{})[r.i]||{};return p.risk?lyCap(p.risk):''},summary:true},
     {label:'Reward',get:function(r){var p=(data.portfolio||{})[r.i]||{};return p.reward?lyCap(p.reward):''},summary:true},
     {label:'Notes',get:function(r){return ((data.portfolio||{})[r.i]||{}).notes}}]},
   {id:'capital',title:'Capital',stage:'3.3',present:function(r){var p=(data.projects||{})[r.i]||{},b=(data.budgetPlans||{})[r.i]||{};return !!(p.startupCost||p.rolloutCost||p.runningCost||b.horizon||b.contingency)},fields:[
     {label:'Start-up cost',get:function(r){return ((data.projects||{})[r.i]||{}).startupCost},summary:true},
     {label:'Rollout cost',get:function(r){return ((data.projects||{})[r.i]||{}).rolloutCost},summary:true},
     {label:'Running cost',get:function(r){return ((data.projects||{})[r.i]||{}).runningCost},summary:true},
     {label:'Plan horizon',get:function(r){var b=(data.budgetPlans||{})[r.i]||{};return b.horizon?b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):''}},
     {label:'Contingency',get:function(r){var b=(data.budgetPlans||{})[r.i]||{};return b.contingency?b.contingency+'%':''}}]},
   {id:'development',title:'Development track',stage:'4.1',present:function(r){var t=(data.tracking||{})[r.i]||{};return !!(t.status||t.results||t.infraLearnings||t.breakWork)},fields:[
     {label:'Status',get:function(r){var t=(data.tracking||{})[r.i]||{};return t.status?lyCap(t.status):''},summary:true},
     {label:'Results to date',get:function(r){return ((data.tracking||{})[r.i]||{}).results},summary:true},
     {label:'Infrastructure learnings',get:function(r){return ((data.tracking||{})[r.i]||{}).infraLearnings}},
     {label:'What\u2019s breaking / working',get:function(r){return ((data.tracking||{})[r.i]||{}).breakWork}}]},
   {id:'review',title:'Portfolio review',stage:'4.4',present:function(r){var it=((data.review||{}).items||{})[r.i]||{};return !!it.decision},fields:[
     {label:'Decision',get:function(r){var it=((data.review||{}).items||{})[r.i]||{};return it.decision?lyCap(it.decision):''},summary:true}]},
   {id:'operations',title:'Operations',stage:'5',present:function(r){var o=(data.opsData||{})[r.i]||{};return (data.launched||[]).indexOf(r.i)>=0||!!(o.health||o.launchDate||o.performance||o.notes)},fields:[
     {label:'Health',get:function(r){var o=(data.opsData||{})[r.i]||{};return o.health?lyCap(o.health):''},summary:true},
     {label:'Launch date',get:function(r){var o=(data.opsData||{})[r.i]||{};return o.launchDate?lyDate(o.launchDate):''},summary:true},
     {label:'Owner',get:function(r){var o=(data.opsData||{})[r.i]||{},e=(data.experiments||{})[r.i]||{};return o.owner||e.owner}},
     {label:'Performance vs. success metric',get:function(r){return ((data.opsData||{})[r.i]||{}).performance},summary:true},
     {label:'Ongoing notes',get:function(r){return ((data.opsData||{})[r.i]||{}).notes}}]}
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 97 — Add the constant giving each layer of the idea record its position.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
LAYER_MAPS.idea={
```

**Code:**

```js
var IDEA_LAYER_INDEX={idea:0,rank:1,exploration:2,portfolio:3,capital:4,development:5,review:6,operations:7}; /* the brief layer left 17 Sep 2026: its fields had no writer */ /* the layers of LAYER_MAPS.idea by index, so a register names the layer it prints up to */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 98 — Add the function that finds one layer of the idea record by its name, for the project record to reuse.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `IDEA_LAYER_INDEX` ends.

**Code:**

```js
/* ══ THE PROJECT RECORD (17 Sep 2026, Paul's ruling): once an idea is a project, its record is the project card — Overview (2.4), Analyses (the gap analysis and SWOT), Budget (3.3) — then the brief, the track, the review, and operations. The idea card is superseded and does not print. Summary draws on the Overview and the budget's figures; Full adds the analyses and the budget plan ══ */
function projLayerById(id){return LAYER_MAPS.idea.layers.filter(function(l){return l.id===id})[0]}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 99 — Add the function that formats one of a budget plan's totals, or nothing when the project has no plan.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projLayerById` ends, after its closing `}`.

**Code:**

```js
function bpMoney(i,fn){try{if(!bpHasAny(i))return '';var v=fn(i);return v?fmtMoney(v):''}catch(e){return ''}}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 100 — Add the function that lists a budget plan's development phases or rollout steps as lines.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `bpMoney` ends, after its closing `}`.

**Code:**

```js
function bpSteps(i,k){var p=bpGet(i)||{};return (p[k]||[]).filter(function(st){return st&&(st.name||st.cost)}).map(function(st){return (st.name||'Unnamed')+(st.from&&st.to?' \u2014 months '+st.from+'\u2013'+st.to:'')+(st.cost?' \u2014 '+st.cost:'')})}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 101 — Add the function that lists a budget plan's sustainment phases as lines.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `bpSteps` ends, after its closing `}`.

**Code:**

```js
function bpSusLines(i){var p=bpGet(i)||{};return (p.sus||[]).filter(function(ph){return ph&&ph.name}).map(function(ph){var items=(ph.items||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return x.name+(x.cost?' '+x.cost:'')});return ph.name+(ph.from?' \u2014 from month '+ph.from+(ph.to&&ph.to!=='ongoing'?' to '+ph.to:', ongoing'):'')+(items.length?': '+items.join('; '):'')})}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 102 — Add the function that lists what a project has, or lacks, in one category of its gap analysis.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `bpSusLines` ends, after its closing `}`.

**Code:**

```js
function gapNames(i,cat,have){var g=gapItemsOf(i);return (g[cat]||[]).filter(function(x){return !!x.have===have}).map(function(x){return x.name})}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 103 — Add the description of the project record: its identity, and its layers Overview, Portfolio placement, Analyses, Budget, Development track, Portfolio review, and Operations.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `gapNames` ends, after its closing `}`.

**Code:**

```js
LAYER_MAPS.project={
  identity:function(r){var d=(data.ideas||[])[r.i]||{},pb=(data.portfolio||{})[r.i]||{};return {title:d.name||'Unnamed project',score:'',meta:[d.dept||'',IDEA_HORIZON_LABELS[pb.horizon]||'',ideaStageWord(r.i)].filter(Boolean)}},
  layers:[
   {id:'overview',title:'Overview',stage:'2.4',present:function(r){var p=(data.projects||{})[r.i]||{};return !!(p.viable===true||p.viable===false||p.objectives||p.deliverables||p.timeline||p.noGoR)},fields:[
     {label:'Verdict',get:function(r){var p=(data.projects||{})[r.i]||{};return p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided'},summary:true},
     {label:'No-Go reason',get:function(r){return ((data.projects||{})[r.i]||{}).noGoR},summary:true},
     {label:'Objectives',get:function(r){return ((data.projects||{})[r.i]||{}).objectives},summary:true},
     {label:'Deliverables',get:function(r){return ((data.projects||{})[r.i]||{}).deliverables},summary:true},
     {label:'Timeline',get:function(r){return ((data.projects||{})[r.i]||{}).timeline},summary:true},
     {label:'Resources',get:function(r){return ((data.projects||{})[r.i]||{}).resources}},
     {label:'Key risks',get:function(r){return ((data.projects||{})[r.i]||{}).risks}},
     {label:'Success metrics',get:function(r){return ((data.projects||{})[r.i]||{}).metrics}},
     {label:'Internal partners',get:function(r){return ((data.projects||{})[r.i]||{}).partInt}},
     {label:'External partners',get:function(r){return ((data.projects||{})[r.i]||{}).partExt}}]},
   projLayerById('portfolio'),
   {id:'analyses',title:'Analyses',stage:'3.2',present:function(r){var g=gapItemsOf(r.i),sw=((data.projects||{})[r.i]||{}).swot||{};return ['skills','resources','technology'].some(function(c){return (g[c]||[]).length})||['strengths','weaknesses','opportunities','threats'].some(function(k){return sw[k]})},fields:[
     {label:'Skills we have',list:true,get:function(r){return gapNames(r.i,'skills',true)}},
     {label:'Skills gap',list:true,get:function(r){return gapNames(r.i,'skills',false)}},
     {label:'Resources we have',list:true,get:function(r){return gapNames(r.i,'resources',true)}},
     {label:'Resources gap',list:true,get:function(r){return gapNames(r.i,'resources',false)}},
     {label:'Technology we have',list:true,get:function(r){return gapNames(r.i,'technology',true)}},
     {label:'Technology gap',list:true,get:function(r){return gapNames(r.i,'technology',false)}},
     {label:'Strengths',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).strengths}},
     {label:'Weaknesses',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).weaknesses}},
     {label:'Opportunities',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).opportunities}},
     {label:'Threats',get:function(r){return (((data.projects||{})[r.i]||{}).swot||{}).threats}}]},
   {id:'budget',title:'Budget',stage:'3.3',present:function(r){var p=(data.projects||{})[r.i]||{};return bpHasAny(r.i)||!!(p.startupCost||p.rolloutCost||p.runningCost)},fields:[
     {label:'Lifetime cost',get:function(r){return bpMoney(r.i,bpLifetime)},summary:true},
     {label:'Development costs',get:function(r){return bpMoney(r.i,bpDevTotal)||((data.projects||{})[r.i]||{}).startupCost},summary:true},
     {label:'Rollout costs',get:function(r){return bpMoney(r.i,bpRollTotal)||((data.projects||{})[r.i]||{}).rolloutCost},summary:true},
     {label:'Annual sustainment costs',get:function(r){return bpMoney(r.i,bpSusSteady)||((data.projects||{})[r.i]||{}).runningCost},summary:true},
     {label:'Estimated project lifetime',get:function(r){var b=bpGet(r.i)||{};return b.horizon?b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):''}},
     {label:'Contingency',get:function(r){var b=bpGet(r.i)||{};return b.contingency?b.contingency+'%':''}},
     {label:'Development phases',list:true,get:function(r){return bpSteps(r.i,'dev')}},
     {label:'Rollout steps',list:true,get:function(r){return bpSteps(r.i,'roll')}},
     {label:'Sustainment',list:true,get:function(r){return bpSusLines(r.i)}}]},
   projLayerById('development'),projLayerById('review'),projLayerById('operations')
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 104 — Add the constant giving each layer of the project record its position.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
LAYER_MAPS.project={
```

**Code:**

```js
var PROJECT_LAYER_INDEX={overview:0,portfolio:1,analyses:2,budget:3,development:4,review:5,operations:6};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 105 — Add the constant holding the style of the small uppercase labels on the printed project cards.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PROJECT_LAYER_INDEX` ends.

**Code:**

```js
/* ══ THE PROJECT ON PAPER AS CARDS (17 Sep 2026, Paul's ruling for the Exploration Portfolio): Summary prints each project's Overview card whole — every line — with the verdict and the Filter & Rank score right-justified on the name bar; Full gives each project two pages: the Overview card, the Analyses card (the gap analysis closed up, then the SWOT), and the portfolio position on the first; the budget on the second, with rollout steps and sustainment beside the development phases ══ */
var PC_LBL='font-family:var(--mono,monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#555;margin:0 0 2px';
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 106 — Add the function that prints a card field's value, or Not recorded when it is empty.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PC_LBL` ends.

**Code:**

```js
function pcText(v,size){var t=lyText(v);return '<div style="font-size:'+(size||11.5)+'px;line-height:1.4;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 107 — Add the function that draws a project card's name bar: the name, its department, and the verdict and Filter & Rank score at the right.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `pcText` ends, after its closing `}`.

**Code:**

```js
function projCardBar(i){var d=(data.ideas||[])[i]||{},p=(data.projects||{})[i]||{};var verdict=p.viable===true?'Go':p.viable===false?'No-Go':'Not yet decided';var sc=triageScore(i);
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 14px;border-bottom:1px solid #ddd;background:#f4f4f4;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div><span style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111">'+esc(d.name||'Unnamed project')+'</span>'+(d.dept?'<span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(d.dept)+'</span>':'')+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#111;white-space:nowrap">'+verdict+(sc?' \u00b7 '+sc+' / 50':'')+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 108 — Add the function that draws the budget figures under a project card's name bar: lifetime, development, rollout, and sustainment costs, then the contingency and peak lines.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projCardBar` ends, after its closing `}`.

**Code:**

```js
function projStatBand(i,large){if(!bpHasAny(i))return ''; /* 17 Sep 2026 (Paul's ruling): the figures are 26px and blue on the Full card only; Summary keeps the smaller black form, or they dominate its page */var H=bpHorizon(i),life=bpLifetime(i),pk=bpPeakMonth(i),fo=bpFirstOpMonth(i),ssv=bpSusSteady(i);var mm=bpMonthly(i);var pkV=pk?Math.round(mm[pk-1].dev+mm[pk-1].roll+mm[pk-1].sus):0;var ct=parseFloat((bpGet(i)||{}).contingency)||0;
  var big=function(v,l,sub){return '<td style="text-align:center;padding:'+(large?'9px':'8px')+' 6px 6px;vertical-align:top"><div style="'+(large?'font-size:26px;font-weight:800;color:var(--ph2-t)':'font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111')+';line-height:1.1">'+v+'</div><div style="font-size:10.5px;color:#333;margin-top:2px">'+l+'</div>'+(sub?'<div style="font-size:9.5px;color:#777">'+sub+'</div>':'')+'</td>'};
  var h='<table style="width:100%;border-collapse:collapse;border-bottom:1px solid #eee"><tr>'+big(fmtMoney(life),'Lifetime cost','across '+H+' years')+big(fmtMoney(bpDevTotal(i)),'Development costs','')+big(fmtMoney(bpRollTotal(i)),'Rollout costs','')+big(ssv?fmtMoney(ssv):'\u2014','Annual sustainment costs','')+'</tr></table>';
  var l1=[];if(ct>0)l1.push('With '+ct+'% contingency: '+fmtMoney(Math.round(life*(1+ct/100)))+' lifetime.');if(fo)l1.push('First operational month: Month '+fo+'.');
  var lines=(l1.length?'<div>'+l1.join(' \u00b7 ')+'</div>':'')+(pk?'<div>Monthly costs peak at Month '+pk+': '+fmtMoney(pkV)+' per month.</div>':'');
  return h+(lines?'<div style="padding:6px 14px 2px;font-size:11.5px;line-height:1.5;color:#111;border-bottom:1px solid #eee">'+lines+'</div>':'')} /* 17 Sep 2026 (Paul's ruling): the Overview card's numbers, as the page's stat band gives them \u2014 the four figures, then contingency and first operational month on one line, the peak month on the next */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 109 — Add the function that draws a project's Overview card for paper: the name bar, the budget figures, and the eight Overview fields.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projStatBand` ends, after its closing `}`.

**Code:**

```js
function projOverviewCard(i,big){var p=(data.projects||{})[i]||{};var F=[['Objectives',p.objectives],['Deliverables',p.deliverables],['Timeline',p.timeline],['Resources',p.resources],['Key risks',p.risks],['Success metrics',p.metrics],['Internal partners',p.partInt],['External partners',p.partExt]];
  var cells=F.map(function(f){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</td>'});var rows='';for(var k=0;k<cells.length;k+=2)rows+='<tr>'+cells[k]+cells[k+1]+'</tr>';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden">'+projCardBar(i)+projStatBand(i,big)+(p.noGoR?'<div style="padding:6px 14px 0"><div style="'+PC_LBL+'">No-Go reason</div>'+pcText(p.noGoR)+'</div>':'')+'<table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 110 — Add the function that draws a project's Analyses card for paper: the gap analysis in colour and the SWOT as four tinted cells.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projOverviewCard` ends, after its closing `}`.

**Code:**

```js
function projAnalysesCard(i){var p=(data.projects||{})[i]||{},g=gapItemsOf(i),sw=p.swot||{};var gAny=['skills','resources','technology'].some(function(c){return (g[c]||[]).length}),sAny=['strengths','weaknesses','opportunities','threats'].some(function(k){return sw[k]});
  var h='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Analyses</div>';
  if(!gAny&&!sAny)return h+'<div style="font-size:11.5px;color:#888;font-style:italic">No analyses recorded yet.</div></div>';
  if(gAny){h+='<div style="'+PC_LBL+'">Gap analysis</div><table style="width:100%;border-collapse:collapse;margin:0 0 8px"><tbody>'+[['Skills','skills'],['Resources','resources'],['Technology','technology']].map(function(c){var its=g[c[1]]||[];if(!its.length)return '';var hv=its.filter(function(x){return x.have}).map(function(x){return esc(x.name)}),gp=its.filter(function(x){return !x.have}).map(function(x){return esc(x.name)});return '<tr><td style="width:22%;padding:3px 0;font-size:11.5px;font-weight:700;color:#111;vertical-align:top;border-bottom:1px solid #eee">'+c[0]+'</td><td style="width:39%;padding:3px 8px 3px 0;font-size:11px;line-height:1.3;vertical-align:top;border-bottom:1px solid #eee"><span style="color:#1B6B5A;font-weight:700">Have:</span> '+(hv.length?hv.join(', '):'\u2014')+'</td><td style="width:39%;padding:3px 0;font-size:11px;line-height:1.3;vertical-align:top;border-bottom:1px solid #eee;color:'+(gp.length?'#B8860B':'#111')+'"><span style="color:#B8860B;font-weight:700">Gap:</span> '+(gp.length?gp.join(', '):'\u2014')+'</td></tr>' /* 17 Sep 2026 (Paul's ruling): colour on the gap analysis \u2014 gaps in the page's amber, what is in hand in green */}).join('')+'</tbody></table>'}
  if(sAny){var Q=[{k:'strengths',l:'+ Strengths',c:'#1B6B5A',bg:'rgba(27,107,90,.10)'},{k:'weaknesses',l:'\u2212 Weaknesses',c:'#C25B73',bg:'rgba(155,45,63,.08)'},{k:'opportunities',l:'\u25c9 Opportunities',c:'#2D5A8E',bg:'rgba(45,90,142,.10)'},{k:'threats',l:'\u25b3 Threats',c:'#D4A017',bg:'rgba(139,94,60,.10)'}]; /* the page's four tints and label colours (17 Sep 2026, Paul's ruling: colour throughout this report, as on screen) */
  var qcell=function(q){return '<td style="width:50%;vertical-align:top;background:'+q.bg+';border-radius:5px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;color:'+q.c+';margin-bottom:3px">'+q.l+'</div>'+pcText(sw[q.k],11)+'</td>'};
  h+='<div style="'+PC_LBL+'">SWOT</div><table style="width:100%;border-collapse:separate;border-spacing:4px 4px;margin:0 -4px"><tr>'+qcell(Q[0])+qcell(Q[1])+'</tr><tr>'+qcell(Q[2])+qcell(Q[3])+'</tr></table>'}
  return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 111 — Add the function that draws a project's Portfolio Position for paper: horizon, risk, reward, and notes.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projAnalysesCard` ends, after its closing `}`.

**Code:**

```js
function projPositionBlock(i){var pb=(data.portfolio||{})[i]||{};var placed=!!(pb.horizon||pb.risk||pb.reward||pb.notes);
  var h='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111;margin:0 0 6px">Portfolio Position</div>';
  if(!placed)return h+'<div style="font-size:11.5px;color:#888;font-style:italic">Not yet placed in the portfolio (Step 3.1).</div></div>';
  var cell=function(l,v){return '<td style="width:33%;vertical-align:top;padding:2px 8px 2px 0"><div style="'+PC_LBL+'">'+l+'</div>'+pcText(v)+'</td>'};
  return h+'<table style="width:100%;border-collapse:collapse"><tr>'+cell('Horizon',IDEA_HORIZON_LABELS[pb.horizon]||(pb.horizon?lyCap(pb.horizon):''))+cell('Risk',pb.risk?lyCap(pb.risk):'')+cell('Reward',pb.reward?lyCap(pb.reward):'')+'</tr></table>'+(pb.notes?'<div style="margin-top:6px"><div style="'+PC_LBL+'">Notes</div>'+pcText(pb.notes)+'</div>':'')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 112 — Add the function that draws a project's Budget page for paper: the four charts, each in its box, then the phase tables side by side.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projPositionBlock` ends, after its closing `}`.

**Code:**

```js
function projBudgetPage(i,opts){opts=opts||{};var d=(data.ideas||[])[i]||{},p=(data.projects||{})[i]||{},b=bpGet(i)||{};var has=bpHasAny(i);
  var h='<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 6px;padding-bottom:4px;border-bottom:3px solid #111"><div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111">Budget</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#555">'+esc(d.name||'')+'</div></div>';
  if(!has){h+='<div style="font-size:11.5px;color:#888;font-style:italic;margin:0 0 10px">No budget plan yet (Step 3.3).</div>';if(p.startupCost||p.rolloutCost||p.runningCost)h+=erFigRow([{v:p.startupCost||'\u2014',l:'Start-up cost'},{v:p.rolloutCost||'\u2014',l:'Rollout cost'},{v:p.runningCost||'\u2014',l:'Running cost'}]);return h}
  h+='<div style="font-size:11px;color:#333;margin:0 0 6px">'+(b.horizon?'Estimated project lifetime '+b.horizon+' year'+(String(b.horizon)==='1'?'':'s'):'')+(b.contingency?(b.horizon?' \u00b7 ':'')+'Contingency '+b.contingency+'%':'')+'</div>';
  var th=function(t){return '<th style="text-align:left;padding:2px 4px;font-family:var(--mono,monospace);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v,extra){return '<td style="padding:2px 4px;font-size:10px;line-height:1.25;vertical-align:top;border-bottom:1px solid #eee;'+(extra||'')+'">'+v+'</td>'};
  var steps=function(list,withDesc){return (list||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return '<tr>'+td(esc(x.name||'Unnamed')+(withDesc&&x.desc?'<div style="color:#666;font-size:9px">'+esc(x.desc)+'</div>':''))+td(x.from&&x.to?esc(x.from+'\u2013'+x.to):'','white-space:nowrap')+td(esc(x.cost||''),'white-space:nowrap;text-align:right')+'</tr>'}).join('')};
  var left='<div style="'+PC_LBL+'">Development phases</div><table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Phase')+th('Months')+th('Cost')+'</tr></thead><tbody>'+(steps(b.dev,true)||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var rollout='<div style="'+PC_LBL+'">Rollout steps</div><table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Step')+th('Months')+th('Cost')+'</tr></thead><tbody>'+(steps(b.roll,false)||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var sus='<div style="'+PC_LBL+'">Sustainment</div><table style="width:100%;border-collapse:collapse"><thead><tr>'+th('Phase')+th('From')+th('Annual items')+'</tr></thead><tbody>'+((b.sus||[]).filter(function(ph){return ph&&ph.name}).map(function(ph){var items=(ph.items||[]).filter(function(x){return x&&(x.name||x.cost)}).map(function(x){return esc(x.name||'')+(x.cost?' <span style="color:#555">'+esc(x.cost)+'</span>':'')}).join('<br>');return '<tr>'+td(esc(ph.name))+td(ph.from?'Month '+esc(ph.from)+(ph.to&&ph.to!=='ongoing'?'\u2013'+esc(ph.to):', ongoing'):'','white-space:nowrap')+td(items||'\u2014')+'</tr>'}).join('')||'<tr>'+td('<span style="color:#888;font-style:italic">None yet</span>')+td('')+td('')+'</tr>')+'</tbody></table>';
  var box=function(title,svg,cap,extra){var inner=String(svg||'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/<svg /g,'<svg style="width:100%;height:auto;max-height:'+cap+'px;display:block" ').replace(/class="t-faint-sm"/g,'style="font-size:9px;color:#777"');return inner?'<div style="border:1px solid #ddd;border-radius:6px;padding:6px 10px 6px;margin:0 0 6px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono,monospace);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#333;margin:0 0 2px">'+title+'</div>'+inner+(extra||'')+'</div>':''}; /* 17 Sep 2026 (Paul's rulings): each chart in its own box, its height capped so the page holds; the charts print in colour without their zoom buttons */
  h+=box('Monthly spend shape',bpChartShape(i),118,String(bpChartLegend()).replace(/class="t-faint-sm"/g,'style="font-size:9px;color:#777"'))+box('Step timeline',bpChartLanes(i),84)+box('How the lifetime total builds',bpChartWaterfall(i),128)+box('Cumulative cost \u2014 lifetime, including ongoing sustainment',bpChartCum(i),118);
  if(opts.noDevPhases)h+='<table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:4px"><tr><td style="width:45%;vertical-align:top;padding:0 8px 0 0">'+rollout+'</td><td style="width:55%;vertical-align:top;padding:0 0 0 8px;border-left:1px solid #ddd">'+sus+'</td></tr></table>'; /* 17 Sep 2026 (Paul's ruling): where the development card already lists the phases, the budget page shows rollout and sustainment only */
  else h+='<table style="width:100%;border-collapse:separate;border-spacing:0;margin-top:4px"><tr><td style="width:36%;vertical-align:top;padding:0 8px 0 0">'+left+'</td><td style="width:30%;vertical-align:top;padding:0 8px;border-left:1px solid #ddd">'+rollout+'</td><td style="width:34%;vertical-align:top;padding:0 0 0 8px;border-left:1px solid #ddd">'+sus+'</td></tr></table>'; /* the three tables side by side, so the page closes up */
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 113 — Add the function that assembles one project's pages for the Exploration Portfolio document: the Overview card at Summary; at Full the Overview, Analyses, and Position on one page and the Budget on the next.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projBudgetPage` ends, after its closing `}`.

**Code:**

```js
function projectCardPages(i,depth,lead){var full=(depth==='full');var keepWith=function(head,card){return head?'<div style="break-inside:avoid;page-break-inside:avoid">'+head+card+'</div>':card}; /* a heading and its first card are one block */
  if(!full)return keepWith(lead,projOverviewCard(i,false));
  var page1='<div style="break-before:page;page-break-before:always">'+keepWith(lead,projOverviewCard(i,true))+projAnalysesCard(i)+projPositionBlock(i);
  if(!bpHasAny(i))return page1+'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div></div>'; /* 17 Sep 2026 (Paul's ruling): no empty budget page \u2014 a line under the portfolio position instead */
  return page1+'</div><div style="break-before:page;page-break-before:always">'+projBudgetPage(i)+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 114 — Add the function that assembles the Exploration Portfolio's projects under their verdict groups, each heading bound to its first card.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projectCardPages` ends, after its closing `}`.

**Code:**

```js
function projectCardGroups(groups,depth,docHead){var out='',first=true;groups.forEach(function(g){g.list.forEach(function(r,k){var lead=(first?(docHead||''):'')+(k===0?erHead(g.name,g.list.length+' project'+(g.list.length===1?'':'s')):'');out+=projectCardPages(r.i,depth,lead);first=false})});return depth==='full'?out:'<div style="break-before:page;page-break-before:always">'+out+'</div>'} /* the document's own heading rides on the first project's page; at Summary the cards flow on a page of their own */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 115 — Add the constant holding the colours of a program's development status words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projectCardGroups` ends, after its closing `}`.

**Code:**

```js
/* ══ THE LATER STAGES ON PAPER (17 Sep 2026, Paul's ruling: the signed-off Exploration form applied to the remaining registers). Each program's stage card mirrors its page's read-only cards — the development brief and track, the review decision, the operations record — with the status or health coloured as the page colours it. Full adds the Exploration pages: overview, analyses, and position, then the budget where there is a plan ══ */
var STATUS_COLORS={complete:'#1B6B5A',running:'#2D5A8E',alive:'#2D5A8E',killed:'#9B2D3F',dead:'#9B2D3F',paused:'#8B5E3C',dormant:'#8B5E3C'};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 116 — Add the constant holding the colours of an operational project's health words.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `STATUS_COLORS` ends.

**Code:**

```js
var HEALTH_COLORS={green:'#1B6B5A',amber:'#D4A017',red:'#9B2D3F'};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 117 — Add the function that draws a program's name bar for paper, with its development status or its health in colour and its score.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `HEALTH_COLORS` ends.

**Code:**

```js
function projStageBar(i,kind){var d=(data.ideas||[])[i]||{},tr=(data.tracking||{})[i]||{},ops=(data.opsData||{})[i]||{};var sc=triageScore(i);var right='';
  if(kind==='ops'){var killed=tr.status==='killed';var hw=killed?'Killed':(ops.health?lyCap(ops.health):'Health not yet reported');right='<span style="color:'+(killed?'#9B2D3F':(HEALTH_COLORS[ops.health]||'#666'))+';font-weight:700">'+hw+'</span>'}
  else{right='<span style="color:'+(STATUS_COLORS[tr.status]||'#666')+';font-weight:700">'+(tr.status?lyCap(tr.status):'Not yet started')+'</span>'}
  return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 14px;border-bottom:1px solid #ddd;background:#f4f4f4;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div><span style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111">'+esc(d.name||'Unnamed project')+'</span>'+(d.dept?'<span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(d.dept)+'</span>':'')+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:#111;white-space:nowrap">'+right+(sc?' \u00b7 '+sc+' / 50':'')+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 118 — Add the function that lays a card's fields out in two columns for paper.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projStageBar` ends, after its closing `}`.

**Code:**

```js
function pcGrid(F){var cells=F.map(function(f){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</td>'});var rows='';for(var k=0;k<cells.length;k+=2)rows+='<tr>'+cells[k]+(cells[k+1]||'<td></td>')+'</tr>';return '<table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 119 — Add the function that draws a small heading inside a printed card.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `pcGrid` ends, after its closing `}`.

**Code:**

```js
function pcSub(t){return '<div style="font-family:var(--serif,Georgia,serif);font-size:13px;font-weight:700;color:#111;padding:8px 14px 0">'+t+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 120 — Add the function that draws a program's Development card for paper: its objectives and deliverables, its budget, each development phase with owner, months, budget, description, success metrics, exit gate, and gate taken, then its track.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `pcSub` ends, after its closing `}`.

**Code:**

```js
function projDevCard(i,withPosition){var p=(data.projects||{})[i]||{},tr=(data.tracking||{})[i]||{},pb=(data.portfolio||{})[i]||{};var phases=progOrdered(i);
  var money=bpHasDev(i)?'Development budget <b>'+fmtMoney(bpDevTotal(i))+'</b>'+(bpHasRoll(i)?' \u00b7 Rollout <b>'+fmtMoney(bpRollTotal(i))+'</b>':'')+(bpSusSteady(i)?' \u00b7 Sustainment <b>'+fmtMoney(bpSusSteady(i))+'</b>/yr':''):'';
  var ph=phases.length?phases.map(function(r,ix){var sp=bpStepSpan(r);return '<div style="padding:6px 14px 6px;border-top:1px solid #eee;break-inside:avoid;page-break-inside:avoid"><div style="font-size:12px;color:#111"><b>Phase '+(ix+1)+' \u2014 '+esc(r.name||'Unnamed')+'</b>'+(r.powner?' <span style="color:#555">\u00b7 '+esc(r.powner)+'</span>':'')+(sp?' <span style="color:#555">\u00b7 months '+sp[0]+'\u2013'+sp[1]+'</span>':'')+(bpStepMoney(r)?' <span style="color:#555">\u00b7 '+fmtMoney(bpStepMoney(r))+'</span>':'')+'</div>'+(r.desc?'<div style="font-size:11px;color:#555;line-height:1.35;margin-top:1px">'+esc(r.desc)+'</div>':'')+'<div style="font-size:11px;line-height:1.35;margin-top:3px"><span style="color:#666">Success metrics:</span> '+(r.pmetric?esc(r.pmetric):'\u2014')+' &nbsp;<span style="color:#666">Exit gate:</span> '+(r.pexit?esc(r.pexit):'\u2014')+(r.gateDec?' &nbsp;<span style="color:#666">Gate taken:</span> <b>'+esc(r.gateDec)+'</b>'+(r.gateAt?' <span style="color:#666">'+fmtDate(r.gateAt)+'</span>':''):'')+'</div></div>'}).join(''):'<div style="padding:4px 14px 6px;font-size:11.5px;color:#888;font-style:italic">No development phases recorded.</div>';
  var pos=withPosition?'<div style="padding:6px 14px 8px;border-top:1px solid #eee;font-size:11.5px;color:#111"><span style="color:#666">Portfolio position:</span> '+((pb.horizon||pb.risk||pb.reward)?[IDEA_HORIZON_LABELS[pb.horizon]||(pb.horizon?lyCap(pb.horizon):''),pb.risk?lyCap(pb.risk)+' risk':'',pb.reward?lyCap(pb.reward)+' reward':''].filter(Boolean).join(' \u00b7 '):'not yet placed')+'</div>':'';
  var keep='break-inside:avoid;page-break-inside:avoid';
  return '<div class="er-block" style="'+keep+';border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden"><div style="'+keep+'">'+projStageBar(i,'dev')+pcSub('Development program')+pcGrid([['Objectives',p.objectives],['Deliverables',p.deliverables]])+(money?'<div style="padding:2px 14px 8px;font-size:11.5px;color:#111">'+money+'</div>':'')+'<div style="'+PC_LBL+';padding:4px 14px 2px">Program phases</div></div>'+ph+'<div style="'+keep+'">'+pcSub('Development track')+pcGrid([['Results to date',tr.results],['Infrastructure learnings',tr.infraLearnings||tr.learnings],['What\u2019s breaking / working',tr.breakWork]])+pos+'<div style="height:6px"></div></div></div>'} /* 17 Sep 2026 (Paul's finding: headings stranded): the card flows across pages like a long record \u2014 the bar with the program, each phase, and the track each stay whole, so the headings above are followed by the first program */ /* 17 Sep 2026 (Paul's ruling): the development card carries what the module records \u2014 Step 3.4\u2019s program (objectives, deliverables, the budget from the plan, each phase with its owner, months, budget, description, success metrics, exit gate criteria, and the gate taken) and the Development Portfolio page\u2019s track (status, results to date, learnings, what\u2019s breaking / working). The experiment brief it replaced was a retired design that only the seed still filled */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 121 — Add the function that draws a program's Portfolio Review decision for paper: Buy, Hold, or Sell in colour, with its rationale.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projDevCard` ends, after its closing `}`.

**Code:**

```js
function projReviewBlock(i){var it=((data.review||{}).items||{})[i]||{};var col={buy:'#1B6B5A',hold:'#8B5E3C',sell:'#9B2D3F'}[it.decision]||'#888';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;padding:9px 14px 10px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><div style="font-family:var(--serif,Georgia,serif);font-size:14px;font-weight:700;color:#111">Portfolio Review</div><div style="font-family:var(--mono,monospace);font-size:12px;font-weight:700;color:'+col+'">'+(it.decision?lyCap(it.decision):'Not yet reviewed')+'</div></div>'+(it.note?pcText(it.note):'')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 122 — Add the function that draws an operational project's card for paper: owner and launch date in the top corners, rollout costs and annual sustainment cost in the bottom corners, then success metrics, performance, and notes.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projReviewBlock` ends, after its closing `}`.

**Code:**

```js
function projOpsCard(i){var ops=(data.opsData||{})[i]||{},p=(data.projects||{})[i]||{};var roll=bpHasRoll(i)?fmtMoney(bpRollTotal(i)):(ops.rolloutCost||p.rolloutCost||''),sus=bpSusSteady(i)?fmtMoney(bpSusSteady(i))+'/yr':(ops.runningCost||p.runningCost||'');
  var cell=function(l,v,right){return '<td style="width:50%;vertical-align:top;padding:7px 14px 8px;'+(right?'text-align:right':'')+'"><div style="'+PC_LBL+'">'+l+'</div>'+pcText(v)+'</td>'};
  var corners='<table style="width:100%;border-collapse:collapse"><tbody><tr>'+cell('Owner',ops.owner||((progOrdered(i)[0]||{}).powner)||'')+cell('Launch date',ops.launchDate?lyDate(ops.launchDate):'',true)+'</tr><tr>'+cell('Rollout costs',roll)+cell('Annual sustainment cost',sus,true)+'</tr></tbody></table>';
  var rest=[['Success metrics',p.metrics],['Performance vs. success metric',ops.performance],['Ongoing notes',ops.notes]].map(function(f){return '<div style="padding:6px 14px 8px;border-top:1px solid #eee"><div style="'+PC_LBL+'">'+f[0]+'</div>'+pcText(f[1])+'</div>'}).join('');
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden">'+projStageBar(i,'ops')+corners+rest+'<div style="height:6px"></div></div>'} /* 17 Sep 2026 (Paul's ruling): owner top left, launch date top right, rollout costs bottom left, annual sustainment cost bottom right (from the budget plan), the rest below */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 123 — Add the function that assembles one program's pages for the Development and Operational documents: the stage card at Summary; at Full the stage card, the project pages, and the budget page where there is a plan.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projOpsCard` ends, after its closing `}`.

**Code:**

```js
function projectPagesFor(i,depth,lead,stage){var full=(depth==='full');var keepWith=function(head,card){return head?'<div style="break-inside:avoid;page-break-inside:avoid">'+head+card+'</div>':card}; /* a heading and its first card are one block */
  if(stage==='ops'){var opsCard=projOpsCard(i);if(!full)return keepWith(lead,opsCard);
    var pageP='<div style="break-before:page;page-break-before:always">'+projOverviewCard(i,true)+projAnalysesCard(i)+projPositionBlock(i)+(bpHasAny(i)?'':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div>')+'</div>'+(bpHasAny(i)?'<div style="break-before:page;page-break-before:always">'+projBudgetPage(i,{noDevPhases:true})+'</div>':'');
    return '<div style="break-before:page;page-break-before:always">'+keepWith(lead,opsCard)+'</div>'+pageP+'<div style="break-before:page;page-break-before:always">'+projDevCard(i,false)+'</div>'} /* 17 Sep 2026 (Paul's ruling): Operational Full is the operations page, then the project pages, then the development page */
  var devCard=projDevCard(i,!full)+(stage==='updated'?projReviewBlock(i):'');
  if(!full)return keepWith(lead,devCard);
  var pageB='<div style="break-before:page;page-break-before:always">'+projOverviewCard(i,true)+projAnalysesCard(i)+projPositionBlock(i)+(bpHasAny(i)?'':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 12px">No budget plan yet.</div>')+'</div>';
  return '<div style="break-before:page;page-break-before:always">'+keepWith(lead,devCard)+'</div>'+pageB+(bpHasAny(i)?'<div style="break-before:page;page-break-before:always">'+projBudgetPage(i,{noDevPhases:true})+'</div>':'')}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 124 — Add the function that assembles the Development and Operational documents' programs, with or without group headings.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projectPagesFor` ends, after its closing `}`.

**Code:**

```js
function projectStageGroups(groups,depth,docHead,stage,noHeads){var out='',first=true;groups.forEach(function(g){g.list.forEach(function(r,k){var lead=noHeads?'':(first?(docHead||''):'')+(k===0?erHead(g.name,g.list.length+' program'+(g.list.length===1?'':'s')):'');out+=projectPagesFor(r.i,depth,lead,stage);first=false})});return depth==='full'?out:'<div style="break-before:page;page-break-before:always">'+out+'</div>'} /* 17 Sep 2026 (Paul's ruling, restated): cards stay whole; a heading rides its first card as one block (projectPagesFor); only a card longer than a page can spill, and that cannot be helped */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 125 — Add the constant holding the colours of the Buy, Hold, and Sell decisions.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `projectStageGroups` ends, after its closing `}`.

**Code:**

```js
/* ══ THE PORTFOLIO REVIEW (17 Sep 2026, Paul's ruling): Ignite's third output, distilled from Step 4.4 — the Buy, Hold, or Sell call on every live initiative with its reasons, the capital and the balance after the decisions, the five learnings, and the history of closed cycles. One version; the page is a read-only report of the same ══ */
var RV_COLORS={buy:'#1B6B5A',hold:'#8B5E3C',sell:'#9B2D3F'};var RV_WORDS={buy:'Buy',hold:'Hold',sell:'Sell'};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 126 — Add the function that gathers the quarterly review's content: every live initiative with its decision and reason, the counts, the year's capital, the live balance, the five learnings, and the closed cycles.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RV_COLORS` ends.

**Code:**

```js
function portfolioReviewModel(){var ideas=data.ideas||[],exSel=data.expSelected||[],trk=data.tracking||{},rev=data.review||{},launched=data.launched||[];
  var items=exSel.filter(function(i){return !isArchived(i)}).concat(launched.filter(function(i){return !isArchived(i)&&exSel.indexOf(i)<0})).concat((data.selected||[]).filter(function(i){return !isArchived(i)&&exSel.indexOf(i)<0&&launched.indexOf(i)<0&&(data.projects||{})[i]&&(data.projects||{})[i].viable===true})); /* the review's own set, as renderReviewSurface draws it */
  var stage=function(i){return launched.indexOf(i)>=0?'Operational':exSel.indexOf(i)>=0?'In development':'Exploration'};
  var recs=items.map(function(i){var ri=(rev.items||{})[i]||{};var c=projCosts(i);return {i:i,name:(ideas[i]||{}).name||'',dept:(ideas[i]||{}).dept||'',stage:stage(i),decision:ri.decision||'',rationale:ri.rationale||'',start:c.start,run:c.run,killed:(trk[i]||{}).status==='killed'}});
  var by=function(d){return recs.filter(function(r){return r.decision===d})};var groups=[{name:'Buy',key:'buy',list:by('buy')},{name:'Hold',key:'hold',list:by('hold')},{name:'Sell',key:'sell',list:by('sell')},{name:'Not yet decided',key:'',list:recs.filter(function(r){return !r.decision})}].filter(function(g){return g.list.length});
  var yN=1,yr=null;try{var eff=new Date(new Date().getFullYear(),new Date().getMonth()+1,1);var ps=(data.capital||{}).periodStart?new Date((data.capital||{}).periodStart):null;yN=ps?Math.max(1,Math.min(envYearsOf(),Math.floor(((eff.getFullYear()*12+eff.getMonth())-(ps.getFullYear()*12+ps.getMonth()))/12)+1)):1;var yts=orgYearTotals();yr=yts&&yts[yN-1]?yts[yN-1]:null}catch(e){yr=null}
  var learn=[['New opportunities',rev.newOpportunities],['Balance assessment',rev.balance],['What worked?',rev.worked],['What didn\u2019t?',rev.didnt],['Changes for next cycle?',rev.nextCycle]];
  return {items:items,recs:recs,groups:groups,decided:recs.filter(function(r){return r.decision}).length,buy:by('buy').length,hold:by('hold').length,sell:by('sell').length,yN:yN,yr:yr,balItems:items.filter(function(i){return (trk[i]||{}).status!=='killed'}),learn:learn,cycles:data.reviewCycles||[],complete:!!(data.completedSteps||{})['4.4']}}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 127 — Add the function that draws one initiative's decision card for the Portfolio Review document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `portfolioReviewModel` ends, after its closing `}`.

**Code:**

```js
function rvDecisionCard(r){var col=RV_COLORS[r.decision]||'#888';
  return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-left:4px solid '+col+';border-radius:6px;margin:0 0 10px;padding:9px 14px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px"><div><span style="font-family:var(--serif,Georgia,serif);font-size:15px;font-weight:700;color:#111'+(r.killed?';text-decoration:line-through':'')+'">'+esc(r.name)+'</span><span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin-left:10px">'+esc(r.stage)+(r.dept?' \u00b7 '+esc(r.dept):'')+'</span></div><div style="font-family:var(--mono,monospace);font-size:11px;white-space:nowrap"><span style="color:'+col+';font-weight:700">'+(RV_WORDS[r.decision]||'Not yet decided')+'</span><span style="color:#555"> \u00b7 start '+fmtMoney(r.start)+' \u00b7 run '+fmtMoney(r.run)+'/yr</span></div></div>'+(r.rationale?'<div style="margin-top:6px;font-size:12.5px;line-height:1.5;color:#111;padding:8px 12px;border-left:3px solid #07 6D9E55;background:rgba(7,109,158,.06);white-space:pre-line;-webkit-print-color-adjust:exact;print-color-adjust:exact">'.replace('#07 6D9E55','#076D9E55')+esc(r.rationale)+'</div>':'<div style="margin-top:6px;font-size:12px;color:#888;font-style:italic">No rationale recorded.</div>')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 128 — Add the function that draws the printed Portfolio Review document: At a Glance, Capital After the Decisions, The Decisions grouped by call, the Portfolio Balance, the Portfolio Learnings, and the Review History.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rvDecisionCard` ends, after its closing `}`.

**Code:**

```js
function portfolioReviewDoc(){var M=portfolioReviewModel();
  var h=printDocCover('Portfolio Review','The first quarterly review of the live portfolio: the Buy, Hold, or Sell call on every initiative with its reasons, the portfolio\u2019s balance and capital after the decisions, and what the quarter taught.',M.decided+' of '+M.items.length+' decided');
  h+=erBlock(erHead('At a Glance',M.complete?'':M.decided+' of '+M.items.length+' initiatives decided \u2014 the review is still open')+erFigRow([{v:M.items.length,l:'Initiatives reviewed'},{v:M.buy,l:'Buy',col:'#1B6B5A',vcol:'#1B6B5A'},{v:M.hold,l:'Hold',col:'#8B5E3C',vcol:'#8B5E3C'},{v:M.sell,l:'Sell',col:'#9B2D3F',vcol:'#9B2D3F'}]));
  if(M.yr)h+=erBlock(erHead('Capital After the Decisions','Year '+M.yN+' of the planning window, as the calendar stands')+erFigRow([{v:fmtMoney(M.yr.total),l:'Committed, Year '+M.yN},{v:fmtMoney(M.yr.budget),l:'Budget, Year '+M.yN},{v:fmtMoney(M.yr.headroom),l:'Headroom',col:M.yr.headroom<0?'#9B2D3F':'#1B6B5A',vcol:M.yr.headroom<0?'#9B2D3F':'#1B6B5A'}]));
  h+=erHeadLg('The Decisions','')+M.groups.map(function(g){var cards=g.list.map(rvDecisionCard);return '<div style="break-inside:avoid;page-break-inside:avoid">'+erHead(g.name,g.list.length+' initiative'+(g.list.length===1?'':'s'))+(cards[0]||'')+'</div>'+cards.slice(1).join('')}).join(''); /* 17 Sep 2026 (Paul's rulings): the decisions follow the capital on the same page; a group\u2019s heading and its first initiative are one block, never split */
  h+=ideaBalanceBlock(M.balItems,'rb44','Portfolio Balance After the Review');
  h+=erBlock(erHead('Portfolio Learnings','What the quarter taught')+M.learn.map(function(l){var t=lyText(l[1]);return '<div style="margin:0 0 12px"><div style="'+PC_LBL+'">'+l[0]+'</div><div style="font-size:13px;line-height:1.55;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'}).join('')+'<div style="height:8px"></div>'); /* 17 Sep 2026 (Paul's ruling): plain labelled text, not the quoted form */
  if(M.cycles.length){var th=function(t){return '<th style="text-align:left;padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee">'+v+'</td>'};
    h+=erBlock(erHead('Review History',M.cycles.length+' closed cycle'+(M.cycles.length===1?'':'s'))+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+th('Closed')+th('Buy')+th('Hold')+th('Sell')+'</tr></thead><tbody>'+M.cycles.slice().reverse().map(function(cy){var it=(cy.review||{}).items||{};var n=function(d){return Object.keys(it).filter(function(k){return it[k].decision===d}).length};return '<tr>'+td(fmtDate(cy.at))+td(n('buy'))+td(n('hold'))+td(n('sell'))+'</tr>'}).join('')+'</tbody></table>')}
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 129 — Add the function that draws the Portfolio Review output page: a read-only report of the quarterly review with its Save as PDF button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `portfolioReviewDoc` ends, after its closing `}`.

**Code:**

```js
function renderOutPortfolioReview(){var M=portfolioReviewModel();
  var fig=function(v,l,c){return '<div class="t-center" style="flex:1;min-width:110px"><div class="score-num-md" style="font-size:26px'+(c?';color:'+c:'')+'">'+v+'</div><div class="fs-13" style="margin-top:3px">'+l+'</div></div>'};
  var h='<div class="flx-between-top-mb"><div>'+badge('Phase 4 Output','#9B2D3F')+'<h2 class="h-big">Portfolio Review</h2><p class="t-stone-sm">The first quarterly review, distilled from Step 4.4 \u2014 read-only; the decisions are taken there.</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=card('<div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(M.items.length,'Initiatives reviewed')+fig(M.buy,'Buy','#1B6B5A')+fig(M.hold,'Hold','#8B5E3C')+fig(M.sell,'Sell','#9B2D3F')+'</div>'+(M.complete?'':'<p class="t-faint-sm" style="margin:10px 0 0">'+M.decided+' of '+M.items.length+' decided \u2014 the review is still open at Step 4.4.</p>'),'margin-bottom:16px');
  if(M.yr)h+=card('<h3 class="h-sub-md">Capital After the Decisions</h3><div style="display:flex;gap:18px;flex-wrap:wrap">'+fig(fmtMoney(M.yr.total),'Committed, Year '+M.yN)+fig(fmtMoney(M.yr.budget),'Budget, Year '+M.yN)+fig(fmtMoney(M.yr.headroom),'Headroom',M.yr.headroom<0?'#9B2D3F':'#1B6B5A')+'</div>','margin-bottom:16px');
  M.groups.forEach(function(g){h+='<h3 class="h-sub-lg" style="margin:6px 0 10px">'+g.name+' <span class="t-faint-sm" style="font-weight:400">('+g.list.length+')</span></h3>'+g.list.map(function(r){var col=RV_COLORS[r.decision]||'rgba(var(--faint-rgb),.5)';return card('<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap"><div><h4 class="h-card" style="margin:0;display:inline'+(r.killed?';text-decoration:line-through;color:#9B2D3F':'')+'">'+esc(r.name)+'</h4> '+badge(r.stage,r.stage==='Operational'?'#1B6B5A':r.stage==='In development'?'#2D5A8E':'rgba(var(--faint-rgb),.5)')+'</div><span class="t-faint-sm">start '+fmtMoney(r.start)+' \u00b7 run '+fmtMoney(r.run)+'/yr</span></div>'+(r.rationale?'<p class="fs-13" style="margin:8px 0 0;color:var(--text-muted);line-height:1.55">'+esc(r.rationale)+'</p>':'<p class="t-faint-sm" style="margin:8px 0 0">No rationale recorded.</p>'),'margin-bottom:10px;border-left:4px solid '+col)}).join('')});
  h+=card('<h3 class="h-sub-lg">Portfolio Learnings</h3>'+M.learn.map(function(l){return '<div style="margin:0 0 12px"><div class="u-b25d981" style="margin-bottom:3px">'+l[0]+'</div><div class="fs-13" style="color:var(--text-muted);line-height:1.55;white-space:pre-line">'+(l[1]?esc(l[1]):'<span class="t-faint">Not yet written</span>')+'</div></div>'}).join(''),'margin-bottom:16px');
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 130 — Add the function that draws the Quarterly Review page reached from the dashboard: the shared review surface under its own heading, with a Save as PDF button that prints the Portfolio Review.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderOutPortfolioReview` ends, after its closing `}`.

**Code:**

```js
/* ══ THE LIVE PAGES FROM THE DASHBOARD (17 Sep 2026, Paul's ruling): running a review or opening a portfolio from the dashboard never returns to a step page. The Quarterly Review page mounts the shared review surface — one state with Step 4.4 — under its own heading, and prints the Portfolio Review; the portfolio pages mount the same renderers as the outputs, so a change on either is the same change ══ */
function renderReviewPage(){var h='<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
  h+='<div class="mb-6" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div>'+badge('Ongoing','#6B4C8A')+'<h1 class="section-title u-967e19d">Quarterly <em>Portfolio Review</em></h1><p class="u-98b80d8">Every live initiative: Buy, Hold, or Sell, with the reason. Decisions made here are the same decisions as at Step 4.4.</p></div>'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px;margin-top:8px')+'</div>';
  h+=renderReviewSurface();
  return h+'</div></div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 131 — Add the constant mapping each portfolio output's identifier to the function that draws its page, for the live portfolio pages.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderReviewPage` ends, after its closing `}`.

**Code:**

```js
var PORTFOLIO_PAGES={'out-bluesky':function(){return renderOutBluesky()},'out-explore':function(){return renderOutExploreEnhanced()},'out-expbriefs':function(){return renderOutExpbriefsFull()},'out-oper':function(){return renderOutOperFull()}};
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 132 — Add the function that draws a live portfolio page reached from the dashboard: the same page as the output, over the same record.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PORTFOLIO_PAGES` ends.

**Code:**

```js
function renderPortfolioPage(){var id=currentStep;var fn=PORTFOLIO_PAGES[id];var h='<div class="content-area pt-110"><div class="content-inner"><div class="zoom-wrap" id="zoomWrap"'+((UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'')+'>';
  h+='<div class="mb-3">'+badge('Ongoing','#6B4C8A')+' <span class="t-faint-sm">Live portfolio \u2014 the same record as the output page, from the dashboard</span></div>';
  h+=fn?fn():card('<p class="t-faint">No portfolio at this address.</p>');
  return h+'</div></div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 133 — Add the function that gives an output's name as the sidebar shows it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderPortfolioPage` ends, after its closing `}`.

**Code:**

```js
function outcomeNameOf(id){var nm=id;PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id===id)nm=o.name})});if(id==='out-devport')nm='Development Portfolio';if(id==='out-expbriefs')nm='Development Portfolio';return nm} /* an output's name as the sidebar gives it (Part I §2); the development portfolio's two ids and the post-review portfolio spelled out */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 134 — Add the constant naming the six outputs that offer a Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `outcomeNameOf` ends, after its closing `}`.

**Code:**

```js
var DEPTHED_OUTPUTS={'out-bluesky':1,'out-explore':1,'out-expbriefs':1,'out-devport':1,'out-oper':1,'out-report':1}; /* the Portfolio Review is one document */ /* Org Readiness left the list 17 Sep 2026: one definitive version */ /* the register documents offer Summary / Full (Part I §5) */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 135 — Add the constant that maps each output to the function that builds its printed document, and the five functions that build the Blue Sky, Exploration, Development, Portfolio Review, and Operational documents.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `DEPTHED_OUTPUTS` ends.

**Code:**

```js
/* ══ THE REGISTER DOCUMENTS (16 Sep 2026): the five portfolio outputs print as registers of the idea record, each up to its own stage, grouped as its page groups. Composed for paper: a cover, a row of figures, then the register ══ */
var PRINT_DOCS={ /* 17 Sep 2026 (Paul's ruling): the Blue Sky register prints the idea record (the idea card and its ranking); the four project registers print the project record — the idea card is superseded once an idea is a project, and the record is the project card's overview, analyses, and budget, then its brief, track, review, and operations */
 'out-bluesky':function(){var st=getStages(),ideas=data.ideas||[],depth=(UI.printDepth||'summary');var all=st.bluesky;var now=all.filter(function(i){return (ideas[i]||{}).when!=='future'}),fut=all.filter(function(i){return (ideas[i]||{}).when==='future'});
   var q=function(i){return ideaQual(i).state};var ranked=now.filter(function(i){return q(i)==='pass'}).sort(function(a,b){return triageScore(b)-triageScore(a)}),partly=now.filter(function(i){return q(i)==='partial'||q(i)==='none'}),disq=now.filter(function(i){return q(i)==='disq'});
   var groups=[{name:'Ranked',list:ideaRecs(ranked)},{name:'Not yet qualified',list:ideaRecs(partly)},{name:'Did not pass qualification',list:ideaRecs(disq)},{name:'Ideas for the future',list:ideaRecs(fut)}].filter(function(g){return g.list.length});
   return printDocCover('Blue Sky Portfolio','Every idea not yet selected for exploration: the qualified ideas ranked by their Filter & Rank score, the ideas not yet qualified, the ideas that did not pass, and the ideas parked for the future.',all.length+' idea'+(all.length===1?'':'s')+' \u00b7 '+ranked.length+' ranked \u00b7 '+fut.length+' for the future')
    +erHeadLg('At a Glance','')+erFigRow([{v:all.length,l:'Ideas'},{v:ranked.length,l:'Ranked'},{v:disq.length,l:'Did not pass'},{v:fut.length,l:'For the future'}])
    +ideaBalanceBlock(now,'bluesky','Blue Sky Portfolio Balance')+'<div style="break-before:page;page-break-before:always">'+erHeadLg('The Ideas','')+lyRegister('idea',ideaRecs(ranked.concat(partly,disq,fut)),depth,IDEA_LAYER_INDEX.rank,groups)+'</div>'},
 'out-explore':function(){var st=getStages(),depth=(UI.printDepth||'summary'),pj=data.projects||{};var list=st.explore.concat(st.noGo||[]);
   var go=list.filter(function(i){return (pj[i]||{}).viable===true}),nogo=list.filter(function(i){return (pj[i]||{}).viable===false}),open=list.filter(function(i){var v=(pj[i]||{}).viable;return v!==true&&v!==false});
   var groups=[{name:'Go',list:ideaRecs(go)},{name:'Not yet decided',list:ideaRecs(open)},{name:'No-Go',list:ideaRecs(nogo)}].filter(function(g){return g.list.length});
   return printDocCover('Exploration Portfolio','The projects selected for exploration: each one\u2019s overview and verdict'+(depth==='full'?', its analyses, its portfolio position, and its budget':'')+'.',list.length+' idea'+(list.length===1?'':'s')+' \u00b7 '+go.length+' Go \u00b7 '+nogo.length+' No-Go')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'In exploration'},{v:go.length,l:'Go'},{v:open.length,l:'Not yet decided'},{v:nogo.length,l:'No-Go'}])
    +ideaBalanceBlock(list,'explore','Exploration Portfolio Balance')
    +projectCardGroups(groups,depth,erHeadLg('The Projects',''))} /* 17 Sep 2026 (Paul's ruling): the Exploration Portfolio prints its projects as cards \u2014 Summary the Overview card, every line, verdict and score on the name bar; Full two pages per project (overview, analyses, position; then the budget). No portfolio placement section in Summary */,
 'out-expbriefs':function(){var st=getStages(),depth=(UI.printDepth||'summary'),tk=data.tracking||{};var list=st.experiment;var by=function(sts){return list.filter(function(i){return sts.indexOf((tk[i]||{}).status||'')>=0})};
   var running=by(['running','alive']),complete=by(['complete']),paused=by(['paused','dormant']),killed=by(['killed','dead']),notStarted=list.filter(function(i){return !((tk[i]||{}).status)});
   var groups=[{name:'Running',list:ideaRecs(running)},{name:'Complete',list:ideaRecs(complete)},{name:'Not yet started',list:ideaRecs(notStarted)},{name:'Paused',list:ideaRecs(paused)},{name:'Killed',list:ideaRecs(killed)}].filter(function(g){return g.list.length});
   return printDocCover('Development Portfolio','The programs in development: each one\u2019s brief \u2014 owner, costs, timeline, success metric \u2014 and its track to date.',list.length+' program'+(list.length===1?'':'s')+' \u00b7 '+running.length+' running \u00b7 '+complete.length+' complete')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'Programs'},{v:running.length,l:'Running'},{v:complete.length,l:'Complete'},{v:killed.length,l:'Killed'}])
    +ideaBalanceBlock(list,'experiment','Development Portfolio Balance')
    +projectStageGroups(groups,depth,'','dev',true)} /* 17 Sep 2026 (Paul's ruling): no document heading and no group headings \u2014 every program here is in development, so the cards follow the figures on their own page */ /* 17 Sep 2026 (Paul's ruling): the Exploration form applied \u2014 each program's development card (brief and track); Full adds the overview, analyses, position, and budget pages */,
 'out-finalport':function(){return portfolioReviewDoc()}, /* 17 Sep 2026 (Paul's ruling): the Portfolio Review */
 'out-oper':function(){var st=getStages(),depth=(UI.printDepth||'summary'),ops=data.opsData||{};var list=st.operational;var byH=function(h){return list.filter(function(i){return ((ops[i]||{}).health||'')===h})};var green=byH('green'),amber=byH('amber'),red=byH('red'),none=list.filter(function(i){return !((ops[i]||{}).health)});
   var groups=[{name:'Live Projects',list:ideaRecs(list)}]; /* 17 Sep 2026 (Paul's ruling): one list, not grouped by health */
   return printDocCover('Operational Portfolio','The projects live in the business: each one\u2019s health, launch date, and performance against its success metric, with the brief and development track behind it.',list.length+' live project'+(list.length===1?'':'s')+' \u00b7 '+green.length+' green \u00b7 '+amber.length+' amber \u00b7 '+red.length+' red')
    +erHeadLg('At a Glance','')+erFigRow([{v:list.length,l:'Live projects'},{v:green.length,l:'Green',col:'#1B6B5A',vcol:'#1B6B5A'},{v:amber.length,l:'Amber',col:'#B8860B',vcol:'#B8860B'},{v:red.length,l:'Red',col:'#9B2D3F',vcol:'#9B2D3F'}])
    +ideaBalanceBlock(list,'operational','Operational Portfolio Balance')
    +projectStageGroups(groups,depth,'','ops',true)} /* 17 Sep 2026: likewise, no headings \u2014 every project here is live */ /* 17 Sep 2026: the operations card, health coloured as the page; Full adds the development card and the project pages */
};
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 136 — Add the line that registers the Development Portfolio's second identifier with the same document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PRINT_DOCS` ends.

**Code:**

```js
PRINT_DOCS['out-devport']=PRINT_DOCS['out-expbriefs']; /* the development portfolio's second id */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 137 — Add the function behind an output page's Save as PDF button. It now prints the output's own document.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
PRINT_DOCS['out-devport']=PRINT_DOCS['out-expbriefs']; /* the development portfolio's second id */
```

**Code:**

```js
function printCurrentOutput(){var id=currentStep;var fn=PRINT_DOCS[id];if(fn){printDocument(outcomeNameOf(id),fn(),'');return}UI._printing=1;var body='';try{body=renderOutcome()}finally{UI._printing=0}printPage(outcomeNameOf(id),function(){return body})} /* 16 Sep 2026: an output with a composed document prints it; one without prints its page under a cover, as the 12 Sep baseline did */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 138 — Add the function that draws the print control on an output page: the Summary / Full choice where the document offers it, then the Save as PDF button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCurrentOutput` ends, after its closing `}`.

**Code:**

```js
function outputPrintRow(id){return '<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 12px">'+(DEPTHED_OUTPUTS[id]?lyDepthCtl():'')+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>'} /* 16 Sep 2026: the family's print control on an output page — the Summary / Full choice where the document offers it, then Save as PDF */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 139 — Add the function that draws a summary statement in a box at the head of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `outputPrintRow` ends, after its closing `}`.

**Code:**

```js
/* ══ THE SINGLE-RECORD DOCUMENTS (round 3, 16 Sep 2026): the outputs that are not registers, composed for paper in the page's own words ══ */
function erStatement(text){var t=lyText(text);return '<div style="border:1px solid #ddd;border-radius:6px;padding:16px 20px;margin:0 0 22px;font-family:var(--serif,Georgia,serif);font-size:16px;line-height:1.5;white-space:pre-line;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div>'} /* a statement block: the page's summary paragraph, set in the serif */
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 140 — Add the function that draws a question and its written answer as a quoted block in a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erStatement` ends, after its closing `}`.

**Code:**

```js
/* ══ THE ASSESSMENT PROFILE BLOCKS — Governance's apBlock / apStrip (copy-pass item 8, 21 Aug 2026, ruled by Paul), ported to the Innovation Pipeline 17 Sep 2026 on his ruling that the Assessment Report's Full version present its scored questions as the Governance profile does. The frame-plus-attributed-block law: authored copy frames; user text is quoted, never woven. Governance's teal is the Pipeline's own module blue here — the head accent, #076D9E in its light value (17 Sep 2026, Paul's ruling, after a detour through the orange); each block is unsplittable ══ */
function apBlock(q,v){var t=String(v==null?'':v).trim();
return '<div style="margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 4px">'+q+'</div>'+(t?'<div style="white-space:pre-wrap;font-size:14px;line-height:1.55;padding:10px 14px;border-left:3px solid #076D9E55;background:rgba(7,109,158,.06)">'+esc(t)+'</div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 141 — Add the function that draws a question and its 1 to 5 answer as a strip of five cells in a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `apBlock` ends, after its closing `}`.

**Code:**

```js
function apStrip(q,v,lo,hi){var has=(typeof v==='number'&&v>=1&&v<=5);var cells='';for(var i=1;i<=5;i++){cells+='<div class="ap-seg'+(has&&i===v?' on':'')+'" style="flex:1;height:8px;border-radius:4px;margin:0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(has&&i===v?'#076D9E':'rgba(138,130,120,.22)')+'"></div>'}
return '<div style="margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin:0 0 6px">'+q+'</div>'+(has?'<div style="display:flex;align-items:center">'+cells+'</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-faint);margin-top:3px"><span>'+lo+'</span><span>'+hi+'</span></div>':'<div style="font-size:13px;color:var(--text-faint);font-style:italic">Not yet recorded.</div>')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 142 — Add the function that draws the printed Assessment Report: the executive summary, At a Glance, the Readiness Profile bars and radar, and at Full every scored answer in the profile's form.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `apStrip` ends, after its closing `}`.

**Code:**

```js
function assessmentReportDoc(){var p=data.purpose||{},k=data.knowledge||{},cu=data.culture||{},de=data.decisions||{},au=data.audit||[];var depth=(UI.printDepth||'summary'),full=(depth==='full');
  var cultureItems=[{k:'uncertainty',l:'Uncertainty'},{k:'aiLegitimacy',l:'AI legitimacy'},{k:'newProposals',l:'New proposals'},{k:'incentives',l:'Incentives'},{k:'frontline',l:'Frontline'},{k:'overall',l:'Overall'}];var cs=cultureItems.map(function(x){return typeof cu[x.k]==='number'?cu[x.k]:0}).reduce(function(a,b){return a+b},0);
  var gaps=Object.keys(de).filter(function(q){return de[q]&&de[q].gap}).length;var appetite=(cu.uncertainty||0)<=2?'Averse':(cu.uncertainty||0)<=3?'Moderate':'Tolerant';
  var summary='An organization with '+(k.usage==='none'||k.usage==='basic'?'limited':'moderate')+' AI capabilities and '+(cs<=12?'low':cs<=20?'moderate':'strong')+' cultural readiness ('+cs+' of 30), with '+gaps+' decision-rights gap'+(gaps===1?'':'s')+'.';
  var qs=[{k:'q1',l:'Approve experiments'},{k:'q2',l:'Advance projects'},{k:'q3',l:'Reallocate budget'},{k:'q4',l:'Kill projects'},{k:'q5',l:'Cross-functional resources'}];
  var h=printDocCover('Assessment Report','Where the organization stands before the pipeline begins: its purpose and frictions, its AI knowledge, its culture, its innovation record, and who holds each decision right.'+(full?' Every scored answer of the Assessment Battery follows.':''),'Culture '+cs+' / 30 \u00b7 '+gaps+' decision-rights gap'+(gaps===1?'':'s'));
  h+=erBlock(erHead('Executive Summary','')+erStatement(summary));
  h+=erBlock(erHead('At a Glance','')+erFigRow([{v:cs+' / 30',l:'Culture score'},{v:appetite,l:'Risk appetite'},{v:gaps,l:'Decision gaps'}]));
  var dims=getAssessmentScores();
  h+=erBarBlock('Readiness Profile','Scored across the five Phase 1 dimensions',dims.map(function(d){return {l:d.name,v:d.score,max:5}}));
  h+='<style>'+PIPE_RADAR_CSS+'</style>'+erBlock('<div style="border:1px solid #ddd;border-radius:6px;padding:10px 16px 4px;margin:-8px auto 22px;max-width:460px">'+vizRadarLarge(dims)+'</div>'); /* 17 Sep 2026 (Paul's ruling): the radar from the foot of the output page, beneath its bars */
  if(full)h+=erBlock(erHead('Purpose and Direction','Every answer of section 1.1, in the organization\u2019s own words')+apBlock('Mission',p.mission)+apBlock('Values',p.values)+apBlock('Short-term targets',p.shortTerm)+apBlock('Medium-term targets',p.mediumTerm)+apBlock('Long-term targets',p.longTerm)+apBlock('Key goals',p.goals)+apBlock('Friction points',p.frictions)+'<div style="height:8px"></div>'); /* the block rule: a section that would be cut starts a new page */
  else h+=erSection('Purpose and Direction',lyRow('Mission',p.mission)+lyRow('Friction points',p.frictions));
  if(full){
    h+=erBlock(erHead('AI Knowledge Base','The four answers of section 1.2')+apBlock('Current usage',k.usage?lyCap(k.usage):'')+apStrip('Leadership awareness',k.awareness,'Unaware','Very aware')+apBlock('Technical resources',k.resources?lyCap(k.resources):'')+apBlock('Learning processes',k.learning?lyCap(k.learning):'')+'<div style="height:8px"></div>');
    var CU_ENDS={uncertainty:['Uncomfortable','Comfortable'],aiLegitimacy:['Stigma','Accepted'],newProposals:['Shut down','Support'],incentives:['Punish','Reward'],frontline:['None','Strong'],overall:['Stagnant','Innovative']}; /* the endpoints as the step\u2019s Likert scales give them */
    h+=erBlock(erHead('Risk and Culture','The six answers of section 1.3 \u2014 together '+cs+' of 30')+cultureItems.map(function(x){return apStrip(x.l,cu[x.k],CU_ENDS[x.k][0],CU_ENDS[x.k][1])}).join('')+'<div style="height:8px"></div>');
    h+=erBlock(erHead('AI Innovation Audit',au.length?au.length+' past initiative'+(au.length===1?'':'s')+' \u2014 section 1.4':'Section 1.4')+(au.length?'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+['Initiative','Status'].map(function(t){return '<th style="text-align:left;padding:6px 10px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'}).join('')+'</tr></thead><tbody>'+au.map(function(a){return '<tr>'+[a.name,a.status?lyCap(a.status):''].map(function(v,ci){var t=lyText(v);return '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(ci===0?';font-weight:600':'')+'">'+esc(t?lyCap(t):'Not recorded')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Past initiatives','')+'</tbody></table>'));
  }
  if(full){var QT={q1:'Who can authorize a new experiment to start, including its budget?',q2:'Who decides that a successful experiment moves into serious development?',q3:'Who can move money between projects mid-year without a new budget round?',q4:'Who can stop a project that is not working?',q5:'Who can commit people from more than one function to the same initiative?'}; /* the step\u2019s own question texts */
    h+=erBlock(erHead('Decision Rights','The five answers of section 1.5'+(gaps?' \u2014 '+gaps+' gap'+(gaps===1?'':'s')+' noted':''))+qs.map(function(q){var dq=de[q.k]||{};return apBlock(QT[q.k],dq.who)}).join('')+apBlock('Recorded decision-rights gaps',qs.filter(function(q){return (de[q.k]||{}).gap}).map(function(q){return q.l+' \u2014 '+de[q.k].gap}).join('\n')))}
  else h+=erSection('Decision Rights',qs.map(function(q){var d=de[q.k]||{};return lyRowHtml(q.l,(d.who||'')+(d.gap?'<br>Gap: '+d.gap:''))}).join(''),gaps?gaps+' gap'+(gaps===1?'':'s')+' noted':'');
  return h} /* 17 Sep 2026 (Paul's ruling): Summary as before plus the radar; Full prints every scored answer of the Assessment Battery \u2014 the seven purpose fields, the four knowledge answers, the six culture answers as bars, the innovation audit as a table \u2014 the Governance assessment document's form */
```

**Nothing to check yet.** This change becomes visible at Step 149.

---

### Step 143 — Add the function that draws the printed Org Readiness document: the summary, At a Glance, the readiness checklist, then Pipeline Owner, Embedded Leads, Engaged Senior Leaders, Realigned Incentives, and Innovation Rhythm.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `assessmentReportDoc` ends, after its closing `}`.

**Code:**

```js
function orgReadinessDoc(){var M=orgReadinessModel();var ow=M.ow,inc=M.inc;
  var h=printDocCover('Org Readiness','How the organization is set up to run the pipeline: who owns it, who leads it inside the functions, who backs it, how incentives are changing, and the rhythm the work keeps.',M.done+' of '+M.chk.length+' readiness checks complete');
  h+=erBlock(erHead('Summary','')+erStatement(M.summary));
  h+=erBlock(erHead('At a Glance','')+erFigRow([{v:M.leads.length,l:'Embedded leads'},{v:M.metrics.length,l:'Innovation metrics'},{v:M.done+' / '+M.chk.length,l:'Readiness checks'}]));
  var tick=function(d){return '<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;text-align:center;font-size:11px;font-weight:700;'+(d?'background:#111;color:#fff':'border:1.5px solid #999;color:#999')+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'+(d?'\u2713':'')+'</span>'};
  h+=erSection('Organizational Readiness',M.chk.map(function(c){return '<tr><td style="width:30px;padding:7px 0 7px 2px;border-bottom:1px solid #eee;vertical-align:top">'+tick(c.d)+'</td><td style="padding:6px 10px 7px 4px;border-bottom:1px solid #eee;vertical-align:top"><div style="font-size:12.5px;font-weight:600;color:'+(c.d?'#111':'#555')+'">'+esc(c.l)+'</div><div style="font-size:11.5px;line-height:1.45;color:#555;margin-top:2px">'+esc(c.ev)+'</div></td></tr>'}).join(''),M.done+' of '+M.chk.length+' complete'); /* 17 Sep 2026 (Paul's ruling): a checklist on paper too \u2014 a tick per check met, the record beneath each, the count in the sub-line */
  var tbl=function(rows,cols){return '<table style="width:100%;border-collapse:collapse;margin:0 0 14px"><thead><tr>'+cols.map(function(t){return '<th style="text-align:left;padding:6px 10px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(v,ci){var t=lyText(v);return '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12.5px;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(ci===0?';font-weight:600':'')+'">'+esc(t?lyCap(t):'Not recorded')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>'};
  h+=erBlock(erHead('Pipeline Owner','')+apBlock('Name',ow.ownerName)+apBlock('Role',ow.ownerRole)+apBlock('Authority',ow.authority)+'<div style="height:8px"></div>');
  h+=erBlock(erHead('Embedded Leads',M.leads.length?M.leads.length+' lead'+(M.leads.length===1?'':'s')+' \u2014 one per department that runs experiments':'')+(M.leads.length?tbl(M.leads.map(function(l){return [l.name,l.dept]}),['Lead','Department']):'<div style="font-size:13px;color:#888;font-style:italic;margin:0 0 14px">Not yet recorded.</div>'));
  h+=erBlock(erHead('Engaged Senior Leaders',M.seniors.length?M.seniors.length+' executive'+(M.seniors.length===1?'':'s')+' who visibly back the pipeline':'')+(M.seniors.length?tbl(M.seniors.map(function(l){return [l.name,l.role]}),['Executive','Position']):'<div style="font-size:13px;color:#888;font-style:italic;margin:0 0 14px">Not yet recorded.</div>'));
  h+=erBlock(erHead('Realigned Incentives','')+apBlock('Current structure',inc.current)+apBlock('Proposed changes',inc.changes)+apBlock('Innovation metrics',M.metrics.join('\n'))+'<div style="height:8px"></div>');
  h+=erBlock(erHead('Innovation Rhythm','')+apBlock('Session',M.session)+apBlock('Attendees',M.att.join('\n'))+apBlock('Standing agenda',M.agenda.join('\n'))+'<div style="height:8px"></div>');
  return h} /* 17 Sep 2026 (Paul's ruling): one definitive version \u2014 the Full of the day before, which added little and was not overwhelming; no Summary / Full. The checklist is a checklist on paper; the step numbers and the meta phrase are gone */
```

**Nothing to check yet.** This change becomes visible at Step 144.

---

### Step 144 — Add the function that gathers Org Readiness for the page and the document: the three steps' record, the summary sentence, and the seven checks with the record behind each.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgReadinessDoc` ends, after its closing `}`.

**Code:**

```js
/* ══ ORG READINESS (17 Sep 2026, Paul's ruling): one model for the page and the document. The three steps' record — Ownership & Structure (owner, embedded leads, engaged senior leaders), Realign Incentives (current structure, proposed changes, metrics), Innovation Rhythm (session, attendees, agenda) — and the seven readiness checks, each carrying the record that satisfies it or what is missing. Summary is the checks and the record's main facts; Full is every field in the organization's own words and the checks with their evidence ══ */
function orgReadinessModel(){var ow=data.ownership||{},inc=data.incentives||{},rh=data.rhythm||{};var leads=(ow.leads||[]).filter(function(l){return l&&(l.name||l.dept)}),seniors=(ow.seniors||[]).filter(function(l){return l&&(l.name||l.role)});var att=rhAttNames(),agenda=rhAgList(),metrics=(inc.metrics||[]).filter(Boolean);var deep=!!(data.completedSteps||{})['2.4'];
  var session=rh.day?'Every '+rh.day+(rh.time?' at '+rh.time:''):'';
  var chk=[
   {l:'Pipeline owner named with explicit authority',d:!!ow.ownerName&&!!ow.authority,ev:ow.ownerName?(ow.ownerName+(ow.ownerRole?', '+ow.ownerRole:'')+(ow.authority?': '+ow.authority:' \u2014 no authority stated')):'No owner named'},
   {l:'At least one embedded lead assigned',d:leads.length>=1&&!!leads[0].name,ev:leads.length?leads.length+' lead'+(leads.length===1?'':'s')+': '+leads.map(function(l){return (l.name||'Unnamed')+(l.dept?' ('+l.dept+')':'')}).join(', '):'No embedded lead yet'},
   {l:'Incentive structure addresses experimentation',d:!!inc.changes,ev:inc.changes||'No proposed changes recorded'},
   {l:'Innovation metrics selected (2+)',d:metrics.length>=2,ev:metrics.length?metrics.length+' metric'+(metrics.length===1?'':'s')+': '+metrics.join(', ')+(metrics.length<2?' \u2014 one more needed':''):'No metrics selected'},
   {l:'Weekly innovation session scheduled',d:!!rh.day&&att.length>0,ev:rh.day?session+(att.length?', '+att.length+' attendee'+(att.length===1?'':'s'):' \u2014 no attendees named'):'No day set'},
   {l:'Standing agenda defined',d:agenda.length>0,ev:agenda.length?agenda.join('; '):'No agenda items'},
   {l:'First deep assessments completed',d:deep,ev:deep?'Step 2.4 marked complete':'Not yet: step 2.4 is not marked complete'}];
  var done=chk.filter(function(c){return c.d}).length;
  var summary=(ow.ownerName?ow.ownerName+(ow.ownerRole?' ('+ow.ownerRole+')':'')+' owns the pipeline. ':'No pipeline owner is named yet. ')+leads.length+' embedded lead'+(leads.length===1?'':'s')+'. '+(rh.day?'Innovation rhythm: every '+rh.day+(rh.time?' at '+rh.time:'')+'. ':'No innovation rhythm set. ')+(inc.changes?'Incentives realigning.':'Incentives not yet realigned.');
  return {ow:ow,inc:inc,rh:rh,leads:leads,seniors:seniors,att:att,agenda:agenda,metrics:metrics,session:session,chk:chk,done:done,pct:Math.round(done/chk.length*100),summary:summary}}
```

**Check:** Open Phase 2's Org Readiness output. The page shows a summary, three figures, the Organizational Readiness Checklist with the record behind each check, then Pipeline Owner, Innovation Rhythm, Embedded Leads, Engaged Senior Leaders, and Incentive Changes. Click ▾ Save as PDF: the summary, At a Glance, the checklist with a tick per check met and "7 of 7 complete", then Pipeline Owner, Embedded Leads, Engaged Senior Leaders, Realigned Incentives, and Innovation Rhythm in quoted blocks.

---

### Step 145 — Add the function that draws the printed Governance Framework: a one-page document of the page's own cards.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgReadinessModel` ends, after its closing `}`.

**Code:**

```js
function govFrameworkDoc(){var gov=data.governance||{};
  var h=printDocCover('Governance Framework','The three mechanisms that keep innovation governed after day 90: the standing leadership agenda, the pipeline intake rule, and the quarterly review.','');
  var summary='Governance embedded across three mechanisms: a standing agenda in '+(gov.meeting||'the leadership meeting')+', gate reviews above '+(gov.threshold||'the intake threshold')+', and quarterly reviews from '+(gov.firstReview||'a date not yet set')+'.';
  h+='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid rgba(155,45,63,.2);background:rgba(155,45,63,.04);border-radius:8px;padding:14px 18px;margin:0 0 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9B2D3F;margin:0 0 6px">Executive Summary</div><div style="font-size:14px;line-height:1.55;color:#111">'+esc(summary)+'</div></div>';
  var pillars=[{t:'Standing Leadership Agenda',c:'#1B6B5A',items:[['Embedded in',gov.meeting],['Metrics',gov.metrics],['Format',gov.format]]},{t:'Pipeline Intake Rule',c:'#2D5A8E',items:[['Threshold',gov.threshold],['Review process',gov.gateProcess],['Outside-pipeline audit',gov.outsideAudit]]},{t:'Quarterly Review',c:'#8B5E3C',items:[['Attendees',gov.reviewAttendees],['Agenda',gov.reviewAgenda],['First review',gov.firstReview]]}];
  pillars.forEach(function(p){h+='<div class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-left:3px solid '+p.c+';border-radius:8px;padding:12px 16px;margin:0 0 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-family:var(--serif,Georgia,serif);font-size:16px;font-weight:700;color:#111;margin:0 0 8px">'+p.t+'</div>'+p.items.map(function(it){var t=lyText(it[1]);return '<div style="display:flex;gap:14px;padding:5px 0;border-top:1px solid #eee"><div style="font-family:var(--mono,monospace);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:'+p.c+';min-width:130px;padding-top:2px">'+it[0]+'</div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+';white-space:pre-line">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'}).join('')+'</div>'});
  return h} /* 17 Sep 2026 (Paul's ruling): a one-pager of the page's own cards \u2014 the executive summary card and the three mechanism cards with their coloured rules and mono labels \u2014 rather than the question-and-answer form */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 146 — Add the function that draws the printed Org Design Review: the four stress-test boxes in two rows with their coloured scores, then the adjustment plan.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `govFrameworkDoc` ends, after its closing `}`.

**Code:**

```js
function orgDesignReviewDoc(){var st=data.stress||{};var areas=[{k:'decisions',l:'Decision rights'},{k:'ownership',l:'Ownership model'},{k:'incentives',l:'Incentive changes'},{k:'culture',l:'Culture shift'}];var plan=(st.tuningList||[]).filter(function(t){return t});
  var scored=areas.filter(function(a){return st[a.k+'Score']});var avg=scored.length?(scored.reduce(function(s2,a){return s2+(+st[a.k+'Score']||0)},0)/scored.length):0;
  var h=printDocCover('Org Design Review','The stress test of the organization\u2019s design after the first cycle: how decision rights, the ownership model, the incentive changes, and the culture shift are holding, and the adjustments planned.',scored.length?'Average '+avg.toFixed(1)+' / 5 across '+scored.length+' area'+(scored.length===1?'':'s'):'');
  var box=function(a){var t=lyText(st[a.k]),sc=+st[a.k+'Score']||0;return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px"><div style="font-size:13px;font-weight:700;color:#111">'+esc(a.l)+'</div><div style="padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:'+(sc>=4?'rgba(27,107,90,.08)':sc>=3?'rgba(139,94,60,.06)':sc?'rgba(155,45,63,.06)':'#f4f4f4')+';color:'+(sc>=4?'#1B6B5A':sc>=3?'#8B5E3C':sc?'#9B2D3F':'#888')+'">'+(sc?sc+'/5':'\u2014')+'</div></div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></td>'};
  h+=erHead('The Stress Test','Each area scored out of 5, as the page shows them');
  [[0,1],[2,3]].forEach(function(pair){h+=erBlock('<table style="width:calc(100% + 16px);margin:0 -8px 8px;border-collapse:separate;border-spacing:8px 0"><tr>'+box(areas[pair[0]])+box(areas[pair[1]])+'</tr></table>')}); /* 16 Sep 2026 (Paul's Decision Analyses ruling applied here): the page's four boxes kept on paper, two rows of two, each unsplittable, the score chip coloured as on the page */
  h+='<div style="height:8px"></div>';
  h+=erSection('Adjustment Plan',plan.length?lyList('Adjustments',plan.map(function(t,i){return (i+1)+'. '+t})):lyRow('Adjustments',''),plan.length?plan.length+' adjustment'+(plan.length===1?'':'s'):'');
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 147 — Add the function that draws the printed RACI Matrix: the matrix with coloured chips and its legend, centred on a landscape page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgDesignReviewDoc` ends, after its closing `}`.

**Code:**

```js
function raciDoc(opts){opts=opts||{};ensureRaciModel();var raci=data.raci||{},cols=raciCols();var acts=['Approve experiments','Advance projects','Allocate budget','Kill projects','Pipeline reporting','Weekly session','Quarterly review'];
  var th='font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#333;border-bottom:2px solid #111;padding:8px 8px';
  var pchip=function(v){return '<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:'+RACI_COLORS[v]+';color:#fff;font-size:13px;font-weight:700;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact">'+v+'</span>'}; /* the chip as it prints */
  var tbl='<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;'+th+'">Activity</th>'+cols.map(function(c){return '<th style="text-align:center;'+th+'">'+esc(c.l)+'</th>'}).join('')+'</tr></thead><tbody>'+acts.map(function(a,ai){return '<tr><td style="padding:9px 8px;border-bottom:1px solid #ddd;font-size:12.5px;font-weight:600;color:#111">'+esc(a)+'</td>'+cols.map(function(c){var v=raci[ai+':'+c.k]||'';return '<td style="text-align:center;padding:7px 8px;border-bottom:1px solid #ddd">'+(v?pchip(v):'<span style="color:#bbb;font-size:13px">\u2014</span>')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  var key=_raciLegend(RACI_COLORS).replace('color:var(--text-faint)','color:#555').replace(/-webkit-print-color-adjust|print-color-adjust/g,'').replace(/border-radius:8px;background:/g,'border-radius:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:');
  return printDocCover('RACI Matrix','Who is Responsible, Accountable, Consulted, and Informed for each of the pipeline\u2019s seven activities, as set at Step 2.1.',cols.length+' role'+(cols.length===1?'':'s')+' \u00b7 7 activities')
   +'<style>.raci-land{page:raciland;break-before:page;page-break-before:always;width:990px;margin-left:0;display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 15vh)}@page raciland{size:landscape;margin:8mm 8mm 14mm 8mm}@media print and (max-width:800px){.raci-land{width:1058px}}</style><div class="raci-land">'+(opts.sectionHead||'')+erHead('RACI Matrix','')+tbl+key+'</div>'} /* the matrix sits centred on its landscape page, as Governance's does (12 Sep 2026) */ 
```

**Check:** Open Phase 2, step 2.1 (Ownership & Structure) and scroll to the RACI matrix. Each letter sits on a coloured round chip; a legend beneath reads R Responsible — does the work, A Accountable — owns the decision, exactly one per activity, C Consulted — input before, I Informed — told after. Click an empty cell: it cycles R, A, C, I, then blank. Open the RACI Matrix output (Phase 2) and click ▾ Save as PDF: after the first page, the matrix alone on a sideways page with the same chips and legend.

---

### Step 148 — Add the constant naming the Capital Planning Hub's three tabs.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `raciDoc` ends, after its closing `}`.

**Code:**

```js
var CAP_HUB_TABS=['Dashboard','Commitments','Plan & Funding']; /* the Capital Planning Hub\u2019s three tabs, as the page names them */
```

**Nothing to check yet.** This change becomes visible at Step 153.

---

### Step 149 — Add the constant holding the style rules of the radar chart for paper.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `CAP_HUB_TABS` ends.

**Code:**

```js
var PIPE_RADAR_CSS='.viz-radar{text-align:center;padding:8px 0}.viz-radar-svg{width:100%;max-width:520px;height:auto}'; /* the radar's two layout rules, from the stylesheet, for paper */
```

**Check:** Open Phase 1's Assessment Report. Above the content are two small buttons SUMMARY and FULL and the ▾ Save as PDF button. Click FULL, then ▾ Save as PDF: the executive summary in a box, At a Glance, the Readiness Profile bars with the radar chart beneath them, then Purpose and Direction with each written answer in a quoted block, AI Knowledge Base, Risk and Culture with five-cell strips, AI Innovation Audit, and Decision Rights.

---

### Step 150 — Add the constant holding the style rules of the dashboard's charts for paper.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PIPE_RADAR_CSS` ends.

**Code:**

```js
var PIPE_CHART_CSS='.user-av{border-radius:50%; display:inline-flex;align-items:center;justify-content:center; font-family:var(--mono);font-weight:700;letter-spacing:0; flex-shrink:0;line-height:1}.analytics-grid-2{display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px}.chart-card{padding: 24px; background: rgba(var(--fg-rgb),.025); border: 1px solid rgba(var(--fg-rgb),.08); display: flex; flex-direction: column}.chart-card-wide{grid-column: 1 / -1; margin-bottom: 16px}.chart-card-wide:last-child{margin-bottom: 0}.chart-title{font-family: var(--mono); font-size: 12px; letter-spacing: .15em; text-transform: uppercase; color: var(--paper); margin-bottom: 18px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap}.chart-subtitle{font-family: var(--sans); font-size: 12px; text-transform: none; letter-spacing: .01em; color: var(--stone); font-weight: 400}.chart-empty{padding: 32px 0; text-align: center; font-size: 13px; color: var(--stone); font-style: italic}.chart-donut-wrap{display: flex; align-items: center; gap: 24px; flex-wrap: wrap}.chart-donut-svg{width: 200px; height: 200px; flex-shrink: 0}.chart-legend{flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 8px}.chart-legend-row{display: grid; grid-template-columns: 12px 1fr auto auto; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(var(--fg-rgb),.04); font-family: var(--sans); font-size: 13px}.chart-legend-row:last-child{border-bottom: none}.chart-legend-dot{width: 10px; height: 10px; border-radius: 50%}.chart-legend-name{color: var(--paper)}.chart-legend-val{font-family: var(--mono); font-weight: 700; font-size: 14px}.chart-legend-pct{font-family: var(--mono); font-size: 11px; color: var(--stone); min-width: 38px; text-align: right}.cap-split-labels{display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-end}.cap-split-side .cap-split-pct{font-family: var(--serif); font-size: 42px; font-weight: 300; line-height: 1}.cap-split-side .cap-split-name{font-family: var(--mono); font-size: 11px; letter-spacing: .15em; text-transform: uppercase; color: var(--stone); margin-top: 4px}.cap-split-right{text-align: right}.cap-split-bar{display: flex; height: 14px; background: rgba(var(--fg-rgb),.06); border-radius: 7px; overflow: hidden; margin-bottom: 14px}.cap-split-fill{height: 100%; transition: width .4s ease}.cap-split-foot{font-family: var(--sans); font-size: 12px; color: var(--stone); margin-top: 4px}.chart-bubble-svg{width: 100%; height: auto; max-height: 360px; display: block; margin-bottom: 16px}.bubble-legend{display: flex; gap: 32px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid rgba(var(--fg-rgb),.06)}.bubble-legend-group{display: flex; align-items: center; gap: 12px; flex-wrap: wrap}.bubble-legend-lbl{font-family: var(--mono); font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: var(--stone); margin-right: 4px}.bubble-legend-item{display: inline-flex; align-items: center; gap: 6px; font-family: var(--sans); font-size: 12px; color: var(--paper)}.bubble-legend-dot{width: 10px; height: 10px; border-radius: 50%}.bubble-priority-dot{border-radius: 50%; background: rgba(232,98,26,.6); border: 1px solid var(--gold)}.status-rows{display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px}.status-row{display: grid; grid-template-columns: 120px 1fr 30px; align-items: center; gap: 12px}.status-row-label{font-family: var(--sans); font-size: 14px; font-weight: 600}.status-row-bar{display: flex; height: 24px; gap: 2px; background: rgba(var(--fg-rgb),.04); border: 1px solid rgba(var(--fg-rgb),.06)}.status-seg{display: flex; align-items: center; justify-content: center; min-width: 2px; transition: filter .15s}.status-seg-n{font-family: var(--mono); font-size: 11px; font-weight: 700; color: #fff}.status-row-total{font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--gold); text-align: right}.owner-rows{display: flex; flex-direction: column; gap: 8px}.owner-row{display: grid; grid-template-columns: 32px 160px 1fr 30px; align-items: center; gap: 12px}.owner-row-av{display: flex; justify-content: center}.owner-row-name{font-family: var(--sans); font-size: 13px; color: var(--paper)}.owner-row-bar{height: 12px; background: rgba(var(--fg-rgb),.05); border-radius: 6px; overflow: hidden}.owner-row-fill{height: 100%; border-radius: 6px; transition: width .4s ease}.owner-row-n{font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--gold); text-align: right}.status-row{grid-template-columns: 90px 1fr 30px}.owner-row{grid-template-columns: 28px 110px 1fr 24px}.cap-split-side .cap-split-pct{font-size: 32px}.chart-card{break-inside:avoid;page-break-inside:avoid}'; /* 16 Sep 2026 (Paul's ruling): the dashboard's five charts print; their layout rules come from the stylesheet as the Capital Snapshot's do (CAP_REPORT_CSS), with each chart card unsplittable */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 151 — Add the function that turns a page's form fields into their values as text before the page prints.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PIPE_CHART_CSS` ends.

**Code:**

```js
function _pdFormsToText(html){ /* 16 Sep 2026: a page that is a form prints its values as text — a select as its chosen option, an input as its value, a textarea as its content — and no handler survives */
  return html.replace(/<select[^>]*>([\s\S]*?)<\/select>/g,function(m,inner){var sel=inner.match(/<option[^>]*\sselected[^>]*>([^<]*)<\/option>/);var first=inner.match(/<option[^>]*>([^<]*)<\/option>/);var v=(sel?sel[1]:(first?first[1]:'')).trim();return '<span style="font-weight:600">'+(v||'\u2014')+'</span>'})
  .replace(/<textarea[^>]*>([\s\S]*?)<\/textarea>/g,function(m,inner){return '<span>'+(inner.trim()||'\u2014')+'</span>'})
  .replace(/<input([^>]*)>/g,function(m,attrs){var v=(attrs.match(/\svalue="([^"]*)"/)||[])[1]||'';var t=(attrs.match(/\stype="([^"]*)"/)||[])[1]||'text';if(t==='checkbox'||t==='radio')return /\schecked/.test(attrs)?'\u2713':'\u2014';return '<span style="font-weight:600">'+(v||'\u2014')+'</span>'})
  .replace(/ on(click|change|input|keyup|blur)="[^"]*"/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 152 — Add the function that draws the printed Capital Planning Hub document: the tab showing, under a first page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pdFormsToText` ends, after its closing `}`.

**Code:**

```js

function capHubDoc(){var tab=UI.hubTab||0;var body='';UI._printing=1;try{body=renderCapHub()}finally{UI._printing=0}
  return printDocCover('Capital Planning Hub \u2014 '+CAP_HUB_TABS[tab],'The portfolio\u2019s committed costs and remaining budget as they stand: the '+CAP_HUB_TABS[tab]+' view, every figure calculated from the projects themselves.','')+_pdFormsToText(_pdStrip(body))} /* the tab showing prints as its own document under a cover \u2014 Governance\u2019s Compliance Dashboard pattern (Rollout Guide Part II) */
```

**Nothing to check yet.** This change becomes visible at Step 153.

---

### Step 153 — Add the function behind the Capital Planning Hub's Save as PDF button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capHubDoc` ends, after its closing `}`.

**Code:**

```js
function printCapHub(){printDocument('Capital Planning Hub',capHubDoc(),'')}
```

**Check:** Open Phase 5's Capital Planning Hub and click ▾ Save as PDF: the first page, then the tab showing, with its form fields printed as their values.

---

### Step 154 — Add the function that draws the printed Capital Sandbox document: the staged batch, the calendar with the batch stacked on it, cumulative commitments against capacity, the committed calendar, the budget years, and the funding plan where the batch breaches capacity.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCapHub` ends, after its closing `}`.

**Code:**

```js
/* ══ THE CAPITAL SANDBOX ON PAPER (17 Sep 2026, Paul's ruling): the sandbox prints the scenario it shows — the standing baseline with whatever batch is ticked stacked on top — so different combinations print as different documents. Nothing here is a commitment; the title says so ══ */
function capSandboxDoc(){var ideas=data.ideas||[],stages=getStages(),proj=data.projects||{};var goP=stages.explore.filter(function(i){return (proj[i]||{}).viable===true});if(!UI.capSim)UI.capSim={};var sel=goP.filter(function(i){return UI.capSim[i]});
  var toExp=0;sel.forEach(function(i){toExp+=devCost(i)});var have=!!orgMonthly();var pmNow=have?progMonthOf(new Date()):null;var aAss=Math.max(1,(pmNow==null?0:pmNow)+1);
  var extras=sel.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;return {i:i,anchor:(a2!=null&&a2>=1)?a2:aAss}});var br=have?capBreaches(extras):{};
  var title=sel.length?'Staged batch ('+sel.length+')':'The standing baseline';
  var h=printDocCover('Capital Sandbox','A capital expenditure scenario staging a specified batch of projects.',sel.length?sel.length+' candidate'+(sel.length===1?'':'s')+' staged \u00b7 '+fmtMoney(toExp)+' committed on advancing':'Nothing staged'); /* 17 Sep 2026 (Paul's ruling): the cover as he gave it */
  var th=function(t,r){return '<th style="text-align:'+(r?'right':'left')+';padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var td=function(v,r){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;vertical-align:top;'+(r?'text-align:right;white-space:nowrap':'')+'">'+v+'</td>'};
  var rows=function(list){return list.map(function(i){var sd=(proj[i]||{}).startDate;var a2=sd?progMonthOf(sd):null;var start=have?('Month '+((a2!=null&&a2>=1)?a2:aAss)+(sd?'':' (assumed)')):(sd?lyDate(sd):'Next month');return '<tr>'+td('<b>'+esc((ideas[i]||{}).name)+'</b>')+td(getScore(i)+' / 50',true)+td(fmtMoney(devCost(i)),true)+td(fmtMoney(opsRolloutCost(i)),true)+td(fmtMoney(opsSustainCost(i))+'/yr',true)+td(start)+'</tr>'}).join('')};
  var tbl=function(list){return '<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><thead><tr>'+th('Candidate')+th('Score',true)+th('Development',true)+th('Rollout',true)+th('Sustainment',true)+th('Start')+'</tr></thead><tbody>'+rows(list)+'</tbody></table>'};
  if(sel.length)h+=erBlock(erHead('The Staged Batch',sel.length+' of '+goP.length+' Go candidates ticked \u2014 unless dated, each is assumed to start next month (program Month '+aAss+')')+tbl(sel)+'<p style="font-size:11.5px;color:#333;margin:0 0 22px">Committed on advancing: <b>'+fmtMoney(toExp)+'</b> \u2014 the full plans, reflected across the years they touch.</p>');
  else h+=erBlock(erHead('The Staged Batch','Nothing ticked \u2014 the pages that follow show the committed portfolio alone')+(goP.length?'<p style="font-size:11.5px;color:#333;margin:0 0 6px">The Go candidates available to stage:</p>'+tbl(goP):'<p style="font-size:12px;color:#888;font-style:italic;margin:0 0 22px">No Go candidates yet \u2014 Go projects from Exploration appear here with their costs.</p>'));
  if(!have)return h+erBlock(erHead('On the Calendar','')+'<p style="font-size:12px;color:#888;font-style:italic">Set the period start date at Step 3.2 (Plan Capacity) to draw the batch on the program calendar.</p>');
  var strip=function(x){return String(x||'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/<svg /g,'<svg style="width:100%;height:auto;display:block" ')};
  var verdict=sel.length?(br.overCapMonth?'<p style="font-size:12px;color:#9B2D3F;margin:8px 0 0">\u26A0 With this batch, cumulative commitments cross capacity in Month '+br.overCapMonth+'. A funding plan would be required at Commit &amp; Advance.</p>':'<p style="font-size:12px;color:#333;margin:8px 0 0">Cumulative commitments stay under cumulative capacity across the horizon.</p>'):'';
  h+=erBlock(erHead('On the Calendar',sel.length?'The standing baseline with the staged batch stacked on top':'The standing baseline')+strip(orgWaterfallChart(extras))+verdict);
  h+=erBlock(erHead('Cumulative Commitments Against Capacity','')+strip(orgCumChart(extras)));
  h+=erBlock(erHead('The Committed Calendar',sel.length?'Swimlanes, the staged batch included':'Swimlanes')+strip(orgSwimlanes(extras)));
  var L=capLens(extras.length?extras:null);var k=function(v){return (v<0?'\u2212':'')+'$'+Math.round(Math.abs(v)/1000).toLocaleString('en-US')+'K'};var anyKill=L.years.some(function(r){return r.killPot});
  var yth=function(t,r){return '<th style="text-align:'+(r?'right':'left')+';padding:6px 8px;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111">'+t+'</th>'};var ytd=function(v,r,c){return '<td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #eee;'+(r?'text-align:right;white-space:nowrap;font-family:var(--mono,monospace);':'')+(c?'color:'+c+';font-weight:700;':'')+'">'+v+'</td>'};
  var yrow=function(lbl,r,bold){return '<tr>'+ytd(bold?'<b>'+lbl+'</b>':lbl)+ytd(k(r.budget),true)+ytd(k(r.committed),true)+(anyKill?ytd(r.killPot?k(r.killPot):'\u2014',true):'')+ytd(k(r.available),true,r.available<0?'#9B2D3F':'#1B6B5A')+'</tr>'};
  h+='<div style="height:22px"></div>'+erBlock(erHead('The Years','Budget, committed cost, and what remains in each year of the planning window'+(sel.length?', with the staged batch included':''))+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><thead><tr>'+yth('Year')+yth('Budget',true)+yth('Committed',true)+(anyKill?yth('Kill & phase-out',true):'')+yth('Available',true)+'</tr></thead><tbody>'+L.years.map(function(r){return yrow('Year '+r.y,r)}).join('')+yrow('Total \u2014 '+L.years.length+' years',L.tot,true)+'</tbody></table>'); /* 17 Sep 2026 (Paul's ruling): a line per year and the total, in exact thousands so the arithmetic reads; the screen widget's one-year view and its paragraphs are gone */
  if(sel.length&&br.overCapMonth){ /* 17 Sep 2026 (Paul's ruling, on the chat's refinement): a funding plan is written for the batch that breaches, so it prints with that batch */
    var fl=fundLines(),ovs=((data.capital||{}).overrides||[]);var ytx=orgYearTotals()||[];var gaps=ytx.filter(function(r){return r.budgetSet&&r.headroom<0}).map(function(r){return 'Year '+r.y+': '+fmtMoney(-r.headroom)});
    var lines=fl.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 8px"><thead><tr>'+th('Source')+th('Amount',true)+th('Year')+th('Project')+th('Status')+'</tr></thead><tbody>'+fl.map(function(r){var auth=r.st==='auth';return '<tr>'+td(esc(r.d||'')||'<span style="color:#888;font-style:italic">Not recorded</span>')+td(fmtMoney(costNum(r.a)),true)+td('Year '+esc(String(r.y||'1')))+td(esc(r.proj||'')||'\u2014')+td(auth?'Authorized'+(r.at?' \u00b7 '+fmtDate(r.at):'')+(r.by?' \u00b7 '+esc(r.by):''):'Planned')+'</tr>'}).join('')+'</tbody></table>':'<p style="font-size:12px;color:#888;font-style:italic;margin:0 0 8px">No funding lines recorded yet.</p>';
    var ov=ovs.length?'<div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;margin:10px 0 4px">Overrides on record</div>'+ovs.map(function(o){return '<div style="font-size:12px;color:#111;margin:0 0 3px">'+esc(o.reason||'')+' <span style="color:#555">\u2014 month '+(o.month||'?')+' \u00b7 '+fmtDate(o.at)+(o.by?' \u00b7 '+esc(o.by):'')+'</span></div>'}).join(''):'';
    h+=erBlock(erHead('Capacity Breach Funding Plan','With this batch, cumulative commitments cross capacity in Month '+br.overCapMonth)+(gaps.length?'<p style="font-size:12px;color:#333;margin:0 0 8px">The funding gap on the committed calendar \u2014 '+gaps.join(' \u00b7 ')+'. The lines below are the sources that answer it.</p>':'<p style="font-size:12px;color:#333;margin:0 0 8px">The committed calendar itself sits inside its budget. The funding breach comes from the staged batch. The items below identify additional sources that may be drawn on to cover the funding breach, or that have been identified so far.</p>' /* 17 Sep 2026: Paul's copy, verbatim */)+lines+ov)}
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 155.

---

### Step 155 — Add the function behind the Sandbox card's Save as PDF button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `capSandboxDoc` ends, after its closing `}`.

**Code:**

```js
function printCapSandbox(){printDocument('Capital Sandbox',capSandboxDoc(),'')}
```

**Check:** Open Phase 2's Exploration Portfolio and click the Allocate Capital tab, then 1 · Sandbox. The Sandbox card's heading line carries ▾ Save as PDF. Tick three candidates and click it: the first page is titled Capital Sandbox with the subtitle "A capital expenditure scenario staging a specified batch of projects."; then The Staged Batch listing the three with their scores, costs, and start; On the Calendar with the waterfall; Cumulative Commitments Against Capacity; The Committed Calendar; and The Years as a table with a line per year and a total, its figures in thousands such as $2,400K.

---

### Step 156 — Add the function that draws the printed Pipeline Dashboard document: the overview with the maturity gauge, its four bars, the two cadence cards, and the operational projects; the pipeline chevrons and the four portfolio lanes; then the charts.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCapSandbox` ends, after its closing `}`.

**Code:**

```js
/* ══ PHASE 5 DOCUMENTS (round 4, 16 Sep 2026): the Pipeline Dashboard composed for paper; the Module Management document as Governance and ER print it; the print dispatch for the Phase 5 pages ══ */
function pipelineDashboardDoc(){var ideas=data.ideas||[],st=getStages(),rh=data.rhythm||{},gov=data.governance||{},trk=data.tracking||{},ops=data.opsData||{},pj=data.projects||{};var m=getPipelineMaturity();var att=rhAttNames();
  var css='<style>.gd-doc .gd-sec{font-size:22px;font-weight:800;color:#111;margin:0 0 14px}.gd-doc .gd-sec+.gd-sec{margin-top:26px}.gd-doc .gd-sub{font-size:17px;font-weight:700;color:#111;margin:18px 0 10px;break-after:avoid;page-break-after:avoid}.gd-doc .cd{border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:0 0 12px;background:none;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:180px;height:117px}.gd-doc .t-faint-sm{font-size:12px;color:#555}.gd-rev3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:0 0 14px}.gd-rev{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;break-inside:avoid}.gd-rev-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;line-height:1.35;min-height:32px}.gd-rev-v{font-size:19px;font-weight:800;margin-top:4px}.gd-rev-d{font-size:12px;color:#555;margin-top:2px}.gd-doc table.gd-sys{width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 6px}.gd-doc table.gd-sys th{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#333;border-bottom:1px solid #111;padding:6px 8px;text-align:left}.gd-doc table.gd-sys td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}.gd-doc .gd-sys .bg{margin-right:4px;font-size:11px;padding:2px 8px}.gd-arch{font-size:12px;color:#555;margin:4px 0 0}.gd-dom{font-size:16px;font-weight:700;color:#111;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}.gd-dom span{font-weight:400;color:#666;font-size:12px}.gd-none{font-size:12.5px;color:#666;font-style:italic;padding:4px 0}.gd-alert{border:2px solid #9B2D3F;color:#9B2D3F;font-weight:700;font-size:14px;padding:8px 12px;border-radius:6px;margin:0 0 14px}.gd-doc .u-778010b{display:flex;align-items:center;gap:0;margin:0 0 18px}.gd-doc .phase-flex{flex:1;opacity:var(--op)}.gd-doc .u-0cc49e2{width:100%;height:70px}.gd-lane{border:1px solid #ddd;border-top:4px solid;border-radius:6px;padding:10px 12px;margin:0 0 12px;break-inside:avoid;page-break-inside:avoid}.gd-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.gd-subh{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:8px 0 2px}.gd-gl{break-inside:avoid;page-break-inside:avoid;margin:0 0 6px}.gd-gl .gd-dom{font-size:15px;margin:10px 0 2px}.gd-gl-p{font-size:13px;line-height:1.6;margin:2px 0 0;color:#111}.gd-lane-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px}.gd-lane-h h3{font-size:15px;font-weight:700;margin:0}.gd-lane .bg{font-size:11px;padding:2px 8px;margin-left:4px}.gd-warn{font-size:11px;font-weight:600;color:#C8860A;margin:0 0 4px}.gd-item{font-size:12.5px;color:#222;padding:3px 0;border-bottom:1px solid #eee}.gd-doc .analytics-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 12px}.gd-doc .chart-card{border:1px solid #ddd;border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}.gd-doc .chart-title{font-family:var(--mono,monospace);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#111;margin:0 0 12px}.gd-doc .chart-empty{padding:24px 0;text-align:center;font-size:12px;color:#666;font-style:italic}.gd-doc .chart-donut-wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.gd-doc .chart-donut-svg{width:150px;height:150px;flex-shrink:0}.gd-doc .chart-legend{flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px}.gd-doc .chart-legend-row{display:grid;grid-template-columns:12px 1fr auto auto;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee;font-size:12px}.gd-doc .chart-legend-dot{width:10px;height:10px;border-radius:50%}.gd-doc .chart-legend-name{color:#111}.gd-doc .chart-legend-val{font-family:var(--mono,monospace);font-weight:700;font-size:13px}.gd-doc .chart-legend-pct{font-family:var(--mono,monospace);font-size:11px;color:#555;min-width:34px;text-align:right}.gd-doc svg{max-width:100%}</style>'; /* Governance's dashboard stylesheet, verbatim (dashboardDoc, 14 Sep 2026) */
  var h=printDocCover('Pipeline Dashboard','Pipeline maturity, the next session and reviews, the live projects, and the four portfolios as they stand today.','');
  h+=css+'<style>'+PIPE_CHART_CSS+'</style><div class="gd-doc">';
  /* page one: Pipeline Overview \u2014 the coverage card as govCoverageCard draws it (gauge, score, label; the bars beside), the three cadence cards, the live projects */
  h+='<div style="break-after:page;page-break-after:always">';
  h+='<div class="gd-sec">Pipeline Overview</div>';
  /* the page's own maturity row and its two cards (17 Sep 2026, Paul's ruling: as the dashboard page draws them, nothing added) */
  h+='<style>.gd-doc .viz-dash-row{display:grid;grid-template-columns:240px 1fr;gap:32px;align-items:center;padding:24px;margin-bottom:24px;border:1px solid #ddd;border-radius:6px;break-inside:avoid;page-break-inside:avoid}.gd-doc .viz-gauge-wrap{text-align:center}.gd-doc .viz-gauge-svg{width:200px;height:130px;max-width:100%}.gd-doc .viz-gauge-score{font-family:var(--serif);font-size:36px;font-weight:300;margin-top:-8px;line-height:1}.gd-doc .viz-gauge-denom{font-size:18px;color:#4E5A68;font-weight:300;margin-left:2px}.gd-doc .viz-gauge-label{font-family:var(--mono);font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#4E5A68;margin-top:8px}.gd-doc .viz-dim-bars{display:flex;flex-direction:column;gap:12px}.gd-doc .viz-dim-row{display:grid;grid-template-columns:120px 1fr 50px;align-items:center;gap:14px}.gd-doc .viz-dim-name{font-family:var(--sans);font-size:14px;font-weight:500;color:#1E2530}.gd-doc .viz-dim-track{height:10px;background:rgba(30,37,48,.06);border-radius:5px;overflow:hidden}.gd-doc .viz-dim-fill{height:100%;border-radius:5px}.gd-doc .viz-dim-val{font-family:var(--mono);font-size:13px;font-weight:700;text-align:right}.gd-doc .gr-2-mb{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.gd-doc .cd{border-radius:6px;padding:16px 18px;margin:0;break-inside:avoid;page-break-inside:avoid}.gd-doc .u-49c8739{font-size:14px;font-weight:700;color:#6B4C8A;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.gd-doc .u-ac07cd3{font-size:20px;font-weight:800;color:#6B4C8A}.gd-doc .u-a4cb65d{font-size:13px;color:#64707E;margin-top:4px}.gd-doc .u-efdcc60{font-size:14px;font-weight:700;color:#9B2D3F;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}.gd-doc .u-e48f6d6{font-size:20px;font-weight:800;color:#9B2D3F}</style>';
  h+='<div class="viz-dash-row">'+vizHealthGauge(m)+vizDimBars()+'</div>';
  h+='<div class="gr-2-mb">'+card('<div class="u-49c8739">Next Innovation Session</div><div class="u-ac07cd3">'+(rh.day||'\u2014')+' at '+(rh.time||'TBD')+'</div><div class="u-a4cb65d">'+(rh.duration||30)+' min \xb7 '+(att.length?att.map(esc).join(', '):'TBD')+'</div>','background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.3)')+card('<div class="u-efdcc60">Next Quarterly Review</div><div class="u-e48f6d6">'+esc(gov.firstReview||'TBD')+'</div>','background:rgba(155,45,63,.06);border:1px solid rgba(155,45,63,.3)')+'</div>';
  var live=(st.operational||[]);
  h+='<div class="gd-sub">Operational Projects <span style="font-weight:400;color:#666;font-size:12px">('+live.length+')</span></div>';
  if(live.length){h+='<table class="gd-sys"><thead><tr><th style="width:34%">Project</th><th>Function</th><th style="width:22%">Status</th></tr></thead><tbody>';
    live.forEach(function(i){var killed=(trk[i]||{}).status==='killed';var hh=(ops[i]||{}).health;var col=killed?'#9B2D3F':({green:'#1B6B5A',amber:'#C8860A',red:'#9B2D3F'}[hh]||'#555');var word=killed?'Killed':hh?(hh==='green'?'On track':hh==='amber'?'Watch':'At risk'):'Health not reported';
      h+='<tr><td style="font-weight:600;color:#111">'+esc((ideas[i]||{}).name||'Unnamed project')+'</td><td>'+((ideas[i]||{}).desc?esc((ideas[i]||{}).desc):'<span style="color:#999">Not recorded</span>')+'</td><td style="font-weight:700;color:'+col+'">'+word+'</td></tr>'}); /* the status as coloured text: the page\u2019s badge class does not reach the print window */
    h+='</tbody></table>'}else h+='<div class="gd-none">No projects live yet.</div>';
  h+='</div>';
  /* page two: The Pipeline \u2014 the notice, the chevrons, the four portfolios as lanes; then Portfolio at a Glance follows at once */
  var stages=[{k:'bluesky',t:'Blue Sky',items:st.bluesky,col:'#1B6B5A'},{k:'explore',t:'Exploration',items:(st.explore||[]).concat(st.noGo||[]),col:'#2D5A8E'},{k:'experiment',t:'Development',items:st.experiment||[],col:'#8B5E3C'},{k:'operate',t:'Operational',items:st.operational||[],col:'#9B2D3F'}];
  h+='<div style="break-before:page;page-break-before:always"></div>'; /* 17 Sep 2026 (Paul's ruling): the pipeline starts on its own page, unlabelled */
  var reds=live.filter(function(i){return (ops[i]||{}).health==='red'&&(trk[i]||{}).status!=='killed'});if(reds.length)h+='<div class="gd-alert">\u26a0 '+reds.length+' operational project'+(reds.length===1?'':'s')+' at risk</div>';
  var chev=function(x,i){return '<div class="phase-flex" style="--op:1"><svg viewBox="0 0 200 80" class="u-0cc49e2"><path d="'+(i===0?'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 Z':'M 0 0 L 170 0 L 200 40 L 170 80 L 0 80 L 30 40 Z')+'" fill="'+x.col+'"/><text x="'+(i===0?85:100)+'" y="34" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="Helvetica Neue,Arial,sans-serif">'+esc(x.t)+'</text><text x="'+(i===0?85:100)+'" y="56" text-anchor="middle" fill="rgba(255,255,255,.92)" font-size="12" font-weight="600" font-family="Helvetica Neue,Arial,sans-serif">'+x.items.length+' item'+(x.items.length===1?'':'s')+'</text></svg></div>'};
  h+='<div class="u-778010b">'+stages.map(chev).join('')+'</div>';
  var cols=function(list){var half=Math.ceil(list.length/2);var col=function(l){return '<div>'+l.map(function(i){return '<div class="gd-item">'+esc((ideas[i]||{}).name||'Unnamed')+'</div>'}).join('')+'</div>'};return '<div class="gd-cols">'+col(list.slice(0,half))+col(list.slice(half))+'</div>'};
  var lane=function(t,c,bad,inner){return '<div class="gd-lane" style="border-top-color:'+c+'"><div class="gd-lane-h"><h3 style="color:'+c+'">'+t+'</h3><span>'+bad+'</span></div>'+inner+'</div>'};
  var sub=function(l,list,col){return list.length?'<div class="gd-subh" style="color:'+col+'">'+l+' ('+list.length+')</div>'+cols(list):''};
  var bs=stages[0],now=bs.items.filter(function(i){return (ideas[i]||{}).when!=='future'}),fut=bs.items.filter(function(i){return (ideas[i]||{}).when==='future'});
  var ex=stages[1],go=ex.items.filter(function(i){return (pj[i]||{}).viable===true}),nogo=ex.items.filter(function(i){return (pj[i]||{}).viable===false}),open=ex.items.filter(function(i){var v=(pj[i]||{}).viable;return v!==true&&v!==false});
  var dv=stages[2],byS=function(a){return dv.items.filter(function(i){return a.indexOf((trk[i]||{}).status||'')>=0})},running=byS(['running','alive']),complete=byS(['complete']),paused=byS(['paused','dormant']),dead=byS(['killed','dead']),fresh=dv.items.filter(function(i){return !((trk[i]||{}).status)});
  var op=stages[3],byH=function(hh){return op.items.filter(function(i){return ((ops[i]||{}).health||'')===hh&&(trk[i]||{}).status!=='killed'})},green=byH('green'),amber=byH('amber'),red=byH('red'),opKilled=op.items.filter(function(i){return (trk[i]||{}).status==='killed'}),unrep=op.items.filter(function(i){return !((ops[i]||{}).health)&&(trk[i]||{}).status!=='killed'});
  h+=lane('Blue Sky',bs.col,badge(bs.items.length+(bs.items.length===1?' item':' items'),bs.col),bs.items.length?(sub('Now',now,bs.col)+sub('For the future',fut,'#6B7F8D')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Exploration',ex.col,badge(go.length+' Go','#1B6B5A')+badge(nogo.length+' No-Go','#9B2D3F'),ex.items.length?(sub('Go',go,'#1B6B5A')+sub('Not yet decided',open,'#6B7F8D')+sub('No-Go',nogo,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Development',dv.col,badge(running.length+' running','#2D5A8E')+badge(complete.length+' complete','#1B6B5A'),dv.items.length?(sub('Running',running,'#2D5A8E')+sub('Complete',complete,'#1B6B5A')+sub('Not yet started',fresh,'#6B7F8D')+sub('Paused',paused,'#8B5E3C')+sub('Killed',dead,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  h+=lane('Operational',op.col,badge(green.length+' on track','#1B6B5A')+badge(amber.length+' watch','#C8860A')+badge(red.length+' at risk','#9B2D3F'),op.items.length?(sub('On track',green,'#1B6B5A')+sub('Watch',amber,'#C8860A')+sub('At risk',red,'#9B2D3F')+sub('Health not reported',unrep,'#6B7F8D')+sub('Killed',opKilled,'#9B2D3F')):'<div class="gd-none">No items yet.</div>');
  /* Portfolio at a Glance follows the Operational lane at once (17 Sep 2026, Paul's ruling: no gap) */
  var bm='';try{bm=vizBalanceMap()}catch(e){bm=''}
  h+='<div class="gd-sub">Portfolio at a Glance</div><div class="analytics-grid-2">'+vizStageDonut()+vizCapitalSplit()+'</div>'+vizPortfolioMap()+vizStatusBars()+vizOwnerLoad()+(bm?'<div class="chart-card chart-card-wide"><div class="chart-title">Balance Map <span class="chart-subtitle">Risk against reward, by horizon</span></div><div style="max-width:520px">'+bm+'</div></div>':'');
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')} /* 17 Sep 2026 (Paul's ruling, third time asked): the Governance dashboard document copied \u2014 its stylesheet, its coverage card (gauge, score, label, the bars beside), its cadence cards, its systems table, its lanes \u2014 with the Pipeline\u2019s data in their places */
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 157 — Add the function that draws the printed Module Management document: the four figures, This Week, the steps by phase with their owners and state, then a page headed Analytics.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `pipelineDashboardDoc` ends, after its closing `}`.

**Code:**

```js
/* MODULE MANAGEMENT DOCUMENT (Governance, 14 Sep 2026, Paul's ruling; ported to the Innovation Pipeline 16 Sep 2026 on his word): the Track Program page prints as its own document rather than a snapshot of the tab showing. Page one: the four figures; This Week; every shared step by phase with its owners, its due date, and its state. Page two: the burn-up beside the velocity chart; the workload by member; the signals. The tab buttons, the due-date fields, and the assignment controls do not print. The Pipeline's mgSteps supplies the shared steps of Phases 1–4 */
function mgmtHubDoc(){var st=mgStats(),co=data.completedSteps||{},due=data.stepDue||{},dts=data.stepDoneAt||{};
  var today=new Date().toISOString().split('T')[0];var week=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  var owners=function(id){return ((data.assigns||{})[id]||[]).map(function(uid){var u=(USERS||[]).find(function(x){return x.id===uid});return u?u.name:''}).filter(Boolean).join(', ')};
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
  PH.forEach(function(p){if(p.days==='Ongoing')return;var list=steps.filter(function(s2){return s2.ph===p});if(!list.length)return;h+='<div class="mh-ph" style="color:'+p.color+'">Phase '+p.id+' \u2013 '+esc(p.name)+' <span>('+esc(p.days)+')</span></div>'+tbl(list)});
  /* page two: the analytics */
  h+='<div style="break-before:page;page-break-before:always"><div class="mh-sec">Analytics</div>';
  h+='<div class="mh2">'+card('<h3>90-Day Burn-up</h3><p class="t-faint-sm" style="margin:0 0 8px">Cumulative step completion against the ideal pace \u2013 the dashed line finishes all '+st.total+' steps by day 90.</p>'+mgBurnup())+card('<h3>Module Velocity</h3><p class="t-faint-sm" style="margin:0 0 8px">Steps completed per program week, from completion dates.</p>'+mgVelocity())+'</div>';
  h+=card('<h3>Workload by Member</h3><p class="t-faint-sm" style="margin:0 0 8px">Open and completed step assignments \u2013 gold shows who is carrying open work now.</p>'+mgWorkload());
  h+=card('<h3>Signals</h3>'+mgSignals())+'</div>';
  h+='</div>';
  return h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<input[^>]*>/g,'').replace(/ onclick="[^"]*"/g,'').replace(/ title="[^"]*"/g,'').replace(/cursor:pointer;?/g,'')}
```

**Check:** Open the More menu and choose Track Program. Click ▾ Save as PDF: the first page is titled Module Management; the next shows four figures, This Week, and the steps of Phases 1 to 4 with their owners and state; the page after is headed Analytics.

---

### Step 158 — Add the function that prints the Capital Planning Hub document from the Phase 5 print dispatch.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `mgmtHubDoc` ends, after its closing `}`.

**Code:**

```js
function printCapHubPage(){printCapHub()} /* the Capital Planning Hub's document, reached from the Phase 5 dispatch */
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 159 — Add the function that says whether the current page shows the sidebar and its toggle; the Report Manager page does.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCapHubPage` ends, after its closing `}`.

**Code:**

```js
function sidebarPageShown(){return currentPage==='step'||currentPage==='phase'||currentPage==='phase5'||currentPage==='outcome'||currentPage==='pipeline'||currentPage==='cap-hub'||currentPage==='reports'||currentPage==='review'||currentPage==='portfolio'} /* 16 Sep 2026 (Paul's ruling, family): the pages that show the sidebar and its toggle, once — the Report Manager among them */
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 160 — Add the function that draws a text field in the Report Manager.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `sidebarPageShown` ends, after its closing `}`.

**Code:**

```js
/* ══ /* ─ REPORT MANAGER (family code, ported from the Governance build 14 Sep 2026 and from Executive Readiness 16 Sep 2026; Spec Rev A §9). A named report definition on the organization holds an ordered list of units — outputs, Phase 5 pages, individual ideas, and text pages the user writes — with a depth where a unit has one and a note per section. The compiled document is one cover, a contents page, the introduction, and each unit as a numbered section. The record is never edited here. ─ */
function rcInp(label,id,val,ph){return '<div class="mb-4"><label class="form-label">'+esc(label)+'</label><input type="text" id="'+id+'" data-uncapped="1" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:100%"></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 161 — Add the function that draws a plain button in the Report Manager.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcInp` ends, after its closing `}`.

**Code:**

```js
function rcBtnG(label,onclick,style){return '<button class="btn bg2" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 162 — Add the function that draws a filled button in the Report Manager.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcBtnG` ends, after its closing `}`.

**Code:**

```js
function rcBtnS(label,onclick,color,style){return '<button class="btn bp" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 163 — Add the function the Report Manager uses to print and to preview.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcBtnS` ends, after its closing `}`.

**Code:**

```js
function printDocumentPreview(title,content,opts){printDocument(title,content,'',opts)} /* the Report Manager's print and preview go through the shared window */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 164 — Add the constant naming the Phase 5 pages the Report Manager can include.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDocumentPreview` ends, after its closing `}`.

**Code:**

```js
var RC_PAGE_UNITS=[['5.1','Pipeline Dashboard'],['cap-hub','Capital Planning Hub'],['mgmt-hub','Module Management']]; /* the Phase 5 pages a report can include, named as their documents are titled */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 165 — Add the function that gives a report section's name, reading a Phase 5 page's name from the constant so that saved reports follow a renaming.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RC_PAGE_UNITS` ends.

**Code:**

```js
function rcUnitName(u){if(u.kind==='page'){var p=RC_PAGE_UNITS.filter(function(x){return x[0]===u.id})[0];if(p)return p[1]}return u.name||(u.kind==='text'?'Untitled page':'')} /* a page unit's name is read live, so a saved report follows a renaming */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 166 — Add the function that lists everything a report can contain.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitName` ends, after its closing `}`.

**Code:**

```js
function rcCatalogue(){var out=[];
  PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){if(o.id==='cap-hub')return;if(PRINT_DOCS[o.id])out.push({kind:'output',id:o.id,name:o.name,group:'Outputs \u00b7 Phase '+p.id,depths:DEPTHED_OUTPUTS[o.id]?['summary','full']:null})})});
  RC_PAGE_UNITS.forEach(function(x){out.push({kind:'page',id:x[0],name:x[1],group:'Phase 5 pages'})});
  var st=getStages(),arch=data.archivedItems||{};(data.ideas||[]).forEach(function(d,i){if(!d||arch[i])return;out.push({kind:'record',type:'idea',id:String(i),name:d.name||'Unnamed idea',group:'Individual Ideas',rec:{i:i},sub:ideaStageWord(i,st)+(d.dept?' \u00b7 '+d.dept:'')})});
  return out} /* the catalogue: every output with a document, by phase (the Capital Planning Hub is a page, not an output); the three Phase 5 pages; every idea not archived, with its stage and department */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 167 — Add the function that gives an idea's stage in the pipeline's own words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcCatalogue` ends, after its closing `}`.

**Code:**

```js
function ideaStageWord(i,st){st=st||getStages();if((st.operational||[]).indexOf(i)>=0)return 'Operational';if((st.experiment||[]).indexOf(i)>=0)return 'Development';if((st.noGo||[]).indexOf(i)>=0)return 'No-Go';if((st.explore||[]).indexOf(i)>=0)return 'Exploration';if((st.bluesky||[]).indexOf(i)>=0)return 'Blue Sky';return 'Archived'} /* an idea's stage in the pipeline's own words */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 168 — Add the function that names a piece of content's kind.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ideaStageWord` ends, after its closing `}`.

**Code:**

```js
function rcKindLabel(u){return u.kind==='output'?'Output':u.kind==='page'?'Phase 5 page':u.kind==='text'?'Text page':u.kind==='record'?'Individual idea':''}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 169 — Add the function that builds one section's content.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcKindLabel` ends, after its closing `}`.

**Code:**

```js
function rcUnitBody(u,lead){ /* the unit's content, no cover, no controls */
  var body='';var wasDepth=UI.printDepth,wasTab=UI.hubTab;
  try{
    if(u.kind==='output'&&u.id==='out-raci'){body=_rcStripCover(raciDoc({sectionHead:lead||''}))} /* the matrix opens on its own landscape page; the section heading rides into it */
    else if(u.kind==='output'){UI.printDepth=u.depth||'full';var fn=PRINT_DOCS[u.id];body=fn?_rcStripCover(fn()):''}
    else if(u.kind==='page'&&u.id==='5.1'){body=_rcStripCover(pipelineDashboardDoc())}
    else if(u.kind==='page'&&u.id==='cap-hub'){body=CAP_HUB_TABS.map(function(t,k){UI.hubTab=k;return erHead(t,'')+_rcStripCover(capHubDoc())}).join('')} /* in a report the hub prints all three tabs, each under its name */
    else if(u.kind==='page'&&u.id==='mgmt-hub'){body=_rcStripCover(mgmtHubDoc())}
    else if(u.kind==='record'&&u.type==='idea'){var i=+u.id;var d=(data.ideas||[])[i];var isProj=(data.selected||[]).indexOf(i)>=0;body=d?lyRender(isProj?'project':'idea',{i:i},'full',null):'<p style="font-size:13px;color:#666;font-style:italic">This idea is no longer on the record.</p>'} /* a selected idea is a project and prints the project record */
    else if(u.kind==='text'){body='<div class="rc-text" style="font-size:14px;line-height:1.7;color:#222">'+rcSanitize(u.html||'')+'</div>'}
  }finally{UI.printDepth=wasDepth;UI.hubTab=wasTab}
  return rcFirstRecordStays(body)}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 170 — Add the function that collects what a section's records are missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitBody` ends, after its closing `}`.

**Code:**

```js
function rcUnitGaps(u){if(u.kind==='record'&&u.type==='idea'){var i=+u.id;return (data.ideas||[])[i]?lyGaps('idea',[{i:i}],null):[]}return []} /* the idea map names no required layers; the list is empty by design */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 171 — Add the function that states a section's size, such as "9 ideas" or "9 of 9 decided".

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitGaps` ends, after its closing `}`.

**Code:**

```js
function rcUnitFact(u){var n=function(c,w,pl){return c+' '+(c===1?w:(pl||w+'s'))};var st=getStages();
  if(u.kind==='output'){var cu=data.culture||{};var cs=['uncertainty','aiLegitimacy','newProposals','incentives','frontline','overall'].map(function(k){return typeof cu[k]==='number'?cu[k]:0}).reduce(function(a,b){return a+b},0);
    return ({'out-report':'Culture '+cs+' / 30','out-bluesky':n(st.bluesky.length,'idea'),'out-orgready':n((((data.ownership||{}).leads)||[]).filter(function(l){return l&&l.name}).length,'embedded lead'),'out-raci':n(raciCols().length,'role'),'out-explore':n(st.explore.length+(st.noGo||[]).length,'idea'),'out-capplan':(data.capital||{}).aiBudget?'Budget '+(data.capital||{}).aiBudget:'No budget set','out-expbriefs':n(st.experiment.length,'program'),'out-devport':n(st.experiment.length,'program'),'out-govfw':(data.governance||{}).threshold?'Threshold '+(data.governance||{}).threshold:'','out-orgrev':(function(){var x=data.stress||{};var sc=['decisions','ownership','incentives','culture'].map(function(k){return +x[k+'Score']||0}).filter(Boolean);return sc.length?'Average '+(sc.reduce(function(a,b){return a+b},0)/sc.length).toFixed(1)+' / 5':''})(),'out-finalport':(function(){var M=portfolioReviewModel();return M.decided+' of '+M.items.length+' decided'})(),'out-oper':n((st.operational||[]).length,'live project')})[u.id]||''}
  if(u.kind==='page'){if(u.id==='5.1')return n(bsNowList(st).length+st.explore.length+st.experiment.length+(st.operational||[]).length,'idea');if(u.id==='cap-hub')return (data.capital||{}).aiBudget?'Budget '+(data.capital||{}).aiBudget:'';if(u.id==='mgmt-hub'){var m=mgStats();return m.done+' of '+m.total+' steps'}return ''}
  if(u.kind==='record'){var i=+u.id;return (data.ideas||[])[i]?ideaStageWord(i,st):'No longer on the record'}
  if(u.kind==='text'){var words=String(u.html||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').trim().split(/\s+/).filter(Boolean).length;return words?n(words,'word'):'Nothing written yet'}
  return ''}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 172 — Add the function that describes what a section prints, in one sentence.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitFact` ends, after its closing `}`.

**Code:**

```js
function rcUnitDesc(u){var m={
    'out-report':'Where the organization stands before the pipeline begins: its purpose and frictions, its AI knowledge, its culture, its innovation record, and who holds each decision right.',
    'out-bluesky':'Every idea not yet selected for exploration: the qualified ideas ranked by their Filter & Rank score, the ideas not yet qualified, the ideas that did not pass, and the ideas parked for the future.',
    'out-orgready':'How the organization is set up to run the pipeline: who owns it, who leads it inside the functions, how incentives are changing, and the rhythm the work keeps.',
    'out-raci':'Who is Responsible, Accountable, Consulted, and Informed for each of the pipeline\u2019s seven activities.',
    'out-explore':'The ideas selected for exploration: the deepened assessment, the Go / No-Go verdict, and the horizon, risk, and reward each was graded.',
    'out-capplan':'A point-in-time picture of the portfolio\u2019s capital: every budget year, then the total.',
    'out-expbriefs':'The programs in development: each one\u2019s brief and its track to date.',
    'out-devport':'The programs in development: each one\u2019s brief and its track to date.',
    'out-govfw':'The three mechanisms that keep innovation governed after day 90: the standing leadership agenda, the pipeline intake rule, and the quarterly review.',
    'out-orgrev':'The stress test of the organization\u2019s design after the first cycle, and the adjustments planned.',
    'out-finalport':'The first quarterly review of the live portfolio: the Buy, Hold, or Sell call on every initiative with its reasons, the portfolio\u2019s balance and capital after the decisions, and what the quarter taught.',
    'out-oper':'The projects live in the business: each one\u2019s health, launch date, and performance against its success metric.',
    'page:5.1':'The pipeline as it stands: its maturity, how far each phase has come, the next session and review, and every idea by stage.',
    'page:cap-hub':'The portfolio\u2019s committed costs and remaining budget, in its three views: Dashboard, Commitments, Plan & Funding.',
    'page:mgmt-hub':'Every step of the module in one place: who owns it, when it is due, and how completion is pacing against the 90 days.',
    'record:idea':'This idea\u2019s full record: the idea, its ranking, its exploration, its portfolio placement, its capital, its development brief and track, its review, and its operations.'};
  return m[u.kind==='output'?u.id:u.kind==='page'?'page:'+u.id:u.kind==='record'?'record:'+u.type:'']||''} /* one sentence per kind of content, in the same words as the documents' own covers */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 173 — Add the function that reads the Individual Ideas filters.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitDesc` ends, after its closing `}`.

**Code:**

```js
function rcLeaderFilter(){return UI.rcF||(UI.rcF={q:'',st:'all'})} /* the Individual Ideas filters: a search, and the stage */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 174 — Add the function that changes an Individual Ideas filter.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcLeaderFilter` ends, after its closing `}`.

**Code:**

```js
function rcSetFilter(k,v){var F=rcLeaderFilter();F[k]=v;render();if(k==='q'){var el=document.querySelector('input[type=search][placeholder^="Search ideas"]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 175 — Add the function that decides whether an idea passes the Individual Ideas filters.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetFilter` ends, after its closing `}`.

**Code:**

```js
function rcLeaderPasses(rec,F){if(!rec)return false;var d=(data.ideas||[])[rec.i]||{};var q=(F.q||'').trim().toLowerCase();if(q&&((d.name||'')+' '+(d.dept||'')).toLowerCase().indexOf(q)<0)return false;if(F.st&&F.st!=='all'&&ideaStageWord(rec.i)!==F.st)return false;return true} /* an idea passes the Individual Ideas filters by name or department, and by stage */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 176 — Add the function that reads the saved reports.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcLeaderPasses` ends, after its closing `}`.

**Code:**

```js
function rcDefs(){if(!data.reportDefs)data.reportDefs=[];return data.reportDefs}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 177 — Add the function that creates a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDefs` ends, after its closing `}`.

**Code:**

```js
function rcNew(){var d={id:'rpt-'+Math.random().toString(36).slice(2,9),name:'New report',subtitle:'',intro:'',units:[],createdAt:Date.now()};rcDefs().push(d);UI.rcEdit=d.id;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 178 — Add the function that finds a saved report by its id.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcNew` ends, after its closing `}`.

**Code:**

```js
function rcFind(id){return rcDefs().find(function(d){return d.id===id})||null}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 179 — Add the function that saves a report's title, subtitle, or introduction.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFind` ends, after its closing `}`.

**Code:**

```js
function rcSet(id,k,v){var d=rcFind(id);if(!d)return;d[k]=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 180 — Add the function that saves a section's note.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSet` ends, after its closing `}`.

**Code:**

```js
function rcSetNote(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].note=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 181 — Add the function that saves a section's Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetNote` ends, after its closing `}`.

**Code:**

```js
function rcSetDepth(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].depth=v;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 182 — Add the function that adds a piece of content to a report or removes it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetDepth` ends, after its closing `}`.

**Code:**

```js
function rcToggle(id,key,depth){var d=rcFind(id);if(!d)return;var i=d.units.findIndex(function(u){return u.key===key});if(i>=0)d.units.splice(i,1);else{var c=rcCatalogue().find(function(u){return rcKey(u)===key});if(c)d.units.push({key:key,kind:c.kind,id:c.id,type:c.type||'',name:c.name,depth:c.depths?(depth==='full'?'full':'summary'):'',note:''})}saveData();render()} /* 14 Sep 2026: an option with a depth is added at the depth chosen */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 183 — Add the function that moves a section up or down.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcToggle` ends, after its closing `}`.

**Code:**

```js
function rcMove(id,i,dir){var d=rcFind(id);if(!d)return;var j=i+dir;if(j<0||j>=d.units.length)return;var t=d.units[i];d.units[i]=d.units[j];d.units[j]=t;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 184 — Add the function that deletes a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcMove` ends, after its closing `}`.

**Code:**

```js
function rcDelete(id){if(!confirm('Delete this report definition? The record it prints is untouched.'))return;data.reportDefs=rcDefs().filter(function(d){return d.id!==id});if(UI.rcEdit===id)UI.rcEdit=null;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 185 — Add the function that copies a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDelete` ends, after its closing `}`.

**Code:**

```js
function rcDuplicate(id){var d=rcFind(id);if(!d)return;var c=JSON.parse(JSON.stringify(d));c.id='rpt-'+Math.random().toString(36).slice(2,9);c.name=d.name+' (copy)';c.createdAt=Date.now();rcDefs().push(c);UI.rcEdit=c.id;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 186 — Add the function that gives a piece of content its key.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDuplicate` ends, after its closing `}`.

**Code:**

```js
function rcKey(u){return u.kind+':'+(u.type?u.type+':':'')+u.id}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 187 — Add the function that removes a document's first page when it becomes a section of a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcKey` ends, after its closing `}`.

**Code:**

```js
function _rcStripCover(doc){var i=doc.indexOf('min-height:85vh');if(i<0)return doc;var end=doc.indexOf('</div></div>',i);return end>0?doc.slice(end+12):doc} /* an output's own cover comes off inside a compiled report */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 188 — Add the function that keeps a section's first record on the same page as its heading.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_rcStripCover` ends, after its closing `}`.

**Code:**

```js
function rcFirstRecordStays(body){var a=body.indexOf('<table class="ly-rec"');if(a<0)return body;var b=body.indexOf('<table class="ly-rec"',a+10);var first=b>0?body.slice(a,b):body.slice(a);var fixed=first.replace('break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;','break-inside:auto;page-break-inside:auto;');return body.slice(0,a)+fixed+(b>0?body.slice(b):'')}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 189 — Add the function that builds the whole printed report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFirstRecordStays` ends, after its closing `}`.

**Code:**

```js
function rcCompile(id){ /* the whole document */
  var d=rcFind(id);if(!d)return '';
  var h=printDocCover(d.name||'Report',d.subtitle||'','');
  h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Contents</div>';
  d.units.forEach(function(u,i){h+='<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #eee;font-size:13px"><span style="font-family:var(--mono,monospace);color:#666;min-width:28px">'+(i+1)+'.</span><span>'+esc(rcUnitName(u))+(u.depth?' <span style="color:#888;font-size:11px">('+u.depth+')</span>':'')+'</span></div>'});
  var gaps=[];d.units.forEach(function(u,i){rcUnitGaps(u).forEach(function(g){gaps.push({sec:i+1,title:g.title,lines:g.lines})})});
  if(gaps.length){h+='<div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8B3A1E;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #8B3A1E">What is missing ('+gaps.length+')</div>';
    gaps.forEach(function(g){h+='<div style="font-size:12.5px;padding:4px 0;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);color:#666">'+g.sec+'.</span> <strong>'+esc(g.title)+'</strong> \u2014 '+g.lines.map(esc).join(' ')+'</div>'})}
  h+='</div>';
  if(d.intro&&d.intro.trim())h+='<div style="page-break-after:always"><div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111">Introduction</div><div style="font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap">'+esc(d.intro)+'</div></div>';
  d.units.forEach(function(u,i){h+=rcSection(u,i)});
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 190 — Add the function that builds one numbered section of the report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcCompile` ends, after its closing `}`.

**Code:**

```js
function rcSection(u,i){ /* one numbered section as the report carries it: the number at the title's size (Paul's ruling, 14 Sep 2026), the heading, the note, the body — one definition for the compiled report and for the section preview */
  var head='<div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111"><span style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#888;margin-right:12px">'+(i+1)+'</span>'+esc(rcUnitName(u))+'</div>';
  if(u.note&&u.note.trim())head+='<div style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;padding:10px 14px;border-left:3px solid #999;white-space:pre-wrap">'+esc(u.note)+'</div>';
  if(u.kind==='output'&&u.id==='out-raci')return '<div>'+rcUnitBody(u,head)+'</div>'; /* the RACI matrix opens on its own landscape page; the heading sits at the top of that page, never alone before it */
  var h='<div style="page-break-before:always">'+head;
  return h+rcUnitBody(u)+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 191 — Add the function that prints a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSection` ends, after its closing `}`.

**Code:**

```js
function rcPrint(id){var d=rcFind(id);if(!d)return;var doc=rcCompile(id);printDocumentPreview(d.name||'Report',doc)}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 192 — Add the function behind a text page's Save button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPrint` ends, after its closing `}`.

**Code:**

```js
function rcSaveText(id,i){var el=document.getElementById('rc_txt_'+(rcFind(id).units[i]||{}).id);if(el)rcSetTextHtml(id,i,el.innerHTML);var hd=document.getElementById('rc_head_'+(rcFind(id).units[i]||{}).id);if(hd)rcSetUnit(id,i,'name',hd.value);UI.rcSel=null;render()} /* Save keeps the text and the heading and closes the inspector */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 193 — Add the function behind a section's Preview this section button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSaveText` ends, after its closing `}`.

**Code:**

```js
function rcPreviewUnit(id,i){var d=rcFind(id);if(!d||!d.units[i])return;var u=d.units[i];var title=(d.name||'Report')+' \u2014 section '+(i+1);printDocumentPreview(title,rcSection(u,i).replace('page-break-before:always','page-break-before:auto'),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the section as the report carries it — its number, heading, note, and body — with no cover of its own */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 194 — Add the function that adds a text page to a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPreviewUnit` ends, after its closing `}`.

**Code:**

```js
function rcAddText(id,at){var d=rcFind(id);if(!d)return;var u={key:'text:'+Math.random().toString(36).slice(2,9),kind:'text',id:'',type:'',name:'',html:'',depth:'',note:''};u.id=u.key.slice(5);if(at==null||at>=d.units.length)d.units.push(u);else d.units.splice(at,0,u);UI.rcSel=u.key;saveData();render()} /* the new page opens in the inspector */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 195 — Add the function that saves a field of a section.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcAddText` ends, after its closing `}`.

**Code:**

```js
function rcSetUnit(id,i,k,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i][k]=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 196 — Add the function that removes a section by its position.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetUnit` ends, after its closing `}`.

**Code:**

```js
function rcRemoveAt(id,i){var d=rcFind(id);if(!d||!d.units[i])return;d.units.splice(i,1);saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 197 — Add the function that saves a text page's body.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcRemoveAt` ends, after its closing `}`.

**Code:**

```js
function rcSetTextHtml(id,i,html){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].html=rcSanitize(html);saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 198 — Add the function behind the Bold, Italic, and size buttons.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetTextHtml` ends, after its closing `}`.

**Code:**

```js
function rcFmt(uid,cmd,val){var el=document.getElementById('rc_txt_'+uid);if(!el)return;el.focus();
  if(cmd==='bold'||cmd==='italic'){document.execCommand(cmd,false,null)}
  else if(cmd==='size'){document.execCommand('fontSize',false,{small:'2',normal:'3',large:'5',heading:'6'}[val]||'3')}
  el.dispatchEvent(new Event('input'))}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 199 — Add the function that keeps only bold, italics, sizes, paragraphs, and line breaks in a text page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFmt` ends, after its closing `}`.

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

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 200 — Add the function behind the Preview the report button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSanitize` ends, after its closing `}`.

**Code:**

```js
function rcPreview(id){var d=rcFind(id);if(!d)return;printDocumentPreview(d.name||'Report',rcCompile(id),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the report as it will print, at any point in the assembly, without the print dialog */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 201 — Add the function that draws the Report Manager page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPreview` ends, after its closing `}`.

**Code:**

```js
function renderReports(){ /* the Report Manager page (More menu). 14 Sep 2026 (Paul's ruling): a report is assembled from Report Content Options on the right into Sections on the left; every option that has a depth is added at Summary or Full; individual ideas can be filtered; text pages with a heading and a formatted body can be added anywhere; the report can be previewed at any point; the introduction and notes are uncapped */
  var defs=rcDefs();var ed=UI.rcEdit?rcFind(UI.rcEdit):null;
  var h='<div class="content-area"><div class="content-inner rc-page"><h2 class="h-section">Report Manager</h2><p class="t-lead">Compile the outputs, the Phase 5 pages, and individual ideas into one printed document under one cover: a contents page, a list of what is missing, an introduction you write, and each piece as a numbered section. Add your own text pages wherever a part of the report needs an introduction. A saved report reprints with fresh data. The record itself is never edited here.</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 18px">'+btn('+ New report','rcNew()','bp')+'</div>';
  if(!defs.length)h+=card('<p style="color:var(--text-faint);text-align:center;padding:28px 0">No reports yet. Start one, choose what it contains, and print it.</p>');
  defs.forEach(function(d){var open=ed&&ed.id===d.id;
    h+='<div class="cd" style="margin-bottom:10px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(d.name||'Untitled')+'</div><div style="font-size:12px;color:var(--text-faint)">'+d.units.length+' section'+(d.units.length===1?'':'s')+(d.subtitle?' \u00b7 '+esc(d.subtitle):'')+'</div></div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+rcBtnG('Preview','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG(open?'Close':'Edit','UI.rcEdit='+(open?'null':'\''+d.id+'\'')+';render()','font-size:12px')+rcBtnG('Duplicate','rcDuplicate(\''+d.id+'\')','font-size:12px')+rcBtnG('Delete','rcDelete(\''+d.id+'\')','font-size:12px')+'</span></div>';
    if(open)h+=rcEditor(d);
    h+='</div>'});
  return h+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 202 — Add the function that draws the report editor.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderReports` ends, after its closing `}`.

**Code:**

```js
function rcEditor(d){ /* 14 Sep 2026 (Paul's ruling): the Order column is the report's contents being built — one compact row per section with its number, name, kind, a fact about its size, its depth, and a mark where a note is written; one row selected at a time opens the inspector beneath the list, which holds what the section prints, the depth, the note, a preview of that section alone, and for a text page its editor. The Content Options list keeps its size; Add a text page is its first row. */
  var cat=rcCatalogue();var chosen={};d.units.forEach(function(u){chosen[u.key]=1});
  var seg=function(active,label,fn,extra){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(active?'background:rgba(var(--fg-rgb),.10);color:var(--paper);':'')+(extra||'')+'" onclick="'+fn+'">'+label+'</button>'};
  var ico=function(glyph,fn,title,dim){return '<button class="btn-ghost" title="'+esc(title)+'" style="font-size:12px;padding:2px 7px;line-height:1.2;min-width:0;'+(dim?'opacity:.35;pointer-events:none;':'')+'" onclick="event.stopPropagation();'+fn+'">'+glyph+'</button>'};
  var h='<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(var(--fg-rgb),.10)">';
  /* the report's own words: title, subtitle, introduction */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+rcInp('Title','rc_name_'+d.id,d.name,'e.g. Board pack, September')+rcInp('Subtitle','rc_sub_'+d.id,d.subtitle,'One line under the title on the cover')+'</div>';
  h+='<script>document.getElementById(\'rc_name_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'name\',this.value);render()};document.getElementById(\'rc_sub_'+d.id+'\').onchange=function(){rcSet(\''+d.id+'\',\'subtitle\',this.value)};</script>';
  h+='<div class="mb-4"><label class="form-label">Introduction</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed after the contents page.</p><textarea rows="6" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSet(\''+d.id+'\',\'intro\',this.value)">'+esc(d.intro||'')+'</textarea></div>';
  /* the toolbar: preview and print; the Save as PDF here matches its neighbours (Paul's ruling, 14 Sep 2026: an exception to the quiet form, because it sits in a block of buttons) */
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 16px;padding:10px 12px;border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;background:rgba(var(--fg-rgb),.02)">'+rcBtnG('Preview the report','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+'<span style="font-size:12px;color:var(--text-faint);margin-left:6px">'+d.units.length+' section'+(d.units.length===1?'':'s')+'</span></div>';
  /* two panes: the sections in order (twice the width) and the content options (its own width) */
  h+='<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:24px;align-items:start">';
  /* left: the contents being built */
  var sel=UI.rcSel!=null?d.units.findIndex(function(u){return u.key===UI.rcSel}):-1;
  h+='<div><h4 style="font-size:14px;font-weight:700;margin:0 0 8px">Sections, in order</h4>';
  if(!d.units.length)h+='<p class="t-faint-sm" style="padding:14px;border:1px dashed rgba(var(--fg-rgb),.18);border-radius:8px">Nothing chosen yet. Add content from the options on the right. Each section you add appears here as a line of the contents.</p>';
  else{h+='<div style="border:1px solid rgba(var(--fg-rgb),.10);border-radius:8px;overflow:hidden">';
    var inspector=function(u,sel){var fact=rcUnitFact(u); /* 14 Sep 2026 (Paul's ruling): the inspector opens directly beneath the selected row, inside the list, so it is never off the page */
      h+='<div style="padding:14px 16px 16px 50px;border-top:1px solid rgba(var(--fg-rgb),.14);background:var(--bg-elev)">';
      h+='<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 6px"><span style="font-family:var(--serif);font-size:22px;line-height:1;color:var(--text-faint)">'+(sel+1)+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(u.kind==='text'?(u.name||'Untitled text page'):u.name)+'</span><span style="font-size:12px;color:var(--text-faint)">'+rcKindLabel(u)+'</span><span style="flex:1"></span>'+(u.kind!=='text'?rcBtnG('Preview this section','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px'):'')+rcBtnG('Close','UI.rcSel=null;render()','font-size:12px')+'</div>';
      if(u.kind==='text'){
        h+='<p class="t-faint-sm" style="margin:0 0 10px">A page you write, printed as its own numbered section. Use it to open a part of the report or to add a page of your own between sections.</p>';
        h+='<input type="text" id="rc_head_'+u.id+'" data-uncapped="1" value="'+esc(u.name||'')+'" placeholder="Heading for this text page" style="width:100%;font-size:15px;font-weight:600;margin:0 0 8px" onchange="rcSetUnit(\''+d.id+'\','+sel+',\'name\',this.value)">';
        h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin:0 0 6px">'+seg(false,'<b>B</b>','rcFmt(\''+u.id+'\',\'bold\')')+seg(false,'<i>I</i>','rcFmt(\''+u.id+'\',\'italic\')')+'<span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);align-self:center;margin:0 4px 0 8px">SIZE</span>'+seg(false,'Small','rcFmt(\''+u.id+'\',\'size\',\'small\')')+seg(false,'Normal','rcFmt(\''+u.id+'\',\'size\',\'normal\')')+seg(false,'Large','rcFmt(\''+u.id+'\',\'size\',\'large\')')+seg(false,'Heading','rcFmt(\''+u.id+'\',\'size\',\'heading\')')+'</div>';
        h+='<div id="rc_txt_'+u.id+'" contenteditable="true" class="rc-text-edit" style="min-height:260px;padding:14px 16px;border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;font-size:14px;line-height:1.7;background:rgba(var(--fg-rgb),.02);color:var(--paper);outline:none" oninput="rcSetTextHtml(\''+d.id+'\','+sel+',this.innerHTML)">'+rcSanitize(u.html||'')+'</div>';
        h+='<div style="display:flex;gap:8px;align-items:center;margin:10px 0 0">'+rcBtnS('Save','rcSaveText(\''+d.id+'\','+sel+')','#2A5A5A','font-size:12px')+rcBtnG('Preview this page','rcPreviewUnit(\''+d.id+'\','+sel+')','font-size:12px')+'<span style="font-size:12px;color:var(--text-faint)">Select text, then Bold, Italic, or a size.</span></div>';
      }else{
        h+='<p style="font-size:13px;color:var(--text-body);line-height:1.6;margin:0 0 10px">'+esc(rcUnitDesc(u))+(fact?' <span style="color:var(--text-faint)">('+esc(fact)+')</span>':'')+'</p>';
        if(u.depth!==undefined&&u.depth!=='')h+='<div style="margin:0 0 10px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:6px">DEPTH</span>'+seg(u.depth==='summary','Summary','rcSetDepth(\''+d.id+'\','+sel+',\'summary\')')+seg(u.depth==='full','Full','rcSetDepth(\''+d.id+'\','+sel+',\'full\')')+'</div>';
        h+='<label class="form-label">Note for this section</label><p class="t-faint-sm" style="margin:0 0 6px">Written by you and printed at the head of the section.</p><textarea rows="4" data-uncapped="1" style="width:100%;resize:vertical" onchange="rcSetNote(\''+d.id+'\','+sel+',this.value);render()">'+esc(u.note||'')+'</textarea>';
      }
      h+='</div>'};
    d.units.forEach(function(u,i){var on=(i===sel);var fact=rcUnitFact(u);var noted=(u.kind==='text')?!!(u.html&&u.html.replace(/<[^>]*>/g,'').trim()):!!(u.note&&u.note.trim());
      h+='<div onclick="UI.rcSel='+(on?'null':'\''+u.key+'\'')+';render()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:'+(i?'1px solid rgba(var(--fg-rgb),.06)':'none')+';'+(on?'background:rgba(var(--fg-rgb),.06)':'')+'">'
        +'<span style="font-family:var(--serif);font-size:17px;line-height:1;color:var(--text-faint);min-width:28px;text-align:right">'+(i+1)+'</span>'
        +'<span style="flex:1;min-width:0;font-size:13.5px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.kind==='text'?'<em style="font-style:normal;font-weight:600">'+esc(u.name||'Untitled text page')+'</em>':'<span style="font-weight:600">'+esc(rcUnitName(u))+'</span>')+'</span>'
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
    if(g==='Individual Ideas'){var F=rcLeaderFilter();
      h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px"><input type="search" placeholder="Search ideas by name or department" value="'+esc(F.q)+'" style="flex:1;min-width:160px;font-size:12px;padding:4px 8px" oninput="rcSetFilter(\'q\',this.value)"></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:0 0 6px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">STAGE</span>'+[['all','All'],['Blue Sky','Blue Sky'],['Exploration','Exploration'],['No-Go','No-Go'],['Development','Development'],['Operational','Operational']].map(function(x){return seg(F.st===x[0],x[1],'rcSetFilter(\'st\',\''+x[0]+'\')')}).join('')+'</div>';
      var shown=list.filter(function(u){return rcLeaderPasses(u.rec,F)});
      h+='<div style="font-size:11px;color:var(--text-faint);margin:0 0 2px">'+shown.length+' of '+list.length+' idea'+(list.length===1?'':'s')+(shown.length!==list.length?' shown':'')+'</div>';
      if(!shown.length)h+='<p class="t-faint-sm" style="padding:8px 0">No idea matches these filters.</p>';
      shown.forEach(function(u){h+=row(u)});
    }else list.forEach(function(u){h+=row(u)});
    h+='</div>'});
  h+='</div></div>';
  return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 203 — Add the line that registers the Pipeline Dashboard document so that the Report Manager can include it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcEditor` ends, after its closing `}`.

**Code:**

```js
PRINT_DOCS['5.1']=pipelineDashboardDoc; /* the dashboard, registered so the Report Manager can include it */
```

**Nothing to check yet.** This change becomes visible at Step 207.

---

### Step 204 — Add the line that registers the Assessment Report, Org Readiness, Governance Framework, Org Design Review, and RACI Matrix documents.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
PRINT_DOCS['5.1']=pipelineDashboardDoc; /* the dashboard, registered so the Report Manager can include it */
```

**Code:**

```js
PRINT_DOCS['out-report']=assessmentReportDoc;PRINT_DOCS['out-orgready']=orgReadinessDoc;PRINT_DOCS['out-govfw']=govFrameworkDoc;PRINT_DOCS['out-orgrev']=orgDesignReviewDoc;PRINT_DOCS['out-raci']=raciDoc;
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 205 — Add the line that registers the Capital Snapshot document so that the Report Manager can include it.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
PRINT_DOCS['out-report']=assessmentReportDoc;PRINT_DOCS['out-orgready']=orgReadinessDoc;PRINT_DOCS['out-govfw']=govFrameworkDoc;PRINT_DOCS['out-orgrev']=orgDesignReviewDoc;PRINT_DOCS['out-raci']=raciDoc;
```

**Code:**

```js
PRINT_DOCS['out-capplan']=function(){return '<style>'+CAP_REPORT_CSS+'</style>'+printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody()}; /* the Capital Snapshot Report as Paul ruled it on 13 Sep 2026, registered so the Report Manager can include it */
```

**Nothing to check yet.** This change becomes visible at Step 206.

---

### Step 206 — Add the line that registers the Capital Planning Hub document so that the Report Manager can include it.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
PRINT_DOCS['out-capplan']=function(){return '<style>'+CAP_REPORT_CSS+'</style>'+printDocCover('Capital Snapshot',capSnapLead(),'')+capReportBody()}; /* the Capital Snapshot Report as Paul ruled it on 13 Sep 2026, registered so the Report Manager can include it */
```

**Code:**

```js
PRINT_DOCS['cap-hub']=capHubDoc;
```

**Check (do each):**

1. Open Phase 2's Exploration Portfolio. Above the projects are SUMMARY and FULL and ▾ Save as PDF. With SUMMARY chosen, click ▾ Save as PDF: the first page; At a Glance with four figures; Exploration Portfolio Balance; then, on a new page, The Projects with the heading Go and each project as a card — its name bar with the department, the verdict and score at the right (Sales Knowledge Graph: Go · 31 / 50), the budget figures, and all eight Overview fields. Click FULL, then ▾ Save as PDF: each project takes a page of its own with the Overview card, the Analyses card (the gap analysis in colour and the SWOT in four tinted cells), and Portfolio Position, then a Budget page with four charts in boxes and the phase tables side by side; a project with no budget plan shows the line "No budget plan yet." and no Budget page. Open Phase 3's Development Portfolio and click ▾ Save as PDF: after At a Glance and the balance card, the programs' Development cards start on a new page with no heading above them; each card shows Objectives and Deliverables, the budget line, every phase with its owner, months, budget, success metrics, and exit gate, then Results to date.

2. In the sidebar, Phase 4's third output reads Portfolio Review. Open it: figures for Initiatives reviewed, Buy, Hold, and Sell; Capital After the Decisions; the decisions grouped Buy, Hold, Sell, each initiative with its stage, costs, and reason; Portfolio Learnings. Click ▾ Save as PDF: the same as a document, The Decisions following the capital figures on the same page, each group heading on the same page as its first initiative. Open Phase 5 and click ▶ Run Quarterly Review on the dashboard: a page headed Quarterly Portfolio Review opens with the review surface and its own ▾ Save as PDF, and the sidebar stays on Phase 5. Its Review Snapshot card shows only Intake Reserve; no empty section with a dash.

3. Open the More menu and choose Report Manager. Click + New report; type a title. In Report Content Options at the right, add Assessment Report, Exploration Portfolio at Summary, and Pipeline Dashboard (under Phase 5 pages). Click Preview the report: a first page, a contents page listing the three sections, then each section numbered, the Exploration Portfolio's cards among them. Under Individual Ideas, type "Sales" in the search: only the Sales Knowledge Graph and the Sales Proposal Drafter remain.

4. Open Phase 4's Governance Framework output and click ▾ Save as PDF: one page of the page's own cards — the Executive Summary in its tinted card, then Standing Leadership Agenda, Pipeline Intake Rule, and Quarterly Review, each with a coloured rule at its left. Open the Org Design Review and click ▾ Save as PDF: the four stress-test boxes in two rows, each with its score in a coloured chip, then the adjustment plan.

---

### Step 207 — Add the function behind a Phase 5 page's Save as PDF button. The Pipeline Dashboard, the Capital Planning Hub, the Module Management page, the Quarterly Review page, and the live portfolio pages now print their own documents.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
PRINT_DOCS['cap-hub']=capHubDoc;
```

**Code:**

```js
function printCurrentPage(){ /* 16 Sep 2026: the Phase 5 pages print their own documents; any other step prints its page under a cover */
  if(currentPage==='cap-hub'){printCapHub();return}
  if(currentPage==='mgmt-hub'){printMgmtAnalytics();return}
  if(currentPage==='review'){printDocument('Portfolio Review',portfolioReviewDoc(),'');return} /* 17 Sep 2026: the review page prints the Portfolio Review */
  if(currentPage==='portfolio'){printCurrentOutput();return} /* a live portfolio page prints its output's document */
  if(currentPage==='phase5'||currentStep==='5.1'){printDocument('Pipeline Dashboard',pipelineDashboardDoc(),'');return}
  var id=currentStep;var title=stepNameOf(id);
  UI._printing=1;var body='';try{body=renderStepContentBody(id)}finally{UI._printing=0}
  printPage(title,function(){return body});
}
```

**Check:** Open Phase 5 (the Pipeline Dashboard). Its header carries ▾ Save as PDF; click it: the first page, then Pipeline Overview with the maturity gauge and its four phase bars, the two cards Next Innovation Session and Next Quarterly Review as the page shows them, and Operational Projects with each project's status in colour; then, on a new page with no heading, the four chevrons and a box per portfolio in its colour listing its items, followed at once by Portfolio at a Glance with every chart in a box. Click View Portfolio → on the Blue Sky card: the Blue Sky Portfolio page opens with the sidebar still on Phase 5, not on Phase 1.

---

### Step 208 — Add the function that opens or closes a phase's Outputs line in the sidebar.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCurrentPage` ends, after its closing `}`.

**Code:**

```js

/* SIDEBAR OUTPUTS FOLD (Paul's ruling, 12 Sep 2026; family): a phase's outputs sit behind one folded line beneath its steps, so the sidebar stays uncramped and the list of outputs can grow. The fold opens when the user clicks it, and opens itself while one of its outputs is the page being viewed. */
function toggleNavOutputs(phId){UI.navOutOpen=UI.navOutOpen||{};UI.navOutOpen[phId]=!UI.navOutOpen[phId];render()}
```

**Nothing to check yet.** This change becomes visible at Step 209.

---

### Step 209 — Add the function that says whether a phase's Outputs line in the sidebar is open.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `toggleNavOutputs` ends, after its closing `}`.

**Code:**

```js
function navOutputsOpen(ph){UI.navOutOpen=UI.navOutOpen||{};if(UI.navOutOpen[ph.id])return true;return (ph.outcomes||[]).some(function(o){return (currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id})}
```

**Check:** Open the sidebar and open Phase 1. Under its steps one line reads ▸ Outputs (2). Click it: Assessment Report and Blue Sky Portfolio appear beneath it. Phase 4's line reads ▸ Outputs (3) and, opened, lists Governance Framework, Org Design Review, and Portfolio Review.

---

## 5. The stylesheet

Four changes to `styles.css`, in this order. In each, find the line that reads exactly as shown, confirm that it appears once, and add the new line immediately after it.

**Change 1.** Find:

```css
.bg2{background:transparent;color:var(--stone);border:1px solid var(--border-faint)}
```

Add after it:

```css
.btn.bg2{white-space:nowrap;padding:7px 14px;border-radius:6px;align-self:flex-start;height:fit-content}
```

**Change 2.** Inside the block that begins `@media print{` under the comment `/* Print-friendly */`, find the two lines that read, in this order:

```css
  body{background:#fff;color:#000}
  .main-content{margin-left:0!important}
```

(The second line also appears once more, later in the file, in a different block; use the one that follows `body{background:#fff;color:#000}`.) Add these four lines immediately after the second of them:

```css
  button,.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none!important}
  select{-webkit-appearance:none;appearance:none;border:none;background:none}
  textarea{border:none;background:none;resize:none}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
```

**Change 3.** Find:

```css
.flx-between-top-mb{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}
```

Add after it:

```css
.flx-between-top-mb>:first-child{flex:1 1 0;min-width:0}.flx-between-top-mb>:last-child{flex-shrink:0} /* 13 Sep 2026 (Paul): the heading text wraps in its own column so the Save as PDF control sits on the title line, right-justified, instead of dropping below */
```

**Change 4.** Find:

```css
.main-content .content-inner{margin-left:max(0px,calc(50vw - var(--sbw) - 450px));margin-right:auto;transition:margin-left .25s cubic-bezier(.16,1,.3,1)}
```

Add after it:

```css
.content-inner.rc-page{max-width:1350px;margin-left:max(0px,calc(50vw - var(--sbw) - 675px))} /* 16 Sep 2026 (Paul's ruling, family): the Report Manager's 1350px block centres on the page when the sidebar is closed; the shared formula above is written for the 900px column */
```

**Check:** Open any output page: the ▾ Save as PDF button is a small outlined button, not a filled one, sitting on the title line at the right. Open the More menu and choose Report Manager; close the sidebar with the ◧ toggle: the page centres on the screen. Open the sidebar: the page sits beside it.

## 6. The test suite

Take the file `harness.js` (md5 `226ed601`) that comes with this document, whole. Do not edit it. Put it in a folder with your finished `app.js` and `styles.css`, and run `node harness.js` in that folder. Its result must read `PASS: 1829` and `FAIL: 0`. It needs Node.js and nothing else; it does not need a browser.

## 7. The example data

Step 63 changes the example data. The Checks and the acceptance checks assume the example data is loaded. To load it: sign in, open the More menu (the ··· button at the top right), and choose Seed sample data. Confirm when asked ("Load sample data? This overwrites any existing entries."). The organization's records are replaced by the example organization's ideas, projects, programs, and first quarterly review.

## 8. Acceptance checks

1. Open Phase 4's Governance Framework output and click ▾ Save as PDF. A new window opens. Its first page shows, from the top: the line NEXTCHAPTER · 90-DAY AI INNOVATION PIPELINE; the title Governance Framework; a subtitle; a horizontal rule; the organization's name; today's date as words. In the print dialog's preview, every page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number at the bottom right; nothing prints at the top. The content is one page: the Executive Summary in its tinted card, then Standing Leadership Agenda, Pipeline Intake Rule, and Quarterly Review, each with a coloured rule at its left. No button prints.
2. Open Phase 1's Assessment Report. Two small buttons SUMMARY and FULL sit beside ▾ Save as PDF. Click FULL, then ▾ Save as PDF: the executive summary in a box, At a Glance, the Readiness Profile bars with the radar chart beneath them, then Purpose and Direction with each written answer in a quoted block, AI Knowledge Base, Risk and Culture with five-cell strips, AI Innovation Audit, and Decision Rights.
3. Open Phase 1's Blue Sky Portfolio and click ▾ Save as PDF: At a Glance, the Portfolio Balance as three rows of bands, then on a new page the ideas as record tables under Now, then For the Future.
4. Open Phase 2's Org Readiness. The page shows a summary, three figures, the Organizational Readiness Checklist with the record behind each check (for the owner: "Shalini Mehta, VP Innovation: Full budget authority for AI portfolio under $2M per initiative"), then Pipeline Owner, Innovation Rhythm, Embedded Leads, Engaged Senior Leaders, and Incentive Changes. Click ▾ Save as PDF: the summary, At a Glance, the checklist with a black tick per check met and "7 of 7 complete", then Pipeline Owner, Embedded Leads (a table), Engaged Senior Leaders (a table), Realigned Incentives, and Innovation Rhythm as quoted blocks, with no step numbers under the headings.
5. Open Phase 2, step 2.1 (Ownership & Structure) and scroll to the RACI matrix. Each letter sits on a round coloured chip; a legend beneath reads R Responsible — does the work, A Accountable — owns the decision, exactly one per activity, C Consulted — input before, I Informed — told after. Click an empty cell: it cycles R, A, C, I, then blank. Add a fifth embedded lead at the top of the step: the matrix gains a column. Open the RACI Matrix output and click ▾ Save as PDF: the matrix alone, centred on a sideways page, with the same chips and legend.
6. Open Phase 2's Exploration Portfolio. With SUMMARY chosen, click ▾ Save as PDF: At a Glance with four figures; Exploration Portfolio Balance; then on a new page The Projects, the heading Go, and each project as a card — the name bar with the department, and at the right the verdict and score (Sales Knowledge Graph: Go · 31 / 50); under the bar the budget figures in black — Lifetime cost, Development costs, Rollout costs, Annual sustainment costs — then "With 10% contingency: $580K lifetime. · First operational month: Month 8." and "Monthly costs peak at Month 3: $95K per month."; then all eight Overview fields. The heading Go is on the same page as the first card.
7. Still on the Exploration Portfolio, click FULL, then ▾ Save as PDF: each project takes a page of its own with the Overview card (its figures now larger and blue), the Analyses card (Gap analysis with Have in green and Gap in amber, then the SWOT as four tinted cells: green, red, blue, amber), and Portfolio Position; then a Budget page with the four charts each in a box — Monthly spend shape, Step timeline, How the lifetime total builds, Cumulative cost — and beneath them Development phases, Rollout steps, and Sustainment side by side, all on one page. A project with no budget plan shows the line "No budget plan yet." under Portfolio Position and has no Budget page.
8. On the Exploration Portfolio, click the Allocate Capital tab, then 1 · Sandbox. The Sandbox card's heading line carries ▾ Save as PDF. Tick three candidates and click it: the first page is titled Capital Sandbox with the subtitle "A capital expenditure scenario staging a specified batch of projects."; then The Staged Batch listing the three with score, development, rollout, sustainment, and start; On the Calendar with the waterfall; Cumulative Commitments Against Capacity; The Committed Calendar; and The Years as a table with a line per year and a total, its figures in thousands such as $2,400K. Tick different candidates and print again: a different document.
9. Open Phase 3's Capital Snapshot and click ▾ Save as PDF: one section per budget year — Year 1, Year 2, Year 3 — each starting on a new page with its figures, its committed calendar, and its capacity waterfall, then a final section for the total.
10. Open Phase 3's Development Portfolio. With SUMMARY chosen, click ▾ Save as PDF: At a Glance, Development Portfolio Balance, then on a new page the programs' Development cards with no heading above them — each card's name bar with its status in colour and its score; Development program with Objectives and Deliverables, the budget line, then each phase as "Phase n — name · owner · months · budget" with its description and its Success metrics and Exit gate; Development track with Results to date; and a Portfolio position line. Click FULL, then ▾ Save as PDF: each program takes its Development card page, then its project page (Overview, Analyses, Position), then its Budget page with Rollout steps and Sustainment only — no development phases table, since the card carries the phases.
11. Open Phase 4's Org Design Review and click ▾ Save as PDF: the four stress-test boxes in two rows of two, each with its score in a coloured chip (green at 4 or more, brown at 3, red below), then the adjustment plan.
12. In the sidebar, Phase 4's third output reads Portfolio Review. Open it: four figures Initiatives reviewed, Buy, Hold, Sell in colour; Capital After the Decisions; the decisions grouped Buy, Hold, Sell, each initiative with its stage, its costs, the decision in colour, and its reason; Portfolio Learnings. Click ▾ Save as PDF: At a Glance; Capital After the Decisions; The Decisions following on the same page, each group heading on the same page as its first initiative and each card with its reason quoted; Portfolio Balance After the Review; Portfolio Learnings as labelled plain text. There is no SUMMARY / FULL choice.
13. Open Phase 5 (the Pipeline Dashboard). Its header carries ▾ Save as PDF; click it: Pipeline Overview with the maturity gauge, its score and PIPELINE MATURITY beneath, and beside it the four bars Diagnose, Organize, Prepare, Ignite as the page draws them; the two cards Next Innovation Session (Tue at 9:00 AM; 30 min · attendees) and Next Quarterly Review (End of week 12) as the page shows them; Operational Projects with each project's status in colour — On track, Watch, At risk, or Killed; then on a new page with no heading the four chevrons, and a box per portfolio in its colour — Blue Sky, Exploration, Development, Operational — listing its items two-up under sub-groups such as Now and For the future, Go and No-Go, Running, On track and Watch; followed at once by Portfolio at a Glance with every chart in a box, the Balance Map among them.
14. On the Pipeline Dashboard, click ▶ Run Quarterly Review: a page headed Quarterly Portfolio Review opens with the review surface — Buy / Sell / Hold Analysis, Portfolio Balance, Portfolio Learnings — and its own ▾ Save as PDF, which prints the Portfolio Review document. The sidebar stays on Phase 5. Change a decision here, then open Phase 4, step 4.4: the decision has changed there too.
15. On the Pipeline Dashboard, click View Portfolio → on the Blue Sky card: the Blue Sky Portfolio opens as a live page, headed by an Ongoing badge and a line saying it is the live portfolio; the sidebar stays on Phase 5, not Phase 1. Click ▾ Save as PDF: the Blue Sky Portfolio document prints. Do the same from the Exploration, Development, and Operational cards, and from the chevron strip.
16. Open Phase 5's Operational Portfolio. Click ▾ Save as PDF: At a Glance, Operational Portfolio Balance, then the projects' Operations cards with no heading above them — the name bar with the health in colour (Green or Amber on the example data), Owner at the top left and Launch date at the top right, Rollout costs at the bottom left and Annual sustainment cost at the bottom right, then Success metrics, Performance vs. success metric, and Ongoing notes. Click FULL, then ▾ Save as PDF: each project's Operations card page, then its project page, then its Budget page, then its Development card page.
17. Open Phase 5's Capital Planning Hub and click ▾ Save as PDF: the first page, then the tab showing, with its form fields printed as their values and no control.
18. Open Phase 4, step 4.4. The Review Snapshot card shows Intake Reserve only; no section headed Start Date Drift, Launch Variance, Overrides, or Sustainment Cap with a dash beneath it.
19. Open the sidebar. Under Phase 1 the steps are followed by one line reading ▸ Outputs (2); click it and Assessment Report and Blue Sky Portfolio appear. Under Phase 4 the line reads ▸ Outputs (3) and lists Governance Framework, Org Design Review, and Portfolio Review.
20. Open the More menu and choose Track Program. Click ▾ Save as PDF: the first page is titled Module Management; the next shows four figures, This Week, and the steps of Phases 1 to 4 with their owners and state; the page after is headed Analytics.
21. Open the More menu and choose Report Manager. The sidebar and its ◧ toggle are present; close the sidebar and the page centres. Click + New report, type a title, and add Assessment Report, Exploration Portfolio at Summary, and Pipeline Dashboard (under Phase 5 pages) from Report Content Options. Click Preview the report: a first page, a contents page listing the three sections, then each section numbered, the Exploration Portfolio's cards among them. Under Individual Ideas, type "Sales" in the search: only the Sales Knowledge Graph and the Sales Proposal Drafter remain; add the Sales Knowledge Graph: its section prints its project record.
22. Run the test suite (section 6). The harness reports PASS: 1829 and FAIL: 0.

## 9. Checklist

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
- [ ] Acceptance check 21
- [ ] Acceptance check 22
