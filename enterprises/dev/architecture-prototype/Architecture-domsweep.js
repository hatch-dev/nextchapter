#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   Architecture-domsweep.js — real-DOM page walk (jsdom)
   Added 15 Aug 2026 after Paul's visual pass caught three
   first-touch defects the stub-DOM suites could not see
   (login draft wipe, adoption loop, sidebar never shown).
   This instrument boots the real index.html shell, signs in
   through the real login flow, walks every page, and asserts
   the chrome actually renders. Run alongside smoke + harness;
   a red here blocks ship exactly like a red there.
   Requires: npm install jsdom
   ───────────────────────────────────────────────────────────── */
'use strict';
(async function(){
const {JSDOM}=require('jsdom');
const fs=require('fs');
const path=require('path');

let pass=0, fail=0; const failures=[];
function ok(c,label){ if(c){pass++;} else {fail++; failures.push(label);} }

const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'Architecture-index.html'),'utf8'),
  {runScripts:'outside-only', url:'https://localhost/', pretendToBeVisual:true});
const w=dom.window;
w.__SUITE_SEED=true; /* 2 Oct 2026 (Spec §25.3): the sweep may seed its test organization */
const consoleErrors=[];
w.console.error=(...a)=>{ consoleErrors.push(String(a[0]&&a[0].message||a[0]).slice(0,160)); };
w.matchMedia=q=>({matches:false,addEventListener(){},addListener(){}});
w.ResizeObserver=class{observe(){}disconnect(){}unobserve(){}};
w.scrollTo=()=>{}; w.alert=()=>{}; w.confirm=()=>true; w.print=()=>{};
w.HTMLElement.prototype.scrollTo=function(){};
w.fetch=()=>Promise.resolve({ok:false,text:()=>Promise.resolve('')});

for(const f of ['Architecture-templates-local.js','Architecture-screen-loader.js','Architecture-home.js','Architecture-learn.js','Architecture-app.js']){
  w.eval(fs.readFileSync(path.join(__dirname,f),'utf8'));
}

/* ── fixture org, then sign in THROUGH THE REAL LOGIN FLOW ── */
w.eval("var id='org_sweep';saveOrgs([{id:id,name:'Sweep Org',created:Date.now()}]);"+
 "var d=emptyData();d.roster=[{id:'u1',name:'Ada',username:'ada',passcode:'Sweep-pass-1!',admin:true,initials:'AD',color:'#333',role:'Facilitator'}];"+
 "Store.writeOrg(id,d);render();");
ok(w.document.getElementById('app').innerHTML.indexOf('login-screen')>=0, 'boot lands on the sign-in screen');
w.document.getElementById('loginUser').value='ada';
w.document.getElementById('loginPin').value='Sweep-pass-1!'; /* RETARGETED 5 Oct 2026 (Paul): a stored password that breaks the rule now leads to Choose a new password, so the sweep's user has one that meets it */
w.eval('doLogin()');
/* Auth.signIn resolves through the async seam; give the callback a tick before asserting. */
await new Promise(r=>setTimeout(r,80));
ok(w.eval("!!getCurrentUser()"), 'real login flow signs the fixture user in');
ok(w.document.getElementById('app').innerHTML.indexOf('login-screen')<0, 'entry gate cleared after sign-in');

/* seed so every page has content to render */
w.eval("seedData('full')");

/* ── the walk: every page, chrome asserted ── */
const SIDEBAR_PAGES=['readiness','phase5','mgmt-hub','manage','archreview','archmap','archscores','stdData','dgreview','stdCompute','stdModel','stdInteg','stdApp','5.2','5.3','5.4','5.5']; /* 5 Sep 2026: the scores page joins */ /* 5 Sep 2026 (Paul's ruling): the standing pages and the Phase 5 steps walk too; the two standing pages were falling through to home unseen */
const NO_SIDEBAR_PAGES=['home','learn','insights'];
const STEP_IDS=w.eval("JSON.stringify(PH.reduce(function(a,p){(p.steps||[]).forEach(function(s){a.push(s.id)});return a},[]))");
const steps=JSON.parse(STEP_IDS);
const OUTCOMES=w.eval("JSON.stringify(PH.reduce(function(a,p){(p.outcomes||[]).forEach(function(o){a.push(o.id)});return a},[]))");
const outcomes=JSON.parse(OUTCOMES);

function visit(pageArg, label){
  w.eval("go("+JSON.stringify(pageArg)+")");
  const app=w.document.getElementById('app');
  ok(app.innerHTML.length>400, label+': page body renders ('+app.innerHTML.length+' ch)');
  ok(app.innerHTML.indexOf('<h2>Error</h2>')<0, label+': no render error card');
  ok(w.eval('currentPage')!=='home' || pageArg==='home', label+': the page did not fall through to home (currentPage '+JSON.stringify(w.eval('currentPage'))+')');
}
function sidebarState(){
  const sb=w.document.getElementById('pipSidebar');
  return { len: sb.innerHTML.length, display: sb.style.display };
}

for(const p of NO_SIDEBAR_PAGES){
  visit(p, 'page '+p);
  ok(sidebarState().display==='none', 'page '+p+': sidebar hidden');
}
for(const p of SIDEBAR_PAGES){
  visit(p, 'page '+p);
  const st=sidebarState();
  ok(st.display==='flex', 'page '+p+': sidebar shown (display '+JSON.stringify(st.display)+')');
  ok(st.len>800, 'page '+p+': sidebar populated ('+st.len+' ch)');
}
for(const sid of steps){
  visit(sid, 'step '+sid);
  const st=sidebarState();
  ok(st.display==='flex' && st.len>800, 'step '+sid+': sidebar shown and populated');
}
for(const oid of outcomes){
  visit(oid, 'outcome '+oid);
}

/* Item 57 cluster round, 15 Aug 2026 — draft-survival walk (directive acceptance):
   type into an add-form field via the DOM, force a full render() mid-typing (the adoption-repaint
   scenario), and assert the field still carries the typed value. This instrument runs jsdom with
   runScripts:'outside-only', so inline handler attributes never auto-wire; the walk executes each
   field's REAL oninput attribute text with `this` bound to the element — the same code a browser
   keystroke runs. */
function fireInline(id, attr){
  w.eval("(function(){var el=document.getElementById('"+id+"');(function(){"+attr+"}).call(el)})()");
}
visit('1.3','step 1.3 for the draft walk');
/* SUPERSEDED 26 Aug 2026 (B3): the md add form retired with the audit merge; the audit add's
   name draft lives in UI.ccAddDraft through the ccadd route (same Spec 7A clause). */
w.eval("UI.auditTab='model';UI.expandEdit=null;render();");
{
  const fld=w.document.getElementById('ccadd_aiModels');
  ok(!!fld, 'draft walk: the audit add field renders on the model tab');
  if(fld){
    fld.value='MID-TYPING DRAFT';
    fireInline('ccadd_aiModels', fld.getAttribute('oninput')||'');
    w.render();
    const fld2=w.document.getElementById('ccadd_aiModels');
    ok(!!fld2 && fld2.value==='MID-TYPING DRAFT', 'draft walk: the audit add value survives a mid-typing re-render (got '+JSON.stringify(fld2&&fld2.value)+')');
    ok(w.UI.ccAddDraft && w.UI.ccAddDraft.aiModels==='MID-TYPING DRAFT', 'draft walk: the typed value lives in UI.ccAddDraft, not the DOM alone');
  }
}
w.eval("UI.ccAddDraft=null;");
w.UI.addModelForm=false; w.UI.mdDraft=null;
visit('1.2','step 1.2 for the list-input draft walk'); /* 5 Sep 2026: the agenda list input renders on the Board's own step */
w.eval("if(!data.reviewBoard)data.reviewBoard={};if(!data.reviewBoard.purpose)data.reviewBoard.purpose='Sweep charter';UI._docAll=true;render();UI._docAll=false;");
{
  const li=w.document.getElementById('rb_newAgenda');
  ok(!!li, 'draft walk: rb_newAgenda list input renders on the Board step');
  if(li){
    li.value='LIST DRAFT SURVIVES';
    fireInline('rb_newAgenda', li.getAttribute('oninput')||'');
    w.eval("UI._docAll=true;render();UI._docAll=false;");
    const li2=w.document.getElementById('rb_newAgenda');
    ok(!!li2 && li2.value==='LIST DRAFT SURVIVES', 'draft walk: addItemList input value survives a mid-typing re-render (skill add-fields class)');
  }
}
w.UI.expandEdit=null; w.UI.listDraft=null; w.UI.dbFold=null; w.render();

/* Item 69 walk (entity-keyed draft preservation, ported 24 Aug 2026): in-flight typing — a DOM
   value not yet committed — survives a same-record repaint via capture-and-reinject, and is
   REFUSED across records: text captured in record A's panel must never appear in record B's
   empty twin field (the Governance field-bleed class, closed by the data-ent wrappers). */
visit('dgreview','the Data Governance Review page for the item-69 walk'); /* 8 Sep 2026: the Architecture Review's decisions retired; the walk uses the Data Governance Review's decisions, opened one at a time */
w.eval("dgDecisionAdd();dgDecisionAdd();");
const _d69=JSON.parse(w.eval("JSON.stringify(dgRR().decisions.slice(-2).map(function(d){return d.id}))"));
w.eval("UI.expandEdit='dgdec_'+"+JSON.stringify(_d69[0])+";");w.render();
{
  const f1=w.document.getElementById('dgr_'+_d69[0]+'_owner');
  ok(!!f1, 'item-69 walk: the first decision renders its owner field');
  if(f1){
    f1.value='IN-FLIGHT TEXT';f1.dispatchEvent(new w.Event('input',{bubbles:true}));   /* SUPERSEDED 23 Sep 2026 (the stable-identity directive R3): only text a person typed survives a redraw, and typing fires input — the walk types as a person does */
    w.render();
    const f2=w.document.getElementById('dgr_'+_d69[0]+'_owner');
    ok(!!f2 && f2.value==='IN-FLIGHT TEXT', 'item-69 walk: uncommitted typing survives a same-record repaint (got '+JSON.stringify(f2&&f2.value)+')');
    w.eval("UI.expandEdit='dgdec_'+"+JSON.stringify(_d69[1])+";");w.render();
    const f3=w.document.getElementById('dgr_'+_d69[1]+'_owner');
    ok(!!f3 && f3.value==='', 'item-69 walk: record A text is REFUSED in record B empty twin field (got '+JSON.stringify(f3&&f3.value)+')');
  }
}
w.eval("dgDecisionDel('"+_d69[0]+"');dgDecisionDel('"+_d69[1]+"');"); /* 23 Sep 2026 (the dead-code census): the walk's Data Governance decisions are removed with the Data Governance deleter; the Architecture Review's, which it had called, did nothing here and was unreachable */w.UI.expandEdit=null; w.render();

/* Item 67 walk (global input cap, installed 24 Aug 2026): a document-level capture listener
   trims any text input or textarea past 10,000 characters on every input event. */
visit('1.1','step 1.1 for the item-67 cap walk');
{
  const anyTa=w.document.querySelector('textarea[id]');
  ok(!!anyTa, 'item-67 walk: a textarea exists on the page');
  if(anyTa){
    anyTa.value=new Array(12001).join('x');   /* 12,000 characters */
    anyTa.dispatchEvent(new w.Event('input',{bubbles:true}));
    ok(anyTa.value.length===10000, 'item-67 walk: oversize input is trimmed to exactly 10,000 characters (got '+anyTa.value.length+')');
    anyTa.value='';
  }
}

/* Item 71 walk (roster validation, both directions in a real DOM): a member cannot be saved
   without username and PIN; with both, the save proceeds. */
{
  const _al=[]; const _alert0=w.alert; w.alert=function(m){_al.push(String(m))};
  w.eval("data.roster=data.roster||[];data.roster.push({id:'v71',name:'Val Probe',username:'',passcode:'',initials:'VP',color:'#333'});applyTeamRoster();");
  w.openOrg(); w.UI.orgEdit='v71'; w.renderOrgModal();
  const un=w.document.getElementById('ru_v71_username'), pn=w.document.getElementById('ru_v71_passcode');
  ok(!!un&&!!pn, 'item-71 walk: the member editor renders its username and PIN fields');
  if(un&&pn){
    un.value=''; pn.value='';
    _al.length=0; w.saveProfile('v71');
    ok(_al.length===1&&_al[0]==='Username and password are required.', 'item-71 walk: a credential-less save is blocked with the verbatim message'); /* RETARGETED 2 Oct 2026 (Spec §25.5): "password", not "PIN" */
    w.UI.orgEdit='v71'; w.renderOrgModal();
    const un2=w.document.getElementById('ru_v71_username'), pn2=w.document.getElementById('ru_v71_passcode');
    un2.value='valp'; pn2.value='Walk-pass-1!'; /* RETARGETED 2 Oct 2026 (Spec §25.5): a password that meets the rule */
    _al.length=0; w.saveProfile('v71');
    ok(_al.length===0 && w.eval("(USERS.find(function(u){return u.id==='v71'})||{}).username")==='valp',
       'item-71 walk: a save with username and PIN proceeds normally');
  }
  w.eval("data.roster=data.roster.filter(function(u){return u.id!=='v71'});applyTeamRoster();saveData();");
  w.UI.orgEdit=null; w.eval("currentModal=null"); w.alert=_alert0; w.render();
}

/* Ruling 71 rebuild walk (collect-first add, 24 Aug 2026): clicking Add persists nothing; a
   credential-less save of the new editor creates nothing; a credentialed save creates the member. */
{
  const _al2=[]; const _alertR=w.alert; w.alert=function(m){_al2.push(String(m))};
  const n0=w.eval('USERS.length');
  w.openOrg(); w.addProfile();
  ok(w.eval('USERS.length')===n0 && w.UI.orgEdit==='new', 'ruling-71 walk: Add opens the new editor and creates nothing');
  const nn=w.document.getElementById('ru_new_username'), np=w.document.getElementById('ru_new_passcode'), nm=w.document.getElementById('ru_new_name');
  ok(!!nn&&!!np&&!!nm, 'ruling-71 walk: the unbound new-member editor renders its fields');
  if(nn&&np&&nm){
    _al2.length=0; w.saveProfile('new');
    ok(_al2.length===1 && w.eval('USERS.length')===n0, 'ruling-71 walk: a credential-less new save is blocked and creates nothing');
    w.UI.orgEdit='new'; w.renderOrgModal();
    w.document.getElementById('ru_new_name').value='Nova Probe';
    w.document.getElementById('ru_new_username').value='nova';
    w.document.getElementById('ru_new_passcode').value='Walk-pass-2!'; /* RETARGETED 2 Oct 2026 (Spec §25.5) */
    _al2.length=0; w.saveProfile('new');
    ok(_al2.length===0 && w.eval('USERS.length')===n0+1 && w.eval("(USERS.filter(function(u){return u.username==='nova'})[0]||{}).name")==='Nova Probe',
       'ruling-71 walk: a credentialed new save creates the member with the typed details');
  }
  w.eval("data.roster=data.roster.filter(function(u){return u.username!=='nova'});applyTeamRoster();saveData();");
  w.UI.orgEdit=null; w.eval("currentModal=null"); w.alert=_alertR; w.render();
}

/* User-menu widget walk (family widget ported 24 Aug 2026): the chip opens the three-item
   menu instead of signing out; View Assignments renders the personalized modal; an assigned
   step lists as an open row; a completed assignment drops to the Completed section. */
{
  visit('home','home for the user-menu walk');
  const chip=w.document.querySelector('.nav-user-chip');
  ok(!!chip && (chip.getAttribute('onclick')||'').indexOf('toggleUserMenu')>=0, 'user-menu walk: the chip opens the account menu, not sign-out');
  w.toggleUserMenu();
  const menu=w.document.querySelector('.nav-more-menu');
  ok(!!menu && menu.innerHTML.indexOf('Org Profile')>=0 && menu.innerHTML.indexOf('View Assignments')>=0 && menu.innerHTML.indexOf('Sign Out')>=0,
     'user-menu walk: Org Profile, View Assignments, and Sign Out render in the menu');
  w.closeUserMenu();
  w.eval("data.assigns=data.assigns||{};data.assigns['1.1']=['u1'];data.stepDue=data.stepDue||{};data.stepDue['1.1']='2026-09-01';saveData();");
  w.openAssignments();
  const mr=w.document.getElementById('modalRoot');
  ok(mr.innerHTML.indexOf('My Assignments')>=0, 'user-menu walk: the assignments modal renders personalized');
  ok(mr.innerHTML.indexOf("asgnGo('1.1')")>=0, 'user-menu walk: the assigned step lists as an open, clickable row');
  w.eval("data.completedSteps=data.completedSteps||{};data.completedSteps['1.1']=true;saveData();");
  w.renderAssignmentsModal();
  ok(mr.innerHTML.indexOf('Completed')>=0 && mr.innerHTML.indexOf('\u2713 Done')>=0,
     'user-menu walk: a completed assignment drops to the greyed Completed section');
  w.eval("delete data.completedSteps['1.1'];delete data.assigns['1.1'];delete data.stepDue['1.1'];saveData();");
  w.closeModal(); w.render();
}

/* §14 lock walk (added 25 Aug 2026 — the matrix's never-run-in-a-real-DOM row). Writes a FOREIGN
   lock straight into the Collab store (another user id, fresh timestamp), then asserts the three
   ruled behaviors: the held record's fields render disabled, the "Locked · [Name] is editing"
   marker appears, and a button-path write is refused with the alert naming the holder. */
{
  visit('1.3','step 1.3 for the lock walk');
  /* SUPERSEDED 26 Aug 2026 (B3): the de_ row editor retired; the held record renders on the
     shared componentCard from the audit's data tab (same three ruled behaviors). */
  const _lid=w.eval("(function(){if(!data.dataEstate||!data.dataEstate.length){addComponent('dataEstate',{name:'Lock probe'});}return data.dataEstate[0].id})()");
  w.eval("UI.auditTab='data';");
  w.UI.expandEdit='aud_'+_lid; w.render();
  const _lf='cc_dataEstate_name_'+_lid;
  const rk=w.eval("idToRecordKey('"+_lf+"')");
  ok(!!rk, '§14 walk: the lock map resolves a record key for the open card (got '+JSON.stringify(rk)+')');
  const fld=w.document.getElementById(_lf);
  ok(!!fld && !fld.disabled, '§14 walk: the field is writable with no lock held');
  w.eval("(function(){var L={};L[idToRecordKey('"+_lf+"')]={id:'someone-else',name:'Vincent Lau',at:Date.now()};localStorage.setItem('architecture-locks::'+currentOrgId,JSON.stringify(L));})();");
  ok(w.eval("!!Collab.lockedByOther(idToRecordKey('"+_lf+"'))"), '§14 walk: the foreign lock is visible to Collab.lockedByOther');
  w.render(); w.applyLockUI(true);
  const fld2=w.document.getElementById(_lf);
  ok(!!fld2 && fld2.disabled===true, '§14 walk: a record held by another user renders its fields DISABLED');
  const marks=w.document.querySelectorAll('.collab-lock-mark');
  ok(marks.length>0 && String(marks[0].textContent).indexOf('Vincent Lau')>=0,
     '§14 walk: the "Locked · [Name] is editing" marker names the holder (got '+JSON.stringify(marks.length?marks[0].textContent:null)+')');
  const _al3=[]; const _alert3=w.alert; w.alert=function(m){_al3.push(String(m))};
  const blocked=w.eval("lockBlocked(idToRecordKey('"+_lf+"'))");
  ok(blocked===true && _al3.length===1 && _al3[0].indexOf('Vincent Lau')>=0,
     '§14 walk: the button-path guard refuses the held record and names the holder in the alert');
  w.alert=_alert3;
  w.eval("localStorage.removeItem('architecture-locks::'+currentOrgId);");
  w.UI.expandEdit=null; w.render(); w.applyLockUI(true);
}

/* 1.1 regroup walk (25 Aug 2026 restructure): three tabs with the ruled labels; the Architecture
   Baseline tab renders all five layer cards; every section keeps its own card. */
{
  visit('1.1','step 1.1 for the regroup walk');
  const html=w.document.getElementById('app').innerHTML;
  ok(html.indexOf('Purpose &amp; Strategy')>=0 && html.indexOf('People &amp; Processes')>=0 && html.indexOf('Architecture Baseline')>=0 /* innerHTML serializes & as &amp; */,
     'regroup walk: the three ruled tab labels render');
  w.UI.sec='TECH'; w.render();
  const t=w.document.getElementById('app').innerHTML;
  ok(['D: Data &amp; Storage','E: Compute &amp; Acceleration','F: Model &amp; Algorithm','G: Orchestration &amp; Tooling','H: Application &amp; Governance'].every(function(x){return t.indexOf(x)>=0}),
     'regroup walk: the Architecture Baseline tab carries all five layer cards');
  w.UI.sec='BC'; w.render();
  const b=w.document.getElementById('app').innerHTML;
  ok(b.indexOf('B: People &amp; Capabilities')>=0 && b.indexOf('C: Process &amp; Operations')>=0,
     'regroup walk: People & Processes carries both its cards');
  w.UI.sec=null; w.render();
}

/* AI Applications round-trip (batch 2, 25 Aug 2026): add through the real form, confirm it
   persists, and confirm it reaches BOTH diagram surfaces — Paul's ruling that the layer must
   actually feed the architecture diagram. */
{
  visit('1.3','step 1.3 for the applications walk');
  /* SUPERSEDED 26 Aug 2026 (B3): the aap_ add form retired; the walk adds through the audit's
     real add (name-first) and completes the record through the shared card's cc_ route —
     Paul's ruling that the layer must actually feed the architecture diagram still the subject. */
  w.eval("UI.auditTab='app';UI.expandEdit=null;render();");
  const before=w.eval("(data.aiApplications||[]).length");
  const nameEl=w.document.getElementById('ccadd_aiApplications');
  ok(!!nameEl, 'applications walk: the audit add renders its name field');
  w.eval("document.getElementById('ccadd_aiApplications').value='Walk assistant';audAdd('aiApplications');");
  const saved=w.eval("(data.aiApplications||[]).length");
  ok(saved===before+1, 'applications walk: the add commits exactly one record (before '+before+', after '+saved+')');
  const _wid=w.eval("data.aiApplications[data.aiApplications.length-1].id");
  w.eval("ccOptTick('aiApplications',data.aiApplications[data.aiApplications.length-1].id,'aiType',LAYER_SCHEMAS.aiApplications.groups[0].fields.find(function(f){return f.id==='aiType'}).options.indexOf('Agentic'),true);fldSave('cc_aiApplications_authority_'+data.aiApplications[data.aiApplications.length-1].id,'Autonomous');"); /* SUPERSEDED 23 Sep 2026 (Paul): AI type is a set of checkboxes, committed on the tick */
  const rec=w.eval("JSON.stringify(data.aiApplications[data.aiApplications.length-1])");
  const parsed=JSON.parse(rec);
  ok(parsed.name==='Walk assistant' && Array.isArray(parsed.aiType) && parsed.aiType.indexOf('Agentic')>=0 && parsed.authority==='Autonomous',
     'applications walk: name, type and authority persist through the audit add + cc_ route');
  w.render();
  const tab=w.document.getElementById('app').innerHTML;
  ok(tab.indexOf('Walk assistant')>=0, 'applications walk: the saved record renders back on the tab');
  const am=w.eval("renderOutArchMap()")||''; /* outVisual is the stat strip; renderOutArchMap builds the diagram */
  const dash=w.eval("(function(){currentPage='phase5';render();return document.getElementById('app').innerHTML})()")||'';
  ok(am.indexOf('Walk assistant')>=0 || dash.indexOf('Walk assistant')>=0,
     'applications walk: the record reaches a diagram surface (Paul\u2019s ruling: the layer must feed the diagram)');
  w.eval("removeComponent('aiApplications',data.aiApplications[data.aiApplications.length-1].id);UI.expandEdit=null;"); /* remove only what the walk added */
}

/* B2 diagram walk (26 Aug 2026, Audit Spec Rev B): the diagram derives from the canonical
   model in a real DOM — a component added to a register appears as an id-keyed node, clicking
   it opens the shared componentCard, the cc_ route persists a keystroke, and Save closes the
   panel. Seed-agnostic: the walk adds its own component and removes it after. */
{
  const cid=w.eval("(function(){var c=addComponent('dataEstate',{name:'Sweep Store',governanceStatus:'Ungoverned',type:'Database'});return c.id})()");
  w.eval("go('5.2');UI.archView='diagram';UI.diagMode='flow';UI.diagSel=null;render();"); /* 5 Sep 2026: the working map is Step 5.2 */
  const dg=w.document.getElementById('app').innerHTML;
  ok(dg.indexOf('dn_flow_'+cid)>=0, 'diagram walk: the new register row renders as an id-keyed node (bijection live)');
  ok(dg.indexOf('diag-full-bleed')>=0, 'diagram walk: the diagram renders inside the full-bleed breakout (R-A12)');
  w.eval("UI.diagSel='"+cid+"';render();");
  const nameFld=w.document.getElementById('cc_dataEstate_name_'+cid);
  ok(!!nameFld, 'diagram walk: clicking the node opens the shared componentCard in the panel');
  w.eval("fldSave('cc_dataEstate_owner_"+cid+"','Sweep Owner');");
  ok(w.eval("(function(){var R=componentRegisters();for(var i=0;i<R.dataEstate.length;i++){if(R.dataEstate[i].id==='"+cid+"')return R.dataEstate[i].owner}return null})()")==='Sweep Owner',
     'diagram walk: the cc_ per-field route persists a typed value onto the id-keyed record');
  w.eval("saveComponent('dataEstate','"+cid+"','dashboard');"); /* the card on 5.2 renders in the dashboard context */
  ok(w.eval("UI.diagSel")===null, 'diagram walk: Save on the shared card closes the diagram selection');
  /* Stack same-surface: the tile expansion renders the same card */
  w.eval("UI.archView='stack';UI.stackLayer='data';UI.expandEdit='stkc_"+cid+"';render();");
  const st=w.document.getElementById('app').innerHTML;
  ok(st.indexOf('cc_dataEstate_name_'+cid)>=0, 'diagram walk: the stack tile expansion renders the SAME shared card (same-surface)');
  /* UC rule in a real DOM: a UC model appears on no view */
  w.eval("addComponent('aiModels',{name:'Sweep Ghost',usage:'Under Consideration'});UI.archView='diagram';UI.expandEdit=null;UI.stackLayer=null;render();");
  ok(w.document.getElementById('app').innerHTML.indexOf('Sweep Ghost')<0,
     'diagram walk (AC-6): an Under Consideration model appears on no diagram view');
  w.eval("(function(){['dataEstate','aiModels'].forEach(function(k){var R=data[k]||[];for(var i=R.length-1;i>=0;i--){if(R[i].name==='Sweep Store'||R[i].name==='Sweep Ghost')R.splice(i,1)}});UI.archView='stack';UI.dbTab='map';UI.diagSel=null;saveData();render()})()"); /* remove only what the walk added */
}

/* 5 Sep 2026: the dashboard's mini map and the porthole, in a real DOM */
{
  visit('phase5','dashboard for the mini-map walk');
  const dm=w.document.getElementById('app').innerHTML;
  ok(dm.indexOf('archDiagSVG_flow')<0 && dm.indexOf('CONNECTIONS')<0 && dm.indexOf('UI.stackLayer=')>=0, 'stack-hero walk: the dashboard carries the stack, not the flow diagram or its controls'); /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the stack is the dashboard's hero; the map lives on 5.2) */
  ok(dm.indexOf('diag-full-bleed')<0, 'mini-map walk: no full-bleed breakout on the dashboard');
  w.eval("UI.mapFrom='2.3';go('archmap');");
  const ph=w.document.getElementById('app').innerHTML;
  ok(w.eval('currentPage')==='archmap' && ph.indexOf('The Architecture Map')>=0 && ph.indexOf('onclick="goBack()"')>=0, 'porthole walk: the map opens from its step with the one back button'); /* 8 Sep 2026 */
  ok(sidebarState().display==='flex', 'porthole walk: the sidebar is shown');
  ok(w.document.querySelector('.main-content').classList.contains('map-open'), 'porthole walk: the main column carries map-open while the diagram is on the page');
  w.eval("go('phase5');");
  ok(!w.document.querySelector('.main-content').classList.contains('map-open'), 'porthole walk: map-open is removed when the diagram leaves the page');
  w.eval("go('archreview');");
  ok(w.eval('currentPage')==='archreview' && w.document.getElementById('app').innerHTML.indexOf('Architecture Review')>=0 && sidebarState().display==='flex', 'review walk: the standing review renders with the sidebar');
}

/* 5 Sep 2026: the hover card in fullscreen — the host must live inside the fullscreen element to be painted */
{
  visit('5.2','the map for the fullscreen hover walk');
  const fake=w.document.createElement('div');fake.id='fakeFS';w.document.body.appendChild(fake);
  Object.defineProperty(w.document,'fullscreenElement',{configurable:true,get:function(){return fake}});
  const cid=w.eval("(data.dataEstate[0]||{}).id");
  w.eval("diagTipShow({clientX:400,clientY:300},'"+cid+"')");
  const host=w.document.getElementById('diagTipHost');
  ok(!!host && fake.contains(host), 'fullscreen hover walk: with a fullscreen element present the card\u2019s host moves inside it');
  Object.defineProperty(w.document,'fullscreenElement',{configurable:true,get:function(){return null}});
  w.eval("diagTipShow({clientX:400,clientY:300},'"+cid+"')");
  ok(!fake.contains(w.document.getElementById('diagTipHost')), 'fullscreen hover walk: when fullscreen ends the host comes back out');
  w.eval("diagTipHide()");fake.remove();
}

/* 6 Sep 2026 (Paul's browser pass): the sovereignty tick box on 2.1 adds its agenda item the moment it is ticked */
{
  visit('2.1','step 2.1 for the sovereignty tick-box walk');
  w.eval("UI.dgTab='setup';data.dataGovernance.oversightSov=false;render();");
  const before=(w.document.getElementById('app').innerHTML.match(/border-left:3px solid #4A6E8A/g)||[]).length;
  const cb=w.document.getElementById('dg_oversightSov');
  ok(!!cb, 'tick-box walk: the box renders on the review tab');
  if(cb){cb.checked=true;fireInline('dg_oversightSov', cb.getAttribute('onchange')||'');
    const after=(w.document.getElementById('app').innerHTML.match(/border-left:3px solid #4A6E8A/g)||[]).length;
    ok(after===before+1 && w.document.getElementById('app').innerHTML.indexOf('Check the six data-sovereignty conditions and the actions under way.')>=0, 'tick-box walk: ticking adds the data-sovereignty item to the rendered agenda at once ('+before+' \u2192 '+after+')');
    const cb2=w.document.getElementById('dg_oversightSov');cb2.checked=false;fireInline('dg_oversightSov', cb2.getAttribute('onchange')||'');
    ok((w.document.getElementById('app').innerHTML.match(/border-left:3px solid #4A6E8A/g)||[]).length===before, 'tick-box walk: unticking removes it again');}
  ok(w.document.getElementById('app').innerHTML.indexOf('Ticked, the six')<0, 'tick-box walk: the old copy is gone');
}

/* 7 Sep 2026 (Paul's ruling): a choice on a card reveals its dependent fields at once, without leaving and coming back */
{
  visit('2.3','step 2.3 for the render-on-choice walk');
  w.eval("UI.step23Part='retire';render();");
  const ig=w.eval("(function(){var g=(data.integrations||[]).filter(function(x){return x.retireVerdict==='Keep as is'})[0];UI.expandEdit='aud_'+g.id;UI.ccFold=UI.ccFold||{};UI.ccFold['fold_integrations_gov23_'+g.id]=true;render();return g.id})()");
  const sel=w.document.getElementById('cc_integrations_retireVerdict_'+ig);
  if(!sel){const ids=[...w.document.querySelectorAll('[id^=cc_integrations_]')].map(e=>e.id).slice(0,6);console.log('     ids on page:',ids.join(', '));}
  ok(!!sel, 'render-on-choice walk: the verdict select is on the open card');
  if(sel){sel.focus();sel.value='Modernize';fireInline('cc_integrations_retireVerdict_'+ig, sel.getAttribute('onchange')||'');
    ok(!!w.document.getElementById('cc_integrations_retireTimeline_'+ig)&&!!w.document.getElementById('cc_integrations_replacement_'+ig), 'render-on-choice walk: choosing Modernize shows the replacement approach and the timeline at once');
    const sel2=w.document.getElementById('cc_integrations_retireVerdict_'+ig);sel2.focus();sel2.value='Keep as is';fireInline('cc_integrations_retireVerdict_'+ig, sel2.getAttribute('onchange')||'');
    ok(!w.document.getElementById('cc_integrations_retireTimeline_'+ig), 'render-on-choice walk: choosing Keep as is removes them at once');}
}

/* 28 Sep 2026 (D-A10, Paul: lock coverage) — a lock held on the organization record marks its fields in the open
   Organization & Team dialog, not only on the page: applyLockUI walks #modalRoot as well as #app. */
{
  w.eval("try{openOrg()}catch(e){}");
  w.eval("window.__olk=Collab.othersLocks;Collab.othersLocks=function(){return [{key:'enterprise',name:'Pin Holder',id:'other'}]};applyLockUI(true);");
  const mr=w.document.getElementById('modalRoot');const html=mr?mr.innerHTML:'';const nm=w.document.querySelector('#modalRoot #ent_name');
  ok(html.indexOf('Pin Holder is editing')>=0&&!!nm&&nm.disabled===true, 'LOCK-DIALOG (28 Sep 2026, D-A10): a lock held on the organization record marks and disables its fields in the Organization & Team dialog');
  w.eval("Collab.othersLocks=window.__olk;applyLockUI(true);");
  const nm2=w.document.querySelector('#modalRoot #ent_name');
  ok(!!nm2&&nm2.disabled===false&&(w.document.getElementById('modalRoot').innerHTML.indexOf('Pin Holder is editing')<0), 'LOCK-DIALOG (28 Sep 2026, D-A10): when the lock clears, the dialog\u2019s fields are editable again and the marker is gone');
  w.eval("try{closeModal()}catch(e){try{currentModal=null;document.getElementById('modalRoot').innerHTML=''}catch(e2){}}");
}

/* 28 Sep 2026 (the consolidated re-audit, C01) — a report held by another person renders its title and introduction disabled */
{
  w.eval("try{rcNew()}catch(e){}");
  const rid=w.eval("rcDefs()[rcDefs().length-1].id");
  w.eval("UI.rcEdit='"+rid+"';try{go('reports')}catch(e){};render();window.__olk2=Collab.othersLocks;Collab.othersLocks=function(){return [{key:'reportDefs::"+rid+"',name:'Pin Holder',id:'other'}]};applyLockUI(true);");
  const t=w.document.getElementById('rc_name_'+rid),n=w.document.getElementById('rc_intro_'+rid);
  ok(!!t&&!!n&&t.disabled===true&&n.disabled===true, 'LOCK-REPORT (28 Sep 2026, C01): a report held by another person renders its title and introduction disabled');
  w.eval("Collab.othersLocks=window.__olk2;applyLockUI(true);");
  const t2=w.document.getElementById('rc_name_'+rid);
  ok(!!t2&&t2.disabled===false, 'LOCK-REPORT (28 Sep 2026, C01): when the lock clears, the title is editable again');
}

/* 28 Sep 2026 (audit D-C9; Spec 19.30, Rollout item 58) — each open panel keeps a half-typed draft, with its caret, through a full render and an adoption repaint, and shows a colleague's write */
{
  const P=[
    {name:'Notes',open:"if(!notesOpen)toggleNotes()",input:'noteInput',foreign:"o.notes=(o.notes||[]).concat([{id:'nFOREIGN',text:'FOREIGN NOTE FROM A COLLEAGUE',by:'uOther',byName:'Colleague',page:currentPage,step:currentStep,where:notesWhere(),ts:Date.now()}])",seen:'FOREIGN NOTE FROM A COLLEAGUE',where:'notesPanel',close:"if(notesOpen)toggleNotes()"},
    {name:'Team Chat',open:"if(!gchatOpen)toggleGChat()",input:'gchatInput',foreign:"o.chatMsgs=(o.chatMsgs||[]).concat([{id:'mFOREIGN',who:'CO',name:'Colleague',ts:'9:00 AM',text:'FOREIGN MESSAGE FROM A COLLEAGUE'}])",seen:'FOREIGN MESSAGE FROM A COLLEAGUE',where:'gchatPanel',close:"if(gchatOpen)toggleGChat()"},
    {name:'Org & Team',open:"openOrg();addProfile()", /* the new-member form, open, as a person types a new member's name */input:'ru_new_name',foreign:"o.enterprise=o.enterprise||{};o.enterprise.objective='FOREIGN OBJECTIVE FROM A COLLEAGUE'",seen:'FOREIGN OBJECTIVE FROM A COLLEAGUE',where:'modalRoot',close:"closeModal()"}
  ];
  P.forEach(function(p){
    w.eval(p.open);let el=w.document.getElementById(p.input);
    ok(!!el,'PANEL-DRAFT (28 Sep 2026, D-C9): the '+p.name+' panel opens with its input');if(!el)return;
    el.focus();el.value='HALF-TYPED DRAFT';el.setSelectionRange(4,4);
    const same=function(tag){const e2=w.document.getElementById(p.input);return !!e2&&e2.value==='HALF-TYPED DRAFT'&&e2.selectionStart===4&&e2.selectionEnd===4&&w.document.activeElement===e2};
    w.eval('render()');
    ok(same('render'),'PANEL-DRAFT (28 Sep 2026, D-C9): a half-typed '+p.name+' draft survives a full render, with its caret and focus');
    el=w.document.getElementById(p.input);if(el){el.focus();el.value='HALF-TYPED DRAFT';el.setSelectionRange(4,4)} /* typed afresh, so the adoption check stands on its own */
    w.eval("(function(){var o=JSON.parse(JSON.stringify(data));"+p.foreign+";o.rev=(data.rev||0)+1;Store.writeOrg(currentOrgId,o)})()");
    const adopted=w.eval('Store.refreshOrg()');
    const host=w.document.getElementById(p.where);
    ok(adopted!==false&&!!host&&String(host.textContent||host.value||'').indexOf(p.seen)>=0||(!!host&&Array.prototype.some.call(host.querySelectorAll('textarea,input'),function(x){return x.value===p.seen})),'PANEL-DRAFT (28 Sep 2026, D-C9): a colleague\u2019s write appears in the open '+p.name+' panel within one adoption cycle');
    ok(same('adoption'),'PANEL-DRAFT (28 Sep 2026, D-C9): the '+p.name+' draft survives the adoption repaint, with its caret and focus');
    w.eval(p.close);
  });
}

/* 30 Sep 2026 (QA Sweep 1, F-08, F-40): after sign-out no panel stays open over the sign-in screen, and the sign-in card is centred */
{
  const prevUser=w.eval('currentUserId');
  w.eval("if(!notesOpen)toggleNotes();if(!gchatOpen)toggleGChat();render();");
  const app0=w.document.getElementById('app');const hadSidebar=!!(app0&&app0.classList.contains('with-sidebar'));
  const hasNow=w.eval("typeof signOutNow==='function'");w.eval(hasNow?"signOutNow()":"UI.entry={step:'login',err:''};render()"); /* fails cleanly, never crashes, on a build without signOutNow */
  const app1=w.document.getElementById('app');const np=w.document.getElementById('notesPanel'),gp=w.document.getElementById('gchatPanel');
  const openCls=function(el){return !!(el&&/\bopen\b/.test(el.className||''))};
  ok(hasNow&&hadSidebar&&!!app1&&!app1.classList.contains('with-sidebar')&&!openCls(np)&&!openCls(gp)&&w.eval('!notesOpen&&!gchatOpen'), 'SESSION (30 Sep 2026, F-08, F-40): after sign-out, Notes and Team Chat are closed and #app has no sidebar class, so the sign-in card is centred');
  w.eval("Auth.setSession('"+prevUser+"');currentUserId='"+prevUser+"';UI.entry=null;render();");
}

/* 30 Sep 2026 (QA Sweep 1, F-34): the Learn page carries Back */
{
  const _rerr=w.eval("(function(){try{render();return 'ok'}catch(e){return e.message+' @ '+String(e.stack||'').split('\\n')[1]}})()");
  w.eval("go('1.1')"); /* settle on a step page first: since the seal, a sign-out returns to Home, whose template mounts asynchronously */
  w.eval("go('learn')");
  const bk=Array.prototype.some.call(w.document.querySelectorAll('#app button'),function(b){return /goBack\(\)/.test(b.getAttribute('onclick')||'')});
  const _la=w.document.getElementById('app');ok(bk, 'NAV (30 Sep 2026, F-34): the Learn page carries a Back button (render '+_rerr+'; gate '+w.eval("JSON.stringify({entry:UI.entry,org:currentOrgId,user:currentUserId,found:!!getCurrentUser()})")+', page '+w.eval('currentPage')+', back element '+!!(_la&&_la.querySelector('.learn-back'))+', app starts '+JSON.stringify(((_la&&_la.innerHTML)||'').slice(0,120))+')');
  w.eval("go('home')");
}

/* 30 Sep 2026 (QA Sweep 1, master-list question 2): the gate button refreshes in place after a typed save */
{
  let found=null;w.eval("window.__gateKeep=JSON.stringify(data);data=emptyData();render();"); /* an empty record, whose gates are closed; restored below */
  for(const st of ['1.2','2.1','2.2','2.3','2.4','2.6','3.1','4.1']){w.eval("go('"+st+"')");const b=w.document.querySelector('.done-wrap button');if(b&&b.disabled){found=st;break}}
  if(found){const b=w.document.querySelector('.done-wrap button');b.disabled=false; /* made stale on purpose */const has=w.eval("typeof refreshGateInPlace==='function'");if(has)w.eval('refreshGateInPlace()');const b2=w.document.querySelector('.done-wrap button');
    ok(has&&!!b2&&b2.disabled===true, 'GATE (30 Sep 2026, question 2): on '+found+', a stale gate button is restored to the record\u2019s state in place, without a full redraw');}
  else ok(false,'GATE (30 Sep 2026, question 2): a step with a closed gate was found to test');
  w.eval("data=JSON.parse(window.__gateKeep);render();go('home')");
}

/* 1 Oct 2026 (QA Sweep 2, N-22): an outside click closes the account menu and still reaches its control */
{
  w.eval("UI.userMenu=true;refreshNavMenus();");
  const opened=!!w.document.querySelector('.nav-user-menu')||!!w.document.querySelector('.nav-more-menu');
  const b=w.document.createElement('button');b.id='pinOutside';b.addEventListener('click',function(){w.__pinHit=(w.__pinHit||0)+1}); /* this document does not run inline onclick attributes */w.document.body.appendChild(b);
  b.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  const closed=w.eval('!UI.userMenu'),hit=w.eval('window.__pinHit||0');b.parentNode.removeChild(b);
  const noBd=!w.document.querySelector('.nav-more-backdrop');ok(opened&&closed&&hit===1&&noBd, 'MENU (1 Oct 2026, N-22): a click outside the account menu closes it and still reaches the control clicked (got '+JSON.stringify({opened:opened,closed:closed,hit:hit,noBackdrop:noBd,listener:w.eval('!!window.__userMenuOutside'),signedIn:w.eval('!!currentUserId')})+')');
}

/* 1 Oct 2026 (QA Sweep 2, F-34's remainder): Learn's Back survives a template injected after the page is drawn, as a browser's fetch does */
{
  const realScr=w.Screens;let pending=null;
  w.Screens={mount:function(n,c,o){pending=function(){c.innerHTML='<section>Learn content arrives late</section>';if(o&&o.afterMount)o.afterMount(c)}}};
  w.eval("go('learn')");if(pending)pending();
  const app=w.document.getElementById('app');const html=app?app.innerHTML:'';w.Screens=realScr;
  ok(html.indexOf('Learn content arrives late')>=0&&Array.prototype.some.call(app.querySelectorAll('button'),function(x){return /goBack\(\)/.test(x.getAttribute('onclick')||'')}), 'NAV (1 Oct 2026, F-34\u2019s remainder): Learn\u2019s Back survives a template that arrives after the page is drawn');
  w.eval("go('home')");
}

/* 1 Oct 2026 (QA Sweep 3): a held field is disabled and marked straight after a render, without waiting for the 4-second check */
{
  let pick='';for(const st of ['2.2','1.2','2.3','2.6','3.1']){w.eval("go('"+st+"')");pick=w.eval("(function(){var els=document.querySelectorAll('#app input[id],#app select[id],#app textarea[id]');for(var i=0;i<els.length;i++){var k=null;try{k=idToRecordKey(els[i].id)}catch(e){}if(k&&!els[i].disabled)return els[i].id+'|'+k}return ''})()");if(pick)break}
  const fid=pick.split('|')[0],fkey=pick.split('|').slice(1).join('|');
  w.eval("Collab.__ol=Collab.othersLocks;Collab.othersLocks=function(){return [{key:"+JSON.stringify(fkey)+",name:'Avery Pin'}]};render();");
  const el=w.document.getElementById(fid);const txt=(w.document.getElementById('app')||{}).textContent||'';
  w.eval("Collab.othersLocks=Collab.__ol;render();");
  ok(!!pick&&!!el&&el.disabled===true&&txt.indexOf('Avery Pin')>=0, 'LOCKMARK (1 Oct 2026, QA Sweep 3): a field held by another reviewer is disabled and marked straight after a render ('+fid+')');
  w.eval("go('home')");
}

/* 1 Oct 2026 (QA Sweep 3, N-3, N-9): an ordinary commit refreshes a marked control group in place */
{
  w.eval("go('3.1');var __d=(data.deployments||[])[0];UI.expandEdit=__d?'deploy_'+__d.id:null;render();"); /* the tabs and the forward button live in an open deployment card */
  const pick=()=>{const sp=w.document.querySelector('[data-gate^="dp-fwd-"]');return sp?sp.querySelector('button'):null};
  const b=pick();const was=b?b.disabled:null;if(b){b.disabled=!was;} /* made stale on purpose */
  const info=w.eval("JSON.stringify({page:currentPage,step:currentStep,org:currentOrgId,fn:typeof refreshGateInPlace,gates:document.querySelectorAll('[data-gate]').length})");
  w.eval("Store.commit('deployments')");const b2=pick();
  w.eval("UI.expandEdit=null");ok(!!b&&!!b2&&b2.disabled===was, 'GATE3 (1 Oct 2026, N-3, N-9): a stale forward button on 3.1 is restored by an ordinary commit, without a full redraw (got '+JSON.stringify({found:!!b,was:was,after:b2?b2.disabled:null})+' '+info+')');
  w.eval("go('home')");
}

/* 5 Oct 2026 (Paul): the Organization & Team page: no intro line; AI features is a fold, closed by default, that stays open across a settings change */
{
  const r=JSON.parse(w.eval("(function(){var me=getCurrentUser();if(me)me.admin=true;UI.aiFoldOpen=false;openOrg();var mr=document.getElementById('modalRoot');var html=mr?mr.innerHTML:'';var f=mr?mr.querySelector('details.ai-fold'):null;var sum=f?((f.querySelector('summary')||{}).textContent||''):'';var closed=!!f&&!f.open;UI.aiFoldOpen=true;setAiSetting('aiGuide',true);var f2=mr?mr.querySelector('details.ai-fold'):null;var stayed=!!f2&&f2.open;setAiSetting('aiGuide',false);UI.aiFoldOpen=false;var noIntro=html.indexOf('Capture the enterprise context')<0;var text=html.indexOf('When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.')>=0;closeModal();return JSON.stringify({fold:!!f,summary:sum,closed:closed,stayed:stayed,noIntro:noIntro,text:text,noOldHeading:html.indexOf('section-label mb-3\">AI features')<0})})()"));
  ok(r.fold&&r.summary==='AI Features (off by default)'&&r.closed&&r.stayed&&r.noIntro&&r.text&&r.noOldHeading, 'ORGPAGE (5 Oct 2026): the Organization & Team page has no intro line; AI features is a fold headed \u201cAI Features (off by default)\u201d, closed at first and still open after a setting changes; the AI Guide note reads as Paul worded it (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Sweep 4R item 10): the Organization & Team dialog marks a held record the moment it draws (in the sweep: the harness's page model cannot run the lock marks) */
{
  const r=JSON.parse(w.eval("(function(){var me=getCurrentUser();if(me)me.admin=true;var key='architecture-locks::'+currentOrgId;var L={};L['enterprise']={id:'someone-else',sid:'another-tab',name:'Holder',at:Date.now()};localStorage.setItem(key,JSON.stringify(L));openOrg();var el=document.getElementById('ent_name');var held=!!el&&el.disabled===true&&!!document.querySelector('#modalRoot .collab-lock-mark');localStorage.setItem(key,'{}');renderOrgModal();el=document.getElementById('ent_name');var free=!!el&&el.disabled!==true;closeModal();return JSON.stringify({held:held,free:free})})()"));
  ok(r.held&&r.free, 'ENTLOCK (5 Oct 2026, Sweep 4R item 10): when the organization\u2019s details are held elsewhere, the dialog\u2019s fields are disabled and marked as it draws; free, they are enabled (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Sweep 4R item 16, N-3): a tab's section button and helper refresh in place after a typed change */
{
  const r=JSON.parse(w.eval("(function(){go('2.2');var els=document.querySelectorAll('[data-gate^=\"tabdone-\"]');var n=els.length;var ok=false;if(n){var el=els[0],good=el.innerHTML;el.innerHTML='STALE';refreshGateInPlace();ok=el.innerHTML!=='STALE'&&el.innerHTML===good}currentPage='home';render();return JSON.stringify({marked:n,refreshed:ok})})()"));
  ok(r.marked>0&&r.refreshed, 'TABGATE (5 Oct 2026, Sweep 4R item 16): on step 2.2 a tab\u2019s section button and helper are marked for in-place refresh, and a stale one is redrawn by the refresh a save triggers (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Sweep 4R item 17, N-9): the 2.5 card's add buttons enable as the line is typed */
{
  const r=JSON.parse(w.eval("(function(){if(typeof eafBLineInput!=='function')return JSON.stringify({missing:'eafBLineInput'});var a=(data.agentRegistry||[])[0];if(!a)return JSON.stringify({note:'no workflow'});var aid=a.id;var st=eafBuildState(aid);var keep=JSON.stringify(st.s||{});st.s=st.s||{};st.s.kind='delivers';st.s.text='';var host=document.createElement('div');var inp=document.createElement('input');var b=document.createElement('button');b.setAttribute('onclick','eafBAdd(\\''+aid+'\\',true,true)');b.disabled=true;host.appendChild(inp);host.appendChild(b);document.body.appendChild(host);inp.value='The result lands here';eafBLineInput(aid,inp);var en=b.disabled===false;inp.value='';eafBLineInput(aid,inp);var dis=b.disabled===true;host.parentNode.removeChild(host);st.s=JSON.parse(keep);return JSON.stringify({enabled:en,disabledAgain:dis})})()"));
  ok(!r.note&&!r.missing&&r.enabled&&r.disabledAgain, 'EAFLAG (5 Oct 2026, Sweep 4R item 17): a 2.5 card\u2019s add button enables as soon as its line is typed, and disables again when the line is cleared (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Sweep 4R item 19): adopting a reset discards typed drafts and saves nothing */
{
  const r=JSON.parse(w.eval("(function(){if(typeof discardTypedDrafts!=='function')return JSON.stringify({missing:true});_lastResetSeen=data.resetAt||'before';var inp=document.createElement('input');inp.id='rsDraftIn';inp.value='PRE-RESET';inp.setAttribute('data-typed','1');var saved=0;inp.onchange=function(){saved++};document.body.appendChild(inp);inp.focus();data.resetAt=Date.now()+1;render();var typedLeft=document.querySelectorAll('[data-typed]').length;var ev=document.createEvent('HTMLEvents');ev.initEvent('change',true,true);inp.dispatchEvent(ev);inp.parentNode.removeChild(inp);return JSON.stringify({typedLeft:typedLeft,blurred:document.activeElement!==inp,staleSaves:saved})})()"));
  ok(!r.missing&&r.typedLeft===0&&r.blurred&&r.staleSaves===0, 'RESETDRAFT (5 Oct 2026, Sweep 4R item 19): adopting a reset keeps no typed text, blurs the field, and a change fired in that moment saves nothing (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Sweep 4R item 23): sealing empties the closed panels */
{
  const r=JSON.parse(w.eval("(function(){var gp=document.getElementById('gchatPanel'),cp=document.getElementById('coachPanel');if(!gp||!cp)return JSON.stringify({missing:true});gp.innerHTML='<div>OLD SESSION TEXT</div>';cp.innerHTML='<div>OLD SESSION TEXT</div>';gchatOpen=false;resetOrgScopedUI();var cleared=(gp.textContent||'').indexOf('OLD SESSION TEXT')<0&&(cp.textContent||'').indexOf('OLD SESSION TEXT')<0;renderGChatPanel();var rebuilt=(gp.innerHTML||'').length>0;render();return JSON.stringify({cleared:cleared,rebuilt:rebuilt})})()"));
  ok(!r.missing&&r.cleared&&r.rebuilt, 'PANELSEAL (5 Oct 2026, Sweep 4R item 23): sealing empties the closed AI Guide and Team Chat panels, and Team Chat\u2019s panel is rebuilt when drawn again (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Sweep 4R item 27): the Board member controls lock rbOrg (in the sweep: the harness's page model keeps no attributes) */
{
  const r=JSON.parse(w.eval("(function(){var el=document.createElement('input');el.setAttribute('onchange','rbEditMember(1,2,3)');return JSON.stringify({key:handlerLockKey(el)})})()"));
  ok(r.key==='rbOrg', 'RBKEY (5 Oct 2026, Sweep 4R item 27): a Board member control locks rbOrg, the key rbEditMember guards (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026: no code comment ever reaches the screen (a comment once sat inside the top bar's markup and showed as text) */
{
  const r=JSON.parse(w.eval("(function(){var bad=[];var pages=['home','learn','mgmt-hub'];function scan(tag){var t=document.body.textContent||'';if(t.indexOf('/*')>=0||t.indexOf('*/')>=0)bad.push(tag)}pages.forEach(function(p){currentPage=p;UI.navMore=false;render();scan(p);UI.navMore=true;render();scan(p+'+more');UI.navMore=false});currentPage='step';currentStep='1.1';render();scan('step 1.1');UI.navMore=true;render();scan('step 1.1+more');UI.navMore=false;try{UI.userMenu=true;render();scan('user menu');UI.userMenu=false}catch(e){}currentPage='home';render();return JSON.stringify({bad:bad})})()"));
  ok(r.bad.length===0, 'NOCOMMENT (5 Oct 2026): no code comment shows as text on Home, Learn, the management hub or a step page, with or without the More menu or the user menu open (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026 (Paul): Sample organization sits in the top bar where Notes was; Notes is in the More menu */
{
  const r=JSON.parse(w.eval("(function(){currentPage='home';UI.navMore=false;notesOpen=false;render();var navText=((document.querySelector('.nav-right')||document.querySelector('nav')||document.body).textContent||'');var top=navText.indexOf('/*')<0&&navText.indexOf('*/')<0&&!!document.getElementById('sampleNavBtn')&&!document.getElementById('notesNavBtn')&&((document.getElementById('sampleNavBtn')||{}).textContent||'').indexOf('Demo')>=0; /* 5 Oct 2026 (Paul and Faisal): labeled Demo */data.notes=(data.notes||[]).concat([{id:'nzz',text:'Sweep note'}]);UI.navMore=true;render();var items=[].slice.call(document.querySelectorAll('.nav-more-item'));var nb=items.filter(function(b){return /Notes/.test(b.textContent)})[0];var count=nb?((nb.querySelector('#notesCount')||{}).textContent||''):'';var sampleInMenu=items.some(function(b){return /Sample organization/.test(b.textContent)});if(nb)(new Function(nb.getAttribute('onclick')))(); /* the item's own handler: this sweep does not run inline handlers on click */var opened=notesOpen===true&&/open/.test((document.getElementById('notesPanel')||{}).className||'');data.notes=data.notes.filter(function(n){return n.id!=='nzz'});notesOpen=false;UI.navMore=false;render();return JSON.stringify({top:top,notesItem:!!nb,count:count,countOk:count===String((data.notes||[]).length+1),sampleInMenu:sampleInMenu,opened:opened})})()"));
  ok(r.top&&r.notesItem&&r.countOk&&!r.sampleInMenu&&r.opened, 'NAVSWAP (5 Oct 2026): the top bar shows Demo and no Notes button; the More menu has Notes with its count, and choosing it opens the Notes panel; Sample organization is not in the More menu (got '+JSON.stringify(r)+')');
}

/* 5 Oct 2026: a sample tab boots the real way (Store.ready), not by calling its pieces; with the signed-in tab's pass it shows the banner and the sample, without it only the sign-in card */
{
  const loadList=['Architecture-templates-local.js','Architecture-screen-loader.js','Architecture-home.js','Architecture-learn.js','Architecture-app.js'];
  const bootSample=(withPass)=>{
    const sd=new JSDOM(fs.readFileSync(path.join(__dirname,'Architecture-index.html'),'utf8'),{runScripts:'outside-only',url:'https://localhost/Architecture-index.html?sample=1',pretendToBeVisual:true});
    const sw=sd.window;sw.matchMedia=q=>({matches:false,addEventListener(){},addListener(){}});sw.ResizeObserver=class{observe(){}disconnect(){}unobserve(){}};sw.scrollTo=()=>{};sw.alert=()=>{};sw.confirm=()=>true;sw.print=()=>{};sw.HTMLElement.prototype.scrollTo=function(){};sw.fetch=()=>Promise.resolve({ok:false,text:()=>Promise.resolve('')});
    if(withPass)sw.localStorage.setItem('architecture-sample-pass',JSON.stringify({t:Date.now()}));
    for(const f of loadList){sw.eval(fs.readFileSync(path.join(__dirname,f),'utf8'));}
    if(withPass){try{sw.eval("go('1.1')")}catch(e){}} /* a step page too, not only the first page */
    let menu='';if(withPass){try{menu=sw.eval("UI.navMore=true;render();document.body.innerHTML")}catch(e){menu='ERR '+e.message}}
    const st=JSON.parse(sw.eval("JSON.stringify({mode:SAMPLE_MODE,org:currentOrgId,banner:((document.getElementById('sampleBanner')||{}).textContent||''),inApp:!!document.querySelector('#app #sampleBanner'),inContent:!!document.querySelector('#app .content-inner > #sampleBanner:first-child'),look:((document.getElementById('sampleBanner')||{style:{}}).style.fontSize||'')+'/'+((document.getElementById('sampleBanner')||{style:{}}).style.textAlign||''),app:((document.getElementById('app')||{}).textContent||'').length,signInCard:((document.getElementById('app')||{}).textContent||'').replace(/\s+/g,' ').trim()==='Sign in to your organization, then open Demo from the top bar.',noChatBtn:!document.getElementById('gchatNavBtn') /* RETARGETED 5 Oct 2026 (Paul and Faisal): the button is Demo, in the top bar */,passLeft:!!localStorage.getItem('architecture-sample-pass')})"));
    if(withPass)st.menuOk=menu.indexOf('sampleRestart()')>=0&&menu.indexOf('sampleClose()')>=0&&menu.indexOf('openOrg()')<0&&menu.indexOf('openAdmin()')<0&&menu.indexOf('openChangePassword()')<0;
    if(withPass){st.menuOk=st.menuOk&&menu.indexOf('Track Program')>=0&&menu.indexOf('Report Manager')>=0&&menu.indexOf('exportState()')<0&&menu.indexOf('importState()')<0; /* Sweep 4R item 5 */
      const so=JSON.parse(sw.eval("(function(){var ls0=JSON.stringify(Object.keys(localStorage).sort().map(function(k){return [k,localStorage.getItem(k)]}));var u0=currentUserId;window.__closed=false;window.close=function(){window.__closed=true};signOut();var ls1=JSON.stringify(Object.keys(localStorage).sort().map(function(k){return [k,localStorage.getItem(k)]}));return JSON.stringify({closed:window.__closed,stillSignedIn:currentUserId===u0&&!!u0,noSignIn:!(UI.entry&&UI.entry.step==='login'),storageSame:ls0===ls1})})()"));
      st.signOutOk=so.closed&&so.stillSignedIn&&so.noSignIn&&so.storageSame;st.signOut=so;}
    if(withPass){const hm=JSON.parse(sw.eval("(function(){currentPage='home';var app=document.getElementById('app');app.innerHTML='<div id=zoomWrap class=zoom-wrap><div class=hero><div class=hero-left>Home</div></div></div>';sampleNoteEnsure(); /* Home's structure, as drawn by the screen loader: the page wrapper, then the hero, with no content container */ var b=document.getElementById('sampleBanner');return JSON.stringify({page:currentPage,note:!!b,clears:!!b&&b.getAttribute('data-clears-bar')==='1'&&!!b.style.marginTop})})()"));st.homeOk=hm.page==='home'&&hm.note&&hm.clears;st.home=hm;} /* Sweep 4R item 9: on Home the note sits below the top bar */ /* 5 Oct 2026: the sample tab's More menu carries only the sample's own items */
    try{sw.close()}catch(e){} return st;
  };
  const a=bootSample(true),b=bootSample(false);
  ok(a.mode===true&&a.org==='org_sample_local'&&a.banner==='Sample organization: your changes stay in this browser only'&&a.inApp&&a.inContent&&a.look==='28px/center'&&a.app>200&&a.menuOk&&a.signOutOk&&a.homeOk&&a.noChatBtn /* 5 Oct 2026 (Paul): large and centered */ /* RETARGETED 5 Oct 2026: the first line of the page's content container, where the top bar cannot cover it */ /* RETARGETED 5 Oct 2026 (Paul): the note sits in the main content, not over the top bar */&&!a.signInCard&&!a.passLeft, 'SAMPLE BOOT (5 Oct 2026): a sample tab opened with the signed-in tab\u2019s pass boots on its own, draws the banner and the sample, and uses the pass once (got '+JSON.stringify(a)+')');
  ok(b.mode===true&&b.signInCard&&b.org!=='org_sample_local', 'SAMPLE BOOT (5 Oct 2026): a sample tab opened without the pass shows only the sign-in card (got '+JSON.stringify(b)+')');
}

/* chrome after the walk */
ok(w.document.getElementById('navTabs').innerHTML.indexOf('Framework')>=0, 'nav carries the Framework tab');
ok(w.document.getElementById('navRight').innerHTML.indexOf('Dark Mode')>=0 || w.document.getElementById('navRight').innerHTML.indexOf('Light Mode')>=0, 'theme toggle carries the family label');
ok(consoleErrors.length===0, 'zero console errors across the walk'+(consoleErrors.length?(' — first: '+consoleErrors[0]):''));

console.log('DOM sweep — '+(pass+fail)+' assertions');

/* §10 TRACE WALK (B5, 26 Aug 2026): trace a real flow through the wizard in a real DOM —
   add-new mid-trace, the backfill prompt, auto-complete — then assert the flow record, the
   local view, and the orphan view. Seed-agnostic: the walk adds its own application and
   pipeline and removes everything it added. */
{
  visit('1.3','step 1.3 for the trace walk');
  w.eval("UI.auditTab='app';UI.expandEdit=null;UI.trace=null;render();");
  const preFlows=w.eval("(data.flows||[]).length");
  w.eval("document.getElementById('ccadd_aiApplications').value='Walk trace app';audAdd('aiApplications');");
  const wApp=w.eval("data.aiApplications[data.aiApplications.length-1].id");
  ok(!!wApp, 'trace walk: the walk application is added and its card opens');
  const cardHtml=w.document.getElementById('app').innerHTML;
  ok(cardHtml.indexOf('Trace this flow')>=0, 'trace walk: the open card carries the Trace this flow affordance');
  w.eval("traceStart('"+wApp+"')");
  w.render();
  ok(!!w.eval("UI.trace&&UI.trace.appId==='"+wApp+"'"), 'trace walk: the descent opens on the card');
  w.eval("traceNext()"); /* batch A (26 Aug 2026): the descent now opens at the workflow hop — the walk app has none, so it skips exactly as a user would */
  w.render();
  /* Hop 0 (orch): add-new mid-trace — the walk pipeline is created in its register in place */
  w.eval("UI.trace.addNew='orch';render();");
  const nf=w.document.getElementById('trace_new');
  ok(!!nf, 'trace walk: the add-new field renders at the hop');
  w.eval("document.getElementById('trace_new').value='Walk pipeline';traceAddNew();");
  const wIg=w.eval("(function(){var r=data.integrations;return r[r.length-1].name==='Walk pipeline'?r[r.length-1].id:null})()");
  ok(!!wIg, 'trace walk: add-new created the component in the integrations register');
  ok(w.eval("UI.trace.picks.orch.indexOf('"+wIg+"')>=0"), 'trace walk: the new component is picked');
  /* Hop 1 (model): show all, pick via the REAL node onclick — the unlinked pick asks once */
  w.eval("traceNext()");
  const mdF=w.eval("(function(){var r=data.aiModels;for(var i=0;i<r.length;i++)if(r[i].name==='Demand forecast model')return r[i].id;return null})()");
  ok(!!mdF, 'trace walk: the forecast model exists to pick');
  w.eval("UI.trace.showAll.model=true;render();");
  const nodeEl=w.document.getElementById('ln_'+mdF);
  ok(!!nodeEl && (nodeEl.getAttribute('onclick')||'').indexOf('tracePick')>=0,
     'trace walk: the candidate renders as a pickable node on the local diagram');
  fireInline('ln_'+mdF, nodeEl?nodeEl.getAttribute('onclick')||'':'');
  w.render();
  const askHtml=w.document.getElementById('app').innerHTML;
  ok(w.eval("UI.trace.pendingBackfill==='"+mdF+"'") && askHtml.indexOf('No standing connection links')>=0,
     'trace walk: the unlinked pick raises the ask-once backfill prompt in the DOM');
  w.eval("traceBackfillAnswer(true)");
  ok(w.eval("(function(){var r=data.integrations;for(var i=0;i<r.length;i++)if(r[i].id==='"+wIg+"')return (r[i].modelLinks||[]).indexOf('"+mdF+"')>=0;return false})()"),
     'trace walk: Standing connection backfills the pipeline\u2019s model link');
  /* Hop 2 (data): fully determined by the model\u2019s training lineage — auto-completes */
  w.eval("traceNext()");
  w.render();
  const autoPicks=w.eval("JSON.stringify(UI.trace.picks.data)");
  const autoArr=JSON.parse(autoPicks);
  ok(autoArr.length===1 && w.eval("UI.trace.auto['"+autoArr[0]+"']===1"),
     'trace walk: the determined hop auto-completed from the standing connection');
  ok(w.document.getElementById('app').innerHTML.indexOf('auto-completed from a standing connection')>=0,
     'trace walk: the override banner renders');
  /* Name it through the real input and finish */
  const nameEl=w.document.getElementById('trace_name');
  if(nameEl){nameEl.value='Walk flow';fireInline('trace_name',nameEl.getAttribute('oninput')||'');}
  w.eval("traceFinish()"); /* SUPERSEDED 23 Sep 2026 (the Trace this flow directive of 23 Sep 2026 R3, with the reviewer's clarification Paul accepted): the last layer finishes through Finish here; Next layer never saves */
  const flowCount=w.eval("(data.flows||[]).length");
  ok(flowCount===preFlows+1, 'trace walk: the finished trace lands as one flow record');
  const fl=JSON.parse(w.eval("JSON.stringify(data.flows[data.flows.length-1])"));
  ok(fl.name==='Walk flow'&&fl.appId===wApp&&fl.steps.map(function(st){return st.layer}).join(',')==='orch,model,data',
     'trace walk: the record carries the name, the anchor, and the hops top-down');
  /* The local view and the orphan view reflect it */
  w.render();
  const after=w.document.getElementById('app').innerHTML;
  ok(after.indexOf('Walk flow')>=0, 'trace walk: the card lists the named flow');
  ok(w.eval("orphanIds().indexOf('"+wIg+"')")<0, 'trace walk: the traced pipeline is no orphan');
  /* Cleanup: remove only what the walk added */
  w.eval("(function(){var c=window.confirm;window.confirm=function(){return true};removeFlow('"+fl.id+"');removeComponent('aiApplications','"+wApp+"');removeComponent('integrations','"+wIg+"');window.confirm=c})()");
  ok(w.eval("(data.flows||[]).length")===preFlows, 'trace walk: cleanup restores the seeded flow count');
  w.eval("UI.trace=null;UI.expandEdit=null;render();");
}

/* 12 SAVE-GUARD WALK (23 Sep 2026, Paul: the Phase 2 review): completing Step 2.1 from any of its three tabs, cancelled or confirmed,
   never blanks the charter or the platform, because a save writes only the fields whose controls are on the page and runs only after the confirmation.
   This must run in a real page: a DOM that invents an element for any id would pass the guard vacuously. */
{
  const keep=w.eval("JSON.stringify({dg:data.dataGovernance,done:!!(data.completedSteps||{})['2.1']})");
  w.eval("(function(){var dg=data.dataGovernance=data.dataGovernance||{};dg.cadence='Monthly';dg.authority='Approve data standards';dg.escalation='Executive Board';dg.platform='Warehouse serving layer';if(!(dg.domains||[]).length)dg.domains=[{name:'Customer'}];delete data.completedSteps['2.1']})()");
  const intact=()=>w.eval("(function(){var dg=data.dataGovernance;return dg.cadence==='Monthly'&&dg.authority==='Approve data standards'&&dg.escalation==='Executive Board'&&dg.platform==='Warehouse serving layer'})()");
  ['setup','standards','review'].forEach(function(tab){
    visit('2.1','step 2.1 on its '+tab+' tab');
    w.eval("UI.dgTab='"+tab+"';render()");
    const b=[].slice.call(w.document.querySelectorAll('button')).find(function(x){return /Mark step complete/.test(x.textContent)});
    ok(!!b, 'save guard: 2.1 shows its step button on the '+tab+' tab');
    if(!b)return;
    ok(tab!=='review'||!w.document.getElementById('dg_cadence'), 'save guard: the charter controls are really absent from the review tab');
    w.eval("window.confirm=function(){return false}");w.eval(b.getAttribute('onclick'));
    ok(intact()&&!w.eval("isStepDone('2.1')"), 'save guard: cancelling completion from the '+tab+' tab leaves the charter and the platform as they were');
    w.eval("window.confirm=function(){return true}");w.eval(b.getAttribute('onclick'));
    ok(intact()&&w.eval("isStepDone('2.1')"), 'save guard: confirming completion from the '+tab+' tab keeps the charter and the platform');
    w.eval("delete data.completedSteps['2.1']");
  });
  w.eval("(function(k){data.dataGovernance=k.dg;if(k.done)data.completedSteps['2.1']=true;else delete data.completedSteps['2.1'];saveData();render()})("+keep+")");
}

/* 13 ADD-BOX WALK (23 Sep 2026, Paul): an add box empties after its entry is added. render() restores any field's last typed value,
   so a handler must empty the box before the repaint; this can only be proved in a real page. */
{
  visit('1.5','step 1.5 for the third-parties add box');
  const n0=w.eval("(data.aiDependencies||[]).length");
  const _sp=w.eval("JSON.stringify(UI.sovPart||null)");
  w.eval("UI.sovPart='inventory';sovNewDep();UI.sovDepEdit=data.aiDependencies[data.aiDependencies.length-1].id;render()");
  const did=w.eval("data.aiDependencies[data.aiDependencies.length-1].id");
  const box=w.document.getElementById('sov_dep_party_'+did);
  ok(!!box, 'add box: the new dependency shows its third-parties box');
  if(box){
    box.value='Walk vendor';w.eval("sovDepPartyAdd('"+did+"')");
    const box2=w.document.getElementById('sov_dep_party_'+did);
    ok(w.eval("JSON.stringify(data.aiDependencies.find(function(x){return x.id==='"+did+"'}).parties)")==='["Walk vendor"]', 'add box: the entry is added once');
    ok(!!box2&&box2.value==='', 'add box: the box is empty after the repaint');
  }
  w.eval("(function(){var i=data.aiDependencies.findIndex(function(x){return x.id==='"+did+"'});if(i>=0)data.aiDependencies.splice(i,1);saveData();render()})()");
  ok(w.eval("(data.aiDependencies||[]).length")===n0, 'add box: cleanup restores the inventory');
  w.eval("UI.sovPart="+_sp+";UI.sovDepEdit=null;render()");
}

/* 14 VENDOR PRODUCTS WALK (23 Sep 2026, Paul): the vendor's products are an add list whose box empties after each add */
{
  visit('1.5','step 1.5 for the vendor products add box');
  const _sp=w.eval("JSON.stringify(UI.sovPart||null)");const nv0=w.eval("(data.vendors||[]).length");
  w.eval("UI.sovPart='vendors';vendorAdd();render()");
  const vi=w.eval("data.vendors[data.vendors.length-1].id");const box=w.document.getElementById('vr_prodnew_'+vi);
  ok(!!box,'vendor products: the new vendor shows its products add box');
  if(box){box.value='Walk product';w.eval("vendorProductAdd('"+vi+"')");const box2=w.document.getElementById('vr_prodnew_'+vi);
    ok(w.eval("JSON.stringify(data.vendors.find(function(x){return x.id==='"+vi+"'}).products)")==='["Walk product"]','vendor products: the product is added once');
    ok(!!box2&&box2.value==='','vendor products: the box is empty after the repaint');}
  w.eval("removeVendor('"+vi+"');UI.sovPart="+_sp+";UI.vrOpen=null;render()");
  ok(w.eval("(data.vendors||[]).length")===nv0,'vendor products: cleanup restores the vendors');
}

/* 15 PASSING SAVE WALK (23 Sep 2026, the Phase 3 review): saving a pass keeps the remediation text whose field is no longer on the page */
{
  visit('3.2','step 3.2 for the passing save');
  const keep=w.eval("JSON.stringify(data.securityTests||[])");
  w.eval("data.securityTests=data.securityTests||[];data.securityTests[0]={status:'Pass',remediation:'Rotated every key',remStatus:'Done'};render()");
  ok(!w.document.getElementById('sec_remediation_0'),'passing save: the remediation field is not on the page for a pass');
  w.eval("saveSecTest(0)");
  ok(w.eval("data.securityTests[0].remediation")==='Rotated every key','passing save: the remediation text survives the save');
  w.eval("data.securityTests="+keep+";saveData();render()");
}

/* 16 VENDOR REMOVAL WALK (23 Sep 2026, the Phase 1 re-audit P1R-02): removing a vendor must not pour its text into the next */
{
  visit('1.5','step 1.5 for vendor removal');
  const _sp=w.eval("JSON.stringify(UI.sovPart||null)");const keep=w.eval("JSON.stringify(data.vendors||[])");
  w.eval("UI.sovPart='vendors';data.vendors=[];vendorAdd();data.vendors[0].vendorName='Removed Vendor';data.vendors[0].implications='REMOVED-TEXT';vendorAdd();UI.vrOpen=data.vendors[0].id;render()");
  const VA=w.eval("data.vendors[0].id"),VB=w.eval("data.vendors[1].id");const n0=w.document.getElementById('vr_name_'+VA),i0=w.document.getElementById('vr_implications_'+VA);
  ok(!!n0&&n0.value==='Removed Vendor'&&!!i0&&i0.value==='REMOVED-TEXT','vendor removal: the first vendor is open with its text');
  w.eval("removeVendor('"+VA+"')");w.eval("UI.vrOpen='"+VB+"';render()");
  const n1=w.document.getElementById('vr_name_'+VB),i1=w.document.getElementById('vr_implications_'+VB);
  ok(w.eval("data.vendors.length")===1&&w.eval("data.vendors[0].vendorName")==='','vendor removal: the survivor is the blank vendor');
  ok(!!n1&&n1.value===''&&!!i1&&i1.value==='','vendor removal: the survivor\u2019s fields show nothing of the removed vendor');
  w.eval("data.vendors="+keep+";UI.sovPart="+_sp+";UI.vrOpen=null;saveData();render()");
}

/* 17 IDENTITY WALK (23 Sep 2026, the stable-identity directive R3/R7): typed text returns only to its own record, organization and session */
{
  visit('1.5','step 1.5 for identity-aware restore');
  const _sp=w.eval("JSON.stringify(UI.sovPart||null)");const keep=w.eval("JSON.stringify(data.vendors||[])");
  w.eval("UI.sovPart='vendors';data.vendors=[];vendorAdd();data.vendors[0].vendorName='Vendor A';vendorAdd();data.vendors[1].vendorName='Vendor B';UI.vrOpen=data.vendors[1].id;render()");
  const VA=w.eval("data.vendors[0].id"),VB=w.eval("data.vendors[1].id");
  const b=w.document.getElementById('vr_implications_'+VB);
  ok(!!b,'identity: vendor B is open, its fields carrying B\u2019s id');
  if(b){
    b.value='B TYPED';b.dispatchEvent(new w.Event('input',{bubbles:true}));
    w.eval("removeVendor('"+VA+"')");w.render();
    ok(w.eval("data.vendors.length")===1&&w.eval("data.vendors[0].vendorName")==='Vendor B','identity: after A is removed, B remains');
    const n=w.document.getElementById('vr_name_'+VB);
    ok(!!n&&n.value==='Vendor B','identity: B\u2019s name is B\u2019s, not A\u2019s');
    ok(!w.document.getElementById('vr_name_'+VA),'identity: nothing on the page is addressed to the removed A');
  }
  w.eval("data.vendors=[];vendorAdd();UI.vrOpen=data.vendors[0].id;render()");const VC=w.eval("data.vendors[0].id");
  const c=w.document.getElementById('vr_implications_'+VC);
  if(c){c.value='CLEARED LATER';c.dispatchEvent(new w.Event('input',{bubbles:true}));c.value='';c.dispatchEvent(new w.Event('input',{bubbles:true}));w.render();}
  const c2=w.document.getElementById('vr_implications_'+VC);
  ok(!!c2&&c2.value==='','identity: a deliberately cleared field stays cleared across a redraw');
  const s1=w.eval("fieldIdentity('vr_implications_"+VC+"',document.getElementById('vr_implications_"+VC+"'))");w.eval("SESSION_GEN++");const s2=w.eval("fieldIdentity('vr_implications_"+VC+"',document.getElementById('vr_implications_"+VC+"'))");
  ok(s1!==s2,'identity: a field belongs to its session, so text captured in an earlier one can never be restored in a later one');
  ok(w.eval("document.querySelectorAll('[id^=vr_][id$=_0]').length")===0,'identity: no vendor field is addressed by a position');
  w.eval("data.vendors="+keep+";UI.sovPart="+_sp+";UI.vrOpen=null;saveData();render()");
}

/* 18 DEPLOYMENT IDENTITY WALK (23 Sep 2026, the stable-identity directive): a deployment is addressed by its id */
{
  visit('3.1','step 3.1 for deployment identity');
  const keep=w.eval("JSON.stringify(data.deployments||[])"),keepAR=w.eval("JSON.stringify(data.alignmentReviews||{})");
  w.eval("data.deployments=[{id:'dpA',name:'A test',appId:(data.aiApplications[0]||{}).id,findings:[{title:'A issue'}]},{id:'dpB',name:'B test',appId:(data.aiApplications[0]||{}).id,findings:[{title:'B issue'}]}];UI.expandEdit='deploy_dpB';UI.dpTab={dpB:1};render()");
  const bf=w.document.getElementById('dp_name_dpB');
  ok(!!bf,'deployment identity: B\u2019s fields carry B\u2019s id');
  if(bf){bf.value='B TYPED NAME';bf.dispatchEvent(new w.Event('input',{bubbles:true}))}
  w.eval("removeDeploymentById('dpA')");
  ok(w.eval("data.deployments.length")===1&&w.eval("data.deployments[0].id")==='dpB','deployment identity: deleting A leaves B');
  const bf2=w.document.getElementById('dp_name_dpB');
  ok(!!bf2&&bf2.value==='B TYPED NAME','deployment identity: B\u2019s unsaved draft survives in B\u2019s own field after an earlier deployment is deleted');
  const _bBefore=w.eval("JSON.stringify(data.deployments)"); /* 23 Sep 2026 (the Phase 2 re-audit): compare with the state immediately before the rejected write; in a real browser B's name autosaves as it is typed, so its earlier value is not the reference */
  w.eval("fldSave('dp_name_dpA','WRITE TO A',true)");
  ok(w.eval("data.deployments.length")===1&&w.eval("data.deployments[0].id")==='dpB'&&w.eval("JSON.stringify(data.deployments)")===_bBefore,'deployment identity: a write addressed to the deleted A changes nothing and does not recreate it');
  w.eval("fldSave('dpfx_title_dpB_'+data.deployments[0].findings[0].id,'B issue renamed',true)");
  ok(w.eval("data.deployments[0].findings[0].title")==='B issue renamed','deployment identity: a finding is addressed by its own id');
  w.eval("data.deployments="+keep+";data.alignmentReviews="+keepAR+";UI.expandEdit=null;UI.dpTab={};saveData();render()");
}

/* 19 CUSTOM TEST IDENTITY WALK (23 Sep 2026, the stable-identity directive) */
{
  visit('3.2','step 3.2 for custom-test identity');
  const keep=w.eval("JSON.stringify(data.securityTestsX||[])");
  w.eval("data.securityTestsX=[{id:'sxA',name:'Custom A',status:''},{id:'sxB',name:'Custom B',status:''}];UI.expandEdit='secx_sxB';render()");
  const f=w.document.getElementById('secx_method_sxB');
  ok(!!f,'custom test identity: B\u2019s fields carry B\u2019s id');
  if(f){f.value='B METHOD';f.dispatchEvent(new w.Event('input',{bubbles:true}))}
  w.eval("confirm=function(){return true};customTestRemove('securityTestsX','sxA','x')");
  const f2=w.document.getElementById('secx_method_sxB');
  ok(w.eval("data.securityTestsX.length")===1&&w.eval("data.securityTestsX[0].id")==='sxB','custom test identity: removing A leaves B');
  ok(!!f2&&f2.value==='B METHOD','custom test identity: B\u2019s editor and draft stay with B after A is removed');
  w.eval("fldSave('secx_status_sxA','Pass',true)");
  ok(w.eval("data.securityTestsX.length")===1&&w.eval("data.securityTestsX[0].status")==='','custom test identity: a write addressed to the removed A changes nothing');
  w.eval("data.securityTestsX="+keep+";UI.expandEdit=null;saveData();render()");
}

/* 20 CRITERION IDENTITY WALK (23 Sep 2026, the stable-identity directive) */
{
  visit('2.2','step 2.2 for criterion identity');
  const keep=w.eval("JSON.stringify((data.modelGovernance||{}).criteriaList||[])");
  w.eval("data.modelGovernance=data.modelGovernance||{};data.modelGovernance.criteriaList=[{id:'mcA',title:'Criterion A',desc:''},{id:'mcB',title:'Criterion B',desc:''}];UI.expandEdit='mcr_mcB';UI.stdModelTab='rules';currentPage='stdModel';render()");
  const f=w.document.getElementById('mcr_e_desc');
  ok(!!f,'criterion identity: B is open');
  if(f){f.value='B DESCRIPTION';f.dispatchEvent(new w.Event('input',{bubbles:true}))}
  w.eval("removeMgCriterion('mcA')");
  ok(w.eval("data.modelGovernance.criteriaList.length")===1&&w.eval("data.modelGovernance.criteriaList[0].id")==='mcB','criterion identity: removing A leaves B');
  ok(w.eval("UI.expandEdit")==='mcr_mcB','criterion identity: B stays open after A is removed');
  w.eval("fldSave('mcr_e_title','Renamed B',true)");
  ok(w.eval("data.modelGovernance.criteriaList[0].title")==='Renamed B','criterion identity: the open criterion\u2019s edit reaches B');
  w.eval("UI.expandEdit='mcr_mcA';fldSave('mcr_e_title','WRITE TO A',true)");
  ok(w.eval("data.modelGovernance.criteriaList.length")===1&&w.eval("data.modelGovernance.criteriaList[0].title")==='Renamed B','criterion identity: an edit addressed to the removed A changes nothing');
  w.eval("data.modelGovernance.criteriaList="+keep+";UI.expandEdit=null;UI.stdModelTab=null;saveData();go('step','2.2')");
}

/* 21 DEPENDENCY IDENTITY WALK (23 Sep 2026, the stable-identity directive) */
{
  visit('1.5','step 1.5 for dependency identity');
  const _sp=w.eval("JSON.stringify(UI.sovPart||null)");const keep=w.eval("JSON.stringify(data.aiDependencies||[])");
  w.eval("globalThis._alerted='';alert=function(m){globalThis._alerted=m};UI.sovPart='inventory';data.aiDependencies=[{id:'dvA',name:'Dependency A',parties:[],componentIds:[]},{id:'dvB',name:'Dependency B',parties:['Vendor One'],componentIds:[]}];UI.sovDepEdit='dvB';render()");
  const f=w.document.getElementById('sov_dep_desc_dvB');
  ok(!!f,'dependency identity: B is open, its fields carrying B\u2019s id');
  if(f){f.value='B DRAFT';f.dispatchEvent(new w.Event('input',{bubbles:true}))}
  w.eval("sovDelDep('dvA')");
  ok(w.eval("data.aiDependencies.length")===1&&w.eval("data.aiDependencies[0].id")==='dvB','dependency identity: removing A leaves B');
  ok(w.eval("UI.sovDepEdit")==='dvB','dependency identity: B stays open after A is removed');
  const f2=w.document.getElementById('sov_dep_desc_dvB');
  ok(!!f2&&f2.value==='B DRAFT','dependency identity: B\u2019s draft stays in B\u2019s own field');
  w.eval("fldSave('sov_dep_name_dvA','WRITE TO A',true)");
  ok(w.eval("data.aiDependencies.length")===1&&w.eval("data.aiDependencies[0].name")==='Dependency B','dependency identity: a write addressed to the removed A changes nothing and does not recreate it');
  const pb=w.document.getElementById('sov_dep_party_dvB');
  if(pb){pb.value='vendor one';w.eval("sovDepPartyAdd('dvB')")}
  ok(w.eval("JSON.stringify(data.aiDependencies[0].parties)")==='["Vendor One"]'&&/already lists that third party/.test(w.eval("globalThis._alerted")),'dependency identity: a duplicate third party is refused');
  w.eval("sovDepPartyDel('dvB','Vendor One')");
  ok(w.eval("data.aiDependencies[0].parties.length")===0,'dependency identity: a third party is removed by its name');
  w.eval("data.aiDependencies="+keep+";UI.sovPart="+_sp+";UI.sovDepEdit=null;saveData();render()");
}

/* 22 RACI IDENTITY WALK (23 Sep 2026, the stable-identity directive): an assignment belongs to its activity, not its row */
{
  visit('1.2','step 1.2 for RACI identity');
  const keep=w.eval("JSON.stringify(data.rbRaci)");
  w.eval("rbEnsure();var m0=data.rbOrg.members[0].id;data.rbRaci={activities:[{id:'raA',name:'Activity A'},{id:'raB',name:'Activity B'}],grid:{}};data.rbRaci.grid['raB_'+m0]='A';render()");
  const mid=w.eval("data.rbOrg.members[0].id");
  w.eval("rbDelActivity('raA')");
  ok(w.eval("data.rbRaci.activities.length")===1&&w.eval("data.rbRaci.activities[0].id")==='raB','RACI identity: deleting A leaves B');
  ok(w.eval("data.rbRaci.grid['raB_"+mid+"']")==='A','RACI identity: B\u2019s assignment stays with B, not re-keyed onto another row');
  w.eval("rbCycle('raA','"+mid+"')");
  ok(w.eval("Object.keys(data.rbRaci.grid).some(function(k){return k.indexOf('raA_')===0})")===false,'RACI identity: a write addressed to the deleted A writes nothing');
  w.eval("data.rbRaci="+keep+";saveData();render()");
}

/* 23 SORT AND FILTER WALK (23 Sep 2026, the stable-identity directive): sorting and filtering operate on views; every operation keeps its record.
   The Component Explorer is drawn only in the Phase 5 print body, never beside an open card, so the live surface for this test is the Testing Log's
   remediation register, whose rows carry status controls that write to their records while the register is sorted and filtered. */
{
  visit('5.4','step 5.4 for sorting and filtering the register');
  const keep=w.eval("JSON.stringify(data.deployments||[])"),keepAtl=w.eval("JSON.stringify(UI.atl||{})");
  w.eval("data.deployments=[{id:'sfD',name:'Sort test',appId:(data.aiApplications[0]||{}).id,findings:[{id:'sfF1',title:'Alpha issue',owner:'Owner One',severity:'Critical',status:'Open',remStatus:''},{id:'sfF2',title:'Zulu issue',owner:'Owner Two',severity:'Minor',status:'Open',remStatus:''}]}];currentPage='step';currentStep='5.4';currentPhase=PH.find(function(p){return p.steps.some(function(x){return x.id==='5.4'})});UI.atlTab='remediation';UI.atl={sev:'all',owner:'all',status:'open',sort:'title',group:false};render()");
  const k1='dpfx_remStatus_sfD_sfF1',k2='dpfx_remStatus_sfD_sfF2';
  ok(!!w.document.getElementById(k1)&&!!w.document.getElementById(k2),'sort and filter: both findings\u2019 status controls are on the register, each carrying its record\u2019s key');
  w.eval("UI.atl.sort='sev';render()");
  ok(!!w.document.getElementById(k2),'sort and filter: after re-sorting, Zulu\u2019s control still carries Zulu\u2019s key');
  w.eval("UI.atl.owner='Owner Two';render()");
  ok(!w.document.getElementById(k1)&&!!w.document.getElementById(k2),'sort and filter: filtering by owner hides Alpha and keeps Zulu\u2019s own control');
  const c2=w.document.getElementById(k2);
  if(c2){c2.value='Done';if(typeof c2.onchange==='function')c2.onchange.call(c2,new w.Event('change'));else w.eval("fldSave('"+c2.id+"','Done')")} /* the control's own handler, with its own id: the path a real change takes */
  ok(w.eval("data.deployments[0].findings[1].remStatus")==='Done'&&w.eval("data.deployments[0].findings[0].remStatus")==='','sort and filter: the status change through the filtered, re-sorted register reaches Zulu and only Zulu');
  w.eval("UI.atl.owner='all';render()");
  ok(!!w.document.getElementById(k1)&&w.eval("data.deployments[0].findings[0].remStatus")==='','sort and filter: clearing the filter shows Alpha again, untouched');
  w.eval("data.deployments="+keep+";UI.atl="+keepAtl+";UI.atlTab=null;saveData();render()");
}

/* 24 ADOPTION WALK (23 Sep 2026, the stable-identity directive R3/R4): another user's changes arrive while this user edits */
{
  visit('3.1','step 3.1 for adopting another user\u2019s changes');
  const keep=w.eval("JSON.stringify(data.deployments||[])"),keepAR=w.eval("JSON.stringify(data.alignmentReviews||{})");
  w.eval("data.deployments=[{id:'adA',name:'A test',appId:(data.aiApplications[0]||{}).id,findings:[]},{id:'adB',name:'B test',appId:(data.aiApplications[0]||{}).id,findings:[]}];saveData();UI.expandEdit='deploy_adB';UI.dpTab={adB:1};render()");
  const b=w.document.getElementById('dp_name_adB');
  ok(!!b,'adoption: deployment B is open');
  if(b){b.focus();b.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));b.value='B DRAFT';b.dispatchEvent(new w.Event('input',{bubbles:true}))}
  w.eval("(function(){var o=Store.readOrg(currentOrgId);o.deployments.forEach(function(d){if(d.id==='adA')d.name='A REMOTE'});Store.writeOrg(currentOrgId,o);Store.refreshOrg()})()");
  ok(w.eval("(data.deployments.find(function(d){return d.id==='adA'})||{}).name")==='A REMOTE','adoption: another user\u2019s change to A is adopted');
  const b2=w.document.getElementById('dp_name_adB');
  ok(!!b2&&b2.value==='B DRAFT','adoption: this user\u2019s draft in B survives the adoption');
  w.eval("(function(){var o=Store.readOrg(currentOrgId);o.deployments=o.deployments.filter(function(d){return d.id!=='adB'});Store.writeOrg(currentOrgId,o);Store.refreshOrg()})()");
  ok(w.eval("data.deployments.length")===1&&w.eval("data.deployments[0].id")==='adA','adoption: another user\u2019s deletion of B is adopted');
  const stray=[].slice.call(w.document.querySelectorAll('input,textarea')).filter(function(e){return e.value==='B DRAFT'});
  ok(stray.length===0,'adoption: once B is deleted elsewhere, its draft appears in no other record');
  ok(w.eval("(data.deployments[0]||{}).name")==='A REMOTE','adoption: A keeps its own value, never B\u2019s draft');
  w.eval("data.deployments="+keep+";data.alignmentReviews="+keepAR+";UI.expandEdit=null;UI.dpTab={};saveData();render()");
}

/* 25 TIER WALK (23 Sep 2026, Paul, the Phase 1 re-audit P1R-06): the tier decides whether a store has sources; the person is told first */
{
  visit('1.3','step 1.3 for the tier rule');
  const keep=w.eval("JSON.stringify(data.dataEstate||[])"),keepF=w.eval("JSON.stringify(data.flows||[])");
  w.eval("var _o=addComponent('dataEstate',{name:'Tier Origin',tier:'Base system'});var _w=addComponent('dataEstate',{name:'Tier Warehouse',tier:'Derived store',derivedFrom:[_o.id]});UI.expandEdit='aud_'+_w.id;UI.auditTab='data';render()");
  const wid=w.eval("_w.id");
  let sel=w.document.getElementById('cc_dataEstate_tier_'+wid);
  ok(!!sel,'tier: the warehouse card shows its Tier');
  w.eval("globalThis._asked='';confirm=function(m){globalThis._asked=m;return false}");
  if(sel){sel.value='Base system';sel.dispatchEvent(new w.Event('input',{bubbles:true}));if(typeof sel.onchange==='function')sel.onchange.call(sel,new w.Event('change'));else w.eval("fldSave('cc_dataEstate_tier_"+wid+"','Base system')")}
  sel=w.document.getElementById('cc_dataEstate_tier_'+wid);
  ok(/This store has recorded sources/.test(w.eval("globalThis._asked")),'tier: changing the dropdown asks first');
  ok(w.eval("compById('"+wid+"').tier")==='Derived store'&&!!sel&&sel.value==='Derived store','tier: after cancelling, the record and the dropdown both still say Derived store');
  ok(w.eval("compById('"+wid+"').derivedFrom.length")===1,'tier: after cancelling, the sources are untouched');
  w.eval("confirm=function(){return true}");
  if(sel){sel.value='Base system';sel.dispatchEvent(new w.Event('input',{bubbles:true}));if(typeof sel.onchange==='function')sel.onchange.call(sel,new w.Event('change'));else w.eval("fldSave('cc_dataEstate_tier_"+wid+"','Base system')")}
  ok(w.eval("compById('"+wid+"').tier")==='Base system'&&w.eval("compById('"+wid+"').derivedFrom.length")===0,'tier: after confirming, it is a base system with no recorded sources');
  w.eval("data.dataEstate="+keep+";data.flows="+keepF+";UI.expandEdit=null;installComponentMaps();saveData();render()");
}

/* 11 PATH WALK (23 Sep 2026, the Trace this flow directive R8): a walk anchored on a model, not an application,
   picks a store with no standing link, answers This flow only, and finishes; the model's own local view must draw the store.
   Covers the path-edge fix (R1): the edge builder starts a path's chain from its anchor. */
{
  visit('1.3','step 1.3 for the path walk');
  const preFlows2=w.eval("(data.flows||[]).length");
  const mdl=w.eval("(function(){var m=(data.aiModels||[]).find(function(x){return (data.dataEstate||[]).some(function(d){return (x.dataSources||[]).indexOf(d.id)<0})});return m?m.id:null})()");
  const st=mdl?w.eval("(function(){var m=compById('"+mdl+"');var d=(data.dataEstate||[]).find(function(x){return (m.dataSources||[]).indexOf(x.id)<0});return d?d.id:null})()"):null;
  ok(!!mdl&&!!st, 'path walk: a model and a store it has no standing link to');
  if(mdl&&st){
    w.eval("traceStartWalk('aiModels','"+mdl+"');UI.trace.hop=FLOW_HOPS.findIndex(function(h){return h.layer==='data'});render();");
    w.eval("tracePick('"+st+"');render();");
    if(w.eval("!!(UI.trace&&UI.trace.pendingBackfill)"))w.eval("traceBackfillAnswer(false);render();");
    w.eval("traceFinish();render();");
    ok(w.eval("(data.flows||[]).length")===preFlows2+1, 'path walk: the finished path lands as one record');
    const pf=JSON.parse(w.eval("JSON.stringify(data.flows[data.flows.length-1])"));
    ok(pf.anchorId===mdl, 'path walk: the record is anchored on the model');
    ok(w.eval("flowDerivedEdges().some(function(e){return e.from==='"+mdl+"'&&e.to==='"+st+"'})"), 'path walk: the path draws an edge from the model to the store');
    ok(w.eval("!flowDerivedEdges().some(function(e){return e.from===null||e.to===null})"), 'path walk: no flow edge has an empty end');
    ok(w.eval("(compById('"+mdl+"').dataSources||[]).indexOf('"+st+"')<0"), 'path walk: This flow only left the model card unchanged');
    ok(w.eval("localFlowSection('aiModels',compById('"+mdl+"')).indexOf('ln_"+st+"')>=0"), 'path walk: the model\u2019s own local view draws the store');
    w.eval("(function(){var c=window.confirm;window.confirm=function(){return true};removeFlow('"+pf.id+"');window.confirm=c})()");
    ok(w.eval("(data.flows||[]).length")===preFlows2, 'path walk: cleanup restores the flow count');
  }
  w.eval("UI.trace=null;UI.expandEdit=null;render();");
}

/* Orphan chip walk (R-A7): the standing view on the dashboard diagram */
{
  visit('5.2','the map, Step 5.2, for the orphan chip walk');
  w.eval("UI.archView='diagram';render();");
  const bar=w.document.getElementById('app').innerHTML;
  ok(bar.indexOf('on no traced flow')>=0, 'orphan walk: the chip renders once flows exist');
  w.eval("UI.diagOrphans=true;render();");
  const svgHtml=w.document.getElementById('app').innerHTML;
  ok(svgHtml.indexOf('stroke-dasharray="4,3"')>=0, 'orphan walk: orphans outline on the diagram when the view is on');
  w.eval("UI.diagOrphans=false;render();");
}

/* Walk 26 (23 Sep 2026, the Phase 3 re-audit P3R-8): a refresh deferred while focus sits on another control is held, never dropped, and never run under a click on a button; it runs once focus leaves the controls. The walk uses bare controls with no handlers of their own, as the unchanged field the reviewer tabbed into was, so nothing but the held refresh can redraw */
visit('1.1','step 1.1 for the pending-refresh walk');
{
  let renders=0;const _r=w.render;w.render=function(){renders++;return _r.apply(this,arguments)};
  const host=w.document.createElement('div');const inp=w.document.createElement('input');inp.type='text';const bt=w.document.createElement('button');bt.textContent='x';host.appendChild(inp);host.appendChild(bt);w.document.body.appendChild(host);
  inp.focus();w.deferRender();await new Promise(r=>setTimeout(r,30));const held1=renders===0&&w.deferRender._armed===true; /* the refresh is recorded as waiting, not dropped */
  bt.focus();await new Promise(r=>setTimeout(r,30));const held2=renders===0;
  bt.blur();await new Promise(r=>setTimeout(r,40));
  ok(held1&&held2&&renders>=1,'pending-refresh walk: held while focus is on a field, still held on a button, run once focus leaves the controls (held '+held1+'/'+held2+', renders '+renders+')');
  w.render=_r;if(host.parentNode)host.parentNode.removeChild(host);
}

console.log('  PASS: '+pass);
console.log('  FAIL: '+fail);
if(fail){ console.log('\nFailing:'); failures.forEach(f=>console.log('   x '+f)); process.exitCode=1; }
else console.log('   all green');
process.exit(fail?1:0);
})();
