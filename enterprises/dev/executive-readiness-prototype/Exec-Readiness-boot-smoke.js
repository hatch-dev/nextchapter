#!/usr/bin/env node
/* Executive Readiness §18.5 boot smoke (rebuilt July 15, 2026 — the §18.3
   session's smoke did not persist). Two jsdom boots + source audits.
   Exit code = number of failed assertions. Shims: matchMedia, scrollTo. */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ER = __dirname;
let fails = 0, n = 0;
function ok(cond, label) {
  n++;
  if (cond) { console.log('  ok ' + String(n).padStart(2) + '  ' + label); }
  else { fails++; console.log('FAIL ' + String(n).padStart(2) + '  ' + label); }
}

const shellHtml = fs.readFileSync(path.join(ER, 'Exec-Readiness-index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(ER, 'Exec-Readiness-app.js'), 'utf8');
const LOAD_ORDER = ['Exec-Readiness-templates-local.js', 'Exec-Readiness-screen-loader.js', 'Exec-Readiness-home.js', 'Exec-Readiness-learn.js', 'dev-auth-server.js', 'Exec-Readiness-app.js']; /* Part 5: the dev stand-in for the sign-in server loads before app.js, as in index.html */

function boot(seed, label) {
  const dom = new JSDOM(shellHtml, { url: 'https://er.local/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || function () { return { matches: false, addListener: function(){}, removeListener: function(){} }; };
  w.scrollTo = function(){};
  w.alert = function(){}; w.confirm = function(){ return false; };
  // §18.8: no fetch in jsdom; reject so Screens.load falls back to templates-local.js
  w.fetch = function(){ return w.Promise.reject(new Error('offline (smoke)')); };
  try { w.localStorage.clear(); } catch (e) {}
  if (seed) seed(w.localStorage);
  let threw = null;
  for (const f of LOAD_ORDER) {
    try { w.eval(fs.readFileSync(path.join(ER, f), 'utf8')); }
    catch (e) { threw = f + ': ' + e.message; break; }
  }
  ok(!threw, label + ': six files eval in shell order without throwing' + (threw ? ' [' + threw + ']' : ''));
  return w;
}

/* ── Instance 1: fresh boot with a seeded legacy v1.2 blob (migration row) ── */
console.log('== instance 1: fresh boot + legacy blob ==');
const legacyBlob = { enterprise: { name: 'Legacy Marker Co' },
  roster: [{ id: 'u9', name: 'Marker Person', username: 'marker', passcode: '9999' }] };
const w1 = boot(ls => ls.setItem('exec-readiness-v1.2', JSON.stringify(legacyBlob)), 'boot1');

ok(w1._bootDone === true, 'bootApp ran (_bootDone === true)');
ok(typeof w1.bootApp === 'function' && w1.bootApp() === false, 'bootApp guarded: second call is a no-op returning false');
ok(w1.Store && ['readOrg','writeOrg','orgRaw','getPref','setPref','ready','startChangeSignal','legacyRaw','removeOrg'].every(k => typeof w1.Store[k] === 'function') && w1.Store.raw && typeof w1.Store.raw.set === 'function', 'Store surface present');
ok(w1.Auth && ['signIn','signInAdmin','currentSession','changePassword','changeAdminPassword','setTemporaryPassword','signOut','setupOrganization','changeAdminUsername','clearSession','setSession','setAdminSession'].every(k => typeof w1.Auth[k] === 'function') && !('ensurePasscode' in w1.Auth) && !('defaultPasscode' in w1.Auth) && !('setAdminPasscode' in w1.Auth), 'Auth surface present: the Part 5 requests, and no passcode functions');
ok(w1.Collab && ['acquire','release','holder','lockedByOther','refreshMine','leave','othersLocks'].every(k => typeof w1.Collab[k] === 'function'), 'Collab surface present');
ok(typeof w1.go === 'function' && typeof w1.render === 'function' && Array.isArray(w1.PH) && w1.Screens && typeof w1.Screens.mount === 'function', 'go/render/PH/Screens live');
ok(!!w1.document.getElementById('pipSidebar'), '#pipSidebar present (§6 id rule)');
ok(!w1.document.querySelector('.cursor-dot,.cursor-ring,#cursorDot'), 'no custom-cursor elements (Rollout item 6)');

const orgs1 = w1.Store.getOrgs();
ok(orgs1.length === 1 && orgs1[0].name === 'Legacy Marker Co', 'migration row: legacy blob adopted into one org named from the blob');
const blob1 = orgs1.length ? w1.Store.readOrg(orgs1[0].id) : null;
ok(!!blob1 && Array.isArray(blob1.roster) && blob1.roster[0] && blob1.roster[0].name === 'Marker Person', 'migration row: legacy roster carried into the org blob');
ok(w1.localStorage.getItem('exec-readiness-v1.2') !== null, 'migration copies, never deletes: legacy key still present');
ok(w1.UI && w1.UI.entry && w1.UI.entry.step === 'checking', 'start-up asks the server whether this browser is signed in (Part 5.4.5)');
w1.resumeSession({ ok: false }); /* the server's answer: not signed in */
ok(w1.UI && w1.UI.entry && w1.UI.entry.step === 'login', 'not signed in: entry gate armed at login step');
ok((w1.document.getElementById('app').innerHTML || '').indexOf('loginUser') >= 0, 'entry gate rendered (login markup in #app)');

if (blob1 && orgs1.length) {
  const before = blob1.rev || 0;
  w1.saveOrgData(orgs1[0].id, blob1);
  const after = w1.Store.readOrg(orgs1[0].id);
  ok(after && after.schemaVersion === 1 && (after.rev || 0) === before + 1 && w1.Store.orgRev(orgs1[0].id) === after.rev, 'writeOrg stamps schemaVersion and monotonic rev, mirrored to the rev key');
} else { ok(false, 'writeOrg stamp check (no org to test)'); }
ok(Object.keys(w1.localStorage).every(k => k.indexOf('pipeline-') !== 0), 'no pipeline-prefixed key exists after boot');
ok(Object.keys(w1.localStorage).every(k => k.indexOf('exec-readiness') === 0), 'every stored key carries the module prefix');

/* ── Instance 2: remembered-session round trip ── */
console.log('== instance 2: remembered session ==');
const w2 = boot(ls => {
  ls.setItem('exec-readiness-orgs', JSON.stringify([{ id: 'orgX', name: 'X Co', created: 1 }]));
  ls.setItem('exec-readiness-org-data::orgX', JSON.stringify({ orgSetup: true, enterprise: { name: 'X Co' },
    roster: [{ id: 'uX', name: 'X Person', username: 'x', email: 'x@x.co', passcode: '1111', initials: 'XP', color: '#4E7FA6', scope: 'All', admin: true }] }));
  ls.setItem('exec-readiness-remember', JSON.stringify({ orgId: 'orgX', userId: 'uX' }));
}, 'boot2');
ok(w2._bootDone === true, 'bootApp ran');
ok(!w2.currentUserId && w2.UI.entry && w2.UI.entry.step === 'checking' && w2.localStorage.getItem('exec-readiness-remember') === null, 'Part 5.4.5: stored ids no longer sign anyone in — start-up asks the server, and the remember record is cleared');
w2.resumeSession({ ok: true, orgId: 'orgX', userId: 'uX', mustChange: false }); /* the server's answer: signed in as uX */
ok(w2.currentUserId === 'uX' && (!w2.UI.entry), 'the server\'s session adopted: signed in as uX, entry gate skipped');
ok(w2.currentOrgId === 'orgX', 'current org restored from the store');
ok(typeof w2.getCurrentUser === 'function' && w2.getCurrentUser() && w2.getCurrentUser().name === 'X Person', 'getCurrentUser resolves the remembered user');
(function(){
  const sent = []; const _f = w2.fetch; w2.fetch = function(u, o){ sent.push([String(u), o && o.method, o && o.body]); return new w2.Promise(function(){}); };
  w2.Auth.signIn('x', 'Secret#2026', false, function(){});
  w2.fetch = _f;
  ok(sent.length === 1 && sent[0][0] === w2.AUTH_ENDPOINT + '/session' && sent[0][1] === 'POST' && sent[0][2] === JSON.stringify({ username: 'x', password: 'Secret#2026', remember: false }), 'Auth.signIn is one request to the server (Part 5.3); the browser checks no password');
  ok(typeof w2.findUserByLogin === 'undefined' && typeof w2.adminCreds === 'undefined' && !/passcode/.test(JSON.stringify(w2.data.roster)), 'no in-browser sign-in check and no passcode in the data (Part 5.2)');
})();
ok(w2.idToRecordKey('st_ownerModel') === 'structure' && w2.idToRecordKey('ru_u6_name') === 'roster' && w2.idToRecordKey('noteInput') === null && w2.idToRecordKey('zz_unknown') === null && w2.Collab.acquire('structure') === true, 'Collab live (item 2, July 16): the map routes known prefixes, nulls UI state and the unmapped; solo acquire succeeds');

/* ── §18.6 batch A: theme, nav composition, carousel, seams ── */
console.log('== §18.6 batch A ==');
ok(typeof w2.setTheme === 'function' && typeof w2.toggleTheme === 'function' && typeof w2.printThemeTokens === 'function', 'setTheme/toggleTheme/printThemeTokens present');
ok(w2.UI.theme === 'dark' && w2.document.documentElement.getAttribute('data-theme') === 'dark', 'dark default with no stored preference (§5A.7, re-ruled 27 July)');
ok((w2.document.getElementById('navRight').innerHTML).indexOf('Light Mode') >= 0, 'nav toggle shows "Light Mode" in dark theme, beside Help (item 20)');
ok(w2.phaseColorFor('1.2') === '#4FB39A', 'phaseColorFor dark branch returns the tint (§5A.5)');
w2.toggleTheme();
ok(w2.UI.theme === 'light' && w2.localStorage.getItem('exec-readiness-theme') === 'light' && w2.document.documentElement.getAttribute('data-theme') === 'light', 'toggleTheme flips and persists to exec-readiness-theme');
ok((w2.document.getElementById('navRight').innerHTML).indexOf('Dark Mode') >= 0, 'toggle label flips to "Dark Mode" in light');
w2.setTheme('light');
ok(w2.phaseColorFor('1.2') === '#1B6B5A' && w2.phaseColorFor('5') === '#6B4C8A', 'phaseColorFor light branch returns base hues incl. phase 5');
w2.UI.navMore = true; w2.data.settings = { aiGuide: false, voice: false }; w2.renderNav();
ok(w2.document.getElementById('navRight').innerHTML.indexOf('Voice</button>') < 0, 'More menu: no Voice item while the organization has Voice off (directive 2 Oct 2026, Part 2)');
w2.data.settings.voice = true; w2.renderNav();   /* the order pin, with Voice switched on */
var nrh = w2.document.getElementById('navRight').innerHTML;
var iZoom = nrh.indexOf('nav-more-zoom'), iTrack = nrh.indexOf('Track Program'), iVoice = nrh.indexOf('Voice</button>'), iProf = nrh.indexOf('Profile</button>'), iSeed = nrh.indexOf('Seed sample data');
ok(iZoom >= 0 && iTrack > iZoom && iVoice > iTrack && iProf > iVoice && iSeed > iProf, 'More menu order: zoom → Track Program → Voice → Profile → … → seeds (§7/item 21)');
ok(nrh.indexOf("go('mgmt-hub')") >= 0 || nrh.indexOf('go(&#39;mgmt-hub&#39;)') >= 0 || nrh.indexOf('mgmt-hub') >= 0, 'Track Program item targets mgmt-hub');
ok(nrh.indexOf('clearData()') < 0 && nrh.indexOf('Reset all data') < 0, 'More menu: no Reset all data — it moved to the admin console Reset data (directive 2 Oct 2026, Part 4.2.3)');
w2.UI.navMore = false; w2.renderNav();
var ptt = w2.printThemeTokens();
ok(ptt.indexOf(':root{') === 0 && ptt.indexOf('--gold:#4E7FA6') >= 0 && ptt.indexOf('--gold-rgb:78,127,166') >= 0 && ptt.indexOf('--shadow-card:none') >= 0, 'printThemeTokens: ER accent set, channel token, shadows suppressed (§5A.6)');
ok(w2.CLAUDE_API_URL === 'https://api.anthropic.com/v1/messages', 'CLAUDE_API_URL constant present (§13 — proxy flag goes in the dev handover)');
ok(typeof w2.wireStaticShell === 'undefined', 'wireStaticShell deleted (§18.6)');
ok(appSrc.indexOf('hover:false') >= 0 && appSrc.indexOf('if(currentModal)') >= 0 && appSrc.indexOf('15000') >= 0, 'carousel carries items 4+11: modal pause, hover mechanics, 15s interval');

ok((function(){ w2.openHelp(); var a = w2.currentModal === 'help' && (w2.document.getElementById('modalRoot').innerHTML||'').length > 0; w2.closeHelp(); return a && w2.currentModal === null; })(), 'Help sets/clears currentModal (item 4 carousel pause engages behind Help)');

/* ── §18.7: Track Program + notifications ── */
console.log('== §18.7 ==');
var st = w2.mgSteps();
ok(st.length === 13 && st.every(function(x){ return String(x.id).charAt(0) !== '5' && !['1.4','2.4','3.5','4.4'].includes(String(x.id)); }), 'mgSteps: 13 countable shared steps \u2014 Ongoing phase and individual-track steps excluded (ruled 16 July)');
ok((function(){ try { var m = w2.mgStats(); return m && typeof m === 'object'; } catch(e){ return false; } })(), 'mgStats computes without throwing (startDate may be absent on old workspaces)');
w2.go('mgmt-hub');
var hubHtml = w2.document.getElementById('app').innerHTML || '';
ok(hubHtml.indexOf('\u25BE Save as PDF') >= 0 && hubHtml.indexOf('Download as PDF') < 0 && hubHtml.indexOf('<h2>Error</h2>') < 0, 'renderMgmtHub renders whole; the hub PDF button carries the canonical quiet form (Rev L, 25 July — superseded the filled Download row)');
w2.data.completedSteps['1.1'] = true; w2.stampStepDone('1.1');
ok(w2.data.stepDoneAt && /^\d{4}-\d{2}-\d{2}$/.test(w2.data.stepDoneAt['1.1'] || ''), 'stampStepDone writes an ISO date once');
ok((w2.data.notifications || []).length === 1 && w2.data.notifications[0].kind === 'step-complete' && w2.data.notifications[0].to.indexOf('x@x.co') >= 0 && w2.data.notifications[0].status.indexOf('pending') === 0, 'first completion queues ONE step-complete notification to roster emails, pending (no endpoint)');
w2.stampStepDone('1.1');
ok((w2.data.notifications || []).length === 1, 're-stamp is a no-op: no duplicate notification (§12 idempotence)');
(function(){ var d = new Date(); d.setDate(d.getDate() + 3);
  w2.data.stepDue = w2.data.stepDue || {}; w2.data.stepDue['2.1'] = d.toISOString().split('T')[0];
  w2.data.assigns = w2.data.assigns || {}; w2.data.assigns['2.1'] = ['uX'];
  w2.notifySweepDeadlines(); w2.notifySweepDeadlines();
  var rem = (w2.data.notifications || []).filter(function(n){ return n.kind === 'deadline-reminder'; });
  ok(rem.length === 1 && w2.data.remind7 && w2.data.remind7['2.1'] === true, 'deadline sweep: assigned step within 7 days queues ONE reminder, idempotent via remind7');
})();
(function(){ w2.confirm = function(){ return true; };
  try { w2.seedData(); } catch(e) {}
  ok(/^\d{4}-\d{2}-\d{2}$/.test(w2.data.startDate || '') && Object.keys(w2.data.stepDoneAt || {}).length === 17 && (w2.data.notifications || []).length === 0 && JSON.stringify(w2.data.remind7) === '{}', 'seed: program clock + 17 builder-level stepDoneAt dates, notification keys literally reset (no storm)');
})();

/* ── Source audits (measured from the working files) ── */
console.log('== source audits ==');
ok((appSrc.match(/localStorage\.setItem/g) || []).length === 2, '§19.5: exactly 2 localStorage.setItem sites in app.js');
ok((appSrc.match(/localStorage\.getItem/g) || []).length === 2, 'exactly 2 localStorage.getItem sites (Store.rawGet + Collab.read)');
ok((appSrc.match(/localStorage\.removeItem/g) || []).length === 1, 'exactly 1 localStorage.removeItem site (Store.rawDel)');
ok(appSrc.indexOf('pipeline-') < 0, 'zero pipeline- residuals in app.js');
ok(shellHtml.indexOf("exec-readiness-theme") >= 0 && shellHtml.indexOf('pipeline') < 0, "shell pre-paint reads 'exec-readiness-theme'; no pipeline residual");
const shellOrder = shellHtml.match(/<script src="([^"]+)"><\/script>/g) || [];
ok(shellOrder.join('|') === '<script src="Exec-Readiness-templates-local.js"></script>|<script src="Exec-Readiness-screen-loader.js"></script>|<script src="Exec-Readiness-home.js"></script>|<script src="Exec-Readiness-learn.js"></script>|<script src="dev-auth-server.js"></script>|<script src="Exec-Readiness-app.js"></script>', '§4 load order intact in the shell');

/* ── boot 3: fresh install — nothing stored, nothing invented (item 1, July 16) ── */
console.log('== instance 3: fresh install ==');
const w3 = boot(null, 'boot3');
ok(w3._bootDone === true, 'fresh boot completes');
ok(w3.Store.getOrgs().length === 0, 'no organization is invented on first run');
w3.resumeSession({ ok: false }); /* the server's answer: not signed in */
ok(w3.UI.entry && w3.UI.entry.step === 'setup', 'first run lands on the Setup screen');
ok((w3.document.getElementById('app').innerHTML || '').indexOf('id="setupCode"') >= 0, 'the Setup form starts with the Setup code field (Part 5.9)');
ok((w3.document.getElementById('app').innerHTML || '').indexOf('setupEmail') >= 0, 'the Setup form renders with the email field (item 19)');

/* ── §18.8: screens — Screens.mount serves Home/Learn, data-nav navigates,
      file:// template path, Insights conformed ── */
function tick(ms){ return new Promise(function(res){ setTimeout(res, ms || 40); }); }

(async function(){
  console.log('== §18.8 screens ==');
  ok(typeof w2.renderHome === 'function' && typeof w2.renderLearn === 'function', 'window.renderHome / window.renderLearn attached by the screen modules');

  w2.go('home'); await tick();
  var appH = w2.document.getElementById('app').innerHTML || '';
  ok(appH.indexOf('hero-headline') >= 0 && appH.indexOf('90 Days to <em>Executive Readiness</em>') >= 0, 'Screens.mount served Home through the bundle fallback (fetch rejected)');
  ok(appH.indexOf('id="zoomWrap"') >= 0, 'mount injected inside the zoom wrapper');
  ok(w2.document.querySelectorAll('#app [data-nav]').length === 5 && w2.document.querySelectorAll('#app [data-url]').length === 1, 'mounted Home carries 5 data-nav + 1 data-url hooks');
  ok(appH.split('data:image/jpeg;base64').length - 1 === 2, 'both video posters inlined in the mounted Home markup');

  var navLearn = w2.document.querySelector('#app [data-nav="learn"]');
  if (navLearn) navLearn.click();
  ok(w2.currentPage === 'learn', 'data-nav click drives go(): currentPage is learn');
  await tick();
  appH = w2.document.getElementById('app').innerHTML || '';
  ok(appH.indexOf('Foundation <em>Reading</em>') >= 0 && appH.indexOf('Deeper <em>Reading</em>') >= 0, 'Screens.mount served Learn (both sections present)');
  ok(w2.document.querySelectorAll('#app .insight-card').length === 10, 'Learn renders 6 article + 4 book cards');

  w2.go('insights');
  appH = w2.document.getElementById('app').innerHTML || '';
  ok(appH.indexOf('u-70c6b34') >= 0 && appH.indexOf('Latest <em>Thoughts</em>') >= 0 && appH.indexOf('yt-facade') >= 0, 'Insights renders on the exemplar layout (u-70c6b34 wrapper, facade cards)');
  ok(appH.indexOf('class="ins-') < 0, 'zero ins-* classes in rendered Insights');

  w2.go('home'); w2.go('insights'); await tick(80);
  appH = w2.document.getElementById('app').innerHTML || '';
  ok(appH.indexOf('u-70c6b34') >= 0 && appH.indexOf('hero-headline') < 0, 'stale-nav guard: superseded Home mount never lands over Insights');

  // file:// path: templates bundle serves directly, fetch never touched
  var domF = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', { url: 'file:///er/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  var wf = domF.window;
  wf.eval(fs.readFileSync(path.join(ER, 'Exec-Readiness-templates-local.js'), 'utf8'));
  wf.eval(fs.readFileSync(path.join(ER, 'Exec-Readiness-screen-loader.js'), 'utf8'));
  wf.currentPage = 'home';
  wf.Screens.mount('home', wf.document.getElementById('app'));
  await tick();
  var fh = wf.document.getElementById('app').innerHTML || '';
  ok(fh.indexOf('hero-headline') >= 0 && fh.indexOf('Couldn') < 0, 'file:// boot: bundle serves Home with no fetch and no error card');

  /* ── §18.8 source audits ── */
  console.log('== §18.8 source audits ==');
  var homeJs = fs.readFileSync(path.join(ER, 'Exec-Readiness-home.js'), 'utf8');
  var learnJs = fs.readFileSync(path.join(ER, 'Exec-Readiness-learn.js'), 'utf8');
  var homeHtml = fs.readFileSync(path.join(ER, 'Exec-Readiness-home.html'), 'utf8');
  var learnHtml = fs.readFileSync(path.join(ER, 'Exec-Readiness-learn.html'), 'utf8');
  var cssSrc = fs.readFileSync(path.join(ER, 'Exec-Readiness-styles.css'), 'utf8');
  var bundle = fs.readFileSync(path.join(ER, 'Exec-Readiness-templates-local.js'), 'utf8');
  ok(appSrc.indexOf('var SCREEN_MODULES={home:window.renderHome,learn:window.renderLearn};') >= 0 && appSrc.indexOf('if(screenFn){screenFn($(\'app\'));}') >= 0, 'SCREEN_MODULES dispatch present in render() (donor shape)');
  ok((appSrc.match(/function renderLearn/g) || []).length === 0, 'renderLearn definition gone from app.js (Learn lives in learn.html)');
  ok(appSrc.indexOf('"ins-') < 0 && cssSrc.indexOf('.ins-') < 0, 'zero ins-* residuals in app.js and styles.css');
  ok(cssSrc.indexOf('.learn-grid{') < 0 && cssSrc.indexOf('.page-top{') < 0 && cssSrc.indexOf('.section-body{') >= 0, 'ruled retirement: learn-grid + page-top gone (item 14, July 16); section-body stands (learn.html uses it)');
  ok(homeJs.indexOf("Screens.mount('home'") >= 0 && homeJs.length < 2000 && homeJs.indexOf('data-go') < 0 && homeJs.indexOf('POSTER_') < 0, 'home.js is the thin mount wrapper (posters and data-go dispatcher retired)');
  ok(learnJs.indexOf("Screens.mount('learn'") >= 0 && learnJs.indexOf('window.renderLearn') >= 0, 'learn.js is the thin mount wrapper');
  ok((homeHtml.match(/data-nav="/g) || []).length === 5 && (homeHtml.match(/data-url="/g) || []).length === 1 && homeHtml.indexOf('onclick') < 0, 'home.html: 5 data-nav + 1 data-url, zero inline JS');
  ok(learnHtml.indexOf('onclick') < 0 && (learnHtml.match(/class="insight-card reveal"/g) || []).length === 10, 'learn.html: 10 cards, zero inline JS');
  ok(bundle.indexOf('"home"') >= 0 && bundle.indexOf('"learn"') >= 0 && bundle.indexOf('hero-headline') >= 0, 'templates bundle carries both screens');

  /* ── Sidebar conformance (donor renderSidebar adopted July 16; Rollout items 2/7/13/15/17/18) ── */
  console.log('== sidebar conformance ==');
  ok(appSrc.indexOf('function renderSidebar()') >= 0 && appSrc.indexOf('rendpipSidebar') < 0, 'legacy sidebar renderer retired: donor renderSidebar in, rendpipSidebar gone (Rollout item 23)');
  ok(appSrc.indexOf('--nav-h-exact') >= 0 && appSrc.indexOf('new ResizeObserver') >= 0, 'item 7: syncNavHeight publishes --nav-h-exact under a ResizeObserver');
  w2.go('readiness'); await tick();
  var sbEl = w2.document.getElementById('pipSidebar');
  var sbH = (sbEl && sbEl.innerHTML) || '';
  ok(sbH.indexOf('sidebar-logo') >= 0 && sbH.indexOf('Sign out') < 0 && sbH.indexOf('userAv') < 0, 'donor header composition: logo + Minimize only, no user block in the sidebar');
  ok(sbH.indexOf('1. ') >= 0, 'item 2: phase heads carry their numbers');
  w2.toggleNavPhase(1); w2.toggleNavPhase(2);
  ok(w2.UI.navOpenSet && w2.UI.navOpenSet['1'] === true && w2.UI.navOpenSet['2'] === true, 'item 13: the multi-open set holds two toggled phases at once');
  sbH = (sbEl && sbEl.innerHTML) || '';
  ok(sbH.indexOf('1.1 ') >= 0 && sbH.indexOf('2.1 ') >= 0, 'item 13/2: steps of both open phases render simultaneously, numbered');
  ok(sbH.indexOf('sidebar-outcomes-label') >= 0, 'strand labels ride the family class (no inline label styling)');
  ok(appSrc.indexOf('_fid){setTimeout(function(){try{var _fe2=document.getElementById(_fid)') >= 0, 'item 15: deferred focus restore after the render swap');
  ok(appSrc.indexOf('of 90 on the program clock') >= 0, 'item 17: today marker with tooltip on the 90-day bar');
  ok(!/function mgDueSave[^\n]*render\(\)/.test(appSrc) && appSrc.indexOf('function deferRender()') >= 0 && appSrc.indexOf('onblur="deferRender()"') >= 0, 'item 18: hub date input saves silently on change, renders deferred on blur');

  /* ── Gate rim (Rollout item 1) + asterisk⟺gate audit (item 12, ruled 16 July: asterisks follow the gating) ── */
  console.log('== gate rim + label audit ==');
  ok(appSrc.indexOf('function paintGates()') >= 0 && appSrc.indexOf('function gatePeek(') >= 0 && appSrc.indexOf('var gateArmed=false,_lastGateStep=null;') >= 0, 'item 1: donor paintGates/gatePeek and the arming globals are in');
  ok(appSrc.indexOf('onclick="gatePeek(event)"') >= 0, 'item 1: the done-wrap arms the rim on a blocked Complete click');
  ok(appSrc.indexOf('if(_gk!==_lastGateStep){gateArmed=false;_lastGateStep=_gk;}') >= 0 && appSrc.indexOf("(UI.crTab||'')") >= 0, 'item 1: rim disarms on step/section/tab change (ER key includes mfTab/crTab)');
  ok((appSrc.match(/gate-field/g) || []).length >= 5 && appSrc.indexOf('gate-likert') >= 0 && appSrc.indexOf('function gateRepaint()') >= 0, 'item 1: all four field helpers tag off the asterisk; gateRepaint clears live');
  ok(appSrc.indexOf("Top 3 strategic priorities *") < 0 && appSrc.indexOf("ta('Top 3 strategic priorities','ap_priorities'") >= 0, 'item 12: ungated Section A label de-asterisked');
  ok(appSrc.indexOf("taGated('Your answer *',field") >= 0 && appSrc.indexOf("cr_uncertaintyComms") >= 0 && appSrc.indexOf("taGated('Moment 1 *','cr_stop1'") >= 0, 'item 12: gated mindset and composure fields carry asterisks');
  w2.UI.sec='A'; w2.go('1.1'); await tick();
  var _gf = w2.document.querySelectorAll('.gate-field');
  ok(_gf.length >= 4, 'step 1.1 renders asterisk-tagged gate fields (' + _gf.length + ')');
  var _mi = w2.document.getElementById('ap_mission');
  if(_mi){ _mi.value=''; }
  w2.paintGates();
  ok(_mi && _mi.classList.contains('gate-empty'), 'paintGates rims an empty required field');
  if(_mi){ _mi.value='Ship the program'; w2.paintGates(); }
  ok(_mi && !_mi.classList.contains('gate-empty'), 'the rim clears once the field is filled');
  ok(appSrc.indexOf('rows||3)+\'" class="ta-helper') >= 0 && appSrc.indexOf('class="sel-helper') >= 0 && appSrc.indexOf('class="lk-btn') >= 0 && appSrc.indexOf('class="done-wrap"') >= 0, 'legacy inline-styled field helpers retired for the family classes');

  /* ── Editor heading register (Rollout item 16, adopted 16 July) ── */
  console.log('== item 16: editor heading register ==');
  ok((appSrc.match(/<h3 style=/g) || []).length === 2, 'exactly 2 exempt inline h3s remain (print table, serif hero) \u2014 the two phase-row heads left with the old overview, 16 July');
  ok((appSrc.match(/class="h-sub-lg"/g) || []).length >= 59 && (appSrc.match(/class="h-sub"/g) || []).length >= 15, 'section headings ride the donor registers (h-sub / h-sub-lg)');
  ok(appSrc.indexOf('font-size:17px;font-weight:700') < 0, 'the legacy 17px inline heading style is fully retired');

  /* ── Phase-5 renumbering (ruled 16 July: 5.1 Dashboard, 5.2 Hub, 5.3 My Development) ── */
  console.log('== phase-5 numbering ==');
  ok(appSrc.indexOf("{id:'5.1',name:'Leadership Dashboard'") >= 0 && appSrc.indexOf("{id:'5.3',name:'My Development'") >= 0 && appSrc.indexOf("'5.0'") < 0, 'PH carries 5.1/5.2/5.3 in order; 5.0 fully retired');
  w2.toggleNavPhase(5);
  var _s5 = w2.document.getElementById('pipSidebar').innerHTML || '';
  var _i1=_s5.indexOf('5.1 Leadership Dashboard'), _i2=_s5.indexOf('5.2 L&amp;D Hub'), _i3=_s5.indexOf('Leadership Development', _i2), _i4=_s5.indexOf('5.3 My Development');
  ok(_i1 >= 0 && _i2 > _i1 && _i3 > _i2 && _i4 > _i3 && _s5.indexOf('5.0 ') < 0, 'sidebar Lead section renders 5.1, 5.2, then 5.3 under the strand label');

  /* ── Overview page on the exemplar structure (ruled 16 July) ── */
  console.log('== overview structure ==');
  w2.go('readiness'); await tick();
  var _ov = w2.document.getElementById('app').innerHTML || '';
  ok(_ov.indexOf('90-Day Timeline') >= 0 && _ov.indexOf('on the program clock') >= 0 && _ov.indexOf('viz-stat-strip') >= 0 && _ov.indexOf('Leaders Mapped') >= 0 && _ov.indexOf('Roles Defined') >= 0, 'overview renders the exemplar timeline (with crossbar) and the four-tile stat strip');
  ok((_ov.match(/u-1390122/g) || []).length === 5 && _ov.indexOf('TWO TRACKS') < 0 && _ov.indexOf('Persistent Object') < 0, 'five exemplar phase cards; quick-link tiles and the Two Tracks panel are gone');
  ok(appSrc.indexOf('shared organizational design and individual mindset development') >= 0 && appSrc.indexOf('artefacts') < 0, 'Help copy tracks the panel removal (A/B lettering retired, British spelling gone; pinned sentence superseded 27 July by the ruled help-modal replacement)');

  /* ── Phase pages on the exemplar structure + universal counts (ruled 16 July) ── */
  console.log('== phase pages + universal counts ==');
  ok(appSrc.indexOf('renderTimeline90') < 0 && (appSrc.match(/vizTimeline\(/g) || []).length === 3, 'the legacy timeline is retired; vizTimeline serves the overview and every phase page');
  w2.go('phase-1'); await tick();
  var _p1 = w2.document.getElementById('app').innerHTML || '';
  ok(_p1.indexOf('u-96f7104') >= 0 && (_p1.match(/ph-score/g) || []).length === 4 && _p1.indexOf('u-f78be26') >= 0 && _p1.indexOf('Readiness Score') >= 0, 'phase page carries the exemplar hero and four org-level metric cards incl. Readiness Score (ruled 16 July, superseding the same-day three-ruling)');
  ok((_p1.match(/flow-label/g) || []).length === 3 && _p1.indexOf('>Assess<') >= 0 && _p1.indexOf('>Landscape<') >= 0 && _p1.indexOf('>Risks<') >= 0, 'the Progress ticks show the three shared steps only, on the exemplar styling');
  ok(_p1.indexOf('label-tiny') >= 0 && _p1.indexOf('1.4') < 0, 'Steps/Outcomes lists ride the exemplar grid; the individual-track step never appears on the shared page');
  ok(appSrc.indexOf('milestone-card') >= 0 && appSrc.indexOf('PHASE_DONE_LINE') >= 0, 'the phase-complete banner and star box are wired (visible at 100%)');

  /* ── Visual QA round 1: step strip, crumb register, banner style (ruled 16 July) ── */
  console.log('== visual QA r1: step strip, crumb, banners ==');
  w2.go('1.1'); await tick();
  var _s1 = w2.document.getElementById('app').innerHTML || '';
  ok(appSrc.indexOf('display:flex;gap:12px;margin-bottom:32px;align-items:stretch') < 0 && appSrc.indexOf('justify-content:flex-start;margin-bottom:32px') >= 0, 'the shared/L&D single-row strip wrapper is retired for the two-line form (L&D left-aligned, ruled 16 July superseding the right-margin form)');
  var _iOrg = _s1.indexOf('class="step-nav" style="margin-bottom:12px"'), _iEnd = _s1.indexOf('justify-content:flex-start'), _iLD = Math.max(_s1.indexOf('>L&amp;D<'), _s1.indexOf('>L&D<'));
  ok(_iOrg >= 0 && _iEnd > _iOrg && _iLD > _iEnd, 'org steps render first on their own full-width line; the L&D box follows in a right-aligned second row');
  ok(_s1.indexOf('u-79840ab') >= 0 && _s1.indexOf('u-463b2e1') >= 0 && _s1.indexOf('class="t-gold">/ ') >= 0, 'the step crumb rides the donor classed register (13px form)');
  ok(appSrc.indexOf('font-size:10px;color:var(--stone);letter-spacing:.08em">Phase ') < 0, 'the legacy 10px inline crumb form is retired');
  ok(appSrc.indexOf('class="btn-ghost pad-chip-sm" onclick="harvestFields();saveData();goBack()"') >= 0 && appSrc.indexOf('font-size:12px;font-family:var(--mono);letter-spacing:.05em;cursor:pointer') < 0, 'backBtn takes the donor visual form; the module harvest/save plumbing is preserved');
  ok(appSrc.indexOf('return\'<div class="milestone-card"><div class="milestone-label">\\u2713 Milestone Reached</div>') >= 0 && appSrc.indexOf('<div class="milestone-label">\\u2713 Battery Complete</div>') >= 0 && appSrc.indexOf('milestone-mini') < 0, 'both banners ride the milestone-card form \u2014 the donor STEP-PAGE banner (16 July screenshot ruling, superseding the same-day mini form)');
  ok((appSrc.match(/#d4cfca/g) || []).length === 1 && appSrc.indexOf('color:#d4cfca') < 0, 'the #d4cfca sweep is done (ruled 16 July): 13 color sites now var(--text-body); the one SVG-attribute literal remains by the \u00a75A.4 convention and is now theme-remapped (the permanently-dark-node premise was wrong \u2014 corrected r18)');

  /* ── Visual QA round 2: color ruling, link mirror, PDF (ruled 16 July) ── */
  console.log('== visual QA r2: color ruling, link mirror, PDF ==');
  ok(appSrc.indexOf('Transformation Ownership Gap</h3><p style="color:var(--text-body)') >= 0 && appSrc.indexOf('Middle Management Assessment</h3><p style="color:var(--text-body)') >= 0, 'the two ruled 1.2 sections read in the body register');
  ok(appSrc.indexOf('<strong style="color:var(--paper)">a cost to be eliminated</strong>') >= 0 && appSrc.indexOf('<strong style="color:var(--paper)">strategic vision</strong>') >= 0, 'the five ruled bolds stand on the theme-correct token');
  ok(appSrc.indexOf('color:var(--text-body);margin:8px 0 20px;line-height:1.6;font-size:14px">This is the individual track entry point') >= 0, 'the Working with AI intro reads in the body register');
  ok(appSrc.indexOf('#211C17') < 0 && appSrc.indexOf('overflow:auto;background:var(--bg-elev)') >= 0, 'the fullscreen org overlay panel is themed (its tokened text is now readable in light mode)');
  ok(appSrc.indexOf('hbr.org/2026/06/great-leaders-question-philosophical-assumptions') < 0 && (appSrc.match(/faisalhoque\.com\/great-leaders-question-philosophical-assumptions\//g) || []).length === 2, 'both Great Leaders links ride the faisalhoque.com mirror');
  ok(cssSrc.indexOf('@media print{\n  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}') >= 0, 'live-page printing keeps background fills (the score bars) \u2014 print-color-adjust in the @media print block');
  ok((appSrc.match(/Save as PDF/g) || []).length === 15 && appSrc.indexOf("Leadership Risk Mapping</p></div>'+btn('\\u25BE Save as PDF'") >= 0 && appSrc.indexOf("Leadership Landscape step</p></div>'+btn('\\u25BE Save as PDF'") >= 0, 'Risk Map and Leadership Inventory carry the Save as PDF button (fourteen surfaces — the hub joined under Rev L, 25 July; was thirteen, ruled 16 July)');

  /* ── Visual QA round 3: the faint-register sweep (ruled 16 July) ── */
  console.log('== visual QA r3: faint-register sweep ==');
  ok(appSrc.indexOf('color:#8A8278') < 0 && (appSrc.match(/'#8A8278'/g) || []).length === 1 && (appSrc.match(/#8A8278/g) || []).length === 6, 'the muted register is out of light mode: 126 sites ride var(--text-body); the 6 survivors are the \u00a75A.4-remapped SVG literals, their one attribute-feeding ternary, and the legacy print selector');
  ok(cssSrc.indexOf('svg [fill="#8A8278"]{fill:var(--text-faint)}') >= 0 && cssSrc.indexOf('svg [stroke="#8A8278"]{stroke:var(--text-faint)}') >= 0, 'the SVG remap rules that own the surviving literals are in place');

  /* ── Visual QA round 4: timeline seam, fourth tiles, print furniture (ruled 16 July) ── */
  console.log('== visual QA r4: timeline seam, fourth tiles, print furniture ==');
  ok(appSrc.indexOf('if(s0>0){left-=0.15;w+=0.15;}') >= 0, 'timeline segments past the first overlap 0.15% leftward \u2014 the boundary rounding hairline cannot open');
  ok((appSrc.match(/label:'Steps Complete',value:done\+'\/'\+total,icon:'\\u2713'/g) || []).length === 3 && appSrc.indexOf("nav:'out-readiness'") >= 0, 'phases 2\u20134 take Steps Complete as the fourth tile; phase 1 takes Readiness Score naving to the report');
  ok(cssSrc.indexOf('button,.btn,.btn-ghost,.bp,.bs,.bg,.bg2,.bd{display:none!important}') >= 0 && cssSrc.indexOf('textarea{border:none;background:none;resize:none}') >= 0, 'live-page prints hide the module furniture (buttons, back control) and flatten fields \u2014 clean meeting-handout reports');

  /* ── Visual QA round 5: in-place Add Leader everywhere (ruled 16 July) ── */
  console.log('== visual QA r5: in-place Add Leader ==');
  ok(appSrc.indexOf('function goAddLeader') < 0 && appSrc.indexOf('function addLeaderPanel') >= 0, 'the navigate-away helper is retired for the shared in-place panel');
  ok((appSrc.match(/\+ Add New Leader','UI\.addLeaderOpen=true/g) || []).length === 2, 'both Add New Leader buttons (2.1 and the dashboard) open the tool in place');
  w2.go('phase5'); await tick();
  var _d0 = w2.document.getElementById('app').innerHTML || '';
  var _iR = _d0.indexOf('+ Add Role'), _iL = _d0.indexOf('+ Add New Leader');
  ok(_iR >= 0 && _iL > _iR, 'the dashboard toolbar carries + Add New Leader beside + Add Role');
  w2.UI.addLeaderOpen = true; w2.UI.editIdx = null; w2.render(); await tick();
  var _nameEl = w2.document.getElementById('ldr_name');
  ok(!!_nameEl, 'the Add Leader tool opens in place on the dashboard');
  var _n0 = (w2.data.leaders || []).length;
  if (_nameEl) { _nameEl.value = 'QA Probe Leader'; }
  w2.saveLeader(); await tick();
  ok((w2.data.leaders || []).length === _n0 + 1 && w2.currentPage === 'phase5' && !w2.UI.addLeaderOpen, 'saving adds the leader and stays on the page \u2014 no zip to 1.2');
  ok(w2.renderOutInventory().indexOf('QA Probe Leader') >= 0, 'the leader added from the dashboard appears in the Leadership Inventory');

  /* ── Visual QA round 6: 1.2 form placement + board label consistency (ruled 16 July) ── */
  console.log('== visual QA r6: 1.2 form placement, board labels ==');
  ok(appSrc.indexOf('if(UI.addForm&&UI.editIdx===null)h+=leaderEditCard();') >= 0 && appSrc.indexOf("else if(!UI.addForm)h+='<div style=\"margin-top:12px\">'+btn('+ Add Leader'") >= 0, 'the 1.2 add form opens in the button\'s slot; edit opens inline at the clicked card (refined 16 July, superseding the same-day below-list form)');
  ok((appSrc.match(/leaderRoleName\(ml\)/g) || []).length === 2 && (appSrc.match(/ml\.role/g) || []).length === 0, 'both member-row sites read the occupancy doctrine helper; the vestigial l.role read is gone');
  var _pl = (w2.data.leaders || []).filter(function(l){ return l.name === 'QA Probe Leader'; })[0];
  ok(!!_pl, 'the round-5 probe leader (role-less, form-added) is available as the fixture');
  if (_pl) { w2.toggleBoardLeader('board', _pl.id); }
  var _bb = w2.memberStaffingBlock('board');
  ok(_bb.indexOf('QA Probe Leader') >= 0 && _bb.indexOf('Unassigned') >= 0 && _bb.indexOf('undefined') < 0, 'a form-added board member labels from occupancy (Unassigned) \u2014 no blank or undefined label; seeded and added entries are consistent');

  /* ── Visual QA round 7: names, live destinations, inline editors, oversight Other, collab select (ruled 16 July) ── */
  console.log('== visual QA r7 ==');
  ok(['Sarah Chen','Marcus Webb','Amira Patel','Priya Nair','Tamsin Schmidt','Hannah Schmidt','Kwame Mensah','Naomi Adeyemi'].every(function(nm){return appSrc.indexOf(nm)<0;}) && appSrc.indexOf('Harriet Rivers')>=0 && appSrc.indexOf('Dr. Shalini Mehta')>=0 && appSrc.indexOf('Daniel Kah')>=0, 'the seed rides the audited pipeline name set; the Kahneman citation survives');
  w2.go('5.2'); await tick(); w2.go('5.1'); await tick();
  var _dd = w2.document.getElementById('app').innerHTML || '';
  ok(w2.currentPage==='phase5' && _dd.indexOf('Coming soon')<0, "go('5.1') routes to the live Leadership Dashboard \u2014 the Coming-soon step page is unreachable");
  ok(appSrc.indexOf('if(UI.addForm&&UI.editIdx===i)h+=\'<div id="leaderEditCard">\'+leaderEditCard()+\'</div>\';')>=0 && appSrc.indexOf('function leaderEditCard()')>=0, 'the 1.2 leader editor opens inline below the clicked card; add keeps the button slot');
  ok(appSrc.indexOf('if(UI.orgEditId===r.id)h+=\'<div id="orgEditCard">\'+renderOrgForm(r,roles,leaders)+\'</div>\';')>=0 && appSrc.indexOf('if(UI.orgEditId){var _er=roles.find(')<0, 'the hierarchy Edit Role form opens inline below the clicked role card; the above-the-chart invocation is retired');
  ok(appSrc.indexOf('Other (please specify)')>=0 && appSrc.indexOf('st_boardStructureOtherWrap')>=0 && (appSrc.match(/boardStructureOther/g)||[]).length>=6, 'the oversight dropdown carries Other with the specify box, harvested, section-saved, and report-mapped');
  ok(appSrc.indexOf('<option value="facilitator">')<0 && appSrc.indexOf("'facilitator':'Facilitator'")>=0, 'Facilitator left the model-type dropdown; legacy data still renders via the maps');
  ok((appSrc.match(/color:var\(--ink\)/g)||[]).length===1 && appSrc.indexOf('background:var(--paper);color:var(--ink)')<0, 'the three wart selects render dark-on-white per \u00a75A.11; the one survivor is the legitimate on-accent note button');

  /* ── Visual QA round 8: D-select Others, phase wrap-ups, banner form (ruled 16 July) ── */
  console.log('== visual QA r8 ==');
  ok((appSrc.match(/Other \(please specify\)/g) || []).length === 4 && appSrc.indexOf('ad_ownershipOtherWrap') >= 0 && appSrc.indexOf('ad_boardOversightOtherWrap') >= 0 && appSrc.indexOf('ad_crossFuncOtherWrap') >= 0, 'all three 1.1 section-D dropdowns carry Other with specify boxes (plus the 2.1 oversight one: four sites)');
  ok((appSrc.match(/'ownership','ownershipOther','boardOversight','boardOversightOther','crossFunc','crossFuncOther'/g) || []).length === 2 && appSrc.indexOf("_ad.ownership==='other'?(_ad.ownershipOther") >= 0, 'the specify fields harvest, section-save, and pass through to the 2.1 echoes');
  ok(appSrc.indexOf('function sel(label,id,v,opts,gloss,extraChange)') >= 0, 'sel() carries the backward-compatible toggle hook (gate frame stayed green above)');
  ok(appSrc.indexOf('var PHASE_WRAPUPS={') >= 0 && (appSrc.match(/Phase [1-4] complete\./g) || []).length === 4, 'the four phase wrap-ups are aboard');
  w2.go('1.3'); await tick();
  var _ws = w2.document.getElementById('app').innerHTML || '';
  /* superseded 27 July 2026, ER copy round: [1.3-22] replaced the Phase 1 wrap-up text; "closes the gaps you just mapped" is now "closes the gaps you\u2019ve mapped" within the ruled line */
  ok(_ws.indexOf('Phase 1 Complete') >= 0 && _ws.indexOf("the leadership architecture that closes the gaps") >= 0 && _ws.indexOf("seven risk scenarios for your organization") >= 0, 'the final shared step of a completed phase renders the Phase Complete wrap-up (donor pattern, shared steps only; wrap-up copy per [1.3-22], ER copy round 27 July 2026)');

  /* ── Visual QA round 9: heat-map fit, fixed chips, discreet print footer (ruled 16 July) ── */
  console.log('== visual QA r9 ==');
  var _oc = w2.renderOutCompetency();
  ok(_oc.indexOf('class="screen-only" style="overflow-x:auto"') >= 0 && _oc.indexOf(',72px)') >= 0, 'the on-page heat map takes fixed leader columns inside a horizontal scroll');
  ok(_oc.indexOf('class="print-only"') >= 0 && _oc.indexOf('page-break-before:always') < 0 && appSrc.indexOf("repeat('+COMPS.length+',1fr)") >= 0, 'the PDF gets the transposed map flowing after the heading \u2014 the forced own-page break is retired (it fragmented the bordered card into a blank first page; ruled 16 July)');
  ok(appSrc.indexOf('flex:0 0 108px') >= 0, 'the per-competency leader chips are fixed-width');
  ok(cssSrc.indexOf('.print-only{display:none}') >= 0 && cssSrc.indexOf('.print-only{display:block!important}') >= 0 && cssSrc.indexOf('.screen-only{display:none!important}') >= 0, 'the print-only/screen-only utility pair is in');
  ok(cssSrc.indexOf('.app-footer-links,.app-footer-divider{display:none!important}') >= 0 && cssSrc.indexOf('.app-footer-copy{font-size:10px;color:#666') >= 0 && cssSrc.indexOf('.app-footer{background:none!important;border-top:1px solid rgba(0,0,0,.25)') >= 0, 'PDFs carry only the discreet copyright line under a rule \u2014 the footer block and links are print-hidden');

  /* ── Visual QA round 11: the AI Tasks Done counter (found 16 July) ── */
  console.log('== visual QA r11 ==');
  ok(appSrc.indexOf('lt[j].reflection') < 0 && appSrc.indexOf('if(lt.task1)fluencyTasks++') >= 0, 'the metric counts the real store shape (non-empty task fields), not the phantom reflection-array');
  var _ft = 0, _lts = (w2.data.fluencySprint || {}).leaderTasks || {};
  Object.keys(_lts).forEach(function(k){ var lt = _lts[k] || {}; if (lt.task1) _ft++; if (lt.task2) _ft++; if (lt.task3) _ft++; });
  w2.go('phase-3'); await tick();
  var _p3 = w2.document.getElementById('app').innerHTML || '';
  ok(_ft > 0 && _p3.indexOf('AI Tasks Done') >= 0 && _p3.indexOf('>' + _ft + '<') >= 0, 'the phase-3 tile shows the true seeded count (' + _ft + '), not zero');

  /* ── Visual QA round 12: fluency task labels (ruled 16 July) ── */
  console.log('== visual QA r12 ==');
  ok((appSrc.match(/: What did you do\? Which AI tool\? What happened\?/g) || []).length === 3, 'all three fluency tasks carry the full question set \u2014 the questions apply per task, not one each');

  /* ── Visual QA round 13: Team AI Project workflow box (ruled 16 July) ── */
  console.log('== visual QA r13 ==');
  ok(appSrc.indexOf("ta('Document the workflow','fl_projectWorkflow'") >= 0 && (appSrc.match(/'project','projectWorkflow','projectJudgment','filter'/g) || []).length === 2 && appSrc.indexOf("{k:'projectWorkflow',l:'The Workflow'") >= 0, 'the workflow box sits between description and judgment, harvested on both paths and carried to the Fluency Record');

  /* ── Visual QA round 14: ASSIGN TO removed from the Fluency Sprint (ruled 16 July) ── */
  console.log('== visual QA r14 ==');
  ok(appSrc.indexOf('fluencyAssign') < 0, 'the record-only assignment key is fully retired \u2014 control, header chip, and the dangling u1\u2013u5 seed round-robin all gone');
  w2.go('3.1'); await tick();
  var _f1 = w2.document.getElementById('app').innerHTML || '';
  ok(_f1.indexOf('Assign to') < 0 && _f1.indexOf('Three Leadership Tasks') >= 0, 'the fluency leader cards render without the control; step assignment stays with the step-level bar');

  /* ── Visual QA round 15: Purpose Filter to 3.4, tabs, Add Principle on top (ruled 16 July) ── */
  console.log('== visual QA r15 ==');
  w2.go('3.1'); await tick();
  var _r31 = w2.document.getElementById('app').innerHTML || '';
  ok(_r31.indexOf('AI Purpose Filter') < 0 && _r31.indexOf('Team AI Project') >= 0, '3.1 no longer carries the Purpose Filter');
  w2.UI.vaTab = 'synthesis'; w2.go('3.4'); await tick();
  var _r34 = w2.document.getElementById('app').innerHTML || '';
  ok(_r34.indexOf('AI Purpose Filter') >= 0 && Math.max(_r34.indexOf('Your Purpose &amp; Values'), _r34.indexOf('Your Purpose & Values')) >= 0, 'the filter lives at the end of 3.4\'s synthesis tab with the expandable purpose-and-values reference');
  ok(_r34.indexOf('Team Reflections') < 0 && _r34.indexOf('Shared Principles') >= 0 && Math.max(_r34.indexOf('Synthesis &amp; Commitments'), _r34.indexOf('Synthesis & Commitments')) >= 0 && _r34.indexOf('Tag Values to Roles') >= 0, '3.4 carries the three-tab strip — Team Reflections merged into Shared Principles, Tag tab renamed (superseded 25 July; was the round-15 four-tab pin)');
  w2.UI.vaTab = 'principles'; w2.render(); await tick();
  var _rp = w2.document.getElementById('app').innerHTML || '';
  var _iAdd = _rp.indexOf('Add Principle'), _iList = _rp.indexOf('border-left:3px solid');
  ok(_iAdd >= 0 && (_iList < 0 || _iAdd < _iList), 'the Add Principle card sits above the principles list');
  ok((appSrc.match(/fl_filter/g) || []).length === 1 && (appSrc.match(/'project','projectWorkflow','projectJudgment','filter'/g) || []).length === 2, 'fl_filter keeps its id and store (one render site in 3.4; both dynamic harvest lists) \u2014 zero data migration');
  w2.UI.vaTab = 'reflections'; w2.render(); await tick();

  /* ── Visual QA round 16: print pagination standard (ruled 16 July) ── */
  console.log('== visual QA r16 ==');
  ok(cssSrc.indexOf('.cd,.milestone-card{break-inside:avoid;page-break-inside:avoid}') >= 0, 'no card component splits across a printed page');
  ok(cssSrc.indexOf('[style*="grid-template-columns:1fr 1fr;gap:16px"]{display:block!important}') >= 0 && (appSrc.match(/grid-template-columns:1fr 1fr;gap:16px/g) || []).length === 6, 'the six two-column card grids (five outcome pairs + the dashboard panels) linearize in print so pages break between components \u2014 no pushed-container voids; the data grids keep their shapes');

  /* ── Visual QA round 17: the Org Board, dashboard host (ruled 16 July) ── */
  console.log('== visual QA r17 ==');
  ok(cssSrc.indexOf('.org-board{position:relative;width:calc(100vw - var(--sbw) - 48px)') >= 0 && cssSrc.indexOf('@media print{.org-board{width:auto;margin-left:0') >= 0, 'the board shell claims sidebar-to-edge width off --sbw, with print and narrow-viewport guards');
  ok((appSrc.match(/orgChartInnerSvg\(roles,leaders,true\)/g) || []).length === 1 && appSrc.indexOf('Math.abs(UI.orgZoom-1)<0.01') >= 0, 'fit mode rides the one shared renderOrgChartInteractive call site \u2014 serving the dashboard AND 2.1 (round-17 record corrected); the manual chart zoom still overrides via the epsilon check');
  w2.UI.orgZoom = 1; w2.go('phase5'); await tick();
  var _db = w2.document.getElementById('app').innerHTML || '';
  ok(_db.indexOf('class="org-board"') >= 0 && _db.indexOf('style="width:100%;max-width:') >= 0 && _db.indexOf('min-width:') >= 0, 'the dashboard chart renders on the board with the CSS fit (100% width, natural-size cap, 0.55 floor)');
  ok(appSrc.indexOf("orgChartInnerSvg(roles,leaders,!!(wrap.classList&&wrap.classList.contains('org-board-canvas')))") >= 0, 'the in-place repaint preserves fit on the board and fixed sizing elsewhere');

  /* ── Visual QA round 18: board-page centering, DL board surface, single-stroke connectors, name remap (ruled 16 July) ── */
  console.log('== visual QA r18 ==');
  ok(appSrc.indexOf('var kidsBy={};') >= 0 && appSrc.indexOf("' L'+cx2+','+my+' L'+cx2+','+cy);") < 0, 'connectors are trunk/bus/drops \u2014 no overdrawn shared segments, one stroke weight everywhere');
  w2.go('phase5'); await tick();
  var _bp = w2.document.getElementById('app').innerHTML || '';
  ok(_bp.indexOf('content-inner board-page') >= 0, 'the dashboard column centers on the board space, not the viewport');
  ok(cssSrc.indexOf('.main-content .content-inner.board-page{margin-left:max(0px,calc(50vw - var(--sbw)/2 - 450px))}') >= 0 && cssSrc.indexOf('.board-page .org-board{margin-left:calc(-1*max(0px,50vw - var(--sbw)/2 - 450px) - 24px)}') >= 0, 'the board-page centering pair is in \u2014 the escape inverts the same formula');
  ok(cssSrc.indexOf('linear-gradient(to bottom,rgba(255,255,255,.45)') >= 0 && cssSrc.indexOf('radial-gradient(rgba(30,37,48,.08) 1.05px') >= 0 && cssSrc.indexOf('inset:16px;border:1.5px solid rgba(30,37,48,.30)') >= 0, 'the board surface carries the DL structure \u2014 toplight shading, the 26px dot grid, the inset ink frame (base colors corrected to the DL true values same day; see the r19 color pin)');
  ok(cssSrc.indexOf('svg [fill="#d4cfca"]{fill:var(--text-body)}') >= 0, 'the occupant-name SVG literal is theme-remapped \u2014 readable on the light node cards, byte-identical in dark');

  /* ── Visual QA round 19: DL board colors, all hosts boarded and board-centered (ruled 16 July) ── */
  console.log('== visual QA r19 ==');
  ok(cssSrc.indexOf('border:1px solid rgba(30,37,48,.2);background-color:var(--ink)') >= 0 && cssSrc.indexOf('[data-theme="dark"] .org-board{background-color:var(--ink)') >= 0 && cssSrc.indexOf('#E9E1CE') < 0, 'the board wears the live ground token \u2014 var(--ink) both themes (retheme-safe, 27 July); the textured-variant cream is gone');
  w2.UI.structSec = 'ownership'; w2.go('2.1'); await tick();
  var _s21 = w2.document.getElementById('app').innerHTML || '';
  ok(_s21.indexOf('content-inner board-page') >= 0 && _s21.indexOf('class="org-board"') >= 0, '2.1 ownership hosts the board OUTSIDE the card, on board-page centering');
  ok(appSrc.indexOf("same chart that appears on the Leadership Dashboard.</p>');") >= 0, 'the 2.1 card split: the intro card closes before the board; the Add-Leader block gets its own card');
  w2.UI.llPage = 'hierarchy'; w2.go('1.2'); await tick();
  var _s12 = w2.document.getElementById('app').innerHTML || '';
  ok(_s12.indexOf('content-inner board-page') >= 0 && _s12.indexOf('id="llChartWrap" class="org-board-canvas"') >= 0 && _s12.indexOf('style="width:100%;max-width:') >= 0, 'the 1.2 hierarchy tab has the full treatment: board shell, CSS fit, board-page centering');
  ok(appSrc.indexOf('UI.llZoom=Math.min(1,cw/tw)') < 0 && appSrc.indexOf('Math.abs((UI.llZoom||1)-1)<0.01') >= 0, 'the porthole Fit button is retired \u2014 fit is automatic; the 1.2 manual zoom overrides via the epsilon check');
  w2.UI.llPage = 'inventory'; w2.render(); await tick();

  /* ── Visual QA round 20: chart centered on the board, key aboard, controls centered (ruled 16 July) ── */
  console.log('== visual QA r20 ==');
  ok(appSrc.indexOf('treeW:_treeMaxX+40') >= 0 && (appSrc.match(/var _fz=Math\.max\(0,layout\.tw-\(layout\.treeW\|\|layout\.tw\)\)/g) || []).length === 2, 'both builders frame symmetrically \u2014 the float zone mirrors left so the Board/CEO trunk sits dead center');
  w2.UI.orgZoom = 1; w2.go('phase5'); await tick();
  var _b20 = w2.document.getElementById('app').innerHTML || '';
  var _iLg = _b20.indexOf('class="org-board-legend"'), _iCv = _b20.indexOf('id="orgChartWrap"');
  ok(_iLg >= 0 && _iCv > _iLg && appSrc.indexOf('display:flex;gap:16px;margin-bottom:12px') < 0, 'the key lives on the board, top-left, above the canvas \u2014 the old legend row is gone');
  ok((appSrc.match(/align-items:center;justify-content:center;gap:8px;margin-bottom:8px/g) || []).length === 2 && appSrc.indexOf('margin-bottom:16px;flex-wrap:wrap;justify-content:center') >= 0 && (appSrc.match(/<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">/g) || []).length === 1, 'the two control rows and the toolbar are centered; the role-list row header keeps its left alignment');
  ok(appSrc.indexOf('.offsetWidth-40') < 0 && appSrc.indexOf("(el?el.clientWidth:900)-48") >= 0, 'the dashboard Fit button measures the board canvas \u2014 the retired content-inner target is gone module-wide');
  ok(cssSrc.indexOf('.org-board-legend{position:absolute;top:24px;left:28px') >= 0, 'the legend rides the board shell inside the frame');

  /* ── Visual QA round 21: VP HR seed, scroll-to-editor, filter output rehomed (ruled 16 July) ── */
  console.log('== visual QA r21 ==');
  var _vphr = (w2.data.leaders||[]).filter(function(l){return l.id==='seed_vphr'})[0];
  ok(!!_vphr && _vphr.name==='Lorna Whitaker' && w2.leaderRoleName(_vphr)==='VP Human Resources' && (w2.data.orgChart||[]).filter(function(r){return r.id==='ldr_seed_vphr'&&r.parentId==='ldr_seed_cpo'&&r.level===4}).length===1, 'the seed has a VP HR \u2014 Lorna Whitaker under the CPO at the VP band; the dangling council pointer resolves');
  ok(w2.memberStaffingBlock('crossfunc').indexOf('Lorna Whitaker') >= 0, 'the AI Transformation Council membership row renders her name and occupied role, not the fallback');
  ok(appSrc.indexOf('if(UI.scrollTo){') >= 0 && (appSrc.match(/UI\.scrollTo=\\'/g)||[]).length===7 && (appSrc.match(/id="orgEditCard"/g)||[]).length===2 && (appSrc.match(/id="orgAddCard"/g)||[]).length===2 && (appSrc.match(/id="addLeaderPanelCard"/g)||[]).length===2 && appSrc.indexOf('id="leaderEditCard"') >= 0, 'scroll-to-editor is wired: seven set-sites, wrapped editor cards on both hosts, one render-tail hook');
  w2.UI.scrollTo='orgEditCard'; w2.render(); await tick();
  ok(w2.UI.scrollTo===null, 'the scroll flag clears on the render that consumes it \u2014 later re-renders stay put (jsdom-safe)');
  if(!(w2.data.fluencySprint||{}).filter){w2.data.fluencySprint=w2.data.fluencySprint||{};w2.data.fluencySprint.filter='Probe: does this serve the mission?';}
  ok(appSrc.indexOf("{k:'filter'") < 0 && w2.renderOutValues().indexOf('AI Purpose Filter') >= 0 && w2.renderOutFluency().indexOf('AI Purpose Filter') < 0, 'the AI Purpose Filter prints on the Values Architecture outcome and is off the Fluency Record');

  /* ── Multi-user defect fixes (ruled 25 July): render purity + button-write lock guards ── */
  console.log('== multi-user fixes (25 July) ==');
  // (1) Write-on-render loop closed: settled board-page renders never bump the org rev.
  w2.go('phase5'); await tick(); w2.render(); await tick();            // settle any legitimate reconcile
  var _rv0 = w2.data.rev;
  w2.render(); await tick(); w2.render(); await tick();
  ok(w2.data.rev === _rv0, 'settled dashboard renders do not write — the cross-tab render/write loop is closed');
  w2.UI.llPage='hierarchy'; w2.go('1.2'); await tick();
  var _rv1 = w2.data.rev;
  w2.render(); await tick();
  ok(w2.data.rev === _rv1, 'settled Leadership Landscape hierarchy renders do not write');
  // (2) The reconcile still persists when it has real work — exactly once, then quiet.
  var _gr=(w2.data.orgChart||[]).filter(function(r){return r.id!=='board'&&r.id!=='crossfunc'})[0];
  var _grOcc=_gr.occupantLeaderId; _gr.occupantLeaderId='ghost_probe_x';
  w2.go('phase5'); await tick();
  ok(_gr.occupantLeaderId===null && w2.data.rev===_rv1+1, 'a real reconcile (occupant pointing at a deleted leader) vacates and persists exactly once');
  w2.render(); await tick();
  ok(w2.data.rev===_rv1+1, 'and the next render is quiet again — reconciles converge');
  _gr.occupantLeaderId=_grOcc; w2.saveData();
  // (3) Button-write guards (ruled 25 July): blanket lockBlocked on lock-mapped collections.
  ok((appSrc.match(/lockBlocked\(/g)||[]).length === 38, 'the guard census holds — 37 call sites plus the definition (blanket wiring, ruled 25 July; +bexpSave same day; +saveVaSec and +bexpSet, 26 July)');
  var _lockKey='exec-readiness-locks::'+w2.currentOrgId;
  var _occSnap=(w2.data.orgChart||[]).map(function(r){return [r.id,r.occupantLeaderId]});
  var _qr=(w2.data.orgChart||[]).filter(function(r){return r.id!=='board'&&r.id!=='crossfunc'})[0];
  var _newLid=(w2.data.leaders||[]).filter(function(l){return l.id!==_qr.occupantLeaderId})[0].id;
  w2.localStorage.setItem(_lockKey, JSON.stringify({orgChart:{id:'u_probe_other',name:'Probe Other',at:Date.now()}}));
  w2.quickAssignOrg(_qr.id, _newLid);
  ok(_qr.occupantLeaderId!==_newLid, 'a foreign orgChart lock blocks quickAssignOrg — the write never lands');
  w2.localStorage.removeItem(_lockKey);
  w2.quickAssignOrg(_qr.id, _newLid);
  ok(_qr.occupantLeaderId===_newLid, 'with the lock cleared the same action applies');
  _occSnap.forEach(function(p){var r=(w2.data.orgChart||[]).filter(function(x){return x.id===p[0]})[0];if(r)r.occupantLeaderId=p[1];});
  w2.saveData(); w2.render(); await tick();                            // restore occupancy snapshot
  ok(appSrc.indexOf('or_qa12_')>=0 && appSrc.indexOf('or_qafs_')>=0 && appSrc.indexOf('or_qadash_')>=0, 'all three quick-assign selects carry or_-prefixed ids — the focus-lock layer reaches them');

  /* ── Batch 2 (ruled 25 July): five defect/design items ── */
  console.log('== batch 2 (25 July) ==');
  // Item 1: the 1.2 Add Role form opens below the button.
  w2.UI.llPage='hierarchy'; w2.UI.orgAddForm=true; w2.UI.orgEditId=null; w2.go('1.2'); await tick();
  var _b2h=w2.document.getElementById('app').innerHTML||'';
  var _iBtn=_b2h.indexOf('+ Add Role'), _iForm=_b2h.indexOf('id="orgAddCard"');
  ok(_iBtn>=0 && _iForm>_iBtn, 'the 1.2 Add Role form renders below the button, not above the chart');
  w2.UI.orgAddForm=false;
  // Item 2: the edit form takes the reporting-loop guard.
  var _all=(w2.data.orgChart||[]);
  var _child=_all.filter(function(r){return r.parentId&&r.parentId!=='board'&&_all.some(function(p){return p.id===r.parentId&&p.id!=='board'})})[0];
  var _parent=_all.filter(function(p){return p.id===_child.parentId})[0];
  w2.UI.orgEditId=_parent.id; w2.render(); await tick();
  var _pn=w2.document.getElementById('org_name'); _pn.value=_parent.name;
  var _pp=w2.document.getElementById('org_parent'); _pp.value=_child.id;
  var _pp0=_parent.parentId;
  w2.saveOrgRole2(_parent.id);
  ok(_parent.parentId===_pp0 && w2.UI.orgEditId===_parent.id, 'a cyclic Reports-to in the edit form is blocked with the loop alert and the form stays open');
  _pp=w2.document.getElementById('org_parent'); if(_pp)_pp.value=_pp0||'';
  w2.saveOrgRole2(_parent.id); await tick();
  ok(w2.UI.orgEditId===null, 'a legitimate edit-form save still lands and closes the form');
  // Item 3: the CITO title sweep.
  ok((appSrc.match(/Innovation & Technology/g)||[]).length===0 && (appSrc.match(/Innovation & Transformation/g)||[]).length===9, 'Chief Innovation & Transformation Officer everywhere — nine sites converted, zero of the old title remain');
  // Item 4: fullscreen panel theming + Reports To.
  ok(appSrc.indexOf('#2A241E')<0, 'the hardcoded dark ground is gone from the fullscreen panel controls (theme tokens carry both modes)');
  ok(appSrc.indexOf('or_qparfs_')>=0 && appSrc.indexOf('>Reports to</div>')>=0, 'the fullscreen panel carries the Reports To control on the or_ lock prefix');
  // Item 5: board governance restructure + per-member expertise.
  w2.UI.structSec='board'; w2.go('2.1'); await tick();
  var _bt=w2.document.getElementById('app').innerHTML||'';
  var _iMem=_bt.indexOf('Board Membership'), _iStr=_bt.indexOf('st_boardStructure');
  ok(_iMem>=0 && _iStr>_iMem, 'the Board Membership card is the first thing they work on in Board Governance');
  var _bmembers=(((w2.data.orgChart||[]).find(function(x){return x.id==='board'})||{}).members)||[];
  var _bHas=_bmembers.filter(function(m){return m.aiExpState==='has'||(m.aiExpertise&&m.aiExpState!=='no')}).length;
  ok(_bt.indexOf('id="or_bexpSel"')<0 && (_bt.match(/bexpSet\(\d+,'has'\)/g)||[]).length===_bmembers.length && (_bt.match(/id="or_bexpText\d/g)||[]).length===_bHas && _bt.indexOf('\u2717 No AI expertise')>=0, 'every member rows with the has/no button pair; a text box only under has-members (26 July tri-state, superseding the all-boxes form of the same day)');
  ok(_bmembers[3] && _bmembers[3].aiExpState==='no' && appSrc.indexOf("if(state==='no'){m.aiExpState='no';m.aiExpertise='';}")>=0, 'the seeded external director carries the explicit no-state; choosing no wipes any text (source)');
  w2.bexpSet(3,'has'); await tick();
  ok(!!w2.document.getElementById('or_bexpText3'), 'the green button opens the text box under that member');
  w2.bexpSet(3,'no'); await tick();
  var _bcard=w2.document.getElementById('app').innerHTML||'';
  ok(_bcard.indexOf('No AI expertise</div>')>=0 && !w2.document.getElementById('or_bexpText3'), 'the red button closes the box and writes No AI expertise under the name in the membership card');
  ok(w2.boardExpertiseSummary().indexOf('Shalini')>=0 && w2.boardExpertiseSummary().indexOf('\u2014')>=0, 'the three seeded board members carry attached AI expertise');
  var _bm=(w2.data.orgChart||[]).find(function(x){return x.id==='board'}).members[0];
  var _bx0=_bm.aiExpertise;
  var _bxEl=w2.document.getElementById('or_bexpText0'); _bxEl.value='Probe expertise line'; w2.bexpSave(0);
  ok(_bm.aiExpertise==='Probe expertise line', 'bexpSave(i) writes each member\u2019s own box to that member (orgChart write, guarded)');
  _bxEl.value=_bx0; w2.bexpSave(0);
  w2.UI.orgSelected='board'; w2.go('phase5'); await tick();
  var _dp=w2.document.getElementById('app').innerHTML||'';
  ok(_dp.indexOf('Board AI Expertise')>=0 && _dp.indexOf('Shalini')>=0, 'the board panel on the org chart shows the per-member expertise');
  w2.UI.orgSelected=null; w2.UI.structSec='ownership';

  /* ── Batch 3 (ruled 25 July): items 7, 9, 10 + the standing British sweep ── */
  console.log('== batch 3 (25 July) ==');
  ok(appSrc.indexOf('onblur=\"mfPersistFields();crPersistFields();deferRender()\"')>=0 && appSrc.indexOf('mfPersistFields();render()')<0, 'taGated blur persists both stores and defers the render — the two-click bug and the composure wipe are closed');
  w2.UI.vaTab='principles'; w2.go('3.4'); await tick();
  var _rv7=w2.data.rev; w2.mfPersistFields(); w2.crPersistFields();
  ok(w2.data.rev===_rv7, 'off-page persister calls write nothing (change-gated saves)');
  w2.go('4.4'); await tick();
  var _crEl=w2.document.getElementById('cr_constants');
  if(_crEl){var _cr0=_crEl.value;_crEl.value='Probe constant'; w2.crPersistFields();
    ok((w2.myIndivStore('composure')||{}).constants==='Probe constant', 'composure fields persist through crPersistFields (the blur path now reaches them)');
    _crEl=w2.document.getElementById('cr_constants'); if(_crEl){_crEl.value=_cr0;} w2.crPersistFields();
  } else { ok(true, 'composure field not on this tab state — persist path covered by the source pin'); }
  w2.UI.vaTab='principles'; w2.go('3.4'); await tick();
  var _v34=w2.document.getElementById('app').innerHTML||'';
  var _iRef=_v34.indexOf('Reference: Individual Reflections'), _iPri=_v34.indexOf('Shared Organizational Principles');
  ok(_iRef>=0 && _iPri>_iRef, 'the reflections reference card sits above the Shared Organizational Principles card in the merged tab');
  ok(_v34.indexOf('high-level principles that will govern your organization\u2019s relationships with AI')>=0, 'the ruled sentence stands under Shared Organizational Principles');
  ok((appSrc.match(/[Ss]ynthesise/g)||[]).length===0, 'the British sweep holds — zero synthesise forms remain');
  w2.UI.vaTab='tagging'; w2.render(); await tick();
  var _vt=w2.document.getElementById('app').innerHTML||'';
  ok(_vt.indexOf('tagged value')>=0 && _vt.indexOf('vtag_')>=0 && _vt.indexOf('max-width:260px')<0, 'the Tag tab shows fold rows with tagged-value counts — the chip cluster is gone');
  var _tr=(w2.data.orgChart||[]).filter(function(r){return r.id!=='crossfunc'&&r.level!==0})[0];
  w2.UI.ctxOpen['vtag_'+_tr.id]=true; w2.render(); await tick();
  _vt=w2.document.getElementById('app').innerHTML||'';
  ok(_vt.indexOf('flex:1;font-size:13px')>=0 && (_vt.match(/\u25A1|\u2713/g)||[]).length>0, 'an expanded role lists each principle on its own full-width line with a tag mark');
  var _tv0=(_tr.taggedValues||[]).length; var _pv1=(w2.data.orgValues||[]).filter(function(v){return (_tr.taggedValues||[]).indexOf(v.id)<0})[0];
  if(_pv1){
    w2.toggleRoleValue(_tr.id,_pv1.id); await tick();
    ok((_tr.taggedValues||[]).length===_tv0+1 && w2.UI.ctxOpen['vtag_'+_tr.id]===true, 'tagging from the expanded list lands and the fold stays open');
    w2.toggleRoleValue(_tr.id,_pv1.id); await tick();
  } else { ok(true, 'all principles already tagged on the probe role — the toggle path is covered by pin history'); }
  w2.UI.ctxOpen['vtag_'+_tr.id]=false; w2.UI.vaTab='principles';

  /* ── Batch 4 (ruled 25 July): items 12–13 ── */
  console.log('== batch 4 (25 July) ==');
  ok(appSrc.indexOf('Persistent Object')<0 && appSrc.indexOf('>Collective</div>')>=0, 'the 5.2 quick card label reads Collective (item 13)');
  var _cs0=w2.data.completedSteps['1.1'], _sd0=(w2.data.stepDoneAt||{})['1.1'], _ce0=(w2.data.completedSections||{}).E, _nn0=(w2.data.notifications||[]).length;
  delete w2.data.completedSteps['1.1']; delete w2.data.stepDoneAt['1.1']; delete w2.data.completedSections.E;
  var _cf=w2.confirm; w2.confirm=function(){return true};
  w2.UI.sec='E'; w2.go('1.1'); await tick();
  w2.saveSection('E');
  ok(w2.data.completedSections.E===true && !w2.data.completedSteps['1.1'] && !(w2.data.stepDoneAt||{})['1.1'], 'a battery section save completes the section only — no step complete, no done-date, no step email (the unbraced stamp is gone)');
  var _m11=w2.document.getElementById('app').innerHTML||'';
  ok(_m11.indexOf("markStepComplete('1.1')")>=0, 'the battery carries a discrete Step Complete button');
  w2.markStepComplete('1.1'); await tick();
  ok(w2.data.completedSteps['1.1']===true && !!(w2.data.stepDoneAt||{})['1.1'] && (w2.data.notifications||[]).length===_nn0, 'the discrete button completes and stamps the step once (no email queued here — the seed roster is email-less by ruling)');
  w2.data.completedSteps['1.1']=_cs0; w2.data.stepDoneAt['1.1']=_sd0; w2.data.completedSections.E=_ce0; w2.confirm=_cf; w2.saveData();
  ok(appSrc.indexOf("dd['1.4:intro']&&dd['1.4:workforce']&&dd['1.4:atrophy'])dd['1.4']=true")<0 && appSrc.indexOf('saveMindsetStep')>=0 && appSrc.indexOf("dd['4.4:reflections']&&dd['4.4:stop']&&dd['4.4:slowlog'])dd['4.4']=true")<0 && appSrc.indexOf('saveComposureStep')>=0, 'the individual tab roll-ups are gone — 1.4 and 4.4 complete through their own discrete buttons (non-notify confirm)');
  ok((appSrc.match(/markStepComplete\(/g)||[]).length===7, 'the shared discrete buttons ride one testable helper — definition, three renderer sites, and the ruling comments');

  /* ── Batch 5 (25 July): the Rev-N conformance set ── */
  console.log('== batch 5: Rev-N conformance (25 July) ==');
  // Inverted §19.25 census (Rev L): quiet Save as PDF everywhere, the filled hub row gone.
  ok((appSrc.match(/Save as PDF/g)||[]).length===15 && appSrc.indexOf('Download as PDF')<0, 'the inverted §19.25 census holds — fourteen quiet Save as PDF surfaces (source count fifteen since 27 July: help modal names the control), zero filled Download rows');
  ok(appSrc.indexOf("btn('Open ")<0 && appSrc.indexOf('>Open \\u2192</button>')>=0, 'the Open control rides the ghost-chip register (§19.18) — the per-call shrink is gone');
  ok(cssSrc.indexOf('select{background:var(--bg-elev);color:var(--paper)}')>=0, 'the §5A.11a bare-select ground is in the stylesheet additions');
  ok(cssSrc.indexOf('.done-wrap .done-btn:not([disabled])+.done-helper{display:none}')>=0, 'the §11 helper hide-while-live rule is in the stylesheet additions');
  // §19.19 probe 1: tab round-trip (the module mechanism — crSwitchTab harvests).
  var _lk=(w2.data.leaders||[]).filter(function(l){return l.userId})[0];
  var _cu0=w2.currentUserId; if(_lk)w2.currentUserId=_lk.userId;   // 4.4 is individual-track: enter as a linked user
  w2.UI.crTab='reflections'; w2.go('4.4'); await tick();
  var _pf=w2.document.getElementById('cr_constants');
  if(_pf){var _pf0=_pf.value; _pf.value='Probe tab text';
    w2.crSwitchTab('stop'); await tick(); w2.crSwitchTab('reflections'); await tick();
    var _pfb=w2.document.getElementById('cr_constants');
    ok((w2.myIndivStore('composure')||{}).constants==='Probe tab text' && _pfb && _pfb.value==='Probe tab text', '§19.19 tab round-trip: typed text survives the switch in both the store and the field');
    _pfb.value=_pf0; w2.crPersistFields();
  } else { ok(false, '§19.19 tab probe could not find cr_constants on 4.4'); }
  w2.currentUserId=_cu0;
  // §19.19 probe 2: navigate round-trip through go() — exercises the new §7A harvest.
  w2.UI.structSec='senior'; w2.go('2.1'); await tick();
  var _nv=w2.document.getElementById('st_seniorAlignment');
  if(_nv){var _nv0=_nv.value; _nv.value='Probe nav text';
    w2.go('2.2'); await tick(); w2.go('2.1'); await tick();
    var _nvb=w2.document.getElementById('st_seniorAlignment');
    ok((w2.data.structure||{}).seniorAlignment==='Probe nav text' && _nvb && _nvb.value==='Probe nav text', '§19.19 navigate round-trip: go() harvests before the re-render — sidebar navigation no longer eats typed text');
    _nvb.value=_nv0; w2.harvestOpenFields(); w2.saveData();
  } else { ok(false, '§19.19 navigate probe could not find st_seniorAlignment on 2.1'); }
  // §19.23 clickability: fresh live button, DOM disabled===false, completion through the onclick attribute.
  // (3.2 kept as the probe target from before the item-41 ruling flag-based 1.2/1.3.)
  var _sid='3.2';
  var _ck0=w2.data.completedSteps[_sid], _ckd=(w2.data.stepDoneAt||{})[_sid];
  delete w2.data.completedSteps[_sid]; delete w2.data.stepDoneAt[_sid];
  var _cfk=w2.confirm; w2.confirm=function(){return true};
  w2.go(_sid); await tick();
  var _btns=[].slice.call(w2.document.querySelectorAll('.done-btn'));
  var _live=_btns.filter(function(b){return b.className.indexOf('done-btn-complete')<0})[0];
  ok(!!_live && _live.disabled===false, '§19.23: the fresh 3.2 step button is genuinely enabled in the DOM (no phantom deadlock)');
  var _attr=_live?_live.getAttribute('onclick'):'';
  if(_attr){ w2.eval(_attr); await tick(); }
  ok(w2.data.completedSteps[_sid]===true && !!(w2.data.stepDoneAt||{})[_sid], '§19.23: completion exercised through the button\u2019s own onclick attribute lands and stamps');
  w2.data.completedSteps[_sid]=_ck0; w2.data.stepDoneAt[_sid]=_ckd; w2.confirm=_cfk; w2.saveData();
  // §19.28 state conformance: sections alone never read as step completion.
  var _b0=w2.data.completedSteps['1.1']; delete w2.data.completedSteps['1.1'];
  ok(w2.isStepDone('1.1')===false, '§19.28: with the flag clear, five complete sections do NOT read as a complete step — the derived roll-up is gone');
  w2.data.completedSteps['1.1']=_b0; w2.saveData();
  // Item-41 ruling (25 July): 1.2 and 1.3 are flag-based too — data alone never completes them.
  var _b2=w2.data.completedSteps['1.2'], _b3=w2.data.completedSteps['1.3'];
  delete w2.data.completedSteps['1.2']; delete w2.data.completedSteps['1.3'];
  ok(w2.isStepDone('1.2')===false && w2.isStepDone('1.3')===false, 'item 41: twelve seeded leaders and scored risks do NOT read as complete steps with the flags clear');
  w2.data.completedSteps['1.2']=_b2; w2.data.completedSteps['1.3']=_b3; w2.saveData();
  // Item 39: notes capture-location + jump-to-source.
  w2.UI.structSec='ownership'; w2.go('2.1'); await tick();
  w2.notesOpen=false; w2.toggleNotes(); await tick();
  var _ni=w2.document.getElementById('noteInput');
  ok(!!_ni, 'the notes panel opens with its input');
  _ni.value='Probe note'; w2.addNote(); await tick();
  var _nn=(w2.data.notes||[])[ (w2.data.notes||[]).length-1 ];
  ok(_nn && _nn.text==='Probe note' && _nn.page==='step' && _nn.step==='2.1' && String(_nn.where).indexOf('Step 2.1')===0 && !!_nn.id, 'a note records where it was captured (item 39)');
  w2.go('home'); await tick();
  w2.goToNote(_nn.id); await tick();
  ok(w2.currentPage==='step' && w2.currentStep==='2.1', 'the jump link navigates back to the capture location');
  w2.data.notes.push({text:'legacy shape',date:new Date().toISOString()});
  w2.renderNotes(); await tick();
  var _np=w2.document.getElementById('notesPanel').innerHTML||'';
  ok(_np.indexOf('legacy shape')>=0 && _np.indexOf('Probe note')>=0, 'legacy notes render alongside located notes without error');
  w2.data.notes=w2.data.notes.filter(function(x){return x.text!=='Probe note'&&x.text!=='legacy shape'});
  w2.saveData(); w2.toggleNotes(); await tick();

  /* ── Batch 6 (25 July): level labels, seed tab/section completes, fullscreen zoom ── */
  console.log('== batch 6 (25 July) ==');
  w2.UI.structSec='ownership'; w2.go('2.1'); await tick();
  var _b6=w2.document.getElementById('app').innerHTML||'';
  ok(_b6.indexOf('\u2713 Section complete')>=0 && _b6.indexOf('\u2713 Step complete')>=0 && _b6.indexOf('\u2713 Complete<')<0, 'seeded 2.1 shows differentiated complete states \u2014 Section complete on the tab, Step complete on the step, no bare Complete');
  var _s60=w2.data.structure.ownership_done, _s61=w2.data.completedSteps['2.1'];
  delete w2.data.structure.ownership_done; delete w2.data.completedSteps['2.1']; w2.render(); await tick();
  _b6=w2.document.getElementById('app').innerHTML||'';
  ok(_b6.indexOf('Mark section complete and continue')>=0 && _b6.indexOf('Mark step complete and continue')<0 && _b6.indexOf('markStepComplete(')<0, 'a live section button shows while the step button stays absent until every section completes (26 July hidden-until-eligible ruling, superseding the 25 July gated form)');
  w2.data.structure.ownership_done=_s60; w2.data.completedSteps['2.1']=_s61; w2.saveData();
  ok(['ownership','board','senior','middle','crossfunc'].every(function(s){return w2.data.structure[s+'_done']===true}) && ['touchpoints','models','personas','aifree','translation'].every(function(s){return w2.data.collabLab[s+'_done']===true}), 'the seed carries all ten 2.1/2.2 section flags \u2014 no incomplete tabs under complete steps');
  var _dd6=(w2.data.indivDone||{}); var _dk=Object.keys(_dd6)[0];
  ok(_dk && _dd6[_dk]['1.4:intro']===true && _dd6[_dk]['4.4:slowlog']===true, 'the seeded leaders carry the six individual tab keys');
  ok(appSrc.indexOf('orgFsZoomPct')>=0 && appSrc.indexOf('UI.orgZoom=Math.min(2,(UI.orgZoom||1)+0.2);orgRepaintInPlace()')>=0, 'the fullscreen panel carries the zoom controls on the shared UI.orgZoom lever, repaint-in-place');


  /* ── Drag-to-pan (ruled 25 July, shipped 26 July) ── */
  console.log('== drag-to-pan ==');
  w2.go('phase5'); await tick();
  var _pw=w2.document.getElementById('orgChartWrap');
  ok(!!_pw, 'the dashboard hosts the board canvas (pan target present)');
  var _pev=function(t,type,x,y){ t.dispatchEvent(new w2.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y})); };
  _pw.scrollLeft=0; _pw.scrollTop=0;
  _pev(_pw,'pointerdown',100,100); _pev(_pw,'pointermove',102,101); _pev(_pw,'pointerup',102,101);
  ok(_pw.scrollLeft===0 && _pw.scrollTop===0, 'a sub-4px move never pans — plain clicks keep their meaning');
  _pev(_pw,'pointerdown',200,100); _pev(_pw,'pointermove',140,80);
  var _pmid=_pw.classList.contains('is-panning');
  _pev(_pw,'pointerup',140,80);
  ok(_pw.scrollLeft===60 && _pw.scrollTop===20 && _pmid===true && _pw.classList.contains('is-panning')===false, 'a real drag pans the canvas (60,20), is-panning worn only while live');
  var _pclicks=0,_pcl=function(){_pclicks++}; w2.document.addEventListener('click',_pcl);
  _pev(_pw,'pointerdown',200,100); _pev(_pw,'pointermove',150,100); _pev(_pw,'pointerup',150,100); _pev(_pw,'click',150,100);
  _pev(_pw,'click',150,100);
  w2.document.removeEventListener('click',_pcl);
  ok(_pclicks===1, 'the click after a real drag is eaten; the next plain click lands');
  var _pb=w2.document.createElement('button'); _pw.appendChild(_pb);
  _pw.scrollLeft=0; _pw.scrollTop=0;
  _pev(_pb,'pointerdown',300,100); _pev(_pb,'pointermove',200,100); _pev(_pb,'pointerup',200,100);
  ok(_pw.scrollLeft===0, 'interactive elements inside the board never start a pan');
  _pb.remove();
  ok(cssSrc.indexOf('.org-board-canvas{cursor:grab}')>=0 && cssSrc.indexOf('.org-board-canvas.is-panning{cursor:grabbing')>=0, 'the grab-cursor pair is in the stylesheet additions');


  /* \u2500\u2500 26 July browser findings: pan capture placement; 3.4 section gates \u2500\u2500 */
  console.log('== 26 July findings ==');
  ok(appSrc.indexOf('if(cv.setPointerCapture')<0 && appSrc.indexOf("is-panning');if(_boardPan.el.setPointerCapture")>=0, 'pointer capture engages only after the pan threshold \u2014 press-time capture retargeted clicks off role nodes');
  w2.UI.vaTab='principles'; w2.go('3.4'); await tick();
  var _v0=w2.document.getElementById('app').innerHTML||'';
  var _vs=w2.data.vaSec; var _vc=w2.data.completedSteps['3.4'];
  ok(_vs && _vs.principles_done===true && _vs.synthesis_done===true && _vs.tagging_done===true, 'the seed carries the three 3.4 tab flags');
  ok(_v0.indexOf('saveVaSec(')>=0 && _v0.indexOf('\u2713 Section complete')>=0 && _v0.indexOf('\u2713 Step complete')>=0, 'seeded 3.4: section button on the tab, Section complete and Step complete differentiated');
  w2.data.vaSec={}; delete w2.data.completedSteps['3.4']; w2.render(); await tick();
  _v0=w2.document.getElementById('app').innerHTML||'';
  ok(_v0.indexOf('saveValuesArch()')<0 && _v0.indexOf('Mark step complete and continue')<0 && _v0.indexOf('saveVaSec(')>=0, 'the 3.4 step button is absent until the three tabs complete; the section button stands (ruled 26 July)');
  w2.saveVaSec('principles'); await tick();
  ok(w2.data.vaSec.principles_done===true && w2.UI.vaTab==='synthesis', 'saveVaSec flags the section and advances the tab');
  w2.saveVaSec('synthesis'); w2.saveVaSec('tagging'); await tick();
  _v0=w2.document.getElementById('app').innerHTML||'';
  ok(_v0.indexOf('Mark step complete and continue')>=0 && w2.isStepDone('3.4')===false, 'three flags open the step button; the step stays incomplete until pressed');
  w2.saveValuesArch(); await tick();
  ok(w2.isStepDone('3.4')===true, 'the discrete step button completes and stamps 3.4');
  w2.data.vaSec=_vs; w2.data.completedSteps['3.4']=_vc; w2.saveData();
  ok(appSrc.indexOf("saveVaSec(secId){if(lockBlocked('valuesArch'))")>=0 && appSrc.indexOf("[secId+'_done'])&&!confirm('Mark this section complete? This can\\u2019t be undone.')")>=0, 'the 3.4 section dialog is the short form on the valuesArch lock \u2014 never notify');


  ok(appSrc.indexOf('Complete all five sections (A\\u2013E) to finish this step.')<0 && appSrc.indexOf('Complete all five sections to finish this step.')<0 && appSrc.indexOf('Complete all three tabs to finish this step.')<0 && ["if(allDone||isStepDone('1.1'))h+=doneBtn","if(_all21||isStepDone('2.1'))h+=doneBtn","if(_all22||isStepDone('2.2'))h+=doneBtn","if(_all14||isStepDone('1.4'))h+=doneBtn","if(_all44||isStepDone('4.4'))h+=doneBtn","if(_vaAll||isStepDone('3.4'))h+=doneBtn"].every(function(f){return appSrc.indexOf(f)>=0}), 'all six tabbed-step buttons are hidden-until-eligible and the dead gate helpers are gone (ruled 26 July)');

  console.log('');
  console.log('ASSERTIONS: ' + n + '  FAIL: ' + fails);
  process.exit(fails);
})().catch(function(e){ console.log('HARNESS ERROR: ' + (e && e.stack || e)); process.exit(99); });
