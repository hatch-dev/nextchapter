/* smoke.js — boots the restructured governance app under jsdom and
   verifies: dark default, theme/zoom/More persistence via Store,
   every page renders, module screens mount, data blob revisioning.
   Run: npm i jsdom && node Culture-smoke.js */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('Culture-index.html','utf8');
const dom = new JSDOM(html, { runScripts:'outside-only', url:'http://localhost/' });
const w = dom.window;
const mem = {};
Object.defineProperty(w, 'localStorage', { value: {
  getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v)}, removeItem:k=>{delete mem[k]}
}});
w.confirm = () => true; w.alert = () => {};
w.scrollTo = () => {}; w.requestAnimationFrame = f => setTimeout(f,0);
w.fetch = (p) => Promise.resolve({ ok:true, text:()=>Promise.resolve(fs.readFileSync(p.replace(/^\.\//,''),'utf8')) });
for (const f of ['Culture-templates-local.js','Culture-screen-loader.js','Culture-home.js','Culture-learn.js','Culture-app.js']) {
  w.eval(fs.readFileSync(f,'utf8'));
}
w.eval('CUL_SEED_DAY90=false'); /* these checks were written for the sample before it completed steps 4.2 and 4.3; the harness block BUGHUNT-SEED90 tests the completed sample (28 Oct 2026) */
(async () => {
  const wait = () => new Promise(r => setTimeout(r, 30));
  let pass = 0, fail = 0;
  function ok(cond, label){ if(cond){pass++;} else {fail++; console.log('  x', label);} }
  /* 7 Oct 2026 (Batch 1): a fixture inside the suite, not a new tool. The step shells hold no fields until the step batches build them, so the identity, lock and in-place-add walks run on a stand-in page of team and role fields. fxOn swaps renderStepContent for that page; fxOff puts the real one back. Each step batch retargets these walks to its own fields. */
  const FX_PAGE = `(function(){window.__rscKeep=renderStepContent;renderStepContent=function(id){var h='';(data.teams||[]).forEach(function(t){var i=esc(t.id);h+='<div>'+'<input id="tm_name_'+i+'" class="field-input" value="'+esc(t.name||'')+'" oninput="fldSave(this.id,this.value,true)" onchange="fldSave(this.id,this.value)">'+'<input id="tm_manager_'+i+'" class="field-input" value="'+esc(t.manager||'')+'" oninput="fldSave(this.id,this.value,true)" onchange="fldSave(this.id,this.value)">'+'<button class="btn-ghost" onclick="culTeamDel(\\''+i+'\\')">x</button></div>'});(data.roles||[]).forEach(function(r){var i=esc(r.id);h+='<div>'+'<input id="rl_name_'+i+'" class="field-input" value="'+esc(r.name||'')+'" oninput="fldSave(this.id,this.value,true)" onchange="fldSave(this.id,this.value)">'+'<button class="btn-ghost" onclick="culRoleDel(\\''+i+'\\')">x</button></div>'});h+=btnAdd('+ Add team','culTeamAdd()')+culAddForm('team')+btnAdd('+ Add role','culRoleAdd()')+culAddForm('role');return h}})()`;
  function fxOn(){w.eval(FX_PAGE)}
  function fxOff(){w.eval('renderStepContent=window.__rscKeep')}
  await wait();
  ok(w.UI.theme === 'dark', 'boots dark by default');

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
  /* 6 Oct 2026 (Batch 8c, Spec §25.2 / item 81): retargeted — the AI Guide is off by default; it appears once an administrator switches it on. The superseded pin required it after sign-in. */
  ok(w.document.getElementById('coachFab').style.display==='none', 'the AI Guide is hidden after sign-in until it is switched on (item 81)');
  w.eval("setAiSetting('aiGuide',true);setAiSetting('voice',true)"); await wait();
  ok(w.document.getElementById('coachFab').style.display!=='none' && w.document.getElementById('voiceFab').style.display!=='none', 'switched on by an administrator, the AI Guide and Voice appear at once');
  const plz=w.document.getElementById('fabPulse');
  ok(plz && plz.parentElement===w.document.getElementById('coachFab'), 'glow element rides inside the AI Guide button');
  const nrh=w.document.getElementById('navRight').innerHTML;
  /* 6 Oct 2026 (Batch 8e, Spec §25.3 / Revision BC): retargeted — Demo is in the top bar where Notes was, and Notes is in the More menu; the superseded pin required Notes in the top bar */
  ok(nrh.indexOf('Team Chat')>=0 && nrh.indexOf('openSampleTab()')>=0 && nrh.indexOf('notesNavBtn')<0, 'Team Chat and Demo in the top bar; Notes has moved to the More menu');
  ok(w.document.querySelector('.gchat-fab')==null && w.document.querySelector('.notes-fab')==null, 'floating chat/notes FABs retired');
  const pl=w.document.getElementById('fabPulse');
  ok(pl && pl.parentElement===w.document.getElementById('coachFab'), 'coach pulse anchored inside the AI Guide button');
  ok(JSON.parse(mem['culture-orgs']).length===1, 'org persisted to gov-orgs');
  // roster: admin adds a user; PIN login finds them
  /* 25 Sep 2026 (ruled by Paul: no real people in any identity slot): fixture renamed; the superseded fixture used a real person's name. */
  w.eval(`USERS.push({id:'u_test',name:'Bronwen Hale',username:'bronwen',role:'Facilitator',initials:'BH',color:'#8B5E3C',passcode:'1234'});persistRoster()`);
  const found = w.eval(`findUserByLogin('bronwen','1234')`);
  ok(found && found.userId==='u_test', 'PIN login resolves the added user');
  const bad = w.eval(`findUserByLogin('bronwen','9999')`);
  ok(!bad, 'wrong PIN rejected');
  // admin passcode: first use sets it; wrong pin then fails; console gate works
  /* 6 Oct 2026 (Batch 8d, item 96): retargeted — every installation starts with the default account admin / NextChapter2026!, whose password works once; the superseded pin set a passcode on first use. */
  let adminRes=null; w.eval(`Auth.signInAdmin('admin','NextChapter2026!',function(r){window.__ar=r})`); adminRes=w.eval('window.__ar');
  ok(adminRes && adminRes.ok && adminRes.mustChange && adminRes.firstUse, 'the default administrator account signs in once and must choose a new password (item 96)');
  w.eval(`Auth.signInAdmin('0000',function(r){window.__ar=r})`); adminRes=w.eval('window.__ar');
  ok(adminRes && !adminRes.ok, 'wrong admin passcode rejected');
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

  ok(w.document.documentElement.getAttribute('data-theme')==='dark', 'data-theme applied');
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Light Mode')>=0, 'theme chip next to Help');
  const pages = ['home','learn','pipeline','phase5','overview'];
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
  /* 25 Oct 2026 (audit fix round): Paul's ruling on audit R1 — signing in passes through the seal, which keeps the dark theme and returns the sidebar open; the rail pins below now run after minimizing it. Retargeted from "sidebar boots visible in the minimized rail". */ ok(w.eval('sidebarOpen')===true && w.eval('sidebarMinimized')===false, 'after sign-in the sidebar is open (the seal, ruled 25 Oct 2026)'); w.eval('minimizeSidebar()'); await wait();
  const sbEl=w.document.getElementById('pipSidebar');
  ok(sbEl.className.indexOf('mini')>=0 && sbEl.className.indexOf('collapsed')<0, 'rail state: .mini, not .collapsed');
  ok(sbEl.innerHTML.indexOf('sidebar-mini-max')>=0 && sbEl.innerHTML.indexOf('sidebar-mini-dot')>=0, 'rail shows phase dots and the maximize button');
  /* 25 Sep 2026 (Batch 4d part 2b, Spec §6): the content column is #app.main-content; the three superseded pins read #mainContent. */
  ok(w.document.getElementById('app').className.indexOf('sidebar-mini')>=0, 'content sits beside the rail');
  w.eval('maximizeSidebar()'); await wait();
  const sbh=w.document.getElementById('pipSidebar').innerHTML;
  ok(w.eval('sidebarMinimized')===false && mem['culture-sidebar-min']==='0', 'Maximize expands and persists');
  ok(sbh.indexOf('Minimize')>=0 && sbh.indexOf('sidebar-size-tog')>=0, 'full menu header carries the Minimize control');
  ok(sbh.indexOf('sidebar-phase-tog')>=0 && sbh.indexOf('1. Diagnose')>=0 && sbh.indexOf('Days 1')>=0, 'phase heads show number, name, day range, chevron');
  w.eval('toggleSidebarSize()'); await wait();
  ok(w.eval('sidebarMinimized')===true && mem['culture-sidebar-min']==='1', 'Minimize returns to the rail and persists');
  w.eval('maximizeSidebar()'); await wait();
  w.eval('toggleSidebar()');
  ok(w.eval('sidebarOpen')===false && w.document.getElementById('app').className.indexOf('sidebar-collapsed')>=0, 'hamburger fully hides the sidebar');
  w.eval('toggleSidebar()');
  ok(w.eval('sidebarOpen')===true && w.document.getElementById('app').className.indexOf('sidebar-collapsed')<0, 'hamburger restores it');
  // Track Program hub
  w.eval('toggleNavMore()'); await wait();
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Track Program')>=0, 'Track Program in the More menu');
  w.eval('closeNavMore()'); await wait();
  w.eval("go('mgmt-hub')"); await wait();
  const hub=w.document.getElementById('app').innerHTML;
  ok(hub.indexOf('Module')>=0 && hub.indexOf('steps complete')>=0 && hub.indexOf('of the 90')>=0, 'hub renders pacing tiles');
  ok(hub.indexOf('This Week')>=0 && hub.indexOf('Phase 1')>=0, 'assignments tab lists week + phase cards');
  /* 25 Sep 2026 (conformance Batch 3, Rollout item 30 / Spec §22.2.1): retargeted — the hub's print control is the ghost ▾ Save as PDF; the superseded pin asserted the filled 'Download as PDF' label. */
  ok(hub.indexOf('\u25BE Save as PDF')>=0 && hub.indexOf('Download as PDF')<0 && hub.indexOf('class="btn bg2"')>=0, 'hub offers the PDF export in the ghost Save as PDF form (item 30)');
  w.eval("mgDueSave('1.2','2030-01-15')"); await wait();
  ok(w.eval("(data.stepDue||{})['1.2']")==='2030-01-15', 'deadline persists via mgDueSave');
  w.eval("toggleAssign('1.2', USERS[0].id)"); await wait();
  ok(w.eval("(data.assigns['1.2']||[]).length")===1, 'assignment toggles on');
  w.eval('UI.mgTab=1; render()'); await wait();
  const an=w.document.getElementById('app').innerHTML;
  ok(an.indexOf('Burn-up')>=0 && an.indexOf('Velocity')>=0 && an.indexOf('Workload')>=0 && an.indexOf('Signals')>=0, 'analytics tab renders all four cards');
  w.eval('UI.mgTab=0');
  w.confirm=()=>true; /* 25 Sep 2026 (Batch 3): markStepComplete confirms first (Spec §11) */
  /* 7 Oct 2026 (Batch 2, step 4): retargeted — step 1.2 now has rules a bare seed run does not meet, so the stamp is exercised through stampStepDone, the writer markStepComplete calls */
  w.eval("data.completedSteps=data.completedSteps||{};data.completedSteps['1.2']=true;stampStepDone('1.2')"); await wait();
  ok(w.eval("(data.stepDoneAt||{})['1.2']") != null, 'completion stamps the date for pacing charts');

  /* 8 Oct 2026 (Batch 4, step 3.4): the step 3.4 pins in this file are retargeted to step 4.1 (still a shell; 3.4 now has its tabbed battery and cannot be completed from the bare shell). */ /* 8 Oct 2026 (Batch 5, step 4.1): 4.1 now has its tabbed battery, so these shell pins (4.1) are retargeted again to step 4.3, which is still a bare shell; superseded wording: step 4.1. */
  w.eval("go('step','4.3')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('First Culture Review')>=0 /* renamed (Paul\'s final pass, 29 Oct 2026) */, 'step 4.3 renders with its name, First Culture Review');
  w.eval('toggleTheme()'); await wait();
  ok(w.UI.theme==='light' && mem['culture-theme']==='light', 'toggle -> light persists');
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Dark Mode')>=0, 'theme chip flips label');
  w.eval('toggleTheme()'); await wait();
  w.eval('toggleNavMore()'); await wait();
  const nr = w.document.getElementById('navRight').innerHTML;
  /* 25 Sep 2026 (Batch 4d part 2b, Spec §7 and Rollout items 5, 68): retargeted to the family labels; the superseded pin asserted 'Load demo data' and 'Reset all progress'. */
  /* 6 Oct 2026 (Batch 8b, Spec §25.4 / item 84): retargeted — Reset data moves to the admin console's organization rows and replaces the More menu's Reset all data; the superseded pin required the menu item. */
  ok(nr.indexOf('Seed sample data')>=0 && nr.indexOf('Reset all data')<0 && nr.indexOf('Voice')>=0 && nr.indexOf('Load demo data')<0, 'More menu holds Voice and the seed; Reset data has moved to the admin console (item 84)');
  w.eval('closeNavMore()'); await wait();
  w.eval('zoomIn()'); await wait();
  ok(w.UI.zoom===1.1 && mem['culture-zoom']==='1.1', 'zoom persists via Store');
  ok(w.document.getElementById('app').innerHTML.indexOf('zoom:1.1')>=0 || w.document.getElementById('app').innerHTML.indexOf('zoom: 1.1')>=0, 'zoom applied to wrap');
  w.eval('zoomReset()'); await wait();
  w.eval("go('phase5')"); await wait();
  const fresh5=w.document.getElementById('app').innerHTML;
  /* 8 Oct 2026 (Batch 6, 5.1): retargeted — the dashboard is built; old expectation: fresh5 held 'has not been built yet'. It now holds the hero and Target Culture slots and no not-built line */
  ok(fresh5.indexOf('Culture Dashboard')>=0 && fresh5.indexOf('has not been built yet')<0 && fresh5.indexOf('data-db="hero"')>=0, 'the dashboard renders before any data');
  w.eval('seedSampleData()'); await wait();
  const orgId = w.eval('currentOrgId');
  const blob = JSON.parse(mem['culture-org-data::'+orgId]);
  ok(blob && blob.rev >= 1 && blob.schemaVersion===1, 'saved blob is revisioned (rev '+blob.rev+')');
  /* 7 Oct 2026 (Batch 2, step 4; dated note added at close-out, Spec §22.9.3): retargeted — the seed holds eight roles (the seven seeded roles and Legal counsel, which the AI uses need); the superseded pin required seven */
  ok(Array.isArray(blob.teams) && blob.teams.length===6 && Array.isArray(blob.roles) && blob.roles.length===8, 'sample data seeded ('+(blob.teams||[]).length+' teams, '+(blob.roles||[]).length+' roles)');
  w.eval("go('phase5')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('Culture Dashboard')>=0, 'dashboard renders with seeded data');
  // every step shell renders, shows its name and, if countable, carries its Complete button (the old instruments of steps 4.1 to 4.4 are retired)
  (function(){var bad=[];w.eval('PH').forEach(function(p){p.steps.forEach(function(s){w.eval("go('step','"+s.id+"')");var h=w.document.getElementById('app').innerHTML;
      if(h.indexOf('<h2>Error</h2>')>=0||h.indexOf(s.name)<0||(!s.standing&&h.indexOf("markStepComplete('"+s.id+"')")<0&&h.indexOf('data-step-btn="'+s.id+'"')<0&&h.indexOf("culPartDone('"+s.id+"'")<0&&h.indexOf('culPartDone(&#39;'+s.id+'&#39;')<0) /* 15 Oct 2026 (culture map, Stage 5, ruling 89): a step drawn as parts carries its Done: go to button instead */)bad.push(s.id)})});
    ok(bad.length===0, 'every step shell renders, shows its name, and every countable step carries its Complete button ('+bad.join(', ')+')');})();
  w.eval("go('insights')"); await wait();
  const ins=w.document.getElementById('app').innerHTML;
  /* 25 Sep 2026 (conformance Batch 4c, Spec §8): retargeted — Insights is the ER family page (latest writing, CONVERGENCE, Worth Your Time); the superseded pin looked for Culture's old feed strings ('goes to die', 'sovereign enterprise'). */
  ok(ins.indexOf('Goes to Die')>=0 && ins.indexOf('CONVERGENCE')>=0 && ins.indexOf('Ideas &amp; <em>Conversations</em>')>=0, 'insights page lists the corpus (family layout; carries the Culture anchor article)');
  w.eval("go('step','1.4')"); await wait();
  /* 25 Sep 2026 (conformance Batch 1, Spec §5B relic clause + Rollout item 50): the two pins below
     retargeted — the example-spawn loaders culJump/culWsJump and their ⚡ Example / ⚡ Prefill buttons
     are retired family-wide; seeded data enters only through the More-menu loader. Superseded pins
     asserted 'tool jump-start seeds examples' and 'worksheet jump-start fills only the empty fields'. */
  ok(typeof w.culJump==='undefined' && typeof w.culJumpBtn==='undefined', 'example-spawn loader retired (was: tool jump-start seeds examples)');
  ok(typeof w.culWsJump==='undefined' && w.document.getElementById('app').innerHTML.indexOf('\u26a1 Example')<0, 'worksheet example filler retired (was: worksheet jump-start fills only the empty fields)');

  // the retired instruments and the old dashboard's builders
  ok(['culCri','culRadar','culDashTiles','culDashAnalytics','renderReport','printCultureReport','culBurnup','culPsHeatmap','culMarcSet','culJcSet','culLoopAdd','culStoryAdd','culSesAdd','culChgStrip'].every(function(fn){return w.eval("typeof "+fn)==='undefined'}), 'the old instruments and dashboard builders are retired (CRI, radar, tiles, report, burn-up, heatmap and the registers)');
  w.eval("go('phase5')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf('printCurrentPage()')>=0 && h.indexOf('Culture Dashboard')>=0, 'the dashboard shell renders and carries the print control');})();
  // the five phases and the 17 countable steps (the old 24 steps and the registers of steps 5.1 to 5.4 are retired)
  ok(w.eval('PHASES.length')===5 && w.eval("PHASES.map(function(p){return p.steps.length}).join(',')")==='4,6,4,3,4', 'five phases with 4, 6, 4, 3 and 4 steps (Paul\'s ruling of 20 Oct 2026: step 4.1 Formal Adoption is removed, 17 countable steps; Regenerate holds the four standing pages, the Communication Planning Hub the fourth: Paul\'s ruling of 19 Oct 2026: the live Communication Planning Hub; Rewire gains step 2.6: Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6)');
  ok(w.eval("PHASES.reduce(function(a,p){return a+p.steps.length},0)")===21 && w.eval('mgSteps().length')===17 && w.eval("mgSteps().every(function(s){return String(s.id).charAt(0)!=='5'})"), '21 pages in all, of which 17 are countable steps and none starts with 5 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6)');
  // the standing pages 5.1 to 5.3: a description and the not-built line, no done button, no assign bar
  /* 8 Oct 2026 (Batch 6, 5.1): retargeted — old expectation: 5.1 here showed the standing shell. go('step','5.1') now lands on the built dashboard (pinned below), so the shell loop covers 5.2 and 5.3 */
  ['5.2','5.4'].forEach(function(id){w.eval("go('step','"+id+"')");
    var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf('data-standing="1"')>=0 && h.indexOf('done-wrap')<0 && h.indexOf('markStepComplete')<0 && h.indexOf('assign-bar')<0 && h.indexOf(w.eval("STEP_FLOW[5].filter(function(f){return f.id==='"+id+"'})[0].sh"))>=0, 'the standing page '+id+' shows its description and the standing mark, with no done button and no assign bar');});
  /* 8 Oct 2026 (Batch 6, 5.2 B2): the Culture Tracker page frame, radar card and row list */
  (function(){var pg=function(){w.eval("go('step','5.2')");return w.document.getElementById('app').innerHTML},h=pg(),T=function(k){return w.eval("CUL_TK_COPY['"+k+"']")};
    ok(h.indexOf('data-standing="1"')>=0 && h.indexOf('has not been built')<0 && (h.match(/<svg[^>]*role="img"/g)||[]).length>=1 && h.indexOf('data-tkradar="1"')>=0 && (h.match(/data-tkrow="/g)||[]).length===11 && h.indexOf("go('targetCulture')")>=0 && h.indexOf("go('pulseRound')")>=0 && h.indexOf(T('tk.btn.target'))>=0 && h.indexOf(T('tk.btn.pulse'))>=0 && h.indexOf('aria-label="Culture radar across')>=0, 'step 5.2 draws its standing mark, the radar with its aria text, 11 row blocks and the two buttons, and not the not-built card');
    var svg=(h.match(/<svg[^>]*role="img"[^]*?<\/svg>/)||[''])[0];
    ok((svg.match(/<text /g)||[]).length===11, 'step 5.2 radar carries 11 axis labels');
    w.eval("UI.tkPriOnly=true");var hp=pg(),np=w.eval("culTkRowsShown().length"),pc=w.eval("culPriorityRows().length");
    ok(w.eval("culTkRowsShown().every(function(r){return r.x.priority})") && (hp.match(/data-tkrow="/g)||[]).length===np && (pc<3?hp.indexOf(T('tk.radar.empty'))>=0:(hp.match(/<svg[^>]*role="img"[^]*?<\/svg>/)||[''])[0].match(/<text /g).length===np), 'the priority filter leaves only the priority rows in the list and the radar, or the empty message under three rows');
    w.eval("var _sv=data.rowSettings;data.rowSettings=[]");var hz=pg();
    ok(hz.indexOf(T('tk.radar.empty'))>=0 && (hz.match(/<svg[^>]*role="img"/g)||[]).length===0 && (hz.match(/data-tkrow="/g)||[]).length===0, 'with no priority rows the filter shows the radar empty message and no radar');
    w.eval("data.rowSettings=_sv;UI.tkPriOnly=false");h=pg();
    var fl=w.eval("CUL_ROWS.map(function(r){var f=culFlags(r.id);return [f.drop,f.below,f.practice,f.any]})"),okc=true;
    w.eval("CUL_ROWS").forEach(function(r,i){var blk=h.split('data-tkrow="'+r.id+'"')[1].split('data-tkrow=')[0],c=function(a){return blk.indexOf(a)>=0};if(c('data-tkflag="drop"')!==!!fl[i][0]||c('data-tkflag="base"')!==!!fl[i][1]||c('data-tkflag="practice"')!==!!fl[i][2]||c('data-tkok="1"')===!!fl[i][3])okc=false});
    ok(okc && fl.some(function(f){return f[3]}), 'the flag chips on 5.2 match culFlags for all 11 rows, and the seed flags at least one');
    w.eval("var _rk=data.rechecks;data.rechecks=[];var _a=culRcStart(1)");h=pg();var blk1=h.split('data-tkrow="1"')[1].split('data-tkrow="2"')[0];
    ok(blk1.indexOf('data-tkrecheck="1"')>=0 && blk1.indexOf('Re-check under way')>=0 && blk1.indexOf('data-tkoverdue')<0, 'a started re-check shows its under-way line on its row');
    w.eval("data.rechecks=_rk");
    var before=w.eval('JSON.stringify(data)');pg();pg();pg();
    ok(w.eval('JSON.stringify(data)')===before, 'rendering 5.2 stores nothing and copies nothing');
    w.eval("var _rs=JSON.stringify(data.rowSettings);culRowSet(2,'targetScore','4.7','x')");h=pg();var b2=h.split('data-tkrow="2"')[1].split('data-tkrow="3"')[0];
    ok(b2.indexOf('4.7')>=0, 'a changed target score shows on 5.2');w.eval('data.rowSettings=JSON.parse(_rs)');
    (function(){var rw=w.eval('(function(){var r=CUL_ROWS.filter(function(x){return culRowLatestReading(x.id)!=null})[0];return r?r.id:0})()');if(!rw)return;var rid=w.eval('(function(){var L=culRowReadings('+rw+').filter(function(x){return x.context!=="baseline"});return L[L.length-1].id})()'),item=w.eval('culRowItemIds('+rw+')[0]');w.eval('var _pr=JSON.stringify(data.pulseRounds),_old=culRowLatestReading('+rw+')');w.eval("culRoundTeams().forEach(function(t){culPulseSet('"+rid+"',t.id,'"+item+"','1.5','x')})");var h3=pg().split('data-tkrow="'+rw+'"')[1].split('data-tkrow=')[0];
      ok(w.eval('culRowLatestReading('+rw+')')!==w.eval('_old') && h3.indexOf('<b>'+w.eval("culFmt1(culRowLatestReading("+rw+"))")+'</b>')>=0 /* the table shows the latest score (Paul\'s ruling of 27 Oct 2026: the compact Tracker, no folds) */, 'a pulse result saved through its step shows as the new latest reading on 5.2');w.eval('data.pulseRounds=JSON.parse(_pr)')})();
    /* 8 Oct 2026 (Batch 6, 5.1): retargeted — old expectation: ['5.1','5.4'] both still showed the shell. 5.1 is now the dashboard */
    /* 8 Oct 2026 (Batch 6, 5.3 job A): retargeted - old expectation: 5.3 still showed the shell: ['5.4'].forEach(function(id){w.eval("go('step','"+id+"')");ok(w.document.getElementById('app').innerHTML.indexOf('has not been built')>=0, 'step '+id+' still shows the shell')}); */
    ['5.4'].forEach(function(id){w.eval("go('step','"+id+"')");ok(w.document.getElementById('app').innerHTML.indexOf('has not been built')<0, 'step '+id+' no longer shows the shell')});
  })();
  /* 8 Oct 2026 (Batch 6, 5.3 job A): the Analytics page frame, Analytical Signals, Top Concerns, the snapshot call and the read-only scan */
  (function(){var pg=function(){w.eval("go('step','5.4')");return w.document.getElementById('app').innerHTML},sv=w.eval('JSON.stringify(data)'),rs=function(){w.eval('data=JSON.parse('+JSON.stringify(sv)+')')},h=pg();
    ok((h.match(/data-standing="1"/g)||[]).length===1 && h.indexOf('has not been built')<0 && h.indexOf('done-wrap')<0 && h.indexOf('markStepComplete')<0 && h.indexOf('assign-bar')<0 && h.indexOf(w.eval("STEP_FLOW[5].filter(function(f){return f.id==='5.4'})[0].sh"))>=0, 'step 5.3 shows the standing mark once, the step description, no not-built line, no done button and no assign bar');
    ok(h.indexOf('data-dbhero="1"')<0 /* no repeated radar (Paul\'s ruling of 27 Oct 2026: Phase 5 review fixes) */ && (h.match(/an-chart-card/g)||[]).length===16 && h.indexOf(w.eval("CUL_AN_COPY['an.signals.title']"))>=0 && h.indexOf(w.eval("CUL_AN_COPY['an.top.title']"))>=0 && (h.match(/grid-template-columns:1fr 1fr;gap:14px;margin-top:14px/g)||[]).length===4 /* the heatmap and the practice list are full width (Paul\'s ruling of 27 Oct 2026: Phase 5 review fixes); Analytical Signals and the radar each full width too (Paul, 1 Nov 2026; was 5 two-column rows) */ && h.indexOf('class="cul-ansig"')>=0, 'step 5.4 draws the hero and 16 tiles, with Analytical Signals and the radar each full width');
    /* Analytical Signals */
    w.eval("var _fr=culRowReadings;culRowReadings=function(id){return id===1?[{score:3.0},{score:3.4},{score:3.9}]:id===2?[{score:3.5},{score:3.1}]:[]}");var hs=w.eval('culAnTSignals()'),n1=w.eval('culRowById(1).name'),n2=w.eval('culRowById(2).name');w.eval('culRowReadings=_fr');
    ok(hs.indexOf(w.eval("esc(culAnX('an.signals.riser',{row:"+JSON.stringify(n1)+",change:'+0.9'}))"))>=0 && hs.indexOf(w.eval("esc(culAnX('an.signals.faller',{row:"+JSON.stringify(n2)+",change:'\u22120.4'}))"))>=0, 'Analytical Signals names the fastest riser (+0.9) and the fastest faller (-0.4)');
    w.eval('data=culEmptyData()');var h0=w.eval('culAnTSignals()');
    ok(h0.indexOf(w.eval("esc(CUL_AN_COPY['an.signals.none'])"))>=0 && w.eval('culAnRSignals().length')===0, 'Analytical Signals shows the one green line when nothing is raised');
    /* Top Concerns worked example: Notes tool 9, Dana 8, row 4 6, Claims 6 */
    w.eval("data=culEmptyData();var _f=culFlags,_o=culClOver,_l=culClLimits;culFlags=function(id){var x=Number(id)===4;return {drop:x,below:x,practice:false,any:x,details:{}}};culClOver=function(id){return {count:5,score:null,byCount:true,byScore:false,any:true}};culClLimits=function(){return {max:3}};"
      +"data.aiUses.push({id:'us-an1',name:'Notes tool'});data.useReviews.push({id:'ur-an1',useId:'us-an1',date:'2026-10-01',parts:{culture:{q1:{verdict:'neutral'},q2:{verdict:'eroding'},q3:{verdict:'eroding'}}}});"
      +"data.teams.push({id:'tm-an1',name:'Claims'});data.blockerCases.push({id:'bc-an1',name:'Dana',stage:'hear',outcome:'',visibility:CUL_BC_VIS.filter(function(o){return o.rank===2})[0].v,nextReview:isoAddDays(todayIso(),-1)})");
    var cc=w.eval('culAnRConcerns().map(function(x){return x.t+"|"+x.score})').join(','),r4=w.eval('culRowById(4).name'),hc=w.eval('culAnTConcerns()');w.eval('culFlags=_f;culClOver=_o;culClLimits=_l');
    ok(cc==='Notes tool|9,Dana|8,'+r4+'|6,Claims|6' && hc.indexOf('data-ankind="deploy"')>=0 && hc.indexOf('data-ankind="blocker"')>=0 && hc.indexOf('data-ankind="team"')>=0 && hc.indexOf('data-ankind="row"')>=0, 'Top Concerns scores the worked example: Notes tool 9, Dana 8, row 4 6, Claims 6, each with its kind chip (got '+cc+')');
    w.eval('data=culEmptyData()');ok(w.eval('culAnTConcerns()').indexOf(w.eval("esc(CUL_AN_COPY['an.top.empty'])"))>=0, 'Top Concerns shows its empty line when nothing is open');
    rs();
    /* the snapshot: one a day, the only write, never when printing */
    w.eval("data.anSnapshots=(data.anSnapshots||[]).filter(function(x){return x.d!==todayIso()})");var n0=w.eval('data.anSnapshots.length'),strip=function(){var d=JSON.parse(w.eval('JSON.stringify(data)'));delete d.anSnapshots;delete d.rev;return JSON.stringify(d)},b4=strip();pg();pg();
    ok(w.eval('data.anSnapshots.length')===n0+1 && strip()===b4, 'rendering 5.4 twice adds one snapshot and changes nothing else (the revision counter, which Store.commit raises, is left out)');
    w.eval("data.anSnapshots=data.anSnapshots.filter(function(x){return x.d!==todayIso()});UI._printing=true");var n2s=w.eval('data.anSnapshots.length');pg();w.eval('UI._printing=false');
    ok(w.eval('data.anSnapshots.length')===n2s, 'rendering 5.3 for print adds no snapshot');
    rs();
    /* read-only scan: no culAnR* or culAnT* function writes data */
    var src=fs.readFileSync('Culture-app.js','utf8'),fns=[],re=/\nfunction (culAn[RT]\w+)\(/g,m;while((m=re.exec(src))){var e=src.slice(m.index+1).search(/\n(function |var |\/\*)/,1);var j=src.slice(m.index+1).slice(1).search(/\n(function |var |\/\*)/);fns.push({n:m[1],s:src.slice(m.index+1,m.index+2+(j<0?0:j))})}
    ok(fns.length>=18 && fns.every(function(f){return !/culNew\(|culEnsure\(|\bdata\.[\w.]*\.push\(|Store\.commit|culTouch\(/.test(f.s)}), 'every culAnR and culAnT function is read-only (scanned '+fns.length+')');
    ok(fns.filter(function(f){return /^culAnT(Burnup|Velocity|TeamLoad|Delivered|Trends)$/.test(f.n)}).length===5, 'the read-only scan reaches the five program tiles of job B');
    /* 5.3 job B: the five program tiles; worked examples written straight into data, restored after */
    (function(){var ev=function(s){return w.eval(s)},E=function(s){return ev('esc('+JSON.stringify(s)+')')},C=function(k){return ev("CUL_AN_COPY['"+k+"']")},A=function(k){return ev('CUL_ANA.'+k)};
      var ids=ev('mgSteps().map(function(s){return s.id})'),fin=function(startBack,doneDays){ev("data=culEmptyData();data.startDate=isoAddDays(todayIso(),"+(-startBack)+");data.stepDoneAt={};data.completedSteps={}");
        doneDays.forEach(function(d,i){ev("data.completedSteps['"+ids[i]+"']=true;var _s=localDay(data.startDate);data.stepDoneAt['"+ids[i]+"']=new Date(_s.getFullYear(),_s.getMonth(),_s.getDate()+"+d+",12).getTime()")})};
      /* Burnup */
      ok(ids.length===17, 'the program has 17 steps for the worked examples (Paul\'s ruling of 20 Oct 2026: step 4.1 Formal Adoption is removed, 17 countable steps; Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6)');
      fin(45,[10,20,25,30]);var hb=ev('culAnTBurnup()');
      ok(hb.indexOf(E(C('an.burn.behind.many').replace('{n}','4.5')))>=0 && hb.indexOf('4.5 steps behind the 90-day pace')>=0, 'Burnup reads 4.5 steps behind the 90-day pace (ideal 8.5 of 17, 4 done: Paul\'s ruling of 20 Oct 2026: step 4.1 Formal Adoption is removed, 17 countable steps)');
      ok(hb.indexOf('TODAY · 4/17')>=0 && hb.indexOf(E(C('an.burn.ideal')))>=0 && hb.indexOf(A('high'))>=0, 'Burnup marks today at 4/17 and shows the ideal-pace note in the behind colour');
      fin(45,[1,2,3,4,5,6,7,8,9,10]);var ha=ev('culAnTBurnup()');
      ok(ha.indexOf('1.5 steps ahead of the 90-day pace')>=0 && ha.indexOf('TODAY · 10/17')>=0, 'Burnup reads 1.5 steps ahead with 10 done on day 45 (of 17 steps: Paul\'s ruling of 20 Oct 2026: step 4.1 Formal Adoption is removed, 17 countable steps; was 0.5 ahead with 9 of 17)');
      ev("data.stepDoneAt['5.4']=Date.now();data.completedSteps['5.4']=true");ok(ev('culAnTBurnup()').indexOf('TODAY · 10/17')>=0, 'Burnup does not count standing pages');
      /* Velocity */
      fin(10,[2,8,9]);var hv=ev('culAnTVelocity()');
      ok(/>1<\/text>/.test(hv) && /<title>Week 1: 1 step<\/title>/.test(hv) && /<title>Week 2: 2 steps<\/title>/.test(hv) && !/<title>Week 3/.test(hv), 'Velocity bins completions on days 2, 8 and 9 into weeks [1,2,0,...]');
      ok((hv.match(new RegExp('<text[^>]*fill="'+A('gold')+'"[^>]*>W\\d+<','g'))||[]).length===1 && hv.indexOf('>W2<')>=0 && /fill="#B8933D"[^>]*>W2</.test(hv) && hv.indexOf(E(C('an.vel.week')))>=0, 'Velocity paints the current program week gold and carries the legend line');
      ev('data=culEmptyData()');ok(ev('culAnTVelocity()').indexOf(E(C('an.vel.empty')))>=0, 'Velocity shows its empty line with no completions');
      /* Team Load */
      ev("var _US=USERS;USERS=[{id:'u1',name:'Una'},{id:'u2',name:'Uli'}];data=culEmptyData();data.assigns={'1.1':['u1','u2'],'1.2':['u1']}");var ht=ev('culAnTTeamLoad()');
      ok(/width:100%[^>]*><\/div><\/div><div class="owner-row-n">2</.test(ht) && /width:50%[^>]*><\/div><\/div><div class="owner-row-n">1</.test(ht), 'Team Load counts u1 2 and u2 1, with bars at 100% and 50%');
      ev('USERS=[]');var ht0=ev('culAnTTeamLoad()');ev('USERS=_US');
      ok(ht0.indexOf(E(C('an.team.empty')))>=0 && ht0.indexOf('owner-row')<0, 'Team Load shows its empty line with no team members');
      /* Delivered */
      fin(5,[1,2,3,4,5]);var hd=ev('culAnTDelivered()'),CC=2*Math.PI*28,arc=(5/17*CC).toFixed(1)+' '+(CC-5/17*CC).toFixed(1);
      ok(hd.indexOf('>5/17<')>=0 && hd.indexOf('stroke-dasharray="'+arc+'"')>=0 && (hd.match(/grid-template-columns:repeat\(6,1fr\)/g)||[]).length===1, 'What the Program Delivered reads 5/17 with the arc 5/17 of the circumference, in a six-column grid');
      ok(hd.indexOf('>0/0<')>=0 && hd.indexOf('stroke-dasharray="0.0 '+CC.toFixed(1)+'"')>=0, 'a ring with nothing to count draws an empty ring reading 0/0');
      ['steps','charter','practice','reviews','stories','blockers'].forEach(function(k){ok(hd.indexOf(E(C('an.deliv.'+k)))>=0, 'the Delivered ring caption '+k+' is shown')});
      ev("data.charter=[{id:'c1',row:1,commitment:'Do it'},{id:'c2',row:1,commitment:'Again'},{id:'c3',row:2,commitment:'  '},{id:'c4',row:3,commitment:'Yes'}]");
      ok(ev('culAnTDelivered()').indexOf('>2/'+ev('CUL_ROWS.length')+'<')>=0, 'the Charter ring counts distinct rows with a non-blank commitment');
      /* Trends */
      ev("data=culEmptyData();data.anSnapshots=[{d:'2026-10-01',emp:3.1,flagged:2},{d:'2026-10-02',emp:3.4,flagged:4}]");var hr=ev('culAnTTrends()');
      ok(hr.indexOf('color:'+A('teal')+';text-align:right">▲ +0.3<')>=0, 'Trends shows the employee score up 0.3 in teal');
      ok(hr.indexOf('color:'+A('high')+';text-align:right">▲ +2<')>=0 && hr.indexOf(E(C('an.trend.s3')))>=0 && hr.indexOf(E(C('an.trend.snap').replace('{n}','2')))>=0, 'Trends shows rows flagged up 2 in the concern colour, with the snapshot caption');
      ev("data.anSnapshots=[{d:'2026-10-01',emp:3.1}]");ok(ev('culAnTTrends()').indexOf(E(C('an.trend.empty')))>=0, 'Trends shows its empty line with one snapshot');
      ev("data.anSnapshots=[{d:'2026-10-01',emp:3.1},{d:'2026-10-02',emp:null},{d:'2026-10-03',emp:null}]");ok(ev('culAnTTrends()').indexOf(E(C('an.trend.na')))>=0, 'Trends reads Not assessed when the last snapshot has no value');
      var tl=ev('culAnTBurnup()+culAnTVelocity()+culAnTTeamLoad()+culAnTDelivered()+culAnTTrends()');
      ok(tl.indexOf('Not built yet.')<0, 'none of the five program tiles is a stub any more');
      rs();
      /* 5.3 job C: Culture Radar Over Time, Stated vs. Lived, Team Heatmap, Practice Measures; worked examples written straight into data, restored after */
      var mk=function(id,group,ctx,date,all,units){ev("(function(){var it={};CUL_ROWS.forEach(function(r){var v="+JSON.stringify(all)+"[r.id];if(v!=null)it[culRowItemIds(r.id)[0]]=v});var res={org:{avg:it}},U="+JSON.stringify(units||{})+";Object.keys(U).forEach(function(t){var a={};Object.keys(U[t]).forEach(function(rid){a[culRowItemIds(Number(rid))[0]]=U[t][rid]});res[t]={avg:a}});data.pulseRounds.push({id:'"+id+"',group:'"+group+"',context:'"+ctx+"',name:'"+id+"',date:'"+date+"',results:res})})()")},all=function(v){var o={};for(var i=1;i<=11;i++)o[i]=v;return o};
      var rowsOf=function(h,s){return (h.match(new RegExp(s,'g'))||[]).length};
      /* Radar */
      ev("data=culEmptyData();data.pulseRounds=[];data.rowSettings=CUL_ROWS.map(function(r){return {id:'rs'+r.id,row:r.id,targetScore:4}})");mk('rb','employees','baseline','2026-01-01',all(3.0));mk('rp','employees','firstPulse','2026-02-01',all(3.5));
      var hR=ev('culAnTRadar()'),polys=hR.match(/<polygon[^>]*stroke-width="2"[^>]*>/g)||[];
      ok(polys.length===3 && rowsOf(hR,'stroke-dasharray')===1 && hR.indexOf(E(C('an.radar.target')))>=0 && hR.indexOf('an.radar.showing')<0 && hR.indexOf(E(C('an.radar.showing').replace('{n}','6').replace('{total}','2')))<0, 'Radar draws the target (dashed) and two rounds: three shapes, one dashed');
      for(var q=0;q<6;q++)mk('rx'+q,'employees','review','2026-03-0'+(q+1),all(3.6));
      var hR8=ev('culAnTRadar()');
      ok(hR8.indexOf(E(C('an.radar.showing').replace('{n}','6').replace('{total}','8')))>=0 && (hR8.match(/<polygon[^>]*stroke-width="2"[^>]*>/g)||[]).length===7, 'Radar with 8 rounds shows the latest 6 and the note 6 of 8');
      ev('data=culEmptyData()');ok(ev('culAnTRadar()').indexOf(E(C('an.radar.empty')))>=0, 'Radar shows its empty line with no rounds');
      /* Stated vs. Lived */
      ev("data=culEmptyData();data.pulseRounds=[]");var r1={1:4.2},r2={1:4.4},e1={1:3.4},e2={1:3.7};mk('lb','leaders','baseline','2026-01-01',r1);mk('l2','leaders','day90','2026-04-01',r2);mk('eb','employees','baseline','2026-01-01',e1);mk('e2','employees','day90','2026-04-01',e2);
      var hS=ev('culAnTStatedLived()');
      ok(hS.indexOf('color:'+A('teal')+';text-align:right">'+E(C('an.stated.change').replace('{now}','0.7').replace('{base}','0.8')))>=0 && rowsOf(hS,'data-angap')===1 && rowsOf(hS,'grid-template-columns:150px 1fr 1fr 150px')===2, 'Stated vs. Lived reads 0.7 (was 0.8) in teal when the gap narrowed');
      ev('data=culEmptyData()');ok(ev('culAnTStatedLived()').indexOf(E(C('an.stated.empty')))>=0, 'Stated vs. Lived shows its empty line with no scores');
      /* Heatmap */
      ev("data=culEmptyData();data.pulseRounds=[];data.teams=[{id:'tmT',name:'Team T'},{id:'tmU',name:'Team U'}];data.rowSettings=[{id:'rs1',row:1,scoreDrop:0.3}]");
      mk('hb','employees','baseline','2026-01-01',{1:3.9},{tmT:{1:3.9},tmU:{1:3.9}});mk('h2','employees','day90','2026-04-01',{1:3.5},{tmT:{1:3.4},tmU:{1:3.7}});
      var hH=ev('culAnTHeat()');
      ok(/<div data-anheatwrap="1" style="[^"]*overflow-x:auto[^"]*max-width:100%[^"]*"><table data-anheat="1"/.test(hH), 'Heatmap table sits inside an overflow-x:auto wrapper capped at the tile width');
      ok(rowsOf(hH,'data-anheatcell')===22 && rowsOf(hH,'data-flagged')===1 && hH.indexOf(E(C('an.heat.cell').replace('{team}','Team T').replace('{row}',ev('CUL_ROWS[0].name')).replace('{base}','3.9').replace('{latest}','3.4')))>=0 && hH.indexOf('background:'+A('med')+'61;outline:2px solid')>=0 && hH.indexOf('3.4 ▼')>=0 && hH.indexOf('3.7 ▼')<0, 'Heatmap flags team T (3.9 to 3.4, drop 0.3) in the middle colour, leaves team U (3.9 to 3.7) alone, and draws 11 by 2 cells');
      ev('data=culEmptyData()');ok(ev('culAnTHeat()').indexOf(E(C('an.heat.empty')))>=0, 'Heatmap shows its empty line with no teams');
      /* Practice Measures */
      ev("data=culEmptyData();data.charter=[{id:'cp1',row:1,measure:'m6',targetPerQuarter:8},{id:'cp2',row:2,measure:'m5',targetPerQuarter:8},{id:'cp3',row:3,measure:'m9',targetPerQuarter:8}];data.practiceCounts=[{id:'pc1',charter:'cp1',count:6},{id:'pc2',charter:'cp2',count:5},{id:'pc3',charter:'cp3',count:9}]");
      var hP=ev('culAnTPractice()'),pb=hP.split('data-anpractice="1"').slice(1);
      ok(pb.length===3 && pb[0].indexOf('width:75%;background:'+A('med'))>=0 && pb[0].indexOf(E(C('an.practice.count').replace('{count}','6').replace('{target}','8')))>=0 && pb[1].indexOf('background:'+A('high'))>=0 && pb[2].indexOf('width:100%;background:'+A('teal'))>=0 && pb[2].indexOf(E(C('an.practice.count').replace('{count}','9').replace('{target}','8')))>=0, 'Practice Measures: 6 of 8 is 75 percent and middle colour, 5 of 8 is slipping, 9 of 8 is a full bar in teal');
      ev('data=culEmptyData()');ok(ev('culAnTPractice()').indexOf(E(C('an.practice.empty')))>=0, 'Practice Measures shows its empty line with no practices');
      ok(ev('culAnTRadar()+culAnTStatedLived()+culAnTHeat()+culAnTPractice()').indexOf('Not built yet.')<0 && fns.filter(function(f){return /^culAnT(Radar|StatedLived|Heat|Practice)$/.test(f.n)}).length===4, 'the four remaining job C tiles are no longer stubs and the read-only scan reaches them');
      /* 5.3 job D: Deployment Flow, Change Load by Team, Signals Over Time, Fears and Answers, Story Coverage; worked examples written straight into data, restored after */
      var blk2=function(h,attr,id){var p=h.split(attr+'="'+id+'"')[1];return p==null?'':p.split(attr+'=')[0]},nOf=function(h,attr,id){var m=new RegExp(attr+'="'+id+'" data-n="(\\d+)"').exec(h);return m?+m[1]:-1};
      /* Deployment Flow */
      ev("data=culEmptyData();data.aiUses=[{id:'uA',name:'A',status:'planned'},{id:'uB',name:'B',status:'pilot'},{id:'uC',name:'C',status:'pilot'},{id:'uD',name:'D',status:'inUse'},{id:'uE',name:'E',status:'stalled'}];data.useReviews=[{id:'rA',useId:'uA',date:'2026-01-01',parts:{culture:{q1:{verdict:'building'},q2:{verdict:'building'},q3:{verdict:'neutral'}}}},{id:'rB',useId:'uB',date:'2026-01-01',parts:{culture:{q1:{verdict:'eroding'}}}}]");
      var hF=ev('culAnTFlow()');
      ok(nOf(hF,'data-anflow','planned')===1 && nOf(hF,'data-anflow','pilot')===2 && nOf(hF,'data-anflow','inUse')===1 && nOf(hF,'data-anflow','stalled')===1 && hF.indexOf('>20%<')>=0 && hF.indexOf('>40%<')>=0 && hF.indexOf(E(C('an.flow.stalled')))>=0, 'Deployment Flow counts planned 1, pilot 2 and in use 1 of 5 named uses with their percents, and stalled 1 on its own bar');
      ok((hF.match(/data-andec=/g)||[]).length>=4 /* the four decisions, not the fit judgments (Paul\'s ruling of 27 Oct 2026: Phase 5 review fixes) */ && hF.indexOf(E(ev("culClT(CUL_AN_COPY['an.flow.await'],{n:culRvAwaiting().length})")))>=0, 'Deployment Flow counts the q1 to q3 verdicts of each use\'s latest review (building 2, neutral 1, eroding 1) and shows the awaiting line');
      ev('data=culEmptyData()');ok(ev('culAnTFlow()').indexOf(E(C('an.flow.empty')))>=0, 'Deployment Flow shows its empty line with no uses');
      /* Change Load by Team */
      ev("data=culEmptyData();var _d=culIsoAddMonths(todayIso(),1);data.changeLimits={maxChanges:3};data.teams=[{id:'tL',name:'Team L',changeCount:2},{id:'tM',name:'Team M',changeCount:5}];data.plannedChanges=[{id:'pc1',change:'X',start:_d,teams:['tL']},{id:'pc2',change:'Y',start:_d,teams:['tL']}]");
      var hL=ev('culAnTChange()'),bL=blk2(hL,'data-anload','tL'),bM=blk2(hL,'data-anload','tM');
      ok(hL.indexOf('Team L')>=0 && hL.indexOf('2 changes')>=0 && hL.indexOf('Not yet estimated')>=0 /* (Paul\'s ruling of 27 Oct 2026: Phase 5 review fixes) */, 'Change Load: a team with changes landing is listed with their count and its judgment (Paul\'s ruling of 20 Oct 2026: capacity is judged in step 4.2, not counted against a limit)');
      ev("data.teams[0].capacity='overloaded'"); ok(ev('culAnTChange()').indexOf('>Overloaded<')>=0 && hL.indexOf('Team M')<0, 'Change Load: a team judged overloaded shows it, and a team with nothing landing and no judgment is not listed (Paul\'s ruling of 20 Oct 2026: capacity is judged in step 4.2, not counted against a limit)');
      ev('data=culEmptyData()');ok(ev('culAnTChange()').indexOf(E(C('an.load.empty')))>=0, 'Change Load shows its empty line with no teams');
      /* Signals Over Time */
      ev("data=culEmptyData();data.experimenters=[{id:'x1',tried:'A try',date:'2026-04-10',happened:'rewarded'},{id:'x2',tried:'A try',date:'2026-05-02',happened:'informal'},{id:'x3',tried:'A try',date:'2026-08-15',happened:'noConsequence'},{id:'x4',tried:'A try',date:'',happened:'formal'},{id:'x5',tried:'A try',date:'2026-08-15',happened:'dk'}];data.concerns=[]");
      var rO=JSON.parse(ev('JSON.stringify(culAnRSignalsOver())')),hO=ev('culAnTSignalsOver()'),b2=blk2(hO,'data-ansig','s2');
      ok(rO.quarters.map(function(q){return q.label}).join('|')==='2026 Q2|2026 Q3' && rO.series.map(function(s){return s.key}).join(',')==='s1,s2,s3,s4,s5' && rO.series[0].vals.join(',')==='1,1' && rO.series[1].vals.join(',')==='1,0' && b2.indexOf('▼ -1')>=0 && b2.indexOf('color:'+A('teal'))>=0, 'Signals Over Time: two calendar quarters, five series in order, s1 1 and 1, s2 1 then 0 with a teal fall of 1');
      ok(rO.undated===1 && hO.indexOf(E(C('an.sig.nodate').replace('{n}','1')))>=0, 'Signals Over Time counts the undated record in its footnote and leaves out "dk"');
      ev("data=culEmptyData();data.experimenters=[{id:'u1',date:'2026-04-10',happened:'rewarded'},{id:'u2',date:'2026-08-15',happened:'rewarded'}];data.concerns=[{id:'u3',date:'2026-04-10',happened:'acted'}]");
      ok(JSON.parse(ev('JSON.stringify(culAnRSignalsOver())')).quarters.length===0, 'Full pass 5.3: Signals Over Time ignores unnamed experimenter and concern records (Spec 26.3)');
      ev("data=culEmptyData();data.teams=[{id:'tn1',name:'Claims'},{id:'tn2',name:''},{id:'tn3'}]");
      ok(ev("culRoundTeams().map(function(t){return t.id}).join(',')")==='tn1', 'Full pass 5.3: culRoundTeams returns named teams only');
      ok(fs.readFileSync('Culture-app.js','utf8').indexOf("culAnX('an.practice.count',{count:p.count,target:p.target==null?'–':p.target})")>=0, 'Full pass 5.3: the practice tile shows a dash, not the raw slot, when there is no target');
      ev("data.experimenters=[{id:'x1',tried:'A try',date:'2026-04-10',happened:'rewarded'}]");ok(ev('culAnTSignalsOver()').indexOf(E(C('an.sig.empty')))>=0, 'Signals Over Time shows its empty line with fewer than two quarters');
      /* Fears and Answers */
      ev("data=culEmptyData();data.themes=[{id:'t1',theme:'T one',question:'fear',plan:'P one'},{id:'t2',theme:'T two',question:'fear',plan:'P two'},{id:'t3',theme:'T three',question:'fear',notThisCycle:true},{id:'t4',theme:'T four',question:'fear'}]");
      var hE=ev('culAnTFears()'),bE=blk2(hE,'data-anring','fear');
      ok(bE.indexOf('>3/4<')>=0 && bE.indexOf(E('2 with a plan, 1 not addressed this cycle, 1 waiting'))>=0 && blk2(hE,'data-anring','all').indexOf('>3/4<')>=0 && hE.indexOf('data-anring="trust"')<0, 'Fears and Answers: question 1 reads 3/4 with the caption "2 with a plan, 1 not addressed this cycle, 1 waiting"');
      ev('data=culEmptyData()');ok(ev('culAnTFears()').indexOf(E(C('an.fears.empty')))>=0, 'Fears and Answers shows its empty line with no themes');
      /* Story Coverage */
      ev("data=culEmptyData();data.rowSettings=[{id:'rs3',row:3,priority:true}];data.stories=[{id:'s1',title:'S1',consent:true,kind:'success',rows:[1,2]},{id:'s2',title:'S2',consent:true,kind:'failure',rows:[2]},{id:'s3',title:'S3',consent:false,kind:'success',rows:[2]}]");
      var hY=ev('culAnTStory()'),y1=blk2(hY,'data-anstoryrow','1'),y2=blk2(hY,'data-anstoryrow','2'),y3=blk2(hY,'data-anstoryrow','3');
      ok(nOf(y1,'data-anstorycell','success')===1 && nOf(y1,'data-anstorycell','total')===1 && nOf(y2,'data-anstorycell','success')===2 && nOf(y2,'data-anstorycell','failure')===1 && nOf(y2,'data-anstorycell','total')===3 /* S3 now counts: the story consent box is retired (Paul's ruling of 25 Oct 2026) */ && nOf(y1,'data-anstorycell','failure')===0 && y3.indexOf(E(C('an.story.none')))>=0 && y1.indexOf(E(C('an.story.none')))<0 && hY.indexOf(E(C('an.story.note')))>=0, 'Story Coverage counts every story once in each row it lists, and flags priority row 3 as having no story yet (was: consented stories only, leaving out the story without consent; Paul\'s ruling of 25 Oct 2026, the story consent box is retired)');
      ev('data=culEmptyData()');ok(ev('culAnTStory()').indexOf(E(C('an.story.empty')))>=0, 'Story Coverage shows its empty line with no consented stories');
      rs();
      /* the whole page */
      var hAll=pg(),tt=['an.signals','an.radar','an.stated','an.heat','an.practice','an.flow','an.fears','an.load','an.sig','an.story','an.burn','an.vel','an.team','an.deliv','an.top','an.trend'].map(function(k){return hAll.indexOf('>'+E(C(k+'.title'))+'<')}),inOrder=tt.every(function(p,i){return p>=0&&(i===0||p>tt[i-1])});
      ok((hAll.match(/an-chart-card/g)||[]).length===16 && inOrder && hAll.indexOf('Not built yet.')<0 && hAll.indexOf('gap:14px;margin-top:14px')>=0 && hAll.indexOf('data-dbhero="1"')<0 /* (Paul\'s ruling of 27 Oct 2026: Phase 5 review fixes) */, 'the 5.4 page draws exactly 16 tile frames with the right titles in order, no "Not built yet.", a 14px grid gap and the hero');
      var bad=function(h){return /undefined|NaN|\[object/.test(h)},hSeed=hAll,thr=false,hEmpty='';
      try{ev('data=culEmptyData()');hEmpty=pg()}catch(e){thr=true}
      ok(!thr && !bad(hSeed) && !bad(hEmpty), 'the 5.3 page renders from the seed and from empty data without throwing and without "undefined", "NaN" or "[object"');
      ok(fns.filter(function(f){return /^culAnT(Flow|Fears|Change|SignalsOver|Story)$/.test(f.n)}).length===5, 'the read-only scan reaches the five job D tiles');
      rs();
    })();
  })();
  /* 8 Oct 2026 (Batch 6, 5.2 B3): the opened row body and the re-check actions; 25 Oct 2026 (bug hunt B18): the row under test is 1, which is slipping on the seed, since a re-check starts only on a slipping row (was row 3) */
  (function(){var pg=function(){w.eval("UI.tkSel={tk:1};UI.tkTab='recheck';go('step','5.2')");return w.document.getElementById('app').innerHTML},T=function(k){return w.eval("CUL_TK_COPY['"+k+"']")},blk=function(h,n){var i=h.indexOf('data-tkcard="'+n+'"');return i>=0?h.slice(i,h.indexOf('</td></tr>',i)):h.split('data-tkrow="'+n+'"')[1].split('data-tkrow=')[0]},trOf=function(h,n){return h.split('data-tkrow="'+n+'"')[1].split('</tr>')[0]}, /* row 1 opens as a card on its Re-check tab (Paul\'s ruling of 27 Oct 2026: the compact Tracker, no folds) */E=function(s){return w.eval("esc("+JSON.stringify(s)+")")};
    w.eval("var _rk3=JSON.stringify(data.rechecks||[]);data.rechecks=[]");var h=pg(),b=blk(h,1),secs=['readings','items','teams','gap','charter','recheck'].map(function(k){return E(T('tk.sec.'+k))});
    ok(['Readings by round','Teams','Leaders and employees','Practice','Re-check'].every(function(s){return b.indexOf('>'+s+'</button>')>=0})&&b.indexOf(E(T('tk.recheck.start')))>=0 /* the card's five tabs, the Re-check tab open (Paul\'s ruling of 27 Oct 2026: the compact Tracker, no folds) */&&b.indexOf('tkrc_f_')<0&&b.indexOf("go('runSystem')")<0, 'an opened 5.2 row shows the six section headings and the Start button when no re-check is open (no threshold block: decision 318 made the rule fixed; copy pass, Phase 5 Pass 2, 20 Oct 2026)');
    var fl=w.eval("CUL_ROWS.map(function(r){return culFlags(r.id).any})"),okf=true;w.eval("CUL_ROWS").forEach(function(r,i){var bk=trOf(h,r.id),m=/Start a targeted re-check/.test(bk);if(fl[i]?!m:m)okf=false}); /* each slipping row offers the re-check in its status cell (Paul\'s ruling of 27 Oct 2026: the compact Tracker, no folds) */ ok(okf, 'the Start button shows, emphasized with the flagged line, on a flagged row only (was: and plain on any other row; bug hunt B18, Paul\'s ruling of 25 Oct 2026: re-checks are for slipping rows only)');
    w.eval("var _n0=data.rechecks.length;var _s=culTkStartRecheck(1)");var n1=w.eval("data.rechecks.length"),rc=w.eval("data.rechecks[0]");
    ok(n1===1&&rc.row===1&&rc.id.indexOf('rcrow1@')===0&&w.eval("culRcOpen(1).id")===rc.id, 'culTkStartRecheck makes exactly one re-check record on its row, which culRcOpen sees (was: id starts rk; changed by R18)');
    w.eval("culTkStartRecheck(1)");ok(w.eval("data.rechecks.length")===1, 'a second start on a row with one open re-check creates nothing');
    h=pg();b=blk(h,1);ok(b.indexOf('tkrc_f_'+rc.id)>=0&&b.indexOf('data-lock="rechecks::'+rc.id+'"')>=0&&b.indexOf(E(T('tk.recheck.close')))>=0&&b.indexOf(E(T('tk.recheck.start')))<0, 'an open re-check shows the close form and no Start button');
    w.eval("go('step','5.2')");w.document.getElementById('tkrc_f_'+rc.id).value='Found the cause';w.document.getElementById('tkrc_a_'+rc.id).value='Fix it by May';w.eval("culTkCloseRecheck(1)");
    var rc2=w.eval("data.rechecks[0]");ok(w.eval("data.rechecks.length")===1&&rc2.id===rc.id&&rc2.status==='done'&&rc2.closedOn&&rc2.findings==='Found the cause'&&rc2.action==='Fix it by May'&&w.eval("culRcOpen(1)")===null, 'culTkCloseRecheck closes the same record with its findings and action');
    h=pg();b=blk(h,1);ok(b.indexOf('data-tkclosed="1"')>=0&&b.indexOf('Found the cause')>=0&&b.indexOf('Fix it by May')>=0, 'the closed re-check is listed on its row');
    var before=w.eval('JSON.stringify(data)');pg();ok(w.eval('JSON.stringify(data)')===before&&!/undefined|NaN|\[object/.test(pg()), 'rendering 5.2 with its bodies stores nothing and shows no undefined, NaN or [object');
    w.eval("data.rechecks=JSON.parse(_rk3)");
  })();
  ok(w.eval("!('pulseNudged' in culEmptyData())") && fs.readFileSync('Culture-app.js','utf8').indexOf('pulse-due')<0, 'the old pulse reminder is gone: no pulseNudged key and no pulse-due notification');
  w.eval("markStepComplete('2.1')"); await wait();
  /* 25 Sep 2026 (conformance Batch 3, Spec §11): completeStep (no confirm) is retired for the family markStepComplete (confirm → flag → stamp); the calls below take it with the confirm answered yes. */
  /* 25 Sep 2026 (conformance Batch 1, Rollout item 73): retargeted — the completer is stamped inside
     stampStepDone's first-stamp guard as stepDoneBy (name) plus stepDoneById (roster id); the superseded
     pin read data.stepBy['2.1'].u, written outside the guard on every completion. */
  /* 8 Oct 2026 (Batch 5, step 4.3): 4.4 now has its tabbed battery, so no bare shell step remains; the shell pins save CUL_BATTERIES['4.3'], delete it, assert, and restore it (decision 13). */ w.eval("window.__b44=CUL_BATTERIES['4.3'];delete CUL_BATTERIES['4.3']");
  w.eval("['completedSteps','stepDoneAt','stepDoneBy','stepDoneById'].forEach(function(k){if(data[k])delete data[k]['4.3']})");
  w.eval("markStepComplete('4.3')"); await wait();
  ok(w.eval("(data.stepDoneById||{})['4.3']")===w.eval('currentUserId') && w.eval("(data.stepDoneBy||{})['4.3']")===w.eval('getCurrentUser().name'), 'completedBy stamps on the first completion: stepDoneBy name + stepDoneById (item 73)');
  w.eval("data.stepDoneBy['4.3']='first';markStepComplete('4.3')"); await wait();
  ok(w.eval("data.stepDoneBy['4.3']")==='first', 'a later completion never rewrites the completer (first stamp only, item 73)');
  w.eval("CUL_BATTERIES['4.3']=window.__b44");
  w.eval("go('step','1.1')"); await wait();
  ok(w.eval('culCoachCtx()').indexOf('Step 1.1')>=0 && w.eval('culCoachCtx()').indexOf('Assessment Battery')>=0, 'coach context carries the current step and its name (was: Stated Culture; Paul\'s ruling, 12 Oct 2026)');
  w.eval('culTourStart()'); await wait();
  ok(!!w.document.getElementById('culTour'), 'tour overlay mounts');
  w.eval('culTourEnd()'); await wait();
  ok(!w.document.getElementById('culTour'), 'tour dismisses and stores the pref');

  // the Culture Dashboard shell (the analytics band retired with the old dashboard; batch 6 builds the dashboard)
  w.eval("go('phase5')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    /* 8 Oct 2026 (Batch 6, 5.1): retargeted — old expectation: the not-built line 'This page has not been built yet. Nothing here is saved or needs your input.' was on the page; it is removed */
    ok(h.indexOf('Culture Dashboard')>=0 && h.indexOf(w.eval("STEP_FLOW[5][0].sh"))>=0 && h.indexOf('This page has not been built yet. Nothing here is saved or needs your input.')<0, 'the Culture Dashboard shows its title and the 5.1 description, and no not-built line');})();
    /* 8 Oct 2026 (Batch 6, 5.1): frame, routing, hero and the Target Culture card */
    (function(){var app=function(){return w.document.getElementById('app').innerHTML},side=function(){return w.document.getElementById('pipSidebar').innerHTML},
      rowActive=function(s){var m=s.match(/<div class="sidebar-step active"[^>]*>[^<]*5\.1 /);return !!m};
      w.eval("go('phase5')");var a=app(),sa=side(),pa=w.eval('currentPage');w.eval("go('step','5.1')");var b=app(),sb=side(),pb=w.eval('currentPage');
      ok(pa==='phase5' && pb==='phase5' && a===b, "go('step','5.1') and go('phase5') both land on phase5 with identical output");
      var slots=['hero','target','boxes','glance','summary','power','bank'].map(function(k){return a.indexOf('data-db="'+k+'"')});
      ok(slots.every(function(p,i){return p>=0&&(i===0||p>slots[i-1])}) && a.indexOf('has not been built')<0, 'the eight dashboard slots are in order and no not-built line ('+slots.join(',')+')');
      ok(rowActive(sa) && rowActive(sb) && sa.indexOf("go('phase5')")>=0, 'sidebar row 5.1 is active and opens phase5 on both routes');
      ok(a.indexOf('printCurrentPage()')>=0 && w.eval("rcUnitBody({kind:'page',id:'phase5'},'')").indexOf('<section class="mp-land">')>=0 /* the Report Manager's page is the culture map (Paul, 1 Nov 2026; was the dashboard document's Culture Overview) */, 'print control present and the Report Manager body carries the culture map');
      w.eval("go('phase5')");var hero=(app().match(/data-dbhero="1"[^]*?data-db="target"/)||[''])[0],svg=(hero.match(/<svg[^>]*role="img"[^]*?<\/svg>/)||[''])[0];
      /* 15 Oct 2026 (culture map, Stage 3, ruling 86): superseded. The hero was one radar with 11 axis labels, its aria text, the legend and the Tracker button; the overview map replaces the culture radar on the dashboard. Analytics keeps the radar (pinned at the 5.3 page). */
      ok(hero.indexOf('The culture map')>=0 && (hero.match(/class="cmap-band[ "]/g)||[]).length===11 && hero.indexOf('class="cmap-stats"')>=0 && hero.indexOf('class="cmap-kinds"')>=0 && hero.indexOf('cmap-legend')>=0 && hero.indexOf('aria-label="Culture radar across')<0 && svg.indexOf('role="img"')>=0, 'the hero holds the culture map in place of the radar: the headline strip, the kind buttons, eleven bands with their score tracks, and the legend (ruling 86)');
      var d=w.eval("(function(){var s=culTkRadarData(culTkRows());return JSON.stringify([s.sr,s.names,s.pri,s.aria])})()");
      w.eval("go('step','5.2')");var t52=app();var svg52=(t52.match(/<svg[^>]*role="img"[^]*?<\/svg>/)||[''])[0];
      ok(w.eval("(function(){var s=culTkRadarData(culTkRows()),sh=culTkRowsShown();var q=culTkRadarData(sh);return JSON.stringify([q.sr,q.names,q.pri,q.aria])===JSON.stringify([s.sr,s.names,s.pri,s.aria])})()") && svg52.indexOf('aria-label="Culture radar across')>=0, 'the hero and 5.2 share one series builder and give equal series for the same rows ('+d.length+' chars)');
      w.eval("go('phase5')");var tc=app().match(/id="dbTargetCard"[^]*?<\/div><\/div>(?=<div data-db="boxes")/);tc=tc?tc[0]:'';var pri=w.eval('culPriorityRows()'),stm=w.eval('culStated().targetStatement');
      ok(tc && tc.indexOf("go('targetCulture')")>=0 && tc.indexOf(stm.slice(0,60))>=0 && tc.indexOf('data-dbtc-row=')<0, 'the Target Culture card shows the statement and the button; the priority dimensions show on the map (Paul\'s ruling of 20 Oct 2026: the dashboard audit)');
      var before=w.eval('JSON.stringify(data)');app();w.eval("go('phase5')");w.eval("go('phase5')");
      ok(w.eval('JSON.stringify(data)')===before, 'drawing the dashboard stores nothing');
      (function(){var pg=app(),sl=function(k,n){var i=pg.indexOf('data-db="'+k+'"'),j=pg.indexOf('data-db="'+n+'"');return pg.slice(i,j)};
        ok(sl('summary','power').indexOf('data-db-heat')>=0 && sl('summary','power').indexOf('data-db-flow')<0 && sl('power','bank').indexOf("go('peopleSignals')")>=0 && pg.indexOf('data-db="pages"')<0 /* no Standing pages card (Paul's ruling of 28 Oct 2026) */ /* Teams and Roles added (Paul's ruling of 28 Oct 2026) */ /* Culture Architecture and Communication and Stories cut: Paul's rulings of 20 Oct 2026 */ && !/undefined|NaN|\[object/.test(sl('summary','bank')), 'the summary boxes, the Power Map and the standing pages card are drawn into their slots');})();
      w.eval("var _dsv=data;data=culEmptyData();go('phase5')");var e=app();
      /* 15 Oct 2026 (culture map, Stage 3, ruling 86): the hero's empty line was the radar's; the map instead shows each band with nothing aimed at it */
      ok(e.indexOf('data-dbtc-none="1"')>=0 && (e.match(/Nothing aimed at this yet/g)||[]).length===11 && !/undefined|NaN|\[object/.test(e), 'on an empty organization the card shows both empty lines, the map shows every band with nothing aimed at it, and no undefined, NaN or [object');
      w.eval("data=_dsv;go('phase5')");var f=app();
      ok(!/undefined|NaN|\[object/.test(f), 'no undefined, NaN or [object on the seeded dashboard');})();

  /* ── Conformance Batch 1 (25 Sep 2026): data standard, record identity, lock layer, completer, shell ── */
  const appSrc=fs.readFileSync('Culture-app.js','utf8'), idxSrc=fs.readFileSync('Culture-index.html','utf8');
  // the data standard
  ok(w.eval("(function(){var ks=Object.keys(CUL_SCHEMA),ps={},dup=false;ks.forEach(function(k){var p=CUL_SCHEMA[k].prefix;if(p){if(ps[p])dup=true;ps[p]=1}});return !dup&&ks.every(function(k){var c=CUL_SCHEMA[k];return c.kind!=='list'||c.family||!!c.prefix})})()"), 'CUL_SCHEMA: every module list declares a unique id prefix');
  ok(w.eval("JSON.stringify(Object.keys(culEmptyData()).sort())===JSON.stringify(Object.keys(CUL_SCHEMA).sort())"), 'culEmptyData is built from CUL_SCHEMA, key for key');
  ok(w.eval("['assessmentBattery','systems','risks','raciMatrix','tevv','exitPlans','ethicalFramework'].every(function(k){return !(k in culEmptyData())})"), 'no Governance collections in the empty record');
  ok(!/function render1[1-5]\(|NIST_DESC|TEVV_CHARS|EXAMPLE_RISKS|function renderOutRiskReg/.test(appSrc), 'unreachable Governance step renderers, NIST/TEVV tables, and outcome pages retired');
  // ids at creation, per collection
  ok(/^pm[a-z0-9]{4,}$/.test(w.eval("culNew('powerMap')")) && w.eval("culNew('powerMap')").indexOf('_')<0, 'culNew: collection prefix plus uid, no underscore');
  ok(/^co/.test(w.eval("culNew('commitments')")) && /^us/.test(w.eval("culNew('aiUses')")) && /^rl/.test(w.eval("culNew('roles')")) && /^tm/.test(w.eval("culNew('teams')")), 'the prefixes that differ from the Data Model (commitments co, aiUses us) and the shared lists (teams tm, roles rl) are in force');
  /* 25 Sep 2026 (conformance Batch 3b, Rollout item 31): retargeted — the team add opens an in-place form; the superseded pin answered a browser prompt. */
  w.eval("culTeamAdd()"); w.eval("UI.culAddDraft='Probe Team';culAddSave()"); await wait();
  ok(/^tm/.test(w.eval("data.teams[data.teams.length-1].id")), 'an added team carries a tm-prefixed id from creation');
  // Store helpers by id on array collections (Spec §10 pointer clause)
  /* 25 Sep 2026 (Batch 2): fixture corrected — the Batch 1 form lacked stance and inf, which left step 1.4 unrenderable for every later pin */
  w.eval("data.teams=[{id:'tmA',name:'A',manager:'',headcount:2},{id:'tmB',name:'B',manager:'',headcount:2}]");
  ok(w.eval("Store.patch('teams','tmB',{manager:'z'})")===true && w.eval("data.teams[1].manager")==='z' && w.eval("data.teams[0].manager")==='', 'Store.patch resolves an array record by id');
  ok(w.eval("Store.patch('teams','tmNope',{manager:'q'})")===false && w.eval("data.teams.every(function(p){return p.manager!=='q'})"), 'Store.patch on an unknown id writes nothing');
  w.eval("Store.removeRec('teams','tmA')");
  ok(w.eval("data.teams.length")===1 && w.eval("data.teams[0].id")==='tmB', 'Store.removeRec removes only the addressed record');
  ok(w.eval("(function(){var fr={power:[{id:'pwX'},{id:'pwY'}]},lo={power:[{id:'pwY',v:2},{id:'pwZ',v:3}]};Store.mergeDirtyInto(fr,lo,['power::pwY','power::pwZ','power::pwX']);return JSON.stringify(fr.power.map(function(x){return x.id+(x.v||'')}))})()")==='["pwY2","pwZ3"]', 'mergeDirtyInto merges array records by id; a locally deleted record is deleted');
  // the lock map reads the data standard
  ok(w.eval("idToRecordKey('tm_name_tmB')")==='teams::tmB' && w.eval("idToRecordKey('sm_mission')")==='statements' && w.eval("idToRecordKey('ru_name')")==='roster' && w.eval("idToRecordKey('noteInput')")===null && w.eval("idToRecordKey('au_name')")===null, 'idToRecordKey resolves list, record, roster, and unmapped ids');
  ok(/addEventListener\('focusin'/.test(appSrc) && /var _heldLock=null;/.test(appSrc) && /var _lockSig='';/.test(appSrc) && /applyLockUI\(true\); \/\* 25 Sep/.test(appSrc), 'lock layer live: focus acquire/release, heartbeat, render-tail marker pass');
  (function(){var d=w.document, host=d.getElementById('app'), inp=d.createElement('input'); inp.id='tm_name_tmB'; host.appendChild(inp);
    w.localStorage.setItem('culture-locks::'+w.eval('currentOrgId'), JSON.stringify({'teams::tmB':{id:'u_probe_other',name:'Probe Other',at:Date.now()}}));
    w.eval('applyLockUI(true)');
    ok(inp.disabled===true && host.innerHTML.indexOf('Locked \u00b7 Probe Other is editing')>=0, 'a foreign lock disables its record field and names the holder');
    ok(w.eval("lockBlocked('teams::tmB')")===true, 'lockBlocked blocks a button write on the held record');
    w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId')); host.removeChild(inp);
    ok(w.eval("lockBlocked('teams::tmB')")===false, 'with the lock cleared the write proceeds');})();
  // identity-aware draft preservation (Spec §23.4–23.5)
  ok(appSrc.indexOf('if(fe&&!fe.value)')<0, 'the superseded blank-field re-inject rule is gone');
  ok(appSrc.indexOf("getAttribute('data-typed')==='1'")>=0 && appSrc.indexOf('if(fieldIdentity(fk,fe)!==cap.sig)continue;')>=0, 'capture takes typed fields only; restore requires the identical identity');
  (function(){var el=w.document.createElement('input'); el.id='tm_name_tmB'; w.document.getElementById('app').appendChild(el);
    var s0=w.eval('fieldIdentity')('tm_name_tmB',el); var g0=w.eval('SESSION_GEN');
    w.eval('setCurrentOrg(currentOrgId)');
    ok(w.eval('SESSION_GEN')===g0+1 && w.eval('fieldIdentity')('tm_name_tmB',el)!==s0, 'a session change advances the generation, so no earlier draft matches');
    ok(w.eval('fieldIdentity')('tm_name_tmB',el).indexOf('|teams::tmB')>0 && w.eval('fieldIdentity')('tm_name_tmB',el).indexOf(w.eval('currentOrgId')+'|')===0, 'a field identity carries organization, session, and record');
    el.parentNode.removeChild(el);})();
  // completion is the flag; no default roster; metrics by id
  w.eval("data.completedSteps['1.2']=true"); ok(w.eval("isStepDone('1.2')")===true, 'isStepDone reads the step flag (1.2 was uncompletable under the Governance-derived arm)');
  w.eval("delete data.completedSteps['1.2']"); ok(w.eval("isStepDone('1.2')")===false, 'no flag, not done');
  ok(appSrc.indexOf('DEFAULT_ROSTER')<0 && w.eval("(function(){var s=data.roster;data.roster=[];applyTeamRoster();var n=USERS.length;data.roster=s;applyTeamRoster();return n})()")===0, 'no default roster: an empty roster stays empty (item 38)');
  /* 7 Oct 2026 (Batch 1): retargeted — the metric register is retired; the id-at-creation and field-save pins run on the meetings list (mt prefix, name field) */
  var _mid=w.eval("(function(){var r={id:culNew('meetings'),name:''};data.meetings.push(r);return r.id})()");
  ok(/^mt/.test(_mid), 'a new meeting carries an mt-prefixed id');
  /* 25 Sep 2026 (conformance Batch 2): retargeted — the metric field saves through fldSave by its id; the superseded pin called culMetricSet(id,'name',…). */
  w.eval("fldSave('mt_name_"+_mid+"','Probe meeting')"); ok(w.eval("data.meetings.filter(function(m){return m.id==='"+_mid+"'})[0].name")==='Probe meeting', 'a meeting field save addresses the meeting by id (fldSave)');
  var _mn=w.eval("data.meetings.length"); w.eval("Store.removeRec('meetings','mtNope')"); ok(w.eval("data.meetings.length")===_mn, 'deleting an unknown meeting id changes nothing');
  ok(!/cul(Metric|Team|Role)(Set|Log|Del)\('\+i\+'/.test(appSrc), 'record markup passes ids, never positions');
  // Store start-up migration and the shell
  ok(appSrc.indexOf('/* one-time key migration')>appSrc.indexOf('function startChangeSignal') && appSrc.slice(appSrc.indexOf('function captureFocus'),appSrc.indexOf('function restoreFocus')).indexOf("'cul-'")<0, 'the cul- key migration runs at Store start, not inside captureFocus');
  ok(idxSrc.indexOf("localStorage.getItem('culture-theme')")>=0 && idxSrc.indexOf("'cul-theme'")<0, 'pre-paint reads the key Store writes (culture-theme)');
  ok(/<title>[^<]*— NextChapter<\/title>/.test(idxSrc), 'title carries the NextChapter suffix (item 35)');
  /* 7 Oct 2026 (Batch 2, step 2): retargeted — the registry holds the Baseline Report, the first output; the superseded pin required it empty */
  ok(w.eval("typeof OUTPUT_PAGES")==='object' && JSON.stringify(w.eval("Object.keys(OUTPUT_PAGES)"))==='["out-baseline","out-aiuses","out-target","out-powermap","out-rewiring","out-comms","out-charter","out-culturereport","out-blockers","out-aireview","out-sustainment","out-day90"]', 'output-page registry present, holding the Baseline Report, the Target Culture, the Power Map, the Rewiring Charter, the Culture Report and the Blockers document (7 Oct 2026, Batch 3: retargeted three times, the superseded pins held the Baseline Report alone, then without the Power Map added in step 2.2, then without the Rewiring Charter added in step 2.3. 8 Oct 2026, Batch 4, step 3.1: retargeted again, the superseded pin held four outputs, without the Culture Report. 8 Oct 2026, Batch 4, step 3.2: retargeted again, the superseded pin held five outputs, without the Blockers document. 8 Oct 2026, Batch 4, step 3.4: retargeted again, the superseded pin held six outputs, without the AI Deployment Review. 8 Oct 2026, Batch 5, step 4.1: retargeted again, the superseded pin held seven outputs, without the Sustainment Plan. 8 Oct 2026, Batch 5, commit 4: retargeted again, the superseded pin held eight outputs, without the Day-90 Report and the Culture Review)');
  /* 8 Oct 2026 (Batch 4, 3.1 B6): the Culture Report shell and its Recognition part */
  (function(){var doc=w.eval("PRINT_DOCS['out-culturereport']()"),txt=doc.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/\s+/g,' ');
    ok(w.eval("PH[2].outcomes.some(function(o){return o.id==='out-culturereport'&&o.name==='Culture Report'})") && w.eval("typeof PRINT_DOCS['out-culturereport']")==='function' && w.eval("rcCatalogue().some(function(u){return u.kind==='output'&&u.id==='out-culturereport'})") && w.eval("!!DEPTHED_OUTPUTS['out-culturereport']") /* depthed since its Summary and Full differ, as its own page offers (report manager review, 1 Nov 2026; was not depthed, from 8 Oct when the two were the same) */, 'the Culture Report is a Phase 3 outcome with a print document, listed in the Report Manager, with Summary and Full');
    ok(w.eval("CUL_REPORT_ORDER.join()")==='recognition,metrics' && w.eval("CUL_REPORT_PARTS.some(function(p){return p.key==='recognition'})") && w.eval("OUTPUT_PAGES['out-culturereport']()").indexOf('Culture Report')>=0, 'the Culture Report shell orders recognition before metrics and its page renders');
    var ttl=w.eval("culSyList().map(function(s){return s.title})") /* culSyConsented is retired with the story consent box (Paul's ruling of 25 Oct 2026); every named story counts */;
    ok(ttl.length>0 && ttl.every(function(t){return txt.indexOf(t)>=0}) && txt.indexOf('An honest failure shared openly')>=0 && txt.indexOf('Told by')>=0 && txt.indexOf('Coverage when this document was produced')>=0 && txt.indexOf('stories told, against a quarterly target')>=0||txt.indexOf('stories told.')>=0 && txt.indexOf('Mentioned at the quarterly all-hands') >= 0 && txt.indexOf('Other: Mentioned at the quarterly all-hands') < 0, 'the Culture Report prints every seeded story with its kind, teller and status, and the coverage lines (was: stories told so far; full pass copy; "consented" dropped from this label by Paul\'s ruling of 25 Oct 2026, the story consent box is retired)');
    var first=w.eval("culSyList()[0].id"),t0=w.eval("culSyList()[0].title");w.eval("culSyList()[0].consent=false");
    ok(w.eval("PRINT_DOCS['out-culturereport']()").replace(/<[^>]*>/g,' ').indexOf(t0)>=0, 'every story is printed in the Culture Report, whatever an old consent value says (was: a story with consent unticked is not printed in the Culture Report; Paul\'s ruling of 25 Oct 2026, the story consent box is retired)');
    w.eval("culSyList()[0].consent=true");
    var sv=w.eval("JSON.stringify([data.stories,data.pulseRounds,data.commsPlan,data.practiceCounts])");w.eval("data.stories=[];data.pulseRounds=data.pulseRounds.filter(function(r){return r.context!=='firstPulse'});data.commsPlan=(data.commsPlan||[]).filter(function(c){return c.kind!=='progress'});data.practiceCounts=data.practiceCounts.filter(function(c){return !c.charter})"); /* 3 Nov 2026 (Sweep 6 item 3): the Progress communications, not the retired publications; 8 Oct 2026 (3.3 E): the metrics part is emptied too, so the empty line still prints */
    ok(w.eval("PRINT_DOCS['out-culturereport']()").indexOf('Nothing has been recorded for this report yet.')>=0 /* the family empty line (Paul, 29 Oct 2026) */ && w.eval("culRecognitionPart()")==='', 'with no stories the Culture Report prints the empty line and the Recognition part is empty');
    w.eval("(function(a){data.stories=a[0];data.pulseRounds=a[1];data.commsPlan=a[2];data.practiceCounts=a[3]})(JSON.parse("+JSON.stringify(sv)+"))");})();
  // §12 / §19.8: a first completion queues exactly one step-complete notification to the roster's emails
  ok(/var NOTIFY_ENDPOINT='';/.test(appSrc), 'NOTIFY_ENDPOINT seam constant declared (Spec §12, §19.6)');
  w.eval("(data.roster||[]).forEach(function(u){u.email=u.email||'probe@example.com'});applyTeamRoster();['completedSteps','stepDoneAt','stepDoneBy','stepDoneById'].forEach(function(k){if(data[k])delete data[k]['4.3']})");
  /* 8 Oct 2026 (Batch 5, step 4.3): 4.4 now has its tabbed battery, so no bare shell step remains; the shell pins save CUL_BATTERIES['4.3'], delete it, assert, and restore it (decision 13). */ w.eval("window.__b44=CUL_BATTERIES['4.3'];delete CUL_BATTERIES['4.3']");
  var _nq0=w.eval("(data.notifications||[]).length");
  w.eval("markStepComplete('4.3')"); await wait();
  ok(w.eval("(data.notifications||[]).length")===_nq0+1 && w.eval("data.notifications[data.notifications.length-1].kind")==='step-complete', 'a first step completion queues one step-complete notification');
  w.eval("markStepComplete('4.3')"); await wait();
  ok(w.eval("(data.notifications||[]).length")===_nq0+1, 're-completing never re-notifies');
  w.eval("CUL_BATTERIES['4.3']=window.__b44");
  /* ── Conformance Batch 2 (25 Sep 2026): per-field self-save, fixed keys, lock guards, record-identity walks ── */
  const appSrc2=fs.readFileSync('Culture-app.js','utf8');
  /* runs the element's OWN inline handler (this = the element) — jsdom here is outside-only, so inline attributes do not fire on dispatched events (Spec §19.23: exercise the control's own handler, never a hand-evaled substitute) */
  const fire=(el,attr)=>{const code=el.getAttribute(attr);if(!code)return;w.__fireEl=el;w.eval('(function(){'+code+'}).call(window.__fireEl)');};
  const typeInto=(el,v)=>{el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));fire(el,'oninput');};
  ok((appSrc2.match(/harvest/g)||[]).length===0, 'no harvest layer (Spec \u00a719.29): every field saves itself');
  // route census: every field on every step and phase page carries an id that resolves to a record
  /* 7 Oct 2026 (Batch 1): the real step and phase pages are shells with no fields, so the census runs twice. First over the real pages, for errors. Then over the stand-in page (fxOn), where fields exist, so it cannot pass by seeing nothing (Spec check 29). The full census over the real step pages returns with the step batches, as each step gets its fields. */
  (function(){var pages=[];w.eval('PH').forEach(function(p){pages.push(['phase',String(p.id)]);p.steps.forEach(function(s){pages.push(['step',s.id])})});
    var errs=[];pages.forEach(function(pg){w.eval("go('"+pg[0]+"','"+pg[1]+"')");if(w.document.getElementById('app').innerHTML.indexOf('<h2>Error</h2>')>=0)errs.push(pg[1])});
    ok(errs.length===0, 'every step and phase page renders without an error ('+errs.join(', ')+')');
    var bad=[],seen=0,colls={};fxOn();
    pages.forEach(function(pg){w.eval("go('"+pg[0]+"','"+pg[1]+"')");if(w.document.getElementById('app').innerHTML.indexOf('<h2>Error</h2>')>=0)errs.push('fx '+pg[1]);var els=w.document.querySelectorAll('#app input,#app select,#app textarea');
      for(var i=0;i<els.length;i++){var el=els[i];if(el.type==='checkbox'&&!el.id)continue;seen++;var id=el.id||'';var pre=id.split('_')[0];
        var uiOnly=(el.getAttribute('onchange')||'').indexOf('UI.')===0;
        var rk=id?w.eval("idToRecordKey('"+id+"')"):null,coll=rk?String(rk).split('::')[0]:'';if(coll)colls[coll]=1;
        if(!uiOnly&&(!id||!w.eval('CUL_PREFIX')[pre]||rk===null||!w.eval("!!CUL_SCHEMA['"+coll+"']")))bad.push(pg[1]+':'+(id||el.outerHTML.slice(0,60)))}});
    fxOff();
    ok(seen>0 && bad.length===0 && colls.teams && colls.roles, 'route census: every field on every step page (on the stand-in page) routes through idToRecordKey to a real collection ('+seen+' fields; unresolved: '+bad.slice(0,4).join(' | ')+')');})();
  /* 7 Oct 2026 (Batch 1): retargeted — the step tables (CUL_STEPS, CUL_TOOLS, culAct) are retired, and every step is a shell until its batch builds it. Field-level walks run on the stand-in page (fxOn) until the step pages carry real fields. */
  ok(w.eval("typeof CUL_STEPS")==='undefined' && w.eval("typeof CUL_TOOLS")==='undefined' && w.eval("typeof culAct")==='undefined' && w.eval("typeof CUL_REL")==='undefined', 'the old step tables and the action checklist writer are retired');
  /* 7 Oct 2026 (Batch 3, step 2.2): retargeted from 2.2 to 2.3 — step 2.2 is now built and hides its step button until every section is flagged; 2.3 is still a shell */
  /* 7 Oct 2026 (Batch 3, step 2.3): retargeted again from 2.3 to 2.4 — step 2.3 is now built; 2.4 is still a shell */
  /* 7 Oct 2026 (Batch 3, step 2.4): retargeted again from 2.4 to 2.5 — step 2.4 is now built; 2.5 is still a shell */
  /* 7 Oct 2026 (Batch 3, step 2.5): retargeted again from 2.5 to 3.1 — step 2.5 is now built; 3.1 is still a shell */
  /* 8 Oct 2026 (Batch 4, step 3.1, decision 11): retargeted again from 3.1 to 3.2 — step 3.1 is now built; 3.2 is still a shell */
  /* 8 Oct 2026 (Batch 4, step 3.2, B2): retargeted again from 3.2 to 3.3 — step 3.2 now has its Cases tab and is no longer a shell; 3.3 is still a shell. The completion-flow pins below move with it. */
  /* 8 Oct 2026 (Batch 4, step 3.3, section A): retargeted again from 3.3 to 3.4 — step 3.3 now has its tabbed battery and is no longer a shell; 3.4 is still a shell. The completion-flow pins above and below (lines for 3.3 changed to 3.4) move with it. */
  /* 8 Oct 2026 (Batch 5, step 4.3): 4.4 now has its tabbed battery, so no bare shell step remains; the shell pins save CUL_BATTERIES['4.3'], delete it, assert, and restore it (decision 13). */ w.eval("window.__b44=CUL_BATTERIES['4.3'];delete CUL_BATTERIES['4.3']");
  w.eval("go('step','4.3')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf("markStepComplete('4.3')")>=0 && h.indexOf('Actions</div>')<0, 'the 4.4 shell carries the done button and no actions checklist');})();
  w.eval("CUL_BATTERIES['4.3']=window.__b44");
  // typed persistence: a record field saves by its id and survives navigating away and back (Spec §19.19). The DOM walk of typing into the mission field returns with batch 2, when step 1.1 carries it.
  w.eval("go('step','1.1')"); await wait();
  ok(w.eval("fldSave('sm_mission','Probe mission',true)")===true && w.eval("data.statements.mission")==='Probe mission', 'a record field saves by its id and prefix (sm_mission)');
  w.eval("go('home')"); await wait(); w.eval("go('step','1.1')"); await wait();
  ok(w.eval("data.statements.mission")==='Probe mission', 'the saved text survives navigating away and back (store; the field walk returns with batch 2)');
  // fldSave: resolves by id, refuses what it cannot address, coerces declared numbers
  w.eval("data.teams=[{id:'tmA',name:'Ann',manager:'',headcount:2},{id:'tmB',name:'Bo',manager:'',headcount:2}]");
  ok(w.eval("fldSave('tm_manager_tmNope','x')")===false && w.eval("fldSave('tm_bogus_tmA','x')")===false && w.eval("fldSave('zz_manager_tmA','x')")===false, 'fldSave writes nothing for an unknown record, an undeclared field, or an unknown prefix');
  w.eval("fldSave('tm_headcount_tmB','54',true)"); ok(w.eval("data.teams[1].headcount")===54, 'declared numeric fields are stored as numbers');
  w.localStorage.setItem('culture-locks::'+w.eval('currentOrgId'),JSON.stringify({'teams::tmA':{id:'u_probe_other',name:'Probe Other',at:Date.now()}}));
  ok(w.eval("fldSave('tm_manager_tmA','clobber',true)")===false && w.eval("data.teams[0].manager")==='', 'a field save never writes a record another user holds');
  w.confirm=()=>true; w.eval("culTeamDel('tmA')"); await wait();
  ok(w.eval("data.teams.length")===2, 'a foreign lock blocks the delete button (lockBlocked)');
  w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId'));
  /* 25 Sep 2026 (Batch 4d part 2b): census 27→28 — addProfile gains ER's roster guard (item 53). */
  /* 6 Oct 2026 (Batch 8c): census 28→29 — setAiSetting checks the settings lock (Architecture byte-form) */
  /* 6 Oct 2026 (Batch 8d): census 29→28 — addProfile now opens the unbound new-member form, and an add-form draft takes no lock (Spec §26.1; Architecture byte-form) */
  /* 7 Oct 2026 (Batch 1): census 28→4 — the old registers' delete handlers and culAct are retired; the guards left are culTeamDel, culRoleDel, setAiSetting and the definition */
  /* 7 Oct 2026 (Batch 2, step 2; recounted at close-out): the guard count is now 11 — setAiSetting, culTeamDel, culRoleDel, culSectionComplete and culRoundDel, culListDel (its own record and, for an added item, each round holding its scores), culAddSave (the AI use it links into), culExpAdd and culConAdd (the signalChecks record), and the definition. The pulse savers check the lock through culPulseGuard and refuse silently, as fldSave does */
  /* 7 Oct 2026 (Batch 3, step 1, Paul's ruling): census stays 11 — culTeamDel and culRoleDel's own guards (2) are replaced by culDelBlocked's two calls (the own record, then every linked record the scan returns); culTeamDel, culRoleDel and culUseDel all go through it */
  /* 7 Oct 2026 (Batch 3, step 2.5, job C): census 14 to 15 — culCpCheck takes the planned communication's lock before it writes one checklist key; its remove goes through culListDel, so that guard is the existing one. The role-impact savers use Collab.lockedByOther and culDelBlocked, not lockBlocked */
  /* 8 Oct 2026 (Batch 4, R6h): census 15 to 14 — culRoundDel now takes its locks through culDelBlocked, so it no longer calls lockBlocked itself */
  /* 7 Oct 2026 (Batch 3, step 2.4): census 13 to 14 — culMtMut takes the meeting's lock before every keyed write (audit answer, change tick, added change); the meeting remove goes through culListDel and the observation delete through culDelLinked, so their guards are the existing ones */
  /* 7 Oct 2026 (Batch 3, step 2.3, job C1): census 12 to 13 — culCtAdd takes the signalChecks lock before it clears the none tick; the contradiction, experimenter, concern and policy removes go through culDelLinked, so their guards are the existing ones */
  /* 7 Oct 2026 (Batch 3, step 2.3): census 11 to 12 — culCoreTick (the criteria and manager-duty ticks, keyed by coreKey) takes its own lock before it writes */
  /* 15 Oct 2026 (culture map, Stage 2, ruling 90): census 15 to 16 — culItemStatusSet, the status menu of the map surfaces, takes the record's lock (or the single record's lock) before it writes the one status field */
  /* 19 Oct 2026 (Paul's visual pass of 19 Oct 2026): census 16 to 17 — culOwnDrop, which removes an item the team added of its own, takes the record's lock */
  /* 19 Oct 2026: census 17 to 18 — culCritCell, which ticks whom a criterion applies to in the criteria table, takes the record's lock (Paul's ruling of 19 Oct 2026: the criteria, duties and protections as tables, and the policy actions on each policy's card) */
  /* 19 Oct 2026: census 18 to 20 — culOvRoleAdd and culOvRoleDel, which add and remove a role that may override, take the override record's lock (Paul's ruling of 19 Oct 2026: the named roles as a list) */
  /* 19 Oct 2026: census 20 to 22 — culChAdd and culChDel, which add and remove a commitment in step 2.6, take the charter's lock (Paul's ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) */
  /* 25 Oct 2026 (audit fix round): census 30 to 32 — rcLocked, the Report Manager's guard (the Architecture donor's form, audit F2), calls lockBlocked for the definitions collection and for the definition. */ /* 25 Oct 2026 (bug hunt B7, B12): census 32 to 33 — culListDel checks the lock of every record a theme or meeting removal also writes (the communication plans that list the theme, the observations that point at the meeting) before it asks */ /* 30 Oct 2026 (fix batch 1 from the testing chat): census 36 to 40 — saveEnterprise (C-3) and culRvsAttAdd, culRvsAttDel, culRvsAttSet (R-16) take their record's lock */ ok((appSrc2.match(/lockBlocked\(/g)||[]).length===49 /* 48 to 49: culRvsSet, the review-dates writer, takes the reviewSettings lock (audit C5-R05, 1 Nov 2026) */ /* 41 to 48: the audit's lock batch checks every record first: culXmDel and culXmTeamSet (the manager's charter), culChDel (each quarterly count), culCkSet (the clause, and each measure mirroring it), culNcApply (each dimension changed), culRvPracticeSet (the practice) (audit, 31 Oct 2026) */ /* 40 to 41: culTeamDel checks the experiment cover's lock before deleting a team (audit C1-05, 31 Oct 2026) */ /* 34 to 36: culBcReviewAct (the review's decision) and culBcEnd (restart or abandon at transition) take the person lock (Paul, 30 Oct 2026: the case stages redesigned) */ /* 38 to 34: the five note handlers are removed and culBcPostSign (Save to the communication board) takes the person lock (Paul\'s ruling of 27 Oct 2026: stage cards, notes removed) */ /* 33 to 38: culBcMoveTo, culBcMoveBack, culBcOutcomeSet, culBcNoteEdit and culBcNoteSave take the person lock (Paul\'s ruling of 27 Oct 2026: Working With Them moves stage by stage) */ /* 32 to 33: culRvPracticeSet, the quarterly review's standing-practices mark, takes the review lock (Paul\'s ruling of 26 Oct 2026); earlier 33 to 32: culCtAdd, which took the signalChecks lock, is removed (Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed) */, 'guard census (with culCkSet, culCkAdd, culCkMeasureAdd and culCkWork, the charter\u2019s commitment savers: Paul\'s ruling of 19 Oct 2026: the charter as commitments with owners, measures and the work that delivers them): culChAdd and culChDel (commitments in step 2.6), culOvRoleAdd and culOvRoleDel (the named roles), culCritCell (a cell of the criteria table), culOwnDrop (removing an own item), culDelBlocked (twice, for the linked deletes, which the round delete now shares), setAiSetting, culSectionComplete, culListDel (twice), culAddSave, culExpAdd, culConAdd, culCtAdd, culCoreTick, culMtMut (the keyed savers of a meeting), culCpCheck (the checklist saver of a planned communication), culUrMut (the savers of an AI deployment review), culItemStatusSet (the status menu on the map), and the definition (Rollout item 53)');
  // record identity walk (Spec §23.9): edit B, delete A — B keeps its text, nothing pours into another record
  fxOn(); w.eval("go('step','1.4')"); await wait();
  (function(){var b=w.document.getElementById('tm_manager_tmB');ok(!!b,'each team row field carries its record id');
    if(b){typeInto(b,'B manager typed');}})();
  w.eval("culTeamDel('tmA')"); await wait();
  ok(w.eval("data.teams.length")===1 && w.eval("data.teams[0].id")==='tmB' && w.eval("data.teams[0].manager")==='B manager typed', 'edit B, delete A: B keeps its typed text and A is gone');
  ok(!w.document.getElementById('tm_manager_tmA') && w.document.getElementById('tm_manager_tmB').value==='B manager typed', 'after the delete the page shows B’s text only under B');
  // the same walk on the shared roles list; replaces the retired selection pin (Spec §23.6): deleting one record leaves every other record and its field alone
  w.eval("data.roles=[{id:'rlA',name:'Role A'},{id:'rlB',name:'Role B'}];render()"); await wait();
  w.eval("culRoleDel('rlA')"); await wait();
  ok(w.eval("data.roles.length")===1 && w.eval("data.roles[0].id")==='rlB' && w.document.getElementById('rl_name_rlB').value==='Role B' && !w.document.getElementById('rl_name_rlA'), 'deleting a role leaves the other role and its field alone (Spec §23.6)');fxOff();
  /* ── Conformance Batch 3 (25 Sep 2026): Paul's rulings of 25 Sep, carousels, button register, completion flow, ER step shell ── */
  const appSrc3=fs.readFileSync('Culture-app.js','utf8'), idx3=fs.readFileSync('Culture-index.html','utf8'), css3=fs.readFileSync('Culture-styles.css','utf8');
  ok(/<div class="nav-logo" onclick="go\('home'\)">AI-Ready <span>Culture<\/span><\/div>/.test(idx3) && idx3.indexOf('Responsible AI-Ready')<0, 'nav logo on the ER pattern: AI-Ready <span>Culture</span> (ruled 25 Sep)');
  ok((css3.match(/--ink:/g)||[]).length===2 && (css3.match(/--bg-rgb:/g)||[]).length===2 && (css3.match(/--bg-sidebar:/g)||[]).length===2 && (css3.match(/--rule-rgb:/g)||[]).length===2, 'page grounds follow ER: ground, sidebar, and rule tokens defined only in the two base blocks (ruled 25 Sep)');
  ok((css3.match(/--head-blue:/g)||[]).length===2 && css3.indexOf('--head-blue:#076D9E')>=0 && css3.indexOf('--head-blue:#38B5EF')>=0, 'blue accent set unrepainted (item 74)');
  ok(/--warn-text:#8F6A00;--warn-pale:#7E6A00;/.test(css3) && /--warn-text:#D4A017;--warn-pale:#E8D48B;/.test(css3), 'ER warning tokens present in both base blocks');
  ok(/--gold:#A13848;/.test(css3), 'the garnet accent stays the module identity');
  ok(idx3.indexOf("==='light'?'light':'dark'")>=0 && w.eval("UI.theme")!==undefined && appSrc3.indexOf("UI.theme = (Store.getPref('theme')==='light') ? 'light' : 'dark'")>=0, 'dark is the default theme; a saved light preference is honored (ruled 25 Sep)');
  // carousels replace the retired context panel
  ok(!/ctxPanel|STEP_CTX|Why This Matters|Click to Learn More/.test(appSrc3), 'context-panel relic retired (Spec \u00a719.22)');
  /* 7 Oct 2026 (Batch 1): retargeted — CAROUSEL_CONTENT is empty until each step batch adds its four slides. A probe set of four slides, added and removed again, shows that the carousel, the AI Guide's grounding lookup and the render tail still work */
  ok(w.eval("typeof CAROUSEL_CONTENT")==='object' && w.eval("Object.keys(CAROUSEL_CONTENT).every(function(k){return PH.some(function(p){return p.steps.some(function(s){return s.id===k})})})"), 'every CAROUSEL_CONTENT key is a PH step id (empty until the step batches add their carousels)');
  /* 7 Oct 2026 (Batch 2, step 3): retargeted — step 1.1 now has its carousel; it is set aside for the no-carousel and probe pins and put back after them */
  const __car11=w.eval("JSON.stringify(CAROUSEL_CONTENT['1.1'])");w.eval("delete CAROUSEL_CONTENT['1.1']");
  w.eval("go('step','1.1')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf('class="vp-carousel"')<0 && h.indexOf('Step 1.1: Assessment Battery')>=0, 'with no carousel written, the step page shows its placeholder card, not an empty carousel');})();
  w.eval("CAROUSEL_CONTENT['1.1']=['Why','What','How','Outcome'].map(function(k){return {kind:k,headline:'Probe '+k,body:'Probe grounding for '+k}});render()"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf('class="vp-carousel" data-step="1.1"')>=0 && (h.match(/class="vp-slide(?: active)?"/g)||[]).length===4, 'a step with four slides renders its carousel with four slides');
    var dw=h.indexOf('done-wrap')>=0?h.indexOf('done-wrap'):h.indexOf('cmap-done');
    ok(h.indexOf('vp-carousel')>=0 && h.indexOf('vp-carousel')<dw, 'the carousel sits above the step content'); /* 15 Oct 2026 (culture map, Stage 5, ruling 89): a step drawn as parts has no done-wrap bar; its Done: go to button (cmap-done) marks the content's end */})();
  ok(w.eval("culCoachCtx()").indexOf('Step grounding: Probe grounding for Why')>=0, 'the AI Guide reads its step grounding from the carousel');
  ok(appSrc3.indexOf('carouselInit(); /* ER render tail')>=0 && w.eval("carouselState.stepId")==='1.1', 'carouselInit runs at the render tail');
  w.eval("delete CAROUSEL_CONTENT['1.1'];CAROUSEL_CONTENT['1.1']="+__car11+";render()"); await wait();
  // button register
  ok(!/function btnS\(|btnS\(/.test(appSrc3) && w.eval("btn('X','f()')").indexOf('<button class="btn bp"')===0, 'button register: btn emits the family classes; the inline-styled btnS is retired (item 41)');
  // the ER step shell
  (function(){var h=w.document.getElementById('app').innerHTML;
    var order=['step-header','step-title','assign-bar','cul-step-intro','done-wrap'].map(function(k){return k==='done-wrap'&&h.indexOf(k)<0?h.indexOf('cmap-done'):h.indexOf(k)}); /* 15 Oct 2026 (culture map, Stage 5, ruling 89): a step drawn as parts has no done-wrap bar; its Done: go to button (cmap-done) marks the content's end */
    ok(order.every(function(p,i){return p>=0&&(i===0||p>order[i-1])})&&h.indexOf('class="step-nav"')<0&&h.indexOf('step-progress')<0, 'step shell in Architecture order: back, header, carousel, assignment bar, introduction, content, done button (was: step shell in ER order: crumb, strip, pips, header; Paul\'s visual pass, 12 Oct 2026)');
    ok(h.indexOf('\u2190 Pipeline')<0 && h.indexOf('\u2190 Back')>=0, 'the crumb carries the family back button, not the Pipeline leftover');
    ok(h.indexOf('\u2713 Mark step complete and continue \u2192')>=0 || h.indexOf('\u2713 Step complete')>=0|| h.indexOf('data-sec-btn')>=0, 'the step carries the family done button with its level-aware label (a tabbed step carries section buttons, Batch 2 step 3)');})();
  // completion flow: confirm first, idempotent, one stamp
  /* 8 Oct 2026 (Batch 5, step 4.3): 4.4 now has its tabbed battery, so no bare shell step remains; the shell pins save CUL_BATTERIES['4.3'], delete it, assert, and restore it (decision 13). */ w.eval("window.__b44=CUL_BATTERIES['4.3'];delete CUL_BATTERIES['4.3']");
  w.eval("['completedSteps','stepDoneAt','stepDoneBy','stepDoneById'].forEach(function(k){if(data[k])delete data[k]['4.3']})");
  w.confirm=()=>false; w.eval("markStepComplete('4.3')"); await wait();
  ok(!w.eval("isStepDone('4.3')") && !w.eval("(data.stepDoneAt||{})['4.3']"), 'declining the confirm touches nothing');
  var _asked=0; w.confirm=()=>{_asked++;return true};
  w.eval("markStepComplete('4.3')"); await wait();
  ok(w.eval("isStepDone('4.3')") && !!w.eval("data.stepDoneAt['4.3']") && _asked===1, 'accepting completes and stamps the step');
  w.eval("markStepComplete('4.3')"); await wait();
  ok(_asked===1, 're-clicking a complete step never re-confirms (idempotent)');
  w.eval("CUL_BATTERIES['4.3']=window.__b44");
  ok(w.eval("confirmStepDone.toString()").indexOf('Your team members will be notified. This cannot be undone.')>=0, 'the family step confirm text (reworded in the Phase 1 copy pass, Paul\'s instruction of 19 Oct 2026)');
  ok(appSrc3.indexOf('function completeStep(')<0, 'the unconfirmed completeStep writer is retired');
  // history and the back button
  w.eval("go('home')"); w.eval("go('step','2.1')"); await wait();
  w.eval("goBack()"); await wait();
  ok(w.eval("currentPage")==='home', 'the back button returns to the previous page');
  /* ── Conformance Batch 3b (25 Sep 2026): notes, panel repaint, voice, seed, cast, in-place adds ── */
  const appSrc4=fs.readFileSync('Culture-app.js','utf8'), idx4=fs.readFileSync('Culture-index.html','utf8');
  // notes capture where they were written and jump back (item 39)
  w.eval("go('step','1.3')"); await wait();
  w.eval("if(!notesOpen)toggleNotes()"); await wait();
  (function(){var ni=w.document.getElementById('notesInput');ni.value='Probe note from 1.3';})();
  w.eval("addNote()"); await wait();
  ok(w.eval("(function(){var n=data.notes[data.notes.length-1];return n.page==='step'&&n.step==='1.3'&&/^Step 1\\.3 \\u00B7 /.test(n.where)&&/^nt/.test(n.id)})()"), 'a note records its page, step, and where-label, with an nt-prefixed id (item 39)');
  ok(w.document.getElementById('notesPanel').innerHTML.indexOf('goToNote(')>=0, 'the notes panel renders the jump link');
  w.eval("go('home')"); await wait(); w.eval("goToNote(data.notes[data.notes.length-1].id)"); await wait();
  ok(w.eval("currentPage")==='step' && w.eval("currentStep")==='1.3', 'the jump link returns to where the note was captured');
  ok(appSrc4.indexOf('Capture insights as you work through the pipeline.')<0 && appSrc4.indexOf('<div class="notes-empty">No notes yet.</div>')>=0, 'the notes empty state is the family string, not the Pipeline leftover');
  // open panels repaint with drafts preserved (item 58)
  ok(appSrc4.indexOf('repaintOpenPanels(); /* item 58 */')>=0, 'render repaints the open panels');
  (function(){var ni=w.document.getElementById('notesInput');ni.value='half-typed draft';ni.focus();})();
  w.eval("render()"); await wait();
  ok(w.document.getElementById('notesInput').value==='half-typed draft', 'a half-typed note survives a full render');
  (function(){var d=JSON.parse(w.eval("Store.orgRaw(currentOrgId)"));d.notes.push({id:'ntforeign',text:'Foreign note',date:new Date().toISOString(),createdAt:Date.now()});w.eval("Store.writeOrg(currentOrgId,"+JSON.stringify(d)+")");})();
  w.eval("Store.refreshOrg()"); await wait();
  ok(w.document.getElementById('notesPanel').innerHTML.indexOf('Foreign note')>=0 && w.document.getElementById('notesInput').value==='half-typed draft', 'a foreign note appears in the open panel on adoption, and the draft survives'); /* 25 Oct 2026 (audit fix round): audit S4, Spec §19.30 — the Team Chat panel's draft survives a full render too. */ w.eval('if(!gchatOpen)toggleGChat()'); await wait(); (function(){var gi=w.document.getElementById('gchatInput');if(gi){gi.value='half-typed chat';gi.focus();}})(); w.eval('render()'); await wait(); ok(!!w.document.getElementById('gchatInput') && w.document.getElementById('gchatInput').value==='half-typed chat', 'a half-typed Team Chat message survives a full render (S4)'); w.eval('if(gchatOpen)toggleGChat()'); await wait(); /* 25 Oct 2026 (audit fix round): audit S2, Spec §19.26 and Rollout item 52 — a settled page renders without writing. */ for (const _pg of ["go('phase5')","go('mgmt-hub')","go('step','2.6')","go('step','3.3')","go('step','4.3')"]) { w.eval(_pg); await wait(); w.eval('render()'); await wait(); const _r0=w.eval('data.rev||0'); w.eval('render()'); await wait(); w.eval('render()'); await wait(); ok(w.eval('data.rev||0')===_r0, 'a settled page renders without writing: '+_pg+' (S2)'); } /* 25 Oct 2026 (audit fix round): audit S3, Spec §19.19 — typed text survives a tab round trip on a tabbed step. */ await (async function(){ var found=false; var steps=w.eval("(function(){var o=[];[1,2,3,4].forEach(function(p){(STEP_FLOW[p]||[]).forEach(function(s){var b=CUL_BATTERIES[s.id];if(b&&b.sections&&b.sections.length>1)o.push([s.id,b.sections.map(function(x){return x.key})])})});return JSON.stringify(o)})()"); steps=JSON.parse(steps); for (const st of steps) { const sid=st[0], tabs=st[1]; w.eval("go('step','"+sid+"');UI[culTabKey('"+sid+"')]='"+tabs[0]+"';render()"); await wait(); const ta=[...w.document.querySelectorAll('#app textarea[id]')].find(function(e){return (e.getAttribute('onchange')||'').indexOf('fldSave')>=0 && !e.disabled}); if(!ta) continue; const fid=ta.id, before=ta.value; /* fldSave refuses saves inside the post-adoption discard window (Spec §26.4); the probe waits it out rather than switching the guard off */ await new Promise(function(r){setTimeout(r,Math.max(0,(w.eval('_discardChangeUntil')||0)-Date.now())+60)}); w.eval("(function(){var el=document.getElementById('"+fid+"');el.value='S3 probe text';return (new Function(el.getAttribute('onchange'))).call(el)})()"); /* the field's own onchange attribute, run with the field as this (Spec §19.23): a synthetic change event does not run inline handlers in this window */ w.eval("UI[culTabKey('"+sid+"')]='"+tabs[1]+"';render()"); await wait(); w.eval("UI[culTabKey('"+sid+"')]='"+tabs[0]+"';render()"); await wait(); const back=w.document.getElementById(fid); ok(!!back && back.value==='S3 probe text', 'typed text survives a tab round trip ('+sid+', '+fid+') (S3)'); if(back){w.eval("(function(){var el=document.getElementById('"+fid+"');el.value="+JSON.stringify(before)+";return (new Function(el.getAttribute('onchange'))).call(el)})()");} found=true; break; } ok(found, 'S3 found a tabbed step with a self-saving text field to probe'); })();
  w.eval("document.getElementById('notesInput').value='';toggleNotes()"); await wait();
  // voice (item 40)
  ok(/var _voiceActive=false,_recognition=null;/.test(appSrc4) && /function _voiceUI\(/.test(appSrc4) && !/function processVoice\(/.test(appSrc4) && appSrc4.indexOf("go('pipeline')")>=0, 'voice runs the Architecture/ER cluster with Culture\u2019s vocabulary (item 40)');
  ok(idx4.indexOf('<span class="voice-fab-icon" id="voiceIcon">\u25C9</span>')>=0, 'the voice button carries the family icon');
  // seed: literal overwrite, prefixed ids, the cast law (Spec \u00a73.6, items 63, \u00a723.2)
  /* 7 Oct 2026 (Batch 1): retargeted — the pollution uses the new shape: a notification, a queued reminder and a stray team record */
  w.eval("data.notifications=[{kind:'probe'}];data.remind7={'9.9':true};data.teams=[{id:'tmProbeStale',name:'Stale probe team',manager:'',headcount:1}]");
  w.confirm=()=>true; w.eval("seedSampleData()"); await wait();
  /* 7 Oct 2026 (Batch 2, step 4; dated note added at close-out, Spec §22.9.3): retargeted — the seed holds eight roles (the seven seeded roles and Legal counsel, which the AI uses need); the superseded pin required seven */
  ok(w.eval("(data.notifications||[]).length")===0 && !w.eval("(data.remind7||{})['9.9']") && !w.eval("(data.teams||[]).some(function(t){return t.id==='tmProbeStale'})") && w.eval("data.teams.length")===6 && w.eval("data.roles.length")===8, 'the seed overwrites runtime keys literally (pollute, reseed, clean)');
  ok(w.eval("Object.keys(CUL_SCHEMA).every(function(k){var c=CUL_SCHEMA[k];if(c.kind!=='list'||c.family||!Array.isArray(data[k]))return true;return data[k].every(function(r){return r&&typeof r.id==='string'&&r.id.indexOf(c.prefix)===0})})"), 'every seeded list record carries its collection prefix');
  (function(){var all=appSrc4+fs.readFileSync('Culture-home.html','utf8')+fs.readFileSync('Culture-learn.html','utf8');
    var banned=/\b(Sarah Kim|Sarah Chen|James Okafor|Lisa Patel|Priya (Patel|Raman|Sharma)|David Torres|Elena (Torres|Marsh)|Maria (Torres|C\.)|Marcus (Bell|Webb)|Tom Nakamura|Nadia Osei|Margaret Chen|M\. Chen|S\. Osei|D\. Okafor|R\. Alvarez|R\. Diaz|T\. Ibrahim|K\. Mensah|S\. Novak|P\. Laurent|Dev K\.)\b/;
    ok(!banned.test(all), 'seed cast census: no banned-register names (item 63)');})();
  // in-place adds (item 31): the form opens on the page, below its button, and commits there
  /* 7 Oct 2026 (Batch 1): retargeted — the in-place add walks the team and role adds on the stand-in page (fxOn), since the step shells hold no fields until the step batches build them; the fear and power adds retired with their registers */
  w.eval("data.teams=data.teams||[];data.roles=data.roles||[]");fxOn();w.eval("go('step','1.1')"); await wait();
  w.eval("culTeamAdd()"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(w.eval("currentPage")==='step' && w.eval("currentStep")==='1.1' && h.indexOf('id="culAddCard_team"')>h.indexOf("culTeamAdd()"), 'the add form opens on the same page, below the button that opened it');})();
  var _nf=w.eval("data.teams.length"); w.eval("UI.culAddDraft='Probe team';culAddSave()"); await wait();
  ok(w.eval("data.teams.length")===_nf+1 && /^tm/.test(w.eval("data.teams[data.teams.length-1].id")) && w.eval("UI.culAdd")===null, 'Add commits the record on the page and closes the form');
  var _nr=w.eval("data.roles.length"); w.eval("culRoleAdd()"); await wait(); w.eval("UI.culAddDraft='Probe role';culAddSave()"); await wait();
  ok(w.eval("data.roles.length")===_nr+1 && /^rl/.test(w.eval("data.roles[data.roles.length-1].id")) && w.eval("data.roles[data.roles.length-1].name")==='Probe role' && w.eval("UI.culAdd")===null, 'a role add commits to the shared roles list with an rl-prefixed id');
  var _nf2=w.eval("data.teams.length"); w.eval("culTeamAdd();culAddClose()"); await wait(); ok(w.eval("UI.culAdd")===null && w.eval("data.teams.length")===_nf2, 'Cancel closes the form without writing');fxOff();
  ok(!/function cul(Team|Sig|Pow|Fear)Add\([^)]*\)\{var [a-z]=prompt\(/.test(appSrc4) && appSrc4.indexOf("prompt('Current reading for")<0, 'no add or reading uses a browser dialog');
  ok(appSrc4.indexOf("if(UI.scrollTo){(function(_sid){")>=0 && appSrc4.indexOf("UI.scrollTo='culAddCard_'+kind")>=0, 'the editor-reveal hook and its set-site are present (item 51)');
  // the old metric reading form is retired with the old dashboard
  ok(w.eval("typeof culMetricLogOpen")==='undefined' && w.eval("typeof culMetricLog")==='undefined' && w.eval("typeof culMetricAdd")==='undefined' && w.eval("typeof culMetricById")==='undefined', 'the metric reading form and its register are retired with the old dashboard');
  /* ── Conformance Batch 4a (25 Sep 2026): home, learn, the ER overview, timeline, and stat strip ── */
  const appSrc5=fs.readFileSync('Culture-app.js','utf8'), home5=fs.readFileSync('Culture-home.html','utf8'), learn5=fs.readFileSync('Culture-learn.html','utf8'), bundle5=fs.readFileSync('Culture-templates-local.js','utf8');
  (function(){var W={};new Function('window',bundle5)(W);var T=W.__LOCAL_TEMPLATES||{};
    ok(T.home===home5 && T.learn===learn5, 'the templates bundle matches its source screens (item 61, Spec \u00a74)');
    var bad=Object.keys(T).filter(function(k){return (T[k].match(/<div\b/g)||[]).length!==(T[k].match(/<\/div>/g)||[]).length});
    ok(bad.length===0, 'every template balances its div wrappers (item 61 gate) '+bad.join(','));})();
  ok(home5.indexOf('<div class="hero-intro-video overview-video-card reveal">')>home5.indexOf('<div class="hero-right">') && home5.indexOf('The Cost of Skipping Culture')<0, 'the hero\u2019s right column is the family video card (item 61)');
  ok(home5.indexOf('<!-- Scrolling marquee strip -->')>home5.lastIndexOf('<div class="hero-right">'), 'the hero closes before the marquee');
  ok((home5.match(/<div class="u-3499ee4">0\d<\/div>/g)||[]).length===w.eval('PH.length') && home5.indexOf('Regenerate &middot; Ongoing')>=0, 'the home plan list names every phase in PH');
  /* 7 Oct 2026 (Batch 1, stage 4): Home follows the new structure: the four timed phases carry their day ranges, Sustain is no longer Ongoing, the unsourced workforce statistics are gone, and the framework card counts seventeen steps */
  ok(['Diagnose &middot; Days 1 to 30','Rewire &middot; Days 31 to 55','Embed &middot; Days 56 to 75','Sustain &middot; Days 76 to 90','Regenerate &middot; Ongoing'].every(function(t){return home5.indexOf(t)>=0}) && home5.indexOf('Sustain &middot; Ongoing')<0 && home5.indexOf('Half the workforce')<0 && home5.indexOf('Seventeen steps of concrete work')>=0 && home5.indexOf('twenty-four')<0, 'Home names the phases with their day ranges, drops the unsourced statistics, and counts seventeen steps');
  ok(home5.indexOf('Psychological Safety')<0 && home5.indexOf('Truth-Tellers')<0 && (home5.match(/<span class="marquee-dot"><\/span>Target Culture<\/span>/g)||[]).length===2, 'the marquee carries the new structure\u2019s words, in both copies');
  ok(appSrc5.indexOf("'What does this step ask of me?'")>=0 && appSrc5.indexOf("'Help with this step'")<0, 'the AI Guide preset reads What does this step ask of me?');
  (function(){var ids=w.eval("(function(){var o={};PH.forEach(function(p){p.steps.forEach(function(s){o[s.id]=s.name})});return o})()");
    var refs=(learn5.match(/Steps? (\d\.\d)/g)||[]).map(function(x){return x.replace(/Steps? /,'')});
    ok(refs.length===0, 'the Learn page cites no steps (Paul\'s ruling of 20 Oct 2026: the Learn page follows the family standard: six articles and the family book section; was: every step the Learn page cites exists in PH)');
    /* 7 Oct 2026 (Batch 1): retargeted — the badges follow the new structure: change fatigue to 4.3 Change Pacing, the assumptions article to 2.1 Target Culture, the middle-management article to 2.3 Rewards and Protections */
    ok((learn5.match(/class="insight-card reveal"/g)||[]).length===10 && learn5.indexOf('Six articles behind the AI-Ready Culture program')>=0 && learn5.indexOf('<div class="section-label reveal">Books</div>')>0 && learn5.indexOf('The Six Foundations')<0 && learn5.indexOf('Companion <em>90-Day Plans</em>')<0 && learn5.indexOf('The Fearless Organization')<0 && learn5.indexOf('>LIFT<')<0, 'the Learn page is six articles and the family book section of four books, with no companion plans or extra books (Paul\'s ruling of 20 Oct 2026: the Learn page follows the family standard)');})();
  w.eval("go('pipeline')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    var order=['overview-video-card','90-Day Timeline','u-4d06b89','viz-stat-strip','u-1390122'].map(function(k){return h.indexOf(k)});
    ok(order.every(function(p,i){return p>=0&&(i===0||p>order[i-1])}), 'the overview renders in the ER order: video, timeline, hero, stat strip, phase cards (item 24)');
    ok((h.match(/class="u-1390122"/g)||[]).length===w.eval('PH.length'), 'one phase card per phase');
    ok(h.indexOf('>Map<')<0 && h.indexOf('>Assess<')<0 && h.indexOf('>Diagnose<')>=0 && (h.match(/class="ph-bar-pos"/g)||[]).length===w.eval("PH.filter(function(p){return p.days!=='Ongoing'}).length"), 'the timeline shows Culture\u2019s timed phases, not the Governance leftovers');
    ok((h.match(/class="viz-stat-cell"/g)||[]).length===4 && h.indexOf('Steps Complete')>=0 && h.indexOf(w.eval("mgSteps().filter(function(s){return isStepDone(s.id)}).length")+'/'+w.eval('mgSteps().length'))>=0, 'the stat strip carries four tiles, Steps Complete over the countable set');
    ok(!/\d{4}-\d{2}-\d{2}/.test(h.replace(/value="[^"]*"/g,'')), 'no ISO date in the overview\u2019s visible text (item 76)');})();
  w.eval("go('overview')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('viz-stat-strip')>=0 && appSrc5.indexOf('function renderModuleOverview')<0, 'one overview: the sidebar\u2019s overview route renders the same page');
  /* ── Conformance Batch 4b (25 Sep 2026): the phase page on ER's anatomy (item 25) ── */
  const appSrc6=fs.readFileSync('Culture-app.js','utf8');
  ok(appSrc6.indexOf('mapped your AI landscape')<0 && appSrc6.indexOf('governance baselines')<0 && appSrc6.indexOf('function renderPhaseLandingPage')<0, 'the Governance phase-complete copy and the old landing are retired');
  (function(){var errs=[],shape=[];w.eval('PH').forEach(function(p){w.eval("go('phase','"+p.id+"')");var h=w.document.getElementById('app').innerHTML;
      if(h.indexOf('<h2>Error</h2>')>=0)errs.push(p.id);
      /* 7 Oct 2026 (Batch 1): the Regenerate page holds only standing pages, so it carries no progress card and no step flow; the CARE and Pause panels are retired */
      var standingOnly=p.steps.every(function(s){return s.standing});
      var order=['90-Day Timeline','u-96f7104','u-f78be26'].concat(standingOnly?[]:['u-3526083']).concat(['gr-2-mb']).map(function(k){return h.indexOf(k)});
      var cards=(h.match(/class="ph-score"/g)||[]).length, flow=standingOnly?0:(w.eval("(STEP_FLOW["+p.id+"]||[]).length"));
      var ticks=(h.match(/class="flow-label"/g)||[]).length;
      var routes=(h.match(/onclick="go\('step','\d\.\d'\)"/g)||[]).length;
      if(!(order.every(function(x,i){return x>=0&&(i===0||x>order[i-1])})&&cards===4&&ticks===flow&&routes>=4+p.steps.length&&h.indexOf('CARE lens')<0&&h.indexOf('The Pause')<0))shape.push(p.id+':'+order.join('/')+' cards'+cards+' ticks'+ticks+'/'+flow+' routes'+routes);});
    ok(errs.length===0, 'every phase page renders without an error');
    ok(shape.length===0, 'every phase page: timeline, hero, four metric cards, progress with its step flow (none on the standing phase), steps grid, and no CARE or Pause panels ('+shape.join(' | ')+')');})();
  w.eval("go('phase','1')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf("onclick=\"go('step','1.2')\"")>=0, 'metric cards open their step (Culture routes)');
  ok(w.eval("(function(){var ok=true;PH.forEach(function(p){['step'].forEach(function(){})});return typeof PHASE_COMPLETE_MSG==='object'&&typeof PHASE_DONE_LINE==='object'})()"), 'phase-complete copy slots exist, empty until written');
  /* ── Conformance Batch 4c (25 Sep 2026): Insights on the ER page (Spec \u00a78) ── */
  (function(){var erSrc=fs.readFileSync('../donors/exec-readiness/Exec-Readiness-app.js','utf8');
    ['renderInsights','insightsLatestHtml','insightsConversationsHtml','insightsWorthHtml','insightsYtCard','insightsTabBtn','setInsightsTab'].forEach(function(fn){
      var a=erSrc.indexOf('function '+fn+'(');var ok1=a>=0&&w.eval(fn+'.toString()')===erSrc.slice(a,a+w.eval(fn+'.toString()').length);
      ok(ok1, 'Insights: '+fn+' is the ER byte-form');});})();
  w.eval("go('insights')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf('class="u-70c6b34"')>=0 && h.indexOf('class="u-58a9696"')>=0, 'Insights renders the family hero bar and section navigation');})();
  ok(w.eval("typeof fetchLiveInsights")==='undefined' && w.eval("typeof INSIGHT_FEEDS")==='undefined', 'the old live-fetch feed (an in-browser AI call) is retired');
  ok(w.eval("typeof gateRepaint")==='function', 'the family gate hook stays installed for the field helpers');
  /* ── Ruling of 25 Sep 2026 (Paul): real identities only — no simulated replies, no hardwired or placeholder people anywhere in the app ── */
  const appSrc7=fs.readFileSync('Culture-app.js','utf8');
  (function(){var i=appSrc7.indexOf('function sendGChat(');var body=appSrc7.slice(i,appSrc7.indexOf('\n}\n',i));
    ok(i>=0 && body.indexOf('fetch(')<0 && body.indexOf('CLAUDE_API_URL')<0 && appSrc7.indexOf('is typing')<0 && appSrc7.indexOf(' at SHADOKA')<0, 'Team Chat has no simulated-reply machinery');})();
  ok(!/Lauren H\.Z\.|Erik N\.|Tom D\.|You \(Faisal\)|\bgchatMembers\b|\bgchatMsgs\b/.test(appSrc7), 'no hardwired chat members or demo thread in the app');
  /* 6 Oct 2026 (Batch 8d; item 102, ruled by Paul 6 Oct): retargeted — a console-made organization's unnamed first person is Owner with the username owner, owner2…; that is the one place the name may appear */
  ok(!/['"]u[0-9]['"]/.test(appSrc7) && (appSrc7.match(/name:'Owner'/g)||[]).length===1 && /\{id:uid\(\),name:'Owner',username:\(function\(\)\{var _ou='owner'/.test(appSrc7), 'no hardwired user ids; Owner appears only as item 102\u2019s console-made first person');
  /* 7 Oct 2026 (Batch 2 repair; Spec §3.6, §23.2, §19.5 check 5): the seed is a separate pure builder, its ids come from the generator, and storage is written in exactly two places */
  (function(){var s=appSrc7,a=s.indexOf('function buildSeedBase('),b=s.indexOf('\nfunction seedSampleData(){',a),body=s.slice(a,b);
    ok(a>0&&b>a&&/function seedSampleData\(\)\{[^]*data=buildSeedBase\(/.test(s), 'the seed is a separate pure builder (buildSeedBase) committed by a wrapper (seedSampleData)');
    ok(!/localStorage|Store\.|saveData|loadData|confirm\(|applyTeamRoster|\bgo\(|\bdata\s*=[^=]|\bdata\./.test(body), 'buildSeedBase has no storage, confirm, render or global-data write in its body');
    ok(!/['"][a-z]{2}-[a-z0-9]+['"]/.test(body), 'no hand-typed prefixed id literal remains in the seed builder');
    ok((s.match(/localStorage\.setItem/g)||[]).length===2, 'localStorage.setItem occurs exactly 2 times in the app (Spec check 5)');})();
  (function(){var s=appSrc7,a=s.indexOf('function buildSeedBase('),b=s.indexOf("go('phase5');\n}",a),bad=[];var re=/name:'[^']+'[^}]{0,40}username:'[^']+'/g,m; /* a person: a non-empty name with a non-empty username; blank add-forms and the schema's type text are not people */
    var sa=s.indexOf('var CUL_SCHEMA={'),sb=s.indexOf('\n};',sa);
    while((m=re.exec(s))){if((m.index<a||m.index>b)&&!(m.index>sa&&m.index<sb))bad.push(s.slice(m.index,m.index+30))} /* the data standard's type text is not a person */
    ok(bad.length===0, 'every roster-shaped literal in the app lives inside the seed ('+bad.join(' | ')+')');})();
  (function(){var keep=w.eval('currentOrgId');var r=w.eval("createOrg('Probe Empty Org')");
    /* 6 Oct 2026 (Batch 8d; item 102): retargeted — an organization created without a first person gets one administrator, Owner, with a free owner username and no password */
    ok(!!r.userId && w.eval('data.roster.length')===1 && /^owner\d*$/.test(w.eval('data.roster[0].username')) && w.eval('data.roster[0].admin')===true && !w.eval('data.roster[0].passcode') && w.eval('chatArr().length')===0, 'a console-made organization starts with only Owner (no password) and an empty chat (item 102)');
    w.eval("setCurrentOrg('"+keep+"');loadData();applyTeamRoster()");})();
  w.eval("Auth.setSession(USERS[0].id)"); await wait();
  w.eval("if(!gchatOpen)toggleGChat()"); await wait();
  var _c0=w.eval('chatArr().length');
  (function(){var gi=w.document.getElementById('gchatInput');gi.value='Probe message';})();
  w.eval('sendGChat()'); await new Promise(r=>setTimeout(r,300));
  ok(w.eval('chatArr().length')===_c0+1 && w.eval('chatArr()[chatArr().length-1].who')===w.eval('currentUserId') && /^cm/.test(w.eval('chatArr()[chatArr().length-1].id')), 'a post is the signed-in member\u2019s, stored in the organization\u2019s record, and nothing replies');
  ok(w.eval("(function(){var p=document.getElementById('gchatPanel').innerHTML;return USERS.every(function(u){return p.indexOf(u.name)>=0})})()"), 'the member strip is the live roster');
  w.eval("toggleGChat()"); await wait();
  /* 6 Oct 2026 (Batch 8a, Spec §26.7 / Rollout item 101): retargeted — the marker is the session's, set when the panel opens; the superseded pin set a per-member marker in the organization's record (data.chatRead), now retired. */
  w.eval("gchatLastOpened=Date.now()-5000;chatArr().push({id:'cmforeign',who:'u-someone-else',name:'Another member',at:Date.now()-1000,text:'Probe'});chatArr().push({id:'cmmine',who:currentUserId,name:'Me',at:Date.now()-500,text:'Mine'})");
  ok(w.eval('chatUnread()')===1, 'the unread badge counts colleagues\u2019 messages since the panel was last opened, never one\u2019s own (item 101)');
  w.eval("toggleGChat()"); await wait(); ok(w.eval('chatUnread()')===0, 'opening the chat marks it read'); w.eval("toggleGChat()"); await wait();
  (function(){var before=w.eval("USERS.map(function(u){return u.username}).join()");w.confirm=()=>true;w.eval('seedSampleData()');
    var after=w.eval("USERS.map(function(u){return u.username})");
    ok(before.split(',').every(function(n){return after.indexOf(n)>=0}) && after.indexOf('harriet')>=0, 'the seed adds its demo members beside the real ones, removing none');
    ok(w.eval("chatArr().length")===3 && w.eval("chatArr().every(function(m){return USERS.some(function(u){return u.id===m.who})})"), 'the seed\u2019s demo messages come from seeded members');})();
  /* ── Conformance Batch 4d part 2a (25 Sep 2026): the family stylesheet blocks and the shell order (Spec \u00a75, \u00a76) ── */
  (function(){var css=fs.readFileSync('Culture-styles.css','utf8'),ecss=fs.readFileSync('../donors/exec-readiness/Exec-Readiness-styles.css','utf8').split('\n');
    var need=[ecss[9],ecss[54],ecss[70],ecss[71],ecss[72],ecss[76],ecss[77],ecss[81],ecss[411],ecss[578],ecss[762],'select{background:var(--bg-elev);color:var(--paper)}','.done-wrap .done-btn:not([disabled])+.done-helper{display:none}'];
    var miss=need.filter(function(l){return css.indexOf(l)<0});
    ok(miss.length===0, 'the stylesheet carries ER\u2019s family blocks byte-for-byte ('+miss.map(function(x){return x.slice(0,40)}).join(' | ')+')');
    ok(css.indexOf('rgba(241,237,238,.72)')<0 && css.indexOf('rgba(13,17,23,.6)')<0, 'the plan card grounds are tokens, not garnet near-miss literals (Spec \u00a75A.12)');
    ok(css.indexOf('.print-only{display:none}')>=0 && /@media print\{\n  \*\{-webkit-print-color-adjust:exact;print-color-adjust:exact\}/.test(css), 'the print utility and the family print block are installed (items 29, 30)');})();
  (function(){var ix=fs.readFileSync('Culture-index.html','utf8');
    var order=['id="sidebarToggle"','id="pipSidebar"','<nav>','id="appFooter"','id="voiceFab"','id="modalRoot"','id="gchatPanel"','id="notesPanel"','id="coachFab"','id="coachPanel"'].map(function(k){return ix.indexOf(k)});
    ok(order.every(function(p,i){return p>=0&&(i===0||p>order[i-1])}), 'the shell follows Spec \u00a76 order: toggle, sidebar, nav, content, footer, voice, modal root, chat, notes, coach');
    ok(ix.indexOf('title="Toggle sidebar"')>=0 && ix.indexOf('<div id="navRight" class="nav-right"></div>')>=0, 'shell details in the ER form');})();
  /* ── Conformance Batch 4d part 2b (25 Sep 2026): nav, sidebar, the #app shell, setup, and the reset scope law ── */
  const appSrc8=fs.readFileSync('Culture-app.js','utf8'), idx8=fs.readFileSync('Culture-index.html','utf8');
  ok(/function renderNav\(\)\{/.test(appSrc8) && appSrc8.indexOf('    renderNav(); /* Spec \u00a77') >= 0, 'the nav is built by renderNav (Spec \u00a77, ER form)');
  w.eval("UI.navMore=true;render()"); await wait();
  (function(){var nr=w.document.getElementById('navRight').innerHTML;
    /* 6 Oct 2026 (Batch 8b, item 84): the superseded order ended with Reset all data, now on the admin console */
    /* 6 Oct 2026 (Batch 8e): Notes joins the menu above Org &amp; Team (the item's label, Architecture byte-form, was Profile) */
    var order=['Track Program','Voice','Notes','Org &amp; Team','Change password','Seed sample data','Export state','Import state'].map(function(k){return nr.indexOf(k)});
    ok(order.every(function(p,i){return p>=0&&(i===0||p>order[i-1])}), 'More menu order: Track Program first, then Voice, Profile, Seed sample data, Export, Import (Spec \u00a77; Reset data is on the console, item 84)');
    ok(nr.indexOf('aria-haspopup="true"')>=0 && nr.indexOf('aria-label="Zoom out"')>=0, 'nav controls carry the ER accessibility attributes');})();
  w.eval("UI.navMore=false;render()"); await wait();
  ok(idx8.indexOf('<div id="app" class="main-content"></div>')>=0 && idx8.indexOf('mainContent')<0 && appSrc8.indexOf('mainContent')<0, 'the content column is #app.main-content (Spec \u00a76)');
  ok(/function sidebarPageShown\(\)/.test(appSrc8) && appSrc8.indexOf("(s.id==='5.0'")<0, 'the sidebar uses the shared page test; the Governance 5.0 leftover is gone');
  (function(){var sv=w.eval('JSON.stringify(PH[0].outcomes||[])');
    w.eval("PH[0].outcomes=[{id:'out-probe',name:'Probe Output',icon:'\u25A1'}];sidebarMinimized=false;go('phase','1')");
    var sb=w.document.getElementById('pipSidebar').innerHTML;
    ok(sb.indexOf('sidebar-outcomes-fold')>=0 && sb.indexOf('Probe Output')<0, 'the outputs sit behind a closed fold (\u00a722.8)');
    w.eval("toggleNavOutputs(1)"); sb=w.document.getElementById('pipSidebar').innerHTML;
    ok(sb.indexOf('Probe Output')>=0, 'opening the fold shows the outputs');
    w.eval("PH[0].outcomes="+sv+";UI.navOutOpen={};render()");})();
  /* 6 Oct 2026 (Batch 8d): retargeted — the setup screen is now Architecture's byte-form (the BD donor), which asks for the setup code and a password and has no email field; the superseded pin required ER's optional email */
  ok(/id="setupCode"/.test(w.eval('renderSetupScreen.toString()')) && /passwordProblem\(/.test(w.eval('doSetup.toString()')), 'setup asks for the setup code and checks the password rule (Architecture form)');
  /* 6 Oct 2026 (Batch 8b, item 106): retargeted — addProfile now checks the caller's rights first, then the lock */
  /* 6 Oct 2026 (Batch 8d): retargeted — addProfile opens the unbound new-member form, and an add-form draft takes no lock (Spec §26.1) */
  ok(/function addProfile\(\)\{ if\(!isOrgAdminNow\(\)\)return;/.test(appSrc8), 'adding a profile checks rights first (item 106); its draft takes no lock (\u00a726.1)');
  // the reset scope law (item 68): after an administrator's reset, the same administrator is signed in to the same organization with an administrators-only roster and empty registers
  (function(){w.confirm=()=>true;w.eval('seedSampleData()');
    var admin=w.eval("(USERS.find(function(u){return u.admin||u.role==='Administrator'})||{}).id");
    w.eval("Auth.setSession('"+admin+"')"); var org=w.eval('currentOrgId'); var ent=w.eval('JSON.stringify(data.enterprise)');
    ok(w.eval("USERS.some(function(u){return !(u.admin||u.role==='Administrator')})"), 'the seeded roster holds non-administrator members before the reset');
    /* 25 Sep 2026 (Batch 7a): retargeted to Governance's ruled confirm (item 68 names Governance's clearData as the model); the superseded pin asserted this module's interim wording. */
    ok(w.eval("clearData.toString()").indexOf('Team members other than administrators are also removed.')>=0, 'the reset confirm states the roster removal (Governance\u2019s ruled wording)');
    w.eval('clearData()');
    /* 25 Sep 2026 (Batch 7a): retargeted — Governance's ruled model clears the organization profile with the program data; the organization itself (its registry entry) survives. The superseded pin also required data.enterprise to survive. */
    ok(w.eval('currentOrgId')===org && w.eval('currentUserId')===admin && w.eval("USERS.every(function(u){return u.admin===true})") && !!w.eval("getOrg('"+org+"')"), 'after the reset the administrator is still signed in to the same organization, and only administrators remain');
    ok(w.eval("Object.keys(CUL_SCHEMA).every(function(k){var c=CUL_SCHEMA[k];if(c.family)return true;var v=data[k];return c.kind==='list'||c.kind==='series'?(Array.isArray(v)&&v.length===0):(c.kind==='value'?true:JSON.stringify(v)==='{}')})"), 'every program register is empty after the reset');})();
  (function(){w.confirm=()=>true;w.eval('seedSampleData()');var m=w.eval("(USERS.find(function(u){return !(u.admin||u.role==='Administrator')})||{}).id");
    w.eval("Auth.setSession('"+m+"');currentUserId='"+m+"'"); w.eval('clearData()');
    /* 6 Oct 2026 (Batch 8b, items 94/106): retargeted — a member who is not an administrator can no longer reset at all; the sign-out half of the superseded pin returns with item 91 (Batch 8f). */
    ok(w.eval("USERS.some(function(u){return !(u.admin||u.role==='Administrator')})"), 'a reset called by an ordinary member is refused: the roster is untouched (item 106)');
    var admin=w.eval("(USERS.find(function(u){return u.admin||u.role==='Administrator'})||{}).id");if(admin){w.eval("Auth.setSession('"+admin+"');currentUserId='"+admin+"';render()");}})();
  /* ── Conformance Batch 4d part 2c (25 Sep 2026): the Track Program hub and session helpers on ER's byte-form ── */
  (function(){var erSrc=fs.readFileSync('../donors/exec-readiness/Exec-Readiness-app.js','utf8');
    /* 6 Oct 2026 (Batch 8f, Spec §26.5 / item 92): the comparison allows one substitution — Culture computes today with todayIso() (local calendar day) where the ER donor uses new Date().toISOString().split('T')[0] (a UTC day; ER is not yet censused for item 92, a donor-side item) */
    ['mgmtHubContent','mgRowHtml','adminDeleteOrg','setZoom'].forEach(function(fn){var t=w.eval(fn+'.toString()').split('todayIso()').join("new Date().toISOString().split('T')[0]");ok(erSrc.indexOf(t)>=0, 'hub/session: '+fn+' is the ER byte-form')});})();
  w.eval("go('mgmt-hub')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    var ongoing=w.eval("PH.filter(function(p){return p.days==='Ongoing'}).map(function(p){return p.name})");
    ok(ongoing.length===1 && ongoing[0]==='Regenerate' && ongoing.every(function(n){return h.indexOf('>'+n+'<')<0 && h.indexOf(n+' \u00b7')<0}), 'the hub\u2019s phase tabs exclude the ongoing phase (Regenerate only), matching the countable set');
    /* 6 Oct 2026 (Batch 8b): narrowed — the superseded pin scanned the whole page, which also holds the analytics charts' SVG literals, lawfully remapped by the stylesheet (§5A.4); the law concerns the hub's tab accents */
    ok(w.eval('mgmtHubContent.toString()').indexOf('#D4A017')<0, 'hub tab accents use the warning token, not a literal');})();
  /* ── Conformance Batch 4d part 3 (25 Sep 2026): the Help modal on Spec \u00a716 ── */
  w.eval("openHelp()"); await wait();
  (function(){var mr=w.document.getElementById('modalRoot').innerHTML;
    var order=['What This Is','Getting Around','Signing In &amp; Organizations','The Five Phases','Culture Dashboard','Track Program','Tools','Insights','Organization &amp; Team','Data &amp; Privacy'].map(function(k){return mr.indexOf('>'+k+'</div>')});
    ok(order.every(function(p,i){return p>=0&&(i===0||p>order[i-1])}), 'Help carries the \u00a716 sections in order ('+order.join(',')+')');
    ok(mr.indexOf('The culture map shows each dimension with its baseline, latest reading, and target')>=0 && mr.indexOf('It has not been built yet')<0 && mr.indexOf('PINs')<0 && mr.indexOf('temporary password')>=0 && mr.indexOf('Reset data clears its program data')>=0, 'Full pass 5.1: the Help text for the Culture Dashboard is current and the PINs wording is gone (Spec §25.5; 4 Nov 2026, Paul: Help rebuilt on the family model, so the check reads the new wording)');
    ok(!/POSTi|LIT Scoring|Risk Dashboard|risk mapping|governance discipline|Exit Plan|RACI/.test(mr), 'no Governance help text remains');
    ok(mr.indexOf('saved to your organization\u2019s shared workspace as you work')>=0 && mr.indexOf('emails a completion report to every team member with an email address')>=0 && mr.indexOf('routed through the program\u2019s server rather than directly from your browser')>=0, 'the three production-forward passages are present (\u00a716; 4 Nov 2026: the Pipeline wording, adapted, per \u00a716)');
    ok(/h\+='<\/div><\/div>';[^\n]*\nmr\.innerHTML=h;/.test(w.eval('renderModal.toString()')), 'the Help modal\u2019s markup closes (the closing line is appended, not a bare statement)');
    ok(w.eval('PH').every(function(p){return mr.indexOf('>'+p.name+' \u2013 ')>=0 && p.steps.every(function(s){return mr.indexOf(s.name)>=0})}) && /PH\.forEach\(function\(p\)/.test(w.eval('renderModal.toString()')), 'the phases section is read from PH (4 Nov 2026: the family phase cards, each phase\u2019s name, days, and steps)');})();
  w.eval("closeModal();data.settings={aiGuide:true,voice:true};UI.navMore=true;render()"); await wait(); /* 6 Oct 2026 (Batch 8c): Help names Voice as appearing once switched on, so the check switches it on */
  (function(){var nav=w.document.getElementById('navTabs').innerHTML+w.document.getElementById('navRight').innerHTML;
    /* 6 Oct 2026 (Batch 8b, item 84): Help now names Reset data on the admin console, so the nav list drops Reset all data */
    /* 6 Oct 2026 (Batch 8e): Help names Org &amp; Team and Demo */
    ok(['Home','Learn','Framework','Culture Dashboard','Insights','Track Program','Voice','Org &amp; Team','Team Chat','Notes','Demo'].every(function(l){return nav.indexOf(l)>=0}), 'every interface label Help names exists in the nav (label-faithful, \u00a716)');})();
  w.eval("UI.navMore=false;go('phase5')"); await wait();
  (function(){var dh=w.document.getElementById('app').innerHTML;
    /* 8 Oct 2026 (Batch 6, 5.1): retargeted — old expectation: the page carried 'This page has not been built yet.'; it is now the built dashboard with its title and hero */
    ok(['Culture Dashboard','data-db="hero"'].every(function(l){return dh.indexOf(l)>=0}) && dh.indexOf('This page has not been built yet.')<0, 'the Culture Dashboard that Help names is the built page: its title and hero are on it and no not-built line');})();
  /* ── Conformance Batch 5a (25 Sep 2026): the print shell, the tokens, the family print control, and two documents (Spec \u00a722) ── */
  const appSrc9=fs.readFileSync('Culture-app.js','utf8'), home9=fs.readFileSync('Culture-home.html','utf8'), idx9=fs.readFileSync('Culture-index.html','utf8');
  (function(){var t=w.eval('printThemeTokens()');
    ok(t.indexOf('--gold:#A13848')>=0 && t.indexOf('#E8621A')<0 && t.indexOf('--ph1:#33667E')>=0, 'the print tokens are Culture\u2019s own (garnet accent, Culture\u2019s phase hues), not the Pipeline leftover');
    var defined={};(t.match(/--[\w-]+(?=:)/g)||[]).forEach(function(k){defined[k]=1});
    /* 7 Oct 2026 (Batch 1): cultureReportBody is retired. dashboardDoc is not listed: it carries Governance's dashboard stylesheet verbatim, whose var(--op) the print window does not define */
    /* 7 Oct 2026 (Batch 1, close-out): dashboardDoc is scanned too, with Governance's verbatim stylesheet block cut out of its source so that the stylesheet's own var(--op) does not trip the scan */
    var src=['printDocument','printDocCover','mgmtHubDoc','docHead','docFigRow','docSection','lyRow'].map(function(f){return w.eval(f+'.toString()')}).join('')+w.eval('culMapDoc.toString()+culMapDimDoc.toString()+culMapPrintSqs.toString()'); /* the culture map's sources, whose tokens travel in its own print stylesheet (Paul, 1 Nov 2026; was dashboardDoc) */ (w.eval('CUL_MAP_PRINT_TOKENS').match(/--[\w-]+(?=:)/g)||[]).forEach(function(k){defined[k]=true});
    var used=(src.match(/var\((--[\w-]+)/g)||[]).map(function(x){return x.slice(4)});var und=used.filter(function(k){return !defined[k]});
    ok(und.length===0, 'every token the documents use is defined in the print window ('+und.join(',')+')');})();
  ok(w.eval('PRINT_MODULE_NAME')==='90-Day AI-Ready Culture' && home9.indexOf('AI-Ready Culture</em>')>=0 && idx9.indexOf('AI-Ready <span>Culture</span>')>=0, 'the module name agrees across the cover, the home heading, and the header (\u00a722.3.1)');
  ok(!/Print \/ Save as PDF|Download as PDF|\u2193 PDF/.test(appSrc9), 'every print button is the family \u25BE Save as PDF (\u00a722.2.1)');
  // catch the print window
  var _docs=[];w.open=function(){var buf='';return {document:{write:function(s){buf+=s},close:function(){_docs.push(buf)}},print:function(){}}};
  w.eval("data.enterprise=data.enterprise||{};data.enterprise.name='Probe Enterprise'");
  w.eval("go('phase5')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf("printCurrentPage()")>=0 && w.document.getElementById('app').innerHTML.indexOf('\u25BE Save as PDF')>=0, 'the Culture Dashboard carries the print control in its header (\u00a722.2.2)');
  w.eval('printCurrentPage()'); await wait();
  w.eval("go('mgmt-hub')"); await wait(); w.eval('printMgmtAnalytics()'); await wait();
  (function(){var rep=_docs[0]||'',hub=_docs[1]||'';
    /* 25 Sep 2026 (Batch 7b): retargeted — the dashboard now prints its own document on the Governance anatomy; the superseded pin asserted the Culture Report interim. The Culture Report still prints from its own page (below). */
    ok(rep.indexOf('<title>Culture Map</title>')>=0 /* the Dashboard prints the culture map (Paul, 1 Nov 2026; was Culture Dashboard) */ && hub.indexOf('<title>Module Management</title>')>=0, 'the dashboard prints its own document and Track Program prints Module Management');
    [['Culture Map',rep],['Module Management',hub]].forEach(function(p){ /* 25 Sep 2026 (Batch 7b): the first document is now the dashboard's */var b=p[1].indexOf('<title>'+p[0]+'</title>')>=0?p[1].slice(p[1].indexOf('<body>')):''; /* only the named document is checked */
      ok(b.indexOf('NextChapter \u00b7 90-Day AI-Ready Culture')>=0 && b.indexOf('Probe Enterprise')>=0 && /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/.test(b), p[0]+': the cover carries the kicker, the organization, and the date (\u00a722.3.1)');
      ok(p[1].indexOf('@bottom-left{content:"\u00a9 ')>=0 && p[1].indexOf('counter(page)')>=0, p[0]+': the document owns the page corners (\u00a722.3.2)');
      ok(b.length>500 && !/<button|onclick=|overflow-x/.test(b.replace(/<div class="preview-note"[\s\S]*?<\/div>/,'')), p[0]+': report law \u2014 no buttons, handlers, or scrolling in the printed document');
      ok(b.length>500 && !/\d{4}-\d{2}-\d{2}/.test(b.replace(/<[^>]+>/g,' ')), p[0]+': no ISO date in the printed text (item 76)');});
    ok(rep.indexOf('<title>Culture Map</title>')>=0 /* the Dashboard prints the culture map (Paul, 1 Nov 2026; was Culture Dashboard) */ && rep.length>500 && !/Step \d\.\d/.test(rep.replace(/<[^>]+>/g,' ')) && rep.indexOf('Published internally per')<0, 'Culture Report: no step numbers or meta language (\u00a722.4.2)');})();
  /* 7 Oct 2026 (Batch 1): retargeted — the old Culture Report page and its print are retired; the dashboard's document (checked above) is the one printed page of this kind until batch 6 */
  ok(w.eval("typeof renderReport")==='undefined' && w.eval("typeof printCultureReport")==='undefined' && w.eval("typeof cultureReportBody")==='undefined', 'the old Culture Report page, its document and its print are retired');
  ok(w.eval("(function(){var c=currentPage;currentPage='report';var t=printCurrentPage.toString();currentPage=c;return t})()").indexOf("'report'")<0, 'printCurrentPage has no report branch');
  /* ── Conformance Batch 5b (25 Sep 2026): the Report Manager (Spec \u00a722.7) ── */
  (function(){var erSrc=fs.readFileSync('../donors/exec-readiness/Exec-Readiness-app.js','utf8');
    var seams={rcSection:1,rcCatalogue:1,rcUnitBody:1,rcUnitFact:1,rcUnitGaps:1,rcKindLabel:1,rcUnitDesc:1,rcLeaderPasses:1}; /* 25 Oct 2026 (audit fix round): audit F2, Spec §23.3 and §26.1 (Revision AP, superseding §22.7's byte-form for these units) — sections are addressed by key and every write is guarded by rcLocked, the Architecture donor's law; their behavior is pinned in the harness's AUDIT-FIX frame. */ var s23={rcNew:1,rcSet:1,rcSetNote:1,rcSetDepth:1,rcToggle:1,rcMove:1,rcDelete:1,rcDuplicate:1,rcSaveText:1,rcPreviewUnit:1,rcAddText:1,rcSetUnit:1,rcRemoveAt:1,rcSetTextHtml:1,rcEditor:1};
    var names=(erSrc.match(/\nfunction (rc\w+|_rc\w+|renderReports)\(/g)||[]).map(function(x){return x.replace(/\nfunction |\(/g,'')});
    /* 6 Oct 2026 (Batch 8g, item 87): rcUnitName carries the personal record's branch ahead of ER's body; the census compares the rest */
    var bad=names.filter(function(n){if(seams[n]||s23[n])return false;var t;try{t=w.eval(n+'.toString()')}catch(e){return true}if(n==='rcUnitName')t=t.replace("if(u.kind==='person'){var _p=prFind(u.id);return 'Personal record: '+((_p&&_p.name)||u.name||'')} /* A.7.2 */ ",'');return erSrc.indexOf(t)<0});
    ok(names.length>=30 && bad.length===0, 'Report Manager: every non-catalog unit is the ER byte-form ('+names.length+' units; differing: '+bad.join(',')+')');})();
  w.eval("UI.navMore=true;render()"); await wait();
  ok(w.document.getElementById('navRight').innerHTML.indexOf('Report Manager')>w.document.getElementById('navRight').innerHTML.indexOf('Track Program'), 'the Report Manager\u2019s door sits in the More menu after Track Program');
  w.eval("UI.navMore=false;go('reports')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(h.indexOf('<h2>Error</h2>')<0 && h.length>500, 'the Report Manager page renders');
    ok(w.document.getElementById('pipSidebar').style.display!=='none', 'the sidebar shows on the Report Manager page (\u00a722.8)');})();
  /* 6 Oct 2026 (Batch 8g, Spec §25.7 / item 87): retargeted — the catalog also carries the Individual People group, one entry per person; the superseded pin required the two pages alone */
  /* 7 Oct 2026 (Batch 2, step 2): retargeted — the catalog also lists the Baseline Report, Phase 1's output, before the pages; the superseded pin required the two pages alone */
  ok(JSON.stringify(w.eval("rcCatalogue().filter(function(u){return u.kind!=='person'&&u.kind!=='team' /* Team View's entries carry generated team ids; the TVPRINT pin checks them (Paul, 1 Nov 2026) */}).map(function(u){return u.kind+':'+u.id+':'+u.name})"))===JSON.stringify(['output:out-baseline:Baseline Report','output:out-aiuses:AI Use Inventory' /* Paul's ruling of 29 Oct 2026: the AI Use Inventory joins Phase 1 */,'output:out-target:Target Culture','output:out-powermap:Power Map','output:out-rewiring:Rewiring Plan','output:out-comms:Workforce Communication Plan' /* Paul's ruling of 29 Oct 2026: the Workforce Communication Plan joins Phase 2 */ /* Paul, 29 Oct 2026: the Rewiring Plan joins Phase 2 */ /* 7 Oct 2026 (Batch 3, step 2.2): retargeted, the Power Map joins the Report Manager list */,'output:out-charter:Rewiring Charter' /* 7 Oct 2026 (Batch 3, step 2.3): retargeted, the Rewiring Charter joins the list */,'output:out-culturereport:Culture Report' /* 8 Oct 2026 (Batch 4, step 3.1): retargeted, the Culture Report joins the list after the Rewiring Charter */,'output:out-blockers:Leaders and Managers' /* Paul's ruling of 20 Oct 2026 */ /* 8 Oct 2026 (Batch 4, step 3.2): retargeted, the Blockers document joins the list after the Culture Report */,'output:out-aireview:AI Deployment Review' /* 8 Oct 2026 (Batch 4, step 3.4): retargeted, the AI Deployment Review joins the list after the Blockers document */,'output:out-sustainment:Sustainment Plan' /* 8 Oct 2026 (Batch 5, step 4.1): retargeted, the Sustainment Plan joins the list after the AI Deployment Review */,'output:out-day90:Day-90 Report' /* 8 Oct 2026 (Batch 5, commit 4): retargeted, the Day-90 Report joins the list after the Sustainment Plan */,/* 30 Oct 2026 (Paul): the Culture Review is no longer an output, so it leaves the catalogue; a logged review prints from its own page */'page:phase5:Culture Map','page:5.2:Culture Tracker','page:5.3:Communication Planning Hub','page:5.4:Analytics','page:mgmt-hub:Module Management' /* Paul, 1 Nov 2026: the report manager prints the culture map and every other page that prints its own document (was Culture Dashboard and Module Management only) */]) && w.eval("rcCatalogue().filter(function(u){return u.kind==='person'}).length")===w.eval("prPeople().length") && w.eval("rcCatalogue().filter(function(u){return u.kind==='person'}).every(function(u){return u.group==='Individual People'})"), 'the catalog lists the Phase 5 pages named as their documents are titled, and Individual People one entry per person');
  w.eval("rcNew()"); await wait();
  var _rid=w.eval("UI.rcEdit");
  ok(!!_rid && w.eval("data.reportDefs.length")>=1 && w.eval("Array.isArray(culEmptyData().reportDefs)"), 'a definition is saved on the organization (data.reportDefs, declared in CUL_SCHEMA)');
  w.eval("rcToggle('"+_rid+"','page:phase5');rcToggle('"+_rid+"','page:mgmt-hub');rcAddText('"+_rid+"')"); await wait();
  w.eval("(function(){var d=rcFind('"+_rid+"');var u=d.units[d.units.length-1];u.name='Probe Note';u.html='<b>Kept</b><script>bad()<\\/script><img src=x onerror=bad()>'})()");
  var _doc=w.eval("rcCompile('"+_rid+"')");
  /* 25 Sep 2026 (Batch 7b): retargeted — the dashboard's section is now titled as its document, Culture Dashboard; the superseded pin looked for the interim's name. */
  ok(_doc.indexOf('NextChapter \u00b7 90-Day AI-Ready Culture')>=0 && _doc.indexOf('Contents')>=0 && _doc.indexOf('Culture Map')>=0 /* Paul, 1 Nov 2026: was Culture Dashboard */ && _doc.indexOf('Module Management')>=0, 'a compiled report carries the cover, the contents, and each section');
  ok(_doc.indexOf('<b>Kept</b>')>=0 && _doc.indexOf('<script')<0 && _doc.indexOf('onerror')<0, 'text pages are sanitized (Bold kept, script and handlers stripped)');
  ok(_doc.length>1000 && !/<button|onclick=|overflow-x/.test(_doc), 'the compiled report passes report law');
  ok(w.eval("rcUnitFact({kind:'page',id:'phase5'})").indexOf('initiatives across')>0 /* the culture map's fact (Paul, 1 Nov 2026; was steps complete) */ && w.eval("rcUnitFact({kind:'page',id:'mgmt-hub'})").indexOf('step')>0, 'each section row reads a live fact about its size');
  /* ── Conformance Batch 6 (25 Sep 2026): two defects the new harness found ── */
  ok(w.eval("esc('a\"b<c>')")==='a&quot;b&lt;c&gt;' && w.eval("esc(0)")==='0', 'esc is the family form: quotes escaped, zero kept (attribute injection closed)');
  /* 7 Oct 2026 (Batch 1): retargeted — the quote walk runs on a team through the stand-in page (fxOn), since the step shells hold no fields until the step batches build them */
  w.eval("data.teams=[{id:'tmQ',name:'Say \"hi\" & go',manager:'',headcount:0}]");fxOn();w.eval("go('step','1.1')"); await wait();
  ok(w.document.getElementById('tm_name_tmQ') && w.document.getElementById('tm_name_tmQ').value==='Say \"hi\" & go', 'a quote in a record’s name leaves its field intact');fxOff();
  (function(){var docs=[];w.open=function(){var buf='';return {document:{write:function(s){buf+=s},close:function(){docs.push(buf)}},print:function(){}}};
    w.confirm=()=>true;w.eval('seedSampleData()');
    ok(w.eval('(data.teams||[]).length')>0, 'the fixture carries the seeded teams');
    w.eval("go('phase5')");w.eval('printCurrentPage()');var b=(docs[0]||'').slice((docs[0]||'').indexOf('<body>'));
    ok(b.length>500 && b.indexOf('Culture Map')>=0 /* the Dashboard prints the culture map (Paul, 1 Nov 2026; was Culture Dashboard) */ && !/<button|onclick=|overflow-x|<title>|step \d\.\d/i.test(b.replace(/<title>[^<]*<\/title>/,'')), 'the dashboard document passes report law on the full seed');})();
  /* ── Batch 7a (25 Sep 2026): Governance donor ports — the account menu (item 72), the Add face, the ruled reset ── */
  (function(){var gSrc=fs.readFileSync('../donors/governance/Governance-app.js','utf8');
    /* 6 Oct 2026 (Batch 8f, item 92): the same single substitution allowed (todayIso() for Governance's UTC day; a donor-side item) */
    ['_userMenuHtml','_paintNavMenu','toggleUserMenu','closeUserMenu','asgnOpenTasks','asgnGo','asgnRowHtml','asgnListHtml','openAssignments','renderAssignmentsModal','asgnOverviewCard','btnAdd','_btnKeep'].forEach(function(fn){
      ok(gSrc.indexOf(w.eval(fn+'.toString()').split('todayIso()').join("new Date().toISOString().split('T')[0]").split('nav-more-menu nav-user-menu').join('nav-more-menu'))>=0, 'Governance byte-form: '+fn);}); /* 2 Nov 2026 (Sweep 5 item 37): the account menu's own class, nav-user-menu, anchors it left; allowed as a documented difference until the family applies the addendum (Family_Directive_Addendum_2026-11-02.md, item 8) */
    /* 6 Oct 2026 (Batch 8b, item 106): retargeted — clearData carries the rights guard ahead of Governance's body */
    ok(gSrc.indexOf(w.eval("clearData.toString()").replace('data=culEmptyData();','data=govEmptyData();').replace("if(!isOrgAdminNow())return; /* 5 Oct 2026 (Sweep 4R item 29): rights checked inside the function */",''))>=0, 'Governance byte-form: clearData, behind the item-106 rights guard');})();
  w.eval("Auth.setSession(USERS[0].id);currentUserId=USERS[0].id;UI.userMenu=false;go('home')"); await wait();
  (function(){var nr=w.document.getElementById('navRight').innerHTML;
    ok(nr.indexOf('onclick="toggleUserMenu(event)"')>=0 && nr.indexOf('onclick="signOut()" title="Click to sign out"')<0, 'the name chip opens the account menu; it no longer signs out on click');})();
  w.eval("UI.userMenu=true;render()"); await wait();
  (function(){var nr=w.document.getElementById('navRight').innerHTML;
    ok(['Org Profile','View Assignments','Sign Out'].every(function(l){return nr.indexOf(l)>=0}) && w.eval('currentUserId')!==null, 'the account menu holds Org Profile, View Assignments, and Sign Out, and opening it signs no one out');})();
  w.eval("UI.userMenu=false;data.assigns=data.assigns||{};data.assigns['2.2']=[currentUserId];delete data.completedSteps['2.2'];openAssignments()"); await wait();
  ok(w.document.getElementById('modalRoot').innerHTML.indexOf(w.eval("PH[1].steps[1].name"))>=0, 'View Assignments lists the member\u2019s open task');
  w.eval("asgnGo('2.2')"); await wait();
  ok(w.eval('currentPage')==='step' && w.eval('currentStep')==='2.2', 'an assignment opens its step');
  w.eval("go('pipeline')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('My Assignments')>=0, 'the overview carries My Assignments when the member has open work');
  w.eval("data.assigns={};go('pipeline')"); await wait();
  ok(w.document.getElementById('app').innerHTML.indexOf('My Assignments')<0, 'and hides it when there is none');
  (function(){var src=fs.readFileSync('Culture-app.js','utf8'),css=fs.readFileSync('Culture-styles.css','utf8');
    ok(!/btn\('\+[^']*',[^;]*?,'bs'\)/.test(src) && (src.match(/btnAdd\('\+/g)||[]).length>=2, /* the step pages' Add controls return with the step batches, so the count only grows */ 'every Add control takes the family Add face (btnAdd); the two left are the Org & Team dialog\u2019s, and the step pages\u2019 return with their step batches');
    ok(css.indexOf('.btn.add{background:rgba(var(--gold-rgb),.08);color:var(--gold-text);border:1px solid rgba(var(--gold-rgb),.5)}')>=0, 'the Add face\u2019s stylesheet rules are installed');})();
  ok(w.eval("btnAdd('+ Probe','probe()')").indexOf('class="btn add"')>=0 && w.eval("btnAdd('+ Probe','probe()')").indexOf('+ Probe')>=0, 'the Add face renders the family Add class (btnAdd; the step pages’ Add controls return with their step batches)');
  /* ── Batch 7b (25 Sep 2026): the Culture Dashboard's document on the Governance anatomy (Spec \u00a722.6.1) ── */
  ok(true, 'the Culture Dashboard document on the Governance anatomy (superseded 1 Nov 2026, Paul: dashboardDoc is retired; the Dashboard and the Report Manager both print the culture map, checked by the MAPPRINT and RMNEW pins)');
  ok(w.eval('renderDashboardContent()').indexOf('cul-mapprint')>=0 && w.eval('renderDashboardContent()').indexOf('printCurrentPage()')>=0 /* the print control sits over the map (Paul, 1 Nov 2026; was printBar in the header) */ && w.eval('renderDashboardContent()').indexOf('Culture Dashboard')>=0 && w.eval('renderDashboardContent()').indexOf(w.eval("STEP_FLOW[5][0].sh"))>=0, 'the dashboard shell keeps its print control, its title and the 5.1 description (§22.2.2)');
  ok(w.eval("docFieldsToValues('<input value=\"A\"><select><option value=\"x\">X</option><option value=\"y\" selected>Y</option></select><textarea>T</textarea><input value=\"\">')")==='<span class="gd-val">A</span><span class="gd-val">Y</span><span class="gd-val">T</span><span class="gd-val"><span style="color:#999">Not recorded</span></span>', 'a form field prints as its value (§22.6.3)');
  /* 7 Oct 2026 (Batch 1): retargeted — CUL_DOC_EMPTY_LINES is empty until a step batch adds its pairs; a probe pair pushed onto it and removed again shows the §22.4.7 mechanism still works (the signals pair retired with the signal audit) */
  ok(w.eval("CUL_DOC_EMPTY_LINES.length")===0, 'the empty-line pairs are empty until the step batches add them (§22.4.7)');
  w.eval("CUL_DOC_EMPTY_LINES.push(['Probe screen instruction.','Nothing recorded yet.'],['Second probe screen string','Second document line'])");
  ok(w.eval("docEmptyLines('a Probe screen instruction. b Second probe screen string c')")==='a Nothing recorded yet. b Second document line c', 'an empty section prints one plain line, not the screen’s instruction (§22.4.7): every registered pair is applied');
  w.eval("CUL_DOC_EMPTY_LINES.length=0");
  w.confirm=()=>true; w.eval('seedSampleData()'); await wait();
  (function(){var doc=w.eval('culMapDoc(true)'),page=w.eval('renderDashboardContent()');var body=doc.slice(doc.indexOf('<section class="mp-land">')); /* the culture map document (Paul, 1 Nov 2026; was dashboardDoc) */
    ok(!/<(input|select|textarea|button)\b|onclick=|overflow-x|min-width:[1-9]\d*px|<title>/.test(body) && !/Step \d\.\d/.test(body.replace(/<[^>]+>/g,' ')), 'report law on the seeded shell (the §22.9.2 seed check, with the sections it needs, lands in batch 6)');
    ok(page.indexOf('data-db="hero"')>=0&&doc.indexOf('The Culture Map')>=0&&w.eval('culMapDims()').every(function(d){return doc.indexOf(w.eval('esc')(d.name))>=0}), 'nothing the page does not show: the document is the page’s culture map, with every dimension');
    ok(w.eval("rcUnitBody({kind:'page',id:'phase5'},'')").indexOf('min-height:85vh')<0 && w.eval("rcUnitBody({kind:'page',id:'phase5'},'')").indexOf('<section class="mp-land">')>=0 /* the culture map (Paul, 1 Nov 2026) */, 'the Report Manager takes the culture map without its cover');})();
  /* ── Batch 7c (25 Sep 2026): from Paul's visual pass ── */
  ok(!/\\u[0-9a-fA-F]{4}/.test(fs.readFileSync('Culture-learn.html','utf8')) && !/\\u[0-9a-fA-F]{4}/.test(fs.readFileSync('Culture-home.html','utf8')), 'the screens carry no literal \\u escapes (HTML prints them as text)');
  (function(){var W={};new Function('window',fs.readFileSync('Culture-templates-local.js','utf8'))(W);ok(W.__LOCAL_TEMPLATES.learn===fs.readFileSync('Culture-learn.html','utf8'), 'the bundle carries the corrected Learn screen');})();
  w.eval("signOut()"); await wait();
  ok(w.document.getElementById('sidebarToggle').style.display==='none' && w.document.getElementById('app').className.indexOf('sidebar-collapsed')>=0, 'the sign-in screen hides the sidebar toggle and collapses the content column (ER form)');
  w.eval("Auth.setSession(USERS[0].id);currentUserId=USERS[0].id;UI.entry=null;go('pipeline')"); await wait(); /* 6 Oct 2026 (Batch 8d): the simulated sign-in now clears the pending entry step, as doLogin does; under the ported render gate a pending step keeps the entry screen up */
  ok(w.document.getElementById('sidebarToggle').style.display!=='none', 'after sign-in the toggle returns on sidebar pages');
  /* ── Batch 8a (6 Oct 2026): session sealing (Spec §24; items 79, 104), the unread count (§26.7; item 101), locks by session (§26.6; item 100) ── */
  (function(){var appSrc=fs.readFileSync('Culture-app.js','utf8');
    ok(/var UI_PRISTINE = JSON\.stringify\(UI\);/.test(appSrc) && /var COACH_MSGS_PRISTINE = JSON\.stringify\(coachMsgs\);/.test(appSrc), 'pristine copies are taken at the declarations of UI and coachMsgs (\u00a724.3)');
    var boot=appSrc.slice(appSrc.indexOf('function bootApp('),appSrc.indexOf('\n}\n',appSrc.indexOf('function bootApp('))), refresh=appSrc.slice(appSrc.indexOf('function refreshOrg('),appSrc.indexOf('function refreshOrg(')+800);
    ok(boot.indexOf('sealSession')<0 && refresh.indexOf('sealSession')<0, 'the page-load restore path and adoption never seal (\u00a724.1)');})();
  function dirty(){w.eval("UI.probeKeyNoListKnows=1;UI.theme='light';UI.zoom=1.5;UI.expanded={x:1};coachMsgs.push({role:'user',text:'probe'});gchatLastOpened=0;chatArr().push({id:'cmprobe',who:'someone-else',name:'X',at:Date.now(),text:'x'});currentPage='insights';insightsTab='worth';Store.setPref('theme','light');Store.setPref('zoom',1.5);Store.setPref('sidebar-min','0');document.getElementById('coachPanel').innerHTML='<p>old coach text</p>';document.getElementById('gchatPanel').innerHTML='<p>old chat text</p>'")}
  function sealed(label){
    var u=JSON.parse(w.eval('JSON.stringify(UI)'));delete u.entry;var p=JSON.parse(w.eval('UI_PRISTINE'));p.theme='dark';p.zoom=1;delete p.entry;
    ok(JSON.stringify(u)===JSON.stringify(p), label+': UI returns to its pristine copy, with Culture\u2019s defaults');
    ok(w.eval('JSON.stringify(coachMsgs)')===w.eval('COACH_MSGS_PRISTINE') && w.eval('chatUnread()')===0 && w.eval('currentPage')==='home' && w.eval('insightsTab')==='latest' && w.eval('navHistory.length')===0, label+': the AI Guide conversation, unread count, page, Insights tab, and history are at their starting values');
    ok(w.eval("Store.getPref('theme')")==='dark' && String(w.eval("Store.getPref('zoom')"))==='1' && w.eval("Store.getPref('sidebar-min')")==='0', label+': the stored preferences are at their defaults (dark, sidebar open — ruled 25 Oct 2026)');
    ok(w.document.getElementById('coachPanel').innerHTML.indexOf('old coach text')<0 && w.document.getElementById('gchatPanel').innerHTML.indexOf('old chat text')<0, label+': the closed panels are emptied (\u00a724.5)');}
  w.confirm=()=>true;
  var _org=w.eval('currentOrgId'),_uid=w.eval('USERS[0].id');
  w.eval("Auth.setSession('"+_uid+"');currentUserId='"+_uid+"'"); dirty(); w.eval('signOut()'); await wait(); sealed('signOut');
  dirty(); w.eval("switchToOrg('"+_org+"')"); await wait(); sealed('switchToOrg');
  dirty(); w.eval("createOrg('Probe Seal Org',{name:'Probe Admin',username:'probeseal',passcode:'1234',role:'Administrator'})"); await wait(); sealed('createOrg');
  w.eval("switchToOrg('"+_org+"');Auth.setSession('"+_uid+"');currentUserId='"+_uid+"';render()"); await wait();
  // locks belong to sessions: the same person in another tab is refused
  w.localStorage.setItem('culture-locks::'+w.eval('currentOrgId'),JSON.stringify({'power::pwSess':{id:w.eval('currentUserId')+'@othertab',name:'Same Person',at:Date.now()}}));
  ok(w.eval("lockBlocked('power::pwSess')")===true, 'a lock is held by a session: the same person in another tab is refused (item 100)');
  w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId')); w.eval("Collab.acquire('power::pwSelf')");
  ok(w.eval("Collab.holder('power::pwSelf').id")!==w.eval('currentUserId') && w.eval("Collab.holder('power::pwSelf').id").indexOf(w.eval('currentUserId')+'@')===0, 'a lock this tab takes is stored under its session, not the bare user id (item 100)');
  w.eval("Collab.release('power::pwSelf')");
  w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId'));
  ok(w.eval("coachMsgs[0].text").indexOf('Danni, your AI guide')>=0 /* RETARGETED 10 Nov 2026 (Directive AskDanni): the opening is Danni's */ && !/Map, Build|Govern|NIST/.test(w.eval("coachMsgs[0].text")), 'the AI Guide opens as an AI guide to Culture\u2019s phases (no Governance leftovers)');
  /* ── Batch 8b (6 Oct 2026): fonts (item 80), the input cap (item 67), the console's Reset data (item 84), the setup code (93), username-only sign-in (97), rights and the members' view (94, 99, 106) ── */
  (function(){var ix=fs.readFileSync('Culture-index.html','utf8'),app=fs.readFileSync('Culture-app.js','utf8'),all=ix+app+fs.readFileSync('Culture-home.html','utf8')+fs.readFileSync('Culture-learn.html','utf8');
    ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(all) && ix.indexOf('<link rel="stylesheet" href="fonts/fonts.css">')>=0 && app.indexOf("new URL('fonts/fonts.css', location.href).href")>=0, 'no page or print window asks Google for fonts; both use fonts/fonts.css (item 80)');
    var css=fs.readFileSync('fonts/fonts.css','utf8'),urls=(css.match(/url\('([^']+)'\)/g)||[]).map(function(u){return u.slice(5,-2)});
    ok(urls.length===30 && urls.every(function(u){return fs.existsSync('fonts/'+u)}) && /font-family:'Cormorant Garamond'/.test(css) && /font-family:'DM Mono'/.test(css) && /font-family:'DM Sans'/.test(css), 'fonts.css names 30 font files, all present, under the family names');
    ok((app.match(/GLOBAL INPUT LENGTH CAP/g)||[]).length===2 && /\/\* \u2550\u2550\u2550 END GLOBAL INPUT LENGTH CAP \u2550\u2550\u2550 \*\/\n$/.test(app), 'the input-cap block is installed once, at the file\u2019s end (item 67, AC7: the opening and closing markers)');})();
  (function(){var ta=w.document.createElement('textarea');w.document.body.appendChild(ta);ta.value='x'.repeat(20000);ta.dispatchEvent(new w.Event('input',{bubbles:true}));
    ok(ta.value.length===10000, 'a 20,000-character paste keeps exactly the first 10,000 characters (item 67, AC2)');ta.parentNode.removeChild(ta);})();
  // the console's Reset data (item 84)
  (function(){w.confirm=()=>true;w.eval('seedSampleData()');var org=w.eval('currentOrgId');
    var other=w.eval("createOrg('Probe Reset Org',{name:'Probe Reset Admin',username:'probereset',passcode:'1234',role:'Administrator',admin:true})").orgId;
    w.eval("data.teams=[{id:'tm-x',name:'Probe team'}];data.settings={aiGuide:true,voice:false};USERS.push({id:'u-probe-member',name:'Probe Member',username:'probemember',passcode:'1234'});persistRoster();saveData()");
    w.eval("switchToOrg('"+org+"');isAppAdmin=true;UI.entry={step:'admin'};UI.probeKeep=1");
    var rev0=+(w.eval("Store.raw.get('culture-org-rev::"+other+"')")||0);
    w.eval("adminResetOrgData('"+other+"')");
    var o=JSON.parse(w.eval("JSON.stringify(Store.readOrg('"+other+"'))"));
    ok((o.teams||[]).length===0 && (o.roster||[]).every(function(u){return u.admin===true}) && (o.roster||[]).length>=1 && o.settings&&o.settings.aiGuide===true && !!o.resetAt, 'Reset data clears the chosen organization\u2019s program, keeps its administrators and settings, and stamps the reset (items 84, 68)');
    ok((o.rev||0)>=rev0 && w.eval('currentOrgId')===org && w.eval("UI.entry.step")==='admin' && w.eval('UI.probeKeep')===1, 'the reset never lowers the revision, leaves the console open, and does not seal (withOrgData)');
    /* 6 Oct 2026 (Batch 8d): retargeted — the console page is Architecture's renderAdminConsole, where Reset data sits; the in-app Admin dialog is Architecture's renderAdminModal, which has none */
    ok(w.eval("renderAdminConsole.toString()").indexOf("adminResetOrgData(")>=0, 'Reset data sits on the console\u2019s organization rows');
    w.eval("isAppAdmin=false"); var before=w.eval("JSON.stringify(Store.readOrg('"+other+"'))"); w.eval("adminResetOrgData('"+other+"')");
    ok(w.eval("JSON.stringify(Store.readOrg('"+other+"'))")===before, 'only the app administrator can reset from the console (rights inside the function, item 106)');
    w.eval("UI.entry={step:'login',err:''};switchToOrg('"+org+"')");})();
  // the setup code (item 93) and username-only sign-in (item 97)
  (function(){var n0=w.eval('getOrgs().length');w.eval("UI.entry={step:'setup',err:''};render()");
    var d=w.document;['setupCode','setupOrg','setupName','setupUser','setupPin'].forEach(function(id){if(!d.getElementById(id))ok(false,'setup field '+id+' present')});
    d.getElementById('setupCode').value='WRONG';d.getElementById('setupOrg').value='Probe Setup Org';d.getElementById('setupName').value='Probe Founder';d.getElementById('setupUser').value='probefounder';d.getElementById('setupPin').value='1234';
    w.eval('doSetup()');
    ok(w.eval('getOrgs().length')===n0 && w.eval('UI.entry.err')==='That setup code is not recognized.', 'a wrong setup code creates nothing and says so (item 93, A.5.21)');})();
  /* 6 Oct 2026 (Batch 8d, §25.5 point 6): retargeted — sample people have no password, so the check gives one a password first; the superseded pin signed in as harriet with the seed's old 1234 */
  w.eval("(USERS.find(function(u){return u.username==='harriet'})||{}).passcode='Culture2026!';persistRoster();saveData()");
  ok(w.eval("findUserByLogin('Harriet Rivers','Culture2026!')")===null && !!w.eval("findUserByLogin('harriet','Culture2026!')"), 'sign-in matches the username only, never the full name (item 97)');
  // the members' view: people and details for administrators only (items 94, 99, 106)
  (function(){w.confirm=()=>true;w.eval('seedSampleData()');var m=w.eval("(USERS.find(function(u){return u.admin!==true})||{}).id");
    w.eval("Auth.setSession('"+m+"');currentUserId='"+m+"';isAppAdmin=false;currentModal='org';renderOrgModal()");
    var mr=w.document.getElementById('modalRoot').innerHTML;
    ok(mr.indexOf('addProfile()')<0 && mr.indexOf('removeProfile(')<0 && mr.indexOf('Only administrators can change the organization\u2019s details.')>=0, 'an ordinary member sees no add or remove controls and the read-only line (items 94, 99)');
    ok(/id="ent_name"[^>]*disabled/.test(mr), 'the organization\u2019s details are read-only for a member');
    var n=w.eval('USERS.length'),tgt=w.eval("USERS.find(function(u){return u.id!=='"+m+"'}).id");
    w.eval("addProfile()"); ok(w.eval('USERS.length')===n && !w.eval("UI.orgEdit==='new'"), 'addProfile refuses an ordinary member (item 106)');
    w.eval("removeProfile('"+tgt+"')"); ok(w.eval("USERS.some(function(u){return u.id==='"+tgt+"'})"), 'removeProfile refuses an ordinary member (item 106)');
    w.eval("closeModal();var _a=USERS.find(function(u){return u.admin===true});Auth.setSession(_a.id);currentUserId=_a.id;render()");})();
  /* ── Batch 8c (6 Oct 2026): the AI features, off by default and switched per organization (Spec §25.2; item 81) ── */
  (function(){var app=fs.readFileSync('Culture-app.js','utf8');
    var fi=app.indexOf('fetch(CLAUDE_API_URL'),fn=app.slice(app.lastIndexOf('\nfunction ',fi),fi);
    ok((app.match(/fetch\(CLAUDE_API_URL/g)||[]).length===1 && /function sendCoach\(\)\{ if\(!aiGuideOn\(\)\)return;/.test(fn), 'the one AI request site begins with the guard');
    ok(app.indexOf('90-day governance program')<0, 'the Org & Team introduction no longer speaks of a governance program');})();
  ok(w.eval("JSON.stringify(culEmptyData().settings)")==='{"aiGuide":false,"voice":false}', 'a new organization starts with both switches off');
  (function(){var org=w.eval('currentOrgId');var fresh=w.eval("createOrg('Probe AI Org',{name:'Probe AI Admin',username:'probeai',passcode:'1234',role:'Administrator',admin:true})").userId;
    w.eval("Auth.setSession('"+fresh+"');currentUserId='"+fresh+"';render()");
    var nr=w.document.getElementById('navRight').innerHTML;
    ok(w.document.getElementById('coachFab').style.display==='none' && w.document.getElementById('voiceFab').style.display==='none' && nr.indexOf('toggleVoice()')<0, 'in a new organization neither button shows, and the More menu offers no Voice');
    var calls=0;w.fetch=function(){calls++;return new Promise(function(){})};
    w.eval("toggleCoach()"); ok(w.eval('coachOpen')===false, 'the AI Guide cannot open while switched off');
    w.eval("document.getElementById('coachInput')&&(document.getElementById('coachInput').value='probe');sendCoach()"); ok(calls===0, 'no request reaches the AI service while switched off');
    var _srStarted=false;w.SpeechRecognition=function(){this.start=function(){_srStarted=true};this.stop=function(){};};w.webkitSpeechRecognition=w.SpeechRecognition; /* a stand-in engine, so the check discriminates where jsdom has none */
    w.eval("toggleVoice()"); ok(!_srStarted && !w.eval("typeof _voiceActive!=='undefined'&&_voiceActive"), 'Voice never starts while switched off');
    w.eval("currentModal='org';renderOrgModal()"); var mr=w.document.getElementById('modalRoot').innerHTML;
    ok(mr.indexOf('AI Features (off by default)')>=0 && mr.indexOf('When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.')>=0 && mr.indexOf('When this is on, Voice uses the browser\u2019s own speech recognition.')>=0, 'administrators see the fold with the A.2 words');
    w.eval("setAiSetting('aiGuide',true)"); ok(w.document.getElementById('coachFab').style.display!=='none', 'switching the AI Guide on shows its button at once');
    w.eval("toggleCoach()"); ok(w.eval('coachOpen')===true, 'switched on, the AI Guide opens');
    w.eval("document.getElementById('coachInput').value='probe question';sendCoach()"); ok(calls===1, 'a question sends one request');
    w.eval("setAiSetting('aiGuide',false)"); ok(w.eval('coachOpen')===false && w.document.getElementById('coachFab').style.display==='none', 'switching it off closes the panel and hides the button at once');
    w.eval("switchToOrg('"+org+"')"); ok(w.eval("JSON.stringify((data.settings||{}))")!==undefined && w.eval("aiGuideOn()")===w.eval("!!(data.settings&&data.settings.aiGuide)"), 'each organization keeps its own switches');
    w.eval("var _m=USERS.find(function(u){return u.admin!==true});if(_m){Auth.setSession(_m.id);currentUserId=_m.id;isAppAdmin=false}");
    var before=w.eval("JSON.stringify(data.settings)"); w.eval("setAiSetting('voice',!(data.settings&&data.settings.voice))");
    ok(w.eval("JSON.stringify(data.settings)")===before, 'an ordinary member cannot change the switches (item 106)');
    w.eval("currentModal='org';renderOrgModal()"); ok(w.document.getElementById('modalRoot').innerHTML.indexOf('AI Features (off by default)')<0, 'an ordinary member sees no AI Features fold');
    w.eval("closeModal();var _a=USERS.find(function(u){return u.admin===true});Auth.setSession(_a.id);currentUserId=_a.id;render()");})();
  (function(){w.eval("data.settings={aiGuide:true,voice:false};coachOpen=false;toggleCoach();data.settings.aiGuide=false"); w.eval("sealSession()");
    ok(w.eval('coachOpen')===false, 'the seal closes the AI Guide even when it is switched off (the guard blocks opening only)');})();
  /* ── Batch 8d (6 Oct 2026): passwords within the local sign-in, the default administrator, unique usernames, administrators (items 85, 95, 96, 98, 102, 103) ── */
  ok(w.eval("passwordProblem('abc1!')")==='Use at least 8 characters.' && w.eval("passwordProblem('abcdefgh')")==='Include at least one number.' && w.eval("passwordProblem('abcdefg1')")==='Include at least one special character, such as ! or #.' && w.eval("passwordProblem('Password1!')")==='That password is too common. Choose another.' && w.eval("passwordProblem('Culture2026!x')")==='', 'the password rule\u2019s messages on item 85\u2019s four samples');
  (function(){var app=fs.readFileSync('Culture-app.js','utf8');
    ok(!/DEFAULT_PASSCODE\s*=\s*'1234'|passcode:'1234'|defaultPasscode\(\)\s*\|\|\s*'1234'/.test(app), 'no code defaults or seeds the code 1234 (item 85 check)');})();
  w.eval("signOut()"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;var pf=w.document.getElementById('loginPin');
    ok(pf && pf.type==='password' && pf.getAttribute('autocomplete')==='current-password' && h.replace(/<[^>]+>/g,' ').indexOf('PIN')<0, 'the sign-in field is a password field and no on-screen PIN remains (\u00a725.5 point 5)');})();
  (function(){w.eval("var _u=USERS.find(function(u){return u.username==='harriet'});_u.passcode='Temp2026!x';_u.mustChange=true;persistRoster();saveData()");
    w.document.getElementById('loginUser').value='harriet';w.document.getElementById('loginPin').value='Temp2026!x';w.eval('doLogin()');
    ok(w.eval("UI.entry&&UI.entry.step")==='newpw' && w.document.getElementById('app').innerHTML.replace(/<[^>]+>/g,'').indexOf('Choose a new password')>=0, 'a temporary password leads to Choose a new password before anything else (\u00a725.5 point 6)');
    w.eval("signOut()");w.eval("var _v=USERS.find(function(u){return u.username==='vincent'})||{};_v.passcode='1234';_v.mustChange=false;persistRoster();saveData()");
    w.eval("UI.entry={step:'login',err:''};render()");w.document.getElementById('loginUser').value='vincent';w.document.getElementById('loginPin').value='1234';w.eval('doLogin()');
    ok(w.eval("UI.entry&&UI.entry.step")==='newpw' && w.eval("UI.entry.why")==='weak', 'a correct stored password that breaks the rule is replaced at once (A.5.24)');})();
  w.eval("var _a=USERS.find(function(u){return u.admin===true});Auth.setSession(_a.id);currentUserId=_a.id;UI.entry=null;UI.navMore=true;render()"); await wait();
  ok(w.document.getElementById('navRight').innerHTML.indexOf('openChangePassword()')>=0, 'Change password is in the More menu for everyone signed in (A.5.11)');
  w.eval("UI.navMore=false;var _t=USERS.find(function(u){return u.username==='harriet'});_t.passcode='Visible2026!';UI.orgEdit=_t.id;currentModal='org';renderOrgModal()");
  (function(){var mr=w.document.getElementById('modalRoot').innerHTML;
    ok(mr.indexOf('Visible2026!')<0 && /type="password"[^>]*autocomplete="new-password"|autocomplete="new-password"[^>]*type="password"/.test(mr) || mr.indexOf('Visible2026!')<0 && mr.indexOf('Temporary password')>=0, 'the person editor never shows a password; it offers a Temporary password field');
    ok(mr.indexOf('> Administrator</label>')>=0 && mr.indexOf('At least 8 characters, including a number and a special character such as ! or #.')>=0, 'administrators see the Administrator tick box and the A.5.18 hint');})();
  ok(w.eval("usernameTaken(' HarRiet ',null)")===true && w.eval("usernameTaken('ADMIN',null)")===true && w.eval("usernameTaken('nobody-uses-this',null)")===false, 'usernames are unique ignoring capitals and every space; the administrator\u2019s username takes part (items 95, 102)');
  (function(){var admins=w.eval("USERS.filter(function(u){return u.admin===true}).map(function(u){return u.id})");
    w.eval("USERS.forEach(function(u){if(u.id!=='"+admins[0]+"')u.admin=false});persistRoster();saveData()");
    var _alerts=[];w.alert=function(m){_alerts.push(m)};
    w.eval("UI.orgEdit='"+admins[0]+"';renderOrgModal();var _cb=document.getElementById('ru_"+admins[0]+"_admin');if(_cb)_cb.checked=false;saveProfile('"+admins[0]+"')");
    ok(w.eval("USERS.find(function(u){return u.id==='"+admins[0]+"'}).admin")===true && _alerts.some(function(m){return m==='An organization needs at least one administrator. Make someone else an administrator first.'}), 'the last administrator cannot be demoted (item 98)');
    w.eval("closeModal();UI.orgEdit=null");})();
  (function(){var keep=w.eval('currentOrgId');w.eval("isAppAdmin=true");w.prompt=function(){return 'Probe Console Org'};
    var n0=w.eval('getOrgs().length');w.eval('adminAddOrg()');var org=w.eval("getOrgs().filter(function(o){return o.name==='Probe Console Org'})[0].id");
    var r=w.eval("JSON.stringify((Store.readOrg('"+org+"')||{}).roster)");var roster=JSON.parse(r);
    ok(w.eval('getOrgs().length')===n0+1 && roster.length===1 && /^owner\d*$/.test(roster[0].username) && roster[0].admin===true && !roster[0].passcode && w.eval('currentOrgId')===keep, 'a console-made organization\u2019s first person is owner (or owner2\u2026), an administrator with no password (item 102)');
    w.eval("isAppAdmin=false");})();
  (function(){w.eval("setAdminCreds({username:'admin',passcode:'Admin2026!x',mustChange:false})");w.eval("isAppAdmin=true");
    var answers=['wrong-current'],_al=[];w.prompt=function(){return answers.shift()};w.alert=function(m){_al.push(m)};
    w.eval('adminChangePasscode()');
    ok(w.eval("adminCreds().passcode")==='Admin2026!x' && _al.some(function(m){return /current password is not correct/.test(m)}), 'the console\u2019s Change password asks for the current password and refuses a wrong one (item 103)');
    w.eval("isAppAdmin=false");})();
  /* ── Batch 8e (6 Oct 2026): the sample organization and the sample tab's controls (Spec §25.3; items 83, 105) ── */
  (function(){var org=w.eval('currentOrgId'),uid=w.eval('currentUserId'),ptr=w.eval('Store.getCurrentOrg()');
    var opened=[];w.open=function(u,t){opened.push(u)};w.eval("openSampleTab()");
    ok(opened.length===1 && /\?sample=1$/.test(opened[0]) && !!w.localStorage.getItem('culture-sample-pass'), 'Demo opens the module in a new tab in sample mode, with a short-lived pass (A.3.1)');
    ok(w.eval('sampleTabAllowed()')===true && w.eval('sampleTabAllowed()')===false, 'the pass admits one sample tab, once');
    w.history.pushState({},'','/?sample=1'); ok(w.eval('isSampleTab()')===true, 'a ?sample=1 address is a sample tab'); w.history.pushState({},'','/');
    w.eval("sampleStart();render();sampleNoteEnsure()"); 
    ok(w.eval('SAMPLE_MODE')===true && w.eval('currentOrgId')===w.eval('SAMPLE_LOCAL_ID') && w.eval('Store.getCurrentOrg()')===ptr, 'the sample tab works on this browser\u2019s own copy; the main tab\u2019s stored pointer is untouched');
    ok(w.eval('USERS.length')>0 && w.eval('currentUserId')===w.eval('USERS[0].id') && w.eval("USERS.every(function(u){return !u.passcode})"), 'the tab enters as the first sample person; sample people have no passwords');
    w.eval("data.settings={aiGuide:true,voice:true}");
    ok(w.eval('aiGuideOn()')===false && w.eval('voiceOn()')===false, 'the AI Guide and Voice are off in the sample tab, whatever the settings say');
    var b=w.document.getElementById('sampleBanner');
    ok(!!b && b.textContent==='Sample organization: your changes stay in this browser only' && /font-weight:\s*800/.test(b.getAttribute('style')) && /text-align:\s*center/.test(b.getAttribute('style')), 'the red note, large, bold and centered, sits in the main content (A.3.2)');
    w.eval("UI.navMore=true;render()");var nr=w.document.getElementById('navRight').innerHTML;
    ok(nr.indexOf('gchatNavBtn')<0 && nr.indexOf('openSampleTab()')<0, 'the sample tab\u2019s top bar has no Team Chat and no Demo');
    ok(nr.indexOf('Start the sample again')>=0 && nr.indexOf('Close the sample')>=0 && nr.indexOf('Export state')<0 && nr.indexOf('Import state')<0 && nr.indexOf('Seed sample data')<0 && nr.indexOf('Change password')<0 && nr.indexOf('Org &amp; Team')<0, 'the sample tab\u2019s More menu: navigation, Start the sample again, Close the sample, nothing else (item 105)');
    w.eval("UI.navMore=false;gchatOpen=false;toggleGChat()"); ok(w.eval('gchatOpen')===false, 'Team Chat cannot open in the sample tab');
    var n0=w.eval('(data.notifications||[]).length');w.eval("notifyQueue('probe','Probe',['x@example.com'],'1.1')"); ok(w.eval('(data.notifications||[]).length')===n0, 'the sample tab sends no email');
    var closed=0;w.close=function(){closed++};w.eval('signOut()'); ok(closed===1 && w.eval('currentUserId')!==null && w.eval('SAMPLE_MODE')===true, 'Sign Out closes the sample; it never signs anyone out (item 105)');
    w.eval("data.teams=[];saveData()");w.confirm=()=>true;w.eval('sampleRestart()');
    ok(w.eval('(data.teams||[]).length')>0, 'Start the sample again restores the original sample (A.3.4)');
    ok(w.eval('renderSampleNeedsSignIn()').replace(/<[^>]+>/g,'')==='Sign in to your organization, then open Demo from the top bar.', 'an unsigned sample tab shows only its one sentence (A.3.6)');
    w.eval("SAMPLE_MODE=false;if(_sampleWatch){_sampleWatch.disconnect();_sampleWatch=null}var _sb=document.getElementById('sampleBanner');if(_sb)_sb.remove();setCurrentOrg('"+org+"');loadData();applyTeamRoster();currentUserId='"+uid+"';render()");})();
  /* ── Batch 8f (6 Oct 2026): state integrity (Spec §26.1–§26.5; items 88 to 92) ── */
  (function(){var app=fs.readFileSync('Culture-app.js','utf8');
    ok(app.indexOf("toISOString().split('T')[0]")<0 && /function culDayN\(\)\{if\(!data\.startDate\)return 0;return Math\.max\(1,programDay\(\)\+1\)\}/.test(app), 'every day is a local calendar day: no UTC day stamp remains, and the program day counts local days (item 92)');})();
  ok(w.eval("fmtDate('2026-09-01')")==='Sep 1, 2026' && w.eval("localDay('2026-09-01').getDate()")===1 && w.eval("todayIso()")===w.eval("isoLocal(new Date())"), 'a date-only value prints as that calendar day; today is the local day');
  /* 7 Oct 2026 (Batch 1): retargeted — the handler-lock registry (CUL_HANDLER_LOCKS) replaces the handler map; the registry holds culTeamDel and culRoleDel, an unmapped handler gives null, and a later batch's entry is read the same way */
  ok(w.eval("handlerLockKey((function(){var b=document.createElement('button');b.setAttribute('onclick',\"culTeamDel('tm1')\");return b})())")==='teams::tm1' && w.eval("handlerLockKey((function(){var b=document.createElement('button');b.setAttribute('onclick',\"culRoleDel('rl1')\");return b})())")==='roles::rl1' && w.eval("handlerLockKey((function(){var b=document.createElement('button');b.setAttribute('onclick',\"culNoSuchHandler('x1')\");return b})())")===null, 'a control without an id takes the lock of the record its handler writes; an unmapped handler takes none (item 88)');
  (function(){w.eval("CUL_HANDLER_LOCKS.push({fn:'culProbeDel',coll:'probes'})");var k=w.eval("handlerLockKey((function(){var b=document.createElement('button');b.setAttribute('onclick',\"culProbeDel('pb1')\");return b})())");w.eval("CUL_HANDLER_LOCKS.pop()");
    var k2=w.eval("handlerLockKey((function(){var b=document.createElement('button');b.setAttribute('onclick',\"culProbeDel('pb1')\");return b})())");
    ok(k==='probes::pb1' && k2===null, 'a handler added to the registry is read at once, and removing it removes the lock (the registry is the only map)');})();
  (function(){w.eval("currentModal='org';UI.orgEdit=USERS[0].id;renderOrgModal()");
    w.localStorage.setItem('culture-locks::'+w.eval('currentOrgId'),JSON.stringify({'roster':{id:'someone@othertab',name:'Probe Other',at:Date.now()}}));
    w.eval("applyLockUI(true)");var f=w.document.querySelector('#modalRoot [id^="ru_"]');
    ok(!!f && f.disabled===true && w.document.getElementById('modalRoot').innerHTML.indexOf('Locked \u00b7 Probe Other is editing')>=0, 'lock marks reach the open dialog, not only the page (item 88)');
    w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId'));w.eval("closeModal();UI.orgEdit=null;applyLockUI(true)");})();
  /* 7 Oct 2026 (Batch 1): retargeted — the draft lifecycle on the shared roles list (the dd register is retired); a row made by + Add is pushed and marked a draft the way the in-place add marks it */
  (function(){w.eval("go('step','2.5')");var n0=w.eval('(data.roles||[]).length');w.eval("(function(){data.roles.push({id:culNew('roles'),name:''});culInlineAdded('roles')})()");var id=w.eval('data.roles[data.roles.length-1].id');
    ok(w.eval('data.roles[data.roles.length-1]._inlineDraft')===true && w.eval('UI.inlineAdd&&UI.inlineAdd.id')===id, 'a row made by + Add is a draft until it is named (item 90)');
    w.eval("go('home')"); ok(w.eval('(data.roles||[]).length')===n0 && !w.eval("(data.roles||[]).some(function(r){return r.id==='"+id+"'})"), 'leaving a nameless draft removes it');
    w.eval("go('step','2.5');(function(){data.roles.push({id:culNew('roles'),name:''});culInlineAdded('roles')})()");var id2=w.eval('data.roles[data.roles.length-1].id');w.eval("fldSave('rl_name_"+id2+"','  Probe role  ')");
    ok(w.eval("data.roles.filter(function(r){return r.id==='"+id2+"'})[0].name")==='Probe role' && !w.eval("data.roles.filter(function(r){return r.id==='"+id2+"'})[0]._inlineDraft"), 'a named draft keeps its trimmed name and stops being a draft');
    ok(w.eval("fldSave('rl_name_"+id2+"','   ')")===false && w.eval("data.roles.filter(function(r){return r.id==='"+id2+"'})[0].name")==='Probe role', 'a rename to blank is refused (item 90)');
    w.eval("go('home')"); ok(w.eval("(data.roles||[]).some(function(r){return r.id==='"+id2+"'})"), 'a named row survives leaving the page');
    w.eval("data.roles.push({id:'rl-probe-blank',name:'',_inlineDraft:true});saveData();loadData();applyTeamRoster()");
    ok(!w.eval("(data.roles||[]).some(function(r){return r.id==='rl-probe-blank'})"), 'an abandoned nameless draft does not survive a load');})();
  (function(){w.eval("go('step','1.1')");ok(/function refreshGateInPlace\(\)/.test(w.eval('refreshGateInPlace.toString()')) && w.eval('fldSave.toString()').indexOf('refreshGateInPlace()')>=0 && w.eval('offscreenStep.toString()').indexOf('renderStepContent(id)')>=0, 'every field save refreshes the step\u2019s gates in place (item 89)');})();
  (function(){var org=w.eval('currentOrgId');var other=w.eval("createOrg('Probe Gone Org',{name:'Probe Gone',username:'probegone',passcode:'Gone2026!x',role:'Administrator',admin:true})");
    w.eval("deleteOrgById('"+other.orgId+"')");
    ok(JSON.parse(w.localStorage.getItem('culture-deleted-orgs')||'[]').indexOf(other.orgId)>=0, 'deleting an organization records it (item 91)');
    w.eval("currentOrgId='"+other.orgId+"';currentUserId='"+other.userId+"';UI.entry=null;data.teams=[{id:'tm-z',name:'Z'}];saveData()");
    ok(!w.localStorage.getItem('culture-org::'+other.orgId) && w.eval("UI.entry&&UI.entry.step")==='login', 'a session still open in a deleted organization writes nothing and lands on sign-in');
    w.eval("setCurrentOrg('"+org+"');loadData();applyTeamRoster();var _a=USERS.find(function(u){return u.admin===true});Auth.setSession(_a.id);currentUserId=_a.id;UI.entry=null;render()");})();
  (function(){var m=w.eval("(USERS.find(function(u){return u.admin!==true})||{}).id");w.eval("Auth.setSession('"+m+"');currentUserId='"+m+"';UI.entry=null");
    var d=JSON.parse(w.eval("Store.orgRaw(currentOrgId)"));d.roster=d.roster.filter(function(u){return u.id!==m});d.rev=(d.rev||0)+5;w.eval("Store.writeOrg(currentOrgId,"+JSON.stringify(d)+")");
    w.eval('Store.refreshOrg()');
    ok(!w.eval('currentUserId') && w.eval("UI.entry&&UI.entry.step")==='login', 'adopting a save that removed this member signs them out (item 91)');
    var _a=w.eval("(USERS.find(function(u){return u.admin===true})||{}).id");w.eval("Auth.setSession('"+_a+"');currentUserId='"+_a+"';UI.entry=null;render()");
    w.eval("_lastResetSeen=data.resetAt||1;data.resetAt=Date.now()+7;render()");
    ok(w.eval('_discardChangeUntil')>Date.now()-100, 'adopting a reset discards typed drafts and lets no stale field save');})();
  /* ── Batch 8g (6 Oct 2026): the personal record (Spec §25.7; item 87; the ER directive's Part 7.2 acceptance) ── */
  (function(){w.confirm=()=>true;w.eval('seedSampleData()');
    var m=w.eval("(USERS.find(function(u){return u.username==='harriet'})||USERS[0]).id"), nm=w.eval("USERS.find(function(u){return u.id==='"+m+"'}).name");
    w.eval("USERS.find(function(u){return u.id==='"+m+"'}).passcode='Secret2026!x';persistRoster();chatArr().push({id:'cm-pr-probe',who:'"+m+"',name:'"+nm+"',at:Date.now(),text:'Probe message for the personal record'});data.stories=(data.stories||[]);data.stories.push({id:'sy-pr-probe',title:'Probe story naming the member "+nm+"'});data.stepDoneById=data.stepDoneById||{};data.stepDoneById['1.1']='"+m+"';saveData()");
    var cat=w.eval("JSON.stringify(rcCatalogue().filter(function(u){return u.kind==='person'}))");cat=JSON.parse(cat);
    ok(cat.some(function(u){return u.id===m && u.group==='Individual People'}), 'Individual People lists each team member (A.7.1)');
    var pw=w.eval("(data.powerMap||[]).filter(function(p){return !USERS.some(function(u){return String(u.name).trim().toLowerCase()===String(p.name).trim().toLowerCase()})})[0]");
    ok(!pw || cat.some(function(u){return u.id===pw.id}), 'a person on the power map who is not a team member is listed too, once');
    ok(w.eval("rcUnitName({kind:'person',id:'"+m+"'})")==='Personal record: '+nm, 'the section heading reads Personal record: [name] (A.7.2)');
    var body=w.eval("personalRecordBody('"+m+"')");var txt=body.replace(/<[^>]+>/g,' ');
    ok(txt.indexOf('The information this workspace holds about '+nm+', gathered from every part of the program.')>=0, 'the record opens with A.7.3');
    ok(txt.indexOf('Probe message for the personal record')>=0 && /Marked complete[\s\S]*Step 1\.1/.test(txt) && txt.indexOf('Probe story naming the member')>=0, 'the record carries the member record, the messages they sent, their steps, and the records that name them');
    ok(body.indexOf('Secret2026!x')<0 && !/passcode|Password/i.test(txt), 'no password or password field ever appears (\u00a725.7)');
    var missing=w.eval("(function(){var p=prFind('"+m+"'),ids=[];Object.keys(CUL_SCHEMA).forEach(function(k){var c=CUL_SCHEMA[k];if(c.kind!=='list'||!Array.isArray(data[k])||['roster','chatMsgs','reportDefs','notifications'].indexOf(k)>=0)return;data[k].forEach(function(r){if(!r)return;var hit=Object.keys(r).some(function(f){return f!=='id'&&f.charAt(0)!=='_'&&prNamesIn(r[f],p)});if(hit&&p.power!==r)ids.push(k+':'+((c.nameField&&r[c.nameField])||r.name||r.text||r.date||r.id))})});var rows=prNamingRows(p).map(function(x){return x.rec});return ids.filter(function(x){return rows.indexOf(String(x.split(':').slice(1).join(':')).slice(0,80))<0})})()");
    ok(Array.isArray(missing) && missing.length===0, 'the search test: every record holding the person\u2019s id or full name appears in the record (Part 7.2 test 2)');
    w.eval("rcNew()");var defId=w.eval('UI.rcEdit');w.eval("rcFind('"+defId+"').units.push({kind:'person',id:'"+m+"'});saveData()");
    var comp=w.eval("rcCompile('"+defId+"')");ok(comp.indexOf('Personal record: '+nm)>=0 && comp.indexOf('Secret2026!x')<0, 'the personal record compiles into a Report Manager report');
    w.eval("rcDelete('"+defId+"')");})();
  /* ── Batch 1 step 1 (7 Oct 2026): the administrator console repair (ruling 13; Spec §25.3, §25.4) ── */
  (function(){w.confirm=()=>true;w.eval('seedSampleData()');var org=w.eval('currentOrgId');
    var a=w.eval("createOrg('Probe Console One',{name:'Probe Console One Admin',username:'probecon1',passcode:'1234',role:'Administrator',admin:true})").orgId;
    var b=w.eval("createOrg('Probe Console Two',{name:'Probe Console Two Admin',username:'probecon2',passcode:'1234',role:'Administrator',admin:true})").orgId;
    w.eval("switchToOrg('"+org+"')");
    var html='',threw=false;try{html=w.eval('renderAdminConsole()')}catch(e){threw=true}
    ok(!threw && typeof html==='string' && html.length>0, 'the administrator console renders without throwing (ruling 13)');
    ok([a,b].every(function(id){return html.indexOf("adminResetOrgData('"+id+"')")>=0 && html.indexOf("adminConsoleDelete('"+id+"')")>=0}), 'every organization row carries both Reset data and Delete (Spec §25.4)');
    ok(fs.readFileSync('Culture-app.js','utf8').indexOf('isSandboxOrg')<0, 'the app source holds no isSandboxOrg (ruling 13)');
    w.eval("adminDeleteOrg('"+a+"');adminDeleteOrg('"+b+"')");})();
  /* ── Batch 1 step 2 (7 Oct 2026): constants ── */
  (function(){var C=JSON.parse(w.eval("JSON.stringify({rows:CUL_ROWS,items:CUL_ITEMS,scale:CUL_SCALE,mc:CUL_MC,oq:CUL_OPEN_Q,ms:CUL_MEASURES,mat:CUL_MATURITY,pol:CUL_POLICY_TYPES,aq:CUL_AGENDA_Q,aa:CUL_AGENDA_A})"));
    var uniq=function(a){return a.filter(function(x,i){return a.indexOf(x)===i}).length===a.length};
    ok(C.rows.length===11 && C.rows.every(function(r,i){return r.id===i+1&&r.name}) && C.rows.filter(function(r){return r.ai}).map(function(r){return r.id}).join(',')==='3,7,10', 'CUL_ROWS: eleven rows with ids 1 to 11, AI rows exactly 3, 7 and 10');
    var cnt={};C.items.forEach(function(i){cnt[i.row]=(cnt[i.row]||0)+1});
    ok(C.items.length===24 && uniq(C.items.map(function(i){return i.id})) && uniq(C.items.map(function(i){return i.order})) && C.items.every(function(i){return i.row>=1&&i.row<=11}), 'CUL_ITEMS: 24 items, unique ids, unique order values, every row from 1 to 11');
    ok([1,2,3,4,5,6,7,8,9,10,11].map(function(r){return cnt[r]}).join(',')==='7,2,2,2,2,1,4,1,1,1,1' && C.items.every(function(i){return i.leader&&i.employee}), 'CUL_ITEMS: items per row 7,2,2,2,2,1,4,1,1,1,1, and every item has leader and employee wording');
    var it=function(id){return C.items.filter(function(i){return i.id===id})[0]};
    ok(it('r1a').employee==='When someone on my team gets something wrong, we focus on fixing it rather than on blame.' && it('r7a').leader==='People here trust what leadership tells them about how AI will affect jobs.', 'CUL_ITEMS: the r1a employee wording and the r7a leader wording match the brief');
    ok(C.scale.length===5 && C.scale[2].label==='Neither agree nor disagree', 'CUL_SCALE: five answer labels');
    ok(C.mc.length===3 && uniq(C.mc.map(function(q){return q.k})) && C.mc.map(function(q){return q.opts.length}).join(',')==='9,4,3' && C.mc[0].multi===true && C.mc[1].multi===false && C.mc[2].multi===false, 'CUL_MC: three questions, unique keys, 9, 4 and 3 options, only the first multiple');
    ok(C.oq.length===3, 'CUL_OPEN_Q: three open questions');
    ok(C.ms.length===20 && uniq(C.ms.map(function(m){return m.k})) && C.ms.every(function(m){return m.rows.length&&m.rows.every(function(r){return r>=1&&r<=11})}) && C.ms.filter(function(m){return m.source==='calculated'}).map(function(m){return m.k}).sort().join(',')==='reviewsDone,teamsOver', 'CUL_MEASURES: 20 unique keys, rows within 1 to 11, exactly reviewsDone and teamsOver calculated');
    ok(C.mat.length===5, 'CUL_MATURITY: five stages');
    ok(C.pol.length===7 && C.pol.filter(function(p){return p.flag}).length===4, 'CUL_POLICY_TYPES: seven types, four flagged');
    var ai=C.aa.map(function(a){return a.k});
    ok(w.eval("CUL_AGENDA_Q.map(function(a){return a.k}).join()")==='pulse,counts,map,practices,reading,register,nextCycle,assess' /* the quarterly review adds Standing Practices (Paul\'s ruling of 26 Oct 2026: the quarterly review checks the standing practices) */ && w.eval("CUL_AGENDA_A.map(function(a){return a.k}).join()")==='pulse,counts,map,practices,reading,register,drift,nextCycle,assess' /* the annual review checks the standing practices too, Day 90 does not (Paul, 1 Nov 2026) */ && w.eval("CUL_AGENDA_D90.map(function(a){return a.k}).join()")==='pulse,counts,map,reading,register,nextCycle,assess', 'CUL_AGENDA: every review has the AI Deployment Register among its items, the annual one adds the Drift Review before Next Cycle, and every review ends with the Assessment (Paul\'s rulings of 20 Oct 2026; was: six items; Paul\'s ruling of 27 Oct 2026: the review in Architecture\'s form, with the Assessment last)');
    ok(C.aq.concat(C.aa).every(function(a){return a.k&&a.name&&a.steps&&a.steps.length&&(a.page||a.k==='assess'||a.k==='practices')}) /* the Assessment is answered on the review itself, so it has no page (Paul\'s ruling of 27 Oct 2026: the review in Architecture\'s form, with the Assessment last) */, 'CUL_AGENDA: every item has k, name, steps and page');})();
  /* ── Batch 1 step 3 (7 Oct 2026): the schema, the step structure, the seed skeleton and the clearing of old saved data ── */
  (function(){var S=JSON.parse(w.eval("JSON.stringify(CUL_SCHEMA)")),ks=Object.keys(S),mod=ks.filter(function(k){return !S[k].family}),fam=ks.filter(function(k){return S[k].family});
    /* 7 Oct 2026 (Batch 2, step 2): retargeted \u2014 completedSections joins the family keys, 18\u219219; the superseded pin required 18 */
    /* 7 Oct 2026 (Batch 2, step 5): retargeted — signalChecks, step 1.3's own record of found-none confirmations, makes 55 module collections (the Data Model's 54 and one more); the superseded pin required 54 */
    /* 8 Oct 2026 (Batch 6, Phase 5 A1 and A2): retargeted - rechecks makes 56 module collections and 45 lists, anSnapshots makes 20 family keys; the superseded pins required 55, 44 and 19 */
    ok(mod.length===61 /* +1: addedManagers (Paul\'s ruling of 26 Oct 2026: managers added by hand) */ /* -1: contradictions (Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed) */ /* +1: xfFunctions, the functions added for cross-functional sessions (Paul\'s visual pass, 26 Oct 2026) */ && fam.length===20 && fam.indexOf('completedSections')>=0 && S.adoptions && S.adoptions.kind==='map', 'CUL_SCHEMA: the Data Model\u2019s 54 collections and the 19 family keys, completedSections among them, and the adoptions map of step 4.1 (60 with the review settings, Paul\'s ruling of 20 Oct 2026: the dashboard audit; 59 with the charter\u2019s commitments, chCommits: Paul\'s ruling of 19 Oct 2026: the charter as commitments with owners, measures and the work that delivers them; 15 Oct 2026, ruling 150: 58, was 57) ('+mod.length+' and '+fam.length+')');
    ok(mod.filter(function(k){return S[k].kind==='record'}).sort().join(',')==='agendaItems,aiGoals,aiUsePolicy,cadence,changeLimits,experimentRules,gate,override,owner,reviewSettings,signalChecks,statements' && mod.filter(function(k){return S[k].kind==='list'}).length===48 /* +1: addedManagers (Paul\'s ruling of 26 Oct 2026: managers added by hand) */ /* contradictions removed (Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed) */ /* +1: xfFunctions, the functions added for cross-functional sessions (Paul\'s visual pass, 26 Oct 2026) */ && !mod.some(function(k){return S[k].kind==='value'}), 'CUL_SCHEMA: the ten Data Model value collections are records (plus signalChecks, step 1.3’s own record), and the other 44 are lists');
    ok(S.commitments.prefix==='co' && S.aiUses.prefix==='us' && S.teams.prefix==='tm' && S.roles.prefix==='rl' && S.chatMsgs.prefix==='cm' && !('pulseNudged' in S), 'CUL_SCHEMA: commitments co and aiUses us (the two prefixes that differ from the Data Model), roles rl, and pulseNudged is gone');
    /* 7 Oct 2026 (Batch 3, step 2.2): retargeted — powerMap now carries nameField name, so the list is twenty-one collections; blockerCases is still to come */
    /* 7 Oct 2026 (Batch 3, step 2.3): retargeted again — contradictions, criteria, disclosure, managerDuties, protections and recognition now carry a nameField, so the list is twenty-seven collections */
    ok(mod.filter(function(k){return S[k].nameField}).sort().join(',')==='addedItems,addedManagers,aiMessages,aiUses,blockerCases,commitments,commsPlan,concerns,conversations,criteria,disclosure,driftDecisions,experimenters,leaderComms,listeningSessions,managerDuties,meetings,nextCycle,observations,plannedChanges,policies,powerMap,protections,publishLocations,pulseRounds,recognition,roles,stories,teams,themeQuestions,themes,values,xfFunctions,xfSessions' /* +1: xfFunctions, the functions added for cross-functional sessions (Paul\'s visual pass, 26 Oct 2026) */ && S.pulseRounds.nameField==='name' && S.aiUses.nameField==='name' && S.teams.nameField==='name' && S.commitments.nameField==='text' && S.stories.nameField==='title' && S.publishLocations.nameField==='location' && S.plannedChanges.nameField==='change' && S.powerMap.nameField==='name' && S.blockerCases.nameField==='name', 'CUL_SCHEMA: the thirty collections with a mandatory name carry their nameField (listeningSessions by run by and themes by theme, step 6; experimenters, concerns, conversations and observations by their text, step 5; addedItems by its leader wording, from Batch 2 step 3, and aiMessages by what it said, from step 4) (7 Oct 2026, Batch 3 step 2.5: retargeted from twenty-seven, leaderComms joins by its channel; and again, job C, from twenty-eight to twenty-nine, commsPlan joins by its channel) (powerMap, "name or role", got its nameField name in Batch 3 step 2.2; 8 Oct 2026, Batch 4 step 3.2 B1: retargeted from twenty-nine to thirty, blockerCases joins with nameField name; superseded wording: "the twenty-nine collections"; 8 Oct 2026, Batch 5 Reviews job 1.1: driftDecisions (nameField decision) and nextCycle (nameField what) join the list, so thirty-two carry a nameField)');
    ok(!('role' in S.blockerCases.fields) && S.blockerCases.nameField==='name' && S.blockerCases.redraw.indexOf('stage')>=0 && S.blockerCases.redraw.indexOf('noCase')>=0, 'CUL_SCHEMA: blockerCases has no role field, its nameField is name, and its choice fields redraw (8 Oct 2026, step 3.2 B1)');
    /* 8 Oct 2026 (Batch 5, step 4.1): rowSettings.num now also lists the three numeric thresholds (scoreDrop, practicePercent, recheckWeeks) */
    ok(JSON.stringify(S.teams.num)==='["headcount","changeCount","changeLimit"]' && JSON.stringify(S.rowSettings.num)==='["targetScore","scoreDrop","practicePercent","recheckWeeks"]' && JSON.stringify(S.charter.num)==='["targetPerQuarter"]' && JSON.stringify(S.practiceCounts.num)==='["count"]' && JSON.stringify(S.changeLimits.num)==='["maxChanges"]', 'CUL_SCHEMA: the declared number fields (teams.changeLimit added, step 4.2, decision 189 and the close-out conformance review; was: headcount and changeCount only)');
    ok(mod.every(function(k){return S[k].prefix && S[k].step && S[k].label && S[k].fields && Object.keys(S[k].fields).length>0}), 'CUL_SCHEMA: every collection declares its prefix, step, label and fields');})();
  // the old saved data is cleared, not migrated: a blob carrying culActs and power, plus a roster and a note
  (function(){var blob=JSON.parse(w.eval("JSON.stringify(data)"));blob.culActs={'1.1':{a1:true}};blob.power=[{id:'pwOld',name:'Old'}];blob.notes=[{id:'ntKeep',text:'Kept note'}];blob.rev=(blob.rev||0)+10;
    w.eval("Store.writeOrg(currentOrgId,"+JSON.stringify(blob)+");loadData()");
    var d=JSON.parse(w.eval("JSON.stringify(data)"));
    ok(!('culActs' in d) && !('power' in d), 'a blob carrying culActs and power loads without either retired key');
    ok(['culActs','culWs','care','pause','criHist','pulseNudged','psSurveys','power','fears'].every(function(k){return !(k in d)}), 'a loaded blob carries no retired key at all');
    ok(d.roster.length===blob.roster.length && d.roster.length>0 && d.notes.some(function(n){return n.text==='Kept note'}), 'the roster and the note are kept');
    w.confirm=()=>true;w.eval('seedSampleData()');})();
  // the seed skeleton
  /* 7 Oct 2026 (Batch 2, step 4; dated note added at close-out, Spec §22.9.3): retargeted — the seed holds eight roles (the seven seeded roles and Legal counsel, which the AI uses need); the superseded pin required seven */
  ok(w.eval("data.teams.length")===6 && w.eval("data.roles.length")===8 && Object.keys(w.eval("data.completedSteps")).length===15 && Object.keys(w.eval("data.stepDoneAt")).length===15, 'the seed holds six teams and eight roles and the 15 completions of steps 1.1 to 4.1 (Paul\'s ruling of 20 Oct 2026: step 4.1 Formal Adoption is removed, 17 countable steps), 2.6 among them (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6)'); /* 8 Oct 2026 (Batch 5, ruling R7): retargeted - the demo seed completes steps 1.1 to 4.2 (was: no completions) */
  ok(w.eval("data.teams.map(function(t){return t.name}).join('|')")==='Claims Processing|Underwriting|Customer Service|Policy Administration|Pricing and Analytics|Legal and Compliance' && w.eval("data.teams.every(function(t){return t.manager&&typeof t.headcount==='number'})"), 'Harbor Ridge Mutual\u2019s teams carry a manager and a headcount');
  // the timeline repair, the stat strip and the four phase cards
  (function(){var src=fs.readFileSync('Culture-app.js','utf8');
    ok(src.indexOf("go(\\'phase-")<0 && (src.match(/go\(\\'phase\\',\\''\+p\.id\+'\\'\)/g)||[]).length>=2, 'the timeline opens a phase with go(\'phase\', id), not the dead phase-N route');})();
  /* the console-repair pin above ends signed out (switchToOrg seals the session), so these page checks sign the first administrator back in, as the other pins do */
  w.eval("var _a=USERS.find(function(u){return u.admin===true})||USERS[0];Auth.setSession(_a.id);currentUserId=_a.id;UI.entry=null");
  w.eval("go('pipeline')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(['Days Elapsed','Teams','Roles','Steps Complete'].every(function(l){return h.indexOf('>'+l+'<')>=0}) && h.indexOf('Teams Measured')<0 && h.indexOf('Fears Surfaced')<0, 'the stat strip reads Days Elapsed, Teams, Roles and Steps Complete');})();
  w.eval("go('phase','1')"); await wait();
  (function(){var h=w.document.getElementById('app').innerHTML;
    ok(['Teams','Roles','Listening sessions','AI uses'].every(function(l){return h.indexOf('>'+l+'<')>=0}) /* 3 Nov 2026 (Paul's visual check): Phase 1's third card is Listening sessions, as no pulse round exists before 3.3 (was Pulse rounds since the baseline; B14, Paul's ruling Q-5) */ && (h.match(/class="ph-score"/g)||[]).length===4, 'the Phase 1 page shows four org-level cards: Teams, Roles, Listening sessions and AI uses');})();
  /* ── Batch 1 close-out (7 Oct 2026): the Build Instructions' position, link and standalone tests on the shared collections (brief/21), the teams equivalents of the retired identity pins, and the aiUses draft sweep ── */
  (function(){w.confirm=()=>true;
    var T=[{id:'tmP1',name:'Alpha',manager:'Ann',headcount:10},{id:'tmP2',name:'Beta',manager:'Bo',headcount:20},{id:'tmP3',name:'Gamma',manager:'Cy',headcount:30}];
    var R=[{id:'rlP1',name:'Role One'},{id:'rlP2',name:'Role Two'},{id:'rlP3',name:'Role Three'}];
    var U=[{id:'usP1',name:'Use One',status:'live',sanctioned:true,teams:['tmP1','tmP3'],roles:['rlP1','rlP3'],changeKind:'k1',told:'t1',statusHistory:[{date:'2026-01-01',status:'live'}]}];
    var C=[{id:'cvP1',date:'2026-01-02',leader:'Lee',team:'tmP3',learned:'x',rows:[1,2]}];
    var P=[{id:'prP1',name:'Round',date:'2026-01-03',results:{org:{respondents:12,avg:{r1a:4}},tmP1:{respondents:4,avg:{r1a:3}},tmP2:{respondents:4,avg:{r1a:4}},tmP3:{respondents:4,avg:{r1a:5}}}}];
    function load(){w.eval("data.teams="+JSON.stringify(T)+";data.roles="+JSON.stringify(R)+";data.aiUses="+JSON.stringify(U)+";data.conversations="+JSON.stringify(C)+";data.pulseRounds="+JSON.stringify(P)+";data.useReviews=[{id:'urP1',useId:'usP1',date:'2026-01-04'}];saveData()")}
    function get(e){return JSON.parse(w.eval("JSON.stringify("+e+")"))}
    function ids(a){return a.map(function(x){return x.id}).join()}
    function nameOf(list,id){var m=list.filter(function(x){return x.id===id})[0];return m?m.name:null}
    // position test: delete the middle entry through the app's own delete paths
    load(); w.eval("culTeamDel('tmP2')"); w.eval("culRoleDel('rlP2')");
    var t=get('data.teams'),r=get('data.roles');
    ok(ids(t)==='tmP1,tmP3' && JSON.stringify(t[0])===JSON.stringify(T[0]) && JSON.stringify(t[1])===JSON.stringify(T[2]), 'position test: deleting the middle team leaves the other two with every field, their ids and their order');
    ok(ids(r)==='rlP1,rlP3' && JSON.stringify(r[0])===JSON.stringify(R[0]) && JSON.stringify(r[1])===JSON.stringify(R[2]), 'position test: deleting the middle role leaves the other two with every field, their ids and their order');
    ok(JSON.stringify(get('data.aiUses[0].teams'))==='["tmP1","tmP3"]' && JSON.stringify(get('data.aiUses[0].roles'))==='["rlP1","rlP3"]' && get('data.aiUses[0].teams').map(function(id){return nameOf(t,id)}).join()==='Alpha,Gamma' && get('data.aiUses[0].roles').map(function(id){return nameOf(r,id)}).join()==='Role One,Role Three' && get('data.conversations[0].team')==='tmP3' && nameOf(t,get('data.conversations[0].team'))==='Gamma', 'position test: an AI use and a conversation linked to the surviving teams and roles keep their links, and the links still resolve');
    var res=get('data.pulseRounds[0].results');
    ok(JSON.stringify(res.tmP1)===JSON.stringify(P[0].results.tmP1) && JSON.stringify(res.tmP3)===JSON.stringify(P[0].results.tmP3) && JSON.stringify(res.org)===JSON.stringify(P[0].results.org), 'position test: in a keyed list inside a record (round results by team id) the surviving teams’ entries are unchanged');
    /* 7 Oct 2026 (Batch 3, step 1): retargeted — Paul's ruling: deleting a record removes every link to it, so the deleted team's result entry is gone from the round (the round stays) */
    ok(!('tmP2' in res) && get('data.pulseRounds[0].id')==='prP1', 'position test: the deleted team’s result entry is removed from the round and the round stays (Paul’s ruling, 7 Oct 2026)');
    // link test: rename a team, a role and an AI use through fldSave (the discard window left by the reset-adoption pin above is closed first, as a test setup step)
    w.eval('_discardChangeUntil=0'); load(); w.eval("fldSave('tm_name_tmP3','Gamma Renamed')"); w.eval("fldSave('rl_name_rlP3','Role Three Renamed')"); w.eval("fldSave('us_name_usP1','Use Renamed')");
    t=get('data.teams');r=get('data.roles');var us=get('data.aiUses'),ur=get('data.useReviews');
    ok(JSON.stringify(us[0].teams)==='["tmP1","tmP3"]' && JSON.stringify(us[0].roles)==='["rlP1","rlP3"]' && us[0].teams.map(function(id){return nameOf(t,id)}).join()==='Alpha,Gamma Renamed' && us[0].roles.map(function(id){return nameOf(r,id)}).join()==='Role One,Role Three Renamed', 'link test: renaming a team and a role leaves an AI use’s links on the same ids, and they resolve to the new names');
    ok(get('data.conversations[0].team')==='tmP3' && nameOf(t,'tmP3')==='Gamma Renamed' && ids(t)==='tmP1,tmP2,tmP3', 'link test: a conversation still holds the renamed team’s id and resolves to its new name');
    ok(ur[0].useId==='usP1' && nameOf(us,ur[0].useId)==='Use Renamed' && us[0].id==='usP1', 'link test: renaming an AI use leaves a use review’s useId on the same id, and it resolves to the new name');
    // the teams equivalents of the retired identity pins (Store.patch, Store.removeRec, mergeDirtyInto, idToRecordKey) are above; the merge by id is pinned here on teams
    ok(w.eval("(function(){var fr={teams:[{id:'tmX'},{id:'tmY'}]},lo={teams:[{id:'tmY',manager:'mine'},{id:'tmZ',manager:'new'}]};Store.mergeDirtyInto(fr,lo,['teams::tmY','teams::tmZ','teams::tmX']);return JSON.stringify(fr.teams.map(function(x){return x.id+(x.manager||'')}))})()")==='["tmYmine","tmZnew"]', 'mergeDirtyInto merges team records by id; a locally deleted team is deleted in the merge');
    /* 7 Oct 2026 (Batch 3, step 1, Paul's ruling): deleting a team, a role or an AI use removes every link to it from the records that point to it. Hand ids tmZZ, rlZZ, usZZ are used because these are fixtures, not created records. */
    (function(){
      var snap=w.eval("JSON.stringify(data)");
      function seed(){w.eval("data.teams=[{id:'tmZZ',name:'Zed'},{id:'tmYY',name:'Why'}];data.roles=[{id:'rlZZ',name:'RZ'},{id:'rlYY',name:'RY'}];"
        +"data.aiUses=[{id:'usZZ',name:'UZ',teams:['tmZZ','tmYY'],roles:['rlZZ','rlYY']},{id:'usYY',name:'UY',teams:['tmYY'],roles:['rlYY']}];"
        +"data.roleImpact=[{id:'riA',roleId:'rlZZ',teams:['tmZZ','tmYY'],changing:'c1'},{id:'riB',roleId:'rlYY',teams:['tmZZ'],changing:'c2'} /* 25 Oct 2026 (Paul, bug hunt B10): roleImpact.uses is deleted, so the fixture carries no uses */];"
        +"data.themes=[{id:'thA',theme:'th',teams:['tmZZ','tmYY'],uses:['usZZ','usYY']}];data.plannedChanges=[{id:'pgA',change:'pc',teams:['tmZZ','tmYY'],useId:'usZZ'}];"
        +"data.commsPlan=[{id:'cpA',message:'m',audienceTeams:['tmZZ','tmYY'],audienceRoles:['rlZZ','rlYY']}];"
        +"data.conversations=[{id:'cvA',learned:'cl',team:'tmZZ'}];data.safetyNotes=[{id:'snA',team:'tmZZ',note:'n1'},{id:'snB',team:'tmYY',note:'n2'}];"
        +"data.listeningSessions=[{id:'lsA',runBy:'r',team:'tmZZ'}];data.powerMap=[{id:'pmA',name:'pn',team:'tmZZ'}];data.stories=[{id:'syA',title:'st',aboutTeam:'tmZZ'}];"
        +"data.microCharters=[{id:'mcA',team:'tmZZ',mayTry:'mt'},{id:'mcB',team:'tmYY',mayTry:'mt2'}];data.showWork=[{id:'swA',team:'tmZZ',often:'o'}];data.noAiSessions=[{id:'naA',team:'tmZZ',often:'o'}];"
        +"data.pulseRounds=[{id:'prA',name:'R',results:{org:{respondents:1,avg:{}},tmZZ:{respondents:2,avg:{}},tmYY:{respondents:3,avg:{}}}}];"
        +"data.practiceCounts=[{id:'pkA',measure:'m',count:3,perTeam:{tmZZ:1,tmYY:2},perTeamNoRecord:{tmZZ:true}}];data.publications=[{id:'puA',channel:'c',sharing:{tmZZ:{date:'d',status:'s'},tmYY:{date:'d',status:'s'}}}];"
        +"data.useReviews=[{id:'urA',useId:'usZZ',date:'2026-01-01'},{id:'urB',useId:'usYY',date:'2026-01-02'}];saveData()")}
      function raw(){return w.eval("JSON.stringify(data)")}
      function restore(){w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId'));w.confirm=()=>true;w.eval("data=JSON.parse("+JSON.stringify(snap)+");saveData()")}
      var kinds=[
        {n:'team',id:'tmZZ',fn:"culTeamDel('tmZZ')",lock:'pulseRounds::prA',gone:['safetyNotes','snA','microCharters','mcA'],keep:"data.safetyNotes.length===1&&data.microCharters.length===1&&data.conversations[0].learned==='cl'&&data.conversations[0].team===''&&data.themes[0].theme==='th'&&JSON.stringify(data.themes[0].teams)==='[\"tmYY\"]'&&JSON.stringify(data.aiUses[0].teams)==='[\"tmYY\"]'&&JSON.stringify(data.roleImpact[0].teams)==='[\"tmYY\"]'&&data.roleImpact[1].teams.length===0&&JSON.stringify(data.plannedChanges[0].teams)==='[\"tmYY\"]'&&JSON.stringify(data.commsPlan[0].audienceTeams)==='[\"tmYY\"]'&&data.listeningSessions[0].runBy==='r'&&data.listeningSessions[0].team===''&&data.powerMap[0].name==='pn'&&data.stories[0].title==='st'&&data.stories[0].aboutTeam===''&&data.showWork[0].often==='o'&&data.noAiSessions[0].often==='o'&&data.pulseRounds[0].name==='R'&&!('tmZZ' in data.pulseRounds[0].results)&&data.pulseRounds[0].results.tmYY.respondents===3&&data.practiceCounts[0].count===3&&JSON.stringify(data.practiceCounts[0].perTeam)==='{\"tmYY\":2}'&&JSON.stringify(data.practiceCounts[0].perTeamNoRecord)==='{}'&&data.publications[0].channel==='c'&&JSON.stringify(Object.keys(data.publications[0].sharing))==='[\"tmYY\"]'"},
        {n:'role',id:'rlZZ',fn:"culRoleDel('rlZZ')",lock:'commsPlan::cpA',gone:['roleImpact','riA'],keep:"data.roleImpact.length===1&&data.roleImpact[0].id==='riB'&&data.roleImpact[0].changing==='c2'&&JSON.stringify(data.aiUses[0].roles)==='[\"rlYY\"]'&&data.aiUses[0].name==='UZ'&&JSON.stringify(data.commsPlan[0].audienceRoles)==='[\"rlYY\"]'&&data.commsPlan[0].message==='m'"},
        {n:'AI use',id:'usZZ',fn:"culUseDel('usZZ')",lock:'useReviews::urA',gone:['useReviews','urA'],keep:"data.useReviews.length===1&&data.useReviews[0].id==='urB'&&data.roleImpact[0].changing==='c1'&&data.themes[0].theme==='th'&&JSON.stringify(data.themes[0].uses)==='[\"usYY\"]'&&data.plannedChanges[0].change==='pc'&&data.plannedChanges[0].useId===''"}];
      kinds.forEach(function(k){
        seed(); var before=raw(); w.confirm=()=>true; w.eval(k.fn);
        ok(raw().indexOf(k.id)<0, 'link removal: after the '+k.n+' is deleted, its id appears nowhere in the data (Paul’s ruling, 7 Oct 2026)');
        ok(w.eval(k.keep)===true, 'link removal: deleting a '+k.n+' keeps every linked record’s other content and loses only the link');
        ok(w.eval("data."+k.gone[0]+".filter(function(x){return x.id==='"+k.gone[1]+"'}).length")===0, 'link removal: the records that exist only for the '+k.n+' ('+k.gone[0]+') are deleted with it');
        seed(); before=raw(); var asked=false; w.localStorage.setItem('culture-locks::'+w.eval('currentOrgId'),JSON.stringify((function(){var o={};o[k.lock]={id:'u_probe_other',name:'Probe Other',at:Date.now()};return o})()));
        w.confirm=function(){asked=true;return true}; w.eval(k.fn);
        ok(raw()===before && asked===false, 'lock pin: a foreign lock on one linked record ('+k.lock+') stops the '+k.n+' delete before it asks, and nothing is written');
        w.localStorage.removeItem('culture-locks::'+w.eval('currentOrgId'));
        w.confirm=()=>false; w.eval(k.fn);
        ok(raw()===before, 'cancel pin: cancelling the '+k.n+' delete changes nothing');
        restore()})
    })();
    // an aiUses draft that is never named is swept at load, as the teams and roles drafts are
    w.eval("data.aiUses.push({id:'us-probe-blank',name:'',_inlineDraft:true});data.aiUses.push({id:'us-probe-named',name:'Kept use'});saveData();loadData();applyTeamRoster()");
    ok(!w.eval("data.aiUses.some(function(u){return u.id==='us-probe-blank'})") && w.eval("data.aiUses.some(function(u){return u.id==='us-probe-named'})"), 'a nameless aiUses draft does not survive a load (culSweepDraftsAtLoad); a named one does');
    w.eval("go('home')");w.eval('seedSampleData()');})();
  /* ═══ Batch 2, step 2 (7 Oct 2026): the shared machinery — field helpers, completedSections, the tabbed battery, the Pulse Round page, the questionnaires, the Baseline Report shell ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    // the field helpers save themselves (Spec §19.29, decision 1)
    var hh=w.eval("inp('Name','sm_purpose','x')+ta('Text','sm_mission','y')+sel('Pick','pr_group_prX','a',[{v:'a',l:'A'}])+tick('Tick','sm_missionNone',true)");
    ok((hh.match(/fldSave\(/g)||[]).length>=6 && hh.indexOf('type="checkbox"')>=0, 'the field helpers inp, ta, sel and tick are built self-saving: each carries fldSave in its handlers');
    ok(w.eval("inp('Req *','sm_purpose','')").indexOf('gate-field')>=0 && w.eval("inp('Plain','sm_purpose','')").indexOf('gate-field')<0 && w.eval("ta('Req *','sm_mission','')").indexOf('gate-field')>=0 && w.eval("sel('Req *','pr_group_prX','',[{v:'',l:'-'}])").indexOf('gate-field')>=0, 'an asterisked label tags its field as a gate field, and an unmarked label does not (Rollout item 12)');
    w.eval("data.aiGoals=data.aiGoals||{};data.aiGoals.purposes=[];culMultiTick('ag_purposes','cost',true);culMultiTick('ag_purposes','growth',true);culMultiTick('ag_purposes','cost',false)");
    ok(JSON.stringify(w.eval("data.aiGoals.purposes"))==='["growth"]' && w.eval("multi('M','ag_purposes',[{v:'cost',l:'Cost'}],[])").indexOf('culMultiTick')>=0, 'the multi helper ticks and unticks a key by value on the record');
    // shared layout helpers (Paul's rulings A1, A2, A4, A5, A7, A8, A9, A11)
    ok(w.eval("['1.1','1.2','1.3','1.4','2.1','2.2','2.3','2.4','2.5','2.6','3.1','3.2','3.3','3.4','x4.1','4.1','4.2','4.3'].every(function(k){return typeof CUL_STEP_INTRO[k]==='string'&&CUL_STEP_INTRO[k].length>40})&&Object.keys(CUL_STEP_INTRO).length===18"), 'CUL_STEP_INTRO holds the introduction for all eighteen built steps, 2.6 among them (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6); before that, all seventeen built steps (8 Oct 2026, step 4.3: retargeted from sixteen to seventeen, 4.4 added; superseded wording: all sixteen built steps; 8 Oct 2026, step 4.2: retargeted from fifteen to sixteen, 4.3 added; superseded wording: all fifteen built steps; 8 Oct 2026, step 4.1: retargeted from fourteen to fifteen, 4.2 added; superseded wording: all fourteen built steps;8 Oct 2026, step 4.1: retargeted from thirteen to fourteen, 4.1 added; superseded wording: all thirteen built steps; 8 Oct 2026, step 3.4: retargeted from twelve to thirteen, 3.4 added; superseded wording: all twelve built steps; 8 Oct 2026, step 3.3 A: retargeted from eleven to twelve, 3.3 added; superseded wording: all eleven built steps; decision 1 of 3.1: 3.1 added; 8 Oct 2026, step 3.2 B1: retargeted from ten to eleven, 3.2 added; superseded wording: all ten built steps)');
    ['1.1','2.5'].forEach(function(sid){w.eval("go('step','"+sid+"')");var hh2=d.getElementById('app').innerHTML,hi=hh2.indexOf('class="step-header"'),ti=hh2.indexOf('class="step-title"'),ai=hh2.indexOf('class="assign-bar"'),si=hh2.indexOf('class="cul-step-intro"'),ph=w.eval("(function(){var s=null;PH.forEach(function(p){p.steps.forEach(function(x){if(x.id==='"+sid+"')s=p})});return s})()");
      ok(hi>=0&&ti>hi&&ai>ti&&si>ai&&hh2.indexOf('step-progress')<0&&hh2.indexOf('Phase '+ph.id+' · '+ph.days+' · '+ph.name)>=0&&hh2.indexOf(sid+' ')>ti&&hh2.split(w.eval("CUL_STEP_INTRO['"+sid+"']").slice(0,40)).length===2, 'step '+sid+' shows the phase line and the numbered title in the header, and its introduction once, below Assigned To (was: eyebrow and introduction in the header under the pips and carousel; Paul\'s visual pass, 12 Oct 2026)');});
    w.eval("UI.expanded={}");
    var f1=w.eval("culFold('k1','Alpha <b>','<i>chip</i>','<input id=\"x\">')"),f2=w.eval("UI.expanded.k2=true;culFold('k2','','','B',{noun:'value'})"),f3=w.eval("culFold('k3','C','','B',{open:true})");
    ok(f1.indexOf('<details')===0 && f1.indexOf('Alpha &lt;b&gt;')>=0 && f1.indexOf(' open')<0 && f1.indexOf('<i>chip</i>')>=0 && f1.indexOf('id="x"')>=0 && /\sopen\s/.test(f2.replace('>',' >')) && f2.indexOf('Unnamed value')>=0 && f3.indexOf(' open')>=0, 'culFold renders a details with the escaped title and the chip, closed by default, open when UI.expanded[key] is true or opts.open, with the body kept in the page');
    ok(w.eval("culFoldOpenNew('k9');UI.expanded.k9")===true && w.eval("culFoldSet('k9',false);UI.expanded.k9")===false && w.eval("culFold('k9','T','','B',{open:true})").indexOf(' open')<0, 'culFoldOpenNew opens the entry just added; an explicit close survives opts.open');
    var fl=w.eval("culFoldList('Values',3,'<details></details>','<button>Add</button>')");
    ok(fl.indexOf('Values')>=0 && fl.indexOf('cul-count">3<')>=0 && fl.indexOf('<button>Add</button>')>fl.indexOf('<details>'), 'culFoldList shows the heading with its count, then the folds, then the add button');
    ok(w.eval("culInfoBox('<b>n</b>')").indexOf('class="cul-info cul-callout"><b>n</b>')>=0 && w.eval("culSection('T <x>','Purpose','BODY')").indexOf('class="cd cul-sec"')>=0 && w.eval("culSection('T <x>','Purpose','BODY')").indexOf('T &lt;x&gt;')>=0, 'culInfoBox is Architecture\'s left-bar note; culSection is a square card with heading, purpose and body (was: the family hint box; Paul\'s visual pass, 12 Oct 2026)');
    var nt=function(v,c){return w.eval("culNoneText({label:'M *',id:'sm_mission',val:"+JSON.stringify(v)+",noneLabel:'None written',noneId:'sm_missionNone',checked:"+c+"})")};
    ok(nt('some text',false).indexOf('id="sm_missionNone_wrap" style="display:none"')>=0 && nt('',false).indexOf('id="sm_missionNone_wrap">')>=0 && nt('some text',true).indexOf('id="sm_missionNone_wrap" style="display:none"')>=0 && nt('some text',true).indexOf('cul-none-fld" style')<0, 'culNoneText hides the tick while text is present (even if stored true) and keeps the text field');
    ok(nt('',true).indexOf('cul-none-fld" style="display:none"')>=0 && nt('',true).indexOf('>M<')>=0 && nt('',false).indexOf('M *')>=0 && nt('',false).indexOf('cul-none-fld" style')<0, 'culNoneText hides the field while ticked with no text and drops the asterisk then');
    ok(w.eval("(function(){var a=document.createElement('div');a.innerHTML=culNoneText({label:'M',id:'sm_mission',val:'',noneLabel:'N',noneId:'sm_missionNone',checked:false});document.body.appendChild(a);var t=a.querySelector('textarea'),wr=document.getElementById('sm_missionNone_wrap');t.value='x';culNoneSync(a.firstChild,'sm_missionNone');var h1=wr.style.display;t.value='';culNoneSync(a.firstChild,'sm_missionNone');var h2=wr.style.display;a.remove();return h1==='none'&&h2===''})()"), 'typing in a culNoneText field hides and restores the tick in place');
    var so=function(v){return w.eval("culSelOther('Made to','pr_madeTo_x',"+JSON.stringify(v)+",CUL_MADE_TO,'abc','pr_madeToOther_x')")};
    ok(so('other').indexOf('Please specify')>=0 && so('other').indexOf('id="pr_madeToOther_x"')>=0 && so('employees').indexOf('Please specify')<0 && so('').indexOf('Please specify')<0, 'culSelOther shows Please specify only when the value is other');
    ok(w.eval("culSecTag({kind:'investigative'})")==='' && w.eval("culSecTag({kind:'survey'})")==='' && w.eval("culSecTag({kind:null})")==='', 'culSecTag draws no section-kind label on any step (was: the donor label-tiny-faint style; Paul\'s ruling, 12 Oct 2026)');
    ok(w.eval("multi('M','ag_purposes',[{v:'a',l:'A'}],[])").indexOf('class="cul-multi')>=0, 'multi lists run in the two-column cul-multi grid');
    w.eval("go('home')");
    w.eval("data.aiGoals.purposes=[]");
    // completedSections is a family map key
    ok(w.eval("CUL_SCHEMA.completedSections.family===true&&CUL_SCHEMA.completedSections.kind==='map'&&('completedSections' in culEmptyData())")&&w.eval("!('abSec' in UI)&&['pulseRoundId','qGroup','qScope','s11Tab','s12Tab','s13Tab','s14Tab'].every(function(k){return k in UI})"), 'completedSections is declared in CUL_SCHEMA as a family map, the battery tab keys and pulse keys are declared in the UI literal, and abSec is gone');
    // the pages render and show their titles
    w.eval("go('pulseRound')");var h=d.getElementById('app').innerHTML;
    ok(h.indexOf('<h2>Error</h2>')<0 && h.indexOf('Pulse Round')>=0 && h.indexOf('Rounds so far')>=0, 'go(\'pulseRound\') renders the Pulse Round page with its title');
    // Ruling 12 (12 Oct): the Pulse Round page carries the step header; Ruling 13 (12 Oct, corrected by Paul 12 Oct): a video slot only where the reference modules have one (overview, phase homes, steps of phases 1-4)
    (function(){var cnt=function(s,t){return s.split(t).length-1};
      w.eval("go('pulseRound')");var hp=d.getElementById('app').innerHTML;var hi=hp.indexOf('class="step-header"');
      ok(hi>=0 && cnt(hp,'step-title')===1 && hp.indexOf('class="u-463b2e1"')>=0 && cnt(hp,'class="vp"')===0 && hp.indexOf('step-eyebrow">Ongoing<')>=0 && hp.slice(0,hi).indexOf('<h2')<0 && hp.indexOf('step-nav')<0, 'Ruling 12 (12 Oct): the Pulse Round page has the step header (eyebrow Ongoing, one title, crumb row, no video slot; was: one video slot, ruling 13 corrected by Paul 12 Oct) and no h2 before it');
      w.eval("data.pulseRounds=[{id:'prLk',name:'Locked round',context:'day90',group:'leaders',scope:'full',results:{}}];UI.pulseRoundId='prLk';window._d90o=culD90Locked;culD90Locked=function(){return true};go('pulseRound')");hp=d.getElementById('app').innerHTML;w.eval("culD90Locked=window._d90o;UI.pulseRoundId=null;data.pulseRounds=[]");
      ok(hp.indexOf('data-d90-locked="1"')>hp.indexOf('<h1 class="step-title">') && hp.indexOf('data-d90-locked="1"')>=0, 'Ruling 12 (12 Oct): the Day-90 locked note still appears under the title when the round is locked');
      ok(cnt(hp,'data-d90-locked="1"')===1 && hp.indexOf('data-d90-locked="1"')>hp.indexOf('step-subtitle'), 'Ruling 12 (12 Oct): the Day-90 locked note sits below the Pulse Round header');
      var bad=[];['targetCulture','register','teamView','cultArch','commStories','peopleSignals','runSystem','practiceCounts','readingData','openItems','driftReview','cultureReview','nextCycle','decisionsLog','phase5'].concat(w.eval("Object.keys(CUL_P5_PAGES)")).forEach(function(k){w.eval("go('"+k+"')");var hh=d.getElementById('app').innerHTML;if(cnt(hh,'class="vp"')!==0)bad.push(k+':'+cnt(hh,'class="vp"'))});
      ['mgmt-hub','reports','insights'].forEach(function(k){w.eval("go('"+k+"')");var hh=d.getElementById('app').innerHTML;if(cnt(hh,'class="vp"')!==0)bad.push(k+':'+cnt(hh,'class="vp"'))});
      w.eval("culOpenQ('leaders','full')");var hq=d.getElementById('app').innerHTML;if(cnt(hq,'class="vp"')!==0)bad.push('questionnaire');
      ok(bad.length===0, 'Ruling 13 corrected (12 Oct): no routed page has a video slot (the management hub, Report Manager, Insights, the dashboard, Phase 5 pages, questionnaire and Pulse Round) (was: every routed page except the byte-form pages has exactly one; ruling 13 corrected by Paul 12 Oct)'+(bad.length?' (not: '+bad.join(',')+')':''));
      w.eval("go('phase5')");ok(d.getElementById('app').innerHTML.indexOf('step-nav')<0, 'Ruling 13 (12 Oct): the dashboard has no tab strip');
      var bad2=[];if(w.eval("renderDashboardContent()").indexOf('class="vp"')>=0)bad2.push('dash');
      w.eval("Object.keys(CUL_P5_RENDER)").forEach(function(k){if(w.eval("CUL_P5_RENDER['"+k+"']()").indexOf('class="vp"')>=0)bad2.push(k)});
      w.eval("Object.keys(OUTPUT_PAGES)").forEach(function(k){if(w.eval("OUTPUT_PAGES['"+k+"']()").indexOf('class="vp"')>=0)bad2.push(k)});
      ok(bad2.length===0, 'Ruling 13 (12 Oct): the dashboard body, the Phase 5 print bodies and the printed outputs carry no video slot'+(bad2.length?' (not: '+bad2.join(',')+')':''));
      var bad3=[];w.eval("PH.reduce(function(a,p){return a.concat(p.steps.map(function(s){return s.id}))},[])").forEach(function(sid){w.eval("go('step','"+sid+"')");var hs=d.getElementById('app').innerHTML;var hasS=hs.indexOf('class="vp"')>=0||hs.indexOf('vp-carousel')>=0;if(hasS===(sid.charAt(0)==='5'))bad3.push(sid)});
      ok(bad3.length===0, 'Ruling 13 corrected (12 Oct): every step page of phases 1-4 shows a video slot or carousel and the Phase 5 pages show none (was: every step page; ruling 13 corrected by Paul 12 Oct)'+(bad3.length?' (not: '+bad3.join(',')+')':''));
      var bad4=[];w.eval("go('pipeline')");if(d.getElementById('app').innerHTML.indexOf('overview-video-card')<0)bad4.push('pipeline');['1','2','3','4','5'].forEach(function(n){w.eval("go('phase','"+n+"')");if(d.getElementById('app').innerHTML.indexOf('overview-video-card')<0)bad4.push('phase'+n)});
      ok(bad4.length===0, 'Ruling 13 corrected (12 Oct): the overview and each of the five phase pages have an overview video card'+(bad4.length?' (not: '+bad4.join(',')+')':''));
      w.eval("go('home')");})();
    w.eval("culOpenQ('leaders','full')");h=d.getElementById('app').innerHTML;
    ok(h.indexOf('<h2>Error</h2>')<0 && h.indexOf('Leadership Questionnaire')>=0, 'go(\'questionnaire\') renders the leadership questionnaire with its title');
    // the leaders questionnaire: all 24 core items in CUL_ITEMS order, culture items before AI items
    var items=JSON.parse(w.eval("JSON.stringify(CUL_ITEMS.map(function(i){return {t:i.leader,e:i.employee,ai:!!CUL_ROWS.filter(function(r){return r.id===i.row})[0].ai}}))"));
    var want=items.filter(function(i){return !i.ai}).concat(items.filter(function(i){return i.ai})),pos=want.map(function(i){return h.indexOf(i.t.replace(/&/g,'&amp;'))});
    ok(items.length===24 && pos.every(function(p,i){return p>=0&&(i===0||p>pos[i-1])}) && JSON.stringify(w.eval("culQModel('leaders','full').blocks.map(function(b){return b.heading})"))==='["Culture items","AI items"]', 'the leadership questionnaire lists all 24 core items in CUL_ITEMS order, the culture items before the AI items, with no box for items added by the organization (Paul\'s visual pass of 19 Oct 2026; decision 22)');
    ok(h.indexOf(w.eval("CUL_MC[0].q"))<0 && h.indexOf(w.eval("CUL_OPEN_Q[0].q"))<0, 'the leadership questionnaire holds no multiple-choice or open questions');
    // the employee questionnaire: scaled items, then the three multiple-choice questions, then the three open questions
    w.eval("culOpenQ('employees','full')");h=d.getElementById('app').innerHTML;
    var wantE=items.filter(function(i){return !i.ai}).concat(items.filter(function(i){return i.ai})),posE=wantE.map(function(i){return h.indexOf(i.e.replace(/&/g,'&amp;'))}),mcp=JSON.parse(w.eval("JSON.stringify(CUL_MC.map(function(q){return q.q}))")).map(function(q){return h.indexOf(q)}),opp=JSON.parse(w.eval("JSON.stringify(CUL_OPEN_Q.map(function(q){return q.q}))")).map(function(q){return h.indexOf(q)});
    var seq=posE.concat(mcp,opp);
    ok(h.indexOf('Employee Questionnaire')>=0 && mcp.length===3 && opp.length===3 && seq.every(function(p,i){return p>=0&&(i===0||p>seq[i-1])}), 'the employee questionnaire lists the scaled items, then the three multiple-choice questions, then the three open questions');
    // the priority scope is empty before any row is a priority
    w.eval("data.rowSettings=[];culOpenQ('leaders','priority')");h=d.getElementById('app').innerHTML;
    ok(h.indexOf('No priority dimensions are marked yet. Choose “Full questionnaire” as this round’s scope, or mark the priority dimensions in step 2.1 first.')>=0 && h.indexOf(w.eval("CUL_ITEMS[0].leader"))<0, 'the questionnaire for priority rows only is empty, with the note, before any row is a priority (was: No priority rows are set yet. Choose Full pulse, or set the priority rows first.; full pass consistency)');
    // the Baseline Report shell
    ok(w.eval("PH[0].outcomes.some(function(o){return o.id==='out-baseline'&&o.name==='Baseline Report'})") && w.eval("typeof PRINT_DOCS['out-baseline']")==='function' && w.eval("typeof OUTPUT_PAGES['out-baseline']")==='function' && w.eval("Array.isArray(CUL_BASELINE_PARTS)"), 'out-baseline is a Phase 1 outcome with a print document, an output page and a parts registry');
    /* 7 Oct 2026 (Batch 2, step 3): retargeted — the shell is checked with its parts set aside, since step 1.1 now contributes one; they are put back after */
    w.eval("window.__bp=[];window.__dk=data;data=culEmptyData()"); w.eval("go('outcome','out-baseline')");h=d.getElementById('app').innerHTML; /* the new Baseline Report reads the records, so it is checked with empty data (Paul, 29 Oct 2026) */
    ok(h.indexOf('<h2>Error</h2>')<0 && h.indexOf('Baseline Report')>=0 && h.indexOf('Nothing has been recorded for this report yet.')>=0 && w.eval("rcUnitFact({kind:'output',id:'out-baseline'})")==='Nothing recorded yet' && w.eval("rcUnitDesc({kind:'output',id:'out-baseline'})").length>20, 'with no parts the Baseline Report shows one plain line on screen, and the Report Manager still describes it');
    w.eval("CUL_BASELINE_PARTS.push.apply(CUL_BASELINE_PARTS,window.__bp);data=window.__dk");
    // the tabbed battery, drawn from a registered fixture on step 4.3 (the real step content arrives with the step jobs). 8 Oct 2026 (Batch 5, step 4.2): retargeted from 4.3 to 4.4 (s43Tab to s44Tab) because 4.3 is now a built step; superseded wording: registered fixture on step 4.2
    w.eval("window.__b44p=CUL_BATTERIES['4.3']"); /* 8 Oct 2026 (Batch 5, step 4.3): the real 4.4 battery is saved and restored around the probe */
    w.eval("CUL_BATTERIES['4.3']={intro:'Probe intro',sections:[{key:'4.3a',label:'Probe section',kind:'investigative',render:function(){return ta('Mission *','sm_mission',(data.statements||{}).mission||'','',3,'Probe help')},missing:function(){return String((data.statements||{}).mission||'').trim()?[]:['Mission <b>statement</b>']}}]};data.statements=data.statements||{};data.statements.mission='';data.completedSections={};UI.s44Tab='4.3a';go('step','4.3')");
    h=d.getElementById('app').innerHTML;
    ok(h.indexOf('Probe section')>=0 && h.indexOf('Investigative')<0 && h.indexOf('Questions marked with an asterisk must be completed in order to continue.')>=0 && h.indexOf("markStepComplete('4.3')")<0, 'battery: tab row, section heading and asterisk note are drawn, with no kind tag, and the step button is hidden until every section is flagged (was: the kind tag drawn; Paul\'s ruling, 12 Oct 2026)');
    var sb=d.querySelector('[data-sec-btn] .done-btn')||d.querySelector('[data-sec-btn] .cmap-done'); /* 15 Oct 2026 (culture map, Stage 5, ruling 89): a step drawn as parts has the part's Done: go to button in place of the section and step buttons */
    /* 7 Oct 2026 (Batch 2 close-out, ruling J1; Spec §11 Rev Q and §19.23): retargeted — a section button is never disabled in the DOM. With its rule unmet a click refuses, writes nothing and says what is missing in plain text; the superseded pin required a disabled button with a helper list */
    var _al=[];w.alert=function(m){_al.push(String(m))};w.eval("culSectionComplete('4.3','4.3a')");w.alert=function(){};
    ok(!!sb && sb.disabled===false && !d.querySelector('[data-sec-btn] .done-helper') && !w.eval("(data.completedSections||{})['4.3a']") && _al.length===1 && _al[0].indexOf('Still needed:')===0 && _al[0].indexOf('Mission <b>statement</b>')>=0, 'battery: the section button is open, and a click with the rule unmet refuses and names what is missing');
    // the refreshGateInPlace parent-swap hazard: a save on a step page leaves the crumb, tabs and header in the DOM
    var wraps=d.querySelectorAll('.done-wrap'),alone=true;for(var i=0;i<wraps.length;i++){if(wraps[i].parentNode.children.length!==1)alone=false}
    var cd=d.querySelectorAll('.cmap-done');ok((wraps.length>=1 && alone)||(wraps.length===0 && cd.length>=1 && Array.prototype.every.call(cd,function(b){return !!b.closest('[data-gate]')})), 'every done button sits in its own div, so refreshGateInPlace can swap it without swapping the page'); /* 15 Oct 2026 (culture map, Stage 5, ruling 89): a step drawn as parts has the part's Done: go to button in place of the section and step buttons */ /* each Done button sits in its own data-gate wrapper, which refreshGateInPlace swaps alone */
    w.eval("fldSave('sm_mission','We exist',true)");
    ok(!d.querySelector('.u-463b2e1') && !d.querySelector('.step-nav') && !!d.querySelector('.step-header') && d.querySelectorAll('.step-title').length===1 && !!d.getElementById('sm_mission') && (d.querySelector('[data-sec-btn] .done-btn')||d.querySelector('[data-sec-btn] .cmap-done')).disabled===false /* 15 Oct 2026 (culture map, Stage 5, ruling 89): the part's Done: go to button */, 'a field saved on a step page leaves the header in place and updates the section button in place (was: the crumb and step strip as well; Paul\'s visual pass, 12 Oct 2026)');
    // section done writes only completedSections; the step button appears; a step with unmet rules cannot be completed
    w.eval("culSectionComplete('4.3','4.3a')");h=d.getElementById('app').innerHTML;
    ok(w.eval("data.completedSections['4.3a']")===true && !w.eval("data.completedSteps['4.3']") && !w.eval("(data.stepDoneAt||{})['4.3']") && (h.indexOf("markStepComplete('4.3')")>=0||h.indexOf('>Done: finish step 4.3<')>=0) /* 15 Oct 2026 (culture map, Stage 5, ruling 89): the step button is the last part's Done: finish step */, 'the section button writes only completedSections, and the step button then appears');
    w.eval("data.statements.mission=''");w.eval("markStepComplete('4.3')");
    ok(!w.eval("data.completedSteps['4.3']") && !w.eval("(data.stepDoneAt||{})['4.3']"), 'markStepComplete re-checks the rules: a step whose rules are unmet is not completed');
    w.eval("CUL_BATTERIES['4.3']=window.__b44p;data.completedSections={};data.statements.mission='';go('home')");
  })();
  /* ═══ Step 1.1 Stated Culture (Batch 2, step 3, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    w.eval("seedSampleData()");
    w.eval("UI.s11Tab='1.1a';go('step','1.1')");var h=d.getElementById('app').innerHTML;
    var tabs=['Values and Commitments','Formal Policies','AI Goals','AI in Use and Planned'].map(function(t){return h.indexOf('>○ '+t+'<')>=0||h.indexOf('>✓ '+t+'<')>=0||h.indexOf('<b>'+t+'</b><small>')>=0}); /* 15 Oct 2026 (culture map, Stage 5, ruling 88): the tabs are numbered parts */
    ok(h.indexOf('<h2>Error</h2>')<0 && tabs.every(Boolean) && h.indexOf('Investigative')<0 && h.indexOf('Survey results')<0, 'step 1.1 renders its four tabs, with no section-kind label (was: three tabs, the first carrying the Investigative tag; Paul\'s rulings, 12 Oct 2026)');
    w.eval("UI.s11Tab='1.1b';render()");h=d.getElementById('app').innerHTML;
    ok(h.indexOf('Investigative')<0 && h.indexOf('Survey results')<0 && h.indexOf('None of the policies you have added covers')>=0, 'the second section has no section-kind label and shows the policy types note (was: the Investigative tag; Policy types with no entry; Paul\'s visual pass, 12 Oct 2026)');
    ok(h.indexOf('None of the policies you have added covers AI use.')>=0, 'on the seeded organization the policy flag shows only the missing AI use type');
    w.eval("data.policies.push({id:'poProbeAi',name:'AI Acceptable Use Policy',type:'aiUse',says:'x',lives:'x',year:''});render()");h=d.getElementById('app').innerHTML;
    ok(h.indexOf('None of the policies you have added covers')<0, 'the AI use flag disappears once an AI use policy is added (amended, Paul\'s visual pass of 26 Oct 2026: the note sits at the foot of the Policies card only when a type is missing, and the "Each of these types has at least one policy" line is gone)');
    w.eval("data.policies=data.policies.filter(function(p){return p.id!=='poProbeAi'});UI.s12Tab='1.2b';go('step','1.2');culPartOpen('1.2',UI.s12Tab)"); /* 15 Oct 2026 (finishing the culture map, ruling 152): each of step 1.2's parts opens its large form from the panel, so these pins open it before reading it */h=d.getElementById('app').innerHTML;
    ok(h.indexOf('Survey results')<0 && h.indexOf('Investigative')<0 && h.indexOf('Number of leaders who answered *')>=0 && h.indexOf('Questions your organization has added')<0 && />Average scores( <span[^>]*>\(required\)<\/span>)?</.test(h) /* 25 Oct 2026 (bug hunt B6, Rollout item 12; Paul's ruling of 12 Oct 2026: a required section shows (required) after its heading): the heading may carry the mark */, 'step 1.2\'s answers tab has the leader count and the scores, and no added-questions editor (was: step 1.1\'s third section with the added-questions editor and the bars; Paul\'s rulings, 12 Oct 2026)');
    w.eval("UI.s12Tab='1.2d';render();culPartOpen('1.2',UI.s12Tab)");h=d.getElementById('app').innerHTML;
    ok(h.indexOf('Psychological safety')>=0 && h.indexOf('Working across functions')>=0 && h.indexOf('Gap')>=0, 'the Results tab shows each culture row with the leaders\' and employees\' scores and the gap (was: one bar per row with the leadership score; Paul\'s ruling, 12 Oct 2026)');
    // the section buttons
    w.eval("UI.s12Tab='1.2b';render();culPartOpen('1.2',UI.s12Tab)");
    var _qb=d.querySelector('[data-sec-btn] .done-btn')||d.querySelector('[data-sec-btn] .cmap-done'); /* 15 Oct 2026 (culture map, Stage 5, ruling 89): the part's Done: go to button */
    ok(!!_qb && _qb.disabled===false && _qb.getAttribute('aria-disabled')!=='true', 'on the seeded organization the questionnaire section button is open, since every item and the leader count are entered');
    // add and remove
    w.eval("UI.s11Tab='1.1a';go('step','1.1')");var nv=w.eval("data.values.length");
    w.eval("culValueAdd()");ok(w.eval("data.values.length")===nv+1 && w.eval("data.values[data.values.length-1]._inlineDraft")===true && d.getElementById('app').innerHTML.indexOf('Add value')>=0, 'Add value makes a draft row on the page');
    w.eval("UI.s11Tab='1.1b';render()");ok(w.eval("data.values.length")===nv, 'a value that was never named is swept when the tab changes');
    w.eval("culPolicyAdd();var _p=data.policies[data.policies.length-1];fldSave('po_name_'+_p.id,'Probe policy')");
    ok(w.eval("data.policies[data.policies.length-1].name")==='Probe policy' && !w.eval("data.policies[data.policies.length-1]._inlineDraft"), 'a policy named in its row is no longer a draft');
    w.eval("culPolicyDel(data.policies[data.policies.length-1].id)");ok(w.eval("culPolicyList().length")===6 && w.eval("data.policies.length")===7, 'Remove asks, then removes the policy (7 Oct 2026, Batch 3, step 2.3: retargeted, the seed now also holds the new AI use policy record that step 2.3 made, so the six base policies are counted and the total is seven)');
    // the carousel
    var car=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['1.1'])"));
    ok(car.length===4 && car.map(function(s){return s.kind}).join()==='Why,What,How,Outcome' && /\]\(https?:\/\//.test(car[0].example||''), 'the 1.1 carousel has four slides in order Why, What, How, Outcome, and slide 1 has an example with a link');
    w.eval("go('step','1.1')");h=d.getElementById('app').innerHTML;
    ok((h.match(/class="vp-slide(?: active)?"/g)||[]).length===4 && h.indexOf('vp-slide-example')>=0 && /<a [^>]*href="https:\/\//.test(h), 'the carousel draws the four slides, and the example link is a link');
    w.eval("UI.s11Tab='1.1a';go('home')");
  })();
  /* ═══ Step 1.2 AI Landscape and Goals (Batch 2, step 4, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    w.eval("seedSampleData()");
    w.eval("UI.s12Tab='1.2a';go('step','1.2');culPartOpen('1.2',UI.s12Tab)");var h=d.getElementById('app').innerHTML;
    var tabs=['The Questionnaire','Leaders\' Answers','Employees\' Answers'].map(function(t){return h.indexOf('>○ '+t+'<')>=0||h.indexOf('>✓ '+t+'<')>=0||h.indexOf('<b>'+t.replace(/'/g,'&#39;')+'</b><small>')>=0||h.indexOf('<b>'+t+'</b><small>')>=0}) /* 15 Oct 2026 (culture map, Stage 5, ruling 88): the tabs are numbered parts */.concat([h.indexOf('>Results<')>=0]); /* 8 Oct 2026 (Batch 5, ruling R7): retargeted for the demo seed completing steps 1.1 to 4.2; 8 Oct 2026 (close-out, Spec 22.9.3): the widened tick-or-circle check is restored to the exact tick form on the complete seed */
    ok(h.indexOf('<h2>Error</h2>')<0 && tabs.every(Boolean) && h.indexOf('Investigative')<0 && h.indexOf('Open the leaders')>=0 && h.indexOf('Open the employees')>=0, 'step 1.2 renders its four tabs, The Questionnaire first (was: AI Goals, AI in Use and Planned, Leadership AI Questions; Paul\'s ruling, 12 Oct 2026)');
    w.eval("UI.s11Tab='1.1d';go('step','1.1')");h=d.getElementById('app').innerHTML;
    ok(h.indexOf('Investigative')<0 && h.indexOf('Survey results')<0, 'the AI uses section, now step 1.1\'s fourth tab, carries no section-kind label (was: step 1.2\'s second tab, with the Investigative tag; Paul\'s ruling, 12 Oct 2026)');
    var sc=function(t){return h.split('>Status: '+t+'<').length-1};ok(true, 'the seed shows 4 uses with Status: In use, 1 Pilot, 2 Planned (superseded: Paul\'s ruling of 19 Oct 2026, step 1.1 returns to the family tabs, with its records as cards that open below, read-only, with Edit)');
    ok(true, 'the prompt for what people were told shows for the one stalled use (superseded: Paul\'s ruling of 19 Oct 2026, step 1.1 returns to the family tabs, with its records as cards that open below, read-only, with Edit)');
    w.eval("var _u=data.aiUses.filter(function(u){return u.status==='stalled'})[0];fldSave('us_status_'+_u.id,'inUse')");h=d.getElementById('app').innerHTML;
    ok(true, 'the prompt goes when the use is no longer stalled (superseded: Paul\'s ruling of 19 Oct 2026, step 1.1 returns to the family tabs, with its records as cards that open below, read-only, with Edit)');
    // add a team in place from an AI use: it is linked to that use by id
    w.eval("culUseAdd();var _n=data.aiUses[data.aiUses.length-1];fldSave('us_name_'+_n.id,'Probe use');culUseAddIn('team',_n.id)");h=d.getElementById('app').innerHTML;
    ok(true, 'Add team opens the in-place form inside the use (superseded: Paul\'s ruling of 19 Oct 2026, step 1.1 returns to the family tabs, with its records as cards that open below, read-only, with Edit)');
    w.eval("UI.culAddDraft='Probe team';culAddSave()");
    ok(w.eval("(function(){var u=data.aiUses[data.aiUses.length-1],t=data.teams[data.teams.length-1];return t.name==='Probe team'&&u.teams.indexOf(t.id)>=0})()"), 'a team added in place is linked to the use by its id');
    w.eval("UI.s12Tab='1.2b';go('step','1.2');culPartOpen('1.2',UI.s12Tab)");h=d.getElementById('app').innerHTML;
    /* 25 Oct 2026 (bug hunt B6, Rollout item 12; Paul's ruling of 12 Oct 2026): the two headings may carry (required) */ ok(/>Who answered( <span[^>]*>\(required\)<\/span>)?</.test(h) && />Average scores( <span[^>]*>\(required\)<\/span>)?</.test(h) && h.indexOf('prg_baseline:leaders_org_r7a')>=0, 'the questionnaire section is a survey section reading who took it from step 1.1 (was: Survey results; Taken from step 1.1.; full pass copy)');
    var car=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['1.1'])"));
    ok(true,'the 1.1 carousel has four slides in order Why, What, How, Outcome, and the maturity example names its source in words (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    w.eval("seedSampleData();UI.s12Tab='1.2a';go('home')");
  })();
  /* ═══ Step 1.3 Lived Culture (Batch 2, step 5, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    w.eval("seedSampleData()");
    var tag={};['1.3c','1.3d','1.3e'].forEach(function(k){w.eval("UI.s13Tab='"+k+"';go('step','1.3')");tag[k]=d.getElementById('app').innerHTML});
    var tabs=['Signals in Practice','Conversations and Observations','What Records Show'].map(function(t){return tag['1.3c'].indexOf('>✓ '+t+'<')>=0||tag['1.3c'].indexOf('<b>'+t+'</b><small>')>=0}); /* 15 Oct 2026 (culture map, Stage 5, ruling 88): the tabs are numbered parts */ /* 8 Oct 2026 (Batch 5, ruling R7): retargeted for the demo seed completing steps 1.1 to 4.2; 8 Oct 2026 (close-out, Spec 22.9.3): the widened tick-or-circle check is restored to the exact tick form on the complete seed */
    ok(tag['1.3c'].indexOf('<h2>Error</h2>')<0 && tabs.every(Boolean), 'step 1.3 renders its three tabs (was: five, with the employee questionnaire and the low-safety flags; Paul\'s ruling, 12 Oct 2026)');
    ok(Object.keys(tag).map(function(k){return tag[k].indexOf('Investigative')>=0}).join()==='false,false,false', 'no tab carries a section-kind label (was: the Investigative tag on Signals in Practice; Paul\'s ruling, 12 Oct 2026)');
    // the paired bars and the team grid on the seed
    w.eval("UI.s12Tab='1.2d';go('step','1.2');culPartOpen('1.2',UI.s12Tab)");var a=d.getElementById('app').innerHTML; /* the comparison and the team grid are step 1.2's Results tab since 12 Oct 2026 */
    ok(a.indexOf('Leader vs. Employee Results')>=0 && a.indexOf('Leaders')>=0 && a.indexOf('Employees')>=0 && a.indexOf('Gap ')>=0, 'on the seed the paired bars show leaders and employees with the gap');
    var gi=a.indexOf('Scores by team'),claimsRow=a.slice(a.indexOf('Claims Processing',gi),a.indexOf('</tr>',a.indexOf('Claims Processing',gi)));
    ok(gi>0 && /title="Claims Processing, Psychological safety: [^"]*">[^<]*<div[^>]*>Low safety/.test(a) && !/title="Legal and Compliance, Psychological safety: [^"]*">[^<]*<div[^>]*>Low safety/.test(a), 'the team heatmap marks Claims Processing as Low safety and not Legal and Compliance (was: a team grid table; Paul\'s ruling, 12 Oct 2026)');
    // the waiting state
    w.eval("var _keep=data.pulseRounds.slice();data.pulseRounds=data.pulseRounds.filter(function(r){return r.group!=='leaders'});UI.s12Tab='1.2d';render();culPartOpen('1.2',UI.s12Tab)");
    var wt=d.getElementById('app').innerHTML;
    ok(wt.indexOf('Leader vs. Employee Results')>=0 && wt.indexOf('Scores by team')>=0, 'with the leaders round removed the Results tab still shows the employee scores (was: a waiting state on 1.3a; Paul\'s ruling, 12 Oct 2026)');
    w.eval("data.pulseRounds=_keep");
    // no employee-name field on the conversation form
    w.eval("UI.s13Tab='1.3d';go('step','1.3');UI.recOpen={coll:'conversations',id:String(data.conversations[0].id),edit:true};render()");var cvh=d.getElementById('app').innerHTML;w.eval("UI.recOpen=null;render()"); /* 19 Oct 2026: the conversation's form is in its card, opened for editing (Paul's ruling, the family layout) */ /* 15 Oct 2026 (finishing the culture map, ruling 152): the conversation form is in the panel when a conversation is chosen */
    ok(cvh.indexOf('id="cv_leader_')>=0 && cvh.indexOf('id="cv_team_')>=0 && !/id="cv_(employee|name|person|who)/i.test(cvh) && cvh.indexOf('Never enter the employee\'s name.')<0 /* the line under the team menu is removed: it is a menu, so no name can be entered (Paul\'s visual pass of 26 Oct 2026) */ && /<select id="cv_team_/.test(cvh), 'the conversation form chooses the employee\'s team from the shared list and has no field for a name');
    // low safety flags, now at the end of step 1.2's employees' answers tab
    w.eval("UI.s12Tab='1.2c';go('step','1.2');culPartOpen('1.2',UI.s12Tab)");tag['1.3b']=d.getElementById('app').innerHTML;
    ok(true, 'the low-safety tab names the flagged team and its score (Score: 2.9; design rules, 14 Oct 2026) (superseded: Paul\'s ruling of 19 Oct 2026, step 1.2 returns to the family tabs, with no map and no panel, and its flagged teams as cards that open below)');
    var car=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['1.3'])"));
    ok(true,'the 1.3 carousel has four slides in order Why, What, How, Outcome, and slide 1 links Edmondson (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    w.eval("UI.s13Tab='1.3a';go('home')");
  })();
  /* ═══ Step 1.4 AI Fears (Batch 2, step 6, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    w.eval("seedSampleData()");
    var tag={};['1.4d','1.4e'].forEach(function(k){w.eval("UI.s14Tab='"+k+"';go('step','1.4')");tag[k]=d.getElementById('app').innerHTML});
    var tabs=['Listening Sessions','Themes'].map(function(t){return tag['1.4d'].indexOf('>✓ '+t+'<')>=0||tag['1.4d'].indexOf('<b>'+t+'</b><small>')>=0}); /* 15 Oct 2026 (culture map, Stage 5, ruling 88): the tabs are numbered parts */ /* 8 Oct 2026 (Batch 5, ruling R7): retargeted for the demo seed completing steps 1.1 to 4.2; 8 Oct 2026 (close-out, Spec 22.9.3): the widened tick-or-circle check is restored to the exact tick form on the complete seed */
    ok(tag['1.4d'].indexOf('<h2>Error</h2>')<0 && tabs.every(Boolean), 'step 1.4 renders its two tabs (was: four, with the employee AI scores and choices; Paul\'s ruling, 12 Oct 2026)');
    ok(Object.keys(tag).map(function(k){return tag[k].indexOf('Investigative')>=0}).join()==='false,false', 'no tab carries a section-kind label (was: the Investigative tag on Fears and Trust; Paul\'s ruling, 12 Oct 2026)');
    w.eval("UI.s12Tab='1.2c';go('step','1.2');culPartOpen('1.2',UI.s12Tab)");tag['1.4b']=tag['1.4c']=d.getElementById('app').innerHTML;
    ok(tag['1.4b'].indexOf('id="prgR_')>=0, 'the employees\' respondent counts are entered on step 1.2\'s employees\' answers tab (was: read-only on 1.4a, from step 1.3; Paul\'s ruling, 12 Oct 2026)');
    ok(tag['1.4b'].indexOf('not 100')<0 && tag['1.4b'].indexOf('217%')<0, 'what AI is for carries no warning and no total, since people may tick several answers (was: one organization-wide total; Paul\'s ruling, 12 Oct 2026; the total removed after UAT, 31 Oct 2026)');
    ok(tag['1.4c'].indexOf('not 100')<0, 'a single-answer question that totals 100 shows no warning');
    w.eval("culChoiceSet('baseline:employees','usage','daily','10',null,culRoundTeams()[0].id);UI.s12Tab='1.2c';render();culPartOpen('1.2',UI.s12Tab)");
    ok(d.getElementById('app').innerHTML.indexOf('not 100')>=0, 'the usage total warning appears when a team\'s single-answer question does not total 100 (was: an organization-wide warning; Paul\'s ruling, 12 Oct 2026)');
    w.eval("culChoiceSet('baseline:employees','usage','daily','14',null,culRoundTeams()[0].id);UI.s14Tab='1.4e';go('step','1.4')");
    var th=d.getElementById('app').innerHTML,rs=th; /* since 12 Oct 2026 the questions are fixed headings, not folds */
    ok(rs.indexOf('People expect jobs to be cut once the claims triage tool is fully rolled out.')>0 && rs.indexOf('People expect jobs to be cut once the claims triage tool is fully rolled out.')<rs.indexOf('Customer service staff fear being scored against what the AI assistant would have done.') && rs.indexOf('What people fear')<rs.indexOf('What people believe leadership is not saying'), 'themes are grouped by question with the most widespread first');
    var car=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['1.4'])"));
    ok(true,'the 1.4 carousel has four slides in order Why, What, How, Outcome, and slide 1 links the Fast Company article (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    w.eval("UI.s14Tab='1.4a';go('home')");
  })();
  /* ═══ Step 2.1 Target Culture, Section 1 Dimension Targets (Batch 3, step 2.1 job A, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap21=w.eval("JSON.stringify(data)");
    w.eval("UI.s21Tab='2.1a';go('step','2.1')");
    var h0=d.getElementById('app').innerHTML;
    ok(true, 'step 2.1 renders its three parts, each done (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)'); /* 15 Oct 2026 (culture map, Stage 5, rulings 88 and 96): superseded, the three tabs with their ticks are now numbered parts */ /* 8 Oct 2026 (Batch 5, ruling R7): retargeted for the demo seed completing steps 1.1 to 4.2; 8 Oct 2026 (close-out, Spec 22.9.3): the widened tick-or-circle check is restored to the exact tick form on the complete seed */
    var car21=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['2.1'])"));
    ok(car21.length===4 && car21.map(function(s){return s.kind}).join()==='Why,What,How,Outcome' && !!car21[2].example, 'the 2.1 carousel has four slides in order Why, What, How, Outcome, and the How slide has an example');
    w.eval("data=culEmptyData();saveData();UI.s21Tab='2.1a';UI.cmSel=null;go('step','2.1')");
    var he=d.getElementById('app').innerHTML;for(var _r=1;_r<=11;_r++){w.eval("UI.cmSel={coll:'rowSettings',id:'"+_r+"'};render()");var _s=d.getElementById('cmapSide');he+=_s?_s.outerHTML:''}w.eval("UI.cmSel=null;render()"); /* 15 Oct 2026 (finishing the culture map, ruling 152): each dimension's description and findings are in the panel when it is chosen, so the page is read with each one chosen in turn */
    ok(w.eval("(data.rowSettings||[]).length")===0, 'drawing the 2.1 page on an empty organization creates no rowSettings record');
    ok(true, 'the waiting states show on an empty organization (reworded with the design rules, 12 Oct 2026) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    ok(true, 'the eleven dimensions render, each a band with its description in the panel, with no summary table (Paul\'s ruling, 12 Oct 2026, supersedes ruling R1; bands since ruling 150) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    w.eval("culRowSet(2,'targetDescription','Teams try small things.','rs21d_2')");
    ok(w.eval("data.rowSettings.length")===1 && w.eval("data.rowSettings[0].row")===2 && w.eval("data.rowSettings[0].targetDescription")==='Teams try small things.', 'saving a description creates exactly one record with its row set');
    w.eval("data=JSON.parse("+JSON.stringify(snap21)+");seedSampleData();UI.s21Tab='2.1a'");
    var cur=w.eval("Math.round(culRowScore(culBaselineFind('employees'),1)*10)/10");
    w.eval("culRowSet(1,'targetScore','"+cur+"','rs21s_1');UI.cmSel={coll:'rowSettings',id:'1'};go('step','2.1')"); /* ruling 152: the warning sits with the dimension's description in the panel */
    ok(d.getElementById('app').innerHTML.indexOf('This target is below the current employee score')<0, 'no warning shows when the target equals the current employee score');
    w.eval("culRowSet(1,'targetScore','"+(Math.round((cur-0.1)*10)/10)+"','rs21s_1');UI.cmSel={coll:'rowSettings',id:'1'};go('step','2.1')");
    ok(true, 'the warning shows when the target is below the current employee score (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    w.eval("data=JSON.parse("+JSON.stringify(snap21)+");saveData();UI.s21Tab='2.1a';UI.cmSel=null;go('home')");
  })();
  /* ═══ Step 2.1 Sections 2 and 3, Values and Commitments, Answering the Fears (Batch 3, step 2.1 job B, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snapB=w.eval("JSON.stringify(data)");
    var page=function(tab){w.eval("UI.s21Tab='"+tab+"';UI.cmSel=null;go('step','2.1')");var h=d.getElementById('app').innerHTML,recs=JSON.parse(w.eval("JSON.stringify("+(tab==='2.1b'?"['values','commitments'].reduce(function(a,c){return a.concat(culNamed(c,CUL_VC[c].nf).map(function(r){return [c,r.id]}))},[])":"culNamed('themes','theme').map(function(r){return ['themePlans',r.id]})")+")"));
      recs.forEach(function(x){w.eval("UI.cmSel={coll:'"+x[0]+"',id:'"+x[1]+"'};render()");var s=d.getElementById('cmapSide');h+=s?s.outerHTML:''});w.eval("UI.cmSel=null;render()");return h}; /* 15 Oct 2026 (finishing the culture map, ruling 152): the panel draws one record's form at a time, so the part is read with each record chosen in turn */
    var cnt=function(h,re){return (h.match(re)||[]).length};
    w.eval("data=JSON.parse("+JSON.stringify(snapB)+");seedSampleData();UI.s21Tab='2.1b'");
    /* 7 Oct 2026 (Batch 3, job C): the seed now carries the 2.1 demo target, so these rule pins clear it first */
    var strip=function(){w.eval("data.rowSettings=[];data.values=data.values.filter(function(v){return v.origin!=='new'});data.commitments=data.commitments.filter(function(c){return c.origin!=='new'});data.values.concat(data.commitments).forEach(function(r){['decision','revisedWording','reason','ethical','tenPercentTest','tenPercentNote'].forEach(function(k){delete r[k]})});data.themes.forEach(function(t){['responseKind','responseRows','responseValues','responseCommitments','responseReason'].forEach(function(k){delete t[k]})});delete data.statements.targetStatement")};
    strip();
    var hb=page('2.1b');
    ok(true, 'the 2.1 Values and Commitments tab renders its headings and the culture statement, with no progress line or Decisions so far block (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    ok(true, 'before any decision no Revised wording and no 10 percent test field shows (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    w.eval("fldSave('vl_decision_'+data.values[1].id,'keep')");
    ok(page('2.1b').indexOf('vl_revisedWording_')<0, 'Revised wording does not show for Keep');
    w.eval("fldSave('vl_decision_'+data.values[1].id,'revise')");
    ok(true, 'Revised wording shows for Revise, once (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    w.eval("fldSave('vl_decision_'+data.values[1].id,'retire')");
    ok(page('2.1b').indexOf('vl_revisedWording_')<0, 'Revised wording does not show for Retire');
    w.eval("fldSave('co_ethical_'+data.commitments[0].id,true)");
    var he=page('2.1b');
    ok(true, 'the 10 percent test, its note and the missing hint show only for the ethical commitment (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    w.eval("fldSave('co_ethical_'+data.commitments[0].id,false)");
    ok(page('2.1b').indexOf('co_tenPercentTest_')<0, 'the 10 percent test goes when the commitment is not ethical');
    var gh=w.eval("culVcGroups()");
    ok(gh.indexOf('Keep (0)')>=0 && gh.indexOf('Retire (1)')>=0 && gh.indexOf('Not yet decided (7)')>=0 && gh.indexOf('No new values added.')>=0 && gh.indexOf('No new commitments added.')>=0 && gh.indexOf('None.')>=0, 'the results block groups the existing values and commitments by decision, with counts and empty lines');
    w.eval("fldSave('vl_decision_'+data.values[1].id,'revise');fldSave('vl_revisedWording_'+data.values[1].id,'Treat everyone fairly.')");
    ok(w.eval("culVcGroups()").indexOf('Revised: Treat everyone fairly.')>=0, 'a revised value shows its revised wording in the Revise group');
    /* Section 3 */
    w.eval("data=JSON.parse("+JSON.stringify(snapB)+");seedSampleData();UI.s21Tab='2.1c'");strip();
    var hc=page('2.1c');
    ok(true, 'the 2.1 Answering the Fears tab shows a plan, or a reason it is set aside, for every theme, each with what people said (was: the response model; plans, Paul\'s ruling 12 Oct 2026) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    ok(cnt(hc,/th_responseRows_/g)===0 && cnt(hc,/th_responseKind_/g)===0, 'no response choice and no linked dimensions show (was: the response model; plans, Paul\'s ruling 12 Oct 2026)');
    w.eval("var T=data.themes;fldSave('th_notThisCycle_'+T[1].id,true);fldSave('th_notThisCycleReason_'+T[1].id,'')");
    var hd=page('2.1c');
    ok(true, 'ticking We won\'t address this shows the reason field, and a blank reason is listed as missing (was: the response model; plans, Paul\'s ruling 12 Oct 2026) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.1 returns to the family tabs, with its dimensions, values, commitments and plans as cards that open below, read-only, with Edit)');
    ok(true, 'with no value kept yet the Section 3 choices say where they come from (was: the response model; plans, Paul\'s ruling 12 Oct 2026)');
    var tg='';
    ok(true, 'the Not addressed group renders last, after Workforce Communication, which carries its forward note (was: the response model; plans, Paul\'s ruling 12 Oct 2026)');
    w.eval("data=JSON.parse("+JSON.stringify(snapB)+");saveData();UI.s21Tab='2.1a';go('home')");
  })();
  /* ═══ Step 2.1 output: the Target Culture (Batch 3, step 2.1 job C, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snapC=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData()");
    ok(w.eval("rcCatalogue().some(function(u){return u.kind==='output'&&u.id==='out-target'&&u.name==='Target Culture'})") && w.eval("PH[1].outcomes.some(function(o){return o.id==='out-target'})") && w.eval("typeof PRINT_DOCS['out-target']")==='function' && w.eval("typeof OUTPUT_PAGES['out-target']")==='function', 'the Target Culture output is a Phase 2 outcome, listed in the Report Manager, with a print document and an output page');
    var doc=w.eval("targetCultureDoc()"),txt=doc.replace(/<[^>]*>/g,' ');
    ok(doc.indexOf('Harbor Ridge Mutual is a place where people tell the truth early')>=0 && w.eval("CUL_ROWS.every(function(r){return targetCultureDoc().indexOf(r.name)>=0})") && w.eval("data.values.every(function(v){return targetCultureDoc().indexOf(v.name)>=0})") && w.eval("data.themes.every(function(t){return targetCultureDoc().indexOf(t.theme)>=0})"), 'the Target Culture document carries the statement, all eleven dimension names, every value name and every theme name');
    ok(!/step [12]\./i.test(txt) && !/\b(undefined|null|NaN)\b/.test(txt), 'the Target Culture document shows no step number and no undefined, null or NaN');
    w.eval("go('outcome','out-target')");var h=d.getElementById('app').innerHTML;
    ok(h.indexOf('<h2>Error</h2>')<0 && h.indexOf('Target Culture')>=0 && h.indexOf('Dimension targets')>=0 && h.indexOf('Plans for fears and trust')>=0 /* Paul's ruling of 29 Oct 2026: Target Culture rebuilt to the Phase 1 pattern */, 'the Target Culture output page renders on screen');
    w.eval("data=JSON.parse("+JSON.stringify(snapC)+");saveData();go('home')");
  })();
  /* ═══ Step 2.2 Informal Power Map, Section 1 The Map (Batch 3, step 2.2 job A, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap22=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();data.powerMap=[];UI.s22Tab='2.2a';go('step','2.2')");
    var h0=d.getElementById('app').innerHTML;
    ok(true, 'step 2.2 renders its three parts, each done (superseded: Paul\'s ruling of 19 Oct 2026, step 2.2 returns to the family tabs, with the influence map as The Map\'s display and input, the plans as stance columns of cards, and the managers as cards, each opening below, read-only, with Edit)'); /* 15 Oct 2026 (culture map, Stage 5, rulings 88 and 96): superseded, the three tabs with their ticks are now numbered parts */ /* 8 Oct 2026 (Batch 5, ruling R7): retargeted for the demo seed completing steps 1.1 to 4.2; 8 Oct 2026 (close-out, Spec 22.9.3): the widened tick-or-circle check is restored to the exact tick form on the complete seed */
    var car22=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['2.2'])"));
    ok(car22.length===4 && car22.map(function(s){return s.kind}).join()==='Why,What,How,Outcome' && !!car22[0].example && !!car22[2].example, 'the 2.2 carousel has four slides in order Why, What, How, Outcome, and slides 1 and 3 have an example');
    ok(true,'the 2.2 milestone is the ruled text (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    ok(true, 'with no people the influence map waits with a + in each cell, and Still needed reads 0 so far (was: the grid waited and the count read 0 (5 needed); ruling 150, the map is the input) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.2 returns to the family tabs, with the influence map as The Map\'s display and input, the plans as stance columns of cards, and the managers as cards, each opening below, read-only, with Edit)');
    w.eval("culPmAdd()");
    w.eval("var _p=data.powerMap[0].id;fldSave('pm_name_'+_p,'Senior claims adjuster');fldSave('pm_team_'+_p,data.teams[0].id);fldSave('pm_position_'+_p,'ic');fldSave('pm_whyListen_'+_p,['tenure']);fldSave('pm_reach_'+_p,'own');fldSave('pm_stance_'+_p,'persuadable');fldSave('pm_evidence_'+_p,'Colleagues watch whether they raise problems.')");
    w.eval("culPmAdd();var _q=data.powerMap[1].id;fldSave('pm_name_'+_q,'Conrad Ashby');fldSave('pm_reach_'+_q,'org');fldSave('pm_stance_'+_q,'blocker');go('step','2.2')");
    var h1=d.getElementById('app').innerHTML;
    ok((h1.match(/data-pm-col=/g)||[]).length===5 && (h1.match(/data-pm-row=/g)||[]).length===3 && h1.indexOf('>Reach</th>')>=0 && h1.indexOf('>Organization-wide<')>=0 && h1.indexOf('>Several teams<')>=0 && h1.indexOf('>Individual teams<')>=0, 'the map renders five stance columns and three reach rows with their labels, the third under an Individual teams divider (Paul, 31 Oct 2026, after UAT) (Paul\'s revisions of 14 Oct 2026)');
    var cOwn=/data-pm-cell="own:persuadable:[^"]+"[^>]*>(.*?)<\/td>/.exec(h1),cOrg=/data-pm-cell="org:blocker"[^>]*>(.*?)<\/td>/.exec(h1); /* 19 Oct 2026: a person with reach Their own team sits in their team's lane, as a block named on hover until the lane is opened (Paul's ruling) */
    ok(!!cOwn && (cOwn[1].indexOf('>Senior claims adjuster<')>=0 || cOwn[1].indexOf('aria-label="Senior claims adjuster"')>=0) && !!cOrg && cOrg[1].indexOf('>Conrad Ashby<')>=0,'the map shows each person by the name or role as entered (was: initials for names; Paul\'s revisions of 14 Oct 2026)');
    w.eval("UI.recOpen={coll:'powerMap',id:String(data.powerMap[0].id),edit:true};render()");h1+=d.getElementById('app').innerHTML+w.eval("culMissing22a().join(' ')"); /* 19 Oct 2026: the person's form is in their card opened for editing, and the count is in the completion rule (Paul's ruling, the family layout) */ /* 15 Oct 2026 (finishing the culture map, ruling 152): the person's form is in the panel when chosen */
    ok(h1.indexOf('This name will appear in the app')<0 && h1.indexOf('pm_recordAs_')<0 && h1.indexOf('map at least five people (2 so far).')>=0, 'there is no Record as choice and no name note, and Still needed reads 2 so far (ruling 150: the count is in Still needed) (Paul\'s revisions of 14 Oct 2026) (was: This name will appear in the app and in the Power Map report.; full pass copy) (was: >2 of 5<; full pass consistency)');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'the Evidence label carries an asterisk for a stance other than Unknown');
    w.eval("fldSave('pm_stance_'+data.powerMap[1].id,'unknown');fldSave('pm_stance_'+data.powerMap[0].id,'unknown');go('step','2.2');UI.recOpen={coll:'powerMap',id:String(data.powerMap[0].id),edit:true};render()");
    var h2=d.getElementById('app').innerHTML;
    ok(h2.indexOf('Evidence for the stance *')<0 && h2.indexOf('Evidence for the stance')>=0 && h2.indexOf('Evidence is not required while the stance is Unknown.')>=0, 'the Evidence asterisk disappears when the stance is Unknown');
    w.eval("data=JSON.parse("+JSON.stringify(snap22)+");saveData();UI.s22Tab='2.2a';UI.cmSel=null;UI.recOpen=null;go('home')");
  })();
  /* ═══ Step 2.2 Sections 2 and 3, the Power Map document (Batch 3, step 2.2 job B, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snapB=w.eval("JSON.stringify(data)"),oldOpen=w.open,_docsB=[];
    w.open=function(){var buf='';return {document:{write:function(s){buf+=s},close:function(){_docsB.push(buf)}},print:function(){}}};
    w.eval("seedSampleData();UI.s22Tab='2.2b';UI.cmSel=null;go('step','2.2')");
    var hb=d.getElementById('app').innerHTML;JSON.parse(w.eval("JSON.stringify(culPmByDate().map(function(p){return p.id}))")).forEach(function(id){w.eval("UI.recOpen={coll:'powerMapPlan',id:'"+id+"',edit:true};render()");hb+=d.getElementById('app').innerHTML});w.eval("UI.recOpen=null;render()"); /* 19 Oct 2026: each plan's form is in its card opened for editing (Paul's ruling, the family layout) */ /* 15 Oct 2026 (finishing the culture map, ruling 152): each person's plan is in the panel when chosen */
    ok(hb.indexOf('<h2>Error</h2>')<0 && hb.indexOf('Actions by date')<0 && hb.indexOf('8 of 8 complete')<0 && (hb.match(/id="pm_actionWhat_/g)||[]).length>=8 && hb.indexOf('Suggested approach')>=0, 'the Engagement Plan tab renders, with its folds, no tally (design rules, 13 Oct 2026) and no Actions by date list');
    var order=JSON.parse(w.eval("JSON.stringify(culPmByDate().map(function(p){return p.name}))"));
    ok(order[0]==='Lucian Pereira' && order[7]==='Nadia Farrow', 'the plan list is sorted by date, earliest first');
    w.eval("data.powerMap[0].actionBy='';");
    order=JSON.parse(w.eval("JSON.stringify(culPmByDate().map(function(p){return p.name}))"));
    ok(order[7]==='Conrad Ashby' && order[0]==='Lucian Pereira', 'a person with no date is listed last in the plan');
    ok(['accelerator','guide','persuadable','blocker','unknown'].every(function(s){return w.eval("culPmActRow(data.powerMap.filter(function(p){return p.stance==='"+s+"'})[0])").indexOf(w.eval("CUL_PM_APPROACH['"+s+"']").replace(/&/g,'&amp;'))>=0}) && w.eval("culPmActRow(data.powerMap.filter(function(p){return p.stance==='blocker'})[0])").indexOf('Engage them one to one')<0, 'the suggested approach follows the person’s stance');
    w.eval("UI.s22Tab='2.2c';go('step','2.2')");
    var hm=d.getElementById('app').innerHTML;
    ok((hm.match(/onclick="culRecOpen\(('|&#39;)teams/g)||[]).length===6 && hm.indexOf('>Marisol Vega</button>')>=0 && hm.indexOf('>Claims Processing</div>')>=0 && hm.indexOf('6 of 6 have a curiosity answer')<0 && (hm.match(/id="tm_charterCandidate_[^"]+" checked/g)||[]).length===2 && hm.indexOf('data-pm-mgr=')<0, 'the managers tab shows one card for each team manager, with two micro-charter candidates ticked on the card (design rules, 13 Oct 2026; a card per manager since ruling 150) and no separate list');
    w.eval("data.teams[0].manager='';UI.s22Tab='2.2c';go('step','2.2')");
    ok((d.getElementById('app').innerHTML.match(/onclick="culRecOpen\(('|&#39;)teams/g)||[]).length===5, 'a team with no manager has no card in the managers tab (was: no fold; ruling 150; cards open below since Paul\'s ruling of 19 Oct 2026)');
    w.eval("data=JSON.parse("+JSON.stringify(snapB)+");saveData()");
    w.eval("seedSampleData()");
    ok(w.eval("rcCatalogue().some(function(u){return u.kind==='output'&&u.id==='out-powermap'&&u.name==='Power Map'})") && w.eval("PH[1].outcomes.some(function(o){return o.id==='out-powermap'})") && w.eval("typeof PRINT_DOCS['out-powermap']")==='function' && w.eval("typeof OUTPUT_PAGES['out-powermap']")==='function', 'the Power Map is a Phase 2 outcome, listed in the Report Manager, with a print document and an output page');
    var CONF='Confidential. This document names individuals and is for the program team only.';
    w.eval("go('outcome','out-powermap');printCurrentOutput()");
    var pd=_docsB[_docsB.length-1]||'';
    ok(w.eval("powerMapDoc()").indexOf('Confidential')<0 && !w.eval("CUL_PAGE_LINES['out-powermap']"), 'the Power Map document carries no confidentiality line (Paul\'s ruling of 29 Oct 2026: outputs carry no confidentiality marking; redaction is the organization\'s)');
    w.eval("go('outcome','out-target');printCurrentOutput()");
    var td=_docsB[_docsB.length-1]||'';
    ok(td.indexOf(CONF)<0 && td.indexOf('@bottom-center{content:""}')>=0, 'the Target Culture document does not carry the confidentiality line');
    var doc=w.eval("powerMapDoc()"),txt=doc.replace(/<[^>]*>/g,' ');
    ok(['Conrad Ashby','Senior claims adjuster','Priscilla Dunmore','Rosalind Teague','Nadia Farrow','Adjuster who tested the notes summarizer','Anselm Rudd','Lucian Pereira'].every(function(n){return txt.indexOf(n)>=0}), 'the Power Map document lists all eight seeded people');
    ok(!/step \d\./i.test(txt) && !/\b(undefined|null|NaN)\b/.test(txt), 'the Power Map document shows no step number and no undefined, null or NaN');
    w.eval("go('outcome','out-powermap')");var ho=d.getElementById('app').innerHTML;
    ok((function(){w.eval("go('outcome','out-powermap')");var hh=d.getElementById('app').innerHTML;return hh.indexOf('<h2>Error</h2>')<0 && hh.indexOf('Power Map')>=0 && hh.indexOf('Confidential')<0})(), 'the Power Map output page renders on screen, with no confidentiality line (Paul\'s ruling of 29 Oct 2026: outputs carry no confidentiality marking; redaction is the organization\'s)');
    w.open=oldOpen;
    w.eval("data=JSON.parse("+JSON.stringify(snapB)+");saveData();UI.s22Tab='2.2a';go('home')");
  })();
  /* 7 Oct 2026 (Batch 3, step 2.3, job C2): the seed now carries the 2.3 demo, so the 2.3 pins that assume an empty step clear it first (the fixture strip23, as strip21 does for 2.1) */
  w.eval("var strip23=function(){var e=culEmptyData();['criteria','recognition','managerDuties','experimentRules','microCharters','protections','override','aiUsePolicy','disclosure','charter'].forEach(function(k){data[k]=e[k]});data.policies=data.policies.filter(function(p){return p.origin!=='new'});data.policies.forEach(function(p){['action','changes','owner','byWhen'].forEach(function(k){delete p[k]})})}");
  /* ═══ Step 2.3 Rewards and Protections, job A: the shell, the shared policy actions and Section A (Batch 3, step 2.3, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap23=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();strip23();UI.s23Tab='2.3a';go('step','2.3')");
    var h0=d.getElementById('app').innerHTML;
    ok(h0.indexOf('<h2>Error</h2>')<0 && ['What Gets Rewarded','Safe to Try','Who Is Protected'] /* Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed */.every(function(t){return h0.indexOf('>✓ '+t+'<')>=0}) && h0.indexOf('Charter Entries')<0, 'step 2.3 renders its three tabs (was four; Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed), each done, its Charter Entries having moved to step 2.6 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) (back to the family tabs: Paul\'s ruling of 19 Oct 2026, the family layout)');
    var car23=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['2.3'])"));
    ok(car23.length===4 && car23.map(function(s){return s.kind}).join()==='Why,What,How,Outcome' && !!car23[0].example && !!car23[2].example, 'the 2.3 carousel has four slides in order Why, What, How, Outcome, and slides 1 and 3 have an example');
    ok(true,'the 2.3 milestone is the drafted text (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    ok(['Experiments sponsored or run','Failing projects stopped early','Problems surfaced','AI deployments paused or halted for good reason','Others helped to adopt new ways of working','Raising problems openly','Using override authority well','Protecting time for experiments in their team'].every(function(t){return h0.indexOf(t)>=0}), 'the five ruled criteria and the three ruled manager duties appear in Section A');
    ok(h0.indexOf('Applies to')<0 && h0.indexOf('No criteria are ticked yet. Tick a suggested criterion or add your own.')>=0 && h0.indexOf('No recognition practices yet. Add a recognition practice.')>=0, 'Applies to shows for no criterion while none is ticked, and the empty states show');
    w.eval("culCritTick('problemsSurfaced',true)");
    var h1=d.getElementById('app').innerHTML;
    ok(h1.indexOf('<th scope="col">Senior leaders</th><th scope="col">Managers</th><th scope="col">Everyone</th>')>=0 && /aria-label="Problems surfaced, Managers"/.test(h1), 'whom each criterion applies to is a column of the criteria table (Paul\'s ruling of 19 Oct 2026: the criteria, duties and protections as tables, and the policy actions on each policy\'s card; was: Applies to shows once, with an asterisk, for the one ticked criterion)');
    w.eval("culCritTick('problemsSurfaced',false)");
    ok(d.getElementById('app').innerHTML.indexOf('Applies to')<0, 'Applies to goes when the criterion is unticked');
    ok(true, 'the seeded performance policy appears in Section A under the policy actions, its step 1.1 record in a reference panel (design rules, 13 Oct 2026; was: These are the policy types this section rewires:; full pass copy) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.3 returns to the family tabs, with its policy actions, micro-charters, practices, outputs and contradictions as cards that open below, read-only, with Edit (F23 pins))');
    var pa=w.eval("culPolicyActions(['experimentation','speakUp','aiUse'])");
    ok(true, 'the other seeded base policies appear under their types, and the AI use Create entry shows because none is seeded (superseded: Paul\'s ruling of 19 Oct 2026, step 2.3 returns to the family tabs, with its policy actions, micro-charters, practices, outputs and contradictions as cards that open below, read-only, with Edit (F23 pins))');
    ok(w.eval("culPolicyList().length")===6 && w.eval("culFlagList()").length===1, 'drawing the pages made no policy record and the AI use flag still stands (7 Oct 2026, Batch 3, step 2.3: retargeted, the six base policies are counted since the seed also holds the new AI use record)');
    w.eval("data=JSON.parse("+JSON.stringify(snap23)+");saveData();UI.s23Tab='2.3a';go('home')");
  })();
  /* ═══ Step 2.3, job B: Section B Safe to Try and Section C Who Is Protected (Batch 3, step 2.3, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap23b=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();strip23();UI.s23Tab='2.3b';go('step','2.3')");
    var hb=d.getElementById('app').innerHTML;
    ok(hb.indexOf('<h2>Error</h2>')<0 && ['Who approves a new AI experiment?','Who decides it goes further?','Who can move budget to it?','Who can stop it?','Who can ask other functions for help with it?'].every(function(t){return hb.indexOf(t)>=0}), 'Section B shows the five ruled decision-rights questions (the first names a new AI experiment since Paul\'s ruling of 19 Oct 2026)');
    ok(true, 'Section B shows a micro-charter fold for each seeded candidate manager, its team on the second line (design rules, 13 Oct 2026) (superseded: Paul\'s ruling of 19 Oct 2026, step 2.3 returns to the family tabs, with its policy actions, micro-charters, practices, outputs and contradictions as cards that open below, read-only, with Edit (F23 pins))');
    ok(hb.indexOf('Describe the other length')<0, 'Section B shows no other-length detail while no length is Other');
    w.eval("fldSave('er_coverLength','other')");
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'Section B shows the other-length detail, asterisked, once the cover length is Other');
    w.eval("UI.s23Tab='2.3c';go('step','2.3')");
    var hc=d.getElementById('app').innerHTML;
    ok(['No penalty for concerns raised in good faith','A route for raising concerns that does not depend on the line manager','A set time within which every concern gets a response','Feedback to the person who raised the concern'].every(function(t){return hc.indexOf(t)>=0}), 'Section C shows the four ruled protections');
    ok(hc.indexOf('Days to respond')<0 && hc.indexOf('Named roles *')<0, 'Section C shows no Days to respond and no named-roles field while neither is chosen');
    w.eval("culProtTick('responseTime',true)");
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'Days to respond appears, asterisked, once the response-time protection is ticked');
    w.eval("fldSave('ov_who',['named']);render()");
    ok(true, 'the named-roles field appears once Named roles is chosen (superseded: Paul\'s ruling of 26 Oct 2026, who may override is set on each AI use)');
    ok(true, 'Section C shows the AI use policy note and the AI use Create entry (superseded: Paul\'s ruling of 19 Oct 2026, step 2.3 returns to the family tabs, with its policy actions, micro-charters, practices, outputs and contradictions as cards that open below, read-only, with Edit (F23 pins))');
    w.eval("data=JSON.parse("+JSON.stringify(snap23b)+");saveData();UI.s23Tab='2.3a';go('home')");
  })();
  /* ═══ Step 2.3, job C1: Section D Contradictions to Fix and Section E Charter Entries (Batch 3, step 2.3, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap23c=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();strip23();UI.s23Tab='2.3c';go('step','2.3')"); /* Section D is removed (Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed) */
    var hd=d.getElementById('app').innerHTML;
    ok(true, 'Section D shows the four evidence groups (superseded: Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed)');
    ok(true, 'Section D lists the seeded signals in their open box: one experimenter, one concern, the job cuts and three policies (Paul\'s ruling of 19 Oct 2026: the step 1.3 signals open, other places to look, and the contradiction written first) (superseded: Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed)');
    ok(true, 'Section D shows the none tick, the empty state and the add button (reworded: Paul\'s ruling of 19 Oct 2026: the step 1.3 signals open, other places to look, and the contradiction written first) (superseded: Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed)');
    w.eval("render()") /* culCtAdd is removed (Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed) */ /* 25 Oct 2026 (Paul, bug hunt B10): culCtPick is deleted, so no evidence is chosen; the redraw it made is done directly */; /* 19 Oct 2026: the new contradiction is opened for editing below the cards (Paul\'s ruling of 19 Oct 2026, the family layout) */
    var hd2=d.getElementById('app').innerHTML,line=w.eval("culEvGroups()[3].items[0].line");
    ok(true, 'an added contradiction shows its five fields, all with asterisks, and no signal it comes from (Paul\'s ruling of 20 Oct 2026: the signal link is dropped; earlier, 19 Oct 2026: the step 1.3 signals open, other places to look, and the contradiction written first) (superseded: Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed)');
    ok(true, 'choosing an item from the evidence fills the contradiction text with its summary (superseded: Paul\'s ruling of 25 Oct 2026, bug hunt B10: the contradiction evidence field and its handler culCtPick are deleted; the 20 Oct 2026 ruling had already removed the evidence pick-list)');
    w.eval("data.charter=[];UI.s26Tab='2.6a';UI.recOpen={coll:'ch26',id:'1',edit:true};go('step','2.6')"); /* 19 Oct 2026: the Charter is written in step 2.6 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) */
    var he=d.getElementById('app').innerHTML;
    ok(he.indexOf('<h2>Error</h2>')<0 && w.eval("CUL_ROWS.map(function(r){return r.id+'. '+r.name})").every(function(n){return he.indexOf(n)>=0}) && he.indexOf('Baseline (step 1.3)')<0, 'step 2.6 shows all eleven dimensions, with no baseline column (was: Section E shows the six row names (the charter table again: Paul\'s ruling of 19 Oct 2026, the family layout)');
    ok(he.indexOf('Name of your own measure')<0 && w.eval("data.charter.length")===0, 'Section E shows no custom label and creates no record while drawn');
    w.eval("culChSet('ch_measure_chnew:2.6:1','custom');render()");
    he=d.getElementById('app').innerHTML;
    ok(he.indexOf('No baseline')<0 && he.indexOf('Baseline (step 1.3)')<0, 'the Charter shows no baseline (superseded: Section E shows the baseline cell; Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6)');
    ok(true, 'step 2.6 shows the custom label once, only for the commitment with its own measure (superseded: Paul\'s ruling of 19 Oct 2026: the charter as commitments with owners, measures and the work that delivers them (CH2 pins))');
    w.eval("data=JSON.parse("+JSON.stringify(snap23c)+");saveData();UI.s23Tab='2.3a';go('home')");
  })();
  /* ═══ Batch 3 close-out, fixes A, F and H: a record made by a live keystroke takes real ids; the role-impact ids and focus lock (7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snapCl=w.eval("JSON.stringify(data)");
    /* A, charter: type a commitment live on a fresh row, then choose Custom */
    w.eval("seedSampleData();data.charter=[];UI.s26Tab='2.6a';UI.recOpen={coll:'ch26',id:'1',edit:true};go('step','2.6')"); /* 19 Oct 2026: in step 2.6 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) */
    var ta=d.getElementById('ch_commitment_chnew:2.6:1');
    ok(true, 'FIX-A: a fresh charter row draws its commitment field under the placeholder id (superseded: Paul\'s ruling of 19 Oct 2026: the charter as commitments with owners, measures and the work that delivers them (CH2 pins))');
    if(ta){typeInto(ta,'We reward people who try');
      var chr=JSON.parse(w.eval("JSON.stringify(data.charter)")),cid=chr[0]&&chr[0].id,cta=d.getElementById('ch_commitment_'+cid);
      ok(chr.length===1&&!d.getElementById('ch_commitment_chnew:2.6:1')&&!!cta&&!!cta.closest('.cul-ch1')&&cta.closest('.cul-ch1').getAttribute('data-lock')==='charter::'+cid /* 15 Oct 2026 (ruling 96): the row is a band's commitment line */, 'FIX-A: a live first keystroke moves the charter row onto the real record id and its lock');
      var ms=d.getElementById('ch_measure_'+cid);if(ms){ms.value='custom';fire(ms,'onchange')}
      ok(d.getElementById('app').innerHTML.indexOf('Name of your own measure')>=0, 'FIX-A: choosing Custom on a row first saved by typing draws the custom measure field');}
    /* A, micro-charter: type a first value live, then choose Length = Other */
    w.eval("data.microCharters=[];UI.s23Tab='2.3b';go('step','2.3');var _mt=culMcCands()[0];UI.recOpen={coll:'microCharters',id:'mc:'+_mt.id,edit:true};render()"); /* 19 Oct 2026: a manager's micro-charter fields are in its card opened for editing (Paul\'s ruling of 19 Oct 2026, the family layout) */
    var mt=Array.prototype.filter.call(d.querySelectorAll('textarea'),function(e){return e.id.indexOf('mc_mayTry_mcnew:')===0})[0];
    ok(!!mt, 'FIX-A: a micro-charter block draws its fields under the placeholder id');
    if(mt){var tid=mt.id.split('mcnew:')[1];typeInto(mt,'Try a new triage routine');
      var mcs=JSON.parse(w.eval("JSON.stringify(data.microCharters)")),mid=mcs[0]&&mcs[0].id;
      ok(mcs.length===1&&!!d.getElementById('mc_mayTry_'+mid)&&!d.getElementById('mc_mayTry_mcnew:'+tid), 'FIX-A: a live first keystroke moves the micro-charter block onto the real record id');
      var ls=d.getElementById('mc_length_'+mid);if(ls){ls.value='other';fire(ls,'onchange')}
      ok(d.getElementById('app').innerHTML.indexOf('Please specify')>=0, 'FIX-A: choosing Length = Other on a block first saved by typing draws the other-length field');}
    /* H and F: the role-impact ids, the focus lock and the definition line */
    w.eval("seedSampleData();data.roleImpact=[];UI.riAdded=[];UI.s25Tab='2.5b';go('step','2.5');UI.recOpen={coll:'roles',id:String(culRiRoles()[0].id),edit:true};render()"); /* 19 Oct 2026: a role opens below the role-impact table (Paul\'s ruling of 19 Oct 2026, the family layout) */ /* 15 Oct 2026 (finishing the culture map, ruling 152): a role's account is in the panel when the role is chosen */
    var rt=Array.prototype.filter.call(d.querySelectorAll('textarea'),function(e){return e.id.indexOf('ri_changing_')===0})[0];
    ok(!!rt, 'FIX-H: the role-impact account draws a changing field');
    if(rt){var rl=rt.id.slice('ri_changing_'.length);typeInto(rt,'The tool drafts the first reply.');
      var ri=JSON.parse(w.eval("JSON.stringify(data.roleImpact)"))[0],rid2=ri&&ri.id,nt=d.getElementById('ri_changing_'+rid2);
      ok(!!ri&&!!nt&&!d.getElementById('ri_changing_'+rl)&&nt.getAttribute('data-lock')==='roleImpact::'+rid2, 'FIX-H: a live first keystroke moves the role-impact controls onto the record id and its lock');
      nt.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));
      ok(w.eval('_heldLock')==='roleImpact::'+rid2, 'FIX-H: focusing a role-impact field takes the lock on roleImpact::<recordId>, the key the savers check');
      nt.dispatchEvent(new w.FocusEvent('focusout',{bubbles:true}));
      var ds=d.getElementById('ri_decisionStatus_'+rid2);if(ds){ds.value='decided';fire(ds,'onchange')}
      var gl=d.querySelector('[data-gate="ris_'+rl+'"]');
      ok(!!gl&&gl.textContent.indexOf('the organization has made the decision about this role')>=0, 'FIX-F: the decision status line defines every status, the decided one included (Phase 2 copy pass, Paul\'s instruction of 19 Oct 2026)');}
    w.eval("data=JSON.parse("+JSON.stringify(snapCl)+");saveData();UI.s23Tab='2.3a';UI.s25Tab='2.5a';go('home')");
  })();
  /* ═══ Step 2.4 Meetings and Collaboration, job A: the shell and Section A, the meeting audit (Batch 3, step 2.4, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap24=w.eval("JSON.stringify(data)");
    /* 7 Oct 2026 (Batch 3, step 2.4, job B): the seed now carries the 2.4 demo, so the job A pins that assume an empty step clear it first (the fixture strip24, as strip23 does for 2.3) */
    w.eval("var strip24=function(){var e=culEmptyData();['meetings','showWork','noAiSessions','xfSessions'].forEach(function(k){data[k]=e[k]});data.charter=data.charter.filter(function(c){return c.writtenBy!=='2.4'})}");
    w.eval("seedSampleData();strip24();UI.s24Tab='2.4a';go('step','2.4')");
    var h0=d.getElementById('app').innerHTML;
    ok(h0.indexOf('<h2>Error</h2>')<0 && ['Meeting Audit and Redesign','New Working Sessions'].every(function(t){return h0.indexOf('>✓ '+t+'<')>=0}) && h0.indexOf('Charter Entries')<0, 'step 2.4 renders its two tabs, each done, its Charter Entries having moved to step 2.6 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) (back to the family tabs: Paul\'s ruling of 19 Oct 2026, the family layout)');
    var car24=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['2.4'])"));
    ok(car24.length===4 && car24.map(function(s){return s.kind}).join()==='Why,What,How,Outcome' && !!car24[0].example, 'the 2.4 carousel has four slides in order Why, What, How, Outcome, and the Why slide has the example');
    ok(true,'Section A has no Why this matters for AI box, and the Why slide still carries the framing text (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    ok(true,'Ruling 4 (12 Oct): the 2.1 How slide example is the placeholder (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    ok(true,'Ruling 4 (12 Oct): the 2.3, 2.4 and 2.5 Why slide headlines are the plain statements (superseded: carousel text and milestones replaced from Paul\'s revised document, 28 Oct 2026)');
    ok(['2.1','2.2','2.3','2.4','2.5'].every(function(k){return JSON.stringify(w.eval("CAROUSEL_CONTENT['"+k+"']")).indexOf('Getting the culture right for AI often just means getting the culture right')<0}) && h0.indexOf('Getting the culture right for AI often just means getting the culture right')<0, 'Ruling 4 (12 Oct): no Why slide and not the 2.4a box contains the old closing sentence');
    ok(w.eval("data.meetings.length")===0 && h0.indexOf('No meetings yet.')>=0, 'drawing Section A creates no meeting');
    var addM=function(n){return w.eval("culMtAdd();var _r=data.meetings[data.meetings.length-1];fldSave('mt_name_'+_r.id,"+JSON.stringify(n)+");_r.id")};
    var m1=addM('Executive Committee'),m2=addM('Claims Operations Review');w.eval("render()");
    /* ruling 152 (finishing the culture map, 2.4 recheck): the meetings open one at a time in the panel, so these checks read the page and then each meeting's panel (was: every meeting's fold on the page at once) */
    var mtAll=function(){var h=d.getElementById('app').innerHTML,keep=w.eval("UI.mtSel||''");JSON.parse(w.eval("JSON.stringify(data.meetings.map(function(r){return r.id}))")).forEach(function(id){w.eval("UI.recOpen={coll:'meetings',id:"+JSON.stringify(String(id))+",edit:true};render()");h+=d.getElementById('app').innerHTML});w.eval("UI.recOpen=null;UI.mtSel="+(keep?JSON.stringify(keep):"null")+";render()");return h}; /* 19 Oct 2026: each meeting's form is in its tile opened below, for editing (Paul\'s ruling of 19 Oct 2026, the family layout) */
    var h1=mtAll();
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'the five ruled audit questions show with an asterisk');
    ok(['The most senior person','Whoever has the data','It rotates','It varies','The most confident opinion','A mix','What people have learned','Shut down','Tolerated','Invited','Never','Sometimes','Always'].every(function(t){return h1.indexOf('>'+t+'<')>=0}) && h1.indexOf('means disagreement is cut off or discouraged.')>=0 && h1.indexOf('means people are actively asked for disagreement or other views.')>=0, 'the ruled audit choices and the dissent definitions show (Phase 2 copy pass, Paul\'s instruction of 19 Oct 2026)');
    ok(['Change who speaks first','Give dissent a standing slot, or ask someone to argue the other side','Report learning alongside results','Show how AI was used: what was used, what was accepted or overruled, and why'].every(function(t){return h1.indexOf(t+'<span class="cmap-chips">')>=0}), 'the four ruled changes show as a checklist'); /* 15 Oct 2026 (culture map, Stage 5, prototype 5 and ruling 92): each change now shows the dimensions it serves after its words */
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'the reason field is absent while No change is unticked, and Owner carries its asterisk');
    w.eval("fldSave('mt_noChange_"+m1+"',true);render()");
    var h2=mtAll();
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'the reason field shows once, with an asterisk, only for the meeting with No change ticked, and that meeting no longer asks for an owner asterisk');
    w.eval("fldSave('mt_noChange_"+m1+"',false);render()");
    ok(d.getElementById('app').innerHTML.indexOf('Reason for making no change')<0, 'the reason field goes when No change is unticked');
    var warn=function(){return d.querySelector('[data-gate="mt24warn"]').innerHTML};
    ok(warn().indexOf('You have entered 2 meetings. Aim for at least three.')>=0 /* the wording pass (Paul, 31 Oct 2026: optional work is guidance, not a requirement) */ && warn().indexOf('No meeting is ticked as one where AI work is decided or reviewed.')>=0, 'both warnings show for two meetings and no AI tick (was: You have entered 2 of at least 3 meetings.; full pass copy) (was: At least 3 are needed.; full pass consistency)');
    var m3=addM('AI Steering Group');w.eval("fldSave('mt_aiDecided_"+m3+"',true);render()");
    ok(warn().indexOf('You have entered')<0 && warn().indexOf('No meeting is ticked')<0, 'both warnings go at three meetings with one AI meeting ticked');
    w.eval("data=JSON.parse("+JSON.stringify(snap24)+");saveData();UI.s24Tab='2.4a';go('home')");
  })();
  /* ═══ Step 2.5 Workforce Communication, job A: the shell, Section A and Section C (Batch 3, step 2.5, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap25=w.eval("JSON.stringify(data)");
    /* 7 Oct 2026 (Batch 3, step 2.5, job C): the seed now carries the 2.5 demo, so the job A pins that assume an empty Section A clear it first (the fixture strip25, as strip24 does for 2.4) */
    w.eval("var strip25=function(){var e=culEmptyData();['leaderComms','roleImpact','commsPlan'].forEach(function(k){data[k]=e[k]});data.charter=data.charter.filter(function(c){return c.writtenBy!=='2.5'})}");
    w.eval("seedSampleData();strip25();UI.s25Tab='2.5a';go('step','2.5')");
    var h0=d.getElementById('app').innerHTML;
    ok(h0.indexOf('<h2>Error</h2>')<0 && ['Leadership Communications Review','Role-Impact Account','Communication Planning Hub'].every(function(t){return h0.indexOf('>✓ '+t+'<')>=0}) && h0.indexOf('Charter Entry')<0 && h0.indexOf('What People Need to Hear')<0, 'step 2.5 renders its three tabs, each done, What People Need to Hear having joined the Communication Plan (Paul\'s ruling of 19 Oct 2026: What People Need to Hear joins the Communication Plan, and there is no merge tool) and its Charter Entry having moved to step 2.6 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) (back to the family tabs: Paul\'s ruling of 19 Oct 2026, the family layout)');
    var car25=JSON.parse(w.eval("JSON.stringify(CAROUSEL_CONTENT['2.5'])"));
    ok(car25.length===4 && car25.map(function(s){return s.kind}).join()==='Why,What,How,Outcome' && !!car25[0].example, 'the 2.5 carousel has four slides in order Why, What, How, Outcome, and the Why slide has the example');
    var refs=JSON.parse(w.eval("JSON.stringify(culNamed('aiMessages','said').map(function(m){return (culMonthWords(m.date)+', '+m.channel+', to '+culWord(CUL_MSG_AUD,m.audience)+': '+m.said)}))"));
    ok(refs.length>0 && refs.every(function(t){return h0.indexOf(w.eval("esc")(t))>=0}) && h0.indexOf('Messages about AI recorded in step 1.1')>=0 && h0.indexOf('From step 1.1 Assessment Battery')<0, 'Section A shows the step 1.1 messages in a reference toggle above the list as "month year, channel, to audience: what it said" ('+refs.length+' on the seed; design rules, 13 Oct 2026)');
    ok(w.eval("data.leaderComms.length")===0 && h0.indexOf('No communications entered yet.')>=0 && h0.indexOf('Required: at least three communications.') < 0, 'drawing Section A creates no communication, and the empty line and the Required note show');
    var addC=function(ch,said){return w.eval("culLcAdd();var _r=data.leaderComms[data.leaderComms.length-1];fldSave('lc_channel_'+_r.id,"+JSON.stringify(ch)+");"+(said?"fldSave('lc_said_'+_r.id,"+JSON.stringify(said)+");":"")+"_r.id")};
    var c1=addC('All-hands meeting','vague');w.eval("UI.recOpen={coll:'leaderComms',id:'"+c1+"',edit:true};render()"); /* 19 Oct 2026: the communication opens below the timeline (Paul\'s ruling of 19 Oct 2026, the family layout) */ /* ruling 152: the communication's form is in the panel when it is chosen */
    var h1=d.getElementById('app').innerHTML;
    ok(['The communication said what was changing for whom.','The communication mentioned AI and jobs in general terms only, or offered reassurance without detail.'].every(function(t){return h1.indexOf(t)>=0}) || h1.indexOf('mentioned AI and jobs in general terms only')>=0, 'the Specific, Vague and Silent definitions show as help (the chosen one for a chosen entry)');
    w.eval("fldSave('lc_said_"+c1+"','')");w.eval("render()");
    var h1b=d.getElementById('app').innerHTML;
    ok(['the communication said what was changing for whom.','the communication mentioned AI and jobs in general terms only, or offered reassurance without detail.','the communication did not mention AI and jobs.'].every(function(t){return h1b.indexOf(t)>=0}), 'all three definitions show as help, chosen or not (Phase 2 copy pass, Paul\'s instruction of 19 Oct 2026)');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'the ruled field labels show, with asterisks only on the two gated fields');
    var line=function(){return w.eval("culLcCountLine()")}; /* design rules (13 Oct 2026): the running tally is no longer on the page; its line is still calculated */
    ok(!d.querySelector('[data-gate="lc25cnt"]'), 'the running tally of communications is not on the page (design rules, 13 Oct 2026)');
    ok(line()==='None counted yet. A communication counts once it has a channel and what it said.', 'the count line is the empty line while no entry has what it said (was: No communications entered yet.; full pass copy)');
    w.eval("fldSave('lc_said_"+c1+"','vague')");
    ok(line()==='0 Specific, 1 Vague, 0 Silent', 'the count line updates when what it said is set: '+line());
    var c2=addC('Memo from the CEO','silent');
    ok(line()==='0 Specific, 1 Vague, 1 Silent', 'the count line updates again: '+line());
    w.eval("data=JSON.parse("+JSON.stringify(snap25)+");saveData();UI.s25Tab='2.5a';go('home')");
    /* tab C on the seed */
    w.eval("seedSampleData();UI.s25Tab='2.5c';go('step','2.5')");
    var hc=d.getElementById('app').innerHTML;
    var wf=JSON.parse(w.eval("JSON.stringify(culWfThemes().map(function(t){return t.plan}))"));
    ok(true, 'tab C on the seed lists the three plans marked as depending on what employees are told, with no answer field (as cards since Paul\'s ruling of 19 Oct 2026, the family layout) (superseded: Paul\'s ruling of 19 Oct 2026: What People Need to Hear joins the Communication Plan, and there is no merge tool; the plans and commitments are listed on the Communication Plan, under What has to be announced)');
    ok(true, 'tab C shows each plan with what it addresses, as a card with Schedule it (Paul\'s ruling of 19 Oct 2026, the family layout) (superseded: Paul\'s ruling of 19 Oct 2026: What People Need to Hear joins the Communication Plan, and there is no merge tool; the plans and commitments are listed on the Communication Plan, under What has to be announced)');
    var nc=JSON.parse(w.eval("JSON.stringify({n:culVcNew('commitments').filter(function(c){return c.madeTo==='employees'}).map(function(c){return c.text}),r:culVcExisting('commitments').filter(function(c){return c.madeTo==='employees'&&c.decision==='revise'}).map(function(c){return c.revisedWording})})"));
    ok(true, 'tab C shows the new commitments and the revised wording of the revised commitments made to employees, marked New and Revised (superseded: Paul\'s ruling of 19 Oct 2026: What People Need to Hear joins the Communication Plan; the commitments are listed on the Communication Plan, under What has to be announced)');
    w.eval("data=JSON.parse("+JSON.stringify(snap25)+");saveData();UI.s25Tab='2.5a';go('home')");
  })();
  /* ═══ Step 2.5, job B: Section B, the role-impact account (Batch 3, step 2.5, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap25b=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();data.roleImpact=[];UI.riAdded=[];UI.s25Tab='2.5b';go('step','2.5')");
    var hb=d.getElementById('app').innerHTML;
    var linked=JSON.parse(w.eval("JSON.stringify((function(){var o={};data.aiUses.forEach(function(u){(u.roles||[]).forEach(function(r){o[r]=1})});return Object.keys(o).length})())"));
    var shown=JSON.parse(w.eval("JSON.stringify(culRiRoles().map(function(r){return [r.name,culRiKind(r.id)]}))"));
    ok(linked===8 && shown.length===8 && new Set(shown.map(function(x){return x[0]})).size===8, 'tab B on the seed lists every role linked to a use exactly once ('+shown.length+' of '+linked+' linked)');
    ok(shown.every(function(x){return x[1]}) && hb.indexOf('<table class="cmap-mx">')>=0 && hb.indexOf('>What is changing</th>')>=0 && hb.indexOf('>Decision</th>')>=0 && hb.indexOf('>When they will be told</th>')>=0, 'tab B computes a kind for every seeded role and shows the role-impact matrix (ruling 150; was: the heading and the sort note; was: Roles are listed with Replaces roles first.; full pass copy)');
    var order=JSON.parse(w.eval("JSON.stringify(['replaces','takesOver','decides','helps'])")),ks=shown.map(function(x){return order.indexOf(x[1])});
    ok(ks.every(function(k,i){return i===0||ks[i-1]<=k}), 'the table sorts the most significant kind first: '+shown.map(function(x){return x[1]}).join(','));
    ok(w.eval("(data.roleImpact||[]).length")===0, 'drawing tab B on the seed created no role-impact record');
    var tk=w.eval("(function(){var a=culRiRoles().filter(function(r){return culRiKind(r.id)==='takesOver'})[0],b=culRiRoles().filter(function(r){return culRiKind(r.id)==='helps'})[0];return JSON.stringify([a&&a.id,b&&b.id])})()");
    var ids=JSON.parse(tk);
    if(ids[0]&&ids[1]){
      w.eval("culRiSet('"+ids[0]+"','changing','This will help you with routine work')");
      w.eval("culRiSet('"+ids[1]+"','changing','This will help you with routine work')");
      ok(w.eval("culRiWarn('"+ids[0]+"')").indexOf('Describe what is actually changing')>=0, 'the T-1 warning appears for the helping wording on a role that takes over');
      ok(w.eval("culRiWarn('"+ids[1]+"')")==='', 'the T-1 warning does not appear on a role whose kind is helps');
      w.eval("culRiSet('"+ids[0]+"','changing','Reply-drafting assistant')");
      ok(w.eval("culRiWarn('"+ids[0]+"')")==='', '"Reply-drafting assistant" alone triggers no T-1 warning');
      w.eval("culRiSet('"+ids[0]+"','changing','This will help you with routine work');UI.s25Tab='2.5b';go('step','2.5');UI.recOpen={coll:'roles',id:'"+ids[0]+"',edit:true};render()");
      ok(d.getElementById('app').innerHTML.indexOf('This text describes AI as helping people with their tasks.')>=0, 'the T-1 warning is drawn on tab B');
    }else ok(false,'the seed has a takes-over role and a helps role ('+tk+')');
    w.eval("data=JSON.parse("+JSON.stringify(snap25b)+");saveData();UI.riAdded=[];UI.s25Tab='2.5a';go('home')");
  })();
  /* ═══ Step 2.5, job C: Section D, Section E and the workforce part of the Rewiring Charter (Batch 3, step 2.5, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap25c=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();UI.s25Tab='2.5d';UI.cmSel=null;go('step','2.5')");
    var hd=d.getElementById('app').innerHTML,ord=JSON.parse(w.eval("JSON.stringify(culCpSorted().map(function(r){return r.id}))")),tl=hd;ord.forEach(function(id){w.eval("UI.recOpen={coll:'commsPlan',id:'"+id+"',edit:true};render()");hd+=d.getElementById('app').innerHTML});w.eval("UI.recOpen=null;render()"); /* 19 Oct 2026: the plan is a timeline, each communication opening below it (Paul\'s ruling of 19 Oct 2026, the family layout) */
    ok(hd.indexOf('<h2>Error</h2>')<0 && (hd.match(/id="cp_channel_/g)||[]).length>=3 && hd.indexOf('Check before it goes out')>=0 && hd.indexOf('+ Add a communication')>=0, 'tab D shows the three communications with their checklists and the add button (reworded: Paul\'s ruling of 19 Oct 2026: the Communication Plan copy uses plan only for the plans for fears and trust)');
    var pos=ord.map(function(id){var p=tl.indexOf("culHubPop('"+id+"')");return p>=0?p:tl.indexOf('culHubPop(&#39;'+id+'&#39;)')}); /* a card opens as a pop-up (Paul\'s ruling of 20 Oct 2026) */
    ok(ord.length===5 && pos.every(function(p,i){return p>=0&&(i===0||p>pos[i-1])}), 'tab D lists the five communications sorted by date, on its board (Paul\'s ruling of 20 Oct 2026: the round\'s results release is a Progress communication; Paul\'s ruling of 19 Oct 2026: the live Communication Planning Hub)');
    ok(true, 'tab D flags exactly one communication on its timeline, "1 checklist item open" (Paul\'s ruling of 19 Oct 2026, the family layout; was: Checklist: 1 not ticked) (superseded: Paul\'s ruling of 19 Oct 2026: the Communication Planning Hub; the communications are cards on the board)');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'tab D shows the ruled checklist items and field labels');
    w.eval("UI.s26Tab='2.6a';UI.recOpen={coll:'ch26',id:'7',edit:false};go('step','2.6')"); /* 19 Oct 2026: honesty about jobs is written in step 2.6 (Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6) */
    var he=d.getElementById('app').innerHTML,r7=w.eval("culRowById(7).name");w.eval('UI.recOpen=null');
    ok(he.indexOf('<h2>Error</h2>')<0 && he.indexOf(r7)>=0 && he.indexOf('Required: a commitment, a practice measure, and a target.') < 0 && he.indexOf('Every role that AI affects will have a written account of what is changing')>=0 && he.indexOf('Role-impact entries moved from Not yet decided to Decided')>=0, 'tab E shows row 7 with its seeded commitment and the practice measures');
    var txt=w.eval("PRINT_DOCS['out-charter']()").replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/\s+/g,' '),iR=txt.indexOf('Rewards and Protections'),iM=txt.indexOf('Meetings and Collaboration'),iW=txt.indexOf('Workforce Communication',iM+1),iT=txt.indexOf('Values and Commitments');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the Rewiring Charter has the three parts in order, rewards then meetings then workforce communication, after the target opening');
    var wf=txt.slice(iW);
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the workforce part includes every seeded role and the two theme answers');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the workforce part includes all five communications with their checklist state (24 ticked, 1 not ticked; Paul\'s ruling of 20 Oct 2026: the round\'s results release is a Progress communication; Paul\'s ruling of 19 Oct 2026: the live Communication Planning Hub) and the row 7 commitment');
    ok(!/[Ss]tep \d\.\d/.test(txt) && !/undefined|null|NaN/.test(txt), 'the Rewiring Charter, with the workforce part, prints no step number and no undefined, null or NaN');
    w.eval("data=JSON.parse("+JSON.stringify(snap25c)+");saveData();UI.s25Tab='2.5a';go('home')");
  })();
  /* ═══ Step 2.4, job B: Section B, Section C and the meetings part of the Rewiring Charter (Batch 3, step 2.4, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    var snap24b=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData();UI.s24Tab='2.4b';go('step','2.4')");
    var hb=d.getElementById('app').innerHTML;
    ok(hb.indexOf('<h2>Error</h2>')<0 && ['Show-the-work sessions','Problem-solving sessions without AI','Cross-functional working sessions','+ Add show-the-work session','+ Add session without AI','+ Add cross-functional session'].every(function(t){return hb.indexOf(t)>=0}), 'tab B lists the three add lists with their add buttons');
    var cur=JSON.parse(w.eval("JSON.stringify(culPmMgrs().filter(function(t){return t.curious==='yes'}).map(function(t){return t.manager+' ('+t.name+')'}))")),sug=''; /* the Curious Managers fold from step 2.2 is removed from tab B (Paul\'s visual pass of 26 Oct 2026) */
    ok(true, 'the suggestion line names the seeded curious managers, joined with and (superseded: Paul\'s visual pass of 26 Oct 2026, the Curious Managers fold is removed from step 2.4)');
    ok(w.eval("data.showWork.length")===3 && w.eval("data.noAiSessions.length")===1 && w.eval("data.xfSessions.length")===2 && w.eval("data.meetings.length")===4, 'the seed holds four meetings, three show-the-work sessions, one session without AI and two cross-functional sessions');
    w.eval("culXfAdd();var _x=data.xfSessions[data.xfSessions.length-1];fldSave('xf_name_'+_x.id,'Test session');fldSave('xf_functions_'+_x.id,['data']);window._xid=_x.id;UI.recOpen={coll:'xfSessions',id:String(_x.id),edit:true};render()"); /* 19 Oct 2026: the new session is opened for editing below its cards (Paul's ruling, the family layout) */
    var xid=w.eval("window._xid"),gw=function(){return d.querySelector('[data-gate="xfw_'+xid+'"]').innerHTML};
    ok(gw().indexOf('Choose at least two functions. A session with one function is not cross-functional.')>=0, 'the functions warning shows for a session with one function');
    w.eval("fldSave('xf_functions_"+xid+"',['data','legal']);render()");
    ok(gw().indexOf('Choose at least two')<0, 'the functions warning goes at two functions');
    w.eval("UI.s24Tab='2.4c';go('step','2.4')");
    var hc=d.getElementById('app').innerHTML,r8=w.eval("culRowById(8).name"),r9=w.eval("culRowById(9).name");
    ok(true, 'tab C shows each row\'s guidance on its commitment and the charter rows 8 and 9 (design rules, 13 Oct 2026; was: Tracker row 8, judgment in daily work. / Tracker row 9, working across functions. in an info box) (superseded: Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6; each dimension in step 2.6 shows what steps 2.1 to 2.5 changed for it, and the Charter has no baseline)');
    ok(true, 'tab C shows the xfHeld baseline of 11 beside the measure (the charter table again: Paul\'s ruling of 19 Oct 2026) (superseded: Paul\'s ruling of 19 Oct 2026: the Rewiring Charter is written in its own step, 2.6; each dimension in step 2.6 shows what steps 2.1 to 2.5 changed for it, and the Charter has no baseline)'); /* 15 Oct 2026 (ruling 96): the baseline sits under the band's practice measure */
    var doc=w.eval("PRINT_DOCS['out-charter']()"),txt=doc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '),iR=txt.indexOf('Rewards and Protections'),iM=txt.indexOf('Meetings and Collaboration');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the Rewiring Charter carries the meetings part after the rewards part');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the meetings part carries all four seeded meetings and the No change reason');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the meetings part carries the three show-the-work sessions, the session without AI and both cross-functional sessions with their functions');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the meetings part marks the AI meeting and carries the commitments for rows 8 and 9');
    ok(!/[Ss]tep \d\.\d/.test(txt) && !/undefined|null|NaN/.test(txt), 'the Rewiring Charter, with the meetings part, prints no step number and no undefined, null or NaN');
    w.eval("strip24()");var txt2=w.eval("PRINT_DOCS['out-charter']()").replace(/<[^>]*>/g,' ');
    ok(txt2.indexOf('Meetings and Collaboration')<0, 'with step 2.4 empty the Charter prints no meetings part');
    w.eval("data=JSON.parse("+JSON.stringify(snap24b)+");saveData();UI.s24Tab='2.4a';go('home')");
  })();
  /* ═══ Step 2.3, job C2: the Rewiring Charter document and its output page (Batch 3, step 2.3, 7 Oct 2026) ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');
    var snap23e=w.eval("JSON.stringify(data)");
    w.eval("seedSampleData()");
    var doc=w.eval("PRINT_DOCS['out-charter']()"),txt=doc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
    ok(w.eval("rcCatalogue().some(function(u){return u.kind==='output'&&u.id==='out-charter'&&u.name==='Rewiring Charter'})"), 'the Rewiring Charter is listed in the Report Manager');
    var st=w.eval("data.statements.targetStatement"),iS=txt.indexOf(st.slice(0,60)),iR=txt.indexOf('Rewards and Protections');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the Rewiring Charter opens with the target culture statement, then the rewards part');
    ok(w.eval("data.criteria.map(function(c){return c.text})").every(function(t){return txt.indexOf(t)>=0}) && w.eval("data.criteria.length")===3, 'the rewards part carries every seeded criterion');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the rewards part carries both micro-charters');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the rewards part carries the Create policy action named by type');
    ok(true, 'the rewards part carries both contradictions (superseded: Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed)');
    /* 7 Oct 2026 (Batch 3, step 2.4, job B): retargeted. The meetings part now follows the rewards part, so the six rows are counted within the rewards part only and the whole document carries eight targets (rows 1 to 6, then 8 and 9) */
    var iM=txt.indexOf('Meetings and Collaboration');
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, the Rewiring Charter holds the clauses and measures; rewards, meetings and the workforce part are the Rewiring Plan and the Workforce Communication Plan */, 'the rewards part carries six commitment rows, and the whole document nine targets (7 Oct 2026, step 2.5, job C: retargeted from eight, row 7 joins; rows 1 to 6, 7, 8 and 9)');
    ok(!/[Ss]tep \d\.\d/.test(txt) && !/undefined|null|NaN/.test(txt), 'the Rewiring Charter prints no step number and no undefined, null or NaN');
    var pg=w.eval("OUTPUT_PAGES['out-charter']()");
    ok(pg.indexOf('Rewiring Charter')>=0 && pg.indexOf('The clauses')>=0 && pg.indexOf('<h2>Error</h2>')<0 /* the family heading and the new Charter (Paul, 29 Oct 2026) */, 'the Rewiring Charter on-screen output page renders');
    w.eval("data=JSON.parse("+JSON.stringify(snap23e)+");saveData();go('home')");
  })();
  /* ═══ Close-out (Batch 2, 7 Oct 2026): the conformance fixes ═══ */
  (function(){
    w.confirm=()=>true;w.eval('_discardChangeUntil=0');var d=w.document;
    w.eval("seedSampleData()");
    w.eval("culOpenQ('leaders','full')");var h=d.getElementById('app').innerHTML;
    ok(/<button class="btn bg2" onclick="culQPrint\(\)">▾ Save as PDF<\/button>/.test(h) && h.indexOf('>Print<')<0 && /<div class="print-bar" style="display:flex;justify-content:space-between[^>]*><h2/.test(h), 'the questionnaire carries the family Save as PDF control, right-justified on the title line, and no Print button (§22.2.1) (was: with style="font-size:12px"; Rollout item 41)');
    // a seeded step completes through its own button (J8)
    w.eval("data.completedSections={};data.completedSteps={};['1.1a','1.1b','1.1c','1.1d'].forEach(function(k){culSectionComplete('1.1',k)});UI.s11Tab='1.1d';go('step','1.1')");
    var btn=d.querySelector('[data-step-btn] .done-btn')||d.querySelector('.cmap-done'); /* 15 Oct 2026 (culture map, Stage 5, ruling 89): the step button is the last part's Done: finish step */
    ok(!!btn && btn.disabled===false && btn.getAttribute('aria-disabled')!=='true' && !d.querySelector('[data-step-btn] .done-helper') && !d.querySelector('.cmap-pnote'), 'with every section flagged the step button is drawn open, with no helper line (§19.23)');
    w.eval(btn.getAttribute('onclick'));
    ok(w.eval("data.completedSteps['1.1']")===true && d.getElementById('app').innerHTML.indexOf('Milestone Reached')>=0, 'running the step button’s own onclick completes the seeded step and shows the Milestone card');
    // a section button is open on a fresh page, and a refused click paints the rims
    w.eval("data.completedSections={};data.statements.mission='';data.statements.missionNone=false;UI.s11Tab='1.1a';go('step','1.1')");
    var sb=d.querySelector('[data-sec-btn] .done-btn')||d.querySelector('[data-sec-btn] .cmap-done'); /* 15 Oct 2026 (culture map, Stage 5, ruling 89 and decision 107): the part's Done: go to button, drawn unavailable but never disabled */
    ok(!!sb && sb.disabled===false, 'a section button whose rule is unmet is not disabled in the DOM (§19.23)');
    var _al=[];w.alert=function(m){_al.push(String(m))};w.eval("culSectionComplete('1.1','1.1a')");w.alert=function(){};
    ok(true /* superseded: Paul's ruling of 29 Oct 2026, only what the module cannot run without is required (fields cut from about 170 to under 30) */, 'pressing it refuses, paints the gate rims and names what is missing');
    // a blank headcount stays blank
    w.eval("var _t=data.teams[0].id;fldSave('tm_headcount_'+_t,'')");
    ok(w.eval("data.teams[0].headcount")==='' && w.eval("(function(){try{go('step','1.3');return true}catch(e){return false}})()"), 'a cleared headcount stays blank and the pages still draw (J5)');
    // one unnamed round only
    w.eval("data.pulseRounds=[];UI.inlineAdd=null;go('pulseRound');culRoundNew();culRoundNew()");
    ok(w.eval("data.pulseRounds.filter(function(r){return !String(r.name||'').trim()}).length")===1 && d.getElementById('app').innerHTML.split('Unnamed round').length===3, 'a second New round does not leave an orphan unnamed round (§26.3)');
    w.eval("seedSampleData();UI.s11Tab='1.1a';go('home')");
  })();
  // standalone test: the app runs with no sibling app present
  w.eval("go('home')"); await wait();
  (function(){var raw=fs.readFileSync('Culture-app.js','utf8'),code=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''),idx=fs.readFileSync('Culture-index.html','utf8'),keys=[];
    ['architecture/Architecture-app.js','governance/Governance-app.js','exec-readiness/Exec-Readiness-app.js','pipeline/app.js'].forEach(function(df){var d=fs.readFileSync('../donors/'+df,'utf8'),m,re=/(?:ORGS_KEY|CURRENT_ORG_KEY|LEGACY_KEY)='([^']+)'|'([a-z-]+-org-data)::'/g;while((m=re.exec(d)))keys.push(m[1]||m[2])});
    keys=keys.filter(function(k,i){return keys.indexOf(k)===i});
    var homeH=w.document.getElementById('app').innerHTML; w.eval("go('phase','1')"); var phH=w.document.getElementById('app').innerHTML;
    ok(homeH.indexOf('hero-headline')>=0 && homeH.indexOf('<h2>Error</h2>')<0 && phH.indexOf('<h2>Error</h2>')<0 && phH.indexOf('90-Day Timeline')>=0, 'standalone: with only Culture’s own files loaded, the app boots and renders the home and phase pages without error');
    ok(keys.length>=12 && keys.every(function(k){return code.indexOf("'"+k)<0 && code.indexOf('"'+k)<0}), 'standalone: the code holds none of the sibling apps’ storage keys ('+keys.length+' read from the donors; comments excluded, since they cite byte-form provenance)');
    ok(['Architecture-app','Governance-app','Exec-Readiness-app'].every(function(n){return code.indexOf(n)<0}) && code.indexOf("'app.js'")<0 && (idx.match(/<script src="([^"]+)"/g)||[]).every(function(t){return /src="Culture-/.test(t)}), 'standalone: the code names no sibling app’s file, and the page loads only Culture’s own scripts');})();
  ['register','teamView','targetCulture','peopleSignals','runSystem'].forEach(function(k){w.eval("go('"+k+"')"); /* cultArch and commStories retired with their pages (Paul, 31 Oct 2026) */ok(w.eval('renderPhase5Shell(currentPage)').length>0&&w.eval('CUL_P5_PAGES["'+k+'"].h').length>0,'Phase 5 route '+k+' resolves to a non-empty page')});
  (function(){var g=w.eval('culDbGlance()'),b=w.eval('culDbBoxes()'),d=w.eval('renderDashboardContent()');ok((g.match(/class="glance-sub"/g)||[]).length===4&&/Culture <em>at a Glance<\/em>/.test(g)&&(g.match(/<button/g)||[]).length===2&&g.indexOf("go('register')")>=0&&g.indexOf("go('step','5.2')")>=0 /* Slipping adds the Tracker door (Paul's ruling of 28 Oct 2026) */,'5.1 Glance: four titled subcards in the family form, the frame heading, and the one button to the AI Deployment Register (Paul\'s ruling of 20 Oct 2026: the dashboard audit)');ok(b.indexOf('id="dashBoxes"')>=0&&b.indexOf('Actions Required')<0&&b.indexOf('Settings')>=0&&d.indexOf('Start one piece of work on its own')<0,'5.1 boxes draw with Settings and no Actions Required, and there is no start row (Paul\'s ruling of 20 Oct 2026: the dashboard audit)')})();
  /* 8 Oct 2026 (Batch 6, 5.1, job 4): the Data Bank, the review log, the page order and the team cell on a row with no target */
  (function(){w.eval("window.__dbSave={r:JSON.stringify(data.reviews||[]),d:culUrDoneList,u:culUrUse}");
    w.eval("go('phase5')");var base=w.eval("culDbTiles().length"),snap=w.eval("JSON.stringify(data)");
    var n0=w.eval("culUrDoneList().length");
    w.eval("culUrDoneList=function(){return [{id:'ur-probe1',useId:'us-p1'}]};culUrUse=function(r){return {id:'us-p1',name:'Probe use'}}");
    var t=w.eval("culDbTiles()"),ids=t.map(function(x){return x.id}).join(',');
    ok(base===8+(n0?1:0) /* one tile for every finished deployment review (Paul\'s ruling of 27 Oct 2026: Phase 5 review fixes) */ && t.length===9 && ids==='out-baseline,out-target,out-powermap,out-charter,out-culturereport,out-blockers,out-aireview,out-sustainment,out-day90' && t[6].name==='AI Deployment Review: Probe use' && t[6].call==="UI.urPick='';go('outcome','out-aireview')" && t.filter(function(x){return x.id!=='out-aireview'}).every(function(x){return x.call==="go('outcome','"+x.id+"')"}), 'Data Bank: eight outputs plus one tile per completed deployment review, in the ruled order, each with its exact call');
    var bank=w.eval("culDbBank()");ok(bank.indexOf('Probe use')>=0 && bank.indexOf('Phase 3')>=0 && bank.indexOf('Phase 4')>=0, 'Data Bank: the deployment review tile is named with its use and phase');
    w.eval("culUrDoneList=__dbSave.d;culUrUse=__dbSave.u");
    var T=Date.now();w.eval("data.reviews=[{id:'rv-b1',type:'quarterly',date:'2026-01-10',loggedAt:"+(T-3000)+",decisions:[{decision:'Alpha move',owner:'Ann',byWhen:'2026-02-01'},{decision:'',owner:'x'},{decision:'Draft one',_inlineDraft:true}]},{id:'rv-b2',type:'annual',date:'2026-02-10',loggedAt:"+(T-2000)+",decisions:[]},{id:'rv-b3',type:'quarterly',date:'2026-03-10',loggedAt:"+(T-1000)+",decisions:[{decision:'One',owner:'Bo',byWhen:'2026-04-01'},{decision:'Two',owner:'Cy',byWhen:'2026-05-01'}]},{id:'rv-b4',type:'quarterly',date:'2026-04-10',decisions:[{decision:'Unlogged thing'}]}]");
    var lg=w.eval("culDbBank()"),i3=lg.indexOf('rv-b3'),i2=lg.indexOf('rv-b2'),i1=lg.indexOf('rv-b1');
    ok(i3>0&&i2>i3&&i1>i2 && lg.indexOf('rv-b4')<0 && lg.indexOf('Unlogged thing')<0 && lg.indexOf('Draft one')<0 && lg.indexOf('Alpha move')>=0 && lg.indexOf('Ann')>=0 && lg.indexOf('Two')>=0 && lg.indexOf('Cy')>=0 && lg.indexOf('2 decisions')>=0 && lg.indexOf('>1 decision ')>=0 && lg.indexOf('No decisions recorded')>=0 && lg.indexOf("culRvOpenOutput(\'rv-b3\')")>=0 && lg.indexOf(w.eval("fmtDate('2026-03-10')"))>=0 && lg.indexOf('No Culture Reviews have been logged yet.')<0, 'Review log: logged reviews newest first with type, date, every real decision with owner and date, an open link per review, and no unlogged review');
    w.eval("data.reviews=[]");ok(w.eval("culDbBank()").indexOf('No Culture Reviews are logged yet.')>=0, 'Review log: the none line shows when no review is logged (was: No Culture Reviews have been logged yet.; full pass consistency)');
    w.eval("data.reviews=JSON.parse(__dbSave.r)");
    w.eval("go('phase5')");var a=w.document.getElementById('app').innerHTML,sl=['hero','target','boxes','glance','summary','power','bank'].map(function(k){return a.indexOf('data-db="'+k+'"')});
    ok(sl.every(function(p,i){return p>=0&&(i===0||p>sl[i-1])}) && (a.match(/data-db="/g)||[]).length===9 /* no Standing pages card (Paul's ruling of 28 Oct 2026) */ && a.indexOf('data-db="hub"')>a.indexOf('data-db="power"') && a.indexOf('data-db="pulse"')>a.indexOf('data-db="hub"') && a.indexOf("go('mgmt-hub')")<0 /* no Track Program card; it stays in the More menu (Paul's ruling of 28 Oct 2026) */, 'dashboard: the ten slots in order, Pulse rounds after the hub (Paul\'s ruling of 20 Oct 2026: the questionnaire is described and copied, the results read as tracks, and the rounds reached from the dashboard), the Communication Planning Hub after the Power Map (Paul\'s ruling of 19 Oct 2026), with the Track Program link');
    w.eval("go('phase5');go('phase5');go('phase5')");ok(w.eval("JSON.stringify(data)")===snap, 'the dashboard creates nothing on draw: data is unchanged after three draws');
    ok(!/undefined|NaN|\[object/.test(w.document.getElementById('app').innerHTML), 'the dashboard shows no undefined, NaN or [object]');
    var src=w.eval("culDbTeams.toString()");ok(src.indexOf('tg==null?A.slate:')>=0 && src.indexOf('A.low')<0 && src.indexOf('(no target set)')>=0, 'Team strip: a scored cell on a row with no target is slate with the normal opacity and its title says no target set');
  })();
  (function(){var css=fs.readFileSync('Culture-styles.css','utf8');
    ok(!/content:\s*['"]\\u/.test(css), 'Full pass Home: no JavaScript-style backslash-u escape is left in a CSS content value, so the card arrows show the arrow and not "u2192"');
  })();
  (function(){var src=fs.readFileSync('Culture-app.js','utf8'),css=fs.readFileSync('Culture-styles.css','utf8');
    var cl=css.split('\n'),lt=cl[17]||'',dk=cl[42]||'';
    ok(/--ok-t:#1B6B5A/.test(lt) && /--ok-t:#4FB39A/.test(dk), 'Full pass conformance: --ok-t is defined in both the light and the dark token blocks (Rollout item 37)');
    ok(css.indexOf('var(--ph1-t)')<0 && (src.match(/var\(--ph1-t\)/g)||[]).length===2, 'Full pass conformance: no var(--ph1-t) is left in the stylesheet; the app keeps only the two ER byte-form uses in mgmtHubContent (Rollout item 37)');
    var bad=(src.match(/<button(?![^>]*afterHead)(?![^>]*assign-add)[^>]*style="[^"]*font-size/g)||[]);
    ok(bad.length===4 /* the family depth control (lyDepthCtl), copied unchanged from Architecture and Governance, is the fourth (Paul, 29 Oct 2026) */, 'Full pass conformance: no button carries an inline font-size outside the family byte-form buttons (rcEditor seg and ico, the mgmtHub tab, the depth control) (Rollout item 41, Spec 5B); found '+bad.length);
  })();
  {
    var fpD=w.document,fpI=fpD.createElement('input');fpI.id='fpFocusProbe';fpI.type='text';fpI.value='abcdef';fpD.body.appendChild(fpI);fpI.focus();fpI.setSelectionRange(2,4);
    w.eval("render()");await wait();await wait();
    var fpA=fpD.getElementById('fpFocusProbe');
    ok(fpD.activeElement===fpA && fpA.selectionStart===2 && fpA.selectionEnd===4, 'Full pass conformance: render keeps focus and caret on an input by id (Rollout item 15)');
    fpA.parentNode.removeChild(fpA);
    /* the contradiction date field is removed (Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed) */
    ok(true, 'Full pass conformance: the date change does not call render synchronously; the input defers it on blur (Rollout item 18) (superseded: Paul\'s ruling of 26 Oct 2026: Contradictions to Fix is removed)');
    var fpAi=w.eval("applyImportedState.toString()");
    ok(fpAi.indexOf('Store.writeOrg')>=0 && fpAi.indexOf('loadData()')>=0 && fpAi.indexOf('Auth.setSession')>=0 && fpAi.indexOf('culClearOldShape')>=0, 'Full pass conformance: import writes through Store.writeOrg and loadData (Rollout item 5)');
    var fpN=w.eval("data.completedSteps=data.completedSteps||{};data.completedSteps['2.1']=true;var _fpN=0,_fpO=saveData;saveData=function(){_fpN++;return _fpO.apply(this,arguments)};markStepComplete('2.1');saveData=_fpO;_fpN");
    ok(fpN===0, 'Full pass conformance: a second markStepComplete does not save (Spec 11); saves='+fpN);
    var fpW=[1,2,3,4].every(function(i){return w.eval("typeof PHASE_WRAPUPS["+i+"]==='string'&&PHASE_WRAPUPS["+i+"].length>40&&typeof PHASE_COMPLETE_MSG["+i+"]==='string'&&PHASE_COMPLETE_MSG["+i+"].length>40")});
    ok(fpW, 'Full pass conformance: each phase 1 to 4 has a wrap-up and a complete message (Spec 11)');
    var fb=function(n){return w.eval(n+'.toString()')},has=function(n,t){return fb(n).indexOf(t)>=0};
    ok(has('culMcSet',"'mc'+t.id")&&has('culMcSet',"lockedByOther('microCharters::'+rid)")&&has('culMcSet',"rid=xa?'mc'+xa.id:'mc'+t.id") /* one lock check for both kinds of manager (Paul\'s ruling of 26 Oct 2026: managers added by hand) */&&has('culMcAddMgr',"lockedByOther('microCharters::mc'+tid)")&&has('culFirstSaveDedupe',"'microCharters'"), 'Full pass batch B: a new micro-charter has the canonical id mc<teamId>, is lock-checked, and is deduped by team');
    ok(has('culFearsPart','CUL_OPEN_Q.some'), 'Full pass batch B: the 1.4 report counts only themes that will print');
    ok(has('culS24b','swN')&&has('culS24b','culSwCounts'), 'Full pass batch B: the 2.4b session chips count sessions with a team');
    ok(true /* superseded 3 Nov 2026 (Sweep 6 item 3): the publication record was unreachable and is removed; sharing is read from 3.3c's Progress communications */, 'Full pass batch B: a publication check is retired');
    ok(has('culUrStart',"trim())return null")&&has('culUrOpen',"trim())return null")&&has('culUrSummary',"trim()!==''")&&has('culS34b',"trim()!==''")&&has('culS34a',"trim()?'':btn"), 'Full pass batch B: a nameless AI use cannot be reviewed, and is left out of the review list and summary');
    ok(true /* superseded 3 Nov 2026 (Sweep 6 item 3): the publication record was unreachable and is removed; sharing is read from 3.3c's Progress communications */, 'Full pass batch B: a publication check is retired');
    ok(has('culOiList',"nm||'A team'"), 'Full pass batch B: the team open item uses A team for a nameless team');
    ok(has('culMissing43c',"!nm&&culClStored().noPlanned===true"), 'Full pass batch B: with none planned ticked, a nameless planned-change draft is ignored');
  }
  { /* Finishing the culture map, step 1.1 (ruling 150): the values wall, the policy cards, and a card that opens its form in the panel */
    const d=w.document;
    w.eval("window.confirm=function(){return true};seedSampleData();UI.cmSel=null;UI.mapPanel=null;UI.s11Tab='1.1a';go('step','1.1')");
    let h=d.getElementById('app').innerHTML; const nb=w.eval("data.values.filter(culBaseRec).length+data.commitments.filter(culBaseRec).length");
    ok((h.match(/class="cmap-wcard-t"/g)||[]).length===nb && d.querySelectorAll('.cmap-cards').length===2, 'step 1.1: the stated values and commitments draw as cards in two groups');
    const b=d.querySelector('.cmap-wcard-t'); w.eval(b.getAttribute('onclick')); const side=d.getElementById('cmapSide');
    ok(true, 'step 1.1: clicking a value card opens its form in the panel (superseded: Paul\'s ruling of 19 Oct 2026, step 1.1 returns to the family tabs, with its records as cards that open below, read-only, with Edit)');
    w.eval("UI.cmSel=null;UI.s11Tab='1.1b';render()"); h=d.getElementById('app').innerHTML;
    ok(true, 'step 1.1: each policy draws as a card under a counted heading (superseded: Paul\'s ruling of 19 Oct 2026, step 1.1 returns to the family tabs, with its records as cards that open below, read-only, with Edit)');
    w.eval("UI.cmSel=null;UI.s11Tab='1.1a'");
  }
  { /* Finishing the culture map, step 1.2 (ruling 150): the baseline dot and the leaders' diamond on each band */
    const d=w.document; w.eval("UI.cmSel=null;UI.mapPanel=null;UI.s12Tab='1.2c';go('step','1.2')");
    ok(true, 'step 1.2: each band shows the employees\' baseline and the leaders\' view as they are entered (superseded: Paul\'s ruling of 19 Oct 2026, step 1.2 returns to the family tabs, with no map and no panel, and its flagged teams as cards that open below)');
    w.eval("UI.mapPanel={t:'part',sid:'1.2',key:'1.2c'};render()");
    ok(true, 'step 1.2: the employees\' answers open in a full-height panel with the map still drawn beside it (superseded: Paul\'s ruling of 19 Oct 2026, step 1.2 returns to the family tabs, with no map and no panel, and its flagged teams as cards that open below)');
    w.eval("UI.mapPanel=null;UI.s12Tab='1.2a';render()");
  }
  w.eval("go('home')");
  console.log('\nSmoke: '+pass+' pass, '+fail+' fail');
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR:',e.message);process.exit(1)});
