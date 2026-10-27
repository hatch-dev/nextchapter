#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   ai-governance-smoke.js — render every Responsible AI Governance
   page and pull every trigger on it
   ─────────────────────────────────────────────────────────────
   The program's pages are generated (tools/port-ai-governance.js
   lifts them out of the reference build), and a generated port fails
   in two specific ways that reading the diff will not show you:

     1. A page renders down to the line that reads a name nobody
        brought across, and dies there. Nothing says so until someone
        opens that one screen — and there are fifty-one of them.
     2. A page renders perfectly and a button does nothing, because
        its handler lives inside an onclick STRING and the name in
        that string was never repointed at RG.

   So this walks every address inside the program — the Framework
   overview, five phase landings, seventeen step bodies, eighteen
   output reports, the Governance Dashboard, the Insights shelf, the
   five portfolios, the Responsible AI spine, the governance review
   and the management hub — and then EVALUATES every inline handler in
   the markup each one produced. A handler is code the browser will
   run later; the only way to know it resolves is to run it.

   Four times over: against an empty workspace (every null guard, the
   state a new organization is actually in), a hand-built one, the
   PLACEHOLDER-ERA document that is already in the database for every
   account that clicked this program while it was still catalogued and
   unbuilt, and the program's own sample data.

   ── And then the thing this port was asked for ────────────────
   MODULE ISOLATION. This program must keep to its own data and touch
   no other program's, so the last three blocks check exactly that,
   and they check it against the wire and the neighbouring module
   rather than against intent:

     the seed     builds THIS program's document — systems, risks,
                  regimes — and none of the Pipeline's
     the export   names the program it came out of
     the import   refuses a document from a different one
     the save     a second sandbox is loaded in served mode with a
                  fetch that RECORDS instead of sending, so every
                  request the browser would have made can be read:
                  module=ai-governance on every one of them
     the neighbour a THIRD sandbox boots the Pipeline over the same
                  localStorage the Governance run just wrote, and its
                  document has to come back untouched

   Nothing leaves the process and no database is touched.

   Failures are narrowed to the port's own failure modes — a name that
   resolves to nothing. A handler that throws for a reason of its own
   (a confirm() declined, an element the stub DOM does not have) is
   not this script's business and is counted separately.

   Usage:  node tools/ai-governance-smoke.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;
const MODULE_ID = 'ai-governance';

/* ── The page list ─────────────────────────────────────────────
   Every address inside the program. Written out rather than derived from PH so
   that a phase quietly losing a step shows up here as an untested id rather
   than as a shorter run nobody notices. */
const STEPS = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4', '2.5',
  '3.1', '3.2', '3.3', '4.1', '4.2', '4.3', '4.4', '5.2', '5.3', '5.4'];
const OUTCOMES = ['out-assessprofile', 'out-riskreg', 'out-sysinv', 'out-reglandscape',
  'out-ethicsdoc', 'out-raci2', 'out-govsystems', 'out-compliance',
  'out-assessedreg', 'out-riskclass', 'out-testing',
  'out-exitplans', 'out-govfw', 'out-updatedreg'];
/* The program's own page ids — the six the shell has never heard of. Each is
   reached through go() like any other, and each is registered by module.js. */
const PORTFOLIOS = ['identify', 'assess', 'manage', 'emergency', 'archived'];

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

function moduleEntry(id) {
  return (CATALOGUE.roles || []).reduce((found, role) =>
    found || (role.modules || []).filter(m => m.id === id)[0], null);
}
function filesFor(id) {
  const entry = moduleEntry(id);
  if (!entry) { console.error('no such module in the catalogue:', id); process.exit(1); }
  const mods = (entry.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
  const files = APP_FILES.slice();
  const at = files.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  files.splice(at >= 0 ? at + 1 : 0, 0, ...mods);
  return files;
}
const FILES = filesFor(MODULE_ID);

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
/* One store, shared between sandboxes when asked for. That sharing is not a
   convenience — it is what makes the neighbour check mean anything: two
   programs in one browser DO share localStorage, and the question is whether
   they keep to their own keys inside it. */
function storage(backing) {
  const m = backing || new Map();
  return {
    _map: m,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); }, clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null,
    get length() { return m.size; }
  };
}
/* Every fetch is a network failure unless a block replaces it — there is no
   PHP behind this — settled inline so the app's fallback runs in the same tick
   as the call. */
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
/* ── Which ids the document HAS ────────────────────────────────
   A stub that answers every getElementById with an element is permissive in a
   way that is usually harmless and here is fatal. This program counts its
   repeatable rows by probing for them:

       function harvestPartners(){ var i=0;
         while(document.getElementById('pt_'+i+'_name')){ …; i++ } … }

   In a browser that stops at the first id the page does not have. Against a
   stub that always answers it never stops, and since the loop pushes a row
   each time, the process runs out of memory before anything is reported —
   which reads as the port hanging rather than as the stub being wrong.

   So the stub models the real thing: it answers for the ids shell.html
   declares, plus the ids in the markup currently on screen, and returns null
   for everything else. That is also the state the app is genuinely in when
   beforeNavigate harvests — the OLD page's fields are still in the document
   and the new page's are not yet — so the harvest is tested against the
   document it actually runs against. */
const SHELL_IDS = new Set((html.match(/\bid="([^"]+)"/g) || []).map(t => t.slice(4, -1)));

function makeSandbox(served, id, store) {
  id = id || MODULE_ID;
  const byId = Object.create(null);
  let live = new Set(SHELL_IDS);
  const documentStub = {
    /** Replace "what is on screen" with the ids in this markup. */
    _setPage(markup) {
      live = new Set(SHELL_IDS);
      (String(markup).match(/\bid="([^"]+)"/g) || []).forEach(t => live.add(t.slice(4, -1)));
    },
    getElementById(i) {
      if (!live.has(i)) return null;
      if (!byId[i]) { byId[i] = el(); byId[i].id = i; }
      return byId[i];
    },
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
    localStorage: storage(store), sessionStorage: storage(),
    document: documentStub,
    location: served
      ? {
        href: 'http://localhost/apps/?module=' + id, protocol: 'http:', host: 'localhost',
        hostname: 'localhost', port: '', pathname: '/apps/', search: '?module=' + id,
        hash: '', origin: 'http://localhost', assign() { }, replace() { }, reload() { }
      }
      : {
        href: 'file:///index.html?module=' + id, protocol: 'file:', host: '', hostname: '',
        port: '', pathname: '/index.html', search: '?module=' + id, hash: '', origin: 'null',
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
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    getSelection: () => ({ toString: () => '', removeAllRanges() { }, addRange() { } })
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  return sandbox;
}

const SHARED_STORE = new Map();
const sandbox = makeSandbox(false, MODULE_ID, SHARED_STORE);

/* ── Results ───────────────────────────────────────────────────
   Two buckets, and the split is the whole point. A name that resolves to
   nothing is this port's bug. Anything else a handler does — declining a
   confirm, reaching for an element the stub has not got — is not. */
const broken = [];        // ReferenceError / not-a-function: the port is wrong
const other = new Map();  // everything else, counted and shown under -v
let handlersRun = 0, pagesRendered = 0;

const PORT_FAILURE = /is not defined|is not a function|Cannot read propert(y|ies) of undefined/;
function record(where, e) {
  const msg = (e && e.message) || String(e);
  if (PORT_FAILURE.test(msg)) broken.push(where + ' → ' + msg);
  else other.set(msg, (other.get(msg) || 0) + 1);
}

function load(target, files) {
  (files || FILES).forEach(p => {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), target, { filename: rel }); }
    catch (e) { broken.push('LOAD ' + rel + ' → ' + ((e && e.message) || e)); }
  });
}

/* ── Handlers ──────────────────────────────────────────────────
   Every on*="…" in the page, evaluated with the `this` and `event` an inline
   attribute would have had. `data` is snapshotted and restored around each
   one: these are real handlers, they really do delete risks and mark steps
   complete, and one of them running first would change what the next one is
   testing. */
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

function pageList(G) {
  return [{ page: 'pipeline' }]
    .concat([1, 2, 3, 4, 5].map(n => ({ page: 'phase', step: String(n) })))
    .concat([{ page: 'phase5' }, { page: 'insights' }, { page: 'mgmt-hub' },
    { page: 'ethicsov' }, { page: 'govreview' }, { page: 'reports' }])
    .concat(PORTFOLIOS.map(p => ({ page: 'portfolio', step: p })))
    .concat(STEPS.map(s => ({ page: 'step', step: s })))
    .concat(OUTCOMES.map(o => ({ page: 'outcome', step: o })))
    /* One system view, over whichever system the workspace has. An empty
       workspace has none, and the page has to survive that too — it is the
       state a reader reaches by pasting a link to a system that was deleted. */
    .concat([{ page: 'system', step: ((G.data && G.data.systems || [])[0] || {}).id || 'no-such-system' }]);
}

function renderEvery(G, label) {
  pageList(G).forEach(target => {
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
    } catch (e) { if (process.env.SMOKE_STACK) console.log(e.stack); record(where + ' render', e); return; }

    pagesRendered++;
    /* A page is expected to be a page. The one deliberate exception is the
       system view asked for a system that is not there — a link to a deleted
       record, or the empty workspace this suite opens with — where the
       reference's answer is one line saying so, and one line is the right
       answer. Recognised rather than exempted by page id, so a system view
       that collapses to nothing for any OTHER reason still fails. */
    const emptyOk = /System not found\./.test(markup);
    if (typeof markup !== 'string' || (markup.length < 200 && !emptyOk)) {
      broken.push(where + ' → rendered ' + (typeof markup === 'string' ? markup.length + ' chars' : typeof markup));
      return;
    }
    /* The page is now on screen as far as the stub document is concerned, so
       its own ids resolve and every other one does not — which is what the
       handlers below, and the next page's harvest, are entitled to assume. */
    G.document._setPage(markup);
    const n = pullEveryTrigger(G, markup, where);
    if (VERBOSE) console.log('  ' + where.padEnd(30) + String(markup.length).padStart(7) + ' chars  ' + String(n).padStart(4) + ' handlers');
  });
}

/* ── Run ───────────────────────────────────────────────────────── */
load(sandbox);
const G = sandbox;

if (!G.Modules || G.Modules.activeId() !== MODULE_ID) {
  console.error('the active module is', G.Modules && G.Modules.activeId(), '— expected', MODULE_ID);
  process.exit(1);
}
if (!G.RG) { console.error('window.RG was never created — program.js did not load'); process.exit(1); }

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
   there are systems on the register, risks with scores, and a regime to
   comply with. Field names are the ones the program's own writers use;
   getting one wrong fails inside a renderer and reads exactly like a broken
   port, so they are taken from the reference's save paths. */
if (VERBOSE) console.log('\npopulated workspace');
G.data = G.Modules.emptyData();
G.data.systems = [
  { id: 'sys1', name: 'Claims triage model', owner: 'Ada Kern', purpose: 'Rank inbound claims', stage: 'live', description: 'Ranks claims for adjuster review.', testEvidence: [] },
  { id: 'sys2', name: 'Résumé screener', owner: 'Ravi Menon', purpose: 'Shortlist applicants', stage: 'pilot', description: 'Shortlists applicants for interview.', testEvidence: [] }
];
G.data.risks = [
  {
    id: 'r1', name: 'Biased shortlisting', description: 'The screener down-ranks candidates by proxy.',
    category: 'P', source: 'internal', litL: 4, litI: 5, litT: 4, systemId: 'sys2',
    ethStatus: 'confirmed', classification: 'manage', loggedBy: 'Harriet Rivers',
    selection: { decision: 'advance', owner: 'Ada Kern' }, assess: {}, history: []
  },
  {
    id: 'r2', name: 'Claims drift', description: 'Accuracy falls on specialty lines.',
    category: 'T', source: 'internal', litL: 3, litI: 4, litT: 2, systemId: 'sys1',
    classification: 'monitor', assess: {}, history: []
  },
  {
    id: 'r3', name: 'Vendor lock-in', description: 'One provider behind three systems.',
    category: 'S', source: 'external', assess: {}, history: []
  }
];
G.data.regimes = [{ id: 'reg1', name: 'EU AI Act', type: 'regulation', scoping: 'applies', obligations: [{ id: 'o1', text: 'Register high-risk systems.' }] }];
G.data.assessmentBattery = { exposure: { a: 4, b: 3 }, tolerance: { a: 2 }, controls: { a: 3 }, rights: { a: 4 }, oversight: { a: 2 } };
G.data.ethicalFramework = { principles: [{ id: 'p1', name: 'Contestability', commitment: 'Every automated decision can be appealed.', breach: 'An appeal route that does not reach a person.' }], board: [{ id: 'b1', name: 'Ada Kern', role: 'Chair' }] };
G.data.raciMatrix = [{ id: 'a1', act: 'New Risk Review', A: 'Ada Kern', R: ['Ravi Menon'], C: [], I: [] }];
G.data.reviewCadence = { frequency: 'monthly', owner: 'Ravi Menon', triggers: [{ id: 't1', text: 'A new model goes live' }] };
G.data.completedSteps = { '1.1': true, '1.2': true, '1.3': true, '2.1': true };
G.data.completed = { '1.1': true };
try { G.applyTeamRoster(); } catch (e) { }
renderEvery(G, 'populated');

/* Pass 3 — the PLACEHOLDER's document. Not a hypothetical: rows filed under
   module='ai-governance' already exist, written by js/modules/_placeholder
   while this program was catalogued but not built, and every account that ever
   clicked the program in the switcher has one. They carry the roster, the
   organization profile and the placeholder's own keys — and not one of this
   program's containers. This is the workspace the first real reader opens, so
   it is the one that has to render, and it is what module.js's normalize()
   exists for. Taken from a live row rather than invented. */
if (VERBOSE) console.log('\nplaceholder-era workspace');
G.data = {
  startDate: '2026-08-18',
  roster: [
    { id: 'usr_a', serverId: 'usr_a', name: 'Hatch', username: 'hatch', role: 'Administrator', scope: 'All', email: 'hatch@example.com', dept: '', admin: true, modules: ['ai-governance', 'pipeline'], initials: 'H', color: '#B8892A' },
    { id: 'usr_b', serverId: 'usr_b', name: 'Yogesh Verma', username: 'yogeshverma', role: 'Owner', scope: 'Operations', email: 'yv@example.com', dept: 'Strategy', admin: false, modules: ['pipeline'], initials: 'YV', color: '#4866A0' }
  ],
  answers: {}, bf12: true, bf11: true,
  enterprise: { name: 'Hatch Organization', industry: '', size: '', region: '', website: '', maturity: '', sponsor: '', objective: '' },
  remind7: {}, assigns: {}, schemaVersion: 1, rev: 1
};
try { G.applyTeamRoster(); } catch (e) { }
renderEvery(G, 'placeholder');
/* And the repair has to have HAPPENED, not merely been survived: a page that
   renders because every read happens to be guarded leaves the next writer
   assigning into a container that is not there. */
['systems', 'risks', 'regimes', 'raciMatrix'].forEach(k => {
  if (!Array.isArray(G.data[k])) broken.push('PLACEHOLDER: normalize() left data.' + k + ' as ' + typeof G.data[k]);
});
['assessmentBattery', 'completedSteps', 'completed', 'stepDue'].forEach(k => {
  if (!G.data[k] || typeof G.data[k] !== 'object') broken.push('PLACEHOLDER: normalize() left data.' + k + ' as ' + typeof G.data[k]);
});
if (!G.data.roster || G.data.roster.length !== 2) broken.push('PLACEHOLDER: normalize() lost the roster');
if (!G.data.enterprise || G.data.enterprise.name !== 'Hatch Organization') broken.push('PLACEHOLDER: normalize() lost the organization profile');

/* ── The sample workspace ──────────────────────────────────────
   Seeding is the program's, not the shell's: the More menu offers whatever
   Modules.seeds() lists, and each seed builds its own program's document. What
   is checked here is that this program's seed produces THIS program's
   document — the failure it replaces is the shell's Pipeline seed filling a
   Governance workspace with ideas and projects, wiping it in the process.

   Then every page is rendered against it, because the seeded workspace is what
   a demo actually puts on screen and it exercises branches neither the empty
   nor the hand-built pass reaches. */
if (VERBOSE) console.log('\nseeded workspace');
const seeds = G.Modules.seeds();
if (seeds.length !== 1 || seeds[0].id !== 'sample') {
  broken.push('SEEDS: expected one seed named "sample", got ' + JSON.stringify(seeds.map(s => s.id)));
} else {
  G.data = G.Modules.emptyData();
  try { seeds[0].run(); } catch (e) { record('SEEDS run', e); }

  const d = G.data || {};
  ['systems', 'risks', 'roster'].forEach(k => {
    const v = d[k];
    const filled = Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0);
    if (!filled) broken.push('SEEDS: the sample workspace has no ' + k);
  });
  /* The Pipeline's keys must be absent. Their presence would mean the shell's
     seed ran instead of this program's — which is the whole bug. */
  ['ideas', 'projects', 'portfolio', 'capital'].forEach(k => {
    if (d[k] !== undefined) broken.push('SEEDS: the sample workspace carries the Pipeline\'s "' + k + '"');
  });
  /* …and so must Executive Readiness's, which the Pipeline check would miss:
     the two Enterprise programs that already exist are the two a document
     could plausibly be confused with. */
  ['leaders', 'orgChart', 'assessments', 'competencyFramework'].forEach(k => {
    if (d[k] !== undefined) broken.push('SEEDS: the sample workspace carries Executive Readiness\'s "' + k + '"');
  });
  renderEvery(G, 'seeded');
}

/* ── Written dates read "Oct 14, 2026", never "2026-10-14" ─────
   Governance directive of 5 Sep 2026 (Family Standard Spec §17A, Cross-Module
   Rollout item 76): every date the program shows a reader as TEXT goes through
   fmtDate(), which prints the month form. The stored form stays ISO and the
   date pickers stay the browser's — only what is read on the page changes.

   The bug this replaces was not a crash: some surfaces formatted and some
   printed the stored string, so one card read "Oct 14, 2026" and the next read
   "2026-10-14" — a form that means 14 October to one reader and nothing at all
   to another. Nothing in the passes above can see it, because a raw date
   renders and its handlers resolve exactly like a formatted one.

   Checked on the two surfaces the directive names — the Dashboard's three
   meeting cards and the review log — plus the governance framework document,
   which is the printed copy of the same rhythm. The seeded world is the one
   used, with the three dates FILLED first: the sample carries a review cadence
   and a board review but no standing-meeting date, and a card reading "Date
   not set" would let this pass without formatting anything.

   Visible text means text nodes: every tag, and therefore every attribute, is
   stripped before the scan, so a date input's value="2026-10-14" — which must
   stay ISO, since the browser renders that control in the reader's own format
   — is out of scope, as is any ISO string sitting in an onclick argument. */
if (VERBOSE) console.log('\nwritten dates');
{
  const ISO = /\d{4}-\d{2}-\d{2}/g;
  const MONTH_FORM = /[A-Z][a-z]{2} \d{1,2}, \d{4}/;
  const visibleText = m => String(m)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

  G.data = G.Modules.emptyData();
  try { G.Modules.seeds()[0].run(); } catch (e) { record('DATES seed', e); }
  const dd = G.data || {};
  dd.reviewCadence = dd.reviewCadence || {};
  dd.reviewCadence.firstReviewDate = '2026-10-14';
  dd.govRhythm = dd.govRhythm || {};
  dd.govRhythm.firstMeeting = '2026-10-21';
  dd.ethicalFramework = dd.ethicalFramework || {};
  dd.ethicalFramework.board = dd.ethicalFramework.board || {};
  dd.ethicalFramework.board.nextReview = '2026-11-04';

  /* The Review Log is a FOLD and it is shut by default: closed, its card is
     one header line and no entry, so a scan of the closed page would assert
     nothing about entry dates. It is opened for both draws (UI.expanded.rvLog),
     and the per-entry bodies — rvl_<i> — are the thing toggled between them. */
  [{ page: 'phase5', label: 'the Governance Dashboard' },
  { page: 'govreview', label: 'the governance review' },
  { page: 'step', step: '4.4', label: 'step 4.4 (the review log)' },
  { page: 'outcome', step: 'out-govfw', label: 'the governance framework document' }
  ].forEach(t => {
    [false, true].forEach(open => {
      G.UI.expanded = { rvLog: true, tcLog: true };
      if (open) (dd.reviewLog || []).forEach((e, i) => { G.UI.expanded['rvl_' + i] = true; });
      let markup = '';
      try {
        G.go(t.page, t.step);
        markup = G.Modules.page(t.page)();
      } catch (e) { record('DATES ' + t.label, e); return; }
      const text = visibleText(markup);
      const hit = text.match(ISO);
      if (hit) {
        broken.push('DATES: ' + t.label + (open ? ' (entries expanded)' : '')
          + ' prints ' + hit.length + ' raw date' + (hit.length === 1 ? '' : 's')
          + ' as visible text — ' + [...new Set(hit)].slice(0, 4).join(', ')
          + ' — each of those belongs in fmtDate()');
      }
      /* …and the month form has to actually be there, or a surface that simply
         stopped printing its date would sail through the scan above. */
      if (!MONTH_FORM.test(text)) {
        broken.push('DATES: ' + t.label + (open ? ' (entries expanded)' : '') + ' shows no date in the month form at all');
      }
    });
  });
  G.UI.expanded = {};
}

/* ── Sign-off: assignment decides who may complete a step ──────
   Ruled 9 Sep 2026. A member may complete only what is assigned to them; a
   step with nobody assigned is the administrator's. The rule itself is the
   shell's (stepCompleteLock / completeBlocked, js/features/assignments.js) —
   what has to be proved HERE is that this program asks it, because until that
   date the only thing consulting it was doneBtn(), which greys a button out
   and stops nothing. Every sign-off in this program funnels through
   confirmStepDone(), so the guard sits there and this drives the real handler
   to prove it fires.

   confirm() answers true in this realm, so a step that gets past the gate
   really does complete — which is what makes "refused" and "allowed"
   distinguishable below. */
if (VERBOSE) console.log('\nstep sign-off');
{
  const _alert = G.alert;
  let said = [];
  G.alert = m => { said.push(String(m)); };
  try {
    G.data = G.Modules.emptyData();
    /* completeStepGated() asks dataGateOK() BEFORE the assignment rule, and 1.2's
       is "at least one system on the register". Without this the refusals below
       would pass for the wrong reason — refused by the data gate, with the
       assignment rule never consulted at all. */
    G.data.systems = [{ id: 'sys1', name: 'Claims triage model', owner: 'Ada Kern', purpose: 'Rank claims', stage: 'live' }];
    G.USERS.length = 0;
    G.USERS.push({ id: 'mem1', name: 'Ravi Menon', admin: false, initials: 'RM', color: '#4866A0' });
    G.USERS.push({ id: 'mem2', name: 'Ada Kern', admin: false, initials: 'AK', color: '#2D5A8E' });
    G.USERS.push({ id: 'boss', name: 'Tamsin Doyle', admin: true, initials: 'TD', color: '#B8892A' });

    const done = () => !!(G.data.completedSteps || {})['1.2'];
    const start = who => { G.data.completedSteps = {}; G.currentUserId = who; said = []; };

    start('mem2');
    G.data.assigns = { '1.2': ['mem1'] };
    try { G.RG.completeStepGated('1.2'); } catch (e) { record('SIGNOFF completeStepGated', e); }
    if (done()) broken.push('SIGNOFF: a member completed a step assigned to somebody else');
    if (!said.join(' ').match(/Ravi Menon/)) broken.push('SIGNOFF: the refusal did not name who the step belongs to');

    start('mem1');
    G.data.assigns = { '1.2': ['mem1'] };
    try { G.RG.completeStepGated('1.2'); } catch (e) { record('SIGNOFF completeStep', e); }
    if (!done()) broken.push('SIGNOFF: the assigned member could not complete their own step');

    start('mem1');
    G.data.assigns = {};
    try { G.RG.completeStepGated('1.2'); } catch (e) { record('SIGNOFF completeStep', e); }
    if (done()) broken.push('SIGNOFF: a member completed a step nobody is assigned to (admin-only since 9 Sep 2026)');

    start('boss');
    G.data.assigns = {};
    try { G.RG.completeStepGated('1.2'); } catch (e) { record('SIGNOFF completeStep', e); }
    if (!done()) broken.push('SIGNOFF: an administrator could not complete an unassigned step');
  } finally {
    G.alert = _alert;
    G.currentUserId = null;
    G.data = G.Modules.emptyData();
  }
}

/* ── The Report Manager compiles what it was given ─────────────
   The page above renders empty, which proves nothing about the compiler: with
   no report defined, renderReports() draws one sentence and a button, and the
   editor, the catalogue and every section builder stay unreached.

   So the report is BUILT here — one unit of each kind the catalogue offers,
   which is the thing that varies (an output, a Phase 5 page, a Compliance
   Dashboard tab, a review, a portfolio, a single record of each of the three
   types, and a text page) — and the compiled document is read back. Each kind
   reaches rcSection() through a different builder, and a kind whose builder
   throws or returns nothing is the failure this catches: the report would
   print with a numbered heading over a blank page, and the contents page would
   still list it, so nothing else here would notice.

   The seeded world is used, because half the catalogue is the records in it. */
if (VERBOSE) console.log('\nreport manager');
{
  G.data = G.Modules.emptyData();
  try { G.Modules.seeds()[0].run(); } catch (e) { record('REPORTS seed', e); }
  G.UI.rcEdit = null;
  try {
    G.RG.rcNew();
    const defs = G.RG.rcDefs();
    const d = defs[defs.length - 1];
    if (!d) throw new Error('rcNew() created no report');

    /* One unit per kind, taken from the catalogue rather than written down, so
       a kind added later is covered without editing this list. */
    const cat = G.RG.rcCatalogue();
    const byKind = {};
    cat.forEach(u => {
      const k = u.kind + (u.type ? ':' + u.type : '');
      if (!byKind[k]) byKind[k] = u;
    });
    const kinds = Object.keys(byKind);
    kinds.forEach(k => {
      const u = byKind[k];
      try { G.RG.rcToggle(d.id, G.RG.rcKey(u), u.depths ? 'full' : ''); }
      catch (e) { record('REPORTS add ' + k, e); }
    });
    /* A text page is the one section the USER writes. It is added and named
       here, but NOT asserted on its body below: rcSanitize() reads authored
       markup by assigning innerHTML and walking childNodes, and this realm's
       document is a stub that stores innerHTML without parsing it — so the
       sanitiser returns '' here for any input and would prove nothing either
       way. What is checked is that the page is created, carries the name it
       was given, and reaches rcSection() without throwing. */
    try {
      G.RG.rcAddText(d.id);
      G.RG.rcSetUnit(d.id, d.units.length - 1, 'name', 'Why this report exists');
      G.RG.rcSetTextHtml(d.id, d.units.length - 1, '<p><b>The board asked for one document.</b></p>');
      const t = d.units[d.units.length - 1];
      if (!t || t.kind !== 'text') broken.push('REPORTS: rcAddText() did not add a text page');
      else if (t.name !== 'Why this report exists') broken.push('REPORTS: a text page did not keep its heading');
    } catch (e) { record('REPORTS add text', e); }

    if (d.units.length !== kinds.length + 1) {
      broken.push('REPORTS: asked for ' + (kinds.length + 1) + ' sections, the report holds ' + d.units.length);
    }

    /* The editor itself — the catalogue list, the per-section controls and the
       Individual Risks filters are all drawn from here and nowhere else. */
    G.UI.rcEdit = d.id;
    let page = '';
    try { page = G.Modules.page('reports')(); } catch (e) { record('REPORTS editor', e); }
    if (page && page.indexOf('Report Content Options') < 0 && page.indexOf('Sections') < 0) {
      broken.push('REPORTS: the editor drew neither the sections list nor the options list');
    }

    /* And the document. Every section is asserted to carry its number and its
       heading AND to put something under it: a kind whose builder returns ''
       is exactly the silent failure described above. */
    let doc = '';
    try { doc = G.RG.rcCompile(d.id); } catch (e) { record('REPORTS rcCompile', e); }
    if (!doc) broken.push('REPORTS: rcCompile() returned nothing');
    else {
      if (doc.indexOf('Contents') < 0) broken.push('REPORTS: the compiled report has no contents page');
      d.units.forEach((u, i) => {
        let sec = '';
        try { sec = G.RG.rcSection(u, i); } catch (e) { record('REPORTS rcSection ' + u.kind, e); return; }
        const text = String(sec).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').trim();
        if (!sec) broken.push('REPORTS: section ' + (i + 1) + ' (' + u.kind + (u.type ? ' ' + u.type : '') + ') built nothing');
        else if (u.kind === 'text') { /* body unprovable in a stub DOM — see above */ }
        else if (text.replace(/\s+/g, ' ').length < 40) {
          broken.push('REPORTS: section ' + (i + 1) + ' (' + u.kind + (u.type ? ' ' + u.type : '')
            + ') printed a heading and no content');
        }
      });
    }
  } catch (e) { record('REPORTS', e); }
  G.UI.rcEdit = null;
  G.data = G.Modules.emptyData();
}

/* ── A handler that resolves is not a handler that WORKS ───────
   Everything above proves each inline handler resolves to a function and runs
   without throwing. That is the failure this port's tooling was built for, and
   it is not the only one there is.

   The Likert scales shipped broken past all of it. The reference declares
   `function likSet(path,n)` handling one- and two-segment paths, then two
   thousand lines later assigns `likSet=function(path,n)` handling THREE — and
   seventeen of this program's twenty-five scales use a three-segment path. The
   port lifted the declaration, so those seventeen ran, missed both branches,
   called saveData() and render() and wrote nothing. Resolved, executed, no
   error, no console line: a row of 1–5 buttons that simply did not respond.

   So the scales are checked on their EFFECT. One of each arity, because the
   arity is exactly what broke, and the three-segment case asserted against the
   real path off the Assessment Battery rather than a made-up one. */
if (VERBOSE) console.log('\nlikert scales write through');
G.data = G.Modules.emptyData();
[
  { path: 'assessmentBattery.aiExposure.directCriticality', n: 4, read: d => ((d.assessmentBattery || {}).aiExposure || {}).directCriticality },
  { path: 'incentivesSkills.legalSkill', n: 3, read: d => (d.incentivesSkills || {}).legalSkill },
  { path: 'triage.culture.transparency', n: 5, read: d => ((d.triage || {}).culture || {}).transparency }
].forEach(c => {
  try { RGlikSet(c.path, c.n); } catch (e) { record('LIKERT ' + c.path, e); }
  const got = c.read(G.data || {});
  if (got !== c.n) {
    broken.push('LIKERT: ' + c.path + ' (' + c.path.split('.').length + ' segments) set ' + c.n
      + ' but the document holds ' + JSON.stringify(got)
      + ' — the scale renders and does nothing');
  }
});
function RGlikSet(p, n) { return G.RG.likSet(p, n); }

/* ── The seams the SHELL reads, not the module ─────────────────
   Every check above exercises code the module calls. `idToRecordKey` is the
   other direction: the shell's lock layer calls it for every input on the
   page, so nothing in program.js references it, the closure never pulled it,
   and no SHADOWED line ever mentioned it. It was wrong for a fortnight's worth
   of clicks and the only visible trace was rows in `workspace_locks` named
   after the Pipeline's data model.

   Asserted through the SHELL's function, not the module's, because the whole
   question is which of the two answers. */
[
  ['exp_departments', 'assessmentBattery'],   // the Pipeline reads exp_ as an experiment
  ['ctrl_aiPolicy', 'assessmentBattery'],
  ['dr_approveDeployment', 'decisionRights'],
  ['os_governanceOwner', 'ownership'],
  ['sk_affected', 'stakeholder']
].forEach(([fieldId, want]) => {
  let got;
  try { got = G.idToRecordKey(fieldId); } catch (e) { record('LOCKKEY ' + fieldId, e); }
  if (got !== want) {
    broken.push('LOCKKEY: the shell maps "' + fieldId + '" to ' + JSON.stringify(got)
      + ', this program\'s record is "' + want + '" — locks would be filed where nothing looks for them');
  }
});

/* ── A re-render must not throw away what is typed beside it ───
   This program saves nothing per keystroke: a value sits in the DOM and
   nowhere else until something harvests it. So any handler that calls
   render() has to bank the card first, and every add/remove handler on a card
   does — except addGrAgendaItem, which sat on step 4.2's Standing Governance
   Meeting card beside "First meeting date" and wiped it. The step then refused
   to complete, naming that same date as the thing still needed.

   Checked on EFFECT and through the real handler, because the page renders
   perfectly either way and the whole failure is a value that quietly is not
   there afterwards. Both routes out of the field are covered: the handler that
   re-renders, and the navigation harvest the beforeNavigate seam calls. */
if (VERBOSE) console.log('\na re-render banks the open card');
{
  G.data = G.Modules.emptyData();
  G.data.govRhythm = { attendeesList: [{ name: 'Ada Kern', responsibility: 'Chair' }] };
  G.data.embedOps = { deploymentGate: 'x', lightGate: 'x', projectMgmt: 'x', hr: 'x', procurement: 'x' };
  try {
    G.go('step', '4.2');
    const markup = G.Modules.page('step')();
    G.document._setPage(markup);

    const date = G.document.getElementById('gr_firstMeeting');
    const box = G.document.getElementById('grl_additionalAgenda_new');
    if (!date || !box) {
      broken.push('4.2: expected gr_firstMeeting and grl_additionalAgenda_new on the page');
    } else {
      /* The stub hands back a blank element for any id the page declares — it
         does not hydrate `value` out of the markup the way a browser does. The
         attendee row IS on screen and in a browser carries value="Ada Kern",
         so harvestGrLists reads it back and keeps it; here the test has to say
         so, or the harvest reads an empty box and clears the attendee the
         setup just put in `data`. Nothing about the program depends on this —
         it is the stub being a stub. */
      var an = G.document.getElementById('grl_attendees_0_name');
      var ar = G.document.getElementById('grl_attendees_0_resp');
      if (an) an.value = 'Ada Kern';
      if (ar) ar.value = 'Chair';

      date.value = '2026-09-02';
      box.value = 'Policy updates';
      G.RG.addGrAgendaItem('additionalAgenda');

      const kept = ((G.data || {}).govRhythm || {}).firstMeeting;
      if (kept !== '2026-09-02') {
        broken.push('4.2: adding an agenda item threw the first meeting date away (data holds '
          + JSON.stringify(kept) + ') — the step can then never complete');
      }
      const agenda = (((G.data || {}).govRhythm || {}).additionalAgendaList) || [];
      if (agenda.indexOf('Policy updates') < 0) {
        broken.push('4.2: the agenda item itself was not stored');
      }
      if (!G.RG.dataGateOK('4.2')) {
        broken.push('4.2: the completion gate still refuses with every field filled — '
          + G.RG.dataGateMsg('4.2'));
      }

      /* And the other way out of the field: clicking away. beforeNavigate
         calls harvestOpenFields, which covered nine blocks and not this one. */
      G.data.govRhythm.firstMeeting = '';
      G.document.getElementById('gr_firstMeeting').value = '2026-10-15';
      G.RG.harvestOpenFields();
      if (G.data.govRhythm.firstMeeting !== '2026-10-15') {
        broken.push('4.2: navigating away loses the first meeting date (harvestOpenFields holds '
          + JSON.stringify(G.data.govRhythm.firstMeeting) + ')');
      }
    }
  } catch (e) { record('4.2 harvest', e); }

  /* Step 4.4 is the same shape and the worst case of it: its gate wants six
     agenda items covered AND three starred written answers, and walkFR — the
     "Mark covered" handler — re-rendered without banking those answers. So
     ticking an item erased however much prose had just been typed, and writing
     the prose did not tick anything: the reader could hold one or the other
     and never both, and the step could not be finished at all. Both halves are
     asserted together, because either alone passes on the broken code. */
  try {
    G.data = G.Modules.emptyData();
    G.go('step', '4.4');
    const markup = G.Modules.page('step')();
    G.document._setPage(markup);

    const answers = { fr_working: 'Risks are logged without prompting.', fr_bottlenecks: 'Deep assessments bunch at the end.', fr_nextIteration: 'Add the staleness alarm.' };
    const missing = Object.keys(answers).filter(id => !G.document.getElementById(id));
    if (missing.length) {
      broken.push('4.4: expected the written answers on the page, missing ' + missing.join(', '));
    } else {
      Object.keys(answers).forEach(id => { G.document.getElementById(id).value = answers[id]; });
      /* KB fixes 15 Oct 2026, item 10 (ruled): all seven agenda items, item 6 (resp) included */
      ['planned', 'stuck', 'systems', 'tests', 'compliance', 'resp', 'review'].forEach(k => G.RG.walkFR(k));

      const fr = (G.data || {}).firstReview || {};
      const ticks = Object.keys(fr.walk || {});
      if (ticks.length < 7) broken.push('4.4: only ' + ticks.length + ' of the seven agenda items stayed covered');
      if (fr.working !== answers.fr_working) {
        broken.push('4.4: marking an agenda item covered erased the written answers (data holds '
          + JSON.stringify(fr.working) + ') — the step can then never complete');
      }
      /* KB fixes 15 Oct 2026, item 9 (ruled): the step completes once a Governance
         Review has been logged, not on the Covered marks — the save clears those.
         So covered-but-unsaved still refuses, and Save governance review (the
         4.4 button's own handler: saveFR, then govLogReview) opens the gate. */
      if (G.RG.dataGateOK('4.4')) {
        broken.push('4.4: the completion gate opened on the Covered marks alone, before the review was saved');
      } else if (String(G.RG.dataGateMsg('4.4')).indexOf('Hold the review first') < 0) {
        broken.push('4.4: before the review is saved the gate should say "Hold the review first…", got ' + JSON.stringify(G.RG.dataGateMsg('4.4')));
      }
      G.RG.saveFR(); G.RG.govLogReview('governance');
      if (!G.RG.dataGateOK('4.4')) {
        broken.push('4.4: the completion gate still refuses after Save governance review — ' + G.RG.dataGateMsg('4.4'));
      }
    }
  } catch (e) { record('4.4 harvest', e); }

  /* KB fixes directive (15 Oct 2026, eleven items ruled by Paul): the acceptance
     lines that run without a browser. Each fixture builds its own document. */
  try {
    const DAY = 86400000, now = Date.now();
    const kb = [];
    G.data = G.Modules.emptyData();
    const s = { id: 'sys-kb', testEvidence: [['t1', 91], ['t2', 89], ['t3', 31], ['t4', 15], ['t5', 2], ['t6', 8]].map(p => ({ testId: p[0], at: now - p[1] * DAY })) };
    const st = [['t1', 'quarterly'], ['t2', 'quarterly'], ['t3', 'Monthly'], ['t4', 'every two weeks'], ['t5', 'daily'], ['t6', 'Weekly']]
      .map(p => G.RG.testState(s, { id: p[0], shape: 'recurring', frequency: p[1] })).join(',');
    if (st !== 'overdue,ok,overdue,overdue,overdue,overdue') kb.push('item 1: OVERDUE per frequency (Quarterly 90, Monthly 30, Every two weeks 14, Daily 1, Weekly 7) gave ' + st);
    const df = G.RG.ttDesignFields({ id: 'sys-kb', testingPlan: { tests: [] } }, { id: 't9', shape: 'recurring', frequency: 'Monthly' });
    if (df.indexOf('How often') >= 0 || df.indexOf('<option value="monthly" selected>Monthly</option>') < 0 || df.indexOf('RG.ttFieldSave(') < 0
      || !['Select frequency...', 'Daily', 'Weekly', 'Every two weeks', 'Monthly', 'Quarterly'].every(l => df.indexOf('>' + l + '</option>') >= 0)) kb.push('item 1: Design the Tests should show the frequency dropdown with "Monthly" selected');
    if (G.RG.lyTestText({ shape: 'recurring', frequency: 'fortnightly', claim: 'x' }).indexOf('Every two weeks') < 0) kb.push('item 1: the printed test line should show the frequency label');

    G.data.systems = [{ id: 'sk1', name: 'Kb sys' }, { id: 'sk2', name: 'Lone sys' }];
    G.data.risks = [{ id: 'rk1', name: 'Kb risk', systemId: 'sk1', litL: 4, litI: 3, litT: 2 }, { id: 'rk2', name: 'Kb risk two', systemId: 'sk1' }];
    if (G.RG.anTopExposures().indexOf('L4 · I3 · T2') < 0) kb.push('item 2: Top Exposures should read L4 · I3 · T2');
    const fw = G.RG.govFWBody();
    if (fw.indexOf('Reassessment') >= 0 || fw.indexOf('Deploy Gate') < 0) kb.push('item 7: the Governance Framework should keep its tiles but Reassessment');

    const keepConfirm = G.confirm, asked = []; let answer = false;
    G.confirm = m => { asked.push(m); return answer; };
    G.RG.removeSystem('sk1'); G.RG.removeRisk('rk1');
    if (G.data.systems.length !== 2 || G.data.risks.length !== 2 || G.data.risks[0].systemId !== 'sk1') kb.push('item 8: Cancel should change nothing');
    answer = true; G.RG.removeSystem('sk1'); G.RG.removeSystem('sk2'); G.RG.removeRisk('rk1');
    G.confirm = keepConfirm;
    if (G.data.systems.length !== 0 || G.data.risks.length !== 1 || G.data.risks[0].systemId !== null) kb.push('item 8: confirming should remove the system, unlink its risks, and remove the risk');
    const want = ['Remove “Kb sys” from the inventory? 2 risks are attached to it and will no longer be linked to a system. This cannot be undone.',
      'Remove “Kb risk”? The risk card is deleted, not archived. This cannot be undone.',
      'Remove “Kb sys” from the inventory? 2 risks are attached to it and will no longer be linked to a system. This cannot be undone.',
      'Remove “Lone sys” from the inventory? This cannot be undone.',
      'Remove “Kb risk”? The risk card is deleted, not archived. This cannot be undone.'];
    if (JSON.stringify(asked) !== JSON.stringify(want)) kb.push('item 8: confirmation wording ' + JSON.stringify(asked));

    G.data.systems = [];
    G.data.risks = [{ id: 'm1', name: 'Mon', classification: 'monitor', monitorPlan: { monitor: 'Pat', frequency: 'review', at: now - 60 * DAY,
      indicators: [{ name: 'i1', frequency: 'weekly', checks: [{ at: now - 20 * DAY }] }, { name: 'i2', frequency: 'weekly', checks: [{ at: now - DAY }] }] } }];
    const rk = () => G.RG.anHealth().comps.filter(c => c.n === 'Rhythm kept')[0];
    const a = rk(); G.data.risks[0].monitorPlan.indicators[0].checks.push({ at: now }); const b = rk();
    if (!(a && b && Math.abs(a.v - 1 / 3) < 1e-9 && b.v > a.v)) kb.push('item 11: Rhythm kept should count each indicator (a Weekly one checked 20 days ago lowers it, a check raises it), got ' + JSON.stringify([a && a.v, b && b.v]));
    if (!a || a.tip !== 'The review cadence is set, and every indicator on a monitored risk has been checked within one and a half times its own check frequency.') kb.push('item 11: Rhythm kept hover text');

    /* item 10: Save governance review (4.4) and ✓ Log this review (the standing
       review page) appear only with all seven items covered — six, without
       item 6 (resp), keeps both hidden. Found by handler: the 4.4 gate message
       itself names the button. */
    [['step', '4.4', 'RG.govLogReview('], ['govreview', undefined, 'RG.saveGovReview()']].forEach(t => {
      const draw = () => { G.go(t[0], t[1]); return G.Modules.page(t[0])(); };
      G.data = G.Modules.emptyData(); G.data.firstReview = { walk: {} };
      ['planned', 'stuck', 'systems', 'tests', 'compliance', 'review'].forEach(k => { G.data.firstReview.walk[k] = { at: now, by: 'kb' }; });
      const six = draw().indexOf(t[2]) >= 0;
      G.data.firstReview.walk.resp = { at: now, by: 'kb' };
      const seven = draw().indexOf(t[2]) >= 0;
      if (six || !seven) kb.push('item 10: ' + t[0] + (t[1] ? ' ' + t[1] : '') + ' should arm its save only with all seven items covered (six: ' + six + ', seven: ' + seven + ')');
    });

    const csv = G.RG.exportRiskCSV.toString();
    if (csv.indexOf("'Impact (I)','Timeframe (T)'") < 0) kb.push('item 3: Risk Register CSV headers');
    if (G.RG.renderOutExitPlans.toString().indexOf('<strong>Owner:</strong>') < 0) kb.push('item 4: Management & Monitoring Plans should say Owner:');
    const src = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'ai-governance', 'program.js'), 'utf8'), n = t => src.split(t).length - 1;
    if (n("['exp','Composite','center']") !== 1) kb.push('item 2: Risk Explorer column Composite');
    if (n("{label:'Owner',") < 1 || n('it needs an owner and at least one indicator.') !== 1 || n('What is being monitored') + n('monitoring statement') + n('<strong>Monitor:</strong>') !== 0) kb.push('item 4: the monitoring plan field is Owner on every surface');
    if (n('Snapshots recorded automatically every day') !== 2 || n('recorded automatically every day. Come back tomorrow to see movement.') !== 1 || n('each day you open Analytics') + n('when Analytics is opened') !== 0) kb.push('item 5: snapshot wording');
    if (n('Two things live in separate columns') !== 1 || n('what you have determined') !== 0) kb.push('item 6: NIST paragraph');
    kb.forEach(m => broken.push('KB fixes 15 Oct 2026, ' + m));
  } catch (e) { record('KB fixes 15 Oct 2026', e); }
}

/* ── The PDF carries its own stylesheet ────────────────────────
   This program's printPage is the reference's: it opens a BARE window and
   writes a self-contained document into it, so printThemeTokens() is the only
   stylesheet the export gets. Nothing else in the app works that way — the
   shell prints the live document — so nothing else notices when those tokens
   are wrong, and what a wrong one produces is a PDF that renders in another
   program's colours with some elements losing their colour altogether.

   Two things are checked. That the nine --t-* status colours the module
   stylesheet introduces are IN the token block at all, since the popup never
   loads that stylesheet. And that the accent set AGREES WITH themes.css —
   which is the one place colour is decided, and which this block necessarily
   duplicates. The duplication is the reference's design and is kept; the
   check is what stops the two drifting apart silently. */
{
  const tokens = (() => { try { return String(G.RG.printThemeTokens() || ''); } catch (e) { record('PRINT tokens', e); return ''; } })();
  const themes = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'themes.css'), 'utf8');
  const block = (themes.match(/\[data-app="ai-governance"\]\s*\{([\s\S]*?)\}/) || [, ''])[1];
  const readTheme = n => ((block.match(new RegExp('--' + n + '\\s*:\\s*([^;]+);')) || [, ''])[1] || '').trim().toLowerCase();
  const readPrint = n => ((tokens.match(new RegExp('--' + n + '\\s*:\\s*([^;}]+)', 'g')) || []).pop() || '')
    .split(':').slice(1).join(':').trim().toLowerCase();   // LAST wins inside one :root{}

  if (!tokens) broken.push('PRINT: printThemeTokens() returned nothing — the export would have no stylesheet at all');

  ['t-good', 't-warn', 't-crit', 't-info', 't-teal2', 't-slate', 't-brown', 't-plum', 't-pink']
    .forEach(n => {
      if (tokens.indexOf('--' + n) < 0) {
        broken.push('PRINT: --' + n + ' is missing from the print tokens — the module stylesheet is not loaded in the export, so it resolves to nothing');
      }
    });

  /* --gold* is the alias themes.css draws over --accent*; compare like for
     like. --ink is stated directly in the program's block (its ground shift). */
  [['gold', 'accent'], ['gold-light', 'accent-light'], ['gold-pale', 'accent-pale'],
  ['gold-text', 'accent-strong'], ['ink', 'ink']].forEach(([printName, themeName]) => {
    const want = readTheme(themeName), got = readPrint(printName);
    if (want && got && want !== got) {
      broken.push('PRINT: --' + printName + ' is ' + got + ' in the export but themes.css says '
        + want + ' — the PDF would not match the screen');
    }
    if (want && !got) broken.push('PRINT: --' + printName + ' is absent from the print tokens');
  });

  /* And the export ITSELF, run the way the button runs it: window.open is
     stubbed so the document it writes can be read instead of printed. Against
     the POPULATED workspace, because an empty one produces a cover page and
     little else and would not notice a report that renders nothing.

     The charset is asserted because the document has no stylesheet OR encoding
     but the ones it writes: without the meta it renders correctly only while
     the popup happens to inherit the opener's, and every ·, — and ✓ in the
     report rides on that. */
  G.data = G.Modules.emptyData();
  G.data.systems = [{ id: 'sys1', name: 'Claims triage model', owner: 'Ada Kern', stage: 'live', description: 'Ranks claims.', testEvidence: [] }];
  G.data.risks = [{ id: 'r1', name: 'Biased shortlisting', description: 'Proxy down-ranking.', category: 'P', source: 'internal', litL: 4, litI: 5, litT: 4, classification: 'manage', assess: {}, history: [] }];
  G.data.assessmentBattery = { aiExposure: { departments: 'Claims and underwriting', directCriticality: 4 } };

  let wrote = '';
  const realOpen = G.open;
  G.open = () => ({ document: { write: s => { wrote += s; }, close() { } }, print() { }, focus() { } });
  ['out-assessprofile', 'out-riskreg', 'out-sysinv'].forEach(id => {
    wrote = '';
    G.currentPage = 'outcome'; G.currentStep = id;
    try { G.RG.printPage(); } catch (e) { record('PRINT ' + id, e); return; }
    if (wrote.length < 1000) { broken.push('PRINT ' + id + ': the export wrote ' + wrote.length + ' chars'); return; }
    if (!/<meta[^>]+charset/i.test(wrote)) broken.push('PRINT ' + id + ': the document declares no charset');
    if (/<button/i.test(wrote)) broken.push('PRINT ' + id + ': a button survived into the export');
    if (/onclick=/i.test(wrote)) broken.push('PRINT ' + id + ': an onclick survived into the export');
    if (wrote.indexOf('--t-good') < 0) broken.push('PRINT ' + id + ': the status tokens are missing from this export');
    /* Part 1 (directive 2 Oct 2026): the print window's fonts come from our own server, never Google's */
    if (/fonts\.(googleapis|gstatic)\.com/.test(wrote)) broken.push('PRINT ' + id + ': the export still asks Google for its fonts');
    if (!/<link rel="stylesheet" href="[^"]*fonts\/print-governance\.css">/.test(wrote)) broken.push('PRINT ' + id + ': the export does not link fonts/print-governance.css');
    if (VERBOSE) console.log('  export ' + id.padEnd(20) + String(wrote.length).padStart(7) + ' chars');
  });
  G.open = realOpen;
}

/* ── Export and import ─────────────────────────────────────────
   The export has to name the program it came from, and the import has to
   refuse a document from a different one. Both are the shell's (the reference
   build stamped neither — in a standalone build there was only one program to
   export), so this is checking that the module did not quietly keep its own. */
let exported = null;
G.URL.createObjectURL = blob => { exported = blob; return 'blob:smoke'; };
try { G.exportState(); } catch (e) { record('EXPORT', e); }
if (!exported) {
  broken.push('EXPORT: produced no file');
} else {
  let doc = null;
  try { doc = JSON.parse(exported.text || ''); } catch (e) { }
  if (!doc) broken.push('EXPORT: the payload is not readable JSON');
  else {
    if (doc.module !== MODULE_ID) broken.push('EXPORT: stamped module="' + doc.module + '", expected "' + MODULE_ID + '"');
    if (!doc.data || !doc.data.risks) broken.push('EXPORT: the payload carries no workspace');
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

/* ── Part 2: the AI features, off by default (directive 2 Oct 2026, applied 7 Oct 2026) ──
   The switches, the Profile fold, the A.2.6 notice and every guard are the shell's
   (js/features/coach.js, voice.js); this proves they apply on THIS program's page,
   that its workspace starts with both off, and that nothing reaches the AI service. */
{
  const aiCalls = []; const realFetch = G.fetch;
  G.fetch = (u) => { if (String(u) === String(G.CLAUDE_API_URL)) aiCalls.push(String(u)); return realFetch ? realFetch.apply(null, arguments) : Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
  const keepSettings = G.data.settings;
  if (JSON.stringify(G.Modules.emptyData().settings) !== '{"aiGuide":false,"voice":false}') broken.push('AI: this program\'s emptyData() does not carry settings, both off');
  if (!G.aiSwitchesApply()) broken.push('AI: the switches do not apply on a Responsible AI Governance page');
  delete G.data.settings;
  if (G.aiGuideOn() || G.voiceOn()) broken.push('AI: a workspace without settings does not count as both off');
  try { if (G.coachOpen) G.toggleCoach(); G.toggleCoach(); } catch (e) { record('AI toggleCoach', e); }
  if (G.coachOpen) broken.push('AI: the AI Guide opened while it is off');
  try { const ci = G.document.getElementById('coachInput'); if (ci) ci.value = 'hello'; G.sendCoach(); G.sendCoachPreset('Where do I start?'); } catch (e) { record('AI sendCoach', e); }
  if (aiCalls.length) broken.push('AI: ' + aiCalls.length + ' request(s) reached the AI service while it is off');
  try { G.applyAiFeatures && G.applyAiFeatures(); } catch (e) { record('AI applyAiFeatures', e); }
  const fab = G.document.getElementById('coachFab');
  if (fab && fab.style.display !== 'none') broken.push('AI: the AI Guide button is shown while it is off');
  G.data.settings = { aiGuide: true, voice: false };
  if (!G.aiGuideOn() || G.voiceOn()) broken.push('AI: switched on in the workspace, the AI Guide does not follow (or Voice came on with it)');
  if (keepSettings === undefined) delete G.data.settings; else G.data.settings = keepSettings;
  G.fetch = realFetch;
}

/* ── Part S: the session seal (directive 2 Oct 2026, applied 7 Oct 2026) ──
   Nothing survives a change of organization or user. The shell's sealSession
   resets the shell's state and calls this program's sealSession hook for its
   own: the Insights tab program.js keeps (the shell's insightsTabReset cannot
   reach it). The reference's drafts and stashes are UI keys, so they go with
   the shell's rebuild of UI, and the page wrappers seed UI_DEFAULTS again on
   the next render. Driven through switchToOrg, the door sign-in and the admin
   console's Open both use. */
{
  const tabOn = t => / active"/.test(G.RG.insightsTabBtn(t, 'x'));
  const keepUser = G.currentUserId;
  G.UI.aNewKey = { x: 1 }; G.UI.mgStash = { r1: { a: 1 } }; G.UI.wbStash = { r1: {} }; G.UI.cerDraft = { owner: 'Org A' };
  G.UI.ethDraft = { r1: { how: 'Org A' } }; G.UI.rapidDraft = { r1: { a: 1 } }; G.UI.bandDraft = { cls: 'x' }; G.UI.abSec = '1.1c';
  G.RG.setInsightsTab('worth'); G.gchatUnreadCount = 4; G.currentPage = 'insights';
  G.coachMsgs.push({ role: 'user', text: 'Org A' });
  if (!tabOn('worth')) broken.push('SEAL setup: the program\'s Insights tab did not move to worth');
  if (!G.sealApplies()) broken.push('SEAL: the seal does not apply on a Responsible AI Governance page');
  try { G.switchToOrg(G.currentOrgId); } catch (e) { record('SEAL switchToOrg', e); }
  ['aNewKey', 'mgStash', 'wbStash', 'cerDraft', 'ethDraft', 'rapidDraft', 'bandDraft', 'abSec'].forEach(k => {
    if (G.UI[k] !== undefined) broken.push('SEAL: UI.' + k + ' survived the change of organization');
  });
  if (!tabOn('latest')) broken.push('SEAL: the program\'s own Insights tab survived the change of organization');
  if (G.gchatUnreadCount !== 0) broken.push('SEAL: the Team Chat unread count survived');
  if (G.currentPage !== 'home') broken.push('SEAL: the page survived (' + G.currentPage + ')');
  if (JSON.stringify(G.coachMsgs) !== JSON.stringify(JSON.parse(G.COACH_MSGS_PRISTINE))) broken.push('SEAL: the AI Guide conversation survived');
  G.currentUserId = keepUser;
  if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster();
  try { G.go('step', '1.1'); G.Modules.page('step')(); } catch (e) { record('SEAL re-render', e); }
  if (G.UI.abSec !== '1.1a') broken.push('SEAL: after the seal, the next render did not seed the program\'s UI defaults (abSec ' + G.UI.abSec + ')');
}

/* ── What this program sends to the database ───────────────────
   The workspace table is keyed (organization_id, module), so a save that names
   the wrong module — or names none — files this program's document under
   another program. Every request the app makes must carry module=ai-governance,
   and this reads them: server mode is decided by location.protocol, so a
   separate sandbox is flipped to http and handed a fetch that RECORDS instead
   of sending. Nothing leaves the process and no database is touched. */
const sent = [];
const S = makeSandbox(true);
S.fetch = (url, opts) => {
  let body = null;
  try { body = JSON.parse((opts && opts.body) || 'null'); } catch (e) { }
  sent.push({ url: String(url), method: (opts && opts.method) || 'GET', body: body });
  /* POST /seed answers with local_id → public_id, the way the real endpoint
     does. It has to: syncSeedToServer stamps those ids onto the roster and the
     workspace save that follows is authorized as one of those members. */
  const data = { rev: 1, orgs: [], members: 0, map: {} };
  if (/\/seed$/.test(String(url)) && body && Array.isArray(body.members)) {
    body.members.forEach(m => { data.map[m.local_id] = 'srv_' + m.local_id; });
    data.members = body.members.length;
  }
  return settled('ok', { status: 200, json: () => settled('ok', { success: true, data: data }) });
};
load(S);
try {
  const b = S.createOrg('DB Check', { name: 'Owner', username: 'owner', passcode: '1234' });
  S.currentUserId = b.userId;
  /* A save goes out only for an organization the database knows about, and
     only with an actor the API can authorize. Stamping the two server ids here
     is the state a real sign-up leaves behind once /organizations has
     answered. */
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
    if (!s.body.doc || !s.body.doc.risks) broken.push('DB: the saved document is not this program\'s');
  });
}
/* EVERY request, not only the workspace saves: assignments and the change
   poll are module-scoped too, and an unstamped one of those is the same bug
   one table over. */
sent.filter(r => r.body && Object.prototype.hasOwnProperty.call(r.body, 'module'))
  .forEach(r => {
    if (r.body.module !== MODULE_ID) {
      broken.push('DB: ' + r.method + ' ' + r.url.replace(/^.*\//, '') + ' named module="' + r.body.module + '"');
    }
  });

/* ── The neighbour ─────────────────────────────────────────────
   The check the whole port was asked for, made against the other program
   rather than against intent: a third sandbox boots the PIPELINE over the same
   localStorage this run has been writing to all along, and its document has to
   come back empty. Two programs in one browser really do share that store, so
   the only thing keeping them apart is that every key Store writes carries the
   module — and this is what proves it does.

   Rendered as well as read, because a document that survives and then cannot
   be drawn is not a document that survived. */
const N = makeSandbox(false, 'pipeline', SHARED_STORE);
load(N, filesFor('pipeline'));
if (!N.Modules || N.Modules.activeId() !== 'pipeline') {
  broken.push('NEIGHBOUR: could not boot the Pipeline for the cross-module check');
} else {
  const nd = N.data || {};
  ['systems', 'risks', 'regimes', 'raciMatrix', 'assessmentBattery'].forEach(k => {
    const v = nd[k];
    const filled = Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0);
    if (filled) broken.push('NEIGHBOUR: the Pipeline\'s workspace picked up this program\'s "' + k + '"');
  });
  const keys = [...SHARED_STORE.keys()];
  /* And the store itself: every key this program wrote must name it. A key
     without the module in it is a key the next program will read. */
  const doc = keys.filter(k => /org-data/.test(k));
  doc.forEach(k => {
    if (!/ai-governance|pipeline/.test(k)) {
      broken.push('NEIGHBOUR: workspace key "' + k + '" names no module');
    }
  });
  if (VERBOSE) console.log('\nshared localStorage keys: ' + keys.length + '\n  ' + keys.join('\n  '));
}

/* ── Report ───────────────────────────────────────────────────── */
console.log('\n──────────────────────────────────────────');
console.log('Responsible AI Governance page smoke');
/* 1 pipeline + 5 phase landings + the 6 standing pages (phase5, insights,
   mgmt-hub, ethicsov, govreview, reports) + the portfolios + the steps +
   the outputs + one system view. */
const PER_PASS = 1 + 5 + 6 + PORTFOLIOS.length + STEPS.length + OUTCOMES.length + 1;
console.log('  pages rendered  :', pagesRendered, '(of ' + (4 * PER_PASS) + ' — ' + PER_PASS + ' pages, empty / populated / placeholder-era / seeded)');
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
console.log('  ✓ the seed, the export and every request name this module only');
console.log('  ✓ the Pipeline\'s workspace is untouched by any of it');
console.log('──────────────────────────────────────────');
