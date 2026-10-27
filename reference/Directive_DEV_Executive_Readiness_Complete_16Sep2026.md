# Executive Readiness module — changes to make, step by step
## Printed documents, record tables, the organization chart, and the Report Manager

**What this document is.** A list of 184 changes to the Executive Readiness module's `Exec-Readiness-app.js`, to be made in order, followed by one change to `Exec-Readiness-styles.css`. Your code descends from the file Paul gave you on 12 September (md5 `38ba0cd9`, 7,199 lines), but it is your own: you have deployed it and may have changed it since. This document therefore never gives a line number. Every place is named by a function or by the exact text of a line, which you find with your editor's search (Ctrl+F). With this document you receive the finished offline build, `Exec-Readiness-app.js` (md5 `94698c5b`, 7,714 lines), as a reference, together with `Exec-Readiness-styles.css` (md5 `32077d14`) and the two test suites. Every block of code in this document is copied from the reference build byte for byte, and you can open that file to see any block in its surroundings. The steps were derived by comparing the 12 September file with the reference build unit by unit and proved by applying them, in this order, to a fresh copy of the 12 September file: the result is the reference build byte for byte. This document replaces the three earlier Executive Readiness documents — the printing directive of 12 September, the L&D Hub report directive of 13 September, and the reporting directive of 15 September. Do not apply those; apply this one, from the 12 September file.

## 1. How to apply this document

- Apply the steps in order, from Step 1 to Step 184, then the stylesheet change in section 5. Do not skip a step. Do not change the order.
- Before each step, find the place the step describes. Confirm that it is there exactly once.
- When a step replaces a whole function or constant, delete your whole function or constant and put the step's code in its place. If you have changed that function yourself since 12 September, compare your function with the reference build first, and keep your own changes if they are unrelated to this document.
- When in doubt, use the whole function from the reference build rather than editing lines inside it.
- Load the example data (section 7) before you begin, so that the Checks have something to show. Load it again after Step 44, which changes the example data.
- 9 of the 184 steps have a Check: something to open in the app and see. Do the Check after each of those steps. If the Check fails, stop and report the step number. The other 175 steps end with the line "Nothing to check yet", which names the later step where the change becomes visible. Where one step carries several Checks, do each.
- At the end, run the two test suites described in section 6.
- Then do the acceptance checks in section 8.

## 2. Glossary

Rule for this document: no metaphors and no new words. Each term below is used in the steps and the checks with exactly this meaning.

- **Output** — one of the thirteen documents the module produces at the end of its steps: Readiness Report, Leadership Inventory, Risk Map (Phase 1); Leadership Structure, Collaboration Principles, Competency Framework (Phase 2); Fluency Assessment, Decision Analyses, MM Principles, Values Architecture (Phase 3); Operating Rhythm, Evaluation Plan, Review Report (Phase 4). Each has a page in the app, listed in the sidebar under its phase.
- **Output page** — the page in the app that shows an output.
- **Phase 5 page** — one of the three pages of Phase 5: Leadership Dashboard (step 5.1), L&D Hub (5.2), My Development (5.3).
- **Printed document** — what appears in the new window when the user clicks ▾ Save as PDF: a first page with the title, then the content, laid out for printing or saving as a PDF.
- **First page** (of a printed document) — the page that shows, from the top: the line NEXTCHAPTER · 90-DAY EXECUTIVE READINESS; the title; a subtitle; a horizontal rule; the organization's name; today's date as words.
- **Print window** — the new browser window that opens when the user clicks ▾ Save as PDF. The browser's print dialog opens over it.
- **Save as PDF button** — the small button reading ▾ Save as PDF. It is drawn with the HTML `<button class="btn bg2" style="font-size:12px">`.
- **Record** — one leader, or one leadership risk, with everything the module has stored about it.
- **Record table** — how a record prints: a table whose first row is the record's name and its main facts, then one section per part of the record, each section a list of labelled rows.
- **Part of a record** — the fields a record gains at one stage of the module. A leader has parts named Leadership landscape, Competency scores, AI fluency sprint, First leadership review, and Development. In the code these are called layers.
- **Summary / Full** — a choice of how much prints. For a record table, Summary prints the main rows of each part and Full prints every row; for the Values Architecture, Full adds an appendix; for the Leadership Dashboard, Summary prints a table of roles and Full prints one page per role. On screen the choice is two small buttons reading SUMMARY and FULL.
- **Register** — a printed list of record tables, with group headings where the records are grouped (for example Developed, Progressing, Needs Support, Hard Conversation in the Review Report).
- **Missing line** — a line at the end of a record table that begins with ▸ and names a part the record should have but does not, for example "▸ No competency scores recorded."
- **Section heading** — in a printed document, a heading in the serif face with a rule beneath it; when it has a sub-line, the sub-line sits on its own line under the title in the monospace face.
- **Appendix** — a part of a printed document that starts on a new page headed Appendix, with the section's own title beneath that word.
- **Organization chart** — the chart of roles and reporting lines. It appears on step 1.2 (Leadership Landscape), on step 1.2's Assign Hierarchy view, on the Leadership Dashboard, and in the printed Leadership Structure and Leadership Inventory documents.
- **Landscape page** — a printed page turned sideways, wider than it is tall. The organization chart prints on one, as does the L&D Hub's competency heat map.
- **Report Manager** — a page in the More menu (the ··· button at the top right) where the user assembles several outputs and pages into one printed report.
- **Report** — what the Report Manager prints: a first page, a contents page, an introduction, then each chosen item as a numbered section.
- **Section** — one item of a report: an output, a Phase 5 page, a single leader or risk, or a text page, printed with a number and a heading.
- **Text page** — a section the user writes: a heading and a body.
- **Module Management page** — the page reached from the More menu item Track Program. Its heading reads Module Management.
- **Example data** — the sample organization the app can load, Aurora Windows, with its leaders, roles, and records. In the code it is `seedData`.
- **Test suites** — the file `Exec-Readiness-boot-smoke.js`, which loads the app in a test browser and checks it, and the file `Exec-Readiness-harness.js`, which does the same for the app's behaviour.
- **Sidebar** — the menu at the left listing the phases, their steps, and their outputs.
- **More menu** — the menu that opens from the ··· button at the top right.
- **Fold** — a line of a page that is closed and opens on click, marked with a small triangle ▸ or ▾.

## 3. What the user will see when everything is done

**On every output page**
- The ▾ Save as PDF button opens a print window with a printed document: the first page as defined in the glossary, then the content laid out for paper, with no control.
- Each printed page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as "2 / 7" at the bottom right. Nothing prints at the top left or the top right. Colours print where the document uses them.
- The Leadership Inventory, Competency Framework, Fluency Assessment, and Review Report pages show each leader as a record table. The Competency Framework and Review Report pages show two small buttons SUMMARY and FULL above their lists; their printed documents use the same choice. The Fluency Assessment shows each leader's Task 1, Task 2, and Task 3 with no such choice.
- The Leadership Inventory prints the organization chart on a landscape page after the first page, then At a Glance with four figures, then the leaders under the heading The Leaders, then The Landscape. The Competency Framework prints Development Priorities as bars and starts the leaders on a new page. The Fluency Assessment prints The Team Project, then the leaders on a new page headed Individual Fluency Sprints. The Review Report prints the Structural Review in a red box with Working Well in green and Needs Revision in red, then the four counts in coloured boxes, then a new page headed Individual Leader Reviews with the leaders grouped.
- The Leadership Structure, Collaboration Principles, Operating Rhythm, and Evaluation Plan print as sections of labelled rows; no section is split across two pages. The Decision Analyses prints its four scenarios as four boxes in two rows. MM Principles prints in four sections without colour. The Values Architecture prints in five sections without colour, and at Full adds an appendix of each leader's reflections.
- In every printed document, a section heading's sub-line sits on its own line under the title.

**In the sidebar**
- Under each phase's steps, one line reads ▸ Outputs (n). Clicking it shows the phase's outputs. It is open while one of them is being viewed.
- The sidebar and its ☰ toggle also show on the Report Manager page.

**On the Phase 5 pages**
- The L&D Hub and My Development pages have the ▾ Save as PDF button at the top and print their own documents. The L&D Hub prints its competency heat map on a landscape page, then Study Progress and Practice Health, each page headed L&D HUB with no page count of its own.
- The Leadership Dashboard's toolbar reads Add Role, Add New Leader, Save, then the buttons SUMMARY and FULL, then ▾ Save as PDF; the Print Org Chart button is gone. The document it prints is titled Leadership Structure: the first page; the organization chart alone on a landscape page headed Org Chart, filling the page; at Summary a page headed Role Details; at Full one page per role in its coloured box; and last a page headed Appendix with the Competency Summary beneath.
- The organization chart, on screen and on paper, shows every role title in full on up to two lines; below the executives, their reports hang in a column under each one; the AI Transformation Council sits beside the Chief Executive Officer with a dashed border. The chart on step 1.2 and the chart on the dashboard draw the same boxes.

**In the More menu**
- Track Program prints a document titled Module Management: four figures, This Week, the steps of Phases 1 to 4 with their owners and state, and a page headed Analytics.
- An item reads Report Manager. It opens a page, centred when the sidebar is closed, where the user creates a report, adds outputs, Phase 5 pages, single leaders or risks, and text pages to it, orders them, previews the report, and prints it. The Leadership Dashboard appears in it as Leadership Structure; its section and the L&D Hub's begin on their landscape pages with the section heading at the top of that page.

---

## 4. The steps

### Step 1 — Delete the function named `renderStepContent` from its old place; it returns, changed, at Step 68.

**Kind:** Delete existing code.

**Where:** Delete the whole function named `renderStepContent`. It is added again, in its new place, at Step 68.

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 2 — Delete the function named `renderDashboard` from its old place; it returns, changed, at Step 69.

**Kind:** Delete existing code.

**Where:** Delete the whole function named `renderDashboard`. It is added again, in its new place, at Step 69.

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 3 — Replace the function that draws the current page, so that it knows the Report Manager page.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `render`.

**Code:**

```js

function render(){
  try{notifySweepDeadlines()}catch(e){}
  var _fEl=document.activeElement,_fid=_fEl&&_fEl.id,_fsel=(_fEl&&typeof _fEl.selectionStart==='number')?_fEl.selectionStart:null;
  var navEl=document.querySelector('nav'), ftEl=$('appFooter');
  if(!currentOrgId || !currentUserId || !getCurrentUser()){
    var _nt=$('navTabs'),_nr=$('navRight');
    if(_nt)_nt.innerHTML=''; if(_nr)_nr.innerHTML='';
    if(navEl)navEl.style.display='none';
    if(ftEl)ftEl.style.display='none';
    var _sb=$('pipSidebar'); if(_sb)_sb.style.display='none';
    var _stb=$('sidebarToggle'); if(_stb)_stb.style.display='none';
    var _ap=$('app'); if(_ap){_ap.className='main-content sidebar-collapsed'; _ap.innerHTML=renderEntry();}
    var _ef=document.querySelector('.login-screen input'); if(_ef && document.activeElement!==_ef && !(UI.entry&&UI.entry.err)) _ef.focus();
    updateAdminBar();
    return;
  }
  if(navEl)navEl.style.display=''; if(ftEl)ftEl.style.display='';
  // Capture any unsaved field input before the DOM is replaced, so clicking an
  // example, an Add button, or any other re-render trigger never clears typed text.
  // harvestFields() is fully guarded (no-ops on pages without matching fields).
  try{harvestFields();}catch(e){}
  renderNav();
  var h='';
  // Screens migrated to <name>.html + <name>.js (see screen-loader.js).
  // Each entry maps a page id to its container-based render function.
  var SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn};
  var screenFn=SCREEN_MODULES[currentPage];
  if(screenFn){screenFn($('app'));}
  else if(currentPage==='insights')h=renderInsights();
  else if(currentPage==='readiness')h=renderOverview();
  else if(currentPage==='step')h=renderStep();
  else if(currentPage==='phaseHome')h=renderPhaseHome(parseInt(currentStep));
  else if(currentPage==='phase5')h=renderDashboard();
  else if(currentPage==='outcome')h=renderOutcomePage();
  else if(currentPage==='mgmt-hub')h=renderMgmtHub();
  else if(currentPage==='reports')h=renderReports(); /* 14 Sep 2026: the Report Manager page */
  if(!screenFn){
    var _zs=(UI.zoom&&UI.zoom!==1)?(' style="zoom:'+UI.zoom+'"'):'';
    $('app').innerHTML='<div class="zoom-wrap" id="zoomWrap"'+_zs+'>'+h+'</div>';
    if(_fid){setTimeout(function(){try{var _fe2=document.getElementById(_fid);if(_fe2&&typeof _fe2.focus==='function'){_fe2.focus();if(_fsel!=null&&typeof _fe2.setSelectionRange==='function')_fe2.setSelectionRange(_fsel,_fsel)}}catch(_e){}},0)}
  }
  // Scroll-to-editor (ruled 16 July): any edit card opened by clicking a tab or a
  // non-edit card scrolls into view after the repaint. Set-sites assign UI.scrollTo
  // to the wrapper id; the flag clears immediately so later re-renders stay put.
  if(UI.scrollTo){(function(_sid){setTimeout(function(){try{var _el=document.getElementById(_sid);if(_el&&typeof _el.scrollIntoView==='function')_el.scrollIntoView({behavior:'smooth',block:'center'});}catch(_e){}},30);})(UI.scrollTo);UI.scrollTo=null;}
  renderSidebar();
  carouselInit();
  syncNavHeight();
  updateNotesCount();
  updateAdminBar();
  var _gk=currentStep+'/'+(UI.sec||'')+'/'+(UI.mfTab||'')+'/'+(UI.crTab||'');if(_gk!==_lastGateStep){gateArmed=false;_lastGateStep=_gk;}if(gateArmed)paintGates();
  applyLockUI(true);
}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 4 — Replace the function that draws the top navigation, so that the More menu lists the Report Manager.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderNav`.

**Code:**

```js

function renderNav(){
  var pages=[{id:'home',l:'Home'},{id:'learn',l:'Learn'},{id:'readiness',l:'Readiness'},{id:'phase5',l:'Lead'},{id:'insights',l:'Insights'}];
  var th='';for(var i=0;i<pages.length;i++){var p=pages[i];var act=currentPage===p.id||((currentPage==='step'||currentPage==='phaseHome'||currentPage==='outcome')&&p.id==='readiness');th+='<button class="nav-tab'+(act?' active':'')+'" onclick="go(\''+p.id+'\')">'+p.l+'</button>'}
  var nt=$('navTabs');if(nt)nt.innerHTML=th;
  var cu=getCurrentUser();
  var _zz=UI.zoom||1;var _zp=Math.round(_zz*100);
  var navMoreHtml=UI.navMore?(
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
      '<button class="nav-more-item'+(currentPage==='mgmt-hub'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'mgmt-hub\')"><span class="nav-more-ic">\u25a6</span> Track Program</button>'+
        '<button class="nav-more-item'+(currentPage==='reports'?' nav-action-on':'')+'" role="menuitem" onclick="closeNavMore();go(\'reports\')"><span class="nav-more-ic">\u25a7</span> Report Manager</button>'+ /* 14 Sep 2026 (Paul's ruling): the Report Manager's door */
      '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();toggleVoice()"><span class="nav-more-ic">&#9673;</span> Voice</button>'+
      '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openOrg()"><span class="nav-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span> Profile</button>'+(isAppAdmin?'<button class="nav-more-item" role="menuitem" onclick="closeNavMore();openAdmin()"><span class="nav-more-ic">&#9638;</span> Admin</button>':'')+
      '<div class="nav-more-sep"></div>'+
      '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();seedData()"><span class="nav-more-ic">\u21BB</span> Seed sample data</button>'+
      '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();exportState()"><span class="nav-more-ic">&#8595;</span> Export state</button>'+
      '<button class="nav-more-item" role="menuitem" onclick="closeNavMore();importState()"><span class="nav-more-ic">&#8593;</span> Import state</button>'+
      '<button class="nav-more-item nav-more-danger" role="menuitem" onclick="closeNavMore();clearData()"><span class="nav-more-ic">\u2715</span> Reset all data</button>'+
    '</div>'
  ):'';
  var nr=$('navRight');
  if(nr)nr.innerHTML=(cu?'<div class="nav-user-chip" onclick="signOut()" title="Click to sign out">'+userAv(cu,26)+'<div class="nav-user-name">'+esc(cu.name.split(" ")[0])+'</div></div>':'')+
    '<button class="btn-ghost pad-chip-md nav-action" onclick="openHelp()" title="Help">? Help</button>'+
    '<button class="btn-ghost pad-chip-md nav-action" onclick="toggleTheme()" title="Switch theme">\u25d0 '+(UI.theme==='dark'?'Light Mode':'Dark Mode')+'</button>'+
    '<button id="gchatNavBtn" class="btn-ghost pad-chip-md nav-action'+(gchatOpen?' nav-action-on':'')+'" onclick="toggleGChat()">\u2261 Team Chat<span id="gchatUnread" class="gchat-unread" style="display:'+(gchatUnreadCount>0?'':'none')+'">'+gchatUnreadCount+'</span></button>'+
    '<button id="notesNavBtn" class="btn-ghost pad-chip-md nav-action'+(notesOpen?' nav-action-on':'')+'" onclick="toggleNotes()">\u270E Notes<span id="notesCount" class="notes-count" style="display:'+(((data.notes||[]).length)?'':'none')+'">'+((data.notes||[]).length)+'</span></button>'+
    '<span class="nav-more-wrap"><button class="btn-ghost pad-chip-md nav-action'+(UI.navMore?' nav-action-on':'')+'" onclick="toggleNavMore(event)" aria-haspopup="true" aria-expanded="'+(UI.navMore?'true':'false')+'" title="More">\u22EF More</button>'+navMoreHtml+'</span>';
}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 5 — Add the function that draws the body of a step's page (the part of the old renderStepContent that draws; the print control is added around it by a later step).

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderStep` ends, after its closing `}`.

**Code:**

```js

/* ═══ STEP CONTENT ROUTER ═══ */
function renderStepContentBody(id){
  if(id==='1.1')return renderStep11();
  if(id==='1.2')return renderStep12();
  if(id==='1.3')return renderStep13();
  if(id==='1.4')return renderStep14();
  if(id==='2.1')return renderStep21();
  if(id==='2.2')return renderStep22();
  if(id==='2.3')return renderStep23();
  if(id==='2.4')return renderStep24();
  if(id==='3.1')return renderStep31();
  if(id==='3.2')return renderStep32();
  if(id==='3.3')return renderStep33();
  if(id==='3.4')return renderStep34_values();
  if(id==='3.5')return renderStep35();
  if(id==='4.1')return renderStep41();
  if(id==='4.2')return renderStep42();
  if(id==='4.3')return renderStep43();
  if(id==='4.4')return renderStep44();
  if(id==='5.3')return renderLdevDashboard();
  if(id==='5.2')return renderLdevHub();
  var desc={};
  return card('<p style="font-size:14px;color:var(--stone);line-height:1.7">'+(desc[id]||'Coming soon.')+'</p><p style="font-size:13px;color:var(--stone);font-style:italic;margin-top:12px">Full interactive content coming next.</p>');
}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 6 — Replace the function that draws the Reporting Lines chart of step 1.2, so that it uses the fitted layout and draws each role with the dashboard's node.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `reportingChartAndControls`.

**Code:**

```js
function reportingChartAndControls(){
  var leaders=data.leaders||[];
  syncPhase1Chart();
  var roles=data.orgChart||[];
  var h='';
  // If adding/editing a role from this step, show the shared role form (same as dashboard).

  // --- Org chart (built from reporting lines) ---
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos; /* 16 Sep 2026 (Paul's ruling): the fitted layout and two-line titles, as on paper and the dashboard */
  if(!UI.llZoom)UI.llZoom=1;
  h+='<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">';
  h+='<button onclick="UI.llZoom=Math.min(2,(UI.llZoom||1)+0.2);render()" title="Zoom in" style="width:30px;height:30px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:16px;cursor:pointer;font-family:var(--sans)">+</button>';
  h+='<button onclick="UI.llZoom=Math.max(0.3,(UI.llZoom||1)-0.2);render()" title="Zoom out" style="width:30px;height:30px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:16px;cursor:pointer;font-family:var(--sans)">&minus;</button>';
  h+='<button onclick="UI.llZoom=1;render()" title="Reset to 100%" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Reset</button>';
  h+='<span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+Math.round(UI.llZoom*100)+'%</span>';
  h+='<button onclick="var el=document.getElementById(\'llChartWrap\');if(el){if(el.requestFullscreen)el.requestFullscreen();else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();else if(el.msRequestFullscreen)el.msRequestFullscreen()}" title="View the chart fullscreen" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono);letter-spacing:.06em">\u26F6 FULLSCREEN</button>';
  h+='</div>';
  var natW=layout.tw+40,natH=layout.th+40;
  var _fz=Math.max(0,layout.tw-(layout.treeW||layout.tw));var _vx=-20-_fz,_vw=natW+_fz;
  h+='<div class="org-board" style="margin-bottom:24px"><div id="llChartWrap" class="org-board-canvas">';
  if(Math.abs((UI.llZoom||1)-1)<0.01){
    h+='<svg style="width:100%;max-width:'+_vw+'px;min-width:'+Math.round(_vw*0.55)+'px;height:auto;display:block;margin:0 auto" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }else{
    var zw=Math.round(natW*UI.llZoom);var zh=Math.round(natH*UI.llZoom);
    h+='<svg width="'+zw+'" height="'+zh+'" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }
  layout.lines.forEach(function(d){h+='<path d="'+d+'" fill="none" stroke="rgba(245,242,236,.18)" stroke-width="1.5"/>'});
  roles.forEach(function(r){var p=pos[r.id];if(!p)return;h+=orgChartNodeSvg(r,p,{interactive:false})}); /* 16 Sep 2026 (Paul's ruling): the dashboard's node — neutral border, the level's colour in the top bar, the initials, Unassigned in italics — so the two charts reflect each other */
  h+='</svg></div></div>';

  // --- Role structure list: per role, set its parent (reporting) and its occupant ---
  h+='<div style="font-family:var(--mono);font-size:11px;color:var(--gold);letter-spacing:.06em;margin-bottom:12px">ROLE STRUCTURE &amp; OCCUPANTS</div>';
  var editableRoles=roles.filter(function(r){return r.id!=='board';});
  if(!editableRoles.length){
    h+=card('<div style="text-align:center;padding:24px;color:var(--stone)">No roles yet. Add leaders on the Leadership Inventory tab (each becomes a role), or use Add Role for a vacant role.</div>');
  } else {
    editableRoles.forEach(function(r){
      var occ=roleOccupant(r);
      // Parent (reporting) dropdown — other roles + board, excluding self.
      var popts='<option value="board"'+((!r.parentId||r.parentId==='board')?' selected':'')+'>Board (top level)</option>';
      roles.forEach(function(other){
        if(other.id===r.id||other.id==='board')return;
        popts+='<option value="'+esc(other.id)+'"'+(r.parentId===other.id?' selected':'')+'>'+esc(other.name||'Role')+'</option>';
      });
      // Occupant dropdown — all leaders + unassigned. Autofills current occupant.
      var oopts='<option value="">\u2014 vacant \u2014</option>';
      leaders.forEach(function(l){
        oopts+='<option value="'+esc(l.id)+'"'+((r.occupantLeaderId||(occ||{}).id)===l.id?' selected':'')+'>'+esc(l.name)+' \u2014 '+esc(leaderRoleName(l))+'</option>';
      });
      h+='<div style="padding:12px 14px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-radius:8px;margin-bottom:8px">';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="font-size:14px;font-weight:600;color:var(--paper);flex:1">'+esc(r.name||'Role')+(occ?'':' <span style="font-family:var(--mono);font-size:10px;color:var(--stone);font-weight:400">\u00B7 vacant</span>')+'</div><button onclick="UI.orgEditId=\''+r.id+'\';UI.orgAddForm=false;UI.orgSelected=null;UI.scrollTo=\'orgEditCard\';render()" style="padding:4px 10px;font-size:11px;font-family:var(--mono);background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;color:var(--stone);cursor:pointer">Edit role</button></div>';
      h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
      h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--text-body)">reports to</span>';
      h+='<select class="assign-sel" onchange="assignRoleParent(\''+r.id+'\',this.value)" style="padding:6px 10px;background:rgba(var(--fg-rgb),.06);border:1px solid rgba(var(--fg-rgb),.12);border-radius:6px;font-size:13px;font-family:var(--sans);max-width:220px">'+popts+'</select></div>';
      h+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--text-body)">occupied by</span>';
      h+='<select class="assign-sel" id="or_qa12_'+r.id+'" onchange="quickAssignOrg(\''+r.id+'\',this.value)" style="padding:6px 10px;background:rgba(var(--fg-rgb),.06);border:1px solid '+(occ?'rgba(27,107,90,.4)':'rgba(var(--fg-rgb),.12)')+';border-radius:6px;font-size:13px;font-family:var(--sans);max-width:220px">'+oopts+'</select></div>';
      h+='</div></div>';
      if(UI.orgEditId===r.id)h+='<div id="orgEditCard">'+renderOrgForm(r,roles,leaders)+'</div>';
    });
  }
  // Add Role (vacant) — same creation path as the dashboard.
  h+='<div style="margin-top:4px">'+btn('+ Add Role','UI.orgAddForm=true;UI.orgEditId=null;UI.orgSelected=null;UI.scrollTo=\'orgAddCard\';render()','bp')+'</div>';
  // Ruled 25 July: the Add Role form opens in the button's slot, below it, not above the chart.
  if(UI.orgAddForm&&!UI.orgEditId){h+='<div id="orgAddCard">'+renderOrgForm(null,roles,leaders)+'</div>';}

  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 7 — Replace the function that draws step 2.2 (Collaboration Principles), so that its Models tab reads the collaboration model names from the shared constant.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderStep22`.

**Code:**

```js


/* ═══ STEP 2.2: AI Collaboration Lab ═══ */
function renderStep22(){
  var cl=data.collabLab||{};
  var secs=[{id:'touchpoints',l:'Touchpoint Mapping'},{id:'models',l:'Collaboration Models'},{id:'personas',l:'AI Persona Design'},{id:'aifree',l:'AI-Free Zones'},{id:'translation',l:'Translation Layer'}];
  var sec=UI.collabSec||'touchpoints';
  var h='<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">AI Collaboration Lab</h2>';
  h+='<p style="color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">This is a thinking lab, not a configuration tool. Work through five dimensions of how humans and AI will interact in your organization. The output is a set of guiding principles, not a tracked dashboard object.</p>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px">';
  secs.forEach(function(s){var done=cl[s.id+'_done'];h+='<button onclick="harvestFields();saveData();UI.collabSec=\''+s.id+'\';render()" style="padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--sans);border:'+(sec===s.id?'2px solid #2D5A8E':done?'1px solid rgba(27,107,90,.4)':'1px solid rgba(var(--fg-rgb),.12)')+';background:'+(done?'rgba(27,107,90,.08)':'rgba(var(--fg-rgb),.03)')+';color:'+(sec===s.id?'#2D5A8E':done?'#1B6B5A':'var(--text-body)')+'">'+(done?'\u2713 ':'')+s.l+'</button>'});
  h+='</div>';

  if(sec==='touchpoints'){
    h+=card('<h3 class="h-sub-lg">Touchpoint Mapping</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Map every point where AI interacts with humans in your organization, or will once AI is deployed. This includes customer-facing interactions, internal workflows, decision support, and agent-to-agent processes.</p>'
      +ta('Customer-facing AI touchpoints (current and planned)','cl_touchCustomer',cl.touchCustomer,'e.g. Chatbot on website, AI-generated product recommendations, automated email responses',3)
      +ta('Internal workflow AI touchpoints','cl_touchInternal',cl.touchInternal,'e.g. AI-assisted report drafting, automated scheduling, AI screening of applications',3)
      +ta('Decision support AI touchpoints','cl_touchDecision',cl.touchDecision,'e.g. AI-generated analytics dashboards, predictive models for strategy, risk scoring',3)
      +ta('Agent-to-agent processes (where AI systems interact with each other)','cl_touchAgent',cl.touchAgent,'e.g. Automated supply chain optimization feeding into pricing algorithms',3)
      +doneBtn('saveCollabSec(\'touchpoints\')',false,null,cl[sec+'_done']===true));
  }

  if(sec==='models'){
    h+=card('<h3 class="h-sub-lg">Collaboration Models</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">Not every human-AI interaction follows the same model. For each domain, determine which model is appropriate.</p>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">'
      +card('<div style="font-size:14px;font-weight:700;color:#1B6B5A;margin-bottom:4px">Advisor</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI provides analysis and recommendations. Humans make all decisions.</p>','border-top:3px solid #1B6B5A;padding:14px')
      +card('<div style="font-size:14px;font-weight:700;color:#2D5A8E;margin-bottom:4px">Augmenter</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI handles parts of the workflow. Humans retain oversight and final authority.</p>','border-top:3px solid #2D5A8E;padding:14px')
      +card('<div style="font-size:14px;font-weight:700;color:#8B5E3C;margin-bottom:4px">Autonomous Agent</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI operates independently within defined boundaries. Humans intervene by exception.</p>','border-top:3px solid #8B5E3C;padding:14px')
      +card('<div style="font-size:14px;font-weight:700;color:#9B2D3F;margin-bottom:4px">Competitor</div><p style="font-size:12px;color:var(--stone);line-height:1.4">AI and humans tackle the same problem independently. Results are compared to drive innovation.</p>','border-top:3px solid #9B2D3F;padding:14px')
      +'</div>');
    // Structured function-model mapping
    var funcModels=data.collabLab?data.collabLab.functionModels||[]:[];
    if(funcModels.length){
      funcModels.forEach(function(fm,i){
        var mc={'advisor':'#1B6B5A','augmenter':'#2D5A8E','autonomous':'#8B5E3C','competitor':'#9B2D3F','facilitator':'#6B4C8A'};
        var mn=COLLAB_MODEL_LABELS; /* 16 Sep 2026: one definition, read by the step, the page, and the document */
        h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-left:3px solid '+(mc[fm.model]||'#888')+';background:rgba(var(--fg-rgb),.02);margin-bottom:6px">';
        h+='<div style="flex:1"><div style="font-size:14px;font-weight:600;color:var(--paper)">'+esc(fm.name)+'</div></div>';
        h+='<div style="font-family:var(--mono);font-size:10px;color:'+(mc[fm.model]||'#888')+';text-transform:uppercase;letter-spacing:.08em;padding:3px 10px;border:1px solid '+(mc[fm.model]||'#888')+'">'+(mn[fm.model]||fm.model)+'</div>';
        h+='<button onclick="removeFuncModel('+i+')" title="Remove this function" style="background:none;border:none;color:#9B2D3F;cursor:pointer;font-size:14px;padding:2px 6px">\u00D7</button></div>';
      });
    }
    h+='<div style="margin-top:12px;padding:16px;border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
    h+='<div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px">Add Function</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 220px;gap:12px;align-items:end">';
    h+='<div><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Function name</label><input id="cl_funcName" type="text" placeholder="e.g. Customer Service, Strategic Planning" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box;background:rgba(var(--fg-rgb),.03);color:var(--paper)"></div>';
    h+='<div><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Model type</label><select id="cl_funcModel" onchange="document.getElementById(\'cl_customModelWrap\').style.display=(this.value===\'custom\'?\'block\':\'none\')" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);background:#fff;color:#1a1612;box-sizing:border-box"><option value="">Select model\u2026</option><option value="advisor">Advisor</option><option value="augmenter">Augmenter</option><option value="autonomous">Autonomous Agent</option><option value="competitor">Competitor</option><option value="custom">Custom\u2026</option></select></div>';
    h+='</div>';
    h+='<div id="cl_customModelWrap" style="display:none;margin-top:12px"><label style="display:block;font-size:13px;font-weight:600;color:var(--paper);margin-bottom:6px">Custom model name</label><input id="cl_customModel" type="text" placeholder="Describe your model" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(var(--fg-rgb),.12);font-size:14px;font-family:var(--sans);box-sizing:border-box;background:rgba(var(--fg-rgb),.03);color:var(--paper)"></div>';
    h+=btn('+ Add Function','addFuncModel()','bp','margin-top:12px');
    h+='</div>';
    h+=doneBtn('saveCollabSec(\'models\')',false,null,cl[sec+'_done']===true);
  }

  if(sec==='personas'){
    h+=card('<h3 class="h-sub-lg">AI Persona Design</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">AI systems present themselves differently depending on context. A customer-facing AI needs conversational warmth. An internal analytics AI needs precision and speed. An agent-to-agent AI needs machine-readable clarity. These are not cosmetic differences. The persona shapes whether the humans on the other end can work with the system effectively.</p>'
      +'<p style="color:var(--paper);font-size:14px;line-height:1.6;margin-bottom:16px">Use the TRANSCEND framework: <strong>Function</strong> (what do we want it to do?), <strong>Epistemic Perspective</strong> (what information does it have access to?), <strong>Relationship</strong> (what relationship do we want with this AI?).</p>'
      +recBox('rr_src_transcend','TRANSCEND: Unlocking Humanity in the Age of AI','Faisal Hoque','Post Hill Press','https://faisalhoque.com/all-books/','','12px','','pp. 45\u201349')
      +ta('Customer-facing AI personas: How should AI present itself to customers?','cl_personaCustomer',cl.personaCustomer,'Consider tone, speed, boundaries, escalation triggers',3)
      +ta('Internal AI personas: How should AI present itself to employees?','cl_personaInternal',cl.personaInternal,'Consider authority level, language register, decision-making scope',3)
      +ta('What behaviors must AI personas never exhibit?','cl_personaBoundaries',cl.personaBoundaries,'e.g. Never make promises on behalf of the company, never access personal data without consent',3)
      +doneBtn('saveCollabSec(\'personas\')',false,null,cl[sec+'_done']===true));
  }

  if(sec==='aifree'){
    h+=card('<h3 class="h-sub-lg">AI-Free Zones</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">When everyone uses the same AI tools trained on the same data, outputs converge toward generic mediocrity. Competitive advantage in the AI era comes from authentic difference. Some spaces must remain exclusively human.</p>'
      +recBox('rr_src_7things','7 Things Every Leader Must Do to Prepare Their Organization for 2026','Faisal Hoque','Fast Company','https://www.fastcompany.com/91462416/leaders-prepare-organization-2026-ai','Seven priorities for leading AI transformation by intent rather than drift, from reimagining middle management to building authentic competitive difference.','12px')
      +ta('Where in your organization should only humans operate? Why?','cl_aiFreeZones',cl.aiFreeZones,'Consider: creative ideation, final hiring decisions, setting organizational purpose, ethical boundary calls, mentoring relationships',4)
      +ta('What proprietary knowledge or processes must be protected from AI commodification?','cl_proprietary',cl.proprietary,'What is distinctive about your organization that AI should not be allowed to smooth away?',3)
      +ta('What skills are at risk of atrophying if fully delegated to AI? (Connect back to your Dependency Scan from Phase 1.)','cl_atrophyRisks',cl.atrophyRisks,'',3)
      +doneBtn('saveCollabSec(\'aifree\')',false,null,cl[sec+'_done']===true));
  }

  if(sec==='translation'){
    h+=card('<h3 class="h-sub-lg">The Translation Layer</h3><p style="color:var(--text-body);margin:0 0 16px;font-size:14px;line-height:1.6">When algorithms speak to other algorithms, language changes from a medium for human understanding into code for machine processing. Leaders need translators \u2014 people and processes that can interpret algorithmic signals and reconnect them with human insight. A r\u00e9sum\u00e9 may score well, but does the candidate bring originality? A post may perform, but did it actually persuade?</p>'
      +recBox('rr_src_autonomous','Leadership in a World of Autonomous Algorithms','Faisal Hoque','Fast Company','https://faisalhoque.com/leadership-in-a-world-of-autonomous-algorithms/','How leadership changes when AI systems act independently, and what humans must still own as algorithms take on more of the work.','12px')
      +ta('Who in your organization will serve as translators between AI systems and human decision-makers?','cl_translators',cl.translators,'Name roles or people who can interpret AI outputs for human context',3)
      +ta('What processes will you create to ensure AI outputs are interpreted, not just accepted?','cl_transProcesses',cl.transProcesses,'e.g. Human review layer for AI recommendations, regular audit of AI-driven decisions',3)
      +ta('Where are you currently at risk of mistaking algorithmic proxies for real understanding?','cl_transRisks',cl.transRisks,'e.g. Engagement metrics treated as customer satisfaction, ATS scores treated as talent quality',3)
      +doneBtn('saveCollabSec(\'translation\')',false,null,cl[sec+'_done']===true));
  }
  var _all22=['touchpoints','models','personas','aifree','translation'].every(function(s){return (data.collabLab||{})[s+'_done']});
  if(_all22||isStepDone('2.2'))h+=doneBtn('markStepComplete(\'2.2\')',false,null,'2.2');
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 8 — Add the constant listing the seven competencies as the L&D Hub names them.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `daysLeftInMonth` ends, after its closing `}`.

**Code:**

```js
/* ── L&D HUB REPORT (Paul's ruling, 13 Sep 2026) ───────────────────────────────────────
   The printed hub is its own document rendered from the data, never the screen cleaned up.
   Cover; the Competency Heat Map on its own landscape page; Study Completion and AI Fluency
   Progress as tables on one portrait page; Monthly Reviews Health compact, with the
   Development Priorities beneath it, on the last page. Practice History does not print. */
var LDEV_COMPS=[
  {id:'orchestration',name:'AI Orchestration'},
  {id:'philosophical',name:'Philosophical & Ethical Reasoning'},
  {id:'hybrid',name:'Hybrid Team Leadership'},
  {id:'change',name:'Change & Transformation'},
  {id:'composure',name:'Composure & Adaptive Judgment'},
  {id:'ecosystem',name:'Ecosystem Stewardship'},
  {id:'emotional',name:'Emotional Intelligence'}
];
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 9 — Add the constant listing the study steps the L&D Hub tracks.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LDEV_COMPS` ends.

**Code:**

```js
var LDEV_STEPS=[{id:'1.4',name:'Mindset Foundations',phase:'Phase 1'},{id:'2.4',name:'Mindset Depth',phase:'Phase 2'},{id:'3.5',name:'Mindset Application',phase:'Phase 3'},{id:'4.4',name:'Composure & Resilience',phase:'Phase 4'}];
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 10 — Add the constant listing the practices the L&D Hub tracks.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LDEV_STEPS` ends.

**Code:**

```js
var LDEV_PRACTICES=[
  {id:'slowLog',name:'Slow Thinking',cadence:'Monthly',dueDays:30},
  {id:'stopReview',name:'STOP Technique',cadence:'Monthly',dueDays:30},
  {id:'depScan',name:'Dependency Scan',cadence:'Monthly',dueDays:30},
  {id:'reverseAudit',name:'Skill Atrophy Audit',cadence:'Monthly',dueDays:30},
  {id:'valuesReview',name:'Values Review',cadence:'Monthly',dueDays:30},
  {id:'concernCircle',name:'Concern Circles',cadence:'Monthly',dueDays:30},
  {id:'commitments',name:'Commitments',cadence:'Monthly',dueDays:30}
];
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 11 — Add the function that writes the one-sentence lead of the L&D Hub page and its printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LDEV_PRACTICES` ends.

**Code:**

```js
function ldevHubLead(){return'Collective view of leadership development across the program. Competency tracking, study progress, fluency growth, and ongoing practice health.'}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 12 — Add the function that works out each leader's competency gaps for the L&D Hub.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ldevHubLead` ends, after its closing `}`.

**Code:**

```js
/* the gap ranking the screen's Development Priorities shows: competencies by average score, lowest first */
function ldevGaps(){var cf=data.competencyFramework||{};var leaders=data.leaders||[];
return LDEV_COMPS.map(function(c){var vals=leaders.map(function(l){return(cf.scores||{})[l.id+'_'+c.id]||0}).filter(function(v){return v>0});return{name:c.name,avg:vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0}}).filter(function(g){return g.avg>0}).sort(function(a,b){return a.avg-b.avg})}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 13 — Add the constant holding the style rules of the printed L&D Hub document, including its one landscape page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ldevGaps` ends, after its closing `}`.

**Code:**

```js
var LDEV_REPORT_CSS='@page land{size:landscape}.lr-land{page:land;break-before:page;break-after:page;page-break-before:always;page-break-after:always;width:1000px}.lr-pg{page-break-before:always}'
+'.lr-hk{font-family:var(--mono,monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6B4C8A;margin:0 0 6px}.lr-h{font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;color:#111;margin:0 0 6px;line-height:1.15}.lr-lead{font-size:12.5px;color:#444;margin:0 0 10px;line-height:1.5}.lr-rule{border-top:2px solid #111;margin:0 0 16px}'
+'.lr-blk{page-break-inside:avoid}.lr-h2{font-size:16px;font-weight:700;color:#1E2530;margin:16px 0 3px}.lr-sub{font-size:12px;color:#555;margin:0 0 8px;line-height:1.5}'
+'table.lr-t{width:100%;border-collapse:collapse;font-size:11.5px}table.lr-t th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;font-weight:500;text-align:center;padding:6px 6px;border-bottom:1px solid rgba(30,37,48,.25);vertical-align:bottom;line-height:1.35}table.lr-t th.l,table.lr-t td.l{text-align:left;padding-left:0}table.lr-t td{padding:3.5px 6px;text-align:center;border-bottom:1px solid rgba(30,37,48,.08);color:#1E2530;vertical-align:middle}table.lr-t td.nm{font-weight:600;white-space:nowrap}table.lr-t td.role{color:#555;font-size:11.5px;text-align:left}'
+'.lr-nl{font-family:var(--mono,monospace);font-size:8.5px;color:#777;font-weight:400;margin-left:4px}'
+'table.lr-heat{width:100%;border-collapse:separate;border-spacing:2px;font-size:12px;table-layout:fixed}table.lr-heat th{font-size:11.5px;font-weight:600;color:#1E2530;text-align:center;padding:4px 2px 10px;line-height:1.25;vertical-align:bottom}table.lr-heat th.c{width:200px;text-align:left}table.lr-heat td{text-align:center;padding:15px 2px;font-weight:700;font-size:16px;border-radius:3px}table.lr-heat td.c{text-align:left;font-weight:500;font-size:13px;color:#1E2530;padding-left:0}'
+'.lr-leg{font-size:11px;color:#555;margin-top:10px}.lr-sw{display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin:0 5px 0 14px}'
+'.lr-tick{color:#1B6B5A;font-size:14px;font-weight:700}.lr-open{color:#B0B7BF;font-size:13px}'
+'.lr-per{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:1px solid rgba(107,76,138,.3);background:rgba(107,76,138,.05);border-radius:6px;margin:0 0 10px}.lr-per .p{font-family:var(--serif,Georgia,serif);font-size:20px;color:#111}.lr-per .d{font-family:var(--mono,monospace);font-size:10.5px;color:#555;margin-left:10px}.lr-per .s{display:flex;gap:18px}.lr-per .s b{font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:400;display:block;line-height:1;text-align:center}.lr-per .s span{font-family:var(--mono,monospace);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;display:block;text-align:center;margin-top:2px}'
+'table.lr-mr{width:100%;border-collapse:collapse;font-size:11.5px;page-break-inside:avoid}table.lr-mr th{font-family:var(--mono,monospace);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#555;font-weight:500;text-align:center;padding:4px 3px 6px;border-bottom:1px solid rgba(30,37,48,.25);vertical-align:bottom;line-height:1.3}table.lr-mr th.l{text-align:left;padding-left:0}table.lr-mr td{padding:3px 3px;text-align:center;border-bottom:1px solid rgba(30,37,48,.07);height:21px}table.lr-mr td.nm{text-align:left;padding-left:0;font-weight:600;color:#1E2530;white-space:nowrap}.lr-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#D5D9DE;vertical-align:middle}.lr-dot.on{background:#1B6B5A}'
+'.lr-dp{border:2px solid #4E7FA6;border-radius:8px;padding:12px 14px;margin-top:14px;page-break-inside:avoid}.lr-dp h3{font-size:15px;font-weight:700;margin:0 0 2px;color:#1E2530}.lr-dp .lr-sub{margin-bottom:8px}.lr-dpr{display:flex;align-items:center;gap:10px;margin:0 0 5px;font-size:12px}.lr-dpr .r{font-family:var(--mono,monospace);font-size:11px;color:#555;width:16px;text-align:right}.lr-dpr .n{min-width:210px;color:#1E2530}.lr-dpr .bar{flex:1;height:6px;background:rgba(30,37,48,.08);border-radius:3px}.lr-dpr .bar div{height:100%;border-radius:3px}.lr-dpr .v{font-family:var(--mono,monospace);font-size:11px;color:#1E2530;min-width:28px;text-align:right}'
+'.lr-dorm{border:1px solid rgba(30,37,48,.15);border-radius:8px;padding:16px;font-size:12.5px;color:#444;line-height:1.55}.lr-empty{font-size:12.5px;color:#666}';
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 14 — Add the function that draws the printed L&D Hub document: the competency heat map on a landscape page, then study progress and practice health.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LDEV_REPORT_CSS` ends.

**Code:**

```js
function ldevReportBody(opts){opts=opts||{};var cf=data.competencyFramework||{};var leaders=data.leaders||[];var rv=data.leadershipReview||{};var a=data.assessments||{};
var head=function(kicker,title,lead){return'<div class="lr-hk">'+kicker+'</div><div class="lr-h">'+title+'</div>'+(lead?'<div class="lr-lead">'+lead+'</div>':'')+'<div class="lr-rule"></div>'};
var nameParts=function(l){var n=String(l.name||'?').trim();var k=n.lastIndexOf(' ');return k>0?[n.slice(0,k),n.slice(k+1)]:[n,'']};
var h='';
/* 1. Competency Heat Map – its own landscape page */
h+='<div class="lr-land">'+(opts.sectionHead||'')+head('L&D Hub','Competency Heat Map','Each leader\u2019s score on the seven leadership competencies, 1\u20135, from the Competency Framework at Step 2.3.');
if(leaders.length&&cf.scores){
  h+='<table class="lr-heat"><thead><tr><th class="c"></th>'+leaders.map(function(l){var p=nameParts(l);return'<th title="'+esc(l.name||'?')+'">'+esc(p[0])+(p[1]?'<br/>'+esc(p[1]):'')+'</th>'}).join('')+'</tr></thead><tbody>';
  LDEV_COMPS.forEach(function(c){h+='<tr><td class="c">'+esc(c.name)+'</td>'+leaders.map(function(l){var v=(cf.scores||{})[l.id+'_'+c.id]||0;
    var st=v>=4?'background:rgba(27,107,90,.28);color:#0F4A3E':v>=3?'background:rgba(78,127,166,.24);color:#1E3A55':v>0?'background:rgba(155,45,63,.22);color:#6E1F2D':'background:rgba(30,37,48,.05);color:#888';
    return'<td style="'+st+'">'+(v||'\u2014')+'</td>'}).join('')+'</tr>'});
  h+='</tbody></table>';
  h+='<div class="lr-leg">Score, out of 5 <span class="lr-sw" style="background:rgba(27,107,90,.28)"></span>4\u20135 strong <span class="lr-sw" style="background:rgba(78,127,166,.24)"></span>3 developing <span class="lr-sw" style="background:rgba(155,45,63,.22)"></span>1\u20132 gap <span class="lr-sw" style="background:rgba(30,37,48,.05)"></span>\u2014 not scored</div>';
}else h+='<p class="lr-empty">Complete Step 2.3 (Competency Framework) to populate this view.</p>';
h+='</div>';
/* 2. Study Completion and AI Fluency Progress – one portrait page */
h+='<div class="lr-pg">'+head('L&D Hub','Study Progress','Each leader\u2019s individual mindset and composure track, and the movement in AI fluency since the baseline.');
h+='<div class="lr-blk"><div class="lr-h2" style="margin-top:0">Study Completion</div><div class="lr-sub">Individual mindset &amp; composure track \u2014 completion per leader.</div>';
if(leaders.length){var _indivDone=data.indivDone||{};
  h+='<table class="lr-t"><thead><tr><th class="l">Leader</th>'+LDEV_STEPS.map(function(s){return'<th>'+esc(s.name)+'<br/><span style="letter-spacing:0;text-transform:none;color:#888">'+esc(s.phase)+'</span></th>'}).join('')+'<th>Done</th></tr></thead><tbody>';
  leaders.forEach(function(l){var dn=_indivDone[l.id]||{};var n=0;
    h+='<tr><td class="l nm">'+esc(l.name||'?')+(l.userId?'':'<span class="lr-nl">(no login)</span>')+'</td>'+LDEV_STEPS.map(function(s){var done=!!dn[s.id];if(done)n++;return'<td>'+(done?'<span class="lr-tick">\u2713</span>':'<span class="lr-open">\u25CB</span>')+'</td>'}).join('')+'<td style="font-family:var(--mono,monospace);font-size:11px;color:'+(n===LDEV_STEPS.length?'#1B6B5A':'#555')+'">'+n+'/'+LDEV_STEPS.length+'</td></tr>'});
  h+='</tbody></table>';
}else h+='<p class="lr-empty">No leaders mapped yet.</p>';
h+='</div><div class="lr-blk"><div class="lr-h2">AI Fluency Progress</div><div class="lr-sub">Baseline fluency, the three sprint tasks, the rescore at review, and the growth between them.</div>';
if(leaders.length){var baselineFluency=(a.fluency||{}).foundational||0;var fl=data.fluencySprint||{};
  h+='<table class="lr-t"><thead><tr><th class="l">Leader</th><th class="l">Role</th><th>Baseline</th><th>Tasks</th><th>Rescore</th><th>Growth</th></tr></thead><tbody>';
  leaders.forEach(function(l,i){var baseline=parseInt(l.fluency)||baselineFluency;var rescore=(rv.leaders||{})[l.id]?(rv.leaders[l.id].fluency||0):0;var lt=(fl.leaderTasks||{})[l.id]||{};var taskCount=[lt.task1,lt.task2,lt.task3].filter(function(t){return!!t}).length;var delta=rescore?rescore-baseline:null;
    var deltaCol=delta!==null?(delta>=2?'#1B6B5A':delta>=1?'#4E7FA6':'#1E2530'):'#999';
    h+='<tr><td class="l nm">'+esc(l.name||'Leader '+(i+1))+'</td><td class="role">'+esc(leaderRoleName(l))+'</td><td>'+baseline+'/5</td><td style="font-weight:700;color:'+(taskCount>=3?'#1B6B5A':taskCount>0?'#4E7FA6':'#999')+'">'+taskCount+'/3</td><td>'+(rescore||'\u2014')+'</td><td style="font-family:var(--mono,monospace);font-weight:700;color:'+deltaCol+'">'+(delta!==null?((delta>0?'+':'')+delta):'\u2014')+'</td></tr>'});
  h+='</tbody></table>';
}
h+='</div></div>';
/* 3. Monthly Reviews Health, compact, with the Development Priorities beneath */
h+='<div class="lr-pg">'+head('L&D Hub','Practice Health','The monthly reviews each leader keeps up, and the competencies with the widest gaps.');
h+='<div class="lr-h2" style="margin-top:0">Monthly Reviews Health</div>';
if(getProgress().pct!==100){
  h+='<div class="lr-dorm"><div class="lr-hk" style="color:#555">\u25CB Dormant</div>Monthly reviews begin once the 90-day module is complete. Until every organizational step across Phases 1\u20134 is finished, leaders are still working through the practices these reviews maintain.</div>';
}else{
  var now=new Date();var pk=periodKey(now);
  var rows=leaders.map(function(l){return{leader:l,linked:!!l.userId,log:((data.practiceLog||{})[l.userId])||{}}});
  var doneNow=function(iso){return !!iso&&periodKey(new Date(iso))===pk};
  var g=0,n=0;rows.forEach(function(r){LDEV_PRACTICES.forEach(function(p){if(doneNow(r.log[p.id]||null))g++;else n++})});
  h+='<div class="lr-per"><div><span class="p">'+esc(periodLabel(pk))+'</span><span class="d">'+daysLeftInMonth(now)+' days left in this period</span></div><div class="s"><div><b style="color:#1B6B5A">'+g+'</b><span>Done</span></div><div><b style="color:#555">'+n+'</b><span>Not started</span></div></div></div>';
  if(rows.length){
    h+='<table class="lr-mr"><thead><tr><th class="l">Leader</th>'+LDEV_PRACTICES.map(function(p){return'<th>'+esc(p.name).replace(' ','<br/>')+'</th>'}).join('')+'</tr></thead><tbody>';
    rows.forEach(function(r){h+='<tr><td class="nm">'+esc(r.leader.name||'?')+(r.linked?'':'<span class="lr-nl">(no login)</span>')+'</td>'+LDEV_PRACTICES.map(function(p){return'<td><span class="lr-dot'+(doneNow(r.log[p.id]||null)?' on':'')+'"></span></td>'}).join('')+'</tr>'});
    h+='</tbody></table>';
    h+='<div class="lr-leg" style="margin-top:6px"><span class="lr-dot on" style="margin-right:5px"></span>done this month <span class="lr-dot" style="margin:0 5px 0 14px"></span>not started</div>';
  }else h+='<p class="lr-empty">No leaders mapped yet.</p>';
}
var gaps=(leaders.length&&cf.scores)?ldevGaps():[];
if(gaps.length){h+='<div class="lr-dp"><h3>Development Priorities</h3><div class="lr-sub">Competencies ranked by gap severity (lowest average scores first).</div>'
  +gaps.map(function(gp,i){var col=gp.avg>=4?'#1B6B5A':gp.avg>=2.5?'#4E7FA6':'#9B2D3F';return'<div class="lr-dpr"><span class="r">'+(i+1)+'</span><span class="n">'+esc(gp.name)+'</span><div class="bar"><div style="width:'+(gp.avg*20)+'%;background:'+col+'"></div></div><span class="v">'+gp.avg.toFixed(1)+'</span></div>'}).join('')+'</div>'}
h+='</div>';
return h}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 15 — Add the function that opens the printed L&D Hub document in the print window.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `ldevReportBody` ends, after its closing `}`.

**Code:**

```js
function printLdevHubReport(){printDocument('L&D Hub',printDocCover('L&D Hub',ldevHubLead(),'')+ldevReportBody(),LDEV_REPORT_CSS)}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 16 — Replace the function that draws the L&D Hub page (step 5.2), so that it reads the shared constants and lead sentence.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderLdevHub`.

**Code:**

```js
/* ═══ L&D HUB ═══ */
function renderLdevHub(){
  practiceRollover();
  var cf=data.competencyFramework||{};var leaders=data.leaders||[];var rv=data.leadershipReview||{};var a=data.assessments||{};
  var COMPS=LDEV_COMPS;
  var h='<h2 style="font-size:22px;font-weight:700;margin:0 0 4px">L&D Hub</h2>';
  h+='<p style="color:var(--text-body);margin:8px 0 24px;line-height:1.6;font-size:14px">'+ldevHubLead()+'</p>';

  // ── 1. Competency Heat Map ──
  if(leaders.length&&cf.scores){
    h+=card('<h3 class="h-sub-lg">Competency Heat Map</h3>'
      +'<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:180px repeat('+leaders.length+',1fr);gap:1px;font-size:12px;min-width:'+(180+leaders.length*80)+'px">'
      +'<div style="padding:8px;font-weight:700;color:var(--stone)"></div>'
      +leaders.map(function(l){return'<div title="'+esc(l.name||'?')+'" style="padding:8px;font-weight:600;text-align:center;font-size:11px;color:var(--paper)">'+esc((l.name||'?').split(' ')[0])+'</div>'}).join('')
      +COMPS.map(function(c){
        return'<div style="padding:8px;color:var(--stone);border-top:1px solid rgba(var(--fg-rgb),.06);font-size:11px">'+esc(c.name)+'</div>'
          +leaders.map(function(l){
            var v=(cf.scores||{})[l.id+'_'+c.id]||0;
            var bg=v>=4?'rgba(27,107,90,.3)':v>=3?'rgba(var(--gold-rgb),.2)':v>0?'rgba(155,45,63,.2)':'rgba(var(--fg-rgb),.04)';
            return'<div title="'+esc(l.name||'?')+' \u2013 '+esc(c.name)+': '+(v?v+'/5':'Not scored')+'" style="padding:8px;text-align:center;background:'+bg+';border-top:1px solid rgba(var(--fg-rgb),.06);font-weight:600;color:var(--paper);cursor:help">'+(v||'\u2014')+'</div>';
          }).join('');
      }).join('')
      +'</div></div>'
    ,'border:2px solid #2D5A8E;margin-bottom:16px');
  } else {
    h+=card('<h3 class="h-sub-lg">Competency Heat Map</h3><p style="color:var(--stone);text-align:center;padding:24px">Complete Step 2.3 (Competency Framework) to populate this view.</p>','margin-bottom:16px');
  }

  // ── 2. Study Completion Grid (per leader) ──
  var ldevSteps=LDEV_STEPS;
  if(leaders.length){
    var _indivDone=data.indivDone||{};
    h+=card('<h3 class="h-sub">Study Completion</h3>'
      +'<p style="font-size:12px;color:var(--stone);margin:0 0 16px">Individual mindset & composure track \u2014 completion per leader.</p>'
      +'<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:180px repeat('+ldevSteps.length+',1fr);gap:1px;font-size:12px;min-width:'+(180+ldevSteps.length*90)+'px">'
      +'<div style="padding:8px"></div>'
      +ldevSteps.map(function(s){return'<div style="padding:8px 4px;font-family:var(--mono);font-size:9px;color:var(--stone);text-align:center;letter-spacing:.06em">'+esc(s.name)+'</div>';}).join('')
      +leaders.map(function(l){
        var dn=_indivDone[l.id]||{};
        var linked=!!l.userId;
        return'<div style="padding:8px;font-weight:600;font-size:11px;color:var(--paper);border-top:1px solid rgba(var(--fg-rgb),.06);display:flex;align-items:center;gap:6px">'+esc(l.name||'?')+(linked?'':' <span style="font-family:var(--mono);font-size:8px;color:var(--stone)">(no login)</span>')+'</div>'
          +ldevSteps.map(function(s){
            var done=!!dn[s.id];
            return'<div style="padding:8px;text-align:center;border-top:1px solid rgba(var(--fg-rgb),.06);color:'+(done?'#1B6B5A':'rgba(138,130,120,.5)')+';font-size:14px;font-weight:700">'+(done?'\u2713':'\u25CB')+'</div>';
          }).join('');
      }).join('')
      +'</div></div>'
    ,'margin-bottom:16px');
  } else {
    h+=card('<h3 class="h-sub-lg">Study Completion</h3><p style="color:var(--stone);text-align:center;padding:24px">No leaders mapped yet.</p>','margin-bottom:16px');
  }

  // ── 3. Fluency Progress ──
  if(leaders.length){
    var baselineFluency=(a.fluency||{}).foundational||0;
    h+=card('<h3 class="h-sub-lg">AI Fluency Progress</h3>'
      +leaders.map(function(l,i){
        var baseline=parseInt(l.fluency)||baselineFluency;
        var rescore=(rv.leaders||{})[l.id]?(rv.leaders[l.id].fluency||0):0;
        var fl=data.fluencySprint||{};var lt=(fl.leaderTasks||{})[l.id]||{};
        var taskCount=[lt.task1,lt.task2,lt.task3].filter(function(t){return!!t}).length;
        var delta=rescore?rescore-baseline:null;
        var deltaCol=delta!==null?(delta>=2?'#1B6B5A':delta>=1?'#4E7FA6':'var(--text-body)'):'var(--stone)';
        return'<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.04)">'
          +'<div style="min-width:140px"><div style="font-size:13px;font-weight:600;color:var(--paper)">'+esc(l.name||'Leader '+(i+1))+'</div><div style="font-size:11px;color:var(--stone)">'+esc(leaderRoleName(l))+'</div></div>'
          +'<div style="min-width:70px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Baseline</div><div style="font-size:16px;font-weight:700;color:var(--paper)">'+baseline+'/5</div></div>'
          +'<div style="min-width:70px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Tasks</div><div style="font-size:16px;font-weight:700;color:'+(taskCount>=3?'#1B6B5A':taskCount>0?'#4E7FA6':'var(--stone)')+'">'+taskCount+'/3</div></div>'
          +'<div style="min-width:70px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Rescore</div><div style="font-size:16px;font-weight:700;color:var(--paper)">'+(rescore||'\u2014')+'</div></div>'
          +(delta!==null?'<div style="min-width:80px;text-align:center"><div style="font-family:var(--mono);font-size:10px;color:var(--stone)">Growth</div><div style="font-family:var(--mono);font-size:13px;font-weight:700;color:'+deltaCol+'">'+(delta>0?'+':'')+delta+'</div></div>':'')
          +'</div>';
      }).join('')
    ,'margin-bottom:16px');
  }

  // ── 4. Ongoing Practices Health (per-leader grid) ──
  // Rows are keyed to LEADERS (not login accounts), showing the leader's name. The
  // practice data is stored per user (data.practiceLog[userId]), so each leader is
  // mapped to its linked user via leader.userId to pull the right log. Leaders with
  // no linked login have no log (all cells "not started"), matching Study Completion.
  var now=new Date();
  function daysSince(isoStr){if(!isoStr)return null;return Math.floor((now-new Date(isoStr))/(1000*60*60*24))}
  var practiceKeys=LDEV_PRACTICES;
  // Pair each leader with its linked user (for the practice log + avatar color).
  var _practiceRows=(data.leaders||[]).map(function(l){
    var u=l.userId?USERS.find(function(x){return x.id===l.userId;}):null;
    return {leader:l,user:u,log:((data.practiceLog||{})[l.userId])||{}};
  });
  // A practice counts as done when its last-done timestamp falls within the CURRENT
  // period (this calendar month). The grid is binary: done (green) or not started.
  // No "days since", no overdue, no blue -- within a month a practice is simply done
  // or not.
  function doneThisPeriod(isoStr){
    if(!isoStr)return false;
    return periodKey(new Date(isoStr))===periodKey(new Date());
  }
  function statusDot(done){
    if(done)return'<div style="width:10px;height:10px;border-radius:50%;background:#1B6B5A" title="Done this month"></div>';
    return'<div style="width:10px;height:10px;border-radius:50%;background:rgba(138,130,120,.3)" title="Not started"></div>';
  }
  // Leader-initial avatar fallback for leaders with no linked login.
  function leaderAv(l,size){
    var s=size||18;var ini=(l.name||'?').split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();
    return'<div title="'+esc(l.name||'')+'" style="width:'+s+'px;height:'+s+'px;border-radius:'+(s/2)+'px;background:rgba(138,130,120,.35);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:'+Math.round(s*0.42)+'px;font-weight:700;font-family:monospace;flex-shrink:0">'+esc(ini)+'</div>';
  }
  // Summary counts across all leaders: done vs not started for the current month.
  var greenCount=0;var greyCount=0;
  _practiceRows.forEach(function(row){practiceKeys.forEach(function(p){if(doneThisPeriod(row.log[p.id]||null))greenCount++;else greyCount++})});

  // Monthly reviews only begin once the 90-day module is complete (all organizational
  // steps across phases 1-4 done). Until then this tracker is dormant: leaders have not
  // yet reached all the work these reviews maintain, so tracking would be meaningless.
  // Individual-track stragglers are surfaced separately on the Study Completion grid.
  var _reviewsLive=getProgress().pct===100;
  if(!_reviewsLive){
    h+=card('<h3 class="h-sub-lg">Monthly Reviews Health</h3>'
      +'<div style="text-align:center;padding:28px 20px;opacity:.7">'
      +'<div style="font-family:var(--mono);font-size:10px;color:var(--stone);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">\u25CB Dormant</div>'
      +'<p style="font-size:13px;color:var(--stone);line-height:1.6;max-width:440px;margin:0 auto">Monthly reviews begin once the 90-day module is complete. Until every organizational step across Phases 1\u20134 is finished, leaders are still working through the practices these reviews maintain. Track who has completed their individual work on the Study Completion grid above.</p>'
      +'</div>'
    ,'margin-bottom:16px');
  } else {
  h+=card('<h3 class="h-sub-lg">Monthly Reviews Health</h3>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:10px 14px;background:rgba(107,76,138,.06);border:1px solid rgba(107,76,138,.25);border-radius:8px">'
    +'<div style="display:flex;align-items:baseline;gap:10px"><span style="font-family:var(--serif);font-size:18px;font-weight:300;color:var(--paper)">'+esc(periodLabel(periodKey(new Date())))+'</span><span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+daysLeftInMonth(new Date())+' days left in this period</span></div>'
    +'<button onclick="if(confirm(\'Close the current period? This archives the current practice health as a snapshot you can view later, and resets everyone\\u2019s practices for the new period.\'))manualResetPractices()" style="padding:5px 12px;font-size:11px;font-family:var(--mono);background:rgba(var(--fg-rgb),.05);border:1px solid rgba(var(--fg-rgb),.15);border-radius:6px;color:var(--stone);cursor:pointer">Close period &amp; reset</button>'
    +'</div>'
    +'<div style="display:flex;gap:16px;margin-bottom:16px">'
    +'<div style="text-align:center;flex:1"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:#1B6B5A">'+greenCount+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.1em">Done</div></div>'
    +'<div style="text-align:center;flex:1"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:var(--stone)">'+greyCount+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.1em">Not Started</div></div>'
    +'</div>'
    // Grid: leaders as rows, practices as columns
    +(_practiceRows.length?('<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:150px repeat('+practiceKeys.length+',1fr);gap:1px;min-width:'+(150+practiceKeys.length*80)+'px">'
    // Header row
    +'<div style="padding:6px 8px"></div>'
    +practiceKeys.map(function(p){return'<div style="padding:6px 4px;font-family:var(--mono);font-size:9px;color:var(--stone);text-align:center;letter-spacing:.05em">'+esc(p.name)+'</div>'}).join('')
    // Leader rows
    +_practiceRows.map(function(row){
      var l=row.leader;var av=row.user?userAv(row.user,18):leaderAv(l,18);
      var nm=(l.name||'?').split(' ')[0];
      return'<div style="padding:8px;display:flex;align-items:center;gap:6px;border-top:1px solid rgba(var(--fg-rgb),.04)">'+av+'<span style="font-size:11px;color:var(--paper);font-weight:600">'+esc(nm)+'</span>'+(row.user?'':' <span style="font-family:var(--mono);font-size:8px;color:var(--stone)">(no login)</span>')+'</div>'
        +practiceKeys.map(function(p){
          var done=doneThisPeriod(row.log[p.id]||null);
          return'<div style="padding:8px;text-align:center;border-top:1px solid rgba(var(--fg-rgb),.04);display:flex;align-items:center;justify-content:center">'+statusDot(done)+'</div>';
        }).join('');
    }).join('')
    +'</div></div>'):'<p style="color:var(--stone);text-align:center;padding:16px;font-size:13px">No leaders mapped yet.</p>')
  ,'margin-bottom:16px');
  }

  // ── 4b. Practice History (archived period snapshots) ──
  var _hist=data.practiceHistory||{};
  var _histKeys=Object.keys(_hist).sort().reverse();  // most recent first
  if(_histKeys.length){
    var hh='<h3 class="h-sub">Practice History</h3>'
      +'<p style="font-size:12px;color:var(--stone);margin:0 0 14px">Archived snapshots of how practices stood at the close of each period.</p>';
    _histKeys.forEach(function(pk){
      var rec=_hist[pk];if(!rec)return;
      var hk='ph_hist_'+pk;var hopen=UI.ctxOpen[hk];
      var sm=rec.summary||{green:0,red:0,grey:0};
      hh+='<div style="border:1px solid rgba(var(--fg-rgb),.08);border-radius:8px;margin-bottom:8px;overflow:hidden">';
      hh+='<div onclick="UI.ctxOpen[\''+hk+'\']=!UI.ctxOpen[\''+hk+'\'];render()" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer">';
      hh+='<span style="font-size:13px;font-weight:600;color:var(--paper);flex:1">'+esc(periodLabel(pk))+'</span>';
      hh+='<span style="font-family:var(--mono);font-size:10px;color:#1B6B5A">'+sm.green+' done</span>';
      hh+='<span style="font-family:var(--mono);font-size:10px;color:#9B2D3F">'+sm.red+' not done</span>';
      hh+='<span style="font-size:11px;color:rgba(138,130,120,.6)">'+(hopen?'\u25BE':'\u25B8')+'</span></div>';
      if(hopen){
        var us=rec.users||[];var ps=rec.practices||[];var cells=rec.cells||{};
        hh+='<div style="padding:0 14px 14px;overflow-x:auto"><div style="display:grid;grid-template-columns:120px repeat('+ps.length+',1fr);gap:1px;min-width:'+(120+ps.length*70)+'px">';
        hh+='<div style="padding:6px 8px"></div>';
        ps.forEach(function(p){hh+='<div style="padding:6px 4px;font-family:var(--mono);font-size:9px;color:var(--stone);text-align:center;letter-spacing:.05em">'+esc(p.name)+'</div>';});
        us.forEach(function(u){
          var row=cells[u.id]||{};
          hh+='<div style="padding:8px;font-size:11px;color:var(--paper);font-weight:600;border-top:1px solid rgba(var(--fg-rgb),.04)">'+esc((u.name||'?').split(' ')[0])+'</div>';
          ps.forEach(function(p){
            var s=row[p.id]||'grey';
            // Binary in history: done that month (green/blue from older snapshots) -> green;
            // not done (red/grey) -> red. No blue, no "not started" distinction here.
            var done=(s==='green'||s==='blue');
            var col=done?'#1B6B5A':'#9B2D3F';
            hh+='<div style="padding:8px;text-align:center;border-top:1px solid rgba(var(--fg-rgb),.04)"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+col+'"></span></div>';
          });
        });
        hh+='</div></div>';
      }
      hh+='</div>';
    });
    h+=card(hh,'margin-bottom:16px');
  }

  // ── 5. Development Priorities ──
  if(leaders.length&&cf.scores){
    var gaps=ldevGaps();
    if(gaps.length){
      h+=card('<h3 class="h-sub-lg">Development Priorities</h3><p style="font-size:13px;color:var(--stone);margin-bottom:12px">Competencies ranked by gap severity (lowest average scores first).</p>'
        +gaps.map(function(g,i){
          var col=g.avg>=4?'#1B6B5A':g.avg>=2.5?'#4E7FA6':'#9B2D3F';
          return'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-family:var(--mono);font-size:12px;color:var(--stone);width:20px;text-align:right">'+(i+1)+'</div><div style="font-size:13px;color:var(--paper);min-width:200px">'+esc(g.name)+'</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:'+g.avg*20+'%;background:'+col+';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:30px;text-align:right">'+g.avg.toFixed(1)+'</div></div>';
        }).join('')
      ,'border:2px solid #4E7FA6');
    }
  }

  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 17 — Add the constant holding the module name printed at the top of the first page of every printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderLdevHub` ends, after its closing `}`.

**Code:**

```js

/* ═══ OUTCOME PAGES ═══ */

/* PRINT PIPELINE (Paul's ruling, 12 Sep 2026; family baseline). Executive Readiness printed the live page; it now prints a document: a cover, the output's body without its heading and without controls, and the copyright footer on every page. */
var PRINT_MODULE_NAME='90-Day Executive Readiness'; /* 16 Sep 2026 (Paul's ruling): the cover's kicker takes the Governance form — 90-Day and the module's name, as Governance reads 90-Day Responsible AI Governance; the home page reads 90 Days to Executive Readiness and the sidebar Executive Readiness */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 18 — Add the function that prints today's date as words for the first page of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PRINT_MODULE_NAME` ends.

**Code:**

```js

/* PRINT BASELINE (Paul's ruling, 12 Sep 2026; family): the cover's parts and the footer's words */
function printDateLine(){return new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 19 — Add the function that writes the copyright line printed at the bottom left of every page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDateLine` ends, after its closing `}`.

**Code:**

```js
function printFooterText(){return '\u00a9 '+new Date().getFullYear()+' Next Chapter, LLC. All rights reserved.'} /* the same words as the site footer at nextchapter.org */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 20 — Add the function that draws the first page of a printed document: the module line, the title, the subtitle, the organization's name, the date.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printFooterText` ends, after its closing `}`.

**Code:**

```js
function printDocCover(title,lead,countLine){var org=(function(){var ent=(data&&data.enterprise&&String(data.enterprise.name||'').trim())||'';if(ent)return ent;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return (o&&o.name)||''})(); /* 13 Sep 2026 (Paul's ruling; family): the cover names the organization as Organization Details (the Organization & Team panel) records it; the sign-in organization's label is the fallback only when that name is blank — ported to Executive Readiness 16 Sep 2026 (Paul's ruling: the cover as Governance has it) */
return '<div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh">'
+'<div style="font-family:var(--mono,monospace);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:0 0 18px">NextChapter \u00b7 '+esc(PRINT_MODULE_NAME)+'</div>'
+'<div style="font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px">'+esc(title)+'</div>'
+(lead?'<div style="font-size:14px;color:#444;line-height:1.6;max-width:520px;margin:0 0 26px">'+esc(lead)+'</div>':'')
+'<div style="border-top:2px solid #111;padding-top:12px;color:#333">'+(org?'<div style="font-size:18px;font-weight:600;color:#111;margin:0 0 4px">'+esc(org)+'</div>':'')+'<div style="font-size:13px">'+printDateLine()+'</div></div>'
+'</div>'} /* PRINT COVER (Paul's ruling, 12 Sep 2026; family): NextChapter · module, the title, the lead, the organization a little bigger, the date alone; no phase, no count (the count argument is accepted and ignored) */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 21 — Add the constant mapping each output's identifier to the function that draws its page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDocCover` ends, after its closing `}`.

**Code:**

```js
var OUT_RENDERERS={'out-readiness':renderOutReadiness,'out-inventory':renderOutInventory,'out-riskmap':renderOutRiskMap,'out-structure':renderOutStructure,'out-collab':renderOutCollab,'out-competency':renderOutCompetency,'out-fluency':renderOutFluency,'out-decisions':renderOutDecisions,'out-mmprinciples':renderOutMMPrinciples,'out-values':renderOutValues,'out-rhythm':renderOutRhythm,'out-evalplan':renderOutEvalPlan,'out-review':renderOutReview};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 22 — Add the function that removes the screen heading block and every control from a page's markup before it prints.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `OUT_RENDERERS` ends.

**Code:**

```js
function _pdStrip(body){var m=body.indexOf('Save as PDF</button></div>');if(m>=0)body=body.slice(m+26);return body.replace(/<button[\s\S]*?<\/button>/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 23 — Add the function that reads a page's title from its markup for the printed document's first page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pdStrip` ends, after its closing `}`.

**Code:**

```js
function _pdTitle(body){var m=body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);return m?m[1].replace(/<[^>]+>/g,'').trim():'Report'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 24 — Add the function that reads a page's lead sentence from its markup for the printed document's first page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pdTitle` ends, after its closing `}`.

**Code:**

```js
function _pdLead(body){var m=body.indexOf('Save as PDF</button></div>');if(m<0)return '';var p=body.slice(0,m).match(/<p[^>]*>([\s\S]*?)<\/p>/);return p?p[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim():''}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 25 — Add the function behind an output page's Save as PDF button. It now prints the output's own document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pdLead` ends, after its closing `}`.

**Code:**

```js
function printCurrentOutput(){var doc=(typeof PRINT_DOCS!=='undefined')&&PRINT_DOCS[currentStep];if(doc){var nm=((PH.reduce(function(a,p){return a.concat(p.outcomes||[])},[]).find(function(o){return o.id===currentStep}))||{}).name||'Output';printDocument(nm,doc(),'');return} /* 14 Sep 2026 (Paul's ruling): an output with a document prints the document; the cleaned screen is the fallback */
  var fn=OUT_RENDERERS[currentStep];if(!fn){window.print();return}var raw=fn();printPage(_pdTitle(raw),function(){return raw})}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 26 — Replace the function that draws an output page from its identifier.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutcomePage`.

**Code:**

```js
function renderOutcomePage(){
  var id=currentStep;var ph=currentPhase;
  var h='<div class="content-area"><div class="content-inner">';
  h+=backBtn();
  if(id==='out-readiness')h+=renderOutReadiness();
  else if(id==='out-inventory')h+=renderOutInventory();
  else if(id==='out-riskmap')h+=renderOutRiskMap();
  else if(id==='out-structure')h+=renderOutStructure();
  else if(id==='out-collab')h+=renderOutCollab();
  else if(id==='out-competency')h+=renderOutCompetency();
  else if(id==='out-fluency')h+=renderOutFluency();
  else if(id==='out-decisions')h+=renderOutDecisions();
  else if(id==='out-mmprinciples')h+=renderOutMMPrinciples();
  else if(id==='out-values')h+=renderOutValues();
  else if(id==='out-rhythm')h+=renderOutRhythm();
  else if(id==='out-evalplan')h+=renderOutEvalPlan();
  else if(id==='out-review')h+=renderOutReview();
  else h+='<p style="color:var(--stone)">This output will be generated when the relevant steps are complete.</p>';
  h+='</div></div>';return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 27 — Add the function that draws the Readiness Report's tiles, score card, and category cards.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderOutcomePage` ends, after its closing `}`.

**Code:**

```js

/* ── Readiness Report ── */
function readinessBody(){ /* the Readiness Report page: the five area tiles, the overall score card, and the category cards with their bars; its document is readinessDoc (15 Sep 2026, Paul's ruling: a document is composed for paper, never the page passed through) */
  var a=data.assessments||{};var co=data.completedSections||{};var secs=['A','B','C','D','E'];var done=secs.filter(function(s){return co[s]}).length;var h='';
  // Summary stats
  var scores=[];
  var cats=READINESS_CATS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  h+='<div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">';
  cats.forEach(function(cat){
    var sub=a[cat.k]||{};var vals=cat.fields.map(function(f){return typeof sub[f]==='number'?sub[f]:0}).filter(function(v){return v>0});
    var avg=vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0;
    scores.push(avg);
    var col=avg>=4?'#1B6B5A':avg>=2.5?'#4E7FA6':'#9B2D3F';
    h+='<div style="flex:1;min-width:140px;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+col+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:'+col+'">'+avg.toFixed(1)+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase;margin-top:4px">'+cat.name+'</div></div>';
  });
  h+='</div>';
  // Overall
  var overall=scores.length?scores.reduce(function(a,b){return a+b},0)/scores.length:0;
  var oCol=overall>=4?'#1B6B5A':overall>=2.5?'#4E7FA6':'#9B2D3F';
  h+=card('<div style="text-align:center"><div style="font-family:var(--serif);font-size:56px;font-weight:300;color:'+oCol+'">'+overall.toFixed(1)+'<span style="font-size:24px;color:var(--stone)">/5</span></div><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--stone);text-transform:uppercase;margin-top:4px">Overall Readiness Score</div><div style="margin-top:12px;font-size:13px;color:var(--stone)">'+readinessReading(overall)+'</div></div>','border:2px solid '+oCol+';margin-bottom:24px');
  // Section details
  if(done<5){h+='<p style="color:var(--stone);font-style:italic">Complete all five sections of the Assessment Battery to see detailed breakdowns.</p>';return h}
  cats.forEach(function(cat){
    var sub=a[cat.k]||{};
    h+=card('<h3 class="h-sub-lg">'+cat.name+'</h3>'+cat.fields.map(function(f){
      var v=typeof sub[f]==='number'?sub[f]:0;var barCol=v>=4?'#1B6B5A':v>=3?'#4E7FA6':'#9B2D3F';
      return'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-size:12px;color:var(--stone);min-width:140px">'+esc(READINESS_LABELS[f]||f)+'</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:'+v*20+'%;background:'+barCol+';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:24px;text-align:right">'+v+'</div></div>'
    }).join('')+
    // Show text fields if they exist
    (sub.mission?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06)"><div style="font-size:11px;color:var(--stone);font-weight:600;margin-bottom:4px">Mission</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(sub.mission)+'</div></div>':'')+
    (sub.priorities?'<div style="margin-top:8px"><div style="font-size:11px;color:var(--stone);font-weight:600;margin-bottom:4px">Strategic Priorities</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(sub.priorities)+'</div></div>':'')
    );
  });
    return h}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 28 — Replace the function that draws the Readiness Report page. It now draws its content with the function added in the last step.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutReadiness`.

**Code:**

```js
function renderOutReadiness(){
  var a=data.assessments||{};var co=data.completedSections||{};
  var secs=['A','B','C','D','E'];var done=secs.filter(function(s){return co[s]}).length;
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Readiness Report</h2><p style="color:var(--stone);font-size:13px">Phase 1: Assess \u2014 synthesized from the Assessment Battery</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=readinessBody();
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 29 — Add the function that works out the four figures shown at the top of the Leadership Inventory page and document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderOutReadiness` ends, after its closing `}`.

**Code:**

```js

/* ── Leadership Inventory ── */
function inventoryFigs(){var leaders=data.leaders||[]; /* 15 Sep 2026: the four figures the page's band and the Leadership Inventory document share */
  var fluencyVals=leaders.map(function(l){return parseInt(l.fluency)||0}).filter(function(v){return v>0});
  var avgFluency=fluencyVals.length?(fluencyVals.reduce(function(a,b){return a+b},0)/fluencyVals.length).toFixed(1):'—';
  var activeCount=leaders.filter(function(l){return l.engagement==='active'}).length;
  var overloaded=leaders.filter(function(l){return l.bandwidth==='overloaded'||l.bandwidth==='stretched'}).length;
  return {total:leaders.length,avgFluency:avgFluency,active:activeCount,overloaded:overloaded}}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 30 — Add the function that draws the Leadership Inventory's row of figures.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `inventoryFigs` ends, after its closing `}`.

**Code:**

```js
function inventoryStatBand(){var leaders=data.leaders||[];var h='';var _f=inventoryFigs();var avgFluency=_f.avgFluency,activeCount=_f.active,overloaded=_f.overloaded;
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #2D5A8E"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#2D5A8E">'+leaders.length+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Leaders Mapped</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #1B6B5A"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#1B6B5A">'+avgFluency+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Avg AI Fluency</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(activeCount>=leaders.length/2?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+activeCount+'/'+leaders.length+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Actively Engaged</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(overloaded>leaders.length/2?'#9B2D3F':'#1B6B5A')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:'+(overloaded>leaders.length/2?'#9B2D3F':'var(--paper)')+'">'+overloaded+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Stretched/Overloaded</div></div>';
  h+='</div>';
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 31 — Replace the function that draws the Leadership Inventory page: the row of figures, then the leaders as record tables.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutInventory`.

**Code:**

```js
function renderOutInventory(){
  var leaders=data.leaders||[];var ln=data.landscapeNotes||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Inventory</h2><p style="color:var(--stone);font-size:13px">Phase 1: Assess \u2014 synthesized from the Leadership Landscape step</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=inventoryStatBand();
  // Leader profiles
  if(!leaders.length){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">No leaders mapped yet. Complete Step 1.2.</p>');return h}
  h+=lyScreenRegister('leader',leaders,'full',LEADER_LAYER_INDEX.landscape); /* 14 Sep 2026 (Paul's ruling): the page shows the engine's record blocks, as the document prints them; one form */
  // Ownership gap and MM assessment
  if(ln.ownershipGap){h+=card('<h3 class="h-sub-lg">Transformation Ownership Gap</h3><p style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ln.ownershipGap)+'</p>','border-left:3px solid #4E7FA6')}
  if(ln.mmAssessment){h+=card('<h3 class="h-sub-lg">Middle Management Assessment</h3><p style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ln.mmAssessment)+'</p>','border-left:3px solid #8B5E3C')}
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 32 — Add the function that draws the Risk Map's summary figures and its risk cards.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderOutInventory` ends, after its closing `}`.

**Code:**

```js

/* ── Risk Map ── */
function riskMapBody(){ /* the Risk Map page: the summary band first, then each scored risk as a card with its three scores and its bar; its document is riskMapDoc (15 Sep 2026, Paul's ruling: a document is composed for paper, never the page passed through) */
  var risks=data.risks||[];var h='';
  if(!risks.length||!risks.some(function(r){return r.likelihood>0})){
    return card('<p style="color:var(--stone);text-align:center;padding:32px">No risks scored yet. Complete Step 1.3.</p>');
  }
  var names={'zillow':'Deploying Without Readiness','calstate':'Transformation Without Engagement','aircanada':'AI Without Boundaries','cigna':'Eliminating Human Judgment','stigma':'Cultural Readiness Failure','disruption':'Competitive Disruption','fatigue':'Change Fatigue'};
  var colors=['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F','#6B4C8A','#4E7FA6','#3D5A6E'];
  // Sort by total score descending
  var scored=risks.filter(function(r){return(r.likelihood+r.impact+r.timeHorizon)>0}).sort(function(a,b){return(b.likelihood+b.impact+b.timeHorizon)-(a.likelihood+a.impact+a.timeHorizon)});
  var criticalCount=scored.filter(function(r){return(r.likelihood+r.impact+r.timeHorizon)>10}).length;
  var moderateCount=scored.filter(function(r){var t=r.likelihood+r.impact+r.timeHorizon;return t>5&&t<=10}).length;
  var lowCount=scored.filter(function(r){return(r.likelihood+r.impact+r.timeHorizon)<=5&&(r.likelihood+r.impact+r.timeHorizon)>0}).length;
  var critCol=criticalCount>0?'#9B2D3F':'#1B6B5A';
  h+=card('<div style="display:flex;gap:16px;align-items:center;justify-content:center"><div style="text-align:center;padding:16px 24px;border-right:1px solid rgba(var(--fg-rgb),.06)"><div style="font-family:var(--serif);font-size:56px;font-weight:300;color:'+critCol+'">'+criticalCount+'</div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:'+critCol+';text-transform:uppercase;margin-top:4px">Critical Risks</div><div style="font-size:11px;color:var(--stone);margin-top:2px">score above 10/15</div></div><div style="text-align:center;padding:16px 24px;border-right:1px solid rgba(var(--fg-rgb),.06)"><div style="font-family:var(--serif);font-size:36px;font-weight:300;color:var(--gold)">'+moderateCount+'</div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-top:4px">Moderate</div><div style="font-size:11px;color:var(--stone);margin-top:2px">score 6\u201310</div></div><div style="text-align:center;padding:16px 24px"><div style="font-family:var(--serif);font-size:36px;font-weight:300;color:#1B6B5A">'+lowCount+'</div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:#1B6B5A;text-transform:uppercase;margin-top:4px">Low</div><div style="font-size:11px;color:var(--stone);margin-top:2px">score 1\u20135</div></div></div><div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid rgba(var(--fg-rgb),.06);font-size:13px;color:var(--stone)">'+scored.length+' of 7 scenarios assessed</div>','border:2px solid '+critCol);
  // Top risks
  h+='<div style="margin-bottom:24px">';
  scored.forEach(function(r,idx){
    var total=r.likelihood+r.impact+r.timeHorizon;var pct=Math.round(total/15*100);
    var col=total>10?'#9B2D3F':total>5?'#4E7FA6':'#1B6B5A';
    var sids=['zillow','calstate','aircanada','cigna','stigma','disruption','fatigue'];
    var cidx=sids.indexOf(r.id);var bCol=colors[cidx>=0?cidx:0];
    h+=card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4 style="font-size:14px;font-weight:700;margin:0">'+esc(names[r.id]||r.id)+'</h4>'+badge('Score: '+total+'/15',col)+'</div>'
      +'<div style="display:flex;gap:16px;margin-bottom:8px"><div style="font-size:12px;color:var(--stone)">Likelihood: <strong style="color:var(--paper)">'+r.likelihood+'</strong></div><div style="font-size:12px;color:var(--stone)">Impact: <strong style="color:var(--paper)">'+r.impact+'</strong></div><div style="font-size:12px;color:var(--stone)">Timing: <strong style="color:var(--paper)">'+r.timeHorizon+'</strong></div></div>'
      +'<div style="height:8px;background:rgba(var(--fg-rgb),.06);border-radius:4px;margin-bottom:8px"><div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:4px;transition:width .3s"></div></div>'
      +(r.notes?'<div style="font-size:12px;color:var(--stone);line-height:1.5;font-style:italic">'+esc(r.notes)+'</div>':'')
    ,'border-left:3px solid '+bCol+';margin-bottom:8px');
  });
  h+='</div>';
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 33 — Replace the function that draws the Risk Map page. It now draws its content with the function added in the last step, with the summary figures at the top.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutRiskMap`.

**Code:**

```js
function renderOutRiskMap(){
  var risks=data.risks||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Risk Map</h2><p style="color:var(--stone);font-size:13px">Phase 1: Assess \u2014 synthesized from Leadership Risk Mapping</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  h+=riskMapBody();
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 34 — Replace the function that draws the Leadership Structure page.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutStructure`.

**Code:**

```js

/* ── Leadership Structure ── */
function renderOutStructure(){
  var st=data.structure||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Structure</h2><p style="color:var(--stone);font-size:13px">Phase 2: Build \u2014 synthesized from the Leadership Structure Lab</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var sections=STRUCTURE_SECTIONS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  var completed=sections.filter(function(s){return st[s.id+'_done']}).length;
  // Summary
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #2D5A8E"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#2D5A8E">'+completed+'/5</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Sections Complete</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(st.ownerModel?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+(st.ownerModel?'\u2713':'\u2014')+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Ownership Defined</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(st.boardStructure?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+(st.boardStructure?'\u2713':'\u2014')+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Board Governance</div></div>';
  h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+(st.mmHuman?'#1B6B5A':'#4E7FA6')+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300">'+(st.mmHuman?'\u2713':'\u2014')+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">MM Principles</div></div>';
  h+='</div>';
  if(!completed){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">No sections completed yet. Complete Step 2.1.</p>');return h}
  // Section details
  var _ownerModelLabels={cito:'Chief Innovation & Transformation Officer',cao:'Chief AI Officer',ctro:'Chief Transformation Officer',expand_cio:'Expanded CIO role (cultural/strategic mandate)',council:'Cross-functional AI Transformation Council',dual:'Dual ownership (technology + cultural/strategic leader)'};
  var _coordLabels={council:'AI Transformation Council (cross-functional standing body)',epmo:'Enterprise Portfolio Management Office',matrix:'Matrix reporting for embedded AI leads',rotation:'Leadership rotation through AI-intensive projects',network:'Innovation network model'};
  sections.forEach(function(sec){
    if(!st[sec.id+'_done'])return;
    var col=sec.id==='middle'?'#8B5E3C':sec.id==='crossfunc'?'#6B4C8A':'#2D5A8E';
    h+=card('<h3 class="h-sub-lg">'+esc(sec.name)+'</h3>'
      +sec.fields.map(function(f){
        var v=st[f.k]||'';if(f.k==='boardExpertise')v=boardExpertiseSummary()||v;if(!v)return'';
        if(f.k==='boardStructure'){var _bsl={dedicated:'Dedicated AI/Technology committee',expanded:'Expand existing Risk or Strategy committee',standing:'Standing AI agenda item on full board',none:'No formal board oversight (will create)',other:(st.boardStructureOther||'Other')};v=_bsl[v]||v;}
        if(f.k==='ownerModel'&&_ownerModelLabels[v])v=_ownerModelLabels[v];
        else if(f.k==='coordMechanism'&&_coordLabels[v])v=_coordLabels[v];
        return'<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(f.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(v)+'</div></div>';
      }).join('')
    ,'border-left:3px solid '+col);
  });
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 35 — Replace the function that draws the Collaboration Principles page.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutCollab`.

**Code:**

```js

/* ── Collaboration Principles ── */
function renderOutCollab(){
  var cl=data.collabLab||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Collaboration Principles</h2><p style="color:var(--stone);font-size:13px">Phase 2: Build \u2014 synthesized from the AI Collaboration Lab</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var sections=COLLAB_SECTIONS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  var completed=sections.filter(function(s){return cl[s.id+'_done']}).length;
  h+='<div style="text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid #2D5A8E;margin-bottom:24px"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:#2D5A8E">'+completed+'/5</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">Sections Complete</div></div>';
  if(!completed){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">No sections completed yet. Complete Step 2.2.</p>');return h}
  var colors=['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F','#6B4C8A'];
  sections.forEach(function(sec,idx){
    if(!cl[sec.id+'_done'])return;
    h+=card('<h3 class="h-sub-lg">'+esc(sec.name)+'</h3>'
      +sec.fields.map(function(f){
        if(f.rows)return f.rows(cl).filter(function(r){return r.v}).map(function(r){return '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(r.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(r.v)+'</div></div>'}).join(''); /* 16 Sep 2026: a rows field, as the document prints it */
        var v=cl[f.k]||'';if(!v)return'';
        return'<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(f.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(v)+'</div></div>';
      }).join('')
    ,'border-left:3px solid '+colors[idx%colors.length]);
  });
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 36 — Replace the function that draws the Competency Framework page: the Development Priorities at the top, then the leaders as record tables with a Summary / Full choice above them.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutCompetency`.

**Code:**

```js

/* ── Competency Framework Output ── */
function renderOutCompetency(){
  var cf=data.competencyFramework||{};var leaders=data.leaders||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Competency Framework</h2><p style="color:var(--stone);font-size:13px">Phase 2: Build \u2014 synthesized from the Competency Framework step</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var COMPS=[
    {id:'orchestration',name:'AI Orchestration'},
    {id:'philosophical',name:'Philosophical & Ethical Reasoning'},
    {id:'hybrid',name:'Hybrid Team Leadership'},
    {id:'change',name:'Change & Transformation'},
    {id:'composure',name:'Composure & Adaptive Judgment'},
    {id:'ecosystem',name:'Ecosystem Stewardship'},
    {id:'emotional',name:'Emotional Intelligence'}
  ];
  // Gap priorities — 16 Sep 2026 (Paul's ruling): at the top of the page, above the leaders
  if(leaders.length){
    var gaps=COMPS.map(function(c){
      var vals=leaders.map(function(l){return(cf.scores||{})[l.id+'_'+c.id]||0}).filter(function(v){return v>0});
      return{name:c.name,avg:vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0};
    }).filter(function(g){return g.avg>0}).sort(function(a,b){return a.avg-b.avg});
    if(gaps.length){
      h+=card('<h3 class="h-sub-lg">Development Priorities</h3><p style="font-size:13px;color:var(--stone);margin-bottom:12px">Competencies ranked by gap severity (lowest scores first).</p>'
        +gaps.map(function(g,i){
          var col=g.avg>=4?'#1B6B5A':g.avg>=2.5?'#4E7FA6':'#9B2D3F';
          return'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-family:var(--mono);font-size:12px;color:var(--stone);width:20px;text-align:right">'+(i+1)+'</div><div style="font-size:13px;color:var(--paper);min-width:220px">'+esc(g.name)+'</div><div style="flex:1;height:6px;background:rgba(var(--fg-rgb),.06);border-radius:3px"><div style="height:100%;width:'+g.avg*20+'%;background:'+col+';border-radius:3px"></div></div><div style="font-family:var(--mono);font-size:12px;color:var(--paper);min-width:30px;text-align:right">'+g.avg.toFixed(1)+'</div></div>';
        }).join('')
      ,'border:2px solid #4E7FA6');
    }
  }
  if(leaders.length){
  h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>';
  h+=lyScreenRegister('leader',leaders,(UI.printDepth||'summary'),LEADER_LAYER_INDEX.competency); /* 14 Sep 2026 (Paul's ruling): the engine's record blocks at the chosen depth; the screen-only / print-only heat map retired */
  }
  // Per-competency detail
  COMPS.forEach(function(c){
    var def=(cf.definitions||{})[c.id]||'';
    var vals=leaders.map(function(l){return(cf.scores||{})[l.id+'_'+c.id]||0}).filter(function(v){return v>0});
    var avg=vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length):0;
    var col=avg>=4?'#1B6B5A':avg>=2.5?'#4E7FA6':'#9B2D3F';
    h+=card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h4 style="font-size:15px;font-weight:700;margin:0">'+esc(c.name)+'</h4>'+(avg?badge('Avg: '+avg.toFixed(1)+'/5',col):'')+'</div>'
      +(def?'<div style="font-size:13px;color:var(--paper);line-height:1.6;margin-bottom:12px;padding:12px;background:rgba(var(--fg-rgb),.03);border-left:2px solid #2D5A8E">'+esc(def)+'</div>':'')
      +(leaders.length?'<div style="display:flex;gap:8px;flex-wrap:wrap">'+leaders.map(function(l,i){
        var v=(cf.scores||{})[l.id+'_'+c.id]||0;
        var lCol=v>=4?'#1B6B5A':v>=3?'#4E7FA6':v>0?'#9B2D3F':'var(--stone)';
        return'<div style="flex:0 0 108px;padding:6px 10px;border:1px solid rgba(var(--fg-rgb),.06);font-size:12px;display:flex;justify-content:space-between;gap:6px;overflow:hidden"><span title="'+esc(l.name||'?')+'" style="color:var(--stone);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((l.name||'?').split(' ')[0])+'</span><strong style="color:'+lCol+'">'+(v||'\u2014')+'</strong></div>';
      }).join('')+'</div>':'')
    ,'border-left:3px solid #2D5A8E');
  });
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 37 — Replace the function that draws the Fluency Assessment page: the team project, then each leader's three tasks as record tables, with no Summary / Full choice.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutFluency`.

**Code:**

```js

/* ── Fluency Assessment ── */
function renderOutFluency(){
  var fl=data.fluencySprint||{};var leaders=data.leaders||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Fluency Assessment</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 synthesized from the AI Fluency Sprint</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!fl.project&&!(fl.leaderTasks&&Object.keys(fl.leaderTasks).length)){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 3.1 first.</p>');return h}
  // Summary stats
  var taskCount=0;var leaderCount=0;
  if(fl.leaderTasks){for(var k in fl.leaderTasks){var lt=fl.leaderTasks[k];if(lt){if(lt.task1)taskCount++;if(lt.task2)taskCount++;if(lt.task3)taskCount++;if(lt.task1||lt.task2||lt.task3)leaderCount++}}}
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;margin-bottom:24px;background:rgba(139,94,60,.25)">';
  [{icon:'\u25B7',v:leaderCount,l:'Leaders Active'},{icon:'\u2261',v:taskCount,l:'Tasks Completed'},{icon:'\u25A3',v:fl.project?'Yes':'No',l:'Team Project'}].forEach(function(s){
    h+='<div style="padding:16px;background:var(--ink);text-align:center"><div style="font-size:18px;margin-bottom:4px">'+s.icon+'</div><div style="font-size:18px;font-weight:700;color:#8B5E3C">'+s.v+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">'+s.l+'</div></div>';
  });
  h+='</div>';
  if(fl.leaderTasks&&leaders.length){var withTasks=leaders.filter(function(l){var t=fl.leaderTasks[l.id];return t&&(t.task1||t.task2||t.task3)});
  h+=lyScreenRegister('leaderFluency',withTasks,'full',0); /* 14 Sep 2026 (Paul's ruling): the engine's record blocks; 16 Sep 2026 (Paul's ruling): the fluency layer alone — each leader's three tasks — one form, no depth control */
  }
  // Shared components in a visually distinct section
  var shared=[{k:'project',l:'Team AI Project',icon:'\u25C7',color:'#2D5A8E'},{k:'projectWorkflow',l:'The Workflow',icon:'\u2192',color:'#8B5E3C'},{k:'projectJudgment',l:'Where Human Judgment Was Essential',icon:'\u25CE',color:'#1B6B5A'}];
  var hasShared=shared.some(function(f){return fl[f.k]});
  if(hasShared){
    h+='<div style="font-family:var(--mono);font-size:11px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px">Shared Outputs</div>';
    shared.forEach(function(f){
      if(!fl[f.k])return;
      h+='<div style="border-top:3px solid '+f.color+';padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06);margin-bottom:12px">';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:16px">'+f.icon+'</span><span style="font-size:15px;font-weight:700;color:var(--paper)">'+f.l+'</span></div>';
      h+='<div style="font-size:13px;color:var(--paper);line-height:1.7">'+esc(fl[f.k])+'</div></div>';
    });
  }
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 38 — Replace the function that draws the Decision Analyses page.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutDecisions`.

**Code:**

```js

/* ── Decision Analyses ── */
function renderOutDecisions(){
  var ds=data.decisionSims||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Decision Analyses</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 synthesized from Decision Simulations</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var scenarios=DECISION_SCENARIOS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  var colors=['#1B6B5A','#2D5A8E','#8B5E3C','#9B2D3F'];
  var any=false;
  // Summary: count completed
  var completed=scenarios.filter(function(sc){return ds[sc.id+'_response']||ds[sc.id+'_premortem']}).length;
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  h+='<div style="flex:1;padding:16px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06);text-align:center"><div style="font-size:24px;font-weight:700;color:var(--gold)">'+completed+'/4</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em">Scenarios Completed</div></div>';
  h+='</div>';
  // Scenario cards in 2x2 grid
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  scenarios.forEach(function(sc,idx){
    var resp=ds[sc.id+'_response']||'';var pre=ds[sc.id+'_premortem']||'';
    if(!resp&&!pre)return;any=true;
    var col=colors[idx];
    h+='<div style="border-top:3px solid '+col+';background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
    // Header
    h+='<div style="padding:16px 20px;border-bottom:1px solid rgba(var(--fg-rgb),.04)">';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:18px">'+sc.icon+'</span><span style="font-size:16px;font-weight:700;color:var(--paper)">'+esc(sc.name)+'</span></div>';
    h+='<div style="font-size:12px;color:var(--stone)">'+esc(sc.desc)+'</div></div>';
    // Response
    if(resp){
      h+='<div style="padding:14px 20px;border-bottom:1px solid rgba(var(--fg-rgb),.04)">';
      h+='<div style="font-family:var(--mono);font-size:9px;color:'+col+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Our Response</div>';
      h+='<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(resp)+'</div></div>';
    }
    // Pre-mortem
    if(pre){
      h+='<div style="padding:14px 20px;background:rgba(155,45,63,.03)">';
      h+='<div style="font-family:var(--mono);font-size:9px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Ethical Pre-Mortem</div>';
      h+='<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(pre)+'</div></div>';
    }
    h+='</div>';
  });
  h+='</div>';
  if(!any)h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 3.2 first.</p>');
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 39 — Replace the function that draws the Middle Management Principles output page in four sections: the three categories, the AI-augmented workflows, the decisions that stay human, and the log and evaluation.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutMMPrinciples`.

**Code:**

```js

/* ── MM Principles Output ── */
function renderOutMMPrinciples(){ /* 16 Sep 2026 (Paul's ruling): laid out to his page plan — the four sections the document prints, in the page's vocabulary */
  var mm=data.mmActivation||{};var st=data.structure||{};var wf=mm.workflows||[],ho=mm.humanOnly||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Middle Management Principles</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 synthesized from Structure Lab + MM Activation</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  var anyCat=MM_CATEGORIES.some(function(c){return st[c.k]});
  if(!anyCat&&!wf.length&&!ho.length&&!mm.logTemplate&&!mm.logCadence&&!mm.evalCriteria&&!mm.evalMetrics){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Steps 2.1 and 3.3 first.</p>');return h}
  var cnt=function(k){return ' <span style="font-family:var(--mono);font-size:11px;color:var(--stone);font-weight:400">\u00b7 '+k+'</span>'};
  // 1. The Three Categories — one band; an empty column says so, because the band needs its shape
  if(anyCat)h+=card('<h3 class="h-sub-lg">The Three Categories</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">'+MM_CATEGORIES.map(function(c){return '<div style="border-top:3px solid '+c.col+';padding-top:10px"><div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:'+c.col+';margin-bottom:6px">'+esc(c.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+(st[c.k]?esc(st[c.k]):'<em style="color:var(--stone)">Not recorded</em>')+'</div></div>'}).join('')+'</div>','border:2px solid #8B5E3C');
  // 2. AI-Augmented Workflows — each a pair: AI does / The manager does (the step's expanded boxes, side by side)
  var roleBox=function(label,text,col,rgb){return '<div style="padding:10px 14px;background:rgba('+rgb+',.06);border-left:3px solid '+col+'"><div style="font-family:var(--mono);font-size:9px;color:'+col+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">'+esc(label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+(text?esc(text):'<em style="color:var(--stone)">Not recorded</em>')+'</div></div>'};
  if(wf.length)h+=card('<h3 class="h-sub-lg">AI-Augmented Workflows'+cnt(wf.length)+'</h3>'+wf.map(function(w){return '<div style="padding:12px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div style="font-size:14px;font-weight:600;color:var(--paper);margin-bottom:8px">'+esc(w.name||'Unnamed workflow')+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+roleBox('AI does',w.aiRole,'#4E7FA6','78,127,166')+roleBox('The manager does',w.humanRole,'#1B6B5A','27,107,90')+'</div></div>'}).join(''),'border-left:3px solid #4E7FA6');
  // 3. Decisions That Stay Human
  if(ho.length)h+=card('<h3 class="h-sub-lg">Decisions That Stay Human'+cnt(ho.length)+'</h3>'+ho.map(function(d){return '<div style="padding:10px 0 10px 12px;margin-bottom:6px;border-left:3px solid #1B6B5A"><div style="font-size:14px;font-weight:600;color:var(--paper)">'+esc(d.decision||'Unnamed decision')+'</div>'+(d.reason?'<div style="font-size:12.5px;color:var(--text-body);margin-top:4px;line-height:1.5">'+esc(d.reason)+'</div>':'')+'</div>'}).join(''),'border-left:3px solid #1B6B5A');
  // 4. The log and the evaluation — two panels side by side
  var panel=function(title,rows){rows=rows.filter(function(r){return r[1]});if(!rows.length)return '';return card('<h3 class="h-sub-lg" style="font-size:14px">'+esc(title)+'</h3>'+rows.map(function(r){return '<div style="margin-bottom:10px"><div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(r[0])+'</div><div style="font-size:'+(r[2]?'12px;font-family:var(--mono)':'13px')+';color:var(--paper);line-height:1.6">'+esc(r[1])+'</div></div>'}).join(''),'border-left:3px solid #8B5E3C;margin:0')};
  var p1=panel('The AI Use Log',[['Template',mm.logTemplate,true],['Review cadence',mm.logCadence]]),p2=panel('Evaluating Managers',[['Criteria',mm.evalCriteria],['Success metrics',mm.evalMetrics]]);
  if(p1||p2)h+='<div style="display:grid;grid-template-columns:'+(p1&&p2?'1fr 1fr':'1fr')+';gap:12px;margin-bottom:16px">'+p1+p2+'</div>';
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 40 — Replace the function that draws the Values Architecture output page in five sections, with the Summary / Full control and, at Full, the appendix of each leader's reflections.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutValues`.

**Code:**

```js

/* ── Operating Rhythm Output ── */
/* ── Values Architecture Output ── */
function renderOutValues(){ /* 16 Sep 2026 (Paul's ruling): laid out to his page plan — the five sections the document prints, and at Full depth the appendix of reflections */
  var ov=data.orgValues||[];var vd=data.valuesDiscussion||{};var depth=(UI.printDepth||'summary');
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Values Architecture</h2><p style="color:var(--stone);font-size:13px">Phase 3: Develop \u2014 shared organizational principles from the collective Values Architecture exercise</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!ov.length&&!vd.collectiveCommitments){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 3.4 first.</p>');return h}
  var fig=valuesFigures(),ord=valuesOrdered(),refl=valuesReflectors(),roles=valuesRoleList();
  var lab=function(t){return '<div style="font-size:11px;color:var(--stone);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+esc(t)+'</div>'};
  var cnt=function(k){return ' <span style="font-family:var(--mono);font-size:11px;color:var(--stone);font-weight:400">\u00b7 '+k+'</span>'};
  h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>';
  // 1. Our Philosophical Commitments — the statement leads
  if(vd.collectiveCommitments)h+=card('<h3 class="h-sub-lg">Our Philosophical Commitments</h3><div style="font-family:var(--serif,Georgia,serif);font-size:17px;line-height:1.55;color:var(--paper);white-space:pre-line">'+esc(vd.collectiveCommitments)+'</div>','border:2px solid #6B4C8A');
  // 2. Shared Principles — by domain, numbered continuously
  if(ov.length){var pi='<h3 class="h-sub-lg">Shared Principles'+cnt(ov.length)+'</h3>';VALUES_DOMAINS.forEach(function(d){var list=ord.filter(function(o){return o.d===d.id});if(!list.length)return;var col=DOMAIN_COL[d.id]||'#888';pi+='<div style="margin:12px 0 4px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:'+col+'">'+esc(d.l)+'</span><span style="font-size:11.5px;color:var(--stone);margin-left:10px">'+esc(VALUES_DOMAIN_GLOSS[d.id]||'')+'</span></div>'+list.map(function(o){return '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><span style="font-family:var(--mono);font-size:12px;color:'+col+';flex-shrink:0;width:22px">'+o.n+'</span><span style="font-size:14px;color:var(--paper);line-height:1.5">'+esc(o.v.principle)+'</span></div>'}).join('')});h+=card(pi,'border-left:3px solid #6B4C8A')}
  // 3. The Roles That Carry Each Principle — three figures, then one row per principle
  if(ov.length){var figBox=function(v,l,col){return '<div style="text-align:center;padding:12px 8px;border:1px solid rgba(var(--fg-rgb),.08);border-top:3px solid '+col+'"><div style="font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:300;color:'+col+'">'+esc(String(v))+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">'+esc(l)+'</div></div>'};
    var rows=ord.map(function(o){var rs=roles.filter(function(r){return (r.taggedValues||[]).indexOf(o.v.id)>=0});return '<div style="display:grid;grid-template-columns:2fr 3fr;gap:12px;padding:10px 0;border-bottom:1px solid rgba(var(--fg-rgb),.06)"><div style="font-size:13.5px;color:var(--paper);line-height:1.5"><span style="font-family:var(--mono);font-size:11px;color:var(--stone);margin-right:6px">'+o.n+'</span>'+esc(o.v.principle)+'</div><div style="font-size:13px;line-height:1.6;color:var(--paper)">'+(rs.length?rs.map(function(r){var who=valuesRoleWho(r);return esc(r.id==='board'?'Board':(r.name||'Unnamed role'))+(who?' <span style="color:var(--stone)">\u00b7 '+esc(who)+'</span>':'')}).join('<br>'):'<em style="color:#9B2D3F">Not yet tagged to any role</em>')+'</div></div>'}).join('');
    h+=card('<h3 class="h-sub-lg">The Roles That Carry Each Principle</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0 16px">'+figBox(fig.principles,'Principles','#6B4C8A')+figBox(fig.carrying+' / '+fig.roles,'Roles carrying values','#2D5A8E')+figBox(fig.unplaced,'Not yet placed',fig.unplaced?'#9B2D3F':'#1B6B5A')+'</div>'+rows,'border-left:3px solid #2D5A8E')}
  // 4. Keeping the Principles Alive — the embedding, then the AI Purpose Filter with the purpose it tests against (the filter lives on 3.4; ruled 16 July)
  var flt=(data.fluencySprint||{}).filter,mission=((data.assessments||{}).purpose||{}).mission;
  if(vd.embedding||flt||mission){var al='<h3 class="h-sub-lg">Keeping the Principles Alive</h3>';if(vd.embedding)al+='<div style="margin-bottom:14px">'+lab('In daily practice')+'<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(vd.embedding)+'</div></div>';if(flt||mission){al+='<div style="font-family:var(--mono);font-size:10px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin:4px 0 8px">\u25A4 AI Purpose Filter</div>';if(mission)al+='<div style="margin-bottom:10px">'+lab('Our purpose')+'<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(mission)+'</div></div>';if(flt)al+='<div>'+lab('Before adopting an AI tool, we ask')+'<div style="font-size:14px;color:var(--paper);line-height:1.7;white-space:pre-wrap">'+esc(flt)+'</div></div>'}h+=card(al,'border-left:3px solid #8B5E3C')}
  // 5. Where the Team Diverged
  if(vd.divergences)h+=card('<h3 class="h-sub-lg">Where the Team Diverged</h3><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(vd.divergences)+'</div>','border-left:3px solid #9B2D3F');
  // Appendix at Full depth — each leader's Step 2.4 reflections
  if(depth==='full'){h+='<div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--stone);margin:24px 0 6px">Appendix</div><h3 class="h-sub-lg">The Reflections Behind the Principles</h3>';if(refl.length)refl.forEach(function(l){var m=(data.mindsetDepth||{})[l.id]||{};h+=card('<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px"><span style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(l.name)+'</span><span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+esc(leaderRoleName(l))+'</span></div>'+MINDSET_REFLECTION_LABELS.map(function(q){return m[q[0]]?'<div style="margin-bottom:10px">'+lab(q[1])+'<div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(m[q[0]])+'</div></div>':''}).join(''),'border-left:3px solid #6B4C8A')});else h+=card('<p style="color:var(--stone);font-style:italic">No individual reflections recorded in Step 2.4.</p>')}
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 41 — Replace the function that draws the Operating Rhythm page.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutRhythm`.

**Code:**

```js

/* ── Operating Rhythm Output ── */
function renderOutRhythm(){
  var or=data.opRhythm||{};var rh=data.rhythm||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Operating Rhythm</h2><p style="color:var(--stone);font-size:13px">Phase 4: Embed \u2014 the permanent operating cadence for AI-ready leadership</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!or.agenda&&!or.peerStructure){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 4.1 first.</p>');return h}
  // Cadence summary
  var cadLabels={weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'};
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1px;margin-bottom:24px;background:rgba(155,45,63,.25)">';
  [{icon:'\u25A4',l:'Cadence',v:cadLabels[rh.cadence]||'Not set'},{icon:'\u25C7',l:'Simulations',v:or.simFreq||'Not set'},{icon:'\u2261',l:'Peer Learning',v:or.peerStructure?'Active':'Not set'},{icon:'\u25A3',l:'Board Ed',v:or.boardEd?'Planned':'Not set'}].forEach(function(s){
    h+='<div style="padding:16px;background:var(--ink);text-align:center"><div style="font-size:18px;margin-bottom:4px">'+s.icon+'</div><div style="font-size:16px;font-weight:700;color:#9B2D3F">'+esc(s.v)+'</div><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">'+s.l+'</div></div>';
  });
  h+='</div>';
  // Grouped sections
  var groups=RHYTHM_GROUPS; /* 14 Sep 2026: one definition, read by the page and its printed document */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  groups.forEach(function(g){
    var hasContent=g.items.some(function(i){return or[i.k]});if(!hasContent)return;
    h+='<div style="border-top:3px solid '+g.color+';padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
    h+='<div style="font-size:15px;font-weight:700;color:var(--paper);margin-bottom:12px">'+g.title+'</div>';
    g.items.forEach(function(i){
      if(!or[i.k])return;
      h+='<div style="margin-bottom:10px"><div style="font-family:var(--mono);font-size:9px;color:'+g.color+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">'+esc(i.l)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(or[i.k])+'</div></div>';
    });
    h+='</div>';
  });
  h+='</div>';
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 42 — Replace the function that draws the Evaluation Plan output page, so that its heading block carries the Save as PDF button.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutEvalPlan`.

**Code:**

```js

/* ── Evaluation Plan Output ── */
function renderOutEvalPlan(){
  var ev=data.evalSuccession||{};
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Evaluation Plan</h2><p style="color:var(--stone);font-size:13px">Phase 4: Embed \u2014 rewired evaluation and succession for the AI era</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!ev.indicators&&!ev.bench){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 4.2 first.</p>');return h}
  // Two-column layout: Evaluation | Succession
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">';
  // Evaluation column
  h+='<div style="border-top:3px solid #9B2D3F;padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
  h+='<div style="font-size:16px;font-weight:700;color:var(--paper);margin-bottom:16px">Evaluation Criteria</div>';
  if(ev.indicators){h+='<div style="margin-bottom:14px"><div style="font-family:var(--mono);font-size:9px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">AI-Readiness Indicators</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.indicators)+'</div></div>'}
  if(ev.proportion){h+='<div><div style="font-family:var(--mono);font-size:9px;color:#9B2D3F;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Evaluation Weighting</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.proportion)+'</div></div>'}
  h+='</div>';
  // Succession column
  h+='<div style="border-top:3px solid #6B4C8A;padding:20px;background:rgba(var(--fg-rgb),.02);border:1px solid rgba(var(--fg-rgb),.06)">';
  h+='<div style="font-size:16px;font-weight:700;color:var(--paper);margin-bottom:16px">Succession Planning</div>';
  if(ev.bench){h+='<div style="margin-bottom:14px"><div style="font-family:var(--mono);font-size:9px;color:#6B4C8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Bench Assessment</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.bench)+'</div></div>'}
  if(ev.benchChanges){h+='<div><div style="font-family:var(--mono);font-size:9px;color:#6B4C8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Changes Needed</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(ev.benchChanges)+'</div></div>'}
  h+='</div></div>';
  // Board fluency (full width)
  if(ev.boardFluency){
    h+=card('<div style="display:flex;align-items:flex-start;gap:12px"><div style="font-size:24px;flex-shrink:0">\u25A3</div><div><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Board Fluency Requirements</div><div style="font-size:14px;color:var(--paper);line-height:1.7">'+esc(ev.boardFluency)+'</div></div></div>','border:2px solid var(--gold)');
  }
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 43 — Replace the function that draws the Leadership Review Report page. The leaders show as record tables, grouped by judgment, with a Summary / Full choice above them.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOutReview`.

**Code:**

```js

/* ── Review Report Output ── */
function renderOutReview(){
  var rv=data.leadershipReview||{};var leaders=data.leaders||[];
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h2 style="font-size:22px;font-weight:700;margin:0 0 4px">Leadership Review Report</h2><p style="color:var(--stone);font-size:13px">Phase 4: Embed \u2014 first review of leadership progress and readiness</p></div>'+btn('\u25BE Save as PDF','printCurrentOutput()','bg2','font-size:12px')+'</div>';
  if(!rv.leaders&&!rv.structWorking){h+=card('<p style="color:var(--stone);text-align:center;padding:32px">Complete Step 4.3 first.</p>');return h}
  // Summary stats
  var counts={developed:0,progressing:0,support:0,hard:0};
  if(rv.leaders&&leaders.length){leaders.forEach(function(l){var a=(rv.leaders[l.id]||{}).assessment||'';if(counts[a]!==undefined)counts[a]++})}
  h+='<div style="display:flex;gap:12px;margin-bottom:24px">';
  [{l:'Developed',k:'developed',c:'#1B6B5A'},{l:'Progressing',k:'progressing',c:'#2D5A8E'},{l:'Needs Support',k:'support',c:'#4E7FA6'},{l:'Hard Conversation',k:'hard',c:'#9B2D3F'}].forEach(function(s){
    h+='<div style="flex:1;text-align:center;padding:16px;background:rgba(var(--fg-rgb),.03);border:1px solid rgba(var(--fg-rgb),.06);border-top:3px solid '+s.c+'"><div style="font-family:var(--serif);font-size:32px;font-weight:300;color:'+s.c+'">'+counts[s.k]+'</div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--stone);text-transform:uppercase">'+s.l+'</div></div>';
  });
  h+='</div>';
  if(rv.leaders&&leaders.length){var assessed=leaders.filter(function(l){var r=rv.leaders[l.id];return r&&(r.assessment||r.notes)});
  h+='<div style="display:flex;justify-content:flex-end;margin:0 0 8px">'+lyDepthCtl()+'</div>';
  var groups=Object.keys(REVIEW_LABELS).map(function(k){return {name:REVIEW_LABELS[k],list:assessed.filter(function(l){return (rv.leaders[l.id]||{}).assessment===k})}});var rest=assessed.filter(function(l){return !REVIEW_LABELS[(rv.leaders[l.id]||{}).assessment]});if(rest.length)groups.push({name:'Not yet assessed',list:rest});
  h+=lyScreenRegister('leader',assessed,(UI.printDepth||'summary'),LEADER_LAYER_INDEX.review,groups); /* 14 Sep 2026 (Paul's ruling): the engine's record blocks at the chosen depth, grouped by assessment */
  }
  // Structural review
  if(rv.structWorking||rv.structRevision){
    h+=card('<h3 class="h-sub-lg">Structural Review</h3>'
      +(rv.structWorking?'<div style="margin-bottom:12px"><div style="font-size:11px;color:#1B6B5A;font-weight:600;text-transform:uppercase;margin-bottom:4px">Working Well</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(rv.structWorking)+'</div></div>':'')
      +(rv.structRevision?'<div><div style="font-size:11px;color:#9B2D3F;font-weight:600;text-transform:uppercase;margin-bottom:4px">Needs Revision</div><div style="font-size:13px;color:var(--paper);line-height:1.6">'+esc(rv.structRevision)+'</div></div>':'')
    ,'border:2px solid #9B2D3F');
  }
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 44 — Replace the function that loads the example data, so that its records take the shapes the steps write and every part the documents print is present.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `seedData`.

**Code:**

```js
function seedData(){
  if(!confirm('Load sample data? This overwrites any existing entries.')) return;

  // --- Team roster: a single facilitator ("a", admin + the signed-in user) plus one
  //     login per leader. The leader user-ids below (u6-u15) match the userId set on
  //     each seeded leader and the keys in data.practiceLog, so the individual-track
  //     views (study completion, practice health) resolve to real, named people rather
  //     than "(no login)". All passcodes are 1234. This roster is authoritative: loading
  //     the sample data replaces any team members currently in Profile & Team.
  data.roster=[
    {id:'u_fac',name:'a',username:'a',role:'Facilitator',initials:'A',color:'#4E7FA6',scope:'All',passcode:'1234',admin:true},
    {id:'u6', name:'Harriet Rivers',     username:'harriet', role:'Participant',initials:'HR', color:'#1B6B5A',scope:'Executive',passcode:'1234'},
    {id:'u7', name:'Vincent Lau',    username:'vincent',role:'Participant',initials:'VL', color:'#2D5A8E',scope:'Operations',passcode:'1234'},
    {id:'u8', name:'Shalini Mehta',    username:'shalini', role:'Participant',initials:'SM', color:'#8B5E3C',scope:'AI & Innovation',passcode:'1234'},
    {id:'u9', name:'Ray Caruso',username:'ray',role:'Participant',initials:'RC',color:'#9B2D3F',scope:'Finance',passcode:'1234'},
    {id:'u10',name:'Imogen Whitfield',      username:'imogen',  role:'Participant',initials:'IW', color:'#6B4C8A',scope:'Marketing',passcode:'1234'},
    {id:'u11',name:'Sinead Corrigan',  username:'sinead', role:'Participant',initials:'SC', color:'#4E7FA6',scope:'Innovation & Transformation',passcode:'1234'},
    {id:'u12',name:'Duncan Fairley',  username:'duncan',role:'Participant',initials:'DF', color:'#1B6B5A',scope:'People',passcode:'1234'},
    {id:'u13',name:'Freya Lindqvist',     username:'freya', role:'Participant',initials:'FL', color:'#2D5A8E',scope:'Engineering',passcode:'1234'},
    {id:'u14',name:'Arvind Nair',username:'arvind',role:'Participant',initials:'AN',color:'#8B5E3C',scope:'Sales',passcode:'1234'},
    {id:'u15',name:'Tamsin Doyle', username:'tamsin',role:'Participant',initials:'TD', color:'#9B2D3F',scope:'Data & Analytics',passcode:'1234'}
  ];
  data.members=[];  // legacy slot; the roster above is canonical

  /* Demo organization: Aurora Windows -- a ~900-person manufacturer of windows, glass,
     and glazing systems, early in its AI journey. Leadership scores and self-assessments
     are deliberately modest at baseline; the Phase-4 review records honest progress, so
     every report, chart, and the Lead dashboard render fully populated and show movement
     from a standing start to a working leadership system. The org chart is built
     from these leaders and their reporting lines, the same path real data uses. */

  // --- Company profile ---
  data.enterprise={
    name:'Aurora Windows',
    industry:'Manufacturing -- windows, glass, and glazing systems',
    size:'~900 employees -- $240M revenue',
    region:'United States (Midwest), with a fabrication plant in Ontario',
    website:'aurorawindows.example',
    maturity:'Early -- strong operators, first coordinated AI initiatives now underway',
    sponsor:'Chief Executive Officer',
    objective:'Build the leadership mindset, structure, and discipline to lead AI well -- starting with quoting, demand forecasting, and customer support -- without outrunning our people or our judgment.'
  };

  // --- Leaders (Step 1.2) with stable ids + reporting lines for the Phase 1 chart ---
  data.leaders=[
    {id:'seed_ceo',name:'Harriet Rivers',role:'Chief Executive Officer',fluency:'4',engagement:'active',scope:'org',changeExp:'Led the post-merger integration and the move to a single ERP.',bandwidth:'stretched',userId:'u6',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_coo',name:'Vincent Lau',role:'Chief Operating Officer',fluency:'3',engagement:'active',scope:'org',changeExp:'Ran the plant-floor automation program; comfortable with operational change, newer to AI.',bandwidth:'manageable',userId:'u7',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_caio',name:'Dr. Shalini Mehta',role:'Chief AI & Innovation Officer',fluency:'5',engagement:'active',scope:'org',changeExp:'Built an analytics function from scratch at a prior firm; recruited specifically for this transition.',bandwidth:'available',userId:'u8',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cfo',name:'Ray Caruso',role:'Chief Financial Officer',fluency:'2',engagement:'developing',scope:'dept',changeExp:'Led the finance-systems consolidation; skeptical of AI hype, persuadable by evidence.',bandwidth:'stretched',userId:'u9',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cmo',name:'Imogen Whitfield',role:'Chief Marketing Officer',fluency:'3',engagement:'developing',scope:'dept',changeExp:'Drove the rebrand and the shift to digital demand generation.',bandwidth:'manageable',userId:'u10',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cpo',name:'Duncan Fairley',role:'Chief People Officer',fluency:'2',engagement:'developing',scope:'org',changeExp:'Led the engagement-and-retention turnaround after the merger; now owns the workforce-impact plan for AI.',bandwidth:'manageable',userId:'u12',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_cito',name:'Sinead Corrigan',role:'Chief Innovation & Transformation Officer',fluency:'4',engagement:'active',scope:'org',changeExp:'Recruited to own the cultural and strategic side of the AI transition; previously led a digital-transformation program in building products.',bandwidth:'manageable',userId:'u11',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpeng',name:'Freya Lindqvist',role:'VP Engineering',fluency:'3',engagement:'developing',scope:'dept',changeExp:'Led the platform re-architecture; strong technically, early in AI-specific leadership.',bandwidth:'stretched',userId:'u13',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpsales',name:'Arvind Nair',role:'VP Sales',fluency:'2',engagement:'developing',scope:'dept',changeExp:'Built the national accounts team; cautious about AI in customer-facing work.',bandwidth:'stretched',userId:'u14',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpdata',name:'Tamsin Doyle',role:'VP Data & Analytics',fluency:'4',engagement:'active',scope:'dept',changeExp:'Stood up the data warehouse and BI practice; the most fluent of the senior layer.',bandwidth:'manageable',userId:'u15',userLinkBy:'u1',userLinkAt:1716000000000},
    {id:'seed_vpops',name:'Glen Hodges',role:'VP Operations',fluency:'2',engagement:'developing',scope:'dept',changeExp:'Runs the Ontario fabrication plant; pragmatic, not yet engaged with the module.',bandwidth:'stretched'},
    {id:'seed_vphr',name:'Lorna Whitaker',role:'VP Human Resources',fluency:'2',engagement:'developing',scope:'org',changeExp:'Led the people plan for the plant consolidation; owns workforce policy and sits on the AI Transformation Council.',bandwidth:'stretched'},
    {id:'seed_dirpx',name:'Beatriz Camargo',role:'Director, Product Experience',fluency:'3',engagement:'developing',scope:'team',changeExp:'Owns the customer experience for the quoting product; recently promoted.',bandwidth:'manageable'}
  ];
  data._leaderSeq=12;

  // --- Step 1.1: Assessment Battery (sections A-E) ---
  data.assessments={
    purpose:{
      mission:'Be the supplier architects and builders trust for windows that perform -- quoted fast, delivered on time, and right the first time.',
      priorities:'1) Cut quote turnaround from days to hours. 2) Lift on-time delivery through better demand forecasting. 3) Reduce rework and warranty claims with line-quality analytics.',
      aiStrategy:'AI serves the strategy, not the reverse. First targets are quote drafting, demand forecasting, and support triage -- each one owned by a named leader and gated by the AI Transformation Council before it scales.'
    },
    fluency:{
      engagement:'Mixed. The CAIO and CEO use AI tools daily and fluently; the COO and CMO experiment; the CFO and People lead are cautious and mostly delegate. No shared baseline or common language yet.',
      tools:'Microsoft Copilot (patchy adoption), ChatGPT used informally by individuals, a forecasting pilot in the BI team, and a support-triage trial in customer service.'
    },
    change:{
      recentChange:'A bruising ERP consolidation two years ago that ran long and over budget. It succeeded, but it spent the organization\u2019s appetite for change. People are competent and loyal but change-weary, which shapes how fast we can move on AI.'
    },
    structure:{
      ownership:'Ambiguous. Technology sits with a small IT team under the CFO; transformation ownership is unclear. The CAIO role was created to close that gap but is only months old.',
      boardOversight:'Light. The board hears AI as an agenda item but has no committee, no defined risk appetite, and limited fluency to challenge management.',
      crossFunc:'Weak. Initiatives still run inside functional silos; there is no standing body where operations, finance, marketing, and the CAIO decide together.',
      decisionStructure:'Decision rights for AI are undefined. It is unclear who can approve a deployment, who owns a model\u2019s outputs, or who is accountable when something goes wrong.',
      gaps:'The central gap is between technology management and transformation leadership -- and between senior intent and middle-management reality.'
    },
    ethical:{
      workforce:'Roughly a third of work in two departments could be materially affected within eighteen months. The organization has made no commitments yet about retraining, redeployment, or honesty with affected staff.',
      lines:'No agreed boundaries on what AI may decide unaided. Customer commitments, pricing approvals, and people decisions are felt to be human, but nothing is written down.'
    }
  };

  // --- Step 1.1 numeric self-ratings (1-5) read by the Readiness Report / radar.
  //     Keys live INSIDE each assessment domain; deliberately modest at baseline. ---
  data.assessments.purpose.clarity=3;   data.assessments.purpose.aiAlignment=2; data.assessments.purpose.coherence=3;
  data.assessments.fluency.foundational=2; data.assessments.fluency.failureModes=2; data.assessments.fluency.costRisk=2; data.assessments.fluency.strategic=3; data.assessments.fluency.handsOn=2;
  data.assessments.change.trackRecord=3; data.assessments.change.fatigue=2; data.assessments.change.middleMgmt=2; data.assessments.change.psySafety=3; data.assessments.change.learningCulture=3;
  data.assessments.structure.crossCollab=2; data.assessments.structure.mmRole=2;
  data.assessments.ethical.identity=2; data.assessments.ethical.evidence=2; data.assessments.ethical.commitments=1; data.assessments.ethical.assumptions=2;

  // --- Step 1.2: Landscape notes ---
  data.landscapeNotes={
    ownershipGap:'Technology is managed under the CFO; transformation leadership is not yet owned anywhere with authority. The new CAIO is the intended bridge, but her mandate and decision rights have not been ratified, so accountability still falls between roles.',
    mmAssessment:'Middle managers are capable and trusted but under-equipped for AI. They have had no training, no decision framework, and no time carved out. They are the connective tissue between strategy and execution, and right now they are a single point of failure for adoption.'
  };

  // --- Step 1.3: Risk Mapping (seven scenarios; flat score keys + risks array) ---
  // Scores are 1-5; likelihood * impact drives the heat map, timeHorizon orders urgency.
  var RISK_SEED={
    zillow:{likelihood:3,impact:5,timeHorizon:4,notes:'We are tempted to scale the forecasting pilot fast. Without a governing body and clear ownership, an over-eager rollout could commit us to numbers the business then has to honor.'},
    calstate:{likelihood:4,impact:4,timeHorizon:5,notes:'Given change fatigue from the ERP program, announcing AI without bringing managers and staff along first is our single most likely failure mode.'},
    aircanada:{likelihood:3,impact:4,timeHorizon:4,notes:'The support-triage trial could promise customers things we cannot honor. We have no policy on what the AI may commit to on our behalf.'},
    cigna:{likelihood:2,impact:5,timeHorizon:3,notes:'Pressure to automate warranty and claims triage for speed. The reputational and legal cost of removing human review from edge cases would be severe.'},
    stigma:{likelihood:3,impact:3,timeHorizon:3,notes:'Quiet signals that leaders who lean on AI are seen as less capable. If that hardens, the people we most need to adopt will hide their use.'},
    disruption:{likelihood:4,impact:4,timeHorizon:4,notes:'A larger competitor is already cutting quote times with AI. Moving too slowly is as real a risk as moving carelessly.'},
    fatigue:{likelihood:4,impact:3,timeHorizon:3,notes:'Layering AI onto an organization still recovering from the ERP change could burn people out and stall everything if we do not build stable foundations first.'}
  };
  var _sids=['zillow','calstate','aircanada','cigna','stigma','disruption','fatigue'];
  if(!data.riskNotes)data.riskNotes={};
  var _risks=[];
  _sids.forEach(function(sid){
    var r=RISK_SEED[sid];
    data['risk_'+sid+'_likelihood']=r.likelihood;
    data['risk_'+sid+'_impact']=r.impact;
    data['risk_'+sid+'_timeHorizon']=r.timeHorizon;
    data.riskNotes[sid]=r.notes;
    _risks.push({id:sid,likelihood:r.likelihood,impact:r.impact,timeHorizon:r.timeHorizon,notes:r.notes});
  });
  data.risks=_risks;

  // --- Individual-track completion per leader (steps 1.4/2.4/3.5/4.4), by tier ---
  // DONE: all four; PROGRESS: 1.4+2.4; START: partial; unlinked: none.
  data.indivDone={
    seed_ceo:{'1.4':true,'1.4:intro':true,'1.4:workforce':true,'1.4:atrophy':true,'2.4':true,'3.5':true,'4.4':true,'4.4:reflections':true,'4.4:stop':true,'4.4:slowlog':true},   // DONE
    seed_coo:{'1.4':true,'1.4:intro':true,'1.4:workforce':true,'1.4:atrophy':true,'2.4':true,'3.5':true,'4.4':true,'4.4:reflections':true,'4.4:stop':true,'4.4:slowlog':true},   // DONE
    seed_caio:{'1.4':true,'1.4:intro':true,'1.4:workforce':true,'1.4:atrophy':true,'2.4':true,'3.5':true,'4.4':true,'4.4:reflections':true,'4.4:stop':true,'4.4:slowlog':true},  // DONE
    seed_cfo:{'1.4':true,'2.4':true},                          // PROGRESS
    seed_cmo:{'1.4':true,'2.4':true},                          // PROGRESS
    seed_cpo:{'1.4':true,'2.4':true},                          // PROGRESS
    seed_cito:{'1.4':true,'2.4':true},                         // PROGRESS
    seed_vpeng:{'1.4':true},                                   // START (one step)
    seed_vpsales:{'1.4':true},                                 // START (one step)
    seed_vpdata:{}                                             // START (none yet)
    // seed_vpops, seed_vphr, seed_dirpx: unlinked, no individual-track data
  };

  // --- Step 1.4: Mindset Foundations -- study reflections + dependency scan ---
  data.mindsetStudy={'seed_ceo':{
    theme1:'The hardest shift is from episodic change to continuous change. The ERP program had an end date; AI does not. Leading it means building stable foundations rather than bracing for one more push.',
    theme2:'Judgment becomes more valuable, not less, as routine cognitive work is automated. The leader\u2019s job moves toward framing problems, weighing values, and deciding what not to delegate.',
    theme3:'Composure is a leadership capability we have under-invested in. Deciding well under uncertainty, and staying steady when the picture is incomplete, is now part of the core job.',
    dwAgents:'We will allow bounded agents (e.g. support triage) only where the role, limits, and escalation path are written down and a human owns the outcome.',
    dwManaging:'Managers are evaluated partly on how well they integrate AI without eroding their team\u2019s core skills or trust.',
    selfAudit:'Each leader keeps a short log of decisions where they leaned on AI and where they overrode it, reviewed in the monthly leadership session.'
  },
    seed_coo:{theme1:'Operational change has an end state; AI does not. I keep wanting a "go-live" date and there isn\u2019t one.',theme2:'Where I add most value is deciding which pilots are real and which are theatre.',theme3:'The plant teams trust evidence over slogans -- so do I.'},
    seed_caio:{theme1:'My instinct is to optimize the model; the harder discipline is deciding where a model should not be used at all.',theme2:'Governance gates are not bureaucracy -- they are how trust is earned across the business.',theme3:'I have to translate, not just build.'},
    seed_cfo:{theme1:'I came in skeptical. The shift for me is from "prove the ROI first" to "design a small, reversible bet and learn".',theme2:'Verification before scaling is the control I actually care about.',theme3:'Hype is noise; the cash-flow case is signal.'},
    seed_cmo:{theme1:'Customer tone is the thing I will not automate away. AI drafts; people commit.',theme2:'The risk is a confident wrong message at scale.',theme3:'Brand trust is slow to build, fast to lose.'},
    seed_cpo:{theme1:'My job is honesty with people whose roles change. The mindset shift is owning that rather than softening it.',theme2:'Workforce impact is a leadership question, not an HR process.',theme3:'People can handle hard truths; they cannot handle being managed around.'},
    seed_cito:{theme1:'I own the cultural side, which means I cannot hide behind the technology.',theme2:'The strategic story has to be legible to the plant floor, not just the board.',theme3:'Continuous change needs stable anchors.'},
    seed_vpeng:{theme1:'Strong on the build, early on the leadership of an AI-shaped team. That gap is mine to close.',theme2:'',theme3:''},
    seed_vpsales:{theme1:'Cautious about AI in front of customers; starting to see where it helps rather than replaces.',theme2:'',theme3:''}
};
  data.depScan=[
    {skill:'Demand forecasting & planning judgment',aiTool:'Forecasting model (BI pilot)',importance:'High',riskLevel:'Medium'},
    {skill:'Quote drafting & pricing logic',aiTool:'Quote-drafting assistant',importance:'High',riskLevel:'High'},
    {skill:'First-line customer support',aiTool:'Support-triage assistant',importance:'Medium',riskLevel:'Medium'},
    {skill:'Line-quality inspection analysis',aiTool:'Quality analytics',importance:'Medium',riskLevel:'Low'}
  ];

  // --- Phase 2, Step 2.1: Leadership Structure ---
  data.structure={
    ownerModel:'cito',
    ownerWho:'Sinead Corrigan, Chief Innovation & Transformation Officer, accountable to the CEO and reporting quarterly to the board. The CAIO (Dr. Shalini Mehta) leads the technical AI work; the CITO owns the cultural, strategic, and organizational side of the transition.',
    ownerChange:'Create a dedicated CITO role rather than leaving transformation inside the CFO\u2019s IT remit, and give it ratified decision rights for deployment approvals alongside the CAIO\u2019s technical ownership.',
    boardStructure:'Stand up a Board AI Committee meeting quarterly, with one outside advisor who has led an AI transition.',
    boardExpertiseGaps:'Strong on finance, manufacturing, and governance; still thin on data ethics and the workforce dimensions of automation \u2014 recruit or advise to close this.',
    boardDecisions:'The committee sets risk appetite, approves scaling beyond pilot, and reviews the workforce-impact plan; it does not approve individual deployments.',
    boardEducation:'A short quarterly briefing from the CAIO plus an annual external session to build directors\u2019 fluency.',
    seniorDecisionRights:'Pilots: owning executive decides. Scaling past pilot: CAIO with COO/CFO sign-off. Anything touching customer commitments or jobs: escalates to the council.',
    seniorAccountability:'Each AI initiative has one named accountable executive. The CAIO owns the portfolio; outputs are owned by the function that deploys them.',
    seniorAlignment:'Monthly leadership review keeps the team aligned; disagreements are surfaced there rather than worked around.',
    mmAutomate:'Routine reporting, first-draft quotes, ticket classification, and forecast generation.',
    mmAugment:'Exception handling, customer escalations, supplier negotiations, and final pricing -- AI drafts, the manager decides.',
    mmHuman:'Hiring and performance decisions, layoffs or redeployment, and any commitment a customer will rely on.',
    coordMechanism:'council',
    coordCadence:'Council meets fortnightly during the build; leadership review monthly; board committee quarterly.',
    coordConflict:'Conflicts that cannot be resolved in council go to the CEO with a written recommendation and a dissent noted.',
    coordInfo:'A shared one-page status per initiative -- owner, stage, risks, decisions needed -- visible to all council members.'
  };

  // --- Phase 2, Step 2.2: AI Collaboration Lab ---
  data.collabLab={
    touchCustomer:'Support triage and quote drafting are the main customer-facing AI touchpoints.',
    touchInternal:'Forecast generation, reporting, and meeting summaries.',
    touchDecision:'AI informs pricing and planning decisions but does not make them.',
    touchAgent:'A support-triage agent with a defined, bounded role and an explicit escalation path to a human.',
    personaCustomer:'In customer contact the AI is helpful, plain-spoken, and explicit that it is an assistant -- never implying it can authorize commitments.',
    personaInternal:'Internally the AI is treated as a fast, fallible first-drafter whose work is always checked.',
    personaBoundaries:'The assistant never quotes binding prices, never confirms delivery dates, and always hands edge cases to a person.',
    aiFreeZones:'People conversations, performance reviews, and final pricing approvals are deliberately AI-free.',
    proprietary:'Pricing logic, customer lists, and warranty data stay out of public AI tools; only sanctioned, contained tools touch them.',
    atrophyRisks:'Risk that estimators lose pricing intuition and that support staff lose first-line problem-solving if the AI does too much.',
    translators:'The CAIO and two BI analysts act as translators between the technical work and the operating teams.',
    transProcesses:'Translators sit in the council, run short clinics for managers, and own the plain-language documentation.',
    transRisks:'If the translators become a bottleneck, adoption stalls; we are cross-training to avoid a single point of dependence.',
    functionModels:[ /* 16 Sep 2026 (Paul's ruling): in the shape the step writes ({name, model}); the models are authored from the roles the earlier seed described — drafting with a human deciding is Augmenter, forecasting with a human approving is Advisor, the bounded triage agent of the Touchpoint Map is Autonomous Agent */
      {name:'Customer Support',model:'augmenter'},
      {name:'Sales / Estimating',model:'augmenter'},
      {name:'Operations / Planning',model:'advisor'},
      {name:'Support Triage',model:'autonomous'}
    ]
  };
  data.collabPrinciples={
    aiVoice:'The AI speaks as a clearly-labeled assistant: helpful and direct, never implying authority it does not have, always deferring binding decisions to a named human.',
    touchpoints:'Three governed touchpoints at launch -- support triage, quote drafting, and demand forecasting -- each with an owner and a human reviewer.'
  };

  // --- Phase 2, Step 2.3: Competency Framework (definitions + per-leader scores) ---
  var _compIds=['orchestration','philosophical','hybrid','change','composure','ecosystem','emotional'];
  data.competencyFramework={
    definitions:{
      orchestration:'For Aurora: deciding where AI belongs in quoting, planning, and support -- and where it does not -- and designing the human/AI workflow for each.',
      philosophical:'Surfacing the assumptions baked into our tools (what a "good" quote or a "qualified" lead is) and being able to defend or challenge them.',
      hybrid:'Leading teams where an assistant has a defined role alongside people, and managing the human dynamics that creates.',
      change:'Leading continuous change without exhausting an already change-weary workforce; building stable foundations.',
      composure:'Deciding well under uncertainty as the AI landscape shifts; portfolio thinking over rigid plans.',
      ecosystem:'Managing vendors, partners, and competitive dynamics in an AI-driven market.',
      emotional:'The human skills -- trust, empathy, conflict resolution, mentoring -- that matter more as machines take routine cognitive load.'
    },
    scores:{}
  };
  // Baseline competency scores per leader (1-5), keyed <leaderIndex>_<competencyId>.
  // Deliberately modest, with the CAIO strongest and the CFO/People lead lowest.
  var _compBaseline=[
    {orchestration:4,philosophical:4,hybrid:3,change:4,composure:4,ecosystem:3,emotional:5}, // Harriet (CEO) -- DONE
    {orchestration:4,philosophical:3,hybrid:4,change:4,composure:4,ecosystem:3,emotional:4}, // Vincent (COO) -- DONE
    {orchestration:5,philosophical:5,hybrid:4,change:4,composure:5,ecosystem:4,emotional:4}, // Shalini (CAIO) -- DONE
    {orchestration:2,philosophical:3,hybrid:2,change:3,composure:3,ecosystem:2,emotional:3}, // Ray (CFO) -- PROGRESS
    {orchestration:3,philosophical:2,hybrid:3,change:3,composure:2,ecosystem:3,emotional:4}, // Imogen (CMO) -- PROGRESS
    {orchestration:2,philosophical:3,hybrid:2,change:3,composure:3,ecosystem:2,emotional:4}, // Duncan (CPO) -- PROGRESS  [index 5]
    {orchestration:4,philosophical:3,hybrid:3,change:4,composure:3,ecosystem:3,emotional:4}, // Sinead (CITO) -- PROGRESS  [index 6]
    {orchestration:2,philosophical:1,hybrid:2,change:2,composure:2,ecosystem:1,emotional:2}, // Freya (VP Eng) -- START
    {orchestration:1,philosophical:1,hybrid:1,change:2,composure:2,ecosystem:1,emotional:3}, // Tomas (VP Sales) -- START
    {orchestration:3,philosophical:2,hybrid:2,change:2,composure:2,ecosystem:2,emotional:2}, // Tamsin (VP Data) -- START
    {orchestration:2,philosophical:1,hybrid:2,change:2,composure:3,ecosystem:1,emotional:3}, // Glen (VP Ops) -- UNLINKED, scored
    {orchestration:2,philosophical:2,hybrid:3,change:2,composure:2,ecosystem:2,emotional:3}  // Beatriz (Dir PX) -- UNLINKED, scored
  ];
  _compBaseline.forEach(function(row,i){
    var lid=(data.leaders[i]||{}).id; if(!lid)return;
    _compIds.forEach(function(cid){ data.competencyFramework.scores[lid+'_'+cid]=row[cid]; });
  });

  // --- Phase 2, Step 2.4: Mindset Depth ---
  data.mindsetDepth={'seed_ceo':{
    val1:'Human judgment leads; AI advises.',
    val2:'We are honest with our people about what is changing and why.',
    val3:'We build foundations before we scale.',
    val4:'No customer commitment is made by a machine.',
    val5:'We protect the skills we do not want to lose.',
    case1:'When the forecasting model and an experienced planner disagree, the planner\u2019s judgment wins until the model has earned trust on the record.',
    case2:'When the support assistant cannot resolve a frustrated customer, it hands off fast and warmly rather than looping.',
    case3:'When automation would cut a role, we plan redeployment and tell affected people early, not last.'
  },
    seed_coo:{val1:'Reliability',val2:'Honesty about limits',val3:'Stable footing for teams',val4:'',val5:'',case1:'A forecasting pilot that we paused when it could not explain a swing.',case2:'',case3:'',agents:'Assistants draft the daily plan; a person signs it off.',managing:'I watch for over-trust in a clean-looking number.',selfAudit:'I ask whose judgment the tool is quietly replacing.'},
    seed_caio:{val1:'Rigor',val2:'Transparency',val3:'Human accountability',val4:'Fairness',val5:'',case1:'Refused to ship a lead-scoring model until the proxy for "qualified" was defensible.',case2:'',case3:'',agents:'Defined where the assistant decides vs recommends.',managing:'Bias surfaced in training data is my standing concern.',selfAudit:'I document the assumption behind every "good" label.'},
    seed_cfo:{val1:'Prudence',val2:'Evidence',val3:'Reversibility',val4:'',val5:'',case1:'Structured the first AI spend as a staged, killable bet.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I check that the verification step is real, not ceremonial.'},
    seed_cmo:{val1:'Trust',val2:'Voice',val3:'Restraint',val4:'',val5:'',case1:'Held a campaign that an AI tool wanted to send before a human read it.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I ask whether a message would embarrass us if it were wrong.'},
    seed_cpo:{val1:'Honesty',val2:'Dignity',val3:'Fairness',val4:'',val5:'',case1:'Told a team early that their work would change, with a plan attached.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I check who carries the cost of a change and whether it is fair.'},
    seed_cito:{val1:'Coherence',val2:'Candor',val3:'Stability',val4:'',val5:'',case1:'Re-sequenced a rollout so the culture could keep up with the technology.',case2:'',case3:'',agents:'',managing:'',selfAudit:'I test whether the strategic story still makes sense on the floor.'}
};

  // --- Phase 3, Step 3.1: AI Fluency Sprint (shared + per-leader tasks) ---
  data.fluencySprint={
    project:'Stand up the governed quote-drafting assistant for one product line, end to end, with a human reviewer.',
    projectWorkflow:'Quote requests come in through the CRM intake, the drafting assistant writes against the price book, the anomaly checker flags outliers, and the estimator reviews, prices, and commits.',
    projectJudgment:'The judgment we are protecting is final pricing -- the assistant drafts, the estimator decides and commits.',
    filter:'Use AI for the first draft and the routine; reserve human attention for exceptions, relationships, and anything a customer will rely on.',
    leaderTasks:{}
  };
  // Per-leader fluency tasks (task1/task2/task3) for each seeded leader.
  // Per-leader fluency-sprint tasks, keyed by stable leader id (not array index).
  // DONE/PROGRESS leaders show real sprint activity; START leaders one task; unlinked none.
  var _fluencyTasks={
    seed_ceo:{task1:'Used Copilot daily for a week to draft board-pack narratives, then edited heavily.',task2:'Ran a side-by-side of an AI-drafted vs. self-drafted strategy memo.',task3:'Reflected on where the AI draft was confidently wrong.'},
    seed_coo:{task1:'Built a forecast for one product line with the BI tool and compared it to the planner\u2019s number.',task2:'Drafted a shift plan with AI assistance and stress-tested it on the floor.',task3:'Noted where the model missed real-world constraints.'},
    seed_caio:{task1:'Prototyped the quote-drafting assistant and documented its failure modes.',task2:'Wrote the plain-language guardrails for the support agent.',task3:'Coached two managers through their first model review.'},
    seed_cfo:{task1:'Used AI to summarize three financing options, then checked every figure by hand.',task2:'Tested an AI-assisted variance analysis against the manual one.',task3:''},
    seed_cmo:{task1:'Generated three campaign concepts with AI and rewrote them for brand voice.',task2:'Used AI to cluster customer feedback, then validated the themes.',task3:''},
    seed_cpo:{task1:'Drafted an internal FAQ about the AI changes with AI help, then made it human.',task2:'Used AI to model redeployment options for an affected team.',task3:''},
    seed_cito:{task1:'Built a one-page AI purpose filter with AI assistance, then pressure-tested it against three live tool decisions.',task2:'Used AI to map cross-functional dependencies for the council.',task3:''},
    seed_vpeng:{task1:'Tried an AI pair-programming tool on a real ticket and logged what it got wrong.',task2:'',task3:''},
    seed_vpdata:{task1:'Benchmarked an AI feature-engineering step against the manual pipeline.',task2:'',task3:''}
  };
  Object.keys(_fluencyTasks).forEach(function(lid){ if(_fluencyTasks[lid]) data.fluencySprint.leaderTasks[lid]=_fluencyTasks[lid]; });
  // Fluency assignment (per-leader assigned focus area), keyed by leader index.
  // Assign each leader's fluency work to a real program user (u1-u5), cycling across
  // the roster so the "Assign to" dropdown shows a genuine assignee for everyone.

  // --- Phase 3, Step 3.2: Decision Simulations (four scenarios; response + premortem) ---
  var _decisions={
    autonomous:{response:'We would not grant the assistant autonomy over binding actions. It may act inside a narrow, reversible lane (classifying tickets, drafting quotes) with a human owning every commitment.',premortem:'If we granted too much: a wrong auto-commitment to a customer, an unpriced edge case shipped, and a loss of trust that sets adoption back a year.'},
    workforce:{response:'Be honest early. Map the 50 affected roles, fund retraining, prioritize redeployment over exit, and tell people before rumor does. Treat it as a leadership obligation, not an HR clean-up.',premortem:'If handled badly: a fearful workforce that hides AI use, our best people leave first, and the change stalls amid mistrust.'},
    competitor:{response:'Respond with discipline, not panic. Accelerate the governed support and quoting pilots, publish a clear internal timeline, and resist a rushed, ungoverned rollout that trades long-term trust for short-term parity.',premortem:'If we panic: an ungoverned deployment, a public error, and a self-inflicted wound worse than the competitive gap we were chasing.'},
    ethical:{response:'The Values Architecture holds. If the profitable strategy crosses a principle (e.g. a commitment a machine makes, or a quietly unfair pricing pattern), we decline it and say why, in writing, to the board.',premortem:'If we cave under financial pressure once, the principles become decorative and every future boundary is negotiable.'}
  };
  data.decisionSims={};
  Object.keys(_decisions).forEach(function(id){
    data.decisionSims[id+'_response']=_decisions[id].response;
    data.decisionSims[id+'_premortem']=_decisions[id].premortem;
  });

  // --- Phase 3, Step 3.3: Middle Management Activation ---
  data.mmActivation={
    workflows:[
      {name:'Quote drafting',aiRole:'Drafts the quote from the spec and pricing rules',humanRole:'Reviews, sets final price, commits to the customer'},
      {name:'Support triage',aiRole:'Classifies and drafts a first reply',humanRole:'Resolves, decides, owns the relationship'},
      {name:'Demand forecast',aiRole:'Generates the baseline forecast',humanRole:'Adjusts for judgment and approves the plan'}
    ],
    humanOnly:[
      {decision:'Final pricing and any customer commitment',reason:'A binding promise must be made by an accountable person.'},
      {decision:'Hiring, performance, and redeployment decisions',reason:'These affect livelihoods and require human judgment and care.'},
      {decision:'Scaling an AI system beyond its pilot',reason:'Crosses a risk threshold that belongs to the council, not a tool.'}
    ],
    logTemplate:'Date | Decision | AI input used | Human override (Y/N) | Why',
    logCadence:'Reviewed in the monthly leadership session; patterns fed back to the council.',
    evalCriteria:'Managers are assessed on outcomes, on protecting core team skills, and on honest use of AI -- not on raw automation volume.',
    evalMetrics:'Quote turnaround, on-time delivery, first-contact resolution, rework rate, and team skill-retention checks.'
  };

  // --- Phase 3, Step 3.4: Values Architecture (org values + discussion) ---
  data.orgValues=[
    {id:'v1',principle:'Human judgment leads; AI advises.',domain:'ontological'},
    {id:'v2',principle:'We are honest with our people about what is changing.',domain:'ethical'},
    {id:'v3',principle:'No binding customer commitment is made by a machine.',domain:'ethical'},
    {id:'v4',principle:'We build stable foundations before we scale.',domain:'epistemological'},
    {id:'v5',principle:'We protect the skills we do not want to lose.',domain:'ontological'}
  ];
  data.valuesArch=data.orgValues.map(function(v){return v.id;});
  data.vaSec={principles_done:true,synthesis_done:true,tagging_done:true};
  data.valuesDiscussion={
    divergences:'The sharpest disagreement was on pace: the CMO and CAIO want to move faster, the CFO and People lead want firmer foundations first. We resolved it as "fast on governed pilots, patient on scaling."',
    embedding:'The principles appear on every role card in the org chart, open every council meeting, and are part of how managers are evaluated -- not a poster, but a working reference.',
    collectiveCommitments:'We treat AI as a tool that serves human judgment, not a replacement for it. We will be honest with our people, keep binding commitments human, build before we scale, and protect the craft that makes Aurora trusted.'
  };

  // --- Phase 3, Step 3.5: Mindset Application ---
  data.mindsetApp={'seed_ceo':{
    fear:'That we move too cautiously, a competitor outruns us, and the caution we called "responsible" was really just fear of change.',
    hope:'That Aurora becomes the firm that adopted AI without losing its head or its people -- faster and steadier than rivals because the leadership was ready.',
    atrophySkill:'Estimating intuition -- the feel for a fair, winnable price -- is the skill we most want to keep sharp even as the assistant drafts.',
    practice:'A monthly ten-minute "slow thinking" review where each leader names one decision they deliberately did not delegate, and why.',
    commitments:'Run the monthly leadership review, keep the decision log honest, and revisit the Values Architecture every quarter against real cases.',
    scorecardDecision:'Used the readiness scorecard to decide to delay scaling the support agent by one month until the escalation path and guardrails were documented.'
  },
    seed_coo:{fear:'That we automate a judgment that should have stayed human.',hope:'Faster, calmer operations with people freed from drudgery.',atrophySkill:'Hands-on feel for what a realistic plan looks like.',practice:'Monthly manual forecast vs the model, by hand.',commitments:'No silent automation of a sign-off.',scorecardDecision:'Yes'},
    seed_caio:{fear:'Over-trust in a confident model.',hope:'AI as genuine leverage on the hardest problems.',atrophySkill:'First-principles problem framing.',practice:'Red-team my own models quarterly.',commitments:'Every deployment has a human owner.',scorecardDecision:'Yes'}
};

  // --- Phase 4, Step 4.1: Operating Rhythm ---
  data.opRhythm={
    agenda:'Monthly leadership review: portfolio status, decisions needed, one deep-dive, and a values check against a real recent case.',
    agendaOwner:'Chaired by the CEO; portfolio prepared by the CAIO.',
    peerStructure:'A monthly peer forum for the six leaders to compare AI decisions candidly, off the record.',
    peerAgenda:'Each leader brings one decision where they used AI and one where they overrode it.',
    simFreq:'A quarterly decision simulation for the leadership team.',
    simDesign:'Run on a real, live dilemma rather than a hypothetical, with a written debrief.',
    frontier:'A standing fifteen-minute "what changed" briefing from the CAIO on the AI landscape.',
    boardEd:'A quarterly board briefing plus one external session a year to build director fluency.'
  };
  data.rhythm={cadence:'Council fortnightly; leadership review monthly; board committee quarterly.'};

  // --- Phase 4, Step 4.2: Evaluation & Succession ---
  data.evalSuccession={
    indicators:'Honest AI use, skill-retention in the team, quality of judgment under uncertainty, and how well a leader brings their people along -- weighted above raw automation metrics.',
    proportion:'About a third of each senior leader\u2019s evaluation now reflects AI-era leadership behaviors.',
    bench:'The CAIO is the obvious AI-leadership successor; the COO is building fast. The gap is a credible successor for the CFO\u2019s governance role.',
    benchChanges:'Add an AI-fluency expectation to every senior succession profile and sponsor two high-potential managers into the council.',
    boardFluency:'Recruit one director with AI/data depth within a year; brief the rest quarterly.'
  };
  data.evaluation={criteria:'AI-era leadership behaviors -- honest use, skill protection, judgment under uncertainty, and bringing people along -- now form roughly a third of senior evaluations.'};

  // --- Phase 4, Step 4.3: First Leadership Review (per-leader + structure verdict) ---
  data.leadershipReview={
    leaders:{},
    structWorking:'The CAIO role and the AI Transformation Council have given AI a clear home and a place where functions decide together. Decision rights are now mostly understood, and the monthly review is sticking.',
    structRevision:'The board committee is still under-powered on AI expertise, and the council occasionally becomes a bottleneck for smaller decisions. Push more routine approvals down and strengthen the board.'
  };
  // Honest per-leader review notes after the first 90 days -- progress, not perfection.
  // 14 Sep 2026 (Paul's ruling): assessments carry the four values Step 4.3 writes (developed, progressing, support, hard); the seed had used its own words.
  // 15 Sep 2026: the three early-stage leaders carry the three review scores their judgments imply (flagged for Paul); Glen and Beatriz are not yet assessed by design.
  var _review=[
    {fluency:5,change:5,philosophical:5,assessment:'developed',notes:'Set the tone, protected the principles under pressure, and kept the pace disciplined. Now needs to delegate more of the portfolio to avoid becoming the bottleneck.'}, // Harriet (CEO) DONE
    {fluency:4,change:5,philosophical:4,assessment:'developed',notes:'Moved from cautious to genuinely engaged; the forecasting and quoting pilots are his. Now leads the operational AI story with confidence.'}, // Vincent (COO) DONE
    {fluency:5,change:5,philosophical:5,assessment:'developed',notes:'The engine of the transition. Watch for over-centralization -- her translators must be cross-trained so adoption does not depend on her alone.'}, // Shalini (CAIO) DONE
    {fluency:3,change:4,philosophical:3,assessment:'support',notes:'Started skeptical, now persuaded by evidence and a real asset on governance. Fluency is rising from a low base; pair him with the CAIO on model risk.'}, // Ray (CFO) PROGRESS
    {fluency:4,change:3,philosophical:3,assessment:'progressing',notes:'Brings energy and customer insight; needs to slow down on ungoverned experiments and respect the scaling gate.'}, // Imogen (CMO) PROGRESS
    {fluency:3,change:4,philosophical:3,assessment:'support',notes:'The conscience of the workforce plan and trusted by staff. Building the hands-on AI fluency to lead the people side credibly.'}, // Duncan (CPO) PROGRESS
    {fluency:4,change:4,philosophical:4,assessment:'developed',notes:'Has taken real ownership of the cultural and strategic side of the transition and works well with the CAIO. Still building internal relationships across functions.'}, // Sinead (CITO) PROGRESS
    {fluency:3,change:2,philosophical:2,assessment:'support',notes:'Strong engineer, early in AI-team leadership. Has begun the fluency sprint; needs to finish the mindset track.'}, // Freya (VP Eng) START
    {fluency:2,change:2,philosophical:2,assessment:'hard',notes:'Cautious about customer-facing AI. Engaged with the first study step; not yet rescored.'}, // Tomas (VP Sales) START
    {fluency:3,change:2,philosophical:2,assessment:'hard',notes:'Technically fluent on data, newer to leadership of the practice. Has not yet completed the development track.'}, // Tamsin (VP Data) START
    {assessment:'',notes:'Not yet engaged with the program; assessed at org level only.'}, // Glen (VP Ops) UNLINKED
    {assessment:'',notes:'Recently promoted; not yet enrolled in the leadership track.'} // Beatriz (Dir PX) UNLINKED
  ];
  data.leaders.forEach(function(l,i){ var lid=l.id; if(lid&&_review[i]) data.leadershipReview.leaders[lid]=_review[i]; });

  // --- Phase 4, Step 4.4: Composure & Resilience ---
  data.composure={'seed_ceo':{
    stop1:'Name the decision and the deadline honestly -- is it reversible, and does it truly need deciding now?',
    stop2:'Separate what we know from what we are assuming, and ask what would change our mind.',
    stop3:'Check the decision against the Values Architecture before committing.',
    constants:'Our purpose, our principles, and our duty to our people are the fixed points that do not move when the technology does.',
    constantsComm:'Leaders restate those constants plainly and often, especially when things feel uncertain.',
    uncertaintyProcess:'Decide with the information we have, write down the assumptions, set a review date, and adjust without flinching when reality disagrees.',
    uncertaintyComms:'Tell people what we know, what we don\u2019t, and when they\u2019ll hear more -- candor over false certainty.',
    slowLog:[
      {text:'Paused before approving the support agent\u2019s wider rollout; chose to document the escalation path first. The week\u2019s delay was worth the protection.',date:new Date(Date.now()-1000*60*60*24*21).toISOString(),user:'u1'},
      {text:'Resisted matching a competitor\u2019s ungoverned launch; held the scaling gate and briefed the board on why. Steadier, not slower for its own sake.',date:new Date(Date.now()-1000*60*60*24*10).toISOString(),user:'u3'},
      {text:'Overrode the forecast on one product line where the planner\u2019s judgment was clearly better; logged it so we learn when to trust the model.',date:new Date(Date.now()-1000*60*60*24*3).toISOString(),user:'u2'}
    ]
  },
    seed_coo:{stop1:'When a plant metric swings overnight.',stop2:'When a vendor promises a step-change.',stop3:'When two functions want the same AI resource.',constants:'On-time delivery and safety do not bend.',constantsComm:'Stated at every ops review.',uncertaintyProcess:'Decide the next reversible step, not the whole roadmap.',uncertaintyComms:'I tell teams what we know and what we are still testing.',slowLog:[]},
    seed_caio:{stop1:'When a model looks too good.',stop2:'When a stakeholder wants to skip the gate.',stop3:'When the data shifts under a live model.',constants:'Human accountability and explainability.',constantsComm:'Built into every governance review.',uncertaintyProcess:'Stage, verify, then scale.',uncertaintyComms:'I publish what each model can and cannot do.',slowLog:[]}
};
  // Per-user practice log (slow-thinking), keyed by user id as the code expects.
  // --- Ongoing-practices cadence: current period, varied live stamps, and two
  //     months of pre-archived history so the L&D hub health grid and Practice
  //     History both render populated immediately. ---
  (function(){
    var now=new Date();
    function isoAgo(days){var d=new Date(now);d.setDate(d.getDate()-days);return d.toISOString();}
    data.practicePeriod=now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2);
    // A date pinned safely inside the CURRENT month (day 2 is always in-month), so a
    // practice that is present reads as "done this month" (green) regardless of when the
    // seed is loaded; an omitted practice reads as "not started" (grey). The spread is
    // deliberate -- from leaders who have done everything this month to one who has done
    // nothing -- so the health grid shows a clear done/not mix.
    function isoThisMonth(day){var d=new Date(now.getFullYear(),now.getMonth(),day||2,12,0,0);return d.toISOString();}
    data.practiceLog={
      u6:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(3),depScan:isoThisMonth(4),reverseAudit:isoThisMonth(5),valuesReview:isoThisMonth(6),concernCircle:isoThisMonth(7),commitments:isoThisMonth(8)},  // all seven done
      u7:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(4),depScan:isoThisMonth(6),reverseAudit:isoThisMonth(8),commitments:isoThisMonth(9)},  // five of seven
      u8:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(3),depScan:isoThisMonth(4),reverseAudit:isoThisMonth(5),valuesReview:isoThisMonth(6),concernCircle:isoThisMonth(7),commitments:isoThisMonth(8)},  // all seven done
      u9:{slowLog:isoThisMonth(2)},  // only slow thinking
      u10:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(5),valuesReview:isoThisMonth(7),commitments:isoThisMonth(9)},  // four of seven
      u11:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(4),depScan:isoThisMonth(6),concernCircle:isoThisMonth(8),commitments:isoThisMonth(9)},  // five of seven
      u12:{slowLog:isoThisMonth(2),stopReview:isoThisMonth(5)},  // two of seven
      u13:{slowLog:isoThisMonth(2)},  // only slow thinking
      u14:{},  // nothing done this month
      u15:{slowLog:isoThisMonth(2),depScan:isoThisMonth(5),valuesReview:isoThisMonth(7)}  // three of seven
    };
    // Two prior months of archived snapshots (computed-health shape).
    function prevPeriod(n){var d=new Date(now.getFullYear(),now.getMonth()-n,1);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);}
    function archEnd(n){var d=new Date(now.getFullYear(),now.getMonth()-n+1,0,23,59,59);return d.toISOString();}
    var _pUsers=[{id:'u6',name:'Harriet Rivers'},{id:'u7',name:'Vincent Lau'},{id:'u8',name:'Shalini Mehta'},{id:'u9',name:'Ray Caruso'},{id:'u10',name:'Imogen Whitfield'},{id:'u11',name:'Sinead Corrigan'},{id:'u12',name:'Duncan Fairley'},{id:'u13',name:'Freya Lindqvist'},{id:'u14',name:'Arvind Nair'},{id:'u15',name:'Tamsin Doyle'}];
    var _pPracs=[{id:'slowLog',name:'Slow Thinking'},{id:'stopReview',name:'STOP Technique'},{id:'depScan',name:'Dependency Scan'},{id:'reverseAudit',name:'Skill Atrophy Audit'},{id:'valuesReview',name:'Values Review'},{id:'concernCircle',name:'Concern Circles'},{id:'commitments',name:'Commitments'}];
    // Deterministic-but-varied status generator for history cells. Binary now:
    // green = done that month, red = not done (~70% done).
    function mkCells(seed){
      var cells={};var g=0,r=0;var k=seed;
      _pUsers.forEach(function(u,ui){
        cells[u.id]={};
        _pPracs.forEach(function(p,pi){
          k=(k*1103515245+12345)&0x7fffffff;var v=(k>>8)%10;
          var s = v<7?'green':'red';
          if(s==='green')g++; else r++;
          cells[u.id][p.id]=s;
        });
      });
      return {cells:cells,summary:{green:g,red:r}};
    }
    data.practiceHistory={};
    [2,1].forEach(function(n,idx){
      var pk=prevPeriod(n);
      var mk=mkCells(idx===0?7:23);
      data.practiceHistory[pk]={period:pk,archivedAt:archEnd(n),users:_pUsers,practices:_pPracs,cells:mk.cells,summary:mk.summary};
    });
  })();

  // --- Mark every step and section complete so the journey reads as finished ---
  data.completedSections={A:true,B:true,C:true,D:true,E:true};
  // Ruled 25 July: under the discrete-button model, tabs and sections carry their own
  // state — the demo seeds them complete to match its completed steps.
  ['ownership','board','senior','middle','crossfunc'].forEach(function(s){data.structure[s+'_done']=true});
  ['touchpoints','models','personas','aifree','translation'].forEach(function(s){data.collabLab[s+'_done']=true});
  data.completedSteps={
    '1.1':true,'1.2':true,'1.3':true,'1.4':true,
    '2.1':true,'2.2':true,'2.3':true,'2.4':true,
    '3.1':true,'3.2':true,'3.3':true,'3.4':true,'3.5':true,
    '4.1':true,'4.2':true,'4.3':true,'4.4':true
  };

  // --- Module Management seed (§11): program clock + completion history.
  //     The journey reads as finished, so the clock starts 89 days back and
  //     each stepDoneAt is spread mechanically across its phase's day window
  //     (P1 days 1–25, P2 26–50, P3 51–75, P4 76–90). Derived, not hand-tuned
  //     — revisit list carries the hand-tuning question. Written at builder
  //     level like the exemplar's seed, so no notifications fire. ---
  (function(){
    var t0=new Date(); t0.setDate(t0.getDate()-89);
    data.startDate=t0.toISOString().split('T')[0];
    var _dISO=function(dd){var t=new Date(t0); t.setDate(t.getDate()+dd); return t.toISOString().split('T')[0];};
    data.stepDoneAt={
      '1.1':_dISO(5),'1.2':_dISO(10),'1.3':_dISO(15),'1.4':_dISO(20),
      '2.1':_dISO(28),'2.2':_dISO(33),'2.3':_dISO(38),'2.4':_dISO(44),
      '3.1':_dISO(53),'3.2':_dISO(58),'3.3':_dISO(63),'3.4':_dISO(68),'3.5':_dISO(72),
      '4.1':_dISO(78),'4.2':_dISO(81),'4.3':_dISO(84),'4.4':_dISO(88)
    };
    data.stepDue={};
    data.notifications=[]; data.remind7={};
    data.chatMsgs=[{who:'u2',name:'Paul Scade',ts:'9:14 AM',text:'Good morning everyone \u2014 just reviewed the Values Architecture section. The ontological framing is sharp. Matches the HBR article precisely.'}, {who:'u4',name:'Erik Nelson',ts:'9:31 AM',text:'Agreed. Quick thought: should we add a governance escalation path for the competency framework gaps? Clients keep asking about that.'}, {who:'u5',name:'Tom Davenport',ts:'9:47 AM',text:'Good point Erik. I\u2019d anchor it to the CARE framework \u2014 specifically the Catastrophize \u2192 Assess loop. That gives it theoretical grounding.'}, {who:'u2',name:'Paul Scade',ts:'10:02 AM',text:'Yes \u2014 and it maps cleanly to what Faisal published in MIT SMR. Easy to reference.'}, {who:'u4',name:'Erik Nelson',ts:'10:18 AM',text:'Faisal, can you weigh in when you get a chance? Want to lock this before the facilitation session.'}]; // demo thread seed-owned (item 13, July 16); personas are pre-Aurora relics — Paul's copy round // literal-overwrite ruling (July 8): runtime keys reset on every seed
  })();

  // --- Org chart: build from the sample leaders + their reporting lines, the same
  //     path real user data uses (Phase 1 hierarchy). No hardcoded model org. ---
  data.orgChart=phase1ChartRoles();
  // Express the sample hierarchy directly as role parentId/level (roles own the
  // hierarchy now). CEO under board; the C-suite under the CEO; VP People under COO.
  var _seedParents={
    'ldr_seed_ceo':{p:'board',lv:2},
    'ldr_seed_coo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_caio':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cfo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cmo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cito':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_cpo':{p:'ldr_seed_ceo',lv:3},
    'ldr_seed_vpeng':{p:'ldr_seed_coo',lv:4},
    'ldr_seed_vpsales':{p:'ldr_seed_cmo',lv:4},
    'ldr_seed_vpdata':{p:'ldr_seed_caio',lv:4},
    'ldr_seed_vpops':{p:'ldr_seed_coo',lv:4},
    'ldr_seed_vphr':{p:'ldr_seed_cpo',lv:4},
    'ldr_seed_dirpx':{p:'ldr_seed_vpeng',lv:4}
  };
  (data.orgChart||[]).forEach(function(r){
    var sp=_seedParents[r.id];
    if(sp){r.parentId=sp.p;r.level=sp.lv;}
  });
  // Demonstrate the "Unassigned" state under model B: leave Beatriz Camargo (the most
  // junior leader) occupying NO role. Her role box persists but vacant, so the chart
  // shows a vacant role AND her inventory entry reads "Unassigned" -- exercising both
  // the empty-role and unplaced-leader paths in a real demo (not just a synthetic test).
  (data.orgChart||[]).forEach(function(r){ if(r.id==='ldr_seed_dirpx')r.occupantLeaderId=null; });
  // Tag 2-3 values per role and set a guiding concept, modelling what a user does
  // via the per-role tagging list (3.4) and the dashboard role-edit form. Keyed to
  // the seeded leader ids (chart role ids are 'ldr_'+leaderId; board is 'board').
  var _seedTags={
    'board':{vals:['v1','v3'],gc:'Sets AI risk appetite and approves scaling beyond pilot; does not approve individual deployments.'},
    'ldr_seed_ceo':{vals:['v1','v2','v4'],gc:'Final accountability for the AI transition; protects the principles under commercial pressure and sets the pace.'},
    'ldr_seed_coo':{vals:['v1','v4'],gc:'Owns the operational pilots (forecasting, quoting); decides where AI is trusted on the line and where it is not.'},
    'ldr_seed_caio':{vals:['v1','v4','v5'],gc:'Owns the AI portfolio and the governance gates; the human/AI workflow for each deployment runs through this role.'},
    'ldr_seed_cfo':{vals:['v3','v4'],gc:'Decision rights over investment and the scaling gate; verification of AI-influenced numbers before they are relied on.'},
    'ldr_seed_cmo':{vals:['v2','v3'],gc:'Owns customer-facing AI tone and the line that no binding commitment is made by a machine.'},
    'ldr_seed_cpo':{vals:['v2','v5'],gc:'Owns the workforce-impact plan; honesty with affected people and protection of the skills worth keeping.'},
    'ldr_seed_cito':{vals:['v1','v2','v4'],gc:'Owns the cultural and strategic side of the AI transition end to end; holds the line on principles when efficiency arguments push the other way.'},
    'ldr_seed_vpeng':{vals:['v1','v4'],gc:'Builds the AI-assisted engineering workflow; decides where automated code and review are trusted.'},
    'ldr_seed_vpsales':{vals:['v2','v3'],gc:'Owns AI in the sales motion; keeps a human in the loop on every customer commitment.'},
    'ldr_seed_vpdata':{vals:['v1','v4'],gc:'Owns data quality and the model-evaluation discipline the rest of the business depends on.'},
    'ldr_seed_vpops':{vals:['v4'],gc:'Runs AI-assisted scheduling and quality at the plant; verifies before the line relies on a number.'},
    'ldr_seed_dirpx':{vals:['v2','v3'],gc:'Owns the customer experience of the quoting product; keeps the AI-drafted quote honest and clear.'}
  };
  (data.orgChart||[]).forEach(function(r){
    var t=_seedTags[r.id];
    if(t){r.taggedValues=t.vals.slice();r.guidingConcepts=t.gc;}
  });
  // Ownership: the CITO is the AI-transformation owner added via the Ownership flow.
  // ownerRoleId points at the CITO *role* on the chart (untethered-role model);
  // the ownership tab reads this to show the role as already added to the chart.
  data.structure.ownerRoleId='ldr_seed_cito';
  // Board membership: CEO + CAIO + CITO sit on the board, plus an external non-exec director.
  var _boardRole=(data.orgChart||[]).find(function(r){return r.id==='board';});
  if(_boardRole){
    _boardRole.members=[
      {type:'leader',id:'seed_ceo',aiExpertise:'Led the enterprise AI adoption decision; fluent in the strategic and investment case, and relies on the CAIO for technical depth.'},
      {type:'leader',id:'seed_caio',aiExpertise:'Deep technical AI expertise \u2014 model risk, data quality, and deployment architecture; the board\u2019s credible challenge on technical claims.'},
      {type:'leader',id:'seed_cito',aiExpertise:'Owns the cultural and organizational dimensions of the AI transition; expertise in change management and workforce impact.'},
      {type:'external',name:'Margaret Iyer',title:'Non-Executive Director \u2014 former CEO, industrial manufacturing',aiExpState:'no'}
    ];
  }
  // Council: coordMechanism is 'council', so create the node and staff it.
  syncCouncilNode();
  var _councilRole=(data.orgChart||[]).find(function(r){return r.id==='crossfunc';});
  if(_councilRole){
    _councilRole.members=[
      {type:'leader',id:'seed_caio'},
      {type:'leader',id:'seed_cito'},
      {type:'leader',id:'seed_coo'},
      {type:'leader',id:'seed_cfo'},
      {type:'leader',id:'seed_cmo'},
      {type:'leader',id:'seed_vphr'}
    ];
    _councilRole.guidingConcepts='Cross-functional body where operations, finance, marketing, and people decide together; chaired by the CAIO with the CITO owning the cultural mandate.';
    _councilRole.taggedValues=['v1','v4'];
  }

  // Push the seeded roster into USERS and sign in as the facilitator, so the session
  // reflects the new team immediately (no reload needed). applyTeamRoster reads
  // data.roster as the source of truth.
  if(typeof applyTeamRoster==='function')applyTeamRoster();
  Auth.setSession('u_fac');

  saveData();
  go('readiness');
}
```

**Check:** Open the More menu and choose Seed sample data; confirm. The organization becomes Aurora Windows with thirteen leaders. Open Phase 3, step 3.3 (MM Activation): the AI Workflow Analysis lists Quote drafting, Support triage, and Demand forecast, and opening one shows an AI Role and a Human Role. Open step 2.2 (Collaboration Principles), Models tab: four functions are listed, each with a model such as Augmenter or Autonomous Agent.

---

### Step 45 — Add the function that lays out the organization chart for paper: the paper box sizes, given the page's width and height.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgLevelColor` ends, after its closing `}`.

**Code:**

```js
function layoutOrgTreeForPaper(roles,pageW,pageH){return layoutOrgTreeFitted(roles,pageW,pageH,{BW:170,BH:70,GX:16,GY:44,IND:14,GYH:10,FW:190})} /* paper geometry: narrower boxes and gaps than the screen's, since names wrap to two lines; width is the binding constraint on a landscape page */
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 46 — Add the function that lays out the organization chart for the screen: the screen box sizes, fitted to the same page shape as the paper chart.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `layoutOrgTreeForPaper` ends, after its closing `}`.

**Code:**

```js
function layoutOrgTreeScreen(roles){return layoutOrgTreeFitted(roles,1000,650,{BW:180,BH:76,GX:24,GY:48,IND:20,GYH:12,FW:220})} /* 16 Sep 2026 (Paul's ruling): the screen charts take the same shape as the paper chart — the same page-shaped target chooses the same variant — with the screen's box geometry */
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 47 — Add the function that breaks a role name onto up to two lines within a character budget, so that no title is cut off.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `layoutOrgTreeScreen` ends, after its closing `}`.

**Code:**

```js
function orgNameLines(name,maxC){var words=String(name||'').split(/\s+/),l1='',l2='';words.forEach(function(wd){if(!l2&&(l1+' '+wd).trim().length<=maxC)l1=(l1+' '+wd).trim();else l2=(l2+' '+wd).trim()});if(l2.length>maxC)l2=l2.substring(0,maxC-1)+'\u2026';return [l1,l2]} /* a role name on up to two lines within a character budget; one definition for the paper builder and both screen charts */
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 48 — Add the function that lays out the organization chart to fit a page shape: rows for the upper tiers, lower tiers hanging vertically under their manager, floating bodies tucked beside the top tier, and of the possible layouts the one that prints largest.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgNameLines` ends, after its closing `}`.

**Code:**

```js
function layoutOrgTreeFitted(roles,pageW,pageH,g){ /* 16 Sep 2026 (Paul's ruling): the chart fitted to a page shape. The upper tiers keep the row layout; from a chosen depth down, nodes hang vertically under their parent, indented, as org-chart tools do for the lowest tiers; floating bodies (level 0) tuck into the free space beside the top tier when it fits; of the variants (no hanging, or hanging from each depth), the one that prints largest on the page wins */
  var BW=g.BW,BH=g.BH,GX=g.GX,GY=g.GY,IND=g.IND,GYH=g.GYH,FW=g.FW;
  var treeRoles=roles.filter(function(r){return r.level!==0}),floats=roles.filter(function(r){return r.level===0});
  var cm={};treeRoles.forEach(function(r){var p=(r.parentId&&treeRoles.some(function(x){return x.id===r.parentId}))?r.parentId:'__r';(cm[p]=cm[p]||[]).push(r.id)});
  var roots=cm.__r||[];var depthOf={};function setDepth(id,d){depthOf[id]=d;(cm[id]||[]).forEach(function(c){setDepth(c,d+1)})}roots.forEach(function(r){setDepth(r,0)});
  var maxDepth=0;Object.keys(depthOf).forEach(function(k){if(depthOf[k]>maxDepth)maxDepth=depthOf[k]});
  function build(hangFrom){var pos={},lines=[],w={};
    function hangParent(id){return hangFrom!==null&&(cm[id]||[]).length>0&&depthOf[id]+1>=hangFrom}
    function hangDepth(id){var d=0;(cm[id]||[]).forEach(function(c){d=Math.max(d,1+hangDepth(c))});return d}
    function hangH(id){var h=0;(cm[id]||[]).forEach(function(c){h+=GYH+BH+hangH(c)});return h}
    function sw(id){if(w[id]!==undefined)return w[id];var k=cm[id]||[];if(!k.length){w[id]=BW;return BW}if(hangParent(id)){w[id]=IND*hangDepth(id)+BW;return w[id]}var t=k.reduce(function(a,c){return a+sw(c)+GX},-GX);w[id]=Math.max(BW,t);return w[id]}
    function placeHang(id,x,y){var k=cm[id]||[];var cy=y+BH+GYH;var sx=x+IND/2;var last=null;k.forEach(function(c){pos[c]={x:x+IND,y:cy,w:BW,h:BH};var mid=cy+BH/2;lines.push('M'+sx+','+mid+' L'+(x+IND)+','+mid);last=mid;placeHang(c,x+IND,cy);cy+=BH+hangH(c)+GYH});if(last!==null)lines.push('M'+sx+','+(y+BH)+' L'+sx+','+last)}
    function place(id,x,y){var ww=sw(id);if(hangParent(id)){pos[id]={x:x,y:y,w:BW,h:BH};placeHang(id,x,y);return}pos[id]={x:x+ww/2-BW/2,y:y,w:BW,h:BH};var k=cm[id]||[];var cx=x;k.forEach(function(c){place(c,cx,y+BH+GY);cx+=sw(c)+GX})}
    var rx=0;roots.forEach(function(r){place(r,rx,0);rx+=sw(r)+GX*2});
    treeRoles.forEach(function(r){var k=cm[r.id]||[];if(!k.length||hangParent(r.id)||!pos[r.id])return;var p=pos[r.id],px=p.x+p.w/2,py=p.y+p.h;var kids=k.map(function(id){return pos[id]});var my=py+(kids[0].y-py)/2;lines.push('M'+px+','+py+' L'+px+','+my);var xs=kids.map(function(c){return c.x+c.w/2});var mn=Math.min.apply(null,xs.concat([px])),mx=Math.max.apply(null,xs.concat([px]));if(mx>mn)lines.push('M'+mn+','+my+' L'+mx+','+my);kids.forEach(function(c){var cx=c.x+c.w/2;lines.push('M'+cx+','+my+' L'+cx+','+c.y)})});
    var all=Object.keys(pos).map(function(k){return pos[k]});var treeMaxX=all.length?Math.max.apply(null,all.map(function(p){return p.x+p.w})):0;
    /* floats: the free space beside the top tier, right-aligned within the tree's width; else beside the tree */
    var rowsY=[];all.forEach(function(p){if(rowsY.indexOf(p.y)<0)rowsY.push(p.y)});rowsY.sort(function(a,b){return a-b});
    var rightX=treeMaxX;var tiers=rowsY.slice(0,2).reverse();
    floats.forEach(function(fr){var placed=false;for(var t=0;t<tiers.length&&!placed;t++){var y=tiers[t];var occ=all.filter(function(p){return p.y<y+BH&&p.y+p.h>y});var free=occ.length?Math.max.apply(null,occ.map(function(p){return p.x+p.w}))+GX*2:0;var x=rightX-FW;if(x>=free){pos[fr.id]={x:x,y:y,w:FW,h:BH,floating:true};rightX=x-GX;placed=true}}
      if(!placed){pos[fr.id]={x:treeMaxX+GX*2,y:rowsY[0]||0,w:FW,h:BH,floating:true};treeMaxX+=FW+GX*2}});
    all=Object.keys(pos).map(function(k){return pos[k]});var tw=all.length?Math.max.apply(null,all.map(function(p){return p.x+p.w}))+40:400,th=all.length?Math.max.apply(null,all.map(function(p){return p.y+p.h}))+40:300;
    return {pos:pos,lines:lines,tw:tw,th:th,treeW:treeMaxX+40,hangFrom:hangFrom,scale:Math.min(pageW/(tw+40),pageH/(th+40))}}
  var best=build(null);for(var d=maxDepth;d>=2;d--){var v=build(d);if(v.scale>best.scale+1e-9)best=v}
  return best}
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 49 — Add the function that draws one box of the organization chart on screen: the border, the coloured top bar, the two-line title, the initials, the occupant.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgRepaintInPlace` ends, after its closing `}`.

**Code:**

```js
// The SVG markup for the chart body (no wrapper div), shared by the normal render
// and the in-place fullscreen repaint so the two never diverge.
function orgChartNodeSvg(r,p,opts){opts=opts||{}; /* 16 Sep 2026 (Paul's ruling): one node for both screen charts — the dashboard's box, drawn by the 1.2 reporting-lines chart too. Every box takes the 3px corner; the 8px corner the floating body (and every 1.2 box) had let the square-cornered top bar overhang it */
    var isBoard=r.level===1;
    var leader=isBoard?null:roleOccupant(r);
    var mc=(r.members||[]).length;
    var col=orgLevelColor(r.level);
    var isSel=!!opts.selected;
    var lName=leader?(leader.name.length>20?leader.name.substring(0,18)+'\u2026':leader.name):isBoard?(mc+' member'+(mc!==1?'s':'')):'Unassigned';
    var initials=leader?leader.name.split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase():isBoard?String(mc):'\u2014';
    var circCol=leader?col:isBoard&&mc?col:'rgba(138,130,120,.2)';
    var txtCol=leader||isBoard&&mc?'#d4cfca':'rgba(138,130,120,.5)';
    var isFloat=p.floating;
    var h=opts.interactive?'<g onclick="orgBoxClick(\''+r.id+'\')" style="cursor:pointer">':'<g>';
    h+='<title>'+esc(r.name)+' \u2013 '+esc(leader?leader.name:(isBoard?(mc+' member'+(mc!==1?'s':'')):'Unassigned'))+'</title>';
    h+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="3" fill="'+(isSel?'rgba(245,242,236,.08)':'rgba(26,22,18,.95)')+'" stroke="'+(isSel?col:isFloat?'rgba(78,127,166,.4)':'rgba(245,242,236,.15)')+'" stroke-width="'+(isSel?'2.5':isFloat?'2':'1')+'"'+(isFloat?' stroke-dasharray="6,3"':'')+'"/>';
    h+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="4" fill="'+(isFloat?'#4E7FA6':col)+'"/>';
    var nl=orgNameLines(r.name,22),two=!!nl[1];var rowY=two?58:52;
    if(two)h+='<text x="'+(p.x+14)+'" y="'+(p.y+20)+'" fill="#F5F2EC" font-size="12" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(nl[0])+'</text><text x="'+(p.x+14)+'" y="'+(p.y+34)+'" fill="#F5F2EC" font-size="12" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(nl[1])+'</text>';
    else h+='<text x="'+(p.x+14)+'" y="'+(p.y+24)+'" fill="#F5F2EC" font-size="12" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(nl[0])+'</text>';
    h+='<circle cx="'+(p.x+22)+'" cy="'+(p.y+rowY)+'" r="12" fill="'+circCol+'"/>';
    h+='<text x="'+(p.x+22)+'" y="'+(p.y+rowY+4)+'" fill="'+(leader||isBoard&&mc?'#fff':'#666')+'" font-size="9" font-weight="700" text-anchor="middle" font-family="monospace">'+esc(initials)+'</text>';
    h+='<text x="'+(p.x+40)+'" y="'+(p.y+rowY+4)+'" fill="'+txtCol+'" font-size="11" font-family="Helvetica Neue,sans-serif"'+(leader||isBoard&&mc?'':' font-style="italic"')+'>'+esc(lName)+'</text>';
    if((r.taggedValues||[]).length)h+='<circle cx="'+(p.x+p.w-10)+'" cy="'+(p.y+10)+'" r="3" fill="#4E7FA6" opacity="0.7"/>';
    return h+'</g>'}
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 50 — Replace the function that draws the interactive organization chart of the dashboard and of step 1.2's Assign Hierarchy, so that it uses the fitted layout and the shared box.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `orgChartInnerSvg`.

**Code:**

```js
function orgChartInnerSvg(roles,leaders,fit){
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos; /* 16 Sep 2026 (Paul's ruling): the fitted layout — hanging lower tiers, tucked floats — and names on two lines, as on paper */
  if(!UI.orgZoom)UI.orgZoom=1;
  var natW=layout.tw+40,natH=layout.th+40;var h;
  // Symmetric framing (ruled 16 July): floating roles extend the canvas rightward, which
  // pulled the tree left of the board's center. Mirror the float zone on the left of the
  // viewBox so the Board/CEO trunk sits dead center; with no floats this is a no-op.
  var _fz=Math.max(0,layout.tw-(layout.treeW||layout.tw));var _vx=-20-_fz,_vw=natW+_fz;
  if(fit&&Math.abs(UI.orgZoom-1)<0.01){
    // Org Board fit (ruled 16 July): CSS-sized SVG — fills the board width up to natural
    // size, floored at 0.55 so nodes stay readable; below the floor the canvas pans.
    // The manual chart zoom (+/- buttons) overrides fit until zoom returns to 1.
    h='<svg style="width:100%;max-width:'+_vw+'px;min-width:'+Math.round(_vw*0.55)+'px;height:auto;display:block;margin:0 auto" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }else{
    var zw=Math.round(_vw*UI.orgZoom);var zh=Math.round(natH*UI.orgZoom);
    h='<svg width="'+zw+'" height="'+zh+'" viewBox="'+_vx+' -20 '+_vw+' '+natH+'">';
  }
  layout.lines.forEach(function(d){h+='<path d="'+d+'" fill="none" stroke="rgba(245,242,236,.18)" stroke-width="1.5"/>'});
  roles.forEach(function(r){var p=pos[r.id];if(!p)return;h+=orgChartNodeSvg(r,p,{interactive:true,selected:UI.orgSelected===r.id})});
  h+='</svg>';
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 51 — Replace the function that draws the interactive organization chart with its zoom controls, so that Fit to window measures the fitted layout.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOrgChartInteractive`.

**Code:**

```js
function renderOrgChartInteractive(roles,leaders){
  roles=roles||[];leaders=leaders||[];
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos; /* 16 Sep 2026: the fitted layout the chart draws, so Fit-to-window measures the right width */
  var h='';
  // SVG org chart (only when roles exist; empty state handled below)
  if(roles.length){
  // Zoom controls
  if(!UI.orgZoom)UI.orgZoom=1;
  h+='<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">';
  h+='<button onclick="UI.orgZoom=Math.min(2,UI.orgZoom+0.2);render()" title="Zoom in" style="width:32px;height:32px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:18px;cursor:pointer;font-family:var(--sans)">+</button>';
  h+='<button onclick="UI.orgZoom=Math.max(0.3,UI.orgZoom-0.2);render()" title="Zoom out" style="width:32px;height:32px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--paper);font-size:18px;cursor:pointer;font-family:var(--sans)">&minus;</button>';
  h+='<button onclick="UI.orgZoom=1;render()" title="Reset to 100%" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Reset</button>';
  h+='<span style="font-family:var(--mono);font-size:11px;color:var(--stone)">'+Math.round(UI.orgZoom*100)+'%</span>';
  h+='<button onclick="var tw='+(layout.tw+40)+';var el=document.getElementById(\'orgChartWrap\');var cw=(el?el.clientWidth:900)-48;UI.orgZoom=Math.min(1,cw/tw);render()" title="Fit chart to window" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono)">Fit</button>';
  h+='<button onclick="var el=document.getElementById(\'orgChartWrap\');if(el){if(el.requestFullscreen)el.requestFullscreen();else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();else if(el.msRequestFullscreen)el.msRequestFullscreen()}" title="View the chart fullscreen" style="padding:4px 10px;border:1px solid rgba(var(--fg-rgb),.12);background:rgba(var(--fg-rgb),.03);color:var(--stone);font-size:11px;cursor:pointer;font-family:var(--mono);letter-spacing:.06em">\u26F6 FULLSCREEN</button>';
  h+=orgSavedStatesControls();
  h+='</div>';
  h+='<div class="org-board">';
  // The key lives on the board, top-left (ruled 16 July). Serves every board host.
  h+='<div class="org-board-legend">';
  [{n:1,l:'Board',c:'#6B4C8A'},{n:2,l:'C-Suite',c:'#4E7FA6'},{n:3,l:'Senior',c:'#2D5A8E'},{n:4,l:'Middle Mgmt',c:'#8B5E3C'},{n:0,l:'Cross-Functional',c:'#4E7FA6'}].forEach(function(lv){
    h+='<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:4px;background:'+lv.c+'"></div><span style="font-family:var(--mono);font-size:9px;color:var(--text-body)">'+lv.l+'</span></div>';
  });
  h+='</div>';
  h+='<div id="orgChartWrap" class="org-board-canvas">';
  h+=orgChartInnerSvg(roles,leaders,true);
  h+=orgFullscreenOverlay(roles,leaders);
  h+='</div></div>';
  }else{
    h+='<div style="border:1px solid rgba(var(--fg-rgb),.06);background:rgba(0,0,0,.2);padding:64px 32px;display:flex;align-items:center;justify-content:center;min-height:280px">';
    h+='<div style="max-width:440px;text-align:center">';
    h+='<div style="font-size:32px;margin-bottom:16px;opacity:.5">\u229E</div>';
    h+='<div style="font-family:var(--serif);font-size:20px;font-weight:300;color:var(--paper);margin-bottom:10px">Your org chart is empty</div>';
    h+='<div style="font-size:14px;color:var(--text-body);line-height:1.6">It builds automatically from your module work. In the <strong style="color:var(--paper)">Leadership Landscape</strong>, map your leaders and set their reporting lines on the <strong style="color:var(--paper)">Assign Hierarchy</strong> tab. You can also <strong style="color:var(--paper)">+ Add Role</strong> here to edit the chart directly.</div>';
    h+='</div></div>';
  }
  // Detail panel for selected role (click a box to view it and assign an occupant)
  if(UI.orgSelected&&!UI.orgEditId){
    var sr=roles.find(function(r){return r.id===UI.orgSelected});
    if(sr)h+=renderOrgDetail(sr,roles,leaders);
  }
  if(UI.orgEditId){
    var er=roles.find(function(r){return r.id===UI.orgEditId});
    if(er)h+='<div id="orgEditCard">'+renderOrgForm(er,roles,leaders)+'</div>';
  }
  return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 53.

---

### Step 52 — Add the function that draws the body of the Leadership Dashboard page, so that its toolbar carries the Summary / Full toggle and the Save as PDF button in place of Print Org Chart.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderOrgChartInteractive` ends, after its closing `}`.

**Code:**

```js

function renderDashboardBody(){
  // Init: no auto-seeding. The chart reflects only the user's own work (manual
  // edits, "Seed from Module", or the full "Seed sample data" demo). An empty
  // chart stays empty and shows a guidance prompt below.
  var _leaders=data.leaders||[];
  var _chart=data.orgChart||[];
  // The council exists only if the user chose a council-type coordination mechanism.
  syncCouncilNode();
  // Reconcile the persistent role-chart (add roles for new leaders, remove for deleted,
  // reconcile occupants) on render — the Assign Hierarchy view does the same, so both
  // views of the one chart stay consistent.
  syncPhase1Chart();
  var roles=data.orgChart||[];var leaders=data.leaders||[];
  var layout=layoutOrgTreeScreen(roles);var pos=layout.pos;
  // Structural staffing snapshot for the stat strip. A "position" is a fillable role
  // on the chart, so the Board and the Cross-Functional Council (governance bodies, not
  // single-occupant roles) are excluded from the position counts. Vacant = positions
  // without an occupant; unassigned leaders = inventory people occupying no position.
  var positionRoles=roles.filter(function(r){return r.id!=='board'&&r.id!=='crossfunc';});
  var positionsTotal=positionRoles.length;
  var positionsFilled=positionRoles.filter(function(r){return roleHasOccupant(r);}).length;
  var positionsVacant=positionsTotal-positionsFilled;
  var unassignedLeaders=leaders.filter(function(l){return !leaderOccupiedRole(l);}).length;

  var h='<div class="content-area"><div class="content-inner board-page">';
  h+=backBtn();
  // Phase Five Lead overview video (Phase Five The Leadership System.mp4 beside index.html)
  h+='<div class="overview-video-card mb-6"><div class="overview-video-label" style="color:#6B4C8A">Phase Five \u00b7 Lead</div>'
   +'<video class="overview-video" controls preload="auto" playsinline><source src="Phase Five The Leadership System.mp4" type="video/mp4">Your browser does not support embedded video.</video></div>';
  h+='<div class="step-header"><div class="step-eyebrow">Phase 5 \u00B7 Ongoing</div><h1 class="step-title">Leadership <em>Structure</em></h1></div>';
  // Stats — structural staffing snapshot (Positions / Filled / Vacant / Unassigned leaders)
  h+='<div style="display:flex;gap:1px;margin-bottom:24px;background:rgba(var(--gold-rgb),.25)">';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300">'+positionsTotal+'</div><div class="dash-stat-label">Positions</div></div>';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:'+(positionsFilled>0?'#1B6B5A':'var(--paper)')+'">'+positionsFilled+'</div><div class="dash-stat-label">Filled</div></div>';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:'+(positionsVacant>0?'#C08A2D':'var(--paper)')+'">'+positionsVacant+'</div><div class="dash-stat-label">Vacant</div></div>';
  h+='<div style="flex:1;padding:16px;background:var(--ink);text-align:center"><div style="font-family:var(--serif);font-size:28px;font-weight:300;color:'+(unassignedLeaders>0?'#C08A2D':'var(--paper)')+'">'+unassignedLeaders+'</div><div class="dash-stat-label">Unassigned leaders</div></div>';
  h+='</div>';
  // Toolbar
  h+='<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;justify-content:center">';
  h+=btn('+ Add Role','UI.orgAddForm=true;UI.orgEditId=null;UI.orgSelected=null;UI.scrollTo=\'orgAddCard\';render()','bp','font-size:12px;padding:8px 14px');
  h+=btn('+ Add New Leader','UI.addLeaderOpen=true;UI.editIdx=null;UI.scrollTo=\'addLeaderPanelCard\';render()','bp','font-size:12px;padding:8px 14px');
  h+=btn('\u2193 Save','saveOrgState()','bp','font-size:12px;padding:8px 14px');
  h+=lyDepthCtl()+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px;padding:8px 14px'); /* 16 Sep 2026 (Paul's ruling): the legacy print button gives way to the family's PDF control, with the Summary / Full toggle the document reads */
  h+='</div>';
  if(UI.addLeaderOpen)h+='<div id="addLeaderPanelCard">'+addLeaderPanel()+'</div>';
  // Add form at top
  if(UI.orgAddForm&&!UI.orgEditId){
    h+='<div id="orgAddCard">'+renderOrgForm(null,roles,leaders)+'</div>';
  }
  // Interactive org chart (clickable boxes -> select to view/assign). Shared helper.
  h+=renderOrgChartInteractive(roles,leaders);

  // Policies section
  var cl=data.collabLab||{};var mm=data.mmActivation||{};
  var hasPolicies=cl.aiFreeZones||cl.personaCustomer||cl.translators||mm.workflows;
  if(hasPolicies){
    h+='<div style="margin-top:32px"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:16px">Policies & Principles</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    // AI-Free Zones
    if(cl.aiFreeZones){
      var afzOpen=UI.ctxOpen['pol_afz'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_afz\']=!UI.ctxOpen[\'pol_afz\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">AI-Free Zones</div><span style="color:var(--stone);font-size:11px">'+(afzOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(afzOpen)h+='<div style="padding:0 14px 14px;font-size:13px;color:var(--stone);line-height:1.6">'+esc(cl.aiFreeZones)+'</div>';
      h+='</div>';
    }
    // AI Persona Design
    if(cl.personaCustomer||cl.personaInternal){
      var apOpen=UI.ctxOpen['pol_persona'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_persona\']=!UI.ctxOpen[\'pol_persona\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">AI Persona Design</div><span style="color:var(--stone);font-size:11px">'+(apOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(apOpen)h+='<div style="padding:0 14px 14px;font-size:12px;color:var(--stone);line-height:1.6">'+(cl.personaCustomer?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Customer-facing:</strong> '+esc(cl.personaCustomer)+'</div>':'')+(cl.personaInternal?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Internal:</strong> '+esc(cl.personaInternal)+'</div>':'')+(cl.personaBoundaries?'<div><strong style="color:#9B2D3F">Boundaries:</strong> '+esc(cl.personaBoundaries)+'</div>':'')+'</div>';
      h+='</div>';
    }
    // Translation Layer
    if(cl.translators||cl.transProcesses){
      var tlOpen=UI.ctxOpen['pol_trans'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_trans\']=!UI.ctxOpen[\'pol_trans\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">Translation Layer</div><span style="color:var(--stone);font-size:11px">'+(tlOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(tlOpen)h+='<div style="padding:0 14px 14px;font-size:12px;color:var(--stone);line-height:1.6">'+(cl.translators?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Translators:</strong> '+esc(cl.translators)+'</div>':'')+(cl.transProcesses?'<div style="margin-bottom:8px"><strong style="color:var(--paper)">Processes:</strong> '+esc(cl.transProcesses)+'</div>':'')+(cl.transRisks?'<div><strong style="color:var(--gold)">Risks:</strong> '+esc(cl.transRisks)+'</div>':'')+'</div>';
      h+='</div>';
    }
    // MM Practice Principles
    if(mm.workflows&&mm.workflows.length||mm.humanOnly&&mm.humanOnly.length){
      var mpOpen=UI.ctxOpen['pol_mm'];
      h+='<div style="border:1px solid rgba(var(--fg-rgb),.08);background:rgba(var(--fg-rgb),.02)">';
      h+='<div onclick="UI.ctxOpen[\'pol_mm\']=!UI.ctxOpen[\'pol_mm\'];render()" style="padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:600;color:var(--paper)">MM Practice Principles</div><span style="color:var(--stone);font-size:11px">'+(mpOpen?'\u25BE':'\u25B8')+'</span></div>';
      if(mpOpen){
        h+='<div style="padding:0 14px 14px;font-size:12px;color:var(--stone);line-height:1.6">';
        if(mm.workflows)mm.workflows.forEach(function(w){h+='<div style="margin-bottom:6px;padding:6px 10px;border-left:2px solid #8B5E3C"><strong style="color:var(--paper)">'+esc(w.name)+'</strong>: AI: '+esc(w.aiRole||'')+' | Human: '+esc(w.humanRole||'')+'</div>'});
        if(mm.humanOnly&&mm.humanOnly.length){h+='<div style="margin-top:8px;font-family:var(--mono);font-size:9px;color:#1B6B5A;text-transform:uppercase;margin-bottom:4px">Human-Only Decisions</div>';mm.humanOnly.forEach(function(d){h+='<div style="margin-bottom:4px;padding:4px 10px;border-left:2px solid #1B6B5A">'+esc(d.decision)+'</div>'})}
        h+='</div>';
      }
      h+='</div>';
    }
    h+='</div></div>';
  }

  // Quick links
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px">';
  h+='<div style="border:2px solid #2D5A8E;padding:20px;cursor:pointer" onclick="go(\'5.2\')"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px">Collective</div><div style="font-family:var(--serif);font-size:20px;font-weight:300;margin-bottom:6px">L&D Hub</div><div style="color:#2D5A8E;font-size:14px">\u2192</div></div>';
  h+='<div style="border:2px solid #6B4C8A;padding:20px;cursor:pointer" onclick="go(\'5.3\')"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px">Individual</div><div style="font-family:var(--serif);font-size:20px;font-weight:300;margin-bottom:6px">My Development</div><div style="color:#6B4C8A;font-size:14px">\u2192</div></div>';
  h+='</div>';
  // Outputs
  h+='<div style="margin-top:24px"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.15em;color:var(--gold);text-transform:uppercase;margin-bottom:12px">Program Outputs</div>';
  h+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
  for(var i=0;i<4;i++){(PH[i].outcomes||[]).forEach(function(o){
    h+='<div onclick="go(\''+o.id+'\')" style="padding:6px 12px;border:1px solid var(--rule);font-family:var(--mono);font-size:10px;color:var(--stone);cursor:pointer" onmouseover="this.style.borderColor=\'var(--gold)\';this.style.color=\'var(--paper)\'" onmouseout="this.style.borderColor=\'var(--rule)\';this.style.color=\'var(--stone)\'">\u2192 '+esc(o.name)+'</div>';
  })}
  h+='</div></div>';
  h+='</div></div>';return h;
}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 53 — Replace the function that draws a role's detail box on the dashboard, so that it can also draw for paper (without the direct reports and the middle-management categories) and so that its Board and council blocks read Board Summary and the council's title followed by Summary.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderOrgDetail`.

**Code:**

```js

function renderOrgDetail(r,roles,leaders,opts){var P=!!(opts&&opts.print); /* 16 Sep 2026 (Paul's ruling): print mode omits the direct reports and the middle-management categories */
  var isBoard=r.level===1;
  var leader=isBoard?null:roleOccupant(r);
  var cf=data.competencyFramework||{};var rv=data.leadershipReview||{};var ma=myIndivRead('mindsetApp');
  var children=roles.filter(function(c){return c.parentId===r.id});
  var parentRole=r.parentId?roles.find(function(p){return p.id===r.parentId}):null;
  var col=orgLevelColor(r.level);
  var _allValues=(data.orgValues&&data.orgValues.length)?data.orgValues:[];
  var tagged=(r.taggedValues||[]).map(function(vid){return _allValues.find(function(v){return v.id===vid})}).filter(Boolean);
  var COMPS=[{id:'orchestration',n:'Orchestration'},{id:'philosophical',n:'Philosophical'},{id:'hybrid',n:'Hybrid Teams'},{id:'change',n:'Change'},{id:'composure',n:'Composure'},{id:'ecosystem',n:'Ecosystem'},{id:'emotional',n:'Emotional'}];
  var lvLabels={0:'Cross-Functional',1:'Board & Governance',2:'C-Suite & Transformation',3:'Senior Leadership',4:'Middle Management'};

  var h='<div style="margin-top:24px;border:2px solid '+col+';background:rgba(var(--fg-rgb),.02)">';
  // Header
  h+='<div style="padding:20px 24px;border-bottom:1px solid rgba(var(--fg-rgb),.06);display:flex;justify-content:space-between;align-items:flex-start">';
  h+='<div><div style="font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:'+col+';text-transform:uppercase;margin-bottom:4px">'+(lvLabels[r.level]||'')+'</div>';
  h+='<div style="font-family:var(--serif);font-size:22px;font-weight:300;font-style:italic;margin-bottom:4px;color:var(--paper)">'+esc(r.name)+'</div>';
  if(parentRole)h+='<div style="font-size:12px;color:var(--text-body)">Reports to: '+esc(parentRole.name)+'</div>';
  h+='</div><div style="display:flex;gap:8px">';
  h+='<button onclick="UI.orgEditId=\''+r.id+'\';UI.orgAddForm=false;UI.scrollTo=\'orgEditCard\';render()" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid rgba(var(--fg-rgb),.12);color:var(--text-body);cursor:pointer;font-family:var(--mono)">Edit</button>';
  h+='<button onclick="UI.orgSelected=null;render()" title="Close" style="padding:6px 14px;font-size:11px;background:transparent;border:1px solid rgba(var(--fg-rgb),.12);color:var(--text-body);cursor:pointer;font-family:var(--mono)">\u00D7</button>';
  h+='</div></div>';
  h+='<div style="padding:24px">';
  // Board members
  if(isBoard&&(r.members||[]).length){
    var _mById={};(leaders||[]).forEach(function(l){if(l.id)_mById[l.id]=l;});
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:'+col+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Committee Members ('+r.members.length+')</div>';
    r.members.forEach(function(m){
      var isLeaderM=m.type==='leader';
      var ml=isLeaderM?(_mById[m.id]||(m.idx!==undefined?leaders[m.idx]:null)):null;
      var nm=isLeaderM?(ml?ml.name:'Leader'):m.name;
      var ti=isLeaderM?(ml?leaderRoleName(ml):'Internal'):(m.title||'External');
      var ini=(nm||'?').split(' ').map(function(w){return w[0]}).join('').substring(0,2).toUpperCase();
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.04)">';
      h+='<div style="width:28px;height:28px;border-radius:14px;background:'+(isLeaderM?'#1B6B5A':'#4E7FA6')+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:monospace;flex-shrink:0">'+esc(ini)+'</div>';
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--paper)">'+esc(nm)+'</div><div style="font-size:11px;color:var(--text-body)">'+esc(ti)+'</div>'+(m.aiExpertise?'<div style="font-size:11px;color:var(--text-body);margin-top:2px;line-height:1.5">'+esc(m.aiExpertise)+'</div>':'')+'</div>';
      h+='<div style="font-family:var(--mono);font-size:9px;padding:2px 8px;border:1px solid '+(isLeaderM?'rgba(27,107,90,.3)':'rgba(var(--gold-rgb),.3)')+';color:'+(isLeaderM?'#1B6B5A':'#4E7FA6')+'">'+(isLeaderM?'INTERNAL':'EXTERNAL')+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }
  // Board enrichment from Structure Lab
  if(isBoard){
    var st=data.structure||{};var ev=data.evalSuccession||{};
    var boardFields=[
      {label:'Board AI Expertise',val:boardExpertiseSummary()||st.boardExpertise},
      {label:'Board Expertise Gaps',val:st.boardExpertiseGaps},
      {label:'Decisions Requiring Board Approval',val:st.boardDecisions},
      {label:'Board Education Plan',val:st.boardEducation},
      {label:'Board Fluency Requirements',val:ev.boardFluency}
    ].filter(function(f){return f.val});
    if(boardFields.length){
      h+='<div style="margin:12px 0 20px"><div style="font-family:var(--mono);font-size:10px;color:#6B4C8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Board Summary</div>'; /* 16 Sep 2026 (Paul's ruling): Board Summary, not From Structure Lab; a little more room after the committee members */
      boardFields.forEach(function(f){
        h+='<div style="margin-bottom:8px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #6B4C8A"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">'+esc(f.label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(f.val)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // Cross-functional enrichment from Structure Lab
  if(r.level===0){
    var st=data.structure||{};
    var cfFields=[
      {label:'Coordination Mechanism',val:st.coordMechanism?{council:'AI Transformation Council',epmo:'Enterprise PMO',matrix:'Matrix AI Leads',rotation:'Leadership Rotation',network:'Innovation Network'}[st.coordMechanism]||st.coordMechanism:''},
      {label:'Meeting Cadence & Participants',val:st.coordCadence},
      {label:'Conflict Resolution',val:st.coordConflict},
      {label:'Information Flows',val:st.coordInfo}
    ].filter(function(f){return f.val});
    if(cfFields.length){
      h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">'+esc(r.name)+' Summary</div>'; /* 16 Sep 2026 (Paul's ruling): the cross-functional body's title, then Summary */
      cfFields.forEach(function(f){
        h+='<div style="margin-bottom:8px;padding:10px 14px;background:rgba(var(--fg-rgb),.03);border-left:3px solid var(--gold)"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:4px">'+esc(f.label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(f.val)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // Quick assign (non-board)
  if(!isBoard){
    h+='<div style="margin-bottom:20px;display:flex;align-items:center;gap:12px"><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em">Assigned to</div>';
    h+='<select id="or_qadash_'+r.id+'" onchange="quickAssignOrg(\''+r.id+'\',this.value)" class="assign-sel" style="padding:6px 12px;background:rgba(var(--fg-rgb),.05);border:1px solid '+col+';color:var(--paper);font-size:13px;font-family:var(--sans)"><option value=""'+(r.assignedLeader===null||r.assignedLeader===undefined?' selected':'')+'>Unassigned</option>';
    leaders.forEach(function(l,i){h+='<option value="'+esc(l.id)+'"'+((r.occupantLeaderId||(roleOccupant(r)||{}).id)===l.id?' selected':'')+'>'+esc(l.name)+'</option>'});
    h+='</select>';
    if(leader)h+='<span style="font-size:13px;color:var(--paper);font-weight:600">'+esc(leaderRoleName(leader))+'</span>';
    h+='</div>';
  }
  // Guiding concepts
  if(r.guidingConcepts){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Guiding Concepts</div>';
    h+='<div style="font-size:14px;color:var(--paper);line-height:1.7;padding:14px 18px;background:rgba(var(--fg-rgb),.03);border-left:3px solid '+col+'">'+esc(r.guidingConcepts)+'</div></div>';
  }
  // Structure Lab enrichment for senior leadership (Option C: keyword match)
  if(r.level===3&&leader){
    var st=data.structure||{};var enrichLines=[];
    var searchName=leader.name;var searchRole=leaderRoleName(leader);
    ['seniorAccountability','seniorDecisionRights','seniorAlignment'].forEach(function(field){
      var text=st[field]||'';if(!text)return;
      var lines=text.split('\n');
      lines.forEach(function(line){
        if(line&&(line.indexOf(searchName)>=0||(searchRole&&line.indexOf(searchRole)>=0)))enrichLines.push({field:field,text:line.trim()});
      });
    });
    if(enrichLines.length){
      var fieldLabels={seniorAccountability:'Accountability',seniorDecisionRights:'Decision Rights',seniorAlignment:'Alignment'};
      h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:#2D5A8E;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">From Structure Lab</div>';
      enrichLines.forEach(function(el){
        h+='<div style="padding:8px 12px;margin-bottom:4px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #2D5A8E"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:2px">'+(fieldLabels[el.field]||el.field)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(el.text)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // MM enrichment from Structure Lab — the same three categories for every manager; omitted on paper (Paul's ruling, 16 Sep 2026)
  if(r.level===4&&!P){
    var st=data.structure||{};
    var mmFields=[
      {label:'Tasks to Automate',val:st.mmAutomate},
      {label:'Tasks to Augment',val:st.mmAugment},
      {label:'Tasks Remaining Human',val:st.mmHuman}
    ].filter(function(f){return f.val});
    if(mmFields.length){
      h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:#8B5E3C;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">From Structure Lab</div>';
      mmFields.forEach(function(f){
        h+='<div style="padding:8px 12px;margin-bottom:4px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #8B5E3C"><div style="font-family:var(--mono);font-size:9px;color:var(--stone);text-transform:uppercase;margin-bottom:2px">'+esc(f.label)+'</div><div style="font-size:13px;color:var(--paper);line-height:1.5">'+esc(f.val)+'</div></div>';
      });
      h+='</div>';
    }
  }
  // Tagged values
  if(tagged.length){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Values \u2014 Relevant to This Role</div>';
    tagged.forEach(function(v){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:4px;background:rgba(var(--fg-rgb),.03);border-left:3px solid '+(DOMAIN_COL[v.domain]||'#888')+'"><div style="font-size:13px;color:var(--paper);flex:1">'+esc(v.principle)+'</div><div style="font-family:var(--mono);font-size:9px;color:'+(DOMAIN_COL[v.domain]||'#888')+';text-transform:uppercase;letter-spacing:.1em">'+esc(v.domain)+'</div></div>';
    });
    h+='</div>';
  }
  // Leader competencies + review (non-board, assigned)
  if(!isBoard&&leader){
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">';
    h+='<div><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Competency Profile</div>';
    COMPS.forEach(function(c){
      var v=leader?(cf.scores||{})[leader.id+'_'+c.id]||0:0;
      var vc=v>=4?'#1B6B5A':v>=3?'#4E7FA6':v>0?'#9B2D3F':'#555';
      h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="font-size:11px;color:var(--text-body);min-width:90px">'+c.n+'</div><div style="flex:1;height:5px;background:rgba(var(--fg-rgb),.06);border-radius:2px"><div style="height:100%;width:'+v*20+'%;background:'+vc+';border-radius:2px"></div></div><div style="font-family:var(--mono);font-size:11px;color:'+vc+';min-width:24px;text-align:right">'+(v||'\u2014')+'</div></div>';
    });
    h+='</div>';
    h+='<div><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Assessment & Review</div>';
    h+='<div style="font-size:13px;color:var(--text-body);line-height:2.4">Fluency: <strong style="color:var(--paper)">'+(leader.fluency||'\u2014')+'/5</strong><br>Engagement: <strong style="color:'+(leader.engagement==='active'?'#1B6B5A':'#4E7FA6')+'">'+(leader.engagement==='active'?'Active':leader.engagement==='developing'?'Developing':'Not yet')+'</strong><br>Scope: <strong style="color:var(--paper)">'+(leader.scope==='org'?'Organization-wide':leader.scope==='dept'?'Departmental':'Team')+'</strong>';
    var rvl=(rv.leaders||{})[leader.id];
    if(rvl){
      var ac={developed:'Developed',progressing:'Progressing',support:'Needs Support',hard:'Hard Conversation'};
      var acol={developed:'#1B6B5A',progressing:'#2D5A8E',support:'#4E7FA6',hard:'#9B2D3F'};
      h+='<br>Review: <strong style="color:'+(acol[rvl.assessment]||'var(--text-body)')+'">'+(ac[rvl.assessment]||'\u2014')+'</strong>';
      if(rvl.notes)h+='<div style="margin-top:8px;font-size:12px;color:var(--text-body);line-height:1.5;padding:8px 12px;background:rgba(var(--fg-rgb),.03);border-left:2px solid #4E7FA6">'+esc(rvl.notes)+'</div>';
    }
    h+='</div></div></div>';
  }
  // Philosophical commitments — collective from Step 3.4, individual from Step 3.5
  var collectiveCommitments=(data.valuesDiscussion||{}).collectiveCommitments;
  if(collectiveCommitments){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Collective Philosophical Commitments</div>';
    h+='<div style="font-size:13px;color:var(--paper);line-height:1.7;padding:14px 18px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #9B2D3F">'+esc(collectiveCommitments)+'</div></div>';
  }
  if(!isBoard&&leader&&ma.commitments){
    h+='<div style="margin-bottom:20px"><div style="font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Individual Commitments ('+esc(leader.name)+')</div>';
    h+='<div style="font-size:13px;color:var(--paper);line-height:1.7;padding:14px 18px;background:rgba(var(--fg-rgb),.03);border-left:3px solid #8B5E3C">'+esc(ma.commitments)+'</div></div>';
  }
  // Direct reports — the chart shows them; omitted on paper (Paul's ruling, 16 Sep 2026)
  if(children.length&&!P){
    h+='<div><div style="font-family:var(--mono);font-size:10px;color:var(--text-body);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Direct Reports ('+children.length+')</div>';
    children.forEach(function(c){
      var cl=roleOccupant(c);
      h+='<div onclick="event.stopPropagation();UI.orgSelected=\''+c.id+'\';UI.orgEditId=null;render()" title="Open this role" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(var(--fg-rgb),.04);cursor:pointer"><div style="display:flex;align-items:center;gap:8px"><div style="width:6px;height:6px;border-radius:3px;background:'+orgLevelColor(c.level)+'"></div><span style="font-size:13px;color:var(--paper);font-weight:600">'+esc(c.name)+'</span></div><span style="font-size:12px;color:var(--text-body)">'+(cl?esc(cl.name):'Unassigned')+'</span></div>';
    });
    h+='</div>';
  }
  h+='</div></div>';
  return h;
}
```

**Check:** Open Phase 1, step 1.2 (Leadership Landscape) and scroll to the Reporting Lines chart. Long role titles such as Chief Innovation & Transformation Officer appear on two lines with no "…". Below the executives, their reports hang in a column under each one rather than side by side, and the AI Transformation Council box sits beside the Chief Executive Officer with a dashed border. Every box has a coloured bar along its top that ends exactly at the box's corners. Open step 5.1 (Leadership Dashboard): its chart shows the same boxes, and clicking a box opens the role's detail box.

---

### Step 54 — Add the constant that names the organization chart's levels.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `quickAssignOrg` ends, after its closing `}`.

**Code:**

```js
var ORG_LEVEL_LABELS={0:'Cross-Functional',1:'Board & Governance',2:'C-Suite & Transformation',3:'Senior Leadership',4:'Middle Management'};
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 55 — Add the function that lets an organization chart scale to the width of a printed page.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `ORG_LEVEL_LABELS` ends.

**Code:**

```js
function erScaleSvg(svg){return String(svg).replace(/<svg width="\d+" height="\d+"/,'<svg preserveAspectRatio="xMinYMin meet" style="width:100%;height:auto"')} /* 15 Sep 2026: a landscape snapshot scales to its page by its viewBox, not its pixel width */
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 56 — Add the function that draws the organization chart for paper (and for the old chart window): the box for each role, two-line role names and a dashed floating body when drawn for paper.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erScaleSvg` ends, after its closing `}`.

**Code:**

```js
function orgChartSvgHtml(roles,layout,opts){var pos=layout.pos;opts=opts||{}; /* opts.paper (16 Sep 2026, Paul's ruling): role names wrap onto two lines instead of truncating, and a floating body prints with a dashed border and its level named, so no report line is read into it */ /* 16 Sep 2026 (Paul's ruling): the chart's colours are the theme's tokens — box, role, occupant, connector — so the page's fill sweep no longer turns the role names pale in the light theme, and paper takes the tokens' print values */
  var svg='<svg width="'+(layout.tw+40)+'" height="'+(layout.th+40)+'" viewBox="-20 -20 '+(layout.tw+40)+' '+(layout.th+40)+'"'+(opts.paper?' preserveAspectRatio="xMinYMin meet"':'')+' xmlns="http://www.w3.org/2000/svg">';
  layout.lines.forEach(function(d){svg+='<path d="'+d+'" fill="none" style="stroke:rgba(var(--fg-rgb),.25)" stroke-width="1.5"/>'});
  roles.forEach(function(r){
    var p=pos[r.id];if(!p)return;
    var isBoard=r.level===1;
    var leader=isBoard?null:roleOccupant(r);
    var mc=(r.members||[]).length;
    var col=orgLevelColor(r.level);
    var lName=leader?leader.name:isBoard?(mc+' members'):'Unassigned';
    var dashed=(opts.paper&&p.floating)?' stroke-dasharray="5,3"':'';
    svg+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="3" style="fill:var(--bg-elev);stroke:rgba(var(--fg-rgb),'+(dashed?'.35':'.15')+')" stroke-width="1"'+dashed+'/>';
    svg+='<rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="4" fill="'+col+'"/>';
    if(opts.paper){var nl=orgNameLines(r.name,Math.max(14,Math.floor((p.w-24)/6.6))),l1=nl[0],l2=nl[1];
      var second=(p.floating?ORG_LEVEL_LABELS[0]+' \u00b7 ':'')+lName;var maxS=Math.floor((p.w-24)/5.6);if(second.length>maxS)second=second.substring(0,maxS-1)+'\u2026';
      if(l2){svg+='<text x="'+(p.x+12)+'" y="'+(p.y+20)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(l1)+'</text><text x="'+(p.x+12)+'" y="'+(p.y+34)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(l2)+'</text>'}
      else svg+='<text x="'+(p.x+12)+'" y="'+(p.y+27)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(l1)+'</text>';
      svg+='<text x="'+(p.x+12)+'" y="'+(p.y+(l2?54:48))+'" style="fill:var(--text-body)" font-size="10" font-family="Helvetica Neue,sans-serif">'+esc(second)+'</text>';return}
    svg+='<text x="'+(p.x+12)+'" y="'+(p.y+22)+'" style="fill:var(--paper)" font-size="11" font-weight="700" font-family="Helvetica Neue,sans-serif">'+esc(r.name.length>22?r.name.substring(0,20)+'\u2026':r.name)+'</text>';
    svg+='<text x="'+(p.x+12)+'" y="'+(p.y+50)+'" style="fill:var(--text-body)" font-size="10" font-family="Helvetica Neue,sans-serif">'+esc(lName.length>24?lName.substring(0,22)+'\u2026':lName)+'</text>';
  });
  svg+='</svg>';
  return svg}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 57 — Add the function that draws the table of roles.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgChartSvgHtml` ends, after its closing `}`.

**Code:**

```js
function orgRolesTableHtml(roles,leaders){var lvLabels=ORG_LEVEL_LABELS;
  var table='<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:24px">';
  table+='<tr style="border-bottom:2px solid #333"><th style="text-align:left;padding:8px">Role</th><th style="text-align:left;padding:8px">Level</th><th style="text-align:left;padding:8px">Assigned To</th><th style="text-align:left;padding:8px">Guiding Concepts</th><th style="text-align:left;padding:8px">Values</th></tr>';
  roles.forEach(function(r){
    var isBoard=r.level===1;
    var leader=isBoard?null:roleOccupant(r);
    var assignee=leader?leader.name:isBoard?(r.members||[]).map(function(m){if(m.type==='leader'){var bl=(leaders||[]).filter(function(l){return l.id===m.id;})[0]||(m.idx!==undefined?leaders[m.idx]:null);return bl?bl.name:'';}return m.name||'';}).join(', '):'Unassigned';
    var vals=(r.taggedValues||[]).map(function(vid){var v=(data.orgValues||[]).find(function(x){return x.id===vid});return v?v.principle:''}).filter(Boolean).join('; ');
    table+='<tr style="border-bottom:1px solid #ddd"><td style="padding:8px;font-weight:600">'+esc(r.name)+'</td><td style="padding:8px">'+esc(lvLabels[r.level]||'')+'</td><td style="padding:8px">'+esc(assignee)+'</td><td style="padding:8px;max-width:200px">'+esc(r.guidingConcepts||'')+'</td><td style="padding:8px;max-width:200px;font-size:10px">'+esc(vals)+'</td></tr>';
  });
  table+='</table>';
  return table}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 58 — Add the function that draws the table of every leader's seven competency scores, used by the printed Leadership Structure document's appendix.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `orgRolesTableHtml` ends, after its closing `}`.

**Code:**

```js
function competencySummaryTable(){var cf=data.competencyFramework||{},leaders=data.leaders||[];var COMPS=['Orchestration','Philosophical','Hybrid Teams','Change','Composure','Ecosystem','Emotional'];var CK=['orchestration','philosophical','hybrid','change','composure','ecosystem','emotional'];
  var t='<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px"><tr style="border-bottom:2px solid #333"><th style="text-align:left;padding:6px">Leader</th>';COMPS.forEach(function(c){t+='<th style="text-align:center;padding:6px;font-size:9px">'+c+'</th>'});t+='</tr>';
  leaders.forEach(function(l){t+='<tr style="border-bottom:1px solid #ddd"><td style="padding:6px;font-weight:600">'+esc(l.name)+'</td>';CK.forEach(function(c){var v=(cf.scores||{})[l.id+'_'+c]||0;t+='<td style="text-align:center;padding:6px;color:'+(v>=4?'#1B6B5A':v>=3?'#4E7FA6':v>0?'#9B2D3F':'#ccc')+'">'+v+'</td>'});t+='</tr>'});
  return t+'</table>'} /* 16 Sep 2026: every leader's seven scores — the legacy org-chart window's table, now the Leadership Structure document's appendix */
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 59 — Replace the function that prints the organization chart in its own window (the old print), so that it draws the chart and the table with the shared functions.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printOrgChart`.

**Code:**

```js
function printOrgChart(){
  var roles=data.orgChart||[];var leaders=data.leaders||[];
  var layout=layoutOrgTree(roles);var pos=layout.pos;
  var cf=data.competencyFramework||{};var rv=data.leadershipReview||{};
  var lvLabels=ORG_LEVEL_LABELS;
  var COMPS=['Orchestration','Philosophical','Hybrid Teams','Change','Composure','Ecosystem','Emotional'];
  var CK=['orchestration','philosophical','hybrid','change','composure','ecosystem','emotional'];
  var svg=orgChartSvgHtml(roles,layout); /* 14 Sep 2026: shared with the Leadership Dashboard document */
  var table=orgRolesTableHtml(roles,leaders); /* 14 Sep 2026: shared with the Leadership Dashboard document */
  var compTable='<h3 style="margin-top:32px;font-size:14px">Competency Summary</h3>'+competencySummaryTable(); /* 16 Sep 2026: the table is shared with the Leadership Structure document's appendix */
  // Open print window
  var w=window.open('','_blank');
  if(!w){alert('Pop-up blocked. Please allow pop-ups for printing.');return}
  w.document.write('<!DOCTYPE html><html><head><title>Leadership Structure \u2014 Executive Readiness</title><style>'+printThemeTokens()+'body{font-family:Helvetica Neue,Arial,sans-serif;padding:32px;color:#1a1612}h1{font-size:24px;font-weight:300;margin:0 0 4px}h2{font-size:14px;font-weight:700;margin:16px 0 8px}p{font-size:12px;color:#666;margin:0 0 24px}.meta{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}svg{max-width:100%;height:auto}@media print{body{padding:16px}}</style></head><body>');
  w.document.write('<div class="meta">Executive Readiness \u00B7 Leadership Structure \u00B7 Printed '+new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})+'</div>');
  w.document.write('<h1>Leadership Structure</h1>');
  w.document.write('<p>'+roles.length+' roles \u00B7 '+leaders.length+' leaders \u00B7 '+roles.filter(function(r){return roleHasOccupant(r)||(r.members||[]).length>0}).length+' filled</p>');
  w.document.write('<div style="overflow-x:auto;border:1px solid #ddd;padding:16px;margin-bottom:16px">'+svg+'</div>');
  w.document.write('<h2>Role Details</h2>'+table);
  w.document.write(compTable);
  w.document.write('</body></html>');
  w.document.close();
  setTimeout(function(){w.print()},300);
}
```

**Nothing to check yet.** This change becomes visible at Step 67.

---

### Step 60 — Replace the function that names the page a note was written on, so that it knows the Report Manager page.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `notesWhere`.

**Code:**

```js



/* ═══ NOTES ═══ */
// Item 39 (family law; Architecture treatment, adapted to ER's page model and panel
// register 25 July 2026): each note records where it was captured and renders a jump
// link back to that location. Legacy notes ({text,date} only) render without the
// delete button or jump link. Storage stays data.notes; ER's --nav-h-exact mechanism
// already anchors the panel, so Architecture's anchorBelowNav is not ported.
function notesWhere(){
  if(currentPage==='step'&&currentStep){
    for(var i=0;i<PH.length;i++)for(var j=0;j<PH[i].steps.length;j++)
      if(PH[i].steps[j].id===currentStep)return'Step '+currentStep+' \u00B7 '+PH[i].steps[j].name;
    return'Step '+currentStep;
  }
  if(currentPage==='phaseHome'&&currentStep){var ph=PH.find(function(p){return String(p.id)===String(currentStep)});if(ph)return'Phase '+ph.id+' \u00B7 '+ph.name}
  if(currentPage==='outcome'&&currentStep){for(var k=0;k<PH.length;k++){var o=(PH[k].outcomes||[]).find(function(x){return x.id===currentStep});if(o)return o.name}}
  var map={home:'Home',learn:'Learn',insights:'Insights','mgmt-hub':'Track Program',reports:'Report Manager'};
  return map[currentPage]||'';
}
```

**Nothing to check yet.** This change becomes visible at Step 79.

---

### Step 61 — Replace the function that shows or hides the sidebar for the current page, so that it reads the shared list of pages that show it.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `updateSidebarState`.

**Code:**

```js
function updateSidebarState(){
  var sb=$('pipSidebar');var app=$('app');var ftr=$('appFooter');var btn=$('sidebarToggle');
  var show=sidebarPageShown();
  if(sb){sb.className='sidebar'+(sidebarOpen?'':' collapsed')+(sidebarMinimized?' mini':'');sb.style.display=show?'flex':'none'}
  if(app){app.classList.remove('sidebar-collapsed','sidebar-mini');if(!show||!sidebarOpen)app.classList.add('sidebar-collapsed');else if(sidebarMinimized)app.classList.add('sidebar-mini')}
  if(ftr){ftr.classList.remove('sidebar-collapsed','sidebar-mini');if(!show||!sidebarOpen)ftr.classList.add('sidebar-collapsed');else if(sidebarMinimized)ftr.classList.add('sidebar-mini')}
  if(btn){btn.style.display=show?'block':'none';btn.style.left='16px'}
}
```

**Nothing to check yet.** This change becomes visible at Step 76.

---

### Step 62 — Add the function that says whether the current page shows the sidebar and its toggle; the Report Manager page does.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `updateSidebarState` ends, after its closing `}`.

**Code:**

```js
function sidebarPageShown(){return currentPage==='step'||currentPage==='readiness'||currentPage==='phase5'||currentPage==='outcome'||currentPage==='phaseHome'||currentPage==='reports'} /* 16 Sep 2026 (Paul's ruling): the Report Manager keeps the sidebar and its toggle like the working pages; one definition for renderSidebar and updateSidebarState */
```

**Nothing to check yet.** This change becomes visible at Step 76.

---

### Step 63 — Replace the function that draws the sidebar, so that each phase's outputs sit behind one folded line and the Report Manager page shows the sidebar.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `renderSidebar`.

**Code:**

```js
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
    btn.style.left = '16px';
  }
  if(!showSidebar)return;

  // Build header with min/max toggle button
  var togContent = sidebarMinimized ? '\u00BB' : '\u00AB&nbsp;&nbsp;Minimize';
  var togTitle = sidebarMinimized ? 'Maximize sidebar' : 'Minimize sidebar';
  var headerHtml = '<div class="sidebar-header">'
    + (sidebarMinimized ? '<div class="sidebar-logo-mini" title="Executive Readiness">ER</div>' : '<div class="sidebar-logo">Executive <span>Readiness</span></div>')
    + '<button class="sidebar-size-tog" onclick="toggleSidebarSize()" title="' + togTitle + '" aria-label="' + togTitle + '">' + togContent + '</button>'
    + '</div>';

  // Build minimized body: phase circles only
  if(sidebarMinimized){
    var h='<div class="sidebar-inner">';
    h += headerHtml;
    h += '<div class="sidebar-scroll">';
    h += '<div class="sidebar-mini-row' + (currentPage==='readiness'?' active':'') + '" onclick="go(\'readiness\')" title="Overview">'
      + '<span class="sidebar-mini-icon">\u25A6</span></div>';
    for(var i=0;i<PH.length;i++){
      var ph=PH[i];
      var isPhaseActive=(currentPage==='phaseHome'&&String(currentStep)===String(ph.id))||(currentPage==='phase5'&&ph.id===5);
      var hasActiveStep = (currentPage==='step' && currentStep && String(currentStep).charAt(0)===String(ph.id));
      h += '<div class="sidebar-mini-row' + (isPhaseActive||hasActiveStep?' active':'') + '" '
        + 'onclick="go(\''+(ph.id===5?'phase5':'phase-'+ph.id)+'\')" '
        + 'title="Phase '+ph.id+': '+ph.name+' ('+ph.days+')">'
        + '<span class="sidebar-mini-dot" style="background:'+ph.color+'">'+ph.id+'</span>'
        + '</div>';
    }
    h += '</div>';
    // Sticky footer: explicit Maximize button
    h += '<button class="sidebar-mini-max" onclick="maximizeSidebar()" title="Maximize sidebar" aria-label="Maximize sidebar">\u00BB</button>';
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
  h+='<div class="sidebar-home'+(currentPage==='readiness'?' active':'')+'" onclick="go(\'readiness\')">Overview</div>';
  for(var i=0;i<PH.length;i++){
    var ph=PH[i];
    var isPhaseActive=(currentPage==='phaseHome'&&String(currentStep)===String(ph.id))||(currentPage==='phase5'&&ph.id===5);
    var navOpenThis=!!(UI.navOpenSet&&UI.navOpenSet[String(ph.id)]);
    h+='<div class="sidebar-phase-group">';
    h+='<div class="sidebar-phase-head" onclick="goPhase('+ph.id+')">';
    h+='<div class="sidebar-phase-dot" style="background:'+ph.color+'"></div>';
    h+='<span class="sidebar-phase-name" style="color:'+(isPhaseActive?'var(--paper)':'color-mix(in srgb, '+ph.color+' 58%, var(--paper))')+'">'+ph.id+'. '+ph.name+'</span>';
    h+='<span class="sidebar-phase-days">'+ph.days+'</span>';
    h+='<span class="sidebar-phase-tog" onclick="event.stopPropagation();toggleNavPhase('+ph.id+')" title="'+(navOpenThis?'Collapse':'Expand')+'" style="cursor:pointer;color:color-mix(in srgb, '+ph.color+' 58%, var(--paper));font-family:var(--mono);font-size:13px;opacity:.9;padding:2px 6px;margin-left:2px;user-select:none">'+(navOpenThis?'\u25BE':'\u25B8')+'</span>';
    h+='</div>';
    if(navOpenThis){
      // Module-specific (Executive Readiness): the per-phase individual step is
      // pulled out of the main list into the Leadership Development strand below.
      var _indivMap={'1.4':1,'2.4':1,'3.5':1,'4.4':1};
      var indivStep=null;
      for(var j=0;j<ph.steps.length;j++){
        var s=ph.steps[j];
        if(_indivMap[s.id]){indivStep=s;if(ph.id<5)continue;}
        if(s.id==='5.3')continue;
        var isActive=(currentPage==='step'&&currentStep===s.id)||(currentPage==='phase5'&&s.id==='5.1');
        var isDone=isStepDone(s.id);
        var cls='sidebar-step'+(isActive?' active':isDone?' done':'');
        h+='<div class="'+cls+'" onclick="go(\''+(s.id==='5.1'?'phase5':s.id)+'\')">'+(isDone&&!isActive?'':s.icon+' ')+s.id+' '+s.name+'</div>';
      }
      if(indivStep&&ph.id<5){
        h+='<div class="sidebar-outcomes-label">Leadership Development</div>';
        var ivActive=(currentPage==='step'&&currentStep===indivStep.id);
        var ivDone=isStepDone(indivStep.id);
        var ivCls='sidebar-step'+(ivActive?' active':ivDone?' done':'');
        h+='<div class="'+ivCls+'" onclick="go(\''+indivStep.id+'\')">'+(ivDone&&!ivActive?'':'\u25C8 ')+indivStep.id+' '+indivStep.name+'</div>';
      }
      if(ph.id===5){
        h+='<div class="sidebar-outcomes-label">Leadership Development</div>';
        var ldevActive=(currentPage==='step'&&currentStep==='5.3');
        var ldevDone=isStepDone('5.3');
        var ldevCls='sidebar-step'+(ldevActive?' active':ldevDone?' done':'');
        h+='<div class="'+ldevCls+'" onclick="go(\'5.3\')">'+(ldevDone&&!ldevActive?'':'\u25C8 ')+'5.3 My Development</div>';
      }
      if(ph.outcomes&&ph.outcomes.length>0){
        var outOpen=navOutputsOpen(ph);
        h+='<div class="sidebar-outcomes-label sidebar-outcomes-fold" onclick="event.stopPropagation();toggleNavOutputs('+ph.id+')" style="cursor:pointer;user-select:none" title="'+(outOpen?'Hide the outputs':'Show the outputs')+'">'+(outOpen?'\u25BE':'\u25B8')+' Outputs <span style="opacity:.7">('+ph.outcomes.length+')</span></div>'; /* 12 Sep 2026 (Paul's ruling): the outputs sit behind a fold */
        if(outOpen){
        for(var k=0;k<ph.outcomes.length;k++){
          var o=ph.outcomes[k];
          var isOActive=(currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id;
          h+='<div class="sidebar-outcome'+(isOActive?' active':'')+'" onclick="go(\''+o.id+'\')">\u2192 '+o.name+'</div>';
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

**Nothing to check yet.** This change becomes visible at Step 76.

---

### Step 64 — Add the function that draws the printed Module Management document: the four figures, This Week, the steps by phase with their owners and state, then a page headed Analytics.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderMgmtHub` ends, after its closing `}`.

**Code:**

```js
/* MODULE MANAGEMENT DOCUMENT (Governance, 14 Sep 2026, Paul's ruling; ported to Executive Readiness 16 Sep 2026 on his word): the Track Program page prints as its own document rather than a snapshot of the tab showing. Page one: the four figures; This Week; every shared step by phase with its owners, its due date, and its state. Page two: the burn-up beside the velocity chart; the workload by member; the signals. The tab buttons, the due-date fields, and the assignment controls do not print. ER's one difference: the individual-track steps, which never enter the shared program, are left out as mgSteps leaves them out */
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

**Nothing to check yet.** This change becomes visible at Step 79.

---

### Step 65 — Replace the function that prints the Module Management page, so that it prints the Module Management document.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printMgmtAnalytics`.

**Code:**

```js
function printMgmtAnalytics(){printDocument('Module Management',mgmtHubDoc(),'')} /* 14 Sep 2026 (Governance, Paul's ruling), ported 16 Sep 2026: the Track Program page prints as its own document */
```

**Nothing to check yet.** This change becomes visible at Step 79.

---

### Step 66 — Replace the function that prints a page as a document with a first page, so that it uses the shared first-page function.

**Kind:** Replace existing code.

**Where:** Replace the whole function named `printPage`.

**Code:**

```js

function printPage(title,contentFn){var raw=contentFn();printDocument(title,printDocCover(title,_pdLead(raw),'')+_pdStrip(raw),'')} /* 12 Sep 2026 (Paul's ruling; family): a cover, the body without its heading block and without controls, the copyright footer on every page */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 67 — Add the function that opens the print window. It can now show a document without opening the print dialog.

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

**Check:** Open Phase 5, step 5.2 (L&D Hub) and click ▾ Save as PDF. The first page is titled L&D Hub. The next page is turned sideways and shows the Competency Heat Map with every leader and all seven competencies visible; the pages after it are upright and are headed Study Progress and Practice Health. Each of the three pages carries the small heading L&D HUB, with no "1 of 3".

---

### Step 68 — Add the function that draws a step's page: its body, and the Save as PDF control above it on the Phase 5 pages.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
if(!_bootDone){
```

**Code:**

```js


function renderStepContent(id){var h=renderStepContentBody(id);return isPhase5Step(id)?printBar()+h:h} /* 12 Sep 2026 (Paul's ruling): the print option on every Phase 5 page */
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 69 — Add the function that draws the Leadership Dashboard page from its body function.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderStepContent` ends, after its closing `}`.

**Code:**

```js
function renderDashboard(){return renderDashboardBody()} /* 12 Sep 2026 (Paul's ruling): the print option on the dashboard; 16 Sep 2026 (Paul's ruling): it lives in the toolbar, beside the Summary / Full toggle, so the separate bar goes */
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 70 — Add the function that draws the Save as PDF control at the top of a Phase 5 page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `renderDashboard` ends, after its closing `}`.

**Code:**

```js

/* PRINT OPTION on every Phase 5 page and every dashboard (Paul's ruling, 12 Sep 2026; family): a Save as PDF control at the top of each such page prints it as a document — cover, body without controls, the copyright footer */
function printBar(){return UI._printing?'':'<div class="print-bar" style="display:flex;justify-content:flex-end;margin:0 0 10px">'+btn('\u25BE Save as PDF','printCurrentPage()','bg2','font-size:12px')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 71 — Add the function that says whether a step identifier belongs to Phase 5.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printBar` ends, after its closing `}`.

**Code:**

```js
function isPhase5Step(id){var p=null;PH.forEach(function(x){if(x.id===5)p=x});return !!(p&&p.steps.some(function(s){return s.id===id}))}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 72 — Add the function that gives a step's name from its identifier.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `isPhase5Step` ends, after its closing `}`.

**Code:**

```js
function stepNameOf(id){var nm=id;PH.forEach(function(p){p.steps.forEach(function(s){if(s.id===id)nm=s.name})});return nm}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 73 — Add the function that removes the Save as PDF control and every button from a page's markup before it prints.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `stepNameOf` ends, after its closing `}`.

**Code:**

```js
function _pbStrip(body){return String(body).replace(/<div class="print-bar"[\s\S]*?<\/div>/,'').replace(/<button[\s\S]*?<\/button>/g,'')}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 74 — Add the function behind a Phase 5 page's Save as PDF button. Steps 5.1 and 5.3 now print their own documents.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_pbStrip` ends, after its closing `}`.

**Code:**

```js
function printCurrentPage(){
  var dash=(currentPage==='phase5');var id=dash?'5.1':currentStep;var title=stepNameOf(id);
  if(!dash&&id==='5.2'){printLdevHubReport();return} /* L&D HUB REPORT (Paul's ruling, 13 Sep 2026): the hub prints its own document */
  if(dash||id==='5.1'){printDocument('Leadership Structure',erDashboardDoc(),'');return} /* 14 Sep 2026 (Paul's ruling): the dashboard prints as its own document */
  if(id==='5.3'){printDocument('My Development',myDevDoc(),'');return} /* 14 Sep 2026 (Paul's ruling): My Development prints as its own document */
  UI._printing=1;var body='';try{body=dash?renderDashboardBody():renderStepContentBody(id)}finally{UI._printing=0}
  printPage(title,function(){return body});
}
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 75 — Add the function that opens or closes a phase's Outputs line in the sidebar.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printCurrentPage` ends, after its closing `}`.

**Code:**

```js

/* SIDEBAR OUTPUTS FOLD (Paul's ruling, 12 Sep 2026; family): a phase's outputs sit behind one folded line beneath its steps, so the sidebar stays uncramped and the list of outputs can grow. The fold opens when the user clicks it, and opens itself while one of its outputs is the page being viewed. */
function toggleNavOutputs(phId){UI.navOutOpen=UI.navOutOpen||{};UI.navOutOpen[phId]=!UI.navOutOpen[phId];render()}
```

**Nothing to check yet.** This change becomes visible at Step 76.

---

### Step 76 — Add the function that says whether a phase's Outputs line in the sidebar is open.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `toggleNavOutputs` ends, after its closing `}`.

**Code:**

```js
function navOutputsOpen(ph){UI.navOutOpen=UI.navOutOpen||{};if(UI.navOutOpen[ph.id])return true;return (ph.outcomes||[]).some(function(o){return (currentPage==='outcome'&&currentStep===o.id)||currentPage===o.id})}
```

**Check:** Open the sidebar and open Phase 1. Under its four steps one line reads ▸ Outputs (3). Click it: the three outputs appear beneath it. Open Phase 2: its outputs sit behind ▸ Outputs (3) the same way. Open the More menu and choose Report Manager: the sidebar and its ☰ toggle stay visible.

---

### Step 77 — Add the empty constant that will hold the record descriptions for leaders and leadership risks.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `navOutputsOpen` ends, after its closing `}`.

**Code:**

```js

/* ═══ REPORTING ENGINE (family code, copied from the Governance build 14 Sep 2026; Spec Rev A). Layered records: each record type declares a layer map; every layer has a summary and a full rendering; a layer is live when it has content and no later superseding layer does; renderings are additive; a register prints identity plus the summary of every live layer up to its own phase; each record ends with a missing-layers line. Output side only. ═══ */
var LAYER_MAPS={};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 78 — Add the function that makes a printed value begin with a capital letter.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LAYER_MAPS` ends.

**Code:**

```js
function lyCap(t){t=String(t);if(!t||/^(https?:\/\/|www\.)/.test(t)||t.indexOf('@')>=0||/^[a-z]+-[a-z0-9-]*\d/.test(t))return t;return t.charAt(0).toUpperCase()+t.slice(1)} /* 13 Sep 2026 (Paul's ruling): a printed value begins with a capital, unless it is a URL, an email, or an id */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 79 — Add the function that prints a stored date as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyCap` ends, after its closing `}`.

**Code:**

```js
function lyDate(v){var d=(typeof v==='number')?new Date(v):new Date(String(v));return isNaN(d)?String(v||''):d.toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
```

**Check:** Open the More menu and choose Track Program. Click ▾ Save as PDF. The first page is titled Module Management. The next page shows four figures (steps complete, day of the 90, steps against ideal pace, overdue), a section This Week, and a section Assignments listing the steps of Phases 1 to 4 with their owners and state; the individual steps 1.4, 2.4, 3.5, and 4.4 are not listed. The page after is headed Analytics with two charts side by side, a workload chart, and Signals. No button prints.

---

### Step 80 — Add the function that prints a stored value as words.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyDate` ends, after its closing `}`.

**Code:**

```js
function lyText(v){ /* any value to plain text */
  if(v==null)return '';if(Array.isArray(v))return v.map(lyText).filter(Boolean).join('; ');
  if(typeof v==='object')return Object.keys(v).map(function(k){return v[k]}).map(lyText).filter(Boolean).join('; ');
  return String(v).trim()}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 81 — Add the function that decides which parts of a record have content to print.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyText` ends, after its closing `}`.

**Code:**

```js
function lyLive(map,rec,upto){ /* the live layers, in stage order, up to and including layer index upto (all when upto is null) */
  var present=map.layers.map(function(l){try{return !!l.present(rec)}catch(e){return false}});
  return map.layers.filter(function(l,i){if(upto!=null&&i>upto)return false;if(!present[i])return false;
    return !map.layers.some(function(m,j){return m.supersedes===l.id&&present[j]})})}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 82 — Add the function that writes the line naming what a record is missing.

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

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 83 — Add the function that prints one labelled row of a record.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyMissing` ends, after its closing `}`.

**Code:**

```js
function lyRow(label,value,indent){var t=lyCap(lyText(value));return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?esc(t):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 84 — Add the function that prints a list of items as labelled rows.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRow` ends, after its closing `}`.

**Code:**

```js
function lyList(label,items,fmt){ /* a list field: one row per item, the label on the first; a formatter may return lines separated by <br>, which print as lines */
  if(!items||!items.length)return lyRow(label,'');var h='';items.forEach(function(it,i){var v=fmt?fmt(it,i):it;h+=lyRowHtml(i===0?label:'',v,i>0)});return h}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 85 — Add the function that prints a labelled row containing HTML.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyList` ends, after its closing `}`.

**Code:**

```js
function lyRowHtml(label,value,indent){var t=(typeof value==='string')?value:lyText(value);var parts=t.split('<br>').map(function(x){return esc(lyCap(x))});return '<tr><td style="width:34%;padding:5px 10px 5px '+(indent?'26px':'10px')+';vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">'+esc(label)+'</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;color:#111;line-height:1.5;border-bottom:1px solid #eee">'+(t?parts.join('<br>'):'<span style="color:#999">Not recorded</span>')+'</td></tr>'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 86 — Add the function that prints one whole record as a table.

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

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 87 — Add the function that prints a list of records under group headings.

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

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 88 — Add the function that collects what a set of records is missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyRegister` ends, after its closing `}`.

**Code:**

```js
function lyGaps(type,records,upto){var out=[];var map=LAYER_MAPS[type];if(!map)return out;records.forEach(function(r){var m=lyMissing(map,r,upto);if(m.length)out.push({title:map.identity(r).title,lines:m})});return out}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 89 — Add the function that shows the same record tables on screen, in the screen's colors.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyGaps` ends, after its closing `}`.

**Code:**

```js
function lyScreenRegister(type,records,depth,upto,groups){var h=lyRegister(type,records,depth,upto,groups);return '<div class="ly-screen" style="font-size:13px">'+h.replace(/color:#111/g,'color:var(--paper)').replace(/color:#555/g,'color:var(--text-muted)').replace(/color:#333/g,'color:var(--text-muted)').replace(/color:#666/g,'color:var(--text-faint)').replace(/background:#fff/g,'background:transparent').replace(/border-bottom:2px solid #111/g,'border-bottom:2px solid rgba(var(--fg-rgb),.5)').replace(/border-bottom:1px solid #111/g,'border-bottom:1px solid rgba(var(--fg-rgb),.4)').replace(/border-bottom:1px solid #eee/g,'border-bottom:1px solid rgba(var(--fg-rgb),.08)')+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 90 — Add the function that draws the Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyScreenRegister` ends, after its closing `}`.

**Code:**

```js
function lyDepthCtl(){var d=(UI.printDepth||'summary');return '<span style="display:inline-flex;gap:4px;align-items:center;margin-right:8px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint)">DEPTH</span>'+['summary','full'].map(function(k){return '<button class="btn-ghost" style="font-size:11px;padding:3px 9px;'+(d===k?'background:rgba(var(--fg-rgb),.10);color:var(--paper)':'')+'" onclick="UI.printDepth=\''+k+'\';render()">'+(k==='summary'?'Summary':'Full')+'</button>'}).join('')+'</span>'} /* Round 2: the depth control the outputs and the print share */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 91 — Add the constant listing the seven leadership competencies.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lyDepthCtl` ends, after its closing `}`.

**Code:**

```js

/* ── EXECUTIVE READINESS: the leader (family model, Spec Rev A; maps proposed 14 Sep 2026 for Paul's correction from printouts) ── */
var LEADER_COMPS=[{id:'orchestration',name:'AI Orchestration'},{id:'philosophical',name:'Philosophical & Ethical Reasoning'},{id:'hybrid',name:'Hybrid Team Leadership'},{id:'change',name:'Change & Transformation'},{id:'composure',name:'Composure & Adaptive Judgment'},{id:'ecosystem',name:'Ecosystem Stewardship'},{id:'emotional',name:'Emotional Intelligence'}];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 92 — Add the constant naming the seven monthly reviews.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LEADER_COMPS` ends.

**Code:**

```js
var LEADER_PRACTICES={slowLog:'Slow-thinking log',stopReview:'Stop review',depScan:'Dependency scan',reverseAudit:'Reverse audit',valuesReview:'Values review',concernCircle:'Concern circle',commitments:'Commitments'};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 93 — Add the constant that turns a stored review judgment into words.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LEADER_PRACTICES` ends.

**Code:**

```js
var REVIEW_LABELS={developed:'Developed',progressing:'Progressing',support:'Needs Support',hard:'Hard Conversation'};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 94 — Add the description of a leader record: its first row and its five parts.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `REVIEW_LABELS` ends.

**Code:**

```js
LAYER_MAPS.leader={
  identity:function(l){var scope={org:'Organization-wide',function:'Function',team:'Team'}[l.scope]||(l.scope?lyCap(l.scope):'');return {title:l.name||'Unnamed leader',score:'',meta:[l.role||'',scope,l.engagement?'Engagement: '+lyCap(l.engagement):'',l.bandwidth?'Bandwidth: '+lyCap(l.bandwidth):''].filter(Boolean)}},
  layers:[
   {id:'landscape',title:'Leadership landscape',stage:'1.2',present:function(l){return !!(l.fluency||l.engagement||l.bandwidth||l.changeExp)},fields:[
     {label:'AI fluency, self-rated',get:function(l){return l.fluency?l.fluency+'/5':''},summary:true},
     {label:'Change experience',get:function(l){return l.changeExp}}]},
   {id:'competency',title:'Competency scores',stage:'2.3',present:function(l){var sc=(data.competencyFramework||{}).scores||{};return LEADER_COMPS.some(function(c){return sc[l.id+'_'+c.id]})},fields:[
     {label:'Average score',get:function(l){var sc=(data.competencyFramework||{}).scores||{};var v=LEADER_COMPS.map(function(c){return +sc[l.id+'_'+c.id]||0}).filter(Boolean);return v.length?(v.reduce(function(a,b){return a+b},0)/v.length).toFixed(1)+'/5 across '+v.length+' of 7 competencies':''},summary:true},
     {label:'Lowest score',get:function(l){var sc=(data.competencyFramework||{}).scores||{};var lo=null;LEADER_COMPS.forEach(function(c){var v=+sc[l.id+'_'+c.id]||0;if(v&&(!lo||v<lo.v))lo={v:v,n:c.name}});return lo?lo.n+' \u2014 '+lo.v+'/5':''},summary:true},
     {label:'Scores',get:function(l){var sc=(data.competencyFramework||{}).scores||{};return LEADER_COMPS.map(function(c){var v=+sc[l.id+'_'+c.id]||0;return c.name+' \u2014 '+(v?v+'/5':'Not scored')})},list:true}]},
   {id:'fluency',title:'AI fluency sprint',stage:'3.1',present:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id];return !!(t&&(t.task1||t.task2||t.task3))},fields:[
     {label:'Tasks completed',get:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id]||{};var n=['task1','task2','task3'].filter(function(k){return t[k]}).length;return n?n+' of 3':''},summary:true},
     {label:'Tasks',get:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id]||{};return ['task1','task2','task3'].map(function(k){return t[k]}).filter(Boolean)},list:true}]},
   {id:'review',title:'First leadership review',stage:'4.3',present:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id];return !!(r&&(r.assessment||r.notes||r.fluency))},fields:[
     {label:'Assessment',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return REVIEW_LABELS[r.assessment]||(r.assessment?lyCap(r.assessment):'')},summary:true},
     {label:'AI fluency at review',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return r.fluency?r.fluency+'/5'+(l.fluency?' (self-rated '+l.fluency+'/5 at the landscape)':''):''},summary:true},
     {label:'Change leadership at review',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return r.change?r.change+'/5':''}},
     {label:'Philosophical reasoning at review',get:function(l){var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return r.philosophical?r.philosophical+'/5':''}},
     {label:'Notes',get:function(l){return (((data.leadershipReview||{}).leaders||{})[l.id]||{}).notes}}]},
   {id:'development',title:'Development',stage:'5',present:function(l){var d=(data.indivDone||{})[l.id];var p=l.userId?(data.practiceLog||{})[l.userId]:null;return !!((d&&Object.keys(d).length)||(p&&Object.keys(p).length))},fields:[
     {label:'Development items completed',get:function(l){var d=(data.indivDone||{})[l.id]||{};var n=Object.keys(d).filter(function(k){return d[k]}).length;return n?n+' item'+(n===1?'':'s'):''},summary:true},
     {label:'Practices logged this period',get:function(l){var p=l.userId?((data.practiceLog||{})[l.userId]||{}):{};var n=Object.keys(p).length;return n?n+' of 7':''},summary:true},
     {label:'Practices',get:function(l){var p=l.userId?((data.practiceLog||{})[l.userId]||{}):{};return Object.keys(p).map(function(k){return (LEADER_PRACTICES[k]||lyCap(k))+' \u2014 '+lyDate(p[k])})},list:true}]}
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 95 — Add the constant that numbers the parts of a leader record.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
LAYER_MAPS.leader={
```

**Code:**

```js
var LEADER_LAYER_INDEX={landscape:0,competency:1,fluency:2,review:3,development:4};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 96 — Add the record description used by the Fluency Assessment: a leader's identity and one part, the AI fluency sprint, with Task 1, Task 2, and Task 3.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LEADER_LAYER_INDEX` ends.

**Code:**

```js
LAYER_MAPS.leaderFluency={identity:LAYER_MAPS.leader.identity,layers:[{id:'fluency',title:'AI fluency sprint',stage:'3.1',present:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id];return !!(t&&(t.task1||t.task2||t.task3))},fields:[{label:'Task 1',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task1},summary:true},{label:'Task 2',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task2},summary:true},{label:'Task 3',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task3},summary:true}]}]}; /* 16 Sep 2026 (Paul's ruling; a particular rule of the Fluency Assessment): the document outputs what Step 3.1 gathers — each leader's three tasks as written, under the leader's identity line — and does not repeat the landscape and competency layers, which belong to the Inventory and the Competency Framework. One form: every field is the information */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 97 — Add the constant giving each of the seven leadership risks its name.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
LAYER_MAPS.leaderFluency={identity:LAYER_MAPS.leader.identity,layers:[{id:'fluency',title:'AI fluency sprint',stage:'3.1',present:function(l){var t=((data.fluencySprint||{}).leaderTasks||{})[l.id];return !!(t&&(t.task1||t.task2||t.task3))},fields:[{label:'Task 1',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task1},summary:true},{label:'Task 2',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task2},summary:true},{label:'Task 3',get:function(l){return (((data.fluencySprint||{}).leaderTasks||{})[l.id]||{}).task3},summary:true}]}]}; /* 16 Sep 2026 (Paul's ruling; a particular rule of the Fluency Assessment): the document outputs what Step 3.1 gathers — each leader's three tasks as written, under the leader's identity line — and does not repeat the landscape and competency layers, which belong to the Inventory and the Competency Framework. One form: every field is the information */
```

**Code:**

```js
/* ── EXECUTIVE READINESS: the leadership risk (Step 1.3; the seven scenarios' names are the screen's own) ── */
var LRISK_NAMES={zillow:'Deploying Without Readiness',calstate:'Transformation Without Engagement',aircanada:'AI Without Boundaries',cigna:'Eliminating Human Judgment',stigma:'Cultural Readiness Failure',disruption:'Competitive Disruption',fatigue:'Change Fatigue'};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 98 — Add the function that adds a risk's three scores together.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `LRISK_NAMES` ends.

**Code:**

```js
function lriskTotal(r){return (+r.likelihood||0)+(+r.impact||0)+(+r.timeHorizon||0)}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 99 — Add the function that says whether a risk is Critical, Moderate, or Low.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lriskTotal` ends, after its closing `}`.

**Code:**

```js
function lriskBand(r){var t=lriskTotal(r);return t>10?'Critical':t>5?'Moderate':'Low'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 100 — Add the description of a leadership risk record.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `lriskBand` ends, after its closing `}`.

**Code:**

```js
LAYER_MAPS.lrisk={
  identity:function(r){var t=lriskTotal(r);return {title:LRISK_NAMES[r.id]||r.id||'Unnamed risk',score:t?t+'/15':'',meta:[t?lriskBand(r):''].filter(Boolean)}},
  layers:[
   {id:'screen',title:'Risk screen',stage:'1.3',present:function(r){return lriskTotal(r)>0||!!r.notes},fields:[
     {label:'Likelihood',get:function(r){return r.likelihood?r.likelihood+'/5':''},summary:true},
     {label:'Impact',get:function(r){return r.impact?r.impact+'/5':''},summary:true},
     {label:'Time horizon',get:function(r){return r.timeHorizon?r.timeHorizon+'/5':''},summary:true},
     {label:'Notes',get:function(r){return r.notes||data['risk_'+r.id+'_notes']||''}}]}
  ]};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 101 — Add the constant that maps each output to the function that builds its printed document, and the five functions that build them for the Leadership Inventory, Risk Map, Competency Framework, Fluency Assessment, and Leadership Review Report.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
LAYER_MAPS.lrisk={
```

**Code:**

```js
/* ── the register documents (14 Sep 2026): identity plus the summary of every live layer up to the output's phase; Summary / Full where the two differ ── */
var PRINT_DOCS={
 'out-inventory':function(){var L=data.leaders||[];
   var ln=data.landscapeNotes||{};var notes=(ln.ownershipGap||ln.mmAssessment)?'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111">The Landscape</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid"><tbody>'+lyRow('Transformation ownership gap',ln.ownershipGap)+lyRow('Middle management assessment',ln.mmAssessment)+'</tbody></table>':'';
   return printDocCover('Leadership Inventory','The organization chart; then every leader in the landscape \u2014 role, scope, engagement, bandwidth, self-rated AI fluency, and change experience \u2014 and the ownership gap and the middle-management assessment.','')+erOrgChartPage('')+'<div style="break-before:page;page-break-before:always">'+erHead('At a Glance','')+erFigRow((function(f){return [{v:f.total,l:'Leaders Mapped',col:'#2D5A8E',vcol:'#2D5A8E'},{v:f.avgFluency,l:'Avg AI Fluency',col:'#1B6B5A',vcol:'#1B6B5A'},{v:f.active+'/'+f.total,l:'Actively Engaged',col:f.active>=f.total/2?'#1B6B5A':'#4E7FA6'},{v:f.overloaded,l:'Stretched/Overloaded',col:f.overloaded>f.total/2?'#9B2D3F':'#1B6B5A',vcol:f.overloaded>f.total/2?'#9B2D3F':'#111'}]})(inventoryFigs()))+'<div style="height:16px"></div>'+erHead('The Leaders','')+lyRegister('leader',L,'full',LEADER_LAYER_INDEX.landscape)+notes+'</div>'}, /* 15 Sep 2026 (Paul's ruling): the four figures at the head of the register, drawn for paper; 16 Sep 2026 (Paul's ruling): a heading of the same weight, The Leaders, over the register, with a gap after the figures; later 16 Sep (Paul's ruling): the organization chart returns as the first page after the cover, now that its paper layout fits the page. 16 Sep 2026 (Paul's ruling): the Reporting Lines page removed — the chart did not print right on its landscape page and is not needed here; the hierarchy prints with the Leadership Structure (5.1) document */
 'out-riskmap':function(){return riskMapDoc()}, /* 15 Sep 2026 (Paul's ruling): composed for paper: the summary figures, then a block per scored risk, highest first */
 'out-competency':function(){var cf=data.competencyFramework||{};var L=data.leaders||[];var depth=(UI.printDepth||'summary');
   var h=printDocCover('Competency Framework','The seven leadership competencies as this organization defines them, and every leader\u2019s scores against them.','');
   h+='<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111">The Competencies</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:auto;page-break-inside:auto"><tbody>';
   LEADER_COMPS.forEach(function(c){h+=lyRow(c.name,(cf.definitions||{})[c.id])});h+='</tbody></table>';
   var gaps=LEADER_COMPS.map(function(c){var v=L.map(function(l){return +((cf.scores||{})[l.id+'_'+c.id])||0}).filter(Boolean);return {name:c.name,avg:v.length?v.reduce(function(a,b){return a+b},0)/v.length:0}}).filter(function(g){return g.avg>0}).sort(function(a,b){return a.avg-b.avg});
   if(gaps.length)h+=erBarBlock('Development Priorities','Lowest average first',gaps.map(function(g,i){return {l:(i+1)+'. '+g.name,v:g.avg,max:5}})); /* the page's ranking, lowest average first; 16 Sep 2026 (Paul's ruling): as bars, not written averages */
   return h+'<div style="break-before:page;page-break-before:always">'+lyRegister('leader',L,depth,LEADER_LAYER_INDEX.competency)+'</div>'}, /* 16 Sep 2026 (Paul's ruling): the leaders start on a new page after the competencies and the priorities */
 'out-fluency':function(){var fl=data.fluencySprint||{};var L=(data.leaders||[]).filter(function(l){var t=(fl.leaderTasks||{})[l.id];return t&&(t.task1||t.task2||t.task3)});
   var h=printDocCover('Fluency Assessment','The team project, its workflow and the judgment it protects, and every leader\u2019s sprint tasks.','');
   h+='<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111">The Team Project</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid"><tbody>'+lyRow('Project',fl.project)+lyRow('Workflow',fl.projectWorkflow)+lyRow('The judgment protected',fl.projectJudgment)+'</tbody></table>';
   return h+'<div style="break-before:page;page-break-before:always">'+erHead('Individual Fluency Sprints',L.length+' leader'+(L.length===1?'':'s')+' \u2014 each leader\u2019s three tasks, as written')+lyRegister('leaderFluency',L,'full',0)+'</div>'}, /* 16 Sep 2026 (Paul's ruling): the fluency layer alone, one form, under its own heading; the leaders start on a new page after the team project, as the Competency Framework's do */
 'out-review':function(){var rv=data.leadershipReview||{};var L=(data.leaders||[]).filter(function(l){var r=(rv.leaders||{})[l.id];return r&&(r.assessment||r.notes)});var depth=(UI.printDepth||'summary');
   var h=printDocCover('Leadership Review Report','The first review of leadership progress and readiness: every leader\u2019s assessment, and what the structure review found.','');
   var part=function(label,col,t){t=lyText(t);return '<div style="margin:0 0 12px"><div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:'+col+';margin-bottom:4px">'+label+'</div><div style="font-size:12.5px;line-height:1.55;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'};
   h+=erBlock(erHeadLg('Structural Review','What the review found in the leadership structure')+'<div style="border:2px solid #9B2D3F;border-radius:6px;padding:16px 20px 6px;margin:0 0 24px">'+part('Working Well','#1B6B5A',rv.structWorking)+part('Needs Revision','#9B2D3F',rv.structRevision)+'</div>'); /* 16 Sep 2026 (Paul's ruling): the structural review leads, in the page's form — the red box, the green and red titles — not as labelled rows */
   var counts={developed:0,progressing:0,support:0,hard:0};(data.leaders||[]).forEach(function(l){var a=((rv.leaders||{})[l.id]||{}).assessment||'';if(counts[a]!==undefined)counts[a]++});
   h+=erFigRow([{v:counts.developed,l:'Developed',col:'#1B6B5A',vcol:'#1B6B5A'},{v:counts.progressing,l:'Progressing',col:'#2D5A8E',vcol:'#2D5A8E'},{v:counts.support,l:'Needs Support',col:'#4E7FA6',vcol:'#4E7FA6'},{v:counts.hard,l:'Hard Conversation',col:'#9B2D3F',vcol:'#9B2D3F'}]); /* 16 Sep 2026 (Paul's ruling): the page's stat band, with its colours */
   var lead=erHeadLg('Individual Leader Reviews',L.length+' leader'+(L.length===1?'':'s')+', grouped by assessment'); /* 16 Sep 2026 (Paul's ruling): a step larger than the group headings beneath; later 16 Sep (Paul's ruling): it opens the register's page — the heading, the first group's heading, the first name — never left under the stat band */
   var groups=Object.keys(REVIEW_LABELS).map(function(k){return {name:REVIEW_LABELS[k],list:L.filter(function(l){return ((rv.leaders||{})[l.id]||{}).assessment===k})}});
   var rest=L.filter(function(l){return !REVIEW_LABELS[((rv.leaders||{})[l.id]||{}).assessment]});if(rest.length)groups.push({name:'Not yet assessed',list:rest});
   return h+'<div style="break-before:page;page-break-before:always">'+lead+lyRegister('leader',L,depth,LEADER_LAYER_INDEX.review,groups)+'</div>'}
};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 102 — Add the constant naming the three outputs that offer a Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `PRINT_DOCS` ends.

**Code:**

```js
var DEPTHED_OUTPUTS={'out-competency':1,'out-review':1,'out-values':1}; /* 16 Sep 2026 (Paul's ruling): the Fluency Assessment became one form; the Values Architecture gained depth — Full adds the appendix of each leader's 2.4 reflections */ /* depth is offered where the leader's full rendering is several times its summary; the Risk Map has one form */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 103 — Add the constant listing the five areas of the Assessment Battery and their questions.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `DEPTHED_OUTPUTS` ends.

**Code:**

```js

/* ── the single-record outputs' definitions, one each, read by the page and by its printed document (14 Sep 2026) ── */
var READINESS_CATS=[
    {k:'purpose',name:'Purpose & Clarity',fields:['clarity','aiAlignment','coherence']},
    {k:'fluency',name:'AI Fluency',fields:['foundational','failureModes','costRisk','strategic','handsOn']},
    {k:'change',name:'Change Capacity',fields:['trackRecord','fatigue','middleMgmt','psySafety','learningCulture']},
    {k:'structure',name:'Structure Baseline',fields:['crossCollab','mmRole']},
    {k:'ethical',name:'Ethical Readiness',fields:['identity','evidence','commitments','assumptions']}
  ];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 104 — Add the constant holding the printed names of the Readiness Report's five areas.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `READINESS_CATS` ends.

**Code:**

```js
var READINESS_LABELS={clarity:'Purpose clarity',aiAlignment:'AI-purpose alignment',coherence:'Strategic coherence',foundational:'Foundational understanding',failureModes:'Failure mode awareness',costRisk:'Cost/risk understanding',strategic:'Strategic connection',handsOn:'Hands-on experience',trackRecord:'Track record',fatigue:'Change fatigue',middleMgmt:'Middle mgmt health',psySafety:'Psychological safety',learningCulture:'Learning culture',crossCollab:'Cross-functional collaboration on AI',mmRole:'Middle management role in AI decisions',identity:'Core identity',evidence:'Evidence standards',commitments:'Ethical commitments',assumptions:'Embedded assumptions'}; /* 15 Sep 2026: each readiness question's label as Step 1.1 asks it; a stored key never prints as a label */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 105 — Add the function that turns a readiness score into its printed reading.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `READINESS_LABELS` ends.

**Code:**

```js
function readinessReading(overall){return overall>=4?'Strong foundation. Focus on maintaining momentum.':overall>=2.5?'Mixed readiness. Significant gaps require attention before scaling AI.':'Critical gaps. Address foundational issues before any AI deployment.'} /* the page's three readings, one definition for the page and its document */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 106 — Add the function that works out the five areas of the Readiness Report with their scores and answers.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `readinessReading` ends, after its closing `}`.

**Code:**

```js
function readinessAreas(){var a=data.assessments||{};return READINESS_CATS.map(function(cat){var sub=a[cat.k]||{};var vals=cat.fields.map(function(f){return typeof sub[f]==='number'?sub[f]:0}).filter(function(v){return v>0});return {cat:cat,sub:sub,avg:vals.length?(vals.reduce(function(x,y){return x+y},0)/vals.length):0}})} /* the five areas with their averages, as the page computes them */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 107 — Add the constant listing the Leadership Structure's five sections and their fields.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `readinessAreas` ends, after its closing `}`.

**Code:**

```js
var STRUCTURE_SECTIONS=[
    {id:'ownership',name:'Transformation Ownership',fields:[{k:'ownerModel',l:'Ownership model'},{k:'ownerWho',l:'Owner & authority'},{k:'ownerChange',l:'Changes from current state'}]},
    {id:'board',name:'Board Governance',fields:[{k:'boardStructure',l:'Oversight structure'},{k:'boardExpertiseGaps',l:'Board AI expertise'},{k:'boardDecisions',l:'Decision boundaries'},{k:'boardEducation',l:'Education plan'}]},
    {id:'senior',name:'Senior Leadership Layer',fields:[{k:'seniorDecisionRights',l:'Decision rights'},{k:'seniorAccountability',l:'Accountability structure'},{k:'seniorAlignment',l:'Cross-functional alignment'}]},
    {id:'middle',name:'Middle Management Principles',fields:[{k:'mmAutomate',l:'Automate now'},{k:'mmAugment',l:'Augment now, automate later'},{k:'mmHuman',l:'Human judgment permanent'}]},
    {id:'crossfunc',name:'Cross-Functional Coordination',fields:[{k:'coordMechanism',l:'Coordination mechanism'},{k:'coordCadence',l:'Meeting cadence'},{k:'coordConflict',l:'Conflict resolution'},{k:'coordInfo',l:'Information flows'}]}
  ];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 108 — Add the constant listing the Collaboration Principles' five sections and their fields.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `STRUCTURE_SECTIONS` ends.

**Code:**

```js
var COLLAB_SECTIONS=[
    {id:'touchpoints',name:'Touchpoint Map',fields:[{k:'touchCustomer',l:'Customer-facing'},{k:'touchInternal',l:'Internal workflows'},{k:'touchDecision',l:'Decision support'},{k:'touchAgent',l:'Agent-to-agent'}]},
    {id:'models',name:'Collaboration Models',fields:[{k:'functionModels',l:'Function-to-model mapping',rows:function(cl){var fm=(cl&&cl.functionModels)||[];return fm.length?fm.map(function(f){return {l:f.name||'Unnamed function',v:COLLAB_MODEL_LABELS[f.model]||f.model||''}}):[{l:'Function-to-model mapping',v:''}]}}]}, /* 16 Sep 2026 (Paul's ruling): the section prints what the step collects — one row per function, the model as the option list names it; modelMapping had no input on the step (only the seed wrote it) and is gone */
    {id:'personas',name:'AI Persona Design',fields:[{k:'personaCustomer',l:'Customer-facing personas'},{k:'personaInternal',l:'Internal personas'},{k:'personaBoundaries',l:'Boundaries'}]},
    {id:'aifree',name:'AI-Free Zones',fields:[{k:'aiFreeZones',l:'Human-only domains'},{k:'proprietary',l:'Protected knowledge'},{k:'atrophyRisks',l:'Atrophy risks'}]},
    {id:'translation',name:'Translation Layer',fields:[{k:'translators',l:'Translators'},{k:'transProcesses',l:'Processes'},{k:'transRisks',l:'Proxy risks'}]}
  ];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 109 — Add the constant listing the four decision simulations.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `COLLAB_SECTIONS` ends.

**Code:**

```js
var DECISION_SCENARIOS=[
    {id:'autonomous',name:'The Autonomy Decision',icon:'\u25B7',desc:'When AI outperforms humans on speed and consistency'},
    {id:'workforce',name:'The Workforce Transition',icon:'\u25C8',desc:'When 30% of a department\u2019s work could be automated'},
    {id:'competitor',name:'The Competitive Threat',icon:'\u229F',desc:'When competitors deploy AI and you\u2019re not ready'},
    {id:'ethical',name:'The Ethical Boundary',icon:'\u2299',desc:'When profit conflicts with principles'}
  ];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 110 — Add the constant listing the Operating Rhythm's four groups.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `DECISION_SCENARIOS` ends.

**Code:**

```js
var RHYTHM_GROUPS=[
    {title:'Leadership Meeting Rhythm',color:'#9B2D3F',items:[{k:'agenda',l:'Standing Agenda'},{k:'agendaOwner',l:'Agenda Ownership'}]},
    {title:'Peer Learning',color:'#2D5A8E',items:[{k:'peerStructure',l:'Structure'},{k:'peerAgenda',l:'Agenda'}]},
    {title:'Decision Simulations',color:'#8B5E3C',items:[{k:'simFreq',l:'Frequency'},{k:'simDesign',l:'Scenario Design'}]},
    {title:'External & Board',color:'#6B4C8A',items:[{k:'frontier',l:'Frontier Exposure'},{k:'boardEd',l:'Board Education'}]}
  ];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 111 — Add the constant listing the Evaluation Plan's fields.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RHYTHM_GROUPS` ends.

**Code:**

```js
var EVAL_FIELDS={evaluation:[{k:'indicators',l:'AI-readiness indicators'},{k:'proportion',l:'Evaluation weighting'}],succession:[{k:'bench',l:'Bench assessment'},{k:'benchChanges',l:'Changes needed'},{k:'boardFluency',l:'Board fluency requirements'}]};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 112 — Add the constant naming the three values domains.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `EVAL_FIELDS` ends.

**Code:**

```js
var VALUES_DOMAINS=[{id:'ontological',l:'Ontological'},{id:'epistemological',l:'Epistemological'},{id:'ethical',l:'Ethical'}];
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 113 — Add the constant holding the names of the collaboration models as step 2.2's option list gives them.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `VALUES_DOMAINS` ends.

**Code:**

```js
var COLLAB_MODEL_LABELS={'advisor':'Advisor','augmenter':'Augmenter','autonomous':'Autonomous Agent','competitor':'Competitor','facilitator':'Facilitator'}; /* 16 Sep 2026: the collaboration models as Step 2.2's option list names them; a custom model prints as typed */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 114 — Add the constant that turns the two stored choices of Step 2.1 into the words the user chose.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `COLLAB_MODEL_LABELS` ends.

**Code:**

```js
var STRUCTURE_LABELS={ownerModel:{cito:'Create a Chief Innovation & Transformation Officer role',cao:'Create a Chief AI Officer role',ctro:'Create a Chief Transformation Officer role',expand_cio:'Expand the Chief Information Officer role with explicit cultural/strategic mandate',council:'Create a cross-functional AI Transformation Council',dual:'Dual ownership: technology leader + cultural/strategic leader jointly'},coordMechanism:{council:'AI Transformation Council (cross-functional standing body)',epmo:'Enterprise Portfolio Management Office',matrix:'Matrix reporting for AI leads embedded in functions',rotation:'Leadership rotation through AI-intensive projects',network:'Innovation network model (REINVENT)'}}; /* the stored choices of Step 2.1, printed as their labels */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 115 — Add the function that draws one headed section of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `STRUCTURE_LABELS` ends.

**Code:**

```js
/* ── the single-record documents (14 Sep 2026): a heading per section over labelled rows, in the screen's own words; one form each ── */
function erSection(title,rowsHtml,sub){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+'<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid">'+esc(title)+(sub?' <span style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-left:8px">'+esc(sub)+'</span>':'')+'</div>'+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px;break-inside:auto;page-break-inside:auto"><tbody>'+rowsHtml+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling; family): a block — a heading with its rows — is never split across pages; if it would be, it starts a new page. The block is unsplittable; the table inside stays splittable between rows so a block taller than a page still breaks between rows, never inside one */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 116 — Add the function that draws a section's labelled rows.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erSection` ends, after its closing `}`.

**Code:**

```js
function erRows(obj,fields){return fields.map(function(f){if(f.rows)return f.rows(obj).map(function(r){return lyRow(r.l,r.v)}).join(''); /* 16 Sep 2026: a field may supply its own rows (a list stored on the record) */var v=obj[f.k];var L=(typeof STRUCTURE_LABELS!=='undefined')&&STRUCTURE_LABELS[f.k];if(L&&L[v])v=L[v];return lyRow(f.l,v)}).join('')} /* a stored choice prints as its label */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 117 — Add the function that draws a section heading of a printed document, with its sub-line on its own line beneath the title.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erRows` ends, after its closing `}`.

**Code:**

```js
/* ── documents composed for paper (15 Sep 2026, Paul's ruling): a document is designed from the page's content and laid out for the page; it is never the page's markup passed through ── */
function erHead(title,sub){return '<div class="ly-group" style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:700;color:#111;margin:0 0 12px;padding-bottom:8px;border-bottom:3px solid #111;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* a section heading alone, for sections that are not a table of rows. 16 Sep 2026 (Paul's ruling, from the Values Architecture printout): the sub-line sits on its own line beneath the title, in its mono face, not inline with it */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 118 — Add the function that draws a larger section heading (28px) for documents whose register groups already carry the standard heading.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erHead` ends, after its closing `}`.

**Code:**

```js
function erHeadLg(title,sub){return erHead(title,sub).replace('font-size:24px','font-size:28px')} /* 16 Sep 2026 (Paul's ruling): a section heading a step above the register's group headings (24px), for documents whose groups carry their own */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 119 — Add the function that draws an appendix heading: the word Appendix as the page's heading, with the section's own title beneath it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erHeadLg` ends, after its closing `}`.

**Code:**

```js
function erAppendix(title,sub){return erHeadLg('Appendix','')+'<div style="font-family:var(--serif,Georgia,serif);font-size:20px;font-weight:700;color:#111;margin:0 0 12px;break-after:avoid;page-break-after:avoid"><div>'+esc(title)+'</div>'+(sub?'<div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">'+esc(sub)+'</div>':'')+'</div>'} /* 16 Sep 2026 (Paul's ruling): an appendix is headed Appendix, with the section's own title beneath — never labelled beside the title; its sub-line beneath the title likewise */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 120 — Add the function that draws a row of figures in boxes at the head of a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erAppendix` ends, after its closing `}`.

**Code:**

```js
function erFigRow(figs){return '<div class="er-figs" style="display:grid;grid-template-columns:repeat('+figs.length+',1fr);gap:10px;margin:0 0 22px;break-inside:avoid;page-break-inside:avoid">'+figs.map(function(f){return '<div style="border:1px solid #ddd;border-top:3px solid '+(f.col||'#111')+';border-radius:6px;padding:10px 8px;text-align:center"><b style="display:block;font-family:var(--serif,Georgia,serif);font-size:28px;font-weight:600;line-height:1.1;color:'+(f.vcol||'#111')+'">'+esc(String(f.v))+'</b><span style="display:block;font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-top:4px">'+esc(f.l)+'</span>'+(f.sub?'<span style="display:block;font-size:10.5px;color:#777;margin-top:2px">'+esc(f.sub)+'</span>':'')+'</div>'}).join('')+'</div>'} /* a row of figures in boxes: the value, its label, an optional line beneath, a coloured rule above */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 121 — Add the function that draws a headed block of bars (label, bar, score) in a printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erFigRow` ends, after its closing `}`.

**Code:**

```js
function erBarBlock(title,sub,rows){var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+erHead(title,sub)+'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+rows.map(function(r){var v=+r.v||0,m=r.max||5;return '<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(r.l)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+Math.round(v/m*100)+'%;background:'+(v?tone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:64px;padding:4px 0 4px 8px;text-align:right;white-space:nowrap;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v.toFixed(1)+' / '+m:'\u2014')+'</td></tr>'}).join('')+'</tbody></table></div>'} /* 16 Sep 2026 (Paul's ruling): a headed block of bars — label · bar · score, the Readiness Report's row form — unsplittable under the block rule */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 122 — Add the function that wraps a piece of a printed document so that it is never split across pages.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erBarBlock` ends, after its closing `}`.

**Code:**

```js
function erBlock(inner){return '<div class="er-block" style="break-inside:avoid;page-break-inside:avoid">'+inner+'</div>'} /* 16 Sep 2026: the block rule as a wrapper — a unit that is never split across pages */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 123 — Add the constant holding the three categories of middle-management work as step 2.1 names them, with their colours.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erBlock` ends, after its closing `}`.

**Code:**

```js
/* ── Middle Management Principles, composed for paper (16 Sep 2026, Paul's page plan): the three categories as a band; the workflows as AI-does / the-manager-does pairs; the decisions that stay human; the log and the evaluation as two panels ── */
var MM_CATEGORIES=[{k:'mmAutomate',l:'Automate now',col:'#9B2D3F'},{k:'mmAugment',l:'Augment now, automate later',col:'#4E7FA6'},{k:'mmHuman',l:'Human judgment permanent',col:'#1B6B5A'}]; /* the three categories of middle-management work as Step 2.1 names them — one definition for the page and the document */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 124 — Add the function that draws the printed Middle Management Principles document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `MM_CATEGORIES` ends.

**Code:**

```js
function mmPrinciplesDoc(){var mm=data.mmActivation||{},st=data.structure||{};var wf=mm.workflows||[],ho=mm.humanOnly||[];
  var h=printDocCover('Middle Management Principles','What middle management automates, augments, and keeps human; the workflows and decisions that follow; and the log and evaluation criteria that hold the new role to account.',wf.length+' workflow'+(wf.length===1?'':'s')+' \u00b7 '+ho.length+' human-only decision'+(ho.length===1?'':'s'));
  var val=function(v,extra){var t=lyText(v);return '<div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+(extra||'')+'">'+esc(t?lyCap(t):'Not recorded')+'</div>'};
  var roleCell=function(label,text,divider){return '<td style="width:50%;vertical-align:top;padding:10px 14px'+(divider?';border-left:1px solid #eee':'')+'"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:4px">'+esc(label)+'</div>'+val(text)+'</td>'}; /* 16 Sep 2026 (Paul's ruling): no coloured bar at the cell's edge — a hairline between the two cells only */
  var panel=function(title,rows){return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:12px 14px"><div style="font-size:13px;font-weight:700;color:#111;margin:0 0 8px">'+esc(title)+'</div>'+rows.map(function(r){return '<div style="margin:0 0 10px"><div style="font-size:11px;color:#555;margin-bottom:2px">'+esc(r[0])+'</div>'+val(r[1],(r[2]&&lyText(r[1]))?';font-family:var(--mono,monospace);font-size:11.5px':'')+'</div>'}).join('')+'</td>'};
  h+=erBlock(erHead('The Three Categories','What middle-management work is automated, augmented, or kept human')+'<table style="width:calc(100% + 24px);margin:0 -12px 22px;border-collapse:separate;border-spacing:12px 0"><tr>'+MM_CATEGORIES.map(function(c){return '<td style="width:33.3%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:10px 12px"><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:6px">'+esc(c.l)+'</div>'+val(st[c.k])+'</td>'}).join('')+'</tr></table>');
  h+=erHead('AI-Augmented Workflows',wf.length?wf.length+' workflow'+(wf.length===1?'':'s')+' \u2014 what AI does, and what the manager does':'');
  h+=wf.length?wf.map(function(w){return erBlock('<div style="border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden"><div style="padding:8px 14px;font-size:13px;font-weight:700;color:#111;border-bottom:1px solid #eee">'+esc(lyCap(lyText(w.name)||'Unnamed workflow'))+'</div><table style="width:100%;border-collapse:collapse"><tr>'+roleCell('AI does',w.aiRole,false)+roleCell('The manager does',w.humanRole,true)+'</tr></table></div>')}).join('')+'<div style="height:10px"></div>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Workflows','')+'</tbody></table>';
  h+=erSection('Decisions That Stay Human',ho.length?ho.map(function(d){var t=lyText(d.reason);return '<tr><td style="width:40%;padding:6px 10px 6px 0;vertical-align:top;font-size:12.5px;font-weight:700;color:#111;border-bottom:1px solid #eee">'+esc(lyCap(lyText(d.decision)||'Unnamed decision'))+'</td><td style="padding:6px 0 6px 10px;vertical-align:top;font-size:12.5px;line-height:1.5;border-bottom:1px solid #eee;color:'+(t?'#333':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</td></tr>'}).join(''):lyRow('Decisions',''),ho.length?ho.length+' decision'+(ho.length===1?'':'s')+' \u2014 and why each stays human':'');
  h+=erBlock(erHead('Log and Evaluation','How AI use is recorded, and how managers are now assessed')+'<table style="width:calc(100% + 24px);margin:0 -12px 22px;border-collapse:separate;border-spacing:12px 0"><tr>'+panel('The AI Use Log',[['Template',mm.logTemplate,true],['Review cadence',mm.logCadence]])+panel('Evaluating Managers',[['Criteria',mm.evalCriteria],['Success metrics',mm.evalMetrics]])+'</tr></table>');
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 125 — Add the constant holding the one-line description of each values domain, as step 3.4 gives them.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `mmPrinciplesDoc` ends, after its closing `}`.

**Code:**

```js
/* ── Values Architecture, composed for paper (16 Sep 2026, Paul's page plan): the commitments lead; the principles by domain, numbered continuously; the roles that carry each principle; the embedding and the AI Purpose Filter; the divergences; at Full depth, an appendix of each leader's Step 2.4 reflections ── */
var VALUES_DOMAIN_GLOSS={ontological:'What things are \u2014 identity, nature, categories',epistemological:'What counts as evidence and knowledge',ethical:'What we value and where we draw lines'}; /* the domains' glosses as Step 3.4's selector gives them */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 126 — Add the constant holding the labels of the five step 2.4 reflection questions, as step 3.4 labels them.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `VALUES_DOMAIN_GLOSS` ends.

**Code:**

```js
var MINDSET_REFLECTION_LABELS=[['val1','Ontological (What is your organization?)'],['val2','Ontological (What is your product/service?)'],['val3','Epistemological (What are your evidence standards?)'],['val4','Ethical (What positions survive the 10% test?)'],['val5','Additional reflection']]; /* the Step 2.4 questions as the 3.4 reference labels them */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 127 — Add the function that lists the roles a principle can be tagged to, as step 3.4's tagging tab offers them.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `MINDSET_REFLECTION_LABELS` ends.

**Code:**

```js
function valuesRoleList(){return (data.orgChart||[]).filter(function(r){return r.level!==0||r.id==='crossfunc'})} /* the roles the 3.4 tagging tab offers */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 128 — Add the function that gives the name of the leader who holds a role, for the Values Architecture.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `valuesRoleList` ends, after its closing `}`.

**Code:**

```js
function valuesRoleWho(r){var l=r.occupantLeaderId?(data.leaders||[]).filter(function(x){return x.id===r.occupantLeaderId})[0]:null;return l?l.name:''}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 129 — Add the function that numbers the shared principles continuously in domain order.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `valuesRoleWho` ends, after its closing `}`.

**Code:**

```js
function valuesOrdered(){var ov=data.orgValues||[],out=[],n=0;VALUES_DOMAINS.forEach(function(d){ov.filter(function(v){return v.domain===d.id}).forEach(function(v){out.push({n:++n,v:v,d:d.id})})});ov.filter(function(v){return !VALUES_DOMAINS.some(function(d){return d.id===v.domain})}).forEach(function(v){out.push({n:++n,v:v,d:''})});return out} /* the principles numbered continuously in domain order */
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 130 — Add the function that works out the three figures of the Values Architecture: principles, roles carrying values, principles not yet placed.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `valuesOrdered` ends, after its closing `}`.

**Code:**

```js
function valuesFigures(){var ov=data.orgValues||[],roles=valuesRoleList();var has=function(r,v){return (r.taggedValues||[]).indexOf(v.id)>=0};return {principles:ov.length,roles:roles.length,carrying:roles.filter(function(r){return ov.some(function(v){return has(r,v)})}).length,unplaced:ov.filter(function(v){return !roles.some(function(r){return has(r,v)})}).length}}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 131 — Add the function that lists the leaders who wrote any step 2.4 reflection.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `valuesFigures` ends, after its closing `}`.

**Code:**

```js
function valuesReflectors(){var md=data.mindsetDepth||{};return (data.leaders||[]).filter(function(l){var m=md[l.id];return !!(m&&(m.val1||m.val2||m.val3||m.val4||m.val5))})}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 132 — Add the function that draws the printed Values Architecture document, with its appendix at Full.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `valuesReflectors` ends, after its closing `}`.

**Code:**

```js
function valuesDoc(){var ov=data.orgValues||[],vd=data.valuesDiscussion||{};var depth=(UI.printDepth||'summary');var fig=valuesFigures(),ord=valuesOrdered(),refl=valuesReflectors(),roles=valuesRoleList();
  var h=printDocCover('Values Architecture','The leadership team\u2019s philosophical commitments; its shared principles in three domains and the roles that carry them; how the principles are kept alive in practice and in the adoption of AI tools; and where the team diverged.',ov.length+' principle'+(ov.length===1?'':'s')+' \u00b7 '+fig.carrying+' of '+fig.roles+' roles carry values'+(depth==='full'?' \u00b7 '+refl.length+' leader'+(refl.length===1?'\u2019s':'s\u2019')+' reflections':''));
  var cc=lyText(vd.collectiveCommitments);
  h+=erBlock(erHead('Our Philosophical Commitments','How this leadership team will think about AI')+'<div style="border:1px solid #ddd;border-radius:6px;padding:20px 24px;margin:0 0 24px;font-family:var(--serif,Georgia,serif);font-size:18px;line-height:1.5;white-space:pre-line;color:'+(cc?'#111':'#888')+(cc?'':';font-style:italic')+'">'+esc(cc?lyCap(cc):'Not recorded')+'</div>');
  h+=erHead('Shared Principles',ov.length?ov.length+' principle'+(ov.length===1?'':'s')+' across three domains':'');
  VALUES_DOMAINS.forEach(function(d){var list=ord.filter(function(o){return o.d===d.id});var col='#555'; /* 16 Sep 2026 (Paul's ruling): the document is greyscale; DOMAIN_COL serves the page */h+=erBlock('<div style="margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #ddd"><span style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:'+col+'">'+esc(d.l)+'</span><span style="font-size:11.5px;color:#555;margin-left:10px">'+esc(VALUES_DOMAIN_GLOSS[d.id]||'')+'</span></div>'+(list.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 18px"><tbody>'+list.map(function(o){return '<tr><td style="width:34px;padding:6px 0;vertical-align:top;font-family:var(--mono,monospace);font-size:12px;color:'+col+';border-bottom:1px solid #eee">'+o.n+'</td><td style="padding:6px 0;vertical-align:top;font-size:13px;line-height:1.5;color:#111;border-bottom:1px solid #eee">'+esc(lyCap(lyText(o.v.principle)))+'</td></tr>'}).join('')+'</tbody></table>':'<div style="font-size:12px;color:#888;font-style:italic;margin:0 0 18px">No principles in this domain.</div>'))});
  h+=erBlock(erHead('The Roles That Carry Each Principle','Where the principles are tagged in the leadership structure')+erFigRow([{v:fig.principles,l:'Principles'},{v:fig.carrying+' / '+fig.roles,l:'Roles carrying values'},{v:fig.unplaced,l:'Not yet placed'}])+(ord.length?'<table style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+ord.map(function(o){var rs=roles.filter(function(r){return (r.taggedValues||[]).indexOf(o.v.id)>=0});return '<tr><td style="width:40%;padding:6px 10px 6px 0;vertical-align:top;font-size:12.5px;color:#111;border-bottom:1px solid #eee"><span style="font-family:var(--mono,monospace);font-size:11px;color:#555;margin-right:6px">'+o.n+'</span>'+esc(lyCap(lyText(o.v.principle)))+'</td><td style="padding:6px 0 6px 10px;vertical-align:top;font-size:12.5px;line-height:1.55;color:#111;border-bottom:1px solid #eee">'+(rs.length?rs.map(function(r){var who=valuesRoleWho(r);return esc(r.id==='board'?'Board':(r.name||'Unnamed role'))+(who?' <span style="color:#555">\u00b7 '+esc(who)+'</span>':'')}).join('<br>'):'<span style="color:#888;font-style:italic">Not yet tagged to any role</span>')+'</td></tr>'}).join('')+'</tbody></table>':'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Principles','')+'</tbody></table>'));
  var flt=lyText((data.fluencySprint||{}).filter),mission=((data.assessments||{}).purpose||{}).mission;
  h+=erBlock(erHead('Keeping the Principles Alive','How the principles become practice, and the gate every AI tool passes')+'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 16px"><tbody>'+lyRow('In daily practice',vd.embedding)+'</tbody></table><div style="font-size:13px;font-weight:700;color:#111;margin:0 0 6px">The AI Purpose Filter</div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Our purpose',mission)+'<tr><td style="width:34%;padding:5px 10px 5px 10px;vertical-align:top;font-size:11.5px;color:#555;border-bottom:1px solid #eee">Before adopting an AI tool, we ask</td><td style="padding:5px 10px;vertical-align:top;font-size:12.5px;line-height:1.5;border-bottom:1px solid #eee;white-space:pre-line;color:'+(flt?'#111':'#888')+(flt?'':';font-style:italic')+'">'+esc(flt?lyCap(flt):'Not recorded')+'</td></tr></tbody></table>');
  h+=erSection('Where the Team Diverged',lyRow('Divergences, and what they told the team',vd.divergences));
  if(depth==='full'){h+='<div style="break-before:page;page-break-before:always">'+erAppendix('The Reflections Behind the Principles','Each leader\u2019s answers in Step 2.4, Mindset Depth \u2014 the reference the team synthesized from')+(refl.length?refl.map(function(l){var m=(data.mindsetDepth||{})[l.id]||{};return erBlock('<div style="margin:14px 0 6px;padding-bottom:6px;border-bottom:2px solid #111"><span style="font-size:14px;font-weight:700;color:#111">'+esc(l.name)+'</span><span style="font-size:11.5px;color:#555;margin-left:10px">'+esc(leaderRoleName(l))+'</span></div><table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 18px"><tbody>'+MINDSET_REFLECTION_LABELS.map(function(q){return lyRow(q[1],m[q[0]])}).join('')+'</tbody></table>')}).join(''):'<table class="ly-rec" style="width:100%;border-collapse:collapse;margin:0 0 22px"><tbody>'+lyRow('Reflections','')+'</tbody></table>')+'</div>'} /* Full depth only: Summary omits the appendix */
  return h}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 133 — Add the function that draws the printed Readiness Report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `valuesDoc` ends, after its closing `}`.

**Code:**

```js
function readinessDoc(){ /* the Readiness Report, composed for paper: the overall score and its reading, the five areas as figures, then one block per area with every question's score as a bar */
  var co=data.completedSections||{};var done=['A','B','C','D','E'].filter(function(x){return co[x]}).length;
  var areas=readinessAreas();var scores=areas.map(function(x){return x.avg});var overall=scores.length?scores.reduce(function(x,y){return x+y},0)/scores.length:0;
  var tone=function(v){return v>=4?'#1B6B5A':v>=2.5?'#4E7FA6':'#9B2D3F'};var barTone=function(v){return v>=4?'#1B6B5A':v>=3?'#4E7FA6':'#9B2D3F'};
  var h=printDocCover('Readiness Report','The organization\u2019s readiness at the start of the program: its scores in the five areas of the Assessment Battery, and the overall score.','')+'<div class="rd-doc">';
  h+=erHead('Overall Readiness',done<5?'Assessment Battery complete in '+done+' of 5 sections':'');
  h+='<div style="border:2px solid '+tone(overall)+';border-radius:6px;padding:18px 20px;margin:0 0 18px;text-align:center;break-inside:avoid;page-break-inside:avoid"><div style="font-family:var(--serif,Georgia,serif);font-size:48px;font-weight:600;line-height:1;color:'+tone(overall)+'">'+overall.toFixed(1)+'<span style="font-size:20px;color:#777;font-weight:400"> / 5</span></div><div style="font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#555;margin-top:8px">Overall Readiness Score</div><div style="font-size:13px;color:#333;margin-top:10px">'+esc(readinessReading(overall))+'</div></div>';
  h+=erFigRow(areas.map(function(x){return {v:x.avg?x.avg.toFixed(1):'\u2014',l:x.cat.name,col:x.avg?tone(x.avg):'#bbb',vcol:x.avg?tone(x.avg):'#999'}}));
  if(done<5)return h+'<p style="font-size:13px;color:#555;margin:0 0 18px">The Assessment Battery is complete in '+done+' of 5 sections.</p></div>';
  h+=erHead('The Five Areas','Every question scored 1 to 5');
  areas.forEach(function(x){
    h+='<div style="border:1px solid #ddd;border-radius:6px;padding:14px 16px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid"><div style="display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px"><div style="font-family:var(--serif,Georgia,serif);font-size:18px;font-weight:700;color:#111">'+esc(x.cat.name)+'</div><div style="font-family:var(--mono,monospace);font-size:11px;color:'+tone(x.avg)+'">Average '+(x.avg?x.avg.toFixed(1):'\u2014')+' / 5</div></div><table style="width:100%;border-collapse:collapse"><tbody>';
    x.cat.fields.forEach(function(f){var v=typeof x.sub[f]==='number'?x.sub[f]:0;h+='<tr><td style="width:40%;padding:4px 8px 4px 0;font-size:11.5px;color:#555;border-bottom:1px solid #eee;vertical-align:middle">'+esc(READINESS_LABELS[f]||f)+'</td><td style="padding:4px 8px;border-bottom:1px solid #eee;vertical-align:middle"><div style="height:7px;background:#eee;border-radius:4px"><div style="height:7px;width:'+(v*20)+'%;background:'+(v?barTone(v):'#eee')+';border-radius:4px"></div></div></td><td style="width:44px;padding:4px 0 4px 8px;text-align:right;font-family:var(--mono,monospace);font-size:12px;color:#111;border-bottom:1px solid #eee;vertical-align:middle">'+(v?v+' / 5':'\u2014')+'</td></tr>'});
    h+='</tbody></table>';
    if(x.sub.mission)h+='<div style="margin-top:12px"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin:0 0 3px">Mission statement</div><div style="font-size:12.5px;color:#111;line-height:1.5">'+esc(lyCap(x.sub.mission))+'</div></div>';
    if(x.sub.priorities)h+='<div style="margin-top:10px"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin:0 0 3px">Top 3 strategic priorities</div><div style="font-size:12.5px;color:#111;line-height:1.5;white-space:pre-line">'+esc(lyCap(x.sub.priorities))+'</div></div>';
    h+='</div>'});
  return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 134 — Add the function that draws the printed Risk Map.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `readinessDoc` ends, after its closing `}`.

**Code:**

```js
function riskMapDoc(){ /* the Risk Map, composed for paper: the count of Critical, Moderate, and Low risks, then every scored risk highest first with its three scores and its bar, then the scenarios not yet scored */
  var risks=data.risks||[];var scored=risks.filter(function(r){return lriskTotal(r)>0}).sort(function(a,b){return lriskTotal(b)-lriskTotal(a)});
  var tone=function(t){return t>10?'#9B2D3F':t>5?'#4E7FA6':'#1B6B5A'};
  var counts={Critical:0,Moderate:0,Low:0};scored.forEach(function(r){counts[lriskBand(r)]++});
  var h=printDocCover('Risk Map','The seven leadership risks, scored for likelihood, impact, and time horizon, highest first.','')+'<div class="rm-doc">';
  h+=erHead('Risk Summary',scored.length+' of 7 scenarios assessed');
  h+=erFigRow([{v:counts.Critical,l:'Critical risks',sub:'Score above 10 / 15',col:counts.Critical?'#9B2D3F':'#1B6B5A',vcol:counts.Critical?'#9B2D3F':'#1B6B5A'},{v:counts.Moderate,l:'Moderate',sub:'Score 6 to 10',col:'#4E7FA6',vcol:'#4E7FA6'},{v:counts.Low,l:'Low',sub:'Score 1 to 5',col:'#1B6B5A',vcol:'#1B6B5A'}]);
  if(!scored.length)return h+'<p style="font-size:13px;color:#555;margin:0 0 18px">No risks have been scored yet.</p></div>';
  h+=erHead('Scored Risks','Highest score first');
  scored.forEach(function(r){var t=lriskTotal(r);var col=tone(t);var name=LRISK_NAMES[r.id]||r.id||'Unnamed risk';var notes=r.notes||data['risk_'+r.id+'_notes']||'';
    h+='<div style="border:1px solid #ddd;border-left:4px solid '+col+';border-radius:6px;padding:14px 16px;margin:0 0 14px;break-inside:avoid;page-break-inside:avoid">'
     +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px"><div style="font-family:var(--serif,Georgia,serif);font-size:18px;font-weight:700;color:#111">'+esc(name)+'</div><div style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.06em;color:'+col+'">'+t+' / 15 \u00b7 '+lriskBand(r)+'</div></div>'
     +'<div style="height:8px;background:#eee;border-radius:4px;margin:0 0 10px"><div style="height:8px;width:'+Math.round(t/15*100)+'%;background:'+col+';border-radius:4px"></div></div>'
     +'<table style="width:100%;border-collapse:collapse"><tbody><tr>'+[['Likelihood',r.likelihood],['Impact',r.impact],['Time horizon',r.timeHorizon]].map(function(p){return '<td style="width:33%;padding:4px 0;border:none"><span style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555">'+p[0]+'</span> <span style="font-size:13px;color:#111;margin-left:6px">'+(+p[1]||0)+' / 5</span></td>'}).join('')+'</tr></tbody></table>'
     +(notes?'<div style="font-size:12.5px;color:#333;line-height:1.5;margin-top:8px">'+esc(lyCap(notes))+'</div>':'')+'</div>'});
  var unscored=Object.keys(LRISK_NAMES).filter(function(id){return !scored.some(function(r){return r.id===id})});
  if(unscored.length)h+=erHead('Not Yet Scored',unscored.length+' of 7')+'<table style="width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid"><tbody>'+unscored.map(function(id){return '<tr><td style="padding:5px 10px;font-size:12.5px;color:#111;border-bottom:1px solid #eee">'+esc(LRISK_NAMES[id])+'</td></tr>'}).join('')+'</tbody></table>';
  return h+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 135 — Add the constant holding the functions that build the printed documents for the eight outputs that are one record each.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `riskMapDoc` ends, after its closing `}`.

**Code:**

```js
var ER_SINGLE_DOCS={
 'out-readiness':function(){return readinessDoc()}, /* 15 Sep 2026 (Paul's ruling): composed for paper */
 'out-structure':function(){var st=data.structure||{};var h=printDocCover('Leadership Structure','How the organization has structured its leadership for AI: ownership, board governance, the senior layer, middle management principles, and cross-functional coordination.','');
   STRUCTURE_SECTIONS.forEach(function(sec){h+=erSection(sec.name,erRows(st,sec.fields),st[sec.id+'_done']?'Complete':'')});return h},
 'out-collab':function(){var cl=data.collabLab||{};var h=printDocCover('Collaboration Principles','Where and how people and AI work together in this organization: touchpoints, collaboration models, AI personas, AI-free zones, and the translation layer.','');
   COLLAB_SECTIONS.forEach(function(sec){h+=erSection(sec.name,erRows(cl,sec.fields),cl[sec.id+'_done']?'Complete':'')});return h},
 'out-decisions':function(){var ds=data.decisionSims||{};var h=printDocCover('Decision Analyses','The four decision simulations: the organization\u2019s response to each scenario and the ethical pre-mortem behind it.','');
   var done=DECISION_SCENARIOS.filter(function(sc){return ds[sc.id+'_response']||ds[sc.id+'_premortem']}).length;h+=erHead('The Four Scenarios',done+' of 4 answered');
   var box=function(sc){var r=lyText(ds[sc.id+'_response']),p=lyText(ds[sc.id+'_premortem']);var part=function(label,t,tint){return '<div style="padding:12px 16px;border-top:1px solid #eee'+(tint?';background:#f4f4f4':'')+'"><div style="font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:5px">'+label+'</div><div style="font-size:12.5px;line-height:1.5;color:'+(t?'#111':'#888')+(t?'':';font-style:italic')+'">'+esc(t?lyCap(t):'Not recorded')+'</div></div>'};return '<td style="width:50%;vertical-align:top;border:1px solid #ddd;border-radius:6px;padding:0;overflow:hidden"><div style="padding:14px 16px 10px"><div style="font-size:14px;font-weight:700;color:#111;margin-bottom:3px"><span style="color:#555;margin-right:6px">'+sc.icon+'</span>'+esc(sc.name)+'</div><div style="font-size:11.5px;color:#555;line-height:1.45">'+esc(sc.desc)+'</div></div>'+part('Our response',r,false)+part('Ethical pre-mortem',p,true)+'</td>'};
   [[0,1],[2,3]].forEach(function(pair){h+=erBlock('<table style="width:calc(100% + 16px);margin:0 -8px 8px;border-collapse:separate;border-spacing:8px 0"><tr>'+box(DECISION_SCENARIOS[pair[0]])+box(DECISION_SCENARIOS[pair[1]])+'</tr></table>')});return h}, /* 16 Sep 2026 (Paul's ruling): the page's four boxes kept on paper — two rows of two, each row unsplittable; each box the scenario, the response, the pre-mortem — greyscale, as the other Phase 3 documents were ruled */
 'out-mmprinciples':function(){return mmPrinciplesDoc()}, /* 16 Sep 2026 (Paul's ruling): composed for paper to his page plan */
 'out-values':function(){return valuesDoc()}, /* 16 Sep 2026 (Paul's ruling): composed for paper to his page plan; depth: Full adds the appendix of reflections */
 'out-rhythm':function(){var or_=data.opRhythm||{};var rh=data.rhythm||{};var cad={weekly:'Weekly',fortnightly:'Fortnightly',monthly:'Monthly'};var h=printDocCover('Operating Rhythm','The permanent operating cadence for AI-ready leadership: the leadership meeting, peer learning, decision simulations, and the external and board rhythm.','');
   h+=erSection('Cadence',lyRow('Leadership meeting cadence',cad[rh.cadence]||(rh.cadence?lyCap(rh.cadence):'')));
   RHYTHM_GROUPS.forEach(function(g){h+=erSection(g.title,erRows(or_,g.items))});return h},
 'out-evalplan':function(){var ev=data.evalSuccession||{};var h=printDocCover('Evaluation Plan','How leaders are evaluated and succession is planned for the AI era: the readiness indicators, their weighting, the bench, and the board.','');
   h+=erSection('Evaluation Criteria',erRows(ev,EVAL_FIELDS.evaluation));h+=erSection('Succession Planning',erRows(ev,EVAL_FIELDS.succession));return h}
};
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 136 — Add the statement that registers the single-record documents in the table of printed documents.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `ER_SINGLE_DOCS` ends.

**Code:**

```js
Object.keys(ER_SINGLE_DOCS).forEach(function(k){PRINT_DOCS[k]=ER_SINGLE_DOCS[k]});
```

**Nothing to check yet.** This change becomes visible at Step 137.

---

### Step 137 — Add the function that draws the organization chart alone on a landscape page of a printed document, used by the Leadership Structure and the Leadership Inventory.

**Kind:** Add new code.

**Where:** Add this immediately after the statement that begins with the line reading exactly:

```js
Object.keys(ER_SINGLE_DOCS).forEach(function(k){PRINT_DOCS[k]=ER_SINGLE_DOCS[k]});
```

**Code:**

```js

/* ── PHASE 5 DOCUMENTS (14 Sep 2026): the Leadership Dashboard and My Development print as their own documents ── */
function erOrgChartPage(sectionHead){if(typeof syncCouncilNode==='function')syncCouncilNode();if(typeof syncPhase1Chart==='function')syncPhase1Chart();var roles=data.orgChart||[];if(!roles.length)return '';var layout=layoutOrgTreeForPaper(roles,1000,650);return '<style>.ed-chart{page:edchart;break-before:page;page-break-before:always;width:990px;margin-left:0}.ed-chart svg{display:block;width:100%;max-height:650px;height:auto}@page edchart{size:landscape;margin:8mm 8mm 14mm 8mm}@media print and (max-width:800px){.ed-chart{width:1058px}}</style><div class="ed-chart">'+(sectionHead||'')+erHead('Org Chart','')+orgChartSvgHtml(roles,layout,{paper:true})+'</div>'} /* 16 Sep 2026 (Paul's rulings): the organization chart alone on a landscape page — the paper layout, the block at the page-area edge sized to the sheet (990px Letter, 1058px A4 by print media query) — shared by the Leadership Structure and the Leadership Inventory */
```

**Check (do each):**

1. Open the Operating Rhythm (Phase 4 output) and click ▾ Save as PDF. A new window opens whose first page shows, from the top: the line NEXTCHAPTER · 90-DAY EXECUTIVE READINESS; the title Operating Rhythm; a subtitle; a horizontal rule; the organization's name; today's date as words. The pages after it show the page's content without its heading block and without any button. In the print dialog's preview, every page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number such as 2 / 3 at the bottom right, and nothing at the top corners.

2. Open the Leadership Inventory (Phase 1 output). Below the four figures, each leader is a table: a first row with the name and the role, scope, engagement, and bandwidth, then a section LEADERSHIP LANDSCAPE with labelled rows. Open the Competency Framework (Phase 2 output): the Development Priorities card is at the top, then two small buttons SUMMARY and FULL, then the leaders; click FULL and each leader shows more rows. Open the Fluency Assessment (Phase 3 output): each leader shows Task 1, Task 2, Task 3 and there is no SUMMARY / FULL control. Open the Review Report (Phase 4 output): the leaders are grouped under Developed, Progressing, Needs Support, Hard Conversation.

3. Open the Leadership Inventory and click ▾ Save as PDF. The document runs: the first page; a sideways page headed Org Chart filling the page with the chart, every role title complete; an upright page headed At a Glance with four figures in boxes, then a heading The Leaders and each leader's table; then a section The Landscape. Open the Readiness Report and click ▾ Save as PDF: a large score in a box, then the five areas with bars and answers. Open the Competency Framework and click ▾ Save as PDF: the seven definitions, then Development Priorities as bars with the score on one line (2.3 / 5), then the leaders starting on a new page. Open the Fluency Assessment and click ▾ Save as PDF: The Team Project, then a new page headed Individual Fluency Sprints with each leader's three tasks. Open the Review Report and click ▾ Save as PDF: Structural Review in a red box with Working Well in green and Needs Revision in red; the four counts in coloured boxes; then a new page headed Individual Leader Reviews, then Developed, then the first leader.

4. Open the Leadership Structure (Phase 2 output) and click ▾ Save as PDF: sections headed Governance Model, Decision Rights, and so on, each a heading with labelled rows, and no section split across two pages. Open the Decision Analyses (Phase 3 output) and click ▾ Save as PDF: one heading The Four Scenarios, then four boxes in two rows of two, each with the scenario, Our response, and Ethical pre-mortem, all in greys. Open MM Principles and click ▾ Save as PDF: The Three Categories as three grey boxes side by side, then AI-Augmented Workflows with each workflow's AI does and The manager does side by side, then Decisions That Stay Human, then Log and Evaluation as two panels. Open the Values Architecture: it shows SUMMARY and FULL; click FULL and click ▾ Save as PDF: Our Philosophical Commitments, Shared Principles, The Roles That Carry Each Principle, Keeping the Principles Alive, Where the Team Diverged, then a new page headed Appendix with The Reflections Behind the Principles beneath it. Every section heading's sub-line sits on its own line under the title.

---

### Step 138 — Add the function that draws a role's detail box for paper, with its buttons and its assignment control removed.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erOrgChartPage` ends, after its closing `}`.

**Code:**

```js
function erRoleDetailPrint(r,roles,leaders){var occ=(r.level===1)?null:roleOccupant(r);var h=renderOrgDetail(r,roles,leaders,{print:true});
  h=h.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<select[\s\S]*?<\/select>/g,'<span style="font-size:13px;color:var(--paper);font-weight:600">'+esc(occ?occ.name:'Unassigned')+(occ?' \u00b7 ':'')+'</span>').replace(/ onclick="[^"]*"/g,'').replace(/cursor:pointer;?/g,'');
  return h} /* 16 Sep 2026 (Paul's ruling): a role prints as the page shows it — the detail box in its level's colour — with the Edit and Close buttons gone and the Assigned-to select replaced by the occupant's name */
```

**Nothing to check yet.** This change becomes visible at Step 139.

---

### Step 139 — Add the function that builds the Leadership Dashboard's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erRoleDetailPrint` ends, after its closing `}`.

**Code:**

```js
function erDashboardDoc(opts){opts=opts||{}; /* the Leadership Dashboard (5.1), whose document is titled Leadership Structure (Paul's ruling, 15 Sep 2026). 16 Sep 2026 (Paul's ruling): the cover; Org Chart alone on a landscape page, filling it; at Summary the Role Details table (the legacy window's), at Full one page per role — the page's detail box in its colour, controls removed; the Competency Summary as an appendix on its own last page. The staffing figures and the policies section no longer print here (the cover's count line carries the staffing; the policies print in their own documents). */
  if(typeof syncCouncilNode==='function')syncCouncilNode();if(typeof syncPhase1Chart==='function')syncPhase1Chart();
  var roles=data.orgChart||[],leaders=data.leaders||[];var layout=layoutOrgTreeForPaper(roles,1000,650);var depth=(UI.printDepth||'summary'); /* the paper layout (also drawn by erOrgChartPage) orders the role pages */
  var positionRoles=roles.filter(function(r){return r.id!=='board'&&r.id!=='crossfunc'});var filled=positionRoles.filter(function(r){return roleHasOccupant(r)}).length;
  var css='<style>.ed-doc table{font-size:11.5px}.ed-doc th{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#333;border-bottom:1px solid #111 !important}.ed-doc td{vertical-align:top}.ed-role{break-before:page;page-break-before:always}.ed-role>div{margin-top:0 !important}.ed-role [style*="margin-bottom:20px"]{margin-bottom:12px !important}.ed-role [style*="padding:24px"]{padding:14px 24px 4px !important}.ed-role [style*="padding:20px 24px"]{padding:14px 24px !important}</style>';
  /* the chart page: a landscape page with 8mm side margins. The document body carries no horizontal padding in print (body{margin:0;padding:0}) and is pinned to the page-area edge, so the block starts at margin-left:0 — both 16 Sep prints measured to that. The width follows the sheet: 990px fills a Letter landscape page area (263mm); the print media query reads the sheet's portrait width and, under 800px (A4 is 794px, Letter 816px), widens the block to 1058px for A4's 281mm */
  var h=(opts.noCover?'':printDocCover('Leadership Structure','The leadership structure as it stands: the organization chart, every role '+(depth==='full'?'in full, one to a page':'in summary')+', and every leader\u2019s competency scores.',positionRoles.length+' position'+(positionRoles.length===1?'':'s')+' \u00b7 '+filled+' filled \u00b7 '+leaders.length+' leader'+(leaders.length===1?'':'s')))+css+'<div class="ed-doc">';
  h+=erOrgChartPage(opts.sectionHead||''); /* a compiled report's section heading rides at the top of this page */
  if(depth==='full'){var pos=layout.pos||{};var ordered=roles.slice().sort(function(p,q){var a=pos[p.id]||{x:1e9,y:1e9},b=pos[q.id]||{x:1e9,y:1e9};return (a.y-b.y)||(a.x-b.x)});ordered.forEach(function(r){h+='<div class="ed-role">'+erRoleDetailPrint(r,roles,leaders)+'</div>'})}
  else h+='<div style="break-before:page;page-break-before:always">'+erHead('Role Details',roles.length+' role'+(roles.length===1?'':'s'))+orgRolesTableHtml(roles,leaders)+'</div>';
  h+='<div style="break-before:page;page-break-before:always">'+erAppendix('Competency Summary','Every leader\u2019s seven scores')+competencySummaryTable()+'</div>';
  return h+'</div>'}
```

**Check:** Open Phase 5, step 5.1 (Leadership Dashboard). Click SUMMARY, then ▾ Save as PDF: the first page is titled Leadership Structure; the next is a sideways page headed Org Chart filling the page; then an upright page headed Role Details with a table of every role; then a page headed Appendix with Competency Summary beneath it and every leader's seven scores. Click FULL, then ▾ Save as PDF: after the Org Chart page, one page per role in its coloured box — the Board first — with no Edit or Close buttons, no direct-reports list, and no Tasks to Automate block; each role fits its page; the Appendix page ends the document.

---

### Step 140 — Add the constant listing the seven monthly reviews and what each asks.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `erDashboardDoc` ends, after its closing `}`.

**Code:**

```js
var MY_REVIEWS=[{k:'slowLog',t:'Slow Thinking Log',d:'Record one decision where you deliberately slowed down and exercised independent judgment.'},{k:'stopReview',t:'STOP Technique Review',d:'Revisit your three STOP situations. Are they still the right ones?'},{k:'depScan',t:'Dependency Scan',d:'Update your inventory of skills outsourced to AI.'},{k:'reverseAudit',t:'Skill Atrophy Audit',d:'Check your atrophying skill.'},{k:'valuesReview',t:'Values Architecture Review',d:'Revisit your four commitments. Has anything drifted?'},{k:'concernCircle',t:'AI Concern Circles',d:'Share one fear and one hope.'},{k:'commitments',t:'Philosophical Commitments',d:'Does your personal commitments statement still hold?'}];
```

**Nothing to check yet.** This change becomes visible at Step 141.

---

### Step 141 — Add the function that builds My Development's printed document.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `MY_REVIEWS` ends.

**Code:**

```js
function myDevDoc(){ /* My Development (5.3): the signed-in leader's record, then the seven monthly reviews with their state this month and the date last done. Buttons and the cadence note do not print. */
  var ml=(typeof getMyLeader==='function')?getMyLeader():null;var uid=(typeof currentUserId!=='undefined'&&currentUserId)||'u1';var log=((data.practiceLog||{})[uid])||{};var thisMonth=periodKey(new Date());
  var h=printDocCover('My Development','Your personal leadership development reviews: everything that should be maintained on an ongoing basis, in one place.','');
  if(ml)h+=lyRender('leader',ml,'full',null);else h+='<p style="font-size:13px;color:#666;font-style:italic;margin:0 0 18px">No leader record is linked to this account.</p>';
  var rows=MY_REVIEWS.map(function(r){var last=log[r.k];var done=!!(last&&periodKey(new Date(last))===thisMonth);return lyRow(r.t,(done?'Complete this month':'Incomplete this month')+(last?' \u00b7 last done '+lyDate(last):' \u00b7 not yet done')+'\n'+r.d)}).join('');
  return h+erSection('Monthly Reviews',rows)}
```

**Check (do each):**

1. Open Phase 5, step 5.3 (My Development). At the top of the page is the ▾ Save as PDF button. Click it: the print window shows a first page titled My Development, then the content with no button. Open step 5.1 (Leadership Dashboard): its toolbar shows the buttons SUMMARY and FULL and ▾ Save as PDF, and no Print Org Chart button.

2. Open Phase 5, step 5.1 (Leadership Dashboard). The toolbar under the four figures reads Add Role, Add New Leader, Save, then DEPTH with the buttons SUMMARY and FULL, then ▾ Save as PDF. Click a role box in the chart: its detail box opens; on the Board's box, the block under the committee members is headed BOARD SUMMARY; on the AI Transformation Council's box the block is headed AI TRANSFORMATION COUNCIL SUMMARY.

3. Open Phase 5, step 5.3 (My Development) and click ▾ Save as PDF. The first page is titled My Development and the pages after it show the signed-in leader's development record as labelled rows, with a section Monthly Reviews.

---

### Step 142 — Add the function that draws a text field in the Report Manager.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `myDevDoc` ends, after its closing `}`.

**Code:**

```js

/* ═══ REPORT MANAGER (family code, ported from the Governance build 14 Sep 2026; Spec Rev A §9). A named report definition on the organization holds an ordered list of units — outputs, Phase 5 pages, individual leaders and risks, and text pages the user writes — with a depth where a unit has one and a note per section. The compiled document is one cover, a contents page, the introduction, and each unit as a numbered section. The record is never edited here. ═══ */
function rcInp(label,id,val,ph){return '<div class="mb-4"><label class="form-label">'+esc(label)+'</label><input type="text" id="'+id+'" data-uncapped="1" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:100%"></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 143 — Add the function that draws a plain button in the Report Manager.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcInp` ends, after its closing `}`.

**Code:**

```js
function rcBtnG(label,onclick,style){return '<button class="btn bg2" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 144 — Add the function that draws a filled button in the Report Manager.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcBtnG` ends, after its closing `}`.

**Code:**

```js
function rcBtnS(label,onclick,color,style){return '<button class="btn bp" onclick="'+esc(onclick||'')+'" style="'+(style||'')+'">'+label+'</button>'}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 145 — Add the function the Report Manager uses to print and to preview.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcBtnS` ends, after its closing `}`.

**Code:**

```js
function printDocumentPreview(title,content,opts){printDocument(title,content,'',opts)} /* the Report Manager's print and preview go through the shared window */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 146 — Add the constant naming the Phase 5 pages the Report Manager can include.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `printDocumentPreview` ends, after its closing `}`.

**Code:**

```js
var RC_PAGE_UNITS=[['5.1','Leadership Structure'],['5.2','L&D Hub'],['5.3','My Development']]; /* 16 Sep 2026 (Paul's ruling): the 5.1 section is Leadership Structure, as its document is titled */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 147 — Add the function that gives a report section's name, reading a Phase 5 page's name from the constant so that saved reports follow a renaming.

**Kind:** Add new code.

**Where:** Add this immediately after the constant named `RC_PAGE_UNITS` ends.

**Code:**

```js
function rcUnitName(u){if(u.kind==='page'){var p=RC_PAGE_UNITS.filter(function(x){return x[0]===u.id})[0];if(p)return p[1]}return u.name||(u.kind==='text'?'Untitled page':'')} /* a page unit's name is read live, so a saved report follows a renaming */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 148 — Add the function that lists everything a report can contain.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitName` ends, after its closing `}`.

**Code:**

```js
function rcCatalogue(){var out=[];
  PH.forEach(function(p){if(p.id===5)return;(p.outcomes||[]).forEach(function(o){if(PRINT_DOCS[o.id])out.push({kind:'output',id:o.id,name:o.name,group:'Outputs \u00b7 Phase '+p.id,depths:DEPTHED_OUTPUTS[o.id]?['summary','full']:null})})});
  RC_PAGE_UNITS.forEach(function(x){out.push({kind:'page',id:x[0],name:x[1],group:'Phase 5 pages'})});
  (data.leaders||[]).forEach(function(l){out.push({kind:'record',type:'leader',id:l.id,name:l.name||'Unnamed leader',group:'Individual Leaders',rec:l,sub:l.role||''})});
  (data.risks||[]).filter(function(r){return lriskTotal(r)>0}).sort(function(a,b){return lriskTotal(b)-lriskTotal(a)}).forEach(function(r){out.push({kind:'record',type:'lrisk',id:r.id,name:LRISK_NAMES[r.id]||r.id,group:'Individual Leadership Risks',rec:r,sub:lriskTotal(r)+'/15 \u00b7 '+lriskBand(r)})});
  return out}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 149 — Add the function that names a piece of content's kind.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcCatalogue` ends, after its closing `}`.

**Code:**

```js
function rcKindLabel(u){return u.kind==='output'?'Output':u.kind==='page'?'Phase 5 page':u.kind==='text'?'Text page':u.kind==='record'?(u.type==='leader'?'Individual leader':'Individual leadership risk'):''}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 150 — Add the function that builds one section's content.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcKindLabel` ends, after its closing `}`.

**Code:**

```js
function rcUnitBody(u,lead){ /* the unit's content, no cover, no controls */
  var body='';var wasDepth=UI.printDepth;
  try{
    if(u.kind==='output'){UI.printDepth=u.depth||'full';var fn=PRINT_DOCS[u.id];body=fn?_rcStripCover(fn()):''}
    else if(u.kind==='page'&&u.id==='5.1'){body=erDashboardDoc({noCover:true,sectionHead:lead||''})}
    else if(u.kind==='page'&&u.id==='5.2'){body='<style>'+LDEV_REPORT_CSS+'</style>'+ldevReportBody({sectionHead:lead||''})} /* 16 Sep 2026: no cover built to be stripped; the section heading rides into the first landscape page */
    else if(u.kind==='page'&&u.id==='5.3'){body=_rcStripCover(myDevDoc())}
    else if(u.kind==='record'&&u.type==='leader'){var l=(data.leaders||[]).find(function(x){return x.id===u.id});body=l?lyRender('leader',l,'full',null):'<p style="font-size:13px;color:#666;font-style:italic">This leader is no longer on the record.</p>'}
    else if(u.kind==='record'&&u.type==='lrisk'){var r=(data.risks||[]).find(function(x){return x.id===u.id});body=r?lyRender('lrisk',r,'full',0):'<p style="font-size:13px;color:#666;font-style:italic">This risk is no longer on the record.</p>'}
    else if(u.kind==='text'){body='<div class="rc-text" style="font-size:14px;line-height:1.7;color:#222">'+rcSanitize(u.html||'')+'</div>'}
  }finally{UI.printDepth=wasDepth}
  return rcFirstRecordStays(body)}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 151 — Add the function that collects what a section's records are missing.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitBody` ends, after its closing `}`.

**Code:**

```js
function rcUnitGaps(u){if(u.kind==='record'&&u.type==='leader'){var l=(data.leaders||[]).find(function(x){return x.id===u.id});return l?lyGaps('leader',[l],null):[]}return []} /* the leader and risk maps name no required layers; the list is empty by design */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 152 — Add the function that states a section's size, such as "13 leaders".

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitGaps` ends, after its closing `}`.

**Code:**

```js
function rcUnitFact(u){var n=function(c,w,pl){return c+' '+(c===1?w:(pl||w+'s'))};var L=data.leaders||[];
  if(u.kind==='output'){var rv=(data.leadershipReview||{}).leaders||{};var fl=(data.fluencySprint||{}).leaderTasks||{};var sc=(data.competencyFramework||{}).scores||{};
    return ({'out-inventory':n(L.length,'leader'),'out-riskmap':n((data.risks||[]).filter(function(r){return lriskTotal(r)>0}).length,'risk'),'out-competency':n(L.filter(function(l){return LEADER_COMPS.some(function(c){return sc[l.id+'_'+c.id]})}).length,'leader scored','leaders scored'),'out-fluency':n(L.filter(function(l){var t=fl[l.id];return t&&(t.task1||t.task2||t.task3)}).length,'leader with tasks','leaders with tasks'),'out-review':n(L.filter(function(l){var r=rv[l.id];return r&&(r.assessment||r.notes)}).length,'leader assessed','leaders assessed'),'out-values':n((data.orgValues||[]).length,'principle'),'out-decisions':n(DECISION_SCENARIOS.filter(function(x){var ds=data.decisionSims||{};return ds[x.id+'_response']||ds[x.id+'_premortem']}).length,'scenario')})[u.id]||''}
  if(u.kind==='page')return u.id==='5.1'?n((data.orgChart||[]).length,'role'):u.id==='5.2'?n(L.length,'leader'):'';
  if(u.kind==='record'){if(u.type==='leader'){var l=L.find(function(x){return x.id===u.id});if(!l)return 'No longer on the record';var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};return REVIEW_LABELS[r.assessment]||(l.fluency?'Fluency '+l.fluency+'/5':'')}var rk=(data.risks||[]).find(function(x){return x.id===u.id});return rk?lriskTotal(rk)+'/15 \u00b7 '+lriskBand(rk):'No longer on the record'}
  if(u.kind==='text'){var words=String(u.html||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').trim().split(/\s+/).filter(Boolean).length;return words?n(words,'word'):'Nothing written yet'}
  return ''}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 153 — Add the function that describes what a section prints, in one sentence.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitFact` ends, after its closing `}`.

**Code:**

```js
function rcUnitDesc(u){var D={
   'out-readiness':'The organization\u2019s readiness at the start of the program: the overall score and its reading, the five areas of the Assessment Battery with their averages, and every question\u2019s score within each area.',
   'out-inventory':'Every leader in the landscape: role, scope, engagement, bandwidth, self-rated AI fluency, and change experience; then the ownership gap and the middle-management assessment.',
   'out-riskmap':'The seven leadership risks scored for likelihood, impact, and time horizon, highest first, with the count of Critical, Moderate, and Low risks at the head.',
   'out-structure':'How the organization has structured its leadership for AI: ownership, board governance, the senior layer, middle management principles, and cross-functional coordination.',
   'out-collab':'Where and how people and AI work together: touchpoints, collaboration models, AI personas, AI-free zones, and the translation layer.',
   'out-competency':'The seven leadership competencies as the organization defines them, the development priorities, and every leader\u2019s scores.',
   'out-fluency':'The team project, its workflow and the judgment it protects, and every leader\u2019s sprint tasks.',
   'out-decisions':'The four decision simulations: the organization\u2019s response to each scenario and the ethical pre-mortem behind it.',
   'out-mmprinciples':'What middle management automates, augments, and keeps human; the workflows and decisions that follow; and the log and evaluation criteria that hold the new role to account.',
   'out-values':'The leadership team\u2019s philosophical commitments; its shared principles in three domains and the roles that carry them; how the principles are kept alive; where the team diverged; at Full depth, each leader\u2019s reflections.',
   'out-rhythm':'The permanent operating cadence: the leadership meeting, peer learning, decision simulations, and the external and board rhythm.',
   'out-evalplan':'How leaders are evaluated and succession is planned for the AI era: the readiness indicators, their weighting, the bench, and the board.',
   'out-review':'The first review of leadership progress: the structural review, then every leader\u2019s assessment, grouped by the four judgments.',
   'page:5.1':'The leadership structure as it stands: staffing, every role with its occupant, the organization chart, and the policies that govern how people and AI work together.',
   'page:5.2':'Leadership development across the program: competency tracking, study progress, fluency growth, and practice health.',
   'page:5.3':'The signed-in leader\u2019s record and the seven monthly reviews with their state this month.',
   'record:leader':'This leader\u2019s full record: the landscape entry, competency scores, sprint tasks, first review, and development.',
   'record:lrisk':'This risk\u2019s screen: likelihood, impact, time horizon, and notes.',
   'text':'A page you write, printed as its own numbered section.'};
  return D[u.kind==='output'?u.id:(u.kind==='record'?'record:'+u.type:(u.kind==='text'?'text':u.kind+':'+u.id))]||''}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 154 — Add the function that reads the Individual Leaders filters.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcUnitDesc` ends, after its closing `}`.

**Code:**

```js
function rcLeaderFilter(){return UI.rcF||(UI.rcF={q:'',rv:'all'})}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 155 — Add the function that changes an Individual Leaders filter.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcLeaderFilter` ends, after its closing `}`.

**Code:**

```js
function rcSetFilter(k,v){var F=rcLeaderFilter();F[k]=v;render();if(k==='q'){var el=document.querySelector('input[type=search][placeholder^="Search leaders"]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 156 — Add the function that decides whether a leader passes the filters.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetFilter` ends, after its closing `}`.

**Code:**

```js
function rcLeaderPasses(l,F){if(!l)return false;var q=(F.q||'').trim().toLowerCase();if(q&&((l.name||'')+' '+(l.role||'')).toLowerCase().indexOf(q)<0)return false;var r=((data.leadershipReview||{}).leaders||{})[l.id]||{};if(F.rv&&F.rv!=='all'){if(F.rv==='none'){if(REVIEW_LABELS[r.assessment])return false}else if(r.assessment!==F.rv)return false}return true}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 157 — Add the function that reads the saved reports.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcLeaderPasses` ends, after its closing `}`.

**Code:**

```js
function rcDefs(){if(!data.reportDefs)data.reportDefs=[];return data.reportDefs}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 158 — Add the function that creates a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDefs` ends, after its closing `}`.

**Code:**

```js
function rcNew(){var d={id:'rpt-'+Math.random().toString(36).slice(2,9),name:'New report',subtitle:'',intro:'',units:[],createdAt:Date.now()};rcDefs().push(d);UI.rcEdit=d.id;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 159 — Add the function that finds a saved report by its id.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcNew` ends, after its closing `}`.

**Code:**

```js
function rcFind(id){return rcDefs().find(function(d){return d.id===id})||null}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 160 — Add the function that saves a report's title, subtitle, or introduction.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcFind` ends, after its closing `}`.

**Code:**

```js
function rcSet(id,k,v){var d=rcFind(id);if(!d)return;d[k]=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 161 — Add the function that saves a section's note.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSet` ends, after its closing `}`.

**Code:**

```js
function rcSetNote(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].note=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 162 — Add the function that saves a section's Summary / Full choice.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetNote` ends, after its closing `}`.

**Code:**

```js
function rcSetDepth(id,i,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].depth=v;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 163 — Add the function that adds a piece of content to a report or removes it.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetDepth` ends, after its closing `}`.

**Code:**

```js
function rcToggle(id,key,depth){var d=rcFind(id);if(!d)return;var i=d.units.findIndex(function(u){return u.key===key});if(i>=0)d.units.splice(i,1);else{var c=rcCatalogue().find(function(u){return rcKey(u)===key});if(c)d.units.push({key:key,kind:c.kind,id:c.id,type:c.type||'',name:c.name,depth:c.depths?(depth==='full'?'full':'summary'):'',note:''})}saveData();render()} /* 14 Sep 2026: an option with a depth is added at the depth chosen */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 164 — Add the function that moves a section up or down.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcToggle` ends, after its closing `}`.

**Code:**

```js
function rcMove(id,i,dir){var d=rcFind(id);if(!d)return;var j=i+dir;if(j<0||j>=d.units.length)return;var t=d.units[i];d.units[i]=d.units[j];d.units[j]=t;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 165 — Add the function that deletes a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcMove` ends, after its closing `}`.

**Code:**

```js
function rcDelete(id){if(!confirm('Delete this report definition? The record it prints is untouched.'))return;data.reportDefs=rcDefs().filter(function(d){return d.id!==id});if(UI.rcEdit===id)UI.rcEdit=null;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 166 — Add the function that copies a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDelete` ends, after its closing `}`.

**Code:**

```js
function rcDuplicate(id){var d=rcFind(id);if(!d)return;var c=JSON.parse(JSON.stringify(d));c.id='rpt-'+Math.random().toString(36).slice(2,9);c.name=d.name+' (copy)';c.createdAt=Date.now();rcDefs().push(c);UI.rcEdit=c.id;saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 167 — Add the function that gives a piece of content its key.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcDuplicate` ends, after its closing `}`.

**Code:**

```js
function rcKey(u){return u.kind+':'+(u.type?u.type+':':'')+u.id}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 168 — Add the function that removes a document's first page when it becomes a section of a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcKey` ends, after its closing `}`.

**Code:**

```js
function _rcStripCover(doc){var i=doc.indexOf('min-height:85vh');if(i<0)return doc;var end=doc.indexOf('</div></div>',i);return end>0?doc.slice(end+12):doc} /* an output's own cover comes off inside a compiled report */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 169 — Add the function that keeps a section's first record on the same page as its heading.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `_rcStripCover` ends, after its closing `}`.

**Code:**

```js
function rcFirstRecordStays(body){var a=body.indexOf('<table class="ly-rec"');if(a<0)return body;var b=body.indexOf('<table class="ly-rec"',a+10);var first=b>0?body.slice(a,b):body.slice(a);var fixed=first.replace('break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;','break-inside:auto;page-break-inside:auto;');return body.slice(0,a)+fixed+(b>0?body.slice(b):'')}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 170 — Add the function that builds the whole printed report.

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

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 171 — Add the function that builds one numbered section of the report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcCompile` ends, after its closing `}`.

**Code:**

```js
function rcSection(u,i){ /* one numbered section as the report carries it: the number at the title's size (Paul's ruling, 14 Sep 2026), the heading, the note, the body — one definition for the compiled report and for the section preview */
  var head='<div style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#111;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #111"><span style="font-family:var(--serif,Georgia,serif);font-size:24px;font-weight:600;color:#888;margin-right:12px">'+(i+1)+'</span>'+esc(rcUnitName(u))+'</div>';
  if(u.note&&u.note.trim())head+='<div style="font-size:13px;line-height:1.6;color:#333;margin:0 0 16px;padding:10px 14px;border-left:3px solid #999;white-space:pre-wrap">'+esc(u.note)+'</div>';
  if(u.kind==='page'&&(u.id==='5.1'||u.id==='5.2'))return '<div>'+rcUnitBody(u,head)+'</div>'; /* 16 Sep 2026 (Paul's ruling): these bodies open on their own landscape page; the heading sits at the top of that page above the org chart or the heat map, never alone on a page before it */
  var h='<div style="page-break-before:always">'+head;
  return h+rcUnitBody(u)+'</div>'}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 172 — Add the function that prints a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSection` ends, after its closing `}`.

**Code:**

```js
function rcPrint(id){var d=rcFind(id);if(!d)return;var doc=rcCompile(id);printDocumentPreview(d.name||'Report',doc)}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 173 — Add the function behind a text page's Save button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPrint` ends, after its closing `}`.

**Code:**

```js
function rcSaveText(id,i){var el=document.getElementById('rc_txt_'+(rcFind(id).units[i]||{}).id);if(el)rcSetTextHtml(id,i,el.innerHTML);var hd=document.getElementById('rc_head_'+(rcFind(id).units[i]||{}).id);if(hd)rcSetUnit(id,i,'name',hd.value);UI.rcSel=null;render()} /* Save keeps the text and the heading and closes the inspector */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 174 — Add the function behind a section's Preview this section button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSaveText` ends, after its closing `}`.

**Code:**

```js
function rcPreviewUnit(id,i){var d=rcFind(id);if(!d||!d.units[i])return;var u=d.units[i];var title=(d.name||'Report')+' \u2014 section '+(i+1);printDocumentPreview(title,rcSection(u,i).replace('page-break-before:always','page-break-before:auto'),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the section as the report carries it — its number, heading, note, and body — with no cover of its own */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 175 — Add the function that adds a text page to a report.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPreviewUnit` ends, after its closing `}`.

**Code:**

```js
function rcAddText(id,at){var d=rcFind(id);if(!d)return;var u={key:'text:'+Math.random().toString(36).slice(2,9),kind:'text',id:'',type:'',name:'',html:'',depth:'',note:''};u.id=u.key.slice(5);if(at==null||at>=d.units.length)d.units.push(u);else d.units.splice(at,0,u);UI.rcSel=u.key;saveData();render()} /* the new page opens in the inspector */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 176 — Add the function that saves a field of a section.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcAddText` ends, after its closing `}`.

**Code:**

```js
function rcSetUnit(id,i,k,v){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i][k]=v;saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 177 — Add the function that removes a section by its position.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetUnit` ends, after its closing `}`.

**Code:**

```js
function rcRemoveAt(id,i){var d=rcFind(id);if(!d||!d.units[i])return;d.units.splice(i,1);saveData();render()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 178 — Add the function that saves a text page's body.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcRemoveAt` ends, after its closing `}`.

**Code:**

```js
function rcSetTextHtml(id,i,html){var d=rcFind(id);if(!d||!d.units[i])return;d.units[i].html=rcSanitize(html);saveData()}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 179 — Add the function behind the Bold, Italic, and size buttons.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSetTextHtml` ends, after its closing `}`.

**Code:**

```js
function rcFmt(uid,cmd,val){var el=document.getElementById('rc_txt_'+uid);if(!el)return;el.focus();
  if(cmd==='bold'||cmd==='italic'){document.execCommand(cmd,false,null)}
  else if(cmd==='size'){document.execCommand('fontSize',false,{small:'2',normal:'3',large:'5',heading:'6'}[val]||'3')}
  el.dispatchEvent(new Event('input'))}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 180 — Add the function that keeps only bold, italics, sizes, paragraphs, and line breaks in a text page.

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

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 181 — Add the function behind the Preview the report button.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcSanitize` ends, after its closing `}`.

**Code:**

```js
function rcPreview(id){var d=rcFind(id);if(!d)return;printDocumentPreview(d.name||'Report',rcCompile(id),{preview:true})} /* 14 Sep 2026 (Paul's ruling): the report as it will print, at any point in the assembly, without the print dialog */
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 182 — Add the function that draws the Report Manager page.

**Kind:** Add new code.

**Where:** Add this immediately after the function named `rcPreview` ends, after its closing `}`.

**Code:**

```js
function renderReports(){ /* the Report Manager page (More menu). 14 Sep 2026 (Paul's ruling): a report is assembled from Report Content Options on the right into Sections on the left; every option that has a depth is added at Summary or Full; individual risks can be filtered; text pages with a heading and a formatted body can be added anywhere; the report can be previewed at any point; the introduction and notes are uncapped */
  var defs=rcDefs();var ed=UI.rcEdit?rcFind(UI.rcEdit):null;
  var h='<div class="content-area"><div class="content-inner rc-page"><h2 class="h-section">Report Manager</h2><p class="t-lead">Compile the outputs, the Phase 5 pages, and individual leaders and risks into one printed document under one cover: a contents page, a list of what is missing, an introduction you write, and each piece as a numbered section. Add your own text pages wherever a part of the report needs an introduction. A saved report reprints with fresh data. The record itself is never edited here.</p>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 18px">'+btn('+ New report','rcNew()','bp')+'</div>';
  if(!defs.length)h+=card('<p style="color:var(--text-faint);text-align:center;padding:28px 0">No reports yet. Start one, choose what it contains, and print it.</p>');
  defs.forEach(function(d){var open=ed&&ed.id===d.id;
    h+='<div class="cd" style="margin-bottom:10px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><div style="font-size:15px;font-weight:700;color:var(--paper)">'+esc(d.name||'Untitled')+'</div><div style="font-size:12px;color:var(--text-faint)">'+d.units.length+' section'+(d.units.length===1?'':'s')+(d.subtitle?' \u00b7 '+esc(d.subtitle):'')+'</div></div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+rcBtnG('Preview','rcPreview(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG('\u25be Save as PDF','rcPrint(\''+d.id+'\')','font-size:12px',!d.units.length)+rcBtnG(open?'Close':'Edit','UI.rcEdit='+(open?'null':'\''+d.id+'\'')+';render()','font-size:12px')+rcBtnG('Duplicate','rcDuplicate(\''+d.id+'\')','font-size:12px')+rcBtnG('Delete','rcDelete(\''+d.id+'\')','font-size:12px')+'</span></div>';
    if(open)h+=rcEditor(d);
    h+='</div>'});
  return h+'</div></div>'}
```

**Nothing to check yet.** This change becomes visible at Step 183.

---

### Step 183 — Add the function that draws the report editor.

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
    if(g==='Individual Leaders'){var F=rcLeaderFilter();
      h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px"><input type="search" placeholder="Search leaders by name or role" value="'+esc(F.q)+'" style="flex:1;min-width:160px;font-size:12px;padding:4px 8px" oninput="rcSetFilter(\'q\',this.value)"></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:0 0 6px"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--text-faint);margin-right:4px">REVIEW</span>'+[['all','All'],['developed','Developed'],['progressing','Progressing'],['support','Needs Support'],['hard','Hard Conversation'],['none','Not yet assessed']].map(function(x){return seg(F.rv===x[0],x[1],'rcSetFilter(\'rv\',\''+x[0]+'\')')}).join('')+'</div>';
      var shown=list.filter(function(u){return rcLeaderPasses(u.rec,F)});
      h+='<div style="font-size:11px;color:var(--text-faint);margin:0 0 2px">'+shown.length+' of '+list.length+' leader'+(list.length===1?'':'s')+(shown.length!==list.length?' shown':'')+'</div>';
      if(!shown.length)h+='<p class="t-faint-sm" style="padding:8px 0">No leader matches these filters.</p>';
      shown.forEach(function(u){h+=row(u)});
    }else list.forEach(function(u){h+=row(u)});
    h+='</div>'});
  h+='</div></div>';
  return h+'</div>'}
```

**Check:** Open the More menu and choose Report Manager. The page is centred with the sidebar closed. Click + New report; type a title. In Report Content Options at the right, add Readiness Report, Leadership Structure (under Phase 5 pages), and L&D Hub. Click ▾ Save as PDF: the document has a first page, a contents page listing the three sections, then section 1 Readiness Report on its own page; section 2 Leadership Structure begins on a sideways page whose heading sits directly above Org Chart; section 3 L&D Hub begins on a sideways page whose heading sits directly above the L&D HUB heat map, and its three pages show no "1 of 3".

---

### Step 184 — Remove the empty line at the very end of the file, after the last closing `}`.

**Kind:** Delete existing code.

**Where:** The last line of the file is empty. Remove it.

**Nothing to check.**

---

## 5. The stylesheet

One change to `Exec-Readiness-styles.css`. Find the line that reads exactly:

```css
.main-content .content-inner.board-page{margin-left:max(0px,calc(50vw - var(--sbw)/2 - 450px))}
```

Add this line immediately after it:

```css
.content-inner.rc-page{max-width:1350px;margin-left:max(0px,calc(50vw - var(--sbw) - 675px))} /* 16 Sep 2026 (Paul's ruling): the Report Manager's 1350px block centres on the page when the sidebar is closed; the shared formula above is written for the 900px column */
```

**Check:** Open the More menu and choose Report Manager. Close the sidebar with the ☰ toggle: the page centres on the screen. Open the sidebar: the page sits beside it.

## 6. The test suites

Take the file `Exec-Readiness-boot-smoke.js` (md5 `84170edf`) that comes with this document, whole. Do not edit it. It needs these files in the same folder: `Exec-Readiness-index.html`, `Exec-Readiness-app.js`, `Exec-Readiness-templates-local.js`, `Exec-Readiness-screen-loader.js`, `Exec-Readiness-home.js`, `Exec-Readiness-learn.js`, `Exec-Readiness-styles.css`, and the two screen templates `Exec-Readiness-home.html` and `Exec-Readiness-learn.html`. Install the test browser once with `npm install jsdom`, then run `node Exec-Readiness-boot-smoke.js`. The last line but one must read `ASSERTIONS: 288  FAIL: 0`. If any line begins with FAIL, report it with its text.

Take the file `Exec-Readiness-harness.js` (md5 `6ee605ab`) whole, likewise, in the same folder, and run `node Exec-Readiness-harness.js`. Its result must read `PASS: 335` and `FAIL: 0`.

## 7. The example data

Step 44 changes the example data. The acceptance checks below assume the example data is loaded. To load it: sign in, open the More menu (the ··· button at the top right), and choose Seed sample data. Confirm when asked. The organization's records are replaced by the example organization, Aurora Windows, with thirteen leaders.

## 8. Acceptance checks

1. Open the Operating Rhythm (Phase 4 output) and click ▾ Save as PDF. A new window opens. Its first page shows, from the top: the line NEXTCHAPTER · 90-DAY EXECUTIVE READINESS; the title Operating Rhythm; a subtitle; a horizontal rule; the organization's name; today's date as words. In the print dialog's preview, every page shows "© 2026 Next Chapter, LLC. All rights reserved." at the bottom left and a page number at the bottom right, and nothing at the top corners. No button prints.
2. Open the Leadership Inventory (Phase 1 output). Below four figures, each leader is a record table with a section LEADERSHIP LANDSCAPE. Click ▾ Save as PDF: the first page; then a sideways page headed Org Chart with the chart filling the page and every role title complete; then an upright page headed At a Glance with four figures in boxes, then The Leaders and each leader's table, then The Landscape.
3. Open the Readiness Report and click ▾ Save as PDF: the score in a large box, then the five areas with bars. Open the Risk Map and click ▾ Save as PDF: the risks print as record tables.
4. Open the Competency Framework (Phase 2 output). The Development Priorities card is at the top of the page. Above the leaders are two small buttons SUMMARY and FULL; click FULL and each leader shows more rows. Click ▾ Save as PDF: the seven definitions, Development Priorities as bars with each score on one line (such as 2.3 / 5), then the leaders starting on a new page.
5. Open the Fluency Assessment (Phase 3 output). Each leader shows Task 1, Task 2, Task 3; there is no SUMMARY / FULL control. Click ▾ Save as PDF: The Team Project, then a new page headed Individual Fluency Sprints with the leaders.
6. Open the Review Report (Phase 4 output) and click ▾ Save as PDF: the Structural Review in a red box with Working Well in green and Needs Revision in red; the four counts Developed, Progressing, Needs Support, Hard Conversation in coloured boxes; then a new page headed Individual Leader Reviews, then Developed, then the first leader.
7. Open the Leadership Structure (Phase 2 output) and click ▾ Save as PDF: sections of labelled rows, and in the print preview no section is split across two pages. Do the same for the Collaboration Principles: its Collaboration Models section lists four functions with a model each.
8. Open the Decision Analyses (Phase 3 output) and click ▾ Save as PDF: one heading The Four Scenarios, then four boxes in two rows of two, each with the scenario, Our response, and Ethical pre-mortem, in greys.
9. Open MM Principles (Phase 3 output). The page shows The Three Categories as a band of three, AI-Augmented Workflows with each workflow's AI does and The manager does side by side, Decisions That Stay Human, and two panels The AI Use Log and Evaluating Managers. Click ▾ Save as PDF: the same four sections, in greys, the template in a monospace face.
10. Open the Values Architecture (Phase 3 output). It shows SUMMARY and FULL. Click FULL, then ▾ Save as PDF: Our Philosophical Commitments in a box, Shared Principles by domain, The Roles That Carry Each Principle with three figures, Keeping the Principles Alive with the AI Purpose Filter, Where the Team Diverged, then a new page headed Appendix with The Reflections Behind the Principles beneath it. In every section heading the sub-line is on its own line under the title.
11. Open the sidebar. Under Phase 1 the steps are followed by one line reading ▸ Outputs (3); click it and the three outputs appear. Under each other phase the outputs sit behind the same kind of line.
12. Open Phase 1, step 1.2 (Leadership Landscape) and scroll to Reporting Lines. Long titles such as Chief Innovation & Transformation Officer appear on two lines with no "…". Below the executives, their reports hang in a column under each one; the AI Transformation Council sits beside the Chief Executive Officer with a dashed border. Every box's coloured top bar ends at the box's corners.
13. Open Phase 5, step 5.1 (Leadership Dashboard). The toolbar reads Add Role, Add New Leader, Save, then SUMMARY and FULL, then ▾ Save as PDF. The chart shows the same boxes as step 1.2. Click the Board's box: the block under the committee members is headed BOARD SUMMARY. Click the AI Transformation Council's box: its block is headed AI TRANSFORMATION COUNCIL SUMMARY.
14. On the Leadership Dashboard, click SUMMARY, then ▾ Save as PDF: the first page is titled Leadership Structure; the next is a sideways page headed Org Chart filling the page; then an upright page headed Role Details; then a page headed Appendix with Competency Summary beneath it. Click FULL, then ▾ Save as PDF: after the Org Chart page, one page per role in its coloured box, the Board first, with no Edit or Close buttons, no direct-reports list, and no Tasks to Automate block; each role fits its page.
15. Open Phase 5, step 5.2 (L&D Hub) and click ▾ Save as PDF. After the first page, a sideways page shows the Competency Heat Map with every leader and all seven competencies; then upright pages Study Progress and Practice Health. Each of the three pages is headed L&D HUB with no "1 of 3".
16. Open Phase 5, step 5.3 (My Development) and click ▾ Save as PDF: a first page titled My Development, then the leader's development record as labelled rows with a section Monthly Reviews.
17. Open the More menu and choose Track Program. Click ▾ Save as PDF: the first page is titled Module Management; the next shows four figures, This Week, and the steps of Phases 1 to 4 with owners and state, without the individual steps 1.4, 2.4, 3.5, and 4.4; the page after is headed Analytics.
18. Open the More menu and choose Report Manager. The sidebar and its ☰ toggle are present; close the sidebar and the page centres. Click + New report, type a title, and add Readiness Report, Leadership Structure (under Phase 5 pages), and L&D Hub from Report Content Options. Click ▾ Save as PDF: a first page, a contents page listing the three sections, section 1 on its own page; section 2 Leadership Structure beginning on a sideways page whose numbered heading sits directly above Org Chart; section 3 L&D Hub beginning on a sideways page whose numbered heading sits directly above the heat map; no "1 of 3" anywhere.
19. Open Phase 3, step 3.3 (MM Activation): the AI Workflow Analysis lists Quote drafting, Support triage, and Demand forecast, each opening to an AI Role and a Human Role. Open step 2.2 (Collaboration Principles), Models tab: four functions, each with a model such as Augmenter or Autonomous Agent.
20. Run the two test suites (section 6). The boot smoke reports ASSERTIONS: 288  FAIL: 0 and the harness PASS: 335  FAIL: 0.

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
