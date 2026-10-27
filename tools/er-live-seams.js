#!/usr/bin/env node
/* -------------------------------------------------------------
   er-live-seams.js - the 16 Sep 2026 directive as the LIVE app
   serves it
   -------------------------------------------------------------
   tools/exec-readiness-smoke.js proves the generated module's own
   behaviour in a sandbox. What it cannot see is the SEAM: whether the
   shell routes to the new page, whether the More menu offers it,
   whether the module's stylesheet reaches the browser. Those live in
   js/modules/exec-readiness/module.js and the shell, not in steps.js.

   So this loads the real URL in Chrome, over the real front
   controller, with the real stylesheets - and asks the seam
   questions. It does NOT sign in: the workspace is seeded in memory
   and the page renderers are called directly, because this machine's
   MySQL is shared with the operator's own browser and a test must not
   write to it.

   Serve the app first (XAMPP), then:
     node tools/er-live-seams.js
   ------------------------------------------------------------- */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const URL_APP = process.env.ER_LIVE || 'http://localhost/apps/enterprises/executive-readiness';
const PORT = 9353;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = path.join(require('os').tmpdir(), 'er-live-seams');

const log = [];
let pass = 0, fail = 0;
const say = s => log.push(s);
const ok = (c, label) => { if (c) { pass++; say('  ok   ' + label); } else { fail++; say('  FAIL ' + label); } };
process.on('exit', () => {
  const out = log.join('\n') + '\n\nPASS: ' + pass + '  FAIL: ' + fail + '\n';
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
    '--window-size=1600,1200', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });

  let list = null;
  for (let i = 0; i < 40 && !list; i++) {
    await new Promise(r => setTimeout(r, 400));
    try { list = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json/list')); } catch (e) { }
  }
  if (!list) throw new Error('chrome did not come up on ' + PORT);
  const page = list.find(t => t.type === 'page');
  const wsUrl = page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+\//, 'ws://127.0.0.1:' + PORT + '/');

  const ws = new WebSocket(wsUrl);
  ws.addEventListener('error', e => say('websocket error: ' + (e.message || '')));
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
    const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result && r.result.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: URL_APP });
  await new Promise(r => setTimeout(r, 3500));

  /* -- the module is the one serving this URL -------------------- */
  say('== the seam ==');
  const reg = await evalJs(`(function(){
    try{
      return {
        module: Modules.activeId(),
        er: typeof window.ER,
        reports: typeof (window.ER||{}).renderReports,
        pageReports: typeof Modules.page('reports'),
        pageMgmt: typeof Modules.page('mgmt-hub'),
        more: (Modules.moreItems()||[]).map(function(i){return i.label}),
        sidebarReports: (typeof SIDEBAR_PAGES!=='undefined') && SIDEBAR_PAGES.indexOf('reports')>=0
      };
    }catch(e){return {err:e.message}}
  })()`);
  say('  ' + JSON.stringify(reg));
  ok(reg && reg.module === 'exec-readiness', 'this URL serves the exec-readiness module');
  ok(reg && reg.er === 'object' && reg.reports === 'function', 'the ported module is loaded and has renderReports');
  ok(reg && reg.pageReports === 'function', 'module.js registers the "reports" page (step 3)');
  ok(reg && reg.pageMgmt === 'function', 'module.js registers "mgmt-hub" so Track Program is this program\'s (step 65)');
  ok(reg && (reg.more || []).indexOf('Report Manager') >= 0, 'the More menu offers Report Manager (step 4)');
  ok(reg && reg.sidebarReports, 'the sidebar keeps its rail on the Report Manager page');

  /* -- the stylesheet reached the browser ----------------------- */
  const css = await evalJs(`(function(){
    try{
      var found=null;
      for(var i=0;i<document.styleSheets.length;i++){
        var s=document.styleSheets[i]; var r;
        try{r=s.cssRules}catch(e){continue}
        for(var j=0;j<r.length;j++){
          if(r[j].selectorText && r[j].selectorText.indexOf('rc-page')>=0){
            found={sheet:(s.href||'inline').split('/').pop(), css:r[j].style.maxWidth+' / '+r[j].style.marginLeft};
          }
        }
      }
      return found||{none:true};
    }catch(e){return {err:e.message}}
  })()`);
  say('  rc-page rule: ' + JSON.stringify(css));
  ok(css && !css.none && !css.err, 'the .rc-page rule is in a stylesheet the browser loaded (section 5)');

  /* -- the documents, against an in-memory seeded workspace ------ */
  say('\n== the printed documents, through the live module ==');
  const seeded = await evalJs(`(function(){
    try{
      window.confirm=function(){return true}; window.alert=function(){};
      data = Modules.emptyData();
      ER.seedData();
      window.__doc='';
      window.open=function(){var b='';return {document:{write:function(s){b+=s},close:function(){window.__doc=b},title:''},print:function(){},focus:function(){},close:function(){}}};
      return {leaders:(data.leaders||[]).length, risks:(data.risks||[]).length};
    }catch(e){return {err:e.message}}
  })()`);
  say('  seeded: ' + JSON.stringify(seeded));
  ok(seeded && seeded.leaders === 13, 'the sample workspace loads thirteen leaders');

  const grab = async expr => {
    const e = await evalJs(`(function(){try{window.__doc='';${expr};return ''}catch(e){return 'ERR '+e.message}})()`);
    if (e) return { err: e, html: '' };
    return { err: null, html: (await evalJs('window.__doc')) || '' };
  };

  const OUTPUTS = ['out-readiness', 'out-inventory', 'out-riskmap', 'out-structure', 'out-collab',
    'out-competency', 'out-fluency', 'out-decisions', 'out-mmprinciples', 'out-values',
    'out-rhythm', 'out-evalplan', 'out-review'];
  const RECORDS = { 'out-inventory': 1, 'out-competency': 1, 'out-fluency': 1 };
  for (const o of OUTPUTS) {
    const r = await grab(`currentPage='outcome'; currentStep='${o}'; ER.printCurrentOutput()`);
    if (r.err) { ok(false, o + ': ' + r.err); continue; }
    const h = r.html;
    ok(h.length > 800 && /NextChapter/.test(h) && /Next Chapter, LLC/.test(h),
      o + ' prints a document with its cover and footer (' + h.length + ' bytes)');
    if (RECORDS[o]) {
      const rows = (h.match(/<tr/g) || []).length;
      ok(/class="ly-rec"/.test(h) && rows >= 8,
        o + ' prints record tables with rows (' + rows + ') - LAYER_MAPS is filled');
    }
  }

  const rm = await grab(`(function(){
    var d=ER.rcNew('Live seam report');
    var id=(d&&d.id)||(ER.rcDefs()[ER.rcDefs().length-1]||{}).id;
    var cat=ER.rcCatalogue();
    ER.rcToggle(id, ER.rcKey(cat.find(function(u){return u.kind==='output'})));
    ER.rcToggle(id, ER.rcKey(cat.find(function(u){return u.kind==='page'})));
    ER.rcToggle(id, ER.rcKey(cat.find(function(u){return u.kind==='record'&&u.type==='leader'})));
    ER.rcToggle(id, ER.rcKey(cat.find(function(u){return u.kind==='record'&&u.type==='lrisk'})));
    ER.rcPrint(id);
  })()`);
  ok(!rm.err && rm.html.length > 1500, 'the Report Manager compiles and prints a report' + (rm.err || ''));
  ok(/Contents/.test(rm.html), 'the report has a contents page');

  /* -- the page renders through the shell's own router ---------- */
  const pageHtml = await evalJs(`(function(){
    try{ var h=Modules.page('reports')(); return {len:(h||'').length, rcPage:/rc-page/.test(h||''), newReport:/New report/i.test(h||'')}; }
    catch(e){return {err:e.message}}
  })()`);
  say('  reports page: ' + JSON.stringify(pageHtml));
  ok(pageHtml && pageHtml.len > 500 && pageHtml.rcPage && pageHtml.newReport,
    'the Report Manager page renders through the shell with its own .rc-page column');

  say('\n== console ==');
  ok(errors.length === 0, 'no uncaught exception (' + errors.length + ')');
  errors.slice(0, 8).forEach(e => say('    ! ' + String(e).split('\n')[0].slice(0, 170)));

  ws.close(); chrome.kill();
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch(e => { say('\nHARNESS ERROR: ' + e.message + '\n' + (e.stack || '')); process.exit(2); });
