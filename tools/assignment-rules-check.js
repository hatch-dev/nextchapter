#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   assignment-rules-check.js — who may sign a step off
   ─────────────────────────────────────────────────────────────
   The rule, in both programs:

     · Only an administrator may decide who is assigned to a step.
     · A step assigned to someone is theirs to complete — and the
       administrator's. Nobody else can sign it off.
     · A step assigned to NOBODY stays open to the whole team, so work
       does not stall waiting for an admin to get round to it.
     · Assignments belong to ONE program. Every program numbers its
       steps 1.1 … 4.4, so an assignment that is not scoped to a
       program is an assignment in all of them at once.

   The Pipeline has enforced the first three since assignments were
   built. Executive Readiness enforced none of them — its doneBtn came
   from a standalone reference build that had no team model in it, so
   any member could mark any step complete. The fourth was wrong for
   both: step_assignments had no module column.

   This drives the real code — doneBtn() and stepCompleteLock() — for
   every combination of program, viewer and assignment state, and reads
   the answer out of the markup: is the button live, and does the
   helper text explain the block. Nothing is stubbed except the browser.

   Usage:  node tools/assignment-rules-check.js [-v]
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.indexOf('-v') >= 0;

/* ── Stub browser (file:// — no server needed for this) ──────── */
const NUM = { scrollTop: 1, scrollHeight: 1, offsetWidth: 1, offsetHeight: 1, clientWidth: 1, selectionStart: 1, length: 1 };
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
function storage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); }, clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null, get length() { return m.size; }
  };
}
function settled(state, val) {
  const self = {
    then(ok, err) {
      try { return state === 'ok' ? (ok ? adopt(ok(val)) : self) : (err ? adopt(err(val)) : self); }
      catch (e) { return settled('err', e); }
    },
    catch(err) { return self.then(null, err); },
    finally(fn) { try { if (fn) fn(); } catch (e) { } return self; }
  };
  return self;
}
function adopt(v) { return v && typeof v.then === 'function' ? v : settled('ok', v); }

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
  const G = {
    console: { log() { }, warn() { }, error() { }, info() { } },
    APP_CATALOGUE: CATALOGUE.roles,
    localStorage: storage(), sessionStorage: storage(),
    document: {
      getElementById(id) { if (!byId[id]) { byId[id] = el(); byId[id].id = id; } return byId[id]; },
      querySelector: () => el(), querySelectorAll: () => [],
      createElement: t => el(t), createDocumentFragment: () => el(), createTextNode: () => el(),
      addEventListener() { }, removeEventListener() { }, readyState: 'complete', activeElement: null,
      body: el('body'), documentElement: el('html'), head: el('head'), title: ''
    },
    location: {
      href: 'file:///i.html' + search, protocol: 'file:', host: '', hostname: '', port: '',
      pathname: '/i.html', search: search, hash: '', origin: 'null', assign() { }, replace() { }, reload() { }
    },
    history: { pushState() { }, replaceState() { }, back() { }, forward() { }, go() { }, length: 1, state: null },
    navigator: { userAgent: 'assign-check', language: 'en-US', languages: ['en-US'], onLine: false, clipboard: { writeText: () => Promise.resolve() } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() { } }, Blob: function () { },
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
    addEventListener() { }, removeEventListener() { }, open: () => null, scrollTo() { }, print() { },
    confirm: () => true, alert() { }, prompt: () => null,
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    FileReader: function () { this.readAsText = () => { }; this.addEventListener = () => { }; },
    fetch: () => settled('err', new Error('no server')),
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };
  vm.createContext(G); G.window = G; G.self = G; G.globalThis = G;
  const errs = [];
  files.forEach(p => {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), G, { filename: path.basename(p) }); }
    catch (e) { errs.push(path.basename(p) + ': ' + ((e && e.message) || e)); }
  });
  return { G, errs };
}

/* ── The question this asks of the running code ────────────────
   doneBtn() is what a step body calls to draw its sign-off control, and the
   only honest way to know whether someone is allowed is to draw it and look. A
   live button carries no `disabled`; a blocked one is disabled and says why.

   The ported programs' doneBtn take different fourth and fifth arguments — the
   shell's are (complete, helper), Executive Readiness's and Responsible AI
   Governance's are (taskId, sectionComplete), because both came from a
   reference build. Called with the wrong one, the shell's reads a step id as
   "already complete" and returns the finished-state button, which has no
   `disabled` on it and reads as "allowed" however the permissions actually
   stand. All of them take the step from currentStep, which is what the lock is
   computed against.

   Each ported program hangs its doneBtn off its own single global, so which
   object to ask is part of what a program IS here. */
function signOffOffered(G, moduleId, stepId) {
  G.currentStep = stepId;
  const onclick = "markStepComplete('" + stepId + "')";
  const ns = NS[moduleId] && G[NS[moduleId]];
  const html = ns
    ? ns.doneBtn(onclick, false, null, stepId, false)     // (…, taskId, sectionComplete)
    : G.doneBtn(onclick, false, null, false, null);       // (…, complete, helper)
  return { live: !/disabled/.test(html), html: html };
}

/* Every Enterprise program that has its own code, and the global each one
   hangs its ported functions off. A program without an entry uses the shell's
   doneBtn, which is right for the Pipeline — the shell IS the Pipeline. */
const PROGRAMS = ['pipeline', 'exec-readiness', 'ai-governance'];
const NS = { 'exec-readiness': 'ER', 'ai-governance': 'RG' };

const failures = [];
function expect(cond, what) { if (!cond) failures.push(what); }

PROGRAMS.forEach(moduleId => {
  const { G, errs } = boot(moduleId);
  errs.forEach(e => failures.push(moduleId + ' — load ' + e));
  if (!G.Modules || G.Modules.activeId() !== moduleId) { failures.push(moduleId + ' — wrong active module'); return; }

  /* A team of three: the administrator, the member a step is assigned to, and
     a member it is not. */
  G.USERS.length = 0;
  G.USERS.push(
    { id: 'u_admin', serverId: 'u_admin', name: 'Maria Torres', username: 'maria', role: 'Administrator', initials: 'MT', color: '#B8892A', admin: true },
    { id: 'u_owner', serverId: 'u_owner', name: 'John Bell', username: 'john', role: 'Operations Lead', initials: 'JB', color: '#1B6B5A' },
    { id: 'u_other', serverId: 'u_other', name: 'Ada Kern', username: 'ada', role: 'Engineer', initials: 'AK', color: '#2D5A8E' }
  );
  G.data = G.Modules.emptyData();
  G.data.roster = G.USERS.slice();
  G.currentOrgId = 'org_x';
  G.isAppAdmin = false;

  const STEP = '2.1', OPEN = '2.2';
  G.data.assigns = { [STEP]: ['u_owner'] };   // 2.1 assigned to John; 2.2 to nobody

  if (VERBOSE) console.log('\n' + moduleId);

  [['admin', 'u_admin'], ['assignee', 'u_owner'], ['other member', 'u_other']].forEach(([who, id]) => {
    G.currentUserId = id;
    const assigned = signOffOffered(G, moduleId, STEP);
    const open = signOffOffered(G, moduleId, OPEN);
    if (VERBOSE) {
      console.log('   ' + who.padEnd(14)
        + 'assigned step: ' + (assigned.live ? 'can sign off ' : 'BLOCKED      ')
        + ' | unassigned step: ' + (open.live ? 'can sign off' : 'BLOCKED'));
    }

    /* An unassigned step is the ADMINISTRATOR's (ruled 2026-09-09, extended
       from sign-off to editing 2026-09-11). It used to be open to the whole
       team, on the reasoning that work must not stall waiting for an admin —
       but that made every unassigned step in the program signable by any
       member, which is not accountability. This tool still asserted the old
       rule, so it had been failing five ways ever since. */
    if (who === 'admin') {
      expect(open.live, moduleId + ': the admin cannot sign off an UNASSIGNED step');
    } else {
      expect(!open.live, moduleId + ': ' + who + ' CAN sign off an UNASSIGNED step (it is the administrator’s)');
      expect(/nobody is assigned/i.test(open.html),
        moduleId + ': the block on an unassigned step does not say it is unassigned');
    }

    if (who === 'other member') {
      expect(!assigned.live, moduleId + ': ' + who + ' CAN sign off a step assigned to someone else');
      expect(/assigned to/i.test(assigned.html),
        moduleId + ': the block on ' + who + ' does not say who it is assigned to');
      expect(/John Bell/.test(assigned.html),
        moduleId + ': the block does not name the assignee');
    } else {
      expect(assigned.live, moduleId + ': the ' + who + ' cannot sign off the assigned step');
    }
  });

  /* Only an administrator may change who is assigned. */
  G.currentUserId = 'u_other';
  expect(G.canAssign() === false, moduleId + ': a member is allowed to change assignments');
  expect(!/assign-add/.test(G.assignBtn(STEP)), moduleId + ': a member is shown the "+ assign" control');
  G.currentUserId = 'u_admin';
  expect(G.canAssign() === true, moduleId + ': the administrator cannot change assignments');
  expect(/assign-add/.test(G.assignBtn(STEP)), moduleId + ': the administrator is not shown the "+ assign" control');

  /* And an assignment names a program as well as an organization. */
  expect(G.assignmentsModule() === moduleId,
    moduleId + ': assignments would be saved against module "' + G.assignmentsModule() + '"');
});

console.log('\n──────────────────────────────────────────');
console.log('Who may sign a step off');
console.log('  programs checked:', PROGRAMS.length, '· viewers: admin, assignee, other member');
if (failures.length) {
  console.log('  BROKEN          :', failures.length);
  console.log('──────────────────────────────────────────');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('  ✓ a step is the assignee\'s and the admin\'s; unassigned, it is the admin\'s alone');
console.log('  ✓ only the administrator can assign, in every program');
console.log('  ✓ assignments are scoped to the program they were made in');
console.log('──────────────────────────────────────────');
