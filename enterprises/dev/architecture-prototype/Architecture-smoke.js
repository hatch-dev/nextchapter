/* ── CANONICAL CLOCK (added 27 Aug 2026): the smoke lacked the harness's frozen clock, so four
   deadline-dependent seeded steps fell out of "done" when the real calendar rolled past 26 Aug —
   green one day, red the next, zero code change. Both realms now run at 2026-07-16 12:00,
   matching the harness (pattern: exemplar harness). ── */
const __RealDate = Date;
const __CANON = new __RealDate(2026, 6, 16, 12, 0, 0).getTime();
const __FrozenDate = class extends __RealDate {
  constructor(...a) { a.length === 0 ? super(__CANON) : super(...a); }
  static now() { return __CANON; }
};
Date = __FrozenDate; // eslint-disable-line no-global-assign
const fs=require('fs'), vm=require('vm');
function el(){return{value:'',style:{},textContent:'',_html:'',get innerHTML(){return this._html||String(this.textContent).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},set innerHTML(v){this._html=v},addEventListener(){},setAttribute(){},getAttribute:()=>null,classList:{add(){},remove(){},toggle(){},contains:()=>false},appendChild(){},querySelector:()=>null,querySelectorAll:()=>[],focus(){},scrollIntoView(){},getBoundingClientRect:()=>({top:0,left:0,width:0,height:0})}}
const els={};
const store={};
const ctx={
  Date:__FrozenDate, /* the vm realm shares the canonical clock */
  console:{log(){},warn(){},error(){}},
  document:{getElementById:id=>{if(!els[id])els[id]=el();return els[id]},createElement:()=>el(),addEventListener(){},removeEventListener(){},querySelector:()=>el(),querySelectorAll:()=>[],body:el(),documentElement:el(),readyState:'complete'},
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}},
  location:{protocol:'file:',href:''},
  navigator:{userAgent:'smoke'},
  addEventListener(){},removeEventListener(){},
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
  innerWidth:1280,innerHeight:800,
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  requestAnimationFrame:()=>0,scrollTo(){},
  confirm:function(){return true},alert:function(){},window:null,alert(){},print(){},
  getComputedStyle:()=>({getPropertyValue:()=>''})
};
ctx.window=ctx; ctx.__SUITE_SEED=true; /* 2 Oct 2026 (Spec §25.3) */ vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'Architecture-app.js'),'utf8'),ctx,{filename:'Architecture-app.js',timeout:30000}); /* 23 Sep 2026: the suite loads the app beside it; it had loaded a stale copy at a fixed path, so its results did not describe the build */
console.log('app loaded cleanly');

let pass=0,fail=0;
function T(name,fn){try{const r=fn();if(r===false)throw new Error('assert false');console.log('PASS',name);pass++}catch(e){console.log('FAIL',name,'-',e.message);fail++}}
const g=s=>vm.runInContext(s,ctx,{timeout:15000});

T('PH has 4 sovereignty steps', ()=>g("PH[0].steps.length===5&&PH[1].steps.length===7 /* 11 Sep 2026 (Paul's ruling): Enterprise Architecture Fit is Step 2.5; phase 2 is seven */&&PH[2].steps.length===4&&PH[3].steps.length===3 /* P34 FOLD 1 Sep 2026: phase 3 is FOUR \u2014 alignment folded onto the deployment card */")); /* SUPERSEDED AGAIN 28 Aug 2026 (FOLD): identity lives on 2.3 — phase 1 is five */
T('step ids present', ()=>g("['1.5','2.7','3.4','4.2'].every( /* P34 FOLD 1 Sep 2026: validation is 3.4 */function(id){return PH.some(function(p){return p.steps.some(function(s){return s.id===id})})})"));
T('getProgress totals 19 working steps', ()=>g("getProgress().total===19")); /* 11 Sep 2026 (Paul's ruling): 5+7+4+3 = 19 */ /* SUPERSEDED 7 Sep 2026 (Paul's ruling: Phase 2 is six steps; the workflow-design step folded into 2.4) */ /* P34 FOLD 1 Sep 2026: 5+7+4+3 = 19 */
/* Pin retired 14 Aug 2026 (Paul's ruling, Rollout item 45): the Why This Matters relic (ctxPanel + CTX) is deleted module-wide; the pin's subject no longer exists. Original pin: CTX entries sourced to IMD. */
T('MILESTONES entries present', ()=>g("['1.5','2.7','3.4','4.2'].every( /* P34 FOLD 1 Sep 2026 */function(id){return !!MILESTONES[id]})"));
T('CAROUSEL 4 slides each', ()=>g("['1.5','2.7','3.4','4.2'].every( /* P34 FOLD 1 Sep 2026 */function(id){return CAROUSEL_CONTENT[id]&&CAROUSEL_CONTENT[id].length===4&&CAROUSEL_CONTENT[id][0].kind==='Why'})&&CAROUSEL_CONTENT['3.1'].length===8 /* D5 (1 Sep 2026): the retired 3.4 quartet joins 3.1 on the 2.4 eight-slide precedent */"));

g("data=emptyData()");
T('sov16 renders empty', ()=>g("sov16()").includes('Sovereignty Baseline'));
T('sov25 empty-state points to 1.6', ()=>g("UI.sovTab={'2.7':'adaptSov'};UI.sovAdaptSub='understand';var _h=sov25();UI.sovTab=null;UI.sovAdaptSub=null;_h").includes('Go to Step 1.5')); /* SUPERSEDED-IN-PLACE P27 (Paul's ruling, 30 Aug 2026): 1.6 died in the FOLD — the test had enshrined the stale pointer; the baseline is 1.5 */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 opens on Data; the map sits under the Adaptive tab) */
T('sov35 renders empty', ()=>g("sov35()").includes('What Happened')); /* SUPERSEDED 2 Sep 2026 (batch C): the tests left 3.4 */ /* retargeted 1 Sep 2026: the 3.4 rebuild's empty line */
T('sov44 renders empty', ()=>g("sov44()").includes('Operationalize Sovereignty'));
T('sovereignIndex null when unmeasured', ()=>g("sovereignIndex().composite===null"));
T('dispatch wired', ()=>g("renderStepContent('1.5')").includes('Sovereignty Baseline') /* FOLD */&&g("renderStepContent('2.7')").includes('Sovereignty Planning') /* P2R */ /* B3 */&&g("renderStepContent('3.4')").includes('Sovereignty Validation') /* P34 FOLD */&&g("renderStepContent('4.2')").includes('Operationalize'));

g("data=emptyData();"
+"data.sovereigntyAssessment={dataSov:'4',infraSov:'3',decisionSov:'2',adaptSov:'2'};"
+"data.aiDependencies=["
+"{name:'Foundation model API',provider:'VendorX',chosen:'Consciously chosen',governed:'Actively governed',exitable:'Effectively locked in',layer:'Model & Algorithm',quadrant:'hard',mitigation:'Second provider behind gateway'},"
+"{name:'Sentiment dashboard',provider:'VendorY',chosen:'Drifted into',governed:'Running on its own',exitable:'Exitable',layer:'Application',quadrant:'soft',mitigation:'Quarterly alternatives scan'},"
+"{name:'Vector store',provider:'VendorZ',chosen:'Consciously chosen',governed:'Actively governed',exitable:'Exitable',layer:'Data & Storage',quadrant:'none',mitigation:''}];"
+"data.sovereigntyTests=["
+"{kind:'Exit test',target:'Foundation model API',finding:'Data exits cleanly, prompts do not',grade:'Fail'},"
+"{kind:'Assumption interrogation',target:'Sentiment dashboard',finding:'Recency weighting nobody chose',grade:'Partial'}];"
+"data.sovereigntyOps={owner:'COO',cadence:'Quarterly',forum:'Monthly control tower',authRetire:'Granted',authSwitch:'Not yet',authRebal:'Granted',judgment:'One decision per quarter run without the tool'};");

T('sov16 shows flags + clean marker', ()=>{const h=g("UI.sovPart='inventory';var _h=sov16();UI.sovPart=null;_h"); /* SUPERSEDED 2 Sep 2026 (Paul's ruling: questions and answers; three tabs on 1.5) */return h.includes('drifted into or running on its own')&&h.includes('Governed or running on its own? ') /* retargeted 1 Sep 2026: the exit question moved to 2.7 */}); /* SUPERSEDED 3 Sep 2026 (Paul's ruling: the inventory and vendor entries follow the standard bar \u2014 name on the bar, click to open and close, no summary) */
T('sov25 quadrant grid matches Figure 1', ()=>{const h=g("UI.sovTab={'2.7':'adaptSov'};UI.sovAdaptSub='understand';var _h=sov25();UI.sovTab=null;UI.sovAdaptSub=null;_h");return h.includes('Soft Lock-in/Conceptual Capture')&&h.includes('Hard Lock-in')&&h.includes('Learning Limitations')&&h.includes('Rebalancing Deficit')&&h.includes('Blindness')&&h.includes('Rigidity')&&h.includes('External')&&h.includes('Internal')}); /* SUPERSEDED-IN-PLACE SV6 (31 Aug 2026): the ruled nomenclature */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 opens on Data; the map sits under the Adaptive tab) */
T('sov25 quadrants carry paths out', ()=>{const h=g("UI.sovTab={'2.7':'adaptSov'};UI.sovAdaptSub='understand';var _h=sov25();UI.sovTab=null;UI.sovAdaptSub=null;_h");return (h.match(/Path out/g)||[]).length===4}); /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 opens on Data; the map sits under the Adaptive tab) */
T('sov44 path tracker renders with statuses', ()=>{const h=g("sov44()");return !h.includes('Path to Adaptive Sovereignty')&&h.includes('The Sovereignty Owner')&&h.includes('Monitoring by Dimension')&&h.includes('Conditions for Human Judgment')}); /* SUPERSEDED 3 Sep 2026 (Paul's ruling: the path tracker retired; the owner, the monitoring cells, and the judgment card remain) */ /* SUPERSEDED-IN-PLACE SV6: the ruled nomenclature */
T('sov35 grade strip renders', ()=>{const h=g("sov35()");return h.includes('sov-strip')&&h.includes('Completed 0')}); /* SUPERSEDED 2 Sep 2026 (batch C): the dimension strip and the action counter */
T('sov44 fields render', ()=>g("sov44()").includes('COO'));
const idx=g("JSON.stringify(sovereignIndex())");
console.log('  index =',idx);
T('index carries four dimensions and a composite', ()=>{const s=JSON.parse(idx);return s.dims.length===4&&s.composite>0&&s.composite<=100&&typeof s.exposure==='number'}); /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the index is conditions met and external exposure, 60/40) */
T('index counts: 3 deps, 2 flagged, 2 drills, owner', ()=>{const s=JSON.parse(idx);return s.depCount===3&&s.flagged===1&&s.actions===0 /* SUPERSEDED 2 Sep 2026 (batch C): actions replace drills; this world has none */ /* flagged 2→1, 1 Sep 2026: two-question flags, from the run */&&s.ownerNamed===true});
T('index is the 60/40 aggregate of conditions met and external exposure', ()=>{const s=JSON.parse(idx);if(s.conditions===null||s.exposure===null)return s.composite===(s.conditions!==null?s.conditions:s.exposure);return s.composite===Math.round(s.conditions*0.6+s.exposure*0.4)}); /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the index is conditions met and external exposure, 60/40) */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling): the adaptive ops input reads monitoring in place \u2014 this world names an owner and monitors nothing, 8 from the run */ /* SUPERSEDED 2 Sep 2026 (batch C): the test grades left the index; an unmarked world reads the dependency and ops inputs alone — 67/67/67/92 from the run */ /* SUPERSEDED 2 Sep 2026 (batch A): adaptive items are user-marked, so an unmarked world gives Adaptive no program input — 46 from the run (exit drills 0, ops 92) */ /* SUPERSEDED 2 Sep 2026 (Rung 0 build, Paul's ruling): the self-scores are gone from the index; each dimension takes its program share instead — 67/67/59/54 read from the run (adaptive: three derived items Done, forum In progress, one unmarked = 70; with exit drills 0 and ops 92) */ /* 52 restored 1 Sep 2026: the 54 was a defect (the index read the old kind name and silently dropped assumption grades), not a consequence — caught on Paul's challenge, formula fixed */
T('dashboard renders Sovereignty Index', ()=>{const h=g("currentPage='phase5';renderDashboard()");return h.indexOf('Sovereignty Index')>-1});
T('dashboard tiles navigate to standing surfaces', ()=>{const h=g("renderDashboard()");return h.includes("go('5.3')")&&!h.includes("go('1.5')")&&!h.includes("go('4.2')")&&!h.includes("go('2.7')")&&!h.includes("go('3.4')")}); /* SUPERSEDED 4 Sep 2026 (Rollout item 34) */

g("data=emptyData()");
T('1.5 gated when empty', /* FOLD */ ()=>g("sov16()").includes('Answer every question on the Baseline Assessment')); /* SUPERSEDED 2 Sep 2026 (batch A) */
T('sovereignty carousels carry no drills', ()=>!g("JSON.stringify([CAROUSEL_CONTENT['1.5'],CAROUSEL_CONTENT['2.7'],CAROUSEL_CONTENT['3.4'],CAROUSEL_CONTENT['4.2']])").includes('drill')); /* Rung 0 batch 5, 2 Sep 2026 */
T('4.2 renders monitoring by dimension', ()=>g("sov44()").includes('Monitoring by Dimension')); /* Rung 0 batch 4, 2 Sep 2026 */
T('3.4 renders the outcomes card', ()=>g("sov35()").includes('What Happened')); /* SUPERSEDED 2 Sep 2026 (batch B) */ /* Rung 0 batch 3, 2 Sep 2026 */
T('2.7 renders the sovereignty plan', ()=>{const h=g("UI.sovTab={'2.7':'dataSov'};var _h=sov25();UI.sovTab=null;_h");return h.includes('sov-strip')&&h.includes('The Actions')}); /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 bars carry the baseline inside, editable; adaptive sub-tabs; the action line on the strip) */ /* SUPERSEDED 2 Sep 2026 (batch B): the component */ /* Rung 0 batch 2, 2 Sep 2026 */
T('1.5 renders the sovereignty program', ()=>{const h=g("UI.expandEdit='sovi_d1';var _h=sov16();UI.expandEdit=null;_h");return h.includes('Baseline Assessment')&&h.includes('sov_prog_d1_status')&&h.includes('sov-strip')}); /* SUPERSEDED 2 Sep 2026 (Paul's ruling, evening: the 1.5 bar is a door \u2014 title only; question, answer, and fields inside) */ /* SUPERSEDED 2 Sep 2026 (batch A): the strip-and-tabs component */ /* Rung 0, 2 Sep 2026 */
T('1.5 strip switches tabs', ()=>g("sovSetTab('1.5','infraSov');var _h=sov16();UI.sovTab=null;_h").includes('Providers at each layer')); /* batch A, 2 Sep 2026 */
T('program status routes and scores', ()=>g("fldSave('sov_prog_d1_status','Yes',true);var _v=sovDimScore('dataSov');data.sovProgram={items:{},steps:[],monitor:{}};_v")===17); /* Rung 0, 2 Sep 2026 — the probe restores the empty world it borrowed */ /* SUPERSEDED 2 Sep 2026 (Rung 0): the gate asks for a status on every program item and both questions per dependency */ /* SUPERSEDED 2 Sep 2026 (Paul's ruling: questions and answers; three tabs on 1.5) */
T('dashboard empty-state offers the Sovereignty Center', ()=>g("renderDashboard()").includes('Go to Sovereignty Center')); /* SUPERSEDED 6 Sep 2026 (the glance card's donut is the door) */ /* SUPERSEDED 4 Sep 2026 (Rollout item 34: dashboard tiles route to standing surfaces, never builder steps) */

// step numbering checks
g("data=emptyData();currentPage='step';currentStep='1.5';currentPhase=PH[0]"); /* FOLD */
T('step title carries number', ()=>g("renderStep()").includes('1.5 Sovereignty Baseline')); /* FOLD */
T('sidebar rows carry numbers', ()=>{g("currentPage='step';currentStep='2.7';toggleNavPhase(1);toggleNavPhase(2);toggleNavPhase(4);renderSidebar()");const sb=g("document.getElementById('pipSidebar').innerHTML");return sb.includes('2.7 Sovereignty Planning') /* 11 Sep 2026: renumbered */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling: the name) */&&sb.includes('1.5 Sovereignty Baseline')&&sb.includes('4.2 Operationalize Sovereignty') /* SUPERSEDED 26 Aug 2026 (B3 renumber) */});

T('sidebar phase heads carry numbers', ()=>{const sb=g("renderSidebar();document.getElementById('pipSidebar').innerHTML");return sb.includes('1 Map')&&sb.includes('2 Build')&&sb.includes('3 Test')&&sb.includes('4 Embed')&&sb.includes('5 Manage')});

// dashboard expansion checks
g("data=emptyData()");
T('ARI zero when nothing is done', ()=>g("archReadinessIndex().composite===0&&archReadinessIndex().coverage===null")); /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the index is half steps, half five measures chosen for this module) */
T('markStepDone stamps stepDoneAt', ()=>g("markStepDone('1.1');!!data.stepDoneAt['1.1']"));
g("data=emptyData();"
+"data.assessments={techBaseline:{data:{quality:4,governance:3,accessibility:4}}};"
+"data.riskScenarios=[{likelihood:2,impact:3,timeHorizon:2},{likelihood:4,impact:4,timeHorizon:4}];"
+"data.dataEstate=[{governanceStatus:'Formally governed'},{governanceStatus:'Ungoverned'}];"
+"data.shadowRemediation=[{decision:'Formalize'},{decision:''}];"
+"data.securityTests=[{status:'Pass'},{status:'Fail'}];data.cascadeTests=[{tested:true},{tested:false}];"
+"data.skillsInventory=[{decision:'Hire'},{decision:''}];"
+"data.sovereigntyAssessment={dataSov:'3',infraSov:'3',decisionSov:'3',adaptSov:'3'};"
+"data.stepDoneAt={'1.1':'2026-07-01T10:00:00Z','1.2':'2026-07-08T10:00:00Z'};data.completedSteps={'1.1':true,'1.2':true};");
T('ARI composes five measures and completion', ()=>{const r=g("JSON.stringify(archReadinessIndex())");const o=JSON.parse(r);return o.measures.length===5&&o.composite>0&&o.composite<=100&&typeof o.completion==='number'}); /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the index is half steps, half five measures chosen for this module) */
T('dashboard shows the dial + the stack hero', ()=>{const h=g("currentPage='phase5';renderDashboard()");return h.includes('Architecture Readiness')&&h.includes('How is this scored?')&&!h.includes('out-quarterly')&&h.includes('\u2B1B Stack')&&h.includes("go('5.2')")}); /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the stack is the dashboard's hero; the map lives on 5.2) */ /* SUPERSEDED 5 Sep 2026 (Paul's browser pass: the dial is the Readiness Index, one card; the rings retired; the census group is the floor) */ /* SUPERSEDED 4 Sep 2026 (Paul's browser pass) */ /* SUPERSEDED 4 Sep 2026 (Paul's ruling: the dashboard's tabs retire; the map is Step 5.2 and the analytics Step 5.4) */
T('analytics renders its cards', ()=>{const h=g("renderStepContent('5.5')");return ['Analytical Signals','Five-Layer Radar','Remediation Pipeline','Testing Readiness','Governance Assessed by Layer','Sovereignty by Dimension','Conformance by Rule','90-Day Burnup','Program Velocity','Team Load','What the Program Delivered','Provider Exposure Map','Top Exposures','Metric Trends','Gaps'].every(k=>h.includes(k))}); /* SUPERSEDED 9 Sep 2026 (Paul's ruling: the Analytics page in the Governance module's form) */ /* SUPERSEDED 4 Sep 2026 (Paul's ruling: 5.4 rebuilt — delivered first, then shape, then time; severity, resilience, and failure-mode charts absorbed) */
T('burn-up draws from stepDoneAt', ()=>{const h=g("anBurnup()");return /<(polyline|path)\b/.test(h)&&/TODAY/.test(h)&&/steps? (ahead of|behind) the 90-day pace/.test(h)}); /* retargeted 23 Sep 2026: the burn-up is live on the Analytics page, drawn by anBurnup; Claude had wrongly called it dead during the dead-code census (only renderDashAnalytics, an older copy, was dead) */
T('Track Program burn-up draws', ()=>{const h=g("mgBurnup()");return /<(polyline|path)\b/.test(h)&&/TODAY|Today/.test(h)}); /* 23 Sep 2026 (Paul): the burn-up also lives on the Track Program page, drawn by mgBurnup */
g("UI.dbTab='map'");

// Track Program checks
g("data=emptyData()");
T('mgSteps counts 19 (Manage excluded via Ongoing)', ()=>g("mgSteps().length===19")); /* 11 Sep 2026 (Paul's ruling): phase 2 is seven */ /* SUPERSEDED 7 Sep 2026 (Paul's ruling: Phase 2 is six steps; the workflow-design step folded into 2.4) */ /* P34 FOLD 1 Sep 2026: 19 */
T('stampStepDone is the single writer path', ()=>g("stampStepDone('2.2');data.completedSteps['2.2']===true&&!!data.stepDoneAt['2.2']"));
T('mgStats null clock without startDate', ()=>{const r=JSON.parse(g("JSON.stringify(mgStats())"));return r.day===null&&r.elapsed===0&&r.done===1}); /* SUPERSEDED 9 Sep 2026 (Paul's ruling: the hub in the Governance module's form) */
g("data.startDate=new Date(Date.now()-9*864e5).toISOString().slice(0,10);data.stepDue={'1.1':'2020-01-01','1.2':'2099-01-01'}");
T('mgStats computes day, delta, overdue', ()=>{const r=JSON.parse(g("JSON.stringify(mgStats())"));return r.day===10&&typeof r.delta==='number'&&r.overdue===1});
T('mgDueSave persists', ()=>g("mgDueSave('1.3','2026-08-01');data.stepDue['1.3']==='2026-08-01'"));
T('hub renders all sections', ()=>{const h=g("UI.mgTab=0;mgmtHubContent()")+g("UI.mgTab=1;mgmtHubContent()");g("UI.mgTab=0");return h.includes('Track')&&h.includes('90-Day Burn-up')&&h.includes('Program Velocity')&&h.includes('Workload by Member')&&h.includes('This Week')&&h.includes('Signals')&&h.includes('Sovereignty Baseline')}); /* SUPERSEDED 9 Sep 2026 (Paul's ruling: the hub in the Governance module's form) */ /* FOLD */
// signed-in fixture — the entry gate blanks the nav when signed out
g("UI.entry=null;if(!USERS.length)USERS.push({id:'u1',name:'Test User',passcode:'1234'});currentOrgId=currentOrgId||'smoke-org';currentUserId=USERS[0].id");
T('hub routes via render dispatch', ()=>{g("currentPage='mgmt-hub';render()");const app=g("document.getElementById('app').innerHTML");return app.includes('Track <em>Program</em>')}); /* SUPERSEDED 9 Sep 2026 (Paul's ruling: the hub in the Governance module's form) */
T('More menu: Track Program first actionable item', ()=>{g("data.settings=data.settings||{};data.settings.voice=true;UI.navMore=true;currentPage='mgmt-hub';render()"); /* RETARGETED 2 Oct 2026 (Spec §25.2): the Voice item shows only while Voice is on */const nr=g("document.getElementById('navRight').innerHTML");const ti=nr.indexOf('Track Program'),vi=nr.indexOf('Voice');return ti>-1&&vi>-1&&ti<vi&&nr.includes("go('mgmt-hub')")&&nr.indexOf('nav-more-item active')>-1});
g("UI.navMore=false;currentUserId=null;currentOrgId=null");
g("UI.navMore=false;data=emptyData()");

// visual pass checks
g("data=emptyData();data.sovereigntyAssessment={dataSov:'4',infraSov:'3',decisionSov:'2',adaptSov:'2'};"
+"data.aiDependencies=[{name:'Model API',provider:'X',chosen:'Consciously chosen',governed:'Actively governed',exitable:'Effectively locked in',layer:'Model & Algorithm',quadrant:'hard',mitigation:'gw'},{name:'Dashboard',provider:'Y',chosen:'Drifted into',governed:'Running on its own',exitable:'Exitable',layer:'Application',quadrant:'soft',mitigation:''}];"
+"data.sovereigntyTests=[{kind:'Exit test',target:'Model API',finding:'x',grade:'Fail'},{kind:'Assumption interrogation',target:'Dashboard',finding:'y',grade:'Pass'}];");
T('journey strip on all four steps', ()=>['sov16()','sov25()','sov35()','sov44()'].every(fn=>{const h=g(fn);return h.includes('Assess')&&h.includes('Operationalize')&&h.includes('border-radius:16px')}));
T('1.6 radar redraws from scores', ()=>{const h=g("sov16()");return h.includes('Your Sovereignty Shape')&&h.includes('<polygon')&&h.includes('Baseline Assessment')&&h.includes('Dependency Inventory')}); /* SUPERSEDED 2 Sep 2026 (Paul's ruling: questions and answers; three tabs on 1.5) */
T('1.6 verdict dots render', ()=>{const h=g("UI.sovPart='inventory';var _h=sov16();UI.sovPart=null;_h"); /* SUPERSEDED 2 Sep 2026 (Paul's ruling: questions and answers; three tabs on 1.5) */return (h.match(/border-radius:6px/g)||[]).length>=4 /* two dots per dependency, 1 Sep 2026 */});
T('2.5 quadrant chips carry names', ()=>{const h=g("UI.sovTab={'2.7':'adaptSov'};UI.sovAdaptSub='understand';var _h=sov25();UI.sovTab=null;UI.sovAdaptSub=null;_h");const i=h.indexOf('Hard lock-in');return h.indexOf('Model API',i)>-1&&h.includes('Dependency Locations')}); /* SUPERSEDED-IN-PLACE SV5 (31 Aug 2026): the ruled heading rename */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 opens on Data; the map sits under the Adaptive tab) */
T('2.5 stack map places chips on layers', ()=>{const h=g("UI.sovTab={'2.7':'adaptSov'};UI.sovAdaptSub='understand';var _h=sov25();UI.sovTab=null;UI.sovAdaptSub=null;_h");const i=h.indexOf('Dependency Locations');const j=h.indexOf('Locate Each Dependency on the Grid');return h.slice(i,j).includes('Model API')&&h.slice(i,j).includes('MODEL & ALGORITHM')===false}); /* SUPERSEDED-IN-PLACE SV5 (31 Aug 2026): the ruled heading renames */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 opens on Data; the map sits under the Adaptive tab) */
T('3.5 grade donut renders', ()=>{const h=g("UI.expandEdit='sovr_d1';var _h=sov35();UI.expandEdit=null;_h");return !h.includes('GRADED')&&h.includes('Where it started')&&h.includes('Show the baseline')&&h.includes('Not answered at the baseline')}); /* retargeted 23 Sep 2026 (Paul's mechanical ruling on the Phase 3 copy pass: at the baseline) */ /* SUPERSEDED 23 Sep 2026 (Paul, the 3.4 card): the open item is a card — The question, Where it started (Answer at the baseline, Show/Hide the baseline, Edit), What was done (actions as subordinate rows, their status in coloured text), Where your answer stands now */ /* this world never answered d1, so the question is not asked again; the folded baseline and the label are what an open unanswered bar shows */ /* SUPERSEDED 3 Sep 2026 (Paul's ruling: 2.7 opens on Data; the map sits under the Adaptive tab) */ /* SUPERSEDED 2 Sep 2026 (batch C): the donut is gone; items carry Answer now */ /* retargeted 1 Sep 2026 (Paul's ruling): the donut counts graded/total, not a score */ /* SUPERSEDED 2 Sep 2026 (Paul's ruling: questions and answers; three tabs on 1.5) */
T('dashboard: the dial and the glance card', ()=>{const h=g("currentPage='phase5';renderDashboard()");return h.includes('Architecture Readiness')&&h.includes('AI Architecture <em>at a Glance</em>')&&!h.includes('Next \u2014')}); /* SUPERSEDED 6 Sep 2026 (Paul's ruling: the glance card in the Governance style; the Sovereignty Index card lives on the Center only) */ /* SUPERSEDED 5 Sep 2026 (Paul's ruling: the Sovereignty Index card is the radar, the score, and three figures; the next-action line and the Owner tile are gone) */
g("data=emptyData()");
T('dashboard empty sov card prompts 1.6', ()=>g("renderDashboard()").includes("go('5.3')")); /* SUPERSEDED 4 Sep 2026 (Rollout item 34: dashboard tiles route to standing surfaces, never builder steps) */

// seed checks — run the seed and verify every consumer renders
g("window.confirm=function(){return true};this.confirm=window.confirm;data=emptyData();seedData('full')");
T('seed: findings are objects with severity', ()=>g("data.deployments.length===2&&data.deployments.every(function(d){return d.findings.every(function(f){return f.title&&f.severity})})"));
T('seed: Top Exposures ranks the seeded findings', ()=>{const h=g("renderStepContent('5.5')");return h.includes('Top Exposures')&&h.includes('fifteen-point scale')}); /* SUPERSEDED 4 Sep 2026 (Paul's ruling: 5.4 rebuilt — delivered first, then shape, then time; severity, resilience, and failure-mode charts absorbed) */
T('seed: all 20 steps complete with stamps', ()=>g("Object.keys(data.completedSteps).length===19&&Object.keys(data.stepDoneAt).length===19&&!!data.startDate /* 11 Sep 2026: 19 */")); /* P34 FOLD 1 Sep 2026: 19 — the alignment step retired into the card */
T('seed: sovereign index fully composed', ()=>{const r=JSON.parse(g("JSON.stringify(sovereignIndex())"));return r.dims.every(d=>d.score!==null)&&r.depCount===6&&r.actions===7&&r.ownerNamed}); /* SUPERSEDED 2 Sep 2026 (batch C): actions, not tests */
T('seed: Track Program hub at the canonical instant', ()=>{const h=g("UI.mgTab=1;mgmtHubContent()");g("UI.mgTab=0");const st=JSON.parse(g("JSON.stringify(mgStats())"));return h.includes(st.done+' / '+st.total)&&st.total===19&&h.includes('<path d=')&&h.includes('day 30')}); /* the Governance module's hub counts completions as recorded, not by the clock */ /* SUPERSEDED 9 Sep 2026 (Paul's ruling: the hub in the Governance module's form) */
/* RETARGETED 27 Aug 2026: the old '20/20' was a real-date artifact of the test's authoring day —
   the smoke had no frozen clock, so the assert went red the morning the calendar rolled past it,
   with zero code change. Both smoke realms now run the canonical instant (2026-07-16), where the
   seeded hub truth is 5/20. */
g("UI.dbTab='map';data=emptyData()");

// Review Board org + RACI checks
g("data=emptyData();rbEnsure()");
T('rbEnsure seeds editable sample data', ()=>g("data.rbOrg.members.length===7&&data.rbRaci.activities.length===8")); /* Y3 (Paul's ruling, 28 Aug 2026): the eighth default activity — Review AI candidate applications */
T('org chart draws nodes + reporting lines', ()=>{const h=g("rbOrgChartSVG('app')");return h.includes('<rect')&&h.includes('<path')&&h.includes('Board Chair')&&h.includes('SPONSOR')});
T('RACI table renders with one-A validation', ()=>{const h=g("rbRaciTable(true,'app')");return h.includes('Sovereignty reassessment')&&h.includes('Review AI candidate applications')&&h.includes('>A<')&&h.includes('Accountable')}); /* Y3: the new standing item renders; it starts unassigned, so the no-A hint may legitimately show */
T('rbCycle cycles a cell', ()=>g("(function(){var a0=data.rbRaci.activities[0].id;data.rbRaci.grid[a0+'_m4']='';rbCycle(a0,'m4');rbCycle(a0,'m4');return data.rbRaci.grid[a0+'_m4']==='A'})()")); /* retargeted 23 Sep 2026 (the stable-identity directive): the Board is addressed by id — activity ids for the RACI grid, member ids for deletion */
T('one-A warning fires on double A', ()=>{const h=g("rbRaciTable(true,'app')");return h.includes('2 accountable')}); /* retargeted 23 Sep 2026 (Paul): the warning reads '2 accountable' */
T('member delete cleans grid + parents', ()=>{g("globalThis.__m2=data.rbOrg.members[2].id;rbDelMember(__m2)");return g("data.rbOrg.members.length===6&&Object.keys(data.rbRaci.grid).every(function(k){return k.split('_')[1]!==__m2})")}); /* retargeted 23 Sep 2026 (the stable-identity directive): the Board is addressed by id — activity ids for the RACI grid, member ids for deletion */
T('fullscreen overlay renders and closes', ()=>{g("rbFullscreen('raci')");const h=g("rbOverlay()");g("rbFullscreen(null)");return h.includes('position:fixed')&&h.includes('RACI Matrix')&&g("rbOverlay()")===''});
T('board card leads with the visual', ()=>{const h=g("currentPage='phase5';var _h=renderDashboard();_h");const i=h.indexOf('Architecture Review Board</h3>');return i>=0&&h.indexOf('<svg',i)>=0&&h.indexOf('<svg',i)<h.indexOf('Edit the Board',i)}); /* SUPERSEDED 6 Sep 2026 (Paul's ruling: the Board is a fixed open card, chart first) */
T('print doc builds dark-on-white', ()=>{g("var _docs=[];window.open=function(){return{document:{write:function(x){_docs.push(x)},close:function(){}},focus:function(){}}};rbPrintPDF()");return g("_docs[0]").includes('#1A1612')&&g("_docs[0]").includes('RACI Matrix')});
T('4.1 embeds the full visual component', ()=>{const h=g("renderStepContent('1.2')"); /* B3: the board is 1.2 */return h.includes('Structure & RACI')&&h.includes('<rect')&&h.includes('Sovereignty reassessment')&&h.includes('Edit the Board')});
T('overlay is global — renders on step pages too', ()=>{g("data=emptyData();rbEnsure();UI.entry=null;if(!USERS.length)USERS.push({id:'u1',name:'Test User',passcode:'1234'});currentOrgId=currentOrgId||'smoke-org';currentUserId=USERS[0].id;rbFullscreen('org');currentPage='step';currentStep='2.1';render()");const app=g("document.getElementById('app').innerHTML");g("rbFullscreen(null)");return app.includes('position:fixed')&&app.includes('Board Structure')});
g("UI.dbTab='map';data=emptyData()");

// nav renames + theme + editor + output visuals
T('nav tabs renamed', ()=>{const nav=g("(function(){var p=[{id:'home',l:'Home'},{id:'learn',l:'Learn'},{id:'readiness',l:'Framework'},{id:'phase5',l:'Dashboard'},{id:'insights',l:'Insights'}];return 1})()")&&g("currentPage='phase5';render();document.getElementById('navTabs').innerHTML");return nav.includes('Framework')&&nav.includes('Dashboard')&&!nav.includes('Tech Stack')});
/* Superseded 14 Aug 2026 (Paul's conformance approval; Spec 5A.7): dark-forced boot retired - light default, persisted preference. */
T('theme defaults light, toggle flips, preference persists', ()=>{g("setTheme('light')");const a=g("UI.theme==='light'");g("toggleTheme()");const b=g("UI.theme==='dark'&&localStorage.getItem('architecture-theme')==='dark'");g("setTheme('light')");return a&&b&&g("UI.theme==='light'")});
/* Superseded 14 Aug 2026 (same ruling): family labels Dark Mode / Light Mode (Spec 5A.7, Rollout item 20). */
T('nav shows family theme toggle beside Help', ()=>{g("setTheme('light');render()");const nr=g("document.getElementById('navRight').innerHTML");const hi=nr.indexOf('? Help'),ti=nr.indexOf('Dark Mode');return hi>-1&&ti>-1&&ti>hi&&nr.includes('toggleTheme()')});
T('editor sits before chart and RACI', ()=>{g("data=emptyData();rbEnsure();UI.rbEditorClosed=undefined");const h=g("rbSection()");const e=h.indexOf('Edit the Board'),c=h.indexOf('<rect'),r=h.indexOf('>Activity</th>');return e>-1&&c>-1&&r>-1&&e<c&&c<r});
T('editor panel open by default', ()=>{g("data=emptyData();rbEnsure();UI.rbEditorClosed=undefined");const h=g("rbEditorPanel()");return h.includes('+ Add member')});
// output visuals — seed then render every output page
g("window.confirm=function(){return true};data=emptyData();seedData('full')");
/* retargeted 29 Aug 2026 (AS1/AS2, Paul's rulings): out-readiness (no movement to plot in
   phase 1) and out-archmap (the stat block leads the page itself) carry NO glance. */
T('RETIRED 22 Sep 2026 (was: outVisual renders on the glance-carrying outputs): outVisual is gone', ()=>g("typeof outVisual")==='undefined'); /* SUPERSEDED 23 Sep 2026 (Paul's ruling of 22 Sep 2026: no output page carries an At a Glance strip; outVisual is retired) */
T('RETIRED 22 Sep 2026 (was AS1/AS2): readiness and archmap carry no glance, with every other page', ()=>g("renderOutReadiness()").indexOf('At a Glance')<0&&g("renderOutArchMap()").indexOf('At a Glance')<0); /* SUPERSEDED 23 Sep 2026 (Paul's ruling of 22 Sep 2026: no output page carries an At a Glance strip; outVisual is retired) */
T('RETIRED 22 Sep 2026 (was: outcome pages carry the strip): every outcome page opens on its own header, no strip above it', ()=>['out-riskmap','out-datagov','out-intmod','out-govframework','out-deployconf','out-security','out-cascade','out-sovval','out-skills','out-embedreview','out-quarterly','out-readiness','out-archmap'].every(id=>{const h=g("currentStep='"+id+"';renderOutcomePage()");return h.replace(/<[^>]+>/g,' ').indexOf('At a Glance')<0})); /* SUPERSEDED 23 Sep 2026 (Paul's ruling of 22 Sep 2026: no output page carries an At a Glance strip; outVisual is retired) */
T('RETIRED 22 Sep 2026 (was: outVisual empty-safe on empty data): the outcome pages render on empty data with no strip', ()=>{g("data=emptyData()");return ['out-datagov','out-skills'].every(id=>{const h=g("currentStep='"+id+"';renderOutcomePage()");return typeof h==='string'&&h.indexOf('At a Glance')<0})}); /* SUPERSEDED 23 Sep 2026 (Paul's ruling of 22 Sep 2026: no output page carries an At a Glance strip; outVisual is retired) */
/* ── JMAP pins (10 Sep 2026, chat 10; rebuilt from the prototype's five of 2 Sep 2026 under Paul's rulings of 9 Sep): the jurisdiction map on the smoke's world ── */
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'Architecture-worldgeo.js'),'utf8'),ctx,{filename:'Architecture-worldgeo.js'});
T('JMAP: Meridian seeds locked with a United States home — no Jurisdiction fold on the card, the half-width mount under a padlock (10 Sep 2026)', ()=>{g("data=emptyData();seedData('full')");const c=g("componentCard('dataEstate',data.dataEstate[0],'dashboard')");return c.indexOf('Data storage')<0&&g("jurHome()")==='USA'&&g("jurMount('1.5','dataSov')").indexOf('Advanced feature. Click to activate.')>=0&&g("jurMount('1.5','dataSov')").indexOf('width:50%')>=0});
T('JMAP: unlocked, the Jurisdiction fold renders the provider first, then three columns in the ruled order; the Additional legal jurisdictions list is an array (10 Sep 2026, second pass)', ()=>{g("jurSetEnabled(true)");let c=g("componentCard('dataEstate',data.dataEstate[0],'dashboard')");c=c.slice(c.indexOf('Component provider'));const ix=['External','Data storage','Data computation','Additional legal jurisdictions','Possible others'].map(t=>c.indexOf(t));return ix.every(i=>i>=0)&&ix.every((v,i)=>i===0||v>ix[i-1])&&g("Array.isArray(data.dataEstate[0].operatedFrom)")});
T('JMAP: the seed speaks — a United States home, the shadow pair Uncertain, Salesforce located by the day-75 action', ()=>g("data.enterprise.homeJurisdiction==='USA'&&data.aiModels.filter(function(c){return /Personal ChatGPT|Unapproved transcription/.test(c.name||'')}).every(function(c){return (c.storesIn||[])[0]==='Uncertain'})&&data.dataEstate.filter(function(c){return /Salesforce/.test(c.name)})[0].storesIn[0]==='Germany'"));
T('JMAP: the map page draws the world with the box labelled UNCERTAIN JURISDICTION, rings, and the sentence', ()=>{const p=g("renderJurMap()");return p.indexOf('UNCERTAIN JURISDICTION')>=0&&p.indexOf('UNDEFINED')<0&&(p.match(/<path d="M/g)||[]).length>150&&p.indexOf('data-reach="foreign"')>=0&&p.indexOf('It does not say what any of those laws permit')>=0});
T('JMAP: the light moves, the icons stand in nation clusters, the strip counts silence and reach, View Jurisdictions stands', ()=>{const p=g("renderJurMap()");return (p.match(/<animateMotion /g)||[]).length>=4&&p.indexOf('class="jic"')>=0&&p.indexOf('>Germany<')>=0&&p.indexOf('View Jurisdictions')>=0&&p.indexOf('Components not yet recorded:')>=0&&p.indexOf('Components reachable by law from outside the home jurisdiction:')>=0});
T('JMAP: the derived line rides Data locations only, and relocking keeps the facts', ()=>{const a=g("jurDerivedLine(SOV_PROGRAM[0],'1.5')").indexOf('reachable by law from outside the home jurisdiction')>=0&&g("jurDerivedLine(SOV_PROGRAM[1],'1.5')")==='';g("jurSetEnabled(false)");return a&&g("jurDerivedLine(SOV_PROGRAM[0],'1.5')")===''&&g("data.dataEstate[0].storesIn.length>0")});

/* EAF — Enterprise Architecture Fit (Step 2.4, third tab; Spec Rev B; 11 Sep 2026) */
T('EAF: Step 2.5 is Enterprise Architecture Fit, with a carousel of four slides; 2.4 has two tabs (11 Sep 2026)', ()=>{g("data=emptyData();seedData('full')");const t=g("renderStepContent('2.5')");const q=g("UI.step24Part='governance';renderStepContent('2.4')");g("UI.step24Part=null");return t.indexOf('Enterprise Architecture Fit')>=0&&t.indexOf('Map every agent and workflow.')>=0&&g('CAROUSEL_CONTENT["2.5"].length===4')&&q.indexOf('Applications and agents')>=0&&q.indexOf('Enterprise Architecture Fit')<0});
T('EAF: four agents count (they hang from applications); the two service accounts do not', ()=>g("eafEntries().length===4&&eafEntries().every(function(a){return !!a.appId})"));
T('EAF: the seed maps three agents — two workflows, the Escalation router autonomous — and leaves the Case summarizer unmapped (Paul, 11 Sep 2026)', ()=>g("JSON.stringify(eafEntries().map(function(a){return [eafMapped(a),eafDerive(a).mapped]}))")==='[[true,"workflow"],[true,"workflow"],[false,""],[true,"autonomous"]]');
T('EAF: the record holds a trigger and steps, every path has an end, and every decision names who decides and who is accountable (retargeted 20 Sep 2026: the flow-level delivery is withdrawn)', ()=>g("eafEntries().filter(eafMapped).every(function(a){var f=eafFlow(a);return f.trigger&&f.trigger.kind&&f.steps.length>0&&f.delivery===undefined&&eafStructure(f).openEnds.length===0&&f.steps.filter(function(s){return s.kind==='decides'}).every(function(s){return s.decision.right&&s.decision.accountable})})"));
T('EAF: the Support triage diagram draws three lanes, gold crossings, hexagons, cylinders, and its badges', ()=>{const d=g("eafDiagram(eafEntries()[0])");return d.indexOf('PEOPLE AND')>=0&&d.indexOf('AGENTS')>=0 /* the lane reads AGENTS since 18 Sep 2026 */&&d.indexOf('SYSTEMS AND')>=0&&(d.match(/stroke="#B8933D" stroke-width="2.2"/g)||[]).length>=5&&(d.match(/fill="#4A6E8A" stroke="#1F2A2E" stroke-width="1.2"/g)||[]).length>=5&&(d.match(/a48,10 0 0 1 96,0/g)||[]).length===2&&d.indexOf('>R<')>=0&&d.indexOf('>P<')>=0});
T('EAF: every connector ends in a marker head and none ends inside a shape (18 Sep 2026, Paul\'s fifth browser pass)', ()=>{const d=g("eafDiagram(eafEntries()[0])");const np=(d.match(/<path id="e/g)||[]).length;return np>0&&np===(d.match(/marker-end="url\(#eafm/g)||[]).length&&(d.match(/<marker id="eafm/g)||[]).length===3&&d.indexOf('polygon points="0,0 8,4 0,8"')<0});
T('EAF: the derivations agree with the seed cards — no checkpoint disagreement, no accountability gap, the customer named outside', ()=>{const d=JSON.parse(g("JSON.stringify(eafDerive(eafEntries()[0]))"));return d.lines.length===1&&d.lines[0]==='Reaches outside the organization at 1 step: A customer.'&&d.escalations===1&&d.notifications===1});
T('EAF: a re-seeded org reads the same flows (landed by name)', ()=>{const a=g("JSON.stringify(eafEntries().map(function(a){return [eafFlow(a).steps.length,eafDerive(a).up,eafDerive(a).down]}))");g("seedData('full')");return g("JSON.stringify(eafEntries().map(function(a){return [eafFlow(a).steps.length,eafDerive(a).up,eafDerive(a).down]}))")===a});
T('EAF: the human-in-the-loop field is a yes/no; the seed keeps the earlier text as a note', ()=>g("data.agentRegistry.every(function(a){return (a.humanLoop==='Yes'||a.humanLoop==='No')&&!!a.humanLoopNote})"));
T('EAF: the step closes only when every counted workflow is mapped (11 Sep 2026)', ()=>{g("delete data.completedSteps['2.5']");const closed=g("renderStepContent('2.5')").indexOf('This step completes when every registered workflow is mapped')>=0;g("var _c=eafEntries()[2];eafSet(_c.id,'trigger.kind','request');eafSet(_c.id,'trigger.source',{lane:'people',ref:'Support agent'});eafAddStep(_c.id,null);eafSet(_c.id,'delivery.target',{lane:'people',ref:'Support agent'})");const open=g("renderStepContent('2.5')").indexOf('Every registered workflow is mapped as a business process.')>=0;return closed&&open});
T('EAF: nothing on the tab refers to another module', ()=>{g("UI.step24Part='design';UI.eafOpen={};eafEntries().forEach(function(a){UI.eafOpen[a.id]=true})");const t=g("renderStep24()");g("UI.step24Part=null;UI.eafOpen={}");return t.indexOf('Workforce')<0&&t.indexOf('module')<0});

g("data=emptyData()");

console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
