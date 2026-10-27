#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   concurrent-members.js — three people in one program, and the
   member whose screen stopped moving
   ─────────────────────────────────────────────────────────────
   The reported fault was "three users are editing at the same time and one
   user's data is not updating". It was not the merge, which is right, and not
   the notices, which were telling the truth. It was the rev watermark.

   THE CHAIN, in order.

     1. The change poll is cheap on purpose: GET /workspace/rev returns one
        number, and the document is only downloaded when that number is HIGHER
        than the rev this browser holds (Store.checkRemote).
     2. Ordinary saves keep that number honest. A whole-document POST carries
        base_rev and the server refuses it with a 409 unless it is current, so a
        200 means nothing happened underneath us.
     3. A PATCH carries no base_rev. It is applied to whatever is stored and is
        never refused as stale — that is the whole point of it, and it is what
        lets two people write different sections without merging
        (WorkspaceController::patch).
     4. So the rev a patch returns counts every commit made since we last read,
        not only ours. The client stamped it as "I have seen everything up to
        here" anyway.

     A colleague commits at rev 11. Within the same five seconds this member
     saves his own, unrelated section; the patch lands at rev 12 and he records
     12. His poll then asks for ever, and for ever gets 12 back, and 12 is not
     higher than 12. The colleague's rev-11 work is never downloaded. The member
     who saved last sits on the old value with the poll running and finding
     nothing — until somebody else happens to write again.

     And the baseline written beside that rev claims the server holds HIS copy
     of the section he never pulled, so the next patch that touches it sends
     that stale copy back over their work. That is the same event seen from the
     other side, and it is what puts "your saved change was replaced" on
     everybody else's screen.

   This drives the real shell over a stubbed API that enforces the two server
   rules that matter: a patch is applied and never refused, and every accepted
   write moves the rev by exactly one (Models\Workspace::patch). Then it checks
   the three things that must be true when a save steps over somebody.

   Everything is stubbed; no server is contacted, no database touched.

   Usage:  node tools/concurrent-members.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;
const MODULE = 'pipeline';

const ORG_ID = 'org_concurrent';
const ME = 'usr_navdeep_pub';
const THEM = 'usr_manpreet_pub';

const DB_ORG = {
  id: ORG_ID, name: 'Acme Manufacturing', account_type: 'enterprise',
  industry: 'Industrial', company_size: '201-1,000', region: 'Boston, USA',
  website: 'https://acme.com', ai_maturity: 'Piloting', executive_sponsor: 'CEO',
  objective: 'Lead AI well.',
  users: [
    { public_id: ME, name: 'Navdeep Singh', username: 'navdeep', role: 'Administrator', scope: 'All', email: 'navdeep@example.com', department: '', is_admin: true },
    { public_id: THEM, name: 'Manpreet Kaur', username: 'manpreet', role: 'Operations Lead', scope: 'All', email: 'manpreet@example.com', department: '', is_admin: false }
  ]
};
const ROSTER = [
  { id: ME, serverId: ME, name: 'Navdeep Singh', username: 'navdeep', role: 'Administrator', scope: 'All', email: 'navdeep@example.com', admin: true, initials: 'NS', color: '#B8892A' },
  { id: THEM, serverId: THEM, name: 'Manpreet Kaur', username: 'manpreet', role: 'Operations Lead', scope: 'All', email: 'manpreet@example.com', admin: false, initials: 'MK', color: '#1B6B5A' }
];

const MINE_FIRST = 'the Mission as it stood when everyone loaded';
const THEIRS = 'THE MISSION MANPREET WROTE';

function startingDoc() {
  return {
    enterprise: { name: 'Acme Manufacturing' },
    roster: JSON.parse(JSON.stringify(ROSTER)),
    completedSteps: { '1.1': true },
    purpose: { mission: MINE_FIRST, goals: 'g', frictions: 'f' },
    knowledge: { tools: '' },
    rev: 7
  };
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

/* ── One member's browser, signed in and holding the document ── */
function open() {
  const html = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
  const CATALOGUE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'catalogue.json'), 'utf8'));
  const files = (html.match(/<script\s+src="([^"]+)"/g) || [])
    .map(t => t.match(/src="([^"]+)"/)[1].split('?')[0])
    .filter(s => !/^https?:/.test(s))
    .map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p));
  const mod = (CATALOGUE.roles || []).reduce((f, r) => f || (r.modules || []).filter(m => m.id === MODULE)[0], null);
  if (!mod) throw new Error('no such module in the catalogue: ' + MODULE);
  const at = files.findIndex(p => p.replace(/\\/g, '/').endsWith('js/modules/boot.js'));
  files.splice(at >= 0 ? at + 1 : 0, 0,
    ...(mod.scripts || []).map(s => path.join(ROOT, s)).filter(p => fs.existsSync(p)));

  /* The server, reduced to the rules this is about. */
  const server = { doc: startingDoc(), rev: 10 };
  const log = { docReads: 0, revReads: 0, writes: [] };

  const byId = Object.create(null);
  const search = '?module=' + MODULE;
  const timers = [];
  let timerSeq = 0;

  const G = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    localStorage: storage({ 'pipeline-current-org': ORG_ID }),
    sessionStorage: storage({ 'pipeline-session': JSON.stringify({ orgId: ORG_ID, userId: ME }) }),
    document: {
      getElementById(id) { if (!byId[id]) { byId[id] = el(); byId[id].id = id; } return byId[id]; },
      querySelector: () => el(), querySelectorAll: () => [],
      createElement: t => el(t), createDocumentFragment: () => el(), createTextNode: () => el(),
      addEventListener() { }, removeEventListener() { }, readyState: 'complete', activeElement: null,
      hidden: false, body: el('body'), documentElement: el('html'), head: el('head'), title: ''
    },
    location: {
      href: 'http://localhost/apps/' + search, protocol: 'http:', host: 'localhost', hostname: 'localhost',
      port: '', pathname: '/apps/', search: search, hash: '', origin: 'http://localhost',
      assign() { }, replace() { }, reload() { }
    },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, length: 1, state: null },
    navigator: { userAgent: 'concurrent-members', language: 'en-US', languages: ['en-US'], onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() { } }, Blob: function () { },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    addEventListener() { }, removeEventListener() { }, open: () => null, scrollTo() { }, print() { },
    confirm: () => true, alert() { }, prompt: () => null,
    /* Real timers, drained on demand: the flush is debounced and the whole
       question is what it does when it lands. */
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
    let status = 200, payload = { success: true, data: {} };

    if (/\/organizations(\?|$)/.test(u)) {
      payload = { success: true, data: { organizations: [JSON.parse(JSON.stringify(DB_ORG))] } };

    } else if (/\/workspace\/patch/.test(u)) {
      /* Models\Workspace::patch. Applied to whatever is stored, never refused as
         stale, and the rev moves by exactly one. */
      log.writes.push({ kind: 'patch', sections: Object.keys(body.sections || {}) });
      Object.keys(body.sections || {}).forEach(k => { server.doc[k] = body.sections[k]; });
      (body.removed || []).forEach(k => { delete server.doc[k]; });
      server.rev += 1;
      payload = { success: true, data: { rev: server.rev } };

    } else if (/\/workspace\/rev/.test(u)) {
      log.revReads += 1;
      payload = { success: true, data: { rev: server.rev } };

    } else if (/\/workspace\?/.test(u)) {
      log.docReads += 1;
      payload = { success: true, data: { doc: JSON.parse(JSON.stringify(server.doc)), rev: server.rev } };

    } else if (/\/workspace(\?|$)/.test(u)) {
      const baseRev = (body && Object.prototype.hasOwnProperty.call(body, 'base_rev')) ? body.base_rev : null;
      log.writes.push({ kind: 'whole', baseRev: baseRev });
      if (baseRev !== null && baseRev !== server.rev) {
        status = 409;
        payload = { success: false, stale: true, data: { rev: server.rev, doc: JSON.parse(JSON.stringify(server.doc)) } };
      } else {
        server.doc = JSON.parse(JSON.stringify(body.doc));
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

  const drain = () => {
    for (let guard = 0; guard < 200 && timers.length; guard++) {
      const t = timers.shift();
      try { t.fn(); } catch (e) { loadErrors.push('timer: ' + ((e && e.message) || e)); }
    }
  };
  drain();

  return { G, log, server, drain, loadErrors };
}

/* ── Run ───────────────────────────────────────────────────────── */
const failures = [];
let checks = 0;
function check(label, ok, detail) {
  checks += 1;
  if (VERBOSE || !ok) console.log('  ' + label.padEnd(70) + (ok ? 'ok' : 'FAILED — ' + detail));
  if (!ok) failures.push(label + ' — ' + detail);
}

console.log('\nchecking…');
const r = open();
const { G, log, server, drain } = r;
r.loadErrors.forEach(e => failures.push('load ' + e));

/* Everything below is one member's browser. Boot read the workspace and — like
   every load, because assignmentsLoad() saves unprompted — wrote to it too, so
   the rev has already moved by the time anybody types. Whatever it stands at
   NOW is what this browser has seen, which is the only starting point worth
   measuring a gap from. */
const settledIn = !!(G.data && G.data.purpose);
check('the program opens on the team document', settledIn,
  'came up without a purpose section');
const afterBoot = server.rev;

/* 1. A colleague commits. The server moves on by one and this browser, which
      polls on a five-second clock, has not looked yet. */
server.doc.purpose = { mission: THEIRS, goals: 'g', frictions: 'f' };
server.rev = afterBoot + 1;

/* 2. Inside that window this member edits a DIFFERENT section and it flushes.
      The patch lands at rev 12, stepping straight over rev 11. */
const beforeReads = log.docReads;
try {
  if (!G.data.knowledge) G.data.knowledge = {};
  G.data.knowledge.tools = 'typing over here, nowhere near their section';
  G.saveData();
} catch (e) { failures.push('edit: ' + ((e && e.message) || e)); }
drain();

const patched = log.writes.some(w => w.kind === 'patch');
check('an edit to one section is sent as a patch', patched,
  'expected a patch, got ' + JSON.stringify(log.writes));
check('a patch that stepped over a commit is followed by a read', log.docReads > beforeReads,
  'the rev went ' + afterBoot + ' → ' + server.rev + ' and nothing was downloaded');
check('so the member who saved last holds their colleague\'s work',
  ((G.data || {}).purpose || {}).mission === THEIRS,
  'still showing ' + JSON.stringify(((G.data || {}).purpose || {}).mission));

/* 3. The poll must then find nothing left to do — a browser that is genuinely
      up to date does not re-download on every tick. */
const beforeQuiet = log.docReads;
G.Store.checkRemote(); drain();
G.Store.checkRemote(); drain();
check('and the poll settles instead of re-reading', log.docReads === beforeQuiet,
  log.docReads - beforeQuiet + ' extra document reads from two quiet polls');

/* 4. A save with nobody else writing costs no extra read: the rev moved by one,
      which is this browser's own write and nothing else. */
const beforeSolo = log.docReads;
try { G.data.knowledge.tools = 'more typing'; G.saveData(); } catch (e) { failures.push('edit: ' + ((e && e.message) || e)); }
drain();
check('a save that stepped over nobody costs no extra read', log.docReads === beforeSolo,
  log.docReads - beforeSolo + ' document reads for a contiguous save');

/* 5. The other side of it. This member now edits the very section he was stale
      on. His baseline has to be right, or he patches his old copy back over
      their work — with no 409 to stop him, because a patch is never refused. */
try {
  G.data.purpose.mission = ((G.data || {}).purpose || {}).mission + ' + and a line from Navdeep';
  G.saveData();
} catch (e) { failures.push('edit: ' + ((e && e.message) || e)); }
drain();
check('a later edit to that section builds on their text, not over it',
  String((server.doc.purpose || {}).mission || '').indexOf(THEIRS) === 0,
  'the server now holds ' + JSON.stringify((server.doc.purpose || {}).mission));

console.log('\n──────────────────────────────────────────');
console.log('Three members in one program, saving over each other');
console.log('  program    :', MODULE);
console.log('  assertions :', checks);
if (failures.length) {
  console.log('  BROKEN     :', failures.length);
  console.log('──────────────────────────────────────────');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('  ✓ a patch that stepped over somebody is followed by a read');
console.log('  ✓ the rev watermark only ever claims what this browser has actually seen');
console.log('  ✓ so nobody sits on an old value, and nobody patches it back');
console.log('──────────────────────────────────────────');
