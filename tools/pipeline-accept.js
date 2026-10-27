#!/usr/bin/env node
/* -------------------------------------------------------------
   pipeline-accept.js - the acceptance checks of the 17 Sep 2026
   AI Innovation Pipeline directive, against the LIVE app
   -------------------------------------------------------------
   Section 8 of reference/Directive_DEV_Innovation_Pipeline_Complete_
   17Sep2026.md is 22 numbered checks, each of them "open this, click
   that, see this". The directive names an updated harness.js for the
   dev build; it did not arrive with the document, and neither suite
   knows anything about printed documents or the Report Manager. This
   stands in for them, and asks the questions of the LIVE app rather
   than of the dev build - which is the half the directive does not
   cover and the half people use.

   Everything printed goes through window.open() + document.write(),
   so window.open is STUBBED and what was written is kept: that is the
   printed document's markup exactly as the print window would get it.
   Nothing opens, nothing prints.

   Chrome over the DevTools Protocol, no puppeteer - Node's global
   WebSocket is enough. Apache must be serving the app.

   It seeds IN MEMORY and never signs in: this MySQL is shared with the
   operator's browser, so a check that wrote would edit their data.

     node tools/pipeline-accept.js
   ------------------------------------------------------------- */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const URL_APP = process.env.PL_URL || 'http://localhost/apps/enterprises/innovation-pipeline';
const PORT = 9347;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(require('os').tmpdir(), 'pl-accept-profile');

const log = [];
const say = s => { log.push(s); };
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; say('  ok   ' + label); }
  else { fail++; say('  FAIL ' + label); }
}
process.on('exit', () => {
  const out = log.join('\n') + '\n\nPASS: ' + pass + '  FAIL: ' + fail + '\n';
  try { fs.writeFileSync(path.join(__dirname, '_pl-accept.log'), out); } catch (e) { }
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
  await new Promise(r => setTimeout(r, 3000));

  /* -- boot -------------------------------------------------- */
  say('== boot ==');
  const booted = await evalJs(`(function(){
    return {
      seed: typeof seedData==='function',
      reports: typeof renderReports==='function',
      printDoc: typeof printDocument==='function',
      printDocs: (typeof PRINT_DOCS==='object') ? Object.keys(PRINT_DOCS||{}).length : -1,
      layerMaps: (typeof LAYER_MAPS==='object') ? Object.keys(LAYER_MAPS||{}).length : -1,
      reviewPage: typeof renderReviewPage==='function',
      portPage: typeof renderPortfolioPage==='function'
    };
  })()`);
  say('  ' + JSON.stringify(booted));
  ok(booted.seed && booted.printDoc, 'the app boots with seedData and printDocument defined');
  ok(booted.reports, 'js/pages/reports.js loaded and declared renderReports');
  ok(booted.reviewPage && booted.portPage, 'the Quarterly Review and live portfolio pages are defined');
  /* An empty table is the failure with no symptom: every page still
     renders, every handler still resolves, and every document prints a
     heading over nothing. Assert the counts, not just the type. */
  ok(booted.printDocs >= 12, 'PRINT_DOCS is filled - ' + booted.printDocs + ' documents registered (>= 12)');
  ok(booted.layerMaps >= 2, 'LAYER_MAPS is filled - ' + booted.layerMaps + ' record types (idea, project)');

  /* -- sign in and load the example data, IN MEMORY ONLY ------
     Store.save is neutered first: this database is shared with the
     operator's browser and a check must not write to it. */
  const signed = await evalJs(`(function(){
    try{
      window.confirm=function(){return true};
      window.alert=function(){};
      if(typeof Store==='object'){ Store.save=function(){}; Store.commit=function(){}; }
      if(typeof saveData==='function'){ window.saveData=function(){}; }
      seedData();
      render();
      return {ideas:(data.ideas||[]).length, projects:Object.keys(data.projects||{}).length,
              reviewItems:Object.keys((data.review||{}).items||{}).length,
              done42:!!(data.completedSteps||{})['4.2'], done44:!!(data.completedSteps||{})['4.4']};
    }catch(e){return 'ERR '+e.message+' | '+(e.stack||'').split('\\n')[1]}
  })()`);
  say('  seed: ' + JSON.stringify(signed));
  ok(signed && signed.ideas > 0, 'the example data loads');
  /* Section 3: "Steps 4.2, 4.3 and 4.4 are complete. The first quarterly
     review is recorded: a decision with its reason on each of the nine
     live initiatives." */
  ok(signed && signed.reviewItems === 9, 'the seeded quarterly review decides all nine live initiatives (got ' + (signed && signed.reviewItems) + ')');
  ok(signed && signed.done42 && signed.done44, 'steps 4.2 and 4.4 are complete on the seed');

  /* -- the print-window stub --------------------------------- */
  await evalJs(`(function(){
    window.__lastDoc='';
    window.open=function(){
      var buf='';
      return {document:{write:function(s){buf+=s},close:function(){window.__lastDoc=buf},title:''},
              print:function(){},focus:function(){},close:function(){},onload:null};
    };
  })()`);
  const printDoc = async (expr) => {
    const r = await evalJs(`(function(){
      try{ window.__lastDoc=''; ${expr}; return window.__lastDoc.length; }
      catch(e){ return 'ERR '+e.message }
    })()`);
    if (typeof r === 'string') return { err: r, html: '' };
    const html = await evalJs('window.__lastDoc');
    return { err: null, html: html || '' };
  };

  /* -- checks 1-12, 16: every output prints its own document --
     The cover, the footer, no control, and real content. A document
     that prints a cover and nothing else is the empty-table failure. */
  say('\n== printed documents (checks 1-4, 6, 9-12, 16) ==');
  const OUTPUTS = [
    ['out-report', 'Assessment Report', 2],
    ['out-bluesky', 'Blue Sky Portfolio', 3],
    ['out-orgready', 'Org Readiness', 4],
    ['out-raci', 'RACI Matrix', 5],
    ['out-explore', 'Exploration Portfolio', 6],
    ['out-capplan', 'Capital Snapshot', 9],
    ['out-expbriefs', 'Development Portfolio', 10],
    ['out-govfw', 'Governance Framework', 1],
    ['out-orgrev', 'Org Design Review', 11],
    ['out-finalport', 'Portfolio Review', 12],
    ['out-oper', 'Operational Portfolio', 16]
  ];
  const docs = {};
  for (const [oid, title, check] of OUTPUTS) {
    const r = await printDoc(`go('outcome','${oid}'); printCurrentOutput()`);
    docs[oid] = r.html;
    if (r.err) { ok(false, '[' + check + '] ' + title + ': ' + r.err); continue; }
    const h = r.html;
    /* The glossary quotes the line in capitals; the SOURCE is mixed case
       and text-transform:uppercase puts the capitals on. Match the source. */
    ok(h.indexOf('NextChapter · 90-Day AI Innovation Pipeline') >= 0,
      '[' + check + '] ' + title + ': the first page carries the module line');
    ok(h.indexOf('2026 Next Chapter, LLC') >= 0,
      '[' + check + '] ' + title + ': the copyright line is in the page footer');
    ok(!/<button/i.test(h.replace(/<button[^>]*onclick="window\.print\(\)"[\s\S]*?<\/button>/g, '')),
      '[' + check + '] ' + title + ': no control prints');
    /* Content, not just a cover: the cover alone is about 1.2 KB. */
    ok(h.length > 4000, '[' + check + '] ' + title + ': the document has a body (' + h.length + ' bytes)');
  }

  /* Check 12: the Portfolio Review is its own document, not a second
     Development Portfolio - the whole point of PH's rename. */
  ok(docs['out-finalport'] && docs['out-finalport'].indexOf('Portfolio Review') >= 0
    && docs['out-finalport'].indexOf('The Decisions') >= 0,
    '[12] the Portfolio Review prints the decisions, not a second Development Portfolio');
  ok(docs['out-finalport'] && docs['out-finalport'] !== docs['out-expbriefs'],
    '[12] and it is a different document from the Development Portfolio');

  /* Check 3: the Blue Sky Portfolio prints its ideas as record tables.
     An empty LAYER_MAPS prints the headings and no rows. */
  ok(docs['out-bluesky'] && (docs['out-bluesky'].match(/ly-rec|<table/g) || []).length >= 3,
    '[3] the Blue Sky Portfolio prints the ideas as record tables');

  /* -- checks 2, 6-7, 10, 16: Summary / Full ------------------ */
  say('\n== Summary / Full (checks 2, 6-7, 10, 16) ==');
  for (const oid of ['out-report', 'out-bluesky', 'out-explore', 'out-expbriefs', 'out-oper']) {
    const s = await printDoc(`UI.printDepth='summary'; go('outcome','${oid}'); printCurrentOutput()`);
    const f = await printDoc(`UI.printDepth='full'; go('outcome','${oid}'); printCurrentOutput()`);
    ok(!s.err && !f.err && f.html.length > s.html.length,
      oid + ': Full prints more than Summary (' + s.html.length + ' -> ' + f.html.length + ')');
  }
  await evalJs("UI.printDepth='summary'");

  /* -- check 5: the RACI matrix ------------------------------- */
  say('\n== the RACI matrix (check 5) ==');
  const raci = await evalJs(`(function(){
    try{
      go('step','2.1');
      var h=renderStepContent('2.1');
      return {chips:(h.match(/raciCycle\\(/g)||[]).length,
              legend:h.indexOf('Accountable')>=0 && h.indexOf('Consulted')>=0,
              cols:raciCols().length};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  ' + JSON.stringify(raci));
  ok(raci && raci.chips > 0, 'a RACI cell cycles on click (raciCycle is wired to the cells)');
  ok(raci && raci.legend, 'the legend names Responsible, Accountable, Consulted, Informed');
  ok(raci && raci.cols >= 3, 'every embedded lead and senior leader has a column (' + (raci && raci.cols) + ')');

  /* -- check 18: the Review Snapshot hides empty sections ----- */
  say('\n== the Review Snapshot (check 18) ==');
  const snap = await evalJs(`(function(){
    try{ var h=reviewSnapshotCard();
      return {drift:h.indexOf('Start Date Drift')>=0, variance:h.indexOf('Launch Variance')>=0,
              overrides:h.indexOf('Overrides')>=0, cap:h.indexOf('Sustainment Cap')>=0,
              intake:h.indexOf('Intake Reserve')>=0};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  ' + JSON.stringify(snap));
  ok(snap && !snap.drift && !snap.variance && !snap.overrides && !snap.cap,
    '[18] no section with no content is printed');

  /* -- checks 13-15: the Phase 5 pages ------------------------ */
  say('\n== the Phase 5 pages (checks 13-15, 17, 20) ==');
  const dash = await printDoc(`go('phase5'); printCurrentPage()`);
  ok(!dash.err && dash.html.length > 4000, '[13] the Pipeline Dashboard prints its own document (' + dash.html.length + ' bytes)');
  ok(!dash.err && dash.html.indexOf('Pipeline Overview') >= 0, '[13] headed Pipeline Overview');

  const review = await evalJs(`(function(){
    try{ go('review'); var h=renderReviewPage();
      return {len:h.length, head:h.indexOf('Quarterly')>=0, surface:h.indexOf('setReviewDecision(')>=0,
              phase:activeNavPhaseId(), rail:sidebarShowsHere()};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  review page: ' + JSON.stringify(review));
  ok(review && review.surface, '[14] the Quarterly Review page shows the shared review surface');
  ok(review && review.phase === 5, '[14] and the sidebar stays on Phase 5');
  ok(review && review.rail, '[14] and the page keeps the sidebar');

  const portf = await evalJs(`(function(){
    var out={};
    ['out-bluesky','out-explore','out-expbriefs','out-oper'].forEach(function(id){
      try{ go('portfolio',id); out[id]={len:renderPortfolioPage().length, phase:activeNavPhaseId()}; }
      catch(e){ out[id]='ERR '+e.message }
    });
    return out;
  })()`);
  say('  live portfolios: ' + JSON.stringify(portf));
  for (const k of Object.keys(portf)) {
    ok(portf[k] && portf[k].len > 500, '[15] the live ' + k + ' page renders');
    ok(portf[k] && portf[k].phase === 5, '[15] and belongs to Phase 5, not its own phase');
  }

  const hub = await printDoc(`go('cap-hub'); printCurrentPage()`);
  ok(!hub.err && hub.html.length > 2000, '[17] the Capital Planning Hub prints its document (' + hub.html.length + ' bytes)');

  const mgmt = await printDoc(`go('mgmt-hub'); printMgmtAnalytics()`);
  ok(!mgmt.err && mgmt.html.indexOf('Module Management') >= 0, '[20] Track Program prints a Module Management document');

  /* -- check 19: the sidebar Outputs fold --------------------- */
  say('\n== the sidebar (check 19) ==');
  /* Only the OPEN phase shows its steps and its Outputs line - the
     chevron collapses the others - so this asks each phase in turn
     rather than counting folds on one paint. */
  const side = await evalJs(`(function(){
    try{
      /* Every phase draws a fold, so the first one in the DOM is always
         Phase 1's. Key them by the phase their own onclick names. */
      var folds=function(){
        var m={};
        Array.prototype.forEach.call(document.querySelectorAll('.sidebar-outcomes-fold'), function(e){
          var n=(e.getAttribute('onclick')||'').match(/toggleNavOutputs\\((\\d+)\\)/);
          if(n) m[n[1]]=e.textContent.replace(/\\s+/g,' ').trim();
        });
        return m;
      };
      var out={};
      go('step','1.1'); renderSidebar(); out.p1=folds()['1'];
      go('step','4.1'); renderSidebar(); out.p4=folds()['4'];
      go('outcome','out-finalport'); renderSidebar();
      out.openWhenViewing=folds()['4'];
      out.listed=Array.prototype.map.call(document.querySelectorAll('.sidebar-outcome'),
        function(e){return e.textContent.replace(/\\s+/g,' ').trim()});
      var p4=PH.filter(function(p){return p.id===4})[0];
      out.p4third=(p4.outcomes[2]||{}).name;
      return out;
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  ' + JSON.stringify(side));
  ok(side && /Outputs \(2\)/.test(side.p1 || ''), '[19] Phase 1 reads "\u25b8 Outputs (2)" - got "' + (side && side.p1) + '"');
  ok(side && /Outputs \(3\)/.test(side.p4 || ''), '[19] Phase 4 reads "\u25b8 Outputs (3)" - got "' + (side && side.p4) + '"');
  ok(side && /^\u25be/.test(side.openWhenViewing || ''), '[19] the fold opens itself while one of its outputs is the page being viewed');
  ok(side && (side.listed || []).some(t => /Portfolio Review/.test(t)),
    "[19] and Phase 4's third output is listed as Portfolio Review");
  ok(side && side.p4third === 'Portfolio Review', "[19] PH names it Portfolio Review");

  /* -- check 21: the Report Manager --------------------------- */
  say('\n== the Report Manager (check 21) ==');
  const rc = await evalJs(`(function(){
    try{
      go('reports');
      var page=renderReports();
      var cat=rcCatalogue();
      var kinds={}; cat.forEach(function(u){kinds[u.kind]=(kinds[u.kind]||0)+1});
      return {len:page.length, rail:sidebarShowsHere(), wide:page.indexOf('rc-page')>=0,
              catalogue:cat.length, kinds:kinds};
    }catch(e){return 'ERR '+e.message+' | '+(e.stack||'').split('\\n')[1]}
  })()`);
  say('  ' + JSON.stringify(rc));
  ok(rc && rc.len > 500, '[21] the Report Manager page renders');

  /* THE DOOR. A page that renders is not a page anyone can reach, and the
     two are checked separately because they failed separately: the item
     was declared with `page:` instead of `run:`, and js/modules/registry.js
     filters out any moreItems entry without a run function - so it did not
     error, it simply never appeared in the menu. Asked of the shell's own
     accessor, and then by RUNNING it, because a present entry whose run
     throws is the same to a user as no entry at all. */
  const door = await evalJs(`(function(){
    try{
      go('pipeline');
      var items=(window.Modules&&Modules.moreItems())||[];
      var r=items.filter(function(x){return x.id==='reports'})[0];
      if(!r)return {found:false, ids:items.map(function(x){return x.id})};
      r.run();
      return {found:true, label:r.label, icon:r.icon, landed:currentPage};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  More menu: ' + JSON.stringify(door));
  ok(door && door.found === true,
    '[21] the More menu carries a Report Manager item (Modules.moreItems())');
  ok(door && door.label === 'Report Manager', '[21] labelled "Report Manager"');
  ok(door && door.landed === 'reports', '[21] and clicking it opens the page (got page "' + (door && door.landed) + '")');

  /* And in the MENU THE USER OPENS, not only in the table behind it.
     Painted through Nav.render() rather than render(): this check never
     signs in (the database is shared with the operator's browser), and
     render() stops at the entry gate before it ever reaches the nav. */
  const inMenu = await evalJs(`(function(){
    try{
      go('pipeline');
      UI.navMore=true; Nav.render();
      var b=document.querySelector('.nav-more-item[data-item="reports"]')
           ||document.querySelector('[data-act="module-item"][data-item="reports"]');
      var out={present:!!b, text:b?b.textContent.replace(/\\s+/g,' ').trim():null,
               beside:!!document.querySelector('[data-act="track"]')};
      UI.navMore=false; Nav.render();
      return out;
    }catch(e){return 'ERR '+e.message}
  })()`);
  /* The page is drawn in the app's own language, not the family build's.
     Asserted on the HOOKS, because that is what a regeneration drops: the
     markup carries .rc-cols and .rc-row and uses .h-sub-md, and
     assets/css/styles.css dresses them. Losing either half puts the page
     back to one undifferentiated panel with 14px headings. */
  const styled = await evalJs(`(function(){
    try{
      go('reports'); rcNew();
      var m=renderReports();
      var probe=document.createElement('div'); probe.innerHTML=m;
      var cols=probe.querySelector('.rc-cols');
      return {cols:!!cols, colChildren:cols?cols.children.length:0,
              rows:probe.querySelectorAll('.rc-row').length,
              h4:probe.querySelectorAll('h4').length,
              subMd:probe.querySelectorAll('.h-sub-md').length};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  design hooks: ' + JSON.stringify(styled));
  ok(styled && styled.cols && styled.colChildren === 2,
    "[21] the two columns carry .rc-cols, so they are dressed as the app's cards");
  ok(styled && styled.subMd >= 2 && styled.h4 === 0,
    "[21] its headings are .h-sub-md like every other card, not bare <h4>s");
  ok(styled && styled.rows > 10, '[21] catalogue rows carry .rc-row for the app\'s row rhythm (' + (styled && styled.rows) + ')');
  const dressed = await evalJs(`(function(){
    var css=[].slice.call(document.styleSheets).some(function(s){
      try{ return [].slice.call(s.cssRules).some(function(r){ return r.selectorText && /\\.rc-page \\.rc-cols/.test(r.selectorText) }) }
      catch(e){ return false }
    });
    return css;
  })()`);
  ok(dressed === true, '[21] and the stylesheet that dresses them is loaded');

  say('  in the open menu: ' + JSON.stringify(inMenu));
  ok(inMenu && inMenu.present, '[21] and the item is in the More menu as drawn, beside Track Program');
  ok(inMenu && /Report Manager/.test(inMenu.text || ''), '[21] reading "' + (inMenu && inMenu.text) + '"');
  ok(rc && rc.rail, '[21] and keeps the sidebar and its toggle');
  ok(rc && rc.wide, '[21] and asks for the wide rc-page block');
  ok(rc && rc.catalogue > 10, '[21] the catalogue offers what a report can contain (' + (rc && rc.catalogue) + ' items)');
  /* The catalogue's own words: an individual idea is kind 'record'. */
  ok(rc && rc.kinds && rc.kinds.output && rc.kinds.page && rc.kinds.record,
    '[21] outputs, Phase 5 pages and individual ideas are all offered');

  /* A report with one section of every kind, each asserted to print a
     BODY and not just its numbered heading - that is what catches a
     document registered but never filled. */
  const built = await evalJs(`(function(){
    try{
      /* rcNew() takes no argument and returns nothing - it puts the new
         report's id in UI.rcEdit, which is how the page then finds it. */
      rcNew();
      var rid=UI.rcEdit;
      var cat=rcCatalogue();
      var picked=[];
      ['output','page','record'].forEach(function(k){
        var u=cat.filter(function(x){return x.kind===k})[0];
        if(u){ rcToggle(rid,rcKey(u)); picked.push(k+':'+(u.name||u.id)); }
      });
      rcAddText(rid);
      var def=rcFind(rid);
      var html=rcCompile(rid);
      var bodies=(def.units||[]).map(function(u,i){ return {kind:u.kind, body:(rcUnitBody(u)||'').length}; });
      return {picked:picked, units:(def.units||[]).length, html:html.length, bodies:bodies};
    }catch(e){return 'ERR '+e.message+' | '+(e.stack||'').split('\\n')[1]}
  })()`);
  say('  report: ' + JSON.stringify(built));
  ok(built && built.units === 4, '[21] a report takes an output, a Phase 5 page, an idea and a text page');
  ok(built && built.html > 8000, '[21] and compiles to a whole document (' + (built && built.html) + ' bytes)');
  if (built && built.bodies) for (const b of built.bodies)
    if (b.kind !== 'text') ok(b.body > 200, '[21] the ' + b.kind + ' section prints a body, not just a heading (' + b.body + ' bytes)');

  /* rcSanitize parses through innerHTML, which a stub DOM cannot do -
     this is the one check that has to be in a real browser. */
  const san = await evalJs(`(function(){
    try{ var s=rcSanitize('<b>keep</b><i>this</i><br><script>bad()<\\/script><img src=x>');
      return {out:s, bold:s.indexOf('<b>')>=0, script:/script/i.test(s), img:/<img/i.test(s)};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  sanitize: ' + JSON.stringify(san));
  ok(san && san.bold && !san.script && !san.img,
    '[21] a text page keeps bold and italics and drops script and img');

  /* -- section 5, the stylesheet ------------------------------
     Measured rather than screenshotted: the question is whether the
     three rules apply to the markup the port emits, and a rectangle
     answers that where a picture only suggests it. The page is painted
     into the real content host, so the real stylesheets are in play. */
  say('\n== the stylesheet (section 5) ==');
  const layout = await evalJs(`(function(){
    try{
      var host=document.querySelector('.main-content .content-inner')||document.querySelector('.main-content');
      if(!host)return 'ERR no content host';
      // the Report Manager uses the app's own column, not a wide block
      go('reports');
      host.className='content-inner rc-page';
      host.innerHTML=renderReports();
      var wide=getComputedStyle(host).maxWidth;
      var plain=document.createElement('div');
      plain.className='content-inner';
      host.parentNode.appendChild(plain);
      var native=getComputedStyle(plain).maxWidth;
      plain.parentNode.removeChild(plain);
      // an output page: the control must sit on the title line, at the right
      host.className='content-inner';
      host.innerHTML=renderOutBluesky();
      var row=host.querySelector('.flx-between-top-mb');
      var title=row?row.firstElementChild:null;
      var ctl=row?row.lastElementChild:null;
      var r1=title?title.getBoundingClientRect():null, r2=ctl?ctl.getBoundingClientRect():null;
      var btn=host.querySelector('.pdf-btn');
      return {wide:wide, native:native,
              sameLine:(r1&&r2)?Math.abs(r1.top-r2.top)<40:null,
              ctlRight:(r1&&r2)?(r2.left>r1.left):null,
              rowWraps:(r1&&r2)?(r2.top>r1.bottom):null,
              btnText:btn?btn.textContent.trim():null,
              btnBg:btn?getComputedStyle(btn).backgroundColor:null,
              btnBorder:btn?getComputedStyle(btn).borderTopWidth:null};
    }catch(e){return 'ERR '+e.message}
  })()`);
  say('  ' + JSON.stringify(layout));
  /* 21 Sep 2026, revised the same day: the page was briefly put into the app's
     shared 900px column, but the sections being assembled do not fit there, so
     Change 4 stands and this page is the one deliberate exception to that
     column. Both numbers are asserted, so neither can drift unnoticed. */
  ok(layout && layout.wide === '1350px' && layout.native === '900px',
    'Change 4: the Report Manager keeps its wider block (' + (layout && layout.wide)
    + ") while every other page stays in the app's column (" + (layout && layout.native) + ')');
  ok(layout && layout.sameLine && layout.ctlRight && !layout.rowWraps,
    'Change 3: the control sits on the title line, at the right, and the row does not wrap');
  ok(layout && /Save as PDF/.test(layout.btnText || ''), 'the button reads ▾ Save as PDF ("' + (layout && layout.btnText) + '")');
  ok(layout && layout.btnBg === 'rgba(0, 0, 0, 0)' && parseFloat(layout.btnBorder) >= 1,
    'Change 1: it is a small outlined button, not a filled one');

  /* -- what the paper actually is (check 5) -------------------
     The only way to know a document's page count and orientation is to
     print it and look. Page.printToPDF gives a real PDF; each page's
     /MediaBox is its size in points, so wider-than-tall is landscape.

     This is here because markup cannot answer it: the RACI document asks
     for a landscape NAMED page, and whether the browser scopes that to
     the matrix - or leaks it onto the cover, or spills a blank page off
     the end - is a layout question with a layout answer. */
  say('\n== the printed paper (check 5) ==');
  const paper = async (name, html) => {
    await send('Page.navigate', { url: 'about:blank' });
    await new Promise(r => setTimeout(r, 250));
    await evalJs('document.open();document.write(' + JSON.stringify(html) + ');document.close();1');
    await new Promise(r => setTimeout(r, 800));
    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    const txt = Buffer.from(pdf.result.data, 'base64').toString('latin1');
    return [...txt.matchAll(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/g)]
      .map(m => ((+m[3] - +m[1]) > (+m[4] - +m[2]) ? 'L' : 'P'));
  };
  /* 18 Sep 2026, the operator's ruling, overriding the directive: the
     matrix is portrait like every other page, on the same margins. So the
     assertions are the opposite of check 5 as written - no landscape page
     anywhere, and the matrix WIDE TABLE inside the page rather than
     cropped off its right edge, which is how a too-wide table prints. */
  const raciPages = await paper('RACI Matrix', docs['out-raci'] || '');
  say('  RACI Matrix pages: [' + raciPages.join(',') + ']');
  ok(raciPages.length === 2 && raciPages.every(p => p === 'P'),
    '[5] the RACI Matrix is two PORTRAIT pages - a cover and the matrix (18 Sep ruling)');
  const govPages = await paper('Governance Framework', docs['out-govfw'] || '');
  say('  Governance Framework pages: [' + govPages.join(',') + ']');
  ok(govPages.length >= 2 && govPages.every(p => p === 'P'),
    '[1] and every other document is portrait throughout too');

  /* Does the matrix fit the narrower of the two papers? A4 portrait is
     794px less 28mm of @page margin = 688px of printable width. A table
     wider than that is not an error anywhere - it is simply cut off. */
  const A4 = 688;
  await send('Page.navigate', { url: 'about:blank' });
  await new Promise(r => setTimeout(r, 250));
  await evalJs('document.open();document.write(' + JSON.stringify(docs['out-raci'] || '') + ');document.close();1');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await send('Emulation.setDeviceMetricsOverride', { width: A4, height: 950, deviceScaleFactor: 1, mobile: false });
  await new Promise(r => setTimeout(r, 700));
  const fit = await evalJs(`(function(){
    var host=document.querySelector('.raci-land'), t=host&&host.querySelector('table');
    if(!t)return null;
    var ths=[].map.call(t.querySelectorAll('thead th'),function(e){return {w:e.clientWidth,s:e.scrollWidth}});
    return {doc:Math.round(document.documentElement.scrollWidth),
            cols:ths.length, clipped:ths.filter(function(x){return x.s>x.w+1}).length};
  })()`);
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setEmulatedMedia', { media: '' });
  say('  at A4 printable width (' + A4 + 'px): ' + JSON.stringify(fit));
  ok(fit && fit.doc <= A4, '[5] and it fits the printable width of A4 portrait, the narrower paper');
  ok(fit && fit.clipped === 0, '[5] with no column header cut off - the names wrap instead');

  /* Put the app back: the page was navigated away to print. */
  await send('Page.navigate', { url: URL_APP });
  await new Promise(r => setTimeout(r, 2500));

  /* -- the print window prints itself ------------------------
     `window.print()` suspends the script that CALLS it. Called on the
     popup from a timer in the opener, the dialog opens over the print
     window and the app behind it stops dead with no dialog of its own to
     explain why — reported 18 Sep 2026 as "it preview pdf completely but
     main app hangs up". So the document carries a script that prints it,
     and nothing in the opener calls print at all.

     This is asked of the MARKUP rather than by clicking, because a print
     dialog cannot be driven here and `window.open` returns null headless
     — which is why the stub above exists and why this check could not
     have caught the bug by watching the app. */
  say('\n== the print window prints itself ==');
  const selfPrint = docs['out-govfw'] || '';
  const inlined = (selfPrint.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  ok(/window\.print\(\)/.test(inlined), 'the document carries its own print call');
  ok(selfPrint.indexOf('<script>') >= 0 && selfPrint.indexOf('<script>') < selfPrint.indexOf('</body>'),
    'and it sits inside <body>, not after </html>');
  ok(/addEventListener\("load"|readyState===?"complete"/.test(inlined),
    'and it waits for load rather than a fixed delay');
  /* The stub's window object has no print(); if the opener called it the
     document would never have been produced at all. Assert the source. */
  const openerPrints = await evalJs(`(function(){
    return /setTimeout\\(function\\(\\)\\{w\\.print\\(\\)\\}/.test(printDocument.toString());
  })()`);
  ok(openerPrints === false, 'and the opener never calls print() on the popup');

  /* -- the print window's own encoding ------------------------ */
  ok(docs['out-govfw'] && /<meta charset="utf-8">/i.test(docs['out-govfw']),
    'the print window declares its encoding, so a saved document reopens without mojibake');

  /* -- nothing threw along the way ---------------------------- */
  say('\n== uncaught exceptions ==');
  ok(errors.length === 0, 'no uncaught exception during any of it' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

  ws.close();
  chrome.kill();
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch(e => { say('ERROR: ' + e.message); process.exit(1); });
