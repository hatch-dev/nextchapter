#!/usr/bin/env node
/* ── CANONICAL CLOCK ────────────────────────────────────────────
   seedData() anchors the sample org at (today − 70 days). The capital
   ledger identities in this harness were hand-derived (July 6–7, 2026)
   under a late-April anchor; whenever (today − 70) crosses a month
   boundary the month-anchored window math shifts and ~25 identity pins
   go stale — first observed July 10, 2026 (anchor Apr 30 → May 1).
   Fix: both realms (harness + app sandbox) run on a clock frozen at
   2026-07-07 12:00, the re-derivation date (seed anchor Apr 28). Pins
   constructed with explicit date arguments are unaffected; zero-arg
   `new Date()` and `Date.now()` return the canonical instant. The
   identities themselves are untouched. */
const __RealDate = Date;
const __CANON = new __RealDate(2026, 6, 7, 12, 0, 0).getTime();
const __FrozenDate = class extends __RealDate {
  constructor(...a) { a.length === 0 ? super(__CANON) : super(...a); }
  static now() { return __CANON; }
};
Date = __FrozenDate; // eslint-disable-line no-global-assign
/* ─────────────────────────────────────────────────────────────
   harness.js — behavioral harness for the AI Innovation Pipeline
   Rebuilt in the new environment per Handoff Briefing §5.

   Pattern (as specified): load app.js into a Node `vm` context with
   Proxy-element DOM stubs, a permissive document.getElementById,
   stubbed confirm/alert/addEventListener, an in-memory localStorage,
   then bootstrap an org and call seedData()/emptyData() and assert on
   rendered HTML strings and on `data` mutations.

   Grows with every change. A failing assertion is investigated in
   BOTH directions — the app may be wrong, or the assertion may be.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, 'app.js');
const code = fs.readFileSync(APP, 'utf8');

/* ── assertion plumbing ─────────────────────────────────────── */
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

/* ── DOM / browser stubs ────────────────────────────────────── */
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
    set(o, k, v) { o[k] = v; return true; }
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
noThrow(() => vm.runInContext(fs.readFileSync(path.join(__dirname, 'dev-auth-server.js'), 'utf8'), sandbox, { filename:'dev-auth-server.js' }),
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

/* ── SEED INTEGRITY (verifiable against Briefing §3) ────────── */
eq((d.ideas||[]).length, 20, 'SEED: 20 ideas');
eq((d.ideas||[]).filter(x=>x && x.when==='future').length, 6, 'SEED: 6 ideas marked future');
eq(d.selected, [0,1,2,3,4,11,12,13,14,15,16,17], 'SEED: selected = [0,1,2,3,4,11..17]');
eq(d.expSelected, [0,1,4,11,12,13], 'SEED: expSelected = [0,1,4,11,12,13] (launched stay in expSelected)');
eq(d.launched, [0,1,4], 'SEED: launched = [0,1,4]');
ok(d.projects && d.projects[3] && d.projects[3].viable === false, 'SEED: project 3 is No-Go (viable===false)');
ok(!(d.projects[3] && d.projects[3].objectives), 'SEED: No-Go project 3 has no Go objectives');
ok(d.projects[16] && d.projects[16].viable !== true && d.projects[16].viable !== false,
   'SEED: project 16 awaiting verdict (no viable flag)');
// project 17 is selected + has a triage assessment but no deep projects[] record yet →
// awaiting the 2.4 verdict (this is what "awaiting verdict" means in the app: _res24 is false)
(function(){
  const pr17 = (d.projects||{})[17] || {};
  const res17 = pr17.viable === true ? !!pr17.objectives : pr17.viable === false ? !!pr17.noGoReason : false;
  ok((d.selected||[]).indexOf(17) >= 0, 'SEED: project 17 is selected');
  ok(res17 === false, 'SEED: project 17 awaiting verdict (no completed Go/No-Go)');
  ok((d.assessments||{})[17] && (d.assessments[17].priority != null),
     'SEED: project 17 has a triage assessment');
})();
ok(!(d.projects[16] && (Number(G.costNum(d.projects[16].startupCost))||Number(G.costNum(d.projects[16].runningCost)))),
   'SEED: project 16 deliberately costless');
ok(G.costNum(d.capital && d.capital.aiBudget) === 2400000,
   'SEED: aiBudget parses to $3.5M  (raw ' + JSON.stringify(d.capital && d.capital.aiBudget) + ')');

/* ── FISCAL: FY start month (Ruling 5) ──────────────────────── */
const fym = noThrow(() => G.periodStartMonth(), 'FISCAL: periodStartMonth() callable');
eq(fym, new Date(Date.parse(G.data.capital.periodStart)).getMonth() + 1, 'FISCAL: quarters count from the period start month (Ruling 5 subsumption)');
noThrow(() => G.nextReviewInfo(), 'FISCAL: nextReviewInfo() callable without throwing');
noThrow(() => G.thisQuarterConsumption(), 'FISCAL: thisQuarterConsumption() callable without throwing');

/* ── STAGE MODEL (derived, never stored — §6) ───────────────── */
let stages;
noThrow(() => { stages = G.getStages(); }, 'STAGES: getStages() callable');
ok(stages && typeof stages === 'object', 'STAGES: returns an object');
if (stages) {
  // operational == launched (minus archived); seed has no archived launched
  eq((stages.operational||[]).slice().sort((a,b)=>a-b), [0,1,4], 'STAGES: operational = launched [0,1,4]');
  // experiment == expSelected minus operational minus archived → [11,12,13]
  eq((stages.experiment||[]).slice().sort((a,b)=>a-b), [11,12,13], 'STAGES: experiment (Development) = [11,12,13]');
  ok((stages.noGo||[]).indexOf(3) >= 0, 'STAGES: noGo contains project 3');
  // Blue Sky Now-only: future ideas must not appear in the Now stage (Ruling 10)
  const bsHasFuture = (stages.bluesky||[]).some(i => d.ideas[i] && d.ideas[i].when === 'future');
  // bluesky may include future as a separate fold; the canonical Now subset is bsNowList()
  if (typeof G.bsNowList === 'function') {
    const now = noThrow(() => G.bsNowList(stages), 'STAGES: bsNowList(stages) callable') || [];
    ok(now.every(i => !(d.ideas[i] && d.ideas[i].when === 'future')),
       'STAGES: bsNowList(stages) excludes Future ideas (Now-only canonical)');
  } else {
    ok(true, 'STAGES: bsNowList absent — skipped Now-only check');
  }
}

/* ── SCORING PRECEDENCE: rescore3Done → rescoreDone → triage ── */
noThrow(() => G.getScore(0), 'SCORE: getScore() callable');
(function(){
  // pick a project with a triage assessment; verify precedence by injection
  const i = 11;
  const p = d.projects[i] = d.projects[i] || {};
  const savedRescore = p.rescore, savedR3 = p.rescore3, savedRD = p.rescoreDone, savedR3D = p.rescore3Done;
  // baseline: triage
  p.rescore = null; p.rescore3 = null; p.rescoreDone = false; p.rescore3Done = false;
  const base = G.getScore(i);
  // deepened confirmed → rescore wins (sum = 25)
  p.rescore = {priority:5,risk:5,value:5,costScore:5,difficulty:5}; p.rescoreDone = true;
  const dep = G.getScore(i);
  // post-experiment confirmed → rescore3 wins over rescore (sum = 5)
  p.rescore3 = {priority:1,risk:1,value:1,costScore:1,difficulty:1}; p.rescore3Done = true;
  const post = G.getScore(i);
  eq(dep, 25, 'SCORE: rescoreDone measurement (all 5s) sums to 25');
  eq(post, 5, 'SCORE: rescore3Done measurement (all 1s) sums to 5 — takes precedence over rescore');
  ok(typeof base === 'number', 'SCORE: falls back to triage (a number) when no rescore');
  // restore
  p.rescore = savedRescore; p.rescore3 = savedR3; p.rescoreDone = savedRD; p.rescore3Done = savedR3D;
})();

/* ── CAPITAL ENGINE: derived, no ledger (Rulings 1,3,4,7) ───── */
let com0, av0;
noThrow(() => { com0 = G.capCommitments(); }, 'CAPITAL: capCommitments() callable');
noThrow(() => { av0 = G.capAvailable(); }, 'CAPITAL: capAvailable() callable');
ok(com0 && typeof com0.total === 'number' && com0.total >= 0, 'CAPITAL: commitments.total is a non-negative number');
ok(av0 && typeof av0.available === 'number', 'CAPITAL: available.available is a number');
// available === budget − committed − killPot (Ruling: available = budget − committed − pot)
ok(av0 && Math.abs(av0.available - (av0.budget - av0.committed - av0.killPot)) < 1,
   'CAPITAL: available === budget − committed − killPot  (' + JSON.stringify(av0 && {a:av0.available,b:av0.budget,c:av0.committed,p:av0.killPot}) + ')');
ok(av0 && Math.abs(av0.committed - com0.total) < 1, 'CAPITAL: available.committed matches capCommitments().total (single source)');
eq(com0.total, 3246249, 'CAPITAL: seed ledger under the SINGLE MODEL (Paul, July 6; re-derived July 7 for the 1/4/13 reshape: 2,816,249 + 430,000 \u2013 each item gained twelve in-window sustainment months at 180K/110K/140K per year) = every live plan in-window, dev+roll+sus over 36 months; re-derived from 1,975,000 under the retired staged event ledger; offsets still retired whole per July 4 ruling');
// Kill pot deducts from Available (Ruling 3 / kill pot)
(function(){
  const saved = d.capital.killCosts;
  d.capital.killCosts = '$100K';
  const a2 = G.capAvailable();
  ok(Math.abs((av0.available - a2.available) - 100000) < 1, 'CAPITAL: a $100K kill pot lowers available by exactly 100k');
  d.capital.killCosts = saved;
  ok(Math.abs(G.capAvailable().available - av0.available) < 1, 'CAPITAL: restoring the pot restores available (no ledger drift)');
})();
// Killing an Operational item releases its commitment immediately (Sell = kill, Ruling 3)
(function(){
  const i = 4; // operational (launched)
  const before = G.capCommitments().total;
  if (!d.tracking) d.tracking = {};
  const savedTrk = d.tracking[i] ? JSON.parse(JSON.stringify(d.tracking[i])) : undefined;
  d.tracking[i] = d.tracking[i] || {};
  d.tracking[i].status = 'killed';           // the derived engine releases on this flag
  const after = G.capCommitments().total;
  ok(after <= before, 'CAPITAL: killing operational item 4 does not increase commitments');
  ok(after < before || G.projCosts(i).run + G.projCosts(i).start === 0,
     'CAPITAL: killing operational item 4 releases its commitment (or it was costless)');
  if (savedTrk) d.tracking[i] = savedTrk; else delete d.tracking[i];
  ok(Math.abs(G.capCommitments().total - before) < 1,
     'CAPITAL: un-killing restores commitments exactly (derived, reversible)');
})();

/* ── FORCING FUNCTION / NO BYPASS (Ruling 2) ────────────────── */
noThrow(() => G.progContracted(11), 'FORCING: progContracted() callable (gatesDefined retired, P4 July 5)');
(function(){
  // A project with no gate rows must report gates NOT defined.
  const i = 17; // awaiting verdict, no gates
  ok(G.progContracted(i) === false, 'FORCING: project 17 has no funded, contracted program \u2192 not contracted');
  // advanceWithGates on an unqualified project must not silently push it into Development
  const expBefore = (G.data.expSelected||[]).slice();
  noThrow(() => G.advanceWithGates(17), 'FORCING: advanceWithGates(17) on unqualified project does not throw');
  const expAfter = (G.data.expSelected||[]);
  ok(expAfter.indexOf(17) < 0, 'FORCING: unqualified project 17 was NOT advanced (no bypass)');
  eq(expAfter.slice().sort((a,b)=>a-b), expBefore.slice().sort((a,b)=>a-b),
     'FORCING: expSelected unchanged by a refused advance');
})();

/* ── RENDER STRINGS: renderers return HTML and never throw ──── */
const RENDER_FNS = [
  'renderPipeline','renderStep13','renderStep24','renderStep31','renderStepCap','renderStepAlloc','renderStepExp',
  'renderStep43','renderStep44','renderCapHub','renderNavDash','renderOutBluesky',
  'renderOutCapplan','renderOutExploreEnhanced','renderOutOperFull','renderOutReport','renderInsights'
];
RENDER_FNS.forEach(fn => {
  if (typeof G[fn] === 'function') {
    const out = noThrow(() => G[fn](), 'RENDER: ' + fn + '() runs');
    nonEmptyStr(out, 'RENDER: ' + fn + '() returns non-empty HTML');
  } else {
    ok(false, 'RENDER: ' + fn + ' is defined');
  }
});
// Capital Snapshot naming (Ruling 13: Capital Plan → Capital Snapshot)
(function(){
  const snap = (typeof G.renderOutCapplan === 'function') ? G.renderOutCapplan() : '';
  has(snap, 'Snapshot', 'RENDER: Capital Snapshot page carries "Snapshot" framing (Ruling 13)');
})();
// 4.4 shows both the next-period picture and the annual envelope (two-number rule)
(function(){
  const r44 = (typeof G.renderStep44 === 'function') ? G.renderStep44() : '';
  const twoNumbers = /NEXT PERIOD/i.test(r44) && /ANNUAL ENVELOPE/i.test(r44);
  ok(twoNumbers, 'RENDER: 4.4 shows NEXT PERIOD + ANNUAL ENVELOPE (forward-looking two-number rule)');
})();

/* ── EMPTY STATE: emptyData() is a clean slate ──────────────── */
(function(){
  const e = G.emptyData();
  eq((e.ideas||[]).length, 0, 'EMPTY: emptyData() has no ideas');
  eq((e.selected||[]).length, 0, 'EMPTY: emptyData() has no selections');
  eq((e.launched||[]).length, 0, 'EMPTY: emptyData() has nothing launched');
})();

/* ── VISUAL-PASS BATCH (July 2, new account) ─────────────────── */
// Module overview: strip now has 4 tiles, no Culture Score, with a start-date line
(function(){
  const strip = (typeof G.vizStatStrip === 'function') ? G.vizStatStrip() : '';
  const tiles = (strip.match(/viz-stat-cell/g) || []).length;
  eq(tiles, 4, 'OVERVIEW: stat strip renders exactly 4 tiles (Culture Score removed)');
  ok(strip.indexOf('Culture Score') < 0, 'OVERVIEW: Culture Score tile is gone from the strip');
  has(strip, 'Steps Complete', 'OVERVIEW: Steps Complete tile still present');
  has(strip, 'Module start date', 'OVERVIEW: "Module start date" line present above the tiles');
  // the date shown is derived from data.startDate (seed sets a specific day)
  ok(/Module start date/.test(strip) && /\b20\d\d\b/.test(strip),
     'OVERVIEW: start-date line shows a formatted year');
})();
// Module overview: Four Pillars box removed
(function(){
  const ov = (typeof G.renderPipelineOverview === 'function') ? G.renderPipelineOverview() : '';
  ok(ov.indexOf('THE FOUR PILLARS') < 0, 'OVERVIEW: Four Pillars box removed');
})();
// Phase 1 landing: Steps Complete /3 (was Sections Done /5)
(function(){
  const p1 = (typeof G.renderPhaseLandingPipe === 'function')
    ? noThrow(() => G.renderPhaseLandingPipe(1), 'PHASE1: renderPhaseLandingPipe(1) runs') : '';
  has(p1, 'Steps Complete', 'PHASE1: stat tile relabeled "Steps Complete"');
  ok(p1.indexOf('Sections Done') < 0, 'PHASE1: "Sections Done" label gone');
  has(p1, '/3', 'PHASE1: steps counted out of 3');
})();
// Step 1.1 seed: knowledge dropdowns use option-string values (so they select)
(function(){
  const k = d.knowledge || {};
  ok(['none','basic','moderate','advanced'].indexOf(k.usage) >= 0,
     'SEED: knowledge.usage is a valid dropdown value (' + JSON.stringify(k.usage) + ')');
  ok(['none','limited','moderate','strong'].indexOf(k.resources) >= 0,
     'SEED: knowledge.resources is a valid dropdown value (' + JSON.stringify(k.resources) + ')');
  ok(['none','informal','some','systematic'].indexOf(k.learning) >= 0,
     'SEED: knowledge.learning is a valid dropdown value (' + JSON.stringify(k.learning) + ')');
  ok(typeof k.awareness === 'number', 'SEED: knowledge.awareness stays numeric (Likert)');
  // and the rendered 1.1 dropdowns actually mark them selected
  const savedSec = G.UI.sec; G.UI.sec = '1.2';
  const s12 = (typeof G.renderStep11 === 'function') ? G.renderStep11() : '';
  has(s12, 'value="moderate" selected', 'SEED: 1.2 usage dropdown shows a selected option');
  G.UI.sec = savedSec;
})();
// Innovation Audit copy updated
(function(){
  const savedSec = G.UI.sec; G.UI.sec = '1.4';
  const s14 = (typeof G.renderStep11 === 'function') ? G.renderStep11() : '';
  has(s14, 'Inventory every AI initiative that existed anywhere in your enterprise on day one',
      'AUDIT: Innovation Audit explanatory text updated');
  ok(s14.indexOf('>Inventory every initiative.<') < 0, 'AUDIT: old terse copy gone');
  G.UI.sec = savedSec;
})();

/* ── VISUAL-PASS BATCH 2 (advance flow, Blue Sky editing, copy) ── */
// Brainstorm lead + example button + Aurora intro
(function(){
  G.UI.showEx.aurora = true;
  const s12 = (typeof G.renderStep12 === 'function') ? noThrow(() => G.renderStep12(), 'B2: renderStep12 runs') : '';
  has(s12, 'How can AI address your friction points or advance your organizational purpose?', 'B2: Brainstorm lead rewritten');
  ok(s12.indexOf('Could AI address your friction points?') < 0, 'B2: old Brainstorm lead gone');
  ok(s12.indexOf('Aurora Example') < 0, 'B2: 1.2 button no longer says "Aurora Example"');
  has(s12, '\u25be Example</button>', 'B2: 1.2 button says "Example" (open state)');
  has(s12, 'Aurora Windows</strong> is a 35-year-old', 'B2: Aurora Windows introduction present in the box');
  has(s12, 'how-to-build-an-ai-innovation-pipeline-that-creates-real-long-term-value', 'B2: intro links the faisalhoque.com background article');
  G.UI.showEx.aurora = false;
  const s24 = (typeof G.renderStep24 === 'function') ? G.renderStep24() : '';
  ok(s24.indexOf('Aurora Example') < 0, 'B2: 2.4 button no longer says "Aurora Example"');
})();
// 1.3: instruction text, button rename, helper sentence
// (the advance button and score bars render only for FEASIBLE ideas — the seed's two
// unselected Now ideas have deliberately blank gates — so qualify idea 18 first)
(function(){
  const i = 18;
  if (!G.data.assessments) G.data.assessments = {};
  const saved = G.data.assessments[i] ? JSON.parse(JSON.stringify(G.data.assessments[i])) : undefined;
  G.data.assessments[i] = Object.assign({}, saved, {techCapable:true,resourcesAvailable:true,culturalFit:true,purposeAligned:true,affordable:true});
  G.UI.expanded['fr13_'+i] = true; // 1.3 cards collapse to bars by default since July 6
  const s13 = (typeof G.renderStep13 === 'function') ? G.renderStep13() : '';
  G.UI.expanded['fr13_'+i] = false;
  has(s13, 'Is this idea compatible with your organization\u2019s current state across the following five dimensions? Click a dimension once for yes and twice for no. A single no disqualifies the idea until the relevant circumstances change.',
      'B2: 1.3 five-dimension instruction present');
  has(s13, 'Advance to Exploration Portfolio', 'B2: 1.3 button renamed (feasible card)');
  has(s13, 'askAdvanceIdea(', 'B2: 1.3 button routes through the confirm flow');
  ok(s13.indexOf('Selecting moves this idea') < 0, 'B2: no helper sentence beside the 1.3 button (popup replaced it)');
  ok(s13.indexOf('onclick="toggleSelect(') < 0, 'B2: no direct toggleSelect buttons remain at 1.3');
  // legend renders once at least one idea is scored or disqualified
  const vs = (typeof G.vizScores === 'function') ? G.vizScores() : '';
  has(vs, 'Qualified', 'B2: score-distribution legend shows Qualified');
  has(vs, 'Disqualified', 'B2: score-distribution legend shows Disqualified');
  ok(vs.indexOf('>Now</span>') < 0 && vs.indexOf('>Future</span>') < 0, 'B2: legend no longer shows Now/Future chips');
  // Blue Sky page shows the renamed button on the same feasible card (button lives in the OPEN card body)
  G.UI.expanded['bs'+i] = true;
  const ob = (typeof G.renderOutBluesky === 'function') ? G.renderOutBluesky() : '';
  has(ob, 'Advance to Exploration Portfolio', 'B2: Blue Sky button renamed (open feasible card)');
  ok(ob.indexOf('onclick="toggleSelect(') < 0, 'B2: Blue Sky button routes through confirm flow');
  ok(ob.indexOf('Selecting moves this idea') < 0, 'B2: no helper sentence beside the Blue Sky button (popup replaced it)');
  G.UI.expanded['bs'+i] = false;
  if (saved) G.data.assessments[i] = saved; else delete G.data.assessments[i];
})();
// toggleGate really is once-for-yes, twice-for-no (the copy must be true)
(function(){
  const i = 18; // an unselected seed idea
  if (!G.data.assessments) G.data.assessments = {};
  const saved = G.data.assessments[i] ? JSON.parse(JSON.stringify(G.data.assessments[i])) : undefined;
  G.data.assessments[i] = {};
  G.toggleGate(i,'techCapable');
  eq(G.data.assessments[i].techCapable, true, 'B2: first click on a dimension = yes');
  G.toggleGate(i,'techCapable');
  eq(G.data.assessments[i].techCapable, false, 'B2: second click = no');
  G.toggleGate(i,'techCapable');
  ok(G.data.assessments[i].techCapable === undefined, 'B2: third click clears');
  if (saved) G.data.assessments[i] = saved; else delete G.data.assessments[i];
})();
// Advance confirm flow: No leaves state untouched, Yes advances
(function(){
  const i = 18;
  const before = (G.data.selected||[]).slice();
  noThrow(() => G.askAdvanceIdea(i), 'B2: askAdvanceIdea callable');
  eq(G.currentModal, 'advance', 'B2: modal state set to advance');
  G.confirmAdvanceIdea(false);
  ok((G.data.selected||[]).indexOf(i) < 0, 'B2: No button does not advance the idea');
  eq(G.currentModal, null, 'B2: modal closed after No');
  G.askAdvanceIdea(i);
  G.confirmAdvanceIdea(true);
  ok((G.data.selected||[]).indexOf(i) >= 0, 'B2: Yes button advances the idea (toggleSelect ran)');
  // restore: pull it back out of selected (test hygiene; freshProjectSlate already cleared downstream)
  G.data.selected = before;
  // future ideas still refuse the flow
  const fut = G.data.ideas.findIndex(x => x && x.when === 'future');
  const selBefore = (G.data.selected||[]).length;
  G.askAdvanceIdea(fut);
  ok(G.currentModal !== 'advance', 'B2: askAdvanceIdea refuses Future ideas (no modal)');
  eq((G.data.selected||[]).length, selBefore, 'B2: Future idea not advanced');
})();
// Blue Sky portfolio: editable form on cards
(function(){
  // open one Now card and the Future fold
  const bsNow = G.bsNowList(G.getStages());
  const iNow = bsNow[0];
  G.UI.expanded['bs'+iNow] = true;
  G.UI.expanded.bsFold = true;
  const iFut = G.data.ideas.findIndex(x => x && x.when === 'future');
  G.UI.expanded['bsf'+iFut] = true;
  const ob = (typeof G.renderOutBluesky === 'function') ? noThrow(() => G.renderOutBluesky(), 'B2: renderOutBluesky runs with cards open') : '';
  has(ob, 'bsic_'+iNow+'_name', 'B2: open Now card shows editable Name field');
  has(ob, 'bsic_'+iNow+'_when', 'B2: open Now card shows editable When select');
  has(ob, 'bsic_'+iFut+'_desc', 'B2: open Future card shows editable Description field');
  G.UI.expanded['bs'+iNow] = false; G.UI.expanded['bsf'+iFut] = false; G.UI.expanded.bsFold = false;
})();
// bsic save branch: writes through to the idea record; when-switch moves the card
(function(){
  const bsNow = G.bsNowList(G.getStages());
  const i = bsNow[0];
  const savedDesc = G.data.ideas[i].desc, savedWhen = G.data.ideas[i].when;
  G.fldSave('bsic_'+i+'_desc', 'Harness edited description');
  eq(G.data.ideas[i].desc, 'Harness edited description', 'B2: bsic field save writes to the idea record');
  G.fldSave('bsic_'+i+'_name', '   ');
  ok(G.data.ideas[i].name && G.data.ideas[i].name.trim().length > 0, 'B2: blank name is ignored (idea keeps its name)');
  G.fldSave('bsic_'+i+'_when', 'future');
  eq(G.data.ideas[i].when, 'future', 'B2: when-switch saves');
  ok(G.UI.expanded['bsf'+i] === true, 'B2: when->future follows the idea into the fold');
  G.fldSave('bsic_'+i+'_when', 'now');
  eq(G.data.ideas[i].when, 'now', 'B2: when-switch back to now saves');
  G.fldSave('bsic_'+i+'_bogusfield', 'x');
  ok(G.data.ideas[i].bogusfield === undefined, 'B2: unknown fields are rejected');
  G.data.ideas[i].desc = savedDesc; G.data.ideas[i].when = savedWhen;
})();
// Assessment report: gap marker is now a double exclamation mark
(function(){
  const rep = (typeof G.renderOutReport === 'function') ? G.renderOutReport() : '';
  ok(rep.indexOf('\u25b3') < 0, 'B2: report no longer uses the triangle gap marker');
  has(rep, '\u203c', 'B2: report uses the double exclamation mark for gaps');
})();

/* ── VISUAL-PASS BATCH 3 (2.1 viz, 2.2 depth, 2.3 attendees, 3.1 fold) ── */
// 2.1: ownership-completeness viz fully removed
(function(){
  const s21 = (typeof G.renderStep21 === 'function') ? noThrow(() => G.renderStep21(), 'B3: renderStep21 runs') : '';
  ok(s21.indexOf('Ownership Completeness') < 0, 'B3: 2.1 no longer shows Ownership Completeness');
  ok(typeof G.vizOwnership === 'undefined', 'B3: vizOwnership function removed');
  ok(typeof G.refreshOwViz === 'undefined', 'B3: refreshOwViz removed');
  noThrow(() => G.fldSave('ow_authority', 'test authority'), 'B3: ow_ field save survives without the viz tail');
  eq(G.data.ownership.authority, 'test authority', 'B3: ownership field still saves');
  G.data.ownership.authority = 'Full budget authority for AI portfolio under $2M per initiative.';
})();
// 2.2: deeper box, two-structure placeholder
(function(){
  const s22 = (typeof G.renderStep22 === 'function') ? G.renderStep22() : '';
  has(s22, 'rows="5"', 'B3: 2.2 current-structure box is 5 rows deep');
  has(s22, 'Sales \u2013 quarterly commission', 'B3: placeholder shows a sales incentive structure');
  has(s22, 'Engineering \u2013 annual bonus', 'B3: placeholder shows a second, different structure');
  ok(s22.indexOf('Measured on delivery KPIs only') < 0, 'B3: old one-line placeholder gone');
})();
// 2.3: attendee list — seed, mechanics, legacy normalization
(function(){
  eq(G.data.rhythm.attendees, ['Shalini Mehta','Vincent Lau','Harriet Rivers'], 'B3: seed attendees are three named people');
  const s23 = (typeof G.renderStep23 === 'function') ? G.renderStep23() : '';
  has(s23, 'rhAtt_0', 'B3: 2.3 renders per-person attendee inputs');
  has(s23, '+ Add attendee', 'B3: 2.3 has an Add attendee button');
  ok(s23.indexOf('id="rh_attendees"') < 0, 'B3: old free-text attendees box gone');
  eq(G.rhAttNames(), ['Shalini Mehta','Vincent Lau','Harriet Rivers'], 'B3: rhAttNames returns the named list');
  G.addAttendee();
  eq(G.rhAttList().length, 4, 'B3: addAttendee appends a blank row');
  ok(G.rhAttNames().length === 3, 'B3: blank rows do not count toward the gate');
  G.removeAttendee(3);
  eq(G.rhAttList().length, 3, 'B3: removeAttendee removes the row');
  // legacy string normalizes without data loss
  const saved = G.data.rhythm.attendees;
  G.data.rhythm.attendees = 'Innovation Council + Phase Owners, CFO';
  eq(G.rhAttNames(), ['Innovation Council','Phase Owners','CFO'], 'B3: legacy string splits into discrete entries');
  G.data.rhythm.attendees = saved;
})();
// Dashboard: Next Innovation Session lists the people
(function(){
  const nd = (typeof G.renderNavDash === 'function') ? noThrow(() => G.renderNavDash(), 'B3: renderNavDash runs') : '';
  has(nd, 'Shalini Mehta, Vincent Lau, Harriet Rivers', 'B3: dashboard session box lists the attendees');
})();
// 3.1: project-card fold, matching the 3.3 pattern
(function(){
  const goP = G.getStages().explore.filter(i => (G.data.projects[i]||{}).viable === true);
  ok(goP.length > 0, 'B3: seed has Go projects at Exploration for 3.1');
  const i = goP[0];
  G.UI.expanded['pc31'+i] = false;
  let s31 = G.renderStep31();
  has(s31, 'Project card</button>', 'B3: 3.1 cards carry the Project card fold button');
  ok(s31.indexOf('Objectives') < 0 || (G.data.projects[i]||{}).objectives === undefined,
     'B3: fold content hidden while collapsed');
  G.UI.expanded['pc31'+i] = true;
  s31 = G.renderStep31();
  has(s31, 'Objectives', 'B3: expanded fold shows the 2.4 project card (Objectives)');
  G.UI.expanded['pc31'+i] = false;
})();

/* ── VISUAL-PASS BATCH 4 (cost echo, checklist, seniors, RACI move) ── */
// Cost echo semantics
(function(){
  eq(typeof G.costEchoTxt, 'undefined', 'B4: the Reads-as echo helper is retired (July 9) \u2013 parseBudget/fmtMoney remain the money readers');
  G.UI.ap = 17; // item 16 now carries a seeded budget plan, so the cost boxes live on 17
  const s24 = (typeof G.renderStep24 === 'function') ? G.renderStep24() : '';
  ok(s24.indexOf('costEcho_') < 0, 'B4: 2.4 cost boxes carry no echo slots (retired July 9)');
  // live write-through preserves the record; restore project 16 to costless
  const before17 = G.data.projects[17] ? G.data.projects[17].startupCost : undefined;
  G.fldSave('expl_17_cS', '$100K');
  eq((G.data.projects[17]||{}).startupCost, '$100K', 'B4: cost field saves through fldSave');
  if (before17 === undefined) delete G.data.projects[17].startupCost; else G.data.projects[17].startupCost = before17;
  ok(!(G.costNum((G.data.projects[17]||{}).startupCost)), 'B4: project 17 restored to costless');
  ok(G.bpHasDev(16), 'B4: item 16 carries a dev plan, so its simple cost field is superseded (write refused by design)');
})();
// Org Readiness checklist
(function(){
  const or_ = (typeof G.renderOutOrgReady === 'function') ? noThrow(() => G.renderOutOrgReady(), 'B4: renderOutOrgReady runs') : '';
  has(or_, 'First deep assessments completed', 'B4: checklist relabeled');
  ok(or_.indexOf('Deep assessment completed<') < 0 && or_.indexOf('>Deep assessment completed') < 0, 'B4: old label gone');
  ok(or_.indexOf('Communication plan in place') < 0, 'B4: communication-plan item removed');
})();
// 2.1: Engaged Senior Leaders + editable RACI in the freed space
(function(){
  eq((G.data.ownership.seniors||[]).map(x=>x.name), ['Imogen Whitfield','Daniel Reyes'], 'B4: seed seniors present');
  const s21 = G.renderStep21();
  has(s21, 'Engaged Senior Leaders', 'B4: 2.1 has the seniors card');
  has(s21, 'senior_0_name', 'B4: senior name inputs render');
  has(s21, 'Imogen Whitfield', 'B4: seed senior shows in the card');
  has(s21, 'raci_0:owner', 'B4: editable RACI matrix lives at 2.1 (identity-keyed cells)');
  has(s21, 'onclick="raciCycle(', 'B4: 2.1 matrix cells are the control themselves, cycling on click (retargeted 17 Sep 2026, Paul\'s ruling: the selects retire for Governance\'s chips)');
  // add/remove mechanics
  G.addSenior();
  eq((G.data.ownership.seniors||[]).length, 3, 'B4: addSenior appends a row');
  G.removeSenior(2);
  eq((G.data.ownership.seniors||[]).length, 2, 'B4: removeSenior removes it');
})();
// RACI roles include seniors, in order, capped, with Finance last
(function(){
  eq(G.raciRoles(), ['Shalini Mehta','Vincent Lau','Harriet Rivers','Imogen Whitfield','Daniel Reyes','Finance'],
     'B4: raciRoles = owner + leads + seniors + Finance');
})();
// Output page: static, printable, no editors; dead stub gone
(function(){
  const out = (typeof G.renderOutRaciFull === 'function') ? G.renderOutRaciFull() : '';
  ok(out.indexOf('<select') < 0, 'B4: output RACI page has no editable cells');
  has(out, 'printRaci()', 'B4: output RACI page has a PDF button');
  has(out, 'Imogen Whitfield', 'B4: output matrix includes senior-leader columns');
  has(out, 'Step 2.1', 'B4: output page points at 2.1 as the editor');
  ok(typeof G.renderOutRaci === 'undefined', 'B4: dead renderOutRaci stub removed');
  ok(typeof G.printRaci === 'function', 'B4: printRaci exists');
  // seed letters render as static text (seed raci 0-0 = R)
  has(out, '>R</span>', 'B4: recorded letters render statically');
})();

/* ── RACI IDENTITY KEYING (Paul's ruling: letters follow the person) ── */
(function(){
  const snapOw = JSON.parse(JSON.stringify(G.data.ownership));
  const snapRaci = JSON.parse(JSON.stringify(G.data.raci));
  const ld1 = G.data.ownership.leads[0].id, ld2 = G.data.ownership.leads[1].id;
  ok(!!ld1 && !!ld2 && ld1 !== ld2, 'RACI: seed leads carry distinct ids');
  ok(Object.keys(G.data.raci).every(k => k.indexOf(':') > 0), 'RACI: all seed cells use identity keys');
  eq(G.data.raci['0:owner'], 'A', 'RACI: seed \u2013 the owner is Accountable for approving experiments (full matrix seeded July 7)');
  (function(){var acts=7;for(var ai=0;ai<acts;ai++){var aCount=0;Object.keys(G.data.raci).forEach(function(k){if(k.indexOf(ai+':')===0&&G.data.raci[k]==='A')aCount++});eq(aCount,1,'RACI: exactly one A on activity '+ai);}})();
  has(G.renderOutRaciFull(), '\u270E Edit', 'RACI: the output page carries the edit toggle (Paul, July 7)');
  G.UI.expanded.raciEdit = true;
  has(G.renderOutRaciFull(), 'raciCycle(', 'RACI: toggled, the output renders the live editable matrix (retargeted 17 Sep 2026: the cells cycle on click; the selects retired for Governance\'s chips)');
  G.UI.expanded.raciEdit = false;
  eq(G.data.raci['1:'+ld1], 'R', 'RACI: seed lead cell recorded against Marcus\u2019s id');
  // The old bug: removing lead[0] shifted lead[1]'s letters onto the wrong person. Now:
  G.data.raci['0:'+ld2] = 'C';                       // give Elena a letter
  G.removeLead(0);                                    // remove Marcus
  eq(G.data.raci['0:'+ld2], 'C', 'RACI: Elena\u2019s letter survives Marcus\u2019s removal (follows the person)');
  ok(Object.keys(G.data.raci).every(k => k.indexOf(':'+ld1) < 0), 'RACI: removed person\u2019s cells are purged');
  const outAfter = G.renderOutRaciFull();
  ok(outAfter.indexOf('Vincent Lau') < 0, 'RACI: removed person leaves the matrix columns');
  has(outAfter, 'Harriet Rivers', 'RACI: remaining people keep their columns');
  // restore
  G.data.ownership = JSON.parse(JSON.stringify(snapOw));
  G.data.raci = JSON.parse(JSON.stringify(snapRaci));
  eq(G.raciRoles(), ['Shalini Mehta','Vincent Lau','Harriet Rivers','Imogen Whitfield','Daniel Reyes','Finance'], 'RACI: state restored after removal test');
})();
// Legacy migration: position-keyed cells map onto whoever holds the column now
(function(){
  const snapRaci = JSON.parse(JSON.stringify(G.data.raci));
  const ld1 = G.data.ownership.leads[0].id;
  const elena = G.data.ownership.leads[1].id;
  G.data.raci = { '0-0':'R', '0-2':'I', '3-9':'A' };  // owner col, Elena's col (index 2), out-of-range
  G.ensureRaciModel();
  eq(G.data.raci['0:owner'], 'R', 'RACI-MIG: column 0 letter lands on the owner key');
  eq(G.data.raci['0:'+elena], 'I', 'RACI-MIG: column 2 letter lands on Elena\u2019s id');
  ok(G.data.raci['3-9'] === undefined && G.data.raci['0-0'] === undefined && G.data.raci['0-2'] === undefined,
     'RACI-MIG: legacy keys removed; out-of-range letters dropped');
  ok(Object.keys(G.data.raci).every(k => !/^\d+-\d+$/.test(k)), 'RACI-MIG: no positional keys remain');
  G.data.raci = JSON.parse(JSON.stringify(snapRaci));
})();
// Id backfill: people without ids get them; new rows are born with ids
(function(){
  const lead = G.data.ownership.leads[0];
  const savedId = lead.id;
  delete lead.id;
  G.ensureRaciModel();
  ok(!!lead.id, 'RACI: ensureRaciModel backfills a missing lead id');
  lead.id = savedId;
  G.addLead();
  const added = G.data.ownership.leads[G.data.ownership.leads.length-1];
  ok(!!added.id, 'RACI: addLead creates the row with an id');
  G.removeLead(G.data.ownership.leads.length-1);
  const snapS = G.data.ownership.seniors.length;
  G.addSenior();
  ok(!!G.data.ownership.seniors[snapS].id, 'RACI: addSenior creates the row with an id');
  G.removeSenior(snapS);
})();

/* ── ALLOCATE CAPITAL BATCH (committed sources, Committed Sums, relayout) ── */
// Cost sources: stage field wins, 2.4 estimate is the fallback
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const snapExp = JSON.parse(JSON.stringify(G.data.experiments||{}));
  const snapOps = JSON.parse(JSON.stringify(G.data.opsData||{}));
  G.ensureCapCostModel();
  // Backfill: seed dev items carry 2.4 estimates; the experiment budget now holds them
  ok(!!String((G.data.experiments[11]||{}).budget||'').trim(), 'CAP: backfill copies dev estimate into Development Costs');
  eq(G.costNum(G.data.experiments[11].budget), G.projCosts(11).start, 'CAP: backfilled budget equals the 2.4 estimate');
  ok(!!String((G.data.opsData[0]||{}).runCost||'').trim(), 'CAP: backfill copies ops estimate into Annual Sustainment Costs');
  eq(G.costNum(G.data.opsData[0].runCost), G.projCosts(0).run, 'CAP: backfilled sustainment equals the 2.4 estimate');
  // Override: the stage field is authoritative once set
  const before = G.capCommitments().total;
  const prevBudget = G.data.experiments[11].budget;
  G.data.experiments[11].budget = '$999K';
  eq(G.devCost(11), 999000, 'CAP: devCost reads the Development Costs override');
  eq(G.capCommitments().total, before - G.costNum(prevBudget) + 999000, 'CAP: commitments move with the override');
  G.data.experiments[11].budget = prevBudget;
  // Fallback: blank stage field falls back to the estimate
  G.data.experiments[11].budget = '';
  eq(G.devCost(11), G.projCosts(11).start, 'CAP: blank Development Costs falls back to the estimate');
  G.data.experiments = JSON.parse(JSON.stringify(snapExp)); G.ensureCapCostModel();
  const prevRun = G.data.opsData[0].runCost;
  G.data.opsData[0].runCost = '$500K';
  eq(G.opsSustainCost(0), 500000, 'CAP: opsSustainCost reads the sustainment override');
  G.data.opsData[0].runCost = prevRun;
  G.data.opsData = JSON.parse(JSON.stringify(snapOps)); G.ensureCapCostModel();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();
// Committed Sums: operational first, new labels
(function(){
  const com = G.capCommitments();
  ok(com.rows.length > 0, 'CAP: seed has committed rows');
  eq(com.rows[0].stage, 'Operational', 'CAP: operational rows come first');
  ok(com.rows.filter(r => r.stage === 'Development').every(r => r.label.indexOf('Full plan') === 0), 'CAP: development rows carry the full-plan label (single model)');
  ok(com.rows.filter(r => r.stage === 'Operational').every(r => r.label.indexOf('Full plan') === 0), 'CAP: operational rows carry the full-plan label (single model)');
  ok(com.rows.every(r => r.label !== 'startup' && r.label !== 'running'), 'CAP: no old lowercase labels remain');
  eq(com.total, com.dev + com.op, 'CAP: total = dev + op');
})();
// doLaunch copies the sustainment estimate into the ops card
(function(){
  const snapL = (G.data.launched||[]).slice();
  const snapOps = JSON.parse(JSON.stringify(G.data.opsData||{}));
  const snapStale = G.data.capStale;
  delete (G.data.opsData||{})[11];
  G.doLaunchGo(11);
  eq((G.data.opsData[11]||{}).runCost, G.data.projects[11].runningCost, 'CAP: doLaunch initializes Annual Sustainment Costs');
  G.data.launched = snapL; G.data.opsData = JSON.parse(JSON.stringify(snapOps)); G.data.capStale = snapStale; G.saveData();
})();
// Refresh bug: capital money fields re-render on blur
(function(){
  const realRender = G.render; let calls = 0;
  G.render = function(){ calls++; };
  const prev = (G.data.capital||{}).aiBudget;
  G.fldSave('cap_aiBudget', '$10M');
  eq(G.data.capital.aiBudget, '$10M', 'CAP: budget saves');
  ok(calls >= 1, 'CAP: blur on the budget field re-renders (stale-figures fix)');
  calls = 0;
  G.fldSave('cap_aiBudget', '$9M', true);
  eq(calls, 0, 'CAP: live keystrokes do not re-render');
  G.data.capital.aiBudget = prev; G.saveData();
  G.render = realRender;
})();
// Surfaces
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const _bud0=[G.data.capital.aiBudget,G.data.capital.budgetY2,G.data.capital.budgetY3];
  G.data.capital.aiBudget='$10M';G.data.capital.budgetY2='$10M';G.data.capital.budgetY3='$10M';G.data.capStale=true; // no-warn frame: stashed plans front-load lumps that breach the tightened seed budget
  G.UI.capTab = 2; G.UI.expanded['acRef'] = true;
  const t1 = G.renderStepAlloc();
  has(t1, 'Advance queue', 'CAP: the queue leads Commit & Advance (July 4 redesign)');
  // redesign pins: live ticks on the queue, staged-first sort, batch-aware calendar, folds
  G.UI.capSim = {15: true};
  const t1s = G.renderStepAlloc();
  has(t1s, '>Staged<', 'CAP: staged badge on ticked queue rows');
  ok(t1s.indexOf('Logistics Route Optimizer') < t1s.indexOf('Sales Knowledge Graph'), 'CAP: staged candidates sort first');
  has(t1s, 'staged batch included', 'CAP: the calendar card carries the batch');
  has(t1s, 'this month (batch)', 'CAP: batch segments itemized on the commit tab too');
  G.UI.expanded['acCum'] = true;
  const t1c = G.renderStepAlloc();
  has(t1c, 'Cumulative commitments stay under cumulative capacity', 'CAP: the fit verdict sits with the cumulative chart');
  G.UI.expanded['acCum'] = false;
  has(t1s, 'Development costs', 'CAP: cost panel written out (July 5)');
  has(t1s, 'Sustainment costs', 'CAP: sustainment line on the panel');
  ok(t1s.indexOf('>dev ') < 0, 'CAP: the minimal dev-rollup span is gone');
  has(t1s, 'Including the staged batch', 'CAP: the capital strip updates with the ticks');
  ok(t1s.indexOf(G.fmtMoney(G.capProjectWindow(15, G.capAssumedExtra(15).anchor).inW)) >= 0, 'CAP: the staged sentence carries the candidate\u2019s full in-window plan (single model)');
    has(t1s, 'full plans committed on advancing', 'CAP: staged sentence states the whole-plan doctrine');
  has(t1s, 'Change the mix'.replace('C','c'), 'CAP: mix stays editable here');
  G.UI.capSim = {};
  const t1e = G.renderStepAlloc();
  has(t1e, '\u25b8 Capacity Breach Funding Plan', 'CAP: funding plan folds when nothing warns (retitled July 5)');
  ok(t1e.indexOf('staged batch included') < 0, 'CAP: calendar reverts to baseline copy when unstaged');
  G.UI.expanded['fpA'] = false; G.UI.expanded['acCum'] = false; G.UI.expanded['acSwim'] = false;
  G.UI.expanded['acRef'] = true;
  ok(G.renderStepAlloc().indexOf('score-num-go') < 0, 'CAP: the duplicated big cells are retired from 3.3 \u2013 availability lives in the tabbed band (Paul, July 6)');
  G.UI.expanded['acRef'] = false;
  const tCap0 = G.renderStepCap();
  ok(tCap0.indexOf('Dates and Fiscal Calculations') < 0, 'CAP: fiscal fold retired from Plan Capacity (Paul ruling, July 4)');
  ok(tCap0.indexOf('costEcho_budget') < 0 && tCap0.indexOf('Reads as') < 0, 'CAP: no echo lines on the capacity fields');
  has(t1, 'Committed Sums', 'CAP: readout retitled (inside the reference fold)');
  has(t1, 'Project Kill/Phase-Out Pot', 'CAP: pot section retitled in white with a plain subtitle (Paul, July 5)');
  ok(tCap0.indexOf('How the dates and money work') < 0, 'CAP: old fold name gone from Plan Capacity');
  ok(t1.indexOf('What\u2019s in this pot') < 0 && t1.indexOf("What's in this pot") < 0, 'CAP: old pot label gone');
  ok(t1.indexOf('What the committed sum contains') < 0, 'CAP: old readout title gone');
  ok(t1.indexOf('Commitments are derived live') < 0, 'CAP: redundant explainer paragraph cut (its unique opening is gone; the carousel keeps its own one-off-plan line)');
  const s24 = G.renderStep24();
  has(s24, 'Estimated development costs', 'CAP: 2.4 development label');
  has(s24, 'Estimated rollout costs', 'CAP: 2.4 rollout field present');
  has(s24, 'Estimated annual sustainment costs', 'CAP: 2.4 sustainment label');
  const s33 = G.renderStepExp();
  has(s33, 'Development Budget', 'CAP: budget box is Development Budget (Paul, July 6)');
  ok(s33.indexOf('budEcho_') < 0, 'CAP: the 3.3 budget echo is retired (July 9)');
  G.UI.expanded['oe11'] = true;
  const dev = G.renderOutExpbriefsFull();
  has(dev, 'Idea card', 'CAP: Development card has the idea fold');
  has(dev, 'Project card', 'CAP: Development card has the project-card fold');
  has(dev, 'Development Budget', 'CAP: Development card budget renamed (Paul, July 6)');
  G.UI.expanded['oe11'] = false;
  G.UI.expanded['oo0'] = true;
  const ops = G.renderOutOperFull();
  has(ops, 'Annual Sustainment Costs', 'CAP: ops card has the prominent sustainment box');
  has(ops, 'ops_0_runCost', 'CAP: sustainment field id present');
  ok(ops.indexOf('susEcho_0') < 0, 'CAP: the sustainment echo is retired (July 9)');
  has(ops, 'Development card', 'CAP: ops card folds to the DEVELOPMENT card \u2013 the stale experiment card retired (Paul, July 7); history now runs idea \u2192 project \u2192 development');
  has(ops, 'Idea card', 'CAP: ops card has the idea fold');
  has(ops, 'Project card', 'CAP: ops card has the project-card fold');
  G.UI.expanded['oo0'] = false;
  G.UI.hubTab = 1; // readout and stage lists live on the Commitments tab (hub tabs, July 5)
  const hub = G.renderCapHub();
  has(hub, 'Committed Sums', 'CAP: Hub shows the shared Committed Sums card');
  has(hub, 'Development (Development Costs committed)', 'CAP: Hub development list retitled (Paul wording, July 5)');
  has(hub, 'committed costs', 'CAP: Hub operational list retitled');
  ok(hub.indexOf("What's in this pot") < 0, 'CAP: Hub top card no longer carries the pot');
  ok(hub.indexOf('Dates and Fiscal Calculations') < 0, 'CAP: Hub fold retired too');
  G.UI.hubTab = 0;
  const snap = G.renderOutCapplan();
  has(snap, 'est. rollout', 'CAP: Snapshot dev rows carry the rollout estimate');
  has(snap, 'Full plan', 'CAP: snapshot rows carry the full-plan label (single model, July 6)');
  // year-two behavior: backdate a launch and the label flips to sustainment-only
  const _od0 = JSON.parse(JSON.stringify(G.data.opsData[0]||{}));
  G.data.opsData[0].launchDate = new Date(Date.now() - 86400000*500).toISOString().slice(0,10);
  const com2 = G.capCommitments();
  const r0 = com2.rows.find(r => r.i === 0);
  ok(r0.label.indexOf('Full plan') === 0, 'CAP: single model – the row is the full plan regardless of launch year');
  eq(r0.amt, G.capProjectWindow(0).inW, 'CAP: the amount is the whole in-window plan');
  G.data.opsData[0] = _od0; G.saveData();
  // ops sustainment field routes through fldSave
  const prevRC = (G.data.opsData[0]||{}).runCost;
  G.fldSave('ops_0_runCost', '$75K');
  eq(G.data.opsData[0].runCost, '$75K', 'CAP: ops sustainment field saves through fldSave');
  G.data.opsData[0].runCost = prevRC; G.saveData();
  G.data.capital.aiBudget=_bud0[0];G.data.capital.budgetY2=_bud0[1];G.data.capital.budgetY3=_bud0[2];G.data.capStale=true;
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();
// Three-field model: rollout backfill, year-1 math, surfaces
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  G.ensureCapCostModel();
  ok(!!String((G.data.opsData[0]||{}).rolloutCost||'').trim(), 'CAP3: backfill copies the rollout estimate into the ops card');
  eq(G.costNum(G.data.opsData[0].rolloutCost), G.projCosts(0).roll, 'CAP3: backfilled rollout equals the 2.4 estimate');
  eq(G.opsRolloutCost(0), G.projCosts(0).roll, 'CAP3: opsRolloutCost reads the ops-card figure');
  const com = G.capCommitments();
  ok(!com.rows.some(r => r.label.indexOf('first year') >= 0), 'CAP3: staged first-year labels retired (single model, July 6)');
  ok(!com.rows.some(r => r.label === 'startup' || r.label === 'Startup Costs'), 'CAP3: no startup labels remain');
  const or0 = com.rows.find(r => r.i === 0);
  eq(or0.amt, G.capProjectWindow(0).inW, 'CAP3: an operational row commits its full in-window plan');
  const lensI = G.capLens();
  const sumY = lensI.years.reduce((a,r)=>a+r.committed,0);
  ok(Math.abs(com.total - sumY) <= 5, 'CAP3: IDENTITY – ledger total equals the per-year committed sums, one model  (got ' + com.total + ' vs ' + sumY + ')');
  // doLaunch also initializes rollout
  const snapL=(G.data.launched||[]).slice(); const snapOps=JSON.parse(JSON.stringify(G.data.opsData||{})); const snapStale=G.data.capStale;
  delete (G.data.opsData||{})[11];
  G.doLaunchGo(11);
  eq((G.data.opsData[11]||{}).rolloutCost, G.data.projects[11].rolloutCost, 'CAP3: doLaunch initializes Rollout Costs');
  G.data.launched=snapL; G.data.opsData=JSON.parse(JSON.stringify(snapOps)); G.data.capStale=snapStale; G.saveData();
  // ops card surfaces
  G.UI.expanded['oo0']=true;
  const ops=G.renderOutOperFull();
  has(ops, 'Rollout Costs', 'CAP3: ops card has the Rollout Costs box');
  has(ops, 'ops_0_rolloutCost', 'CAP3: rollout field id present');
  ok(ops.indexOf('rollEcho_0') < 0, 'CAP3: the rollout echo is retired (July 9)');
  G.UI.expanded['oo0']=false;
  // rollout field routes through fldSave
  const prevRoll=(G.data.opsData[0]||{}).rolloutCost;
  G.fldSave('ops_0_rolloutCost', '$55K');
  eq(G.data.opsData[0].rolloutCost, '$55K', 'CAP3: ops rollout field saves through fldSave');
  G.data.opsData[0].rolloutCost=prevRoll; G.saveData();
  // no old vocabulary on the money surfaces
  G.UI.capTab = 2; G.UI.expanded['acRef'] = true; // rows now live inside the Committed Sums fold (July 6)
  const t1=G.renderStepAlloc();
  G.UI.expanded['acRef'] = false;
  ok(t1.indexOf('Start-Up Budget') < 0, 'CAP3: Start-Up Budget gone from 3.2');
  has(t1, 'OVER THE PROGRAM', 'CAP3: ledger rows carry the figure cells (mini-dashboard, July 5)');
  ok(t1.indexOf('SUSTAINMENT') >= 0 && t1.indexOf('(EST.)') < 0 && t1.indexOf('not yet committed') < 0, 'CAP3: no estimate dimming \u2013 the full plan is committed at advance (single model, July 6)');
  has(t1, 'border-radius:50%', 'CAP3: status dot renders');
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

// expCardRO renders the recorded brief
(function(){
  const x = G.expCardRO(11);
  has(x, 'Development Costs', 'CAP: expCardRO shows the Development Costs');
  ok(typeof G.fiscalFold === 'function' && typeof G.fiscalHelpBox === 'function', 'CAP: fiscal fold + card wrapper both exist');
})();

/* ── BUDGET PLANS (redesign chunk A) ─────────────────────────── */
// Roll-up math on seed plans (sums must equal the carved simple figures)
(function(){
  eq(G.bpDevTotal(4), 150000, 'BP: item 4 dev roll-up');
  eq(G.bpRollTotal(4), 270000, 'BP: item 4 rollout roll-up');
  eq(G.bpSusSteady(4), 110000, 'BP: item 4 steady-state sustainment');
  eq(G.bpFirstOpMonth(4), 15, 'BP: first operational month follows the last step (rollout ends month 14 \u2013 reshaped July 7)');
  eq(G.bpSusStartOpYear(4), 1, 'BP: sustainment continuous from rollout\u2019s end');
  eq(G.bpSusOpYear(4,2), 110000, 'BP: a fully covered op year reads the annual rate');
  eq(G.bpSusYear(4,3), 110000, 'BP: project year 3 fully covered reads the annual rate (sustainment from month 15, reshaped July 7)');
  eq(G.bpPeakMonth(4), 5, 'BP: peak spending month');
  eq(G.bpLifetime(4), 150000+270000+201667, 'BP: lifetime = steps + sustainment inside the horizon (months 15\u201336 = 22 months at 110K/yr = 201,667)');
  [1,4,13].forEach(function(i){
    eq(G.bpDevTotal(i), G.costNum(G.data.projects[i].startupCost), 'BP: plan dev equals simple figure (item '+i+')');
    eq(G.bpRollTotal(i), G.costNum(G.data.projects[i].rolloutCost), 'BP: plan rollout equals simple figure (item '+i+')');
    eq(G.bpSusSteady(i), G.costNum(G.data.projects[i].runningCost), 'BP: plan steady sustainment equals simple figure (item '+i+')');
  });
})();
// Engine precedence + save guards
(function(){
  eq(G.devCost(13), G.bpDevTotal(13), 'BP: devCost reads the plan');
  const prev = G.data.experiments[13].budget;
  G.data.experiments[13].budget = '$999K';
  eq(G.devCost(13), 200000, 'BP: the plan outranks the simple field');
  G.data.experiments[13].budget = prev;
  G.fldSave('exp_13_budget', '$1M');
  eq(G.data.experiments[13].budget, prev, 'BP: locked experiment-card save is refused');
  const prevRC = (G.data.opsData[4]||{}).runCost;
  G.fldSave('ops_4_runCost', '$1M');
  eq((G.data.opsData[4]||{}).runCost, prevRC, 'BP: locked ops sustainment save is refused');
  const prevCS = G.data.projects[13].startupCost;
  G.fldSave('expl_13_cS', '$1M');
  eq(G.data.projects[13].startupCost, prevCS, 'BP: locked estimate save is refused');
  const prevN = (G.data.opsData[0]||{}).notes;
  G.fldSave('ops_0_notes', 'still works');
  eq(G.data.opsData[0].notes, 'still works', 'BP: unlocked ops fields still save');
  if(prevN===undefined) delete G.data.opsData[0].notes; else G.data.opsData[0].notes=prevN; G.saveData();
})();
// Operational-year windows + the gap
(function(){
  const snapOd = JSON.parse(JSON.stringify(G.data.opsData[1]||{}));
  const snapBp = JSON.parse(JSON.stringify(G.data.budgetPlans[1]));
  const snapPS = G.data.capital.periodStart;
  const snapAdv = G.data.projects[1].advancedAt;
  const d31 = new Date(); d31.setDate(1); d31.setMonth(d31.getMonth() - 30);
  G.data.capital.periodStart = d31.toISOString().slice(0, 10);
  G.data.projects[1].advancedAt = Date.parse(G.data.capital.periodStart);
  eq(G.opYear(1), 2, 'BP: thirty-one program months past its anchor lands in operational year 2 (first op month now 19; op year 1 = months 19\u201330 \u2013 reshaped July 7)');
  eq(G.opsSustainCost(1), 180000, 'BP: the first sustainment year covers the full annual rate');
  let r1 = G.capCommitments().rows.find(r => r.i === 1);
  ok(r1.label.indexOf('Full plan') === 0, 'BP: single model \u2013 the row is the full plan, launch year irrelevant');
  eq(r1.amt, G.capProjectWindow(1).inW, 'BP: the amount is the whole in-window plan');
  G.data.budgetPlans[1].sus[0].from = '43'; G.saveData();
  eq(G.bpSusStartOpYear(1), 3, 'BP: pushing the phase to month 43 moves the start to op year 3 (op years count from month 19 now)');
  eq(G.opsSustainCost(1), 0, 'BP: the gap year commits nothing');
  r1 = G.capCommitments().rows.find(r => r.i === 1);
  ok(r1.label.indexOf('Full plan') === 0, 'BP: single model \u2013 a sustainment gap does not change the row\u2019s basis');
  eq(r1.amt, G.capProjectWindow(1).inW, 'BP: the gap-adjusted amount still equals the whole in-window plan');
  G.data.opsData[1] = snapOd; G.data.budgetPlans[1] = snapBp;
  G.data.capital.periodStart = snapPS; G.data.projects[1].advancedAt = snapAdv; G.saveData();
})();
// Building and clearing a plan moves the engine live (UI handlers arrive in chunk C)
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const before = G.devCost(11);
  const pl = G.bpEnsure(11);
  pl.dev.push({id:'t1',name:'Test step',desc:'',from:'1',to:'2',cost:'$10K'}); G.saveData();
  eq(G.devCost(11), 10000, 'BP: a single step takes over the committed figure');
  pl.sus.push({id:'t2',name:'Run',from:'3',to:'ongoing',items:[{id:'t3',name:'Hosting',cost:'$5K'}]}); G.saveData();
  eq(G.bpHasSus(11), true, 'BP: a phase with items registers');
  eq(G.bpSusSteady(11), 5000, 'BP: phase items feed the steady rate');
  delete G.data.budgetPlans[11]; G.data.capStale = false; G.saveData();
  eq(G.devCost(11), before, 'BP: removing the plan restores the simple field');
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();
// Surfaces: locks live, year-bucket UI gone
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const s24 = G.renderStep24();
  ok(s24.indexOf('Cost Profile (multi-year)') < 0, 'BP: the year-bucket fold is gone from 2.4');
  G.UI.expanded['oe13'] = true; G.UI.expanded['oe11'] = true;
  const dev = G.renderOutExpbriefsFull();
  has(dev, 'Derived from budget plan', 'BP: note under the locked budget box, no article, 10px (Paul, July 6)');
  ok(dev.indexOf('exp_11_budget') >= 0 && dev.indexOf('budEcho_11') < 0, 'BP: planless items keep the editable box; the echo is retired (July 9)');
  ok(dev.indexOf('cp_13_startup_0') < 0, 'BP: grid cells are gone');
  G.UI.expanded['oe13'] = false; G.UI.expanded['oe11'] = false;
  G.UI.expanded['oo4'] = true;
  const ops = G.renderOutOperFull();
  has(ops, 'Derived from budget plan', 'BP: locked note on the ops card');
  has(ops, '>$110K</textarea>', 'BP: locked sustainment shows the steady rate; a continuous start needs no year label');
  G.UI.expanded['oo4'] = false;
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── TABBED CARDS (redesign chunk B) ────────────────────────── */
(function(){
  const s24 = G.renderStep24();
  has(s24, 'Project Budgeting', 'TB: 2.4 carries the budgeting tab');
  has(s24, 'Project Details', 'TB: 2.4 carries the details tab');
  G.UI.cardTab = G.UI.cardTab || {};
  // Naked Details/Budgeting tab pair removed from Dev/Ops/3.3 cards (Paul ruling, July 5): bpBudgetTab is reached through the Project card fold
  const dev = G.bpBudgetTab(13);
  has(dev, 'across 3 years', 'TB: stat band on the budget editor');
  ok(G.bpTabBar('tbprobe', 11).indexOf('lifetime') < 0, 'TB: the lifetime roll-up is off the tab button (Paul ruling, July 4)');
  has(dev, 'Vision model development', 'TB: step list renders');
  has(dev, 'over the length of the project period', 'TB: intro line on the budget editor');
  G.UI.expanded['oe13'] = true;
  const dev1 = G.renderOutExpbriefsFull();
  has(dev1, 'Portfolio Position', 'TB: the Development card keeps its brief body (vocabulary: position, July 10)');
  has(dev1, 'Derived from', 'TB: headline locks live on the card');
  has(dev1, 'Project card', 'TB: the Project card fold sits on the Development card');
  ok(dev1.indexOf('Choose what you want to work on') < 0, 'TB: no naked tab pair on the Development card');
  G.UI.expanded['oe13'] = false;
  const ops = G.bpBudgetTab(4);
  has(ops, 'Annual sustainment costs', 'TB: stat band on the ops budget editor');
  has(ops, 'Ongoing operation', 'TB: sustainment phase listed');
  has(ops, 'With 10% contingency', 'TB: contingency line renders when set');
  const s33 = G.renderStepExp();
  has(s33, 'Project card', 'TB: 3.3 briefs reach budgeting through the Project card fold');
  ok(s33.indexOf('Choose what you want to work on') < 0, 'TB: no naked tab pair on the 3.3 briefs');
  const dev11 = G.bpBudgetTab(11);
  has(dev11, 'Project Budgeting', 'TB: budget editor renders for planless items');
})();

/* ── PLAN EDITING (redesign chunk C) ───────────────────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  // Step lifecycle through the handlers
  G.bpAddStep(11,'dev');
  const pl = G.data.budgetPlans[11];
  eq(pl.dev.length, 1, 'PE: add step creates a row');
  const rid = pl.dev[0].id;
  G.bpRowSave(11,'dev',rid,'name','Build');
  G.bpRowSave(11,'dev',rid,'from','2');
  G.bpRowSave(11,'dev',rid,'to','4');
  G.bpRowSave(11,'dev',rid,'cost','$10K');
  eq(G.devCost(11), 10000, 'PE: saved step feeds the engine');
  eq(G.bpStepSpan(pl.dev[0]).join(','), '2,4', 'PE: the step span reads back');
  G.bpRowSave(11,'dev',rid,'from','6');
  eq(pl.dev[0].to, '6', 'PE: raising From clamps To');
  // Ghost rows become real on first input
  G.bpGhostSave(11,'roll','name','Deploy');
  eq(pl.roll.length, 1, 'PE: ghost row becomes real on input');
  G.bpGhostSave(11,'roll','name','   ');
  eq(pl.roll.length, 1, 'PE: blank input does not create rows');
  // Phases and line items
  G.bpGhostPhase(11,'name','Run');
  eq(pl.sus.length, 1, 'PE: ghost phase becomes real');
  eq(pl.sus[0].to, 'ongoing', 'PE: new phases default to Ongoing');
  const phid = pl.sus[0].id;
  G.bpPhSave(11,phid,'from','7');
  G.bpGhostItem(11,phid,'cost','$6K');
  eq(G.bpPhaseAnnual(pl.sus[0]), 6000, 'PE: ghost item feeds the phase rate');
  eq(G.bpSusSteady(11), 6000, 'PE: an ongoing phase sets the steady rate');
  G.bpItemSave(11,phid,pl.sus[0].items[0].id,'name','Hosting');
  eq(pl.sus[0].items[0].name, 'Hosting', 'PE: item saves');
  G.bpDelItem(11,phid,pl.sus[0].items[0].id);
  eq(pl.sus[0].items.length, 0, 'PE: item deletes');
  G.bpDelPhase(11,phid);
  eq(pl.sus.length, 0, 'PE: phase deletes');
  G.bpDelStep(11,'dev',rid);
  eq(G.bpHasDev(11), false, 'PE: deleting the step releases the lock');
  // Notes ride fldSave; meta rides bpMetaSave
  G.fldSave('bpn_11_dev','check assumptions');
  eq(G.data.budgetPlans[11].notes.dev, 'check assumptions', 'PE: notes save through fldSave');
  G.bpMetaSave(11,'horizon','5');
  eq(G.bpHorizon(11), 5, 'PE: lifetime selector saves');
  G.bpMetaSave(11,'contingency','15');
  eq(G.data.budgetPlans[11].contingency, '15', 'PE: contingency saves');
  delete G.data.budgetPlans[11]; G.data.capStale = false; G.saveData();
  // Surfaces
  G.UI.cardTab = G.UI.cardTab || {};
  const dev = G.bpBudgetTab(13);
  has(dev, 'DEVELOPMENT PHASES', 'PE: dev table renders (steps\u2192phases \u2013 Paul, July 6)');
  has(dev, 'ESTIMATED PROJECT LIFETIME', 'PE: lifetime selector renders');
  has(dev, 'CONTINGENCY %', 'PE: contingency field renders');
  has(dev, 'bps_13_dev_bp13a_name', 'PE: step inputs carry ids');
  has(dev, 'bpn_13_dev', 'PE: notes box renders');
  // Item 4's deliberate month-5 overlap draws the amber advisory
  const ops = G.bpBudgetTab(4);
  has(ops, 'is this correct?', 'PE: rollout-overlap advisory shows on item 4 \u2013 formal register (Paul ruling, July 5)');
  has(ops, 'Ongoing</option>', 'PE: sustainment To offers Ongoing');
  // Ghost rows on an empty plan
  const d11 = G.bpBudgetTab(11);
  has(d11, 'e.g. Build and validate model', 'PE: ghost rows teach by placeholder');
  has(d11, 'e.g. Ongoing operation', 'PE: ghost phase renders');
  if(G.data.budgetPlans[11]) { delete G.data.budgetPlans[11]; G.saveData(); }
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── PLAN CHARTS (redesign chunk D) ────────────────────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const sh = G.bpChartShape(4);
  ok(sh.indexOf('<svg') === 0, 'CH: spend shape renders as inline SVG');
  has(sh, '#45A188', 'CH: development series present (new palette)');
  ok(G.bpChartShape(4).indexOf('rgba(245,242,236,.12)') < 0, 'CH: the per-bar band is retired (Paul ruling)');
  has(G.bpChartWaterfall(4), 'with 10% contingency', 'CH: contingency lives on the waterfall end column now');
  const ln = G.bpChartLanes(4);
  has(ln, 'Line 1 instrumentation', 'CH: swimlane labels carry step names');
  const wf = G.bpChartWaterfall(4);
  has(wf, 'Sustainment yr 3', 'CH: waterfall carries sustainment years');
  has(wf, G.fmtMoney(G.bpLifetime(4)), 'CH: waterfall ends at the lifetime total');
  const cm = G.bpChartCum(4);
  has(cm, '= ' + G.fmtMoney(110000) + '/yr', 'CH: cumulative curve annotates the steady slope (Continuing costs beyond year N \u2013 Paul, July 6)');
  eq(G.bpChartShape(11), '', 'CH: no plan, no chart');
  // Ghost state teaches the payoff behind empty tables
  G.UI.cardTab = G.UI.cardTab || {};
  const d11 = G.bpBudgetTab(11);
  has(d11, 'pictures your plan will draw', 'CH: ghost caption teaches the payoff');
  // Charts sit on the budgeting tab after the tables
  const ops = G.bpBudgetTab(4);
  has(ops, 'MONTHLY SPEND SHAPE', 'CH: spend shape on the budgeting tab');
  has(ops, 'STEP TIMELINE', 'CH: swimlanes on the budgeting tab');
  has(ops, 'lifetime, including ongoing sustainment', 'CH: cumulative chart titled with the lesson');
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── BUDGET SHEET (redesign chunk E) ───────────────────────── */
(function(){
  const sh = G.renderBudgetSheetFor(4);
  has(sh, 'Project Budget Sheet', 'SH: sheet header');
  has(sh, 'Estimate \u00b7', 'SH: estimate stamp');
  has(sh, 'Operational', 'SH: stage named');
  has(sh, 'estimates of commitments, not tracked spend', 'SH: doctrine footer');
  has(sh, '90 Days to an AI Innovation Pipeline', 'SH: attribution');
  has(sh, 'Line 1 instrumentation', 'SH: compact step table carries step names');
  has(sh, G.fmtMoney(G.bpLifetime(4)), 'SH: lifetime on the band');
  has(sh, 'With 10% contingency', 'SH: contingency line');
  ok(sh.indexOf('rgba(245,242,236,.25)') < 0, 'SH: chart ink swapped for paper');
  has(sh, 'rgba(26,22,18', 'SH: dark ink present');
  has(sh, '#45A188', 'SH: category colors survive to print (new palette)');
  has(sh, 'Sensor &amp; gateway upkeep', 'SH: sustainment line items listed');
  // the print button rides the budget editor (reached through the Project card fold since July 5)
  has(G.bpBudgetTab(4), 'printBudgetSheet(4)', 'SH: print button on the budget editor');
})();

/* ── STEP RESTRUCTURE (org chunk G) ───────────────────────── */
(function(){
  const cap = G.renderStepCap();
  has(cap, 'Step 2: Plan Capacity', 'ST: the capacity step exists at 3.2');
  has(cap, 'Year 1 budget', 'ST: the year fields live on Plan Capacity (envelope header retired)');
  ok(cap.indexOf('cap_fyStartMonth') < 0, 'ST: the fiscal-year override does NOT live on Plan Capacity (relocated to the review date band \u2013 Paul, July 7; supersedes Ruling 5 via the July 7 return)');
  has(G.renderStep44(), 'cap_fyStartMonth', 'ST: the override lives in the review surface \u2013 align future reviews at review time');
  has(G.renderStep44(), 'Same as planning period', 'ST: it defaults to deriving from the period start');
  // FY override: display convention only \u2013 quarters move, money does not
  (function(){
    const fyWas = G.data.capital.fyStartMonth;
    G.data.capital.fyStartMonth = 1; G.Store.commit('capital');
    eq(G.fyQuarterOf(new Date(2026, 6, 15)).q, 3, 'FY: with a January fiscal year, July sits in Q3 (was Q2 on the April period start)');
    eq(Math.round(G.capCommitments().total), 3246249, 'FY: the override never touches money \u2013 the committed identity holds');
    if (fyWas === undefined) delete G.data.capital.fyStartMonth; else G.data.capital.fyStartMonth = fyWas;
    G.Store.commit('capital');
    eq(G.fyQuarterOf(new Date(2026, 6, 15)).q, 2, 'FY: cleared, quarters derive from the period start again (April \u2192 July is Q2)');
  })();
  has(cap, 'saveDoneCap()', 'ST: capacity has its own done gate');
  G.UI.capTab = 2; G.UI.expanded['acRef'] = true;
  const al = G.renderStepAlloc();
  has(al, 'Step 3: Allocate Capital', 'ST: Allocate renumbered to 3.3');
  ok(G.renderStepAlloc().indexOf('set at Step 3.2 (Plan Capacity)') < 0, 'ST: the fiscal-context pointer retired with the duplicate reference card (July 6)');
  ok(al.indexOf('BUDGET ENVELOPE') < 0, 'ST: the envelope is gone from Allocate');
  ok(al.indexOf('cap_aiBudget') < 0, 'ST: the budget field is gone from Allocate');
  const ex = G.renderStepExp();
  has(ex, 'Step 4: Map Development Track', 'ST: 3.4 rebuilt as Define Development Program (P2, July 5)');
  eq(G.CAROUSEL_CONTENT['3.2'][0].kind, 'Why', 'ST: new capacity carousel in place');
  ok(!!G.CAROUSEL_CONTENT['3.4'], 'ST: experiments carousel re-keyed to 3.4');
  has(G.CAROUSEL_CONTENT['3.4'][1].body, 'funded this cohort at Allocate Capital', 'ST: 3.4 carousel carries the approved redraft (Paul, July 6)');
  ok(!!G.MILESTONES['3.4'], 'ST: milestone follows the bump');
  G.UI.sec = '1.4';
  const bat = G.renderStep11();
  has(bat, 'AI Innovation Audit', 'ST: audit renamed');
  ok(bat.indexOf('au_0_cost') < 0, 'ST: audit cost column dropped');
  has(bat, 'au_0_status', 'ST: audit status column survives');
  G.UI.sec = '1.1';
})();

/* ── CAPACITY PLAN (org chunk H) ─────────────────────────── */
(function(){
  const cap = G.renderStepCap();
  has(cap, '>Planning</h3>', 'CY: planning card renders (Paul, July 6 \u2013 shape select retired)');
  has(cap, 'cap_periodStart', 'CY: period start input');
  ok(cap.indexOf('cap_programEnd') < 0 && cap.indexOf('cap_programShape') < 0, 'CY: shape and end-date controls fully retired (Paul, July 6 \u2013 year-granular cut ruled useless)');
  has(cap, '>1 year<', 'CY: the planning period offers a single year, singular label');
  has(cap, '>5 years<', 'CY: the planning period runs to five years');
  // WN: identity holds on a narrowed window
  (function(){
    const eyW = G.data.capital.envYears;
    G.data.capital.envYears = '2'; G.Store.commit('capital');
    eq(G.envYearsOf(), 2, 'WN: a two-year window is now selectable');
    const comW = G.capCommitments(); const lensW = G.capLens();
    const sumW = lensW.years.reduce((a,r)=>a+r.committed,0);
    ok(Math.abs(comW.total - sumW) <= 5, 'WN: IDENTITY holds on the narrowed window  (got ' + comW.total + ' vs ' + sumW + ')');
    ok(lensW.years.length === 2 && comW.total < 3246249, 'WN: two year rows, and Committed drops as the window narrows');
    G.data.capital.envYears = eyW; G.Store.commit('capital');
    eq(G.capCommitments().total, 3246249, 'WN: restoring the window restores the single-model constant');
  })();
  has(cap, 'Sustainment Cap', 'CY: cap field present');
  ok(cap.indexOf('University Cooperation Fund') < 0 && cap.indexOf('Offset pots') < 0 && cap.indexOf('Offset Pots') < 0, 'CY: no pots anywhere on 3.2 (offsets retired by ruling, July 4)');
  has(cap, 'cap_reserveY2', 'CY: reserve inputs on the envelope');
  has(cap, 'Capacity Picture', 'CY: picture card renders');
  has(cap, 'Intake reserve within capacity', 'CY: picture legend');
  has(cap, 'Sustainment cap 40%', 'CY: cap line in the legend');
  ok(cap.indexOf('evenly across its twelve months') < 0, 'CY: the flat-spread sentence is retired from the picture (Paul, July 4)');
  eq(G.envReserveYear(2), 700000, 'CY: reserve reads');
  // singleton saves through fldSave
  const prevPS = G.data.capital.periodStart;
  G.fldSave('cap_periodStart', '2026-02-01');
  eq(G.data.capital.periodStart, '2026-02-01', 'CY: period start saves through fldSave');
  G.data.capital.periodStart = prevPS; G.saveData();
  // fixed-term machinery fully removed (Paul, July 6 — year-granular cut ruled useless)
  const snap = JSON.parse(JSON.stringify(G.data.capital));
  // gate names both requirements (clear the seed completion so the hint can render)
  const prevDone = G.data.completedSteps['3.2'];
  G.data.completedSteps['3.2'] = false;
  G.data.capital.periodStart = '';
  const gate = G.renderStepCap();
  has(gate, 'year-one budget and the period start date', 'CY: gate names both requirements (reworded \u2013 copy pass, July 6)');
  G.data.completedSteps['3.2'] = prevDone;
  G.data.capital = JSON.parse(JSON.stringify(snap)); G.saveData();
})();

/* ── LEGACY INTAKE (org chunk I) ──────────────────────────── */
(function(){
  G.UI.capPlanTab = 2;
  const t2 = G.renderStepCap();
  has(t2, 'Legacy Projects', 'LG: tab 2 renders (header slimmed, July 4)');
  has(t2, 'Assigned to this budget?', 'LG: assign question is a header above the list');
  ok(t2.indexOf('funded elsewhere') < 0 && t2.indexOf('Funded elsewhere') < 0, 'LG: the select is just yes or no');
  ok(t2.indexOf('Legacy Projects \u2013 the opening position') < 0, 'LG: the meta-commentary header is gone');
  // yes items collected at the top (July 4): seed audit = yes,yes,no,no,yes -> Predictive maintenance precedes Document classification
  ok(t2.indexOf('Predictive maintenance') < t2.indexOf('Document classification'), 'LG: yes projects sort above the rest');
  has(t2, 'AI-assisted customer triage', 'LG: audit items listed');
  has(t2, 'legacyAssign(', 'LG: assignment selects wired');
  has(t2, 'does it draw on your AI transformation budget', 'LG: intro asks the one question (renamed budget, Paul July 7)');
  has(t2, 'stays off the organizational charts', 'LG: a no answer is explained');
  has(t2, '>Legacy<', 'LG: linked seed items wear the badge on their rows');
  // assignment roundtrip
  const prevA = G.data.audit[2].assigned;
  G.legacyAssign(2, 'yes');
  eq(G.data.audit[2].assigned, 'yes', 'LG: assignment saves');
  G.legacyAssign(2, prevA);
  // dynamic intake at Operational
  const nIdeas = G.data.ideas.length;
  G.addAudit();
  const ai = G.data.audit.length - 1;
  G.data.audit[ai].name = 'Test legacy system';
  G.UI.legacyStage[ai] = 'operational';
  G.data.capStale = true;
  const beforeC = G.capAvailable().committed;
  G.legacyIntake(ai);
  const idx = G.data.ideas.length - 1;
  eq(G.data.ideas.length, nIdeas + 1, 'LG: intake creates the idea');
  eq(G.data.projects[idx].legacy, true, 'LG: project carries the legacy flag');
  ok(G.data.launched.indexOf(idx) >= 0, 'LG: operational intake lands in launched');
  eq(G.data.audit[ai].projIdx, idx, 'LG: audit item links to the card');
  eq(G.opFirstYear(idx), false, 'LG: legacy operational is never first-year');
  // forward-only plan: sustainment from month 1, $12K a year
  G.data.budgetPlans[idx] = { horizon:'3', sus:[ {id:'lgt1', name:'Run', from:'1', to:'ongoing', items:[ {id:'lgti1', name:'Hosting', cost:'$12K'} ]} ] };
  G.data.capStale = true;
  eq(G.opsSustainCost(idx), 12000, 'LG: legacy sustainment reads the plan at full annual rate');
  G.data.capStale = true;
  eq(G.capAvailable().committed, beforeC + 36000, 'LG: the promise lands across the whole window \u2013 12,000/yr \u00d7 3 years (single model)');
  const ops = G.renderOutOperFull();
  has(ops, '>Legacy<', 'LG: operational card head wears the badge');
  // the fold embeds the budget form with the forward-only note
  G.UI.expanded['lgb' + idx] = true;
  const t2b = G.renderStepCap();
  has(t2b, 'money spent before the period began', 'LG: fold carries the forward-only note in plain words');
  has(t2b, 'bpm_' + idx + '_horizon', 'LG: the budgeting editor is embedded on tab 2');
  delete G.UI.expanded['lgb' + idx];
  // full cleanup – idx is last everywhere it was pushed
  G.data.ideas.pop();
  G.data.launched = G.data.launched.filter(function(x){return x !== idx});
  G.data.expSelected = G.data.expSelected.filter(function(x){return x !== idx});
  G.data.selected = G.data.selected.filter(function(x){return x !== idx});
  delete G.data.projects[idx];
  delete G.data.budgetPlans[idx];
  delete G.data.opsData[idx];
  G.data.audit.pop();
  G.data.capStale = true;
  eq(G.capAvailable().committed, beforeC, 'LG: cleanup restores the committed sum');
  // gate blocks on an unanswered named item
  G.addAudit();
  G.data.audit[G.data.audit.length - 1].name = 'Unanswered thing';
  eq(G.capAuditAnswered(), false, 'LG: an unanswered named item blocks the gate');
  const prevDone = G.data.completedSteps['3.2'];
  G.data.completedSteps['3.2'] = false;
  const gate = G.renderStepCap();
  has(gate, 'budget question for every legacy initiative', 'LG: gate hint names the requirement (reworded \u2013 copy pass, July 6)');
  G.data.completedSteps['3.2'] = prevDone;
  G.data.audit.pop();
  eq(G.capAuditAnswered(), true, 'LG: seed inventory is fully answered');
  G.UI.capPlanTab = 1;
  G.saveData();
})();

/* ── CALENDAR ENGINE (org chunk J1) ───────────────────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const near = (x, y, tol, label) => ok(Math.abs(x - y) <= (tol || 1), label + ' (got ' + x + ', want ~' + y + ')');
  // controlled state – save everything touched
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  G.data.capital.periodStart = '2026-01-01';
  eq(G.progMonthOf('2026-03-15'), 3, 'JB: program month of a date');
  const set = G.orgCommittedSet();
  ok(set.some(e => e.i === 13) && set.some(e => e.i === 0), 'JB: committed set holds dev and ops members');
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  set.forEach(e => { if (!G.bpHasAny(e.i) && e.i !== 0) { G.data.projects[e.i] = G.data.projects[e.i] || {}; G.data.projects[e.i].advancedAt = Date.parse('2025-01-01'); } });
  G.data.projects[13].advancedAt = Date.parse('2026-03-01');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.projects[4].advancedAt = Date.parse('2026-01-01');
  G.data.projects[0].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2026-02-01';
  // anchors
  eq(G.anchorMonth(13), 3, 'JB: anchor from advancedAt');
  G.data.projects[13].legacy = true;
  eq(G.anchorMonth(13), 1, 'JB: legacy anchors at the period start');
  delete G.data.projects[13].legacy;
  G.data.projects[13].startDate = '2026-05-01';
  eq(G.anchorMonth(13), 5, 'JB: a human-stated start date outranks advancedAt');
  delete G.data.projects[13].startDate;
  // the series, hand-computed from the seed
  const s = G.orgMonthly();
  near(s[2].dev, 130166.67, 1, 'JB: month-3 development stacks three plans, gross (16,666.67 + 86,000 + 27,500 \u2013 offsets retired July 4)');
  near(s[0].dev, 230000, 1, 'JB: month-1 development includes the no-plan lump');
  near(s[1].roll, 50000, 1, 'JB: no-plan rollout lands whole at launch');
  near(s[13].sus - s[12].sus, 5000, 1, 'JB: no-plan sustainment starts a twelfth per month, a year after launch');
  let dv = 0, rl = 0, su = 0; s.forEach(x => { dv += x.dev; rl += x.roll; su += x.sus; });
  near(dv, 1200000, 1, 'JB: development total – 680 + 150 + 200 + 170 lump (gross; offsets retired)');
  near(rl, 800000, 1, 'JB: rollout total');
  near(su, 796666.67, 1, 'JB: sustainment total (366,666.67 + 430,000 \u2013 the 1/4/13 reshape\u2019s added in-window sustainment, July 7)');
  eq(G.capMonthlyLine(1), G.envBudgetYear(1), 'JB: ANNUAL STEP \u2013 the full year budget lands in month 1 (Paul, July 7)');
  eq(G.capMonthlyLine(2), 0, 'JB: no accrual mid-year \u2013 the staircase is flat until the next year begins');
  eq(G.capMonthlyLine(13), G.envBudgetYear(2), 'JB: year 2\u2019s step lands in month 13');
  near(G.capSusCapLine(1), 2400000 / 12 * 0.4, 1, 'JB: cap line is 40% of it');
  // breaches: cumulative semantics
  G.data.capital.aiBudget='$10M';G.data.capital.budgetY2='$10M';G.data.capital.budgetY3='$10M';G.data.capStale=true; // the frame's lumps breach the tightened seed budget by design
  eq(G.capBreaches().overCapMonth, 0, 'JB: a roomy envelope holds – no breach in the controlled frame');
  G.data.capital.aiBudget = '$50K'; G.data.capital.budgetY2 = '$50K'; G.data.capital.budgetY3 = '$50K';
  eq(G.capBreaches().overCapMonth, 1, 'JB: tiny capacity breaches in month 1');
  G.data.capital = JSON.parse(JSON.stringify(cap0)); G.data.capital.periodStart = '2026-01-01';
  G.data.capital.susCap = '1';
  eq(G.capBreaches().capYears, [2, 3], 'JB: a 1% cap flags years two and three');
  G.data.capital = JSON.parse(JSON.stringify(cap0)); G.data.capital.periodStart = '2026-01-01';
  // legacy fixed-term data is ignored gracefully (machinery removed July 6)
  G.data.capital.programShape = 'fixed'; G.data.capital.programEnd = '2027-01-01';
  const s2 = G.orgMonthly();
  ok(s2[12].dev + s2[12].roll + s2[12].sus > 0, 'JB: a stale programEnd field no longer truncates anything');
  G.data.capital = JSON.parse(JSON.stringify(cap0)); G.data.capital.periodStart = '2026-01-01';
  // the editor and its read-only form
  const ed = G.bpBudgetTab(13);
  ok(ed.indexOf('OFFSETS') < 0 && ed.indexOf('bpOffSave') < 0, 'JB: no offsets section anywhere on the editor (retired by ruling, July 4)');
  const ro = G.bpBudgetTab(13, true);
  ok(ro.indexOf('OFFSETS') < 0, 'JB: nor on the read-only view');
  // the as-committed snapshot
  const sn = G.bpSnapshot(13);
  eq(sn.startDate, '2026-03-01', 'JB: snapshot records the committed start date');
  eq(sn.horizon, 3, 'JB: snapshot horizon');
  eq(sn.lifetime, G.bpLifetime(13), 'JB: snapshot lifetime matches the plan');
  eq(sn.years.length, 3, 'JB: snapshot carries per-project-year figures');
  eq(sn.dev, G.devCost(13), 'JB: snapshot per-category totals');
  // the hook fires at the real commit moment
  G.data.ideas.push({ name: 'Snapshot probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx);
  G.data.projects[idx] = { viable: true };
  G.data.portfolio[idx] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.advanceToDevFromExplore(idx);
  ok(G.data.expSelected.indexOf(idx) >= 0, 'JB: probe project advanced');
  ok(!!(G.data.projects[idx].committedSnap && G.data.projects[idx].committedSnap.at), 'JB: advance takes the as-committed snapshot');
  eq(String(G.data.projects[idx].committedSnap.startDate).length, 10, 'JB: snapshot start date is a date');
  // cleanup
  G.data.ideas.pop();
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx);
  G.data.selected = G.data.selected.filter(x => x !== idx);
  delete G.data.projects[idx]; delete G.data.portfolio[idx]; delete G.data.experiments[idx]; delete G.data.capAlloc[idx];
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── QUARTERS ON THE PROGRAM CALENDAR (org chunk J2a) ─────────── */
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const set = G.orgCommittedSet();
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  G.data.capital.periodStart = '2026-01-01';
  set.forEach(e => { if (!G.bpHasAny(e.i) && e.i !== 0) { G.data.projects[e.i] = G.data.projects[e.i] || {}; G.data.projects[e.i].advancedAt = Date.parse('2025-01-01'); } });
  G.data.projects[13].advancedAt = Date.parse('2026-03-01');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.projects[4].advancedAt = Date.parse('2026-01-01');
  G.data.projects[0].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2026-02-01';
  const w = G.capPeriod(new Date(2026, 2, 1), new Date(2026, 5, 1));
  ok(w.ps === true, 'JQ: capPeriod reads the program calendar');
  ok(Math.abs(w.total - 361929) <= 2, 'JQ: three-month slice sums the anchored series, gross (was 347,643 net; delta 14,285.7 = 0.25 \u00d7 item 13\u2019s netted 57,142.86 in the slice \u2013 offsets retired July 4) (got ' + w.total + ')');
  ok(w.rows.some(r => r.label.indexOf('program Months 3\u20135') >= 0), 'JQ: rows carry the calendar window');
  ok(w.rows.every(r => r.i !== 0), 'JQ: a project with nothing in the window has no row');
  eq(G.opFirstYear(1), true, 'JQ: anchored plan keeps item 1 in its one-time era (development and rollout underway)');
  eq(G.opYear(1), 1, 'JQ: op-year derives from the anchor and the plan');
  G.data.projects[1].advancedAt = Date.parse('2023-01-01');
  G.data.capital.periodStart = '2023-01-01';
  eq(G.opFirstYear(1), false, 'JQ: an old anchor ages the item past its first year \u2013 no launch date needed');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.capital.periodStart = '2026-01-01';
  G.data.capital.periodStart = '';
  const w2 = G.capPeriod(new Date(2026, 2, 1), new Date(2026, 5, 1));
  ok(w2.ps === false && w2.total === 0, 'JQ: without a period start the window is honestly empty');
  eq(G.thisQuarterConsumption().p.total, 0, 'JQ: This Quarter degrades honestly too');
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.saveData();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── ALLOCATE CAPITAL RESTRUCTURE (org chunk K) ─────────────── */
(function(){
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  G.data.capital.periodStart = '2026-01-01';
  // two tabs
  G.UI.capTab = 1;
  const sb = G.renderStepAlloc();
  has(sb, '1 \u00b7 Sandbox', 'KA: sandbox tab named');
  has(sb, '2 \u00b7 Commit & Advance', 'KA: commit tab named');
  has(sb, 'nothing is saved', 'KA: sandbox doctrine stated');
  // a dynamic Go candidate for the whole flow
  G.data.ideas.push({ name: 'Sandbox probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx);
  G.data.projects[idx] = { viable: true, startupCost: '$60K' };
  G.data.portfolio[idx] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.data.capAlloc[idx] = { gateRows: [ { d: 'Pilot gate', a: '$10K', w: 'wk 4' } ] };
  // extras engine: a hypothetical anchored at month 7 adds exactly its lump
  const base7 = G.orgMonthly()[6].dev;
  eq(Math.round(G.orgMonthly([{ i: idx, anchor: 7 }])[6].dev - base7), 60000, 'KA: a sandbox extra lands its development lump at its assumed anchor');
  // ticked batch draws the charts
  G.UI.capSim[idx] = true;
  const sb2 = G.renderStepAlloc();
  has(sb2, 'Staged batch (1)', 'KA: staged batch card renders (retitled July 4)');
  has(sb2, 'assumed start for every ticked candidate is next month (program Month ', 'KA: assumed-start sentence leads with next month, computed month in brackets (Paul, July 7)');
  has(sb2, '<svg', 'KA: the batch draws the charts');
  G.UI.capSim[idx] = false;
  // commit flow: start date, landing line, snapshot precedence
  G.UI.capTab = 2;
  // date inputs save silently on change; render is deferred to blur (July 5 crash fix)
  let _dr = 0; const _rr = G.render; G.render = () => { _dr++; };
  G.capStartSave(idx, '2026-04-01');
  eq(_dr, 0, 'KA: capStartSave no longer renders mid-edit \u2013 date segments survive');
  G.render = _rr;
  eq(G.data.projects[idx].startDate, '2026-04-01', 'KA: the assumed start date saves');
  const ca = G.renderStepAlloc();
  has(ca, 'prj_' + idx + '_startDate', 'KA: commit card carries the date input');
  has(ca, 'Plan Month 1 lands program Month 4', 'KA: the landing line reads the calendar');
  ok(ca.indexOf('Shown, never gated') < 0, 'KA: meta voice purged from the landing line');
  ok(ca.indexOf('Advance queue') >= 0 && ca.indexOf('Advance queue') < ca.indexOf('On the calendar'), 'KA: the queue precedes the calendar (July 4 redesign)');
  G.advanceWithGates(idx);
  ok(G.data.expSelected.indexOf(idx) >= 0, 'KA: the probe advanced');
  eq(G.data.projects[idx].committedSnap.startDate, '2026-04-01', 'KA: the snapshot records the human-stated date, not the advance moment');
  eq(G.anchorMonth(idx), 4, 'KA: the stated date is the anchor');
  // a second probe with no date gets the stated default assumption
  G.data.ideas.push({ name: 'Default-date probe', desc: '', when: 'now' });
  const idx2 = G.data.ideas.length - 1;
  G.data.selected.push(idx2);
  G.data.projects[idx2] = { viable: true, startupCost: '$10K' };
  G.data.portfolio[idx2] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.data.capAlloc[idx2] = { gateRows: [ { d: 'Gate', a: '$5K', w: 'wk 2' } ] };
  G.advanceWithGates(idx2);
  const dDef = new Date(); dDef.setDate(1); dDef.setMonth(dDef.getMonth() + 1);
  eq(G.data.projects[idx2].startDate, dDef.toISOString().split('T')[0], 'KA: a dateless commit assumes the first of next month \u2013 recorded, not implied');
  // breach opens the override path, and the record survives
  G.data.capital.aiBudget = '$50K'; G.data.capital.budgetY2 = '$50K'; G.data.capital.budgetY3 = '$50K';
  ok(G.capBreaches().overCapMonth > 0, 'KA: tiny capacity breaches');
  const cb = G.renderStepAlloc();
  has(cb, 'PROCEED ANYWAY \u2013 RECORDED OVERRIDE', 'KA: the override path opens on breach');
  has(cb, 'cap_overrideReason', 'KA: the reason field is there');
  G.capOverrideRecord('running hot \u2013 year-two reserve absorbs it if intake lags');
  eq((G.data.capital.overrides || []).length, 1, 'KA: the override is recorded');
  ok(G.data.capital.overrides[0].month > 0 && !!G.data.capital.overrides[0].at, 'KA: the record carries the breach month and the moment');
  has(G.renderStepAlloc(), 'year-two reserve absorbs it', 'KA: the paper trail renders');
  G.capOverrideRecord('   ');
  eq(G.data.capital.overrides.length, 1, 'KA: a blank reason records nothing');
  // cleanup – idx2 then idx are the last two everywhere
  G.data.ideas.pop(); G.data.ideas.pop();
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx && x !== idx2);
  G.data.selected = G.data.selected.filter(x => x !== idx && x !== idx2);
  [idx, idx2].forEach(k => { delete G.data.projects[k]; delete G.data.portfolio[k]; delete G.data.capAlloc[k]; delete G.data.experiments[k]; delete G.UI.capSim[k]; });
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
})();

/* ── LAUNCH CONFIRM-OR-REVISE + ANCHOR LINE (org chunk L) ───────── */
(function(){
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  // deterministic clock: period start six months back, anchor at period start → plan month now = 7
  const d6 = new Date(); d6.setDate(1); d6.setMonth(d6.getMonth() - 6);
  G.data.capital.periodStart = d6.toISOString().split('T')[0];
  G.data.ideas.push({ name: 'Launch probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx); G.data.expSelected.push(idx);
  G.data.projects[idx] = { viable: true, startDate: G.data.capital.periodStart };
  G.data.portfolio[idx] = { horizon: 'quick', risk: 'low', reward: 'high' };
  G.data.tracking[idx] = { status: 'complete' };
  G.data.budgetPlans[idx] = { horizon: '3',
    dev: [ { id: 'ld1', name: 'Build', from: '1', to: '2', cost: '$20K' } ],
    roll: [ { id: 'lr1', name: 'Deploy', from: '3', to: '4', cost: '$8K' } ],
    sus: [ { id: 'ls1', name: 'Run', from: '5', to: 'ongoing', items: [ { id: 'lsi1', name: 'Host', cost: '$6K' } ] } ] };
  eq(G.planMonthNow(idx), 7, 'LN: plan month now reads the anchor');
  // the button opens the panel; nothing launches yet
  G.doLaunch(idx);
  ok((G.data.launched || []).indexOf(idx) < 0, 'LN: doLaunch no longer launches – it opens the panel');
  ok(G.UI.expanded['lp' + idx] === true, 'LN: panel state set');
  G.UI.expanded['oe' + idx] = true;
  const dev = G.renderOutExpbriefsFull();
  has(dev, 'CONFIRM OR REVISE – LAUNCH', 'LN: the panel renders inline at the button');
  has(dev, 'plan Month 5; the launch is happening at plan Month 7 (2 months late)', 'LN: divergence stated');
  has(dev, 'Rows that have not yet run are listed', 'LN: only unrun rows are listed');
  ok(dev.indexOf('lp_' + idx + '_dev_ld1_f') < 0, 'LN: an elapsed development step is not listed');
  ok(dev.indexOf('lp_' + idx + '_roll_lr1_f') < 0, 'LN: an elapsed rollout step is not listed');
  has(dev, 'lp_' + idx + '_sus_ls1_f', 'LN: the not-yet-started sustainment phase is listed with its dropdown');
  // revise through the embedded dropdown handler, then confirm
  G.bpPhSave(idx, 'ls1', 'from', '8');
  eq(G.data.budgetPlans[idx].sus[0].from, '8', 'LN: the panel dropdown edits the real plan');
  G.capLaunchConfirm(idx);
  ok((G.data.launched || []).indexOf(idx) >= 0, 'LN: confirm launches');
  has(G.data.opsData[idx].launchConfirm.note, 'confirmed against actual launch', 'LN: the confirmation is recorded');
  ok(G.UI.expanded['lp' + idx] === false, 'LN: panel closes');
  // on-schedule wording (fresh probe state: pretend not launched, anchor moved so pm === firstOp)
  G.data.launched = G.data.launched.filter(x => x !== idx);
  delete G.data.opsData[idx];
  const d2 = new Date(d6); d2.setMonth(d2.getMonth() + 4); // anchor 4 months in → pm = 3... recompute below
  G.data.projects[idx].startDate = d2.toISOString().split('T')[0];
  // pm = 7 - anchor(5) + 1 = 3; firstOp = 5 → still divergent (early); set anchor 2 months in → pm = 5 = firstOp
  const d3 = new Date(d6); d3.setMonth(d3.getMonth() + 2);
  G.data.projects[idx].startDate = d3.toISOString().split('T')[0];
  eq(G.planMonthNow(idx), 5, 'LN: re-anchoring moves the plan month');
  G.doLaunch(idx);
  const dev2 = G.renderOutExpbriefsFull();
  has(dev2, 'On schedule: the plan expected the first operational month exactly now (plan Month 5). One click.', 'LN: on-schedule is one click');
  G.UI.expanded['lp' + idx] = false;
  // the anchor line on the budgeting tab
  const bt = G.bpBudgetTab(idx);
  has(bt, 'MONTHS COUNT FROM', 'LN: anchor line renders for a committed item');
  has(bt, 'program Month 3', 'LN: anchor line states the program month');
  has(bt, 'already passed since this date', 'LN: elapsed advisory present');
  has(bt, 'repositions the whole plan', 'LN: ruling-3 advisory in functional voice');
  // an uncommitted item shows no anchor line
  ok(G.bpBudgetTab(2).indexOf('MONTHS COUNT FROM') < 0, 'LN: exploration items carry no anchor line');
  // cleanup
  G.data.ideas.pop();
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx);
  G.data.selected = G.data.selected.filter(x => x !== idx);
  delete G.data.projects[idx]; delete G.data.portfolio[idx]; delete G.data.tracking[idx];
  delete G.data.budgetPlans[idx]; delete G.data.opsData[idx]; delete G.data.experiments[idx];
  delete G.UI.expanded['lp' + idx]; delete G.UI.expanded['oe' + idx];
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
})();

/* ── REVIEW SNAPSHOT (org chunk M) ───────────────────────── */
(function(){
  // seed state: reserves render, nothing else has drifted
  const r44 = G.renderStep44();
  has(r44, 'Review Snapshot</h3>', 'REVSNAP: title rolled back to Review Snapshot (Paul, July 7) \u2013 sectioned card, no meta gloss');
  has(r44, 'Intake Reserve</div>', 'REVSNAP: the section with content renders (retargeted 17 Sep 2026, Paul\'s ruling: only sections with content print; on the seed that is Intake Reserve)');
  ['Start Date Drift','Launch Variance','Overrides','Sustainment Cap'].forEach(function(t){ok(r44.indexOf(t + '</div>')<0, 'REVSNAP: the empty section \u201c' + t + '\u201d does not print');});
  ok(r44.indexOf('>\u2014</p>')<0, 'REVSNAP: no dashes for empty sections');
  has(r44, 'intake reserve', 'MB: reserve line renders');
  has(r44, 'is intake keeping pace?', 'MB: replenishment question has teeth');
  // controlled drift
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const d6 = new Date(); d6.setDate(1); d6.setMonth(d6.getMonth() - 6);
  G.data.capital.periodStart = d6.toISOString().split('T')[0];
  G.data.ideas.push({ name: 'Drift probe', desc: '', when: 'now' });
  const idx = G.data.ideas.length - 1;
  G.data.selected.push(idx); G.data.expSelected.push(idx);
  G.data.projects[idx] = { viable: true, startDate: '2026-04-01', committedSnap: { at: 1, by: '', startDate: '2026-02-01', horizon: 3, lifetime: 0, dev: 0, roll: 0, sus: 0, years: [], contingency: '' } };
  const r2 = G.renderStep44();
  has(r2, 'start date: committed at 2026-02-01, now says 2026-04-01', 'MB: start-date drift reads committed vs now');
  // launch drift through the real confirmation
  G.data.projects[idx].startDate = G.data.capital.periodStart; // anchor at period start \u2192 pm = 7
  G.data.budgetPlans[idx] = { horizon: '3',
    dev: [ { id: 'md1', name: 'Build', from: '1', to: '2', cost: '$10K' } ],
    roll: [ { id: 'mr1', name: 'Deploy', from: '3', to: '4', cost: '$5K' } ],
    sus: [ { id: 'ms1', name: 'Run', from: '5', to: 'ongoing', items: [ { id: 'msi1', name: 'Host', cost: '$3K' } ] } ] };
  G.capLaunchConfirm(idx);
  eq(G.data.opsData[idx].launchConfirm.expectedFo, 5, 'MB: confirmation records the expected first-op month');
  eq(G.data.opsData[idx].launchConfirm.actualPm, 7, 'MB: confirmation records the actual plan month');
  const r3 = G.renderStep44();
  has(r3, 'launch: expected plan Month 5, launched at 7 (2 months late)', 'MB: launch drift reads the record');
  // an override surfaces with its reason
  G.data.capital.overrides = [ { id: 'ov1', at: Date.now(), by: '', month: 3, reason: 'running hot into the year-two reserve' } ];
  has(G.renderStep44(), 'running hot into the year-two reserve', 'MB: overrides surface at the review');
  // cleanup
  G.data.ideas.pop();
  G.data.launched = G.data.launched.filter(x => x !== idx);
  G.data.expSelected = G.data.expSelected.filter(x => x !== idx);
  G.data.selected = G.data.selected.filter(x => x !== idx);
  delete G.data.projects[idx]; delete G.data.budgetPlans[idx]; delete G.data.opsData[idx]; delete G.data.experiments[idx];
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  G.data.capStale = true;
  G.saveData();
})();

/* ── VISUAL DASHBOARD (org chunk V) ──────────────────────── */
(function(){
  const yWas = G.UI.capYear; G.UI.capYear = 'T'; // donuts follow the year tabs; pin the Total view
  const an = G.renderCapAnalytics();
  has(an, 'Committed, all years', 'VD: KPI strip renders (follows the year tabs; frame pins the Total view)');
  has(an, 'The Committed Calendar', 'VD: swimlanes card renders');
  has(an, 'Committed Costs by Project', 'VD: composition donut retitled (Paul, July 5)');
  has(an, 'all years combined', 'VD: donut center names the horizon plainly (offsets-era \u201cnet\u201d fossil retired)');
  ok(an.indexOf('whole horizon, net') < 0, 'VD: no stale center label');
  G.UI.capYear = yWas;
  has(an, 'Sustainment Load by Year', 'VD: sustainment-load card renders (plateau vocabulary retired \u2013 Paul, July 5)');
  const _vb=G.data.capital.aiBudget;G.data.capital.aiBudget='$10M';G.data.capStale=true;
  has(G.renderCapHub(), '&lt;1% of budget', 'VD: sub-1% sustainment reads <1%, never a false 0% (controlled roomy budget; Paul, July 5)');
  G.data.capital.aiBudget=_vb;G.data.capStale=true;
  ok(an.indexOf('>0% of budget') < 0, 'VD: no zero-percent label while money is committed');
  has(G.renderCapHub(), 'Quarter Runway', 'VD: quarter strip renders in the Hub\u2019s review-quarter section (dashboard tab)');
  ok(an.indexOf('Offset Pots') < 0 && an.indexOf('University Cooperation Fund') < 0, 'VD: no pot bars, no pot names (offsets retired July 4)');
  ok((an.match(/<svg/g) || []).length >= 4, 'VD: the dashboard is drawn, not described (got ' + (an.match(/<svg/g) || []).length + ' svgs)');
  // swimlanes carry the committed seed items and the new palette
  const sw = G.orgSwimlanes();
  has(sw, 'Quality Inspection Vision', 'VD: a committed lane is named');
  has(sw, '#45A188', 'VD: lanes wear the new palette');
  ok(sw.indexOf('#8B5E3C') < 0, 'VD: no brown in the lanes');
  // donut total equals the series total (relational – wall-clock safe)
  const srs = G.orgMonthly();
  const tot = Math.round(srs.reduce((a, r) => a + r.dev + r.roll + r.sus, 0));
  (function(){var yw=G.UI.capYear;G.UI.capYear='T';has(G.orgCompositionDonut(), G.fmtMoney(tot), 'VD: donut center equals the series total (Total view)');G.UI.capYear=yw})();
  // sandbox extras draw dashed hypothetical lanes
  has(G.orgSwimlanes([{ i: 0, anchor: 5 }]), 'stroke-dasharray="3,2"', 'VD: hypothetical lanes are dashed');
  ok(typeof G.reviewMixBar === 'undefined', 'VD: the decision-mix bar is retired whole (Paul, July 7 \u2013 not useful once decisions are underway)');
  // outcome page carries the charts
  const oc = G.renderOutCapplan();
  has(oc, 'The Committed Calendar', 'VD: Capital Snapshot outcome carries the swimlanes');
  G.saveData();
})();

/* ── 2.4 + BUDGETING TAB UI PASS (Paul, July 3) ──────────────── */
(function(){
  const s24 = G.renderStep24();
  has(s24, 'AVAILABLE PROJECTS', 'UI: project pills are headed');
  has(s24, 'Project Name: </span>', 'UI: card leads with the labeled name');
  has(s24, 'Choose what you want to work on:', 'UI: the tab pair is introduced');
  const bt = G.bpBudgetTab(1);
  has(bt, 'Lifetime cost', 'UI: statband labels per spec (spend\u2192cost \u2013 doctrine fix, copy pass July 6: the module never tracks spend)');
  has(bt, 'Development costs', 'UI: development labeled');
  has(bt, 'Rollout costs', 'UI: rollout labeled');
  has(bt, 'Annual sustainment costs', 'UI: sustainment labeled');
  has(bt, 'Monthly costs peak at Month ', 'UI: peak line in words (doctrine fix, July 6)');
  has(bt, 'First operational month occurs at Month ', 'UI: first-op line in words');
  ok(bt.indexOf('Mo ') < 0, 'UI: no Mo abbreviation anywhere on the tab');
  // seeded deepened example (Field Service Assistant, item 16) – full detail, no verdict, no rescore
  const p16 = G.data.projects[16] || {};
  ok(['objectives','deliverables','timeline','resources','risks','metrics','partInt','partExt'].every(k => String(p16[k] || '').length > 20), 'UI: item 16 detail boxes are all filled');
  ok(p16.gap && ['skillsH','skillsN','resourcesH','resourcesN','technologyH','technologyN'].every(k => String(p16.gap[k] || '').length > 10), 'UI: item 16 gap analysis filled');
  ok(p16.swot && ['strengths','weaknesses','opportunities','threats'].every(k => String(p16.swot[k] || '').length > 10), 'UI: item 16 SWOT filled');
  ok(G.bpHasAny(16) && G.bpLifetime(16) > 0, 'UI: item 16 carries a full budget plan');
  eq(G.bpFirstOpMonth(16), 12, 'UI: item 16 first operational month');
  ok(p16.viable === undefined && !p16.rescoreDone, 'UI: item 16 awaits its verdict – no Go/No Go, no rescore');
  // contingency: off the spend shape, onto the waterfall and cumulative (Paul ruling)
  const shp = G.bpChartShape(16);
  ok(shp.indexOf('rgba(245,242,236,.12)') < 0, 'UI: no per-bar band on the spend shape');
  const wf16 = G.bpChartWaterfall(16);
  has(wf16, 'with 10% contingency', 'UI: waterfall end column shows the ask figure');
  has(wf16, ' base<', 'UI: base lifetime labeled beneath it');
  has(wf16, '+10% contingency on ', 'UI: per-step contingency caps titled');
  const cum16 = G.bpChartCum(16);
  has(cum16, 'with 10% contingency', 'UI: cumulative carries the contingent figure');
  has(cum16, 'stroke-dasharray="4,3"', 'UI: contingent curve is dashed');
})();

/* ── ORG CONTINGENCY CURVE, TWO-TIER WARNINGS (Paul ruling) ─────── */
(function(){
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const set = G.orgCommittedSet();
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  const ct1 = G.data.budgetPlans[1].contingency;
  G.data.capital.periodStart = '2026-01-01';
  G.data.capital.aiBudget = '$800K'; G.data.capital.budgetY2 = '$800K'; G.data.capital.budgetY3 = '$800K';
  set.forEach(e => { if (e.i !== 1) { G.data.projects[e.i] = G.data.projects[e.i] || {}; G.data.projects[e.i].advancedAt = Date.parse('2020-01-01'); } });
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2020-02-01';
  const snapT0 = JSON.parse(JSON.stringify(G.data.tracking[0]||{}));
  G.data.tracking[0] = Object.assign({}, snapT0, {status:'killed'}); // its launch-based sustainment would rightly chart from month 1 otherwise
  G.data.budgetPlans[1].contingency = '60';
  // relational: the contingent series scales month 1 by the factor
  eq(Math.round(G.orgMonthly(null, true)[0].dev - G.orgMonthly()[0].dev), 24000, 'CT: month-1 contingent delta is 60% of the 40K step');
  const br = G.capBreaches();
  eq(br.overCapMonth, 0, 'CT: base commitments stay under capacity');
  eq(br.ctOverCapMonth, 11, 'CT: with a 60% contingency the cumulative curve crosses inside month 11 under ANNUAL STEP \u2013 1.6\u00d7 committed first exceeds the year-1 step (2.4M available from month 1) before year 2\u2019s step arrives at month 13; re-derived from month 3 under the retired pro-rata line (July 7)');
  const ctM = br.ctOverCapMonth;
  const cc = G.orgCumChart();
  has(cc, '#E8D48B', 'CT: the contingent curve is drawn in light yellow');
  has(cc, 'with contingencies \u2013 month ' + ctM, 'CT: light-yellow marker at the contingent crossing (render matches engine)');
  has(cc, 'stated contingency', 'CT: legend explains the pale curve');
  G.UI.capTab = 2;
  has(G.renderStepAlloc(), 'stated contingencies would cross it in Month ' + ctM, 'CT: funding plan carries the light-yellow warning');
  has(G.renderCapAnalytics(), 'would cross capacity in Month ' + ctM, 'CT: flags card carries it too');
  // amber tier untouched: shrink capacity so the base breaches
  G.data.capital.aiBudget = '$50K'; G.data.capital.budgetY2 = '$50K'; G.data.capital.budgetY3 = '$50K';
  ok(G.capBreaches().overCapMonth > 0, 'CT: base breach still ambers');
  // restore
  G.data.tracking[0] = snapT0;
  G.data.budgetPlans[1].contingency = ct1;
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.data.capStale = true;
  G.saveData();
})();

/* ── TABBED PROJECT CARD (Paul, July 4): RO tabs + edit swap ─────── */
(function(){
  G.UI.pcTab = {}; G.UI.pcEdit = {};
  const c0 = G.projCardRO(16);
  ['Overview', 'Analyses', 'Budget'].forEach(t => has(c0, t, 'PC: tab – ' + t));
  has(c0, 'pcEditToggle(16)', 'PC: Edit button present');
  has(c0, 'Lifetime cost', 'PC: overview leads with the stat band');
  has(c0, 'Pilot an on-site troubleshooting assistant', 'PC: overview carries the detail boxes');
  G.pcTabSet(16, 1);
  const c1 = G.projCardRO(16);
  has(c1, 'Gap Analysis', 'PC: analyses tab – gap analysis');
  has(c1, 'SWOT', 'PC: analyses tab – SWOT');
  has(c1, 'Rich ticket history', 'PC: SWOT strengths render');
  ok(c1.indexOf('Lifetime cost') < 0, 'PC: stat band stays on its own tabs');
  G.pcTabSet(16, 2);
  const c2 = G.projCardRO(16);
  has(c2, 'Project Budgeting', 'PC: budget tab renders the read-only budget');
  ok(c2.indexOf('bpRowSave') < 0, 'PC: budget tab is read-only – no editable rows');
  G.pcEditToggle(16);
  const ce = G.projCardRO(16);
  has(ce, 'PROJECT CARD – EDITING', 'PC: edit mode banner');
  has(ce, 'Done editing', 'PC: edit mode exit');
  has(ce, 'expl_16_obj', 'PC: edit mode is the full editable card');
  G.pcEditToggle(16);
  ok(G.projCardRO(16).indexOf('expl_16_obj') < 0, 'PC: Done returns to the read-only card');
  // edit mode carries exactly one tab bar (assessBlock's own – the wrapper's duplicate was cut)
  G.UI.pcEdit[16] = true;
  const ce2 = G.projCardRO(16);
  eq(ce2.split('Choose what you want to work on').length - 1, 1, 'PC: one tab bar in edit mode, not two');
  G.UI.pcEdit = {};
  // stat band on every Overview, matching the budget tab (Paul, July 4)
  has(G.projCardRO(3), 'Lifetime cost', 'PC: overview stat band renders even without a plan (dashes)');
  // seeded plans for the 3.1 trio, faithful to their simple estimates
  ok(G.bpHasAny(2) && G.bpHasAny(14) && G.bpHasAny(15), 'PC: Sales Knowledge Graph, Churn Model, Route Optimizer carry seeded plans');
  eq(G.devCost(2), 250000, 'PC: SKG plan development matches the $250K estimate it supersedes');
  eq(G.bpSusSteady(14), 55000, 'PC: Churn sustainment matches the $55K/yr estimate');
  ok(G.bpLifetime(15) > 0 && !G.bpHasRoll(15), 'PC: Route Optimizer plan – no rollout section, faithful to its estimates');
  G.UI.pcTab = {}; G.UI.pcEdit = {};
})();

/* ── EXPLORATION PORTFOLIO RESTRUCTURE (Paul, July 4) ───────────── */
(function(){
  G.UI.pcTab = {}; G.UI.pcEdit = {};
  const pg = G.renderOutExploreEnhanced();
  // seed spread: 2 graded; 14/15 Go-ungraded; 16/17 unresolved; 3 is No-Go (Not Advancing)
  has(pg, 'Structured Portfolio (1)', 'OX: the Structured Portfolio counts the graded set only');
  has(pg, 'Not Yet Positioned (2)', 'OX: Go-but-not-yet-positioned sit in their own section (vocabulary: position, July 10)');
  has(pg, 'Incomplete (2)', 'OX: unresolved sit under Incomplete');
  ok(pg.indexOf('Awaiting verdict') < 0, 'OX: the awaiting-verdict badge is gone');
  ok(pg.indexOf('In Exploration (') < 0, 'OX: the old flat header is gone');
  ok(pg.indexOf('Stage Gates') < 0 && pg.indexOf('gateTable') < 0, 'OX: no stage gates on this page (parked for the Development rework)');
  has(pg, 'Graded projects only', 'OX: balance panel plots the actual portfolio');
  ok(pg.indexOf('provisional') < 0, 'OX: the provisional layer is gone');
  has(pg, '2 awaiting portfolio grading', 'OX: balance queue counts the ungraded');
  // open a graded card: read-only tabbed card with Edit; grading section reworded
  G.UI.expanded['ox2'] = true;
  const pg2 = G.renderOutExploreEnhanced();
  has(pg2, 'Portfolio assessment complete', 'OX: graded badge reworded (July 4, second pass)');
  has(pg2, 'pcEditToggle(2)', 'OX: verdict-holders get the read-only card with Edit');
  has(pg2, 'Portfolio Position</h4>', 'OX: positioning section reworded (vocabulary: position, July 10)');
  G.UI.expanded['ox2'] = false;
  // open an incomplete card: still the editable page
  G.UI.expanded['ox17'] = true;
  has(G.renderOutExploreEnhanced(), 'expl_17_obj', 'OX: incomplete items default to the editable card');
  G.UI.expanded['ox17'] = false;
  // 3.1: balance panel there is also actual-only; notes slimmed
  const s31 = G.renderStep31();
  has(s31, 'Graded projects only', 'OX: 3.1 balance panel matches');
  has(s31, 'rows="1"', 'OX: 3.1 notes box slimmed');
  ok(s31.indexOf('form-label">Notes') < 0, 'OX: 3.1 notes label is no longer the bright form label');
})();

/* ── GAP ANALYSIS: NEED / HAVE / GAP items (Paul, July 4) ────────── */
(function(){
  // migration from legacy free text: semicolon-split, H items arrive covered
  const gi = G.gapItemsOf(16);
  eq(gi.skills.length, 3, 'GA: item 16 skills migrate to 3 items (2 have + 1 need)');
  eq(gi.skills.filter(x => x.have).length, 2, 'GA: legacy Have items arrive covered');
  eq(gi.skills.filter(x => !x.have).length, 1, 'GA: the gap is need minus have');
  ok(!((G.data.projects[16] || {}).gapItems), 'GA: pure read – migration does not write');
  // lifecycle on a clean project
  G.gapAdd(17, 'skills', 'GPU capacity');
  const g17 = G.data.projects[17].gapItems;
  eq(g17.skills.length, 1, 'GA: add lands in Need');
  ok(!g17.skills[0].have, 'GA: new needs start uncovered');
  G.gapHave(17, 'skills', g17.skills[0].id);
  ok(g17.skills[0].have, 'GA: marking covered moves it to Have');
  G.gapUnHave(17, 'skills', g17.skills[0].id);
  ok(!g17.skills[0].have, 'GA: unmarking returns it to the gap');
  G.gapDel(17, 'skills', g17.skills[0].id);
  eq(g17.skills.length, 0, 'GA: delete removes the need entirely');
  delete G.data.projects[17].gapItems; G.saveData();
  // editable card: three tabs, item editor on Analyses
  G.UI.cardTab = G.UI.cardTab || {}; G.UI.cardTab['bta16'] = 3;
  const ae = G.assessBlock(16);
  has(ae, 'Analyses', 'GA: editable card has the Analyses tab');
  has(ae, 'gapAdd(16', 'GA: needs are added as items');
  has(ae, 'Mark a need as covered', 'GA: Have is selected from the needs, not typed');
  has(ae, 'GAP – need minus have', 'GA: derived gap column');
  has(ae, 'SWOT Analysis', 'GA: SWOT lives on the Analyses tab');
  G.UI.cardTab['bta16'] = 1;
  ok(G.assessBlock(16).indexOf('gapAdd(') < 0, 'GA: details tab no longer carries the analyses');
  // read-only card: gap table + quadrant graphic
  G.UI.pcTab = {16: 1};
  const ro = G.projCardRO(16);
  ['NEED', 'HAVE', 'GAP'].forEach(c => has(ro, c, 'GA: RO gap column – ' + c));
  has(ro, '+ STRENGTHS', 'GA: SWOT quadrant labels');
  ok(ro.indexOf('HELPFUL') < 0 && ro.indexOf('INTERNAL (top)') < 0, 'GA: quadrant axis labels retired (Paul ruling, July 4)');
  G.UI.pcTab = {};
  // Aurora example fold mirrors the new card (July 4 overhaul)
  G.UI.showEx = G.UI.showEx || {}; G.UI.showEx.aurora24 = true;
  const ax = G.aurora24Example();
  ['Project Details', 'Gap Analysis', 'NEED', 'HAVE', 'GAP', '+ STRENGTHS'].forEach(t => has(ax, t, 'GA: example fold – ' + t));
  ok(ax.indexOf('<em>Have:</em>') < 0, 'GA: legacy have/need prose form is gone from the example');
  ok(ax.indexOf('HELPFUL') < 0, 'GA: example quadrant carries no axis labels either');
  G.UI.showEx.aurora24 = false;
})();

/* ── PER-YEAR SUSTAINMENT CAP OVERRIDES (Paul ratified, July 4) ───── */
(function(){
  eq(G.susCapOf(2), 40, 'SC: a blank override inherits the single cap');
  G.data.capital.susCapY2 = '60';
  eq(G.susCapOf(2), 60, 'SC: a year override wins for its year');
  eq(G.susCapOf(1), 40, 'SC: other years still inherit');
  G.data.capStale = true;
  const yt = G.orgYearTotals();
  eq(yt[1].scpY, 60, 'SC: the year ledger carries the year cap');
  eq(yt[0].scpY, 40, 'SC: year 1 unchanged');
  const pic = G.capacityPicture();
  has(pic, 'Sustainment cap – per year', 'SC: legend switches when caps vary');
  has(pic, 'Sustainment cap 60%', 'SC: the year-2 line titles its own figure');
  const t1sc = G.renderStepCap();
  has(t1sc, 'cap_susCapY2', 'SC: override boxes render on the cap card');
  has(t1sc, 'PER-YEAR OVERRIDES', 'SC: override row labeled');
  delete G.data.capital.susCapY2; G.saveData(); G.data.capStale = true;
  has(G.capacityPicture(), 'Sustainment cap 40%', 'SC: uniform legend returns when the override clears');
})();

/* ── SANDBOX BASELINE + ASSUMED START DATES (Paul, July 4) ──────── */
(function(){
  G.UI.capTab = 1; G.UI.capSim = {};
  const sb0 = G.renderStepAlloc();
  has(sb0, 'The standing baseline', 'BL: charts draw with nothing ticked');
  has(sb0, 'tick candidates above to stage the batch on top', 'BL: baseline explains itself');
  ok(sb0.indexOf('Tick candidates above to draw the batch.') < 0, 'BL: the empty placeholder is gone');
  // a ticked candidate with a start date charts at it; the copy says so
  G.UI.capSim = {2: true};
  G.data.projects[2].startDate = '2027-01-15';
  const sb1 = G.renderStepAlloc();
  has(sb1, 'Unless otherwise specified', 'BL: the one assumed-start sentence covers dated and undated alike');
  has(sb1, 'capStartSave(2', 'BL: date input on the sandbox line');
  // each ticked candidate is an itemized segment with its own legend swatch (July 4)
  has(sb1, 'this month (batch)', 'BL: candidate segments carry itemized tooltips');
  has(sb1, 'Batch: ', 'BL: batch legend maps colors to names');
  has(sb1, 'Sales Knowledge Graph', 'BL: the candidate is named in the legend');
  delete G.data.projects[2].startDate; G.saveData();
  G.UI.capSim = {}; G.UI.capTab = 1;
  // exploration portfolio: Allocate Capital tab embeds the 3.3 core without the step apparatus
  G.UI.oxTab = 2;
  const oxa = G.renderOutExploreEnhanced();
  has(oxa, 'Sandbox', 'OXA: sandbox reachable from the portfolio');
  has(oxa, 'Commit & Advance', 'OXA: commit tab reachable from the portfolio');
  has(oxa, 'The standing baseline', 'OXA: baseline charts render there too');
  ok(oxa.indexOf('saveDoneAlloc') < 0, 'OXA: no step done-button on the portfolio surface');
  ok(oxa.indexOf('V-3.3.1') < 0, 'OXA: no step video on the portfolio surface');
  G.UI.oxTab = 1;
  has(G.renderOutExploreEnhanced(), 'Structured Portfolio (', 'OXA: tab 1 is the structured portfolio');
})();

/* ── SEED PLANS FOR COMMITTED ITEMS (Paul's go, July 5) ─────── */
(function(){
  // New plans for 0/11/12 supersede their simple estimates with IDENTICAL category totals,
  // so the committed ledger holds. Hand checks: 0 dev 110+60=170; 11 dev 85+120=205; 12 dev 80.
  eq(G.devCost(0), 170000, 'SD: Triage plan dev total equals the superseded estimate');
  eq(G.opsRolloutCost(0), 50000, 'SD: Triage rollout total held');
  eq(G.bpSusOpYear(0, 1), 60000, 'SD: Triage sustainment rate held (35+25) \u2013 full rate from rollout\u2019s end');
  eq(G.devCost(11), 205000, 'SD: Procurement plan dev total equals the superseded estimate');
  eq(G.opsRolloutCost(11), 55000, 'SD: Procurement rollout total held');
  eq(G.bpSusOpYear(11, 1), 70000, 'SD: Procurement sustainment rate held (40+30) \u2013 full rate from rollout\u2019s end');
  eq(G.devCost(12), 80000, 'SD: Invoice plan dev total equals the superseded estimate');
  eq(G.opsRolloutCost(12), 10000, 'SD: Invoice rollout total held');
  eq(G.bpSusOpYear(12, 1), 25000, 'SD: Invoice sustainment rate held \u2013 full rate from rollout\u2019s end');
  // Doctrine conformance: every committed plan starts sustainment the month rollout ends (continuity ruled July 5)
  [0,1,4,11,12,13].forEach(i => eq(G.bpSusStartOpYear(i), 1, 'SD: item ' + i + ' sustainment continuous from rollout\u2019s end'));
  eq(G.capCommitments().total, 3246249, 'SD: the committed ledger is unmoved by the reshape (single-model constant)');
  // a plan may leave a gap between rollout and sustainment; it draws as a labeled, neutral bridge (continuity ruled July 5)
  const _g0 = G.data.budgetPlans[0].sus[0].from; G.data.budgetPlans[0].sus[0].from = '29'; G.saveData();
  const sw = G.orgSwimlanes();
  has(sw, 'nothing charted between the end of rollout and the start of sustainment', 'SD: a user-authored gap draws the bridge on the lanes');
  has(sw, 'thin bar = a gap the plan leaves', 'SD: bridge named in the legend');
  G.data.budgetPlans[0].sus[0].from = _g0; G.saveData();
  eq(G.bpSusStartOpYear(0), 1, 'SD: seed restored to continuity after the gap probe');
})();

/* ── BUDGET ENVELOPE (chunk 2) ──────────────────────────────── */
(function(){
  eq(G.envYearsOf(), 3, 'ENV: seed horizon is 3 years');
  eq(G.envBudgetYear(1), G.costNum(G.data.capital.aiBudget), 'ENV: year 1 is the live annual budget');
  eq(G.envBudgetYear(2), 2600000, 'ENV: seed year 2');
  eq(G.envBudgetYear(3), 2800000, 'ENV: seed year 3');
  // saves ride the cap singleton path and re-render on blur
  const realRender = G.render; let calls = 0; G.render = function(){ calls++; };
  const prev = G.data.capital.budgetY2;
  G.fldSave('cap_budgetY2', '$4M');
  eq(G.data.capital.budgetY2, '$4M', 'ENV: year box saves');
  ok(calls >= 1, 'ENV: blur on a year box re-renders the strip');
  calls = 0; G.fldSave('cap_budgetY2', '$4.1M', true);
  eq(calls, 0, 'ENV: live keystrokes do not re-render');
  G.data.capital.budgetY2 = prev; G.render = realRender; G.saveData();
  // strip renders on both surfaces; horizon selector honored
  const t1 = G.renderStepCap();
  has(t1, 'Year 1 budget', 'ENV: year fields on Plan Capacity, year 1 first');
  has(t1, 'cap_budgetY2', 'ENV: year-2 box on tab 1');
  ok(t1.indexOf('costEcho_bY3') < 0, 'ENV: year echoes retired');
  ok(t1.indexOf('cap_budgetY4') < 0, 'ENV: 3-year horizon hides year 4');
  G.UI.hubTab = 2; // envelope lives on the Plan & Funding tab (hub tabs, July 5)
  const hub = G.renderCapHub();
  has(hub, 'Year 1 budget', 'ENV: year fields on the Hub (single source, no duplicate annual box)');
  G.UI.hubTab = 0;
  const prevN = G.data.capital.envYears;
  G.data.capital.envYears = '5';
  const t5 = G.renderStepCap();
  has(t5, 'cap_budgetY5', 'ENV: 5-year horizon shows year 5');
  G.data.capital.envYears = prevN; G.saveData();
})();

/* ── MULTI-YEAR PROJECTION (chunk 3) ────────────────────────── */
// Per-year accessors: profile placement where profiled, simple shape otherwise
(function(){
  eq(G.prjDevYear(13,1), 200000, 'PRJ: planned dev lands per its month placement');
  eq(G.prjDevYear(13,2), 0, 'PRJ: no dev money in later years');
  eq(G.prjRollYear(13,2), 190000, 'PRJ: planned rollout spreads through its covered period (the 4-month wave, months 13\u201316, sits wholly in year 2 \u2013 reshaped July 7)');
  eq(G.prjSusYear(13,2), 93333, 'PRJ: sustainment prorates in its start year (months 17\u201324 = 8 of 12 at 140K \u2013 reshaped July 7)');
  eq(G.prjSusYear(13,3), 140000, 'PRJ: steady state from project year 3');
  eq(G.prjDevYear(11,1), 205000, 'PRJ: simple dev lands in year 1');
  eq(G.prjRollYear(11,1), 31429, 'PRJ: planned rollout year-1 slice (8 of 14 months of $55K \u2013 plan added July 5)');
  eq(G.prjDevYear(11,2), 0, 'PRJ: simple dev is one-off');
  eq(G.prjSusYear(11,1), 0, 'PRJ: no sustainment in year 1');
  eq(G.prjSusYear(11,4), 70000, 'PRJ: simple sustainment holds steady state');
})();
// Calendar per-year totals under controlled anchors (supersedes the retired capProjection)
(function(){
  const _sbp={};[0,11,12].forEach(i=>{_sbp[i]=G.data.budgetPlans[i];delete G.data.budgetPlans[i]});G.data.capStale=true; // seed plans (July 5) stashed: this block tests the no-plan path
  const cap0 = JSON.parse(JSON.stringify(G.data.capital));
  const set = G.orgCommittedSet();
  const savedA = {}; set.forEach(e => { savedA[e.i] = (G.data.projects[e.i] || {}).advancedAt; });
  const ld0 = G.data.opsData[0].launchDate;
  G.data.capital.periodStart = '2026-01-01';
  G.data.projects[11].advancedAt = Date.parse('2025-01-01'); // parked out of the window
  G.data.projects[12].advancedAt = Date.parse('2026-06-01');
  G.data.projects[13].advancedAt = Date.parse('2026-03-01');
  G.data.projects[1].advancedAt = Date.parse('2026-01-01');
  G.data.projects[4].advancedAt = Date.parse('2026-01-01');
  G.data.projects[0].advancedAt = Date.parse('2026-01-01');
  G.data.opsData[0].launchDate = '2026-02-01';
  const yt = G.orgYearTotals();
  eq(yt.length, 3, 'PRJ: one reading per envelope year');
  const near = (x, y, tol, label) => ok(Math.abs(x - y) <= (tol || 1), label + ' (got ' + x + ')');
  near(yt[0].dev, 1180000, 1, 'PRJ: year-1 development on the calendar (580 + 150 + 200 + 170 lump + 80 lump, gross \u2013 offsets retired July 4; a dev-stage item\u2019s undated rollout does not chart)');
  near(yt[0].roll, 315000, 1, 'PRJ: year-1 rollout on the calendar (180,000 + 45,000 + 40,000 + 50,000 \u2013 item 4\u2019s wave now 2 of 4 months in year 1; reshaped July 7)');
  eq(yt[0].sus, 0, 'PRJ: year-1 sustainment is zero by construction');
  near(yt[0].total, 1495000, 2, 'PRJ: year-1 total (gross; 1,180,000 dev + 315,000 roll)');
  eq(yt[0].budget, 2400000, 'PRJ: year-1 capacity from the envelope');
  near(yt[0].headroom, 905000, 2, 'PRJ: year-1 headroom (gross; 2,400,000 \u2212 1,495,000)');
  ok(yt[0].budgetSet && yt[1].budgetSet && yt[2].budgetSet, 'PRJ: envelope years flagged as set');
  ok(yt[2].sus > 0 && yt[2].dev === 0, 'PRJ: year 3 carries no development');
  eq(yt[2].roll, 0, 'PRJ: no year-3 rollout \u2013 continuity now comes from early sustainment, not stretched tails (reshaped July 7)');
  eq(yt[2].susShare, 1, 'PRJ: year 3 is pure sustainment under these anchors (490,000 of 490,000: 180K + 110K + 140K full years + item 0\u2019s simple 60K \u2013 reshaped July 7)');
  yt.forEach(r => eq(r.headroom, r.budget - r.total, 'PRJ: headroom = capacity \u2212 total (year ' + r.y + ')'));
  // killed items leave the calendar
  if(!G.data.tracking) G.data.tracking = {};
  const snapT = JSON.parse(JSON.stringify(G.data.tracking[12]||{}));
  G.data.tracking[12] = Object.assign({}, snapT, {status:'killed'});
  near(G.orgYearTotals()[0].total, 1415000, 2, 'PRJ: killing item 12 removes its month-6 lump (gross base; 1,495,000 \u2212 80,000)');
  G.data.tracking[12] = snapT;
  G.data.capital = JSON.parse(JSON.stringify(cap0));
  set.forEach(e => { if (G.data.projects[e.i]) G.data.projects[e.i].advancedAt = savedA[e.i]; });
  G.data.opsData[0].launchDate = ld0;
  G.saveData();
  [0,11,12].forEach(i=>{if(_sbp[i]!==undefined)G.data.budgetPlans[i]=_sbp[i]});G.data.capStale=true;G.saveData(); // seed plans restored
})();

/* ── CAPITAL ANALYTICS (chunk 4) ────────────────────────────── */
(function(){
  ok(typeof G.phaseStrip === 'undefined', 'AN: phaseStrip retired with the Phase Timelines card (chunk N)');
  // the analytics surface
  const an = G.renderCapAnalytics();
  has(an, 'Capacity Waterfall', 'AN: the waterfall card renders');
  has(an, 'Cumulative vs Capacity', 'AN: the cumulative card renders');
  has(an, 'Overviews by Year', 'AN: the year overviews render (retitled \u2013 Paul, July 5)');
  has(an, 'HEADROOM', 'AN: headroom column in the year readings table');
  has(an, 'Committed = Development', 'AN: the sub-line names itself as the committed split (July 4)');
  has(an, 'of the year\u2019s budget \u2013 cap', 'AN: crowding-out reads sustainment against the year budget, per the cap');
  has(an, 'NET OF RESERVE', 'AN: year readings carry labeled columns (July 4 redesign)');
  // 4.4 review card: flat-slice headroom replaced by the running annual position (Paul ratified, July 4)
  const r44 = G.renderStep44();
  ok(r44.indexOf('Budget slice') < 0, 'AN: the flat quarterly slice is gone from the review card');
  has(r44, 'Committed consumption, this period', 'AN: the period consumption figure stays');
  has(r44, 'Committed, Year 1', 'AN: running annual position \u2013 committed of budget');
  has(r44, 'Headroom, Year 1', 'AN: running annual position \u2013 year headroom');
  has(an, 'available budget that can still be assigned', 'AN: headroom glossed via the asterisk footnote (Paul wording, July 5)');
  ok(an.indexOf('divided evenly across twelve months') < 0, 'AN: the flat monthly capacity line is retired from the waterfall (Paul ruling, July 5)');
  has(an, 'run-cost ceiling for the year, at its monthly rate', 'AN: the dashed cap line survives with its rate-vs-rate gloss');
  ok(an.indexOf('Multi-Year Projection vs Envelope') < 0, 'AN: the projection card is retired');
  const hub = G.renderCapHub();
  has(hub, 'Capacity Waterfall', 'AN: the calendar charts live on the Hub');
  // the old timing block is gone from the cards
  G.UI.expanded['oe13'] = true;
  const dev = G.renderOutExpbriefsFull();
  ok(dev.indexOf('PHASE TIMING') < 0, 'AN: the separate timing block is gone');
  G.UI.expanded['oe13'] = false;
})();

/* ── COPY PASS (chunk 5) ────────────────────────────────────── */
(function(){
  const c = G.CAROUSEL_CONTENT['3.3'][1].bullets;
  has(c[0].text, 'development, rollout, and sustainment costs', 'COPY: the Sandbox bullet speaks the three fields');
  has(c[1].text, 'assumed start date', 'COPY: the commit bullet states the anchor');
  has(G.CAROUSEL_CONTENT['3.2'][1].body, 'one-to-five-year horizon', 'COPY: the envelope teaching lives on the capacity carousel (copy pass July 9)');
  G.UI.expanded['fyhelp32'] = true;
  const t1 = G.renderStepCap();
  ok(t1.indexOf('Dates and Fiscal Calculations') < 0, 'COPY: the alloc fold is gone whole \u2013 its surviving truths move to the Help tab (TODOS)');
  ok(true, 'COPY: start-year nuance moved out with the fold; the doctrine line lives in the engine comment and the Help-tab TODO');
  G.UI.capTab = 2;
  const tAl = G.renderStepAlloc();
  ok(tAl.indexOf('commits its entire planned spend') < 0, 'COPY: the note stays behind the folds until opened');
  G.UI.expanded['acRef'] = true; G.UI.expanded['csNotes'] = true;
  const nf = G.renderStepAlloc();
  has(nf, 'commits its entire planned spend from the moment it is advanced', 'COPY: the Notes fold states the single-model doctrine (Paul\u2019s wording, July 6)');
  has(nf, 'releases funds for phases that have not yet begun back to the budget', 'COPY: the kill sentence keeps committed/released vocabulary consistent (Paul, July 6)');
  G.UI.expanded['csNotes'] = false; G.UI.expanded['acRef'] = false;
  G.UI.expanded['fyhelp32'] = false;
  G.UI.expanded['oo4'] = true;
  const ops = G.renderOutOperFull();
  ok(G.renderOutOperFull().indexOf('Both feed Committed Sums') < 0, 'COPY: the feed-Committed-Sums sentence and its red box are gone from the ops card (Paul, July 7); the timing nuance lives in the derived echoes and 3.3');
  G.UI.expanded['oo4'] = false;
})();

/* ── CONSISTENCY FIXES (post-chunk sweep) ───────────────────── */
(function(){
  // archived list shows the committed figure, not the raw estimate
  if(!G.data.archivedItems) G.data.archivedItems = {};
  const snap = JSON.parse(JSON.stringify(G.data.archivedItems));
  G.data.archivedItems[11] = {stage:'Development'};
  G.UI.hubTab = 1; // archived list lives on the Commitments tab (hub tabs, July 5)
  const hub = G.renderCapHub();
  has(hub, 'Archived \u2013 costs no longer committed', 'FIX: archived card renders');
  has(hub, '$205K', 'FIX: archived figure is the committed Development Costs');
  G.UI.hubTab = 0;
  G.data.archivedItems = snap; G.saveData();
})();

/* ── HUB TABS (Paul ruling, July 5): dashboard / commitments / plan & funding ── */
(function(){
  G.UI.hubTab = 0;
  const d = G.renderCapHub();
  ['Dashboard','Commitments','Plan & Funding'].forEach(t => has(d, t, 'HT: tab strip offers ' + t));
  has(d, 'The Quarterly Review', 'HT: quarterly-review section sits on the dashboard tab (retitled July 5)');
  has(d, 'a way of reading the plan, not budgets', 'HT: plain-language framing \u2013 quarters read the plan, never cap it (July 5)');
  has(d, 'one quarter of the annual budget is', 'HT: even-spread comparison in plain language (July 5)');
  ok(d.indexOf('Quarterly budget slice') < 0, 'HT: the old slice label is gone from the Hub');
  has(d, 'Capacity Waterfall', 'HT: the chart suite leads the dashboard tab');
  ok(d.indexOf('Committed Sums') < 0 && d.indexOf('Funding Plan') < 0, 'HT: ledger and funding live off the dashboard tab');
  ok(G.renderCapAnalytics().indexOf('Quarter Runway') < 0, 'HT: the runway left the analytics suite for the ghetto');
  G.UI.hubTab = 2;
  const pf = G.renderCapHub();
  has(pf, 'Budget Envelope', 'HT: envelope card on Plan & Funding');
  has(pf, 'Single source with Step 3.2', 'HT: envelope names its single source');
  has(pf, 'Funding Plan', 'HT: funding plan card on Plan & Funding (line items \u2013 Paul, July 5)');
  G.UI.hubTab = 0;
  G.UI.expanded['acRef'] = true; // the fiscal-context cell lives behind the reference fold (allocCore)
  const al = G.renderStepAlloc();
  ok(G.renderStepAlloc().indexOf('Level pace: ') < 0, 'HT: the level-pace line retired with the duplicate reference card (July 6)');
  ok(al.indexOf('Quarterly budget slice') < 0, 'HT: old label gone from Allocate Capital too');
  G.UI.expanded['acRef'] = false;
})();


/* ── PG: development-program kill calculus (P1, July 5) ──────
   Doctrine (Paul ruling): money enters a phase at its start month
   (or when marked running/complete or its gate is taken) and does
   not come back; a kill releases every phase not yet entered;
   entered phases stay committed and charted, frozen at kill time
   (killSunkIds). Plan-less kills still release everything.
   Controlled clock: periodStart 2026-01-01, item 13 advanced
   2026-06-01 -> anchor 6; run date July 2026 -> program month 7 ->
   plan month 2. bp13a (m1-3, $50K) entered; bp13b (m3-9, $150K) not.
   Hand-derived ledger: 1,975,000 - 200,000 (item 13 dev commit)
   + 50,000 (entered phase held) = 1,825,000. */
{
  const snapTrk = JSON.stringify(G.data.tracking[13] || {});
  const snapPrj = JSON.stringify(G.data.projects[13] || {});
  const snapPS = G.data.capital.periodStart;
  const snapKR = G.data.capital.killRows;
  const snapStale = G.data.capStale;
  G.data.capital.periodStart = '2026-01-01';
  G.data.projects[13].advancedAt = Date.parse('2026-06-01');
  delete G.data.projects[13].startDate;

  const baseP = G.capCommitments().total;
  const w13 = G.capProjectWindow(13, null).inW;
  const prev = G.killReleasePreview(13);
  eq(prev.sunk, 0, 'PG: STATUS BASIS (Paul, July 7) \u2013 no phase marked begun, nothing held; the plan clock no longer enters phases');
  eq(prev.released, w13, 'PG: with nothing begun, the whole in-window plan comes back \u2013 development, rollout, and sustainment');
  ok(prev.phases.length === 2 && prev.phases[0].entered === false && prev.phases[1].entered === false, 'PG: entered flags are false until work is marked begun');

  const rows13 = G.bpRows(13, 'dev');
  rows13[1].pstatus = 'running';
  eq(G.killReleasePreview(13).sunk, 150000, 'PG: a running mark alone enters a phase (bp13b, $150K)');
  delete rows13[1].pstatus;

  rows13[0].pstatus = 'running'; // bp13a begun in fact \u2013 the freeze chain below holds it
  G.fldSave('trk_13_status', 'killed', true);
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'PG: kill freezes the entered set at kill time');
  eq(G.killSunkDev(13), 50000, 'PG: sunk development derives from the frozen ids');
  const com = G.capCommitments();
  eq(com.total, baseP - w13 + 50000, 'PG: ledger = base \u2212 full in-window plan + entered phase held (relative, single model)');
  const row13 = com.rows.filter(r => r.i === 13)[0];
  ok(!!row13 && /entered phases held/.test(row13.label || ''), 'PG: ledger row names the held phases');
  ok(G.orgCommittedSet().some(e => e.i === 13 && e.sunk === true), 'PG: committed set carries the sunk marker');
  const ser = G.orgProjectMonthly(13, false, 36, 1, true);
  let sd13 = 0, srs = 0;
  for (let m = 0; m < 36; m++) { sd13 += ser[m].dev; srs += ser[m].roll + ser[m].sus; }
  eq(Math.round(sd13), 50000, 'PG: sunk series charts only the entered phase');
  eq(srs, 0, 'PG: sunk series carries no rollout or sustainment');

  const kp0 = G.costNum(G.data.capital.killCosts);
  G.data.capital.killRows = [{ d: 'Contractor exit - Visual QC', a: '$25K' }];
  eq(G.killPotTotal(), kp0 + 25000, 'PG: pot = legacy figure + line items');
  eq(G.capAvailable().killPot, kp0 + 25000, 'PG: capAvailable deducts the line-item pot');

  G.fldSave('trk_13_status', '', true);
  ok(!G.data.tracking[13].killSunkIds, 'PG: un-killing via status clears the frozen set');
  eq(G.capCommitments().total, baseP, 'PG: ledger restores to the pre-kill base');

  G.fldSave('trk_13_status', 'killed', true);
  const rr = G.render; G.render = function () {};
  try { G.reviveProject(13); } finally { G.render = rr; }
  ok(!G.data.tracking[13].killSunkIds && G.data.tracking[13].status === '', 'PG: reviveProject clears status and the frozen set');

  delete G.bpRows(13, 'dev')[0].pstatus;
  G.data.tracking[13] = JSON.parse(snapTrk);
  G.data.projects[13] = JSON.parse(snapPrj);
  G.data.capital.periodStart = snapPS;
  if (snapKR === undefined) delete G.data.capital.killRows; else G.data.capital.killRows = snapKR;
  G.data.capStale = snapStale;
  G.saveData();
}


/* ── S34: Define Development Program (P2, July 5) ───────────
   One list, two lenses: phases ARE the plan's dev rows; this page
   adds the contract (owner/metric/exit criteria via bpRowSave).
   Done-bar: every advanced project contracted = every dev row
   funded + all three contract fields. Unfunded template rows
   deliberately block done and don't flip the simple estimate. */
(function(){
  const snapStale = G.data.capStale;
  const r13 = G.bpRows(13, 'dev');
  const st13 = r13.map(function(r){ return { po: r.powner, pm: r.pmetric, px: r.pexit }; });
  r13.forEach(function(r){ delete r.powner; delete r.pmetric; delete r.pexit; });
  const pg = G.renderStepExp();
  has(pg, 'Step 4: Map Development Track', 'S34: step retitled');
  has(pg, 'Project Development Program', 'S34: program header white and renamed (Paul, July 6)');
  has(pg, 'Delete phase', 'S34: labeled delete control on each phase card (Paul, July 6)');
  ok(typeof G.pgDelPhase==='function', 'S34: phase delete goes through the confirm guard');
  has(pg, 'bps_13_dev_bp13a_name', 'S34: phase money rows reuse the plan-editor ids');
  has(pg, 'pgf_13__bp13a__powner', 'S34: contract fields carry pgf ids');
  has(pg, 'Exit gate criteria', 'S34: exit criteria labeled as the gate (Paul, July 6)');
  has(pg, 'calculated from these phases', 'S34: committed-sum advisory \u2013 accurate live-recalculation wording (July 7)');
  has(pg, 'review headroom at Allocate Capital (Step 3.3)', 'S34: the advisory still points at headroom');
  ok(pg.indexOf('gates release') < 0 && pg.indexOf('STAGE GATES') < 0, 'S34: gate-release tranches retired from 3.4 (absorbed by phase contracts)');
  ok(pg.indexOf('ic33') < 0 && pg.indexOf('pc33') < 0, 'S34: fossil keys retired with the rebuild');
  has(pg, 'Development Track Set \u2014 Ready for Phase 4', 'S34: done bar uses the track vocabulary (Paul, July 7)');
  has(pg, 'phases defined', 'S34: mid-state badge shows once phases exist but gates are unfilled (Paul, July 6)');
  ok(!G.progContracted(13), 'S34: funded phases alone are not a contract');
  r13.forEach(function(r){ r.powner = 'Maya Chen'; r.pmetric = 'Defect catch-rate \u2265 95%'; r.pexit = 'Four clean weeks on line A'; });
  ok(G.progContracted(13), 'S34: budget + owner + metric + exit criteria = contracted');
  has(G.renderStepExp(), '>gates defined<', 'S34: card badge reads gates defined when every phase contract is complete (Paul, July 6)');
  r13.forEach(function(r, x){ if (st13[x].po === undefined) delete r.powner; else r.powner = st13[x].po;
    if (st13[x].pm === undefined) delete r.pmetric; else r.pmetric = st13[x].pm;
    if (st13[x].px === undefined) delete r.pexit; else r.pexit = st13[x].px; });
  // template path on a stashed plan: creation seeds phases without money
  const p11 = G.data.budgetPlans[11]; delete G.data.budgetPlans[11];
  G.addProgDefault(11);
  eq(G.bpRows(11, 'dev').length, 2, 'S34: two-phase default seeds two phases');
  eq(G.bpRows(11, 'dev')[0].name, 'Design & build experiment', 'S34: default keeps the module\u2019s experiment path');
  ok(!G.bpHasDev(11), 'S34: unfunded template phases do not outrank the simple estimate');
  G.addProgPhase(11, 3);
  eq(G.bpRows(11, 'dev')[2].name, 'Pilot', 'S34: template names the added phase');
  ok(!G.progContracted(11), 'S34: unfunded phases block the contract');
  if (p11 === undefined) delete G.data.budgetPlans[11]; else G.data.budgetPlans[11] = p11;
  G.data.capStale = snapStale;
  G.saveData();
})();

/* ── PD: program dashboard on the Development portfolio (P3) ─
   Controlled clock as in PG. Seam advisory in the formal register
   (Paul ruling, July 5); kill intercepted by the inline confirm
   panel; gates are decision records; the terminal gate's Go is the
   launch decision (opens the existing launch confirm). */
(function(){
  const snapTrk = JSON.stringify(G.data.tracking[13] || {});
  const snapPrj = JSON.stringify(G.data.projects[13] || {});
  const snapPS = G.data.capital.periodStart;
  const snapKR = G.data.capital.killRows;
  const snapStale = G.data.capStale;
  const snapLaunched = (G.data.launched || []).length;
  G.data.capital.periodStart = '2026-01-01';

  // seam advisory: plan month 4, phase 2 open, phase 1 gate untaken
  G.data.projects[13].advancedAt = Date.parse('2026-04-01');
  delete G.data.projects[13].startDate;
  G.UI.expanded['oe13'] = true;
  G.bpRows(13,'dev').forEach(function(r){ if(r) G.UI.expanded['phx_13_'+r.id] = true; }); // phase bars collapse by default since July 6
  let rd = G.renderOutExpbriefsFull();
  has(rd, 'Development Phases', 'PD: phase dashboard section renders on the card (Paul, July 6)');
  has(rd, 'Camera trials', 'PD: phases come from the plan rows (name is HTML-escaped, so pin the unambiguous prefix)');
  has(rd, 'EXIT GATE DECISION', 'PD: undecided phase shows the open gate panel (default-open \u2013 Paul, July 6)');
  has(rd, '0/2 phases', 'PD: collapsed strip counts progress');
  has(rd, 'devStatusSave(13', 'PD: status select routes through the kill intercept');
  has(rd, 'overlap is intentional', 'PD: seam advisory in plain English (Paul, July 6)');
  ok(rd.indexOf('gates release') < 0 && rd.indexOf('CAPITAL & GATES') < 0, 'PD: gate-release tranches retired from the card');

  // kill intercept + confirm panel figures: plan month 2 (bp13a entered only)
  G.data.projects[13].advancedAt = Date.parse('2026-06-01');
  G.bpRows(13, 'dev')[0].pstatus = 'running'; // status basis: held requires a begun phase (July 7)
  G.devStatusSave(13, { value: 'killed' });
  ok(G.UI.expanded['kp13'] === true && (G.data.tracking[13] || {}).status !== 'killed', 'PD: choosing Killed opens the panel without killing');
  rd = G.renderOutExpbriefsFull();
  has(rd, 'CONFIRM KILL', 'PD: kill confirm panel renders');
  has(rd, 'Killing releases', 'PD: panel shows the released figure');
  has(rd, 'stay committed and charted', 'PD: panel shows the held doctrine');
  has(rd, 'kill & phase-out pot', 'PD: panel offers the pot line');
  const kr0 = (G.data.capital.killRows || []).length;
  G.document.getElementById('kd_13').value = 'Contractor exit';
  G.document.getElementById('ka_13').value = '$25K';
  G.progKillConfirm(13);
  G.document.getElementById('kd_13').value = '';
  G.document.getElementById('ka_13').value = '';
  eq((G.data.tracking[13] || {}).status, 'killed', 'PD: confirm executes the kill');
  delete G.bpRows(13, 'dev')[0].pstatus; // clean the status-basis mark
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'PD: confirm stamps the entered set');
  const krows = G.data.capital.killRows || [];
  eq(krows.length, kr0 + 1, 'PD: the pot question lands as a line item');
  ok(/^Contractor exit \u2013 /.test((krows[krows.length - 1] || {}).d || ''), 'PD: pot line is project-tagged');
  eq((krows[krows.length - 1] || {}).a, '$25K', 'PD: pot line carries the amount');
  ok(G.UI.expanded['kp13'] === false, 'PD: panel closes on confirm');
  G.fldSave('trk_13_status', '', true);

  // gate kill-routing stamps the phase on confirm
  G.progGate(13, 'bp13a', 'kill');
  eq(G.UI.expanded['kp13'], 'bp13a', 'PD: a gate Kill routes to the confirm panel carrying the phase');
  G.progKillConfirm(13);
  eq(G.bpRows(13, 'dev')[0].gateDec, 'kill', 'PD: confirming a gate kill stamps the phase');
  eq((G.data.capital.killRows || []).length, kr0 + 1, 'PD: empty pot inputs add no phantom line');
  G.fldSave('trk_13_status', '', true);
  const r13 = G.bpRows(13, 'dev');
  r13.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; delete r.pgnote; });

  // gates as decision records; terminal Go is the launch decision
  G.progGate(13, 'bp13a', 'go');
  eq(r13[0].gateDec, 'go', 'PD: Go stamps the gate');
  eq(r13[0].pstatus, 'complete', 'PD: Go completes the phase');
  ok(!G.UI.expanded['lp13'], 'PD: a non-terminal Go does not launch');
  G.progGate(13, 'bp13b', 'hold');
  eq(r13[1].gateDec, 'hold', 'PD: Hold recorded');
  G.progGateClear(13, 'bp13b');
  ok(!r13[1].gateDec, 'PD: retake clears the record');
  G.progGate(13, 'bp13b', 'go');
  eq((G.data.tracking[13] || {}).status, 'complete', 'PD: terminal Go completes the project');
  ok(G.UI.expanded['lp13'] === true, 'PD: terminal Go opens the launch confirm');
  eq((G.data.launched || []).length, snapLaunched, 'PD: launch still waits for the existing confirm');

  // restore
  r13.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; delete r.pgnote; });
  G.data.tracking[13] = JSON.parse(snapTrk);
  G.data.projects[13] = JSON.parse(snapPrj);
  G.data.capital.periodStart = snapPS;
  if (snapKR === undefined) delete G.data.capital.killRows; else G.data.capital.killRows = snapKR;
  G.data.capStale = snapStale;
  G.UI.expanded['oe13'] = false; G.UI.expanded['kp13'] = false; G.UI.expanded['lp13'] = false;
  G.saveData();
})();

/* ── R41: Run Development Track (P4, July 5) ──────────────────────
   Armed-machine done bar: gates cannot be scheduled, readiness
   can. State-controlled (stash/restore contract fields) so later
   seed changes cannot break these pins. */
(function(){
  G.UI.expanded['re41_13'] = true; // 4.1 collapses armed cards by default since the July 6 dashboard rebuild
  const pg = G.renderStep41();
  has(pg, 'Step 1: Run Development Track', 'R41: step retitled (Map/Run Development Track \u2013 Paul, July 5)');
  has(G.renderStep41(), 'Gates Current \u2014 Nothing Overdue', 'R41: done bar in overdue language (Paul, July 7 \u2013 the set-gate condition was vacuous after 3.4)');
  has(pg, 'Infrastructure learnings', 'R41: dual-purpose tracking survives the rebuild');
  has(pg, 'phases complete', 'R41: header carries the plain x-of-y phase count (manual status select removed \u2013 Paul, July 6; kill intercept still pinned on the data-bank card in PD)');
  const r13 = G.bpRows(13, 'dev');
  const stash = r13.map(function(r){ return { po: r.powner, px: r.pexit }; });
  r13.forEach(function(r){ delete r.powner; delete r.pexit; });
  ok(!G.progArmed(13), 'R41: an unowned next gate is not armed');
  ok(G.progNextGate(13) === r13[0], 'R41: next gate = earliest ungated, uncompleted phase');
  has(G.renderStep41(), 'not yet set', 'R41: unset-gate advisory in set language (Paul, July 6)');
  r13[0].powner = 'Maya Chen'; r13[0].pexit = 'Four clean weeks on line A';
  ok(G.progArmed(13), 'R41: dates + owner + exit criteria on the next gate arm the program');
  r13[0].gateDec = 'go'; r13[0].pstatus = 'complete';
  ok(G.progNextGate(13) === r13[1], 'R41: a taken gate advances the next-gate pointer');
  ok(!G.progArmed(13), 'R41: the pointer moves and the new next gate must be owned too');
  r13[1].gateDec = 'go'; r13[1].pstatus = 'complete';
  ok(G.progArmed(13) && G.progNextGate(13) === null, 'R41: all gates taken \u2192 armed, terminal Go pending');
  r13.forEach(function(r, x){ delete r.gateDec; delete r.gateAt; delete r.pstatus;
    if (stash[x].po === undefined) delete r.powner; else r.powner = stash[x].po;
    if (stash[x].px === undefined) delete r.pexit; else r.pexit = stash[x].px; });
  const snapTrk = JSON.stringify(G.data.tracking[13] || {});
  G.fldSave('trk_13_status', 'killed', true);
  ok(G.progArmed(13), 'R41: killed programs do not block the armed bar');
  G.data.tracking[13] = JSON.parse(snapTrk);
  G.saveData();
})();

/* ── SP: Aurora seed programs (P5, July 5) ──────────────────
   Contracts recycled from existing seed material: owners from the
   experiment briefs, exit criteria absorbed from the retired
   gateRows, metrics derived from the brief success metrics. */
ok(G.progContracted(11) && G.progContracted(12) && G.progContracted(13), 'SP: seed development programs are contracted');
ok(G.progContracted(0), 'SP: item 0 carries a contracted program (its Buy path is preserved)');
ok(G.progArmed(13) && G.progArmed(11) && G.progArmed(12), 'SP: seed programs arm the 4.1 machine');
ok(!((G.data.capAlloc || {})[13] || {}).gateRows, 'SP: seed gateRows absorbed into phase exit criteria');
has(G.bpRows(13, 'dev')[1].pexit, 'Pilot detection', 'SP: gate criteria live on the phases now');
eq(G.capCommitments().total, 3246249, 'SP: contract fields carry no money \u2013 the ledger holds at the single-model constant');

/* ── HZ: hub copy pass + chart zoom (Paul feedback, July 5) ── */
(function(){
  G.UI.hubTab = 0;
  const d = G.renderCapHub();
  ok(d.indexOf('against the capacity line') < 0, 'HZ: stale waterfall caption gone (the waterfall has no capacity line \u2013 verified in orgWaterfallChart)');
  has(d, 'stacked by category: Development, Rollout, Sustainment', 'HZ: waterfall caption describes what is drawn');
  has(d, 'Sustainment vs cap', 'HZ: KPI tile de-jargoned');
  has(d, '% of budget', 'HZ: per-year bars read as a share of budget');
  has(d, 'HEADROOM*', 'HZ: headroom carries the asterisk');
  has(d, 'an even-spread reference, not a limit', 'HZ: runway caption in plain language');
  ok(d.indexOf('a slice, not a schedule') < 0 && d.indexOf('is not slack') < 0, 'HZ: consultant-speak retired');
  has(d, "UI.chartZoom='wf'", 'HZ: enlarge control on the chart cards');
  G.UI.chartZoom = 'wf';
  const z = G.renderCapHub() + G.chartZoomOverlay(); // overlay now appended at the root composition point (July 5)
  has(z, '\u2715 Close', 'HZ: zoom overlay renders with a close control');
  ok(z.split('Capacity Waterfall').length >= 3, 'HZ: overlay carries a second, larger render of the chart');
  const hub2 = G.renderCapHub();
  has(hub2, 'Capital Planning <em>Hub</em>', 'HZ: hub renamed to Capital Planning Hub (Paul, July 5)');
  has(hub2, 'border-top:2px dashed var(--warn-text)', 'HZ: waterfall legend carries a dash sample for the cap line (tokenized with the warning register, July 10 \u2013 the sample now tracks the themed line in both modes)');
  has(hub2, 'Committed Costs by Category', 'HZ: category donut card renders beside the project donut (Paul, July 5)');
  const srs = G.orgMonthly(); let tt = 0;
  for (let m = 0; m < srs.length; m++) tt += srs[m].dev + srs[m].roll + srs[m].sus;
  var _ywc=G.UI.capYear;G.UI.capYear='T';const cat = G.orgCategoryDonut();G.UI.capYear=_ywc;
  has(cat, G.fmtMoney(Math.round(tt)), 'HZ: category donut center = the same whole-horizon total as the engine series');
  has(cat, 'Sustainment', 'HZ: category legend rows render');
  G.UI.chartZoom = 'cat';
  has(G.renderCapHub() + G.chartZoomOverlay(), '\u2715 Close', 'HZ: the category donut zooms like the others');
  G.UI.chartZoom = null;
})();

/* ── CT: Commitments-tab rework (Paul feedback, July 5) ────── */
(function(){
  G.UI.hubTab = 1;
  const t = G.renderCapHub();
  has(t, 'Committed Sums</h3>', 'CT: heading plain \u2013 asterisks retired (Paul, July 5)');
  ok(t.indexOf(' Notes</button>') < t.indexOf('DEVELOPMENT<'), 'CT: notes fold sits above the rows');
  ok(t.indexOf('if launched') < 0, 'CT: per-row \u201cif launched\u201d retired \u2013 nothing pends at launch (single model, July 6)');
  ok(t.indexOf('if all development projects launch') < 0, 'CT: the pending aggregate retired with the staged ledger');
  has(t, '>ANNUAL<', 'CT: sustainment splits into ANNUAL');
  has(t, '>OVER THE PROGRAM<', 'CT: and OVER THE PROGRAM sub-cells');
  has(t, 'title="Sustainment is charted from the month rollout ends"', 'CT: the charting rule moved into the tooltip');
  has(t, 'you will be offered the opportunity to add a line here automatically', 'CT: pot sentence per Paul dictation');
  has(t, 'Potential: Development', 'CT: exploration line capitalized');
  ok(t.indexOf('not yet committed') < 0, 'CT: no not-yet-committed language survives on the rows');
  has(t, 'charted from the month rollout ends', 'CT: operational rows name the committed sustainment stream');
  has(t, 'Exploration (potential projects, no financial commitments yet)', 'CT: exploration list retitled \u2013 parenthetical form matched across all three (Paul, July 5)');
  has(t, 'Operational (all costs committed)', 'CT: operational list retitled');
  has(t, ' Notes</button>', 'CT: notes fold present');
  ok(t.indexOf('held out of Available') < 0, 'CT: obscure pot phrasing retired');
  has(t, 'subtracted from the Available figure', 'CT: pot subtitle explains the deduction plainly');
})();

/* ── S0: quick-win seed enters sustainment at month 9 (Paul, July 5) ──
   Item 0's plan reshaped: rollout m3-8, sustainment from m9. Category
   totals unchanged, so the gross ledger holds; the PRJ/JQ/JB frames
   stash item 0's plan (no-plan path), so no hand-derived pin moves. */
eq(G.capCommitments().total, 3246249, 'S0: ledger unmoved by the item-0 reshape (category totals identical)');
eq(G.bpFirstOpMonth(0), 9, 'S0: item 0 first operational month is 9');
ok(G.bpRows(0,'roll')[0].to === '8' && G.bpRows(0,'sus')[0].from === '9', 'S0: rollout ends m8, sustainment opens m9 \u2013 continuous by construction');

/* ── FL: funding-plan lines + authorize/revoke (Paul ruling, July 5) ──
   Lines are funding SOURCES with a target year; Authorize is the auditable
   step that adds the amount to that year's envelope (getter sums base +
   authorized additions). Authorized lines are read-only until revoked. */
(function(){
  const cap0 = JSON.stringify(G.data.capital);
  const stale0 = G.data.capStale;
  eq(G.envBudgetYear(1), 2400000, 'FL: seed year-1 envelope is the base budget');
  const av0 = G.capAvailable().available;
  const hd0 = G.orgYearTotals()[0].headroom;
  G.flAdd();
  const ln = G.fundLines()[G.fundLines().length - 1];
  G.flSave(ln.id, 'd', 'Reallocate from the marketing automation line');
  G.flSave(ln.id, 'a', '$150K');
  G.flSave(ln.id, 'y', '1');
  eq(ln.st, 'planned', 'FL: new lines are planned, not yet money');
  eq(G.envBudgetYear(1), 2400000, 'FL: a planned line adds nothing to the envelope');
  G.flAuth(ln.id);
  eq(ln.st, 'auth', 'FL: authorize flips the status');
  ok(!!ln.at, 'FL: authorization is stamped');
  eq(G.envBudgetYear(1), 2550000, 'FL: the year-1 envelope now sums base + authorized addition');
  eq(G.capAvailable().available, av0 + 150000, 'FL: Available rises by the authorized amount');
  eq(G.orgYearTotals()[0].headroom, hd0 + 150000, 'FL: year-1 headroom rises with it');
  G.flSave(ln.id, 'a', '$1M');
  eq(ln.a, '$150K', 'FL: authorized lines are read-only (revoke to edit)');
  const _n0 = G.fundLines().length;
  G.flDel(ln.id);
  eq(G.fundLines().length, _n0, 'FL: authorized lines cannot be deleted');
  eq(G.fundLines().filter(x => x.st === 'planned').length, 3, 'FL: the three seed lines arrive planned (legacy texts converted, July 5)');
  ok(!(G.data.capital.reallocation || '').trim() && !(G.data.capital.gapPlan || '').trim(), 'FL: legacy free-texts emptied in the seed');
  G.UI.hubTab = 2;
  const pf = G.renderCapHub();
  has(pf, 'added to Year 1', 'FL: authorized line names where the money went');
  has(pf, 'Authorized additions now in the budget: Year 1 +$150K', 'FL: card totals the authorized additions');
  has(G.renderStepCap ? G.renderStepCap() : '', 'authorized funding-plan additions', 'FL: 3.2 names the composition beside the base fields');
  G.flRevoke(ln.id);
  eq(ln.st, 'planned', 'FL: revoke returns the line to planned (confirm stubbed true)');
  eq(G.envBudgetYear(1), 2400000, 'FL: the envelope drops back on revoke');
  G.flAdd();
  const ln2 = G.fundLines()[G.fundLines().length - 1];
  G.flAuth(ln2.id);
  eq(ln2.st, 'planned', 'FL: an empty line cannot be authorized');
  G.flSave(ln.id, 'y', '2');
  G.flAuth(ln.id);
  eq(G.fundAddsYear(2), 150000, 'FL: additions target their own year');
  eq(G.fundAddsYear(1), 0, 'FL: year 1 carries none of it');
  G.data.capital = JSON.parse(cap0);
  G.data.capStale = stale0;
  G.saveData();
})();

/* ── PN: pause guidance follows the control (Paul, July 5) ────── */
(function(){
  if(!G.data.tracking) G.data.tracking = {};
  const t0 = JSON.parse(JSON.stringify(G.data.tracking[11]||{}));
  G.data.tracking[11] = Object.assign({}, t0, {status:'paused'});
  G.UI.expanded['re41_11'] = true; // open the collapsed-by-default card
  has(G.renderStep41(), 'financial commitment to this project remains in place', 'PN: pause note renders on the 4.1 card (reworded \u2013 Paul, July 6)');
  G.UI.expanded['oe11'] = true;
  has(G.renderOutExpbriefsFull(), 'add them to the paused phase', 'PN: pause note renders on the expanded data-bank development card');
  G.UI.expanded['oe11'] = false;
  G.data.tracking[11] = t0;
  ok(G.renderStep41().indexOf('financial commitment to this project remains in place') < 0, 'PN: note gone when nothing is paused');
})();

/* ── ZB: zoom on the 3.3 and 3.4 charts (Paul, July 5) ────────── */
(function(){
  G.UI.capTab = 2; G.UI.expanded['acCum'] = true;
  has(G.renderStepAlloc(), "UI.chartZoom='ac_cum'", 'ZB: enlarge control beside the cumulative fold at Commit & Advance');
  G.UI.expanded['acCum'] = false;
  G.UI.capTab = 1;
  has(G.renderStepAlloc(), "UI.chartZoom='ac_wf'", 'ZB: enlarge control on the staging chart card');
  has(G.bpCharts(0), "UI.chartZoom='bpshape_0'", 'ZB: enlarge control on the plan spend-shape chart');
  G.UI.capSim = {15: true};
  G.UI.chartZoom = 'ac_cum';
  const o = G.chartZoomOverlay();
  has(o, 'Cumulative vs Capacity \u2013 staged batch included', 'ZB: overlay titles the staged frame');
  has(o, '\u2715 Close', 'ZB: overlay closes');
  G.UI.capSim = {};
  G.UI.chartZoom = 'bpshape_0';
  const o2 = G.chartZoomOverlay();
  has(o2, 'Monthly Spend Shape \u2013 AI-Assisted Customer Triage', 'ZB: plan chart zooms under the project name');
  G.UI.chartZoom = null;
  eq(G.chartZoomOverlay(), '', 'ZB: overlay empty when closed');
})();

/* ── MG: Module Management hub (Paul, July 5) ──────────────────
   Controlled frame: start 35 days back, two stamped completions at
   days 7 and 20 (weeks 2 and 3), one overdue deadline. Hand-derived:
   done 2/15; velocity bars in W2 and W3; delta negative (2 < ideal). */
(function(){
  const snap = {};
  ['completedSteps','stepDoneAt','stepDue','assigns'].forEach(k => snap[k] = JSON.stringify(G.data[k] || null));
  const sd0 = G.data.startDate;
  const iso = d => new Date(d).toISOString().split('T')[0];
  const sd = Date.now() - 35 * 86400000;
  G.data.startDate = iso(sd);
  G.data.completedSteps = { '1.1': true, '1.2': true };
  G.data.stepDoneAt = { '1.1': iso(sd + 7 * 86400000), '1.2': iso(sd + 20 * 86400000) };
  G.data.stepDue = { '1.3': iso(Date.now() - 2 * 86400000), '2.1': iso(Date.now() + 3 * 86400000) };
  G.data.assigns = { '1.1': [G.USERS[0] ? G.USERS[0].id : 'x'], '2.2': [G.USERS[0] ? G.USERS[0].id : 'x'] };
  const st = G.mgStats();
  eq(st.total, 15, 'MG: fifteen countable steps (phase 5 excluded)');
  eq(st.done, 2, 'MG: done count from the flags');
  ok(st.delta < 0, 'MG: two done at day ~35 is behind the ideal pace');
  eq(st.overdue, 1, 'MG: one overdue deadline');
  G.UI.mgTab = 1;
  const pg = G.renderMgmtHub();
  G.UI.mgTab = 0;
  const pgA = G.renderMgmtHub();
  has(pg, 'TODAY \u00b7 2/15', 'MG: burn-up TODAY dot carries the count');
  has(pg, 'behind</span>' === '' ? 'x' : 'behind the ideal pace', 'MG: pace verdict below the burn-up');
  has(pg, 'Module Velocity', 'MG: velocity card renders');
  has(pg, 'Workload by Member', 'MG: workload card on Analytics (renamed from Team Load; open vs complete)');
  ok(pgA.indexOf("mgDueSave('1.1'") < 0, 'MG: completed steps have no clickable deadline input');
  ok(pgA.indexOf("mgDueSave('2.1'") >= 0, 'MG: open steps keep the deadline input');
  has(pgA, 'overdue \u00b7 was due', 'MG: overdue badge on the step row (Assignments tab)');
  has(pgA, 'This Week', 'MG: week panel renders on the Assignments tab');
  ok(pgA.indexOf('90-Day Burn-up') < 0, 'MG: burn-up lives on Analytics only');
  has(pg, 'Signals', 'MG: signals card renders');
  has(pg, '1 open \u00b7 1 complete', 'MG: workload splits open vs complete per member (hand-set: 1.1 done, 2.2 open)');
  const wk = pgA.slice(pgA.indexOf('This Week'), pgA.indexOf('Phase 1'));
  ok(wk.indexOf('assign-add') >= 0 && wk.indexOf('grid-template-columns:minmax(160px,1fr) 300px 240px') >= 0, 'MG: week rows share the phase-box layout, assignment cluster included');
  has(pg, '1 met \u00b7 0 missed' === '' ? 'x' : 'steps with an owner', 'MG: coverage signal renders');
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
  G.UI.assignOpen = '2.2';
  const pgP = G.renderMgmtHub();
  const pop = pgP.slice(pgP.indexOf('assign-pop'));
  ok(pop.indexOf('assign-row') >= 0 && pop.indexOf('opacity:.55') >= 0, 'MG: picker greys the unassigned rows');
  const u0n = G.USERS[0] ? G.USERS[0].name : '';
  const u1n = G.USERS[1] ? G.USERS[1].name : '';
  ok(!u0n || !u1n || pop.indexOf(u0n) < pop.indexOf(u1n), 'MG: assigned member sorts to the top of the picker (u0 holds 2.2 in this frame)');
  has(pgP, 'title="Assign members"', 'MG: the circle-plus trigger is always present');
  G.UI.assignOpen = null;
  // CN: chat & notes are data-backed (July 6) — empty org stays clean, seed populates
  ok(typeof G.chatArr==='function' && typeof G.gchatMembers==='function', 'CN: chat reads members and messages from data, not literals');
  (function(){
    const rSave=G.data.roster, cSave=G.data.chatMsgs;
    G.data.roster=[]; G.data.chatMsgs=[];
    ok(G.gchatMembers().length===0 && G.chatArr().length===0, 'CN: cleared org has no chat members and no messages');
    G.data.roster=rSave; G.data.chatMsgs=cSave;
  })();
  ok((G.data.chatMsgs||[]).length>=5 && JSON.stringify(G.data.chatMsgs).indexOf('Lauren')<0, 'CN: seed thread present, legacy personas gone');
  ok((G.data.notes||[]).length===3 && JSON.stringify(G.data.notes).indexOf('sourcing copilot')>=0, 'CN: three seed notes tied to the live seed state');
  // GT: gate decision semantics (Paul, July 6) — Go/Recycle/Kill; Hold removed; recycle forces the re-plan
  (function(){
    const rr = G.bpRows(13,'dev').filter(function(x){return x&&!x.gateDec})[0];
    if(rr){
      const gp = G.progGateUI(13, rr, false);
      ok(gp.indexOf('Hold') < 0 && gp.indexOf('Recycle') >= 0, 'GT: Hold is gone from the gate; Recycle remains');
      has(gp, 'take no decision', 'GT: caption teaches that an open gate needs no button');
      const snap = JSON.parse(JSON.stringify(G.data.budgetPlans[13]));
      G.progGate(13, rr.id, 'recycle');
      const r2 = G.bpRows(13,'dev').filter(function(x){return x&&x.id===rr.id})[0];
      ok(r2.gateDec==='recycle' && r2.pstatus==='running' && G.UI.expanded['pde_13_'+rr.id]===true, 'GT: recycle returns the phase to Running and opens edit for the re-plan');
      const oeWas = G.UI.expanded['oe13']; G.UI.expanded['oe13'] = true;
      has(G.renderOutExpbriefsFull(), 'revisit the phase budget', 'GT: recycled phase carries the persistent re-plan reminder');
      G.UI.expanded['oe13'] = oeWas;
      G.data.budgetPlans[13] = snap; G.Store.commit('budgetPlans',13);
      G.UI.expanded['pde_13_'+rr.id] = false; G.UI.expanded['phx_13_'+rr.id] = false;
    } else { ok(false, 'GT: frame expected an ungated phase on project 13'); }
  })();
  // HZ: horizon-mismatch warning (Paul, July 6) — persistent red until reconciled
  (function(){
    const i = 11;
    const bpWas = G.data.budgetPlans[i] ? JSON.parse(JSON.stringify(G.data.budgetPlans[i])) : undefined;
    G.data.budgetPlans[i].horizon = '5'; G.Store.commit('budgetPlans', i);
    ok(G.hzMismatch(i) === 3, 'HZ: lifetime 5 vs envelope 3 trips the mismatch (seed has planning started)');
    has(G.bpStatBand(i), 'financial planning horizon of 3 years', 'HZ: full red sentence on the project card stat band');
    has(G.renderStep41(), '\u26a0', 'HZ: compact badge reaches the 4.1 header bar');
    has(G.renderStepCap(), 'assigned lifetimes longer than this planning horizon', 'HZ: 3.2 reconcile panel lists the offenders (Paul, July 6)');
    has(G.renderStepCap(), '(5 years)', 'HZ: the list names the assigned lifetime');
    has(G.bpBudgetTab(i), 'shorten it here or extend the horizon at Step 3.2', 'HZ: inline warning beside the lifetime select at the moment of setting (Paul, July 6)');
    G.data.budgetPlans[i].horizon = '3'; G.Store.commit('budgetPlans', i);
    ok(G.hzMismatch(i) === 0, 'HZ: warning clears when the lifetime is brought into line');
    ok(G.bpStatBand(i).indexOf('financial planning horizon') < 0, 'HZ: stat band silent when reconciled');
    if (bpWas !== undefined) { G.data.budgetPlans[i] = bpWas; G.Store.commit('budgetPlans', i); }
    const abWas = G.data.capital.aiBudget, eyWas = G.data.capital.envYears;
    G.data.capital.aiBudget = ''; G.data.capital.envYears = '';
    ok(!G.hzPlanStarted() && G.hzMismatch(11) === 0, 'HZ: silent before capacity planning has begun (no fictional horizon)');
    G.data.capital.aiBudget = abWas; G.data.capital.envYears = eyWas;
  })();
  // WL: window-limited Committed (Paul, July 6) — only in-window months count; the tail is noted
  (function(){
    const i = 13;
    const sdWas = (G.data.projects[i]||{}).startDate;
    const base = G.capCommitments().total;
    const w13a = G.capProjectWindow(13, null);
    if(!G.data.projects[i]) G.data.projects[i] = {};
    G.data.projects[i].startDate = '2029-02-01'; // program month 35 of a 36-month window
    G.Store.commit('projects', i);
    const w = G.capDevWindow(i);
    eq(w.inW, 33333, 'WL: two in-window months of the month-35 project count (50K phase averaged over 3 months, 2 land inside)');
    eq(w.beyond, 166667, 'WL: the tail beyond the window is the remainder of the full 200K development cost');
    const w13b = G.capProjectWindow(13, null);
    eq(G.capCommitments().total, base - (w13a.inW - w13b.inW), 'WL: the ledger drops by exactly the in-window delta of the moved anchor (whole plan, single model)');
    const tabWas = G.UI.capTab; G.UI.capTab = 2; // envelope cells live on Commit & Advance
    has(G.renderStepAlloc(), 'beyond the planning window: ' + G.fmtMoney(G.capLens().beyond), 'WL: the note figure equals the lens\u2019s beyond-window sum (render matches engine)');
    has(G.renderStepAlloc(), 'are not counted above', 'WL: the note says plainly what the figure means');
    ok(G.capCommitments().rows.some(function(r){return String(r.label).indexOf('(within the planning window)')>=0}), 'WL: the split ledger row is labeled as window-limited');
    G.UI.capTab = tabWas;
    if (sdWas === undefined) delete G.data.projects[i].startDate; else G.data.projects[i].startDate = sdWas;
    G.Store.commit('projects', i);
    eq(G.capCommitments().total, base, 'WL: restoring the anchor restores the full ledger (seed carries no beyond-window months)');
  })();
  // AC: audit CSV (Paul, July 6) — the single model as one exportable table
  (function(){
    const csv = G.buildAuditCSV();
    ok(!!csv && csv.indexOf('project_id,project_name,stage,program_month,calendar_month,development,rollout,sustainment,month_total') >= 0, 'AC: project-months header present');
    ok(csv.indexOf('ENVELOPE BY YEAR') >= 0 && csv.indexOf('year,budget,committed,kill_pot,available') >= 0, 'AC: envelope section present');
    const env = csv.split('ENVELOPE BY YEAR')[1].split('\n').filter(l => /^\d+,/.test(l));
    eq(env.length, G.envYearsOf(), 'AC: one envelope row per year');
    const sumCsv = csv.split('\n').filter(l => /^\d+,/.test(l) && l.split(',').length >= 9).reduce((a,l)=>a+parseInt(l.split(',').pop(),10),0);
    ok(Math.abs(sumCsv - G.capLens().tot.committed) <= G.envYearsOf()*40, 'AC: CSV month totals reconcile to the lens committed total  (got ' + sumCsv + ' vs ' + G.capLens().tot.committed + ')');
  })();
  // FP: funding-plan headline reads the lens, not the retired shim (Paul's catch, July 6)
  (function(){
    G.UI.capTab = 2; G.UI.expanded['fpA'] = true;
    const t2 = G.renderStepAlloc();
    ok(t2.indexOf('Available budget: ') < 0, 'FP: the mixed-basis Available budget line is gone');
    has(t2, 'Available by year: ', 'FP: the per-year strip renders on the funding card (Paul, July 6)');
    has(t2, 'whole window ', 'FP: the strip closes with the whole-window figure');
    G.UI.expanded['fpA'] = false; G.UI.capTab = 1;
  })();
  // ORD: Commit & Advance page order (Paul, July 7)
  (function(){
    G.UI.capTab = 2;
    const t = G.renderStepAlloc();
    const seq = ['On the calendar', 'Cumulative commitments vs capacity', 'Capacity Breach Funding Plan', 'The committed calendar (swimlanes)', 'Committed Sums & Kill Pot'];
    let last = -1, okOrder = true;
    seq.forEach(m => { const ix = t.indexOf(m); if (ix < 0 || ix < last) okOrder = false; last = ix; });
    ok(okOrder, 'ORD: charts \u2192 funding plan \u2192 swimlanes fold \u2192 committed sums, in that order');
    ok(t.indexOf('acCum') < 0, 'ORD: the cumulative chart is open \u2013 no toggle, its breach warning always visible');
    has(t, 'Cumulative commitments', 'ORD: the cumulative section renders with its verdict line');
    G.UI.capTab = 1;
  })();
  // SC: sus-cap line year boundary (December off-by-one fixed July 7)
  (function(){
    const c0 = JSON.parse(JSON.stringify(G.data.capital));
    G.data.capital.susCapY1 = 20; G.data.capital.susCapY2 = 40; G.data.capStale = true;
    const y1b = G.envBudgetYear(1);
    eq(G.capSusCapLine(12), y1b / 12 * 20 / 100, 'SC: month 12 uses YEAR 1\u2019s cap percentage against year 1\u2019s budget \u2013 the line steps at month 13, not 12');
    eq(G.capSusCapLine(13), G.envBudgetYear(2) / 12 * 40 / 100, 'SC: month 13 opens year 2\u2019s percentage');
    G.data.capital = c0; G.data.capStale = true;
  })();

  // NT: email notifications (Paul, July 7) — client-complete, AWS-inert
  (function(){
    const u0 = G.USERS.slice(); const n0 = JSON.parse(JSON.stringify(G.data.notifications || []));
    const co0 = JSON.parse(JSON.stringify(G.data.completedSteps || {})); const sd0 = JSON.parse(JSON.stringify(G.data.stepDoneAt || {}));
    const du0 = JSON.parse(JSON.stringify(G.data.stepDue || {})); const as0 = JSON.parse(JSON.stringify(G.data.assigns || {}));
    const r70 = JSON.parse(JSON.stringify(G.data.remind7 || {}));
    G.USERS.length = 0;
    G.USERS.push({ id: 'uA', name: 'Ada', role: 'Program Lead', admin: true, email: 'ada@aurora.example', color: '#2D5A8E', initials: 'A' }); // flag-based admin (ruled July 9): the role text no longer qualifies anyone
    G.USERS.push({ id: 'uB', name: 'Ben', role: 'Engineering', email: 'ben@aurora.example', color: '#1B6B5A', initials: 'B' });
    G.USERS.push({ id: 'uC', name: 'Cy', role: 'Product', email: '', color: '#8B5E3C', initials: 'C' });
    delete G.data.stepDoneAt['2.3']; G.data.notifications = [];
    G.stampStepDone('2.3');
    const q = (G.data.notifications || [])[0];
    ok(!!q && q.kind === 'step-complete' && q.to.length === 2 && q.to.indexOf('ada@aurora.example') >= 0, 'NT: step completion queues the analytics report to every member with an email');
    has(q.status, 'pending', 'NT: with no endpoint configured, the notification queues as pending');
    ok(q.pdf === true, 'NT: completion notifications ask the service for the PDF attachment');
    G.stampStepDone('2.3');
    eq((G.data.notifications || []).length, 1, 'NT: re-stamping a completed step does not re-queue');
    has(G.notifyEmailHtml(q), 'analytics', 'NT: the completion email carries the Module Management analytics page');
    const soon = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    G.data.stepDue = { '3.1': soon }; G.data.assigns = { '3.1': ['uB'] };
    G.data.remind7 = {}; delete G.data.completedSteps['3.1']; G.data.notifications = [];
    G.notifySweepDeadlines();
    const r = (G.data.notifications || [])[0];
    ok(!!r && r.kind === 'deadline-reminder' && r.to.indexOf('ada@aurora.example') >= 0 && r.to.indexOf('ben@aurora.example') >= 0, 'NT: one week out, the reminder goes to the administrator and the assignee');
    G.notifySweepDeadlines();
    eq((G.data.notifications || []).length, 1, 'NT: the reminder fires once per deadline (remind7 stamp)');
    G.data.stepDue['3.2'] = soon; G.data.assigns['3.2'] = []; G.data.remind7 = {}; G.data.notifications = [];
    G.notifySweepDeadlines();
    ok(!(G.data.notifications || []).some(function(n){ return n.stepId === '3.2'; }), 'NT: deadlines without assignees do not send reminders');
    has(G.renderMgmtHub(), 'Save as PDF', 'NT: the analytics page carries the Save as PDF button (retargeted 13 Sep 2026 per Directive P-2, 17 Aug 2026 \u2013 supersedes the Download as PDF pin)');
    ok(G.renderMgmtHub().indexOf('Email Notifications') < 0, 'NT: the outbox card is unmounted \u2013 demo-clean (Paul, July 7); notifications record in data only');
    ok(typeof G.notifyOutboxCard === 'function', 'NT: the outbox card builder is kept for remounting once AWS is wired');
    ok(typeof G.printMgmtAnalytics === 'function' && G.NOTIFY_ENDPOINT === '', 'NT: print hook exists; the dispatch endpoint ships empty for the dev team');
    G.USERS.length = 0; u0.forEach(function(u){ G.USERS.push(u); });
    G.data.notifications = n0; G.data.completedSteps = co0; G.data.stepDoneAt = sd0;
    G.data.stepDue = du0; G.data.assigns = as0; G.data.remind7 = r70;
  })();

  // OD: 4.1 done gate — nothing overdue (Paul, July 7)
  (function(){
    const psWas = G.data.capital.periodStart;
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 3);
    G.data.capital.periodStart = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; // program month is always 4
    G.Store.commit('capital');
    const row = G.bpRows(13, 'dev').filter(r => r.id === 'bp13a')[0];
    const decWas = row.gateDec;
    delete row.gateDec; G.Store.commit('budgetPlans');
    ok(G.progOverdue(13) >= 1, 'OD: a phase ended without a gate decision counts as overdue');
    G.UI.expanded['re41_13'] = true;
    const od41 = G.renderStep41();
    has(od41, 'Record the gate decision for every phase that has ended', 'OD: the done hint names the overdue requirement');
    has(od41, 'ended in Month ', 'OD: the overdue phase carries a visible row warning (Paul, July 7)');
    // KP: the kill panel renders under the row that triggered it
    G.UI.expanded['kp13'] = 'bp13a';
    const kpRow = G.renderStep41();
    const rowsK = G.bpRows(13, 'dev');
    const nmA = (rowsK.filter(r => r.id === 'bp13a')[0] || {}).name || '';
    const nmB = (rowsK.filter(r => r.id === 'bp13b')[0] || {}).name || '';
    const ck = kpRow.indexOf('Confirm kill');
    ok(ck > kpRow.indexOf(nmA) && (kpRow.indexOf(nmB) < 0 || ck < kpRow.lastIndexOf(nmB)), 'KP: gate-triggered kill panel sits directly under the triggering row (Paul, July 7)');
    G.UI.expanded['kp13'] = true;
    has(G.renderStep41(), 'Confirm kill', 'KP: status-select kill keeps its panel');
    G.UI.expanded['kp13'] = false;
    row.gateDec = 'go'; G.Store.commit('budgetPlans');
    ok(G.progOverdue(13) === 0 || G.bpRows(13, 'dev').some(r => { const sp = G.bpStepSpan(r); return sp && sp[1] < 4 && !r.gateDec; }) === false, 'OD: recording the decision clears the overdue count for that phase');
    if (decWas === undefined) delete row.gateDec; else row.gateDec = decWas;
    G.data.capital.periodStart = psWas; G.Store.commit('capital');
  })();
  // RV: review decisions unclick; rows expand to the status card (Paul, July 7)
  (function(){
    const riWas = JSON.stringify((G.data.review && G.data.review.items && G.data.review.items[13]) || null);
    if(G.data.review&&G.data.review.items)delete G.data.review.items[13]; /* 17 Sep 2026: the seed now carries a first review, so the sequence starts from no decision */
    G.setReviewDecision(13, 'hold');
    eq(((G.data.review.items || {})[13] || {}).decision, 'hold', 'RV: a decision records');
    G.setReviewDecision(13, 'hold');
    ok(!((G.data.review.items || {})[13] || {}).decision, 'RV: clicking the active decision unclicks it');
    G.setReviewDecision(13, 'sell');
    ok((G.data.tracking[13] || {}).status !== 'killed' && G.UI.expanded['kp13'] === true && !((G.data.review.items || {})[13] || {}).decision, 'RV: sell on a dev item opens the kill confirm panel \u2013 nothing kills, nothing records, until confirm (parity, Paul July 7)');
    G.progKillConfirm(13);
    ok((G.data.tracking[13] || {}).status === 'killed' && ((G.data.review.items || {})[13] || {}).decision === 'sell', 'RV: confirming the panel kills AND records the Sell decision');
    G.setReviewDecision(13, 'sell');
    ok(!((G.data.review.items || {})[13] || {}).decision && (G.data.tracking[13] || {}).status === '', 'RV: unclicking sell revives \u2013 status and the frozen set clear (programmatic path; the UI offers Revive since July 10)');
    ok(G.renderStep44().indexOf(' Card</button>') < 0, 'RV: the Card button is gone \u2013 the whole row head toggles, portfolio-style (Paul, July 7)');
    has(G.renderStep44(), 'flx-row-mb xh', 'RV: decision-row heads carry the clickable expand pattern');
    ok(G.renderStep44().indexOf('Step 3.4 before scaling') < 0, 'RV: the impossible 3.4 gate is gone from exploration Buy \u2013 advance criteria only');
    G.UI.expanded['rv13'] = true;
    const rv = G.renderStep44();
    has(rv, 'In development', 'RV: the row badges the stage, not the raw status');
    ok(rv.indexOf('trk_13_results') >= 0 && rv.indexOf('Portfolio Position') >= 0, 'RV: an in-development row expands to the FULL live development card \u2013 status, results, program dashboard, position (Paul, July 7; vocabulary: position, July 10)');
    G.UI.expanded['rv13'] = false;
    if (riWas === 'null') { if (G.data.review && G.data.review.items) delete G.data.review.items[13]; }
    else G.data.review.items[13] = JSON.parse(riWas);
    G.Store.commit('review'); G.Store.commit('tracking');
  })();
  // NV: the shared review surface (Paul, July 7)
  (function(){
    const s44 = G.renderStep44();
    has(s44, 'setReviewDecision(', 'NV: 4.4 still runs the review through the shared surface');
    const closed = G.renderNavDash();
    has(closed, 'Portfolio Review', 'NV: Navigate carries the review natively');
    has(closed, 'Run the review', 'NV: closed state offers the run control beside the next-review line');
    ok(closed.indexOf('setReviewDecision(') < 0, 'NV: closed state stays a pointer \u2013 no machinery rendered');
    G.UI.expanded.navRev = true;
    const openN = G.renderNavDash();
    has(openN, 'setReviewDecision(', 'NV: open, Navigate mounts the same decision machinery');
    has(openN, 'Portfolio Learnings', 'NV: the full surface travels \u2013 the merged learnings card included (renamed from Portfolio Replenishment, Paul July 7)');
    has(openN, 'rev_nextCycle', 'NV: all five learning boxes ride in the one card');
    G.UI.expanded.navRev = false;
  })();
  // RVL: review list population and stage precedence (Paul, July 7)
  (function(){
    const wasL = (G.data.launched || []).slice();
    if (!G.data.launched) G.data.launched = [];
    if (G.data.launched.indexOf(13) < 0) G.data.launched.push(13);
    G.Store.commit('launched');
    const r = G.renderStep44();
    ok(r.indexOf('Operational') >= 0, 'RVL: a launched item badges Operational even while it remains in the development selection \u2013 operational wins precedence');
    has(r, 'Exploration', 'RVL: exploration rows restored to the decision list (Paul, July 7; badge matches the stat-band vocabulary) \u2013 the Buy path pulls them forward');
    const _xp = (G.data.selected || []).filter(function(i){ return (G.data.expSelected || []).indexOf(i) < 0 && (G.data.launched || []).indexOf(i) < 0 && ((G.data.projects || {})[i] || {}).viable === true; })[0];
    if (_xp !== undefined) {
      G.UI.expanded['rv' + _xp] = true;
      has(G.renderStep44(), 'Re-score (deepened)', 'RVL: an exploration row expands to the FULL live exploration card (re-score, advance gate)');
      G.UI.expanded['rv' + _xp] = false;
    } else { ok(typeof G.expPortBody === 'function', 'RVL: expPortBody exists (no seed exploration item to render against)'); }
    if (_xp !== undefined) {
      G.setReviewDecision(_xp, 'sell');
      const oxK = G.renderOutExploreEnhanced();
      ok(oxK.indexOf('>Killed<') >= 0 && oxK.indexOf('line-through') >= 0, 'RVL: a sold exploration item stays on the Exploration Portfolio, struck through with the Killed badge (Paul, July 7 \u2013 badge simplified from Sold \u00b7 killed)');
      G.setReviewDecision(_xp, 'sell'); // unclick revives and clears
    }
    G.UI.expanded['rv13'] = true;
    const rvOp = G.renderStep44();
    ok(rvOp.indexOf('Development card') >= 0 && rvOp.indexOf('Project card') >= 0 && rvOp.indexOf('Idea card') >= 0, 'RVL: an operational row expands to the full operational card with the nested development/project/idea folds');
    G.UI.expanded['rv13'] = false;
    has(r, 'Portfolio Balance</h3>', 'RVL: balance card retitled, re-grade suffix gone');
    has(r, 'operational or in development to take account of the most recent evidence', 'RVL: explainer sentence per Paul');
    G.data.launched = wasL; G.Store.commit('launched');
  })();
  G.saveDone13();
  eq(G.data.stepDoneAt['1.3'], iso(Date.now()), 'MG: saveDone stamps the completion date');
  ok(G.mgStats().overdue === 0, 'MG: completing the step clears its overdue flag');
  ['completedSteps','stepDoneAt','stepDue','assigns'].forEach(k => { const v = JSON.parse(snap[k]); if (v === null) delete G.data[k]; else G.data[k] = v; });
  G.data.startDate = sd0;
  G.saveData();
})();

/* ── SU: management seed (July 5) ─────────────────────────────── */
(function(){
  ok((G.data.roster || []).length >= 9, 'SU: seed roster carries the eight named members plus the owner');
  ok(G.USERS.some(u => u.name === 'Vincent Lau') && G.USERS.some(u => u.name === 'Arvind Nair'), 'SU: roster applied to USERS');
  eq((G.data.assigns['3.4'] || []).join(','), 'su1,su2', 'SU: assignments seeded per step');
  ok(!!G.data.stepDoneAt['4.1'] && !G.data.stepDoneAt['4.2'], 'SU: completion dates only on completed steps');
  const st = G.mgStats();
  eq(st.done, 15, 'SU: fifteen of fifteen steps complete on the seed (retargeted 17 Sep 2026: Paul had 4.2\u20134.4 marked complete)');
  eq(st.overdue, 0, 'SU: no overdue deadlines on the seed (dues sit in days 76\u201388)');
  G.UI.mgTab = 1;
  has(G.renderMgmtHub(), 'TODAY \u00b7 12/15', 'SU: seed burn-up carries the count (Analytics)');
  G.UI.mgTab = 0;
  has(G.renderMgmtHub(), 'due ', 'SU: upcoming deadlines render (Assignments default)');
})();

/* ── MG2: hub registered like cap-hub (July 5) ── */
ok(!G.PH[4].outcomes.some(o => o.id === 'mgmt-hub'), 'MG2: management hub is NOT a phase-5 output (Paul ruling: module-wide tool, top bar only)');
(function(){
  const page0 = G.currentPage;
  G.go('mgmt-hub');
  eq(G.currentPage, 'mgmt-hub', 'MG2: go() routes to the hub');
  G.UI.navMore = true; G.render();   // Track Program moved under More (Faisal, July 10)
  const nrEl = (typeof G.$ === 'function') ? G.$('navRight') : null;
  if (nrEl && typeof nrEl.innerHTML === 'string') {
    has(nrEl.innerHTML, 'Track Program</button>', 'MG2: the More-menu item reads Track Program (renamed from Manage, Paul July 7; moved under More, Faisal July 10)');
    ok(nrEl.innerHTML.indexOf('? Help') < nrEl.innerHTML.indexOf('Track Program'), 'MG2: Help (top bar) precedes the Track Program menu item in the markup');
    ok(nrEl.innerHTML.indexOf('Light Mode') >= 0 || nrEl.innerHTML.indexOf('Dark Mode') >= 0, 'MG2: the theme toggle holds the old top-bar slot');
    has(nrEl.innerHTML, 'nav-more-item nav-action-on', 'MG2: the menu item lights up while on the hub');
  } else {
    ok(true, 'MG2: nav element not inspectable in this stub \u2013 covered by browser QA');
  }
  G.UI.navMore = false;
  G.go(page0 || 'home');
})();

/* ── REPORT ─────────────────────────────────────────────────── */
console.log('\n──────────────────────────────────────────');
/* ─── Y2 SEED (July 8): year-2-end sample – identity hand-derived by the +Δ method ───
   Base 3,246,249 preserved under the uniform 19-month shift (window and offsets move together);
   Δ = −49,583 (invoice copilot kill: sunk bp12a 80,000 replaces the 129,583 full in-window plan)
       +279,583 (churn intake, month-16 anchor: dev 180,000 + roll 40,000 + 13 sustainment months at 55K/yr)
       +(260,000 − 353,333) (procurement copilot deferred to month 19: dev 205,000 + roll 55,000 wholly
        in window under the base anchor become dev 205,000 + roll partial + sustainment tail under m19)
   ⇒ 3,382,916. Every figure derived from seed rows with independent arithmetic (derive_y2.js) before pinning. */
(function(){
  const _snapAll = JSON.stringify(G.data);
  noThrow(() => G.seedDataY2(), 'Y2: seedDataY2() runs (incl. its internal render())');
  const m = G.progMonthOf(new Date());
  ok(m === 22 || m === 23, 'Y2: "today" sits late in envelope year 2 (month 22–23), got ' + m);
  eq(G.envYearsOf(), 3, 'Y2: envelope stays 3 years');
  ok(Math.abs(G.capCommitments().total - 3382916) <= 2, 'Y2: in-window ledger identity 3,382,916 ±2 (hand-derived)');
  eq(G.anchorMonth(11), 19, 'Y2: procurement copilot anchor follows the deferred startDate (Start Date Drift)');
  eq(G.anchorMonth(14), 16, 'Y2: churn model anchors at the month-16 advance');
  eq(G.capBreaches([]).capYears, [3], 'Y2: sustainment plateau breaches year 3 only (545K vs 18% of 2.8M)');
  eq(G.capBreaches([]).overCapMonth, 0, 'Y2: no annual budget breach (year totals inside composed envelopes)');
  eq(G.envBudgetYear(1), 3100000, 'Y2: year-1 envelope composed with the three authorized funding lines');
  const st = G.getStages();
  eq(st.operational, [0,1,4,13], 'Y2: operational = the base three launches + quality vision');
  eq(st.experiment, [11,12,14], 'Y2: development row = deferred copilot, killed invoice item, churn intake');
  eq((G.data.tracking[12]||{}).status, 'killed', 'Y2: invoice copilot killed');
  eq((G.data.tracking[12]||{}).killSunkIds, ['bp12a'], 'Y2: kill froze the entered phase (status basis)');
  ok(Math.abs(G.killSunkDev(12) - 80000) <= 1, 'Y2: sunk dev on the killed item = the entered phase, 80K');
  eq((G.data.capital.killRows||[]).length, 1, 'Y2: one wind-down line in the kill & phase-out pot');
  eq((G.data.reviewCycles||[]).length, 1, 'Y2: one closed review cycle in history');
  eq(G.data.reviewCycles[0].review.items['13'].decision, 'buy', 'Y2: the cycle records the Buy that launched quality vision');
  eq(G.data.reviewCycles[0].review.items['14'].decision, 'buy', 'Y2: the cycle records the Buy that advanced the churn model');
  ok(!!(G.data.opsData[13]||{}).launchConfirm, 'Y2: the launch carries the review-decision confirm stamp');
  eq(G.data.ideas.length, 25, 'Y2: five new ideas entered the funnel');
  ok(st.explore.indexOf(20) >= 0 && st.explore.indexOf(21) >= 0, 'Y2: two new ideas sit in exploration');
  ok(st.explore.indexOf(14) < 0, 'Y2: the churn model left exploration on advance');
  eq(Object.keys(G.data.completedSteps).length, 15, 'Y2: all fifteen module steps complete');
  // restore completely (frame discipline: an incomplete restore silently poisons every later block)
  G.data = JSON.parse(_snapAll);
  G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'Y2: restore returns the base seed identity 3,246,249');
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
  eq(G.currentUserId, _cu, 'AUTH: session restored for downstream blocks');
})();

/* ─── MULTI-USER PREP (July 8): revisioned writes, refresh, stale recovery ───
   These pins freeze the client contract for ~6 simultaneous users: every
   persisted blob carries schemaVersion + a monotonic rev (mirrored in a tiny
   rev record so polling never parses the blob); refreshOrg adopts a newer
   stored blob; handleStaleWrite re-pulls and overlays the local dirty records
   (record-level last-writer-wins, per the blob-PUT ruling). */
(function(){
  const _oid = G.currentOrgId;
  const _snap = JSON.stringify(G.data);
  const _rev0 = G.data.rev || 0;

  G.Store.commit('purpose');
  ok((G.data.rev||0) === _rev0 + 1, 'MU: each persisted write increments rev');
  eq(G.data.schemaVersion, G.Store.schemaVersion(), 'MU: blobs carry the schemaVersion stamp');
  eq(G.Store.orgRev(_oid), G.data.rev, 'MU: the mirrored rev record tracks the blob');
  eq(G.Store.refreshOrg(), false, 'MU: refreshOrg is a no-op when nothing newer is stored');

  const remote = JSON.parse(JSON.stringify(G.data));
  remote.purpose = remote.purpose || {}; remote.purpose.mission = 'REMOTE EDIT';
  G.Store.writeOrg(_oid, remote); // simulates another tab: stored rev now ahead
  ok(G.Store.orgRev(_oid) > (G.data.rev||0), 'MU: a foreign write leaves the in-memory replica behind');
  eq(G.Store.checkRemote(), true, 'MU: the change signal adopts the newer blob');
  eq(G.data.purpose.mission, 'REMOTE EDIT', 'MU: the adopted blob is live in the replica');
  eq(G.data.rev, G.Store.orgRev(_oid), 'MU: revs agree after adoption');

  const fresh = { rev: 9, tracking: { 1: { status: 'remote' } }, governance: { meeting: 'R' } };
  const local = { tracking: { 0: { status: 'mine' }, 1: { status: 'stale-mine' } }, capital: { susCap: '7' } };
  G.Store.mergeDirtyInto(fresh, local, ['tracking::0', 'capital']);
  eq(fresh.tracking[0].status, 'mine', 'MU: merge overlays my dirty record onto the fresh blob');
  eq(fresh.tracking[1].status, 'remote', 'MU: merge keeps records I did not touch');
  eq(fresh.capital.susCap, '7', 'MU: merge overlays collection-level dirty keys');

  // stale-write recovery end to end: my committed record survives, the other
  // writer's data survives, revs advance, the dirty set clears
  const remote2 = JSON.parse(JSON.stringify(G.data));       // cloned BEFORE my edit
  remote2.governance = remote2.governance || {}; remote2.governance.threshold = '$9M-REMOTE';
  G.Store.clearDirty();
  G.data.purpose.mission = 'MY DIRTY EDIT'; G.Store.commit('purpose');
  G.Store.writeOrg(_oid, remote2);                          // server-authoritative newer blob
  ok(G.Store.handleStaleWrite(_oid) === true, 'MU: stale-write recovery runs');
  eq(G.data.purpose.mission, 'MY DIRTY EDIT', 'MU: recovery reapplies my in-flight record');
  eq(G.data.governance.threshold, '$9M-REMOTE', 'MU: recovery keeps the other writer data');
  eq(G.data.rev, remote2.rev + 1, 'MU: recovery persists one rev past the authoritative blob');
  eq(G.Store.dirtyRecords().length, 0, 'MU: recovery clears the dirty set');

  // restore completely
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'MU: restore returns the base seed identity');
})();

/* ─── ASYNC BOOT LOADER (July 8): readiness seam + double-boot guard ─── */
(function(){
  let s=false; G.Store.ready(()=>{ s=true; });
  ok(s===true, 'BOOT2: Store.ready fires in the same tick locally (boot unchanged)');
  eq(typeof G.bootApp, 'function', 'BOOT2: the boot sequence is a callable unit');
  eq(G.bootApp(), false, 'BOOT2: bootApp is idempotent – a duplicate ready signal is a no-op');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'BOOT2: the rejected re-boot touched nothing');
})();

/* ─── SEED ORDER (July 8): seeding is order-independent ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  G.seedDataY2(); G.seedData();
  eq((G.data.reviewCycles||[]).length, 0, 'SEED: base seed over Y2 leaves no review-cycle residue (fixed July 8)');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SEED: base-over-Y2 ledger is the base identity');
  eq(G.data.ideas.length, 20, 'SEED: base-over-Y2 idea count is the base count');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SEED: restore returns the base seed identity');
})();

/* ─── RULINGS (July 8, close-out): passcode unification + literal seed overwrite ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  G.data.roster[0].passcode = '1234'; G.applyTeamRoster();
  ok(G.USERS.every(u => !('passcode' in u)) && G.data.roster.every(u => !('passcode' in u)), 'RULINGS (superseded by Part 5): applyTeamRoster mints no PIN, and clears one left in old data');
  G.data.notifications = [{at:1,kind:'x',subject:'JUNK',to:['a'],status:'x'}];
  G.data.remind7 = {'9.9':true}; G.data.archivedItems = {'5':true};
  G.data.chatMsgs = [{who:'F',name:'X',ts:1,text:'JUNK'}];
  G.saveData(); G.seedData();
  ok((G.data.notifications||[]).length===0 && !Object.keys(G.data.remind7||{}).length
     && !Object.keys(G.data.archivedItems||{}).length && JSON.stringify(G.data.chatMsgs||[]).indexOf('JUNK')<0,
     'RULINGS: re-seeding clears notifications, reminders, and archives, and replaces chat with the seed conversation (overwrite is literal)');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'RULINGS: the cleared re-seed lands on the base identity');
  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(G.USERS.length > 0 && G.USERS.every(u => !('passcode' in u)), 'RULINGS: roster and session state restored for downstream blocks, with no password in the data');
})();

/* ─── INSIGHTS (July 9, sweep item 1): page renders, tabs switch ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  eq(G.insightsTab, 'latest', 'INSIGHTS: insightsTab is declared and defaults to latest');
  const out = G.renderInsights();
  ok(out.length > 500, 'INSIGHTS: base fixture renders substantive HTML');
  has(out, 'insight-filter active" data-itab="latest"', 'INSIGHTS: the latest tab renders active by default');
  G.setInsightsTab('worth');
  has(G.renderInsights(), 'insight-filter active" data-itab="worth"', 'INSIGHTS: setInsightsTab moves the active class on re-render');
  G.setInsightsTab('latest');
  G.seedDataY2();
  ok(G.renderInsights().length > 500, 'INSIGHTS: Y2 fixture renders substantive HTML');
  /* content pins (July 9 restoration) - dynamic, so routine article refreshes never red them */
  ok(G.LATEST_THOUGHTS.length > 0 && G.CONVERGENCE_EPISODES.length > 0 && G.WORTH_YOUR_TIME.length > 0, 'INSIGHTS: the three content sets carry entries');
  ok(G.LATEST_THOUGHTS.every(function(it){ return !!G.INSIGHT_SOURCES[it.src]; }), 'INSIGHTS: every article resolves its outlet');
  ok(G.LATEST_THOUGHTS.every(function(it){ return /^https?:\/\//.test(it.url || ''); }), 'INSIGHTS: every article carries a real link');
  has(G.renderInsights(), G.esc(G.LATEST_THOUGHTS[0].title), 'INSIGHTS: the page renders the first article');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'INSIGHTS: restore returns the base identity');
})();

/* ─── REFRESH (July 9, sweep item 2): recheck path agrees with its render twin ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _page = G.currentPage, _step = G.currentStep, _sec = G.UI.sec, _qs = G.document.querySelector;
  const btn = {disabled:'unset', style:{}}, helper = {style:{}};
  G.document.querySelector = function(sel){ return sel==='.done-btn' ? btn : (sel==='.done-helper' ? helper : _qs(sel)); };
  G.currentPage = 'step';

  /* 2a — 4.1: overdue undecided phase disables Done on BOTH paths; deciding the gate arms both */
  const exp = (G.getStages().experiment||[]).filter(function(i){ return !G.isArchived(i) && ((G.data.tracking||{})[i]||{}).status !== 'killed'; });
  ok(exp.length >= 2, 'REFRESH: base seed provides two live development items to work with');
  const i = exp[0];
  G.data.expSelected = [i];
  if (G.data.completedSteps) { delete G.data.completedSteps['4.1']; delete G.data.completedSteps['4.4']; }
  const rows = G.progOrdered(i);
  ok(rows.length >= 1, 'REFRESH: item carries dev plan rows');
  rows.forEach(function(r, x){ if (x === 0) { r.from='1'; r.to='1'; delete r.gateDec; r.pstatus='running'; } else { r.gateDec='go'; r.pstatus='complete'; } });
  ok(G.progOverdue(i) > 0, 'REFRESH 2a: constructed state is overdue-undecided');
  has(G.renderStep41(), 'Record the gate decision', 'REFRESH 2a: render path disables Done (helper present) while a gate is overdue');
  G.currentStep = '4.1'; btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, true, 'REFRESH 2a: recheck path agrees — a field-save leaves Done disabled while a gate is overdue');
  rows[0].gateDec = 'go';
  ok(G.progOverdue(i) === 0 && G.progArmed(i), 'REFRESH 2a: deciding the gate clears overdue and arms the program');
  ok(G.renderStep41().indexOf('Record the gate decision') < 0, 'REFRESH 2a: render path enables Done once gates are current');
  btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, false, 'REFRESH 2a: recheck path agrees — the same field-save now arms Done');

  /* 2b — 4.4: an archived undecided item blocks Done in NEITHER path */
  const k = exp[1];
  G.data.expSelected = [i, k];
  G.data.selected = [];
  if (!G.data.review) G.data.review = {};
  G.data.review.items = {}; G.data.review.items[i] = {decision:'hold'};
  if (!G.data.archivedItems) G.data.archivedItems = {};
  G.data.archivedItems[k] = {stage:'experiment'};
  ok(G.renderStep44().indexOf('Decide Buy, Sell, or Hold') < 0, 'REFRESH 2b: render path — archived undecided item does not block Done');
  G.currentStep = '4.4'; btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, false, 'REFRESH 2b: recheck path agrees — archived undecided item does not jam Done on a field-save');

  /* 2c — 1.4 (ruled July 9): an empty audit is a valid completion on BOTH paths */
  G.data.audit = [];
  if (G.data.completedSections) delete G.data.completedSections['1.4'];
  G.currentStep = '1.1'; G.UI.sec = '1.4';
  ok(G.renderStep11().indexOf('done-helper') < 0, 'REFRESH 2c: render path — sub-1.4 Done is enabled with zero audit rows');
  btn.disabled = 'unset'; G.refreshSecDone();
  eq(btn.disabled, false, 'REFRESH 2c: recheck path agrees — empty audit satisfies 1.4');
  G.saveSection14();
  eq(!!(G.data.completedSections||{})['1.4'], true, 'REFRESH 2c: completing with an empty audit marks the section complete');

  G.document.querySelector = _qs; G.currentPage = _page; G.currentStep = _step; G.UI.sec = _sec;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'REFRESH: restore returns the base identity');
})();

/* ─── ADMIN GUARDS (July 9, sweep items 3-4): colorless avatars, delete-current-org ─── */
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
  ok(!!G.getOrg(cur) && G.getOrgs().length === before + 1, 'ADMIN: deleting the current org is blocked (ruled July 9) — registry unchanged');
  const _cm = G.currentModal; G.currentModal = 'admin';
  G.renderAdminModal();
  const modal = G.document.getElementById('modalRoot').innerHTML || '';
  G.currentModal = _cm;
  ok(modal.indexOf("adminDeleteOrg('" + cur + "')") < 0, 'ADMIN: the current org row renders no delete control');
  ok(modal.indexOf("adminDeleteOrg('" + other + "')") >= 0, 'ADMIN: other org rows keep their delete control');
  G.adminDeleteOrg(other);
  eq(G.getOrgs().length, before, 'ADMIN: a non-current org still deletes (guard is narrow)');
  G.isAppAdmin = _ia10;
  G.data = JSON.parse(_snap); G.saveData();
})();

/* ─── REVIVE (July 9, sweep item 5): noGo revive returns to bluesky, not to the void ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const bl = G.getStages().bluesky.slice(), ng = G.getStages().noGo.slice();
  ok(ng.length >= 1 && bl.length >= 1, 'REVIVE: base seed provides noGo and bluesky items');
  const b = bl[0];
  G.archiveItem(b); G.reviveItem(b);
  ok(G.getStages().bluesky.indexOf(b) >= 0, 'REVIVE: bluesky-archived revive behavior is unchanged');
  const n = ng[0];
  G.archiveItem(n);
  eq(((G.data.archivedItems||{})[n]||{}).stage, 'noGo', 'REVIVE: archive records the noGo stage');
  G.reviveItem(n);
  ok(G.getStages().bluesky.indexOf(n) >= 0, 'REVIVE: a noGo revive lands the item in bluesky');
  ok((G.data.selected||[]).indexOf(n) < 0, 'REVIVE: the revived item is out of selected');
  ok(!(G.data.projects||{})[n], 'REVIVE: the revived item carries no stale project verdict');
  G.toggleSelect(n);
  ok((G.data.selected||[]).indexOf(n) >= 0, 'REVIVE: the item is re-selectable on 1.3');
  eq(((G.data.projects||{})[n]||{}).viable, undefined, 'REVIVE: re-selection arrives at 2.4 unresolved via a fresh slate');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'REVIVE: restore returns the base identity');
})();

/* ─── KILLTIME (July 9, sweep item 6): gate-path kills never convert unspent to spent ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const rows = G.bpRows(13, 'dev');
  ok(rows.length >= 2, 'KILLTIME: item 13 carries a multi-row dev plan');
  rows.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; });
  if (G.data.tracking && G.data.tracking[13]) { G.data.tracking[13].status = ''; delete G.data.tracking[13].killSunkIds; }

  /* flow rule: an unstarted phase's gate offers no Kill */
  const ui0 = G.progGateUI(13, rows[0], false);
  ok(ui0.indexOf("'go'") >= 0 && ui0.indexOf("'recycle'") >= 0, 'KILLTIME: unstarted gate still offers Go and Recycle');
  ok(ui0.indexOf("'kill'") < 0, 'KILLTIME: unstarted gate offers no Kill (flow rule, July 9)');
  ok(ui0.indexOf('Kill opens the kill panel') < 0, 'KILLTIME: the gate copy drops the Kill sentence with the button');
  rows[0].pstatus = 'running';
  const ui1 = G.progGateUI(13, rows[0], false);
  ok(ui1.indexOf("'kill'") >= 0 && ui1.indexOf('Kill opens the kill panel') >= 0, 'KILLTIME: a running phase offers Kill, copy restored');

  /* accounting rule: disclosed preview equals post-confirm reality on a gate-path kill */
  const pv = G.killReleasePreview(13);
  const enteredIds = pv.phases.filter(function(p){ return p.entered; }).map(function(p){ return p.id; });
  eq(JSON.stringify(enteredIds), '["bp13a"]', 'KILLTIME: preview discloses exactly the running phase as entered');
  const before = G.capCommitments().total;
  G.document.getElementById('kd_13').value = ''; G.document.getElementById('ka_13').value = '';
  G.progGate(13, 'bp13a', 'kill');
  eq(G.UI.expanded['kp13'], 'bp13a', 'KILLTIME: the gate Kill routes to the confirm panel');
  G.progKillConfirm(13);
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), JSON.stringify(enteredIds), 'KILLTIME: killSunkIds equals the disclosed entered set — the decision itself sinks nothing');
  eq(G.bpRows(13, 'dev')[0].gateDec, 'kill', 'KILLTIME: the gate record still ends kill-decided');
  const after = G.capCommitments().total;
  ok(Math.abs((before - after) - pv.released) <= 1, 'KILLTIME: the ledger drop equals the disclosed released figure');

  /* unchanged paths: status-select kill and review Sell */
  G.fldSave('trk_13_status', '', true);
  ok(!G.data.tracking[13].killSunkIds, 'KILLTIME: un-kill clears the frozen set (prior behavior)');
  delete G.bpRows(13, 'dev')[0].gateDec; delete G.bpRows(13, 'dev')[0].gateAt;
  G.fldSave('trk_13_status', 'killed', true);
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'KILLTIME: the status-select kill freezes the entered set as before');
  G.fldSave('trk_13_status', '', true);
  G.UI.reviewSellPending = 13; G.UI.expanded['kp13'] = true;
  G.progKillConfirm(13);
  eq(((G.data.review||{}).items||{})[13] && G.data.review.items[13].decision, 'sell', 'KILLTIME: the review Sell path records the decision as before');
  ok(!G.bpRows(13, 'dev')[0].gateDec, 'KILLTIME: a Sell-path kill writes no gate record');
  eq(JSON.stringify(G.data.tracking[13].killSunkIds), '["bp13a"]', 'KILLTIME: the Sell-path kill freezes the same entered set');

  delete G.UI.reviewSellPending; G.UI.expanded['kp13'] = false;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'KILLTIME: restore returns the base identity');
})();

/* ─── SEEDROSTER (July 9, sweep items 7-8): F3 resets the roster; admins are flag-based ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  /* dirty the roster the way a testing session does */
  const su2 = G.data.roster.filter(function(u){ return u && u.id === 'su2'; })[0];
  ok(!!su2, 'SEEDROSTER: canonical member present before the test');
  su2.name = 'Renamed In Testing';
  const su3 = G.data.roster.filter(function(u){ return u && u.id === 'su3'; })[0];
  su3.email = 'left-over@aurora.example';
  G.data.roster.push({id:'qa_stray', name:'Stray Tester', username:'stray', role:'Domain Administrator', initials:'ST'});
  G.saveData();
  const adminCount = G.data.roster.filter(function(u){ return u && u.admin === true; }).length;
  ok(adminCount >= 1, 'SEEDROSTER: the org carries a flagged administrator account');
  G.seedData();
  eq(G.data.roster.length, adminCount + 8, 'SEEDROSTER: F3 base returns admin account(s) + su1-su8, nothing else');
  eq(G.data.roster.filter(function(u){ return u && u.id === 'su2'; })[0].name, 'Harriet Rivers', 'SEEDROSTER: a testing-session rename does not survive the reseed');
  ok(!G.data.roster.filter(function(u){ return u && u.id === 'su3'; })[0].email, 'SEEDROSTER: a testing-session email edit does not survive');
  ok(!G.data.roster.some(function(u){ return u && u.id === 'qa_stray'; }), 'SEEDROSTER: a stray member does not survive');
  /* dirty again, prove the same through the Y2 order */
  G.data.roster.push({id:'qa_stray2', name:'Stray Two', username:'stray2', role:'Tester', initials:'S2'});
  G.saveData();
  G.seedDataY2();
  eq(G.data.roster.length, adminCount + 8, 'SEEDROSTER: F3 Year-2 resets the roster identically (shared buildSeedBase)');
  ok(!G.data.roster.some(function(u){ return u && u.id === 'qa_stray2'; }), 'SEEDROSTER: the Y2 order drops strays too');

  /* item 8: the flag is the rule, role text is cosmetic */
  G.seedData();
  G.applyTeamRoster();
  const admins = G.notifyAdmins();
  ok(admins.length >= 1 && admins.every(function(u){ return u.admin === true; }), 'SEEDROSTER: notifyAdmins returns exactly the flagged accounts');
  G.USERS.push({id:'qa_roletext', name:'Role Text Only', role:'Domain Administrator', email:'roletext@aurora.example'});
  ok(G.notifyAdmins().every(function(u){ return u.id !== 'qa_roletext'; }), 'SEEDROSTER: a role containing “admin” no longer qualifies anyone (ruled July 9)');
  G.USERS.pop();
  const adminU = G.notifyAdmins()[0];
  adminU.email = 'owner@aurora.example';
  const su1 = G.USERS.filter(function(u){ return u && u.id === 'su1'; })[0];
  su1.email = 'vlau@aurora.example';
  const soon = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
  G.data.stepDue = {'3.1': soon}; G.data.assigns = {'3.1': ['su1']};
  G.data.remind7 = {}; if (G.data.completedSteps) delete G.data.completedSteps['3.1'];
  G.data.notifications = [];
  G.notifySweepDeadlines();
  const rem = (G.data.notifications || [])[0];
  ok(!!rem && rem.to.indexOf('owner@aurora.example') >= 0 && rem.to.indexOf('vlau@aurora.example') >= 0, 'SEEDROSTER: the base-seed reminder addresses the flagged admin plus the assignee');
  ok(String(rem.status||'').indexOf('no administrator') < 0, 'SEEDROSTER: the no-admin suffix never appears while a flagged admin exists');

  G.data = JSON.parse(_snap); G.saveData(); G.applyTeamRoster();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'SEEDROSTER: restore returns the base identity');
})();

/* ─── DATED (July 9, sweep item 9): span-less costed rows never silently zero the ledger ───
   Hand-derived fixture (equivalent shape; scenario-1 rows slot in when they arrive):
   dev A $100,000 m1-4 dated · dev B $50,000 undated · roll C $20,000 m5-6 dated
   dated-only dev = 100,000 · plan full = 120,000 · after dating B (m2-3) full = 170,000 */
(function(){
  const _snap = JSON.stringify(G.data);
  if (!G.data.budgetPlans) G.data.budgetPlans = {};
  if (!G.data.experiments) G.data.experiments = {};

  /* undated-only: the simple estimate carries, never $0 */
  G.data.budgetPlans[97] = { dev: [{id:'ua', name:'Alpha build', cost:'$60,000'}] };
  G.data.experiments[97] = { budget: '$40,000' };
  ok(G.bpHasDev(97) === true, 'DATED: money without dates still claims the display surfaces (lock basis unchanged)');
  ok(G.bpPlanLive(97) === false, 'DATED: money without dates does not make the plan live for the ledger');
  eq(G.devCost(97), 40000, 'DATED: with no dated rows, committed development falls back to the simple estimate — not $0');
  const w0 = G.capProjectWindow(97, 1);
  eq(w0.inW + w0.beyond, 40000, 'DATED: the project window carries the simple figure');
  has(G.bpBudgetTab(97, true), 'Phase date ranges not set – Alpha build', 'DATED: the 3.4 budgeting panel warns per undated costed row');
  const hb = G.bpHeadlineBudget(97, {});
  has(hb, 'Derived from budget plan', 'DATED: the derived headline still shows (display basis unchanged)');
  has(hb, 'Phase date ranges not set – Alpha build', 'DATED: the 3.3 card carries the same warning');

  /* dating the row switches the ledger to plan figures and clears the warning */
  G.data.budgetPlans[97].dev[0].from = '1'; G.data.budgetPlans[97].dev[0].to = '4';
  ok(G.bpPlanLive(97) === true, 'DATED: a dated costed row makes the plan live');
  eq(G.devCost(97), 60000, 'DATED: the ledger switches to the plan figure once dates exist');
  ok(G.bpBudgetTab(97, true).indexOf('Phase date ranges not set') < 0, 'DATED: the warning clears when every costed row is dated');

  /* partial plan: dated rows count, undated rows are excluded and named */
  G.data.budgetPlans[97] = { dev: [
      {id:'pa', name:'Discovery', cost:'$100,000', from:'1', to:'4'},
      {id:'pb', name:'Pilot integration', cost:'$50,000'}
    ], roll: [ {id:'pc', name:'Rollout wave 1', cost:'$20,000', from:'5', to:'6'} ] };
  eq(G.devCost(97), 100000, 'DATED: partial plan — committed development counts only the dated rows');
  const w1 = G.capProjectWindow(97, 1);
  eq(w1.inW + w1.beyond, 120000, 'DATED: partial plan — the window totals dated development plus dated rollout');
  const warn = G.bpBudgetTab(97, true);
  ok(warn.indexOf('Pilot integration is not contributing') >= 0 && warn.indexOf('Discovery is not contributing') < 0, 'DATED: the warning names exactly the undated rows');

  /* full plan: the hand-derived exact figure */
  G.data.budgetPlans[97].dev[1].from = '2'; G.data.budgetPlans[97].dev[1].to = '3';
  eq(G.devCost(97), 150000, 'DATED: dating the last row brings its money into committed development');
  const w2 = G.capProjectWindow(97, 1);
  eq(w2.inW + w2.beyond, 170000, 'DATED: the fully dated plan reads $170,000 exactly — hand-derived: 100,000 + 50,000 + 20,000');
  ok(G.bpBudgetTab(97, true).indexOf('Phase date ranges not set') < 0, 'DATED: no warning on a fully dated plan');

  delete G.data.budgetPlans[97]; delete G.data.experiments[97];
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'DATED: restore returns the base identity');
})();

/* ─── READS (July 9, sweep item 10): no Reads-as echo anywhere; locks and blur re-renders stay ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const pages = [G.renderStep24(), G.renderStepExp(), G.renderStepCap(), G.renderOutOperFull(), G.renderStep44()].join('');
  ok(pages.indexOf('Reads as') < 0, 'READS: no money surface echoes Reads-as on the base fixture');
  has(pages, 'Derived from budget plan', 'READS: the derivation lock label survives the echo removal');
  G.seedDataY2();
  const pagesY2 = [G.renderStep24(), G.renderStepExp(), G.renderStepCap(), G.renderOutOperFull()].join('');
  ok(pagesY2.indexOf('Reads as') < 0, 'READS: no Reads-as on the Y2 fixture either');
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'READS: restore returns the base identity');
})();

/* ─── CONFIRM (July 9, sweep item 11): completion asks first; cancel touches nothing ─── */
(function(){
  const _snap = JSON.stringify(G.data);
  const _cf = G.confirm;
  G.confirm = function(){ return false; };

  if (G.data.completedSteps) delete G.data.completedSteps['1.2'];
  if (G.data.stepDoneAt) delete G.data.stepDoneAt['1.2'];
  G.data.notifications = [];
  G.saveDone12();
  ok(!(G.data.completedSteps||{})['1.2'], 'CONFIRM: cancelling the step dialog leaves the step incomplete');
  eq((G.data.notifications||[]).length, 0, 'CONFIRM: a cancelled completion queues no notification');
  ok(!(G.data.stepDoneAt||{})['1.2'], 'CONFIRM: a cancelled completion writes no timestamp');

  if (G.data.completedSections) delete G.data.completedSections['1.4'];
  G.saveSection14();
  ok(!(G.data.completedSections||{})['1.4'], 'CONFIRM: cancelling the section dialog leaves the section incomplete');

  const rows = G.bpRows(13, 'dev');
  ok(rows.length >= 2, 'CONFIRM: item 13 carries a multi-row plan for the gate walk');
  rows.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; });
  G.progGate(13, rows[0].id, 'go');
  ok(!rows[0].gateDec, 'CONFIRM: cancelling a non-terminal gate Go records nothing');
  G.bpRowSave(13, 'dev', rows[0].id, 'pstatus', 'complete');
  ok(String(rows[0].pstatus||'') === '', 'CONFIRM: cancelling the phase-status dialog keeps the phase unstarted – the re-render repaints the select from data');
  G.progGate(13, rows[0].id, 'recycle');
  eq(rows[0].gateDec, 'recycle', 'CONFIRM: Recycle needs no dialog – the confirms cover completion actions only');
  rows.forEach(function(r,x){ delete r.gateDec; delete r.gateAt; if (x < rows.length - 1) { r.gateDec = 'go'; r.pstatus = 'complete'; } });
  const last = rows[rows.length - 1];
  G.progGate(13, last.id, 'go');
  eq(last.gateDec, 'go', 'CONFIRM: terminal Go passes uninterrupted to the launch panel – no double confirm');

  G.confirm = function(){ return true; };
  rows.forEach(function(r){ delete r.gateDec; delete r.gateAt; delete r.pstatus; });
  if (G.data.tracking && G.data.tracking[13]) { G.data.tracking[13].status = ''; delete G.data.tracking[13].killSunkIds; }
  G.saveDone12();
  ok(!!(G.data.completedSteps||{})['1.2'] && !!(G.data.stepDoneAt||{})['1.2'], 'CONFIRM: accepting completes the step and stamps it');
  G.bpRowSave(13, 'dev', rows[0].id, 'pstatus', 'complete');
  eq(rows[0].pstatus, 'complete', 'CONFIRM: accepting the phase-status dialog commits the phase');

  G.confirm = _cf;
  G.data = JSON.parse(_snap); G.saveData();
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'CONFIRM: restore returns the base identity');
})();

/* ─── HARTWELL (July 9, item 9 acceptance): scenario 1, engine-verified in the QA chat (S2-J) ───
   Fresh org · period start 2026-01-01 · 3-year window · anchor month 1 · one project.
   Plan: dev $60K m1-3 + dev $40K m4-6 + roll $30K m7-12 + sus $20K/yr m13-ongoing.
   Verified: bpFirstOpMonth 13 · monthly {dev 100000, roll 30000, sus 40000} · window {inW 170000, beyond 0} · total 170000. */
(function(){
  const curOrg = G.currentOrgId, orgs0 = G.getOrgs().length;
  G.createOrg('Hartwell Mutual', null);
  const hw = G.currentOrgId;
  ok(hw !== curOrg, 'HARTWELL: fixture runs in its own fresh org');
  G.data.ideas = [{name:'Claims Triage Pilot', when:'now'}];
  G.data.selected = [0]; G.data.expSelected = [0];
  G.data.projects = {0:{viable:true, objectives:'Cut triage time', startDate:'2026-01-01'}};
  G.data.experiments = {0:{budget:'$100,000'}};
  G.data.opsData = {0:{rolloutCost:'$30,000', runCost:'$20,000'}};
  G.data.capital = {aiBudget:'$1,200,000', periodStart:'2026-01-01', envYears:'3'};
  G.data.budgetPlans = {0:{
    dev: [ {id:'h1', name:'Design & build experiment', from:'1', to:'3', cost:'$60,000'},
           {id:'h2', name:'Run & evaluate', from:'4', to:'6', cost:'$40,000'} ],
    roll: [ {id:'h3', name:'Production rollout', from:'7', to:'12', cost:'$30,000'} ],
    sus: [ {id:'h4', name:'Operational sustainment', from:'13', to:'ongoing', items:[{id:'s1', name:'Ops', cost:'$20,000'}]} ]
  }};
  G.data.capStale = true; G.saveData();

  eq(G.bpFirstOpMonth(0), 13, 'HARTWELL: first operational month lands at 13');
  const mm = G.bpMonthly(0); let md=0, mr=0, ms=0;
  mm.forEach(function(r){ md+=r.dev; mr+=r.roll; ms+=r.sus; });
  ok(Math.abs(md-100000)<=1 && Math.abs(mr-30000)<=1, 'HARTWELL: monthly dev 100,000 and rollout 30,000');
  ok(Math.abs(ms-40000)<=1, 'HARTWELL: sustainment spreads 24 in-window months at $20K/12 – 40,000');
  const w = G.capProjectWindow(0);
  ok(Math.abs(w.inW-170000)<=1 && Math.round(w.beyond)===0, 'HARTWELL: project window {inW 170000, beyond 0}');
  eq(Math.round(G.capCommitments().total), 170000, 'HARTWELL: committed total reads 170,000 exactly (engine-verified S2-J)');
  eq(Math.round(G.capLens().tot.committed), 170000, 'HARTWELL: the lens every money surface consumes carries 170,000 \u2013 Hub, Commit & Advance, and Capital Snapshot agree by construction');

  /* guard side (S2-J Q2): same rows, costs but no spans → simple path carries, warning shows */
  ['h1','h2'].forEach(function(id){ var r=G.bpRows(0,'dev').filter(function(x){return x.id===id})[0]; r.from=''; r.to=''; });
  (function(){ var r=G.bpRows(0,'roll')[0]; r.from=''; r.to=''; })();
  (function(){ var p=G.bpRows(0,'sus')[0]; p.from=''; })();
  G.data.capStale = true; G.saveData();
  ok(G.bpPlanLive(0)===false, 'HARTWELL Q2: costs without spans leave the plan not-live');
  eq(G.devCost(0), 100000, 'HARTWELL Q2: committed development falls back to the simple $100K – not $0');
  eq(Math.round(G.capCommitments().total), 100000, 'HARTWELL Q2: total reads the simple estimate, 100,000');
  const warn = G.bpBudgetTab(0, true);
  ok(warn.indexOf('Phase date ranges not set')>=0 && warn.indexOf('Design &amp; build experiment is not contributing')>=0, 'HARTWELL Q2: the visible warning names the undated costed rows');

  /* all fields empty (addProgDefault default state): simple path, no warning */
  G.bpRows(0,'dev').forEach(function(r){ r.cost=''; });
  G.bpRows(0,'roll')[0].cost='';
  G.bpRows(0,'sus')[0].items[0].cost='';
  G.data.capStale = true; G.saveData();
  eq(Math.round(G.capCommitments().total), 100000, 'HARTWELL Q2: the default empty plan leaves the simple path in charge');
  ok(G.bpBudgetTab(0, true).indexOf('Phase date ranges not set')<0, 'HARTWELL Q2: no warning when no row holds money');

  G.switchToOrg(curOrg);
  { const _ia10 = G.isAppAdmin; G.isAppAdmin = true; G.adminDeleteOrg(hw); G.isAppAdmin = _ia10; } /* Sweep 4R item 10: the console's functions are the app administrator's */
  eq(G.getOrgs().length, orgs0, 'HARTWELL: the fixture org is cleaned up');
  ok(Math.abs(G.capCommitments().total - 3246249) <= 1, 'HARTWELL: the seed org identity is untouched');
})();

/* ── THEME: light default, toggle, persistence, reseed immunity (16 Sep 2026, Paul's ruling: the app boots light; the six pins written for a dark default were corrected, not the app) ── */
(function(){
  eq(G.UI.theme, 'light', 'THEME: boots light by default');
  ok(localStorageStub.getItem('pipeline-theme') !== 'dark', 'THEME: no dark preference written until the user chooses (the session seal writes light, Part S, 2 Oct 2026)');
  has(G.printThemeTokens(), '--paper:#1E2530', 'THEME: print windows define the light tokens');
  has(G.printThemeTokens(), "--mono:'DM Mono'", 'THEME: print tokens carry the font faces');
  noThrow(() => G.toggleTheme(), 'THEME: toggleTheme() runs (incl. its render())');
  eq(G.UI.theme, 'dark', 'THEME: toggle flips light to dark');
  eq(localStorageStub.getItem('pipeline-theme'), 'dark', 'THEME: dark preference persists to pipeline-theme');
  noThrow(() => G.seedData(), 'THEME: reseed runs under dark');
  eq(G.UI.theme, 'dark', 'THEME: seedData() leaves the theme untouched');
  eq(localStorageStub.getItem('pipeline-theme'), 'dark', 'THEME: reseed leaves the stored preference untouched');
  // The nav renders only behind the entry gate, so borrow a seeded identity
  // (same fixture pattern as the harness bootstrap) for the menu assertions.
  const _prevUser = G.currentUserId;
  G.currentUserId = (G.USERS[0] || {}).id || null;
  ok(!!G.getCurrentUser(), 'THEME: menu fixture signs in a seeded user');
  G.UI.navMore = true; G.render();
  has(G.document.getElementById('navRight').innerHTML, 'Light Mode', 'THEME: the top-bar toggle offers light from dark');
  G.setTheme('light');
  eq(G.UI.theme, 'light', 'THEME: setTheme restores light');
  eq(localStorageStub.getItem('pipeline-theme'), 'light', 'THEME: light preference persists');
  G.UI.navMore = true; G.render();
  has(G.document.getElementById('navRight').innerHTML, 'Dark Mode', 'THEME: the top-bar toggle offers the return path from light');
  has(G.document.getElementById('navRight').innerHTML, 'Track Program</button>', 'THEME: Track Program lives in the More menu');
  G.UI.navMore = false; G.currentUserId = _prevUser; G.render();
})();

/* ── WARN: warning register themed for light mode (July 10) ── */
(() => {
  has(G.printThemeTokens(), '--warn-text:#8F6A00', 'WARN: print windows carry the light warning-text token');
  has(G.printThemeTokens(), '--warn-pale:#7E6A00', 'WARN: print windows carry the pale warning token');
  G.seedData();
  const p = G.renderStepAlloc() + G.renderCapHub();
  has(p, 'stroke="#E8D48B"', 'WARN: the contingency line keeps its literal stroke for the SVG remap (dark bit-identical)');
  has(p, 'stroke="#D4A017"', 'WARN: the capacity line keeps its literal stroke for the SVG remap');
})();

/* ── QA batch items 12–13 (July 10) ─────────────────────────── */
(() => {
  // Item 12: 1.3 empty state branches on WHY the grid is empty.
  G.seedData();
  G.getStages().bluesky.forEach(i => { G.data.ideas[i].when = 'future'; });
  const sParked = G.renderStep13();
  has(sParked, 'All remaining ideas are parked as Future', 'QA12: Future-parked-only empty state names the parked path');
  ok(sParked.indexOf('advanced to Step 2.4') === -1, 'QA12: the parked state does not render the advanced clause');
  G.seedData();
  G.getStages().bluesky.forEach(i => { if (G.data.selected.indexOf(i) < 0) G.data.selected.push(i); });
  const sAdv = G.renderStep13();
  has(sAdv, 'Selected ideas have advanced to Step 2.4', 'QA12: all-advanced empty state names the intake path');
  ok(sAdv.indexOf('parked as Future') === -1, 'QA12: the advanced state does not render the parked clause');
  // Item 13: third badge branch reads a real label; no literal undefined in 3.4's visible text.
  G.seedData();
  if (G.data.budgetPlans) delete G.data.budgetPlans[11];
  const sx = G.renderStepExp();
  has(sx, 'no program yet', 'QA13: a project with no defined phases badges as no program yet');
  ok(sx.replace(/<[^>]*>/g, ' ').indexOf('undefined') === -1, 'QA13: visible-text oracle \u2013 no literal undefined on 3.4 in the pre-fill state');
  G.seedData();
})();

// ===== PW: phase-complete wrap-up boxes (July 10) =====
(function(){
  const _page = G.currentPage, _step = G.currentStep, _ph = G.currentPhase;
  G.seedData();
  G.data.completedSteps = Object.assign({}, G.data.completedSteps, {'2.1':true,'2.2':true,'2.3':true,'2.4':true});
  G.currentPage = 'step'; G.currentPhase = G.PH.find(function(p){ return p.id === 2; }); G.currentStep = '2.4';
  const p24 = G.renderStep();
  has(p24, 'Phase 2 Complete', 'PW: the final step of a complete phase renders the phase-complete box');
  has(p24, 'machinery now exists', 'PW: the box carries the Phase 2 wrap-up copy');
  G.currentStep = '2.1';
  const p21 = G.renderStep();
  ok(p21.indexOf('Phase 2 Complete') === -1, 'PW: a non-final step of the complete phase does not render the box');
  const land = G.renderPhaseLandingPipe(2);
  has(land, 'Phase 2 Complete', 'PW: the phase landing shows the wrap-up at 100%');
  delete G.data.completedSteps['2.3']; G.currentStep = '2.4';
  const p24b = G.renderStep();
  ok(p24b.indexOf('Phase 2 Complete') === -1, 'PW: an incomplete phase renders no box');
  const landB = G.renderPhaseLandingPipe(2);
  ok(landB.indexOf('Phase 2 Complete') === -1, 'PW: the landing shows no wrap-up below 100%');
  G.seedData(); G.currentPage = _page; G.currentStep = _step; G.currentPhase = _ph;
})();

// ===== RVB: Revive replaces Sell on killed review rows (July 10) =====
(function(){
  G.seedData();
  if(!G.data.review)G.data.review={}; if(!G.data.review.items)G.data.review.items={};
  G.data.review.items[13]={decision:'sell'};
  if(!G.data.tracking)G.data.tracking={}; G.data.tracking[13]={status:'killed',killSunkIds:['x']};
  const r1 = G.renderStep44();
  has(r1, 'reviveReviewItem(13)', 'RVB: a killed row offers the green Revive button in Sell\u2019s slot');
  ok(r1.indexOf("setReviewDecision(13,'sell')") === -1, 'RVB: the Sell button is absent while killed');
  G.reviveReviewItem(13);
  ok(G.data.tracking[13].status === '' && !G.data.tracking[13].killSunkIds && !((G.data.review.items||{})[13]||{}).decision, 'RVB: Revive clears the kill, the frozen set, and the Sell decision');
  const r2 = G.renderStep44();
  ok(r2.indexOf("setReviewDecision(13,'sell')") >= 0 && r2.indexOf('reviveReviewItem(13)') === -1, 'RVB: after revive, Sell returns and Revive is gone');
  G.seedData();
})();

/* ── P-2 (Directive P-2, 17 Aug 2026; applied 13 Sep 2026): every PDF button is the family ghost form "\u25be Save as PDF" ── */
(function(){
  G.seedData();
  if(!G.data.completedSteps)G.data.completedSteps={}; G.data.completedSteps['4.2']=true; // the Governance Framework output gates on step 4.2 being complete
  const sites = [
    ['renderMgmtHub','printMgmtAnalytics'], ['renderOutReport','printReport'], ['renderOutOrgReady','printOrgReady'],
    ['renderOutGovFW','printGovFW'], ['renderOutCapplan','printCapPlan'], ['renderOutRaciFull','printRaci']
  ];
  sites.forEach(function(s){
    const out = noThrow(() => G[s[0]](), 'P-2: ' + s[0] + '() runs') || '';
    has(out, '<button class="btn bg2" style="font-size:12px" onclick="' + s[1] + '()">\u25be Save as PDF</button>', 'P-2: ' + s[0] + ' carries the ghost Save as PDF button wired to ' + s[1]);
    ok(out.indexOf('\u2193 PDF') < 0 && out.indexOf('Download as PDF') < 0, 'P-2: ' + s[0] + ' carries no filled PDF/Download button');
  });
  eq((code.match(/Download as PDF|\u2193 PDF|\\u2193 PDF/g) || []).length, 0, 'P-2: zero old-form PDF button strings remain anywhere in app.js (checklist item 3)');
  eq((code.match(/class="btn bg2" style="font-size:12px" onclick="print[A-Za-z]+\(\)">\\u25be Save as PDF/g) || []).length, 6, 'P-2: exactly six ghost-form PDF button literals in source');
  G.seedData();
})();

/* ── CAPITAL SNAPSHOT REPORT (Paul's ruling, 13 Sep 2026): its own document, every budget year then the total ── */
(function(){
  G.seedData();
  const Y = G.envYearsOf();
  const doc = noThrow(() => G.capReportBody(), 'CSR: capReportBody() runs under seed data') || '';
  for (let y = 1; y <= Y; y++) has(doc, 'class="cr-h">Budget Year ' + y + '<', 'CSR: a Budget Year ' + y + ' section header');
  has(doc, 'class="cr-h">Budget Total \u2013 ' + Y + ' years<', 'CSR: the Budget Total section header names the year count');
  eq((doc.match(/class="cr-lists"/g) || []).length, Y + 1, 'CSR: every section starts its committed lists on a new page');
  eq((doc.match(/Capacity Waterfall/g) || []).length, Y + 1, 'CSR: every section carries its capacity waterfall');
  eq((doc.match(/The Committed Calendar/g) || []).length, Y + 1, 'CSR: every section carries its committed calendar');
  eq((doc.match(/Committed \u2013 Development/g) || []).length, Y + 1, 'CSR: every section lists the committed development items');
  eq((doc.match(/Exploration \(potential/g) || []).length, 1, 'CSR: the Exploration list appears once, in the Total section');
  has(doc, '>Program phase<', 'CSR: the Total section tabulates the program phases');
  ok(doc.indexOf('<button') < 0 && doc.indexOf('onclick=') < 0, 'CSR: the report carries no controls (report law)');
  ok(doc.indexOf('#F5F2EC') < 0 && doc.indexOf('#B8B0A4') < 0, 'CSR: no dark-theme screen inks leak into the paper document');
  has(doc, 'Landing in Year 1:', 'CSR: year sections show what lands in the year');
  has(doc, 'Within the planning window:', 'CSR: the Total section shows the whole plan');
  const K = G.capKpiData('T'); ok(K && K.t3.label === 'Sustainment share' && K.isT, 'CSR: capKpiData total lens matches the screen strip\u2019s wording');
  G.UI.capYear = 1; has(G.capKpiStrip(), 'Committed, Year 1', 'CSR: the screen KPI strip still reads from the shared derivation');
  has(G.renderOutCapplan(), G.capSnapLead(), 'CSR: the screen heading carries the shared snapshot lead');
  ok(typeof G.printDocument === 'function' && typeof G.printPage === 'function', 'CSR: printDocument exists beside printPage');
  ok(/printDocument\('Capital Snapshot',printDocCover\('Capital Snapshot',capSnapLead\(\),''\)\+capReportBody\(\),CAP_REPORT_CSS\)/.test(code), 'CSR: printCapPlan prints the report document, not the screen');
  const cssPath = path.join(__dirname, 'styles.css');
  if (fs.existsSync(cssPath)) { const css = fs.readFileSync(cssPath, 'utf8');
    has(css, '.flx-between-top-mb>:first-child{flex:1 1 0;min-width:0}', 'CSR/CSS: the output heading keeps the print control on the title line');
    has(css, '.btn.bg2{white-space:nowrap;padding:7px 14px;border-radius:6px;align-self:flex-start;height:fit-content}', 'P-2/CSS: the ghost shape rule is present'); }
  G.seedData();
})();


/* ── R2 (16 Sep 2026, Paul's rulings; family): the reporting engine, the idea record, the five register documents, the output print control ── */
(function(){
  G.seedData();
  if(typeof G.PRINT_DOCS!=='object'||typeof G.lyRegister!=='function'){ok(false,'R2: the reporting engine and the register documents are defined'); return}
  ok(typeof G.lyRegister==='function' && typeof G.LAYER_MAPS==='object' && !!G.LAYER_MAPS.idea, 'R2: the reporting engine and the idea record are defined');
  (function(){var ids=[];G.PH.forEach(function(p){(p.outcomes||[]).forEach(function(o){ids.push(o.id)})});ids.push('out-devport');var missing=ids.filter(function(id){return typeof G.PRINT_DOCS[id]!=='function'});eq(missing.join(','),'','R2: every output in the sidebar has a document (the registers of round 2, the rest in round 3; the pin retargeted 16 Sep 2026 from a fixed key list to the sidebar\'s own list, which round 4\'s Phase 5 keys no longer trip)')})();
  eq(G.LAYER_MAPS.idea.layers.map(function(l){return l.id}).join(','), 'idea,rank,exploration,portfolio,capital,development,review,operations', 'R2: the idea record has its eight layers in stage order (the brief left 17 Sep 2026: its fields had no writer)');
  const st=G.getStages(); const c=function(d,re){return (d.match(re)||[]).length};
  G.UI.printDepth='summary';
  const bs=G.PRINT_DOCS['out-bluesky']();
  eq(c(bs,/min-height:85vh/g), 1, 'R2: Blue Sky prints one cover');
  eq(c(bs,/class="ly-rec"/g), st.bluesky.length, 'R2: Blue Sky prints every unselected idea as a record table');
  has(bs, '>At a Glance</div>', 'R2: Blue Sky opens with At a Glance');
  has(bs, 'NextChapter \u00b7 90-Day AI Innovation Pipeline', 'R2: the cover carries the family kicker');
  ok(!/<button|onclick=/.test(bs), 'R2: the Blue Sky document carries no control');
  const ex=G.PRINT_DOCS['out-explore']();
  eq(c(ex,/border-bottom:1px solid #ddd;background:#f4f4f4/g), st.explore.length+(st.noGo||[]).length, 'R2: Exploration prints the explore set and the No-Go set (retargeted 17 Sep 2026: as Overview cards, not record tables)');
  has(ex, '<div>Go</div>', 'R2: Exploration groups by verdict');
  has(ex, 'Go \u00b7 ', 'R2: the verdict rides on each card\'s name bar');
  const dv=G.PRINT_DOCS['out-expbriefs']();
  eq(c(dv,/border-bottom:1px solid #ddd;background:#f4f4f4/g), st.experiment.length, 'R2: Development prints the experiment set (retargeted 17 Sep 2026: as development cards)');
  eq(c(dv,/>Development program</g), st.experiment.length, 'R2: each card opens with the development program (retargeted 17 Sep 2026: Step 3.4\'s record replaced the retired brief)');
  has(dv, '>Objectives<', 'R2: the program prints its objectives');
  has(dv, 'Success metrics:', 'R2: and each phase\'s success metrics');
  const op=G.PRINT_DOCS['out-oper']();
  eq(c(op,/border-bottom:1px solid #ddd;background:#f4f4f4/g), st.operational.length, 'R2: Operational prints the operational set (retargeted 17 Sep 2026: as operations cards)');
  eq(c(op,/>Rollout costs</g), st.operational.length, 'R2: each card is the operations record \u2014 owner, launch date, rollout costs, annual sustainment in its corners (retargeted 17 Sep 2026)');
  ok(/color:#(1B6B5A|D4A017|9B2D3F);font-weight:700">(Green|Amber|Red|Killed)/.test(op), 'R2: health rides the name bar in the page\'s colours');
  has(op, '>Performance vs. success metric<', 'R2: operations print performance against the success metric');
  const fp=G.PRINT_DOCS['out-finalport']();
  has(fp,'>The Decisions</div>','R2: the Portfolio Review prints the decisions (retargeted 17 Sep 2026: Ignite\'s third output is the review from Step 4.4)');
  ['out-bluesky','out-explore','out-expbriefs','out-oper'].forEach(function(id){ /* out-finalport left the list 17 Sep 2026: the Portfolio Review is one document */
    G.UI.printDepth='summary'; var a=c(G.PRINT_DOCS[id](),/<tr>/g); G.UI.printDepth='full'; var b=c(G.PRINT_DOCS[id](),/<tr>/g);
    ok(b>a*1.5, 'R2: '+id+' at Full prints well over its Summary ('+a+' -> '+b+' rows)');
  });
  G.UI.printDepth='summary';
  eq(G.outcomeNameOf('out-finalport'), 'Portfolio Review', 'R2: Ignite\'s third output is the Portfolio Review (retargeted 17 Sep 2026)');
  eq(G.outcomeNameOf('out-report'), 'Assessment Report', 'R2: an output\'s paper name is its sidebar name');
  G.currentStep='out-bluesky'; const pg=G.renderOutBluesky();
  eq(c(pg,/>DEPTH</g), 1, 'R2: the Blue Sky page carries the Summary / Full control');
  has(pg, 'printCurrentOutput()', 'R2: the Blue Sky page\'s Save as PDF prints through printCurrentOutput');
  G.currentStep='out-expbriefs'; eq(c(G.renderOutExpbriefsFull(),/>DEPTH</g), 1, 'R2: the Development page carries the control (retargeted 17 Sep 2026: out-finalport is the Portfolio Review now)');
  eq(c(G.renderOutExploreEnhanced(),/Save as PDF/g), 1, 'R2: the Exploration page carries Save as PDF');
  eq(c(G.renderOutOperFull(),/Save as PDF/g), 1, 'R2: the Operational page carries Save as PDF');
  var out=''; const _open=G.window.open; G.window.open=function(){return {document:{write:function(h){out+=h},close:function(){}},focus:function(){},print:function(){}}};
  G.currentStep='out-orgrev'; G.currentPage='outcome';
  noThrow(function(){G.printCurrentOutput()}, 'R2: printCurrentOutput runs for an output without a composed document');
  has(out, '90-Day AI Innovation Pipeline', 'R2: it prints the cover with the family kicker');
  has(out, 'Org Design Review', 'R2: it names the output on the cover');
  out=''; G.currentStep='out-bluesky'; noThrow(function(){G.printCurrentOutput()}, 'R2: printCurrentOutput runs for an output with a document');
  has(out, 'class="ly-rec"', 'R2: it prints the composed register, not the page');
  G.window.open=_open;
  G.seedData();
})();


/* ── R3 (16 Sep 2026, Paul's rulings; family): the outputs that are not registers, composed for paper ── */
(function(){
  G.seedData();
  if(typeof G.assessmentReportDoc!=='function'){ok(false,'R3: the composed documents are defined'); return}
  if(!G.data.completedSteps)G.data.completedSteps={}; G.data.completedSteps['4.2']=true; G.data.completedSteps['4.3']=true;
  const c=function(d,re){return (d.match(re)||[]).length};
  const ar=G.assessmentReportDoc();
  eq(c(ar,/min-height:85vh/g),1,'R3: the Assessment Report prints one cover');
  has(ar,'<div>Executive Summary</div>','R3: the Assessment Report opens with its Executive Summary');
  has(ar,'decision-rights gap','R3: the summary counts the decision-rights gaps');
  has(ar,'<div>Readiness Profile</div>','R3: the five Phase 1 dimensions print as bars'); eq(c(ar,/height:7px;width:/g),5,'R3: five bars, one per dimension');
  has(ar,'>Decision Rights</div>','R3: the decision rights print'); has(ar,'>Approve experiments<','R3: each decision right is a labelled row'); has(ar,'Gap: ','R3: a gap prints beneath the holder');
  ok(!/<button|onclick=/.test(ar),'R3: the Assessment Report carries no control');
  const orr=G.orgReadinessDoc();
  has(orr,'owns the pipeline','R3: Org Readiness opens with its summary'); has(orr,'<div>Pipeline Owner</div>','R3: the owner section prints'); has(orr,'<div>Embedded Leads</div>','R3: the leads print'); has(orr,'<div>Innovation Rhythm</div>','R3: the rhythm prints'); has(orr,'>Standing agenda<','R3: the standing agenda prints as a list'); has(orr,'<div>Organizational Readiness</div>','R3: the readiness checks print'); has(orr,'background:#111;color:#fff','R3: a met check shows a tick (retargeted 17 Sep 2026 from the word Done: the checklist prints as a checklist)');
  const gf=G.govFrameworkDoc();
  has(gf,'>Standing Leadership Agenda</div>','R3: the first governance mechanism prints'); has(gf,'>Pipeline Intake Rule</div>','R3: the second'); has(gf,'>Quarterly Review</div>','R3: the third'); has(gf,'>Outside-pipeline audit</div>','R3: the audit row prints under its own label (retargeted 17 Sep 2026: the page\'s cards, not section rows)');
  const od=G.orgDesignReviewDoc();
  has(od,'<div>The Stress Test</div>','R3: the stress test prints under its heading'); eq(c(od,/border:1px solid #ddd;border-radius:6px;padding:14px 16px/g),4,'R3: four boxes, one per area (retargeted 16 Sep 2026 from four bars: the page\'s box grid is kept on paper, the Decision Analyses ruling)'); has(od,'<div>Adjustment Plan</div>','R3: the adjustment plan prints'); has(od,'>1. ','R3: the adjustments are numbered');
  const rc=G.raciDoc();
  has(rc,'@page raciland{size:landscape;margin:8mm 8mm 14mm 8mm}','R3: the RACI matrix takes a landscape page of its own'); has(rc,'.raci-land{page:raciland;break-before:page;page-break-before:always;width:990px;margin-left:0;display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 15vh)}','R3: the landscape block sits at the page-area edge, sized to the sheet, its matrix centred (the centring joined the rule 17 Sep 2026)'); has(rc,'@media print and (max-width:800px){.raci-land{width:1058px}}','R3: A4 widens it'); eq(c(rc,/<tr><td/g),7,'R3: seven activities'); eq(c(rc,/<th /g),G.raciCols().length+1,'R3: a column per role'); has(rc,'Responsible \u2014 does the work','R3: the legend prints beneath the matrix (retargeted 17 Sep 2026 to Governance\'s legend row)'); ok(!/<select|<button|onclick=/.test(rc),'R3: the matrix prints without its selects');
  const cp=G.PRINT_DOCS['out-capplan'](); has(cp,'<style>'+G.CAP_REPORT_CSS.slice(0,40),'R3: the Capital Snapshot document carries its own stylesheet'); eq(c(cp,/min-height:85vh/g),1,'R3: and its cover');
  G.UI.hubTab=0; G.currentPage='cap-hub'; const hb=G.capHubDoc(); has(hb,'Capital Planning Hub \u2014 Dashboard','R3: the Capital Planning Hub prints the tab showing, named on its cover'); ok(!/<button/.test(hb),'R3: the hub document carries no button');
  ok(G.printReport.toString().indexOf('assessmentReportDoc()')>=0 && G.printOrgReady.toString().indexOf('orgReadinessDoc()')>=0 && G.printGovFW.toString().indexOf('govFrameworkDoc()')>=0 && G.printRaci.toString().indexOf('raciDoc()')>=0,'R3: the four per-output print functions print the composed documents');
  G.currentStep='out-orgrev'; eq(c(G.renderOutOrgRev(),/Save as PDF/g),1,'R3: the Org Design Review page carries Save as PDF'); eq(c(G.renderOutOrgRev(),/>DEPTH</g),0,'R3: and no depth control (one form)');
  eq(c(G.renderCapHub(),/printCapHub\(\)/g),1,'R3: the Capital Planning Hub page carries Save as PDF');
  const sec=G.erSection('T',G.lyRow('a','b'),'s'); has(sec,'<div>T</div><div style="font-family:var(--mono,monospace);font-size:12px;font-weight:400;color:#666;margin-top:4px;line-height:1.4">s</div>','R3: a section heading sets its sub-line beneath the title (erSection reads erHead)');
  G.seedData();
})();


/* ── R4 (16 Sep 2026, Paul's rulings; family): the Phase 5 documents and their dispatch ── */
(function(){
  G.seedData();
  if(typeof G.pipelineDashboardDoc!=='function'||typeof G.mgmtHubDoc!=='function'){ok(false,'R4: the Phase 5 documents are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  const d=G.pipelineDashboardDoc();
  eq(c(d,/min-height:85vh/g),1,'R4: the Pipeline Dashboard prints one cover'); has(d,'class="gd-sec">Pipeline Overview</div>','R4: it opens with the overview (retargeted 17 Sep 2026: the Governance dashboard document copied)'); has(d,'class="viz-gauge-label"','R4: the gauge\'s own label prints under it'); eq(c(d,/class="viz-gauge-svg"/g),1,'R4: the gauge prints'); eq(c(d,/class="viz-dim-row"/g),4,'R4: the page\'s four phase bars beside it, nothing added (retargeted 17 Sep 2026, Paul\'s ruling)');
  has(d,'>Next Innovation Session<','R4: the next session card prints'); has(d,'>Next Quarterly Review<','R4: the next quarterly review card'); ok(d.indexOf('>The Pipeline</div>')<0,'R4: the pipeline page carries no label'); eq(c(d,/class="gd-lane"/g),4,'R4: a lane per portfolio in its colour'); has(d,'Balance Map','R4: the balance map prints in its box');
  ok(!/<button|onclick=/.test(d),'R4: the dashboard document carries no control');
  const st=G.getStages(); const names=(G.data.ideas||[]).filter(function(x,i){return st.explore.indexOf(i)>=0}).map(function(x){return x.name}); ok(names.every(function(n){return d.indexOf(G.esc(n))>=0}),'R4: every idea in exploration is named in its portfolio box, not "+n more"');
  const m=G.mgmtHubDoc();
  eq(c(m,/min-height:85vh/g),1,'R4: the Module Management document prints one cover'); has(m,'>This Week</div>','R4: This Week'); has(m,'>Assignments</div>','R4: Assignments'); eq(c(m,/class="mh-ph"/g),4,'R4: the four shared phases'); ok(c(m,/<tr><td class="mh-id">/g)>=G.mgSteps().length,'R4: every shared step prints'); has(m,'>Analytics</div>','R4: the analytics page'); has(m,'90-Day Burn-up','R4: the burn-up'); has(m,'Workload by Member','R4: the workload'); ok(!/<button|onclick=|<input/.test(m),'R4: no control prints');
  ok(G.printMgmtAnalytics.toString().indexOf("printDocument('Module Management',mgmtHubDoc(),'')")>=0,'R4: the Track Program page prints the document');
  var out=''; const _open=G.window.open; G.window.open=function(){return {document:{write:function(h){out+=h},close:function(){}},focus:function(){},print:function(){}}};
  G.currentPage='phase5'; G.currentStep='5.1'; noThrow(function(){G.printCurrentPage()},'R4: printCurrentPage runs on the dashboard'); has(out,'>Pipeline Overview</div>','R4: the dashboard prints its composed document');
  out=''; G.currentPage='cap-hub'; noThrow(function(){G.printCurrentPage()},'R4: printCurrentPage runs on the Capital Planning Hub'); has(out,'Capital Planning Hub','R4: the hub prints its document');
  out=''; G.currentPage='mgmt-hub'; noThrow(function(){G.printCurrentPage()},'R4: printCurrentPage runs on Track Program'); has(out,'>This Week</div>','R4: Track Program prints the Module Management document');
  G.window.open=_open; G.currentPage='pipeline'; G.seedData();
})();


/* ── R5 (16 Sep 2026, Paul's rulings; family): the Report Manager ── */
(function(){
  G.seedData();
  if(typeof G.rcCompile!=='function'||typeof G.renderReports!=='function'){ok(false,'R5: the Report Manager is defined'); return}
  if(!G.data.completedSteps)G.data.completedSteps={}; G.data.completedSteps['4.2']=true; G.data.completedSteps['4.3']=true;
  const c=function(d,re){return (d.match(re)||[]).length};
  const cat=G.rcCatalogue(); const groups={}; cat.forEach(function(u){groups[u.group]=(groups[u.group]||0)+1});
  eq(Object.keys(groups).join('|'),'Outputs \u00b7 Phase 1|Outputs \u00b7 Phase 2|Outputs \u00b7 Phase 3|Outputs \u00b7 Phase 4|Outputs \u00b7 Phase 5|Phase 5 pages|Individual Ideas','R5: the catalogue groups the outputs by phase, then the Phase 5 pages, then the ideas');
  eq(groups['Phase 5 pages'],3,'R5: three Phase 5 pages (dashboard, capital hub, module management)'); eq(groups['Individual Ideas'],(G.data.ideas||[]).length,'R5: every idea is offered'); ok(!cat.some(function(u){return u.kind==='output'&&u.id==='cap-hub'}),'R5: the Capital Planning Hub is a page, not an output');
  const rp=G.renderReports(); has(rp,'class="content-inner rc-page"','R5: the Report Manager page carries the centring class'); has(rp,'individual ideas','R5: its lead speaks of ideas');
  G.data.reportDefs=[]; G.rcNew(); const dd=G.rcDefs()[0]; G.rcSet(dd.id,'name','Board pack');
  ['output:out-report','output:out-bluesky','output:out-raci','page:5.1','page:cap-hub','page:mgmt-hub','record:idea:0'].forEach(function(k){G.rcToggle(dd.id,k,k==='output:out-bluesky'?'summary':undefined)});
  const rc=G.rcCompile(dd.id);
  eq(c(rc,/min-height:85vh/g),1,'R5: a compiled report has one cover'); has(rc,'Board pack','R5: the cover carries the report\'s title'); has(rc,'Contents','R5: a contents page');
  ok(c(rc,/page-break-before:always"><div style="font-family:var\(--serif/g)>=6,'R5: the sections open their own pages; the RACI section does not (its heading rides its landscape page)'); has(rc,'class="raci-land"><div style="font-family:var(--serif','R5: the RACI section\'s heading rides at the top of its landscape page');
  eq(c(rc,/<div>(Dashboard|Commitments|Plan &amp; Funding)<\/div>/g),3,'R5: the Capital Planning Hub section prints all three tabs, each under its name'); has(rc,'class="ly-rec"','R5: an individual idea prints as its record table');
  ok(!/<button|<select|<input|onclick=/.test(rc),'R5: nothing in the compiled report is a control'); ok(!/NaN|undefined/.test(rc),'R5: nothing prints as NaN or undefined');
  const ed=G.rcEditor(dd); eq(c(ed,/rcSetFilter\('st'/g),6,'R5: the Individual Ideas filters offer the stages'); has(ed,'Search ideas by name or department','R5: and a search'); has(ed,'Individual Ideas','R5: the group is named for ideas'); ok(ed.indexOf('Individual Leaders')<0,'R5: nothing left of the leaders wording');
  const F=G.rcLeaderFilter(); F.st='Operational'; eq(cat.filter(function(u){return u.kind==='record'&&G.rcLeaderPasses(u.rec,F)}).length,G.getStages().operational.length,'R5: the stage filter passes exactly the operational ideas'); F.st='all';
  eq(G.rcUnitFact({kind:'output',id:'out-oper'}),G.getStages().operational.length+' live projects','R5: an output\'s fact states its size'); eq(G.rcUnitFact({kind:'record',type:'idea',id:'0'}),G.ideaStageWord(0),'R5: an idea\'s fact is its stage');
  ok(G.rcUnitDesc({kind:'output',id:'out-raci'}).length>20 && G.rcUnitDesc({kind:'record',type:'idea'}).indexOf('idea')>=0,'R5: every kind of content has a one-sentence description');
  G.UI.hubTab=2; const hub=G.capHubDoc(); ok(!/<select|<input|<textarea/.test(hub),'R5: the Plan & Funding tab prints its form fields as text'); G.UI.hubTab=0;
  G.currentPage='reports'; ok(G.sidebarPageShown(),'R5: the Report Manager page shows the sidebar'); const _pu=G.currentUserId; G.currentUserId=(G.USERS[0]||{}).id||_pu; G.UI.navMore=true; G.render(); has(G.document.getElementById('navRight').innerHTML,'Report Manager','R5: the More menu lists the Report Manager (the nav renders behind the sign-in gate, so a seeded identity is borrowed)'); G.UI.navMore=false; G.currentUserId=_pu;
  G.currentPage='pipeline'; G.data.reportDefs=[]; G.seedData();
})();


/* ── R6 (16 Sep 2026): the seed check and the copy pass ── */
(function(){
  G.seedData();
  if(typeof G.LAYER_MAPS!=='object'||!G.LAYER_MAPS.idea){ok(false,'R6: the idea record is defined'); return}
  if(!G.data.completedSteps)G.data.completedSteps={}; G.data.completedSteps['4.2']=true; G.data.completedSteps['4.3']=true;
  const c=function(d,re){return (d.match(re)||[]).length}; const ideas=G.data.ideas||[];
  const layers=G.LAYER_MAPS.idea.layers; const absent=layers.filter(function(l){return l.id!=='review'}).filter(function(l){return !ideas.some(function(_,i){return l.present({i:i})})}).map(function(l){return l.id});
  eq(absent.join(','),'','R6: the seed exercises every layer the registers print (the review layer excepted: the seed sits at day 70, before the Day 90 review)');
  ok(ideas.some(function(_,i){return layers[6].present({i:i})}),'R6: the seed carries a first review\'s decisions (Paul\'s ruling, 17 Sep 2026)');
  const withTrack=Object.keys(G.data.tracking||{}).filter(function(k){return (G.data.tracking[k]||{}).infraLearnings})[0];
  if(withTrack!==undefined){has(G.devCardRO(+withTrack),G.esc((G.data.tracking[withTrack]||{}).infraLearnings).slice(0,40),'R6: the development card shows the infrastructure learnings the step and the seed write (it read a key nothing wrote)')}
  has(G.renderOutOrgReady(),'Standing agenda defined','R6: the readiness checklist prints'); ok(G.rhAgList().length>0,'R6: the seed\'s agenda list is read by the app\'s own helper');
  const chk=G.orgReadinessDoc(); has(chk,'Standing agenda defined</div>','R6: the readiness check prints'); ok(c(chk,/background:#111;color:#fff/g)>=6,'R6: the seed meets at least six of the seven readiness checks (the agenda among them; retargeted 17 Sep 2026 to the tick)');
  let holes=[]; Object.keys(G.PRINT_DOCS).forEach(function(id){['summary','full'].forEach(function(dp){G.UI.printDepth=dp;var d='';try{d=G.PRINT_DOCS[id]()}catch(e){holes.push(id+' threw: '+e.message);return}if(/undefined|NaN/.test(d))holes.push(id+'@'+dp)})}); G.UI.printDepth='summary';
  eq(holes.join(','),'','R6: no document prints undefined or NaN at either depth');
  const bsd=G.PRINT_DOCS['out-bluesky'](); eq(c(bsd,/>Score</g),1,'R6: one unselected idea is fully qualified and scored (Paul\'s ruling, 16 Sep 2026), so Blue Sky prints one Score row'); has(bsd,'>Ranked <span','R6: and a Ranked group'); has(bsd,'34 / 50','R6: with its score out of 50');
  G.seedData();
})();


/* ── R7 (16 Sep 2026, Paul's rulings): the review of every printable surface against the family's rulings ── */
(function(){
  G.seedData();
  if(typeof G.PIPE_CHART_CSS!=='string'){ok(false,'R7: the chart stylesheet for paper is defined'); return}
  if(!G.data.completedSteps)G.data.completedSteps={}; G.data.completedSteps['4.3']=true;
  const c=function(d,re){return (d.match(re)||[]).length};
  const d=G.pipelineDashboardDoc();
  has(d,'class="gd-sub">Portfolio at a Glance</div>','R7: the dashboard document carries the analytics charts under their heading');
  ['Stage Distribution','Committed Capital','Portfolio Map','Status Breakdown','Team Load'].forEach(function(t){has(d,t,'R7: the chart '+t+' prints')});
  eq(c(d,/<style>\.user-av/g),1,'R7: the charts\' stylesheet rules travel with the document, once'); has(d,'.chart-card{break-inside:avoid;page-break-inside:avoid}','R7: a chart card never splits across pages');
  eq(c(d,/onclick=/g),0,'R7: no click handler survives into the document'); eq(c(d,/cursor:pointer/g),0,'R7: nor a pointer cursor');
  eq((d.match(/class="viz-dim-name">([^<]+)</g)||[]).map(function(x){return x.replace(/.*>([^<]+)</,'$1')}).join(','),'Diagnose,Organize,Prepare,Ignite','R7: the four phase bars exactly as the dashboard page draws them (retargeted 17 Sep 2026)');
  const a=G.assessmentReportDoc(); ok(!/Decision gaps[\s\S]{0,300}#9B2D3F|#9B2D3F[\s\S]{0,300}Decision gaps/.test(a),'R7: the Assessment Report\'s single figure is not coloured (one colour component is too few)'); eq(c(a,/height:7px;width:/g),5,'R7: its five bars remain');
  const o=G.orgDesignReviewDoc(); eq(c(o,/border:1px solid #ddd;border-radius:6px;padding:14px 16px/g),4,'R7: the Org Design Review prints the page\'s four boxes'); eq(c(o,/border-spacing:8px 0/g),2,'R7: in two rows of two'); eq(c(o,/height:7px;width:/g),0,'R7: not as bars'); ok(c(o,/#(1B6B5A|8B5E3C|9B2D3F)/g)>0,'R7: the score chips in the page\'s colours (retargeted 17 Sep 2026: colour where the screen has it)'); has(o,'<div>Adjustment Plan</div>','R7: the adjustment plan follows');
  G.UI.printDepth='summary'; ['out-bluesky','out-explore','out-expbriefs','out-oper'].forEach(function(id){const r=G.PRINT_DOCS[id]();const i=r.indexOf('>At a Glance</div>'); /* out-finalport left the list 17 Sep 2026: it is the Portfolio Review */ok(i>0&&r.slice(i-420,i).lastIndexOf('font-size:28px')>=0,'R7: '+id+' heads its figures at 28px, a step above its groups\' 24px')});
  G.seedData();
})();


/* ── R8 (17 Sep 2026, Paul's rulings from his printout pass): the Assessment Report's radar and Full version; the Blue Sky portfolio balance ── */
(function(){
  G.seedData();
  if(typeof G.ideaBalanceBlock!=='function'||typeof G.PIPE_RADAR_CSS!=='string'){ok(false,'R8: the radar stylesheet and the balance block are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  G.UI.printDepth='summary'; const a=G.assessmentReportDoc(); G.UI.printDepth='full'; const f=G.assessmentReportDoc(); G.UI.printDepth='summary';
  eq(c(a,/class="viz-radar"/g),1,'R8: the Assessment Report prints the radar'); eq(c(a,/<style>\.viz-radar/g),1,'R8: with its two layout rules'); ok(a.indexOf('class="viz-radar"')>a.indexOf('<div>Readiness Profile</div>'),'R8: the radar follows the Readiness Profile bars');
  ok(a.indexOf('<div>AI Knowledge</div>')<0&&a.indexOf('<div>Risk and Culture</div>')<0&&a.indexOf('<div>AI Innovation Audit</div>')<0,'R8: Summary prints the report as before, plus the radar');
  has(f,'<div>AI Knowledge Base</div>','R8: Full prints the four knowledge answers (the section named as the step names it, 17 Sep 2026)'); has(f,'>Leadership awareness<','R8: the awareness rating among them'); has(f,'<div>Risk and Culture</div>','R8: Full prints the six culture answers'); eq(c(f.slice(f.indexOf('Risk and Culture'),f.indexOf('AI Innovation Audit')),/class="ap-seg/g),30,'R8: as six Likert strips of five segments (retargeted 17 Sep 2026 from bars to the Governance profile\'s form)'); has(f,'<div>AI Innovation Audit</div>','R8: Full prints the innovation audit'); eq(c(f.slice(f.indexOf('AI Innovation Audit')),/<tr>/g),(G.data.audit||[]).length+1,'R8: one row per past initiative (retargeted 17 Sep 2026: the decision rights print as profile blocks at Full)'); has(f,'>Values<','R8: Full prints every purpose field'); has(f,'>Short-term targets<','R8: including the targets');
  ok(f.length>a.length*1.5,'R8: Full prints well over Summary (retargeted 17 Sep 2026 to length: Full\'s sections are profile blocks and strips, not rows)'); ok(!!G.DEPTHED_OUTPUTS['out-report'],'R8: the Assessment Report offers Summary / Full'); ok(!/<button|onclick=/.test(f),'R8: no control prints');
  G.currentStep='out-report'; const pg=G.renderOutReport(); eq(c(pg,/>DEPTH</g),1,'R8: the Assessment page carries the Summary / Full control'); has(pg,'<button class="btn bg2" style="font-size:12px" onclick="printReport()">','R8: beside its Save as PDF button, unchanged');
  const b=G.PRINT_DOCS['out-bluesky'](); const i1=b.indexOf('>At a Glance</div>'),i2=b.indexOf('>Blue Sky Portfolio Balance</div>'),i3=b.indexOf('>The Ideas</div>');
  ok(i1>0&&i2>i1&&i3>i2,'R8: the Blue Sky document prints the portfolio balance on its first page, between the figures and the ideas'); eq(c(b.slice(i2,i3),/<td style="padding:8px 6px/g),9,'R8: three rows of three bands'); eq(c(b.slice(i2,i3),/#(1B6B5A|9B2D3F|8B5E3C)/g),0,'R8: in greys'); has(b.slice(i2,i3),'From intake estimates','R8: with the page\'s own sub-line');
  G.seedData();
})();


/* ── R9 (17 Sep 2026, Paul's rulings): the knowledge scale; the radar centred; the Full Assessment Report in the Governance profile's form ── */
(function(){
  G.seedData();
  if(typeof G.apStrip!=='function'||typeof G.KNOWLEDGE_SCALE!=='object'){ok(false,'R9: the profile blocks and the knowledge scale are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  eq(G.KNOWLEDGE_SCALE.usage.moderate,3.7,'R9: the word answers take a four-rung scale (None 1, then 2.3, 3.7, 5)'); eq(G.KNOWLEDGE_SCALE.learning.systematic,5,'R9: the top rung is 5');
  const kn=G.getAssessmentScores().filter(function(d){return d.name==='Knowledge'})[0]; ok(Math.abs(kn.score-4.1)<0.01,'R9: the seed\'s Knowledge score averages all four answers (3.7 + 4 + 3.7 + 5) / 4 = 4.1, not the awareness rating alone (got '+kn.score.toFixed(2)+')');
  const _u=G.data.knowledge.usage,_r=G.data.knowledge.resources,_l=G.data.knowledge.learning; G.data.knowledge.usage='none'; G.data.knowledge.resources='none'; G.data.knowledge.learning='none'; const low=G.getAssessmentScores().filter(function(d){return d.name==='Knowledge'})[0].score; ok(Math.abs(low-(1+4+1+1)/4)<0.01,'R9: None across the board pulls the Knowledge score down to the awareness rating\'s company'); G.data.knowledge.usage=_u; G.data.knowledge.resources=_r; G.data.knowledge.learning=_l;
  G.UI.printDepth='summary'; const a=G.assessmentReportDoc(); has(a,'margin:-8px auto 22px;max-width:460px','R9: the radar is centred');
  G.UI.printDepth='full'; const f=G.assessmentReportDoc(); G.UI.printDepth='summary';
  eq(c(f,/class="ap-seg on"/g),7,'R9: seven Likert answers print as strips with the chosen segment filled (awareness and the six culture items)'); has(f,'<span>Unaware</span><span>Very aware</span>','R9: a strip carries the step\'s own endpoints'); has(f,'<span>Stigma</span><span>Accepted</span>','R9: for the culture items too');
  eq(c(f,/border-left:3px solid #076D9E55/g),16,'R9: sixteen quoted answers (seven purpose fields, three knowledge words, five decision holders, the gaps), in the module\'s own blue (retargeted 17 Sep 2026: green, then orange, then the head accent Paul named)'); has(f,'Who can stop a project that is not working?','R9: a decision right prints as its own question'); has(f,'Recorded decision-rights gaps','R9: the gaps print as one block');
  eq(c(f.slice(f.indexOf('AI Innovation Audit')),/<th /g),2,'R9: the audit table prints only what the battery collects: initiative and status'); ok(f.indexOf('>Cost<')<0&&f.indexOf('Owner assigned')<0,'R9: no cost, no owner column');
  ok(!/<button|onclick=/.test(f),'R9: no control prints');
  G.seedData();
})();


/* ── R10 (17 Sep 2026, Paul's rulings): the module's colour on the profile blocks; sections that would be cut start new pages; the seed's dead field ── */
(function(){
  G.seedData();
  if(typeof G.apStrip!=='function'){ok(false,'R10: the profile blocks are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  G.UI.printDepth='full'; const f=G.assessmentReportDoc(); G.UI.printDepth='summary';
  eq(c(f,/background:#076D9E/g),7,'R10: the seven Likert strips fill with the module\'s blue \u2014 the head accent, as Governance\'s fill with its teal'); ok(f.indexOf('#1B6B5A55')<0&&f.indexOf('rgba(27,107,90,.06)')<0,'R10: no green quoted block remains');
  const body=f.slice(f.indexOf('</div>',f.indexOf('min-height:85vh')));
  ['Purpose and Direction','AI Knowledge Base','Risk and Culture','AI Innovation Audit','Decision Rights'].forEach(function(t){const i=body.indexOf('<div>'+t+'</div>');ok(i>0&&body.slice(0,i).lastIndexOf('class="er-block"')>body.slice(0,i).lastIndexOf('</table>'),'R10: the section '+t+' is one unsplittable block — if it would be cut, it starts a new page')});
  ok(!(G.data.audit||[]).some(function(a){return 'cost' in a}),'R10: the seed\'s audit entries carry no cost (a field nothing collects or reads)'); ok((G.data.audit||[]).some(function(a){return 'assigned' in a}),'R10: they keep assigned and projIdx, which the Legacy tab writes and reads');
  G.seedData();
})();


/* ── R11 (17 Sep 2026, Paul's rulings): the RACI in Governance's form wherever it appears; the Exploration balance; registers on their own pages; the project record ── */
(function(){
  G.seedData();
  if(typeof G.raciCycle!=='function'||typeof G.LAYER_MAPS!=='object'||!G.LAYER_MAPS.project){ok(false,'R11: the chips and the project record are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  const m21=G.raciMatrix(false),mro=G.raciMatrix(true);
  eq(c(m21,/border-radius:13px/g),42,'R11: the 2.1 matrix shows every letter on a 26px chip'); eq(c(m21,/<select/g),0,'R11: no select remains'); eq(c(m21,/onclick="raciCycle\(/g),42,'R11: every cell cycles on click'); has(m21,'Accountable \u2014 owns the decision, exactly one per activity','R11: the legend row prints beneath');
  eq(c(mro,/border-radius:13px/g),42,'R11: the output page shows the same chips'); eq(c(mro,/onclick=/g),0,'R11: and no control in its read-only form');
  const k='0:owner', was=G.data.raci[k]; G.raciCycle(k); eq(G.data.raci[k],['','R','A','C','I'][(['','R','A','C','I'].indexOf(was||'')+1)%5],'R11: a click cycles R \u2192 A \u2192 C \u2192 I \u2192 blank'); G.data.raci[k]=was;
  const rd=G.raciDoc(); eq(c(rd,/border-radius:13px/g),42,'R11: the printed matrix carries the chips'); has(rd,'print-color-adjust:exact','R11: the chips keep their colour on paper'); has(rd,'Responsible \u2014 does the work','R11: with the legend'); has(rd,'justify-content:center;min-height:calc(100vh - 15vh)','R11: the matrix sits centred on its landscape page, as Governance\'s does (85vh written as a calc so the cover\'s signature stays unique)'); ok(!/<select|onclick=/.test(rd),'R11: no control prints');
  G.UI.printDepth='summary';
  const ex=G.PRINT_DOCS['out-explore'](); const i1=ex.indexOf('>At a Glance</div>'),i2=ex.indexOf('>Exploration Portfolio Balance</div>'),i3=ex.indexOf('>The Projects</div>'); /* the register is headed The Projects since 17 Sep 2026 */ ok(i1>0&&i2>i1&&i3>i2,'R11: the Exploration document prints its balance card under At a Glance');
  ['out-bluesky','out-explore','out-expbriefs','out-oper'].forEach(function(id){const d=G.PRINT_DOCS[id]();ok(d.indexOf('<div style="break-before:page;page-break-before:always">')>d.indexOf('>At a Glance</div>'),'R11: '+id+' opens its register on a new page')}); /* out-finalport left the list 17 Sep 2026: the Portfolio Review has no register */
  ['out-expbriefs','out-oper'].forEach(function(id){G.UI.printDepth='summary';const d=G.PRINT_DOCS[id]();G.UI.printDepth='full';const f=G.PRINT_DOCS[id]();G.UI.printDepth='summary';
    ok(d.indexOf('>Strategic anchor<')<0&&d.indexOf('>Description<')<0,'R11: '+id+' prints no idea card (superseded by the project card)'); ok(c(d,/border-bottom:1px solid #ddd;background:#f4f4f4/g)>0,'R11: '+id+' Summary prints the stage cards (retargeted 17 Sep 2026 to the signed-off card form)'); has(f,'>External partners<','R11: '+id+' Full adds the Overview card');
    has(f,'>Analyses<','R11: '+id+' Full adds the analyses'); has(f,'>Rollout steps<','R11: '+id+' Full adds the budget page (retargeted 17 Sep 2026: its phases are on the card, so the page shows rollout and sustainment)'); ok(f.length>d.length*1.8,'R11: '+id+' Full is well over Summary')});
  has(G.PRINT_DOCS['out-bluesky'](),'>Strategic anchor<','R11: Blue Sky still prints the idea card \u2014 there the idea is the record');
  eq(G.LAYER_MAPS.project.layers.map(function(l){return l.id}).join(','),'overview,portfolio,analyses,budget,development,review,operations','R11: the project record\'s seven layers in stage order (the brief left 17 Sep 2026)');
  const rbody=G.rcUnitBody({kind:'record',type:'idea',id:'0'}); has(rbody,'>Objectives<','R11: the Report Manager prints a selected idea as its project record'); ok(rbody.indexOf('>Strategic anchor<')<0,'R11: without the idea card');
  G.seedData();
})();


/* ── R12 (17 Sep 2026, Paul's ruling): Org Readiness — one model for page and document; Summary / Full on both ── */
(function(){
  G.seedData();
  if(typeof G.orgReadinessModel!=='function'){ok(false,'R12: the Org Readiness model is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const secs=function(x){return (x.match(/class="ly-group"[^>]*><div>([^<]+)<\/div>/g)||[]).map(function(m){return m.replace(/.*<div>([^<]+)<\/div>/,'$1')}).join('|')};
  const M=G.orgReadinessModel(); eq(M.chk.length,7,'R12: seven readiness checks'); ok(M.chk.every(function(ch){return typeof ch.ev==='string'&&ch.ev.length>0}),'R12: every check carries its evidence or what is missing');
  has(M.chk[0].ev,'Shalini Mehta, VP Innovation: Full budget authority','R12: the owner check\'s evidence is the owner, role, and authority'); has(M.chk[1].ev,'Vincent Lau (Engineering)','R12: the leads check names the leads with their departments');
  G.UI.printDepth='summary'; const d=G.orgReadinessDoc(); const pg=G.renderOutOrgReady(); G.UI.printDepth='full'; const f=G.orgReadinessDoc(); const pf=G.renderOutOrgReady(); G.UI.printDepth='summary';
  ok(d===f,'R12: one definitive version \u2014 the document is the same at either depth (Paul\'s ruling, later 17 Sep 2026: the Summary scrapped)'); ok(!G.DEPTHED_OUTPUTS['out-orgready'],'R12: Org Readiness offers no Summary / Full');
  eq(secs(f),'Summary|At a Glance|Organizational Readiness|Pipeline Owner|Embedded Leads|Engaged Senior Leaders|Realigned Incentives|Innovation Rhythm','R12: the document\'s sections \u2014 every field of the three steps, the checks under At a Glance'); has(f,'Daniel Reyes','R12: Full prints the engaged senior leaders, which no surface showed'); has(f,'>Executive</th>','R12: as a table with their positions');
  ok(c(f,/#076D9E55/g)>=9,'R12: the written answers print in the profile\'s form'); has(f,'Step 2.4 marked complete','R12: the evidence prints beneath each check'); has(f,'Vincent Lau (Engineering), Harriet Rivers (Product)','R12: the leads check\'s evidence prints in full');
  eq(c(f,/background:#111;color:#fff/g)+c(f,/border:1.5px solid #999/g),7,'R12: the checklist prints as a checklist \u2014 a tick or an empty circle per check'); ok(/\d of 7 complete<\/div>/.test(f)&&f.indexOf('record behind')<0,'R12: the count in the sub-line, the meta phrase gone'); eq(c(f,/>Step 2\.[123]</g),0,'R12: no step numbers under Pipeline Owner, Realigned Incentives, or Innovation Rhythm'); ok(!/<button|onclick=/.test(f),'R12: no control prints');
  eq(c(pg,/>DEPTH</g),0,'R12: the page carries no Summary / Full control (one version)'); has(pg,'<button class="btn bg2" style="font-size:12px" onclick="printOrgReady()">','R12: its Save as PDF button unchanged'); has(pg,'Readiness checks','R12: the page gains the figures the document opens with'); ok(pg.indexOf('Organizational Readiness Checklist')<pg.indexOf('Pipeline Owner'),'R12: the checklist sits under the figures, before the record');
  ok(pg===pf,'R12: the page is the same at either depth'); ok(pg.indexOf('Engaged Senior Leaders')>=0&&pg.indexOf('Daniel Reyes')>=0,'R12: the page shows the senior leaders'); has(pg,'Engineering','R12: and the leads\' departments'); has(pg,'Blocker triage','R12: and the agenda items'); has(pg,'Shalini Mehta, VP Innovation: Full budget authority','R12: and the evidence beneath each check'); ok(pg.indexOf('record behind')<0,'R12: without the meta phrase');
  G.seedData();
})();


/* ── R14 (17 Sep 2026, Paul's rulings): the Exploration Portfolio as cards; the RACI's caps lifted ── */
(function(){
  G.seedData();
  if(typeof G.projectCardPages!=='function'){ok(false,'R14: the project cards are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages(); const n=st.explore.length+(st.noGo||[]).length;
  G.UI.printDepth='summary'; const d=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='full'; const f=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='summary';
  eq(c(d,/border-bottom:1px solid #ddd;background:#f4f4f4/g),n,'R14: Summary prints one Overview card per project'); eq(c(d,/>External partners</g),n,'R14: every line of the Overview prints on each card'); has(d,'Go \u00b7 31 / 50','R14: the verdict and the Filter & Rank score sit on the name bar (Sales Knowledge Graph: Go, 31 of 50)');
  ok(d.indexOf('>Portfolio placement<')<0&&d.indexOf('Portfolio Position')<0,'R14: Summary prints no portfolio placement'); eq(c(d,/>Analyses</g),0,'R14: nor the analyses'); eq(c(d,/break-before:page/g),1,'R14: the cards open on a page of their own, then flow'); ok(d.indexOf('>The Projects</div>')>d.indexOf('break-before:page'),'R14: with the heading on that page');
  eq(c(f,/border-bottom:1px solid #ddd;background:#f4f4f4/g),n,'R14: Full prints each project\'s Overview card'); eq(c(f,/>Analyses</g),n,'R14: and its Analyses card'); eq(c(f,/Portfolio Position/g),n,'R14: and its portfolio position'); eq(c(f,/>Budget</g),st.explore.concat(st.noGo||[]).filter(function(i){return G.bpHasAny(i)}).length,'R14: and a budget page for each project with a plan (retargeted 17 Sep 2026)'); eq(c(f,/break-before:page/g),n+st.explore.concat(st.noGo||[]).filter(function(i){return G.bpHasAny(i)}).length,'R14: a page per project plus a budget page for those with a plan');
  ok(f.indexOf('>The Projects</div>')>f.indexOf('break-before:page'),'R14: the document heading rides the first project\'s page, never stranded'); has(f,'>Development phases<','R14: the budget page lists the development phases'); has(f,'border-left:1px solid #ddd"><div style="font-family:var(--mono','R14: with rollout steps and sustainment beside them, not beneath'); has(f,'$528K','R14: the plan\'s own lifetime total prints');
  has(f,'Have:</span>','R14: the gap analysis prints have and gap on one line per category'); eq(c(f,/rgba\(27,107,90,\.10\);border-radius:5px/g),st.explore.filter(function(i){var sw=((G.data.projects||{})[i]||{}).swot||{};return Object.keys(sw).some(function(k){return sw[k]})}).length,'R14: the SWOT prints in the page\'s four tints, one Strengths cell per project that has one (retargeted 17 Sep 2026: colour throughout this report, Paul\'s ruling)');
  ok(!/<button|onclick=/.test(f)&&!/NaN|undefined/.test(f),'R14: no control, no hole');
  eq(G.raciCols().length,1+(G.data.ownership.leads||[]).length+(G.data.ownership.seniors||[]).length+1,'R14: the RACI takes every lead and senior, uncapped'); ok(G.raciCols.toString().indexOf('slice(0,4)')<0,'R14: the four-person cap is gone');
  G.seedData();
})();


/* ── R15 (17 Sep 2026, Paul's rulings): the Overview card's numbers; the four budget charts; colour throughout the Exploration report ── */
(function(){
  G.seedData();
  if(typeof G.projStatBand!=='function'){ok(false,'R15: the card\'s stat band is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages();
  G.UI.printDepth='summary'; const d=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='full'; const f=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='summary';
  const planned=st.explore.concat(st.noGo||[]).filter(function(i){return G.bpHasAny(i)}).length;
  eq(c(d,/Lifetime cost<\/div>/g),planned,'R15: Summary\'s Overview cards carry the stat band\'s four figures for every project with a plan'); eq(c(f,/Lifetime cost<\/div>/g),planned,'R15: and so do Full\'s'); eq(c(d,/font-size:26px;font-weight:800;color:var\(--ph2-t\)/g),0,'R15: Summary\'s figures stay the smaller black form (Paul\'s ruling, later 17 Sep 2026)'); eq(c(d,/font-size:20px;font-weight:700;color:#111;line-height:1.1/g),planned*4,'R15: at 20px in the serif');
  has(d,'With 10% contingency: $580K lifetime. \u00b7 First operational month: Month 8.','R15: contingency and first operational month share one line'); has(d,'Monthly costs peak at Month 3: $95K per month.','R15: the peak month follows');
  const bpg=f.slice(f.indexOf('>Budget</div>'),f.indexOf('break-before:page',f.indexOf('>Budget</div>')));
  eq(c(bpg,/<svg/g),4,'R15: the budget page prints the four charts'); eq(c(bpg,/Monthly spend shape|Step timeline|How the lifetime total builds|Cumulative cost/g),4,'R15: under their titles (retargeted 17 Sep 2026: the titles moved into the boxes)'); eq(c(bpg,/<button|onclick=/g),0,'R15: without their zoom buttons'); eq(c(bpg,/<svg style="width:100%;height:auto;max-height:/g),4,'R15: scaled to the page\'s width with a capped height'); has(bpg,'>Development phases<','R15: the phase tables follow the charts');
  eq(c(f,/rgba\(155,45,63,\.08\)/g),c(f,/rgba\(27,107,90,\.10\)/g),'R15: the SWOT\'s four tints print as on screen'); eq(c(f,/background:#f4f4f4;border-radius:5px/g),0,'R15: no grey SWOT cell remains');
  G.seedData();
})();


/* ── R16 (17 Sep 2026, Paul's ruling): the Capital Sandbox prints the scenario it shows ── */
(function(){
  G.seedData();
  if(typeof G.capSandboxDoc!=='function'){ok(false,'R16: the sandbox document is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const goP=G.getStages().explore.filter(function(i){return (G.data.projects[i]||{}).viable===true});
  G.UI.capSim={}; const d0=G.capSandboxDoc();
  has(d0,'>Capital Sandbox</div>','R16: the document is titled Capital Sandbox (retargeted 17 Sep 2026: the state left the title on Paul\'s ruling)'); has(d0,'A capital expenditure scenario staging a specified batch of projects.','R16: with the lead Paul gave it'); has(d0,'<div>The Staged Batch</div>','R16: it opens with the batch section'); eq(c(d0.slice(0,d0.indexOf('>On the Calendar</div>')),/<tr><td/g),goP.length,'R16: and lists the Go candidates available to stage'); eq(c(d0,/<svg/g),3,'R16: the waterfall, the cumulative chart, and the swimlanes print'); has(d0,'<div>The Years</div>','R16: the budget years print, with any batch included'); ok(!/<button|onclick=|<input|<select/.test(d0),'R16: no control prints');
  goP.slice(0,3).forEach(function(i){G.UI.capSim[i]=true}); const d3=G.capSandboxDoc();
  has(d3,'3 of '+goP.length+' Go candidates ticked','R16: with three ticked the batch section says so (retargeted 17 Sep 2026)'); eq(c(d3.slice(0,d3.indexOf('>On the Calendar</div>')),/<tr><td/g),3,'R16: and lists the three'); has(d3,'Committed on advancing','R16: with the sum committed on advancing'); ok(d3.indexOf('cross capacity in Month')>=0||d3.indexOf('stay under cumulative capacity')>=0,'R16: and the capacity verdict'); ok(!/NaN|undefined/.test(d3),'R16: no hole');
  ok(d0!==d3,'R16: a different batch prints a different document');
  G.UI.capSim={}; G.UI.oxTab=2; G.UI.capTab=1; const pg=G.renderOutExploreEnhanced(); has(pg,'printCapSandbox()','R16: the Sandbox card carries its own Save as PDF'); has(pg,'<h3 class="h-sub-lg" style="margin:0">Sandbox</h3>','R16: in line with the card\'s heading'); G.UI.oxTab=1;
  G.seedData();
})();


/* ── R17 (17 Sep 2026, Paul's ruling on the chat's refinement): the funding plan prints with the batch that breaches ── */
(function(){
  G.seedData();
  if(typeof G.capSandboxDoc!=='function'){ok(false,'R17: the sandbox document is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const goP=G.getStages().explore.filter(function(i){return (G.data.projects[i]||{}).viable===true});
  G.UI.capSim={}; goP.forEach(function(i){G.UI.capSim[i]=true}); const dAll=G.capSandboxDoc();
  ok(dAll.indexOf('Capacity Breach Funding Plan')<0,'R17: on the seed the full batch stays within capacity, so no funding plan prints');
  const wasB=G.data.capital.aiBudget; G.data.capital.aiBudget='$100K'; const dB=G.capSandboxDoc(); G.data.capital.aiBudget=wasB;
  has(dB,'<div>Capacity Breach Funding Plan</div>','R17: when the batch crosses capacity the funding plan prints as the final section'); ok(/cross capacity in Month \d+/.test(dB),'R17: naming the month of the breach'); eq(c(dB.slice(dB.indexOf('Capacity Breach Funding Plan')),/<tr><td/g),G.fundLines().length,'R17: with every funding line \u2014 source, amount, year, project, status'); has(dB,'>Planned<','R17: a planned line reads Planned'); ok(!/<button|onclick=|<input|<select/.test(dB),'R17: no control prints');
  G.UI.capSim={}; const d0=G.capSandboxDoc(); ok(d0.indexOf('Capacity Breach Funding Plan')<0,'R17: with nothing staged, no funding plan (the baseline has none to answer)');
  G.seedData();
})();


/* ── R18 (17 Sep 2026, Paul's printout findings on the Exploration Full): blue figures, the gap analysis in colour, boxed charts, the budget page closed up ── */
(function(){
  G.seedData();
  if(typeof G.projBudgetPage!=='function'){ok(false,'R18: the budget page is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages();
  G.UI.printDepth='full'; const f=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='summary';
  const planned=st.explore.concat(st.noGo||[]).filter(function(i){return G.bpHasAny(i)}).length;
  eq(c(f,/font-size:26px;font-weight:800;color:var\(--ph2-t\)/g),planned*4,'R18: the Overview card\'s four figures print at 26px in the screen\'s blue');
  ok(c(f,/color:#B8860B;font-weight:700">Gap:/g)>0&&c(f,/color:#1B6B5A;font-weight:700">Have:/g)>0,'R18: the gap analysis prints in colour \u2014 gaps amber, what is in hand green');
  const bpg=f.slice(f.indexOf('>Budget</div>'),f.indexOf('break-before:page',f.indexOf('>Budget</div>')));
  eq(c(bpg,/border:1px solid #ddd;border-radius:6px;padding:6px 10px 6px/g),4,'R18: each chart sits in its own box'); eq((bpg.match(/max-height:(\d+)px/g)||[]).join(','),'max-height:118px,max-height:84px,max-height:128px,max-height:118px','R18: the charts\' heights are capped so the page holds');
  ok(bpg.indexOf('width:36%')>=0&&bpg.indexOf('width:30%')>=0&&bpg.indexOf('width:34%')>=0,'R18: development phases, rollout steps, and sustainment sit three abreast'); eq(c(bpg,/<button|onclick=/g),0,'R18: no control prints');
  G.seedData();
})();


/* ── R19 (17 Sep 2026, Paul's findings on the sandbox printout): the cover; The Years as a table; negative money ── */
(function(){
  G.seedData();
  if(typeof G.capSandboxDoc!=='function'){ok(false,'R19: the sandbox document is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const goP=G.getStages().explore.filter(function(i){return (G.data.projects[i]||{}).viable===true});
  eq(G.fmtMoney(-48308),'\u2212$48K','R19: a negative amount formats as a minus and the figure (it printed raw, on screen too)'); eq(G.fmtMoney(2448308),'$2.4M','R19: positive amounts unchanged');
  G.UI.capSim={}; goP.forEach(function(i){G.UI.capSim[i]=true}); const d=G.capSandboxDoc();
  const cov=d.slice(0,d.indexOf('class="ly-group"')); ok(cov.indexOf('scenario, not a commitment')<0&&cov.indexOf('standing baseline')<0,'R19: the cover carries neither the old lead nor the state');
  const yi=d.indexOf('>The Years</div>'); ok(d.slice(yi-400,yi).indexOf('height:22px')>=0,'R19: more space before The Years');
  eq(c(d.slice(yi),/<tr><td/g),G.envYearsOf()+1,'R19: The Years is a table with a line per year and the total'); has(d.slice(yi),'>Year 1</td>','R19: Year 1'); has(d.slice(yi),'Total \u2014 '+G.envYearsOf()+' years','R19: and the total row'); has(d.slice(yi),'$2,400K','R19: budgets in exact thousands, so the arithmetic reads');
  ok(d.indexOf('does not track live spend')<0&&d.indexOf('Committed funds falling beyond the planning window')<0,'R19: the widget\'s paragraphs are gone'); ok(!/<button|onclick=/.test(d),'R19: no control prints');
  G.UI.capSim={}; G.seedData();
})();


/* ── R20 (17 Sep 2026, Paul's rulings): no empty budget page; Summary's figures back to black ── */
(function(){
  G.seedData();
  if(typeof G.projectCardPages!=='function'){ok(false,'R20: the project cards are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages(); const list=st.explore.concat(st.noGo||[]); const unplanned=list.filter(function(i){return !G.bpHasAny(i)});
  G.UI.printDepth='full'; const f=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='summary'; const d=G.PRINT_DOCS['out-explore']();
  eq(c(f,/>No budget plan yet\.</g),unplanned.length,'R20: a project without a plan gets a line under its portfolio position, not a budget page'); ok(unplanned.length>0,'R20: the seed has such projects to show it');
  if(unplanned.length){const i=unplanned[0];const pg=G.projectCardPages(i,'full','');eq(c(pg,/break-before:page/g),1,'R20: one page for an unplanned project');has(pg,'Portfolio Position','R20: with its position');ok(pg.indexOf('>Budget</div>')<0,'R20: and no budget heading')}
  eq(c(d,/font-size:26px;font-weight:800;color:var\(--ph2-t\)/g),0,'R20: Summary\'s Overview cards carry no large blue figure'); ok(c(f,/font-size:26px;font-weight:800;color:var\(--ph2-t\)/g)>0,'R20: Full\'s do');
  G.seedData();
})();


/* ── R21 (17 Sep 2026, Paul's copy): the funding plan's line when the calendar itself has no gap ── */
(function(){
  G.seedData(); if(typeof G.capSandboxDoc!=='function'){ok(false,'R21: the sandbox document is defined'); return}
  const goP=G.getStages().explore.filter(function(i){return (G.data.projects[i]||{}).viable===true}); G.UI.capSim={}; goP.forEach(function(i){G.UI.capSim[i]=true});
  const wasB=G.data.capital.aiBudget; G.data.capital.aiBudget='$2.2M'; /* the committed calendar fits; the batch alone breaches (Month 11 on the seed) */ const dB=G.capSandboxDoc(); G.data.capital.aiBudget=wasB; G.UI.capSim={};
  has(dB,'<div>Capacity Breach Funding Plan</div>','R21: at $2.2M the batch alone breaches and the plan prints'); ok(dB.indexOf('The funding gap on the committed calendar')<0,'R21: the calendar itself shows no gap');
  has(dB,'The committed calendar itself sits inside its budget. The funding breach comes from the staged batch. The items below identify additional sources that may be drawn on to cover the funding breach, or that have been identified so far.','R21: the funding plan\'s line reads as Paul gave it');
  ok(dB.indexOf('the breach comes with the batch')<0,'R21: the earlier wording is gone');
  G.seedData();
})();


/* ── R22 (17 Sep 2026, Paul's ruling): the signed-off learnings applied to the remaining outputs ── */
(function(){
  G.seedData();
  if(typeof G.projectPagesFor!=='function'){ok(false,'R22: the later-stage cards are defined'); return}
  if(!G.data.completedSteps)G.data.completedSteps={}; G.data.completedSteps['4.2']=true; G.data.completedSteps['4.3']=true;
  const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages(); const planned=function(list){return list.filter(function(i){return G.bpHasAny(i)}).length};
  G.UI.printDepth='summary'; const dv=G.PRINT_DOCS['out-expbriefs'](); G.UI.printDepth='full'; const dvf=G.PRINT_DOCS['out-expbriefs'](); G.UI.printDepth='summary';
  eq(c(dv,/>Development program</g),st.experiment.length,'R22: Development Summary prints each program\'s development card'); eq(c(dv,/>Program phases</g),st.experiment.length,'R22: with its program phases'); has(dv,'>Development Portfolio Balance</div>','R22: the balance card under At a Glance'); eq(c(dv,/break-before:page/g),1,'R22: the programs on a page of their own');
  eq(c(dvf,/break-before:page/g),st.experiment.length*2+planned(st.experiment),'R22: Full gives each program its card page, its project page, and a budget page where there is a plan');
  const list=st.experiment.concat(st.operational||[]).filter(function(i,k,a){return a.indexOf(i)===k}); const fp=G.PRINT_DOCS['out-finalport']();
  has(fp,'>The Decisions</div>','R22: out-finalport is the Portfolio Review (retargeted 17 Sep 2026)');
  const op=G.PRINT_DOCS['out-oper'](); eq(c(op,/>Annual sustainment cost</g),st.operational.length,'R22: Operational Summary prints each project\'s operations card (retargeted 17 Sep 2026 to the corners form)'); has(op,'>Performance vs. success metric<','R22: with the page\'s labels'); has(op,'>Operational Portfolio Balance</div>','R22: the balance card under At a Glance'); ok(/color:#1B6B5A;font-weight:700">Green/.test(op),'R22: health coloured as on the page');
  G.UI.printDepth='full'; const opf=G.PRINT_DOCS['out-oper'](); G.UI.printDepth='summary'; eq(c(opf,/>Development program</g),st.operational.length,'R22: Operational Full adds the development card');
  const g=G.govFrameworkDoc(); eq(c(g,/border-left:3px solid #(1B6B5A|2D5A8E|8B5E3C)/g),3,'R22: the Governance Framework prints the page\'s three mechanism cards with their coloured rules (retargeted 17 Sep 2026: a one-pager of the page\'s own cards, Paul\'s ruling)'); has(g,'>Executive Summary</div>','R22: and its summary card'); eq(c(g,/#076D9E55/g),0,'R22: not the question-and-answer form'); ok(!/>Step 4\.2</.test(g),'R22: no step numbers');
  const o=G.orgDesignReviewDoc(); eq(c(o,/border-radius:12px;font-size:12px;font-weight:700/g),4,'R22: the Org Design Review\'s four score chips'); ok(/rgba\(27,107,90,\.08\)|rgba\(139,94,60,\.06\)|rgba\(155,45,63,\.06\)/.test(o),'R22: in the page\'s colours');
  [dv,dvf,fp,op,opf,g,o].forEach(function(x,k){ok(!/<button|onclick=/.test(x)&&!/NaN|undefined/.test(x),'R22: document '+(k+1)+' prints no control and no hole')});
  G.seedData();
})();


/* ── R23 (17 Sep 2026, Paul's ruling): the development card on the 3.4 record; the retired brief gone from the maps and the seed ── */
(function(){
  G.seedData();
  if(typeof G.projDevCard!=='function'){ok(false,'R23: the development card is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages();
  ok(Object.keys(G.data.experiments[0]).join(',')==='budget','R23: the seed\'s experiment entries carry only the budget (the five brief fields had no writer)');
  const src=G.expCardRO.toString(); ok((G.renderOutExpbriefsFull.toString()+G.renderOutOperFull.toString()+G.devPortBody.toString()+G.opPortBody.toString()).indexOf('expCardRO(')<0,'R23: no page draws the retired brief card');
  G.UI.printDepth='summary'; const d=G.PRINT_DOCS['out-expbriefs'](); G.UI.printDepth='full'; const f=G.PRINT_DOCS['out-expbriefs'](); G.UI.printDepth='summary';
  eq(c(d,/>Development program</g),st.experiment.length,'R23: each program\'s card carries its development program'); has(d,'>Objectives<','R23: with its objectives'); has(d,'>Deliverables<','R23: and deliverables from Step 3.4');
  ok(c(d,/<b>Phase \d/g)>0,'R23: the phases print with their numbers'); ok(c(d,/Success metrics:/g)>0&&c(d,/Exit gate:/g)>0,'R23: each phase with its success metrics and exit gate criteria'); has(d,'Development budget <b>','R23: the budget from the plan');
  has(d,'>Results to date<','R23: the track\'s results to date'); eq(c(d,/Portfolio position:/g),st.experiment.length,'R23: Summary carries the position on the card'); eq(c(f,/Portfolio position:/g),0,'R23: Full leaves it to the project page');
  ok(d.indexOf('>What was tested<')<0&&d.indexOf('>Evaluation milestone<')<0&&d.indexOf('>Development brief<')<0,'R23: nothing of the brief remains');
  const op=G.PRINT_DOCS['out-oper'](); has(op,'>Success metrics<','R23: the operations card reads the project\'s own success metrics'); ok(op.indexOf('>Success metric<')<0,'R23: not the dead field');
  G.currentStep='out-expbriefs'; G.UI.expanded['oe'+st.experiment[0]]=true; const pg=G.renderOutExpbriefsFull(); has(pg,'>Objectives</div>','R23: the Development Portfolio page\'s card shows the objectives'); has(pg,'>Deliverables</div>','R23: and the deliverables');
  G.currentStep='out-oper'; G.UI.expanded['oo'+(st.operational||[])[0]]=true; has(G.renderOutOperFull(),'SUCCESS METRICS','R23: the Operational page\'s block reads the project\'s metrics');
  G.seedData();
})();


/* ── R24 (17 Sep 2026, Paul's findings on the Development Full): no repeated phases; headings never stranded ── */
(function(){
  G.seedData();
  if(typeof G.projDevCard!=='function'){ok(false,'R24: the development card is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  G.UI.printDepth='full'; const f=G.PRINT_DOCS['out-expbriefs'](); const e=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='summary'; const d=G.PRINT_DOCS['out-expbriefs']();
  eq(c(f.slice(f.indexOf('>Budget</div>')),/>Development phases</g),0,'R24: the Development budget page repeats no phases (they are on the card)'); has(f.slice(f.indexOf('>Budget</div>')),'width:45%','R24: rollout and sustainment sit two abreast there');
  ok(c(e.slice(e.indexOf('>Budget</div>')),/>Development phases</g)>0,'R24: the Exploration budget page keeps its phases table'); has(e,'width:36%','R24: three abreast');
  const i=d.indexOf('border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden'); ok(d.slice(i-80,i).indexOf('break-inside:avoid')>=0,'R24: the development card stays whole (Paul\'s ruling, later 17 Sep 2026: cards never split; only one longer than a page can spill)');
  ok(c(d,/border-top:1px solid #eee;break-inside:avoid/g)>0,'R24: each phase stays whole'); ok(c(d,/<div style="break-inside:avoid;page-break-inside:avoid">/g)>=2,'R24: the bar with the program, and the track, stay whole');
  G.seedData();
})();


/* ── R25 (17 Sep 2026, Paul's rulings): the Portfolio Review, Ignite's third output; the first review seeded; Phase 4 complete in the seed ── */
(function(){
  G.seedData();
  if(typeof G.portfolioReviewDoc!=='function'){ok(false,'R25: the Portfolio Review is defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length}; const M=G.portfolioReviewModel();
  eq(M.items.length,9,'R25: the review covers the nine live initiatives'); eq(M.decided,9,'R25: the seed decides every one'); eq(M.buy+'/'+M.hold+'/'+M.sell,'3/5/1','R25: three Buy, five Hold, one Sell on the seed'); ok(M.recs.every(function(r){return r.rationale.length>20}),'R25: every decision carries its reason');
  ok(!!G.data.completedSteps['4.2']&&!!G.data.completedSteps['4.3']&&!!G.data.completedSteps['4.4'],'R25: the seed marks 4.2, 4.3, and 4.4 complete'); ok(M.recs.filter(function(r){return r.decision==='sell'})[0].killed,'R25: the Sell killed its initiative, as the step does');
  eq(G.getStages().experiment.join(','),'11,12,13','R25: the seeded review leaves the development set as it was (the in-development calls are Hold, since a Buy at 4.4 launches a program)');
  const d=G.portfolioReviewDoc();
  ['At a Glance','Capital After the Decisions','The Decisions','Buy','Hold','Sell','Portfolio Balance After the Review','Portfolio Learnings'].forEach(function(t){has(d,'<div>'+t+'</div>','R25: the document prints '+t)});
  eq(c(d,/border-left:4px solid #(1B6B5A|8B5E3C|9B2D3F)/g),9,'R25: nine decision cards, coloured by the call'); ok(c(d,/rgba\(7,109,158,\.06\)/g)>=9,'R25: each rationale quoted'); has(d,'Release the slot.','R25: the Sell\'s reason prints'); ok(d.indexOf('Review History')<0,'R25: no history section while no cycle has closed'); ok(!/<button|onclick=/.test(d)&&!/NaN|undefined/.test(d),'R25: no control, no hole');
  eq(G.outcomeNameOf('out-finalport'),'Portfolio Review','R25: the outcome is named Portfolio Review'); ok(!G.DEPTHED_OUTPUTS['out-finalport'],'R25: one document, no depth'); eq(G.rcUnitFact({kind:'output',id:'out-finalport'}),'9 of 9 decided','R25: its fact for the Report Manager');
  G.currentStep='out-finalport'; const pg=G.renderOutFinalportFull(); has(pg,'Portfolio Review','R25: the page is the review'); eq(c(pg,/border-left:4px solid/g),9,'R25: with the nine decisions'); has(pg,'printCurrentOutput()','R25: and its Save as PDF'); ok(pg.indexOf('Development brief')<0&&pg.indexOf('>Development program<')<0,'R25: the Development Portfolio no longer appears here');
  G.seedData();
})();


/* ── R26 (17 Sep 2026, Paul's rulings): the dashboard prints; the review and the portfolios open live pages of their own, never a step ── */
(function(){
  G.seedData();
  if(typeof G.renderReviewPage!=='function'||typeof G.renderPortfolioPage!=='function'){ok(false,'R26: the live pages are defined'); return}
  const c=function(d,re){return (d.match(re)||[]).length};
  const _pu=G.currentUserId; G.currentUserId=(G.USERS[0]||{}).id||_pu; /* the pages render behind the sign-in gate */
  G.currentPage='phase5'; G.currentStep=undefined; const dash=G.renderNavDash();
  eq(c(dash,/Save as PDF/g),1,'R26: the dashboard carries a Save as PDF in its header'); has(dash,"go('review')",'R26: Run Quarterly Review opens the review page'); ok(dash.indexOf("go('4.4')")<0,'R26: it no longer returns to Step 4.4'); ok(c(dash,/go\('portfolio','out-/g)>=8,'R26: the stage cards, the chevrons, and the charts\' own items open live portfolio pages (retargeted 17 Sep 2026)');
  G.go('review'); const rv=G.document.getElementById('app').innerHTML; eq(G.currentPage,'review','R26: the review page is its own page'); has(rv,'Quarterly','R26: headed as the quarterly review'); has(rv,'Buy / Sell / Hold Analysis','R26: mounting the shared review surface'); ok(rv.indexOf('Step 4: Quarterly Portfolio Review')<0,'R26: without the step\'s teaching frame'); has(rv,'printCurrentPage()','R26: with its own Save as PDF'); ok(G.sidebarPageShown(),'R26: the sidebar stays');
  var out=''; const _open=G.window.open; G.window.open=function(){return {document:{write:function(h){out+=h},close:function(){}},focus:function(){},print:function(){}}};
  G.printCurrentPage(); has(out,'>The Decisions</div>','R26: the review page prints the Portfolio Review');
  G.go('portfolio','out-bluesky'); const pp=G.document.getElementById('app').innerHTML; eq(G.currentPage,'portfolio','R26: a portfolio page is its own page'); eq(G.currentStep,'out-bluesky','R26: addressed by its output id'); has(pp,'Blue Sky Portfolio','R26: mounting the Blue Sky renderer'); has(pp,'printCurrentOutput()','R26: with the output\'s Save as PDF'); out=''; G.printCurrentPage(); has(out,'>The Ideas</div>','R26: and it prints the output\'s document');
  const st=G.getStages(); const i0=st.bluesky.filter(function(i){return G.data.ideas[i].when!=='future'})[0]; G.go('outcome','out-bluesky'); const op=G.document.getElementById('app').innerHTML; ok(pp.indexOf(G.esc(G.data.ideas[i0].name))>=0&&op.indexOf(G.esc(G.data.ideas[i0].name))>=0,'R26: the portfolio page and the output page show the same record');
  G.go('portfolio','out-expbriefs'); has(G.document.getElementById('app').innerHTML,'Development Portfolio','R26: the Development portfolio page');
  G.window.open=_open; G.go('phase5'); G.currentUserId=_pu; G.seedData();
})();


/* ── R27 (17 Sep 2026, Paul's findings): the dashboard on the Governance dashboard's anatomy; the Portfolio Review's three fixes ── */
(function(){
  G.seedData();
  const c=function(d,re){return (d.match(re)||[]).length}; const d=G.pipelineDashboardDoc(); const st=G.getStages();
  eq((d.match(/class="gd-sec">([^<]+)</g)||[]).map(function(x){return x.replace(/.*>([^<]+)</,'$1')}).join('|'),'Pipeline Overview','R27: one labelled section; the pipeline page is unlabelled (retargeted 17 Sep 2026, Paul\'s ruling)'); eq((d.match(/class="gd-sub">([^<]+)</g)||[]).map(function(x){return x.replace(/.*>([^<]+)</,'$1').trim()}).join('|'),'Operational Projects|Portfolio at a Glance','R27: its two sub-sections');
  eq(c(d,/class="viz-dash-row"/g),1,'R27: the page\'s maturity row \u2014 the gauge and its four bars, as the dashboard page draws them'); eq((d.match(/class="u-(49c8739|efdcc60)">([^<]+)</g)||[]).map(function(x){return x.replace(/.*>([^<]+)</,'$1')}).join('|'),'Next Innovation Session|Next Quarterly Review','R27: the page\'s two cards and no third'); ok(d.indexOf('Blue Sky ideas')<0,'R27: no population bars \u2014 nothing the page does not show'); eq(c(d.slice(d.indexOf('gd-sys')),/<tr><td style="font-weight:600/g),st.operational.length,'R27: a row per live project'); eq(c(d.slice(d.indexOf('gd-sys')),/<td style="font-weight:700;color:#[0-9A-F]{6}">(On track|Watch|At risk|Killed|Health not reported)</g),st.operational.length,'R27: every status cell filled');
  eq(c(d,/<path d="M 0 0 L 170 0/g),4,'R27: the four chevrons'); eq(c(d,/class="gd-lane"/g),4,'R27: a lane per portfolio in its colour'); ok(c(d,/class="gd-subh"/g)>=6,'R27: the items listed under their sub-groups'); ok(c(d,/class="chart-card/g)>=6,'R27: every chart in its box, the balance map among them');
  ok(d.slice(d.lastIndexOf('class="gd-lane"'),d.indexOf('Portfolio at a Glance')).indexOf('break-')<0,'R27: Portfolio at a Glance follows the Operational lane at once'); eq(c(d,/break-after:page|break-before:page/g),2,'R27: two page breaks \u2014 after the overview, and before the unlabelled pipeline page (Paul\'s ruling, 17 Sep 2026)'); ok(!/<button|onclick=/.test(d)&&!/NaN|undefined/.test(d),'R27: no control, no hole');
  const r=G.portfolioReviewDoc(); const iC=r.indexOf('>Capital After the Decisions</div>'),iD=r.indexOf('>The Decisions</div>');
  ok(r.slice(iC,iD).indexOf('break-before:page')<0,'R27: the decisions follow the capital on the same page'); eq(c(r,/<div style="break-inside:avoid;page-break-inside:avoid"><div class="ly-group"/g),3,'R27: each group heading is one block with its first initiative');
  const L=r.slice(r.indexOf('>Portfolio Learnings</div>')); eq(c(L,/#076D9E55/g),0,'R27: the learnings print as plain text, not quoted'); eq(c(L,/white-space:pre-line/g),5,'R27: five labelled answers');
  G.seedData();
})();


/* ── R28 (17 Sep 2026, Paul's findings): cards whole with the heading riding the first; the live pages under Navigate; the operations card's corners; Operational Full's order ── */
(function(){
  G.seedData(); const c=function(d,re){return (d.match(re)||[]).length}; const st=G.getStages();
  G.UI.printDepth='summary'; const dv=G.PRINT_DOCS['out-expbriefs'](); const op=G.PRINT_DOCS['out-oper'](); const ex=G.PRINT_DOCS['out-explore'](); G.UI.printDepth='full'; const opf=G.PRINT_DOCS['out-oper'](); const dvf=G.PRINT_DOCS['out-expbriefs'](); G.UI.printDepth='summary';
  eq(c(dv,/class="er-block" style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ddd;border-radius:6px;margin:0 0 12px;overflow:hidden/g),st.experiment.length,'R28: every development card is one unsplittable block'); eq(c(dv,/class="ly-group"[^>]*><div>(The Programs|Running|Complete)<\/div>/g),0,'R28: the Development register prints no document or group heading (Paul\'s ruling, later 17 Sep 2026)'); ok(/break-before:page;page-break-before:always"><div class="er-block"/.test(dv),'R28: the first program\'s card opens the page'); ok(c(ex,/<div style="break-inside:avoid;page-break-inside:avoid"><div class="ly-group"/g)>=1,'R28: on the Exploration document the group heading and the first card are one block');
  eq((op.match(/class="ly-group"[^>]*><div>([^<]+)<\/div>/g)||[]).map(function(x){return x.replace(/.*<div>([^<]+)<\/div>/,'$1')}).join('|'),'At a Glance|Operational Portfolio Balance','R28: Operational prints its cards straight after the balance \u2014 no group headings, not grouped by health (retargeted 17 Sep 2026)');
  eq(c(op,/>Owner<|>Launch date<|>Rollout costs<|>Annual sustainment cost</g),st.operational.length*4,'R28: each operations card has owner, launch date, rollout costs, and annual sustainment cost in its four corners'); eq(c(op,/>Success metrics<|>Performance vs\. success metric<|>Ongoing notes</g),st.operational.length*3,'R28: the rest continues below');
  const pages=opf.split('break-before:page').map(function(p){return (p.indexOf('>Rollout costs<')>=0&&p.indexOf('>External partners<')<0?'ops':'')+(p.indexOf('>External partners<')>=0?'project':'')+(p.indexOf('>Budget</div>')>=0?'budget':'')+(p.indexOf('>Development program<')>=0?'dev':'')}).filter(Boolean);
  eq(pages.slice(0,4).join('>'),'ops>project>budget>dev','R28: Operational Full runs the operations page, the project pages, then the development page');
  G.currentPage='portfolio'; G.currentStep='out-bluesky'; eq(G.activeNavPhaseId(),5,'R28: a live portfolio page belongs to Navigate in the sidebar, not to Phase 1'); G.currentPage='review'; eq(G.activeNavPhaseId(),5,'R28: so does the review page'); G.currentPage='phase5'; G.currentStep=undefined;
  const dash=G.renderNavDash(); ok(c(dash,/onclick="go\('portfolio','out-/g)>=8,'R28: the chevrons, the cards, and the charts\' items open the live pages'); ok(!/onclick="go\('out-(bluesky|explore|expbriefs|devport|oper)'\)"/.test(dash),'R28: no portfolio link on the dashboard opens an earlier phase\'s output'); ok(!/onclick="go\('\d\.\d'\)"/.test(dash),'R28: nothing on the dashboard opens a step page'); ok(/onclick="go\('out-report'\)"/.test(dash),'R28: the Data Bank still opens its reference documents');
  G.seedData();
})();


/* ── R30 (17 Sep 2026, Paul's ruling): the Review Snapshot prints only its sections with content ── */
(function(){
  G.seedData(); const c=function(d,re){return (d.match(re)||[]).length}; const x=G.reviewSnapshotCard();
  eq(c(x,/>\u2014</g),0,'R30: no dashes for empty sections'); eq(c(x,/class="h-card-lg"/g),1,'R30: on the seed only Intake Reserve has content, so only it prints'); has(x,'Intake Reserve','R30: the reserve prompt');
  G.seedData();
})();


/* ── SEAL (Part S, 2 Oct 2026, Paul's ruling): nothing at all survives a change of organization or user ── */
(function(){
  const sorted = function(o){ return JSON.stringify(o, function(k, v){ return (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce(function(a, x){ a[x] = v[x]; return a; }, {}) : v; }); };
  const expectUI = Object.assign(JSON.parse(G.UI_PRISTINE), {theme:'light', zoom:1});
  const dirty = function(){
    G.UI.aNewKey = {x:1}; G.UI.sec = '4.2'; G.UI.theme = 'dark'; G.UI.zoom = 1.5;
    G.Store.setPref('theme', 'dark'); G.Store.setPref('zoom', 1.5); G.Store.setPref('sidebar-min', '1');
    G.sidebarMinimized = true;
    G.coachMsgs.push({role:'user', text:'carry me over'});
    G.gchatUnreadCount = 4; G.currentPage = 'insights'; G.insightsTab = 'trends';
  };
  const sealed = function(via){
    const ui = Object.assign({}, G.UI); delete ui.entry;
    eq(sorted(ui), sorted(expectUI), 'SEAL ' + via + ': UI is exactly as first created (theme light, zoom 1)');
    ok(!('aNewKey' in G.UI), 'SEAL ' + via + ': a key added during the session is gone');
    eq(JSON.stringify(G.coachMsgs), G.COACH_MSGS_PRISTINE, 'SEAL ' + via + ': the AI Guide conversation is back at its opening message');
    eq(G.gchatUnreadCount, 0, 'SEAL ' + via + ': the Team Chat unread count is 0');
    eq(G.currentPage, 'home', 'SEAL ' + via + ': the page is Home');
    eq(G.insightsTab, 'latest', 'SEAL ' + via + ': the Insights tab is back at its default');
    eq(G.sidebarMinimized, false, 'SEAL ' + via + ': the sidebar is open');
    eq(G.Store.getPref('theme'), 'light', 'SEAL ' + via + ': the stored theme preference is light');
    eq(String(G.Store.getPref('zoom')), '1', 'SEAL ' + via + ': the stored zoom preference is 1');
    eq(G.Store.getPref('sidebar-min'), '0', 'SEAL ' + via + ': the stored sidebar preference is open');
  };
  const curOrg = G.currentOrgId, orgs0 = G.getOrgs().length, _cf = G.confirm;
  G.confirm = function(){ return true; };

  dirty(); noThrow(() => G.signOut(), 'SEAL signOut: runs'); sealed('signOut');
  dirty(); noThrow(() => G.switchToOrg(curOrg), 'SEAL switchToOrg: runs'); sealed('switchToOrg');
  let made = null;
  dirty(); noThrow(() => { made = G.createOrg('Seal Fixture', {name:'Seal Owner', username:'sealowner'}); }, 'SEAL createOrg: runs'); sealed('createOrg');

  /* S-6: deleting the organization being viewed seals; the admin console's delete of ANOTHER organization does not */
  dirty(); G.deleteOrgById(made.orgId); sealed('deleteOrgById (the organization being viewed)');
  eq(G.getOrgs().length, orgs0, 'SEAL: the fixture org is cleaned up');
  G.switchToOrg(curOrg);
  const other = G.createOrg('Seal Fixture 2', {name:'Seal Owner 2', username:'sealowner2'}).orgId;
  G.switchToOrg(curOrg);
  G.UI.aNewKey = {x:1}; G.gchatUnreadCount = 4;
  G.deleteOrgById(other);
  ok(G.UI.aNewKey && G.gchatUnreadCount === 4, 'SEAL: deleting an organization other than the one being viewed does not seal the session');
  eq(G.getOrgs().length, orgs0, 'SEAL: the second fixture org is cleaned up');
  delete G.UI.aNewKey; G.gchatUnreadCount = 0;

  /* S.4: a reload is not a change of organization or user, so bootApp never calls the seal */
  const boot = G.bootApp.toString();
  ok(!/sealSession\s*\(|switchToOrg\s*\(/.test(boot), 'SEAL: bootApp restores a session without sealSession or switchToOrg');

  G.confirm = _cf;
  G.switchToOrg(curOrg);
})();


/* ── AI FEATURES (Part 2, 2 Oct 2026): AI Guide and Voice off by default, switched on per organization; Team Chat carries no AI ── */
(function(){
  const $ = (id) => G.document.getElementById(id);
  const calls = []; const _fetch = G.fetch;
  G.fetch = function(url){ calls.push(String(url)); return Promise.resolve({ ok:true, json:()=>Promise.resolve({content:[{text:'(reply)'}]}) }); };
  let srMade = 0, srStops = 0;
  G.SpeechRecognition = function(){ srMade++; this.start = function(){}; this.stop = function(){ srStops++; }; };
  const curOrg = G.currentOrgId, orgs0 = G.getOrgs().length, _appAdmin = G.isAppAdmin, _user = G.currentUserId;
  const admin = G.USERS.filter(u => u.admin === true)[0], member = G.USERS.filter(u => u.admin !== true)[0];
  ok(!!admin && !!member, 'AI: fixture has an administrator and an ordinary member');
  G.isAppAdmin = false; G.currentUserId = admin.id;
  const savedSettings = G.data.settings;
  delete G.data.settings; G.saveData();

  /* 2.2.1: the setting, and data without it */
  eq(JSON.stringify(G.emptyData().settings), '{"aiGuide":false,"voice":false}', 'AI 2.2.1: emptyData() carries settings, both off');
  ok(G.aiGuideOn() === false && G.voiceOn() === false, 'AI 2.2.1: data without settings counts as both off');

  /* 2.3 test 1: off — no buttons, nothing opens, no request */
  G.render();
  eq($('coachFab').style.display, 'none', 'AI off: the AI Guide button is not shown');
  eq($('fabPulse').style.display, 'none', 'AI off: its pulse is not shown');
  eq($('voiceFab').style.display, 'none', 'AI off: the Voice button is not shown');
  G.UI.navMore = true; G.render();
  ok($('navRight').innerHTML.indexOf('toggleVoice()') < 0, 'AI off: the More menu offers no Voice item');
  G.UI.navMore = false; G.render();
  G.toggleCoach();
  eq(G.coachOpen, false, 'AI off: toggleCoach() does not open the AI Guide');
  const m0 = G.coachMsgs.length;
  $('coachInput').value = 'hello'; G.sendCoach();
  eq(calls.length, 0, 'AI off: sendCoach sends no request to the AI service');
  eq(G.coachMsgs.length, m0, 'AI off: nothing is added to the AI Guide conversation');
  G.toggleVoice();
  eq(srMade, 0, 'AI off: toggleVoice() never starts speech recognition');
  const _gf = G.go; let went = 0; G.go = function(){ went++; };
  G.processVoice('open the guide');
  eq(G.coachOpen, false, 'AI off: the voice command "guide" does not open the AI Guide');
  G.go = _gf;

  /* 2.3 test 2: the fold on Profile, administrators only, closed by default, both off */
  G.UI.aiFoldOpen = undefined; G.openOrg();
  let mh = $('modalRoot').innerHTML;
  has(mh, '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open">', 'AI fold: on Profile, closed by default');
  has(mh, '<summary>AI Features (off by default)</summary>', 'AI fold: heading A.2.1');
  ok(mh.indexOf('<details') < mh.indexOf('Team Members'), 'AI fold: at the top of the page, above Team Members');
  has(mh, '<span>AI Guide</span></label><div class="ai-fold-note">When this is switched on, the AI Guide is live, and whatever users type here is sent to our AI provider.</div>', 'AI fold: A.2.2 and A.2.3 exactly');
  has(mh, "<span>Voice</span></label><div class=\"ai-fold-note\">When this is on, Voice uses the browser's own speech recognition. Some browsers send the recording to the browser maker to turn it into text.</div>", 'AI fold: A.2.4 and A.2.5 exactly');
  ok(!/id="aiSet_aiGuide" checked/.test(mh) && !/id="aiSet_voice" checked/.test(mh), 'AI fold: both switches off');
  ok(mh.indexOf('Capture the enterprise context') < 0, 'AI 2.2.8: the Profile page\'s faded intro line is gone');
  has(mh, '<h3>Organization &amp; Team</h3><div class="u-e6b5a04"></div>', 'AI 2.2.8: its box is kept');

  /* 2.3 test 5: a person without administrator rights sees no fold, and cannot switch */
  G.currentUserId = member.id; G.renderOrgModal();
  ok($('modalRoot').innerHTML.indexOf('ai-fold') < 0, 'AI fold: a member without administrator rights does not see it');
  G.setAiFeature('aiGuide', true);
  eq(G.aiGuideOn(), false, 'AI: a member without administrator rights cannot switch the AI Guide on');
  G.currentUserId = admin.id;

  /* 2.3 test 2 (cont.): switch on — at once, stored, first line says it is an AI, requests go */
  G.UI.aiFoldOpen = true;
  G.setAiFeature('aiGuide', true);
  ok(G.aiGuideOn() && JSON.parse(G.Store.orgRaw(G.currentOrgId)).settings.aiGuide === true, 'AI on: the setting is stored with the organization\'s data');
  eq($('coachFab').style.display, '', 'AI on: the AI Guide button appears at once');
  has($('modalRoot').innerHTML, '<details class="ai-fold" ontoggle="UI.aiFoldOpen=this.open" open>', 'AI fold: stays open while the page redraws after a change');
  ok(/id="aiSet_aiGuide" checked/.test($('modalRoot').innerHTML), 'AI fold: the AI Guide switch shows on');
  G.closeModal();
  G.toggleCoach();
  eq(G.coachOpen, true, 'AI on: the AI Guide opens');
  const ph = $('coachPanel').innerHTML;
  ok(ph.indexOf('<div class="coach-ai-notice">You are talking to an AI assistant. It can make mistakes, so check anything important.</div>') > 0
     && ph.indexOf('coach-ai-notice') > ph.indexOf('class="coach-header"') && ph.indexOf('coach-ai-notice') < ph.indexOf('coachMsgsEl'), 'AI on: the panel\'s first line under its header says it is an AI (A.2.6)');
  $('coachInput').value = 'What is a stage gate?'; G.sendCoach();
  eq(calls.length, 1, 'AI on: a question sends one request');
  eq(calls[0], G.GUIDE_ENDPOINT, 'AI on: the request goes to the Guide route (AI Guide stage 1)');
  G.coachBusy = false;

  /* 2.3 test 3: switch off — button gone, open panel closes, no further request */
  G.setAiFeature('aiGuide', false);
  eq(G.coachOpen, false, 'AI switched off: the open panel closes');
  eq($('coachFab').style.display, 'none', 'AI switched off: the button disappears');
  $('coachInput').value = 'one more'; G.sendCoach();
  eq(calls.length, 1, 'AI switched off: no further request is sent');

  /* 2.3 test 4: Voice on and off */
  G.setAiFeature('voice', true);
  G.UI.navMore = true; G.render();
  has($('navRight').innerHTML, 'onclick="closeNavMore();toggleVoice()"', 'Voice on: its button appears (More menu)');
  G.UI.navMore = false; G.render();
  G.toggleVoice();
  eq(srMade, 1, 'Voice on: toggleVoice() starts speech recognition');
  G.recognition.onstart();
  eq(G.voiceActive, true, 'Voice on: listening');
  G.setAiFeature('voice', false);
  ok(G.voiceActive === false && srStops === 1, 'Voice switched off: the microphone stops at once');
  G.UI.navMore = true; G.render();
  ok($('navRight').innerHTML.indexOf('toggleVoice()') < 0, 'Voice switched off: its button disappears');
  G.UI.navMore = false; G.render();
  G.toggleVoice();
  eq(srMade, 1, 'Voice switched off: the microphone is not used again');

  /* 2.3 test 6: per organization */
  G.setAiFeature('aiGuide', true);
  const other = G.createOrg('AI Fixture B', {name:'Bea Admin', username:'aifixb'}).orgId;
  ok(G.aiGuideOn() === false && G.voiceOn() === false, 'AI: a new organization starts with both off');
  G.switchToOrg(curOrg);
  eq(G.aiGuideOn(), true, 'AI: switching it on in organization A leaves organization B off, and A on');
  G.deleteOrgById(other);
  eq(G.getOrgs().length, orgs0, 'AI: the fixture organization is cleaned up');

  /* 2.5: Team Chat carries no AI */
  G.currentUserId = admin.id;
  const c0 = G.chatArr().length; calls.length = 0;
  $('gchatTyping').textContent = '';
  $('gchatInput').value = 'Morning all';
  G.sendGChat();
  eq(G.chatArr().length, c0 + 1, 'CHAT 2.5: a message posts exactly once and nothing else is added');
  eq(G.chatArr()[c0].text, 'Morning all', 'CHAT 2.5: it is the poster\'s own message');
  eq(G.chatArr()[c0].name, 'You', 'CHAT 2.5: under the poster\'s name');
  eq($('gchatTyping').textContent, '', 'CHAT 2.5: no "is typing" line');
  eq(calls.length, 0, 'CHAT 2.5: no request goes to the AI service');
  ok(G.sendGChat.toString().indexOf('fetch') < 0 && G.sendGChat.toString().indexOf('roster') < 0, 'CHAT 2.5: sendGChat neither calls the AI service nor picks a colleague');
  G.chatArr().splice(c0, 1); G.Store.commit('chatMsgs');

  /* leave the organization as it was */
  if (savedSettings === undefined) delete G.data.settings; else G.data.settings = savedSettings;
  G.saveData(); G.render();
  G.fetch = _fetch; delete G.SpeechRecognition;
  G.isAppAdmin = _appAdmin; G.currentUserId = _user;
})();


/* ── SAMPLE TAB (Part 3, 2 Oct 2026): a private sample organization in each person's browser, opened from Demo ── */
(function(){
  const $ = (id) => G.document.getElementById(id);
  const ls = localStorageStub;
  const opened = []; const _open = G.open;
  G.open = function(u, t){ opened.push([u, t]); return null; };
  G.location = { pathname: '/enterprises/dev/innovation-pipeline/index.html', search: '', href: '' };
  const curOrg = G.currentOrgId, user0 = G.currentUserId, orgs0 = JSON.stringify(G.getOrgs()), ptr0 = G.Store.getCurrentOrg();
  const remember = {orgId: curOrg, userId: 'someone'}; G.Store.setRemember(remember);
  const admin = G.USERS.filter(u => u.admin === true)[0];
  G.currentUserId = admin.id;

  /* the person's own tab: Demo in the top bar where Notes was; Notes in the More menu above Org & Team */
  G.UI.navMore = true; G.render();
  let nr = $('navRight').innerHTML;
  ok(nr.indexOf('id="notesNavBtn"') < 0, 'SAMPLE 3.3.7: the Notes button has left the top bar');
  has(nr, '<button id="sampleNavBtn" class="btn-ghost pad-chip-md nav-action" onclick="openSampleTab()">&#9673; Demo</button>', 'SAMPLE 3.3.7: Demo is in the top bar');
  const order = ['nav-user-chip', 'onclick="openHelp()"', 'onclick="toggleTheme()"', 'id="gchatNavBtn"', 'id="sampleNavBtn"', 'onclick="toggleNavMore(event)"'].map(s => nr.indexOf(s));
  ok(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), 'SAMPLE 3.3.7: the top bar reads person, Help, Dark mode, Team Chat, Demo, More', order);
  const notesAt = nr.indexOf('onclick="closeNavMore();toggleNotes()"'), profAt = nr.indexOf('onclick="closeNavMore();openOrg()"');
  ok(notesAt > 0 && notesAt < profAt, 'SAMPLE 3.3.8: Notes is in the More menu, above Org & Team');
  has(nr, 'Notes <span id="notesCount" class="notes-count">' + (G.data.notes || []).length + '</span>', 'SAMPLE 3.3.8: with its count');
  ok(nr.indexOf('closeNavMore();seedData()') > 0 && nr.indexOf('closeNavMore();seedDataY2()') > 0, 'SAMPLE 3.2.9: the existing sample items stay in the More menu of a client organization');
  ok(nr.indexOf('restartSample()') < 0 && nr.indexOf('closeSample()') < 0, 'SAMPLE: Start again and Close appear only in the sample tab');
  G.UI.navMore = false; G.render();

  /* openSampleTab: only when signed in; leaves a one-time pass, opens ?sample=1 in a new tab */
  G.currentUserId = null; G.openSampleTab();
  ok(opened.length === 0 && ls.getItem('sample-tab-pass') === null, 'SAMPLE 3.3.1: nobody signed in, nothing opens');
  G.currentUserId = admin.id; G.openSampleTab();
  ok(opened.length === 1 && opened[0][0] === G.location.pathname + '?sample=1' && opened[0][1] === '_blank', 'SAMPLE 3.3.1: Demo opens the module in a new tab, in sample mode', opened);
  const pass1 = JSON.parse(ls.getItem('sample-tab-pass') || 'null');
  ok(pass1 && typeof pass1.t === 'number', 'SAMPLE 3.3.1: a pass is left in the browser\'s storage');

  /* the sample tab starts (a new page: same storage, its own memory) */
  const bootAsSampleTab = () => { G.location.search = '?sample=1'; G._bootDone = false; G.currentUserId = null; G.currentOrgId = null; return G.bootApp(); };
  ok(bootAsSampleTab() === true, 'SAMPLE 3.3.2: bootApp in a sample tab renders and returns true');
  ok(G.SAMPLE_MODE && !G.SAMPLE_REFUSED, 'SAMPLE 3.3.2: the pass is accepted');
  eq(ls.getItem('sample-tab-pass'), null, 'SAMPLE 3.3.2: the pass is removed, so it works only once');
  eq(G.currentOrgId, 'org_sample_local', 'SAMPLE 3.3.2: the tab works on org_sample_local');
  eq(G.Store.getCurrentOrg(), ptr0, 'SAMPLE 3.3.2: the person\'s stored organization pointer is untouched (never setCurrentOrg)');
  eq(JSON.stringify(G.getOrgs()), orgs0, 'SAMPLE 3.3.3: the sample is not added to the organization list');
  const stored = JSON.parse(ls.getItem('pipeline-org-data::org_sample_local') || 'null');
  ok(stored && Array.isArray(stored.roster) && stored.roster.length >= 8, 'SAMPLE 3.2.4: the copy is created from the built-in sample, under its own key');
  ok(stored.roster.every(u => !('passcode' in u)), 'SAMPLE 3.2.4: the sample people have no passwords (stored copy)');
  ok(G.USERS.every(u => !('passcode' in u)) && G.data.roster.every(u => !('passcode' in u)), 'SAMPLE 3.2.4: ... nor in memory, where the next save would store them');
  G.applyTeamRoster();
  ok(G.USERS.every(u => !('passcode' in u)), 'SAMPLE 3.2.4: applyTeamRoster does not give them the default PIN back');
  eq(JSON.stringify(stored.settings), '{"aiGuide":false,"voice":false}', 'SAMPLE 3.3.2: its AI settings are off');
  eq(G.currentUserId, G.USERS[0].id, 'SAMPLE 3.2.4: the tab enters as the first sample person');
  ok(!G.UI.entry, 'SAMPLE 3.2.4: nobody signs in');
  ok(G.isAppAdmin === false, 'SAMPLE: no app-administrator rights in the sample tab');

  /* 3.2.6 / 3.3.4: AI Guide, Voice and Team Chat off whatever the settings say */
  G.data.settings = {aiGuide: true, voice: true};
  ok(G.aiGuideOn() === false && G.voiceOn() === false, 'SAMPLE 3.3.4: the AI Guide and Voice are off even if the settings say on');
  G.render();
  eq($('coachFab').style.display, 'none', 'SAMPLE 3.3.4: no AI Guide button');
  G.toggleGChat();
  eq(G.gchatOpen, false, 'SAMPLE 3.3.4: Team Chat refuses to open');
  G.data.settings = {aiGuide: false, voice: false};

  /* 3.2.7: the top bar and More menu of the sample tab */
  G.UI.navMore = true; G.render();
  nr = $('navRight').innerHTML;
  ok(nr.indexOf('sampleNavBtn') < 0, 'SAMPLE 3.2.7: no Demo button in the sample tab');
  ok(nr.indexOf('gchatNavBtn') < 0, 'SAMPLE 3.3.4: no Team Chat button in the sample tab');
  ok(nr.indexOf('<div class="nav-user-chip" onclick="signOut()"') >= 0, 'SAMPLE (Sweep 4R item 9.2, amends Part 3): the sample person\'s chip is Sign Out, which closes the sample');
  ok(nr.indexOf('exportState()') < 0 && nr.indexOf('importState()') < 0, 'SAMPLE (Sweep 4R item 9.1, amends Part 3): no Export state or Import state in the sample tab\'s More menu');
  { const _cs = G.closeSample, _u = G.currentUserId; let n = 0; G.closeSample = function () { n++; }; G.signOut(); G.closeSample = _cs;
    ok(n === 1 && G.currentUserId === _u && !G.UI.entry, 'SAMPLE (Sweep 4R item 9.2): signOut in the sample tab closes the sample; nobody is signed out, no sign-in screen'); }
  has(nr, 'onclick="closeNavMore();restartSample()"><span class="nav-more-ic">&#8635;</span> Start the sample again</button>', 'SAMPLE 3.2.7: Start the sample again (A.3.3)');
  has(nr, 'onclick="closeNavMore();closeSample()"><span class="nav-more-ic">&#10005;</span> Close the sample</button>', 'SAMPLE 3.2.7: Close the sample (A.3.5)');
  ok(nr.indexOf('toggleNotes()') < 0 && nr.indexOf('openOrg()') < 0 && nr.indexOf('openAdmin()') < 0, 'SAMPLE 3.2.7: neither Notes, Org & Team nor Admin');
  ok(nr.indexOf('seedData()') < 0 && nr.indexOf('seedDataY2()') < 0, 'SAMPLE 3.3.5: the existing sample items are hidden in the sample tab');
  G.UI.navMore = false; G.render();

  /* no server traffic: no locks, no email; sign-out cannot touch the person's remembered sign-in */
  G.Collab.acquire('purpose');
  eq(ls.getItem('pipeline-locks::org_sample_local'), null, 'SAMPLE 3.3.3: no locks are taken');
  const _nf = G.fetch; const sent = []; G.fetch = function(u){ sent.push(u); return Promise.resolve({ok:true, json:()=>Promise.resolve({})}); };
  const _ep = G.NOTIFY_ENDPOINT; G.NOTIFY_ENDPOINT = 'https://notify.example.test/send';
  G.notifyDispatch({kind:'step', subject:'x', to:['a@b.c'], stepId:'1.1'});
  eq(sent.length, 0, 'SAMPLE 3.2.6: no email is sent');
  G.NOTIFY_ENDPOINT = _ep; G.fetch = _nf;
  G.signOut();
  ok(G.currentUserId && JSON.stringify(G.Store.getRemember()) === JSON.stringify(remember), 'SAMPLE: sign-out does nothing in the sample tab (the person\'s remembered sign-in survives)');

  /* Start the sample again */
  const firstIdea = G.data.ideas[0] && G.data.ideas[0].name;
  G.data.ideas[0].name = 'Changed in the sample tab'; G.saveData();
  G.restartSample();
  eq(G.data.ideas[0].name, firstIdea, 'SAMPLE 3.4.5: Start the sample again brings back the original sample');
  ok(G.data.roster.every(u => !('passcode' in u)) && G.currentUserId === G.USERS[0].id, 'SAMPLE: after starting again, still no passwords and the first sample person');

  /* a second opening reuses the copy (changes stay in this browser) */
  G.data.ideas[0].name = 'Kept between openings'; G.saveData();
  G.currentUserId = admin.id; G.SAMPLE_MODE = false; ls.setItem('sample-tab-pass', JSON.stringify({t: Date.now()}));
  bootAsSampleTab();
  eq(G.data.ideas[0].name, 'Kept between openings', 'SAMPLE 3.3.3: the person\'s copy is kept in their browser between openings');

  /* 3.2.2: opened any other way — no pass, no signed-in opener — shows only A.3.6 */
  G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; ls.removeItem('sample-tab-pass');
  bootAsSampleTab();
  ok(G.SAMPLE_REFUSED === true, 'SAMPLE 3.2.2: without a pass or a signed-in opener the tab is refused');
  eq($('app').innerHTML, '<div class="sample-refused"><p>Sign in to your organization, then open Demo from the top bar.</p></div>', 'SAMPLE 3.2.2: it shows only A.3.6');
  ok(!G.currentUserId && G.currentOrgId === null, 'SAMPLE 3.2.2: nothing is opened or signed in');
  ls.setItem('sample-tab-pass', JSON.stringify({t: Date.now() - 121000}));
  G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; bootAsSampleTab();
  ok(G.SAMPLE_REFUSED === true && ls.getItem('sample-tab-pass') === null, 'SAMPLE 3.3.2: a pass older than two minutes is refused, and removed');
  G.opener = { currentUserId: 'u1', SAMPLE_MODE: false };
  G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; bootAsSampleTab();
  ok(G.SAMPLE_REFUSED === false && G.currentOrgId === 'org_sample_local', 'SAMPLE 3.3.2: a signed-in opener is accepted without a pass');
  delete G.opener;

  /* back to the harness's own tab */
  G.SAMPLE_MODE = false; G.SAMPLE_REFUSED = false; G.location.search = '';
  G.currentOrgId = curOrg; G.loadData(); G.applyTeamRoster(); G.currentUserId = user0;
  ls.removeItem('pipeline-org-data::org_sample_local'); ls.removeItem('pipeline-org-rev::org_sample_local');
  G.Store.setRemember(null); G.open = _open; delete G.location;
  G.render();
})();


/* ── RESET AND DELETE (Part 4, 2 Oct 2026): Reset data in the admin console under the reset scope law (Rollout item 68) ── */
(function(){
  const $ = (id) => G.document.getElementById(id);
  const curOrg = G.currentOrgId, user0 = G.currentUserId, _appAdmin = G.isAppAdmin, _confirm = G.confirm, _prompt = G.prompt;
  const asked = []; G.confirm = function(m){ asked.push(m); return true; };
  G.isAppAdmin = true;

  /* fixture: organization X with an administrator, two members, program data and the AI Guide on; organization Y beside it */
  const X = G.createOrg('Reset Fixture X', {name:'Xena Admin', username:'xadmin', passcode:'4321'}, true).orgId;
  G.withOrgData(X, function(d){
    d.roster.push({id:'xm1', name:'Max Member', username:'xmember', passcode:'5555', role:'Analyst', initials:'MM', color:'#2D5A8E'});
    d.roster.push({id:'xm2', name:'Nia Member', username:'xmember2', passcode:'6666', role:'Analyst', initials:'NM', color:'#2D5A8E'});
    d.ideas = [{id:'i1', name:'An idea'}]; d.completedSteps = {'1.1': true}; d.notes = [{id:'n1', text:'a note'}];
    d.settings = {aiGuide: true, voice: false};
  });
  const Y = G.createOrg('Reset Fixture Y', {name:'Yuri Admin', username:'yadmin', passcode:'7777'}, true).orgId;
  G.switchToOrg(curOrg); G.currentUserId = user0;
  const yBefore = G.Store.orgRaw(Y), curBefore = G.Store.orgRaw(curOrg);
  ok(G.getOrgData(X).roster.length === 3, 'RESET fixture: an administrator and two members');

  /* withOrgData never switches organization or seals the session */
  const _seal = G.sealSession, _switch = G.switchToOrg; let sealed = 0, switched = 0;
  G.sealSession = function(){ sealed++; return _seal.apply(this, arguments); };
  G.switchToOrg = function(){ switched++; return _switch.apply(this, arguments); };

  /* 4.4 test 1, from the Admin panel */
  G.openAdmin();
  let mh = $('modalRoot').innerHTML;
  has(mh, 'onclick="adminResetOrg(\'' + X + '\')">Reset data</button>', 'RESET 4.2.2: Reset data is on the organization\'s row in the Admin panel');
  ok(G.getOrgs().every(o => mh.indexOf('adminResetOrg(\'' + o.id + '\')') > 0), 'RESET 4.2.2: on every organization\'s row, the current one included');
  G.UI.theme = 'dark';
  G.adminResetOrg(X);
  eq(asked[asked.length - 1], 'Reset all data for this organization? Team members other than administrators are also removed. This cannot be undone.', 'RESET 4.2.2: it asks A.4.1 first');
  ok(sealed === 0 && switched === 0, 'RESET 4.3: no switchToOrg and no sealSession');
  eq(G.currentModal, 'admin', 'RESET 4.4.1: the admin console stays open');
  ok(G.currentOrgId === curOrg && G.UI.theme === 'dark', 'RESET 4.4.1: the administrator stays where they were, session untouched');
  const xd = JSON.parse(G.Store.orgRaw(X));
  ok(xd.roster.length === 1 && xd.roster[0].username === 'xadmin', 'RESET 4.4.1: only the administrator is left in the people list', xd.roster.map(u => u.username));
  ok(xd.roster[0].admin === true && xd.roster[0].id === G.getOrgData(X).roster[0].id, 'RESET 4.4.1: the administrator keeps the same account (signing in: see 5.8 / RESET-SIGNIN)');
  ok(!xd.roster.some(u => /^xmember/.test(u.username)), 'RESET 4.4.1: the removed members are gone from the people list');
  ok(xd.ideas.length === 0 && Object.keys(xd.completedSteps).length === 0 && xd.notes.length === 0, 'RESET 4.4.1: the steps, outputs and other program data are empty');
  eq(JSON.stringify(xd.settings), '{"aiGuide":true,"voice":false}', 'RESET 4.4.1: the AI settings are as they were');
  eq(xd.enterprise.name, 'Reset Fixture X', 'RESET 4.2.2: the organization keeps its name');
  ok(G.getOrg(X) && G.getOrg(X).name === 'Reset Fixture X', 'RESET 4.2.2: the organization stays in the list');
  ok(G.Store.orgRaw(Y) === yBefore && G.Store.orgRaw(curOrg) === curBefore, 'RESET 4.4.1: every other organization is unchanged');
  G.UI.theme = 'light';

  /* refused when not the app administrator, or when the confirmation is declined */
  G.withOrgData(X, function(d){ d.ideas = [{id:'i2', name:'Again'}]; });
  G.confirm = function(m){ asked.push(m); return false; }; G.adminResetOrg(X);
  eq(JSON.parse(G.Store.orgRaw(X)).ideas.length, 1, 'RESET: declining A.4.1 resets nothing');
  G.confirm = function(m){ asked.push(m); return true; };
  G.isAppAdmin = false; G.adminResetOrg(X);
  eq(JSON.parse(G.Store.orgRaw(X)).ideas.length, 1, 'RESET: only the app administrator can reset');
  G.isAppAdmin = true;

  /* the full-screen admin console */
  G.UI.entry = {step:'admin'}; G.currentUserId = null; G.render();
  has($('app').innerHTML, 'onclick="adminConsoleReset(\'' + X + '\')">Reset data</button>', 'RESET 4.2.2: Reset data is on the row in the full-screen admin console');
  G.adminConsoleReset(X);
  ok(JSON.parse(G.Store.orgRaw(X)).ideas.length === 0 && G.UI.entry && G.UI.entry.step === 'admin', 'RESET: the full-screen console resets and stays open');
  G.UI.entry = null; G.currentUserId = user0;

  /* resetting the organization being viewed keeps the administrator in it */
  G.switchToOrg(X); G.currentUserId = G.USERS[0].id; sealed = 0; switched = 0;
  G.withOrgData(X, function(d){ d.roster.push({id:'xm3', name:'Late Member', username:'xmember3', passcode:'8888', initials:'LM', color:'#2D5A8E'}); d.ideas = [{id:'i3', name:'Live'}]; });
  G.currentUserId = 'xm3';
  G.openAdmin(); G.adminResetOrg(X);
  ok(sealed === 0 && switched === 0 && G.currentOrgId === X, 'RESET: resetting the organization being viewed is not a change of organization');
  ok(G.data.ideas.length === 0 && G.USERS.length === 1, 'RESET: the open workspace shows the reset data at once');
  ok(!!G.getCurrentUser() && G.getCurrentUser().username === 'xadmin', 'RESET: a viewer who was removed is replaced by the organization\'s administrator');

  /* 4.4 test 2: Delete */
  G.switchToOrg(curOrg); G.currentUserId = user0;
  G.openAdmin();
  G.adminDeleteOrg(Y);
  ok(!G.getOrg(Y) && G.Store.orgRaw(Y) === null, 'DELETE 4.4.2: the organization leaves the list and its data is gone');
  ok(!G.getOrgs().some(o => o.id === Y), 'DELETE 4.4.2: nobody of it is left in any people list (signing in: see 5.8 / DELETE-SIGNIN)');
  G.adminDeleteOrg(X);

  /* 4.2.3: the More menu's Reset all data is gone */
  G.UI.navMore = true; G.render();
  ok($('navRight').innerHTML.indexOf('Reset all data') < 0 && typeof G.clearData === 'undefined', 'RESET 4.2.3: the More menu no longer offers Reset all data');
  G.UI.navMore = false;

  /* S.4: the admin console's new-organization buttons keep the administrator's session and the panel open */
  G.sealSession = _seal; G.switchToOrg = _switch;
  const n0 = G.getOrgs().length;
  /* Part 5.7.4: both buttons open the new-organization form (a first person and a temporary password) */
  const newOrgForm = (org, user) => { $('ano_org').value = org; $('ano_name').value = 'First ' + user; $('ano_user').value = user; $('ano_temp').value = 'Temp#S4' + user + '26'; G.adminSaveNewOrg(); };
  G.openAdmin(); G.UI.theme = 'dark';
  G.adminAddOrg();
  newOrgForm('Added From Panel', 's4panel');
  ok(G.currentModal === 'admin' && G.UI.theme === 'dark' && G.currentOrgId === curOrg, 'S.4: the Admin panel\'s + Add organization keeps the panel open and the session as it was');
  G.UI.entry = {step:'admin'};
  G.adminConsoleNewOrg();
  newOrgForm('Added From Console', 's4console');
  ok(G.UI.theme === 'dark' && G.UI.entry && G.UI.entry.step === 'admin' && G.currentOrgId === curOrg, 'S.4: the full-screen console\'s + New Organization keeps the session');
  eq(G.getOrgs().length, n0 + 2, 'S.4: both organizations were created');
  G.getOrgs().filter(o => /^Added From/.test(o.name)).forEach(o => G.deleteOrgById(o.id));
  G.UI.entry = null; G.UI.theme = 'light'; G.closeModal();

  G.confirm = _confirm; G.prompt = _prompt; G.isAppAdmin = _appAdmin;
  G.switchToOrg(curOrg); G.currentUserId = user0; G.render();
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
  const credStore = () => JSON.parse(G.localStorage.getItem('devauth::credentials') || '{}');
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
  G.localStorage.removeItem('devauth::attempts');

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
  const orgKeys = Object.keys(Object.fromEntries([...Array(G.localStorage.length).keys()].map(i => [G.localStorage.key(i), 1]))).filter(k => /^pipeline-/.test(k));
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
/* ── AI GUIDE STAGE 1 (brief 12 Oct 2026): the panel talks to the Guide route; history, waiting, failure, formatting, copy ── */
async function guideStage1(){
  const $ = (id) => G.document.getElementById(id);
  const tick = () => new Promise(r => setImmediate(r));
  const keep = {org: G.currentOrgId, user: G.currentUserId, admin: G.isAppAdmin, step: G.currentStep, phase: G.currentPhase, settings: G.data.settings, fetch: G.fetch};
  const admin = G.USERS.filter(u => u.admin === true)[0];
  G.currentUserId = admin.id; G.isAppAdmin = false;
  G.data.settings = {aiGuide: true, voice: false};
  const sent = []; let answer = null;
  G.fetch = function(url, o){ const req = {url: String(url), o: o || {}, body: o && o.body ? JSON.parse(o.body) : undefined};
    sent.push(req); return new Promise(function(res, rej){ req.res = res; req.rej = rej; }); };
  const reply = (req, status, body) => { req.res({ ok: status >= 200 && status < 300, status: status, json: () => Promise.resolve(body) }); };
  const ask = (q) => { $('coachInput').value = q; G.sendCoach(); };
  const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };

  /* presets gone, welcome flagged */
  G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE);
  G.coachOpen = false; G.toggleCoach();
  let ph = $('coachPanel').innerHTML;
  ok(ph.indexOf('coach-preset') < 0 && typeof G.sendCoachPreset === 'undefined', 'GUIDE 1: no preset question buttons, and sendCoachPreset is gone');
  ok(ph.indexOf('coach-ai-notice') > 0 && ph.indexOf('coach-ai-notice') < ph.indexOf('coachMsgsEl'), 'GUIDE: the panel still opens with the AI notice (A.2.6)');
  eq(JSON.stringify(G.coachMsgs[0]), JSON.stringify({role:'ai', welcome:true, text:'Welcome to the AI Innovation Pipeline. I\'m your AI Guide. Ask me how to complete the step you\'re on, what to do next, or for ideas drawn from Faisal Hoque\'s book TRANSCEND.'}), 'GUIDE copy 1: the welcome message, word for word, flagged welcome:true');
  eq(JSON.stringify(G.guideHistory()), '[]', 'GUIDE: the welcome message is never resent');

  /* step context */
  G.currentStep = '1.1'; G.currentPhase = G.PH[0];
  eq(G.guideStepContext(), 'The user is on Step 1.1 (Assessment Battery) in Phase 1: Diagnose.', 'GUIDE 3: the step sentence names the step and phase');
  G.currentStep = '2'; G.currentPhase = G.PH[1];
  eq(G.guideStepContext(), 'The user is on the overview page for Phase 2: Organize.', 'GUIDE 3: a phase overview names the phase');
  G.currentStep = null; G.currentPhase = null;
  eq(G.guideStepContext(), 'The user is on the program overview.', 'GUIDE 3: elsewhere, the program overview');

  /* a question: the request, then the waiting state */
  G.currentStep = '1.1'; G.currentPhase = G.PH[0];
  ask('Give me three ideas for using AI in a small bookshop');
  eq(sent.length, 1, 'GUIDE 2: one question sends one request');
  const r1 = sent[0];
  eq(r1.url, G.GUIDE_ENDPOINT, 'GUIDE 2: it goes to the Guide route, not CLAUDE_API_URL');
  eq(G.GUIDE_ENDPOINT, 'api/guide.php', 'GUIDE env: the route is this build\'s own api/guide.php, relative to the page');
  ok(r1.o.method === 'POST' && r1.o.credentials === 'same-origin', 'GUIDE 2: POST, with the session cookie');
  eq(JSON.stringify(Object.keys(r1.body)), '["question","history","context"]', 'GUIDE 2: the body is {question, history, context} and nothing else (no model, no system prompt)');
  eq(r1.body.context, 'The user is on Step 1.1 (Assessment Battery) in Phase 1: Diagnose.', 'GUIDE 3: the request carries the step sentence');
  eq(JSON.stringify(r1.body.history), '[]', 'GUIDE: the first question carries no history');
  ok(G.coachBusy === true, 'GUIDE 9: busy while the answer is pending');
  ph = $('coachPanel').innerHTML;
  has(ph, '<div class="coach-sender">AI Guide</div><div class="coach-msg ai coach-thinking"><div class="coach-body"><span class="coach-dots" aria-hidden="true"><i></i><i></i><i></i></span>Thinking…</div></div>', 'GUIDE 9: the panel shows Thinking… with the typing dots');
  ok(/<textarea id="coachInput"[^>]* disabled/.test(ph) && /<button class="coach-send"[^>]* disabled>/.test(ph), 'GUIDE 9: the text box and send button are disabled');
  ask('a second question too soon');
  eq(sent.length, 1, 'GUIDE 9: sending again while waiting does nothing');

  /* the answer: formatted, escaped, waiting ends */
  reply(r1, 200, {answer: '## Ideas\n**Three** ideas:\n1. Smart recommendations\n2. Stock forecasting\n3. Event chatbot\n- note <script>x</script>'});
  await flush();
  ok(G.coachBusy === false, 'GUIDE 9: no longer busy once the answer arrives');
  ph = $('coachPanel').innerHTML;
  ok(ph.indexOf('Thinking') < 0 && !/<textarea id="coachInput"[^>]* disabled/.test(ph), 'GUIDE 9: Thinking… goes and the box is enabled again');
  has(ph, '<p class="coach-head"><strong>Ideas</strong></p><p><strong>Three</strong> ideas:</p><ol class="coach-list"><li>Smart recommendations</li><li>Stock forecasting</li><li>Event chatbot</li></ol><ul class="coach-list"><li>note &lt;script&gt;x&lt;/script&gt;</li></ul>', 'GUIDE 11: headings, bold and lists render; HTML in an answer is escaped');
  ok(ph.indexOf('**') < 0 && ph.indexOf('## ') < 0, 'GUIDE 11: no raw asterisks or hash marks');

  /* follow-up: the earlier exchange goes with it */
  ask('Expand on the second one');
  const r2 = sent[1];
  eq(JSON.stringify(r2.body.history), JSON.stringify([{role:'user', content:'Give me three ideas for using AI in a small bookshop'}, {role:'assistant', content:'## Ideas\n**Three** ideas:\n1. Smart recommendations\n2. Stock forecasting\n3. Event chatbot\n- note <script>x</script>'}]), 'GUIDE 3: a follow-up carries the earlier exchange');
  eq(r2.body.question, 'Expand on the second one', 'GUIDE: the question itself is sent as typed');

  /* failure: the message, and the failed exchange is not resent */
  reply(r2, 401, {success:false, message:'You must be signed in.'});
  await flush();
  const last = G.coachMsgs[G.coachMsgs.length - 1];
  ok(last.role === 'ai' && last.failed === true && last.text === 'Sorry, the AI Guide is unavailable right now. Please try again in a moment.', 'GUIDE 10: a refused request shows the unavailable message');
  ok(G.coachMsgs[G.coachMsgs.length - 2].failed === true, 'GUIDE 10: the question that failed is marked');
  ask('Try again');
  eq(sent[2].body.history.length, 2, 'GUIDE 10: the failed exchange is not resent with the next question');
  sent[2].rej(new Error('network'));
  await flush();
  eq(G.coachMsgs[G.coachMsgs.length - 1].text, 'Sorry, the AI Guide is unavailable right now. Please try again in a moment.', 'GUIDE 10: a network failure shows the same message');
  ask('Empty answer?'); reply(sent[3], 200, {answer: ''}); await flush();
  ok(G.coachMsgs[G.coachMsgs.length - 1].failed === true, 'GUIDE 10: an empty answer counts as a failure');
  ok(G.coachBusy === false, 'GUIDE 10: the panel is usable again after a failure');

  /* the history limit: last 10, starting with a user turn */
  G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE);
  for (let i = 0; i < 7; i++) { G.coachMsgs.push({role:'user', text:'q' + i}); G.coachMsgs.push({role:'ai', text:'a' + i}); }
  const h = G.guideHistory();
  ok(h.length === 10 && h[0].role === 'user' && h[0].content === 'q2' && h[9].content === 'a6', 'GUIDE: at most the last 10 messages are resent, starting with a question');

  /* AI switched off: nothing is sent */
  G.data.settings = {aiGuide: false, voice: false};
  const n = sent.length; ask('while off');
  eq(sent.length, n, 'GUIDE 13: with the AI Guide switched off, nothing is sent');
  G.data.settings = {aiGuide: true, voice: false};

  /* a sign-out while waiting: the late answer stays in the old conversation */
  G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE);
  ask('asked before the seal');
  const rs = sent[sent.length - 1];
  G.sealSession();
  ok(G.coachBusy === false && G.coachMsgs.length === 1, 'GUIDE seal: the new conversation starts fresh and not busy');
  reply(rs, 200, {answer: 'late answer'}); await flush();
  ok(G.coachMsgs.length === 1 && JSON.stringify(G.coachMsgs).indexOf('late answer') < 0, 'GUIDE seal: a reply still in flight never lands in the next conversation');

  /* the panel's UI (dev UI pass, 13 Oct 2026) */
  G.coachOpen = true; G.coachMsgs = JSON.parse(G.COACH_MSGS_PRISTINE);
  G.currentStep = '1.2'; G.currentPhase = G.PH[0]; G.renderCoachPanel();
  ph = $('coachPanel').innerHTML;
  has(ph, '<div class="coach-where">Step 1.2 · Brainstorm Use Cases</div>', 'GUIDE UI: the header says where the user is');
  G.currentStep = '3'; G.currentPhase = G.PH[2]; eq(G.guideWhere(), 'Phase 3 · Prepare', 'GUIDE UI: a phase page names the phase');
  G.currentStep = null; G.currentPhase = null; eq(G.guideWhere(), 'Program overview', 'GUIDE UI: elsewhere, the program overview');
  ok(ph.indexOf('newCoachConversation()') < 0, 'GUIDE UI: no New conversation button before anything is asked');
  ok(ph.indexOf('aria-label="Close the AI Guide"') > 0 && ph.indexOf('aria-label="Ask the AI Guide"') > 0 && ph.indexOf('aria-label="Send"') > 0 && ph.indexOf('role="log" aria-live="polite"') > 0, 'GUIDE UI: buttons, box and message log are labelled for screen readers');
  G.coachMsgs.push({role:'user', text:'line one\nline <two>'}); G.renderCoachPanel(); ph = $('coachPanel').innerHTML;
  has(ph, '<div class="coach-sender">You</div><div class="coach-msg user"><div class="coach-body">line one\nline &lt;two&gt;</div></div>', 'GUIDE UI: the user\'s own message is escaped and labelled "You"');
  ok(/<div class="coach-row user"><div class="user-av"/.test(ph), 'GUIDE UI: the user\'s message carries their avatar, as in Team Chat');
  ok(ph.indexOf('coachCopy(this)') < 0, 'GUIDE UI: no Copy on the welcome message');
  G.coachMsgs.push({role:'ai', text:'An answer'}); G.renderCoachPanel(); ph = $('coachPanel').innerHTML;
  ok(ph.split('coachCopy(this)').length === 2, 'GUIDE UI: a real answer has a Copy button');
  $('coachInput').value = 'half-typed draft'; G.renderCoachPanel();
  eq($('coachInput').value, 'half-typed draft', 'GUIDE UI: an app redraw keeps what the user was typing');
  ok(ph.indexOf('newCoachConversation()') > 0, 'GUIDE UI: New conversation appears once something is asked');
  G.coachBusy = true; const inFlight = G.coachMsgs; G.newCoachConversation();
  ok(G.coachMsgs.length === 1 && G.coachMsgs[0].welcome === true && G.coachBusy === false && G.coachMsgs !== inFlight, 'GUIDE UI: New conversation starts again at the welcome, not busy, in a new thread');
  G.coachOpen = false;

  /* entry screens keep what was typed across a redraw nobody asked for (13 Oct 2026; proved in a browser) */
  ok(G.render.toString().indexOf('entryFieldsSnapshot(app)') > 0 && G.render.toString().indexOf('entryFieldsRestore(app,') > 0 && typeof G.entryFieldsSnapshot === 'function', 'ENTRY: render() carries typed sign-in/set-up values across a background redraw');

  /* copy 2 and 3, word for word */
  const appSrc = code;
  has(appSrc, "{ic:'\\u2726 AI Guide',d:'Orange button, bottom-right corner. It knows which step you are on and draws on Faisal Hoque\\u2019s book TRANSCEND and a guide to this program. Ask it how to complete a step, what comes next, or for ideas. It can\\u2019t see the data you have entered.'}", 'GUIDE copy 2: the help text');
  has(appSrc, 'The AI Guide sends your question, your recent messages in the Guide panel, and the name of the step you are on to Pinecone, an AI service, routed through the program\\u2019s server rather than directly from your browser. Pinecone adds relevant passages from the program\\u2019s reference material and has a Claude model, made by Anthropic, write the answer.', 'GUIDE copy 3: the privacy sentence');
  ok(appSrc.indexOf('Context-aware for whichever step') < 0 && appSrc.indexOf('to the Anthropic API, routed') < 0, 'GUIDE copy: the old help and privacy text are gone');
  ok(!/pcsk_/.test(appSrc), 'GUIDE 7: no Pinecone key in app.js');
  ok(typeof G.CLAUDE_API_URL === 'string' && G.CLAUDE_API_URL.length > 0, 'GUIDE: CLAUDE_API_URL is left in place');

  /* back to the harness's own state */
  G.fetch = keep.fetch; G.coachBusy = false;
  G.UI.entry = null; G.switchToOrg(keep.org); G.currentUserId = keep.user; G.isAppAdmin = keep.admin;
  G.data.settings = keep.settings; G.currentStep = keep.step; G.currentPhase = keep.phase; G.render();
}

guideStage1().catch(e => { fail++; failures.push('GUIDE STAGE 1 threw: ' + (e && e.stack || e)); }).then(passwordsEndToEnd).catch(e => { fail++; failures.push('PASSWORDS END TO END threw: ' + (e && e.stack || e)); }).then(function(){
console.log('Behavioral harness (rebuilt) — ' + (pass+fail) + ' assertions');
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
