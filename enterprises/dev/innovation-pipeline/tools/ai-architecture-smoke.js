#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   ai-architecture-smoke.js — render every AI-Ready Architecture page
   and pull every trigger on it
   ─────────────────────────────────────────────────────────────
   The program's pages are generated (tools/port-ai-architecture.js
   lifts them out of the reference build). A generated port fails in
   two ways a diff will not show: a page dies on a name nobody brought
   across, or a button renders and does nothing because the name inside
   its onclick string was never repointed at ARC. So this walks every
   address inside the program — the Framework overview, five phase
   landings, every step, every output, the Dashboard and the program's
   own standing pages — and EVALUATES every inline handler each one
   produced.

   Passes: an empty workspace, the PLACEHOLDER-ERA document already in
   the database for every account that opened this program while it was
   catalogued and unbuilt, and each of the program's three seeds
   (sample, full, sovereignty), which between them fill every register.

   Then MODULE ISOLATION, against the wire and the neighbour: a served
   sandbox with a recording fetch must name module=ai-architecture on
   every request the seed makes, and the Pipeline booted over the same
   localStorage must find its document untouched.

   The infrastructure (stub DOM, sandboxes, handler evaluation) is
   tools/ai-governance-smoke.js's, copied — read its notes.

   Usage:  node tools/ai-architecture-smoke.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;
const MODULE_ID = 'ai-architecture';

/* ── The page list ─────────────────────────────────────────────
   Written out rather than derived from PH, so a phase quietly losing a step
   shows up as an untested id. 5.1 is the Dashboard page (phase5). */
const STEPS = ['1.1', '1.2', '1.3', '1.4', '1.5', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7',
  '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '4.3', '5.2', '5.3', '5.4', '5.5'];
const OUTCOMES = ['out-readiness', 'out-archmap', 'out-riskmap', 'out-boardchart', 'out-sovbaseline',
  'out-datagov', 'out-intmod', 'out-govframework', 'out-sovmap',
  'out-deployconf', 'out-security', 'out-cascade', 'out-sovval',
  'out-skills', 'out-embedreview', 'out-quarterly', 'out-dgreview'];
/* The program's own page ids, each registered by module.js. */
const OWN_PAGES = ['phase5', 'insights', 'manage', 'mgmt-hub', 'reports', 'archreview', 'archmap',
  'archscores', 'stdData', 'dgreview', 'stdCompute', 'stdModel', 'stdInteg', 'stdApp', 'jurmap'];


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

function pageList() {
  return [{ page: 'pipeline' }]
    .concat([1, 2, 3, 4, 5].map(n => ({ page: 'phase', step: String(n) })))
    .concat(OWN_PAGES.map(p => ({ page: p })))
    .concat(STEPS.map(s => ({ page: 'step', step: s })))
    .concat(OUTCOMES.map(o => ({ page: 'outcome', step: o })));
}

function renderEvery(G, label) {
  pageList().forEach(target => {
    const where = label + ' ' + target.page + (target.step ? ':' + target.step : '');
    let markup = '';
    try {
      G.go(target.page, target.step);
      const fn = G.Modules.page(G.currentPage);
      if (!fn) { broken.push(where + ' → the module claims no such page (' + G.currentPage + ')'); return; }
      markup = fn();
    } catch (e) { if (process.env.SMOKE_STACK) console.log(e.stack); record(where + ' render', e); return; }
    pagesRendered++;
    if (typeof markup !== 'string' || markup.length < 200) {
      broken.push(where + ' → rendered ' + (typeof markup === 'string' ? markup.length + ' chars' : typeof markup));
      return;
    }
    G.document._setPage(markup);
    const n = pullEveryTrigger(G, markup, where);
    if (VERBOSE) console.log('  ' + where.padEnd(34) + String(markup.length).padStart(8) + ' chars  ' + String(n).padStart(4) + ' handlers');
  });
}

/* ── Run ───────────────────────────────────────────────────────── */
load(sandbox);
const G = sandbox;

if (!G.Modules || G.Modules.activeId() !== MODULE_ID) {
  console.error('the active module is', G.Modules && G.Modules.activeId(), '— expected', MODULE_ID);
  process.exit(1);
}
if (!G.ARC || !G.ARC.renderOverview) { console.error('window.ARC was never filled — program.js did not load'); broken.forEach(b => console.error(b)); process.exit(1); }

try {
  const boot = G.createOrg('Smoke Org', { name: 'Owner', username: 'owner', passcode: '1234' });
  G.currentUserId = boot.userId;
  if (typeof G.applyTeamRoster === 'function') G.applyTeamRoster();
} catch (e) { broken.push('BOOT createOrg → ' + ((e && e.message) || e)); }

/* The shape the shell is promised. */
(function () {
  const d = G.Modules.emptyData();
  ['dataEstate', 'integrations', 'aiModels', 'completedSteps', 'assigns', 'reportDefs', 'settings', 'startDate', 'notes']
    .forEach(k => { if (!(k in d)) broken.push('emptyData() has no "' + k + '"'); });
  if (d.settings && (d.settings.aiGuide || d.settings.voice)) broken.push('emptyData(): the AI features must start off');
  const ph = G.Modules.PH();
  if (!ph || ph.length !== 5) broken.push('PH: expected 5 phases, got ' + (ph && ph.length));
  const ids = [].concat.apply([], ph.map(p => p.steps.map(s => s.id))).filter(s => s !== '5.1');
  ids.forEach(s => { if (STEPS.indexOf(s) < 0) broken.push('PH has step ' + s + ' which this smoke does not visit'); });
  const outs = [].concat.apply([], ph.map(p => (p.outcomes || []).map(o => o.id)));
  outs.forEach(o => { if (OUTCOMES.indexOf(o) < 0) broken.push('PH has output ' + o + ' which this smoke does not visit'); });
})();

/* Pass 1 — a brand-new workspace. */
if (VERBOSE) console.log('\nempty workspace');
G.data = G.Modules.emptyData();
renderEvery(G, 'empty');

/* Pass 2 — the placeholder-era document: roster and profile, and none of this
   program's containers. module.js's normalize() must give it the shape. */
if (VERBOSE) console.log('\nplaceholder-era workspace');
G.data = { roster: G.data.roster, enterprise: { name: 'Smoke Org' }, answers: { q1: 'x' }, bfNotes: '', settings: { aiGuide: false, voice: false } };
renderEvery(G, 'placeholder');

/* Passes 3–5 — the program's own seeds, through the shell's runSeed so the
   More-menu path is what is tested. */
const SEEDS = G.Modules.seeds().map(s => s.id);
if (SEEDS.join(',') !== 'sample,full,sovereignty') broken.push('seeds: expected sample,full,sovereignty, got ' + SEEDS.join(','));
SEEDS.forEach(id => {
  if (VERBOSE) console.log('\nseed: ' + id);
  G.data = G.Modules.emptyData();
  try { G.runSeed(id); } catch (e) { record('seed ' + id, e); return; }
  const d = G.data || {};
  if (!Array.isArray(d.dataEstate) || !d.dataEstate.length) broken.push('seed ' + id + ': no data estate — not this program\'s document');
  if (d.ideas || d.projects) broken.push('seed ' + id + ': wrote the Pipeline\'s containers');
  renderEvery(G, 'seed:' + id);
});

/* ── The assignment rule, by effect ────────────────────────────
   Grafted at port time (PATCHES). A member who is not assigned to a step
   gets a locked button with the reason, and confirmStepDone refuses. */
(function () {
  try {
    G.data = G.Modules.emptyData();
    G.runSeed('full');
    /* Two of the seed's people (none of them administrators): one acts, the
       other holds the assignment. */
    const cast = (G.data.roster || []).filter(u => !u.admin);
    const member = cast[0], other = cast[1];
    if (!member || !other) { broken.push('ASSIGN: the full seed has no two non-admin members to test with'); return; }
    const was = G.currentUserId;
    G.currentUserId = member.id;
    /* Set the state up rather than hunt for it: the full seed completes every
       step. One step reopened and assigned to someone else; one left unassigned.
       (An already-complete step is let through by design — re-clicking writes nothing.) */
    const step = '3.3', open = '3.4';
    [step, open].forEach(s => { delete (G.data.completedSteps || {})[s]; });
    G.data.assigns = G.data.assigns || {};
    G.data.assigns[step] = [other.id];
    G.data.assigns[open] = [];
    if (G.ARC.confirmStepDone(open) !== false) broken.push('ASSIGN: confirmStepDone let a member complete an UNASSIGNED step (the administrator\'s)');
    G.go('step', step);
    const html = G.ARC.doneBtn('x()', false, '', false, '');
    if (!/disabled/.test(html) || !/assigned to|Nobody is assigned/.test(html)) broken.push('ASSIGN: a member\'s button on step ' + step + ' (not theirs) is not locked: ' + html.slice(0, 160));
    if (G.ARC.confirmStepDone(step) !== false) broken.push('ASSIGN: confirmStepDone let a member complete step ' + step + ', which is not theirs');
    G.currentUserId = was;
  } catch (e) { record('ASSIGN', e); }
})();

/* ── Step 1.1 opens with its first tab selected ──────────────────
   UI.sec is shared with the shell, which starts it at the Pipeline's '1.1'; this program reads it as a
   tab id. Starting from the shell's value, exactly one tab must be the active one (class bp). */
(function () {
  try {
    G.data = G.Modules.emptyData();
    G.UI.sec = '1.1';
    G.go('step', '1.1');
    const html = G.Modules.page('step')();
    const strip = (html.match(/<div class="step-tabs"[\s\S]*?<\/div>/) || [''])[0];
    const active = (strip.match(/class="btn bp"/g) || []).length;
    if (active !== 1) broken.push('TABS: step 1.1 shows ' + active + ' selected tabs (want 1) when UI.sec starts at the shell\'s "1.1"');
    else if (!/class="btn bp">[^<]*Purpose &amp; Strategy|class="btn bp">[^<]*Purpose & Strategy/.test(strip)) broken.push('TABS: step 1.1 opens on a tab other than Purpose & Strategy');
  } catch (e) { record('TABS', e); }
})();

/* ── The sidebar stays where the build keeps it ──────────────────
   Through the SHELL's sidebarShowsHere(), which asks the module's sidebarShowsOn hook: the reference's
   renderSidebar() list, under the shell's page names. */
(function () {
  const ON = ['step', 'reports', 'mgmt-hub', 'pipeline', 'phase5', 'manage', 'outcome', 'phase', 'archmap',
    'archreview', 'archscores', 'stdData', 'dgreview', 'stdCompute', 'stdModel', 'stdInteg', 'stdApp'];
  try {
    G.data = G.Modules.emptyData();
    pageList().forEach(t => {
      G.go(t.page, t.step);
      const want = ON.indexOf(G.currentPage) >= 0, got = !!G.sidebarShowsHere();
      if (want !== got) broken.push('SIDEBAR: ' + G.currentPage + (t.step ? ':' + t.step : '') + ' shows the sidebar=' + got + ', the build says ' + want);
    });
  } catch (e) { record('SIDEBAR', e); }
})();

/* ── Phase 5's heading opens the Manage page, as in the build ──── */
(function () {
  try {
    G.data = G.Modules.emptyData();
    G.go('pipeline'); G.UI.navOpenSet = {};
    G.goPhase(5);
    if (G.currentPage !== 'manage') broken.push('PHASE5: the sidebar\'s phase-5 heading went to "' + G.currentPage + '", the build opens the Manage page');
    if (G.activeNavPhaseId() !== 5) broken.push('PHASE5: on the Manage page the sidebar highlights phase ' + G.activeNavPhaseId() + ', not 5');
    G.UI.navOpenSet = {}; G.goPhase(2);
    if (G.currentPage !== 'phase' || String(G.currentStep) !== '2') broken.push('PHASE5: the phase-2 heading no longer opens its landing');
    G.go('phase', '5');
    const html = G.Modules.page('phase')();
    if (!/Managing your AI-ready architecture is continuous/.test(html)) broken.push('PHASE5: a phase-5 address does not show the Manage page');
  } catch (e) { record('PHASE5', e); }
})();

/* ── My Assignments opens when the member HAS assignments ─────────
   The shell's list reads [{id, name, ph:{id, name}}] from the assignSteps hook; this program's mgSteps()
   says `phase`, and the list threw on the first assigned step (22 Oct 2026). */
(function () {
  try {
    G.data = G.Modules.emptyData();
    const me = G.currentUserId;
    G.data.assigns = { '1.3': [me], '2.2': [me], '1.1': [me] };
    G.data.stepDue = { '2.2': '2026-09-01' };
    G.data.completedSteps = { '1.1': true };
    const steps = G.asgnSteps();
    if (!steps.length || !steps.every(s => s.ph && s.ph.id && s.ph.name)) broken.push('ASSIGNMENTS: assignSteps does not give {id,name,ph:{id,name}}');
    const open = G.asgnOpenTasks(me), done = G.asgnTasks(me, true);
    if (open.map(t => t.id).join(',') !== '2.2,1.3') broken.push('ASSIGNMENTS: open list is "' + open.map(t => t.id).join(',') + '", want 2.2 (dated) then 1.3');
    if (done.map(t => t.id).join(',') !== '1.1') broken.push('ASSIGNMENTS: completed list is "' + done.map(t => t.id).join(',') + '", want 1.1');
    G.currentModal = 'assignments';
    G.renderAssignmentsModal();
    G.asgnGo('1.3');
    if (G.currentPage !== 'step' || G.currentStep !== '1.3') broken.push('ASSIGNMENTS: clicking a row did not open step 1.3 (' + G.currentPage + ':' + G.currentStep + ')');
  } catch (e) { broken.push('ASSIGNMENTS → ' + ((e && e.message) || e)); }
})();

/* ── Notes and the AI Guide name the page by the name it shows ────
   KB fix A4 (19 Oct 2026, Paul). The shell files a note under notes.step (VARCHAR 20) and asks the module
   for the key and its label; the label must come back the same from the key alone, because that is all a
   note written last week has. Notes written before the fix were filed under the step id. */
(function () {
  try {
    G.data = G.Modules.emptyData();
    const WANT = [
      ['pipeline', null, 'Framework'], ['insights', null, 'Insights'],
      ['phase5', null, 'Step 5.1 · Architecture Dashboard'], ['manage', null, 'Phase 5 · Manage'],
      ['archreview', null, 'Architecture Review'], ['archmap', null, 'Architecture Map'],
      ['archscores', null, 'Architecture Scores'], ['stdData', null, 'Data Domains and Standards'],
      ['dgreview', null, 'Data Governance Review'], ['stdCompute', null, 'Compute Goals and Strategy'],
      ['stdModel', null, 'Model Rules'], ['stdInteg', null, 'Integration Standards'],
      ['stdApp', null, 'Application and Agent Governance'], ['jurmap', null, 'Jurisdiction Map'],
      ['mgmt-hub', null, 'Track Program'], ['reports', null, 'Report Manager'],
      ['outcome', 'out-govframework', null], ['outcome', 'out-readiness', 'Output · Architecture Readiness Report'],
      ['phase', '3', 'Phase 3 · Test'], ['step', '2.5', 'Step 2.5 · Enterprise Architecture Fit']
    ];
    WANT.forEach(([page, arg, want]) => {
      if (arg) G.go(page, arg); else G.go(page);
      try { G.Modules.page(page)(); } catch (e) { }
      const sc = G.notesScope(), back = G.notesScopeLabel(sc.key), ctx = G.coachContext();
      const tag = 'NOTES: ' + page + (arg ? ':' + arg : '');
      if (want && sc.label !== want) broken.push(tag + ' is labelled "' + sc.label + '", want "' + want + '"');
      if (!want && !/^Output · ./.test(sc.label)) broken.push(tag + ' is labelled "' + sc.label + '", want "Output · <its name>"');
      if (back !== sc.label) broken.push(tag + ': the key "' + sc.key + '" reads back as "' + back + '", not "' + sc.label + '"');
      if (String(sc.key).length > 20) broken.push(tag + ': the key "' + sc.key + '" does not fit notes.step (VARCHAR 20)');
      if (page !== 'step' && ctx !== sc.label) broken.push(tag + ': the AI Guide context reads "' + ctx + '", not "' + sc.label + '"');
    });
    [['5.1', 'Step 5.1 · Architecture Dashboard'], ['2.5', 'Step 2.5 · Enterprise Architecture Fit']].forEach(([k, want]) => {
      const got = G.notesScopeLabel(k);
      if (got !== want) broken.push('NOTES: a note written before the fix under "' + k + '" reads "' + got + '", want "' + want + '"');
    });
  } catch (e) { broken.push('NOTES → ' + ((e && e.message) || e)); }
})();

/* ── The shell asks the module, and gets the module's answer ── */
(function () {
  try {
    const rk = G.idToRecordKey('set_aiGuide');
    if (rk !== 'settings') broken.push('idToRecordKey: the shell answered "' + rk + '" for set_aiGuide — the module hook is not consulted');
  } catch (e) { record('idToRecordKey', e); }
})();

/* ── The load-time statements were carried (see CARRY in the port script) ──
   The Jurisdiction group is pushed into every layer schema at load; its
   renderer exists only because that statement came across. */
(function () {
  const prog = fs.readFileSync(path.join(ROOT, 'js', 'modules', MODULE_ID, 'program.js'), 'utf8');
  if (!/groups\.push\(\{id:'jurisdiction'/.test(prog)) broken.push('CARRY: the Jurisdiction group is not pushed into LAYER_SCHEMAS');
  if (typeof G.ARC.jurGroupBlock !== 'function') broken.push('CARRY: jurGroupBlock was not ported');
  ['_dd', 'jurPanMove', 'sizeDiagFullBleed'].forEach(n => {
    if (prog.indexOf(n) < 0) broken.push('CARRY: ' + n + ' is missing');
  });
})();

/* ── Export / import name the module ─────────────────────────── */
(function () {
  try {
    let written = null;
    const realBlob = G.Blob;
    G.Blob = function (parts) { written = (parts || []).join(''); this.parts = parts; };
    G.data = G.Modules.emptyData();
    G.exportState();
    G.Blob = realBlob;
    if (!written) { broken.push('EXPORT: nothing was written'); return; }
    const doc = JSON.parse(written);
    if (doc.module !== MODULE_ID) broken.push('EXPORT: the file names module "' + doc.module + '"');
  } catch (e) { record('EXPORT', e); }
})();

/* ── Every request names this module ───────────────────────── */
const sent = [];
const S = makeSandbox(true);
S.fetch = (url, opts) => {
  let body = null;
  try { body = JSON.parse((opts && opts.body) || 'null'); } catch (e) { }
  sent.push({ url: String(url), method: (opts && opts.method) || 'GET', body: body });
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
  const orgs = S.Store.getOrgs();
  orgs.forEach(o => { if (o.id === S.currentOrgId) o.serverId = S.currentOrgId; });
  S.Store.setOrgs(orgs);
  S.USERS.forEach(u => { if (u.id === S.currentUserId) u.serverId = 'usr_dbcheck'; });
  S.data = S.Modules.emptyData();
  sent.length = 0;
  S.runSeed('sample');
} catch (e) { record('DB seed', e); }

const saves = sent.filter(r => /\/workspace$/.test(r.url) && r.method === 'POST');
if (!saves.length) {
  broken.push('DB: seeding sent no workspace save');
} else {
  saves.forEach(s => {
    if (!s.body) { broken.push('DB: a workspace save carried no body'); return; }
    if (s.body.module !== MODULE_ID) broken.push('DB: a workspace save named module="' + s.body.module + '", expected "' + MODULE_ID + '"');
    if (!s.body.doc || !s.body.doc.dataEstate) broken.push('DB: the saved document is not this program\'s');
  });
}
sent.filter(r => r.body && Object.prototype.hasOwnProperty.call(r.body, 'module'))
  .forEach(r => { if (r.body.module !== MODULE_ID) broken.push('DB: ' + r.method + ' ' + r.url.replace(/^.*\//, '') + ' named module="' + r.body.module + '"'); });

/* ── The neighbour ─────────────────────────────────────────── */
const N = makeSandbox(false, 'pipeline', SHARED_STORE);
load(N, filesFor('pipeline'));
if (!N.Modules || N.Modules.activeId() !== 'pipeline') {
  broken.push('NEIGHBOUR: could not boot the Pipeline for the cross-module check');
} else {
  const nd = N.data || {};
  ['dataEstate', 'integrations', 'aiModels', 'sovProgram', 'deployments'].forEach(k => {
    const v = nd[k];
    const filled = Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0);
    if (filled) broken.push('NEIGHBOUR: the Pipeline\'s workspace picked up this program\'s "' + k + '"');
  });
  [...SHARED_STORE.keys()].filter(k => /org-data/.test(k)).forEach(k => {
    if (!/ai-architecture|pipeline/.test(k)) broken.push('NEIGHBOUR: workspace key "' + k + '" names no module');
  });
}

/* ── Report ───────────────────────────────────────────────────── */
console.log('\n──────────────────────────────────────────');
console.log('AI-Ready Architecture page smoke');
const PER_PASS = pageList().length;
console.log('  pages rendered  :', pagesRendered, '(of ' + ((2 + SEEDS.length) * PER_PASS) + ' — ' + PER_PASS + ' pages × empty / placeholder-era / ' + SEEDS.length + ' seeds)');
console.log('  handlers pulled :', handlersRun);
if (other.size) {
  const total = [...other.values()].reduce((a, b) => a + b, 0);
  console.log('  handler noise   :', total, 'in', other.size, 'kinds (not port failures' + (VERBOSE ? '' : '; -v to list') + ')');
  if (VERBOSE) [...other.entries()].sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log('      ' + String(n).padStart(5) + '  ' + m));
}
if (broken.length) {
  console.log('  BROKEN          :', broken.length);
  console.log('──────────────────────────────────────────');
  broken.slice(0, 80).forEach(b => console.log('  ✗ ' + b));
  if (broken.length > 80) console.log('  … and ' + (broken.length - 80) + ' more');
  process.exit(1);
}
console.log('  ✓ every page renders and every handler resolves');
console.log('  ✓ the seeds, the export and every request name this module only');
console.log('  ✓ the Pipeline\'s workspace is untouched by any of it');
console.log('──────────────────────────────────────────');
