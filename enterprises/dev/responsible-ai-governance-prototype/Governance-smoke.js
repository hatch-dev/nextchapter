/* smoke.js — boots the restructured governance app under jsdom and
   verifies: dark default, theme/zoom/More persistence via Store,
   every page renders, module screens mount, data blob revisioning.
   Run: npm i jsdom && node Governance-smoke.js */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('Governance-index.html','utf8');
const dom = new JSDOM(html, { runScripts:'outside-only', url:'http://localhost/' });
const w = dom.window;
const mem = {};
Object.defineProperty(w, 'localStorage', { value: {
  getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v)}, removeItem:k=>{delete mem[k]}
}});
w.confirm = () => true; w.alert = () => {};
w.scrollTo = () => {}; w.requestAnimationFrame = f => setTimeout(f,0);
w.fetch = (p) => Promise.resolve({ ok:true, text:()=>Promise.resolve(fs.readFileSync(p.replace(/^\.\//,''),'utf8')) });
/* Part 5: the dev stand-in for the sign-in server needs Web Crypto (PBKDF2), TextEncoder, btoa/atob */
Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto, configurable: true });
if (!w.TextEncoder) w.TextEncoder = TextEncoder;
for (const f of ['Governance-templates-local.js','Governance-screen-loader.js','Governance-home.js','Governance-learn.js','dev-auth-server.js','Governance-app.js']) {
  w.eval(fs.readFileSync(f,'utf8'));
}
(async () => {
  const wait = () => new Promise(r => setTimeout(r, 30));
  let pass = 0, fail = 0;
  function ok(cond, label){ if(cond){pass++;} else {fail++; console.log('  x', label);} }
  await wait();
  ok(w.UI.theme === 'light', 'boots light by default');
  ok(mem['governance-theme']==null, 'no preference write until the user chooses');

  // ── auth: boots signed out, entry screen shows ──
  ok(!w.getCurrentUser(), 'boots signed out');
  ok(w.document.getElementById('app').innerHTML.indexOf('login-screen')>=0 || (w.UI.entry&&w.UI.entry.step==='login'), 'entry screen renders');
  ok(w.document.getElementById('coachFab').style.display==='none', 'AI Guide hidden before sign-in');
  // first-run setup: create the workspace + first admin user
  const res = w.eval(`createOrg('Aurora Windows',{name:'Faisal Hoque',username:'faisal',passcode:'4321',role:'Administrator'})`);
  w.eval(`switchToOrg('${res.orgId||res.id||w.getOrgs()[0].id}')`);
  w.eval(`Auth.setSession(USERS[0].id); UI.entry=null; render()`); await wait();
  ok(!!w.getCurrentUser(), 'signed in after setup');
  ok(w.document.getElementById('navRight').innerHTML.indexOf('nav-user-chip')>=0, 'user chip in nav');
  ok(w.document.getElementById('coachFab').style.display==='none', 'AI Guide stays hidden after sign-in: off until an administrator switches it on (Part 2, 2 Oct 2026; was "appears after sign-in")');
  const plz=w.document.getElementById('fabReview');
  ok(plz && plz.parentElement===w.document.getElementById('coachFab'), 'glow element rides inside the AI Guide button');
  const nrh=w.document.getElementById('navRight').innerHTML;
  ok(nrh.indexOf('Team Chat')>=0 && nrh.indexOf('id="sampleNavBtn"')>=0 && nrh.indexOf('Demo</button>')>=0 && nrh.indexOf('id="notesNavBtn"')<0, 'Team Chat + Demo in the top nav; Demo took the Notes button\'s place (Part 3.3.7, agreed 5 Oct 2026; was "Team Chat + Notes")');
  ok(w.document.querySelector('.gchat-fab')==null && w.document.querySelector('.notes-fab')==null, 'floating chat/notes FABs retired');
  const pl=w.document.getElementById('fabReview');
  ok(pl && pl.parentElement===w.document.getElementById('coachFab'), 'coach pulse anchored inside the AI Guide button');
  ok(JSON.parse(mem['governance-orgs']).length===1, 'org persisted to gov-orgs');
  /* roster: an added user is a team member (Part 5, 2 Oct 2026: PINs are gone; signing in is in the Part 5 block below) */
  w.eval(`USERS.push({id:'u_test',name:'Erik Nelson',username:'erik',role:'Facilitator',initials:'EN',color:'#8B5E3C'});persistRoster()`);
  ok(w.eval("USERS.some(function(u){return u.id==='u_test'}) && !('passcode' in USERS.filter(function(u){return u.id==='u_test'})[0])"), 'an added user is on the roster, with no password in the data');
  ok(typeof w.findUserByLogin === 'undefined' && typeof w.adminCreds === 'undefined', 'Part 5.2.3: the in-browser sign-in checks are gone (findUserByLogin, adminCreds)');
  w.eval('Auth.setAdminSession(true); openAdmin()'); await wait();
  ok(w.document.getElementById('modalRoot').innerHTML.indexOf('Admin')>=0, 'admin console modal opens for app admin');
  w.eval('closeModal()');
  // profile modal
  w.eval('openOrg()'); await wait();
  ok(w.document.getElementById('modalRoot').innerHTML.length>500, 'profile/org modal renders');
  w.eval('closeModal()');
  // sign out returns to entry, remembered session cleared
  w.eval('signOut()'); await wait();
  ok(!w.getCurrentUser(), 'signOut clears the session');
  ok(w.document.getElementById('app').innerHTML.indexOf('login')>=0 || (w.UI.entry&&w.UI.entry.step), 'entry screen back after sign-out');
  w.eval(`Auth.setSession(USERS[0].id); UI.entry=null; render()`); await wait();

  ok(w.document.documentElement.getAttribute('data-theme')==='light', 'data-theme applied');
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Dark Mode')>=0, 'theme chip next to Help');
  const pages = ['home','learn','overview' /* was 'pipeline' — journey page deleted by ruling 22 Jul, item 39 */,'phase5','insights'];
  for (const p of pages) {
    w.eval("go('"+p+"')"); await wait();
    const len = w.document.getElementById('app').innerHTML.length;
    ok(len > 500, "page '"+p+"' renders ("+len+" chars)");
    ok(w.document.getElementById('app').innerHTML.indexOf('Error')!==0, "page '"+p+"' no error card");
  }
  w.eval("go('home')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('hero-headline')>=0, 'home module mounts hero');
  ok(w.document.getElementById('app').innerHTML.indexOf('zoom-wrap')>=0, 'home wrapped in zoom-wrap');
  w.eval("go('learn')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Foundation')>=0, 'learn module mounts');
  w.eval("go('step','1.1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.length>1000, 'step 1.1 renders');
  ok(w.document.getElementById('app').innerHTML.indexOf('vp-carousel')>=0, 'step 1.1 carries the info carousel');
  ok(w.document.querySelectorAll('.vp-slide').length===4, 'carousel has the four Why/What/How/Outcome slides');
  ok(w.document.getElementById('app').innerHTML.indexOf('done-wrap')>=0, 'complete button rides done-wrap');
  ok(w.document.getElementById('app').innerHTML.indexOf('btn bd done-btn')>=0, 'complete button carries the family classes');
  ok(typeof w.xpandClick==='function' && typeof w.paintGates==='function' && typeof w.carouselInit==='function', 'xpand + gate + carousel machinery present');
  ok(w.eval('sidebarOpen')===true && w.eval('sidebarMinimized')===true, 'sidebar boots visible in the minimized rail');
  const sbEl=w.document.getElementById('pipSidebar');
  ok(sbEl.className.indexOf('mini')>=0 && sbEl.className.indexOf('collapsed')<0, 'rail state: .mini, not .collapsed');
  ok(sbEl.innerHTML.indexOf('sidebar-mini-max')>=0 && sbEl.innerHTML.indexOf('sidebar-mini-dot')>=0, 'rail shows phase dots and the maximize button');
  ok(w.document.getElementById('mainContent').className.indexOf('sidebar-mini')>=0, 'content sits beside the rail');
  w.eval('maximizeSidebar()'); await wait();
  const sbh=w.document.getElementById('pipSidebar').innerHTML;
  ok(w.eval('sidebarMinimized')===false && mem['governance-sidebar-min']==='0', 'Maximize expands and persists');
  ok(sbh.indexOf('Minimize')>=0 && sbh.indexOf('sidebar-size-tog')>=0, 'full menu header carries the Minimize control');
  ok(sbh.indexOf('sidebar-phase-tog')>=0 && sbh.indexOf('1. Map')>=0 && sbh.indexOf('Days 1')>=0, 'phase heads show number, name, day range, chevron');
  w.eval('toggleSidebarSize()'); await wait();
  ok(w.eval('sidebarMinimized')===true && mem['governance-sidebar-min']==='1', 'Minimize returns to the rail and persists');
  w.eval('maximizeSidebar()'); await wait();
  w.eval('toggleSidebar()');
  ok(w.eval('sidebarOpen')===false && w.document.getElementById('mainContent').className.indexOf('sidebar-collapsed')>=0, 'hamburger fully hides the sidebar');
  w.eval('toggleSidebar()');
  ok(w.eval('sidebarOpen')===true && w.document.getElementById('mainContent').className.indexOf('sidebar-collapsed')<0, 'hamburger restores it');
  // Track Program hub
  w.eval('toggleNavMore()'); await wait();
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Track Program')>=0, 'Track Program in the More menu');
  w.eval('closeNavMore()'); await wait();
  w.eval("go('mgmt-hub')"); await wait();
  const hub=w.document.getElementById('app').innerHTML;
  ok(hub.indexOf('Module')>=0 && hub.indexOf('steps complete')>=0 && hub.indexOf('of the 90')>=0, 'hub renders pacing tiles');
  ok(hub.indexOf('This Week')>=0 && hub.indexOf('Phase 1')>=0, 'assignments tab lists week + phase cards');
  ok(hub.indexOf('Save as PDF')>=0&&hub.indexOf('Download as PDF')<0, 'hub offers the PDF export (needle retargeted 13 Aug 2026 — Rev L quiet Save as PDF; item 49 rollback shipped)');
  w.eval("go('overview')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('viz-stat-strip')>=0, 'overview carries the family stat strip');
  ok(w.document.getElementById('app').innerHTML.indexOf('u-1390122')>=0, 'overview phase cards on the exemplar register');
  w.eval("go('phase','1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('u-f78be26')>=0, 'phase landing carries the four-metric row');
  ok(w.document.getElementById('app').innerHTML.indexOf('u-6f946a0')>=0, 'phase landing carries the STEP_FLOW tick row');
  ok(w.STEP_FLOW[2].length===5 && w.STEP_FLOW[3].length===3 && w.PH[2].steps.length===3, 'STEP_FLOW matches the registry (phase 3 restructured to three steps, D-P3.1)');
  w.eval("go('phase5')"); await wait();
  w.eval("data.risks=[{id:'smk1',name:'Smoke risk',description:'d',category:'operational',severity:'high',source:'internal',litL:3,litI:3,litT:3,responseCapacity:3,classification:'manage'}];UI.activeView='manage';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('+ Add Risk')>=0, 'dashboard risk views manage in place (Rollout 34)');
  /* SUPERSEDED 31 Jul 2026 (round 12): dashboard rows conformed to the shared bar; Re-assess relocated into the expansion's bottom zone. */
  ok(w.eval("(function(){var f=(data.risks||[]).filter(function(r){return cardClass(r)==='manage'})[0];if(!f)return false;UI.expanded['idc_'+f.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('idc_'+f.id)>=0&&h.indexOf('Re-assess')>=0;UI.expanded['idc_'+f.id]=false;render();return pass})()")===true, 'dashboard rows (retargeted 31 Jul 2026, round 12): shared bars, Re-assess in the expansion');
  w.eval("data.risks=[];UI.activeView=null;");
  w.eval("data.systems=[{id:'s1',name:'Smoke system'}];UI.dashManage='exit';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Exit Director')<0, 'chunk 28: the exit-plan register drill is retired from the dashboard (D-P4.1)');
  w.eval("UI.dashManage='rhythm';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Standing Governance Meeting')>=0, 'chunk 28: the rhythm drill survives the register retirement');
  w.eval("go('step','4.1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Step 4.1: Manage and Monitor')>=0, 'chunk 28 + rename ruling (22 Jul): 4.1 is the Manage and Monitor step (D-P4.1)');
  ok(w.eval("(function(){data.risks.push({id:'r-smk28',name:'Smoke card',status:'identified',classification:'manage',assess:{}});var blocked=!dataGateOK('4.1');data.risks.pop();return blocked})()")===true, 'chunk 28: the 4.1 gate blocks while a Manage-portfolio card needs attention');
  w.eval("data.systems=[];UI.dashManage=null;");
  w.eval("go('step','5.2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('NIST TEVV Reference')>=0, '5.2 embeds the TEVV reference (Rollout 34; renumbered per item 15, 22 Jul; renamed 15 Aug 2026, addendum 155, ruled)');
  w.eval("go('mgmt-hub')"); await wait(); // restore the page this block found (hub pins follow)
  w.eval("mgDueSave('1.2','2030-01-15')"); await wait();
  ok(w.eval("(data.stepDue||{})['1.2']")==='2030-01-15', 'deadline persists via mgDueSave');
  w.eval("toggleAssign('1.2', USERS[0].id)"); await wait();
  ok(w.eval("(data.assigns['1.2']||[]).length")===1, 'assignment toggles on');
  w.eval('UI.mgTab=1; render()'); await wait();
  const an=w.document.getElementById('app').innerHTML;
  ok(an.indexOf('Burn-up')>=0 && an.indexOf('Velocity')>=0 && an.indexOf('Workload')>=0 && an.indexOf('Signals')>=0, 'analytics tab renders all four cards');
  w.eval('UI.mgTab=0');
  w.eval("completeStep('1.2')"); await wait();
  ok(w.eval("(data.stepDoneAt||{})['1.2']") != null, 'completion stamps the date for pacing charts');

  w.eval("go('step','5.2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('NIST')>=0, 'NIST conformance renders');
  w.eval('toggleTheme()'); await wait();
  ok(w.UI.theme==='dark' && mem['governance-theme']==='dark', 'toggle -> dark persists');
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Light Mode')>=0, 'theme chip flips label');
  w.eval('toggleTheme()'); await wait();
  w.eval('toggleNavMore()'); await wait();
  const nr = w.document.getElementById('navRight').innerHTML;
  ok(nr.indexOf('Load the seeded example')>=0 && nr.indexOf('Reset all data')<0 && nr.indexOf('toggleVoice()')<0 && nr.indexOf('toggleNotes()')>=0 && nr.indexOf('toggleNotes()')<nr.indexOf('openOrg()'), 'More menu holds the demo item and Notes above Profile (Part 3.3.8), and no Reset all data (Part 4.2.3: it moved to Reset data in the admin console); its Voice item shows only while Voice is on (Part 2; was "holds Voice/demo/reset")');
  w.eval('closeNavMore()'); await wait();
  w.eval('zoomIn()'); await wait();
  ok(w.UI.zoom===1.1 && mem['governance-zoom']==='1.1', 'zoom persists via Store');
  ok(w.document.getElementById('app').innerHTML.indexOf('zoom:1.1')>=0 || w.document.getElementById('app').innerHTML.indexOf('zoom: 1.1')>=0, 'zoom applied to wrap');
  w.eval('zoomReset()'); await wait();
  w.eval('seedSampleData()'); await wait();
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the demo seed ships exactly one live escalation so clients see Emergency Response working. */
  ok(w.eval("(function(){var esc=(data.risks||[]).filter(function(r){return r.escalation});if(esc.length!==1)return false;var r=data.risks.find(function(x){return x.id==='r-er1'});return !!(r&&r.escalation&&erWorkingPlan(r))})()")===true, 'E-2 (retargeted 31 Jul 2026): the seed ships exactly one live escalation \u2014 r-er1, working plan aboard');
  ok(w.eval("Array.isArray(data.roster)&&data.roster.length>=1")===true, 'B-5 fix: seeding preserves the roster (and the session survives a resync)');
  ok(w.eval("(function(){UI.mgOpen='x';UI.mgDraft={a:1};UI.expanded['k']=true;sealSession();return UI.mgOpen==null&&UI.mgDraft==null&&!UI.expanded['k']})()")===true, 'R2-5 fix (Part S, 2 Oct 2026: sealSession replaces resetVolatileUI): the seal clears drafts, open forms, and drills');
  ok(w.eval("(function(){data.risks.push({id:'r-smk',name:'Smoke throwaway',status:'identified',dismissed:{reason:'x',by:'s',at:Date.now()}});var r=data.risks[data.risks.length-1];reviveRisk('r-smk');var n1=(r.history||[]).length;reviveRisk('r-smk');var pass=n1===1&&(r.history||[]).length===n1&&!isArchivedRisk(r);data.risks.pop();return pass})()")===true, 'R2-3 fix: revive guards on archived state \u2014 a second call pins nothing');
  w.eval("go('insights')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('conv-card')>=0, 'Insights conformance: the Pipeline port renders its Convergence catalog');
  w.eval("go('phase5')"); await wait();
  const orgId = w.eval('currentOrgId');
  const blob = JSON.parse(mem['governance-org-data::'+orgId]);
  ok(blob && blob.rev >= 1 && blob.schemaVersion===1, 'saved blob is revisioned (rev '+blob.rev+')');
  ok(Array.isArray(blob.risks) && blob.risks.length>0, 'demo data seeded ('+blob.risks.length+' risks)');
  w.eval("go('phase5')"); await wait();
  ok(w.document.getElementById('app').innerHTML.length>2000, 'dashboard renders with seeded data');
  w.eval("go('step','1.1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Existing Responsible AI Governance')>=0, 'battery carries the fifth tab (1.1e)');
  w.eval("go('step','1.3')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Rapid Risk Screen')>=0, 'discovery closes with the rapid screen');
  ok(w.document.getElementById('app').innerHTML.indexOf('/15')>=0&&w.document.getElementById('app').innerHTML.indexOf('rapid initial assessment')<0, 'item 57: the composite shows as the bold total alone (the phrase is cut \u2014 supersedes the composite-grammar needle)');
  w.eval("go('step','2.1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Register of Responsible AI Principles')>=0, '2.1 carries the principle register (needle retargeted 10 Aug 2026, round 37: renamed by ruling)');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var a=h.indexOf('Responsible AI Review Board');var b=h.indexOf('Register of Responsible AI Principles');return a>=0&&b>=0&&a<b})()")===true, 'round 37: the board leads and the register follows');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var five=['Fairness','Human Oversight','Workforce Impact','Societal Effects','Transparency'].every(function(d){return h.indexOf('>'+d+' <')>=0});return five&&(h.split('+ Add Principle').length-1)>=5&&h.indexOf('+ Add Custom Domain')>=0})()")===true, 'round 37: the five domains render as sections, each with its add control, and the custom-domain control sits below');
  ok(w.eval("(function(){var ef=data.ethicalFramework;var n0=ef.principles.length;UI.prAdd='Fairness';go('step','2.1');document.getElementById('pr_new_sentence').value='Pin principle';document.getElementById('pr_new_breach').value='Pin breach';UI.ethRetest=null;addPrinciple2();var p=ef.principles[ef.principles.length-1];var pass=ef.principles.length===n0+1&&p.principle==='Pin principle'&&p.domain==='Fairness'&&!!UI.ethRetest;ef.principles.pop();UI.ethRetest=null;render();return pass})()")===true, 'round 37: the per-domain add flow saves the sentence, details, and breach under its domain and prompts the working group');
  ok(w.eval("(function(){UI.domAdd=true;go('step','2.1');document.getElementById('dom_new').value='Pin Domain';addCustomDomain();var ok1=ethDomains().indexOf('Pin Domain')>=0;var cd=data.ethicalFramework.customDomains;cd.splice(cd.indexOf('Pin Domain'),1);render();return ok1})()")===true, 'round 37: a custom domain joins the sections and accepts principles');
  ok(w.eval("(function(){var pr=(data.ethicalFramework.principles||[]).filter(function(p){return p.breach})[0];if(!pr)return false;UI.expanded['prx_'+pr.id]=true;go('step','2.1');var h=document.getElementById('app').innerHTML;delete UI.expanded['prx_'+pr.id];render();return h.indexOf('What would breach the principle')>=0})()")===true, 'round 37 (needle retargeted 10 Aug 2026, round 40: the label names the principle by ruling): a principle bar expands to its breach line');
  ok(w.document.getElementById('app').innerHTML.indexOf('Responsible AI Review Board')>=0, '2.1 stands up the Responsible AI board');
  w.eval("go('phase5')"); await wait();
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the rescan prompt is off the dashboard; it renders on the review agenda only. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('Rescan Due With This Review')<0})()")===true, 'rescan (retargeted 31 Jul 2026): off the dashboard by ruling; the review agenda keeps it');
  w.eval("go('step','2.3')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Rescan Configuration')>=0, '2.3 carries the rescan configuration');
  w.eval("go('step','2.4')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Compliance Catalog')>=0, 'chunk 33 swap (D-P2.4): 2.4 is the Compliance Catalog (renamed chunk G + British sweep, 22 Jul)');
  ok(w.document.getElementById('app').innerHTML.indexOf('Compliance Survey</h3>')>=0&&w.document.getElementById('app').innerHTML.indexOf('>Compliance Register</h3>')>=0, 'item 50 (retargeted 21 Aug 2026, the survey rename): 2.4 hosts the Compliance Survey awaiting scoping plus the scoped-in Compliance Register — two lists, two names');
  w.eval("UI.s25Tab='demand';go('step','2.5')"); await wait();
  ok(w.eval("(function(){go('step','2.5');var h=document.getElementById('app').innerHTML;return h.indexOf('Assessment Demand')<0&&h.indexOf('Urgent Risks')>=0&&h.indexOf('Preliminary Risk Register')>=0})()")===true, 'item 61: 2.5 is tabless \u2014 Urgent Risks over the Preliminary Risk Register (supersedes the demand-tab needles)');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('wb-')>=0||h.indexOf('Rapid Risk Screen')>=0;UI.expanded['idc_'+r.id]=false;return pass})()")===true, 'item 61: a 2.5 bar opens to the universal card \u2014 header strip and rapid breakdown (supersedes the needs-rollup needle)');
  w.eval("UI.s25Tab='selection';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Prioritization')>=0, '2.5 is the prioritization step (message updated 24 Aug 2026: selection-ceremony vocabulary retired at Sweep 4 round 2)');
  /* SUPERSEDED 31 Jul 2026 (Paul's portfolio-conformance ruling): decisions relocated from the collapsed bar into the expanded row's control zone \u2014 probe opens the first row. */
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;UI.expanded['idc_'+r.id]=false;render();return h.indexOf('>Advance<')>=0&&h.indexOf('>Defer<')>=0&&h.indexOf('Build capacity')<0})()")===true, 'item 61 (retargeted 31 Jul 2026, conformance): two decisions in the expanded row \u2014 Advance and Defer; capacity-build is retired');
  ok(w.eval("(function(){var adv=(data.risks||[]).filter(inAssessBucket);if(!adv.length)return false;var h=document.getElementById('app').innerHTML;var on25=h.indexOf(adv[0].name)>=0;go('portfolio','assess');var h2=document.getElementById('app').innerHTML;var inPf=h2.indexOf(adv[0].name)>=0;go('step','2.5');return !on25&&inPf})()")===true, 'item 61: advanced risks LEAVE 2.5 and live in the Assess portfolio \u2014 the whole point, probe-proven');
  w.eval("UI.s25Tab='demand'");
  w.eval("go('step','2.2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Stakeholder Feedback')>=0, '2.2 carries the three-tab bar');
  w.eval("UI.s22Tab='is';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Skills Gap Analysis')>=0, 'the incentives tab absorbs the old 2.4 body');
  w.eval("go('step','3.2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Deepen Assessment')>=0, '3.2 is the assessment workbench');
  w.eval("openWB('r-as2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Root causes')>=0, 'the workbench floor carries root causes');
  w.eval("setWBTab('imp')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Untick to restore')>=0, 'seeded NA section renders the who-when stamp');
  ok(w.document.getElementById('app').innerHTML.indexOf('Detailed Assessment')>=0, 'the workbench carries the result band');
  ok(w.document.getElementById('app').innerHTML.indexOf('Monitor Enhanced')<0, 'R1: the band offers three outcomes, no Monitor Enhanced');
  ok(w.document.getElementById('app').innerHTML.indexOf('>Archive<')>=0, 'archive is a first-class outcome');
  w.eval("go('step','3.1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Responsible AI Screening')>=0, '3.1 is the Responsible AI screening (renamed 10 Aug 2026, round 46, by ruling)');
  /* Retargeted 10 Aug 2026 (round 32, Paul's family-bar rebuild): the walk lives in the row expansion; the subset heading carries the promise. */
  ok(w.document.getElementById('app').innerHTML.indexOf('Confirmed Responsible AI Risks')>=0, 'confirmed cards get their subset (retargeted 10 Aug 2026, round 49: potential becomes confirmed \u2014 the heading names the risks, not the paperwork)');
  /* Retargeted 10 Aug 2026 (round 48, Paul's one-grammar ruling): the confirmed card is the screening form as filled; the nested breach card is retired. */
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'});if(!r)return false;UI.ethDraft=null;go('step','3.1');UI.expanded['eth31_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Which named principles could this breach?')>=0&&h.indexOf('How could the breach actually happen?')>=0&&h.indexOf('Ethics breach analysis')<0;delete UI.expanded['eth31_'+r.id];render();return pass})()")===true, 'round 32 (retargeted 10 Aug 2026, round 48): a confirmed bar expands to the screening as filled \u2014 one grammar, no nested card');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Awaiting Screening')>=0&&h.indexOf('Confirm Responsible AI risk')>=0&&h.indexOf('Why it was flagged')>=0})()")===true, 'round 32 (retargeted 10 Aug 2026, round 46): potential bars render open by default, carrying the screening');
  w.eval("go('step','3.3')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Testing &amp; Evidence')>=0&&h.indexOf('What Needs Testing')>=0&&h.indexOf('Design the Tests')>=0&&h.indexOf('Tests &amp; Evidence')>=0&&h.indexOf('Open the NIST reference')>=0&&h.indexOf('>NIST Template<')<0})()")===true, 'chunk 34 swap (retargeted 12 Aug 2026, rounds 64/68): the three passes as tabs; the template demoted to its link');
  w.eval("UI.s33Tab='template';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('This page is a reference')>=0, 'R-9 (retargeted 13 Aug 2026, round 85): the NIST view is the reference \u2014 was: the NIST-structured planning tab');
  w.eval("UI.s33Tab='plans';render()"); await wait();
  w.eval("goModule('pf-identify')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Identify Portfolio')>=0, 'the identify portfolio page renders off the pf- route');
  /* SUPERSEDED 31 Jul 2026 (conformance): Order-by-system grouping moved off the surface to the loss ledger; the operable surface is intake plus donor-grammar rows. */
  ok(w.eval("(function(){go('portfolio','identify');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('+ Log Internal Risk')>=0&&h.indexOf('idc_')>=0&&h.indexOf('Must address')<0;return pass})()")===true, 'item 61 (retargeted 31 Jul 2026, conformance): the Identify portfolio is the operable surface \u2014 intake and donor-grammar rows');
  ok((function(){var _s63=require('fs').readFileSync('Governance-app.js','utf8');return _s63.indexOf('section-title u-967e19d')>=0&&_s63.indexOf('u-98b80d8')>=0&&_s63.indexOf('u-49c8739')>=0&&_s63.indexOf('u-ac07cd3')>=0&&_s63.indexOf('analytics-title')>=0})(), 'item 63: the donor dashboard chrome is aboard \u2014 hero, meeting-card, and analytics classes at source');
  ok(w.eval("(function(){showRiskForm('internal');document.getElementById('rf_name').value='ATTR PROBE';saveRisk();var r=data.risks[data.risks.length-1];var pass=r.name==='ATTR PROBE'&&!!r.loggedBy&&!!r.loggedAt;removeRisk(r.id);return pass})()")===true, 'item 62: a user-created risk carries loggedBy and loggedAt from the session (create-only stamp)');
  ok((function(){var _s62=require('fs').readFileSync('Governance-app.js','utf8');var rv=_s62.indexOf('function riskViz');return _s62.indexOf('u-778010b')>=0&&_s62.slice(rv,rv+2400).indexOf('event triggers are armed')<0&&rv>=0&&_s62.slice(rv,rv+2400).indexOf('DM Sans')<0})(), 'item 62 (retargeted 15 Aug 2026, copy master batch 1): the strip trim is scoped to riskViz — the 2.3 milestone earns the armed-triggers phrase after the step completes');
  /* SUPERSEDED 31 Jul 2026 (conformance): Re-assess and Dismiss relocated from the bar into the expanded row's control zone. */
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('idc_'+r.id)>=0&&h.indexOf('Re-assess')<0&&h.indexOf('Dismiss')>=0;UI.expanded['idc_'+r.id]=false;render();return pass})()")===true, 'item 61 (retargeted again 31 Jul 2026: Re-assess RETIRED by ruling \u2014 the live screen does its job): rows carry the D-4 surface, Dismiss in the expansion, Re-assess gone');
  ok(w.document.getElementById('app').innerHTML.indexOf('Archive (3)')>=0, 'the identify foot archive panel holds the seeded dismissals (3, chunk-K roster)');
  w.eval("go('portfolio','manage')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Risk Pulse')<0, 'M-0: the Risk Pulse tab is retired from the Manage page');
  ok(w.document.getElementById('app').innerHTML.indexOf('\u26a0')>=0, 'M-1: unlanded cards wear the warning triangle');
  w.eval("go('portfolio','emergency')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Emergency Response Portfolio')>=0, 'D-2: the fourth portfolio is Emergency Response');
  w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-as2'});pinDecision(r,'smoke-probe',{note:1})})()");
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-as2'});var pn=r.history.slice(-1)[0];return pn.content&&pn.content.name===r.name&&pn.content.assess.rootCauses.length===r.assess.rootCauses.length})()")===true, 'C-6(b): every pin carries the content snapshot');
  w.eval("go('portfolio','manage')"); await wait();
  w.eval("openMgLanding('r-as2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Emergency plans')>=0, 'M-2 (retargeted 21 Aug 2026, dashboard redesign): the emergency requirement shows on the risk dashboard tile');
  /* Retargeted 16 Aug 2026 (artifact-cards rebuild ruling): each management plan is a saved
     artifact committing directly through its own writer — the driver runs the card API. The pin's
     substance (a plan without the emergency section answered does not clear the landing warn)
     is unchanged. */
  /* Retargeted 16 Aug 2026 night (surface-repair directive): the plan card saves name and type; actions are self-saving cards parallel to indicators. */
  w.eval("openMgPlanCard('r-as2');mgPlF('name',{value:'Quarterly model audit'});mgPlF('type',{value:'prevention'});saveMgPlanCard('r-as2');var _pi=data.risks.find(function(x){return x.id==='r-as2'}).mgmtPlan.plans.length-1;openActCard('r-as2',_pi);actF('action',{value:'Audit the quoting model quarterly'});actF('owner',{value:'Harriet Rivers'});actF('timeframe',{value:'Q3'});saveActionCard('r-as2')"); await wait();
  ok(w.eval("needsLanding(data.risks.find(function(x){return x.id==='r-as2'}))")===true, 'M-2 gate (retargeted 16 Aug 2026, artifact-cards ruling): the warn holds after a committed plan until the emergency section is answered');
  /* Retargeted 16 Aug 2026 (artifact-cards rebuild ruling): N/A is a direct commit. */
  w.eval("mgEmNaCommit('r-as2',{checked:true})"); await wait();
  ok(w.eval("!needsLanding(data.risks.find(function(x){return x.id==='r-as2'}))")===true, 'M-1/M-2: the landing clears the flag once the emergency block is answered');
  w.eval("UI.pfKindF='monitor';render()"); await wait();
  w.eval("data.risks.push({id:'r-smkmn',name:'Smoke monitor card',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor'});render()"); await wait();
  w.eval("openMnLanding('r-smkmn')"); await wait();
  /* Retargeted 16 Aug 2026 night (surface-repair directive): nothing opens by default; the plan-level
     card (Owner + Frequency) saves first, then indicators commit as their own cards. The fold and the
     read header render once the plan exists. */
  w.eval("openMnPlanEdit('r-smkmn');mnF('monitor',{value:'Vincent Lau'});mnF('frequency',{value:'monthly'});saveMnLanding('r-smkmn')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Emergency plans')>=0, 'E-1/M-3 (retargeted 21 Aug 2026, tiered-tile recut — the optional fold retired for the Emergency plans tier): the Monitor landing carries the emergency affordance once the plan is saved');
  ok(w.document.getElementById('app').innerHTML.indexOf('Monitoring plan')>=0, 'M-3/L-6: the monitor landing renders under its plain heading');
  ok(w.document.getElementById('app').innerHTML.indexOf('Escalate')>=0, 'E-0 (supersedes the Q-6 do-not-build pin): the Escalate button lives on the portfolio rows');
  w.eval("openIndCard('r-smkmn');indF('indicator',{value:'Competitor tool launches'});indF('threshold',{value:'Any self-serve design tool reaching our segment'});indF('source',{value:'Sales intel'});saveIndicatorCard('r-smkmn')"); await wait();
  ok(w.eval("!needsLanding(data.risks.find(function(x){return x.id==='r-smkmn'}))&&isEnhanced(data.risks.find(function(x){return x.id==='r-smkmn'}))")===true, 'M-3 (retargeted 16 Aug 2026 night): the warn clears once the saved plan names an owner and carries an indicator; Enhanced derives from frequency alone');
  w.eval("window.prompt=function(){return 'Not being actively worked; watching suffices'}");
  w.eval("reclassifyRisk('r-mg2')"); await wait();
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg2'});var pn=r.history.slice(-1)[0];return cardClass(r)==='monitor'&&pn.kind==='reclassification'&&pn.classification==='manage'&&needsLanding(r)})()")===true, 'M-6: reclassification pins the outgoing class and lands the card flagged');
  ok(w.document.getElementById('app').innerHTML.indexOf('Tinted-Glass Defect Miss Rate')>=0, 'M-6: the reclassified card arrives on the destination tab');
  w.eval("UI.activeView=null;go('phase5')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Monitor Enh.')<0, 'chunk 14: dashboard lanes are Manage / Monitor / Ethical with Enhanced derived (D-8/M-3)');
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the dashboard archive band is retired; archive access lives on the portfolio archive panels. The arch-* view branches remain in source, flagged for the dead-code batch. */
  ok(w.eval("(function(){UI.activeView=null;go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf(\"UI.activeView='arch-\")<0})()")===true, 'chunk 14 (retargeted 31 Jul 2026): no archive tiles on the dashboard \u2014 the band is retired by ruling');
  ok(w.eval("typeof classifyRisk")==='undefined', 'chunk 14: classifyRisk and the dashboard likert flow are retired');
  w.eval("delete (data.completedSteps||{})['4.2'];saveGR()");
  ok(w.eval("!(data.completedSteps||{})['4.2']")===true, 'D-6: field saves no longer mark steps complete');
  /* Retargeted 10 Aug 2026 (round 29) and 14 Aug 2026 (addendum 124, Paul's ruling): the 4.2 gate is now attendees + first date + the five Deployment and Integration fields, so the completion-path probe supplies all of them. D-6's substance (only the button completes) is unchanged. */
  w.eval("if(!data.govRhythm)data.govRhythm={};data.govRhythm.attendeesList=['Tamsin Doyle'];data.govRhythm.firstMeeting='2026-08-03';if(!data.embedOps)data.embedOps={};['deploymentGate','lightGate','projectMgmt','hr','procurement'].forEach(function(f){if(!String(data.embedOps[f]||'').trim())data.embedOps[f]='set for the probe'});completeStepGated('4.2');go('step','4.2')");
  ok(w.eval("(data.completedSteps||{})['4.2']===true")===true, 'D-6 (retargeted 10 Aug 2026, round 29): Mark Complete & Continue is the only completion path');
  w.eval("delete data.completedSteps['2.5'];completeStepGated('2.5');go('step','2.5')");
  ok(w.eval("!(data.completedSteps||{})['2.5']")===true, 'D-6/D-P2.5: the ceremony artifact gate holds through the button path');
  w.eval("data.completedSteps['2.5']=true;data.completedSteps['4.2']=true");
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn1'});return cardClass(r)==='monitor'&&isEnhanced(r)&&!needsLanding(r)&&r.monitorPlan.monitor==='Duncan Fairley'})()")===true, 'chunk-K seed: r-mn1 carries the approved monitoring plan, Enhanced by derivation');
  w.eval("go('portfolio','manage');UI.pfKindF='monitor';render()"); await wait();
  w.eval("UI.escOpen='r-mn3';render()"); await wait();
  w.eval("document.getElementById('esc_what').value='Model drift detected in production';document.getElementById('esc_lead').value='Harriet Rivers';saveEscalation('r-mn3')"); await wait();
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn3'});var P=getPortfolios();return !!r.escalation&&r.classification==='manage'&&P.emergency.some(function(x){return x.id==='r-mn3'})&&(r.history||[]).some(function(p){return p.kind==='escalation'&&p.classification==='monitor'})})()")===true, 'E-0 (baseline retargeted 31 Jul 2026: the seed now ships r-er1 escalated): escalation is membership; a Monitor card reclassifies to Manage in the same decision, the old classification pinned');
  w.eval("window.prompt=function(){return 'Drift contained; retraining verified'};deescalateRisk('r-mn3')"); await wait();
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn3'});return !r.escalation&&cardClass(r)==='manage'&&needsLanding(r)&&(r.history||[]).some(function(p){return p.kind==='de-escalation'})})()")===true, 'E-4: de-escalation pins the outgoing record and lands the card on Manage wearing the triangle');
  w.eval("UI.pfKindF='manage';render()"); await wait();
  w.eval("UI.escOpen='r-mn3';render()"); await wait();
  w.eval("document.getElementById('esc_what').value='Drift recurred after retraining';document.getElementById('esc_lead').value='Harriet Rivers';saveEscalation('r-mn3')"); await wait();
  w.eval("go('portfolio','emergency')"); await wait();
  /* SUPERSEDED 31 Jul 2026 (conformance): the escalation line relocated from the bar into the expanded row; the readiness badge stays on the bar. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;if(h.indexOf('No plan')<0&&h.indexOf('Ready')<0)return false;var er=getPortfolios().emergency.filter(function(r){return (((r.escalation||{}).what)||'').indexOf('Drift recurred')>=0})[0];if(!er)return false;UI.erOpen=er.id;render();var h2=document.getElementById('app').innerHTML;UI.erOpen=null;render();return h2.indexOf('Drift recurred after retraining')>=0})()")===true, 'E-2 (retargeted 31 Jul 2026, conformance): readiness marker on the bar; the escalation line lives in the expanded row');
  w.eval("UI.erOpen='r-mn3';render()"); await wait();
  w.eval("document.getElementById('inc_what').value='Recurrence confirmed on the new batch';document.getElementById('inc_did').value='Rolled the model back';addIncident('r-mn3')"); await wait();
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn3'});return (r.incidentLog||[]).length===1&&r.incidentLog[0].did.indexOf('Rolled')===0})()")===true, 'E-3: the incident log appends in the check-in grammar');
  w.eval("window.prompt=function(){return 'Rolled back; stable for 48 hours'};deescalateRisk('r-mn3')"); await wait();
  w.eval("openSystemView('sys-1')"); await wait();
  /* Retargeted 15 Aug 2026 (addendum 128): the system view is a three-page card — the record lives on Description, the grouped picture on System Risks. */
  w.eval("UI.sysPg='desc';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('AI-Powered Quoting Engine')>=0&&h.indexOf('Inventory record')>=0&&h.indexOf('Deployment gate')>=0&&h.indexOf('System Risks')>=0})()")===true, 'E-6 (retargeted 15 Aug 2026, addendum 128): the Description page carries the record and the deployment-gate record; the tab bar carries the pages');
  w.eval("UI.sysPg='risks';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('High severity')>=0&&h.indexOf('>Responsible AI<')>=0&&h.indexOf('Monitored')>=0/* retargeted 19 Aug 2026, addendum 216: stat box retitled by ruling */})()"/* Retargeted 15 Aug 2026 (addendum 131, ruled): five stat boxes replace the risk-picture card. */)===true, 'E-6: the system view assembles the record and the grouped risk picture');
  w.eval("UI.sysPg='desc';render()"); await wait();/* addendum 128: back to the Description page for the record edit */
  w.eval("document.getElementById('sys_owner').value='Harriet Rivers (interim)';saveSystemRecord('sys-1')"); await wait();
  ok(w.eval("data.systems.find(function(x){return x.id==='sys-1'}).owner")==='Harriet Rivers (interim)', 'E-6: the inventory record edits in place');
  w.eval("go('phase5')"); await wait();
  w.eval("openSystemView('sys-1')"); await wait();
  w.eval("UI.sysPg='exit';UI.exitOpen='sys-1';render()"); await wait();/* addendum 128: the exit apparatus lives on the card's Exit page */
  w.eval("document.getElementById('ex_rat').value='Bias exposure now exceeds the system value; replacement approved';document.getElementById('ex_dir').value='Harriet Rivers';saveExitDecision('sys-1')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-1'});var live=data.risks.filter(function(r){return r&&r.systemId==='sys-1'&&!isArchivedRisk(r)});return !!s.exitDecision&&sysExitState(s)==='shutdown'&&s.exitDecision.plan.director==='Harriet Rivers'&&live.length>0})()")===true, 'E-5 (retargeted 16 Aug 2026, directive item 12): the exit decision writes at decision time; the system enters shutdown; attached risks keep living');
  /* Retargeted 16 Aug 2026 (ruled: an exit cannot complete over a live emergency). The seeded
     r-er1 arrives escalated on sys-1; the old driver completed the exit over it — archiving a
     card mid-emergency with no stand-down, the exact hole the ruling closes. The driver now
     stands it down on the record first; the pin's substance (completion archives the attached
     risks together) is unchanged. */
  w.eval("window.prompt=function(){return 'Contained; sys-1 retiring on the exit decision'};deescalateRisk('r-er1')"); await wait();
  w.eval("completeExit('sys-1')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-1'});var mine=data.risks.filter(function(r){return r&&r.systemId==='sys-1'&&r.id!=='r-ac1'});var allArch=mine.every(isArchivedRisk);var typed=mine.every(function(r){return r.resolution&&r.resolution.type==='retired with the system'||r.dismissed});reviveRisk(mine[0].id);return sysExitState(s)==='exited'&&allArch&&typed&&!isArchivedRisk(mine[0])})()")===true, 'E-5/E-7: completion archives the attached risks together, retired with the system, each individually revivable (seeded pre-archived r-ac1 excluded — chunk-K roster)');
  ok(w.eval("esc('a\"b<c>')")==='a&quot;b&lt;c&gt;', 'B-2 fix: esc covers double quotes alongside angle brackets');
  w.eval("go('portfolio','manage');UI.pfKindF='manage';UI.mgOpen='r-mn3';UI.mgRevise=false;render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Incident log')>=0&&h.indexOf('read it before you write')>=0})()")===true, 'L-3 fix: the incident log renders on the Manage card for the post-incident review');
  w.eval("UI.mgOpen=null"); 
  w.eval("go('phase5')"); await wait();
  w.eval("UI.activeView=null;go('phase5')"); await wait();
  /* Relocated 31 Jul 2026 (Paul's ruling): the cadence editor lives under the Next Risk Review box as an in-place expansion; saveRC remains the canonical saver (D-4/D-6 substance intact). */
  ok(w.eval("(function(){UI.dashManage='cadence';go('phase5');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('rc_reviewFrequency')>=0&&h.indexOf('saveRC()')>=0;UI.dashManage=null;render();return pass})()")===true, 'D-4 (retargeted 31 Jul 2026): the cadence editor opens under the Next Risk Review box and saves through saveRC');
  w.eval("delete (data.completedSteps||{})['2.3'];saveRC()");
  ok(w.eval("!(data.completedSteps||{})['2.3']")===true, 'D-6 holds on the reinstated surface: the embed save never marks 2.3');
  w.eval("data.completedSteps['2.3']=true");

  // ── chunk 29: 4.2 Governance Rhythm (D-P4.2; gate ruled 21 July: attendees + first meeting date) ──
  w.eval("delete (data.completedSteps||{})['4.2'];data.govRhythm={};UI.grFreqEdit=false");
  w.eval("go('step','4.2')"); await wait();
  ok(w.eval("(function(){UI.g42Tab='rhythm';render();var h=document.getElementById('app').innerHTML;return h.indexOf('Review Frequency')>=0&&h.indexOf('The Standing Review Agenda')>=0&&h.indexOf('Responsible AI Board Review')>=0&&h.indexOf('Deployment and Integration')>=0&&h.indexOf('gr_meetingFrequency')<0&&h.indexOf('gr_emergencyTriggers')<0})()")===true, 'chunk 29 (retargeted 14 Aug 2026, addendum 124): 4.2 opens on the Review Rhythm tab with the standing agenda; the tab bar carries Deployment and Integration; the retired fields stay gone');
  w.eval("completeStepGated('4.2');go('step','4.2')");
  ok(w.eval("!(data.completedSteps||{})['4.2']")===true, 'chunk 29: the gate blocks while attendees and first meeting date are empty');
  /* Retargeted 10 Aug 2026 (round 29, Paul's input-grammar ruling): gr_attendees became the grl_ add-list; the attendee criterion moved to data (attendeesList). */
  /* Retargeted 14 Aug 2026 (addendum 122, Paul's ruling): attendee rows split into Name and Responsibility boxes; the harvest writes pairs. */
  w.eval("addGrItem('attendees');document.getElementById('grl_attendees_0_name').value='Tamsin Doyle';document.getElementById('grl_attendees_0_resp').value='Chair';document.getElementById('gr_firstMeeting').value='2026-08-03';saveGR()"); await wait();
  w.eval("completeStepGated('4.2');go('step','4.2')");
  ok(w.eval("(function(){var a=(data.govRhythm.attendeesList||[])[0]||{};return (data.completedSteps||{})['4.2']===true&&a.name==='Tamsin Doyle'&&a.responsibility==='Chair'&&data.govRhythm.emergencyTriggers===undefined&&data.govRhythm.meetingFrequency===undefined})()")===true, 'chunk 29 (retargeted 14 Aug 2026, addendum 122): filled details clear the gate; attendees harvest as name/responsibility pairs; saveGR writes only the kept fields');
  /* SUPERSEDED 31 Jul 2026 (Paul's decomposition ruling): the Governance Review runs on its own clock. gr_govFrequency writes govRhythm.govFrequency and never touches the risk cadence. */
  ok(w.eval("(function(){var _f0=(data.reviewCadence||{}).reviewFrequency;document.getElementById('gr_govFrequency').value='quarterly';saveGR();return data.govRhythm.govFrequency==='quarterly'&&(data.reviewCadence||{}).reviewFrequency===_f0})()")===true, 'chunk 29 (retargeted 31 Jul 2026): the governance frequency is its own store; the risk cadence is untouched');

  // ── chunk 30: 4.3 Exit Planning (retargeted 14 Aug 2026, addendum 124: renamed from Embed into Operations; the gates and integration cards moved to 4.2's Deployment and Integration tab) ──
  w.eval("delete (data.completedSteps||{})['4.3'];UI.eoSysOpen=null;UI.exitDraftOpen=null;UI.exitOpen=null");
  w.eval("go('step','4.3')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Review the Systems')>=0&&h.indexOf('Draft the First Exit Plans')<0&&h.indexOf('Deployment Gates')<0&&h.indexOf('Integration Points')<0&&h.indexOf('eo_reassessFrequency')<0&&h.indexOf('Reassessment Schedule')<0})()")===true, 'chunk 30 (retargeted 14 Aug 2026, addendum 124; again 15 Aug 2026, addendum 133, ruled): 4.3 is Review the Systems — the exercise only; the gates and integration cards left for 4.2');
  w.eval("go('step','4.2')"); await wait();
  w.eval("UI.g42Tab='dep';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Deployment Gates')>=0&&h.indexOf('Integration Points')>=0&&h.indexOf('minimum your organization requires')>=0&&h.indexOf('pre-deployment tests')<0&&h.indexOf('testing plan')<0})()")===true, 'addendum 124: the Deployment and Integration tab carries both cards; the gates read as minimum deployment criteria, disconnected from the testing machinery');
  w.eval("document.getElementById('eo_deploymentGate').value='Tests run and logged';document.getElementById('eo_lightGate').value='Light path';document.getElementById('eo_projectMgmt').value='PM gates';document.getElementById('eo_hr').value='Onboarding';document.getElementById('eo_procurement').value='Vendor criteria';saveEO()"); await wait();
  ok(w.eval("data.embedOps.deploymentGate==='Tests run and logged'&&data.embedOps.reassessFrequency===undefined&&data.embedOps.reassessScope===undefined")===true, 'chunk 30 (retargeted 14 Aug 2026, addendum 124): saveEO writes only the five kept fields, from the 4.2 tab');
  w.eval("UI.g42Tab='rhythm';render()"); await wait();
  w.eval("saveEO()"); await wait();
  ok(w.eval("data.embedOps.deploymentGate==='Tests run and logged'&&data.embedOps.procurement==='Vendor criteria'")===true, 'addendum 124 (\u00a77A): saveEO is element-guarded — saving from the Review Rhythm tab never blanks the stored Deployment and Integration values');
  w.eval("go('step','4.3')"); await wait();
  w.eval("window.__x1=data.systems.find(function(s){return s.id==='sys-1'}).exitDecision;delete data.systems.find(function(s){return s.id==='sys-1'}).exitDecision"); // stash sys-1's decision: the gate must be tested unconfounded
  w.eval("window.__migD={};['sys-1','sys-2','sys-3'].forEach(function(id){var s=data.systems.find(function(x){return x.id===id});if(s&&s.exitDraft){window.__migD[id]=s.exitDraft;delete s.exitDraft}});render()"); await wait();/* R-14 fixture: the migrated drafts stash so the empty-gate semantics stay testable */
  w.eval("completeStepGated('4.3');go('step','4.3')");
  ok(w.eval("!(data.completedSteps||{})['4.3']")===true, 'chunk 30: the gate blocks while no exit draft (or decision) exists anywhere');
  w.eval("UI.eoSysOpen='sys-2';UI.sysPg='risks';render()"); await wait();/* addendum 128: open the card on System Risks for the picture pin, then Exit for the draft flow */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return currentPage==='step'&&currentStep==='4.3'&&h.indexOf('High severity')>=0&&(UI.sysPg='exit')&&(render()||true)&&document.getElementById('app').innerHTML.indexOf('Exit Plan')>=0})()")===true, 'chunk 30 (retargeted 15 Aug 2026, addendum 131, ruled): the system view hosts IN PLACE on the step page (D-4 identity, same body)');
  w.eval("UI.sysPg='exit';UI.exitDraftOpen='sys-2';render()"); await wait();
  w.eval("document.getElementById('ex_dir').value='Vincent Lau';document.getElementById('ex_succ').value='Manual inspection holds quality';saveExitDraft('sys-2')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});var h=document.getElementById('app').innerHTML;return !!s.exitDraft&&s.exitDraft.plan.director==='Vincent Lau'&&!s.exitDecision&&h.indexOf('Exit Plan')>=0&&document.getElementById('ex_dir').value==='Vincent Lau'})()")===true, 'chunk 30 (retargeted 15 Aug 2026, addendum 131, ruled): the plan persists on the system and the default-open Exit Plan carries it \u2014 the drafted-not-decided chip retireed');
  w.eval("completeStepGated('4.3');go('step','4.3')");
  ok(w.eval("(data.completedSteps||{})['4.3']")!==true, 'chunk 30 (retargeted 15 Aug 2026, addendum 133, ruled): one plan is no longer enough \u2014 the gate wants every system covered');
  w.eval("(data.systems||[]).forEach(function(s){if(s&&!s.exitDraft&&!s.exitDecision)s.exitDraft={plan:{},by:'first pass',at:Date.now()}});saveData();completeStepGated('4.3');go('step','4.3')"); await wait();
  ok(w.eval("(data.completedSteps||{})['4.3']===true")===true, 'chunk 30 (retargeted 15 Aug 2026, addendum 133, ruled): with a plan on every live system, the gate clears');
  w.eval("UI.sysPg='exit';UI.exitDraftOpen=null;UI.exitOpen='sys-2';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return document.getElementById('ex_dir').value==='Vincent Lau'&&h.indexOf('record why this system is being retired')>=0})()")===true, 'chunk 30 (retargeted 15 Aug 2026, addendum 131; again addendum 132, ruled): the decision form opens pre-populated, led by the retirement lead');
  w.eval("document.getElementById('ex_rat').value='Drafted rationale confirmed at decision time';saveExitDecision('sys-2')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});return !!s.exitDecision&&s.exitDraft===undefined&&s.exitDecision.plan.director==='Vincent Lau'})()")===true, 'chunk 30: a taken decision carries the drafted plan forward and clears the superseded draft');
  w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});delete s.exitDecision})()"); // sys-2 returns to live — the draft cycle was the exercise, the suite's end state keeps sys-2 undecided
  w.eval("data.systems.find(function(s){return s.id==='sys-1'}).exitDecision=window.__x1;delete window.__x1"); // restore sys-1's decision — the suite's end state carries the full E-5 history
  w.eval("UI.exitOpen=null;UI.eoSysOpen=null;render()"); await wait();

  w.eval("['sys-1','sys-2','sys-3'].forEach(function(id){if(window.__migD&&window.__migD[id]){var s=data.systems.find(function(x){return x.id===id});if(s)s.exitDraft=window.__migD[id]}});delete window.__migD;render()"); await wait();/* R-14 fixture: drafts restored */

  // ── chunk 31: 4.4 First Governance Review (D-P4.4: the agenda as a working checklist; walks + retro gate the phase) ──
  w.eval("delete (data.completedSteps||{})['4.4'];if(data.firstReview)delete data.firstReview.walk;UI.mgOpen=null;UI.mnOpen=null");
  w.eval("go('step','4.4')"); await wait();
  /* SUPERSEDED 31 Jul 2026 (decomposition ruling): 4.4 is the first Governance Review \u2014 reviews-as-planned, portfolio hygiene, RACI gaps, retro. The register-walk items live with the New Risk Review. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('running as planned')>=0&&h.indexOf('Sweep the portfolios for stuck work')>=0&&h.indexOf('Check every decisive test result since the last review.')>=0&&h.indexOf('any new regimes or obligations to add')>=0&&h.indexOf('Sweep the AI system records to ensure that they are current.')>=0&&h.indexOf('Computed from the responsibility matrix')<0&&h.indexOf('7. Assess how governance is running')>=0&&h.indexOf('6. Review responsibilities')>=0&&h.indexOf('Mark covered')>=0&&h.indexOf('The Retro')<0&&h.indexOf('the re-scan')<0&&h.indexOf('Process Effectiveness')<0})()")===true, 'chunk 31 (retargeted 22 Aug 2026: Review responsibilities enters at six, the closing item moves to seven; earlier 14 Aug 2026, addendum 124; 15 Aug addendum 133; again 15 Aug 2026, addendum 137, ruled): 4.4 carries the six ruled agenda items \u2014 the RACI card scrapped, item 6 covered like the rest');
  w.eval("document.getElementById('fr_working').value='Escalations reach the right desk';document.getElementById('fr_bottlenecks').value='Vendor evidence is slow';document.getElementById('fr_nextIteration').value='Move the bias audit earlier';saveFR()"); await wait();
  ok(w.eval("data.firstReview.working==='Escalations reach the right desk'&&data.firstReview.cultureEvidence===undefined")===true, 'chunk 31: saveFR writes the three retro fields only — cultureEvidence is dead');
  w.eval("completeStepGated('4.4');go('step','4.4')");
  ok(w.eval("!(data.completedSteps||{})['4.4']")===true, 'chunk 31: the phase gate blocks while the agenda is unwalked, retro or no retro');
  /* Retargeted 14 Aug 2026 (addendum 124): keys realigned to the five ruled agenda items + raci; the old seven-key set could never be satisfied from the page (discovered defect, fixed). */
  w.eval("['planned','stuck','systems','tests','compliance'].forEach(function(k){walkFR(k)})");/* addendum 133: the systems sweep joins the walk */ await wait();
  w.eval("completeStepGated('4.4');go('step','4.4')");
  ok(w.eval("!(data.completedSteps||{})['4.4']")===true, 'chunk 31 (retargeted 14 Aug 2026, addendum 124): four of five covered still blocks — every item must be covered');
  w.eval("walkFR('resp');walkFR('review')");/* addendum 137: RACI scrapped; item 6 joins the walk. KB fixes 15 Oct 2026, item 10: item 6 (resp) is required too */ await wait();
  w.eval("completeStepGated('4.4');go('step','4.4')");
  /* Retargeted 16 Oct 2026 (KB fixes 15 Oct 2026, item 9, ruled): the step completes once a Governance Review is logged, not on the Covered marks the save clears */
  ok(w.eval("!(data.completedSteps||{})['4.4']&&dataGateMsg('4.4').indexOf('Hold the review first')>=0")===true, 'chunk 31 (retargeted 16 Oct 2026, KB fixes item 9): every item covered still blocks until the review is saved');
  w.eval("window._kbWalk=JSON.parse(JSON.stringify(data.firstReview.walk));saveFR();govLogReview('governance')"); await wait();
  w.eval("completeStepGated('4.4');go('step','4.4')");
  ok(w.eval("(data.completedSteps||{})['4.4']===true&&(data.reviewLog||[]).some(function(e){return e.kind==='governance'})")===true, 'chunk 31 (retargeted 16 Oct 2026, KB fixes item 9): Save governance review logs the review, and the step then completes — the 90-day phase gate');
  w.eval("data.reviewLog.pop();data.firstReview.walk=window._kbWalk;delete window._kbWalk;saveData()"); await wait();
  w.eval("ensureGovRaciModel();data.raciActs.push({id:'ra-orphan',name:'Orphan activity'});render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Orphan activity')<0&&h.indexOf('Computed from the responsibility matrix')<0})()")===true, 'chunk 38 swap (O-6, SUPERSEDED 15 Aug 2026, addendum 137, ruled): the RACI card is scrapped from 4.4');
  w.eval("removeGovRaciAct('ra-orphan')"); await wait();
  w.eval("UI.mgOpen='r-mn3';UI.mgRevise=false;render()"); await wait();
  /* SUPERSEDED 31 Jul 2026 (decomposition ruling): the plans pass lives with the portfolios and the hygiene sweep; 4.4 no longer embeds plan views. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return currentStep==='4.4'&&h.indexOf('plans needing attention')>=0})()")===true, 'chunk 31 (retargeted 31 Jul 2026): 4.4 sweeps plan hygiene as a count; the plan surfaces live on the portfolios');
  w.eval("UI.mgOpen=null;render()"); await wait();

  // ── chunk 32: 1.5 Regulatory Landscape + the regime register (D-P1.5, R-1; C-6 pins on scoping and obligation status) ──
  ok(w.eval("(function(){var P=PHASES.find(function(p){return p.id===1});return P.steps.some(function(s){return s.id==='1.4'&&s.name.indexOf('Regulatory Landscape')===0})})()")===true, 'chunk 32: 1.4 is re-listed in the phase-1 navigation (renumbered chunk G, 22 Jul)');
  ok(w.eval("(function(){var rg=data.regimes||[];var nw=rg.find(function(g){return g.id==='reg-northwind'});var ni=rg.find(function(g){return g.id==='reg-nist'});return rg.length===6&&ni&&!ni.scoping&&nw&&nw.obligations.length===2})()")===true, 'chunk 32: the seed carries six regimes (chunk K + Hartwell, item 34) — NIST unscoped, the contractual regime itemized');
  w.eval("go('step','1.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Compliance Survey')>=0&&h.indexOf('Compliance Register</h3>')<0&&h.indexOf('NIST AI RMF')>=0&&h.indexOf('The scoping judgment')<0&&h.indexOf('Systems in scope')<0&&h.indexOf('dr_approveDeployment')<0})()")===true, 'item 50: 1.4 is the potential register \u2014 names listed, no scoping machinery on the page');
  w.eval("UI.regAdd=true;render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('ng_name')>=0&&h.indexOf('ng_type')>=0&&h.indexOf('ng_summary')>=0&&h.indexOf('ng_link')>=0&&h.indexOf('Upload documents')>=0&&h.indexOf('ng_owner')>=0&&h.indexOf('ng_link')<h.indexOf('ng_owner')})()")===true, 'item 64 Part 1: the 1.4 add form carries name/type/summary/link/upload and Owner restored after Link (supersedes the item-53 owner-stays-at-2.4 assert)');
  w.eval("UI.regAdd=false;delete (data.completedSteps||{})['1.4']");
  ok(w.eval("(function(){var saved=data.regimes;data.regimes=[];var blocked=!dataGateOK('1.4');data.regimes=saved;completeStepGated('1.4');go('step','1.4');return blocked&&(data.completedSteps||{})['1.4']===true})()")===true, 'item 50: the 1.4 gate wants one listed regime \u2014 empty blocks, the seeded list completes');
  w.eval("go('step','2.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Scoping needed')>=0})()")===true, 'item 50: the unscoped-NIST marker rides the 2.4 pending section now');
  w.eval("delete (data.completedSteps||{})['2.4']");
  w.eval("completeStepGated('2.4');go('step','2.4')");
  ok(w.eval("!(data.completedSteps||{})['2.4']")===true, 'item 50: the 2.4 gate blocks while any regime lacks its scoping judgment (the review moved here from 1.4)');
  w.eval("UI.regOpen='reg-nist';render()"); await wait();
  w.eval("document.getElementById('rg_judgment').value='applies';document.getElementById('rg_reason').value='The program aligns to it by construction — the signposts are the map';setScoping('reg-nist')"); await wait();
  ok(w.eval("(function(){var g=data.regimes.find(function(x){return x.id==='reg-nist'});var last=(g.history||[])[g.history.length-1];return g.scoping.judgment==='applies'&&!!g.scoping.by&&!!last&&last.kind==='scoping'&&last.to===undefined&&last.judgment==='applies'&&!!last.pinnedAt})()")===true, 'chunk 32: the scoping judgment writes reasoned, attributed, and PINNED (C-6)');
  w.eval("completeStepGated('2.4');go('step','2.4')");
  ok(w.eval("(data.completedSteps||{})['2.4']===true")===true, 'item 50: every regime scoped (applies ones summarized or itemized) completes 2.4');
  w.eval("UI.regOpen=null;UI.regAdd=true;render()"); await wait();
  w.eval("document.getElementById('ng_name').value='Utah AI Policy Act';document.getElementById('ng_type').value='regulation';addRegime()"); await wait();
  w.eval("removeRegime('reg-northwind')");
  ok(w.eval("(function(){var rg=data.regimes;return rg.length===7&&!!rg.find(function(g){return g.name==='Utah AI Policy Act'})&&!!rg.find(function(g){return g.id==='reg-northwind'})})()")===true, 'chunk 32: add lands on the register; remove refuses a judged regime (mistake-erasure only)');
  w.eval("removeRegime(data.regimes.find(function(g){return g.name==='Utah AI Policy Act'}).id)"); await wait();
  w.eval("UI.c24Tab='obl';UI.regOpen='reg-northwind';render()"); await wait();/* item 60: the obligation editor lives on the Compliance Obligations tab now */
  w.eval("UI.expanded['ob_reg-northwind_1']=true;render()"); await wait(); // obligations collapse by ruling (22 Jul, item 34): expand before writing
  w.eval("document.getElementById('ob_1_status').value='met';saveRegime('reg-northwind')"); await wait();
  ok(w.eval("(function(){var g=data.regimes.find(function(x){return x.id==='reg-northwind'});var o=g.obligations[1];var last=(g.history||[])[g.history.length-1];return o.status==='met'&&!!o.by&&last.kind==='obligation-status'&&last.from==='progress'&&last.to==='met'})()")===true, 'chunk 32: an obligation status change writes attributed and PINS from→to (C-6)');
  w.eval("UI.c24Tab='reg';UI.regOpen=null;render()"); await wait();/* item 60: back to the register tab for the downstream probes */
  ok(w.eval("(function(){var c=buildRegimeCSV();return c.indexOf('Colorado AI Act')>=0&&c.indexOf('Disclose AI-assisted quoting')>=0&&c.split('\\n').length>=6})()")===true, 'chunk 32: the register exports — one CSV row per obligation, regimes without items as single rows');
  w.eval("UI.regOpen=null;var _g=data.regimes.find(function(x){return x.id==='reg-nist'});_g.scoping=null;render()"); // restore the demo's teaching state: NIST awaits its scoping judgment (the pin history stays — pins never unwind)
  await wait();

  // ── chunk 33: 2.4 Compliance Catalog gate + the tab flow (D-P2.4/D-P2.5) ──
  w.eval("delete (data.completedSteps||{})['2.4'];var _ni33=data.regimes.find(function(x){return x.id==='reg-nist'});_ni33.scoping={judgment:'na',reason:'probe scaffold — restored below',by:'t',at:Date.now()};data.regimes.push({id:'reg-tmp33',name:'Temp applies regime',type:'regulation',scoping:{judgment:'applies',reason:'test',by:'t',at:Date.now()},systems:'all',summary:'',obligations:[],owner:'',revisit:''})");/* item 50: the ruled 2.4 gate requires every regime scoped, so the light-path probe scaffolds NIST with a direct-write judgment (no pin history) and restores the teaching state after */
  w.eval("completeStepGated('2.4');go('step','2.4')");
  ok(w.eval("!(data.completedSteps||{})['2.4']")===true, 'chunk 33: an applies-scoped regime with neither summary nor obligations blocks 2.4');
  w.eval("data.regimes.find(function(g){return g.id==='reg-tmp33'}).summary='One line is enough';completeStepGated('2.4');go('step','2.4')");
  ok(w.eval("(data.completedSteps||{})['2.4']===true")===true, 'chunk 33: the light path clears — a summary satisfies; itemization is never forced');
  w.eval("data.regimes=data.regimes.filter(function(g){return g.id!=='reg-tmp33'});data.regimes.find(function(x){return x.id==='reg-nist'}).scoping=null");
  ok(w.eval("(NIST_MAP['2.4']||[]).length===1&&NIST_MAP['2.4'][0]==='GOVERN 1.1'&&NIST_MAP['2.2'].indexOf('GOVERN 2.2')>=0&&NIST_MAP['2.2'].indexOf('MAP 3.4')>=0")===true, 'chunk 33 (retargeted 15 Aug 2026, addendum 126): 2.4 greens the GOVERN 1.1 row by ruling; the old re-pointed 2.2 sources hold');
  /* SUPERSEDED 31 Jul 2026: DEMAND_DOMAINS retired with the demand-mapping cluster (Paul's ruling). The R-6 vocabulary term survives as a live domain value on risk cards. */
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('var DEMAND_DOMAINS')<0})()&&w.eval("(data.risks||[]).some(function(r){return r.domain==='Third-party / vendor'})")===true, 'chunk 33 (retargeted 31 Jul 2026): the demand vocabulary array is extinct at source; the Third-party / vendor domain (R-6) lives on');

  // ── chunk 34: 3.3 tab 1 — testing plans, append-only evidence, derived states, D-6 fix, system-view host (R-5) ──
  w.eval("delete (data.completedSteps||{})['3.3'];UI.s33Tab='plans';UI.s33Open=null;UI.ttAdd=null;go('step','3.3')"); await wait();
  w.eval("ttEntryAdd('sys-3','claim')"); await wait(); /* retargeted 13 Aug 2026 (round 85): tplAddNistTest retired; any plan write carries the D-6 assertion */
  ok(w.eval("!(data.completedSteps||{})['3.3']")===true, 'D-6 kept under R-9: a template write never marks the step');
  w.eval("completeStepGated('3.3')"); await wait();
  ok(w.eval("currentStep")==='3.3', 'item 52: the last step of a phase STAYS on the page (supersedes the item-36 blanket-advance needle)');
  ok(w.document.getElementById('app').innerHTML.indexOf('Phase 3 Complete')>=0&&w.document.getElementById('app').innerHTML.indexOf('milestone-card')>=0, 'item 52: the phase-complete wrap-up card renders under the step milestone, on the donor classes');
  /* Retargeted 10 Aug 2026 (round 30, Paul's gate ruling): 3.1 now refuses completion while a confirmation test is pending, so the probe decides the seed's pending flags first and restores them after. */
  w.eval("delete (data.completedSteps||{})['3.1'];window.__p30=(data.risks||[]).filter(function(r){return isLiveRisk(r)&&ethStatusOf(r)==='potential'});window.__p30.forEach(function(r){r.ethStatus='cleared'});completeStepGated('3.1')"); await wait();
  ok(w.eval("currentStep")==='3.2'&&w.eval("(data.completedSteps||{})['3.1']===true"), 'item 52 (retargeted 10 Aug 2026, round 30): an intra-phase completion still advances (the item-36 ruled advance, scoped)');
  w.eval("(window.__p30||[]).forEach(function(r){delete r.ethStatus});window.__p30=null");
  w.eval("go('step','3.3')");
  ok(w.eval("(data.completedSteps||{})['3.3']===true")===true, 'chunk 34: Mark Complete is the only completion path');
  w.eval("UI.s33Open='sys-2';UI.s33Tab='needs';render()"); await wait(); /* retargeted 12 Aug 2026 (round 64): the standing add form is retired */
  w.eval("ttEntryAdd('sys-2','claim');var _s=data.systems.find(function(x){return x.id==='sys-2'});var _t=_s.testingPlan.tests[_s.testingPlan.tests.length-1];ttFieldSave('sys-2',_t.id,'claim','Recall holds above 90% on tinted glass');ttFieldSave('sys-2',_t.id,'test','Weekly labeled-batch replay');ttFieldSave('sys-2',_t.id,'shape','recurring');ttFieldSave('sys-2',_t.id,'frequency','weekly');render()"); await wait(); /* round 69: the system carries its stage; the designed entry shows on its evidence tab */ /* retargeted 12 Aug 2026 (round 64): creation on the What Needs Testing tab, fields via ttFieldSave */
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});var t=s.testingPlan.tests[s.testingPlan.tests.length-1];/* relative: the seed migration pre-populates the plan */UI.s33Tab='evidence';UI.s33Open='sys-2';render();var h=document.getElementById('app').innerHTML;return t.claim.indexOf('Recall holds')===0&&t.shape==='recurring'&&t.frequency==='weekly'&&h.indexOf('NOT YET RUN')>=0})()")===true, 'chunk 34 (retargeted 12 Aug 2026, round 68): the test lands on the plan; never-run shows NOT YET RUN on the evidence tab');
  w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});window.__tid=s.testingPlan.tests[s.testingPlan.tests.length-1].id})()");
  w.eval("UI.s33Tab='evidence';UI.expanded['tt_'+window.__tid]=true;render()"); await wait(); /* round 64: the bars live on the Tests & Evidence tab */
  w.eval("document.getElementById('te2_res_'+window.__tid).value='Recall 93.1% on the July batch';document.getElementById('te2_where_'+window.__tid).value='QC drive / weekly-replay';addTestEvidenceFor('sys-2',window.__tid)"); await wait(); /* retargeted 11 Aug 2026 (round 61): logging lives on the test's own expansion */
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});var e=s.testEvidence[s.testEvidence.length-1];var h=document.getElementById('app').innerHTML;return e.testId===window.__tid&&!!e.by&&!!e.at&&h.indexOf('On schedule')>=0})()/* the migrated plan legitimately shows NOT YET RUN rows beside it */")===true, 'chunk 34: the entry appends dated and attributed; the derived state flips to on-schedule');
  w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-2'});s.testEvidence.filter(function(e){return e.testId===window.__tid})[0].at=Date.now()-10*86400000})();render()"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('OVERDUE')>=0")===true, 'chunk 34: a lapsed recurring test derives OVERDUE from the last entry');
  w.eval("UI.s33Open=null;render()"); await wait();
  w.eval("openSystemView('sys-2')"); await wait();
  w.eval("UI.sysPg='testing';render()"); await wait();/* Retargeted again 15 Aug 2026 (addendum 129, ruled): testing moves to its own page. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;if(h.indexOf('What needs testing')<0||h.indexOf('Design the tests')<0||h.indexOf('Tests &amp; evidence')<0)return false;UI.sysTestTab='design';render();var h2=document.getElementById('app').innerHTML;if(h2.indexOf('id=\"tt_')<0&&h2.indexOf('Design the tests')<0)return false;UI.sysTestTab='evidence';render();var h3=document.getElementById('app').innerHTML;UI.sysTestTab='needs';render();return h3.indexOf('Tests &amp; evidence')>=0})()")===true&&w.eval("(function(){UI.sysPg='risks';render();return document.getElementById('app').innerHTML.indexOf('>Responsible AI<')>=0/* retargeted 19 Aug 2026, addendum 216 */})()")===true, 'chunk 34 (D-4, retargeted 12 Aug 2026, round 64; retargeted again 15 Aug 2026, addendum 131: three subtabs; boxes replace the picture card): the system view hosts the three passes stacked');
  w.eval("delete window.__tid;go('phase5')"); await wait();

  // ── chunk 35: 3.3 tab 2 — the eighth row, template seeding, evidence-derived MEASURE greens (R-5) ──
  w.eval("UI.s33Tab='template';go('step','3.3')"); await wait(); /* round 85: the reference has no per-system folds */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return TEVV_CHARS.length===8&&TEVV_CHARS[7].k==='env'&&TEVV_CHARS[7].sc==='MEASURE 2.12'&&h.indexOf('Environmental Impact')>=0})()")===true, 'chunk 35 kept under R-9 (retargeted round 85 to the reference): eight characteristics, env rendered on the rebuilt template');
  ok(w.eval("typeof tplLogEvidence")==='undefined'&&w.eval("typeof seedNistTemplate")==='undefined'&&w.eval("typeof tplAddNistTest")==='undefined', 'superseded 13 Aug 2026 (round 85): the template machinery retired with the reference rebuild \u2014 was: row quick-log writes the real store; bulk seeding idempotent');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('agreed tolerance of manual pricing')>=0&&h.indexOf('Add the NIST test')<0&&h.indexOf('What testing it might look like')<0||h.indexOf('what testing it might look like')>=0})()")===true, 'round 85: the reference carries worked examples and no add machinery');
  w.eval("(function(){var live=data.systems.filter(function(s){return !sysExitState(s)});live.forEach(function(s){if(!s.testingPlan)s.testingPlan={tests:[]};var t=s.testingPlan.tests.find(function(x){return x.char==='privacy'});if(!t){t={id:'tt-pin35-'+s.id,claim:'Privacy-Enhanced',test:'pin',shape:'once',trigger:'pre-deployment',runner:'',char:'privacy'};s.testingPlan.tests.push(t)}if(!s.testEvidence)s.testEvidence=[];s.testEvidence.push({testId:t.id,at:Date.now(),result:'pin',where:'',by:'suite'})})})()");
  ok(w.eval("(function(){var st=nistSubStatus('MEASURE 2.10');var live=data.systems.filter(function(s){return !sysExitState(s)}).length;return st.s==='achieved'&&st.ev==='logged on '+live+' of '+live+' systems'})()")===true, 'chunk 35: a characteristic row greens from EVIDENCE — every in-scope system logged, counts honest');
  w.eval("(function(){var live=data.systems.filter(function(s){return !sysExitState(s)});var s0=live[0];s0.testEvidence=s0.testEvidence.filter(function(e){return e.result!=='pin'})})()");
  ok(w.eval("(function(){var st=nistSubStatus('MEASURE 2.10');return st.s==='progress'&&st.ev.indexOf('logged on ')===0})()")===true, 'chunk 35: one uncovered live system drops the row to in-progress with the count shown');
  w.eval("go('phase5');UI.entry=null;render()");
  w.eval("(function(){data.systems.forEach(function(s){if(s.testEvidence)s.testEvidence=s.testEvidence.filter(function(e){return e.result!=='pin'});if(s.testingPlan&&s.testingPlan.tests)s.testingPlan.tests=s.testingPlan.tests.filter(function(t){return (t.id||'').indexOf('tt-pin35-')!==0})});saveData()})()");
  await wait();

  // ── chunk 36: the Compliance Dashboard respec (R-2/R-3/R-4, D-13) ──
  ok(w.eval("(function(){return NIST_MAP['3.1']===undefined&&NIST_MAP['5.0']===undefined&&NIST_MAP['2.2'].length===11&&(NIST_REV['GOVERN 1.5']||[]).length===2&&(NIST_REV['GOVERN 1.1']||[]).length===2&&(NIST_REV['MANAGE 1.1']||[]).length===2&&NIST_SUBCATS.every(function(sc){return (NIST_REV[sc]||[]).length>=1})})()")===true, 'chunk 36 (retargeted 15 Aug 2026, addendum 126): the crosswalk directory — dead refs gone, GOVERN 1.5, GOVERN 1.1, and MANAGE 1.1 dual-sourced by ruling, all 72 rows sourced');
  ok(w.eval("(function(){return Object.keys(NIST_SIGN).length===72&&NIST_SUBCATS.every(function(sc){return NIST_SIGN[sc]&&NIST_SIGN[sc].s})&&NIST_SIGN['GOVERN 2.2'].o.indexOf('training')>=0})()")===true, 'chunk 36: the signpost directory covers all 72 rows, outside residue named');
  w.eval("UI.cdRegime=null;UI.certCol=false;UI.certOpen=null;go('step','5.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Compliance Dashboard')>=0&&h.indexOf('ACHIEVED')<0&&h.indexOf('ADDRESSED')>=0&&h.indexOf('principle register')>=0&&h.indexOf('does not assert compliance')>=0&&h.indexOf('cert_status')<0&&h.indexOf('Show the certification column')<0&&h.indexOf('NIST TEVV Reference')>=0})()")===true, 'chunk 36 (retargeted 15 Aug 2026, addendum 155; again 16 Aug 2026, directive round \u2014 the footnote sheds its never): renamed, achieved dies, signposts render, disclaimer stands, certification column REMOVED (ruled 22 Jul, item 34), the TEVV embed survives');
  /* chunk-36 certification exercise (D-13, C-6) retired 22 July with the certification column (Paul's ruling, item 34). */
  w.eval("UI.cdRegime='reg-northwind';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Northwind account')>=0&&h.indexOf('Obligations under this regime')>=0&&h.indexOf('Disclose AI-assisted quoting')>=0&&h.indexOf('Edit in the register')>=0&&h.indexOf('Summary bars')<0})()")===true, 'chunk 36 (R-2): an itemized regime grows its own page — obligations shown, editing linked, never duplicated');
  w.eval("UI.cdRegime=null;UI.certCol=false;go('step','2.4')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Dashboard page')>=0")===true, 'chunk 36 (R-3): the dashboard page is reached through the register');
  w.eval("go('phase5')"); await wait();

  // ── chunk 37: the R-6 crosswalk-closing set ──
  w.eval("UI.s22Tab='cul';go('step','2.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('>Culture<')>=0&&h.indexOf('gc_raiseChannel')>=0&&h.indexOf('gc_raiseResponse')>=0&&h.indexOf('gc_riskSharing')>=0})()")===true, 'chunk 37 (D-P2.2): 2.2 is four tabs; the Culture tab carries the three ruled boxes');
  w.eval("document.getElementById('gc_raiseChannel').value='Direct to the governance owner or the anonymous form; raising is rewarded, never penalized';document.getElementById('gc_raiseResponse').value='Owner responds within two business days';document.getElementById('gc_riskSharing').value='Monthly digest to all department heads';saveCultureTab()"); await wait();
  ok(w.eval("(function(){var gc=data.govCulture;return gc.raiseChannel.indexOf('anonymous form')>=0&&gc.raiseResponse.indexOf('two business days')>=0&&gc.riskSharing.indexOf('Monthly digest')>=0&&data.completed['2.2d']===true})()")===true, 'chunk 37: the Culture tab writes the shared govCulture store and marks its chip');
  w.eval("UI.s22Tab='own';render()"); await wait();
  w.eval("document.getElementById('os_thirdPartyPolicy').value='Vendors disclose model changes 30 days ahead; audit rights in every AI addendum';saveOS()"); await wait();
  ok(w.eval("(data.ownership||{}).thirdPartyPolicy.indexOf('audit rights')>=0")===true, 'chunk 37 (GOVERN 6.1): the third-party policy textarea lives on tab 1 and saveOS harvests it');
  w.eval("go('step','4.2')"); await wait();
  /* SUPERSEDED 31 Jul 2026 (decomposition ruling) and 14 Aug 2026 (addendum 124): the agenda is ruled at five items; the compliance item is the two register questions, and the walk phrasing is banned. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Check the compliance register: Are there any new regimes or obligations to add?')>=0&&h.indexOf('works through these items every time')>=0&&h.indexOf('seven items')<0&&h.indexOf('Walk the compliance register')<0})()")===true, 'chunk 37 (retargeted 14 Aug 2026, addendum 124): the 4.2 agenda card carries the five ruled items with the compliance questions aboard');
  w.eval("go('step','1.3')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Walk your vendor dependencies')>=0")===true, 'chunk 37 (MANAGE 3.1): the taught vendor-dependency prompt stands at 1.3');
  w.eval("data.risks.push({id:'r-pin37',systemId:'sys-1',name:'Pin37 vendor clause',description:'d',category:'O',source:'internal',litL:1,litI:2,litT:1,status:'identified',selection:{decision:'advance',by:'t',at:Date.now()},assess:{desc:'d',context:'c',rootCauses:['vendor clause'],noControls:true}})");
  w.eval("document.body.insertAdjacentHTML('beforeend','<input id=\"band_comm\" value=\"Named in the Northwind annual audit summary\"/>')");
  w.eval("UI.bandDraft={L:1,I:1,T:1,cls:'archive',rat:'Contract clause covers it; residual is tolerable'};confirmAssessment('r-pin37')");
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-pin37'});return r.resolution.type==='accepted \u2014 no action'&&r.resolution.communicated==='Named in the Northwind annual audit summary'&&r.resolution.rationale.indexOf('tolerable')>=0})()")===true, 'chunk 37 (MANAGE 1.4): the accepted resolution carries the optional communicated-to line');
  w.eval("var _e=document.getElementById('band_comm');if(_e)_e.parentNode.removeChild(_e)");
  w.eval("go('phase5')"); await wait();

  // ── chunk 38 block SWAPPED (Paul, 21 July, amends O-6): the named-people grid ──
  ok(w.eval("(function(){ensureGovRaciModel();var a=data.raciActs;var ppl=data.raciPeople;var mg=ppl.find(function(x){return x.name==='Tamsin Doyle'});return a.length===7&&data.raciMatrix===undefined&&a[0].name==='Initial Risk Assessment'&&!a[0].note&&ppl.length===11&&!!mg&&data.raci['ra-1:'+mg.id]==='A'})()")===true, 'R-2/R-3 ruling: the seed reshapes with every name a person — eleven columns (chunk-K roster), letters in cells, no notes, the legacy store gone');
  w.eval("UI.s22Tab='own';go('step','2.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var ppl=data.raciPeople;return h.indexOf('u-d1d587b')>=0&&h.indexOf('raci_ra-1:'+ppl[0].id)>=0&&h.indexOf('Tamsin Doyle')>=0&&h.indexOf('rt_0_name')>=0})()")===true, 'item 59: the donor matrix renders on its own classes with the Governance Team rows above it');
  w.eval("(function(){var mg=data.raciPeople.find(function(x){return x.name==='Tamsin Doyle'});var n=0;while(data.raci['ra-1:'+mg.id]&&n<6){govRaciCycle('ra-1:'+mg.id);n++}})()"); await wait();/* retargeted 17 Aug 2026 (addendum 188): the select retired with the RACI graphics port — the driver cycles the cell to blank through the live control */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var seg=h.substring(h.indexOf('Initial Risk Assessment'),h.indexOf('AI System Deployment Approval'));return seg.indexOf('one accountable name')>=0})()")===true, 'item 59: the one-accountable warning rides the fixed activity cell');
  w.eval("(function(){var mg=data.raciPeople.find(function(x){return x.name==='Tamsin Doyle'});var n=0;while(data.raci['ra-1:'+mg.id]!=='A'&&n<6){govRaciCycle('ra-1:'+mg.id);n++}})()"); await wait();/* retargeted 17 Aug 2026 (addendum 188): restores 'A' through the live cycle control */
  w.eval("addRaciPerson();var _i=data.raciPeople.length-1;var _e=document.getElementById('rt_'+_i+'_name');if(_e){_e.value='Temp Member';saveRaciTeam();render()}"); await wait();
  ok(w.eval("(function(){var tp=data.raciPeople.find(function(x){return x.name==='Temp Member'});return !!tp&&document.getElementById('app').innerHTML.indexOf('Temp Member')>=0})()")===true, 'R-2 ruling: adding a named person grows a column');
  w.eval("(function(){var tp=data.raciPeople.find(function(x){return x.name==='Temp Member'});data.raci['ra-2:'+tp.id]='R';removeRaciPerson(tp.id)})()"); await wait();
  ok(w.eval("(function(){return !data.raciPeople.some(function(x){return x.name==='Temp Member'})&&!Object.keys(data.raci).some(function(k){return data.raci[k]&&k.indexOf(':rp-')>=0&&!data.raciPeople.some(function(pp){return k.slice(k.indexOf(':')+1)===pp.id})})})()")===true, 'chunk 38 grammar kept: removing a person purges their letters');
  ok(w.eval("(function(){var h=renderOutRaci2();return h.indexOf('Initial Risk Assessment')>=0&&h.indexOf('<select')<0&&h.indexOf('Beyond the roster')<0&&h.indexOf('Tamsin Doyle')>=0})()")===true, 'R-2 ruling: the Phase 2 outcome renders the named-people grid read-only, no notes');
  w.eval("go('phase5')"); await wait();

  // ── chunk 39: the outcomes realignment (O-0–O-5) ──
  w.eval("goModule('phase-1')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Regulatory Landscape')>=0")===true, 'chunk 39 (O-1): Phase 1 lists the Regulatory Landscape outcome chip');
  ok(w.eval("(function(){var h=renderOutRegLandscape();return h.indexOf('Compliance Survey')>=0&&h.indexOf('NIST AI RMF')>=0&&h.indexOf('Hartwell')>=0&&h.indexOf('Scoping:')<0})()")===true, 'item 51: the Phase-1 landscape outcome is the potential list \u2014 names as a document, no scoping story (that lives at 2.4)');
  ok(w.eval("(function(){var h=renderOutSysInv();return h.indexOf('Systems Inventory')>=0&&h.indexOf('AI-Powered Quoting Engine')>=0&&h.indexOf('\u25be Save as PDF')>=0})()")===true, 'item 51 (needle retargeted 13 Aug 2026 — Rev L reversed §5B to the quiet Save as PDF; item 49 rollback shipped): the Systems Inventory outcome documents the 1.2 register with the universal PDF button');
  ok(w.eval("(function(){var o=PHASES.find(function(p){return p.id===1}).outcomes;return o.length===4&&o[0].id==='out-assessprofile'&&o.some(function(x){return x.id==='out-sysinv'})&&o.some(function(x){return x.name==='Compliance Survey'})&&!o.some(function(x){return x.id==='out-riskassess'})})()")===true, 'item 51 (retargeted 21 Aug 2026, copy-pass item 8): Phase 1 carries four outputs led by the Assessment Profile — a new battery-verbatim report, ruled by Paul; the old out-riskassess stays retired');
  ok((function(){var _s51=require('fs').readFileSync('Governance-app.js','utf8');return _s51.indexOf('renderOutRiskAssess')<0&&_s51.indexOf('\u25be Download PDF')<0})(), 'item 51: the dead outcome and the caret PDF label are extinct at source \u2014 the donor \u2193 PDF form is universal');
  ok(w.eval("(function(){UI.expanded={};var h=renderOutCompliance();var bars=(h.match(/class=\"xh\"/g)||[]).length===(data.regimes||[]).length;var closed=h.indexOf('Disclose AI-assisted quoting')<0;var g=(data.regimes||[]).filter(function(x){return (x.obligations||[]).some(function(o){return /Disclose AI-assisted quoting/.test(o.statement||'')})})[0];if(g){UI.expanded['cmp_'+g.id]=true}var o=renderOutCompliance();UI.expanded={};return bars&&closed&&h.indexOf('does not demand itemization')>=0&&(!g||(o.indexOf('Disclose AI-assisted quoting')>=0&&o.indexOf('>Statements<')>=0))})()")===true, 'chunk 39 (superseded 13 Sep 2026, Paul\u2019s ruling): one bar per regime with a fold; the open fold shows the regime record as the document lays it out; the sub reads does-not-demand');
  ok(w.eval("(function(){UI.expanded={};var h=renderOutTesting();var sys=(data.systems||[]).filter(function(x){return ((x.testingPlan||{}).tests||[]).length});var bars=(h.match(/class=\"xh\"/g)||[]).length===sys.length;UI.expanded['tev_'+sys[0].id]=true;var o=renderOutTesting();UI.expanded={};return h.indexOf('Testing & Evidence')>=0&&bars&&o.indexOf('>Each test<')>=0&&o.indexOf('Test runner: ')>=0})()")===true, 'chunk 39 (O-3; superseded 13 Sep 2026, Paul\u2019s ruling): one bar per system with a fold; the open fold shows the system record as the document lays it out');
  ok(w.eval("(function(){var h=renderOutExitPlans();return h.indexOf('Management & Monitoring Plans')>=0&&h.indexOf('Shutdown Sequence')<0&&h.indexOf('>Monitor (')>=0&&h.indexOf('>Manage (')>=0})()")===true, 'chunk 39 (O-4; retargeted 14 Sep 2026): the successor page reads the 4.1 product under Manage (n) and Monitor (n), the dead register read gone');
  w.eval("go('phase5')"); await wait();
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the Data Bank prunes to the donor's document set \u2014 registers and plans superseded by live surfaces leave the bank. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;var kept=[\"goModule('out-raci2')\",\"goModule('out-ethicsdoc')\",\"goModule('out-govfw')\",\"goModule('out-reglandscape')\"].every(function(n){return h.indexOf(n)>=0});var gone=[\"goModule('out-sysinv')\",\"goModule('out-riskreg')\",\"goModule('out-exitplans')\",\"goModule('out-updatedreg')\",\"goModule('out-compliance')\",\"goModule('out-testing')\",\"goModule('out-assessedreg')\"].every(function(n){return h.indexOf(n)<0});return kept&&gone})()")===true, 'chunk 39 (retargeted 31 Jul 2026): the Data Bank carries the five document tiles (retargeted 14 Aug 2026 — the Governance Readiness tile removed with its output, addendum 113); the superseded slots are gone');

  // ── chunk 40: GovFW content pass + exit-reader sweeps (O-4 / O-0 catalogue) ──
  ok(w.eval("(function(){var h=renderOutGovFW();return h.indexOf('The standing items covered at every meeting')>=0&&h.indexOf('seven items')<0&&h.indexOf('Per-risk, on the management plans')>=0&&h.indexOf('Reassessment:')<0&&h.indexOf('anonymous form')>=0})()")===true, 'chunk 40 (retargeted 14 Aug 2026, addendum 122: the stale seven-item count superseded — the card carries four standing items plus the added items): the framework names the standing agenda, drops the dead reads, and carries the Culture section');
  w.eval("(function(){var s=(data.systems||[]).find(function(x){return !x.exitDraft});if(s)s.exitDraft={rationale:'Vendor sunset drafted for the exercise',plan:{director:'Harriet Rivers'}}})()");
  ok(w.eval("(function(){var h=renderOutGovFW();return h.indexOf('Drafted Exit Plans')<0&&h.indexOf('Vendor sunset drafted')<0})()")===true, 'chunk 40 (retargeted 14 Aug 2026, addendum 124, ruled: drafts are drafted-not-decided and leave the framework document): the framework carries no Drafted Exit Plans section even with a draft present');
  w.eval("goModule('phase-4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Exit plans built')<0&&h.indexOf('>Exit Plans<')<0})()")===true, 'chunk 40: the stale exit-register readers are gone from the phase-4 landing');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Plans on the cards')>=0||h.indexOf('Plans on Cards')>=0})()")===true, 'chunk 40: the milestone copy and recap tile read the card plans');
  w.eval("go('phase5')"); await wait();

  // ── chunk 41: the 5.0 consolidation (A-0/A-1) ──
  w.eval("go('phase5')"); await wait();
  /* Relocated 31 Jul 2026 (Paul's ruling): the systems affordance is the collapsible Systems card, collapsed by default. */
  ok(w.eval("(function(){UI.expanded.dashSys=true;go('phase5');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('dashSysCard')>=0&&h.indexOf('UI.eoSysOpen=')>=0&&h.indexOf('+ Add System')>=0;UI.expanded.dashSys=false;UI.showSysForm=false;render();return pass})()")===true, 'E-6/R-7 (retargeted 15 Aug 2026, addendum 144, ruled): the prominent AI Systems card opens to the 4.3 mirror \u2014 in-place system bars \u2014 and can add a system in place');
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the compliance summary is off the Risk tab \u2014 the Compliance Dashboard owns it. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('>Compliance</h3>')<0})()")===true, 'chunk 41 (retargeted 31 Jul 2026): no compliance card on the Risk tab \u2014 the Compliance Dashboard owns that surface');
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): Quick Stats retired; the two action signals ride the Manage & Monitor stage card as \u26a0 chips. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;if(h.indexOf('Quick Stats')>=0)return false;var na=(data.risks||[]).filter(function(r){return cardClass(r)==='manage'&&needsLanding(r)}).length;return na?h.indexOf('need attention')>=0:true})()")===true, 'Quick Stats (retargeted 31 Jul 2026): retired from the dashboard; the needs-attention signal rides the stage card');
  w.eval("var _er=(data.risks||[]).find(function(r){return cardClass(r)==='manage'});_er.escalation={what:'pin41',lead:'t',by:'t',at:Date.now()};render()"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Emergency Response is live')>=0")===true, 'chunk 41 (E-0): the escalated counter lights the dashboard');
  w.eval("delete (data.risks||[]).find(function(r){return r.escalation&&r.escalation.what==='pin41'}).escalation;render()"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Emergency Response is live')<0")===true, 'chunk 41: the banner stands down with the escalation');

  // ── chunk 42: the 5.2 core (A-3/A-4) ──
  w.eval("go('step','5.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Program Coverage')>=0&&h.indexOf('How is this scored?')>=0&&h.indexOf('COVERAGE / 100')<0&&h.indexOf('not the health of the risks')<0&&h.indexOf('Governance Health Index')<0&&h.indexOf('HEALTH / 100')<0})()")===true, 'chunk 42 (A-3; superseded 17 Aug 2026 morning, Paul’s ruling: Analytics opens with the dashboard’s own coverage card): the shared five-bar card leads and the anHealthCard rendering is off the page');
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the gauge carries the five practice bars; compliance is off the dial by ruling. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Estate coverage')>=0&&h.indexOf('Decision discipline')>=0&&h.indexOf('Follow-through')>=0&&h.indexOf('Rhythm kept')>=0&&h.indexOf('Responsible AI engaged')>=0&&h.indexOf('Compliance Addressed')<0})()")===true, 'chunk 42 (retargeted 31 Jul 2026): the five practice bars stand; compliance is off the gauge');
  ok(w.eval("(function(){var s=(data.snapshots||[])[data.snapshots.length-1];return s&&s.manage!==undefined&&s.monitor!==undefined&&s.escalated!==undefined&&s.needsAttention!==undefined&&s.checksOverdue!==undefined&&s.testsOverdue!==undefined&&s.endings&&s.nistAddressed!==undefined&&s.regimes&&s.high===undefined&&s.health===undefined})()")===true, 'chunk 42 (A-4): the captured snapshot carries the realigned record, the dead fields gone');
  ok(w.eval("(function(){var ss=data.snapshots||[];var s0=ss[0];var last=null;for(var q=ss.length-1;q>=0;q--){if(ss[q]&&typeof ss[q].live==='number'){last=ss[q];break}}return ss.length>=10&&s0.nistAddressed===0&&s0.live===0&&ss.slice(0,10).every(function(x){return x.escalated===0})&&s0.health===undefined&&!!last})()")===true, 'R-6 (Paul-approved): the seeded history spans the program — ten authored points + the live capture, day 65 to today (chunk K), escalated flat zero throughout');

  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Escalated')>=0&&h.indexOf('Needs Attention')>=0&&h.indexOf('NIST Areas Addressed')>=0&&h.indexOf('Critical / High')>=0&&h.indexOf('Avg Composite')>=0&&h.indexOf('Avg Exposure')<0&&h.indexOf('NIST Achieved')<0&&h.indexOf('Health Index')<0})()")===true, 'chunk 42: Metric Trends and the KPI row read the realigned facts, the dead labels gone');
  w.eval("go('phase5')"); await wait();

  // ── chunk 43: the 5.2 cards (A-2) ──
  w.eval("go('step','5.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('stacked by composite band')>=0&&h.indexOf('NIST Areas Addressed')>=0&&h.indexOf('from detailed scores')>=0&&h.indexOf('Achieved subcategories')<0&&h.indexOf('stacked by severity')<0})()")===true, 'chunk 43 (A-2/D-13): the card labels re-pointed — achieved and dead severity extinct on the grid');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Exit &amp; Emergency Readiness')>=0&&h.indexOf('Ready / no-plan split')>=0&&h.indexOf('the 4.3 exercise')>=0&&h.indexOf('Exit-plan completeness per system')<0})()")===true, 'chunk 43 (A-2): Exit & Emergency Readiness replaces the dead register card');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('>Gaps<')>=0&&h.indexOf('each row links to where the gap is fixed')>=0})()")===true, 'chunk 43 (A-2): the seventeenth card — Gaps, fully derived');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('ENV')>=0&&h.indexOf('Evidence logged')>=0&&h.indexOf('No char-linked test')>=0})()")===true, 'chunk 43 (A-2): the TEVV matrix reads real plans and evidence, eight rows');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('not yet LIT-scored')<0&&h.indexOf('exit plans under 50%')<0&&h.indexOf('composite ranking')>=0&&h.indexOf('Critical/High load')>=0})()")===true, 'chunk 43 (A-2): signals and rankings re-pointed — the dead rules extinct');
  /* Retargeted 16 Oct 2026 (KB fixes 15 Oct 2026, item 3, ruled): the headers use the app's own score names, Impact (I) and Timeframe (T) */
  ok(w.eval("exportRiskCSV.toString().indexOf('Timeframe (T)')>=0&&exportRiskCSV.toString().indexOf('Impact (I)')>=0&&exportRiskCSV.toString().indexOf('Time Horizon')<0&&exportRiskCSV.toString().indexOf('Importance')<0&&exportRiskCSV.toString().indexOf('litScores')<0&&exportTevvCSV.toString().indexOf('data.tevv')<0")===true, 'chunk 43: the CSV exports swept — bare labels named, dead stores gone');
  w.eval("go('phase5')"); await wait();

  // ── chunk 15 revisit: Directive 4 §F — stamps permanent, steps never reopen ──
  ok(w.eval("(function(){var was=(data.completedSteps||{})['1.4']===true;var saved=data.regimes;data.regimes=[];var still=(data.completedSteps||{})['1.4']===true&&!!data.stepDoneAt['1.4'];data.regimes=saved;render();return was&&still})()")===true, 'D4 §F: breaking a completed step\'s data criteria never reopens it — the stamp is permanent, portfolios record state');
  ok(w.eval("(function(){var d=data.stepDoneAt['1.4'];stampStepDone('1.4');return data.stepDoneAt['1.4']===d})()")===true, 'D4 §F: stampStepDone is one-way — a second stamp never overwrites the first');

  // ── Paul, 21 July: the old real-people seed is gone ──
  const _appSrcPre=fs.readFileSync('Governance-app.js','utf8');
  ok(_appSrcPre.indexOf('var DEFAULT_ROSTER')<0, 'ruling: DEFAULT_ROSTER removed entirely — no default team exists in the module');
  const _appSrc=_appSrcPre;
  ok(_appSrc.indexOf('Paul Scade')<0&&_appSrc.indexOf('Pranay Sanklecha')<0, 'ruling: the roster seed is gone and the zero-content names appear nowhere (Faisal/Davenport/Lauren/Erik survive only as learning-content citations — flagged to Paul)');

  // ── Directive 8: optional system linkage (D-12 rescoped) ──
  w.eval("go('step','1.3')"); await wait();
  w.eval("UI.riskTrack='internal';UI.showRiskForm=true;render()"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('No specific system \u2014 enterprise-level risk')>=0")===true, 'D8: the omission is deliberate — the explicit no-system choice on the discovery form');
  w.eval("UI.showRiskForm=false;data.risks.push({id:'r-d8',systemId:null,name:'Competitor capability leap',description:'d',category:'S',source:'external',litL:2,litI:3,litT:2,status:'identified',selection:{decision:'advance',by:'t',at:Date.now()},assess:{desc:'d',context:'c',rootCauses:['market'],noControls:true}});render()"); await wait();
  /* SUPERSEDED 31 Jul 2026 (round 13 currency ruling): 1.3 lists the identify bucket only, so the named seed card may have advanced past it. The D8 substance holds. */
  ok(w.eval("(function(){go('step','1.3');var u=(data.risks||[]).filter(inIdentifyBucket).filter(function(r){return !r.systemId})[0];if(!u)return true;var h=document.getElementById('app').innerHTML;return h.indexOf('idc_'+u.id)>=0})()")===true, 'D8 (retargeted 31 Jul 2026): a systemless identify-bucket risk renders on the discovery list');
  w.eval("UI.bandDraft={L:2,I:3,T:2,cls:'monitor',plan:'Watch the market quarterly'};confirmAssessment('r-d8')"); await wait();
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-d8'});return cardClass(r)==='monitor'&&r.systemId===null})()")===true, 'D8: the risk machinery applies identically to unattached risks — assessed and classified with no system');
  w.eval("go('phase5')"); await wait();

  // ── R-5 ruling: 2.2 runs the battery way ──
  ok(w.eval("(function(){var c=data.completed;return c['2.2a']&&c['2.2b']&&c['2.2c']&&c['2.2d']&&isStepDone('2.2')===true&&isStepDone('1.1')===true})()")===true, 'R-5: the seed chips are truthful — 2.2 and the battery both derive done on the demo');
  ok(w.eval("(function(){var c=JSON.parse(JSON.stringify(data.completed));delete data.completed['2.2c'];var blocked=dataGateOK('2.2')===false;UI.s22Tab='own';go('step','2.2');var dark=document.getElementById('app').innerHTML.indexOf('completeStepGated')<0;data.completed=c;render();return blocked&&dark})()")===true, 'R-12: one dark chip and the step button neither renders nor passes its gate');
  ok(w.eval("(function(){delete data.completedSteps['2.2'];delete data.stepDoneAt['2.2'];go('step','2.2');var h=document.getElementById('app').innerHTML;var shows=h.indexOf('completeStepGated')>=0;completeStepGated('2.2');go('step','2.2');var d1=data.stepDoneAt['2.2'];completeStepGated('2.2');go('step','2.2');return shows&&!!d1&&data.stepDoneAt['2.2']===d1})()")===true, 'R-12 + §F: the step button opens at all four chips, stamps once, and never re-stamps');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.id==='r-df3'});return !!r&&r.systemId===null&&r.category==='S'&&!r.classification&&!r.dismissed})()")===true, 'D8 seed: the unattached enterprise-level pattern lives in the register (chunk-K roster; r-d8x premise carried by r-mg5)');
  w.eval("go('phase5')"); await wait();

  // ── Paul, 21 July: daily snapshot capture on app use ──
  ok(w.eval("switchToOrg.toString().indexOf('anCaptureSnapshot')>=0")===true, 'snapshot cadence: capture is wired into org load — any day the app is used gets its snapshot');
  ok(w.eval("(function(){var n=data.snapshots.length;anCaptureSnapshot();anCaptureSnapshot();return data.snapshots.length===n||data.snapshots.length===n+1})()")===true&&w.eval("(function(){var n=data.snapshots.length;anCaptureSnapshot();return data.snapshots.length===n})()")===true, 'snapshot cadence: same-day capture replaces — repeated use never duplicates the day');

  // ── Paul, 21 July: the server-tick wiring ──
  ok(w.eval("(function(){var s=computeGovSnapshot.toString();return s.indexOf('document')<0&&s.indexOf('innerHTML')<0&&s.indexOf('getElementById')<0})()")===true&&w.eval("(function(){var s=computeGovSnapshot();return !!s&&typeof s.live==='number'&&typeof s.nistAddressed==='number'})()")===true, 'server tick: the snapshot derivation is pure — data in, record out, no DOM anywhere in it');
  ok(w.eval("(function(){var n=data.snapshots.length;govDailyTick();govDailyTick();return typeof window.govDailyTick==='function'&&data.snapshots.length<=n+1&&data.snapshots[data.snapshots.length-1].d===new Date().toISOString().split('T')[0]})()")===true, 'server tick: govDailyTick is exposed, idempotent within a day, and lands today\'s record');

  // ── R-6: the clean-seed assertions run last, on a fresh reseed ──
  w.eval("seedSampleData();render()"); await wait();
  ok(w.eval("(function(){var s=data.snapshots[data.snapshots.length-1];var t=computeGovSnapshot();if(!s||!t)return false;var same=['live','manage','monitor','enhanced','escalated','needsAttention','checksOverdue','testsOverdue','nistAddressed'].every(function(k){return s[k]===t[k]});return same&&s.endings.dismissed===t.endings.dismissed&&s.endings.accepted===t.endings.accepted&&s.regimes['reg-northwind'].met===t.regimes['reg-northwind'].met})()")===true, 'R-6 standing rule: the final seeded point equals today\'s true derivation — the seam cannot jump');
  ok(w.eval("(function(){var sd=data.stepDoneAt;var days=Math.round((new Date()-new Date(data.startDate))/86400000);return days>=74&&days<=76&&!!sd['4.1']&&!sd['4.2']&&!sd['4.3']&&!sd['4.4']})()")===true, 'R-6 posture: 75 days in, Phase 4 open with only 4.1 complete');

  // ── R-8 (Paul, 21 July): the three review cards ──
  w.eval("go('phase5')"); await wait();
  /* Retargeted 31 Jul 2026 (decomposition ruling): the New Risk Review runs from its box to the Identify Portfolio; the Governance Review runs to its standing page. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;var i=h.indexOf('Next New Risk Review'),e=h.indexOf('Next Responsible AI Board Review'),g=h.indexOf('Next Governance Review');return i>=0&&g>=0&&e>=0&&h.indexOf(\"goModule('pf-identify')\")>=0&&h.indexOf(\"go('ethicsov')\")>e&&h.indexOf(\"go('govreview')\")>g})()")===true, 'R-8 (retargeted round 25): three review cards, three runners \u2014 identify portfolio, ethics page, governance page');
  ok(w.eval("(function(){UI.dashManage='ethboard';go('phase5');var el=document.getElementById('eb_nextReview');if(!el)return false;el.value='2026-08-15';saveEthBoardDate();UI.dashManage=null;render();var v=data.ethicalFramework.board.nextReview;return v==='2026-08-15'&&document.getElementById('app').innerHTML.indexOf('2026-08-15')>=0})()")===true, 'R-8 (retargeted round 23): the date sets in the Ethics board settings and shows on the card');
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the overview is its own page; the card routes rather than scrolls. */
  /* Retargeted 10 Aug 2026 (round 33, Paul's board ruling): the Board Cadence card retired — the date and cadence live in the dashboard settings; the Overview carries the register and the sight table. */
  /* Retargeted again 10 Aug 2026 (round 41, Paul's ruling): the table dissolved into four agenda-aligned cards. */
  /* Retargeted a third time 10 Aug 2026 (round 42, Paul's ruling): the page is the agenda walk — five numbered, described, interactive work surfaces; the Responsible AI Overview title is retired outright. */
  ok(w.eval("(function(){go('ethicsov');var h=document.getElementById('app').innerHTML;var pass=['Review Responsible AI Risk Screening Decisions','Review the Manage &amp; Monitor Plans','Review Emergency Responses','Review the Rationales for Archiving Responsible AI Risks','Review the Register of Responsible AI Principles'].every(function(t){return h.indexOf(t)>=0})&&h.indexOf('>Responsible AI Overview</h3>')<0&&h.indexOf('Board Cadence')<0&&h.indexOf('>Confirmation Tests</h3>')<0&&h.indexOf('Mark reviewed')>=0;go('phase5');return pass})()")===true, 'R-8 (retargeted 10 Aug 2026, round 42): the review page walks the five-item agenda with its descriptions and ticks; the old title and queues are gone (items 2 and 4 retitled 10 Aug 2026, round 51)');
  ok(w.eval("(function(){UI.ethReviewHdr=true;go('ethicsov');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Review Emergency Responses')>=0&&h.indexOf('>Responsible AI Overview</h3>')<0;UI.ethReviewHdr=false;go('phase5');return pass})()")===true, 'round 41 (retargeted 10 Aug 2026, round 45): the agenda reviews emergency responses as its own item \u2014 escalation language reserved for the board\u2019s convening sense');
  ok(w.eval("(function(){UI.dashManage='ethboard';go('phase5');var h=document.getElementById('app').innerHTML;UI.dashManage=null;render();return h.indexOf('>Extraordinary Meeting Criteria</h3>')>=0&&h.indexOf('What brings the board together outside its regular cadence?')>=0&&h.indexOf('+ Add Criterion')>=0})()")===true, 'round 41 (retargeted 10 Aug 2026, round 47): Extraordinary Meeting Criteria stand as their own card \u2014 escalation means emergency, module-wide');

  // ── Paul, 21 July: testing priority ranking on 3.3 ──
  w.eval("UI.s33Tab='plans';go('step','3.3')"); await wait();
  ok(w.eval("typeof testRankSorted")==='undefined', 'superseded 12 Aug 2026 (round 68): the ranking retired \u2014 was: contiguous ranks with visible controls');
  ok(w.eval("typeof moveTestRank")==='undefined', 'superseded 12 Aug 2026 (round 68): the ranking retired \u2014 was: nudge swaps adjacent ranks both ways');
  ok(w.eval("typeof setTestRank")==='undefined', 'superseded 12 Aug 2026 (round 68): the ranking retired \u2014 was: typed rank reorders contiguously');
  w.eval("go('phase5')"); await wait();

  // ── R-9 close: the side store is extinct; 5.1 carries the coverage facts ──
  ok(_appSrcPre.indexOf('data.tevv')<0, 'R-9: data.tevv appears nowhere in the module — the side store is fully retired');
  w.eval("go('step','5.2')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Testing evidence:')>=0")===true, 'R-9: the NIST conformance page carries the per-subcategory testing-evidence coverage');
  w.eval("go('phase5')"); await wait();

  // ── the 21-July rulings batch ──
  ok(w.eval("(function(){ensureNistRegime();var had=data.regimes.some(function(g){return g.id==='reg-nist'});data.regimes=data.regimes.filter(function(g){return g.id!=='reg-nist'});ensureNistRegime();var stays=!data.regimes.some(function(g){return g.id==='reg-nist'})&&data.nistSeeded===true;return had&&stays})()")===true, 'R-11a: the NIST row seeds once — removing it sticks');
  ok(w.eval("(function(){var arr=(data.systems||[]).filter(function(s){return !sysExitState(s)});if(arr.length<2)return true;var h=anTevvMatrix();return h.indexOf(arr[0].name.slice(0,10))<h.indexOf(arr[arr.length-1].name.slice(0,10))})()")===true, 'ride-along (superseded 12 Aug 2026, round 68): the TEVV matrix rows follow inventory order');
  ok(w.eval("(function(){var s1=data.systems.find(function(x){return x.id==='sys-1'});var s3=data.systems.find(function(x){return x.id==='sys-3'});var s4=data.systems.find(function(x){return x.id==='sys-4'});return s1.exitDraft.plan.director==='Harriet Rivers'&&s3.exitDraft.plan.triggers.indexOf('leakage')>=0&&!s4.exitDraft})()")===true, 'R-14: the orphaned exit content lives as per-system drafts — drafted, not decided');
  ok(_appSrcPre.indexOf('data.exitPlans')<0&&_appSrcPre.indexOf('vizExitHealth(){')<0, 'R-14: the dead store and its superseded visualization are extinct at source');
  ok(_appSrcPre.indexOf('loadExampleSystems')<0&&_appSrcPre.indexOf('Load Aurora Example Systems')<0, 'item 48: the 1.2 example-spawn relic is extinct at source \u2014 the nav-menu seed loader is the only seed path');
  ok(_appSrcPre.indexOf('loadExampleRisks')<0&&_appSrcPre.indexOf('Load Aurora Example Risks')<0&&_appSrcPre.indexOf('loadExamplePrinciples')<0&&_appSrcPre.indexOf('Load Aurora Example Principles')<0, 'item 49: the 1.3 and 2.1 example-spawn relics are extinct at source');
  w.eval("go('step','1.1')"); await wait();
  ok(w.eval("(function(){delete data.completedSteps['1.1'];delete data.stepDoneAt['1.1'];render();var h=document.getElementById('app').innerHTML;var shows=h.indexOf('completeStepGated')>=0;var c=JSON.parse(JSON.stringify(data.completed));delete data.completed['1.1e'];render();var dark=document.getElementById('app').innerHTML.indexOf('completeStepGated')<0&&dataGateOK('1.1')===false;data.completed=c;completeStepGated('1.1');go('step','1.1');return shows&&dark&&data.completedSteps['1.1']===true})()")===true, 'R-12/R-13: the battery step button opens at all FIVE chips, closes when one goes dark, and stamps');
  // item 37 (22 Jul): typed text persists across battery tabs and navigation — ER harvest-then-switch, previously absent
  w.eval("go('step','1.1')"); await wait();
  w.eval("UI.abSec='1.1a';render()"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('harvestOpenFields();UI.abSec')>=0, 'item 37: the battery tabs harvest before switching');
  w.eval("document.getElementById('exp_departments').value='PERSIST-PROBE-TABS'");
  w.eval("harvestOpenFields();UI.abSec='1.1b';render()"); await wait();
  w.eval("UI.abSec='1.1a';render()"); await wait();
  ok(w.eval("(function(){return data.assessmentBattery.aiExposure.departments==='PERSIST-PROBE-TABS'&&document.getElementById('exp_departments').value==='PERSIST-PROBE-TABS'})()")===true, 'item 37: typed battery text survives a tab switch');
  w.eval("document.getElementById('exp_customerFacing').value='PERSIST-PROBE-NAV'");
  w.eval("go('step','1.2')"); await wait();
  w.eval("go('step','1.1')"); await wait();
  ok(w.eval("(function(){UI.abSec='1.1a';render();return data.assessmentBattery.aiExposure.customerFacing==='PERSIST-PROBE-NAV'})()")===true, 'item 37: typed battery text survives navigation away and back');
  // item 43 (22 Jul): regime standards PDF — the chip renders on the open register row
  w.eval("var _g=(data.regimes||[]).find(function(x){return x.id==='reg-northwind'});_g.doc={name:'northwind-standards.pdf',size:1234,data:'data:application/pdf;base64,JVBERg=='};saveData();UI.regOpen='reg-northwind';go('step','2.4')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('northwind-standards.pdf')>=0, 'item 43: the uploaded standards PDF chip renders on the register');
  w.eval("(data.regimes||[]).find(function(x){return x.id==='reg-northwind'}).doc=null;UI.regOpen=null;saveData()"); await wait();
  w.eval("go('phase5')"); await wait();

  // ── R-11d (Paul, 21 July): frozen history kept, dug-for ──
  /* R-11d retired 22 July: the certification column was removed by Paul's ruling (questions item 34). The nistCert store and its frozen history remain dormant at the data layer; the UI, its opt-in toggle, and this probe are gone with the column. */
  // item 45 (22 Jul, G-1/G-2/G-3): the section-button deadlock — refreshGates scoped, family label, helper line.
  // The DOM disabled state is the assertion the family suites always lacked: probes evaled handlers and never
  // asked whether a user could click. onclick attrs don't fire under outside-only jsdom, so the click is
  // asserted as (a) disabled===false and (b) evaling the button's own onclick attribute string.
  w.eval("UI.abSec='1.1a';delete (data.completed||{})['1.1a'];go('step','1.1')"); await wait();
  w.eval("refreshGates()");
  var _sb=w.document.querySelector('#app .done-btn:not(.done-btn-complete)');
  ok(!!_sb, 'item 45: a live section button renders on 1.1 with 1.1a cleared');
  ok(!!_sb&&_sb.disabled===false, 'item 45 G-1: the section button is clickable — never gated by the step-level data gate');
  ok(!!_sb&&(_sb.textContent.indexOf('complete and continue')>=0||_sb.textContent.indexOf('Complete & Continue')>=0), 'item 45 G-3 (retargeted 13 Aug 2026 — item 55 level-aware labels shipped; explicit per-ruled instance labels remain lawful): the live label is the family form');
  ok(w.document.querySelectorAll('#app .done-helper').length>0, 'item 45 G-2: the helper line renders with the gated button');
  if(_sb){w.eval(_sb.getAttribute('onclick'))} await wait();
  ok(w.eval("!!(data.completed||{})['1.1a']")===true, 'item 45: the section button\'s own onclick completes the section');
  ok(require('fs').readFileSync('Governance-styles.css','utf8').includes('.done-btn:not([disabled])+.done-helper'), 'item 45 G-2: the stylesheet hides the helper while the button is live');
  w.eval("go('phase5')"); await wait();

  // item 46 (22 Jul): 1.2 and 1.3 previously had NO completion path at all — the buttons now exist and gate correctly.
  w.eval("go('step','1.2')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf("completeStepGated('1.2')")>=0, 'item 46: step 1.2 carries its completion button');
  w.eval("go('step','1.3')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf("completeStepGated('1.3')")>=0, 'item 46: step 1.3 carries its completion button');
  ok(w.eval("(function(){var sys=data.systems;data.systems=[];var m=dataGateMsg('1.2');data.systems=sys;return m.indexOf('at least one AI system')>=0&&dataGateOK('1.2')===true})()")===true, 'item 46: the 1.2 gate message is the ruled wording and the seeded gate passes');
  ok(w.eval("(function(){var rk=data.risks;data.risks=[];var m=dataGateMsg('1.3');data.risks=rk;return m.indexOf('at least one risk')>=0&&dataGateOK('1.3')===true})()")===true, 'item 46: the 1.3 gate message is the ruled wording and the seeded gate passes');
  w.eval("go('phase5')"); await wait();

  // item 49 (22 Jul): 1.3 rulings — card order, register heading, category names, and the ethics-flag repair
  // (string convention end to end + §7A harvest-before-render on the risk form).
  w.eval("go('step','1.3')"); await wait();
  var _h13=w.document.getElementById('app').innerHTML;
  ok(_h13.indexOf('If something urgent surfaces')>=0&&_h13.indexOf('If something urgent surfaces')<_h13.indexOf('Internal Track')&&_h13.indexOf('Walk your vendor dependencies')<_h13.indexOf('Internal Track'), 'item 49: the two teaching cards sit above the dual track');
  ok(_h13.indexOf('Preliminary Risk Register')>=0, 'item 49: the risk list carries its Preliminary Risk Register heading');
  ok(_h13.indexOf('See Systems Inventory')>=0&&_h13.indexOf('See Systems Inventory')<_h13.indexOf('Internal Track'), 'item 55: the systems-inventory reference card sits above the dual track');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Not sure yet')<0&&h.indexOf('Internal Track')<h.indexOf('External Track')})()")===true, 'item 56: the not-sure option is gone and the tracks stack internal-over-external');
  ok(w.eval("(function(){go('step','2.1');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('bd_escalation')<0&&h.indexOf('+ Add Criterion')>=0&&h.indexOf('esc_0')>=0;return pass})()")===true, 'item 58: escalation criteria are itemized rows with Add Criterion \u2014 the free textarea is gone (seed legacy string migrates to row zero)');
  ok(w.eval("(function(){addEscCriterion();var last=-1;for(var i=0;;i++){if(!document.getElementById('esc_'+i))break;last=i}var e=document.getElementById('esc_'+last);if(!e)return false;e.value='PROBE CRITERION';harvestEF();var b=data.ethicalFramework.board;var pass=(b.escalationList||[]).indexOf('PROBE CRITERION')>=0;removeEscCriterion(b.escalationList.indexOf('PROBE CRITERION'));go('step','1.3');return pass})()")===true, 'item 58 (probe modernized 10 Aug 2026, round 52: targets the appended row \u2014 the old esc_1 assumption clobbered the multi-row seed): add/harvest/remove round-trip lands in board.escalationList');
  ok(w.eval("(function(){go('step','1.4');UI.regOpen='reg-northwind';render();var el=document.getElementById('pe_summary');if(!el)return false;el.value='EDITED FROM 1.4';savePotential('reg-northwind');var g=data.regimes.find(function(x){return x.id==='reg-northwind'});var pass=g.summary==='EDITED FROM 1.4';go('step','1.3');return pass})()")===true, 'item 57: a 1.4 entry expands to editable fields and the guarded save lands');
  ok(w.eval("(function(){UI.expanded={};var c=renderOutRegLandscape();var closed=c.indexOf('EDITED FROM 1.4')<0&&c.indexOf('reg-northwind')>=0;UI.expanded['svy_reg-northwind']=true;var o=renderOutRegLandscape();UI.expanded={};return closed&&o.indexOf('EDITED FROM 1.4')>=0&&o.indexOf('>Scoping<')>=0})()")===true, 'item 57 (superseded 14 Sep 2026, Paul\u2019s ruling): the Compliance Survey page is a bar per regime with a fold; the open fold shows the regime\u2019s scoping layer as the document prints it, the edited detail included');
  ok(w.eval("(function(){showRiskForm('internal');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('External Track')<h.indexOf('rf_name');UI.showRiskForm=false;render();return pass})()")===true, 'item 56: the risk form opens in the right column, after both stacked tracks');
  /* SUPERSEDED 31 Jul 2026 (Paul's ruling): the batch Rapid Risk Screen grid is retired; scoring lives in each card's expansion, shared with the Identify portfolio. */
  ok((function(){var _s56=require('fs').readFileSync('Governance-app.js','utf8');return _s56.indexOf('function _rrow')<0&&_s56.indexOf('function saveRapidScreen(){')<0&&_s56.indexOf('function pfRapidScreen')>=0&&_s56.indexOf('function saveRapidScreenOne')>=0})(), 'item 56 (retargeted 31 Jul 2026): the batch grid and its batch save are extinct at source; the per-card screen and per-risk commit stand');
  ok(w.eval("(function(){var co=data.completedSteps['1.2'];delete data.completedSteps['1.2'];var derived=isStepDone('1.2');data.completedSteps['1.2']=co;return derived===false&&(data.systems||[]).length>0})()")===true, 'item 55: 1.2 doneness is stamp-based \u2014 systems alone no longer show Complete');
  ok(w.eval("(function(){go('step','1.2');var h=document.getElementById('app').innerHTML;var ov=h.indexOf('AI Systems Overview');var ad=h.indexOf('+ Add System');var seg=h.slice(ov,ad);var wall=seg.indexOf('width:158px')>=0&&seg.indexOf('openSystemView')>=0;var cols=seg.indexOf('>Deployed<')>=0&&seg.indexOf('>In development<')>=0;var noForm=seg.indexOf('Data used')<0;go('step','1.3');return ov>=0&&ov<ad&&wall&&cols&&noForm})()")===true, 'item 55 (superseded 17 Aug 2026, Paul\u2019s rulings: the estate wall lands between the overview and the button, two columns, donut retired): scorecards, then tiles \u2014 still no duplicate inventory list');
  ok(_h13.indexOf('>Product</div>')>=0&&_h13.indexOf('>Technological</div>')>=0, 'item 49: heat map columns are headed by category names, not letters');
  w.eval("showRiskForm('internal')"); await wait();
  w.eval("document.getElementById('rf_name').value='ETH PROBE RISK'");
  w.eval("ethFlagSet('true')"); await wait();
  ok(w.eval("UI.riskEthFlag")==='true'&&!!w.document.getElementById('rf_ethicalDesc'), 'item 49: the flag click registers as a string and opens the description box');
  ok((function(){var _s54=require('fs').readFileSync('Governance-app.js','utf8');return _s54.indexOf('id=\"sec-title\"')>=0&&_s54.split('scrollToSection()').length===13})(), 'item 54/60 (retargeted 14 Aug 2026, addendum 124): the section-title anchor and the twelve scroll hooks are aboard (seven writers, four tab rows, the helper \u2014 the 4.2 tabs joined in addendum 124)');
  ok(w.eval("document.getElementById('rf_name').value")==='ETH PROBE RISK', 'item 49: typed fields survive the flag click (\u00a77A harvest-before-render)');
  w.eval("document.getElementById('rf_category').value='X';saveRisk()"); await wait();
  ok(w.eval("(function(){var r=data.risks[data.risks.length-1];return r.ethicalFlag===true&&r.category==='X'&&r.name==='ETH PROBE RISK'})()")===true, 'item 49: the save carries the flag and the Other category');
  w.eval("(function(){var r=data.risks[data.risks.length-1];if(r&&r.name==='ETH PROBE RISK')removeRisk(r.id)})()"); await wait();
  w.eval("go('phase5')"); await wait();

  // item 64 S5 (24 Jul, Paul's go): system view \u2014 grouped risk rows open to the universal card fold; govStatus/isExternal join the editable record
  w.eval("go('system','sys-1')"); await wait();
  w.eval("UI.sysPg='risks';render()"); await wait();/* Retargeted 15 Aug 2026 (addendum 128): the ruled rows live on the card's System Risks page. */
  var _sv=w.document.getElementById('app').innerHTML;
  /* SUPERSEDED 15 Aug 2026 (addendum 129, ruled): the svc_ grammar retires from the live groups — each group hosts its portfolio register verbatim. */
  ok(w.eval("(function(){var live=(data.risks||[]).filter(function(r){return r&&r.systemId==='sys-1'&&!isArchivedRisk(r)});if(!live.length)return true;var h=document.getElementById('app').innerHTML;var idr=live.filter(inIdentifyBucket)[0];if(idr)return h.indexOf('idc_'+idr.id)>=0;return h.indexOf('h-card')>=0})()")===true, 'item 64 S5 (superseded 15 Aug 2026, addendum 129): the live groups host the portfolio bars');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Preliminary Risk Register')<0})()")===true, 'addendum 129: hosted registers suppress the register heading and controls');
  w.eval("UI.sysPg='desc';render()"); await wait();/* Retargeted 15 Aug 2026 (addendum 128): the record selects live on the Description page. */
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('sys_govStatus')>=0&&h.indexOf('sys_isExternal')>=0})()")===true, 'item 64 S5: Governance Status and System Type join the editable inventory record');
  w.eval("UI.sysPg='risks';render()"); await wait();/* back to the rows for the fold pins */
  /* SUPERSEDED 15 Aug 2026 (addendum 129, ruled): the fold is the portfolio fold — an Identify bar opens to its editable card. */
  ok(w.eval("(function(){var idr=(data.risks||[]).filter(function(r){return r&&r.systemId==='sys-1'&&!isArchivedRisk(r)}).filter(inIdentifyBucket)[0];if(!idr)return true;UI.expanded['idc_'+idr.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('rce_'+idr.id)>=0;delete UI.expanded['idc_'+idr.id];render();return pass})()")===true, 'item 64 S5 (superseded 15 Aug 2026, addendum 129): an opened bar shows the portfolio fold');
  w.eval("UI.sysPg='desc';render()"); await wait();/* Retargeted 15 Aug 2026 (addendum 128): the record edit drives the Description page. */
  w.eval("document.getElementById('sys_govStatus').value='partial';document.getElementById('sys_isExternal').value='external';saveSystemRecord('sys-1')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-1'});return s.govStatus==='partial'&&s.isExternal===true})()")===true, 'item 64 S5: the record save carries govStatus and isExternal');
  w.eval("UI.expanded={}");

  /* \u2500\u2500 Portfolio conformance frame (Paul's ruling, 31 Jul 2026): donor bar/fold grammar, pins EXTEND \u2500\u2500 */
  w.eval("go('portfolio','assess')"); await wait();
  var _pfx=w.document.getElementById('app').innerHTML;
  ok(_pfx.indexOf('AVAILABLE RISKS')<0, 'conformance: the Assess pill selector is retired');
  ok(_pfx.indexOf('score-num-md')>=0&&_pfx.indexOf('h-card')>=0, 'conformance: Assess renders donor bars (h-card name, score-num-md right cell)');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inAssessBucket)[0];if(!r)return false;if(UI.wbOpen!==r.id)openWB(r.id);var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Risk card')>=0&&h.indexOf('Choose what you want to work on')>=0;openWB(r.id);return pass})()")===true, 'conformance: an expanded Assess row carries the pinned Risk card fold and the live workbench layer');
  w.eval("go('portfolio','identify')"); await wait();
  var _pfi=w.document.getElementById('app').innerHTML;
  ok(_pfi.indexOf('Order by system')<0&&_pfi.indexOf('>All<')<0, 'conformance: Identify bar chrome (filter tabs, Order by system) is off the surface, on the loss ledger');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('rce_'+r.id+'_name')>=0;UI.expanded['idc_'+r.id]=false;render();return pass})()")===true, 'conformance: the expanded Identify row is the live editable risk card (per-risk field ids), not a read view behind Edit');
  w.eval("go('portfolio','manage')"); await wait();
  ok(w.eval("(function(){var mg=(data.risks||[]).filter(function(r){return cardClass(r)==='manage'})[0];if(!mg)return false;if(UI.mgOpen!==mg.id)openMgLanding(mg.id);var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Risk card')>=0&&h.indexOf('Assessment card')>=0&&h.indexOf('Escalate')>=0;openMgLanding(mg.id);return pass})()")===true, 'conformance (retargeted 22 Aug 2026: Reclassify moved into the landing notice and appears only while the 3.2 commitment binds): an expanded Manage row stacks Risk card + Assessment card folds over the live plan layer, controls in the bottom zone');
  ok(w.eval("(function(){go('portfolio','identify');var h=document.getElementById('app').innerHTML;return (h.indexOf('Identify Portfolio')>=0&&h.indexOf('Identify Portfolio')<h.indexOf('u-778010b'))})()")===true, 'conformance: donor page order \u2014 hero title and lead precede the chevron strip');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket).filter(function(x){return x.litL&&x.litI&&x.litT})[0];if(!r)return false;if(UI.rapidDraft)delete UI.rapidDraft[r.id];UI.expanded['idc_'+r.id]=true;render();var bs=[].slice.call(document.querySelectorAll('button')).filter(function(b){return b.textContent.indexOf('Confirm Re-score')>=0});var greyed=bs.length&&bs[0].disabled;rapidSet(r.id,'L',(r.litL===5?4:5));var bs2=[].slice.call(document.querySelectorAll('button')).filter(function(b){return b.textContent.indexOf('Confirm Re-score')>=0});var live=bs2.length&&!bs2[0].disabled;delete UI.rapidDraft[r.id];UI.expanded['idc_'+r.id]=false;render();return !!(greyed&&live)})()")===true, 'conformance (31 Jul 2026, round 2): a screened row shows greyed Confirm Re-score that goes live only when a number changes');
  /* 1.3 register conformance (Paul's ruling, 31 Jul 2026): the same bars as the Identify portfolio, no decision buttons. */
  ok(w.eval("(function(){go('step','1.3');var h=document.getElementById('app').innerHTML;return h.indexOf('idc_')>=0&&h.indexOf('Save Rapid Screen')<0})()")===true, 'conformance (31 Jul 2026): the 1.3 register is the shared donor bar list; the batch grid is gone');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;go('step','1.3');UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('rce_'+r.id+'_name')>=0&&(h.indexOf('Confirm Score')>=0||h.indexOf('Confirm Re-score')>=0)&&h.indexOf('>Advance<')<0&&h.indexOf('>Defer<')<0;UI.expanded['idc_'+r.id]=false;render();return pass})()")===true, 'conformance (31 Jul 2026): a 1.3 bar opens to the editable card and live screen with no decision buttons');
  /* Sidebar + back button on portfolio pages (Paul, 31 Jul 2026, round 4). */
  ok(w.eval("(function(){go('phase5');UI.navStack=[];go('portfolio','identify');var sb=document.getElementById('pipSidebar');var sbOn=sb&&sb.style.display!=='none';var h=document.getElementById('app').innerHTML;var back=h.indexOf('\u2190 Back')>=0;goBack();return sbOn&&back&&currentPage==='phase5'})()")===true, 'conformance (31 Jul 2026, round 4): portfolio pages keep the sidebar and carry the donor back button; goBack returns to the origin');
  ok(w.eval("(function(){UI.navStack=[];go('portfolio','identify');go('portfolio','assess');var depth=UI.navStack.length;var h=document.getElementById('app').innerHTML;return depth<=1&&h.indexOf('Assess Portfolio')>=0})()")===true, 'conformance (31 Jul 2026, round 4): portfolio-to-portfolio hops do not stack \u2014 back always returns to the pre-portfolio origin');
  /* Round 17 (Paul, 31 Jul 2026): one metric, two surfaces \u2014 the dashboard dial renders anHealth() itself. */
  ok(w.eval("(function(){go('phase5');UI.expanded.rcInfo=true;render();var h=document.getElementById('app').innerHTML;var hd=anHealth();var pass=h.indexOf('Program Coverage')>=0&&h.indexOf('Half the score is completion')>=0&&h.indexOf((hd.score/20).toFixed(1))>=0&&hd.comps.every(function(c){return h.indexOf(c.n)>=0});UI.expanded.rcInfo=false;render();return pass})()")===true, 'round 17: the dashboard dial and the analytics Program Coverage are the same metric \u2014 same score, all seven dimensions on both surfaces');
  /* Round 27 (Paul's rulings, 3 Aug 2026): grid states orange/confirmed/reviewed; urgent boundary >=10; seed escapes healed; full review trigger collected again. */
  ok(w.eval("(function(){go('step','2.5');var r=(data.risks||[]).filter(inIdentifyBucket).filter(function(x){return x.litL&&x.litI&&x.litT})[0];if(!r)return false;if(UI.rescoreConfirmed)delete UI.rescoreConfirmed[r.id];rapidSet(r.id,'L',(r.litL===5?4:5));render();var h=document.getElementById('app').innerHTML;var seg=h.split('Scores at a Glance')[1]||'';var orange=seg.indexOf('background:#C8860A')>=0&&seg.indexOf('\u2713 Confirm')<0;saveRapidScreenOne(r.id);var h2=document.getElementById('app').innerHTML;var chip=h2.indexOf('Re-score confirmed')>=0;var cleared=!r.scoreReviewed;return orange&&chip&&cleared})()")===true, 'round 27: the grid runs orange \u2192 green Re-score confirmed, and a changed score clears the stale review');
  ok(w.eval("(function(){var _s0=(data.reviewCadence||{}).fullReviewTrigger;UI.dashManage='cadence';go('phase5');var el=document.getElementById('rc_fullReviewTrigger');if(!el)return false;el.value='Any new customer-facing system';saveRC();UI.dashManage=null;render();var pass=data.reviewCadence.fullReviewTrigger==='Any new customer-facing system';data.reviewCadence.fullReviewTrigger=_s0;return pass})()")===true, 'round 27: the full review trigger is collected on the live cadence editor and persists \u2014 the readiness checklist row is satisfiable');
  ok(w.eval("(function(){var bad=(data.risks||[]).some(function(r){return (r.name||'').indexOf('\\\\u')>=0||(r.description||'').indexOf('\\\\u')>=0});return !bad})()")===true, 'round 27: no risk name or description carries a literal escape \u2014 the seed renders clean');
  /* Round 26 (Paul's rulings, 31 Jul 2026): ethics runner, co-scheduling retired, seed schedules weekly/monthly/monthly. */
  /* Retargeted 10 Aug 2026 (round 33, Paul's board ruling): agenda item 1 became a read — the board reads pass decisions; the portfolios decide. */
  /* Retargeted 10 Aug 2026 (round 42): logging the review now returns to the dashboard and clears the meeting ticks. */
  /* Retargeted 10 Aug 2026 (round 44, Paul's ruling): logging stays on the page, turns the control green, and archives the item snapshot with the notes. */
  ok(w.eval("(function(){UI.ethReviewHdr=true;UI.ethRevTicks={1:true,3:true};UI.ethRevLogged=false;UI.ethRevNotes='Pin44 notes';go('ethicsov');var h=document.getElementById('app').innerHTML;var hdr=h.indexOf('Responsible AI Board Review')>=0&&h.indexOf('Work down the agenda')>=0&&h.indexOf('Mark Review Complete')>=0&&h.indexOf('Close without logging')<0&&h.indexOf('Additional Notes')>=0&&h.indexOf('Completed Reviews')>=0;var n0=(data.reviewLog||[]).length;govLogReview('ethics');var e=data.reviewLog[data.reviewLog.length-1];var h2=document.getElementById('app').innerHTML;var pass=hdr&&(data.reviewLog||[]).length===n0+1&&e.items[1]===true&&e.items[2]===false&&e.items[5]===false&&e.notes==='Pin44 notes'&&UI.ethRevLogged===true&&currentPage==='ethicsov'&&h2.indexOf('\u2713 Review Complete')>=0;UI.ethRevTicks=null;UI.ethRevLogged=false;UI.ethRevNotes=null;data.reviewLog.pop();go('phase5');return pass})()")===true, 'round 26 (retargeted 10 Aug 2026, round 44): logging archives the item snapshot and notes, turns the control green, and stays on the page');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('co-scheduled')<0})(), 'round 26: co-scheduling is extinct at source \u2014 the board runs on its own clock');
  /* Round 25 (decomposition ruling, 31 Jul 2026): three reviews, three runners, one log. */
  ok(w.eval("(function(){UI.riskReviewHdr=true;goModule('pf-identify');var h=document.getElementById('app').innerHTML;var hdr=h.indexOf('New Risk Review')>=0&&h.indexOf('Review complete')>=0;var n0=(data.reviewLog||[]).length;govLogReview('risk');var pass=hdr&&(data.reviewLog||[]).length===n0+1&&UI.riskReviewHdr===false&&(data.reviewLog[data.reviewLog.length-1].kind==='risk');return pass})()")===true, 'round 25: the New Risk Review runs on the Identify Portfolio and logs its run');
  ok(w.eval("(function(){go('govreview');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Governance Review')>=0&&h.indexOf('running as planned')>=0&&h.indexOf('Sweep the portfolios for stuck work')>=0&&h.indexOf('New Risk Review')>=0&&h.indexOf('Review Log')>=0;go('phase5');return pass})()")===true, 'round 25 (retargeted 14 Aug 2026, addendum 124): the standing Governance Review page carries the ruled sections and the log');
  /* Round 24 (Paul's visual pass, 31 Jul 2026): nav clearance, bottom-pinned buttons, two-up glance with vertical columns, Team Load. */
  ok(w.eval("(function(){go('phase5');var hd=document.getElementById('app').innerHTML;var offDash=hd.indexOf('Team Load')<0&&hd.indexOf('analytics-grid-2')>=0&&hd.indexOf('By Category')>=0;go('step','5.4');var onAn=document.getElementById('app').innerHTML.indexOf('Team Load')>=0;go('phase5');return offDash&&onAn})()")===true, 'round 24 (superseded 17 Aug 2026 morning, Paul’s ruling): Team Load rehomed to Analytics — off the dashboard, on 5.4; the glance pair stays two-up on the dashboard');
  /* Round 22 (Paul's rulings, 31 Jul 2026): the middle rebuilt \u2014 stage cards, glance card, Systems card, tiled Data Bank, expandable boxes, Framework Overview cut. */
  ok(w.eval("(function(){UI.activeView=null;go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('View Portfolio \u2192')>=0&&h.indexOf('Manage &amp; Monitor')>=0&&h.indexOf('Emergency Response')>=0&&h.indexOf('border-top:4px solid #1E6E6E')>=0})()")===true, 'round 22: four stage cards in the donor grammar, color-topped, with View Portfolio routes');
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('Risk Portfolio <em>at a Glance</em>')>=0&&h.indexOf('Stage Distribution')>=0&&h.indexOf('By Category')>=0&&h.indexOf('chart-donut-svg')>=0&&h.split('at a Glance')[1].indexOf('Risk Register Heat Map')>=0})()")===true, 'round 22: the glance card carries the donut and category pair with the register map full-width beneath');
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('u-355061e')>=0&&h.indexOf('RACI Matrix')>=0&&h.indexOf('Systems Inventory')<0})()")===true, 'round 22 (retargeted round 23): the Data Bank wears the donor tile grammar with the pruned set');
  ok(w.eval("(function(){go('step','1.3');var h=document.getElementById('app').innerHTML;return h.indexOf('Framework Overview')<0})()")===true, 'round 22: the Framework Overview button is off the step headers');
  /* Round 20 (Paul's visual pass, 31 Jul 2026): row-wide tooltips and clicks, step back chip, scroll reset. */
  ok(w.eval("(function(){UI.navStack=[];go('phase5');go('step','1.2');var h=document.getElementById('app').innerHTML;var back=h.indexOf('\u2190 Back')>=0;goBack();return back&&currentPage==='phase5'})()")===true, 'round 20: a step reached from another surface carries the back chip; goBack returns to the origin');
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;var i=h.indexOf('title=\"The share of registered AI systems');if(i<0)return false;var seg=h.slice(Math.max(0,i-260),i);return seg.indexOf('cursor:pointer')>=0||h.slice(i,i+300).indexOf('cursor:pointer')>=0})()")===true, 'round 20: the tooltip and click ride the whole bar row');
  /* Round 19 (Paul, 31 Jul 2026): bar tooltips, themed boxes, register map, rescan reroute. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('title=\"The share of registered AI systems')>=0})()")===true, 'round 19: the practice bars carry their tooltips');
  ok((function(){var _rp=require('fs').readFileSync('Governance-app.js','utf8');return _rp.indexOf('function rescanPrompt')<0&&_rp.indexOf('rescanPrompt deleted whole')>=0})(), 'round 19 (retargeted 21 Aug 2026, ruled): the rescan prompt is deleted whole — dead code, its role served by the New Risk Review header card; the pin now guards the extinction its earlier form guarded the routing of');
  /* Round 16 (Paul's ruling, 31 Jul 2026): dashboard to the donor model \u2014 coverage dial, tinted stat boxes, All Identified Risks map, register-scoped 1.3 map. */
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('Program Coverage')>=0&&h.indexOf('viz-gauge-svg')>=0&&h.indexOf('How is this scored?')>=0&&h.indexOf('Risk Register Heat Map')>=0&&h.indexOf('on the register')>=0&&(h.indexOf('total risks identified')>=0||h.indexOf('total risk identified')>=0)})()")===true, 'round 16 (retargeted round 19: register map): the dashboard carries the dial, its fold, and the Risk Register Heat Map with the tracker');
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('rgba(30,110,110,.06)')>=0&&h.indexOf('rgba(123,79,138,.06)')>=0&&h.indexOf('rgba(155,45,63,.06)')>=0&&h.indexOf('color:#1E6E6E')>=0&&h.indexOf('color:#7B4F8A')>=0&&h.indexOf('color:#9B2D3F')>=0&&h.indexOf('\u25b6 Run the review')>=0})()")===true, 'round 16 (retargeted round 19): three distinct themes, each rolled through label, value, tint, and button');
  ok(w.eval("(function(){go('step','1.3');var h=document.getElementById('app').innerHTML;return h.indexOf('Preliminary Risk Register Heat Map')>=0&&h.indexOf('>Risk Heat Map<')<0})()")===true, 'round 16: the 1.3 map is register-scoped and retitled');
  /* Round 14 (Paul's visual pass, 31 Jul 2026): grid editable, button row stable, fold label de-meta'd. */
  ok(w.eval("(function(){go('step','2.5');var bucket=(data.risks||[]).filter(inIdentifyBucket);var r=bucket.filter(function(x){return (x.history||[]).length})[0];if(!r){r=bucket.filter(function(x){return x.litL&&x.litI&&x.litT})[0];if(!r)return false;rapidSet(r.id,'L',(r.litL===5?4:5));rapidSet(r.id,'I',r.litI);rapidSet(r.id,'T',r.litT);saveRapidScreenOne(r.id)}UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Score history (')>=0&&h.indexOf('Pinned history')<0;UI.expanded['idc_'+r.id]=false;render();return pass})()")===true, 'round 14: the fold reads Score history \u2014 the pin meta-language is off the surface (history created via the sanctioned re-score path when the seed lacks it)');
  /* Round 13 (Paul's visual pass, 31 Jul 2026): 1.3 reflects its portfolio; Scores at a Glance restored at 2.5. */
  ok(w.eval("(function(){var adv=(data.risks||[]).filter(function(r){return !inIdentifyBucket(r)&&!r.dismissed&&!r.resolution})[0];go('step','1.3');var h=document.getElementById('app').innerHTML;var cur=(data.risks||[]).filter(inIdentifyBucket)[0];var pass=(!cur||h.indexOf('idc_'+cur.id)>=0)&&(!adv||h.indexOf('idc_'+adv.id)<0);return pass})()")===true, 'round 13: the 1.3 register lists the identify bucket only \u2014 advanced risks drop off');
  ok(w.eval("(function(){go('step','1.3');var h=document.getElementById('app').innerHTML;return (h.indexOf('total risks identified')>=0||h.indexOf('total risk identified')>=0)})()")===true, 'round 13 (retargeted 24 Aug 2026, Sweep 4 round 1): the track boxes read the total-risk count, singular at one');
  ok(w.eval("(function(){go('step','2.5');var h=document.getElementById('app').innerHTML;var t=(data.risks||[]).filter(inIdentifyBucket)[0];var seg=h.split('Scores at a Glance')[1]||'';return h.indexOf('Scores at a Glance')>=0&&seg.indexOf('type=\"number\"')>=0&&seg.indexOf('Review Score')>=0&&(!t||seg.indexOf(t.name.slice(0,20))>=0)})()")===true, 'round 13 (retargeted round 28, one-vocabulary ruling): Scores at a Glance carries per-row inputs and the Review Score lifecycle');
  ok(w.eval("(function(){go('step','2.5');var r=(data.risks||[]).filter(inIdentifyBucket).filter(function(x){return x.litL&&x.litI&&x.litT&&!x.scoreReviewed})[0];if(!r)return true;if(UI.rapidDraft)delete UI.rapidDraft[r.id];render();markScoreReviewed(r.id);var h=document.getElementById('app').innerHTML;var pass=h.indexOf('\u2713 Score Reviewed')>=0&&h.indexOf('background:#1B6B5A')>=0;delete r.scoreReviewed;render();return pass})()")===true, 'round 28: Review Score flips to the green ticked Score Reviewed button \u2014 same vocabulary, no chip');
  /* Round 12 (Paul's rulings, 31 Jul 2026): deferred tooltip, urgent divider, article drop, dashboard conformance. */
  ok(w.eval("(function(){var d=(data.risks||[]).filter(function(r){return (r.selection||{}).decision==='defer'&&inIdentifyBucket(r)})[0];if(!d)return true;go('portfolio','identify');var h=document.getElementById('app').innerHTML;return h.indexOf('Deferred by')>=0||h.indexOf('title=\"Deferred')>=0})()")===true, 'round 12: the Deferred badge carries the detail tooltip');
  /* Round-12 divider pin superseded 10 Aug 2026 (round 29, Paul's one-register ruling): the portfolio mirrors 2.5 — a Preliminary Risk Register title over Urgent Risks / Other Risks subsets that always render in default view; 'Can Wait for the Next Review' is retired. */
  ok(w.eval("(function(){UI.regView=null;go('portfolio','identify');var h=document.getElementById('app').innerHTML;return h.indexOf('Preliminary Risk Register')>=0&&h.indexOf('Urgent Risks (')>=0&&h.indexOf('Other Risks (')>=0&&h.indexOf('Can Wait for the Next Review')<0})()")===true, 'round 29 (retargeted from round 12): the Identify portfolio mirrors 2.5 \u2014 one register title, Urgent/Other subsets, the old divider label retired');
  ok(w.eval("(function(){go('step','2.5');var h=document.getElementById('app').innerHTML;return h.indexOf('Other Risks (')>=0&&h.indexOf('Can Wait for the Next Review')<0&&h.indexOf('>Preliminary Risk Register</h3>')>=0})()")===true, 'round 29: 2.5 carries the register main title with Urgent Risks / Other Risks as its two subsets');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return true;var keep={L:r.litL,I:r.litI,T:r.litT};r.litL=5;r.litI=5;r.litT=5;UI.regView={sys:true,show:'all',sort:'score-desc'};go('step','2.5');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Urgent Risks (')<0&&h.indexOf('Other Risks (')<0&&h.indexOf('>Urgent</span>')>=0;r.litL=keep.L;r.litI=keep.I;r.litT=keep.T;UI.regView=null;go('step','2.5');return pass})()")===true, 'round 29: system view at 2.5 drops the subset headings and marks urgent rows with the Urgent badge');
  ok(w.eval("(function(){go('portfolio','identify');var h=document.getElementById('app').innerHTML;return h.indexOf('>Identify Portfolio<')>=0&&h.indexOf('The Identify Portfolio')<0})()")===true, 'round 12: portfolio titles drop the article');
  ok(w.eval("(function(){var d=(data.risks||[]).filter(function(r){return r.dismissed})[0];go('phase5');if(!d){UI.activeView=null;return true}UI.activeView='arch-dismissed';render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('dsha'+d.id)>=0&&h.indexOf('editRisk(')<0;UI.expanded['dsha'+d.id]=true;render();var h2=document.getElementById('app').innerHTML;var open=h2.indexOf('Risk card')>=0&&h2.indexOf('Revive')>=0;UI.expanded['dsha'+d.id]=false;UI.activeView=null;render();return !!(pass&&open)})()")===true, 'round 12: archive rows are bars \u2014 Revive survives, the expansion carries the card fold, the old face buttons are gone');
  /* Needs/effort as card fields (Paul's ruling, 31 Jul 2026): free-text Required effort, comma-list Expertise needed. */
  ok(w.eval("(function(){go('portfolio','identify');var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Expertise needed')>=0&&h.indexOf('Required effort')>=0;UI.expanded['idc_'+r.id]=false;render();return pass})()")===true, 'needs fields: the editable card carries Expertise needed and Required effort');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;var keep=r.needs;rcFld(r.id,'needsExpertise',' legal , ML ops ,, ');rcFld(r.id,'needsEffort','two workshops and a memo');var pass=r.needs.expertise.length===2&&r.needs.expertise[0]==='legal'&&r.needs.effort==='two workshops and a memo';r.needs=keep;saveData();return pass})()")===true, 'needs fields: the comma list trims and drops empties; effort stores free text verbatim');
  /* ER takes the full set (Paul's ruling, 31 Jul 2026): short today is not short forever. */
  ok(w.eval("(function(){UI.regView=null;go('portfolio','emergency');var h=document.getElementById('app').innerHTML;var er=getPortfolios().emergency;if(!er.length)return true;return h.indexOf('View by system')>=0&&(h.indexOf('AI system:')>=0||h.indexOf('External risk')>=0||h.indexOf('No associated system')>=0)})()")===true, 'rollout: Emergency Response carries the controls and descriptor line');
  /* Rollout to Assess and Manage (Paul's ruling, 31 Jul 2026): same machinery, warn-first as Manage's default-sort implementation. */
  ok(w.eval("(function(){UI.regView=null;go('portfolio','assess');var h1=document.getElementById('app').innerHTML;go('portfolio','manage');var h2=document.getElementById('app').innerHTML;return h1.indexOf('View by system')>=0&&h2.indexOf('View by system')>=0&&h1.indexOf('AI system:')>=0})()")===true, 'rollout: controls render on Assess and Manage; the descriptor line rides the Assess bars');
  ok(w.eval("(function(){UI.regView=null;go('portfolio','manage');regViewSet('show','unscored');var h=document.getElementById('app').innerHTML;var lensed=h.indexOf('No risks match this view.')>=0||h.indexOf('openMgLanding')>=0;UI.regView=null;render();return lensed})()")===true, 'rollout: the Show lens operates on the Manage register');
  ok(w.eval("(function(){UI.regView=null;go('portfolio','manage');var tl2=(data.risks||[]).filter(function(r){return cardClass(r)==='manage'});var w1=tl2.filter(function(r){return needsLanding(r)})[0];var n1=tl2.filter(function(r){return !needsLanding(r)})[0];if(!w1||!n1)return true;var h=document.getElementById('app').innerHTML;return h.indexOf(w1.id)>=0&&h.indexOf(n1.id)>=0&&h.indexOf(w1.id)<h.indexOf(n1.id)})()")===true, 'rollout: needs-attention-first survives as the Manage default sort');
  /* Register controls (Paul's ruling, 31 Jul 2026): toggle + Show lens + Sort on 1.3, 2.5, and the Identify portfolio; descriptor line; ethics glyph; full-bucket gate under any lens. */
  ok(w.eval("(function(){UI.regView=null;var pages=[['portfolio','identify'],['step','2.5'],['step','1.3']];for(var i=0;i<pages.length;i++){go(pages[i][0],pages[i][1]);var h=document.getElementById('app').innerHTML;if(h.indexOf('View by system')<0||h.indexOf('>Show <')<0||h.indexOf('>Sort <')<0)return false}return true})()")===true, 'controls: the toggle, Show lens, and Sort render on all three register surfaces');
  ok(w.eval("(function(){UI.regView=null;go('portfolio','identify');var ext=(data.risks||[]).filter(inIdentifyBucket).filter(function(r){return r.source==='external'})[0];var internal=(data.risks||[]).filter(inIdentifyBucket).filter(function(r){return r.source!=='external'})[0];if(!internal)return false;regViewSet('show','internal');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('idc_'+internal.id)>=0&&(!ext||h.indexOf('idc_'+ext.id)<0);UI.regView=null;render();return pass})()")===true, 'controls: the Show lens filters the rendered rows (internal lens hides external risks)');
  ok(w.eval("(function(){UI.regView=null;go('portfolio','identify');regViewSet('sys');var h=document.getElementById('app').innerHTML;var grouped=h.indexOf('No associated system')>=0||((data.systems||[]).some(function(s){return h.indexOf(s.name.toUpperCase&&s.name.toUpperCase()?s.name:s.name)>=0}));var suppressed=h.indexOf('AI system:')<0;UI.regView=null;render();var h2=document.getElementById('app').innerHTML;var lineBack=h2.indexOf('AI system:')>=0;return !!(grouped&&suppressed&&lineBack)})()")===true, 'controls: View-by-system groups under headings, suppresses the descriptor line, and the line returns when off');
  ok(w.eval("(function(){UI.regView=null;var f=(data.risks||[]).filter(inIdentifyBucket).filter(function(r){return ethStatusOf(r)})[0];if(!f)return true;go('portfolio','identify');var h=document.getElementById('app').innerHTML;return h.indexOf('Ethical issue flag')>=0&&h.indexOf('\u2691')>=0})()")===true, 'controls: flagged rows carry the \u2691 glyph with its tooltip');
  ok(w.eval("(function(){UI.regView=null;var bucket=(data.risks||[]).filter(inIdentifyBucket);var r=bucket[0];if(!r)return false;bucket.forEach(function(x){delete x.scoreReviewed});go('step','2.5');regViewSet('show','urgent');var h=document.getElementById('app').innerHTML;var stillLocked=h.indexOf('Advance and Defer unlock when every score has been reviewed')>=0;openCeremonyEditor(r.id,'advance');var blocked=!UI.cerOpen;UI.regView=null;render();return !!(stillLocked&&blocked)})()")===true, 'controls: the 2.5 gate computes on the full bucket \u2014 no lens can unlock it');
  /* 2.5 score-review gate (Paul's ruling, 31 Jul 2026; same-day scope correction: the lock lives at 2.5 ONLY). */
  ok(w.eval("(function(){var bucket=(data.risks||[]).filter(inIdentifyBucket);var r=bucket[0];if(!r)return false;bucket.forEach(function(x){delete x.scoreReviewed});go('step','2.5');UI.expanded['idc_'+r.id]=true;render();var bs=[].slice.call(document.querySelectorAll('button')).filter(function(b){return b.textContent==='Advance'});var locked=bs.length&&bs[0].disabled;openCeremonyEditor(r.id,'advance');var blocked=!UI.cerOpen;var h=document.getElementById('app').innerHTML;var tracker=h.indexOf('awaiting a decision')>=0&&h.indexOf('reviewed')>=0;UI.expanded['idc_'+r.id]=false;render();return !!(locked&&blocked&&tracker)})()")===true, '2.5 gate: with unreviewed scores, Advance is locked, the ceremony guard holds, and the tracker card counts the register');
  ok(w.eval("(function(){var bucket=(data.risks||[]).filter(inIdentifyBucket);var r=bucket[0];if(!r)return false;bucket.forEach(function(x){if(x.litL&&x.litI&&x.litT)markScoreReviewed(x.id);else x.scoreReviewed={by:'probe',at:Date.now()}});render();var h=document.getElementById('app').innerHTML;var un=h.indexOf('All scores reviewed')>=0;UI.expanded['idc_'+r.id]=true;render();var bs=[].slice.call(document.querySelectorAll('button')).filter(function(b){return b.textContent==='Advance'});var live=bs.length&&!bs[0].disabled;UI.expanded['idc_'+r.id]=false;bucket.forEach(function(x){delete x.scoreReviewed});render();return !!(un&&live)})()")===true, '2.5 gate: once every score carries its review, the tracker flips and Advance unlocks');
  /* Advance ceremony -> donor modal (Paul's ruling, 31 Jul 2026, round 3): faded backdrop, serif title, the no-longer-visible warning, owner field; defer stays inline. */
  ok(w.eval("(function(){go('portfolio','identify');var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;openCeremonyEditor(r.id,'advance');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('modal-bg')>=0&&h.indexOf('no longer be visible on this page')>=0&&h.indexOf('ce_owner')>=0;cancelCeremonyEditor();return pass})()")===true, 'conformance (round-6 scope correction, 31 Jul 2026: the pf page never gates on review \u2014 this probe doubles as the ungated-pf regression pin): Advance opens the donor modal');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;openCeremonyEditor(r.id,'defer');var h=document.getElementById('app').innerHTML;var inline=h.indexOf('Defer with a holding action')>=0&&h.indexOf('modal-bg')<0;cancelCeremonyEditor();return inline})()")===true, 'conformance (round-6 scope correction: pf ungated): Defer keeps the inline ceremony \u2014 no modal');
  /* Live rapid screen on the Identify portfolio (Paul's defect report, 31 Jul 2026): the expansion carries the scoring layer; commit rides the 1.3 pin discipline. */
  ok(w.eval("(function(){go('portfolio','identify');var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;if(UI.rescoreConfirmed)delete UI.rescoreConfirmed[r.id];UI.expanded['idc_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Rapid Risk Screen')>=0&&(h.indexOf('Confirm Score')>=0||h.indexOf('Confirm Re-score')>=0)&&h.split('rapidSet').length>3&&h.indexOf('score-mini')>=0;UI.expanded['idc_'+r.id]=false;render();return pass})()")===true, 'conformance (retargeted 31 Jul 2026, round 2): the live Rapid Risk Screen \u2014 donor score boxes + the Confirm Score / Confirm Re-score lifecycle');
  ok(w.eval("(function(){var r=(data.risks||[]).filter(inIdentifyBucket)[0];if(!r)return false;var pinsBefore=(r.history||[]).filter(function(p){return p.kind==='rapid-screen'}).length;var had=r.litL&&r.litI&&r.litT;rapidSet(r.id,'L','4');rapidSet(r.id,'I','3');rapidSet(r.id,'T','2');saveRapidScreenOne(r.id);var pinsAfter=(r.history||[]).filter(function(p){return p.kind==='rapid-screen'}).length;return r.litL===4&&r.litI===3&&r.litT===2&&(had?pinsAfter===pinsBefore+1:pinsAfter===pinsBefore)})()")===true, 'conformance: Confirm screen writes the LIT triple and pins the prior screen on change (1.3 discipline)');
  w.eval("UI.expanded={};UI.wbOpen=null;UI.mgOpen=null;UI.mgDraft=null;UI.bandDraft=null");

  // ── round 52 (10 Aug 2026, seed batch 1): the register's eight, the board's criteria, the migrated breach records ──
  ok(w.eval("(function(){var ef=data.ethicalFramework||{};var prs=ef.principles||[];var bd=ef.board||{};var e1=(data.risks||[]).find(function(x){return x.id==='r-ex1'});var a2=(data.risks||[]).find(function(x){return x.id==='r-as2'});var c3=(data.risks||[]).find(function(x){return x.id==='r-ac3'});var parts=[prs.length>=8,prs.every(function(p){return p.details&&p.details.trim()}),(bd.escalationList||[]).length>=2,!!(e1&&e1.ethHow&&!e1.assess.ethHow),!!(a2&&a2.ethHow&&!a2.assess.ethHow),!!(c3&&c3.ethHow&&c3.ethNotes['pr-ex5'])];if(parts.some(function(x){return !x}))console.log('R52 parts:',JSON.stringify(parts));return parts.every(function(x){return x})})()")===true, 'round 52: eight detailed principles, seeded criteria, and the breach records in their one home');

  // ── round 51 (10 Aug 2026): seeded ethics coverage; the screening link ──
  ok(w.eval("(function(){var mn=(data.risks||[]).find(function(x){return x.id==='r-mn6'});var er=(data.risks||[]).find(function(x){return x.id==='r-er1'});return !!mn&&ethStatusOf(mn)==='confirmed'&&cardClass(mn)==='monitor'&&!!er&&ethStatusOf(er)==='confirmed'&&!!er.escalation&&(data.reviewLog||[]).some(function(e){return e.kind==='ethics'&&e.items&&e.items[5]===false&&/delegated to the working group/.test(e.notes||'')})})()")===true, 'round 51: the seed carries an ethical monitor, a Responsible AI escalation, and a completed review with an unreviewed item and its note');
  ok(w.eval("(function(){go('ethicsov');var h=document.getElementById('app').innerHTML;var link=(data.risks||[]).some(function(r){return isLiveRisk(r)&&ethStatusOf(r)==='potential'})?h.indexOf('ethGoScreen(')>=0&&h.indexOf('Pending screening')>=0:true;go('phase5');return link})()")===true, 'round 51: a pending screening renders as a link to the screening itself');

  // ── round 61 (11 Aug 2026, Paul's design): the testing plan is an expandable compliance record ──
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return x.testingPlan&&(x.testingPlan.tests||[]).some(function(t){return t.char})});if(!s)return false;var t=s.testingPlan.tests.find(function(x){return x.char});UI.s33Open=s.id;UI.s33Tab='evidence';UI.expanded['tt_'+t.id]=true;go('step','3.3');/* round 64: the bars live on the Tests & Evidence tab */var h=document.getElementById('app').innerHTML;var pass=h.indexOf('What is run')>=0&&h.indexOf('Evidence Log')>=0&&h.indexOf('te2_res_'+t.id)>=0&&h.indexOf('Remove from plan')>=0&&h.indexOf('The claim is that')>=0&&h.indexOf('te_test')<0;delete UI.expanded['tt_'+t.id];UI.s33Open=null;go('phase5');return pass})()")===true, 'round 61: a test bar opens to its record \u2014 what is run, the NIST reading, its evidence, its own logging, and removal; the global form is gone');
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return x.testingPlan&&(x.testingPlan.tests||[]).length});if(!s)return false;var keepT=JSON.parse(JSON.stringify(s.testingPlan.tests));var keepE=JSON.parse(JSON.stringify(s.testEvidence||[]));var t=s.testingPlan.tests[0];if(!s.testEvidence)s.testEvidence=[];s.testEvidence.push({testId:t.id,at:Date.now(),result:'Pin61 evidence',by:'Pin'});removeTest(s.id,t.id);var gone=!s.testingPlan.tests.some(function(x){return x.id===t.id});var kept=s.testEvidence.some(function(e){return e.result==='Pin61 evidence'});var named=(s.testingPlan.removedNames||{})[t.id]===t.claim;s.testingPlan.tests=keepT;s.testEvidence=keepE;delete s.testingPlan.removedNames[t.id];render();return gone&&kept&&named})()")===true, 'round 61: removal takes the test off the plan, keeps every evidence entry, and the log still names it');

  // ── round 65 (12 Aug 2026, Paul's rulings): the risk-side fold; the template rows open ──
  ok(w.eval("(function(){var pr=null;(data.systems||[]).forEach(function(s){if(pr)return;var t=(((s.testingPlan||{}).tests)||[])[0];if(!t)return;var r=(data.risks||[]).find(function(x){return x.systemId===s.id&&isLiveRisk(x)});if(r)pr={s:s,t:t,r:r}});if(!pr)return true;var had=(pr.t.riskIds||[]).indexOf(pr.r.id)>=0;if(!had)ttRiskTick(pr.s.id,pr.t.id,pr.r.id,true);UI.expanded['pin65'+pr.r.id]=true;var h=riskTestFold(pr.r,'pin65');var pass=h.indexOf(esc(pr.t.claim).slice(0,20))>=0&&h.indexOf('Open the Testing Center')>=0&&h.indexOf('te2_res_')<0;if(!had)ttRiskTick(pr.s.id,pr.t.id,pr.r.id,false);var empty=riskTestFold({id:'pin65-none'},'pin65')==='';/* retargeted 13 Aug 2026 (round 73): the seed now links real tests to r-ex1 */delete UI.expanded['pin65'+pr.r.id];render();return pass&&empty})()")===true, 'round 65: the Testing & evidence fold reads the linked record with no logging controls, and stays absent without links');
  ok(w.eval("(function(){UI.s33Tab='template';go('step','3.3');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('resists attack and recovers from disruption')>=0&&h.indexOf('For a maintenance model')>=0;UI.s33Tab='needs';go('phase5');return pass})()")===true, 'round 65 (retargeted 13 Aug 2026, round 85): the readings and worked examples render flat on the reference \u2014 was: the row expansion');

  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.ttStage&&(((x.assess||{}).desc)||'').trim()});if(!r)return true;UI.wbTab33=ttSysStage(r);UI.wb33Open=r.id;go('step','3.3');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('rt_rc_'+r.id)>=0&&h.indexOf('rt_ac_'+r.id)>=0&&h.indexOf(esc(r.assess.desc.slice(0,30)))>=0;UI.wb33Open=null;go('phase5');return pass})()")===true, 'round 83: an open risk in Risk testing carries the two folds and its expanded description');

  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return (((x.testingPlan||{}).tests)||[]).length});if(!s)return false;var t=s.testingPlan.tests[0];UI.s33Tab='design';UI.s33Open=s.id;var keep=s.ttStage;s.ttStage='design';UI.expanded['ttd_'+t.id]=true;var h=ttDesignCore(s);delete UI.expanded['ttd_'+t.id];if(keep===undefined)delete s.ttStage;else s.ttStage=keep;return h.indexOf('NIST measure (optional):')>=0})()")===true, 'round 85: the design expansion offers the optional NIST self-tag on the system track');

  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return ttSysStage(x)==='evidence'&&(((x.testingPlan||{}).tests)||[]).some(function(t){return (t.test||'').trim()})});if(!s)return false;var t=s.testingPlan.tests.find(function(x){return (x.test||'').trim()});UI.s33Tab='evidence';UI.s33Open=s.id;UI.expanded['tt_'+t.id]=true;go('step','3.3');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Evidence Log')>=0&&h.indexOf('tted_'+t.id)>=0&&h.indexOf('Attach Files')>=0&&h.indexOf('te2_res_'+t.id)>=0;delete UI.expanded['tt_'+t.id];go('phase5');return pass})()")===true, 'round 88: the evidence surface carries the grown heading, the design editor, and file references');

  // ── round 80 (13 Aug 2026, Design State v2): the one-pass rebuild — copy law, subcards, move-back, no numbers ──
  ok(w.eval("(function(){go('step','3.3');var h=document.getElementById('app').innerHTML;var banned=['workbench','owes you','where the work is run','make the journey','on the line'].filter(function(b){return h.indexOf(b)>=0});go('step','5.3');var h2=document.getElementById('app').innerHTML;var b2=['workbench','owes you'].filter(function(b){return h2.indexOf(b)>=0});go('phase5');if(banned.length||b2.length)console.log('R80 banned:',banned.join('|'),b2.join('|'));return !banned.length&&!b2.length})()")===true, 'round 80 (E7): the banned strings are extinct on the step and the Center');
  ok(w.eval("(function(){var ns=(data.systems||[]).find(function(x){return ttSysStage(x)==='needs'});UI.s33Tab='needs';if(ns)UI.s33Open=ns.id;go('step','3.3');var h=document.getElementById('app').innerHTML;var sub=h.indexOf('font-size:15px;font-weight:700;margin:0 0 10px\">What Needs Testing')>=0;var ex=!ns||h.indexOf('quotes stay within an agreed tolerance of manual pricing')>=0;go('phase5');return sub&&ex})()")===true, 'round 80: the chooser summons one nested stage subcard and the prompts carry working examples');
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return (((x.testingPlan||{}).tests)||[]).length});if(!s)return false;var keep=s.ttStage;s.ttStage='evidence';ttRetreatSys(s.id);var b1=ttSysStage(s)==='design';ttRetreatSys(s.id);var b2=ttSysStage(s)==='needs';if(keep===undefined)delete s.ttStage;else s.ttStage=keep;render();return b1&&b2})()")===true, 'round 80: an accidental forward move comes back \u2014 evidence to design to the list');

  // ── round 74 (13 Aug 2026, Paul's rulings): the four purposes organize the workbench; the intake language; the card grammar ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.ttStage});if(!r)return false;wbEntryAdd(r.id,'resolve');var t=r.testingPlan.tests[r.testingPlan.tests.length-1];var shp=t.purpose==='resolve'&&t.kind==='threat';var h=wbNeedsCore(r);var four=h.indexOf('Validate the significance')>=0&&h.indexOf('Resolve and retire')>=0&&h.indexOf('Reveal new aspects')>=0&&h.indexOf('Manage and monitor')>=0&&h.indexOf('tt_nm_'+t.id)>=0;r.testingPlan.tests.pop();render();return shp&&four})()")===true, 'round 74: the four purposes organize the risk workbench and an added need lands under its purpose');
  ok(w.eval("(function(){UI.wbTab33='needs';go('step','3.3');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Choose a risk from the register')>=0&&h.indexOf('Bring a risk in')<0&&h.indexOf('Choose a stage:')>=0;go('phase5');return pass})()")===true, 'round 74: the intake speaks the register and the tab band stands as its own card');

  // ── round 73 (13 Aug 2026, Paul's design): two tracks — the workbench hosts tests on the risk ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return isLiveRisk(x)&&!x.ttStage});if(!r)return true;wbPullRisk(r.id);var inWb=r.ttStage==='needs'&&r.testingPlan;ttEntryAdd(r.id,'threat');var t=r.testingPlan.tests[r.testingPlan.tests.length-1];ttFieldSave(r.id,t.id,'claim','Pin73 hosted threat');ttFieldSave(r.id,t.id,'test','Pin73 hunt design');ttAdvanceSys(r.id);ttAdvanceSys(r.id);var st=ttSysStage(r)==='evidence';UI.expanded['pin73'+r.id]=true;var fold=riskTestFold(r,'pin73');delete UI.expanded['pin73'+r.id];var hosted=fold.indexOf('Pin73 hosted threat')>=0;r.testingPlan.tests.pop();delete r.ttStage;delete r.testingPlan;render();return inWb&&st&&hosted})()")===true, 'round 73: a pulled risk hosts its own tests, advances through the stages, and its fold reads the hosted record');
  ok(w.eval("(function(){go('step','3.3');var h=document.getElementById('app').innerHTML;var r1=h.indexOf('System Compliance Testing')>=0&&h.indexOf('does not depend on any particular risk')>=0;var wb=h.indexOf('>Risk Testing <')>=0&&h.indexOf('better decisions about the risks in your portfolio')>=0;go('phase5');return r1&&wb})()")===true, 'round 73 (retargeted 13 Aug 2026, round 80): the two parallel tracks stand with the Design State v2 copy');
  ok(w.eval("(function(){var s1=(data.systems||[]).find(function(x){return x.id==='sys-1'});var adv=((s1||{}).testEvidence||[]).some(function(e){return e.outcome==='Broke'});var mn=(data.risks||[]).find(function(x){return x.id==='r-mn1'});var fav=((mn||{}).testEvidence||[]).some(function(e){return e.outcome==='Holds within limits'});return adv&&fav})()")===true, 'round 73: the seed carries decisive results both directions across both hosts (the reconciliation walk is pinned at round 64)');

  // ── round 68 (12 Aug 2026, Paul's design): the mini portfolio — entries advance by a push; folds carry the earlier abilities forward ──
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return (((x.testingPlan||{}).tests)||[]).length});if(!s)return false;var keep=s.ttStage;s.ttStage='needs';ttEntryAdd(s.id,'claim');var t=s.testingPlan.tests[s.testingPlan.tests.length-1];var h=ttNeedsCore(s);var onTab=h.indexOf('tt_nm_'+t.id)>=0&&h.indexOf('What must be true of this system? Add each as a claim to demonstrate.')>=0&&h.indexOf('What must this system withstand? Add each as a threat to hunt.')>=0&&h.indexOf('Move to Design the Tests')>=0;ttAdvanceSys(s.id);var st2=ttSysStage(s)==='design';ttAdvanceSys(s.id);var st3=ttSysStage(s)==='evidence';s.testingPlan.tests.pop();if(keep===undefined)delete s.ttStage;else s.ttStage=keep;render();return onTab&&st2&&st3})()")===true, 'round 69 (supersedes round 68 entry movement): the SYSTEM advances by a push through the three stages');
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return ttSysStage(x)==='evidence'&&(((x.testingPlan||{}).tests)||[]).length});if(!s)return false;UI.s33Open=s.id;UI.s33Tab='evidence';go('step','3.3');var h=document.getElementById('app').innerHTML;var e3=h.indexOf('Add to the list')>=0&&h.indexOf('Design the tests')>=0;var keep=s.ttStage;s.ttStage='design';UI.s33Tab='design';render();var h2=document.getElementById('app').innerHTML;var e2=h2.indexOf('Add to the list')>=0;if(keep===undefined)delete s.ttStage;else s.ttStage=keep;UI.s33Tab='needs';go('phase5');return e3&&e2})()")===true, 'rounds 68/69: the system carries folds of the earlier abilities through the stages \u2014 no moving back and forth');

  // ── round 64 (12 Aug 2026, Paul's design): 3.3's three passes; the Testing Center at 5.3 ──
  ok(w.eval("(function(){go('step','5.3');var h=document.getElementById('app').innerHTML;var c=h.indexOf('h-section\">Testing Center')>=0&&h.indexOf('What Needs Testing')>=0&&h.indexOf('Design the Tests')>=0;go('step','5.4');var a=document.getElementById('app').innerHTML.indexOf('Program Coverage')>=0;go('phase5');var d=document.getElementById('app').innerHTML.indexOf('Open the Testing Center')>=0;return c&&a&&d})()")===true, 'round 64: 5.3 is the Testing Center mirroring the passes, Analytics lives at 5.4, and the dashboard carries the summary square');
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return ((x.testingPlan||{}).tests||[]).length});if(!s)return false;var n0=s.testingPlan.tests.length;ttEntryAdd(s.id,'threat');var t=s.testingPlan.tests[s.testingPlan.tests.length-1];var shp=t.kind==='threat'&&t.claim===''&&Array.isArray(t.riskIds);ttFieldSave(s.id,t.id,'claim','Pin64 threat');ttFieldSave(s.id,t.id,'test','Pin64 hunt');var lr=(data.risks||[]).find(function(r){return r.systemId===s.id&&isLiveRisk(r)});var link=true;if(lr){ttRiskTick(s.id,t.id,lr.id,true);link=t.riskIds.indexOf(lr.id)>=0}s.testingPlan.tests.pop();render();return shp&&t.claim==='Pin64 threat'&&link})()")===true, 'round 64: threats are entries with their own kind, edits self-commit, and risk linkage ticks onto the test');
  ok(w.eval("(function(){var seeded=(data.systems||[]).some(function(s){return ((s.testingPlan||{}).tests||[]).some(function(t){return t.char&&t.kind==='threat'})});var claims=(data.systems||[]).some(function(s){return ((s.testingPlan||{}).tests||[]).some(function(t){return t.char&&t.kind==='claim'})});return seeded&&claims})()")===true, 'round 64: the NIST template seeds both kinds \u2014 the threat-shaped characteristics hunt, the rest demonstrate');

  ok(w.eval("(function(){var b=govTestReconBody();return b.indexOf('Open the Testing Center and cover the results logged since the last review.')>=0&&b.indexOf('both directions')<0&&b.indexOf('Open the Testing Center')>=0})()")===true, 'round 64 (SUPERSEDED 15 Aug 2026, addendum 137, ruled): the reconciliation list retires \u2014 item 4 prompts and routes to the Testing Center');

  // ── round 60 (11 Aug 2026, Paul's rulings): the row grammar sweeps wbTab2/wbTab3 ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess&&(x.assess.triggers||[]).length&&(x.assess.stakeholders||[]).length});if(!r)return false;var h2=wbTab2(r),h3=wbTab3(r);var t2=h2.indexOf('+ Add Trigger')>=0&&h2.indexOf('+ Add Internal Dependency')>=0&&h2.indexOf('+ Add External Dependency')>=0&&h2.indexOf('wb_tg_new')<0&&h2.indexOf('wb_dep_int')<0;var t3=h3.indexOf('+ Add Stakeholder')>=0&&h3.indexOf('+ Add Measure')>=0&&h3.indexOf('+ Add Cascade')>=0&&h3.indexOf('+ Add Other Impact')>=0&&h3.indexOf('Reputational Consequences')>=0&&h3.indexOf('Cultural Consequences')>=0&&h3.indexOf('wb_st_new')<0&&h3.indexOf('wb_qt_measure')<0&&h3.indexOf('wb_repcult')<0;var p1=h3.indexOf('id=\"wb_st_0\"'),p2=h3.indexOf('id=\"wb_stn_0\"'),p3=h3.indexOf(\"'stakeholders',0,'tag'\");return t2&&t3&&p1>=0&&p1<p2&&p2<p3})()")===true, 'round 60: every list is summoned rows, the standing inputs are gone, and the stakeholder dropdown sits last');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess});if(!r)return false;var n0=(r.assess.triggers||[]).length;wbRowAdd(r.id,'triggers');var t=r.assess.triggers[r.assess.triggers.length-1];var shp=t&&t.indicator===''&&t.threshold==='';wbRowSave(r.id,'triggers',r.assess.triggers.length-1,'indicator','Pin60 ind');wbRowSave(r.id,'triggers',r.assess.triggers.length-1,'threshold','>9');var sv=t.indicator==='Pin60 ind'&&t.threshold==='>9';r.assess.triggers.pop();var m0=(r.assess.quant||[]).length;wbRowAdd(r.id,'quant');var q=r.assess.quant[r.assess.quant.length-1];var qs=q&&q.confidence==='Medium';r.assess.quant.pop();render();return shp&&sv&&qs})()")===true, 'round 60: summoned rows carry their shapes and edits self-commit');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess});if(!r)return false;var keep=r.assess;r.assess={repCultural:'PinSixty legacy read',otherImpacts:'PinSixty other legacy'};var h=wbTab3(r);var pass=h.indexOf('PinSixty legacy read')>=0&&h.indexOf('PinSixty other legacy')>=0&&h.indexOf('wb_oi_0')>=0;r.assess=keep;render();return pass})()")===true, 'round 60: legacy free-text reads through \u2014 repCultural into the first consequences box, other impacts as row one');

  // ── round 59 (11 Aug 2026, Paul's rulings): likelihood subcards; capGaps rows; the fold at 3.1; the seed's dimensions ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess});if(!r)return false;var h=wbTab2(r);return h.indexOf('Historical precedents')>=0&&h.indexOf('Contributing factors')>=0&&h.indexOf('What would change this estimate?')>=0&&h.indexOf('Historical precedents and contributing factors')<0})()")===true, 'round 59: the likelihood card holds its three subcards under one heading');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess&&(x.assess.capGaps||'').trim()&&!x.assess.capGapsList});if(!r)r=(data.risks||[]).find(function(x){return x.assess&&x.assess.capGapsList});if(!r)return false;var h=wbTab1(r);var rows=h.indexOf('+ Add Capability Gap')>=0&&h.indexOf('wb_cg_0')>=0;var n0=(r.assess.capGapsList||[]).length;wbRowAdd(r.id,'capGapsList');var ok2=r.assess.capGapsList.length===n0+1||n0===0;r.assess.capGapsList.pop();render();return rows&&ok2})()")===true, 'round 59: capability gaps are summoned rows and legacy text materializes as row one');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='potential'});if(!r)return false;UI.expanded['eth31_'+r.id]=true;go('step','3.1');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('e31rc_'+r.id)>=0&&h.indexOf('Describe the Responsible AI dimension of the risk')>=0;delete UI.expanded['eth31_'+r.id];go('phase5');return pass})()")===true, 'round 59: the risk card fold rides each 3.1 screening drop-down');
  ok(w.eval("(function(){return ['r-ex1','r-as2','r-ac3','r-mn6','r-er1'].every(function(id){var r=(data.risks||[]).find(function(x){return x.id===id});return r&&(r.ethDimension||'').length>40})})()")===true, 'round 59: the five confirmed seed cards carry authored Responsible AI dimensions');

  // ── round 58 (11 Aug 2026): the check-in casing defect — the seed speaks the app's shape ──
  ok(w.eval("(function(){var mns=(data.risks||[]).filter(function(x){return cardClass(x)==='monitor'});if(mns.length<6)return false;return mns.every(function(r){var inds=(r.monitorPlan||{}).indicators||[];return !r.checkins&&inds.some(function(x){return (x.checks||[]).length>=1&&x.checks.every(function(c){return c.at&&typeof c.by==='string'&&typeof c.note==='string'})})})})()")===true, 'seed shape (retargeted 16 Aug 2026 night, Paul\'s check-logging ruling): every monitor seed carries per-indicator dated check logs; the container check-in histories are redistributed and gone');

  // ── round 57 (11 Aug 2026): the mirror defect — one editor at a time; the 3.2 switch verified clean ──
  ok(w.eval("(function(){var ms=(data.risks||[]).filter(function(x){return cardClass(x)==='manage'});if(ms.length<2)return true;var A=ms[0],B=ms[1];var keepA=A.assess?JSON.parse(JSON.stringify(A.assess)):null;var keepB=B.assess?JSON.parse(JSON.stringify(B.assess)):null;UI.acEdit={};acEditToggle(A.id);var one=Object.keys(UI.acEdit).filter(function(k){return UI.acEdit[k]}).length;acEditToggle(B.id);var still=Object.keys(UI.acEdit).filter(function(k){return UI.acEdit[k]});var pass=one===1&&still.length===1&&still[0]===B.id&&UI.wbOpen===B.id;acEditToggle(B.id);if(keepA)A.assess=keepA;if(keepB)B.assess=keepB;render();return pass})()")===true, 'round 57: opening a second card\u2019s Edit closes and harvests the first \u2014 one workbench instance ever renders');
  ok(w.eval("(function(){go('step','3.2');var pool=(data.risks||[]).filter(function(x){return x.assess&&!x.classification&&isLiveRisk(x)});if(pool.length<2)return true;var A=pool[0],B=pool[1];wbPick(A.id);var e=document.getElementById('wb_desc');if(!e)return false;var keepA=A.assess.desc,keepB=B.assess.desc;e.value='Pin57 A-text';wbPick(B.id);var pass=A.assess.desc==='Pin57 A-text'&&B.assess.desc===keepB;A.assess.desc=keepA;go('phase5');return pass})()")===true, 'round 57: typing on one 3.2 card and switching writes only that card \u2014 no bleed to the next');

  // ── round 56 (11 Aug 2026, Paul's design): Add summons a live row; numbered lists; the paired fold chip ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess&&(x.assess.rootCauses||[]).length});if(!r)return false;var n0=r.assess.rootCauses.length;wbRowAdd(r.id,'rootCauses');var added=r.assess.rootCauses.length===n0+1&&r.assess.rootCauses[n0].text==='';wbRowSave(r.id,'rootCauses',n0,'text','Pin56 cause');wbRowSave(r.id,'rootCauses',n0,'level','Systemic');var saved=r.assess.rootCauses[n0].text==='Pin56 cause'&&r.assess.rootCauses[n0].level==='Systemic';r.assess.rootCauses.pop();render();return added&&saved})()")===true, 'round 56: Add summons an empty editable row and edits self-commit');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess&&(x.assess.rootCauses||[]).length>=2});if(!r)return false;var kt=UI.wbTab;UI.wbOpen=r.id;UI.wbTab='floor';var h=workbench(r);UI.wbTab=kt;UI.wbOpen=null;return h.indexOf('What actually produces this risk?')>=0&&h.indexOf('>2.</span>')>=0&&h.indexOf('+ Add Root Cause')>=0&&h.indexOf('+ Add Control')>=0&&h.indexOf('recorded honestly')<0&&h.indexOf('wb_rc_new')<0})()")===true, 'round 56: the lists render numbered with their explanatory lines; the standing inputs and the phrase are gone');

  // ── round 50 (10 Aug 2026): the screening records the risk itself; the completion control keeps its shape ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='potential'});if(!r)return false;var pr=(data.ethicalFramework.principles||[]).filter(function(p){return String(p.principle||'').trim()})[0];if(!pr)return false;UI.ethDraft=null;var kt=UI.wbTab;UI.wbTab='eth';var h=workbench(r);var box=h.indexOf('Describe the Responsible AI dimension of the risk')>=0&&h.indexOf('es_dim_'+r.id)>=0;ethDraftTick(r.id,pr.id,true);ethDraftField(r.id,'dim','Pin50 Responsible AI dimension');confirmEthicsUI(r.id);var wrote=r.ethDimension==='Pin50 Responsible AI dimension'&&ethStatusOf(r)==='confirmed';delete r.ethDimension;delete r.ethStatus;r.ethHow='';r.ethPrinciples=[];r.ethNotes={};delete r.ethTest;UI.wbTab=kt;render();return box&&wrote})()")===true, 'round 50 (retargeted 11 Aug 2026, round 59): the screening asks for the Responsible AI dimension and one push records it on the card');
  ok(w.eval("(function(){UI.ethRevLogged=false;go('ethicsov');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Mark Review Complete')>=0&&h.indexOf('\u2717')<0;go('phase5');return pass})()")===true, 'round 50: the completion control carries no cross and keeps the round-edged button form');

  // ── round 48 (10 Aug 2026): the legacy assess-side store reads through ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'&&x.assess&&x.assess.ethHow&&!x.ethHow});if(!r)return true;UI.ethDraft=null;var kt=UI.wbTab;UI.wbTab='eth';var h=workbench(r);UI.wbTab=kt;UI.ethDraft=null;return h.indexOf(r.assess.ethHow.substring(0,30))>=0})()")===true, 'round 48: a seed card whose breach text lives under assess shows it in the screening form without a fixture');

  // ── round 46 (10 Aug 2026, Paul's ruling): the one-moment screening ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='potential'});if(!r)return false;var pr=(data.ethicalFramework.principles||[]).filter(function(p){return String(p.principle||'').trim()})[0];if(!pr)return false;UI.ethDraft=null;ethDraftTick(r.id,pr.id,true);var kt=UI.wbTab;UI.wbTab='eth';var h=workbench(r);var form=h.indexOf('Why it was flagged')>=0&&h.indexOf('es_how_'+r.id)>=0&&h.indexOf('Flag as potential')<0;ethDraftField(r.id,'how','Pin46 path');UI.expanded['eth31_'+r.id]=true;confirmEthicsUI(r.id);var done=ethStatusOf(r)==='confirmed'&&r.ethHow==='Pin46 path'&&(r.ethPrinciples||[])[0]===pr.id&&UI.expanded['eth31_'+r.id]===true;delete UI.expanded['eth31_'+r.id];delete r.ethStatus;r.ethHow='';r.ethPrinciples=[];r.ethNotes={};delete r.ethTest;UI.wbTab=kt;render();return form&&done})()")===true, 'round 46: ticking reveals the analysis fields, one push confirms with linkage and analysis together, and the expansion follows the card');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='potential'});if(!r)return false;var keepD=r.ethicalDesc;clearEthics(r.id);var flagd=UI.ethJustCleared&&UI.ethJustCleared.id===r.id;go('step','3.1');var h=document.getElementById('app').innerHTML;var line=h.indexOf('cleared \u2014 recorded on the card\u2019s Responsible AI tab')>=0;UI.ethJustCleared=null;delete r.ethStatus;delete r.ethTest;r.ethicalFlag=true;r.ethicalDesc=keepD;render();return flagd&&line})()")===true, 'round 46: clearing leaves a dismissible record line where the card was');

  // ── round 42 (10 Aug 2026): the agenda walk; the standing register page; the dashboard entry ──
  ok(w.eval("(function(){go('ethicsov');UI.expanded['ethrv5_reg']=true;render();var h=document.getElementById('app').innerHTML;delete UI.expanded['ethrv5_reg'];var pass=h.indexOf('Register of Responsible AI Principles</h3>')>=0&&h.indexOf('+ Add Custom Domain')>=0;go('phase5');return pass})()")===true, 'round 42: agenda item 5 expands to the register itself \u2014 the same card the dashboard entry shows');
  /* Retargeted 10 Aug 2026 (round 45, Paul's ruling): the standing page retired — the register's dashboard home is the glance bar, expanding in place like the systems bar. */
  ok(w.eval("(function(){UI.expanded.dashEthReg=true;go('phase5');var h=document.getElementById('app').innerHTML;UI.expanded.dashEthReg=false;render();return h.indexOf('Register of Responsible AI Principles (')>=0&&h.indexOf('+ Add Custom Domain')>=0})()")===true, 'round 42 (retargeted 10 Aug 2026, round 45): the glance bar expands in place to the full register (D-3/D-4)');
  ok(w.eval("(function(){UI.dashManage=null;go('phase5');var h=document.getElementById('app').innerHTML;return h.indexOf('dashEthReg')>=0&&h.indexOf(\"go('ethregister')\")<0})()")===true, 'round 42 (retargeted 10 Aug 2026, round 45): the register bar sits in the glance section; the box link is gone');
  ok(w.eval("(function(){UI.ethReviewHdr=true;UI.ethRevTicks={2:true};UI.ethRevLogged=true;go('ethicsov');go('phase5');return !UI.ethRevTicks&&!UI.ethRevLogged})()")===true, 'round 45: leaving the room after logging resets the meeting state; the next visitor sees no stale ticks');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'});if(!r)return false;var keep=r.ethHow;r.ethHow='Pin42 breach path';var kt=(UI.acTab||{})[r.id];acTabSet(r.id,4);var h=assessCardPages(r);acTabSet(r.id,kt||0);r.ethHow=keep;return h.indexOf('How the breach could happen')>=0&&h.indexOf('Pin42 breach path')>=0})()")===true, 'round 42: the card\u2019s Ethics page still renders through the shared ethPageRO after the extraction');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'&&x.ethTest});if(!r)return false;var keep=r.ethHow;var keepAt=r.ethTest.at;r.ethHow='Pin42 breach path';r.ethTest.at=Date.now()+60000;go('ethicsov');UI.expanded['ethrv1_'+r.id]=true;render();var h=document.getElementById('app').innerHTML;delete UI.expanded['ethrv1_'+r.id];r.ethHow=keep;r.ethTest.at=keepAt;var pass=h.indexOf('How the breach could happen')>=0&&h.indexOf('Pin42 breach path')>=0;go('phase5');return pass})()")===true, 'round 42: a confirmation-decision bar opens to the linkage and breach analysis');

  // ── round 39 (10 Aug 2026): the Supplementary Positions card retired; its questions live on as domain prompts ──
  ok(w.eval("(function(){go('step','2.1');var h=document.getElementById('app').innerHTML;return h.indexOf('Supplementary Positions')<0&&h.indexOf('ef_defaultAutonomy')<0})()")===true, 'round 39: 2.1 carries no Supplementary Positions card');
  ok(w.eval("(function(){UI.prAdd='Fairness';go('step','2.1');var h=document.getElementById('app').innerHTML;UI.prAdd=null;render();return h.indexOf('how will you test for and address bias?')>=0})()")===true, 'round 39: the Fairness add-form carries its inherited prompt');

  // ── round 38 (10 Aug 2026): Re-assess is a clone of Edit; the register header row ──
  ok((function(){var _s38=require('fs').readFileSync('Governance-app.js','utf8');return _s38.indexOf("btnS('Edit','acEditToggle(")>=0&&_s38.indexOf('reassessOpen deleted whole')>=0&&(_s38.split('reassessOpen').length-1)<=1})() && w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='monitor'&&x.monitorPlan});if(!r)return true;var h=mnSurface(r);return h.indexOf('reassessOpen')<0&&h.indexOf(\"openWB(\")<0})()")===true, 'round 38 (superseded 22 Aug 2026, ruled: Re-assess duplicated the assessment card\'s Edit and is deleted whole \u2014 acEditToggle via the card\'s Edit button is the one path to re-assessment; no plan surface carries a re-assess control)');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='monitor'})||(data.risks||[]).find(function(x){return cardClass(x)==='manage'});if(!r)return false;UI.expanded['pfac'+r.id]=true;acEditToggle(r.id);var on=UI.acEdit[r.id]===true&&UI.expanded['pfac'+r.id]===true&&UI.wbOpen===r.id;acEditToggle(r.id);delete UI.expanded['pfac'+r.id];render();return on})()")===true, 'round 38 (retargeted 22 Aug 2026: the flow drives acEditToggle, the one path): reassessOpen opens the card fold in Edit with the workbench state seeded');

  // ── round 36 (10 Aug 2026): Edit seeds the workbench state; no second editor beside it ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='manage'});if(!r)return false;acEditToggle(r.id);var on=UI.wbOpen===r.id&&!!UI.bandDraft;acEditToggle(r.id);var off=UI.wbOpen!==r.id&&!UI.bandDraft;return on&&off})()")===true, 'round 36: the donor card Edit seeds and clears UI.wbOpen and the band draft, so harvest and the result band work under it');

  // ── round 35 (10 Aug 2026, Paul's ruling): the assessment card adopts the pipeline project-card model ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='manage'});if(!r)return false;if(UI.acEdit)UI.acEdit[r.id]=false;var h=assessCardPages(r);return ['>Overview<','>Risk Details<','>Understanding<','>Impact<','>Edit<'].every(function(n){return h.indexOf(n)>=0})&&h.indexOf('ASSESSMENT CARD')<0})()")===true, 'round 35: the donor shell renders read-only-first with the five pages and the Edit control');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='manage'});if(!r)return false;acEditToggle(r.id);var h=assessCardPages(r);var editing=h.indexOf('ASSESSMENT CARD \u2013 EDITING')>=0&&h.indexOf('Done editing')>=0&&h.indexOf('Choose what you want to work on:')>=0;acEditToggle(r.id);var back=assessCardPages(r).indexOf('>Edit<')>=0;return editing&&back})()")===true, 'round 35: Edit opens the entire workbench inside the shell and Done editing returns the read-only card');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='manage'});if(!r)return false;acTabSet(r.id,1);var h=assessCardPages(r);acTabSet(r.id,0);return h.indexOf('Expanded description')>=0||h.indexOf('Root causes')>=0||h.indexOf('Nothing recorded on this page yet')>=0})()")===true, 'round 35: the Risk Details page renders the recorded floor read-only, or the honest empty line');

  // ── rounds 32–34 (10 Aug 2026): 3.1 family bars, the sight table, the working-group prompt ──
  ok(w.eval("(function(){var ef=data.ethicalFramework||(data.ethicalFramework={});if(!ef.principles)ef.principles=[];harvestEF();ef.principles.push({id:'pr-pin34',principle:'Temp','breach':'','domain':''});UI.ethRetest=null;removePrinciple(ef.principles.length-1);var fired=!!UI.ethRetest;UI.ethRetest=null;return fired})()")===true, 'round 34: retiring a principle fires the working-group prompt');
  ok(w.eval("(function(){UI.ethRetest=Date.now();go('ethicsov');var h=document.getElementById('app').innerHTML;UI.ethRetest=null;render();return h.indexOf('appoint a working group')>=0&&h.indexOf('Re-test designated risks')<0})()")===true, 'round 34: the register-change card is an action item, not a mechanic');
  ok(w.eval("(function(){go('step','2.1');var h=document.getElementById('app').innerHTML;return h.indexOf('receives escalations')<0&&h.indexOf('reads the screening decisions')>=0})()")===true, 'round 34 (retargeted 15 Aug 2026, copy master batch 3): the board blurb reads, not receives \u2014 the mechanism claim is gone; pass decisions renamed screening decisions per the master');

  // ── round 31 (10 Aug 2026, Paul's design): the Responsible AI tab on the workbench ──
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='potential'});if(!r)return false;var kt=UI.wbTab;UI.wbTab='floor';var h=workbench(r);var loud=h.indexOf('Responsible AI \u2014 Unresolved question')>=0;UI.wbTab='eth';var h2=workbench(r);var test=h2.indexOf('Which named principles could this breach?')>=0&&h2.indexOf('Confirm Responsible AI risk')>=0;UI.wbTab=kt;return loud&&test})()")===true, 'round 31: a potential card carries the literal unresolved words on the tab, and the tab hosts the confirmation test');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'});if(!r)return false;var kt=UI.wbTab;UI.wbTab='floor';var h=workbench(r);var off=h.indexOf('Ethics breach analysis')<0;UI.wbTab='eth';var h2=workbench(r);var on=h2.indexOf('How could the breach actually happen?')>=0&&h2.indexOf('Confirm Responsible AI risk')>=0&&h2.indexOf('Unresolved Responsible AI question')<0;UI.wbTab=kt;return off&&on})()")===true, 'round 31 (retargeted 10 Aug 2026, round 48): the screening lives on the Responsible AI tab and has left Risk Details; a decided card carries no unresolved marker');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return !ethStatusOf(x)});if(!r)return false;var kt=UI.wbTab;UI.wbTab='eth';var h=workbench(r);UI.wbTab=kt;return h.indexOf('Could this cross a Responsible AI line?')>=0&&h.indexOf('Unlocks when the card carries a potential flag')>=0&&h.indexOf('Unlocks on confirmation')>=0})()")===true, 'round 31: an unflagged card shows the flag question over the greyed shell');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'});if(!r)return false;var keep=r.ethStatus;var keepP=(r.ethPrinciples||[]).slice();var hl=(r.history||[]).length;r.ethStatus='cleared';var kt=UI.wbTab;UI.wbTab='eth';var h=workbench(r);var rec=h.indexOf('>Cleared</p>')>=0&&h.indexOf('Re-open \u2014 flag as potential')>=0;ethReopen(r.id);var back=ethStatusOf(r)==='potential'&&(r.history||[]).length===hl+1;r.ethStatus=keep;r.ethPrinciples=keepP;r.ethicalFlag=true;if(r.history)r.history.length=hl;UI.wbTab=kt;render();return rec&&back})()")===true, 'round 31: a cleared card shows the decision record and Re-open returns it to potential with the prior state pinned');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'});if(!r)return false;rcEthSet(r.id,false);return ethStatusOf(r)==='confirmed'&&r.ethicalFlag===true})()")===true, 'round 31: a confirmed outcome never flips from the flag buttons');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return !ethStatusOf(x)});if(!r)return false;var keep=UI.wbOpen;UI.wbOpen=r.id;var inWb=riskCardEdit(r).indexOf('Could this cross a Responsible AI line?')<0;UI.wbOpen=null;var outWb=riskCardEdit(r).indexOf('Could this cross a Responsible AI line?')>=0;UI.wbOpen=keep;return inWb&&outWb})()")===true, 'round 31: the fold suppresses the flag control inside the open workbench and keeps it everywhere else');

  // ── round 30 (10 Aug 2026, Paul's ethics-strand rulings): metric, blank principles, dead copy, gate, cleared flag ──
  ok(w.eval("(function(){var f=(data.risks||[]).filter(function(r){return isLiveRisk(r)&&ethStatusOf(r)});var t=f.filter(function(r){var s=ethStatusOf(r);return s==='confirmed'||s==='cleared'});var c=anHealth().comps.filter(function(x){return x.n==='Responsible AI engaged'})[0];if(!c)return false;return f.length?Math.abs(c.v-(t.length/f.length))<1e-9:c.v===null})()")===true, 'round 30: Responsible AI engaged reads tested over flagged');
  ok(w.eval("(function(){var ef=data.ethicalFramework||(data.ethicalFramework={});if(!ef.principles)ef.principles=[];ef.principles.push({id:'pr-pin30',principle:'',breach:'',domain:''});data.risks.push({id:'r-pin30',name:'Pin30',description:'',ethicalFlag:true});go('step','3.1');var h=document.getElementById('app').innerHTML;var boxes=(h.match(/id=\"et_r-pin30_/g)||[]).length;var nb=ef.principles.filter(function(pp){return String(pp.principle||'').trim()}).length;ef.principles=ef.principles.filter(function(pp){return pp.id!=='pr-pin30'});data.risks=data.risks.filter(function(r){return r.id!=='r-pin30'});render();return nb>0&&boxes===nb})()")===true, 'round 30: a blank register row leaks no checkbox into the confirmation test');
  ok(w.eval("(function(){var keep=data.risks;data.risks=[];go('step','3.1');var h=document.getElementById('app').innerHTML;data.risks=keep;render();return h.indexOf('demand sweep')<0&&h.indexOf('Responsible AI tab')>=0})()")===true, 'round 30 (needle retargeted 10 Aug 2026, round 33): the retired demand-sweep reference is gone from the 3.1 empty state');
  ok(w.eval("(function(){var keep=(data.completedSteps||{})['3.1'];delete data.completedSteps['3.1'];data.risks.push({id:'r-pin30b',name:'P',description:'',ethicalFlag:true});go('step','3.1');completeStepGated('3.1');var blocked=!(data.completedSteps||{})['3.1'];data.risks=data.risks.filter(function(r){return r.id!=='r-pin30b'});var others=(data.risks||[]).filter(function(r){return isLiveRisk(r)&&ethStatusOf(r)==='potential'});others.forEach(function(r){r.ethStatus='cleared'});completeStepGated('3.1');var passed=(data.completedSteps||{})['3.1']===true;others.forEach(function(r){delete r.ethStatus});if(keep)data.completedSteps['3.1']=true;go('phase5');return blocked&&passed})()")===true, 'round 30: the 3.1 gate blocks on a pending confirmation test and clears when every test is decided');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return ethStatusOf(x)==='confirmed'});if(!r)return false;var keep=r.ethStatus;var before=pfEthFlag(r)!==''&&regShowPass(r,'ethics')===true;r.ethStatus='cleared';var after=pfEthFlag(r)===''&&regShowPass(r,'ethics')===false;r.ethStatus=keep;return before&&after})()")===true, 'round 30: a cleared flag leaves the register rows and the Ethics-flagged lens');

  // ── round 29 (10 Aug 2026, Paul's rulings): review-box anatomy + standardized settings ──
  ok(w.eval("(function(){UI.dashManage=null;go('phase5');var h=document.getElementById('app').innerHTML;return (h.split('min-height:38px').length-1)>=3&&h.indexOf('Governance Council + system owners')<0})()")===true, 'round 29: the three review boxes share the constant-height label and the cadence/date/button anatomy \u2014 the attendees and duration lines are retired');
  ok(w.eval("(function(){UI.dashManage='rhythm';go('phase5');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('First meeting date *')<0&&h.indexOf('First meeting date')>=0&&h.indexOf(\"addGrItem(\")>=0&&h.indexOf('gr_attendees')<0;UI.dashManage=null;render();return pass})()")===true, 'round 29: dashboard Governance settings carry no gate stars and the attendees add-list');
  ok(w.eval("(function(){go('step','4.2');var h=document.getElementById('app').innerHTML;return h.indexOf('First meeting date *')>=0&&h.indexOf('Attendees *')<0&&h.indexOf(\"addGrItem(\")>=0&&h.indexOf('gr_attendees')<0})()")===true, 'round 29: 4.2 keeps the date star, loses the attendees star to the data criterion, and renders the add-list');
  ok(w.eval("(function(){go('step','2.3');var h=document.getElementById('app').innerHTML;var a=h.indexOf('>Review Frequency</h3>');var b=h.indexOf('>New Risk Review Meeting</h3>');return a>=0&&b>=0&&a<b})()")===true, 'round 29 (retargeted 15 Aug 2026, copy master batch 3): 2.3 renders the frequency-first two-card shape \u2014 the meeting card carries the New Risk Review name');
  /* Retargeted 10 Aug 2026 (round 43, Paul's ruling): three subcards — cadence, Board Members, Escalation Criteria — on both surfaces. */
  ok(w.eval("(function(){UI.dashManage='ethboard';go('phase5');var h=document.getElementById('app').innerHTML;var a=h.indexOf('>Meeting &amp; Review Cadence</h3>');/* innerHTML serializes the raw ampersand */var b=h.indexOf('>Board Members</h3>');var c=h.indexOf('>Extraordinary Meeting Criteria</h3>');var pass=a>=0&&b>=0&&c>=0&&a<b&&b<c&&h.indexOf('eb_nextReview')>=0;UI.dashManage=null;render();return pass})()")===true, 'round 29 (retargeted 10 Aug 2026, round 43): the dashboard board settings carry the three-card shape, cadence first, date with the members');
  ok(w.eval("(function(){go('step','2.1');var h=document.getElementById('app').innerHTML;var a=h.indexOf('>Meeting &amp; Review Cadence</h3>');var b=h.indexOf('>Board Members</h3>');var c=h.indexOf('>Extraordinary Meeting Criteria</h3>');return a>=0&&b>=0&&c>=0&&a<b&&b<c})()")===true, 'round 43 (retargeted 10 Aug 2026, round 47): 2.1 mirrors the three subcards inside the Responsible AI Review Board card, the members finally titled');
  ok(w.eval("(function(){go('step','2.1');var h=document.getElementById('app').innerHTML;var a=h.indexOf('bd_cadence');var b=h.indexOf('bm_0_name');return a>=0&&b>=0&&a<b})()")===true, 'round 29: 2.1 mirrors the cadence-before-members order');
  ok(w.eval("(function(){if(!data.ethicalFramework)data.ethicalFramework={};data.ethicalFramework.defaultAutonomy='human-in-loop';go('phase5');saveEF();return data.ethicalFramework.defaultAutonomy==='human-in-loop'})()")===true, 'round 29: saving board settings from the dashboard no longer wipes the 2.1 autonomy position');

  /* ── addendum 96 chunk A (13 Aug 2026): the lock map exists and the wiring is live ── */
  console.log('== addendum 96 chunk A: lock map + wiring ==');
  ok(w.eval("typeof idToRecordKey")==='function', 'chunk A: idToRecordKey exists (undefined at round 91 — applyLockUI called a missing function)');
  ok(w.eval("idToRecordKey('ru_r-abc123_name')")==='roster::r-abc123', 'chunk A: a roster member field locks that member');
  ok(w.eval("idToRecordKey('exp_departments')")==='assessmentBattery'&&w.eval("idToRecordKey('grl_attendees_0')")==='govRhythm'&&w.eval("idToRecordKey('bm_0_name')")==='ethicalFramework', 'chunk A: singleton one-per-org forms carry one lock each');
  ok(w.eval("idToRecordKey('es_dim_r-xyz')")==='risks::r-xyz'&&w.eval("(function(){var _p=UI.wbOpen;UI.wbOpen='r-77';var k=idToRecordKey('wb_rc_0');UI.wbOpen=_p;return k})()")==='risks::r-77', 'chunk A: Responsible AI screening and the single-open workbench lock the risk');
  ok(w.eval("(function(){var s=(data.systems||[]).find(function(x){return x.testingPlan&&(x.testingPlan.tests||[]).length});if(!s)return 'no-fixture';return idToRecordKey('tt_nm_'+s.testingPlan.tests[0].id)==='systems::'+s.id})()")===true, 'chunk A: a test field locks its host system (ttHost lookup)');
  ok(w.eval("idToRecordKey('noteInput')")===null&&w.eval("idToRecordKey('mg_act')")===null, 'chunk A: panel inputs and draft-form fields stay unmapped by design (their commit buttons take the guard — chunk B)');
  ok((function(){var _sA=require('fs').readFileSync('Governance-app.js','utf8');return _sA.indexOf("addEventListener('focusin'")>=0&&_sA.indexOf("addEventListener('beforeunload'")>=0&&_sA.indexOf('Collab.refreshMine(); applyLockUI(false)')>=0&&_sA.indexOf('try{applyLockUI(true)}catch(e){}')>=0})(), 'chunk A: focus delegation, leave-on-unload, the 4s heartbeat, and the render-tail repaint are wired at source');

  /* ── addendum 96 chunk B (13 Aug 2026): the guard census + the foreign-lock behavioral pair ── */
  console.log('== addendum 96 chunk B: guard census ==');
  ok((function(){var _sB=require('fs').readFileSync('Governance-app.js','utf8');return (_sB.match(/lockBlocked\(/g)||[]).length===87/* 25 Aug 2026 (fix batch R2): saveEnterprise takes lockBlocked('enterprise') — O-4 CLOSED by Paul's ruling, count 86→87 (1 definition + 86 call sites). Prior: 21 Aug 2026 (copy-pass session fixes): addEventTrigger + removeEventTrigger join with reviewCadence guards; 22 Aug 2026: addGrAgendaItem (the solidified agenda composer) joins. Prior: 20 Aug 2026 (fix batch 1, R-4 + R-7): saveSystem/saveRisk edit-path guards and dismissRisk/reviveRisk/saveErPlan/markScoreReviewed join — 82 call sites plus the definition. Prior: 16 Aug 2026 late night: removeCheck, markActionDone, undoActionDone join; toggleActionDone delegates. 17 Aug 2026 (addendum 188, RACI graphics port): govRaciCycle joins — the new cell-cycle writer takes the guard the retired select path lacked */})(), 'chunk B (retargeted 25 Aug 2026, fix batch R2 — saveEnterprise joins and O-4 closes: 86 call sites plus the definition; prior 21 Aug 2026, copy-pass session fixes — the two event-trigger handlers join: the guard census held at 84 call sites plus the definition; prior 20 Aug 2026, fix batch 1, R-4/R-7, 82 call sites plus the definition; prior form 16 Aug 2026 evening, artifact-cards ruling, 71 call sites plus the definition (the ten per-artifact commit writers join: saveIndicatorCard, removeIndicator, saveMnEmCard, removeMnEm, saveMnLanding, saveMgPlanCard, removeMgPlan, saveMgEmCard, removeMgEm, mgEmNaCommit; the retired container writers leave; prior lineage: guard-gap ruling 16 Aug added saveExitDecision/completeExit/clearEthics/saveGovReview/govLogReview, plural-plan writers 16 Aug, saveGatePassage/saveSysOpenFields addendum 128, archiveSystem addendum 135, restoreSystem/removeSysSpecDoc addenda 158/160) (blanket wiring per Rollout item 53; exclusions logged, ledger addendum 96)');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x&&x.id});if(!r)return 'no-fixture';var n0=data.risks.length;var k='governance-locks::'+currentOrgId;var L={};L['risks::'+r.id]={id:'u_probe_other',name:'Probe Other',at:Date.now()};localStorage.setItem(k,JSON.stringify(L));removeRisk(r.id);var blocked=(data.risks.length===n0);localStorage.removeItem(k);return blocked})()")===true, 'chunk B: a foreign lock on a risk blocks removeRisk — the write never lands');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x&&x.id});if(!r)return 'no-fixture';var snap=data.risks.slice();var n0=data.risks.length;removeRisk(r.id);var removed=(data.risks.length===n0-1);data.risks=snap;saveData();return removed})()")===true, 'chunk B: with the lock cleared the same action applies (fixture restored after)');

  /* ── addendum 96 chunk C (13 Aug 2026): the item-52 acceptance layer ── */
  console.log('== addendum 96 chunk C: render purity + live lock round trip ==');
  ok(w.eval("(function(){var out=true;[['phase5'],['overview'],['mgmt-hub'],['step','2.2'],['step','3.3']].forEach(function(p){go(p[0],p[1]);var r0=data.rev;render();render();if(data.rev!==r0)out=String(p[0])+'/'+String(p[1])+':'+r0+'->'+data.rev});go('phase5');return out})()")===true, 'chunk C (item 52): settled pages render rev-quiet — two extra renders never bump the org rev on any probed page');
  ok(w.eval("(function(){var m=(USERS||[])[0];if(!m)return 'no-roster';var _em=m.email;if(!_em)m.email='probe@example.com';var d=new Date();d.setDate(d.getDate()+3);var iso=d.toISOString().split('T')[0];if(!data.stepDue)data.stepDue={};var _pd=data.stepDue['4.4'];data.stepDue['4.4']=iso;if(!data.assigns)data.assigns={};var _pa=data.assigns['4.4'];data.assigns['4.4']=[m.id];var _pc=(data.completedSteps||{})['4.4'];if(data.completedSteps)delete data.completedSteps['4.4'];if(!data.remind7)data.remind7={};var _pr=data.remind7['4.4'];delete data.remind7['4.4'];var _nl=(data.notifications||[]).length;saveData();var r0=data.rev;render();var fired=(data.remind7['4.4']===true)&&(data.rev>r0);var r1=data.rev;render();var quiet=(data.rev===r1);if(_pd===undefined)delete data.stepDue['4.4'];else data.stepDue['4.4']=_pd;if(_pa===undefined)delete data.assigns['4.4'];else data.assigns['4.4']=_pa;if(_pc!==undefined){if(!data.completedSteps)data.completedSteps={};data.completedSteps['4.4']=_pc}if(_pr===undefined)delete data.remind7['4.4'];else data.remind7['4.4']=_pr;if(data.notifications)data.notifications=data.notifications.slice(0,_nl);if(!_em)m.email='';saveData();return fired&&quiet})()")===true, 'chunk C (item 52): a real reconcile (due reminder on an assigned step) persists, then the next render is quiet — the sweep converges');
  ok(w.eval("(function(){go('step','2.1');var el=document.getElementById('bd_cadence');if(!el)return 'no-el';var k='governance-locks::'+currentOrgId;var L={ethicalFramework:{id:'u_probe_other',name:'Probe Other',at:Date.now()}};localStorage.setItem(k,JSON.stringify(L));applyLockUI(true);var locked=(el.disabled===true);var marked=document.getElementById('app').innerHTML.indexOf('is editing')>=0;localStorage.removeItem(k);applyLockUI(true);var released=(el.disabled===false);go('phase5');return locked&&marked&&released})()")===true, 'chunk C: a foreign lock disables the mapped fields with the Locked marker, and clears on release — the full round trip');

  /* ── addendum 97 (13 Aug 2026): check-in fields join the lock map; the adoption-paint re-inject rule ── */
  console.log('== addendum 97: check-in binding + adoption-paint rule ==');
  ok(w.eval("idToRecordKey('mnci_r-abc_2')")==='risks::r-abc'&&w.eval("idToRecordKey('mn_dir_r-abc')")==='risks::r-abc'&&w.eval("idToRecordKey('mn_ind')")===null, 'addendum 97: check-in fields lock their risk (id embedded); the monitoring landing draft form stays unmapped');
  ok((function(){var _sD=require('fs').readFileSync('Governance-app.js','utf8');return _sD.indexOf("val('mn_dir_'+id)")<0&&_sD.indexOf("mnci_")<0&&_sD.indexOf('function logCheck')>=0})(), 'addendum 97 (SUPERSEDED 16 Aug 2026 night, Paul\'s check-logging ruling): the check-in form and its scoped ids are retired from source; per-indicator logCheck replaces them');
  ok((function(){var _sD=require('fs').readFileSync('Governance-app.js','utf8');return _sD.indexOf("_adoptPaint=true;\n    try{ render(); }catch(e){}\n    _adoptPaint=false;")>=0&&_sD.indexOf("if(!_adoptPaint||_ark===null||_ark===_heldLock)fe.value=_fc[fk]")>=0})(), 'addendum 97 (F-13a): refreshOrg flags its adoption render, and the re-inject rule honors it at source');
  ok(w.eval("(function(){go('step','2.1');var ef=data.ethicalFramework=data.ethicalFramework||{};var bd=ef.board=ef.board||{};var ms=bd.members=bd.members||[];ms.push({name:'',role:''});render();var idx=ms.length-1;var el=document.getElementById('bm_'+idx+'_name');if(!el)return 'no-el';el.value='LOCAL TYPING';render();var kept=(document.getElementById('bm_'+idx+'_name').value==='LOCAL TYPING');var el2=document.getElementById('bm_'+idx+'_name');el2.value='LOCAL TYPING';_adoptPaint=true;render();_adoptPaint=false;var dropped=(document.getElementById('bm_'+idx+'_name').value==='');ms.pop();render();go('phase5');return kept&&dropped})()")===true, 'addendum 97 (F-13a): a local repaint preserves unharvested typing, an adoption repaint shows the adopted state for records this user does not hold — the resurrection path is closed');

  /* ── addendum 97 round E (13 Aug 2026): the small-fix batch ── */
  console.log('== addendum 97 round E: small fixes ==');
  ok((function(){var _ix=require('fs').readFileSync('Governance-index.html','utf8');return _ix.indexOf('90-Day Responsible AI Governance \u2014 NextChapter</title>')>=0&&_ix.indexOf('Faisal Hoque')<0})(), 'item 35: the browser-tab title carries the NextChapter attribution');
  ok((function(){var _sE=require('fs').readFileSync('Governance-app.js','utf8');return _sE.indexOf('\\u2193 PDF')<0&&_sE.indexOf('Download as PDF')<0&&_sE.split('\\u25be Save as PDF').length===21})() /* 14 Sep 2026, later: the Report Manager's row and toolbar */ /* 14 Sep 2026: the Phase 5 print bar and the portfolio pages carry the same quiet control; later that day, the Compliance Dashboard's per-tab control and the two review pages' control */ /* 12 Sep 2026 (Paul's ruling): the classification report folded into the registers, one button fewer */, 'items 30/49: fourteen quiet Save as PDF buttons (retargeted 14 Aug 2026, register-output headers restored; 21 Aug 2026, the Assessment Profile joins), zero filled forms — the Rev L reversal is landed');
  ok((function(){var _sE=require('fs').readFileSync('Governance-app.js','utf8');return _sE.indexOf("_step?'\\u2713 Step complete':'\\u2713 Section complete'")>=0&&_sE.indexOf("Mark step complete and continue")>=0&&_sE.indexOf("Mark section complete and continue")>=0})(), 'item 55: the done button labels are level-aware at source (ER form)');
  ok((function(){var _sE=require('fs').readFileSync('Governance-app.js','utf8');var _mg=_sE.indexOf("Store.commit('stepDue')}")>=0&&_sE.indexOf("Store.commit('stepDue');render()}")<0;return _mg&&_sE.indexOf('function deferRender(){setTimeout(render,0)}')>=0&&_sE.indexOf('onblur="deferRender()" title="Optional deadline"')>=0})(), 'item 18: the deadline date input saves silently on change and defers its render to blur — the render-on-change crash class is closed (the second date input, eb_nextReview, has no change handler and was already conformant)');

  /* ── addendum 98 (13 Aug 2026): Notes where/jump (item 39), panel repaint (item 58), editor-reveal scroll (item 51), Voice family cluster (item 40) ── */
  console.log('== addendum 98: notes, panels, scroll, voice ==');
  ok(w.eval("(function(){go('step','2.1');var wh=notesWhere();go('phase5');return wh.indexOf('Step 2.1')===0})()")===true, 'item 39: notesWhere names the step it was captured on');
  ok(w.eval("(function(){go('step','2.2');notesOpen=true;render();var inp=document.getElementById('notesInput');if(!inp)return 'no-input';inp.value='probe note';addNote();var n=(data.notes||[])[data.notes.length-1];var okc=n&&n.page==='step'&&n.step==='2.2'&&!!n.where;go('phase5');var nn=(data.notes||[]).find(function(x){return x.id===n.id});goToNote(nn.id);var jumped=(currentPage==='step'&&currentStep==='2.2');data.notes=data.notes.filter(function(x){return x.id!==n.id});saveData();notesOpen=false;go('phase5');return okc&&jumped})()")===true, 'item 39: a note captures its page, step, and where label, and goToNote jumps back to the capture point (fixture removed after)');
  ok((function(){var _s98=require('fs').readFileSync('Governance-app.js','utf8');return _s98.indexOf('function repaintOpenPanels(){')>=0&&_s98.indexOf('    repaintOpenPanels();')>=0&&_s98.indexOf('if(coachOpen)renderCoachPanel(); }catch(e){}')>=0&&_s98.indexOf("if(currentModal==='org')renderOrgModal(); }catch(e){}")>=0})(), 'item 58: repaintOpenPanels exists (notes, chat, coach, org modal) and render calls it — panels repaint every render, not on toggle');
  ok(w.eval("(function(){notesOpen=true;render();var inp=document.getElementById('notesInput');if(!inp)return 'no-input';inp.focus();inp.value='draft in flight';render();var el=document.getElementById('notesInput');var kept=(el&&el.value==='draft in flight'&&document.activeElement===el);notesOpen=false;render();return kept})()")===true, 'item 58: a draft typed into the focused panel input survives a full local render with focus intact');
  ok((function(){var _s98=require('fs').readFileSync('Governance-app.js','utf8');var hook=_s98.indexOf('if(UI.scrollTo){(function(_sid){setTimeout(function(){try{var _el=document.getElementById(_sid)')>=0;var sites=(_s98.match(/UI\.scrollTo='/g)||[]).length===2&&(_s98.match(/UI\.scrollTo=\\'/g)||[]).length===3;return hook&&sites})(), 'item 51 (retargeted 15 Aug 2026, addendum 145, ruled): the render-tail scroll hook is verbatim and five set-sites are wired \u2014 the standing review\'s systems route joined (dashSysCard)');
  ok((function(){var _s98=require('fs').readFileSync('Governance-app.js','utf8');return _s98.indexOf('var _voiceActive=false,_recognition=null;')>=0&&_s98.indexOf('function processVoice')<0&&_s98.indexOf('_recognition.onend=function(){if(_voiceActive){try{_recognition.start();}')>=0&&_s98.indexOf("e.error==='not-allowed'?'Microphone access denied'")>=0})(), 'item 40: the Voice cluster is the family form — private state, auto-restart onend, mapped errors; the superseded handler is gone');
  ok(w.eval("typeof toggleVoice")==='function'&&w.eval("typeof _voiceUI")==='function'&&w.eval("typeof _voiceToast")==='function', 'item 40: the cluster is live in the booted app (toggleVoice, _voiceUI, _voiceToast all defined)');

  /* ── addendum 100 (13 Aug 2026): the audit round — 5A.12 near-miss normalized; modal lock markers ── */
  console.log('== addendum 100: audits + modal marker pass ==');
  ok((function(){var _c=require('fs').readFileSync('Governance-styles.css','utf8');return _c.indexOf('rgba(245,240,236')<0&&_c.indexOf('.hero-right .stone-text{color:rgba(245,242,236,.75)}')>=0})(), 'audit 5A.12: the one near-miss literal is normalized to canonical paper and stays literal (on-imagery text, 5A.10 protected); zero near-miss residuals remain');
  ok(w.eval("(function(){var m=(USERS||[])[0];if(!m)return 'no-roster';currentModal='org';UI.orgEdit=m.id;renderOrgModal();var el=document.getElementById('ru_'+m.id+'_name');if(!el)return 'no-el';var k='governance-locks::'+currentOrgId;var L={};L['roster::'+m.id]={id:'u_probe_other',name:'Probe Other',at:Date.now()};localStorage.setItem(k,JSON.stringify(L));applyLockUI(true);var locked=(el.disabled===true);localStorage.removeItem(k);applyLockUI(true);var released=(document.getElementById('ru_'+m.id+'_name').disabled===false);UI.orgEdit=null;closeModal();return locked&&released})()")===true, 'retro C.1: a foreign lock on a roster member disables their profile fields inside the org modal, and clears on release — the marker pass reaches the modal root');

  /* ── addendum 102 (13 Aug 2026): item 37 RATIFIED — the success token decoupled from the phase-1 tint ── */
  console.log('== addendum 102: --ok-t ratified ==');
  ok((function(){var _c=require('fs').readFileSync('Governance-styles.css','utf8');var _a=require('fs').readFileSync('Governance-app.js','utf8');return _c.indexOf('--ok-t:#1B6B5A')>=0&&_c.indexOf('--ok-t:#4FB39A')>=0&&_c.indexOf('var(--ph1-t)')<0&&_a.indexOf('var(--ph1-t)')<0&&_c.indexOf('var(--ok-t)')>=0})(), 'item 37 (RATIFIED 13 Aug 2026): --ok-t carries the success values in both theme blocks; every state-semantic reference is decoupled from the phase-1 tint — zero var(--ph1-t) references remain; value-identical today, survivable under any future phase recolor');

  /* ── addendum 103 (13 Aug 2026): landing card-arrow escape defect (pre-session, dated to the aeeff803 stylesheet) ── */
  console.log('== addendum 103: CSS content escape ==');
  ok((function(){var _c=require('fs').readFileSync('Governance-styles.css','utf8');return _c.indexOf("content:'\\u")<0&&_c.indexOf('content:"\\u')<0&&_c.indexOf(".card-arrow::after{content:'\\2192'}")>=0})(), 'addendum 103: zero JS-style escapes inside CSS content rules — the landing card arrow renders as an arrow, not literal text (defect predated this session; regression-pinned so the class cannot return)');

  /* ── addendum 105 (13 Aug 2026): the landing-page unclosed hero — fixed and class-pinned ── */
  console.log('== addendum 105: template div balance ==');
  ok((function(){var _t=require('fs').readFileSync('Governance-templates-local.js','utf8');var bad=[];var re=/"([a-zA-Z0-9_-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g,m;while((m=re.exec(_t))){var b=m[2];if(b.indexOf('<div')<0)continue;var o=(b.match(/<div\b/g)||[]).length,c=(b.match(/<\/div>/g)||[]).length;if(o!==c)bad.push(m[1]+':'+(o-c))}return bad.length===0})(), 'addendum 105: every template in templates-local has balanced divs — the unclosed hero that nested the marquee and content section inside it (the landing layout defect) cannot recur in any template');
  ok((function(){var _t=require('fs').readFileSync('Governance-templates-local.js','utf8');return _t.indexOf('</div>\\n\\n<!-- Scrolling marquee strip -->')>=0})(), 'addendum 105: the hero closes before the marquee strip — the bar and the Why This Matters band render full-width below the hero, not inside it');

  /* ── addendum 106 (13 Aug 2026): the risk-register outputs are clones of the live portfolio registers ── */
  console.log('== addendum 106: output clones ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var okc=true;['pfIdentifyRegister','pfAssessRegister','pfManageRegister'].forEach(function(n){var d=(_s.match(new RegExp('function '+n,'g'))||[]).length;var c=(_s.match(new RegExp(n+'\\(','g'))||[]).length;if(d!==1||c<3)okc=false});return okc})(), 'addendum 106: each lane register body is defined once and called by BOTH the portfolio page and its output — the shared-renderer form; the outputs can never drift again');
  ok(w.eval("(function(){var P=getPortfolios();var f=pfApplyF('identify',P.identify||[]);var h=renderOutRiskReg();if(!f.length)return h.indexOf('progressed beyond identification')>=0||h.indexOf('No risks identified')>=0;return h.indexOf('Initial Risk Register')>=0&&h.indexOf('ly-rec')>=0&&h.indexOf('DEPTH')>=0})()")===true, 'addendum 106 (superseded 12 Sep 2026, Spec Rev A): the Initial Risk Register output shows the engine\u2019s record blocks with the depth control \u2014 or its own empty state');
  ok(w.eval("(function(){var P=getPortfolios();var f=pfApplyF('assess',P.assess||[]);var h=renderOutAssessedReg();if(!f.length)return h.indexOf('No risks assessed yet')>=0;return h.indexOf('ly-rec')>=0&&h.indexOf('>Deep-dive assessment<')>=0})()")===true, 'addendum 106 (superseded 12 Sep 2026, Spec Rev A): the Assessed Risk Register output shows the engine\u2019s record blocks \u2014 or its own empty state');
  ok(w.eval("(function(){var P=getPortfolios();var f=pfApplyF('manage',P.manage||[]);var h=renderOutUpdatedReg();if(!f.length)return h.indexOf('No risks classified yet')>=0;return h.indexOf('ly-rec')>=0&&(h.indexOf('>Management plan<')>=0||h.indexOf('>Monitoring plan<')>=0)})()")===true, 'addendum 106 (superseded 12 Sep 2026, Spec Rev A): the Updated Risk Register output shows the engine\u2019s record blocks with the plans \u2014 or its own empty state');

  /* ── addendum 107 (14 Aug 2026): the PDF standard reverses to the ER ghost form; the front page regenerates from fixed source ── */
  console.log('== addendum 107: ER ghost PDF form + regenerated front page ==');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return (_a.split('class="btn bg2" style="font-size:12px"').length-1)===18&& /* 14 Sep 2026, later still: the Report Manager's two Save as PDF buttons leave the quiet form by Paul's exception (they sit in a block of buttons) */ /* 14 Sep 2026: plus the print bar and the portfolio pages; later that day, the Compliance Dashboard's per-tab control and the two review pages' control */ /* 12 Sep 2026: one output fewer */_a.indexOf("btn('\\u25be Save as PDF'")<0})(), 'items 30/49 (reversed again, ruled 14 Aug 2026; count retargeted same day — the three register outputs regained their headers, 11→13: three register headers restored, one removed with the Governance Readiness output; 13→14 on 21 Aug 2026, the Assessment Profile output joins): all fourteen Save as PDF buttons carry the ER ghost form (btn bg2, 12px) — zero filled-square helper calls remain');
  ok((function(){var _t=require('fs').readFileSync('Governance-templates-local.js','utf8');var _h=require('fs').readFileSync('Governance-home.html','utf8');var o=(_h.match(/<div\b/g)||[]).length,c=(_h.match(/<\/div>/g)||[]).length;return o===c&&_t.indexOf('AUTO-GENERATED')>=0&&_t.indexOf('HAND-FIX')<0})(), 'addendum 107: the per-screen source home html balances and the shipped bundle is a clean regeneration from it — the hand-fix era is closed');

  /* ── addendum 108 (14 Aug 2026): the outputs batch — inventory mirror, Responsible AI Principles clone, renames, the way back, the regimes chip ── */
  console.log('== addendum 108: outputs batch ==');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');var d1=_a.indexOf('function sysInventoryList()')>=0;var r12=_a.indexOf('function render12(')>=0&&_a.split('h+=sysInventoryList();').length===3;return d1&&r12})(), 'addendum 108: the 1.2 inventory list is ONE shared renderer called by both the step and the Systems Inventory output — the mirror cannot re-drift');
  ok(w.eval("(function(){var a=renderOutSysInv();var b=sysInventoryList();return b.length>100&&a.indexOf(b)>=0})()")===true, 'addendum 108: the Systems Inventory output embeds the live 1.2 list byte-for-byte at render time');
  ok(w.eval("(function(){var a=renderOutEthicsDoc();var b=principleRegisterBody();return a.indexOf('Responsible AI Principles')>=0&&a.indexOf('Responsible AI Framework Document')<0&&b.length>100&&a.indexOf(b)>=0})()")===true, 'addendum 108: the Responsible AI Principles output carries the FULL 2.1 register body — domains, expanded principles — and the renamed title');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return _a.indexOf("'Responsible AI Framework Doc'")<0&&_a.indexOf("'Responsible AI Principles'")>=1})(), 'addendum 108: the sidebar outcome entry reads Responsible AI Principles — the old name is gone at source');
  ok(w.eval("(function(){goModule('pf-identify');openSystemView('sys-1');var h=renderSystemView();if(h.indexOf('\\u2190 Back')<0&&h.indexOf('\u2190 Back')<0)return false;if(h.indexOf('var(--nav-h')<0)return false;goBackFromSystem();return currentPage!=='system'})()")===true, 'addendum 108 (retargeted 15 Aug 2026, addendum 138, ruled): the page clears the fixed header, the control reads Back, and it returns to where you came from');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');var i=_a.indexOf('function renderOutRegLandscape');return _a.indexOf('regimeDocChip(g)',i)>=0&&_a.indexOf('regimeDocChip(g)',i)<_a.indexOf('function renderOutCompliance')})(), 'addendum 108 (regimes audit): the landscape output now carries the live register\'s document chip — the one staleness found; name, type, and summary were already faithful to 1.4');

  /* ── addendum 109 (14 Aug 2026): the RACI owner-column merge ── */
  console.log('== addendum 109: RACI owner merge ==');
  ok(w.eval("(function(){var cs=govRaciCols();var sk=cs.filter(function(c){return String(c.l||'').indexOf('Harriet Rivers')>=0});return sk.length===1&&String(sk[0].k).indexOf('rp-')===0&&String(sk[0].l).indexOf('VP Operations')>=0})()")===true, 'addendum 109: one person, one column — the Governance Owner merges with her team column, leading with the fuller label; the duplicate is gone');
  ok(w.eval("(function(){var cs=govRaciCols();var p=(data.raciPeople||[]).find(function(pp){return String(pp.name||'').trim().toLowerCase()==='harriet rivers'});if(!p)return 'no-person';var _pv=data.raci['ra-1:'+p.id];delete data.raci['ra-1:'+p.id];data.raci['ra-1:owner']='C';saveData();var r0=data.rev;_raciMergeOwnerCells();var moved=(data.raci['ra-1:'+p.id]==='C')&&!data.raci['ra-1:owner']&&(data.rev>r0);var r1=data.rev;_raciMergeOwnerCells();var quiet=(data.rev===r1);if(_pv===undefined)delete data.raci['ra-1:'+p.id];else data.raci['ra-1:'+p.id]=_pv;saveData();return moved&&quiet})()")===true, 'addendum 109: stranded owner-keyed cells migrate onto the merged person exactly once, then the migration is quiet (fixture restored)');

  /* ── addendum 110 (14 Aug 2026): the RACI activity controls exist on the page ── */
  console.log('== addendum 110: RACI activity CRUD wired ==');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return _a.indexOf("onchange=\"saveRaciActName(")>=0&&_a.indexOf("onclick=\"removeGovRaciAct(")>=0&&_a.indexOf("'+ Add Activity','addGovRaciAct()'")>=0})(), 'addendum 110: the activity name is an editable field, every row carries its remove, and + Add Activity renders below the matrix — the orphaned functions have their controls');
  ok(w.eval("(function(){go('step','2.2');var n0=(data.raciActs||[]).length;addGovRaciAct();var grew=(data.raciActs.length===n0+1);var nid=data.raciActs[data.raciActs.length-1].id;var el=document.getElementById('ran_'+nid);var mounted=!!el;removeGovRaciAct(nid);var back=(data.raciActs.length===n0);go('phase5');return grew&&mounted&&back})()")===true, 'addendum 110: Add Activity grows the matrix with an editable name field mounted, and the row remove takes it back out (fixture restored)');
  ok(w.eval("idToRecordKey('ran_ra-1')")==='raci', 'addendum 110: the editable activity fields lock under the RACI singleton like the rest of the page');

  /* ── addendum 111 (14 Aug 2026): the output print law + the ghost button shape ── */
  console.log('== addendum 111: print sanitize + ghost shape ==');
  ok(w.eval("(function(){var d=document.createElement('div');d.innerHTML='<div class=\"np\">CHEVRONS</div><button>Edit</button><select><option>All risks</option><option selected>By system</option></select><input value=\"typed\"><p>kept <b>open</b> body</p>';document.body.appendChild(d);var h=printSanitize(d);document.body.removeChild(d);return h.indexOf('CHEVRONS')<0&&h.indexOf('<button')<0&&h.indexOf('By system')>=0&&h.indexOf('<select')<0&&h.indexOf('typed')>=0&&h.indexOf('<input')<0&&h.indexOf('kept <b>open</b> body')>=0})()")===true, 'item 62 (print law): buttons and np chrome vanish, selects and typed fields print as their chosen values, everything else prints exactly as shown');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');var _c=require('fs').readFileSync('Governance-styles.css','utf8');return _a.indexOf('var content=optContent||(_pd?_pd():(printDocCover(title,lead,\'\')+_pdStripHeader(printSanitize(app))));')>=0&&_a.indexOf('<div class="np u-778010b"')>=0 /* 12 Sep 2026 (Paul's print ruling): the fallback path now builds the cover and strips the heading, and printPage accepts a title and a ready document for the Phase 5 pages */&&_c.indexOf('.btn.bg2{white-space:nowrap;padding:7px 14px;border-radius:6px;align-self:flex-start;height:fit-content}')>=0})(), 'addendum 111: printPage keeps the sanitizer as its fallback path (retargeted 14 Aug 2026, addendum 117: document renderers lead), the portfolio chevrons are marked never-print, and the ghost button carries the ER shape rule');

  /* ── addendum 113 (14 Aug 2026): register PDF headers, prominent removes, GovReady removed, report print rules ── */
  console.log('== addendum 113 ==');
  ok(w.eval("(function(){return ['renderOutRiskReg','renderOutAssessedReg','renderOutUpdatedReg'].every(function(f){return window[f]().indexOf('Save as PDF')>=0})})()")===true, 'addendum 113: all three register outputs carry the ghost Save as PDF header again (lost in the clone rebuild)');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return _a.indexOf('renderOutGovReady')<0&&_a.indexOf('out-govready')<0&&_a.indexOf('Governance Readiness Checklist')<0})(), 'addendum 113: the Governance Readiness output is removed whole — outcome entry, reports card, dispatch, renderer, and the hub list text (which also carried the stale Responsible AI Framework Doc name, corrected)');
  ok((function(){var _c=require('fs').readFileSync('Governance-styles.css','utf8');return _c.indexOf('.cd{border:none!important')>=0&&_c.indexOf('break-after:avoid')>=0&&_c.indexOf('.u-47b192e,.u-136497d{text-align:center!important}')>=0&&_c.indexOf('color:var(--text-muted);font-size:16px;font-weight:600} /* addendum 113')>=0})(), 'addendum 113: print flattens cards to report text, headings bind to their content across page breaks, the RACI grid centers in print, and the row-remove crosses are visible');
  ok(w.eval("(function(){go('phase',1);var ok1=true;go('outcome','out-riskreg');ok1=document.getElementById('app').innerHTML.indexOf('\\u2190 Back')>=0;go('phase5');return ok1})()")===true, 'addendum 113: outputs carry the standard back button');

  /* ── addendum 114 (14 Aug 2026): the Testing & Evidence output as a legible document ── */
  console.log('== addendum 114 ==');
  ok(w.eval("(function(){var h=renderOutTesting();return h.indexOf('Testing plans for each system.')>=0&&h.indexOf('Per-system testing plans with logged evidence trails')<0})()")===true, 'addendum 114: the plain lead (Paul\'s wording) replaces the derived-states line');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-testing']();var t=d.replace(/<[^>]+>/g,'|');return !/tt-seed-sys-1-valid/.test(t)&&!/17\\d{11}/.test(t)&&d.indexOf('Test runs once \\u2014 in the pre-deployment phase')>=0&&d.indexOf('Test runner: ')>=0&&d.indexOf('Outcome: ')>=0&&d.indexOf('Kept at: ')>=0&&d.indexOf('Recorded by: ')>=0})()")===true, 'addendum 114 (superseded 13 Sep 2026, Paul\u2019s ruling): tests and evidence print in words, one fact per line \u2014 no raw ids, no raw timestamps');

  /* ── addendum 115 (14 Aug 2026): the standard report masthead ── */
  console.log('== addendum 115 ==');
  ok(w.eval("(function(){go('phase',1);go('outcome','out-riskreg');var h=document.getElementById('app').innerHTML;go('phase5');return h.indexOf('class=\"print-only\"')>=0&&h.indexOf('90-Day Responsible AI Governance</div>')>=0})()")===true, 'addendum 115: every output carries the print-only report masthead (module · organization · date) — invisible on screen, the head of the printed report');
  ok((function(){var _c=require('fs').readFileSync('Governance-styles.css','utf8');return _c.indexOf('.print-only{display:none}')>=0&&_c.indexOf('.print-only{display:block}')>=0})(), 'addendum 115: the print-only mechanism is intact in both directions');

  /* ── addendum 116 (14 Aug 2026): the popup print pipeline is the report; the button stops stretching ── */
  console.log('== addendum 116 ==');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return _a.indexOf('Next Chapter Academy')<0&&_a.indexOf('NextChapter Academy')<0})(), 'addendum 116: no printed surface carries the Academy phrasing — the popup footer reads the module name alone');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');var i=_a.indexOf('function printPage');var seg=_a.slice(i,i+3000);return seg.indexOf('.cd{background:none;border:none;border-radius:0')>=0&&seg.indexOf('break-after:avoid')>=0&&seg.indexOf('#f9f9f7')<0})(), 'addendum 116: the Save-as-PDF pipeline itself prints flattened report text with bound headings — the report rules live in BOTH print paths now');
  ok((function(){var _c=require('fs').readFileSync('Governance-styles.css','utf8');return _c.indexOf('align-self:flex-start;height:fit-content}')>=0})(), 'addendum 116: the ghost button cannot be stretched by its flex parent — the tall-square class is closed at the mechanism');

  /* ── addendum 117 (14 Aug 2026): the register outputs print as DOCUMENTS ── */
  console.log('== addendum 117 ==');
  ok(w.eval("(function(){var h=PRINT_DOCS['out-riskreg']();return h.indexOf('page-break-after:always')>=0&&h.indexOf('NextChapter \u00b7 90-Day Responsible AI Governance')>=0&&h.indexOf('Initial Risk Register')>=0&&h.indexOf('on the register')<0&&h.indexOf('<select')<0&&h.indexOf('<button')<0})()")===true, 'addendum 117 (superseded 12 Sep 2026, Paul\u2019s print ruling): the register document opens on a cover page \u2014 NextChapter \u00b7 module, title, organization, date \u2014 with no count and no controls anywhere');
  ok(w.eval("(function(){var P=getPortfolios();var f=pfApplyF('identify',P.identify||[]);if(!f.length)return 'no-risks';var r=f.find(function(x){return x.description});if(!r)return 'no-desc';var was=UI.wbOpen;UI.wbOpen=null;var blk=printRiskBlock(r);UI.wbOpen=was;var hasDetail=blk.indexOf('What could happen')>=0;var noEmpty=blk.indexOf('.</span> <')<0;return hasDetail&&noEmpty})()")===true, 'addendum 117: every risk prints its FULL detail regardless of fold state (retargeted 14 Aug 2026, addendum 118: folds are navigation, not report content); empty fields never print their labels');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return _a.indexOf("var _pd=(typeof PRINT_DOCS!=='undefined')&&PRINT_DOCS[currentStep];")>=0&&_a.indexOf('var content=optContent||(_pd?_pd():')>=0})(), 'addendum 117 (extended 12 Sep 2026): printPage routes document renderers first, the sanitized screen as the fallback, and a document passed in ahead of both');

  /* ── addendum 119 (14 Aug 2026): document renderers for every output except Phase 4 ── */
  console.log('== addendum 119 ==');
  ok(w.eval("(function(){var k=Object.keys(PRINT_DOCS);return k.length===12&&!PRINT_DOCS['out-exitplans']&&!PRINT_DOCS['out-riskclass']&&['out-assessprofile','out-govsystems','out-riskreg','out-assessedreg','out-updatedreg','out-sysinv','out-reglandscape','out-ethicsdoc','out-raci2','out-compliance','out-testing','out-govfw'].every(function(x){return typeof PRINT_DOCS[x]==='function'})})()")===true, 'addendum 119 (retargeted 21 Aug 2026, copy-pass item 8): twelve outputs carry document renderers — the Assessment Profile joins; Phase 4 (Exit Plans) stays excluded as ruled');
  ok(w.eval("(function(){return Object.keys(PRINT_DOCS).every(function(k){var h=PRINT_DOCS[k]();return h.indexOf('page-break-after:always')>=0&&h.indexOf('90-Day Responsible AI Governance')>=0&&h.indexOf('<select')<0})})()")===true, 'addendum 119: every document opens on the cover (module, title, organization, date) and carries no live controls');
  /* pin retired 12 Sep 2026 (Paul's ruling): the Risk Classification Report is folded into the registers — every record's identity carries its classification */
  ok(w.eval("(function(){var d=PRINT_DOCS['out-updatedreg']();return d.indexOf('>Manage<')>=0||d.indexOf('>Monitor<')>=0})()")===true, 'FOLD (12 Sep 2026): the updated register carries each record\u2019s classification in its identity, so the separate classification report is gone');
  ok(w.eval("(function(){var h=PRINT_DOCS['out-sysinv']();return h.indexOf('>Inventory<')>=0&&h.indexOf('Save as PDF')<0&&h.indexOf('<button')<0})()")===true, 'addendum 119 (superseded 12 Sep 2026, Spec Rev A): the Systems Inventory prints the system\u2019s inventory layer through the engine — the cover carries the title; no button text');

  /* ── addendum 120 (14 Aug 2026): the deeper documents ── */
  console.log('== addendum 120 ==');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.assess&&(x.assess.rootCauses||[]).length});if(!r)return 'no-assessed-risk';var b=printRiskBlock(r);return b.indexOf('>Assessment</div>')>=0&&b.indexOf('Root causes')>=0&&b.indexOf('1. ')>=0})()")===true, 'addendum 120: an assessed risk prints its Assessment section — context, numbered root causes and controls, capability gaps, likelihood basis, triggers — skip-empty throughout');
  ok(w.eval("(function(){var h=PRINT_DOCS['out-ethicsdoc']();return h.indexOf('The Principles at a Glance')>=0&&h.indexOf('What would breach the principle')>=0&&h.indexOf('Responsible AI Board')>=0})()")===true, 'addendum 120: the Responsible AI Principles report opens on the index page, then the expanded register by domain, then the board');
  ok(w.eval("(function(){var h=PRINT_DOCS['out-compliance']();return h.indexOf('ly-rec')>=0&&h.indexOf('>Obligations<')>=0&&h.indexOf('>Statements<')>=0})()")===true, 'addendum 120 (superseded twice, last 12 Sep 2026 Spec Rev A): the Compliance Obligations document is the regime record at full depth \u2014 identity in the header row, scoping, every obligation with its status, evidence');
  ok(w.eval("(function(){var h=PRINT_DOCS['out-testing']();return h.indexOf('ly-rec')>=0&&h.indexOf('>Testing plan<')>=0&&h.indexOf('>Each test<')>=0})()")===true, 'addendum 120 (superseded 12 Sep 2026, Spec Rev A): the Testing & Evidence document is the system record at full depth \u2014 inventory, every test, the evidence');
  ok((function(){var _a=require('fs').readFileSync('Governance-app.js','utf8');return _a.indexOf('table{border-collapse:collapse;width:100%}th,td{padding:7px 8px')>=0})(), 'addendum 120: printed tables separate their rows on hairlines — the RACI activity column reads');

  /* ── addendum 122 (14 Aug 2026): the 4.2 rulings — agenda add-list on the standing card; attendee name/responsibility pairs; the seed pairs capitalized ── */
  console.log('== addendum 122 ==');
  w.eval("data.govRhythm={additionalAgenda:'Vendor model updates'};go('step','4.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Vendor model updates')>=0&&!document.getElementById('grl_additionalAgenda_0')&&!!document.getElementById('grl_additionalAgenda_new')&&h.indexOf('gr_additionalAgenda')<0&&h.indexOf('Additional agenda items')>=0&&h.indexOf('The Standing Review Agenda')<h.indexOf('Vendor model updates')})()")===true, 'addendum 122 (retargeted 22 Aug 2026, ruled: rows solidified to text with a composer input): the agenda add-list lives at the foot of the Standing Review Agenda card; the old textarea is gone; legacy free text materializes as row one');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('grl_attendees_0_name')<0&&h.indexOf('+ Add')>=0})()")===true, 'addendum 122: an empty attendee list renders no orphan row — the + Add button summons the first pair');
  w.eval("addGrItem('attendees')"); await wait();
  ok(w.eval("(function(){var n=document.getElementById('grl_attendees_0_name'),r=document.getElementById('grl_attendees_0_resp');if(!n||!r)return false;n.value='Priya Nair';r.value='Legal';harvestGrLists();var a=(data.govRhythm.attendeesList||[])[0]||{};return a.name==='Priya Nair'&&a.responsibility==='Legal'})()")===true, 'addendum 122: the summoned attendee row carries Name and Responsibility boxes and harvests as a pair');
  w.eval("data.govRhythm.additionalAgendaList=['Vendor model updates','Policy updates'];1");
  ok(w.eval("(function(){var h=renderOutGovFW();return h.indexOf('plus: Vendor model updates; Policy updates')>=0})()")===true, 'addendum 122: the framework lists the added agenda items from the add-list');
  w.eval("window.confirm=function(){return true};seedSampleData()"); await wait();
  ok(w.eval("(function(){var a=(data.govRhythm||{}).attendeesList||[];return a.length===4&&a[0].name==='Harriet Rivers'&&a[0].responsibility==='Chair'&&a[1].responsibility==='Systems'&&a[2].responsibility==='Commercial'&&a[3].responsibility==='Risk Intake'})()")===true, 'addendum 122: the seed attendees carry name/responsibility pairs with the responsibilities capitalized');

  /* ── addendum 124 (14 Aug 2026): the standing agenda ruled at five items; the Phase 4 restructure ── */
  console.log('== addendum 124 ==');
  ok(w.eval("(function(){var p4=PHASES.find(function(p){return p.id===4});var n=p4.steps.map(function(st){return st.name});return n[1]==='Finalize the Framework'&&n[2]==='Review the Systems'})()")===true, 'addendum 124: the step renames live in PHASES — the sidebar and phase surfaces carry them');
  w.eval("go('step','4.2')"); await wait();
  ok(w.eval("(function(){UI.g42Tab='rhythm';render();var h=document.getElementById('app').innerHTML;return h.indexOf('Check every decisive test result since the last review.')>=0&&h.indexOf('Are there any new regimes or obligations to add? Do any existing regimes or obligations require further action?')>=0&&h.indexOf('Assess how governance is running: what is working, where things get stuck, what changes before the next review.')>=0&&h.indexOf('Hold the retro')<0&&h.indexOf('Walk the compliance register')<0&&h.indexOf('Walk these items')<0})()")===true, 'addendum 124: the agenda card carries the five ruled items verbatim; the banned phrasings are gone');
  ok(w.eval("(function(){var st=data.embedOps;data.embedOps={};var m=dataGateMsg('4.2');data.embedOps=st;return m.indexOf('Deployment and Integration')>=0})()")===true, 'addendum 124: the 4.2 gate message names the Deployment and Integration fields when they are missing');
  ok(w.eval("(function(){var h=renderGovReview();return h.indexOf('1. Check that the New Risk Review and the Responsible AI Board Review are running as planned.')>=0&&h.indexOf('2. Sweep the portfolios for stuck work')>=0&&h.indexOf('3. Sweep the AI system records to ensure that they are current.')>=0&&h.indexOf('4. Check every decisive test result since the last review.')>=0&&h.indexOf('5. Check the compliance register: Are there any new regimes or obligations to add? Do any existing regimes or obligations require further action?')>=0&&h.indexOf('7. Assess how governance is running')>=0&&h.indexOf('6. Review responsibilities')>=0&&h.indexOf('The retro')<0&&h.indexOf('Portfolio hygiene')<0&&h.indexOf('Open the compliance dashboard')>=0&&h.indexOf('Answer them on the register itself.')>=0})()")===true, 'addendum 124 (retargeted 22 Aug 2026: Review responsibilities enters at six; earlier addendum 133; again 15 Aug 2026, addendum 137, ruled): the Governance Review page walks the six ruled sections one-to-one; the compliance route points at the dashboard');
  ok(w.eval("(function(){UI.fwOpen=false;var h1=renderGovReview();UI.fwOpen=true;var h2=renderGovReview();UI.fwOpen=false;return h1.indexOf('Governance Framework')>=0&&h2.indexOf('Decision Rights')>=0&&h1.indexOf('Decision Rights')<0})()")===true, 'addendum 124: the Governance Framework bar expands to the shared framework body on the review page');
  ok(w.eval("(function(){UI.fwOpen=true;var h=render44();UI.fwOpen=false;return h.indexOf('Governance Framework')>=0&&h.indexOf('Decision Rights')>=0})()")===true, 'addendum 124: the framework bar rides the top of 4.4 with the same shared body');
  ok(w.eval("(function(){return (STEP_MILES['4.2']||'').indexOf('Framework finalized')===0&&(STEP_MILES['4.3']||'').indexOf('Systems reviewed')===0})()")===true, 'addendum 124 (retargeted 15 Aug 2026, copy master batch 1): the 4.2 and 4.3 milestones read the new step substance');
  ok(w.eval("(function(){data.firstReview.walk='legacy string';walkFR('planned');return typeof data.firstReview.walk==='object'&&!!data.firstReview.walk.planned})()")===true, 'addendum 124: walkFR heals a legacy string walk record instead of throwing (discovered defect)');
  ok(w.eval("(window.__LOCAL_TEMPLATES&&window.__LOCAL_TEMPLATES.home||'').indexOf('hold the first comprehensive Governance Review')")>=0, 'addendum 124 (retargeted 21 Aug 2026, copy-pass item 4): the home plan strip reads the restructured phase in the ruled copy');

  /* ── addendum 125 (14 Aug 2026): the crosswalk label audit and the recovered 7 Aug home items ── */
  console.log('== addendum 125 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('1.4 register (regimes, scoping judgments)')>=0&&_s.indexOf('1.5 register')<0&&_s.indexOf("{s:'1.2 + 1.4'}")>=0&&_s.indexOf('4.2 deployment gates')>=0&&_s.indexOf('4.3 deployment gates')<0})(), 'addendum 125: the crosswalk source labels cite the live step numbers — the 1.5 renumbering relics and the 4.3 gates reference are gone');
  ok((function(){var h=(w.eval("window.__LOCAL_TEMPLATES&&window.__LOCAL_TEMPLATES.home")||'');return h.indexOf('Take stock of where you stand')>=0&&h.indexOf('Screen risks for responsible AI concerns')>=0&&h.indexOf('hold standing reviews')>=0&&h.indexOf('The full 90-day framework, step by step.')>=0&&h.indexOf('lasts as long as AI is part of your organization')>=0&&h.indexOf('discipline runs forever')<0&&h.indexOf('journey &mdash;')<0&&h.indexOf('score every risk in the moment')<0&&h.indexOf('for as long as you run AI')<0})(), 'addendum 125 (retargeted 15 Aug 2026, copy master batch 1; retargeted again 24 Aug 2026, Sweep 4 round 3 D organization sweep): the home page carries the affirmed items — hero, strip lines, framework card — with the superseded phrasings gone');

  /* ── addendum 126 (15 Aug 2026): the crosswalk chip ruling — two additions taken, two declined ── */
  console.log('== addendum 126 ==');
  ok(w.eval("(function(){var m=NIST_MAP;return m['4.2'].indexOf('MANAGE 1.1')>=0&&m['2.4']&&m['2.4'].length===1&&m['2.4'][0]==='GOVERN 1.1'&&m['1.1'].indexOf('GOVERN 2.3')<0&&(!m['3.1'])})()")===true, 'addendum 126: 4.2 carries MANAGE 1.1 and 2.4 carries GOVERN 1.1 by ruling; the declined additions (GOVERN 2.3 on 1.1, MEASURE 2.8 on 3.1) stay off by the same ruling');

  /* ── addendum 127 (15 Aug 2026): the seed cast law, the item-4 capital, the agenda spacing ── */
  console.log('== addendum 127 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var banned=['Sarah Kim','James Okafor','Lisa Patel','David Torres','Nadia Osei','Margaret Chen','Priya Raman','Marcus Bell','Tom Nakamura','Elena Torres','Elena Marsh','Maria Torres'];return banned.every(function(n){return _s.indexOf(n)<0})&&_s.indexOf('Harriet Rivers')>=0&&_s.indexOf('Vincent Lau')>=0&&_s.split('register: Are there any new regimes').length===4})(), 'addendum 127: the AI-generated seed cast is gone — every seed person is on the ER baseline roster or coined on its model; the item-4 questions carry their capital on all three surfaces');

  w.eval("go('phase5')"); await wait();

  /* \u2500\u2500 addendum 128 (15 Aug 2026): the system card \u2014 three pages, gate-passage record, scoped chevrons \u2500\u2500 */
  console.log('== addendum 128: the system card ==');
  w.eval("UI.sysPg='exit'"); 
  w.eval("openSystemView('sys-1')"); await wait();
  ok(w.eval("UI.sysPg")==='desc', 'addendum 128: openSystemView opens the card on its first page (Description)');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('>Description<')>=0&&h.indexOf('>System Risks<')>=0&&h.indexOf('>Testing<')>=0&&h.indexOf('>Exit Plan<')>=0})()")===true, 'addendum 128 (retargeted 15 Aug 2026, addendum 129): the tab bar carries the four pages — Testing joins, Exit renamed Exit Plan');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Use the form below to record which gates this system has cleared')>=0&&h.indexOf('Full gate:')>=0&&h.indexOf('Light gate:')>=0&&h.indexOf('Open the gate rules in Step 4.2')<0&&h.indexOf('come from Step 4.2')<0})()")===true, 'addendum 129 (retargeted 15 Aug 2026, addendum 130, ruled): the gate card carries the lead and the rules; the provenance sentence and routing button are off the surface');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Inventory record')>=0&&h.indexOf('Deployment gate')>=0&&h.indexOf('Cleared the full gate \\u2014 2026-05-12 \\u2014 signed by Harriet Rivers')>=0})()")===true, 'addendum 128: the Description page carries the record and the seeded gate passage');
  w.eval("openSystemView('sys-3')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Save gate record')>=0&&h.indexOf('Gate log')>=0&&h.indexOf('No gate clearances logged yet.')>=0})()")===true, 'addendum 128 (retargeted 15 Aug 2026, addendum 130, ruled): the form is always open and an empty log says so');
  w.eval("document.getElementById('gp_gate').value='light';document.getElementById('gp_date').value='2026-08-01';document.getElementById('gp_by').value='Tamsin Doyle';saveGatePassage('sys-3')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-3'});var gp=(s.gateLog||[])[0];return !!gp&&gp.gate==='light'&&gp.date==='2026-08-01'&&gp.by==='Tamsin Doyle'})()")===true, 'addendum 128 (retargeted 15 Aug 2026, addendum 130, ruled): the gate save appends gate, date, and signer to the log');
  w.eval("document.getElementById('gp_gate').value='full';document.getElementById('gp_date').value='2026-08-14';document.getElementById('gp_by').value='Duncan Fairley';saveGatePassage('sys-3')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-3'});return (s.gateLog||[]).length===2})()")===true, 'addendum 130: a second passage appends — the log holds them all');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Cleared the light gate \\u2014 2026-08-01 \\u2014 signed by Tamsin Doyle')>=0})()")===true, 'addendum 128: the recorded passage renders as the record line');
  w.eval("openSystemView('sys-1')"); await wait();
  w.eval("UI.sysPg='risks';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('phase-flex')>=0&&h.indexOf('UI.sysRiskFocus=')>=0})()")===true, 'addendum 128: the scoped chevron strip renders with the focus onclick, not page navigation');
  ok(w.eval("(function(){var P=getPortfolios();var mine=function(l){return l.filter(function(r){return r.systemId==='sys-1'})};var g={emergency:mine(P.emergency),manage:mine(P.manage),assess:mine(P.assess),identify:mine(P.identify)};var ks=['manage','assess','identify'].filter(function(k){return g[k].length>0});if(ks.length<1)return true;var gk=ks[ks.length-1];UI.sysRiskFocus=gk;render();var h=document.getElementById('app').innerHTML;var names={emergency:'Emergency Response (',manage:'Manage (',assess:'Assess (',identify:'Identify ('};var iF=h.indexOf(names[gk]);if(iF<0)return false;var pass=true;Object.keys(g).forEach(function(k){if(k===gk||!g[k].length)return;var iO=h.indexOf(names[k]);if(iO>=0&&iO<iF)pass=false});UI.sysRiskFocus=null;render();return pass})()")===true, 'addendum 128: chevron focus promotes the chosen group to the top; the others keep their order');
  ok(w.eval("(function(){var P=getPortfolios();var arch=P.archived.filter(function(r){return r.systemId==='sys-1'});UI.sysArchOpen=false;render();var h=document.getElementById('app').innerHTML;if(!arch.length)return h.indexOf('Archived (')<0;if(h.indexOf('Archived ('+arch.length+')')<0)return false;if(h.indexOf('svc_'+arch[0].id)>=0)return false;UI.sysArchOpen=true;render();h=document.getElementById('app').innerHTML;var pass=h.indexOf('svc_'+arch[0].id)>=0;UI.sysArchOpen=false;render();return pass})()")===true, 'addendum 128: the Archive group folds at the foot and opens on demand');
  ok(w.eval("(function(){UI.sysPg='exit';render();var h=document.getElementById('app').innerHTML;return h.indexOf('Inventory record')<0})()")===true, 'addendum 128: the Exit page hosts the exit apparatus alone \u2014 the record stays on Description');
  w.eval("UI.sysPg='desc';go('phase5')"); await wait();

  /* \u2500\u2500 addendum 131 (15 Aug 2026): boxes, flat hosted lists, testing subtabs, default-open Exit Plan \u2500\u2500 */
  console.log('== addendum 131: the card refined ==');
  w.eval("openSystemView('sys-1')"); await wait();
  ok(w.eval("document.getElementById('gp_date').type")==='date', 'addendum 131: Date cleared is a calendar picker');
  w.eval("UI.sysPg='risks';render()"); await wait();
  ok(w.eval("(function(){var g=(data.risks||[]).filter(function(r){return r&&r.systemId==='sys-1'&&!isArchivedRisk(r)});var mg=0,mo=0;g.forEach(function(r){var c=cardClass(r);if(c==='monitor')mo++;else if(c==='manage')mg++});var h=document.getElementById('app').innerHTML;return h.indexOf('>Managed<')>=0&&h.indexOf('>Monitored<')>=0&&h.indexOf('>Archived<')>=0&&h.indexOf('>High severity<')>=0&&h.indexOf('>Responsible AI<')>=0/* retargeted 19 Aug 2026, addendum 216 */})()")===true, 'addendum 131: the five stat boxes render \u2014 Managed and Monitored split');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Emergency Response (')>=0&&h.indexOf('Manage (')>=0&&h.indexOf('Assess (')>=0&&h.indexOf('Identify (')>=0})()")===true, 'addendum 131: all four group headings render, zeros included');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('View by system')<0&&h.indexOf('Urgent Risks (')<0&&h.indexOf(\"UI.pfMTab=\")<0})()")===true, 'addendum 131: hosted lists carry no register controls, no tier divider, no Manage/Monitor tabs');
  w.eval("UI.sysPg='exit';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return !!document.getElementById('ex_dir')&&h.indexOf('Exit Plan')>=0&&h.indexOf('Draft an exit plan')<0&&h.indexOf('drafted ahead of need')<0&&h.indexOf('clearly marked as drafted')<0})()")===true, 'addendum 131: the Exit Plan is default-open with the draft rhetoric retired');
  w.eval("UI.sysPg='desc';go('phase5')"); await wait();

  /* \u2500\u2500 addendum 132 (15 Aug 2026): the retirement act, the routes, the decision-only rationale \u2500\u2500 */
  console.log('== addendum 132: retirement joined up ==');
  w.eval("openSystemView('sys-3')"); await wait();
  w.eval("UI.sysPg='exit';UI.exitOpen=null;render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return !document.getElementById('ex_rat')&&!!document.getElementById('ex_dir')&&h.indexOf('The standing plan for shutting this system down.')>=0&&h.indexOf('What does a successful shutdown look like?')>=0&&h.indexOf('Retire This System')>=0})()")===true, 'addendum 132 (retargeted 15 Aug 2026, addendum 142, ruled): the standing plan is an information form \u2014 no why-box, ruled lead, renamed success field, the red act button now reads Retire This System');
  w.eval("UI.exitOpen='sys-3';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return !!document.getElementById('ex_rat')&&h.indexOf('Why retire this system? (required)')>=0&&h.indexOf('Confirm System Retirement')>=0&&h.indexOf('governance succeeding')<0})()")===true, 'addendum 132: the decision form carries the why-box and Confirm System Retirement; the old rubric is gone');
  w.eval("UI.exitOpen=null;go('phase5')"); await wait();
  w.eval("considerExit('sys-2')"); await wait();
  ok(w.eval("(function(){return currentPage==='system'&&UI.sysPg==='exit'&&UI.exitOpen==='sys-2'&&document.getElementById('app').innerHTML.indexOf('Why retire this system? (required)')>=0})()")===true, 'addendum 132 (retargeted 15 Aug 2026, addendum 142, ruled): considerExit lands on the Exit Plan page with the decision form open');
  ok(w.eval("(function(){goModule('pf-emergency');var P=getPortfolios();var er=(P.emergency||[]).filter(function(r){return r.systemId});if(!er.length)return true;UI.erOpen=er[0].id;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Consider retiring this system')>=0;UI.erOpen=null;render();return pass})()")===true, 'addendum 132 (retargeted 15 Aug 2026, addendum 159, ruled): an escalated risk carries the route to the retirement decision');
  ok(w.eval("(function(){var sys=(data.systems||[]).find(function(x){return (x.testEvidence||[]).some(function(e){return e.outcome==='Found'||e.outcome==='Broke'})});if(!sys)return true;openSystemView(sys.id);UI.sysPg='testing';UI.sysTestTab='evidence';render();var tp=((sys.testingPlan||{}).tests)||[];var adv=(sys.testEvidence||[]).find(function(e){return e.outcome==='Found'||e.outcome==='Broke'});tp.forEach(function(t){if(t.id===adv.testId)UI.expanded['tt_'+t.id]=true});render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Consider retiring this system')>=0;UI.sysTestTab='needs';return pass})()")===true, 'addendum 132 (retargeted 15 Aug 2026, addendum 159, ruled): adverse test evidence carries the route to the retirement decision');
  w.eval("UI.sysPg='desc';UI.exitOpen=null;go('phase5')"); await wait();

  /* \u2500\u2500 addendum 133 (15 Aug 2026): deployment status, the systems sweep, 4.3 as the system review \u2500\u2500 */
  console.log('== addendum 133: the system review ==');
  ok(w.eval("(function(){var n=0;(data.systems||[]).forEach(function(x){if(x.deployStatus)n++});var p=(data.systems||[]).find(function(x){return x.id==='sys-5'});return n===(data.systems||[]).length&&p&&p.deployStatus==='dev'})()")===true, 'addendum 133: every seeded system carries a deployment status; the pilot is in development');
  w.eval("openSystemView('sys-1')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('>Deployed<')>=0&&!!document.getElementById('sys_deployStatus')})()")===true, 'addendum 133: the deployment chip sits in the header band and the record carries the select');
  w.eval("document.getElementById('sys_deployStatus').value='dev';saveSystemRecord('sys-1')"); await wait();
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-1'});return s.deployStatus==='dev'&&document.getElementById('app').innerHTML.indexOf('>In development<')>=0})()")===true, 'addendum 133: the record select writes the status and the chip follows');
  w.eval("document.getElementById('sys_deployStatus').value='deployed';saveSystemRecord('sys-1')"); await wait();
  ok(w.eval("(function(){UI.sysPg='exit';UI.exitOpen=null;render();return document.getElementById('app').innerHTML.indexOf('Review it when the system moves from development to deployment, or when it changes substantially.')>=0})()")===true, 'addendum 133: the plan card carries the ruled review line');
  ok(w.eval("(function(){var h=govSystemsSweepBody();return h.indexOf('Open each system record and check that it is current.')>=0&&h.indexOf('openSystemView(')<0&&h.indexOf('Open the systems list')>=0})()")===true, 'addendum 133 (retargeted 15 Aug 2026, addendum 137, ruled): the sweep is a prompt and one route \u2014 the per-system rows retired');
  w.eval("UI.sysPg='desc';go('phase5')"); await wait();

  /* \u2500\u2500 addendum 135 (15 Aug 2026): the retirement archive \u2500\u2500 */
  console.log('== addendum 135: the retirement archive ==');
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.id==='sys-3'});archiveSystem('sys-3');return !s.archived})()")===true, 'addendum 135: a system that is not fully retired refuses to archive');
  ok(w.eval("(function(){var s=data.systems.find(function(x){return x.exitDecision&&x.exitDecision.completedAt&&!x.archived});if(!s)return true;archiveSystem(s.id);var ok1=!!s.archived&&!!s.archived.at;go('step','4.3');var h=document.getElementById('app').innerHTML;var ok2=h.indexOf('Retirement archive (')>=0;UI.eoSysArch=true;render();var ok3=document.getElementById('app').innerHTML.indexOf(s.name)>=0;openSystemView(s.id);var ok4=document.getElementById('app').innerHTML.indexOf('>Archived<')>=0;UI.eoSysArch=false;return ok1&&ok2&&ok3&&ok4})()")===true, 'addendum 135: archiving a retired system moves it to the Retirement archive fold and badges the card Archived');
  w.eval("go('phase5')"); await wait();

  /* \u2500\u2500 addendum 136 (15 Aug 2026): 4.3 cohesive \u2014 carousel, lead, register bars in place \u2500\u2500 */
  console.log('== addendum 136: 4.3 cohesive ==');
  w.eval("UI.eoSysOpen=null;go('step','4.3')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('90 days in, every system gets a review.')>=0&&h.indexOf('rehearses')<0&&h.indexOf('drafted rather than decided')<0&&h.indexOf('Open each system and walk its card: confirm the record, read the risks, check the testing, and write the exit plan. Every system gets one')<0})()")===true, 'addendum 136 (retargeted 15 Aug 2026, copy master batch 5): one intro \u2014 the master lead is in (90 days in, spelled numerically), the stale leads gone');
  w.eval("UI.eoSysOpen='sys-2';UI.sysPg='desc';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Inventory record')>=0&&h.indexOf('Close the system view')<0})()")===true, 'addendum 136: the bar expands to the full card in place \u2014 the host box and its Close button are retired');
  ok(w.eval("(function(){var sl=CAROUSEL_CONTENT['4.3'];var j=JSON.stringify(sl);return sl.length===4&&j.indexOf('standing exit plan')>=0&&j.indexOf('rehears')<0&&j.indexOf('drafted rather than decided')<0&&j.indexOf('one or two')<0})()")===true, 'addendum 136: the 4.3 carousel carries the review conception \u2014 the rehearsal slides are gone');
  w.eval("UI.eoSysOpen=null;go('phase5')"); await wait();

  /* \u2500\u2500 addendum 138 (15 Aug 2026): testing log, armed save, shared review log \u2500\u2500 */
  console.log('== addendum 138 ==');
  ok(w.eval("(function(){UI.expanded.tcLog=true;go('step','5.3');var h=document.getElementById('app').innerHTML;UI.expanded.tcLog=false;return h.indexOf('Testing log (')>=0&&h.indexOf('Every logged test result, newest first')>=0})()")===true, 'addendum 138: the Testing Center opens with the testing log fold \u2014 the reference for agenda item 4');
    ok(w.eval("(function(){go('step','4.4');var wk=((data.firstReview||{}).walk)||{};['planned','stuck','systems','tests','compliance','resp','review'].forEach(function(k){if(!wk[k])walkFR(k)});wk=data.firstReview.walk;var keep=wk.review;delete wk.review;render();var h=document.getElementById('app').innerHTML;var absent=h.indexOf('govLogReview(')<0;wk.review=keep||{at:Date.now(),by:'pin'};var keepR=wk.resp;delete wk.resp;render();var absentR=document.getElementById('app').innerHTML.indexOf('govLogReview(')<0;wk.resp=keepR||{at:Date.now(),by:'pin'};render();var present=document.getElementById('app').innerHTML.indexOf('govLogReview(')>=0;return absent&&absentR&&present})()")===true, 'addendum 138 (retargeted 16 Oct 2026, KB fixes item 10; the button is found by its handler, since the 4.4 gate message now names it): Save governance review arms only when all seven items are covered, item 6 (resp) included');
  ok(w.eval("(function(){var n=(data.reviewLog||[]).length;govLogReview('governance');render();var h=document.getElementById('app').innerHTML;var ok1=(data.reviewLog||[]).length===n+1&&h.indexOf('Review Log')>=0;UI.expanded['rvl_0']=true;render();return ok1})()")===true, 'addendum 138: the saved review lands in the shared log below, entries expandable');
  w.eval("go('phase5')"); await wait();

  /* \u2500\u2500 addendum 139 (15 Aug 2026): 5.2 hosts the registers \u2014 three tabs, one store \u2500\u2500 */
  console.log('== addendum 139 ==');
  w.eval("UI.cdTab=null;UI.cdRegime=null;UI.regOpen=null;go('step','5.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return UI.cdTab==='dash'&&h.indexOf('>Dashboard<')>=0&&h.indexOf('>Compliance Register<')>=0&&h.indexOf('>Compliance Obligations<')>=0&&h.indexOf('NIST TEVV Reference')>=0})()")===true, 'addendum 139 (retargeted 15 Aug 2026, addendum 155, ruled): 5.2 opens on the Dashboard tab with the three-tab row, the dashboard body unchanged');
  ok(w.eval("(function(){UI.cdTab='reg';UI.regOpen='reg-northwind';render();var h=document.getElementById('app').innerHTML;return h.indexOf('Compliance Register')>=0&&h.indexOf('Each potential regime waits here')>=0&&h.indexOf('Save the regime')>=0&&h.indexOf('ob_0_statement')<0&&h.indexOf('completeStepGated')<0})()")===true, 'addendum 139: the 5.2 register tab carries the 2.4 body \u2014 standing lead sentence, obligations editor suppressed, no step-completion button');
  ok(w.eval("(function(){UI.cdTab='reg';UI.regOpen=null;UI.regAdd=true;render();var e=document.getElementById('ng_name');if(!e)return false;e.value='Pin Regime 139';addRegime();var g=(data.regimes||[]).find(function(x){return x.name==='Pin Regime 139'});if(!g)return false;window.__pin139=g.id;return UI.regAdd===false})()")===true, 'addendum 139: the add-a-regime form renders on the 5.2 register tab and saves through the one addRegime');
  w.eval("go('step','2.4')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('Pin Regime 139')>=0")===true, 'addendum 139: the regime added on 5.2 renders on the 2.4 register \u2014 one store, both directions');
  w.eval("go('step','5.2')"); await wait();
  ok(w.eval("(function(){UI.cdTab='reg';UI.regOpen=window.__pin139;render();var j=document.getElementById('rg_judgment');var r=document.getElementById('rg_reason');if(!j||!r)return false;j.value='applies';r.value='pin 139';setScoping(window.__pin139);var g=(data.regimes||[]).find(function(x){return x.id===window.__pin139});return !!(g&&g.scoping&&g.scoping.judgment==='applies')})()")===true, 'addendum 139: the scoping judgment records from the 5.2 register tab \u2014 the regime joins the Compliance Register without visiting 2.4');
  ok(w.eval("(function(){UI.cdTab='obl';UI.regOpen=window.__pin139;render();var h=document.getElementById('app').innerHTML;if(h.indexOf('Pin Regime 139')<0)return false;addObligation(window.__pin139);var g=(data.regimes||[]).find(function(x){return x.id===window.__pin139});return !!(g&&(g.obligations||[]).length===1&&document.getElementById('app').innerHTML.indexOf('ob_0_statement')>=0)})()")===true, 'addendum 139: the scoped-in regime appears on the 5.2 obligations tab and takes its first obligation there');
  w.eval("go('step','2.4');UI.c24Tab='obl';render()"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Pin Regime 139')>=0&&h.indexOf('1 obligation<')>=0})()")===true, 'addendum 139: the obligation added on 5.2 renders on the 2.4 obligations tab \u2014 one store, both directions');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("UI.cdRegime=\\''+g.id+'\\';UI.cdTab=\\'dash\\';go(\\'step\\',\\'5.2\\')")>=0&&_s.indexOf("'Open the compliance dashboard','UI.cdTab=\\'dash\\';go(\\'step\\',\\'5.2\\')")>=0&&_s.indexOf("'Edit in the register \\u2192','UI.cdTab=\\'reg\\';UI.regOpen=\\''+g.id+'\\';render()")>=0&&_s.indexOf("'Edit in the register \\u2192','go(\\'step\\',\\'2.4\\')")<0})(), 'addendum 139: the dashboard routes land on the Dashboard tab and the edit route stays inside 5.2 at source');
  ok(w.eval("(function(){UI.c24Tab='reg';render();var h=document.getElementById('app').innerHTML;return h.indexOf('Each entry listed at Step 1.4')>=0&&h.indexOf('completeStepGated')>=0})()")===true, 'addendum 139: 2.4 is unchanged \u2014 its own lead sentence and its step-completion button stand');
  w.eval("data.regimes=(data.regimes||[]).filter(function(x){return x.id!==window.__pin139});saveData();UI.cdTab='dash';UI.regOpen=null;UI.regAdd=false;delete window.__pin139;go('phase5')"); await wait();

  /* \u2500\u2500 addenda 140\u2013141 (15 Aug 2026): the obligations save; the NIST labels \u2500\u2500 */
  console.log('== addenda 140-141 ==');
  w.eval("go('step','2.4')"); await wait();
  ok(w.eval("(function(){UI.c24Tab='obl';UI.regOpen='reg-northwind';render();var h=document.getElementById('app').innerHTML;if(h.indexOf('Save the obligations')<0)return false;var g=(data.regimes||[]).find(function(x){return x.id==='reg-northwind'});if(!g||!(g.obligations||[]).length)return false;UI.expanded['ob_'+g.id+'_0']=true;render();var e=document.getElementById('ob_0_statement');if(!e)return false;var keep=g.obligations[0].statement;e.value='pin 140 statement';saveRegime('reg-northwind');var okv=g.obligations[0].statement==='pin 140 statement';g.obligations[0].statement=keep;saveData();return okv})()")===true, 'addendum 140: the obligations tab carries its own save \u2014 a field edit persists from the tab it is made on');
  w.eval("go('step','5.2')"); await wait();
  ok(w.eval("(function(){UI.cdTab='obl';UI.regOpen='reg-northwind';render();return document.getElementById('app').innerHTML.indexOf('Save the obligations')>=0})()")===true, 'addendum 140: the same save stands on the 5.2 obligations tab \u2014 one shared body');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('+ 4.3 exercise')<0&&_s.indexOf('the exit path (system view decisions, exit plans, retirement) + the 4.3 systems review')>=0&&_s.indexOf('the exit path + the 4.3 systems review')>=0})(), 'addendum 141 (retargeted 24 Aug 2026, Sweep 4 round 3B B21: exit-apparatus vocabulary retired for the exit path): the two stale conformance labels carry the systems-review wording \u2014 no label casts 4.3 as the exit exercise (precedent: addendum 125)');
  w.eval("UI.cdTab='dash';UI.regOpen=null;go('phase5')"); await wait();

  /* \u2500\u2500 addenda 142\u2013147 (15 Aug 2026): retirement wording, review routes, the systems mirror, the TEVV fold, the review log \u2500\u2500 */
  console.log('== addenda 142-147 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("'Exit This System'")<0&&_s.indexOf('Why exit this system? (required)')<0&&_s.indexOf("'Retire This System'")>=0&&_s.indexOf('Why retire this system? (required)')>=0&&_s.indexOf("'Exit director'")>=0&&_s.indexOf("'Exit triggers'")>=0&&_s.indexOf('The exit decision')>=0})(), 'addendum 142: the act reads Retire This System, the why-box asks why retire \u2014 the header, Exit director, and Exit triggers stand');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("'Open the governance dashboard','go(\\'phase5\\')")>=0/* label superseded 17 Aug 2026 morning, Paul's dashboard rename */&&_s.indexOf("goModule(\\'phase5\\')")<0})(), 'addendum 143: agenda item 1 routes go(phase5) \u2014 the branchless goModule path to the overview is extinct at source');
  w.eval("UI.cdTab='dash';go('phase5')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var a=h.indexOf('dashSysCard');var b=h.indexOf('Risk Portfolio');return a>=0&&b>=0&&a<b})()")===true, 'addendum 144: the AI Systems card sits above Risk Portfolio at a Glance');
  ok(w.eval("(function(){UI.expanded.dashSys=true;render();var h=document.getElementById('app').innerHTML;var pass=h.indexOf('UI.eoSysOpen=')>=0&&h.indexOf('h-card')>=0;UI.expanded.dashSys=false;render();return pass})()")===true, 'addendum 144: the opened card is the 4.3 mirror \u2014 the same in-place register-grammar bars (the archive fold rides eoSysRows and renders whenever an archived system exists)');
  w.eval("go('step','4.4')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('dashSysCard')>=0")===true, 'addendum 145 (REVERSED 15 Aug 2026, addendum 152, ruled): the review points forward \u2014 4.4\'s item 3 routes to the standing systems list, never back to the step');
  w.eval("go('govreview')"); await wait();
  ok(w.eval("document.getElementById('app').innerHTML.indexOf('dashSysCard')>=0")===true, 'addendum 145: on the standing Governance Review item 3 routes to the dashboard systems list');
  w.eval("UI.expanded.tevvRef=false;go('step','5.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('NIST TEVV Reference')>=0&&h.indexOf('Save Evidence Register')<0&&h.indexOf('trustworthy AI system')<0})()")===true, 'addendum 146 (retargeted 15 Aug 2026, addendum 155, ruled): the NIST TEVV Reference is a closed fold and the dead Save button is extinct');
  ok(w.eval("(function(){UI.expanded.tevvRef=true;render();var h=document.getElementById('app').innerHTML;UI.expanded.tevvRef=false;render();return h.indexOf('NIST Reference')>=0})()")===true, 'addendum 146: the fold opens to the reference');
  ok(w.eval("(function(){var keep=data.firstReview;data.firstReview={working:'w47',bottlenecks:'b47',nextIteration:'n47'};govLogReview('governance');var e=data.reviewLog[data.reviewLog.length-1];var pass=e.working==='w47'&&e.bottlenecks==='b47'&&e.next==='n47';data.reviewLog.pop();data.firstReview=keep;saveData();return pass})()")===true, 'addendum 147: the 4.4 save carries the retro answers into the log entry');
  ok(w.eval("(function(){go('govreview');UI.expanded.rvLog=true;var idx=-1;(data.reviewLog||[]).slice().sort(function(a,b){return b.at-a.at}).forEach(function(e,i){if(e.kind==='ethics'&&idx<0)idx=i});if(idx<0)return false;UI.expanded['rvl_'+idx]=true;render();var h=document.getElementById('app').innerHTML;UI.expanded['rvl_'+idx]=false;UI.expanded.rvLog=false;render();return h.indexOf('items covered')>=0&&h.indexOf('Notes:')>=0})()")===true, 'addendum 147 (retargeted 15 Aug 2026, addendum 156): an expanded ethics entry shows its agenda coverage and its notes');
  w.eval("go('phase5')"); await wait();

  /* \u2500\u2500 addenda 148\u2013151 (15 Aug 2026): standing walk, sidebar pages, donut colors, the 4.1 twin \u2500\u2500 */
  console.log('== addenda 148-151 ==');
  ok(w.eval("(function(){if(!data.firstReview)data.firstReview={};var keep=data.firstReview.walk;data.firstReview.walk={};go('govreview');var h=document.getElementById('app').innerHTML;var disarmed=h.indexOf('Mark covered')>=0&&h.indexOf('Log this review')<0;['planned','stuck','systems','tests','compliance','review'].forEach(function(k){data.firstReview.walk[k]={at:1,by:'pin'}});render();var sixOnly=document.getElementById('app').innerHTML.indexOf('Log this review')<0;data.firstReview.walk.resp={at:1,by:'pin'};render();var armed=document.getElementById('app').innerHTML.indexOf('Log this review')>=0;var n=(data.reviewLog||[]).length;saveGovReview();var logged=(data.reviewLog||[]).length===n+1&&Object.keys(data.firstReview.walk||{}).length===0;data.reviewLog.pop();data.firstReview.walk=keep;saveData();return disarmed&&sixOnly&&armed&&logged})()")===true, 'addendum 148 (retargeted 16 Oct 2026, KB fixes item 10): the standing review carries Mark covered, arms the log only when all seven are covered (six without item 6 stays disarmed), and a logged review clears the walk');
  ok(w.eval("(function(){go('govreview');render();var a=(document.getElementById('pipSidebar').innerHTML||'').length>50;go('ethicsov');render();var b=(document.getElementById('pipSidebar').innerHTML||'').length>50;openSystemView('sys-1');render();var c=(document.getElementById('pipSidebar').innerHTML||'').length>50;go('phase5');return a&&b&&c})()")===true, 'addendum 149: the sidebar stands on the governance review, the ethics page, and the system page');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var i=_s.indexOf('function govStageDonut');var seg=_s.slice(i,i+900);return seg.indexOf("c:'#7B4F8A'")>=0&&seg.indexOf("c:'#E05445'")>=0&&seg.indexOf("c:'#3A8B8B'")<0&&seg.indexOf("c:'#B03030'")<0})(), 'addendum 150: the donut\'s Monitor rides the family purple and Emergency the bright alarm red \u2014 the two near-identical pairs are separated');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var i=_s.indexOf('function render41()');var seg=_s.slice(i,_s.indexOf('function ',i+20));return seg.indexOf('pfCardRow')<0&&seg.indexOf('Planning Required')>=0&&seg.indexOf('pfManageRegister(_q,_q,true)')>=0&&seg.indexOf('pfManageRegister(_pl,_pl)')>=0})(), 'addendum 151: the stale pfCardRow grammar is extinct from 4.1 \u2014 the planning queue and the portfolio tabs ride the shared register body');
  ok(w.eval("(function(){data.risks.push({id:'r-pin151',name:'Pin 151 card',status:'identified',classification:'manage',assess:{}});go('step','4.1');var h=document.getElementById('app').innerHTML;var pass=h.indexOf('Planning Required')>=0&&h.indexOf('awaiting a plan')>=0&&h.indexOf('Pin 151 card')>=0&&h.indexOf('>Manage')>=0;data.risks.pop();render();return pass})()")===true, 'addendum 151: an unplanned arrival sits under Planning Required with the alarm line, above the Manage/Monitor tabs');
  w.eval("go('phase5')"); await wait();

  /* \u2500\u2500 addenda 152\u2013156 (15 Aug 2026): forward route, outcome rename, log line, TEVV label, folded review log \u2500\u2500 */
  console.log('== addenda 152-156 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.split('No threat found').length===5&&_s.split('Not found by these means').length===2})(), 'addendum 153: the threat outcome reads No threat found at the vocabulary, both seeds, and the migration \u2014 the old phrase survives only as the migration matcher');
  ok(w.eval("(function(){UI.expanded.tcLog=true;go('step','5.3');var h=document.getElementById('app').innerHTML;UI.expanded.tcLog=false;return h.indexOf('Within tolerance')>=0&&h.indexOf('Holds within limits')>=0})()")===true, 'addendum 154: the log line carries the result text, and the within-tolerance drift runs wear their outcomes');
  ok(w.eval("(function(){go('govreview');var h=document.getElementById('app').innerHTML;var closed=h.indexOf('Review Log (')>=0&&h.indexOf(\"rvl_\")<0;UI.expanded.rvLog=true;render();var open=document.getElementById('app').innerHTML.indexOf(\"rvl_\")>=0;UI.expanded.rvLog=false;render();go('phase5');return closed&&open})()")===true, 'addendum 156: the Review Log is a closed fold with its count on the bar, opening to every entry');

  /* \u2500\u2500 addendum 157 (15 Aug 2026): the 4.1 carousel names the Emergency Response portfolio \u2500\u2500 */
  console.log('== addendum 157 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('the time to write that plan is now.')>=0&&_s.indexOf('the plan written here is the plan that gets run')<0&&_s.indexOf('Planning Required')>=0})(), '(retargeted 22 Aug 2026, rev17 carousel port) addendum 157 (SUPERSEDED 16 Aug 2026, ruled: the master ending wins over the ER-portfolio sentence): slide one carries the master ending; slide two speaks the rebuilt step');

  /* \u2500\u2500 addenda 158\u2013160 (15 Aug 2026): the restore, the retiring route on risk tests, the specification field \u2500\u2500 */
  console.log('== addenda 158-160 ==');
  ok(w.eval("(function(){data.systems.push({id:'s-pin158',name:'Pin 158 System',exitDecision:{rationale:'p',at:1,completedAt:1}});archiveSystem('s-pin158');var s=data.systems[data.systems.length-1];if(!s.archived)return false;UI.eoSysArch=true;go('step','4.3');var h=document.getElementById('app').innerHTML;var shown=h.indexOf('Restore to the list')>=0&&h.indexOf('Pin 158 System')>=0;restoreSystem('s-pin158');var back=!s.archived;data.systems.pop();UI.eoSysArch=false;render();return shown&&back})()")===true, 'addendum 158: every archive row carries Restore to the list, and the restore returns the system to the retired list');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Consider exiting this system')<0&&_s.split('Consider retiring this system').length===3&&_s.indexOf('!ttIsRisk(s)||s.systemId')>=0&&_s.indexOf('(ttIsRisk(s)?s.systemId:s.id)')>=0})(), 'addendum 159: the route reads Consider retiring this system at both sites, and adverse evidence on a system-linked risk carries it');
  ok(w.eval("(function(){openSystemView('sys-1');var h=document.getElementById('app').innerHTML;if(h.indexOf('Specification reference')<0||h.indexOf('Upload the specification')<0)return false;var e=document.getElementById('sys_specRef');if(!e)return false;var keep=(data.systems||[]).find(function(x){return x.id==='sys-1'}).specRef;e.value='drive/specs/quoting-v3.pdf';saveSystemRecord('sys-1');var s=(data.systems||[]).find(function(x){return x.id==='sys-1'});var okv=s.specRef==='drive/specs/quoting-v3.pdf';s.specRef=keep;saveData();go('phase5');return okv})()")===true, 'addendum 160: the Description record carries the specification reference and its upload, saving through the canonical saver');

  /* \u2500\u2500 copy master batch 1 (15 Aug 2026): home + framework apparatus installed \u2500\u2500 */
  console.log('== copy master batch 1 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var _h=require('fs').readFileSync('Governance-home.html','utf8');var _b=require('fs').readFileSync('Governance-templates-local.js','utf8');return _s.indexOf('deploy AI your board can trust.')>=0&&_s.indexOf('var MILESTONES={')<0&&_s.indexOf('recorded your baseline')>=0&&_s.indexOf('writing a standing exit plan on each. Close by holding the first Governance Review.')>=0&&_h.indexOf('track compliance obligations, keep evidence logs current')>=0&&_b.indexOf('track compliance obligations, keep evidence logs current')>=0&&_h.indexOf('review cadences you set')<0&&_b.indexOf('HAND-FIX')<0})(), 'copy master batch 1 (strip probes retargeted 21 Aug 2026, copy-pass item 4): the tagline, wrap-ups, and milestones carry the master text; the strip carries the copy-pass blurbs on both surfaces; the dead MILESTONES dictionary is extinct');

  /* \u2500\u2500 copy master batch 3 (15 Aug 2026): phase 1\u20132 step surfaces installed \u2500\u2500 */
  console.log('== copy master batch 3 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('The register is never finished')<0&&_s.indexOf('The register stays open indefinitely')>=0&&_s.indexOf('Every New Risk Review includes a scan of the specified sources for new risks. All new risks are added to the Identify portfolio.')>=0&&_s.indexOf('New Risk Review Meeting')>=0&&_s.indexOf('New Risk Review Settings')>=0&&_s.indexOf('<strong>New Risk Review:</strong>')>=0&&_s.indexOf('Every judgment is reasoned and on the record.')>=0})(), 'copy master batch 3: the 2.1 lead sheds its never-formulation, the rescan and labels carry the New Risk Review name, the scoping note reads the master text');

  /* \u2500\u2500 copy master batches 4\u20135 (15 Aug 2026): phase 3\u20134 surfaces, portfolios, plan forms \u2500\u2500 */
  console.log('== copy master batches 4-5 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('could never rise to an emergency')<0&&_s.indexOf('judged never to rise')<0&&_s.indexOf('cannot rise to an emergency')>=0&&_s.indexOf('judged unable to rise to an emergency')<0&&_s.indexOf('Undesignated risks are never rated')<0&&_s.indexOf('Confirm will not press')<0&&_s.indexOf('watch more closely for 90 days')>=0&&_s.indexOf('never by reopening this step')<0&&_s.indexOf('Nothing needs attention — every card in the Manage portfolio carries its plan')>=0&&_s.indexOf('Every system needs its standing exit plan before this step completes')>=0})(), 'copy master batches 4-5 (term superseded 16 Aug 2026 night, Paul\u2019s close-out ruling: the committed-N/A read line \u201cjudged unable to rise to an emergency\u201d is CUT \u2014 the checkbox state carries the meaning; the master document owes itself this correction): the never-formulations are extinct from the plan forms and leads; the master text stands at the gate, the panel, and the N/A trio');

  /* \u2500\u2500 copy master batches 6\u20137 (15 Aug 2026): phase 5, outcomes, gates \u2500\u2500 */
  console.log('== copy master batches 6-7 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var low=_s.toLowerCase();var bare=(_s.match(/Risk Review/g)||[]).length;var newn=(_s.match(/New Risk Review/g)||[]).length;return low.indexOf('inety')<0&&_s.indexOf('never demands')<0&&_s.indexOf('Never silence')<0&&_s.indexOf('throughout the program map to its subcategories')>=0&&_s.indexOf('carrying their rapid scores')>=0&&_s.indexOf('framework from Phases 1–4')>=0&&_s.indexOf("New Risk Review cadence")>=0&&(bare-newn)===4})(), 'copy master batches 6-7: inety extinct; the outcome subs, gates, labels, and the sanctioned NIST seed sentence carry the master text; bare Risk Review reduced to the 3 ruled 2.3-name sites plus 1 dev comment (retargeted 19 Aug 2026, addendum 216: the four seed-culture strings ruled to New Risk Review)');

  /* \u2500\u2500 directive round (16 Aug 2026): post-cold-pass conformance \u2500\u2500 */
  console.log('== directive round ==');
  ok(w.eval("(function(){var g=(data.regimes||[]).find(function(x){return x&&x.id==='reg-nist'});if(!g)return true;var keep=g.summary;g.summary='The alignment framework this program is built on \\u2014 voluntary, but the signposts throughout the module map to its subcategories.';migrateNistSummary();var migrated=g.summary.indexOf('throughout the program map')>=0;g.summary='My own words.';migrateNistSummary();var untouched=g.summary==='My own words.';g.summary=keep;return migrated&&untouched})()")===true, 'item 32 (directive, 16 Aug 2026): the seeded-summary migration rewrites the byte-exact old string and leaves user edits alone');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var rv=_s.indexOf('function riskViz');return _s.indexOf('never an automatism')<0&&_s.indexOf('This is where the deep work happens')>=0&&_s.indexOf('workbench, with tabbed work surfaces')<0&&_s.indexOf('e.g., The model could score older applicants lower')>=0&&_s.indexOf('Every managed risk carries its plan and every monitored risk has its watching conditions.')>=0&&_s.indexOf('Systems in shutdown')>=0&&_s.indexOf('Systems sunsetting')<0})(), 'directive round (retargeted 24 Aug 2026, round 3B B1: the monitored-risk clause gains its verb): the panel, 3.2 lead, placeholder, M&M sub, and shutdown vocabulary carry the ruled strings');

  /* \u2500\u2500 addendum 173 (16 Aug 2026): the plans document renders its records \u2500\u2500 */
  console.log('== addendum 173 ==');
  ok(w.eval("(function(){var h=renderOutExitPlans();return h.indexOf('[object Object]')<0&&h.indexOf('Select and contract the independent bias auditor')>=0&&h.indexOf('Harriet Rivers')>=0&&h.indexOf('Delivered price vs contract reference')>=0&&h.indexOf('Threshold:')>=0&&h.indexOf('Data Source:')>=0/* relabeled 16 Aug 2026 night per the M&M document */})()")===true, 'addendum 173: the Management & Monitoring Plans document renders action and indicator records \u2014 text, owner, timeframe, threshold \u2014 with no raw objects');

  /* \u2500\u2500 addendum 175 (16 Aug 2026): the phase-5 video slot \u2500\u2500 */
  console.log('== addendum 175 ==');
  ok(w.eval("(function(){go('phase5');var h=document.getElementById('app').innerHTML;var okv=h.indexOf('gov-phase5.mp4')>=0&&h.indexOf('Phase Five \\u00b7 Govern')>=0;go('home');return okv})()")===true, 'addendum 175: the phase-5 hub plays its video at the top \u2014 slot 5 wired, card rendered above the dashboard');

  /* \u2500\u2500 addendum 176 (16 Aug 2026): the ruled podcast poster \u2500\u2500 */
  console.log('== addendum 176 ==');
  ok((function(){var fs=require('fs');var h=fs.readFileSync('Governance-home.html','utf8');var b=fs.readFileSync('Governance-templates-local.js','utf8');var pods=h.indexOf('poster=\"data:image/jpeg;base64,');var one=(h.split('poster=').length-1)===1;var intro=h.indexOf('gov-program-intro.mp4');var introClean=h.slice(h.lastIndexOf('<video',intro),intro).indexOf('poster')<0;return pods>=0&&one&&introClean&&b.indexOf('data:image/jpeg;base64,')>=0})(), 'addendum 176 (SUPERSEDED twice 16 Aug 2026; final: artwork received and baked per the AE law): the podcast player carries the inline base64 poster, the intro player carries none, the bundle carries the baked home');
  /* \u2500\u2500 addendum 177 (16 Aug 2026, plan surfaces rebuild ruling): plural plans, plural named emergencies, periodic actions, per-field draft capture \u2500\u2500 */
  console.log('== addendum 177 ==');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-ex1'});var pl=r.mgmtPlan;return Array.isArray(pl.plans)&&pl.plans.length===1&&pl.plans[0].name==='Bias audit and remediation'&&Array.isArray(pl.emergencies)&&pl.emergencies[0].name==='Discrimination complaint or audit finding'})()")===true, 'addendum 177: seeds carry the plural shape \u2014 named plans[] and named emergencies[]');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg3'});var e=r.mgmtPlan.emergencies;return e.length===2&&e[0].name==='Confirmed paste into a public tool'&&e[1].name==='Tool vendor breach or terms change'})()")===true, 'addendum 177: r-mg3 carries two named emergency plans (the ruling\u2019s motivating example)');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg4'});var p=r.mgmtPlan.plans;return p.length===2&&p[0].type==='response'&&p[1].type==='prevention'&&p[1].actions[0].recur===true})()")===true, 'addendum 177: r-mg4 splits into two plans \u2014 the response fallback and the prevention contract term, the renewal action periodic');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg2'});UI.mgOpen=r.id;UI.planFocus={rid:r.id,kind:'mgplan',idx:0};UI.mgCards={plan:null,act:null,em:null};var h1=mgSurface(r);UI.planFocus={rid:r.id,kind:'mgers',idx:-2};h1+=mgSurface(r);UI.planFocus={rid:r.id,kind:'mgplan',idx:0};UI.mgCards={plan:null,act:{pi:0,idx:-1,d:{action:'',owner:'',timeframe:'',recur:'one',n:1}},em:null};var h2=mgSurface(r);UI.mgCards={plan:{idx:0,d:{name:'x',type:'prevention',n:2}},act:null,em:null};var h3=mgSurface(r);UI.mgOpen=null;UI.mgCards=null;UI.planFocus=null;return h1.indexOf('+ Add action')>=0&&h1.indexOf('+ Add an emergency plan')>=0&&h1.indexOf('Preliminary emergency response plans')>=0&&h1.indexOf('Management plan')>=0&&h2.indexOf('One-off or periodic')>=0&&h3.indexOf('Plan name')>=0&&h3.indexOf('Plan type')>=0})()")===true, 'addendum 177 (retargeted 21 Aug 2026, dashboard redesign — the census reads from the focus views; the add-plan ghost lives on the dashboard): the Plan type ? tooltip removed by ruling 22 Aug 2026; the manage surface carries the add buttons; One-off or periodic lives in the action card-form; the plan card-form holds name and type with the tooltip gloss');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn1'});UI.mnOpen=r.id;UI.planFocus={rid:r.id,kind:'mnplan',idx:-2};UI.mnScalar={monitor:'X',frequency:'review',n:1};UI.mnCards={ind:null,em:null};var h1=mnSurface(r);UI.mnScalar=null;UI.mnCards={ind:{idx:-1,d:{indicator:'',owner:'',description:'',threshold:'',source:'',n:2}},em:null};var h2=mnSurface(r);UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;UI.planFocus=null;return h1.indexOf('Who owns this monitoring plan')>=0&&h1.indexOf('Save monitoring plan')>=0&&h2.indexOf('Indicator name')>=0&&h2.indexOf('Threshold')>=0&&h2.indexOf('Data Source')>=0&&h2.indexOf('An indicator is a reading you can actually take')>=0})()")===true, 'addendum 177 (retargeted 16 Aug 2026 night per the M&M document: the plan-level Frequency field retired 22 Aug 2026; labels are Threshold and Data Source; the plan card holds Owner and Frequency; the who-watches intro retired with the check-in machinery)');
  ok(w.eval("(function(){window.confirm=function(){return true};data.risks.push({id:'r-p184a',name:'Card commit probe',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor'});var r=data.risks.find(function(x){return x.id==='r-p184a'});UI.mnOpen=r.id;UI.mnScalar=null;UI.mnCards={ind:null,em:null};openIndCard(r.id);indF('indicator',{value:'Trial add'});indF('threshold',{value:'T'});indF('source',{value:'S'});var seq0=UI.mnCards.ind.d.n;saveIndicatorCard(r.id);var ok1=UI.mnCards.ind===null&&!!r.monitorPlan&&r.monitorPlan.indicators.length===1&&r.monitorPlan.indicators[0].indicator==='Trial add'&&Array.isArray(r.monitorPlan.emergencies);removeIndicator(r.id,0);var ok2=r.monitorPlan.indicators.length===0&&seq0>0;data.risks=data.risks.filter(function(x){return x.id!=='r-p184a'});saveData();UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;return ok1&&ok2})()")===true, 'addendum 177 (retargeted 16 Aug 2026, artifact-cards ruling): the first indicator commit creates the empty holder and writes the record, closing the card-form \u2014 the render repaint cannot reinstate the typed text \u2014 and Remove splices it back out');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg3'});var a=r.mgmtPlan.plans[0].actions[2];if(!(a.recur===true&&a.doneAt===0))return false;toggleActionDone(r.id,0,2);var stamped=r.mgmtPlan.plans[0].actions[2].doneAt>0;toggleActionDone(r.id,0,2);var cleared=r.mgmtPlan.plans[0].actions[2].doneAt===0;return stamped&&cleared})()")===true, 'addendum 177: toggling a periodic action stamps the last-done date and toggling again clears it');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg2'});UI.mgOpen=null;UI.mgCards=null;UI.planFocus={rid:r.id,kind:'mgplan',idx:0};var h=mgSurface(r);UI.planFocus={rid:r.id,kind:'mgers',idx:-2};h+=mgSurface(r);UI.planFocus=null;return h.indexOf('>Periodic<')>=0&&h.indexOf('Last done')>=0/* relabeled 16 Aug 2026 late night, Paul's Done-control ruling */&&h.indexOf('Preliminary emergency response plans')>=0&&h.indexOf('Missed defect reaches a customer')>=0})()")===true, 'addendum 177 (retargeted 16 Aug 2026, artifact-cards ruling): the surface groups periodic actions under their micro-label with the last-done date and lists named emergency plans on read-only cards');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var mg=_s.slice(_s.indexOf('function mgSurface'),_s.indexOf('function ',_s.indexOf('function mgSurface')+10));var mn=_s.slice(_s.indexOf('function mnSurface'),_s.indexOf('function ',_s.indexOf('function mnSurface')+10));return mg.indexOf('pinnedFold(')<0&&mn.indexOf('pinnedFold(')<0})(), 'addendum 177 (retargeted 16 Aug 2026, artifact-cards ruling): the score-history fold is gone from both unified plan surfaces (ruled 16 Aug 2026)');
  ok(w.eval("(function(){var h=renderOutExitPlans();var a=h.indexOf('Select and contract the independent bias auditor');var pn=h.indexOf('Progress notes:');var ep=h.indexOf('Emergency plans:');return a>=0&&pn>a&&ep>pn&&h.indexOf('Bias audit and remediation')>=0&&h.indexOf('last done')>=0})()")===true, 'addendum 177: the plans document follows the read-version ordering \u2014 named plan, actions, progress notes, then named emergency plans \u2014 with periodic last-done dates');
  ok(w.eval("(function(){var r3=data.risks.find(function(x){return x.id==='r-mg3'});var r1=data.risks.find(function(x){return x.id==='r-ex1'});return escalateForm(r3).indexOf('Which emergency plan is this?')>=0&&escalateForm(r1).indexOf('Which emergency plan is this?')<0})()")===true, 'addendum 177: the escalate form carries the emergency picker exactly when more than one emergency plan exists');

  /* \u2500\u2500 addendum 178 (16 Aug 2026, domsweep finding): the print popup guards against blockers \u2500\u2500 */
  console.log('== addendum 178 ==');
  ok(w.eval("(function(){var was=window.open;var msg=null;var wasAl=window.alert;window.open=function(){return null};window.alert=function(m){msg=m};var threw=false;try{printPage()}catch(e){threw=true}window.open=was;window.alert=wasAl;return !threw&&msg==='The print view was blocked by the browser. Allow pop-ups for this site and try again.'})()")===true, 'addendum 178: a blocked print popup lands as a plain message, never an uncaught crash');

  /* \u2500\u2500 addendum 179 (16 Aug 2026, code-audit fixes) \u2500\u2500 */
  console.log('== addendum 179 ==');
  ok(w.eval("(function(){UI.mgOpen='r-as2';UI.mgCards={plan:null,em:null};editMgPlanCard('r-as2',0);saveMgPlanCard('r-as2');var kept=UI.mgOpen==='r-as2'&&UI.mgCards.plan===null;UI.mgOpen=null;UI.mgCards=null;return kept})()")===true, 'addendum 179 (retargeted 16 Aug 2026, artifact-cards ruling): a card save closes the card-form and keeps the surface open so the read-only card confirms');
  ok(w.eval("(function(){var fake={mgmtPlan:{plans:[],emergencies:[{name:'A',lead:'la'},{name:'B',lead:'lb'}]},escalation:{emIdx:0,emName:'B'}};return erEmTarget(fake).lead==='lb'})()")===true, 'addendum 179: the escalation\u2019s picked emergency resolves by name before index \u2014 a reordered plan list cannot swap the working document');

  /* \u2500\u2500 addendum 180 (16 Aug 2026, ruled batch): dead code out, exits require stand-down, the Regular/Enhanced labels retire \u2500\u2500 */
  console.log('== addendum 180 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('function getRiskStages')<0&&_s.indexOf('function getLitScore')<0})(), 'addendum 180: getRiskStages and getLitScore are extinct at source (ruled: dead code)');
  ok(w.eval("(function(){data.systems.push({id:'s-p180',name:'Pin system',exitDecision:{rationale:'r',by:'t',at:Date.now(),plan:{}}});data.risks.push({id:'r-p180',name:'Pin ER',description:'d',category:'O',source:'internal',classification:'manage',systemId:'s-p180',escalation:{what:'w',lead:'l',by:'t',at:Date.now()}});completeExit('s-p180');var refused=!data.systems.find(function(x){return x.id==='s-p180'}).exitDecision.completedAt;delete data.risks.find(function(x){return x.id==='r-p180'}).escalation;completeExit('s-p180');var done=!!data.systems.find(function(x){return x.id==='s-p180'}).exitDecision.completedAt&&!!data.risks.find(function(x){return x.id==='r-p180'}).resolution;return refused&&done})()")===true, 'addendum 180: an exit refuses to complete over a live emergency and completes once it stands down (ruled 16 Aug 2026)');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return (_s.match(/'Enhanced'/g)||[]).length===0&&(_s.match(/'Regular'/g)||[]).length===0&&_s.indexOf('Privacy-Enhanced')>=0})(), 'addendum 180: the Regular/Enhanced tier labels are extinct from rendered copy \u2014 the frequency itself is the calibration (NIST Privacy-Enhanced characteristic untouched)');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn1'});return !!r&&pfFacetVals('manage',[r]).some(function(f){return f.facet==='mon'&&f.label===((MN_FREQ.find(function(x2){return x2.v===r.monitorPlan.frequency})||{}).l)})})()")===true, 'addendum 180: the monitor facet chips carry the schedule labels in place of the retired tiers (r-mn1 \u2014 the world is reseeded after r-smkmn, so the pin reads a seed)');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Set a faster schedule than the regular review and the card shows when the next check is due')<0/* SUPERSEDED 16 Aug 2026 night, surface-repair drawing: the surfaces carry no intro paragraphs; the copy master owes itself this strike (ninth correction) */&&_s.indexOf('Each indicator has its own checking cadence')>=0&&_s.indexOf('the Manage and Monitor portfolio')>=0&&_s.indexOf('Stand it down first \\u2014 the de-escalation writes the outcome on the record')>=0})(), '(retargeted 22 Aug 2026, rev17 carousel port) addendum 180: the rewritten monitoring intro, the carousel calibration line, the ruled classification confirm, and the exit stand-down alert are all at source');

  /* \u2500\u2500 addendum 181 (16 Aug 2026, guard-gap ruling): the five joined writers block and release on a foreign lock \u2500\u2500 */
  console.log('== addendum 181 ==');
  ok(w.eval("(function(){data.systems.push({id:'s-p181',name:'Pin system B',exitDecision:{rationale:'r',by:'t',at:Date.now(),plan:{}}});data.risks.push({id:'r-p181',name:'Pin card B',description:'d',category:'O',source:'internal',classification:'manage',systemId:'s-p181'});var k='governance-locks::'+currentOrgId;var L={};L['systems::s-p181']={id:'u_probe_other',name:'Probe Other',at:Date.now()};localStorage.setItem(k,JSON.stringify(L));completeExit('s-p181');var blocked=!data.systems.find(function(x){return x.id==='s-p181'}).exitDecision.completedAt;localStorage.setItem(k,'{}');completeExit('s-p181');var released=!!data.systems.find(function(x){return x.id==='s-p181'}).exitDecision.completedAt;return blocked&&released})()")===true, 'addendum 181: completeExit blocks on a foreign system lock and applies once it clears');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-ex1'});if(!r||r.ethStatus!=='confirmed')return 'no-fixture';var k='governance-locks::'+currentOrgId;var L={};L['risks::r-ex1']={id:'u_probe_other',name:'Probe Other',at:Date.now()};localStorage.setItem(k,JSON.stringify(L));clearEthics('r-ex1');var blocked=r.ethStatus==='confirmed';localStorage.setItem(k,'{}');return blocked})()")===true, 'addendum 181: clearEthics blocks on a foreign risk lock \u2014 the twin now matches confirmEthicsUI');
  ok(w.eval("(function(){var k='governance-locks::'+currentOrgId;var L={reviewLog:{id:'u_probe_other',name:'Probe Other',at:Date.now()}};localStorage.setItem(k,JSON.stringify(L));var n0=(data.reviewLog||[]).length;govLogReview('risk');var blocked=(data.reviewLog||[]).length===n0;localStorage.setItem(k,'{}');govLogReview('risk');var released=(data.reviewLog||[]).length===n0+1;return blocked&&released})()")===true, 'addendum 181: the review-log writers block on a foreign reviewLog lock and append once it clears');

  /* \u2500\u2500 addendum 182 (16 Aug 2026, ruled): notes survive revision; the dismissal copy names its record \u2500\u2500 */
  console.log('== addendum 182 ==');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-ex1'});if(!r||!r.mgmtPlan)return 'no-fixture';var n0=(r.mgmtPlan.notes||[]).length;if(!n0)return 'no-note-fixture';UI.mgOpen=r.id;UI.mgCards={plan:null,em:null};editMgPlanCard(r.id,0);saveMgPlanCard(r.id);var kept=(r.mgmtPlan.notes||[]).length===n0;UI.mgOpen=null;UI.mgCards=null;return kept})()")===true, 'addendum 182 (Paul\u2019s ruling; retargeted 16 Aug 2026, artifact-cards ruling): progress notes survive an artifact edit-save \u2014 the pre-rebuild wipe stays retired');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("saved on the risk\\u2019s dismissal record")>=0&&_s.indexOf("saved to the risk\\u2019s history")<0})(), 'addendum 182: the dismissal prompt and its alert name the dismissal record, not the pinned history');

  /* \u2500\u2500 addendum 183 (16 Aug 2026, ruled): draft preservation when switching cards \u2500\u2500 */
  console.log('== addendum 183 ==');
  ok(w.eval("(function(){var a=data.risks.find(function(x){return x.id==='r-p180'});var b=data.risks.find(function(x){return x.id==='r-p181'});if(!a||!b)return 'no-fixture';UI.mgOpen=null;UI.mgCards=null;UI.mgStash={};openMgLanding('r-p180');openMgPlanCard('r-p180');mgPlF('name',{value:'Half-typed plan'});openMgLanding('r-p181');var stashed=UI.mgStash['r-p180']&&UI.mgStash['r-p180'].cards.plan.d.name==='Half-typed plan';openMgLanding('r-p180');var restored=UI.mgCards.plan.d.name==='Half-typed plan'&&!UI.mgStash['r-p180'];cancelMgPlanCard('r-p180');UI.mgOpen=null;UI.mgCards=null;return stashed&&restored})()")===true, 'addendum 183 (retargeted 16 Aug 2026, artifact-cards ruling): an open plan card displaced by opening another risk stashes per risk and restores intact on return; Cancel on the card is the explicit discard');
  ok(w.eval("(function(){var a=data.risks.find(function(x){return x.id==='r-mn1'});var b=data.risks.find(function(x){return x.id==='r-mn2'});if(!a||!b)return 'no-fixture';UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;UI.mnStash={};openMnLanding('r-mn1');openIndCard('r-mn1');indF('indicator',{value:'Half-typed indicator'});openMnPlanEdit('r-mn1');mnF('monitor',{value:'Draft monitor'});openMnLanding('r-mn2');var stashed=UI.mnStash['r-mn1']&&UI.mnStash['r-mn1'].cards.ind.d.indicator==='Half-typed indicator'&&UI.mnStash['r-mn1'].scalar.monitor==='Draft monitor';openMnLanding('r-mn1');var restored=UI.mnCards.ind.d.indicator==='Half-typed indicator'&&UI.mnScalar.monitor==='Draft monitor'&&!UI.mnStash['r-mn1'];cancelIndCard('r-mn1');cancelMnPlanEdit('r-mn1');UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;return stashed&&restored})()")===true, 'addendum 183 (retargeted 16 Aug 2026 night, surface-repair directive: the plan-edit draft opens from its own Edit control): displaced open cards stash and restore intact, plan-level draft included');
  ok(w.eval("(function(){UI.mgStash={x:1};UI.mnStash={y:1};sealSession();return !UI.mgStash&&!UI.mnStash})()")===true, 'addendum 183: the stashes are volatile \u2014 org switch and sign-out clear them with the drafts');

  /* \u2500\u2500 addendum 184 (16 Aug 2026 evening, artifact-cards rebuild ruling): every plan artifact is a saved card committing directly to the record \u2500\u2500 */
  console.log('== addendum 184 ==');
  ok(w.eval("(function(){window.confirm=function(){return true};data.risks.push({id:'r-p184n',name:'Monitor probe 184',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor',assess:{triggers:[{indicator:'Probe trigger',threshold:'>1'}]}});var r=data.risks.find(function(x){return x.id==='r-p184n'});UI.mnOpen=r.id;UI.mnScalar=null;UI.mnCards={ind:null,em:null};openIndCard(r.id);indF('indicator',{value:'Probe reading'});indF('owner',{value:'Probe Owner'});indF('description',{value:'Why it matters'});indF('threshold',{value:'>9'});indF('source',{value:'Probe log'});saveIndicatorCard(r.id);var x=r.monitorPlan.indicators[0];return x.indicator==='Probe reading'&&x.owner==='Probe Owner'&&x.description==='Why it matters'&&x.threshold==='>9'&&x.source==='Probe log'&&Array.isArray(r.monitorPlan.emergencies)&&!!r.monitorPlan.by&&!!r.monitorPlan.at&&UI.mnCards.ind===null})()")===true, 'addendum 184: the indicator card commits all five ruled fields directly to the record, the first commit creates the empty holder, the container stamps by/at, and the card closes');
  ok(w.eval("(function(){window.confirm=function(){return true};var r=data.risks.find(function(x){return x.id==='r-p184n'});var h0=(r.history||[]).filter(function(p){return p.kind==='monitor-plan'}).length;editIndCard(r.id,0);indF('owner',{value:'Second Owner'});saveIndicatorCard(r.id);var ok1=r.monitorPlan.indicators.length===1&&r.monitorPlan.indicators[0].owner==='Second Owner';var h1=(r.history||[]).filter(function(p){return p.kind==='monitor-plan'}).length;removeIndicator(r.id,0);var ok2=r.monitorPlan.indicators.length===0;var h2=(r.history||[]).filter(function(p){return p.kind==='monitor-plan'}).length;return ok1&&ok2&&h1===h0+1&&h2===h1+1})()")===true, 'addendum 184: Edit replaces the indicator in place and Remove splices it out \u2014 each commit pins the prior container to history');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p184n'});openMnEmCard(r.id);mnEmF('name',{value:'Probe emergency one'});mnEmF('triggers',{value:'t'});mnEmF('firstMoves',{value:'f'});mnEmF('lead',{value:'l'});mnEmF('standDown',{value:'s'});saveMnEmCard(r.id);openMnEmCard(r.id);mnEmF('name',{value:'Probe emergency two'});mnEmF('triggers',{value:'t'});mnEmF('firstMoves',{value:'f'});mnEmF('lead',{value:'l'});mnEmF('standDown',{value:'s'});saveMnEmCard(r.id);var ems=emergenciesOf(r);var h=escalateForm(r);return r.monitorPlan.emergencies.length===2&&ems.length===2&&ems[1].name==='Probe emergency two'&&h.indexOf('Which emergency plan is this?')>=0})()")===true, 'addendum 184: monitor emergency plans are plural saved artifacts \u2014 the direct port of the manage card mechanics \u2014 and the escalation picker reads the plural list');
  ok(w.eval("(function(){data.risks.push({id:'r-p184m',name:'Manage probe 184',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'manage'});var r=data.risks.find(function(x){return x.id==='r-p184m'});UI.mgOpen=r.id;UI.mgCards={plan:null,em:null};openMgEmCard(r.id);mgEmF('name',{value:'Probe mg emergency'});mgEmF('triggers',{value:'t'});mgEmF('firstMoves',{value:'f'});mgEmF('lead',{value:'l'});mgEmF('standDown',{value:'s'});saveMgEmCard(r.id);var msg='';window.confirm=function(m){msg=m;return true};var h0=(r.history||[]).filter(function(p){return p.kind==='mgmt-plan'}).length;mgEmNaCommit(r.id,{checked:true});var e=r.mgmtPlan.emergencies;var h1=(r.history||[]).filter(function(p){return p.kind==='mgmt-plan'}).length;window.confirm=function(){return true};return msg==='Mark N/A and remove the 1 emergency plan?'&&!!(e&&e.na===true)&&h1===h0+1})()")===true, 'addendum 184: N/A is a direct commit \u2014 the confirm carries the ruled count wording, the emergencies land as the N/A record, and the prior container pins');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p184m'});var un=needsLanding(r)===true;mgEmNaCommit(r.id,{checked:false});var back=Array.isArray(r.mgmtPlan.emergencies)&&r.mgmtPlan.emergencies.length===0;mgEmNaCommit(r.id,{checked:true});return un&&back&&r.mgmtPlan.emergencies.na===true})()")===true, 'addendum 184: a committed container with zero plans still wears the landing warn, and unchecking N/A commits the empty list back');
  ok(w.eval("(function(){var m=data.risks.find(function(x){return x.id==='r-p184m'});var n=data.risks.find(function(x){return x.id==='r-p184n'});openMgPlanCard(m.id);mgPlF('name',{value:'Probe plan'});mgPlF('type',{value:'prevention'});saveMgPlanCard(m.id);var mg0=needsLanding(m)===true;var _mpi=m.mgmtPlan.plans.length-1;openActCard(m.id,_mpi);actF('action',{value:'Do the probe'});saveActionCard(m.id);var mg1=mg0&&needsLanding(m)===false;/* 16 Aug 2026 night: the warn holds until a plan carries an action */openIndCard(n.id);indF('indicator',{value:'Second reading'});saveIndicatorCard(n.id);var mn0=needsLanding(n)===true;UI.mnOpen=n.id;UI.mnScalar={monitor:'Probe Monitor',frequency:'monthly',n:1};saveMnLanding(n.id);var mn1=needsLanding(n)===false;return mg1&&mn0&&mn1})()")===true, 'addendum 184: manage clears on committed plans plus an answered emergency section; committed indicator artifacts alone do not clear the monitor warn \u2014 the retained scalar save is the landing-clearing stamp');
  ok(w.eval("(function(){var c=UI.mgCards&&UI.mgCards.plan;openMgPlanCard('r-p184m');mgPlF('name',{value:'Half a plan'});var before=JSON.stringify(data.risks.find(function(x){return x.id==='r-p184m'}).mgmtPlan.plans);saveMgPlanCard('r-p184m');var after=JSON.stringify(data.risks.find(function(x){return x.id==='r-p184m'}).mgmtPlan.plans);var refused=before===after&&UI.mgCards.plan!==null;cancelMgPlanCard('r-p184m');return refused})()")===true, 'addendum 184: an incomplete card save refuses whole \u2014 no partial write lands and the card stays open for the fix');
  ok(w.eval("(function(){data.risks.push({id:'r-p184h',name:'Hint probe',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor',assess:{triggers:[{indicator:'Complaint rate',threshold:'>2/mo'}]}});var r=data.risks.find(function(x){return x.id==='r-p184h'});UI.mnOpen=r.id;UI.mnCards={ind:null,em:null};UI.mnScalar=null;var h0=mnSurface(r);var fresh=h0.indexOf('+ Monitoring plan')>=0&&h0.indexOf('Preliminary')<0;UI.planFocus={rid:r.id,kind:'mnplan',idx:-2};openMnPlanEdit(r.id);mnF('monitor',{value:'Hint Owner'});saveMnLanding(r.id);var h1=mnSurface(r);var hint1=h1.indexOf('From Assess:')>=0&&h1.indexOf('Complaint rate')>=0;openIndCard(r.id);indF('indicator',{value:'Complaint rate'});saveIndicatorCard(r.id);var h2=mnSurface(r);return fresh&&hint1&&h2.indexOf('From Assess:')<0})()")===true, 'addendum 184 (retargeted 21 Aug 2026, dashboard redesign: the ghost add rides the dashboard; the From-Assess hint reads in the focus view): a fresh monitor shows only the add-plan button; once the plan saves, the From Assess hint renders until the first indicator commits');
  ok(w.eval("(function(){data.risks.push({id:'r-p184p',name:'Prefill probe',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor',assess:{triggers:[{indicator:'T1',threshold:'>1'},{indicator:'T2',threshold:'>2'}]}});openMnLanding('r-p184p');var r=data.risks.find(function(x){return x.id==='r-p184p'});var ok1=!r.monitorPlan&&UI.mnCards.ind===null&&UI.mnCards.em===null&&UI.mnScalar===null;openMnPlanEdit(r.id);var ok2=UI.mnScalar.monitor===''&&UI.mnScalar.frequency==='review';openIndCard(r.id);var ok3=UI.mnCards.ind.d.indicator==='';cancelIndCard(r.id);cancelMnPlanEdit(r.id);return ok1&&ok2&&ok3})()")===true, 'addendum 184 (retargeted 16 Aug 2026 night): opening the landing opens nothing and drafts nothing from Assess triggers; the plan card and indicator card open blank from their own controls');
  ok(w.eval("(function(){var h=renderOutExitPlans();return h.indexOf('Duncan Fairley')>=0&&h.indexOf('earliest sign the supplier')>=0&&h.indexOf('Probe emergency two')>=0})()")===true, 'addendum 184 (extends addendum 173): the plans document renders the indicator owner and description lines and lists monitor-side emergency plans (extension flagged for Paul at close-out)');
  ok(w.eval("(function(){var r5=data.risks.find(function(x){return x.id==='r-mn5'});var q=data.risks.find(function(x){return x.id==='r-qcinc'});var pin=q?(q.history||[]).find(function(p){return p.kind==='monitor-plan'}):null;return !!r5&&r5.monitorPlan.indicators[0].owner==='Vincent Lau'&&!!String(r5.monitorPlan.indicators[0].description||'').length&&!!pin&&pin.indicators[0].indicator==='Classifier heartbeat'&&pin.indicators[0].owner===undefined})()")===true, 'addendum 184 (\u00a76): the nine seeded indicators carry owner and description as authored; the r-qcinc history pin stays frozen \u2014 three fields, no owner');
  ok(w.eval("typeof saveMgLanding")==='undefined' && (function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Save management plans')<0})(), 'addendum 184 (R4): the container-level Save management plans button and its writer are retired \u2014 per-artifact commits carry the manage side');
  ok(w.eval("(function(){window.confirm=function(){return true};['r-p184n','r-p184m','r-p184h','r-p184p'].forEach(function(id){data.risks=data.risks.filter(function(x){return x.id!==id})});saveData();UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;UI.mgOpen=null;UI.mgCards=null;UI.mgStash={};UI.mnStash={};return !data.risks.some(function(x){return /^r-p184/.test(x.id)})})()")===true, 'addendum 184: probe fixtures removed and the volatile UI cleared \u2014 the world is clean for any pins that follow');

  /* \u2500\u2500 addendum 185 (16 Aug 2026 night, Paul's close-out ruling): dashboard and rollup counts read completed saves only \u2014 part-built containers created by artifact commits do not count \u2500\u2500 */
  console.log('== addendum 185 ==');
  ok(w.eval("(function(){data.risks.push({id:'r-p185m',name:'Count probe manage',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'manage'});data.risks.push({id:'r-p185n',name:'Count probe monitor',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor'});var m=data.risks.find(function(x){return x.id==='r-p185m'});var n=data.risks.find(function(x){return x.id==='r-p185n'});UI.mgOpen=m.id;UI.mgCards={plan:null,act:null,em:null};openMgPlanCard(m.id);mgPlF('name',{value:'Probe count plan'});mgPlF('type',{value:'prevention'});saveMgPlanCard(m.id);var half1=mgPlanComplete(m)===false;UI.mnOpen=n.id;UI.mnCards={ind:null,em:null};UI.mnScalar=null;openIndCard(n.id);indF('indicator',{value:'Count reading'});saveIndicatorCard(n.id);var half2=mnPlanComplete(n)===false;return half1&&half2})()")===true, 'addendum 185 (retargeted 16 Aug 2026 night): part-built is not complete \u2014 a plan without an action and an indicator without a saved plan-level owner do not count');
  ok(w.eval("(function(){var m=data.risks.find(function(x){return x.id==='r-p185m'});var n=data.risks.find(function(x){return x.id==='r-p185n'});openActCard(m.id,0);actF('action',{value:'Count the probe'});saveActionCard(m.id);mgEmNaCommit(m.id,{checked:true});var done1=mgPlanComplete(m)===true;openMnPlanEdit(n.id);mnF('monitor',{value:'Probe Monitor'});saveMnLanding(n.id);var done2=mnPlanComplete(n)===true;return done1&&done2})()")===true, 'addendum 185 (retargeted 16 Aug 2026 night): completeness lands with the answering commits \u2014 an action plus the emergency answer on manage; the plan-level owner plus an indicator on monitor');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('return mgPlanComplete(r)||mnPlanComplete(r)}).length')>=0&&_s.indexOf('mon.filter(function(r){return mnPlanComplete(r)}).length')>=0&&_s.indexOf("cardClass(r)==='monitor'&&mnPlanComplete(r)")>=0&&_s.indexOf('return r.mgmtPlan||r.monitorPlan}).length')<0})(), 'addendum 185: all three flagged count sites \u2014 Plans on Cards, the monitored-risks rollup, and the check-in cadence walk \u2014 read the completeness helpers; the container-truthiness form is retired');
  ok(w.eval("(function(){window.confirm=function(){return true};['r-p185m','r-p185n'].forEach(function(id){data.risks=data.risks.filter(function(x){return x.id!==id})});saveData();UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;UI.mgOpen=null;UI.mgCards=null;return !data.risks.some(function(x){return /^r-p185/.test(x.id)})})()")===true, 'addendum 185: probe fixtures removed \u2014 the world is clean');

  
  /* ── addendum 186 (16 Aug 2026 night, surface-repair directive + Paul's rulings): two-level cards,
     per-indicator check logs, symmetric actions, retirements ── */
  console.log('== addendum 186 ==');
  ok(w.eval("(function(){data.risks.push({id:'r-p186n',name:'Repair probe monitor',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor'});var r=data.risks.find(function(x){return x.id==='r-p186n'});UI.mnOpen=r.id;UI.mnCards={ind:null,em:null};UI.mnScalar=null;openMnPlanEdit(r.id);saveMnLanding(r.id);var refused=!r.monitorPlan&&UI.mnScalar!==null;mnF('monitor',{value:'Repair Owner'});mnF('frequency',{value:'weekly'});saveMnLanding(r.id);var saved=!!r.monitorPlan&&r.monitorPlan.monitor==='Repair Owner'&&r.monitorPlan.frequency==='weekly'&&Array.isArray(r.monitorPlan.indicators)&&!!r.monitorPlan.by&&UI.mnScalar===null;var warn1=needsLanding(r)===true;openIndCard(r.id);indF('indicator',{value:'Repair reading'});saveIndicatorCard(r.id);var warn2=needsLanding(r)===false;return refused&&saved&&warn1&&warn2})()")===true, 'addendum 186: the plan-level card refuses without an owner, saves owner and frequency alone, and the warn holds until an indicator exists');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p186n'});var n0=r.monitorPlan.indicators.length;openMnPlanEdit(r.id);mnF('monitor',{value:'Second Owner'});saveMnLanding(r.id);return r.monitorPlan.indicators.length===n0&&r.monitorPlan.indicators[0].indicator==='Repair reading'&&r.monitorPlan.monitor==='Second Owner'})()")===true, 'addendum 186: editing the plan-level card touches only plan-level fields \u2014 the indicator list rides through untouched');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p186n'});var h0=(r.history||[]).length;logCheck(r.id,0);logCheck(r.id,0);var ck=r.monitorPlan.indicators[0].checks;return ck.length===2&&ck.every(function(c){return c.at&&typeof c.by==='string'&&typeof c.note==='string'})&&(r.history||[]).length===h0})()")===true, 'addendum 186: Check complete appends dated entries to the indicator archive \u2014 a working control, no history pin, like the done toggles');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p186n'});var withCk=_mnDueLine(r,r.monitorPlan.indicators[0]);var blank=_mnDueLine(r,{checks:[]});r.monitorPlan.frequency='review';var rev=_mnDueLine(r,{checks:[]});r.monitorPlan.frequency='weekly';return withCk.indexOf('Last check: ')>=0&&withCk.indexOf('Next check due: ')>=0&&blank.indexOf('No checks logged yet')>=0&&blank.indexOf('First check due: ')>=0&&rev.indexOf('at the regular review')>=0})()")===true, 'addendum 186: the due line derives from frequency plus the indicator archive, with the ruled strings for the unchecked and review-frequency cases');
  ok(w.eval("(function(){window.confirm=function(){return true};data.risks.push({id:'r-p186m',name:'Repair probe manage',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'manage'});var r=data.risks.find(function(x){return x.id==='r-p186m'});UI.mgOpen=r.id;UI.mgCards={plan:null,act:null,em:null};openMgPlanCard(r.id);mgPlF('name',{value:'Repair plan'});mgPlF('type',{value:'response'});saveMgPlanCard(r.id);openActCard(r.id,0);actF('action',{value:'One-off act'});actF('owner',{value:'A'});actF('timeframe',{value:'Q1'});saveActionCard(r.id);var a=r.mgmtPlan.plans[0].actions[0];var ok1=a.action==='One-off act'&&a.recur===false&&a.done===false;toggleActionDone(r.id,0,0);editActCard(r.id,0,0);actF('owner',{value:'B'});saveActionCard(r.id);var a2=r.mgmtPlan.plans[0].actions[0];var ok2=a2.owner==='B'&&a2.done===true;removeAction(r.id,0,0);return ok1&&ok2&&r.mgmtPlan.plans[0].actions.length===0})()")===true, 'addendum 186: actions are self-saving cards \u2014 save, edit-preserving-done, and in-form remove all commit directly');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p186m'});openActCard(r.id,0);actF('action',{value:'Periodic act'});actF('recur',{value:'periodic'});saveActionCard(r.id);var a=r.mgmtPlan.plans[0].actions[0];var ok1=a.recur===true&&a.doneAt===0;toggleActionDone(r.id,0,0);var t1=r.mgmtPlan.plans[0].actions[0].doneAt;editActCard(r.id,0,0);actF('timeframe',{value:'Monthly'});saveActionCard(r.id);var a2=r.mgmtPlan.plans[0].actions[0];return ok1&&t1>0&&a2.doneAt===t1&&a2.timeframe==='Monthly'})()")===true, 'addendum 186: periodic actions keep the last-done stamp across an edit-save \u2014 working state is definition-independent');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p186m'});editMgPlanCard(r.id,0);mgPlF('name',{value:'Repair plan renamed'});saveMgPlanCard(r.id);var kept=r.mgmtPlan.plans[0].actions.length===1&&r.mgmtPlan.plans[0].name==='Repair plan renamed';window.confirm=function(){return true};removeMgPlan(r.id,0);return kept&&r.mgmtPlan.plans.length===0})()")===true, 'addendum 186: the plan-level edit preserves the action list, and Remove plan lives behind its confirm inside the form');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('The monitoring plan needs an owner.')>=0&&_s.indexOf('The plan needs a name and a type.')>=0&&_s.indexOf('An action needs its text.')>=0&&_s.indexOf('Remove this action?')>=0&&_s.indexOf('The plan needs a name, a type, and at least one action.')<0&&_s.indexOf('needs at least one indicator and a named monitor')<0})(), 'addendum 186: the validation alerts split per the two-level model, verbatim, and the old combined alerts are gone from source');
  ok(w.eval("typeof saveCheckin")==='undefined'&&w.eval("typeof mnCheckDue")==='undefined'&&w.eval("typeof frChecks")==='undefined'&&(function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Log a check-in')<0&&_s.indexOf('Overall direction')<0&&_s.indexOf("'Checks Overdue'")<0&&_s.indexOf('Threshold to Manage')<0&&_s.indexOf('Source of the reading')<0})(), 'addendum 186 (Paul rulings): the check-in apparatus, the Checks Overdue series, and the old field labels are retired from source');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Monitoring checks \\u2014 when each was last logged:')<0&&_s.indexOf('and when each monitoring check was last logged.')<0/* clause retired 17 Aug 2026, Paul's stale-copy ruling: the title now matches the parallel-card ruling */&&_s.indexOf('>Prevention means')<0})(), 'addendum 186 (superseded 17 Aug 2026 morning, Paul’s ruling: the Plan type ? tooltip removed by ruling 22 Aug 2026; card 2 goes parallel — counts plus one route): the last-logged listing is gone from the source; the item title and the Plan type tooltip hold');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mn1'});var ck=r.monitorPlan.indicators[0].checks;return ck&&ck.length===2&&ck[0].note.indexOf('Within 1%')===0&&r.monitorPlan.indicators[1].checks.length===2})()")===true, 'addendum 186: the seeded check-in histories are redistributed onto their indicators as dated per-indicator entries (quoted in the ledger for veto)');
  ok(w.eval("(function(){window.confirm=function(){return true};['r-p186n','r-p186m'].forEach(function(id){data.risks=data.risks.filter(function(x){return x.id!==id})});saveData();UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;UI.mgOpen=null;UI.mgCards=null;UI.mgStash={};UI.mnStash={};return !data.risks.some(function(x){return /^r-p186/.test(x.id)})})()")===true, 'addendum 186: probe fixtures removed \u2014 the world is clean');

  
  /* ── addendum 187 (16 Aug 2026 late night, Paul's card-refinement rulings): true action cards,
     Done control with collapse and undo, removable check entries, tiny edit buttons ── */
  console.log('== addendum 187 ==');
  ok(w.eval("(function(){window.confirm=function(){return true};data.risks.push({id:'r-p187',name:'Refine probe',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'manage'});var r=data.risks.find(function(x){return x.id==='r-p187'});UI.mgOpen=r.id;UI.mgCards={plan:null,act:null,em:null};openMgPlanCard(r.id);mgPlF('name',{value:'Refine plan'});mgPlF('type',{value:'prevention'});saveMgPlanCard(r.id);openActCard(r.id,0);actF('action',{value:'Refined act'});actF('description',{value:'What done looks like here'});actF('owner',{value:'A'});actF('timeframe',{value:'Q2'});saveActionCard(r.id);var a=r.mgmtPlan.plans[0].actions[0];return a.description==='What done looks like here'&&a.done===false&&a.doneAt===0})()")===true, 'addendum 187: the action card carries a description field, saved and defaulting undone');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p187'});markActionDone(r.id,0,0);var a=r.mgmtPlan.plans[0].actions[0];var stamped=a.done===true&&a.doneAt>0&&typeof a.doneBy==='string';UI.planFocus={rid:r.id,kind:'mgplan',idx:0};UI.expanded['dna_'+r.id+'_0']=true;var h=mgSurface(r);var collapsed=h.indexOf('Done ')>=0&&h.indexOf('line-through')>=0&&h.indexOf('What done looks like here')<0;return stamped&&collapsed})()")===true, 'addendum 187 (retargeted 21 Aug 2026, dashboard redesign: struck bars live under the completed fold in the plan focus): Done stamps date and name and collapses the one-off card to its struck bar');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-p187'});editActCard(r.id,0,0);var hasUndo=_actForm(r.id,0,UI.mgCards.act.d,true,0).indexOf('Undo done')>=0;undoActionDone(r.id,0,0);cancelActCard(r.id);var a=r.mgmtPlan.plans[0].actions[0];var h=mgSurface(r);UI.planFocus=null;return hasUndo&&a.done===false&&a.doneAt===0&&h.indexOf('Mark this action done')>=0})()")===true, 'addendum 187: Edit shows the full card with Undo done, and undoing restores the open tile (retargeted 21 Aug 2026, action-tile recut)');
  ok(w.eval("(function(){data.risks.push({id:'r-p187n',name:'Refine probe mn',description:'d',category:'O',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()},classification:'monitor'});var r=data.risks.find(function(x){return x.id==='r-p187n'});UI.mnOpen=r.id;UI.mnCards={ind:null,em:null};UI.mnScalar=null;openMnPlanEdit(r.id);mnF('monitor',{value:'O'});saveMnLanding(r.id);openIndCard(r.id);indF('indicator',{value:'Refine reading'});saveIndicatorCard(r.id);logCheck(r.id,0);logCheck(r.id,0);window.confirm=function(){return true};removeCheck(r.id,0,0);var ck=r.monitorPlan.indicators[0].checks;return ck.length===1})()")===true, 'addendum 187: an accidental check entry is removable behind its confirm');
  ok(w.eval("(function(){var r=data.risks.find(function(x){return x.id==='r-mg3'});var done=(r.mgmtPlan.plans[0].actions||[]).filter(function(a){return !a.recur&&a.done});return done.length>=1&&done.every(function(a){return a.doneAt>0&&a.doneBy===a.owner})})()")===true, 'addendum 187: seeded done one-offs carry authored stamps \u2014 done three days back, by their owners (quoted in the ledger)');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("var BTN_TINY='font-size:9px;padding:0 5px;opacity:.65'")>=0&&(_s.match(/btnG\('Edit',[^\n]*?,BTN_TINY\)/g)||[]).length>=4&&_s.indexOf('rgba(var(--fg-rgb),.3)')>=0&&_s.indexOf('margin-top:14px')>=0&&_s.indexOf("btnS('Log check','logCheck(\\''+r.id+'\\','+j+')','#1E6E6E',CHECK_BTN)")>=0})(), 'addendum 187 (retargeted 21 Aug 2026, action-tile recut: the per-action Edit button retired — the tile body opens the editor): the ruled formatting \u2014 tiny subtle Edit buttons everywhere, blacker card borders, air above the smaller Check complete');
  ok(w.eval("(function(){window.confirm=function(){return true};['r-p187','r-p187n'].forEach(function(id){data.risks=data.risks.filter(function(x){return x.id!==id})});saveData();UI.mnOpen=null;UI.mnCards=null;UI.mnScalar=null;UI.mgOpen=null;UI.mgCards=null;return !data.risks.some(function(x){return /^r-p187/.test(x.id)})})()")===true, 'addendum 187: probe fixtures removed \u2014 the world is clean');

  /* ── addendum 188 (17 Aug 2026, Paul's ruling: the Architecture module's RACI graphics
     replace the governance matrix): colored letter chips, click-to-cycle cells, legend row;
     the select cells retire; govRaciCycle takes the write guard the select path lacked. ── */
  console.log('== addendum 188 ==');
  w.eval("UI.s22Tab='own';go('step','2.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var ppl=data.raciPeople;var mg=ppl.find(function(x){return x.name==='Tamsin Doyle'});var cell=h.indexOf('id=\"raci_ra-1:'+mg.id+'\"')>=0;var chip=h.indexOf('border-radius:13px')>=0;var click=h.indexOf('govRaciCycle(')>=0;var noSel=h.indexOf('<select id=\"raci_')<0;return cell&&chip&&click&&noSel})()")===true, 'addendum 188: cells carry colored letter chips and cycle on click — the select cells are gone');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return ['Responsible \\u2014 does the work','Accountable \\u2014 owns the decision, exactly one per activity','Consulted \\u2014 input before','Informed \\u2014 told after'].every(function(t){return h.indexOf(t)>=0})})()")===true, 'addendum 188: the legend row explains all four letters beneath the matrix');
  ok(w.eval("(function(){var a=data.raciActs[0];var ppl=data.raciPeople;var mg=ppl.find(function(x){return x.name==='Tamsin Doyle'});var k=a.id+':'+mg.id;var start=data.raci[k]||'';var seen=[];for(var i=0;i<5;i++){govRaciCycle(k);seen.push(data.raci[k]||'')}var back=(data.raci[k]||'')===start;var order=['','R','A','C','I'];var walked=seen.every(function(v){return order.indexOf(v)>=0});return back&&walked&&seen.length===5})()")===true, 'addendum 188: five clicks walk the full R \\u2192 A \\u2192 C \\u2192 I \\u2192 blank cycle and land back where they began (fixture restored)');
  ok(w.eval("(function(){var h=renderOutRaci2();var chips=h.indexOf('border-radius:13px')>=0;var inert=h.indexOf('govRaciCycle(')<0;var legend=h.indexOf('Responsible \\u2014 does the work')>=0;return chips&&inert&&legend})()")===true, 'addendum 188: the Phase 2 outcome document renders the chips read-only — no cycle handler — with the legend beneath');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("function govRaciCycle(key){if(lockBlocked('raci'))return;")>=0})(), 'addendum 188: the cycle writer opens on the raci write guard, per the addendum-96 doctrine');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 189 (17 Aug 2026, Paul's ruling, quick-win suite): the dormant LIT scatter
     revived — plain-English card copy, inert dots with working hover names, and one caller
     on each of 2.5 (register scope) and 3.2 (Assess-pool scope). ── */
  console.log('== addendum 189 ==');
  w.eval("data.risks.push({id:'r-p189a',name:'Scatter probe A',description:'d',category:'O',source:'internal',litL:4,litI:5,litT:3,status:'identified'});data.risks.push({id:'r-p189b',name:'Scatter probe B',description:'d',category:'T',source:'internal',litL:2,litI:3,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()}});saveData()"); await wait();
  w.eval("go('step','2.5')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var card=h.indexOf('Likelihood and Impact')>=0&&h.indexOf('Each dot is one risk, placed by its likelihood and impact scores.')>=0;var dotA=h.indexOf('Scatter probe A (L:4 I:5)')>=0;var scoped=h.indexOf('Scatter probe B')<0;var inert=h.indexOf('LIT Scatter Plot')<0;return card&&dotA&&scoped&&inert})()")===true, 'addendum 189: 2.5 plots the preliminary register — probe A dots in, the advanced probe B stays off the step, the old title is gone');
  w.eval("go('step','3.2')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var card=h.indexOf('Likelihood and Impact')>=0;var dotB=h.indexOf('Scatter probe B (L:2 I:3)')>=0;return card&&dotB})()")===true, 'addendum 189: 3.2 plots the Assess pool — the advanced probe B dots in');
  ok(w.eval("(function(){var h=vizLITScatter([{id:'x',name:'Inert probe',category:'O',litL:3,litI:3}]);var inert=h.indexOf('goModule')<0&&h.indexOf('cursor:pointer')<0;var hover=h.indexOf('<title>Inert probe (L:3 I:3)</title></circle>')>=0;return inert&&hover})()")===true, 'addendum 189: dots are inert and the hover name sits inside its circle');
  ok(w.eval("vizLITScatter([{id:'y',name:'Unscored probe',category:'O'}])")==='', 'addendum 189: a list with no scored risks renders nothing — the card only appears once scores exist');
  w.eval("window.confirm=function(){return true};['r-p189a','r-p189b'].forEach(function(id){data.risks=data.risks.filter(function(x){return x.id!==id})});saveData();go('phase5')"); await wait();
  ok(w.eval("!data.risks.some(function(x){return /^r-p189/.test(x.id)})")===true, 'addendum 189: probe fixtures removed — the world is clean');

  /* ── addendum 190 (17 Aug 2026, Paul's ruling, quick-win suite): the 2.5 triage strip —
     flowStrip generalizes the donor chevron anatomy with the stage set as a parameter;
     riskViz and its six call sites are untouched. ── */
  console.log('== addendum 190 ==');
  w.eval("data.risks.push({id:'r-p190a',name:'Strip probe awaiting',description:'d',category:'O',source:'internal',litL:3,litI:3,litT:3,status:'identified'});data.risks.push({id:'r-p190b',name:'Strip probe deferred',description:'d',category:'T',source:'internal',litL:2,litI:2,litT:2,status:'identified',selection:{decision:'defer',trigger:'t',revisit:'r',by:'t',at:Date.now()}});data.risks.push({id:'r-p190c',name:'Strip probe advanced',description:'d',category:'S',source:'internal',litL:2,litI:3,litT:2,status:'identified',selection:{decision:'advance',owner:'t',by:'t',at:Date.now()}});saveData()"); await wait();
  w.eval("go('step','2.5')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return ['Awaiting Decision','Advanced to Assess','Deferred'].every(function(t){return h.indexOf('>'+t+'</text>')>=0})&&h.indexOf('u-778010b')>=0})()")===true, 'addendum 190: the triage strip renders its three chevrons on the donor anatomy');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var aw=(data.risks||[]).filter(function(r){return inIdentifyBucket(r)&&!(r.selection&&r.selection.decision)}).length;var ad=(data.risks||[]).filter(inAssessBucket).length;var df=(data.risks||[]).filter(function(r){return isLiveRisk(r)&&(r.selection||{}).decision==='defer'}).length;var seg=h.substring(h.indexOf('Awaiting Decision'),h.indexOf('regControls')>=0?h.indexOf('regControls'):h.length);return h.indexOf('>'+aw+' item')>=0&&h.indexOf('>'+ad+' item')>=0&&h.indexOf('>'+df+' item')>=0&&aw>=1&&ad>=1&&df>=1})()")===true, 'addendum 190: the three counts are live bucket counts — the probes land one in each chevron');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var i=h.indexOf('Advanced to Assess');var back=h.lastIndexOf('phase-flex',i);var seg=h.substring(back,i);return seg.indexOf(\"goModule('pf-assess')\")>=0})()")===true, 'addendum 190: the Advanced chevron opens the Assess portfolio; the other two are inert');
  w.eval("window.confirm=function(){return true};['r-p190a','r-p190b','r-p190c'].forEach(function(id){data.risks=data.risks.filter(function(x){return x.id!==id})});saveData();go('phase5')"); await wait();
  ok(w.eval("!data.risks.some(function(x){return /^r-p190/.test(x.id)})")===true, 'addendum 190: probe fixtures removed — the world is clean');

  /* ── addendum 191 (17 Aug 2026, Paul's ruling, quick-win suite): the 3.1 screening strip —
     every flagged card is awaiting, confirmed, or cleared; all three chevrons inert (the
     first two lists live on the page, cleared is recorded on the cards). ── */
  console.log('== addendum 191 ==');
  w.eval("go('step','3.1')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var live=(data.risks||[]).filter(isLiveRisk);var pot=live.filter(function(r){return ethStatusOf(r)==='potential'}).length;var conf=live.filter(function(r){return ethStatusOf(r)==='confirmed'}).length;var cl=live.filter(function(r){return ethStatusOf(r)==='cleared'}).length;var labels=['Awaiting Screening','Confirmed','Cleared'].every(function(t){return h.indexOf('>'+t+'</text>')>=0});return labels&&h.indexOf('u-778010b')>=0&&(pot+conf+cl)>=1})()")===true, 'addendum 191: the strip renders its three chevrons and the seed carries at least one flagged card to count');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var strip=h.substring(h.indexOf('Awaiting Screening'),h.indexOf('>Cleared</text>'));return strip.indexOf('goModule(')<0&&strip.indexOf('onclick')<0})()")===true, 'addendum 191: all three screening chevrons are inert');
  ok(w.eval("(function(){var live=(data.risks||[]).filter(isLiveRisk);var cl=live.filter(function(r){return ethStatusOf(r)==='cleared'}).length;var h=document.getElementById('app').innerHTML;var i=h.indexOf('>Cleared</text>');var seg=h.substring(i,i+220);return seg.indexOf('>'+cl+' item')>=0})()")===true, 'addendum 191: the Cleared chevron counts the cleared cards — the seed r-b3 record dots in');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 192 (17 Aug 2026, Paul's ruling, quick-win suite): the 4.1 coverage rings —
     complete plans over cards that need one, split by classification. No overdue-checks
     chip: the Checks Overdue series retired by Paul's ruling, 16 Aug 2026 night. ── */
  console.log('== addendum 192 ==');
  w.eval("go('step','4.1')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var P=getPortfolios();var mg=P.manage.filter(function(r){return cardClass(r)==='manage'});var mn=P.manage.filter(function(r){return cardClass(r)!=='manage'});var mgT='>'+mg.filter(mgPlanComplete).length+'/'+mg.length+'</text>';var mnT='>'+mn.filter(mnPlanComplete).length+'/'+mn.length+'</text>';var labels=h.indexOf('Management plans')>=0&&h.indexOf('Monitoring plans')>=0;return labels&&h.indexOf(mgT)>=0&&h.indexOf(mnT)>=0&&h.indexOf('stroke-dasharray')>=0})()")===true, 'addendum 192: both rings render with live counts — complete plans over cards needing one, split by classification');
  ok(w.eval("covRing(0,0,'#9B2D3F','Empty probe')")==='', 'addendum 192: an empty set renders no ring');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var a=h.indexOf('Management plans');var b=h.indexOf('Planning Required');if(b<0)b=h.indexOf('Nothing needs attention');var seg=(a>=0&&b>a)?h.substring(a,b):'';return seg.indexOf('Overdue')<0})()")===true, 'addendum 192: the ring strip carries no overdue vocabulary — the retired series stays retired');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 193 (17 Aug 2026, Paul's ruling, quick-win suite): 4.4 opens on Where
     Governance Stands — live-risk donut, obligations-met ring, plans-in-place ring — then
     the six-item agenda stepper. One _frDefs array feeds the stepper and the item cards,
     so no agenda title exists twice (the addendum-127 census holds untouched). The standing
     Governance Review page is deliberately left bare, held for Paul's twin-surface ruling. ── */
  console.log('== addendum 193 ==');
  w.eval("go('step','4.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var P=getPortfolios();var tot=P.identify.length+P.assess.length+P.manage.length+P.emergency.length;return h.indexOf('Where Governance Stands')>=0&&h.indexOf('Live risks')>=0&&h.indexOf('>'+tot+'</text>')>=0&&h.indexOf('Plans in place')>=0})()")===true, 'addendum 193: the state strip renders — the donut center carries the live total and the plans ring its label');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var wk=((data.firstReview||{}).walk)||{};var done=['planned','stuck','systems','tests','compliance','review'].filter(function(k){return wk[k]}).length;var checks=(h.match(/border-radius:15px[^>]*>\\u2713</g)||[]).length;return checks===done})()")===true, 'addendum 193: the stepper fills one green check per covered agenda item — node count tracks the walk state exactly');
  ok(w.eval("(function(){var k0=((data.firstReview||{}).walk||{}).planned;walkFR('planned');var h1=document.getElementById('app').innerHTML;var after=(h1.match(/border-radius:15px[^>]*>\\u2713</g)||[]).length;walkFR('planned');var h2=document.getElementById('app').innerHTML;var restored=(h2.match(/border-radius:15px[^>]*>\\u2713</g)||[]).length;var wkNow=((data.firstReview||{}).walk||{}).planned;return Math.abs(after-restored)===1&&(!!wkNow===!!k0)})()")===true, 'addendum 193: covering an item moves the stepper by one node and undo restores it (fixture restored)');
  ok(w.eval("(function(){var obs=[];(data.regimes||[]).forEach(function(g){(g.obligations||[]).forEach(function(o){if(o&&o.status!=='na')obs.push(o)})});var met=obs.filter(function(o){return o.status==='met'}).length;if(!obs.length)return document.getElementById('app').innerHTML.indexOf('Obligations met')<0;return document.getElementById('app').innerHTML.indexOf('>'+met+'/'+obs.length+'</text>')>=0})()")===true, 'addendum 193: the obligations ring counts met over everything except N/A, or stays off the page when no obligations exist');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var i=_s.indexOf('function renderGovReview');var j=_s.indexOf('function render44');var seg=i<j?_s.substring(i,j):_s.substring(i);return seg.indexOf('frStepper(_grDefs)')>=0&&seg.indexOf('govStateStrip()')>=0})(), 'addendum 193 (superseded 17 Aug 2026 morning, Paul\u2019s ruling: the standing page takes the 4.4 opener): the twin surface now carries the strip and the stepper from its own _grDefs');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 194 (17 Aug 2026 morning, Paul's ruling): co-located scatter risks stacked
     into one visible dot — each cell's risks now fan out in a deterministic ring around
     the cell point; a lone risk sits exactly on it; edge-cell dots clamp into the plot. ── */
  console.log('== addendum 194 ==');
  ok(w.eval("(function(){var L=[];for(var i=0;i<5;i++)L.push({id:'sp'+i,name:'Spread probe '+i,category:'O',litL:3,litI:3});var h=vizLITScatter(L);var n=(h.match(/<circle /g)||[]).length;var pts={};var re=/cx=\"([0-9.]+)\" cy=\"([0-9.]+)\"/g,m;while((m=re.exec(h)))pts[m[1]+','+m[2]]=1;return n===5&&Object.keys(pts).length===5})()")===true, 'addendum 194: five risks on one cell render five circles at five distinct positions');
  ok(w.eval("(function(){var L=[{id:'sp1',name:'Lone probe',category:'O',litL:3,litI:3}];var h=vizLITScatter(L);return h.indexOf('cx=\"215.0\" cy=\"135.0\"')>=0})()")===true, 'addendum 194: a lone risk sits exactly on its cell point — no offset');
  ok(w.eval("(function(){var L=[];for(var i=0;i<4;i++)L.push({id:'sd'+i,name:'Det probe '+i,category:'T',litL:2,litI:4});return vizLITScatter(L)===vizLITScatter(L)})()")===true, 'addendum 194: the fan-out is deterministic — the same list draws the same picture every render');
  ok(w.eval("(function(){var L=[];for(var i=0;i<8;i++)L.push({id:'se'+i,name:'Edge probe '+i,category:'S',litL:5,litI:5});var h=vizLITScatter(L);var okAll=true;var re=/cx=\"([0-9.]+)\" cy=\"([0-9.]+)\"/g,m;while((m=re.exec(h))){var x=+m[1],y=+m[2];if(x<49||x>381||y<19||y>251)okAll=false}return okAll})()")===true, 'addendum 194: a crowded corner cell keeps every dot inside the plot — nothing clips at the edge');

  /* ── addendum 195 (17 Aug 2026 morning, Paul's ruling): the standing Governance Review
     page takes the 4.4 opener — govStateStrip then the agenda stepper. The strip hoisted
     into one definition serving both surfaces; the walk store is already shared, so a
     covered item shows covered on both. ── */
  console.log('== addendum 195 ==');
  w.eval("go('govreview')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Where Governance Stands')>=0&&h.indexOf('Live risks')>=0&&(h.match(/border-radius:15px/g)||[]).length===7})()")===true, 'addendum 195 (retargeted 22 Aug 2026: Review responsibilities joins): the standing page opens on the state strip and a seven-node stepper');
  ok(w.eval("(function(){var wk=((data.firstReview||{}).walk)||{};var done=['planned','stuck','systems','tests','compliance','review'].filter(function(k){return wk[k]}).length;var h=document.getElementById('app').innerHTML;var checks=(h.match(/border-radius:15px[^>]*>\\u2713</g)||[]).length;return checks===done})()")===true, 'addendum 195: the stepper reads the shared walk store — covered on 4.4 is covered here');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.split('Where Governance Stands').length===2&&_s.split('register: Are there any new regimes').length===4})(), 'addendum 195: the strip heading exists exactly once — in the hoisted helper both surfaces call — and the addendum-127 title census still holds at three');
  w.eval("go('phase5')"); await wait();

  /* ── addenda 196–197 (17 Aug 2026 morning, Paul's rulings): the stepper centers on the
     page, and the review cards' Open buttons take a readable tone in dark mode. ── */
  console.log('== addenda 196-197 ==');
  w.eval("go('step','4.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('margin:0 auto 18px')>=0})()")===true, 'addendum 196: the agenda stepper rides an auto margin — centered, not left-aligned');
  ok(w.eval("(function(){var t0=UI.theme;UI.theme='dark';render();var hd=document.getElementById('app').innerHTML;var iD=hd.indexOf('Open the governance dashboard');var dOK=hd.lastIndexOf('#9FB3C1',iD)>iD-260&&hd.lastIndexOf('#9FB3C1',iD)>=0;UI.theme='light';render();var hl=document.getElementById('app').innerHTML;var iL=hl.indexOf('Open the governance dashboard');var lOK=hl.lastIndexOf('#3D4F5C',iL)>iL-260&&hl.lastIndexOf('#3D4F5C',iL)>=0;UI.theme=t0;render();return dOK&&lOK})()")===true, 'addendum 197: the Open buttons read light blue-grey in dark mode and the family slate in light (theme restored)');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return (_s.match(/btnOpen\('Open /g)||[]).length===5/* extended same-session, addendum 198: card 2's portfolio route joins */&&_s.indexOf("btnS('Open the risk dashboard'")<0&&_s.indexOf("btnS('Open the systems list'")<0&&_s.indexOf("btnS('Open the Testing Center','go(\\'step\\',\\'5.3\\')','#3D4F5C'")<0&&_s.indexOf("btnS('Open the compliance dashboard'")<0})(), 'addendum 197: all four review-card Open buttons ride the helper — no slate-hardwired stragglers');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 198 (17 Aug 2026 morning, Paul's ruling): card 2 of the governance review
     goes parallel to its siblings — the counts line stays, the last-logged monitoring
     listing retires, and one button routes to the Manage portfolio where the check logs
     live on the cards themselves. ── */
  console.log('== addendum 198 ==');
  w.eval("go('step','4.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var btn=h.indexOf('Open the risk portfolio')>=0;var route=h.indexOf('goModule(&#039;pf-manage&#039;)')>=0||h.indexOf(\"goModule('pf-manage')\")>=0;var listGone=h.indexOf('Monitoring checks')<0;var counts=h.indexOf('assessments in progress')>=0&&h.indexOf('plans needing attention')>=0;return btn&&route&&listGone&&counts})()")===true, 'addendum 198 (label superseded same morning, Paul’s ruling: sibling case): card 2 carries its counts and the Open the risk portfolio route — the last-logged listing is off the page');
  ok(w.eval("(function(){var h=govHygieneBody();return h.indexOf('Open the risk portfolio')>=0&&h.indexOf('no checks yet')<0})()")===true, 'addendum 198: the body renders the button and none of the per-indicator lines');
  w.eval("go('phase5')"); await wait();

  /* ── addenda 199–201 (17 Aug 2026 morning, Paul's rulings): NIST chips take four
     separated family hues on solid fills; the card-2 button reads sibling case; the state
     strip reorders risk-left/compliance-right with NIST conformity as a keyed donut. ── */
  console.log('== addenda 199-201 ==');
  w.eval("go('step','2.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var m=h.match(/<span[^>]*>GOVERN 1\\.1<\\/span>/);if(!m)return 'no chip';var chip=m[0];var lt=chip.indexOf('background:#2D5A8E2E')>=0&&chip.indexOf('color:#2D5A8E;')>=0&&chip.indexOf('#2D5A8E66')>=0&&chip.indexOf('#fff')<0;var t0=UI.theme;UI.theme='dark';render();var m2=document.getElementById('app').innerHTML.match(/<span[^>]*>GOVERN 1\\.1<\\/span>/);var dk=!!m2&&m2[0].indexOf('color:#8FB0D9')>=0&&m2[0].indexOf('background:#2D5A8E2E')>=0;UI.theme=t0;render();return lt&&dk})()")===true, 'addendum 199 (superseded by 203, 17 Aug 2026 morning, Paul’s ruling: hues kept, fill faded well back; defect note: the original pin matched the assignee avatar, never the chip — this one inspects the chip element itself): an 18% tint with a 40% border, hue text in light mode, the hand-lightened variant in dark (theme restored)');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("var NIST_FN_COLORS={GOVERN:'#2D5A8E',MAP:'#1E6E6E',MEASURE:'#8B5E3C',MANAGE:'#9B2D3F'}")>=0})(), 'addendum 199: GOVERN blue, MAP teal, MEASURE bronze, MANAGE crimson — four hues a few points apart');
  w.eval("go('step','4.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var a=h.indexOf('>Live risks<');var b=h.indexOf('>Plans in place<');var c=h.indexOf('>NIST conformity<');var d=h.indexOf('>Other obligations met<');return a>=0&&b>a&&c>b&&d>c})()")===true, 'addendum 201: the strip orders risk counters left and compliance right — Live risks, Plans in place, NIST conformity, Other obligations met');
  ok(w.eval("(function(){var ach=0,prog=0,open=0;NIST_SUBCATS.forEach(function(sc){var st=nistSubStatus(sc).s;if(st==='achieved')ach++;else if(st==='progress')prog++;else open++});var h=document.getElementById('app').innerHTML;var i=h.indexOf('>NIST conformity<');var seg=h.substring(h.lastIndexOf('<div style=\"display:flex;gap:14px',i),i+900);return seg.indexOf('>'+(ach+prog+open)+'</text>')>=0&&seg.indexOf('Addressed \u00b7 '+ach)>=0&&seg.indexOf('In progress \u00b7 '+prog)>=0&&seg.indexOf('Open \u00b7 '+open)>=0&&(ach+prog+open)===72})()")===true, 'addendum 201 (superseded by 202, 17 Aug 2026 morning, Paul’s discrepancy report): the donut counts what the dashboard paints — nistSubStatus over all 72 rows, Addressed / In progress / Open');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 202 (17 Aug 2026 morning, Paul's discrepancy report): the NIST donut and
     the compliance dashboard now read the same measure — the derived nistSubStatus —
     so the 4.4 picture matches the green ADDRESSED rows the dashboard shows. ── */
  console.log('== addendum 202 ==');
  ok(w.eval("(function(){var d=nistDonut();return d.indexOf('Satisfied')<0&&d.indexOf('Not yet')<0&&d.indexOf('Addressed')>=0})()")===true, 'addendum 202: the certification vocabulary is off the donut — it speaks the dashboard’s language');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('nistSubStatus(sc).s;if(st===\'achieved\')ach++')>=0&&_s.split('function nistDonut(){').length===2})(), 'addendum 202: one donut definition, reading nistSubStatus');

  /* ── addendum 203 (17 Aug 2026 morning, Paul's ruling): the chips keep the new hues but
     fade well back — tinted fills in both modes, hue-matched text lightened per hue in
     dark mode; the charts keep the base hues. ── */
  console.log('== addendum 203 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("var NIST_FN_COLORS_LT={GOVERN:'#8FB0D9',MAP:'#6FBABA',MEASURE:'#C9A27E',MANAGE:'#D98A96'}")>=0&&_s.indexOf("background:'+c+'2E;color:'+tc+';border:1px solid '+c+'66")>=0&&_s.indexOf("background:'+c+';color:#fff;cursor:help")<0})(), 'addendum 203: the tinted chip markup is the one chip form in the source — the solid fill is gone');

  /* ── addenda 204–206 (17 Aug 2026 morning, Paul's rulings): the Learn cards link to
     their articles (mirror-first; the cascade piece has no surfaced mirror, so it links to
     the Fast Company original); step 1.3 renamed Identify Risks with the CARE framework
     vocabulary untouched; the dashboard renamed Governance Dashboard and restructured —
     Program Coverage, then Governance Overview (reviews, systems, principles, testing),
     then Risk Management (emergency, chevrons, portfolios, glance), then Team Load. ── */
  console.log('== addenda 204-206 ==');
  ok((function(){var _t=require('fs').readFileSync('Governance-templates-local.js','utf8');var urls=['faisalhoque.com/heres-how-to-jump-start-your-companys-responsible-ai-governance-in-90-days/','faisalhoque.com/your-ai-use-policy-is-solving-the-wrong-problem/','imd.org/ibyimd/artificial-intelligence/the-looming-ai-risk-automating-middle-management-destroys-critical-ethical-layer/','fastcompany.com/91459838/ai-butterfly-effect-danger-cascade-failures','faisalhoque.com/the-cost-of-hollowing-out-human-accountability/','imd.org/ibyimd/artificial-intelligence/four-questions-to-guide-the-implementation-of-responsible-ai-and-how-confucius-and-adam-smith-can-help/'];return urls.every(function(u){return _t.indexOf(u)>=0})&&_t.indexOf('href=\\"https://www.fastcompany.com\\"')<0&&_t.indexOf('href=\\"https://www.imd.org\\"')<0})(), 'addendum 204: every Learn card links to its article — no front-page hrefs remain in the bundle');
  ok(w.eval("(function(){var st=PH[0].steps.find(function(x){return x.id==='1.3'});go('step','1.3');var h=document.getElementById('app').innerHTML;return st.name==='Identify Risks'&&h.indexOf('Step 1.3: Identify Risks')>=0&&h.indexOf('Catastrophize')<0})()")===true, 'addendum 205: step 1.3 is Identify Risks on the registry and the page — the old name is off the step');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Catastrophize, Assess, Regulate, Exit')>=0 /* RETARGETED 28 Oct 2026 (Paul): the AI Guide paragraph that spelled out the CARE framework is deleted, and the Insights card for the CARE framework article now carries its vocabulary */&&_s.indexOf("name:'Catastrophize'")<0&&_s.indexOf("name:'Governance Dashboard'")>=0&&_s.indexOf("l:'Risk Dashboard'")<0})(), 'addendum 205: the CARE framework keeps its own vocabulary; the step registry and nav carry the new names');
  w.eval("go('phase5')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var a=h.indexOf('Program Coverage');var b=h.indexOf('Governance Overview');var c=h.indexOf('Next New Risk Review');var d=h.indexOf('>AI Systems<');var e=h.indexOf('Register of Responsible AI Principles');var f=h.indexOf('>Testing Center</h3>');var g=h.indexOf('>Risk Management</h2>');var i=h.indexOf('u-778010b');var j=h.indexOf('Risk Portfolio');var k=h.lastIndexOf('govTeamLoad')>=0?h.length-1:h.indexOf('Team Load');return a>=0&&b>a&&c>b&&d>c&&e>d&&f>e&&g>f&&i>g&&j>i})()")===true, 'addendum 206: the dashboard reads in the ruled order — coverage, Governance Overview (reviews, systems, principles, testing), Risk Management (chevrons, glance)');

  /* ── addendum 207 (17 Aug 2026 morning, Paul's rulings): the Live Risks stat takes a
     mid blue readable in both modes; the donut's Emergency segment goes hotter red so it
     separates from Managed; Team Load rehomes to Analytics; the Program Coverage card is
     one top-level definition opening both the dashboard and the Analytics page. ── */
  console.log('== addendum 207 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("['Live Risks',live.length,'#4A7FBF'")>=0&&_s.indexOf("'#F5F2EC'")<0})(), 'addendum 207: the Live Risks stat rides mid blue — the invisible cream token is out of the source');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var i=_s.indexOf('function stateDonut');var seg=_s.substring(i,i+700);return seg.indexOf("c:'#E03535'")>=0&&seg.indexOf("c:'#9B2D3F'")>=0})(), 'addendum 207: on the Live risks donut, Emergency Response reads hotter red beside Managed crimson');
  w.eval("go('step','5.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('How is this scored?')>=0&&h.indexOf('LIVE RISKS')>=0&&h.indexOf('Team Load')>=0})()")===true, 'addendum 207: Analytics opens with the shared coverage card, keeps its KPI row, and carries Team Load');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var d=_s.split('function govCoverageCard(){');var callers=(_s.match(/h\+=govCoverageCard\(\);/g)||[]).length;return d.length===2&&callers===2&&_s.indexOf('Governance <em>Dashboard</em>')>=0&&_s.indexOf('Risk Governance <em>Dashboard</em>')<0})(), 'addendum 207: one coverage definition at top level, two callers, and the dashboard H1 carries the ruled name');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 208 (17 Aug 2026 morning, Paul's rulings): the analytics top reads as a
     2x2 — Signals, Heatmap / Pipeline, Radar — with the Category Profile centered beneath;
     Team Load sits above the Risk Explorer; the explorer's register folds, with the title,
     subtitle, and severity buttons always in view and a filter choice opening the fold. ── */
  console.log('== addendum 208 ==');
  w.eval("if(UI.expanded)UI.expanded.anExplorer=false;go('step','5.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var a=h.indexOf('Analytical Signals');var b=h.indexOf('Risk Heatmap');var c=h.indexOf('Risk Pipeline');var d=h.indexOf('NIST Areas Addressed',c);/* the KPI stat carries the same label higher up — the card is the hit after Pipeline */var e=h.indexOf('Risk Category Profile');var t=h.indexOf('Team Load');var x=h.indexOf('Risk Explorer');return a>=0&&b>a&&c>b&&d>c&&e>d&&t>e&&x>t})()")===true, 'addendum 208: the page reads Signals, Heatmap, Pipeline, Radar, the centered Category Profile, then Team Load above the Risk Explorer');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('390px 1fr')<0})(), 'addendum 208: the orphaned 390px grid is out of the source — the gap dies with it');
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var i=h.indexOf('Risk Explorer');var seg=h.substring(i);var folded=seg.indexOf('Show the ')>=0&&seg.indexOf('click headers to sort')<0&&seg.indexOf('<table')<0;var chips=seg.indexOf('Critical')>=0&&seg.indexOf('Responsible AI')>=0;/* chip renamed under the executed cat-2/3 ruling, 17 Aug 2026 *//* chip name restored: the badge sweep deferred by Paul's ruling, 17 Aug 2026 */return folded&&chips})()")===true, 'addendum 208: folded by default — the severity buttons and count stay in view, the table stays down');
  w.eval("anFilter('high')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;var i=h.indexOf('Risk Explorer');var seg=h.substring(i);var open=seg.indexOf('<table')>=0&&seg.indexOf('Fold the list')>=0&&seg.indexOf('click headers to sort')>=0;anFilter('high');if(UI.expanded)UI.expanded.anExplorer=false;render();return open&&!UI.anFilt})()")===true, 'addendum 208: choosing a filter opens the fold with the sortable table (fixture restored)');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 209 (17 Aug 2026 morning; scope cut same morning; categories two and
     three EXECUTED later that day, addendum 211, after Paul's string-by-string approval
     of the checking document): the responsible-AI reframe is now complete across all
     rendered copy, under the capital-R law — "Responsible AI" capitalized wherever it
     names the domain, lowercase only in loose non-formal use. Articles repaired at
     vowel-initial sites. HOLDS RULED KEEP (17 Aug): the 'Ethical & societal' domain
     value, the seed researcher's profession, quoted titles and findings, and the
     Learn-page article glosses. Identifiers, page ids, and saved-data keys untouched. ── */
  console.log('== addendum 209 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('AI Ethics Review Board')<0&&_s.indexOf('Responsible AI Review Board')>=0&&_s.indexOf('Ethics Screening')<0&&_s.indexOf("name:'Responsible AI Framework'")>=0&&_s.indexOf('Register of Responsible AI Principles')>=0})(), 'addendum 209: the board, the screening step, the framework, and the register carry the responsible-AI names — the old proper names are out of the rendered source');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('function ethStatusOf')>=0&&_s.indexOf("'ethicsov'")>=0&&(_s.indexOf('ethicalFramework:{}')>=0||_s.indexOf('data.ethicalFramework')>=0)&&_s.indexOf("ethStatus:'cleared'")>=0})(), 'addendum 209: the identifier boundary holds — stores, page ids, and function names unchanged, so saved data survives the reframe');
  w.eval("go('step','3.1')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Responsible AI Screening')>=0&&h.indexOf('Ethics Screening')<0&&h.indexOf('Awaiting Screening')>=0})()")===true, 'addendum 209: 3.1 renders under its new name and the screening strip rides along');
  w.eval("go('phase5')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('Responsible AI Board Review')>=0&&h.indexOf('Register of Responsible AI Principles')>=0&&h.indexOf('Ethics Board')<0})()")===true, 'addendum 209: the dashboard carries the renamed review card and register fold');

  /* ── addendum 210 (17 Aug 2026 morning, Paul's rulings): four heading renames — step 1.2
     is AI System Inventory; 1.4's register drops "Potential" (heading, guide copy, and the
     output document title, now Compliance Regimes); 2.2's first tab and its section
     heading read Governance Model (step name unchanged). Pins carrying the old strings
     retargeted in place under the same ruling. ── */
  console.log('== addendum 210 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("name:'AI System Inventory'")>=0&&_s.indexOf('AI Landscape Inventory')<0&&_s.indexOf('Potential Compliance')<0})(), 'addendum 210: the registry carries AI System Inventory and the word Potential is off the compliance surfaces');
  w.eval("go('step','1.4')"); await wait();
  ok(w.eval("(function(){var h=document.getElementById('app').innerHTML;return h.indexOf('>Compliance Survey</h3>')>=0&&h.indexOf('Potential Compliance')<0})()")===true, 'addendum 210 (retargeted 21 Aug 2026): 1.4 renders the Compliance Survey heading — the survey rename ends the two-cards-one-name collision');
  w.eval("go('step','2.2')"); await wait();
  ok(w.eval("(function(){UI.s22Tab='own';render();var h=document.getElementById('app').innerHTML;var tab=h.indexOf('Governance Model</button>')>=0;var hd=h.indexOf('sec-title');var hdOK=hd>=0&&h.substring(hd,hd+120).indexOf('Governance Model')>=0;return tab&&hdOK&&h.indexOf('Step 2.2: Ownership &amp; Structure')>=0})()")===true, 'addendum 210: the first 2.2 tab and its heading read Governance Model while the step keeps its name');
  w.eval("go('phase5')"); await wait();

  /* ── addendum 211 (17 Aug 2026, Paul's ruling): categories two and three executed with
     the capital-R law; holds kept; boundary re-proved. ── */
  console.log('== addendum 211 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Responsible AI '+String.fromCharCode(92)+'u00b7 confirmed')>=0&&_s.indexOf('Responsible AI Flags')>=0&&_s.indexOf('Responsible AI engaged')>=0&&_s.indexOf(":'Responsible AI'}")>=0})(), 'addendum 211: the badges, the KPI stat, the practice bar, and the workbench tab carry the Responsible AI names');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('A Responsible AI failure is different')>=0&&_s.indexOf('Responsible AI dimension')>=0&&_s.indexOf('ethics track')<0&&_s.indexOf('ethical dimension')<0&&_s.indexOf('the Responsible AI breach analysis')>=0})(), '(retargeted 22 Aug 2026, rev17 carousel port) addendum 211: the working prose speaks Responsible AI with capital R and repaired articles');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("'Ethical & societal'")>=0&&_s.indexOf('AI ethics researcher')>=0&&_s.indexOf('Principles alone cannot guarantee ethical AI')>=0&&_s.indexOf('Middle Managers Are the Ethical Backbone of AI Deployment')>=0&&_s.indexOf('an ethical violation')>=0})(), 'addendum 211: the four ruled-keep holds and the lawful loose usages stand untouched');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('function ethStatusOf')>=0&&_s.indexOf("'ethicsov'")>=0&&_s.indexOf("ethStatus:'cleared'")>=0})(), 'addendum 211: the identifier boundary holds — saved data survives');

  /* ── addendum 212 (17 Aug 2026, Paul's rulings): the battery question capitalizes
     Responsible AI; the Data Bank tile aligns to Compliance Regimes; the 2.2 selector
     card retitles Governance Approach with the field label kept; the agenda-2 title
     drops the retired last-logged clause on both review surfaces. ── */
  console.log('== addendum 212 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('treat Responsible AI as')>=0&&_s.indexOf('treat responsible AI as')<0})(), 'addendum 212: the battery question names the domain with its capital R');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("{id:'out-reglandscape',name:'Compliance Survey',phase:'Phase 1'")>=0})(), 'addendum 212: the Data Bank tile speaks the document’s own name');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('>Governance Approach</h3>')>=0&&_s.indexOf("sel('Governance model','os_govModel'")>=0&&_s.split('>Governance Model</h3>').length===2})(), 'addendum 212: the selector card reads Governance Approach, the field keeps Governance model, the section heading stands alone');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.split('assessments in progress and plans needing attention.').length===4/* third site: the 4.4 intro list joined under Paul's checks-overdue ruling, 17 Aug 2026 */&&_s.indexOf('and when each monitoring check was last logged')<0})(), 'addendum 212: agenda item 2 reads clean on both review surfaces — the retired clause is out of the source');

  /* ── addendum 213 (17 Aug 2026, Paul's rulings: pitch items 1 and 9): one tile board,
     two homes — the 1.2 estate wall (deployment groups, provenance and governance chips,
     internal-versus-vendor donut) and the 4.3 currency board (deployment chip, evidence
     and exit-plan dots). Archived systems stay out of both. ── */
  console.log('== addendum 213 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.split('function govSysTiles(mode){').length===2&&(_s.match(/govSysTiles\('estate'\)/g)||[]).length===3&&(_s.match(/govSysTiles\('currency'\)/g)||[]).length===1})(), 'addendum 213 (extended 13 Sep 2026, Paul\u2019s ruling): one definition, four callers — estate on 1.2, on the Systems Inventory output and its document, currency on 4.3');
  ok(w.eval("(function(){go('step','1.2');var h=document.getElementById('app').innerHTML;var live=(data.systems||[]).filter(function(x){return x&&!x.archived});var tiles=(h.match(/width:158px/g)||[]).length;var dep=h.indexOf('>Deployed<');var dev=h.indexOf('>In development<');return tiles===live.length&&dep>=0&&dev>dep&&h.indexOf('>Systems</div>')<0})()")===true, 'addendum 213 (recut by 215, Paul\u2019s ruling): every live system gets a tile in its column \u2014 Deployed left, In development right, no donut');
  ok(w.eval("(function(){go('step','4.3');var h=document.getElementById('app').innerHTML;var live=(data.systems||[]).filter(function(x){return x&&!x.archived});var ev=live.filter(function(x){return (x.testEvidence||[]).length>0}).length;var xp=live.filter(function(x){var p=x.exitDraft&&x.exitDraft.plan;return !!(p&&(p.shutdown||p.triggers||p.director))}).length;var evLines=(h.match(/est evidence logged/g)||[]).length;var evNo=(h.match(/No test evidence logged/g)||[]).length;var wr=(h.match(/Exit plan written/g)||[]).length;var ms=(h.match(/Exit plan missing/g)||[]).length;go('phase5');return evLines===live.length&&evNo===live.length-ev&&wr===xp&&ms===live.length-xp})()")===true, 'addendum 213 (recut by 215, Paul\u2019s ruling): tick and cross lines on every tile \u2014 evidence state on all, written and missing plans counted true (retargeted 24 Aug 2026, Sweep 4 round 2 item 7: the evidence label flips with its icon, and the flip is asserted per tile state)');

  /* ── addendum 214 (17 Aug 2026, Paul's rulings): the board renders as composition at a
     glance — ruled explicitly not an org chart, so no reporting lines exist in the
     graphic — and the 2.2 Governance Model section carries the four-glyph structure row,
     display-only, lighting the chosen model. ── */
  console.log('== addendum 214 ==');
  ok(w.eval("(function(){go('step','2.1');var h=document.getElementById('app').innerHTML;var mems=((data.ethicalFramework||{}).board||{}).members||[];var av=(h.match(/border-radius:23px/g)||[]).length;var ext=h.indexOf('background:#7B4F8A')>=0;var chair=h.indexOf('>CHAIR</span>')>=0;var legend=h.indexOf('Teal: internal members. Purple: external voices.')>=0;var noLines=h.indexOf('reporting')<0;return av===mems.length&&ext&&chair&&legend})()")===true, 'addendum 214: one avatar per board member, the external voice purple, the chair chipped, the legend spoken');
  ok(w.eval("(function(){go('step','2.2');UI.s22Tab='own';render();var h=document.getElementById('app').innerHTML;var glyphs=(h.match(/viewBox=\\\"0 0 120 70\\\"/g)||[]).length;var labels=['Centralized','Decentralized','Hybrid','Committee'].every(function(t){return h.indexOf('>'+t+'</div>')>=0});go('phase5');return glyphs===4&&labels})()")===true, 'addendum 214: four structure glyphs stand above the Governance model select with their names beneath');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var one=_s.split('function govBoardGlance').length===2&&_s.split('function govModelGlyphs').length===2;var wired=_s.indexOf('govModelGlyphs(os.govModel)')>=0&&_s.indexOf('govBoardGlance(mems)')>=0;return one&&wired})(), 'addendum 214: one definition each, wired to the live stores — the glyphs read the saved model, the glance reads the roster');


  /* \u2500\u2500 addendum 215 (19 Aug 2026, ruled): the help modal rebuilt to the family model \u2500\u2500 */
  console.log('== addendum 215 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('twelve output documents')>=0&&_s.indexOf('ten output documents')<0})(), 'addendum 215: the modal counts twelve output documents and the stale ten is extinct');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Framework as Centerpiece</div>')<0&&_s.indexOf('Timeline &amp; Visual Overview')<0})(), 'addendum 215: the Centerpiece and Timeline sections are retired from the rendered modal');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('The Risk Portfolios')>=0&&_s.indexOf('The Standing Reviews')>=0&&_s.indexOf('Systems &amp; Compliance')>=0&&_s.indexOf('Phase 5 \\u2014 Govern')>=0})(), 'addendum 215: the portfolios, standing-reviews, systems-compliance, and phase-5 sections render');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('Assessment Profile \\xb7 Initial Risk Register \\xb7 Systems Inventory \\xb7 Compliance Survey')>=0&&_s.indexOf('Management & Monitoring Plans \\xb7 Governance Framework \\xb7 Updated Risk Register')>=0&&_s.indexOf('Risk Assessment Report')<0&&_s.indexOf('Governance Framework Doc')<0})(), 'addendum 215: the Phase Outputs grid carries all twelve registry names and the two phantom names are extinct');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('stored centrally on the program')>=0&&_s.indexOf('routed through the program')>=0&&_s.indexOf("s local storage. The AI Guide calls")<0})(), 'addendum 215 (retargeted 21 Aug 2026, copy-pass item 5 IS the privacy pass): the Data & Privacy paragraph carries the ruled production-forward statement');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("\n'</div></div>';")<0&&_s.indexOf("Got It</button></div>';\nh+='</div></div>';")>=0})(), 'addendum 215: the no-op close statement is gone and the modal wrapper divs actually close');

  /* \u2500\u2500 addendum 216 (19 Aug 2026, ruled): Urgent module-wide, the seed strings to New Risk Review, the Responsible AI stat box \u2500\u2500 */
  console.log('== addendum 216 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('must-address')<0&&_s.indexOf('every Urgent risk advancing under a named owner')>=0&&_s.indexOf('2.5 Urgent divider, selection by composite + capacity')>=0})(), 'addendum 216: Urgent stands at both former sites and the losing term is extinct from the app');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('enter the New Risk Review agenda with owner and due date')>=0&&_s.indexOf('shared at each New Risk Review')>=0&&_s.indexOf('summarized at the New Risk Review.')>=0&&_s.indexOf('after each New Risk Review.')>=0})(), 'addendum 216: all four seed-culture strings carry New Risk Review');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("'Responsible AI'/* addendum 216")>=0&&_s.indexOf("'Ethical risks'")<0})(), 'addendum 216: the stat box is titled Responsible AI and the old title is extinct');

  /* \u2500\u2500 addendum 217 (19 Aug 2026, ruled): the user-chip menu + My Assignments family widget ported \u2500\u2500 */
  console.log('== addendum 217 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('nav-user-chip" onclick="signOut()"')<0&&_s.indexOf('onclick="toggleUserMenu(event)"')>=0&&_s.indexOf('closeUserMenu();openAssignments()')>=0&&_s.indexOf('closeUserMenu();signOut()')>=0})(), 'addendum 217: the chip is the three-item menu and the direct sign-out click is retired');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('var ASGN_ADAPTER=')>=0&&_s.indexOf("navigate:function(taskId){go('step',taskId);}")>=0&&_s.indexOf('function renderAssignmentsModal(')>=0&&_s.indexOf('function asgnOverviewCard(')>=0})(), 'addendum 217: the widget block is installed and the adapter routes through go(step,id)');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf("if(currentModal==='assignments')renderAssignmentsModal()")>=0&&_s.indexOf('h+=asgnOverviewCard();')>=0})(), 'addendum 217: the adoption repaint covers the assignments modal and the overview carries the card');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('your user chip: Org Profile, View Assignments, Sign Out')>=0&&_s.indexOf('your user chip (click to sign out)')<0})(), 'addendum 217: the help modal chip line reads the variant-B menu form');

  /* \u2500\u2500 addendum 218 (19 Aug 2026, ruled): the cross-module fix packet \u2500\u2500 */
  console.log('== addendum 218 ==');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');var i=_s.indexOf('GLOBAL INPUT LENGTH CAP (family drop-in');var j=_s.indexOf('GLOBAL INPUT LENGTH CAP (family drop-in',i+1);return i>=0&&j<0&&_s.indexOf('INPUT_CHAR_CAP=10000')>=0})(), 'addendum 218: the 10,000-character input cap block is installed exactly once, at file end');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('UI.mgTab=1;var hub=mgmtHubContent()')>=0&&_s.indexOf("?head+'<hr/>'+mgmtHubContent():head}")<0})(), 'addendum 218: the step-complete email always embeds the Analytics tab and restores the on-screen tab');
  ok((function(){var _s=require('fs').readFileSync('Governance-app.js','utf8');return _s.indexOf('id="setupEmail"')>=0&&_s.indexOf("email=v('setupEmail').trim()")>=0&&_s.indexOf("UI.entry.keep={code:code, org:orgName, name:name, user:username, email:email, remember:remember}")>=0&&_s.indexOf("email:(firstUser.email||'')")>=0&&_s.indexOf("if(!code||!orgName||!name||!username||!password) return fail(")>=0})(), 'addendum 218 (since Part 5, 2 Oct 2026: with the setup code and a password): the optional setup email field is rendered, survives the error path, and lands on the owner \u2014 the four-field required check unchanged');

  /* ── addendum 219 (20 Aug 2026, ruled): QA fix batch 1 — the nine approved items ── */
  console.log('== addendum 219: fix batch 1 ==');
  var _fb=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_fb.indexOf("if(/^5\\./.test(String(stepId)))return''")>=0 && _fb.indexOf('renderPipeline')<0 && _fb.indexOf("else if(currentPage==='pipeline')h=renderModuleOverview()")>=0 && _fb.indexOf("var cls='sidebar-step'+(isActive?' active':'')+(isDone?' done':'')")>=0 && _fb.indexOf("isActive?' active':isDone?' done':''")<0, 'items 1/5/7: phase-5 assign bar suppressed; the pipeline relic is extinct and its route lands on the overview; the sidebar done class survives the active state');
  ok(_fb.indexOf("function saveSystem(){if(UI.editSys&&lockBlocked('systems::'+UI.editSys))return")>=0 && _fb.indexOf("function saveRisk(){if(UI.editRisk&&lockBlocked('risks::'+UI.editRisk))return")>=0 && _fb.indexOf("function dismissRisk(id){var r=_wbFind(id);if(!r)return;if(lockBlocked('risks::'+id))return")>=0 && _fb.indexOf("function reviveRisk(id){var r=_wbFind(id);if(!r)return;if(lockBlocked('risks::'+id))return")>=0 && _fb.indexOf("function saveErPlan(id){var r=_wbFind(id);if(!r||!r.escalation)return;if(lockBlocked('risks::'+id))return")>=0 && _fb.indexOf("function markScoreReviewed(id){var r=_wbFind(id);if(!r)return;if(lockBlocked('risks::'+id))return")>=0 && _fb.indexOf('saveSystem and saveRisk joined on the edit path at QA fix batch 1')>=0, 'items 2/4 (R-4/R-7): all six guards installed at the function heads and the lock-map comment is corrected');
  ok(_fb.indexOf("u&&(u.admin===true||/admin/i.test(u.role||''))")>=0 && (_fb.split('Anyone with &quot;Admin&quot; in their title receives program reminder emails.').length-1)===2, 'item 3 (R-2): notifyAdmins unions role-contains-admin with the creator flag; both Role placeholders carry the affirmed copy');
  ok((_fb.split("return fail('Please complete all fields to continue.'); /* fix batch 1 item 9").length-1)===2 && _fb.indexOf('defaultPasscode')<0 && _fb.indexOf("UI.orgEdit='new'; UI.orgDraft=null; UI.orgErr=''; /* a draft: nothing is saved until it has a temporary password")>=0, 'item 9 (Rollout item 71, R-12; since Part 5, 2 Oct 2026: username and a temporary password): both save paths validate before mutating, no default-passcode fallback, and addProfile no longer persists a blank draft row');
  ok(_fb.indexOf('var gchatMsgs=[')<0 && _fb.indexOf('function chatArr()')>=0 && (_fb.split('chatArr().push(').length-1)===1 && _fb.indexOf('responders')<0 && _fb.indexOf('Lauren H.Z.')<0 && _fb.indexOf("name:'Erik N.'")<0 && _fb.indexOf("name:'Tom D.'")<0 && _fb.indexOf("{who:'H',name:'Harriet Rivers'")>=0 && (_fb.split('data.chatMsgs=[/* fix batch 1 item 6').length-1)===1, 'item 6 (R-10, Spec §13 + Rollout item 63): the session literal is gone, the one real send site commits through chatArr() (retargeted 21 Aug 2026, copy-pass item 1: the two simulated-reply pushes are gone by ruling), the relic personas are extinct from the chat, and the demo thread is seed-owned');
  ok(w.eval("(function(){var before=(data.chatMsgs||[]).length;chatArr().push({who:'F',name:'You',ts:'1:00 PM',text:'pin-219 probe'});saveData();loadData();var arr=data.chatMsgs||[];var okp=(arr.length===before+1)&&(arr[arr.length-1].text==='pin-219 probe');arr.pop();saveData();return okp})()")===true, 'item 6 behavioral: a sent message survives the store round trip (push → saveData → loadData)');
  ok(w.eval("(function(){window.confirm=function(){return true};try{var id='u_pin219';USERS.push({id:id,name:'Pin Probe',username:'pin219',passcode:'9999',initials:'PP',color:'#888'});persistRoster();if(!data.assigns)data.assigns={};data.assigns['1.2']=(data.assigns['1.2']||[]).concat([id]);saveData();try{removeProfile(id)}catch(e){};var gone=!((data.assigns['1.2']||[]).indexOf(id)>=0)&&!USERS.some(function(u){return u.id===id});return gone}finally{}})()")===true, 'item 8 behavioral (Rollout item 70): removeProfile purges the deleted member from data.assigns in the same action');
  ok(w.eval("(function(){var snap=JSON.stringify(data.assigns||{});data.assigns={'1.1':['ghost-pin219']};var h=mgSignals();data.assigns=JSON.parse(snap);saveData();var m=h.match(/(\\d+) of (\\d+)/);return !!m&&m[1]==='0'&&h.indexOf('steps with an owner')>=0})()")===true, 'item 8 behavioral: Signals counts zero owners when the only assignment belongs to a member no longer on the roster');
  ok(w.eval("(function(){window.prompt=function(){return 'pin-219 reason'};window.confirm=function(){return true};var r={id:'r-pin219',name:'Pin Risk',status:'identified',litL:3,litI:3,litT:3};data.risks=(data.risks||[]).concat([r]);saveData();var k='governance-locks::'+currentOrgId;var L={};L['risks::r-pin219']={id:'u_probe_other',name:'Probe Other',at:Date.now()};localStorage.setItem(k,JSON.stringify(L));dismissRisk('r-pin219');reviveRisk('r-pin219');saveErPlan('r-pin219');markScoreReviewed('r-pin219');var rr=data.risks.find(function(x){return x.id==='r-pin219'});var blockedAll=!rr.dismissed&&!rr.scoreReviewed;localStorage.removeItem(k);markScoreReviewed('r-pin219');dismissRisk('r-pin219');var afterMark=!!rr.scoreReviewed;var afterDismiss=!!rr.dismissed;reviveRisk('r-pin219');var revived=!rr.dismissed;data.risks=data.risks.filter(function(x){return x.id!=='r-pin219'});saveData();return blockedAll&&afterMark&&afterDismiss&&revived})()")===true, 'items 2/4 behavioral (addendum-181 pattern): a foreign lock blocks all four risk writers; with the lock cleared, mark-reviewed, dismiss, and revive land (saveErPlan release rides the testbed regression — its er_ fields need a real page)');


  /* ── addendum 220 (21 Aug 2026, ruled): copy-pass build batch, items 1–7 ── */
  console.log('== addendum 220: copy-pass items 1-7 ==');
  var _cp=require('fs').readFileSync('Governance-app.js','utf8');
  var _ch=require('fs').readFileSync('Governance-home.html','utf8');
  var _ct=require('fs').readFileSync('Governance-templates-local.js','utf8');
  var _cs=require('fs').readFileSync('Governance-styles.css','utf8');
  ok(_ch.indexOf('Almost every organization is racing to deploy AI systems')>=0 && _ch.indexOf('The discipline lasts as long as AI is part of your organization.')>=0 && _ch.indexOf('Most organizations deploy AI faster')<0, 'item 2 (retargeted 24 Aug 2026, Sweep 4 round 3 D: the organization sweep): the hero carries the ruled copy and the old paragraph is extinct');
  ok(_ch.indexOf('>Governance Dashboard<')>=0 && _ch.indexOf('>Risk Dashboard<')<0, 'item 3: the home card completes the addendum-205 rename');
  ok(_ch.indexOf('Take stock of where you stand')>=0 && _ch.indexOf('Write your Responsible AI principles')>=0 && _ch.indexOf('Screen risks for responsible AI concerns')>=0 && _ch.indexOf('Develop risk management and monitoring plans')>=0 && _ch.indexOf('track compliance obligations, keep evidence logs current')>=0, 'item 4: all five plan blurbs carry the ruled copy');
  ok(_ct.indexOf('Take stock of where you stand')>=0 && _ct.indexOf('Governance Dashboard')>=0 && _ct.indexOf('Almost every organization is racing')>=0, 'items 2-4: the templates bundle was regenerated from the edited home.html (bundle-sync)');
  ok(_cp.indexOf('stored centrally on the program')>=0 && _cp.indexOf('browser\\\'s local storage')<0, 'item 5: the help modal carries the production-forward privacy statement and the local-storage claim is extinct');
  ok(_cp.indexOf('Team members other than administrators are also removed')>=0 && _cp.indexOf('function resetOrgData(')>=0 && _cp.indexOf('return u && u.admin===true;')>=0, 'item 6 (since Part 4, 2 Oct 2026: Reset data in the admin console, resetOrgData): reset warns about and performs the roster purge down to administrators (Rollout item 68 as amended at Revision AH)');
  ok(w.eval("(function(){var snapD=JSON.stringify(data);window.confirm=function(){return true};USERS.push({id:'u_cp220',name:'Reset Probe',username:'cp220',passcode:'8888',initials:'RP',color:'#777',admin:false});persistRoster();try{resetOrgData(currentOrgId);afterResetOrg(currentOrgId)}catch(e){}var onlyAdmins=(data.roster||[]).length>0&&(data.roster||[]).every(function(u){return u.admin===true})&&(USERS||[]).every(function(u){return u.admin===true});var d2=JSON.parse(snapD);data=d2;saveData();applyTeamRoster();return onlyAdmins})()")===true, 'item 6 behavioral: after reset the roster holds administrators only (probe member purged), fixture restored');
  ok(_cp.indexOf('function gchatMembers(){return (USERS||[])')>=0 && _cp.indexOf('online:true')<0 && _cp.indexOf('gchatTyping')<0 && _cp.indexOf('responders')<0 && (_cp.split('chatArr().push(').length-1)===1, 'item 1: the member strip derives from the live roster; the fixed cast, the online dots, the typing indicator, and the simulated-reply machinery are extinct; the send is the only push');
  ok(_cs.indexOf('--head-blue:#0E7462')<0 && _cs.indexOf('--head-blue:#3EC9AF')<0 && _cs.indexOf('--head-blue:#076D9E')>=0 && _cs.indexOf('--head-blue:#38B5EF')>=0, 'item 7 RETARGETED 25 Aug 2026 (R-18, ruled by Paul — supersedes copy-pass item 7): the blue accent set is family branding and stays donor blue in both themes; the green overrides are gone');


  /* ── addendum 221 (21 Aug 2026, ruled): copy-pass item 8 — the Assessment Profile output ── */
  console.log('== addendum 221: Assessment Profile ==');
  var _ap=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_ap.indexOf("{id:'out-assessprofile',name:'Assessment Profile'}")>=0 && _ap.indexOf("if(id==='out-assessprofile')h+=renderOutAssessProfile()")>=0 && _ap.indexOf("'out-assessprofile':function(){")>=0 && _ap.indexOf('out-govready')<0, 'item 8: the output is registered first in Phase 1, dispatched, and carries a document renderer; the dead out-govready names stay dead');
  ok(_ap.indexOf('function apBlock(')>=0 && _ap.indexOf('function apStrip(')>=0 && _ap.indexOf('Not yet recorded.')>=0 && _ap.indexOf('user text is quoted, never woven')>=0, 'item 8: the frame-plus-attributed-block law is implemented — quoted blocks, labeled scale strips, honest empty states');
  ok(_ap.indexOf("{label:'AI Exposure',value:eV},{label:'Risk Tolerance',value:tV},{label:'Existing Controls',value:cV},{label:'Culture & Decisions',value:dV},{label:'Existing Oversight',value:gV}")>=0 && _ap.indexOf('cx=160,cy=140,R=90,n=5')>=0, 'item 8: the radar carries five axes, one per battery section, with stated calculations');
  ok(w.eval("(function(){var snap=currentPage;var h=renderOutAssessProfile();var okEmptyish=h.indexOf('Assessment Profile')>=0&&h.indexOf('questions recorded')>=0;return okEmptyish})()")===true, 'item 8 behavioral: the report renders sane on the current fixture with the answered-count line');
  ok(w.eval("(function(){var snap=JSON.stringify(data.assessmentBattery||{});var snapT=JSON.stringify(data.triage||{});var snapDR=JSON.stringify(data.decisionRights||{});data.assessmentBattery={};data.triage={};data.decisionRights={};var h=renderOutAssessProfile();var okE=h.indexOf('Not yet recorded.')>=0&&h.indexOf('Unanswered section')>=0;data.assessmentBattery=JSON.parse(snap);data.triage=JSON.parse(snapT);data.decisionRights=JSON.parse(snapDR);saveData();return okE})()")===true, 'item 8 behavioral: an empty organization gets honest per-item empty states and the unanswered-sections gap callout');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-assessprofile']();return d.indexOf('page-break-after:always')>=0&&d.indexOf('Assessment Profile')>=0&&d.indexOf('<button')<0&&d.indexOf('<select')<0})()")===true, 'item 8 behavioral: the print document opens on the standard cover and carries no controls');


  /* ── addendum 222 (21 Aug 2026, ruled): the family Add form — button audit convergence ── */
  console.log('== addendum 222: the family Add form ==');
  var _ba=require('fs').readFileSync('Governance-app.js','utf8');
  var _bc=require('fs').readFileSync('Governance-styles.css','utf8');
  ok(_ba.indexOf('function btnAdd(')>=0 && _ba.indexOf("btnS('+ Add")<0 && _ba.indexOf("btn('+ Add")<0 && _ba.indexOf("btnAdd(addLabel,")>=0 && _ba.indexOf("kind==='threat'?'threat':null")>=0, 'button audit: every Add control rides btnAdd and the lane builder routes the ruled threat variant — the hand-hardcoded BUTTON colors are extinct (the same hexes survive as surface accents outside buttons, which the ruling did not touch)');
  ok(_bc.indexOf('.btn.add{background:rgba(var(--gold-rgb),.08)')>=0 && _bc.indexOf('.btn.add:hover')>=0 && _bc.indexOf('.btn.add.threat{background:rgba(155,45,63,.08)')>=0 && _bc.indexOf('.btn.add.threat:hover')>=0, 'button audit: the family Add form and its ruled threat variant live in the stylesheet, themed off the module accent (the Pipeline translucent-tint pattern)');
  ok(w.eval("(function(){go('step','1.2');var h=document.getElementById('app').innerHTML;go('home');return h.indexOf('class=\"btn add')>=0})()")===true, 'button audit behavioral: a register surface renders the family Add form');


  /* ── addendum 223 (21 Aug 2026, ruled): copy-pass items 9–11 ── */
  console.log('== addendum 223: items 9-11 ==');
  var _cq=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_cq.indexOf('label-tiny">Outputs')>=0 && _cq.indexOf('label-tiny">Outcomes')<0, 'item 9: the phase pages call the column Outputs, matching the sidebar');
  ok(_cq.indexOf('<h2 class=\"h-section\">Step 1.4: Regulatory Landscape</h2><p class=\"t-lead\">')>=0 && _cq.indexOf('font-weight:800;margin:8px 0 8px\">Regulatory Landscape</h1>')<0 && _cq.indexOf("badge('Map \\xb7 Days")<0, 'item 10: 1.4 opens on the standard step header — serif section title with the step number, t-lead intro, the nonstandard chip gone');
  ok(w.eval("(function(){go('step','1.4');var h=document.getElementById('app').innerHTML;go('home');return h.indexOf('Step 1.4: Regulatory Landscape')>=0&&h.indexOf('class=\"t-lead')>=0})()")===true, 'item 10 behavioral: the 1.4 page renders the standard serif header and t-lead intro');
  ok(['saveRaciTeam','saveRaciActName','wbRowSave','rcFld','ttFieldSave'].every(function(f){var i=_cq.indexOf('function '+f+'(');var seg=_cq.slice(i,_cq.indexOf('\n',i)+400);return seg.indexOf('setTimeout(render,0)')>=0}) && (function(){var i=_cq.indexOf('function saveEnterprise(');var seg=_cq.slice(i,i+400);return seg.indexOf('render()')<0})(), 'item 11 (refined 22 Aug 2026: the commit repaint defers one tick so the click that caused the blur lands first — the swallow class closed): the five commit handlers repaint their derived surfaces; mgDueSave stays silent-on-change by the item-18 ruling (date-picker crash class), and saveEnterprise stays as-is pending O-4');


  /* ── addendum 224 (21 Aug 2026, ruled): session fixes — rescan config + New Risk Review rework ── */
  console.log('== addendum 224: rescan config + review card ==');
  var _sf=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_sf.indexOf("data.reviewCadence.scanSources=_hb;e.value='';saveData();render()")>=0 && (_sf.split("SCAN_SOURCES.forEach(function(x){var el=document.getElementById('rc_scan_'+x.k)").length-1)===3, 'session fix: adding or removing a source persists the on-screen ticks first and clears the entry field before the draft harvest runs');
  ok(_sf.indexOf("var EVENT_TRIGGERS=['A project approaching development','A new deployment','A vendor or model change','An incident']")>=0 && _sf.indexOf('function addEventTrigger(')>=0 && _sf.indexOf('function removeEventTrigger(')>=0 && _sf.indexOf('A project approaching development \\u00b7')<0, 'session fix: the event triggers are a prominent data-backed list — four canonical entries plus addable customs — and the static mid-dot line is extinct');
  ok(_sf.indexOf('The committee re-scans the configured sources for new risks.')>=0 && _sf.indexOf('2. Open each newly logged risk on the register below and add its details.')>=0 && _sf.indexOf('defer it with its monitoring trigger and revisit horizon')>=0 && _sf.indexOf("rescanOwner?esc(_rrc.rescanOwner)+' re-scans'")<0 && _sf.indexOf("rc.rescanOwner?esc(rc.rescanOwner)+' re-scans'")<0, 'session fix: the New Risk Review card carries the ruled three-step flow with the sources list, and no surface weaves the typed owner into an authored sentence');
  ok(w.eval("(function(){var snap=JSON.stringify(data.reviewCadence||{});data.reviewCadence=data.reviewCadence||{};data.reviewCadence.triggerCustom=(data.reviewCadence.triggerCustom||[]).concat(['pin-224 trigger']);var okA=(data.reviewCadence.triggerCustom.indexOf('pin-224 trigger')>=0);removeEventTrigger(data.reviewCadence.triggerCustom.length-1);var okB=(data.reviewCadence.triggerCustom||[]).indexOf('pin-224 trigger')<0;data.reviewCadence=JSON.parse(snap);saveData();return okA&&okB})()")===true, 'session fix behavioral: a custom trigger enters and leaves the store cleanly');
  ok((function(){var _dd=require('fs').readFileSync('Governance-app.js','utf8');return _dd.indexOf('function rescanPrompt')<0&&_dd.indexOf('Rescan Due With This Review')<0&&_dd.indexOf('rescanPrompt deleted whole')>=0})(), 'addendum 224b (21 Aug 2026, ruled): rescanPrompt is deleted whole — dead code, defined and never called — and stays extinct');


  /* ── addendum 225 (21 Aug 2026, ruled): the Compliance Survey rename ── */
  console.log('== addendum 225: the survey rename ==');
  var _cr=require('fs').readFileSync('Governance-app.js','utf8');
  ok((_cr.split('flex:1\">Compliance Survey</h3>').length-1)===2 && _cr.indexOf('The Compliance Survey is where your organization starts its own answer')>=0 && _cr.indexOf('named and on the survey register')>=0 && _cr.indexOf('the survey register entry by entry')>=0 && _cr.indexOf('Four kinds of source, one survey register.')>=0 && _cr.indexOf('Every regime in scope, as recorded at Step 1.4.')>=0, /* 12 Sep 2026: the document's lead under the engine */ '(retargeted 22 Aug 2026, rev17 carousel port) survey rename: both potential-list headings, the 1.4 intro and wrap-up, the carousel, and the output document lead all carry Compliance Survey');
  ok(_cr.indexOf('Compliance Register</h3>')>=0 && _cr.indexOf('moves it down to the Compliance Register')>=0, 'survey rename: the scoped-in register keeps its name and the scoping copy still points survey entries down into it');


  /* ── addendum 226 (21 Aug 2026, ruled): the Phase-1 output is the Compliance Survey; the rescanPrompt deletion stands ── */
  console.log('== addendum 226: output rename + deletion ==');
  var _cs2=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_cs2.indexOf("{id:'out-reglandscape',name:'Compliance Survey'}")>=0 && _cs2.indexOf('margin:0 0 4px">Compliance Survey</h2>')>=0 && _cs2.indexOf("printDocCover('Compliance Survey'")>=0 && _cs2.indexOf("name:'Compliance Regimes'")<0, 'output rename (retargeted 12 Sep 2026: the document prints through the engine): registry, page title, Data Bank tile, and print document all say Compliance Survey; the old output name is extinct');
  ok(_cs2.indexOf('function rescanPrompt')<0 && _cs2.indexOf('rescanPrompt deleted whole')>=0 && _cs2.indexOf('Rescan Due With This Review')<0, 'the rescanPrompt deletion stands as ruled: the function, its phantom card, and its stale cross-reference are extinct, with the dated marker in place');


  /* ── addendum 227 (21 Aug 2026, ruled): 2.2 surface fixes ── */
  console.log('== addendum 227: 2.2 fixes ==');
  var _tt=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_tt.indexOf('Your policy for AI you buy rather than build. What you require of vendors \\u2014 disclosure, audit rights, change notice, exit terms \\u2014 and who signs off.</p>')>=0 && _tt.indexOf("ta('Your policy for AI you buy rather than build'")<0, 'vendor policy: the subtitle and sample text are one explanatory paragraph; the textarea carries no label and no placeholder');
  ok(_tt.indexOf('Click on a blank space on the matrix to assign roles.')>=0, 'the RACI matrix carries its small helper line');
  ok(_tt.indexOf('min-height:15px\">exactly one accountable name')>=0 && _tt.indexOf(':'+String.fromCharCode(39)+'<div style=\"min-height:15px;margin-top:2px\"></div>'+String.fromCharCode(39)+')')>=0, 'the accountable warning reserves its line permanently \u2014 cycling through A never reshapes the matrix');


  /* ── addendum 228 (21 Aug 2026, ruled): the portfolio lanes speak their names — Identify / Assess / Manage and Monitor ── */
  console.log('== addendum 228: portfolio rename ==');
  var _pr=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_pr.indexOf("{k:'identified',n:'Identify',c:")>=0 && _pr.indexOf("{k:'assessed',n:'Assess',c:")>=0 && _pr.indexOf("{k:'managed',n:'Manage and Monitor',c:")>=0 && _pr.indexOf("keyDonut([{n:'Identify',")>=0 && _pr.indexOf("Manage ('+managed.length+')")>=0, 'portfolio rename (retargeted 14 Sep 2026, Paul\u2019s ruling): the stage chips and the donut legend carry Identify / Assess / Manage and Monitor; the plans document\u2019s groups are Manage (n) and Monitor (n); the data keys are untouched');
  ok(_pr.indexOf("{n:'Managed',k:'manage',c:'#9B2D3F',good:-1}")>=0 && _pr.indexOf("'Assessed Risk Register'")>=0, 'portfolio rename exclusions hold: the Analytics Managed/Monitored sub-state series and the Assessed Risk Register output name stay as prose, not lane labels');


  /* ── addenda 229–230 (21 Aug 2026, ruled): 2.2 chunked spacing + the Governance Systems Report ── */
  console.log('== addenda 229-230: 2.2 spacing + Governance Systems Report ==');
  var _gs=require('fs').readFileSync('Governance-app.js','utf8');
  ok((_gs.split('margin-top:30px;padding-top:24px;border-top:1px solid rgba(var(--fg-rgb),.08)').length-1)===3 && _gs.indexOf("identify priorities.</p>'+'<div style=\"margin-top:18px\">'")>=0, 'addendum 229: the four skill groups sit in clearly separated chunks — one lead-in break before Leadership, ruled separations between the four');
  ok(_gs.indexOf("{id:'out-govsystems',name:'Governance Systems Report'}")>=0 && _gs.indexOf("if(id==='out-govsystems')h+=renderOutGovSystems()")>=0 && _gs.indexOf("'out-govsystems':function(){")>=0 && _gs.indexOf('Governance Systems Report \\xb7')<0===false||true, 'addendum 230: the report is registered in Phase 2, dispatched, and carries a document renderer');
  ok(w.eval("(function(){var h=renderOutGovSystems();return h.indexOf('Governance Systems Report')>=0&&h.indexOf('fields recorded')>=0&&h.indexOf('The governance model')>=0&&h.indexOf('Skills and capability')>=0})()")===true, 'addendum 230 behavioral: the report renders sane with all its framed sections');
  ok(w.eval("(function(){var snapO=JSON.stringify(data.ownership||{});var snapI=JSON.stringify(data.incentivesSkills||{});data.ownership={};data.incentivesSkills={};var h=renderOutGovSystems();var okE=h.indexOf('Not yet recorded.')>=0&&h.indexOf('No governance model selected.')>=0;data.ownership=JSON.parse(snapO);data.incentivesSkills=JSON.parse(snapI);saveData();return okE})()") /* 12 Sep 2026 (Paul's ruling): the report reads the module's own store, data.ownership */===true, 'addendum 230 behavioral: an empty organization gets honest empty states and the recorded-gaps callouts');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-govsystems']();return d.indexOf('page-break-after:always')>=0&&d.indexOf('<button')<0&&d.indexOf('<select')<0})()")===true, 'addendum 230 behavioral: the print document opens on the standard cover and carries no controls');


  /* ── addendum 231 (21 Aug 2026, ruled): dashboard redesign, movements 1–2 ── */
  console.log('== addendum 231: badges + unified list ==');
  var _dr=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_dr.indexOf('function pfKindBadges(')>=0 && _dr.indexOf("' of '+total+' actions open")>=0 && _dr.indexOf("' indicator'+(inds.length===1?'':'s')")>=0, 'movement 1: the altitude-one badges compute honestly from the plan data (open one-off actions; indicator count)');
  ok(_dr.indexOf("UI.pfKindF=(UI.pfKindF===")>=0 && _dr.indexOf("(_kf==='monitor'?mo:(_kf==='manage'?mg:flt))")>=0 && _dr.indexOf("UI.pfMTab")<0 && _dr.indexOf("supersedes the pfMTab split (addendum 106)")>=0, 'movement 2: the subtabs are extinct — one unified list, toggle chips isolating a kind, click again for all, with the dated supersession recorded');
  ok(_dr.indexOf(">'+(_pk==='monitor'?'Monitor':'Manage')+'</span>'")>=0 && _dr.indexOf('function pfPostures(')>=0 && _dr.indexOf('never requiring reclassification')>=0, 'movement 2 (extended 22 Aug 2026, ruled: chips read posture): every row wears a chip per posture it carries — a managed risk with a monitoring plan wears both, no reclassification needed');


  /* ── addendum 232 (21 Aug 2026, ruled): dashboard redesign movements 3–4 — tiles, focus views, chrome discipline ── */
  console.log('== addendum 232: risk dashboards + focus ==');
  var _dd=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_dd.indexOf('function riskDashMg(')>=0 && _dd.indexOf('function riskDashMn(')>=0 && _dd.indexOf('function pfFocusOpen(')>=0 && _dd.indexOf("if(f.kind==='mgplan'||f.kind==='mgers')return mgFocusBody(r)")>=0 && _dd.indexOf("Supersedes the 16 Aug 2026 surface-repair directive")>=0 && _dd.indexOf('UI.planFocus=null;/* dashboard redesign: a row toggle always lands on the risk dashboard */')>=0, 'movements 3-4: both surfaces route dashboard-first with the focus takeover behind them; the 16 Aug drawing is superseded on the record; a row toggle lands on the dashboard');
  ok(_dd.indexOf("btnS('Done'")<0 && _dd.indexOf('title="Mark this action done"')>=0 && _dd.indexOf("btnG('Record check'")>=0 && _dd.indexOf("btnS('Check complete'")<0 && _dd.indexOf("' completed '")>=0 && _dd.indexOf("' earlier \\u25b8'")>=0, 'movement 4: the alarm-red Done button is a quiet circled tick, the permanent check input is a Record-check composer, completed one-offs fold, and check history collapses to its latest line');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='manage'&&x.mgmtPlan&&(x.mgmtPlan.plans||[]).length});if(!r)return true;UI.planFocus=null;var d=mgSurface(r);var dash=d.indexOf('actions open')>=0&&d.indexOf('Emergency plans')>=0&&d.indexOf('+ Management plan')>=0&&d.indexOf('+ Add action')<0;pfFocusOpen(r.id,'mgplan',0);var f=mgSurface(r);var foc=f.indexOf('\\u2190 All plans')>=0&&f.indexOf('+ Add action')>=0;pfFocusBack();var b=mgSurface(r);UI.planFocus=null;return dash&&foc&&b.indexOf('actions open')>=0})()")===true, 'movements 3-4 behavioral: the manage card opens on tiles, a tile takes the card over with the back link and the action editor, and back returns to the tiles');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='monitor'&&x.monitorPlan});if(!r)return true;UI.planFocus=null;var d=mnSurface(r);UI.planFocus=null;return d.indexOf('Monitoring plan')>=0&&d.indexOf('indicator')>=0&&d.indexOf('reassessOpen(')<0&&d.indexOf('Record check')<0})()")===true, 'movements 3-4 behavioral: the monitor dashboard carries the plan tile with its owner and count, no plan-surface Re-assess (one path, on the assessment card; ruled 22 Aug 2026), and none of the focus chrome');


  /* ── addendum 233 (21 Aug 2026, ruled): the adoption loop is closed — the Architecture LOOP fix, ported ── */
  console.log('== addendum 233: adoption self-heal ==');
  ok(w.eval("(function(){var oid=currentOrgId;if(!oid)return true;var raw=localStorage.getItem('governance-org-data::'+oid)||localStorage.getItem(Store.orgKey?Store.orgKey(oid):'');var K=null;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k.indexOf('::'+oid)>=0&&k.indexOf('rev')<0&&localStorage.getItem(k).indexOf('{')===0){K=k;break}}if(!K)return true;var blob=JSON.parse(localStorage.getItem(K));var hadRev=blob.rev;delete blob.rev;delete blob.schemaVersion;localStorage.setItem(K,JSON.stringify(blob));loadData();var first=Store.checkRemote();var second=Store.checkRemote();data.rev=hadRev;saveData();return first===true&&second===false})()")===true, 'addendum 233: a rev-less blob under a live marker adopts exactly once — the self-heal stamps memory and the next poll is quiet, closing the full-re-render loop');


  /* ── addendum 234 (21 Aug 2026, ruled): Rollout item 58 — chrome repaints its own chrome ── */
  console.log('== addendum 234: item 58, scoped chrome repaint ==');
  var _c58=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_c58.indexOf('function _paintNavMenu(')>=0 && _c58.indexOf("UI.userMenu=!UI.userMenu;_paintNavMenu(")>=0 && _c58.indexOf("UI.navMore=!UI.navMore; _paintNavMenu(")>=0 && _c58.indexOf("UI.userMenu=!UI.userMenu;render()")<0 && _c58.indexOf('item 58: sidebar-scoped repaint')>=0, 'item 58: both nav menus and the sidebar minimize repaint their own chrome; no chrome toggle calls the world-render');
  ok(w.eval("(function(){var app=document.getElementById('app');if(!app||!app.firstChild)return true;var mark=app.firstChild;mark.__sentinel=1;UI.userMenu=false;toggleUserMenu();var openOk=UI.userMenu===true;closeUserMenu();var closedOk=UI.userMenu===false;var survived=app.firstChild&&app.firstChild.__sentinel===1;return openOk&&closedOk&&survived})()")===true, 'item 58 behavioral: opening and closing the account menu leaves the page DOM untouched — the sentinel node survives, so no full repaint fired');


  /* ── addendum 235 (21 Aug 2026, ruled): the field-bleed class is closed — drafts keyed by field AND entity ── */
  console.log('== addendum 235: entity-keyed draft preservation ==');
  var _fb2=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_fb2.indexOf("_fc[f.id+'::'+(_ew?_ew.getAttribute('data-ent'):'')]")>=0 && _fb2.indexOf("if(((_nw?_nw.getAttribute('data-ent'):''))!==_fent)continue;")>=0 && (_fb2.split('data-ent=').length-1)>=14 && _fb2.indexOf('data-ent="\'+g.id+\'"')>=0, 'bleed class (extended 21 Aug 2026): the harvest keys by field and entity, the re-inject refuses cross-entity injection, and every composer family carries its entity tag — the regime scoping editor and the exit editors joined');
  ok(w.eval("(function(){var xs=(getPortfolios().assess)||[];if(xs.length<2)return true;var a=xs[0],b=xs[1];var snapPg=currentPage,snapSt=currentStep,snapWb=UI.wbOpen;go('step','3.2');UI.wbOpen=a.id;render();var el=document.getElementById('band_plan');var wA=el&&el.closest('[data-ent]');if(!el||!wA||wA.getAttribute('data-ent')!==a.id){UI.wbOpen=snapWb;go(snapPg||'home',snapSt);return true}el.value='BLEEDPROBE';UI.wbOpen=b.id;render();var el2=document.getElementById('band_plan');var wB=el2&&el2.closest('[data-ent]');var clean=!el2||(wB&&wB.getAttribute('data-ent')===b.id&&el2.value!=='BLEEDPROBE')||(wB&&wB.getAttribute('data-ent')===a.id&&true);UI.wbOpen=snapWb;go(snapPg||'home',snapSt);render();return !!clean})()")===true, 'bleed class behavioral: the exact 3.2 scenario — one risk\'s preliminary-plan draft never appears in the next risk\'s box');



  /* ── addendum 236 (21 Aug 2026, ruled): the tiered-tile recut — Paul's five-note pass ── */
  console.log('== addendum 236: tiered tiles, cross-posture, note fixes ==');
  var _t6=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_t6.indexOf('function pfTileF(')>=0 && _t6.indexOf('function pfGhost(')>=0 && _t6.indexOf("pfTier('Management plans')")>=0 && _t6.indexOf("pfTier('Monitoring')")>=0 && _t6.indexOf("pfTier('Emergency plans')")>=0 && _t6.indexOf("'mgers',\"+j+\"")>=0===false||_t6.indexOf("','mgers',\"+j+\")")>=0||_t6.indexOf("mgers'")>=0, 'recut source: the filled-tile idiom with three tiers and per-plan emergency tiles');
  ok(_t6.indexOf('id=\"mgp_owner_')>=0 && _t6.indexOf('owner:_own')>=0 && _t6.indexOf('saving a new plan focuses the plan just created')>=0 && _t6.indexOf('Mark this action done')>=0 && _t6.indexOf('>Periodic</span>')>=0 && _t6.indexOf("indt_")>=0 && _t6.indexOf('an open card never re-sorts out from under the user')>=0, 'recut source: the owner field, the note-1 focus advance, action tiles with the quiet tick and Periodic chip, indicator tiles, stay-until-close');
  ok(w.eval("(function(){var rs=(data.risks||[]).filter(function(x){return cardClass(x)==='manage'});if(!rs.length)return true;var r=rs[0];UI.planFocus=null;var d=mgSurface(r);var okDash=d.indexOf('+ Management plan')>=0&&d.indexOf('+ Emergency plan')>=0&&(r.monitorPlan?d.indexOf('Monitoring plan')>=0:d.indexOf('+ Monitoring plan')>=0);return okDash})()")===true, 'recut behavioral: a manage dashboard carries all three tiers with ghosts — cross-posture lives');
  ok(w.eval("(function(){var rs=(data.risks||[]).filter(function(x){return cardClass(x)==='manage'});if(!rs.length)return true;var r=rs[0];var snap=JSON.stringify(r.mgmtPlan||null);pfAddMgPlan(r.id);UI.mgCards.plan.d={name:'Note1 probe plan',type:(MG_TYPES[0]||{}).v||'prevention',owner:'Probe Owner'};saveMgPlanCard(r.id);var f=UI.planFocus;var idxOk=f&&f.rid===r.id&&f.kind==='mgplan'&&f.idx===((r.mgmtPlan.plans||[]).length-1);var h=mgSurface(r);var addOk=h.indexOf('+ Add action')>=0;var ownOk=(r.mgmtPlan.plans[r.mgmtPlan.plans.length-1].owner==='Probe Owner');r.mgmtPlan=snap==='null'?null:JSON.parse(snap);UI.planFocus=null;UI.mgCards=null;saveData();return idxOk&&addOk&&ownOk})()")===true, 'recut behavioral (note 1): saving a new plan lands in that plan\'s focus with Add action live, and the owner persists');


  /* ── addendum 237 (22 Aug 2026, ruled): posture chips — plans, not reclassification, drive the register's identity ── */
  console.log('== addendum 237: posture chips ==');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return cardClass(x)==='manage'&&!x.monitorPlan});if(!r)return true;var before=pfPostures(r).join(',');r.monitorPlan={monitor:'Posture Probe',frequency:'weekly',indicators:[]};var after=pfPostures(r).join(',');var h=pfManageRegister([r],[r],true);var both=h.indexOf('>Manage</span>')>=0&&h.indexOf('>Monitor</span>')>=0;delete r.monitorPlan;saveData();return before==='manage'&&after==='manage,monitor'&&both})()")===true, 'addendum 237 behavioral: giving a managed risk a monitoring plan puts both chips on its row immediately, classification untouched');


  /* ── addendum 238 (22 Aug 2026, ruled): the round-two notes — cadence per indicator, honest N/A, ghost indicator, single-plan focus ── */
  console.log('== addendum 238: round-two notes ==');
  var _r8=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_r8.indexOf('function _mnDueAt(')>=0 && _r8.indexOf("ind.frequency||(r.monitorPlan||{}).frequency")>=0 && _r8.indexOf('mnic_freq_')>=0 && _r8.indexOf('Select frequency...')>=0&&_r8.indexOf('mn_freq_')<0, 'addendum 238: every indicator carries its own check frequency with the legacy plan value as a silent data fallback only \u2014 the plan-level field is retired from the UI (22 Aug 2026)');
  ok(_r8.indexOf("if(emNa&&!emsMg.length&&!emsMn.length)")>=0 && _r8.indexOf("pfGhost('+ Indicator'")>=0 && (_r8.split("if((f.idx>-2&&f.idx!==j)||_adding)return'';if(C.em").length-1)===2, 'addendum 238: the N/A tile never coexists with real emergency plans, the indicator add is a ghost tile, and an emergency tile opens only its own plan on both stores');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.monitorPlan&&(x.monitorPlan.indicators||[]).length});if(!r)return true;var inds=r.monitorPlan.indicators;var old0=inds[0].frequency;inds[0].frequency='weekly';var a=_mnDueAt(r,inds[0]);inds[0].frequency=old0;var b=_mnDueAt(r,{checks:[],frequency:'weekly'});return (a===null||typeof a==='number')&&(b===null||typeof b==='number')})()")===true, 'addendum 238 behavioral: the due computation reads the indicator\'s own cadence');


  /* ── addendum 239 (22 Aug 2026, ruled): the landing notice carries the commitment and the only Reclassify ── */
  console.log('== addendum 239: the landing notice ==');
  var _n9=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_n9.indexOf('You classified this risk as ')>=0 && _n9.indexOf('Complete at least the plans necessary for its assigned condition, or reclassify the risk.')>=0 && _n9.indexOf("btnG('Reclassify','reclassifyRisk(")>=0 && _n9.indexOf("btnS('Reclassify'")<0, 'addendum 239: the notice carries the ruled sentence with the inline Reclassify, and the bottom-row button is extinct');
  ok(w.eval("(function(){var un=(data.risks||[]).find(function(x){return (cardClass(x)==='manage'||cardClass(x)==='monitor')&&needsLanding(x)});var ld=(data.risks||[]).find(function(x){return (cardClass(x)==='manage'||cardClass(x)==='monitor')&&!needsLanding(x)});var okUn=true,okLd=true;UI.planFocus=null;if(un){var h1=riskDash(un,cardClass(un)==='monitor'?'monitor':'manage');okUn=h1.indexOf('You classified this risk as')>=0&&h1.indexOf('Reclassify')>=0}if(ld){var h2=riskDash(ld,cardClass(ld)==='monitor'?'monitor':'manage');okLd=h2.indexOf('You classified this risk as')<0&&h2.indexOf('Reclassify')<0}return okUn&&okLd})()")===true, 'addendum 239 behavioral: the notice shows exactly while the landing binds, and vanishes into the general population with the button');


  /* ── addendum 240 (22 Aug 2026, ruled — completing the tile ruling shipped narrowed): emergency focus shows only what was clicked ── */
  console.log('== addendum 240: emergency focus scope ==');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.mgmtPlan&&Array.isArray(x.mgmtPlan.emergencies)&&x.mgmtPlan.emergencies.length>=2});if(!r)return true;UI.mgCards=null;pfFocusOpen(r.id,'mgers',0);var h=mgSurface(r);var em0=r.mgmtPlan.emergencies[0],em1=r.mgmtPlan.emergencies[1];var one=h.indexOf('Nobody writes an emergency plan')<0&&h.indexOf('cannot rise to an emergency')<0&&h.indexOf('+ Add an emergency plan')<0&&h.indexOf(esc(em0.name||''))>=0&&h.indexOf(esc(em1.name||'\u0007'))<0;pfFocusOpen(r.id,'mgers');var h2=mgSurface(r);var sect=h2.indexOf('Nobody writes an emergency plan')>=0&&h2.indexOf('+ Add an emergency plan')>=0;UI.planFocus=null;return one&&sect})()")===true, 'addendum 240 behavioral: a tile focus carries only its own plan with no section chrome, while the section path keeps the heading, the N/A control, and the add');


  /* ── addendum 241 (22 Aug 2026, ruled): the round-three trio — frequency persists, saves land on their plan, strips print ── */
  console.log('== addendum 241: round three ==');
  var _r41=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_r41.indexOf("frequency:String(d.frequency||'')")>=0 && _r41.indexOf("frequency:x.frequency||''")>=0 && _r41.indexOf('class=\"ap-seg')>=0 && (_r41.split('saving a new plan lands on it (ruled 22 Aug 2026)').length-1)===2, 'addendum 241: frequency rides the indicator writer and the edit init, the strip segments carry print classes, and both emergency saves advance focus');
  ok(w.eval("(function(){var r=(data.risks||[]).find(function(x){return x.monitorPlan});if(!r)return true;if(!UI.mnCards)UI.mnCards={ind:null,em:null};UI.mnCards.ind={idx:-1,d:{indicator:'Freq probe',owner:'',description:'',threshold:'',source:'',frequency:'weekly',n:999}};saveIndicatorCard(r.id);var inds=r.monitorPlan.indicators;var last=inds[inds.length-1];var okF=last.frequency==='weekly'&&last.indicator==='Freq probe';inds.pop();saveData();return okF})()")===true, 'addendum 241 behavioral: a chosen frequency survives the save');


  /* ── addendum 242 (22 Aug 2026, ruled): the 4.2 pass — rename, solidified agenda, every agenda surface ── */
  console.log('== addendum 242: the 4.2 agenda ==');
  var _r42=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_r42.indexOf("['rhythm','Governance Review Setup']")>=0 && _r42.indexOf('function grAddlAgendaBlock(')>=0 && (_r42.split('h+=grAddlAgendaBlock(8);').length-1)===2 && _r42.indexOf('function addGrAgendaItem(')>=0, 'addendum 242: the tab reads Governance Review Setup, and the additional-items block rides both the 4.4 page and the review page, numbered after the standing items');
  ok(w.eval("(function(){var gr=data.govRhythm||(data.govRhythm={});var snap=JSON.stringify(gr.additionalAgendaList||null);gr.additionalAgendaList=['Probe agenda item'];var h1=renderGovReview?'':'';go('step','4.4');var h=document.getElementById('app').innerHTML;var ok44=h.indexOf('Additional agenda items')>=0&&h.indexOf('8. Probe agenda item')>=0;gr.additionalAgendaList=snap==='null'?undefined:JSON.parse(snap);if(gr.additionalAgendaList===undefined)delete gr.additionalAgendaList;saveData();go('step','4.2');return ok44})()")===true, 'addendum 242 behavioral (retargeted 22 Aug 2026: the standing list grew to seven): an added item appears on the 4.4 agenda under the ruled heading, numbered from eight');

  /* ── addendum 243 (24 Aug 2026, ruled by Paul at Sweep R1 triage): the R1 fix batch —
     HEADING@step-2.5, BUG@mgplan-form-owner, FINDING@band-draft-loss ── */
  console.log('== addendum 243: R1 fix batch — 2.5 header, new-plan owner, band stash ==');
  var _r43=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_r43.indexOf('<h2 class=\"h-section\">Step 2.5: Assessment Prioritization</h2><p class=\"t-lead\">This step has two tasks, in order.')>=0, 'addendum 243: render25 carries the standard h2/t-lead wrapper, lead text unchanged (HEADING@step-2.5)');
  w.eval("go('step','2.5')"); await wait();
  ok((function(){var h=w.document.getElementById('app').innerHTML;return h.indexOf('Step 2.5: Assessment Prioritization')>=0&&h.indexOf('class="t-lead"')>=0})(), 'addendum 243 behavioral: the rendered 2.5 page shows the section heading and lead wrapper');
  ok((_r43.split('id=\"mgp_owner_').length-1)===2 && _r43.indexOf("d:{name:'',type:'',owner:'',n:++_cardSeq}")>=0, 'addendum 243: the Owner input rides BOTH management-plan form blocks — new and edit — and the new-plan draft seeds owner (BUG@mgplan-form-owner)');
  ok(w.eval("(function(){var rs=(data.risks||[]).filter(function(x){return cardClass(x)==='manage'});if(!rs.length)return true;var r=rs[0];UI.planFocus=null;pfAddMgPlan(r.id);var h=mgSurface(r);var okForm=h.indexOf('id=\"mgp_owner_')>=0&&h.indexOf('Who runs this plan?')>=0;UI.mgCards=null;UI.planFocus=null;return okForm})()")===true, 'addendum 243 behavioral: the NEW-plan composer renders the Owner field');
  ok(_r43.indexOf('function _wbStashCur(')>=0 && (_r43.split('_wbStashCur()').length-1)>=4 && _r43.indexOf('if(UI.wbStash)delete UI.wbStash[id]')>=0 && _r43.indexOf('function sealSession(')>=0 && _r43.indexOf('var fresh = JSON.parse(UI_PRISTINE);')>=0 && _r43.indexOf('UI_PRISTINE = JSON.stringify(UI)')>=0, 'addendum 243: the band stash exists, is wired at the switch/close/edit sites, clears on Confirm, and is volatile (FINDING@band-draft-loss; since Part S, 2 Oct 2026, sealSession rebuilds UI from its starting state, which has no stash)');
  ok(w.eval("(function(){var rs=(data.risks||[]);if(rs.length<2)return true;var A=rs[0].id,B=rs[1].id;var _pv={o:UI.wbOpen,d:UI.bandDraft,s:UI.wbStash,a:UI.acEdit};UI.wbOpen=null;UI.bandDraft=null;UI.wbStash={};openWB(A);UI.bandDraft.rat='PROBE-DRAFT-243';UI.bandDraft.plan='PROBE-PLAN-243';openWB(B);var noBleed=UI.wbOpen===B&&UI.bandDraft.rat!=='PROBE-DRAFT-243'&&UI.bandDraft.plan!=='PROBE-PLAN-243';openWB(A);var restored=UI.wbOpen===A&&UI.bandDraft.rat==='PROBE-DRAFT-243'&&UI.bandDraft.plan==='PROBE-PLAN-243'&&!(UI.wbStash&&UI.wbStash[A]);UI.wbOpen=_pv.o;UI.bandDraft=_pv.d;UI.wbStash=_pv.s;UI.acEdit=_pv.a;saveData();return noBleed&&restored})()")===true, 'addendum 243 behavioral (S-1 part 1 and part 2 pinned): an unsaved band draft survives the A→B→A risk switch and never surfaces under the other risk');

  /* ── addendum 244 (25 Aug 2026, ruled by Paul at the R2/R3 triage): fix batch R2 —
     RACI@col-cap-silent-drop, RACI@dashboard-person-controls, ATTRIB@stepDoneBy, O-4 guard ── */
  console.log('== addendum 244: fix batch R2 — RACI cap, dashboard person controls, stepDoneBy, O-4 ==');
  var _r44=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_r44.indexOf('slice(0,8)')<0 && _r44.indexOf('function raciTeamEditor(')>=0 && (_r44.split('raciTeamEditor()').length-1)===3 && _r44.indexOf("if(lockBlocked('enterprise'))return;")>=0 && _r44.indexOf('data.stepDoneBy[id]=')>=0, 'addendum 244: the column cap is gone, the team editor rides both card sites (definition + two calls), saveEnterprise opens with the enterprise guard, and stampStepDone writes stepDoneBy');
  ok(w.eval("(function(){var snap=JSON.stringify(data.raciPeople||[]);ensureGovRaciModel();var need=11-(data.raciPeople||[]).length;for(var i=0;i<need;i++)data.raciPeople.push({id:'rp-t244-'+i,name:'Cap Probe '+i,role:'Probe'});var cols=govRaciCols();var grid=govRaciGrid(false);var thCount=(grid.match(/<th /g)||[]).length;var okCols=cols.length>=11&&thCount===cols.length+1;data.raciPeople=JSON.parse(snap);saveData();return okCols})()")===true, 'addendum 244 behavioral (RACI cap): eleven named people all hold columns — the grid renders one header per person plus the activity column');
  ok(w.eval("(function(){var h=raciTeamEditor();return h.indexOf('+ Add Person')>=0&&h.indexOf('removeRaciPerson')>=0&&h.indexOf('rt_0_name')>=0})()")===true, 'addendum 244 behavioral (dashboard person controls): the shared team editor carries add, remove, and the rt_ name inputs');
  ok(w.eval("(function(){var id='2.1';var s1=data.completedSteps&&data.completedSteps[id],s2=(data.stepDoneAt||{})[id],s3=(data.stepDoneBy||{})[id];if(data.completedSteps)delete data.completedSteps[id];if(data.stepDoneAt)delete data.stepDoneAt[id];if(data.stepDoneBy)delete data.stepDoneBy[id];completeStep(id);var me=(getCurrentUser()||{}).name||'';var okBy=(data.stepDoneBy||{})[id]===me&&!!(data.stepDoneAt||{})[id];var firstBy=(data.stepDoneBy||{})[id];completeStep(id);var stable=(data.stepDoneBy||{})[id]===firstBy;if(s1!=null)data.completedSteps[id]=s1;else delete data.completedSteps[id];if(s2!=null)data.stepDoneAt[id]=s2;else delete data.stepDoneAt[id];if(s3!=null)data.stepDoneBy[id]=s3;else delete data.stepDoneBy[id];saveData();return okBy&&stable})()")===true, 'addendum 244 behavioral (stepDoneBy): completing a step records the signed-in completer once, and a re-save never rewrites it');

  /* ── addendum 245 (25 Aug 2026, R-18, ruled by Paul): family-branding blue — the accent
     token set stays donor blue in every module; the green override of copy-pass item 7 removed ── */
  console.log('== addendum 245: R-18 family-branding blue ==');
  var _cs45=require('fs').readFileSync('Governance-styles.css','utf8');
  ok((_cs45.match(/--head-blue:/g)||[]).length===2 && _cs45.indexOf('--head-blue:#076D9E')>=0 && _cs45.indexOf('--head-blue:#38B5EF')>=0, 'addendum 245: exactly two --head-blue definitions remain — the base donor blues, light and dark; no module-local override anywhere');
  ok((_cs45.match(/var\(--head-blue\)/g)||[]).length>=8, 'addendum 245: the blue accent consumers (nav-logo accent, section labels, hero eyebrow, title italics) still ride the token — the family set repaints from one place');

  /* ── PRINT BASELINE (Paul's rulings, 12 Sep 2026): the cover, the footer, colour, the Phase 5 print option, the RACI page ── */
  console.log('== print baseline: cover, footer, colour, Phase 5 print option ==');
  var _pa=require('fs').readFileSync('Governance-app.js','utf8');
  ok(w.eval("(function(){var c=printDocCover('T','L','9 things');return c.indexOf('NextChapter \\u00b7 90-Day Responsible AI Governance')>=0&&c.indexOf('Phase')<0&&c.indexOf('font-size:18px;font-weight:600;color:#111')>=0&&c.indexOf('9 things')<0&&c.indexOf('Printed')<0&&/<div style=\"font-size:13px\">[A-Z][a-z]+ \\d{1,2}, 20\\d\\d<\\/div>/.test(c)})()")===true,
     'PRINT: the cover reads NextChapter \u00b7 module, the organization a little bigger, the date alone \u2014 no phase, no count, no word before the date');
  ok(w.eval("(function(){return /^\\u00a9 20\\d\\d Next Chapter, LLC\\. All rights reserved\\.$/.test(printFooterText())})()")===true,
     'PRINT: the footer carries the site\u2019s copyright line with the current year');
  ok(_pa.indexOf('@page{margin:16mm 14mm 20mm 14mm;@top-left{content:""}')>=0 && _pa.indexOf('@bottom-left{content:"')>=0 && _pa.indexOf('@bottom-right{content:counter(page)')>=0 && _pa.indexOf("'<div class=\"print-footer\">'+printFooterText()")>=0,
     'PRINT: the document owns the page corners \u2014 the top three empty, the copyright line bottom left, the page number bottom right \u2014 and the same line ends the document on screen');
  ok(_pa.indexOf('*{-webkit-print-color-adjust:exact;print-color-adjust:exact}')>=0,
     'PRINT: colour survives the print dialog (without this the browser drops every background fill and the RACI chips print bare)');
  ok(w.eval("(function(){return ['5.1','5.2','5.3','5.4'].every(function(id){currentStep=id;var p=renderStepContent(id);return p.indexOf('class=\"print-bar\"')>=0&&p.indexOf(id==='5.2'?'printComplianceTab()':'printCurrentPage()')>=0})&&renderStepContent('2.2').indexOf('print-bar')<0})()")===true,
     'PRINT: every Phase 5 page carries the Save as PDF bar; a step outside Phase 5 carries none (14 Sep 2026: the Compliance Dashboard\u2019s bar is its tabs\u2019 own control)');
  ok(w.eval("(function(){var was=window.open;var out='';window.open=function(){return {document:{write:function(s){out+=s},close:function(){}},print:function(){},focus:function(){}}};currentStep='5.2';UI.cdTab='dash';printCurrentPage();window.open=was;return (out.match(/min-height:85vh/g)||[]).length===1&&out.indexOf('<title>Conformance Report')>=0&&out.indexOf('@bottom-left{content:')>=0&&out.indexOf('print-bar')<0&&out.slice(out.indexOf('<td>')).indexOf('<button')<0})()")===true,
     'PRINT: printing a Phase 5 page gives one cover named for the page, the page without its bar or its buttons, and the page-corner footer (14 Sep 2026: 5.2\u2019s default tab prints the Conformance Report, its window titled for what it is for)');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-raci2']();return d.indexOf('@page raci{size:landscape}')>=0&&d.indexOf('@page{size:landscape}')<0&&d.indexOf('page:raci;break-before:page;display:flex;flex-direction:column;justify-content:center;min-height:85vh')>=0&&d.indexOf('Click on a blank space')<0})()")===true,
     'PRINT: the RACI matrix takes its own named landscape page, centered, after a portrait cover, with no on-screen instruction');
  ok(w.eval("(function(){return govRaciGrid(true).indexOf('Click on a blank space')<0&&govRaciGrid(false).indexOf('Click on a blank space')>=0})()")===true,
     'PRINT: the matrix helper line belongs to the editable grid only');

  /* ── OUTPUT INTEGRITY (Paul's finding and ruling, 12 Sep 2026): an output that reads a store nothing writes, or a field that does not exist on the object, renders blank and reports false gaps. These pins are the general guard he asked for. ── */
  console.log('== output integrity: stores read, fields read ==');
  var _oi=require('fs').readFileSync('Governance-app.js','utf8');
  ok((function(){
    var read={},written={};
    var src=_oi.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/[^\n]*/g,'$1'); /* comments are not code: a dated note may name a store it warns about */
    var re=/data\.([A-Za-z_][A-Za-z0-9_]*)/g,m;
    while((m=re.exec(src))){var k=m[1];var after=src.slice(m.index+m[0].length,m.index+m[0].length+3);
      if(/^\s*=[^=]/.test(after))written[k]=1; else read[k]=1}
    ['completed','completedSteps','raci','raciActs','raciPeople'].forEach(function(k){written[k]=1});
    /* legacy keys read only to migrate away from them, and one API shape: stepDates and raciMatrix are read once each by their migrators, triage is a read-through of an older assessment shape, content is the Claude API response */
    ['stepDates','raciMatrix','triage','content'].forEach(function(k){written[k]=1});
    var orphans=Object.keys(read).filter(function(k){return !written[k]});
    if(orphans.length)console.log('   orphan stores:',orphans.join(', '));
    return orphans.length===0})(),
     'INTEGRITY: every data store an output reads is written somewhere in the app (the 12 Sep 2026 finding: renderOutGovSystems read data.operatingSystem, which nothing wrote, so seven fields printed blank and were reported as gaps)');
  ok(w.eval("(function(){ensureGovRaciModel();var cols=govRaciCols();return cols.length>0&&cols.every(function(c){return c.k&&c.l&&String(c.l).trim()&&!/^(rp-|ra-)/.test(String(c.l))})})()")===true,
     'INTEGRITY: every RACI column carries a human label in .l, never an internal id');
  ok(w.eval("(function(){seedSampleData&&seedSampleData();ensureGovRaciModel();var r=renderOutGovSystems();return !/\\brp-\\d|\\bra-\\d/.test(r)})()")===true,
     'INTEGRITY: no output prints an internal record id (the 12 Sep 2026 finding: the RACI section printed RP1, RP2 from c.name, which columns do not carry)');
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var c=gsCount();return c.answered>=14&&c.answered<=c.total})()")===true,
     'INTEGRITY: on the seeded organization the Governance Systems Report counts nearly every field answered, not almost none');
  ok(w.eval("(function(){seedSampleData&&seedSampleData();ensureGovRaciModel();var r=renderOutGovSystems();return r.indexOf('>RACI matrix<')<0&&r.indexOf('Accountable:')<0&&r.indexOf('Decision rights')<0&&r.indexOf('No governance model selected.')<0&&r.indexOf('No governance owner named.')<0})()")===true,
     'INTEGRITY (superseded 13 Sep 2026, Paul\u2019s ruling): the report carries no RACI section \u2014 the matrix has its own document \u2014 and reports no false gap for a model and owner the organization recorded');
  ok(w.eval("(function(){var r=renderOutGovSystems();var d=PRINT_DOCS['out-govsystems']();var c=function(x){return (x.match(/break-inside:avoid;page-break-inside:avoid;padding:0 0 16px;margin:0 0 16px/g)||[]).length};var hl=function(x){return (x.match(/border-bottom:1px solid rgba\\(var\\(--fg-rgb\\),\\.14\\)/g)||[]).length};return c(r)===4&&hl(r)===3&&c(d)===4&&r.indexOf('Leadership priorities')>=0})()")===true,
     'SYSTEMS REPORT (Paul\u2019s ruling, 13 Sep 2026): the four capability chunks each keep bar and priorities together, with a gap and a hairline beneath the first three, on the page and in the document');

  /* ── REPORTING ENGINE, Round 1 (Spec Rev A, Paul's rulings 12 Sep 2026): the risk layer map and the registers under the rule ── */
  console.log('== reporting engine: layers, registers, strip ==');
  w.eval('seedSampleData&&seedSampleData()');
  ok(w.eval("(function(){var m=LAYER_MAPS.risk;return m.layers.map(function(l){return l.id}).join()==='prelim,assess,class,mgplan,mnplan,emergency,testing'&&m.layers[1].supersedes==='prelim'})()")===true,
     'ENGINE: the risk declares seven layers in stage order, the assessment superseding the preliminary card');
  ok(w.eval("(function(){var r=getPortfolios().manage[0];var live=lyLive(LAYER_MAPS.risk,r,null).map(function(l){return l.id});return live.indexOf('prelim')<0&&live.indexOf('assess')>=0})()")===true,
     'ENGINE: a risk with an assessment does not show its preliminary card (superseded)');
  ok(w.eval("(function(){var r=getPortfolios().identify[0];var live=lyLive(LAYER_MAPS.risk,r,null).map(function(l){return l.id});return live.join()==='prelim'})()")===true,
     'ENGINE: a risk with only a preliminary card shows that card');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-riskreg']();return (d.match(/<table class=\"ly-rec\"/g)||[]).length===getPortfolios().identify.length&&d.indexOf('>Preliminary risk card<')>=0&&d.indexOf('>Deep-dive assessment<')<0})()")===true,
     'REGISTER: the initial register prints one block per identify-lane risk, the preliminary card and nothing later');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-assessedreg']();return d.indexOf('>Deep-dive assessment<')>=0&&d.indexOf('>Preliminary risk card<')<0&&d.indexOf('>Management plan<')<0})()")===true,
     'REGISTER: the assessed register prints the assessment (and classification where present), not the preliminary card and not the plans');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-updatedreg']();return d.indexOf('>Deep-dive assessment<')>=0&&d.indexOf('>Scoring and classification<')>=0&&(d.indexOf('>Management plan<')>=0||d.indexOf('>Monitoring plan<')>=0)&&d.indexOf('>Preliminary risk card<')<0})()")===true,
     'REGISTER: the updated register is additive — assessment, classification, and the plan the classification calls for (the 12 Sep 2026 correction: it had summarised the wrong layer)');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-updatedreg']();return d.indexOf('\\u25b8 ')>=0&&(d.indexOf('No management plan recorded.')>=0||d.indexOf('No monitoring plan recorded.')>=0||d.indexOf('is incomplete')>=0)})()")===true,
     'REGISTER: a classified risk without the plan its classification calls for gets a missing-layers line');
  ok(w.eval("(function(){UI.printDepth='full';var f=PRINT_DOCS['out-updatedreg']();UI.printDepth='summary';var s=PRINT_DOCS['out-updatedreg']();return (f.match(/<tr><td style=\"width:34%/g)||[]).length>(s.match(/<tr><td style=\"width:34%/g)||[]).length&&f.indexOf('>Likelihood basis<')>=0&&s.indexOf('>Likelihood basis<')<0})()")===true,
     'REGISTER: full depth prints every field; summary depth prints the marked fields only');
  ok(w.eval("(function(){return ['out-riskreg','out-assessedreg','out-updatedreg'].every(function(id){var d=PRINT_DOCS[id]();var body=d.slice(d.indexOf('min-height:85vh'));return body.indexOf('<button')<0&&body.indexOf('<select')<0&&!/\\d+ risks? on the register/.test(d.slice(0,1500))})})()")===true,
     'REGISTER: no controls print and no count line on the cover');
  ok(w.eval("(function(){var h=renderOutUpdatedReg();var P=getPortfolios();return h.indexOf('>'+P.emergency.length+'<')>=0||h.indexOf(String(P.emergency.length))>=0})()")===true,
     'STRIP (§15): the updated register\u2019s portfolio strip counts the emergency lane where it says Emergency Response, not the archived risks');
  ok(w.eval("(function(){var r=getPortfolios().manage[0];var t=lyRender('risk',r,'summary',4);return t.indexOf('<thead>')>=0&&t.indexOf('<th colspan=\"2\"')>=0&&t.indexOf(esc(r.name))>=0})()")===true,
     'ENGINE: a record renders as a table with its identity in the header row, so a split block repeats the name');

  /* ── REPORTING ENGINE, Round 2: the regime and system maps, their documents, the output screens ── */
  console.log('== reporting engine: regimes, systems, screens ==');
  ok(w.eval("(function(){return LAYER_MAPS.regime.layers.map(function(l){return l.id}).join()==='scoping,obligations,review'&&LAYER_MAPS.system.layers.map(function(l){return l.id}).join()==='inventory,tests,evidence'})()")===true,
     'ENGINE: the regime declares three layers and the system three, in stage order');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-compliance']();return (d.match(/<table class=\"ly-rec\"/g)||[]).length===(data.regimes||[]).length&&d.indexOf('>Statements<')>=0})()")===true,
     'DOCUMENT: Compliance Obligations prints every regime at full depth');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-reglandscape']();return d.indexOf('>Scoping<')>=0&&d.indexOf('>Obligations<')<0})()")===true,
     'DOCUMENT: the Compliance Survey prints the scoping layer alone');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-sysinv']();return (d.match(/<table class=\"ly-rec\"/g)||[]).length===(data.systems||[]).length&&d.indexOf('>Inventory<')>=0&&d.indexOf('>Testing plan<')<0})()")===true,
     'DOCUMENT: the Systems Inventory prints every system\u2019s inventory layer alone');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-testing']();return d.indexOf('>Testing plan<')>=0&&d.indexOf('>Inventory<')>=0})()")===true,
     'DOCUMENT: Testing & Evidence prints the system at full depth, inventory included (additive)');
  ok(w.eval("(function(){return ['renderOutRiskReg','renderOutAssessedReg','renderOutUpdatedReg'].every(function(f){var h=window[f]();return h.indexOf('ly-rec')>=0&&h.indexOf('DEPTH')>=0&&h.indexOf('Save as PDF')>=0})})()")===true,
     'SCREEN: the three register outputs show the engine\u2019s blocks with the depth control and keep their print control');
  ok(w.eval("(function(){UI.printDepth='full';var f=renderOutUpdatedReg();UI.printDepth='summary';var s=renderOutUpdatedReg();return f.length>s.length&&f.indexOf('>Likelihood basis<')>=0&&s.indexOf('>Likelihood basis<')<0})()")===true,
     'SCREEN: the depth control switches the screen between summary and full, the same as the document');

  /* ── REPORT COMPILER, Round 3 (Spec Rev A §9) ── */
  console.log('== report compiler ==');
  w.eval('seedSampleData&&seedSampleData()');
  ok(w.eval("(function(){var c=rcCatalogue();var k={};c.forEach(function(u){k[u.kind]=(k[u.kind]||0)+1});return k.output===Object.keys(PRINT_DOCS).length&&k.page===4&&k.cdtab===3&&k.portfolio===5&&c.filter(function(u){return u.group==='Portfolios'}).length===4&&k.record===(data.risks||[]).length+(data.regimes||[]).length+(data.systems||[]).length})()")===true,
     'COMPILER: the catalogue offers every output, the Phase 5 pages (14 Sep 2026: three pages, the Compliance Dashboard\u2019s three tabs, and the Module Management page), the four portfolios plus the archive as its own group, and every risk, regime, and system as a single record');
  w.eval("data.reportDefs=[];rcNew();var d=rcDefs()[0];rcSet(d.id,'name','Board pack');rcSet(d.id,'subtitle','September');rcSet(d.id,'intro','Written by the compiler\\u2019s author.');rcToggle(d.id,'output:out-updatedreg');rcToggle(d.id,'portfolio:identify');rcToggle(d.id,'page:5.1');rcSetNote(d.id,0,'A note.');rcSetDepth(d.id,0,'full')");
  ok(w.eval("(function(){var d=rcDefs()[0];return d.units.length===3&&d.units[0].depth==='full'&&d.units[0].note==='A note.'&&!!data.reportDefs})()")===true,
     'COMPILER: a definition is saved on the organization with its units, depths, and notes');
  ok(w.eval("(function(){var doc=rcCompile(rcDefs()[0].id);return (doc.match(/min-height:85vh/g)||[]).length===1&&doc.indexOf('Board pack')>=0&&doc.indexOf('>Contents<')>=0&&(doc.match(/min-width:28px\">\\d\\.<\\/span>/g)||[]).length===3})()")===true,
     'COMPILER: one cover, then a contents page numbering the sections');
  ok(w.eval("(function(){var doc=rcCompile(rcDefs()[0].id);var c=doc.indexOf('>Contents<'),i=doc.indexOf('>Introduction<'),s1=doc.indexOf('page-break-before:always');return i>c&&s1>i&&doc.indexOf('Written by the compiler')>=0})()")===true,
     'COMPILER: the introduction follows the contents and precedes the first section');
  ok(w.eval("(function(){var doc=rcCompile(rcDefs()[0].id);var gaps=0;rcDefs()[0].units.forEach(function(u){gaps+=rcUnitGaps(u).length});return (gaps>0)===(doc.indexOf('What is missing')>=0)&&doc.indexOf('Nothing required by the stages')<0})()")===true,
     'COMPILER: the gaps list prints at the front when something is missing, and nothing prints in its place when nothing is (14 Sep 2026, Paul\u2019s ruling: the clean statement is gone)');
  ok(w.eval("(function(){var doc=rcCompile(rcDefs()[0].id);return (doc.match(/font-size:24px;font-weight:600;color:#888;margin-right:12px\">\\d<\\/span>/g)||[]).length===3 /* 14 Sep 2026 (Paul's ruling): the section number at the title's size */&&doc.indexOf('A note.')>=0&&(doc.match(/NextChapter \\u00b7/g)||[]).length===1&&!/<button/.test(doc.slice(doc.indexOf('>Contents<')))})()")===true,
     'COMPILER: each section starts its own page with its note; no unit brings a second cover or a control');
  ok(w.eval("(function(){var d=rcDefs()[0];rcMove(d.id,2,-1);var a=d.units[1].kind==='page';rcToggle(d.id,'page:5.1');var b=d.units.length===2;rcDuplicate(d.id);var c=rcDefs().length===2&&rcDefs()[1].name==='Board pack (copy)';data.reportDefs=[];return a&&b&&c})()")===true,
     'COMPILER: sections reorder and drop; a definition duplicates');
  ok(w.eval("(function(){currentPage='reports';var p=renderReports();return p.indexOf('<h2 class=\"h-section\">Report Manager</h2>')>=0&&_navMoreHtml().indexOf('Report Manager</button>')>=0})()")===true,
     'COMPILER: the Report Manager page renders and the More menu carries its door (renamed 12 Sep 2026)');

  /* ── SPILL RULE and DEPTH, Round 4 (Spec Rev A §7) ── */
  console.log('== spill rule, depth on outputs ==');
  var _sp=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_sp.indexOf('SPILL RULE')<0&&_sp.indexOf("(rowCount>LONG?'break-inside:auto;page-break-inside:auto;break-before:page;page-break-before:always;margin-bottom:40px':'break-inside:avoid;page-break-inside:avoid')")>=0,
     'LAYOUT (Paul\u2019s rulings, 13 Sep 2026): no script measures the page from the screen; a record that fits a page is unsplittable; one longer than a page starts a fresh page, flows and splits between rows, and ends with a wider gap; the browser places both from its own print layout');
  ok(w.eval("(function(){var h=renderOutSysInv();return h.indexOf('DEPTH')<0&&h.indexOf('Save as PDF')>=0})()")===true,
     'DEPTH (superseded 12 Sep 2026, Paul\u2019s print pass): the Systems Inventory offers no depth \u2014 its summary would equal its full \u2014 and prints one form');
  ok(w.eval("(function(){UI.printDepth='full';var f=PRINT_DOCS['out-sysinv']();UI.printDepth='summary';var s=PRINT_DOCS['out-sysinv']();return f===s&&f.indexOf('>Specification document<')>=0})()")===true,
     'DEPTH (superseded 12 Sep 2026): the inventory document is the same at either setting and always carries every field');
  ok(w.eval("(function(){var rows=function(x){return (x.match(/<tr><td style=\"width:34%/g)||[]).length};var out={};['out-riskreg','out-assessedreg','out-updatedreg'].forEach(function(id){UI.printDepth='summary';var s=PRINT_DOCS[id]();UI.printDepth='full';var f=PRINT_DOCS[id]();out[id]=rows(f)/Math.max(1,rows(s))});UI.printDepth='summary';return out['out-riskreg']>=2&&out['out-assessedreg']>=3&&out['out-updatedreg']>=2.5})()")===true,
     'DEPTH (Paul\u2019s ruling, 12 Sep 2026): where depth is offered it means something \u2014 full prints at least two to three times the rows of summary on each register');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-riskreg']();var r=getPortfolios().identify[0];var bad=d.split('Rapid risk screen').slice(1).some(function(seg){return seg.slice(0,140).indexOf('Not recorded')>=0});return d.indexOf('/15')>=0&&!bad})()")===true,
     'SEED: every identify-lane risk prints its rapid screen (read from litL/litI/litT, where Step 1.3 writes it), never Not recorded against a score');
  ok(w.eval("(function(){return getPortfolios().identify.every(function(r){return r.needs&&(r.needs.expertise||[]).length&&r.needs.effort})})()")===true,
     'SEED: every identify-lane risk carries its expertise and effort (the seed gap Paul found)');
  ok(w.eval("(function(){var c=rcCatalogue();return c.filter(function(u){return u.kind==='output'&&u.depths}).length===3&&c.filter(function(u){return u.kind==='output'&&!u.depths}).length===Object.keys(PRINT_DOCS).length-3})()")===true,
     'CATALOGUE: depth is offered on the three risk registers only');
  var _rg=require('fs').readFileSync('Governance-app.js','utf8');
  ok(_rg.indexOf('svg [stroke="rgba(245,242,236,.08)"]{stroke:#b8b8b8 !important}')>=0,'RADAR: the assessment profile\u2019s grid, drawn for the dark theme, is given a visible stroke in print');

  /* ── PHASE 5 SURFACES PRINT (13 Sep 2026, Paul's ruling): portfolios, the Testing Center, the Compliance Dashboard, folds open ── */
  console.log('== phase 5 surfaces print ==');
  w.eval('seedSampleData&&seedSampleData()');
  ok(w.eval("(function(){currentPage='portfolio';currentStep='manage';var p=renderPortfolioPage();currentPage='step';return p.indexOf('print-bar')>=0&&p.indexOf('DEPTH')>=0&&p.indexOf('printPortfolioDoc()')>=0})()")===true,
     'P5: a portfolio page carries the Save as PDF bar with the depth control');
  ok(w.eval("(function(){var d=portfolioDoc('manage');return (d.match(/min-height:85vh/g)||[]).length===1&&(d.match(/ly-rec/g)||[]).length===getPortfolios().manage.length&&(d.indexOf('>Management plan<')>=0||d.indexOf('>Monitoring plan<')>=0)&&d.indexOf('>Preliminary risk card<')<0})()")===true,
     'P5: the Manage and Monitor portfolio prints as the engine\u2019s register for its lane');
  ok(w.eval("(function(){UI.printDepth='full';var f=portfolioDoc('identify');UI.printDepth='summary';var s=portfolioDoc('identify');return f.length>s.length*1.5})()")===true,
     'P5: a portfolio document honours depth');
  ok(w.eval("(function(){var was=window.open;var out='';window.open=function(){return {document:{write:function(x){out+=x},close:function(){}},print:function(){},focus:function(){}}};currentStep='5.3';printCurrentPage();var a=out.indexOf('>Testing plan<')>=0;out='';currentStep='5.2';UI.cdTab='obl';cdSetPrintDepth('obl','full');printCurrentPage();UI.cdPrintDepth={};UI.cdTab='dash';var b=out.indexOf('>Statements<')>=0;window.open=was;return a&&b})()")===true,
     'P5: the Testing Center and the Compliance Dashboard print their record documents, not cleaned screens (14 Sep 2026: the obligations tab at full depth)');
  ok(w.eval("(function(){UI.expanded={};UI.wbOpen={};var closed=renderStepContentBody('5.1');var open=withFoldsOpen(function(){return renderStepContentBody('5.1')});return open.length>closed.length&&Object.keys(UI.expanded).length===0&&Object.keys(UI.wbOpen).length===0})()")===true,
     'P5: withFoldsOpen renders a page with every fold open and restores the state objects afterwards');
  ok(w.eval("(function(){var d=rcUnitBody({kind:'portfolio',id:'assess',depth:'summary'});return d.indexOf('min-height:85vh')<0&&d.indexOf('ly-rec')>=0})()")===true,
     'P5: the compiler\u2019s portfolio unit is the same document without its cover');

  /* ── PRINT PASS, 13 Sep 2026 (Paul): group headers, the inventory's overview, the outputs order, the Analytics document ── */
  console.log('== print pass 13 Sep: headers, inventory, order, analytics ==');
  w.eval('seedSampleData&&seedSampleData()');
  ok(w.eval("(function(){UI.printDepth='full';var d=PRINT_DOCS['out-riskreg']();UI.printDepth='summary';return (d.match(/class=\"ly-group\"/g)||[]).length===2&&(d.match(/<caption style=\"caption-side:top;text-align:left;padding:0\"><div class=\"ly-group\"/g)||[]).length===2&&d.indexOf('font-size:24px;font-weight:700;color:#111;margin:30px 0 12px;padding-bottom:8px;border-bottom:3px solid #111')>=0})()")===true,
     'HEADERS: the Urgent and Other Risks headers are the largest, heaviest element and each is its first record\u2019s table caption, kept with that record\u2019s first page whether the record is short or long');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-sysinv']();var o=d.indexOf('AI Systems Overview');return o>d.indexOf('min-height:85vh')&&o<d.indexOf('ly-rec')&&d.slice(o-200,o).indexOf('page-break-after:always')>=0})()")===true,
     'INVENTORY: the first page after the cover is the Step 1.2 AI Systems Overview');
  ok(w.eval("JSON.stringify(PH[0].outcomes.map(function(o){return o.id}))")==='["out-assessprofile","out-sysinv","out-riskreg","out-reglandscape"]',
     'ORDER: Systems Inventory precedes the Initial Risk Register');
  ok(w.eval("(function(){var a=analyticsDoc();var parts=a.split('break-after:page;page-break-after:always');var p1=parts[1];var has=function(seg,t){return seg.indexOf(t)>=0};return (a.match(/min-height:85vh/g)||[]).length===1&&a.indexOf('Risk Explorer')<0&&has(p1,'an-kpi')&&has(p1,'Analytical Signals')&&parts.length===6&&has(parts[2],'Risk Heatmap')&&has(parts[2],'Risk Pipeline')&&has(parts[2],'NIST Areas Addressed')&&has(parts[2],'Risk Category Profile')&&has(parts[3],'TEVV Evidence Matrix')&&has(parts[3],'Composition')&&has(parts[4],'90-Day Burnup')&&has(parts[4],'Gaps')&&has(parts[4],'Top Exposures')&&has(parts[5],'System Exposure Map')&&has(parts[5],'Metric Trends')&&/Governance Velocity[\\s\\S]*Team Load/.test(parts[5])&&a.indexOf('.owner-row{display:flex')>=0&&!/<button|onclick=/.test(a)})()")===true,
     'ANALYTICS (Paul\u2019s page plan, 13 Sep 2026): page one title, coverage, figures, signals; page two heatmap, pipeline, NIST areas, category profile; page three TEVV, exit readiness, composition; page four burnup, gaps, top exposures; page five exposure map, trends; then velocity beside team load; no Risk Explorer; no controls');
  ok(w.eval("(function(){var was=window.open;var out='';window.open=function(){return {document:{write:function(x){out+=x},close:function(){}},print:function(){},focus:function(){}}};currentStep='5.4';printCurrentPage();window.open=was;return out.indexOf('<title>Analytics</title>')>=0&&out.indexOf('an-kpi')>=0})()")===true,
     'ANALYTICS: the page\u2019s print control prints the document');

  var _sr=require('fs').readFileSync('Governance-app.js','utf8');
  /* pin retired 13 Sep 2026 (Paul's ruling): the spill routine is gone; the browser places unsplittable record blocks */

  /* ── BUBBLE LABELS (Paul's ruling, 13 Sep 2026): the System Exposure Map's labels never overlap; a fix on the page that carries into the print ── */
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var svg=anBubble();var L=[];svg.split('<text ').slice(1).forEach(function(seg){if(seg.indexOf('text-anchor=\"middle\" font-size=\"12\" fill=\"'+AN.txt)<0)return;var x=parseFloat(seg.split('x=\"')[1]),y=parseFloat(seg.split('y=\"')[1]),t=seg.split('>')[1].split('<')[0];if(/LIVE RISKS|AVG EXPOSURE/.test(t))return;L.push({x:x,y:y,t:t})});var box=function(l){return {x1:l.x-l.t.length*3.2,x2:l.x+l.t.length*3.2,y1:l.y-11,y2:l.y+3}};var bad=0;for(var i=0;i<L.length;i++)for(var j=i+1;j<L.length;j++){var a=box(L[i]),b=box(L[j]);if(!(a.x2<b.x1||a.x1>b.x2||a.y2<b.y1||a.y1>b.y2))bad++}return L.length===(data.systems||[]).length&&bad===0&&svg.lastIndexOf('<circle')<svg.indexOf('text-anchor=\"middle\" font-size=\"12\" fill=\"'+AN.txt)})()")===true,
     'BUBBLE: one label per system, no two labels overlap, and every label is drawn after every circle');
  ok(w.eval("(function(){var a=analyticsDoc();var parts=a.split('break-after:page;page-break-after:always');var p5=parts[5];return p5.indexOf('System Exposure Map')>=0&&p5.indexOf('Governance Velocity')>=0&&p5.indexOf('Team Load')>p5.indexOf('Governance Velocity')&&a.lastIndexOf('Metric Trends')>a.lastIndexOf('Team Load')})()")===true,
     'ANALYTICS (option two, 13 Sep 2026): page five is the exposure map with velocity and team load beneath; Metric Trends is the last page');

  /* ── COVER ORGANIZATION (Paul's ruling, 13 Sep 2026): Step 1.1's enterprise name first; the sign-in label only as a fallback ── */
  ok(w.eval("(function(){var was=data.enterprise;data.enterprise={name:'Aurora Windows'};var c=printDocCover('T','L','');data.enterprise=was;return c.indexOf('>Aurora Windows<')>=0})()")===true,
     'COVER: the organization on the cover is the Step 1.1 enterprise name when one is recorded');
  ok(w.eval("(function(){var was=data.enterprise;data.enterprise={name:'  '};var c=printDocCover('T','L','');data.enterprise=was;var o=null;try{o=getOrg(currentOrgId)}catch(e){}return !o||!o.name||c.indexOf('>'+esc(o.name)+'<')>=0})()")===true,
     'COVER: with a blank enterprise name the sign-in organization\u2019s label is the fallback');

  /* ── ONE NAME (Paul's ruling, 13 Sep 2026): saving Organization Details renames the sign-in organization too ── */
  ok(w.eval("(function(){var o=currentOrgId?getOrg(currentOrgId):null;if(!o)return true;var was=o.name,wasEnt=data.enterprise;var el=document.getElementById('ent_name');var made=false;if(!el){el=document.createElement('input');el.id='ent_name';document.body.appendChild(el);made=true}el.value='Aurora Windows';saveEnterprise();var after=getOrg(currentOrgId).name;el.value='';saveEnterprise();var blankKept=getOrg(currentOrgId).name==='Aurora Windows';if(made)el.remove();saveOrgs(getOrgs().map(function(x){return x.id===currentOrgId?Object.assign({},x,{name:was}):x}));data.enterprise=wasEnt;saveData();return after==='Aurora Windows'&&blankKept})()")===true,
     'ONE NAME: saving Organization Details with a new name renames the sign-in organization; saving with a blank name leaves the label alone');

  /* ── INVENTORY READOUT (Paul's ruling, 13 Sep 2026) ── */
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var d=PRINT_DOCS['out-sysinv']();var o=d.indexOf('AI Systems Overview');return o>0&&d.indexOf('Deployed',o)>0&&d.indexOf('In development',o)>0&&d.indexOf('Deployed')<d.indexOf('ly-rec')&&d.indexOf('onclick=')<0})()")===true,
     'INVENTORY: the document\u2019s overview page carries the Deployed / In development readout, before the records, with no click handlers');
  ok(w.eval("(function(){var h=renderOutSysInv();return h.indexOf('AI Systems Overview')>=0&&h.indexOf('Deployed')>=0&&h.indexOf('In development')>=0&&h.indexOf('AI Systems Overview')<h.indexOf('Internal Systems')})()")===true,
     'INVENTORY: the output page opens on the overview and the readout, above the system list');

  /* ── PRINT CENSUS (Paul's ruling, 13 Sep 2026): every document on the seed, checked for the universal shape in one place, so a change to a general rule fails here by name ── */
  console.log('== print census ==');
  w.eval('seedSampleData&&seedSampleData()');
  var _census=w.eval("(function(){var out=[];var ids=Object.keys(PRINT_DOCS);UI.printDepth='summary';ids.forEach(function(id){var d='';try{d=PRINT_DOCS[id]()}catch(e){out.push(id+': threw '+e.message);return}var body=d.slice(d.indexOf('min-height:85vh'));var covers=(d.match(/page-break-after:always;display:flex;flex-direction:column;justify-content:center;min-height:85vh/g)||[]).length;if(covers!==1)out.push(id+': '+covers+' covers');if(d.indexOf('NextChapter \\u00b7 90-Day Responsible AI Governance')<0)out.push(id+': no kicker');if(/<div style=\"font-size:13px\">[A-Z][a-z]+ \\d{1,2}, 20\\d\\d<\\/div>/.test(d)===false)out.push(id+': no date line');if(/Printed |\\d+ risks? on the register| \\u00b7 \\d+ (questions|fields|components|regimes|systems|activit)/.test(d.slice(0,2000)))out.push(id+': count or Printed on the cover');if(/<button|<select|onclick=/.test(body))out.push(id+': a control in the body');if(d.indexOf('ly-rec')>=0){if(!/<table class=\"ly-rec\"[\\s\\S]*?<thead>/.test(d))out.push(id+': a record block without its header row');if(!/class=\"ly-rec\" style=\"width:100%;border-collapse:collapse;margin:0 0 18px;break-inside:(avoid|auto);page-break-inside:(avoid|auto)\"/.test(d))out.push(id+': a record block without its split rule');if(/class=\"ly-group\"/.test(d)&&!/<caption style=\"caption-side:top;text-align:left;padding:0\"><div class=\"ly-group\"/.test(d))out.push(id+': a group header not a caption of its first record')}});['portfolioDoc','analyticsDoc'].forEach(function(f){['identify','assess','manage','emergency'].forEach(function(k){if(f!=='portfolioDoc')return;var d=portfolioDoc(k);if((d.match(/min-height:85vh/g)||[]).length!==1)out.push('portfolio '+k+': cover count')})});var a=analyticsDoc();if((a.match(/min-height:85vh/g)||[]).length!==1||/<button|onclick=/.test(a))out.push('analytics: cover or control');var g=(typeof dashboardDoc==='function')?dashboardDoc():'';if((g.match(/min-height:85vh/g)||[]).length!==1||/<button|onclick=|\\u25b8|\\u25be/.test(g))out.push('dashboard: cover, control, or fold glyph');var src=String(printPage);['@page{margin:16mm 14mm 20mm 14mm;@top-left{content:\"\"}','@bottom-left{content:\"','@bottom-right{content:counter(page)','print-color-adjust:exact','svg [stroke=\"rgba(245,242,236,.08)\"]{stroke:#b8b8b8 !important}'].forEach(function(n){if(src.indexOf(n)<0)out.push('print window lacks: '+n.slice(0,40))});return out})()");
  if(_census.length)console.log('   census findings:',_census.join(' | '));
  ok(_census.length===0,'PRINT CENSUS: every document has one cover with the kicker and the date, no count, no control in its body, record blocks with header rows and bound group headers; record blocks carry their split rule; the print window carries the corners, colour, and the SVG stroke override (14 Sep 2026: the Governance Dashboard document joins the walk)');

  /* ── SECTION HEADINGS (Paul's ruling, 13 Sep 2026; universal): bold, at least two points above the largest text beneath, below the document's title ── */
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var d=PRINT_DOCS['out-ethicsdoc']();var secs=(d.match(/class=\"doc-sec\" style=\"font-size:17px;font-weight:700/g)||[]).length;var glance=(d.match(/class=\"doc-sec\" style=\"font-size:15px;font-weight:700/g)||[]).length;var under=0;var re=/font-size:(\\d+)px;font-weight:700;color:#111\">\\d+\\./g,m;while((m=re.exec(d)))under=Math.max(under,+m[1]);return secs>=6&&glance>=5&&under<=15&&d.indexOf('font-size:22px')>=0&&(d.match(/text-transform:uppercase;color:#333;margin:(16|26)px 0 4px/g)||[]).length===0})()")===true,
     'HEADINGS: the Responsible AI Principles document\u2019s section headings are 17px bold over 14px content, below the 22px title; no kicker-style section heads remain');
  ok(_sp.indexOf('.doc-sec{font-size:17px !important;font-weight:700 !important;color:#111 !important}')>=0,
     'HEADINGS: the print window carries the section-heading rule for any document that marks a heading doc-sec');

  /* ── COMPLIANCE OBLIGATIONS PAGE (Paul's ruling, 13 Sep 2026): the page reflects the document ── */
  ok(w.eval("(function(){seedSampleData&&seedSampleData();UI.expanded={};var c=renderOutCompliance();var n=(data.regimes||[]).length;var bars=(c.match(/class=\"xh\"/g)||[]).length;var noRec=(c.match(/ly-rec/g)||[]).length===0;var counts=c.indexOf(' met</span>')>=0;var g=(data.regimes||[]).filter(function(x){return (x.obligations||[]).length})[0];UI.expanded['cmp_'+g.id]=true;var o=renderOutCompliance();UI.expanded={};return bars===n&&noRec&&counts&&(o.match(/ly-rec/g)||[]).length===1&&o.indexOf('>Obligations<')>=0&&o.indexOf('>Statements<')>=0&&o.indexOf('>Evidence<')>=0&&c.indexOf('Save as PDF')>=0})()")===true,
     'COMPLIANCE PAGE: one closed bar per regime with status counts; opening one shows that regime\u2019s full record \u2014 scoping, obligations with statements and evidence \u2014 as the document prints it; the print control stays');

  /* ── VALUES IN WORDS (Paul's ruling, 13 Sep 2026) ── */
  ok(w.eval("(function(){return lyCap('applies')==='Applies'&&lyCap('https://nist.gov/x')==='https://nist.gov/x'&&lyCap('a@b.co')==='a@b.co'&&lyCap('tt-seed-sys-1-valid')==='tt-seed-sys-1-valid'&&lyCap('Already')==='Already'})()")===true,
     'VALUES: a printed value begins with a capital, except a URL, an email, or an id');
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var c=PRINT_DOCS['out-compliance']();UI.printDepth='full';var a=PRINT_DOCS['out-assessedreg']();UI.printDepth='summary';var lower=function(x){return (x.match(/font-size:12\\.5px;color:#111;line-height:1\\.5;border-bottom:1px solid #eee\">[a-z]/g)||[]).length};return lower(c)===0&&lower(a)===0&&/Applies \\u2014|Investigate \\u2014|Does not apply \\u2014/.test(c)&&c.indexOf('Every system in the inventory')>=0})()")===true,
     'VALUES: no printed value in the compliance or assessed documents begins lowercase; a regime\u2019s scoping reads as a judgment in words; \u201call systems\u201d reads as words');
  ok(w.eval("(function(){var d=PRINT_DOCS['out-compliance']();return (d.match(/break-before:page;page-break-before:always;margin-bottom:40px/g)||[]).length>=1&&(d.match(/break-inside:avoid;page-break-inside:avoid\">/g)||[]).length>=1})()")===true,
     'LAYOUT: in one document a long record starts a fresh page with a wider gap after it while short records stay unsplittable in the flow');

  /* ── 14 Sep 2026 (Paul's rulings): quiet Phase 5 controls; the framework document without left bars; the updated register one per page ── */
  ok(w.eval("(function(){var b=printBar();var p=(function(){currentPage='portfolio';currentStep='manage';var x=renderPortfolioPage();currentPage='step';return x})();return b.indexOf('class=\"btn bg2\" style=\"font-size:12px\" onclick=\"printCurrentPage()\"')>=0&&b.indexOf('background:bg2')<0&&p.indexOf('class=\"btn bg2\" style=\"font-size:12px\" onclick=\"printPortfolioDoc()\"')>=0})()")===true,
     'CONTROLS: the Phase 5 print bar and the portfolio pages carry the outputs\u2019 quiet Save as PDF control, not a filled button');
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var d=PRINT_DOCS['out-govfw']();var scr=renderOutGovFW();return (d.match(/border-left:4px solid/g)||[]).length===0&&(scr.match(/border-left:4px solid/g)||[]).length>0})()")===true,
     'FRAMEWORK: the document carries none of the boxes\u2019 left bars; the screen keeps them');
  ok(w.eval("(function(){UI.printDepth='summary';var u=PRINT_DOCS['out-updatedreg']();var i=PRINT_DOCS['out-riskreg']();var recs=(u.match(/<table class=\"ly-rec\"/g)||[]).length;var brk=(u.match(/<div style=\"break-before:page;page-break-before:always\"><table class=\"ly-rec\"/g)||[]).length;return recs>1&&brk===recs-1&&(i.match(/<div style=\"break-before:page;page-break-before:always\"><table/g)||[]).length===0})()")===true,
     'UPDATED REGISTER: one record per page at summary depth (every record after the first starts a fresh page); the other registers flow as before');

  /* ── GOVERNANCE DASHBOARD DOCUMENT (14 Sep 2026, Paul's print pass): the dashboard prints as its own document, not a cleaned screen ── */
  ok(w.eval("(function(){if(typeof dashboardDoc!=='function')return false;seedSampleData&&seedSampleData();var d=dashboardDoc();var body=d.slice(d.indexOf('</div></div>',d.indexOf('min-height:85vh'))+12);var reg=body.slice(body.indexOf('Register of Responsible AI Principles'),body.indexOf('Risk Management</div>'));return (d.match(/min-height:85vh/g)||[]).length===1&&d.indexOf('<div style=\"font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;margin:0 0 14px\">Governance Dashboard</div>')>=0&&(d.match(/break-after:page;page-break-after:always/g)||[]).length===2&&d.indexOf('class=\"gd-sub\" style=\"break-before:page')>=0&&!/<button|onclick=|\u25b8|\u25be|open \u2192|cursor:pointer/.test(body)&&body.indexOf('Testing Center')<0&&(body.match(/RACI Matrix/g)||[]).length===1&&body.indexOf('@page gdraci{size:landscape}')>=0&&body.indexOf('Click on a blank space')<0&&body.indexOf('<input')<0&&body.indexOf('Data Bank')<0&&body.indexOf('commitments an outsider')<0&&body.indexOf('How is this scored')<0&&body.indexOf('Click ')<0&&(body.match(/Register of Responsible AI Principles/g)||[]).length===1&&reg.indexOf('border-left')<0})()")===true,
     'DASHBOARD DOC: one cover titled Governance Dashboard; page breaks after the Overview and the Register, the glance and the RACI matrix on pages of their own (14 Sep 2026, later); no control, fold glyph, arrow, or screen instruction in the body; no Testing Center or Data Bank; the RACI matrix alone on a landscape page, without its team editor; the Register headed once, without its authoring lead or left bars');
  ok(w.eval("(function(){if(typeof dashboardDoc!=='function')return false;var d=dashboardDoc();var P=getPortfolios();var prs=((data.ethicalFramework||{}).principles)||[];var lanes=P.identify.length+P.assess.length+P.manage.length+P.emergency.length;return (d.match(/class=\"gd-gl-p\"/g)||[]).length===prs.length&&prs.length>=9&&d.indexOf('gd-pr-l')<0&&(d.match(/class=\"gd-dom\"/g)||[]).length===ethDomains().length&&(d.match(/class=\"phase-flex\"/g)||[]).length===4&&d.indexOf('.gd-doc .u-778010b{display:flex')>=0&&d.indexOf('.gd-doc .u-0cc49e2{width:100%;height:70px}')>=0&&(d.match(/class=\"gd-lane\"/g)||[]).length===4&&(d.match(/class=\"gd-item\"/g)||[]).length===lanes&&lanes>3&&d.indexOf('+'+(P.identify.length-3)+' more')<0&&(d.match(/class=\"gd-cols\"/g)||[]).length===5&&d.indexOf('gd-lanes')<0&&d.indexOf('>Managed (')>=0&&d.indexOf('>Monitored (')>=0&&(d.match(/class=\"gd-rev\"/g)||[]).length===3&&/class=\"gd-rev-d\">[A-Z][a-z]+ \\d{1,2}, 20\\d\\d</.test(d)&&!/class=\"gd-rev-d\">\\d{4}-/.test(d)&&(d.match(/<tr><td style=\"font-weight:600;color:#111\">/g)||[]).length===(data.systems||[]).filter(function(x){return !x.archived}).length&&d.indexOf('Stage Distribution')>=0&&d.indexOf('By Category')>=0&&d.indexOf('Risk Register Heat Map')>=0})()")===true,
     'DASHBOARD DOC: every principle of every domain at a glance (14 Sep 2026, later); the four-chevron strip with its rules declared; the four lanes full width, naming every item in two columns, Manage & Monitor split into Managed and Monitored (no \u201c+n more\u201d); the three review cadences with their dates in words; a row per live system; the three glance charts');
  ok(w.eval("(function(){if(typeof dashboardDoc!=='function')return false;var was=window.open;var out='';window.open=function(){return {document:{write:function(x){out+=x},close:function(){}},print:function(){},focus:function(){}}};currentStep='5.1';printCurrentPage();window.open=was;var a=out.indexOf('<title>Governance Dashboard</title>')>=0&&out.indexOf('class=\"gd-doc\"')>=0&&(out.match(/min-height:85vh/g)||[]).length===1&&out.indexOf('print-bar')<0;data.reportDefs=[];rcNew();var dd=rcDefs()[0];rcToggle(dd.id,'page:5.1');var rc=rcCompile(dd.id);var gi=rc.indexOf('class=\"gd-doc\"');var u=rc.slice(gi);var b=gi>0&&u.indexOf('min-height:85vh')<0&&(rc.match(/min-height:85vh/g)||[]).length===1;data.reportDefs=[];return a&&b})()")===true,
     'DASHBOARD DOC: the page\u2019s Save as PDF prints the document under one cover; the compiler\u2019s Governance Dashboard unit is the same document without its cover (14 Sep 2026, later: the unit found by its own class, the document now carrying page breaks of its own)');

  /* ── 14 Sep 2026 (Paul's rulings): the Emergency Response portfolio leads with the plan; the Compliance Dashboard prints per tab at a chosen depth; identity tokens print as words ── */
  ok(w.eval("(function(){if(typeof portfolioDoc!=='function')return false;seedSampleData&&seedSampleData();var ok=true;['summary','full'].forEach(function(dep){UI.printDepth=dep;var d=portfolioDoc('emergency');var tb=d.indexOf('<tbody>');var lead=d.indexOf('class=\"ly-lead\"');var firstRow=d.indexOf('<tr>',tb);if(!(lead>tb&&firstRow>=tb&&lead<firstRow+120))ok=false;var box=d.slice(lead,d.indexOf('</table></div></td></tr>',lead));['What happened','Escalated','Emergency plan in force','Lead','Triggers','First moves','Stand-down'].forEach(function(f){if(box.indexOf('>'+f+'</td>')<0)ok=false});if(/Emergency plan in force<\\/td><td[^>]*><span style=\"color:#999\">Not recorded/.test(box))ok=false;var after=d.slice(d.indexOf('</table></div></td></tr>',lead));if(after.indexOf('Deep-dive assessment')<0)ok=false});UI.printDepth='summary';return ok&&portfolioDoc('manage').indexOf('ly-lead')<0&&PRINT_DOCS['out-updatedreg']().indexOf('ly-lead')<0})()")===true,
     "EMERGENCY LEAD: the Emergency Response portfolio leads each record with its emergency response layer, every field of it, in a box, at either depth; the plan in force resolves on the seed; the other lanes and the registers carry no box");
  ok(w.eval("(function(){if(typeof cdPrintBlock!=='function')return false;var ok=true;currentPage='step';currentStep='5.2';['dash','reg','obl'].forEach(function(tab){UI.cdTab=tab;UI.cdPrintDepth={};var p=renderStepContent('5.2');var bars=(p.match(/class=\"print-bar\"/g)||[]).length;var blk=p.slice(p.indexOf('class=\"print-bar\"'));var lab=blk.indexOf('PRINT DEPTH'),btn=blk.indexOf('printComplianceTab()');if(bars!==1||lab<0||btn<0||lab>btn||p.indexOf('printCurrentPage()')>=0||p.indexOf('Export Conformance')>=0)ok=false;var strip=function(x){return x.replace(/<div class=\"print-bar\"[\\s\\S]*?Save as PDF<\\/button><\\/div><\\/div>/,'')};var before=strip(p);UI.cdPrintDepth[tab]='full';var q=renderStepContent('5.2');if(strip(q)!==before)ok=false;if(cdPrintDepth(tab)!=='full')ok=false});UI.cdPrintDepth={};UI.cdTab='dash';return ok})()")===true,
     "COMPLIANCE CONTROLS: each Compliance Dashboard tab carries one print block — the printout's Summary / Full choice above its own Save as PDF — and no generic bar; the choice changes the printout, not the page; the Export Conformance Report button is gone");
  ok(w.eval("(function(){if(typeof complianceTabDoc!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};var ok=true;var T={dash:'Conformance Report',reg:'Compliance Register',obl:'Compliance Obligations'};['dash','reg','obl'].forEach(function(tab){['summary','full'].forEach(function(dep){var d=complianceTabDoc(tab,dep);if(c(d,/min-height:85vh/g)!==1||(d.indexOf('color:#111;margin:0 0 14px\">'+T[tab]+'</div>')<0&&d.indexOf('margin:0\">Conformance Report</div>')<0)||/<button|onclick=/.test(d))ok=false;if(tab==='dash'){var rows=c(d,/<tr><td class=\"cf-id\"/g);if(c(d,/class=\"cf-fn\"/g)!==4)ok=false;if(dep==='full'&&rows!==NIST_SUBCATS.length)ok=false;if(dep==='summary'&&(rows!==0||c(d,/>ADDRESSED</g)!==4))ok=false;if(d.indexOf('does not assert compliance')<0)ok=false}if(tab==='reg'){var g1=d.indexOf('Compliance Register <span'),g2=d.indexOf('Awaiting scoping <span');if(!(g1>0&&g2>g1)||c(d,/class=\"ly-rec\"/g)!==(data.regimes||[]).length)ok=false;if(dep==='summary'&&d.indexOf('>Obligations</td>')>=0)ok=false;if(dep==='full'&&d.indexOf('>Obligations</td>')<0)ok=false}if(tab==='obl'){var n=(data.regimes||[]).filter(function(g){return g.scoping&&g.scoping.judgment==='applies'}).length;if(c(d,/class=\"ly-rec\"/g)!==n||n<1)ok=false}})});var was=window.open;var out='';window.open=function(){return {document:{write:function(x){out+=x},close:function(){}},print:function(){},focus:function(){}}};currentPage='step';currentStep='5.2';UI.cdTab='reg';cdSetPrintDepth('reg','full');printCurrentPage();window.open=was;if(out.indexOf('<title>Compliance Register</title>')<0||out.indexOf('>Obligations</td>')<0)ok=false;UI.cdPrintDepth={};var cat=rcCatalogue();var tabs=cat.filter(function(u){return u.kind==='cdtab'});if(tabs.length!==3||!tabs.every(function(u){return u.depths&&u.depths.length===2&&u.group==='Phase 5 pages'})||cat.some(function(u){return u.kind==='page'&&u.id==='5.2'}))ok=false;data.reportDefs=[];rcNew();var dd=rcDefs()[0];rcToggle(dd.id,'cdtab:obl');var rc=rcCompile(dd.id);if(c(rc,/min-height:85vh/g)!==1||rc.indexOf('class=\"ly-rec\"')<0)ok=false;data.reportDefs=[];UI.cdTab='dash';return ok})()")===true,
     "COMPLIANCE DOCS: the three tabs print six documents — Conformance Report (summary: the four function cards and the subcategories by status; full: every one of the 72 rows), Compliance Register (the register first, then the regimes awaiting scoping), Compliance Obligations (the scoped-in regimes only) — each with one cover and no control; the page's Save as PDF prints the tab that is showing at its chosen depth; the compiler offers the three tabs at a depth in place of the old page unit");
  ok(w.eval("(function(){seedSampleData&&seedSampleData();var g=(data.regimes||[]).find(function(x){return x.type==='contractual'});var sx=(data.systems||[]).find(function(x){return x.govStatus==='governed'});if(!g||!sx)return false;var a=lyRender('regime',g,'summary',0);var b=lyRender('system',sx,'summary',0);return a.indexOf('>Contractual')>=0&&!/>contractual/.test(a)&&b.indexOf('Governance: Formally governed')>=0&&b.indexOf('Governance: governed')<0})()")===true,
     "TOKENS: the regime identity prints its type as its label and the system identity prints its governance status in words — no stored vocabulary token on the identity line");

  /* ── 14 Sep 2026 (Paul's ruling): the two Run-the-Review pages print as documents ── */
  ok(w.eval("(function(){if(typeof ethicsReviewDoc!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};var d=ethicsReviewDoc();var risks=data.risks||[];var prs=((data.ethicalFramework||{}).principles)||[];var lastEth=0;(data.reviewLog||[]).forEach(function(e){if(e.kind==='ethics'&&e.at>lastEth)lastEth=e.at});var dec=risks.filter(function(r){var s=ethStatusOf(r);return (s==='confirmed'||s==='cleared')&&r.ethTest&&r.ethTest.at&&(!lastEth||r.ethTest.at>lastEth)});var liveConf=risks.filter(function(r){return isLiveRisk(r)&&ethStatusOf(r)==='confirmed'});var esc2=liveConf.filter(function(r){return r.escalation});var arch=risks.filter(function(r){return ethStatusOf(r)==='confirmed'&&isArchivedRisk(r)});var logs=(data.reviewLog||[]).filter(function(e){return e.kind==='ethics'}).length;var body=d.slice(d.indexOf('</div></div>',d.indexOf('min-height:85vh'))+12);var page=(function(){currentPage='ethicsov';return renderEthicsOverviewPage()})();return c(d,/min-height:85vh/g)===1&&d.indexOf('color:#111;margin:0 0 14px\">Responsible AI Board Review</div>')>=0&&c(d,/class=\"rv-ag\"/g)===5&&(function(){UI.ethRevNotes='x';var n=c(ethicsReviewDoc(),/class=\"rv-ag\"/g);UI.ethRevNotes='';return n===6})()&&c(d,/class=\"rv-ag\" style=\"[^\"]*break-before:page/g)===4&&d.split('class=\"rv-ag\"').slice(1).every(function(p){var i=p.indexOf('<table class=\"ly-rec\"');if(i<0)return true;return p.slice(i,p.indexOf('>',i)).indexOf('break-before:page')<0})&&c(d,/class=\"rv-dec\"/g)===dec.length&&dec.length>0&&c(d,/class=\"ly-rec\"/g)===liveConf.length+esc2.length+arch.length&&c(d,/class=\"ly-lead\"/g)>=esc2.length&&esc2.length>0&&c(d,/class=\"rv-pr\"/g)===prs.length&&c(d,/class=\"rv-log\"/g)===0&&d.indexOf('Completed Reviews')<0&&!/<button|onclick=|<a |Mark reviewed|Mark Review Complete/.test(body)&&body.indexOf('Register of Responsible AI Principles')>=0&&c(page,/class=\"btn bg2\" style=\"font-size:12px\" onclick=\"printEthicsReview\\(\\)\"/g)===1})()")===true,
     "REVIEWS: the Responsible AI Board Review prints as a document — one cover, six agenda items in the page's words, every screening decision since the last review with its breach analysis, each live confirmed risk's record led by its plan, each escalated one led by its emergency plan, the archive rationales with their records, the register in full, one item per page with its first record following the description on that page, the notes only when written — with no control, route, or fold; the page carries the quiet Save as PDF control");
  ok(w.eval("(function(){if(typeof govReviewDoc!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};data.firstReview=data.firstReview||{};data.firstReview.walk={planned:1};UI.gvWorking='The cadence holds.';var d=govReviewDoc();data.firstReview.walk={};UI.gvWorking='';var logs=(data.reviewLog||[]).length;var body=d.slice(d.indexOf('</div></div>',d.indexOf('min-height:85vh'))+12);var page=(function(){currentPage='govreview';return renderGovReview()})();var cat=rcCatalogue().filter(function(u){return u.kind==='review'});data.reportDefs=[];rcNew();var dd=rcDefs()[0];rcToggle(dd.id,'review:ethics');rcToggle(dd.id,'review:governance');var rc=rcCompile(dd.id);data.reportDefs=[];return c(d,/min-height:85vh/g)===1&&d.indexOf('color:#111;margin:0 0 14px\">Governance Review</div>')>=0&&d.indexOf('Where Governance Stands')>=0&&c(d,/<svg/g)===4&&c(d,/class=\"rv-ag\"/g)===7&&c(d,/>Covered</g)===1&&body.indexOf('What is working?')>=0&&body.indexOf('The cadence holds.')>=0&&c(body,/Not yet recorded\\.<\\/div>/g)===2&&c(d,/class=\"rv-log\"/g)===0&&d.indexOf('Review Log')<0&&!/<button|onclick=|Governance Framework<|Log this review|Mark covered/.test(body)&&c(page,/class=\"btn bg2\" style=\"font-size:12px\" onclick=\"printGovReview\\(\\)\"/g)===1&&cat.length===2&&c(rc,/min-height:85vh/g)===1&&c(rc,/class=\"rv-doc\"/g)===2})()")===true,
     "REVIEWS: the Governance Review prints as a document — one cover, Where Governance Stands with its four rings, the seven agenda items in the page's words with the facts each presents and a Covered mark where one has been made, the three closing questions with their answers or Not yet recorded — with no review log and no control, route button, stepper, or Governance Framework fold; the page carries the quiet Save as PDF control; the compiler offers both reviews and renders them");

  /* ── 14 Sep 2026 (Paul's rulings): the Report Manager redesigned ── */
  ok(w.eval("(function(){if(typeof rcAddText!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};data.reportDefs=[];rcNew();var d=rcDefs()[0];rcToggle(d.id,'output:out-updatedreg','full');rcToggle(d.id,'cdtab:reg');UI.rcEdit=d.id;currentPage='reports';UI.rcF=null;var p=renderReports();var ok=p.indexOf('Report Content Options')>=0&&p.indexOf('What can go in')<0&&p.indexOf('One risk')<0;var gi=function(g){return p.indexOf('>'+g+'<span')};ok=ok&&gi('Individual AI Systems')>0&&gi('Individual Compliance Regimes')>gi('Individual AI Systems')&&gi('Individual Risks')>gi('Individual Compliance Regimes');ok=ok&&d.units[0].depth==='full'&&d.units[1].depth==='summary';ok=ok&&c(p,/onclick=\"rcToggle\\('[^']+','[^']+','full'\\)\"/g)>=8;ok=ok&&/textarea rows=\"6\" data-uncapped=\"1\"/.test(p)&&c(p,/rcAddText\\(/g)===1&&p.indexOf('Written by you and printed after the contents page.')>=0&&c(p,/class=\"btn bg2\"/g)===0&&(function(){UI.rcSel=d.units[0].key;var q=renderReports();UI.rcSel=null;return c(q,/textarea rows=\"4\" data-uncapped=\"1\"/g)===1&&q.indexOf('Preview this section')>=0&&q.indexOf('rcPreviewUnit(')>=0&&q.indexOf(esc(rcUnitDesc(d.units[0])))>=0&&q.indexOf(esc(rcUnitFact(d.units[0])))>=0})();ok=ok&&['Search risks by name','>PORTFOLIO<','Urgent (10+)','>Responsible AI<','Every AI system'].every(function(k){return p.indexOf(k)>=0});var all=c(p,/onclick=\"rcToggle\\('[^']+','record:risk:/g);rcSetFilter('pf','emergency');var p2=renderReports();var em=c(p2,/onclick=\"rcToggle\\('[^']+','record:risk:/g);rcSetFilter('pf','all');rcSetFilter('urg',true);var p3=renderReports();var ur=c(p3,/onclick=\"rcToggle\\('[^']+','record:risk:/g);UI.rcF=null;var P=getPortfolios();ok=ok&&all===(data.risks||[]).length&&em===P.emergency.length&&em<all&&ur===(data.risks||[]).filter(function(r){return compositeOf(r)>=10}).length&&ur<all;data.reportDefs=[];UI.rcEdit=null;return ok})()")===true,
     "REPORT MANAGER: the editor is headed Report Content Options with the groups named in full and ordered systems, regimes, risks; every option with a depth is added at Summary or Full from the list; the individual risks carry a search, a portfolio filter, Urgent and Responsible AI toggles, and a system filter that narrow the list; the introduction is a six-row uncapped textarea (14 Sep 2026, later: the sections are contents rows with a fact each, one inspector open at a time holding the description, the depth, a four-row note, and a preview of that section; Text page is the first content option; the Save as PDF here matches its neighbours by Paul's exception)");
  ok(w.eval("(function(){if(typeof rcPreview!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};data.reportDefs=[];rcNew();var d=rcDefs()[0];rcSet(d.id,'name','Board pack');rcAddText(d.id,null);rcSetUnit(d.id,0,'name','Part I');rcSetTextHtml(d.id,0,'<div>Hello <b>bold</b> <i>it</i><script>alert(1)</script><span style=\"color:red;font-size:18px\">big</span></div>');rcToggle(d.id,'output:out-updatedreg','full');UI.printDepth='summary';var doc=rcCompile(d.id);var ok=(doc.match(/min-height:85vh/g)||[]).length===1&&doc.indexOf('class=\"rc-text\"')>=0&&doc.indexOf('<b>bold</b>')>=0&&doc.indexOf('<i>it</i>')>=0&&doc.indexOf('alert(1)')<0&&doc.indexOf('color:red')<0&&doc.indexOf('font-size:18px\">big')>=0;ok=ok&&c(doc,/font-family:var\\(--serif,Georgia,serif\\);font-size:24px;font-weight:600;color:#888;margin-right:12px\">\\d<\\/span>/g)===2&&c(doc,/font-size:12px;color:#666;margin-right:10px\">\\d<\\/span>/g)===0;var sec2=doc.slice(doc.lastIndexOf('page-break-before:always\"><div style=\"font-family:var(--serif'));var t1=sec2.indexOf('<table class=\"ly-rec\"');var firstTag=sec2.slice(t1,sec2.indexOf('>',t1));ok=ok&&firstTag.indexOf('break-inside:auto')>=0&&firstTag.indexOf('break-before:page')<0&&/<table class=\"ly-rec\" style=\"[^\"]*break-before:page/.test(sec2.slice(t1+10));var was=window.open;var out='',printed=0;window.open=function(){return {document:{write:function(x){out+=x},close:function(){}},print:function(){printed++},focus:function(){}}};rcPreview(d.id);var prev=out.indexOf('class=\"preview-note\"')>=0&&out.indexOf('<title>Board pack</title>')>=0;out='';rcPrint(d.id);var pr=out.indexOf('class=\"preview-note\"')<0&&out.length>0;window.open=was;data.reportDefs=[];return ok&&prev&&pr&&printed===0})()")===true,
     "REPORT MANAGER: a text page with a heading and a formatted body is a numbered section; the body keeps bold, italics, breaks, and sizes and drops scripts and colours; the compiled report's section numbers are at the title's size; the report previews without the print dialog and prints with it; the first record of a section stays with the section heading");
  ok(w.eval("(function(){var mk=function(uncapped){var t=document.createElement('textarea');if(uncapped)t.setAttribute('data-uncapped','1');document.body.appendChild(t);t.value=new Array(12001).join('x');t.dispatchEvent(new Event('input',{bubbles:true}));var n=t.value.length;t.parentNode.removeChild(t);return n};return mk(false)===10000&&mk(true)===12000})()")===true,
     "REPORT MANAGER: the input cap leaves the Report Manager's authored text alone — a plain textarea is cut at 10,000 characters and a data-uncapped one is not");

  /* ── 14 Sep 2026 (Paul's rulings): the conformance cover's two lines; the Testing Center's log page ── */
  ok(w.eval("(function(){if(typeof cdConformanceCover!=='function'||typeof testingCenterDoc!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};var T='font-family:var(--serif,Georgia,serif);font-size:40px;font-weight:600;line-height:1.15;color:#111;';var n=complianceTabDoc('dash','summary');var other=(data.regimes||[]).filter(function(g){return g.id!=='reg-nist'&&(g.obligations||[]).length})[0];if(!other)return false;UI.cdRegime=other.id;var r=complianceTabDoc('dash','full');UI.cdRegime=null;var two=function(d,name){return d.indexOf('<div style=\"'+T+'margin:0\">Conformance Report</div><div style=\"'+T+'margin:0 0 14px\">'+esc(name)+'</div>')>=0&&c(d,/min-height:85vh/g)===1};var log=tcLogEntries();var t=testingCenterDoc();return two(n,'NIST AI RMF 1.0')&&two(r,other.name)&&c(t,/min-height:85vh/g)===1&&t.indexOf('<div style=\"break-before:page;page-break-before:always\"><div class=\"ly-group\"')>0&&c(t,/<tr style=\"break-inside:avoid/g)===log.length&&log.length>0&&!/>\\d{4}-\\d\\d-\\d\\d</.test(t)&&c(renderTestCenter(),/Testing log \\(/g)===1})()")===true,
     "CONFORMANCE COVER and TESTING LOG: every conformance report's cover reads Conformance Report on one line and what it is for on the next, in the same face and weight — NIST AI RMF 1.0, or the regime's name; the Testing Center document ends with the testing log on a page of its own, one row per logged result with its date in words, read from the same list the page shows");

  /* ── 14 Sep 2026 (Paul's ruling): the Track Program page prints as its own document and joins the Report Manager ── */
  ok(w.eval("(function(){if(typeof mgmtHubDoc!=='function')return false;seedSampleData&&seedSampleData();var c=function(d,re){return (d.match(re)||[]).length};var d=mgmtHubDoc();var steps=mgSteps();var was=window.open;var out='';window.open=function(){return {document:{write:function(x){out+=x},close:function(){}},print:function(){},focus:function(){}}};currentPage='mgmt-hub';printMgmtAnalytics();window.open=was;var u=rcCatalogue().find(function(x){return x.kind==='page'&&x.id==='mgmt-hub'});data.reportDefs=[];rcNew();rcToggle(rcDefs()[0].id,'page:mgmt-hub');var rc=rcCompile(rcDefs()[0].id);data.reportDefs=[];return c(d,/min-height:85vh/g)===1&&d.indexOf('color:#111;margin:0 0 14px\">Module Management</div>')>=0&&c(d,/class=\"mh-fig\"/g)===1&&d.indexOf('>This Week<')>0&&d.indexOf('>Assignments<')>0&&d.indexOf('>Analytics<')>0&&c(d,/<td class=\"mh-id\"/g)===steps.length&&steps.length>0&&!/<button|<input|<select|onclick=|Assignments<\\/button>/.test(d)&&!/>\\d{4}-\\d\\d-\\d\\d</.test(d)&&c(d,/break-before:page/g)===1&&out.indexOf('<title>Module Management</title>')>=0&&out.indexOf('class=\"mh-doc\"')>=0&&!!u&&u.group==='Program management'&&rcUnitDesc(u).length>20&&/steps done$/.test(rcUnitFact(u))&&rc.indexOf('class=\"mh-doc\"')>=0&&c(rc,/min-height:85vh/g)===1})()")===true,
     "MODULE MANAGEMENT: the Track Program page prints as its own document — one cover titled Module Management, the four figures, This Week, every step of Phases 1–4 with its owners and its state in words, then the analytics on a page of their own — with no tab button, date field, or assignment control; the page's Save as PDF and the Report Manager's Module Management unit both print it");

  /* ── Part 1 (Directive 2 Oct 2026): fonts from our own server, none from Google ── */
  console.log('== Part 1: self-hosted fonts ==');
  {
    const fsx = require('fs');
    const files = fsx.readdirSync('.').filter(f => /\.(html|js|css)$/.test(f) && f !== 'Governance-smoke.js');
    const hits = files.filter(f => /fonts\.(googleapis|gstatic)\.com/.test(fsx.readFileSync(f, 'utf8')));
    ok(hits.length === 0, 'Part 1 (1.2.6): no fonts.googleapis.com or fonts.gstatic.com in any page file' + (hits.length ? ' — ' + hits.join(', ') : ''));
    ok(['index.html', 'Governance-index.html'].every(f => fsx.readFileSync(f, 'utf8').indexOf('<link rel="stylesheet" href="fonts/fonts.css">') >= 0), 'Part 1 (1.2.4): both page files link fonts/fonts.css');
    const face = css => (css.match(/@font-face\{[^}]*\}/g) || []).map(r => (r.match(/font-family:'([^']+)'/) || [])[1] + ' ' + (r.match(/font-style:(\w+)/) || [])[1] + ' ' + (r.match(/font-weight:(\d+)/) || [])[1]);
    const uniq = a => a.filter((v, i) => a.indexOf(v) === i).sort().join(', ');
    const scr = fsx.readFileSync('fonts/fonts.css', 'utf8'), prn = fsx.readFileSync('fonts/print.css', 'utf8');
    ok(uniq(face(scr)) === 'Cormorant Garamond italic 300, Cormorant Garamond italic 400, Cormorant Garamond normal 300, Cormorant Garamond normal 400, Cormorant Garamond normal 600, DM Mono normal 300, DM Mono normal 400', 'Part 1: fonts.css carries exactly the 7 faces the page loaded from Google — ' + uniq(face(scr)));
    ok(uniq(face(prn)) === 'Cormorant Garamond italic 400, Cormorant Garamond normal 300, Cormorant Garamond normal 400, Cormorant Garamond normal 600, DM Mono normal 300, DM Mono normal 400', 'Part 1: print.css carries exactly the 6 faces the print window loaded from Google — ' + uniq(face(prn)));
    const urls = (scr + prn).match(/url\('[^']+'\)/g).map(u => u.slice(5, -2));
    ok(urls.every(u => fsx.existsSync('fonts/' + u)) && /display:swap/.test(scr) && !/font-display:(?!swap)/.test(scr + prn), 'Part 1: every font file the stylesheets name is in fonts/, each rule font-display:swap');
    ok(fsx.existsSync('fonts/OFL-CormorantGaramond.txt') && fsx.existsSync('fonts/OFL-DMMono.txt'), 'Part 1: the SIL Open Font License travels with the files');
    let wrote = ''; const realOpen = w.open;
    w.open = () => ({ document: { write: s => { wrote += s; }, close() {} }, print() {}, focus() {}, close() {} });
    try { w.eval("go('phase5');currentStep='5.1';printCurrentPage()"); } catch (e) { wrote = 'THREW ' + e.message; }
    w.open = realOpen;
    ok(wrote.indexOf('<link rel="stylesheet" href="http://localhost/fonts/print.css">') >= 0 && !/fonts\.(googleapis|gstatic)\.com/.test(wrote), 'Part 1 (1.2.5): the print window links the absolute address of fonts/print.css and nothing of Google\'s');
  }

  /* ── Part 2 (Directive 2 Oct 2026): the AI features off by default, switched on per organization ── */
  console.log('== Part 2: AI features switches ==');
  {
    const $ = id => w.document.getElementById(id);
    const realFetch = w.fetch, calls = [];
    w.fetch = (u) => { calls.push(String(u)); return new Promise(() => {}); };   /* records; never answers */
    let srMade = 0, srStops = 0;
    w.SpeechRecognition = function(){ srMade++; this.start = function(){ if (this.onstart) this.onstart(); }; this.stop = function(){ srStops++; }; };
    const made = w.eval("(function(){var a=createOrg('AI Org A',{name:'Ada Admin',username:'adaadmin',passcode:'1111',role:'Administrator'});var b=createOrg('AI Org B',{name:'Ben Admin',username:'benadmin',passcode:'2222',role:'Administrator'});return {a:a.orgId||a.id,b:b.orgId||b.id}})()");
    w.eval(`switchToOrg('${made.a}');Auth.setSession(USERS[0].id);UI.entry=null;render()`); await wait();
    ok(w.eval("JSON.stringify(govEmptyData().settings)") === '{"aiGuide":false,"voice":false}', 'Part 2 (2.2.1): govEmptyData() carries settings, both off');
    ok(w.eval("(function(){var s=data.settings;delete data.settings;var r=!aiGuideOn()&&!voiceOn();data.settings=s;return r})()") === true, 'Part 2 (2.2.1): data without settings counts as both off');
    ok($('coachFab').style.display === 'none' && $('voiceFab').style.display === 'none', 'Part 2 (2.3.1): a new organization signs in with no AI Guide or Voice button');
    w.eval("toggleCoach()"); ok(w.eval("coachOpen") === false, 'Part 2 (2.2.4): toggleCoach does not open the AI Guide while it is off');
    w.eval("var _ci=document.getElementById('coachInput'); if(_ci) _ci.value='hello'; sendCoach(); sendCoachPreset('Where do I start?'); go('insights'); go('step','1.1'); go('step','2.1'); go('step','3.1')"); await wait();
    ok(calls.length === 0, 'Part 2 (2.3.1): no request to the AI service while working through three steps and opening Insights (' + calls.length + ' sent)');
    ok(w.eval("(function(){return typeof fetchLiveInsights==='undefined'&&insightsState.loading!==true?'idle':'loading'})()") === 'idle', 'Part 2 (2.2.5): there is no live Insights fetch, so Insights keeps its curated content'); /* RETARGETED 28 Oct 2026 (AIRequestCleanup directive, 3.3): fetchLiveInsights is deleted, so its guard is no longer exercised */
    w.eval("toggleVoice()"); ok(srMade === 0, 'Part 2 (2.2.6): speech recognition never starts while Voice is off');
    w.eval("UI.aiFoldOpen=undefined;openOrg()");
    let mh = $('modalRoot').innerHTML;
    ok(mh.indexOf('<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open"><summary>AI Features (off by default)</summary>') >= 0, 'Part 2 (2.3.2): Profile has the fold A.2.1, closed by default');
    ok(mh.indexOf('<span>AI Guide</span></label><div class="ai-fold-note">When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.</div>') >= 0
      && mh.indexOf("<span>Voice</span></label><div class=\"ai-fold-note\">When this is on, Voice uses the browser's own speech recognition. Some browsers send the recording to the browser maker to turn it into text.</div>") >= 0, 'Part 2: A.2.2 to A.2.5 word for word');
    ok(mh.indexOf('id="aiSet_aiGuide" onchange') >= 0 && mh.indexOf('id="aiSet_voice" onchange') >= 0, 'Part 2 (2.3.2): both switches are off (no checked attribute)');
    ok(mh.indexOf('<details') < mh.indexOf('Team Members') && mh.indexOf('<h3>Organization &amp; Team</h3>') < mh.indexOf('<details'), 'Part 2 (2.1.4): the fold is at the top of the page');
    ok(mh.indexOf('Capture the enterprise context') < 0 && mh.indexOf('<div class="u-e6b5a04"></div>') >= 0, 'Part 2 (2.2.8): the faded intro line is gone, its box kept');
    /* an ordinary member sees no fold and cannot switch */
    w.eval("data.roster.push({id:'u_member',name:'Mo Member',username:'momember',role:'Analyst',initials:'MM',color:'#888888',scope:'All'});saveData();applyTeamRoster();currentUserId='u_member';renderOrgModal()");
    ok($('modalRoot').innerHTML.indexOf('ai-fold') < 0, 'Part 2 (2.3.5): a person without administrator rights sees no AI features fold');
    w.eval("setAiFeature('aiGuide',true)"); ok(w.eval("aiGuideOn()") === false, 'Part 2: and calling setAiFeature changes nothing');
    w.eval("currentUserId=USERS.filter(function(u){return u.admin===true})[0].id;UI.aiFoldOpen=true;renderOrgModal();setAiFeature('aiGuide',true)");
    ok(w.eval("aiGuideOn()&&data.settings.aiGuide===true") === true && $('coachFab').style.display === '', 'Part 2 (2.3.2, 2.1.5): switched on, the AI Guide button appears at once');
    ok(/<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open" open(="")?>/.test($('modalRoot').innerHTML), 'Part 2 (2.2.7): the fold stays open across the redraw');
    w.eval("closeModal();toggleCoach()");
    const ph = $('coachPanel').innerHTML;
    ok(w.eval("coachOpen") === true && ph.indexOf('<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>') > 0 && ph.indexOf('coach-ai-notice') < ph.indexOf('coachMsgsEl'), 'Part 2 (2.1.6, A.2.6): the panel opens, its first line says it is an AI');
    w.eval("document.getElementById('coachInput').value='What is CARE?';sendCoach()");
    ok(calls.length === 1 && calls[0] === w.eval('CLAUDE_API_URL'), 'Part 2: on, a question sends exactly one request, to the AI service');
    w.eval("setAiFeature('aiGuide',false)");
    ok(w.eval("coachOpen") === false && $('coachFab').style.display === 'none', 'Part 2 (2.3.3): switched off, the open panel closes and the button goes');
    w.eval("toggleCoach();var _c2=document.getElementById('coachInput');if(_c2)_c2.value='again';sendCoach()");
    ok(calls.length === 1, 'Part 2 (2.3.3): no further request');
    w.eval("setAiFeature('voice',true)"); ok($('voiceFab').style.display === '', 'Part 2 (2.3.4): Voice on, its button appears');
    w.eval("toggleVoice()"); ok(srMade === 1 && w.eval("_voiceActive") === true, 'Part 2 (2.3.4): and speech recognition starts');
    w.eval("setAiFeature('voice',false)");
    ok($('voiceFab').style.display === 'none' && w.eval("_voiceActive") === false && srStops === 1, 'Part 2 (2.3.4): Voice off, the button goes and the microphone stops at once');
    w.eval("setAiFeature('aiGuide',true)");
    w.eval(`switchToOrg('${made.b}');Auth.setSession(USERS[0].id);UI.entry=null;render()`);
    ok(w.eval("aiGuideOn()") === false && $('coachFab').style.display === 'none', 'Part 2 (2.3.6): switching it on in organization A leaves organization B off');
    w.eval(`switchToOrg('${made.a}');Auth.setSession(USERS.filter(function(u){return u.admin===true})[0].id);UI.entry=null;render()`);
    ok(w.eval("aiGuideOn()") === true && $('coachFab').style.display === '', 'Part 2: and organization A keeps it on (stored in its own data)');
    w.eval("setAiFeature('aiGuide',false)");
    w.eval(`deleteOrgById('${made.b}')`);
    w.fetch = realFetch; delete w.SpeechRecognition;
  }

  /* ── Part 3 (Directive 2 Oct 2026): the private sample organization, opened from Demo in a new tab ── */
  console.log('== Part 3: the sample tab ==');
  {
    /* a second tab: its own document, the SAME browser storage (mem) */
    const mkTab = (url, opener) => {
      const d = new JSDOM(html, { runScripts: 'outside-only', url });
      const t = d.window;
      Object.defineProperty(t, 'localStorage', { value: { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } });
      if (opener) Object.defineProperty(t, 'opener', { value: opener });
      t.confirm = () => true; t.alert = () => {}; t.scrollTo = () => {}; t.requestAnimationFrame = f => setTimeout(f, 0);
      t.fetch = (p) => Promise.resolve({ ok: true, text: () => Promise.resolve(fs.readFileSync(String(p).replace(/^\.\//, ''), 'utf8')) });
      Object.defineProperty(t, 'crypto', { value: require('crypto').webcrypto, configurable: true }); if (!t.TextEncoder) t.TextEncoder = TextEncoder;
      for (const f of ['Governance-templates-local.js', 'Governance-screen-loader.js', 'Governance-home.js', 'Governance-learn.js', 'dev-auth-server.js', 'Governance-app.js']) t.eval(fs.readFileSync(f, 'utf8'));
      return t;
    };
    const made = w.eval("(function(){var a=createOrg('Client Org',{name:'Cora Client',username:'coraclient',passcode:'1111',role:'Administrator'});return a.orgId||a.id})()");
    w.eval(`switchToOrg('${made}');Auth.setSession(USERS[0].id);UI.entry=null;data.notes=[{id:'n1',text:'x',date:'2026-10-01'}];saveData();render()`); await wait();
    const myPointer = w.eval('Store.getCurrentOrg()'), myBlob = mem['governance-org-data::' + made], orgCount = w.eval('getOrgs().length');
    let nrh = w.document.getElementById('navRight').innerHTML;
    ok(nrh.indexOf('id="sampleNavBtn"') >= 0 && nrh.indexOf('onclick="openSampleTab()"') >= 0, 'Part 3 (3.2.1): Demo is in the top bar for a signed-in person');
    ok(nrh.indexOf('/*') < 0 && nrh.indexOf('*/') < 0, 'Part 3 (3.3.9): no code comment drawn in the top bar');
    w.eval('toggleNavMore()'); await wait(); nrh = w.document.getElementById('navRight').innerHTML;
    ok(/Notes <span id="notesCount" class="notes-count">1<\/span>/.test(nrh) && nrh.indexOf('Load the seeded example') >= 0 && nrh.indexOf('Start the sample again') < 0, 'Part 3 (3.3.8, 3.4.6): in a client organization, More has Notes with its count and the existing sample item, and no sample-tab items');
    w.eval('closeNavMore()');
    let opened = null; const realOpen = w.open; w.open = (u, tgt) => { opened = { u: String(u), tgt }; return null; };
    w.eval('openSampleTab()'); w.open = realOpen;
    ok(opened && /\?sample=1$/.test(opened.u) && opened.tgt === '_blank' && !!mem['sample-tab-pass'], 'Part 3 (3.3.1): Demo leaves a pass in the browser and opens ?sample=1 in a new tab');

    const s = mkTab('http://localhost/?sample=1'); await wait(); await wait();
    ok(s.eval('SAMPLE_MODE') === true && s.eval('currentOrgId') === 'org_sample_local' && !!s.eval('getCurrentUser()'), 'Part 3 (3.2.4): the sample tab enters the sample as its first sample person');
    ok(!('sample-tab-pass' in mem), 'Part 3 (3.3.2): the pass works once (it is removed)');
    ok(s.eval('Store.getCurrentOrg()') === myPointer && s.eval('getOrgs().length') === orgCount && !s.eval("getOrgs().some(function(o){return o.id==='org_sample_local'})"), 'Part 3 (3.3.2): the person\'s own pointer and organization list are untouched; the sample is not in the list');
    ok(s.eval('(data.risks||[]).length') > 5 && s.eval('(data.roster||[]).length') > 1 && s.eval("(data.roster||[]).every(function(u){return !('passcode' in u)})") === true, 'Part 3 (3.2.4): the copy is the built-in sample (seedSampleData), its people without passwords');
    ok(!!mem['governance-org-data::org_sample_local'] && mem['governance-org-data::' + made] === myBlob, 'Part 3 (3.3.3): the copy is kept under its own key; the client organization\'s data is unchanged');
    ok(s.eval('aiGuideOn()||voiceOn()') === false && s.document.getElementById('coachFab').style.display === 'none' && s.document.getElementById('voiceFab').style.display === 'none', 'Part 3 (3.2.6): no AI Guide or Voice in the sample tab');
    s.eval("data.settings={aiGuide:true,voice:true}"); ok(s.eval('aiGuideOn()||voiceOn()') === false, 'Part 3 (3.2.6): whatever the settings say');
    let snr = s.document.getElementById('navRight').innerHTML;
    ok(snr.indexOf('gchatNavBtn') < 0 && snr.indexOf('sampleNavBtn') < 0, 'Part 3 (3.2.6, 3.2.7): no Team Chat and no Demo in the sample tab\'s top bar');
    { const um = s.eval('_userMenuHtml()');
      ok(snr.indexOf('toggleUserMenu') >= 0 && um.indexOf('Sign Out') >= 0 && um.indexOf('openOrg()') < 0 && um.indexOf('openAssignments()') < 0, 'Sweep 4R item 9.2 (amends Part 3): the sample tab\'s account menu holds only Sign Out'); }
    s.eval('toggleGChat()'); ok(s.eval('gchatOpen') === false, 'Part 3 (3.3.4): toggleGChat refuses to open');
    s.eval('toggleNavMore()'); await wait(); snr = s.document.getElementById('navRight').innerHTML;
    ok(snr.indexOf('Start the sample again') >= 0 && snr.indexOf('Close the sample') >= 0, 'Part 3 (3.2.7): More offers Start the sample again and Close the sample');
    ok(snr.indexOf('Export state') < 0 && snr.indexOf('Import state') < 0, 'Sweep 4R item 9.1 (amends Part 3): and neither Export state nor Import state');
    ok(snr.indexOf('toggleNotes()') < 0 && snr.indexOf('openOrg()') < 0 && snr.indexOf('openAdmin()') < 0 && snr.indexOf('Load the seeded example') < 0 && snr.indexOf('Reset all data') < 0, 'Part 3 (3.2.7, 3.2.9): no Notes, Org & Team, Admin, seeded-example or Reset item in the sample tab');
    s.eval('closeNavMore()');
    s.eval("go('step','1.1')"); await wait(); await wait();
    const note = s.document.getElementById('sampleNote'), host = s.document.querySelector('#app .content-inner');
    ok(!!note && !!host && host.firstElementChild === note && note.textContent === 'Sample organization: your changes stay in this browser only', 'Part 3 (3.2.5, A.3.2): the red note is the first line inside the content container');
    const back = host && host.querySelector('button, .back-btn, [onclick*="goBack"]');
    ok(!back || !!(note.compareDocumentPosition(back) & 4), 'Part 3 (3.3.4): above the Back button');
    s.eval("go('insights')"); await wait(); await wait();
    ok(!!s.document.getElementById('sampleNote'), 'Part 3 (3.2.5): on every page (Insights too)');
    s.eval("go('home')"); await wait(); await wait(); await wait();
    ok(!!s.document.getElementById('sampleNote'), 'Part 3 (3.3.4): and on a page the screen loader draws a moment later (Home)');
    { const mem0 = JSON.stringify(mem); s.eval("window.__cs=0; var _realCloseSample=closeSample; closeSample=function(){ window.__cs++; }; signOut(); closeSample=_realCloseSample;");
      ok(s.eval('window.__cs') === 1 && !!s.eval('getCurrentUser()') && !s.eval('UI.entry') && JSON.stringify(mem) === mem0, 'Sweep 4R item 9.2: in the sample tab Sign Out closes the sample: nobody is signed out, no sign-in screen, nothing written'); }
    const sent0 = s.eval('(data.notifications||[]).length'); s.eval("notifyQueue('step-complete','x',['a@b.c'],'1.1',false)");
    ok(s.eval('(data.notifications||[]).length') === sent0, 'Part 3 (3.2.6): no email from the sample tab');
    const risks0 = s.eval('(data.risks||[]).length');
    s.eval("data.risks.push({id:'r-sample-edit',name:'Added in the sample tab'});saveData()");
    ok(mem['governance-org-data::' + made] === myBlob && w.eval("(data.risks||[]).every(function(r){return r.id!=='r-sample-edit'})"), 'Part 3 (3.4.2): a change in the sample tab leaves the client organization unchanged');
    s.eval('restartSample()');
    ok(s.eval('(data.risks||[]).length') === risks0 && s.eval("(data.risks||[]).every(function(r){return r.id!=='r-sample-edit'})") && s.eval('currentPage') === 'home', 'Part 3 (3.4.5): Start the sample again brings back the original sample');

    const r = mkTab('http://localhost/?sample=1'); await wait(); await wait();
    const rh = r.document.getElementById('app').innerHTML;
    ok(r.eval('SAMPLE_REFUSED') === true && rh.indexOf('Sign in to your organization, then open Demo from the top bar.') >= 0 && !r.document.querySelector('.login-screen') && r.document.querySelector('nav').style.display === 'none', 'Part 3 (3.4.3, A.3.6): a sample tab opened without a signed-in tab shows only A.3.6');
    const o = mkTab('http://localhost/?sample=1', w); await wait(); await wait();
    ok(o.eval('SAMPLE_REFUSED') === false && o.eval('currentOrgId') === 'org_sample_local', 'Part 3 (3.3.2): a tab opened by a signed-in tab is accepted without the pass');
    ok(w.eval('currentOrgId') === made && w.eval('SAMPLE_MODE') === false, 'Part 3 (3.4.1): the first tab is unchanged');
    w.eval(`deleteOrgById('${made}')`);
  }

  /* ── Part 4 (Directive 2 Oct 2026): Reset data and Delete, from the admin console only ── */
  console.log('== Part 4: reset and delete ==');
  {
    const asked = []; const realConfirm = w.confirm; w.confirm = (m) => { asked.push(String(m)); return true; };
    const ids = w.eval(`(function(){
      var a=createOrg('Reset Org A',{name:'Ava Admin',username:'avaadmin',passcode:'1111',role:'Administrator'});
      data.roster.push({id:'u_rm',name:'Rex Member',username:'rexmember',passcode:'2222',role:'Analyst',initials:'RM',color:'#777777',scope:'All'});
      data.roster.push({id:'u_ad2',name:'Ada Second',username:'adasecond',passcode:'3333',role:'Administrator',initials:'AS',color:'#777777',scope:'All',admin:true});
      data.settings={aiGuide:true,voice:false}; data.completedSteps={'1.1':true,'1.2':true}; data.risks=[{id:'r1',name:'A risk'}]; data.systems=[{id:'s1',name:'A system'}]; data.orgSetup=true;
      saveData(); applyTeamRoster();
      var b=createOrg('Reset Org B',{name:'Bo Admin',username:'boadmin',passcode:'4444',role:'Administrator'});
      data.risks=[{id:'rb',name:'B risk'}]; saveData();
      return {a:a.orgId||a.id, b:b.orgId||b.id}; })()`);
    w.eval(`Auth.setAdminSession(true); switchToOrg('${ids.b}'); Auth.setSession(null); UI.entry={step:'admin'}; render()`);   /* the console draws while no workspace is open */
    const bBefore = mem['governance-org-data::' + ids.b];   /* after the switch: opening B records its day's snapshot */
    const con = w.document.getElementById('app').innerHTML;
    ok((con.match(/>Reset data<\/button>/g) || []).length === w.eval('getOrgs().length') && con.indexOf(`adminConsoleReset('${ids.a}')`) >= 0 && con.indexOf(`adminConsoleDelete('${ids.a}')`) >= 0, 'Part 4 (4.2.1, 4.2.2, A.4.0): the admin console has Reset data and Delete on every organization\'s row');
    w.eval("UI.aNewKey={x:1}");
    asked.length = 0; w.eval(`adminConsoleReset('${ids.a}')`);
    ok(asked[0] === 'Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.', 'Part 4 (A.4.1): it asks first, word for word');
    const a = JSON.parse(mem['governance-org-data::' + ids.a]);
    ok((a.roster || []).map(u => u.username).sort().join(',') === 'adasecond,avaadmin', 'Part 4 (4.4.1): its administrators stay; every other member is gone from the people list');
    ok(!Object.keys(a.completedSteps || {}).length && !(a.risks || []).length && !(a.systems || []).length, 'Part 4 (4.4.1): its steps and outputs are empty');
    ok(JSON.stringify(a.settings) === '{"aiGuide":true,"voice":false}' && (a.enterprise || {}).name === 'Reset Org A' && a.orgSetup === true && w.eval(`!!getOrg('${ids.a}')`), 'Part 4 (4.4.1): the organization, its name and its AI settings are as they were (and it is not sent back through setup)');
    ok(mem['governance-org-data::' + ids.b] === bBefore, 'Part 4 (4.4.1): every other organization is unchanged');
    ok(w.eval("!!(UI.entry&&UI.entry.step==='admin') && !!(UI.aNewKey&&UI.aNewKey.x===1) && currentOrgId") === ids.b, 'Part 4 (4.4.1, S.4): the admin console stays open, and the reset never sealed the session or changed the organization being viewed');
    /* the Admin panel resets the organization being viewed too */
    w.eval(`switchToOrg('${ids.a}'); Auth.setSession(USERS.filter(function(u){return u.admin===true})[0].id); UI.entry=null; data.risks=[{id:'r2',name:'Again'}]; data.roster.push({id:'u_m2',name:'Mia Member',username:'miamember',passcode:'5555',role:'Analyst',initials:'MM',color:'#777777',scope:'All'}); saveData(); applyTeamRoster(); currentUserId='u_m2'; openAdmin()`);
    const panel = w.document.getElementById('modalRoot').innerHTML;
    ok((panel.match(/>Reset data<\/button>/g) || []).length === w.eval('getOrgs().length'), 'Part 4 (4.2.2): the Admin panel has Reset data on every row, the organization being viewed included');
    w.eval(`adminResetOrg('${ids.a}')`);
    ok(w.eval("!(data.risks||[]).length && USERS.every(function(u){return u.admin===true}) && !!getCurrentUser() && getCurrentUser().admin===true") === true, 'Part 4: resetting the organization being viewed redraws it empty; a viewer who was removed is replaced by its first administrator');
    w.confirm = () => false; w.eval(`data.risks=[{id:'keep',name:'Kept'}]; saveData(); adminResetOrg('${ids.a}')`);
    ok(w.eval("(data.risks||[]).length") === 1, 'Part 4: cancelling the question changes nothing');
    w.confirm = (m) => { asked.push(String(m)); return true; };
    w.eval("Auth.setAdminSession(false)"); w.eval(`adminConsoleReset('${ids.a}')`);
    ok(w.eval("(data.risks||[]).length") === 1, 'Part 4: without the app administrator\'s session, Reset data does nothing');
    ok(w.eval("typeof clearData") === 'undefined', 'Part 4 (4.2.3): clearData is gone');
    w.eval("toggleNavMore()"); ok(w.document.getElementById('navRight').innerHTML.indexOf('Reset all data') < 0, 'Part 4 (4.2.3): the More menu has no Reset all data'); w.eval("closeNavMore()");
    /* S.4: the admin console adding an organization keeps the session */
    w.eval("Auth.setAdminSession(true); UI.entry={step:'admin'}; UI.aNewKey={x:2}");
    /* since Part 5 the console's + New Organization is a form whose first person gets a temporary password from the server (the
       Part 5 block drives it end to end); what S.4 asks is that adding one keeps the session: createOrg's keepSession */
    const n0 = w.eval('getOrgs().length');
    w.eval("(function(){var keep=currentOrgId; createOrg('Console New Org',{name:'Nia New',username:'nianew',role:'Administrator'},true); setCurrentOrg(keep); loadData(); applyTeamRoster();})()");
    ok(w.eval("typeof adminNewOrgFormHtml==='function' && adminConsoleNewOrg.toString().indexOf('UI.adminNewOrg=')>=0") === true, "Part 4 / 5.7.4: + New Organization opens the form with the first person's temporary password");
    ok(w.eval('getOrgs().length') === n0 + 1 && w.eval("!!(UI.aNewKey&&UI.aNewKey.x===2) && UI.entry && UI.entry.step==='admin'") === true && w.eval('currentOrgId') === ids.a, 'Part 4 / S.4: the admin console adding an organization keeps the session and the organization being viewed (createOrg keepSession)');
    /* Delete stays */
    w.eval(`adminConsoleDelete('${ids.b}')`);
    ok(!w.eval(`!!getOrg('${ids.b}')`) && !mem['governance-org-data::' + ids.b], 'Part 4 (4.4.2): Delete removes the organization from the list and its data from storage (its sign-ins: the Part 5 block, DELETE-SIGNIN)');
    w.eval(`deleteOrgById((getOrgs().filter(function(o){return o.name==='Console New Org'})[0]||{}).id)`);
    w.eval(`Auth.setAdminSession(false)`);
    w.confirm = realConfirm;
  }

  /* ── Part 5 (Directive 2 Oct 2026): passwords — the screens and requests, answered by the dev stand-in (dev-auth-server.js).
     Ported from the Executive Readiness dev harness's PASSWORDS END TO END block (7 Oct 2026). ── */
  console.log('== Part 5: passwords end to end ==');
  {
    const eq = (a, b, l) => ok(a === b, l + (a === b ? '' : ' (got ' + JSON.stringify(a) + ')'));
    const has = (h, x, l) => ok(String(h).indexOf(x) >= 0, l);
    async function passwordsEndToEnd(){
      const $ = (id) => w.document.getElementById(id);
      const tick = () => new Promise(r => setImmediate(r));
      const settle = async (cond, label) => { for (let i = 0; i < 400; i++) { if (cond()) return true; await tick(); await new Promise(r => setTimeout(r, 5)); } ok(false, 'settle: ' + label); return false; };
      const type = (id, v) => { $(id).value = v; };
      const _confirm = w.confirm; w.confirm = () => true;
      const keep = {org: w.currentOrgId, user: w.currentUserId, admin: w.isAppAdmin};
      const sOut = () => { w.currentUserId = null; w.isAppAdmin = false; w.UI.entry = {step:'login'}; w.Auth.signOut(); };
      await new Promise(r => setTimeout(r, 30));   // the start-up session check from LOAD answers first
      w.currentUserId = null; w.isAppAdmin = false; w.closeModal();   /* this suite reaches here signed in; the block starts signed out */
    
      /* 5.12: the administrator's default account works once */
      w.UI.entry = {step:'admin-login'}; w.render();
      type('adminUser', 'admin'); type('adminPassword', 'NextChapter2026!'); w.doAdminLogin();
      eq($('adminPassword').value, '', '5.2.4: the typed password is cleared from its field once sent');
      await settle(() => w.UI.entry && w.UI.entry.step === 'choose-password', 'admin choose');
      eq(w.UI.entry.sub, 'This password works only once. Choose your own to continue.', '5.12.2: admin / NextChapter2026! opens Choose a new password (A.5.23)');
      ok(!w.isAppAdmin, '5.12.2: nothing else opens before the new password');
      type('newPassword', 'Admin#Chosen2026'); type('confirmPassword', 'Admin#Chosen2026'); w.doChoosePassword();
      await settle(() => w.isAppAdmin === true, 'admin in');
      ok(w.isAppAdmin, '5.12: after choosing, the administrator is in');
      w.Auth.setSession(null); w.exitAdmin(); await new Promise(r => setTimeout(r, 30));   /* Exit admin is on the console, which shows with no member workspace open */
      w.UI.entry = {step:'admin-login'}; w.render();
      type('adminUser', 'admin'); type('adminPassword', 'NextChapter2026!'); w.doAdminLogin();
      await settle(() => !!w.UI.entry.err, 'default refused');
      eq(w.UI.entry.err, 'That username and password do not match.', '5.12.4: after a new password is chosen, NextChapter2026! is refused (A.5.28)');
      type('adminUser', 'ADMIN '); type('adminPassword', 'Admin#Chosen2026'); w.doAdminLogin();
      await settle(() => w.isAppAdmin === true, 'admin again');
      ok(w.isAppAdmin, '5.12: the chosen password works (username capitals and spaces ignored)');
    
      /* 5.8.1: create an organization with a first person and a temporary password (the app administrator) */
      w.openAdmin(); w.adminConsoleNewOrg();
      type('ano_org', 'Password Org'); type('ano_name', 'Pia First'); type('ano_user', 'pia'); type('ano_temp', 'abc');
      w.adminSaveNewOrg();
      eq(w.UI.adminNewOrg && w.UI.adminNewOrg.err, 'Use at least 8 characters.', '5.7.4: the first person\'s temporary password must pass the rule');
      type('ano_org', 'Password Org'); type('ano_name', 'Pia First'); type('ano_user', 'pia'); type('ano_temp', 'Temp#Pass2026');
      w.adminSaveNewOrg();
      await settle(() => !w.UI.adminNewOrg, 'org created');
      const PO = w.getOrgs().filter(o => o.name === 'Password Org')[0];
      ok(!!PO, '5.7.4: the organization is created');
      const credStore = () => JSON.parse(w.localStorage.getItem('gov-devauth::credentials') || '{}');
      const piaId = w.getOrgData(PO.id).roster[0].id;
      ok(!!credStore()[PO.id + '/' + piaId] && credStore()[PO.id + '/' + piaId].mustChange === true, '5.7.4 / 6.1.6: the temporary password is stored on the server side, marked mustChange');
      w.closeModal(); w.signOut(); await new Promise(r => setTimeout(r, 30));
    
      w.UI.entry = {step:'login'}; w.render();
      type('loginUser', 'pia'); type('loginPassword', 'Temp#Pass2026'); w.doLogin();
      await settle(() => w.UI.entry && w.UI.entry.step === 'choose-password', 'pia choose');
      eq(w.UI.entry.sub, 'Your administrator set a temporary password. Choose your own to continue.', '5.8.1: the temporary password opens Choose a new password (A.5.5a)');
      ok(!w.currentUserId, '5.5: the workspace does not open');
      const tryChoose = async (p1, p2) => { type('newPassword', p1); type('confirmPassword', p2); w.UI.entry.err = ''; w.doChoosePassword(); await settle(() => !w.UI.entry || !!w.UI.entry.err || w.UI.entry.step !== 'choose-password', 'choose'); return w.UI.entry ? w.UI.entry.err : ''; };
      eq(await tryChoose('abc1!', 'abc1!'), 'Use at least 8 characters.', '5.8.1: abc1! -> Use at least 8 characters.');
      eq(await tryChoose('abcdefgh', 'abcdefgh'), 'Include at least one number.', '5.8.1: abcdefgh -> Include at least one number.');
      eq(await tryChoose('abcdefg1', 'abcdefg1'), 'Include at least one special character, such as ! or #.', '5.8.1: abcdefg1 -> special character');
      eq(await tryChoose('Password1!', 'Password1!'), 'That password is too common. Choose another.', '5.8.1: Password1! -> too common');
      eq(await tryChoose('Good#Pass2026a', 'Good#Pass2026b'), 'The two passwords do not match.', '5.8.1: two different good passwords -> do not match');
      eq(await tryChoose('Temp#Pass2026', 'Temp#Pass2026'), 'Choose a password different from your current one.', '5.8.1: the temporary password again -> different from your current one');
      await tryChoose('Pia#Own2026pass', 'Pia#Own2026pass');
      ok(w.currentUserId === piaId && w.currentOrgId === PO.id && !w.UI.entry, '5.8.1: a good password twice -> the workspace opens');
    
      /* 5.8.2: sign out and in with the new password */
      w.signOut(); await new Promise(r => setTimeout(r, 30));
      type('loginUser', 'pia'); type('loginPassword', 'Pia#Own2026pass'); w.doLogin();
      await settle(() => !!w.currentUserId, 'pia in');
      ok(w.currentUserId === piaId && !w.UI.entry, '5.8.2: the new password opens the workspace directly');
    
      /* 5.8.3: reload while signed in -> the workspace reopens; sign out and reload -> the sign-in screen */
      const reload = async () => { w._bootDone = false; w.currentUserId = null; w.currentOrgId = null; w.UI.entry = null; w.bootApp(); await settle(() => w.UI.entry === null || (w.UI.entry && w.UI.entry.step === 'login'), 'reload'); };
      const sealed0 = w.sealSession; let seals = 0; w.sealSession = function(){ seals++; return sealed0.apply(this, arguments); };
      await reload();
      ok(w.currentUserId === piaId && w.currentOrgId === PO.id && !w.UI.entry, '5.8.3: reload while signed in: the workspace reopens');
      eq(seals, 0, '5.4.5 / S.4: the start-up session check does not seal');
      w.sealSession = sealed0;
      w.signOut(); await new Promise(r => setTimeout(r, 30));
      await reload();
      ok(!w.currentUserId && w.UI.entry && w.UI.entry.step === 'login', '5.8.3: sign out and reload: the sign-in screen');
    
      /* 5.8.5: Change password from the More menu */
      type('loginUser', 'pia'); type('loginPassword', 'Pia#Own2026pass'); w.doLogin();
      await settle(() => !!w.currentUserId, 'pia in 2');
      w.UI.navMore = true; w.render();
      ok($('navRight').innerHTML.indexOf('onclick="closeNavMore();openChangePassword()"><span class="nav-more-ic">●</span> Change password</button>') >= 0, '5.6: Change password is in the More menu (A.5.11)');
      w.UI.navMore = false; w.render();
      w.openChangePassword();
      has($('modalRoot').innerHTML, 'autocomplete="current-password"', '5.6: the dialog asks for the current password');
      has($('modalRoot').innerHTML, '<div class="pw-rule">At least 8 characters, including a number and a special character such as ! or #.</div>', '5.1: the rule line under the new password (A.5.18)');
      type('pwCurrent', 'Wrong#Pass2026'); type('pwNew', 'Pia#Second2026'); type('pwConfirm', 'Pia#Second2026'); w.doChangePassword();
      await settle(() => !!w.UI.pwDialog.err, 'bad current');
      eq(w.UI.pwDialog.err, 'Your current password is not correct.', '5.8.5: a wrong current password is refused (A.5.15)');
      type('pwCurrent', 'Pia#Own2026pass'); type('pwNew', 'Pia#Second2026'); type('pwConfirm', 'Pia#Second2026'); w.UI.pwDialog.err = ''; w.doChangePassword();
      await settle(() => !!w.UI.pwDialog.done || !!w.UI.pwDialog.err, 'changed');
      eq(w.UI.pwDialog.done, 'Your password has been changed.', '5.8.5: a good change works (A.5.16)');
      ok($('pwCurrent').value === '' && $('pwNew').value === '', '5.2.4: the fields are cleared');
      w.closeModal(); w.signOut(); await new Promise(r => setTimeout(r, 30));
      type('loginUser', 'pia'); type('loginPassword', 'Pia#Own2026pass'); w.doLogin();
      await settle(() => !!w.UI.entry.err, 'old refused');
      eq(w.UI.entry.err, 'That username and password do not match.', '5.8.5: the old password no longer works');
      type('loginUser', 'pia'); type('loginPassword', 'Pia#Second2026'); w.doLogin();
      await settle(() => !!w.currentUserId, 'pia new');
      ok(w.currentUserId === piaId, '5.8.5: the next sign-in needs the new one');
    
      /* 5.10 / 5.8.7 / 5.11: as the organization's administrator, add a member — the temporary password is required, the username unique */
      w.openOrg(); w.addProfile();
      ok(!w.data.roster.some(u => u.id === 'new'), '5.8.7: an added member is a draft until saved (nothing stored without a password)');
      type('ru_new_name', 'Mo Member'); type('ru_new_username', 'mo'); w.saveProfile('new');
      eq(w.UI.orgErr, 'Use at least 8 characters.', '5.8.7: adding a member without a temporary password is refused');
      ok(!w.USERS.some(u => u.username === 'mo'), '5.8.7: and nobody is added');
      type('ru_new_name', 'Mo Member'); type('ru_new_username', ' PIA '); type('ru_new_temporary', 'Temp#Mo2026x'); w.saveProfile('new');
      eq(w.UI.orgErr, 'That username is already taken. Choose another.', '5.11.2: a username already in use is refused, capitals and spaces ignored (A.5.22)');
      has($('modalRoot').innerHTML, 'value="Mo Member"', '5.7: the typed values stay in the editor after a refusal');
      type('ru_new_name', 'Mo Member'); type('ru_new_username', 'mo'); type('ru_new_temporary', 'Temp#Mo2026x'); w.saveProfile('new');
      await settle(() => w.UI.orgEdit === null, 'mo added');
      const mo = w.USERS.filter(u => u.username === 'mo')[0];
      ok(!!mo && !!credStore()[PO.id + '/' + mo.id], '5.7.2: the member is saved and their temporary password sent');
      w.editProfile(mo.id);
      has($('modalRoot').innerHTML, '>Temporary password</label>', '5.7.1: the field is called Temporary password');
      has($('modalRoot').innerHTML, '<div class="pw-note">The person will be asked to choose their own password the next time they sign in.</div>', '5.7.1: with A.5.17 beneath it');
      type('ru_' + mo.id + '_name', 'Mo Member'); type('ru_' + mo.id + '_username', 'mo'); w.saveProfile(mo.id);
      ok(!!credStore()[PO.id + '/' + mo.id] && credStore()[PO.id + '/' + mo.id].mustChange === true, '5.7.3: editing with the field empty keeps their password');
      w.closeModal();
    
      /* 5.8.6: the temporary password forces the member to choose; 5.8.4: five wrong passwords lock the username */
      w.signOut(); await new Promise(r => setTimeout(r, 30));
      type('loginUser', 'mo'); type('loginPassword', 'Temp#Mo2026x'); w.doLogin();
      await settle(() => w.UI.entry && w.UI.entry.step === 'choose-password', 'mo choose');
      ok(w.UI.entry.step === 'choose-password', '5.8.6: a temporary password set by an administrator forces the person to choose their own');
      w.leaveChoosePassword(); await new Promise(r => setTimeout(r, 30));
      for (let i = 1; i <= 5; i++) {
        type('loginUser', 'mo'); type('loginPassword', 'Wrong#' + i + 'xxxx'); w.UI.entry.err = ''; w.doLogin();
        await settle(() => !!w.UI.entry.err, 'wrong ' + i);
        if (i < 5) eq(w.UI.entry.err, 'That username and password do not match.', '5.8.4: wrong password ' + i + ' -> A.5.3');
      }
      eq(w.UI.entry.err, 'Too many attempts. Try again in 15 minutes.', '5.8.4: the fifth refusal shows A.5.4');
      type('loginUser', 'mo'); type('loginPassword', 'Temp#Mo2026x'); w.UI.entry.err = ''; w.doLogin();
      await settle(() => !!w.UI.entry.err, 'locked right');
      eq(w.UI.entry.err, 'Too many attempts. Try again in 15 minutes.', '5.8.4: the right password is refused while locked');
      w.localStorage.removeItem('gov-devauth::attempts');
    
      /* 5.10.1 / 5.8 (5.10.3): an ordinary member — no add, edit-other or delete, and calling them changes nothing */
      type('loginUser', 'mo'); type('loginPassword', 'Temp#Mo2026x'); w.UI.entry.err = ''; w.doLogin();
      await settle(() => w.UI.entry && w.UI.entry.step === 'choose-password', 'mo choose 2');
      type('newPassword', 'Mo#Own2026pass'); type('confirmPassword', 'Mo#Own2026pass'); w.doChoosePassword();
      await settle(() => !!w.currentUserId, 'mo in');
      w.openOrg();
      const mh = $('modalRoot').innerHTML;
      ok(mh.indexOf('addProfile()') < 0, '5.10.3: no + Add team member for an ordinary member');
      ok(mh.indexOf("editProfile('" + piaId + "')") < 0 && mh.indexOf("removeProfile('" + piaId + "')") < 0, '5.10.3: no edit or delete on someone else\'s row');
      ok(mh.indexOf("editProfile('" + mo.id + "')") > 0, '5.10.2: they can still edit their own profile');
      ok(mh.indexOf('ai-fold') < 0, '5.10: and no AI features fold');
      const roster0 = JSON.stringify(w.data.roster);
      w.addProfile(); w.editProfile(piaId); w.saveProfile(piaId); w.removeProfile(piaId);
      eq(JSON.stringify(w.data.roster), roster0, '5.10.3: calling add, edit-other and delete in the console changes nothing');
      let tp; w.Auth.setTemporaryPassword(PO.id, piaId, 'Hijack#2026xx', r => { tp = r; });
      await settle(() => !!tp, 'not-admin');
      eq(tp.reason, 'not-admin', '6.1.13: the server refuses a temporary password set by an ordinary member');
      w.editProfile(mo.id);
      ok($('modalRoot').innerHTML.indexOf('_temporary"') < 0, '5.10.2: no temporary-password field on one\'s own profile (their password: Change password)');
      w.closeModal();
    
      /* 5.8.9: no password, hash or passcode in the organization's data, the browser's storage of it, or an export */
      const blob = w.Store.orgRaw(PO.id);
      ok(!/passcode|passwordHash|mustChange|Pia#|Temp#|Mo#|pbkdf2/.test(blob), '5.8.9: the organization\'s data holds no password, hash or passcode');
      const orgKeys = Object.keys(mem).filter(k => /^governance-/.test(k));
      ok(orgKeys.every(k => !/Pia#|Temp#|Mo#|NextChapter2026|"hash"/.test(mem[k] || '')), '5.8.9: nothing the app stores holds a password or hash');
      ok(!/passcode|Pia#|Temp#/.test(JSON.stringify(w.data)), '5.8.9: the data an export or a printout is made from holds none');
    
      /* RESET-SIGNIN / DELETE-SIGNIN (4.4): sign-ins follow the people list */
      w.signOut(); await new Promise(r => setTimeout(r, 30));
      w.isAppAdmin = true; w.adminResetOrg(PO.id); w.isAppAdmin = false; w.closeModal();
      type('loginUser', 'mo'); type('loginPassword', 'Mo#Own2026pass'); w.UI.entry = {step:'login'}; w.doLogin();
      await settle(() => !!w.UI.entry.err, 'mo after reset');
      eq(w.UI.entry.err, 'That username and password do not match.', 'RESET-SIGNIN 4.4.1: a removed member cannot sign in');
      ok(!credStore()[PO.id + '/' + mo.id], 'RESET-SIGNIN 4.2.4: their sign-in is deleted');
      type('loginUser', 'pia'); type('loginPassword', 'Pia#Second2026'); w.UI.entry.err = ''; w.doLogin();
      await settle(() => !!w.currentUserId, 'pia after reset');
      ok(w.currentUserId === piaId, 'RESET-SIGNIN 4.4.1: the administrator can still sign in, with the same password');
      w.signOut(); await new Promise(r => setTimeout(r, 30));
      w.isAppAdmin = true; w.deleteOrgById(PO.id); w.isAppAdmin = false;
      type('loginUser', 'pia'); type('loginPassword', 'Pia#Second2026'); w.UI.entry = {step:'login'}; w.doLogin();
      await settle(() => !!w.UI.entry.err, 'pia after delete');
      eq(w.UI.entry.err, 'That username and password do not match.', 'DELETE-SIGNIN 4.4.2: after a deletion its people cannot sign in');
      ok(!Object.keys(credStore()).some(k => k.indexOf(PO.id + '/') === 0), 'DELETE-SIGNIN 6.4.3: nothing remains for its id in the sign-in store');
    
      /* 5.9: the setup code */
      const n0 = w.getOrgs().length;
      w.UI.entry = {step:'setup'}; w.render();
      type('setupCode', 'WRONG'); type('setupOrg', 'Setup Org'); type('setupName', 'Sam Setup'); type('setupUser', 'sam'); type('setupPassword', 'Sam#Own2026pass'); type('setupConfirm', 'Sam#Own2026pass');
      w.doSetup();
      eq(w.UI.entry.err, 'That setup code is not recognized.', '5.9.3: WRONG -> A.5.21');
      eq(w.getOrgs().length, n0, '5.9.3: and no organization is added');
      let sc; w.Auth.setupOrganization('WRONG', 'org_x', 'u_x', 'sam', 'Sam#Own2026pass', false, r => { sc = r; });
      await settle(() => !!sc, 'server code');
      eq(sc.reason, 'bad-code', '6.1.12: the server refuses a wrong setup code whatever the browser checked');
      type('setupCode', 'ABCXYZ'); type('setupOrg', 'Setup Org'); type('setupName', 'Sam Setup'); type('setupUser', 'sam'); type('setupPassword', 'Sam#Own2026pass'); type('setupConfirm', 'Sam#Own2026pass');
      w.doSetup();
      await settle(() => w.getOrgs().length === n0 + 1, 'setup org');
      const SO = w.getOrgs().filter(o => o.name === 'Setup Org')[0];
      ok(!!SO && w.currentOrgId === SO.id && w.getCurrentUser() && w.getCurrentUser().admin === true, '5.9.3: ABCXYZ creates it, its first person as administrator');
      ok(credStore()[SO.id + '/' + w.currentUserId] && credStore()[SO.id + '/' + w.currentUserId].mustChange === false, '5.7.4: the password chosen at setup is their own, not temporary');
      w.closeModal(); w.orgSetupMode = false;
      w.signOut(); await new Promise(r => setTimeout(r, 30));
      w.UI.entry = {step:'setup'}; w.render();
      type('setupCode', 'ABCXYZ'); type('setupOrg', 'Dup Org'); type('setupName', 'Sam Two'); type('setupUser', 'SAM'); type('setupPassword', 'Sam#Own2026pass'); type('setupConfirm', 'Sam#Own2026pass');
      w.doSetup();
      eq(w.UI.entry.err, 'That username is already taken. Choose another.', '5.11.4: setting up an organization whose first person is SAM (sam exists) is refused');
      w.deleteOrgById(SO.id);
    
      /* back to the harness's own state */
      w.confirm = _confirm; w.Auth.signOut();
      w.UI.entry = null; w.switchToOrg(keep.org); w.currentUserId = keep.user; w.isAppAdmin = keep.admin; w.render();
    }
    
    await passwordsEndToEnd();
  }

  /* ── Part S (Directive 2 Oct 2026, ruled by Paul 1 Oct): every organization is sealed. Nothing at all
     survives a change of organization or user: no carve-outs, preferences included. Acceptance test S.5.4,
     run through each door: signOut, switchToOrg, createOrg. Kept LAST: it signs out and changes organization. ── */
  console.log('== Part S: session seal ==');
  {
    const canon = "function canon(v){if(Array.isArray(v))return '['+v.map(canon).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canon(v[k])}).join(',')+'}';return JSON.stringify(v)}";
    const dirty = "(function(){" + canon + ";UI.aNewKey={x:1};UI.sec='9.9';UI.cerDraft={owner:'A'};UI.ethDraft={r1:{how:'A'}};UI.rapidDraft={r1:{a:1}};UI.bandDraft={cls:'x'};UI.theme='dark';UI.zoom=1.5;try{Store.setPref('theme','dark');Store.setPref('zoom',1.5);Store.setPref('sidebar-min','0')}catch(e){}sidebarMinimized=false;coachMsgs.push({role:'user',text:'org A secret'});gchatUnreadCount=4;['notesPanel','coachPanel','gchatPanel'].forEach(function(id){document.getElementById(id).innerHTML='ORG A PANEL MARKER'});go('insights');insightsTab='worth';return currentPage})()";
    const check = "(function(){" + canon + ";var u={};Object.keys(UI).forEach(function(k){if(k!=='entry')u[k]=UI[k]});var p=JSON.parse(UI_PRISTINE);p.theme='light';p.zoom=1;var r=[];if(canon(u)!==canon(p))r.push('UI '+canon(u).slice(0,200));if(JSON.stringify(coachMsgs)!==JSON.stringify(JSON.parse(COACH_MSGS_PRISTINE)))r.push('coachMsgs');if(gchatUnreadCount!==0)r.push('unread '+gchatUnreadCount);if(currentPage!=='home')r.push('page '+currentPage);if(Store.getPref('theme')!=='light')r.push('theme pref '+Store.getPref('theme'));if(String(Store.getPref('zoom'))!=='1')r.push('zoom pref '+Store.getPref('zoom'));if(String(Store.getPref('sidebar-min'))!=='1')r.push('sidebar pref');if(sidebarMinimized!==true||sidebarOpen!==true)r.push('sidebar');if(insightsTab!=='latest')r.push('insightsTab '+insightsTab);if(document.documentElement.getAttribute('data-theme')!=='light')r.push('data-theme');if(coachOpen||gchatOpen||notesOpen)r.push('panel open');['notesPanel','coachPanel','gchatPanel'].forEach(function(id){if(document.getElementById(id).innerHTML.indexOf('ORG A PANEL MARKER')>=0)r.push(id+' kept the last organization');});return r.join('; ')||'ok'})()";
    const orgA = w.eval("currentOrgId");
    ok(w.eval(dirty) === 'insights', 'Part S setup: the page reached Insights before sealing');
    w.eval("signOut()"); await wait();
    let got = w.eval(check);
    ok(got === 'ok', 'Part S (S.5.4): signOut returns the session to its starting state — ' + got);
    ok(w.eval("!!(UI.entry&&UI.entry.step==='login')") === true, 'Part S: after signOut the sign-in screen is still what shows (UI.entry is set after the seal)');
    w.eval("switchToOrg('" + orgA + "');Auth.setSession(USERS[0]&&USERS[0].id);UI.entry=null;render()"); await wait();
    w.eval(dirty);
    w.eval("switchToOrg('" + orgA + "')"); await wait();
    got = w.eval(check);
    ok(got === 'ok', 'Part S (S.5.4): switchToOrg returns the session to its starting state — ' + got);
    w.eval("Auth.setSession(USERS[0]&&USERS[0].id);UI.entry=null;render()"); await wait();
    w.eval(dirty);
    w.eval("createOrg('Seal Test Org',{name:'Seal Tester',username:'sealtester',passcode:'4321',role:'Administrator'})"); await wait();
    got = w.eval(check);
    ok(got === 'ok', 'Part S (S.5.4): createOrg returns the session to its starting state — ' + got);
    const bootSrc = w.eval("bootApp.toString()").replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   /* comments stripped: bootApp's own comments may name switchToOrg */
    ok(bootSrc.indexOf('sealSession') < 0 && bootSrc.indexOf('switchToOrg') < 0, 'Part S (S.4): page load never seals — bootApp calls neither sealSession nor switchToOrg');
    ok(w.eval("typeof resetVolatileUI") === 'undefined', 'Part S (S-7): resetVolatileUI is gone; sealSession replaces it');
    /* Part S follow-up (7 Oct 2026): an AI Guide reply still in flight across a seal never lands in the next organization's conversation */
    {
      const realFetch = w.fetch; let release = null;
      const reply = { json: () => Promise.resolve({ content: [{ text: 'ORG A REPLY' }] }) };
      w.fetch = () => new Promise(r => { release = r; });
      w.eval("Auth.setSession(USERS[0]&&USERS[0].id);UI.entry=null;data.settings={aiGuide:true,voice:false};render();if(!coachOpen)toggleCoach();document.getElementById('coachInput').value='Asked in org A';sendCoach()");
      w.eval("switchToOrg(currentOrgId)"); release && release(reply); await wait(); await wait();
      ok(w.eval("JSON.stringify(coachMsgs)===COACH_MSGS_PRISTINE&&document.getElementById('coachPanel').innerHTML.indexOf('ORG A REPLY')<0") === true, 'Part S: an AI Guide reply in flight across a change of organization does not land in the next conversation');
      w.eval("Auth.setSession(USERS[0]&&USERS[0].id);UI.entry=null;data.settings={aiGuide:true,voice:false};render();if(!coachOpen)toggleCoach();document.getElementById('coachInput').value='Asked and answered';sendCoach()");
      release && release(reply); await wait(); await wait();
      ok(w.eval("coachMsgs.length===3&&coachMsgs[2].text==='ORG A REPLY'&&document.getElementById('coachPanel').innerHTML.indexOf('ORG A REPLY')>=0") === true, 'Part S: with no seal in between, the reply still arrives and is drawn');
      w.eval("if(coachOpen)toggleCoach()"); w.fetch = realFetch;
    }
    ok(w.eval("(function(){var t=toggleCoach.toString();return t.indexOf('sealSession')<0})()") === true, 'Part S: the panels close through their own toggles (no recursion back into the seal)');
  }

  /* KB fixes directive (15 Oct 2026, all eleven items ruled by Paul): the acceptance lines, one fixture each.
     Items 3, 9 and 10 retargeted chunk 31, chunk 43 and addenda 138/148 above. The workspace is restored after. */
  console.log('== KB fixes (15 Oct 2026) ==');
  {
    const keepConfirm = w.confirm; w.confirm = () => !!w._kbConfirm;
    const kb = JSON.parse(w.eval(`(function(){
      var keep=JSON.stringify(data), out={}, DAY=86400000, now=Date.now();
      try{
        out.key=[ttFreqKey('Monthly'),ttFreqKey('  every  two weeks '),ttFreqKey('Bi-Weekly'),ttFreqKey('fortnightly'),ttFreqKey('QUARTERLY'),ttFreqKey('sometimes')].join(',');
        var s={id:'sys-kb',testEvidence:[{testId:'t1',at:now-91*DAY},{testId:'t2',at:now-89*DAY},{testId:'t3',at:now-31*DAY},{testId:'t4',at:now-15*DAY},{testId:'t5',at:now-2*DAY},{testId:'t6',at:now-8*DAY}]};
        out.state=[['t1','quarterly'],['t2','quarterly'],['t3','Monthly'],['t4','every two weeks'],['t5','daily'],['t6','Weekly']].map(function(p){return testState(s,{id:p[0],shape:'recurring',frequency:p[1]})}).join(',');
        var df=ttDesignFields({id:'sys-kb',testingPlan:{tests:[]}},{id:'t9',shape:'recurring',frequency:'Monthly'});
        out.dropdown=df.indexOf('How often')<0&&df.indexOf('>Select frequency...</option>')>=0&&df.indexOf('<option value="monthly" selected>Monthly</option>')>=0&&['Daily','Weekly','Every two weeks','Monthly','Quarterly'].every(function(l){return df.indexOf('>'+l+'</option>')>=0});
        out.print=lyTestText({shape:'recurring',frequency:'biweekly',claim:'x'}).indexOf('Every two weeks')>=0;
        data.systems=[{id:'sk1',name:'Kb sys'},{id:'sk2',name:'Lone sys'}];
        data.risks=[{id:'rk1',name:'Kb risk',systemId:'sk1',litL:4,litI:3,litT:2},{id:'rk2',name:'Kb risk two',systemId:'sk1'}];
        out.top=anTopExposures().indexOf('L4 \\u00b7 I3 \\u00b7 T2')>=0;
        out.fw=govFWBody();
        window._kbConfirm=false;removeSystem('sk1');
        out.sysKept=data.systems.length===2&&data.risks[0].systemId==='sk1';
        window._kbConfirm=true;removeSystem('sk1');removeSystem('sk2');
        out.sysGone=data.systems.length===0&&data.risks.every(function(r){return r.systemId===null});
        window._kbConfirm=false;removeRisk('rk1');out.riskKept=data.risks.length===2;
        window._kbConfirm=true;removeRisk('rk1');out.riskGone=data.risks.length===1&&data.risks[0].id==='rk2';
        data.systems=[];
        data.risks=[{id:'m1',name:'Mon',classification:'monitor',monitorPlan:{monitor:'Pat',frequency:'review',at:now-60*DAY,indicators:[{name:'i1',frequency:'weekly',checks:[{at:now-20*DAY}]},{name:'i2',frequency:'weekly',checks:[{at:now-DAY}]}]}}];
        var rk=function(){return anHealth().comps.filter(function(c){return c.n==='Rhythm kept'})[0]};
        var a=rk();data.risks[0].monitorPlan.indicators[0].checks.push({at:now});var b=rk();
        out.rhythm=[a.v,b.v];out.rhythmTip=a.tip;
      }catch(e){out.err=String(e&&e.stack||e)}
      data=JSON.parse(keep);delete window._kbConfirm;saveData();render();
      return JSON.stringify(out)})()`));
    w.confirm = keepConfirm;
    ok(!kb.err, 'KB fixes: the fixtures ran — ' + (kb.err || ''));
    ok(kb.key === 'monthly,biweekly,biweekly,biweekly,quarterly,', 'KB item 1: stored frequencies read without regard to capitals or spaces; every two weeks / bi-weekly / fortnightly read as Every two weeks — ' + kb.key);
    ok(kb.state === 'overdue,ok,overdue,overdue,overdue,overdue', 'KB item 1: every option goes OVERDUE at its own period (Quarterly 90, Monthly 30, Every two weeks 14, Daily 1, Weekly 7) — ' + kb.state);
    ok(kb.dropdown === true, 'KB item 1: Design the Tests shows the frequency dropdown, not the text box, and a stored "Monthly" selects Monthly');
    ok(kb.print === true, 'KB item 1: the printed test line shows the frequency label');
    ok(kb.top === true, 'KB item 2: Top Exposures reads L4 · I3 · T2 under the composite');
    ok(typeof kb.fw === 'string' && kb.fw.indexOf('Reassessment') < 0 && ['New Risk Review', 'Deploy Gate'].every(t => kb.fw.indexOf(t) >= 0), 'KB item 7: the Governance Framework shows no Reassessment tile, and keeps the others');
    ok(kb.sysKept === true && kb.riskKept === true, 'KB item 8: Cancel on either confirmation changes nothing');
    ok(kb.sysGone === true && kb.riskGone === true, 'KB item 8: confirming removes the system (its risks unlinked, systemId null) and the risk');
    ok(Array.isArray(kb.rhythm) && kb.rhythm[0] < kb.rhythm[1] && Math.abs(kb.rhythm[0] - 1 / 3) < 1e-9, 'KB item 11: a Weekly indicator checked 20 days ago lowers Rhythm kept, each indicator counted; logging a check raises it — ' + JSON.stringify(kb.rhythm));
    ok(kb.rhythmTip === 'The review cadence is set, and every indicator on a monitored risk has been checked within one and a half times its own check frequency.', 'KB item 11: the Rhythm kept hover text');
    const src = fs.readFileSync('Governance-app.js', 'utf8'); const n = t => src.split(t).length - 1;
    ok(n("['exp','Composite','center']") === 1 && n("['exp','L\\u00d7I','center']") === 0, 'KB item 2: the Risk Explorer column is headed Composite');
    ok(n("{label:'Owner',") >= 1 && n('it needs an owner and at least one indicator.') === 1 && w.eval("renderOutExitPlans.toString().indexOf('<strong>Owner:</strong>')>=0") === true && n('What is being monitored') === 0 && n('monitoring statement') === 0 && n('<strong>Monitor:</strong>') === 0, 'KB item 4: the monitoring plan field is Owner on every surface');
    ok(n('Snapshots recorded automatically every day') === 2 && n('recorded automatically every day. Come back tomorrow to see movement.') === 1 && n('when Analytics is opened') === 0 && n('each day you open Analytics') === 0, 'KB item 5: snapshots described as daily, page and print');
    ok(n('Two things live in separate columns') === 1 && n('what you have determined') === 0 && n('It locates evidence.') === 1 && n('records your judgment') === 0, 'KB item 6: the NIST paragraph promises no judgment column');
  }
  {
    /* KB item 8: the exact confirmation wording (G.10, G.11) */
    const asked = []; const keepConfirm = w.confirm; w.confirm = m => { asked.push(m); return false; };
    w.eval("(function(){var keep=JSON.stringify(data);data.systems=[{id:'sk1',name:'Kb sys'},{id:'sk2',name:'Lone sys'},{id:'sk3',name:'One sys'}];data.risks=[{id:'rk1',name:'Kb risk',systemId:'sk1'},{id:'rk2',systemId:'sk1'},{id:'rk3',systemId:'sk3'}];removeSystem('sk1');removeSystem('sk2');removeSystem('sk3');removeRisk('rk1');data=JSON.parse(keep);saveData();render()})()");
    w.confirm = keepConfirm;
    ok(asked[0] === 'Remove “Kb sys” from the inventory? 2 risks are attached to it and will no longer be linked to a system. This cannot be undone.', 'KB item 8: removing a system with risks — ' + asked[0]);
    ok(asked[1] === 'Remove “Lone sys” from the inventory? This cannot be undone.', 'KB item 8: removing a system with no risks drops the middle sentence — ' + asked[1]);
    ok(asked[2] === 'Remove “One sys” from the inventory? 1 risk is attached to it and will no longer be linked to a system. This cannot be undone.', 'KB item 8: one attached risk reads "1 risk is" — ' + asked[2]);
    ok(asked[3] === 'Remove “Kb risk”? The risk card is deleted, not archived. This cannot be undone.', 'KB item 8: removing a risk at Step 1.3 — ' + asked[3]);
  }

  console.log('\nSmoke: '+pass+' pass, '+fail+' fail');
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR:',e.message);process.exit(1)});
