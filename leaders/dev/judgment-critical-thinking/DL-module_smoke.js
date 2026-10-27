const fs=require('fs');const path=require('path');const {JSDOM}=require('jsdom');
/* Target: a deployment SET directory (the sole shipped form) or a legacy single file. */
const target=process.argv[2]||'.';
/* Prefix derives from this file's own name (ER seam pattern): named
   DL-module_smoke.js it gates the DL- prefixed set; named canonically, the
   canonical set. All neighbor-file reads honor it. */
const PFX=path.basename(__filename).replace('module_smoke.js','');
let BASE=null,html;
if(fs.existsSync(target)&&fs.statSync(target).isDirectory()){
  BASE=target;
  const REQUIRED=['index.html','styles.css','app.js','screen-loader.js','home.js','learn.js','home.html','learn.html','templates-local.js','build-templates.js'].map(function(f){return PFX+f});
  const missing=REQUIRED.filter(f=>!fs.existsSync(path.join(BASE,f)));
  if(missing.length){console.error('SET INCOMPLETE, missing: '+missing.join(', '));process.exit(1)}
  html=fs.readFileSync(path.join(BASE,PFX+'index.html'),'utf8');
  var stylesLink='<link rel="stylesheet" href="'+PFX+'styles.css">';
  if(html.indexOf(stylesLink)<0){console.error(PFX+'index.html: styles link missing');process.exit(1)}
  html=html.replace(stylesLink,'<style>'+fs.readFileSync(path.join(BASE,PFX+'styles.css'),'utf8')+'</style>');
  html=html.replace(/<script src="([^"]+)"><\/script>/g,(m,src)=>'<script>\n'+fs.readFileSync(path.join(BASE,src),'utf8')+'\n</script>');
}else{
  html=fs.readFileSync(target,'utf8');
}
let P=0,F=0;const bad=[];
function check(n,c){if(c){P++;console.log('PASS ',n)}else{F++;bad.push(n);console.log('FAIL ',n)}}
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:false,
beforeParse(w){Object.defineProperty(w,'innerWidth',{value:1500,configurable:true,writable:true});
 w.requestAnimationFrame=cb=>setTimeout(cb,0);w.cancelAnimationFrame=clearTimeout;
 w.scrollTo=()=>{};w.matchMedia=q=>({matches:false,addListener(){},removeListener(){}});
 w.fetch=(url,opts)=>{if(BASE&&typeof url==='string'&&/\.html(\?|$)/.test(url)){try{const t=fs.readFileSync(path.join(BASE,url.split('?')[0]),'utf8');return Promise.resolve({ok:true,text:()=>Promise.resolve(t)})}catch(e){return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve('')})}}return Promise.resolve({json:()=>Promise.resolve({content:[{text:'STUB CHALLENGE'}]})})};
 w.HTMLMediaElement.prototype.load=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
}});
const w=dom.window,d=w.document;
function clk(el){el.dispatchEvent(new w.Event('click',{bubbles:true}))}
function inp(el){el.dispatchEvent(new w.Event('input',{bubbles:true}))}
setTimeout(()=>{try{
check('boot renders without init error',d.getElementById('app').innerHTML.indexOf('Init Error')===-1&&d.getElementById('app').innerHTML.length>500);
/* -- entry gate first (July 28 per-user store ruling): data boots at identity adoption -- */
check('entry gate: fresh boot lands on account setup',!!d.getElementById('entryUser')&&d.getElementById('app').innerHTML.indexOf('Create your account')>=0);
check('pre-identity: no data loads before sign-in',w.data.decisions.length===0&&w.currentUserId===null);
d.getElementById('entryUser').value='smoke';d.getElementById('entryPin').value='12';
w.doEntry();
check('entry gate: weak PIN rejected with the ruled message',!w.authSignedIn&&d.getElementById('app').innerHTML.indexOf('at least 4 characters')>=0);
d.getElementById('entryUser').value='smoke';d.getElementById('entryPin').value='1234';
w.doEntry();
check('entry gate: account created, session open, remember off by default',w.authSignedIn===true&&!!w.localStorage.getItem('dl-accounts')&&w.localStorage.getItem('dl-remember')===null);
/* -- per-user Store pins (July 28 ruling: the enterprise Store, single-user form) -- */
check('identity adoption seeds ten decisions for the user',w.currentUserId==='smoke'&&w.data.decisions.length===10);
check('seed persisted to the user record with a rev mirror',!!w.localStorage.getItem('dl-data::smoke')&&w.localStorage.getItem('dl-rev::smoke')===String(w.data.rev)&&w.data.rev>=1&&w.data.schemaVersion===1);
check('legacy dl-v9 is not written by the per-user store',w.localStorage.getItem('dl-v9')===null);
check('seed completion derived (demo01 = 8/8)',Object.keys(w.data.decisions[0].flow.completed).length===8);
check('seed profile + assessment present',!!(w.data.profile&&w.data.profile.text)&&!!w.data.assessment.completedAt);
check('revisioned writes: save increments rev and the mirror follows',(function(){var r0=w.data.rev;w.saveData();return w.data.rev===r0+1&&w.localStorage.getItem('dl-rev::smoke')===String(w.data.rev)})());
check('store seam: STORE_ENDPOINT source constant defined once, device-local default',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return (a.match(/var STORE_ENDPOINT=''/g)||[]).length===1})());
check('upD marks the record dirty through Store.commit',(function(){var kp=w.currentPage,ka=w.activeId;w.Store.clearDirty();w.currentPage='detail';w.activeId='demo01';w.upD('leaning',w.data.decisions[0].leaning);var ok=w.Store.dirtyRecords().indexOf('decisions::demo01')>=0;w.currentPage=kp;w.activeId=ka;return ok})());
check('mergeDirtyInto overlays array records by id (DL adaptation 3)',(function(){var fresh={decisions:[{id:'x',v:1}]};var local={decisions:[{id:'x',v:2},{id:'y',v:3}]};w.Store.mergeDirtyInto(fresh,local,['decisions::y','decisions::x']);return fresh.decisions.length===2&&fresh.decisions[0].v===2})());
check('migrateLegacy adopts dl-v9 into an empty user record once',(function(){w.localStorage.setItem('dl-v9',JSON.stringify({decisions:[{id:'L1'}]}));var ok1=w.Store.migrateLegacy('legacyuser')===true;var rec=JSON.parse(w.localStorage.getItem('dl-data::legacyuser'));var ok2=rec.decisions.length===1&&rec.decisions[0].id==='L1';var ok3=w.Store.migrateLegacy('legacyuser')===false;w.localStorage.removeItem('dl-v9');w.localStorage.removeItem('dl-data::legacyuser');w.localStorage.removeItem('dl-rev::legacyuser');return ok1&&ok2&&ok3})());
w.go('lab');
check('Practice mounts the cabinet shell',!!d.getElementById('boardShell'));
setTimeout(()=>{try{
check('cabinet shows six folders collapsed',d.querySelectorAll('[id^="folder-"]').length===6);
check('pull tab offers the rest',!!d.getElementById('filesMore'));
clk(d.getElementById('filesMore'));
check('expanded cabinet shows all ten',d.querySelectorAll('[id^="folder-"]').length===10);
clk(d.querySelector('[id="folder-0"]'));
check('folder click opens its detail page',w.currentPage==='detail'&&w.activeId==='demo01');
check('folders: square top-left corner, three rounded (unit)',(function(){var d0=w.bdFolderBody(100,200,300,100,6);return d0.indexOf('M 100,200 L')===0&&(d0.match(/ A 6 6 /g)||[]).length===3&&w.bdFolderBody(0,0,10,10,0).indexOf('A')===-1})());
check('folders: every body routes through the contour; naked rounded rects excised',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return (a.match(/bdFolderBody\(/g)||[]).length===7&&a.indexOf('width="186" height="100" rx="5"')===-1})());
setTimeout(()=>{try{
check('board svg mounts with threads',!!d.getElementById('boardShell').querySelector('#threads'));
check('gauge reads full analysis',d.getElementById('gaugeNum').textContent.indexOf('100')===0);
check('four drawers render',d.querySelectorAll('.drawer').length===4);
check('no locked sections (module semantics)',d.querySelectorAll('.dsec.locked').length===0&&d.querySelectorAll('.dsec.done').length===8);
w.tryOpen('biascheck');
check('focus reel opens on Bias Check',d.getElementById('focusBg').classList.contains('open')&&d.getElementById('focusInner').innerHTML.indexOf('Bias')>=0);
check('method slip present on completed section',d.getElementById('focusInner').innerHTML.indexOf('clip-slip')>=0);
check('worked-example slip removed, material retained',d.getElementById('focusInner').innerHTML.indexOf('the Meridian decision')===-1&&html.indexOf('SECTION_EXAMPLES')>=0);
w.toggleCar();
check('carousel toggles in with module teaching content',d.getElementById('focusInner').innerHTML.indexOf('fcar-headline')>=0);
w.toggleCar();
var ta=d.getElementById('focusTa');
check('textarea carries the stored answer',ta.value.indexOf('mostly confirming')>=0);
ta.value='EDITED-BY-SMOKE';inp(ta);
check('edit writes through to the store',w.data.decisions[0].flow.confirmation==='EDITED-BY-SMOKE');
check('edit persists to localStorage',w.localStorage.getItem('dl-data::smoke').indexOf('EDITED-BY-SMOKE')>=0);
check('done section offers Complete-as-close',d.getElementById('focusInner').innerHTML.indexOf('is-complete')>=0);
w.closeFocus();
w.go('detail','demo10');
setTimeout(()=>{try{
check('barely-started file: one derived stamp (problem)',Object.keys(w.data.decisions[9].flow.completed).length===1&&w.data.decisions[9].flow.completed.problem===true);
check('current section derives to The Case',w.currentSec==='thecase');
w.tryOpen('final');
check('free navigation opens Final Call unfilled',d.getElementById('focusBg').classList.contains('open')&&d.getElementById('focusTa').value==='');
check('file button gated until answered',d.getElementById('focusDone').disabled===true);
var ta2=d.getElementById('focusTa');ta2.value='SMOKE FINAL CALL';inp(ta2);
check('gate lifts when answered',d.getElementById('focusDone').disabled===false);
w.bdMarkComplete();
setTimeout(()=>{try{
check('stamp writes completed + persists',w.data.decisions[9].flow.completed.final===true&&w.localStorage.getItem('dl-data::smoke').indexOf('SMOKE FINAL CALL')>=0);
w.tryOpen('challenge');
setTimeout(()=>{try{
check('challenge card fires the live seam (stubbed)',w.data.decisions[9].flow.challengeAI==='STUB CHALLENGE');
check('focus shows the delivered challenge',d.getElementById('focusInner').innerHTML.indexOf('STUB CHALLENGE')>=0);
var ta3=d.getElementById('focusTa');ta3.value='SMOKE RESPONSE';inp(ta3);
w.bdMarkComplete();
w.tryOpen('debrief');
['debriefKnow','debriefSurprise','debriefNextTime'].forEach(function(k,i){
 var q=w.SECTIONS.debrief.qs[i];w.setField(q,'SMOKE '+k)});
w.renderFocus();
w.bdMarkComplete();
setTimeout(()=>{try{
check('sealing the debrief resolves the case',w.data.decisions[9].resolved===true);
check('resolution persisted',JSON.parse(w.localStorage.getItem('dl-data::smoke')).decisions[9].resolved===true);
w.toggleStage();
check('fullscreen stage engages',d.getElementById('boardStage').classList.contains('stage-full'));
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check('Escape exits fullscreen',!d.getElementById('boardStage').classList.contains('stage-full'));
w.bnavGo('lab');
check('board nav returns to the cabinet',w.currentPage==='lab');
['home','learn','insights','assess','dashboard'].forEach(function(p){
 let ok=true;try{w.go(p)}catch(e){ok=false}
 check('regression: '+p+' renders',ok&&d.getElementById('app').innerHTML.length>300)});
phase2();
}catch(e){console.error('T7',e);process.exit(1)}},30);
}catch(e){console.error('T6',e);process.exit(1)}},30);
}catch(e){console.error('T5',e);process.exit(1)}},30);
}catch(e){console.error('T4',e);process.exit(1)}},30);
}catch(e){console.error('T3',e);process.exit(1)}},40);
}catch(e){console.error('T2',e);process.exit(1)}},40);
}catch(e){console.error('T1',e);process.exit(1)}},80);

async function phase2(){
const sl=ms=>new Promise(r=>setTimeout(r,ms));
try{
w.go('assess');await sl(50);
check('assess mounts diagnostics for seeded completion',!!d.getElementById('assessRetake'));
check('history rail lists two prior sittings (latest shows as current)',d.querySelectorAll('[id^="ahist-"]').length===2);
clk(d.getElementById('ahist-0'));await sl(50);
check('history entry opens a past sitting',w.assessHistIdx!==null&&!!d.getElementById('assessBackLatest'));
clk(d.getElementById('assessBackLatest'));await sl(50);
check('back-to-latest clears the history view',w.assessHistIdx===null);
clk(d.getElementById('assessRetake'));await sl(50);
check('retake resets to question one',w.assessStep===1&&!!d.querySelector('[id^="aopt-0-"]'));
for(let qi=0;qi<10;qi++){
 const el=d.getElementById('aopt-'+qi+'-50')||d.querySelector('[id^="aopt-'+qi+'-"]');
 if(!el){check('option control present for q'+(qi+1),false);break}
 clk(el);await sl(35);
}
check('ten answers archive a new sitting',!!w.data.assessment.completedAt&&w.data.assessmentHistory.length===4);
check('diagnostics return after completion',!!d.getElementById('assessRetake'));
check('history rail grows to three',d.querySelectorAll('[id^="ahist-"]').length===3);
check('assessment persisted',JSON.parse(w.localStorage.getItem('dl-data::smoke')).assessmentHistory.length===4);
w.go('dashboard');await sl(60);
const sh=d.getElementById('boardShell');
check('dashboard SVG mounts',!!sh&&sh.innerHTML.length>15000);
check('ten decision rows',d.querySelectorAll('[id^="dr-"]').length===10);
check('four activity entries',d.querySelectorAll('[id^="act-"]').length===4);
check('three closed loops',d.querySelectorAll('[id^="loop-"]').length===3);
check('written profile parsed into cards',sh.innerHTML.indexOf('BLIND SPOTS')>=0&&sh.innerHTML.indexOf('PATTERNS')>=0);
check('nudge chip surfaces the overdue debrief',sh.innerHTML.indexOf('OPEN DEBRIEF')>=0);
check('browser-notification layer excised whole; in-app nudges intact',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return a.indexOf('Notification')===-1&&a.indexOf('dl-lastnotif')===-1&&a.indexOf('buildNudges')>=0})());
check('assessment CTA suppressed when complete',d.getElementById('app').innerHTML.indexOf('Take the Assessment')===-1);
check('profile action strip present',!!d.getElementById('profileBtn'));
const anyRow=d.querySelector('[id^="dr-"]');clk(anyRow);await sl(50);
check('row click opens the decision',w.currentPage==='detail');
w.go('dashboard');await sl(60);
clk(d.getElementById('profileBtn'));await sl(80);
check('generate profile hits the live seam (stubbed)',w.data.profile&&w.data.profile.text==='STUB CHALLENGE');
}catch(e){console.error('P2 exception',e);F++;bad.push('phase2-exception')}
await phase3();
await phase4();
await phase5();
console.log('\n'+(F?F+' FAILURES: '+bad.join(' | '):'ALL MODULE SMOKE TESTS PASSED')+'  ('+P+' passing)');
process.exit(F?1:0);
}

async function phase3(){
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const fi=()=>d.getElementById('focusInner').innerHTML;
const store=()=>JSON.parse(w.localStorage.getItem('dl-data::smoke'));
try{
w.go('detail','demo03');await sl(50);
w.vidSeen={};try{w.localStorage.removeItem('dl-vidseen')}catch(e){}/* self-contained: earlier rounds may have consumed first passes */
w.tryOpen('problem');await sl(30);
/* \u2500\u2500 exclusive focus panels (July 28 ruling: session-scoped, per part) \u2500\u2500 */
check('first card of a part this session: video open, Method closed (ruled default)',fi().indexOf('<video')>=0&&fi().indexOf('Part I The Frame.mp4')>=0&&w.focusPanel==='vid'&&fi().indexOf('fcar')===-1);
check('seen-state is session-scoped, not decision data',JSON.parse(w.localStorage.getItem('dl-vidseen')).p1===true&&!store().decisions[2]._vidSeen);
check('labels: Watch video carries the part, Method carries the step; old tail gone',fi().indexOf('Watch video \u00B7 Part I \u00B7 The Frame')>=0&&fi().indexOf('Method \u00B7 The Problem')>=0&&fi().indexOf('why / how / outcome')===-1);
check('exclusivity: closing the video auto-opens the Method',(function(){w.toggleVid();return w.focusPanel==='car'&&fi().indexOf('<video')===-1})());
check('exclusivity: reopening the video closes the Method',(function(){w.toggleVid();return w.focusPanel==='vid'&&fi().indexOf('<video')>=0&&fi().indexOf('fcar')===-1})());
check('closing the Method leaves both closed',(function(){w.toggleVid();w.toggleCar();return w.focusPanel===null&&fi().indexOf('<video')===-1})());
w.closeFocus();await sl(30);
w.tryOpen('thecase');await sl(30);
check('new part in the same session: its video opens',fi().indexOf('THE EXAMINATION.mp4')>=0&&w.focusPanel==='vid');
w.closeFocus();await sl(30);
w.tryOpen('biascheck');await sl(30);
check('same part again: video closed; the completed-exception mapping holds',(function(){var done=!!((store().decisions[2].flow.completed||{}).biascheck);return fi().indexOf('<video')===-1&&w.focusPanel===(done?null:'car')&&fi().indexOf('Watch video \u00B7 Part')>=0})());
w.closeFocus();await sl(30);
w.go('detail','demo01');await sl(50);
w.tryOpen('problem');await sl(30);
check('completed-card exception (Paul\u2019s veto): a finished step opens with both panels closed',w.focusPanel===null&&fi().indexOf('<video')===-1&&fi().indexOf('fcar')===-1&&Object.keys(store().decisions[0].flow.completed).length===8);
w.closeFocus();await sl(30);
w.go('detail','demo10');await sl(50);
w.tryOpen('biascheck');await sl(30);
check('uncompleted other card: Method open (the ruled default, deterministic fixture)',w.focusPanel==='car'&&!((store().decisions[9].flow.completed||{}).biascheck)&&fi().indexOf('<video')===-1);
w.closeFocus();await sl(30);
w.go('detail','demo03');await sl(50);
w.closeFocus();await sl(30);
w.go('detail','demo04');await sl(50);
w.go('detail','demo03');await sl(50);
w.tryOpen('problem');await sl(30);
check('return visit within the session: no video; panel per the mapping',(function(){var done=!!((store().decisions[2].flow.completed||{}).problem);return fi().indexOf('<video')===-1&&w.focusPanel===(done?null:'car')})());
w.toggleVid();await sl(30);
check('watch toggle still reopens on demand',fi().indexOf('<video')>=0);
w.closeFocus();await sl(30);
w.go('detail','demo04');await sl(50);
w.tryOpen('problem');await sl(30);
check('per-part per-SESSION: a different decision does NOT restart the first pass (supersedes the per-decision model)',(function(){var done=!!((store().decisions[3].flow.completed||{}).problem);return fi().indexOf('<video')===-1&&w.focusPanel===(done?null:'car')})());
w.closeFocus();await sl(30);
w.go('detail','demo01');await sl(50);
w.tryOpen('debrief');await sl(30);
w.stepQ(1);w.stepQ(1);await sl(30);
check('debrief Q3 carries the playbook-principle hint; hint-less questions carry none',fi().indexOf('focus-q-hint')>=0&&fi().indexOf('Express the lesson as a principle')>=0&&(function(){w.stepQ(-1);return fi().indexOf('focus-q-hint')===-1})());
w.closeFocus();await sl(30);
w.closeFocus();await sl(30);
w.go('lab');await sl(50);
check('practice video adopts the centered collapse wrapper',d.getElementById('app').innerHTML.indexOf('Watch: Introduction to the Practice')>=0);
check('fullscreen button on the cabinet',!!d.getElementById('stageBtn'));
w.go('assess');await sl(60);
check('fullscreen button on Assess',!!d.getElementById('stageBtn'));
w.toggleStage();
check('Assess stage engages fullscreen',d.getElementById('boardStage').classList.contains('stage-full'));
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
check('Escape exits Assess fullscreen',!d.getElementById('boardStage').classList.contains('stage-full'));
w.go('dashboard');await sl(60);
check('fullscreen button on the Dashboard',!!d.getElementById('stageBtn'));
check('custom cursor script removed',!d.querySelector('.cursor-ring')&&!d.documentElement.classList.contains('has-custom-cursor'));
check('cursor:none purged from styles',d.querySelector('style').textContent.indexOf('cursor:none')===-1);
}catch(e){console.error('P3 exception',e);F++;bad.push('phase3-exception')}
}

async function phase4(){
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const style=()=>d.querySelector('style').textContent;
try{
// ── A) detail chrome: one sidebar only ──
w.go('detail','demo03');await sl(60);
const app=d.getElementById('app');
check('drawers-hide rule removed (drawers live outside fullscreen too)',style().indexOf('.board-stage:not(.stage-full) .drawers{display:none}')===-1);
check('four drawers visible outside fullscreen',d.querySelectorAll('.drawer').length===4);
check('slim part rail fully retired',!d.getElementById('bdPartRail')&&style().indexOf('.bd-partrail')===-1);
check('old practice rail stays retired (no second sidebar)',(()=>{const r=d.getElementById('prail');return !r||r.innerHTML===''})());
check('no with-rail class leaks',app.className.indexOf('with-rail')===-1);
check('stage breakout rule present',style().indexOf('width:calc(100% + 192px)')>=0);
/* SUPERSEDED July 29 (chip-clearance amendment, same-day): absolute centering ignored the right cluster and ran the tabs under the identity chip. Ultrawide now uses dual auto margins \u2014 the tabs float between logo and actions, clearing any chip width. */
check('nav tabs: absolute centering excised; ultrawide floats the tabs on dual auto margins',(function(){var c=style();return c.indexOf('.nav-tabs{position:absolute')===-1&&c.indexOf('@media(min-width:1480px){#navRight{margin-left:auto}}')>=0&&c.indexOf('.nav-tabs{display:flex;gap:0;list-style:none;margin-left:auto}')>=0})());
check('conformance: model tokens present (head-blue/gold-text)',style().indexOf('--head-blue:#076D9E')>=0&&style().indexOf('--gold-text:#B34208')>=0);
check('conformance: outlet badges ink-on-chip, not white',style().indexOf('.insight-badge--mono{background:rgba(var(--fg-rgb),.07);color:var(--text-max)')>=0);
check('conformance: nav ground wash + blue logo span',style().indexOf('background:rgba(var(--bg-rgb),.92)')>=0&&style().indexOf('.nav-logo span{color:var(--head-blue)')>=0);
check('conformance: site footer mounted',!!d.querySelector('.app-footer .app-footer-links a'));
check('conformance: section labels 15px head-blue',style().indexOf('.section-label{font-family:var(--mono);font-size:15px')>=0&&style().indexOf('color:var(--head-blue);text-transform:uppercase')>=0);
check('conformance: insight family at model scale (13px)',style().indexOf('.insight-date{font-family:var(--mono);font-size:13px')>=0&&style().indexOf('.insight-cta{font-family:var(--mono);font-size:13px')>=0);
check('conformance: hero carries the light treatment',style().indexOf('rgba(var(--bg-rgb),.93) 0%')>=0&&style().indexOf('text-shadow:0 2px 28px')===-1);
/* SUPERSEDED July 29 (ER nav conformance ruling): the action row is no longer right-pinned in base flow \u2014 it aligns LEFT when wrapped (enterprise behavior); right-pinning survives only inside the >=1480 media rule (amended same day: the tabs float there on dual auto margins, clearing the chip). */
check('conformance: action row unpinned in base flow, right-pinned only at ultrawide, identity chip rendered',(function(){var nr=d.querySelector('#navRight');return !!nr&&nr.getAttribute('style').indexOf('margin-left:auto')===-1&&style().indexOf('#navRight{margin-left:auto}')>=0&&!!d.querySelector('.nav-user-chip')})());
check('audit: insights grid can go four across (container declared)',style().indexOf('container-type:inline-size')>=0);
check('audit: hero carries the model asset itself (cool baked ground)',html.indexOf('UklGRnRYAgBXRUJQVlA4IGhYAgCwygadASqAByQEPjEYi0QiIaERymSEIAMEsrd9')>=0);
check('audit: hero at the model plain treatment (no mask compensations)',style().indexOf("') left center/cover no-repeat}")>=0&&style().indexOf('mask-image')===-1);
check('learn: content wrap at the model 1200 without touching the board envelope (screen-file source since the split)',style().indexOf('.wrap--content{max-width:1200px}')>=0&&style().indexOf('.wrap{max-width:1280px')>=0&&(BASE?fs.readFileSync(path.join(BASE,PFX+'learn.html'),'utf8'):html).indexOf('class="wrap wrap--content"')>=0);
check('learn: intro paragraph reads paper-white like the model',style().indexOf('.section-body{font-size:16px;line-height:1.75;color:var(--paper)}')>=0);
check('audit: no dark-era invisible greys remain',style().indexOf('#C7C0B5')===-1);
check('audit: the only text-shadow is the dark-mode numeral treatment',style().split('text-shadow').length===2&&style().indexOf('[data-theme="dark"] .home-plan-num,[data-theme="dark"] .stat-num{color:var(--gold-light);text-shadow')>=0);
check('dark: model token block present',style().indexOf('[data-theme="dark"]{--text-mid:#B9C3CF;--ink:#242E3C')>=0&&style().indexOf('--head-blue:#38B5EF')>=0&&style().indexOf('--gold-text:#F07A37')>=0);
check('dark: first-paint theme script (light default, dl-theme key)',html.indexOf("localStorage.getItem('dl-theme')")>=0);
check('dark: toggle lives between Help and Notes',(d.querySelector('#navRight')||{innerHTML:''}).innerHTML.indexOf('Dark Mode')>=0);
w.toggleTheme();await sl(30);
check('dark: toggling flips the document theme and persists',d.documentElement.getAttribute('data-theme')==='dark'&&w.localStorage.getItem('dl-theme')==='dark');
check('dark: nav label flips to Light Mode',(d.querySelector('#navRight')||{innerHTML:''}).innerHTML.indexOf('Light Mode')>=0);
w.toggleTheme();await sl(30);
check('dark: toggling back restores light',d.documentElement.getAttribute('data-theme')==='light'&&w.localStorage.getItem('dl-theme')==='light');
check('dark: ink washes are channel-driven (retheme automatically; attribute-selector matchers exempt)',style().indexOf(':rgba(30,37,48,')===-1&&style().indexOf(' rgba(30,37,48,')===-1&&style().indexOf(',rgba(30,37,48,')===-1);
check('dark: hero gets the model near-black gradient',style().indexOf('[data-theme="dark"] .hero-bg::before{background:linear-gradient(90deg,rgba(13,17,23,.9)')>=0);
check('dark: form controls flip color-scheme',style().indexOf('[data-theme="dark"] textarea,[data-theme="dark"] input,[data-theme="dark"] select{color-scheme:dark}')>=0);
check('dark audit: no hardcoded reds/greys outside token blocks',(function(){var s=style().replace(/:root\{[^}]*\}/,'').replace(/\[data-theme="dark"\]\{[^}]*\}/,'');return s.indexOf('#A29A8E')===-1&&s.indexOf('#9E3B2E')===-1&&s.indexOf('#9B2D3F')===-1})());
check('dark audit: spec stamp rides the phase-4 tint',style().indexOf('.spec-stamp{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--ph4-t);border:1.5px solid var(--ph4-t)')>=0);
check('audit: value band converted to light ground',style().indexOf('.value-band{border-top:1px solid var(--rule);background:var(--ink)')>=0);
check('audit: home plan labels legible (stone, model scale)',style().indexOf('.home-plan-label{font-size:14px;line-height:1.6;color:var(--stone)}')>=0);
check('home: hero-left at the ruled 56px left inset (box width, Paul July 12)',style().indexOf('padding:calc(var(--nav-h,100px) + 34px) 48px 80px 56px')>=0);
check('home: plan text at the deployed hero scale (38/21/16)',style().indexOf('.hero .home-plan-num{font-size:38px;min-width:56px;color:var(--gold-text)}')>=0&&style().indexOf('.hero .home-plan-label strong{font-size:21px')>=0&&style().indexOf('.hero .home-plan-label{font-size:16px;color:var(--text-mid)}')>=0);
check('home: plan sits in the model box',style().indexOf('.home-plan{margin-top:30px;background:rgba(var(--bg-rgb),.72);border:1px solid rgba(var(--fg-rgb),.07);border-radius:8px')>=0);
check('home: marquee at model speed and scale',style().indexOf('animation:marquee 30s linear infinite')>=0&&style().indexOf('.marquee-item{display:flex;align-items:center;gap:12px;padding:0 28px;font-family:var(--mono);font-size:13px')>=0);
check('home: cards ride the model wash token',style().indexOf('--bg-card:rgba(var(--fg-rgb),.03)')>=0&&style().indexOf('--bg-card:#2C3846')===-1);
check('home: how-it-works on the model card grammar',style().indexOf('.how-title{font-family:var(--mono);font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text)}')>=0&&style().indexOf('.how-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}')>=0);
check('fonts: the model weight set is actually loaded (500 real, not synthesized)',html.indexOf('Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600')>=0&&html.indexOf('DM+Mono:wght@300;400;500')>=0);
check('home: pullquote at model weight and bar',style().indexOf('.pullquote{font-family:var(--serif);font-size:clamp(22px,2vw,32px);font-weight:400')>=0);
// ── B) assess interactions stay local ──
w.go('assess');await sl(60);
clk(d.getElementById('assessRetake'));await sl(40);
check('retake lands on question one',w.assessStep===1&&!!d.querySelector('[id^="aopt-0-"]'));
w.toggleStage();
check('fullscreen engaged for the sitting',d.getElementById('boardStage').classList.contains('stage-full'));
const vidA=d.querySelector('#app video');
if(vidA)vidA.__marker='SMOKE-KEEP';
clk(d.getElementById('aopt-0-0'));await sl(40);
check('answering keeps fullscreen',d.getElementById('boardStage').classList.contains('stage-full'));
check('clipboard advances in place (question two)',d.getElementById('boardShell').innerHTML.indexOf('QUESTION 2 OF 10')>=0);
const vidB=d.querySelector('#app video');
check('page chrome untouched (video node identity)',!vidA||(vidB&&vidB.__marker==='SMOKE-KEEP'));
for(let qi=1;qi<10;qi++){const el=d.getElementById('aopt-'+qi+'-0')||d.querySelector('[id^="aopt-'+qi+'-"]');clk(el);await sl(25)}
check('completion renders diagnostics without leaving fullscreen',d.getElementById('boardStage').classList.contains('stage-full')&&!!d.getElementById('assessRetake'));
check('completion archives the sitting',w.data.assessmentHistory.length===5);
const sh=d.getElementById('boardShell').innerHTML;
check('dimension poles at the old-file scale (19u)',sh.indexOf('font-size="19"')>=0);
check('body text at 18u sans',sh.indexOf('font-size="18"')>=0);
check('guidance card centered',sh.indexOf('YOUR JUDGMENT GUIDANCE')>=0&&sh.indexOf('x="430"')>=0); /* retargeted Aug 27 2026, Judgment rename (Rev-C); superseded pin: 'YOUR DECISION LAB GUIDANCE' */
check('past assessments stack beneath guidance',sh.indexOf('PAST ASSESSMENTS')>=0&&sh.indexOf('x="466"')>=0);
check('narrative bottom row centered on the gaps',sh.indexOf('x="320"')>=0&&sh.indexOf('x="760"')>=0);
check('body text natural-spaced (no textLength stretch)',(sh.match(/lengthAdjust/g)||[]).length===0);
check('signature carries both poles of every dimension (the radar could not)',['ANALYTICAL','INTUITIVE','SPONTANEOUS','DELIBERATE','BOLD','CAUTIOUS','INDEPENDENT','CONSULTATIVE','OPTIMIZER','PRAGMATIST'].every(function(pl){return sh.indexOf(pl)>=0}));
/* SUPERSEDED July 29 (slab v4 ruling): labels moved to external horizontal bands at cal size; the 20.8 lfs mark left the output. */
check('signature v4: pole labels sit in external bands (horizontal, anchored middle; no rotation)',(function(){var i1=sh.indexOf('ANALYTICAL');return i1>=0&&sh.indexOf('text-anchor="middle"')>=0&&sh.indexOf('rotate(90')===-1})());
check('signature v3: calibrated inset — 0 at top pole INSIDE the slab, 5 marks, score order (unit)',(function(){var f=w.bdSignature(500,300,400,400,{head_gut:0,fast_slow:50,bold_cautious:100,solo_social:50,opt_prag:50},[],'#000',1);
var cys=[];f.replace(/<circle cx="[^"]+" cy="([^"]+)" r="[^"]+" fill="#FFFFFF" stroke=/g,function(m,cy){cys.push(parseFloat(cy))});
var y0=100,H=400; /* cyC 300, areaH 400 */
return cys.length===5&&cys[0]<cys[1]&&cys[1]<cys[2]&&Math.abs(cys[1]-cys[3])<0.01&&cys[0]>y0+8&&cys[2]<y0+H-8&&(f.match(/linearGradient/g)||[]).length>=5})());
check('signature v2: exact midpoints sit on the midline with both poles shown (radar defect regression)',(function(){var f=w.bdSignature(500,300,400,400,{head_gut:50,fast_slow:50,bold_cautious:50,solo_social:50,opt_prag:50},[],'#000',1);
var cys=[];f.replace(/<circle cx="[^"]+" cy="([^"]+)" r="[^"]+" fill="[^"]*" stroke=/g,function(m,cy){cys.push(parseFloat(cy))});
var allEq=cys.length===5&&cys.every(function(v){return Math.abs(v-cys[0])<0.01});
return allEq&&f.indexOf('ANALYTICAL')>=0&&f.indexOf('INTUITIVE')>=0})());
/* SUPERSEDED July 29 (slab v4 ruling): right-margin dating and leader arrows excised; ghost identity lives in the colored compare legend. */
check('signature v4: opt-in ghosts render in slot colors; no margin dates, no arrows',(function(){var t1=1752537600000,t2=1747267200000;
var f=w.bdSignature(500,300,400,400,{head_gut:60},[{scores:{head_gut:20},completedAt:t1,gcol:'#2D5A8E'},{scores:{head_gut:80},completedAt:t2,gcol:'#1B6B5A'}],'#000',1);
var md1=w.fmt(t1).toUpperCase().split(',')[0];
return (f.match(/<polyline/g)||[]).length===4&&f.indexOf('stroke="#2D5A8E"')>=0&&f.indexOf('stroke="#1B6B5A"')>=0&&f.indexOf('>'+md1+'<')===-1&&(f.match(/<path d="M /g)||[]).length===0})());
/* SUPERSEDED July 29 (slab v4 ruling): the two arrow-anchor pins retire with the leader-arrow apparatus \u2014 no v4 equivalent exists. */
check('signature: the radar is fully excised',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return a.indexOf('bdRadar')===-1&&a.indexOf('buildRadarSVG')===-1})());
// ── fill optimality (width-aware wrap) ──
function unesc(t){return t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')}
function greedyOK(txt,budget,maxL,size,fam){var L=w.wrapText(txt,budget,maxL,size,fam);var ok=true;
for(var i=0;i<L.length;i++){if(w.textW(L[i],size,fam)>budget)ok=false;
if(i<L.length-1){var nw=L[i+1].split(' ')[0];if(w.textW(L[i]+' '+nw,size,fam)<=budget)ok=false}}
return ok}
var tipset=w.assessGuidanceTips({head_gut:30,fast_slow:70,bold_cautious:35,solo_social:65,opt_prag:40});
check('guidance tips wrap greedy-optimal within 588u',tipset.length>0&&tipset.every(function(t){return greedyOK(t,588,6,18,0)}));
var narrOK=true,nkeys=Object.keys(w.ASSESS_NARR);
nkeys.forEach(function(k){w.ASSESS_NARR[k].forEach(function(txt){if(!greedyOK(txt,384,7,18,0))narrOK=false})});
check('all narrative texts wrap greedy-optimal within 384u',nkeys.length===5&&narrOK);
var rendered=(sh.match(/<text x="456" y="\d+" font-family="Helvetica[^>]*font-size="18"[^>]*>([^<]*)<\/text>/g)||[]);
check('rendered guidance lines all inside the card',rendered.length>0&&rendered.every(function(m){var t=unesc(m.replace(/<[^>]*>/g,''));return w.textW(t,18,0)<=588}));
var intro=w.buildAssessSVG({step:0,answers:{}});
var pairRe=/<text x="([\d.]+)" y="\d+" font-family="DM Mono" font-size="18" letter-spacing="1"[^>]*>([^<]*)<\/text>/g,pm,pairs=[],pxs=[],pfit=true;
while((pm=pairRe.exec(intro))){var px=parseFloat(pm[1]),pt=unesc(pm[2]);pairs.push(pt);pxs.push(px);
if(px<440||px+w.textW(pt,18,1,1)>1060)pfit=false}
check('intro dimension pairs: five present, single column at 18u, inside the sheet',pairs.length===5&&pfit&&pxs.every(function(x){return x===pxs[0]})&&pairs[4]!==undefined);
check('intro legend fits above the sheet foot',(function(){var yRe=/<text x="[\d.]+" y="(\d+)" font-family="DM Mono" font-size="18" letter-spacing="1"/g,ym,maxy=0;while((ym=yRe.exec(intro))){maxy=Math.max(maxy,parseInt(ym[1],10))}return maxy>0&&maxy<=44+590-20})());
var q1=w.buildAssessSVG({step:1,answers:{}});
check('assess floor: no italics anywhere on the intake',intro.indexOf('font-style="italic"')===-1&&q1.indexOf('font-style="italic"')===-1);
var subRe=/font-size="(?:\d|1[0-7])(?:\.\d+)?"/;
check('assess floor: no sub-18 type on the intake',!subRe.test(intro)&&!subRe.test(q1));
check('assess floor: no sub-18 type on the diagnostics',!subRe.test(sh));
check('assess floor: question caption promoted to 20u regular serif',q1.indexOf('font-size="20"')>=0&&q1.indexOf('Choose the approach')>=0);
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
// ── C) dashboard profile guard ──
w.go('dashboard');await sl(60);
w.toggleStage();
clk(d.getElementById('profileBtn'));await sl(120);
check('profile regeneration keeps the dashboard fullscreen',d.getElementById('boardStage').classList.contains('stage-full'));
check('profile refreshed through the stub',w.data.profile&&w.data.profile.text==='STUB CHALLENGE');
check('dashboard shell re-rendered locally',d.getElementById('boardShell').innerHTML.length>15000);
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
// \u2500\u2500 responsive tiers \u2500\u2500
w.__forceTier='narrow';w.bdRenderDash();await sl(60);
var nsh=d.getElementById('boardShell').innerHTML;
check('tier: narrow renders on the 440 canvas',nsh.indexOf('viewBox="0 0 440')>=0);
check('tier: narrow keeps every section',nsh.indexOf('WRITTEN PROFILE')>=0&&nsh.indexOf('YOUR PLAYBOOK')>=0&&nsh.indexOf('ALL DECISIONS')>=0&&nsh.indexOf('DECISIONS CLOSED')>=0);
check('tier: narrow keeps all interactive rows',d.querySelectorAll('[id^="dr-"]').length===10&&d.querySelectorAll('[id^="act-"]').length===4&&d.querySelectorAll('[id^="loop-"]').length===3);
check('tier: narrow signature carries both poles',nsh.indexOf('viewBox="0 0 440')>=0&&nsh.indexOf('OPTIMIZER')>=0&&nsh.indexOf('PRAGMATIST')>=0);
w.__forceTier='mid';w.bdRenderDash();await sl(60);
var msh=d.getElementById('boardShell').innerHTML;
check('tier: mid renders on the 900 canvas',msh.indexOf('viewBox="0 0 900')>=0);
check('tier: mid signature carries both poles',msh.indexOf('OPTIMIZER')>=0&&msh.indexOf('PRAGMATIST')>=0);
w.__forceTier=null;w.bdRenderDash();await sl(60);
check('tier: default returns to the wide 1500 canvas',d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 1500')>=0);
// \u2500\u2500 narrow decision board \u2500\u2500
w.__forceTier='narrow';w.go('detail','demo05');await sl(80);
var bsh=d.getElementById('boardShell').innerHTML;
check('tier: narrow board on the 440 canvas',bsh.indexOf('viewBox="0 0 440')>=0);
check('tier: narrow board stacks every card',d.querySelectorAll('[id^="card-"]').length===19);
check('tier: four group headers present',bsh.indexOf('THE PROBLEM')>=0&&bsh.indexOf('THE EXAMINATION')>=0&&bsh.indexOf('THE CALL')>=0&&bsh.indexOf('CLOSING THE FILE')>=0);
check('tier: narrow titles at readable scale (serif heads at 18, refined July 13)',bsh.indexOf('font-family="Cormorant Garamond" font-size="18" font-weight="500"')>=0);
check('tier: process spine present',bsh.indexOf('id="threads"')>=0);
check('threads layered under headers and cards; header halo; MIND CHANGED gone',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');var hd=w.columnHeader(500,300,'CLOSING THE FILE','#000','x');
return bsh.indexOf('id="threads"')<bsh.indexOf('CONDITIONS OF FAILURE')&&hd.indexOf('<rect')<hd.indexOf('CLOSING THE FILE')&&a.indexOf('MIND CHANGED')===-1})());
check('dashboard: the shared activity/loop height floors at 240 so folders never cover the section header',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');
return a.indexOf('ah=Math.max(80+m.acts.length*72,240)')>=0&&a.indexOf('fy=ly+lh/2-59')>=0&&((240-118)/2)>=52})());
w.tryOpen('problem');await sl(40);
check('tier: narrow card opens the focus reel',d.getElementById('focusBg').classList.contains('open'));
w.closeFocus();await sl(40);
w.go('detail','demo01');await sl(80);
var bfull=d.getElementById('boardShell').innerHTML;
check('tier: compact filled cards keep the wide grammar (voice italics, tag pills, head rules, hub, memo)',bfull.indexOf('font-style="italic"')>=0&&bfull.indexOf('rx="8.5"')>=0&&bfull.indexOf('>FOR<')>=0&&bfull.indexOf('>AGAINST<')>=0&&bfull.indexOf('stroke="rgba(30,37,48,0.12)"')>=0&&bfull.indexOf('UNDER REVIEW')>=0&&bfull.indexOf('LIVE AI IN MODULE')>=0);
check('tier: compact response card sheds its paperclip',bfull.indexOf('a 7.5,7.5 0 0 1 -15,0')===-1);
check('tier: compact CLOSED stamp strikes the Problem header zone',bfull.indexOf('DECISION CLOSED')>=0&&bfull.indexOf('y="206" width="360"')>=0&&bfull.indexOf('y="126" width="360"')===-1);
check('wide CLOSED stamp runs diagonally across the top-left',html.indexOf('var x=385,y=168;')>=0&&html.indexOf("rotate(-14 '+x+' '+y+')")>=0&&html.indexOf('var x=745,y=564;')===-1);
w.__forceTier='mid';w.go('detail','demo05');await sl(80);
var bmh=d.getElementById('boardShell').innerHTML;
check('tier: mid board on the 900 canvas',bmh.indexOf('viewBox="0 0 900')>=0);
check('tier: mid board keeps all 19 cards',d.querySelectorAll('[id^="card-"]').length===19);
w.__forceTier='narrow';w.go('lab');await sl(80);
var fsh=d.getElementById('boardShell').innerHTML;
check('tier: narrow cabinet on the 440 canvas',fsh.indexOf('viewBox="0 0 440')>=0);
check('tier: narrow cabinet shows folders and controls',d.querySelectorAll('[id^="folder-"]').length>=6&&fsh.indexOf('filesMore')>=0&&fsh.indexOf('newFolder')>=0);
check('tier: compact cabinet keeps the ruled CTA copy in the folder chrome',fsh.indexOf('START WORKING THROUGH A NEW DECISION')>=0&&fsh.indexOf('START A NEW DECISION FILE')===-1&&fsh.indexOf('open a fresh file')>=0);
check('tier: compact cabinet header card matches the wide subtitle',fsh.indexOf('Every decision you have opened, both active and resolved')>=0&&fsh.indexOf('Every decision gets a file')===-1);
check('detail band: gauge centered when the band stacks',style().indexOf('.det-band-right .gauge-wrap{text-align:center}')>=0);
check('tier: compact cabinet header carries the contoured accent rail',fsh.indexOf('clip-path="url(#rb')>=0&&fsh.indexOf('height="4"')>=0);
/* \u2500\u2500 rail contouring (July 28 ruling): strips clipped to the card contour \u2500\u2500 */
check('rails: railBar clips to the card contour, colour flush to the edge (unit)',(function(){var f=w.railBar(100,200,300,'#000');return f.indexOf('<clipPath id="rb100x200"')>=0&&f.indexOf('rx="7"')>=0&&f.indexOf('clip-path="url(#rb100x200)"')>=0&&f.indexOf('<rect x="100" y="200" width="300" height="4"')>=0})());
check('rails: railBarV clips, honours the row radius override, edge-flush (unit)',(function(){var f=w.railBarV(100,200,80,'#000',3.5,6);return f.indexOf('<clipPath id="rv100x200"')>=0&&f.indexOf('rx="6"')>=0&&f.indexOf('clip-path="url(#rv100x200)"')>=0&&f.indexOf('<rect x="100" y="200" width="3.5" height="80"')>=0})());
check('stage: the Full-screen button anchors to the board box at every site; the failure card carries its title width',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return a.split('<div class="stage-wrap"><button class="stage-btn"').length===5&&a.indexOf("label:'CONDITIONS OF FAILURE',x:391,y:816,w:220")>=0})());
check('rails: every corner-touching vertical strip routes through railBarV; naked forms excised',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return (a.match(/railBarV\(/g)||[]).length===8&&a.indexOf('width="4" height="118"')===-1&&a.indexOf('width="3.5" height="\'+(hh-2)')===-1})());
check('tier: fullscreen control hidden at narrow on the cabinet too',d.getElementById('boardStage').classList.contains('tier-narrow'));
check('tier: all four surfaces toggle tier-narrow',(html.match(/classList\.toggle\('tier-narrow'/g)||[]).length===4);
check('detail stage: full-bleed base width with the ultra-wide cap',style().indexOf('--bw:min(calc(100vw - 40px),1960px)')>=0&&style().indexOf('.det-band,.board-stage:not(.view-files):not(.stage-full)')>=0);
check('detail stage: legacy breakout scoped to the wrapped surfaces',style().indexOf('.board-stage.view-files:not(.stage-full){width:calc(100% + 192px)')>=0);
check('tier: detail wide threshold retuned for the full-bleed pane',html.indexOf('iw>=1320*z')>=0&&html.indexOf('iw>=1350*z')===-1);
check('diagnostic chip fully removed',html.indexOf('tierDebug')===-1);
w.__forceTier='mid';w.bdRenderFiles();await sl(60);
check('tier: mid cabinet on the 900 canvas',d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 900')>=0);
// \u2500\u2500 assess intake tiers \u2500\u2500
var ain0=w.buildAssessCompactSVG({step:0,answers:{}},'narrow');
check('tier: narrow assess intro on the 440 canvas',ain0.indexOf('viewBox="0 0 440')>=0);
check('tier: narrow intro order intro\u2192cards\u2192begin',(function(){var a=ain0.indexOf('Ten scenarios'),b=ain0.indexOf('WHY WE ASK'),c=ain0.indexOf('WHERE IT GOES'),e=ain0.indexOf('BEGIN ASSESSMENT');return a>=0&&b>a&&c>b&&e>c})());
check('tier: narrow intro carries the legend at the floor',(ain0.match(/\u2194/g)||[]).length===5&&!subRe.test(ain0)&&ain0.indexOf('font-style="italic"')===-1);
var ain1=w.buildAssessCompactSVG({step:1,answers:{}},'narrow');
check('tier: narrow question keeps both options untruncated',ain1.indexOf('aopt-0-0')>=0&&ain1.indexOf('aopt-0-100')>=0&&ain1.indexOf('\u2026')===-1&&!subRe.test(ain1));
var aim0=w.buildAssessCompactSVG({step:0,answers:{}},'mid');
check('tier: mid assess intro on the 900 canvas with both cards',aim0.indexOf('viewBox="0 0 900')>=0&&aim0.indexOf('WHY WE ASK')>=0&&aim0.indexOf('WHERE IT GOES')>=0&&!subRe.test(aim0));
w.__forceTier='narrow';w.go('assess');await sl(80);
clk(d.getElementById('assessRetake'));await sl(50);
check('tier: narrow assess page renders the compact sitting',d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 440')>=0&&!!d.querySelector('[id^="aopt-0-"]'));
clk(d.getElementById('aopt-0-0'));await sl(40);
check('tier: narrow answering advances in place',d.getElementById('boardShell').innerHTML.indexOf('QUESTION 2 OF 10')>=0);
check('tier: assess resize branch wired',html.indexOf("else if(currentPage==='assess')bdRenderAssess()")>=0);
var rsc={head_gut:30,fast_slow:70,bold_cautious:35,solo_social:65,opt_prag:40};
var arn=w.buildAssessCompactSVG({step:'done',scores:rsc,history:[],histIdx:null,dateStr:'Jul 12, 2026'},'narrow');
check('tier: narrow diagnostics on the 440 canvas with every section',arn.indexOf('viewBox="0 0 440')>=0&&arn.indexOf('SELF-PERCEIVED STYLE')>=0&&arn.indexOf('WHERE YOU SIT')>=0&&arn.indexOf('HOW YOU DECIDE')>=0&&arn.indexOf('YOUR JUDGMENT GUIDANCE')>=0); /* retargeted Aug 27 2026, Judgment rename (Rev-C); superseded pin: 'YOUR DECISION LAB GUIDANCE' */
check('tier: narrow diagnostics carry five narratives, retake, no italics',(arn.match(/\u25CE|\u25C7|\u25C6|\u25CB|\u25A1/g)||[]).length>=5&&arn.indexOf('assessRetake')>=0&&arn.indexOf('font-style="italic"')===-1);
var arm=w.buildAssessCompactSVG({step:'done',scores:rsc,history:[],histIdx:null,dateStr:'Jul 12, 2026'},'mid');
check('tier: mid diagnostics on the 900 canvas at the floor',arm.indexOf('viewBox="0 0 900')>=0&&!subRe.test(arm)&&arm.indexOf('font-style="italic"')===-1);
for(let aqi=1;aqi<10;aqi++){const el=d.getElementById('aopt-'+aqi+'-0')||d.querySelector('[id^="aopt-'+aqi+'-"]');clk(el);await sl(25)}
check('tier: narrow completion renders compact diagnostics in place',d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 440')>=0&&!!d.getElementById('assessRetake'));
check('tier: narrow completion archives the sitting',w.data.assessmentHistory.length===6);
clk(d.querySelector('[id^="ahist-"]'));await sl(50);
check('tier: narrow history view opens compact with the back control',d.getElementById('boardShell').innerHTML.indexOf('VIEWING PAST ASSESSMENT')>=0&&!!d.getElementById('assessBackLatest')&&d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 440')>=0);
clk(d.getElementById('assessBackLatest'));await sl(40);
check('tier: narrow back-to-latest restores the live diagnostics',w.assessHistIdx===null&&!!d.getElementById('assessRetake'));
w.__forceTier=null;w.innerWidth=1047;w.go('detail','demo05');await sl(80);
var stg1=d.getElementById('boardStage');
check('tier: board stays mid when drawers stack (no wide pop at 1047)',d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 900')>=0);
check('tier: drawers removed once they would sit above the board',stg1.classList.contains('no-drawers')&&!stg1.classList.contains('tier-narrow'));
w.innerWidth=1169;w.dispatchEvent(new w.Event('resize'));await sl(60);
check('tier: drawers restored beside the mid board at 1169',!d.getElementById('boardStage').classList.contains('no-drawers'));
w.innerWidth=1500;w.dispatchEvent(new w.Event('resize'));await sl(60);
check('tier: board returns to wide by default',d.getElementById('boardShell').innerHTML.indexOf('viewBox="0 0 1500')>=0);
(function(){var sh=d.getElementById('boardShell');var cls=sh.querySelectorAll('.bd-click');var nested=0;
cls.forEach(function(el){var pp=el.parentElement;while(pp&&pp!==sh){if(pp.classList&&pp.classList.contains('bd-click')){nested++;break}pp=pp.parentElement}});
check('wide board: 19 clickable cards, none nested inside another',cls.length===19&&nested===0);
var hits=0,lifts=0;cls.forEach(function(el){var fc=el.firstElementChild;if(fc&&fc.tagName==='rect'&&fc.getAttribute('pointer-events')==='all')hits++;if(el.querySelector(':scope > g.bd-lift'))lifts++});
check('wide board: every card has a stationary hit rect and a lift layer',hits===19&&lifts===19);})();

/* ── auth adapter (chunk 1: unwired, local mode) ── */
(function(){var keep=w.localStorage.getItem('dl-accounts');
var r1=null;w.Auth.createAccount('probe','12',function(res){r1=res});
check('auth adapter: weak PIN rejected synchronously in local mode',!!r1&&r1.ok===false&&r1.reason==='weak');
var r2=null;w.Auth.createAccount('probe','4321',function(res){r2=res});
var r3=null;w.Auth.signIn('probe','9999',function(res){r3=res});
var r4=null;w.Auth.signIn('PROBE','4321',function(res){r4=res});
check('auth adapter: create + sign-in round-trip (wrong PIN refused, username case-insensitive)',!!r2&&r2.ok===true&&!!r3&&r3.ok===false&&r3.reason==='bad-pin'&&!!r4&&r4.ok===true);
if(keep===null)w.localStorage.removeItem('dl-accounts');else w.localStorage.setItem('dl-accounts',keep);
check('auth adapter: seam constant defined once',(html.match(/var AUTH_ENDPOINT=/g)||[]).length===1);})();

/* ── auth session round-trip (chunk 3) ── */
w.confirm=function(){return true}; /* harness infrastructure (July 29): signOut is confirm-gated after the ER conformance port; stub before the first sign-out */
w.signOut();
check('auth: sign-out returns the gate and clears remember',!w.authSignedIn&&!!d.getElementById('entryUser')&&w.localStorage.getItem('dl-remember')===null);
d.getElementById('entryUser').value='smoke';d.getElementById('entryPin').value='9999';
w.doEntry();
check('auth: wrong PIN refused at the gate',!w.authSignedIn&&d.getElementById('app').innerHTML.indexOf('Incorrect PIN')>=0);
d.getElementById('entryUser').value='smoke';d.getElementById('entryPin').value='1234';
var rrc=d.getElementById('entryRemember');if(rrc)rrc.checked=true;
w.doEntry();
check('auth: re-sign-in restores the app with remember set',w.authSignedIn===true&&JSON.parse(w.localStorage.getItem('dl-remember')||'{}').username==='smoke');
check('auth: boot restores a remembered session (hook before first render)',html.indexOf('var __ru=Auth.rememberedUser();if(__ru&&Auth.findAccount(__ru)){Auth.setSession(true);dlAdoptIdentity(__ru);}')>=0);
check('auth: More menu offers sign out',html.indexOf('closeNavMore();signOut()')>=0);

/* \u2500\u2500 multi-account gate (July 28 ruling: the enterprise gate, single-user form) \u2500\u2500 */
w.signOut();
check('gate: sign-in screen offers Create a new account',d.getElementById('app').innerHTML.indexOf('Create a new account')>=0&&!!d.querySelector('.entry-foot-btn'));
check('gate: AI Guide floater hidden pre-login',d.getElementById('coachFab').style.display==='none'&&d.getElementById('fabPulse').style.display==='none');
w.gotoSetup();
check('gate: setup reachable from sign-in with Back, name and email fields',!!d.getElementById('entryName')&&!!d.getElementById('entryEmail')&&d.getElementById('app').innerHTML.indexOf('Back to sign in')>=0);
d.getElementById('entryName').value='Smoke Two';d.getElementById('entryUser').value='smoke';d.getElementById('entryPin').value='5678';
w.doEntry();
check('gate: duplicate username rejected with the taken message',!w.authSignedIn&&d.getElementById('app').innerHTML.indexOf('already taken on this device')>=0);
d.getElementById('entryName').value='Smoke Two';d.getElementById('entryUser').value='smoke2';d.getElementById('entryEmail').value='two@smoke.test';d.getElementById('entryPin').value='5678';
w.doEntry();
check('gate: second account created and adopted with its own fresh-seeded record',w.authSignedIn===true&&w.currentUserId==='smoke2'&&w.data.decisions.length===10&&!!w.localStorage.getItem('dl-data::smoke2'));
check('gate: accounts list carries both; first record untouched',w.Auth.accounts().length>=2&&w.localStorage.getItem('dl-data::smoke').indexOf('EDITED-BY-SMOKE')>=0);
check('gate: per-user isolation \u2014 the second store has no first-user edits',w.localStorage.getItem('dl-data::smoke2').indexOf('EDITED-BY-SMOKE')===-1);
w.signOut();
d.getElementById('entryUser').value='smoke';d.getElementById('entryPin').value='1234';
(function(){var rrc=d.getElementById('entryRemember');if(rrc)rrc.checked=true;})();
w.doEntry();
check('gate: signing back in as the first account restores that user\u2019s data',w.currentUserId==='smoke'&&JSON.stringify(w.data).indexOf('EDITED-BY-SMOKE')>=0);
check('video collapse + vid-seen: sign-out cleared both session records',w.localStorage.getItem('dl-vidcollapse')===null&&w.localStorage.getItem('dl-vidseen')===null&&(function(){var vc=w.vidCollapsed;for(var k in vc)return false;return true})());
check('gate: AI Guide floater restored after sign-in',d.getElementById('coachFab').style.display==='');

/* ── true dark board round ── */
w.toggleTheme();await sl(60);
check('dark board: vibe swaps to the dark palette',w.getTheme()==='dark'&&w.V.board==='#1D2531'&&w.INK==='#E2E9F1');
w.go('detail','demo01');await sl(80);
var bdk=d.getElementById('boardShell').innerHTML;
check('dark board: dark surfaces and tinted hues in the build',bdk.indexOf('#1D2531')>=0&&bdk.indexOf('#2C3846')>=0&&bdk.indexOf('#6B9FE0')>=0&&bdk.indexOf('flood-color="#000000"')>=0&&bdk.indexOf('fill="#D5DEE9"')===-1);
check('dark board: remap block present, scoped to the board shell',style().indexOf('[data-theme="dark"] #boardShell svg')>=0&&style().indexOf('svg [fill="rgba(30,37,48,0.12)"]{fill:rgba(var(--fg-rgb),0.14)}')>=0);
w.toggleTheme();await sl(80);
var blt=d.getElementById('boardShell').innerHTML;
check('dark board: light round-trip restores the lit board',w.V.board==='#D5DEE9'&&blt.indexOf('#D5DEE9')>=0&&blt.indexOf('#1D2531')===-1);
check('dark board: written-profile card rides the stock, no literal cream',html.indexOf("bdCardRect(100,py,1300,qh,V.stocks.s8,false)")>=0&&html.indexOf("qh,'#FDF7F3'")===-1);

/* ── dead-code cleanup ── */
check('cleanup: legacy tab layer excised',['function renderTab(','function tabProblem(','function tabDebrief(','function bestArgBox(','function generateChallenge(','function flowExample(','function renderCarousel(','function sectionHead('].every(function(x){return html.indexOf(x)===-1}));
check('cleanup: seam holds one live definition and three live fetch sites',(html.match(/fetch\(CLAUDE_API_URL/g)||[]).length===3);
check('cleanup: thread trio and reminders twin gone, retained material intact',html.indexOf('function threadPath(')===-1&&html.indexOf('function threadSVG(')===-1&&html.indexOf('function chevronAt(')===-1&&html.indexOf('if(m.notif){')===-1&&html.indexOf('SECTION_EXAMPLES')>=0&&html.indexOf('function toggleSpec(')>=0&&html.indexOf('CAROUSEL_DATA')>=0&&html.indexOf('function buildChallengePrompt(')>=0);
check('cleanup: wide hub card body clears the flag',html.indexOf('bodyY=c.hub?c.y+63:c.y+51;')>=0);

/* ── design round: sidebar fonts + flowchart connectors ── */
check('design: column-header builder rides the serif (shared by both tiers)',html.indexOf('font-family="Cormorant Garamond" font-size="20" font-weight="500" letter-spacing="4" text-anchor="middle"')>=0&&html.indexOf('font-family="DM Mono" font-size="14" letter-spacing="5" text-anchor="middle"')===-1);
var bshD=d.getElementById('boardShell').innerHTML;
check('design: rendered board headers are Cormorant',/font-family="Cormorant Garamond"[^>]*>THE EXAMINATION</.test(bshD)&&/font-family="Cormorant Garamond"[^>]*>CLOSING THE FILE</.test(bshD));
var tgD=bshD.match(/<g id="threads"[^>]*>([\s\S]*?)<\/g>/);
check('design: threads are orthogonal flowchart lines (no curves)',!!tgD&&tgD[1].indexOf(' C ')===-1&&tgD[1].indexOf(' L ')>=0);
check('design: procLine is length-branched (straight ≤130, elbow + t-mid beyond), cubics absent (refined July 13)',html.indexOf("if(len<=130){if(dir==='right'){ay=by;}else{ax=bx;}d='M '+ax+','+ay+' L '+bx+','+by;")>=0&&html.indexOf("' L '+mx+','+ay+'")>=0&&html.indexOf("' L '+ax+','+my+'")>=0&&html.indexOf('class="t-mid"')>=0&&html.indexOf("' C '+ax+'")===-1&&html.indexOf("' C '+(ax+70)+'")===-1);
check('design: entry title subtitle emphasizes both words',html.indexOf('Judgment \u2014 <em>Critical Thinking</em>')>=0&&html.indexOf('Judgment \u2014 <em>Critical</em> Thinking')===-1); /* retargeted Aug 27 2026, Judgment rename (Rev-C); superseded pin: 'The <em>Decision Lab</em>' / 'The <em>Decision</em> Lab', description 'design: entry title emphasizes both words' */
check('design: card heads serif in both tiers, mono heads absent',html.indexOf('font-family="Cormorant Garamond" font-size="\'+(c.w<=180?11.5:13)+\'"')>=0&&html.indexOf('font-family="Cormorant Garamond" font-size="\'+(titleFs+2)+\'"')>=0&&html.indexOf('font-family="DM Mono" font-size="\'+titleFs+\'"')===-1&&html.indexOf('font-family="DM Mono" font-size="\'+(c.w<=180?9.5:11)+\'"')===-1);
check('design: rendered wide board card heads are Cormorant',/font-family="Cormorant Garamond" font-size="13" font-weight="500"[^>]*>THE SITUATION</.test(d.getElementById('boardShell').innerHTML));
check('design: sub-steps sans, drawer heads serif (Pipeline sidebar basis)',style().indexOf('font-family:var(--sans);font-size:14px;letter-spacing:0')>=0&&style().indexOf('font-family:var(--serif);font-size:14px;font-weight:600;letter-spacing:.08em')>=0&&style().indexOf('font-family:var(--mono);font-size:10.5px;letter-spacing:.14em')===-1);
/* ── typography rollout: Assess + Dashboard ── */
check('rollout: dashboard headers serif in both tiers, mono residue zero',html.indexOf('font-family="Cormorant Garamond" font-size="25" font-weight="500" letter-spacing="2.5" text-anchor="middle" fill="\'+INK+\'">WRITTEN PROFILE')>=0&&(html.match(/font-size="'\+L\.lab\+'" font-weight="500"/g)||[]).length===5&&html.indexOf('font-family="DM Mono" font-size="22"')===-1);
check('rollout: assess headers serif, side cards at 15×fs, mono ls2.4 residue zero',html.indexOf('font-size="\'+(15*fs)+\'" font-weight="500"')>=0&&html.indexOf('font-family="DM Mono" font-size="18" letter-spacing="2.4"')===-1);
w.go('dashboard');await sl(80);
var dsh=d.getElementById('boardShell').innerHTML;
check('rollout: rendered dashboard rides the serif headers',dsh.indexOf('font-weight="500" letter-spacing="2.5" text-anchor="middle" fill="#1E2530">WRITTEN PROFILE')>=0&&/font-family="Cormorant Garamond"[^>]*>RECENT ACTIVITY</.test(dsh)&&/font-family="DM Mono"[^>]*>DECISIONS OPENED</.test(dsh));
w.go('assess');await sl(80);
var ash=d.getElementById('boardShell').innerHTML;
/* ── connector refinement: mid arrows + straight short hops + key truth ── */
w.go('detail','demo01');await sl(80);
var bshK=d.getElementById('boardShell').innerHTML;
var tgK=bshK.match(/<g id="threads"[^>]*>([\s\S]*?)<\/g>/);
check('threads: long tracks carry mid direction arrows',!!tgK&&tgK[1].indexOf('class="t-mid"')>=0);
check('threads: short hops are single straight segments',!!tgK&&(tgK[1].match(/d="M [\d.]+,[\d.]+ L [\d.]+,[\d.]+"/g)||[]).length>=6);
check('threads: short hops are axis-aligned (no diagonals)',(function(){if(!tgK)return false;var re=/d="M ([\d.]+),([\d.]+) L ([\d.]+),([\d.]+)"/g,m,ok=true,n=0;while((m=re.exec(tgK[1]))){n++;if(m[1]!==m[3]&&m[2]!==m[4])ok=false}return ok&&n>=6})());
check('threads: contrast lifted above the board dividers',html.indexOf('stroke-width="1.3" opacity="0.34"')>=0&&html.indexOf('stroke-width="1" opacity="0.18"')>=0&&html.indexOf('var op=av&&bv?0.34:(av?0.5:0.18);')>=0&&html.indexOf('stroke-width="1.3" opacity="0.25"')===-1&&html.indexOf('stroke-width="1" opacity="0.10"')===-1);
check('drawer row fit: hugging plate, tightened gaps, pinned right group',style().indexOf('.drawer-plate{flex:0 1 auto;')>=0&&style().indexOf('padding:5px 6px')>=0&&style().indexOf('.drawer-pull{width:18px;height:6px;border-radius:3px;background:var(--gold);opacity:.85;flex-shrink:0;margin-left:auto}')>=0&&style().indexOf('.drawer-count{font-family:var(--mono);font-size:11.5px;color:var(--stone);flex-shrink:0;white-space:nowrap}')>=0&&style().indexOf('.drawer-plate{flex:1;')===-1);
check('key card reflects usage: ink samples, mid arrow, dotted road-ahead gone',html.indexOf('stroke-dasharray="1.5 5"')===-1&&html.indexOf("transform=\"translate('+(x+25)+','+(y+38)+')\" fill=\"'+INK+'\" opacity=\"0.7\"")>=0&&html.indexOf("stroke=\"'+V.thread+'\"")===-1);
check('rollout: rendered assess results ride the serif headers, eyebrow stays mono',/font-family="Cormorant Garamond"[^>]*>WHERE YOU SIT ON EACH DIMENSION</.test(ash)&&/font-family="Cormorant Garamond"[^>]*>YOUR JUDGMENT GUIDANCE</.test(ash)); /* retargeted Aug 27 2026, Judgment rename (Rev-C); superseded pin: >YOUR DECISION LAB GUIDANCE< */
/* \u2500\u2500 session-scoped video collapse (July 28 ruling) \u2500\u2500 */
var vtag=function(){var mm=d.getElementById('app').innerHTML.match(/<details class="video-collapse[^>]*>/);return mm?mm[0]:''};
w.go('assess');await sl(60);
check('video collapse: assess panel opens by default with the toggle wired',vtag().indexOf("vidToggle('assess',this.open)")>=0&&/ open(=""|>| )/.test(vtag()));
w.vidToggle('assess',false);w.go('dashboard');await sl(60);w.go('assess');await sl(60);
check('video collapse: survives navigating away and back (the ruled defect)',vtag().indexOf("vidToggle('assess'")>=0&&!/ open(=""|>| )/.test(vtag()));
check('video collapse: per page \u2014 the dashboard video stays open',(function(){return JSON.parse(w.localStorage.getItem('dl-vidcollapse')).assess===true&&!JSON.parse(w.localStorage.getItem('dl-vidcollapse')).dashboard})());
w.vidToggle('assess',true);w.go('assess');await sl(60);
check('video collapse: expanding restores and clears the record',/ open(=""|>| )/.test(vtag())&&w.localStorage.getItem('dl-vidcollapse')==='{}');
w.vidToggle('dashboard',false);
check('where-you-sit: the numeric ruler \u2014 0-centre scale, pole fives, one bar or balanced marker per row; dot rows gone',(function(){
var zeros=(ash.match(/opacity="0.5">0<\/text>/g)||[]).length; /* the flanking pair, two per row (July 28 ruling) */
var fives=(ash.match(/opacity="0.45">5<\/text>/g)||[]).length;
var bars=(ash.match(/height="13" fill="#[0-9A-Fa-f]{6}"/g)||[]).length;
var bal=(ash.match(/r="5.5" fill="none" stroke="#[0-9A-Fa-f]{6}" stroke-width="2.4"/g)||[]).length;
return zeros>=10&&fives>=10&&(bars+bal)===5&&ash.indexOf('0 \u00B7 BALANCED')===-1&&(bal===0||ash.indexOf('>BALANCED</text>')>=0)&&ash.indexOf('stroke="rgba(30,37,48,0.14)" stroke-width="7"')===-1})());
check('ruler: BALANCED sits centred above the zero; zeros flank the tick (unit)',(function(){var f=w.bdDimRuler(100,200,400,{id:'x',left:'A',right:'B',ck:'red'},50,1);
return f.indexOf('y="185" text-anchor="middle"')>=0&&f.indexOf('>BALANCED</text>')>=0&&f.indexOf('0 \u00B7 BALANCED')===-1&&f.indexOf('x="284" y="230" text-anchor="end"')>=0&&f.indexOf('x="316" y="230" text-anchor="start"')>=0})());
check('bd-flat: flat hover + orange rim across the text-outside-filter set; the board lift stays elsewhere',(function(){var f=w.bdOptBlock(100,100,600,0,0,'A','text',false);var pt=w.bdPageTab('t1',100,100,'TEST');var c=fs.readFileSync(path.join(BASE,PFX+'styles.css'),'utf8');var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');
return f.indexOf('class="bd-click bd-flat"')>=0&&pt.indexOf('class="bd-click bd-flat"')>=0&&c.indexOf('.bd-click.bd-flat:hover{filter:none}')>=0&&c.indexOf('.bd-click.bd-flat:hover rect{stroke:var(--gold)')>=0&&c.indexOf('.bd-click:hover{filter:drop-shadow')>=0&&c.indexOf('.bd-click.aopt')===-1&&(a.match(/bd-click bd-flat/g)||[]).length===10})()); /* count 5\u219210 July 29 (slab v4 + history rulings): + wide/mid compare checkboxes, + wide/mid DELETE \u2014 all flat-hover text-outside-filter controls by the same rule */
/* ── Part VIII: deployment file set ── */
if(BASE){
check('set: shell shape — first-paint inline, one styles link, ported load order',(function(){const ix=fs.readFileSync(path.join(BASE,PFX+'index.html'),'utf8');return ix.indexOf("localStorage.getItem('dl-theme')")>=0&&(ix.match(/<link rel="stylesheet"/g)||[]).length===1&&(function(){var sq=function(f){return '<script src="'+PFX+f+'">'};return ix.indexOf(sq('templates-local.js'))<ix.indexOf(sq('screen-loader.js'))&&ix.indexOf(sq('screen-loader.js'))<ix.indexOf(sq('home.js'))&&ix.indexOf(sq('home.js'))<ix.indexOf(sq('learn.js'))&&ix.indexOf(sq('learn.js'))<ix.indexOf(sq('app.js'))})()})());
check('set: app.js sheds the extracted renderers, gains the module dispatch',(function(){const a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return a.indexOf('function renderHome(')===-1&&a.indexOf('function renderLearn(')===-1&&a.indexOf('SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn}')>=0&&a.indexOf('if(!screenFn){')>=0})());
check('set: screens are pure markup with declarative nav (home carries 10 data-nav)',(function(){const hh=fs.readFileSync(path.join(BASE,PFX+'home.html'),'utf8'),ll=fs.readFileSync(path.join(BASE,PFX+'learn.html'),'utf8');return hh.indexOf('onclick=')===-1&&ll.indexOf('onclick=')===-1&&hh.indexOf('<script')===-1&&ll.indexOf('<script')===-1&&(hh.match(/data-nav="/g)||[]).length===10})());
check('set: templates-local bundle matches the .html sources byte-for-byte',(function(){const tl=fs.readFileSync(path.join(BASE,PFX+'templates-local.js'),'utf8');const m2=tl.match(/window\.__LOCAL_TEMPLATES = (\{[\s\S]*\});/);if(!m2)return false;const b=JSON.parse(m2[1]);return b.home===fs.readFileSync(path.join(BASE,PFX+'home.html'),'utf8')&&b.learn===fs.readFileSync(path.join(BASE,PFX+'learn.html'),'utf8')})());
check('set: screen-loader carries the three DL adaptations, Pipeline auth hook gone',(function(){const s2=fs.readFileSync(path.join(BASE,PFX+'screen-loader.js'),'utf8');return s2.indexOf('window.authSignedIn')>=0&&s2.indexOf('window.appZoom || 1')>=0&&s2.indexOf('window.renderModal')>=0&&s2.indexOf('getCurrentUser')===-1})());
w.go('home');await sl(80);
var homeSh=d.getElementById('app').innerHTML;
check('set: home mounts from the template with live data-nav wiring',homeSh.indexOf('hero-headline')>=0&&homeSh.indexOf('data-nav="lab"')>=0&&homeSh.indexOf('onclick="go(')===-1);
clk(d.querySelector('#app [data-nav="lab"]'));await sl(80);
check('set: data-nav click navigates (Start Practicing → Practice)',w.currentPage==='lab');
w.go('learn');await sl(80);
var learnSh=d.getElementById('app').innerHTML;
check('set: learn mounts with the baked reading list',learnSh.indexOf('Foundation')>=0&&learnSh.indexOf('insight-card')>=0);
/* ── AI state exports (Paul's ruling, July 14) ── */
check('exports: single-source builders, generateProfile rides buildProfilePrompt',(function(){const a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return a.indexOf('function buildProfilePrompt()')>=0&&a.indexOf('content:buildProfilePrompt()')>=0&&a.indexOf("content:sysPrompt+'")===-1&&a.indexOf('function buildAIState1Md()')>=0&&a.indexOf('function buildAIState2Md()')>=0&&a.indexOf('function exportAIState1()')>=0&&a.indexOf('function exportAIState2()')>=0&&(a.match(/nav-more-item" role="menuitem" onclick="closeNavMore\(\);exportAIState/g)||[]).length===2&&a.indexOf('class="dutil" onclick="exportAIState')===-1})());
var md1=w.buildAIState1Md(),md2=w.buildAIState2Md();
check('exports: state 1 carries a fenced challenge prompt per staged decision',md1.indexOf('AI State Export 1')>=0&&md1.indexOf('You are a Decision Challenger')>=0&&md1.indexOf('QUESTION ASKED: "')>=0&&(md1.match(/\n## /g)||[]).length>=1);
check('exports: state 2 carries the exact live profile prompt',md2.indexOf('AI State Export 2')>=0&&md2.indexOf(w.buildProfilePrompt())>=0&&md2.indexOf('DECIDED DECISIONS: ')>=0);
w.toggleNavMore();await sl(60);
check('exports: the More menu carries both entries (relocated per ruling, July 14)',!!d.querySelector('.nav-more-item[onclick="closeNavMore();exportAIState1()"]')&&!!d.querySelector('.nav-more-item[onclick="closeNavMore();exportAIState2()"]'));
w.closeNavMore();await sl(60);
/* ── written profile round: gate, grounded prompt, in-board states (Paul's rulings, July 14) ── */
check('profile: gate is one decided file, prompt grounded, full text, tokens raised',(function(){const a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');const gs=a.indexOf('function buildProfilePrompt(');const gp=a.slice(gs,a.indexOf('SELF-ASSESSMENT',gs));return a.indexOf('function decidedCount()')>=0&&gp.indexOf('decidedCount()<1')>=0&&gp.indexOf('data.decisions.length<2')===-1&&gp.indexOf('.substring(0,150)')===-1&&gp.indexOf('.substring(0,200)')===-1&&gp.indexOf('max_tokens:3000')>=0&&a.indexOf('max_tokens:1500')===-1&&gp.indexOf('decision-training module in NextChapter')>=0&&gp.indexOf('roughly 400-600 words')>=0&&gp.indexOf('These are the questions they answered in each decision:')>=0})()); /* retargeted Aug 27 2026, Judgment rename (Rev-C); superseded pin: 'judgment-training module in NextChapter' */
w.go('dashboard');await sl(80);
var dshP=d.getElementById('boardShell').innerHTML;
check('profile: seeded state shows bottom-center button, caption, precision line',dshP.indexOf('id="profileBtn"')>=0&&dshP.indexOf('BASED ON ')>=0&&dshP.indexOf('Your profile sharpens with every decision you add')>=0);
var _decP=w.data.decisions,_profP=w.data.profile;
w.data.profile=null;w.go('dashboard');await sl(80);
check('profile: eligible-but-empty state renders the generate button in the box',d.getElementById('boardShell').innerHTML.indexOf('GENERATE DECISION PROFILE')>=0);
w.data.decisions=_decP.map(function(dd){var nf={};for(var k1 in (dd.flow||{}))nf[k1]=dd.flow[k1];nf.finalCall='';var nd={};for(var k2 in dd)nd[k2]=dd[k2];nd.flow=nf;nd.resolved=false;return nd});
w.go('dashboard');await sl(80);
check('profile: ineligible state renders the gate message',d.getElementById('boardShell').innerHTML.indexOf('Reach your final call on at least one decision')>=0);
w.data.decisions=_decP;w.data.profile=_profP;
w.profileGenerating=true;w.go('dashboard');await sl(80);
check('profile: in-flight state renders Analyzing in the box',d.getElementById('boardShell').innerHTML.indexOf('Analyzing your decisions')>=0);
w.profileGenerating=false;w.go('dashboard');await sl(80);
/* ── WHY WE ASK copy correction (Paul's ruling, July 13) ── */
check('copy: WHY WE ASK states the why at both tiers, false Challenge claim gone',html.indexOf("'Understanding your decision|style is the starting point|for recognizing patterns in|your own thinking.'")>=0&&html.indexOf("'Understanding your decision style is the starting point for recognizing patterns in your own thinking.'")>=0&&html.indexOf('tune the Challenge')===-1&&html.indexOf('says you drift')===-1&&html.indexOf('pushes hardest')===-1);
var _svA=w.data.assessment;w.data.assessment={};w.go('assess');await sl(80);
check('copy: corrected card renders on the live intake',d.getElementById('boardShell').innerHTML.indexOf('Understanding your decision')>=0);
w.data.assessment=_svA;
/* ── challenge context: label + question + answer (Paul's ruling, July 13) ── */
check('challenge prompt: exhibits carry the actual question wording',(function(){var pr=w.buildChallengePrompt(w.data.decisions[0]);var a=(w.data.decisions[0].flow.friendTest||'').slice(0,40);return pr.ctx.indexOf('FRIEND TEST\nQUESTION ASKED: "If a friend brought you this exact situation')>=0&&pr.ctx.indexOf('THEIR ANSWER: "'+a)>=0&&pr.ctx.indexOf('QUESTION ASKED: "What are you deciding about?')>=0&&pr.ctx.indexOf('NOTE: Case-for is approximately ')>=0&&pr.sys.indexOf('You are a Decision Challenger')>=0&&pr.sys.indexOf('deliver ONE sharp, specific challenge')>=0})());
check('copy: bias-check carousel carries all four ruled links, new-tab',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');
return ['https://en.wikipedia.org/wiki/Confirmation_bias','https://en.wikipedia.org/wiki/Sunk_cost#Fallacy_effect','https://en.wikipedia.org/wiki/Anchoring_effect','https://en.wikipedia.org/wiki/List_of_cognitive_biases'].every(function(u){var i=a.indexOf(u);return i>=0&&a.slice(i,i+220).indexOf('target="_blank" rel="noopener"')>=0})})());
check('profile prompt: undecided files excluded (gating ruling, July 14)',(function(){var keep=w.data.decisions;
w.data.decisions=[{id:91,title:'DecidedFixture',category:'Work',flow:{finalCall:'Do it'}},{id:92,title:'EarlyPhaseFixture',category:'Work',flow:{leaning:'maybe'}}];
var pr=w.buildProfilePrompt();w.data.decisions=keep;
return pr.indexOf('DECIDED DECISIONS: 1')>=0&&pr.indexOf('DecidedFixture')>=0&&pr.indexOf('EarlyPhaseFixture')===-1})());
check('copy: July 14 digest slot-back applied with residue zero',(function(){var a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');var hh=fs.readFileSync(path.join(BASE,PFX+'home.html'),'utf8');var tl=fs.readFileSync(path.join(BASE,PFX+'templates-local.js'),'utf8');
var present=['both active and resolved','What is your final call?','A useful list is available <a href=','Dashboard, where your','Choose the approach that is closer'].every(function(t){return a.indexOf(t)>=0});
var gone=['(Q2)','(Q3)','defaulting to comfort.','framed too narrowly','swayed by committee. ','depth is where the insight lives','salary, equity, title'].every(function(t){return a.indexOf(t)===-1});
var home=['Curated feed of articles, podcasts, and other materials','research underlying the app\u2019s approach','State the decision question, your leaning'].every(function(t){return hh.indexOf(t)>=0&&tl.indexOf(t)>=0}); /* fragment refreshed with the July 28 copy register (item 2) */ /* retargeted Aug 27 2026, Judgment rename (Rev-C); superseded pin: 'research underlying the Lab\u2019s approach' */
return present&&gone&&home})());
check('challenge prompt: question lookup is live from SECTIONS (no duplicated copy)',(function(){const a=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');return a.indexOf('function qText(key){for(var sk in SECTIONS)')>=0&&a.indexOf('QUESTION ASKED: "')>=0})());
w.go('home');await sl(80);w.openModal('help');await sl(80);
check('set: modal renders over a mounted screen',w.currentModal==='help'&&d.getElementById('app').innerHTML.indexOf('modal-bg')>=0);
w.currentModal=null;w.render();await sl(60);
}
}catch(e){console.error('P4 exception',e);F++;bad.push('phase4-exception')}
}

/* ── Phase 5 — QA sweep 1 fix pins (ruled July 29, 2026). Extend-never-prune:
   F-1 remember-me boot (notesOpen declaration), F-3 seed rev continuity,
   R-DL-8 reset rev continuity, F-4 option C buffered retake (R-DL-9),
   F-5 hero nav-h calc at 960px, F-6 resolvedAt stamped at seal. ── */
async function phase5(){
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const store=()=>JSON.parse(w.localStorage.getItem('dl-data::smoke'));
try{
const appSrc=fs.readFileSync(path.join(BASE,PFX+'app.js'),'utf8');
check('fix F-1: notesOpen declared once at module level',(appSrc.match(/var notesOpen=false;/g)||[]).length===1);
/* F-1 behavioral: a remember-me boot skips renderEntry — it must land signed-in with no error card */
await (async function(){
const seedAccounts=w.localStorage.getItem('dl-accounts'),seedData=w.localStorage.getItem('dl-data::smoke'),seedRev=w.localStorage.getItem('dl-rev::smoke');
const dom2=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:false,
beforeParse(w2){Object.defineProperty(w2,'innerWidth',{value:1500,configurable:true,writable:true});
w2.requestAnimationFrame=cb=>setTimeout(cb,0);w2.cancelAnimationFrame=clearTimeout;
w2.scrollTo=()=>{};w2.matchMedia=q=>({matches:false,addListener(){},removeListener(){}});
w2.fetch=(url,opts)=>{if(BASE&&typeof url==='string'&&/\.html(\?|$)/.test(url)){try{const t=fs.readFileSync(path.join(BASE,url.split('?')[0]),'utf8');return Promise.resolve({ok:true,text:()=>Promise.resolve(t)})}catch(e){return Promise.resolve({ok:false,status:404,text:()=>Promise.resolve('')})}}return Promise.resolve({json:()=>Promise.resolve({content:[{text:'STUB CHALLENGE'}]})})};
w2.HTMLMediaElement.prototype.load=()=>{};w2.HTMLMediaElement.prototype.play=()=>Promise.resolve();
try{w2.localStorage.setItem('dl-accounts',seedAccounts);w2.localStorage.setItem('dl-data::smoke',seedData);w2.localStorage.setItem('dl-rev::smoke',seedRev);w2.localStorage.setItem('dl-remember',JSON.stringify({username:'smoke'}));}catch(e){}
}});
await sl(300);
const d2=dom2.window.document,app2=d2.getElementById('app');
const gate2=!!d2.getElementById('entryUser');
const err2=app2.innerHTML.indexOf('Render Error')>=0||app2.innerHTML.indexOf('Init Error')>=0;
const ok2=dom2.window.authSignedIn===true&&app2.innerHTML.length>500;
const data2=!!(dom2.window.data&&dom2.window.data.decisions&&dom2.window.data.decisions.length===JSON.parse(seedData).decisions.length);
check('fix F-1: remember-me boot lands signed-in — no entry gate, no error card, data intact',ok2&&!gate2&&!err2&&data2);
try{dom2.window.close()}catch(e){}
})();
/* F-3: reseed preserves the monotonic rev */
w.confirm=function(){return true};
(function(){var r0=w.data.rev;w.seedSampleData();
check('fix F-3: reseed preserves the monotonic rev (r+1, mirror follows, ten decisions)',w.data.rev===r0+1&&w.localStorage.getItem('dl-rev::smoke')===String(w.data.rev)&&w.data.decisions.length===10);
})();
/* R-DL-8: deliberate reset preserves the monotonic rev */
(function(){var r1=w.data.rev;
try{Object.defineProperty(w.location,'reload',{value:function(){},configurable:true})}catch(e){}
try{w.resetAllData()}catch(e){/* jsdom navigation stub — the write lands before reload */}
var rec=store();
check('fix R-DL-8: deliberate reset preserves the monotonic rev (r+1, record empty)',rec.rev===r1+1&&w.localStorage.getItem('dl-rev::smoke')===String(rec.rev)&&Array.isArray(rec.decisions)&&rec.decisions.length===0);
w.data=rec;w.seedSampleData(); /* restore a seeded record for the pins below */
})();
/* F-4 option C: buffered retake — nothing persists until the tenth answer */
w.go('assess');await sl(90);
var s0=JSON.stringify(store().assessment),h0=(store().assessmentHistory||[]).length,r2=w.data.rev,c0=store().assessment.completedAt;
var rt=d.getElementById('assessRetake');
check('fix F-4/C: diagnostics on screen offer the retake control',!!rt);
clk(rt);await sl(60);
check('fix F-4/C: retake click is side-effect-free (buffer live, record untouched, no write)',!!w.assessRetakeBuf&&JSON.stringify(store().assessment)===s0&&w.data.rev===r2);
for(var qi=0;qi<9;qi++){var opt=d.getElementById('aopt-'+qi+'-0')||d.querySelector('[id^="aopt-'+qi+'-"]');clk(opt);await sl(25)}
check('fix F-4/C: nine answers in — persisted assessment byte-identical, rev unmoved, buffer still live',JSON.stringify(store().assessment)===s0&&w.data.rev===r2&&!!w.assessRetakeBuf);
var opt9=d.getElementById('aopt-9-0')||d.querySelector('[id^="aopt-9-"]');clk(opt9);await sl(80);
var recA=store();
check('fix F-4/C: tenth answer commits atomically — new completedAt, history +1, buffer cleared, exactly one write',recA.assessment.completedAt!==c0&&(recA.assessmentHistory||[]).length===h0+1&&w.assessRetakeBuf===null&&w.data.rev===r2+1);
check('fix F-4/C: committed scores equal the engine run on the committed answers',JSON.stringify(recA.assessment.scores)===JSON.stringify(w.computeAssessScores(recA.assessment.answers)));
check('fix F-4/C: diagnostics return after the commit',!!d.getElementById('assessRetake'));
/* F-5: the 960px hero override re-uses the nav-h calc */
check('fix F-5: 960px hero override uses the nav-h calc (hardcoded 100px top gone)',(function(){var css=fs.readFileSync(path.join(BASE,PFX+'styles.css'),'utf8');return (css.match(/\.hero-left,\.hero-right\{padding:calc\(var\(--nav-h,100px\) \+ 34px\) 24px 48px\}/g)||[]).length===1})());
/* F-6: sealing stamps resolvedAt (source + behavior via demo07: fields full, debrief unstamped) */
check('fix F-6: seal path stamps resolvedAt (source pin)',appSrc.indexOf('bdD.resolvedAt=Date.now()')>=0);
w.go('detail','demo07');await sl(70);
var d7=null;for(var di=0;di<w.data.decisions.length;di++)if(w.data.decisions[di].id==='demo07')d7=w.data.decisions[di];
d7.flow.debriefKnow='Sealed under test.';d7.flow.debriefSurprise='Sealed under test.';d7.flow.debriefNextTime='Sealed under test.'; /* seed ships debriefs empty; the seal gate requires them filled */
w.saveData();
w.tryOpen('debrief');await sl(50);
var d7pre=store().decisions.filter(function(x){return x.id==='demo07'})[0];
w.bdMarkComplete();await sl(90);
var d7post=store().decisions.filter(function(x){return x.id==='demo07'})[0];
check('fix F-6: filling and sealing the debrief stamps resolved + numeric resolvedAt',d7pre.resolved===false&&d7pre.resolvedAt===null&&d7post.resolved===true&&typeof d7post.resolvedAt==='number'&&d7post.resolvedAt>0);
/* Entry chrome: the top bar is signed-in chrome only (ruled July 29, post-R1) */
check('entry chrome: source carries both sides of the nav toggle',appSrc.indexOf("if(nv)nv.style.display='none'")>=0&&appSrc.indexOf("if(__nv)__nv.style.display=''")>=0);
w.signOut();await sl(90);
var nvEl=d.querySelector('nav');
check('entry chrome: signing out hides the top bar with the gate up',!!nvEl&&nvEl.style.display==='none'&&!!d.getElementById('entryUser'));
w.gotoSetup();await sl(40);
d.getElementById('entryName').value='Nav Pin';d.getElementById('entryUser').value='navpin';d.getElementById('entryEmail').value='navpin@test.local';d.getElementById('entryPin').value='1234';
w.doEntry();await sl(120);
check('entry chrome: sign-in restores the top bar',nvEl.style.display==='');
/* Slab v4 + history controls (ruled July 29) */
w.go('assess');await sl(150);
var shellA=d.getElementById('boardShell').innerHTML;
check('v4: assess slab defaults to zero compare threads (opt-in)',shellA.indexOf(w.V.gthreads[0])===-1&&shellA.indexOf(w.V.gthreads[1])===-1);
check('v4: compare legend offers each prior sitting once',d.querySelectorAll('[id^="aghost-"]').length===Math.max(0,Math.min(3,(w.data.assessmentHistory||[]).length-1)));
clk(d.querySelector('[id^="aghost-"]'));await sl(90);
check('v4: checking a compare box paints its slot-colored thread',d.getElementById('boardShell').innerHTML.indexOf(w.V.gthreads[0])>=0);
clk(d.querySelector('[id^="aghost-"]'));await sl(90);
check('v4: unchecking removes the thread',d.getElementById('boardShell').innerHTML.indexOf(w.V.gthreads[0])===-1);
var histLen0=(w.data.assessmentHistory||[]).length;
clk(d.getElementById('ahist-0'));await sl(90);
check('history: SHOWING NOW follows the viewed sitting and the latest row offers VIEW back',d.getElementById('boardShell').innerHTML.indexOf('SHOWING NOW')>=0&&!!d.getElementById('ahist-latest'));
check('history: DELETE offered on every past sitting, never on the latest',d.querySelectorAll('[id^="adel-"]').length===histLen0-1&&!d.getElementById('adel-'+(histLen0-1)));
clk(d.getElementById('ahist-latest'));await sl(90);
check('history: VIEW on the latest returns to the current result',w.assessHistIdx===null);
clk(d.getElementById('adel-0'));await sl(110);
check('history: delete removes the sitting and persists through the store',(function(){var rec=JSON.parse(w.localStorage.getItem('dl-data::navpin')||'{}');return (w.data.assessmentHistory||[]).length===histLen0-1&&(rec.assessmentHistory||[]).length===histLen0-1})()); /* reads the navpin key: this block runs as the nav-pin user, not the phase-1 store() user */
/* Identity chip (ER conformance, ruled July 29) */
check('chip: luminance avatar with initials + first name for the signed-in account',(function(){var c=d.querySelector('.nav-user-chip');return !!c&&c.innerHTML.indexOf('NP')>=0&&c.textContent.indexOf('Nav')>=0&&c.getAttribute('title')==='Click to sign out'})());
clk(d.querySelector('.nav-user-chip'));await sl(100);
check('chip: clicking signs out behind the enterprise confirm \u2014 gate up, top bar hidden',!!d.getElementById('entryUser')&&d.querySelector('nav').style.display==='none');
check('chip: name display truncates at 12ch with ellipsis (ruled July 29); tooltip carries the full name',fs.readFileSync(path.join(BASE,PFX+'styles.css'),'utf8').indexOf('max-width:12ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')>=0);
/* SUPERSEDED July 29 (same-day): the fixed 480 tier left the 480\u2013960 range unshrunk and still clipping. The shrink is now fluid across the whole sub-960 range. */
check('fluid chrome: continuous clamp() sizing below 960 \u2014 tabs shrinkable, actions wrap-safe, chip viewport-bounded (ruled July 29)',(function(){var c=fs.readFileSync(path.join(BASE,PFX+'styles.css'),'utf8');return c.indexOf('.nav-tab{font-size:clamp(9px,2vw,14px)')>=0&&c.indexOf('.btn-ghost.nav-action{font-size:clamp(8.5px,1.7vw,10.5px)')>=0&&c.indexOf('.nav-tabs{overflow-x:auto;flex-shrink:1;min-width:0;max-width:100%}')>=0&&c.indexOf('.nav-user-name{max-width:min(12ch,16vw)}')>=0&&c.indexOf('#navRight{flex-wrap:wrap;max-width:100%}')>=0})());
}catch(e){console.error('P5 exception',e);F++;bad.push('phase5-exception')}
}
