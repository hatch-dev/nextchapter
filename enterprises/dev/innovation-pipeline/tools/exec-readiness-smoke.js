#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   exec-readiness-smoke.js — render every Executive Readiness page
   and pull every trigger on it
   ─────────────────────────────────────────────────────────────
   The program's pages are generated (tools/port-exec-readiness.js
   lifts them out of the reference build), and a generated port fails
   in two specific ways that reading the diff will not show you:

     1. A page renders down to the line that reads a name nobody
        brought across, and dies there. Nothing says so until someone
        opens that one screen — and there are 35 of them.
     2. A page renders perfectly and a button does nothing, because
        its handler lives inside an onclick STRING and the name in
        that string was never repointed at ER.

   So this walks all 35 pages — the Readiness overview, the four phase
   landings, seventeen step bodies, thirteen output reports and the
   Lead tab — and then EVALUATES every inline handler in the markup
   each one produced. A handler is code the browser will run later; the
   only way to know it resolves is to run it.

   Three times over: against an empty workspace (every null guard, the
   state a new organization is actually in), a hand-built one, and the
   program's own sample data.

   Then the three things that make a workspace THIS program's rather
   than another's, all of which were wrong before:

     the seed    builds this program's document — leaders, an org chart,
                 a scored battery — and none of the Pipeline's
     the export  names the program it came out of
     the import  refuses a document from a different one

   And finally what the seed SENDS: a second sandbox is loaded in served
   mode (Store decides that from location.protocol, at load, so it has
   to be a separate one) with a fetch that records instead of sending.
   Nothing leaves the process and no database is touched; what is
   asserted is the request the browser would have made — the right
   module, a force-save, this program's document.

   Failures are narrowed to the port's own failure modes — a name that
   resolves to nothing. A handler that throws for a reason of its own
   (a confirm() declined, an element the stub DOM does not have) is not
   this script's business and is counted separately.

   Usage:  node tools/exec-readiness-smoke.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;
const MODULE_ID = 'exec-readiness';

/* ── The page list ─────────────────────────────────────────────
   Every address inside the program. Written out rather than derived from PH so
   that a phase quietly losing a step shows up here as an untested id rather
   than as a shorter run nobody notices. */
const STEPS = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4',
  '3.1', '3.2', '3.3', '3.4', '3.5', '4.1', '4.2', '4.3', '4.4', '5.2', '5.3'];
const OUTCOMES = ['out-readiness', 'out-inventory', 'out-riskmap', 'out-structure',
  'out-collab', 'out-competency', 'out-fluency', 'out-decisions', 'out-mmprinciples',
  'out-values', 'out-rhythm', 'out-evalplan', 'out-review'];

/* ── Load order ────────────────────────────────────────────────
   shell.html is the single source of truth, exactly as in
   tools/_unused/harness.js. The module's own scripts are not in it — boot.js
   document.writes them once the URL has been resolved — so they are spliced in
   where the browser would have put them, right after boot.js. */
const html = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));

const APP_FILES = (html.match(/<script\s+src="([^"]+)"/g) || [])
  .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
  .filter(s => !/^https?:/.test(s))
  .map(s => path.join(ROOT, s))
  .filter(p => fs.existsSync(p));

const entry = (CATALOGUE.roles || []).reduce((found, role) =>
  found || (role.modules || []).filter(m => m.id === MODULE_ID)[0], null);
if (!entry) { console.error('no such module in the catalogue:', MODULE_ID); process.exit(1); }
const MODULE_FILES = (entry.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
{
  const at = APP_FILES.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  APP_FILES.splice(at >= 0 ? at + 1 : 0, 0, ...MODULE_FILES);
}

/* ── Stub DOM ──────────────────────────────────────────────────
   Deliberately permissive: every unknown property answers with something
   chainable, so the pages get all the way through their markup instead of
   stopping at the first DOM call the stub does not implement. This is not a
   browser and does not pretend to be — it is enough of one to run a render and
   a handler to completion. */
const NUM = { scrollTop: 1, scrollHeight: 1, scrollLeft: 1, scrollWidth: 1, offsetTop: 1, offsetLeft: 1, offsetWidth: 1, offsetHeight: 1, clientWidth: 1, clientHeight: 1, selectionStart: 1, selectionEnd: 1, length: 1 };
const STR = { innerHTML: 1, outerHTML: 1, textContent: 1, innerText: 1, value: 1, className: 1, id: 1, name: 1, type: 1, href: 1, src: 1, title: 1, placeholder: 1, tagName: 1 };

function classList() {
  const s = Object.create(null);
  return {
    add() { for (var i = 0; i < arguments.length; i++) s[arguments[i]] = 1; },
    remove() { for (var i = 0; i < arguments.length; i++) delete s[arguments[i]]; },
    toggle(c, f) { const w = f === undefined ? !s[c] : !!f; if (w) { s[c] = 1; return true; } delete s[c]; return false; },
    contains(c) { return !!s[c]; }
  };
}
function el(tag) {
  const t = {
    style: new Proxy({}, { get: (o, k) => (k in o ? o[k] : ''), set: (o, k, v) => { o[k] = v; return true; } }),
    classList: classList(), dataset: {}, children: [], childNodes: [],
    tagName: (tag || 'div').toUpperCase(), nodeType: 1,
    value: '', innerHTML: '', textContent: '', className: '', id: '', checked: false
  };
  return new Proxy(t, {
    get(o, k) {
      if (typeof k === 'symbol') return o[k];
      if (k in o) return o[k];
      if (k === 'parentNode' || k === 'parentElement' || k === 'firstChild' ||
        k === 'lastChild' || k === 'nextSibling' || k === 'previousSibling') return null;
      if (k === 'files' || k === 'options' || k === 'selectedOptions') return [];
      if (NUM[k]) return 0;
      if (STR[k]) return '';
      if (k === 'querySelectorAll') return () => [];
      if (k === 'closest' || k === 'matches' || k === 'getAttribute') return () => null;
      if (k === 'getBoundingClientRect') return () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
      if (k === 'appendChild' || k === 'insertBefore' || k === 'replaceChild') return a => a;
      return () => el();
    },
    set(o, k, v) { o[k] = v; return true; }
  });
}
function storage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); }, clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null,
    get length() { return m.size; }
  };
}
/* Every fetch is a network failure — there is no PHP behind this — settled
   inline so the app's fallback runs in the same tick as the call. */
function settled(state, val) {
  const self = {
    then(ok, err) {
      try {
        if (state === 'ok') return ok ? adopt(ok(val)) : self;
        return err ? adopt(err(val)) : self;
      } catch (e) { return settled('err', e); }
    },
    catch(err) { return self.then(null, err); },
    finally(fn) { try { if (fn) fn(); } catch (e) { } return self; }
  };
  return self;
}
function adopt(v) { return v && typeof v.then === 'function' ? v : settled('ok', v); }

/* `served` decides file:// or http://, and it has to be decided BEFORE the
   scripts run: Store reads location.protocol once, at load, into
   server.enabled. Flipping it afterwards changes nothing — every save stays a
   local mirror write and nothing is ever sent. */
function makeSandbox(served) {
  const byId = Object.create(null);
  const documentStub = {
    getElementById(id) { if (!byId[id]) { byId[id] = el(); byId[id].id = id; } return byId[id]; },
    querySelector() { return el(); },
    querySelectorAll() { return []; },
    createElement(t) { return el(t); },
    createDocumentFragment() { return el(); },
    createTextNode() { return el(); },
    addEventListener() { }, removeEventListener() { },
    readyState: 'complete', activeElement: null,
    body: el('body'), documentElement: el('html'), head: el('head'), title: ''
  };
  const sandbox = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    /* No APP_BOOT — nothing resolved a route. The registry then falls back to
       ?module=, which is how this picks the program under test. */
    localStorage: storage(), sessionStorage: storage(),
    document: documentStub,
    location: served
      ? {
        href: 'http://localhost/apps/?module=' + MODULE_ID, protocol: 'http:', host: 'localhost',
        hostname: 'localhost', port: '', pathname: '/apps/', search: '?module=' + MODULE_ID,
        hash: '', origin: 'http://localhost', assign() { }, replace() { }, reload() { }
      }
      : {
        href: 'file:///index.html?module=' + MODULE_ID, protocol: 'file:', host: '', hostname: '',
        port: '', pathname: '/index.html', search: '?module=' + MODULE_ID, hash: '', origin: 'null',
        assign() { }, replace() { }, reload() { }
      },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, length: 1, state: null },
    navigator: { userAgent: 'smoke', language: 'en-US', languages: ['en-US'], onLine: false, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:smoke', revokeObjectURL() { } },
    /* Keeps its parts, so the export check can read what was actually written
       rather than trusting that something was. */
    Blob: function (parts) { this.parts = parts || []; this.text = (parts || []).join(''); },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    matchMedia: () => ({ matches: false, media: '', addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    addEventListener() { }, removeEventListener() { },
    open() { return null; }, scrollTo() { }, print() { },
    confirm: () => true, alert() { }, prompt: () => null,
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    FileReader: function () { this.readAsText = () => { }; this.readAsDataURL = () => { }; this.addEventListener = () => { }; },
    fetch: () => settled('err', new Error('smoke: no server')),
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  return sandbox;
}

const sandbox = makeSandbox(false);

/* ── Results ───────────────────────────────────────────────────
   Two buckets, and the split is the whole point. A name that resolves to
   nothing is this port's bug. Anything else a handler does — declining a
   confirm, reaching for an element the stub has not got — is not. */
const broken = [];   // ReferenceError / not-a-function: the port is wrong
const other = new Map();  // everything else, counted and shown under -v
let handlersRun = 0, pagesRendered = 0;

const PORT_FAILURE = /is not defined|is not a function|Cannot read propert(y|ies) of undefined/;
function record(where, e) {
  const msg = (e && e.message) || String(e);
  if (PORT_FAILURE.test(msg)) broken.push(where + ' → ' + msg);
  else other.set(msg, (other.get(msg) || 0) + 1);
}

function load() {
  APP_FILES.forEach(p => {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: rel }); }
    catch (e) { broken.push('LOAD ' + rel + ' → ' + ((e && e.message) || e)); }
  });
}

/* ── Handlers ──────────────────────────────────────────────────
   Every on*="…" in the page, evaluated with the `this` and `event` an inline
   attribute would have had. `data` is snapshotted and restored around each one:
   these are real handlers, they really do delete roles and mark steps complete,
   and one of them running first would change what the next one is testing. */
function pullEveryTrigger(G, markup, where) {
  const found = markup.match(/\son[a-z]+="([^"]*)"/g) || [];
  const snapshot = JSON.stringify(G.data);
  const uiSnapshot = JSON.stringify(G.UI);
  found.forEach(attr => {
    const body = attr.slice(attr.indexOf('="') + 2, -1)
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (!body.trim()) return;
    handlersRun++;
    const thisEl = el('button');
    const event = {
      target: thisEl, currentTarget: thisEl, clientX: 0, clientY: 0, key: 'Enter',
      preventDefault() { }, stopPropagation() { }, stopImmediatePropagation() { }
    };
    try {
      vm.runInContext(
        '(function(event){ return (function(){ ' + body + ' }).call(__smokeThis) })(__smokeEvent)',
        Object.assign(sandbox, { __smokeThis: thisEl, __smokeEvent: event }),
        { filename: 'handler@' + where }
      );
    } catch (e) { record(where + ' handler `' + body.slice(0, 70) + '`', e); }
    try { G.data = JSON.parse(snapshot); G.UI = JSON.parse(uiSnapshot); } catch (e) { }
  });
  return found.length;
}

function renderEvery(G, label) {
  const pages = [{ page: 'pipeline' }]
    .concat([1, 2, 3, 4].map(n => ({ page: 'phase', step: String(n) })))
    .concat([{ page: 'phase5' }])
    .concat(STEPS.map(s => ({ page: 'step', step: s })))
    .concat(OUTCOMES.map(o => ({ page: 'outcome', step: o })));

  pages.forEach(target => {
    const where = label + ' ' + target.page + (target.step ? ':' + target.step : '');
    /* Through go(), not straight to the renderer: go() is what sets
       currentPhase, runs the module's beforeNavigate hook and picks the page —
       all of it part of what is being tested. */
    let markup = '';
    try {
      G.go(target.page, target.step);
      const fn = G.Modules.page(target.page);
      if (!fn) { broken.push(where + ' → the module claims no such page'); return; }
      markup = fn();
    } catch (e) { if(process.env.SMOKE_STACK) console.log(e.stack); record(where + " render", e); return; }

    pagesRendered++;
    if (typeof markup !== 'string' || markup.length < 200) {
      broken.push(where + ' → rendered ' + (typeof markup === 'string' ? markup.length + ' chars' : typeof markup));
      return;
    }
    const n = pullEveryTrigger(G, markup, where);
    if (VERBOSE) console.log('  ' + where.padEnd(28) + String(markup.length).padStart(7) + ' chars  ' + String(n).padStart(4) + ' handlers');
  });
}

/* ── Run ───────────────────────────────────────────────────────── */
load();
const G = sandbox;

if (!G.Modules || G.Modules.activeId() !== MODULE_ID) {
  console.error('the active module is', G.Modules && G.Modules.activeId(), '— expected', MODULE_ID);
  process.exit(1);
}
if (!G.ER) { console.error('window.ER was never created — steps.js did not load'); process.exit(1); }

try {
  const boot = G.createOrg('Smoke Org', { name: 'Owner', username: 'owner', passcode: '1234' });
  G.currentUserId = boot.userId;
  if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster();
} catch (e) { broken.push('BOOT createOrg → ' + ((e && e.message) || e)); }

/* Pass 1 — a brand-new workspace. Every list empty, every score absent: the
   state the first person to open the program is actually in, and the one that
   finds a page reading .length off something that isn't there yet. */
if (VERBOSE) console.log('\nempty workspace');
G.data = G.Modules.emptyData();
renderEvery(G, 'empty');

/* Pass 2 — a workspace with content, for every branch that only exists once
   there are leaders to profile, roles on the chart and scores to average. */
if (VERBOSE) console.log('\npopulated workspace');
G.data = G.Modules.emptyData();
G.data.leaders = [
  { id: 'L1', name: 'Ada Kern', role: 'CEO', fluency: 'developing', changeExp: 'strong', bandwidth: 'stretched', engagement: 'champion', scope: 'Whole organization' },
  { id: 'L2', name: 'Ravi Menon', role: 'CTO', fluency: 'fluent', changeExp: 'moderate', bandwidth: 'available', engagement: 'supportive', scope: 'Engineering' },
  { id: 'L3', name: 'Jo Baptiste', role: 'COO', fluency: 'novice', changeExp: 'limited', bandwidth: 'overloaded', engagement: 'sceptical', scope: 'Operations' }
];
/* The role shape is the one saveOrgRole2() writes — name/level/parentId/
   occupantLeaderId, not title/parent/leaderId. Worth being exact: the chart
   reads r.name.length straight out, so a fixture with the wrong field name
   fails in the renderer and reads exactly like a broken port. */
G.data.orgChart = [
  { id: 'board', name: 'Board', level: 0, parentId: '', occupantLeaderId: null, guidingConcepts: '', taggedValues: [], members: ['L1'], source: 'addition' },
  { id: 'R1', name: 'Chief Executive', level: 1, parentId: 'board', occupantLeaderId: 'L1', guidingConcepts: 'Sets the pace.', taggedValues: ['v1'], members: [], source: 'leader' },
  { id: 'R2', name: 'Chief Technology', level: 2, parentId: 'R1', occupantLeaderId: 'L2', guidingConcepts: '', taggedValues: [], members: [], source: 'leader' },
  { id: 'R3', name: 'Chief Operating', level: 2, parentId: 'R1', occupantLeaderId: 'L3', guidingConcepts: '', taggedValues: [], members: [], source: 'leader' }
];
G.data.assessments = {
  purpose: { clarity: 4, aiAlignment: 3, coherence: 4, mission: 'Ship trustworthy systems.' },
  fluency: { foundational: 3, failureModes: 2, costRisk: 3, strategic: 4, handsOn: 2 },
  change: { trackRecord: 3, fatigue: 4, middleMgmt: 2, psySafety: 4, learningCulture: 3 },
  structure: { crossCollab: 3, mmRole: 2, ownership: 'ceo' },
  ethical: { identity: 4, evidence: 3, commitments: 3, assumptions: 2 }
};
G.data.completedSections = { A: true, B: true, C: true };
G.data.completedSteps = { '1.1': true, '1.2': true, '1.3': true, '2.1': true };
G.data.risks = [{ id: 'zillow', likelihood: 3, impact: 4 }, { id: 'cigna', likelihood: 2, impact: 5 }];
G.data.competencyFramework = { scores: { 'L1_orchestration': 3, 'L2_hybrid': 4 }, definitions: { orchestration: 'Directing hybrid teams.' } };
G.data.valuesArch = [{ id: 'v1', principle: 'Evidence over instinct', domain: 'epistemological' }];
G.data.decisionSims = { autonomous_response: 'Escalate to the council.', ethical_premortem: 'Who is harmed first?' };
G.data.fluencySprint = { project: 'Support triage', leaderTasks: { L1: { task1: 'Drafted the brief' }, L2: { task1: 'x', task2: 'y' } } };
G.data.mmActivation = { workflows: ['Triage', 'Escalation'], humanOnly: ['Terminations'] };
G.data.opRhythm = { agenda: 'Monthly AI review', agendaOwner: 'Ada' };
G.data.rhythm = { cadence: 'monthly' };
G.data.evaluation = { criteria: 'AI-readiness indicators' };
G.data.evalSuccession = { indicators: 'Judgment under uncertainty', bench: 'Two deep at every seat' };
G.data.slowThinking = [{ date: '2026-07-01', note: 'Held the decision a week.' }];
G.data.indivDone = { L1: { '1.4': true } };
try { G.applyTeamRoster(); } catch (e) { }
renderEvery(G, 'seeded');

/* ── The sample workspace ──────────────────────────────────────
   Seeding is the program's, not the shell's: the More menu offers whatever
   Modules.seeds() lists, and each seed builds its own program's document. What
   is checked here is that this program's seed produces THIS program's document
   — the failure it replaces is the shell's Pipeline seed filling an Executive
   Readiness workspace with ideas and projects, wiping it in the process.

   Then every page is rendered against it, because the seeded workspace is what
   a demo actually puts on screen, and it exercises branches neither the empty
   nor the hand-built pass reaches. */
if (VERBOSE) console.log('\nseeded workspace');
const seeds = G.Modules.seeds();
if (seeds.length !== 1 || seeds[0].id !== 'sample') {
  broken.push('SEEDS: expected one seed named "sample", got ' + JSON.stringify(seeds.map(s => s.id)));
} else {
  G.data = G.Modules.emptyData();
  try { seeds[0].run(); } catch (e) { record('SEEDS run', e); }

  const d = G.data || {};
  const wants = ['leaders', 'assessments', 'orgChart', 'roster', 'enterprise'];
  wants.forEach(k => {
    const v = d[k];
    const filled = Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0);
    if (!filled) broken.push('SEEDS: the sample workspace has no ' + k);
  });
  /* The Pipeline's keys must be absent. Their presence would mean the shell's
     seed ran instead of this program's — which is the whole bug. */
  ['ideas', 'projects', 'portfolio', 'capital'].forEach(k => {
    if (d[k] !== undefined) broken.push('SEEDS: the sample workspace carries the Pipeline\'s "' + k + '"');
  });
  renderEvery(G, 'seeded');
}

/* ── The printed documents carry CONTENT ───────────────────────
   Added 17 Sep 2026, with the directive of 16 September (printed
   documents, record tables, the Report Manager).

   Everything above asks whether a page rendered and whether a handler
   resolved. That is blind to the failure this layer actually has. The
   record engine is driven by tables that are DECLARED empty and FILLED
   by separate top-level statements:

     var LAYER_MAPS={}; LAYER_MAPS.leader={…} LAYER_MAPS.lrisk={…}

   An emitter that carries the declaration and drops the fills produces a
   module where lyRender() opens `var map=LAYER_MAPS[type]; if(!map||!rec)
   return ''` and returns nothing, for ever. Every page still renders,
   every handler still resolves, and every document prints a cover, its
   headings and no records. tools/port-exec-readiness.js carries the fills
   by rule now; this is the check that says so, and it was negative-tested
   by removing them.

   The documents are captured, not printed: printDocument() opens a window
   and document.write()s into it, so a stub window.open hands back exactly
   what the print window would have received. */
if (VERBOSE) console.log('\nprinted documents');
{
  const openWas = G.window && G.window.open;
  let doc = '';
  const stubOpen = () => {
    let buf = '';
    return {
      document: { write: s => { buf += s; }, close: () => { doc = buf; }, title: '' },
      print() { }, focus() { }, close() { }
    };
  };
  G.window.open = stubOpen; G.open = stubOpen;
  const grab = fn => { doc = ''; try { fn(); } catch (e) { record('PRINT', e); } return doc; };
  const rows = h => (h.match(/<tr/g) || []).length;

  /* The three outputs that print their leaders as record tables. Each
     goes through lyRegister -> lyRender -> LAYER_MAPS, so an empty map
     shows up here as a document with a cover and no rows.

     out-riskmap is deliberately NOT here: riskMapDoc draws its own
     bordered blocks, not ly-rec tables. LAYER_MAPS.lrisk is reached only
     by lyRender('lrisk') for a single-risk section, so it is proved in
     the Report Manager block below instead. */
  const RECORD_DOCS = {
    'out-inventory': 'leader',
    'out-competency': 'leader',
    'out-fluency': 'leaderFluency'
  };
  OUTCOMES.forEach(id => {
    G.currentPage = 'outcome'; G.currentStep = id;
    const h = grab(() => G.ER.printCurrentOutput());
    if (h.length < 800) { broken.push('PRINT: ' + id + ' printed ' + h.length + ' bytes'); return; }
    if (!/NextChapter/.test(h)) broken.push('PRINT: ' + id + ' has no cover kicker');
    if (!/Next Chapter, LLC/.test(h)) broken.push('PRINT: ' + id + ' has no copyright footer');
    if (/<button/i.test(h)) broken.push('PRINT: ' + id + ' printed a control');
    if (RECORD_DOCS[id]) {
      if (!/class="ly-rec"/.test(h))
        broken.push('PRINT: ' + id + ' printed no record table (LAYER_MAPS.' + RECORD_DOCS[id] + ' empty?)');
      else if (rows(h) < 8)
        broken.push('PRINT: ' + id + ' record tables have only ' + rows(h) + ' rows (LAYER_MAPS.' + RECORD_DOCS[id] + ' empty?)');
    }
  });

  /* The Phase 5 documents and Track Program, each its own builder. */
  [['5.1', 'Leadership Structure'], ['5.2', 'L&D'], ['5.3', 'My Development']].forEach(([sid, want]) => {
    G.currentPage = 'step'; G.currentStep = sid;
    const h = grab(() => G.ER.printCurrentPage());
    if (h.length < 800) broken.push('PRINT: step ' + sid + ' printed ' + h.length + ' bytes');
    else if (h.indexOf(want) < 0) broken.push('PRINT: step ' + sid + ' does not name "' + want + '"');
  });
  {
    const h = grab(() => G.ER.printMgmtAnalytics());
    if (h.indexOf('Module Management') < 0)
      broken.push('PRINT: Track Program did not print the Module Management document');
  }

  /* The Report Manager: one section of every catalogue kind, each asserted
     to print CONTENT rather than just its numbered heading. */
  try {
    const def = G.ER.rcNew('Smoke report');
    const id = (def && def.id) || (G.ER.rcDefs()[G.ER.rcDefs().length - 1] || {}).id;
    const cat = G.ER.rcCatalogue();
    ['output', 'page'].forEach(k => {
      const u = cat.find(x => x.kind === k);
      if (!u) { broken.push('REPORTS: the catalogue offers no "' + k + '"'); return; }
      G.ER.rcToggle(id, G.ER.rcKey(u));
    });
    /* One record of EVERY type, because each type is a separate entry in
       LAYER_MAPS and they fail independently: lrisk is reached from here
       and nowhere else in the program. */
    ['leader', 'lrisk'].forEach(t => {
      const u = cat.find(x => x.kind === 'record' && x.type === t);
      if (!u) { broken.push('REPORTS: the catalogue offers no record of type "' + t + '"'); return; }
      G.ER.rcToggle(id, G.ER.rcKey(u));
    });
    const h = grab(() => G.ER.rcPrint(id));
    if (h.length < 1500) broken.push('REPORTS: the compiled report is only ' + h.length + ' bytes');
    if (h.indexOf('Contents') < 0) broken.push('REPORTS: the report has no contents page');
    /* Each section must bring a body, not just its heading. */
    const def2 = G.ER.rcFind(id);
    (def2 ? def2.units : []).forEach((u, i) => {
      const body = G.ER.rcUnitBody(u) || '';
      if (body.replace(/<[^>]*>/g, '').trim().length < 40)
        broken.push('REPORTS: section ' + (i + 1) + ' (' + u.kind + ' ' + u.id + ') printed a heading over nothing');
    });
  } catch (e) { record('REPORTS', e); }

  if (openWas) { G.window.open = openWas; G.open = openWas; }
}

/* ── Written dates read "Oct 14, 2026" ─────────────────────────
   Governance directive of 5 Sep 2026 (Family Standard Spec §17A, Cross-Module
   Rollout item 76), rolled onto this program.

   This build was already in far better shape than the Governance one, and it
   is worth writing down WHY, because the obvious reading of the code is wrong:
   `toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' })`
   does NOT print day-first. The locale decides field ORDER; the options only
   decide which fields appear and how wide. So the three log surfaces here were
   already printing "Oct 14, 2026" and were routed through fmtDate() for the
   directive's other reason — one formatter, not four — with no visible change.

   Two things were genuinely off the family form, and one correctness fix:
     · the printed Leadership Structure header used month:'long' and read
       "October 14, 2026";
     · the org autosave name used a bare toLocaleDateString('en-US'), which is
       "10/14/2026" — the numeric form the directive names outright. (Dead code:
       orgAutosaveBeforeReset is declared and never called, so it never shipped.
       Fixed anyway; the reference is a runnable app.)
     · fmtDate() had no local-noon guard, so a stored YYYY-MM-DD parsed as UTC
       midnight and printed as the day BEFORE for every reader west of UTC.

   The scan therefore looks for three shapes, not one. */
if (VERBOSE) console.log('\nwritten dates');
{
  const BAD = /\d{4}-\d{2}-\d{2}|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g;
  const MONTH_FORM = /[A-Z][a-z]{2} \d{1,2}, \d{4}/;
  const visibleText = m => String(m)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  const scan = (label, markup, wantMonthForm) => {
    const text = visibleText(markup);
    const hit = text.match(BAD);
    if (hit) {
      broken.push('DATES: ' + label + ' prints ' + hit.length + ' date'
        + (hit.length === 1 ? '' : 's') + ' the family does not use — '
        + [...new Set(hit)].slice(0, 4).join(', ') + ' — each belongs in fmtDate()');
    }
    /* …and the month form has to actually be there, or a surface that simply
       stopped printing its date would sail through the scan above. */
    if (wantMonthForm && !MONTH_FORM.test(text)) {
      broken.push('DATES: ' + label + ' shows no date in the month form at all');
    }
  };

  G.data = G.Modules.emptyData();
  try { G.Modules.seeds()[0].run(); } catch (e) { record('DATES seed', e); }
  const dd = G.data || {};

  /* Link the signed-in user to a leader, or myIndivStore() answers null and
     every surface below renders its "link your account first" branch instead
     of a dated entry — passing the scan while proving nothing. */
  if (!Array.isArray(dd.leaders) || !dd.leaders.length) dd.leaders = [{ id: 'L1', name: 'Ada Kern' }];
  dd.leaders[0].userId = G.currentUserId;
  const lid = dd.leaders[0].id;

  dd.mindsetApp = dd.mindsetApp || {};
  dd.mindsetApp[lid] = Object.assign(dd.mindsetApp[lid] || {}, {
    fears: [{ text: 'That we automate the judgment out of hiring.', date: '2026-10-14T09:00:00.000Z' }],
    hopes: [{ text: 'That the review board becomes routine.', date: '2026-10-21T09:00:00.000Z' }]
  });
  dd.composure = dd.composure || {};
  dd.composure[lid] = Object.assign(dd.composure[lid] || {}, {
    slowLog: [{ text: 'Held the rollout a week to get the escalation path written down.', date: '2026-11-04T09:00:00.000Z' }]
  });

  /* 4.4 is tabbed and opens on Reflections; the Slow Thinking Log is a tab of
     its own, so without this the step renders with no log in it and the scan
     would assert nothing about the one surface it is there for. */
  G.UI.crTab = 'slowlog';

  [{ step: '3.5', label: 'step 3.5 (AI Concern Circles)' },
  { step: '4.4', label: 'step 4.4 (Slow Thinking Log)' },
  { step: '5.3', label: 'step 5.3 (the leadership dashboard)' }
  ].forEach(t => {
    let markup = '';
    try { G.go('step', t.step); markup = G.Modules.page('step')(); }
    catch (e) { record('DATES ' + t.label, e); return; }
    scan(t.label, markup, true);
  });

  /* ── The PRINT, which no page render reaches ──
     "Done means" item 2 of the directive is that a printed document reads the
     same way, and the Leadership Structure print is where the one real
     deviation lived. printPage() is the shell's and opens a window, so it is
     stood in for and the document it was handed is scanned instead. */
  /* Ported functions live on the ER namespace, not as bare globals — the module
     is an IIFE that publishes onto window.ER. Reaching for G.printOrgChart finds
     undefined and skips the whole check silently, which is how this block passed
     its own negative test the first time. */
  if (G.ER && typeof G.ER.printOrgChart === 'function') {
    const _pp = G.printPage;
    let printed = null;
    G.printPage = (title, contentFn) => {
      try { printed = (typeof contentFn === 'function') ? contentFn() : String(contentFn || ''); }
      catch (e) { printed = 'THREW: ' + ((e && e.message) || e); }
    };
    try { G.ER.printOrgChart(); } catch (e) { record('DATES printOrgChart', e); }
    finally { G.printPage = _pp; }
    if (printed == null) {
      broken.push('DATES: printOrgChart() never handed a document to printPage()');
    } else {
      /* No month-form requirement: the header stamp is today's date and the
         chart may be empty in a seeded world, so presence is not guaranteed —
         what must hold is that nothing on it is in a form the family rejects. */
      scan('the printed Leadership Structure', printed, false);
    }
  }

  /* fmtDate itself, on the input the whole rule turns on. NOTE: this assertion
     can only FAIL west of UTC. An unguarded `new Date('2026-10-14')` is UTC
     midnight, which is still the 14th anywhere east of Greenwich — so on a
     machine in, say, IST it prints correctly either way and this passes without
     proving anything. It is kept because it is the exact statement of the rule
     and it does catch the regression where the regression is visible. */
  if (typeof G.fmtDate === 'function') {
    const iso = G.fmtDate('2026-10-14');
    const ts = G.fmtDate(new Date('2026-10-14T12:00:00'));
    if (iso !== 'Oct 14, 2026') {
      broken.push('DATES: fmtDate on the stored form gave ' + JSON.stringify(iso)
        + ' — a stored YYYY-MM-DD must print as its own day, not the one before');
    }
    if (ts !== 'Oct 14, 2026') {
      broken.push('DATES: fmtDate on a timestamp gave ' + JSON.stringify(ts)
        + ' — both inputs must print the same way');
    }
  }
}

/* ── Sign-off: assignment decides who may complete a step ──────
   Ruled 9 Sep 2026. A member may complete only what is assigned to them; a
   step with nobody assigned is the administrator's. The rule is the shell's
   (stepCompleteLock / completeBlocked, js/features/assignments.js) — what has
   to be proved HERE is that this program asks it, because until that date the
   only thing consulting it was doneBtn(), which greys a button out and stops
   nothing. Every sign-off in this program goes through confirmStepDone(), so
   the guard sits there and this drives the real handler to prove it fires.

   markStepComplete() is the entry the buttons use and it carries no data gate
   of its own, so the assignment rule is the only thing that can answer — which
   is what makes the two "allowed" cases below meaningful rather than lucky.
   confirm() answers true in this realm, so a step that gets past the gate
   really does complete. */
if (VERBOSE) console.log('\nstep sign-off');
{
  const _alert = G.alert;
  let said = [];
  G.alert = m => { said.push(String(m)); };
  try {
    G.data = G.Modules.emptyData();
    G.USERS.length = 0;
    G.USERS.push({ id: 'mem1', name: 'Ravi Menon', admin: false, initials: 'RM', color: '#4866A0' });
    G.USERS.push({ id: 'mem2', name: 'Ada Kern', admin: false, initials: 'AK', color: '#2D5A8E' });
    G.USERS.push({ id: 'boss', name: 'Tamsin Doyle', admin: true, initials: 'TD', color: '#B8892A' });

    const SID = '1.2';
    const done = () => !!(G.data.completedSteps || {})[SID];
    const start = who => { G.data.completedSteps = {}; G.currentUserId = who; said = []; };
    const complete = () => { try { G.ER.markStepComplete(SID); } catch (e) { record('SIGNOFF markStepComplete', e); } };

    start('mem2');
    G.data.assigns = { [SID]: ['mem1'] };
    complete();
    if (done()) broken.push('SIGNOFF: a member completed a step assigned to somebody else');
    if (!/Ravi Menon/.test(said.join(' '))) broken.push('SIGNOFF: the refusal did not name who the step belongs to');

    start('mem1');
    G.data.assigns = { [SID]: ['mem1'] };
    complete();
    if (!done()) broken.push('SIGNOFF: the assigned member could not complete their own step');

    start('mem1');
    G.data.assigns = {};
    complete();
    if (done()) broken.push('SIGNOFF: a member completed a step nobody is assigned to (admin-only since 9 Sep 2026)');

    start('boss');
    G.data.assigns = {};
    complete();
    if (!done()) broken.push('SIGNOFF: an administrator could not complete an unassigned step');
  } finally {
    G.alert = _alert;
    G.currentUserId = null;
    G.data = G.Modules.emptyData();
  }
}

/* ── Export and import ─────────────────────────────────────────
   The export has to name the program it came from, and the import has to refuse
   a document from a different one. Before this, every export was called
   "pipeline-state-…" whichever program wrote it, and importing the Pipeline's
   into this one was accepted — the two share `completedSteps`, which was the
   only key the check looked at. */
let exported = null;
G.URL.createObjectURL = blob => { exported = blob; return 'blob:smoke'; };
try { G.exportState(); } catch (e) { record('EXPORT', e); }
if (!exported) {
  broken.push('EXPORT: produced no file');
} else {
  const text = exported.text || '';
  let doc = null;
  try { doc = JSON.parse(text); } catch (e) { }
  if (!doc) broken.push('EXPORT: the payload is not readable JSON');
  else {
    if (doc.module !== MODULE_ID) broken.push('EXPORT: stamped module="' + doc.module + '", expected "' + MODULE_ID + '"');
    if (!doc.data || !doc.data.leaders) broken.push('EXPORT: the payload carries no workspace');
  }
}

let refused = '';
G.alert = m => { refused = String(m); };
try {
  G.applyImportedState(JSON.stringify({
    app: 'nextchapter-pipeline', schema: 'pipeline-v3', module: 'pipeline',
    data: { completedSteps: { '1.1': true }, ideas: [{ name: 'From the other program' }] }
  }));
} catch (e) { record('IMPORT foreign', e); }
if (!/workspace/i.test(refused)) broken.push('IMPORT: a Pipeline export was NOT refused (said: ' + (refused || 'nothing') + ')');
if (G.data && G.data.ideas) broken.push('IMPORT: a Pipeline export replaced this program\'s workspace');
G.alert = () => { };

/* ── What the seed sends to the database ───────────────────────
   The workspace table is keyed (organization_id, module), so a save that names
   the wrong module — or names none — files a program's document under another
   program. Every request the app makes carries `module`, and this checks the
   one that matters most: the seed's force-save, which replaces the whole
   document with base_rev:null and so cannot be recovered from by a later merge.

   Server mode is decided by location.protocol, so the sandbox is flipped to
   http and handed a fetch that RECORDS instead of sending. Nothing leaves the
   process and no database is touched; what is asserted is the request the
   browser would have made. */
const sent = [];
const S = makeSandbox(true);          // served, so Store.server.enabled is true at load
S.fetch = (url, opts) => {
  let body = null;
  try { body = JSON.parse((opts && opts.body) || 'null'); } catch (e) { }
  sent.push({ url: String(url), method: (opts && opts.method) || 'GET', body: body });
  /* POST /seed answers with local_id → public_id, the way the real endpoint
     does. It has to: syncSeedToServer stamps those ids onto the roster and the
     workspace save that follows is authorized as one of those members. An empty
     map leaves the roster unlinked and the save never goes out — which looked
     exactly like the feature being broken. */
  const data = { rev: 1, orgs: [], members: 0, map: {} };
  if (/\/seed$/.test(String(url)) && body && Array.isArray(body.members)) {
    body.members.forEach(m => { data.map[m.local_id] = 'srv_' + m.local_id; });
    data.members = body.members.length;
  }
  return settled('ok', { status: 200, json: () => settled('ok', { success: true, data: data }) });
};
APP_FILES.forEach(p => {
  try { vm.runInContext(fs.readFileSync(p, 'utf8'), S, { filename: path.relative(ROOT, p).replace(/\\/g, '/') }); }
  catch (e) { broken.push('DB LOAD ' + path.basename(p) + ' → ' + ((e && e.message) || e)); }
});
try {
  const b = S.createOrg('DB Check', { name: 'Owner', username: 'owner', passcode: '1234' });
  S.currentUserId = b.userId;
  /* A save goes out only for an organization the database knows about, and only
     with an actor the API can authorize — syncSeedToServer and commitSeed both
     bail out otherwise, which is right (a file:// or unlinked org saves
     locally and says nothing). Stamping the two server ids here is the state a
     real sign-up leaves behind once /organizations has answered. */
  const orgs = S.Store.getOrgs();
  orgs.forEach(o => { if (o.id === S.currentOrgId) o.serverId = S.currentOrgId; });
  S.Store.setOrgs(orgs);
  S.USERS.forEach(u => { if (u.id === S.currentUserId) u.serverId = 'usr_dbcheck'; });

  S.data = S.Modules.emptyData();
  sent.length = 0;                    // ignore whatever booting sent; watch the seed only
  S.runSeed('sample');
} catch (e) { record('DB seed', e); }

const saves = sent.filter(r => /\/workspace$/.test(r.url) && r.method === 'POST');
if (!saves.length) {
  broken.push('DB: seeding sent no workspace save');
} else {
  saves.forEach(s => {
    if (!s.body) { broken.push('DB: a workspace save carried no body'); return; }
    if (s.body.module !== MODULE_ID) {
      broken.push('DB: a workspace save named module="' + s.body.module + '", expected "' + MODULE_ID + '"');
    }
    if (s.body.base_rev !== null) broken.push('DB: the seed save was not a force-save (base_rev=' + s.body.base_rev + ')');
    if (!s.body.doc || !s.body.doc.leaders) broken.push('DB: the saved document is not this program\'s');
  });
}

/* ── Phase 5's heading opens the Leadership Dashboard, as in the build ──
   The reference never shows a phase-5 landing; the shell's sidebar used to
   open one (no video, no dashboard) until module.js answered phaseHeadTarget. */
(function () {
  try {
    G.data = G.Modules.emptyData();
    G.go('pipeline'); G.UI.navOpenSet = {};
    G.goPhase(5);
    if (G.currentPage !== 'phase5') broken.push('PHASE5: the sidebar\'s phase-5 heading went to "' + G.currentPage + '", the build opens the Leadership Dashboard');
    if (G.activeNavPhaseId() !== 5) broken.push('PHASE5: on the Leadership Dashboard the sidebar highlights phase ' + G.activeNavPhaseId() + ', not 5');
    G.UI.navOpenSet = {}; G.goPhase(2);
    if (G.currentPage !== 'phase' || String(G.currentStep) !== '2') broken.push('PHASE5: the phase-2 heading no longer opens its landing');
    G.go('phase', '5');
    const html = G.Modules.page('phase')();
    if (html.indexOf('exec-phase5.mp4') < 0) broken.push('PHASE5: a phase-5 address does not show the Leadership Dashboard and its video');
  } catch (e) { broken.push('PHASE5 → ' + ((e && e.message) || e)); }
})();

/* ── Report ───────────────────────────────────────────────────── */
console.log('\n──────────────────────────────────────────');
console.log('Executive Readiness page smoke');
const PER_PASS = 1 + 4 + 1 + STEPS.length + OUTCOMES.length;
console.log('  pages rendered  :', pagesRendered, '(of ' + (3 * PER_PASS) + ' — ' + PER_PASS + ' pages, empty / populated / seeded)');
console.log('  handlers pulled :', handlersRun);
if (other.size) {
  const total = [...other.values()].reduce((a, b) => a + b, 0);
  console.log('  handler noise   :', total, 'in', other.size, 'kinds (not port failures' + (VERBOSE ? '' : '; -v to list') + ')');
  if (VERBOSE) [...other.entries()].sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log('      ' + String(n).padStart(5) + '  ' + m));
}
if (broken.length) {
  console.log('  BROKEN          :', broken.length);
  console.log('──────────────────────────────────────────');
  broken.slice(0, 60).forEach(b => console.log('  ✗ ' + b));
  if (broken.length > 60) console.log('  … and ' + (broken.length - 60) + ' more');
  process.exit(1);
}
console.log('  ✓ every page renders and every handler resolves');
console.log('──────────────────────────────────────────');
