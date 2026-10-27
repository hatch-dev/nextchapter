#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   fresh-device-signin.js — signing in where this browser has
   never been, without deleting the team's program
   ─────────────────────────────────────────────────────────────
   The reported fault was "someone logs in and the assessment data is
   gone". It was not the assessment, and it was not one program: it was
   the shell, and it took the whole document with it in every module.

   THE CHAIN, in order.

     1. Every workspace request carries an `actor` — READS INCLUDED —
        and the server refuses one without it (requireOrgMember). The
        actor came from getCurrentUser(), or failing that from a roster
        already on this disk.
     2. On a browser that has never opened this organization — a new
        device, a private window, cleared storage, a colleague's first
        visit — neither exists at sign-in, and neither exists on the
        load straight after it either: Store.ready() fetches the
        workspace BEFORE bootApp() restores the session.
     3. So the fetch went out with no actor and came back 403. The
        client cannot tell that from a dropped connection, so the app
        came up on an EMPTY document with the offline banner showing.
     4. bootApp() then writes — assignmentsLoad() sets data.assigns and
        saves on every single load — and 600ms later flushOrg posted
        that empty document with `base_rev: null`. The server treats a
        null base_rev as "no basis to compare" and accepts it whole
        (Models\Workspace::save), which is what makes a first write and
        the sample-data seed possible.

     The team's program — the Assessment Battery, the risk register,
     every answer, every completion flag — replaced by {} in one
     request, by someone who had done nothing but log in.

   This drives the real shell over a stubbed API that enforces both
   server rules that matter: a workspace read with no actor is 403, and
   a POST with a null base_rev overwrites unconditionally. Then it
   checks the two things that must be true of the load after a sign-in
   on a fresh device, for every program:

     · the workspace is actually READ (the request carried an actor), so
       the app comes up on the team's document rather than an empty one;
     · whatever the app writes during boot, what the server still holds
       afterwards contains the work that was there before.

   Everything is stubbed; no server is contacted, no database touched.

   Usage:  node tools/fresh-device-signin.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;

const ORG_ID = 'org_fresh_device';
const OWNER = 'usr_owner_pub';
const MEMBER = 'usr_member_pub';

const DB_ORG = {
  id: ORG_ID, name: 'Acme Manufacturing', account_type: 'enterprise',
  industry: 'Industrial', company_size: '201–1,000', region: 'Boston, USA',
  website: 'https://acme.com', ai_maturity: 'Piloting', executive_sponsor: 'CEO',
  objective: 'Lead AI well.',
  users: [
    { public_id: OWNER, name: 'Maria Torres', username: 'maria', role: 'Administrator', scope: 'All', email: 'maria@example.com', department: '', is_admin: true },
    { public_id: MEMBER, name: 'John Bell', username: 'john', role: 'Operations Lead', scope: 'All', email: 'john@example.com', department: '', is_admin: false }
  ]
};

/* Every workspace keys the team by the database's own ids, which is what the
   current code does — the divergent-local-id case is covered by
   session-across-modules.js and is not what this is about. */
const ROSTER = [
  { id: OWNER, serverId: OWNER, name: 'Maria Torres', username: 'maria', role: 'Administrator', scope: 'All', email: 'maria@example.com', admin: true, initials: 'MT', color: '#B8892A' },
  { id: MEMBER, serverId: MEMBER, name: 'John Bell', username: 'john', role: 'Operations Lead', scope: 'All', email: 'john@example.com', admin: false, initials: 'JB', color: '#1B6B5A' }
];

/* One real answer per program, in the container that program actually keeps its
   assessment in, so "the work survived" is asserted against the document each
   module writes rather than a shape invented here. */
const WORK = {
  'ai-governance': ['assessmentBattery', { aiExposure: { departments: 'Sales, IT, Production' } }],
  'pipeline': ['assessments', { 0: { priority: 4, risk: 3, value: 5 } }],
  'exec-readiness': ['assessments', { u1: { q1: 4, q2: 5 } }],
  'decision-lab': ['decisions', [{ id: 'dec_1', title: 'Close the Cork plant' }]],
  'ethics-engine': ['decisions', [{ id: 'dec_1', title: 'Ship the hiring model' }]]
};

function docFor(moduleId) {
  const [key, value] = WORK[moduleId];
  const d = { enterprise: { name: 'Acme Manufacturing' }, roster: JSON.parse(JSON.stringify(ROSTER)), completedSteps: { '1.1': true }, rev: 7 };
  d[key] = JSON.parse(JSON.stringify(value));
  return d;
}

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

/* ── The load that follows a sign-in on a device with nothing on it ──
   localStorage holds only the org the sign-in just selected; the session record
   is what auth.js wrote a moment earlier — the member's DATABASE id, with no
   serverId beside it, because USERS still held the placeholder team when
   Auth.sessionRecord() was asked. */
function open(moduleId, memberPublicId) {
  const html = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
  const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));
  const files = (html.match(/<script\s+src="([^"]+)"/g) || [])
    .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
    .filter(s => !/^https?:/.test(s))
    .map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
  const mod = (CATALOGUE.roles || []).reduce((f, r) => f || (r.modules || []).filter(m => m.id === moduleId)[0], null);
  if (!mod) throw new Error('no such module in the catalogue: ' + moduleId);
  const at = files.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  files.splice(at >= 0 ? at + 1 : 0, 0,
    ...(mod.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p)));

  /* The server, reduced to the two rules this is about. */
  const server = { doc: docFor(moduleId), rev: 7 };
  const log = { reads: 0, readsWithoutActor: 0, writes: [] };

  const byId = Object.create(null);
  const search = '?module=' + moduleId;
  const timers = [];
  let timerSeq = 0;

  const G = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    /* A device that has never opened this organization: no mirror, no baseline,
       no roster, no remembered account. Only the org the sign-in just chose. */
    localStorage: storage({ 'pipeline-current-org': ORG_ID }),
    sessionStorage: storage({ 'pipeline-session': JSON.stringify({ orgId: ORG_ID, userId: memberPublicId }) }),
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
    navigator: { userAgent: 'fresh-device', language: 'en-US', languages: ['en-US'], onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() { } }, Blob: function () { },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    addEventListener() { }, removeEventListener() { }, open: () => null, scrollTo() { }, print() { },
    confirm: () => true, alert() { }, prompt: () => null,
    /* Real timers, drained on demand: the whole fault lives in the debounced
       flush, so a setTimeout that never fires would test nothing. The 5-second
       poll is deliberately NOT run — it fires long after the 600ms flush, and
       the question is what the flush does on its own. */
    setTimeout: (fn, ms) => { timers.push({ id: ++timerSeq, fn, ms: ms || 0 }); return timerSeq; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: () => ++timerSeq, clearInterval() { },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    FileReader: function () { this.readAsText = () => { }; this.addEventListener = () => { }; },
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };

  G.fetch = (url, init) => {
    const u = String(url);
    const body = init && init.body ? JSON.parse(init.body) : null;
    /* GET /session (Directive 2 Oct 2026, Part 6): the server confirms the session the cookie carries. */
    if (/\/session$/.test(u) &&!(init && init.method === 'POST')) return settled('ok', { status: 200, ok: true, json: () => settled('ok', { success: true, data: { ok: true, orgId: ORG_ID, userId: memberPublicId, mustChange: false } }) });
    let status = 200, payload = { success: true, data: {} };

    if (/\/organizations(\?|$)/.test(u)) {
      payload = { success: true, data: { organizations: [JSON.parse(JSON.stringify(DB_ORG))] } };

    } else if (/\/workspace\/patch/.test(u)) {
      /* A patch can only be built from a baseline, which can only come from a
         read — so reaching here at all means the document WAS read. It writes
         the named sections and nothing else, which is safe by construction. */
      log.writes.push({ kind: 'patch', sections: Object.keys(body.sections || {}) });
      Object.keys(body.sections || {}).forEach(k => { server.doc[k] = body.sections[k]; });
      (body.removed || []).forEach(k => { delete server.doc[k]; });
      server.rev += 1;
      payload = { success: true, data: { rev: server.rev } };

    } else if (/\/workspace\/rev/.test(u)) {
      if (!/[?&]actor=/.test(u)) { status = 403; payload = { success: false, reason: 'not-a-member' }; }
      else payload = { success: true, data: { rev: server.rev } };

    } else if (/\/workspace\?/.test(u)) {
      log.reads += 1;
      /* Core\Controller::requireOrgMember. A read with no actor is refused, and
         the client cannot tell that from being offline. */
      if (!/[?&]actor=/.test(u)) {
        log.readsWithoutActor += 1;
        status = 403; payload = { success: false, reason: 'not-a-member' };
      } else {
        payload = { success: true, data: { doc: JSON.parse(JSON.stringify(server.doc)), rev: server.rev } };
      }

    } else if (/\/workspace$/.test(u) || /\/workspace(\?|$)/.test(u)) {
      // Whole-document POST. Models\Workspace::save.
      const baseRev = (body && Object.prototype.hasOwnProperty.call(body, 'base_rev')) ? body.base_rev : null;
      log.writes.push({ kind: 'whole', baseRev: baseRev });
      if (baseRev !== null && baseRev !== server.rev) {
        status = 409;
        payload = { success: false, stale: true, data: { rev: server.rev, doc: JSON.parse(JSON.stringify(server.doc)) } };
      } else {
        server.doc = JSON.parse(JSON.stringify(body.doc));   // accepted whole
        server.rev += 1;
        payload = { success: true, data: { rev: server.rev } };
      }
    }
    return settled('ok', { status, ok: status < 400, json: () => settled('ok', payload) });
  };

  vm.createContext(G);
  G.window = G; G.self = G; G.globalThis = G;
  const loadErrors = [];
  files.forEach(p => {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), G, { filename: path.relative(ROOT, p).replace(/\\/g, '/') }); }
    catch (e) { loadErrors.push(path.basename(p) + ': ' + ((e && e.message) || e)); }
  });

  /* Everything the app queued during boot, run in order — the debounced flush
     among it. Bounded, because a flush can legitimately queue another. */
  const drain = () => {
    for (let guard = 0; guard < 200 && timers.length; guard++) {
      const t = timers.shift();
      try { t.fn(); } catch (e) { loadErrors.push('timer: ' + ((e && e.message) || e)); }
    }
  };
  drain();

  /* And one ordinary edit, saved the way every screen in every program saves —
     because on the broken build it was an edit exactly like this (or the
     assignments load, which does it unprompted) that carried the empty
     document to the server. */
  try {
    if (!G.data.notes) G.data.notes = [];
    G.data.notes.push({ id: 'n1', text: 'first note from the new device' });
    G.saveData();
  } catch (e) { loadErrors.push('edit: ' + ((e && e.message) || e)); }
  drain();

  const who = (typeof G.getCurrentUser === 'function' && G.getCurrentUser()) || null;
  return { loadErrors, log, server, signedIn: !!who, name: who && who.name, live: G.data };
}

/* ── Run ───────────────────────────────────────────────────────── */
const MODULES = Object.keys(WORK);
const failures = [];
let checks = 0;

function check(label, ok, detail) {
  checks += 1;
  if (VERBOSE || !ok) console.log('  ' + label.padEnd(64) + (ok ? 'ok' : 'FAILED — ' + detail));
  if (!ok) failures.push(label + ' — ' + detail);
}

console.log('\nchecking…');
MODULES.forEach(moduleId => {
  [['owner', OWNER], ['member', MEMBER]].forEach(([role, publicId]) => {
    const r = open(moduleId, publicId);
    const tag = moduleId + ' · ' + role;
    r.loadErrors.forEach(e => failures.push(tag + ' — load ' + e));

    const [key] = WORK[moduleId];
    const stored = r.server.doc[key];
    const kept = Array.isArray(stored) ? stored.length > 0 : !!(stored && Object.keys(stored).length);

    check(tag + ': signs in', r.signedIn, 'landed on the sign-in screen');
    check(tag + ': the workspace read carries an actor', r.log.readsWithoutActor === 0,
      r.log.readsWithoutActor + ' of ' + r.log.reads + ' reads went out with no actor and were refused');
    check(tag + ': the app opens on the team document', !!(r.live && Object.keys(r.live[key] || {}).length),
      'the program came up with an empty ' + key);
    check(tag + ': the work is still on the server', kept,
      'the stored ' + key + ' was replaced with ' + JSON.stringify(stored));
    check(tag + ': no blind whole-document write', !r.log.writes.some(w => w.kind === 'whole' && w.baseRev === null),
      'posted the whole document with base_rev null over a workspace it had never read');
  });
});

console.log('\n──────────────────────────────────────────');
console.log('Signing in on a device that has never seen this organization');
console.log('  programs checked:', MODULES.length, '· accounts: owner, member');
console.log('  assertions      :', checks);
if (failures.length) {
  console.log('  BROKEN          :', failures.length);
  console.log('──────────────────────────────────────────');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('  ✓ the workspace is read, not guessed at — every request names its actor');
console.log('  ✓ a first sign-in never overwrites the program it could not read');
console.log('──────────────────────────────────────────');
