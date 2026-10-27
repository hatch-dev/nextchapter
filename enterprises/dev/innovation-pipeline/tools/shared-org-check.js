#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   shared-org-check.js — one organization, every program
   ─────────────────────────────────────────────────────────────
   The suite runs twelve programs over one shell, and the line
   between what they share and what they own is the whole design
   (js/modules/registry.js). The workspace document is per program.
   The organization is not: one tenant, one team, one theme, one
   company profile, whichever program you happen to be in.

   That line is easy to cross by accident, and crossing it is close to
   invisible — each program looks right on its own, and only someone
   who switches notices. It had been crossed: the Organization Details
   panel read `data.enterprise`, a copy living INSIDE the workspace
   document, so a company profile filled in while running the Pipeline
   showed eight empty fields in Executive Readiness. One organization,
   one database row with every value in it, two different answers.

   So this loads each program in its own sandbox, hands both the SAME
   organization record and their own separate workspaces, opens the
   Organization panel in each, and compares what it shows.

   Everything is stubbed. No server is contacted and no database is
   touched: the API responses below are canned.

   Usage:  node tools/shared-org-check.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;

/* The organization, as the database has it. One row; both programs see it. */
const ORG_ID = 'org_shared_check';
const DB_ORG = {
  id: ORG_ID, name: 'Acme Manufacturing', account_type: 'enterprise',
  industry: 'Industrial', company_size: '201–1,000', region: 'Boston, USA',
  website: 'https://acme.com', ai_maturity: 'Piloting',
  executive_sponsor: 'CEO', objective: 'Quote faster and forecast better, without outrunning our people.',
  users: [{
    public_id: 'usr_owner', name: 'Maria Torres', username: 'maria', role: 'Administrator',
    scope: 'All', email: 'maria@example.com', department: '', is_admin: true
  }]
};

/* The three workspaces, deliberately unequal in the way the real ones were: the
   program the details were filled in from carries a full copy, the other
   carries the `{name}` stub a fresh workspace is stamped with. If the panel
   reads the workspace, the two disagree. If it reads the organization, they
   cannot. */
const DOCS = {
  pipeline: {
    enterprise: {
      name: 'Acme Manufacturing', industry: 'Industrial', size: '201–1,000',
      region: 'Boston, USA', website: 'https://acme.com', maturity: 'Piloting',
      sponsor: 'CEO', objective: 'Quote faster and forecast better, without outrunning our people.'
    },
    ideas: [], selected: [], projects: {}, completedSteps: {}, roster: [], rev: 3
  },
  'exec-readiness': {
    enterprise: { name: 'Acme Manufacturing' },
    leaders: [], assessments: {}, orgChart: [], completedSteps: {}, roster: [], rev: 1
  },
  'ai-governance': {
    enterprise: { name: 'Acme Manufacturing' },
    systems: [], risks: [], regimes: [], completedSteps: {}, roster: [], rev: 1
  }
};

/* ── Stub browser ────────────────────────────────────────────── */
const NUM = { scrollTop: 1, scrollHeight: 1, offsetWidth: 1, offsetHeight: 1, clientWidth: 1, clientHeight: 1, selectionStart: 1, length: 1 };
const STR = { innerHTML: 1, outerHTML: 1, textContent: 1, value: 1, className: 1, id: 1, tagName: 1 };

function el(tag) {
  const t = {
    style: new Proxy({}, { get: (o, k) => (k in o ? o[k] : ''), set: (o, k, v) => { o[k] = v; return true; } }),
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    dataset: {}, children: [], childNodes: [], tagName: (tag || 'div').toUpperCase(), nodeType: 1,
    value: '', innerHTML: '', textContent: '', className: '', id: '', checked: false
  };
  return new Proxy(t, {
    get(o, k) {
      if (typeof k === 'symbol') return o[k];
      if (k in o) return o[k];
      if (NUM[k]) return 0;
      if (STR[k]) return '';
      if (k === 'querySelectorAll') return () => [];
      if (k === 'closest' || k === 'matches' || k === 'getAttribute') return () => null;
      if (k === 'getBoundingClientRect') return () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
      if (k === 'appendChild' || k === 'insertBefore' || k === 'replaceChild') return a => a;
      if (k === 'parentNode' || k === 'parentElement') return null;
      return () => el();
    },
    set(o, k, v) { o[k] = v; return true; }
  });
}
function storage(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); }, clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null,
    get length() { return m.size; }
  };
}
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

/* ── One program, loaded and signed in ─────────────────────────
   Served mode (http:), because that is what makes Store keep an organization
   record at all — server.enabled is read from location.protocol as the scripts
   load. Every request is answered from the constants above. */
function boot(moduleId) {
  const html = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
  const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));
  const files = (html.match(/<script\s+src="([^"]+)"/g) || [])
    .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
    .filter(s => !/^https?:/.test(s))
    .map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
  const mod = (CATALOGUE.roles || []).reduce((f, r) => f || (r.modules || []).filter(m => m.id === moduleId)[0], null);
  const at = files.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  files.splice(at >= 0 ? at + 1 : 0, 0,
    ...(mod.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p)));

  const byId = Object.create(null);
  const search = '?module=' + moduleId;
  const sandbox = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    /* Already signed in: the org is current and the session names its owner. */
    localStorage: storage({
      'pipeline-current-org': ORG_ID,
      'pipeline-remember': JSON.stringify({ orgId: ORG_ID, userId: 'usr_owner' })
    }),
    sessionStorage: storage({ 'pipeline-session': JSON.stringify({ orgId: ORG_ID, userId: 'usr_owner' }) }),
    document: {
      getElementById(id) { if (!byId[id]) { byId[id] = el(); byId[id].id = id; } return byId[id]; },
      querySelector: () => el(), querySelectorAll: () => [],
      createElement: t => el(t), createDocumentFragment: () => el(), createTextNode: () => el(),
      addEventListener() { }, removeEventListener() { }, readyState: 'complete', activeElement: null,
      body: el('body'), documentElement: el('html'), head: el('head'), title: ''
    },
    location: {
      href: 'http://localhost/apps/' + search, protocol: 'http:', host: 'localhost', hostname: 'localhost',
      port: '', pathname: '/apps/', search: search, hash: '', origin: 'http://localhost',
      assign() { }, replace() { }, reload() { }
    },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, length: 1, state: null },
    navigator: { userAgent: 'shared-org-check', language: 'en-US', languages: ['en-US'], onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() { } },
    Blob: function () { },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    addEventListener() { }, removeEventListener() { }, open: () => null, scrollTo() { }, print() { },
    confirm: () => true, alert() { }, prompt: () => null,
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    FileReader: function () { this.readAsText = () => { }; this.addEventListener = () => { }; },
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };
  /* The canned API. GET /organizations hands over the one shared record; GET
     /workspace hands over the document for the module named in the query —
     which is the point: two programs, two documents, one organization. */
  sandbox.fetch = (url, opts) => {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    let payload = { success: true, data: {} };
    if (/\/organizations(\?|$)/.test(u) && method === 'GET') {
      payload = { success: true, data: { organizations: [JSON.parse(JSON.stringify(DB_ORG))] } };
    } else if (/\/workspace\?/.test(u)) {
      const m = /[?&]module=([^&]+)/.exec(u);
      const which = m ? decodeURIComponent(m[1]) : 'pipeline';
      const doc = DOCS[which];
      payload = { success: true, data: doc ? { doc: JSON.parse(JSON.stringify(doc)), rev: doc.rev } : { doc: null, rev: 0 } };
    } else if (/\/workspace\/rev/.test(u)) {
      payload = { success: true, data: { rev: 1 } };
    }
    return settled('ok', { status: 200, ok: true, json: () => settled('ok', payload) });
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;

  const problems = [];
  files.forEach(p => {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: path.relative(ROOT, p).replace(/\\/g, '/') }); }
    catch (e) { problems.push('load ' + path.basename(p) + ': ' + ((e && e.message) || e)); }
  });
  return { G: sandbox, problems };
}

/* ── Run ───────────────────────────────────────────────────────── */
/* Every Enterprise program that has its own code. A program is added here the
   day it goes live: the organization panel is the one surface all of them
   share, so a new program reading its own workspace copy instead of the
   organization record is a regression this is the only thing watching for. */
const PROGRAMS = ['pipeline', 'exec-readiness', 'ai-governance'];
/* The key that proves a program loaded ITS OWN document rather than another's.
   Without it the comparison below could pass with all three on one workspace. */
const OWN_KEY = { pipeline: 'ideas', 'exec-readiness': 'leaders', 'ai-governance': 'systems' };
const FIELDS = ['name', 'industry', 'size', 'region', 'website', 'maturity', 'sponsor', 'objective'];
const seen = {};
let failed = [];

PROGRAMS.forEach(id => {
  const { G, problems } = boot(id);
  problems.forEach(p => failed.push(id + ' — ' + p));
  if (!G.Modules || G.Modules.activeId() !== id) { failed.push(id + ' — wrong active module: ' + (G.Modules && G.Modules.activeId())); return; }
  if (typeof G.orgDetails !== 'function') { failed.push(id + ' — orgDetails() is missing'); return; }

  /* Confirm the two really are on different documents, or the comparison below
     proves nothing. */
  const doc = G.data || {};
  const distinct = doc[OWN_KEY[id]] !== undefined;
  if (!distinct) failed.push(id + ' — did not load its own workspace document');

  seen[id] = G.orgDetails();
  if (VERBOSE) {
    console.log('\n' + id);
    FIELDS.forEach(f => console.log('   ' + f.padEnd(10), JSON.stringify(seen[id][f])));
  }
});

FIELDS.forEach(f => {
  const want = f === 'size' ? DB_ORG.company_size
    : f === 'maturity' ? DB_ORG.ai_maturity
      : f === 'sponsor' ? DB_ORG.executive_sponsor
        : DB_ORG[f];
  PROGRAMS.forEach(id => {
    const got = (seen[id] || {})[f];
    if (got !== want) failed.push(id + ' shows ' + f + ' = ' + JSON.stringify(got) + ', the organization has ' + JSON.stringify(want));
  });
});

console.log('\n──────────────────────────────────────────');
console.log('One organization, every program');
console.log('  fields compared :', FIELDS.length, 'across ' + PROGRAMS.length + ' programs');
if (failed.length) {
  console.log('  MISMATCHED      :', failed.length);
  console.log('──────────────────────────────────────────');
  failed.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('  ✓ both programs show the organization\'s own details');
console.log('──────────────────────────────────────────');
