#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   session-across-modules.js — one sign-in, every program
   ─────────────────────────────────────────────────────────────
   Switching program is a full page load (js/modules/registry.js —
   two programs' code must never be live at once). The session is
   meant to carry across it invisibly. Twice now it has not, and both
   times for the same underlying reason: something that belongs to the
   ORGANIZATION was being read out of the WORKSPACE, and workspaces are
   per program.

   The team is the case here. One row per person in `users`, org-level
   — but every workspace also keeps a roster copy, and each copy used
   to mint its OWN local id for the same colleague:

       exec-readiness  john = tiilm46q   (serverId usr_450dad…)
       pipeline        john = 5eiq87w5   (serverId usr_450dad…)

   The session stored that local id, so it resolved in exactly one
   program and the other showed the sign-in screen. It missed review
   because the account most people test with is the owner, whose local
   id IS their database id — created that way by finishSetup. Every
   colleague added afterwards had the bug; the owner never did.

   So this signs in as each member and opens each program, over two
   arrangements:

     divergent   both workspaces exist and key the same people
                 differently — the state that shipped
     unopened    the target program has no workspace at all, which is
                 what the switcher offers for a program never opened

   Everything is stubbed; no server is contacted, no database touched.

   Usage:  node tools/session-across-modules.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;

const ORG_ID = 'org_session_check';
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

/* The owner is keyed by their database id in both — that is what finishSetup
   does, and why the bug hid. The member is keyed differently in each, which is
   what every "add team member" produced. */
function rosterFor(memberLocalId) {
  return [
    { id: OWNER, serverId: OWNER, name: 'Maria Torres', username: 'maria', role: 'Administrator', scope: 'All', email: 'maria@example.com', passcode: '1234', admin: true, initials: 'MT', color: '#B8892A' },
    { id: memberLocalId, serverId: MEMBER, name: 'John Bell', username: 'john', role: 'Operations Lead', scope: 'All', email: 'john@example.com', passcode: '1234', admin: false, initials: 'JB', color: '#1B6B5A' }
  ];
}
const DOCS = {
  pipeline: { enterprise: { name: 'Acme Manufacturing' }, ideas: [], selected: [], projects: {}, completedSteps: {}, roster: rosterFor('5eiq87w5'), rev: 3 },
  'exec-readiness': { enterprise: { name: 'Acme Manufacturing' }, leaders: [], assessments: {}, orgChart: [], completedSteps: {}, roster: rosterFor('tiilm46q'), rev: 2 },
  /* A third local id for the same colleague, for the same reason the other two
     differ: each workspace minted its own when the member was added there. */
  'ai-governance': { enterprise: { name: 'Acme Manufacturing' }, systems: [], risks: [], regimes: [], completedSteps: {}, roster: rosterFor('q9wq3f2k'), rev: 1 }
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

/* Open `moduleId` carrying `session`, and report who the app decided we are. */
function open(moduleId, session, docs) {
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
  const G = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    localStorage: storage({ 'pipeline-current-org': ORG_ID }),
    sessionStorage: storage({ 'pipeline-session': JSON.stringify(session) }),
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
    navigator: { userAgent: 'session-check', language: 'en-US', languages: ['en-US'], onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() { } }, Blob: function () { },
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
  G.fetch = (url) => {
    const u = String(url);
    /* GET /session (Directive 2 Oct 2026, Part 6): the server confirms the session the cookie carries. */
    if (/\/session$/.test(u)) return settled('ok', { status: 200, ok: true, json: () => settled('ok', { success: true, data: { ok: true, orgId: ORG_ID, userId: session.serverId || session.userId, mustChange: false } }) });
    let payload = { success: true, data: {} };
    if (/\/organizations(\?|$)/.test(u)) {
      payload = { success: true, data: { organizations: [JSON.parse(JSON.stringify(DB_ORG))] } };
    } else if (/\/workspace\?/.test(u)) {
      const m = /[?&]module=([^&]+)/.exec(u);
      const doc = docs[m ? decodeURIComponent(m[1]) : 'pipeline'];
      payload = { success: true, data: doc ? { doc: JSON.parse(JSON.stringify(doc)), rev: doc.rev } : { doc: null, rev: 0 } };
    } else if (/\/workspace\/rev/.test(u)) {
      payload = { success: true, data: { rev: 1 } };
    }
    return settled('ok', { status: 200, ok: true, json: () => settled('ok', payload) });
  };
  vm.createContext(G);
  G.window = G; G.self = G; G.globalThis = G;
  const loadErrors = [];
  files.forEach(p => {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), G, { filename: path.relative(ROOT, p).replace(/\\/g, '/') }); }
    catch (e) { loadErrors.push(path.basename(p) + ': ' + ((e && e.message) || e)); }
  });
  const who = (typeof G.getCurrentUser === 'function' && G.getCurrentUser()) || null;
  return { loadErrors, signedIn: !!who, serverId: who && who.serverId, name: who && who.name };
}

/* ── Run ───────────────────────────────────────────────────────── */
const MODULES = ['pipeline', 'exec-readiness', 'ai-governance'];
const failures = [];

function scenario(label, docs) {
  MODULES.forEach(from => {
    /* The session the app writes on sign-in inside `from`: that workspace's
       local id for the person, plus their database id. */
    [['owner', OWNER], ['member', MEMBER]].forEach(([role, serverId]) => {
      const local = (docs[from] ? docs[from].roster : rosterFor('x'))
        .filter(u => u.serverId === serverId)[0];
      const session = { orgId: ORG_ID, userId: local ? local.id : serverId, serverId: serverId };
      MODULES.forEach(to => {
        const r = open(to, session, docs);
        r.loadErrors.forEach(e => failures.push(label + ' ' + to + ' — load ' + e));
        const ok = r.signedIn && r.serverId === serverId;
        if (VERBOSE || !ok) {
          console.log('  ' + (label + ' · ' + role + ': ' + from + ' → ' + to).padEnd(52)
            + (ok ? 'signed in as ' + r.name : (r.signedIn ? 'WRONG PERSON: ' + r.name : 'SIGN-IN SCREEN')));
        }
        if (!ok) failures.push(label + ' · ' + role + ': ' + from + ' → ' + to
          + (r.signedIn ? ' signed in as the wrong person' : ' dropped to the sign-in screen'));
      });
    });
  });
}

console.log('\nchecking…');
scenario('divergent', DOCS);
/* The switcher offers programs this organization has never opened. Arriving at
   one means an empty workspace with no roster at all, and the session has to
   survive that too — it is rebuilt from the organization record. */
scenario('unopened', { pipeline: DOCS.pipeline });

console.log('\n──────────────────────────────────────────');
console.log('One sign-in, every program');
console.log('  crossings tested:', MODULES.length * 2 * MODULES.length * 2);
if (failures.length) {
  console.log('  BROKEN          :', failures.length);
  console.log('──────────────────────────────────────────');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('  ✓ the session survives every program switch, as the right person');
console.log('──────────────────────────────────────────');
