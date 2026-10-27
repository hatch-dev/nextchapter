#!/usr/bin/env node
/* -------------------------------------------------------------
   exec-readiness-accept.js - the 20 acceptance checks of the
   16 Sep 2026 Executive Readiness directive, in a real browser
   -------------------------------------------------------------
   The two suites that ship in the dev folder are the PRE-directive
   ones. The directive replaces a great deal of markup, so those
   suites' exact-count assertions ("nine sites", "fifteen Save as
   PDF surfaces") now disagree with the code by design, and neither
   suite knows anything about printed documents or the Report
   Manager. The directive ships updated suites; they did not arrive
   with it. This stands in for them.

   Everything printed here goes through window.open() +
   document.write(), so the check STUBS window.open and keeps what
   was written, which is the printed document's markup exactly as
   the print window would receive it. Nothing opens, nothing prints.

   Chrome over the DevTools Protocol, no puppeteer - Node's global
   WebSocket is enough. Run the dev build from Apache first:
   http://localhost/apps/enterprises/dev/executive-readiness-prototype/

     node tools/exec-readiness-accept.js
   ------------------------------------------------------------- */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const URL_APP = process.env.ER_URL || 'http://localhost/apps/enterprises/dev/executive-readiness-prototype/index.html';
const PORT = 9344;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(require('os').tmpdir(), 'er-accept-profile');

const log = [];
const say = s => { log.push(s); };
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; say('  ok   ' + label); }
  else { fail++; say('  FAIL ' + label); }
}
process.on('exit', () => {
  const out = log.join('\n') + '\n\nPASS: ' + pass + '  FAIL: ' + fail + '\n';
  fs.writeFileSync(path.join(__dirname, '_er-accept.log'), out);
  process.stdout.write(out);
});

const get = url => new Promise((res, rej) => {
  http.get(url, { headers: { Host: '127.0.0.1:' + PORT } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});

(async function main() {
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*',
    '--window-size=1600,1200', '--user-data-dir=' + PROFILE, 'about:blank'],
    { stdio: 'ignore' });

  let list = null;
  for (let i = 0; i < 40 && !list; i++) {
    await new Promise(r => setTimeout(r, 400));
    try { list = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json/list')); } catch (e) { }
  }
  if (!list) throw new Error('chrome did not come up on ' + PORT);
  const page = list.find(t => t.type === 'page');
  /* Chrome echoes the request Host into the debugger url, so a Host of
     localhost yields a portless ws:// that never connects - and the
     process then exits 0 with no output. Force the port back in. */
  const wsUrl = page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+\//, 'ws://127.0.0.1:' + PORT + '/');

  const ws = new WebSocket(wsUrl);
  ws.addEventListener('error', e => { say('websocket error: ' + e.message); });
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 0; const waiting = new Map(); const errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
  });
  const send = (method, params) => new Promise(res => {
    const i = ++id; waiting.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result && r.result.result && r.result.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  await send('Page.navigate', { url: URL_APP });
  await new Promise(r => setTimeout(r, 2500));

  /* -- sign in and load the example data ---------------------- */
  say('== setup ==');
  const setup = await evalJs(`(function(){
    try{
      localStorage.clear();
      // A fresh org, an owner, then the example data.
      if(typeof createOrg==='function'){ }
      return 'cleared';
    }catch(e){return 'ERR '+e.message}
  })()`);
  await send('Page.navigate', { url: URL_APP });
  await new Promise(r => setTimeout(r, 2500));

  const booted = await evalJs(`(function(){
    return {
      hasSeed: typeof seedData==='function',
      hasReports: typeof renderReports==='function',
      hasPrintDoc: typeof printDocument==='function',
      hasLayerMaps: (typeof LAYER_MAPS==='object') && Object.keys(LAYER_MAPS||{}).length,
      page: typeof currentPage!=='undefined'?currentPage:null
    };
  })()`);
  say('  boot: ' + JSON.stringify(booted));
  ok(booted.hasSeed && booted.hasReports && booted.hasPrintDoc, 'the app boots with renderReports and printDocument defined');
  ok(booted.hasLayerMaps >= 3, 'LAYER_MAPS is populated (' + booted.hasLayerMaps + ' record types) - the reporting engine has its maps');

  /* Sign in through the entry flow, then seed. confirm() is stubbed
     because seedData asks before overwriting. */
  const signed = await evalJs(`(function(){
    try{
      window.confirm=function(){return true};
      window.alert=function(){};
      if(typeof getOrgs==='function' && getOrgs().length===0){
        if(typeof createOrg==='function'){
          createOrg('Aurora Windows','Owner','owner','1234');
        }
      }
      if(typeof Auth!=='undefined' && typeof USERS!=='undefined' && USERS.length){
        Auth.setSession(USERS[0].id); UI.entry=null;
      }
      seedData();
      if(typeof USERS!=='undefined' && USERS.length){ Auth.setSession((USERS.find(function(u){return u.admin})||USERS[0]).id); UI.entry=null; }
      render();
      return {users:(typeof USERS!=='undefined'?USERS.length:0), leaders:((data.leaders||[]).length), org:(typeof currentOrgId!=='undefined'?!!currentOrgId:false)};
    }catch(e){return 'ERR '+e.message+' | '+e.stack.split('\\n')[1]}
  })()`);
  say('  signin/seed: ' + JSON.stringify(signed));
  ok(signed && signed.leaders === 13, 'the example data loads Aurora Windows with thirteen leaders (got ' + (signed && signed.leaders) + ')');

  /* -- the print-window stub ---------------------------------- */
  await evalJs(`(function(){
    window.__docs={};
    window.__lastDoc='';
    window.open=function(){
      var buf='';
      var d={
        write:function(s){buf+=s},
        close:function(){window.__lastDoc=buf},
        title:''
      };
      return {document:d, print:function(){}, focus:function(){}, close:function(){}, onload:null,
              get __buf(){return buf}};
    };
  })()`);

  /* Drive one document and hand back its markup. */
  const printDoc = async (expr) => {
    const r = await evalJs(`(function(){
      try{ window.__lastDoc=''; ${expr}; return window.__lastDoc.length; }
      catch(e){ return 'ERR '+e.message }
    })()`);
    if (typeof r === 'string') return { err: r, html: '' };
    const html = await evalJs('window.__lastDoc');
    return { err: null, html: html || '' };
  };

  /* -- checks 1-10: an output page prints a document ----------- */
  say('\n== printed documents (checks 1-10) ==');
  const OUTPUTS = [
    ['out-rhythm', 'Operating Rhythm', 1],
    ['out-inventory', 'Leadership Inventory', 2],
    ['out-readiness', 'Readiness Report', 3],
    ['out-riskmap', 'Risk Map', 3],
    ['out-competency', 'Competency Framework', 4],
    ['out-fluency', 'Fluency Assessment', 5],
    ['out-review', 'Review Report', 6],
    ['out-structure', 'Leadership Structure', 7],
    ['out-collab', 'Collaboration Principles', 7],
    ['out-decisions', 'Decision Analyses', 8],
    ['out-mmprinciples', 'MM Principles', 9],
    ['out-values', 'Values Architecture', 10],
    ['out-evalplan', 'Evaluation Plan', 7]
  ];
  const docs = {};
  for (const [id, title, check] of OUTPUTS) {
    const r = await printDoc(`go('outcome','${id}'); UI.outcome='${id}'; currentOutcome='${id}'; printCurrentOutput('${id}')`);
    docs[id] = r.html;
    if (r.err) { ok(false, `[${check}] ${title}: ${r.err}`); continue; }
    const h = r.html;
    ok(h.length > 800, `[${check}] ${title} prints a document (${h.length} bytes)`);
    /* The source reads "NextChapter \u00b7 90-Day Executive Readiness"; the page
       shows it in capitals through text-transform, so match the source. */
    ok(/NextChapter/i.test(h) && /90-Day Executive Readiness/i.test(h),
      `[${check}] ${title}: the first page carries the NextChapter \u00b7 90-Day Executive Readiness line`);
    ok(h.indexOf('\u00a9 2026 Next Chapter, LLC. All rights reserved.') >= 0,
      `[${check}] ${title}: the copyright footer is on the page`);
    ok(h.indexOf('Aurora Windows') >= 0, `[${check}] ${title}: the organization's name is on the first page`);
    ok(!/<button/i.test(h), `[${check}] ${title}: no control prints`);
  }

  /* particulars the directive calls out */
  say('\n== particulars ==');
  const inv = docs['out-inventory'] || '';
  ok(/Org Chart/i.test(inv) && /<svg/i.test(inv), '[2] the Inventory prints the org chart');
  ok(/At a Glance/i.test(inv), '[2] the Inventory prints At a Glance');
  ok(/The Leaders/i.test(inv), '[2] the Inventory prints The Leaders');
  ok(/The Landscape/i.test(inv), '[2] the Inventory prints The Landscape');
  ok(/landscape/i.test(inv), '[2] the Inventory has a landscape page for the chart');

  const comp = docs['out-competency'] || '';
  ok(/Development Priorities/i.test(comp), '[4] the Competency Framework prints Development Priorities');
  ok(/\/ 5/.test(comp), '[4] each competency score prints on one line (n / 5)');

  const flu = docs['out-fluency'] || '';
  ok(/The Team Project/i.test(flu), '[5] the Fluency Assessment prints The Team Project');
  ok(/Individual Fluency Sprints/i.test(flu), '[5] the Fluency Assessment starts the leaders on Individual Fluency Sprints');
  ok(/Task 1/.test(flu) && /Task 2/.test(flu) && /Task 3/.test(flu), '[5] each leader prints Task 1, Task 2 and Task 3');

  const rev = docs['out-review'] || '';
  ok(/Structural Review/i.test(rev), '[6] the Review Report prints the Structural Review');
  ok(/Working Well/i.test(rev) && /Needs Revision/i.test(rev), '[6] Working Well and Needs Revision both print');
  ok(/Individual Leader Reviews/i.test(rev), '[6] the Review Report starts a page of Individual Leader Reviews');
  ok(/Developed/.test(rev) && /Progressing/.test(rev) && /Needs Support/.test(rev) && /Hard Conversation/.test(rev),
    '[6] the four counts print');

  const dec = docs['out-decisions'] || '';
  ok(/The Four Scenarios/i.test(dec), '[8] the Decision Analyses prints The Four Scenarios');
  ok(/Our response/i.test(dec) && /pre-mortem/i.test(dec), '[8] each scenario prints Our response and the ethical pre-mortem');

  const mm = docs['out-mmprinciples'] || '';
  ok(/Three Categories/i.test(mm), '[9] MM Principles prints The Three Categories');
  ok(/AI-Augmented Workflows/i.test(mm), '[9] MM Principles prints AI-Augmented Workflows');
  ok(/Decisions That Stay Human/i.test(mm), '[9] MM Principles prints Decisions That Stay Human');

  const val = docs['out-values'] || '';
  ok(/Philosophical Commitments/i.test(val), '[10] the Values Architecture prints Our Philosophical Commitments');
  ok(/AI Purpose Filter/i.test(val), '[10] the Values Architecture prints the AI Purpose Filter');
  /* Summary / Full is one global, UI.printDepth, read by lyDepthCtl.
     printCurrentOutput() takes no argument - it prints whatever
     currentStep names - so that has to be set, not passed. */
  const valFull = (await printDoc(`currentStep='out-values'; UI.printDepth='full'; printCurrentOutput(); UI.printDepth='summary'`)).html;
  ok(/Appendix/i.test(valFull), '[10] at Full the Values Architecture adds an Appendix');

  /* -- check 1 (page furniture) and 12 (the org chart) --------- */
  say('\n== page furniture and the org chart (checks 1, 12) ==');
  const rhythm = docs['out-rhythm'] || '';
  ok(/@top-left\{content:""\}/.test(rhythm.replace(/\s+/g, '')),
    '[1] nothing prints at the top-left corner');
  ok(/counter\(page\)/.test(rhythm), '[1] a page number prints (counter(page))');
  /* only a document that HAS a sideways page declares one - the
     Operating Rhythm has none, the Inventory's chart page does. */
  ok(/size:landscape/.test(docs['out-inventory'] || ''),
    '[2] the Inventory declares the landscape page its chart prints on');

  const chart = await evalJs(`(function(){
    try{
      /* the screen chart's own budget is 22 characters (orgNameLines(r.name,22)) */
      var lines=orgNameLines('Chief Innovation & Transformation Officer',22);
      /* step 1.2 draws through reportingChartAndControls */
      currentPage='step'; currentStep='1.2'; render();
      var h=reportingChartAndControls(data.orgChart||[],data.leaders||[])||'';
      return {
        lines:lines, twoLines:lines.length===2 && !!lines[1],
        noEllipsis: lines.join('').indexOf('\\u2026')<0,
        dashed: /stroke-dasharray/.test(h),
        svg: /<svg/.test(h),
        council: /Council/i.test(h)
      };
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  chart: ' + JSON.stringify(chart));
  ok(chart && chart.svg, '[12] step 1.2 draws the org chart');
  ok(chart && chart.twoLines && chart.noEllipsis,
    '[12] a long role title takes two lines with no ellipsis (' + (chart && JSON.stringify(chart.lines)) + ')');
  ok(chart && chart.council && chart.dashed, '[12] the AI Transformation Council box has a dashed border');

  /* -- check 11: the sidebar Outputs fold --------------------- */
  say('\n== sidebar (check 11) ==');
  const sb = await evalJs(`(function(){
    try{ go('step','1.1'); render();
      var s=document.getElementById('pipSidebar').innerHTML||'';
      /* the fold reads: ▸ Outputs <span style=..>(3)</span> - the count
         sits in its own span, so match the fold's class, not "Outputs (". */
      return {outputs:(s.match(/sidebar-outcomes-fold/g)||[]).length, toggle: typeof toggleNavOutputs==='function'};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  sidebar: ' + JSON.stringify(sb));
  ok(sb && sb.outputs >= 4, '[11] every phase shows an Outputs (n) fold in the sidebar (' + (sb && sb.outputs) + ')');

  /* -- checks 13-16: the Phase 5 pages ------------------------ */
  say('\n== Phase 5 (checks 13-16) ==');
  const dash = await printDoc(`go('phase5','5.1'); currentStep='5.1'; printCurrentPage()`);
  ok(!dash.err && dash.html.length > 800, '[14] the Leadership Dashboard prints a document' + (dash.err || ''));
  ok(/Leadership Structure/i.test(dash.html), '[14] the dashboard document is titled Leadership Structure');
  ok(/Org Chart/i.test(dash.html), '[14] the dashboard document has its Org Chart page');
  ok(/Appendix/i.test(dash.html) && /Competency Summary/i.test(dash.html), '[14] the dashboard document ends with the Appendix and Competency Summary');

  const toolbar = await evalJs(`(function(){
    try{ go('phase5','5.1'); currentStep='5.1'; render();
      var h=document.getElementById('app').innerHTML||'';
      return {addRole:/Add Role/.test(h), addLeader:/Add New Leader/.test(h),
              summary:/>Summary</i.test(h), full:/>Full</i.test(h),
              savePdf:/Save as PDF/.test(h), printOrgChartBtn:/Print Org Chart/.test(h)};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  toolbar: ' + JSON.stringify(toolbar));
  ok(toolbar && toolbar.addRole && toolbar.addLeader && toolbar.summary && toolbar.full && toolbar.savePdf,
    '[13] the dashboard toolbar reads Add Role, Add New Leader, Save, SUMMARY, FULL, Save as PDF');
  ok(toolbar && toolbar.printOrgChartBtn === false, '[13] the Print Org Chart button is gone');

  /* 5.2 and 5.3 are STEP pages. Only the Leadership Dashboard is
     currentPage 'phase5', and printCurrentPage() forces the id to 5.1
     when it is - so driving 5.2 through go('phase5',..) prints the
     dashboard document and looks like a title bug that is not one. */
  const ldev = await printDoc(`currentPage='step'; currentStep='5.2'; render(); printCurrentPage()`);
  ok(!ldev.err && ldev.html.length > 800, '[15] the L&D Hub prints a document' + (ldev.err || ''));
  ok(/L&amp;D HUB|L&D HUB/i.test(ldev.html), '[15] each L&D Hub page is headed L&D HUB');
  ok(/Study Progress/i.test(ldev.html) && /Practice Health/i.test(ldev.html), '[15] the L&D Hub prints Study Progress and Practice Health');
  ok(!/1 of 3/.test(ldev.html), '[15] the L&D Hub prints no "1 of 3" page count of its own');

  const myDev = await printDoc(`currentPage='step'; currentStep='5.3'; render(); printCurrentPage()`);
  ok(!myDev.err && myDev.html.length > 400, '[16] My Development prints a document' + (myDev.err || ''));
  ok(/My Development/i.test(myDev.html), '[16] the My Development document is titled My Development');

  /* -- check 17: Track Program -------------------------------- */
  say('\n== Track Program (check 17) ==');
  const mgmt = await printDoc(`printMgmtAnalytics()`);
  ok(!mgmt.err && mgmt.html.length > 800, '[17] Track Program prints a document' + (mgmt.err || ''));
  ok(/Module Management/i.test(mgmt.html), '[17] the document is titled Module Management');
  ok(/Analytics/i.test(mgmt.html), '[17] it has an Analytics page');
  ok(!/>1\.4</.test(mgmt.html) && !/>2\.4</.test(mgmt.html), '[17] the individual steps 1.4 and 2.4 are left out');

  /* -- check 18: the Report Manager --------------------------- */
  say('\n== Report Manager (check 18) ==');
  const rm = await evalJs(`(function(){
    try{
      go('reports'); render();
      var h=document.getElementById('app').innerHTML||'';
      var hasSidebar=(document.getElementById('pipSidebar').style.display!=='none');
      var toggle=document.getElementById('sidebarToggle');
      return {len:h.length, newReport:/New report/i.test(h), rcPage:/rc-page/.test(
        (document.querySelector('.content-inner')||{className:''}).className+' '+h),
        sidebar:hasSidebar, toggleShown: !!toggle && toggle.style.display!=='none'};
    }catch(e){return 'ERR '+e.message+' | '+(e.stack||'').split('\\n')[1]}
  })()`);
  say('  reports page: ' + JSON.stringify(rm));
  ok(rm && rm.len > 500, '[18] the Report Manager page renders');
  ok(rm && rm.newReport, '[18] it offers + New report');
  ok(rm && rm.sidebar && rm.toggleShown, '[18] the sidebar and its toggle are present on the Report Manager page');

  /* Section 5, the one stylesheet line: .rc-page's own centring formula
     must actually win, not merely be present in the file. */
  const centring = await evalJs(`(function(){
    try{
      go('reports'); render();
      var el=document.querySelector('.content-inner.rc-page');
      if(!el) return {err:'no .content-inner.rc-page element'};
      var cs=getComputedStyle(el);
      return {maxWidth:cs.maxWidth, marginLeft:cs.marginLeft};
    }catch(e){return {err:e.message}}
  })()`);
  say('  rc-page computed: ' + JSON.stringify(centring));
  ok(centring && centring.maxWidth === '1350px',
    '[5] the Report Manager block takes the 1350px width its own rule sets (got ' + (centring && (centring.maxWidth || centring.err)) + ')');

  const report = await printDoc(`(function(){
    var d=rcNew('Acceptance report');
    var id=(d&&d.id)||(rcDefs()[rcDefs().length-1]||{}).id;
    UI.rcEdit=id;
    /* the catalogue key is rcKey(u) = kind:[type:]id */
    rcToggle(id,'output:out-readiness');
    rcToggle(id,'page:5.1');
    rcToggle(id,'page:5.2');
    rcPrint(id);
  })()`);
  if (report.err) ok(false, '[18] the Report Manager prints a report: ' + report.err);
  else {
    const h = report.html;
    ok(h.length > 1200, '[18] the Report Manager prints a report (' + h.length + ' bytes)');
    ok(/Contents/i.test(h), '[18] the report has a contents page');
    ok(/Readiness Report/i.test(h), '[18] section 1 is the Readiness Report');
    ok(/Leadership Structure/i.test(h), '[18] the Leadership Dashboard appears as Leadership Structure');
    ok(!/1 of 3/.test(h), '[18] no "1 of 3" anywhere in the report');
  }

  /* -- check 19: the seed's own vocabulary --------------------- */
  say('\n== the example data (check 19) ==');
  const seedShape = await evalJs(`(function(){
    var w=(data.mmActivation||{}).workflows||[];
    var fm=((data.collabLab||{}).functionModels)||[];
    return {
      workflows:w.map(function(x){return x.name}),
      haveRoles:w.every(function(x){return !!x.aiRole && !!x.humanRole}),
      models:fm.map(function(x){return (x.name||x.function)+':'+(x.model||'')}),
      maturity:(data.enterprise||{}).maturity, size:(data.enterprise||{}).size
    };
  })()`);
  say('  seed: ' + JSON.stringify(seedShape));
  ok(seedShape && seedShape.workflows.join(',') === 'Quote drafting,Support triage,Demand forecast',
    '[19] the AI Workflow Analysis lists Quote drafting, Support triage and Demand forecast');
  ok(seedShape && seedShape.haveRoles, '[19] each workflow carries an AI Role and a Human Role');
  ok(seedShape && seedShape.models.length === 4 && seedShape.models.every(s => s.split(':')[1]),
    '[19] the Models tab has four functions, each with a model (' + (seedShape && seedShape.models.join(' | ')) + ')');
  ok(seedShape && seedShape.maturity === 'Piloting' && /^201/.test(seedShape.size || ''),
    '[kept] the org profile still seeds the values its dropdowns can select');

  /* -- the console ------------------------------------------- */
  say('\n== console ==');
  ok(errors.length === 0, 'no uncaught exception while driving every document (' + errors.length + ')');
  for (const e of errors.slice(0, 12)) say('    ! ' + String(e).split('\n')[0].slice(0, 200));

  ws.close();
  chrome.kill();
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch(e => {
  say('\nHARNESS ERROR: ' + e.message + '\n' + (e.stack || ''));
  process.exit(2);
});
