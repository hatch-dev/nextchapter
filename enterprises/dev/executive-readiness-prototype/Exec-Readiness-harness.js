#!/usr/bin/env node
/* ── CANONICAL CLOCK ────────────────────────────────────────────
   Executive Readiness pins derive under a clock frozen at
   2026-07-16 12:00 (the §18.9 Stage-1 authoring date). ER's seed
   anchors the program clock at (today − 89 days) and derives 17
   stepDoneAt dates from it, so both realms (harness + app sandbox)
   must share this instant or the mechanically derived pins rot at
   month boundaries (the harness time bomb, first fired in the
   exemplar July 10, 2026). Pins constructed with explicit date
   arguments are unaffected; zero-arg `new Date()` and `Date.now()`
   return the canonical instant. */
const __RealDate = Date;
const __CANON = new __RealDate(2026, 6, 16, 12, 0, 0).getTime();
const __FrozenDate = class extends __RealDate {
  constructor(...a) { a.length === 0 ? super(__CANON) : super(...a); }
  static now() { return __CANON; }
};
Date = __FrozenDate; // eslint-disable-line no-global-assign
/* ───────────────────────────────────────────────────────
   harness.js — behavioral harness for Executive Readiness
   §18.9 Stages 1–2, ported from the Pipeline exemplar harness
   (donor identity 7b087a4cc3898609471c846c9af91f38, 3,523 lines).

   Pattern (donor-verbatim): load app.js into a Node `vm` context with
   Proxy-element DOM stubs, a permissive document.getElementById,
   stubbed confirm/alert/addEventListener, an in-memory localStorage,
   then bootstrap an org and call seedData()/emptyData() and assert on
   rendered HTML strings and on `data` mutations.

   Stage 1 carries the invariant-seam frames (LOAD/BOOT/SEED/RENDER/
   EMPTY/MG/INSIGHTS/ADMIN/AUTH/MU/BOOT2/RULINGS/THEME/WARN); Stage 2
   adds the ER module frames (ST/CW/NT/OC/IT/SEED-2/NOTES). Chat frames
   wait on revisit item 13; form-driven savers are browser QA. THEME follows
   Spec §5A.13 (light default) — the donor copy's dark-default frame
   is superseded drift, logged donor-side.

   Grows with every change. A failing assertion is investigated in
   BOTH directions — the app may be wrong, or the assertion may be.
   ─────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = process.env.ER_APP || path.join(__dirname, 'Exec-Readiness-app.js'); /* ER_APP: run against another build, e.g. a negative control */
const code = fs.readFileSync(APP, 'utf8');

/* ── assertion plumbing (donor-verbatim) ────────────────────── */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(label); }
}
function eq(actual, expected, label) {
  ok(JSON.stringify(actual) === JSON.stringify(expected),
     label + '  (got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected) + ')');
}
function has(str, sub, label) {
  ok(typeof str === 'string' && str.indexOf(sub) >= 0, label + '  (missing "' + sub + '")');
}
function nonEmptyStr(v, label) {
  ok(typeof v === 'string' && v.length > 0, label + '  (not a non-empty string)');
}
function noThrow(fn, label) {
  try { const r = fn(); pass++; return r; }
  catch (e) { fail++; failures.push(label + '  (threw: ' + (e && e.message) + ')'); return undefined; }
}

/* ── DOM / browser stubs (donor-verbatim) ───────────────────── */
const NUM = {scrollTop:1,scrollHeight:1,scrollLeft:1,scrollWidth:1,offsetTop:1,offsetLeft:1,
  offsetWidth:1,offsetHeight:1,clientTop:1,clientLeft:1,clientWidth:1,clientHeight:1,
  selectionStart:1,selectionEnd:1,length:1,childElementCount:1};
const STR = {innerHTML:1,outerHTML:1,textContent:1,innerText:1,value:1,className:1,id:1,
  name:1,type:1,href:1,src:1,title:1,placeholder:1,tagName:1,nodeName:1};

function classList() {
  const s = Object.create(null);
  return {
    add()    { for (let i=0;i<arguments.length;i++) s[arguments[i]]=1; },
    remove() { for (let i=0;i<arguments.length;i++) delete s[arguments[i]]; },
    toggle(c,f){ const want = (f===undefined) ? !s[c] : !!f; if(want){s[c]=1;return true;} delete s[c]; return false; },
    contains(c){ return !!s[c]; }
  };
}
function el(tag) {
  const t = {
    style: new Proxy({}, { get:(o,k)=> (k in o ? o[k] : ''), set:(o,k,v)=>{o[k]=v;return true;} }),
    classList: classList(), dataset: {}, children: [], childNodes: [],
    tagName: (tag||'div').toUpperCase(), nodeName: (tag||'div').toUpperCase(),
    nodeType: 1, value: '', innerHTML: '', textContent: '', className: '', id: ''
  };
  return new Proxy(t, {
    get(o, k) {
      if (typeof k === 'symbol') return o[k];
      if (k in o) return o[k];
      if (k === 'parentNode' || k === 'parentElement' || k === 'firstChild' ||
          k === 'lastChild' || k === 'nextSibling' || k === 'previousSibling') return null;
      if (k === 'files') return [];
      if (NUM[k]) return 0;
      if (STR[k]) return '';
      if (k === 'querySelector') return () => el();
      if (k === 'querySelectorAll') return () => [];
      if (k === 'closest' || k === 'matches') return () => null;
      if (k === 'getBoundingClientRect') return () => ({top:0,left:0,right:0,bottom:0,width:0,height:0});
      if (k === 'getAttribute') return () => null;
      if (k === 'cloneNode') return () => el();
      if (k === 'appendChild' || k === 'insertBefore' || k === 'replaceChild') return (a)=>a;
      return () => el();                       // permissive no-op method → chainable
    },
    set(o, k, v) {
      o[k] = v;
      // DOM-faithful reflection: ER's esc() is div-based (textContent in,
      // innerHTML out); a real div escapes & < > on that path.
      if (k === 'textContent') o.innerHTML = String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return true;
    }
  });
}

const _byId = Object.create(null);
const documentStub = {
  getElementById(id){ if(!_byId[id]){ _byId[id]=el(); _byId[id].id=id; } return _byId[id]; },
  querySelector(){ return el(); },
  querySelectorAll(){ return []; },
  createElement(t){ return el(t); },
  createDocumentFragment(){ return el(); },
  createTextNode(){ return el(); },
  addEventListener(){}, removeEventListener(){},
  readyState:'complete', activeElement:null,
  body: el('body'), documentElement: el('html'), head: el('head'), title:''
};

const _ls = new Map();
const localStorageStub = {
  getItem(k){ return _ls.has(k) ? _ls.get(k) : null; },
  setItem(k,v){ _ls.set(k, String(v)); },
  removeItem(k){ _ls.delete(k); },
  clear(){ _ls.clear(); },
  key(i){ return Array.from(_ls.keys())[i] || null; },
  get length(){ return _ls.size; }
};

let alerts = [];
const sandbox = {
  console,
  localStorage: localStorageStub,
  document: documentStub,
  matchMedia: () => ({ matches:false, media:'', addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }),
  addEventListener(){}, removeEventListener(){},
  open(){ return null; },
  scrollTo(){},
  confirm: () => true,               // seedData() is gated on confirm()
  alert: (m) => { alerts.push(String(m)); },
  prompt: () => null,
  setTimeout: () => 0, clearTimeout(){},
  setInterval: () => 0, clearInterval(){},
  requestAnimationFrame: () => 0, cancelAnimationFrame(){},
  FileReader: function(){ this.readAsText=()=>{}; this.readAsDataURL=()=>{}; this.addEventListener=()=>{}; },
  fetch: () => Promise.resolve({ ok:false, status:0, text:()=>Promise.resolve(''), json:()=>Promise.resolve({}) }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  crypto: require('crypto').webcrypto, TextEncoder, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  sessionStorage: (function(){ const m = new Map(); return { getItem(k){ return m.has(k) ? m.get(k) : null; }, setItem(k,v){ m.set(k, String(v)); }, removeItem(k){ m.delete(k); }, clear(){ m.clear(); } }; })()
};
vm.createContext(sandbox);
sandbox.Date = __FrozenDate; // canonical clock in the app realm too — see header
sandbox.window = sandbox;            // window.* resolves onto the same global
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

/* ── LOAD ───────────────────────────────────────────────────── */
noThrow(() => vm.runInContext(fs.readFileSync(path.join(path.dirname(APP), 'dev-auth-server.js'), 'utf8'), sandbox, { filename:'dev-auth-server.js' }),
        'LOAD: dev-auth-server.js (the dev stand-in for the sign-in server) loads before app.js');
noThrow(() => vm.runInContext(code, sandbox, { filename:'app.js' }),
        'LOAD: app.js executes top-level (render + init IIFEs) without throwing');

const G = sandbox;   // the app's globals live here

/* ── BOOTSTRAP: org → seed ──────────────────────────────────── */
let boot;
noThrow(() => { boot = G.createOrg('Harness Org', {name:'Owner', username:'owner', passcode:'1234'}); },
        'BOOT: createOrg() succeeds');
if (boot) { G.currentUserId = boot.userId; }
noThrow(() => { if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster(); },
        'BOOT: applyTeamRoster()');
noThrow(() => G.seedData(), 'BOOT: seedData() runs (incl. its internal render())');

const d = G.data;
ok(d && typeof d === 'object', 'BOOT: data is populated after seed');

const iso = t => new __RealDate(t).toISOString().split('T')[0];
/* the composite seed identity used by every frame's restore check
   (ER has no money ledger; this is the module's cheap invariant) */
function seedIdent() {
  return (G.data.roster||[]).length === 11 &&
         Object.keys(G.data.stepDoneAt||{}).length === 17 &&
         (G.data.enterprise||{}).name === 'Aurora Windows';
}

/* ── SEED INTEGRITY (Executive Readiness seed, §18.7 build) ─── */
eq((d.roster||[]).length, 11, 'SEED: roster carries the facilitator plus ten leaders');
ok(d.roster[0] && d.roster[0].id === 'u_fac' && d.roster[0].admin === true, 'SEED: u_fac facilitator is the admin');
eq(G.currentUserId, 'u_fac', 'SEED: seeding signs in the facilitator via Auth.setSession');
eq((d.enterprise||{}).name, 'Aurora Windows', 'SEED: demo organization is Aurora Windows');
eq((d.members||[]).length, 0, 'SEED: legacy members slot stays empty (roster is canonical)');
eq(d.startDate, iso(Date.now() - 89*86400000), 'SEED: program clock anchored 89 days back (frozen-clock derived)');
eq(Object.keys(d.stepDoneAt||{}).length, 17, 'SEED: 17 mechanically derived stepDoneAt dates');
ok(Object.keys(d.stepDoneAt||{}).every(k => /^\d{4}-\d{2}-\d{2}$/.test(d.stepDoneAt[k])), 'SEED: every stepDoneAt is a bare ISO date');
ok(Object.keys(d.stepDoneAt||{}).every(k => d.stepDoneAt[k] >= d.startDate && d.stepDoneAt[k] <= iso(Date.now())), 'SEED: every stepDoneAt lies inside the program window');
eq((d.notifications||[]).length, 0, 'SEED: notifications literally reset (no seed storm)');
eq(JSON.stringify(d.remind7||{}), '{}', 'SEED: remind7 literally reset');
const mgIds = (typeof G.mgSteps === 'function') ? G.mgSteps().map(s => String(s.id)) : [];
eq(mgIds.length, 13, 'SEED: 13 countable shared steps (Ongoing phase and individual-track steps excluded — ruled 16 July)');
ok(mgIds.every(id => id.charAt(0) !== '5'), 'SEED: no phase-5 id among countable steps');
ok(mgIds.every(id => (d.completedSteps||{})[id] === true), 'SEED: the seeded program is complete (every countable shared step flagged)');
ok(seedIdent(), 'SEED: composite seed identity holds (the restore anchor for every frame)');

/* ── RENDER STRINGS: renderers return HTML and never throw ──── */
const RENDER_FNS = ['renderOverview','renderDashboard','renderMgmtHub','renderInsights','renderEntry'];
RENDER_FNS.forEach(fn => {
  if (typeof G[fn] === 'function') {
    const out = noThrow(() => G[fn](), 'RENDER: ' + fn + '() runs');
    nonEmptyStr(out, 'RENDER: ' + fn + '() returns non-empty HTML');
  } else {
    ok(false, 'RENDER: ' + fn + ' is defined');
  }
});
(function(){
  const _cs = G.currentStep;
  G.currentStep = '1.1';
  const out = noThrow(() => G.renderStep(), 'RENDER: renderStep() runs on the 1.1 fixture');
  nonEmptyStr(out, 'RENDER: renderStep() returns non-empty HTML');
  const ph = noThrow(() => G.renderPhaseHome(1), 'RENDER: renderPhaseHome(1) runs');
  nonEmptyStr(ph, 'RENDER: renderPhaseHome(1) returns non-empty HTML');
  G.currentStep = _cs;
})();

/* ── EMPTY STATE: emptyData() is a clean slate ──────────────── */
(function(){
  const e = G.emptyData();
  eq(Object.keys(e.completedSteps||{}).length, 0, 'EMPTY: no completed steps');
  eq((e.notifications||[]).length, 0, 'EMPTY: no notifications');
  eq((e.risks||[]).length, 0, 'EMPTY: no risks');
  eq((e.leaders||[]).length, 0, 'EMPTY: no leaders');
})();

/* ── MG: Module Management hub (ported; ER registry, 17 steps) ──
   Controlled frame: start 35 days back, two stamped completions at
   days 7 and 20 (weeks 2 and 3), one overdue deadline. Hand-derived:
   done 2/13; velocity bars in W2 and W3; delta negative
   (2 < ideal ≈ 35/90×13 ≈ 4.7). */
(function(){
  const snap = {};
  ['completedSteps','stepDoneAt','stepDue','assigns','notifications','remind7'].forEach(k => snap[k] = JSON.stringify(G.data[k] || null));
  const sd0 = G.data.startDate;
  const sd = Date.now() - 35 * 86400000;
  G.data.startDate = iso(sd);
  G.data.completedSteps = { '1.1': true, '1.2': true };
  G.data.stepDoneAt = { '1.1': iso(sd + 7 * 86400000), '1.2': iso(sd + 20 * 86400000) };
  G.data.stepDue = { '1.3': iso(Date.now() - 2 * 86400000), '2.1': iso(Date.now() + 3 * 86400000) };
  G.data.assigns = { '1.1': [G.USERS[0] ? G.USERS[0].id : 'x'], '2.2': [G.USERS[0] ? G.USERS[0].id : 'x'] };
  const st = G.mgStats();
  eq(st.total, 13, 'MG: thirteen countable shared steps (Ongoing phase and individual-track steps excluded — ruled 16 July)');
  eq(st.done, 2, 'MG: done count from the flags');
  ok(st.delta < 0, 'MG: two done at day ~35 is behind the ideal pace');
  eq(st.overdue, 1, 'MG: one overdue deadline');
  G.UI.mgTab = 1;
  const pg = G.renderMgmtHub();
  G.UI.mgTab = 0;
  const pgA = G.renderMgmtHub();
  has(pg, 'TODAY \u00b7 2/13', 'MG: burn-up TODAY dot carries the count');
  has(pg, 'Module Velocity', 'MG: velocity card renders');
  has(pg, 'Workload by Member', 'MG: workload card on Analytics (open vs complete)');
  has(pg, 'Signals', 'MG: signals card renders');
  has(pg, '1 open \u00b7 1 complete', 'MG: workload splits open vs complete per member (hand-set: 1.1 done, 2.2 open)');
  ok(pgA.indexOf("mgDueSave('1.1'") < 0, 'MG: completed steps have no clickable deadline input');
  ok(pgA.indexOf("mgDueSave('2.1'") >= 0, 'MG: open steps keep the deadline input');
  has(pgA, 'overdue \u00b7 was due', 'MG: overdue badge on the step row (Assignments tab)');
  has(pgA, 'This Week', 'MG: week panel renders on the Assignments tab');
  ok(pgA.indexOf('90-Day Burn-up') < 0, 'MG: burn-up lives on Analytics only');
  const vel = G.mgVelocity();
  ok(vel.indexOf('Week 2: 1 step') >= 0 && vel.indexOf('Week 3: 1 step') >= 0, 'MG: velocity buckets land in weeks 2 and 3 (days 7 and 20)');
  G.mgDueSave('2.2', iso(Date.now() + 86400000));
  eq(G.data.stepDue['2.2'], iso(Date.now() + 86400000), 'MG: deadline saves');
  G.mgDueSave('2.2', '');
  ok(!G.data.stepDue['2.2'], 'MG: empty value clears the deadline');
  const u0 = G.USERS[0];
  if (u0) {
    G.mgAssignToggle('2.1', u0.id);
    ok((G.data.assigns['2.1'] || []).indexOf(u0.id) >= 0, 'MG: assignment toggles on');
    G.mgAssignToggle('2.1', u0.id);
    ok((G.data.assigns['2.1'] || []).indexOf(u0.id) < 0, 'MG: assignment toggles off');
  }
  ok(pgA.indexOf('UI.assignOpen=UI.assignOpen===') >= 0, 'MG: the assign trigger renders on every step row (ER assignBtn affordance)');
  ok(pgA.indexOf("toggleAssign('2.2'") < 0, 'MG: the member fold is closed until its trigger is used');
  G.UI.assignOpen = '2.2';
  const pgP = G.renderMgmtHub();
  ok(pgP.indexOf("toggleAssign('2.2'") >= 0, 'MG: opening the fold lists members through toggleAssign (hub delegates to the step-page system)');
  G.UI.assignOpen = null;
  ['completedSteps','stepDoneAt','stepDue','assigns','notifications','remind7'].forEach(k => { G.data[k] = JSON.parse(snap[k]); });
  G.data.startDate = sd0;
  G.saveData();
  ok(seedIdent(), 'MG: restore returns the seed identity');
})();

/* ─── INSIGHTS: page renders on the conformed layout, tabs switch ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  eq(G.insightsTab, 'latest', 'INSIGHTS: insightsTab is declared and defaults to latest');
  const out = G.renderInsights();
  ok(out.length > 500, 'INSIGHTS: base fixture renders substantive HTML');
  has(out, 'u-70c6b34', 'INSIGHTS: the exemplar layout wrapper carries the page (§18.8)');
  ok(out.indexOf('class="ins-') < 0, 'INSIGHTS: zero ins-* classes after the §18.8 conformance');
  has(out, 'insight-filter active" data-itab="latest"', 'INSIGHTS: the latest tab renders active by default');
  G.setInsightsTab('worth');
  has(G.renderInsights(), 'insight-filter active" data-itab="worth"', 'INSIGHTS: setInsightsTab moves the active class on re-render');
  G.setInsightsTab('latest');
  ok(G.LATEST_THOUGHTS.length > 0 && G.CONVERGENCE_EPISODES.length > 0 && G.WORTH_YOUR_TIME.length > 0, 'INSIGHTS: the three content sets carry entries');
  ok(G.LATEST_THOUGHTS.every(function(it){ return !!G.INSIGHT_SOURCES[it.src]; }), 'INSIGHTS: every article resolves its outlet');
  ok(G.LATEST_THOUGHTS.every(function(it){ return /^https?:\/\//.test(it.url || ''); }), 'INSIGHTS: every article carries a real link');
  has(G.renderInsights(), G.esc(G.LATEST_THOUGHTS[0].title), 'INSIGHTS: the page renders the first article');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'INSIGHTS: restore returns the seed identity');
})();

/* ─── ADMIN GUARDS: colorless avatars, delete-current-org (revisit item 6, implemented this session) ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const av = noThrow(() => G.userAv({initials:'X'}), 'ADMIN: userAv survives a record with no color');
  has(av, '#888888', 'ADMIN: colorless avatar falls back to the neutral swatch');
  G.data.roster.push({id:'qa_nocolor', name:'No Color', initials:'NC'});
  G.saveData();
  const _cm0 = G.currentModal; G.currentModal = 'admin';
  noThrow(() => G.renderAdminModal(), 'ADMIN: the admin console survives an org containing a colorless user');
  G.currentModal = _cm0;
  const cur = G.currentOrgId, before = G.getOrgs().length;
  G.createOrg('QA Guard Org', null);
  const other = G.getOrgs().filter(function(o){ return o.id !== cur; })[0].id;
  if (G.currentOrgId !== cur) G.switchToOrg(cur);
  eq(G.getOrgs().length, before + 1, 'ADMIN: second org exists for the delete-guard check');
  const _ia10 = G.isAppAdmin; G.isAppAdmin = true; /* Sweep 4R item 10: the console's functions are the app administrator's */
  G.adminDeleteOrg(cur);
  ok(!!G.getOrg(cur) && G.getOrgs().length === before + 1, 'ADMIN: deleting the current org is blocked (donor guard adopted) — registry unchanged');
  G.adminDeleteOrg(other);
  eq(G.getOrgs().length, before, 'ADMIN: a non-current org still deletes (guard is narrow)');
  G.isAppAdmin = _ia10;
  G.data = JSON.parse(_snap); G.saveData();
})();

/* ─── AUTH (Part 5, 2 Oct 2026): the browser checks no password and keeps none; each call is one request (5.3) ─── */
(function(){
  const sent = []; const _f = G.fetch;
  G.fetch = function(url, o){ sent.push({url: String(url), method: (o && o.method) || 'GET', body: o && o.body ? JSON.parse(o.body) : undefined}); return new Promise(function(){}); };
  const E = G.AUTH_ENDPOINT;
  ok(E === '/__dev-auth', 'AUTH: the dev build points AUTH_ENDPOINT at the stand-in');
  G.Auth.signIn('maria', 'Secret#2026', true, function(){});
  G.Auth.signInAdmin('admin', 'Secret#2026', function(){});
  G.Auth.currentSession(function(){});
  G.Auth.changePassword('Old#2026x', 'New#2026x', function(){});
  G.Auth.changeAdminPassword('Old#2026x', 'New#2026x', function(){});
  G.Auth.setTemporaryPassword('org1', 'u1', 'Temp#2026x', function(){});
  G.Auth.signOut(function(){});
  const want = [
    ['POST', '/session', {username:'maria', password:'Secret#2026', remember:true}],
    ['POST', '/admin-session', {username:'admin', password:'Secret#2026'}],
    ['GET', '/session', undefined],
    ['POST', '/password', {current:'Old#2026x', next:'New#2026x'}],
    ['POST', '/admin/password', {current:'Old#2026x', next:'New#2026x'}],
    ['POST', '/admin/temporary-password', {orgId:'org1', userId:'u1', temporary:'Temp#2026x'}],
    ['POST', '/sign-out', {}],
  ];
  want.forEach(function(w, i){
    const s = sent[i] || {};
    ok(s.method === w[0] && s.url === E + w[1] && JSON.stringify(s.body) === JSON.stringify(w[2]), 'AUTH 5.3: ' + w[0] + ' ' + w[1] + ' sends exactly ' + JSON.stringify(w[2]), s);
  });
  G.fetch = _f;
  ['signIn','signInAdmin','currentSession','changePassword','changeAdminPassword','setTemporaryPassword','signOut'].forEach(function(k){ ok(typeof G.Auth[k] === 'function', 'AUTH 5.3: Auth.' + k); });
  ok(typeof G.findUserByLogin === 'undefined' && typeof G.adminCreds === 'undefined' && typeof G.setAdminCreds === 'undefined' && !('defaultPasscode' in G.Auth) && !('ensurePasscode' in G.Auth), 'AUTH 5.2.3: the in-browser sign-in checks are gone');

  /* the rule (5.1) */
  const P = G.passwordProblem;
  eq(P('abc1!'), 'Use at least 8 characters.', 'RULE 5.8.1: abc1! is too short');
  eq(P('abcdefgh'), 'Include at least one number.', 'RULE 5.8.1: abcdefgh needs a number');
  eq(P('abcdefg1'), 'Include at least one special character, such as ! or #.', 'RULE 5.8.1: abcdefg1 needs a special character');
  eq(P('Password1!'), 'That password is too common. Choose another.', 'RULE 5.8.1: Password1! is too common');
  eq(P('NextChapter2026!'), 'That password is too common. Choose another.', 'RULE: the published default is on the common list');
  eq(P('Grüße Ärger 2026'), 'Include at least one special character, such as ! or #.', 'RULE 5.1: accented letters count as letters, spaces are allowed (and are not special characters)');
  eq(P('Grüße Ärger 2026!'), '', 'RULE 5.1: a password with spaces and accented letters passes');
  eq(P('a1!' + 'x'.repeat(125)), '', 'RULE 5.1: 128 characters pass');
  eq(P('a1!' + 'x'.repeat(126)), 'Use no more than 128 characters.', 'RULE 5.1: 129 characters do not');
  eq(P('Tr0ub4dor&3xx-tw0-' + 'k'.repeat(22)), '', 'RULE 5.8.8: a 40-character password works');
  eq(G.passwordLength('😀😀😀😀1!ab'), 8, 'RULE 5.1: length counts characters, not code units');

  /* the words (5.3) */
  const W = G.authRefusal;
  eq(W({reason:'no-user'}), 'That username and password do not match.', 'WORDS 5.3: no-user -> A.5.3');
  eq(W({reason:'bad-password'}), 'That username and password do not match.', 'WORDS 5.3: bad-password -> A.5.3 (no hint which was wrong)');
  eq(W({reason:'no-credential'}), 'This person has no sign-in yet. Ask your administrator to set a password.', 'WORDS 5.3: no-credential -> A.5.12');
  eq(W({reason:'locked', retryAfterMinutes:15}), 'Too many attempts. Try again in 15 minutes.', 'WORDS 5.3: locked -> A.5.4');
  eq(W({reason:'bad-current'}), 'Your current password is not correct.', 'WORDS 5.3: bad-current -> A.5.15');
  eq(W({reason:'same'}), 'Choose a password different from your current one.', 'WORDS 5.3: same -> A.5.10');
  eq(W({reason:'weak'}, 'abcdefgh'), 'Include at least one number.', 'WORDS 5.3: weak -> what passwordProblem says');
  eq(W({reason:'common'}, 'Unlisted#2026word'), 'That password is too common. Choose another.', 'WORDS 5.3: common from the server\'s longer list still gets words');

  /* session state in this page */
  const _cu = G.currentUserId, _ia = G.isAppAdmin;
  G.Auth.setSession('probe-user'); eq(G.currentUserId, 'probe-user', 'AUTH: setSession writes the session');
  G.Auth.setAdminSession(true); eq(G.isAppAdmin, true, 'AUTH: setAdminSession raises the admin flag');
  G.Auth.clearSession(); ok(G.currentUserId === null && G.isAppAdmin === false, 'AUTH: clearSession clears user and admin flag');
  G.currentUserId = _cu; G.isAppAdmin = _ia;
  has(G.esc('a"b<c>'), '&quot;', 'AUTH: esc escapes double quotes (donor form adopted July 16 — attribute-injection closed)');
  eq(G.esc('a"b<c>'), 'a&quot;b&lt;c&gt;', 'AUTH: esc output matches the donor contract exactly');
  eq(G.currentUserId, _cu, 'AUTH: session restored for downstream blocks');
})();

/* ─── MULTI-USER PREP: revisioned writes, refresh, stale recovery ─── */
(function(){
  const _oid = G.currentOrgId;
  const _snap = JSON.stringify(G.data);
  const _rev0 = G.data.rev || 0;

  G.Store.commit('enterprise');
  ok((G.data.rev||0) === _rev0 + 1, 'MU: each persisted write increments rev');
  eq(G.data.schemaVersion, G.Store.schemaVersion(), 'MU: blobs carry the schemaVersion stamp');
  eq(G.Store.orgRev(_oid), G.data.rev, 'MU: the mirrored rev record tracks the blob');
  eq(G.Store.refreshOrg(), false, 'MU: refreshOrg is a no-op when nothing newer is stored');

  const remote = JSON.parse(JSON.stringify(G.data));
  remote.enterprise = remote.enterprise || {}; remote.enterprise.objective = 'REMOTE EDIT';
  G.Store.writeOrg(_oid, remote); // simulates another tab: stored rev now ahead
  ok(G.Store.orgRev(_oid) > (G.data.rev||0), 'MU: a foreign write leaves the in-memory replica behind');
  eq(G.Store.checkRemote(), true, 'MU: the change signal adopts the newer blob');
  eq(G.data.enterprise.objective, 'REMOTE EDIT', 'MU: the adopted blob is live in the replica');
  eq(G.data.rev, G.Store.orgRev(_oid), 'MU: revs agree after adoption');

  const fresh = { rev: 9, assessments: { 1: { score: 'remote' } }, structure: { note: 'R' } };
  const local = { assessments: { 0: { score: 'mine' }, 1: { score: 'stale-mine' } }, competencies: { probe: '7' } };
  G.Store.mergeDirtyInto(fresh, local, ['assessments::0', 'competencies']);
  eq(fresh.assessments[0].score, 'mine', 'MU: merge overlays my dirty record onto the fresh blob');
  eq(fresh.assessments[1].score, 'remote', 'MU: merge keeps records I did not touch');
  eq(fresh.competencies.probe, '7', 'MU: merge overlays collection-level dirty keys');

  // stale-write recovery end to end: my committed record survives, the other
  // writer's data survives, revs advance, the dirty set clears
  const remote2 = JSON.parse(JSON.stringify(G.data));       // cloned BEFORE my edit
  remote2.structure = remote2.structure || {}; remote2.structure.probe = 'REMOTE-KEEP';
  G.Store.clearDirty();
  G.data.enterprise.objective = 'MY DIRTY EDIT'; G.Store.commit('enterprise');
  G.Store.writeOrg(_oid, remote2);                          // server-authoritative newer blob
  ok(G.Store.handleStaleWrite(_oid) === true, 'MU: stale-write recovery runs');
  eq(G.data.enterprise.objective, 'MY DIRTY EDIT', 'MU: recovery reapplies my in-flight record');
  eq(G.data.structure.probe, 'REMOTE-KEEP', 'MU: recovery keeps the other writer data');
  eq(G.data.rev, remote2.rev + 1, 'MU: recovery persists one rev past the authoritative blob');
  eq(G.Store.dirtyRecords().length, 0, 'MU: recovery clears the dirty set');

  // restore completely
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'MU: restore returns the seed identity');
})();

/* ─── ASYNC BOOT LOADER: readiness seam + double-boot guard ─── */
(function(){
  let s=false; G.Store.ready(()=>{ s=true; });
  ok(s===true, 'BOOT2: Store.ready fires in the same tick locally (boot unchanged)');
  eq(typeof G.bootApp, 'function', 'BOOT2: the boot sequence is a callable unit');
  eq(G.bootApp(), false, 'BOOT2: bootApp is idempotent – a duplicate ready signal is a no-op');
  ok(seedIdent(), 'BOOT2: the rejected re-boot touched nothing');
})();

/* ─── SEED DETERMINISM: literal overwrite, seed-over-seed identity ───
   (ER carries a single seed — the donor's Y2 order-independence frame
   is N/A; the literal-overwrite contract is pinned here instead.) */
(function(){
  const _snap = JSON.stringify(G.data);
  G.seedData(); const one = JSON.stringify({r:G.data.roster, s:G.data.stepDoneAt, e:G.data.enterprise, sd:G.data.startDate});
  G.seedData(); const two = JSON.stringify({r:G.data.roster, s:G.data.stepDoneAt, e:G.data.enterprise, sd:G.data.startDate});
  eq(one === two, true, 'SEED: seeding twice lands on the same identity (deterministic under the frozen clock)');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'SEED: restore returns the seed identity');
})();

/* ─── RULINGS: passcode unification + literal seed overwrite ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  G.data.roster[0].passcode = '1234'; G.applyTeamRoster();
  ok(!('passcode' in G.USERS[0]) && !('passcode' in G.data.roster[0]), 'RULINGS (amended by Part 5, 2 Oct 2026): applyTeamRoster mints no PIN and clears one left in old data');
  G.data.notifications = [{at:1,kind:'x',subject:'JUNK',to:['a'],status:'x'}];
  G.data.remind7 = {'9.9':true};
  G.saveData(); G.seedData();
  ok((G.data.notifications||[]).length===0 && !Object.keys(G.data.remind7||{}).length,
     'RULINGS: re-seeding clears notifications and reminders (overwrite is literal)');
  ok(seedIdent(), 'RULINGS: the cleared re-seed lands on the seed identity');
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(G.USERS.length > 0 && G.USERS.every(u => !('passcode' in u)), 'RULINGS: roster and session state restored for downstream blocks (no passcodes)');
})();

/* ── THEME: dark default (§5A.13, re-ruled 27 July), toggle beside Help, persistence,
      reseed immunity — supersedes the donor copy's dark-default frame ── */
(function(){
  eq(G.UI.theme, 'dark', 'THEME: boots dark by default (§5A.7, re-ruled 27 July)');
  ok(localStorageStub.getItem('exec-readiness-theme') === null, 'THEME: no preference written until the user chooses');
  has(G.printThemeTokens(), '--gold:#4E7FA6', 'THEME: print windows carry the ER accent');
  has(G.printThemeTokens(), '--gold-rgb:78,127,166', 'THEME: print windows carry the accent channel token');
  has(G.printThemeTokens(), "--mono:'DM Mono'", 'THEME: print tokens carry the font faces');
  has(G.printThemeTokens(), '--shadow-card:none', 'THEME: print windows suppress shadows (§5A.6)');
  noThrow(() => G.toggleTheme(), 'THEME: toggleTheme() runs (incl. its render())');
  eq(G.UI.theme, 'light', 'THEME: toggle flips dark to light');
  eq(localStorageStub.getItem('exec-readiness-theme'), 'light', 'THEME: light preference persists to exec-readiness-theme');
  noThrow(() => G.seedData(), 'THEME: reseed runs under light');
  eq(G.UI.theme, 'light', 'THEME: seedData() leaves the theme untouched');
  eq(localStorageStub.getItem('exec-readiness-theme'), 'light', 'THEME: reseed leaves the stored preference untouched');
  // The nav renders only behind the entry gate, so borrow a seeded identity
  // (same fixture pattern as the harness bootstrap) for the menu assertions.
  const _prevUser = G.currentUserId;
  G.currentUserId = (G.USERS[0] || {}).id || null;
  ok(!!G.getCurrentUser(), 'THEME: menu fixture signs in a seeded user');
  G.UI.navMore = true; G.render();
  has(G.document.getElementById('navRight').innerHTML, 'Dark Mode', 'THEME: the top-bar toggle offers the return path from light');
  has(G.document.getElementById('navRight').innerHTML, 'Track Program</button>', 'THEME: Track Program lives in the More menu');
  G.setTheme('dark');
  eq(G.UI.theme, 'dark', 'THEME: setTheme restores dark');
  eq(localStorageStub.getItem('exec-readiness-theme'), 'dark', 'THEME: dark preference persists');
  G.UI.navMore = true; G.render();
  has(G.document.getElementById('navRight').innerHTML, 'Light Mode', 'THEME: the top-bar toggle offers light from dark');
  G.UI.navMore = false; G.currentUserId = _prevUser; G.render();
})();

/* ── WARN: warning register print tokens (light standard) ──
   (The donor's SVG literal-stroke pins cover Pipeline charts — N/A here.) */
(() => {
  has(G.printThemeTokens(), '--warn-text:#8F6A00', 'WARN: print windows carry the light warning-text token');
  has(G.printThemeTokens(), '--warn-pale:#7E6A00', 'WARN: print windows carry the pale warning token');
})();

/* ═══════════ §18.9 STAGE 2: ER MODULE FRAMES ═══════════ */

/* ── ST: every module surface renders from seed without throwing ── */
(function(){
  const _cu = G.currentUserId, _cs = G.currentStep;
  G.Auth.setSession('u6');                       // a seeded leader — individual-track surfaces resolve
  const stepIds = G.mgSteps().map(s => String(s.id))
    .concat(['1.4','2.4','3.5','4.4']); /* individual-track pages left mgSteps on 16 July (shared counts ruling) but still render — coverage kept explicitly */
  stepIds.forEach(function(id){
    G.currentStep = id;
    const out = noThrow(() => G.renderStep(), 'ST: step ' + id + ' renders');
    nonEmptyStr(out, 'ST: step ' + id + ' returns non-empty HTML');
  });
  const OUTS = ['renderOutReadiness','renderOutInventory','renderOutRiskMap','renderOutStructure',
    'renderOutCollab','renderOutCompetency','renderOutFluency','renderOutDecisions',
    'renderOutMMPrinciples','renderOutValues','renderOutRhythm','renderOutEvalPlan','renderOutReview'];
  OUTS.forEach(function(fn){
    const out = noThrow(() => G[fn](), 'ST: ' + fn + '() runs');
    nonEmptyStr(out, 'ST: ' + fn + '() returns non-empty HTML');
  });
  [1,2,3,4].forEach(function(n){
    nonEmptyStr(noThrow(() => G.renderPhaseHome(n), 'ST: renderPhaseHome(' + n + ') runs'), 'ST: phase ' + n + ' home is non-empty');
  });
  noThrow(() => G.renderPhaseHome(5), 'ST: renderPhaseHome(5) runs (Ongoing)');
  nonEmptyStr(noThrow(() => G.vizTimeline(1), 'ST: vizTimeline runs (successor to the retired renderTimeline90, 16 July)'), 'ST: timeline is non-empty');
  const dash = noThrow(() => G.renderDashboard(), 'ST: renderDashboard (Leadership Structure) runs');
  nonEmptyStr(dash, 'ST: Leadership Structure is non-empty');
  nonEmptyStr(noThrow(() => G.renderLdevHub(), 'ST: renderLdevHub runs'), 'ST: L&D Hub is non-empty');
  nonEmptyStr(noThrow(() => G.renderLdevDashboard(), 'ST: renderLdevDashboard runs (leader session)'), 'ST: My Development is non-empty');
  noThrow(() => G.renderNotes(), 'ST: renderNotes runs');
  noThrow(() => G.renderCoach(), 'ST: renderCoach runs');
  noThrow(() => G.renderGChatPanel(), 'ST: renderGChatPanel runs');
  G.currentStep = _cs; G.currentUserId = _cu;
})();

/* ── CW: completion writers stamp through stampStepDone (13 sites) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  // stamp contract on a representative saver (seed roster is email-less → no queue)
  delete G.data.completedSteps['1.3']; delete G.data.stepDoneAt['1.3'];
  G.data.notifications = [];
  G.saveRisks();
  ok(G.data.completedSteps['1.3'] === true, 'CW: saveRisks completes 1.3');
  const d1 = G.data.stepDoneAt['1.3'];
  ok(/^\d{4}-\d{2}-\d{2}$/.test(d1 || ''), 'CW: completion stamps an ISO date');
  G.saveRisks();
  eq(G.data.stepDoneAt['1.3'], d1, 'CW: re-saving never re-stamps (stampStepDone is write-once)');
  eq((G.data.notifications||[]).length, 0, 'CW: an email-less roster queues nothing (notifyQueue early-returns)');
  delete G.data.completedSteps['2.3']; delete G.data.stepDoneAt['2.3'];
  G.saveCompetencyFramework();
  ok(G.data.completedSteps['2.3'] === true && !!G.data.stepDoneAt['2.3'], 'CW: saveCompetencyFramework completes and stamps 2.3');
  delete G.data.completedSteps['4.3']; delete G.data.stepDoneAt['4.3'];
  noThrow(() => G.saveLeadershipReview(), 'CW: saveLeadershipReview runs on the stub DOM');
  ok(G.data.completedSteps['4.3'] === true && !!G.data.stepDoneAt['4.3'], 'CW: saveLeadershipReview completes and stamps 4.3');
  // the ruled 2.1 brace: incomplete sections must neither flag nor stamp (Paul, July 16)
  ['ownership','board','senior','middle','crossfunc'].forEach(function(s){ delete (G.data.structure||{})[s + '_done']; });
  delete G.data.completedSteps['2.1']; delete G.data.stepDoneAt['2.1'];
  G.saveStructSec('ownership');
  ok(!G.data.completedSteps['2.1'], 'CW: one section of five leaves 2.1 incomplete');
  ok(!(G.data.stepDoneAt||{})['2.1'], 'CW: an incomplete 2.1 writes NO completion date (ruled fix — the stamp is inside the brace)');
  ['board','senior','middle','crossfunc'].forEach(function(s){ G.data.structure[s + '_done'] = true; });
  G.saveStructSec('ownership');
  ok(!G.data.completedSteps['2.1'] && !(G.data.stepDoneAt||{})['2.1'], 'CW: the fifth section leaves 2.1 incomplete and unstamped — sections never complete the step (superseded 25 July; was the auto-complete pin)');
  G.markStepComplete('2.1');
  ok(G.data.completedSteps['2.1'] === true && !!G.data.stepDoneAt['2.1'], 'CW: the discrete Step Complete button completes 2.1 and stamps it once (ruled 25 July)');
  ok((code.match(/stampStepDone\(/g) || []).length === 12, 'CW: 11 writer sites + 1 definition route through stampStepDone (§18.7 census; 13→11 on 25 July — the three section-saver sites left with the discrete-button ruling, markStepComplete arrived)');
  ok(code.indexOf("if(allDone){data.completedSteps[") < 0,
     'CW: the conditional section-saver writers are gone — completion moved to the discrete Step Complete buttons (superseded 25 July; was the braced-writers pin)');
  // §17 gates (ruled July 16): completion asks first; cancel touches nothing; no nag once complete
  const _cf = G.confirm;
  G.confirm = function(){ return false; };
  delete G.data.completedSteps['1.3']; delete G.data.stepDoneAt['1.3'];
  const risks0 = JSON.stringify(G.data.risks);
  G.saveRisks();
  ok(!G.data.completedSteps['1.3'] && !(G.data.stepDoneAt||{})['1.3'] && JSON.stringify(G.data.risks) === risks0, 'CW: declining the gate touches nothing (§17, donor contract)');
  G.confirm = _cf;
  G.saveRisks();
  ok(G.data.completedSteps['1.3'] === true, 'CW: accepting the gate completes and stamps');
  G.confirm = function(){ return false; };
  G.saveRisks();
  ok(G.data.completedSteps['1.3'] === true, 'CW: routine re-saves after completion never re-ask (short-circuit)');
  G.confirm = _cf;
  // section-level gates (§17 remainder): same dialog, store-adapted short-circuits
  G.confirm = function(){ return false; };
  delete (G.data.structure||{}).ownership_done; delete G.data.completedSteps['2.1']; delete G.data.stepDoneAt['2.1'];
  const st0 = JSON.stringify(G.data.structure||{});
  G.saveStructSec('ownership');
  ok(!(G.data.structure||{}).ownership_done && JSON.stringify(G.data.structure||{}) === st0, 'CW: declining a section gate touches nothing (2.1 store)');
  G.confirm = _cf;
  G.saveStructSec('ownership');
  ok((G.data.structure||{}).ownership_done === true, 'CW: accepting completes the section (and the step rolls up)');
  G.confirm = function(){ return false; };
  G.saveStructSec('ownership');
  ok((G.data.structure||{}).ownership_done === true, 'CW: complete sections re-save without asking (adapted short-circuit)');
  G.confirm = _cf;
  ok((code.match(/confirmStepDone\(/g)||[]).length === 12 && (code.match(/confirmSectionDone\(/g)||[]).length === 2 && code.indexOf("(data.structure||{})[secId+'_done']") >= 0 && code.indexOf("(data.collabLab||{})[secId+'_done']") >= 0, 'CW: §17 census complete — eleven step sites (+markStepComplete, 25 July) + three section sites, store-correct short-circuits');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'CW: restore returns the seed identity');
})();

/* ── NT: notification depth in the vm realm (§12 contract) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  // silence: the seeded (email-less) roster queues no step-complete
  G.data.notifications = []; delete G.data.stepDoneAt['1.2'];
  G.stampStepDone('1.2');
  eq((G.data.notifications||[]).length, 0, 'NT: seeded org stamps queue nothing (no valid recipient emails)');
  // email fixture
  G.data.roster.push({id:'nt1',name:'NT Fixture',username:'ntfx',email:'nt@x.co',initials:'NF',color:'#4E7FA6',scope:'All',passcode:'1234'});
  G.applyTeamRoster();
  delete G.data.stepDoneAt['1.1']; G.data.notifications = [];
  G.stampStepDone('1.1');
  const q = G.data.notifications || [];
  eq(q.length, 1, 'NT: first stamp queues exactly one notification');
  ok(q[0] && q[0].kind === 'step-complete' && q[0].stepId === '1.1' && q[0].pdf === true, 'NT: step-complete carries stepId and the pdf flag (§12)');
  ok((q[0].to||[]).indexOf('nt@x.co') >= 0, 'NT: recipients are the roster emails');
  ok(String(q[0].status).indexOf('pending') === 0, 'NT: no endpoint → status pending');
  G.stampStepDone('1.1');
  eq((G.data.notifications||[]).length, 1, 'NT: re-stamp queues no duplicate (idempotent)');
  // Ruled July 16 (revisit item 20): the email embeds analytics REGARDLESS of the live
  // tab — pinned by forcing Assignments active before building the email.
  const _mgt = G.UI.mgTab; G.UI.mgTab = 0;
  const html = G.notifyEmailHtml(q[0]);
  G.UI.mgTab = _mgt;
  has(html, 'was marked complete', 'NT: completion email carries the notice');
  has(html, 'Module Velocity', 'NT: completion email embeds the analytics page regardless of the live tab (§12, ruled)');
  // deadline reminder: admins lack email → assignees only
  G.data.stepDue = G.data.stepDue || {}; G.data.stepDue['3.2'] = new Date(Date.now() + 3*86400000).toISOString().split('T')[0];
  G.data.assigns = G.data.assigns || {}; G.data.assigns['3.2'] = ['nt1'];
  delete G.data.completedSteps['3.2'];
  G.data.remind7 = {};
  G.notifySweepDeadlines(); G.notifySweepDeadlines();
  const rem = (G.data.notifications||[]).filter(function(n){ return n.kind === 'deadline-reminder'; });
  eq(rem.length, 1, 'NT: the sweep queues one reminder, idempotent via remind7');
  ok(G.data.remind7['3.2'] === true, 'NT: remind7 records the sent reminder');
  ok(rem[0] && rem[0].pdf === false && (rem[0].to||[]).indexOf('nt@x.co') >= 0, 'NT: reminder is plain (no pdf) and reaches the assignee (admins carry no email)');
  // outbox cap
  for (let i = 0; i < 60; i++) G.notifyQueue('x', 's' + i, ['a@b.c']);
  eq((G.data.notifications||[]).length, 50, 'NT: the outbox caps at 50 (oldest dropped)');
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(seedIdent(), 'NT: restore returns the seed identity');
})();

/* ── OC: Leadership Structure machinery (arg-driven; form savers are browser QA) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  ok((G.data.orgChart||[]).length > 0, 'OC: the seed builds an org chart');
  nonEmptyStr(noThrow(() => G.renderOrgChartInteractive(G.data.orgChart, G.data.leaders), 'OC: interactive chart renders'), 'OC: chart HTML is non-empty');
  G.data.orgChart.push({id:'oc1',name:'Harness Role',level:2,parentId:'',occupantLeaderId:null,guidingConcepts:'',taggedValues:[],members:[]});
  G.toggleRoleValue('oc1','v1');
  eq(((G.data.orgChart.find(r=>r.id==='oc1'))||{}).taggedValues, ['v1'], 'OC: toggleRoleValue tags a value');
  G.toggleRoleValue('oc1','v1');
  eq(((G.data.orgChart.find(r=>r.id==='oc1'))||{}).taggedValues, [], 'OC: toggleRoleValue untags on the second call');
  G.addBoardMember('board','leader','u6');
  G.addBoardMember('board','leader','u6');
  const board = G.data.orgChart.find(r=>r.id==='board');
  eq((board.members||[]).filter(m=>m.type==='leader'&&m.id==='u6').length, 1, 'OC: board leader adds once (duplicate guarded)');
  G.toggleBoardLeader('board','u6');
  eq((board.members||[]).filter(m=>m.type==='leader'&&m.id==='u6').length, 0, 'OC: toggleBoardLeader removes the seat');
  const bn = (board.members||[]).length;
  noThrow(() => G.addBoardMember('board','name',null,'Jane Q','Advisor'), 'OC: named (non-roster) board member adds');
  ok((board.members||[]).length === bn + 1, 'OC: named member lands on the board');
  G.deleteOrgRole2('oc1');
  ok(!G.data.orgChart.some(r=>r.id==='oc1'), 'OC: deleteOrgRole2 removes the role (confirm accepted)');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'OC: restore returns the seed identity');
})();

/* ── IT: the individual track (per-leader stores, program-math exclusion) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _cu = G.currentUserId;
  eq(Object.keys(G.INDIVIDUAL_TRACK_STEPS).sort(), ['1.4','2.4','3.5','4.4'], 'IT: the four individual-track steps are pinned');
  eq(G.getProgress().total, 13, 'IT: getProgress counts 13 (17 countable minus the 4 individual-track steps)');
  eq(G.mgSteps().length, 13, 'IT: the hub counts shared steps only — the 16 July ruling (universal counts everywhere) supersedes the earlier hub-keeps-17 ruling');
  G.Auth.setSession('u6');
  ok(!!G.getMyLeader(), 'IT: a seeded leader session resolves getMyLeader');
  const s6 = G.myIndivStore('mindsetApp');
  ok(s6 && typeof s6 === 'object', 'IT: myIndivStore returns the per-leader store');
  s6.__hx = 'marker-u6';
  G.Auth.setSession('u7');
  const s7 = G.myIndivStore('mindsetApp');
  ok(s7 && s7.__hx !== 'marker-u6', 'IT: stores are isolated per leader');
  G.markMonthlyReviews();
  ok(Object.keys((G.data.practiceLog||{})['u7']||{}).length > 0, 'IT: markMonthlyReviews writes the signed-in leader practice log');
  ok(!!(G.data.practiceLog||{})['u6'], 'IT: the seed populates leader practice logs (u6 present)');
  G.Auth.setSession('u_fac');
  ok(G.getMyLeader() == null && G.myIndivStore('mindsetApp') == null, 'IT: the leaderless facilitator has no individual store');
  G.currentUserId = _cu;
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'IT: restore returns the seed identity');
})();

/* ── SEED-2 + NOTES: per-surface seed depth; notes round trip ── */
(function(){
  const _snap = JSON.stringify(G.data);
  eq((G.data.risks||[]).length, 7, 'SEED2: seven seeded risk scenarios (RISK_SEED census)');
  eq((G.data.leaders||[]).length, 13, 'SEED2: thirteen seeded leaders (ten with logins u6–u15, plus VP Operations, VP Human Resources, and Director PX without — VP HR added by ruling, 16 July)');
  ok(G.data.leadershipReview && Object.keys(G.data.leadershipReview).length > 0, 'SEED2: the Phase-4 review is recorded');
  const n0 = (G.data.notes||[]).length;
  G.document.getElementById('noteInput').value = 'Harness note';
  G.addNote();
  eq((G.data.notes||[]).length, n0 + 1, 'NOTES: addNote appends from the panel input');
  ok(JSON.stringify(G.data.notes).indexOf('Harness note') >= 0, 'NOTES: the note text lands in data');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'NOTES: restore returns the seed identity');
})();

/* ── QB: July 16 quick-batch rulings pinned ── */
(function(){
  ok(code.indexOf('ensureRaciModel') < 0 && code.indexOf('ensureCapCostModel') < 0, 'QB: the dead donor calls are stripped from handleStaleWrite (item 3)');
  ok(!/function renderLogin\(\)/.test(code) && code.indexOf("Store.raw.set('exec-readiness-user'") < 0, 'QB: the dead legacy sign-in pair and its off-spec key write are gone (item 4)');
  ok(code.indexOf('\u2550\u2550\u2550 INSIGHTS \u2550\u2550\u2550') < 0 && code.indexOf('LEARN / INSIGHTS') < 0, 'QB: no banner heads Insights — donor form (item 15, ruled July 16)');
  ok(code.indexOf('DEFAULT_ROSTER') < 0, 'QB: the relic roster is gone — no auto-population anywhere (item 1, ruled July 16)');
  ok(G.idToRecordKey('cl_touchCustomer') === 'collabLab' && G.idToRecordKey('risk_x') === 'risks' && G.idToRecordKey('or_name') === 'orgChart', 'CL: the record map routes the shared surfaces (item 2)');
  ok(G.idToRecordKey('ma_probe') === null && G.idToRecordKey('cr_slowEntry') === null && G.idToRecordKey('gchatInput') === null, 'CL: per-person and panel inputs carry no shared lock');
  // item 5 (ruled July 16) as amended by the 2 Oct 2026 directive, Part 4: clearData is gone; the admin console's Reset data
  // (resetOrgData) overwrites in place under the reset scope law — administrators kept, everyone else removed
  (function(){
    const _s = JSON.stringify(G.data);
    const orgs0 = G.getOrgs().length;
    G.resetOrgData(G.currentOrgId);
    ok((G.data.leaders||[]).length === 0 && G.getOrgs().length === orgs0 && (G.Store.readOrg(G.currentOrgId).leaders||[]).length === 0, 'RD: Reset data empties in place — org row and key survive, blob overwritten (Part 4)');
    ok(typeof G.clearData === 'undefined', 'RD: the More menu clearData is gone (Part 4.2.3)');
    G.data = JSON.parse(_s); G.saveData();
    ok(seedIdent(), 'RD: restore returns the seed identity');
  })();
  ok(code.indexOf('id="setupEmail"') >= 0 && code.indexOf("email:(firstUser.email||'').trim()") >= 0, 'QB: setup captures email and createOrg carries it onto the owner record (item 19)');
  const av = G.userAv({initials:'X', name:'X'});
  ok(av.indexOf('width:28px') >= 0, 'QB: userAv default size is the donor 28px (item 16)');
  ok(G.userAv({initials:'L', name:'L', color:'#F5F1E8'}).indexOf('color:#1A1612') >= 0 && av.indexOf('color:#fff') >= 0, 'QB: luminance-picked text \u2014 dark on light swatches, white on dark (\u00a75A.10)');
})();

/* ── CH: Team Chat on the store (item 13, ruled July 16) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  eq((G.data.chatMsgs||[]).length, 5, 'CH: the seed owns the five-message demo thread');
  delete G.data.chatMsgs;
  const arr = G.chatArr();
  ok(Array.isArray(arr) && arr.length === 0 && G.data.chatMsgs === arr, 'CH: chatArr lazy-inits the per-org array (donor form)');
  const r0 = G.data.rev || 0;
  G.chatArr().push({who:'u6',name:'Harriet Rivers',ts:'1:00 PM',text:'harness probe'});
  G.Store.commit('chatMsgs');
  ok((G.data.rev||0) === r0 + 1 && JSON.stringify(G.Store.readOrg(G.currentOrgId).chatMsgs).indexOf('harness probe') >= 0, 'CH: a sent message persists to the org blob through the store');
  G.seedData();
  eq((G.data.chatMsgs||[]).length, 5, 'CH: re-seeding resets the demo thread (revisit-13 contract closed)');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'CH: restore returns the seed identity');
})();

/* ── FB1-1: invalid-SVG-rx class guard (item 1 — already resolved in this build; pin recast to hold the class) ── */
(function(){
  ok(code.indexOf('rx="8 8 0 0"') < 0 && code.indexOf("8 8 0 0") < 0, 'FB1-1: the invalid multi-value rx literal has zero occurrences in source');
  const _snap = JSON.stringify(G.data); const _pg=G.currentPage,_st=G.currentStep;
  G.data.structure.coordMechanism = 'council'; /* the stub DOM wipes the seeded value; hold it through harvest so the host injects the floating council node */
  G.document.getElementById('st_coordMechanism').value = 'council';
  G.go('phase5'); /* the dashboard host runs syncCouncilNode — a council renders the floating role */
  const chart = G.document.getElementById('app').innerHTML || '';
  ok(chart.indexOf('stroke-dasharray="6,3"') >= 0, 'FB1-1: a floating role renders through the host path (the class the finding covered)');
  ok(!/rx="[^"]*\s[^"]*"/.test(chart), 'FB1-1: no rendered rx attribute carries a multi-value (SVG rx takes a single length)');
  G.document.getElementById('st_coordMechanism').value = '';
  G.currentPage=_pg; G.currentStep=_st; G.data=JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-1: restore returns the seed identity');
})();

/* ── FB1-2: the step\u2019s phase decides the nav tab (item 2, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data); const _pg=G.currentPage,_st=G.currentStep;
  function tabCls(html,pid,label){
    const i=(html||'').indexOf('onclick="go(\''+pid+'\')">'+label);
    if(i<0)return null;
    const pre=(html||'').slice(Math.max(0,i-40),i);
    if(pre.indexOf('class="nav-tab active"')>=0)return true;
    if(pre.indexOf('class="nav-tab"')>=0)return false;
    return null;
  }
  G.go('5.2');
  let nt = G.document.getElementById('navTabs').innerHTML || '';
  ok(tabCls(nt,'phase5','Lead') === true, 'FB1-2: on step 5.2 the Lead tab carries active');
  ok(tabCls(nt,'readiness','Readiness') === false, 'FB1-2: on step 5.2 the Readiness tab does not');
  G.go('5.3');
  nt = G.document.getElementById('navTabs').innerHTML || '';
  ok(tabCls(nt,'phase5','Lead') === true && tabCls(nt,'readiness','Readiness') === false, 'FB1-2: same on 5.3');
  G.go('1.1');
  nt = G.document.getElementById('navTabs').innerHTML || '';
  ok(tabCls(nt,'readiness','Readiness') === true && tabCls(nt,'phase5','Lead') === false, 'FB1-2: on step 1.1 Readiness carries active and Lead does not');
  G.currentPage=_pg; G.currentStep=_st; G.data=JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-2: restore returns the seed identity');
})();

/* ── FB1-3/12: panels outside #app repaint on every render; the badge derives from data (items 3+12, one class, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data); const _pg=G.currentPage,_st=G.currentStep;
  const _org = G.currentOrgId, _user = G.currentUserId;
  /* (a) notes: org switch leaves no stale panel */
  G.data.notes = G.data.notes || [];
  G.data.notes.push({id:'fb12n', text:'ORG-A NOTE MARKER', date:new Date().toISOString()});
  G.saveData();
  G.notesOpen = true; G.renderNotes();
  ok((G.document.getElementById('notesPanel').innerHTML||'').indexOf('ORG-A NOTE MARKER') >= 0, 'FB1-3: the open panel shows org A\u2019s note');
  const b = G.createOrg('FB12 Org B', {name:'Bee', username:'bee', passcode:'1'});
  G.Auth.setSession(b.userId);
  G.render();
  const paneB = G.document.getElementById('notesPanel').innerHTML || '';
  ok(paneB.indexOf('ORG-A NOTE MARKER') < 0, 'FB1-3: switching orgs and rendering leaves the panel without org A\u2019s note (the ruled pin)');
  ok(String(G.document.getElementById('notesCount').textContent) === String((G.data.notes||[]).length), 'FB1-3: count and panel agree');
  G.switchToOrg(_org); G.Auth.setSession(_user); G.notesOpen=false;
  /* (b) chat: a foreign append appears in the open panel within one adoption cycle */
  G.gchatOpen = true; G.renderGChatPanel();
  let fresh = JSON.parse(G.Store.orgRaw(G.currentOrgId));
  fresh.chatMsgs = fresh.chatMsgs || [];
  fresh.chatMsgs.push({who:'u7', name:'Vincent Lau', ts:'2:00 PM', text:'FOREIGN CHAT MARKER'});
  G.Store.writeOrg(G.currentOrgId, fresh);
  ok(G.Store.refreshOrg() === true, 'FB1-12: adoption fires on the foreign chat write');
  ok((G.document.getElementById('gchatPanel').innerHTML||'').indexOf('FOREIGN CHAT MARKER') >= 0, 'FB1-12: the open chat panel shows the foreign message after one adoption cycle');
  G.gchatOpen = false;
  /* (c) badge: data-derived, increments on a foreign message while the panel is closed */
  ok(code.indexOf('gchatUnreadCount') < 0, 'FB1-12: the session-local unread counter is gone (badge derives from chatMsgs)');
  G.renderGChatPanel(); /* mark seen at the current count */
  const u0 = G.gchatUnread();
  fresh = JSON.parse(G.Store.orgRaw(G.currentOrgId));
  fresh.chatMsgs.push({who:'u8', name:'Shalini Mehta', ts:'2:05 PM', text:'FOREIGN WHILE CLOSED'});
  G.Store.writeOrg(G.currentOrgId, fresh);
  ok(G.Store.refreshOrg() === true, 'FB1-12: adoption fires on the second foreign write');
  ok(G.gchatUnread() === u0 + 1, 'FB1-12: the badge increments on a foreign message while the panel is closed');
  const uEl = G.document.getElementById('gchatUnread');
  ok(String(uEl.textContent) === String(u0+1) && uEl.style.display === '', 'FB1-12: the badge element paints the derived count');
  /* (d) org modal: repaints from adopted data; an in-progress edit survives the repaint */
  G.currentModal = 'org'; G.renderOrgModal();
  const entEl = G.document.getElementById('ent_sponsor');
  entEl.value = 'TYPING IN PROGRESS FB12';
  G.document.activeElement = entEl;
  fresh = JSON.parse(G.Store.orgRaw(G.currentOrgId));
  fresh.enterprise = fresh.enterprise || {};
  fresh.enterprise.name = 'FOREIGN ORG NAME FB12';
  G.Store.writeOrg(G.currentOrgId, fresh);
  ok(G.Store.refreshOrg() === true, 'FB1-12: adoption fires on the foreign enterprise write');
  ok((G.document.getElementById('modalRoot').innerHTML||'').indexOf('FOREIGN ORG NAME FB12') >= 0, 'FB1-12: the open org modal repaints with the adopted enterprise value');
  ok(entEl.value === 'TYPING IN PROGRESS FB12', 'FB1-12: the in-progress edit survives the repaint (value intact; caret restore is the same §7A path)');
  G.document.activeElement = null; G.currentModal = null; G.document.getElementById('modalRoot').innerHTML=''; entEl.value='';
  G.currentPage=_pg; G.currentStep=_st; G.data=JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-3/12: restore returns the seed identity');
})();

/* ── FB1-4: the banned word is gone module-wide (item 4; carousel sites resolved pre-batch, seed sites fixed here) ── */
(function(){
  ok(code.indexOf('quietly') < 0 && code.indexOf('Quietly') < 0, 'FB1-4: zero occurrences of the banned word in app.js, any case');
})();

/* ── FB1-6: what you saw is what gets archived (item 6, F-4 ruling, 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  /* the seeded history regenerates in the grid\u2019s 13-leader shape */
  const hist = G.data.practiceHistory || {};
  const hk = Object.keys(hist);
  eq(hk.length, 2, 'FB1-6: two seeded history months');
  hk.forEach(function(k){
    const rec = hist[k];
    eq((rec.users||[]).length, 13, 'FB1-6: '+k+' archives all 13 grid leaders');
    eq(Object.keys(rec.cells||{}).length, 13, 'FB1-6: '+k+' carries 13 cell rows');
    let n=0; Object.keys(rec.cells).forEach(function(u){ n += Object.keys(rec.cells[u]).length; });
    eq(n, 91, 'FB1-6: '+k+' carries 91 cells (13\u00d77)');
    ['seed_vpops','seed_vphr','seed_dirpx'].forEach(function(nl){
      const row = rec.cells[nl] || {};
      ok(Object.keys(row).length === 7 && Object.keys(row).every(function(p){ return row[p]==='red'; }), 'FB1-6: '+k+' no-login leader '+nl+' reads not-done (can never log practices)');
    });
    eq((rec.summary||{}).green + (rec.summary||{}).red, 91, 'FB1-6: '+k+' summary sums to the population');
  });
  /* archive summary equals the live grid\u2019s Done/Not-Started at the moment of close — exact frozen-clock figures */
  const ref = G.periodKey(new Date());
  let gridGreen = 0;
  (G.data.leaders||[]).forEach(function(l){
    const log = (l.userId && (G.data.practiceLog||{})[l.userId]) || {};
    G.PRACTICE_KEYS.forEach(function(pk2){ const last=log[pk2.id]; if(last && G.periodKey(new Date(last))===ref) gridGreen++; });
  });
  eq(gridGreen, 35, 'FB1-6: the frozen-clock seed grid shows exactly 35 done');
  G.manualResetPractices();
  const arch = (G.data.practiceHistory||{})[ref];
  ok(!!arch, 'FB1-6: manual close archives the current period');
  eq((arch.summary||{}).green, 35, 'FB1-6: archive green equals the grid\u2019s Done at close (35)');
  eq((arch.summary||{}).red, 56, 'FB1-6: archive red equals Not-Started (56 = 13\u00d77 \u2212 35)');
  eq((arch.users||[]).length, 13, 'FB1-6: the closed archive carries the 13-leader population');
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'FB1-6: restore returns the seed identity');
})();

/* ── FB1-7: every individual-track completion warns; cancel touches nothing (item 7 + extension, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _cu = G.currentUserId; const _confirm = G.confirm;
  G.Auth.setSession('u6');
  const ml = G.getMyLeader();
  ok(!!ml, 'FB1-7: the probe session resolves a linked leader');
  let calls = [];
  G.confirm = function(m){ calls.push(String(m)); return false; };
  /* 2.4: decline leaves the step incomplete and writes nothing */
  delete G.data.indivDone[ml.id]['2.4'];
  const md0 = JSON.stringify((G.data.mindsetDepth||{})[ml.id]||{});
  G.saveMindsetDepth();
  eq(calls.length, 1, 'FB1-7: completing 2.4 raises exactly one confirm');
  eq(calls[0], 'Mark this step complete? This can\u2019t be undone.', 'FB1-7: \u2026with the canonical 1.4/4.4 text');
  ok(!(G.data.indivDone[ml.id]||{})['2.4'], 'FB1-7: decline leaves 2.4 incomplete');
  eq(JSON.stringify((G.data.mindsetDepth||{})[ml.id]||{}), md0, 'FB1-7: decline writes nothing to the 2.4 store');
  /* 3.5: same contract */
  calls = [];
  delete G.data.indivDone[ml.id]['3.5'];
  const ma0 = JSON.stringify((G.data.mindsetApp||{})[ml.id]||{});
  G.saveMindsetApp();
  ok(calls.length === 1 && calls[0] === 'Mark this step complete? This can\u2019t be undone.', 'FB1-7: 3.5 raises exactly one canonical confirm');
  ok(!(G.data.indivDone[ml.id]||{})['3.5'] && JSON.stringify((G.data.mindsetApp||{})[ml.id]||{}) === ma0, 'FB1-7: decline leaves 3.5 incomplete and writes nothing');
  /* accept completes */
  G.confirm = function(){ return true; };
  G.saveMindsetDepth(); G.saveMindsetApp();
  ok((G.data.indivDone[ml.id]||{})['2.4'] === true && (G.data.indivDone[ml.id]||{})['3.5'] === true, 'FB1-7: accepting the dialog completes 2.4 and 3.5');
  /* extension: individual tab-saves raise the section dialog; decline writes nothing */
  calls = []; G.confirm = function(m){ calls.push(String(m)); return false; };
  delete G.data.indivDone[ml.id]['1.4:intro'];
  const ms0 = JSON.stringify((G.data.mindsetStudy||{})[ml.id]||{});
  G.saveMindsetTab('intro');
  ok(calls.length === 1 && calls[0] === 'Mark this section complete? This can\u2019t be undone.', 'FB1-7x: a 1.4 tab-save raises the standard section dialog');
  ok(!(G.data.indivDone[ml.id]||{})['1.4:intro'] && JSON.stringify((G.data.mindsetStudy||{})[ml.id]||{}) === ms0, 'FB1-7x: decline leaves the tab unflagged and writes nothing');
  calls = [];
  delete G.data.indivDone[ml.id]['4.4:stop'];
  G.saveComposureTab('stop');
  ok(calls.length === 1 && calls[0] === 'Mark this section complete? This can\u2019t be undone.', 'FB1-7x: a 4.4 tab-save raises the standard section dialog');
  ok(!(G.data.indivDone[ml.id]||{})['4.4:stop'], 'FB1-7x: decline leaves the 4.4 tab unflagged');
  G.confirm = _confirm; G.currentUserId = _cu;
  G.data = JSON.parse(_snap); G.saveData();
  ok(seedIdent(), 'FB1-7: restore returns the seed identity');
})();

/* ── FB1-8: F-7 — button onclick attributes render whole and parseable (Fix Batch 1 item 8, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _pg = G.currentPage, _st = G.currentStep;
  function decodeAttr(x){return x.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');}
  function collect(html){var out=[],re=/onclick="([^"]*)"/g,m;while((m=re.exec(html||'')))out.push(m[1]);return out;}
  ok(code.indexOf("replace(/\"/g,'&quot;')") >= 0, 'FB1-8: btn() escapes double quotes in its onclick attribute (the F-7 hardening layer)');
  G.go('1.2');
  const app12 = G.document.getElementById('app').innerHTML || '';
  const m12 = /onclick="([^"]*confirmStepDone[^"]*)"/.exec(app12);
  const h12 = m12 ? decodeAttr(m12[1]) : '';
  ok(h12.indexOf("confirmStepDone('1.2')") >= 0 && h12.indexOf('saveLandscapeNotes()') >= 0 && h12.indexOf('render()') >= 0, 'FB1-8: the rendered 1.2 Step Complete onclick carries the full handler (no truncation at confirmStepDone)');
  ok((function(){ try{ new Function(h12); return true; }catch(e){ return false; } })(), 'FB1-8: the 1.2 handler parses as valid JS');
  const surfaces=['insights','readiness','phase5','mgmt-hub','phase-1','phase-2','phase-3','phase-4',
    '1.1','1.2','1.3','1.4','2.1','2.2','2.3','2.4','3.1','3.2','3.3','3.4','3.5','4.1','4.2','4.3','4.4','5.2','5.3',
    'out-readiness','out-inventory','out-riskmap','out-structure','out-collab','out-competency',
    'out-fluency','out-decisions','out-mmprinciples','out-values','out-rhythm','out-evalplan','out-review'];
  let attrs=0, badParse=0, renderErr=0;
  surfaces.forEach(function(sid){
    try{ G.go(sid); }catch(e){ renderErr++; return; }
    var html=(G.document.getElementById('app').innerHTML||'')+(G.document.getElementById('pipSidebar').innerHTML||'')+(G.document.getElementById('navTabs').innerHTML||'')+(G.document.getElementById('navRight').innerHTML||'');
    collect(html).forEach(function(a){ attrs++; try{ new Function(decodeAttr(a)); }catch(e){ badParse++; } });
  });
  ok(renderErr === 0, 'FB1-8: all 40 surfaces render for the class walk');
  ok(attrs > 2500 && badParse === 0, 'FB1-8: class pin — every rendered onclick across all surfaces parses whole (' + attrs + ' attributes, 0 unparseable)');
  G.currentPage=_pg; G.currentStep=_st;
  G.data = JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-8: restore returns the seed identity');
})();

/* ── FB1-13: F-13 — adoption never re-commits the stale DOM (Fix Batch 1 item 13, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _pg = G.currentPage, _st = G.currentStep;
  G.go('1.2');  // mount the landscape fields
  /* (a) a foreign edit to a mounted-but-unfocused field survives adoption and the next save */
  G.document.getElementById('ll_ownershipGap').value = 'stale dom paint';
  const fresh = JSON.parse(G.Store.orgRaw(G.currentOrgId));
  fresh.landscapeNotes = fresh.landscapeNotes || {};
  fresh.landscapeNotes.ownershipGap = 'foreign edit F-13a';
  G.Store.writeOrg(G.currentOrgId, fresh);           // rev bumps past the replica: a foreign write
  G.document.activeElement = null;                    // nothing focused
  ok(G.Store.refreshOrg() === true, 'FB1-13: refreshOrg adopts the newer foreign blob');
  eq((G.data.landscapeNotes||{}).ownershipGap, 'foreign edit F-13a', 'FB1-13(a): a mounted-but-unfocused foreign edit survives adoption (stale DOM not harvested)');
  G.saveData();
  eq((G.Store.readOrg(G.currentOrgId).landscapeNotes||{}).ownershipGap, 'foreign edit F-13a', 'FB1-13(a): the foreign edit survives the adopting session\u2019s next save');
  /* (b) the focused field\u2019s in-progress value survives adoption (\u00a77A: harvested alone) */
  const elF = G.document.getElementById('ll_mmAssessment');
  elF.value = 'typing in progress F-13b';
  G.document.activeElement = elF;
  const fresh2 = JSON.parse(G.Store.orgRaw(G.currentOrgId));
  fresh2.landscapeNotes.mmAssessment = 'foreign value the focused typing beats';
  G.Store.writeOrg(G.currentOrgId, fresh2);
  ok(G.Store.refreshOrg() === true, 'FB1-13: refreshOrg adopts again with a field focused');
  eq((G.data.landscapeNotes||{}).mmAssessment, 'typing in progress F-13b', 'FB1-13(b): the focused field\u2019s in-progress value survives adoption');
  eq(elF.value, 'typing in progress F-13b', 'FB1-13(b): restoreFocus leaves the element carrying the in-progress value');
  eq((G.data.landscapeNotes||{}).ownershipGap, 'foreign edit F-13a', 'FB1-13(b): the unfocused sibling still carries the foreign value (harvest narrowed to one field)');
  G.document.activeElement = null;
  /* (c) single-session: typed-but-unsaved values still survive an ordinary re-render */
  G.document.getElementById('ll_ownershipGap').value = 'typed locally F-13c';
  G.render();
  eq((G.data.landscapeNotes||{}).ownershipGap, 'typed locally F-13c', 'FB1-13(c): ordinary renders keep the harvest-all behavior (typed text never dies)');
  G.document.getElementById('ll_ownershipGap').value = '';
  G.document.getElementById('ll_mmAssessment').value = '';
  G.currentPage=_pg; G.currentStep=_st;
  G.data = JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-13: restore returns the seed identity');
})();

/* ── FB1-9: the seed speaks the selects\u2019 vocabulary (item 9: F-8 + F-14 + the global audit, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data); const _pg=G.currentPage,_st=G.currentStep;
  /* source: the twelve review enums carry the ruled mapping; the narrative forms are gone */
  eq((code.match(/assessment:'developed'/g)||[]).length, 4, 'FB1-9: seed carries developed \u00d74 (Strong\u2192developed)');
  eq((code.match(/assessment:'progressing'/g)||[]).length, 4, 'FB1-9: progressing \u00d74 (Developing/Improving\u2192progressing)');
  eq((code.match(/assessment:'support'/g)||[]).length, 2, 'FB1-9: support \u00d72 (Early\u2192support)');
  eq((code.match(/assessment:'hard'/g)||[]).length, 2, 'FB1-9: hard \u00d72 (Not started\u2192hard)');
  ok(["assessment:'Strong'","assessment:'Developing'","assessment:'Improving'","assessment:'Early'","assessment:'Not started'"].every(function(f){return code.indexOf(f)<0;}), 'FB1-9: no narrative enum survives in the seed');
  /* behavioral: a 4.3 harvest pass leaves canonical values unchanged; the tally sums to 12 */
  const canon = {seed_ceo:'developed',seed_coo:'developed',seed_caio:'developed',seed_cfo:'progressing',seed_cmo:'progressing',seed_cpo:'progressing',seed_cito:'developed',seed_vpeng:'progressing',seed_vpsales:'support',seed_vpdata:'support',seed_vpops:'hard',seed_vphr:'hard'};
  if(!G.data.leadershipReview)G.data.leadershipReview={leaders:{}};
  Object.keys(canon).forEach(function(lid){
    if(!G.data.leadershipReview.leaders[lid])G.data.leadershipReview.leaders[lid]={};
    G.data.leadershipReview.leaders[lid].assessment = canon[lid];
    G.document.getElementById('rv_'+lid+'_assessment').value = canon[lid];
    G.document.getElementById('rv_'+lid+'_notes').value = 'n-'+lid;
  });
  G.go('4.3'); /* renders + harvest-all over the mounted fields */
  const after = G.data.leadershipReview.leaders;
  ok(Object.keys(canon).every(function(lid){ return (after[lid]||{}).assessment === canon[lid]; }), 'FB1-9: a 4.3 harvest pass leaves the canonical values unchanged (no wipe)');
  const tally = {developed:0,progressing:0,support:0,hard:0};
  Object.keys(after).forEach(function(lid){ const v=(after[lid]||{}).assessment; if(tally.hasOwnProperty(v)) tally[v]++; });
  ok(tally.developed===4 && tally.progressing===4 && tally.support===2 && tally.hard===2, 'FB1-9: the Review Report tally is non-zero and sums to 12 (4/4/2/2)');
  const rr = noThrow(function(){ G.go('out-review'); return G.document.getElementById('app').innerHTML||''; }, 'FB1-9: the Review Report renders');
  ok(typeof rr==='string' && rr.indexOf('Hard Conversation') >= 0, 'FB1-9: the catch-all badge exists only as the hard-conversation legend/count surface');
  /* F-14: the org modal\u2019s selects render the seeded values; an enterprise save round-trips them */
  G.data = JSON.parse(_snap); G.saveData();
  eq((G.data.enterprise||{}).size, '201\u20131,000', 'FB1-9: the seed adopts the size select\u2019s own option value');
  eq((G.data.enterprise||{}).maturity, 'Piloting', 'FB1-9: the seed adopts the maturity select\u2019s own option value');
  G.currentModal='org'; G.renderOrgModal();
  const mh = G.document.getElementById('modalRoot').innerHTML || '';
  ok(mh.indexOf('value="201\u20131,000" selected') >= 0, 'FB1-9: the org modal\u2019s size select renders populated');
  ok(mh.indexOf('value="Piloting" selected') >= 0, 'FB1-9: the org modal\u2019s maturity select renders populated');
  ['name','industry','size','region','website','maturity','sponsor','objective'].forEach(function(f){ G.document.getElementById('ent_'+f).value = (G.data.enterprise||{})[f] || ''; });
  G.saveEnterprise();
  ok((G.data.enterprise||{}).size === '201\u20131,000' && (G.data.enterprise||{}).maturity === 'Piloting', 'FB1-9: an enterprise save round-trips both values unchanged');
  G.currentModal=null; G.document.getElementById('modalRoot').innerHTML='';
  /* the global audit, made permanent: every seed-written select-rendered field speaks its select\u2019s vocabulary */
  const V = {
    'leaders.fluency':['','1','2','3','4','5'], 'leaders.engagement':['','active','developing','notyet'],
    'leaders.scope':['','org','dept','team'], 'leaders.bandwidth':['','overloaded','stretched','manageable','available']
  };
  let oov = [];
  (G.data.leaders||[]).forEach(function(l){
    [['fluency','leaders.fluency'],['engagement','leaders.engagement'],['scope','leaders.scope'],['bandwidth','leaders.bandwidth']].forEach(function(pr){
      const v=l[pr[0]]; if(v!==undefined && v!==null && V[pr[1]].indexOf(v)<0) oov.push(l.id+'.'+pr[0]);
    });
  });
  const a2=G.data.assessments||{};
  [[ (a2.fluency||{}).engagement, ['','none','delegated','occasional','regular','deep'], 'fluency.engagement'],
   [ (a2.structure||{}).ownership, ['','cio','cto','ceo','cao','cdo','ctro','cino','cito','distributed','nobody','adhoc','other'], 'structure.ownership'],
   [ (a2.structure||{}).boardOversight, ['','dedicated','shared','none','unknown','other'], 'structure.boardOversight'],
   [ (a2.structure||{}).crossFunc, ['','active','dormant','none','other'], 'structure.crossFunc'],
   [ (a2.ethical||{}).workforce, ['','automate_reduce','augment_redeploy','augment_grow','undecided'], 'ethical.workforce'],
   [ (G.data.structure||{}).ownerModel, ['','cito','cao','ctro','expand_cio','council','dual'], 'structure.ownerModel'],
   [ (G.data.structure||{}).boardStructure, ['','dedicated','expanded','standing','none','other'], 'structure.boardStructure'],
   [ (G.data.structure||{}).coordMechanism, ['','council','epmo','matrix','rotation','network'], 'structure.coordMechanism'],
   [ (G.data.opRhythm||{}).simFreq, ['','monthly','quarterly','biannual'], 'opRhythm.simFreq']
  ].forEach(function(t){ if(t[0]!==undefined && t[0]!==null && t[1].indexOf(t[0])<0) oov.push(t[2]); });
  ok(oov.length === 0, 'FB1-9: global audit \u2014 zero out-of-vocabulary seed values across select-rendered fields' + (oov.length?(' ['+oov.join(', ')+']'):''));
  G.currentPage=_pg; G.currentStep=_st; G.data=JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-9: restore returns the seed identity');
})();

/* ── FB1-10: one zero-roster guard, one behavior (item 10, F-9, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _org = G.currentOrgId, _user = G.currentUserId;
  const CANON = 'This organization has no members yet. Add one first.';
  ok(code.indexOf("alert('This organization has no members yet.')") < 0, 'FB1-10: the short drifted guard string is gone');
  const b = G.createOrg('FB10 Empty', {name:'Tmp', username:'tmp', passcode:'1'});
  const blob = G.Store.readOrg(b.orgId); blob.roster = []; blob.members = [];
  G.Store.writeOrg(b.orgId, blob);
  G.switchToOrg(_org); G.Auth.setSession(_user);
  /* modal path */
  const _ia10 = G.isAppAdmin; G.isAppAdmin = true; /* Sweep 4R item 10: the console's functions are the app administrator's */
  let a0 = alerts.length;
  G.adminOpenOrg(b.orgId);
  eq(alerts[alerts.length-1], CANON, 'FB1-10: the modal path alerts the canonical string');
  ok(alerts.length === a0 + 1 && G.currentOrgId === _org && G.currentUserId === _user, 'FB1-10: the modal path stays where the user was (org and session restored)');
  /* console path */
  a0 = alerts.length;
  G.adminConsoleOpen(b.orgId);
  eq(alerts[alerts.length-1], CANON, 'FB1-10: the console path alerts the identical string');
  ok(G.currentOrgId === _org && G.currentUserId === _user, 'FB1-10: the console path also restores org and session');
  G.isAppAdmin = _ia10;
  G.UI.entry = null;
  G.deleteOrgById(b.orgId);
  G.data = JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-10: restore returns the seed identity');
})();

/* ── FB1-11: the empty-chart guidance is reachable (item 11, F-10, ruled 27 July) ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _org = G.currentOrgId, _user = G.currentUserId; const _pg=G.currentPage,_st=G.currentStep;
  const b = G.createOrg('FB11 Fresh', {name:'Fresh', username:'fresh', passcode:'1'});
  G.Auth.setSession(b.userId);
  G.go('phase5');
  let app = G.document.getElementById('app').innerHTML || '';
  ok(app.indexOf('Your org chart is empty') >= 0, 'FB1-11: a fresh org\u2019s 5.1 dashboard shows the guidance card (placeholder-only chart counts as empty)');
  ok((G.data.orgChart||[]).some(function(r){return r.id==='board';}), 'FB1-11: the auto-injected board placeholder itself is untouched');
  G.data.orgChart.push({id:'fb11r',name:'Real Role',level:2,parentId:'',occupantLeaderId:null,guidingConcepts:'',taggedValues:[],members:[]});
  G.render();
  app = G.document.getElementById('app').innerHTML || '';
  ok(app.indexOf('Your org chart is empty') < 0 && app.indexOf('orgChartWrap') >= 0, 'FB1-11: adding one real role replaces the guidance with the chart');
  G.switchToOrg(_org); G.Auth.setSession(_user);
  G.deleteOrgById(b.orgId);
  G.currentPage=_pg; G.currentStep=_st; G.data=JSON.parse(_snap); G.saveData(); G.render();
  ok(seedIdent(), 'FB1-11: restore returns the seed identity');
})();

/* ── SEAL: every organization is sealed (directive 2 Oct 2026, Part S; S.5 test 4).
      Nothing survives signOut, switchToOrg or createOrg. Theme is this module's
      default, dark, with no stored theme (the directive's code says 'light'). ── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _org = G.currentOrgId, _user = G.currentUserId;
  ok(typeof G.sealSession === 'function' && typeof G.UI_PRISTINE === 'string' && typeof G.COACH_MSGS_PRISTINE === 'string',
     'SEAL: sealSession, UI_PRISTINE and COACH_MSGS_PRISTINE exist');
  const sorted = o => JSON.stringify(Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {}));
  const want = sorted(Object.assign(JSON.parse(G.UI_PRISTINE || '{}'), { theme: 'dark', zoom: 1 }));
  function dirty(){
    G.UI.aNewKey = { x: 1 }; G.UI.sec = 'Z'; G.UI.theme = 'light'; G.UI.zoom = 1.5;
    localStorageStub.setItem('exec-readiness-theme', 'light'); localStorageStub.setItem('exec-readiness-zoom', '1.5');
    localStorageStub.setItem('exec-readiness-sidebar-min', '1'); G.sidebarMinimized = true;
    G.coachMsgs.push({ role: 'user', text: 'SEAL COACH MARKER' });
    G.gchatMarkSeen(); G.data.chatMsgs = G.data.chatMsgs || [];
    for (let i = 0; i < 4; i++) G.data.chatMsgs.push({ who: 'x', name: 'X', ts: '', text: 'seal ' + i });
    G.currentPage = 'insights'; G.insightsTab = 'archive';
    G.navHistory.push({ page: 'home', step: null });
    G.notesOpen = false; G.data.notes = G.data.notes || [];
    G.data.notes.push({ id: 'sealn', text: 'SEAL NOTE MARKER', date: new Date().toISOString() });
    G.toggleNotes();
    eq(G.gchatUnread(), 4, 'SEAL: fixture — the unread count is 4 before the seal');
  }
  function check(how){
    const ui = Object.assign({}, G.UI); delete ui.entry;
    eq(sorted(ui), want, 'SEAL ' + how + ': UI (without entry) is the pristine UI with the default theme and zoom 1');
    eq(JSON.stringify(G.coachMsgs), G.COACH_MSGS_PRISTINE, 'SEAL ' + how + ': the AI Guide is back at its opening message');
    eq(G.gchatUnread(), 0, 'SEAL ' + how + ': the unread count is 0');
    eq(G.currentPage, 'home', 'SEAL ' + how + ': the page is Home');
    eq(G.navHistory.length, 0, 'SEAL ' + how + ': navHistory is empty');
    eq(G.insightsTab, 'latest', 'SEAL ' + how + ': the Insights tab is back at Latest');
    ok(!G.notesOpen && (G.document.getElementById('notesPanel').innerHTML || '').indexOf('SEAL NOTE MARKER') < 0,
       'SEAL ' + how + ': the Notes panel is closed and holds nothing from before');
    ok(G.sidebarMinimized === false && G.sidebarOpen === true, 'SEAL ' + how + ': the sidebar is open, not minimized');
    eq(localStorageStub.getItem('exec-readiness-theme'), null, 'SEAL ' + how + ': no stored theme (the default applies)');
    eq(localStorageStub.getItem('exec-readiness-zoom'), '1', 'SEAL ' + how + ': the stored zoom is 1');
    eq(localStorageStub.getItem('exec-readiness-sidebar-min'), '0', 'SEAL ' + how + ': the stored sidebar is not minimized');
  }
  function restore(){ G.switchToOrg(_org); G.Auth.setSession(_user); G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster(); G.render(); }

  /* sign-out */
  const _cf = G.confirm; G.confirm = function(){ return true; };
  dirty(); noThrow(() => G.signOut(), 'SEAL: signOut() runs'); check('signOut');
  ok(G.UI.entry && G.UI.entry.step === 'login', 'SEAL signOut: the sign-in screen follows');
  G.confirm = _cf; restore();
  /* organization switch */
  dirty(); noThrow(() => G.switchToOrg(_org), 'SEAL: switchToOrg() runs'); check('switchToOrg');
  restore();
  /* new organization */
  dirty(); let b; noThrow(() => { b = G.createOrg('SEAL Org', { name: 'Seal', username: 'seal', passcode: '1' }); }, 'SEAL: createOrg() runs'); check('createOrg');
  restore(); if (b) G.deleteOrgById(b.orgId);
  /* deleting the organization being viewed */
  const d = G.createOrg('SEAL Doomed', { name: 'Doom', username: 'doom', passcode: '1' }); G.Auth.setSession(d.userId);
  dirty(); G.deleteOrgById(d.orgId); check('deleteOrgById');
  restore();
  /* the role form's tagged-values buffer (cleared only by Save/Delete) does not cross organizations */
  G.UI.orgAddForm = true; G.UI.orgEditId = null; G.toggleOrgValue('SEAL-VALUE');
  ok(Array.isArray(G._orgTaggedValues) && G._orgTaggedValues.indexOf('SEAL-VALUE') >= 0, 'SEAL: (fixture) a value is ticked in the + Add Role form');
  G.switchToOrg(_org); G.Auth.setSession(_user);
  eq(G._orgTaggedValues, null, 'SEAL: after a switch the role form\'s tagged-values buffer is empty (resetSessionBuffers)');
  restore();
  /* S.4: a reload never seals */
  const boot = String(G.bootApp);
  const calls = (fn) => String(fn).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   /* code only: the comments name what must not be called */
  ok(!/sealSession\s*\(|switchToOrg\s*\(/.test(calls(G.bootApp)) && !/sealSession\s*\(|switchToOrg\s*\(/.test(calls(G.resumeSession)), 'SEAL: bootApp and its start-up session check (resumeSession) restore a session without sealSession or switchToOrg (S.4, 5.4.5)');
  ok(seedIdent(), 'SEAL: restore returns the seed identity');
})();

/* ── AI FEATURES: off by default, switched on per organization (directive 2 Oct 2026, Part 2; 2.3 + 2.5) ── */
(function(){
  if (typeof G.aiGuideOn !== 'function' || typeof G.setAiFeature !== 'function') { ok(false, 'AI 2.2.2: aiGuideOn, voiceOn and setAiFeature exist'); return; }
  const _snap = JSON.stringify(G.data); const _org = G.currentOrgId, _user = G.currentUserId, _admin = G.isAppAdmin;
  const calls = []; const _fetch = G.fetch;
  G.fetch = function(u, o){ calls.push(String(u)); return _fetch(u, o); };
  let srMade = 0; const _sr = G.SpeechRecognition;
  G.SpeechRecognition = function(){ srMade++; this.start = function(){ if (this.onstart) this.onstart(); }; this.stop = function(){}; };
  const el = id => G.document.getElementById(id);
  const fold = () => { G.currentModal = 'org'; G.orgSetupMode = false; G.renderOrgModal(); return el('modalRoot').innerHTML || ''; };
  const aiCalls = () => calls.filter(u => u === G.CLAUDE_API_URL).length;

  eq(JSON.stringify(G.emptyData().settings), JSON.stringify({ aiGuide: false, voice: false }), 'AI 2.2.1: emptyData() carries settings, both off');
  const a = G.createOrg('AI Org A', { name: 'Ada Admin', username: 'adaa', passcode: '1' }); G.Auth.setSession(a.userId); G.isAppAdmin = false;
  G.render();
  ok(!G.aiGuideOn() && !G.voiceOn(), 'AI 2.1.1: a new organization has the AI Guide and Voice off');
  eq(el('coachFab').style.display, 'none', 'AI 2.1.2: no AI Guide button while it is off');
  G.toggleCoach(); ok(G.coachOpen === false, 'AI 2.1.2: the AI Guide panel cannot be opened while it is off');
  G.UI.navMore = true; G.renderNav();
  ok((el('navRight').innerHTML || '').indexOf('Voice</button>') < 0, 'AI 2.1.3: no Voice control while Voice is off');
  G.toggleVoice(); eq(srMade, 0, 'AI 2.1.3: speech recognition is never started while Voice is off');
  G.data.settings = undefined; ok(!G.aiGuideOn() && !G.voiceOn(), 'AI 2.2.1: data without settings counts as both off'); G.data.settings = { aiGuide: false, voice: false };

  /* 2.3 test 2: the administrator's fold */
  let h = fold();
  ok(h.indexOf('<details class="ai-fold"') >= 0 && h.indexOf('AI Features (off by default)') >= 0, 'AI 2.1.4: an administrator sees the fold AI Features (off by default) on Profile');
  ok(!/<details class="ai-fold"[^>]* open/.test(h), 'AI 2.1.4: the fold is closed by default');
  ok(h.indexOf('id="aiSet_aiGuide"') >= 0 && h.indexOf('id="aiSet_voice"') >= 0 && !/id="aiSet_(aiGuide|voice)" checked/.test(h), 'AI 2.3.2: both switches are off');
  ok(h.indexOf('<details class="ai-fold"') < h.indexOf('Team Members'), 'AI 2.1.4: the fold is at the top of the page');
  has(h, 'When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.', 'AI A.2.3: the line under the AI Guide switch');
  has(h, 'When this is on, Voice uses the browser\'s own speech recognition. Some browsers send the recording to the browser maker to turn it into text.', 'AI A.2.5: the line under the Voice switch');
  G.UI.aiFoldOpen = true;
  G.setAiFeature('aiGuide', true);
  ok(G.aiGuideOn() && el('coachFab').style.display === '', 'AI 2.3.2: switching the AI Guide on shows its button at once');
  ok(/<details class="ai-fold"[^>]* open/.test(el('modalRoot').innerHTML || ''), 'AI 2.2.7: the fold stays open when a setting changes and the page redraws');
  G.toggleCoach();
  ok(G.coachOpen === true, 'AI 2.3.2: the AI Guide opens');
  const panel = el('coachPanel').innerHTML || '';
  ok(panel.indexOf('You are talking to an AI assistant. It can make mistakes, so check anything important.') >= 0
     && panel.indexOf('coach-ai-notice') < panel.indexOf('coach-msgs'), 'AI 2.1.6 / A.2.6: its first line says it is an AI');
  /* 2.3 test 3 */
  G.setAiFeature('aiGuide', false);
  ok(G.coachOpen === false && el('coachFab').style.display === 'none', 'AI 2.3.3: switching it off closes the open panel and hides the button');
  /* 2.3 test 4 */
  G.setAiFeature('voice', true); G.UI.navMore = true; G.renderNav();
  ok((el('navRight').innerHTML || '').indexOf('Voice</button>') >= 0, 'AI 2.3.4: switching Voice on shows its control');
  G.toggleVoice(); eq(srMade, 1, 'AI 2.3.4: with Voice on, speech recognition starts');
  G.setAiFeature('voice', false);
  ok(G._voiceActive === false, 'AI 2.3.4: switching Voice off stops the microphone');
  G.UI.navMore = true; G.renderNav();
  ok((el('navRight').innerHTML || '').indexOf('Voice</button>') < 0, 'AI 2.3.4: and its control disappears');
  /* 2.3 test 5: a person without administrator rights */
  G.data.roster.push({ id: 'ai_member', name: 'Mo Member', username: 'mo', role: 'Analyst', initials: 'MM', color: '#888888', scope: 'All', admin: false });
  G.saveData(); G.applyTeamRoster(); G.Auth.setSession('ai_member');
  ok(!G.canSetAiFeatures() && fold().indexOf('ai-fold') < 0, 'AI 2.3.5: a person without administrator rights sees no AI features fold');
  G.setAiFeature('aiGuide', true); ok(!G.aiGuideOn(), 'AI 2.3.5: and calling setAiFeature changes nothing');
  G.isAppAdmin = true; ok(G.canSetAiFeatures(), 'AI: the app administrator may set them'); G.isAppAdmin = false;
  G.currentModal = null; el('modalRoot').innerHTML = '';
  /* 2.3 test 6: per organization */
  G.Auth.setSession(a.userId); G.setAiFeature('aiGuide', true);
  const b = G.createOrg('AI Org B', { name: 'Bo Admin', username: 'boa', passcode: '1' }); G.Auth.setSession(b.userId);
  ok(!G.aiGuideOn(), 'AI 2.3.6: switching the AI Guide on in organization A leaves organization B off');
  G.switchToOrg(a.orgId); G.Auth.setSession(a.userId);
  ok(G.aiGuideOn(), 'AI 2.3.6: and organization A keeps it on');
  /* 2.5: Team Chat carries no AI */
  G.switchToOrg(b.orgId); G.Auth.setSession(b.userId);
  const n0 = G.chatArr().length; calls.length = 0;
  el('gchatInput').value = 'SEAL-FREE CHAT LINE';
  G.sendGChat();
  const added = G.chatArr().slice(n0);
  ok(added.length === 1 && added[0].text === 'SEAL-FREE CHAT LINE' && added[0].who === b.userId, 'AI 2.5: a message posts exactly once, under the poster\'s name');
  eq(aiCalls(), 0, 'AI 2.5: no request goes to the AI service');
  ok(!/is typing/.test(el('gchatTyping').textContent || ''), 'AI 2.5: no "is typing" line');
  ok(!/fetch\(CLAUDE_API_URL/.test(code), 'AI 2.1.2: nothing in the module sends a request to the AI service');
  ok(/function sendCoach\(\) \{ if \(!aiGuideOn\(\)\) return;/.test(code), 'AI 2.2.5: the AI Guide\'s request function begins with the guard');

  G.fetch = _fetch; G.SpeechRecognition = _sr; G.isAppAdmin = _admin; G.UI.navMore = false;
  G.switchToOrg(_org); G.Auth.setSession(_user);
  G.deleteOrgById(a.orgId); G.deleteOrgById(b.orgId);
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster(); G.render();
  ok(seedIdent(), 'AI: restore returns the seed identity');
})();

/* ── SAMPLE TAB: a private sample organization, opened from Demo (directive 2 Oct 2026, Part 3) ──
      A second page load in the SAME browser: it shares this sandbox's localStorage, has its own document,
      and its address carries ?sample=1. */
(function(){
  if (typeof G.openSampleTab !== 'function' || typeof G.startSampleTab !== 'function') { ok(false, 'SAMPLE 3.3.1: openSampleTab and startSampleTab exist'); return; }
  function sampleTab(opts) {
    const byId = Object.create(null); const fetched = []; const opened = [];
    const doc = Object.assign({}, documentStub, { getElementById(id){ if(!byId[id]){ byId[id]=el(); byId[id].id=id; } return byId[id]; }, activeElement: null, body: el('body'), documentElement: el('html'), head: el('head') });
    const sb = Object.assign({}, sandbox, {
      document: doc, alerts: [],
      location: { search: (opts && opts.search) || '?sample=1', pathname: '/apps/enterprises/dev/executive-readiness/index.html', href: '', replace(){} },
      opener: (opts && opts.opener) || null,
      open(u, t){ opened.push([u, t]); return null; },
      fetch: (u) => { fetched.push(String(u)); return Promise.resolve({ ok:false, status:0, text:()=>Promise.resolve(''), json:()=>Promise.resolve({}) }); }
    });
    vm.createContext(sb); sb.Date = __FrozenDate; sb.window = sb; sb.self = sb; sb.globalThis = sb;
    vm.runInContext(code, sb, { filename: 'app.js (second tab)' });
    return { G: sb, $: id => doc.getElementById(id), fetched, opened };
  }
  const ls = localStorageStub;
  const orgs0 = JSON.stringify(G.getOrgs()), ptr0 = G.Store.getCurrentOrg(), mainData0 = G.Store.orgRaw(G.currentOrgId);
  const remember0 = ls.getItem('exec-readiness-remember');

  /* the person's own tab: Demo where Notes was, Notes in the More menu with its count */
  G.UI.navMore = true; G.renderNav();
  let nr = G.document.getElementById('navRight').innerHTML;
  ok(/<button id="sampleNavBtn"[^>]*onclick="openSampleTab\(\)">&#9673; Demo<\/button>/.test(nr) && nr.indexOf('id="notesNavBtn"') < 0, 'SAMPLE 3.3.7: Demo (A.3.1) is in the top bar where the Notes button was');
  const iChat = nr.indexOf('Team Chat'), iDemo = nr.indexOf('sampleNavBtn'), iMore = nr.indexOf('⋯ More');
  ok(iChat > 0 && iDemo > iChat && iMore > iDemo, 'SAMPLE 3.3.7: the top bar reads Help, Dark mode, Team Chat, Demo, More');
  const iNotes = nr.indexOf('toggleNotes()"><span class="nav-more-ic">&#9998;</span> Notes <span id="notesCount" class="notes-count">'), iProf = nr.indexOf('Profile</button>');
  ok(iNotes > 0 && iNotes < iProf, 'SAMPLE 3.3.8: Notes is in the More menu, above Org & Team, with its count');
  ok(nr.indexOf('Seed sample data') > 0 && nr.indexOf('Start the sample again') < 0, 'SAMPLE 3.2.9: the existing sample item stays in the person\'s own More menu; Start again is only in the sample tab');
  ok(!/<button[^>]*>[^<]*\/\*/.test(nr) && nr.indexOf('Part 3') < 0, 'SAMPLE 3.3.9: no code comment is drawn on screen');
  G.UI.navMore = false;

  /* 3.4 test 3: opened any other way, only A.3.6 */
  ls.removeItem('sample-tab-pass');
  const refused = sampleTab();
  ok(refused.G.SAMPLE_MODE === true && refused.G.SAMPLE_REFUSED === true, 'SAMPLE 3.2.2: a sample tab with no pass and no signed-in opener is refused');
  eq(refused.$('app').innerHTML, '<div class="sample-refused"><p>Sign in to your organization, then open Demo from the top bar.</p></div>', 'SAMPLE A.3.6: it shows only the refusal line');
  eq(refused.$('navRight').innerHTML, '', 'SAMPLE 3.2.2: no top bar, no sign-in form');

  /* 3.4 test 1: Demo opens the sample in a new tab */
  const _open = G.open; const opened = []; G.open = function(u, t){ opened.push([u, t]); return null; };
  const _loc = G.location; G.location = { search: '', pathname: '/apps/enterprises/dev/executive-readiness/index.html' };
  G.openSampleTab();
  G.open = _open; G.location = _loc;
  ok(opened.length === 1 && opened[0][0] === '/apps/enterprises/dev/executive-readiness/index.html?sample=1' && opened[0][1] === '_blank', 'SAMPLE 3.3.1: Demo opens the module in a new tab, in sample mode');
  ok(!!JSON.parse(ls.getItem('sample-tab-pass') || 'null'), 'SAMPLE 3.3.1: it leaves a pass in the browser\'s storage');
  const t = sampleTab();
  const S = t.G;
  ok(S.SAMPLE_MODE === true && S.SAMPLE_REFUSED === false && S.currentOrgId === 'org_sample_local', 'SAMPLE 3.3.2: the pass is accepted; the tab works on org_sample_local');
  eq(ls.getItem('sample-tab-pass'), null, 'SAMPLE 3.3.2: the pass is removed, so it works only once');
  ok(sampleTab().G.SAMPLE_REFUSED === true, 'SAMPLE 3.3.2: a second tab on the spent pass is refused');
  eq(G.Store.getCurrentOrg(), ptr0, 'SAMPLE 3.3.2: the person\'s own stored organization pointer is untouched');
  eq(JSON.stringify(G.getOrgs()), orgs0, 'SAMPLE: the sample organization is not in the organization list (nobody signs in to it)');
  eq(ls.getItem('exec-readiness-remember'), remember0, 'SAMPLE: the remembered sign-in is untouched');
  ok((S.data.leaders || []).length >= 10 && (S.data.roster || []).length > 1, 'SAMPLE 3.2.4: the copy is created from the built-in sample');
  ok(!!S.currentUserId && S.currentUserId === (S.USERS[0] || {}).id, 'SAMPLE 3.2.4: the tab enters as the first sample person');
  ok((S.data.roster || []).concat(S.USERS).every(u => !('passcode' in u)), 'SAMPLE 3.2.4: the sample people have no passwords');
  ok(JSON.stringify(S.data.settings) === '{"aiGuide":false,"voice":false}', 'SAMPLE 3.3.2: its AI settings are off');

  /* 3.2.6 / 3.3.4: AI Guide, Voice, Team Chat off whatever the settings say; no email */
  S.data.settings = { aiGuide: true, voice: true };
  ok(!S.aiGuideOn() && !S.voiceOn(), 'SAMPLE 3.3.4: the AI Guide and Voice are off in the sample tab, whatever the settings say');
  S.toggleGChat(); ok(S.gchatOpen === false, 'SAMPLE 3.3.4: Team Chat refuses to open');
  S.data.settings = { aiGuide: false, voice: false };
  S.NOTIFY_ENDPOINT = 'https://notify.example.test/send'; t.fetched.length = 0;
  try { S.notifyQueue('step', 'Sample subject', ['someone@example.test'], '1.1'); } catch (e) { }
  ok(t.fetched.filter(u => /notify/.test(u)).length === 0, 'SAMPLE 3.2.6: no email is sent from the sample tab');
  S.NOTIFY_ENDPOINT = '';

  /* 3.2.7: the sample tab's top bar and More menu */
  S.UI.navMore = true; S.render();
  const snr = t.$('navRight').innerHTML;
  ok(snr.indexOf('sampleNavBtn') < 0, 'SAMPLE 3.2.7: no Demo button in the sample tab');
  ok(snr.indexOf('Team Chat') < 0, 'SAMPLE 3.3.4: no Team Chat button');
  ok(snr.indexOf('Start the sample again</button>') > 0 && snr.indexOf('Close the sample</button>') > 0, 'SAMPLE 3.2.7: the More menu offers Start the sample again (A.3.3) and Close the sample (A.3.5)');
  ok(snr.indexOf('Notes <span') < 0 && snr.indexOf('Profile</button>') < 0 && snr.indexOf('Admin</button>') < 0, 'SAMPLE 3.2.7: it shows neither Notes, Org & Team nor Admin');
  ok(snr.indexOf('Seed sample data') < 0 && snr.indexOf('Reset all data') < 0, 'SAMPLE 3.2.9: the existing sample items (and Reset) are hidden in the sample tab');
  ok(snr.indexOf('<div class="nav-user-chip" onclick="signOut()"') >= 0, 'SAMPLE (Sweep 4R item 9.2, amends Part 3): the name chip is Sign Out, which closes the sample');
  ok(snr.indexOf('exportState()') < 0 && snr.indexOf('importState()') < 0, 'SAMPLE (Sweep 4R item 9.1, amends Part 3): no Export state or Import state in the sample tab\'s More menu');
  { const _cs = S.closeSample, _u = S.currentUserId; let n = 0; S.closeSample = function () { n++; }; S.signOut(); S.closeSample = _cs;
    ok(n === 1 && S.currentUserId === _u && !S.UI.entry, 'SAMPLE (Sweep 4R item 9.2): signOut in the sample tab closes the sample; nobody is signed out, no sign-in screen'); }
  S.UI.navMore = false;

  /* 3.2.3 / 3.4 test 2: changes stay in this browser, under the sample's own key; the person's organization is unchanged */
  const n0 = S.data.leaders.length;
  S.data.leaders.push({ id: 'sample_extra', name: 'SAMPLE ONLY LEADER' }); S.saveData();
  ok((ls.getItem('exec-readiness-org-data::org_sample_local') || '').indexOf('SAMPLE ONLY LEADER') >= 0, 'SAMPLE 3.3.3: a change is kept in the browser under the sample\'s own key');
  eq(G.Store.orgRaw(G.currentOrgId), mainData0, 'SAMPLE 3.4.2: the person\'s own organization is unchanged');
  eq(t.fetched.length, 0, 'SAMPLE 3.3.3: the sample tab has made no request to any server');
  const locks0 = ls.getItem('exec-readiness-locks::org_sample_local');
  ok(S.Collab.acquire('leaders') === true && ls.getItem('exec-readiness-locks::org_sample_local') === locks0, 'SAMPLE 3.3.3: no locks');
  S.confirm = () => true; S.signOut();
  ok(!!S.currentUserId, 'SAMPLE: signing out is a no-op in the sample tab (it would clear the shared remembered sign-in)');

  /* 3.4 test 5: Start the sample again */
  let asked = ''; S.confirm = (m) => { asked = m; return true; };
  S.restartSample();
  eq(asked, 'Start the sample again? Your changes in this tab are replaced with the original sample.', 'SAMPLE A.3.4: Start again asks first');
  ok(S.data.leaders.length === n0 && !S.data.leaders.some(l => l.id === 'sample_extra'), 'SAMPLE 3.4.5: the original sample returns');
  ok((S.data.roster || []).concat(S.USERS).every(u => !('passcode' in u)) && S.currentPage === 'home', 'SAMPLE: still no passwords, and back on Home');

  /* a reload of the sample tab keeps its changes (the copy is only created when empty) */
  S.data.leaders.push({ id: 'sample_keep', name: 'KEPT ON RELOAD' }); S.saveData();
  G.open = function(){ return null; }; G.location = { search: '', pathname: '/x' }; G.openSampleTab(); G.open = _open; G.location = _loc;
  ok(sampleTab().G.data.leaders.some(l => l.id === 'sample_keep'), 'SAMPLE 3.2.4: the copy is created only the first time; afterwards it is the person\'s own');
  ls.removeItem('exec-readiness-org-data::org_sample_local'); ls.removeItem('sample-tab-pass');
})();

/* ── RESET / DELETE: the admin console only (directive 2 Oct 2026, Part 4; 4.4) ── */
(function(){
  if (typeof G.resetOrgData !== 'function' || typeof G.withOrgData !== 'function') { ok(false, 'RESET 4.3: withOrgData and resetOrgData exist'); return; }
  const _snap = JSON.stringify(G.data); const _org = G.currentOrgId, _user = G.currentUserId, _admin = G.isAppAdmin, _cf = G.confirm;
  const inRoster = (orgId, un) => ((JSON.parse(G.Store.orgRaw(orgId) || '{}').roster) || []).some(m => m && m.username === un);
  let asked = []; G.confirm = (m) => { asked.push(m); return true; };
  /* fixture: organization R with an administrator, two members and program data; organization K untouched */
  const r = G.createOrg('Reset Org', { name: 'Rae Admin', username: 'raeadm' });
  G.data.roster.push({ id: 'rm1', name: 'Mem One', username: 'memone', admin: false, initials: 'M1', color: '#888888' },
                     { id: 'rm2', name: 'Mem Two', username: 'memtwo', admin: false, initials: 'M2', color: '#888888' });
  G.data.leaders = [{ id: 'l1', name: 'Leader One' }]; G.data.risks = [{ id: 'r1', name: 'Risk' }]; G.data.completedSteps = { '1.1': true };
  G.data.notes = [{ id: 'n1', text: 'a note' }]; G.data.settings = { aiGuide: true, voice: false }; G.saveData(); G.applyTeamRoster();
  const k = G.createOrg('Keep Org', { name: 'Kit Admin', username: 'kitadm' });
  G.data.leaders = [{ id: 'k1', name: 'Kept Leader' }]; G.data.roster.push({ id: 'km', name: 'Kay Member', username: 'kaymem', admin: false, initials: 'KM', color: '#888888' }); G.saveData(); G.applyTeamRoster();
  const kRaw0 = G.Store.orgRaw(k.orgId);
  ok(inRoster(r.orgId, 'memone') && inRoster(r.orgId, 'raeadm'), 'RESET fixture: the member and the administrator are on the people list before the reset');

  /* the Admin panel, viewing organization K, resets organization R */
  G.switchToOrg(k.orgId); G.Auth.setSession(k.userId); G.isAppAdmin = true;
  G.openAdmin(); G.UI.aNewKey = { x: 1 }; G.UI.theme = 'light';
  const mh = G.document.getElementById('modalRoot').innerHTML || '';
  ok((mh.match(/onclick="adminResetOrg\('/g) || []).length === G.getOrgs().length, 'RESET 4.2.2: Reset data (A.4.0) is on every organization\'s row, the current one included');
  has(mh, '>Reset data</button>', 'RESET A.4.0: the button reads Reset data');
  asked = []; G.adminResetOrg(r.orgId);
  eq(asked[0], 'Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.', 'RESET A.4.1: it asks first, stating the removal');
  const d = JSON.parse(G.Store.orgRaw(r.orgId));
  ok(d.roster.length === 1 && d.roster[0].username === 'raeadm' && d.roster[0].admin === true, 'RESET 4.4.1: the administrator stays; every other member is gone from the people list');
  ok(inRoster(r.orgId, 'raeadm') && !inRoster(r.orgId, 'memone') && !inRoster(r.orgId, 'memtwo'), 'RESET 4.4.1: the administrator stays on the people list, the members are gone from it (their sign-ins: the end-to-end block, through the stand-in)');
  ok(!(d.leaders || []).length && !(d.risks || []).length && !Object.keys(d.completedSteps || {}).length && !(d.notes || []).length, 'RESET 4.4.1: its steps, outputs and records are empty');
  eq(JSON.stringify(d.settings), '{"aiGuide":true,"voice":false}', 'RESET 4.4.1: its AI settings are as they were');
  ok(d.enterprise && d.enterprise.name === 'Reset Org' && !!G.getOrg(r.orgId), 'RESET 4.2.2: the organization and its name stay');
  eq(G.Store.orgRaw(k.orgId), kRaw0, 'RESET 4.4.1: every other organization is unchanged');
  ok(G.currentModal === 'admin' && G.currentOrgId === k.orgId && G.currentUserId === k.userId, 'RESET 4.4.1: the admin console stays open, on the organization being viewed');
  ok(G.UI.aNewKey && G.UI.theme === 'light', 'RESET 4.3: no switchToOrg and no seal — the administrator\'s session is untouched');
  /* resetting the organization being viewed, signed in as a member who is removed */
  G.switchToOrg(r.orgId); G.data.roster.push({ id: 'rm3', name: 'Mem Three', username: 'memthree', admin: false, initials: 'M3', color: '#888888' }); G.saveData(); G.applyTeamRoster();
  G.Auth.setSession('rm3'); G.isAppAdmin = true; G.adminResetOrg(r.orgId);
  ok(G.currentOrgId === r.orgId && G.getCurrentUser() && G.getCurrentUser().admin === true, 'RESET: resetting the organization being viewed keeps the viewer in it; a removed viewer is replaced by its administrator');
  /* the full-screen console */
  G.isAppAdmin = true; G.UI.entry = null; asked = []; G.adminConsoleReset(k.orgId);
  ok(asked.length === 1 && G.UI.entry && G.UI.entry.step === 'admin' && JSON.parse(G.Store.orgRaw(k.orgId)).roster.length === 1, 'RESET 4.2.2: the full-screen console\'s Reset data does the same and stays on the console');
  /* only the app administrator */
  G.isAppAdmin = false; asked = []; G.adminResetOrg(r.orgId); G.adminConsoleReset(r.orgId);
  ok(asked.length === 0, 'RESET: without the app administrator\'s session, nothing is reset');
  /* 4.2.3 the More menu */
  G.switchToOrg(_org); G.Auth.setSession(_user); G.UI.navMore = true; G.renderNav();
  ok((G.document.getElementById('navRight').innerHTML || '').indexOf('Reset all data') < 0 && typeof G.clearData === 'undefined', 'RESET 4.2.3: the More menu\'s Reset all data is gone');
  G.UI.navMore = false;
  /* S.4: adding an organization from the admin console is not a change of organization */
  G.isAppAdmin = true; G.openAdmin(); G.UI.aNewKey = { y: 1 }; const n0 = G.getOrgs().length;
  G.adminAddOrg();
  ok(G.getOrgs().length === n0 && !!G.UI.adminNewOrg && (G.document.getElementById('modalRoot').innerHTML || '').indexOf('id="ano_temp"') > 0 && G.currentModal === 'admin' && G.UI.aNewKey && G.currentOrgId === _org,
     'S.4 / 5.7.4: the Admin panel\'s + Add organization opens its form (first person, temporary password) with the panel open and the session unsealed');
  G.UI.adminNewOrg = null; const added = null;
  /* 4.4.2 Delete stays */
  G.adminDeleteOrg(k.orgId);
  ok(!G.getOrg(k.orgId) && !G.Store.orgRaw(k.orgId), 'RESET 4.4.2: Delete still removes an organization and its data (its sign-ins: the end-to-end block)');
  [r.orgId, added && added.id].forEach(id => { if (id && G.getOrg(id)) G.deleteOrgById(id); });
  G.closeModal(); G.isAppAdmin = _admin; G.confirm = _cf;
  G.switchToOrg(_org); G.Auth.setSession(_user);
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster(); G.render();
  ok(seedIdent(), 'RESET: restore returns the seed identity');
})();

/* ── PERSONAL RECORD (directive 2 Oct 2026, Part 7; 7.2) ── */
(function(){
  if (typeof G.personalRecordDoc !== 'function' || typeof G.prPeople !== 'function') { ok(false, 'PERSON 7.1: personalRecordDoc and prPeople exist'); return; }
  const _snap = JSON.stringify(G.data);
  const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
  const cat = G.rcCatalogue().filter(u => u.group === 'Individual People');
  const people = G.prPeople();
  ok(cat.length > 0 && cat.length === people.length, 'PERSON 7.1.1: the Report Manager has a group Individual People (A.7.1), one entry per person');
  const roster = G.data.roster || [], leaders = G.data.leaders || [];
  ok(roster.every(u => cat.filter(c => c.id === u.id).length === 1), 'PERSON 7.1.1: everyone on the people list appears exactly once');
  ok(leaders.every(l => people.filter(p => p.leaderId === l.id).length === 1), 'PERSON 7.1.1: every leader in the inventory appears exactly once');
  ok(leaders.filter(l => l.userId && roster.some(u => u.id === l.userId)).every(l => people.filter(p => p.leaderId === l.id)[0].id === l.userId), 'PERSON 7.1.1: a leader is matched to a person by the leader\'s userId');

  /* 7.2.1: a sample leader with a user, a practice log and records that name them */
  const l = leaders.filter(x => x.userId && G.data.practiceLog && G.data.practiceLog[x.userId] && Object.keys(G.data.practiceLog[x.userId]).length)[0]
        || leaders.filter(x => x.userId)[0];
  ok(!!l, 'PERSON fixture: a sample leader linked to a user');
  if (!G.data.practiceLog) G.data.practiceLog = {};
  G.data.practiceLog[l.userId] = Object.assign({ slowLog: '2026-09-03T10:00:00.000Z', valuesReview: '2026-09-20T10:00:00.000Z' }, G.data.practiceLog[l.userId] || {});
  G.data.chatMsgs = (G.data.chatMsgs || []).concat([{ who: l.userId, name: l.name, ts: '9:41 AM', text: 'PERSON CHAT MARKER' }]);
  G.data.notes = (G.data.notes || []).concat([{ id: 'prn1', text: 'PERSON NOTE MARKER', date: '2026-09-21T10:00:00.000Z', by: l.userId, byName: l.name, where: 'Step 1.1' }]);
  G.data.risks = (G.data.risks || []).concat([{ id: 'pr_risk', notes: 'Raised by ' + l.name + ' in the review' }]);
  G.data.assigns = Object.assign({}, G.data.assigns, { '2.1': [l.userId] });
  const doc = G.personalRecordDoc(l.userId), txt = strip(doc);
  ok(txt.indexOf('The information this workspace holds about ' + (roster.filter(u => u.id === l.userId)[0] || l).name + ', gathered from every part of the program.') >= 0, 'PERSON 7.1.3: its first line (A.7.3)');
  ok(doc.indexOf('<table class="ly-rec"') >= 0 && txt.indexOf(l.name) >= 0, 'PERSON 7.2.1: the leader record at full depth (as Individual Leaders prints it)');
  const log = G.data.practiceLog[l.userId];
  ok(Object.keys(log).every(k => txt.indexOf(G.LEADER_PRACTICES[k] || k) >= 0 && txt.indexOf(G.lyDate(log[k])) >= 0), 'PERSON 7.2.1: every practice log entry, with its date');
  ok(txt.indexOf('PERSON CHAT MARKER') >= 0 && txt.indexOf('PERSON NOTE MARKER') >= 0, 'PERSON 7.1.2: the Team Chat messages they sent and the notes they wrote');
  ok(txt.indexOf('Raised by ' + l.name) >= 0 && /Assigns/.test(txt), 'PERSON 7.2.1: the other records that name them — by full name (a risk note) and by id (an assignment)');
  const hd = t => doc.indexOf('border-bottom:1px solid #999">' + t + '</div>');   /* the section headings, not a field of the same name inside the leader record */
  const iL = doc.indexOf('ly-rec'), iP = hd('Practices'), iC = hd('Team Chat'), iN = hd('Notes'), iR = hd('Records');
  ok(iL > 0 && iL < iP && iP < iC && iC < iN && iN < iR, 'PERSON 7.1.2: in order — leader record, practice log, Team Chat, notes, other records');

  /* 7.2.2: every record holding the person's id or full name appears in it — checked against an independent scan */
  const ids = [l.userId, l.id], fullName = l.name;
  const skip = ['roster', 'members', 'settings', 'rev', 'schemaVersion', 'notes', 'chatMsgs', 'practiceLog'];
  const holders = Object.keys(G.data).filter(k => skip.indexOf(k) < 0).filter(k => {
    let v = G.data[k]; if (k === 'leaders') v = (v || []).filter(x => x.id !== l.id); if (k === 'reportDefs') return false;
    const js = JSON.stringify(v || '');
    return ids.some(id => js.indexOf('"' + id + '"') >= 0 || js.indexOf('"' + id + '_') >= 0 || js.indexOf('_' + id + '"') >= 0) || js.toLowerCase().indexOf(fullName.toLowerCase()) >= 0;
  });
  const missing = holders.filter(k => doc.indexOf('<td style="vertical-align:top;border-bottom:1px solid #e3e3e3;padding:4px 6px">' + G.esc(G.prLabel(k))) < 0);
  ok(holders.length > 2 && missing.length === 0, 'PERSON 7.2.2: every record holding their id or full name appears (' + holders.length + ' collections' + (missing.length ? '; missing ' + missing.join(', ') : '') + ')');

  /* 7.2.3: a person on the people list who is not a leader, with what they wrote */
  const nl = roster.filter(u => !leaders.some(x => x.userId === u.id))[0];
  ok(!!nl, 'PERSON fixture: a person who is not a leader');
  G.data.notes.push({ id: 'prn2', text: 'NON-LEADER NOTE', date: '2026-09-22T10:00:00.000Z', by: nl.id, byName: nl.name });
  G.data.chatMsgs.push({ who: nl.id, name: nl.name, ts: '10:02 AM', text: 'NON-LEADER CHAT' });
  const ndoc = strip(G.personalRecordDoc(nl.id));
  ok(cat.some(c => c.id === nl.id) && ndoc.indexOf('NON-LEADER NOTE') >= 0 && ndoc.indexOf('NON-LEADER CHAT') >= 0 && ndoc.indexOf('PERSON NOTE MARKER') < 0, 'PERSON 7.2.3: someone on the people list who is not a leader appears, with what they wrote (and nobody else\'s)');
  /* where Team Chat and notes live on the server (the live app): the chat messages the page loaded; notes only the signed-in person's own */
  G.chatMessages = [{ id: 1, user_public_id: l.userId, user_name: l.name, body: 'SERVER CHAT LINE', created_at: '2026-09-23 10:15:00' }, { id: 2, user_public_id: 'someone-else', body: 'OTHER PERSON LINE', created_at: '2026-09-23 10:16:00' }];
  G.notesData = [{ id: 9, body: 'SIGNED-IN PERSON NOTE', step: '1.2', created_at: '2026-09-24 09:00:00' }];
  const _cu = G.currentUserId;
  G.currentUserId = l.userId;
  const sdoc = strip(G.personalRecordDoc(l.userId));
  ok(sdoc.indexOf('SERVER CHAT LINE') >= 0 && sdoc.indexOf('OTHER PERSON LINE') < 0, 'PERSON 7.1.2 (live shape): the server\'s Team Chat messages they sent, and nobody else\'s');
  ok(sdoc.indexOf('SIGNED-IN PERSON NOTE') >= 0, 'PERSON 7.1.2 (live shape): the signed-in person\'s own server notes appear in their own record');
  G.currentUserId = nl.id;
  ok(strip(G.personalRecordDoc(l.userId)).indexOf('SIGNED-IN PERSON NOTE') < 0, 'PERSON (live shape): one person\'s private notes never appear in someone else\'s record');
  G.currentUserId = _cu; delete G.chatMessages; delete G.notesData;
  /* a leader with no user */
  const lo = { id: 'pr_lonely', name: 'Lonely Leader Person', role: 'Advisor' }; G.data.leaders.push(lo);
  const lp = G.prPeople().filter(p => p.leaderId === lo.id)[0];
  ok(!!lp && lp.id === 'leader:pr_lonely' && strip(G.personalRecordDoc(lp.id)).indexOf('Lonely Leader Person') >= 0, 'PERSON 7.1.1: a leader with no user account has a personal record too');

  /* 7.1.4: never a password field */
  (G.data.roster.filter(u => u.id === l.userId)[0] || {}).passcode = 'LEAKED-PIN-1234';
  G.data.risks.push({ id: 'pr_pw', passwordHash: 'pbkdf2$' + l.userId, owner: l.userId });
  const pdoc = G.personalRecordDoc(l.userId);
  ok(pdoc.indexOf('LEAKED-PIN') < 0 && !/passcode|password hash|pbkdf2/i.test(strip(pdoc)), 'PERSON 7.1.4: no password or password field ever appears, even one left in old data');

  /* A.7.2 in the compiled report */
  G.data.reportDefs = (G.data.reportDefs || []);
  const d = { id: 'rpt-person', name: 'Subject access', subtitle: '', intro: '', units: [{ key: 'record:person:' + l.userId, kind: 'record', type: 'person', id: l.userId, name: l.name, depth: '' }], createdAt: 1 };
  G.data.reportDefs.push(d);
  const rep = G.rcCompile('rpt-person');
  ok(strip(rep).indexOf('Personal record: ' + (roster.filter(u => u.id === l.userId)[0] || l).name) >= 0, 'PERSON 7.1.3: the section heading reads Personal record: [name] (A.7.2), in the contents and above the section');
  eq(G.rcKindLabel({ kind: 'record', type: 'person' }), 'Personal record', 'PERSON: the Report Manager names the kind');

  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(seedIdent(), 'PERSON: restore returns the seed identity');
})();

/* ── FONTS: from our own server, not Google's (directive 2 Oct 2026, Part 1) ── */
(function(){
  const dir = path.dirname(APP);
  const deployed = fs.readdirSync(dir).filter(f => /\.(html|js|css)$/.test(f) && !/harness|boot-smoke/.test(f)).map(f => path.join(dir, f))
    .concat(fs.readdirSync(path.join(dir, 'fonts')).filter(f => /\.css$/.test(f)).map(f => path.join(dir, 'fonts', f)));
  const google = deployed.filter(f => /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(f, 'utf8')));
  ok(google.length === 0, 'FONTS: no deployed .html/.js/.css names fonts.googleapis.com or fonts.gstatic.com' + (google.length ? ' (' + google.map(f => path.basename(f)).join(', ') + ')' : ''));
  ['index.html', 'Exec-Readiness-index.html'].forEach(f => {
    has(fs.readFileSync(path.join(dir, f), 'utf8'), '<link rel="stylesheet" href="fonts/fonts.css">', 'FONTS: ' + f + ' links fonts/fonts.css');
  });
  const faces = f => (fs.readFileSync(path.join(dir, 'fonts', f), 'utf8').match(/@font-face\{[^}]*\}/g) || []).map(r =>
    /font-family:'([^']+)'/.exec(r)[1] + ' ' + /font-style:(\w+)/.exec(r)[1] + ' ' + /font-weight:(\d+)/.exec(r)[1]).filter((v, i, a) => a.indexOf(v) === i).sort().join(', ');
  eq(faces('fonts.css'), 'Cormorant Garamond italic 300, Cormorant Garamond italic 400, Cormorant Garamond normal 300, Cormorant Garamond normal 400, Cormorant Garamond normal 600, DM Mono normal 300, DM Mono normal 400',
     'FONTS: fonts.css declares exactly the weights index.html loaded from Google');
  eq(faces('print.css'), 'Cormorant Garamond normal 400, Cormorant Garamond normal 600, DM Mono normal 400, DM Mono normal 500, DM Sans normal 400, DM Sans normal 600, DM Sans normal 700, DM Sans normal 800',
     'FONTS: print.css declares exactly the weights the print window loaded from Google');
  const missing = [].concat(...['fonts.css', 'print.css'].map(f => (fs.readFileSync(path.join(dir, 'fonts', f), 'utf8').match(/url\('([^']+)'\)/g) || []).map(u => u.slice(5, -2))))
    .filter(u => !fs.existsSync(path.join(dir, 'fonts', u)));
  ok(missing.length === 0, 'FONTS: every font file the stylesheets name is in fonts/' + (missing.length ? ' (missing ' + missing.join(', ') + ')' : ''));
  const pd = String(G.printDocument);
  ok(/new URL\('fonts\/print\.css', document\.baseURI \|\| location\.href\)/.test(pd), 'FONTS: printDocument links the absolute address of fonts/print.css');
})();

/* ── PASSWORDS END TO END (Part 5.8, 2 Oct 2026): the screens and requests, answered by the dev stand-in ── */
async function passwordsEndToEnd(){
  const $ = (id) => G.document.getElementById(id);
  const tick = () => new Promise(r => setImmediate(r));
  const settle = async (cond, label) => { for (let i = 0; i < 400; i++) { if (cond()) return true; await tick(); await new Promise(r => setTimeout(r, 5)); } ok(false, 'settle: ' + label); return false; };
  const type = (id, v) => { $(id).value = v; };
  const _confirm = G.confirm; G.confirm = () => true;
  const keep = {org: G.currentOrgId, user: G.currentUserId, admin: G.isAppAdmin};
  const sOut = () => { G.currentUserId = null; G.isAppAdmin = false; G.UI.entry = {step:'login'}; G.Auth.signOut(); };
  await new Promise(r => setTimeout(r, 30));   // the start-up session check from LOAD answers first

  /* 5.12: the administrator's default account works once */
  G.UI.entry = {step:'admin-login'}; G.render();
  type('adminUser', 'admin'); type('adminPassword', 'NextChapter2026!'); G.doAdminLogin();
  eq($('adminPassword').value, '', '5.2.4: the typed password is cleared from its field once sent');
  await settle(() => G.UI.entry && G.UI.entry.step === 'choose-password', 'admin choose');
  eq(G.UI.entry.sub, 'This password works only once. Choose your own to continue.', '5.12.2: admin / NextChapter2026! opens Choose a new password (A.5.23)');
  ok(!G.isAppAdmin, '5.12.2: nothing else opens before the new password');
  type('newPassword', 'Admin#Chosen2026'); type('confirmPassword', 'Admin#Chosen2026'); G.doChoosePassword();
  await settle(() => G.isAppAdmin === true, 'admin in');
  ok(G.isAppAdmin, '5.12: after choosing, the administrator is in');
  G.exitAdmin(); await new Promise(r => setTimeout(r, 30));
  G.UI.entry = {step:'admin-login'}; G.render();
  type('adminUser', 'admin'); type('adminPassword', 'NextChapter2026!'); G.doAdminLogin();
  await settle(() => !!G.UI.entry.err, 'default refused');
  eq(G.UI.entry.err, 'That username and password do not match.', '5.12.4: after a new password is chosen, NextChapter2026! is refused (A.5.28)');
  type('adminUser', 'ADMIN '); type('adminPassword', 'Admin#Chosen2026'); G.doAdminLogin();
  await settle(() => G.isAppAdmin === true, 'admin again');
  ok(G.isAppAdmin, '5.12: the chosen password works (username capitals and spaces ignored)');

  /* 5.8.1: create an organization with a first person and a temporary password (the app administrator) */
  G.openAdmin(); G.adminAddOrg();
  type('ano_org', 'Password Org'); type('ano_name', 'Pia First'); type('ano_user', 'pia'); type('ano_temp', 'abc');
  G.adminSaveNewOrg();
  eq(G.UI.adminNewOrg && G.UI.adminNewOrg.err, 'Use at least 8 characters.', '5.7.4: the first person\'s temporary password must pass the rule');
  type('ano_org', 'Password Org'); type('ano_name', 'Pia First'); type('ano_user', 'pia'); type('ano_temp', 'Temp#Pass2026');
  G.adminSaveNewOrg();
  await settle(() => !G.UI.adminNewOrg, 'org created');
  const PO = G.getOrgs().filter(o => o.name === 'Password Org')[0];
  ok(!!PO, '5.7.4: the organization is created');
  const credStore = () => JSON.parse(G.localStorage.getItem('er-devauth::credentials') || '{}');
  const piaId = G.getOrgData(PO.id).roster[0].id;
  ok(!!credStore()[PO.id + '/' + piaId] && credStore()[PO.id + '/' + piaId].mustChange === true, '5.7.4 / 6.1.6: the temporary password is stored on the server side, marked mustChange');
  G.closeModal(); G.signOut(); await new Promise(r => setTimeout(r, 30));

  G.UI.entry = {step:'login'}; G.render();
  type('loginUser', 'pia'); type('loginPassword', 'Temp#Pass2026'); G.doLogin();
  await settle(() => G.UI.entry && G.UI.entry.step === 'choose-password', 'pia choose');
  eq(G.UI.entry.sub, 'Your administrator set a temporary password. Choose your own to continue.', '5.8.1: the temporary password opens Choose a new password (A.5.5a)');
  ok(!G.currentUserId, '5.5: the workspace does not open');
  const tryChoose = async (p1, p2) => { type('newPassword', p1); type('confirmPassword', p2); G.UI.entry.err = ''; G.doChoosePassword(); await settle(() => !G.UI.entry || !!G.UI.entry.err || G.UI.entry.step !== 'choose-password', 'choose'); return G.UI.entry ? G.UI.entry.err : ''; };
  eq(await tryChoose('abc1!', 'abc1!'), 'Use at least 8 characters.', '5.8.1: abc1! -> Use at least 8 characters.');
  eq(await tryChoose('abcdefgh', 'abcdefgh'), 'Include at least one number.', '5.8.1: abcdefgh -> Include at least one number.');
  eq(await tryChoose('abcdefg1', 'abcdefg1'), 'Include at least one special character, such as ! or #.', '5.8.1: abcdefg1 -> special character');
  eq(await tryChoose('Password1!', 'Password1!'), 'That password is too common. Choose another.', '5.8.1: Password1! -> too common');
  eq(await tryChoose('Good#Pass2026a', 'Good#Pass2026b'), 'The two passwords do not match.', '5.8.1: two different good passwords -> do not match');
  eq(await tryChoose('Temp#Pass2026', 'Temp#Pass2026'), 'Choose a password different from your current one.', '5.8.1: the temporary password again -> different from your current one');
  await tryChoose('Pia#Own2026pass', 'Pia#Own2026pass');
  ok(G.currentUserId === piaId && G.currentOrgId === PO.id && !G.UI.entry, '5.8.1: a good password twice -> the workspace opens');

  /* 5.8.2: sign out and in with the new password */
  G.signOut(); await new Promise(r => setTimeout(r, 30));
  type('loginUser', 'pia'); type('loginPassword', 'Pia#Own2026pass'); G.doLogin();
  await settle(() => !!G.currentUserId, 'pia in');
  ok(G.currentUserId === piaId && !G.UI.entry, '5.8.2: the new password opens the workspace directly');

  /* 5.8.3: reload while signed in -> the workspace reopens; sign out and reload -> the sign-in screen */
  const reload = async () => { G._bootDone = false; G.currentUserId = null; G.currentOrgId = null; G.UI.entry = null; G.bootApp(); await settle(() => G.UI.entry === null || (G.UI.entry && G.UI.entry.step === 'login'), 'reload'); };
  const sealed0 = G.sealSession; let seals = 0; G.sealSession = function(){ seals++; return sealed0.apply(this, arguments); };
  await reload();
  ok(G.currentUserId === piaId && G.currentOrgId === PO.id && !G.UI.entry, '5.8.3: reload while signed in: the workspace reopens');
  eq(seals, 0, '5.4.5 / S.4: the start-up session check does not seal');
  G.sealSession = sealed0;
  G.signOut(); await new Promise(r => setTimeout(r, 30));
  await reload();
  ok(!G.currentUserId && G.UI.entry && G.UI.entry.step === 'login', '5.8.3: sign out and reload: the sign-in screen');

  /* 5.8.5: Change password from the More menu */
  type('loginUser', 'pia'); type('loginPassword', 'Pia#Own2026pass'); G.doLogin();
  await settle(() => !!G.currentUserId, 'pia in 2');
  G.UI.navMore = true; G.render();
  has($('navRight').innerHTML, 'onclick="closeNavMore();openChangePassword()"><span class="nav-more-ic">&#9679;</span> Change password</button>', '5.6: Change password is in the More menu (A.5.11)');
  G.UI.navMore = false; G.render();
  G.openChangePassword();
  has($('modalRoot').innerHTML, 'autocomplete="current-password"', '5.6: the dialog asks for the current password');
  has($('modalRoot').innerHTML, '<div class="pw-rule">At least 8 characters, including a number and a special character such as ! or #.</div>', '5.1: the rule line under the new password (A.5.18)');
  type('pwCurrent', 'Wrong#Pass2026'); type('pwNew', 'Pia#Second2026'); type('pwConfirm', 'Pia#Second2026'); G.doChangePassword();
  await settle(() => !!G.UI.pwDialog.err, 'bad current');
  eq(G.UI.pwDialog.err, 'Your current password is not correct.', '5.8.5: a wrong current password is refused (A.5.15)');
  type('pwCurrent', 'Pia#Own2026pass'); type('pwNew', 'Pia#Second2026'); type('pwConfirm', 'Pia#Second2026'); G.UI.pwDialog.err = ''; G.doChangePassword();
  await settle(() => !!G.UI.pwDialog.done || !!G.UI.pwDialog.err, 'changed');
  eq(G.UI.pwDialog.done, 'Your password has been changed.', '5.8.5: a good change works (A.5.16)');
  ok($('pwCurrent').value === '' && $('pwNew').value === '', '5.2.4: the fields are cleared');
  G.closeModal(); G.signOut(); await new Promise(r => setTimeout(r, 30));
  type('loginUser', 'pia'); type('loginPassword', 'Pia#Own2026pass'); G.doLogin();
  await settle(() => !!G.UI.entry.err, 'old refused');
  eq(G.UI.entry.err, 'That username and password do not match.', '5.8.5: the old password no longer works');
  type('loginUser', 'pia'); type('loginPassword', 'Pia#Second2026'); G.doLogin();
  await settle(() => !!G.currentUserId, 'pia new');
  ok(G.currentUserId === piaId, '5.8.5: the next sign-in needs the new one');

  /* 5.10 / 5.8.7 / 5.11: as the organization's administrator, add a member — the temporary password is required, the username unique */
  G.openOrg(); G.addProfile();
  ok(!G.data.roster.some(u => u.id === 'new'), '5.8.7: an added member is a draft until saved (nothing stored without a password)');
  type('ru_new_name', 'Mo Member'); type('ru_new_username', 'mo'); G.saveProfile('new');
  eq(G.UI.orgErr, 'Use at least 8 characters.', '5.8.7: adding a member without a temporary password is refused');
  ok(!G.USERS.some(u => u.username === 'mo'), '5.8.7: and nobody is added');
  type('ru_new_name', 'Mo Member'); type('ru_new_username', ' PIA '); type('ru_new_temporary', 'Temp#Mo2026x'); G.saveProfile('new');
  eq(G.UI.orgErr, 'That username is already taken. Choose another.', '5.11.2: a username already in use is refused, capitals and spaces ignored (A.5.22)');
  has($('modalRoot').innerHTML, 'value="Mo Member"', '5.7: the typed values stay in the editor after a refusal');
  type('ru_new_name', 'Mo Member'); type('ru_new_username', 'mo'); type('ru_new_temporary', 'Temp#Mo2026x'); G.saveProfile('new');
  await settle(() => G.UI.orgEdit === null, 'mo added');
  const mo = G.USERS.filter(u => u.username === 'mo')[0];
  ok(!!mo && !!credStore()[PO.id + '/' + mo.id], '5.7.2: the member is saved and their temporary password sent');
  G.editProfile(mo.id);
  has($('modalRoot').innerHTML, '>Temporary password</label>', '5.7.1: the field is called Temporary password');
  has($('modalRoot').innerHTML, '<div class="pw-note">The person will be asked to choose their own password the next time they sign in.</div>', '5.7.1: with A.5.17 beneath it');
  type('ru_' + mo.id + '_name', 'Mo Member'); type('ru_' + mo.id + '_username', 'mo'); G.saveProfile(mo.id);
  ok(!!credStore()[PO.id + '/' + mo.id] && credStore()[PO.id + '/' + mo.id].mustChange === true, '5.7.3: editing with the field empty keeps their password');
  G.closeModal();

  /* 5.8.6: the temporary password forces the member to choose; 5.8.4: five wrong passwords lock the username */
  G.signOut(); await new Promise(r => setTimeout(r, 30));
  type('loginUser', 'mo'); type('loginPassword', 'Temp#Mo2026x'); G.doLogin();
  await settle(() => G.UI.entry && G.UI.entry.step === 'choose-password', 'mo choose');
  ok(G.UI.entry.step === 'choose-password', '5.8.6: a temporary password set by an administrator forces the person to choose their own');
  G.leaveChoosePassword(); await new Promise(r => setTimeout(r, 30));
  for (let i = 1; i <= 5; i++) {
    type('loginUser', 'mo'); type('loginPassword', 'Wrong#' + i + 'xxxx'); G.UI.entry.err = ''; G.doLogin();
    await settle(() => !!G.UI.entry.err, 'wrong ' + i);
    if (i < 5) eq(G.UI.entry.err, 'That username and password do not match.', '5.8.4: wrong password ' + i + ' -> A.5.3');
  }
  eq(G.UI.entry.err, 'Too many attempts. Try again in 15 minutes.', '5.8.4: the fifth refusal shows A.5.4');
  type('loginUser', 'mo'); type('loginPassword', 'Temp#Mo2026x'); G.UI.entry.err = ''; G.doLogin();
  await settle(() => !!G.UI.entry.err, 'locked right');
  eq(G.UI.entry.err, 'Too many attempts. Try again in 15 minutes.', '5.8.4: the right password is refused while locked');
  G.localStorage.removeItem('er-devauth::attempts');

  /* 5.10.1 / 5.8 (5.10.3): an ordinary member — no add, edit-other or delete, and calling them changes nothing */
  type('loginUser', 'mo'); type('loginPassword', 'Temp#Mo2026x'); G.UI.entry.err = ''; G.doLogin();
  await settle(() => G.UI.entry && G.UI.entry.step === 'choose-password', 'mo choose 2');
  type('newPassword', 'Mo#Own2026pass'); type('confirmPassword', 'Mo#Own2026pass'); G.doChoosePassword();
  await settle(() => !!G.currentUserId, 'mo in');
  G.openOrg();
  const mh = $('modalRoot').innerHTML;
  ok(mh.indexOf('addProfile()') < 0, '5.10.3: no + Add team member for an ordinary member');
  ok(mh.indexOf("editProfile('" + piaId + "')") < 0 && mh.indexOf("removeProfile('" + piaId + "')") < 0, '5.10.3: no edit or delete on someone else\'s row');
  ok(mh.indexOf("editProfile('" + mo.id + "')") > 0, '5.10.2: they can still edit their own profile');
  ok(mh.indexOf('ai-fold') < 0, '5.10: and no AI features fold');
  const roster0 = JSON.stringify(G.data.roster);
  G.addProfile(); G.editProfile(piaId); G.saveProfile(piaId); G.removeProfile(piaId);
  eq(JSON.stringify(G.data.roster), roster0, '5.10.3: calling add, edit-other and delete in the console changes nothing');
  let tp; G.Auth.setTemporaryPassword(PO.id, piaId, 'Hijack#2026xx', r => { tp = r; });
  await settle(() => !!tp, 'not-admin');
  eq(tp.reason, 'not-admin', '6.1.13: the server refuses a temporary password set by an ordinary member');
  G.editProfile(mo.id);
  ok($('modalRoot').innerHTML.indexOf('_temporary"') < 0, '5.10.2: no temporary-password field on one\'s own profile (their password: Change password)');
  G.closeModal();

  /* 5.8.9: no password, hash or passcode in the organization's data, the browser's storage of it, or an export */
  const blob = G.Store.orgRaw(PO.id);
  ok(!/passcode|passwordHash|mustChange|Pia#|Temp#|Mo#|pbkdf2/.test(blob), '5.8.9: the organization\'s data holds no password, hash or passcode');
  const orgKeys = Object.keys(Object.fromEntries([...Array(G.localStorage.length).keys()].map(i => [G.localStorage.key(i), 1]))).filter(k => /^exec-readiness-/.test(k));
  ok(orgKeys.every(k => !/Pia#|Temp#|Mo#|NextChapter2026|"hash"/.test(G.localStorage.getItem(k) || '')), '5.8.9: nothing the app stores holds a password or hash');
  ok(!/passcode|Pia#|Temp#/.test(JSON.stringify(G.data)), '5.8.9: the data an export or a printout is made from holds none');

  /* RESET-SIGNIN / DELETE-SIGNIN (4.4): sign-ins follow the people list */
  G.signOut(); await new Promise(r => setTimeout(r, 30));
  G.isAppAdmin = true; G.adminResetOrg(PO.id); G.isAppAdmin = false; G.closeModal();
  type('loginUser', 'mo'); type('loginPassword', 'Mo#Own2026pass'); G.UI.entry = {step:'login'}; G.doLogin();
  await settle(() => !!G.UI.entry.err, 'mo after reset');
  eq(G.UI.entry.err, 'That username and password do not match.', 'RESET-SIGNIN 4.4.1: a removed member cannot sign in');
  ok(!credStore()[PO.id + '/' + mo.id], 'RESET-SIGNIN 4.2.4: their sign-in is deleted');
  type('loginUser', 'pia'); type('loginPassword', 'Pia#Second2026'); G.UI.entry.err = ''; G.doLogin();
  await settle(() => !!G.currentUserId, 'pia after reset');
  ok(G.currentUserId === piaId, 'RESET-SIGNIN 4.4.1: the administrator can still sign in, with the same password');
  G.signOut(); await new Promise(r => setTimeout(r, 30));
  G.isAppAdmin = true; G.deleteOrgById(PO.id); G.isAppAdmin = false;
  type('loginUser', 'pia'); type('loginPassword', 'Pia#Second2026'); G.UI.entry = {step:'login'}; G.doLogin();
  await settle(() => !!G.UI.entry.err, 'pia after delete');
  eq(G.UI.entry.err, 'That username and password do not match.', 'DELETE-SIGNIN 4.4.2: after a deletion its people cannot sign in');
  ok(!Object.keys(credStore()).some(k => k.indexOf(PO.id + '/') === 0), 'DELETE-SIGNIN 6.4.3: nothing remains for its id in the sign-in store');

  /* 5.9: the setup code */
  const n0 = G.getOrgs().length;
  G.UI.entry = {step:'setup'}; G.render();
  type('setupCode', 'WRONG'); type('setupOrg', 'Setup Org'); type('setupName', 'Sam Setup'); type('setupUser', 'sam'); type('setupPassword', 'Sam#Own2026pass'); type('setupConfirm', 'Sam#Own2026pass');
  G.doSetup();
  eq(G.UI.entry.err, 'That setup code is not recognized.', '5.9.3: WRONG -> A.5.21');
  eq(G.getOrgs().length, n0, '5.9.3: and no organization is added');
  let sc; G.Auth.setupOrganization('WRONG', 'org_x', 'u_x', 'sam', 'Sam#Own2026pass', false, r => { sc = r; });
  await settle(() => !!sc, 'server code');
  eq(sc.reason, 'bad-code', '6.1.12: the server refuses a wrong setup code whatever the browser checked');
  type('setupCode', 'ABCXYZ'); type('setupOrg', 'Setup Org'); type('setupName', 'Sam Setup'); type('setupUser', 'sam'); type('setupPassword', 'Sam#Own2026pass'); type('setupConfirm', 'Sam#Own2026pass');
  G.doSetup();
  await settle(() => G.getOrgs().length === n0 + 1, 'setup org');
  const SO = G.getOrgs().filter(o => o.name === 'Setup Org')[0];
  ok(!!SO && G.currentOrgId === SO.id && G.getCurrentUser() && G.getCurrentUser().admin === true, '5.9.3: ABCXYZ creates it, its first person as administrator');
  ok(credStore()[SO.id + '/' + G.currentUserId] && credStore()[SO.id + '/' + G.currentUserId].mustChange === false, '5.7.4: the password chosen at setup is their own, not temporary');
  G.closeModal(); G.orgSetupMode = false;
  G.signOut(); await new Promise(r => setTimeout(r, 30));
  G.UI.entry = {step:'setup'}; G.render();
  type('setupCode', 'ABCXYZ'); type('setupOrg', 'Dup Org'); type('setupName', 'Sam Two'); type('setupUser', 'SAM'); type('setupPassword', 'Sam#Own2026pass'); type('setupConfirm', 'Sam#Own2026pass');
  G.doSetup();
  eq(G.UI.entry.err, 'That username is already taken. Choose another.', '5.11.4: setting up an organization whose first person is SAM (sam exists) is refused');
  G.deleteOrgById(SO.id);

  /* back to the harness's own state */
  G.confirm = _confirm; G.Auth.signOut();
  G.UI.entry = null; G.switchToOrg(keep.org); G.currentUserId = keep.user; G.isAppAdmin = keep.admin; G.render();
}
/* ── REPORT ─────────────────────────────────────────── */
passwordsEndToEnd().catch(e => { fail++; failures.push('PASSWORDS END TO END threw: ' + (e && e.stack || e)); }).then(function(){
console.log('Behavioral harness (Executive Readiness, §18.9 Stages 1–2) — ' + (pass+fail) + ' assertions');
console.log('  PASS: ' + pass);
console.log('  FAIL: ' + fail);
if (alerts.length) console.log('  (app alert() calls captured: ' + alerts.length + ')');
if (fail) {
  console.log('\nFailing assertions:');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exitCode = 1;
} else {
  console.log('  ✓ all green');
}
console.log('──────────────────────────────────────────');
});
